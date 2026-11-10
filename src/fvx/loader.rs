use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use flate2::read::GzDecoder;
use std::collections::HashSet;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use crate::fvx::models::FvxProfile;

pub struct LoadedProfile {
    pub profile: FvxProfile,
    pub profile_path: PathBuf,
    pub base_dir: PathBuf,
    pub raw_json: serde_json::Value,
}

impl LoadedProfile {
    /// Loads a .fvx profile file from disk.
    pub fn load_from_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let path_ref = path.as_ref();
        let mut file = File::open(path_ref)?;
        let mut b64_content = String::new();
        file.read_to_string(&mut b64_content)?;

        let raw_bytes = BASE64.decode(b64_content.trim())?;
        if raw_bytes.len() < 4 {
            return Err("Invalid .fvx file: byte payload too short".into());
        }

        // The first 4 bytes are uncompressed length prefix (little-endian uint32)
        let gzip_data = &raw_bytes[4..];
        let mut decoder = GzDecoder::new(Cursor::new(gzip_data));
        let mut json_str = String::new();
        decoder.read_to_string(&mut json_str)?;

        let raw_json: serde_json::Value = serde_json::from_str(&json_str)?;
        let profile: FvxProfile = serde_json::from_value(raw_json.clone())?;
        let profile_path = path_ref.to_path_buf();
        let base_dir = profile_path
            .parent()
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf();

