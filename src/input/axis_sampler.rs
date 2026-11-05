use crate::bms::config_parser::{AxisBinding, BmsConfig, ButtonBinding};
use crate::input::direct_input::{DirectInputManager, DIJOYSTATE2};
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct InputSnapshot {
    pub ptt_com1_pressed: bool,
    pub ptt_com2_pressed: bool,
    pub active_variables: HashMap<String, String>, // e.g. "AFElevatorUp" -> "True", "Axis_Toe_Brake" -> "True", "Btn_8" -> "True"
    pub pitch: f32,
    pub roll: f32,
    pub yaw: f32,
    pub left_brake: f32,
    pub right_brake: f32,
    pub pressed_buttons: Vec<u32>,
    pub pressed_device_buttons: Vec<(u32, String)>,
    pub mpo_active: bool,
}

impl Default for InputSnapshot {
    fn default() -> Self {
        Self {
            ptt_com1_pressed: false,
            ptt_com2_pressed: false,
            active_variables: HashMap::new(),
            pitch: 0.5,
            roll: 0.5,
            yaw: 0.5,
            left_brake: 0.0,
            right_brake: 0.0,
            pressed_buttons: Vec::new(),
            pressed_device_buttons: Vec::new(),
            mpo_active: false,
        }
    }
}

pub struct AxisSampler {
    dinput: DirectInputManager,
    bms_config: BmsConfig,
    required_axis_names: HashSet<String>,
    active_axes: HashMap<String, AxisBinding>,
    last_axis_values: HashMap<String, f32>,
    baseline_axes: HashMap<String, f32>,
    deadband_threshold: f32,
    last_hotplug_check: std::time::Instant,
    device_names: HashMap<String, String>,
}

impl AxisSampler {
    pub fn new(
        bms_config: BmsConfig,
        required_axis_names: &HashSet<String>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let mut dinput = DirectInputManager::new()?;

        // Dynamically detect connected game controllers once at startup
        let attached = dinput.enumerate_game_controllers();
        log::info!(
            "DirectInput detected {} attached controller(s):",
            attached.len()
        );
        let mut device_names = HashMap::new();
        for (inst_guid, prod_guid, name) in &attached {
            log::info!(
                "  🎮 Controller: \"{}\" (Instance: {}, Product: {})",
                name,
                inst_guid,
                prod_guid
            );
            device_names.insert(
                inst_guid.trim_matches('{').trim_matches('}').to_uppercase(),
                name.clone(),
            );
            device_names.insert(
                prod_guid.trim_matches('{').trim_matches('}').to_uppercase(),
                name.clone(),
            );
            if dinput.open_device(inst_guid).is_ok() {
                dinput.alias_device(inst_guid, prod_guid);
            } else if dinput.open_device(prod_guid).is_ok() {
                dinput.alias_device(prod_guid, inst_guid);
            }
        }

        // Open all connected BMS game controllers
        for dev in &bms_config.devices {
            let _ = dinput.open_device(&dev.guid);
        }

        // Open devices needed for PTT buttons
        if let Some(ptt1) = &bms_config.ptt_com1 {
            let _ = dinput.open_device(&ptt1.device_guid);
        }
        if let Some(ptt2) = &bms_config.ptt_com2 {
            let _ = dinput.open_device(&ptt2.device_guid);
        }

        // Filter and open devices for required axes
        let mut active_axes = HashMap::new();
        for (axis_name, binding) in &bms_config.axes {
            let matches = required_axis_names.iter().any(|req| {
                req.to_lowercase().contains(&axis_name.to_lowercase())
                    || (axis_name == "Pitch" && (req == "AFElevatorUp" || req == "AFElevatorDown"))
                    || (axis_name == "Roll" && (req == "AFAileronLeft" || req == "AFAileronRight"))
                    || (axis_name == "Yaw" && (req == "AFRudderLeft" || req == "AFRudderRight"))
                    || (axis_name == "Toe_Brake" && req.contains("Toe_Brake"))
                    || (axis_name == "Toe_Brake_Right" && req.contains("Toe_Brake_Right"))
            });

            if matches {
                let _ = dinput.open_device(&binding.device_guid);
                active_axes.insert(axis_name.clone(), binding.clone());
            }
        }

        Ok(Self {
            dinput,
            bms_config,
            required_axis_names: required_axis_names.clone(),
            active_axes,
            last_axis_values: HashMap::new(),
            baseline_axes: HashMap::new(),
            deadband_threshold: 0.02, // 2% deadband for AS5600 encoder filtering
            last_hotplug_check: std::time::Instant::now(),
            device_names,
        })
    }

