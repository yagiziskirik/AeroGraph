use crate::kneeboard::models::{
    BriefingData, CommAgency, Steerpoint, TargetSteerpoint, Threat, ThreatKind,
};
use regex::Regex;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub fn parse_briefing(path: &Path) -> Option<BriefingData> {
    if !path.exists() {
        return None;
    }

    let bytes = fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&bytes);
    let mut data = BriefingData::default();

    // Timestamp: e.g. "BRIEFING RECORD generated at 10/26/2026 16:18:56."
    if let Ok(re) = Regex::new(r"BRIEFING RECORD generated at\s+([^\r\n.]+)") {
        if let Some(caps) = re.captures(&text) {
            data.timestamp_str = caps[1].trim().to_string();
        }
    }

    // Pilot Roster table mapping: Callsign -> [Pilot 1, Pilot 2, ...]
    let mut roster_map: HashMap<String, Vec<String>> = HashMap::new();
    if let Some(pos) = text.find("Pilot Roster:") {
        let after = &text[pos + "Pilot Roster:".len()..];
        let end_pos = after.find("Package Elements:").unwrap_or(after.len());
        for line in after[..end_pos].lines() {
            let cols: Vec<&str> = line
                .split('\t')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect();
            if cols.len() >= 2 && !cols[0].starts_with("Callsign") {
                let cs = cols[0].to_string();
                let pilots: Vec<String> = cols[1..].iter().map(|s| s.to_string()).collect();
                roster_map.insert(cs, pilots);
            }
        }
    }

    // Package Elements table: Flights in Package
    if let Some(pos) = text.find("Package Elements:") {
        let after = &text[pos + "Package Elements:".len()..];
        let end_pos = after
            .find("Threat Analysis:")
            .or_else(|| after.find("Steerpoints:"))
            .unwrap_or(after.len());
        let pe_text = &after[..end_pos];

        let mut current_flight: Option<crate::kneeboard::models::PackageFlight> = None;
        let mut flt_idx = 0;

        for line in pe_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("Callsign") {
                continue;
            }
            if trimmed.starts_with("T/O:") {
                if let Some(ref mut flt) = current_flight {
                    for part in trimmed.split('\t') {
                        let p = part.trim();
                        if p.starts_with("T/O:") {
                            flt.to_time = p.trim_start_matches("T/O:").trim().to_string();
                        } else if p.starts_with("Push:") {
                            flt.push_time = p.trim_start_matches("Push:").trim().to_string();
                        } else if p.starts_with("Tgt:") {
                            flt.tgt_time = p.trim_start_matches("Tgt:").trim().to_string();
                        }
                    }
                    data.package_flights.push(flt.clone());
                    current_flight = None;
                }
            } else {
                let cols: Vec<&str> = line
                    .split('\t')
                    .map(|s| s.trim())
                    .filter(|s| !s.is_empty())
                    .collect();
                if cols.len() >= 4 {
                    flt_idx += 1;
                    let cs = cols[0].to_string();
                    let flt_raw = cols[1].to_string();
                    let is_primary = flt_raw.contains("(x") || flt_raw.contains("(X");
                    let flight_num = flt_raw;
                    let role = cols[2].to_string();
                    let aircraft = cols[3].to_string();
                    let task = if cols.len() > 4 {
                        cols[4].to_string()
                    } else {
                        String::new()
                    };
                    let vhf = format!("VHF #{}", 14 + flt_idx);
                    let pilots = roster_map.get(&cs).cloned().unwrap_or_default();

                    current_flight = Some(crate::kneeboard::models::PackageFlight {
                        callsign: cs,
                        flight_num,
                        is_primary,
                        role,
                        aircraft,
                        task,
                        to_time: "--".to_string(),
                        push_time: "--".to_string(),
                        tgt_time: "--".to_string(),
                        vhf,
                        pilots,
                        laser_tacan: Vec::new(),
                    });
                }
            }
        }
        if let Some(flt) = current_flight {
            data.package_flights.push(flt);
        }
    }

    // Weather section: Situation, Wind, Visibility, Temp, Cloud Base, Con Layer
    if let Some(pos) = text.find("Weather:") {
        let after = &text[pos + "Weather:".len()..];
        let end_pos = after
            .find("Support:")
            .or_else(|| after.find("\n\n\n"))
            .unwrap_or(after.len());
        let w_text = &after[..end_pos];

        let mut w = crate::kneeboard::models::WeatherReport::default();
        for line in w_text.lines() {
            let cols: Vec<&str> = line
                .split('\t')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect();
            if cols.len() >= 4 {
                let param = cols[0].to_lowercase();
                if param.starts_with("situation") {
                    w.to_situation = cols[1].to_string();
                    w.tgt_situation = cols[2].to_string();
                    w.lnd_situation = cols[3].to_string();
                } else if param.starts_with("wind") {
                    w.to_wind = cols[1].to_string();
                    w.tgt_wind = cols[2].to_string();
                    w.lnd_wind = cols[3].to_string();
                } else if param.starts_with("visibility") {
                    w.to_visibility = cols[1].to_string();
                    w.tgt_visibility = cols[2].to_string();
                    w.lnd_visibility = cols[3].to_string();
                } else if param.starts_with("temp") {
                    w.to_temp = cols[1].to_string();
                    w.tgt_temp = cols[2].to_string();
                    w.lnd_temp = cols[3].to_string();
                } else if param.starts_with("cloud base") {
                    w.to_cloud_base = cols[1].to_string();
                    w.tgt_cloud_base = cols[2].to_string();
                    w.lnd_cloud_base = cols[3].to_string();
                } else if param.starts_with("con layer") {
                    w.to_con_layer = cols[1].to_string();
                    w.tgt_con_layer = cols[2].to_string();
                    w.lnd_con_layer = cols[3].to_string();
                }
            }
        }
        data.weather = Some(w);
    }

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
    if let Ok(re) = Regex::new(
        r"([A-Za-z0-9_-]+)\s+\d+\s*\([xX\s]*\)\s+([A-Za-z0-9_-]+)\s+([0-9\sA-Za-z-]+?)\s{2,}([^\r\n]+)",
    ) {
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
        let end_pos = after
            .find("Comm Ladder:")
            .or_else(|| after.find("Total Mission Fuel:"))
            .unwrap_or(after.len());
        let stpt_text = &after[..end_pos];

        for line in stpt_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }
            let cols: Vec<&str> = trimmed
                .split('\t')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect();
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
        let end_pos = after
            .find("Steerpoints:")
            .or_else(|| after.find("\n\n"))
            .unwrap_or(after.len());
        let threat_text = &after[..end_pos];

        if let Ok(re_threat) = Regex::new(
            r"(?i)(?:--\s*)?([A-Za-z0-9\-/\(\)\s]+?)\s*(?:missile launchers|battalion|site)?\s+(\d+(?:\.\d+)?)\s*(?:nm|km)\s+([a-z]+)\s+of\s+([A-Za-z0-9\s'-]+)",
        ) {
            for line in threat_text.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.to_lowercase().contains("no known enemy") {
                    continue;
                }
                if let Some(m) = re_threat.captures(trimmed) {
                    let sys_name = m[1].trim().trim_start_matches('-').trim().to_string();
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
                        kind: ThreatKind::Sam,
                    });
                }
            }
        }
    }

    // Comm Ladder Table
    if let Some(pos) = text.find("Comm Ladder:") {
        let after = &text[pos + "Comm Ladder:".len()..];
        let end_pos = after
            .find("\nIff")
            .or_else(|| after.find("\r\nIff"))
            .or_else(|| after.find("\nLink 16"))
            .unwrap_or(after.len());
        let comm_text = &after[..end_pos];

        for line in comm_text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with("Agency") {
                continue;
            }
            let cols: Vec<&str> = trimmed
                .split('\t')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .collect();
            if cols.len() >= 4 {
                let agency = cols[0].trim_end_matches(':').to_string();
                let cs = cols[1].to_string();
                let uhf = cols[2].to_string();
                let vhf = cols[3].to_string();
                data.comm_ladder.push(CommAgency {
                    agency,
                    callsign: cs,
                    uhf,
                    vhf,
                });
            }
        }
    }

    // Link 16 Network Parameters
    if let Some(pos) = text.find("Link 16") {
        let l16_text = &text[pos..];
        if let Ok(re_mission) = Regex::new(r"Mission:\s*(\d+)") {
            if let Some(caps) = re_mission.captures(l16_text) {
                data.link16_mission_channel = Some(caps[1].trim().to_string());
            }
        }
        if let Ok(re_stn) = Regex::new(r"Flight\s+(\d+)") {
            if let Some(caps) = re_stn.captures(l16_text) {
                data.link16_flight_stn = Some(caps[1].trim().to_string());
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
                            let desc = if vals.len() > 4 {
                                vals[4].to_string()
                            } else {
                                String::new()
                            };

                            map.insert(
                                idx,
                                TargetSteerpoint {
                                    x,
                                    y,
                                    z: -z,
                                    action_code,
                                    desc,
                                },
                            );
                        }
                    }
                }
            }
        }
    }

    map
}

