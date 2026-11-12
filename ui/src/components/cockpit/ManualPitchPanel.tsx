'use client';

import React, { useState, useId, useRef } from 'react';
import { Sound } from '../../services/sound';

export interface ManualPitchPanelProps {
  isOvrd?: boolean; // true = OVRD (left, momentary), false = NORM (right)
  onOvrdChange?: (isOvrd: boolean) => void;
  allowSwitchClick?: boolean; // Global toggle interactivity (default: true)
  className?: string;
}

export const ManualPitchPanel: React.FC<ManualPitchPanelProps> = ({
  isOvrd: controlledIsOvrd,
  onOvrdChange,
  allowSwitchClick = true,
  className = '',
}) => {
  const panelId = useId();

  // Internal momentary state if uncontrolled
  const [internalIsOvrd, setInternalIsOvrd] = useState<boolean>(false);
  const activeIsOvrd = controlledIsOvrd !== undefined ? controlledIsOvrd : internalIsOvrd;

  const pressActiveRef = useRef<boolean>(false);

  // Set switch state with sound
  const setOvrd = (val: boolean) => {
    if (!allowSwitchClick) return;
    if (activeIsOvrd === val) return;
    Sound.playSwitch();
    if (onOvrdChange) {
      onOvrdChange(val);
    } else {
      setInternalIsOvrd(val);
    }
  };

  // Momentary Left-Click Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!allowSwitchClick) return;
    if ('button' in e && e.button !== 0) return; // Ignore right-click / middle-click
    e.preventDefault();
    pressActiveRef.current = true;
    setOvrd(true);
  };

  const handleMouseUp = (e?: React.MouseEvent | React.TouchEvent) => {
    if (!allowSwitchClick) return;
    if (e && 'button' in e && e.button !== 0) return;
    if (!pressActiveRef.current) return;
    pressActiveRef.current = false;
    setOvrd(false);
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Authentic Avionics MANUAL PITCH Panel Chassis - Compact Vertical Strip (108px x 176px) */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 w-[108px] min-w-[108px] max-w-[108px] h-[176px] text-zinc-300 font-mono select-none flex flex-col justify-between items-center"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Slotted Corner Aircraft DZUS Fasteners */}
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

        {/* Top Header: MANUAL PITCH */}
        <div className="flex flex-col items-center mt-2.5">
          <span className="text-[8.5px] font-black tracking-wider uppercase text-zinc-300 leading-tight text-center">
            MANUAL
            <br />
            PITCH
          </span>
        </div>

        {/* Center: Sideways Switch Flanked by Horizontal Wire Loop Guards */}
        <div className="flex flex-col items-center my-auto">
          {/* Upper Horizontal Wire Loop Guard */}
          <div
            className="w-14 h-1.5 rounded-full border border-zinc-500/80 bg-gradient-to-b from-zinc-400 via-zinc-200 to-zinc-500 shadow-sm mb-1 pointer-events-none"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          />

          {/* Switch Row: OVRD (Left) | Horizontal Lever Switch | NORM (Right) */}
          <div className="flex items-center justify-between w-full px-1">
            {/* OVRD Label (Left, Non-clickable) */}
            <span
              className={`text-[8px] font-black tracking-tight uppercase leading-none select-none pointer-events-none transition-colors ${
                activeIsOvrd ? 'text-amber-400 font-extrabold' : 'text-zinc-300'
              }`}
            >
              OVRD
            </span>

            {/* Horizontal (Sideways) Lever Toggle */}
            <div
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              onTouchCancel={handleMouseUp}
              onContextMenu={(e) => e.preventDefault()}
              title={`MANUAL PITCH: ${activeIsOvrd ? 'OVRD' : 'NORM'} (Press and hold left-click for OVRD)`}
              className={`mx-1 select-none ${
                allowSwitchClick ? 'cursor-pointer active:scale-95' : 'cursor-default'
              }`}
            >
              <HorizontalMpoToggle isOvrd={activeIsOvrd} />
            </div>

            {/* NORM Label (Right, Inactive State) */}
            <span
              className={`text-[8px] font-black tracking-tight uppercase leading-none select-none ${
                !activeIsOvrd ? 'text-zinc-200' : 'text-zinc-500'
              }`}
            >
              NORM
            </span>
          </div>

          {/* Lower Horizontal Wire Loop Guard */}
          <div
            className="w-14 h-1.5 rounded-full border border-zinc-500/80 bg-gradient-to-b from-zinc-400 via-zinc-200 to-zinc-500 shadow-sm mt-1 pointer-events-none"
            style={{
              boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          />
        </div>

        {/* Bottom Alignment Cross (+) and Fasteners Area */}
        <div className="flex items-center justify-center mb-2 pointer-events-none select-none">
          <span className="text-zinc-600 font-bold text-[11px] leading-none opacity-60">+</span>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Horizontal (Sideways) MPO Toggle Switch Component                          */
/* -------------------------------------------------------------------------- */

interface HorizontalMpoToggleProps {
  isOvrd: boolean;
}

const HorizontalMpoToggle: React.FC<HorizontalMpoToggleProps> = ({ isOvrd }) => {
  // isOvrd = true (points LEFT towards OVRD)
  // isOvrd = false (points RIGHT towards NORM)
  const shaftTransform = isOvrd
    ? 'translate(-44px, -50%) scaleX(1.05)'
    : 'translate(4px, -50%) scaleX(1.05)';

  const ballTransform = isOvrd
    ? 'translate(-42px, -50%)'
    : 'translate(14px, -50%)';

  const ballShadow = isOvrd
    ? '-10px 0 12px rgba(0,0,0,0.7), inset 2px 0 3px rgba(255,255,255,0.9)'
    : '10px 0 12px rgba(0,0,0,0.7), inset -2px 0 3px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-10 h-10 flex items-center justify-center select-none will-change-transform">
      {/* Outer socket bezel ring with horizontal stepped radial lighting */}
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

      {/* Lever Parts (Horizontal Dark Shaft & Metallic Bat Tip) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="absolute left-1/2 top-1/2 w-9 h-3 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center center',
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
