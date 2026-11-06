use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub index: usize,
    pub guid: String,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct ButtonBinding {
    pub callback: String,
    pub device_guid: String,
    pub device_name: Option<String>,
    pub button_index: u32,
}

#[derive(Debug, Clone)]
pub struct AxisCalibration {
    pub center: i32,
    pub deadzone: i32,
    pub min: i32,
    pub max: i32,
    pub saturation: i32,
    pub invert: bool,
}

#[derive(Debug, Clone)]
pub struct AxisBinding {
    pub axis_name: String,
    pub device_guid: String,
    pub axis_index: i32,
    pub calibration: Option<AxisCalibration>,
}

#[derive(Debug, Clone, Default)]
pub struct ParsedKeyBindings {
    pub ptt_com1: Option<ButtonBinding>,
    pub ptt_com2: Option<ButtonBinding>,
    pub mpo_button: Option<ButtonBinding>,
    pub mpo_key: Option<(i32, i32)>,
}

#[derive(Debug, Clone, Default)]
pub struct BmsConfig {
    pub base_dir: PathBuf,
    pub devices: Vec<DeviceInfo>,
    pub ptt_com1: Option<ButtonBinding>,
    pub ptt_com2: Option<ButtonBinding>,
    pub mpo_button: Option<ButtonBinding>,
    pub mpo_key: Option<(i32, i32)>,
    pub axes: HashMap<String, AxisBinding>,
}

fn dik_to_name(code: i32) -> String {
    match code {
        0x01 => "Escape".to_string(),
        0x02..=0x0A => format!("{}", code - 1),
        0x0B => "0".to_string(),
        0x10 => "Q".to_string(),
        0x11 => "W".to_string(),
        0x12 => "E".to_string(),
        0x13 => "R".to_string(),
        0x14 => "T".to_string(),
        0x15 => "Y".to_string(),
        0x16 => "U".to_string(),
        0x17 => "I".to_string(),
        0x18 => "O".to_string(),
        0x19 => "P".to_string(),
        0x1E => "A".to_string(),
        0x1F => "S".to_string(),
        0x20 => "D".to_string(),
        0x21 => "F".to_string(),
        0x22 => "G".to_string(),
        0x23 => "H".to_string(),
        0x24 => "J".to_string(),
        0x25 => "K".to_string(),
        0x26 => "L".to_string(),
        0x2C => "Z".to_string(),
        0x2D => "X".to_string(),
        0x2E => "C".to_string(),
        0x2F => "V".to_string(),
        0x30 => "B".to_string(),
        0x31 => "N".to_string(),
        0x32 => "M".to_string(),
        0x39 => "Space".to_string(),
        _ => format!("0x{:X}", code),
    }
}

impl BmsConfig {
    /// Lots of comments here, since it is hard to understand what is going on in the BMS config files without context. Hopefully this helps future maintainers.
    /// Returns human-readable string of the MPO binding configured in Falcon BMS.
    pub fn get_mpo_display(&self) -> Option<String> {
        let btn_str = self.mpo_button.as_ref().map(|btn| {
            let dev_name = btn
                .device_name
                .as_ref()
                .cloned()
                .or_else(|| {
                    self.devices
                        .iter()
                        .find(|d| d.guid.eq_ignore_ascii_case(&btn.device_guid))
                        .map(|d| d.name.clone())
                })
                .unwrap_or_else(|| "Controller".to_string());
            format!("JoyBtn {} ({})", btn.button_index, dev_name)
        });

        let key_str = self.mpo_key.map(|(code, mods)| {
            let mod_str = match mods {
                1 => "Shift+",
                2 => "Ctrl+",
                4 => "Alt+",
                3 => "Ctrl+Shift+",
                5 => "Alt+Shift+",
                6 => "Ctrl+Alt+",
                7 => "Ctrl+Alt+Shift+",
                _ => "",
            };
            format!("Key {}{}", mod_str, dik_to_name(code))
        });

        match (btn_str, key_str) {
            (Some(b), Some(k)) => Some(format!("{} / {}", b, k)),
            (Some(b), None) => Some(b),
            (None, Some(k)) => Some(k),
            (None, None) => None,
        }
    }

