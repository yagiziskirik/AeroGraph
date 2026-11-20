'use client';

import React, { useState, useId, useRef, useEffect, useCallback } from 'react';
import { Sound } from '../../services/sound';
import { CockpitThreeWaySwitch } from './CockpitSwitch';
import { CockpitRoundKnob, CockpitTriangularKnob } from './CockpitRotary';

/* -------------------------------------------------------------------------- */
/* Types & Interfaces                                                         */
/* -------------------------------------------------------------------------- */

export interface LightingPanelState {
  primaryConsoles?: number; // 0.0 to 1.0 (default: 0.5)
  primaryInstPnl?: number; // 0.0 to 1.0 (default: 0.5)
  primaryDataEntry?: number; // 0.0 to 1.0 (default: 0.5)
  floodConsoles?: number; // 0.0 to 1.0 (default: 0.0 / OFF)
  floodInstPnl?: number; // 0.0 to 1.0 (default: 0.5)
  malIndLts?: 'BRT' | 'CENTER' | 'DIM'; // default: 'CENTER' (momentary)
}

export interface LightingPanelProps {
  state?: LightingPanelState;
  onStateChange?: (key: keyof LightingPanelState, value: any) => void;
  // Individual controlled props
  primaryConsoles?: number;
  onPrimaryConsolesChange?: (val: number) => void;
  primaryInstPnl?: number;
  onPrimaryInstPnlChange?: (val: number) => void;
  primaryDataEntry?: number;
  onPrimaryDataEntryChange?: (val: number) => void;
  floodConsoles?: number;
  onFloodConsolesChange?: (val: number) => void;
  floodInstPnl?: number;
  onFloodInstPnlChange?: (val: number) => void;
  malIndLts?: 'BRT' | 'CENTER' | 'DIM';
  onMalIndLtsChange?: (pos: 'BRT' | 'CENTER' | 'DIM') => void;
  allowSwitchClick?: boolean | Partial<Record<keyof LightingPanelState, boolean>>;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Helper: Concentric Curved Arrow for BRT Indication                         */
/* -------------------------------------------------------------------------- */

interface CurvedBrtArrowProps {
  cx: number;
  cy: number;
  r: number;
}

const CurvedBrtArrow: React.FC<CurvedBrtArrowProps> = ({ cx, cy, r }) => {
  // Arc concentric to knob from 1:20 (-42°) curving clockwise to 3:50 (+24°)
  const deg2rad = Math.PI / 180;
  const startAng = -42 * deg2rad;
  const endAng = 24 * deg2rad;
  const x1 = cx + r * Math.cos(startAng);
  const y1 = cy + r * Math.sin(startAng);
  const x2 = cx + r * Math.cos(endAng);
  const y2 = cy + r * Math.sin(endAng);

  // Arrowhead pointing along clockwise tangent (+90° from radial vector)
  const tanAng = endAng + Math.PI / 2;
  const headLen = 4.6;
  const headWidth = 3.0;
  const bx = x2 - headLen * Math.cos(tanAng);
  const by = y2 - headLen * Math.sin(tanAng);
  const p1x = bx + headWidth * -Math.sin(tanAng);
  const p1y = by + headWidth * Math.cos(tanAng);
  const p2x = bx - headWidth * -Math.sin(tanAng);
  const p2y = by - headWidth * Math.cos(tanAng);

  return (
    <g className="pointer-events-none select-none">
      <path
        d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${bx.toFixed(1)} ${by.toFixed(1)}`}
        fill="none"
        stroke="#d4d4d8"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <polygon
        points={`${x2.toFixed(1)},${y2.toFixed(1)} ${p1x.toFixed(1)},${p1y.toFixed(1)} ${p2x.toFixed(1)},${p2y.toFixed(1)}`}
        fill="#d4d4d8"
      />
    </g>
  );
};

/* -------------------------------------------------------------------------- */
/* Main LightingPanel Component                                               */
/* -------------------------------------------------------------------------- */

export const LightingPanel: React.FC<LightingPanelProps> = ({
  state: controlledState,
  onStateChange,
  primaryConsoles: controlledPrimaryConsoles,
  onPrimaryConsolesChange,
  primaryInstPnl: controlledPrimaryInstPnl,
  onPrimaryInstPnlChange,
  primaryDataEntry: controlledPrimaryDataEntry,
  onPrimaryDataEntryChange,
  floodConsoles: controlledFloodConsoles,
  onFloodConsolesChange,
  floodInstPnl: controlledFloodInstPnl,
  onFloodInstPnlChange,
  malIndLts: controlledMalIndLts,
  onMalIndLtsChange,
  allowSwitchClick = true,
  className = '',
}) => {
  const panelId = useId();

  // Internal uncontrolled state
  const [internalState, setInternalState] = useState<Required<LightingPanelState>>({
    primaryConsoles: 0.5,
    primaryInstPnl: 0.5,
    primaryDataEntry: 0.5,
    floodConsoles: 0.0,
    floodInstPnl: 0.5,
    malIndLts: 'CENTER',
  });

  // Momentary switch tracking ref
  const momentaryRef = useRef<boolean>(false);

  // Slew hold timers
  const slewIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const slewDelayRef = useRef<NodeJS.Timeout | null>(null);

  // DOM refs for non-passive wheel event attachment (strictly blocks page scroll)
  const primaryConsolesRef = useRef<SVGGElement | null>(null);
  const primaryInstPnlRef = useRef<SVGGElement | null>(null);
  const primaryDataEntryRef = useRef<SVGGElement | null>(null);
  const floodConsolesRef = useRef<SVGGElement | null>(null);
  const floodInstPnlRef = useRef<SVGGElement | null>(null);

  // Active resolved values
  const activePrimaryConsoles =
    controlledPrimaryConsoles !== undefined
      ? controlledPrimaryConsoles
      : controlledState?.primaryConsoles !== undefined
      ? controlledState.primaryConsoles
      : internalState.primaryConsoles;

  const activePrimaryInstPnl =
    controlledPrimaryInstPnl !== undefined
      ? controlledPrimaryInstPnl
      : controlledState?.primaryInstPnl !== undefined
      ? controlledState.primaryInstPnl
      : internalState.primaryInstPnl;

  const activePrimaryDataEntry =
    controlledPrimaryDataEntry !== undefined
      ? controlledPrimaryDataEntry
      : controlledState?.primaryDataEntry !== undefined
      ? controlledState.primaryDataEntry
      : internalState.primaryDataEntry;

  const activeFloodConsoles =
    controlledFloodConsoles !== undefined
      ? controlledFloodConsoles
      : controlledState?.floodConsoles !== undefined
      ? controlledState.floodConsoles
      : internalState.floodConsoles;

  const activeFloodInstPnl =
    controlledFloodInstPnl !== undefined
      ? controlledFloodInstPnl
      : controlledState?.floodInstPnl !== undefined
      ? controlledState.floodInstPnl
      : internalState.floodInstPnl;

  const activeMalIndLts =
    controlledMalIndLts !== undefined
      ? controlledMalIndLts
      : controlledState?.malIndLts !== undefined
      ? controlledState.malIndLts
      : internalState.malIndLts;

  // Ref tracking latest active values for continuous slew interval
  const activeValuesRef = useRef({
    primaryConsoles: activePrimaryConsoles,
    primaryInstPnl: activePrimaryInstPnl,
    primaryDataEntry: activePrimaryDataEntry,
    floodConsoles: activeFloodConsoles,
    floodInstPnl: activeFloodInstPnl,
  });

  activeValuesRef.current = {
    primaryConsoles: activePrimaryConsoles,
    primaryInstPnl: activePrimaryInstPnl,
    primaryDataEntry: activePrimaryDataEntry,
    floodConsoles: activeFloodConsoles,
    floodInstPnl: activeFloodInstPnl,
  };

  const isAllowed = useCallback((key: keyof LightingPanelState): boolean => {
    if (typeof allowSwitchClick === 'boolean') return allowSwitchClick;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick !== null) {
      return !!allowSwitchClick[key];
    }
    return true;
  }, [allowSwitchClick]);

  // Generic state updater
  const updateControl = useCallback(<K extends keyof LightingPanelState>(key: K, value: LightingPanelState[K]) => {
    if (onStateChange) {
      onStateChange(key, value);
    }
    if (key === 'primaryConsoles' && onPrimaryConsolesChange) onPrimaryConsolesChange(value as number);
    if (key === 'primaryInstPnl' && onPrimaryInstPnlChange) onPrimaryInstPnlChange(value as number);
    if (key === 'primaryDataEntry' && onPrimaryDataEntryChange) onPrimaryDataEntryChange(value as number);
    if (key === 'floodConsoles' && onFloodConsolesChange) onFloodConsolesChange(value as number);
    if (key === 'floodInstPnl' && onFloodInstPnlChange) onFloodInstPnlChange(value as number);
    if (key === 'malIndLts' && onMalIndLtsChange) onMalIndLtsChange(value as 'BRT' | 'CENTER' | 'DIM');

    setInternalState((prev) => ({ ...prev, [key]: value }));
  }, [
    onStateChange,
    onPrimaryConsolesChange,
    onPrimaryInstPnlChange,
    onPrimaryDataEntryChange,
    onFloodConsolesChange,
    onFloodInstPnlChange,
    onMalIndLtsChange,
  ]);

  // Adjust rotary knob value with tactile sound
  const adjustRotary = useCallback((key: keyof LightingPanelState, delta: number) => {
    if (!isAllowed(key)) return;
    const currentVal = activeValuesRef.current[key as keyof typeof activeValuesRef.current] ?? 0.5;
    const nextVal = Math.max(0, Math.min(1, Math.round((currentVal + delta) * 100) / 100));
    if (nextVal !== currentVal) {
      Sound.playClick();
      updateControl(key, nextVal);
    }
  }, [isAllowed, updateControl]);

  // Slew hold handlers: continuous adjustment while mouse button is held
  const stopSlew = useCallback(() => {
    if (slewDelayRef.current) {
      clearTimeout(slewDelayRef.current);
      slewDelayRef.current = null;
    }
    if (slewIntervalRef.current) {
      clearInterval(slewIntervalRef.current);
      slewIntervalRef.current = null;
    }
  }, []);

  const startSlew = (
    e: React.MouseEvent,
    key: keyof LightingPanelState,
    delta: number
  ) => {
    e.preventDefault();
    if (!isAllowed(key)) return;
    stopSlew();

    // Immediate initial step
    adjustRotary(key, delta);

    // After 220ms initial hold delay, continuously slew every 45ms
    slewDelayRef.current = setTimeout(() => {
      slewIntervalRef.current = setInterval(() => {
        adjustRotary(key, delta);
      }, 45);
    }, 220);
  };

  // Global mouseup cleanup to stop continuous slew
  useEffect(() => {
    const handleGlobalMouseUp = () => stopSlew();
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      stopSlew();
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [stopSlew]);

  // Non-passive wheel event listener attachment: prevents page scroll completely
  useEffect(() => {
    const attachNonPassiveWheel = (
      ref: React.RefObject<SVGGElement | null>,
      key: keyof LightingPanelState
    ) => {
      const el = ref.current;
      if (!el) return () => {};

      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        adjustRotary(key, delta);
      };

      el.addEventListener('wheel', onWheel, { passive: false });
      return () => {
        el.removeEventListener('wheel', onWheel);
      };
    };

    const cleanups = [
      attachNonPassiveWheel(primaryConsolesRef, 'primaryConsoles'),
      attachNonPassiveWheel(primaryInstPnlRef, 'primaryInstPnl'),
      attachNonPassiveWheel(primaryDataEntryRef, 'primaryDataEntry'),
      attachNonPassiveWheel(floodConsolesRef, 'floodConsoles'),
      attachNonPassiveWheel(floodInstPnlRef, 'floodInstPnl'),
    ];

    return () => {
      cleanups.forEach((c) => c());
    };
  }, [adjustRotary]);

  // Mouse down handler for knob click & hold
  const handleRotaryMouseDown = (e: React.MouseEvent, key: keyof LightingPanelState) => {
    if (!isAllowed(key)) return;
    if (e.button === 0) {
      // Left click = advance CW (+0.05)
      startSlew(e, key, 0.05);
    } else if (e.button === 2) {
      // Right click = retract CCW (-0.05)
      startSlew(e, key, -0.05);
    }
  };

  // Momentary switch actions for MAL & IND LTS
  const handleMalIndLtsDown = (pos: 'BRT' | 'DIM') => {
    if (!isAllowed('malIndLts')) return;
    momentaryRef.current = true;
    Sound.playSwitch();
    updateControl('malIndLts', pos);
  };

  const handleMalIndLtsUp = () => {
    if (!isAllowed('malIndLts')) return;
    if (momentaryRef.current) {
      momentaryRef.current = false;
      Sound.playSwitch();
      updateControl('malIndLts', 'CENTER');
    }
  };

  // Convert 0.0-1.0 normalized value to rotation angle in degrees
  // 7 o'clock = 120° (min / OFF), 12 o'clock = 270° (50% / neutral), 5 o'clock = 60° / 420° (max / BRT)
  const valToAngle = (val: number) => 120 + val * 300;

  // Geometry dimensions:
  // All round knobs: size 52px (radius 26px)
  // Triangular INST PNL knob: size 48px (radius 24px)
  // Centers:
  // Top row centers: (86, 70), (172, 70), (258, 70)
  // Bottom row centers: CONSOLES (76, 208), INST PNL (172, 210), MAL & IND LTS (258, 221)

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics LIGHTING Panel Chassis (320px x 280px) */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl w-[320px] min-w-[320px] max-w-[320px] h-[280px] text-zinc-300 font-mono select-none overflow-hidden"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Corner Aircraft Slotted DZUS Fasteners */}
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

        {/* Chassis Flat Dark Phillips Screws */}
        <div className="absolute top-[138px] left-[34px] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute top-[138px] left-[258px] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute bottom-3 left-[124px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Center Panel Alignment Cross (+) */}
        <div className="absolute top-[138px] left-[216px] -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-zinc-500 font-bold text-[11px] leading-none opacity-60">+</span>
        </div>

        {/* Vertical LIGHTING Title on Far Left Edge (Minimum 11px font size) */}
        <div className="absolute left-2.5 top-[58px] bottom-[58px] w-4 flex flex-col items-center justify-between pointer-events-none select-none">
          <span className="text-[11px] font-black tracking-[0.25em] text-zinc-300 leading-none flex flex-col items-center justify-between h-full">
            <span>L</span>
            <span>I</span>
            <span>G</span>
            <span>H</span>
            <span>T</span>
            <span>I</span>
            <span>N</span>
            <span>G</span>
          </span>
        </div>

        {/* SVG Faceplate: Markings, Headers, Arrows, and Embedded Knobs */}
        <svg
          viewBox="0 0 320 280"
          className="absolute inset-0 w-full h-full select-none"
        >
          {/* ---------------------------------------------------------------- */}
          {/* TOP ROW: PRIMARY SECTION                                         */}
          {/* ---------------------------------------------------------------- */}

          {/* Centered PRIMARY Header with aligned lines to CONSOLES & DATA ENTRY centers */}
          <line x1="86" y1="14" x2="134" y2="14" stroke="#a1a1aa" strokeWidth="1.2" />
          <text
            x="172"
            y="17"
            fill="#e4e4e7"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.08em"
            textAnchor="middle"
          >
            PRIMARY
          </text>
          <line x1="210" y1="14" x2="258" y2="14" stroke="#a1a1aa" strokeWidth="1.2" />

          {/* 1. PRIMARY CONSOLES (Round Knob, Size 52px) */}
          <g>
            <text
              x="86"
              y="34"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              CONSOLES
            </text>
            <CurvedBrtArrow cx={86} cy={70} r={31} />
            <text
              x="122"
              y="78"
              fill="#d4d4d8"
              fontSize="9"
              fontWeight="bold"
              textAnchor="start"
            >
              BRT
            </text>
            {/* Interactive Round Knob (52px diameter) */}
            <g
              ref={primaryConsolesRef}
              onMouseDown={(e) => handleRotaryMouseDown(e, 'primaryConsoles')}
              onMouseUp={stopSlew}
              onMouseLeave={stopSlew}
              onContextMenu={(e) => e.preventDefault()}
              className={isAllowed('primaryConsoles') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <title>{`PRIMARY CONSOLES: ${Math.round(activePrimaryConsoles * 100)}% (Hold Left-Click to increase, Hold Right-Click to decrease)`}</title>
              <CockpitRoundKnob
                cx={86}
                cy={70}
                size={52}
                rotation={valToAngle(activePrimaryConsoles)}
                interactive={false}
              />
            </g>
          </g>

          {/* 2. PRIMARY INST PNL (Round Knob, Size 52px) */}
          <g>
            <text
              x="172"
              y="34"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              INST PNL
            </text>
            <CurvedBrtArrow cx={172} cy={70} r={31} />
            <text
              x="208"
              y="78"
              fill="#d4d4d8"
              fontSize="9"
              fontWeight="bold"
              textAnchor="start"
            >
              BRT
            </text>
            {/* Interactive Round Knob (52px diameter) */}
            <g
              ref={primaryInstPnlRef}
              onMouseDown={(e) => handleRotaryMouseDown(e, 'primaryInstPnl')}
              onMouseUp={stopSlew}
              onMouseLeave={stopSlew}
              onContextMenu={(e) => e.preventDefault()}
              className={isAllowed('primaryInstPnl') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <title>{`PRIMARY INST PNL: ${Math.round(activePrimaryInstPnl * 100)}% (Hold Left-Click to increase, Hold Right-Click to decrease)`}</title>
              <CockpitRoundKnob
                cx={172}
                cy={70}
                size={52}
                rotation={valToAngle(activePrimaryInstPnl)}
                interactive={false}
              />
            </g>
          </g>

          {/* 3. PRIMARY DATA ENTRY DISPLAY (Round Knob, Size 52px) */}
          <g>
            <text
              x="258"
              y="28"
              fill="#e4e4e7"
              fontSize="9"
              fontWeight="bold"
              letterSpacing="0.03em"
              textAnchor="middle"
            >
              DATA ENTRY
            </text>
            <text
              x="258"
              y="39"
              fill="#e4e4e7"
              fontSize="9"
              fontWeight="bold"
              letterSpacing="0.03em"
              textAnchor="middle"
            >
              DISPLAY
            </text>
            <CurvedBrtArrow cx={258} cy={70} r={31} />
            <text
              x="294"
              y="78"
              fill="#d4d4d8"
              fontSize="9"
              fontWeight="bold"
              textAnchor="start"
            >
              BRT
            </text>
            {/* Interactive Round Knob (52px diameter) */}
            <g
              ref={primaryDataEntryRef}
              onMouseDown={(e) => handleRotaryMouseDown(e, 'primaryDataEntry')}
              onMouseUp={stopSlew}
              onMouseLeave={stopSlew}
              onContextMenu={(e) => e.preventDefault()}
              className={isAllowed('primaryDataEntry') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <title>{`PRIMARY DATA ENTRY DISPLAY: ${Math.round(activePrimaryDataEntry * 100)}% (Hold Left-Click to increase, Hold Right-Click to decrease)`}</title>
              <CockpitRoundKnob
                cx={258}
                cy={70}
                size={52}
                rotation={valToAngle(activePrimaryDataEntry)}
                interactive={false}
              />
            </g>
          </g>

          {/* ---------------------------------------------------------------- */}
          {/* BOTTOM ROW: FLOOD & MAL/IND SECTION                              */}
          {/* ---------------------------------------------------------------- */}

          {/* Centered FLOOD Header connecting CONSOLES & INST PNL centers */}
          <line x1="76" y1="147" x2="102" y2="147" stroke="#a1a1aa" strokeWidth="1.2" />
          <text
            x="124"
            y="150"
            fill="#e4e4e7"
            fontSize="10"
            fontWeight="bold"
            letterSpacing="0.08em"
            textAnchor="middle"
          >
            FLOOD
          </text>
          <line x1="146" y1="147" x2="172" y2="147" stroke="#a1a1aa" strokeWidth="1.2" />

          {/* 4. FLOOD CONSOLES (Large Round Knob, Size 52px, OFF & HIGH INT ticks) */}
          <g>
            <text
              x="76"
              y="168"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              CONSOLES
            </text>

            {/* 7 o'clock Tick Mark & OFF Label */}
            {/* 120° vector: cos = -0.5, sin = 0.866 */}
            <line
              x1="62.0"
              y1="232.2"
              x2="58.5"
              y2="238.3"
              stroke="#e4e4e7"
              strokeWidth="1.3"
            />
            <text
              x="57"
              y="251"
              fill={activeFloodConsoles === 0 ? '#fbbf24' : '#d4d4d8'}
              fontSize="9"
              fontWeight={activeFloodConsoles === 0 ? '900' : 'bold'}
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              OFF
            </text>

            {/* 5 o'clock Tick Mark & HIGH INT Label */}
            {/* 60° vector: cos = 0.5, sin = 0.866 */}
            <line
              x1="90.0"
              y1="232.2"
              x2="93.5"
              y2="238.3"
              stroke="#e4e4e7"
              strokeWidth="1.3"
            />
            <text
              x="97"
              y="251"
              fill={activeFloodConsoles === 1 ? '#fbbf24' : '#d4d4d8'}
              fontSize="9"
              fontWeight={activeFloodConsoles === 1 ? '900' : 'bold'}
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              HIGH INT
            </text>

            {/* Interactive Round Knob (52px diameter) */}
            <g
              ref={floodConsolesRef}
              onMouseDown={(e) => handleRotaryMouseDown(e, 'floodConsoles')}
              onMouseUp={stopSlew}
              onMouseLeave={stopSlew}
              onContextMenu={(e) => e.preventDefault()}
              className={isAllowed('floodConsoles') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <title>{`FLOOD CONSOLES: ${Math.round(activeFloodConsoles * 100)}% (Hold Left-Click to increase, Hold Right-Click to decrease)`}</title>
              <CockpitRoundKnob
                cx={76}
                cy={208}
                size={52}
                rotation={valToAngle(activeFloodConsoles)}
                interactive={false}
              />
            </g>
          </g>

          {/* 5. FLOOD INST PNL (Fluted Triangular Knob, Size 48px) */}
          <g>
            <text
              x="172"
              y="168"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              INST PNL
            </text>
            <CurvedBrtArrow cx={172} cy={210} r={29} />
            <text
              x="208"
              y="216"
              fill="#d4d4d8"
              fontSize="9"
              fontWeight="bold"
              textAnchor="start"
            >
              BRT
            </text>
            {/* Interactive Triangular Knob (48px diameter) */}
            <g
              ref={floodInstPnlRef}
              onMouseDown={(e) => handleRotaryMouseDown(e, 'floodInstPnl')}
              onMouseUp={stopSlew}
              onMouseLeave={stopSlew}
              onContextMenu={(e) => e.preventDefault()}
              className={isAllowed('floodInstPnl') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <title>{`FLOOD INST PNL: ${Math.round(activeFloodInstPnl * 100)}% (Hold Left-Click to increase, Hold Right-Click to decrease)`}</title>
              <CockpitTriangularKnob
                cx={172}
                cy={210}
                size={48}
                rotation={valToAngle(activeFloodInstPnl)}
                interactive={false}
              />
            </g>
          </g>

          {/* 6. MAL & IND LTS Labels (Switch rendered below via HTML) */}
          <g>
            <text
              x="258"
              y="164"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              MAL &amp;
            </text>
            <text
              x="258"
              y="176"
              fill="#e4e4e7"
              fontSize="9.5"
              fontWeight="bold"
              letterSpacing="0.04em"
              textAnchor="middle"
            >
              IND LTS
            </text>
            {/* BRT Label (Clickable Momentary Trigger) */}
            <text
              x="258"
              y="192"
              fill={activeMalIndLts === 'BRT' ? '#fbbf24' : '#d4d4d8'}
              fontSize="9.5"
              fontWeight={activeMalIndLts === 'BRT' ? '900' : 'bold'}
              letterSpacing="0.04em"
              textAnchor="middle"
              className={isAllowed('malIndLts') ? 'cursor-pointer' : 'cursor-default'}
              onMouseDown={() => handleMalIndLtsDown('BRT')}
              onMouseUp={handleMalIndLtsUp}
              onMouseLeave={handleMalIndLtsUp}
            >
              BRT
            </text>
            {/* DIM Label (Clickable Momentary Trigger) */}
            <text
              x="258"
              y="254"
              fill={activeMalIndLts === 'DIM' ? '#fbbf24' : '#d4d4d8'}
              fontSize="9.5"
              fontWeight={activeMalIndLts === 'DIM' ? '900' : 'bold'}
              letterSpacing="0.04em"
              textAnchor="middle"
              className={isAllowed('malIndLts') ? 'cursor-pointer' : 'cursor-default'}
              onMouseDown={() => handleMalIndLtsDown('DIM')}
              onMouseUp={handleMalIndLtsUp}
              onMouseLeave={handleMalIndLtsUp}
            >
              DIM
            </text>
          </g>
        </svg>

        {/* 6. MAL & IND LTS Switch HTML Mounting */}
        <div
          style={{ left: 258, top: 221 }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center select-none"
        >
          <div
            onMouseDown={(e) => {
              if (e.button === 0) handleMalIndLtsDown('BRT');
              else if (e.button === 2) {
                e.preventDefault();
                handleMalIndLtsDown('DIM');
              }
            }}
            onMouseUp={handleMalIndLtsUp}
            onMouseLeave={handleMalIndLtsUp}
            onContextMenu={(e) => e.preventDefault()}
            title="MAL & IND LTS: Momentary (Left-Click/Hold for BRT, Right-Click/Hold for DIM)"
            className={`${isAllowed('malIndLts') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}`}
          >
            <CockpitThreeWaySwitch
              position={
                activeMalIndLts === 'BRT'
                  ? 'UP'
                  : activeMalIndLts === 'DIM'
                  ? 'DOWN'
                  : 'CENTER'
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};
