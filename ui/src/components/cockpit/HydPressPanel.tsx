'use client';

import React, { useId } from 'react';

export interface HydPressPanelProps {
  pressA?: number;
  pressB?: number;
  className?: string;
}

export const HydPressPanel: React.FC<HydPressPanelProps> = ({
  pressA = 0,
  pressB = 0,
  className = '',
}) => {
  const panelId = useId();

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        id={panelId}
        className="relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-2.5 w-[218px] min-w-[218px] max-w-[218px] h-[268px] min-h-[268px] text-zinc-300 font-mono select-none overflow-hidden"
        style={{
          boxShadow:
            '0 20px 40px -15px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-2 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-2 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-2 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-2 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        <div className="relative w-full h-full">
          <div
            className="absolute left-[10px] top-[10px] w-[184px] h-[132px] pointer-events-none z-20"
            style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.9))' }}
          >
            <svg viewBox="0 0 184 132" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="hydPlacardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e2026" />
                  <stop offset="30%" stopColor="#131418" />
                  <stop offset="100%" stopColor="#0a0b0e" />
                </linearGradient>
                <radialGradient id="screwGrad" cx="35%" cy="35%" r="70%">
                  <stop offset="0%" stopColor="#323640" />
                  <stop offset="70%" stopColor="#1a1c22" />
                  <stop offset="100%" stopColor="#0b0c0e" />
                </radialGradient>
              </defs>

              <path
                d="
                  M 6 6
                  L 92 6
                  C 96 6, 99 8, 102 12
                  L 126 38
                  C 129 42, 133 44, 138 44
                  L 174 44
                  C 178 44, 180 46, 180 50
                  L 180 126
                  C 180 130, 178 132, 174 132
                  L 120 132
                  C 116 132, 114 130, 114 126
                  L 114 86
                  C 114 80, 110 74, 104 70
                  C 98 66, 92 64, 84 64
                  L 6 64
                  C 2 64, 0 62, 0 58
                  L 0 12
                  C 0 8, 2 6, 6 6
                  Z
                "
                fill="url(#hydPlacardGrad)"
                stroke="#2a2e38"
                strokeWidth="0.9"
              />

              <text
                x="44"
                y="27"
                textAnchor="middle"
                fill="#f1f5f9"
                fontSize="9"
                fontWeight="900"
                fontFamily="monospace"
                letterSpacing="0.4"
              >
                HYD PRESS
              </text>
              <text
                x="44"
                y="48"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12.5"
                fontWeight="900"
                fontFamily="monospace"
              >
                A
              </text>

              <g transform="translate(118, 38)">
                <circle cx="0" cy="0" r="5.5" fill="url(#screwGrad)" stroke="#050608" strokeWidth="0.8" />
                <line x1="-3" y1="0" x2="3" y2="0" stroke="#525866" strokeWidth="1.2" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#525866" strokeWidth="1.2" />
              </g>

              <g transform="translate(150, 78)">
                <line x1="-3" y1="0" x2="3" y2="0" stroke="#f1f5f9" strokeWidth="1.6" strokeLinecap="square" />
                <line x1="0" y1="-3" x2="0" y2="3" stroke="#f1f5f9" strokeWidth="1.6" strokeLinecap="square" />
              </g>

              <text
                x="136"
                y="114"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12.5"
                fontWeight="900"
                fontFamily="monospace"
              >
                B
              </text>
            </svg>
          </div>

          <div className="absolute left-[12px] top-[80px] z-10">
            <HydDial value={pressA} idSuffix="A" />
          </div>

          <div className="absolute left-[100px] top-[148px] z-10">
            <HydDial value={pressB} idSuffix="B" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface HydDialProps {
  value: number;
  idSuffix: string;
}

const HydDial: React.FC<HydDialProps> = ({ value, idSuffix }) => {
  const clampedVal = Math.max(0, Math.min(4, value));
  const needleAngle = 100 + clampedVal * 85;

  const cx = 42;
  const cy = 42;
  const rDial = 38;
  const rOut = 38;
  const rIn = 29;
  const rText = 22;
  const rNeedle = 36;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const ticks: {
    val: number;
    angle: number;
    isMajor: boolean;
    label?: string;
  }[] = [];

  for (let i = 0; i <= 8; i++) {
    const val = i * 0.5;
    const angle = 100 + val * 85;
    const isMajor = i % 2 === 0;
    const label = isMajor ? String(val) : undefined;
    ticks.push({ val, angle, isMajor, label });
  }

  return (
    <svg
      viewBox="0 0 84 84"
      className="w-[84px] h-[84px] overflow-visible select-none"
    >
      <defs>
        <linearGradient id={`hydBezel-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2c3038" />
          <stop offset="60%" stopColor="#111317" />
          <stop offset="100%" stopColor="#08090b" />
        </linearGradient>
        <radialGradient id={`hydDial-${idSuffix}`} cx="45%" cy="42%" r="55%">
          <stop offset="0%" stopColor="#1a2230" />
          <stop offset="65%" stopColor="#131923" />
          <stop offset="100%" stopColor="#0c1017" />
        </radialGradient>
        <radialGradient id={`hydHub-${idSuffix}`} cx="35%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#262a33" />
          <stop offset="85%" stopColor="#0f1115" />
        </radialGradient>
        <filter id={`hydShadow-${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      <circle
        cx={cx}
        cy={cy}
        r={41}
        fill={`url(#hydBezel-${idSuffix})`}
        stroke="#000"
        strokeWidth="1"
      />

      <circle
        cx={cx}
        cy={cy}
        r={rDial}
        fill={`url(#hydDial-${idSuffix})`}
        stroke="#1e2430"
        strokeWidth="0.8"
      />

      {ticks.map(({ val, angle, isMajor, label }) => {
        const rad = toRad(angle);
        const sin = Math.sin(rad);
        const cos = Math.cos(rad);
        const x1 = cx + rIn * sin;
        const y1 = cy - rIn * cos;
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
              fontSize="8.5"
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
              strokeWidth={isMajor ? 2.2 : 1.2}
              strokeLinecap="round"
            />
            {textEl}
          </g>
        );
      })}

      <text
        x={cx}
        y={28}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#cbd5e1"
        fontSize="7"
        fontWeight="900"
        fontFamily="monospace"
        letterSpacing="0.4"
      >
        HYD
      </text>
      <text
        x={cx}
        y={56}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#94a3b8"
        fontSize="6"
        fontWeight="800"
        fontFamily="monospace"
        letterSpacing="0.3"
      >
        x 1000
      </text>

      <g
        filter={`url(#hydShadow-${idSuffix})`}
        style={{
          transform: `rotate(${needleAngle}deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <polygon
          points={`
            ${cx},${cy - rNeedle}
            ${cx + 2.4},${cy - 12}
            ${cx - 2.4},${cy - 12}
          `}
          fill="#f8fafc"
        />
        <rect
          x={cx - 2.4}
          y={cy - 12}
          width={4.8}
          height={16}
          fill="#475569"
          rx={0.5}
        />
      </g>

      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={`url(#hydHub-${idSuffix})`}
        stroke="#090b0e"
        strokeWidth="1"
      />
      <circle
        cx={cx}
        cy={cy}
        r={1.2}
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
  );
};