    /// Attempts to locate the Falcon BMS installation directory strictly via the Windows Registry.
    pub fn find_bms_directory() -> Option<PathBuf> {
        crate::config::AppConfig::default().get_bms_base_dir()
    }

    /// Loads and parses DeviceSorting.txt, Key file, axismapping.dat, and joystick.cal,
    /// with dynamic enrichment from BMS Alternative Launcher XMLs (Setup.v100.*.xml)
    pub fn load_from_bms<P: AsRef<Path>>(
        bms_dir: P,
        custom_key_file: Option<&str>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let bms_path = bms_dir.as_ref();
        let config_dir = bms_path.join("User").join("Config");

        let mut devices =
            Self::parse_device_sorting(config_dir.join("DeviceSorting.txt")).unwrap_or_default();

        let key_file_name = custom_key_file.unwrap_or("BMS - Auto.key");
        let key_file_path = config_dir.join(key_file_name);
        let mut key_bindings = Self::parse_key_file(&key_file_path, &devices).unwrap_or_default();

        let axis_calibrations =
            Self::parse_joystick_cal(config_dir.join("joystick.cal")).unwrap_or_default();
        let mut axes = Self::parse_axis_mapping(
            config_dir.join("axismapping.dat"),
            &devices,
            axis_calibrations,
        )
        .unwrap_or_default();

        // Dynamically enrich/fallback from BMS Alternative Launcher XMLs (Setup.v100.*.xml)
        let _ = Self::enrich_from_setup_xmls(
            &config_dir,
            &mut devices,
            &mut key_bindings.ptt_com1,
            &mut key_bindings.ptt_com2,
            &mut key_bindings.mpo_button,
            &mut axes,
        );

        Ok(Self {
            base_dir: bms_path.to_path_buf(),
            devices,
            ptt_com1: key_bindings.ptt_com1,
            ptt_com2: key_bindings.ptt_com2,
            mpo_button: key_bindings.mpo_button,
            mpo_key: key_bindings.mpo_key,
            axes,
        })
    }

    /// Dynamically scans and enriches device, button, and axis mappings from
    /// BMS Alternative Launcher profile XMLs (Setup.v100.`<Name>` {`<GUID>`}.xml).
    pub fn enrich_from_setup_xmls(
        config_dir: &Path,
        devices: &mut Vec<DeviceInfo>,
        ptt_com1: &mut Option<ButtonBinding>,
        ptt_com2: &mut Option<ButtonBinding>,
        mpo_button: &mut Option<ButtonBinding>,
        axes: &mut HashMap<String, AxisBinding>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let entries = match fs::read_dir(config_dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let filename = match path.file_name().and_then(|n| n.to_str()) {
                Some(f) => f,
                None => continue,
            };

            if filename.starts_with("Setup.v100.") && filename.ends_with(".xml") {
                let inner = &filename["Setup.v100.".len()..filename.len() - ".xml".len()];
                if let (Some(open), Some(close)) = (inner.find('{'), inner.find('}')) {
                    let dev_name = inner[..open].trim().to_string();
                    let dev_guid = inner[open + 1..close].to_uppercase();

                    // Register device if not already present
                    if !devices.iter().any(|d| {
                        d.guid.eq_ignore_ascii_case(&dev_guid)
                            || d.name.eq_ignore_ascii_case(&dev_name)
                    }) {
                        devices.push(DeviceInfo {
                            index: devices.len(),
                            guid: dev_guid.clone(),
                            name: dev_name.clone(),
                        });
                    }

                    if let Ok(content) = fs::read_to_string(&path) {
                        Self::parse_setup_xml(
                            &content, &dev_guid, &dev_name, ptt_com1, ptt_com2, mpo_button, axes,
                        );
                    }
                }
            }
        }

        Ok(())
    }

