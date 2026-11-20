use serde::{Deserialize, Serialize};
use std::collections::HashSet;

use crate::fvx::models::FvxProfile;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum DrillStepId {
    EngageChief,
    ElecPower,
    JfsStart,
    SecCheck,
    PriVerify,
    EpuPin,
    EpuFlow,
    FlightControlsClear,
    FlcsBit,
    TrimVerify,
    TrimDisc,
    TrimConn,
    BigMovements,
    DbuCheck,
    LeftBrake,
    RightBrake,
    LeftBrakeChan2,
    RightBrakeChan2,
    AarDoor,
    ChocksRemoval,
    FinaleSalute,
}

impl DrillStepId {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::EngageChief => "ENGAGE_CHIEF",
            Self::ElecPower => "ELEC_POWER",
            Self::JfsStart => "JFS_START",
            Self::SecCheck => "SEC_CHECK",
            Self::PriVerify => "PRI_VERIFY",
            Self::EpuPin => "EPU_PIN",
            Self::EpuFlow => "EPU_FLOW",
            Self::FlightControlsClear => "FLIGHT_CONTROLS_CLEAR",
            Self::FlcsBit => "FLCS_BIT",
            Self::TrimVerify => "TRIM_VERIFY",
            Self::TrimDisc => "TRIM_DISC",
            Self::TrimConn => "TRIM_CONN",
            Self::BigMovements => "BIG_MOVEMENTS",
            Self::DbuCheck => "DBU_CHECK",
            Self::LeftBrake => "LEFT_BRAKE",
            Self::RightBrake => "RIGHT_BRAKE",
            Self::LeftBrakeChan2 => "LEFT_BRAKE_CHAN2",
            Self::RightBrakeChan2 => "RIGHT_BRAKE_CHAN2",
            Self::AarDoor => "AAR_DOOR",
            Self::ChocksRemoval => "CHOCKS_REMOVAL",
            Self::FinaleSalute => "FINALE_SALUTE",
        }
    }

    pub fn default_order() -> Vec<Self> {
        vec![
            Self::EngageChief,
            Self::ElecPower,
            Self::JfsStart,
            Self::SecCheck,
            Self::PriVerify,
            Self::EpuPin,
            Self::EpuFlow,
            Self::FlightControlsClear,
            Self::FlcsBit,
            Self::TrimVerify,
            Self::TrimDisc,
            Self::TrimConn,
            Self::BigMovements,
            Self::DbuCheck,
            Self::LeftBrake,
            Self::RightBrake,
            Self::LeftBrakeChan2,
            Self::RightBrakeChan2,
            Self::AarDoor,
            Self::ChocksRemoval,
            Self::FinaleSalute,
        ]
    }
}

