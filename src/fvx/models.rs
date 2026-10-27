#![allow(non_snake_case, dead_code)]

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct FvxProfile {
    pub Name: String,
    #[serde(default)]
    pub Dictionary: Option<String>,
    #[serde(default)]
    pub Culture: Option<String>,
    #[serde(default)]
    pub DefaultTTS: Option<DefaultTTS>,
    #[serde(default)]
    pub Configurations: Option<Vec<ConfigurationDef>>,
    #[serde(default)]
    pub KeyConfigurations: Option<Vec<ConfigurationDef>>,
    #[serde(default)]
    pub CommandGroups: Vec<CommandGroup>,
    #[serde(default)]
    pub KeyCommandGroups: Option<Vec<KeyCommandGroup>>,
    #[serde(default)]
    pub VariableInits: Option<Vec<VariableInit>>,
    #[serde(default)]
    pub VariableKeys: Option<Vec<VariableKeyDef>>,
    #[serde(default)]
    pub Outputs: Option<Vec<OutputDef>>,
    #[serde(default)]
    pub StartKeyEnabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct DefaultTTS {
    pub TtsText: Option<String>,
    pub Settings: Option<TtsSettings>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct TtsSettings {
    pub Voice: Option<String>,
    pub Volume: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ConfigurationDef {
    pub Id: String,
    pub Name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ConfigurationRef {
    pub Id: String,
    #[serde(default)]
    pub Disabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CommandGroup {
    pub Name: Option<String>,
    #[serde(default)]
    pub Disabled: Option<bool>,
    #[serde(default)]
    pub PushToTalk: Option<PushToTalkDef>,
    #[serde(default)]
    pub GroupCommand: Option<GroupCommandDef>,
    #[serde(default)]
    pub Conditions: Option<Vec<ConditionGroup>>,
    #[serde(default)]
    pub Commands: Vec<CommandDef>,
    #[serde(default)]
    pub Configurations: Option<Vec<ConfigurationRef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct PushToTalkDef {
    #[serde(default)]
    pub VariableInputs: Vec<VariableInputRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableInputRef {
    pub Name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct GroupCommandDef {
    #[serde(default)]
    pub VoiceCommandKeys: Vec<VoiceCommandKeySegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct CommandDef {
    pub Name: Option<String>,
    #[serde(default)]
    pub VoiceCommandKeys: Option<Vec<VoiceCommandKeySegment>>,
    #[serde(default)]
    pub Conditions: Option<Vec<ConditionGroup>>,
    #[serde(default)]
    pub Outputs: Option<Vec<ActionOutput>>,
    #[serde(default)]
    pub VariableInputs: Option<Vec<VariableInputDef>>,
    #[serde(default)]
    pub InputTrackers: Option<Vec<InputTrackerDef>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct InputTrackerDef {
    pub InputType: Option<i32>, // 1 = Axis, 2 = Button
    pub Id: Option<i32>,        // Button index or Axis index
    pub DeviceId: Option<String>,
    pub VendorId: Option<u32>,
    pub ProductId: Option<u32>,
    pub Product: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableInputDef {
    pub Name: String,
    #[serde(default)]
    pub GroupId: Option<i32>,
    #[serde(default)]
    pub Reversed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VoiceCommandKeySegment {
    #[serde(default)]
    pub Optional: Option<bool>,
    #[serde(default)]
    pub Keys: Vec<VoiceKeyItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VoiceKeyItem {
    pub Key: String,
    #[serde(default)]
    pub Exclusion: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ConditionGroup {
    #[serde(default)]
    pub Variables: Vec<VariableCondition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableCondition {
    pub Name: String,
    #[serde(default)]
    pub Value: Option<String>,
    #[serde(default)]
    pub Comparison: Option<i32>, // 0: ==, 1: !=, 2: <, 3: <=, 4: >, 5: >=
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct ActionOutput {
    pub Name: Option<String>,
    #[serde(default)]
    pub Kind: Option<i32>, // 0: KeyDown, 1: KeyUp, 2: Sleep/Delay
    #[serde(default)]
    pub Value: Option<i32>,
    #[serde(default)]
    pub IsExtendedKey: Option<bool>,
    #[serde(default)]
    pub Outputs: Option<Vec<ActionOutput>>,
    #[serde(default)]
    pub RunFile: Option<String>,
    #[serde(default)]
    pub AltFiles: Option<Vec<String>>,
    #[serde(default)]
    pub Audio: Option<bool>,
    #[serde(default)]
    pub AwaitAudio: Option<bool>,
    #[serde(default)]
    pub Chance: Option<f64>,
    #[serde(default)]
    pub Variables: Option<VariableUpdates>,
    #[serde(default)]
    pub VariablesLast: Option<bool>,
    #[serde(default)]
    pub Conditions: Option<Vec<ConditionGroup>>,
    #[serde(default)]
    pub ConfigurationId: Option<String>,
    #[serde(default)]
    pub KeyConfigurationId: Option<String>,
    #[serde(default)]
    pub ResetVariables: Option<bool>,
    #[serde(default)]
    pub CancelOutput: Option<bool>,
    #[serde(default)]
    pub RunCount: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableUpdates {
    #[serde(default)]
    pub Variables: Vec<VariableUpdateItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableUpdateItem {
    pub Name: String,
    #[serde(default)]
    pub Value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct KeyCommandGroup {
    #[serde(default)]
    pub Commands: Vec<CommandDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableInit {
    pub Name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct VariableKeyDef {
    pub Name: String,
    #[serde(default)]
    pub Keys: Vec<VoiceKeyItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct OutputDef {
    pub Name: String,
    #[serde(default)]
    pub Outputs: Vec<ActionOutput>,
}
