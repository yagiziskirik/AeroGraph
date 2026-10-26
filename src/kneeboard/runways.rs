use std::collections::HashMap;
use std::fs;
use std::path::Path;
use crate::kneeboard::models::{ActiveRunway, Airport};

pub fn map_theater_id(cur_theater: &str) -> &'static str {
    match cur_theater {
        "Korea KTO" => "korea-kto",
        "Balkans" => "balkans",
        "EF2000 BTO" => "ef2000-bto",
        "Falklands" => "falklands",
        "Hellas" => "hellas",
        "Israel" => "israel",
        _ => "korea-kto",
    }
}

pub struct TheaterDatabase {
    pub airports: Vec<Airport>,
    pub airfield_map: HashMap<String, String>,
    pub charts_index: HashMap<String, Vec<serde_json::Value>>,
    pub theater_entry: serde_json::Value,
}

impl TheaterDatabase {
    pub fn load(assets_dir: &Path, theater_name: &str) -> Option<Self> {
        let index_path = assets_dir.join("data").join("index.json");
        if !index_path.exists() {
            return None;
        }

        let idx_content = fs::read_to_string(&index_path).ok()?;
        let idx_val: serde_json::Value = serde_json::from_str(&idx_content).ok()?;

        let th_id = map_theater_id(theater_name);
        let th_entry = idx_val.get("theaters")
            .and_then(|t| t.as_array())
            .and_then(|arr| arr.iter().find(|t| t.get("id").and_then(|id| id.as_str()) == Some(th_id)).cloned())
            .unwrap_or_else(|| {
                idx_val.get("theaters")
                    .and_then(|t| t.as_array())
                    .and_then(|arr| arr.first().cloned())
                    .unwrap_or_default()
            });

        let ap_set_id = th_entry.get("airportSet").and_then(|s| s.as_str()).unwrap_or("");
        let ai_set_id = th_entry.get("airfieldSet").and_then(|s| s.as_str()).unwrap_or("");

        let mut airports = Vec::new();
        let ap_file = assets_dir.join("data").join("airports").join(format!("{}.json", ap_set_id));
        if ap_file.exists() {
            if let Ok(ap_text) = fs::read_to_string(&ap_file) {
                if let Ok(ap_json) = serde_json::from_str::<serde_json::Value>(&ap_text) {
                    if let Some(list) = ap_json.get("airports").and_then(|a| a.as_array()) {
                        for item in list {
                            if let Ok(ap) = serde_json::from_value::<Airport>(item.clone()) {
                                airports.push(ap);
                            }
                        }
                    }
                }
            }
        }

        let mut airfield_map = HashMap::new();
        let ai_file = assets_dir.join("data").join("airfields").join(format!("{}.json", ai_set_id));
        if ai_file.exists() {
            if let Ok(ai_text) = fs::read_to_string(&ai_file) {
                if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&ai_text) {
                    airfield_map = map;
                }
            }
        }

        let mut charts_index = HashMap::new();
        let charts_file = assets_dir.join("data").join("charts.json");
        if charts_file.exists() {
            if let Ok(c_text) = fs::read_to_string(&charts_file) {
                if let Ok(c_val) = serde_json::from_str::<serde_json::Value>(&c_text) {
                    if let Some(set_obj) = c_val.get(ap_set_id).and_then(|o| o.as_object()) {
                        for (k, v) in set_obj {
                            if let Some(arr) = v.as_array() {
                                charts_index.insert(k.clone(), arr.clone());
                            }
                        }
                    }
                }
            }
        }

        Some(Self {
            airports,
            airfield_map,
            charts_index,
            theater_entry: th_entry,
        })
    }

    pub fn load_airfield_model(&self, assets_dir: &Path, airport_id: &serde_json::Value) -> Option<serde_json::Value> {
        let id_str = match airport_id {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => return None,
        };
        let af_id = self.airfield_map.get(&id_str)?;
        let af_file = assets_dir.join("data").join("airfields").join(format!("{}.json", af_id));
        if !af_file.exists() {
            return None;
        }
        let content = fs::read_to_string(af_file).ok()?;
        serde_json::from_str(&content).ok()
    }
}

pub fn find_airport<'a>(airports: &'a [Airport], query: &str) -> Option<&'a Airport> {
    if query.trim().is_empty() {
        return None;
    }
    let mut q = query.trim().to_lowercase();

    // Map common Falcon BMS airport aliases
    match q.as_str() {
        "kunsan" => q = "gunsan".to_string(),
        "taegu" => q = "daegu".to_string(),
        "kimhae" | "pusan" => q = "gimhae".to_string(),
        "kwangju" => q = "gwangju".to_string(),
        "kangnung" => q = "gangneung".to_string(),
        "chongju" => q = "cheongju".to_string(),
        _ => {}
    }

    // Exact match: ICAO, name, or fullName
    for ap in airports {
        let name_low = ap.name.to_lowercase();
        let full_low = ap.full_name.as_deref().unwrap_or("").to_lowercase();
        let icao_low = ap.icao.as_deref().unwrap_or("").to_lowercase();

        if q == icao_low || q == name_low || q == full_low {
            return Some(ap);
        }
    }

    // Substring match
    for ap in airports {
        let name_low = ap.name.to_lowercase();
        let full_low = ap.full_name.as_deref().unwrap_or("").to_lowercase();

        if name_low.contains(&q) || full_low.contains(&q) {
            return Some(ap);
        }
    }

    None
}

pub fn calculate_active_runways(airport: &Airport, wind_deg: i32, wind_kts: i32) -> Vec<ActiveRunway> {
    let mut candidates = Vec::new();
    let _wind_rad = (wind_deg as f64).to_radians();

    for rwy in &airport.runways {
        for end in &rwy.ends {
            let course = end.heading_true;
            let diff = ((wind_deg as f64 - course + 180.0).rem_euclid(360.0)) - 180.0;
            let diff_rad = diff.to_radians();
            let headwind = (wind_kts as f64) * diff_rad.cos();
            let crosswind = (wind_kts as f64) * diff_rad.sin();
            let has_ils = end.ils.is_some();

            candidates.push(ActiveRunway {
                designator: end.designator.clone(),
                course,
                headwind,
                crosswind,
                diff: diff.abs(),
                has_ils,
                end_obj: end.clone(),
                rwy_obj: rwy.clone(),
            });
        }
    }

    candidates.sort_by(|a, b| b.headwind.partial_cmp(&a.headwind).unwrap_or(std::cmp::Ordering::Equal));

    if candidates.is_empty() {
        return Vec::new();
    }

    let best = candidates[0].clone();
    let mut active = vec![best.clone()];

    for c in candidates.iter().skip(1) {
        let angle_diff = ((c.course - best.course + 180.0).rem_euclid(360.0) - 180.0).abs();
        if angle_diff <= 30.0 && c.headwind > -2.0 {
            active.push(c.clone());
        }
    }

    active
}
