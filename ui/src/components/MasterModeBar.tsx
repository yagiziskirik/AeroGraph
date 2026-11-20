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
  onToggleVoiceRecognition?: () => void;
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
  onToggleVoiceRecognition,
}) => {
  const holdTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = React.useRef<boolean>(false);
  const [isHolding, setIsHolding] = React.useState<boolean>(false);

  React.useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isHoldingRef.current = false;
    setIsHolding(true);

    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsHolding(false);
      Sound.playSwitch();
      if (onToggleVoiceRecognition) {
        onToggleVoiceRecognition();
      } else {
        Ipc.setVoiceRecognition(!voiceEnabled);
      }
    }, 650);
  };

  const handlePointerUpOrLeave = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);
  };

  const handleClick = () => {
    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      return;
    }

    Sound.playClick();
    if (!voiceEnabled) {
      if (onToggleVoiceRecognition) {
        onToggleVoiceRecognition();
      } else {
        Ipc.setVoiceRecognition(true);
      }
      return;
    }

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

      {/* Real-time Voice Recognition State Indicator (Click to Mute/Unmute, Hold to Toggle Voice Recognition) */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
        onClick={handleClick}
        className="flex items-center space-x-2 text-[10px] cursor-pointer group focus:outline-none"
        title="Click to toggle Listening (Mute / Unmute) • Hold to toggle Voice Recognition"
      >
        <span className="text-zinc-500 tracking-wider group-hover:text-zinc-300 transition-colors">
          VOICE RECOGNITION:
        </span>
        <div className="relative overflow-hidden flex items-center space-x-2 px-2.5 py-1 rounded border bg-[#18181B] border-white/[0.08] group-hover:border-white/[0.15] transition-[border-color,background-color]">
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

          {/* Hold visual feedback progress bar */}
          <div
            className="absolute bottom-0 left-0 h-[2px] bg-emerald-400 pointer-events-none"
            style={{
              width: isHolding ? '100%' : '0%',
              transition: isHolding ? 'width 650ms linear' : 'none',
              willChange: 'width',
            }}
          />
        </div>
      </button>
    </nav>
  );
};
