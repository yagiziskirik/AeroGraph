use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use crate::kneeboard::layout::KneeboardLayoutConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AeroPresetManifest {
    pub name: String,
    pub author: String,
    pub theater: String,
    pub description: String,
    pub version: String,
    pub created_at: String,
    #[serde(default = "default_preset_color")]
    pub color: String,
}

fn default_preset_color() -> String {
    "#10B981".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    pub theater: String,
    pub color: String,
    pub slots: HashMap<String, crate::kneeboard::layout::SlotConfig>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AeroPresetPackage {
    pub manifest: AeroPresetManifest,
    pub layout: KneeboardLayoutConfig,
    pub custom_files: HashMap<String, String>,
}

impl AeroPresetPackage {
    pub fn new(
        manifest: AeroPresetManifest,
        layout: KneeboardLayoutConfig,
        custom_files: HashMap<String, String>,
    ) -> Self {
        Self {
            manifest,
            layout,
            custom_files,
        }
    }

    /// Compresses and exports this preset to a .aeropreset file.
    pub fn export_to_file(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let json_bytes = serde_json::to_vec_pretty(self)?;
        let file = File::create(path)?;
        let mut encoder = GzEncoder::new(file, Compression::best());
        encoder.write_all(&json_bytes)?;
        encoder.finish()?;
        log::info!("Exported AeroPreset to: {:?}", path);
        Ok(())
    }

    /// Reads and decompresses a .aeropreset file.
    pub fn import_from_file(path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let file = File::open(path)?;
        let mut decoder = GzDecoder::new(file);
        let mut buffer = Vec::new();
        decoder.read_to_end(&mut buffer)?;
        let package: Self = serde_json::from_slice(&buffer)?;
        log::info!("Imported AeroPreset: \"{}\"", package.manifest.name);
        Ok(package)
    }

    /// Applies this preset's kneeboard layout and custom files into the active workspace.
    pub fn apply_to_workspace(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.layout.save()?;

        let app_dir = crate::config::AppConfig::app_root_dir();
        let user_templates = crate::config::AppConfig::user_templates_dir();

        for (rel_path, encoded_or_text) in &self.custom_files {
            use base64::prelude::*;
            let bytes = BASE64_STANDARD
                .decode(encoded_or_text.trim())
                .unwrap_or_else(|_| encoded_or_text.as_bytes().to_vec());

            let target_path = if Path::new(rel_path).is_absolute() {
                PathBuf::from(rel_path)
            } else {
                app_dir.join(rel_path)
            };

            let should_write_target = if target_path.exists() {
                match fs::read(&target_path) {
                    Ok(existing) => existing != bytes,
                    Err(_) => true,
                }
            } else {
                true
            };

            if should_write_target {
                if let Some(parent) = target_path.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&target_path, &bytes);
            }

            // Also copy into user_templates_dir so template lookups succeed
            let dest_user = user_templates.join(rel_path);
            let should_write_user = if dest_user.exists() {
                match fs::read(&dest_user) {
                    Ok(existing) => existing != bytes,
                    Err(_) => true,
                }
            } else {
                true
            };

            if should_write_user {
                if let Some(parent) = dest_user.parent() {
                    let _ = fs::create_dir_all(parent);
                }
                let _ = fs::write(&dest_user, &bytes);
            }

            if let Some(fname) = target_path.file_name() {
                let flat_dest = user_templates.join(fname);
                let should_write_flat = if flat_dest.exists() {
                    match fs::read(&flat_dest) {
                        Ok(existing) => existing != bytes,
                        Err(_) => true,
                    }
                } else {
                    true
                };
                if should_write_flat {
                    let _ = fs::write(&flat_dest, &bytes);
                }
            }
        }

        log::info!(
            "Applied AeroPreset \"{}\" into workspace successfully ({} custom files restored)",
            self.manifest.name,
            self.custom_files.len()
        );
        Ok(())
    }

    /// Creates the standard default Korea Theater preset.
    pub fn default_korea() -> Self {
        let manifest = AeroPresetManifest {
            name: "Default F-16CM Block 50 (Korea)".to_string(),
            author: "AeroGraph Official".to_string(),
            theater: "KOREA".to_string(),
            description: "Standard 32-slot operational roster, tactical checklists and ILS charts for Korea Theater."
                .to_string(),
            version: "1.0.0".to_string(),
            created_at: "2026-11-04".to_string(),
            color: "#10B981".to_string(),
        };
        let layout = KneeboardLayoutConfig::create_default();
        Self::new(manifest, layout, HashMap::new())
    }

    /// Creates an Air-to-Ground strike preset.
    pub fn ag_strike_package() -> Self {
        let manifest = AeroPresetManifest {
            name: "SEAD / Precision Strike Package".to_string(),
            author: "AeroGraph Official".to_string(),
            theater: "ALL".to_string(),
            description: "Dedicated strike loadout, SAM threat matrices, ALIC codes and PGM delivery timelines."
                .to_string(),
            version: "1.0.0".to_string(),
            created_at: "2026-11-04".to_string(),
            color: "#F59E0B".to_string(),
        };
        let mut layout = KneeboardLayoutConfig::create_default();
        if let Some(s) = layout.slots.get_mut("F16_2R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::CustomHtml;
            s.path = Some("custom/kneeboard-threats-gnd.html".to_string());
            s.description = "Threats Reference: Surface-to-Air Missile (SAM) Guide".to_string();
        }
        if let Some(s) = layout.slots.get_mut("F16_3R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/sead_harm.md".to_string());
            s.title = Some("SEAD / HARM PROFILES & ALIC CODES".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-4 // SEAD HARM".to_string());
            s.page_num = Some("SEAD-1".to_string());
            s.preset = Some("caution".to_string());
            s.spaced = Some(false);
        }
        if let Some(s) = layout.slots.get_mut("F16_4L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::CustomHtml;
            s.path = Some("custom/kneeboard-checklist-4-fence.html".to_string());
        }
        if let Some(s) = layout.slots.get_mut("F16_5L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::CustomHtml;
            s.path = Some("custom/kneeboard-checklist-5-lgb-mav-mark.html".to_string());
        }
        if let Some(s) = layout.slots.get_mut("F16_6L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/ag_precision.md".to_string());
            s.title = Some("A/G PRECISION GUIDED MUNITIONS".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-2 // PGM STRIKE".to_string());
            s.page_num = Some("PGM-1".to_string());
            s.preset = Some("caution".to_string());
            s.spaced = Some(false);
        }
        if let Some(s) = layout.slots.get_mut("F16_7L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/ag_ballistic.md".to_string());
            s.title = Some("A/G BALLISTIC ORDNANCE & STRAFE".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-1 // BALLISTICS".to_string());
            s.page_num = Some("BALL-1".to_string());
            s.preset = Some("caution".to_string());
            s.spaced = Some(false);
            s.notes = None;
        }
        if let Some(s) = layout.slots.get_mut("F16_7R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/rwr_countermeasures.md".to_string());
            s.title = Some("RWR THREAT MATRIX & CMS PROGRAMS".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-3 // RWR THREATS".to_string());
            s.page_num = Some("RWR-1".to_string());
            s.preset = Some("caution".to_string());
            s.spaced = Some(false);
        }
        Self::new(manifest, layout, HashMap::new())
    }

    /// Creates an Air-to-Air combat preset.
    pub fn aa_air_superiority() -> Self {
        let manifest = AeroPresetManifest {
            name: "Combat Air Patrol / BVR Sweep".to_string(),
            author: "AeroGraph Official".to_string(),
            theater: "ALL".to_string(),
            description: "BVR timelines, missile MAR ranges, AWACS communication ladders and fuel hold regimes."
                .to_string(),
            version: "1.0.0".to_string(),
            created_at: "2026-11-04".to_string(),
            color: "#38BDF8".to_string(),
        };
        let mut layout = KneeboardLayoutConfig::create_default();
        if let Some(s) = layout.slots.get_mut("F16_2R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::CustomHtml;
            s.path = Some("custom/kneeboard-threats-air.html".to_string());
            s.description = "Threats Reference: Air-to-Air Threat Guide".to_string();
        }
        if let Some(s) = layout.slots.get_mut("F16_3R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/aa_missiles.md".to_string());
            s.title = Some("A/A MISSILES & BVR TIMELINES".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-1 // A-A BVR".to_string());
            s.page_num = Some("A/A-1".to_string());
            s.preset = Some("tactical".to_string());
            s.spaced = Some(true);
        }
        if let Some(s) = layout.slots.get_mut("F16_5R") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/rwr_countermeasures.md".to_string());
            s.title = Some("RWR THREAT MATRIX & CMS PROGRAMS".to_string());
            s.header_code = Some("T.O. 1F-16CM-34-1-3 // RWR THREATS".to_string());
            s.page_num = Some("RWR-1".to_string());
            s.preset = Some("caution".to_string());
            s.spaced = Some(false);
        }
        if let Some(s) = layout.slots.get_mut("F16_6L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/comms_laser_matrix.md".to_string());
            s.title = Some("LASER CODES & COMMS LADDER".to_string());
            s.header_code = Some("T.O. 1F-16CM-1 // COMMS & LASER".to_string());
            s.page_num = Some("COMMS-1".to_string());
            s.preset = Some("standard".to_string());
            s.spaced = Some(true);
        }
        Self::new(manifest, layout, HashMap::new())
    }

    /// Creates a Training and Instrument flight preset.
    pub fn training_instrument() -> Self {
        let manifest = AeroPresetManifest {
            name: "Training / Instrument Flight".to_string(),
            author: "AeroGraph Official".to_string(),
            theater: "ALL".to_string(),
            description: "Instrument holding patterns, divert airfields, approach speeds, SFO profiles and dual ILS plates."
                .to_string(),
            version: "1.0.0".to_string(),
            created_at: "2026-11-04".to_string(),
            color: "#8B5CF6".to_string(),
        };
        let mut layout = KneeboardLayoutConfig::create_default();
        if let Some(s) = layout.slots.get_mut("F16_4L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/approach_speeds.md".to_string());
            s.title = Some("APPROACH SPEEDS & OVERHEAD BREAK".to_string());
            s.header_code = Some("T.O. 1F-16CM-1 // APPROACH".to_string());
            s.page_num = Some("APP-1".to_string());
            s.preset = Some("standard".to_string());
            s.spaced = Some(true);
        }
        if let Some(s) = layout.slots.get_mut("F16_5L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/ifr_holding.md".to_string());
            s.title = Some("INSTRUMENT HOLDING & MISSED APP".to_string());
            s.header_code = Some("FLIGHT INFO PUB // IFR RECOVERY".to_string());
            s.page_num = Some("IFR-1".to_string());
            s.preset = Some("standard".to_string());
            s.spaced = Some(true);
        }
        if let Some(s) = layout.slots.get_mut("F16_6L") {
            s.page_type = crate::kneeboard::layout::KneeboardPageType::Notes;
            s.path = Some("notes/divert_airfields.md".to_string());
            s.title = Some("THEATER DIVERT AIRFIELDS DIRECTORY".to_string());
            s.header_code = Some("FLIGHT INFO PUB // THEATER DIVERT".to_string());
            s.page_num = Some("DIVERT-1".to_string());
            s.preset = Some("standard".to_string());
            s.spaced = Some(true);
        }
        Self::new(manifest, layout, HashMap::new())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aeropreset_roundtrip() {
        let preset = AeroPresetPackage::default_korea();
        let temp_dir = std::env::temp_dir();
        let temp_file = temp_dir.join("test_preset.aeropreset");

        let res_export = preset.export_to_file(&temp_file);
        assert!(res_export.is_ok());

        let res_import = AeroPresetPackage::import_from_file(&temp_file);
        assert!(res_import.is_ok());

        let imported = res_import.unwrap();
        assert_eq!(imported.manifest.name, preset.manifest.name);
        assert_eq!(imported.manifest.theater, preset.manifest.theater);

        let _ = fs::remove_file(temp_file);
    }

    #[test]
    fn test_builtin_presets_instantiation() {
        let korea = AeroPresetPackage::default_korea();
        assert_eq!(korea.manifest.name, "Default F-16CM Block 50 (Korea)");

        let strike = AeroPresetPackage::ag_strike_package();
        assert_eq!(strike.manifest.name, "SEAD / Precision Strike Package");
        assert_eq!(
            strike.layout.slots.get("F16_3R").unwrap().path.as_deref(),
            Some("notes/sead_harm.md")
        );

        let cap = AeroPresetPackage::aa_air_superiority();
        assert_eq!(cap.manifest.name, "Combat Air Patrol / BVR Sweep");
        assert_eq!(
            cap.layout.slots.get("F16_3R").unwrap().path.as_deref(),
            Some("notes/aa_missiles.md")
        );

        let training = AeroPresetPackage::training_instrument();
        assert_eq!(training.manifest.name, "Training / Instrument Flight");
        assert_eq!(
            training.layout.slots.get("F16_4L").unwrap().path.as_deref(),
            Some("notes/approach_speeds.md")
        );
    }
}
