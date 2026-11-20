'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';
import { CockpitThreeWaySwitch } from './CockpitSwitch';

export type ScalesPosition = 'VV_VAH' | 'VAH' | 'OFF';
export type FpMarkerPosition = 'ATT_FPM' | 'FPM' | 'OFF';
export type DedDataPosition = 'DED_DATA' | 'PFL' | 'OFF';
export type DeprRetPosition = 'STBY' | 'PRI' | 'OFF';
export type SpeedPosition = 'CAS' | 'TAS' | 'GND_SPD';
export type AltPosition = 'ALT_RADAR' | 'BARO' | 'OFF';
export type BrightPosition = 'DAY' | 'AUTO_BRT' | 'NIGHT';
export type TestPosition = 'TEST_STEP' | 'ON' | 'OFF';

export interface HudPanelSwitches {
  scales?: ScalesPosition;
  fpMarker?: FpMarkerPosition;
  dedData?: DedDataPosition;
  deprRet?: DeprRetPosition;
  speed?: SpeedPosition;
  alt?: AltPosition;
  bright?: BrightPosition;
  test?: TestPosition;
}

export interface HudControlPanelProps {
  switches?: HudPanelSwitches;
  onSwitchChange?: (switchKey: keyof HudPanelSwitches, value: any) => void;
  // Individual controlled props
  scales?: ScalesPosition;
  onScalesChange?: (val: ScalesPosition) => void;
  fpMarker?: FpMarkerPosition;
  onFpMarkerChange?: (val: FpMarkerPosition) => void;
  dedData?: DedDataPosition;
  onDedDataChange?: (val: DedDataPosition) => void;
  deprRet?: DeprRetPosition;
  onDeprRetChange?: (val: DeprRetPosition) => void;
  speed?: SpeedPosition;
  onSpeedChange?: (val: SpeedPosition) => void;
  alt?: AltPosition;
  onAltChange?: (val: AltPosition) => void;
  bright?: BrightPosition;
  onBrightChange?: (val: BrightPosition) => void;
  test?: TestPosition;
  onTestChange?: (val: TestPosition) => void;
  // Interactivity lockout controls
  allowSwitchClick?: boolean | Partial<Record<keyof HudPanelSwitches, boolean>>;
  enabledSwitches?: Partial<Record<keyof HudPanelSwitches, boolean>>;
  className?: string;
}

