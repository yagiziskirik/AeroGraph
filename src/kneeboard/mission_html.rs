use crate::kneeboard::crop::crop_theater_map;
use crate::kneeboard::models::{BriefingData, Steerpoint, TargetSteerpoint, Threat, ThreatKind};
use crate::kneeboard::renderer::render_html_to_png;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

const NM_TO_FT: f64 = 6076.12;

pub fn get_sam_range(system_name: &str) -> f64 {
    let low = system_name.to_lowercase();
    let ranges: [(&str, f64); 25] = [
        ("sa-2", 18.0),
        ("sa-3", 10.0),
        ("sa-4", 24.0),
        ("sa-5", 135.0),
        ("sa-6", 13.0),
        ("sa-8", 6.5),
        ("sa-10", 40.0),
        ("sa-11", 17.0),
        ("sa-12", 54.0),
        ("sa-13", 2.7),
        ("sa-15", 6.5),
        ("sa-17", 17.0),
        ("sa-19", 4.5),
        ("sa-20", 65.0),
        ("sa-21", 100.0),
        ("sa-22", 9.0),
        ("hq-2", 18.0),
        ("hq-9", 54.0),
        ("hq-16", 22.0),
        ("hq-7", 6.5),
        ("tunguska", 4.5),
        ("pantsir", 9.0),
        ("tor", 6.5),
        ("buk", 17.0),
        ("kub", 13.0),
    ];
    for (name, r) in ranges {
        if low.contains(name) {
            return r;
        }
    }
    if low.contains("ks-19") {
        return 3.5;
    }
    if low.contains("zsu-23") {
        return 1.5;
    }
    if low.contains("2s6") {
        return 4.5;
    }
    8.0
}

pub fn get_compass_dir(dir_str: &str) -> (f64, f64) {
    let diag = std::f64::consts::FRAC_1_SQRT_2;
    match dir_str.to_lowercase().trim() {
        "north" | "n" => (1.0, 0.0),
        "south" | "s" => (-1.0, 0.0),
        "east" | "e" => (0.0, 1.0),
        "west" | "w" => (0.0, -1.0),
        "northeast" | "ne" => (diag, diag),
        "northwest" | "nw" => (diag, -diag),
        "southeast" | "se" => (-diag, diag),
        "southwest" | "sw" => (-diag, -diag),
        _ => (0.0, 0.0),
    }
}

pub fn resolve_threat_coords(threats: &[Threat], geo_path: &Path) -> Vec<Threat> {
    if !geo_path.exists() {
        return Vec::new();
    }

    let Ok(content) = fs::read_to_string(geo_path) else {
        return Vec::new();
    };

    let Ok(geo) = serde_json::from_str::<serde_json::Value>(&content) else {
        return Vec::new();
    };

    let Some(places) = geo.get("places").and_then(|p| p.as_array()) else {
        return Vec::new();
    };

    let mut place_map = HashMap::new();
    for p in places {
        if let (Some(n), Some(x), Some(y)) = (
            p.get("n").and_then(|s| s.as_str()),
            p.get("x").and_then(|v| v.as_f64()),
            p.get("y").and_then(|v| v.as_f64()),
        ) {
            let name_clean = n
                .to_lowercase()
                .replace("village", "")
                .replace("town", "")
                .replace("city", "")
                .trim()
                .to_string();
            place_map.insert(name_clean, (x, y, n.to_string()));
            place_map.insert(n.to_lowercase().trim().to_string(), (x, y, n.to_string()));
        }
    }

    let mut resolved = Vec::new();
    for t in threats {
        let p_name = t
            .place
            .to_lowercase()
            .replace("village", "")
            .replace("town", "")
            .replace("city", "")
            .trim()
            .to_string();
        let target_p = place_map
            .get(&p_name)
            .or_else(|| place_map.get(t.place.to_lowercase().trim()))
            .or_else(|| {
                for (k, v) in &place_map {
                    if p_name.contains(k) || k.contains(&p_name) {
                        return Some(v);
                    }
                }
                None
            });

        if let Some(&(px, py, ref pn)) = target_p {
            let (dx_mult, dy_mult) = get_compass_dir(&t.dir);
            let dist_ft = t.dist_nm * NM_TO_FT;
            let tx = px + (dx_mult * dist_ft);
            let ty = py + (dy_mult * dist_ft);
            let rng_nm = get_sam_range(&t.system);
            resolved.push(Threat {
                system: t.system.clone(),
                dist_nm: t.dist_nm,
                dir: t.dir.clone(),
                place: pn.clone(),
                raw: t.raw.clone(),
                x: tx,
                y: ty,
                range_nm: rng_nm,
                kind: t.kind,
            });
        }
    }

    resolved
}

pub fn compute_mission_route_coords(
    stpts: &[Steerpoint],
    dep_coords: Option<(f64, f64)>,
    arr_coords: Option<(f64, f64)>,
    callsign_coords: Option<&HashMap<u32, TargetSteerpoint>>,
) -> Vec<Steerpoint> {
    let n = stpts.len();
    if n == 0 {
        return Vec::new();
    }

    // 1. If callsign_coords exist, have valid non-zero coords for ALL steerpoints,
    // and match departure airbase, use callsign_coords
    if let (Some(cs_map), Some(dep)) = (callsign_coords, dep_coords) {
        let stpt1_cs = cs_map.get(&1);
        let all_nonzero = stpts.iter().all(|sp| {
            if let Some(c) = cs_map.get(&sp.num) {
                c.x != 0.0 || c.y != 0.0
            } else {
                false
            }
        });

        if let Some(c1) = stpt1_cs {
            if all_nonzero && (c1.x - dep.0).hypot(c1.y - dep.1) < 10.0 * NM_TO_FT {
                let mut merged = Vec::new();
                for sp in stpts {
                    let mut s = sp.clone();
                    if let Some(c) = cs_map.get(&sp.num) {
                        s.x = c.x;
                        s.y = c.y;
                        s.z = c.z;
                        s.action_code = c.action_code;
                    }
                    merged.push(s);
                }
                return merged;
            }
        }
    }

    // 2. Ground-truth dead reckoning from briefing.txt anchored on dep_coords & arr_coords
    struct CoordPt {
        x: f64,
        y: f64,
        valid: bool,
    }

    let mut coords: Vec<CoordPt> = (0..n)
        .map(|_| CoordPt {
            x: 0.0,
            y: 0.0,
            valid: false,
        })
        .collect();

    // STPT 1 at departure airbase
    if let Some(dep) = dep_coords {
        coords[0] = CoordPt {
            x: dep.0,
            y: dep.1,
            valid: true,
        };
    }

    // Find Land steerpoint to anchor to arrival airbase
    let mut land_idx: i32 = -1;
    for (idx, sp) in stpts.iter().enumerate() {
        let act_text = format!("{} {}", sp.action, sp.desc).to_lowercase();
        if act_text.contains("land") {
            land_idx = idx as i32;
            break;
        }
    }
    if land_idx == -1 && n > 1 {
        land_idx = (n - 1) as i32;
    }

    // Forward pass from STPT 1
    let mut fwd_reached_land = false;
    for i in 1..n {
        let sp = &stpts[i];
        if let (Ok(d), Ok(h)) = (sp.dist.parse::<f64>(), sp.head.parse::<f64>()) {
            if coords[i - 1].valid {
                let rad = h.to_radians();
                coords[i] = CoordPt {
                    x: coords[i - 1].x + rad.cos() * d * NM_TO_FT,
                    y: coords[i - 1].y + rad.sin() * d * NM_TO_FT,
                    valid: true,
                };
                if i as i32 == land_idx {
                    fwd_reached_land = true;
                }
            }
        }
    }

    // If forward pass reached land_idx and arr_coords is given, reconcile closure error
    if let (true, Some(arr)) = (fwd_reached_land && land_idx > 0, arr_coords) {
        let err_x = arr.0 - coords[land_idx as usize].x;
        let err_y = arr.1 - coords[land_idx as usize].y;
        for (idx_offset, coord) in coords[1..=(land_idx as usize)].iter_mut().enumerate() {
            let i = idx_offset + 1;
            let factor = i as f64 / land_idx as f64;
            coord.x += err_x * factor;
            coord.y += err_y * factor;
        }
    } else {
        // Backward pass from Landing steerpoint
        if let Some(arr) = arr_coords {
            if land_idx >= 0 && !coords[land_idx as usize].valid {
                coords[land_idx as usize] = CoordPt {
                    x: arr.0,
                    y: arr.1,
                    valid: true,
                };
            }
        }

        if land_idx >= 0 {
            for i in (1..=(land_idx as usize)).rev() {
                let sp = &stpts[i];
                if coords[i].valid && !coords[i - 1].valid {
                    if let (Ok(d), Ok(h)) = (sp.dist.parse::<f64>(), sp.head.parse::<f64>()) {
                        let rad = h.to_radians();
                        coords[i - 1] = CoordPt {
                            x: coords[i].x - rad.cos() * d * NM_TO_FT,
                            y: coords[i].y - rad.sin() * d * NM_TO_FT,
                            valid: true,
                        };
                    }
                }
            }
        }
    }

    // Build merged output
    let mut merged = Vec::new();
    for (i, sp) in stpts.iter().enumerate() {
        let mut s = sp.clone();
        let c = &coords[i];
        s.x = c.x;
        s.y = c.y;
        let desc_l = s.desc.to_lowercase();
        let is_tgt = desc_l.contains("tgt")
            || desc_l.contains("target")
            || desc_l.contains("strike")
            || desc_l.contains("attack")
            || desc_l.contains("sead")
            || desc_l.contains("bomb");
        let is_ip = !is_tgt
            && !desc_l.contains("pre")
            && (desc_l == "ip"
                || desc_l.starts_with("ip ")
                || desc_l.ends_with(" ip")
                || desc_l.contains("initial point"));
        let is_refuel = desc_l.contains("refuel") || desc_l.contains("tanker");
        s.action_code = if is_tgt {
            20
        } else if is_ip {
            13
        } else if is_refuel {
            2
        } else {
            0
        };
        merged.push(s);
    }

    merged
}

