use std::collections::HashMap;
use std::fs;
use std::path::Path;
use regex::Regex;
use crate::kneeboard::models::{BriefingData, CommAgency, Steerpoint, TargetSteerpoint, Threat};

pub fn parse_briefing(path: &Path) -> Option<BriefingData> {
    if !path.exists() {
        return None;
    }

    let bytes = fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    let mut data = BriefingData::default();

    // Callsign & Role: e.g. "Satan 7 (DEAD)"
    if let Ok(re) = Regex::new(r"(?m)^\s*([A-Za-z0-9_-]+)\s*\(([A-Z\s]+)\)") {
        if let Some(caps) = re.captures(&text) {
            data.callsign = caps[1].trim().to_string();
            data.role = caps[2].trim().to_string();
        }
    }

    // Package #: e.g. "Package #: 1225"
    if let Ok(re) = Regex::new(r"Package #:\s*(\d+)") {
        if let Some(caps) = re.captures(&text) {
            data.pkg_num = caps[1].to_string();
        }
    }

    // Package Elements line: Aircraft & Task
    if let Ok(re) = Regex::new(r"([A-Za-z0-9_-]+)\s+\d+\s*\([xX\s]*\)\s+([A-Za-z0-9_-]+)\s+([0-9\sA-Za-z-]+?)\s{2,}([^\r\n]+)") {
        if let Some(caps) = re.captures(&text) {
            data.aircraft = caps[3].trim().to_string();
            data.task = caps[4].trim().to_string();
        }
    }

    // Timings
    if let Ok(re) = Regex::new(r"T/O:\s*([0-9:zZ]+)") {
        if let Some(caps) = re.captures(&text) {
            data.to_time = caps[1].to_string();
        }
    }
    if let Ok(re) = Regex::new(r"Push:\s*([0-9:zZ]+)") {
        if let Some(caps) = re.captures(&text) {
            data.push_time = caps[1].to_string();
        }
    }
    if let Ok(re) = Regex::new(r"Tgt:\s*([0-9:zZ]+)") {
        if let Some(caps) = re.captures(&text) {
            data.tgt_time = caps[1].to_string();
        }
    }

    // Departure and Arrival from Comm Ladder
    if let Ok(re) = Regex::new(r"Dep Ground:\s*([A-Za-z0-9\s-]+?)\s+Ground") {
        if let Some(caps) = re.captures(&text) {
            data.dep_name = Some(caps[1].trim().to_string());
        }
    } else if let Ok(re) = Regex::new(r"Dep Tower:\s*([A-Za-z0-9\s-]+?)\s+Tower") {
        if let Some(caps) = re.captures(&text) {
            data.dep_name = Some(caps[1].trim().to_string());
        }
    }

    if let Ok(re) = Regex::new(r"Arr Ground:\s*([A-Za-z0-9\s-]+?)\s+Ground") {
        if let Some(caps) = re.captures(&text) {
            data.arr_name = Some(caps[1].trim().to_string());
        }
    } else if let Ok(re) = Regex::new(r"Arr Tower:\s*([A-Za-z0-9\s-]+?)\s+Tower") {
        if let Some(caps) = re.captures(&text) {
            data.arr_name = Some(caps[1].trim().to_string());
        }
    }

    // Alternate Airfield
    if let Ok(re) = Regex::new(r"Alternate airfield:\s*([^\r\n]+)") {
        if let Some(caps) = re.captures(&text) {
            let val = caps[1].trim();
            let low = val.to_lowercase();
            if !low.contains("no alternate") && !low.contains("none") {
                let clean = Regex::new(r"\(.*?\)")
                    .map(|r| r.replace_all(val, "").trim().to_string())
                    .unwrap_or_else(|_| val.to_string());
                data.alt_name = Some(clean);
            }
        }
    }

    // Takeoff and Landing Winds
    if let Ok(re) = Regex::new(r"(?s)Take Off:.*?Wind:\s*(\d+)deg@\s*(\d+)kts") {
        if let Some(caps) = re.captures(&text) {
            data.takeoff_wind_deg = caps[1].parse().unwrap_or(0);
            data.takeoff_wind_kts = caps[2].parse().unwrap_or(0);
        }
    }
    if let Ok(re) = Regex::new(r"(?s)Landing:.*?Wind:\s*(\d+)deg@\s*(\d+)kts") {
        if let Some(caps) = re.captures(&text) {
            data.landing_wind_deg = caps[1].parse().unwrap_or(0);
            data.landing_wind_kts = caps[2].parse().unwrap_or(0);
        }
    }

    // Steerpoints Table
    if let Some(pos) = text.find("Steerpoints:") {
        let after = &text[pos + "Steerpoints:".len()..];
        let end_pos = after.find("Comm Ladder:").or_else(|| after.find("Total Mission Fuel:")).unwrap_or(after.len());
        let stpt_text = &after[..end_pos];

        for line in stpt_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            let cols: Vec<&str> = trimmed.split('\t').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
            if cols.is_empty() {
                continue;
            }
            if let Ok(num) = cols[0].parse::<u32>() {
                let desc = if cols.len() > 1 { cols[1] } else { "--" };
                let time = if cols.len() > 2 { cols[2] } else { "--" };
                let dist = if cols.len() > 3 { cols[3] } else { "--" };
                let head = if cols.len() > 4 { cols[4] } else { "--" };
                let cas = if cols.len() > 5 { cols[5] } else { "--" };
                let alt = if cols.len() > 6 { cols[6] } else { "--" };
                let action = if cols.len() > 7 { cols[7] } else { "--" };
                let form = if cols.len() > 8 { cols[8] } else { "--" };
                let comm = if cols.len() > 9 { cols[9] } else { "--" };

                data.steerpoints.push(Steerpoint {
                    num,
                    desc: desc.to_string(),
                    time: time.to_string(),
                    dist: dist.to_string(),
                    head: head.to_string(),
                    cas: cas.to_string(),
                    alt: alt.to_string(),
                    action: action.to_string(),
                    form: form.to_string(),
                    comm: comm.to_string(),
                    x: 0.0,
                    y: 0.0,
                    z: 0.0,
                    action_code: 0,
                });
            }
        }
    }

    // Surface-to-Air Threats
    if let Some(pos) = text.find("Surface-To-Air Threats:") {
        let after = &text[pos + "Surface-To-Air Threats:".len()..];
        let end_pos = after.find("Steerpoints:").or_else(|| after.find("\n\n")).unwrap_or(after.len());
        let threat_text = &after[..end_pos];

        if let Ok(re_threat) = Regex::new(r"(?i)([A-Za-z0-9\-/\(\)\s]+?)\s*(?:missile launchers|battalion|site)?\s+(\d+(?:\.\d+)?)\s*nm\s+([a-z]+)\s+of\s+([A-Za-z0-9\s-]+)") {
            for line in threat_text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.to_lowercase().contains("no known enemy") {
                    continue;
                }
                if let Some(m) = re_threat.captures(trimmed) {
                    let sys_name = m[1].trim().to_string();
                    let dist_nm: f64 = m[2].parse().unwrap_or(0.0);
                    let direction = m[3].trim().to_lowercase();
                    let place_name = m[4].trim().to_string();
                    data.threats.push(Threat {
                        system: sys_name,
                        dist_nm,
                        dir: direction,
                        place: place_name,
                        raw: trimmed.to_string(),
                        x: 0.0,
                        y: 0.0,
                        range_nm: 8.0,
                    });
                }
            }
        }
    }

    // Comm Ladder Table
    if let Ok(re_comm) = Regex::new(r"(?s)Comm Ladder:\s*\r?\n([\s\S]+?)(?:\r?\n\r?\n[A-Z][A-Za-z\s]+:|\Z)") {
        if let Some(caps) = re_comm.captures(&text) {
            for line in caps[1].lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with("Agency") {
                    continue;
                }
                let cols: Vec<&str> = trimmed.split('\t').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
                if cols.len() >= 4 {
                    data.comm_ladder.push(CommAgency {
                        agency: cols[0].to_string(),
                        callsign: cols[1].to_string(),
                        uhf: cols[2].to_string(),
                        vhf: cols[3].to_string(),
                    });
                }
            }
        }
    }

    Some(data)
}

