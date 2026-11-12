'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';

export type MainPwrPosition = 'OFF' | 'BATT' | 'MAIN_PWR';

export interface ElecPanelLights {
  flcsPmg?: boolean;
  mainGen?: boolean;
  stbyGen?: boolean;
  epuGen?: boolean;
  epuPmg?: boolean;
  toFlcs?: boolean;
  flcsRly?: boolean;
  fail?: boolean;
}

export interface ElecPowerPanelProps {
  switchPosition?: MainPwrPosition;
  onSwitchChange?: (position: MainPwrPosition) => void;
  onCautionResetClick?: () => void;
  lights?: ElecPanelLights;
  onLightClick?: (lightKey: keyof ElecPanelLights) => void;
  allowLightInteractivity?: boolean; // Hover and click on light buttons (default: false)
  allowSwitchClick?: boolean | { mainPwr?: boolean; cautionReset?: boolean }; // Global or per-switch toggle interactivity
  enabledSwitches?: { mainPwr?: boolean; cautionReset?: boolean }; // Per-switch enabled overrides
  skipBattOnForwardCycle?: boolean; // Require 1 click (skip BATT) or 2 clicks (default: false, meaning 2 clicks)
  className?: string;
}

export const ElecPowerPanel: React.FC<ElecPowerPanelProps> = ({
  switchPosition: controlledSwitchPosition,
  onSwitchChange,
  onCautionResetClick,
  lights: controlledLights,
  onLightClick,
  allowLightInteractivity = false,
  allowSwitchClick = true,
  enabledSwitches,
  skipBattOnForwardCycle = false,
  className = '',
}) => {
  const panelId = useId();

  // Helper to determine if a specific switch/button is allowed to be clicked
  const isSwitchAllowed = (key: 'mainPwr' | 'cautionReset'): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  // Internal switch state if uncontrolled
  const [internalSwitchPosition, setInternalSwitchPosition] = useState<MainPwrPosition>('OFF');
  const activeSwitchPosition =
    controlledSwitchPosition !== undefined ? controlledSwitchPosition : internalSwitchPosition;

  // Caution reset button press state for visual feedback
  const [cautionResetPressed, setCautionResetPressed] = useState<boolean>(false);

  // Default lights based on switch position
  const getDefaultLightsForPosition = (pos: MainPwrPosition): ElecPanelLights => {
    switch (pos) {
      case 'OFF':
        return {
          flcsPmg: false,
          mainGen: false,
          stbyGen: false,
          epuGen: false,
          epuPmg: false,
          toFlcs: false,
          flcsRly: false,
          fail: false,
        };
      case 'BATT':
      case 'MAIN_PWR':
        return {
          flcsPmg: false,
          mainGen: true,
          stbyGen: true,
          epuGen: false,
          epuPmg: false,
          toFlcs: false,
          flcsRly: true,
          fail: false,
        };
    }
  };

  // Internal overrides when light buttons are clicked
  const [internalLightOverrides, setInternalLightOverrides] = useState<ElecPanelLights>({});

  // Compute active lights: defaults for current position, overlaid with internal overrides, overlaid with controlledLights
  const defaultLights = getDefaultLightsForPosition(activeSwitchPosition);
  const activeLights: ElecPanelLights = {
    ...defaultLights,
    ...internalLightOverrides,
    ...(controlledLights || {}),
  };

  // Switch Position Setter
  const setSwitchPosition = (newPos: MainPwrPosition) => {
    if (!isSwitchAllowed('mainPwr')) return;
    if (activeSwitchPosition === newPos) return;
    Sound.playSwitch();
    if (onSwitchChange) {
      onSwitchChange(newPos);
    } else {
      setInternalSwitchPosition(newPos);
    }
  };

  // Forward cycle (Left click):
  // If skipBattOnForwardCycle is true: OFF -> MAIN_PWR (stops at MAIN_PWR)
  // If skipBattOnForwardCycle is false: OFF -> BATT -> MAIN_PWR (stops at MAIN_PWR)
  const handleForwardCycle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('mainPwr')) return;

    if (skipBattOnForwardCycle) {
      if (activeSwitchPosition === 'OFF') {
        setSwitchPosition('MAIN_PWR');
      }
    } else {
      if (activeSwitchPosition === 'OFF') {
        setSwitchPosition('BATT');
      } else if (activeSwitchPosition === 'BATT') {
        setSwitchPosition('MAIN_PWR');
      }
      // If already at MAIN_PWR, stop and do not loop back to OFF
    }
  };

  // Backward cycle (Right click / context menu):
  // If skipBattOnForwardCycle is true: MAIN_PWR -> OFF (stops at OFF)
  // If skipBattOnForwardCycle is false: MAIN_PWR -> BATT -> OFF (stops at OFF)
  const handleBackwardCycle = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('mainPwr')) return;

    if (skipBattOnForwardCycle) {
      if (activeSwitchPosition === 'MAIN_PWR') {
        setSwitchPosition('OFF');
      }
    } else {
      if (activeSwitchPosition === 'MAIN_PWR') {
        setSwitchPosition('BATT');
      } else if (activeSwitchPosition === 'BATT') {
        setSwitchPosition('OFF');
      }
      // If already at OFF, stop and do not loop back to MAIN_PWR
    }
  };

  // Caution Reset Handlers (Momentary Press)
  const handleCautionResetMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('cautionReset')) return;
    if ('button' in e && e.button !== 0) return;
    e.preventDefault();
    Sound.playClick();
    setCautionResetPressed(true);
    if (onCautionResetClick) onCautionResetClick();
  };

  const handleCautionResetMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!isSwitchAllowed('cautionReset')) return;
    if (e && 'button' in e && e.button !== 0) return;
    setCautionResetPressed(false);
  };

  // Handle Light Click
  const handleLightUnitClick = (key: keyof ElecPanelLights) => {
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
      {/* Authentic Avionics ELEC Panel Chassis - Fixed Width (265px tightened) */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-4 w-[265px] min-w-[265px] max-w-[265px] text-zinc-300 font-mono select-none"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Four Slotted Corner Aircraft DZUS Fasteners with clear clearance */}
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

        {/* Panel Content Layout with Stationary Vertical ELEC on Far Left */}
        <div className="flex items-stretch space-x-2 pt-1 pr-1.5">
          {/* Vertical ELEC Text on Far Left (Stationary) */}
          <div className="flex flex-col items-center justify-center pl-0.5 select-none w-5">
            <span className="text-[15px] font-black tracking-[0.5em] text-zinc-300 leading-[2.0] flex flex-col items-center">
              <span>E</span>
              <span>L</span>
              <span>E</span>
              <span>C</span>
            </span>
          </div>

          {/* Main Controls & Lights Area */}
          <div className="flex-1 flex flex-col">
            {/* Top Section: Switch (Stationary Left) + Caution Reset & Screw + 3 Square Lights */}
            <div className="flex justify-between items-start">
              {/* Left Column Area: Stationary MAIN PWR Switch and Right-Shifted CAUTION RESET */}
              <div className="flex flex-col justify-between h-[196px] flex-1 pr-2">
                {/* 1. Stationary MAIN PWR Switch Column */}
                <div className="flex flex-col items-center self-start w-[80px]">
                  {/* MAIN PWR Label (Top) */}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        setSwitchPosition('MAIN_PWR');
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={!isSwitchAllowed('mainPwr')}
                    className={`text-[11px] font-black tracking-wider uppercase transition-colors text-center whitespace-nowrap ${
                      isSwitchAllowed('mainPwr') ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      activeSwitchPosition === 'MAIN_PWR'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200 hover:text-white'
                    }`}
                  >
                    MAIN PWR
                  </button>

                  {/* Switch & BATT row */}
                  <div className="relative flex items-center justify-center w-full my-0.5">
                    {/* Lever Switch with Left Click (forward) and Right Click (backward) */}
                    <div
                      onMouseDown={(e) => {
                        if (e.button === 0) handleForwardCycle(e);
                        else if (e.button === 2) handleBackwardCycle(e);
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      title={
                        isSwitchAllowed('mainPwr')
                          ? `MAIN PWR Switch: ${activeSwitchPosition}. Left-click to step forward, Right-click to step back.`
                          : `MAIN PWR Switch: ${activeSwitchPosition}`
                      }
                      className={isSwitchAllowed('mainPwr') ? 'cursor-pointer select-none active:scale-95' : 'cursor-default select-none'}
                    >
                      <ThreeWayMpoLever position={activeSwitchPosition} />
                    </div>

                    {/* BATT Label & Upper Panel Screw */}
                    <div className="absolute -right-7 flex items-center space-x-1">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          if (e.button === 0) {
                            e.preventDefault();
                            setSwitchPosition('BATT');
                          }
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        disabled={!isSwitchAllowed('mainPwr')}
                        className={`text-[11px] font-black tracking-wider uppercase transition-colors ${
                          isSwitchAllowed('mainPwr') ? 'cursor-pointer' : 'cursor-default'
                        } ${
                          activeSwitchPosition === 'BATT'
                            ? 'text-amber-400 font-extrabold'
                            : 'text-zinc-200 hover:text-white'
                        }`}
                      >
                        BATT
                      </button>
                      <div className="w-2.5 h-2.5 rounded-full bg-[#18191c] border border-black shadow-inner flex items-center justify-center pointer-events-none">
                        <div className="w-1.5 h-[1px] bg-zinc-600 rotate-90" />
                        <div className="w-[1px] h-1.5 bg-zinc-600 absolute" />
                      </div>
                    </div>
                  </div>

                  {/* OFF Label (Bottom) */}
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        setSwitchPosition('OFF');
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={!isSwitchAllowed('mainPwr')}
                    className={`text-[11px] font-black tracking-wider uppercase transition-colors text-center ${
                      isSwitchAllowed('mainPwr') ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      activeSwitchPosition === 'OFF'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200 hover:text-white'
                    }`}
                  >
                    OFF
                  </button>
                </div>

                {/* 2. Middle Row: Decorative Dark Phillips Screw (Bottom-right of MAIN PWR, left of CAUTION RESET) */}
                <div className="relative w-full flex items-center justify-start pl-14 -my-1 pointer-events-none">
                  {/* Decorative Dark Phillips Screw */}
                  <div
                    className="w-3 h-3 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center"
                    title="Panel Fastener Screw"
                  >
                    {/* Phillips Cross Recess */}
                    <div className="w-1.5 h-[1px] bg-zinc-700/80" />
                    <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
                  </div>
                </div>

                {/* 3. CAUTION RESET (Shifted closer to lights, bottom inline with EPU light) */}
                <div className="flex flex-col items-center self-end relative">
                  {/* Floating 5V incandescent / connector symbol (+) */}
                  <div className="absolute -left-3 top-0.5 text-zinc-500 font-bold text-[11px] leading-none pointer-events-none">
                    +
                  </div>

                  {/* CAUTION RESET Text (Centered) */}
                  <div className="flex flex-col items-center text-center mb-1.5">
                    <span className="text-[11px] font-black tracking-wider text-zinc-200 leading-tight uppercase">
                      CAUTION
                    </span>
                    <span className="text-[11px] font-black tracking-wider text-zinc-200 leading-tight uppercase">
                      RESET
                    </span>
                  </div>

                  {/* White Circle Button with Tactile Press Mechanics */}
                  <button
                    type="button"
                    onMouseDown={handleCautionResetMouseDown}
                    onMouseUp={handleCautionResetMouseUp}
                    onMouseLeave={handleCautionResetMouseUp}
                    onTouchStart={handleCautionResetMouseDown}
                    onTouchEnd={handleCautionResetMouseUp}
                    onTouchCancel={handleCautionResetMouseUp}
                    onContextMenu={(e) => e.preventDefault()}
                    disabled={!isSwitchAllowed('cautionReset')}
                    title="CAUTION RESET: Press to reset cockpit caution indicators"
                    className={`w-8 h-8 rounded-full border border-zinc-400 select-none flex items-center justify-center transition-transform duration-75 ${
                      isSwitchAllowed('cautionReset') ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      cautionResetPressed
                        ? 'bg-[#c8cacf] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] scale-95'
                        : 'bg-[#E5E7EB] shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:brightness-105 active:scale-95'
                    }`}
                  />
                </div>
              </div>

              {/* Right Column: 3 Strictly Square Light Units (58px x 58px) */}
              <div className="flex flex-col space-y-2">
                {/* Square 1: FLCS PMG (top) / MAIN GEN (bottom) */}
                <StrictSquareDualLight
                  topLabel="FLCS PMG"
                  topIsOn={!!activeLights.flcsPmg}
                  onTopClick={() => handleLightUnitClick('flcsPmg')}
                  bottomLabel="MAIN GEN"
                  bottomIsOn={!!activeLights.mainGen}
                  onBottomClick={() => handleLightUnitClick('mainGen')}
                  allowInteractivity={allowLightInteractivity}
                />

                {/* Square 2: STBY GEN (top) / Empty (bottom) */}
                <StrictSquareDualLight
                  topLabel="STBY GEN"
                  topIsOn={!!activeLights.stbyGen}
                  onTopClick={() => handleLightUnitClick('stbyGen')}
                  bottomLabel=""
                  bottomIsOn={false}
                  allowInteractivity={allowLightInteractivity}
                />

                {/* Square 3: EPU GEN (top) / EPU PMG (bottom) */}
                <StrictSquareDualLight
                  topLabel="EPU GEN"
                  topIsOn={!!activeLights.epuGen}
                  onTopClick={() => handleLightUnitClick('epuGen')}
                  bottomLabel="EPU PMG"
                  bottomIsOn={!!activeLights.epuPmg}
                  onBottomClick={() => handleLightUnitClick('epuPmg')}
                  allowInteractivity={allowLightInteractivity}
                />
              </div>
            </div>

            {/* Bottom Section: ACFT BATT Divider & 2 Square Lights Aligned to Right */}
            <div className="flex flex-col items-end mt-3">
              {/* ACFT BATT Divider Text */}
              <div className="flex items-center justify-center space-x-1 mb-1.5 w-[122px]">
                <div className="h-[1px] bg-zinc-600 flex-1" />
                <span className="text-[8.5px] font-black tracking-wider text-zinc-400 uppercase whitespace-nowrap">
                  ACFT BATT
                </span>
                <div className="h-[1px] bg-zinc-600 flex-1" />
              </div>

              {/* Two Square Lights (58px x 58px each) side by side aligned to right */}
              <div className="flex space-x-1.5">
                {/* Square 4: TO FLCS (top) / FLCS RLY (bottom) */}
                <StrictSquareDualLight
                  topLabel="TO FLCS"
                  topIsOn={!!activeLights.toFlcs}
                  onTopClick={() => handleLightUnitClick('toFlcs')}
                  bottomLabel="FLCS RLY"
                  bottomIsOn={!!activeLights.flcsRly}
                  onBottomClick={() => handleLightUnitClick('flcsRly')}
                  allowInteractivity={allowLightInteractivity}
                />

                {/* Square 5: FAIL (top) / Empty (bottom) */}
                <StrictSquareDualLight
                  topLabel="FAIL"
                  topIsOn={!!activeLights.fail}
                  onTopClick={() => handleLightUnitClick('fail')}
                  bottomLabel=""
                  bottomIsOn={false}
                  allowInteractivity={allowLightInteractivity}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Standard 3-Position Vertical Lever Switch Component (MAIN PWR)            */
/* -------------------------------------------------------------------------- */

interface ThreeWayMpoLeverProps {
  position: MainPwrPosition;
}

const ThreeWayMpoLever: React.FC<ThreeWayMpoLeverProps> = ({ position }) => {
  const shaftTransform =
    position === 'MAIN_PWR'
      ? 'translate(-50%, -46px) scaleY(1.05)'
      : position === 'OFF'
      ? 'translate(-50%, 4px) scaleY(1.05)'
      : 'translate(-50%, -24px) scaleY(0.7)';

  const ballTransform =
    position === 'MAIN_PWR'
      ? 'translate(-50%, -44px)'
      : position === 'OFF'
      ? 'translate(-50%, 14px)'
      : 'translate(-50%, -16px)';

  const ballShadow =
    position === 'MAIN_PWR'
      ? '0 12px 14px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
      : position === 'OFF'
      ? '0 -12px 14px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)'
      : '0 4px 10px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center select-none will-change-transform">
      {/* Outer socket bezel ring with exact LeverSwitch radial gradient styling */}
      <div
        className="w-11 h-11 rounded-full border border-black/40 shadow-inner"
        style={{
          backgroundImage: `
            radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
            radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
            radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 43% 56%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 55% 57%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 50% 60%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgb(221, 221, 221) 0 41%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170) 0 50%)
          `,
          boxShadow: '0 4px 8px rgba(0,0,0,0.7)',
        }}
      />

      {/* Lever Parts (Shaft & Ball) with smooth hardware-accelerated transitions */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Lever Shaft */}
        <div
          className="absolute left-1/2 top-1/2 w-3.5 h-10 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 6px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />

        {/* Lever Ball / Bat Handle Tip */}
        <div
          className="absolute left-1/2 top-1/2 w-5.5 h-5.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
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
/* Strictly Square Dual Annunciator Light (58px x 58px, Black Background)    */
/* -------------------------------------------------------------------------- */

interface StrictSquareDualLightProps {
  topLabel: string;
  topIsOn: boolean;
  onTopClick?: () => void;
  bottomLabel: string;
  bottomIsOn: boolean;
  onBottomClick?: () => void;
  allowInteractivity?: boolean;
}

const StrictSquareDualLight: React.FC<StrictSquareDualLightProps> = ({
  topLabel,
  topIsOn,
  onTopClick,
  bottomLabel,
  bottomIsOn,
  onBottomClick,
  allowInteractivity = false,
}) => {
  return (
    <div className="w-[58px] h-[58px] min-w-[58px] min-h-[58px] max-w-[58px] max-h-[58px] bg-[#0c0d10] border border-[#262830] rounded flex flex-col shadow-inner overflow-hidden select-none">
      {/* Top Half */}
      <div
        onMouseDown={allowInteractivity && topLabel ? onTopClick : undefined}
        title={topLabel ? `${topLabel}: ${topIsOn ? 'ON' : 'OFF'}` : undefined}
        className={`flex-1 flex items-center justify-center border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
          allowInteractivity && topLabel ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
        {topLabel && (
          <span
            className={`text-[8.5px] font-black font-mono tracking-tight leading-none uppercase transition-[color,text-shadow] duration-100 ${
              topIsOn ? 'text-[#FFB347]' : 'text-[#352a1a]'
            }`}
            style={{
              textShadow: topIsOn
                ? '0 0 3px #FFA726, 0 0 8px rgba(255, 150, 0, 0.9), 0 0 16px rgba(255, 120, 0, 0.6)'
                : 'none',
            }}
          >
            {topLabel}
          </span>
        )}
      </div>

      {/* Bottom Half */}
      <div
        onMouseDown={allowInteractivity && bottomLabel ? onBottomClick : undefined}
        title={bottomLabel ? `${bottomLabel}: ${bottomIsOn ? 'ON' : 'OFF'}` : undefined}
        className={`flex-1 flex items-center justify-center bg-[#0c0d10] select-none ${
          allowInteractivity && bottomLabel ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
        {bottomLabel && (
          <span
            className={`text-[8.5px] font-black font-mono tracking-tight leading-none uppercase transition-[color,text-shadow] duration-100 ${
              bottomIsOn ? 'text-[#FFB347]' : 'text-[#352a1a]'
            }`}
            style={{
              textShadow: bottomIsOn
                ? '0 0 3px #FFA726, 0 0 8px rgba(255, 150, 0, 0.9), 0 0 16px rgba(255, 120, 0, 0.6)'
                : 'none',
            }}
          >
            {bottomLabel}
          </span>
        )}
      </div>
    </div>
  );
};
