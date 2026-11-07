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
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        alias = "stripe_spacing"
    )]
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
            let mut candidates = vec![
                p.clone(),
                assets_dir.join(&p),
                assets_dir.join("notes").join(&p),
            ];
            if let Some(parent) = assets_dir.parent() {
                candidates.push(parent.join(&p));
                candidates.push(parent.join("notes").join(&p));
            }

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
        r####"{
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
      "type": "notes",
      "title": "PILOT MISSION SCRATCHPAD",
      "subtitle": "EDIT IN KNEEBOARDS.JSON • TRAY -> EDIT KNEEBOARDS",
      "header_code": "T.O. BMS1F-16CM-1 // SPINS",
      "page_num": "SPINS-1",
      "preset": "caution",
      "spaced": false,
      "notes": [
        "## 1. PRE-FLIGHT & UFC SETUP",
        "[x] INS Alignment verified & UFC DED set",
        "[x] Bullseye loaded: {blue: 045 / 60NM}",
        "[ ] Master Arm {yellow: ARM} at STPT 4 (Fence In)",
        "[ ] Laser Arm {green: ON} prior to 5nm to Target",
        "",
        "BULLSEYE: {blue: 045 / 60NM}",
        "PACKAGE VHF: {blue: 138.250}",
        "TACTICAL UHF: {blue: 254.000}",
        "RAMROD CODE: {blue: CHARLIE}",
        "PRIMARY LASER: {green: 1688}",
        "",
        "## 2. BVR RULES OF ENGAGEMENT (ROE)",
        "- Hostile: 2x sensor confirm or AWACS 'HOT/HOSTILE'",
        "- Weapons Free beyond {green: 25nm} from Bullseye 045/60",
        "- Minimum Abort Range (MAR): {red: 12nm} mandatory egress",
        "",
        "WARNING: {highlight: Active SA-10 Grumble} tracking near STPT 6",
        "CAUTION: Maintain minimum 18,000 FT MSL until IP ingress",
        "",
        "## 3. PILOT REMARKS / CUSTOM NOTES",
        "- Right-click AeroGraph tray icon and select 'Edit Kneeboards'",
        "- Edit this slot (F16_7L) to customize your flight notes"
      ]
    },
    "F16_7R": {
      "type": "arr_ils_primary",
      "description": "Arrival Primary ILS Approach Chart (Runway matched from flight plan)"
    },
    "F16_8L": {
      "type": "notes",
      "title": "FUEL REGIMES, BINGO & HOLDING",
      "header_code": "T.O. 1F-16CM-1 // FUEL-OPS",
      "page_num": "FUEL-1",
      "preset": "standard",
      "path": "notes/fuel_planning.md"
    },
    "F16_8R": {
      "type": "arr_ils_secondary",
      "description": "Arrival Secondary ILS Approach Chart (or Intentionally Left Blank)"
    },
    "F16_9L": {
      "type": "notes",
      "title": "A/A MISSILES & BVR TIMELINES",
      "header_code": "T.O. 1F-16CM-34-1-1 // A-A BVR",
      "page_num": "A/A-1",
      "preset": "tactical",
      "path": "notes/aa_missiles.md"
    },
    "F16_9R": {
      "type": "arr_taxi",
      "description": "Recovery Airfield Ground Taxi & Parking Chart"
    },
    "F16_10L": {
      "type": "notes",
      "title": "A/G PRECISION GUIDED MUNITIONS",
      "header_code": "T.O. 1F-16CM-34-1-2 // PGM STRIKE",
      "page_num": "PGM-1",
      "preset": "caution",
      "spaced": false,
      "path": "notes/ag_precision.md"
    },
    "F16_10R": {
      "type": "notes",
      "title": "RWR THREAT MATRIX & CMS PROGRAMS",
      "header_code": "T.O. 1F-16CM-34-1-3 // RWR THREATS",
      "page_num": "RWR-1",
      "preset": "caution",
      "spaced": false,
      "path": "notes/rwr_countermeasures.md"
    },
    "F16_11L": {
      "type": "notes",
      "title": "A/G BALLISTIC ORDNANCE & STRAFE",
      "header_code": "T.O. 1F-16CM-34-1-1 // BALLISTICS",
      "page_num": "BALL-1",
      "preset": "caution",
      "spaced": false,
      "path": "notes/ag_ballistic.md"
    },
    "F16_11R": {
      "type": "notes",
      "title": "CRITICAL PILOT FAULT LIST (PFL)",
      "header_code": "T.O. 1F-16CM-1CL-1 // PFL FAULTS",
      "page_num": "PFL-1",
      "preset": "warning",
      "spaced": false,
      "path": "notes/pfl_fault_actions.md"
    },
    "F16_12L": {
      "type": "notes",
      "title": "SEAD / HARM PROFILES & ALIC CODES",
      "header_code": "T.O. 1F-16CM-34-1-4 // SEAD HARM",
      "page_num": "SEAD-1",
      "preset": "caution",
      "spaced": false,
      "path": "notes/sead_harm.md"
    },
    "F16_12R": {
      "type": "notes",
      "title": "HYDRAULIC FAILURE & ALT GEAR",
      "header_code": "T.O. 1F-16CM-1CL-2 // HYD-GEAR",
      "page_num": "HYD-1",
      "preset": "warning",
      "spaced": false,
      "path": "notes/ep_hydraulics.md"
    },
    "F16_13L": {
      "type": "notes",
      "title": "AIRFRAME & CROSSWIND LIMITATIONS",
      "header_code": "T.O. 1F-16CM-1 // AIRFRAME LIMITS",
      "page_num": "LIMITS-1",
      "preset": "standard",
      "path": "notes/airframe_limits.md"
    },
    "F16_13R": {
      "type": "notes",
      "title": "THEATER DIVERT AIRFIELDS DIRECTORY",
      "header_code": "FLIGHT INFO PUB // THEATER DIVERT",
      "page_num": "DIVERT-1",
      "preset": "standard",
      "path": "notes/divert_airfields.md"
    },
    "F16_14L": {
      "type": "notes",
      "title": "APPROACH SPEEDS & OVERHEAD BREAK",
      "header_code": "T.O. 1F-16CM-1 // APPROACH & BREAK",
      "page_num": "APP-1",
      "preset": "standard",
      "path": "notes/approach_speeds.md"
    },
    "F16_14R": {
      "type": "notes",
      "title": "INSTRUMENT HOLDING & MISSED APP",
      "header_code": "FLIGHT INFO PUB // IFR RECOVERY",
      "page_num": "IFR-1",
      "preset": "standard",
      "path": "notes/ifr_holding.md"
    },
    "F16_15L": {
      "type": "notes",
      "title": "LASER CODES & COMMS LADDER",
      "header_code": "T.O. 1F-16CM-1 // COMMS & LASER",
      "page_num": "COMMS-1",
      "preset": "standard",
      "path": "notes/comms_laser_matrix.md"
    },
    "F16_15R": {
      "type": "notes",
      "title": "ENGINE FLAMEOUT & SFO PROFILE",
      "header_code": "T.O. 1F-16CM-1CL-1 // EP FLAMEOUT",
      "page_num": "EP-1",
      "preset": "emergency",
      "path": "notes/ep_flameout.md"
    },
    "F16_16L": {
      "type": "blank",
      "description": "Intentionally left blank"
    },
    "F16_16R": {
      "type": "blank",
      "description": "Intentionally left blank"
    }
  }
}"####
    }

    /// Resolves the configuration file location in application root directory.
    pub fn config_path() -> PathBuf {
        let app_dir = crate::config::AppConfig::app_root_dir();
        let app_candidate = app_dir.join("kneeboards.json");
        if app_candidate.exists() {
            return app_candidate;
        }

        let cwd_candidate = PathBuf::from("kneeboards.json");
        if cwd_candidate.exists() {
            return cwd_candidate;
        }

        app_candidate
    }

    /// Returns the authentic default 32-slot configuration directly from built-in template, ignoring disk.
    pub fn create_default() -> Self {
        serde_json::from_str(Self::default_json_string()).unwrap()
    }

    /// Loads the configuration. If the file does not exist, generates it with default 32 slots.
    pub fn load_or_create_default() -> Self {
        let path = Self::config_path();
        if !path.exists() {
            log::info!(
                "kneeboards.json not found. Generating default 32-slot configuration at: {:?}",
                path
            );
            let default_str = Self::default_json_string();
            let _ = fs::write(&path, default_str);
        }

        if let Ok(content) = fs::read_to_string(&path) {
            match serde_json::from_str::<KneeboardLayoutConfig>(&content) {
                Ok(cfg) => return cfg,
                Err(e) => {
                    log::warn!(
                        "Could not parse {:?}: {}. Falling back to default layout.",
                        path,
                        e
                    );
                }
            }
        }

        // In-memory fallback
        serde_json::from_str(Self::default_json_string()).unwrap()
    }

    /// Checks if a given page type is enabled in any slot.
    /// Saves the current slot configuration back to kneeboards.json with deterministic key ordering (1L, 1R ... 16L, 16R).
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let path = Self::config_path();

        // Ensure deterministic slot ordering: 1L, 1R, 2L, 2R ... 16L, 16R
        let mut ordered_keys: Vec<&String> = self.slots.keys().collect();
        ordered_keys.sort_by_key(|k| {
            let rem = k.trim_start_matches("F16_");
            let is_r = rem.ends_with('R');
            let num_str = rem.trim_end_matches(['L', 'R']);
            let num = num_str.parse::<u32>().unwrap_or(99);
            (num, if is_r { 1 } else { 0 })
        });

        let mut ordered_slots = serde_json::Map::new();
        for k in ordered_keys {
            if let Some(slot) = self.slots.get(k) {
                ordered_slots.insert(k.clone(), serde_json::to_value(slot)?);
            }
        }

        let mut root = serde_json::Map::new();
        root.insert(
            "_comment".to_string(),
            serde_json::Value::String(if self._comment.is_empty() {
                "AeroGraph Kneeboard Slot Configuration. Supports all 32 Falcon BMS slots (F16_1L through F16_16R, textures 7982.dds to 7997.dds). Available types: 'briefing_roster', 'briefing_steerpoints', 'custom_html', 'mission_route', 'mission_target', 'dep_taxi', 'arr_taxi', 'arr_ils_primary', 'arr_ils_secondary', 'blank', 'notes', 'image', 'restore_original', 'pass_through'.".to_string()
            } else {
                self._comment.clone()
            }),
        );
        root.insert(
            "slots".to_string(),
            serde_json::Value::Object(ordered_slots),
        );

        let content = serde_json::to_string_pretty(&serde_json::Value::Object(root))?;
        fs::write(path, content)?;
        Ok(())
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
                    assert_eq!(
                        c.slots.len(),
                        32,
                        "Expected all 32 slots in kneeboards.json"
                    );
                    let assets_dir = manifest_dir.join("assets");
                    for (slot, slot_cfg) in &c.slots {
                        if slot_cfg.page_type == KneeboardPageType::Notes {
                            let text = slot_cfg.resolve_notes_text(&assets_dir);
                            assert!(
                                text.is_some(),
                                "Slot {} failed to resolve notes text from path {:?}",
                                slot,
                                slot_cfg.path
                            );
                            assert!(
                                !text.unwrap().trim().is_empty(),
                                "Slot {} has empty notes text",
                                slot
                            );
                        }
                    }
                    println!("Successfully verified all 32 slots and resolved all notes cards!");
                }
                Err(e) => {
                    panic!("Failed to parse kneeboards.json: {}", e);
                }
            }
        }
    }
}
