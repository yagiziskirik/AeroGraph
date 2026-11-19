use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use flate2::read::GzDecoder;
use std::collections::HashSet;
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

use crate::fvx::models::FvxProfile;

#[derive(Debug, Clone)]
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

    /// Creates a safety backup of the original profile in AeroGraph's central config directory
    /// (`%APPDATA%/AeroGraph/backups/`) if one does not exist yet. Never creates files in the profile directory.
    pub fn ensure_backup(&self) -> std::io::Result<PathBuf> {
        let backup_dir = crate::config::AppConfig::config_dir().join("backups");
        let _ = std::fs::create_dir_all(&backup_dir);
        let file_stem = self
            .profile_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("profile");

        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        self.profile_path.to_string_lossy().hash(&mut hasher);
        let path_hash = format!("{:08x}", hasher.finish() as u32);

        let bak_path = backup_dir.join(format!("{}_{}.orig.fvx", file_stem, path_hash));
        if !bak_path.exists() && self.profile_path.exists() {
            std::fs::copy(&self.profile_path, &bak_path)?;
            log::info!("Created original profile backup at: {:?}", bak_path);
        }
        Ok(bak_path)
    }

    /// Reorders and/or enables/disables Crew Chief steps in the profile's raw_json,
    /// and records the customized sequence into VariableInits for cross-session persistence.
    pub fn reorder_crew_chief(
        &mut self,
        desired_order: &[crate::fvx::reorder::DrillStepId],
        disabled_steps: &std::collections::HashSet<crate::fvx::reorder::DrillStepId>,
    ) -> Result<(), String> {
        crate::fvx::reorder::reorder_crew_chief_sequence(
            &mut self.raw_json,
            desired_order,
            disabled_steps,
        )?;

        let order_str = desired_order
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(",");
        let disabled_str = disabled_steps
            .iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(",");

        if let Some(inits) = self
            .raw_json
            .get_mut("VariableInits")
            .and_then(|v| v.as_array_mut())
        {
            set_or_insert_variable(inits, "AEROGRAPH_PROFILE_ID", "CANONICAL_V1");
            set_or_insert_variable(inits, "AEROGRAPH_DRILL_ORDER", &order_str);
            set_or_insert_variable(inits, "AEROGRAPH_DISABLED_STEPS", &disabled_str);
        }

        // Refresh typed profile struct from raw_json
        if let Ok(p) = serde_json::from_value(self.raw_json.clone()) {
            self.profile = p;
        }
        Ok(())
    }

    /// Resets the Crew Chief state machine back to standard default order
    /// and removes custom sequence overrides from VariableInits.
    pub fn reset_crew_chief_sequence(&mut self) -> Result<(), String> {
        let default_order = crate::fvx::reorder::DrillStepId::default_order();
        let disabled_steps = std::collections::HashSet::new();
        crate::fvx::reorder::reorder_crew_chief_sequence(
            &mut self.raw_json,
            &default_order,
            &disabled_steps,
        )?;

        if let Some(inits) = self
            .raw_json
            .get_mut("VariableInits")
            .and_then(|v| v.as_array_mut())
        {
            inits.retain(|v| {
                let name = v.get("Name").and_then(|n| n.as_str()).unwrap_or("");
                !name.eq_ignore_ascii_case("AEROGRAPH_DRILL_ORDER")
                    && !name.eq_ignore_ascii_case("AEROGRAPH_DISABLED_STEPS")
            });
            set_or_insert_variable(inits, "AEROGRAPH_PROFILE_ID", "CANONICAL_V1");
        }

        if let Ok(p) = serde_json::from_value(self.raw_json.clone()) {
            self.profile = p;
        }
        Ok(())
    }

    /// Extracts embedded drill sequence and disabled steps if saved in the profile's VariableInits.
    pub fn get_embedded_sequence(&self) -> Option<(Vec<String>, Vec<String>)> {
        let inits = self.profile.VariableInits.as_ref()?;
        let mut order: Option<Vec<String>> = None;
        let mut disabled: Option<Vec<String>> = None;

        for v in inits {
            if v.Name.eq_ignore_ascii_case("AEROGRAPH_DRILL_ORDER") {
                if let Some(ref val) = v.Value {
                    if let Some(s) = val.as_str() {
                        let list: Vec<String> = s
                            .split(',')
                            .map(|x| x.trim().to_string())
                            .filter(|x| !x.is_empty())
                            .collect();
                        if !list.is_empty() {
                            order = Some(list);
                        }
                    }
                }
            } else if v.Name.eq_ignore_ascii_case("AEROGRAPH_DISABLED_STEPS") {
                if let Some(ref val) = v.Value {
                    if let Some(s) = val.as_str() {
                        let list: Vec<String> = s
                            .split(',')
                            .map(|x| x.trim().to_string())
                            .filter(|x| !x.is_empty())
                            .collect();
                        disabled = Some(list);
                    }
                }
            }
        }

        if order.is_some() || disabled.is_some() {
            Some((
                order.unwrap_or_else(|| {
                    crate::fvx::reorder::DrillStepId::default_order()
                        .iter()
                        .map(|s| s.as_str().to_string())
                        .collect()
                }),
                disabled.unwrap_or_default(),
            ))
        } else {
            None
        }
    }

    /// Checks if this profile is signed by AeroGraph or is the canonical bundled profile,
    /// AND matches the managed Crew Chief command structure.
    pub fn is_managed(&self) -> bool {
        (self.is_canonical_profile() || self.is_bundled_canonical_path())
            && crate::fvx::reorder::detect_profile_compatibility(&self.profile)
                == crate::fvx::reorder::ProfileCompatibility::Managed
    }

    pub fn is_bundled_canonical_path(&self) -> bool {
        let path_str = self.profile_path.to_string_lossy().replace('\\', "/");
        path_str.contains("assets/profiles/Falcon BMS 4.38 v1.3.1")
    }

    /// Checks if this profile carries the official AeroGraph canonical profile identifier.
    pub fn is_canonical_profile(&self) -> bool {
        if let Some(inits) = &self.profile.VariableInits {
            for v in inits {
                if v.Name.eq_ignore_ascii_case("AEROGRAPH_PROFILE_ID") {
                    if let Some(ref val) = v.Value {
                        let s = val.as_str().unwrap_or("");
                        if s.contains("CANONICAL") {
                            return true;
                        }
                    }
                }
            }
        }
        false
    }

    /// Injects the official AeroGraph canonical profile identifier into `VariableInits`.
    pub fn tag_canonical_profile(&mut self) {
        if let Some(inits) = self
            .raw_json
            .get_mut("VariableInits")
            .and_then(|v| v.as_array_mut())
        {
            let already_tagged = inits.iter().any(|v| {
                v.get("Name")
                    .and_then(|n| n.as_str())
                    .map(|n| n.eq_ignore_ascii_case("AEROGRAPH_PROFILE_ID"))
                    .unwrap_or(false)
            });
            if !already_tagged {
                inits.push(serde_json::json!({
                    "Name": "AEROGRAPH_PROFILE_ID",
                    "Value": "CANONICAL_V1"
                }));
                if let Ok(p) = serde_json::from_value(self.raw_json.clone()) {
                    self.profile = p;
                }
            }
        }
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

    /// Extracts structured categories and their voice commands for the Tactical Brevity Browser.
    pub fn extract_category_views(&self) -> Vec<ProfileCategoryView> {
        let mut result = Vec::new();

        for group in &self.profile.CommandGroups {
            let name = group.Name.clone().unwrap_or_default();
            if name.is_empty() {
                continue;
            }
            let is_enabled = !group.Disabled.unwrap_or(false);

            let mut prefix_phrases = Vec::new();
            if let Some(gc) = &group.GroupCommand {
                for seg in &gc.VoiceCommandKeys {
                    for k in &seg.Keys {
                        let trimmed = k.Key.trim();
                        if !trimmed.is_empty() && !prefix_phrases.contains(&trimmed.to_string()) {
                            prefix_phrases.push(trimmed.to_string());
                        }
                    }
                }
            }

            let mut commands = Vec::new();
            for cmd in &group.Commands {
                let cname = cmd.Name.clone().unwrap_or_default();
                if cname.is_empty() {
                    continue;
                }

                let mut spoken_phrases = Vec::new();
                if let Some(segments) = &cmd.VoiceCommandKeys {
                    for seg in segments {
                        for k in &seg.Keys {
                            let trimmed = k.Key.trim();
                            if !trimmed.is_empty() && !spoken_phrases.contains(&trimmed.to_string())
                            {
                                spoken_phrases.push(trimmed.to_string());
                            }
                        }
                    }
                }

                let mut key_combo: Option<String> = None;
                if let Some(outputs) = &cmd.Outputs {
                    for o in outputs {
                        if let Some(k) = &o.Name {
                            if !k.is_empty() {
                                key_combo = Some(k.clone());
                                break;
                            }
                        }
                    }
                }

                commands.push(ProfileCommandView {
                    name: cname,
                    is_enabled: true,
                    spoken_phrases,
                    key_combination: key_combo,
                    description: None,
                });
            }

            if !commands.is_empty() {
                result.push(ProfileCategoryView {
                    name,
                    is_enabled,
                    prefix_phrases,
                    commands,
                });
            }
        }

        result
    }
}

