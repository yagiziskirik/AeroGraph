use directories::ProjectDirs;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use windows::core::HSTRING;
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyW, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY, HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, REG_SZ,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    // --- Voice Settings ---
    #[serde(default)]
    pub profile_path: Option<String>,

    #[serde(default = "default_polling_rate")]
    pub polling_rate_hz: u32,

    #[serde(default)]
    pub pilot_female: bool,

    #[serde(default)]
    pub bms_key_file: Option<String>,

    #[serde(default)]
    pub sapi_earcons: bool,

    #[serde(default)]
    pub output_device: Option<String>,

    #[serde(default)]
    pub input_device: Option<String>,

    #[serde(default)]
    pub show_console: bool,

    #[serde(alias = "voice_enabled", default = "default_true")]
    pub voice_recognition: bool,

    #[serde(default = "default_true")]
    pub listening_enabled: bool,

    // --- Kneeboard Auto-Monitoring Settings ---
    #[serde(alias = "ezwatch_enabled", default = "default_true")]
    pub auto_kneeboards: bool,

    #[serde(default)]
    pub bms_base_dir: Option<String>,

    #[serde(default = "default_true")]
    pub play_sound_on_update: bool,

    #[serde(default)]
    pub custom_slots: HashMap<String, String>,

    // --- Auto-Updater Settings ---
    #[serde(default = "default_true")]
    pub check_updates_on_startup: bool,

    #[serde(default = "default_github_repo")]
    pub github_repo: String,

    // --- GUI Tactical Console Settings ---
    #[serde(default = "default_false")]
    pub gui_open_on_startup: bool,

    #[serde(default = "default_true")]
    pub gui_auto_dock_on_3d: bool,

    #[serde(default = "default_true")]
    pub gui_sound_effects: bool,

    #[serde(default = "default_volume")]
    pub gui_sound_volume: f32,

    #[serde(default = "default_accent")]
    pub gui_accent_color: String,

    #[serde(default = "default_false")]
    pub secondary_monitor_pin: bool,

    #[serde(default = "default_window_size")]
    pub window_size: (u32, u32),

    #[serde(default)]
    pub window_pos: Option<(i32, i32)>,
    #[serde(default = "default_false")]
    pub window_maximized: bool,
}

fn default_github_repo() -> String {
    "yagiziskirik/AeroGraph".to_string()
}

fn default_polling_rate() -> u32 {
    25
}

fn default_true() -> bool {
    true
}

fn default_false() -> bool {
    false
}

fn default_volume() -> f32 {
    0.5
}

fn default_accent() -> String {
    "#10B981".to_string()
}

fn default_window_size() -> (u32, u32) {
    (1200, 740)
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            profile_path: None,
            polling_rate_hz: default_polling_rate(),
            pilot_female: false,
            bms_key_file: None,
            sapi_earcons: false,
            output_device: None,
            input_device: None,
            show_console: false,
            voice_recognition: true,
            listening_enabled: true,
            auto_kneeboards: true,
            bms_base_dir: None,
            play_sound_on_update: true,
            custom_slots: HashMap::new(),
            check_updates_on_startup: true,
            github_repo: default_github_repo(),
            gui_open_on_startup: default_false(),
            gui_auto_dock_on_3d: default_true(),
            gui_sound_effects: default_true(),
            gui_sound_volume: default_volume(),
            gui_accent_color: default_accent(),
            secondary_monitor_pin: default_false(),
            window_size: default_window_size(),
            window_pos: None,
            window_maximized: false,
        }
    }
}

impl AppConfig {
    pub fn config_dir() -> PathBuf {
        if let Some(proj_dirs) = ProjectDirs::from("com", "ygz", "AeroGraph") {
            let config_dir = proj_dirs.config_dir();
            let _ = fs::create_dir_all(config_dir);
            config_dir.to_path_buf()
        } else {
            let _ = fs::create_dir_all("config");
            PathBuf::from("config")
        }
    }

    pub fn config_path() -> PathBuf {
        Self::config_dir().join("aerograph.toml")
    }

    pub fn log_file_path() -> PathBuf {
        Self::config_dir().join("aerograph.log")
    }

    pub fn user_templates_dir() -> PathBuf {
        let dir = Self::config_dir().join("templates");
        let _ = fs::create_dir_all(&dir);
        dir
    }

    pub fn custom_templates_path() -> PathBuf {
        Self::config_dir().join("custom_templates.json")
    }

    pub fn custom_stamps_path() -> PathBuf {
        Self::config_dir().join("custom_stamps.json")
    }

