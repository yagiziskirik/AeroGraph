'use client';

import React from 'react';
import { TelemetryData } from '../types/ipc';

interface DEDRibbonProps {
  telemetry: TelemetryData;
}

export const DEDRibbon: React.FC<DEDRibbonProps> = ({ telemetry }) => {
  return (
    <div className="h-7 w-full bg-void-0 border-b border-border-hairline px-3 flex items-center justify-between font-mono text-[11px] text-text-muted overflow-x-auto whitespace-nowrap">
      {/* Flight & Theater Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">MSN:</span>
          <span className="text-text-primary font-bold">
            {telemetry.theater ? telemetry.theater.toUpperCase() : 'STANDBY'}
          </span>
        </div>
        <span className="text-border-hairline">|</span>
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">CS:</span>
          <span className="text-accent-cyan font-bold">
            {telemetry.callsign || 'VIPER 1-1'}
          </span>
        </div>
      </div>

      {/* Radios Telemetry */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">COMM 1 (UHF):</span>
          <span className="text-accent font-semibold tracking-wider tabular-nums">
            {telemetry.uhf_freq || '305.000'}
          </span>
        </div>
        <span className="text-border-hairline">|</span>
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">COMM 2 (VHF):</span>
          <span className="text-accent font-semibold tracking-wider tabular-nums">
            {telemetry.vhf_freq || '121.500'}
          </span>
        </div>
      </div>

      {/* Navigation Vectors */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">STPT:</span>
          <span className="text-text-primary font-bold">
            #{telemetry.steerpoint_num.toString().padStart(2, '0')}
          </span>
        </div>
        <span className="text-border-hairline">|</span>
        <div className="flex items-center space-x-1">
          <span className="text-text-dim">BULLS:</span>
          <span className="text-text-primary tabular-nums">
            {telemetry.bullseye_bearing.toFixed(0).padStart(3, '0')}° /{' '}
            {telemetry.bullseye_distance.toFixed(1)}NM
          </span>
        </div>
        <span className="text-border-hairline">|</span>
        <div className="flex items-center space-x-1.5">
          <span className="text-text-dim">SIM:</span>
          <span
            className={`font-bold ${
              telemetry.is_3d
                ? 'text-accent-phosphor'
                : telemetry.bms_running
                ? 'text-accent-cyan'
                : 'text-accent-coral'
            }`}
          >
            {telemetry.is_3d
              ? '3D IN-FLIGHT'
              : telemetry.bms_running
              ? 'CONNECTED (2D)'
              : 'OFFLINE'}
          </span>
        </div>
      </div>
    </div>
  );
};
