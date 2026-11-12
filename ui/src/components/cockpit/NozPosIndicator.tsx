'use client';

import React, { useId } from 'react';

export interface NozPosIndicatorProps {
  value?: number;
  className?: string;
}

export const NozPosIndicator: React.FC<NozPosIndicatorProps> = ({
  value = 0,
  className = '',
}) => {
  const componentId = useId();
  const clampedVal = Math.max(0, Math.min(100, value));

  const needleAngle = 50 + clampedVal * 2.6;

  const cx = 68;
  const cy = 68;
  const rDial = 62.5;
  const rOut = 62.5;
  const rInMajor = 51.5;
  const rInMinor = 56.5;
  const rText = 40;
  const rNeedle = 58;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const ticks: {
    val: number;
    angle: number;
    isMajor: boolean;
    label?: string;
  }[] = [];

  for (let v = 0; v <= 100; v += 10) {
    const angle = 50 + v * 2.6;
    const isMajor = v % 20 === 0;
    const label = isMajor ? String(v) : undefined;
    ticks.push({ val: v, angle, isMajor, label });
  }

  return (
    <div
      id={componentId}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: '136px', height: '136px' }}
    >
      <svg
        viewBox="0 0 136 136"
        className="w-[136px] h-[136px] overflow-visible select-none"
      >
        <defs>
          <linearGradient id="nozBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="60%" stopColor="#111317" />
            <stop offset="100%" stopColor="#08090b" />
          </linearGradient>
          <radialGradient id="nozDial" cx="45%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#1a2230" />
            <stop offset="65%" stopColor="#131923" />
            <stop offset="100%" stopColor="#0c1017" />
          </radialGradient>
          <radialGradient id="nozHub" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#262a33" />
            <stop offset="85%" stopColor="#0f1115" />
          </radialGradient>
          <filter id="nozShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={66}
          fill="url(#nozBezel)"
          stroke="#000"
          strokeWidth="1"
        />

        <circle
          cx={cx}
          cy={cy}
          r={rDial}
          fill="url(#nozDial)"
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
          y={21}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          NOZ POS
        </text>
        <text
          x={cx}
          y={31}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize="10"
          fontWeight="800"
          fontFamily="monospace"
          letterSpacing="0.4"
        >
          % OPEN
        </text>

        <g
          filter="url(#nozShadow)"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <polygon
            points={`
              ${cx},${cy - rNeedle}
              ${cx + 1.8},${cy}
              ${cx + 1.4},${cy + 11}
              ${cx - 1.4},${cy + 11}
              ${cx - 1.8},${cy}
            `}
            fill="#f8fafc"
          />
          <rect
            x={cx - 1.4}
            y={cy + 1}
            width={2.8}
            height={10}
            fill="#64748b"
            rx={0.5}
          />
        </g>

        <circle
          cx={cx}
          cy={cy}
          r={9.5}
          fill="url(#nozHub)"
          stroke="#090b0e"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={1.6}
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
