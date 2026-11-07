'use client';

import React from 'react';
import { MasterMode } from '../types/ipc';
import { Sound } from '../services/sound';
import { Ipc } from '../services/ipc';
import { RadioInputs, MicrophoneToggle, SpeakerToggle } from './inputs';

interface MasterModeBarProps {
  currentMode: MasterMode;
  onSelectMode: (mode: MasterMode) => void;
  stagedChangesCount?: number;
  listeningActive?: boolean;
  voiceEnabled?: boolean;
  onToggleListening?: () => void;
}

const MODE_OPTIONS = [
  { value: 'binder', label: '[01] KNEEBOARD BINDER' },
  { value: 'hardware', label: '[02] CREW CHIEF BIT' },
  { value: 'comms', label: '[03] FOXVOX STATION' },
  { value: 'system', label: '[04] COCKPIT & SETTINGS' },
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
    <nav className="h-10 w-full bg-[#0E0E10] border-b border-white/[0.08] px-3 flex items-center justify-between select-none shrink-0 font-mono relative z-40 overflow-visible">
      <div className="flex items-center space-x-2 overflow-visible">
        <RadioInputs
          name="master-mode-selector"
          options={MODE_OPTIONS}
          value={currentMode}
          onChange={(val) => {
            Sound.playClick();
            onSelectMode(val as MasterMode);
          }}
          className="border-0 bg-transparent p-0 shadow-none space-x-1"
        />
        {stagedChangesCount > 0 && currentMode !== 'binder' && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-1" title="Staged changes in Binder" />
        )}
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
        <div className="flex items-center space-x-2 px-2.5 py-1 rounded border bg-[#18181B] border-white/[0.08] group-hover:border-white/[0.15] transition-all">
          {!voiceEnabled ? (
            <SpeakerToggle checked={false} size={14} interactive={false} />
          ) : listeningActive ? (
            <MicrophoneToggle checked={true} size={14} interactive={false} />
          ) : (
            <MicrophoneToggle checked={false} size={14} interactive={false} />
          )}
          <span
            className={`font-semibold tracking-wider font-mono text-[10px] ${
              !voiceEnabled
                ? 'text-zinc-500'
                : listeningActive
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
          >
            {!voiceEnabled ? 'DISABLED' : listeningActive ? 'LISTENING (UNMUTED)' : 'STANDBY (MUTED)'}
          </span>
        </div>
      </button>
    </nav>
  );
};
