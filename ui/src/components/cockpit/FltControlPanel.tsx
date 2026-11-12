'use client';

import React, { useState, useId, useRef } from 'react';
import { Sound } from '../../services/sound';

export interface FltControlSwitches {
  digitalBackup?: boolean; // false = OFF (down), true = BACKUP (up)
  altFlaps?: boolean; // false = NORM (down), true = EXTEND (up)
  manualTfFlyup?: boolean; // false = ENABLE (down), true = DISABLE (up)
  leFlaps?: boolean; // false = AUTO (down), true = LOCK (up)
  flcsReset?: boolean; // false = OFF (down), true = RESET (up) [momentary]
  bit?: boolean; // false = OFF (down), true = BIT (up)
}

export interface FltControlLights {
  run?: boolean; // Green text light on dark background
  fail?: boolean; // Red backgrounded FAIL light with black text
}

export interface FltControlPanelProps {
  switches?: FltControlSwitches;
  onSwitchChange?: (switchKey: keyof FltControlSwitches, value: boolean) => void;
  lights?: FltControlLights;
  onLightClick?: (lightKey: keyof FltControlLights) => void;
  allowSwitchClick?: boolean | Partial<Record<keyof FltControlSwitches, boolean>>; // Global or per-switch toggle interactivity
  enabledSwitches?: Partial<Record<keyof FltControlSwitches, boolean>>; // Per-switch enabled overrides
  allowLightInteractivity?: boolean; // Hover and click on warning light (default: false)
  className?: string;
}