struct WaypointPlacementInput {
    num: u32,
    sx: f64,
    sy: f64,
    tag_w: f64,
    tag_h: f64,
    is_tgt: bool,
    is_ip: bool,
}

fn overlap_area(r1: &[f64; 4], r2: &[f64; 4]) -> f64 {
    let dx = (r1[2].min(r2[2]) - r1[0].max(r2[0])).max(0.0);
    let dy = (r1[3].min(r2[3]) - r1[1].max(r2[1])).max(0.0);
    dx * dy
}

fn clamp_to_bounds(r: &[f64; 4], w: f64, h: f64, margin: f64) -> [f64; 4] {
    let tw = r[2] - r[0];
    let th = r[3] - r[1];
    let nx = margin.max(r[0].min(w - margin - tw));
    let ny = margin.max(r[1].min(h - margin - th));
    [nx, ny, nx + tw, ny + th]
}

fn solve_waypoint_tag_placements(
    waypoints: &[WaypointPlacementInput],
    map_w: f64,
    map_h: f64,
    reserved_boxes: &[[f64; 4]],
) -> HashMap<u32, [f64; 4]> {
    let mut sorted_wps: Vec<&WaypointPlacementInput> = waypoints.iter().collect();
    sorted_wps.sort_by_key(|w| {
        let prio = if w.is_tgt {
            0
        } else if w.is_ip {
            1
        } else {
            2
        };
        (prio, w.num)
    });

    let all_markers: Vec<[f64; 5]> = waypoints
        .iter()
        .map(|w| {
            [
                w.sx - 22.0,
                w.sy - 22.0,
                w.sx + 22.0,
                w.sy + 22.0,
                w.num as f64,
            ]
        })
        .collect();

    let mut placed_tags: Vec<(u32, [f64; 4])> = Vec::new();
    let mut results: HashMap<u32, [f64; 4]> = HashMap::new();

    for w in sorted_wps {
        let sx = w.sx;
        let sy = w.sy;
        let tw = w.tag_w;
        let th = w.tag_h;
        let r_val = if w.is_tgt { 26.0 } else { 22.0 };
        let gap = 8.0;

        let candidates: [(f64, f64, f64); 14] = [
            (sx + r_val + gap, sy - th / 2.0, 0.0),      // 0: Right / East
            (sx + r_val + gap, sy - th - 4.0, 2.0),      // 1: Top-Right / North-East
            (sx + r_val + gap, sy + 4.0, 3.0),           // 2: Bottom-Right / South-East
            (sx - tw / 2.0, sy - r_val - gap - th, 5.0), // 3: Top / North
            (sx - tw / 2.0, sy + r_val + gap, 6.0),      // 4: Bottom / South
            (sx - tw - r_val - gap, sy - th / 2.0, 8.0), // 5: Left / West
            (sx - tw - r_val - gap, sy - th - 4.0, 9.0), // 6: Top-Left / North-West
            (sx - tw - r_val - gap, sy + 4.0, 10.0),     // 7: Bottom-Left / South-West
            (sx + r_val + gap + 28.0, sy - th / 2.0, 15.0),
            (sx - tw - r_val - gap - 28.0, sy - th / 2.0, 18.0),
            (sx - tw / 2.0, sy - r_val - gap - th - 28.0, 20.0),
            (sx - tw / 2.0, sy + r_val + gap + 28.0, 20.0),
            (sx + r_val + gap + 24.0, sy - th - 20.0, 22.0),
            (sx - tw - r_val - gap - 24.0, sy - th - 20.0, 24.0),
        ];

        let mut best_box = [sx + 26.0, sy - 25.0, sx + 216.0, sy + 25.0];
        let mut best_cost = f64::INFINITY;

        for (cand_x, cand_y, pref_cost) in candidates {
            let raw_r = [cand_x, cand_y, cand_x + tw, cand_y + th];
            let r = clamp_to_bounds(&raw_r, map_w, map_h, 16.0);

            let clamp_shift = (r[0] - raw_r[0]).abs() + (r[1] - raw_r[1]).abs();
            let mut cost = pref_cost + clamp_shift * 40.0;

            for zone in reserved_boxes {
                let oa = overlap_area(&r, zone);
                if oa > 0.0 {
                    cost += 100000.0 + oa * 300.0;
                }
            }

            for (_, placed_r) in &placed_tags {
                let oa = overlap_area(&r, placed_r);
                if oa > 0.0 {
                    cost += 80000.0 + oa * 400.0;
                }
            }

            for mb in &all_markers {
                let m_box = [mb[0], mb[1], mb[2], mb[3]];
                let oa = overlap_area(&r, &m_box);
                if oa > 0.0 {
                    if (mb[4] - w.num as f64).abs() < 0.1 {
                        cost += 50000.0 + oa * 250.0;
                    } else {
                        cost += 35000.0 + oa * 150.0;
                    }
                }
            }

            if cost < best_cost {
                best_cost = cost;
                best_box = r;
            }
        }

        results.insert(w.num, best_box);
        placed_tags.push((w.num, best_box));
    }

    results
}

