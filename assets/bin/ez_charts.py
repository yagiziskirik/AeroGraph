#!/usr/bin/env python3
"""
ez_charts.py - Dynamic Ground Taxi & ILS Approach Charts for Falcon BMS VR Kneeboards
Part of EZBoards integration.
"""

import os
import sys
import re
import json
import math
import hashlib
import subprocess
import winreg
import argparse
from pathlib import Path

# Try importing fitz (PyMuPDF)
try:
    import pymupdf as fitz
except ImportError:
    try:
        import fitz
    except ImportError:
        fitz = None

HERE = Path(__file__).resolve().parent
EZ_ROOT = HERE.parent
DATA_DIR = EZ_ROOT / "data"
CHARTS_DIR = EZ_ROOT / "charts"
BUNDLED_CHARTS_DIR = CHARTS_DIR / "bundled"
IMAGES_DIR = EZ_ROOT / "images"
CUSTOM_DIR = EZ_ROOT / "custom"
WORK_DIR = EZ_ROOT / "work"
BIN_DIR = EZ_ROOT / "bin"
MAGICK = BIN_DIR / "magick.exe"
WKHTMLTOIMAGE = BIN_DIR / "wkhtmltoimage.exe"
MERGE_BAT = EZ_ROOT / "MERGE.BAT"
CONFIG_BAT = EZ_ROOT / "CONFIG.BAT"
GEO_DIR = DATA_DIR / "geo"
MAPS_DIR = DATA_DIR / "maps"

NM_TO_FT = 6076.12

# Standard SAM threat ranges (in Nautical Miles)
SAM_RANGES = {
    "sa-2": 18.0, "sa-3": 10.0, "sa-4": 24.0, "sa-5": 135.0, "sa-6": 13.0,
    "sa-8": 6.5, "sa-10": 40.0, "sa-11": 17.0, "sa-12": 54.0, "sa-13": 2.7,
    "sa-15": 6.5, "sa-17": 17.0, "sa-19": 4.5, "sa-20": 65.0, "sa-21": 100.0,
    "sa-22": 9.0, "hq-2": 18.0, "hq-9": 54.0, "hq-16": 22.0, "hq-7": 6.5,
    "tunguska": 4.5, "pantsir": 9.0, "tor": 6.5, "buk": 17.0, "kub": 13.0,
    "ks-19": 3.5, "zsu-23": 1.5, "2s6": 4.5,
}

COMPASS_DIRS = {
    "north": (1.0, 0.0), "n": (1.0, 0.0),
    "south": (-1.0, 0.0), "s": (-1.0, 0.0),
    "east": (0.0, 1.0), "e": (0.0, 1.0),
    "west": (0.0, -1.0), "w": (0.0, -1.0),
    "northeast": (0.7071, 0.7071), "ne": (0.7071, 0.7071),
    "northwest": (0.7071, -0.7071), "nw": (0.7071, -0.7071),
    "southeast": (-0.7071, 0.7071), "se": (-0.7071, 0.7071),
    "southwest": (-0.7071, -0.7071), "sw": (-0.7071, -0.7071),
}

REG_KEY = r"SOFTWARE\WOW6432Node\Benchmark Sims\Falcon BMS 4.38"

# Custom static pages definition
CUSTOM_PAGES = [
    ("F16_2L", CUSTOM_DIR / "kneeboard-checklist-1-start.html", "Checklist 1 (Start)"),
    ("F16_3L", CUSTOM_DIR / "kneeboard-checklist-2-taxi-takeoff-land.html", "Checklist 2 (Taxi/TO/Land)"),
    ("F16_4L", CUSTOM_DIR / "kneeboard-checklist-3-tacan-aar.html", "Checklist 3 (TACAN/AAR)"),
    ("F16_5L", CUSTOM_DIR / "kneeboard-checklist-4-fence.html", "Checklist 4 (Fence In/Out)"),
    ("F16_6L", CUSTOM_DIR / "kneeboard-checklist-5-lgb-mav-mark.html", "Checklist 5 (LGB/Mav/Mark)"),
    ("F16_2R", CUSTOM_DIR / "kneeboard-threats-air.html", "Threats Air"),
    ("F16_3R", CUSTOM_DIR / "kneeboard-threats-gnd.html", "Threats Ground"),
]


def file_md5(path):
    if not os.path.exists(path):
        return ""
    h = hashlib.md5()
    with open(path, "rb") as f:
        while chunk := f.read(8192):
            h.update(chunk)
    return h.hexdigest()


def get_registry_value(name, default=""):
    try:
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, REG_KEY) as key:
            val, _ = winreg.QueryValueEx(key, name)
            return val
    except Exception:
        return default


def get_pilot_callsign():
    bin_callsign = get_registry_value("PilotCallsign", None)
    if isinstance(bin_callsign, bytes):
        return bin_callsign.decode("latin1", "ignore").rstrip("\x00")
    elif isinstance(bin_callsign, str):
        return bin_callsign.rstrip("\x00")
    return "Viper"


def get_base_dir():
    reg_base = get_registry_value("baseDir", "")
    if reg_base and os.path.isdir(reg_base):
        return Path(reg_base)
    fallback = Path(r"C:\Games\Falcon BMS 4.38")
    if fallback.is_dir():
        return fallback
    return EZ_ROOT.parent


def get_theater_id():
    cur_theater = get_registry_value("curTheater", "Korea KTO")
    theater_map = {
        "Korea KTO": "korea-kto",
        "Balkans": "balkans",
        "EF2000 BTO": "ef2000-bto",
        "Falklands": "falklands",
        "Hellas": "hellas",
        "Israel": "israel",
    }
    return theater_map.get(cur_theater, "korea-kto")


