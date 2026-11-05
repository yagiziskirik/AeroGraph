'use client';

import React from 'react';
import { MasterMode } from '../types/ipc';
import { Sound } from '../services/sound';
import { Ipc } from '../services/ipc';

interface MasterModeBarProps {
  currentMode: MasterMode;
  onSelectMode: (mode: MasterMode) => void;
  stagedChangesCount?: number;
  listeningActive?: boolean;
  voiceEnabled?: boolean;
  onToggleListening?: () => void;
}

const MODES: { id: MasterMode; code: string; label: string }[] = [
  { id: 'binder', code: '01', label: 'KNEEBOARD BINDER' },
  { id: 'hardware', code: '02', label: 'CREW CHIEF BIT' },
  { id: 'comms', code: '03', label: 'FOXVOX STATION' },
  { id: 'system', code: '04', label: 'COCKPIT & SETTINGS' },
];

export const MasterModeBar: React.FC<MasterModeBarProps> = ({
  currentMode,
  onSelectMode,
  stagedChangesCount = 0,
  listeningActive = true,
  voiceEnabled = true,
  onToggleListening,
}) => {
  const handleToggleVoice = () => {
    Sound.playClick();
    if (onToggleListening) {
      onToggleListening();
    } else {
      Ipc.setListening(!listeningActive);
    }
  };

  return (
    <nav className="h-10 w-full bg-[#0E0E10] border-b border-white/[0.08] px-3 flex items-center justify-between select-none shrink-0 font-mono">
      <div className="flex items-center space-x-1.5">
        {MODES.map((m) => {
          const isActive = currentMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                Sound.playClick();
                onSelectMode(m.id);
              }}
              className={`h-7 px-3 rounded flex items-center space-x-2 text-xs border transition-colors duration-100 will-change-composite cursor-pointer ${
                isActive
                  ? 'bg-[#27272A] border-accent text-accent shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                  : 'bg-[#18181B] border-white/[0.06] text-zinc-400 hover:text-white hover:border-white/[0.15]'
              }`}
            >
              <span className={`text-[10px] ${isActive ? 'text-accent font-bold' : 'text-zinc-600'}`}>
                [{m.code}]
              </span>
              <span className="font-sans font-semibold tracking-wider text-[11px] uppercase">
                {m.label}
              </span>
              {m.id === 'binder' && stagedChangesCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* Real-time Voice Recognition State Indicator (Clickable to Toggle Listening) */}
      <button
        type="button"
        onClick={handleToggleVoice}
        className="flex items-center space-x-2 text-[10px] cursor-pointer group focus:outline-none"
        title="Click to toggle Voice Recognition Listening (Mute / Unmute)"
      >
        <span className="text-zinc-500 tracking-wider group-hover:text-zinc-300 transition-colors">
          VOICE RECOGNITION:
        </span>
        <span
          className={`font-semibold tracking-wider px-2 py-0.5 rounded border transition-all ${
            !voiceEnabled
              ? 'bg-zinc-800/60 border-zinc-700 text-zinc-500 group-hover:border-zinc-500'
              : listeningActive
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.2)] group-hover:brightness-125'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-400 group-hover:brightness-125'
          }`}
        >
          {!voiceEnabled ? 'DISABLED' : listeningActive ? 'LISTENING (UNMUTED)' : 'STANDBY (MUTED)'}
        </span>
      </button>
    </nav>
  );
};
