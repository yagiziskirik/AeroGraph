'use client';

import React, { useId } from 'react';
import Image from 'next/image';

export interface TacticalDisplayCardProps {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  badgeBg?: string;
  badgeBorder?: string;
  caption?: string;
  footerRight?: string;
  width?: number | string;
  height?: number | string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
  objectFit?: 'cover' | 'contain';
  showGlassSheen?: boolean;
  showCornerBrackets?: boolean;
  showScanlines?: boolean;
  priority?: boolean;
  onClick?: () => void;
  className?: string;
}

export const TacticalDisplayCard: React.FC<TacticalDisplayCardProps> = ({
  src,
  alt = 'Tactical Display Visual',
  title = 'CREW CHIEF // VISUAL',
  subtitle,
  badge = 'OPTICAL',
  badgeColor = '#34d399',
  badgeBg = 'rgba(52, 211, 153, 0.12)',
  badgeBorder = 'rgba(52, 211, 153, 0.35)',
  caption = 'SALUTE // READY FOR TAXI',
  footerRight = 'CAM-01',
  width = 360,
  aspectRatio = 'square',
  objectFit = 'cover',
  showGlassSheen = true,
  showCornerBrackets = true,
  showScanlines = false,
  priority = false,
  onClick,
  className = '',
}) => {
  const panelId = useId();

  const widthStyle = typeof width === 'number' ? `${width}px` : width;

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'portrait'
      ? 'aspect-[3/4]'
      : '';

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Avionics Enclosure Chassis */}
      <div
        id={panelId}
        onClick={onClick}
        className={`relative bg-[#111215] border border-[#2b2c32] rounded-md shadow-2xl p-3.5 text-zinc-300 font-mono select-none overflow-hidden flex flex-col ${
          onClick ? 'cursor-pointer hover:border-zinc-500/50 transition-colors' : ''
        }`}
        style={{
          width: widthStyle,
          minWidth: widthStyle,
          maxWidth: widthStyle,
          boxShadow:
            '0 20px 40px -14px rgba(0,0,0,0.85), inset 0 1px 1px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.7)',
        }}
      >
        {/* Corner panel screws */}
        <div className="absolute top-2.5 left-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-45" />
        </div>
        <div className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-12" />
        </div>
        <div className="absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 rotate-12" />
        </div>
        <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-950 border border-zinc-600/40 shadow-inner flex items-center justify-center pointer-events-none z-30">
          <div className="w-1.5 h-[1px] bg-zinc-950 -rotate-45" />
        </div>

        {/* Top Header Bar with screw clearance */}
        <div className="px-5 mb-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest text-zinc-300 font-mono leading-none">
              {title}
            </span>
            {subtitle && (
              <span className="text-[7.5px] font-bold tracking-wider text-zinc-500 font-mono mt-0.5">
                {subtitle}
              </span>
            )}
          </div>

          {badge && (
            <span
              className="text-[8.5px] font-bold px-1.5 py-0.5 rounded font-mono border tracking-wider uppercase leading-none"
              style={{
                color: badgeColor,
                backgroundColor: badgeBg,
                borderColor: badgeBorder,
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Recessed Display Bezel / Viewport */}
        <div className="relative w-full rounded-[5px] bg-gradient-to-b from-[#1b1d24] via-[#101217] to-[#0a0b0e] p-[3px] shadow-[inset_0_2px_8px_rgba(0,0,0,0.9),0_1px_1px_rgba(255,255,255,0.06)] border border-[#22242c]">
          <div
            className={`relative w-full ${aspectClass} rounded-[3px] bg-[#07080b] overflow-hidden flex items-center justify-center shadow-[inset_0_2px_8px_rgba(0,0,0,0.95)]`}
          >
            {/* The Image */}
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              sizes={`(max-width: 768px) 100vw, ${widthStyle}`}
              className={`select-none pointer-events-none ${
                objectFit === 'cover' ? 'object-cover' : 'object-contain'
              }`}
              draggable={false}
            />

            {/* Tactical HUD Corner Brackets */}
            {showCornerBrackets && (
              <div className="absolute inset-2 pointer-events-none z-10">
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-emerald-400/50" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-emerald-400/50" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-emerald-400/50" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-emerald-400/50" />
              </div>
            )}

            {/* Optional Scanlines */}
            {showScanlines && (
              <div
                className="absolute inset-0 pointer-events-none z-10 opacity-20"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 1px, transparent 2px)',
                }}
              />
            )}

            {/* Glass reflection sheen */}
            {showGlassSheen && (
              <div
                className="absolute inset-0 pointer-events-none z-20"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 60%)',
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom Footer Bar */}
        {(caption || footerRight) && (
          <div className="px-5 mt-2.5 flex items-center justify-between pointer-events-none">
            {caption && (
              <span className="text-[8.5px] font-mono tracking-wider text-zinc-400 uppercase truncate">
                {caption}
              </span>
            )}
            {footerRight && (
              <span className="text-[8px] font-mono tracking-widest text-zinc-500 uppercase ml-2 flex-shrink-0">
                {footerRight}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
