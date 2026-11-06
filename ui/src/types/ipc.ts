export interface AppConfig {
  profile_path?: string | null;
  polling_rate_hz: number;
  pilot_female: boolean;
  bms_key_file?: string | null;
  sapi_earcons: boolean;
  output_device?: string | null;
  input_device?: string | null;
  show_console: boolean;
  voice_recognition: boolean;
  listening_enabled: boolean;
  auto_kneeboards: boolean;
  bms_base_dir?: string | null;
  play_sound_on_update: boolean;
  custom_slots: Record<string, string>;
  check_updates_on_startup: boolean;
  github_repo: string;
  // GUI extensions
  gui_open_on_startup?: boolean;
  gui_auto_dock_on_3d?: boolean;
  gui_sound_effects?: boolean;
  gui_sound_volume?: number;
  gui_accent_color?: string;
  secondary_monitor_pin?: boolean;
  window_maximized?: boolean;
  window_size?: [number, number];
  window_pos?: [number, number] | null;
  start_with_windows?: boolean;
  auto_engage_voice?: boolean;
}

export interface SlotConfig {
  type: string;
  description?: string;
  path?: string | null;
  title?: string | null;
  subtitle?: string | null;
  header_code?: string | null;
  page_num?: string | null;
  preset?: string | null;
  stripe_color?: string | null;
  stripe_colors?: string[] | null;
  header_color?: string | null;
  spaced?: boolean | null;
  notes?: string | string[] | null;
  content?: string;
  reason?: string | null;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  category: 'notes' | 'checklist' | 'chart';
  path: string;
  description: string;
  default_title: string;
  default_code: string;
  type?: string;
  title?: string;
  header_code?: string;
  preset?: string;
  stripe_color?: string;
}

export interface QuickStamp {
  id: string;
  label: string;
  template: string;
}

export interface TelemetryData {
  bms_running: boolean;
  is_3d: boolean;
  theater: string;
  callsign: string;
  uhf_freq: string;
  vhf_freq: string;
  steerpoint_num: number;
  bullseye_bearing: number;
  bullseye_distance: number;
  mic_vu_level: number;
  pitch_axis?: number;
  roll_axis?: number;
  yaw_axis?: number;
  left_brake?: number;
  right_brake?: number;
  ptt_com1?: boolean;
  ptt_com2?: boolean;
  active_buttons?: number[];
  mpo_active?: boolean;
}

export interface StateSnapshot {
  config: AppConfig;
  profile_name: string;
  profile_path?: string;
  bms_connected: boolean;
  is_3d: boolean;
  kneeboard_slots?: Record<string, SlotConfig>;
  available_templates?: TemplateMetadata[];
  custom_templates?: TemplateMetadata[];
  custom_stamps?: QuickStamp[];
  mpo_button?: number;
  mpo_device?: string;
  mpo_is_key?: boolean;
  bms_mpo_binding?: string | null;
}

export type MasterMode = 'binder' | 'comms' | 'hardware' | 'system';
