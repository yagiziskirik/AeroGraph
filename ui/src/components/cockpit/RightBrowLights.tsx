'use client';

import React, { useState, useId } from 'react';
import { Sound } from '../../services/sound';

export interface RightBrowLightsState {
  engFire?: boolean;
  engine?: boolean;
  hydOilPress?: boolean;
  flcs?: boolean;
  dbuOn?: boolean;
  toLdgConfig?: boolean;
  canopy?: boolean;
  oxyLow?: boolean;
}

export interface RightBrowLightsProps {
  lights?: RightBrowLightsState;
  onLightClick?: (lightKey: keyof RightBrowLightsState) => void;
  allowLightInteractivity?: boolean;
  rotationDeg?: number;
  className?: string;
}

export const RightBrowLights: React.FC<RightBrowLightsProps> = ({
  lights: controlledLights,
  onLightClick,
  allowLightInteractivity = false,
  rotationDeg = 0,
  className = '',
}) => {
  const componentId = useId();

  const [internalLights, setInternalLights] = useState<RightBrowLightsState>({
    engFire: false,
    engine: false,
    hydOilPress: false,
    flcs: false,
    dbuOn: false,
    toLdgConfig: false,
    canopy: false,
    oxyLow: false,
  });

  const activeLights: RightBrowLightsState = {
    ...internalLights,
    ...(controlledLights || {}),
  };

  const handleToggle = (key: keyof RightBrowLightsState) => {
    if (!allowLightInteractivity) return;
    Sound.playClick();
    if (onLightClick) {
      onLightClick(key);
    } else {
      setInternalLights((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  };

  return (
    <div
      id={componentId}
      className={`inline-flex items-center select-none will-change-transform ${className}`}
      style={{
        transform: `rotate(${rotationDeg}deg)`,
        transformOrigin: 'left center',
      }}
    >
      <div
        className="bg-[#0e0f13] border border-[#21232a] rounded p-1 shadow-2xl flex items-center space-x-0.5"
        style={{
          boxShadow:
            '0 12px 24px -6px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08)',
        }}
      >
        <SplitDualLight
          topLabel="ENG FIRE"
          topIsOn={!!activeLights.engFire}
          onTopClick={() => handleToggle('engFire')}
          bottomLabel="ENGINE"
          bottomIsOn={!!activeLights.engine}
          onBottomClick={() => handleToggle('engine')}
          allowInteractivity={allowLightInteractivity}
        />

        <UnifiedSingleLight
          topLabel="HYD/OIL"
          bottomLabel="PRESS"
          isOn={!!activeLights.hydOilPress}
          onClick={() => handleToggle('hydOilPress')}
          allowInteractivity={allowLightInteractivity}
        />

        <SplitDualLight
          topLabel="FLCS"
          topIsOn={!!activeLights.flcs}
          onTopClick={() => handleToggle('flcs')}
          bottomLabel="DBU ON"
          bottomIsOn={!!activeLights.dbuOn}
          onBottomClick={() => handleToggle('dbuOn')}
          allowInteractivity={allowLightInteractivity}
        />

        <UnifiedSingleLight
          topLabel="TO/LDG"
          bottomLabel="CONFIG"
          isOn={!!activeLights.toLdgConfig}
          onClick={() => handleToggle('toLdgConfig')}
          allowInteractivity={allowLightInteractivity}
        />

        <SplitDualLight
          topLabel="CANOPY"
          topIsOn={!!activeLights.canopy}
          onTopClick={() => handleToggle('canopy')}
          bottomLabel="OXY LOW"
          bottomIsOn={!!activeLights.oxyLow}
          onBottomClick={() => handleToggle('oxyLow')}
          allowInteractivity={allowLightInteractivity}
        />
      </div>
    </div>
  );
};

interface SplitDualLightProps {
  topLabel: string;
  topIsOn: boolean;
  onTopClick?: () => void;
  bottomLabel: string;
  bottomIsOn: boolean;
  onBottomClick?: () => void;
  allowInteractivity?: boolean;
}

const SplitDualLight: React.FC<SplitDualLightProps> = ({
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
      <div
        onMouseDown={allowInteractivity && topLabel ? onTopClick : undefined}
        title={topLabel ? `${topLabel}: ${topIsOn ? 'ON' : 'OFF'}` : undefined}
        className={`flex-1 flex items-center justify-center border-b border-[#1c1d22] bg-[#0c0d10] select-none ${
          allowInteractivity && topLabel ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
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
      </div>

      <div
        onMouseDown={allowInteractivity && bottomLabel ? onBottomClick : undefined}
        title={bottomLabel ? `${bottomLabel}: ${bottomIsOn ? 'ON' : 'OFF'}` : undefined}
        className={`flex-1 flex items-center justify-center bg-[#0c0d10] select-none ${
          allowInteractivity && bottomLabel ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
        }`}
      >
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
      </div>
    </div>
  );
};

interface UnifiedSingleLightProps {
  topLabel: string;
  bottomLabel: string;
  isOn: boolean;
  onClick?: () => void;
  allowInteractivity?: boolean;
}

const UnifiedSingleLight: React.FC<UnifiedSingleLightProps> = ({
  topLabel,
  bottomLabel,
  isOn,
  onClick,
  allowInteractivity = false,
}) => {
  return (
    <div
      onMouseDown={allowInteractivity ? onClick : undefined}
      title={`${topLabel} ${bottomLabel}: ${isOn ? 'ON' : 'OFF'}`}
      className={`w-[58px] h-[58px] min-w-[58px] min-h-[58px] max-w-[58px] max-h-[58px] bg-[#0c0d10] border border-[#262830] rounded flex flex-col items-center justify-center space-y-1 shadow-inner overflow-hidden select-none ${
        allowInteractivity ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-default'
      }`}
    >
      <span
        className={`text-[8.5px] font-black font-mono tracking-tight leading-none uppercase transition-[color,text-shadow] duration-100 ${
          isOn ? 'text-[#FFB347]' : 'text-[#352a1a]'
        }`}
        style={{
          textShadow: isOn
            ? '0 0 3px #FFA726, 0 0 8px rgba(255, 150, 0, 0.9), 0 0 16px rgba(255, 120, 0, 0.6)'
            : 'none',
        }}
      >
        {topLabel}
      </span>
      <span
        className={`text-[8.5px] font-black font-mono tracking-tight leading-none uppercase transition-[color,text-shadow] duration-100 ${
          isOn ? 'text-[#FFB347]' : 'text-[#352a1a]'
        }`}
        style={{
          textShadow: isOn
            ? '0 0 3px #FFA726, 0 0 8px rgba(255, 150, 0, 0.9), 0 0 16px rgba(255, 120, 0, 0.6)'
            : 'none',
        }}
      >
        {bottomLabel}
      </span>
    </div>
  );
};
