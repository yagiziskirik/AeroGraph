use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;

use crate::kneeboard::layout::KneeboardLayoutConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AeroPresetManifest {
    pub name: String,
    pub author: String,
    pub theater: String,
    pub description: String,
    pub version: String,
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

        for (rel_path, content) in &self.custom_files {
            let target_path = Path::new(rel_path);
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::write(target_path, content)?;
        }

        log::info!(
            "Applied AeroPreset \"{}\" into workspace successfully",
            self.manifest.name
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
        };
        let layout = KneeboardLayoutConfig::load_or_create_default();
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
        };
        let layout = KneeboardLayoutConfig::load_or_create_default();
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
        };
        let layout = KneeboardLayoutConfig::load_or_create_default();
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
}
