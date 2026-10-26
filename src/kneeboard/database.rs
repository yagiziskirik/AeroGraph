use std::collections::HashMap;
use std::fs;
use std::path::Path;
use super::models::Airport;

pub struct TheaterEntry {
    pub id: String,
    pub name: String,
    pub map_id: String,
    pub size_ft: f64,
    pub airport_set: String,
    pub airfield_set: String,
}

pub fn load_theater_database(
    data_dir: &Path,
    theater_id: &str,
) -> Result<(Vec<Airport>, HashMap<String, String>, serde_json::Value, TheaterEntry), String> {
    let index_file = data_dir.join("index.json");
    if !index_file.exists() {
        return Err(format!("index.json not found at {:?}", index_file));
    }

    let index_content = fs::read_to_string(&index_file).map_err(|e| e.to_string())?;
    let idx: serde_json::Value = serde_json::from_str(&index_content).map_err(|e| e.to_string())?;

    let theaters = idx.get("theaters").and_then(|v| v.as_array()).ok_or("No theaters in index.json")?;
    let th_obj = theaters.iter().find(|t| {
        t.get("id").and_then(|v| v.as_str()).map(|s| s == theater_id).unwrap_or(false)
    }).unwrap_or_else(|| &theaters[0]);

    let th_entry = TheaterEntry {
        id: th_obj.get("id").and_then(|v| v.as_str()).unwrap_or("korea-kto").to_string(),
        name: th_obj.get("name").and_then(|v| v.as_str()).unwrap_or("Korea KTO").to_string(),
        map_id: th_obj.get("mapId").and_then(|v| v.as_str()).unwrap_or("korea").to_string(),
        size_ft: th_obj.get("sizeFt").and_then(|v| v.as_f64()).unwrap_or(3358700.0),
        airport_set: th_obj.get("airportSet").and_then(|v| v.as_str()).unwrap_or("korea").to_string(),
        airfield_set: th_obj.get("airfieldSet").and_then(|v| v.as_str()).unwrap_or("korea").to_string(),
    };

    let ap_file = data_dir.join("airports").join(format!("{}.json", th_entry.airport_set));
    let mut airports: Vec<Airport> = Vec::new();
    if ap_file.exists() {
        if let Ok(content) = fs::read_to_string(&ap_file) {
            if let Ok(ap_data) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(list) = ap_data.get("airports") {
                    if let Ok(parsed) = serde_json::from_value(list.clone()) {
                        airports = parsed;
                    }
                }
            }
        }
    }

    let ai_file = data_dir.join("airfields").join(format!("{}.json", th_entry.airfield_set));
    let mut airfield_map: HashMap<String, String> = HashMap::new();
    if ai_file.exists() {
        if let Ok(content) = fs::read_to_string(&ai_file) {
            if let Ok(parsed) = serde_json::from_str::<HashMap<String, String>>(&content) {
                airfield_map = parsed;
            }
        }
    }

    let charts_file = data_dir.join("charts.json");
    let mut charts_index = serde_json::Value::Null;
    if charts_file.exists() {
        if let Ok(content) = fs::read_to_string(&charts_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                charts_index = json.get(&th_entry.airport_set).cloned().unwrap_or(serde_json::Value::Null);
            }
        }
    }

    Ok((airports, airfield_map, charts_index, th_entry))
}

const AIRPORT_ALIASES: &[(&str, &str)] = &[
    ("kunsan", "gunsan"),
    ("taegu", "daegu"),
    ("kimhae", "gimhae"),
    ("kwangju", "gwangju"),
    ("pusan", "gimhae"),
    ("kangnung", "gangneung"),
    ("chongju", "cheongju"),
];

pub fn find_airport<'a>(airports: &'a [Airport], query: &str) -> Option<&'a Airport> {
    if query.trim().is_empty() {
        return None;
    }
    let mut q = query.to_lowercase().trim().to_string();
    for (alias, real) in AIRPORT_ALIASES {
        if q == *alias {
            q = real.to_string();
            break;
        }
    }

    for ap in airports {
        let name = ap.name.to_lowercase();
        let full = ap.full_name.as_deref().unwrap_or("").to_lowercase();
        let icao = ap.icao.as_deref().unwrap_or("").to_lowercase();
        if q == icao || q == name || q == full {
            return Some(ap);
        }
    }

    for ap in airports {
        let name = ap.name.to_lowercase();
        let full = ap.full_name.as_deref().unwrap_or("").to_lowercase();
        if name.contains(&q) || full.contains(&q) {
            return Some(ap);
        }
    }

    None
}

pub fn load_airfield_model(data_dir: &Path, airfield_map: &HashMap<String, String>, airport_id: &serde_json::Value) -> Option<serde_json::Value> {
    let id_str = match airport_id {
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::String(s) => s.clone(),
        _ => return None,
    };

    let af_id = airfield_map.get(&id_str)?;
    let af_file = data_dir.join("airfields").join(format!("{}.json", af_id));
    if !af_file.exists() {
        return None;
    }

    let content = fs::read_to_string(&af_file).ok()?;
    serde_json::from_str(&content).ok()
}
