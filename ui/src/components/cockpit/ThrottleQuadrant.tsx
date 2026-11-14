'use client';

import React, { useState, useRef, useCallback, useEffect, useId } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

export type ThrottleDetent = 'CUTOFF' | 'IDLE' | 'MIL' | 'AB';

export interface DetentInfo {
  id: ThrottleDetent;
  label: string;
  shortLabel: string;
  angle: number; // degrees relative to vertical (0° = MIL)
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
}

export const THROTTLE_DETENTS: Record<ThrottleDetent, DetentInfo> = {
  CUTOFF: {
    id: 'CUTOFF',
    label: 'OFF / CUTOFF',
    shortLabel: 'OFF',
    angle: -32,
    badgeColor: '#f87171',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    badgeBorder: 'rgba(239, 68, 68, 0.4)',
  },
  IDLE: {
    id: 'IDLE',
    label: 'IDLE',
    shortLabel: 'IDLE',
    angle: -14,
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    badgeBorder: 'rgba(56, 189, 248, 0.4)',
  },
  MIL: {
    id: 'MIL',
    label: 'MIL POWER',
    shortLabel: 'MIL',
    angle: 6,
    badgeColor: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    badgeBorder: 'rgba(52, 211, 153, 0.4)',
  },
  AB: {
    id: 'AB',
    label: 'MAX AB',
    shortLabel: 'MAX AB',
    angle: 24,
    badgeColor: '#fbbf24',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    badgeBorder: 'rgba(251, 191, 36, 0.4)',
  },
};

export interface ThrottleQuadrantProps {
  position?: ThrottleDetent;
  angle?: number;
  pointA?: ThrottleDetent; // Default start point for demonstration (CUTOFF)
  pointB?: ThrottleDetent; // Default end point for demonstration (IDLE)
  allowContinuous?: boolean;
  disableDrag?: boolean;
  hideMilBadge?: boolean;
  customBadgeLabel?: string;
  customPointBLabel?: string;
  interactive?: boolean;
  onPositionChange?: (detent: ThrottleDetent, angle: number) => void;
  onClick?: (nextDetent: ThrottleDetent) => void;
  className?: string;
}