pub fn parse_dtc_ppts_content(
    content: &str,
    expected_mission_channel: Option<&str>,
    expected_flight_stn: Option<&str>,
) -> Option<Vec<Threat>> {
    let mut in_link16 = false;
    let mut file_a_mission: Option<String> = None;
    let mut file_a_stn: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[LINK16]") {
            in_link16 = true;
            continue;
        } else if trimmed.starts_with('[') && in_link16 {
            break;
        }

        if in_link16 {
            if let Some((k, v)) = trimmed.split_once('=') {
                let key = k.trim();
                let val = v.trim();
                if key.eq_ignore_ascii_case("FILE_A_MISSION_CHANNEL") {
                    file_a_mission = Some(val.to_string());
                } else if key.eq_ignore_ascii_case("FILE_A_FLIGHT_1_STN") {
                    file_a_stn = Some(val.to_string());
                }
            }
        }
    }

    let mut verified = false;
    if let (Some(exp_m), Some(m)) = (expected_mission_channel, &file_a_mission) {
        if !exp_m.is_empty() && exp_m.trim().eq_ignore_ascii_case(m.trim()) {
            verified = true;
        }
    }
    if !verified {
        if let (Some(exp_s), Some(s)) = (expected_flight_stn, &file_a_stn) {
            if !exp_s.is_empty() && exp_s.trim().eq_ignore_ascii_case(s.trim()) {
                verified = true;
            }
        }
    }

    if !verified {
        return None;
    }

    let mut in_stpt = false;
    let mut threats = Vec::new();
    const NM_TO_FT: f64 = 6076.12;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[STPT]") {
            in_stpt = true;
            continue;
        } else if trimmed.starts_with('[') && in_stpt {
            break;
        }

        if in_stpt && trimmed.starts_with("ppt_") {
            if let Some((_, v)) = trimmed.split_once('=') {
                let vals: Vec<&str> = v.split(',').map(|s| s.trim()).collect();
                if vals.len() >= 5 {
                    let x: f64 = vals[0].parse().unwrap_or(0.0);
                    let y: f64 = vals[1].parse().unwrap_or(0.0);
                    let radius_ft: f64 = vals[3].parse().unwrap_or(0.0);
                    let label = vals[4].trim();

                    if x == 0.0 && y == 0.0 {
                        continue;
                    }

                    let upper_label = label.to_uppercase();
                    let (kind, system, range_nm) =
                        if upper_label.contains("TNK") || upper_label.contains("TANK") {
                            let r = if radius_ft <= 0.1 * NM_TO_FT {
                                10.0
                            } else {
                                radius_ft / NM_TO_FT
                            };
                            (ThreatKind::Tanker, label.to_string(), r)
                        } else if upper_label.contains("AWC") || upper_label.contains("AWAC") {
                            let r = if radius_ft <= 0.1 * NM_TO_FT {
                                15.0
                            } else {
                                radius_ft / NM_TO_FT
                            };
                            (ThreatKind::Awacs, label.to_string(), r)
                        } else {
                            let sys =
                                if label.chars().all(|c| c.is_ascii_digit()) && !label.is_empty() {
                                    format!("SA-{}", label)
                                } else {
                                    label.to_string()
                                };
                            let r = if radius_ft <= 0.1 * NM_TO_FT {
                                8.0
                            } else {
                                radius_ft / NM_TO_FT
                            };
                            (ThreatKind::Sam, sys, r)
                        };

                    threats.push(Threat {
                        system,
                        dist_nm: 0.0,
                        dir: String::new(),
                        place: String::new(),
                        raw: format!("PPT: {}", label),
                        x,
                        y,
                        range_nm,
                        kind,
                    });
                }
            }
        }
    }

    if threats.is_empty() {
        None
    } else {
        Some(threats)
    }
}

