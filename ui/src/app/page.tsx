'use client';

import React, { useEffect, useState } from 'react';
import { ChassisBar } from '../components/ChassisBar';
import { MasterModeBar } from '../components/MasterModeBar';
import { BinderView } from '../views/BinderView';
import { CommsView } from '../views/CommsView';
import { HardwareView } from '../views/HardwareView';
import { SystemView } from '../views/SystemView';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { AppConfig, CustomPreset, MasterMode, QuickStamp, SlotConfig, TelemetryData, TemplateMetadata } from '../types/ipc';

const DEFAULT_CONFIG: AppConfig = {
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
  start_with_windows: false,
  auto_engage_voice: true,
};

const DEFAULT_TELEMETRY: TelemetryData = {
  bms_running: false,
  is_3d: false,
  theater: 'Korea 4.38',
  callsign: 'VIPER 1-1',
  uhf_freq: '305.000',
  vhf_freq: '121.500',
  steerpoint_num: 2,
  bullseye_bearing: 45,
  bullseye_distance: 32.4,
  mic_vu_level: 0.0,
  pitch_axis: 0.5,
  roll_axis: 0.5,
  yaw_axis: 0.5,
  left_brake: 0.0,
  right_brake: 0.0,
  ptt_com1: false,
  ptt_com2: false,
  active_buttons: [],
  mpo_active: false,
};

