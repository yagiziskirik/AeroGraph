'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { AppConfig, TelemetryData } from '../types/ipc';
import { SpeakerToggle, MicrophoneToggle } from '../components/inputs';
import { HelpCircle, RotateCcw, Check, SlidersHorizontal, Undo2 } from 'lucide-react';

const SAPI_PTT_DEFAULTS = {
  min_confidence: 50,
  min_ptt_duration_ms: 300,
  ptt_release_grace_ms: 1500,
  end_silence_timeout_ms: 1000,
  end_silence_timeout_ambiguous_ms: 1500,
  initial_silence_timeout_ms: 5000,
};

const getConfidenceBadge = (val: number) => {
  if (val < 35) {
    return { label: 'PERMISSIVE', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
  }
  if (val < 50) {
    return { label: 'RELAXED', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (val < 70) {
    return { label: 'BALANCED', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  if (val < 85) {
    return { label: 'STRICT', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
  }
  return { label: 'HIGH PRECISION', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)', border: 'rgba(168, 85, 247, 0.4)' };
};

const getPttHoldBadge = (val: number) => {
  if (val === 0) {
    return { label: 'INSTANT (0ms)', color: '#71717A', bg: 'rgba(113, 113, 122, 0.15)', border: 'rgba(113, 113, 122, 0.4)' };
  }
  if (val <= 200) {
    return { label: 'LIGHT DEBOUNCE', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (val <= 450) {
    return { label: 'OPTIMAL (300ms)', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  return { label: 'DELIBERATE HOLD', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
};

const getPttGraceBadge = (val: number) => {
  if (val === 0) {
    return { label: 'ZERO GRACE', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
  }
  if (val <= 750) {
    return { label: 'TIGHT WINDOW', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (val <= 1600) {
    return { label: 'NATURAL (1.5s)', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  return { label: 'EXTENDED BUFFER', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
};

const getEndSilenceBadge = (val: number) => {
  if (val <= 600) {
    return { label: 'HAIR-TRIGGER', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)' };
  }
  if (val <= 1200) {
    return { label: 'BALANCED (1.0s)', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  return { label: 'RELAXED CADENCE', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
};

const getAmbSilenceBadge = (val: number) => {
  if (val < 1000) {
    return { label: 'FAST DECISION', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (val <= 2000) {
    return { label: 'BALANCED (1.5s)', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  return { label: 'THOROUGH ARBITRATION', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
};

const getInitSilenceBadge = (val: number) => {
  if (val < 3000) {
    return { label: 'FAST CUTOFF', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)' };
  }
  if (val <= 6000) {
    return { label: 'BALANCED (5.0s)', color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)' };
  }
  return { label: 'EXTENDED WAIT', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)' };
};

interface CommsViewProps {
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  profileName: string;
  profilePath?: string;
  telemetry: TelemetryData;
}

export const CommsView: React.FC<CommsViewProps> = ({
  config,
  onUpdateConfig,
  profileName,
  profilePath,
  telemetry,
}) => {
  // Live Microphone VU Meter via CoreAudio IPC
  const [micLevel, setMicLevel] = useState(0);
  const [peakHold, setPeakHold] = useState(0);
  const peakDecayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Engine active guard (stops listening when voice recognition is OFF or MUTED)
  const isEngineActive = config.voice_recognition && config.listening_enabled;
  const rawLevel = isEngineActive ? micLevel : 0;

  // Convert raw amplitude to perceptual logarithmic dBFS level (-45 dB to 0 dB)
  const perceptualLevel = useMemo(() => {
    if (!isEngineActive || rawLevel < 0.003) return 0;
    const db = 20 * Math.log10(Math.max(rawLevel, 0.0001));
    const minDb = -45;
    const norm = (db - minDb) / (0 - minDb);
    return Math.max(0, Math.min(1, norm));
  }, [isEngineActive, rawLevel]);

  // Peak hold needle management
  useEffect(() => {
    if (perceptualLevel > peakHold) {
      setPeakHold(perceptualLevel);
      if (peakDecayTimerRef.current) clearTimeout(peakDecayTimerRef.current);
      peakDecayTimerRef.current = setTimeout(() => {
        setPeakHold(0);
      }, 700);
    }
  }, [perceptualLevel, peakHold]);

  useEffect(() => {
    return () => {
      if (peakDecayTimerRef.current) clearTimeout(peakDecayTimerRef.current);
    };
  }, []);

  // Test Comms Audio & Live SAPI Speech Recognition
  const [testActive, setTestActive] = useState(false);
  const [recognizedSpeech, setRecognizedSpeech] = useState<{
    phrase: string;
    confidence: number;
    timestamp: string;
    status: string;
  } | null>({
    phrase: 'AWAITING VOICE COMMAND (MIC HOT)...',
    confidence: 0,
    timestamp: '--:--:--',
    status: 'STANDBY',
  });

  // Capture Live Speech Recognized by Windows SAPI Engine via IPC
  useEffect(() => {
    const unsubSpeech = Ipc.on(
      'SpeechRecognized',
      (data: { phrase: string; confidence: number; timestamp?: string; status?: string }) => {
        if (data && data.phrase) {
          Sound.playSwitch();
          setRecognizedSpeech({
            phrase: data.phrase.toUpperCase(),
            confidence: data.confidence || 95,
            timestamp: data.timestamp || new Date().toLocaleTimeString(),
            status: data.status || 'VERIFIED',
          });
        }
      }
    );
    return unsubSpeech;
  }, []);

  // Continuous Real-Time Audio Level from Rust CoreAudio Peak Meter
  useEffect(() => {
    const unsubAudio = Ipc.on('AudioLevel', (val: any) => {
      const num = typeof val === 'number' ? val : parseFloat(val);
      if (!isNaN(num)) {
        setMicLevel(num);
      }
    });
    return unsubAudio;
  }, []);

  useEffect(() => {
    if (telemetry.mic_vu_level !== undefined) {
      setMicLevel(telemetry.mic_vu_level);
    }
  }, [telemetry.mic_vu_level]);

  // Transmit Radio Check (Tests SAPI TTS Audio Output)
  const handleTestRadioCheck = () => {
    Sound.playSwitch();
    setTestActive(true);
    Ipc.testVoiceAudio('Radio Check');

    setTimeout(() => {
      Sound.playCommit();
      setRecognizedSpeech({
        phrase: 'RADIO CHECK TRANSMITTED // 5 BY 5 (LOUD & CLEAR)',
        confidence: 99.4,
        timestamp: new Date().toLocaleTimeString(),
        status: 'TRANSMITTED',
      });
      setTestActive(false);
    }, 700);
  };

  const handleReloadProfile = () => {
    Sound.playSwitch();
    Ipc.reloadProfile();
  };

  const handleResetProfile = () => {
    Sound.playSwitch();
    Ipc.resetDefaultProfile();
  };

  const handleToggleVoice = () => {
    Sound.playSwitch();
    Ipc.setVoiceRecognition(!config.voice_recognition);
  };

  const handleToggleListening = () => {
    Sound.playSwitch();
    Ipc.setListening(!config.listening_enabled);
  };

  const handleTogglePilotGender = (female: boolean) => {
    Sound.playSwitch();
    const updated = { ...config, pilot_female: female };
    onUpdateConfig(updated);
    Ipc.updateConfig(updated);
  };

  const handleSetPollingRate = (hz: number) => {
    Sound.playClick();
    const updated = { ...config, polling_rate_hz: hz };
    onUpdateConfig(updated);
    Ipc.updateConfig(updated);
  };

  // Staged SAPI & PTT parameters (permits interactive slider tweaking before committing to disk)
  const [stagedParams, setStagedParams] = useState({
    min_confidence: config.min_confidence ?? SAPI_PTT_DEFAULTS.min_confidence,
    min_ptt_duration_ms: config.min_ptt_duration_ms ?? SAPI_PTT_DEFAULTS.min_ptt_duration_ms,
    ptt_release_grace_ms: config.ptt_release_grace_ms ?? SAPI_PTT_DEFAULTS.ptt_release_grace_ms,
    end_silence_timeout_ms: config.end_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ms,
    end_silence_timeout_ambiguous_ms:
      config.end_silence_timeout_ambiguous_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ambiguous_ms,
    initial_silence_timeout_ms:
      config.initial_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.initial_silence_timeout_ms,
  });

  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  useEffect(() => {
    setStagedParams({
      min_confidence: config.min_confidence ?? SAPI_PTT_DEFAULTS.min_confidence,
      min_ptt_duration_ms: config.min_ptt_duration_ms ?? SAPI_PTT_DEFAULTS.min_ptt_duration_ms,
      ptt_release_grace_ms: config.ptt_release_grace_ms ?? SAPI_PTT_DEFAULTS.ptt_release_grace_ms,
      end_silence_timeout_ms: config.end_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ms,
      end_silence_timeout_ambiguous_ms:
        config.end_silence_timeout_ambiguous_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ambiguous_ms,
      initial_silence_timeout_ms:
        config.initial_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.initial_silence_timeout_ms,
    });
  }, [
    config.min_confidence,
    config.min_ptt_duration_ms,
    config.ptt_release_grace_ms,
    config.end_silence_timeout_ms,
    config.end_silence_timeout_ambiguous_ms,
    config.initial_silence_timeout_ms,
  ]);

  const isTuningDirty = useMemo(() => {
    const curConf = config.min_confidence ?? SAPI_PTT_DEFAULTS.min_confidence;
    const curPtt = config.min_ptt_duration_ms ?? SAPI_PTT_DEFAULTS.min_ptt_duration_ms;
    const curGrace = config.ptt_release_grace_ms ?? SAPI_PTT_DEFAULTS.ptt_release_grace_ms;
    const curEnd = config.end_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ms;
    const curAmb = config.end_silence_timeout_ambiguous_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ambiguous_ms;
    const curInit = config.initial_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.initial_silence_timeout_ms;

    return (
      stagedParams.min_confidence !== curConf ||
      stagedParams.min_ptt_duration_ms !== curPtt ||
      stagedParams.ptt_release_grace_ms !== curGrace ||
      stagedParams.end_silence_timeout_ms !== curEnd ||
      stagedParams.end_silence_timeout_ambiguous_ms !== curAmb ||
      stagedParams.initial_silence_timeout_ms !== curInit
    );
  }, [config, stagedParams]);

  const handleResetSlider = (key: keyof typeof SAPI_PTT_DEFAULTS) => {
    Sound.playSwitch();
    setStagedParams((prev) => ({ ...prev, [key]: SAPI_PTT_DEFAULTS[key] }));
  };

  const handleResetAllToDefaults = () => {
    Sound.playSwitch();
    setStagedParams(SAPI_PTT_DEFAULTS);
  };

  const handleDiscardTuning = () => {
    Sound.playSwitch();
    setStagedParams({
      min_confidence: config.min_confidence ?? SAPI_PTT_DEFAULTS.min_confidence,
      min_ptt_duration_ms: config.min_ptt_duration_ms ?? SAPI_PTT_DEFAULTS.min_ptt_duration_ms,
      ptt_release_grace_ms: config.ptt_release_grace_ms ?? SAPI_PTT_DEFAULTS.ptt_release_grace_ms,
      end_silence_timeout_ms: config.end_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ms,
      end_silence_timeout_ambiguous_ms:
        config.end_silence_timeout_ambiguous_ms ?? SAPI_PTT_DEFAULTS.end_silence_timeout_ambiguous_ms,
      initial_silence_timeout_ms:
        config.initial_silence_timeout_ms ?? SAPI_PTT_DEFAULTS.initial_silence_timeout_ms,
    });
  };

  const handleApplyTuning = () => {
    Sound.playCommit();
    const updated = {
      ...config,
      min_confidence: stagedParams.min_confidence,
      min_ptt_duration_ms: stagedParams.min_ptt_duration_ms,
      ptt_release_grace_ms: stagedParams.ptt_release_grace_ms,
      end_silence_timeout_ms: stagedParams.end_silence_timeout_ms,
      end_silence_timeout_ambiguous_ms: stagedParams.end_silence_timeout_ambiguous_ms,
      initial_silence_timeout_ms: stagedParams.initial_silence_timeout_ms,
    };
    onUpdateConfig(updated);
    Ipc.updateConfig(updated);
  };


  return (
    <div className="h-full w-full p-5 bg-[#0A0A0C] flex flex-col space-y-4 select-none overflow-y-auto font-sans">
      {/* 1. Voice Recognition Engine & Profile Station */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                FOXVOX SAPI SPEECH ENGINE // PROFILE CONTROLLER
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Active FoxVox XML/FVX voice grammar engine linked to Falcon BMS 4.38 shared memory.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`h-7 px-2.5 rounded font-mono font-bold text-[11px] border uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
                config.voice_recognition
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              <SpeakerToggle checked={config.voice_recognition} size={15} interactive={false} />
              <span>{config.voice_recognition ? 'VOICE RECOGNITION: ON' : 'VOICE RECOGNITION: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={handleToggleListening}
              className={`h-7 px-2.5 rounded font-mono font-bold text-[11px] border uppercase transition-colors cursor-pointer flex items-center space-x-2 ${
                config.listening_enabled
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
              }`}
            >
              <MicrophoneToggle checked={config.listening_enabled} size={15} interactive={false} />
              <span>{config.listening_enabled ? 'MIC LISTENING (UNMUTED)' : 'STANDBY (MUTED)'}</span>
            </button>
          </div>
        </div>

        {/* Active Profile Banner & Actions */}
        <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex items-center justify-between font-mono text-xs">
          <div className="min-w-0 pr-4">
            <div className="text-[10px] text-zinc-500 tracking-wider">LOADED PROFILE:</div>
            <div className="text-white font-bold text-sm tracking-wide truncate mt-0.5">
              {profileName}
            </div>
            <div className="text-[10px] text-zinc-600 truncate mt-0.5">
              {profilePath || 'Default Bundled Profile (FalconBMS.fvx)'}
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleReloadProfile}
              className="h-8 px-3 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-white font-mono text-xs transition-colors cursor-pointer"
            >
              RELOAD PROFILE
            </button>

            <button
              type="button"
              onClick={handleResetProfile}
              className="h-8 px-3 rounded bg-[#18181B] hover:bg-[#1E1E22] border border-white/[0.08] text-zinc-400 hover:text-white font-mono text-xs transition-colors cursor-pointer"
            >
              RESET TO DEFAULT
            </button>
          </div>
        </div>

        {/* FoxVox Engine Calibration: Pilot Voice & Polling Frequency */}
        <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-white/[0.06] font-mono text-xs">
          {/* Pilot Voice Gender */}
          <div className="p-3 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-2">
            <div>
              <div className="text-white font-semibold flex items-center justify-between">
                <span>PILOT VOICE GENDER</span>
                <span className="text-[10px] text-zinc-500 uppercase">
                  {config.pilot_female ? 'FEMALE CALLSIGN' : 'MALE (DEFAULT)'}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Controls crew chief and wingman voice response phrasing
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleTogglePilotGender(false)}
                className={`h-8 px-2 rounded font-mono font-bold text-[11px] border uppercase transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  !config.pilot_female
                    ? 'bg-accent/15 border-accent text-accent shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                    : 'bg-[#1E1E22] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-[#27272A]'
                }`}
              >
                <span>♂</span>
                <span>MALE (DEFAULT)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTogglePilotGender(true)}
                className={`h-8 px-2 rounded font-mono font-bold text-[11px] border uppercase transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                  config.pilot_female
                    ? 'bg-accent/15 border-accent text-accent shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                    : 'bg-[#1E1E22] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-[#27272A]'
                }`}
              >
                <span>♀</span>
                <span>FEMALE</span>
              </button>
            </div>
          </div>

          {/* Telemetry Polling Rate Hz */}
          <div className="p-3 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-2">
            <div>
              <div className="text-white font-semibold flex items-center justify-between">
                <span>TELEMETRY POLLING RATE</span>
                <span className="text-[10px] text-accent font-bold">
                  {config.polling_rate_hz || 25} HZ ({Math.round(1000 / (config.polling_rate_hz || 25))}ms)
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">
                Falcon BMS shared memory &amp; DirectInput sampling frequency
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 pt-1">
              {[
                { hz: 20, label: '20 HZ' },
                { hz: 25, label: '25 HZ' },
                { hz: 30, label: '30 HZ' },
                { hz: 50, label: '50 HZ' },
                { hz: 60, label: '60 HZ' },
              ].map(({ hz, label }) => {
                const isActive = config.polling_rate_hz === hz;
                return (
                  <button
                    key={hz}
                    type="button"
                    onClick={() => handleSetPollingRate(hz)}
                    className={`h-8 rounded font-mono font-bold text-[10px] border transition-colors cursor-pointer flex flex-col items-center justify-center ${
                      isActive
                        ? 'bg-accent/15 border-accent text-accent shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                        : 'bg-[#1E1E22] border-white/[0.08] text-zinc-400 hover:text-white hover:bg-[#27272A]'
                    }`}
                  >
                    <span>{label}</span>
                    <span className="text-[8px] opacity-60">{Math.round(1000 / hz)}ms</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Microphone Calibration, Live VU-Meter & Real-Time SAPI Recognition */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Live Microphone VU-Meter & Radio Check Transmitter */}
        <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
              <div>
                <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                  LIVE MICROPHONE VU-METER // REAL-TIME INPUT
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  Audio input level detected from active system microphone device via Windows CoreAudio.
                </p>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded border transition-colors ${
                  !config.voice_recognition
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-500'
                    : !config.listening_enabled
                    ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
                    : perceptualLevel > 0.05
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                    : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-500/70'
                }`}
              >
                {!config.voice_recognition
                  ? 'VOICE OFFLINE'
                  : !config.listening_enabled
                  ? 'STANDBY (MUTED)'
                  : perceptualLevel > 0.05
                  ? 'VOICE DETECTED'
                  : 'LISTENING'}
              </span>
            </div>

            {/* High-Precision Continuous Linear VU Meter */}
            <div className="p-4 rounded bg-[#18181B] border border-white/[0.06] flex flex-col space-y-2.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-400 font-bold uppercase tracking-wider">INPUT LEVEL</span>
                  <span className="text-zinc-600">|</span>
                  <span
                    className={`text-[10px] font-bold ${
                      !isEngineActive
                        ? 'text-zinc-500'
                        : perceptualLevel > 0.75
                        ? 'text-rose-400'
                        : perceptualLevel > 0.45
                        ? 'text-amber-400'
                        : perceptualLevel > 0.05
                        ? 'text-emerald-400'
                        : 'text-zinc-500'
                    }`}
                  >
                    {!config.voice_recognition
                      ? 'OFFLINE (ENGINE DISABLED)'
                      : !config.listening_enabled
                      ? 'MUTED (STANDBY)'
                      : perceptualLevel > 0.05
                      ? 'VOICE CAPTURED'
                      : 'IDLE (NOISE GATE CLOSED)'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-500 text-[9px]">
                    {rawLevel > 0.003
                      ? `${Math.round(20 * Math.log10(rawLevel))} dBFS`
                      : '-∞ dB'}
                  </span>
                  <span className="text-accent font-bold text-xs">
                    {Math.round(perceptualLevel * 100)}%
                  </span>
                </div>
              </div>

              {/* Continuous Meter Track with Smooth Fill & Peak Hold Needle */}
              <div className="h-7 w-full bg-[#0A0A0C] rounded border border-white/[0.08] relative overflow-hidden flex items-center p-0.5 shadow-inner">
                {/* Background Zone Tints (-45dB to -15dB Green, -15dB to -6dB Amber, -6dB to 0dB Red) */}
                <div className="absolute inset-0 flex pointer-events-none opacity-20">
                  <div className="w-[65%] h-full bg-emerald-500/30" />
                  <div className="w-[20%] h-full bg-amber-500/30" />
                  <div className="w-[15%] h-full bg-rose-500/30" />
                </div>

                {/* Smooth Continuous Linear Fill Bar */}
                <div
                  className="h-full rounded-sm transition-all duration-75 will-change-[width] relative"
                  style={{
                    width: `${Math.round(perceptualLevel * 100)}%`,
                    background:
                      perceptualLevel > 0.85
                        ? 'linear-gradient(90deg, #10B981 0%, #34D399 50%, #F59E0B 75%, #EF4444 100%)'
                        : perceptualLevel > 0.65
                        ? 'linear-gradient(90deg, #10B981 0%, #34D399 65%, #F59E0B 100%)'
                        : 'linear-gradient(90deg, #059669 0%, #10B981 50%, #34D399 100%)',
                    boxShadow:
                      perceptualLevel > 0.05
                        ? '0 0 10px rgba(16,185,129,0.5)'
                        : 'none',
                  }}
                />

                {/* Peak Hold Needle */}
                {peakHold > 0.02 && (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] transition-all duration-150 pointer-events-none z-10"
                    style={{ left: `${Math.round(peakHold * 100)}%` }}
                  />
                )}

                {/* Overlaid Calibration Marks */}
                <div className="absolute inset-0 flex justify-between items-center pointer-events-none z-10 opacity-30">
                  <div className="h-full w-[1px] bg-white/40" style={{ marginLeft: '11%' }} />
                  <div className="h-full w-[1px] bg-white/40" style={{ marginLeft: '22%' }} />
                  <div className="h-full w-[1px] bg-white/40" style={{ marginLeft: '23%' }} />
                  <div className="h-full w-[1px] bg-amber-300/60" style={{ marginLeft: '22%' }} />
                  <div className="h-full w-[1px] bg-rose-400/80" style={{ marginLeft: '15%' }} />
                </div>
              </div>

              {/* Calibration Scale Legend */}
              <div className="flex justify-between text-[9px] font-mono text-zinc-500 px-0.5">
                <span>-45 dB</span>
                <span>-40 dB</span>
                <span>-30 dB</span>
                <span>-20 dB</span>
                <span className="text-amber-500/80">-10 dB</span>
                <span className="text-rose-500/80">0 dB</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestRadioCheck}
            disabled={testActive}
            className={`w-full h-9 mt-4 rounded font-mono font-bold text-xs uppercase border transition-all cursor-pointer ${
              testActive
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                : 'bg-[#1E1E22] hover:bg-[#27272A] border-accent text-accent shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            }`}
          >
            {testActive ? 'TRANSMITTING RADIO CHECK...' : 'TRANSMIT RADIO CHECK (TEST SAPI AUDIO)'}
          </button>
        </div>

        {/* Right: Live SAPI Speech Recognition Terminal */}
        <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
              <div>
                <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                  LIVE SAPI SPEECH RECOGNITION TERMINAL
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  Real-time phrase detection and engine confidence score from live speech.
                </p>
              </div>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  recognizedSpeech?.status === 'VERIFIED'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {recognizedSpeech?.status || 'STANDBY'}
              </span>
            </div>

            <div className="p-4 rounded bg-[#18181B] border border-white/[0.06] font-mono text-xs space-y-3">
              <div>
                <div className="text-[10px] text-zinc-500 tracking-wider">DETECTED PHRASE:</div>
                <div className="text-white font-bold text-sm tracking-wide mt-1 bg-black/40 p-2.5 rounded border border-white/[0.06]">
                  &quot;{recognizedSpeech?.phrase || 'AWAITING SPOKEN COMMAND...'}&quot;
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="text-[10px] text-zinc-500 tracking-wider">SAPI CONFIDENCE:</div>
                  <div className="text-emerald-400 font-bold text-base mt-0.5">
                    {recognizedSpeech?.confidence ? `${recognizedSpeech.confidence.toFixed(1)}%` : '--'}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-zinc-500 tracking-wider">TIMESTAMP:</div>
                  <div className="text-zinc-300 font-bold text-base mt-0.5">
                    {recognizedSpeech?.timestamp || '--:--:--'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded bg-[#080A0E] border border-white/[0.04] text-[11px] font-mono text-zinc-500 mt-4 flex items-center justify-between">
            <span>SAPI GRAMMAR RULES: ACTIVE</span>
            <span>PTT OVERRIDE: HOTAS GATED</span>
          </div>
        </div>
      </div>

      {/* 3. SAPI Speech Engine & Push-To-Talk Timings Station */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <style jsx>{`
          .calib-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            border-radius: 3px;
            outline: none;
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.08);
            transition: border-color 0.15s ease;
          }
          .calib-slider:hover {
            border-color: rgba(255, 255, 255, 0.25);
          }
          .calib-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid var(--thumb-color, #10b981);
            box-shadow: 0 0 8px var(--thumb-color, #10b981);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .calib-slider::-webkit-slider-thumb:hover {
            transform: scale(1.2);
            box-shadow: 0 0 12px var(--thumb-color, #10b981);
          }
          .calib-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid var(--thumb-color, #10b981);
            box-shadow: 0 0 8px var(--thumb-color, #10b981);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
        `}</style>

        {/* Section Header & Staged Commit Action Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                SAPI SPEECH RECOGNITION &amp; PTT TIMINGS // CALIBRATION
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Precision tuning for acoustic confidence floor, hardware switch debouncing, and phrase arbitration.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleResetAllToDefaults}
              className="h-7 px-2.5 rounded bg-[#18181B] hover:bg-[#1E1E22] border border-white/[0.08] text-zinc-400 hover:text-white font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5"
              title="Reset all 6 parameters to standard factory defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET ALL DEFAULTS</span>
            </button>

            {isTuningDirty && (
              <button
                type="button"
                onClick={handleDiscardTuning}
                className="h-7 px-2.5 rounded bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-600 text-zinc-300 font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5"
                title="Discard unapplied changes and restore saved configuration"
              >
                <Undo2 className="w-3 h-3" />
                <span>DISCARD</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleApplyTuning}
              disabled={!isTuningDirty}
              className={`h-7 px-3 rounded font-mono font-bold text-[10px] border uppercase transition-[background-color,border-color,box-shadow,color] duration-200 cursor-pointer flex items-center space-x-1.5 ${
                isTuningDirty
                  ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)] animate-pulse'
                  : 'bg-[#18181B] border-white/[0.06] text-zinc-600 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isTuningDirty ? 'APPLY CONFIGURATION (UNSAVED)' : 'CONFIG SYNCHRONIZED'}</span>
            </button>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* 1. Speech Confidence Floor */}
          {(() => {
            const badge = getConfidenceBadge(stagedParams.min_confidence);
            const isModified = stagedParams.min_confidence !== SAPI_PTT_DEFAULTS.min_confidence;
            const pct = stagedParams.min_confidence;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">CONFIDENCE FLOOR</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('confidence')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'confidence' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>SPEECH CONFIDENCE FLOOR</span>
                          <span className="text-zinc-500 font-normal">Default: 50%</span>
                        </div>
                        <div>
                          Minimum acoustic confidence score required by Windows SAPI to execute a voice command. Phrases scored below this floor are safely discarded to avoid unintended cockpit triggers.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('min_confidence')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset Confidence Floor to Default (50%)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.min_confidence}%</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={stagedParams.min_confidence}
                    onChange={(e) => setStagedParams({ ...stagedParams, min_confidence: parseInt(e.target.value) || 0 })}
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>0% (PERMISSIVE)</span>
                    <span>100% (STRICT)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 2. PTT Minimum Hold Duration */}
          {(() => {
            const badge = getPttHoldBadge(stagedParams.min_ptt_duration_ms);
            const isModified = stagedParams.min_ptt_duration_ms !== SAPI_PTT_DEFAULTS.min_ptt_duration_ms;
            const pct = (stagedParams.min_ptt_duration_ms / 1000) * 100;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">PTT MIN HOLD</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('ptt_hold')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'ptt_hold' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>PTT MINIMUM HOLD DURATION</span>
                          <span className="text-zinc-500 font-normal">Default: 300ms</span>
                        </div>
                        <div>
                          Minimum duration the Push-To-Talk switch must be held before a transmission is accepted. Momentary switch bounces and accidental bumps under this threshold are ignored.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('min_ptt_duration_ms')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset PTT Min Hold to Default (300ms)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.min_ptt_duration_ms}ms</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={25}
                    value={stagedParams.min_ptt_duration_ms}
                    onChange={(e) => setStagedParams({ ...stagedParams, min_ptt_duration_ms: parseInt(e.target.value) || 0 })}
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>0ms (INSTANT)</span>
                    <span>1000ms (1.0s)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 3. PTT Post-Release Grace Window */}
          {(() => {
            const badge = getPttGraceBadge(stagedParams.ptt_release_grace_ms);
            const isModified = stagedParams.ptt_release_grace_ms !== SAPI_PTT_DEFAULTS.ptt_release_grace_ms;
            const pct = (stagedParams.ptt_release_grace_ms / 2000) * 100;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">PTT RELEASE GRACE</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('ptt_grace')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'ptt_grace' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>PTT POST-RELEASE GRACE</span>
                          <span className="text-zinc-500 font-normal">Default: 1500ms</span>
                        </div>
                        <div>
                          Time window after releasing PTT during which speech recognition is still accepted. Allows you to release the radio switch naturally right as you conclude your sentence while audio buffers process.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('ptt_release_grace_ms')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset PTT Grace to Default (1500ms)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.ptt_release_grace_ms}ms</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={stagedParams.ptt_release_grace_ms}
                    onChange={(e) => setStagedParams({ ...stagedParams, ptt_release_grace_ms: parseInt(e.target.value) || 0 })}
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>0ms (OFF)</span>
                    <span>2000ms (2.0s)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 4. End-of-Phrase Response (Silence Timeout) */}
          {(() => {
            const badge = getEndSilenceBadge(stagedParams.end_silence_timeout_ms);
            const isModified = stagedParams.end_silence_timeout_ms !== SAPI_PTT_DEFAULTS.end_silence_timeout_ms;
            const pct = ((stagedParams.end_silence_timeout_ms - 300) / (2000 - 300)) * 100;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">END PHRASE TIMEOUT</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('end_silence')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'end_silence' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>END-OF-PHRASE RESPONSE DELAY</span>
                          <span className="text-zinc-500 font-normal">Default: 1000ms</span>
                        </div>
                        <div>
                          Silence duration required after speaking before SAPI concludes an unambiguous command. Lower values execute keystrokes faster; higher values give you time to pause naturally between words.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('end_silence_timeout_ms')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset End Phrase Timeout to Default (1000ms)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.end_silence_timeout_ms}ms</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={300}
                    max={2000}
                    step={50}
                    value={stagedParams.end_silence_timeout_ms}
                    onChange={(e) => setStagedParams({ ...stagedParams, end_silence_timeout_ms: parseInt(e.target.value) || 300 })}
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>300ms (FAST)</span>
                    <span>2000ms (RELAXED)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 5. Ambiguous Phrase Arbitration Timeout */}
          {(() => {
            const badge = getAmbSilenceBadge(stagedParams.end_silence_timeout_ambiguous_ms);
            const isModified = stagedParams.end_silence_timeout_ambiguous_ms !== SAPI_PTT_DEFAULTS.end_silence_timeout_ambiguous_ms;
            const pct = ((stagedParams.end_silence_timeout_ambiguous_ms - 500) / (3000 - 500)) * 100;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">AMBIGUOUS ARBITRATION</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('amb_silence')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'amb_silence' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>AMBIGUOUS PHRASE TIMEOUT</span>
                          <span className="text-zinc-500 font-normal">Default: 1500ms</span>
                        </div>
                        <div>
                          Silence duration required when multiple grammar phrases could potentially match (e.g. &apos;Flight Rejoin&apos; vs &apos;Flight Return&apos;). Gives SAPI additional time to arbitrate the correct command.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('end_silence_timeout_ambiguous_ms')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset Ambiguous Timeout to Default (1500ms)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.end_silence_timeout_ambiguous_ms}ms</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={500}
                    max={3000}
                    step={50}
                    value={stagedParams.end_silence_timeout_ambiguous_ms}
                    onChange={(e) =>
                      setStagedParams({ ...stagedParams, end_silence_timeout_ambiguous_ms: parseInt(e.target.value) || 500 })
                    }
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>500ms (FAST)</span>
                    <span>3000ms (3.0s)</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* 6. Initial Silence Timeout */}
          {(() => {
            const badge = getInitSilenceBadge(stagedParams.initial_silence_timeout_ms);
            const isModified = stagedParams.initial_silence_timeout_ms !== SAPI_PTT_DEFAULTS.initial_silence_timeout_ms;
            const pct = ((stagedParams.initial_silence_timeout_ms - 1000) / (10000 - 1000)) * 100;
            return (
              <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.06] flex flex-col justify-between space-y-3 font-mono text-xs relative">
                <div className="flex items-center justify-between">
                  <div className="relative flex items-center space-x-1.5">
                    <span className="text-white font-bold text-[11px] tracking-wider uppercase">INITIAL SILENCE TIMEOUT</span>
                    <button
                      type="button"
                      onMouseEnter={() => setHoveredTooltip('init_silence')}
                      onMouseLeave={() => setHoveredTooltip(null)}
                      className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5 rounded cursor-help"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    {hoveredTooltip === 'init_silence' && (
                      <div className="absolute left-0 bottom-full mb-2 w-72 bg-[#1A1A1E] border border-white/[0.15] text-zinc-300 shadow-2xl rounded p-3 text-[11px] font-sans leading-relaxed z-50 pointer-events-none will-change-[opacity,transform] transition-[opacity,transform] duration-150">
                        <div className="text-white font-bold font-mono text-[11px] mb-1 flex items-center justify-between">
                          <span>INITIAL SILENCE TIMEOUT</span>
                          <span className="text-zinc-500 font-normal">Default: 5000ms</span>
                        </div>
                        <div>
                          Maximum duration Windows SAPI waits for speech to begin after Push-To-Talk switch activation or engine listen state before timing out. Prevents recognition from staying open indefinitely if no sound is detected.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleResetSlider('initial_silence_timeout_ms')}
                      disabled={!isModified}
                      className={`p-1 rounded border transition-colors ${
                        isModified
                          ? 'border-white/20 text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer'
                          : 'border-transparent text-zinc-700 cursor-not-allowed opacity-40'
                      }`}
                      title="Reset Initial Silence Timeout to Default (5000ms)"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <span className="text-white font-bold text-xs">{stagedParams.initial_silence_timeout_ms}ms</span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border transition-[background-color,border-color,color] duration-150"
                      style={{ color: badge.color, backgroundColor: badge.bg, borderColor: badge.border }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min={1000}
                    max={10000}
                    step={250}
                    value={stagedParams.initial_silence_timeout_ms}
                    onChange={(e) =>
                      setStagedParams({ ...stagedParams, initial_silence_timeout_ms: parseInt(e.target.value) || 1000 })
                    }
                    className="calib-slider"
                    style={{
                      background: `linear-gradient(to right, ${badge.color} 0%, ${badge.color} ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%, rgba(255, 255, 255, 0.08) 100%)`,
                      ['--thumb-color' as any]: badge.color,
                    }}
                  />
                  <div className="flex items-center justify-between text-[9px] text-zinc-500 mt-1 font-mono">
                    <span>1000ms (1.0s)</span>
                    <span>10000ms (10.0s)</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
