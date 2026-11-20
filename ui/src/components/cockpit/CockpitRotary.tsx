'use client';

import React, { useId } from 'react';

/* -------------------------------------------------------------------------- */
/* 1. CockpitRoundKnob (Authentic YAW TRIM Clean Circular Dial)              */
/* -------------------------------------------------------------------------- */

export interface CockpitRoundKnobProps {
  /** Rotation angle in degrees (0 = pointer pointing right at 3 o'clock / +X) */
  rotation?: number;
  /** Knob pixel diameter (default: 48, matching original YAW TRIM) */
  size?: number;
  /** Optional center X coordinate when embedded directly inside an SVG */
  cx?: number;
  /** Optional center Y coordinate when embedded directly inside an SVG */
  cy?: number;
  /** Whether the knob is interactive */
  interactive?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const CockpitRoundKnob: React.FC<CockpitRoundKnobProps> = ({
  rotation = 0,
  size = 48,
  cx,
  cy,
  interactive = true,
  className = '',
  onClick,
  onContextMenu,
  onMouseDown,
}) => {
  const knobId = useId();
  const gradId = `roundKnobGrad-${knobId}`;
  const r = size / 2;
  const scale = size / 48;

  // Direct SVG <g> render when embedded inside an existing parent SVG (e.g. YawTrimDial)
  if (cx !== undefined && cy !== undefined) {
    return (
      <g
        transform={`rotate(${rotation}, ${cx}, ${cy})`}
        style={{ willChange: 'transform', transition: 'transform 70ms linear' }}
        className={className}
        onClick={interactive ? onClick : undefined}
        onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        <defs>
          <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="60%" stopColor="#d4d4d8" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </radialGradient>
        </defs>

        {/* Large Knob Body: 48px diameter (r = 24), clean whitish-gray metallic surface */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#${gradId})`}
          stroke="#71717a"
          strokeWidth={1.2 * scale}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
          }}
        />

        {/* Clean Inner Rim */}
        <circle
          cx={cx}
          cy={cy}
          r={r - 1.5 * scale}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth={0.8 * scale}
        />

        {/* Indicator Line: Thick White with Bold Black Border Running Across to Edge */}
        <line
          x1={cx + 3 * scale}
          y1={cy}
          x2={cx + r - 0.5 * scale}
          y2={cy}
          stroke="#000000"
          strokeWidth={4.2 * scale}
          strokeLinecap="round"
        />
        <line
          x1={cx + 4 * scale}
          y1={cy}
          x2={cx + r - 1 * scale}
          y2={cy}
          stroke="#ffffff"
          strokeWidth={2.2 * scale}
          strokeLinecap="round"
        />
      </g>
    );
  }

