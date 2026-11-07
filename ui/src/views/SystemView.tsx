'use client';

import React, { useState, useEffect } from 'react';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { AppConfig } from '../types/ipc';
import {
  MechanicalToggle,
  VolumeSlider,
} from '../components/inputs';
import pkg from '../../package.json';
import { AVIONICS_THEME_PALETTE } from '../services/templatesData';

interface SystemViewProps {
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  accentColor: string;
  onSelectAccent: (color: string) => void;
  soundEnabled: boolean;
  soundVolume: number;
  onToggleSound: (enabled: boolean) => void;
  onChangeVolume: (volume: number) => void;
}

const THEMES = AVIONICS_THEME_PALETTE;

export const SystemView: React.FC<SystemViewProps> = ({
  config,
  onUpdateConfig,
  accentColor,
  onSelectAccent,
  soundEnabled,
  soundVolume,
  onToggleSound,
  onChangeVolume,
}) => {
  const [consoleLogsOpen, setConsoleLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = Ipc.on('ConsoleLogs', (data: { lines: string[] }) => {
      if (data && Array.isArray(data.lines)) {
        setLogLines(data.lines);
      }
    });
    return unsub;
  }, []);

  // Auto-refresh logs periodically while the console viewer modal is open
  useEffect(() => {
    if (!consoleLogsOpen) return;
    Ipc.getConsoleLogs();
    const interval = setInterval(() => {
      Ipc.getConsoleLogs();
    }, 1500);
    return () => clearInterval(interval);
  }, [consoleLogsOpen]);

  // Keep terminal scrolled to the bottom (latest logs) by default
  useEffect(() => {
    if (consoleLogsOpen && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines, consoleLogsOpen]);

  const handleOpenConsoleLogsModal = () => {
    Sound.playClick();
    setConsoleLogsOpen(true);
    Ipc.getConsoleLogs();
  };

  const handleOpenLogFile = () => {
    Sound.playSwitch();
    Ipc.openLogFile();
  };

  const toggleSetting = (key: keyof AppConfig) => {
    Sound.playSwitch();
    const updated = { ...config, [key]: !config[key] };
    onUpdateConfig(updated);
    Ipc.updateConfig(updated);
  };

  return (
    <div className="h-full w-full p-5 bg-[#0A0A0C] flex flex-col space-y-4 select-none overflow-y-auto font-sans">
      {/* 1. Cockpit Luminescence Theme Engine */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                AVIONICS LUMINESCENCE THEME ENGINE // HUD & DED TINT
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Calibrated phosphor palettes across HUD readouts, DED indicators, and kneepad tabs.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {THEMES.map((theme) => {
            const isSelected = accentColor.toLowerCase() === theme.id.toLowerCase();
            return (
              <div
                key={theme.id}
                onClick={() => {
                  Sound.playClick();
                  onSelectAccent(theme.id);
                }}
                className={`p-3 rounded border flex items-center space-x-3 cursor-pointer transition-colors will-change-composite ${
                  isSelected
                    ? 'bg-[#1E1E22] border-accent shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-[#18181B] border-white/[0.06] hover:bg-[#27272A] hover:border-white/[0.15]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full shrink-0 flex items-center justify-center border ${
                    isSelected ? 'ring-2 ring-accent ring-offset-2 ring-offset-black' : 'border-white/10'
                  }`}
                  style={{ backgroundColor: theme.id }}
                >
                  {isSelected && <span className="text-[9px] text-black font-bold">✓</span>}
                </div>
                <div className="flex-1 min-w-0 font-mono">
                  <div className={`font-semibold text-xs tracking-wide ${isSelected ? 'text-accent' : 'text-white'}`}>
                    {theme.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {theme.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Cockpit Acoustic Feedback Relays */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
          <div>
            <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
              COCKPIT ACOUSTIC FEEDBACK RELAYS // MECHANICAL TRANSIENTS
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Physical switch clicks, relay clunks, and page rustles synthesized in real-time via Web Audio API.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              Sound.playClick();
              Sound.playCommit();
            }}
            className="h-7 px-3 rounded bg-[#18181B] hover:bg-[#1E1E22] border border-white/[0.08] text-white font-mono text-[11px] transition-colors cursor-pointer"
          >
            TEST RELAY CLUNK / CHIME
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Master Relay Audio Toggle */}
          <div
            onClick={() => {
              Sound.playSwitch();
              onToggleSound(!soundEnabled);
            }}
            className="flex items-center justify-between p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-mono font-semibold text-xs tracking-wide">
                MECHANICAL SWITCH DETENTS
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                Acoustic feedback on button clicks, mode shifts, and tabs.
              </div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={soundEnabled}
                interactive={false}
              />
            </div>
          </div>

          {/* Volume Slider */}
          <div className="flex items-center justify-between p-3 rounded bg-[#18181B] border border-white/[0.06]">
            <div>
              <div className="text-white font-mono font-semibold text-xs tracking-wide">
                RELAY AUDIO VOLUME
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
                Current level: {Math.round(soundVolume * 100)}%
              </div>
            </div>
            <VolumeSlider
              value={soundVolume}
              step={0.01}
              onChangeValue={(val) => onChangeVolume(val)}
            />
          </div>
        </div>
      </div>

      {/* 3. Sim Flight Automation & Background Dormancy */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="pb-3 border-b border-white/[0.08] mb-3">
          <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
            FLIGHT SIM AUTOMATION & ZERO-COST DORMANCY
          </h3>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            Automatic background sleep and startup behavior governance.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 font-mono text-xs">
          {/* 3D Auto-Dock */}
          <div
            onClick={() => toggleSetting('gui_auto_dock_on_3d')}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">3D AUTO-DOCK</div>
              <div className="text-[10px] text-zinc-500">Zero CPU/GPU in 3D flight</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.gui_auto_dock_on_3d}
                interactive={false}
              />
            </div>
          </div>

          {/* Auto-Kneeboards */}
          <div
            onClick={() => toggleSetting('auto_kneeboards')}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">AUTO-KNEEBOARDS</div>
              <div className="text-[10px] text-zinc-500">Regen on briefing change</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.auto_kneeboards}
                interactive={false}
              />
            </div>
          </div>

          {/* BMS Auto-Engage Voice */}
          <div
            onClick={() => toggleSetting('auto_engage_voice')}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">AUTO-ENGAGE VOICE</div>
              <div className="text-[10px] text-zinc-500">Engage on BMS detect</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.auto_engage_voice ?? true}
                interactive={false}
              />
            </div>
          </div>

          {/* Foreground Startup */}
          <div
            onClick={() => toggleSetting('gui_open_on_startup')}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">FOREGROUND BOOT</div>
              <div className="text-[10px] text-zinc-500">Open UI on launch</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.gui_open_on_startup}
                interactive={false}
              />
            </div>
          </div>

          {/* Start with Windows Auto-Start */}
          <div
            onClick={() => toggleSetting('start_with_windows')}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">START WITH WINDOWS</div>
              <div className="text-[10px] text-zinc-500">Auto-run on Windows login</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.start_with_windows ?? false}
                interactive={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Diagnostics & System Log Monitoring */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="pb-3 border-b border-white/[0.08] mb-3">
          <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
            DIAGNOSTICS &amp; SYSTEM LOGS // TELEMETRY MONITOR
          </h3>
          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
            Inspect real-time log activity, troubleshoot SAPI recognition, or view the native system console.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 font-mono text-xs">
          {/* Open Log File */}
          <div
            onClick={handleOpenLogFile}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-white font-semibold">OPEN LOG FILE</div>
              <div className="text-[10px] text-zinc-500">Opens app.log in Notepad</div>
            </div>
            <span className="px-2 py-0.5 rounded font-bold text-[10px] border border-current text-accent bg-black/40">
              OPEN
            </span>
          </div>

          {/* View Console Logs Modal */}
          <div
            onClick={handleOpenConsoleLogsModal}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-white font-semibold">VIEW CONSOLE LOGS</div>
              <div className="text-[10px] text-zinc-500">Interactive log terminal</div>
            </div>
            <span className="px-2 py-0.5 rounded font-bold text-[10px] border border-current text-accent bg-black/40">
              VIEW
            </span>
          </div>

          {/* Show Console Window Toggle */}
          <div
            onClick={() => {
              Sound.playSwitch();
              Ipc.toggleConsole();
              const updated = { ...config, show_console: !config.show_console };
              onUpdateConfig(updated);
            }}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-white font-semibold">CONSOLE WINDOW</div>
              <div className="text-[10px] text-zinc-500">Host Windows terminal</div>
            </div>
            <div className="pointer-events-none">
              <MechanicalToggle
                size="sm"
                checked={config.show_console}
                interactive={false}
              />
            </div>
          </div>

          {/* Open Images Directory */}
          <div
            onClick={() => {
              Sound.playSwitch();
              Ipc.openImagesFolder();
            }}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-white font-semibold">IMAGES DIRECTORY</div>
              <div className="text-[10px] text-zinc-500">Opens images/ in Explorer</div>
            </div>
            <span className="px-2 py-0.5 rounded font-bold text-[10px] border border-current text-amber-400 bg-black/40">
              EXPLORER
            </span>
          </div>

          {/* Check for Updates */}
          <div
            onClick={() => {
              Sound.playClick();
              Ipc.checkUpdates();
            }}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-white font-semibold">CHECK FOR UPDATES</div>
              <div className="text-[10px] text-zinc-500">Installed: v{pkg.version} {'//'} GitHub release check</div>
            </div>
            <span className="px-2 py-0.5 rounded font-bold text-[10px] border border-current text-accent bg-black/40">
              CHECK
            </span>
          </div>

          {/* Edit Kneeboards.json in Notepad */}
          <div
            onClick={() => {
              Sound.playSwitch();
              Ipc.editKneeboards();
            }}
            className="p-3 rounded bg-[#18181B] border border-white/[0.06] hover:border-white/[0.15] flex items-center justify-between cursor-pointer"
          >
            <div>
              <div className="text-white font-semibold">EDIT KNEEBOARDS.JSON</div>
              <div className="text-[10px] text-zinc-500">Opens config in Notepad</div>
            </div>
            <span className="px-2 py-0.5 rounded font-bold text-[10px] border border-current text-accent bg-black/40">
              NOTEPAD
            </span>
          </div>
        </div>
      </div>

      {/* System Footer: Build Version & Creator Attribution */}
      <div className="pt-2 pb-1 flex items-center justify-between text-zinc-500 font-mono text-[10px] border-t border-white/[0.06] shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="tracking-wider text-zinc-400">AEROGRAPH AVIONICS CONSOLE</span>
          <span className="text-zinc-600">{'//'}</span>
          <span className="text-zinc-300 font-bold">v{pkg.version}</span>
        </div>

        <a
          href="https://iskirik.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1.5 text-zinc-500 hover:text-white transition-colors group px-2 py-1 rounded bg-[#141416] border border-white/[0.06] hover:border-white/[0.15] cursor-pointer"
          title="Visit iskirik.com"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="yagiziskirik logo"
            className="w-3.5 h-3.5 object-contain opacity-70 group-hover:opacity-100 transition-opacity"
          />
          <span className="text-[9px] tracking-wider uppercase">
            CREATED BY{' '}
            <span className="text-zinc-400 group-hover:text-accent font-semibold transition-colors">
              yagiziskirik
            </span>
          </span>
        </a>
      </div>



      {/* Console Logs Interactive Modal */}
      {consoleLogsOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="w-[850px] max-h-[85vh] bg-[#121214] border border-white/[0.12] rounded-lg shadow-2xl flex flex-col overflow-hidden font-mono text-xs">
            {/* Modal Header */}
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  SYSTEM LOG VIEWER // APP.LOG RECENT ACTIVITY
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-zinc-500 font-mono tracking-wider mr-2">
                  AUTO-REFRESHING (1.5S)
                </span>
                <button
                  type="button"
                  onClick={() => setConsoleLogsOpen(false)}
                  className="text-zinc-400 hover:text-white text-base cursor-pointer px-1"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Log Terminal Body */}
            <div
              ref={logContainerRef}
              className="flex-1 p-4 overflow-y-auto space-y-1 bg-[#0E0E10] text-zinc-300 font-mono text-[11px] leading-relaxed"
            >
              {logLines.length > 0 ? (
                logLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`${
                      line.includes('ERROR')
                        ? 'text-rose-400 font-bold'
                        : line.includes('WARN')
                        ? 'text-amber-400'
                        : line.includes('Recognized')
                        ? 'text-emerald-400 font-bold'
                        : 'text-zinc-300'
                    }`}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-zinc-500 py-10 text-center">
                  Loading recent app.log lines from host...
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
