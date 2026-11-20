'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';
import {
  CockpitTwoWaySwitch,
  CockpitThreeWaySwitch,
} from './CockpitSwitch';

export type LeftHdptPosition = 'OFF' | 'ON';
export type RightHdptPosition = 'OFF' | 'ON';
export type FcrPosition = 'OFF' | 'FCR';
export type RdrAltPosition = 'OFF' | 'STBY' | 'RDR_ALT';

export interface SnsrPwrSwitches {
  leftHdpt?: LeftHdptPosition;
  rightHdpt?: RightHdptPosition;
  fcr?: FcrPosition;
  rdrAlt?: RdrAltPosition;
}

export interface SnsrPwrPanelProps {
  switches?: SnsrPwrSwitches;
  onSwitchChange?: (switchKey: keyof SnsrPwrSwitches, value: any) => void;
  // Convenience individual handlers / controlled values
  leftHdpt?: LeftHdptPosition;
  onLeftHdptChange?: (pos: LeftHdptPosition) => void;
  rightHdpt?: RightHdptPosition;
  onRightHdptChange?: (pos: RightHdptPosition) => void;
  fcr?: FcrPosition;
  onFcrChange?: (pos: FcrPosition) => void;
  rdrAlt?: RdrAltPosition;
  onRdrAltChange?: (pos: RdrAltPosition) => void;
  // Interactivity lockout controls
  allowSwitchClick?: boolean | Partial<Record<keyof SnsrPwrSwitches, boolean>>;
  enabledSwitches?: Partial<Record<keyof SnsrPwrSwitches, boolean>>;
  className?: string;
}

