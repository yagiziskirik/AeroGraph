'use client';

import React, { useId } from 'react';

export interface RpmIndicatorProps {
  value?: number;
  className?: string;
}

export const RpmIndicator: React.FC<RpmIndicatorProps> = ({
  value = 0,
  className = '',
}) => {
  const componentId = useId();
  const clampedVal = Math.max(0, Math.min(100, value));

  const getAngle = (v: number): number => {
    if (v <= 60) {
      return (v * 115) / 60;
    }
    return 115 + ((v - 60) * (330 - 115)) / 40;
  };

  const needleAngle = getAngle(clampedVal);

  const cx = 78;
  const cy = 78;
  const rDial = 71.5;
  const rOut = 71.5;
  const rInMajor = 59;
  const rInMinor = 65.5;
  const rText = 47;
  const rNeedle = 67;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const ticks: {
    val: number;
    angle: number;
    isMajor: boolean;
    color: string;
    label?: string;
  }[] = [];

  for (let v = 0; v <= 60; v += 5) {
    const angle = getAngle(v);
    const isMajor = v % 10 === 0;
    let color = '#e2e8f0';
    if (v === 25 || v === 40) {
      color = '#22c55e';
    }
    const label = v % 20 === 0 ? String(v) : undefined;
    ticks.push({ val: v, angle, isMajor, color, label });
  }

  for (let v = 61; v <= 100; v++) {
    const angle = getAngle(v);
    const isMajor = v % 5 === 0;
    let color = '#e2e8f0';
    if (v === 96) {
      color = '#ef4444';
    }
    const label = v % 10 === 0 ? String(v) : undefined;
    ticks.push({ val: v, angle, isMajor, color, label });
  }

  return (
    <div
      id={componentId}
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: '156px', height: '156px' }}
    >
      <svg
        viewBox="0 0 156 156"
        className="w-[156px] h-[156px] overflow-visible select-none"
      >
        <defs>
          <linearGradient id="rpmBezel" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2c3038" />
            <stop offset="60%" stopColor="#111317" />
            <stop offset="100%" stopColor="#08090b" />
          </linearGradient>
          <radialGradient id="rpmDial" cx="45%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#1a2230" />
            <stop offset="65%" stopColor="#131923" />
            <stop offset="100%" stopColor="#0c1017" />
          </radialGradient>
          <radialGradient id="rpmHub" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#262a33" />
            <stop offset="85%" stopColor="#0f1115" />
          </radialGradient>
          <filter id="rpmShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        <circle
          cx={cx}
          cy={cy}
          r={76}
          fill="url(#rpmBezel)"
          stroke="#000"
          strokeWidth="1"
        />

        <circle
          cx={cx}
          cy={cy}
          r={rDial}
          fill="url(#rpmDial)"
          stroke="#1e2430"
          strokeWidth="0.8"
        />

        {ticks.map(({ val, angle, isMajor, color, label }) => {
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
                stroke={color}
                strokeWidth={isMajor ? 2.5 : 1.5}
                strokeLinecap="round"
              />
              {textEl}
            </g>
          );
        })}

        <text
          x={cx}
          y={47}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#cbd5e1"
          fontSize="11"
          fontWeight="900"
          fontFamily="monospace"
          letterSpacing="0.5"
        >
          RPM
        </text>
        <text
          x={cx}
          y={57}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize="10"
          fontWeight="800"
          fontFamily="monospace"
          letterSpacing="0.4"
        >
          PERCENT
        </text>

        <g
          filter="url(#rpmShadow)"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: `${cx}px ${cy}px`,
            transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <polygon
            points={`
              ${cx},${cy - rNeedle}
              ${cx + 2.0},${cy}
              ${cx + 1.5},${cy + 13}
              ${cx - 1.5},${cy + 13}
              ${cx - 2.0},${cy}
            `}
            fill="#f8fafc"
          />
          <rect
            x={cx - 1.5}
            y={cy + 1}
            width={3.0}
            height={12}
            fill="#64748b"
            rx={0.5}
          />
        </g>

        <circle
          cx={cx}
          cy={cy}
          r={10.5}
          fill="url(#rpmHub)"
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