pub fn parse_callsign_stpts(ini_path: &Path) -> HashMap<u32, TargetSteerpoint> {
    let mut map = HashMap::new();
    if !ini_path.exists() {
        return map;
    }

    if let Ok(bytes) = fs::read(ini_path) {
        let content = String::from_utf8_lossy(&bytes);
        let mut in_stpt = false;
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("[STPT]") {
                in_stpt = true;
                continue;
            } else if trimmed.starts_with('[') && in_stpt {
                break;
            }

            if in_stpt && trimmed.starts_with("target_") {
                let parts: Vec<&str> = trimmed.splitn(2, '=').collect();
                if parts.len() == 2 {
                    let k = parts[0].trim();
                    if let Ok(idx_val) = k.trim_start_matches("target_").parse::<u32>() {
                        let idx = idx_val + 1;
                        let vals: Vec<&str> = parts[1].split(',').map(|s| s.trim()).collect();
                        if vals.len() >= 4 {
                            let x: f64 = vals[0].parse().unwrap_or(0.0);
                            let y: f64 = vals[1].parse().unwrap_or(0.0);
                            let z: f64 = vals[2].parse().unwrap_or(0.0);
                            let action_code: i32 = vals[3].parse().unwrap_or(0);
                            let desc = if vals.len() > 4 { vals[4].to_string() } else { String::new() };

                            map.insert(idx, TargetSteerpoint {
                                x,
                                y,
                                z: -z,
                                action_code,
                                desc,
                            });
                        }
                    }
                }
            }
        }
    }

    map
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_real_briefing() {
        let path = Path::new(r"C:\Games\Falcon BMS 4.38\User\Briefings\briefing.txt");
        if path.exists() {
            let data = parse_briefing(path).expect("Failed to parse briefing");
            assert_eq!(data.callsign, "Satan7");
            assert_eq!(data.dep_name.as_deref(), Some("Sacheon"));
            assert_eq!(data.arr_name.as_deref(), Some("Gimhae"));
            assert_eq!(data.steerpoints.len(), 11);

            let assets = Path::new(r"C:\Users\ygz\Projects\AeroGraph\assets");
            let db = crate::kneeboard::runways::TheaterDatabase::load(assets, "Korea KTO").expect("Failed to load DB");
            let dep_ap = crate::kneeboard::runways::find_airport(&db.airports, data.dep_name.as_deref().unwrap_or(""));
            let arr_ap = crate::kneeboard::runways::find_airport(&db.airports, data.arr_name.as_deref().unwrap_or(""));

            assert!(dep_ap.is_some(), "Sacheon AB should be found in DB");
            assert!(arr_ap.is_some(), "Gimhae Intl Airport should be found in DB");

            let dep_xy = dep_ap.map(|a| (a.x, a.y));
            let arr_xy = arr_ap.map(|a| (a.x, a.y));

            let route = crate::kneeboard::mission_html::compute_mission_route_coords(&data.steerpoints, dep_xy, arr_xy, None);
            assert_eq!(route.len(), 11);
        }
    }
}

