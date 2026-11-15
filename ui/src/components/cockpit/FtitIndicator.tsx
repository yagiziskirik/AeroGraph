'use client';

import React, { useId } from 'react';

export interface FtitIndicatorProps {
  value?: number;
  className?: string;
}

export const FtitIndicator: React.FC<FtitIndicatorProps> = ({
  value = 1.0,
  className = '',
}) => {
  const componentId = useId();
  const clampedVal = Math.max(0, Math.min(12, value));

  const getAngle = (v: number): number => {
    if (v <= 7) {
      return 85 + (v * 125) / 7;
    }
    if (v <= 10) {
      return 210 + (v - 7) * 60;
    }
    return 390 + (v - 10) * 20;
  };

  const needleAngle = getAngle(clampedVal);

  const cx = 84;
  const cy = 84;
  const rDial = 77;
  const rOut = 77;
  const rInMajor = 63.5;
  const rInMinor = 70;
  const rText = 51;
  const rNeedle = 73;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const ticks: {
    val: number;
    angle: number;
    isMajor: boolean;
    label?: string;
  }[] = [];

  for (let v = 4; v <= 14; v++) {
    const val = v / 2;
    const angle = getAngle(val);
    const isMajor = v % 2 === 0;
    const label = isMajor ? String(val) : undefined;
    ticks.push({ val, angle, isMajor, label });
  }

  for (let v = 71; v <= 100; v++) {
    const val = Math.round(v) / 10;
    const angle = getAngle(val);
    const isMajor = v % 5 === 0;
    const label = v % 10 === 0 ? String(val) : undefined;
    ticks.push({ val, angle, isMajor, label });
  }

  for (let v = 21; v <= 24; v++) {
    const val = v / 2;
    const angle = getAngle(val);
    const isMajor = v % 2 === 0;
    const label = isMajor ? String(val) : undefined;
    ticks.push({ val, angle, isMajor, label });
  }

  return (
    <div
      id={componentId}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: '168px', height: '168px' }}
    >
      <svg
        viewBox="0 0 168 168"
        className="w-[168px] h-[168px] overflow-visible select-none"
      >
        <defs>
          <linearGradient id="ftitBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="60%" stopColor="#111317" />
            <stop offset="100%" stopColor="#08090b" />
          </linearGradient>
          <radialGradient id="ftitDial" cx="45%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#1a2230" />
            <stop offset="65%" stopColor="#131923" />
            <stop offset="100%" stopColor="#0c1017" />
          </radialGradient>
          <radialGradient id="ftitHub" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#262a33" />
            <stop offset="85%" stopColor="#0f1115" />
          </radialGradient>
          <filter id="ftitShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={82}
          fill="url(#ftitBezel)"
          stroke="#000"
          strokeWidth="1"
        />

        <circle
          cx={cx}
          cy={cy}
          r={rDial}
          fill="url(#ftitDial)"
          stroke="#1e2430"
          strokeWidth="0.8"
        />

        {ticks.map(({ val, angle, isMajor, label }) => {
          const rad = toRad(angle);
          const sin = Math.sin(rad);
          const cos = Math.cos(rad);
          const x1 = cx + (isMajor ? rInMajor : rInMinor) * sin;
          const y1 = cy - (isMajor ? rInMajor : rInMinor) * cos;
          const x2 = cx + rOut * sin;
          const y2 = cy - rOut * cos;

          let textEl = null;
          if (label !== undefined) {
            const tx = cx + rText * sin;
            const ty = cy - rText * cos;
            textEl = (
              <text
                key={`text-${val}`}
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#e2e8f0"
                fontSize="11"
                fontWeight="800"
                fontFamily="monospace"
              >
                {label}
              </text>
            );
          }

          return (
            <g key={`tick-${val}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#e2e8f0"
                strokeWidth={isMajor ? 2.5 : 1.5}
                strokeLinecap="round"
              />
              {textEl}
            </g>
          );
        })}

        <text
          x={cx}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          FTIT
        </text>
        <text
          x={cx}
          y={61}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize="10"
          fontWeight="800"
          fontFamily="monospace"
          letterSpacing="0.4"
        >
          C x 100
        </text>

        <g
          filter="url(#ftitShadow)"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <polygon
            points={`
              ${cx},${cy - rNeedle}
              ${cx + 2.2},${cy}
              ${cx + 1.6},${cy + 14}
              ${cx - 1.6},${cy + 14}
              ${cx - 2.2},${cy}
            `}
            fill="#f8fafc"
          />
          <rect
            x={cx - 1.6}
            y={cy + 1}
            width={3.2}
            height={13}
            fill="#64748b"
            rx={0.5}
          />
        </g>

        <circle
          cx={cx}
          cy={cy}
          r={11}
          fill="url(#ftitHub)"
          stroke="#090b0e"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={1.8}
          fill="#cbd5e1"
          stroke="#000"
          strokeWidth="0.5"
        />

        <circle
          cx={cx}
          cy={cy}
          r={rDial}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
          pointerEvents="none"
        />
      </svg>
    </div>
  );
};
