'use client';

import React, { useState, useId, useRef } from 'react';
import { Sound } from '../../services/sound';

export interface TestPanelSwitches {
  fireOheatDetect?: boolean; // Push button (momentary)
  obogsBit?: boolean; // false = OFF (down), true = BIT (up) [momentary]
  malIndLts?: boolean; // Push button (momentary)
  probeHeat?: 'PROBE_HEAT' | 'OFF' | 'TEST'; // 3-position vertical switch
  epuGen?: boolean; // false = OFF (down), true = EPU/GEN (up) [momentary]
  stickControl?: 'AFT' | 'FWD'; // Horizontal switch: AFT (left), FWD (right)
  flcsPwrTest?: 'TEST' | 'NORM' | 'MAINT'; // 3-position: TEST (up, momentary), NORM (center), MAINT (down)
}

export interface FlcsPwrLights {
  a?: boolean; // Top-Right (Channel 2 Upper)
  b?: boolean; // Bottom-Right (Channel 2 Lower)
  c?: boolean; // Top-Left (Channel 1 Upper)
  d?: boolean; // Bottom-Left (Channel 1 Lower)
}

export interface TestPanelProps {
  switches?: TestPanelSwitches;
  onSwitchChange?: (switchKey: keyof TestPanelSwitches, value: any) => void;
  lights?: FlcsPwrLights;
  onLightClick?: (lightKey: keyof FlcsPwrLights) => void;
  allowSwitchClick?: boolean | Partial<Record<keyof TestPanelSwitches, boolean>>; // Global or per-switch toggle interactivity
  enabledSwitches?: Partial<Record<keyof TestPanelSwitches, boolean>>; // Per-switch enabled overrides
  allowLightInteractivity?: boolean; // Allow direct click testing on annunciator quadrants (default: false)
  className?: string;
}

