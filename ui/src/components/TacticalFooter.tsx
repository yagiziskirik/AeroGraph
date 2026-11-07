'use client';

import React from 'react';
import { TelemetryData } from '../types/ipc';

interface TacticalFooterProps {
  telemetry: TelemetryData;
  profileName: string;
}

export const TacticalFooter: React.FC<TacticalFooterProps> = ({
  telemetry,
  profileName,
}) => {
  return (
    <footer className="h-8 w-full bg-void-1 border-t border-border-hairline px-4 flex items-center justify-between font-mono text-[11px] text-text-dim select-none">
      {/* Flight Telemetry Status */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-text-primary font-semibold tracking-wider">
            {telemetry.bms_running ? 'FALCON BMS ONLINE' : 'SIMULATOR STANDBY'}
          </span>
        </div>

        <span className="text-border-hairline">|</span>

        <span className={telemetry.is_3d ? 'text-accent-phosphor font-bold' : 'text-text-dim'}>
          {telemetry.is_3d ? '3D TACTICAL FLIGHT' : '2D UI / TACTICAL LOBBY'}
        </span>

        <span className="text-border-hairline hidden md:inline">|</span>

        <span className="hidden md:inline text-text-muted">
          THEATER: <span className="text-text-primary">{telemetry.theater || 'KOREA 4.38'}</span>
        </span>

        <span className="text-border-hairline hidden lg:inline">|</span>

        <span className="hidden lg:inline text-text-muted">
          CALLSIGN: <span className="text-text-primary">{telemetry.callsign || 'VIPER 1-1'}</span>
        </span>
      </div>

      {/* Right Side: Active Profile & Host Engine Status */}
      <div className="flex items-center space-x-3">
        <span className="text-text-muted truncate max-w-[240px]">
          PROFILE: <span className="text-text-primary">{profileName}</span>
        </span>

        <span className="text-border-hairline">|</span>

        <span className="text-[10px] text-text-dim tracking-wider uppercase">
          HOST: 25Hz RUST
        </span>
      </div>
    </footer>
  );
};
