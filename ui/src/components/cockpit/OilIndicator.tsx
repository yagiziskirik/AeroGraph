'use client';

import React, { useId } from 'react';

export interface OilIndicatorProps {
  value?: number;
  className?: string;
}

export const OilIndicator: React.FC<OilIndicatorProps> = ({
  value = 0,
  className = '',
}) => {
  const componentId = useId();
  const clampedVal = Math.max(0, Math.min(100, value));

  const needleAngle = 110 + clampedVal * 3.2;

  const cx = 58;
  const cy = 58;
  const rDial = 52.5;
  const rOut = 52.5;
  const rInMajor = 44;
  const rInMinor = 48;
  const rText = 35;
  const rNeedle = 49;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const ticks: {
    val: number;
    angle: number;
    isMajor: boolean;
    label?: string;
  }[] = [];

  for (let v = 0; v <= 100; v += 5) {
    const angle = 110 + v * 3.2;
    const isMajor = v % 10 === 0;
    const label = v % 20 === 0 ? String(v) : undefined;
    ticks.push({ val: v, angle, isMajor, label });
  }

  const oilLabelAngle = 110 + 20 * 3.2;
  const oilLabelRad = toRad(oilLabelAngle);
  const oilTextX = cx + 15 * Math.sin(oilLabelRad);
  const oilTextY = cy - 19.5 * Math.cos(oilLabelRad);

  return (
    <div
      id={componentId}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: '116px', height: '116px' }}
    >
      <svg
        viewBox="0 0 116 116"
        className="w-[116px] h-[116px] overflow-visible select-none"
      >
        <defs>
          <linearGradient id="oilBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="60%" stopColor="#111317" />
            <stop offset="100%" stopColor="#08090b" />
          </linearGradient>
          <radialGradient id="oilDial" cx="45%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#1a2230" />
            <stop offset="65%" stopColor="#131923" />
            <stop offset="100%" stopColor="#0c1017" />
          </radialGradient>
          <radialGradient id="oilHub" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#262a33" />
            <stop offset="85%" stopColor="#0f1115" />
          </radialGradient>
          <filter id="oilShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={56}
          fill="url(#oilBezel)"
          stroke="#000"
          strokeWidth="1"
        />

        <circle
          cx={cx}
          cy={cy}
          r={rDial}
          fill="url(#oilDial)"
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
                fontSize="10"
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
          x={oilTextX}
          y={oilTextY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#cbd5e1"
          fontSize="12"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          OIL
        </text>

        <g
          filter="url(#oilShadow)"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <polygon
            points={`
              ${cx},${cy - rNeedle}
              ${cx + 1.6},${cy}
              ${cx + 1.2},${cy + 9}
              ${cx - 1.2},${cy + 9}
              ${cx - 1.6},${cy}
            `}
            fill="#f8fafc"
          />
          <rect
            x={cx - 1.2}
            y={cy + 1}
            width={2.4}
            height={8}
            fill="#64748b"
            rx={0.5}
          />
        </g>

        <circle
          cx={cx}
          cy={cy}
          r={8}
          fill="url(#oilHub)"
          stroke="#090b0e"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={1.5}
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