export default function Home() {
  const [currentMode, setCurrentMode] = useState<MasterMode>('binder');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const paramMode = new URLSearchParams(window.location.search).get('mode') as MasterMode;
      if (paramMode && ['binder', 'comms', 'hardware', 'system'].includes(paramMode)) {
        setCurrentMode(paramMode);
      }
    }
  }, []);

  useEffect(() => {
    Ipc.setUiMode(currentMode);
  }, [currentMode]);

  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [profileName, setProfileName] = useState<string>('Standard Falcon BMS 4.38');
  const [profilePath, setProfilePath] = useState<string>('');
  const [telemetry, setTelemetry] = useState<TelemetryData>(DEFAULT_TELEMETRY);
  const [realAudioLevel, setRealAudioLevel] = useState<number>(0);
  const [lightingMode, setLightingMode] = useState<'day' | 'nvg' | 'red'>('day');
  const [accentColor, setAccentColor] = useState<string>('#10B981');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [soundVolume, setSoundVolume] = useState<number>(0.5);
  const [kneeboardSlots, setKneeboardSlots] = useState<Record<string, SlotConfig>>({});
  const [availableTemplates, setAvailableTemplates] = useState<TemplateMetadata[]>([]);
  const [customTemplates, setCustomTemplates] = useState<TemplateMetadata[]>([]);
  const [customStamps, setCustomStamps] = useState<QuickStamp[]>([]);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [mpoButton, setMpoButton] = useState<number | undefined>(undefined);
  const [mpoDevice, setMpoDevice] = useState<string | undefined>(undefined);
  const [mpoIsKey, setMpoIsKey] = useState<boolean>(false);
  const [bmsMpoBinding, setBmsMpoBinding] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  useEffect(() => {
    // Request initial state on mount
    Ipc.getInitialState();

    // Listen for state snapshot from Rust backend
    const unsubState = Ipc.on('StateSnapshot', (data: any) => {
      if (data.config) setConfig(data.config);
      if (data.profile_name) setProfileName(data.profile_name);
      if (data.profile_path) setProfilePath(data.profile_path);
      if (data.kneeboard_slots) setKneeboardSlots(data.kneeboard_slots);
      if (data.available_templates) setAvailableTemplates(data.available_templates);
      if (data.custom_templates) setCustomTemplates(data.custom_templates);
      if (data.custom_stamps) setCustomStamps(data.custom_stamps);
      if (data.custom_presets) setCustomPresets(data.custom_presets);
      if (data.mpo_button !== undefined) setMpoButton(data.mpo_button);
      if (data.mpo_device) setMpoDevice(data.mpo_device);
      if (data.mpo_is_key !== undefined) setMpoIsKey(data.mpo_is_key);
      if (data.bms_mpo_binding !== undefined) setBmsMpoBinding(data.bms_mpo_binding);
      if (data.generated_images) setGeneratedImages(data.generated_images);
      if (data.config?.gui_accent_color) {
        setAccentColor(data.config.gui_accent_color);
        applyAccentColor(data.config.gui_accent_color);
      }
      if (data.config?.gui_sound_effects !== undefined) {
        setSoundEnabled(data.config.gui_sound_effects);
        Sound.setSettings(data.config.gui_sound_effects, data.config.gui_sound_volume ?? 0.5);
      }
      if (data.config?.gui_sound_volume !== undefined) {
        setSoundVolume(data.config.gui_sound_volume);
      }
    });

    // Listen for high-frequency telemetry from Rust backend
    const unsubTelemetry = Ipc.on('TelemetryUpdate', (data: TelemetryData) => {
      setTelemetry((prev) => ({ ...prev, ...data }));
    });

    // Listen for real-time continuous audio peak level from Option A (CoreAudio)
    const unsubAudio = Ipc.on('AudioLevel', (val: any) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (!isNaN(num)) {
        setRealAudioLevel(num);
      }
    });

    // Listen for listening toggle
    const unsubListening = Ipc.on('ListeningChanged', (data: any) => {
      const active = typeof data === 'boolean' ? data : (data?.listening_enabled ?? false);
      setConfig((prev) => ({ ...prev, listening_enabled: active }));
    });

    // Listen for MPO binding captured from hardware
    const unsubMpo = Ipc.on('MpoBindingCaptured', (data: { button: number; device: string; is_key?: boolean }) => {
      if (data && data.button !== undefined) {
        setMpoButton(data.button);
        if (data.device) setMpoDevice(data.device);
        setMpoIsKey(!!data.is_key);
      }
    });

    // Remove instant splash screen smoothly & signal backend that window is ready
    const splash = document.getElementById('aerograph-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 250);
    }
    Ipc.windowReady();

    return () => {
      unsubState();
      unsubTelemetry();
      unsubAudio();
      unsubListening();
      unsubMpo();
    };
  }, []);

  const applyAccentColor = (hex: string) => {
    document.documentElement.style.setProperty('--accent-color', hex);
    const clean = hex.replace('#', '');
    if (clean.length === 6) {
      const r = parseInt(clean.substring(0, 2), 16);
      const g = parseInt(clean.substring(2, 4), 16);
      const b = parseInt(clean.substring(4, 6), 16);
      document.documentElement.style.setProperty('--accent-rgb', `${r} ${g} ${b}`);
      document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.35)`);
    }
  };

  const handleSelectAccent = (color: string) => {
    setAccentColor(color);
    applyAccentColor(color);
    Ipc.setAccentColor(color);
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    Sound.setSettings(enabled, soundVolume);
    Ipc.setSoundSettings(enabled, soundVolume);
  };

  const handleChangeVolume = (volume: number) => {
    setSoundVolume(volume);
    Sound.setSettings(soundEnabled, volume);
    Ipc.setSoundSettings(soundEnabled, volume);
  };

  return (
    <main
      className="h-screen w-screen flex flex-col bg-[#0A0A0C] overflow-hidden font-sans select-none relative"
      style={{ '--accent-color': accentColor } as React.CSSProperties}
    >
      {/* Borderless Window Drag-Resize Handles */}
      <div onMouseDown={() => Ipc.resizeWindow('n')} className="fixed top-0 left-3 right-3 h-2 cursor-n-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('s')} className="fixed bottom-0 left-3 right-3 h-2 cursor-s-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('w')} className="fixed left-0 top-3 bottom-3 w-2 cursor-w-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('e')} className="fixed right-0 top-3 bottom-3 w-2 cursor-e-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('nw')} className="fixed top-0 left-0 w-3 h-3 cursor-nw-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('ne')} className="fixed top-0 right-0 w-3 h-3 cursor-ne-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('sw')} className="fixed bottom-0 left-0 w-3 h-3 cursor-sw-resize z-50 pointer-events-auto" />
      <div onMouseDown={() => Ipc.resizeWindow('se')} className="fixed bottom-0 right-0 w-3 h-3 cursor-se-resize z-50 pointer-events-auto" />
      {/* 1. Chassis Top-Grip Bar with Official Logo & Window Controls */}
      <ChassisBar
        bmsConnected={telemetry.bms_running}
        is3d={telemetry.is_3d}
        listeningActive={config.listening_enabled}
        voiceEnabled={config.voice_recognition}
        voiceLevel={
          config.voice_recognition && config.listening_enabled
            ? realAudioLevel > 0
              ? realAudioLevel
              : (telemetry.mic_vu_level ?? 0)
            : 0
        }
      />

      {/* 2. Mode Selector Bar (Kneeboard Binder, Crew Chief BIT, FoxVox Comms, Cockpit Settings) */}
      <MasterModeBar
        currentMode={currentMode}
        onSelectMode={setCurrentMode}
        listeningActive={config.listening_enabled}
        voiceEnabled={config.voice_recognition}
      />

      {/* 3. Active Mode Viewport (Keep mounted to preserve staged edits, zoom, and active preset state across tabs) */}
      <div className="flex-1 w-full overflow-hidden relative min-h-0">
        <div className={`h-full w-full ${currentMode === 'binder' ? 'block' : 'hidden'}`}>
          <BinderView
            initialSlots={kneeboardSlots}
            availableTemplates={availableTemplates}
            customTemplates={customTemplates}
            customStamps={customStamps}
            customPresets={customPresets}
            accentColor={accentColor}
            onSelectAccent={handleSelectAccent}
            generatedImages={generatedImages}
          />
        </div>

        <div className={`h-full w-full ${currentMode === 'hardware' ? 'block' : 'hidden'}`}>
          <HardwareView
            config={config}
            telemetry={telemetry}
            mpoButton={mpoButton}
            mpoDevice={mpoDevice}
            mpoIsKey={mpoIsKey}
            bmsMpoBinding={bmsMpoBinding}
          />
        </div>

        <div className={`h-full w-full ${currentMode === 'comms' ? 'block' : 'hidden'}`}>
          <CommsView
            config={config}
            onUpdateConfig={setConfig}
            profileName={profileName}
            profilePath={profilePath}
            telemetry={telemetry}
          />
        </div>

        <div className={`h-full w-full ${currentMode === 'system' ? 'block' : 'hidden'}`}>
          <SystemView
            config={config}
            onUpdateConfig={setConfig}
            accentColor={accentColor}
            onSelectAccent={handleSelectAccent}
            soundEnabled={soundEnabled}
            soundVolume={soundVolume}
            onToggleSound={handleToggleSound}
            onChangeVolume={handleChangeVolume}
          />
        </div>
      </div>
    </main>
  );
}
