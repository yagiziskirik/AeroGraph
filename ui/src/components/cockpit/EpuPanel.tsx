'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';

export type EpuSwitchPosition = 'OFF' | 'NORM' | 'ON';

export interface EpuPanelLights {
  hydrazn?: boolean;
  air?: boolean;
  runLight?: boolean; // Green EPU run indicator
}

export interface EpuPanelProps {
  switchPosition?: EpuSwitchPosition;
  onSwitchChange?: (position: EpuSwitchPosition) => void;
  lights?: EpuPanelLights;
  onLightClick?: (lightKey: keyof EpuPanelLights) => void;
  allowLightInteractivity?: boolean; // Hover and click on lights (default: false)
  allowSwitchClick?: boolean | { epuSwitch?: boolean }; // Global or per-switch toggle interactivity
  enabledSwitches?: { epuSwitch?: boolean }; // Per-switch enabled overrides
  className?: string;
}

export const EpuPanel: React.FC<EpuPanelProps> = ({
  switchPosition: controlledSwitchPosition,
  onSwitchChange,
  lights: controlledLights,
  onLightClick,
  allowLightInteractivity = false,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  // Helper to determine if the EPU switch is allowed to be clicked
  const isSwitchAllowed = (key: 'epuSwitch' = 'epuSwitch'): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  // Internal switch position if uncontrolled (default: NORM)
  const [internalSwitchPosition, setInternalSwitchPosition] = useState<EpuSwitchPosition>('NORM');
  const activeSwitchPosition =
    controlledSwitchPosition !== undefined ? controlledSwitchPosition : internalSwitchPosition;

  // Default lights: off by default
  const defaultLights: EpuPanelLights = {
    hydrazn: false,
    air: false,
    runLight: false,
  };

  // Internal light overrides when clicked in interactive mode
  const [internalLightOverrides, setInternalLightOverrides] = useState<EpuPanelLights>({});

  // Compute active lights
  const activeLights: EpuPanelLights = {
    ...defaultLights,
    ...internalLightOverrides,
    ...(controlledLights || {}),
  };

  // Switch Position Setter
  const setSwitchPosition = (newPos: EpuSwitchPosition) => {
    if (!isSwitchAllowed('epuSwitch')) return;
    if (activeSwitchPosition === newPos) return;
    Sound.playSwitch();
    if (onSwitchChange) {
      onSwitchChange(newPos);
    } else {
      setInternalSwitchPosition(newPos);
    }
  };

  // Forward cycle (Left click): OFF -> NORM -> ON (clamped, no loop)
  const handleForwardCycle = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isSwitchAllowed('epuSwitch')) return;

    if (activeSwitchPosition === 'OFF') {
      setSwitchPosition('NORM');
    } else if (activeSwitchPosition === 'NORM') {
      setSwitchPosition('ON');
    }
  };

  // Backward cycle (Right click): ON -> NORM -> OFF (clamped, no loop)
  const handleBackwardCycle = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isSwitchAllowed('epuSwitch')) return;

    if (activeSwitchPosition === 'ON') {
      setSwitchPosition('NORM');
    } else if (activeSwitchPosition === 'NORM') {
      setSwitchPosition('OFF');
    }
  };

  // Handle Light Click
  const handleLightUnitClick = (key: keyof EpuPanelLights) => {
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
      {/* Authentic Avionics EPU Panel Chassis - Narrowed down to 148px */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 w-[148px] min-w-[148px] max-w-[148px] text-zinc-300 font-mono select-none"
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
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Bottom Centered Decorative Dark Phillips Screw */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Panel Content Layout */}
        <div className="flex flex-col pt-3 pb-2 relative">
          {/* Top Section: HYDRAZN / AIR Warning Light Centered Horizontally, Lowered Towards Center */}
          <div className="flex justify-center w-full mt-2 mb-2">
            <StrictSquareDualLight
              topLabel="HYDRAZN"
              topIsOn={!!activeLights.hydrazn}
              onTopClick={() => handleLightUnitClick('hydrazn')}
              bottomLabel="AIR"
              bottomIsOn={!!activeLights.air}
              onBottomClick={() => handleLightUnitClick('air')}
              allowInteractivity={allowLightInteractivity}
            />
          </div>

          {/* Middle Section: Vertical EPU Text (Lowered closer to center, slightly above middle) + Green Run Light on Right */}
          <div className="flex items-center justify-between px-1 my-2">
            {/* Vertical EPU Text & Floating (+) Symbol placed just above the middle level */}
            <div className="flex flex-col items-center justify-center pl-0.5 select-none w-4">
              <span className="text-[13px] font-black tracking-[0.4em] text-zinc-300 leading-[1.7] flex flex-col items-center">
                <span>E</span>
                <span>P</span>
                <span>U</span>
              </span>

              {/* Floating (+) symbol below EPU */}
              <span className="text-zinc-500 font-bold text-[10px] leading-none mt-2">
                +
              </span>
            </div>

            {/* Green EPU Run Light shifted to the Right edge */}
            <div className="flex justify-end pr-1">
              <div
                onClick={() => handleLightUnitClick('runLight')}
                title={`EPU RUN: ${activeLights.runLight ? 'ACTIVE' : 'OFF'}`}
                className={`relative w-8 h-8 rounded-full bg-[#15161a] border-2 border-[#090a0d] shadow-inner flex items-center justify-center ${
                  allowLightInteractivity ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(255,255,255,0.06)',
                }}
              >
                {/* Outer Conical Bezel Ring */}
                <div className="absolute inset-0.5 rounded-full border border-black/70 bg-[#121316]" />

                {/* Green Lens (20px) */}
                <div
                  className={`relative w-5 h-5 rounded-full transition-[background-color,box-shadow] duration-150 will-change-transform ${
                    activeLights.runLight
                      ? 'bg-[#22c55e] shadow-[0_0_12px_#22c55e,0_0_22px_rgba(34,197,94,0.8)]'
                      : 'bg-[#082012] border border-[#041208] shadow-inner'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Bottom Section: Guarded Switch on Left with Closer NORM Tag */}
          <div className="flex items-center justify-start pl-0.5 mt-1 mb-1">
            {/* Switch Column */}
            <div className="flex flex-col items-center w-[74px]">
              {/* ON Label (Top) - Non-clickable */}
              <span
                className={`text-[10px] font-black tracking-wider uppercase transition-colors text-center whitespace-nowrap select-none pointer-events-none ${
                  activeSwitchPosition === 'ON'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-200'
                }`}
              >
                ON
              </span>

              {/* Guarded Switch & Closer NORM Tag */}
              <div className="relative flex items-center justify-center w-full my-0.5">
                {/* Switch with Custom Center-Flush Left-Hinged Red Flap Guards */}
                <div
                  onMouseDown={(e) => {
                    if (e.button === 0) {
                      e.preventDefault();
                      handleForwardCycle(e);
                    } else if (e.button === 2) {
                      e.preventDefault();
                      handleBackwardCycle(e);
                    }
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  title={
                    isSwitchAllowed('epuSwitch')
                      ? `EPU Switch: ${activeSwitchPosition}. Left-click forward (UP), Right-click backward (DOWN).`
                      : `EPU Switch: ${activeSwitchPosition}`
                  }
                  className={isSwitchAllowed('epuSwitch') ? 'cursor-pointer select-none active:scale-95' : 'cursor-default select-none'}
                >
                  <CenterFlushGuardedSwitch position={activeSwitchPosition} />
                </div>

                {/* NORM Tag positioned directly adjacent to the switch */}
                <div className="absolute -right-5 flex items-center pointer-events-none select-none">
                  <span
                    className={`text-[10px] font-black tracking-wider uppercase transition-colors ${
                      activeSwitchPosition === 'NORM'
                        ? 'text-amber-400 font-extrabold'
                        : 'text-zinc-200'
                    }`}
                  >
                    NORM
                  </span>
                </div>
              </div>

              {/* OFF Label (Bottom) - Non-clickable */}
              <span
                className={`text-[10px] font-black tracking-wider uppercase transition-colors text-center select-none pointer-events-none ${
                  activeSwitchPosition === 'OFF'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-200'
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

/* -------------------------------------------------------------------------- */
/* Center-Flush Left-Hinged Dual Red Guard Switch Component                   */
/* -------------------------------------------------------------------------- */

interface CenterFlushGuardedSwitchProps {
  position: EpuSwitchPosition;
}

const CenterFlushGuardedSwitch: React.FC<CenterFlushGuardedSwitchProps> = ({ position }) => {
  // Lever shaft and ball transforms based on position
  const shaftTransform =
    position === 'ON'
      ? 'translate(-50%, -46px) scaleY(1.1)'
      : position === 'OFF'
      ? 'translate(-50%, 4px) scaleY(1.1)'
      : 'translate(-50%, -24px) scaleY(0.7)';

  const ballTransform =
    position === 'ON'
      ? 'translate(-50%, -44px)'
      : position === 'OFF'
      ? 'translate(-50%, 14px)'
      : 'translate(-50%, -16px)';

  const ballShadow =
    position === 'ON'
      ? '0 12px 14px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
      : position === 'OFF'
      ? '0 -12px 14px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)'
      : '0 4px 10px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.9)';

  const topFlapOpen = position === 'ON';
  const bottomFlapOpen = position === 'OFF';

  return (
    <div className="relative w-16 h-16 flex items-center justify-center select-none will-change-transform">
      {/* Top Red Guard Flap */}
      <div
        className="absolute top-[2px] left-0 transition-all duration-200 ease-out z-20 pointer-events-none will-change-transform"
        style={{
          width: '56px',
          height: '30px',
          transform: topFlapOpen
            ? 'perspective(260px) rotateY(-74deg) skewY(-6deg) scaleX(0.72) translateY(-4px)'
            : 'perspective(260px) rotateY(0deg) translateY(0)',
          transformOrigin: 'left center',
          opacity: topFlapOpen ? 0.85 : 1,
        }}
      >
        <div
          className="w-full h-full relative"
          style={{
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 38% 60%, 38% 100%, 0% 100%)',
            background: topFlapOpen
              ? 'linear-gradient(to right, #7f1d1d, #991b1b 60%, rgba(185, 28, 28, 0.4))'
              : 'linear-gradient(to right, #4c0d0d, #701414 15%, #991b1b 55%, #7a1515 85%, #520f0f)',
            boxShadow: topFlapOpen
              ? '-4px -6px 14px rgba(0,0,0,0.8), inset 0 1px 2px rgba(255,255,255,0.4)'
              : '0 3px 6px rgba(0,0,0,0.65), inset 0 1px 2px rgba(255,255,255,0.3)',
            border: '1px solid #3b0808',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-red-400/80" />
          <div className="absolute bottom-0 left-0 w-[38%] h-[1px] bg-black/70 shadow-[0_-1px_0_rgba(255,255,255,0.08)]" />
          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#2d0707] border-r border-[#4c0d0d] flex flex-col justify-center items-center py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 border border-black/80" />
          </div>
        </div>
      </div>

      {/* Socket Bezel Ring */}
      <div
        className="w-11 h-11 rounded-full border border-black/40 shadow-inner z-0"
        style={{
          backgroundImage: `
            radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
            radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
            radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 43% 56%, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 55% 57%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
            radial-gradient(0.5em 0.4em at 50% 60%, rgba(255, 255, 255, 0.6), rgba(255, 255, 255, 0)),
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgba(221, 221, 221) 0 30%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgba(221, 221, 221) 0 41%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%)
          `,
          boxShadow: '0 4px 8px rgba(0,0,0,0.7)',
        }}
      />

      {/* Lever Parts (Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
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

      {/* Bottom Red Guard Flap */}
      <div
        className="absolute top-[32px] left-0 transition-all duration-200 ease-out z-20 pointer-events-none will-change-transform"
        style={{
          width: '56px',
          height: '30px',
          transform: bottomFlapOpen
            ? 'perspective(260px) rotateY(-74deg) skewY(6deg) scaleX(0.72) translateY(4px)'
            : 'perspective(260px) rotateY(0deg) translateY(0)',
          transformOrigin: 'left center',
          opacity: bottomFlapOpen ? 0.85 : 1,
        }}
      >
        <div
          className="w-full h-full relative"
          style={{
            clipPath: 'polygon(0% 0%, 38% 0%, 38% 40%, 100% 40%, 100% 100%, 0% 100%)',
            background: bottomFlapOpen
              ? 'linear-gradient(to right, #7f1d1d, #991b1b 60%, rgba(185, 28, 28, 0.4))'
              : 'linear-gradient(to right, #4c0d0d, #701414 15%, #991b1b 55%, #7a1515 85%, #520f0f)',
            boxShadow: bottomFlapOpen
              ? '-4px 6px 14px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.4)'
              : '0 3px 6px rgba(0,0,0,0.65), inset 0 -1px 2px rgba(255,255,255,0.3)',
            border: '1px solid #3b0808',
          }}
        >
          <div className="absolute top-0 left-0 w-[38%] h-[1px] bg-red-400/50 shadow-[0_1px_0_rgba(0,0,0,0.8)]" />
          <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#2d0707]" />
          <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#2d0707] border-r border-[#4c0d0d] flex flex-col justify-center items-center py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 border border-black/80" />
          </div>
        </div>
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
        onClick={allowInteractivity && topLabel ? onTopClick : undefined}
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
        onClick={allowInteractivity && bottomLabel ? onBottomClick : undefined}
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