    /// Checks for newly attached USB game controllers (hotplug) and binds them if missing.
    pub fn check_hotplug(&mut self) {
        let attached = self.dinput.enumerate_game_controllers();
        if attached.is_empty() {
            return;
        }

        let mut newly_attached = 0;
        for (inst_guid, prod_guid, name) in &attached {
            let is_open =
                self.dinput.is_device_open(inst_guid) || self.dinput.is_device_open(prod_guid);
            if !is_open {
                if self.dinput.open_device(inst_guid).is_ok() {
                    self.dinput.alias_device(inst_guid, prod_guid);
                    newly_attached += 1;
                    log::info!(
                        "🎮 Hotplug: Controller connected: \"{}\" [Inst: {}, Prod: {}]",
                        name,
                        inst_guid,
                        prod_guid
                    );
                } else if self.dinput.open_device(prod_guid).is_ok() {
                    self.dinput.alias_device(prod_guid, inst_guid);
                    newly_attached += 1;
                    log::info!(
                        "🎮 Hotplug: Controller connected: \"{}\" [Prod: {}]",
                        name,
                        prod_guid
                    );
                }
            }
        }

        if newly_attached > 0 {
            let config_dir = self.bms_config.base_dir.join("User").join("Config");
            let _ = crate::bms::config_parser::BmsConfig::enrich_from_setup_xmls(
                &config_dir,
                &mut self.bms_config.devices,
                &mut self.bms_config.ptt_com1,
                &mut self.bms_config.ptt_com2,
                &mut self.bms_config.axes,
            );

            for (axis_name, binding) in &self.bms_config.axes {
                let matches = self.required_axis_names.iter().any(|req| {
                    req.to_lowercase().contains(&axis_name.to_lowercase())
                        || (axis_name == "Pitch"
                            && (req == "AFElevatorUp" || req == "AFElevatorDown"))
                        || (axis_name == "Roll"
                            && (req == "AFAileronLeft" || req == "AFAileronRight"))
                        || (axis_name == "Yaw" && (req == "AFRudderLeft" || req == "AFRudderRight"))
                        || (axis_name == "Toe_Brake" && req.contains("Toe_Brake"))
                        || (axis_name == "Toe_Brake_Right" && req.contains("Toe_Brake_Right"))
                });
                if matches {
                    let _ = self.dinput.open_device(&binding.device_guid);
                    self.active_axes.insert(axis_name.clone(), binding.clone());
                }
            }

            if let Some(ptt1) = &self.bms_config.ptt_com1 {
                let _ = self.dinput.open_device(&ptt1.device_guid);
                log::info!(
                    "📻 Hotplug: PTT COM1 bound to button {} on {}",
                    ptt1.button_index,
                    ptt1.device_guid
                );
            }
            if let Some(ptt2) = &self.bms_config.ptt_com2 {
                let _ = self.dinput.open_device(&ptt2.device_guid);
                log::info!(
                    "📻 Hotplug: PTT COM2 bound to button {} on {}",
                    ptt2.button_index,
                    ptt2.device_guid
                );
            }
        }
    }