    /// Parses an individual Setup.v100 XML file for button callbacks and axis assignments.
    fn parse_setup_xml(
        content: &str,
        dev_guid: &str,
        dev_name: &str,
        ptt_com1: &mut Option<ButtonBinding>,
        ptt_com2: &mut Option<ButtonBinding>,
        mpo_button: &mut Option<ButtonBinding>,
        axes: &mut HashMap<String, AxisBinding>,
    ) {
        // Parse <dx> section for PTT button callbacks
        if let Some(dx_start) = content.find("<dx>") {
            let dx_end = content[dx_start..]
                .find("</dx>")
                .map(|p| dx_start + p)
                .unwrap_or(content.len());
            let dx_section = &content[dx_start..dx_end];

            let mut btn_idx = 0;
            let mut search_pos = 0;
            while let Some(start_dx) = dx_section[search_pos..].find("<DxAssgn>") {
                let actual_start = search_pos + start_dx;
                let end_dx = match dx_section[actual_start..].find("</DxAssgn>") {
                    Some(e) => actual_start + e + "</DxAssgn>".len(),
                    None => break,
                };
                let block = &dx_section[actual_start..end_dx];

                if ptt_com1.is_none() && block.contains("<Callback>SimTransmitCom1</Callback>") {
                    *ptt_com1 = Some(ButtonBinding {
                        callback: "SimTransmitCom1".to_string(),
                        device_guid: dev_guid.to_string(),
                        device_name: Some(dev_name.to_string()),
                        button_index: btn_idx,
                    });
                }
                if ptt_com2.is_none() && block.contains("<Callback>SimTransmitCom2</Callback>") {
                    *ptt_com2 = Some(ButtonBinding {
                        callback: "SimTransmitCom2".to_string(),
                        device_guid: dev_guid.to_string(),
                        device_name: Some(dev_name.to_string()),
                        button_index: btn_idx,
                    });
                }
                let is_mpo_hold = block.contains("<Callback>SimMPO</Callback>")
                    || block.contains("<Callback>AFManualPitchOverride</Callback>")
                    || block.contains("<Callback>SimMPOSwitch</Callback>");
                let is_mpo_toggle = block.contains("<Callback>SimMPOToggle</Callback>");

                if is_mpo_hold || (is_mpo_toggle && mpo_button.is_none()) {
                    *mpo_button = Some(ButtonBinding {
                        callback: if is_mpo_hold {
                            "SimMPO".to_string()
                        } else {
                            "SimMPOToggle".to_string()
                        },
                        device_guid: dev_guid.to_string(),
                        device_name: Some(dev_name.to_string()),
                        button_index: btn_idx,
                    });
                }

                btn_idx += 1;
                search_pos = end_dx;
            }
        }

        // Parse <axis> section for flight controls and brake axes
        if let Some(ax_start) = content.find("<axis>") {
            let ax_end = content[ax_start..]
                .find("</axis>")
                .map(|p| ax_start + p)
                .unwrap_or(content.len());
            let ax_section = &content[ax_start..ax_end];

            let mut ax_idx = 0;
            let mut search_pos = 0;
            while let Some(start_ax) = ax_section[search_pos..].find("<AxAssgn>") {
                let actual_start = search_pos + start_ax;
                let end_ax = match ax_section[actual_start..].find("</AxAssgn>") {
                    Some(e) => actual_start + e + "</AxAssgn>".len(),
                    None => break,
                };
                let block = &ax_section[actual_start..end_ax];

                if let (Some(n_start), Some(n_end)) =
                    (block.find("<AxisName>"), block.find("</AxisName>"))
                {
                    let axis_name = block[n_start + "<AxisName>".len()..n_end].trim();
                    if !axis_name.is_empty() {
                        let invert = block.contains("<Invert>true</Invert>");
                        axes.entry(axis_name.to_string())
                            .or_insert_with(|| AxisBinding {
                                axis_name: axis_name.to_string(),
                                device_guid: dev_guid.to_string(),
                                axis_index: ax_idx,
                                calibration: Some(AxisCalibration {
                                    center: 32767,
                                    deadzone: 0,
                                    min: 0,
                                    max: 65535,
                                    saturation: 65535,
                                    invert,
                                }),
                            });
                    }
                }

                ax_idx += 1;
                search_pos = end_ax;
            }
        }
    }

    /// Parses DeviceSorting.txt into a list of devices indexed by order.
    /// Lines format: {00091209-0000-0000-0000-504944564944} "F16 Pedals by YGZ"
    /// Weird flex, but I know. I made my own controllers, okay?
    pub fn parse_device_sorting<P: AsRef<Path>>(
        path: P,
    ) -> Result<Vec<DeviceInfo>, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let mut devices = Vec::new();

