'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, ShieldCheck, Activity } from 'lucide-react';

export interface TacticalControlInputCardProps {
  title?: string;
  subtitle?: string;
  roll?: number; // 0.0 - 1.0 (0.5 = center)
  pitch?: number; // 0.0 - 1.0 (0.5 = center)
  yaw?: number; // 0.0 - 1.0 (0.5 = center)
  leftBrake?: number; // 0.0 - 1.0
  rightBrake?: number; // 0.0 - 1.0
  showGimbal?: boolean;
  showBrakes?: boolean;
  className?: string;
  width?: number | string;
}

const springConfig = {
  type: 'spring' as const,
  stiffness: 600,
  damping: 38,
  mass: 0.5,
};

export const TacticalControlInputCard: React.FC<TacticalControlInputCardProps> = ({
  title = 'FLCS // DEFLECTION MONITOR',
  subtitle,
  roll = 0.5,
  pitch = 0.5,
  yaw = 0.5,
  leftBrake = 0.0,
  rightBrake = 0.0,
  showGimbal = true,
  showBrakes = true,
  className = '',
  width = 270,
}) => {
  const panelId = useId();

  // Normalized deflections (-1.0 to +1.0)
  const normRoll = (roll - 0.5) * 2; // -1 (Full Left) to +1 (Full Right)
  const normPitch = (pitch - 0.5) * 2; // -1 (Nose Down / Fwd) to +1 (Nose Up / Aft)
  const normYaw = (yaw - 0.5) * 2; // -1 (Full Left) to +1 (Full Right)

  // Percentages (-100% to +100%)
  const pctRoll = Math.round(normRoll * 100);
  const pctPitch = Math.round(normPitch * 100);
  const pctYaw = Math.round(normYaw * 100);

  // BIT threshold boundaries (|deflection| >= 20%)
  const isRollBitTriggered = Math.abs(normRoll) >= 0.20;
  const isPitchBitTriggered = Math.abs(normPitch) >= 0.20;
  const isYawBitTriggered = Math.abs(normYaw) >= 0.20;

  // Geometry: 172x172px inner viewport (176px - 4px borders). True Center: exactly (86, 86)
  const CX = 86;
  const CY = 86;
  const MAX_RADIUS = 72;

  const widthStyle = typeof width === 'number' ? `${width}px` : width;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Avionics Enclosure Chassis */}
      <div
        id={panelId}
        className="relative bg-[#101114] border border-[#27282e] rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.9),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-2px_6px_rgba(0,0,0,0.8)] p-3 text-zinc-300 font-mono select-none overflow-hidden flex flex-col"
        style={{
          width: widthStyle,
          minWidth: widthStyle,
          maxWidth: widthStyle,
        }}
      >
        {/* Corner panel hex screws */}
        <div className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/50 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/50 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-2 left-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/50 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/50 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Compact Header Bar */}
        <div className="px-2 mb-2 pt-1 flex items-center gap-1.5 pointer-events-none">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] font-black tracking-widest text-zinc-200 uppercase leading-none font-mono truncate">
              {title}
            </span>
            {subtitle && (
              <span className="text-[7px] text-zinc-500 font-mono tracking-wider mt-0.5 truncate">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN FLIGHT STICK GIMBAL VIEWPORT (CIRCULAR POLAR RETICLE)                 */}
        {/* ========================================================================= */}
        {showGimbal && (
          <div className="relative mx-auto my-0.5 flex flex-col items-center pointer-events-none">
            <div
              className="relative w-44 h-44 rounded-xl bg-gradient-to-b from-[#08090b] to-[#040506] border-2 border-[#2b2c34] shadow-[inset_0_0_24px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Fully Vectorized Precision Avionics HUD (100% Math-Locked to Origin CX=86, CY=86) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 172 172">
                {/* 100% outer limiter ring */}
                <circle cx={CX} cy={CY} r={MAX_RADIUS} fill="none" stroke="#3f3f46" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
                {/* 60% deflection ring */}
                <circle cx={CX} cy={CY} r={MAX_RADIUS * 0.6} fill="none" stroke="#27272a" strokeWidth="1" opacity="0.6" />
                {/* 40% deflection ring */}
                <circle cx={CX} cy={CY} r={MAX_RADIUS * 0.4} fill="none" stroke="#27272a" strokeWidth="1" opacity="0.8" />
                {/* 20% BIT check threshold ring */}
                <circle
                  cx={CX}
                  cy={CY}
                  r={MAX_RADIUS * 0.2}
                  fill="none"
                  stroke={isRollBitTriggered || isPitchBitTriggered ? '#34d399' : '#3f3f46'}
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity={isRollBitTriggered || isPitchBitTriggered ? 0.95 : 0.45}
                />

                {/* Major Axis Lines */}
                <line x1="0" y1={CY} x2="172" y2={CY} stroke="#52525b" strokeWidth="1" opacity="0.5" />
                <line x1={CX} y1="0" x2={CX} y2="172" stroke="#52525b" strokeWidth="1" opacity="0.5" />

                {/* Axis Tick Marks */}
                {[-0.6, -0.4, -0.2, 0.2, 0.4, 0.6].map((tick) => (
                  <React.Fragment key={`tick-${tick}`}>
                    {/* Horizontal Axis Ticks */}
                    <line
                      x1={CX + tick * MAX_RADIUS}
                      y1={CY - 2.5}
                      x2={CX + tick * MAX_RADIUS}
                      y2={CY + 2.5}
                      stroke="#71717a"
                      strokeWidth="1"
                      opacity="0.8"
                    />
                    {/* Vertical Axis Ticks */}
                    <line
                      x1={CX - 2.5}
                      y1={CY + tick * MAX_RADIUS}
                      x2={CX + 2.5}
                      y2={CY + tick * MAX_RADIUS}
                      stroke="#71717a"
                      strokeWidth="1"
                      opacity="0.8"
                    />
                  </React.Fragment>
                ))}

                {/* Center Deadzone Ring */}
                <circle cx={CX} cy={CY} r="6" fill="none" stroke="#71717a" strokeWidth="1" opacity="0.4" />

                {/* Framer Motion Spring-Animated Deflection Vector Line */}
                <motion.line
                  x1={CX}
                  y1={CY}
                  animate={{
                    x2: CX + normRoll * MAX_RADIUS,
                    y2: CY + normPitch * MAX_RADIUS,
                  }}
                  transition={springConfig}
                  stroke={isRollBitTriggered || isPitchBitTriggered ? '#34d399' : '#38bdf8'}
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                  opacity="0.85"
                  style={{ willChange: 'transform' }}
                />
              </svg>

              {/* Axis Limit Labels */}
              <div className="absolute inset-x-0 h-4 top-[calc(50%-8px)] pointer-events-none flex items-center justify-between px-1.5 z-10">
                <span className="text-[7px] font-mono text-zinc-500 font-bold leading-none">-100%</span>
                <span className="text-[7px] font-mono text-zinc-500 font-bold leading-none">+100%</span>
              </div>
              <div className="absolute inset-y-0 w-8 left-[calc(50%-16px)] pointer-events-none flex flex-col items-center justify-between py-1.5 z-10 text-center">
                <span className="text-[7px] font-mono text-zinc-500 font-bold leading-none">NOSE DN</span>
                <span className="text-[7px] font-mono text-zinc-500 font-bold leading-none">NOSE UP</span>
              </div>

              {/* Framer Motion Spring-Animated Target Reticle */}
              <motion.div
                className="absolute pointer-events-none z-20"
                style={{
                  left: CX,
                  top: CY,
                  willChange: 'transform',
                }}
                animate={{
                  x: normRoll * MAX_RADIUS,
                  y: normPitch * MAX_RADIUS,
                }}
                transition={springConfig}
              >
                {/* 24x24 Reticle centered at local (0, 0) via -ml-3 -mt-3 */}
                <div
                  className={`w-6 h-6 -ml-3 -mt-3 rounded-full border-2 transition-[border-color,background-color] duration-75 flex items-center justify-center ${
                    isRollBitTriggered || isPitchBitTriggered
                      ? 'border-emerald-400 bg-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                      : 'border-cyan-400 bg-cyan-500/20 shadow-[0_0_12px_rgba(34,211,238,0.7)]'
                  }`}
                >
                  {/* Center Optic Dot */}
                  <div
                    className={`w-1.5 h-1.5 rounded-full transition-colors duration-75 ${
                      isRollBitTriggered || isPitchBitTriggered ? 'bg-emerald-300' : 'bg-cyan-300'
                    }`}
                  />
                </div>
              </motion.div>

              {/* Digital Telemetry HUD Overlays */}
              <div className="absolute top-1.5 left-2 text-[8px] font-mono text-zinc-400 font-bold pointer-events-none z-20">
                PITCH:{' '}
                <span
                  className={
                    normPitch > 0.20
                      ? 'text-emerald-400 font-bold'
                      : normPitch < -0.20
                      ? 'text-amber-400 font-bold'
                      : 'text-zinc-300'
                  }
                >
                  {pctPitch > 0 ? `+${pctPitch}% AFT` : pctPitch < 0 ? `${pctPitch}% FWD` : '0%'}
                </span>
              </div>

              <div className="absolute top-1.5 right-2 text-[8px] font-mono text-zinc-400 font-bold pointer-events-none text-right z-20">
                ROLL:{' '}
                <span
                  className={
                    Math.abs(normRoll) >= 0.20 ? 'text-emerald-400 font-bold' : 'text-zinc-300'
                  }
                >
                  {pctRoll > 0 ? `+${pctRoll}% R` : pctRoll < 0 ? `${pctRoll}% L` : '0%'}
                </span>
              </div>

              <div className="absolute bottom-1.5 left-2 text-[7px] font-mono text-zinc-500 pointer-events-none z-20">
                [{normRoll.toFixed(2)}, {(-normPitch).toFixed(2)}]
              </div>

              <div className="absolute bottom-1.5 right-2 text-[7px] font-mono font-bold pointer-events-none z-20">
                <span
                  className={`px-1 py-0.2 rounded border ${
                    isRollBitTriggered || isPitchBitTriggered
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                      : 'bg-zinc-900/80 text-zinc-500 border-zinc-700/40'
                  }`}
                >
                  {isRollBitTriggered || isPitchBitTriggered ? 'DEFLECTED' : 'CENTERED'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TACTICAL RUDDER (YAW) PEDAL DEFLECTION BAR                                */}
        {/* ========================================================================= */}
        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-[#141518] border border-[#2b2c34] flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center justify-between text-[9px] font-mono">
            <span className="font-bold text-zinc-300 tracking-wider flex items-center gap-1">
              <Activity className="w-2.5 h-2.5 text-emerald-400" />
              <span>RUDDER (YAW)</span>
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-1 py-0.2 rounded text-[8px] font-bold border ${
                  isYawBitTriggered
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                    : 'bg-zinc-900 text-zinc-500 border-zinc-700'
                }`}
              >
                {normYaw < -0.20 ? 'LEFT' : normYaw > 0.20 ? 'RIGHT' : 'CENTER'}
              </span>
              <span className="font-bold text-zinc-200 text-[9px]">
                {pctYaw > 0 ? `+${pctYaw}%` : `${pctYaw}%`}
              </span>
            </div>
          </div>

          {/* Dual Split Rudder Bar (Center 0%) with Framer Motion Springs */}
          <div className="relative w-full h-3 bg-[#090a0d] rounded border border-zinc-800 overflow-hidden flex items-center">
            {/* Center 0% Notch */}
            <div className="absolute left-1/2 inset-y-0 w-0.5 bg-zinc-400 z-10" />

            {/* 20% limit tick marks */}
            <div className="absolute left-[40%] inset-y-0 w-px bg-amber-500/50 border-l border-dashed border-amber-400/60 z-10" />
            <div className="absolute left-[60%] inset-y-0 w-px bg-amber-500/50 border-l border-dashed border-amber-400/60 z-10" />

            {/* Left Fill Bar */}
            <motion.div
              className="absolute right-1/2 h-full bg-gradient-to-l from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              style={{ willChange: 'width' }}
              animate={{
                width: normYaw < 0 ? `${Math.min(50, Math.abs(normYaw) * 50)}%` : '0%',
              }}
              transition={springConfig}
            />

            {/* Right Fill Bar */}
            <motion.div
              className="absolute left-1/2 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
              style={{ willChange: 'width' }}
              animate={{
                width: normYaw > 0 ? `${Math.min(50, normYaw * 50)}%` : '0%',
              }}
              transition={springConfig}
            />
          </div>

          <div className="flex items-center justify-between text-[7px] font-mono text-zinc-500">
            <span>FULL L (-100%)</span>
            <span>0°</span>
            <span>FULL R (+100%)</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DIFFERENTIAL TOE BRAKES (LEFT & RIGHT)                                     */}
        {/* ========================================================================= */}
        {showBrakes && (
          <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#141518] border border-[#2b2c34] flex flex-col gap-1.5 pointer-events-none">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <span className="font-bold text-zinc-300 tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-cyan-400" />
                <span>DIFFERENTIAL TOE BRAKES</span>
              </span>
              <span className="text-[8px] text-zinc-500 font-mono">CH-1 &amp; CH-2</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Left Brake with Framer Motion Spring */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-400">
                  <span>L BRAKE</span>
                  <span className={leftBrake >= 0.20 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                    {Math.round(leftBrake * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0a0b0e] border border-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    style={{ willChange: 'width' }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, leftBrake * 100))}%`,
                    }}
                    transition={springConfig}
                  />
                </div>
              </div>

              {/* Right Brake with Framer Motion Spring */}
              <div className="flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[8px] font-mono text-zinc-400">
                  <span>R BRAKE</span>
                  <span className={rightBrake >= 0.20 ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                    {Math.round(rightBrake * 100)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#0a0b0e] border border-zinc-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                    style={{ willChange: 'width' }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, rightBrake * 100))}%`,
                    }}
                    transition={springConfig}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