    pub fn default_stamps() -> Vec<crate::gui::ipc::QuickStamp> {
        vec![
            crate::gui::ipc::QuickStamp {
                id: "bingo".into(),
                label: "BINGO 2500".into(),
                template: "BINGO FUEL: {red: 2500 LBS} // JOKER: {yellow: 3200 LBS}".into(),
            },
            crate::gui::ipc::QuickStamp {
                id: "laser".into(),
                label: "LASER 1688".into(),
                template: "PRIMARY LASER PRF: {green: 1688}".into(),
            },
            crate::gui::ipc::QuickStamp {
                id: "ramrod".into(),
                label: "RAMROD".into(),
                template: "RAMROD CODE: {blue: CHARLIE}".into(),
            },
            crate::gui::ipc::QuickStamp {
                id: "roe".into(),
                label: "ROE 25NM".into(),
                template: "ROE: Weapons Free beyond {green: 25NM} from Bullseye".into(),
            },
            crate::gui::ipc::QuickStamp {
                id: "threat".into(),
                label: "SAM THREAT".into(),
                template: "WARNING: {highlight: Active SA-10 Grumble} tracking near STPT".into(),
            },
            crate::gui::ipc::QuickStamp {
                id: "ip_vector".into(),
                label: "IP VECTOR".into(),
                template: "TGT IP: Bearing {blue: 045} / Distance {blue: 12NM} / Pullup 18,000 FT"
                    .into(),
            },
        ]
    }

