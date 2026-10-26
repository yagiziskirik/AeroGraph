use std::collections::HashMap;
use std::path::PathBuf;
use rand::Rng;

use crate::bms::shared_memory::PrimaryFlightData;
use crate::engine::audio::AudioPlayer;
use crate::engine::keyboard::KeyboardDispatcher;
use crate::fvx::loader::LoadedProfile;
use crate::fvx::models::{ActionOutput, CommandDef, ConditionGroup, VariableCondition};

pub struct StateEngine {
    pub variables: HashMap<String, String>,
    pub active_configuration: Option<String>,
    pub audio_player: Option<AudioPlayer>,
    pub fired_commands: std::collections::HashSet<String>,
}

impl StateEngine {
    pub fn new(pilot_female: bool) -> Self {
        let mut variables = HashMap::new();
        variables.insert("Female".to_string(), if pilot_female { "True" } else { "False" }.to_string());
        variables.insert("Completed".to_string(), "0".to_string());
        variables.insert("Step".to_string(), "".to_string());
        variables.insert("rpm".to_string(), "0".to_string());
        variables.insert("nozzlePos".to_string(), "0".to_string());
        variables.insert("speedBrake".to_string(), "0".to_string());

        let audio = AudioPlayer::new().ok();

        Self {
            variables,
            active_configuration: None,
            audio_player: audio,
            fired_commands: std::collections::HashSet::new(),
        }
    }

    /// Resets all internal engine state (variables, Chief configuration, and fired triggers).
    pub fn reset(&mut self, pilot_female: bool) {
        log::info!("🔄 Resetting StateEngine internal logic (clearing variables, resetting Chief state)");
        if let Some(player) = &self.audio_player {
            player.stop();
        }
        self.variables.clear();
        self.variables.insert("Female".to_string(), if pilot_female { "True" } else { "False" }.to_string());
        self.variables.insert("Completed".to_string(), "0".to_string());
        self.variables.insert("Step".to_string(), "".to_string());
        self.variables.insert("rpm".to_string(), "0".to_string());
        self.variables.insert("nozzlePos".to_string(), "0".to_string());
        self.variables.insert("speedBrake".to_string(), "0".to_string());
        self.variables.insert("gearPos".to_string(), "0".to_string());

        self.active_configuration = None;
        self.fired_commands.clear();
    }

    /// Returns true if Crew Chief mode is actively engaged.
    pub fn is_chief_engaged(&self) -> bool {
        self.active_configuration.as_deref() == Some("3c7a455a-8e77-41f1-9953-b3d98bdd3440")
    }

    /// Checks whether a command group is active in the current state.
    pub fn is_group_active(&self, group: &crate::fvx::models::CommandGroup) -> bool {
        let name = group.Name.as_deref().unwrap_or("");
        let is_chief = group.Name.is_none();

        if self.is_chief_engaged() {
            if is_chief {
                return true;
            }
            if name == "Engage Crew Chief" || name == "Chief Unrecognized" {
                return false; // Cannot engage while already in Chief mode
            }
            // Check if this cockpit comms group is disabled under the active configuration
            if let Some(ref active_cfg) = self.active_configuration {
                if let Some(cfgs) = &group.Configurations {
                    if let Some(cfg) = cfgs.iter().find(|c| c.Id == *active_cfg) {
                        if cfg.Disabled.unwrap_or(false) {
                            return false;
                        }
                    }
                }
            }
            !group.Disabled.unwrap_or(false)
        } else {
            // Out of Chief mode:
            if is_chief || name == "Chief Unrecognized" {
                return false;
            }
            if name == "Engage Crew Chief" {
                return true; // Can always engage Chief when out of Chief mode!
            }
            !group.Disabled.unwrap_or(false)
        }
    }

    /// Updates internal variables from BMS primary flight data.
    pub fn update_from_flight_data(&mut self, data: &PrimaryFlightData) {
        self.variables.insert("rpm".to_string(), format!("{:.1}", data.rpm));
        self.variables.insert("nozzlePos".to_string(), format!("{:.2}", data.nozzle_pos));
        self.variables.insert("speedBrake".to_string(), format!("{:.2}", data.speed_brake));
        self.variables.insert("gearPos".to_string(), format!("{:.2}", data.gear_pos));
        self.variables.insert("TrimPitch".to_string(), format!("{:.2}", data.trim_pitch));
        self.variables.insert("TrimRoll".to_string(), format!("{:.2}", data.trim_roll));
        self.variables.insert("TrimYaw".to_string(), format!("{:.2}", data.trim_yaw));

        // Cockpit light bits: RefuelRDY (0x8000), RefuelDSC (0x20000)
        let refuel_rdy = if (data.light_bits & 0x8000) != 0 { "1" } else { "0" };
        self.variables.insert("lightBits.RefuelRDY".to_string(), refuel_rdy.to_string());

        let refuel_dsc = if (data.light_bits & 0x20000) != 0 { "1" } else { "0" };
        self.variables.insert("lightBits.RefuelDSC".to_string(), refuel_dsc.to_string());

        // In3D state from hsi_bits Flying bit (0x80000000)
        let in_3d = if (data.hsi_bits & 0x80000000) != 0 { "True" } else { "False" };
        self.variables.insert("In3D".to_string(), in_3d.to_string());
    }