  // Standalone HTML element render
  return (
    <div
      onClick={interactive ? onClick : undefined}
      onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
      onMouseDown={interactive ? onMouseDown : undefined}
      className={`inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
      >
        <defs>
          <radialGradient id={gradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="60%" stopColor="#d4d4d8" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </radialGradient>
        </defs>

        <g
          transform={`rotate(${rotation}, ${r}, ${r})`}
          style={{ willChange: 'transform', transition: 'transform 70ms linear' }}
        >
          <circle
            cx={r}
            cy={r}
            r={r}
            fill={`url(#${gradId})`}
            stroke="#71717a"
            strokeWidth={1.2 * scale}
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
            }}
          />

          <circle
            cx={r}
            cy={r}
            r={r - 1.5 * scale}
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={0.8 * scale}
          />

          <line
            x1={r + 3 * scale}
            y1={r}
            x2={r + r - 0.5 * scale}
            y2={r}
            stroke="#000000"
            strokeWidth={4.2 * scale}
            strokeLinecap="round"
          />
          <line
            x1={r + 4 * scale}
            y1={r}
            x2={r + r - 1 * scale}
            y2={r}
            stroke="#ffffff"
            strokeWidth={2.2 * scale}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. CockpitPointerKnob (Elongated Pentagon Pointer for ENG FEED & Selectors) */
/* -------------------------------------------------------------------------- */

export interface CockpitPointerKnobProps {
  /** Rotation angle in degrees (0 = pointer pointing right at 3 o'clock / +X) */
  rotation?: number;
  /** Knob pixel diameter (default: 58) */
  size?: number;
  /** Optional center X coordinate when embedded directly inside an SVG */
  cx?: number;
  /** Optional center Y coordinate when embedded directly inside an SVG */
  cy?: number;
  /** Whether the knob is interactive */
  interactive?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const CockpitPointerKnob: React.FC<CockpitPointerKnobProps> = ({
  rotation = 0,
  size = 58,
  cx,
  cy,
  interactive = true,
  className = '',
  onClick,
  onContextMenu,
  onMouseDown,
}) => {
  const knobId = useId();
  const skirtGradId = `pointerSkirtGrad-${knobId}`;
  const topFacetGradId = `topFacetGrad-${knobId}`;
  const bottomFacetGradId = `bottomFacetGrad-${knobId}`;
  const shadowId = `pointerShadow-${knobId}`;

  const renderContent = (originX: number, originY: number) => {
    // Exact circle skirt radius
    const r = (size / 2) * (27 / 29);
    const scale = size / 58;

    return (
      <>
        <defs>
          {/* Base skirt radial metallic gradient */}
          <radialGradient id={skirtGradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="55%" stopColor="#d4d4d8" />
            <stop offset="85%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#71717a" />
          </radialGradient>

          {/* Top Raised Facet Gradient (Lit from above) */}
          <linearGradient id={topFacetGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="35%" stopColor="#f4f4f5" />
            <stop offset="100%" stopColor="#d4d4d8" />
          </linearGradient>

          {/* Bottom Raised Facet Gradient (Shaded from below) */}
          <linearGradient id={bottomFacetGradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#b4b4bb" />
            <stop offset="60%" stopColor="#94949e" />
            <stop offset="100%" stopColor="#71717a" />
          </linearGradient>
        </defs>

        {/* Base Circular Skirt */}
        <circle
          cx={originX}
          cy={originY}
          r={r}
          fill={`url(#${skirtGradId})`}
          stroke="#71717a"
          strokeWidth={1 * scale}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
        />
        <circle
          cx={originX}
          cy={originY}
          r={r - 1.2 * scale}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth={0.7 * scale}
        />

        {/* Rotating 3D Raised Pointer Extension (End-to-End Elongated Pentagon) */}
        {/* CSS drop-shadow on the group provides a fixed downward shadow without internal facet self-shadowing */}
        <g
          transform={`rotate(${rotation}, ${originX}, ${originY})`}
          style={{
            willChange: 'transform',
            transition: 'transform 90ms ease-out',
            filter: 'drop-shadow(0 2px 3.5px rgba(0,0,0,0.6))',
          }}
        >
          {/* 1. Top Facet */}
          <path
            d={`
              M ${originX + r},${originY}
              L ${originX + 7 * scale},${originY - 11 * scale}
              L ${originX - 18 * scale},${originY - 9 * scale}
              A ${11 * scale} ${11 * scale} 0 0 0 ${originX - r},${originY}
              L ${originX + r},${originY}
              Z
            `}
            fill={`url(#${topFacetGradId})`}
          />

          {/* 2. Bottom Facet (Angled shadow facet) */}
          <path
            d={`
              M ${originX + r},${originY}
              L ${originX - r},${originY}
              A ${11 * scale} ${11 * scale} 0 0 0 ${originX - 18 * scale},${originY + 9 * scale}
              L ${originX + 7 * scale},${originY + 11 * scale}
              L ${originX + r},${originY}
              Z
            `}
            fill={`url(#${bottomFacetGradId})`}
          />

          {/* 3. Outer Perimeter Border */}
          <path
            d={`
              M ${originX + r},${originY}
              L ${originX + 7 * scale},${originY - 11 * scale}
              L ${originX - 18 * scale},${originY - 9 * scale}
              A ${11 * scale} ${11 * scale} 0 0 0 ${originX - 18 * scale},${originY + 9 * scale}
              L ${originX + 7 * scale},${originY + 11 * scale}
              Z
            `}
            fill="none"
            stroke="#60606a"
            strokeWidth={0.9 * scale}
          />

          {/* 4. Highlight Chamfers along faceted edges */}
          {/* Top subtle highlight */}
          <path
            d={`
              M ${originX + r - 0.5 * scale},${originY - 0.5 * scale}
              L ${originX + 7 * scale},${originY - 10.2 * scale}
              L ${originX - 17.5 * scale},${originY - 8.2 * scale}
            `}
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth={0.75 * scale}
          />
          {/* Bottom prominent reflective highlight matching cockpit photo */}
          <path
            d={`
              M ${originX + r - 0.5 * scale},${originY + 0.5 * scale}
              L ${originX + 7 * scale},${originY + 10.2 * scale}
              L ${originX - 17.5 * scale},${originY + 8.2 * scale}
            `}
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth={0.85 * scale}
          />

          {/* 5. Center Divider Ridge Line */}
          <line
            x1={originX - r + 0.5 * scale}
            y1={originY}
            x2={originX + r}
            y2={originY}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={0.6 * scale}
          />

          {/* 6. Thick, Highly Visible Indicator Line Matching YAW TRIM */}
          {/* Outer Black Border Line */}
          <line
            x1={originX + 2 * scale}
            y1={originY}
            x2={originX + r - 0.5 * scale}
            y2={originY}
            stroke="#000000"
            strokeWidth={4.2 * scale}
            strokeLinecap="round"
          />
          {/* Inner Solid White Line */}
          <line
            x1={originX + 3 * scale}
            y1={originY}
            x2={originX + r - 1 * scale}
            y2={originY}
            stroke="#ffffff"
            strokeWidth={2.2 * scale}
            strokeLinecap="round"
          />
        </g>
      </>
    );
  };

  // Direct SVG <g> render when embedded inside an existing parent SVG
  if (cx !== undefined && cy !== undefined) {
    return (
      <g
        className={className}
        onClick={interactive ? onClick : undefined}
        onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        {renderContent(cx, cy)}
      </g>
    );
  }

  // Standalone HTML element render
  return (
    <div
      onClick={interactive ? onClick : undefined}
      onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
      onMouseDown={interactive ? onMouseDown : undefined}
      className={`inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
      >
        {renderContent(size / 2, size / 2)}
      </svg>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. CockpitTriangularKnob (3-Lobe Fluted Dial for Lighting & Rheostats)     */
/* -------------------------------------------------------------------------- */

export interface CockpitTriangularKnobProps {
  /** Rotation angle in degrees (0 = pointer pointing right at 3 o'clock / +X, -90 = pointing UP at 12 o'clock) */
  rotation?: number;
  /** Knob pixel diameter (default: 52) */
  size?: number;
  /** Optional center X coordinate when embedded directly inside an SVG */
  cx?: number;
  /** Optional center Y coordinate when embedded directly inside an SVG */
  cy?: number;
  /** Whether the knob is interactive */
  interactive?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export const CockpitTriangularKnob: React.FC<CockpitTriangularKnobProps> = ({
  rotation = 0,
  size = 52,
  cx,
  cy,
  interactive = true,
  className = '',
  onClick,
  onContextMenu,
  onMouseDown,
}) => {
  const knobId = useId();
  const skirtGradId = `triSkirtGrad-${knobId}`;
  const triGradId = `triGripGrad-${knobId}`;

  // Geometry dimensions
  const scale = size / 52;
  const r = (size / 2) * (24 / 26); // Base skirt radius (e.g. 24px in 52px footprint)
  const rLobe = 22 * scale; // Tip radius of the 3 rounded lobes
  const rWaist = 12 * scale; // Radius of concave finger indents between lobes
  const l1 = 5.5 * scale; // Lobe tip tangent length
  const l0 = 4.5 * scale; // Waist tangent length

  const renderContent = (originX: number, originY: number) => {
    // Generate smooth 3-lobed (fluted triangular) closed path using continuous cubic Béziers
    // k = 0: Lobe 1 at 0° (+X / Pointer lobe)
    // k = 1: Lobe 2 at 120° (Down-Left)
    // k = 2: Lobe 3 at 240° (Up-Left)
    const deg2rad = Math.PI / 180;
    const pathSegments: string[] = [];

    // Starting point: Lobe 0 tip
    pathSegments.push(`M ${originX + rLobe},${originY}`);

    for (let k = 0; k < 3; k++) {
      const th0 = k * 120 * deg2rad;
      const thWaist = (k * 120 + 60) * deg2rad;
      const thNext = (k * 120 + 120) * deg2rad;

      // P0 = Lobe k tip
      const p0x = originX + rLobe * Math.cos(th0);
      const p0y = originY + rLobe * Math.sin(th0);

      // C1 = leaving P0 along tangent
      const c1x = p0x + l1 * -Math.sin(th0);
      const c1y = p0y + l1 * Math.cos(th0);

      // P_waist
      const pwx = originX + rWaist * Math.cos(thWaist);
      const pwy = originY + rWaist * Math.sin(thWaist);

      // C2 = entering waist along tangent
      const c2x = pwx - l0 * -Math.sin(thWaist);
      const c2y = pwy - l0 * Math.cos(thWaist);

      // First half of sector: Lobe -> Waist
      pathSegments.push(`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${pwx.toFixed(2)} ${pwy.toFixed(2)}`);

      // C3 = leaving waist along tangent
      const c3x = pwx + l0 * -Math.sin(thWaist);
      const c3y = pwy + l0 * Math.cos(thWaist);

      // P_next = next lobe tip
      const pnx = originX + rLobe * Math.cos(thNext);
      const pny = originY + rLobe * Math.sin(thNext);

      // C4 = entering next lobe tip along tangent
      const c4x = pnx - l1 * -Math.sin(thNext);
      const c4y = pny - l1 * Math.cos(thNext);

      // Second half of sector: Waist -> Next Lobe
      pathSegments.push(`C ${c3x.toFixed(2)} ${c3y.toFixed(2)}, ${c4x.toFixed(2)} ${c4y.toFixed(2)}, ${pnx.toFixed(2)} ${pny.toFixed(2)}`);
    }

    pathSegments.push('Z');
    const triPathD = pathSegments.join(' ');

    return (
      <>
        <defs>
          {/* Base skirt radial metallic gradient */}
          <radialGradient id={skirtGradId} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f4f4f5" />
            <stop offset="55%" stopColor="#d4d4d8" />
            <stop offset="85%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#71717a" />
          </radialGradient>

          {/* Raised 3-Lobe Grip Metallic Gradient */}
          <radialGradient id={triGradId} cx="38%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#e4e4e7" />
            <stop offset="75%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#71717a" />
          </radialGradient>
        </defs>

        {/* 1. Base Circular Skirt */}
        <circle
          cx={originX}
          cy={originY}
          r={r}
          fill={`url(#${skirtGradId})`}
          stroke="#71717a"
          strokeWidth={1 * scale}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
        />
        <circle
          cx={originX}
          cy={originY}
          r={r - 1.2 * scale}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth={0.7 * scale}
        />

        {/* 2. Rotating 3-Lobe Triangular Grip with Downward Screen-Space Shadow */}
        <g
          transform={`rotate(${rotation}, ${originX}, ${originY})`}
          style={{
            willChange: 'transform',
            transition: 'transform 90ms ease-out',
            filter: 'drop-shadow(0 2px 3.5px rgba(0,0,0,0.65))',
          }}
        >
          {/* Main 3-Lobe Body */}
          <path
            d={triPathD}
            fill={`url(#${triGradId})`}
            stroke="#52525b"
            strokeWidth={0.9 * scale}
          />

          {/* Subtle Top-Left Highlight Chamfer */}
          <path
            d={triPathD}
            fill="none"
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth={0.6 * scale}
            transform={`scale(0.96) translate(${originX * 0.04}, ${originY * 0.04})`}
          />

          {/* 3. Thick, Highly Visible Indicator Line along Pointer Lobe (Matching YAW TRIM & ENG FEED) */}
          {/* Outer Black Border Line */}
          <line
            x1={originX + 2.5 * scale}
            y1={originY}
            x2={originX + rLobe - 0.5 * scale}
            y2={originY}
            stroke="#000000"
            strokeWidth={4.2 * scale}
            strokeLinecap="round"
          />
          {/* Inner Solid White Line */}
          <line
            x1={originX + 3.5 * scale}
            y1={originY}
            x2={originX + rLobe - 1 * scale}
            y2={originY}
            stroke="#ffffff"
            strokeWidth={2.2 * scale}
            strokeLinecap="round"
          />
        </g>
      </>
    );
  };

  // Direct SVG <g> render when embedded inside an existing parent SVG
  if (cx !== undefined && cy !== undefined) {
    return (
      <g
        className={className}
        onClick={interactive ? onClick : undefined}
        onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
        onMouseDown={interactive ? onMouseDown : undefined}
      >
        {renderContent(cx, cy)}
      </g>
    );
  }

  // Standalone HTML element render
  return (
    <div
      onClick={interactive ? onClick : undefined}
      onContextMenu={interactive ? onContextMenu : (e) => e.preventDefault()}
      onMouseDown={interactive ? onMouseDown : undefined}
      className={`inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer' : 'cursor-default pointer-events-none'
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
      >
        {renderContent(size / 2, size / 2)}
      </svg>
    </div>
  );
};