        for (idx, line) in content.lines().enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            if let Some(open) = line.find('{') {
                if let Some(close) = line.find('}') {
                    let guid = line[open + 1..close].to_uppercase();
                    let name = line[close + 1..]
                        .trim()
                        .trim_matches('"')
                        .trim()
                        .to_string();
                    devices.push(DeviceInfo {
                        index: idx,
                        guid,
                        name,
                    });
                }
            }
        }

        Ok(devices)
    }

    /// Parses BMS key file to resolve SimTransmitCom1, SimTransmitCom2, and MPO Switch button/key bindings.
    /// Lines format: CallbackName ButtonID SoundId KeyCode Modifiers ...
    /// ButtonID encoding: device_index * 32 (or 128) + button_num
    pub fn parse_key_file<P: AsRef<Path>>(
        path: P,
        devices: &[DeviceInfo],
    ) -> Result<ParsedKeyBindings, Box<dyn std::error::Error>> {
        let content = fs::read_to_string(path)?;
        let mut bindings = ParsedKeyBindings::default();

        for line in content.lines() {
            let line = line.trim();
            if line.starts_with('#') || line.is_empty() {
                continue;
            }

            let tokens: Vec<&str> = line.split_whitespace().collect();
            if tokens.len() >= 2 {
                let callback = tokens[0];
                if callback == "SimTransmitCom1" || callback == "SimTransmitCom2" {
                    // Check if this line is a joystick button binding (buttonId >= 0)
                    if let Ok(btn_id) = tokens[1].parse::<i32>() {
                        if btn_id >= 0 {
                            let btn_id = btn_id as u32;
                            // Device sorting uses 32 or 128 buttons per device
                            // In BMS 4.38 DX mapping: device_idx = btn_id / 128 (or 32)
                            // Let's resolve the matching device
                            let (dev_idx, button_index) = if btn_id >= 128 {
                                ((btn_id / 128) as usize, btn_id % 128)
                            } else {
                                ((btn_id / 32) as usize, btn_id % 32)
                            };

                            let (guid, name) = devices
                                .get(dev_idx)
                                .map(|d| (d.guid.clone(), Some(d.name.clone())))
                                .unwrap_or_else(|| (String::new(), None));
                            let binding = ButtonBinding {
                                callback: callback.to_string(),
                                device_guid: guid,
                                device_name: name,
                                button_index,
                            };

                            if callback == "SimTransmitCom1" {
                                bindings.ptt_com1 = Some(binding);
                            } else {
                                bindings.ptt_com2 = Some(binding);
                            }
                        }
                    }
                } else if callback == "SimMPO"
                    || callback == "SimMPOToggle"
                    || callback == "AFManualPitchOverride"
                    || callback == "SimMPOSwitch"
                {
                    let is_hold = callback == "SimMPO"
                        || callback == "AFManualPitchOverride"
                        || callback == "SimMPOSwitch";
                    let is_dx_button = tokens.len() >= 4 && tokens[2] == "-1" && tokens[3] == "-2";

                    if is_dx_button {
                        if let Ok(btn_id) = tokens[1].parse::<i32>() {
                            if btn_id >= 0 && (bindings.mpo_button.is_none() || is_hold) {
                                let btn_id = btn_id as u32;
                                let (dev_idx, button_index) = if btn_id >= 128 {
                                    ((btn_id / 128) as usize, btn_id % 128)
                                } else {
                                    ((btn_id / 32) as usize, btn_id % 32)
                                };

                                let (guid, name) = devices
                                    .get(dev_idx)
                                    .map(|d| (d.guid.clone(), Some(d.name.clone())))
                                    .unwrap_or_else(|| (String::new(), None));
                                bindings.mpo_button = Some(ButtonBinding {
                                    callback: callback.to_string(),
                                    device_guid: guid,
                                    device_name: name,
                                    button_index,
                                });
                            }
                        }
                    } else if tokens.len() >= 4 {
                        let raw_kc = tokens[3];
                        let kc_opt = if raw_kc.starts_with("0x") || raw_kc.starts_with("0X") {
                            u32::from_str_radix(&raw_kc[2..], 16).ok().map(|v| v as i32)
                        } else {
                            raw_kc.parse::<i32>().ok()
                        };
                        if let Some(kc) = kc_opt {
                            if kc > 0 && (bindings.mpo_key.is_none() || is_hold) {
                                let mods = tokens
                                    .get(4)
                                    .and_then(|m| m.parse::<i32>().ok())
                                    .unwrap_or(0);
                                bindings.mpo_key = Some((kc, mods));
                            }
                        }
                    }
                }
            }
        }

        Ok(bindings)
    }

    /// Parses joystick.cal (720 bytes, 30 records of 6x int32 = 24 bytes).
    pub fn parse_joystick_cal<P: AsRef<Path>>(
        path: P,
    ) -> Result<Vec<AxisCalibration>, Box<dyn std::error::Error>> {
        let mut file = File::open(path)?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;

        let mut calibrations = Vec::new();
        for chunk in bytes.as_chunks::<24>().0 {
            let center = i32::from_le_bytes(chunk[0..4].try_into()?);
            let deadzone = i32::from_le_bytes(chunk[4..8].try_into()?);
            let min = i32::from_le_bytes(chunk[8..12].try_into()?);
            let max = i32::from_le_bytes(chunk[12..16].try_into()?);
            let saturation = i32::from_le_bytes(chunk[16..20].try_into()?);
            let invert_flag = i32::from_le_bytes(chunk[20..24].try_into()?);

            calibrations.push(AxisCalibration {
                center,
                deadzone,
                min,
                max,
                saturation,
                invert: (invert_flag & 1) != 0,
            });
        }

        Ok(calibrations)
    }

    /// Parses axismapping.dat (504 bytes: 24-byte header, 30 records of 16 bytes).
    /// Each record: int32 dev_idx, int32 axis_idx, int32 cal_idx, int32 flags.
    /// Falcon BMS device index: 0 = Mouse, 1 = Keyboard, 2..N+1 = Controllers in DeviceSorting.txt
    pub fn parse_axis_mapping<P: AsRef<Path>>(
        path: P,
        devices: &[DeviceInfo],
        calibrations: Vec<AxisCalibration>,
    ) -> Result<HashMap<String, AxisBinding>, Box<dyn std::error::Error>> {
        let mut file = File::open(path)?;
        let mut bytes = Vec::new();
        file.read_to_end(&mut bytes)?;

        if bytes.len() < 24 {
            return Err("Invalid axismapping.dat: file too short".into());
        }

        // Standard BMS Axis Type order
        let axis_names = [
            "Pitch",
            "Roll",
            "Yaw",
            "Throttle",
            "Throttle_Right",
            "Toe_Brake",
            "Toe_Brake_Right",
            "Trim_Roll",
            "Trim_Pitch",
            "Trim_Yaw",
            "Radar_Antenna_Elevation",
            "Cursor_X",
            "Cursor_Y",
            "Range_Knob",
            "HUD_Brightness",
            "Reticle_Depression",
            "HMS_Brightness",
            "FLIR_Brightness",
            "Intercom",
            "COMM_Channel_1",
            "COMM_Channel_2",
        ];

        let mut axes = HashMap::new();
        let records = &bytes[24..]; // Skip 24-byte header

        for (idx, chunk) in records.as_chunks::<16>().0.iter().enumerate() {
            if idx >= axis_names.len() {
                break;
            }
            let dev_idx = i32::from_le_bytes(chunk[0..4].try_into()?);
            let axis_idx = i32::from_le_bytes(chunk[4..8].try_into()?);
            let cal_idx = i32::from_le_bytes(chunk[8..12].try_into()?);

            if dev_idx < 0 || axis_idx < 0 {
                continue;
            }

            // Map BMS DirectInput device index to DeviceSorting.txt devices
            let resolved_device = if dev_idx >= 2 && ((dev_idx - 2) as usize) < devices.len() {
                devices.get((dev_idx - 2) as usize)
            } else if (dev_idx as usize) < devices.len() {
                devices.get(dev_idx as usize)
            } else {
                None
            };

            if let Some(dev) = resolved_device {
                let cal = calibrations
                    .get(cal_idx as usize)
                    .or_else(|| calibrations.get(idx))
                    .cloned();
                let name = axis_names[idx].to_string();
                axes.insert(
                    name.clone(),
                    AxisBinding {
                        axis_name: name,
                        device_guid: dev.guid.clone(),
                        axis_index: axis_idx,
                        calibration: cal,
                    },
                );
            }
        }

        Ok(axes)
    }
}