    /// Sets BMS connection status and associated profile variables.
    pub fn set_bms_connected(&mut self, connected: bool) {
        if connected {
            self.variables.insert("BMSVersionMajor".to_string(), "4".to_string());
            self.variables.insert("BMSVersionMinor".to_string(), "38".to_string());
        } else {
            self.variables.remove("BMSVersionMajor");
            self.variables.remove("BMSVersionMinor");
        }
    }

    /// Evaluates reactive KeyCommandGroups (e.g. Crew Chief automated voice triggers).
    pub fn evaluate_reactive_groups(&mut self, profile: &LoadedProfile, input_vars: &HashMap<String, String>) {
        // ONLY evaluate reactive checks when Crew Chief mode is actively engaged
        if !self.is_chief_engaged() {
            return;
        }

        if let Some(key_groups) = &profile.profile.KeyCommandGroups {
            for (g_idx, kg) in key_groups.iter().enumerate() {
                for (c_idx, cmd) in kg.Commands.iter().enumerate() {
                    let cmd_key = format!("{}_{}_{}", g_idx, c_idx, cmd.Name.as_deref().unwrap_or(""));

                    // Check if variable inputs (axes/buttons) match.
                    // Different GroupIds are alternative choices (OR across groups, AND within each group).
                    if let Some(inputs) = &cmd.VariableInputs {
                        if !inputs.is_empty() {
                            let mut groups: HashMap<i32, Vec<&crate::fvx::models::VariableInputDef>> = HashMap::new();
                            for inp in inputs {
                                let gid = inp.GroupId.unwrap_or(0);
                                groups.entry(gid).or_default().push(inp);
                            }

                            let any_group_satisfied = groups.values().any(|group_inputs| {
                                group_inputs.iter().all(|input| {
                                    let is_rev = input.Reversed.unwrap_or(false);
                                    let has_var = input_vars.contains_key(&input.Name);
                                    if is_rev { !has_var } else { has_var }
                                })
                            });

                            if !any_group_satisfied {
                                self.fired_commands.remove(&cmd_key);
                                continue;
                            }
                        }
                    }

                    // Check if input trackers match (hardware buttons/axes bound directly to command)
                    if let Some(trackers) = &cmd.InputTrackers {
                        if !trackers.is_empty() {
                            let all_trackers_satisfied = trackers.iter().all(|tracker| {
                                if let Some(input_type) = tracker.InputType {
                                    if input_type == 2 {
                                        // Button tracker: check if button Id is active on the matching device
                                        let btn_id = tracker.Id.unwrap_or(-1);
                                        let product = tracker.Product.as_deref().unwrap_or("");
                                        let key_specific = format!("Btn_{}_{}", product, btn_id);
                                        let key_generic = format!("Btn_{}", btn_id);
                                        input_vars.contains_key(&key_specific) || input_vars.contains_key(&key_generic)
                                    } else {
                                        true
                                    }
                                } else {
                                    true
                                }
                            });

                            if !all_trackers_satisfied {
                                self.fired_commands.remove(&cmd_key);
                                continue;
                            }
                        }
                    }


                    // Check if variable conditions match
                    if let Some(cond_groups) = &cmd.Conditions {
                        if !self.evaluate_condition_groups(cond_groups) {
                            self.fired_commands.remove(&cmd_key);
                            continue;
                        }
                    }

                    // Edge trigger: only execute once per condition trigger transition
                    if self.fired_commands.contains(&cmd_key) {
                        continue;
                    }

                    // Conditions passed: execute outputs once
                    self.fired_commands.insert(cmd_key);
                    log::info!("⚡ Reactive trigger fired: [{}]", cmd.Name.as_deref().unwrap_or("Unnamed"));
                    if let Some(outputs) = &cmd.Outputs {
                        self.execute_action_outputs(outputs, profile);
                    }
                }
            }
        }
    }

