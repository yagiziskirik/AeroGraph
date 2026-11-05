'use client';

import React, { useState, useEffect } from 'react';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { AppConfig, TelemetryData } from '../types/ipc';
import { LeverSwitch } from '../components/inputs';

interface HardwareViewProps {
  config: AppConfig;
  telemetry: TelemetryData;
  mpoButton?: number;
  mpoDevice?: string;
}

export const HardwareView: React.FC<HardwareViewProps> = ({
  config,
  telemetry,
  mpoButton,
  mpoDevice,
}) => {
  const [listeningForMpo, setListeningForMpo] = useState(false);
  const [mpoBindingStatus, setMpoBindingStatus] = useState<string>(() => {
    const btn = mpoButton !== undefined ? mpoButton : 8;
    const dev = mpoDevice || 'F16 TQS by YGZ / Profile Default';
    return `Active: JoyBtn ${btn} (${dev})`;
  });
  const [manualMpoOverride, setManualMpoOverride] = useState<boolean | null>(null);

  // Synchronize binding status when props update from StateSnapshot
  useEffect(() => {
    if (mpoButton !== undefined && !listeningForMpo) {
      setMpoBindingStatus(
        `Active: JoyBtn ${mpoButton} (${mpoDevice || 'F16 TQS by YGZ / Profile Default'})`
      );
    }
  }, [mpoButton, mpoDevice, listeningForMpo]);

  // Listen for real-time MPO binding capture from DirectInput hardware
  useEffect(() => {
    const unsub = Ipc.on('MpoBindingCaptured', (data: { button: number; device: string }) => {
      setListeningForMpo(false);
      setMpoBindingStatus(
        `Bound to controller: JoyBtn ${data.button} (${data.device}) [Saved to .fvx]`
      );
      Sound.playCommit();
    });
    return unsub;
  }, []);

  // Cancel binding on Escape key or unmount
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && listeningForMpo) {
        setListeningForMpo(false);
        Ipc.cancelMpoBinding();
        setMpoBindingStatus(
          `Active: JoyBtn ${mpoButton ?? 8} (${mpoDevice || 'F16 TQS by YGZ / Profile Default'})`
        );
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (listeningForMpo) {
        Ipc.cancelMpoBinding();
      }
    };
  }, [listeningForMpo, mpoButton, mpoDevice]);

  // Baseline resting values for toe brakes to ensure monotonic linear deflection
  const [leftResting, setLeftResting] = useState<number | null>(null);
  const [rightResting, setRightResting] = useState<number | null>(null);

  // DirectInput axis telemetry (normalized 0.0 - 1.0)
  const rawPitch = telemetry.pitch_axis !== undefined ? telemetry.pitch_axis : 0.5;
  const rawRoll = telemetry.roll_axis !== undefined ? telemetry.roll_axis : 0.5;
  const rawYaw = telemetry.yaw_axis !== undefined ? telemetry.yaw_axis : 0.5;
  const rawLeftBrake = telemetry.left_brake !== undefined ? telemetry.left_brake : 0.0;
  const rawRightBrake = telemetry.right_brake !== undefined ? telemetry.right_brake : 0.0;
  const pttCom1 = telemetry.ptt_com1 || false;
  const pttCom2 = telemetry.ptt_com2 || false;

  // Calibrate resting baseline when telemetry arrives
  if (telemetry.left_brake !== undefined && leftResting === null) {
    setLeftResting(telemetry.left_brake > 0.5 ? 1.0 : 0.0);
  }
  if (telemetry.right_brake !== undefined && rightResting === null) {
    setRightResting(telemetry.right_brake > 0.5 ? 1.0 : 0.0);
  }

  // Effective MPO state: controller telemetry (including bound button from F16 TQS or other controllers) or interactive manual switch toggle
  const isMpoActive =
    manualMpoOverride !== null
      ? manualMpoOverride
      : telemetry.mpo_active ||
        (mpoButton !== undefined && telemetry.active_buttons?.includes(mpoButton)) ||
        telemetry.active_buttons?.includes(8) ||
        telemetry.active_buttons?.includes(50) ||
        false;

  // 1. PITCH (Elevator) Axis Alignment
  const pitchDisplay = 1.0 - rawPitch;
  const pitchNoseDnSatisfied = pitchDisplay <= 0.42;
  const pitchNoseUpSatisfied = pitchDisplay >= 0.58;
  const pitchBitPassed = pitchNoseDnSatisfied || pitchNoseUpSatisfied;

  // 2. ROLL (Aileron) Axis Alignment
  const rollDisplay = 1.0 - rawRoll;
  const rollLeftSatisfied = rollDisplay <= 0.42;
  const rollRightSatisfied = rollDisplay >= 0.58;
  const rollBitPassed = rollLeftSatisfied || rollRightSatisfied;

  // 3. RUDDER (Yaw) Axis Alignment
  const yawDisplay = 1.0 - rawYaw;
  const rudderLeftSatisfied = yawDisplay <= 0.42;
  const rudderRightSatisfied = yawDisplay >= 0.58;
  const rudderBitPassed = rudderLeftSatisfied || rudderRightSatisfied;

  // 4. WHEEL BRAKES (Toe Brakes Deflection)
  const leftDeflection =
    leftResting === 1.0
      ? Math.max(0, Math.min(1.0, 1.0 - rawLeftBrake))
      : Math.max(0, Math.min(1.0, rawLeftBrake));
  const rightDeflection =
    rightResting === 1.0
      ? Math.max(0, Math.min(1.0, 1.0 - rawRightBrake))
      : Math.max(0, Math.min(1.0, rawRightBrake));
  const leftBrakeSatisfied = leftDeflection >= 0.15;
  const rightBrakeSatisfied = rightDeflection >= 0.15;
  const brakesBitPassed = leftBrakeSatisfied && rightBrakeSatisfied;

  const handleTogglePhysicalMpoSwitch = () => {
    Sound.playSwitch();
    setManualMpoOverride((prev) => (prev !== null ? !prev : !isMpoActive));
  };

  const handleStartMpoBinding = () => {
    Sound.playSwitch();
    setListeningForMpo(true);
    setMpoBindingStatus('Press any controller button for MPO Override...');
    Ipc.startMpoBinding();
  };

  const handleResetMpoToDefault = () => {
    Sound.playSwitch();
    setListeningForMpo(false);
    setManualMpoOverride(null);
    Ipc.resetMpoBinding();
  };

  return (
    <div className="h-full w-full p-5 bg-[#0A0A0C] flex flex-col space-y-4 select-none overflow-y-auto font-sans">
      {/* 1. Crew Chief Ramp Flight Control BIT Verification Station */}
      <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full" />
              <h2 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                CREW CHIEF RAMP FLIGHT CONTROL BIT // THRESHOLD VERIFIER
              </h2>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Testing HOTAS stick, rudder, and brake deflections against active .fvx ramp test limit parameters.
            </p>
          </div>
          <div className="flex items-center space-x-2 font-mono text-[10px]">
            <span className="text-zinc-500">CREW CHIEF STATUS:</span>
            <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30">
              RAMP READY
            </span>
          </div>
        </div>

        {/* 4 Flight Control BIT Deflection Channels */}
        <div className="grid grid-cols-4 gap-4">
          {/* Channel 1: Pitch (Elevator) */}
          <div className="bg-[#18181B] p-3.5 rounded border border-white/[0.06] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-zinc-300 font-bold">PITCH / ELEVATOR</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  pitchBitPassed
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#141416] text-zinc-400 border-white/[0.08]'
                }`}
              >
                {pitchBitPassed ? 'BIT PASS' : 'HOLD TEST'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-2">
              Push: Nose Dn &le; 40% | Pull: Nose Up &ge; 60%
            </div>

            {/* Vertical Deflection Bar with Limit Markers */}
            <div className="h-28 w-full bg-[#0E0E10] rounded border border-white/[0.08] relative overflow-hidden flex flex-col justify-between p-1">
              {/* Upper 40% limit line (Nose Down) */}
              <div className="absolute top-[40%] inset-x-0 h-px bg-amber-500/40 border-t border-dashed border-amber-400/50" />
              {/* Lower 60% limit line (Nose Up) */}
              <div className="absolute top-[60%] inset-x-0 h-px bg-amber-500/40 border-t border-dashed border-amber-400/50" />
              {/* Center 50% neutral line */}
              <div className="absolute top-[50%] inset-x-0 h-px bg-white/20" />

              {/* Pitch Marker */}
              <div
                className={`absolute inset-x-2 h-2.5 rounded transition-[top] duration-100 ease-out will-change-[top] ${
                  pitchBitPassed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-accent'
                }`}
                style={{ top: `calc(${pitchDisplay * 100}% - 5px)` }}
              />
            </div>

            <div className="grid grid-cols-3 items-center text-[10px] font-mono text-zinc-400 mt-2">
              <span className={`text-left ${pitchNoseDnSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {pitchNoseDnSatisfied ? 'NOSE DN [OK]' : 'NOSE DN'}
              </span>
              <span className="text-center text-white font-bold">{Math.round(pitchDisplay * 100)}%</span>
              <span className={`text-right ${pitchNoseUpSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {pitchNoseUpSatisfied ? 'NOSE UP [OK]' : 'NOSE UP'}
              </span>
            </div>
          </div>

          {/* Channel 2: Roll (Aileron) */}
          <div className="bg-[#18181B] p-3.5 rounded border border-white/[0.06] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-zinc-300 font-bold">ROLL / AILERONS</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  rollBitPassed
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#141416] text-zinc-400 border-white/[0.08]'
                }`}
              >
                {rollBitPassed ? 'BIT PASS' : 'HOLD TEST'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-2">
              Limits: Left &le; 40% | Right &ge; 60%
            </div>

            {/* Horizontal Deflection Bar with Limit Markers */}
            <div className="h-28 w-full bg-[#0E0E10] rounded border border-white/[0.08] relative overflow-hidden flex items-center justify-center p-2">
              {/* Left 40% line */}
              <div className="absolute left-[40%] inset-y-0 w-px bg-amber-500/40 border-l border-dashed border-amber-400/50" />
              {/* Right 60% line */}
              <div className="absolute left-[60%] inset-y-0 w-px bg-amber-500/40 border-l border-dashed border-amber-400/50" />
              {/* Center line */}
              <div className="absolute left-[50%] inset-y-0 w-px bg-white/20" />

              {/* Roll Marker */}
              <div
                className={`absolute inset-y-4 w-3 rounded transition-[left] duration-100 ease-out will-change-[left] ${
                  rollBitPassed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-accent'
                }`}
                style={{ left: `calc(${rollDisplay * 100}% - 6px)` }}
              />
            </div>

            <div className="grid grid-cols-3 items-center text-[10px] font-mono text-zinc-400 mt-2">
              <span className={`text-left ${rollLeftSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {rollLeftSatisfied ? 'LEFT [OK]' : 'LEFT'}
              </span>
              <span className="text-center text-white font-bold">{Math.round(rollDisplay * 100)}%</span>
              <span className={`text-right ${rollRightSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {rollRightSatisfied ? 'RIGHT [OK]' : 'RIGHT'}
              </span>
            </div>
          </div>

          {/* Channel 3: Rudder (Yaw) */}
          <div className="bg-[#18181B] p-3.5 rounded border border-white/[0.06] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-zinc-300 font-bold">RUDDER / YAW</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  rudderBitPassed
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                    : 'bg-[#141416] text-zinc-400 border-white/[0.08]'
                }`}
              >
                {rudderBitPassed ? 'BIT PASS' : 'HOLD TEST'}
              </span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-2">
              Limits: Left &le; 40% | Right &ge; 60%
            </div>

            {/* Rudder Bar */}
            <div className="h-28 w-full bg-[#0E0E10] rounded border border-white/[0.08] relative overflow-hidden flex items-center justify-center p-2">
              <div className="absolute left-[40%] inset-y-0 w-px bg-amber-500/40 border-l border-dashed border-amber-400/50" />
              <div className="absolute left-[60%] inset-y-0 w-px bg-amber-500/40 border-l border-dashed border-amber-400/50" />
              <div className="absolute left-[50%] inset-y-0 w-px bg-white/20" />

              <div
                className={`absolute inset-y-4 w-3 rounded transition-[left] duration-100 ease-out will-change-[left] ${
                  rudderBitPassed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-accent'
                }`}
                style={{ left: `calc(${yawDisplay * 100}% - 6px)` }}
              />
            </div>

            <div className="grid grid-cols-3 items-center text-[10px] font-mono text-zinc-400 mt-2">
              <span className={`text-left ${rudderLeftSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {rudderLeftSatisfied ? 'LEFT [OK]' : 'LEFT'}
              </span>
              <span className="text-center text-white font-bold">{Math.round(yawDisplay * 100)}%</span>
              <span className={`text-right ${rudderRightSatisfied ? 'text-emerald-400 font-bold' : ''}`}>
                {rudderRightSatisfied ? 'RIGHT [OK]' : 'RIGHT'}
              </span>
            </div>
          </div>

          {/* Channel 4: Toe Brakes (Dual Differential) */}
          <div className="bg-[#18181B] p-3.5 rounded border border-white/[0.06] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-1 font-mono text-xs">
              <span className="text-zinc-300 font-bold">WHEEL BRAKES</span>
              <div className="flex items-center space-x-1">
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                    leftBrakeSatisfied
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                      : 'bg-[#141416] text-zinc-400 border-white/[0.08]'
                  }`}
                >
                  LT: {leftBrakeSatisfied ? 'BIT PASS' : 'DEPRESS'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors ${
                    rightBrakeSatisfied
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                      : 'bg-[#141416] text-zinc-400 border-white/[0.08]'
                  }`}
                >
                  RT: {rightBrakeSatisfied ? 'BIT PASS' : 'DEPRESS'}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mb-2">
              Threshold: Deflection &ge; 15% from idle
            </div>

            {/* Dual Brake Gauges */}
            <div className="h-28 w-full bg-[#0E0E10] rounded border border-white/[0.08] flex items-end justify-around p-2">
              <div className="flex flex-col items-center space-y-1 w-1/3">
                <div className="h-20 w-4 bg-[#141416] rounded overflow-hidden flex flex-col justify-end border border-white/[0.06]">
                  <div
                    className={`w-full transition-[height] duration-100 ease-out will-change-[height] ${
                      leftBrakeSatisfied ? 'bg-emerald-400' : 'bg-accent'
                    }`}
                    style={{ height: `${Math.min(100, Math.round(leftDeflection * 100))}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-zinc-400">LT ({Math.round(leftDeflection * 100)}%)</span>
              </div>

              <div className="flex flex-col items-center space-y-1 w-1/3">
                <div className="h-20 w-4 bg-[#141416] rounded overflow-hidden flex flex-col justify-end border border-white/[0.06]">
                  <div
                    className={`w-full transition-[height] duration-100 ease-out will-change-[height] ${
                      rightBrakeSatisfied ? 'bg-emerald-400' : 'bg-accent'
                    }`}
                    style={{ height: `${Math.min(100, Math.round(rightDeflection * 100))}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-zinc-400">RT ({Math.round(rightDeflection * 100)}%)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 items-center text-[10px] font-mono text-zinc-400 mt-2">
              <span className="text-left">{leftBrakeSatisfied ? 'LT [OK]' : 'RELEASED'}</span>
              <span className="text-center text-white font-bold">{Math.round(((leftDeflection + rightDeflection) / 2) * 100)}%</span>
              <span className="text-right">{rightBrakeSatisfied ? 'RT [OK]' : 'RELEASED'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Cockpit Intercom Transmission & MPO Hardware Station */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: HOTAS Radio PTT Status Indicators */}
        <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono mb-1">
              HOTAS RADIO TRANSMISSION INDICATORS // PTT STATUS
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono mb-4">
              Real-time hardware monitoring of COM1 (UHF) and COM2 (VHF) transmit switches.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* PTT COM1 (UHF) Annunciator */}
            <div
              className={`p-4 rounded border flex flex-col items-center justify-center transition-all ${
                pttCom1
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.5)]'
                  : 'bg-[#18181B] border-white/[0.06] text-zinc-500'
              }`}
            >
              <div className="text-[10px] font-mono tracking-widest text-zinc-400">HOTAS TRANSMIT</div>
              <div className="text-base font-bold font-mono tracking-wider mt-1">PTT COM 1 (UHF)</div>
              <div
                className={`text-xs font-mono font-bold mt-2 px-3 py-0.5 rounded ${
                  pttCom1 ? 'bg-amber-400 text-black' : 'bg-black/40 text-zinc-600'
                }`}
              >
                {pttCom1 ? 'TRANSMITTING' : 'OFF AIR'}
              </div>
            </div>

            {/* PTT COM2 (VHF) Annunciator */}
            <div
              className={`p-4 rounded border flex flex-col items-center justify-center transition-all ${
                pttCom2
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.5)]'
                  : 'bg-[#18181B] border-white/[0.06] text-zinc-500'
              }`}
            >
              <div className="text-[10px] font-mono tracking-widest text-zinc-400">HOTAS TRANSMIT</div>
              <div className="text-base font-bold font-mono tracking-wider mt-1">PTT COM 2 (VHF)</div>
              <div
                className={`text-xs font-mono font-bold mt-2 px-3 py-0.5 rounded ${
                  pttCom2 ? 'bg-emerald-400 text-black' : 'bg-black/40 text-zinc-600'
                }`}
              >
                {pttCom2 ? 'TRANSMITTING' : 'OFF AIR'}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Manual Pitch Override (MPO) with Physical Animated Toggle Switch */}
        <div className="bg-[#121214] border border-white/[0.08] rounded p-4 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
              <div>
                <h3 className="text-xs font-bold tracking-[0.2em] text-white uppercase font-mono">
                  MANUAL PITCH OVERRIDE (MPO) // PHYSICAL COCKPIT SWITCH
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  Left Aux Console mechanical switch bound to FoxVox crew chief profile.
                </p>
              </div>

              {/* MPO Active Annunciator */}
              <div
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-colors ${
                  isMpoActive
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                }`}
              >
                {isMpoActive ? 'MPO OVERRIDE (ACTIVE)' : 'MPO NORM (GUARDED)'}
              </div>
            </div>

            {/* Authentic Physical F-16 MPO Switch Simulation */}
            <div className="p-3 rounded bg-[#18181B] border border-white/[0.06] flex items-center justify-between">
              <div className="space-y-1 font-mono text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-zinc-400">PROFILE BINDING:</span>
                  <span className="text-white font-bold">{mpoBindingStatus}</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  Click switch or trigger mapped controller button to verify mechanical movement.
                </div>
              </div>

              {/* Mechanical MPO Toggle Lever (Telemetry-Driven Indicator) */}
              <div
                title="MPO hardware state (driven by flight stick telemetry)"
                className="flex flex-col items-center justify-center p-2 rounded bg-black/40 border border-white/[0.08] select-none pointer-events-none"
              >
                <div className="flex items-center space-x-1 mb-1 font-mono text-[9px] font-bold">
                  <span className={isMpoActive ? 'text-rose-400' : 'text-zinc-600'}>OVRD</span>
                  <span className="text-zinc-600">/</span>
                  <span className={!isMpoActive ? 'text-emerald-400' : 'text-zinc-600'}>NORM</span>
                </div>
                <LeverSwitch
                  checked={isMpoActive}
                  fontSize={7}
                  showPlate={false}
                  showLeds={false}
                  interactive={false}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-3">
            <button
              type="button"
              onClick={handleStartMpoBinding}
              disabled={listeningForMpo}
              className={`flex-1 h-9 px-4 rounded font-mono font-bold text-xs uppercase border transition-all cursor-pointer ${
                listeningForMpo
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300 animate-pulse'
                  : 'bg-[#1E1E22] hover:bg-[#27272A] border-accent text-accent shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              }`}
            >
              {listeningForMpo ? 'AWAITING BUTTON PRESS...' : 'REBIND MPO SWITCH TO FVX'}
            </button>

            <button
              type="button"
              onClick={handleResetMpoToDefault}
              className="h-9 px-4 rounded bg-[#18181B] hover:bg-[#1E1E22] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-xs uppercase cursor-pointer"
            >
              RESTORE DEFAULT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
