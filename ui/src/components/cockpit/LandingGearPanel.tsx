'use client';

import React, { useState, useId, useCallback } from 'react';
import { Sound } from '../../services/sound';
import { CockpitTwoWaySwitch, CockpitThreeWaySwitch, SOCKET_BEZEL_STYLE } from './CockpitSwitch';

/* -------------------------------------------------------------------------- */
/* Types & Interfaces                                                         */
/* -------------------------------------------------------------------------- */

export type GearLeverPosition = 'UP' | 'DN';
export type HookPosition = 'UP' | 'DN';
export type GndJettPosition = 'ENABLE' | 'OFF';
export type BrakesPosition = 'CHAN_1' | 'CHAN_2';
export type ParkingBrakePosition = 'PARKING_BRAKE' | 'ANTI_SKID' | 'OFF';
export type StoresConfigPosition = 'CAT_I' | 'CAT_III';
export type LightsPosition = 'LANDING' | 'OFF' | 'TAXI';

export interface LandingGearPanelState {
  emerStoresJettison?: boolean;
  hook?: HookPosition;
  gndJett?: GndJettPosition;
  brakes?: BrakesPosition;
  parkingBrake?: ParkingBrakePosition;
  storesConfig?: StoresConfigPosition;
  hornSilencer?: boolean;
  lights?: LightsPosition;
  dnLockRel?: boolean;
  gearLever?: GearLeverPosition;
  wheelsNose?: boolean;
  wheelsLeft?: boolean;
  wheelsRight?: boolean;
  gearWarningLight?: boolean;
}