export const TestPanel: React.FC<TestPanelProps> = ({
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
  const [internalSwitches, setInternalSwitches] = useState<TestPanelSwitches>({
    fireOheatDetect: false,
    obogsBit: false,
    malIndLts: false,
    probeHeat: 'OFF',
    epuGen: false,
    stickControl: 'FWD',
    flcsPwrTest: 'NORM',
  });

  const activeSwitches: TestPanelSwitches = {
    ...internalSwitches,
    ...(controlledSwitches || {}),
  };

  // Helper to determine if a specific switch is allowed to be clicked
  const isSwitchAllowed = (key: keyof TestPanelSwitches): boolean => {
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
  const [internalLightOverrides, setInternalLightOverrides] = useState<FlcsPwrLights>({});

  // Default lights: when FLCS PWR TEST is in 'TEST', all 4 lights illuminate by default
  const isTestActive = activeSwitches.flcsPwrTest === 'TEST';
  const defaultLights: FlcsPwrLights = {
    a: isTestActive,
    b: isTestActive,
    c: isTestActive,
    d: isTestActive,
  };

  const activeLights: FlcsPwrLights = {
    ...defaultLights,
    ...internalLightOverrides,
    ...(controlledLights || {}),
  };

  // Generic switch setter with sound
  const setSwitch = (key: keyof TestPanelSwitches, value: any) => {
    if (!isSwitchAllowed(key)) return;
    if (activeSwitches[key] === value) return; // Prevent sound if state unchanged
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

  // Momentary switch press tracking
  const obogsPressRef = useRef<boolean>(false);
  const epuGenPressRef = useRef<boolean>(false);
  const flcsTestPressRef = useRef<boolean>(false);
  const fireOheatPressRef = useRef<boolean>(false);
  const malIndPressRef = useRef<boolean>(false);

  // OBOGS BIT Momentary Handlers (Left-click only)
  const handleObogsMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('obogsBit')) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    obogsPressRef.current = true;
    setSwitch('obogsBit', true);
  };
  const handleObogsMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('obogsBit')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!obogsPressRef.current) return;
    obogsPressRef.current = false;
    setSwitch('obogsBit', false);
  };

  // EPU/GEN Momentary Handlers (Left-click only)
  const handleEpuGenMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('epuGen')) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    epuGenPressRef.current = true;
    setSwitch('epuGen', true);
  };
  const handleEpuGenMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('epuGen')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!epuGenPressRef.current) return;
    epuGenPressRef.current = false;
    setSwitch('epuGen', false);
  };

  // FLCS PWR TEST Handlers (Strict Directional Clicks)
  const handleFlcsTestMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('flcsPwrTest')) return;
    if ('button' in e && e.button === 2) {
      e.preventDefault();
      // Right-click decreases: if in NORM, goes to MAINT. If already in MAINT, does nothing!
      if (activeSwitches.flcsPwrTest === 'NORM') {
        setSwitch('flcsPwrTest', 'MAINT');
      }
      return;
    }
    if ('button' in e && e.button !== 0) return; // Left-click only!
    e.preventDefault();

    // If currently in MAINT, ONLY left click can exit to NORM (on first click)
    if (activeSwitches.flcsPwrTest === 'MAINT') {
      flcsTestPressRef.current = false;
      setSwitch('flcsPwrTest', 'NORM');
      return;
    }

    // When in NORM, holding left-click activates momentary TEST
    flcsTestPressRef.current = true;
    setSwitch('flcsPwrTest', 'TEST');
  };

  const handleFlcsTestMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('flcsPwrTest')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!flcsTestPressRef.current) return;
    flcsTestPressRef.current = false;
    setSwitch('flcsPwrTest', 'NORM');
  };

  const handleFlcsTestContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Push Button Momentary Handlers: FIRE & OHEAT DETECT (Left-click only)
  const handleFireOheatMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('fireOheatDetect')) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    Sound.playClick();
    fireOheatPressRef.current = true;
    setSwitch('fireOheatDetect', true);
  };
  const handleFireOheatMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('fireOheatDetect')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!fireOheatPressRef.current) return;
    fireOheatPressRef.current = false;
    setSwitch('fireOheatDetect', false);
  };

  // Push Button Momentary Handlers: MAL & IND LTS (Left-click only)
  const handleMalIndMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('malIndLts')) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    Sound.playClick();
    malIndPressRef.current = true;
    setSwitch('malIndLts', true);
  };
  const handleMalIndMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('malIndLts')) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!malIndPressRef.current) return;
    malIndPressRef.current = false;
    setSwitch('malIndLts', false);
  };

  // 3-Way PROBE HEAT Directional Controls (Left = Increase, Right = Decrease)
  const increaseProbeHeat = () => {
    if (!isSwitchAllowed('probeHeat')) return;
    if (activeSwitches.probeHeat === 'TEST') setSwitch('probeHeat', 'OFF');
    else if (activeSwitches.probeHeat === 'OFF') setSwitch('probeHeat', 'PROBE_HEAT');
  };
  const decreaseProbeHeat = () => {
    if (!isSwitchAllowed('probeHeat')) return;
    if (activeSwitches.probeHeat === 'PROBE_HEAT') setSwitch('probeHeat', 'OFF');
    else if (activeSwitches.probeHeat === 'OFF') setSwitch('probeHeat', 'TEST');
  };

  // Horizontal STICK CONTROL Directional Controls (Left = Increase to FWD, Right = Decrease to AFT)
  const increaseStickControl = () => {
    if (!isSwitchAllowed('stickControl')) return;
    setSwitch('stickControl', 'FWD');
  };
  const decreaseStickControl = () => {
    if (!isSwitchAllowed('stickControl')) return;
    setSwitch('stickControl', 'AFT');
  };

  // Annunciator quadrant click handler
  const handleLightClick = (key: keyof FlcsPwrLights) => {
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
      {/* Authentic Avionics TEST Panel Chassis - Fixed Width (270px) */}
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

        {/* Panel Content Layout with Vertical TEST on Far Left */}
        <div className="flex items-stretch space-x-2 pt-1 pr-1">
          {/* Vertical TEST Text on Far Left */}
          <div className="flex flex-col items-center justify-center pl-0.5 select-none w-5">
            <span className="text-[12px] font-black tracking-[0.4em] text-zinc-300 leading-[1.8] flex flex-col items-center">
              <span>T</span>
              <span>E</span>
              <span>S</span>
              <span>T</span>
            </span>
          </div>

          {/* Main Controls & Light Grid - 3 Column Layout */}
          <div className="flex-1 flex flex-col justify-between h-[280px]">
            {/* ROW 1 (TOP): FIRE & OHEAT DETECT [Col 1] | OBOGS BIT [Col 2] | MAL & IND LTS [Col 3] */}
            <div className="grid grid-cols-3 items-start pt-1">
              {/* Col 1: FIRE & OHEAT DETECT Button */}
              <div className="flex flex-col items-center justify-self-center w-[68px]">
                <span className="text-[8.5px] font-black tracking-tight uppercase leading-tight text-center text-zinc-200">
                  FIRE &amp;
                  <br />
                  OHEAT DETECT
                </span>

                <div className="my-1.5 flex items-center justify-center h-10">
                  <button
                    type="button"
                    onMouseDown={handleFireOheatMouseDown}
                    onMouseUp={handleFireOheatMouseUp}
                    onMouseLeave={handleFireOheatMouseUp}
                    onTouchStart={handleFireOheatMouseDown}
                    onTouchEnd={handleFireOheatMouseUp}
                    onTouchCancel={handleFireOheatMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={!isSwitchAllowed('fireOheatDetect')}
                    title="FIRE & OHEAT DETECT (Momentary): Press and hold left-click to test overheat/fire detection"
                    className={`w-6 h-6 rounded-full border border-black/60 transition-transform duration-75 select-none flex items-center justify-center ${
                      isSwitchAllowed('fireOheatDetect') ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      activeSwitches.fireOheatDetect
                        ? 'bg-[#b8b8b8] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] scale-95'
                        : 'bg-gradient-to-b from-[#f2f2f2] to-[#d8d8d8] shadow-[0_2px_5px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:brightness-105 active:scale-95'
                    }`}
                  />
                </div>
              </div>

              {/* Col 2: OBOGS BIT (Momentary Up) */}
              <div className="flex flex-col items-center justify-self-center w-[66px]">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.obogsBit
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OBOGS
                  <br />
                  BIT
                </span>

                <div
                  onMouseDown={handleObogsMouseDown}
                  onMouseUp={handleObogsMouseUp}
                  onMouseLeave={handleObogsMouseUp}
                  onTouchStart={handleObogsMouseDown}
                  onTouchEnd={handleObogsMouseUp}
                  onTouchCancel={handleObogsMouseUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isSwitchAllowed('obogsBit')) return;
                    setSwitch('obogsBit', false);
                  }}
                  title="OBOGS BIT (Momentary): Hold left-click up to test OBOGS"
                  className={`my-1 select-none ${isSwitchAllowed('obogsBit') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <VerticalLeverToggle isUp={!!activeSwitches.obogsBit} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center ${
                    !activeSwitches.obogsBit
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* Col 3: MAL & IND LTS Button */}
              <div className="flex flex-col items-center justify-self-center w-[68px]">
                <span className="text-[8.5px] font-black tracking-tight uppercase leading-tight text-center text-zinc-200">
                  MAL &amp;
                  <br />
                  IND LTS
                </span>

                <div className="my-1.5 flex items-center justify-center h-10">
                  <button
                    type="button"
                    onMouseDown={handleMalIndMouseDown}
                    onMouseUp={handleMalIndMouseUp}
                    onMouseLeave={handleMalIndMouseUp}
                    onTouchStart={handleMalIndMouseDown}
                    onTouchEnd={handleMalIndMouseUp}
                    onTouchCancel={handleMalIndMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={!isSwitchAllowed('malIndLts')}
                    title="MAL & IND LTS (Momentary): Press and hold left-click to test malfunction and indicator lights"
                    className={`w-6 h-6 rounded-full border border-black/60 transition-transform duration-75 select-none flex items-center justify-center ${
                      isSwitchAllowed('malIndLts') ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      activeSwitches.malIndLts
                        ? 'bg-[#b8b8b8] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] scale-95'
                        : 'bg-gradient-to-b from-[#f2f2f2] to-[#d8d8d8] shadow-[0_2px_5px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.9)] hover:brightness-105 active:scale-95'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* ROW 2 (MIDDLE): PROBE HEAT [Col 1] | EPU/GEN [Col 2] | FLCS PWR L I R & CHAN [Col 3] */}
            <div className="grid grid-cols-3 items-center my-0.5">
              {/* Col 1: PROBE HEAT (3-Way: PROBE_HEAT [Up] / OFF [Right] / TEST [Down]) */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                <span
                  className={`text-[8.5px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.probeHeat === 'PROBE_HEAT'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  PROBE
                  <br />
                  HEAT
                </span>

                {/* Lever with OFF text on its right */}
                <div className="relative flex items-center justify-center my-0.5">
                  <div
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        increaseProbeHeat();
                      } else if (e.button === 2) {
                        e.preventDefault();
                        decreaseProbeHeat();
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    title={`PROBE HEAT: ${activeSwitches.probeHeat} (Left-click to step up, Right-click to step down)`}
                    className={isSwitchAllowed('probeHeat') ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                  >
                    <ThreeWayLeverToggle
                      position={
                        activeSwitches.probeHeat === 'PROBE_HEAT'
                          ? 'UP'
                          : activeSwitches.probeHeat === 'TEST'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  {/* OFF text on the right side of the switch */}
                  <span
                    className={`absolute left-[calc(50%+22px)] text-[9px] font-black tracking-wider uppercase leading-none select-none pointer-events-none ${
                      activeSwitches.probeHeat === 'OFF'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200'
                    }`}
                  >
                    OFF
                  </span>
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center select-none pointer-events-none ${
                    activeSwitches.probeHeat === 'TEST'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  TEST
                </span>
              </div>

              {/* Col 2: EPU/GEN (Momentary Up) */}
              <div className="flex flex-col items-center justify-self-center w-[66px]">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.epuGen
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  EPU/GEN
                </span>

                <div
                  onMouseDown={handleEpuGenMouseDown}
                  onMouseUp={handleEpuGenMouseUp}
                  onMouseLeave={handleEpuGenMouseUp}
                  onTouchStart={handleEpuGenMouseDown}
                  onTouchEnd={handleEpuGenMouseUp}
                  onTouchCancel={handleEpuGenMouseUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!isSwitchAllowed('epuGen')) return;
                    setSwitch('epuGen', false);
                  }}
                  title="EPU/GEN (Momentary): Hold left-click up to test EPU/GEN"
                  className={`my-1 select-none ${isSwitchAllowed('epuGen') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <VerticalLeverToggle isUp={!!activeSwitches.epuGen} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center ${
                    !activeSwitches.epuGen
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* Col 3: FLCS PWR L I R Quadrant Annunciator (58px x 58px) with CHAN and 1 - 2 */}
              <div className="flex items-start justify-center justify-self-center">
                {/* Main Light Unit & Header */}
                <div className="flex flex-col items-center">
                  {/* Header text: FLCS PWR L I R */}
                  <div className="text-[8px] font-black tracking-tight uppercase leading-tight text-center text-zinc-200 mb-1 h-9 flex flex-col justify-end">
                    <span>FLCS</span>
                    <span>PWR</span>
                    <span className="tracking-widest">L I R</span>
                  </div>

                  {/* 4-Quadrant Square Unit (58px x 58px) */}
                  <div className="w-[58px] h-[58px] min-w-[58px] min-h-[58px] max-w-[58px] max-h-[58px] bg-[#0c0d10] border border-[#262830] rounded grid grid-cols-2 grid-rows-2 shadow-inner overflow-hidden select-none">
                    {/* Quadrant 1 (Top-Left): C [Channel 1 Upper] */}
                    <div
                      onMouseDown={allowLightInteractivity ? () => handleLightClick('c') : undefined}
                      title={`FLCS PWR C: ${activeLights.c ? 'ON' : 'OFF'}`}
                      className={`flex items-center justify-center border-r border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
                        allowLightInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-black font-mono leading-none transition-[color,text-shadow] duration-100 ${
                          activeLights.c ? 'text-[#34d399]' : 'text-[#123824]'
                        }`}
                        style={{
                          textShadow: activeLights.c
                            ? '0 0 3px #10B981, 0 0 8px rgba(16, 185, 129, 0.9), 0 0 16px rgba(16, 185, 129, 0.6)'
                            : 'none',
                        }}
                      >
                        C
                      </span>
                    </div>

                    {/* Quadrant 2 (Top-Right): A [Channel 2 Upper] */}
                    <div
                      onMouseDown={allowLightInteractivity ? () => handleLightClick('a') : undefined}
                      title={`FLCS PWR A: ${activeLights.a ? 'ON' : 'OFF'}`}
                      className={`flex items-center justify-center border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
                        allowLightInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-black font-mono leading-none transition-[color,text-shadow] duration-100 ${
                          activeLights.a ? 'text-[#34d399]' : 'text-[#123824]'
                        }`}
                        style={{
                          textShadow: activeLights.a
                            ? '0 0 3px #10B981, 0 0 8px rgba(16, 185, 129, 0.9), 0 0 16px rgba(16, 185, 129, 0.6)'
                            : 'none',
                        }}
                      >
                        A
                      </span>
                    </div>

                    {/* Quadrant 3 (Bottom-Left): D [Channel 1 Lower] */}
                    <div
                      onMouseDown={allowLightInteractivity ? () => handleLightClick('d') : undefined}
                      title={`FLCS PWR D: ${activeLights.d ? 'ON' : 'OFF'}`}
                      className={`flex items-center justify-center border-r border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
                        allowLightInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-black font-mono leading-none transition-[color,text-shadow] duration-100 ${
                          activeLights.d ? 'text-[#34d399]' : 'text-[#123824]'
                        }`}
                        style={{
                          textShadow: activeLights.d
                            ? '0 0 3px #10B981, 0 0 8px rgba(16, 185, 129, 0.9), 0 0 16px rgba(16, 185, 129, 0.6)'
                            : 'none',
                        }}
                      >
                        D
                      </span>
                    </div>

                    {/* Quadrant 4 (Bottom-Right): B [Channel 2 Lower] */}
                    <div
                      onMouseDown={allowLightInteractivity ? () => handleLightClick('b') : undefined}
                      title={`FLCS PWR B: ${activeLights.b ? 'ON' : 'OFF'}`}
                      className={`flex items-center justify-center bg-[#0c0d10] select-none ${
                        allowLightInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-black font-mono leading-none transition-[color,text-shadow] duration-100 ${
                          activeLights.b ? 'text-[#34d399]' : 'text-[#123824]'
                        }`}
                        style={{
                          textShadow: activeLights.b
                            ? '0 0 3px #10B981, 0 0 8px rgba(16, 185, 129, 0.9), 0 0 16px rgba(16, 185, 129, 0.6)'
                            : 'none',
                        }}
                      >
                        B
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Side Column: Thin Line on Left, CHAN at FLCS PWR L I R level, and 1 - 2 alongside the light */}
                <div className="border-l border-zinc-600/70 pl-1 ml-1 flex flex-col justify-between h-[100px] select-none">
                  {/* CHAN: Same vertical level as FLCS PWR L I R text */}
                  <div className="flex flex-col items-center text-[7px] font-black tracking-widest text-zinc-300 leading-[1.3] h-9 justify-center">
                    <span>C</span>
                    <span>H</span>
                    <span>A</span>
                    <span>N</span>
                  </div>

                  {/* 1 - 2: Vertical on the right side of the button/light */}
                  <div className="flex flex-col items-center text-[8px] font-black text-zinc-300 leading-none h-[58px] justify-center space-y-1">
                    <span>1</span>
                    <span className="text-[7px] text-zinc-400 font-bold">-</span>
                    <span>2</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3 (BOTTOM): STICK CONTROL [Col 1] | Alignment (+) [Col 2] | FLCS PWR TEST [Col 3] */}
            <div className="grid grid-cols-3 items-start pb-1">
              {/* Col 1: STICK CONTROL (Horizontal Switch: AFT / FWD) */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                <span className="text-[8.5px] font-black tracking-tight uppercase leading-tight text-center text-zinc-200 mb-1">
                  STICK CONTROL
                </span>

                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      increaseStickControl(); // Left-click: moves right to FWD
                    } else if (e.button === 2) {
                      e.preventDefault();
                      decreaseStickControl(); // Right-click: moves left to AFT
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`STICK CONTROL: ${activeSwitches.stickControl} (Left-click for FWD, Right-click for AFT)`}
                  className={`my-1 ${isSwitchAllowed('stickControl') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                >
                  <HorizontalLeverToggle position={activeSwitches.stickControl || 'FWD'} />
                </div>

                <div className="flex items-center justify-between w-full px-1 text-[8.5px] font-black uppercase text-zinc-400 select-none pointer-events-none">
                  <span
                    className={`${
                      activeSwitches.stickControl === 'AFT'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-300'
                    }`}
                  >
                    AFT
                  </span>
                  <span
                    className={`${
                      activeSwitches.stickControl === 'FWD'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-300'
                    }`}
                  >
                    FWD
                  </span>
                </div>
              </div>

              {/* Col 2: Alignment Cross (+) */}
              <div className="flex items-center justify-center select-none pt-4 pointer-events-none">
                <span className="text-zinc-500 font-bold text-[13px] leading-none opacity-80">
                  +
                </span>
              </div>

              {/* Col 3: FLCS PWR TEST (3-Position: TEST [MOM] / NORM [Right] / MAINT [Down]) */}
              <div className="flex flex-col items-center justify-self-center w-[74px]">
                {/* TEST on Top */}
                <span
                  className={`text-[8.5px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none ${
                    activeSwitches.flcsPwrTest === 'TEST'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  TEST
                </span>

                {/* Lever with NORM text on its right */}
                <div className="relative flex items-center justify-center my-0.5">
                  <div
                    onMouseDown={handleFlcsTestMouseDown}
                    onMouseUp={handleFlcsTestMouseUp}
                    onMouseLeave={handleFlcsTestMouseUp}
                    onTouchStart={handleFlcsTestMouseDown}
                    onTouchEnd={handleFlcsTestMouseUp}
                    onTouchCancel={handleFlcsTestMouseUp}
                    onContextMenu={handleFlcsTestContextMenu}
                    title={`FLCS PWR TEST: ${activeSwitches.flcsPwrTest} (Left-click & hold for TEST, Right-click for MAINT)`}
                    className={`select-none ${isSwitchAllowed('flcsPwrTest') ? 'cursor-pointer active:scale-95' : 'cursor-default'}`}
                  >
                    <ThreeWayLeverToggle
                      position={
                        activeSwitches.flcsPwrTest === 'TEST'
                          ? 'UP'
                          : activeSwitches.flcsPwrTest === 'MAINT'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  {/* NORM text on the right side of the switch */}
                  <span
                    className={`absolute left-[calc(50%+22px)] text-[8.5px] font-black tracking-wider uppercase leading-none whitespace-nowrap select-none pointer-events-none ${
                      activeSwitches.flcsPwrTest === 'NORM'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200'
                    }`}
                  >
                    NORM
                  </span>
                </div>

                {/* MAINT on Bottom */}
                <span
                  className={`text-[8.5px] font-black tracking-tight uppercase text-center select-none pointer-events-none ${
                    activeSwitches.flcsPwrTest === 'MAINT'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-300'
                  }`}
                >
                  MAINT
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
/* Standard 2-Way Vertical Lever Switch Component                              */
/* -------------------------------------------------------------------------- */

interface VerticalLeverToggleProps {
  isUp: boolean;
}

const VerticalLeverToggle: React.FC<VerticalLeverToggleProps> = ({ isUp }) => {
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

      {/* Lever Parts (Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />
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

/* -------------------------------------------------------------------------- */
/* 3-Position Vertical Lever Switch Component                                 */
/* -------------------------------------------------------------------------- */

interface ThreeWayLeverToggleProps {
  position: 'UP' | 'CENTER' | 'DOWN';
}

const ThreeWayLeverToggle: React.FC<ThreeWayLeverToggleProps> = ({ position }) => {
  const isUp = position === 'UP';
  const isDown = position === 'DOWN';

  const shaftTransform = isUp
    ? 'translate(-50%, -44px) scaleY(1.05)'
    : isDown
    ? 'translate(-50%, 4px) scaleY(1.05)'
    : 'translate(-50%, -20px) scaleY(0.65)';

  const ballTransform = isUp
    ? 'translate(-50%, -42px)'
    : isDown
    ? 'translate(-50%, 14px)'
    : 'translate(-50%, -14px)';

  const ballShadow = isUp
    ? '0 10px 12px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
    : isDown
    ? '0 -10px 12px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)'
    : '0 4px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.9)';

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

      {/* Lever Parts (Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />
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

/* -------------------------------------------------------------------------- */
/* Horizontal (Sideways) 2-Way Lever Switch Component                         */
/* -------------------------------------------------------------------------- */

interface HorizontalLeverToggleProps {
  position: 'AFT' | 'FWD';
}

const HorizontalLeverToggle: React.FC<HorizontalLeverToggleProps> = ({ position }) => {
  const isAft = position === 'AFT';

  const shaftTransform = isAft
    ? 'translate(-44px, -50%) scaleX(1.05)'
    : 'translate(4px, -50%) scaleX(1.05)';

  const ballTransform = isAft
    ? 'translate(-42px, -50%)'
    : 'translate(14px, -50%)';

  const ballShadow = isAft
    ? '-10px 0 12px rgba(0,0,0,0.7), inset 2px 0 3px rgba(255,255,255,0.9)'
    : '10px 0 12px rgba(0,0,0,0.7), inset -2px 0 3px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-10 h-10 flex items-center justify-center select-none will-change-transform">
      {/* Outer socket bezel ring */}
      <div
        className="w-9 h-9 rounded-full border border-black/50 shadow-inner z-0"
        style={{
          backgroundImage: `
            radial-gradient(1.5em 1em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
            radial-gradient(1em 0.65em at 53% 50%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
            radial-gradient(0.75em 0.75em at 45% 55%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170) 0 50%)
          `,
          boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
        }}
      />

      {/* Lever Parts (Horizontal Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="absolute left-1/2 top-1/2 w-9 h-3 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'right center',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 w-4.5 h-4.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
          style={{
            background: `
              radial-gradient(25% 35% at 25% 50%, rgb(136, 136, 153) 20%, rgba(136, 136, 153, 0)),
              radial-gradient(0.75em 1em at 75% 32%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
              radial-gradient(0.75em 1em at 78% 65%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
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