export const ThrottleQuadrant: React.FC<ThrottleQuadrantProps> = ({
  position,
  angle,
  pointA = 'CUTOFF',
  pointB = 'IDLE',
  allowContinuous = false,
  disableDrag = false,
  hideMilBadge = false,
  customBadgeLabel,
  customPointBLabel,
  interactive = true,
  onPositionChange,
  onClick,
  className = '',
}) => {
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const angleA = THROTTLE_DETENTS[pointA].angle;
  const angleB = THROTTLE_DETENTS[pointB].angle;
  const minBoundAngle = Math.min(angleA, angleB) - 4;
  const maxBoundAngle = Math.max(angleA, angleB) + 4;

  const [currentDetent, setCurrentDetent] = useState<ThrottleDetent>(
    position ?? pointA
  );
  const [currentAngle, setCurrentAngle] = useState(
    angle !== undefined ? angle : THROTTLE_DETENTS[position ?? pointA].angle
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  // Sync with external controlled position or angle if provided
  useEffect(() => {
    if (angle !== undefined && !isDragging) {
      setCurrentAngle(angle);
    } else if (position && !isDragging) {
      setCurrentDetent(position);
      setCurrentAngle(THROTTLE_DETENTS[position].angle);
    }
  }, [position, angle, isDragging]);

  // Pivot coordinates inside the 360x280 chassis
  const pivotX = 180;
  const pivotY = 224;

  const toggleBetweenPoints = () => {
    const next = currentDetent === pointA ? pointB : pointA;
    const targetAngle = THROTTLE_DETENTS[next].angle;
    setCurrentDetent(next);
    setCurrentAngle(targetAngle);
    onClick?.(next);
    onPositionChange?.(next, targetAngle);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    if (!disableDrag) {
      setIsDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const calculateAngleFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return currentAngle;
      const rect = containerRef.current.getBoundingClientRect();
      const originX = rect.left + pivotX;
      const originY = rect.top + pivotY;

      const dx = clientX - originX;
      const dy = -(clientY - originY);

      let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
      deg = Math.max(minBoundAngle, Math.min(maxBoundAngle, deg));

      return deg;
    },
    [currentAngle, minBoundAngle, maxBoundAngle, pivotX, pivotY]
  );

  const handlePointerMove = (e: React.PointerEvent) => {
    if (disableDrag || !isDragging || !interactive) return;
    const newAngle = calculateAngleFromPointer(e.clientX, e.clientY);
    setCurrentAngle(newAngle);

    const diffA = Math.abs(newAngle - angleA);
    const diffB = Math.abs(newAngle - angleB);
    const chosenDetent = diffA <= diffB ? pointA : pointB;
    setCurrentDetent(chosenDetent);
    onPositionChange?.(chosenDetent, newAngle);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (disableDrag) {
      if (!interactive) return;
      toggleBetweenPoints();
      dragStartPos.current = null;
      return;
    }
    if (!isDragging) return;
    setIsDragging(false);

    const dist = dragStartPos.current
      ? Math.hypot(e.clientX - dragStartPos.current.x, e.clientY - dragStartPos.current.y)
      : 0;

    const finalAngle = calculateAngleFromPointer(e.clientX, e.clientY);

    if (dist < 6) {
      toggleBetweenPoints();
    } else if (allowContinuous) {
      const diffA = Math.abs(finalAngle - angleA);
      const diffB = Math.abs(finalAngle - angleB);
      const chosenDetent = diffA <= diffB ? pointA : pointB;
      setCurrentAngle(finalAngle);
      setCurrentDetent(chosenDetent);
      onPositionChange?.(chosenDetent, finalAngle);
      onClick?.(chosenDetent);
    } else {
      // Determine nearest point (A or B)
      const diffA = Math.abs(finalAngle - angleA);
      const diffB = Math.abs(finalAngle - angleB);
      const chosenDetent = diffA <= diffB ? pointA : pointB;
      const targetAngle = THROTTLE_DETENTS[chosenDetent].angle;

      setCurrentDetent(chosenDetent);
      setCurrentAngle(targetAngle);
      onPositionChange?.(chosenDetent, targetAngle);
      onClick?.(chosenDetent);
    }

    dragStartPos.current = null;
  };

  const detentInfo = THROTTLE_DETENTS[currentDetent];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Horizontal Avionics TQS Chassis */}
      <div
        ref={containerRef}
        id={panelId}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setIsDragging(false)}
        className={`relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl w-[360px] min-w-[360px] max-w-[360px] h-[300px] min-h-[300px] text-zinc-300 font-mono select-none overflow-hidden ${
          interactive ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
        }`}
        style={{
          boxShadow:
            '0 20px 40px -14px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
        title={interactive ? `Click or drag to toggle between ${pointA} and ${pointB}` : undefined}
      >
        {/* Corner panel screws */}
        <div className="absolute top-2.5 left-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Top Header Bar with extended horizontal padding away from screws */}
        <div className="absolute top-3.5 inset-x-8 flex items-center justify-between z-20 pointer-events-none">
          <div className="flex items-center">
            <span className="text-[10.5px] font-bold tracking-widest text-zinc-300 font-mono">
              THROTTLE // TQS
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {!(hideMilBadge && detentInfo.id === 'MIL' && !customBadgeLabel) && (
              <span
                className="text-[9.5px] font-bold px-2 py-0.5 rounded font-mono border tracking-wider"
                style={{
                  color: detentInfo.badgeColor,
                  backgroundColor: detentInfo.badgeBg,
                  borderColor: detentInfo.badgeBorder,
                }}
              >
                {customBadgeLabel && detentInfo.id === 'MIL' ? customBadgeLabel : detentInfo.label}
              </span>
            )}
            <span className="text-[9.5px] font-bold text-zinc-400 font-mono w-8 text-right">
              {currentAngle.toFixed(0)}°
            </span>
          </div>
        </div>

        {/* Quadrant Track and Base Markings (SVG Background Layer) */}
        <svg
          viewBox="0 0 360 280"
          className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
        >
          <defs>
            <radialGradient id="tqsPivotGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="60%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0a0f1d" />
            </radialGradient>
            <linearGradient id="tqsSlotGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#08090d" />
              <stop offset="50%" stopColor="#141720" />
              <stop offset="100%" stopColor="#08090d" />
            </linearGradient>
          </defs>

          {/* Curved quadrant track slot */}
          <path
            d="
              M 114 139
              A 108 108 0 0 1 231 129
            "
            fill="none"
            stroke="url(#tqsSlotGrad)"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <path
            d="
              M 114 139
              A 108 108 0 0 1 231 129
            "
            fill="none"
            stroke="#272b38"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Demonstration Detents (Point A & Point B highlighted) */}
          {[pointA, pointB].map((detKey) => {
            const d = THROTTLE_DETENTS[detKey];
            const rad = (d.angle * Math.PI) / 180;
            const rIn = 100;
            const rOut = 116;
            const rLabel = 127;

            const x1 = pivotX + rIn * Math.sin(rad);
            const y1 = pivotY - rIn * Math.cos(rad);
            const x2 = pivotX + rOut * Math.sin(rad);
            const y2 = pivotY - rOut * Math.cos(rad);
            const lx = pivotX + rLabel * Math.sin(rad);
            const ly = pivotY - rLabel * Math.cos(rad);

            const isCurrent = d.id === currentDetent;
            const labelText =
              hideMilBadge && detKey === 'MIL' ? customPointBLabel || '' : d.shortLabel;

            return (
              <g key={d.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={isCurrent ? d.badgeColor : '#64748b'}
                  strokeWidth={isCurrent ? 2.5 : 1.5}
                  strokeLinecap="round"
                />
                {labelText && (
                  <text
                    x={lx}
                    y={ly}
                    fill={isCurrent ? d.badgeColor : '#94a3b8'}
                    fontSize="8.5"
                    fontWeight="900"
                    fontFamily="monospace"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                  >
                    {labelText}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Rotating Throttle Arm & Large TQS Grip */}
        <motion.div
          animate={{ rotate: currentAngle }}
          transition={
            isDragging
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 26 }
          }
          style={{
            position: 'absolute',
            left: `${pivotX}px`,
            top: `${pivotY}px`,
            width: 0,
            height: 0,
            transformOrigin: '0px 0px',
            willChange: 'transform',
          }}
          className="z-10"
        >
          {/* Shaft connecting pivot to TQS head */}
          <div
            className="absolute -left-[9px] -top-[106px] w-[18px] h-[108px] rounded-t-[2px] shadow-xl pointer-events-none"
            style={{
              background: 'linear-gradient(to right, #64748b 0%, #94a3b8 30%, #475569 70%, #1e293b 100%)',
              border: '1px solid rgba(0,0,0,0.7)',
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), 3px 6px 12px rgba(0,0,0,0.7)',
            }}
          >
            {/* Machined reinforcement rib */}
            <div className="absolute left-[5px] top-[10px] w-[6px] h-[86px] bg-gradient-to-r from-zinc-400 to-zinc-600 rounded-[1px] shadow-inner" />
          </div>

          {/* Large TQS Head Grip from /crewchief/tqs.webp */}
          <div
            className="absolute -left-[76px] -top-[206px] w-[130px] h-[142px] pointer-events-none select-none"
            style={{ filter: 'drop-shadow(4px 8px 12px rgba(0,0,0,0.9))' }}
          >
            <Image
              src="/crewchief/tqs.webp"
              alt="TQS Throttle Grip"
              width={130}
              height={142}
              priority
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          </div>
        </motion.div>

        {/* Pivot Hub & Axle Bolt (Drawn over rotating arm) */}
        <svg
          viewBox="0 0 360 280"
          className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
        >
          {/* Base mounting ring */}
          <circle
            cx={pivotX}
            cy={pivotY}
            r={16}
            fill="#151820"
            stroke="#333845"
            strokeWidth="1.4"
          />

          {/* Pivot bolt cap */}
          <circle
            cx={pivotX}
            cy={pivotY}
            r={11}
            fill="url(#tqsPivotGrad)"
            stroke="#090a0e"
            strokeWidth="1.2"
          />

          {/* Socket screw central indent */}
          <circle
            cx={pivotX}
            cy={pivotY}
            r={4.5}
            fill="#090b10"
            stroke="#475569"
            strokeWidth="1"
          />
          <line
            x1={pivotX - 3}
            y1={pivotY}
            x2={pivotX + 3}
            y2={pivotY}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeOpacity="0.5"
          />
        </svg>

        {/* Centered Bottom Interaction Hint */}
        <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center z-20 pointer-events-none">
          <span className="text-[8.5px] font-mono tracking-wider text-zinc-500 uppercase">
            {interactive
              ? disableDrag
                ? 'CLICK TO STEP'
                : 'CLICK TO STEP // DRAG TO SLIDE'
              : 'LOCKED'}
          </span>
        </div>
      </div>
    </div>
  );
};