export const FltControlPanel: React.FC<FltControlPanelProps> = ({
  switches: controlledSwitches,
  onSwitchChange,
  lights: controlledLights,
  onLightClick,
  allowSwitchClick = true,
  enabledSwitches,
  allowLightInteractivity = false,
  className = '',
}) => {
  const panelId = useId();

  // Internal switch states if uncontrolled
  const [internalSwitches, setInternalSwitches] = useState<FltControlSwitches>({
    digitalBackup: false, // OFF (down)
    altFlaps: false, // NORM (down)
    manualTfFlyup: false, // ENABLE (down)
    leFlaps: false, // AUTO (down)
    flcsReset: false, // OFF (down)
    bit: false, // OFF (down)
  });

  const activeSwitches: FltControlSwitches = {
    ...internalSwitches,
    ...(controlledSwitches || {}),
  };

  // Helper to determine if a specific switch is allowed to be clicked
  const isSwitchAllowed = (key: keyof FltControlSwitches): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  // Internal light overrides when clicked in interactive mode
  const [internalLightOverrides, setInternalLightOverrides] = useState<FltControlLights>({});

  // Default lights: if BIT is active, RUN light illuminates by default
  const defaultLights: FltControlLights = {
    run: !!activeSwitches.bit,
    fail: false,
  };

  const activeLights: FltControlLights = {
    ...defaultLights,
    ...internalLightOverrides,
    ...(controlledLights || {}),
  };

  // Set switch state
  const setSwitch = (key: keyof FltControlSwitches, value: boolean) => {
    if (!isSwitchAllowed(key)) return;
    if (activeSwitches[key] === value) return; // No duplicate sound if state unchanged
    Sound.playSwitch();
    if (onSwitchChange) {
      onSwitchChange(key, value);
    } else {
      setInternalSwitches((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  // Unidirectional controls (Left-click increases, Right-click decreases)
  const increaseSwitch = (key: keyof FltControlSwitches) => {
    if (!isSwitchAllowed(key)) return;
    setSwitch(key, true);
  };

  const decreaseSwitch = (key: keyof FltControlSwitches) => {
    if (!isSwitchAllowed(key)) return;
    setSwitch(key, false);
  };

  // Momentary switch handlers for FLCS RESET (Strictly Left-Click Only)
  const resetPressActiveRef = useRef<boolean>(false);

  const handleFlcsResetMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('flcsReset')) return;
    if ('button' in e && e.button !== 0) return; // Ignore right-click / middle-click!
    resetPressActiveRef.current = true;
    setSwitch('flcsReset', true);
  };

  const handleFlcsResetMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('flcsReset')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!resetPressActiveRef.current) return;
    resetPressActiveRef.current = false;
    setSwitch('flcsReset', false);
  };

  // Handle light unit click
  const handleLightClick = (key: keyof FltControlLights) => {
    if (!allowLightInteractivity) return;
    Sound.playClick();
    if (onLightClick) {
      onLightClick(key);
    } else {
      setInternalLightOverrides((prev) => ({
        ...prev,
        [key]: !activeLights[key],
      }));
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics FLT CONTROL Panel Chassis - Fixed Width (270px) */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-3 w-[270px] min-w-[270px] max-w-[270px] text-zinc-300 font-mono select-none"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Four Slotted Corner Aircraft DZUS Fasteners */}
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-2 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-2 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-2 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-2 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Four Decorative Dark Phillips Screws */}
        <div className="absolute top-3 left-14 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute top-3 right-10 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute bottom-16 left-12 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute bottom-16 right-9 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Panel Content Layout with Vertical FLT CONTROL on Left */}
        <div className="flex items-stretch space-x-2 pt-1 pr-1">
          {/* Vertical FLT CONTROL Text on Far Left */}
          <div className="flex flex-col items-center justify-center pl-0.5 select-none w-5">
            <span className="text-[12px] font-black tracking-[0.35em] text-zinc-300 leading-[1.6] flex flex-col items-center">
              <span>F</span>
              <span>L</span>
              <span>T</span>
              <span className="h-2" />
              <span>C</span>
              <span>O</span>
              <span>N</span>
              <span>T</span>
              <span>R</span>
              <span>O</span>
              <span>L</span>
            </span>
          </div>

          {/* Main Controls & Light Grid - 3 Column Layout */}
          <div className="flex-1 flex flex-col justify-between h-[280px]">
            {/* ROW 1 (TOP): DIGITAL BACKUP [Col 1] | Decorative Screw [Col 2] | ALT FLAPS [Col 3] */}
            <div className="grid grid-cols-3 items-start pt-1">
              {/* Col 1: DIGITAL BACKUP */}
              <div className="flex flex-col items-center justify-self-center w-[66px]">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.digitalBackup
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  DIGITAL
                  <br />
                  BACKUP
                </span>

                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      increaseSwitch('digitalBackup');
                    } else if (e.button === 2) {
                      e.preventDefault();
                      decreaseSwitch('digitalBackup');
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`DIGITAL BACKUP: ${activeSwitches.digitalBackup ? 'BACKUP' : 'OFF'} (Left-click for BACKUP, Right-click for OFF)`}
                  className={`my-1 ${isSwitchAllowed('digitalBackup') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <TwoWayToggle isUp={!!activeSwitches.digitalBackup} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.digitalBackup
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* Col 2: Upper Panel Center Spacer */}
              <div className="flex flex-col items-center justify-center pt-6 pointer-events-none">
                <div className="w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center opacity-60">
                  <div className="w-1.5 h-[1px] bg-zinc-700/80" />
                  <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
                </div>
              </div>

              {/* Col 3: ALT FLAPS */}
              <div className="flex flex-col items-center justify-self-center w-[66px]">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.altFlaps
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  ALT FLAPS
                  <br />
                  EXTEND
                </span>

                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      increaseSwitch('altFlaps');
                    } else if (e.button === 2) {
                      e.preventDefault();
                      decreaseSwitch('altFlaps');
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`ALT FLAPS: ${activeSwitches.altFlaps ? 'EXTEND' : 'NORM'} (Left-click for EXTEND, Right-click for NORM)`}
                  className={`my-1 ${isSwitchAllowed('altFlaps') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <TwoWayToggle isUp={!!activeSwitches.altFlaps} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.altFlaps
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  NORM
                </span>
              </div>
            </div>

            {/* ROW 2 (MIDDLE): Alignment (+) [Col 1] | MANUAL TF FLYUP [Col 2] | DUAL WARNING LIGHT [Col 3] */}
            <div className="grid grid-cols-3 items-center my-0.5">
              {/* Col 1: Aircraft Panel Alignment Cross (+) */}
              <div className="flex items-center justify-center select-none">
                <span className="text-zinc-500 font-bold text-[13px] leading-none opacity-80">
                  +
                </span>
              </div>

              {/* Col 2: MANUAL TF FLYUP */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                <span
                  className={`text-[8.5px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.manualTfFlyup
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  MANUAL TF
                  <br />
                  FLYUP
                  <br />
                  DISABLE
                </span>

                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      increaseSwitch('manualTfFlyup');
                    } else if (e.button === 2) {
                      e.preventDefault();
                      decreaseSwitch('manualTfFlyup');
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`MANUAL TF FLYUP: ${activeSwitches.manualTfFlyup ? 'DISABLE' : 'ENABLE'} (Left-click for DISABLE, Right-click for ENABLE)`}
                  className={`my-0.5 ${isSwitchAllowed('manualTfFlyup') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <TwoWayToggle isUp={!!activeSwitches.manualTfFlyup} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.manualTfFlyup
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  ENABLE
                </span>
              </div>

              {/* Col 3: Strictly Square Dual Warning Light: RUN (Green Text Light) / FAIL (Black text on Red Light) */}
              <div className="flex items-center justify-center justify-self-center">
                <div className="w-[58px] h-[58px] min-w-[58px] min-h-[58px] max-w-[58px] max-h-[58px] bg-[#0c0d10] border border-[#262830] rounded flex flex-col shadow-inner overflow-hidden select-none">
                  {/* Top Half: RUN (Dark Background, Green Text Light) */}
                  <div
                    onMouseDown={allowLightInteractivity ? () => handleLightClick('run') : undefined}
                    title={`RUN: ${activeLights.run ? 'ON' : 'OFF'}`}
                    className={`flex-1 flex items-center justify-center border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
                      allowLightInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-black font-mono tracking-wider leading-none uppercase transition-[color,text-shadow] duration-100 ${
                        activeLights.run
                          ? 'text-[#34d399]'
                          : 'text-[#123824]'
                      }`}
                      style={{
                        textShadow: activeLights.run
                          ? '0 0 3px #10B981, 0 0 8px rgba(16, 185, 129, 0.9), 0 0 16px rgba(16, 185, 129, 0.6)'
                          : 'none',
                      }}
                    >
                      RUN
                    </span>
                  </div>

                  {/* Bottom Half: FAIL (Black Text on Red Background Light) */}
                  <div
                    onMouseDown={allowLightInteractivity ? () => handleLightClick('fail') : undefined}
                    title={`FAIL: ${activeLights.fail ? 'ON' : 'OFF'}`}
                    className={`flex-1 flex items-center justify-center transition-[background-color,box-shadow] duration-150 select-none ${
                      allowLightInteractivity ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
                    } ${
                      activeLights.fail
                        ? 'bg-[#ef4444] shadow-[0_0_14px_rgba(239,68,68,0.9),inset_0_0_8px_rgba(255,255,255,0.4)]'
                        : 'bg-[#0c0d10]'
                    }`}
                  >
                    <span
                      className={`text-[10.5px] font-black font-mono tracking-wider leading-none uppercase transition-colors duration-100 ${
                        activeLights.fail ? 'text-black font-black' : 'text-[#451010]'
                      }`}
                    >
                      FAIL
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3 (BOTTOM): LE FLAPS [Col 1] | FLCS RESET (With Wire Guards) [Col 2] | BIT [Col 3] */}
            <div className="grid grid-cols-3 items-start pb-1">
              {/* Col 1: LE FLAPS */}
              <div className="flex flex-col items-center justify-self-center w-[66px]">
                <span
                  className={`text-[8.5px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.leFlaps
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  LE FLAPS
                  <br />
                  LOCK
                </span>

                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      increaseSwitch('leFlaps');
                    } else if (e.button === 2) {
                      e.preventDefault();
                      decreaseSwitch('leFlaps');
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`LE FLAPS: ${activeSwitches.leFlaps ? 'LOCK' : 'AUTO'} (Left-click for LOCK, Right-click for AUTO)`}
                  className={`my-1 ${isSwitchAllowed('leFlaps') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <TwoWayToggle isUp={!!activeSwitches.leFlaps} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.leFlaps
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  AUTO
                </span>
              </div>

              {/* Col 2: FLCS RESET (Momentary Switch Flanked by Two Wire Loop Guards - Left-Click Only) */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.flcsReset
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  FLCS
                  <br />
                  RESET
                </span>

                {/* Wire Guards Flanking the Momentary Toggle */}
                <div className="relative flex items-center justify-center my-1">
                  {/* Left Wire Loop Guard */}
                  <div
                    className="w-1.5 h-11 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm mr-1 pointer-events-none"
                    style={{
                      boxShadow: '1px 2px 4px rgba(0,0,0,0.6)',
                    }}
                  />

                  {/* Momentary Toggle (Depress = RESET, Release = OFF - Left-Click Only) */}
                  <div
                    onMouseDown={handleFlcsResetMouseDown}
                    onMouseUp={handleFlcsResetMouseUp}
                    onMouseLeave={handleFlcsResetMouseUp}
                    onTouchStart={handleFlcsResetMouseDown}
                    onTouchEnd={handleFlcsResetMouseUp}
                    onTouchCancel={handleFlcsResetMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    title="FLCS RESET (Momentary): Press and hold left-click to reset FLCS faults"
                    className={isSwitchAllowed('flcsReset') ? 'cursor-pointer select-none active:scale-95' : 'cursor-default select-none'}
                  >
                    <TwoWayToggle isUp={!!activeSwitches.flcsReset} isRedCollar={true} />
                  </div>

                  {/* Right Wire Loop Guard */}
                  <div
                    className="w-1.5 h-11 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm ml-1 pointer-events-none"
                    style={{
                      boxShadow: '1px 2px 4px rgba(0,0,0,0.6)',
                    }}
                  />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.flcsReset
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* Col 3: BIT (With Wire Loop Guards) */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    activeSwitches.bit
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  BIT
                </span>

                {/* Wire Guards Flanking the BIT Toggle */}
                <div className="relative flex items-center justify-center my-1">
                  {/* Left Wire Loop Guard */}
                  <div
                    className="w-1.5 h-11 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm mr-1 pointer-events-none"
                    style={{
                      boxShadow: '1px 2px 4px rgba(0,0,0,0.6)',
                    }}
                  />

                  {/* BIT Toggle */}
                  <div
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        increaseSwitch('bit');
                      } else if (e.button === 2) {
                        e.preventDefault();
                        decreaseSwitch('bit');
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    title={`BIT: ${activeSwitches.bit ? 'BIT' : 'OFF'} (Left-click for BIT, Right-click for OFF)`}
                    className={`my-1 ${isSwitchAllowed('bit') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                  >
                    <TwoWayToggle isUp={!!activeSwitches.bit} />
                  </div>

                  {/* Right Wire Loop Guard */}
                  <div
                    className="w-1.5 h-11 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm ml-1 pointer-events-none"
                    style={{
                      boxShadow: '1px 2px 4px rgba(0,0,0,0.6)',
                    }}
                  />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    !activeSwitches.bit
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Standard 2-Way Lever Switch Component                                      */
/* -------------------------------------------------------------------------- */

interface TwoWayToggleProps {
  isUp: boolean;
  isRedCollar?: boolean;
}

const TwoWayToggle: React.FC<TwoWayToggleProps> = ({ isUp, isRedCollar = false }) => {
  const shaftTransform = isUp
    ? 'translate(-50%, -44px) scaleY(1.05)'
    : 'translate(-50%, 4px) scaleY(1.05)';

  const ballTransform = isUp
    ? 'translate(-50%, -42px)'
    : 'translate(-50%, 14px)';

  const ballShadow = isUp
    ? '0 10px 12px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
    : '0 -10px 12px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-10 h-10 flex items-center justify-center select-none will-change-transform">
      {/* Outer socket bezel ring */}
      <div
        className="w-9 h-9 rounded-full border border-black/50 shadow-inner z-0"
        style={{
          backgroundImage: `
            radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
            radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
            radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170) 0 50%)
          `,
          boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
        }}
      />

      {/* Red accent collar for FLCS RESET */}
      {isRedCollar && (
        <div className="absolute w-5 h-5 rounded-full border border-red-950/80 bg-red-900/60 pointer-events-none" />
      )}

      {/* Lever Parts (Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Lever Shaft */}
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />

        {/* Lever Ball / Bat Handle Tip */}
        <div
          className="absolute left-1/2 top-1/2 w-4.5 h-4.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
          style={{
            background: `
              radial-gradient(35% 25% at 50% 25%, rgb(136, 136, 153) 20%, rgba(136, 136, 153, 0)),
              radial-gradient(1em 0.75em at 32% 75%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
              radial-gradient(1em 0.75em at 65% 78%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
              radial-gradient(100% 100% at center, rgb(68, 68, 68) 49.5%, rgba(68, 68, 68, 0) 50%)
            `,
            transform: ballTransform,
            boxShadow: ballShadow,
          }}
        />
      </div>
    </div>
  );
};