    /// Executes outputs for a matched voice command.
    pub fn execute_command(&mut self, cmd: &CommandDef, profile: &LoadedProfile) {
        let cmd_name = cmd.Name.as_deref().unwrap_or("Unnamed");
        if let Some(cond_groups) = &cmd.Conditions {
            if !self.evaluate_condition_groups(cond_groups) {
                log::info!(
                    "📋 Command [{}] condition not met (Current: Step='{}', rpm='{}', Completed='{}')",
                    cmd_name,
                    self.variables.get("Step").map(|s| s.as_str()).unwrap_or("None"),
                    self.variables.get("rpm").map(|s| s.as_str()).unwrap_or("0"),
                    self.variables.get("Completed").map(|s| s.as_str()).unwrap_or("0"),
                );
                return;
            }
        }

        if let Some(outputs) = &cmd.Outputs {
            if outputs.is_empty() {
                log::info!("📋 Command [{}] acknowledged (pilot verbal acknowledgement - no audio required)", cmd_name);
            } else {
                // Execute outputs sequentially in the exact authoring order specified in the profile.
                // This ensures dialogues play in order (e.g. "Copy, standby" audio plays first,
                // followed by nested delay, keystrokes, and the follow-up confirmation audio).
                self.execute_action_outputs(outputs, profile);
            }
        } else {
            log::info!("📋 Command [{}] acknowledged (pilot verbal acknowledgement - no audio required)", cmd_name);
        }
    }

    /// Dispatches an action output: evaluating pre-delays / pre-keystrokes in nested outputs,
    /// playing audio, executing delays/keys, and applying variable updates.
    fn execute_single_output(&mut self, out: &ActionOutput, profile: &LoadedProfile) {
        // Check chance percentage (e.g. 50%)
        if let Some(chance) = out.Chance {
            let mut rng = rand::thread_rng();
            let roll: f64 = rng.gen_range(0.0..100.0);
            if roll > chance {
                return;
            }
        }

        // Check condition group if present on output
        if let Some(conds) = &out.Conditions {
            if !self.evaluate_condition_groups(conds) {
                return;
            }
        }

        // Reset variables if output specifies ResetVariables == true (e.g. Start Crew Chief)
        if out.ResetVariables == Some(true) {
            let female_val = self.variables.get("Female").cloned().unwrap_or_else(|| "False".to_string());
            self.variables.clear();
            self.variables.insert("Female".to_string(), female_val);
            self.variables.insert("Completed".to_string(), "0".to_string());
            self.variables.insert("Step".to_string(), "".to_string());
            self.variables.insert("rpm".to_string(), "0".to_string());
            log::debug!("StateEngine: ResetVariables executed");
        }

        // Update configuration if requested (e.g. Engage Chief -> "3c7a...", Cleared Off -> "0000...")
        if let Some(config_id) = &out.ConfigurationId {
            if config_id == "00000000-0000-0000-0000-000000000000" {
                self.active_configuration = None;
                log::info!("Crew Chief signed off. Intercom disconnected (Cockpit Comms active).");
                if let Some(player) = &self.audio_player {
                    player.stop();
                }
            } else {
                self.active_configuration = Some(config_id.clone());
                self.fired_commands.clear();
                log::info!("Engaged configuration: {} (Chief engaged)", config_id);
            }
        }

        // Mutate variables before audio/keys (if VariablesLast != true)
        if out.VariablesLast != Some(true) {
            if let Some(vars) = &out.Variables {
                self.apply_variable_updates(&vars.Variables);
            }
        }

        // 1. Dispatch nested child outputs FIRST (e.g. preparation delays like 4000ms pause or key sequences)
        if let Some(nested) = &out.Outputs {
            self.execute_action_outputs(nested, profile);
        }

        // 2. Dispatch self keyboard output or sleep delay
        if let Some(kind) = out.Kind {
            if let Some(val) = out.Value {
                if kind == 2 {
                    log::debug!("Output delay: {} ms", val);
                    std::thread::sleep(std::time::Duration::from_millis(val.max(0) as u64));
                } else {
                    let ext = out.IsExtendedKey.unwrap_or(false);
                    KeyboardDispatcher::dispatch_key_action(kind, val, ext);
                }
            }
        }

        // 3. Play audio if present (and await its playback so successive steps don't talk over each other)
        if let Some(run_file) = &out.RunFile {
            let primary = profile.resolve_asset_path(run_file);
            let alts: Vec<PathBuf> = out.AltFiles.as_ref()
                .unwrap_or(&Vec::new())
                .iter()
                .map(|f| profile.resolve_asset_path(f))
                .collect();

            let await_audio = out.AwaitAudio.unwrap_or(true);
            if let Some(player) = &self.audio_player {
                player.play_sound(&primary, &alts, await_audio);
            }
        }

        // Mutate variables after audio/keys if VariablesLast == true
        if out.VariablesLast == Some(true) {
            if let Some(vars) = &out.Variables {
                self.apply_variable_updates(&vars.Variables);
            }
        }
    }