#[allow(clippy::too_many_arguments)]
fn get_edge_point(
    from_x: f64,
    from_y: f64,
    to_x: f64,
    to_y: f64,
    badge_w: f64,
    badge_h: f64,
    pad: f64,
    margin_top: f64,
    margin_bottom: f64,
    w_svg: f64,
    h_svg: f64,
) -> (f64, f64) {
    let vx = to_x - from_x;
    let vy = to_y - from_y;
    let mut t = 1.0f64;
    let half_w = badge_w / 2.0;
    let half_h = badge_h / 2.0;
    let x_min = half_w + pad;
    let x_max = w_svg - (half_w + pad);
    let y_min = half_h + margin_top;
    let y_max = h_svg - (half_h + margin_bottom);

    if vx < 0.0 && from_x + t * vx < x_min {
        t = t.min((x_min - from_x) / vx);
    }
    if vx > 0.0 && from_x + t * vx > x_max {
        t = t.min((x_max - from_x) / vx);
    }
    if vy < 0.0 && from_y + t * vy < y_min {
        t = t.min((y_min - from_y) / vy);
    }
    if vy > 0.0 && from_y + t * vy > y_max {
        t = t.min((y_max - from_y) / vy);
    }

    (from_x + t * vx, from_y + t * vy)
}

pub fn compute_route_crop_box(
    merged_stpts: &[Steerpoint],
    resolved_threats: &[Threat],
    theater_size_ft: f64,
) -> Option<(f64, f64, f64, f64)> {
    let valid_pts: Vec<&Steerpoint> = merged_stpts
        .iter()
        .filter(|p| p.x != 0.0 || p.y != 0.0)
        .collect();
    if valid_pts.is_empty() {
        return None;
    }

    let mut xs: Vec<f64> = valid_pts.iter().map(|p| p.x).collect();
    let mut ys: Vec<f64> = valid_pts.iter().map(|p| p.y).collect();
    for t in resolved_threats {
        xs.push(t.x);
        ys.push(t.y);
    }

    let min_x = xs.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_x = xs.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    let min_y = ys.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_y = ys.iter().cloned().fold(f64::NEG_INFINITY, f64::max);

    let span_x = max_x - min_x;
    let span_y = max_y - min_y;
    let max_span = span_x.max(span_y).max(25.0 * NM_TO_FT);
    let margin = max_span * 0.16;

    let mid_x = (min_x + max_x) / 2.0;
    let mid_y = (min_y + max_y) / 2.0;
    let half_h = (max_span / 2.0) + margin;
    let half_w = half_h * (992.0 / 1300.0);

    let crop_min_x = (mid_x - half_h).max(0.0);
    let crop_max_x = (mid_x + half_h).min(theater_size_ft);
    let crop_min_y = (mid_y - half_w).max(0.0);
    let crop_max_y = (mid_y + half_w).min(theater_size_ft);

    Some((crop_min_x, crop_max_x, crop_min_y, crop_max_y))
}

pub fn compute_target_crop_box(
    merged_stpts: &[Steerpoint],
    theater_size_ft: f64,
) -> Option<(f64, f64, f64, f64)> {
    let valid_pts: Vec<&Steerpoint> = merged_stpts
        .iter()
        .filter(|p| p.x != 0.0 || p.y != 0.0)
        .collect();
    if valid_pts.is_empty() {
        return None;
    }

    let tgt_pt = valid_pts
        .iter()
        .find(|p| {
            p.action_code == 20
                || p.desc.to_uppercase().contains("TGT")
                || p.desc.to_uppercase().contains("TARGET")
                || p.desc.to_uppercase().contains("ATTACK")
                || p.desc.to_uppercase().contains("STRIKE")
                || p.desc.to_uppercase().contains("SEAD")
        })
        .copied()
        .unwrap_or(valid_pts[valid_pts.len() / 2]);

    let tgt_x = tgt_pt.x;
    let tgt_y = tgt_pt.y;
    let span_nm = 34.0f64;
    let half_ft = (span_nm * NM_TO_FT) / 2.0;
    let half_w_ft = half_ft * (992.0 / 1300.0);

    let crop_min_x = (tgt_x - half_ft).max(0.0);
    let crop_max_x = (tgt_x + half_ft).min(theater_size_ft);
    let crop_min_y = (tgt_y - half_w_ft).max(0.0);
    let crop_max_y = (tgt_y + half_w_ft).min(theater_size_ft);

    Some((crop_min_x, crop_max_x, crop_min_y, crop_max_y))
}

#[allow(clippy::too_many_arguments)]
pub fn generate_mission_overview_page(
    b_data: &BriefingData,
    merged_stpts: &[Steerpoint],
    resolved_threats: &[Threat],
    theater_size_ft: f64,
    base_map_path: &Path,
    work_dir: &Path,
    out_png: &Path,
    wkhtmltoimage_path: &Path,
) -> Result<(), String> {
    let html_file = generate_mission_overview_html(
        b_data,
        merged_stpts,
        resolved_threats,
        theater_size_ft,
        base_map_path,
        work_dir,
    )?;
    render_html_to_png(wkhtmltoimage_path, &html_file, out_png)
}

