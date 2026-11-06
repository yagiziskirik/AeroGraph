use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::AppConfig;
use crate::kneeboard::layout::SlotConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", content = "payload")]
pub enum IpcRequest {
    // Window controls
    DragWindow,
    ResizeWindow {
        direction: String,
    },
    MinimizeWindow,
    ToggleMaximize,
    CloseWindow,
    WindowReady,

    // Initial state & Configuration
    GetInitialState,
    UpdateConfig(Box<AppConfig>),
    SetListening {
        active: bool,
    },
    SetVoiceRecognition {
        enabled: bool,
    },
    SetAutoKneeboards {
        enabled: bool,
    },
    SetSoundSettings {
        enabled: bool,
        volume: f32,
    },
    SetAccentColor {
        color: String,
    },

    // Kneeboard operations
    CommitKneeboardLayout {
        slots: HashMap<String, SlotConfig>,
    },
    TriggerRegeneration,
    GetTemplateContent {
        path: String,
    },

    // Custom Templates & Stamps Persistence
    SaveCustomTemplate {
        template: TemplateMetadata,
        content: String,
    },
    DeleteCustomTemplate {
        id: String,
    },
    SaveCustomStamp {
        stamp: QuickStamp,
    },
    DeleteCustomStamp {
        id: String,
    },
    ResetCustomStamps,

    // Presets
    ExportPreset {
        file_path: String,
        name: String,
        description: String,
        theater: String,
    },
    ImportPreset {
        file_path: String,
    },
    LoadBuiltinPreset {
        preset_id: String,
    },

    // Voice & Hardware
    SelectProfileFile,
    ReloadProfile,
    ResetDefaultProfile,
    TestVoiceAudio {
        phrase: String,
    },
    StartPttBinding,
    StartMpoBinding,
    CancelMpoBinding,
    SetMpoButton {
        button: u32,
        device: Option<String>,
    },
    ResetMpoBinding,
    ImportMpoFromBms,
    SetMpoKey {
        key_code: u32,
        modifiers: u32,
    },

    // Diagnostics & System
    OpenLogFile,
    GetConsoleLogs,
    OpenImagesFolder,
    ToggleConsole,
    CheckUpdates,
    EditKneeboards,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickStamp {
    pub id: String,
    pub label: String,
    pub template: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMetadata {
    pub id: String,
    pub name: String,
    pub category: String, // "notes", "checklist", "chart"
    pub path: String,
    pub description: String,
    pub default_title: String,
    pub default_code: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TelemetryData {
    pub bms_running: bool,
    pub is_3d: bool,
    pub theater: String,
    pub callsign: String,
    pub uhf_freq: String,
    pub vhf_freq: String,
    pub steerpoint_num: u32,
    pub bullseye_bearing: f32,
    pub bullseye_distance: f32,
    pub mic_vu_level: f32,
    pub pitch_axis: f32,
    pub roll_axis: f32,
    pub yaw_axis: f32,
    pub left_brake: f32,
    pub right_brake: f32,
    pub ptt_com1: bool,
    pub ptt_com2: bool,
    pub active_buttons: Vec<u32>,
    pub mpo_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateSnapshot {
    pub config: AppConfig,
    pub profile_name: String,
    pub profile_path: String,
    pub bms_connected: bool,
    pub is_3d: bool,
    pub kneeboard_slots: HashMap<String, SlotConfig>,
    pub available_templates: Vec<TemplateMetadata>,
    pub custom_templates: Vec<TemplateMetadata>,
    pub custom_stamps: Vec<QuickStamp>,
    pub mpo_button: u32,
    pub mpo_device: String,
    #[serde(default)]
    pub mpo_is_key: bool,
    #[serde(default)]
    pub bms_mpo_binding: Option<String>,
}

impl IpcRequest {
    pub fn parse(json_str: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json_str)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_parsing() {
        let close: IpcRequest =
            IpcRequest::parse(r#"{"action":"CloseWindow","payload":null}"#).unwrap();
        assert!(matches!(close, IpcRequest::CloseWindow));

        let close_no_payload: IpcRequest =
            IpcRequest::parse(r#"{"action":"CloseWindow"}"#).unwrap();
        assert!(matches!(close_no_payload, IpcRequest::CloseWindow));

        let max: IpcRequest = IpcRequest::parse(r#"{"action":"ToggleMaximize"}"#).unwrap();
        assert!(matches!(max, IpcRequest::ToggleMaximize));

        let listen: IpcRequest =
            IpcRequest::parse(r#"{"action":"SetListening","payload":{"active":true}}"#).unwrap();
        if let IpcRequest::SetListening { active } = listen {
            assert!(active);
        } else {
            panic!("Expected SetListening");
        }

        let accent: IpcRequest =
            IpcRequest::parse(r#"{"action":"SetAccentColor","payload":{"color":"rad-cyan"}}"#)
                .unwrap();
        if let IpcRequest::SetAccentColor { color } = accent {
            assert_eq!(color, "rad-cyan");
        } else {
            panic!("Expected SetAccentColor");
        }
    }
}