export interface LandingGearPanelProps {
  state?: LandingGearPanelState;
  onStateChange?: (key: keyof LandingGearPanelState, value: any) => void;
  // Convenience individual handlers & controlled props
  emerStoresJettison?: boolean;
  onEmerStoresJettisonChange?: (val: boolean) => void;
  hook?: HookPosition;
  onHookChange?: (pos: HookPosition) => void;
  gndJett?: GndJettPosition;
  onGndJettChange?: (pos: GndJettPosition) => void;
  brakes?: BrakesPosition;
  onBrakesChange?: (pos: BrakesPosition) => void;
  parkingBrake?: ParkingBrakePosition;
  onParkingBrakeChange?: (pos: ParkingBrakePosition) => void;
  storesConfig?: StoresConfigPosition;
  onStoresConfigChange?: (pos: StoresConfigPosition) => void;
  hornSilencer?: boolean;
  onHornSilencerChange?: (val: boolean) => void;
  lights?: LightsPosition;
  onLightsChange?: (pos: LightsPosition) => void;
  dnLockRel?: boolean;
  onDnLockRelChange?: (val: boolean) => void;
  gearLever?: GearLeverPosition;
  onGearLeverChange?: (pos: GearLeverPosition) => void;
  wheelsNose?: boolean;
  wheelsLeft?: boolean;
  wheelsRight?: boolean;
  gearWarningLight?: boolean;
  allowSwitchClick?: boolean | Partial<Record<keyof LandingGearPanelState, boolean>>;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Subcomponent: Green Annunciator Indicator Light                            */
/* -------------------------------------------------------------------------- */

interface WheelLightProps {
  isOn: boolean;
  title: string;
  className?: string;
}

const WheelLight: React.FC<WheelLightProps> = ({ isOn, title, className = '' }) => (
  <div
    title={title}
    className={`relative w-7 h-7 rounded-full bg-[#15161a] border-2 border-[#090a0d] shadow-inner flex items-center justify-center pointer-events-none select-none ${className}`}
  >
    {/* Outer Conical Bezel */}
    <div className="absolute inset-0.5 rounded-full border border-black/70 bg-[#121316]" />

    {/* Green Lens */}
    <div
      className={`relative w-4 h-4 rounded-full transition-[background-color,box-shadow] duration-150 will-change-transform ${
        isOn
          ? 'bg-[#22c55e] shadow-[0_0_10px_#22c55e,0_0_18px_rgba(34,197,94,0.85)] border border-[#4ade80]'
          : 'bg-[#0b2413] border border-[#14381e] opacity-60'
      }`}
    />
  </div>
);

/* -------------------------------------------------------------------------- */
/* Subcomponent: Authentic Wide Rectangular F-16 Paddle Hook Switch           */
/* -------------------------------------------------------------------------- */

interface HookPaddleSwitchProps {
  position: HookPosition;
  isAllowed: boolean;
  onAdvanceUp: () => void;
  onRetractDown: () => void;
}

const HookPaddleSwitch: React.FC<HookPaddleSwitchProps> = ({
  position,
  isAllowed,
  onAdvanceUp,
  onRetractDown,
}) => {
  const isUp = position === 'UP';

  return (
    <div
      onMouseDown={(e) => {
        if (!isAllowed) return;
        if (e.button === 0) onAdvanceUp(); // Left-click advances UP
        else if (e.button === 2) {
          e.preventDefault();
          onRetractDown(); // Right-click retracts DOWN
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
      title={`HOOK: ${position} (Left-click for UP, Right-click for DN)`}
      className={`relative w-12 h-14 flex items-center justify-center select-none ${
        isAllowed ? 'cursor-pointer' : 'cursor-default pointer-events-none'
      }`}
    >
      {/* Outer socket bezel ring */}
      <div
        className="w-11 h-11 rounded-full border border-black/50 shadow-inner z-0"
        style={SOCKET_BEZEL_STYLE}
      />

      {/* Paddle Lever */}
      <div
        className="absolute left-1/2 top-1/2 w-7 h-11 rounded-[3px] border border-[#303020] transition-transform duration-150 ease-out will-change-transform z-10 flex flex-col items-center justify-around py-1"
        style={{
          background: 'linear-gradient(180deg, #b5b584 0%, #949463 35%, #757549 70%, #595935 100%)',
          boxShadow: '0 4px 7px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -1px 2px rgba(0,0,0,0.6)',
          transform: isUp
            ? 'translate(-50%, -40px) scaleY(1.04)'
            : 'translate(-50%, -2px) scaleY(1.04)',
          transformOrigin: 'center bottom',
        }}
      >
        <div className="w-5 h-[1.5px] bg-black/45 rounded-full shadow-inner" />
        <div className="w-5 h-[1.5px] bg-black/45 rounded-full shadow-inner" />
        <div className="w-5 h-[1.5px] bg-black/45 rounded-full shadow-inner" />
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* Main LandingGearPanel Component                                            */
/* -------------------------------------------------------------------------- */

export const LandingGearPanel: React.FC<LandingGearPanelProps> = ({
  state: controlledState,
  onStateChange,
  emerStoresJettison: controlledEmerStoresJettison,
  onEmerStoresJettisonChange,
  hook: controlledHook,
  onHookChange,
  gndJett: controlledGndJett,
  onGndJettChange,
  brakes: controlledBrakes,
  onBrakesChange,
  parkingBrake: controlledParkingBrake,
  onParkingBrakeChange,
  storesConfig: controlledStoresConfig,
  onStoresConfigChange,
  hornSilencer: controlledHornSilencer,
  onHornSilencerChange,
  lights: controlledLights,
  onLightsChange,
  dnLockRel: controlledDnLockRel,
  onDnLockRelChange,
  gearLever: controlledGearLever,
  onGearLeverChange,
  wheelsNose: controlledWheelsNose,
  wheelsLeft: controlledWheelsLeft,
  wheelsRight: controlledWheelsRight,
  gearWarningLight: controlledGearWarningLight,
  allowSwitchClick = true,
  className = '',
}) => {
  const panelId = useId();

  // Internal uncontrolled state (F-16 default: Gear Down & Locked)
  const [internalState, setInternalState] = useState<Required<LandingGearPanelState>>({
    emerStoresJettison: false,
    hook: 'UP',
    gndJett: 'OFF',
    brakes: 'CHAN_1',
    parkingBrake: 'ANTI_SKID',
    storesConfig: 'CAT_I',
    hornSilencer: false,
    lights: 'OFF',
    dnLockRel: false,
    gearLever: 'DN',
    wheelsNose: true,
    wheelsLeft: true,
    wheelsRight: true,
    gearWarningLight: false,
  });

  // Resolve active states
  const activeGearLever =
    controlledGearLever !== undefined
      ? controlledGearLever
      : controlledState?.gearLever !== undefined
      ? controlledState.gearLever
      : internalState.gearLever;

  const isGearDown = activeGearLever === 'DN';

  const activeEmerStores =
    controlledEmerStoresJettison !== undefined
      ? controlledEmerStoresJettison
      : controlledState?.emerStoresJettison !== undefined
      ? controlledState.emerStoresJettison
      : internalState.emerStoresJettison;

  const activeHook =
    controlledHook !== undefined
      ? controlledHook
      : controlledState?.hook !== undefined
      ? controlledState.hook
      : internalState.hook;

  const activeGndJett =
    controlledGndJett !== undefined
      ? controlledGndJett
      : controlledState?.gndJett !== undefined
      ? controlledState.gndJett
      : internalState.gndJett;

  const activeBrakes =
    controlledBrakes !== undefined
      ? controlledBrakes
      : controlledState?.brakes !== undefined
      ? controlledState.brakes
      : internalState.brakes;

  const activeParkingBrake =
    controlledParkingBrake !== undefined
      ? controlledParkingBrake
      : controlledState?.parkingBrake !== undefined
      ? controlledState.parkingBrake
      : internalState.parkingBrake;

  const activeStoresConfig =
    controlledStoresConfig !== undefined
      ? controlledStoresConfig
      : controlledState?.storesConfig !== undefined
      ? controlledState.storesConfig
      : internalState.storesConfig;

  const activeHornSilencer =
    controlledHornSilencer !== undefined
      ? controlledHornSilencer
      : controlledState?.hornSilencer !== undefined
      ? controlledState.hornSilencer
      : internalState.hornSilencer;

  const activeLights =
    controlledLights !== undefined
      ? controlledLights
      : controlledState?.lights !== undefined
      ? controlledState.lights
      : internalState.lights;

  const activeDnLockRel =
    controlledDnLockRel !== undefined
      ? controlledDnLockRel
      : controlledState?.dnLockRel !== undefined
      ? controlledState.dnLockRel
      : internalState.dnLockRel;

  // Synced by default with gear lever, with programmatically overrideable props
  const activeWheelsNose =
    controlledWheelsNose !== undefined
      ? controlledWheelsNose
      : controlledState?.wheelsNose !== undefined
      ? controlledState.wheelsNose
      : isGearDown;

  const activeWheelsLeft =
    controlledWheelsLeft !== undefined
      ? controlledWheelsLeft
      : controlledState?.wheelsLeft !== undefined
      ? controlledState.wheelsLeft
      : isGearDown;

  const activeWheelsRight =
    controlledWheelsRight !== undefined
      ? controlledWheelsRight
      : controlledState?.wheelsRight !== undefined
      ? controlledState.wheelsRight
      : isGearDown;

  const activeGearWarning =
    controlledGearWarningLight !== undefined
      ? controlledGearWarningLight
      : controlledState?.gearWarningLight !== undefined
      ? controlledState.gearWarningLight
      : internalState.gearWarningLight;

  const isAllowed = useCallback((key: keyof LandingGearPanelState): boolean => {
    if (typeof allowSwitchClick === 'boolean') return allowSwitchClick;
    if (typeof allowSwitchClick === 'object' && allowSwitchClick !== null) {
      return !!allowSwitchClick[key];
    }
    return true;
  }, [allowSwitchClick]);

  const updateControl = useCallback(<K extends keyof LandingGearPanelState>(key: K, value: LandingGearPanelState[K]) => {
    if (onStateChange) {
      onStateChange(key, value);
    }
    if (key === 'emerStoresJettison' && onEmerStoresJettisonChange) onEmerStoresJettisonChange(value as boolean);
    if (key === 'hook' && onHookChange) onHookChange(value as HookPosition);
    if (key === 'gndJett' && onGndJettChange) onGndJettChange(value as GndJettPosition);
    if (key === 'brakes' && onBrakesChange) onBrakesChange(value as BrakesPosition);
    if (key === 'parkingBrake' && onParkingBrakeChange) onParkingBrakeChange(value as ParkingBrakePosition);
    if (key === 'storesConfig' && onStoresConfigChange) onStoresConfigChange(value as StoresConfigPosition);
    if (key === 'hornSilencer' && onHornSilencerChange) onHornSilencerChange(value as boolean);
    if (key === 'lights' && onLightsChange) onLightsChange(value as LightsPosition);
    if (key === 'dnLockRel' && onDnLockRelChange) onDnLockRelChange(value as boolean);
    if (key === 'gearLever' && onGearLeverChange) onGearLeverChange(value as GearLeverPosition);

    setInternalState((prev) => ({ ...prev, [key]: value }));
  }, [
    onStateChange,
    onEmerStoresJettisonChange,
    onHookChange,
    onGndJettChange,
    onBrakesChange,
    onParkingBrakeChange,
    onStoresConfigChange,
    onHornSilencerChange,
    onLightsChange,
    onDnLockRelChange,
    onGearLeverChange,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Strict Directional Switch Handlers (Rule 9: Left=UP/Adv, Right=DOWN/Ret) */
  /* ------------------------------------------------------------------------ */

  // 1. Gear Lever: Left-Click moves to UP (retract gear), Right-Click moves to DN (extend gear)
  const setGearUp = () => {
    if (!isAllowed('gearLever') || activeGearLever === 'UP') return;
    Sound.playSwitch();
    updateControl('gearLever', 'UP');
  };
  const setGearDown = () => {
    if (!isAllowed('gearLever') || activeGearLever === 'DN') return;
    Sound.playSwitch();
    updateControl('gearLever', 'DN');
  };

  // 2. Hook Switch: Left-Click moves to UP, Right-Click moves to DN
  const setHookUp = () => {
    if (!isAllowed('hook') || activeHook === 'UP') return;
    Sound.playSwitch();
    updateControl('hook', 'UP');
  };
  const setHookDown = () => {
    if (!isAllowed('hook') || activeHook === 'DN') return;
    Sound.playSwitch();
    updateControl('hook', 'DN');
  };

  // 3. GND JETT Switch: Left-Click = ENABLE (UP), Right-Click = OFF (DOWN)
  const setGndJettEnable = () => {
    if (!isAllowed('gndJett') || activeGndJett === 'ENABLE') return;
    Sound.playSwitch();
    updateControl('gndJett', 'ENABLE');
  };
  const setGndJettOff = () => {
    if (!isAllowed('gndJett') || activeGndJett === 'OFF') return;
    Sound.playSwitch();
    updateControl('gndJett', 'OFF');
  };

  // 4. BRAKES Switch: Left-Click = CHAN 1 (UP), Right-Click = CHAN 2 (DOWN)
  const setBrakesChan1 = () => {
    if (!isAllowed('brakes') || activeBrakes === 'CHAN_1') return;
    Sound.playSwitch();
    updateControl('brakes', 'CHAN_1');
  };
  const setBrakesChan2 = () => {
    if (!isAllowed('brakes') || activeBrakes === 'CHAN_2') return;
    Sound.playSwitch();
    updateControl('brakes', 'CHAN_2');
  };

  // 5. PARKING BRAKE (3-position): Left-Click advances up (OFF -> ANTI-SKID -> PARKING_BRAKE), Right-Click retracts down
  const advanceParkingBrake = () => {
    if (!isAllowed('parkingBrake')) return;
    if (activeParkingBrake === 'OFF') {
      Sound.playSwitch();
      updateControl('parkingBrake', 'ANTI_SKID');
    } else if (activeParkingBrake === 'ANTI_SKID') {
      Sound.playSwitch();
      updateControl('parkingBrake', 'PARKING_BRAKE');
    }
  };
  const retractParkingBrake = () => {
    if (!isAllowed('parkingBrake')) return;
    if (activeParkingBrake === 'PARKING_BRAKE') {
      Sound.playSwitch();
      updateControl('parkingBrake', 'ANTI_SKID');
    } else if (activeParkingBrake === 'ANTI_SKID') {
      Sound.playSwitch();
      updateControl('parkingBrake', 'OFF');
    }
  };

  // 6. STORES CONFIG: Left-Click = CAT I (UP), Right-Click = CAT III (DOWN)
  const setStoresCat1 = () => {
    if (!isAllowed('storesConfig') || activeStoresConfig === 'CAT_I') return;
    Sound.playSwitch();
    updateControl('storesConfig', 'CAT_I');
  };
  const setStoresCat3 = () => {
    if (!isAllowed('storesConfig') || activeStoresConfig === 'CAT_III') return;
    Sound.playSwitch();
    updateControl('storesConfig', 'CAT_III');
  };

  // 7. LIGHTS (3-position): Left-Click advances up (TAXI -> OFF -> LANDING), Right-Click retracts down
  const advanceLights = () => {
    if (!isAllowed('lights')) return;
    if (activeLights === 'TAXI') {
      Sound.playSwitch();
      updateControl('lights', 'OFF');
    } else if (activeLights === 'OFF') {
      Sound.playSwitch();
      updateControl('lights', 'LANDING');
    }
  };
  const retractLights = () => {
    if (!isAllowed('lights')) return;
    if (activeLights === 'LANDING') {
      Sound.playSwitch();
      updateControl('lights', 'OFF');
    } else if (activeLights === 'OFF') {
      Sound.playSwitch();
      updateControl('lights', 'TAXI');
    }
  };

  // Momentary Push Button Handlers (strictly push on mousedown, release on mouseup/leave)
  const handleEmerJettDown = () => {
    if (!isAllowed('emerStoresJettison')) return;
    Sound.playClick();
    updateControl('emerStoresJettison', true);
  };
  const handleEmerJettUp = () => {
    if (!isAllowed('emerStoresJettison')) return;
    updateControl('emerStoresJettison', false);
  };

  const handleHornSilencerDown = () => {
    if (!isAllowed('hornSilencer')) return;
    Sound.playClick();
    updateControl('hornSilencer', true);
  };
  const handleHornSilencerUp = () => {
    if (!isAllowed('hornSilencer')) return;
    updateControl('hornSilencer', false);
  };

  const handleDnLockRelDown = () => {
    if (!isAllowed('dnLockRel')) return;
    Sound.playClick();
    updateControl('dnLockRel', true);
  };
  const handleDnLockRelUp = () => {
    if (!isAllowed('dnLockRel')) return;
    updateControl('dnLockRel', false);
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* F-16 Landing Gear & Stores Panel Chassis */}
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl w-[420px] min-w-[420px] max-w-[420px] h-[400px] text-zinc-300 font-mono select-none overflow-hidden"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Authentic Stepped Sill Contour Overlay on Left Margin */}
        <div className="absolute top-0 left-0 bottom-0 w-8 pointer-events-none select-none z-0">
          <svg width="32" height="400" viewBox="0 0 32 400" className="w-full h-full">
            <polygon
              points="0,0 28,0 28,45 14,90 14,135 0,160 0,400"
              fill="#22242b"
              stroke="#444754"
              strokeWidth="1.5"
            />
            <polygon
              points="0,0 26,0 26,43 12,88 12,133 0,158"
              fill="#2f323c"
              opacity="0.6"
            />
          </svg>
        </div>

        {/* Corner Slotted DZUS Fasteners */}
        <div className="absolute top-2.5 left-[34px] w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-10">
          <div className="w-2 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-10">
          <div className="w-2 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Chassis Flat Dark Phillips Screws */}
        <div className="absolute top-3 left-[210px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute top-[180px] left-[20px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute top-[180px] left-[282px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>
        <div className="absolute bottom-3 left-[282px] -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#141517] border border-black shadow-inner flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-[1px] bg-zinc-700/80" />
          <div className="w-[1px] h-1.5 bg-zinc-700/80 absolute" />
        </div>

        {/* Center Panel Alignment Cross (+) */}
        <div className="absolute top-[256px] left-[175px] -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <span className="text-zinc-500 font-bold text-[11px] leading-none opacity-60">+</span>
        </div>

        {/* ================================================================== */}
        {/* TOP ROW: EMER STORES JETTISON | WHEELS | HOOK                      */}
        {/* ================================================================== */}

        {/* 1. EMER STORES JETTISON Button */}
        <div className="absolute left-[88px] top-3.5 flex flex-col items-center">
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1.5">
            EMER STORES
            <br />
            JETTISON
          </span>

          {/* Square Hazard-Striped Baseplate */}
          <div
            onMouseDown={handleEmerJettDown}
            onMouseUp={handleEmerJettUp}
            onMouseLeave={handleEmerJettUp}
            onContextMenu={(e) => e.preventDefault()}
            title="EMER STORES JETTISON (Momentary): Press and hold to jettison all external stores"
            className={`relative w-[64px] h-[64px] rounded border border-black/80 flex items-center justify-center shadow-lg overflow-hidden ${
              isAllowed('emerStoresJettison') ? 'cursor-pointer' : 'cursor-default pointer-events-none'
            }`}
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, #fbbf24 0, #fbbf24 7px, #18181b 7px, #18181b 14px)',
            }}
          >
            {/* Recessed Circular Metallic Well with Concentric Grooves */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#27272a] via-[#18181b] to-[#09090b] border border-black shadow-inner flex items-center justify-center">
              {/* Concentric Guide Ring */}
              <div className="w-10 h-10 rounded-full border border-zinc-600/50 flex items-center justify-center">
                <div className="absolute w-9 h-[1px] bg-zinc-600/40" />
                <div className="absolute h-9 w-[1px] bg-zinc-600/40" />

                {/* Pressable Center Push Button */}
                <div
                  className={`w-7 h-7 rounded-full border border-black transition-all duration-75 flex items-center justify-center z-10 ${
                    activeEmerStores
                      ? 'bg-[#a1a1aa] shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] scale-90'
                      : 'bg-gradient-to-b from-[#e4e4e7] via-[#d4d4d8] to-[#71717a] shadow-[0_2px_5px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.85)]'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2. WHEELS Indicator */}
        <div className="absolute left-[190px] top-3 flex flex-col items-center">
          <div className="relative w-[120px] h-[140px]">
            <svg viewBox="0 0 120 140" className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Nose Chevron */}
              <path
                d="M 53 15 L 60 4 L 67 15"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="miter"
              />

              {/* Tapering Upper Nose Cone */}
              <path
                d="M 55 28 L 47 62"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="1.6"
              />
              <path
                d="M 65 28 L 73 62"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="1.6"
              />

              {/* Fuselage Vertical Lines */}
              <line
                x1="47"
                y1="62"
                x2="47"
                y2="104"
                stroke="#e4e4e7"
                strokeWidth="1.6"
              />
              <line
                x1="73"
                y1="62"
                x2="73"
                y2="104"
                stroke="#e4e4e7"
                strokeWidth="1.6"
              />

              {/* Left Wing */}
              <path
                d="M 47 62
                   L 10 84
                   L 10 92
                   L 47 92"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />

              {/* Right Wing */}
              <path
                d="M 73 62
                   L 110 84
                   L 110 92
                   L 73 92"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />

              {/* Tail Stabilizers */}
              <path
                d="M 47 104
                   L 31 120
                   L 31 124
                   L 51 124
                   L 54 128
                   L 66 128
                   L 69 124
                   L 89 124
                   L 89 120
                   L 73 104"
                fill="none"
                stroke="#e4e4e7"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />

              {/* Vertical Fuselage WHEELS Text */}
              <text x="60" y="56" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">W</text>
              <text x="60" y="68" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">H</text>
              <text x="60" y="80" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">E</text>
              <text x="60" y="92" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">E</text>
              <text x="60" y="104" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">L</text>
              <text x="60" y="116" fill="#e4e4e7" fontSize="10" fontWeight="bold" textAnchor="middle">S</text>
            </svg>

            {/* Nose Gear Light */}
            <div className="absolute top-[8px] left-[60px] -translate-x-1/2">
              <WheelLight isOn={activeWheelsNose} title="Nose Landing Gear: Down & Locked" />
            </div>

            {/* Left Main Gear Light */}
            <div className="absolute top-[44px] left-[38px] -translate-x-1/2">
              <WheelLight isOn={activeWheelsLeft} title="Left Main Gear: Down & Locked" />
            </div>

            {/* Right Main Gear Light */}
            <div className="absolute top-[44px] left-[82px] -translate-x-1/2">
              <WheelLight isOn={activeWheelsRight} title="Right Main Gear: Down & Locked" />
            </div>
          </div>
        </div>

        {/* 3. HOOK Switch */}
        <div className="absolute right-5 top-3.5 flex flex-col items-center">
          {/* Caution Striped Bracket */}
          <div
            className="w-[48px] h-[20px] rounded-t border border-black flex items-center justify-center shadow-sm mb-1 overflow-hidden"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, #fbbf24 0, #fbbf24 5px, #18181b 5px, #18181b 10px)',
            }}
          >
            <span className="bg-black/90 px-1.5 py-0.2 rounded text-[9.5px] font-black text-zinc-100 tracking-wider">
              HOOK
            </span>
          </div>

          <div className="relative flex items-center justify-center">
            {/* Olive Paddle Lever */}
            <HookPaddleSwitch
              position={activeHook}
              isAllowed={isAllowed('hook')}
              onAdvanceUp={setHookUp}
              onRetractDown={setHookDown}
            />

            {/* UP / DN Position Labels */}
            <div className="absolute left-[52px] flex flex-col justify-between h-12 pointer-events-none select-none">
              <span
                className={`text-[10px] font-black tracking-wider transition-colors ${
                  activeHook === 'UP' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                }`}
              >
                UP
              </span>
              <span
                className={`text-[10px] font-black tracking-wider transition-colors ${
                  activeHook === 'DN' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
                }`}
              >
                DN
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MIDDLE ROW: GND JETT | BRAKES | PARKING BRAKE                      */}
        {/* ================================================================== */}

        {/* 4. GND JETT ENABLE Switch */}
        <div className="absolute left-[64px] top-[156px] flex flex-col items-center">
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1">
            GND JETT
            <br />
            ENABLE
          </span>
          <div
            onMouseDown={(e) => {
              if (e.button === 0) setGndJettEnable(); // Left-click = ENABLE (UP)
              else if (e.button === 2) {
                e.preventDefault();
                setGndJettOff(); // Right-click = OFF (DOWN)
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            title={`GND JETT: ${activeGndJett} (Left-click for ENABLE, Right-click for OFF)`}
            className={isAllowed('gndJett') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
          >
            <CockpitTwoWaySwitch isUp={activeGndJett === 'ENABLE'} />
          </div>
          <span
            className={`text-[10px] font-black tracking-wider uppercase text-center mt-1 ${
              activeGndJett === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            OFF
          </span>
        </div>

        {/* 5. BRAKES Switch (Red Collar) */}
        <div className="absolute left-[138px] top-[156px] flex flex-col items-center">
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1">
            BRAKES
            <br />
            CHAN 1
          </span>
          <div
            onMouseDown={(e) => {
              if (e.button === 0) setBrakesChan1(); // Left-click = CHAN 1 (UP)
              else if (e.button === 2) {
                e.preventDefault();
                setBrakesChan2(); // Right-click = CHAN 2 (DOWN)
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            title={`BRAKES: ${activeBrakes === 'CHAN_1' ? 'CHAN 1' : 'CHAN 2'} (Left-click for CHAN 1, Right-click for CHAN 2)`}
            className={isAllowed('brakes') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
          >
            <CockpitTwoWaySwitch isUp={activeBrakes === 'CHAN_1'} isRedCollar={true} />
          </div>
          <span
            className={`text-[10px] font-black tracking-wider uppercase text-center mt-1 ${
              activeBrakes === 'CHAN_2' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            CHAN 2
          </span>
        </div>

        {/* 6. PARKING BRAKE Switch */}
        <div className="absolute left-[214px] top-[156px] flex flex-col items-center">
          {/* Collinear Header */}
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1">
            PARKING
            <br />
            BRAKE
          </span>

          {/* Switch Row */}
          <div className="relative flex items-center justify-center w-full">
            <div
              onMouseDown={(e) => {
                if (e.button === 0) advanceParkingBrake(); // Left-click advances UP
                else if (e.button === 2) {
                  e.preventDefault();
                  retractParkingBrake(); // Right-click retracts DOWN
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              title={`PARKING BRAKE: ${activeParkingBrake} (Left-click advances UP, Right-click retracts DOWN)`}
              className={isAllowed('parkingBrake') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <CockpitThreeWaySwitch
                position={
                  activeParkingBrake === 'PARKING_BRAKE'
                    ? 'UP'
                    : activeParkingBrake === 'OFF'
                    ? 'DOWN'
                    : 'CENTER'
                }
              />
            </div>

            {/* ANTI-SKID Position Label */}
            <span
              className={`absolute left-[46px] top-1/2 -translate-y-1/2 text-[9.5px] font-black tracking-wider uppercase whitespace-nowrap pointer-events-none select-none ${
                activeParkingBrake === 'ANTI_SKID' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
              }`}
            >
              ANTI-SKID
            </span>
          </div>

          {/* Collinear OFF Label */}
          <span
            className={`text-[10px] font-black tracking-wider uppercase text-center mt-1 ${
              activeParkingBrake === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            OFF
          </span>
        </div>

        {/* ================================================================== */}
        {/* BOTTOM ROW: STORES CONFIG | HORN SILENCER | LIGHTS | DN LOCK REL   */}
        {/* ================================================================== */}

        {/* 7. STORES CONFIG Switch (Red Collar) */}
        <div className="absolute left-[44px] top-[265px] flex flex-col items-center">
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1">
            STORES CONFIG
            <br />
            CAT I
          </span>
          <div
            onMouseDown={(e) => {
              if (e.button === 0) setStoresCat1(); // Left-click = CAT I (UP)
              else if (e.button === 2) {
                e.preventDefault();
                setStoresCat3(); // Right-click = CAT III (DOWN)
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            title={`STORES CONFIG: ${activeStoresConfig === 'CAT_I' ? 'CAT I' : 'CAT III'} (Left-click for CAT I, Right-click for CAT III)`}
            className={isAllowed('storesConfig') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
          >
            <CockpitTwoWaySwitch isUp={activeStoresConfig === 'CAT_I'} isRedCollar={true} />
          </div>
          <span
            className={`text-[10px] font-black tracking-wider uppercase text-center mt-1 ${
              activeStoresConfig === 'CAT_III' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            CAT III
          </span>
        </div>

        {/* 8. HORN SILENCER Push Button */}
        <div className="absolute left-[138px] top-[265px] flex flex-col items-center">
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-2.5">
            HORN
            <br />
            SILENCER
          </span>
          <button
            type="button"
            onMouseDown={handleHornSilencerDown}
            onMouseUp={handleHornSilencerUp}
            onMouseLeave={handleHornSilencerUp}
            onContextMenu={(e) => e.preventDefault()}
            title="HORN SILENCER (Momentary): Press and hold left-click to silence gear warning horn"
            className={`w-7 h-7 rounded-full border border-black/80 transition-transform duration-75 select-none flex items-center justify-center ${
              isAllowed('hornSilencer') ? 'cursor-pointer' : 'cursor-default pointer-events-none'
            } ${
              activeHornSilencer
                ? 'bg-[#a1a1aa] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] scale-90'
                : 'bg-gradient-to-b from-[#ffffff] via-[#e4e4e7] to-[#a1a1aa] shadow-[0_2px_5px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.9)]'
            }`}
          />
        </div>

        {/* 9. LIGHTS 3-Way Toggle Switch (LANDING / OFF / TAXI) */}
        <div className="absolute left-[214px] top-[265px] flex flex-col items-center">
          {/* Header & LANDING Label */}
          <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight mb-1">
            LIGHTS
            <br />
            <span
              className={activeLights === 'LANDING' ? 'text-amber-400 font-extrabold' : 'text-zinc-300'}
            >
              LANDING
            </span>
          </span>

          {/* Switch Row with OFF in Center Right */}
          <div className="relative flex items-center justify-center w-full">
            <div
              onMouseDown={(e) => {
                if (e.button === 0) advanceLights(); // Left-click advances UP (TAXI -> OFF -> LANDING)
                else if (e.button === 2) {
                  e.preventDefault();
                  retractLights(); // Right-click retracts DOWN (LANDING -> OFF -> TAXI)
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              title={`LIGHTS: ${activeLights} (Left-click advances UP towards LANDING, Right-click retracts DOWN towards TAXI)`}
              className={isAllowed('lights') ? 'cursor-pointer' : 'cursor-default pointer-events-none'}
            >
              <CockpitThreeWaySwitch
                position={
                  activeLights === 'LANDING'
                    ? 'UP'
                    : activeLights === 'TAXI'
                    ? 'DOWN'
                    : 'CENTER'
                }
              />
            </div>

            {/* OFF label aligned directly to the right of the center switch position */}
            <span
              className={`absolute left-[46px] top-1/2 -translate-y-1/2 text-[9.5px] font-black tracking-wider uppercase whitespace-nowrap pointer-events-none select-none ${
                activeLights === 'OFF' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
              }`}
            >
              OFF
            </span>
          </div>

          {/* TAXI Label */}
          <span
            className={`text-[10px] font-black tracking-wider uppercase text-center mt-1 ${
              activeLights === 'TAXI' ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            TAXI
          </span>
        </div>

        {/* 10. DN LOCK REL Button & L-Shaped Caution Guard */}
        <div className="absolute left-[286px] top-[256px] flex flex-col items-start">
          <div className="w-[52px] flex justify-center mb-1">
            <span className="text-[10px] font-black tracking-tight text-zinc-200 text-center uppercase leading-tight">
              DN LOCK
              <br />
              REL
            </span>
          </div>

          {/* L-Shaped Hazard Striped Guard Bracket */}
          <div
            className="relative w-[64px] h-[52px] rounded-l border border-black flex items-center shadow-md overflow-hidden"
            style={{
              backgroundImage:
                'repeating-linear-gradient(-45deg, #fbbf24 0, #fbbf24 5px, #18181b 5px, #18181b 10px)',
            }}
          >
            {/* Dark Inner Well extending to the right of the button */}
            <div className="absolute left-[7px] top-[7px] bottom-[7px] right-0 bg-[#121316] rounded-l-full border-y border-l border-black flex items-center pl-1.5">
              {/* Amber / Yellow Cap Momentary Pushbutton */}
              <button
                type="button"
                onMouseDown={handleDnLockRelDown}
                onMouseUp={handleDnLockRelUp}
                onMouseLeave={handleDnLockRelUp}
                onContextMenu={(e) => e.preventDefault()}
                title="DN LOCK REL (Momentary): Emergency Downlock Release button"
                className={`w-7 h-7 rounded-full border border-black/80 transition-transform duration-75 select-none flex items-center justify-center ${
                  isAllowed('dnLockRel') ? 'cursor-pointer' : 'cursor-default pointer-events-none'
                } ${
                  activeDnLockRel
                    ? 'bg-[#d97706] shadow-[inset_0_2px_4px_rgba(0,0,0,0.85)] scale-90'
                    : 'bg-gradient-to-b from-[#fde047] via-[#eab308] to-[#ca8a04] shadow-[0_2px_5px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.9)]'
                }`}
              />
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* 11. LANDING GEAR LEVER                                             */}
        {/* ================================================================== */}
        <div className="absolute right-3.5 top-[160px] bottom-3.5 w-14 flex flex-col items-center justify-between">
          {/* Top Label: UP */}
          <span
            className={`text-[10px] font-black tracking-wider uppercase transition-colors ${
              !isGearDown ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            UP
          </span>

          {/* Vertical Recessed Slot Track */}
          <div
            onMouseDown={(e) => {
              if (e.button === 0) setGearUp(); // Left-click advances UP (gear up)
              else if (e.button === 2) {
                e.preventDefault();
                setGearDown(); // Right-click retracts DOWN (gear down)
              }
            }}
            onContextMenu={(e) => e.preventDefault()}
            title={`LANDING GEAR: ${activeGearLever} (Left-click for UP, Right-click for DN)`}
            className={`relative w-12 h-[175px] bg-[#0c0d10] border border-black/90 rounded shadow-[inset_0_3px_8px_rgba(0,0,0,0.95)] flex flex-col items-center justify-between py-1 overflow-hidden ${
              isAllowed('gearLever') ? 'cursor-pointer' : 'cursor-default pointer-events-none'
            }`}
          >
            {/* Mechanical Guide Slot */}
            <div className="absolute inset-y-2 w-2 bg-[#050507] border-x border-[#1a1b20] shadow-inner" />

            {/* Tire Wheel Handle */}
            <div
              className="absolute left-1/2 -translate-x-1/2 w-10 h-16 rounded-md border-2 border-black/90 transition-transform duration-200 ease-out will-change-transform z-10 flex flex-col items-center justify-center shadow-2xl"
              style={{
                top: isGearDown ? '100px' : '8px',
                background: 'linear-gradient(90deg, #18181b 0%, #27272a 20%, #3f3f46 50%, #27272a 80%, #18181b 100%)',
                boxShadow: isGearDown
                  ? '0 6px 12px rgba(0,0,0,0.9), inset 0 2px 2px rgba(255,255,255,0.1)'
                  : '0 6px 12px rgba(0,0,0,0.9), inset 0 -2px 2px rgba(255,255,255,0.1)',
              }}
            >
              {/* Vertical Rubber Tire Tread Grooves */}
              <div className="absolute inset-x-1 inset-y-1 flex justify-between pointer-events-none opacity-40">
                <div className="w-[1.5px] h-full bg-black shadow-inner" />
                <div className="w-[1.5px] h-full bg-black shadow-inner" />
                <div className="w-[1.5px] h-full bg-black shadow-inner" />
                <div className="w-[1.5px] h-full bg-black shadow-inner" />
                <div className="w-[1.5px] h-full bg-black shadow-inner" />
              </div>

              {/* Translucent Red Gear Transit / Warning Light in Handle Center */}
              <div
                className={`relative w-4 h-7 rounded-sm border transition-[background-color,box-shadow] duration-150 z-20 ${
                  activeGearWarning
                    ? 'bg-[#ef4444] border-red-300 shadow-[0_0_12px_#ef4444,0_0_20px_rgba(239,68,68,0.8)]'
                    : 'bg-[#450a0a] border-red-950/80 opacity-75'
                }`}
              />
            </div>
          </div>

          {/* Bottom Label: DN */}
          <span
            className={`text-[10px] font-black tracking-wider uppercase transition-colors ${
              isGearDown ? 'text-amber-400 font-extrabold' : 'text-zinc-400'
            }`}
          >
            DN
          </span>
        </div>

        {/* L G Vertical Label positioned clearly to the left of the gear lever */}
        <div className="absolute right-[68px] top-[215px] flex flex-col items-center pointer-events-none select-none">
          <span className="text-[10px] font-black tracking-widest text-zinc-300">L</span>
          <span className="text-[10px] font-black tracking-widest text-zinc-300">G</span>
        </div>
      </div>
    </div>
  );
};
