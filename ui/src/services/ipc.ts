import { AppConfig, SlotConfig } from '../types/ipc';
import { AVAILABLE_TEMPLATES_CATALOG, DEFAULT_DEV_SLOTS, EMBEDDED_NOTES } from './templatesData';

// Declare Wry window IPC
declare global {
  interface Window {
    ipc?: {
      postMessage: (msg: string) => void;
    };
    __AEROGRAPH_RECEIVE_EVENT__?: (event: string, data: any) => void;
  }
}

type EventCallback = (data: any) => void;
const eventListeners: Map<string, Set<EventCallback>> = new Map();

// Initialize IPC event bridge
if (typeof window !== 'undefined') {
  window.__AEROGRAPH_RECEIVE_EVENT__ = (eventName: string, data: any) => {
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  };
}

export const Ipc = {
  send(action: string, payload: any = null) {
    const message = JSON.stringify({ action, payload });
    if (typeof window !== 'undefined' && window.ipc) {
      window.ipc.postMessage(message);
    } else {
      console.log(`[IPC DEV DISPATCH] ${action}`, payload);
      // Simulate backend response in Next.js browser dev mode
      if (action === 'GetInitialState') {
        setTimeout(() => {
          const listeners = eventListeners.get('StateSnapshot');
          if (listeners) {
            listeners.forEach((cb) =>
              cb({
                config: {
                  polling_rate_hz: 25,
                  pilot_female: false,
                  sapi_earcons: false,
                  show_console: false,
                  voice_recognition: true,
                  listening_enabled: true,
                  auto_kneeboards: true,
                  play_sound_on_update: true,
                  custom_slots: {},
                  check_updates_on_startup: true,
                  github_repo: 'yagiziskirik/AeroGraph',
                  gui_open_on_startup: false,
                  gui_auto_dock_on_3d: true,
                  gui_sound_effects: true,
                  gui_sound_volume: 0.5,
                  gui_accent_color: '#10B981',
                },
                profile_name: 'Falcon BMS 4.38 v1.3.1',
                profile_path: 'assets/profiles/Falcon BMS 4.38 v1.3.1/VCC/FalconBMS.fvx',
                bms_connected: false,
                is_3d: false,
                kneeboard_slots: DEFAULT_DEV_SLOTS,
                available_templates: AVAILABLE_TEMPLATES_CATALOG,
                custom_templates: [],
                custom_stamps: [
                  { id: 'bingo', label: 'BINGO 2500', template: 'BINGO FUEL: {red: 2500 LBS} // JOKER: {yellow: 3200 LBS}' },
                  { id: 'laser', label: 'LASER 1688', template: 'PRIMARY LASER PRF: {green: 1688}' },
                  { id: 'ramrod', label: 'RAMROD', template: 'RAMROD CODE: {blue: CHARLIE}' },
                  { id: 'roe', label: 'ROE 25NM', template: 'ROE: Weapons Free beyond {green: 25NM} from Bullseye' },
                  { id: 'threat', label: 'SAM THREAT', template: 'WARNING: {highlight: Active SA-10 Grumble} tracking near STPT' },
                  { id: 'ip_vector', label: 'IP VECTOR', template: 'TGT IP: Bearing {blue: 045} / Distance {blue: 12NM} / Pullup 18,000 FT' },
                ],
                mpo_button: 8,
                mpo_device: 'F16 TQS by YGZ',
              })
            );
          }
        }, 30);
      } else if (action === 'GetTemplateContent' && payload?.path) {
        setTimeout(() => {
          const content = EMBEDDED_NOTES[payload.path] || '';
          const listeners = eventListeners.get('TemplateContent');
          if (listeners) {
            listeners.forEach((cb) => cb({ path: payload.path, content }));
          }
        }, 20);
      }
    }
  },

  on(eventName: string, callback: EventCallback) {
    if (!eventListeners.has(eventName)) {
      eventListeners.set(eventName, new Set());
    }
    eventListeners.get(eventName)!.add(callback);
    return () => {
      eventListeners.get(eventName)?.delete(callback);
    };
  },

  // Window Controls
  dragWindow() {
    this.send('DragWindow');
  },
  resizeWindow(direction: string) {
    this.send('ResizeWindow', { direction });
  },
  minimize() {
    this.send('MinimizeWindow');
  },
  toggleMaximize() {
    this.send('ToggleMaximize');
  },
  close() {
    this.send('CloseWindow');
  },

  // Configuration
  getInitialState() {
    this.send('GetInitialState');
  },
  updateConfig(config: AppConfig) {
    this.send('UpdateConfig', config);
  },
  setListening(active: boolean) {
    this.send('SetListening', { active });
  },
  setVoiceRecognition(enabled: boolean) {
    this.send('SetVoiceRecognition', { enabled });
  },
  setAutoKneeboards(enabled: boolean) {
    this.send('SetAutoKneeboards', { enabled });
  },
  setSoundSettings(enabled: boolean, volume: number) {
    this.send('SetSoundSettings', { enabled, volume });
  },
  setAccentColor(color: string) {
    this.send('SetAccentColor', { color });
  },

  // Kneeboards
  commitKneeboardLayout(slots: Record<string, SlotConfig>) {
    this.send('CommitKneeboardLayout', { slots });
  },
  triggerRegeneration() {
    this.send('TriggerRegeneration');
  },
  regenerateKneeboards() {
    this.send('TriggerRegeneration');
  },
  updateSlot(slotKey: string, slot: SlotConfig) {
    this.send('UpdateSlot', { slot_key: slotKey, slot });
  },
  revertSlotToDefault(slotKey: string) {
    this.send('RevertSlotToDefault', { slot_key: slotKey });
  },
  getTemplateContent(path: string) {
    this.send('GetTemplateContent', { path });
  },
  saveCustomTemplate(template: any, content: string) {
    this.send('SaveCustomTemplate', { template, content });
  },
  deleteCustomTemplate(id: string) {
    this.send('DeleteCustomTemplate', { id });
  },
  saveCustomStamp(stamp: any) {
    this.send('SaveCustomStamp', { stamp });
  },
  deleteCustomStamp(id: string) {
    this.send('DeleteCustomStamp', { id });
  },
  resetCustomStamps() {
    this.send('ResetCustomStamps');
  },

  // Presets
  exportPreset(name: string, description: string, theater: string, color: string = '#10B981', filePath: string = '') {
    this.send('ExportPreset', { file_path: filePath, name, description, theater, color });
  },
  importPreset(filePath: string = '') {
    this.send('ImportPreset', { file_path: filePath });
  },
  loadBuiltinPreset(presetId: string) {
    this.send('LoadBuiltinPreset', { preset_id: presetId });
  },
  saveCustomPreset(preset: any) {
    this.send('SaveCustomPreset', { preset });
  },
  deleteCustomPreset(id: string) {
    this.send('DeleteCustomPreset', { id });
  },
  applyCustomPreset(id: string) {
    this.send('ApplyCustomPreset', { id });
  },

  // Voice & Hardware
  selectProfileFile() {
    this.send('SelectProfileFile');
  },
  reloadProfile() {
    this.send('ReloadProfile');
  },
  resetDefaultProfile() {
    this.send('ResetDefaultProfile');
  },
  testVoiceAudio(phrase: string) {
    this.send('TestVoiceAudio', { phrase });
  },
  startPttBinding() {
    this.send('StartPttBinding');
  },
  startMpoBinding() {
    this.send('StartMpoBinding');
  },
  cancelMpoBinding() {
    this.send('CancelMpoBinding');
  },
  setMpoButton(button: number, device?: string) {
    this.send('SetMpoButton', { button, device });
  },
  resetMpoBinding() {
    this.send('ResetMpoBinding');
  },
  importMpoFromBms() {
    this.send('ImportMpoFromBms');
  },
  setMpoKey(keyCode: number, modifiers: number) {
    this.send('SetMpoKey', { key_code: keyCode, modifiers });
  },

  // Diagnostics & Logs
  setUiMode(mode: string) {
    this.send('SetUiMode', { mode });
  },
  openLogFile() {
    this.send('OpenLogFile');
  },
  getConsoleLogs() {
    this.send('GetConsoleLogs');
  },
  openImagesFolder() {
    this.send('OpenImagesFolder');
  },
  toggleConsole() {
    this.send('ToggleConsole');
  },
  checkUpdates() {
    this.send('CheckUpdates');
  },
  editKneeboards() {
    this.send('EditKneeboards');
  },
  windowReady() {
    this.send('WindowReady');
  },
};
