use std::collections::HashSet;

use crate::fvx::models::{ActionOutput, ConditionGroup, FvxProfile};

/// Traverses an entire FoxVox profile and returns the unique set of all variable names
/// that are declared in `VariableInits`, queried in `Conditions`, or mutated in `Outputs`.
pub fn harvest_profile_variables(profile: &FvxProfile) -> HashSet<String> {
    let mut names = HashSet::new();

    // 1. Initialized variables
    if let Some(inits) = &profile.VariableInits {
        for init in inits {
            if !init.Name.trim().is_empty() {
                names.insert(init.Name.trim().to_string());
            }
        }
    }

    // 2. Command Groups (Voice commands)
    for group in &profile.CommandGroups {
        collect_from_condition_groups(&group.Conditions, &mut names);
        for cmd in &group.Commands {
            collect_from_condition_groups(&cmd.Conditions, &mut names);
            if let Some(outputs) = &cmd.Outputs {
                collect_from_action_outputs(outputs, &mut names);
            }
        }
    }

    // 3. Key Command Groups (Hardware / button triggers)
    if let Some(key_groups) = &profile.KeyCommandGroups {
        for kg in key_groups {
            for cmd in &kg.Commands {
                collect_from_condition_groups(&cmd.Conditions, &mut names);
                if let Some(outputs) = &cmd.Outputs {
                    collect_from_action_outputs(outputs, &mut names);
                }
            }
        }
    }

    names
}

fn collect_from_condition_groups(
    cond_groups: &Option<Vec<ConditionGroup>>,
    names: &mut HashSet<String>,
) {
    if let Some(groups) = cond_groups {
        for grp in groups {
            for v in &grp.Variables {
                let trimmed = v.Name.trim();
                if !trimmed.is_empty() {
                    names.insert(trimmed.to_string());
                }
            }
        }
    }
}

fn collect_from_action_outputs(outputs: &[ActionOutput], names: &mut HashSet<String>) {
    for out in outputs {
        collect_from_condition_groups(&out.Conditions, names);

        if let Some(var_updates) = &out.Variables {
            for item in &var_updates.Variables {
                let trimmed = item.Name.trim();
                if !trimmed.is_empty() {
                    names.insert(trimmed.to_string());
                }
            }
        }

        if let Some(nested) = &out.Outputs {
            collect_from_action_outputs(nested, names);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fvx::loader::LoadedProfile;

    #[test]
    fn test_harvest_official_profile() {
        let path = "assets/profiles/Falcon BMS 4.38 v1.3.1/Falcon BMS 4.38 v1.3.1.fvx";
        let loaded = LoadedProfile::load_from_file(path).expect("Failed to load official profile");
        let vars = harvest_profile_variables(&loaded.profile);

        // Verify key simulation and comms variables were harvested
        assert!(vars.contains("Tanker"));
        assert!(vars.contains("Awacs"));
        assert!(vars.contains("AISeat2"));
        assert!(vars.contains("In3D"));
        assert!(vars.contains("rpm"));
        assert!(vars.contains("Female"));
        assert!(vars.contains("Step"));
        assert!(vars.contains("Completed"));
    }
}