pub fn parse_dtc_ppts(
    ini_path: &Path,
    expected_mission_channel: Option<&str>,
    expected_flight_stn: Option<&str>,
) -> Option<Vec<Threat>> {
    if !ini_path.exists() {
        return None;
    }
    let bytes = fs::read(ini_path).ok()?;
    let content = String::from_utf8_lossy(&bytes);
    parse_dtc_ppts_content(&content, expected_mission_channel, expected_flight_stn)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_parse_link16_synthetic() {
        let sample =
            "Link 16:\nMission:\t125\tFlight 56741\tCallsign:\tFN\tNumber:\t11\nVoice 1:\t125\n";
        let mut data = BriefingData::default();
        if let Some(pos) = sample.find("Link 16") {
            let l16_text = &sample[pos..];
            if let Ok(re_mission) = Regex::new(r"Mission:\s*(\d+)") {
                if let Some(caps) = re_mission.captures(l16_text) {
                    data.link16_mission_channel = Some(caps[1].trim().to_string());
                }
            }
            if let Ok(re_stn) = Regex::new(r"Flight\s+(\d+)") {
                if let Some(caps) = re_stn.captures(l16_text) {
                    data.link16_flight_stn = Some(caps[1].trim().to_string());
                }
            }
        }
        assert_eq!(data.link16_mission_channel.as_deref(), Some("125"));
        assert_eq!(data.link16_flight_stn.as_deref(), Some("56741"));
    }

    #[test]
    fn test_parse_dtc_ppts_content_success() {
        let ini_content = r#"
[LINK16]
FILE_A_MISSION_CHANNEL=125
FILE_A_FLIGHT_1_STN=56741

[STPT]
ppt_0=1638521.5, 1234546.5, 0.0, 145826.78, 17
ppt_1=1546570.3, 1300195.1, 0.0, 121522.31, 11
ppt_2=1500786.0, 1201535.8, 0.0, 121522.31, 11
ppt_3=1400000.0, 1100000.0, 0.0, 60761.2, TNK
ppt_4=0.0, 0.0, 0.0, 0.0, 0
"#;
        let threats =
            parse_dtc_ppts_content(ini_content, Some("125"), None).expect("Expected valid PPTs");
        assert_eq!(threats.len(), 4);
        assert_eq!(threats[0].system, "SA-17");
        assert_eq!(threats[0].kind, ThreatKind::Sam);
        assert!((threats[0].range_nm - 24.0).abs() < 0.1);

        assert_eq!(threats[1].system, "SA-11");
        assert_eq!(threats[1].kind, ThreatKind::Sam);
        assert!((threats[1].range_nm - 20.0).abs() < 0.1);

        assert_eq!(threats[2].system, "SA-11");
        assert_eq!(threats[2].kind, ThreatKind::Sam);

        assert_eq!(threats[3].system, "TNK");
        assert_eq!(threats[3].kind, ThreatKind::Tanker);
        assert!((threats[3].range_nm - 10.0).abs() < 0.1);
    }

    #[test]
    fn test_parse_dtc_ppts_content_mismatch_fallback() {
        let ini_content = r#"
[LINK16]
FILE_A_MISSION_CHANNEL=125
FILE_A_FLIGHT_1_STN=56741

[STPT]
ppt_0=1638521.5, 1234546.5, 0.0, 145826.78, 17
"#;
        let threats = parse_dtc_ppts_content(ini_content, Some("999"), Some("00000"));
        assert!(
            threats.is_none(),
            "Should fall back to None when Link 16 does not match"
        );
    }

    #[test]
    fn test_threat_regex_with_apostrophe() {
        let re_threat = Regex::new(
            r"(?i)(?:--\s*)?([A-Za-z0-9\-/\(\)\s]+?)\s*(?:missile launchers|battalion|site)?\s+(\d+(?:\.\d+)?)\s*(?:nm|km)\s+([a-z]+)\s+of\s+([A-Za-z0-9\s'-]+)"
        ).unwrap();
        let sample = "-- SA-11 (9K37M1)missile launchers 1 nm west of Hanjong-ni's Town";
        let caps = re_threat
            .captures(sample)
            .expect("Regex should match place with apostrophe");
        assert_eq!(caps[1].trim(), "SA-11 (9K37M1)");
        assert_eq!(caps[2].trim(), "1");
        assert_eq!(caps[3].trim(), "west");
        assert_eq!(caps[4].trim(), "Hanjong-ni's Town");
    }

    #[test]
    fn test_parse_real_briefing() {
        let path = Path::new(r"C:\Games\Falcon BMS 4.38\User\Briefings\briefing.txt");
        if path.exists() {
            let data = parse_briefing(path).expect("Failed to parse briefing");
            assert!(!data.callsign.is_empty(), "Callsign should not be empty");
            assert!(
                data.dep_name.is_some(),
                "Departure airfield should be present"
            );
            assert!(
                data.arr_name.is_some(),
                "Arrival airfield should be present"
            );
            assert!(
                !data.steerpoints.is_empty(),
                "Steerpoints should not be empty"
            );

            let assets = crate::config::AppConfig::find_assets_dir();
            let db = crate::kneeboard::runways::TheaterDatabase::load(&assets, "Korea KTO")
                .expect("Failed to load DB");
            let dep_ap = crate::kneeboard::runways::find_airport(
                &db.airports,
                data.dep_name.as_deref().unwrap_or(""),
            );
            let arr_ap = crate::kneeboard::runways::find_airport(
                &db.airports,
                data.arr_name.as_deref().unwrap_or(""),
            );

            assert!(dep_ap.is_some(), "Departure airfield should be found in DB");
            assert!(arr_ap.is_some(), "Arrival airfield should be found in DB");

            let dep_xy = dep_ap.map(|a| (a.x, a.y));
            let arr_xy = arr_ap.map(|a| (a.x, a.y));

            let route = crate::kneeboard::mission_html::compute_mission_route_coords(
                &data.steerpoints,
                dep_xy,
                arr_xy,
                None,
            );
            assert_eq!(route.len(), data.steerpoints.len());
            // Target steerpoint (Grnd Attack) must have action_code 20
            let tgt = route.iter().find(|p| p.action_code == 20);
            assert!(
                tgt.is_some(),
                "Should find target steerpoint with action_code 20"
            );
            let tgt_p = tgt.unwrap();
            assert_eq!(tgt_p.num, 7, "Target should be STPT 7 (Grnd Attack)");
            // IP steerpoint must have action_code 13
            let ip = route.iter().find(|p| p.action_code == 13);
            assert!(
                ip.is_some(),
                "Should find IP steerpoint with action_code 13"
            );
            assert_eq!(ip.unwrap().num, 6, "IP should be STPT 6 (IP)");
        }
    }
}
