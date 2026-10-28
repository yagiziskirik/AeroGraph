use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum KneeboardPageType {
    /// Briefing Page 1: Flight Roster & Comms Ladder
    BriefingRoster,
    /// Briefing Page 2: Steerpoints Table, Weather Report & Timings
    BriefingSteerpoints,
    /// Static or custom HTML page (e.g. from assets/custom/)
    CustomHtml,
    /// Dynamic Mission Route Overview Map (16k SkyVector Crop + SVG Route)
    MissionRoute,
    /// Dynamic Tactical Target Combat Area Map (Combat Area Zoom + IP Vectors)
    MissionTarget,
    /// Dynamic Departure Airfield Ground Taxi & Runway Diagram
    DepTaxi,
    /// Dynamic Recovery Airfield Ground Taxi & Parking Diagram
    ArrTaxi,
    /// Primary ILS Runway Approach Chart
    ArrIlsPrimary,
    /// Secondary ILS Runway Approach Chart (or fallback blank)
    ArrIlsSecondary,
    /// Intentionally Left Blank Aeronautical Card (preserves readable font size)
    Blank,
    /// User-supplied PNG or JPG image
    Image,
    /// Restore the original texture from Falcon BMS backup
    RestoreOriginal,
    /// Pass-through: Leave the existing texture in BMS completely untouched
    PassThrough,
    /// Pilot mission notes and scratchpad (F-16 POH / Checklist style)
    Notes,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum NotesContent {
    List(Vec<String>),
    Text(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlotConfig {
    #[serde(rename = "type")]
    pub page_type: KneeboardPageType,
    #[serde(default)]
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_num: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stripe_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stripe_colors: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub header_color: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none", alias = "stripe_spacing")]
    pub spaced: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<NotesContent>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl SlotConfig {
    /// Resolves the raw notes text from either inline `notes` or an external `.txt`/`.md` file referenced in `path`.
    pub fn resolve_notes_text(&self, assets_dir: &std::path::Path) -> Option<String> {
        if let Some(ref content) = self.notes {
            match content {
                NotesContent::List(lines) => return Some(lines.join("\n")),
                NotesContent::Text(text) => return Some(text.clone()),
            }
        }

        if let Some(ref path_str) = self.path {
            let p = PathBuf::from(path_str);
            let candidates = [
                p.clone(),
                assets_dir.join(&p),
                assets_dir.join("notes").join(&p),
            ];

            for candidate in &candidates {
                if candidate.exists() {
                    if let Ok(text) = fs::read_to_string(candidate) {
                        return Some(text);
                    }
                }
            }
        }

        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KneeboardLayoutConfig {
    #[serde(default)]
    pub _comment: String,
    pub slots: HashMap<String, SlotConfig>,
}

impl KneeboardLayoutConfig {
    /// Returns default JSON text containing all 32 slots (16L, 16R) formatted with clear descriptions.
    pub fn default_json_string() -> &'static str {
        r#"{
  "_comment": "AeroGraph Kneeboard Slot Configuration. Supports all 32 Falcon BMS slots (F16_1L through F16_16R, textures 7982.dds to 7997.dds). Available types: 'briefing_roster', 'briefing_steerpoints', 'custom_html', 'mission_route', 'mission_target', 'dep_taxi', 'arr_taxi', 'arr_ils_primary', 'arr_ils_secondary', 'blank', 'notes', 'image', 'restore_original', 'pass_through'.",
  "slots": {
    "F16_1L": {
      "type": "briefing_roster",
      "description": "Briefing Page 1: Package Roster & Comms Ladder"
    },
    "F16_1R": {
      "type": "briefing_steerpoints",
      "description": "Briefing Page 2: Steerpoint Navigation Table & Weather Report"
    },
    "F16_2L": {
      "type": "custom_html",
      "path": "custom/kneeboard-checklist-1-start.html",
      "description": "Checklist 1: Engine Start & Systems Check"
    },
    "F16_2R": {
      "type": "custom_html",
      "path": "custom/kneeboard-threats-air.html",
      "description": "Threats Reference: Air-to-Air Threat Guide"
    },
    "F16_3L": {
      "type": "custom_html",
      "path": "custom/kneeboard-checklist-2-taxi-takeoff-land.html",
      "description": "Checklist 2: Taxi, Takeoff & Landing Operations"
    },
    "F16_3R": {
      "type": "custom_html",
      "path": "custom/kneeboard-threats-gnd.html",
      "description": "Threats Reference: Surface-to-Air Missile (SAM) Guide"
    },
    "F16_4L": {
      "type": "custom_html",
      "path": "custom/kneeboard-checklist-3-tacan-aar.html",
      "description": "Checklist 3: TACAN Navigation & Air-to-Air Refueling"
    },
    "F16_4R": {
      "type": "mission_route",
      "description": "Mission Route Overview Map (16k SkyVector Crop & Flight Polyline)"
    },
    "F16_5L": {
      "type": "custom_html",
      "path": "custom/kneeboard-checklist-4-fence.html",
      "description": "Checklist 4: Fence-In / Fence-Out Combat Flow"
    },
    "F16_5R": {
      "type": "mission_target",
      "description": "Tactical Target / Combat Area Map (Combat Area Zoom & IP Profile)"
    },
    "F16_6L": {
      "type": "custom_html",
      "path": "custom/kneeboard-checklist-5-lgb-mav-mark.html",
      "description": "Checklist 5: LGB, Maverick & Mark Point Employment"
    },
    "F16_6R": {
      "type": "dep_taxi",
      "description": "Departure Airfield Ground Taxi & Parking Chart"
    },
    "F16_7L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7988.dds Left texture intact"
    },
    "F16_7R": {
      "type": "arr_ils_primary",
      "description": "Arrival Primary ILS Approach Chart (Runway matched from flight plan)"
    },
    "F16_8L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7989.dds Left texture intact"
    },
    "F16_8R": {
      "type": "arr_ils_secondary",
      "description": "Arrival Secondary ILS Approach Chart (or Intentionally Left Blank)"
    },
    "F16_9L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7990.dds Left texture intact"
    },
    "F16_9R": {
      "type": "arr_taxi",
      "description": "Recovery Airfield Ground Taxi & Parking Chart"
    },
    "F16_10L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7991.dds Left texture intact"
    },
    "F16_10R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7991.dds Right texture intact"
    },
    "F16_11L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7992.dds Left texture intact"
    },
    "F16_11R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7992.dds Right texture intact"
    },
    "F16_12L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7993.dds Left texture intact"
    },
    "F16_12R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7993.dds Right texture intact"
    },
    "F16_13L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7994.dds Left texture intact"
    },
    "F16_13R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7994.dds Right texture intact"
    },
    "F16_14L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7995.dds Left texture intact"
    },
    "F16_14R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7995.dds Right texture intact"
    },
    "F16_15L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7996.dds Left texture intact"
    },
    "F16_15R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7996.dds Right texture intact"
    },
    "F16_16L": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7997.dds Left texture intact"
    },
    "F16_16R": {
      "type": "pass_through",
      "description": "Pass-through: Leave existing BMS 7997.dds Right texture intact"
    }
  }
}"#
    }

    /// Resolves the configuration file location next to current executable or working directory.
    pub fn config_path() -> PathBuf {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let candidate = parent.join("kneeboards.json");
                return candidate;
            }
        }
        PathBuf::from("kneeboards.json")
    }

    /// Loads the configuration. If the file does not exist, generates it with default 32 slots.
    pub fn load_or_create_default() -> Self {
        let path = Self::config_path();
        if !path.exists() {
            log::info!("kneeboards.json not found. Generating default 32-slot configuration at: {:?}", path);
            let default_str = Self::default_json_string();
            let _ = fs::write(&path, default_str);
        }

        if let Ok(content) = fs::read_to_string(&path) {
            match serde_json::from_str::<KneeboardLayoutConfig>(&content) {
                Ok(cfg) => return cfg,
                Err(e) => {
                    log::warn!("Could not parse {:?}: {}. Falling back to default layout.", path, e);
                }
            }
        }

        // In-memory fallback
        serde_json::from_str(Self::default_json_string()).unwrap()
    }

    /// Checks if a given page type is enabled in any slot.
    pub fn has_type(&self, target_type: &KneeboardPageType) -> bool {
        self.slots.values().any(|s| &s.page_type == target_type)
    }

    /// Returns the 16 texture pairs: index (1..=16), filename ("7982.dds"), left_slot ("F16_1L"), right_slot ("F16_1R").
    pub fn texture_pairs() -> &'static [(u32, &'static str, &'static str, &'static str)] {
        &[
            (1, "7982.dds", "F16_1L", "F16_1R"),
            (2, "7983.dds", "F16_2L", "F16_2R"),
            (3, "7984.dds", "F16_3L", "F16_3R"),
            (4, "7985.dds", "F16_4L", "F16_4R"),
            (5, "7986.dds", "F16_5L", "F16_5R"),
            (6, "7987.dds", "F16_6L", "F16_6R"),
            (7, "7988.dds", "F16_7L", "F16_7R"),
            (8, "7989.dds", "F16_8L", "F16_8R"),
            (9, "7990.dds", "F16_9L", "F16_9R"),
            (10, "7991.dds", "F16_10L", "F16_10R"),
            (11, "7992.dds", "F16_11L", "F16_11R"),
            (12, "7993.dds", "F16_12L", "F16_12R"),
            (13, "7994.dds", "F16_13L", "F16_13R"),
            (14, "7995.dds", "F16_14L", "F16_14R"),
            (15, "7996.dds", "F16_15L", "F16_15R"),
            (16, "7997.dds", "F16_16L", "F16_16R"),
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_project_kneeboards_json() {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let json_path = manifest_dir.join("kneeboards.json");
        if json_path.exists() {
            let content = fs::read_to_string(&json_path).expect("Failed to read kneeboards.json");
            let cfg: Result<KneeboardLayoutConfig, _> = serde_json::from_str(&content);
            match cfg {
                Ok(c) => {
                    assert!(c.slots.contains_key("F16_1L"));
                    println!("Successfully parsed kneeboards.json with {} slots", c.slots.len());
                }
                Err(e) => {
                    panic!("Failed to parse kneeboards.json: {}", e);
                }
            }
        }
    }
}
