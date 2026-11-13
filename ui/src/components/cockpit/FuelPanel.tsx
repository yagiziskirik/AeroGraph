'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';

export type FuelMasterPosition = 'MASTER' | 'OFF';
export type TankInertingPosition = 'TANK_INERTING' | 'OFF';
export type EngFeedPosition = 'OFF' | 'NORM' | 'AFT' | 'FWD';
export type AirRefuelPosition = 'OPEN' | 'CLOSE';

export interface FuelPanelSwitches {
  master?: FuelMasterPosition;
  tankInerting?: TankInertingPosition;
  engFeed?: EngFeedPosition;
  airRefuel?: AirRefuelPosition;
}

export interface FuelPanelProps {
  switches?: FuelPanelSwitches;
  onSwitchChange?: (key: keyof FuelPanelSwitches, value: any) => void;
  // Convenience individual handlers / controlled values
  master?: FuelMasterPosition;
  onMasterChange?: (pos: FuelMasterPosition) => void;
  tankInerting?: TankInertingPosition;
  onTankInertingChange?: (pos: TankInertingPosition) => void;
  engFeed?: EngFeedPosition;
  onEngFeedChange?: (pos: EngFeedPosition) => void;
  airRefuel?: AirRefuelPosition;
  onAirRefuelChange?: (pos: AirRefuelPosition) => void;
  allowSwitchClick?: boolean | Partial<Record<keyof FuelPanelSwitches, boolean>>;
  enabledSwitches?: Partial<Record<keyof FuelPanelSwitches, boolean>>;
  className?: string;
}

