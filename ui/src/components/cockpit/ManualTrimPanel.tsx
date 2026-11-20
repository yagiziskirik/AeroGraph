'use client';

import React, { useState, useId, useRef, useEffect, useCallback, useMemo } from 'react';
import { Sound } from '../../services/sound';
import { CockpitTwoWaySwitch } from './CockpitSwitch';

export interface ManualTrimValues {
  rollTrim?: number; // -3.0 (L WING DN) to +3.0 (R WING DN), neutral: 0.0
  pitchTrim?: number; // -3.0 (NOSE UP) to +3.0 (NOSE DN), neutral: 0.0
  yawTrim?: number; // -5.0 (L) to +5.0 (R), neutral: 0.0
  trimDisc?: boolean; // true = NORM (up), false = DISC (down)
}

export interface ManualTrimPanelProps {
  values?: ManualTrimValues;
  onValueChange?: (key: keyof ManualTrimValues, value: number | boolean) => void;
  allowSwitchClick?: boolean | Partial<Record<keyof ManualTrimValues, boolean>>; // Global or per-control interactivity
  enabledSwitches?: Partial<Record<keyof ManualTrimValues, boolean>>; // Per-control enabled overrides
  className?: string;
}

export const ManualTrimPanel: React.FC<ManualTrimPanelProps> = ({
  values: controlledValues,
  onValueChange,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  // Internal trim states if uncontrolled (default all centered at 0, switch in NORM)
  const [internalValues, setInternalValues] = useState<ManualTrimValues>({
    rollTrim: 0.0,
    pitchTrim: 0.0,
    yawTrim: 0.0,
    trimDisc: true, // NORM (up)
  });

  const activeValues = useMemo<Required<ManualTrimValues>>(
    () => ({
      rollTrim: controlledValues?.rollTrim !== undefined ? controlledValues.rollTrim : internalValues.rollTrim ?? 0.0,
      pitchTrim: controlledValues?.pitchTrim !== undefined ? controlledValues.pitchTrim : internalValues.pitchTrim ?? 0.0,
      yawTrim: controlledValues?.yawTrim !== undefined ? controlledValues.yawTrim : internalValues.yawTrim ?? 0.0,
      trimDisc: controlledValues?.trimDisc !== undefined ? controlledValues.trimDisc : internalValues.trimDisc ?? true,
    }),
    [controlledValues, internalValues]
  );

  const activeValuesRef = useRef(activeValues);
  useEffect(() => {
    activeValuesRef.current = activeValues;
  }, [activeValues]);

  // Helper to determine if a specific control is allowed to be clicked
  const isControlAllowed = useCallback(
    (key: keyof ManualTrimValues): boolean => {
      if (typeof allowSwitchClick === 'boolean') return allowSwitchClick;
      if (typeof allowSwitchClick === 'object' && allowSwitchClick !== null) {
        return !!allowSwitchClick[key];
      }
      if (enabledSwitches && enabledSwitches[key] !== undefined) {
        return !!enabledSwitches[key];
      }
      return true;
    },
    [allowSwitchClick, enabledSwitches]
  );

  // Generic value updater
  const updateValue = useCallback(
    (key: keyof ManualTrimValues, newVal: number | boolean) => {
      if (!isControlAllowed(key)) return;
      if (onValueChange) {
        onValueChange(key, newVal);
      } else {
        setInternalValues((prev) => ({
          ...prev,
          [key]: newVal,
        }));
      }
    },
    [isControlAllowed, onValueChange]
  );

  // Toggle switch setter with sound
  const setTrimDisc = (val: boolean) => {
    if (!isControlAllowed('trimDisc')) return;
    if (activeValues.trimDisc === val) return;
    Sound.playSwitch();
    updateValue('trimDisc', val);
  };

  // TRIM / AP DISC Switch Handlers: Left-click = UP (NORM), Right-click = DOWN (DISC)
  const handleTrimDiscMouseDown = (e: React.MouseEvent) => {
    if (!isControlAllowed('trimDisc')) return;
    if (e.button === 0) {
      e.preventDefault();
      setTrimDisc(true);
    } else if (e.button === 2) {
      e.preventDefault();
      setTrimDisc(false);
    }
  };

  // Continuous Hold-to-Slew Management for Linear Trims
  const slewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const slewInitialDelayRef = useRef<NodeJS.Timeout | null>(null);
  const activeControlRef = useRef<keyof ManualTrimValues | null>(null);
  const activeDirectionRef = useRef<number>(0); // -1 or +1

  const stopSlew = useCallback(() => {
    if (slewInitialDelayRef.current) {
      clearTimeout(slewInitialDelayRef.current);
      slewInitialDelayRef.current = null;
    }
    if (slewIntervalRef.current) {
      clearInterval(slewIntervalRef.current);
      slewIntervalRef.current = null;
    }
    activeControlRef.current = null;
    activeDirectionRef.current = 0;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSlew();
    };
  }, [stopSlew]);

  // Slew a specific linear trim axis
  const applyTrimStep = useCallback(
    (key: 'rollTrim' | 'pitchTrim' | 'yawTrim', dir: number, stepSize: number = 0.1) => {
      if (!isControlAllowed(key)) return;
      const limits = {
        rollTrim: { min: -3.0, max: 3.0 },
        pitchTrim: { min: -3.0, max: 3.0 },
        yawTrim: { min: -5.0, max: 5.0 },
      };
      const limit = limits[key];
      const current = activeValuesRef.current[key];
      const nextRaw = current + dir * stepSize;
      const clamped = Math.min(limit.max, Math.max(limit.min, Math.round(nextRaw * 100) / 100));

      if (clamped !== current) {
        updateValue(key, clamped);
      }
    },
    [isControlAllowed, updateValue]
  );

  // Start continuous hold on mouse down
  const startSlew = (
    e: React.MouseEvent,
    key: 'rollTrim' | 'pitchTrim' | 'yawTrim',
    dir: number // -1 or +1
  ) => {
    e.preventDefault();
    if (!isControlAllowed(key)) return;
    stopSlew();

    // Immediate initial step with sound
    Sound.playClick();
    applyTrimStep(key, dir, 0.1);

    activeControlRef.current = key;
    activeDirectionRef.current = dir;

    // After 220ms hold, slew continuously at 35ms intervals
    slewInitialDelayRef.current = setTimeout(() => {
      slewIntervalRef.current = setInterval(() => {
        applyTrimStep(key, dir, 0.08);
      }, 35);
    }, 220);
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics MANUAL TRIM Panel Chassis - Matching FLT CONTROL Width (270px) */}
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

        {/* Top Centered Decorative Dark Phillips Screw */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Bottom Centered Decorative Dark Phillips Screw */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Center Panel Alignment Cross (+) */}
        <div className="absolute top-[138px] left-[142px] -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-zinc-600 font-bold text-[11px] leading-none opacity-50">+</span>
        </div>

        {/* Panel Content Layout with Vertical MANUAL TRIM on Left */}
        <div className="flex items-stretch space-x-2 pt-1 pr-1">
          {/* Vertical MANUAL TRIM Text on Far Left */}
          <div className="flex flex-col items-center justify-center pl-0.5 select-none w-5">
            <span className="text-[12px] font-black tracking-[0.35em] text-zinc-300 leading-[1.6] flex flex-col items-center">
              <span>M</span>
              <span>A</span>
              <span>N</span>
              <span>U</span>
              <span>A</span>
              <span>L</span>
              <span className="h-2" />
              <span>T</span>
              <span>R</span>
              <span>I</span>
              <span>M</span>
            </span>
          </div>

          {/* Main Controls Matrix: Seamless Layout */}
          <div className="flex-1 flex flex-col justify-between h-[280px]">
            {/* ROW 1: ROLL TRIM (Left) | TRIM / AP DISC Switch (Right) */}
            <div className="grid grid-cols-2 gap-2 h-[134px]">
              {/* Top-Left: ROLL TRIM */}
              <div className="flex flex-col items-center justify-between pr-1">
                {/* Header: — ROLL TRIM — (On ONE line with balanced lines) */}
                <div className="flex items-center justify-center space-x-1.5 w-full">
                  <div className="w-4 h-[1px] bg-zinc-600/70" />
                  <span className="text-[8.5px] font-black tracking-wider uppercase text-zinc-300 whitespace-nowrap">
                    ROLL TRIM
                  </span>
                  <div className="w-4 h-[1px] bg-zinc-600/70" />
                </div>

                {/* Sub-layout: Vertical White Slider on Left, 180° Semi-Circle Dial on Right */}
                <div className="flex items-center justify-between w-full px-1 my-auto">
                  {/* Left Column: L WING DN, Vertical Slider, R WING DN */}
                  <div className="flex flex-col items-center w-[58px]">
                    <span className="text-[7.5px] font-black tracking-tight uppercase text-center leading-none text-zinc-300 mb-1 select-none">
                      L WING DN
                    </span>

                    {/* Vertical Ribbed White Slider Button */}
                    <div
                      onMouseDown={(e) => {
                        if (e.button === 0) startSlew(e, 'rollTrim', -1); // Left click = L WING DN (up)
                        else if (e.button === 2) startSlew(e, 'rollTrim', 1); // Right click = R WING DN (down)
                      }}
                      onMouseUp={stopSlew}
                      onMouseLeave={stopSlew}
                      onContextMenu={(e) => e.preventDefault()}
                      title={`ROLL TRIM: ${activeValues.rollTrim.toFixed(1)} (Left-click & hold for L WING DN, Right-click & hold for R WING DN)`}
                      className={`relative w-5 h-11 rounded bg-gradient-to-b from-zinc-200 via-white to-zinc-300 border border-zinc-400 shadow-md flex flex-col justify-around py-1 px-0.5 my-0.5 select-none ${
                        isControlAllowed('rollTrim') ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed pointer-events-none opacity-80'
                      }`}
                      style={{
                        boxShadow:
                          'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 5px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(0,0,0,0.3)',
                      }}
                    >
                      {/* Ribbed ridges */}
                      <div className="w-full h-[1.5px] bg-zinc-400 shadow-inner rounded-full" />
                      <div className="w-full h-[1.5px] bg-zinc-400 shadow-inner rounded-full" />
                      <div className="w-full h-[1.5px] bg-zinc-400 shadow-inner rounded-full" />
                      <div className="w-full h-[1.5px] bg-zinc-400 shadow-inner rounded-full" />
                      <div className="w-full h-[1.5px] bg-zinc-400 shadow-inner rounded-full" />
                    </div>

                    <span className="text-[7.5px] font-black tracking-tight uppercase text-center leading-none text-zinc-300 mt-1 select-none">
                      R WING DN
                    </span>
                  </div>

                  {/* Vertical Up/Down Guide Arrow */}
                  <div className="flex flex-col items-center justify-center text-zinc-500 font-bold text-[9px] leading-none select-none px-0.5">
                    <span>▲</span>
                    <span className="h-4 w-[1px] bg-zinc-600 my-0.5" />
                    <span>▼</span>
                  </div>

                  {/* Right Column: 180° Semi-Circle Dial Indicator (3 dots - Neutral ○ - 3 dots) */}
                  <div className="relative w-14 h-16 flex items-center justify-center select-none">
                    <RollTrimGauge value={activeValues.rollTrim} />
                  </div>
                </div>
              </div>

              {/* Top-Right: TRIM / AP DISC Switch (Close Stacking, Standard CockpitTwoWaySwitch) */}
              <div className="flex flex-col items-center justify-center pl-1">
                {/* Header and NORM stacked tightly together on two lines */}
                <div className="flex flex-col items-center justify-center mb-0.5 select-none pointer-events-none">
                  <span className="text-[8px] font-black tracking-tight uppercase text-zinc-300 whitespace-nowrap">
                    TRIM / AP DISC
                  </span>
                  <span
                    className={`text-[9.5px] font-black tracking-wider uppercase text-center mt-0.5 select-none transition-colors ${
                      activeValues.trimDisc
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200'
                    }`}
                  >
                    NORM
                  </span>
                </div>

                {/* Authentic CockpitTwoWaySwitch */}
                <div
                  onMouseDown={handleTrimDiscMouseDown}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`TRIM / AP DISC: ${activeValues.trimDisc ? 'NORM' : 'DISC'} (Left-click for NORM, Right-click for DISC)`}
                  className={`my-0.5 ${isControlAllowed('trimDisc') ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed pointer-events-none'}`}
                >
                  <CockpitTwoWaySwitch isUp={activeValues.trimDisc} />
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase text-center mt-0.5 select-none pointer-events-none transition-colors ${
                    !activeValues.trimDisc
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  DISC
                </span>
              </div>
            </div>

            {/* ROW 2: YAW TRIM (Left) | PITCH TRIM (Right) */}
            <div className="grid grid-cols-2 gap-2 h-[134px]">
              {/* Bottom-Left: YAW TRIM (Centered Header & Large Whitish-Gray Knob with Outlined Pointer) */}
              <div className="flex flex-col items-center justify-between pr-1">
                {/* Header: YAW TRIM (Centered Horizontally with Knob) */}
                <div className="w-full flex justify-center">
                  <span className="text-[8.5px] font-black tracking-wider uppercase text-zinc-300">
                    YAW TRIM
                  </span>
                </div>

                {/* Large Whitish-Gray Knob with Wire Guards & 180° Right Arc with Left-Pointing Triangle (◀) */}
                <div className="relative w-full flex items-center justify-center my-auto">
                  {/* Left Wire Loop Guard */}
                  <div
                    className="w-1.5 h-12 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm mr-1 pointer-events-none"
                    style={{ boxShadow: '1px 2px 4px rgba(0,0,0,0.6)' }}
                  />

                  {/* Rotary Knob & 180° Arc */}
                  <div
                    onMouseDown={(e) => {
                      if (e.button === 0) startSlew(e, 'yawTrim', -1); // Left click rotates towards L (counter-clockwise)
                      else if (e.button === 2) startSlew(e, 'yawTrim', 1); // Right click rotates towards R (clockwise)
                    }}
                    onMouseUp={stopSlew}
                    onMouseLeave={stopSlew}
                    onContextMenu={(e) => e.preventDefault()}
                    title={`YAW TRIM: ${activeValues.yawTrim.toFixed(1)} (Left-click & hold for L, Right-click & hold for R)`}
                    className={`relative w-28 h-20 flex items-center justify-center select-none ${
                      isControlAllowed('yawTrim') ? 'cursor-pointer' : 'cursor-not-allowed pointer-events-none opacity-80'
                    }`}
                  >
                    <YawTrimDial value={activeValues.yawTrim} />
                  </div>

                  {/* Right Wire Loop Guard */}
                  <div
                    className="w-1.5 h-12 rounded-full border border-zinc-500/80 bg-gradient-to-r from-zinc-700 via-zinc-400 to-zinc-700 shadow-sm ml-0.5 pointer-events-none"
                    style={{ boxShadow: '1px 2px 4px rgba(0,0,0,0.6)' }}
                  />
                </div>

                <div className="h-1" />
              </div>

              {/* Bottom-Right: PITCH TRIM */}
              <div className="flex flex-col items-center justify-between pl-1">
                {/* Header: — PITCH TRIM — */}
                <div className="flex items-center justify-center space-x-1.5 w-full">
                  <div className="w-4 h-[1px] bg-zinc-600/70" />
                  <span className="text-[8.5px] font-black tracking-wider uppercase text-zinc-300 whitespace-nowrap">
                    PITCH TRIM
                  </span>
                  <div className="w-4 h-[1px] bg-zinc-600/70" />
                </div>

                {/* Top Half: 180° Bottom Semi-Circle Gauge (3 dots - Neutral ○ - 3 dots) */}
                <div className="relative w-26 h-14 flex items-center justify-center select-none mt-0.5">
                  <PitchTrimGauge value={activeValues.pitchTrim} />
                </div>

                {/* Bottom Half: NOSE / UP, Two-Headed Arrow, NOSE / DN, Horizontal White Slider */}
                <div className="flex flex-col items-center w-full px-1">
                  {/* Two-line Labels with Two-Headed Arrow ◄──► */}
                  <div className="flex items-center justify-between w-full px-1 text-[7.5px] font-black uppercase text-zinc-300 mb-0.5 leading-tight select-none">
                    <div className="flex flex-col items-center">
                      <span>NOSE</span>
                      <span>UP</span>
                    </div>

                    <div className="flex items-center justify-center text-zinc-500 font-bold text-[9px] leading-none select-none px-1">
                      <span>◄</span>
                      <span className="w-4 h-[1px] bg-zinc-600 mx-0.5" />
                      <span>►</span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span>NOSE</span>
                      <span>DN</span>
                    </div>
                  </div>

                  {/* Horizontal Ribbed White Slider Button */}
                  <div
                    onMouseDown={(e) => {
                      if (e.button === 0) startSlew(e, 'pitchTrim', -1); // Left click = NOSE UP
                      else if (e.button === 2) startSlew(e, 'pitchTrim', 1); // Right click = NOSE DN
                    }}
                    onMouseUp={stopSlew}
                    onMouseLeave={stopSlew}
                    onContextMenu={(e) => e.preventDefault()}
                    title={`PITCH TRIM: ${activeValues.pitchTrim.toFixed(1)} (Left-click & hold for NOSE UP, Right-click & hold for NOSE DN)`}
                    className={`relative w-16 h-5 rounded bg-gradient-to-r from-zinc-200 via-white to-zinc-300 border border-zinc-400 shadow-md flex items-center justify-around px-1 py-0.5 select-none ${
                      isControlAllowed('pitchTrim') ? 'cursor-pointer active:scale-95' : 'cursor-not-allowed pointer-events-none opacity-80'
                    }`}
                    style={{
                      boxShadow:
                        'inset 0 1px 1px rgba(255,255,255,0.9), 0 2px 5px rgba(0,0,0,0.7), inset -1px 0 2px rgba(0,0,0,0.3)',
                    }}
                  >
                    {/* Ribbed ridges */}
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                    <div className="w-[1.5px] h-full bg-zinc-400 shadow-inner rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* SVG DIAL GAUGES (True 180° Semi-Circles & Authentic Indicator Needle/Knob)  */
/* -------------------------------------------------------------------------- */

// 1. Roll Trim Gauge (Left 180° Semi-Circle Arc: 3 dots - Hollow Circle ○ - 3 dots)
const RollTrimGauge: React.FC<{ value: number }> = ({ value }) => {
  // value range: -3.0 (UP / L WING DN) to +3.0 (DOWN / R WING DN). Clamped [-3, 3]
  const clamped = Math.max(-3, Math.min(3, value));

  // Needle starts pointing directly Left (along negative X).
  // In SVG, clockwise rotation (+deg) rotates towards negative Y (UP)!
  // Counter-clockwise (-deg) rotates towards positive Y (DOWN)!
  const needleRotation = -clamped * (75 / 3);

  const cx = 38;
  const cy = 28;
  const r = 24;

  // Arc angles: full 180° semi-circle on the left (degOffset from +90° to -90°)
  // degOffset > 0 is UP (negative Y in SVG)
  const getPoint = (degOffset: number) => {
    const rad = (degOffset * Math.PI) / 180;
    return {
      x: cx - r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  const neutralPt = getPoint(0);
  const upDots = [75, 50, 25].map((d) => getPoint(d)); // UP (L WING DN)
  const downDots = [-25, -50, -75].map((d) => getPoint(d)); // DOWN (R WING DN)

  return (
    <svg width="48" height="58" viewBox="0 0 48 58" className="overflow-visible">
      {/* 3 Upper Filled Dots (L WING DN) */}
      {upDots.map((pt, i) => (
        <circle key={`up-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* Neutral Marker: Hollow Circle ○ at exact center-left */}
      <circle cx={neutralPt.x} cy={neutralPt.y} r="2.2" fill="none" stroke="#e4e4e7" strokeWidth="1.2" />

      {/* 3 Lower Filled Dots (R WING DN) */}
      {downDots.map((pt, i) => (
        <circle key={`down-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* Rotating Needle (Points Left, sweeps UP for L WING DN, DOWN for R WING DN) */}
      <g
        transform={`rotate(${needleRotation}, ${cx}, ${cy})`}
        style={{ willChange: 'transform', transition: 'transform 70ms linear' }}
      >
        <line x1={cx} y1={cy} x2={cx - r + 3} y2={cy} stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={cx - r + 3} y1={cy} x2={cx - r - 1} y2={cy} stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Center Pivot Screw */}
      <circle cx={cx} cy={cy} r="3" fill="#18181b" stroke="#71717a" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r="1" fill="#a1a1aa" />
    </svg>
  );
};

// 2. Pitch Trim Gauge (Bottom 180° Semi-Circle Arc: 3 dots - Hollow Circle ○ - 3 dots)
const PitchTrimGauge: React.FC<{ value: number }> = ({ value }) => {
  // value range: -3.0 (NOSE UP) to +3.0 (NOSE DN). Clamped [-3, 3]
  const clamped = Math.max(-3, Math.min(3, value));

  // Needle starts pointing straight DOWN (along positive Y).
  // Left click (NOSE UP) rotates needle to the LEFT (-deg)!
  // Right click (NOSE DN) rotates needle to the RIGHT (+deg)!
  const needleRotation = -clamped * (75 / 3);

  const cx = 50;
  const cy = 8;
  const r = 26;

  // Arc angles: full 180° semi-circle on the bottom (degOffset from -90° to +90°)
  // degOffset < 0 is LEFT (NOSE UP), degOffset > 0 is RIGHT (NOSE DN)
  const getPoint = (degOffset: number) => {
    const rad = (degOffset * Math.PI) / 180;
    return {
      x: cx + r * Math.sin(rad),
      y: cy + r * Math.cos(rad),
    };
  };

  const neutralPt = getPoint(0);
  const leftDots = [-75, -50, -25].map((d) => getPoint(d)); // LEFT (NOSE UP)
  const rightDots = [25, 50, 75].map((d) => getPoint(d)); // RIGHT (NOSE DN)

  return (
    <svg width="100" height="46" viewBox="0 0 100 46" className="overflow-visible">
      {/* 3 Left Filled Dots (NOSE UP) */}
      {leftDots.map((pt, i) => (
        <circle key={`left-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* Neutral Marker: Hollow Circle ○ at bottom center */}
      <circle cx={neutralPt.x} cy={neutralPt.y} r="2.2" fill="none" stroke="#e4e4e7" strokeWidth="1.2" />

      {/* 3 Right Filled Dots (NOSE DN) */}
      {rightDots.map((pt, i) => (
        <circle key={`right-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* Rotating Needle (Pivots from Top, sweeps LEFT for NOSE UP, RIGHT for NOSE DN) */}
      <g
        transform={`rotate(${needleRotation}, ${cx}, ${cy})`}
        style={{ willChange: 'transform', transition: 'transform 70ms linear' }}
      >
        <line x1={cx} y1={cy} x2={cx} y2={cy + r - 3} stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
        <line x1={cx} y1={cy + r - 3} x2={cx} y2={cy + r + 1} stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Center Pivot Screw */}
      <circle cx={cx} cy={cy} r="3.2" fill="#18181b" stroke="#71717a" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r="1" fill="#a1a1aa" />
    </svg>
  );
};

// 3. Yaw Trim Dial (Large Clean Whitish-Gray Knob with White/Black Outlined Pointer & 180° Right Arc with ◀)
const YawTrimDial: React.FC<{ value: number }> = ({ value }) => {
  // value range: -5.0 (L / UP) to +5.0 (R / DOWN). Clamped [-5, 5]
  const clamped = Math.max(-5, Math.min(5, value));

  // Rotation: 0 = East (0°).
  // -5 rotates towards L (counter-clockwise / UP by -75°)
  // +5 rotates towards R (clockwise / DOWN by +75°)
  const rotation = clamped * (75 / 5);

  const cx = 35;
  const cy = 40;
  const r = 34; // Radius to dots around large knob

  // Arc angles: full 180° semi-circle on the right (degOffset from +90° to -90°)
  // degOffset > 0 is UP (towards L), degOffset < 0 is DOWN (towards R)
  const getPoint = (degOffset: number) => {
    const rad = (degOffset * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  // 5 dots above towards L (+75°, +60°, +45°, +30°, +15°)
  const upDots = [75, 60, 45, 30, 15].map((d) => getPoint(d));
  // 5 dots below towards R (-15°, -30°, -45°, -60°, -75°)
  const downDots = [-15, -30, -45, -60, -75].map((d) => getPoint(d));

  // Neutral Marker: Triangle pointing LEFT (◀) at 0° (East)
  const neutralPt = getPoint(0);

  return (
    <svg width="105" height="82" viewBox="0 0 105 82" className="overflow-visible">
      {/* L Text on Top of Arc (at ~90°) */}
      <text
        x={cx}
        y={cy - r - 3}
        fill="#a1a1aa"
        fontSize="8.5"
        fontWeight="900"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        L
      </text>

      {/* 5 Dots above (Towards L) */}
      {upDots.map((pt, i) => (
        <circle key={`yaw-up-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* Neutral Indicator: Triangle pointing LEFT (◀) directly towards the knob pointer */}
      <polygon
        points={`${neutralPt.x - 2},${neutralPt.y} ${neutralPt.x + 3.5},${neutralPt.y - 3.5} ${neutralPt.x + 3.5},${neutralPt.y + 3.5}`}
        fill="#e4e4e7"
      />

      {/* 5 Dots below (Towards R) */}
      {downDots.map((pt, i) => (
        <circle key={`yaw-down-${i}`} cx={pt.x} cy={pt.y} r="1.4" fill="#e4e4e7" />
      ))}

      {/* R Text on Bottom of Arc (at ~-90°) */}
      <text
        x={cx}
        y={cy + r + 4}
        fill="#a1a1aa"
        fontSize="8.5"
        fontWeight="900"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        R
      </text>

      {/* Rotating Large Whitish-Gray Knob with Clean Face & Black-Outlined White Pointer */}
      <g
        transform={`rotate(${rotation}, ${cx}, ${cy})`}
        style={{ willChange: 'transform', transition: 'transform 70ms linear' }}
      >
        {/* Large Knob Body: 48px diameter (r = 24), clean whitish-gray metallic surface, NO center cap, NO perimeter grips */}
        <circle
          cx={cx}
          cy={cy}
          r="24"
          fill="url(#yawKnobClean)"
          stroke="#71717a"
          strokeWidth="1.2"
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
          }}
        />

        {/* Clean Inner Rim */}
        <circle cx={cx} cy={cy} r="22.5" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />

        {/* Indicator Line: White with Black Border Running Across to the Edge */}
        {/* Outer Black Border Line */}
        <line x1={cx + 3} y1={cy} x2={cx + 23.5} y2={cy} stroke="#000000" strokeWidth="4.2" strokeLinecap="round" />
        {/* Inner Solid White Line */}
        <line x1={cx + 4} y1={cy} x2={cx + 23} y2={cy} stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      {/* Gradient Definition for Clean Whitish-Gray Knob */}
      <defs>
        <radialGradient id="yawKnobClean" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="60%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </radialGradient>
      </defs>
    </svg>
  );
};