    pub fn load_custom_stamps() -> Vec<crate::gui::ipc::QuickStamp> {
        let path = Self::custom_stamps_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(stamps) = serde_json::from_str(&content) {
                    return stamps;
                }
            }
        }
        Self::default_stamps()
    }

    pub fn save_custom_stamps(stamps: &[crate::gui::ipc::QuickStamp]) -> std::io::Result<()> {
        let path = Self::custom_stamps_path();
        let content = serde_json::to_string_pretty(stamps)?;
        fs::write(path, content)
    }

    pub fn load_custom_templates() -> Vec<crate::gui::ipc::TemplateMetadata> {
        let path = Self::custom_templates_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(templates) = serde_json::from_str(&content) {
                    return templates;
                }
            }
        }
        Vec::new()
    }

    pub fn save_custom_templates(
        templates: &[crate::gui::ipc::TemplateMetadata],
    ) -> std::io::Result<()> {
        let path = Self::custom_templates_path();
        let content = serde_json::to_string_pretty(templates)?;
        fs::write(path, content)
    }
    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = toml::from_str(&content) {
                    return config;
                }
            }
        }
        Self::default()
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let path = Self::config_path();
        let content = toml::to_string_pretty(self)?;
        fs::write(path, content)?;
        Ok(())
    }

    /// Locates the base assets directory: looks next to executable first, then current working directory.
    pub fn find_assets_dir() -> PathBuf {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(parent) = exe.parent() {
                let candidate = parent.join("assets");
                if candidate.exists() {
                    return candidate;
                }
                if let Some(up2) = parent.parent().and_then(|p| p.parent()) {
                    let cand2 = up2.join("assets");
                    if cand2.exists() {
                        return cand2;
                    }
                }
            }
        }
        let dev_path = PathBuf::from(r"C:\Users\ygz\Projects\AeroGraph\assets");
        if dev_path.exists() {
            return dev_path;
        }
        let local = PathBuf::from("assets");
        if local.exists() {
            return local;
        }
        PathBuf::from("assets")
    }

    /// Resolves the default FoxVox profile (.fvx).
    pub fn resolve_profile(&self) -> Option<PathBuf> {
        if let Some(ref p_str) = self.profile_path {
            let p = PathBuf::from(p_str);
            if p.exists() {
                return Some(p);
            }
        }

        // Check bundled default profile in assets/profiles/
        let assets = Self::find_assets_dir();
        let bundled = assets
            .join("profiles")
            .join("Falcon BMS 4.38 v1.3.1")
            .join("Falcon BMS 4.38 v1.3.1.fvx");
        if bundled.exists() {
            return Some(bundled);
        }

        // Fallback to game directory FoxVox installation
        let bms_fallback = PathBuf::from(
            r"C:\Games\Falcon BMS 4.38\FoxVox\Falcon BMS 4.38 v1.3.1\Falcon BMS 4.38 v1.3.1.fvx",
        );
        if bms_fallback.exists() {
            return Some(bms_fallback);
        }

        None
    }

    /// Queries the registry for Falcon BMS 4.38 install location.
    pub fn get_bms_base_dir(&self) -> Option<PathBuf> {
        if let Some(ref dir) = self.bms_base_dir {
            let p = PathBuf::from(dir);
            if p.exists() {
                return Some(p);
            }
        }

        unsafe {
            let mut hkey = HKEY::default();
            let subkey = windows::core::w!(r"SOFTWARE\WOW6432Node\Benchmark Sims\Falcon BMS 4.38");
            if RegOpenKeyExW(HKEY_LOCAL_MACHINE, subkey, 0, KEY_READ, &mut hkey).is_ok() {
                let mut buf = [0u16; 512];
                let mut len = (buf.len() * 2) as u32;
                let val_name = windows::core::w!("baseDir");
                if RegQueryValueExW(
                    hkey,
                    val_name,
                    None,
                    None,
                    Some(buf.as_mut_ptr() as *mut _),
                    Some(&mut len),
                )
                .is_ok()
                {
                    let _ = RegCloseKey(hkey);
                    let str_val =
                        String::from_utf16_lossy(&buf[..(len as usize / 2).saturating_sub(1)]);
                    let p = PathBuf::from(str_val.trim());
                    if p.exists() {
                        return Some(p);
                    }
                }
                let _ = RegCloseKey(hkey);
            }
        }

        None
    }

    /// Queries active theater and pilot callsign from the Falcon BMS registry key.
    pub fn get_bms_registry_info() -> (String, String) {
        let mut theater = "Korea KTO".to_string();
        let mut callsign = "Viper".to_string();

        unsafe {
            let mut hkey = HKEY::default();
            let subkey = windows::core::w!(r"SOFTWARE\WOW6432Node\Benchmark Sims\Falcon BMS 4.38");
            if RegOpenKeyExW(HKEY_LOCAL_MACHINE, subkey, 0, KEY_READ, &mut hkey).is_ok() {
                // Theater
                let mut buf = [0u16; 256];
                let mut len = (buf.len() * 2) as u32;
                let val_theater = windows::core::w!("curTheater");
                if RegQueryValueExW(
                    hkey,
                    val_theater,
                    None,
                    None,
                    Some(buf.as_mut_ptr() as *mut _),
                    Some(&mut len),
                )
                .is_ok()
                {
                    let end_idx = buf[..(len as usize / 2)]
                        .iter()
                        .position(|&w| w == 0)
                        .unwrap_or(len as usize / 2);
                    theater = String::from_utf16_lossy(&buf[..end_idx]).trim().to_string();
                }

                // Pilot Callsign
                let mut bin_buf = [0u8; 256];
                let mut bin_len = bin_buf.len() as u32;
                let val_callsign = windows::core::w!("PilotCallsign");
                if RegQueryValueExW(
                    hkey,
                    val_callsign,
                    None,
                    None,
                    Some(bin_buf.as_mut_ptr()),
                    Some(&mut bin_len),
                )
                .is_ok()
                {
                    let raw = &bin_buf[..bin_len as usize];
                    let end_idx = raw.iter().position(|&b| b == 0).unwrap_or(raw.len());
                    let cs = String::from_utf8_lossy(&raw[..end_idx]).trim().to_string();
                    if !cs.is_empty() {
                        callsign = cs;
                    }
                }

                let _ = RegCloseKey(hkey);
            }
        }

        (theater, callsign)
    }

    /// Checks if AeroGraph is set to run on Windows startup in HKCU\...\Run.
    pub fn is_auto_start_enabled() -> bool {
        unsafe {
            let mut hkey = HKEY::default();
            let subkey = windows::core::w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
            if RegOpenKeyExW(HKEY_CURRENT_USER, subkey, 0, KEY_READ, &mut hkey).is_ok() {
                let mut buf = [0u16; 512];
                let mut len = (buf.len() * 2) as u32;
                let val_name = windows::core::w!("AeroGraph");
                let res = RegQueryValueExW(
                    hkey,
                    val_name,
                    None,
                    None,
                    Some(buf.as_mut_ptr() as *mut _),
                    Some(&mut len),
                );
                let _ = RegCloseKey(hkey);
                return res.is_ok();
            }
        }
        false
    }

    /// Sets or removes the auto-start entry in HKCU\...\Run.
    pub fn set_auto_start_enabled(enable: bool) -> Result<(), Box<dyn std::error::Error>> {
        unsafe {
            let mut hkey = HKEY::default();
            let subkey = windows::core::w!(r"Software\Microsoft\Windows\CurrentVersion\Run");
            if RegCreateKeyW(HKEY_CURRENT_USER, subkey, &mut hkey).is_ok() {
                let val_name = windows::core::w!("AeroGraph");
                if enable {
                    if let Ok(exe_path) = std::env::current_exe() {
                        let path_str = format!("\"{}\"", exe_path.display());
                        let hstr = HSTRING::from(path_str.as_str());
                        let slice = hstr.as_wide();
                        let bytes = std::slice::from_raw_parts(
                            slice.as_ptr() as *const u8,
                            (slice.len() + 1) * 2,
                        );
                        let _ = RegSetValueExW(hkey, val_name, 0, REG_SZ, Some(bytes));
                    }
                } else {
                    let _ = RegDeleteValueW(hkey, val_name);
                }
                let _ = RegCloseKey(hkey);
            }
        }
        Ok(())
    }
}
