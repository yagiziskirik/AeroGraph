'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';

export type JfsSwitchPosition = 'START 1' | 'OFF' | 'START 2';
export type EngContSwitchPosition = 'PRI' | 'SEC';

export interface EngJetStartPanelProps {
  jfsPosition?: JfsSwitchPosition;
  onJfsChange?: (position: JfsSwitchPosition) => void;
  runLight?: boolean;
  onRunLightClick?: () => void;
  allowLightInteractivity?: boolean;
  engContPosition?: EngContSwitchPosition;
  onEngContChange?: (position: EngContSwitchPosition) => void;
  allowSwitchClick?:
    | boolean
    | { jfsSwitch?: boolean; engContSwitch?: boolean };
  enabledSwitches?: {
    jfsSwitch?: boolean;
    engContSwitch?: boolean;
  };
  className?: string;
}

export const EngJetStartPanel: React.FC<EngJetStartPanelProps> = ({
  jfsPosition: controlledJfsPosition,
  onJfsChange,
  runLight: controlledRunLight,
  onRunLightClick,
  allowLightInteractivity = false,
  engContPosition: controlledEngContPosition,
  onEngContChange,
  allowSwitchClick = true,
  enabledSwitches,
  className = '',
}) => {
  const panelId = useId();

  const isControlAllowed = (
    key: 'jfsSwitch' | 'engContSwitch'
  ): boolean => {
    if (typeof allowSwitchClick === 'boolean' && !allowSwitchClick) return false;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick[key] !== undefined) {
      return !!allowSwitchClick[key];
    }
    if (enabledSwitches && enabledSwitches[key] !== undefined) {
      return !!enabledSwitches[key];
    }
    return true;
  };

  const [internalJfsPosition, setInternalJfsPosition] = useState<JfsSwitchPosition>('OFF');
  const activeJfsPosition =
    controlledJfsPosition !== undefined ? controlledJfsPosition : internalJfsPosition;

  const [internalRunLight, setInternalRunLight] = useState<boolean>(false);
  const activeRunLight =
    controlledRunLight !== undefined ? controlledRunLight : internalRunLight;

  const setJfsPosition = (newPos: JfsSwitchPosition) => {
    if (!isControlAllowed('jfsSwitch')) return;
    if (activeJfsPosition === newPos) return;
    Sound.playSwitch();
    if (onJfsChange) {
      onJfsChange(newPos);
    } else {
      setInternalJfsPosition(newPos);
    }
  };

  const handleJfsCycleUp = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isControlAllowed('jfsSwitch')) return;
    if (activeJfsPosition === 'START 2') {
      setJfsPosition('OFF');
    } else if (activeJfsPosition === 'OFF') {
      setJfsPosition('START 1');
    }
  };

  const handleJfsCycleDown = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isControlAllowed('jfsSwitch')) return;
    if (activeJfsPosition === 'START 1') {
      setJfsPosition('OFF');
    } else if (activeJfsPosition === 'OFF') {
      setJfsPosition('START 2');
    }
  };

  const handleRunLightClick = () => {
    if (!allowLightInteractivity) return;
    Sound.playClick();
    if (onRunLightClick) {
      onRunLightClick();
    } else {
      setInternalRunLight((prev) => !prev);
    }
  };

  const [internalEngContPosition, setInternalEngContPosition] =
    useState<EngContSwitchPosition>('PRI');
  const activeEngContPosition =
    controlledEngContPosition !== undefined
      ? controlledEngContPosition
      : internalEngContPosition;

  const isGuardOpen = activeEngContPosition === 'SEC';

  const setEngContPosition = (newPos: EngContSwitchPosition) => {
    if (!isControlAllowed('engContSwitch')) return;
    if (activeEngContPosition === newPos) return;
    Sound.playSwitch();
    if (onEngContChange) {
      onEngContChange(newPos);
    } else {
      setInternalEngContPosition(newPos);
    }
  };

  const handleEngContLeftClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isControlAllowed('engContSwitch')) return;
    setEngContPosition('PRI');
  };

  const handleEngContRightClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!isControlAllowed('engContSwitch')) return;
    setEngContPosition('SEC');
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 pt-3 pb-3.5 w-[164px] min-w-[164px] max-w-[164px] text-zinc-300 font-mono select-none flex flex-col"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
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

        <div>
          <div className="text-center pt-1 pb-2 pointer-events-none select-none">
            <span className="text-[10px] font-black tracking-wider text-zinc-300 whitespace-nowrap uppercase">
              ENG &amp; JET START
            </span>
          </div>

          <div className="flex flex-col pt-0 pb-1">
            <div className="flex items-center justify-center space-x-1.5 w-full mb-2 pointer-events-none select-none">
              <div className="w-4 h-[1px] bg-zinc-600/70" />
              <span className="text-[9px] font-black tracking-wider uppercase text-zinc-300 whitespace-nowrap">
                JET FUEL
              </span>
              <div className="w-4 h-[1px] bg-zinc-600/70" />
            </div>

            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col items-center justify-center w-[52px]">
                <span className="text-[9px] font-black tracking-wider text-zinc-300 mb-1.5 uppercase select-none pointer-events-none">
                  RUN
                </span>

                <div
                  onClick={allowLightInteractivity ? handleRunLightClick : undefined}
                  title={`JFS RUN: ${activeRunLight ? 'ACTIVE' : 'OFF'}`}
                  className={`relative w-8 h-8 rounded-full bg-[#15161a] border-2 border-[#090a0d] shadow-inner flex items-center justify-center select-none ${
                    allowLightInteractivity ? 'cursor-pointer' : 'cursor-default pointer-events-none'
                  }`}
                  style={{
                    boxShadow:
                      'inset 0 2px 5px rgba(0,0,0,0.85), 0 1px 2px rgba(255,255,255,0.06)',
                  }}
                >
                  <div className="absolute inset-0.5 rounded-full border border-black/70 bg-[#121316]" />
                  <div
                    className={`relative w-5 h-5 rounded-full transition-[background-color,box-shadow] duration-150 will-change-transform ${
                      activeRunLight
                        ? 'bg-[#22c55e] shadow-[0_0_12px_#22c55e,0_0_22px_rgba(34,197,94,0.8)]'
                        : 'bg-[#082012] border border-[#041208] shadow-inner'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col items-center w-[78px]">
                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center whitespace-nowrap select-none pointer-events-none ${
                    activeJfsPosition === 'START 1'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  START 1
                </span>

                <div className="relative flex items-center justify-center w-full my-0.5">
                  <div
                    onMouseDown={(e) => {
                      if (e.button === 0) {
                        e.preventDefault();
                        handleJfsCycleUp(e);
                      } else if (e.button === 2) {
                        e.preventDefault();
                        handleJfsCycleDown(e);
                      }
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    title={
                      isControlAllowed('jfsSwitch')
                        ? `JFS Switch: ${activeJfsPosition}. Left-click UP (START 1), Right-click DOWN (START 2).`
                        : `JFS Switch: ${activeJfsPosition}`
                    }
                    className={
                      isControlAllowed('jfsSwitch')
                        ? 'cursor-pointer select-none active:scale-95'
                        : 'cursor-default select-none'
                    }
                  >
                    <CockpitLeverSwitch position={activeJfsPosition} />
                  </div>

                  <div className="absolute left-[calc(50%+25px)] flex items-center pointer-events-none select-none">
                    <span
                      className={`text-[9.5px] font-black tracking-wider uppercase transition-colors whitespace-nowrap ${
                        activeJfsPosition === 'OFF'
                          ? 'text-amber-400 font-extrabold'
                          : 'text-zinc-200'
                      }`}
                    >
                      OFF
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center whitespace-nowrap select-none pointer-events-none ${
                    activeJfsPosition === 'START 2'
                      ? 'text-amber-400 font-extrabold'
                      : 'text-zinc-200'
                  }`}
                >
                  START 2
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full h-[1px] bg-zinc-500/50 my-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />

        <div className="flex flex-col items-center pt-0 pb-1">
          <div className="text-center mb-1 pointer-events-none select-none">
            <span className="text-[12.5px] font-black tracking-wider uppercase text-zinc-200 whitespace-nowrap">
              ENG CONT
            </span>
          </div>

          <div className="flex flex-col items-center w-[84px] relative">
            <span
              className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center mb-1 select-none pointer-events-none ${
                activeEngContPosition === 'PRI'
                  ? 'text-amber-400 font-extrabold'
                  : 'text-zinc-300'
              }`}
            >
              PRI
            </span>

            <div className="relative flex items-center justify-center w-full h-[88px]">
              <div
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    e.preventDefault();
                    handleEngContLeftClick(e);
                  } else if (e.button === 2) {
                    e.preventDefault();
                    handleEngContRightClick(e);
                  }
                }}
                onContextMenu={(e) => e.preventDefault()}
                title={`ENG CONT: ${activeEngContPosition}. Left-click UP (PRI), Right-click DOWN (SEC).`}
                className={`absolute top-[6px] z-10 ${
                  isControlAllowed('engContSwitch')
                    ? 'cursor-pointer select-none active:scale-95'
                    : 'cursor-default select-none'
                }`}
              >
                <CockpitLeverSwitch position={activeEngContPosition} />
              </div>

              <div
                className="absolute z-20 pointer-events-none select-none transition-transform duration-250 ease-out will-change-transform"
                style={{
                  top: '6px',
                  width: '50px',
                  height: '76px',
                  transformOrigin: 'center bottom',
                  transform: isGuardOpen
                    ? 'perspective(280px) rotateX(76deg) translateY(14px) scaleY(0.68)'
                    : 'perspective(280px) rotateX(0deg) translateY(0)',
                  boxShadow: isGuardOpen
                    ? '0 10px 16px rgba(0,0,0,0.85)'
                    : '0 4px 10px rgba(0,0,0,0.7)',
                }}
              >
                <div
                  className="w-full h-full relative border border-[#3b0808] rounded-xs"
                  style={{
                    clipPath:
                      'polygon(0% 0%, 24% 0%, 24% 37%, 76% 37%, 76% 0%, 100% 0%, 100% 100%, 0% 100%)',
                    background: isGuardOpen
                      ? 'linear-gradient(to bottom, rgba(139, 24, 24, 0.95), #6b1414 70%, #4a0e0e)'
                      : 'linear-gradient(to right, #4c0d0d, #701414 15%, #991b1b 50%, #701414 85%, #4c0d0d)',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.3)',
                  }}
                >
                  <div className="absolute top-0 left-0 w-[12px] h-[2px] bg-red-400/80" />
                  <div className="absolute top-0 right-0 w-[12px] h-[2px] bg-red-400/80" />

                  <div className="absolute top-[28px] left-[12px] right-[12px] h-[1.5px] bg-red-400/60 border-b border-[#3b0808]" />

                  <div className="absolute top-[48px] left-1/2 -translate-x-1/2 w-5 h-[1px] bg-red-950/80 shadow-[0_1px_0_rgba(255,255,255,0.15)] pointer-events-none" />

                  <div className="absolute bottom-0 left-0 right-0 h-[7px] bg-[#290505] border-t border-[#3b0808] flex items-center justify-between px-1">
                    <div className="w-1.5 h-1 rounded-xs bg-[#400909] border border-black/80" />
                    <div className="flex-1 h-[1.5px] bg-gradient-to-r from-zinc-500 via-zinc-200 to-zinc-500 mx-1 rounded-full shadow-sm" />
                    <div className="w-1.5 h-1 rounded-xs bg-[#400909] border border-black/80" />
                  </div>
                </div>
              </div>
            </div>

            <span
              className={`text-[9.5px] font-black tracking-wider uppercase transition-colors text-center mt-1 select-none pointer-events-none ${
                activeEngContPosition === 'SEC'
                  ? 'text-amber-400 font-extrabold'
                  : 'text-zinc-300'
              }`}
            >
              SEC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CockpitLeverSwitchProps {
  position: JfsSwitchPosition | EngContSwitchPosition;
}

const CockpitLeverSwitch: React.FC<CockpitLeverSwitchProps> = ({ position }) => {
  const isUp = position === 'START 1' || position === 'PRI';
  const isDown = position === 'START 2' || position === 'SEC';

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