    /// Samples all active devices once, evaluates button and axis conditions, and returns a snapshot.
    pub fn sample(&mut self) -> InputSnapshot {
        let now = std::time::Instant::now();
        if now.duration_since(self.last_hotplug_check) >= std::time::Duration::from_secs(3) {
            self.last_hotplug_check = now;
            self.check_hotplug();
        }

        let mut snapshot = InputSnapshot::default();

        // Sample PTT buttons
        if let Some(ptt1) = &self.bms_config.ptt_com1 {
            snapshot.ptt_com1_pressed = self.check_button(ptt1);
        }
        if let Some(ptt2) = &self.bms_config.ptt_com2 {
            snapshot.ptt_com2_pressed = self.check_button(ptt2);
        }

        // Sample pressed buttons across all connected controllers
        let opened_guids = self.dinput.get_opened_guids();
        for guid in &opened_guids {
            let dev_name = self
                .device_names
                .get(&guid.to_uppercase())
                .cloned()
                .unwrap_or_else(|| "Controller".to_string());
            if let Some(state) = self.dinput.poll_device(guid) {
                for (btn_idx, &val) in state.rgbButtons.iter().enumerate() {
                    if (val & 0x80) != 0 {
                        let btn_u32 = btn_idx as u32;
                        if !snapshot.pressed_buttons.contains(&btn_u32) {
                            snapshot.pressed_buttons.push(btn_u32);
                        }
                        snapshot
                            .pressed_device_buttons
                            .push((btn_u32, dev_name.clone()));
                        snapshot
                            .active_variables
                            .insert(format!("Btn_{}", btn_idx), "True".to_string());
                        snapshot
                            .active_variables
                            .insert(format!("Btn_{}_{}", dev_name, btn_idx), "True".to_string());
                    }
                }
            }
        }

        // Sample active axes
        let active_axes = self.active_axes.clone();
        for (name, binding) in &active_axes {
            if let Some(state) = self.dinput.poll_device(&binding.device_guid) {
                let raw_val = self.get_axis_value(&state, binding.axis_index);
                let raw_norm = (raw_val as f32) / 65535.0;
                let is_inverted = binding.calibration.as_ref().is_some_and(|c| c.invert);
                let normalized = if is_inverted {
                    (1.0 - raw_norm).clamp(0.0, 1.0)
                } else {
                    raw_norm.clamp(0.0, 1.0)
                };

                let last = self
                    .last_axis_values
                    .entry(name.clone())
                    .or_insert(normalized);
                if (normalized - *last).abs() > self.deadband_threshold {
                    *last = normalized;
                }
                let filtered = *last;

                let lower = name.to_lowercase();
                if lower.contains("pitch") || lower.contains("elevator") {
                    snapshot.pitch = filtered;
                } else if lower.contains("roll") || lower.contains("aileron") {
                    snapshot.roll = filtered;
                } else if lower.contains("yaw") || lower.contains("rudder") {
                    snapshot.yaw = filtered;
                } else if lower.contains("toe_brake_right") {
                    snapshot.right_brake = filtered;
                } else if lower.contains("toe_brake") || lower.contains("brake") {
                    snapshot.left_brake = filtered;
                }

                self.evaluate_axis_variables(name, filtered, &mut snapshot.active_variables);
            }
        }

        // MPO detection: check if active variables, hardware buttons or key combinations indicate MPO toggle
        if snapshot.pressed_buttons.contains(&50)
            || snapshot.pressed_buttons.contains(&8)
            || snapshot
                .active_variables
                .contains_key("AFManualPitchOverride")
            || snapshot.active_variables.contains_key("SimMPOSwitch")
            || snapshot
                .active_variables
                .values()
                .any(|v| v.contains("MPO"))
        {
            snapshot.mpo_active = true;
        }

        snapshot
    }

    fn check_button(&self, binding: &ButtonBinding) -> bool {
        if let Some(state) = self.dinput.poll_device(&binding.device_guid) {
            let idx = binding.button_index as usize;
            if idx < state.rgbButtons.len() && (state.rgbButtons[idx] & 0x80) != 0 {
                return true;
            }
        }
        false
    }

    fn get_axis_value(&self, state: &DIJOYSTATE2, axis_index: i32) -> i32 {
        match axis_index {
            0 => state.lX,
            1 => state.lY,
            2 => state.lZ,
            3 => state.lRx,
            4 => state.lRy,
            5 => state.lRz,
            6 => state.rglSlider[0],
            7 => state.rglSlider[1],
            _ => 0,
        }
    }

    fn evaluate_axis_variables(
        &mut self,
        axis_name: &str,
        norm: f32,
        vars: &mut HashMap<String, String>,
    ) {
        match axis_name {
            "Pitch" => {
                if norm > 0.60 {
                    vars.insert("AFElevatorDown".to_string(), "True".to_string());
                } else if norm < 0.40 {
                    vars.insert("AFElevatorUp".to_string(), "True".to_string());
                }
            }
            "Roll" => {
                if norm > 0.60 {
                    vars.insert("AFAileronLeft".to_string(), "True".to_string());
                } else if norm < 0.40 {
                    vars.insert("AFAileronRight".to_string(), "True".to_string());
                }
            }
            "Yaw" => {
                if norm > 0.60 {
                    vars.insert("AFRudderLeft".to_string(), "True".to_string());
                } else if norm < 0.40 {
                    vars.insert("AFRudderRight".to_string(), "True".to_string());
                }
            }
            "Toe_Brake" => {
                let baseline = *self
                    .baseline_axes
                    .entry(axis_name.to_string())
                    .or_insert(norm);
                if (norm - baseline).abs() > 0.15 {
                    vars.insert("Axis_Toe_Brake".to_string(), "True".to_string());
                }
            }
            "Toe_Brake_Right" => {
                let baseline = *self
                    .baseline_axes
                    .entry(axis_name.to_string())
                    .or_insert(norm);
                if (norm - baseline).abs() > 0.15 {
                    vars.insert("Axis_Toe_Brake_Right".to_string(), "True".to_string());
                }
            }
            _ => {
                vars.insert(format!("Axis_{}", axis_name), norm.to_string());
            }
        }
    }
}