fn set_or_insert_variable(inits: &mut Vec<serde_json::Value>, name: &str, val: &str) {
    for item in inits.iter_mut() {
        if let Some(n) = item.get("Name").and_then(|n| n.as_str()) {
            if n.eq_ignore_ascii_case(name) {
                item["Value"] = serde_json::json!(val);
                return;
            }
        }
    }
    inits.push(serde_json::json!({
        "Name": name,
        "Value": val
    }));
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfileCategoryView {
    pub name: String,
    pub is_enabled: bool,
    pub prefix_phrases: Vec<String>,
    pub commands: Vec<ProfileCommandView>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfileCommandView {
    pub name: String,
    pub is_enabled: bool,
    pub spoken_phrases: Vec<String>,
    pub key_combination: Option<String>,
    pub description: Option<String>,
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

    #[test]
    fn test_extract_category_views_dynamic() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let lp = LoadedProfile::load_from_file(path).expect("Failed to load profile");
        let categories = lp.extract_category_views();
        assert!(!categories.is_empty(), "Categories must not be empty");

        let total_cmds: usize = categories.iter().map(|c| c.commands.len()).sum();
        let total_phrases: usize = categories
            .iter()
            .flat_map(|c| c.commands.iter())
            .map(|cmd| cmd.spoken_phrases.len())
            .sum();

        println!(
            "Extracted {} categories, {} commands, {} spoken callout phrases",
            categories.len(),
            total_cmds,
            total_phrases
        );
        assert!(total_cmds > 0, "Commands must not be empty");
        assert!(
            total_phrases > 0,
            "Spoken callout phrases must be dynamically extracted from profile VoiceCommandKeys"
        );
    }

    #[test]
    fn test_tag_and_verify_canonical_profile() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let mut lp = LoadedProfile::load_from_file(path).expect("Failed to load profile");
        lp.tag_canonical_profile();
        assert!(
            lp.is_canonical_profile(),
            "Profile must be canonical after tagging"
        );
        lp.save_to_file(path)
            .expect("Failed to save tagged profile");

        let reloaded = LoadedProfile::load_from_file(path).expect("Failed to reload profile");
        assert!(
            reloaded.is_canonical_profile(),
            "Reloaded profile must be canonical"
        );
    }

    #[test]
    fn test_embedded_sequence_and_backup() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let mut lp = LoadedProfile::load_from_file(path).expect("Failed to load profile");

        // Verify backup is created in central directory, NOT beside profile
        let bak_path = lp.ensure_backup().expect("Failed to create backup");
        assert!(bak_path.exists(), "Backup must exist");
        assert!(
            bak_path.to_string_lossy().contains("backups"),
            "Backup must be in central backups folder"
        );
        let adjacent_bak = std::path::PathBuf::from(format!("{}.bak", path));
        assert!(
            !adjacent_bak.exists(),
            "Adjacent .bak file must NEVER be created beside profile"
        );

        // Test embedding custom sequence in memory
        let custom_order = vec![
            crate::fvx::reorder::DrillStepId::EngageChief,
            crate::fvx::reorder::DrillStepId::ElecPower,
            crate::fvx::reorder::DrillStepId::JfsStart,
            crate::fvx::reorder::DrillStepId::BigMovements,
            crate::fvx::reorder::DrillStepId::FinaleSalute,
        ];
        let mut disabled = std::collections::HashSet::new();
        disabled.insert(crate::fvx::reorder::DrillStepId::SecCheck);

        lp.reorder_crew_chief(&custom_order, &disabled)
            .expect("Reorder failed");

        let embedded = lp.get_embedded_sequence();
        assert!(
            embedded.is_some(),
            "Embedded sequence must exist after reorder"
        );
        let (seq, dis) = embedded.unwrap();
        assert_eq!(seq[3], "BIG_MOVEMENTS");
        assert_eq!(dis, vec!["SEC_CHECK"]);

        // Test reset removes embedded overrides
        lp.reset_crew_chief_sequence().expect("Reset failed");
        let reset_embedded = lp.get_embedded_sequence();
        assert!(
            reset_embedded.is_none(),
            "Reset must clear custom embedded overrides"
        );
    }
}
