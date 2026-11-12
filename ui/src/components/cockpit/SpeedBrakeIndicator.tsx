'use client';

import React, { useState } from 'react';

export interface SpeedBrakeIndicatorProps {
  isOpen?: boolean;
  status?: 'closed' | 'open' | 'off';
  interactive?: boolean;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
}

export const SpeedBrakeIndicator: React.FC<SpeedBrakeIndicatorProps> = ({
  isOpen = false,
  status,
  interactive = false,
  onToggle,
  className = '',
}) => {
  const [internalOpen, setInternalOpen] = useState(isOpen);

  // Sync internal state if controlled externally
  React.useEffect(() => {
    setInternalOpen(isOpen);
  }, [isOpen]);

  const currentStatus: 'closed' | 'open' | 'off' =
    status !== undefined ? status : internalOpen ? 'open' : 'closed';

  const handleToggle = () => {
    if (!interactive) return;
    const next = !internalOpen;
    setInternalOpen(next);
    onToggle?.(next);
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        onClick={handleToggle}
        className={`relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 w-[96px] min-w-[96px] max-w-[96px] h-[126px] min-h-[126px] text-zinc-300 font-mono select-none flex flex-col items-center justify-between ${
          interactive ? 'cursor-pointer hover:border-zinc-500/50 transition-colors' : ''
        }`}
        style={{
          boxShadow:
            '0 16px 32px -10px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
        title={interactive ? `Click to toggle (Currently: ${currentStatus.toUpperCase()})` : undefined}
      >
        {/* Fastener screws in 4 corners */}
        <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Placard Header: SPEED BRAKE */}
        <div className="mt-1 flex flex-col items-center leading-none">
          <span className="text-[10px] font-black tracking-[0.14em] text-zinc-100 font-mono">
            SPEED
          </span>
          <span className="text-[10px] font-black tracking-[0.14em] text-zinc-100 font-mono mt-0.5">
            BRAKE
          </span>
        </div>

        {/* Indicator Window */}
        <div className="relative mb-1 w-[68px] h-[68px] rounded-[5px] bg-gradient-to-b from-[#1b1d24] via-[#101217] to-[#0a0b0e] p-[3px] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8),0_1px_1px_rgba(255,255,255,0.06)] border border-[#22242c]">
          <div className="relative w-full h-full rounded-[3px] bg-[#060709] overflow-hidden flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.95)]">
            {/* Glass reflection sheen */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.02) 40%, transparent 60%)',
              }}
            />

            {/* CLOSED State */}
            {currentStatus === 'closed' && (
              <span className="text-[11.5px] font-black font-sans tracking-[0.06em] text-white select-none drop-shadow-[0_0_2px_rgba(255,255,255,0.35)]">
                CLOSED
              </span>
            )}

            {/* OPEN State: 3x3 Grid of 9 Dots */}
            {currentStatus === 'open' && (
              <svg viewBox="0 0 60 60" className="w-[46px] h-[46px] overflow-visible select-none">
                <defs>
                  <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#ffffff" floodOpacity="0.4" />
                  </filter>
                </defs>
                {/* 3x3 Grid centered in 60x60 SVG (xs: 16, 30, 44; ys: 16, 30, 44) */}
                {[16, 30, 44].map((y) =>
                  [16, 30, 44].map((x) => (
                    <circle
                      key={`${x}-${y}`}
                      cx={x}
                      cy={y}
                      r={4.2}
                      fill="#f8fafc"
                      filter="url(#dotGlow)"
                    />
                  ))
                )}
              </svg>
            )}

            {/* OFF State: Diagonal Barber Pole Stripes */}
            {currentStatus === 'off' && (
              <svg viewBox="0 0 60 60" className="w-full h-full select-none">
                <defs>
                  <pattern
                    id="sbBarberPole"
                    width="12"
                    height="12"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="12" fill="#111317" />
                    <rect x="6" width="6" height="12" fill="#e2e8f0" />
                  </pattern>
                </defs>
                <rect width="60" height="60" fill="url(#sbBarberPole)" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
