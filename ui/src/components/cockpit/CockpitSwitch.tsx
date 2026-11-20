'use client';

import React from 'react';

/* -------------------------------------------------------------------------- */
/* Common Bezel & Socket Styles (Concentric Stepped Rings)                   */
/* -------------------------------------------------------------------------- */

const SOCKET_BEZEL_STYLE: React.CSSProperties = {
  backgroundImage: `
    radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
    radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
    radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
    radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
    radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%)
  `,
  boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
};

const TIP_BACKGROUND = `
  radial-gradient(35% 25% at 50% 25%, rgb(136, 136, 153) 20%, rgba(136, 136, 153, 0)),
  radial-gradient(1em 0.75em at 32% 75%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
  radial-gradient(1em 0.75em at 65% 78%, rgb(102, 102, 102), rgba(102, 102, 102, 0)),
  radial-gradient(100% 100% at center, rgb(68, 68, 68) 49.5%, rgba(68, 68, 68, 0) 50%)
`;

/* -------------------------------------------------------------------------- */
/* Standard 2-Way Lever Switch Component                                      */
/* -------------------------------------------------------------------------- */

export interface CockpitTwoWaySwitchProps {
  isUp: boolean;
  isRedCollar?: boolean;
  className?: string;
}

export const CockpitTwoWaySwitch: React.FC<CockpitTwoWaySwitchProps> = ({
  isUp,
  isRedCollar = false,
  className = '',
}) => {
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
    <div className={`relative w-10 h-10 flex items-center justify-center select-none will-change-transform ${className}`}>
      {/* Outer socket bezel ring */}
      <div
        className="w-9 h-9 rounded-full border border-black/50 shadow-inner z-0"
        style={SOCKET_BEZEL_STYLE}
      />

      {/* Red accent collar variation (e.g., for FLCS RESET) */}
      {isRedCollar && (
        <div className="absolute w-5 h-5 rounded-full border border-red-950/80 bg-red-900/60 pointer-events-none" />
      )}

      {/* Lever Parts (Shaft & Tip) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Lever Shaft */}
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />

        {/* Lever Bat Handle Tip / Shadow */}
        <div
          className="absolute left-1/2 top-1/2 w-4.5 h-4.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
          style={{
            background: TIP_BACKGROUND,
            transform: ballTransform,
            boxShadow: ballShadow,
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Standard 3-Way Lever Switch Component                                      */
/* -------------------------------------------------------------------------- */

export type ThreeWaySwitchPosition = 'UP' | 'CENTER' | 'DOWN';

export interface CockpitThreeWaySwitchProps {
  position: ThreeWaySwitchPosition;
  isRedCollar?: boolean;
  className?: string;
}

export const CockpitThreeWaySwitch: React.FC<CockpitThreeWaySwitchProps> = ({
  position,
  isRedCollar = false,
  className = '',
}) => {
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
    <div className={`relative w-10 h-10 flex items-center justify-center select-none will-change-transform ${className}`}>
      {/* Outer socket bezel ring */}
      <div
        className="w-9 h-9 rounded-full border border-black/50 shadow-inner z-0"
        style={SOCKET_BEZEL_STYLE}
      />

      {/* Red accent collar variation */}
      {isRedCollar && (
        <div className="absolute w-5 h-5 rounded-full border border-red-950/80 bg-red-900/60 pointer-events-none" />
      )}

      {/* Lever Parts (Shaft & Tip) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Lever Shaft */}
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />

        {/* Lever Bat Handle Tip / Shadow */}
        <div
          className="absolute left-1/2 top-1/2 w-4.5 h-4.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
          style={{
            background: TIP_BACKGROUND,
            transform: ballTransform,
            boxShadow: ballShadow,
          }}
        />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Unified Switch Component (Accepts either 2-way or 3-way properties)         */
/* -------------------------------------------------------------------------- */

export type CockpitToggleSwitchProps =
  | ({ ways?: 2 } & CockpitTwoWaySwitchProps)
  | ({ ways: 3 } & CockpitThreeWaySwitchProps);

export const CockpitToggleSwitch: React.FC<CockpitToggleSwitchProps> = (props) => {
  if (props.ways === 3) {
    return <CockpitThreeWaySwitch {...props} />;
  }
  return <CockpitTwoWaySwitch {...props} />;
};