export const HudControlPanel: React.FC<HudControlPanelProps> = ({
  switches: controlledSwitches,
  onSwitchChange,
  scales: controlledScales,
  onScalesChange,
  fpMarker: controlledFpMarker,
  onFpMarkerChange,
  dedData: controlledDedData,
  onDedDataChange,
  deprRet: controlledDeprRet,
  onDeprRetChange,
  speed: controlledSpeed,
  onSpeedChange,
  alt: controlledAlt,
  onAltChange,
  bright: controlledBright,
  onBrightChange,
  test: controlledTest,
  onTestChange,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  // Internal uncontrolled state with realistic defaults:
  // VV_VAH, ATT_FPM, OFF, OFF, CAS, ALT_RADAR, DAY, OFF
  const [internalSwitches, setInternalSwitches] = useState<Required<HudPanelSwitches>>({
    scales: 'VV_VAH',
    fpMarker: 'ATT_FPM',
    dedData: 'OFF',
    deprRet: 'OFF',
    speed: 'CAS',
    alt: 'ALT_RADAR',
    bright: 'DAY',
    test: 'OFF',
  });

  // Active state resolution
  const activeScales: ScalesPosition =
    controlledScales !== undefined
      ? controlledScales
      : controlledSwitches?.scales !== undefined
      ? controlledSwitches.scales
      : internalSwitches.scales;

  const activeFpMarker: FpMarkerPosition =
    controlledFpMarker !== undefined
      ? controlledFpMarker
      : controlledSwitches?.fpMarker !== undefined
      ? controlledSwitches.fpMarker
      : internalSwitches.fpMarker;

  const activeDedData: DedDataPosition =
    controlledDedData !== undefined
      ? controlledDedData
      : controlledSwitches?.dedData !== undefined
      ? controlledSwitches.dedData
      : internalSwitches.dedData;

  const activeDeprRet: DeprRetPosition =
    controlledDeprRet !== undefined
      ? controlledDeprRet
      : controlledSwitches?.deprRet !== undefined
      ? controlledSwitches.deprRet
      : internalSwitches.deprRet;

  const activeSpeed: SpeedPosition =
    controlledSpeed !== undefined
      ? controlledSpeed
      : controlledSwitches?.speed !== undefined
      ? controlledSwitches.speed
      : internalSwitches.speed;

  const activeAlt: AltPosition =
    controlledAlt !== undefined
      ? controlledAlt
      : controlledSwitches?.alt !== undefined
      ? controlledSwitches.alt
      : internalSwitches.alt;

  const activeBright: BrightPosition =
    controlledBright !== undefined
      ? controlledBright
      : controlledSwitches?.bright !== undefined
      ? controlledSwitches.bright
      : internalSwitches.bright;

  const activeTest: TestPosition =
    controlledTest !== undefined
      ? controlledTest
      : controlledSwitches?.test !== undefined
      ? controlledSwitches.test
      : internalSwitches.test;

  // Interactivity helper
  const isSwitchAllowed = (key: keyof HudPanelSwitches): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  // Generic switch value setter with sound feedback
  const updateSwitch = <K extends keyof HudPanelSwitches>(
    key: K,
    newVal: Required<HudPanelSwitches>[K],
    individualCallback?: (val: any) => void
  ) => {
    if (!isSwitchAllowed(key)) return;

    const currentVal =
      key === 'scales'
        ? activeScales
        : key === 'fpMarker'
        ? activeFpMarker
        : key === 'dedData'
        ? activeDedData
        : key === 'deprRet'
        ? activeDeprRet
        : key === 'speed'
        ? activeSpeed
        : key === 'alt'
        ? activeAlt
        : key === 'bright'
        ? activeBright
        : activeTest;

    if (currentVal === newVal) return;

    Sound.playSwitch();

    if (individualCallback) {
      individualCallback(newVal);
    }
    if (onSwitchChange) {
      onSwitchChange(key, newVal);
    }
    if (!individualCallback && !onSwitchChange) {
      setInternalSwitches((prev) => ({
        ...prev,
        [key]: newVal,
      }));
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Mouse Click Handlers (Strict Non-Cycling)                                  */
  /* Left Click = UP (DOWN -> CENTER -> UP)                                     */
  /* Right Click = DOWN (UP -> CENTER -> DOWN)                                  */
  /* -------------------------------------------------------------------------- */

  // Switch 1: SCALES (VV_VAH / VAH / OFF)
  const handleScalesClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('scales')) return;
    if (e.button === 0) {
      if (activeScales === 'OFF') updateSwitch('scales', 'VAH', onScalesChange);
      else if (activeScales === 'VAH') updateSwitch('scales', 'VV_VAH', onScalesChange);
    } else if (e.button === 2) {
      if (activeScales === 'VV_VAH') updateSwitch('scales', 'VAH', onScalesChange);
      else if (activeScales === 'VAH') updateSwitch('scales', 'OFF', onScalesChange);
    }
  };

  // Switch 2: FP-MARKER (ATT_FPM / FPM / OFF)
  const handleFpMarkerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('fpMarker')) return;
    if (e.button === 0) {
      if (activeFpMarker === 'OFF') updateSwitch('fpMarker', 'FPM', onFpMarkerChange);
      else if (activeFpMarker === 'FPM') updateSwitch('fpMarker', 'ATT_FPM', onFpMarkerChange);
    } else if (e.button === 2) {
      if (activeFpMarker === 'ATT_FPM') updateSwitch('fpMarker', 'FPM', onFpMarkerChange);
      else if (activeFpMarker === 'FPM') updateSwitch('fpMarker', 'OFF', onFpMarkerChange);
    }
  };

  // Switch 3: DED DATA (DED_DATA / PFL / OFF)
  const handleDedDataClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('dedData')) return;
    if (e.button === 0) {
      if (activeDedData === 'OFF') updateSwitch('dedData', 'PFL', onDedDataChange);
      else if (activeDedData === 'PFL') updateSwitch('dedData', 'DED_DATA', onDedDataChange);
    } else if (e.button === 2) {
      if (activeDedData === 'DED_DATA') updateSwitch('dedData', 'PFL', onDedDataChange);
      else if (activeDedData === 'PFL') updateSwitch('dedData', 'OFF', onDedDataChange);
    }
  };

  // Switch 4: DEPR RET (STBY / PRI / OFF)
  const handleDeprRetClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('deprRet')) return;
    if (e.button === 0) {
      if (activeDeprRet === 'OFF') updateSwitch('deprRet', 'PRI', onDeprRetChange);
      else if (activeDeprRet === 'PRI') updateSwitch('deprRet', 'STBY', onDeprRetChange);
    } else if (e.button === 2) {
      if (activeDeprRet === 'STBY') updateSwitch('deprRet', 'PRI', onDeprRetChange);
      else if (activeDeprRet === 'PRI') updateSwitch('deprRet', 'OFF', onDeprRetChange);
    }
  };

  // Switch 5: SPEED (CAS / TAS / GND_SPD)
  const handleSpeedClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('speed')) return;
    if (e.button === 0) {
      if (activeSpeed === 'GND_SPD') updateSwitch('speed', 'TAS', onSpeedChange);
      else if (activeSpeed === 'TAS') updateSwitch('speed', 'CAS', onSpeedChange);
    } else if (e.button === 2) {
      if (activeSpeed === 'CAS') updateSwitch('speed', 'TAS', onSpeedChange);
      else if (activeSpeed === 'TAS') updateSwitch('speed', 'GND_SPD', onSpeedChange);
    }
  };

  // Switch 6: ALT (ALT_RADAR / BARO / OFF)
  const handleAltClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('alt')) return;
    if (e.button === 0) {
      if (activeAlt === 'OFF') updateSwitch('alt', 'BARO', onAltChange);
      else if (activeAlt === 'BARO') updateSwitch('alt', 'ALT_RADAR', onAltChange);
    } else if (e.button === 2) {
      if (activeAlt === 'ALT_RADAR') updateSwitch('alt', 'BARO', onAltChange);
      else if (activeAlt === 'BARO') updateSwitch('alt', 'OFF', onAltChange);
    }
  };

  // Switch 7: BRIGHT (DAY / AUTO_BRT / NIGHT)
  const handleBrightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('bright')) return;
    if (e.button === 0) {
      if (activeBright === 'NIGHT') updateSwitch('bright', 'AUTO_BRT', onBrightChange);
      else if (activeBright === 'AUTO_BRT') updateSwitch('bright', 'DAY', onBrightChange);
    } else if (e.button === 2) {
      if (activeBright === 'DAY') updateSwitch('bright', 'AUTO_BRT', onBrightChange);
      else if (activeBright === 'AUTO_BRT') updateSwitch('bright', 'NIGHT', onBrightChange);
    }
  };

  // Switch 8: TEST (TEST_STEP / ON / OFF)
  const handleTestClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('test')) return;
    if (e.button === 0) {
      if (activeTest === 'OFF') updateSwitch('test', 'ON', onTestChange);
      else if (activeTest === 'ON') updateSwitch('test', 'TEST_STEP', onTestChange);
    } else if (e.button === 2) {
      if (activeTest === 'TEST_STEP') updateSwitch('test', 'ON', onTestChange);
      else if (activeTest === 'ON') updateSwitch('test', 'OFF', onTestChange);
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics HUD Panel Chassis */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-3.5 w-[335px] min-w-[335px] max-w-[335px] text-zinc-300 font-mono select-none"
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

        {/* Panel Content: Vertical HUD on Left + 2-Row Switch Matrix on Right */}
        <div className="flex items-center space-x-2.5 pt-0.5">
          {/* Vertical HUD Text on Far Left (Vertically Centered across both rows) */}
          <div className="flex flex-col items-center justify-center pl-1 pr-1.5 select-none w-5">
            <span className="text-[14px] font-black tracking-[0.25em] text-zinc-300 leading-[1.6] flex flex-col items-center">
              <span>H</span>
              <span>U</span>
              <span>D</span>
            </span>
          </div>

          {/* 2 Rows of 4 Switches */}
          <div className="flex-1 flex flex-col space-y-3">
            {/* ---------------------------------------------------------------- */}
            {/* ROW 1: SCALES | FP-MARKER | DED DATA | DEPR RET                  */}
            {/* ---------------------------------------------------------------- */}
            <div className="grid grid-cols-4 gap-1 items-start justify-items-center">
              {/* SWITCH 1: SCALES (VV_VAH / VAH / OFF) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (VV/VAH) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeScales === 'VV_VAH' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    VV/VAH
                  </span>
                </div>

                {/* Lever & Center VAH Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleScalesClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('scales')
                        ? `SCALES: ${activeScales}. Left-click steps up, Right-click steps down.`
                        : `SCALES: ${activeScales}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('scales')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeScales === 'VV_VAH'
                          ? 'UP'
                          : activeScales === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-2 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeScales === 'VAH' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    VAH
                  </span>
                </div>

                {/* Bottom Label (OFF) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeScales === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* SWITCH 2: FP-MARKER (ATT_FPM / FPM / OFF) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (ATT/FPM) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeFpMarker === 'ATT_FPM' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    ATT/FPM
                  </span>
                </div>

                {/* Lever & Center FPM Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleFpMarkerClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('fpMarker')
                        ? `FP-MARKER: ${activeFpMarker}. Left-click steps up, Right-click steps down.`
                        : `FP-MARKER: ${activeFpMarker}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('fpMarker')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeFpMarker === 'ATT_FPM'
                          ? 'UP'
                          : activeFpMarker === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-2 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeFpMarker === 'FPM' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    FPM
                  </span>
                </div>

                {/* Bottom Label (OFF) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeFpMarker === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* SWITCH 3: DED DATA (DED_DATA / PFL / OFF) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (DED DATA) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeDedData === 'DED_DATA' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    DED
                    <br />
                    DATA
                  </span>
                </div>

                {/* Lever & Center PFL Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleDedDataClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('dedData')
                        ? `DED DATA: ${activeDedData}. Left-click steps up, Right-click steps down.`
                        : `DED DATA: ${activeDedData}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('dedData')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeDedData === 'DED_DATA'
                          ? 'UP'
                          : activeDedData === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-2 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeDedData === 'PFL' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    PFL
                  </span>
                </div>

                {/* Bottom Label (OFF) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeDedData === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* SWITCH 4: DEPR RET (STBY / PRI / OFF) - Asymmetric with Right-Aligned Labels */}
              <div className="flex flex-col items-center w-[68px]">
                {/* Top Descriptive Title: DEPR RET */}
                <div className="h-[22px] flex items-end justify-center">
                  <span className="text-[9px] pr-5 font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none text-zinc-300">
                    DEPR RET
                  </span>
                </div>

                {/* Lever & Right-Aligned Labels (STBY / PRI / OFF) */}
                <div className="relative flex items-center justify-start w-full my-1 pl-1">
                  <div
                    onMouseDown={handleDeprRetClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('deprRet')
                        ? `DEPR RET: ${activeDeprRet}. Left-click steps up, Right-click steps down.`
                        : `DEPR RET: ${activeDeprRet}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('deprRet')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeDeprRet === 'STBY'
                          ? 'UP'
                          : activeDeprRet === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  {/* Right-aligned text stack for STBY / PRI / OFF */}
                  <div className="flex flex-col justify-between h-[42px] pl-1.5 text-left select-none pointer-events-none">
                    <span
                      className={`text-[9px] font-black tracking-tight uppercase transition-colors leading-none ${
                        activeDeprRet === 'STBY' ? 'text-amber-400 font-extrabold' : 'text-zinc-300'
                      }`}
                    >
                      STBY
                    </span>
                    <span
                      className={`text-[9px] font-black tracking-tight uppercase transition-colors leading-none ${
                        activeDeprRet === 'PRI' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                      }`}
                    >
                      PRI
                    </span>
                    <span
                      className={`text-[9px] font-black tracking-tight uppercase transition-colors leading-none ${
                        activeDeprRet === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-300'
                      }`}
                    >
                      OFF
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------------------- */}
            {/* ROW 2: SPEED | ALT | BRIGHT | TEST                               */}
            {/* ---------------------------------------------------------------- */}
            <div className="grid grid-cols-4 gap-1 items-start justify-items-center pt-1">
              {/* SWITCH 5: SPEED (CAS / TAS / GND_SPD) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (CAS) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeSpeed === 'CAS' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    CAS
                  </span>
                </div>

                {/* Lever & Center TAS Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleSpeedClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('speed')
                        ? `SPEED: ${activeSpeed}. Left-click steps up, Right-click steps down.`
                        : `SPEED: ${activeSpeed}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('speed')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeSpeed === 'CAS'
                          ? 'UP'
                          : activeSpeed === 'GND_SPD'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-2 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeSpeed === 'TAS' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    TAS
                  </span>
                </div>

                {/* Bottom Label (GND SPD) */}
                <span
                  className={`text-[9px] font-black tracking-tight uppercase whitespace-nowrap transition-colors text-center select-none pointer-events-none ${
                    activeSpeed === 'GND_SPD' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  GND SPD
                </span>
              </div>

              {/* SWITCH 6: ALT (ALT_RADAR / BARO / OFF) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (ALT RADAR) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeAlt === 'ALT_RADAR' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    ALT
                    <br />
                    RADAR
                  </span>
                </div>

                {/* Lever & Center BARO Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleAltClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('alt')
                        ? `ALT: ${activeAlt}. Left-click steps up, Right-click steps down.`
                        : `ALT: ${activeAlt}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('alt')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeAlt === 'ALT_RADAR'
                          ? 'UP'
                          : activeAlt === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-3 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeAlt === 'BARO' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    BARO
                  </span>
                </div>

                {/* Bottom Label (OFF) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeAlt === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  OFF
                </span>
              </div>

              {/* SWITCH 7: BRIGHT (DAY / AUTO_BRT / NIGHT) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (DAY) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeBright === 'DAY' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    DAY
                  </span>
                </div>

                {/* Lever & Center AUTO BRT Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleBrightClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('bright')
                        ? `BRIGHT: ${activeBright}. Left-click steps up, Right-click steps down.`
                        : `BRIGHT: ${activeBright}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('bright')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeBright === 'DAY'
                          ? 'UP'
                          : activeBright === 'NIGHT'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <div className="absolute -right-3 flex flex-col items-center leading-none select-none pointer-events-none">
                    <span
                      className={`text-[9px] font-black tracking-tight uppercase transition-colors ${
                        activeBright === 'AUTO_BRT' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                      }`}
                    >
                      AUTO
                    </span>
                    <span
                      className={`text-[9px] font-black tracking-tight uppercase transition-colors ${
                        activeBright === 'AUTO_BRT' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                      }`}
                    >
                      BRT
                    </span>
                  </div>
                </div>

                {/* Bottom Label (NIGHT) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeBright === 'NIGHT' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  NIGHT
                </span>
              </div>

              {/* SWITCH 8: TEST (TEST_STEP / ON / OFF) */}
              <div className="flex flex-col items-center w-[60px]">
                {/* Top Label (TEST STEP) */}
                <div className="h-[22px] flex items-end justify-center">
                  <span
                    className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                      activeTest === 'TEST_STEP' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                    }`}
                  >
                    TEST
                    <br />
                    STEP
                  </span>
                </div>

                {/* Lever & Center ON Label */}
                <div className="relative flex items-center justify-center w-full my-1">
                  <div
                    onMouseDown={handleTestClick}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isSwitchAllowed('test')
                        ? `TEST: ${activeTest}. Left-click steps up, Right-click steps down.`
                        : `TEST: ${activeTest}`
                    }
                    className={`select-none ${
                      isSwitchAllowed('test')
                        ? 'cursor-pointer active:scale-95'
                        : 'cursor-default pointer-events-none'
                    }`}
                  >
                    <CockpitThreeWaySwitch
                      position={
                        activeTest === 'TEST_STEP'
                          ? 'UP'
                          : activeTest === 'OFF'
                          ? 'DOWN'
                          : 'CENTER'
                      }
                    />
                  </div>

                  <span
                    className={`absolute -right-1 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                      activeTest === 'ON' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                    }`}
                  >
                    ON
                  </span>
                </div>

                {/* Bottom Label (OFF) */}
                <span
                  className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeTest === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
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