export const SnsrPwrPanel: React.FC<SnsrPwrPanelProps> = ({
  switches: controlledSwitches,
  onSwitchChange,
  leftHdpt: controlledLeftHdpt,
  onLeftHdptChange,
  rightHdpt: controlledRightHdpt,
  onRightHdptChange,
  fcr: controlledFcr,
  onFcrChange,
  rdrAlt: controlledRdrAlt,
  onRdrAltChange,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  // Internal uncontrolled state
  const [internalSwitches, setInternalSwitches] = useState<Required<SnsrPwrSwitches>>({
    leftHdpt: 'OFF',
    rightHdpt: 'OFF',
    fcr: 'OFF',
    rdrAlt: 'OFF',
  });

  // Resolve active states (prioritize direct props, then group switches prop, then internal state)
  const activeLeftHdpt: LeftHdptPosition =
    controlledLeftHdpt !== undefined
      ? controlledLeftHdpt
      : controlledSwitches?.leftHdpt !== undefined
      ? controlledSwitches.leftHdpt
      : internalSwitches.leftHdpt;

  const activeRightHdpt: RightHdptPosition =
    controlledRightHdpt !== undefined
      ? controlledRightHdpt
      : controlledSwitches?.rightHdpt !== undefined
      ? controlledSwitches.rightHdpt
      : internalSwitches.rightHdpt;

  const activeFcr: FcrPosition =
    controlledFcr !== undefined
      ? controlledFcr
      : controlledSwitches?.fcr !== undefined
      ? controlledSwitches.fcr
      : internalSwitches.fcr;

  const activeRdrAlt: RdrAltPosition =
    controlledRdrAlt !== undefined
      ? controlledRdrAlt
      : controlledSwitches?.rdrAlt !== undefined
      ? controlledSwitches.rdrAlt
      : internalSwitches.rdrAlt;

  // Interactivity helper: returns true only if input is allowed
  const isSwitchAllowed = (key: keyof SnsrPwrSwitches): boolean => {
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
  const updateSwitch = <K extends keyof SnsrPwrSwitches>(
    key: K,
    newVal: Required<SnsrPwrSwitches>[K],
    individualCallback?: (val: any) => void
  ) => {
    if (!isSwitchAllowed(key)) return;

    // Check if value actually changed
    const currentVal =
      key === 'leftHdpt'
        ? activeLeftHdpt
        : key === 'rightHdpt'
        ? activeRightHdpt
        : key === 'fcr'
        ? activeFcr
        : activeRdrAlt;

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
  /* Left Click (Forward / Up) & Right Click (Backward / Down) Handlers         */
  /* -------------------------------------------------------------------------- */

  // Switch 1: LEFT HDPT (OFF -> ON, no cycle back)
  const handleLeftHdptClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('leftHdpt')) return;
    if (e.button === 0) {
      // Left click = UP (ON)
      if (activeLeftHdpt === 'OFF') {
        updateSwitch('leftHdpt', 'ON', onLeftHdptChange);
      }
    } else if (e.button === 2) {
      // Right click = DOWN (OFF)
      if (activeLeftHdpt === 'ON') {
        updateSwitch('leftHdpt', 'OFF', onLeftHdptChange);
      }
    }
  };

  // Switch 2: RIGHT HDPT (OFF -> ON, no cycle back)
  const handleRightHdptClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('rightHdpt')) return;
    if (e.button === 0) {
      // Left click = UP (ON)
      if (activeRightHdpt === 'OFF') {
        updateSwitch('rightHdpt', 'ON', onRightHdptChange);
      }
    } else if (e.button === 2) {
      // Right click = DOWN (OFF)
      if (activeRightHdpt === 'ON') {
        updateSwitch('rightHdpt', 'OFF', onRightHdptChange);
      }
    }
  };

  // Switch 3: FCR (OFF -> FCR, no cycle back)
  const handleFcrClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('fcr')) return;
    if (e.button === 0) {
      // Left click = UP (FCR)
      if (activeFcr === 'OFF') {
        updateSwitch('fcr', 'FCR', onFcrChange);
      }
    } else if (e.button === 2) {
      // Right click = DOWN (OFF)
      if (activeFcr === 'FCR') {
        updateSwitch('fcr', 'OFF', onFcrChange);
      }
    }
  };

  // Switch 4: RDR ALT (OFF -> STBY -> RDR_ALT, no cycle back)
  const handleRdrAltClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isSwitchAllowed('rdrAlt')) return;
    if (e.button === 0) {
      // Left click = UP (OFF -> STBY -> RDR_ALT)
      if (activeRdrAlt === 'OFF') {
        updateSwitch('rdrAlt', 'STBY', onRdrAltChange);
      } else if (activeRdrAlt === 'STBY') {
        updateSwitch('rdrAlt', 'RDR_ALT', onRdrAltChange);
      }
    } else if (e.button === 2) {
      // Right click = DOWN (RDR_ALT -> STBY -> OFF)
      if (activeRdrAlt === 'RDR_ALT') {
        updateSwitch('rdrAlt', 'STBY', onRdrAltChange);
      } else if (activeRdrAlt === 'STBY') {
        updateSwitch('rdrAlt', 'OFF', onRdrAltChange);
      }
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics SNSR PWR Panel Chassis - Fixed Width (330px) */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-4 w-[330px] min-w-[330px] max-w-[330px] text-zinc-300 font-mono select-none"
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

        {/* Panel Content Layout: SNSR PWR text on the left, 4 switches on the right (NO SEPARATOR) */}
        <div className="flex items-center space-x-3 pt-0.5">
          {/* Vertical SNSR and PWR Text Columns Side-by-Side on Far Left */}
          <div className="flex items-center justify-center space-x-1 pl-1 select-none">
            {/* Column 1: SNSR */}
            <div className="flex flex-col items-center justify-center text-[12px] font-black tracking-[0.2em] text-zinc-300 leading-[1.35]">
              <span>S</span>
              <span>N</span>
              <span>S</span>
              <span>R</span>
            </div>

            {/* Column 2: PWR (Vertically Centered to SNSR) */}
            <div className="flex flex-col items-center justify-center text-[12px] font-black tracking-[0.2em] text-zinc-300 leading-[1.35]">
              <span>P</span>
              <span>W</span>
              <span>R</span>
            </div>
          </div>

          {/* 4 Switches Side by Side in Horizontal Grid */}
          <div className="flex-1 grid grid-cols-4 gap-1.5 items-start justify-items-center">
            {/* 1. LEFT HDPT SWITCH COLUMN */}
            <div className="flex flex-col items-center w-[58px]">
              {/* Top Label (LEFT HDPT) */}
              <div className="h-[22px] flex items-end justify-center">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                    activeLeftHdpt === 'ON' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  LEFT
                  <br />
                  HDPT
                </span>
              </div>

              {/* Switch Toggle */}
              <div
                onMouseDown={handleLeftHdptClick}
                onContextMenu={(e) => e.preventDefault()}
                title={
                  isSwitchAllowed('leftHdpt')
                    ? `LEFT HDPT: ${activeLeftHdpt}. Left-click for ON, Right-click for OFF.`
                    : `LEFT HDPT: ${activeLeftHdpt}`
                }
                className={`my-1 select-none ${
                  isSwitchAllowed('leftHdpt')
                    ? 'cursor-pointer active:scale-95'
                    : 'cursor-default pointer-events-none'
                }`}
              >
                <CockpitTwoWaySwitch isUp={activeLeftHdpt === 'ON'} />
              </div>

              {/* Bottom Label (OFF) */}
              <span
                className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                  activeLeftHdpt === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                }`}
              >
                OFF
              </span>
            </div>

            {/* 2. RIGHT HDPT SWITCH COLUMN */}
            <div className="flex flex-col items-center w-[58px]">
              {/* Top Label (RIGHT HDPT) */}
              <div className="h-[22px] flex items-end justify-center">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                    activeRightHdpt === 'ON' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  RIGHT
                  <br />
                  HDPT
                </span>
              </div>

              {/* Switch Toggle */}
              <div
                onMouseDown={handleRightHdptClick}
                onContextMenu={(e) => e.preventDefault()}
                title={
                  isSwitchAllowed('rightHdpt')
                    ? `RIGHT HDPT: ${activeRightHdpt}. Left-click for ON, Right-click for OFF.`
                    : `RIGHT HDPT: ${activeRightHdpt}`
                }
                className={`my-1 select-none ${
                  isSwitchAllowed('rightHdpt')
                    ? 'cursor-pointer active:scale-95'
                    : 'cursor-default pointer-events-none'
                }`}
              >
                <CockpitTwoWaySwitch isUp={activeRightHdpt === 'ON'} />
              </div>

              {/* Bottom Label (OFF) */}
              <span
                className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                  activeRightHdpt === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                }`}
              >
                OFF
              </span>
            </div>

            {/* 3. FCR SWITCH COLUMN */}
            <div className="flex flex-col items-center w-[58px]">
              {/* Top Label (FCR) */}
              <div className="h-[22px] flex items-end justify-center">
                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                    activeFcr === 'FCR' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  FCR
                </span>
              </div>

              {/* Switch Toggle */}
              <div
                onMouseDown={handleFcrClick}
                onContextMenu={(e) => e.preventDefault()}
                title={
                  isSwitchAllowed('fcr')
                    ? `FCR: ${activeFcr}. Left-click for FCR, Right-click for OFF.`
                    : `FCR: ${activeFcr}`
                }
                className={`my-1 select-none ${
                  isSwitchAllowed('fcr')
                    ? 'cursor-pointer active:scale-95'
                    : 'cursor-default pointer-events-none'
                }`}
              >
                <CockpitTwoWaySwitch isUp={activeFcr === 'FCR'} />
              </div>

              {/* Bottom Label (OFF) */}
              <span
                className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                  activeFcr === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                }`}
              >
                OFF
              </span>
            </div>

            {/* 4. RDR ALT SWITCH COLUMN (3-WAY) */}
            <div className="flex flex-col items-center w-[58px] relative">
              {/* Top Label (RDR ALT) */}
              <div className="h-[22px] flex items-end justify-center">
                <span
                  className={`text-[9px] font-black tracking-tight uppercase leading-tight text-center select-none pointer-events-none transition-colors ${
                    activeRdrAlt === 'RDR_ALT' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                  }`}
                >
                  RDR
                  <br />
                  ALT
                </span>
              </div>

              {/* Center STBY Position Label & Toggle */}
              <div className="relative flex items-center justify-center w-full my-1">
                <div
                  onMouseDown={handleRdrAltClick}
                  onContextMenu={(e) => e.preventDefault()}
                  title={
                    isSwitchAllowed('rdrAlt')
                      ? `RDR ALT: ${activeRdrAlt}. Left-click steps up, Right-click steps down.`
                      : `RDR ALT: ${activeRdrAlt}`
                  }
                  className={`select-none ${
                    isSwitchAllowed('rdrAlt')
                      ? 'cursor-pointer active:scale-95'
                      : 'cursor-default pointer-events-none'
                  }`}
                >
                  <CockpitThreeWaySwitch
                    position={
                      activeRdrAlt === 'RDR_ALT'
                        ? 'UP'
                        : activeRdrAlt === 'OFF'
                        ? 'DOWN'
                        : 'CENTER'
                    }
                  />
                </div>

                {/* Side STBY indicator label */}
                <span
                  className={`absolute -right-2.5 text-[9px] font-black tracking-tight uppercase transition-colors select-none pointer-events-none ${
                    activeRdrAlt === 'STBY' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                  }`}
                >
                  STBY
                </span>
              </div>

              {/* Bottom Label (OFF) */}
              <span
                className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                  activeRdrAlt === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-200'
                }`}
              >
                OFF
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