        Ok(Self {
            profile,
            profile_path,
            base_dir,
            raw_json,
        })
    }

    /// Saves a .fvx profile file to disk with compression and base64 encoding matching FoxVox format.
    /// Uses raw_json to preserve 100% of FoxVox original profile schema and avoid stripping plugins or injecting nulls.
    pub fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), Box<dyn std::error::Error>> {
        let json_bytes = serde_json::to_vec(&self.raw_json)?;
        let uncompressed_len = (json_bytes.len() as u32).to_le_bytes();

        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        use std::io::Write;
        encoder.write_all(&json_bytes)?;
        let gz_bytes = encoder.finish()?;

        let mut payload = Vec::with_capacity(4 + gz_bytes.len());
        payload.extend_from_slice(&uncompressed_len);
        payload.extend_from_slice(&gz_bytes);

        let b64 = BASE64.encode(&payload);
        std::fs::write(path, b64)?;
        Ok(())
    }

    /// Dynamically harvests the complete set of unique variable names declared, queried, or updated in this profile.
    pub fn harvest_required_variables(&self) -> HashSet<String> {
        crate::fvx::harvester::harvest_profile_variables(&self.profile)
    }

    /// Queries the current MPO Switch button or key binding from the profile definition.
    /// Returns (id, device_or_key_name, device_guid, is_keyboard_key).
    pub fn get_mpo_binding(&self) -> (u32, String, String, bool) {
        if let Some(key_groups) = &self.profile.KeyCommandGroups {
            for kg in key_groups {
                for cmd in &kg.Commands {
                    let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                    if name.contains("mpo") || name.contains("manual pitch override") {
                        if let Some(trackers) = &cmd.InputTrackers {
                            for t in trackers {
                                if t.InputType == Some(0)
                                    || t.Product.as_deref() == Some("Keyboard")
                                {
                                    let key_id = t.Id.unwrap_or(0) as u32;
                                    let name =
                                        t.Product.clone().unwrap_or_else(|| "Keyboard".to_string());
                                    return (key_id, name, "KEYBOARD".to_string(), true);
                                } else if t.InputType == Some(2) {
                                    let btn = t.Id.unwrap_or(8) as u32;
                                    let dev = t
                                        .Product
                                        .clone()
                                        .unwrap_or_else(|| "F16 TQS by YGZ".to_string());
                                    let guid = t.DeviceId.clone().unwrap_or_default();
                                    return (btn, dev, guid, false);
                                }
                            }
                        }
                    }
                }
            }
        }
        for cg in &self.profile.CommandGroups {
            for cmd in &cg.Commands {
                let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                if name.contains("mpo") || name.contains("manual pitch override") {
                    if let Some(trackers) = &cmd.InputTrackers {
                        for t in trackers {
                            if t.InputType == Some(0) || t.Product.as_deref() == Some("Keyboard") {
                                let key_id = t.Id.unwrap_or(0) as u32;
                                let name =
                                    t.Product.clone().unwrap_or_else(|| "Keyboard".to_string());
                                return (key_id, name, "KEYBOARD".to_string(), true);
                            } else if t.InputType == Some(2) {
                                let btn = t.Id.unwrap_or(8) as u32;
                                let dev = t
                                    .Product
                                    .clone()
                                    .unwrap_or_else(|| "F16 TQS by YGZ".to_string());
                                let guid = t.DeviceId.clone().unwrap_or_default();
                                return (btn, dev, guid, false);
                            }
                        }
                    }
                }
            }
        }
        (8, "F16 TQS by YGZ".to_string(), String::new(), false)
    }

    /// Updates the MPO Switch button binding in the profile definition.
    pub fn set_mpo_binding(
        &mut self,
        button_id: u32,
        product_name: Option<&str>,
        device_id: Option<&str>,
    ) -> bool {
        let mut modified = false;
        if let Some(key_groups) = &mut self.profile.KeyCommandGroups {
            for kg in key_groups {
                for cmd in &mut kg.Commands {
                    let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                    if name.contains("mpo") || name.contains("manual pitch override") {
                        if let Some(trackers) = &mut cmd.InputTrackers {
                            for t in trackers.iter_mut() {
                                t.InputType = Some(2);
                                t.Id = Some(button_id as i32);
                                if let Some(p) = product_name {
                                    t.Product = Some(p.to_string());
                                }
                                if let Some(d) = device_id {
                                    t.DeviceId = Some(d.to_string());
                                }
                                modified = true;
                            }
                            if !modified {
                                trackers.push(crate::fvx::models::InputTrackerDef {
                                    InputType: Some(2),
                                    Id: Some(button_id as i32),
                                    DeviceId: device_id.map(|s| s.to_string()),
                                    VendorId: None,
                                    ProductId: None,
                                    Product: product_name.map(|s| s.to_string()),
                                });
                                modified = true;
                            }
                        } else {
                            cmd.InputTrackers = Some(vec![crate::fvx::models::InputTrackerDef {
                                InputType: Some(2),
                                Id: Some(button_id as i32),
                                DeviceId: device_id.map(|s| s.to_string()),
                                VendorId: None,
                                ProductId: None,
                                Product: product_name.map(|s| s.to_string()),
                            }]);
                            modified = true;
                        }
                    }
                }
            }
        }
        for cg in &mut self.profile.CommandGroups {
            for cmd in &mut cg.Commands {
                let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                if name.contains("mpo") || name.contains("manual pitch override") {
                    if let Some(trackers) = &mut cmd.InputTrackers {
                        for t in trackers.iter_mut() {
                            t.InputType = Some(2);
                            t.Id = Some(button_id as i32);
                            if let Some(p) = product_name {
                                t.Product = Some(p.to_string());
                            }
                            if let Some(d) = device_id {
                                t.DeviceId = Some(d.to_string());
                            }
                            modified = true;
                        }
                        if !modified {
                            trackers.push(crate::fvx::models::InputTrackerDef {
                                InputType: Some(2),
                                Id: Some(button_id as i32),
                                DeviceId: device_id.map(|s| s.to_string()),
                                VendorId: None,
                                ProductId: None,
                                Product: product_name.map(|s| s.to_string()),
                            });
                            modified = true;
                        }
                    } else {
                        cmd.InputTrackers = Some(vec![crate::fvx::models::InputTrackerDef {
                            InputType: Some(2),
                            Id: Some(button_id as i32),
                            DeviceId: device_id.map(|s| s.to_string()),
                            VendorId: None,
                            ProductId: None,
                            Product: product_name.map(|s| s.to_string()),
                        }]);
                        modified = true;
                    }
                }
            }
        }
        Self::update_raw_mpo_binding(
            &mut self.raw_json,
            2,
            button_id as i64,
            device_id,
            product_name,
        );
        modified
    }

    /// Updates the MPO Switch keyboard key binding in the profile definition.
    pub fn set_mpo_key_binding(&mut self, key_code: u32, key_name: Option<&str>) -> bool {
        let mut modified = false;
        let product_str = key_name.unwrap_or("Keyboard").to_string();
        if let Some(key_groups) = &mut self.profile.KeyCommandGroups {
            for kg in key_groups {
                for cmd in &mut kg.Commands {
                    let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                    if name.contains("mpo") || name.contains("manual pitch override") {
                        if let Some(trackers) = &mut cmd.InputTrackers {
                            for t in trackers.iter_mut() {
                                t.InputType = Some(0);
                                t.Id = Some(key_code as i32);
                                t.Product = Some(product_str.clone());
                                t.DeviceId = Some("KEYBOARD".to_string());
                                modified = true;
                            }
                            if !modified {
                                trackers.push(crate::fvx::models::InputTrackerDef {
                                    InputType: Some(0),
                                    Id: Some(key_code as i32),
                                    DeviceId: Some("KEYBOARD".to_string()),
                                    VendorId: None,
                                    ProductId: None,
                                    Product: Some(product_str.clone()),
                                });
                                modified = true;
                            }
                        } else {
                            cmd.InputTrackers = Some(vec![crate::fvx::models::InputTrackerDef {
                                InputType: Some(0),
                                Id: Some(key_code as i32),
                                DeviceId: Some("KEYBOARD".to_string()),
                                VendorId: None,
                                ProductId: None,
                                Product: Some(product_str.clone()),
                            }]);
                            modified = true;
                        }
                    }
                }
            }
        }
        for cg in &mut self.profile.CommandGroups {
            for cmd in &mut cg.Commands {
                let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                if name.contains("mpo") || name.contains("manual pitch override") {
                    if let Some(trackers) = &mut cmd.InputTrackers {
                        for t in trackers.iter_mut() {
                            t.InputType = Some(0);
                            t.Id = Some(key_code as i32);
                            t.Product = Some(product_str.clone());
                            t.DeviceId = Some("KEYBOARD".to_string());
                            modified = true;
                        }
                        if !modified {
                            trackers.push(crate::fvx::models::InputTrackerDef {
                                InputType: Some(0),
                                Id: Some(key_code as i32),
                                DeviceId: Some("KEYBOARD".to_string()),
                                VendorId: None,
                                ProductId: None,
                                Product: Some(product_str.clone()),
                            });
                            modified = true;
                        }
                    } else {
                        cmd.InputTrackers = Some(vec![crate::fvx::models::InputTrackerDef {
                            InputType: Some(0),
                            Id: Some(key_code as i32),
                            DeviceId: Some("KEYBOARD".to_string()),
                            VendorId: None,
                            ProductId: None,
                            Product: Some(product_str.clone()),
                        }]);
                        modified = true;
                    }
                }
            }
        }
        Self::update_raw_mpo_binding(
            &mut self.raw_json,
            0,
            key_code as i64,
            Some("KEYBOARD"),
            Some(&product_str),
        );
        modified
    }

    /// Resolves asset paths (e.g. .\VCC\Sounds\... or .\\\\VCC\\... or relative) against the profile base directory.
    pub fn resolve_asset_path(&self, relative_path: &str) -> PathBuf {
        let sanitized = relative_path.replace('\\', "/");
        let path = Path::new(&sanitized);
        if path.is_absolute() && path.exists() {
            return path.to_path_buf();
        }

        // Clean any leading dots, slashes, or backslashes
        let clean = sanitized.trim_start_matches(['.', '/']);
        let joined = self.base_dir.join(clean);
        if joined.exists() {
            return joined;
        }

        // Search for VCC or Sounds subpaths relative to base_dir
        if let Some(idx) = clean.find("VCC/") {
            let sub = &clean[idx..];
            let cand = self.base_dir.join(sub);
            if cand.exists() {
                return cand;
            }
        }
        if let Some(idx) = clean.find("Sounds/") {
            let sub = &clean[idx..];
            let cand = self.base_dir.join(sub);
            if cand.exists() {
                return cand;
            }
        }

        // Fallback by filename alone in base_dir
        if let Some(fname) = Path::new(&sanitized).file_name() {
            let cand = self.base_dir.join(fname);
            if cand.exists() {
                return cand;
            }
        }

        joined
    }

    fn update_raw_mpo_binding(
        raw: &mut serde_json::Value,
        input_type: i64,
        id: i64,
        device_id: Option<&str>,
        product: Option<&str>,
    ) {
        let update_groups = |groups: &mut serde_json::Value| {
            if let Some(arr) = groups.as_array_mut() {
                for group in arr {
                    if let Some(commands) = group.get_mut("Commands").and_then(|c| c.as_array_mut())
                    {
                        for cmd in commands {
                            let name = cmd
                                .get("Name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("")
                                .to_lowercase();
                            if name.contains("mpo") || name.contains("manual pitch override") {
                                if let Some(trackers) =
                                    cmd.get_mut("InputTrackers").and_then(|t| t.as_array_mut())
                                {
                                    if trackers.is_empty() {
                                        let mut obj = serde_json::Map::new();
                                        obj.insert(
                                            "InputType".to_string(),
                                            serde_json::json!(input_type),
                                        );
                                        obj.insert("Id".to_string(), serde_json::json!(id));
                                        if let Some(d) = device_id {
                                            obj.insert(
                                                "DeviceId".to_string(),
                                                serde_json::json!(d),
                                            );
                                        }
                                        if let Some(p) = product {
                                            obj.insert("Product".to_string(), serde_json::json!(p));
                                        }
                                        trackers.push(serde_json::Value::Object(obj));
                                    } else {
                                        for tracker in trackers.iter_mut() {
                                            if let Some(obj) = tracker.as_object_mut() {
                                                obj.insert(
                                                    "InputType".to_string(),
                                                    serde_json::json!(input_type),
                                                );
                                                obj.insert("Id".to_string(), serde_json::json!(id));
                                                if let Some(d) = device_id {
                                                    obj.insert(
                                                        "DeviceId".to_string(),
                                                        serde_json::json!(d),
                                                    );
                                                }
                                                if let Some(p) = product {
                                                    obj.insert(
                                                        "Product".to_string(),
                                                        serde_json::json!(p),
                                                    );
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    let mut obj = serde_json::Map::new();
                                    obj.insert(
                                        "InputType".to_string(),
                                        serde_json::json!(input_type),
                                    );
                                    obj.insert("Id".to_string(), serde_json::json!(id));
                                    if let Some(d) = device_id {
                                        obj.insert("DeviceId".to_string(), serde_json::json!(d));
                                    }
                                    if let Some(p) = product {
                                        obj.insert("Product".to_string(), serde_json::json!(p));
                                    }
                                    cmd["InputTrackers"] =
                                        serde_json::json!([serde_json::Value::Object(obj)]);
                                }
                            }
                        }
                    }
                }
            }
        };

        if let Some(kcg) = raw.get_mut("KeyCommandGroups") {
            update_groups(kcg);
        }
        if let Some(cg) = raw.get_mut("CommandGroups") {
            update_groups(cg);
        }
    }

    /// Dynamically extracts all unique axis variable names referenced in `VariableInputs` across all commands.
    pub fn extract_required_axes(&self) -> HashSet<String> {
        let mut axes = HashSet::new();

        // Scan standard command groups
        for cg in &self.profile.CommandGroups {
            for cmd in &cg.Commands {
                if let Some(inputs) = &cmd.VariableInputs {
                    for input in inputs {
                        axes.insert(input.Name.clone());
                    }
                }
            }
        }

        // Scan reactive key command groups
        if let Some(key_groups) = &self.profile.KeyCommandGroups {
            for kg in key_groups {
                for cmd in &kg.Commands {
                    if let Some(inputs) = &cmd.VariableInputs {
                        for input in inputs {
                            axes.insert(input.Name.clone());
                        }
                    }
                }
            }
        }

        axes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inspect_and_modify_mpo() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        if let Ok(mut lp) = LoadedProfile::load_from_file(path) {
            let (initial_btn, initial_dev, _initial_guid, initial_is_key) = lp.get_mpo_binding();
            assert_eq!(initial_btn, 8);
            assert_eq!(initial_dev, "F16 TQS by YGZ");
            assert!(!initial_is_key);

            // Test modifying MPO binding
            assert!(lp.set_mpo_binding(50, Some("F16 TQS by YGZ"), None));
            let (mod_btn, mod_dev, _mod_guid, mod_is_key) = lp.get_mpo_binding();
            assert_eq!(mod_btn, 50);
            assert_eq!(mod_dev, "F16 TQS by YGZ");
            assert!(!mod_is_key);

            // Test setting keyboard key binding
            assert!(lp.set_mpo_key_binding(79, Some("Key O")));
            let (key_btn, key_name, _key_guid, is_key) = lp.get_mpo_binding();
            assert_eq!(key_btn, 79);
            assert_eq!(key_name, "Key O");
            assert!(is_key);

            // Restore button 50 for round-trip test
            assert!(lp.set_mpo_binding(50, Some("F16 TQS by YGZ"), None));

            // Test round-trip serialization in memory
            let temp_dir = std::env::temp_dir();
            let temp_fvx = temp_dir.join("test_roundtrip.fvx");
            lp.save_to_file(&temp_fvx).expect("Failed to save fvx");
            let reloaded = LoadedProfile::load_from_file(&temp_fvx).expect("Failed to reload fvx");
            let (r_btn, r_dev, _r_guid, r_is_key) = reloaded.get_mpo_binding();
            assert_eq!(r_btn, 50);
            assert_eq!(r_dev, "F16 TQS by YGZ");
            assert!(!r_is_key);
            let _ = std::fs::remove_file(temp_fvx);
        }
    }
}