pub fn generate_mission_overview_html(
    b_data: &BriefingData,
    merged_stpts: &[Steerpoint],
    resolved_threats: &[Threat],
    theater_size_ft: f64,
    base_map_path: &Path,
    work_dir: &Path,
) -> Result<PathBuf, String> {
    let (crop_min_x, crop_max_x, crop_min_y, crop_max_y) =
        compute_route_crop_box(merged_stpts, resolved_threats, theater_size_ft).ok_or_else(
            || "No valid coordinates in steerpoints for mission overview".to_string(),
        )?;

    let crop_jpg = work_dir.join("crop_route_overview.jpg");
    if !crop_jpg.exists() {
        crop_theater_map(
            base_map_path,
            theater_size_ft,
            (crop_min_x, crop_max_x, crop_min_y, crop_max_y),
            &crop_jpg,
        )?;
    }

    let w_svg = 992.0f64;
    let h_svg = 1300.0f64;

    let to_svg = |x: f64, y: f64| -> (f64, f64) {
        let sx = ((y - crop_min_y) / (crop_max_y - crop_min_y)) * w_svg;
        let sy = ((crop_max_x - x) / (crop_max_x - crop_min_x)) * h_svg;
        (sx, sy)
    };

    let valid_pts: Vec<&Steerpoint> = merged_stpts
        .iter()
        .filter(|p| p.x != 0.0 || p.y != 0.0)
        .collect();

    struct SvgPt<'a> {
        num: u32,
        sx: f64,
        sy: f64,
        desc: &'a str,
        time: &'a str,
        alt: &'a str,
        action_code: i32,
    }

    let mut svg_pts = Vec::new();
    for p in &valid_pts {
        let (sx, sy) = to_svg(p.x, p.y);
        svg_pts.push(SvgPt {
            num: p.num,
            sx,
            sy,
            desc: &p.desc,
            time: &p.time,
            alt: &p.alt,
            action_code: p.action_code,
        });
    }

    let polyline_d = svg_pts
        .iter()
        .map(|p| format!("{:.1},{:.1}", p.sx, p.sy))
        .collect::<Vec<String>>()
        .join(" ");

    let crop_nm_width = (crop_max_y - crop_min_y) / NM_TO_FT;
    let scale_nm = if crop_nm_width > 60.0 {
        20
    } else if crop_nm_width > 30.0 {
        10
    } else {
        5
    };
    let scale_px = (scale_nm as f64 / crop_nm_width) * w_svg;

    // Reserved UI zones on Route Overview
    let reserved_overview = [
        [w_svg - 110.0, 15.0, w_svg - 10.0, 120.0], // North arrow (top-right)
        [20.0, h_svg - 85.0, 35.0 + scale_px + 45.0, h_svg - 10.0], // Scale bar (bottom-left)
    ];

    let mut wp_placement_inputs = Vec::new();
    for p in &svg_pts {
        let is_tgt = p.action_code == 20;
        let is_ip = p.action_code == 13;
        let tw = if is_tgt { 210.0 } else { 190.0 };
        let th = if is_tgt { 56.0 } else { 50.0 };
        wp_placement_inputs.push(WaypointPlacementInput {
            num: p.num,
            sx: p.sx,
            sy: p.sy,
            tag_w: tw,
            tag_h: th,
            is_tgt,
            is_ip,
        });
    }

    let tag_boxes =
        solve_waypoint_tag_placements(&wp_placement_inputs, w_svg, h_svg, &reserved_overview);

    let mut svg_elements = Vec::new();

    // Threat & Support Orbit rings
    for t in resolved_threats {
        let (tx, ty) = to_svg(t.x, t.y);
        let rng_ft = t.range_nm * NM_TO_FT;
        let r_px = (rng_ft / (crop_max_x - crop_min_x)) * h_svg;
        let name = t.system.to_uppercase();

        match t.kind {
            ThreatKind::Tanker => {
                svg_elements.push(format!(
                    r#"<!-- Support Orbit TNK -->
            <circle cx='{tx:.1}' cy='{ty:.1}' r='{r_px:.1}' fill='rgba(126, 34, 206, 0.08)' stroke='#7E22CE' stroke-width='3.0' stroke-dasharray='8,6' />
            <circle cx='{tx:.1}' cy='{ty:.1}' r='7' fill='#7E22CE' stroke='#FFFFFF' stroke-width='2' />
            <rect x='{:.1}' y='{:.1}' width='180' height='28' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#7E22CE' stroke-width='2' />
            <text x='{tx:.1}' y='{:.1}' font-size='15' font-weight='700' fill='#7E22CE' text-anchor='middle'>TNK ORBIT ({:.0}NM)</text>"#,
                    tx - 90.0,
                    ty - r_px - 28.0,
                    ty - r_px - 9.0,
                    t.range_nm
                ));
            }
            ThreatKind::Awacs => {
                svg_elements.push(format!(
                    r#"<!-- Support Orbit AWACS -->
            <circle cx='{tx:.1}' cy='{ty:.1}' r='{r_px:.1}' fill='rgba(13, 148, 136, 0.08)' stroke='#0D9488' stroke-width='3.0' stroke-dasharray='8,6' />
            <circle cx='{tx:.1}' cy='{ty:.1}' r='7' fill='#0D9488' stroke='#FFFFFF' stroke-width='2' />
            <rect x='{:.1}' y='{:.1}' width='190' height='28' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#0D9488' stroke-width='2' />
            <text x='{tx:.1}' y='{:.1}' font-size='15' font-weight='700' fill='#0D9488' text-anchor='middle'>AWACS ORBIT ({:.0}NM)</text>"#,
                    tx - 95.0,
                    ty - r_px - 28.0,
                    ty - r_px - 9.0,
                    t.range_nm
                ));
            }
            ThreatKind::Sam => {
                svg_elements.push(format!(
                    r#"<!-- Threat {name} -->
            <circle cx='{tx:.1}' cy='{ty:.1}' r='{r_px:.1}' fill='rgba(220, 38, 38, 0.14)' stroke='#DC2626' stroke-width='3.5' stroke-dasharray='10,6' />
            <circle cx='{tx:.1}' cy='{ty:.1}' r='8' fill='#DC2626' stroke='#FFFFFF' stroke-width='2.5' />
            <rect x='{:.1}' y='{:.1}' width='160' height='28' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='2' />
            <text x='{tx:.1}' y='{:.1}' font-size='16' font-weight='700' fill='#DC2626' text-anchor='middle'>{name} ({:.0}NM)</text>"#,
                    tx - 80.0,
                    ty - r_px - 28.0,
                    ty - r_px - 9.0,
                    t.range_nm
                ));
            }
        }
    }

    // Polyline route: Thick Royal Blue with White dashed core
    svg_elements.push(format!(
        r#"<polyline points='{polyline_d}' fill='none' stroke='#0284C7' stroke-width='9' stroke-linejoin='round' opacity='0.95' />
        <polyline points='{polyline_d}' fill='none' stroke='#FFFFFF' stroke-width='4' stroke-dasharray='12,7' opacity='0.9' />"#
    ));

    // Waypoints
    for p in &svg_pts {
        let is_tgt = p.action_code == 20;
        let is_ip = p.action_code == 13;
        let is_refuel = p.action_code == 2 || p.desc.to_uppercase().contains("REFUEL");

        if is_tgt {
            let d_sz = 26.0f64;
            svg_elements.push(format!(
                r#"<polygon points='{:.1},{:.1} {:.1},{:.1} {:.1},{:.1} {:.1},{:.1}' fill='#DC2626' stroke='#FFFFFF' stroke-width='4' />
                <circle cx='{:.1}' cy='{:.1}' r='6' fill='#FFFFFF' />"#,
                p.sx, p.sy - d_sz,
                p.sx + d_sz, p.sy,
                p.sx, p.sy + d_sz,
                p.sx - d_sz, p.sy,
                p.sx, p.sy
            ));
        } else if is_ip {
            let sz = 17.0f64;
            svg_elements.push(format!(
                r#"<rect x='{:.1}' y='{:.1}' width='{:.1}' height='{:.1}' fill='#D97706' stroke='#FFFFFF' stroke-width='4' />
                <circle cx='{:.1}' cy='{:.1}' r='5' fill='#FFFFFF' />"#,
                p.sx - sz, p.sy - sz, sz * 2.0, sz * 2.0,
                p.sx, p.sy
            ));
        } else {
            let circle_stroke = if is_refuel { "#7E22CE" } else { "#0369A1" };
            let circle_fill = if is_refuel { "#FAF5FF" } else { "#FFFFFF" };
            svg_elements.push(format!(
                r#"<circle cx='{:.1}' cy='{:.1}' r='18' fill='{circle_fill}' stroke='{circle_stroke}' stroke-width='4' />
                <text x='{:.1}' y='{:.1}' font-size='20' font-family='monospace' font-weight='700' fill='{circle_stroke}' text-anchor='middle'>{}</text>"#,
                p.sx, p.sy,
                p.sx, p.sy + 7.0,
                p.num
            ));
        }

        let lbl_col = if is_tgt {
            "#DC2626"
        } else if is_ip {
            "#D97706"
        } else {
            "#0369A1"
        };
        let border_col = lbl_col;
        let d_sub = if p.desc.len() > 10 {
            &p.desc[..10]
        } else {
            p.desc
        };
        let title_text = if is_tgt {
            format!("TGT {}: {}", p.num, d_sub)
        } else if is_ip {
            format!("IP {}: {}", p.num, d_sub)
        } else {
            format!("STPT {}: {}", p.num, d_sub)
        };

        let sub_text = if p.time != "--" || p.alt != "--" {
            format!("{} | {}", p.time, p.alt)
        } else {
            "ENROUTE".to_string()
        };

        let default_box = [p.sx + 26.0, p.sy - 25.0, p.sx + 216.0, p.sy + 25.0];
        let box_coords = tag_boxes.get(&p.num).unwrap_or(&default_box);
        let bx = box_coords[0];
        let by = box_coords[1];
        let br = box_coords[2];
        let bb = box_coords[3];
        let bw = br - bx;
        let bh = bb - by;

        // Leader line if displaced from marker
        let tcx = (bx + br) / 2.0;
        let tcy = (by + bb) / 2.0;
        let dist_to_center = (tcx - p.sx).hypot(tcy - p.sy);
        let r_marker = if is_tgt {
            26.0
        } else if is_ip {
            20.0
        } else {
            18.0
        };
        if dist_to_center > (r_marker + 16.0) {
            let p1x = p.sx + ((tcx - p.sx) / dist_to_center) * r_marker;
            let p1y = p.sy + ((tcy - p.sy) / dist_to_center) * r_marker;
            let p2x = bx.max(tcx.min(br));
            let p2y = by.max(tcy.min(bb));
            svg_elements.push(format!(
                r#"<line x1='{p1x:.1}' y1='{p1y:.1}' x2='{p2x:.1}' y2='{p2y:.1}' stroke='{border_col}' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />"#
            ));
        }

        svg_elements.push(format!(
            r#"<g transform='translate({bx:.1}, {by:.1})'>
              <rect x='0' y='0' width='{bw:.1}' height='{bh:.1}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='{border_col}' stroke-width='2.5' />
              <text x='8' y='20' font-size='19' font-weight='700' fill='{lbl_col}'>{title_text}</text>
              <text x='8' y='40' font-size='16' font-family='monospace' font-weight='700' fill='#334155'>{sub_text}</text>
            </g>"#
        ));
    }

    // North arrow and Scale bar
    svg_elements.push(format!(
        r#"<!-- Scale Bar -->
        <g transform='translate(35, {:.1})'>
          <rect x='-12' y='-28' width='{:.1}' height='52' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2' />
          <line x1='0' y1='0' x2='{scale_px:.1}' y2='0' stroke='#0F172A' stroke-width='5' />
          <line x1='0' y1='-8' x2='0' y2='8' stroke='#0F172A' stroke-width='3.5' />
          <line x1='{scale_px:.1}' y1='-8' x2='{scale_px:.1}' y2='8' stroke='#0F172A' stroke-width='3.5' />
          <text x='{:.1}' y='-8' font-size='20' font-weight='700' fill='#0F172A' text-anchor='middle'>{scale_nm} NM</text>
        </g>
        <!-- North Arrow (Large VR Identifiable) -->
        <g transform='translate({:.1}, 60)'>
          <circle cx='0' cy='0' r='36' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2.5' />
          <polygon points='0,-28 9,-5 0,0' fill='#DC2626' />
          <polygon points='0,-28 -9,-5 0,0' fill='#1E293B' />
          <polygon points='0,28 9,5 0,0' fill='#94A3B8' />
          <polygon points='0,28 -9,5 0,0' fill='#CBD5E1' />
          <text x='0' y='-30' font-size='24' font-weight='700' fill='#DC2626' text-anchor='middle'>N</text>
        </g>"#,
        h_svg - 45.0,
        scale_px + 36.0,
        scale_px / 2.0,
        w_svg - 60.0
    ));

    let sam_threats: Vec<&Threat> = resolved_threats
        .iter()
        .filter(|t| t.kind == ThreatKind::Sam)
        .collect();
    let threat_val = if !sam_threats.is_empty() {
        format!("{} SAM THREATS", sam_threats.len())
    } else {
        "NONE DETECTED".to_string()
    };
    let threat_cls = if !sam_threats.is_empty() {
        "threat-alert"
    } else {
        "threat-clear"
    };

    let crop_path_str = crop_jpg
        .display()
        .to_string()
        .replace(r"\\?\", "")
        .replace('\\', "/");
    let crop_jpg_uri = format!("file:///{}", crop_path_str.trim_start_matches('/'));

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background-color: #FAFAF8;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
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
    font-weight: 700;
    color: #0D47A1;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }}
  .sub-line {{
    font-size: 22px;
    font-weight: 700;
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
    font-weight: 700;
    color: #64748B;
    letter-spacing: 1px;
  }}
  .pill-col.tgt .pill-label {{ color: #1D4ED8; }}
  .pill-col.threat-alert .pill-label {{ color: #DC2626; }}
  .pill-col.threat-clear .pill-label {{ color: #16A34A; }}
  .pill-value {{
    font-size: 26px;
    font-weight: 700;
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
    <div class='sub-line'>CALLSIGN: {} | PKG #{} | {} | {}</div>
    <div class='pills-grid'>
      <div class='pill-col'>
        <div class='pill-label'>TAKEOFF</div>
        <div class='pill-value'>T/O: {}</div>
      </div>
      <div class='pill-col tgt'>
        <div class='pill-label'>TARGET (TOT)</div>
        <div class='pill-value'>TOT: {}</div>
      </div>
      <div class='pill-col {threat_cls}'>
        <div class='pill-label'>AIR DEFENSE</div>
        <div class='pill-value'>{threat_val}</div>
      </div>
    </div>
  </div>
  
  <div class='map-container'>
    <img class='map-bg' src='{crop_jpg_uri}' />
    <svg class='svg-overlay' viewBox='0 0 {w_svg} {h_svg}'>
      {}
    </svg>
  </div>
</body>
</html>"#,
        b_data.callsign,
        b_data.pkg_num,
        b_data.aircraft,
        b_data.task,
        b_data.to_time,
        b_data.tgt_time,
        svg_elements.join("\n")
    );

    let html_file = work_dir.join("mission_route.html");
    fs::write(&html_file, html)
        .map_err(|e| format!("Failed to write mission_route.html: {}", e))?;

    Ok(html_file)
}

#[allow(clippy::too_many_arguments)]
pub fn generate_tactical_target_page(
    b_data: &BriefingData,
    merged_stpts: &[Steerpoint],
    resolved_threats: &[Threat],
    theater_size_ft: f64,
    base_map_path: &Path,
    work_dir: &Path,
    out_png: &Path,
    wkhtmltoimage_path: &Path,
) -> Result<(), String> {
    let html_file = generate_tactical_target_html(
        b_data,
        merged_stpts,
        resolved_threats,
        theater_size_ft,
        base_map_path,
        work_dir,
    )?;
    render_html_to_png(wkhtmltoimage_path, &html_file, out_png)
}

pub fn generate_tactical_target_html(
    b_data: &BriefingData,
    merged_stpts: &[Steerpoint],
    resolved_threats: &[Threat],
    theater_size_ft: f64,
    base_map_path: &Path,
    work_dir: &Path,
) -> Result<PathBuf, String> {
    let (crop_min_x, crop_max_x, crop_min_y, crop_max_y) =
        compute_target_crop_box(merged_stpts, theater_size_ft)
            .ok_or_else(|| "No valid coordinates in steerpoints for tactical target".to_string())?;

    let valid_pts: Vec<&Steerpoint> = merged_stpts
        .iter()
        .filter(|p| p.x != 0.0 || p.y != 0.0)
        .collect();
    let tgt_pt = valid_pts
        .iter()
        .find(|p| {
            p.action_code == 20
                || p.desc.to_uppercase().contains("TGT")
                || p.desc.to_uppercase().contains("TARGET")
                || p.desc.to_uppercase().contains("ATTACK")
                || p.desc.to_uppercase().contains("STRIKE")
                || p.desc.to_uppercase().contains("SEAD")
        })
        .copied()
        .unwrap_or(valid_pts[valid_pts.len() / 2]);

    let tgt_num = tgt_pt.num;
    let ip_pt = valid_pts
        .iter()
        .find(|p| p.action_code == 13 && p.num < tgt_num)
        .or_else(|| {
            valid_pts
                .iter()
                .find(|p| p.num == tgt_num.saturating_sub(1))
        })
        .copied();
    let egress_pt = valid_pts.iter().find(|p| p.num == tgt_num + 1).copied();

    let tgt_x = tgt_pt.x;
    let tgt_y = tgt_pt.y;

    let crop_jpg = work_dir.join("crop_target_zoom.jpg");
    if !crop_jpg.exists() {
        crop_theater_map(
            base_map_path,
            theater_size_ft,
            (crop_min_x, crop_max_x, crop_min_y, crop_max_y),
            &crop_jpg,
        )?;
    }

    let w_svg = 992.0f64;
    let h_svg = 1300.0f64;

    let to_svg = |x: f64, y: f64| -> (f64, f64) {
        let sx = ((y - crop_min_y) / (crop_max_y - crop_min_y)) * w_svg;
        let sy = ((crop_max_x - x) / (crop_max_x - crop_min_x)) * h_svg;
        (sx, sy)
    };

    let mut svg_elements = Vec::new();

    let (tx, ty) = to_svg(tgt_x, tgt_y);
    let r5_px = ((5.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg;
    let r10_px = ((10.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg;
    let r15_px = ((15.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg;

    // Tactical Range Rings
    svg_elements.push(format!(
        r#"<!-- Tactical Range Rings -->
        <circle cx='{tx:.1}' cy='{ty:.1}' r='{r5_px:.1}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
        <circle cx='{tx:.1}' cy='{ty:.1}' r='{r10_px:.1}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
        <circle cx='{tx:.1}' cy='{ty:.1}' r='{r15_px:.1}' fill='none' stroke='#0284C7' stroke-width='2.5' stroke-dasharray='8,6' opacity='0.7' />
        <text x='{tx:.1}' y='{:.1}' font-size='18' font-weight='700' fill='#0369A1' opacity='0.9' text-anchor='middle'>5 NM</text>
        <text x='{tx:.1}' y='{:.1}' font-size='18' font-weight='700' fill='#0369A1' opacity='0.9' text-anchor='middle'>10 NM</text>
        <text x='{tx:.1}' y='{:.1}' font-size='18' font-weight='700' fill='#0369A1' opacity='0.9' text-anchor='middle'>15 NM</text>"#,
        ty - r5_px + 18.0,
        ty - r10_px + 18.0,
        ty - r15_px + 18.0
    ));

    // Local SAM threats
    for t in resolved_threats
        .iter()
        .filter(|t| t.kind == ThreatKind::Sam)
    {
        let margin_threat = 15.0 * NM_TO_FT;
        if t.x >= crop_min_x - margin_threat
            && t.x <= crop_max_x + margin_threat
            && t.y >= crop_min_y - margin_threat
            && t.y <= crop_max_y + margin_threat
        {
            let (thx, thy) = to_svg(t.x, t.y);
            let r_px = ((t.range_nm * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg;
            let name = t.system.to_uppercase();
            svg_elements.push(format!(
                r#"<circle cx='{thx:.1}' cy='{thy:.1}' r='{r_px:.1}' fill='rgba(220, 38, 38, 0.16)' stroke='#DC2626' stroke-width='3.5' stroke-dasharray='10,6' />
                <circle cx='{thx:.1}' cy='{thy:.1}' r='8' fill='#DC2626' stroke='#FFFFFF' stroke-width='2.5' />
                <rect x='{:.1}' y='{:.1}' width='150' height='30' rx='4' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='2' />
                <text x='{thx:.1}' y='{:.1}' font-size='17' font-weight='700' fill='#DC2626' text-anchor='middle'>{name} ({:.0}NM)</text>"#,
                thx - 75.0,
                thy - r_px - 30.0,
                thy - r_px - 9.0,
                t.range_nm
            ));
        }
    }

    let scale_5nm_px = ((5.0 * NM_TO_FT) / (crop_max_x - crop_min_x)) * h_svg;

    // Reserved UI zones on Tactical Target Map
    let mut reserved_target = vec![
        [20.0, 25.0, 35.0 + scale_5nm_px + 35.0, 115.0], // Scale bar (top-left)
        [w_svg - 110.0, 15.0, w_svg - 10.0, 120.0],      // North arrow (top-right)
        [12.0, h_svg - 250.0, 480.0, h_svg - 10.0],      // Bottom-left corner card
        [484.0, h_svg - 250.0, w_svg - 12.0, h_svg - 10.0], // Bottom-right corner card
    ];

    let mut raw_ip_x = 0.0f64;
    let mut raw_ip_y = 0.0f64;
    let mut is_ip_visible = false;
    if let Some(ip) = ip_pt {
        let (ix, iy) = to_svg(ip.x, ip.y);
        raw_ip_x = ix;
        raw_ip_y = iy;
        is_ip_visible = (50.0..=w_svg - 50.0).contains(&raw_ip_x)
            && (110.0..=h_svg - 260.0).contains(&raw_ip_y);
        if !is_ip_visible {
            let (edge_x, edge_y) = get_edge_point(
                tx, ty, raw_ip_x, raw_ip_y, 230.0, 44.0, 16.0, 115.0, 265.0, w_svg, h_svg,
            );
            reserved_target.push([edge_x - 120.0, edge_y - 25.0, edge_x + 120.0, edge_y + 25.0]);
        }
    }

    let mut raw_eg_x = 0.0f64;
    let mut raw_eg_y = 0.0f64;
    let mut is_eg_visible = false;
    if let Some(eg) = egress_pt {
        let (ex, ey) = to_svg(eg.x, eg.y);
        raw_eg_x = ex;
        raw_eg_y = ey;
        is_eg_visible = (50.0..=w_svg - 50.0).contains(&raw_eg_x)
            && (110.0..=h_svg - 260.0).contains(&raw_eg_y);
        if !is_eg_visible {
            let (edge_x, edge_y) = get_edge_point(
                tx, ty, raw_eg_x, raw_eg_y, 220.0, 44.0, 16.0, 115.0, 265.0, w_svg, h_svg,
            );
            reserved_target.push([edge_x - 115.0, edge_y - 25.0, edge_x + 115.0, edge_y + 25.0]);
        }
    }

    let mut tgt_wps = vec![WaypointPlacementInput {
        num: tgt_num,
        sx: tx,
        sy: ty,
        tag_w: 240.0,
        tag_h: 60.0,
        is_tgt: true,
        is_ip: false,
    }];
    if let Some(ip) = ip_pt {
        if is_ip_visible {
            tgt_wps.push(WaypointPlacementInput {
                num: ip.num,
                sx: raw_ip_x,
                sy: raw_ip_y,
                tag_w: 190.0,
                tag_h: 50.0,
                is_tgt: false,
                is_ip: true,
            });
        }
    }
    if let Some(eg) = egress_pt {
        if is_eg_visible {
            tgt_wps.push(WaypointPlacementInput {
                num: eg.num,
                sx: raw_eg_x,
                sy: raw_eg_y,
                tag_w: 190.0,
                tag_h: 50.0,
                is_tgt: false,
                is_ip: false,
            });
        }
    }

    let tgt_tag_boxes = solve_waypoint_tag_placements(&tgt_wps, w_svg, h_svg, &reserved_target);

    if let Some(ip) = ip_pt {
        svg_elements.push(format!(
            r#"<!-- Ingress Vector -->
            <line x1='{raw_ip_x:.1}' y1='{raw_ip_y:.1}' x2='{tx:.1}' y2='{ty:.1}' stroke='#16A34A' stroke-width='9' stroke-linecap='round' opacity='0.95' />
            <line x1='{raw_ip_x:.1}' y1='{raw_ip_y:.1}' x2='{tx:.1}' y2='{ty:.1}' stroke='#FFFFFF' stroke-width='4' stroke-dasharray='12,7' />"#
        ));

        if is_ip_visible {
            let def_box = [
                raw_ip_x + 24.0,
                raw_ip_y - 16.0,
                raw_ip_x + 214.0,
                raw_ip_y + 34.0,
            ];
            let ip_box = tgt_tag_boxes.get(&ip.num).unwrap_or(&def_box);
            let ibx = ip_box[0];
            let iby = ip_box[1];
            let ibr = ip_box[2];
            let ibb = ip_box[3];
            let ibw = ibr - ibx;
            let ibh = ibb - iby;
            let itcx = (ibx + ibr) / 2.0;
            let itcy = (iby + ibb) / 2.0;
            let idist = (itcx - raw_ip_x).hypot(itcy - raw_ip_y);
            if idist > 36.0 {
                let p1x = raw_ip_x + ((itcx - raw_ip_x) / idist) * 18.0;
                let p1y = raw_ip_y + ((itcy - raw_ip_y) / idist) * 18.0;
                let p2x = ibx.max(itcx.min(ibr));
                let p2y = iby.max(itcy.min(ibb));
                svg_elements.push(format!(
                    r#"<line x1='{p1x:.1}' y1='{p1y:.1}' x2='{p2x:.1}' y2='{p2y:.1}' stroke='#D97706' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />"#
                ));
            }
            let d_sub = if ip.desc.len() > 10 {
                &ip.desc[..10]
            } else {
                &ip.desc
            };
            svg_elements.push(format!(
                r#"<rect x='{:.1}' y='{:.1}' width='36' height='36' fill='#D97706' stroke='#FFFFFF' stroke-width='3.5' />
                <text x='{raw_ip_x:.1}' y='{:.1}' font-size='19' font-family='monospace' font-weight='700' fill='#FFFFFF' text-anchor='middle'>IP</text>
                <g transform='translate({ibx:.1}, {iby:.1})'>
                  <rect x='0' y='0' width='{ibw:.1}' height='{ibh:.1}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='2.5' />
                  <text x='8' y='20' font-size='19' font-weight='700' fill='#D97706'>STPT {}: {}</text>
                  <text x='8' y='40' font-size='16' font-family='monospace' font-weight='700' fill='#334155'>{} | {}</text>
                </g>"#,
                raw_ip_x - 18.0, raw_ip_y - 18.0,
                raw_ip_y + 7.0,
                ip.num, d_sub,
                ip.time, ip.alt
            ));
        } else {
            let (edge_x, edge_y) = get_edge_point(
                tx, ty, raw_ip_x, raw_ip_y, 230.0, 44.0, 16.0, 115.0, 265.0, w_svg, h_svg,
            );
            svg_elements.push(format!(
                r#"<!-- Ingress Inbound Edge Indicator -->
                <g transform='translate({edge_x:.1}, {edge_y:.1})'>
                  <rect x='-115' y='-22' width='230' height='44' rx='8' fill='rgba(255, 255, 255, 0.96)' stroke='#16A34A' stroke-width='3.5' />
                  <text x='0' y='7' font-size='19' font-weight='700' fill='#15803D' text-anchor='middle'>INBOUND: {}° ({}NM)</text>
                </g>"#,
                tgt_pt.head, tgt_pt.dist
            ));
        }
    }

    if let Some(eg) = egress_pt {
        svg_elements.push(format!(
            r#"<!-- Egress Vector -->
            <line x1='{tx:.1}' y1='{ty:.1}' x2='{raw_eg_x:.1}' y2='{raw_eg_y:.1}' stroke='#D97706' stroke-width='8' stroke-dasharray='12,7' opacity='0.9' />
            <line x1='{tx:.1}' y1='{ty:.1}' x2='{raw_eg_x:.1}' y2='{raw_eg_y:.1}' stroke='#FFFFFF' stroke-width='3.5' stroke-dasharray='12,7' opacity='0.9' />"#
        ));

        if is_eg_visible {
            let def_box = [
                raw_eg_x + 24.0,
                raw_eg_y - 16.0,
                raw_eg_x + 214.0,
                raw_eg_y + 34.0,
            ];
            let eg_box = tgt_tag_boxes.get(&eg.num).unwrap_or(&def_box);
            let ebx = eg_box[0];
            let eby = eg_box[1];
            let ebr = eg_box[2];
            let ebb = eg_box[3];
            let ebw = ebr - ebx;
            let ebh = ebb - eby;
            let etcx = (ebx + ebr) / 2.0;
            let etcy = (eby + ebb) / 2.0;
            let edist = (etcx - raw_eg_x).hypot(etcy - raw_eg_y);
            if edist > 36.0 {
                let p1x = raw_eg_x + ((etcx - raw_eg_x) / edist) * 18.0;
                let p1y = raw_eg_y + ((etcy - raw_eg_y) / edist) * 18.0;
                let p2x = ebx.max(etcx.min(ebr));
                let p2y = eby.max(etcy.min(ebb));
                svg_elements.push(format!(
                    r#"<line x1='{p1x:.1}' y1='{p1y:.1}' x2='{p2x:.1}' y2='{p2y:.1}' stroke='#D97706' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />"#
                ));
            }
            svg_elements.push(format!(
                r#"<circle cx='{raw_eg_x:.1}' cy='{raw_eg_y:.1}' r='18' fill='#FFFFFF' stroke='#D97706' stroke-width='4' />
                <text x='{raw_eg_x:.1}' y='{:.1}' font-size='20' font-family='monospace' font-weight='700' fill='#D97706' text-anchor='middle'>{}</text>
                <g transform='translate({ebx:.1}, {eby:.1})'>
                  <rect x='0' y='0' width='{ebw:.1}' height='{ebh:.1}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='2.5' />
                  <text x='8' y='20' font-size='19' font-weight='700' fill='#D97706'>STPT {}: EGRESS</text>
                  <text x='8' y='40' font-size='16' font-family='monospace' font-weight='700' fill='#334155'>{} | {}</text>
                </g>"#,
                raw_eg_y + 7.0,
                eg.num, eg.num,
                eg.time, eg.alt
            ));
        } else {
            let (edge_x, edge_y) = get_edge_point(
                tx, ty, raw_eg_x, raw_eg_y, 220.0, 44.0, 16.0, 115.0, 265.0, w_svg, h_svg,
            );
            svg_elements.push(format!(
                r#"<!-- Egress Outbound Edge Indicator -->
                <g transform='translate({edge_x:.1}, {edge_y:.1})'>
                  <rect x='-110' y='-22' width='220' height='44' rx='8' fill='rgba(255, 255, 255, 0.96)' stroke='#D97706' stroke-width='3.5' />
                  <text x='0' y='7' font-size='19' font-weight='700' fill='#B45309' text-anchor='middle'>OUTBOUND: {}°</text>
                </g>"#,
                eg.head
            ));
        }
    }

    let d_sz = 32.0f64;
    let def_tbox = [tx + 38.0, ty - 22.0, tx + 278.0, ty + 38.0];
    let tbox = tgt_tag_boxes.get(&tgt_num).unwrap_or(&def_tbox);
    let tbx = tbox[0];
    let tby = tbox[1];
    let tbr = tbox[2];
    let tbb = tbox[3];
    let tbw = tbr - tbx;
    let tbh = tbb - tby;
    let tcx = (tbx + tbr) / 2.0;
    let tcy = (tby + tbb) / 2.0;
    let dist_to_center = (tcx - tx).hypot(tcy - ty);

    // Leader line if displaced from reticle
    if dist_to_center > (d_sz + 18.0) {
        let p1x = tx + ((tcx - tx) / dist_to_center) * d_sz;
        let p1y = ty + ((tcy - ty) / dist_to_center) * d_sz;
        let p2x = tbx.max(tcx.min(tbr));
        let p2y = tby.max(tcy.min(tbb));
        svg_elements.push(format!(
            r#"<line x1='{p1x:.1}' y1='{p1y:.1}' x2='{p2x:.1}' y2='{p2y:.1}' stroke='#DC2626' stroke-width='2.5' stroke-dasharray='4,3' opacity='0.85' />"#
        ));
    }

    let tgt_desc_sub = if tgt_pt.desc.len() > 11 {
        &tgt_pt.desc[..11]
    } else {
        &tgt_pt.desc
    };

    svg_elements.push(format!(
        r#"<!-- Target Marker Reticle -->
        <polygon points='{:.1},{:.1} {:.1},{:.1} {:.1},{:.1} {:.1},{:.1}' fill='#DC2626' stroke='#FFFFFF' stroke-width='4.5' />
        <circle cx='{tx:.1}' cy='{ty:.1}' r='8' fill='#FFFFFF' />
        <!-- Reticle Crosshairs -->
        <line x1='{:.1}' y1='{ty:.1}' x2='{:.1}' y2='{ty:.1}' stroke='#DC2626' stroke-width='5' stroke-dasharray='10,6' />
        <line x1='{:.1}' y1='{ty:.1}' x2='{:.1}' y2='{ty:.1}' stroke='#FFFFFF' stroke-width='2.5' stroke-dasharray='10,6' />
        <line x1='{tx:.1}' y1='{:.1}' x2='{tx:.1}' y2='{:.1}' stroke='#DC2626' stroke-width='5' stroke-dasharray='10,6' />
        <line x1='{tx:.1}' y1='{:.1}' x2='{tx:.1}' y2='{:.1}' stroke='#FFFFFF' stroke-width='2.5' stroke-dasharray='10,6' />
        <g transform='translate({tbx:.1}, {tby:.1})'>
          <rect x='0' y='0' width='{tbw:.1}' height='{tbh:.1}' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#DC2626' stroke-width='3' />
          <text x='10' y='22' font-size='22' font-weight='700' fill='#DC2626'>TGT {tgt_num}: {tgt_desc_sub}</text>
          <text x='10' y='46' font-size='18' font-family='monospace' font-weight='700' fill='#0F172A'>TOT: {} | {}</text>
        </g>"#,
        tx, ty - d_sz,
        tx + d_sz, ty,
        tx, ty + d_sz,
        tx - d_sz, ty,
        tx - 65.0, tx + 65.0,
        tx - 65.0, tx + 65.0,
        ty - 65.0, ty + 65.0,
        ty - 65.0, ty + 65.0,
        tgt_pt.time, tgt_pt.alt
    ));

    // Scale Bar (MOVED TO TOP LEFT per user request) and North Arrow (TOP RIGHT)
    svg_elements.push(format!(
        r#"<!-- Scale Bar (Top Left) -->
        <g transform='translate(35, 55)'>
          <rect x='-12' y='-28' width='{:.1}' height='52' rx='6' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2' />
          <line x1='0' y1='0' x2='{scale_5nm_px:.1}' y2='0' stroke='#0F172A' stroke-width='5' />
          <line x1='0' y1='-8' x2='0' y2='8' stroke='#0F172A' stroke-width='3.5' />
          <line x1='{scale_5nm_px:.1}' y1='-8' x2='{scale_5nm_px:.1}' y2='8' stroke='#0F172A' stroke-width='3.5' />
          <text x='{:.1}' y='-8' font-size='20' font-weight='700' fill='#0F172A' text-anchor='middle'>5 NM</text>
        </g>
        <!-- North Arrow (Top Right) -->
        <g transform='translate({:.1}, 60)'>
          <circle cx='0' cy='0' r='36' fill='rgba(255, 255, 255, 0.96)' stroke='#64748B' stroke-width='2.5' />
          <polygon points='0,-28 9,-5 0,0' fill='#DC2626' />
          <polygon points='0,-28 -9,-5 0,0' fill='#1E293B' />
          <polygon points='0,28 9,5 0,0' fill='#94A3B8' />
          <polygon points='0,28 -9,5 0,0' fill='#CBD5E1' />
          <text x='0' y='-30' font-size='24' font-weight='700' fill='#DC2626' text-anchor='middle'>N</text>
        </g>"#,
        scale_5nm_px + 36.0,
        scale_5nm_px / 2.0,
        w_svg - 60.0
    ));

    let sam_threats: Vec<&Threat> = resolved_threats
        .iter()
        .filter(|t| t.kind == ThreatKind::Sam)
        .collect();
    let threat_val = if !sam_threats.is_empty() {
        format!("{} SAM THREATS", sam_threats.len())
    } else {
        "NONE DETECTED".to_string()
    };
    let threat_cls = if !sam_threats.is_empty() {
        "threat-alert"
    } else {
        "threat-clear"
    };

    let crop_path_str = crop_jpg
        .display()
        .to_string()
        .replace(r"\\?\", "")
        .replace('\\', "/");
    let crop_jpg_uri = format!("file:///{}", crop_path_str.trim_start_matches('/'));

    let ip_desc_sub = ip_pt
        .map(|ip| {
            if ip.desc.len() > 10 {
                &ip.desc[..10]
            } else {
                &ip.desc
            }
        })
        .unwrap_or("--");
    let eg_desc_sub = egress_pt
        .map(|eg| {
            if eg.desc.len() > 10 {
                &eg.desc[..10]
            } else {
                &eg.desc
            }
        })
        .unwrap_or("EGRESS");
    let arr_name_str = b_data.arr_name.as_deref().unwrap_or("Homeplate");

    let html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    background-color: #FAFAF8;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
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
    font-weight: 700;
    color: #DC2626;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }}
  .sub-line {{
    font-size: 22px;
    font-weight: 700;
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
    font-weight: 700;
    color: #64748B;
    letter-spacing: 1px;
  }}
  .pill-col.tgt .pill-label {{ color: #DC2626; }}
  .pill-col.threat-alert .pill-label {{ color: #DC2626; }}
  .pill-col.threat-clear .pill-label {{ color: #16A34A; }}
  .pill-value {{
    font-size: 26px;
    font-weight: 700;
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
    font-weight: 700;
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
    font-weight: 700;
    color: #0F172A;
  }}
</style>
</head>
<body>
  <div class='header'>
    <div class='title'>TACTICAL TARGET / COMBAT AREA</div>
    <div class='sub-line'>TARGET STPT {tgt_num} | ACTION: {} | TOT: {} | ALT: {}</div>
    <div class='pills-grid'>
      <div class='pill-col'>
        <div class='pill-label'>TAKEOFF</div>
        <div class='pill-value'>T/O: {}</div>
      </div>
      <div class='pill-col tgt'>
        <div class='pill-label'>TARGET (TOT)</div>
        <div class='pill-value'>TOT: {}</div>
      </div>
      <div class='pill-col {threat_cls}'>
        <div class='pill-label'>AIR DEFENSE</div>
        <div class='pill-value'>{threat_val}</div>
      </div>
    </div>
  </div>
  
  <div class='map-container'>
    <img class='map-bg' src='{crop_jpg_uri}' />
    <svg class='svg-overlay' viewBox='0 0 {w_svg} {h_svg}'>
      {}
    </svg>
    
    <!-- Left Bottom Corner Card: INGRESS PROFILE -->
    <div class='corner-card left'>
      <div class='corner-title'>INGRESS & ATTACK PROFILE</div>
      <div class='card-row'><span>IP STPT:</span><span class='val'>STPT {} ({})</span></div>
      <div class='card-row'><span>ATTACK HDG:</span><span class='val'>{}° MAG</span></div>
      <div class='card-row'><span>LEG DISTANCE:</span><span class='val'>{} NM</span></div>
      <div class='card-row'><span>ATTACK SPEED:</span><span class='val'>{} KCAS</span></div>
    </div>
    
    <!-- Right Bottom Corner Card: EGRESS PROFILE -->
    <div class='corner-card right'>
      <div class='corner-title'>EGRESS & RECOVERY PROFILE</div>
      <div class='card-row'><span>TARGET ELEV:</span><span class='val'>{:.0} FT MSL</span></div>
      <div class='card-row'><span>EGRESS STPT:</span><span class='val'>STPT {} ({})</span></div>
      <div class='card-row'><span>EGRESS HDG:</span><span class='val'>{}° MAG</span></div>
      <div class='card-row'><span>RECOVERY:</span><span class='val'>{arr_name_str}</span></div>
    </div>
  </div>
</body>
</html>"#,
        tgt_pt.desc,
        tgt_pt.time,
        tgt_pt.alt,
        b_data.to_time,
        b_data.tgt_time,
        svg_elements.join("\n"),
        ip_pt
            .map(|ip| ip.num.to_string())
            .unwrap_or_else(|| "--".to_string()),
        ip_desc_sub,
        tgt_pt.head,
        tgt_pt.dist,
        if !tgt_pt.cas.is_empty() && tgt_pt.cas != "--" {
            &tgt_pt.cas
        } else {
            "390"
        },
        tgt_pt.z,
        egress_pt
            .map(|eg| eg.num.to_string())
            .unwrap_or_else(|| "--".to_string()),
        eg_desc_sub,
        egress_pt.map(|eg| eg.head.as_str()).unwrap_or("--")
    );

    let html_file = work_dir.join("mission_target.html");
    fs::write(&html_file, html)
        .map_err(|e| format!("Failed to write mission_target.html: {}", e))?;

    Ok(html_file)
}