    /// Executes an array of action outputs (keystrokes, audio, state updates).
    pub fn execute_action_outputs(&mut self, outputs: &[ActionOutput], profile: &LoadedProfile) {
        for out in outputs {
            // Check RunCount: BMS radial menus require repeating the menu key (e.g. RunCount="7" presses 'W' 7 times)
            // to cycle around to the desired radial menu page before pressing the selection key!
            let count = out.RunCount.as_ref()
                .and_then(|rc| rc.parse::<usize>().ok())
                .unwrap_or(1);

            for _ in 0..count {
                self.execute_single_output(out, profile);
            }
        }
    }

    fn apply_variable_updates(&mut self, updates: &[crate::fvx::models::VariableUpdateItem]) {
        for item in updates {
            if let Some(val) = &item.Value {
                if val == "+" {
                    // Increment integer variable
                    let current = self.variables.get(&item.Name).and_then(|v| v.parse::<i32>().ok()).unwrap_or(0);
                    self.variables.insert(item.Name.clone(), (current + 1).to_string());
                } else {
                    self.variables.insert(item.Name.clone(), val.clone());
                }
            } else {
                self.variables.remove(&item.Name);
            }
        }
    }

    /// Evaluates condition groups (OR across groups, AND within group).
    fn evaluate_condition_groups(&self, groups: &[ConditionGroup]) -> bool {
        if groups.is_empty() {
            return true;
        }

        // At least one condition group must pass
        groups.iter().any(|group| {
            group.Variables.iter().all(|cond| self.evaluate_single_condition(cond))
        })
    }

    fn evaluate_single_condition(&self, cond: &VariableCondition) -> bool {
        let has_var = self.variables.contains_key(&cond.Name);
        let current_val = self.variables.get(&cond.Name).cloned().unwrap_or_default();
        
        // If Value is not specified (e.g. {"Name": "Female"} or {"Name": "BMSVersionMajor"}),
        // target value is null/empty. Comparison 0 (equal) checks that the variable is NOT set (e.g. offline fallback);
        // Comparison 1 (not equal) checks that the variable IS set.
        if cond.Value.is_none() {
            let is_set = has_var && !current_val.is_empty() && !current_val.eq_ignore_ascii_case("false") && current_val != "0";
            let comp = cond.Comparison.unwrap_or(0);
            return match comp {
                0 => !is_set,
                1 => is_set,
                _ => !is_set,
            };
        }

        let target_val = cond.Value.as_deref().unwrap_or("");
        let comparison = cond.Comparison.unwrap_or(0);

        let are_equal = |c: &str, t: &str| -> bool {
            // 1. Exact or case-insensitive match
            if c.eq_ignore_ascii_case(t) {
                return true;
            }
            // 2. Numeric equality (e.g. "0.0" == "0", "65.0" == "65")
            if let (Ok(cf), Ok(tf)) = (c.parse::<f64>(), t.parse::<f64>()) {
                if (cf - tf).abs() < 1e-4 {
                    return true;
                }
            }
            // 3. Boolean equivalence (e.g. "1" == "True", "0" == "False")
            let is_truthy = |s: &str| s.eq_ignore_ascii_case("true") || s == "1" || s.eq_ignore_ascii_case("yes") || s.eq_ignore_ascii_case("on");
            let is_falsy = |s: &str| s.eq_ignore_ascii_case("false") || s == "0" || s.is_empty() || s.eq_ignore_ascii_case("no") || s.eq_ignore_ascii_case("off");
            if is_truthy(c) && is_truthy(t) {
                return true;
            }
            if is_falsy(c) && is_falsy(t) {
                return true;
            }
            false
        };

        match comparison {
            // 0: Equal
            0 => are_equal(&current_val, target_val),
            // 1: Not Equal
            1 => !are_equal(&current_val, target_val),
            // 2: Less Than
            2 => {
                if !has_var { return false; }
                let cur: f64 = current_val.parse().unwrap_or(0.0);
                let tgt: f64 = target_val.parse().unwrap_or(0.0);
                cur < tgt
            }
            // 3: Less Than or Equal
            3 => {
                if !has_var { return false; }
                let cur: f64 = current_val.parse().unwrap_or(0.0);
                let tgt: f64 = target_val.parse().unwrap_or(0.0);
                cur <= tgt
            }
            // 4: Greater Than
            4 => {
                if !has_var { return false; }
                let cur: f64 = current_val.parse().unwrap_or(0.0);
                let tgt: f64 = target_val.parse().unwrap_or(0.0);
                cur > tgt
            }
            // 5: Greater Than or Equal
            5 => {
                if !has_var { return false; }
                let cur: f64 = current_val.parse().unwrap_or(0.0);
                let tgt: f64 = target_val.parse().unwrap_or(0.0);
                cur >= tgt
            }
            _ => true,
        }
    }
}