def parse_briefing(briefing_path):
    if not os.path.exists(briefing_path):
        return None

    with open(briefing_path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read()

    data = {
        "callsign": "VIPER 1",
        "pkg_num": "1001",
        "role": "SWEEP",
        "aircraft": "F-16CM",
        "task": "SWEEP",
        "to_time": "--",
        "push_time": "--",
        "tgt_time": "--",
        "dep_name": None,
        "arr_name": None,
        "alt_name": None,
        "takeoff_wind_deg": 0,
        "takeoff_wind_kts": 0,
        "landing_wind_deg": 0,
        "landing_wind_kts": 0,
        "steerpoints": [],
        "threats": [],
    }

    # Callsign & Role
    call_m = re.search(r"^\s*([A-Za-z0-9_-]+)\s*\(([A-Z\s]+)\)", text, re.MULTILINE)
    if call_m:
        data["callsign"] = call_m.group(1).strip()
        data["role"] = call_m.group(2).strip()

    # Package #
    pkg_m = re.search(r"Package #:\s*(\d+)", text)
    if pkg_m:
        data["pkg_num"] = pkg_m.group(1)

    # Package Elements line
    elem_m = re.search(r"([A-Za-z0-9_-]+)\s+\d+\s*\([xX\s]*\)\s+([A-Za-z0-9_-]+)\s+([0-9\sA-Za-z-]+?)\s{2,}([^\r\n]+)", text)
    if elem_m:
        data["aircraft"] = elem_m.group(3).strip()
        data["task"] = elem_m.group(4).strip()

    # Timings
    to_m = re.search(r"T/O:\s*([0-9:zZ]+)", text)
    if to_m:
        data["to_time"] = to_m.group(1)
    push_m = re.search(r"Push:\s*([0-9:zZ]+)", text)
    if push_m:
        data["push_time"] = push_m.group(1)
    tgt_m = re.search(r"Tgt:\s*([0-9:zZ]+)", text)
    if tgt_m:
        data["tgt_time"] = tgt_m.group(1)

    # Extract departure and arrival from Comm Ladder
    dep_match = re.search(r"Dep Ground:\s*([A-Za-z0-9\s-]+?)\s+Ground", text)
    if dep_match:
        data["dep_name"] = dep_match.group(1).strip()
    else:
        dep_tower = re.search(r"Dep Tower:\s*([A-Za-z0-9\s-]+?)\s+Tower", text)
        if dep_tower:
            data["dep_name"] = dep_tower.group(1).strip()

    arr_match = re.search(r"Arr Ground:\s*([A-Za-z0-9\s-]+?)\s+Ground", text)
    if arr_match:
        data["arr_name"] = arr_match.group(1).strip()
    else:
        arr_tower = re.search(r"Arr Tower:\s*([A-Za-z0-9\s-]+?)\s+Tower", text)
        if arr_tower:
            data["arr_name"] = arr_tower.group(1).strip()

    # Alternate airfield from Emergency Procedures or Steerpoints
    alt_match = re.search(r"Alternate airfield:\s*([^\r\n]+)", text)
    if alt_match:
        val = alt_match.group(1).strip()
        if "no alternate" not in val.lower() and "none" not in val.lower():
            clean_val = re.sub(r"\(.*?\)", "", val).strip()
            data["alt_name"] = clean_val

    # Weather
    to_wind = re.search(r"Take Off:.*?Wind:\s*(\d+)deg@\s*(\d+)kts", text, re.DOTALL)
    if to_wind:
        data["takeoff_wind_deg"] = int(to_wind.group(1))
        data["takeoff_wind_kts"] = int(to_wind.group(2))

    land_wind = re.search(r"Landing:.*?Wind:\s*(\d+)deg@\s*(\d+)kts", text, re.DOTALL)
    if land_wind:
        data["landing_wind_deg"] = int(land_wind.group(1))
        data["landing_wind_kts"] = int(land_wind.group(2))

    # Steerpoints table
    stpt_section = re.search(r"Steerpoints:\s*\r?\n([\s\S]+?)(?:\r?\n\r?\n[A-Z][A-Za-z\s]+:|\Z)", text)
    if stpt_section:
        stpt_text = stpt_section.group(1)
        for line in stpt_text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            cols = [c.strip() for c in line.split("\t") if c.strip()]
            if not cols:
                continue
            try:
                num = int(cols[0])
                desc = cols[1] if len(cols) > 1 else f"STPT {num}"
                time = cols[2] if len(cols) > 2 else "--"
                dist = cols[3] if len(cols) > 3 else "--"
                head = cols[4] if len(cols) > 4 else "--"
                cas = cols[5] if len(cols) > 5 else "--"
                alt = cols[6] if len(cols) > 6 else "--"
                action = cols[7] if len(cols) > 7 else "--"
                form = cols[8] if len(cols) > 8 else "--"
                comm = cols[9] if len(cols) > 9 else "--"

                data["steerpoints"].append({
                    "num": num,
                    "desc": desc,
                    "time": time,
                    "dist": dist,
                    "head": head,
                    "cas": cas,
                    "alt": alt,
                    "action": action,
                    "form": form,
                    "comm": comm,
                })
            except ValueError:
                continue

    # Threat Analysis
    threat_section = re.search(r"Surface-To-Air Threats:\s*\r?\n([\s\S]+?)(?:\r?\n\r?\n[A-Z][A-Za-z\s]+:|\Z)", text)
    if threat_section:
        threat_text = threat_section.group(1)
        pat = re.compile(r"([A-Za-z0-9\-/\(\)\s]+?)\s*(?:missile launchers|battalion|site)?\s+(\d+(?:\.\d+)?)\s*nm\s+([a-z]+)\s+of\s+([A-Za-z0-9\s-]+)", re.IGNORECASE)
        for line in threat_text.splitlines():
            line = line.strip()
            if not line or "no known enemy" in line.lower():
                continue
            m = pat.search(line)
            if m:
                sys_name = m.group(1).strip()
                dist_nm = float(m.group(2))
                direction = m.group(3).strip().lower()
                place_name = m.group(4).strip()
                data["threats"].append({
                    "system": sys_name,
                    "dist_nm": dist_nm,
                    "dir": direction,
                    "place": place_name,
                    "raw": line,
                })

    return data


def load_theater_database(theater_id):
    index_file = DATA_DIR / "index.json"
    if not index_file.exists():
        return None, None, None, {}

    with open(index_file, "r", encoding="utf-8") as f:
        idx = json.load(f)

    th_entry = next((t for t in idx.get("theaters", []) if t.get("id") == theater_id), None)
    if not th_entry:
        th_entry = idx.get("theaters", [])[0]

    ap_set_id = th_entry.get("airportSet")
    ai_set_id = th_entry.get("airfieldSet")

    airports_list = []
    ap_file = DATA_DIR / "airports" / f"{ap_set_id}.json"
    if ap_file.exists():
        with open(ap_file, "r", encoding="utf-8") as f:
            ap_data = json.load(f)
            airports_list = ap_data.get("airports", [])

    airfield_map = {}
    ai_file = DATA_DIR / "airfields" / f"{ai_set_id}.json"
    if ai_file.exists():
        with open(ai_file, "r", encoding="utf-8") as f:
            airfield_map = json.load(f)

    charts_index = {}
    charts_file = DATA_DIR / "charts.json"
    if charts_file.exists():
        with open(charts_file, "r", encoding="utf-8") as f:
            charts_index = json.load(f).get(ap_set_id, {})

    return airports_list, airfield_map, charts_index, th_entry


AIRPORT_ALIASES = {
    "kunsan": "gunsan",
    "taegu": "daegu",
    "kimhae": "gimhae",
    "kwangju": "gwangju",
    "pusan": "gimhae",
    "kangnung": "gangneung",
    "chongju": "cheongju",
}


def find_airport(airports_list, query):
    if not query:
        return None
    q = query.lower().strip()
    q = AIRPORT_ALIASES.get(q, q)
    for ap in airports_list:
        name = ap.get("name", "").lower()
        full = ap.get("fullName", "").lower()
        icao = (ap.get("icao") or "").lower()
        if q == icao or q == name or q == full:
            return ap
    for ap in airports_list:
        name = ap.get("name", "").lower()
        full = ap.get("fullName", "").lower()
        if q in name or q in full:
            return ap
    return None


def load_airfield_model(airfield_map, airport_id):
    af_id = airfield_map.get(str(airport_id))
    if not af_id:
        return None
    af_file = DATA_DIR / "airfields" / f"{af_id}.json"
    if not af_file.exists():
        return None
    with open(af_file, "r", encoding="utf-8") as f:
        return json.load(f)


def calculate_active_runways(airport, wind_deg, wind_kts):
    candidates = []
    for rwy in (airport.get("runways") or []):
        for end in (rwy.get("ends") or []):
            course = end.get("headingTrue", 0.0)
            desig = end.get("designator", "")
            diff = (wind_deg - course + 180) % 360 - 180
            headwind = wind_kts * math.cos(math.radians(diff))
            crosswind = wind_kts * math.sin(math.radians(diff))
            candidates.append({
                "designator": desig,
                "course": course,
                "headwind": headwind,
                "crosswind": crosswind,
                "diff": abs(diff),
                "ils": end.get("ils"),
                "pattern": end.get("pattern"),
                "rwy_obj": rwy,
                "end_obj": end
            })

    candidates.sort(key=lambda x: x["headwind"], reverse=True)

    if not candidates:
        return []

    best = candidates[0]
    active = [best]
    for c in candidates[1:]:
        angle_diff = abs((c["course"] - best["course"] + 180) % 360 - 180)
        if angle_diff <= 30 and c["headwind"] > -2:
            active.append(c)

    return active


def cable_label(d_list):
    if not d_list:
        return "None"
    parts = []
    for d in sorted(d_list):
        if d < -100:
            parts.append(f"{abs(d):,} ft before")
        elif d <= 100:
            parts.append("at threshold")
        else:
            parts.append(f"{d:,} ft")
    return " · ".join(parts)


def generate_taxi_chart_html(airport, airfield, active_runways, wind_deg, wind_kts, is_departure=True):
    """
    Generates a high-contrast, large-text daylight aeronautical paper taxi chart HTML+SVG (1024x1554)
    optimized for VR readability.
    """
    ap_name = (airport.get("name") or "AIRFIELD").upper()
    icao = airport.get("icao") or ""
    elev = airport.get("elevationFt")
    if elev is None:
        elev = 0
    freqs = airport.get("freqs") or {}
    tacan = airport.get("tacan") or {}

    active_desigs = [a["designator"] for a in active_runways]
    active_str = " & ".join(active_desigs) if active_desigs else "CALM"

    # Safely extract airfield sub-structures (paved, features, etc. may be None in JSON)
    paved_rings = airfield.get("paved") or []
    routes_list = airfield.get("routes") or []
    features_list = airfield.get("features") or []
    runways_list = airfield.get("runways") or []
    signs_list = airfield.get("signs") or []

    # Step 0: Check airport orientation. If airport runs primarily East-West,
    # rotate chart 90 degrees counter-clockwise so it renders vertically (portrait).
    raw_e0, raw_e1 = float("inf"), float("-inf")
    raw_n0, raw_n1 = float("inf"), float("-inf")
    for r in runways_list:
        for c in r.get("corners", []):
            ce, cn = c.get("e", 0), c.get("n", 0)
            raw_e0 = min(raw_e0, ce); raw_e1 = max(raw_e1, ce)
            raw_n0 = min(raw_n0, cn); raw_n1 = max(raw_n1, cn)
    for route in routes_list:
        for nd in route.get("nodes", []):
            ne, nn = nd.get("e", 0), nd.get("n", 0)
            raw_e0 = min(raw_e0, ne); raw_e1 = max(raw_e1, ne)
            raw_n0 = min(raw_n0, nn); raw_n1 = max(raw_n1, nn)

    if raw_e0 == float("inf"):
        raw_e0, raw_e1, raw_n0, raw_n1 = -1000, 1000, -1000, 1000

    raw_ew_span = raw_e1 - raw_e0
    raw_ns_span = raw_n1 - raw_n0

    rotate_90 = raw_ew_span > (raw_ns_span * 1.05)
    chart_rot_deg = 270 if rotate_90 else 0

    def rot_coord(e, n):
        if rotate_90:
            return (-n, e)
        return (e, n)

    # Parking spots info
    route_0 = routes_list[0] if routes_list else {}
    parking_spots = route_0.get("parking", [])
    r0_nodes = route_0.get("nodes", [])

    spots_rot = []
    for sp in parking_spots:
        k = sp.get("k", 0)
        if k < len(r0_nodes):
            pnode = r0_nodes[k]
            te, tn = rot_coord(pnode["e"], pnode["n"])
            spots_rot.append({
                "spot": sp,
                "n": sp.get("n", 0),
                "is_alert": sp.get("q", 0) != 0,
                "e": pnode["e"],
                "n_coord": pnode["n"],
                "te": te,
                "tn": tn,
            })

    # Dynamic page budget calculation for 1554px total height (padding: 82px top to clear kneeboard clip, 14px bottom)
    # Header (~164px) + Footer table (48px header/border + 40px per end) + margins & padding (~138px) = 302px overhead
    rwy_ends_count = sum(len(r.get("ends") or []) for r in (airport.get("runways") or []))
    footer_table_h = 48 + (rwy_ends_count * 40)
    map_h = max(550, 1532 - 302 - footer_table_h)

    svg_w = 992
    svg_h = map_h

    pad = 250
    e0, e1 = float("inf"), float("-inf")
    n0, n1 = float("inf"), float("-inf")

    all_op_pts = []

    def see(e, n):
        nonlocal e0, e1, n0, n1
        te, tn = rot_coord(e, n)
        e0 = min(e0, te); e1 = max(e1, te)
        n0 = min(n0, tn); n1 = max(n1, tn)

    # Operational bounds: Focus zoom on runways, taxiway routes, and ramp stands
    for r in runways_list:
        for c in r.get("corners", []):
            see(c.get("e", 0), c.get("n", 0))
            all_op_pts.append(rot_coord(c.get("e", 0), c.get("n", 0)))

    for route in routes_list:
        for nd in route.get("nodes", []):
            see(nd.get("e", 0), nd.get("n", 0))
            all_op_pts.append(rot_coord(nd.get("e", 0), nd.get("n", 0)))

    if e0 != float("inf"):
        op_margin = 800
        for ring in paved_rings:
            for i in range(0, len(ring), 2):
                pe, pn = ring[i], ring[i+1]
                te, tn = rot_coord(pe, pn)
                if (e0 - op_margin) <= te <= (e1 + op_margin) and (n0 - op_margin) <= tn <= (n1 + op_margin):
                    see(pe, pn)
    else:
        for ring in paved_rings:
            for i in range(0, len(ring), 2):
                see(ring[i], ring[i+1])

    if e0 == float("inf"):
        e0, e1, n0, n1 = -1000, 1000, -1000, 1000

    e0 -= pad; e1 += pad
    n0 -= pad; n1 += pad

    dx = e1 - e0
    dy = n1 - n0

    # Overlap check on full map (circle radius 10px, diameter 20px)
    scale_full = min((svg_w - 70.0) / dx, (svg_h - 60.0) / dy)
    ol_count = 0
    for i in range(len(spots_rot)):
        dists = [math.hypot(spots_rot[i]["te"] - spots_rot[j]["te"], spots_rot[i]["tn"] - spots_rot[j]["tn"]) * scale_full for j in range(len(spots_rot)) if i != j]
        if dists and min(dists) < 15.0: # >25% overlap
            ol_count += 1
    ol_ratio = ol_count / len(spots_rot) if spots_rot else 0.0

    # If spots fit comfortably without severe overlap (e.g. Seosan: 34 spots, ol_ratio < 0.35), no inset needed!
    has_inset = len(spots_rot) >= 12 and not (len(spots_rot) < 42 and ol_ratio < 0.35)

    if has_inset:
        max_ap_w = 460.0
        scale = min(max_ap_w / dx, (svg_h - 60.0) / dy)
        oy = 30.0 + (svg_h - 60.0 - dy * scale) / 2.0

        # Minimum ox to ensure top clears North & Wind indicators (X >= 122 if Y < 235)
        # and bottom keeps at least 22px margin
        min_ox = 22.0
        for te, tn in all_op_pts:
            y_val = oy + (n1 - tn) * scale
            req_x = 122.0 if y_val < 235.0 else 22.0
            cand_ox = req_x - (te - e0) * scale
            if cand_ox > min_ox:
                min_ox = cand_ox
        ox = min_ox
    else:
        scale = min((svg_w - 70.0) / dx, (svg_h - 60.0) / dy)
        ox = 35.0 + (svg_w - 70.0 - dx * scale) / 2.0
        oy = 30.0 + (svg_h - 60.0 - dy * scale) / 2.0

    def X(e, n):
        te, _ = rot_coord(e, n)
        return ox + (te - e0) * scale

    def Y(e, n):
        _, tn = rot_coord(e, n)
        return oy + (n1 - tn) * scale

    svg_parts = []

    # 1. Paved areas
    for ring in paved_rings:
        if len(ring) < 6:
            continue
        d = f"M {X(ring[0], ring[1]):.1f} {Y(ring[0], ring[1]):.1f}"
        for i in range(2, len(ring), 2):
            d += f" L {X(ring[i], ring[i+1]):.1f} {Y(ring[i], ring[i+1]):.1f}"
        d += " Z"
        svg_parts.append(f'<path d="{d}" fill="#CBD3DA" fill-rule="evenodd" stroke="#8A96A0" stroke-width="1.2"/>')

    # 2. Features / Buildings
    for f in features_list:
        k = f.get("k", "")
        e = f.get("e", 0); n = f.get("n", 0)
        w = f.get("w", 60); l = f.get("l", 60)
        h = f.get("h", 0)
        cx, cy = X(e, n), Y(e, n)
        fw = max(2.5, w * scale)
        fl = max(2.5, l * scale)
        rot_h = (h + chart_rot_deg) % 360

        if k == "tower":
            svg_parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="11" fill="#673AB7" stroke="#311B92" stroke-width="2"/>')
            svg_parts.append(f'<rect x="{cx-16:.1f}" y="{cy-22:.1f}" width="32" height="15" rx="3" fill="#311B92"/>')
            svg_parts.append(f'<text x="{cx:.1f}" y="{cy-11:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#FFFFFF" text-anchor="middle">TWR</text>')
        elif k == "shelter":
            svg_parts.append(f'<rect x="{cx - fw/2:.1f}" y="{cy - fl/2:.1f}" width="{fw:.1f}" height="{fl:.1f}" fill="#78909C" stroke="#37474F" stroke-width="0.8" transform="rotate({rot_h:.1f} {cx:.1f} {cy:.1f})"/>')
        elif k == "hangar":
            svg_parts.append(f'<rect x="{cx - fw/2:.1f}" y="{cy - fl/2:.1f}" width="{fw:.1f}" height="{fl:.1f}" fill="#8D6E63" stroke="#3E2723" stroke-width="0.8" transform="rotate({rot_h:.1f} {cx:.1f} {cy:.1f})"/>')
        elif k != "pavement":
            svg_parts.append(f'<rect x="{cx - fw/2:.1f}" y="{cy - fl/2:.1f}" width="{fw:.1f}" height="{fl:.1f}" fill="#B0BEC5" stroke="#546E7A" stroke-width="0.6" transform="rotate({rot_h:.1f} {cx:.1f} {cy:.1f})"/>')

    # 3. Runways (Pavement only - badges rendered on top of taxiways)
    runway_ends_to_draw = []
    for r in runways_list:
        corners = r.get("corners", [])
        if len(corners) >= 4:
            d = "M " + " L ".join(f"{X(c['e'], c['n']):.1f} {Y(c['e'], c['n']):.1f}" for c in corners) + " Z"
            svg_parts.append(f'<path d="{d}" fill="#1E2328" stroke="#FFFFFF" stroke-width="2"/>')

        for end in r.get("ends", []):
            desig = end.get("designator", "")
            at = end.get("at", {})
            if at and "e" in at and "n" in at:
                runway_ends_to_draw.append((at["e"], at["n"], desig))

        # Arresting cables
        for cab in r.get("cables", []):
            ce, cn = cab.get("e", 0), cab.get("n", 0)
            cx, cy = X(ce, cn), Y(ce, cn)
            svg_parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="5" fill="#FFC107" stroke="#FF6F00" stroke-width="1.5"/>')

    # 4. Taxiways: yellow centerlines
    drawn_segments = set()
    for route in routes_list:
        r_nodes = route.get("nodes", [])
        r_ed = route.get("ed", [])
        for i in range(0, len(r_ed), 2):
            idx1, idx2 = r_ed[i], r_ed[i+1]
            if idx1 < len(r_nodes) and idx2 < len(r_nodes):
                na, nb = r_nodes[idx1], r_nodes[idx2]
                p1 = (round(na["e"] / 8) * 8, round(na["n"] / 8) * 8)
                p2 = (round(nb["e"] / 8) * 8, round(nb["n"] / 8) * 8)
                if p1 != p2:
                    seg_key = (min(p1, p2), max(p1, p2))
                    if seg_key not in drawn_segments:
                        drawn_segments.add(seg_key)
                        svg_parts.append(f'<line x1="{X(na["e"], na["n"]):.1f}" y1="{Y(na["e"], na["n"]):.1f}" x2="{X(nb["e"], nb["n"]):.1f}" y2="{Y(nb["e"], nb["n"]):.1f}" stroke="#FFC107" stroke-width="4.5" stroke-linecap="round"/>')

    # 5. Taxiway Letters: Scan ALL routes and place big readable yellow badges
    all_taxi_letters = {}
    for r in routes_list:
        for nd in r.get("nodes", []):
            l = nd.get("l")
            if l:
                all_taxi_letters.setdefault(l, []).append((nd["e"], nd["n"]))

    screen_rwy_ends = [(X(re[0], re[1]), Y(re[0], re[1])) for re in runway_ends_to_draw]
    placed_signs = []
    for l, pts in sorted(all_taxi_letters.items()):
        letter_clusters = []
        for pe, pn in pts:
            placed = False
            for c in letter_clusters:
                avg_e = sum(p[0] for p in c) / len(c)
                avg_n = sum(p[1] for p in c) / len(c)
                if math.hypot(pe - avg_e, pn - avg_n) < 1500:
                    c.append((pe, pn))
                    placed = True
                    break
            if not placed:
                letter_clusters.append([(pe, pn)])

        for c in letter_clusters:
            mid_e = sum(p[0] for p in c) / len(c)
            mid_n = sum(p[1] for p in c) / len(c)
            px, py = X(mid_e, mid_n), Y(mid_e, mid_n)

            # Avoid collision with runway ends
            if screen_rwy_ends:
                closest_end = min(screen_rwy_ends, key=lambda re: (px - re[0])**2 + (py - re[1])**2)
                dist_to_end = math.hypot(px - closest_end[0], py - closest_end[1])
                if dist_to_end < 50:
                    vx = px - closest_end[0]
                    vy = py - closest_end[1]
                    vlen = math.hypot(vx, vy) or 1.0
                    px = closest_end[0] + (vx / vlen) * 55
                    py = closest_end[1] + (vy / vlen) * 55

            if any(math.hypot(px - sx, py - sy) < 46 for sx, sy in placed_signs):
                continue
            placed_signs.append((px, py))
            svg_parts.append(f'<rect x="{px-23:.1f}" y="{py-21:.1f}" width="46" height="42" rx="6" fill="#FFEB3B" stroke="#000000" stroke-width="3"/>')
            svg_parts.append(f'<text x="{px:.1f}" y="{py+11:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="28" fill="#000000" text-anchor="middle">{l}</text>')

    # 5.5 Runway End Badges (RENDERED ON TOP OF TAXIWAYS)
    for re_e, re_n, desig in runway_ends_to_draw:
        ex, ey = X(re_e, re_n), Y(re_e, re_n)
        is_active = desig in active_desigs
        badge_bg = "#1B5E20" if is_active else "#263238"
        badge_border = "#66BB6A" if is_active else "#B0BEC5"
        r_size = 29 if is_active else 25
        svg_parts.append(f'<circle cx="{ex:.1f}" cy="{ey:.1f}" r="{r_size}" fill="{badge_bg}" stroke="{badge_border}" stroke-width="{4 if is_active else 2.6}"/>')
        svg_parts.append(f'<text x="{ex:.1f}" y="{ey+8.5:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="{22 if is_active else 19}" fill="#FFFFFF" text-anchor="middle">{desig}</text>')

    # Hold short markers (Type 21)
    for route in routes_list:
        for nd in route.get("nodes", []):
            if nd.get("t") == 21:
                hx, hy = X(nd["e"], nd["n"]), Y(nd["e"], nd["n"])
                svg_parts.append(f'<circle cx="{hx:.1f}" cy="{hy:.1f}" r="6" fill="#D32F2F" stroke="#FFFFFF" stroke-width="2"/>')

    # 6. Parking / Ramp Spots: Overview spots on main map
    for sp in parking_spots:
        k = sp.get("k", 0)
        if k < len(r0_nodes):
            pnode = r0_nodes[k]
            px, py = X(pnode["e"], pnode["n"]), Y(pnode["e"], pnode["n"])
            svg_parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4" fill="#546E7A" stroke="#263238" stroke-width="1"/>')

    placed_spot_labels = []
    for sp in parking_spots:
        k = sp.get("k", 0)
        n = sp.get("n", 0)
        is_alert = sp.get("q", 0) != 0
        if k < len(r0_nodes):
            pnode = r0_nodes[k]
            px, py = X(pnode["e"], pnode["n"]), Y(pnode["e"], pnode["n"])

            if is_alert:
                placed_spot_labels.append((px, py))
                svg_parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="12" fill="#D32F2F" stroke="#FFFFFF" stroke-width="2"/>')
                svg_parts.append(f'<text x="{px:.1f}" y="{py+5:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="13" fill="#FFFFFF" text-anchor="middle">Q</text>')
                continue

            if any(math.hypot(px - sx, py - sy) < 32 for sx, sy in placed_spot_labels):
                continue

            placed_spot_labels.append((px, py))
            label = f"{n:02d}"
            svg_parts.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="10" fill="#FFFFFF" stroke="#263238" stroke-width="1.8"/>')
            svg_parts.append(f'<text x="{px:.1f}" y="{py+4.5:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="11.5" fill="#000000" text-anchor="middle">{label}</text>')

    # 7. Ramp Parking Detail Inset (Single Panel, Dual Panel, or Triple Panel based on apron density)
    airport_screen_right = ox + dx * scale

    if has_inset and spots_rot and (svg_w - airport_screen_right) > 260:
        # Filter remote threshold outlier pads (e.g. stands 40/41 at Gunsan separated by > 2000ft from nearest 2 spots)
        apron_items = []
        for s in spots_rot:
            dists = sorted([math.hypot(s["te"] - o["te"], s["tn"] - o["tn"]) for o in spots_rot if o != s])
            if len(dists) >= 2 and dists[1] > 2000.0:
                pass  # remote threshold pad, labeled directly on main map
            else:
                apron_items.append(s)

        if not apron_items:
            apron_items = list(spots_rot)

        apron_dx = max(s["te"] for s in apron_items) - min(s["te"] for s in apron_items)
        apron_dy = max(s["tn"] for s in apron_items) - min(s["tn"] for s in apron_items)
        apron_aspect = apron_dy / max(apron_dx, 1.0)

        inset_x = max(airport_screen_right + 20.0, 480.0)
        inset_w = (svg_w - 15.0) - inset_x
        inset_y = 15.0
        inset_h = svg_h - 30.0

        if apron_aspect >= 1.6:
            # Tall apron (e.g. Gimhae): 1 panel filling full height
            panels_config = [
                ("inset_single", "APRON PARKING STANDS (MAGNIFIED)", apron_items, inset_x, inset_y, inset_w, inset_h)
            ]
        elif len(apron_items) >= 60:
            # Dense / large ramp (e.g. Osan, Gunsan): 3 stacked panels
            gap = 10.0
            panel_h = (inset_h - 2.0 * gap) / 3.0
            sorted_spots = sorted(apron_items, key=lambda s: s["tn"], reverse=True)
            n_tot = len(sorted_spots)
            s1 = n_tot // 3
            s2 = 2 * n_tot // 3
            p1_spots = sorted_spots[:s1]
            p2_spots = sorted_spots[s1:s2]
            p3_spots = sorted_spots[s2:]
            panels_config = [
                ("inset_north", "APRON STANDS - NORTH", p1_spots, inset_x, inset_y, inset_w, panel_h),
                ("inset_central", "APRON STANDS - CENTRAL", p2_spots, inset_x, inset_y + panel_h + gap, inset_w, panel_h),
                ("inset_south", "APRON STANDS - SOUTH", p3_spots, inset_x, inset_y + 2.0 * (panel_h + gap), inset_w, panel_h),
            ]
        else:
            # Medium ramp (e.g. Daegu): 2 stacked panels
            gap = 12.0
            panel_h = (inset_h - gap) / 2.0
            sorted_spots = sorted(apron_items, key=lambda s: s["tn"], reverse=True)
            best_split = len(sorted_spots) // 2
            max_gap = -1
            min_split = max(1, int(len(sorted_spots) * 0.25))
            max_split = min(len(sorted_spots) - 1, int(len(sorted_spots) * 0.75))
            for i in range(min_split, max_split):
                gap_val = sorted_spots[i-1]["tn"] - sorted_spots[i]["tn"]
                if gap_val > max_gap:
                    max_gap = gap_val
                    best_split = i
            top_spots = sorted_spots[:best_split]
            bot_spots = sorted_spots[best_split:]
            panels_config = [
                ("inset_north", "APRON STANDS - NORTH", top_spots, inset_x, inset_y, inset_w, panel_h),
                ("inset_south", "APRON STANDS - SOUTH", bot_spots, inset_x, inset_y + panel_h + gap, inset_w, panel_h),
            ]

        for p_id, p_title, p_spots, px, py, pw, ph in panels_config:
            if not p_spots:
                continue
            header_h = 26.0 if len(panels_config) >= 3 else 32.0
            font_size = 14 if len(panels_config) >= 3 else 16
            header_text_y = py + (18.0 if len(panels_config) >= 3 else 22.0)
            p_te = [s["te"] for s in p_spots]
            p_tn = [s["tn"] for s in p_spots]
            p_min_e, p_max_e = min(p_te) - 130.0, max(p_te) + 130.0
            p_min_n, p_max_n = min(p_tn) - 130.0, max(p_tn) + 130.0
            p_dx = max(10.0, p_max_e - p_min_e)
            p_dy = max(10.0, p_max_n - p_min_n)

            inner_pad = 14.0 if len(panels_config) >= 3 else 16.0
            inner_w = pw - inner_pad * 2.0
            inner_h = ph - header_h - inner_pad * 2.0
            i_scale = min(inner_w / p_dx, inner_h / p_dy)
            i_ox = px + inner_pad + (inner_w - p_dx * i_scale) / 2.0
            i_oy = py + header_h + inner_pad + (inner_h - p_dy * i_scale) / 2.0

            def IX(e, n):
                te, _ = rot_coord(e, n)
                return i_ox + (te - p_min_e) * i_scale

            def IY(e, n):
                _, tn = rot_coord(e, n)
                return i_oy + (p_max_n - tn) * i_scale

            clip_id = f"clip_{p_id}"
            svg_parts.append(f'''
            <defs>
                <clipPath id="{clip_id}">
                    <rect x="{px + 2:.1f}" y="{py + header_h:.1f}" width="{pw - 4:.1f}" height="{ph - header_h - 2:.1f}" rx="4"/>
                </clipPath>
            </defs>
            ''')
            svg_parts.append(f'<rect x="{px:.1f}" y="{py:.1f}" width="{pw:.1f}" height="{ph:.1f}" rx="6" fill="#F8FAFC" stroke="#1A237E" stroke-width="2.5" filter="drop-shadow(2px 2px 5px rgba(0,0,0,0.2))"/>')
            svg_parts.append(f'<rect x="{px:.1f}" y="{py:.1f}" width="{pw:.1f}" height="{header_h:.1f}" rx="4" fill="#1A237E"/>')
            svg_parts.append(f'<text x="{px + pw/2:.1f}" y="{header_text_y:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="{font_size}" fill="#FFFFFF" text-anchor="middle">{p_title}</text>')
            svg_parts.append(f'<g clip-path="url(#{clip_id})">')

            # Draw Real Paved Ramps inside Panel
            for ring in paved_rings:
                if len(ring) < 6:
                    continue
                rot_ring = [rot_coord(ring[i], ring[i+1]) for i in range(0, len(ring), 2)]
                ring_te = [pt[0] for pt in rot_ring]
                ring_tn = [pt[1] for pt in rot_ring]
                if max(ring_te) < p_min_e or min(ring_te) > p_max_e or max(ring_tn) < p_min_n or min(ring_tn) > p_max_n:
                    continue
                d = f"M {IX(ring[0], ring[1]):.1f} {IY(ring[0], ring[1]):.1f}"
                for i in range(2, len(ring), 2):
                    d += f" L {IX(ring[i], ring[i+1]):.1f} {IY(ring[i], ring[i+1]):.1f}"
                d += " Z"
                svg_parts.append(f'<path d="{d}" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.2"/>')

            # Draw Real Taxiway Centerlines inside Panel
            inset_drawn_segs = set()
            for route in routes_list:
                r_nodes = route.get("nodes", [])
                r_ed = route.get("ed", [])
                for i in range(0, len(r_ed), 2):
                    idx1, idx2 = r_ed[i], r_ed[i+1]
                    if idx1 < len(r_nodes) and idx2 < len(r_nodes):
                        na, nb = r_nodes[idx1], r_nodes[idx2]
                        nate, natn = rot_coord(na["e"], na["n"])
                        nbte, nbtn = rot_coord(nb["e"], nb["n"])
                        if ((p_min_e <= nate <= p_max_e and p_min_n <= natn <= p_max_n) or
                            (p_min_e <= nbte <= p_max_e and p_min_n <= nbtn <= p_max_n)):
                            p1 = (round(nate / 10) * 10, round(natn / 10) * 10)
                            p2 = (round(nbte / 10) * 10, round(nbtn / 10) * 10)
                            if p1 != p2:
                                seg_key = (min(p1, p2), max(p1, p2))
                                if seg_key not in inset_drawn_segs:
                                    inset_drawn_segs.add(seg_key)
                                    svg_parts.append(f'<line x1="{IX(na["e"], na["n"]):.1f}" y1="{IY(na["e"], na["n"]):.1f}" x2="{IX(nb["e"], nb["n"]):.1f}" y2="{IY(nb["e"], nb["n"]):.1f}" stroke="#F59E0B" stroke-width="3.5" stroke-linecap="round"/>')

            # Universal Proximity Grouping & Staggering on p_spots
            panel_valid = []
            for item in p_spots:
                panel_valid.append({
                    "spot": item["spot"],
                    "n": item["n"],
                    "is_alert": item["is_alert"],
                    "bx": IX(item["e"], item["n_coord"]),
                    "by": IY(item["e"], item["n_coord"]),
                })

            adj = {i: [] for i in range(len(panel_valid))}
            for i in range(len(panel_valid)):
                for j in range(i + 1, len(panel_valid)):
                    d = math.hypot(panel_valid[i]["bx"] - panel_valid[j]["bx"], 
                                   panel_valid[i]["by"] - panel_valid[j]["by"])
                    if d < 38.0:
                        adj[i].append(j)
                        adj[j].append(i)

            visited = set()
            components = []
            for i in range(len(panel_valid)):
                if i not in visited:
                    comp = []
                    queue = [i]
                    visited.add(i)
                    while queue:
                        curr = queue.pop(0)
                        comp.append(curr)
                        for neighbor in adj[curr]:
                            if neighbor not in visited:
                                visited.add(neighbor)
                                queue.append(neighbor)
                    components.append(comp)

            stagger_offsets = {}
            for comp in components:
                if len(comp) == 1:
                    stagger_offsets[comp[0]] = (0, 0)
                    continue
                xs = [panel_valid[idx]["bx"] for idx in comp]
                ys = [panel_valid[idx]["by"] for idx in comp]
                x_span = max(xs) - min(xs)
                y_span = max(ys) - min(ys)
                if x_span >= y_span:
                    comp.sort(key=lambda idx: panel_valid[idx]["bx"])
                    for order, idx in enumerate(comp):
                        offset_y = -16 if order % 2 == 0 else 16
                        stagger_offsets[idx] = (0, offset_y)
                else:
                    comp.sort(key=lambda idx: panel_valid[idx]["by"])
                    for order, idx in enumerate(comp):
                        offset_x = -16 if order % 2 == 0 else 16
                        stagger_offsets[idx] = (offset_x, 0)

            for idx, item in enumerate(panel_valid):
                n_val = item["n"]
                is_alert = item["is_alert"]
                base_x = item["bx"]
                base_y = item["by"]
                off_x, off_y = stagger_offsets.get(idx, (0, 0))
                sp_x = base_x + off_x
                sp_y = base_y + off_y

                if abs(off_x) > 0 or abs(off_y) > 0:
                    svg_parts.append(f'<line x1="{base_x:.1f}" y1="{base_y:.1f}" x2="{sp_x:.1f}" y2="{sp_y:.1f}" stroke="#94A3B8" stroke-width="1.8" stroke-dasharray="3,3"/>')

                svg_parts.append(f'<circle cx="{base_x:.1f}" cy="{base_y:.1f}" r="4" fill="#64748B"/>')

                if is_alert:
                    svg_parts.append(f'<circle cx="{sp_x:.1f}" cy="{sp_y:.1f}" r="16" fill="#D32F2F" stroke="#FFFFFF" stroke-width="2.5"/>')
                    svg_parts.append(f'<text x="{sp_x:.1f}" y="{sp_y+6:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="17" fill="#FFFFFF" text-anchor="middle">Q</text>')
                else:
                    svg_parts.append(f'<circle cx="{sp_x:.1f}" cy="{sp_y:.1f}" r="15" fill="#FFFFFF" stroke="#1A237E" stroke-width="2.5"/>')
                    svg_parts.append(f'<text x="{sp_x:.1f}" y="{sp_y+6:.1f}" font-family="Arial, sans-serif" font-weight="900" font-size="17" fill="#1A237E" text-anchor="middle">{n_val:02d}</text>')

            svg_parts.append('</g>')

    # 8. North Arrow & Wind Indicator (Top Left)
    arrow_x = 65
    arrow_y = 65
    needle_angle = chart_rot_deg
    svg_parts.append(f'''
    <g transform="translate({arrow_x}, {arrow_y})">
        <circle cx="0" cy="0" r="40" fill="#FFFFFF" stroke="#263238" stroke-width="3"/>
        <g transform="rotate({needle_angle})">
            <line x1="0" y1="24" x2="0" y2="-6" stroke="#263238" stroke-width="3.5"/>
            <polygon points="0,-18 -8,-6 8,-6" fill="#D32F2F"/>
            <text transform="rotate({-needle_angle} 0 -26)" x="0" y="-23" font-family="Arial, sans-serif" font-weight="900" font-size="18" fill="#D32F2F" text-anchor="middle">N</text>
        </g>
    </g>
    ''')

    if wind_kts > 0:
        wind_rot = (wind_deg + 180 + chart_rot_deg) % 360
        svg_parts.append(f'''
        <g transform="translate({arrow_x}, {arrow_y + 105})">
            <circle cx="0" cy="0" r="32" fill="#E8F5E9" stroke="#2E7D32" stroke-width="2.6"/>
            <g transform="rotate({wind_rot})">
                <line x1="0" y1="-24" x2="0" y2="24" stroke="#1B5E20" stroke-width="3.5"/>
                <polygon points="0,26 -8,10 8,10" fill="#1B5E20"/>
            </g>
            <text x="0" y="50" font-family="Arial, sans-serif" font-weight="900" font-size="16" fill="#1B5E20" text-anchor="middle">{wind_deg:03d}° / {wind_kts}KT</text>
        </g>
        ''')

    svg_content = "\n".join(svg_parts)

    # Runway Table Rows with Big Text & High Contrast
    rwy_rows = []
    for r in (airport.get("runways") or []):
        r_name = r.get("name", "")
        length = r.get("lengthFt", 0)
        width = r.get("widthFt", 0)
        for end in (r.get("ends") or []):
            desig = end.get("designator", "")
            hdg = end.get("headingTrue", 0.0)
            ils = end.get("ils") or "---"
            is_active = desig in active_desigs
            badge = f'<span class="active-badge">ACTIVE</span>' if is_active else ""
            pat = end.get("pattern", {})
            side = pat.get('overheadSide', 'Left') if pat else "Left"
            ptrn_dir = "R" if side.startswith("Right") else "L"

            # Pattern altitude
            final_alt = pat.get("final", {}).get("altFt") if pat else None
            if final_alt:
                ptrn_str = f"{ptrn_dir} ({final_alt:,}')"
            else:
                ptrn_str = f"{ptrn_dir} (1,500')"

            rwy_rows.append(f"""
            <tr class="{'rwy-active' if is_active else ''}">
                <td class="col-rwy"><b>{desig}</b> {badge}</td>
                <td><b>{length:,} × {width} ft</b></td>
                <td><b>{hdg:.0f}° M</b></td>
                <td class="col-ils"><b>{ils}</b></td>
                <td class="col-ptrn"><b>{ptrn_str}</b></td>
            </tr>
            """)

    rwy_table_html = "\n".join(rwy_rows)
    chart_type_title = "DEPARTURE GROUND TAXI" if is_departure else "RECOVERY GROUND TAXI & PARKING"

    # Extract short TACAN code
    if tacan:
        tacan_chan = tacan.get('channel')
        tacan_band = tacan.get('band') or 'X'
        tacan_station = tacan.get('station') or ''
        if "(" in tacan_station and ")" in tacan_station:
            tacan_code = tacan_station.split("(")[1].split(")")[0]
            tacan_str = f"{tacan_chan}{tacan_band} ({tacan_code})" if tacan_chan else "---"
        elif tacan_chan:
            tacan_str = f"{tacan_chan}{tacan_band}"
        else:
            tacan_str = "---"
    else:
        tacan_str = "---"

    icao_badge_html = f'<span class="icao-badge">{icao}</span>' if icao else ""

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        background-color: #FAFAF8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #1A1A1A;
        width: 1024px;
        height: 1554px;
        padding: 82px 16px 14px 16px;
        overflow: hidden;
    }}
    .header {{
        margin-bottom: 6px;
    }}
    .header-table {{
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
    }}
    .header-table td {{
        vertical-align: top;
        padding: 0;
    }}
    .icao-badge {{
        display: inline-block;
        background: #0D47A1;
        color: #FFFFFF;
        padding: 5px 15px;
        border-radius: 6px;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-right: 14px;
        vertical-align: middle;
    }}
    .airport-title {{
        display: inline-block;
        font-size: 34px;
        font-weight: 900;
        color: #0D47A1;
        letter-spacing: 0.5px;
        vertical-align: middle;
    }}
    .proc-badge {{
        display: inline-block;
        background: #C62828;
        color: #FFFFFF;
        padding: 6px 16px;
        border-radius: 6px;
        font-size: 18px;
        font-weight: 900;
        letter-spacing: 0.5px;
        text-align: right;
        margin-bottom: 4px;
    }}
    .elev-text {{
        color: #0D47A1;
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 0.5px;
        text-align: right;
    }}
    
    .pills-table {{
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
        margin-bottom: 6px;
        table-layout: fixed;
    }}
    .pills-table td {{
        padding: 0;
        vertical-align: middle;
    }}
    .banner-pill {{
        background: #E8F5E9;
        border: 2.5px solid #2E7D32;
        border-radius: 6px;
        padding: 7px 4px;
        text-align: center;
        font-size: 20px;
        font-weight: 800;
        color: #1B5E20;
        white-space: nowrap;
        box-sizing: border-box;
        width: 100%;
    }}
    .banner-pill b {{
        color: #000000;
        font-weight: 900;
    }}
    
    .comms-table {{
        width: 100%;
        border: 2.5px solid #90A4AE;
        border-radius: 6px;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        background: #FFFFFF;
        margin-bottom: 6px;
    }}
    .comm-cell {{
        padding: 8px 4px;
        border-right: 2.5px solid #90A4AE;
        text-align: center;
        vertical-align: middle;
    }}
    .comm-cell:last-child {{
        border-right: none;
    }}
    .comm-lbl {{
        font-size: 16px;
        font-weight: 900;
        color: #546E7A;
        letter-spacing: 0.5px;
        margin-bottom: 3px;
    }}
    .comm-val {{
        font-size: 22px;
        font-weight: 900;
        color: #0D47A1;
    }}
    
    .map-container {{
        background: #FAFAF8;
        border: 2.5px solid #37474F;
        border-radius: 6px;
        width: 992px;
        height: {map_h}px;
        position: relative;
        overflow: hidden;
    }}
    
    .footer-table {{
        margin-top: 6px;
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: #FFFFFF;
        border: 2.5px solid #263238;
        border-radius: 6px;
        overflow: hidden;
    }}
    .footer-table th {{
        background: #1A237E;
        color: #FFFFFF;
        font-weight: 900;
        font-size: 21px;
        padding: 7px 10px;
        text-align: left;
        letter-spacing: 0.5px;
        border-bottom: 2px solid #1A237E;
    }}
    .footer-table td {{
        padding: 7px 10px;
        border-top: 1.5px solid #CFD8DC;
        color: #263238;
        font-size: 22px;
    }}
    .col-rwy {{ font-size: 24px; font-weight: 900; }}
    .col-ils {{ font-size: 21px; color: #0D47A1; }}
    .col-ptrn {{ font-size: 21px; font-weight: 900; color: #1A237E; }}
    .rwy-active {{
        background: #E8F5E9;
    }}
    .rwy-active td {{ color: #1B5E20; }}
    .active-badge {{
        background: #2E7D32;
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 900;
        padding: 3px 10px;
        border-radius: 4px;
        margin-left: 8px;
    }}
</style>
</head>
<body>

<div class="header">
    <table class="header-table">
        <tr>
            <td style="text-align: left; vertical-align: top; display: flex; align-items: center; gap: 2rem;">
                {icao_badge_html}
                <span class="airport-title">{ap_name}</span>
            </td>
            <td style="text-align: right; vertical-align: middle;">
                <div class="proc-badge">{chart_type_title}</div>
                <div class="elev-text">ELEV {elev} FT MSL</div>
            </td>
        </tr>
    </table>
    <table class="pills-table">
        <tr>
            <td style="width: 33.333%; padding: 0 4px 0 0;">
                <div class="banner-pill">WIND: <b>{wind_deg:03d}° / {wind_kts} KTS</b></div>
            </td>
            <td style="width: 33.333%; padding: 0 4px 0 4px;">
                <div class="banner-pill">ACT RWYS: <b>{active_str}</b></div>
            </td>
            <td style="width: 33.333%; padding: 0 0 0 4px;">
                <div class="banner-pill">TAC: <b>{tacan_str}</b></div>
            </td>
        </tr>
    </table>
    <table class="comms-table">
        <tr>
            <td class="comm-cell" style="width: 18%;"><div class="comm-lbl">ATIS</div><div class="comm-val">{freqs.get('atisVhf') or '---'}</div></td>
            <td class="comm-cell" style="width: 32%;"><div class="comm-lbl">TWR</div><div class="comm-val">{freqs.get('towerUhf') or '---'} / {freqs.get('towerVhf') or '---'}</div></td>
            <td class="comm-cell" style="width: 16%;"><div class="comm-lbl">GND</div><div class="comm-val">{freqs.get('groundUhf') or '---'}</div></td>
            <td class="comm-cell" style="width: 17%;"><div class="comm-lbl">APP</div><div class="comm-val">{freqs.get('approachUhf') or '---'}</div></td>
            <td class="comm-cell" style="width: 17%;"><div class="comm-lbl">OPS</div><div class="comm-val">{freqs.get('opsUhf') or '---'}</div></td>
        </tr>
    </table>
</div>

<div class="map-container">
    <svg width="{svg_w}" height="{svg_h}" xmlns="http://www.w3.org/2000/svg">
        {svg_content}
    </svg>
</div>

<table class="footer-table">
    <thead>
        <tr>
            <th>RWY</th>
            <th>DIM</th>
            <th>HDG</th>
            <th>ILS FREQ</th>
            <th>PTRN</th>
        </tr>
    </thead>
    <tbody>
        {rwy_table_html}
    </tbody>
</table>

</body>
</html>
"""
    return html


def render_html_to_png(html_path, output_png):
    cmd = [
        str(WKHTMLTOIMAGE),
        "--width", "1024",
        "--height", "1554",
        "--disable-smart-width",
        "--enable-local-file-access",
        str(html_path),
        str(output_png)
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def generate_blank_chart_html(airport_name, reason="CHARTS NOT AVAILABLE"):
    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        background-color: #FAFAF8;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #1A1A1A;
        width: 1024px;
        height: 1554px;
        padding: 82px 42px 42px 42px;
        overflow: hidden;
    }}
    .outer-card {{
        width: 940px;
        height: 1430px;
        margin: 0 auto;
        border: 4px dashed #90A4AE;
        border-radius: 16px;
        background: #FFFFFF;
        text-align: center;
        padding-top: 500px;
    }}
    .badge {{
        background: #C62828;
        color: #FFFFFF;
        font-size: 26px;
        font-weight: 900;
        padding: 10px 24px;
        border-radius: 8px;
        margin: 0 auto 30px auto;
        display: inline-block;
        text-align: center;
    }}
    .main-title {{
        font-size: 50px;
        font-weight: 900;
        color: #263238;
        margin-bottom: 25px;
        text-align: center;
    }}
    .rule {{
        width: 320px;
        height: 4px;
        background: #B0BEC5;
        margin: 0 auto 30px auto;
        border-radius: 2px;
    }}
    .ap-title {{
        font-size: 38px;
        font-weight: 900;
        color: #0D47A1;
        margin-bottom: 16px;
        text-align: center;
    }}
    .reason-desc {{
        font-size: 24px;
        font-weight: 800;
        color: #C62828;
        text-transform: uppercase;
        text-align: center;
    }}
</style>
</head>
<body>
    <div class="outer-card">
        <div class="badge">AERONAUTICAL KNEEBOARD</div>
        <div class="main-title">[INTENTIONALLY LEFT BLANK]</div>
        <div class="rule"></div>
        <div class="ap-title">{airport_name.upper()}</div>
        <div class="reason-desc">{reason}</div>
    </div>
</body>
</html>
"""


SPECIAL_ILS_PAGES = {
    "RKTN": {
        "13R": 0,
        "31L": 8,
        "31R": 16,
    },
    "RKPK": {
        "36R": 0,
        "36L": 2,
    },
    "RKJK": {
        "18": 0,
        "36": 2,
    }
}


def find_and_render_ils_chart(airport, active_end, base_dir, output_png):
    icao = airport.get("icao") or ""
    ap_name = airport.get("name") or ""
    desig = active_end.get("designator", "")
    rwy_num = re.sub(r"[^0-9]", "", desig).lstrip("0")
    rwy_side = re.sub(r"[0-9]", "", desig).upper()
    desig_norm = f"{int(rwy_num):02d}{rwy_side}" if rwy_num else desig

    # 1. Check User Override in charts/<ICAO>/
    user_candidates = []
    if icao:
        user_candidates = [
            CHARTS_DIR / icao / f"ILS_{desig}.png",
            CHARTS_DIR / icao / f"ILS_{desig_norm}.png",
            CHARTS_DIR / f"{icao}_ILS_{desig}.png",
            CHARTS_DIR / f"{icao}_ILS_{desig_norm}.png",
        ]
    for uc in user_candidates:
        if uc.exists():
            format_image_to_kneeboard(uc, output_png)
            return True

    # 2. Check BMS Docs PDF
    docs_dir = base_dir / "Docs" / "03 KTO Charts"
    if docs_dir.exists() and fitz:
        for root, dirs, files in os.walk(docs_dir):
            root_name_upper = os.path.basename(root).upper()
            match_root = (icao and icao.upper() in root_name_upper) or (ap_name and ap_name.lower() in root_name_upper.lower())
            if match_root:
                for f in files:
                    f_lower = f.lower()
                    if f_lower.endswith(".pdf") and "ils" in f_lower:
                        if desig.lower() in f_lower or desig_norm.lower() in f_lower:
                            pdf_path = os.path.join(root, f)
                            if render_pdf_page(pdf_path, 0, output_png):
                                return True

                for f in files:
                    if f.lower().endswith(" - ils.pdf") or f.lower().endswith("- ils.pdf"):
                        pdf_path = os.path.join(root, f)
                        # Check special known ILS page mapping first
                        if icao and icao.upper() in SPECIAL_ILS_PAGES:
                            r_key = desig.upper()
                            r_norm = desig_norm.upper()
                            target_page = SPECIAL_ILS_PAGES[icao.upper()].get(r_key)
                            if target_page is None:
                                target_page = SPECIAL_ILS_PAGES[icao.upper()].get(r_norm)
                            if target_page is not None:
                                if render_pdf_page(pdf_path, target_page, output_png):
                                    return True

                        try:
                            doc = fitz.open(pdf_path)
                            target_page = -1
                            for pno in range(len(doc)):
                                ptext = doc[pno].get_text() or ""
                                ptext_upper = ptext.upper()
                                # Strictly ignore RNP/RNAV procedure pages
                                if ("RNP" in ptext_upper or "RNAV" in ptext_upper) and "ILS" not in ptext_upper and "LOC" not in ptext_upper:
                                    continue
                                if f"RWY {desig}" in ptext or f"RWY {desig_norm}" in ptext:
                                    if pno % 2 == 1:
                                        target_page = pno - 1
                                    else:
                                        target_page = pno
                                    break
                            if target_page >= 0:
                                if render_pdf_page(pdf_path, target_page, output_png):
                                    return True
                            elif len(doc) > 0:
                                if render_pdf_page(pdf_path, 0, output_png):
                                    return True
                        except Exception as e:
                            print(f"Error inspecting {pdf_path}: {e}")

    # 3. Check Bundled WebP Charts in charts/bundled/
    charts_index_file = DATA_DIR / "charts.json"
    if charts_index_file.exists():
        with open(charts_index_file, "r", encoding="utf-8") as f:
            cdata = json.load(f)
            for set_id, aps in cdata.items():
                ap_charts = aps.get(str(airport.get("id")))
                if ap_charts:
                    ils_entry = next((c for c in ap_charts if "ils" in c.get("title", "").lower()), None)
                    if ils_entry:
                        pages = ils_entry.get("pages", [])
                        if pages:
                            first_page = pages[0].replace("charts/", "")
                            bundled_file = BUNDLED_CHARTS_DIR / first_page
                            if bundled_file.exists():
                                format_image_to_kneeboard(bundled_file, output_png)
                                return True

    return False


def render_pdf_page(pdf_path, page_num, output_png):
    try:
        doc = fitz.open(pdf_path)
        if page_num >= len(doc):
            page_num = 0
        page = doc[page_num]
        pix = page.get_pixmap(dpi=150)
        temp_png = WORK_DIR / "temp_pdf_render.png"
        pix.save(str(temp_png))
        format_image_to_kneeboard(temp_png, output_png)
        if temp_png.exists():
            temp_png.unlink()
        return True
    except Exception as e:
        print(f"Failed to render {pdf_path} page {page_num}: {e}")
        return False


def format_image_to_kneeboard(src_image, output_png):
    cmd = [
        str(MAGICK),
        str(src_image),
        "-auto-orient",
        "-resize", "1024x1554",
        "-gravity", "center",
        "-background", "#FAFAF8",
        "-extent", "1024x1554",
        str(output_png)
    ]
    subprocess.run(cmd, check=True)


def check_and_render_custom_pages(theater_id):
    cache_file = WORK_DIR / "custom_pages_cache.json"
    cache = {}
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                cache = json.load(f)
        except Exception:
            cache = {}

    to_merge = []
    updated_cache = dict(cache)

    for slot, html_path, desc in CUSTOM_PAGES:
        if not html_path.exists():
            continue
        cur_hash = f"{theater_id}:{file_md5(html_path)}"
        cached_hash = cache.get(slot)
        out_png = IMAGES_DIR / f"{slot.lower()}.png"

        if cur_hash != cached_hash or not out_png.exists():
            print(f"Rendering updated custom page {slot}: {desc}...")
            render_html_to_png(html_path, out_png)
            to_merge.append((slot, out_png, desc))
            updated_cache[slot] = cur_hash

    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(updated_cache, f, indent=2)

    return to_merge


def play_completion_sound():
    """Play init.mp3 audio cue upon completion of chart generation and merging."""
    sound_path = EZ_ROOT / "init.mp3"
    if not sound_path.exists():
        return
    try:
        import ctypes
        mci = ctypes.windll.winmm.mciSendStringW
        p_str = str(sound_path.resolve())
        mci("close bms_init_sound", None, 0, 0)
        ret = mci(f'open "{p_str}" type mpegvideo alias bms_init_sound', None, 0, 0)
        if ret == 0:
            mci("play bms_init_sound wait", None, 0, 0)
            mci("close bms_init_sound", None, 0, 0)
    except Exception:
        pass


def get_sam_range(system_name):
    low = system_name.lower()
    for k, r in SAM_RANGES.items():
        if k in low:
            return r
    return 8.0


def parse_callsign_stpts(ini_path):
    if not os.path.exists(ini_path):
        return {}

    stpt_dict = {}
    with open(ini_path, "r", encoding="utf-8", errors="ignore") as f:
        in_stpt = False
        for line in f:
            line = line.strip()
            if line.startswith("[STPT]"):
                in_stpt = True
                continue
            elif line.startswith("[") and in_stpt:
                break
            if in_stpt and line.startswith("target_"):
                parts = line.split("=", 1)
                if len(parts) == 2:
                    k = parts[0].strip()
                    idx = int(k.split("_")[1]) + 1
                    vals = [v.strip() for v in parts[1].split(",")]
                    if len(vals) >= 4:
                        x = float(vals[0])
                        y = float(vals[1])
                        z = float(vals[2])
                        act = int(vals[3])
                        desc = vals[4] if len(vals) > 4 else ""
                        stpt_dict[idx] = {
                            "x": x,
                            "y": y,
                            "z": -z,
                            "action_code": act,
                            "desc": desc,
                        }
    return stpt_dict


def resolve_threat_coords(threats, geo_path):
    if not os.path.exists(geo_path):
        return []

    with open(geo_path, "r", encoding="utf-8", errors="ignore") as f:
        geo = json.load(f)

    places = geo.get("places", [])
    place_map = {}
    for p in places:
        name_clean = p["n"].lower().replace("village", "").replace("town", "").replace("city", "").strip()
        place_map[name_clean] = p
        place_map[p["n"].lower().strip()] = p

    resolved = []
    for t in threats:
        p_name = t["place"].lower().replace("village", "").replace("town", "").replace("city", "").strip()
        target_p = place_map.get(p_name) or place_map.get(t["place"].lower().strip())
        if not target_p:
            for k, p in place_map.items():
                if p_name in k or k in p_name:
                    target_p = p
                    break

        if target_p:
            dx_mult, dy_mult = COMPASS_DIRS.get(t["dir"], (0.0, 0.0))
            dist_ft = t["dist_nm"] * NM_TO_FT
            tx = target_p["x"] + (dx_mult * dist_ft)
            ty = target_p["y"] + (dy_mult * dist_ft)
            rng_nm = get_sam_range(t["system"])
            resolved.append({
                "system": t["system"],
                "x": tx,
                "y": ty,
                "range_nm": rng_nm,
                "place": target_p["n"],
            })
    return resolved


def get_map_dimensions(map_path):
    if fitz:
        try:
            doc = fitz.open(str(map_path))
            w = int(doc[0].rect.width)
            h = int(doc[0].rect.height)
            doc.close()
            return w, h
        except Exception:
            pass
    return 4096, 4096


def find_theater_base_map(theater_id, base_dir, map_id):
    """
    Locates the best available high-res theater base map.
    Prioritizes official game 16K/8K/4K maps:
    1. Korea: SkyVector 16k -> Blank 16k -> Blank 8k -> Blank 4k
    2. Add-On Theaters (Balkans, Hellas, etc.): 16k -> 8k -> 4k UI maps in Add-On Docs
    3. Fallback: bundled EZBoards data/maps/<map_id>
    """
    th_lower = (theater_id or "").lower()

    # 1. KTO / Korea Maps in base_dir / "Docs" / "05 Maps"
    if "korea" in th_lower or "kto" in th_lower:
        kto_maps_dir = base_dir / "Docs" / "05 Maps"
        if kto_maps_dir.exists():
            candidates = [
                kto_maps_dir / "8_KTO_16k_Skyvector.png",
                kto_maps_dir / "7_KTO_16k_Blank.png",
                kto_maps_dir / "6_KTO_8k_Blank.png",
                kto_maps_dir / "0_KTO_4k_Blank.png",
            ]
            for c in candidates:
                if c.exists():
                    return c

    # 2. Add-On Theater Folders (Balkans, Hellas, etc.)
    data_dir = base_dir / "Data"
    if data_dir.exists():
        addon_dirs = list(data_dir.glob("Add-On*"))
        for ad in addon_dirs:
            ad_name_lower = ad.name.lower()
            is_match = False
            if "balkan" in th_lower and "balkan" in ad_name_lower:
                is_match = True
            elif "hellas" in th_lower and "hellas" in ad_name_lower:
                is_match = True
            elif th_lower in ad_name_lower or (map_id and map_id.lower() in ad_name_lower):
                is_match = True

            if is_match:
                maps_subdirs = [
                    ad / "Docs" / "02 Maps",
                    ad / "Docs" / "Maps",
                    ad / "Docs" / "05 Maps",
                    ad / "Docs",
                ]
                for mdir in maps_subdirs:
                    if mdir.exists():
                        patterns = [
                            "*16k*.png", "*16K*.png",
                            "*8k*.png", "*8K*.png",
                            "*4k*.png", "*4K*.png",
                            "*map*.png", "*Map*.png"
                        ]
                        for pat in patterns:
                            matches = sorted(list(mdir.glob(pat)), key=lambda p: -p.stat().st_size)
                            if matches:
                                return matches[0]

    # 3. Fallback to bundled EZBoards data/maps/<map_id>/
    maps_th_dir = DATA_DIR / "maps" / map_id
    if maps_th_dir.exists():
        fallback_candidates = [
            maps_th_dir / "chart_z3.jpg",
            maps_th_dir / "chart.jpg",
            maps_th_dir / "topo_z3.jpg",
            maps_th_dir / "topo.jpg",
        ]
        for c in fallback_candidates:
            if c.exists():
                return c

    return None


def crop_theater_map(base_map_path, size_ft, crop_box, out_path, map_dim=None):
    if map_dim is None:
        map_w, map_h = get_map_dimensions(base_map_path)
    else:
        map_w = map_h = map_dim

    min_x, max_x, min_y, max_y = crop_box
    px_left = max(0, int((min_y / size_ft) * map_w))
    px_top = max(0, int((1.0 - (max_x / size_ft)) * map_h))
    px_w = min(map_w - px_left, int(((max_y - min_y) / size_ft) * map_w))
    px_h = min(map_h - px_top, int(((max_x - min_x) / size_ft) * map_h))

    if px_w < 10: px_w = 100
    if px_h < 10: px_h = 100

    cmd = [
        str(MAGICK),
        str(base_map_path),
        "-crop", f"{px_w}x{px_h}+{px_left}+{px_top}",
        "+repage",
        "-quality", "92",
        str(out_path)
    ]
    subprocess.run(cmd, check=True)


def compute_mission_route_coords(stpts, dep_coords, arr_coords, callsign_coords=None):
    n = len(stpts)
    if n == 0:
        return []

    # If callsign_coords exist, have valid non-zero coords for ALL steerpoints,
    # and match departure airbase, use callsign_coords
    if callsign_coords and dep_coords:
        stpt1_cs = callsign_coords.get(1)
        all_nonzero = all(
            sp["num"] in callsign_coords and
            (callsign_coords[sp["num"]]["x"] != 0 or callsign_coords[sp["num"]]["y"] != 0)
            for sp in stpts
        )
        if stpt1_cs and all_nonzero and math.hypot(stpt1_cs["x"] - dep_coords[0], stpt1_cs["y"] - dep_coords[1]) < 10.0 * NM_TO_FT:
            merged = []
            for sp in stpts:
                num = sp["num"]
                c = callsign_coords[num]
                merged.append({
                    **sp,
                    "x": c["x"],
                    "y": c["y"],
                    "z": c.get("z", 0.0),
                    "action_code": c.get("action_code", 0),
                })
            return merged

    # Ground-truth dead reckoning from briefing.txt anchored on dep_coords & arr_coords
    coords = [{"x": 0.0, "y": 0.0, "z": 0.0, "valid": False} for _ in range(n)]

    # STPT 1 at departure airbase
    if dep_coords:
        coords[0] = {"x": dep_coords[0], "y": dep_coords[1], "z": 0.0, "valid": True}

    # Find Land steerpoint to anchor to arrival airbase
    land_idx = -1
    for idx, sp in enumerate(stpts):
        act_text = (sp.get("action", "") + " " + sp.get("desc", "")).lower()
        if "land" in act_text:
            land_idx = idx
            break

    if land_idx == -1 and n > 1:
        land_idx = n - 1

    # Forward pass from STPT 1
    fwd_reached_land = False
    for i in range(1, n):
        sp = stpts[i]
        try:
            d = float(sp.get("dist", ""))
            h = float(sp.get("head", ""))
            if coords[i - 1]["valid"]:
                rad = math.radians(h)
                coords[i] = {
                    "x": coords[i - 1]["x"] + math.cos(rad) * d * NM_TO_FT,
                    "y": coords[i - 1]["y"] + math.sin(rad) * d * NM_TO_FT,
                    "z": 0.0,
                    "valid": True,
                }
                if i == land_idx:
                    fwd_reached_land = True
        except (ValueError, TypeError):
            pass

    # If forward pass reached land_idx and arr_coords is given, reconcile closure error so STPT land is 100% flush
    if fwd_reached_land and arr_coords and land_idx > 0:
        err_x = arr_coords[0] - coords[land_idx]["x"]
        err_y = arr_coords[1] - coords[land_idx]["y"]
        for i in range(1, land_idx + 1):
            factor = i / land_idx
            coords[i]["x"] += err_x * factor
            coords[i]["y"] += err_y * factor
    else:
        # Backward pass from Landing steerpoint
        if arr_coords and land_idx >= 0 and not coords[land_idx]["valid"]:
            coords[land_idx] = {"x": arr_coords[0], "y": arr_coords[1], "z": 0.0, "valid": True}

        if land_idx >= 0:
            for i in range(land_idx, 0, -1):
                sp = stpts[i]
                if coords[i]["valid"] and not coords[i - 1]["valid"]:
                    try:
                        d = float(sp.get("dist", ""))
                        h = float(sp.get("head", ""))
                        rad = math.radians(h)
                        coords[i - 1] = {
                            "x": coords[i]["x"] - math.cos(rad) * d * NM_TO_FT,
                            "y": coords[i]["y"] - math.sin(rad) * d * NM_TO_FT,
                            "z": 0.0,
                            "valid": True,
                        }
                    except (ValueError, TypeError):
                        pass

    # Build merged output
    merged = []
    for i, sp in enumerate(stpts):
        c = coords[i]
        desc_l = sp.get("desc", "").lower()
        act_l = sp.get("action", "").lower()
        is_tgt = "tgt" in desc_l or "target" in desc_l or "strike" in desc_l or "attack" in desc_l
        is_ip = "ip" in desc_l or "initial point" in desc_l
        is_refuel = "refuel" in desc_l or "tanker" in desc_l
        act_code = 20 if is_tgt else (13 if is_ip else (2 if is_refuel else 0))
        merged.append({
            **sp,
            "x": c["x"],
            "y": c["y"],
            "z": c.get("z", 0.0),
            "action_code": act_code,
        })
    return merged


def solve_waypoint_tag_placements(waypoints, map_w, map_h, reserved_boxes):
    """
    Computes collision-free tag positions for waypoints.
    Avoids overlapping map edges, UI elements, other waypoints, and previously placed tags.
    Returns dict: {num: [left, top, right, bottom]}
    """
    def overlap_area(r1, r2):
        dx = max(0.0, min(r1[2], r2[2]) - max(r1[0], r2[0]))
        dy = max(0.0, min(r1[3], r2[3]) - max(r1[1], r2[1]))
        return dx * dy

    def clamp_to_bounds(r, w, h, margin=16.0):
        tw = r[2] - r[0]
        th = r[3] - r[1]
        nx = max(margin, min(r[0], w - margin - tw))
        ny = max(margin, min(r[1], h - margin - th))
        return [nx, ny, nx + tw, ny + th]

    # Prioritize: Target first, then IP, then by waypoint number
    sorted_wps = sorted(waypoints, key=lambda w: (
        0 if w.get("is_tgt") else (1 if w.get("is_ip") else 2),
        w["num"]
    ))

    all_markers = [[w["sx"] - 22.0, w["sy"] - 22.0, w["sx"] + 22.0, w["sy"] + 22.0, w["num"]] for w in waypoints]
    placed_tags = []
    results = {}

    for w in sorted_wps:
        sx, sy = w["sx"], w["sy"]
        tw, th = w["tag_w"], w["tag_h"]
        R = 26.0 if w.get("is_tgt") else 22.0
        gap = 8.0

        candidates = [
            (sx + R + gap, sy - th / 2.0, 0.0),                     # 0: Right / East
            (sx + R + gap, sy - th - 4.0, 2.0),                    # 1: Top-Right / North-East
            (sx + R + gap, sy + 4.0, 3.0),                         # 2: Bottom-Right / South-East
            (sx - tw / 2.0, sy - R - gap - th, 5.0),               # 3: Top / North
            (sx - tw / 2.0, sy + R + gap, 6.0),                    # 4: Bottom / South
            (sx - tw - R - gap, sy - th / 2.0, 8.0),               # 5: Left / West
            (sx - tw - R - gap, sy - th - 4.0, 9.0),               # 6: Top-Left / North-West
            (sx - tw - R - gap, sy + 4.0, 10.0),                   # 7: Bottom-Left / South-West
            # Extended offsets if nearby is congested
            (sx + R + gap + 28.0, sy - th / 2.0, 15.0),
            (sx - tw - R - gap - 28.0, sy - th / 2.0, 18.0),
            (sx - tw / 2.0, sy - R - gap - th - 28.0, 20.0),
            (sx - tw / 2.0, sy + R + gap + 28.0, 20.0),
            (sx + R + gap + 24.0, sy - th - 20.0, 22.0),
            (sx - tw - R - gap - 24.0, sy - th - 20.0, 24.0),
            (sx + R + gap + 24.0, sy + 20.0, 22.0),
            (sx - tw - R - gap - 24.0, sy + 20.0, 24.0),
        ]

        best_box = None
        best_cost = float("inf")

        for cand_x, cand_y, pref_cost in candidates:
            raw_r = [cand_x, cand_y, cand_x + tw, cand_y + th]
            r = clamp_to_bounds(raw_r, map_w, map_h, margin=16.0)

            # Penalty for distance shifted by clamping
            clamp_shift = abs(r[0] - raw_r[0]) + abs(r[1] - raw_r[1])
            cost = pref_cost + clamp_shift * 40.0

            # Reserved UI zones
            for zone in reserved_boxes:
                oa = overlap_area(r, zone)
                if oa > 0:
                    cost += 100000.0 + oa * 300.0

            # Already placed tags
            for _, placed_r in placed_tags:
                oa = overlap_area(r, placed_r)
                if oa > 0:
                    cost += 80000.0 + oa * 400.0

            # Waypoint markers (huge penalty if overlapping a marker)
            for mb in all_markers:
                oa = overlap_area(r, mb[:4])
                if oa > 0:
                    if mb[4] == w["num"]:
                        cost += 50000.0 + oa * 250.0
                    else:
                        cost += 35000.0 + oa * 150.0

            if cost < best_cost:
                best_cost = cost
                best_box = r

        results[w["num"]] = best_box
        placed_tags.append((w["num"], best_box))

    return results


def generate_mission_overview_page(b_data, merged_stpts, resolved_threats, theater_size_ft, base_map_path, out_png):
    if not merged_stpts:
        return False

    valid_pts = [p for p in merged_stpts if p["x"] != 0 or p["y"] != 0]
    if not valid_pts:
        return False

    xs = [p["x"] for p in valid_pts]
    ys = [p["y"] for p in valid_pts]
    for t in resolved_threats:
        xs.append(t["x"])
        ys.append(t["y"])

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    span_x = max_x - min_x
    span_y = max_y - min_y
    max_span = max(span_x, span_y, 25 * NM_TO_FT)
    margin = max_span * 0.16

    mid_x = (min_x + max_x) / 2.0
    mid_y = (min_y + max_y) / 2.0
    half_h = (max_span / 2.0) + margin
    half_w = half_h * (992.0 / 1300.0)

    crop_min_x = max(0, mid_x - half_h)
    crop_max_x = min(theater_size_ft, mid_x + half_h)
    crop_min_y = max(0, mid_y - half_w)
    crop_max_y = min(theater_size_ft, mid_y + half_w)

    crop_jpg = WORK_DIR / "crop_route_overview.jpg"
    crop_theater_map(base_map_path, theater_size_ft, (crop_min_x, crop_max_x, crop_min_y, crop_max_y), crop_jpg)

    w_svg = 992
    h_svg = 1300

    def to_svg(x, y):
        sx = ((y - crop_min_y) / (crop_max_y - crop_min_y)) * w_svg
        sy = ((crop_max_x - x) / (crop_max_x - crop_min_x)) * h_svg
        return sx, sy

    svg_pts = []
    for p in valid_pts:
        sx, sy = to_svg(p["x"], p["y"])
        svg_pts.append((p["num"], sx, sy, p["desc"], p["time"], p["alt"], p["cas"], p["action_code"], p["comm"]))

    polyline_d = " ".join(f"{sx:.1f},{sy:.1f}" for _, sx, sy, _, _, _, _, _, _ in svg_pts)

    crop_nm_width = (crop_max_y - crop_min_y) / NM_TO_FT
    scale_nm = 20 if crop_nm_width > 60 else (10 if crop_nm_width > 30 else 5)
    scale_px = (scale_nm / crop_nm_width) * w_svg

    # Reserved UI zones on Route Overview
    reserved_overview = [
        [w_svg - 110.0, 15.0, w_svg - 10.0, 120.0],                          # North arrow (top-right)
        [20.0, h_svg - 85.0, 35.0 + scale_px + 45.0, h_svg - 10.0],          # Scale bar (bottom-left)
    ]

    wp_placement_inputs = []
    for num, sx, sy, desc, time, alt, cas, act_code, comm in svg_pts:
        is_tgt = act_code == 20 or "TGT" in desc.upper() or "TARGET" in desc.upper()
        is_ip = act_code == 13 or "IP" in desc.upper()
        tw = 210 if is_tgt else 190
        th = 56 if is_tgt else 50
        wp_placement_inputs.append({
            "num": num,
            "sx": sx,
            "sy": sy,
            "tag_w": tw,
            "tag_h": th,
            "is_tgt": is_tgt,
            "is_ip": is_ip,
        })

    tag_boxes = solve_waypoint_tag_placements(wp_placement_inputs, w_svg, h_svg, reserved_overview)

    svg_elements = []

    # Threat rings
    for t in resolved_threats:
        tx, ty = to_svg(t["x"], t["y"])
        rng_ft = t["range_nm"] * NM_TO_FT
        r_px = (rng_ft / (crop_max_x - crop_min_x)) * h_svg
        name = t["system"].upper()
        svg_elements.append(f"""
        <!-- Threat {name} -->
        <circle cx='{tx:.1f}' cy='{ty:.1f}' r='{r_px:.1f}' fill='rgba(220, 38, 38, 0.14)' stroke='#DC2626' stroke-width='3.5' stroke-dasharray='10,6' />
        <circle cx='{tx:.1f}' cy='{ty:.1f}' r='8' fill='#DC2626' stroke='#FFFFFF' stroke-width='2.5' />
        <rect x='{tx - 80:.1f}' y='{ty - r_px - 28:.1f}' width='160' height='28' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='2' />
        <text x='{tx:.1f}' y='{ty - r_px - 9:.1f}' font-size='16' font-weight='900' fill='#DC2626' text-anchor='middle'>{name} ({t['range_nm']:.0f}NM)</text>
        """)

    # Polyline route: Thick Royal Blue with White dashed core
    svg_elements.append(f"""
    <polyline points='{polyline_d}' fill='none' stroke='#0284C7' stroke-width='9' stroke-linejoin='round' opacity='0.95' />
    <polyline points='{polyline_d}' fill='none' stroke='#FFFFFF' stroke-width='4' stroke-dasharray='12,7' opacity='0.9' />
    """)

    # Waypoints
    for num, sx, sy, desc, time, alt, cas, act_code, comm in svg_pts:
        is_tgt = act_code == 20 or "TGT" in desc.upper() or "TARGET" in desc.upper()
        is_ip = act_code == 13 or "IP" in desc.upper()
        is_refuel = act_code == 2 or "REFUEL" in desc.upper()

        if is_tgt:
            d_sz = 26
            svg_elements.append(f"""
            <polygon points='{sx:.1f},{sy - d_sz:.1f} {sx + d_sz:.1f},{sy:.1f} {sx:.1f},{sy + d_sz:.1f} {sx - d_sz:.1f},{sy:.1f}' fill='#DC2626' stroke='#FFFFFF' stroke-width='4' />
            <circle cx='{sx:.1f}' cy='{sy:.1f}' r='6' fill='#FFFFFF' />
            """)
        elif is_ip:
            sz = 17
            svg_elements.append(f"""
            <rect x='{sx - sz:.1f}' y='{sy - sz:.1f}' width='{sz*2}' height='{sz*2}' fill='#D97706' stroke='#FFFFFF' stroke-width='4' />
            <circle cx='{sx:.1f}' cy='{sy:.1f}' r='5' fill='#FFFFFF' />
            """)
        else:
            circle_stroke = "#7E22CE" if is_refuel else "#0369A1"
            circle_fill = "#FAF5FF" if is_refuel else "#FFFFFF"
            svg_elements.append(f"""
            <circle cx='{sx:.1f}' cy='{sy:.1f}' r='18' fill='{circle_fill}' stroke='{circle_stroke}' stroke-width='4' />
            <text x='{sx:.1f}' y='{sy + 7:.1f}' font-size='20' font-family='monospace' font-weight='900' fill='{circle_stroke}' text-anchor='middle'>{num}</text>
            """)

        lbl_col = "#DC2626" if is_tgt else ("#D97706" if is_ip else "#0369A1")
        border_col = lbl_col
        title_text = f"TGT {num}: {desc[:10]}" if is_tgt else (f"IP {num}: {desc[:10]}" if is_ip else f"STPT {num}: {desc[:10]}")
        sub_text = f"{time} | {alt}" if time != "--" or alt != "--" else "ENROUTE"

        box = tag_boxes.get(num, [sx + 26, sy - 25, sx + 216, sy + 25])
        bx, by, br, bb = box
        bw = br - bx
        bh = bb - by

        # Leader line if displaced from marker
        tcx = (bx + br) / 2.0
        tcy = (by + bb) / 2.0
        dist_to_center = math.hypot(tcx - sx, tcy - sy)
        R_marker = 26.0 if is_tgt else (20.0 if is_ip else 18.0)
        if dist_to_center > (R_marker + 16.0):
            p1x = sx + ((tcx - sx) / dist_to_center) * R_marker
            p1y = sy + ((tcy - sy) / dist_to_center) * R_marker
            p2x = max(bx, min(tcx, br))
            p2y = max(by, min(tcy, bb))
            svg_elements.append(f"""
            <line x1='{p1x:.1f}' y1='{p1y:.1f}' x2='{p2x:.1f}' y2='{p2y:.1f}' stroke='{border_col}' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />
            """)

        svg_elements.append(f"""
        <g transform='translate({bx:.1f}, {by:.1f})'>
          <rect x='0' y='0' width='{bw:.1f}' height='{bh:.1f}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='{border_col}' stroke-width='2.5' />
          <text x='8' y='20' font-size='19' font-weight='900' fill='{lbl_col}'>{title_text}</text>
          <text x='8' y='40' font-size='16' font-family='monospace' font-weight='800' fill='#334155'>{sub_text}</text>
        </g>
        """)

    # North arrow and Scale bar
    svg_elements.append(f"""
    <!-- Scale Bar -->
    <g transform='translate(35, {h_svg - 45})'>
      <rect x='-12' y='-28' width='{scale_px + 36}' height='52' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2' />
      <line x1='0' y1='0' x2='{scale_px:.1f}' y2='0' stroke='#0F172A' stroke-width='5' />
      <line x1='0' y1='-8' x2='0' y2='8' stroke='#0F172A' stroke-width='3.5' />
      <line x1='{scale_px:.1f}' y1='-8' x2='{scale_px:.1f}' y2='8' stroke='#0F172A' stroke-width='3.5' />
      <text x='{scale_px/2:.1f}' y='-8' font-size='20' font-weight='900' fill='#0F172A' text-anchor='middle'>{scale_nm} NM</text>
    </g>
    <!-- North Arrow (Large VR Identifiable) -->
    <g transform='translate({w_svg - 60}, 60)'>
      <circle cx='0' cy='0' r='36' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2.5' />
      <polygon points='0,-28 9,-5 0,0' fill='#DC2626' />
      <polygon points='0,-28 -9,-5 0,0' fill='#1E293B' />
      <polygon points='0,28 9,5 0,0' fill='#94A3B8' />
      <polygon points='0,28 -9,5 0,0' fill='#CBD5E1' />
      <text x='0' y='-30' font-size='24' font-weight='900' fill='#DC2626' text-anchor='middle'>N</text>
    </g>
    """)

    threat_val = f"{len(resolved_threats)} SAM THREATS" if resolved_threats else "NONE DETECTED"
    threat_cls = "threat-alert" if resolved_threats else "threat-clear"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background-color: #FAFAF8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1A1A1A;
    width: 1024px;
    height: 1554px;
    padding: 82px 16px 14px 16px;
    overflow: hidden;
  }}
  .header {{
    margin-bottom: 8px;
  }}
  .title {{
    font-size: 38px;
    font-weight: 900;
    color: #0D47A1;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }}
  .sub-line {{
    font-size: 22px;
    font-weight: 800;
    color: #334155;
    font-family: monospace;
    margin-top: 4px;
    margin-bottom: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .pills-grid {{
    display: table;
    width: 992px;
    table-layout: fixed;
    border-spacing: 12px 0;
    margin-left: -12px;
    margin-right: -12px;
    margin-bottom: 12px;
  }}
  .pill-col {{
    display: table-cell;
    background: #FFFFFF;
    border: 2.5px solid #94A3B8;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
    vertical-align: middle;
  }}
  .pill-col.tgt {{
    border-color: #2563EB;
    background: #EFF6FF;
  }}
  .pill-col.threat-alert {{
    border-color: #DC2626;
    background: #FEF2F2;
  }}
  .pill-col.threat-clear {{
    border-color: #16A34A;
    background: #F0FDF4;
  }}
  .pill-label {{
    font-size: 16px;
    font-weight: 900;
    color: #64748B;
    letter-spacing: 1px;
  }}
  .pill-col.tgt .pill-label {{ color: #1D4ED8; }}
  .pill-col.threat-alert .pill-label {{ color: #DC2626; }}
  .pill-col.threat-clear .pill-label {{ color: #16A34A; }}
  .pill-value {{
    font-size: 26px;
    font-weight: 900;
    font-family: monospace;
    color: #0F172A;
    margin-top: 2px;
  }}
  .pill-col.tgt .pill-value {{ color: #1E40AF; }}
  .pill-col.threat-alert .pill-value {{ color: #991B1B; font-size: 23px; }}
  .pill-col.threat-clear .pill-value {{ color: #166534; font-size: 23px; }}
  .map-container {{
    width: 992px;
    height: 1300px;
    position: relative;
    border: 2.5px solid #94A3B8;
    border-radius: 8px;
    overflow: hidden;
    background: #E2E8F0;
  }}
  .map-bg {{
    width: 100%;
    height: 100%;
    object-fit: cover;
  }}
  .svg-overlay {{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }}
</style>
</head>
<body>
  <div class='header'>
    <div class='title'>MISSION ROUTE OVERVIEW</div>
    <div class='sub-line'>CALLSIGN: {b_data['callsign']} | PKG #{b_data['pkg_num']} | {b_data['aircraft']} | {b_data['task']}</div>
    <div class='pills-grid'>
      <div class='pill-col'>
        <div class='pill-label'>TAKEOFF</div>
        <div class='pill-value'>T/O: {b_data['to_time']}</div>
      </div>
      <div class='pill-col tgt'>
        <div class='pill-label'>TARGET (TOT)</div>
        <div class='pill-value'>TOT: {b_data['tgt_time']}</div>
      </div>
      <div class='pill-col {threat_cls}'>
        <div class='pill-label'>AIR DEFENSE</div>
        <div class='pill-value'>{threat_val}</div>
      </div>
    </div>
  </div>
  
  <div class='map-container'>
    <img class='map-bg' src='file:///{crop_jpg.resolve()}' />
    <svg class='svg-overlay' viewBox='0 0 {w_svg} {h_svg}'>
      {''.join(svg_elements)}
    </svg>
  </div>
</body>
</html>
"""

    html_file = WORK_DIR / "mission_route.html"
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    render_html_to_png(html_file, out_png)
    return True


def generate_tactical_target_page(b_data, merged_stpts, resolved_threats, theater_size_ft, base_map_path, out_png):
    if not merged_stpts:
        return False

    valid_pts = [p for p in merged_stpts if p["x"] != 0 or p["y"] != 0]
    if not valid_pts:
        return False

    tgt_pt = next((p for p in valid_pts if p["action_code"] == 20 or "TGT" in p["desc"].upper()), None)
    if not tgt_pt:
        tgt_pt = valid_pts[len(valid_pts) // 2]

    tgt_num = tgt_pt["num"]
    ip_pt = next((p for p in valid_pts if p["num"] == tgt_num - 1), None)
    egress_pt = next((p for p in valid_pts if p["num"] == tgt_num + 1), None)

    tgt_x, tgt_y = tgt_pt["x"], tgt_pt["y"]
    span_nm = 34.0
    half_ft = (span_nm * NM_TO_FT) / 2.0
    half_w_ft = half_ft * (992.0 / 1300.0)

    crop_min_x = max(0, tgt_x - half_ft)
    crop_max_x = min(theater_size_ft, tgt_x + half_ft)
    crop_min_y = max(0, tgt_y - half_w_ft)
    crop_max_y = min(theater_size_ft, tgt_y + half_w_ft)

    crop_jpg = WORK_DIR / "crop_target_zoom.jpg"
    crop_theater_map(base_map_path, theater_size_ft, (crop_min_x, crop_max_x, crop_min_y, crop_max_y), crop_jpg)

    w_svg = 992
    h_svg = 1300

    def to_svg(x, y):
        sx = ((y - crop_min_y) / (crop_max_y - crop_min_y)) * w_svg
        sy = ((crop_max_x - x) / (crop_max_x - crop_min_x)) * h_svg
        return sx, sy

    svg_elements = []

    tx, ty = to_svg(tgt_x, tgt_y)
    r5_px = ((5.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg
    r10_px = ((10.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg
    r15_px = ((15.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg

    # Tactical Range Rings
    svg_elements.append(f"""
    <!-- Tactical Range Rings -->
    <circle cx='{tx:.1f}' cy='{ty:.1f}' r='{r5_px:.1f}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
    <circle cx='{tx:.1f}' cy='{ty:.1f}' r='{r10_px:.1f}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
    <circle cx='{tx:.1f}' cy='{ty:.1f}' r='{r15_px:.1f}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
    <text x='{tx:.1f}' y='{ty - r5_px + 18:.1f}' font-size='18' font-weight='900' fill='#0369A1' opacity='0.9' text-anchor='middle'>5 NM</text>
    <text x='{tx:.1f}' y='{ty - r10_px + 18:.1f}' font-size='18' font-weight='900' fill='#0369A1' opacity='0.9' text-anchor='middle'>10 NM</text>
    <text x='{tx:.1f}' y='{ty - r15_px + 18:.1f}' font-size='18' font-weight='900' fill='#0369A1' opacity='0.9' text-anchor='middle'>15 NM</text>
    """)

    # Local threats
    for t in resolved_threats:
        if (crop_min_x - 15*NM_TO_FT <= t["x"] <= crop_max_x + 15*NM_TO_FT and
            crop_min_y - 15*NM_TO_FT <= t["y"] <= crop_max_y + 15*NM_TO_FT):
            thx, thy = to_svg(t["x"], t["y"])
            r_px = ((t["range_nm"] * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg
            name = t["system"].upper()
            svg_elements.append(f"""
            <circle cx='{thx:.1f}' cy='{thy:.1f}' r='{r_px:.1f}' fill='rgba(220, 38, 38, 0.16)' stroke='#DC2626' stroke-width='3.5' stroke-dasharray='10,6' />
            <circle cx='{thx:.1f}' cy='{thy:.1f}' r='8' fill='#DC2626' stroke='#FFFFFF' stroke-width='2.5' />
            <rect x='{thx - 75:.1f}' y='{thy - r_px - 30:.1f}' width='150' height='30' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='2' />
            <text x='{thx:.1f}' y='{thy - r_px - 9:.1f}' font-size='17' font-weight='900' fill='#DC2626' text-anchor='middle'>{name} ({t['range_nm']:.0f}NM)</text>
            """)

    scale_5nm_px = ((5.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg

    def get_edge_point(from_x, from_y, to_x, to_y, badge_w=230.0, badge_h=44.0, pad=16.0, margin_top=115.0, margin_bottom=265.0):
        vx = to_x - from_x
        vy = to_y - from_y
        t = 1.0
        half_w = badge_w / 2.0
        half_h = badge_h / 2.0
        x_min, x_max = half_w + pad, w_svg - (half_w + pad)
        y_min, y_max = half_h + margin_top, h_svg - (half_h + margin_bottom)
        if vx < 0 and from_x + t*vx < x_min: t = min(t, (x_min - from_x) / vx)
        if vx > 0 and from_x + t*vx > x_max: t = min(t, (x_max - from_x) / vx)
        if vy < 0 and from_y + t*vy < y_min: t = min(t, (y_min - from_y) / vy)
        if vy > 0 and from_y + t*vy > y_max: t = min(t, (y_max - from_y) / vy)
        return from_x + t * vx, from_y + t * vy

    # Reserved UI zones on Tactical Target Map
    reserved_target = [
        [20.0, 25.0, 35.0 + scale_5nm_px + 35.0, 115.0],    # Scale bar (top-left)
        [w_svg - 110.0, 15.0, w_svg - 10.0, 120.0],          # North arrow (top-right)
        [12.0, h_svg - 250.0, 480.0, h_svg - 10.0],          # Bottom-left corner card
        [484.0, h_svg - 250.0, w_svg - 12.0, h_svg - 10.0],  # Bottom-right corner card
    ]

    raw_ip_x, raw_ip_y = (0.0, 0.0)
    is_ip_visible = False
    if ip_pt:
        raw_ip_x, raw_ip_y = to_svg(ip_pt["x"], ip_pt["y"])
        is_ip_visible = (50 <= raw_ip_x <= w_svg - 50) and (110 <= raw_ip_y <= h_svg - 260)
        if not is_ip_visible:
            edge_x, edge_y = get_edge_point(tx, ty, raw_ip_x, raw_ip_y, badge_w=230.0, badge_h=44.0)
            reserved_target.append([edge_x - 120.0, edge_y - 25.0, edge_x + 120.0, edge_y + 25.0])

    raw_eg_x, raw_eg_y = (0.0, 0.0)
    is_eg_visible = False
    if egress_pt:
        raw_eg_x, raw_eg_y = to_svg(egress_pt["x"], egress_pt["y"])
        is_eg_visible = (50 <= raw_eg_x <= w_svg - 50) and (110 <= raw_eg_y <= h_svg - 260)
        if not is_eg_visible:
            edge_x, edge_y = get_edge_point(tx, ty, raw_eg_x, raw_eg_y, badge_w=220.0, badge_h=44.0)
            reserved_target.append([edge_x - 115.0, edge_y - 25.0, edge_x + 115.0, edge_y + 25.0])

    tgt_wps = [{
        "num": tgt_num,
        "sx": tx,
        "sy": ty,
        "tag_w": 240,
        "tag_h": 60,
        "is_tgt": True,
    }]
    if ip_pt and is_ip_visible:
        tgt_wps.append({
            "num": ip_pt["num"],
            "sx": raw_ip_x,
            "sy": raw_ip_y,
            "tag_w": 190,
            "tag_h": 50,
            "is_ip": True,
        })
    if egress_pt and is_eg_visible:
        tgt_wps.append({
            "num": egress_pt["num"],
            "sx": raw_eg_x,
            "sy": raw_eg_y,
            "tag_w": 190,
            "tag_h": 50,
            "is_tgt": False,
        })

    tgt_tag_boxes = solve_waypoint_tag_placements(tgt_wps, w_svg, h_svg, reserved_target)

    if ip_pt:
        svg_elements.append(f"""
        <!-- Ingress Vector -->
        <line x1='{raw_ip_x:.1f}' y1='{raw_ip_y:.1f}' x2='{tx:.1f}' y2='{ty:.1f}' stroke='#16A34A' stroke-width='9' stroke-linecap='round' opacity='0.95' />
        <line x1='{raw_ip_x:.1f}' y1='{raw_ip_y:.1f}' x2='{tx:.1f}' y2='{ty:.1f}' stroke='#FFFFFF' stroke-width='4' stroke-dasharray='12,7' />
        """)
        if is_ip_visible:
            ip_box = tgt_tag_boxes.get(ip_pt["num"], [raw_ip_x + 24, raw_ip_y - 16, raw_ip_x + 214, raw_ip_y + 34])
            ibx, iby, ibr, ibb = ip_box
            ibw = ibr - ibx
            ibh = ibb - iby
            itcx = (ibx + ibr) / 2.0
            itcy = (iby + ibb) / 2.0
            idist = math.hypot(itcx - raw_ip_x, itcy - raw_ip_y)
            if idist > 36.0:
                p1x = raw_ip_x + ((itcx - raw_ip_x) / idist) * 18.0
                p1y = raw_ip_y + ((itcy - raw_ip_y) / idist) * 18.0
                p2x = max(ibx, min(itcx, ibr))
                p2y = max(iby, min(itcy, ibb))
                svg_elements.append(f"""
                <line x1='{p1x:.1f}' y1='{p1y:.1f}' x2='{p2x:.1f}' y2='{p2y:.1f}' stroke='#D97706' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />
                """)
            svg_elements.append(f"""
            <rect x='{raw_ip_x - 18:.1f}' y='{raw_ip_y - 18:.1f}' width='36' height='36' fill='#D97706' stroke='#FFFFFF' stroke-width='3.5' />
            <text x='{raw_ip_x:.1f}' y='{raw_ip_y + 7:.1f}' font-size='19' font-family='monospace' font-weight='900' fill='#FFFFFF' text-anchor='middle'>IP</text>
            <g transform='translate({ibx:.1f}, {iby:.1f})'>
              <rect x='0' y='0' width='{ibw:.1f}' height='{ibh:.1f}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='2.5' />
              <text x='8' y='20' font-size='19' font-weight='900' fill='#D97706'>STPT {ip_pt['num']}: {ip_pt['desc'][:10]}</text>
              <text x='8' y='40' font-size='16' font-family='monospace' font-weight='800' fill='#334155'>{ip_pt['time']} | {ip_pt['alt']}</text>
            </g>
            """)
        else:
            edge_x, edge_y = get_edge_point(tx, ty, raw_ip_x, raw_ip_y, badge_w=230.0, badge_h=44.0)
            svg_elements.append(f"""
            <!-- Ingress Inbound Edge Indicator -->
            <g transform='translate({edge_x:.1f}, {edge_y:.1f})'>
              <rect x='-115' y='-22' width='230' height='44' rx='8' fill='rgba(255, 255, 255, 0.96)' stroke='#16A34A' stroke-width='3.5' />
              <text x='0' y='7' font-size='19' font-weight='900' fill='#15803D' text-anchor='middle'>INBOUND: {tgt_pt.get('head', '--')}° ({tgt_pt.get('dist', '--')}NM)</text>
            </g>
            """)

    if egress_pt:
        svg_elements.append(f"""
        <!-- Egress Vector -->
        <line x1='{tx:.1f}' y1='{ty:.1f}' x2='{raw_eg_x:.1f}' y2='{raw_eg_y:.1f}' stroke='#D97706' stroke-width='8' stroke-dasharray='12,7' opacity='0.9' />
        <line x1='{tx:.1f}' y1='{ty:.1f}' x2='{raw_eg_x:.1f}' y2='{raw_eg_y:.1f}' stroke='#FFFFFF' stroke-width='3.5' stroke-dasharray='12,7' opacity='0.9' />
        """)
        if is_eg_visible:
            eg_box = tgt_tag_boxes.get(egress_pt["num"], [raw_eg_x + 24, raw_eg_y - 16, raw_eg_x + 214, raw_eg_y + 34])
            ebx, eby, ebr, ebb = eg_box
            ebw = ebr - ebx
            ebh = ebb - eby
            etcx = (ebx + ebr) / 2.0
            etcy = (eby + ebb) / 2.0
            edist = math.hypot(etcx - raw_eg_x, etcy - raw_eg_y)
            if edist > 36.0:
                p1x = raw_eg_x + ((etcx - raw_eg_x) / edist) * 18.0
                p1y = raw_eg_y + ((etcy - raw_eg_y) / edist) * 18.0
                p2x = max(ebx, min(etcx, ebr))
                p2y = max(eby, min(etcy, ebb))
                svg_elements.append(f"""
                <line x1='{p1x:.1f}' y1='{p1y:.1f}' x2='{p2x:.1f}' y2='{p2y:.1f}' stroke='#D97706' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />
                """)
            svg_elements.append(f"""
            <circle cx='{raw_eg_x:.1f}' cy='{raw_eg_y:.1f}' r='18' fill='#FFFFFF' stroke='#D97706' stroke-width='4' />
            <text x='{raw_eg_x:.1f}' y='{raw_eg_y + 7:.1f}' font-size='20' font-family='monospace' font-weight='900' fill='#D97706' text-anchor='middle'>{egress_pt['num']}</text>
            <g transform='translate({ebx:.1f}, {eby:.1f})'>
              <rect x='0' y='0' width='{ebw:.1f}' height='{ebh:.1f}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='2.5' />
              <text x='8' y='20' font-size='19' font-weight='900' fill='#D97706'>STPT {egress_pt['num']}: EGRESS</text>
              <text x='8' y='40' font-size='16' font-family='monospace' font-weight='800' fill='#334155'>{egress_pt['time']} | {egress_pt['alt']}</text>
            </g>
            """)
        else:
            edge_x, edge_y = get_edge_point(tx, ty, raw_eg_x, raw_eg_y, badge_w=220.0, badge_h=44.0)
            svg_elements.append(f"""
            <!-- Egress Outbound Edge Indicator -->
            <g transform='translate({edge_x:.1f}, {edge_y:.1f})'>
              <rect x='-110' y='-22' width='220' height='44' rx='8' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='3.5' />
              <text x='0' y='7' font-size='19' font-weight='900' fill='#B45309' text-anchor='middle'>OUTBOUND: {egress_pt.get('head', '--')}°</text>
            </g>
            """)

    d_sz = 32
    tbox = tgt_tag_boxes.get(tgt_num, [tx + 38, ty - 22, tx + 278, ty + 38])
    tbx, tby, tbr, tbb = tbox
    tbw = tbr - tbx
    tbh = tbb - tby
    tcx = (tbx + tbr) / 2.0
    tcy = (tby + tbb) / 2.0
    dist_to_center = math.hypot(tcx - tx, tcy - ty)

    # Leader line if displaced from reticle
    if dist_to_center > (d_sz + 18.0):
        p1x = tx + ((tcx - tx) / dist_to_center) * d_sz
        p1y = ty + ((tcy - ty) / dist_to_center) * d_sz
        p2x = max(tbx, min(tcx, tbr))
        p2y = max(tby, min(tcy, tbb))
        svg_elements.append(f"""
        <line x1='{p1x:.1f}' y1='{p1y:.1f}' x2='{p2x:.1f}' y2='{p2y:.1f}' stroke='#DC2626' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />
        """)

    svg_elements.append(f"""
    <!-- Target Marker Reticle -->
    <polygon points='{tx:.1f},{ty - d_sz:.1f} {tx + d_sz:.1f},{ty:.1f} {tx:.1f},{ty + d_sz:.1f} {tx - d_sz:.1f},{ty:.1f}' fill='#DC2626' stroke='#FFFFFF' stroke-width='4.5' />
    <circle cx='{tx:.1f}' cy='{ty:.1f}' r='8' fill='#FFFFFF' />
    <!-- Reticle Crosshairs -->
    <line x1='{tx - 65:.1f}' y1='{ty:.1f}' x2='{tx + 65:.1f}' y2='{ty:.1f}' stroke='#DC2626' stroke-width='5' stroke-dasharray='10,6' />
    <line x1='{tx - 65:.1f}' y1='{ty:.1f}' x2='{tx + 65:.1f}' y2='{ty:.1f}' stroke='#FFFFFF' stroke-width='2.5' stroke-dasharray='10,6' />
    <line x1='{tx:.1f}' y1='{ty - 65:.1f}' x2='{tx:.1f}' y2='{ty + 65:.1f}' stroke='#DC2626' stroke-width='5' stroke-dasharray='10,6' />
    <line x1='{tx:.1f}' y1='{ty - 65:.1f}' x2='{tx:.1f}' y2='{ty + 65:.1f}' stroke='#FFFFFF' stroke-width='2.5' stroke-dasharray='10,6' />
    <g transform='translate({tbx:.1f}, {tby:.1f})'>
      <rect x='0' y='0' width='{tbw:.1f}' height='{tbh:.1f}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='3' />
      <text x='10' y='22' font-size='22' font-weight='900' fill='#DC2626'>TGT {tgt_num}: {tgt_pt['desc'][:11]}</text>
      <text x='10' y='46' font-size='18' font-family='monospace' font-weight='800' fill='#0F172A'>TOT: {tgt_pt['time']} | {tgt_pt['alt']}</text>
    </g>
    """)

    # Scale Bar (MOVED TO TOP LEFT per user request)
    svg_elements.append(f"""
    <!-- Scale Bar (Top Left) -->
    <g transform='translate(35, 55)'>
      <rect x='-12' y='-28' width='{scale_5nm_px + 36}' height='52' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2' />
      <line x1='0' y1='0' x2='{scale_5nm_px:.1f}' y2='0' stroke='#0F172A' stroke-width='5' />
      <line x1='0' y1='-8' x2='0' y2='8' stroke='#0F172A' stroke-width='3.5' />
      <line x1='{scale_5nm_px:.1f}' y1='-8' x2='{scale_5nm_px:.1f}' y2='8' stroke='#0F172A' stroke-width='3.5' />
      <text x='{scale_5nm_px/2:.1f}' y='-8' font-size='20' font-weight='900' fill='#0F172A' text-anchor='middle'>5 NM</text>
    </g>
    <!-- North Arrow (Top Right) -->
    <g transform='translate({w_svg - 60}, 60)'>
      <circle cx='0' cy='0' r='36' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2.5' />
      <polygon points='0,-28 9,-5 0,0' fill='#DC2626' />
      <polygon points='0,-28 -9,-5 0,0' fill='#1E293B' />
      <polygon points='0,28 9,5 0,0' fill='#94A3B8' />
      <polygon points='0,28 -9,5 0,0' fill='#CBD5E1' />
      <text x='0' y='-30' font-size='24' font-weight='900' fill='#DC2626' text-anchor='middle'>N</text>
    </g>
    """)

    threat_val = f"{len(resolved_threats)} SAM THREATS" if resolved_threats else "NONE DETECTED"
    threat_cls = "threat-alert" if resolved_threats else "threat-clear"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background-color: #FAFAF8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1A1A1A;
    width: 1024px;
    height: 1554px;
    padding: 82px 16px 14px 16px;
    overflow: hidden;
  }}
  .header {{
    margin-bottom: 8px;
  }}
  .title {{
    font-size: 38px;
    font-weight: 900;
    color: #DC2626;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }}
  .sub-line {{
    font-size: 22px;
    font-weight: 800;
    color: #334155;
    font-family: monospace;
    margin-top: 4px;
    margin-bottom: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .pills-grid {{
    display: table;
    width: 992px;
    table-layout: fixed;
    border-spacing: 12px 0;
    margin-left: -12px;
    margin-right: -12px;
    margin-bottom: 12px;
  }}
  .pill-col {{
    display: table-cell;
    background: #FFFFFF;
    border: 2.5px solid #94A3B8;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: center;
    vertical-align: middle;
  }}
  .pill-col.tgt {{
    border-color: #DC2626;
    background: #FEF2F2;
  }}
  .pill-col.threat-alert {{
    border-color: #DC2626;
    background: #FEF2F2;
  }}
  .pill-col.threat-clear {{
    border-color: #16A34A;
    background: #F0FDF4;
  }}
  .pill-label {{
    font-size: 16px;
    font-weight: 900;
    color: #64748B;
    letter-spacing: 1px;
  }}
  .pill-col.tgt .pill-label {{ color: #DC2626; }}
  .pill-col.threat-alert .pill-label {{ color: #DC2626; }}
  .pill-col.threat-clear .pill-label {{ color: #16A34A; }}
  .pill-value {{
    font-size: 26px;
    font-weight: 900;
    font-family: monospace;
    color: #0F172A;
    margin-top: 2px;
  }}
  .pill-col.tgt .pill-value {{ color: #991B1B; }}
  .pill-col.threat-alert .pill-value {{ color: #991B1B; font-size: 23px; }}
  .pill-col.threat-clear .pill-value {{ color: #166534; font-size: 23px; }}
  .map-container {{
    width: 992px;
    height: 1300px;
    position: relative;
    border: 2.5px solid #94A3B8;
    border-radius: 8px;
    overflow: hidden;
    background: #E2E8F0;
  }}
  .map-bg {{
    width: 100%;
    height: 100%;
    object-fit: cover;
  }}
  .svg-overlay {{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }}
  .corner-card {{
    position: absolute;
    bottom: 20px;
    background: rgba(255, 255, 255, 0.96);
    border: 3px solid #64748B;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: monospace;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22);
  }}
  .corner-card.left {{
    left: 16px;
    width: 460px;
    border-color: #16A34A;
  }}
  .corner-card.right {{
    right: 16px;
    width: 488px;
    border-color: #DC2626;
  }}
  .corner-title {{
    font-size: 22px;
    font-weight: 900;
    padding-bottom: 6px;
    margin-bottom: 8px;
    border-bottom: 2px solid #E2E8F0;
    white-space: nowrap;
  }}
  .corner-card.left .corner-title {{ color: #15803D; }}
  .corner-card.right .corner-title {{ color: #DC2626; }}
  .card-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
    font-size: 18px;
    font-weight: 700;
    color: #475569;
    white-space: nowrap;
  }}
  .card-row .val {{
    font-weight: 900;
    color: #0F172A;
  }}
</style>
</head>
<body>
  <div class='header'>
    <div class='title'>TACTICAL TARGET / COMBAT AREA</div>
    <div class='sub-line'>TARGET STPT {tgt_num} | ACTION: {tgt_pt['desc']} | TOT: {tgt_pt['time']} | ALT: {tgt_pt['alt']}</div>
    <div class='pills-grid'>
      <div class='pill-col'>
        <div class='pill-label'>TAKEOFF</div>
        <div class='pill-value'>T/O: {b_data['to_time']}</div>
      </div>
      <div class='pill-col tgt'>
        <div class='pill-label'>TARGET (TOT)</div>
        <div class='pill-value'>TOT: {b_data['tgt_time']}</div>
      </div>
      <div class='pill-col {threat_cls}'>
        <div class='pill-label'>AIR DEFENSE</div>
        <div class='pill-value'>{threat_val}</div>
      </div>
    </div>
  </div>
  
  <div class='map-container'>
    <img class='map-bg' src='file:///{crop_jpg.resolve()}' />
    <svg class='svg-overlay' viewBox='0 0 {w_svg} {h_svg}'>
      {''.join(svg_elements)}
    </svg>
    
    <!-- Left Bottom Corner Card: INGRESS PROFILE -->
    <div class='corner-card left'>
      <div class='corner-title'>INGRESS & ATTACK PROFILE</div>
      <div class='card-row'><span>IP STPT:</span><span class='val'>STPT {ip_pt['num'] if ip_pt else '--'} ({ip_pt['desc'][:10] if ip_pt else '--'})</span></div>
      <div class='card-row'><span>ATTACK HDG:</span><span class='val'>{tgt_pt.get('head', '--')}° MAG</span></div>
      <div class='card-row'><span>LEG DISTANCE:</span><span class='val'>{tgt_pt.get('dist', '--')} NM</span></div>
      <div class='card-row'><span>ATTACK SPEED:</span><span class='val'>{tgt_pt.get('cas', '390')} KCAS</span></div>
    </div>
    
    <!-- Right Bottom Corner Card: EGRESS PROFILE -->
    <div class='corner-card right'>
      <div class='corner-title'>EGRESS & RECOVERY PROFILE</div>
      <div class='card-row'><span>TARGET ELEV:</span><span class='val'>{tgt_pt['z']:.0f} FT MSL</span></div>
      <div class='card-row'><span>EGRESS STPT:</span><span class='val'>STPT {egress_pt['num'] if egress_pt else '--'} ({egress_pt['desc'][:10] if egress_pt else 'EGRESS'})</span></div>
      <div class='card-row'><span>EGRESS HDG:</span><span class='val'>{egress_pt.get('head', '--') if egress_pt else '--'}° MAG</span></div>
      <div class='card-row'><span>RECOVERY:</span><span class='val'>{b_data['arr_name'] or 'Homeplate'}</span></div>
    </div>
  </div>
</body>
</html>
"""

    html_file = WORK_DIR / "mission_target.html"
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(html)

    render_html_to_png(html_file, out_png)
    return True


def main():
    print("=== Falcon BMS EZCharts Dynamic Charts Generator ===")
    parser = argparse.ArgumentParser(description="Falcon BMS EZCharts Dynamic Ground & Approach Charts Generator")
    parser.add_argument("--dep", type=str, help="Override departure airbase name or ICAO")
    parser.add_argument("--arr", type=str, help="Override recovery airbase name or ICAO")
    parser.add_argument("--alt", type=str, help="Override alternate airbase name or ICAO")
    parser.add_argument("--wind-deg", type=int, help="Override wind direction (degrees)")
    parser.add_argument("--wind-kts", type=int, help="Override wind speed (kts)")
    parser.add_argument("--no-map", action="store_true", help="Disable mission map generation")
    parser.add_argument("--no-merge", action="store_true", help="Skip running merge.bat to DDS textures")
    parser.add_argument("--no-sound", action="store_true", help="Disable completion sound (init.mp3)")
    args = parser.parse_args()

    base_dir = get_base_dir()
    theater_id = get_theater_id()
    pilot = get_pilot_callsign()

    briefing_file = base_dir / "User" / "Briefings" / "briefing.txt"

    print(f"BMS Base Directory: {base_dir}")
    print(f"Active Theater: {theater_id}")
    print(f"Pilot Callsign: {pilot}")

    # 1. Smart custom pages check
    custom_pages_to_merge = check_and_render_custom_pages(theater_id)
    if custom_pages_to_merge:
        print(f"Custom pages to update: {[slot for slot, _, _ in custom_pages_to_merge]}")
    else:
        print("Static custom pages (Checklists & Threats) are up to date.")

    # 2. Parse briefing or load defaults
    if briefing_file.exists():
        b_data = parse_briefing(briefing_file) or {}
    else:
        b_data = {}

    b_data.setdefault("dep_name", "Gimhae")
    b_data.setdefault("arr_name", "Gimhae")
    b_data.setdefault("alt_name", None)
    b_data.setdefault("takeoff_wind_deg", 0)
    b_data.setdefault("takeoff_wind_kts", 15)
    b_data.setdefault("landing_wind_deg", 0)
    b_data.setdefault("landing_wind_kts", 15)

    # Apply CLI overrides if specified
    if args.dep:
        b_data["dep_name"] = args.dep
    if args.arr:
        b_data["arr_name"] = args.arr
    if args.alt:
        b_data["alt_name"] = args.alt
    if args.wind_deg is not None:
        b_data["takeoff_wind_deg"] = args.wind_deg
        b_data["landing_wind_deg"] = args.wind_deg
    if args.wind_kts is not None:
        b_data["takeoff_wind_kts"] = args.wind_kts
        b_data["landing_wind_kts"] = args.wind_kts

    print(f"Departure Base: {b_data['dep_name']}")
    print(f"Takeoff Wind: {b_data['takeoff_wind_deg']}° @ {b_data['takeoff_wind_kts']} kts")
    print(f"Recovery Base: {b_data['arr_name']}")
    print(f"Landing Wind: {b_data['landing_wind_deg']}° @ {b_data['landing_wind_kts']} kts")
    if b_data['alt_name']:
        print(f"Alternate Base: {b_data['alt_name']}")

    # 3. Load databases
    airports_list, airfield_map, _, th_entry = load_theater_database(theater_id)
    if not airports_list:
        print(f"Error: could not load airports for theater {theater_id}")
        sys.exit(1)

    dep_ap = find_airport(airports_list, b_data["dep_name"])
    arr_ap = find_airport(airports_list, b_data["arr_name"])
    alt_ap = find_airport(airports_list, b_data["alt_name"]) if b_data["alt_name"] else None

    WORK_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)

    # Clean up any previously generated dynamic approach charts to avoid stale leftovers
    for old_f in IMAGES_DIR.glob("arr_ils_*.png"):
        try:
            old_f.unlink()
        except Exception:
            pass
    for old_f in IMAGES_DIR.glob("alt_ils_*.png"):
        try:
            old_f.unlink()
        except Exception:
            pass

    # 4. Compute active runways
    dep_active = calculate_active_runways(dep_ap, b_data["takeoff_wind_deg"], b_data["takeoff_wind_kts"]) if dep_ap else []
    arr_active = calculate_active_runways(arr_ap, b_data["landing_wind_deg"], b_data["landing_wind_kts"]) if arr_ap else []
    alt_active = calculate_active_runways(alt_ap, b_data["landing_wind_deg"], b_data["landing_wind_kts"]) if alt_ap else []

    print(f"DEP Active Runways: {[a['designator'] for a in dep_active]}")
    print(f"ARR Active Runways: {[a['designator'] for a in arr_active]}")

    assigned_pages = []
    next_slot_idx = 4

    # Slot F16_4R & F16_5R: Mission Route Overview & Tactical Target Area Maps
    if not args.no_map:
        callsign_ini = base_dir / "User" / "Config" / f"{pilot}.ini"
        stpt_coords = parse_callsign_stpts(callsign_ini)

        map_id = th_entry.get("mapId", "korea") if th_entry else "korea"
        geo_file = DATA_DIR / "geo" / f"{map_id}.json"
        resolved_threats = resolve_threat_coords(b_data.get("threats", []), geo_file)

        dep_xy = (dep_ap["x"], dep_ap["y"]) if dep_ap else None
        arr_xy = (arr_ap["x"], arr_ap["y"]) if arr_ap else None
        merged_stpts = compute_mission_route_coords(b_data.get("steerpoints", []), dep_xy, arr_xy, stpt_coords)

        th_size = float(th_entry.get("sizeFt", 3358700.0)) if th_entry else 3358700.0
        base_map = find_theater_base_map(theater_id, base_dir, map_id)
        if base_map:
            print(f"Base Map Layer: {base_map.name} ({base_map.parent.name})")

        if base_map and base_map.exists() and merged_stpts:
            route_png = IMAGES_DIR / "mission_route.png"
            if generate_mission_overview_page(b_data, merged_stpts, resolved_threats, th_size, base_map, route_png):
                slot = f"F16_{next_slot_idx}R"
                assigned_pages.append((slot, route_png, "Mission Route Overview"))
                print(f"Generated Route Overview -> {route_png}")
                next_slot_idx += 1

            target_png = IMAGES_DIR / "mission_target.png"
            if generate_tactical_target_page(b_data, merged_stpts, resolved_threats, th_size, base_map, target_png):
                slot = f"F16_{next_slot_idx}R"
                assigned_pages.append((slot, target_png, "Tactical Target / Combat Area"))
                print(f"Generated Target Area Map -> {target_png}")
                next_slot_idx += 1

    # Slot DEP GND
    dep_png = IMAGES_DIR / "dep_gnd.png"
    dep_af = load_airfield_model(airfield_map, dep_ap["id"]) if dep_ap else None
    if dep_ap and dep_af:
        html = generate_taxi_chart_html(dep_ap, dep_af, dep_active, b_data["takeoff_wind_deg"], b_data["takeoff_wind_kts"], is_departure=True)
        html_path = WORK_DIR / "dep_gnd.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        render_html_to_png(html_path, dep_png)
        slot = f"F16_{next_slot_idx}R"
        assigned_pages.append((slot, dep_png, "Departure Ground Taxi Chart"))
        print(f"Generated DEP GND -> {dep_png}")
        next_slot_idx += 1
    else:
        reason = "AIRFIELD CHARTS NOT FOUND IN THEATER DATABASE" if not dep_ap else "AIRFIELD MODEL NOT AVAILABLE"
        html = generate_blank_chart_html(b_data["dep_name"], reason)
        html_path = WORK_DIR / "dep_gnd.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        render_html_to_png(html_path, dep_png)
        slot = f"F16_{next_slot_idx}R"
        assigned_pages.append((slot, dep_png, "Departure Ground Taxi Chart (Blank)"))
        print(f"Generated DEP GND (Blank) -> {dep_png}")
        next_slot_idx += 1

    # Slot ARR ILS
    ils_rendered = False
    if arr_ap and arr_active:
        primary_end = arr_active[0]
        ils_png = IMAGES_DIR / f"arr_ils_{primary_end['designator'].lower()}.png"
        if find_and_render_ils_chart(arr_ap, primary_end, base_dir, ils_png):
            slot = f"F16_{next_slot_idx}R"
            assigned_pages.append((slot, ils_png, f"ARR ILS RWY {primary_end['designator']}"))
            print(f"Generated ARR ILS ({primary_end['designator']}) -> {ils_png}")
            next_slot_idx += 1
            ils_rendered = True

        if len(arr_active) > 1:
            sec_end = arr_active[1]
            if sec_end.get("ils"):
                sec_ils_png = IMAGES_DIR / f"arr_ils_{sec_end['designator'].lower()}.png"
                if find_and_render_ils_chart(arr_ap, sec_end, base_dir, sec_ils_png):
                    slot = f"F16_{next_slot_idx}R"
                    assigned_pages.append((slot, sec_ils_png, f"ARR ILS RWY {sec_end['designator']}"))
                    print(f"Generated ARR ILS Secondary ({sec_end['designator']}) -> {sec_ils_png}")
                    next_slot_idx += 1

    if not ils_rendered:
        ils_blank_png = IMAGES_DIR / "arr_ils_blank.png"
        reason = "AIRFIELD CHARTS NOT FOUND IN THEATER DATABASE" if not arr_ap else "ILS APPROACH CHARTS NOT FOUND"
        html = generate_blank_chart_html(b_data["arr_name"], reason)
        html_path = WORK_DIR / "arr_ils_blank.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        render_html_to_png(html_path, ils_blank_png)
        slot = f"F16_{next_slot_idx}R"
        assigned_pages.append((slot, ils_blank_png, "Arrival Approach Chart (Blank)"))
        print(f"Generated ARR ILS (Blank) -> {ils_blank_png}")
        next_slot_idx += 1

    # Slot F16_6R/7R: ARR GND
    arr_png = IMAGES_DIR / "arr_gnd.png"
    arr_af = load_airfield_model(airfield_map, arr_ap["id"]) if arr_ap else None
    if arr_ap and arr_af:
        html = generate_taxi_chart_html(arr_ap, arr_af, arr_active, b_data["landing_wind_deg"], b_data["landing_wind_kts"], is_departure=False)
        html_path = WORK_DIR / "arr_gnd.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        render_html_to_png(html_path, arr_png)
        slot = f"F16_{next_slot_idx}R"
        assigned_pages.append((slot, arr_png, "Recovery Ground Taxi & Parking Chart"))
        print(f"Generated ARR GND -> {arr_png}")
        next_slot_idx += 1
    else:
        reason = "AIRFIELD CHARTS NOT FOUND IN THEATER DATABASE" if not arr_ap else "AIRFIELD MODEL NOT AVAILABLE"
        html = generate_blank_chart_html(b_data["arr_name"], reason)
        html_path = WORK_DIR / "arr_gnd.html"
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        render_html_to_png(html_path, arr_png)
        slot = f"F16_{next_slot_idx}R"
        assigned_pages.append((slot, arr_png, "Recovery Ground Taxi Chart (Blank)"))
        print(f"Generated ARR GND (Blank) -> {arr_png}")
        next_slot_idx += 1

    # Slot ALT ILS & ALT GND (if alternate specified)
    if alt_ap and alt_active:
        alt_end = alt_active[0]
        alt_ils_png = IMAGES_DIR / f"alt_ils_{alt_end['designator'].lower()}.png"
        if find_and_render_ils_chart(alt_ap, alt_end, base_dir, alt_ils_png):
            slot = f"F16_{next_slot_idx}R"
            assigned_pages.append((slot, alt_ils_png, f"ALT ILS RWY {alt_end['designator']}"))
            print(f"Generated ALT ILS -> {alt_ils_png}")
            next_slot_idx += 1

        alt_af = load_airfield_model(airfield_map, alt_ap["id"])
        if alt_af:
            html = generate_taxi_chart_html(alt_ap, alt_af, alt_active, b_data["landing_wind_deg"], b_data["landing_wind_kts"], is_departure=False)
            html_path = WORK_DIR / "alt_gnd.html"
            png_path = IMAGES_DIR / "alt_gnd.png"
            with open(html_path, "w", encoding="utf-8") as f:
                f.write(html)
            render_html_to_png(html_path, png_path)
            slot = f"F16_{next_slot_idx}R"
            assigned_pages.append((slot, png_path, "Alternate Ground Taxi Chart"))
            print(f"Generated ALT GND -> {png_path}")
            next_slot_idx += 1

    all_pages_to_merge = custom_pages_to_merge + assigned_pages

    # Write batch file
    batch_file = WORK_DIR / "merge_dynamic_charts.bat"
    with open(batch_file, "w", encoding="utf-8") as f:
        f.write("@ECHO OFF\n")
        f.write("REM Auto-generated by ez_charts.py\n")
        f.write('IF "%TEXTURE_DIR_F16%"=="" CALL CONFIG.BAT full\n')
        for slot, png, desc in all_pages_to_merge:
            clean_desc = desc.replace("&", "and")
            rel_png = f"images\\{png.name}"
            f.write(f'ECHO Merging {slot}: {clean_desc} ({rel_png})...\n')
            f.write(f'CALL MERGE.BAT "{rel_png}" {slot}\n')

    if not args.no_merge:
        print("\nExecuting texture merge for updated pages...")
        subprocess.run(["cmd.exe", "/c", str(batch_file)], cwd=str(EZ_ROOT), check=True)

    print("\nExecution complete.")
    if not args.no_sound:
        play_completion_sound()


if __name__ == "__main__":
    main()