export const FuelPanel: React.FC<FuelPanelProps> = ({
  switches: controlledSwitches,
  onSwitchChange,
  master: controlledMaster,
  onMasterChange,
  tankInerting: controlledTankInerting,
  onTankInertingChange,
  engFeed: controlledEngFeed,
  onEngFeedChange,
  airRefuel: controlledAirRefuel,
  onAirRefuelChange,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  // Internal uncontrolled state
  const [internalSwitches, setInternalSwitches] = useState<Required<FuelPanelSwitches>>({
    master: 'MASTER',
    tankInerting: 'OFF',
    engFeed: 'NORM',
    airRefuel: 'CLOSE',
  });

  // Active state merged from props
  const activeMaster: FuelMasterPosition =
    controlledMaster !== undefined
      ? controlledMaster
      : controlledSwitches?.master !== undefined
      ? controlledSwitches.master
      : internalSwitches.master;

  const activeTankInerting: TankInertingPosition =
    controlledTankInerting !== undefined
      ? controlledTankInerting
      : controlledSwitches?.tankInerting !== undefined
      ? controlledSwitches.tankInerting
      : internalSwitches.tankInerting;

  const activeEngFeed: EngFeedPosition =
    controlledEngFeed !== undefined
      ? controlledEngFeed
      : controlledSwitches?.engFeed !== undefined
      ? controlledSwitches.engFeed
      : internalSwitches.engFeed;

  const activeAirRefuel: AirRefuelPosition =
    controlledAirRefuel !== undefined
      ? controlledAirRefuel
      : controlledSwitches?.airRefuel !== undefined
      ? controlledSwitches.airRefuel
      : internalSwitches.airRefuel;

  const isSwitchAllowed = (key: keyof FuelPanelSwitches): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  const setSwitch = (key: keyof FuelPanelSwitches, value: any) => {
    if (!isSwitchAllowed(key)) return;
    const currentValue =
      key === 'master'
        ? activeMaster
        : key === 'tankInerting'
        ? activeTankInerting
        : key === 'engFeed'
        ? activeEngFeed
        : activeAirRefuel;
    if (currentValue === value) return;

    Sound.playSwitch();
    if (onSwitchChange) {
      onSwitchChange(key, value);
    }
    // Fire individual callback if provided
    if (key === 'master' && onMasterChange) onMasterChange(value);
    if (key === 'tankInerting' && onTankInertingChange) onTankInertingChange(value);
    if (key === 'engFeed' && onEngFeedChange) onEngFeedChange(value);
    if (key === 'airRefuel' && onAirRefuelChange) onAirRefuelChange(value);

    // Update internal state
    setInternalSwitches((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Master switch interaction (guarded): Left-click = UP (MASTER), Right-click = DOWN (OFF)
  const isMasterGuardOpen = activeMaster === 'OFF';
  const handleMasterMouseDown = (e: React.MouseEvent) => {
    if (!isSwitchAllowed('master')) return;
    if (e.button === 0) {
      e.preventDefault();
      setSwitch('master', 'MASTER');
    } else if (e.button === 2) {
      e.preventDefault();
      setSwitch('master', 'OFF');
    }
  };

  // Tank Inerting switch interaction: Left-click = UP (TANK_INERTING), Right-click = DOWN (OFF)
  const handleTankInertingMouseDown = (e: React.MouseEvent) => {
    if (!isSwitchAllowed('tankInerting')) return;
    if (e.button === 0) {
      e.preventDefault();
      setSwitch('tankInerting', 'TANK_INERTING');
    } else if (e.button === 2) {
      e.preventDefault();
      setSwitch('tankInerting', 'OFF');
    }
  };

  // Engine Feed Rotary steps (Left-click steps forward/clockwise, Right-click steps back/counter-clockwise, stops at ends)
  const engFeedPositions: EngFeedPosition[] = ['OFF', 'NORM', 'AFT', 'FWD'];
  const stepEngFeedClockwise = () => {
    const currentIndex = engFeedPositions.indexOf(activeEngFeed);
    if (currentIndex < engFeedPositions.length - 1) {
      setSwitch('engFeed', engFeedPositions[currentIndex + 1]);
    }
  };
  const stepEngFeedCounterClockwise = () => {
    const currentIndex = engFeedPositions.indexOf(activeEngFeed);
    if (currentIndex > 0) {
      setSwitch('engFeed', engFeedPositions[currentIndex - 1]);
    }
  };

  // Air Refuel switch interaction: Left-click = UP (OPEN), Right-click = DOWN (CLOSE)
  const handleAirRefuelMouseDown = (e: React.MouseEvent) => {
    if (!isSwitchAllowed('airRefuel')) return;
    if (e.button === 0) {
      e.preventDefault();
      setSwitch('airRefuel', 'OPEN');
    } else if (e.button === 2) {
      e.preventDefault();
      setSwitch('airRefuel', 'CLOSE');
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 pt-3 pb-3 w-[370px] min-w-[370px] max-w-[370px] text-zinc-300 font-mono select-none flex flex-col"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Slotted Outer Cockpit Fasteners (4 Corners) */}
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

        {/* Interior Cockpit Black Screws (Matched from F-16 Manual Artwork) */}
        <div className="absolute top-3 left-[92px] w-2.5 h-2.5 rounded-full bg-[#18191c] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-600 rotate-90" />
          <div className="absolute w-1.5 h-[1px] bg-zinc-600" />
        </div>
        <div className="absolute bottom-2.5 right-[88px] w-2.5 h-2.5 rounded-full bg-[#18191c] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-600 rotate-45" />
          <div className="absolute w-1.5 h-[1px] bg-zinc-600 -rotate-45" />
        </div>

        {/* 4-Column Controls Layout */}
        <div className="grid grid-cols-4 items-center gap-1.5 px-1 py-0.5">
          {/* COLUMN 1: FUEL Vertical Title + Guarded MASTER Switch */}
          <div className="flex items-center justify-center space-x-1.5 pl-0.5">
            {/* FUEL Stacked Vertical Letters */}
            <div className="flex flex-col items-center justify-center space-y-0.5 text-zinc-300 font-mono font-black text-[10px] leading-tight select-none pointer-events-none pr-1">
              <span>F</span>
              <span>U</span>
              <span>E</span>
              <span>L</span>
            </div>

            {/* MASTER Guarded Lever Unit */}
            <div className="flex flex-col items-center w-[54px]">
              <span
                onClick={() => isSwitchAllowed('master') && setSwitch('master', 'MASTER')}
                className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none ${
                  activeMaster === 'MASTER'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-300'
                } ${isSwitchAllowed('master') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'}`}
              >
                MASTER
              </span>

              {/* Guarded Switch Housing */}
              <div className="relative flex items-center justify-center my-0.5">
                {/* Underlying Lever Switch */}
                <div
                  onMouseDown={handleMasterMouseDown}
                  onContextMenu={(e) => e.preventDefault()}
                  title={`FUEL MASTER: ${activeMaster} (Left-click for MASTER, Right-click for OFF)`}
                  className={`relative z-10 ${
                    isSwitchAllowed('master')
                      ? 'cursor-pointer select-none active:scale-95'
                      : 'cursor-default select-none'
                  }`}
                >
                  <CockpitLeverSwitch position={activeMaster} />
                </div>

                {/* Red Switch Guard */}
                <div
                  className="absolute z-20 pointer-events-none select-none transition-transform duration-250 ease-out will-change-transform"
                  style={{
                    top: '6px',
                    width: '46px',
                    height: '74px',
                    transformOrigin: 'center bottom',
                    transform: isMasterGuardOpen
                      ? 'perspective(280px) rotateX(76deg) translateY(14px) scaleY(0.68)'
                      : 'perspective(280px) rotateX(0deg) translateY(0)',
                    boxShadow: isMasterGuardOpen
                      ? '0 10px 16px rgba(0,0,0,0.85)'
                      : '0 4px 10px rgba(0,0,0,0.7)',
                  }}
                >
                  <div
                    className="w-full h-full relative border border-[#3b0808] rounded-xs"
                    style={{
                      clipPath:
                        'polygon(0% 0%, 24% 0%, 24% 37%, 76% 37%, 76% 0%, 100% 0%, 100% 100%, 0% 100%)',
                      background: isMasterGuardOpen
                        ? 'linear-gradient(to bottom, rgba(139, 24, 24, 0.95), #6b1414 70%, #4a0e0e)'
                        : 'linear-gradient(to right, #4c0d0d, #701414 15%, #991b1b 50%, #701414 85%, #4c0d0d)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)',
                    }}
                  >
                    <div className="absolute top-0 left-0 w-[11px] h-[2px] bg-red-400/80" />
                    <div className="absolute top-0 right-0 w-[11px] h-[2px] bg-red-400/80" />

                    <div className="absolute top-[27px] left-[11px] right-[11px] h-[1.5px] bg-red-400/60 border-b border-[#3b0808]" />

                    <div className="absolute top-[46px] left-1/2 -translate-x-1/2 w-5 h-[1px] bg-red-950/80 shadow-[0_1px_0_rgba(255,255,255,0.15)] pointer-events-none" />

                    <div className="absolute bottom-0 left-0 right-0 h-[7px] bg-[#290505] border-t border-[#3b0808] flex items-center justify-between px-1">
                      <div className="w-1.5 h-1 rounded-xs bg-[#400909] border border-black/80" />
                      <div className="flex-1 h-[1.5px] bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-500 mx-1 rounded-full shadow-sm" />
                      <div className="w-1.5 h-1 rounded-xs bg-[#400909] border border-black/80" />
                    </div>
                  </div>
                </div>
              </div>

              <span
                onClick={() => isSwitchAllowed('master') && setSwitch('master', 'OFF')}
                className={`text-[9px] font-black tracking-wider uppercase transition-colors text-center select-none ${
                  activeMaster === 'OFF'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-300'
                } ${isSwitchAllowed('master') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'}`}
              >
                OFF
              </span>
            </div>
          </div>

          {/* COLUMN 2: TANK INERTING Switch */}
          <div className="flex flex-col items-center justify-center w-full">
            <div
              onClick={() => isSwitchAllowed('tankInerting') && setSwitch('tankInerting', 'TANK_INERTING')}
              className={`flex flex-col items-center text-center select-none ${
                isSwitchAllowed('tankInerting') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'
              }`}
            >
              <span
                className={`text-[8.5px] font-black tracking-tight uppercase leading-tight ${
                  activeTankInerting === 'TANK_INERTING'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-300'
                }`}
              >
                TANK
              </span>
              <span
                className={`text-[8.5px] font-black tracking-tight uppercase leading-tight ${
                  activeTankInerting === 'TANK_INERTING'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-300'
                }`}
              >
                INERTING
              </span>
            </div>

            <div
              onMouseDown={handleTankInertingMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              title={`TANK INERTING: ${activeTankInerting === 'TANK_INERTING' ? 'INERTING' : 'OFF'} (Left-click for INERTING, Right-click for OFF)`}
              className={`my-1 select-none ${
                isSwitchAllowed('tankInerting')
                  ? 'cursor-pointer active:scale-95'
                  : 'cursor-default'
              }`}
            >
              <VerticalLeverToggle isUp={activeTankInerting === 'TANK_INERTING'} />
            </div>

            <span
              onClick={() => isSwitchAllowed('tankInerting') && setSwitch('tankInerting', 'OFF')}
              className={`text-[9px] font-black tracking-wider uppercase text-center select-none ${
                activeTankInerting === 'OFF'
                  ? 'text-amber-400 font-extrabold'
                  : 'text-zinc-300'
              } ${isSwitchAllowed('tankInerting') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'}`}
            >
              OFF
            </span>
          </div>

          {/* COLUMN 3: ENG FEED Rotary Switch with Pointer & Tail */}
          <div className="flex flex-col items-center justify-center w-full">
            <div
              onMouseDown={(e) => {
                if (e.button === 0) {
                  e.preventDefault();
                  stepEngFeedClockwise();
                } else if (e.button === 2) {
                  e.preventDefault();
                  stepEngFeedCounterClockwise();
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              title={`ENG FEED: ${activeEngFeed} (Left-click step clockwise, Right-click step counter-clockwise)`}
              className={`select-none ${
                isSwitchAllowed('engFeed')
                  ? 'cursor-pointer'
                  : 'cursor-default'
              }`}
            >
              <EngFeedDial
                position={activeEngFeed}
                onSelectPosition={(pos) => setSwitch('engFeed', pos)}
                allowClick={isSwitchAllowed('engFeed')}
              />
            </div>
          </div>

          {/* COLUMN 4: AIR REFUEL Switch */}
          <div className="flex flex-col items-center justify-center w-full pr-1">
            <div
              onClick={() => isSwitchAllowed('airRefuel') && setSwitch('airRefuel', 'OPEN')}
              className={`flex flex-col items-center text-center select-none ${
                isSwitchAllowed('airRefuel') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'
              }`}
            >
              <span className="text-[8.5px] font-black tracking-tight uppercase leading-tight text-zinc-300">
                AIR REFUEL
              </span>
              <span
                className={`text-[9px] font-black tracking-wider uppercase leading-tight ${
                  activeAirRefuel === 'OPEN'
                    ? 'text-amber-400 font-extrabold'
                    : 'text-zinc-300'
                }`}
              >
                OPEN
              </span>
            </div>

            <div
              onMouseDown={handleAirRefuelMouseDown}
              onContextMenu={(e) => e.preventDefault()}
              title={`AIR REFUEL: ${activeAirRefuel} (Left-click for OPEN, Right-click for CLOSE)`}
              className={`my-1 select-none ${
                isSwitchAllowed('airRefuel')
                  ? 'cursor-pointer active:scale-95'
                  : 'cursor-default'
              }`}
            >
              <VerticalLeverToggle isUp={activeAirRefuel === 'OPEN'} />
            </div>

            <span
              onClick={() => isSwitchAllowed('airRefuel') && setSwitch('airRefuel', 'CLOSE')}
              className={`text-[9px] font-black tracking-wider uppercase text-center select-none ${
                activeAirRefuel === 'CLOSE'
                  ? 'text-amber-400 font-extrabold'
                  : 'text-zinc-300'
              } ${isSwitchAllowed('airRefuel') ? 'cursor-pointer hover:text-white' : 'pointer-events-none'}`}
            >
              CLOSE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 1. Cockpit Lever Switch (For Guarded MASTER Switch)                         */
/* -------------------------------------------------------------------------- */

interface CockpitLeverSwitchProps {
  position: FuelMasterPosition;
}

const CockpitLeverSwitch: React.FC<CockpitLeverSwitchProps> = ({ position }) => {
  const isUp = position === 'MASTER';
  const isDown = position === 'OFF';

  const shaftTransform = isUp
    ? 'translate(-50%, -46px) scaleY(1.05)'
    : isDown
    ? 'translate(-50%, 4px) scaleY(1.05)'
    : 'translate(-50%, -24px) scaleY(0.7)';

  const ballTransform = isUp
    ? 'translate(-50%, -44px)'
    : isDown
    ? 'translate(-50%, 14px)'
    : 'translate(-50%, -16px)';

  const ballShadow = isUp
    ? '0 12px 14px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
    : isDown
    ? '0 -12px 14px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)'
    : '0 4px 10px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center select-none will-change-transform">
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
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68, 0) 35.5%, rgb(221, 221, 221) 0 41%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85, 0) 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%)
          `,
          boxShadow: '0 4px 8px rgba(0,0,0,0.7)',
        }}
      />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute left-1/2 top-1/2 w-3.5 h-10 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 6px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />

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
/* 2. Vertical 2-Way Lever Switch (BIT Switch for TANK INERTING & AIR REFUEL) */
/* -------------------------------------------------------------------------- */

interface VerticalLeverToggleProps {
  isUp: boolean;
}

const VerticalLeverToggle: React.FC<VerticalLeverToggleProps> = ({ isUp }) => {
  const shaftTransform = isUp
    ? 'translate(-50%, -42px) scaleY(1.05)'
    : 'translate(-50%, 2px) scaleY(1.05)';

  const ballTransform = isUp
    ? 'translate(-50%, -40px)'
    : 'translate(-50%, 12px)';

  const ballShadow = isUp
    ? '0 10px 12px rgba(0,0,0,0.7), inset 0 2px 3px rgba(255,255,255,0.9)'
    : '0 -10px 12px rgba(0,0,0,0.7), inset 0 -2px 3px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-10 h-10 flex items-center justify-center select-none will-change-transform">
      {/* Outer socket bezel ring */}
      <div
        className="w-9 h-9 rounded-full border border-black/50 shadow-inner z-0"
        style={{
          backgroundImage: `
            radial-gradient(1em 1.5em at 50% 50%, rgb(204, 204, 204) 25%, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%),
            radial-gradient(0.65em 1em at 50% 53%, rgb(68, 68, 68), rgba(68, 68, 68, 0)),
            radial-gradient(0.75em 0.75em at 55% 45%, rgb(255, 255, 255), rgba(255, 255, 255, 0)),
            radial-gradient(100% 100% at 50% 50%, rgb(238, 238, 238), rgb(170, 170, 170) 10%, rgb(0, 0, 0) 18%, rgb(0, 0, 0) 21%, rgb(153, 153, 153) 21.5%, rgb(153, 153, 153) 24%, rgba(153, 153, 153, 0) 24.5%, rgb(221, 221, 221) 30.5%, rgb(221, 221, 221) 33%, rgb(68, 68, 68) 33.5%, rgb(68, 68, 68) 35%, rgba(68, 68, 68) 0 35.5%, rgb(221, 221, 221) 41.5%, rgb(238, 238, 238) 45%, rgb(68, 68, 85) 45.5%, rgb(68, 68, 85) 49%, rgba(68, 68, 85) 0 50%),
            radial-gradient(100% 100% at center, rgb(170, 170, 170) 49%, rgba(170, 170, 170, 0) 50%)
          `,
          boxShadow: '0 3px 6px rgba(0,0,0,0.7)',
        }}
      />

      {/* Lever Parts (Shaft & Ball) */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div
          className="absolute left-1/2 top-1/2 w-3 h-9 rounded-full border border-[#444] transition-transform duration-150 ease-out will-change-transform"
          style={{
            backgroundColor: '#2b2b2b',
            boxShadow: '0 0 5px #555 inset',
            transform: shaftTransform,
            transformOrigin: 'center bottom',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 w-4.5 h-4.5 rounded-full border border-zinc-400 transition-[transform,box-shadow] duration-150 ease-out will-change-transform z-10"
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
/* 3. ENG FEED Rotary Knob with Pointer and Tail                              */
/* -------------------------------------------------------------------------- */

interface EngFeedDialProps {
  position: EngFeedPosition;
  onSelectPosition?: (pos: EngFeedPosition) => void;
  allowClick?: boolean;
}

const EngFeedDial: React.FC<EngFeedDialProps> = ({
  position,
  onSelectPosition,
  allowClick = true,
}) => {
  // Mapping positions to continuous angles:
  // OFF:  -180° (Horizontal left / 9 o'clock)
  // NORM: -135° (Top-left / 10:30)
  // AFT:  -90°  (Straight UP / 12 o'clock)
  // FWD:  -45°  (Top-right / 1:30)
  const rotationMap: Record<EngFeedPosition, number> = {
    OFF: -180,
    NORM: -135,
    AFT: -90,
    FWD: -45,
  };

  const rotation = rotationMap[position] ?? -135;

  const cx = 50;
  const cy = 60;

  return (
    <svg
      viewBox="0 0 100 104"
      className="w-[104px] h-[104px] overflow-visible select-none"
    >
      <defs>
        {/* Base skirt radial metallic gradient - Light whitish-gray matching YAW TRIM */}
        <radialGradient id="engFeedSkirtGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#f4f4f5" />
          <stop offset="55%" stopColor="#d4d4d8" />
          <stop offset="85%" stopColor="#a1a1aa" />
          <stop offset="100%" stopColor="#71717a" />
        </radialGradient>

        {/* Raised Pointer & Tail Bar linear gradient - Light whitish-gray matching YAW TRIM */}
        <linearGradient id="engFeedBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#f4f4f5" />
          <stop offset="70%" stopColor="#d4d4d8" />
          <stop offset="100%" stopColor="#a1a1aa" />
        </linearGradient>

        {/* Drop shadow for 3D realism */}
        <filter id="engFeedDropShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.5" dy="2.5" stdDeviation="1.8" floodColor="#000" floodOpacity="0.75" />
        </filter>
      </defs>

      {/* Header: ENG FEED */}
      <text
        x="50"
        y="11"
        fill="#e4e4e7"
        fontSize="8.5"
        fontWeight="900"
        fontFamily="monospace"
        textAnchor="middle"
        className="select-none pointer-events-none"
      >
        ENG FEED
      </text>

      {/* Position 1: OFF (180° Horizontal Left) */}
      <g
        onClick={(e) => {
          if (!allowClick) return;
          e.stopPropagation();
          onSelectPosition?.('OFF');
        }}
        className={allowClick ? 'cursor-pointer' : 'cursor-default'}
      >
        <line
          x1="26"
          y1={cy}
          x2="33"
          y2={cy}
          stroke={position === 'OFF' ? '#fbbf24' : '#d4d4d8'}
          strokeWidth="1.2"
        />
        <text
          x="23"
          y={cy + 3}
          fill={position === 'OFF' ? '#fbbf24' : '#d4d4d8'}
          fontSize="8"
          fontWeight={position === 'OFF' ? '900' : '700'}
          fontFamily="monospace"
          textAnchor="end"
          className="select-none"
        >
          OFF
        </text>
      </g>

      {/* Position 2: NORM (135° Top-Left) with '+' crosshair */}
      <g
        onClick={(e) => {
          if (!allowClick) return;
          e.stopPropagation();
          onSelectPosition?.('NORM');
        }}
        className={allowClick ? 'cursor-pointer' : 'cursor-default'}
      >
        {/* Tick Mark */}
        <line
          x1="32.5"
          y1={cy - 17.5}
          x2="37.5"
          y2={cy - 12.5}
          stroke={position === 'NORM' ? '#fbbf24' : '#d4d4d8'}
          strokeWidth="1.2"
        />
        {/* Small '+' crosshair marker above NORM */}
        <text
          x="22"
          y={cy - 28}
          fill="#a1a1aa"
          fontSize="7"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          className="select-none pointer-events-none"
        >
          +
        </text>
        {/* NORM Label */}
        <text
          x="27"
          y={cy - 18}
          fill={position === 'NORM' ? '#fbbf24' : '#d4d4d8'}
          fontSize="8"
          fontWeight={position === 'NORM' ? '900' : '700'}
          fontFamily="monospace"
          textAnchor="end"
          className="select-none"
        >
          NORM
        </text>
      </g>

      {/* Position 3: AFT (90° Straight UP) */}
      <g
        onClick={(e) => {
          if (!allowClick) return;
          e.stopPropagation();
          onSelectPosition?.('AFT');
        }}
        className={allowClick ? 'cursor-pointer' : 'cursor-default'}
      >
        <line
          x1={cx}
          y1="34"
          x2={cx}
          y2="41"
          stroke={position === 'AFT' ? '#fbbf24' : '#d4d4d8'}
          strokeWidth="1.2"
        />
        <text
          x={cx}
          y="28"
          fill={position === 'AFT' ? '#fbbf24' : '#d4d4d8'}
          fontSize="8"
          fontWeight={position === 'AFT' ? '900' : '700'}
          fontFamily="monospace"
          textAnchor="middle"
          className="select-none"
        >
          AFT
        </text>
      </g>

      {/* Position 4: FWD (45° Top-Right) */}
      <g
        onClick={(e) => {
          if (!allowClick) return;
          e.stopPropagation();
          onSelectPosition?.('FWD');
        }}
        className={allowClick ? 'cursor-pointer' : 'cursor-default'}
      >
        <line
          x1="67.5"
          y1={cy - 17.5}
          x2="62.5"
          y2={cy - 12.5}
          stroke={position === 'FWD' ? '#fbbf24' : '#d4d4d8'}
          strokeWidth="1.2"
        />
        <text
          x="72"
          y={cy - 18}
          fill={position === 'FWD' ? '#fbbf24' : '#d4d4d8'}
          fontSize="8"
          fontWeight={position === 'FWD' ? '900' : '700'}
          fontFamily="monospace"
          textAnchor="start"
          className="select-none"
        >
          FWD
        </text>
      </g>

      {/* Base Circular Skirt */}
      <circle
        cx={cx}
        cy={cy}
        r="22.5"
        fill="url(#engFeedSkirtGrad)"
        stroke="#71717a"
        strokeWidth="1"
        filter="url(#engFeedDropShadow)"
      />
      <circle
        cx={cx}
        cy={cy}
        r="21.5"
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.7"
      />

      {/* Rotating Pointer with Rounded Tail */}
      <g
        transform={`rotate(${rotation}, ${cx}, ${cy})`}
        style={{ willChange: 'transform', transition: 'transform 90ms ease-out' }}
        filter="url(#engFeedDropShadow)"
      >
        {/* Main Bar Shape: Pointer on right (+X), rounded tail on left (-X) */}
        {/* Tip: (cx + 23, cy); Upper wedge: (cx + 17, cy - 5.5); Upper edge: (cx - 7, cy - 6.5); */}
        {/* Tail arc: A 6.5 6.5 0 0 0 (cx - 7, cy + 6.5); Lower edge: (cx + 17, cy + 5.5) */}
        <path
          d={`
            M ${cx - 7},${cy - 6.5}
            L ${cx + 17},${cy - 5.5}
            L ${cx + 23},${cy}
            L ${cx + 17},${cy + 5.5}
            L ${cx - 7},${cy + 6.5}
            A 6.5 6.5 0 0 1 ${cx - 7},${cy - 6.5}
            Z
          `}
          fill="url(#engFeedBarGrad)"
          stroke="#71717a"
          strokeWidth="0.8"
        />

        {/* Top Highlight Chamfer */}
        <path
          d={`
            M ${cx - 6},${cy - 5}
            L ${cx + 15.5},${cy - 4}
            L ${cx + 20.5},${cy}
            L ${cx + 15.5},${cy + 4}
            L ${cx - 6},${cy + 5}
            A 5 5 0 0 1 ${cx - 6},${cy - 5}
            Z
          `}
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="0.6"
        />

        {/* White Indicator Stripe with Crisp Black Border along the Pointer */}
        <line
          x1={cx + 1}
          y1={cy}
          x2={cx + 20.5}
          y2={cy}
          stroke="#000000"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <line
          x1={cx + 2}
          y1={cy}
          x2={cx + 19.5}
          y2={cy}
          stroke="#ffffff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
};