impl std::str::FromStr for DrillStepId {
    type Err = ();

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "ENGAGE_CHIEF" => Ok(Self::EngageChief),
            "ELEC_POWER" => Ok(Self::ElecPower),
            "JFS_START" => Ok(Self::JfsStart),
            "SEC_CHECK" => Ok(Self::SecCheck),
            "PRI_VERIFY" => Ok(Self::PriVerify),
            "EPU_PIN" => Ok(Self::EpuPin),
            "EPU_FLOW" => Ok(Self::EpuFlow),
            "FLIGHT_CONTROLS_CLEAR" => Ok(Self::FlightControlsClear),
            "FLCS_BIT" => Ok(Self::FlcsBit),
            "TRIM_VERIFY" => Ok(Self::TrimVerify),
            "TRIM_DISC" => Ok(Self::TrimDisc),
            "TRIM_CONN" => Ok(Self::TrimConn),
            "BIG_MOVEMENTS" => Ok(Self::BigMovements),
            "DBU_CHECK" => Ok(Self::DbuCheck),
            "LEFT_BRAKE" => Ok(Self::LeftBrake),
            "RIGHT_BRAKE" => Ok(Self::RightBrake),
            "LEFT_BRAKE_CHAN2" => Ok(Self::LeftBrakeChan2),
            "RIGHT_BRAKE_CHAN2" => Ok(Self::RightBrakeChan2),
            "AAR_DOOR" => Ok(Self::AarDoor),
            "CHOCKS_REMOVAL" => Ok(Self::ChocksRemoval),
            "FINALE_SALUTE" => Ok(Self::FinaleSalute),
            _ => Err(()),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProfileCompatibility {
    Managed,
    Custom,
}

/// Inspects a profile to determine if it implements the canonical Crew Chief state machine.
pub fn detect_profile_compatibility(profile: &FvxProfile) -> ProfileCompatibility {
    let vars = crate::fvx::harvester::harvest_profile_variables(profile);
    if !vars.contains("Step") || !vars.contains("Completed") || !vars.contains("rpm") {
        return ProfileCompatibility::Custom;
    }

    let mut found_start = false;
    let mut found_sec = false;
    let mut found_epu = false;
    let mut found_bit = false;
    let mut found_cleared = false;

    for group in &profile.CommandGroups {
        for cmd in &group.Commands {
            let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
            if name.contains("ready start two") {
                found_start = true;
            } else if name.contains("clear for sec check") {
                found_sec = true;
            } else if name.contains("pull epu safety pin") {
                found_epu = true;
            } else if name.contains("cleared for bit") {
                found_bit = true;
            } else if name.contains("cleared off") {
                found_cleared = true;
            }
        }
    }

    let mut found_good_start = false;
    let mut found_nozzle_open = false;

    if let Some(kcgs) = &profile.KeyCommandGroups {
        for kcg in kcgs {
            for cmd in &kcg.Commands {
                let name = cmd.Name.as_deref().unwrap_or("").to_lowercase();
                if name.contains("good start") {
                    found_good_start = true;
                } else if name.contains("nozzle open") {
                    found_nozzle_open = true;
                }
            }
        }
    }

    if found_start
        && found_sec
        && found_epu
        && found_bit
        && found_cleared
        && found_good_start
        && found_nozzle_open
    {
        ProfileCompatibility::Managed
    } else {
        ProfileCompatibility::Custom
    }
}

/// Rewires the Crew Chief state machine in `raw_json` to follow `active_order` and disable `disabled_steps`.
pub fn reorder_crew_chief_sequence(
    raw_json: &mut serde_json::Value,
    desired_order: &[DrillStepId],
    disabled_steps: &HashSet<DrillStepId>,
) -> Result<(), String> {
    // 1. Filter the sequence into active steps in requested order
    let active_steps: Vec<DrillStepId> = desired_order
        .iter()
        .copied()
        .filter(|s| !disabled_steps.contains(s))
        .collect();

    // 2. Compute how many increment steps were disabled before key checkpoints
    // In canonical profile, increments occur at:
    // SEC_CHECK (+1), PRI_VERIFY (+1), EPU_PIN (+1), EPU_FLOW (+1),
    // FLIGHT_CONTROLS_CLEAR (+1), FLCS_BIT (+1), TRIM_VERIFY (+1),
    // TRIM_DISC (+1), TRIM_CONN (+1), BIG_MOVEMENTS (+1), DBU_CHECK (+1),
    // LEFT_BRAKE (+1), RIGHT_BRAKE (+1), AAR_DOOR (+1)

    // Checkpoints:
    // - FLIGHT_CONTROLS_CLEAR (initially requires Completed >= 4)
    // - FLCS_BIT (initially requires Completed >= 5)
    // - FINALE_SALUTE (initially requires Completed >= 12)

    // Calculate active count of increments prior to each step
    let mut cumulative_increments = 0;
    let mut flcs_clear_req: Option<i64> = None;
    let mut flcs_bit_req: Option<i64> = None;

    for step in &active_steps {
        match step {
            DrillStepId::FlightControlsClear => {
                flcs_clear_req = Some(cumulative_increments.max(0));
            }
            DrillStepId::FlcsBit => {
                flcs_bit_req = Some(cumulative_increments.max(0));
            }
            _ => {}
        }
        if step_contributes_increment(*step) {
            cumulative_increments += 1;
        }
    }
    let finale_req: i64 = cumulative_increments.max(0);

    // 3. Determine the token chaining between blocks:
    // Block A: SEC Check (Group 0 #7 & Key #1) -> PRI Verify (Group 0 #8 & Key #2)
    // Block B: EPU Pin (Group 0 #5) -> EPU Flow (Group 0 #6)
    //
    // Notice that SEC and EPU are token-linked blocks:
    // - If SEC is before EPU:
    //   Good Start sets "RDY SEC" -> SEC sets NozzleOpen -> PRI sets "EPU RDY" -> EPU Pin expects "EPU RDY" -> EPU Flow sets NextToken.
    // - If EPU is before SEC:
    //   Good Start sets "EPU RDY" -> EPU Pin expects "EPU RDY" -> EPU Flow sets "RDY SEC" -> SEC expects "RDY SEC" -> PRI sets NextToken.
    // - If EPU is disabled:
    //   Good Start sets "RDY SEC" -> SEC -> PRI sets NextToken.
    // - If SEC is disabled:
    //   Good Start sets "EPU RDY" -> EPU Pin expects "EPU RDY" -> EPU Flow sets NextToken.

    let sec_active = active_steps.contains(&DrillStepId::SecCheck)
        || active_steps.contains(&DrillStepId::PriVerify);
    let epu_active =
        active_steps.contains(&DrillStepId::EpuPin) || active_steps.contains(&DrillStepId::EpuFlow);

    let sec_pos = active_steps
        .iter()
        .position(|s| *s == DrillStepId::SecCheck || *s == DrillStepId::PriVerify);
    let epu_pos = active_steps
        .iter()
        .position(|s| *s == DrillStepId::EpuPin || *s == DrillStepId::EpuFlow);

    // Determine exit token of Good Start
    let good_start_exit = if sec_active && epu_active {
        if sec_pos.unwrap_or(0) < epu_pos.unwrap_or(0) {
            "RDY SEC"
        } else {
            "EPU RDY"
        }
    } else if sec_active {
        "RDY SEC"
    } else if epu_active {
        "EPU RDY"
    } else {
        "Flow"
    };

    // Update raw_json
    // Step A: Update Good Start in KeyCommandGroups
    if let Some(kcgs) = raw_json
        .get_mut("KeyCommandGroups")
        .and_then(|k| k.as_array_mut())
    {
        for kcg in kcgs {
            if let Some(cmds) = kcg.get_mut("Commands").and_then(|c| c.as_array_mut()) {
                for cmd in cmds {
                    let cname = cmd.get("Name").and_then(|n| n.as_str()).unwrap_or("");
                    if cname.eq_ignore_ascii_case("Good Start") {
                        if let Some(outs) = cmd.get_mut("Outputs").and_then(|o| o.as_array_mut()) {
                            for out in outs {
                                set_output_variable(out, "Step", good_start_exit);
                            }
                        }
                    } else if cname.eq_ignore_ascii_case("Nozzle Open") {
                        if let Some(outs) = cmd.get_mut("Outputs").and_then(|o| o.as_array_mut()) {
                            for out in outs {
                                // If EPU is active and after SEC, nozzle open sets "EPU RDY"
                                // If EPU is before SEC or disabled, nozzle open sets null or next token
                                if sec_active && epu_active && sec_pos < epu_pos {
                                    set_output_variable(out, "Step", "EPU RDY");
                                } else {
                                    remove_output_variable(out, "Step");
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Step B: Update CommandGroups (Voice commands)
    if let Some(cgs) = raw_json
        .get_mut("CommandGroups")
        .and_then(|c| c.as_array_mut())
    {
        for group in cgs {
            if let Some(cmds) = group.get_mut("Commands").and_then(|c| c.as_array_mut()) {
                for cmd in cmds {
                    let cname = cmd
                        .get("Name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("")
                        .to_string();
                    let step_id = map_cmd_name_to_step_id(&cname);

                    // Check if this command should be disabled
                    if let Some(sid) = step_id {
                        if disabled_steps.contains(&sid) {
                            cmd["Disabled"] = serde_json::json!(true);
                        } else {
                            cmd["Disabled"] = serde_json::json!(false);
                        }
                    }

                    // Handle EPU Flow exit token if EPU is before SEC
                    if cname.eq_ignore_ascii_case("Cleared to check for flow") {
                        if let Some(outs) = cmd.get_mut("Outputs").and_then(|o| o.as_array_mut()) {
                            for out in outs {
                                if sec_active && epu_active && epu_pos < sec_pos {
                                    set_output_variable(out, "Step", "RDY SEC");
                                } else {
                                    remove_output_variable(out, "Step");
                                }
                            }
                        }
                    }

                    // Update gate conditions for FLIGHT_CONTROLS_CLEAR
                    if cname.eq_ignore_ascii_case("Flight Controls Clear") {
                        if let Some(req) = flcs_clear_req {
                            update_command_comparison_value(cmd, "Completed", &req.to_string());
                        }
                    }

                    // Update gate conditions for FLCS_BIT
                    if cname.eq_ignore_ascii_case("Cleared for Bit") {
                        if let Some(req) = flcs_bit_req {
                            update_command_comparison_value(cmd, "Completed", &req.to_string());
                        }
                    }

                    // Update gate conditions for Cleared Off (Finale Salute)
                    if cname.eq_ignore_ascii_case("Cleared Off") {
                        update_command_comparison_value(cmd, "Completed", &finale_req.to_string());
                    }
                }
            }
        }
    }

    Ok(())
}

fn step_contributes_increment(step: DrillStepId) -> bool {
    matches!(
        step,
        DrillStepId::SecCheck
            | DrillStepId::PriVerify
            | DrillStepId::EpuPin
            | DrillStepId::EpuFlow
            | DrillStepId::FlightControlsClear
            | DrillStepId::FlcsBit
            | DrillStepId::TrimVerify
            | DrillStepId::TrimDisc
            | DrillStepId::TrimConn
            | DrillStepId::BigMovements
            | DrillStepId::DbuCheck
            | DrillStepId::LeftBrake
            | DrillStepId::RightBrake
            | DrillStepId::LeftBrakeChan2
            | DrillStepId::RightBrakeChan2
            | DrillStepId::AarDoor
    )
}

fn map_cmd_name_to_step_id(name: &str) -> Option<DrillStepId> {
    let lower = name.to_lowercase();
    if lower.contains("engage crew chief") {
        Some(DrillStepId::EngageChief)
    } else if lower.contains("comms check") {
        Some(DrillStepId::ElecPower)
    } else if lower.contains("ready start two") {
        Some(DrillStepId::JfsStart)
    } else if lower.contains("clear for sec check") {
        Some(DrillStepId::SecCheck)
    } else if lower.contains("sec check good") {
        Some(DrillStepId::PriVerify)
    } else if lower.contains("pull epu safety pin") {
        Some(DrillStepId::EpuPin)
    } else if lower.contains("cleared to check for flow") {
        Some(DrillStepId::EpuFlow)
    } else if lower.contains("flight controls clear") {
        Some(DrillStepId::FlightControlsClear)
    } else if lower.contains("cleared for bit") {
        Some(DrillStepId::FlcsBit)
    } else if lower.contains("ready for trim check") {
        Some(DrillStepId::TrimVerify)
    } else if lower.contains("trim disconnected") {
        Some(DrillStepId::TrimDisc)
    } else if lower.contains("trim connected") {
        Some(DrillStepId::TrimConn)
    } else if lower.contains("clear for big movements") {
        Some(DrillStepId::BigMovements)
    } else if lower.contains("dbu still clear") {
        Some(DrillStepId::DbuCheck)
    } else if lower.contains("ready left brake") {
        Some(DrillStepId::LeftBrake)
    } else if lower.contains("ready right brake") {
        Some(DrillStepId::RightBrake)
    } else if lower.contains("ready aar door") {
        Some(DrillStepId::AarDoor)
    } else if lower.contains("wheel chocks") {
        Some(DrillStepId::ChocksRemoval)
    } else if lower.contains("cleared off") {
        Some(DrillStepId::FinaleSalute)
    } else {
        None
    }
}

fn set_output_variable(out: &mut serde_json::Value, var_name: &str, var_val: &str) {
    if let Some(vars_obj) = out.get_mut("Variables") {
        if let Some(arr) = vars_obj.get_mut("Variables").and_then(|a| a.as_array_mut()) {
            for item in arr.iter_mut() {
                if item.get("Name").and_then(|n| n.as_str()) == Some(var_name) {
                    item["Value"] = serde_json::json!(var_val);
                    return;
                }
            }
            arr.push(serde_json::json!({
                "Name": var_name,
                "Value": var_val
            }));
            return;
        }
    }
    out["Variables"] = serde_json::json!({
        "Variables": [{
            "Name": var_name,
            "Value": var_val
        }]
    });
}

fn remove_output_variable(out: &mut serde_json::Value, var_name: &str) {
    if let Some(vars_obj) = out.get_mut("Variables") {
        if let Some(arr) = vars_obj.get_mut("Variables").and_then(|a| a.as_array_mut()) {
            arr.retain(|item| item.get("Name").and_then(|n| n.as_str()) != Some(var_name));
        }
    }
}

fn update_command_comparison_value(cmd: &mut serde_json::Value, var_name: &str, new_val: &str) {
    if let Some(conds) = cmd.get_mut("Conditions").and_then(|c| c.as_array_mut()) {
        for cond_group in conds {
            if let Some(vars) = cond_group
                .get_mut("Variables")
                .and_then(|v| v.as_array_mut())
            {
                for v in vars {
                    if v.get("Name").and_then(|n| n.as_str()) == Some(var_name) {
                        v["Value"] = serde_json::json!(new_val);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fvx::loader::LoadedProfile;

    #[test]
    fn test_signature_detection() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let loaded = LoadedProfile::load_from_file(path).expect("Failed to load profile");
        assert_eq!(
            detect_profile_compatibility(&loaded.profile),
            ProfileCompatibility::Managed
        );
    }

    #[test]
    fn test_token_bridging_and_reorder() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let mut loaded = LoadedProfile::load_from_file(path).expect("Failed to load profile");

        // Swap SEC and EPU
        let mut custom_order = DrillStepId::default_order();
        let sec_idx = custom_order
            .iter()
            .position(|s| *s == DrillStepId::SecCheck)
            .unwrap();
        let _pri_idx = custom_order
            .iter()
            .position(|s| *s == DrillStepId::PriVerify)
            .unwrap();
        let epu_pin_idx = custom_order
            .iter()
            .position(|s| *s == DrillStepId::EpuPin)
            .unwrap();
        let epu_flow_idx = custom_order
            .iter()
            .position(|s| *s == DrillStepId::EpuFlow)
            .unwrap();

        // Place EPU before SEC
        let epu_pin = custom_order.remove(epu_pin_idx);
        let epu_flow = custom_order.remove(epu_flow_idx - 1);
        custom_order.insert(sec_idx, epu_flow);
        custom_order.insert(sec_idx, epu_pin);

        let mut disabled = HashSet::new();
        disabled.insert(DrillStepId::AarDoor);
        disabled.insert(DrillStepId::DbuCheck);

        assert!(
            reorder_crew_chief_sequence(&mut loaded.raw_json, &custom_order, &disabled).is_ok()
        );

        // Validate that raw_json serializes properly and can be reloaded
        let temp_dir = std::env::temp_dir();
        let temp_fvx = temp_dir.join("test_reordered.fvx");
        loaded
            .save_to_file(&temp_fvx)
            .expect("Failed to save reordered profile");

        let reloaded =
            LoadedProfile::load_from_file(&temp_fvx).expect("Failed to reload reordered profile");
        assert_eq!(
            detect_profile_compatibility(&reloaded.profile),
            ProfileCompatibility::Managed
        );

        let _ = std::fs::remove_file(temp_fvx);
    }
}
