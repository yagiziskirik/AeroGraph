'use client';

import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Sound } from '../../services/sound';

// Global cache reference holding preloaded and decoded cockpit locator image
let preloadedImageInstance: HTMLImageElement | null = null;

/**
 * Preloads and background-decodes the heavy F-16 cockpit panorama image into memory
 * before the overlay slides into view, preventing frame drops during animation.
 */
export const preloadCockpitLocatorImage = (src = '/crewchief/f16cockpit.webp') => {
  if (typeof window === 'undefined') return;
  if (preloadedImageInstance && preloadedImageInstance.src.includes(src)) return;

  const img = new window.Image();
  img.src = src;
  preloadedImageInstance = img;

  if ('decode' in img) {
    img.decode().catch(() => {
      // Decode errors ignored (fallback to standard Image component rendering)
    });
  }
};

// Immediate client-side trigger upon module evaluation
if (typeof window !== 'undefined') {
  preloadCockpitLocatorImage();
}

// Subtle, crisp military avionics spring: tight settling with a tiny organic cushion (no cartoonish bounce)
const AVIONICS_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.8,
};

export interface CockpitTargetArea {
  id?: string;
  label?: string;
  x: number; // percentage from left (0 - 100)
  y: number; // percentage from top (0 - 100)
  width: number; // width in percent (0 - 100)
  height: number; // height in percent (0 - 100)
}

export interface CockpitPin {
  id: string;
  label?: string;
  x: number; // percentage from left (0 - 100)
  y: number; // percentage from top (0 - 100)
  color?: string;
}

export interface CockpitLocatorOverlayProps {
  isOpen?: boolean;
  src?: string;
  alt?: string;
  targetArea?: CockpitTargetArea;
  secondaryAreas?: CockpitTargetArea[];
  pins?: CockpitPin[];
  unzoomedWidth?: number; // default 210px
  topOffset?: number; // default 140px from top
  showScanlines?: boolean;
  className?: string;
}

export const CockpitLocatorOverlay: React.FC<CockpitLocatorOverlayProps> = ({
  isOpen = true,
  src = '/crewchief/f16cockpit.webp',
  alt = 'F-16 Cockpit Navigation Locator',
  targetArea = {
    label: 'ELEC POWER PANEL',
    x: 17,
    y: 63,
    width: 20,
    height: 16,
  },
  secondaryAreas = [],
  pins = [
    { id: 'pin-elec', label: 'ELEC', x: 27, y: 71, color: '#fbbf24' },
    { id: 'pin-eng', label: 'ENG JET', x: 28, y: 56, color: '#38bdf8' },
  ],
  unzoomedWidth = 210,
  topOffset = 140,
  showScanlines = true,
  className = '',
}) => {
  const overlayId = useId();
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize all focal target areas (primary first, then secondary)
  const allAreas = useMemo(() => {
    const list: CockpitTargetArea[] = [];
    if (targetArea) list.push(targetArea);
    if (secondaryAreas && secondaryAreas.length > 0) {
      list.push(...secondaryAreas);
    }
    return list;
  }, [targetArea, secondaryAreas]);

  const [activeAreaIndex, setActiveAreaIndex] = useState(0);

  // Reset active area to primary whenever targetArea identity changes
  useEffect(() => {
    setActiveAreaIndex(0);
  }, [targetArea?.id, targetArea?.label, targetArea?.x, targetArea?.y]);

  const hasMultipleAreas = allAreas.length > 1;
  const currentTargetArea = allAreas[activeAreaIndex] || allAreas[0] || targetArea;

  const handleCycleArea = (e: React.MouseEvent) => {
    if (!hasMultipleAreas) return;
    e.stopPropagation();
    Sound.playClick();
    setActiveAreaIndex((prev) => (prev + 1) % allAreas.length);
  };

  // Clear grace leeway timer on unmount
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }
    // 150ms intent leeway window: prevents jitter when cursor is in the hysteresis gap
    leaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
      leaveTimerRef.current = null;
    }, 150);
  };

  // Aspect ratio of the original f16cockpit.webp image (3254 x 4609)
  const IMAGE_ASPECT = 3254 / 4609; // ~0.70601

  // Active target coordinates and dimensions in percentage (0 - 100)
  const tX = currentTargetArea ? currentTargetArea.x : 17;
  const tY = currentTargetArea ? currentTargetArea.y : 63;
  const tWidth = Math.max(1, currentTargetArea ? currentTargetArea.width : 20);
  const tHeight = Math.max(1, currentTargetArea ? currentTargetArea.height : 16);

  // Exact geometric aspect ratio of the selected target section (pixel width / pixel height)
  const targetAspect = (tWidth / tHeight) * IMAGE_ASPECT;

  // Unzoomed (Overview) dimensions: preserves full cockpit panorama aspect ratio
  const unzoomedHeight = unzoomedWidth / IMAGE_ASPECT;

  // Zoomed dimensions: adapts frame size directly to match targetAspect with zero distortion
  let zoomedWidth = 240;
  let zoomedHeight = 240;
  if (targetAspect >= 1) {
    // Wide target: pin max width ~250px and derive height
    zoomedWidth = 250;
    zoomedHeight = zoomedWidth / targetAspect;
    if (zoomedHeight < 130) {
      zoomedHeight = 130;
      zoomedWidth = zoomedHeight * targetAspect;
    }
  } else {
    // Tall or square target: pin max height ~260px and derive width
    zoomedHeight = 260;
    zoomedWidth = zoomedHeight * targetAspect;
    if (zoomedWidth < 140) {
      zoomedWidth = 140;
      zoomedHeight = zoomedWidth / targetAspect;
    }
  }

  const activeWidth = isHovered ? zoomedWidth : unzoomedWidth;
  const activeHeight = isHovered ? zoomedHeight : unzoomedHeight;

  // Stable hit boundary dimensions to prevent hover oscillation
  const hitWidth = Math.max(unzoomedWidth, zoomedWidth) + 16;
  const hitHeight = Math.max(unzoomedHeight, zoomedHeight) + 16;

  // Mathematical image canvas scale & offset so targetArea fills 100% of the zoomed frame
  const zoomScaleX = (100 / tWidth) * 100; // in % of frame width
  const zoomScaleY = (100 / tHeight) * 100; // in % of frame height
  const zoomOffsetX = (tX / tWidth) * 100; // in % of frame width
  const zoomOffsetY = (tY / tHeight) * 100; // in % of frame height


  // Ensure image is preloaded and decoded off-thread as soon as component mounts
  useEffect(() => {
    preloadCockpitLocatorImage(src);
  }, [src]);

  return (
    <>
      {/* Hidden preloader keeping the decoded WebP texture resident in browser/GPU memory */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed opacity-0 -z-50 -left-[9999px] -top-[9999px] w-[1px] h-[1px] overflow-hidden"
      >
        <Image
          src={src}
          alt=""
          width={1}
          height={1}
          priority
          loading="eager"
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={overlayId}
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{
              x: 360,
              opacity: 0,
              transition: { duration: 0.16, ease: 'easeIn' },
            }}
            transition={AVIONICS_SPRING}
            style={{
              top: `${topOffset}px`,
              willChange: 'transform, opacity',
            }}
            className={`fixed right-6 z-50 select-none ${className}`}
          >
            {/* Stable Union Hitbox Wrapper: Encompasses max bounds to eliminate shrink-boundary jitter */}
            <div
              onMouseLeave={handleMouseLeave}
              className="flex flex-col items-end p-2 -m-2 pointer-events-auto"
              style={{
                minWidth: `${hitWidth}px`,
                minHeight: `${hitHeight}px`,
              }}
            >
              {/* Avionics Frame with Cyan/Sky Bloom and Dynamic Aspect Ratio */}
              <motion.div
                onMouseEnter={handleMouseEnter}
                onClick={handleCycleArea}
                animate={{
                  width: activeWidth,
                  height: activeHeight,
                }}
                transition={AVIONICS_SPRING}
                className={`relative rounded-md border border-sky-500/50 bg-[#06080d] overflow-hidden pointer-events-auto ${
                  hasMultipleAreas ? 'cursor-pointer' : ''
                }`}
                style={{
                  willChange: 'width, height',
                  boxShadow:
                    '0 24px 48px -12px rgba(0,0,0,0.95), 0 0 24px -2px rgba(56,189,248,0.3), inset 0 0 1px 1px rgba(56,189,248,0.4)',
                }}
              >
                {/* Internal Image Canvas */}
                <div className="relative w-full h-full overflow-hidden">
                  <motion.div
                    animate={{
                      width: isHovered ? `${zoomScaleX}%` : '100%',
                      height: isHovered ? `${zoomScaleY}%` : '100%',
                      left: isHovered ? `-${zoomOffsetX}%` : '0%',
                      top: isHovered ? `-${zoomOffsetY}%` : '0%',
                    }}
                    transition={AVIONICS_SPRING}
                    style={{
                      position: 'absolute',
                      willChange: 'left, top, width, height',
                    }}
                    className="overflow-hidden"
                  >
                    {/* Cockpit Map Image: Scaled 1:1 on canvas with zero crop shift */}
                    <Image
                      src={src}
                      alt={alt}
                      fill
                      priority
                      sizes="600px"
                      className="select-none pointer-events-none object-fill contrast-[1.08] brightness-[0.98]"
                      draggable={false}
                    />

                    {/* Dashed Target Outlines (Visible in overview) */}
                    {allAreas.map((area, idx) => {
                      const isCurrent = idx === activeAreaIndex;
                      return (
                        <motion.div
                          key={area.id || `target-outline-${idx}`}
                          animate={{
                            opacity: isHovered ? 0 : isCurrent ? 1 : 0.45,
                            scale: isCurrent ? 1 : 0.98,
                          }}
                          transition={{ duration: 0.15 }}
                          className={`absolute border-2 border-dashed rounded-md pointer-events-none z-10 ${
                            isCurrent
                              ? 'border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                              : 'border-sky-400/60'
                          }`}
                          style={{
                            left: `${area.x}%`,
                            top: `${area.y}%`,
                            width: `${area.width}%`,
                            height: `${area.height}%`,
                          }}
                        />
                      );
                    })}

                    {/* Echoing Dot Pins (Retained and magnified when inside target area on zoom) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {pins.map((pin) => {
                        const pinColor = pin.color || '#38bdf8';
                        const isInsideTarget = currentTargetArea
                          ? pin.x >= tX &&
                            pin.x <= tX + tWidth &&
                            pin.y >= tY &&
                            pin.y <= tY + tHeight
                          : false;
                        const isVisible = !isHovered || isInsideTarget;

                        return (
                          <motion.div
                            key={pin.id}
                            initial={false}
                            animate={{
                              opacity: isVisible ? 1 : 0,
                            }}
                            transition={{ duration: 0.15 }}
                            className="absolute pointer-events-none z-20"
                            style={{
                              left: `${pin.x}%`,
                              top: `${pin.y}%`,
                            }}
                          >
                            <div className="relative flex items-center">
                              {/* Radar Ping Ripple & Solid Center Dot: Centered exactly at (0, 0) */}
                              <motion.div
                                animate={{
                                  scale: isHovered ? 1.3 : 1,
                                }}
                                transition={AVIONICS_SPRING}
                                className="absolute -left-1.5 -top-1.5 w-3 h-3 flex items-center justify-center pointer-events-none"
                                style={{ transformOrigin: 'center center' }}
                              >
                                <span
                                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                                  style={{ backgroundColor: pinColor }}
                                />
                                <span
                                  className="relative inline-flex rounded-full h-1.5 w-1.5 shadow-sm border border-black/80"
                                  style={{ backgroundColor: pinColor }}
                                />
                              </motion.div>

                              {/* Pin Label (offset to the right, never pulling the dot off-center) */}
                              {pin.label && (
                                <span
                                  className="absolute left-2.5 -top-2.5 text-[7px] font-mono font-bold px-1 py-0.5 rounded bg-black/90 border shadow-sm leading-none tracking-tight whitespace-nowrap pointer-events-none"
                                  style={{
                                    color: pinColor,
                                    borderColor: `${pinColor}66`,
                                  }}
                                >
                                  {pin.label}
                                </span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                </div>

                {/* Subtle CRT / HUD Scanlines */}
                {showScanlines && (
                  <motion.div
                    animate={{ backgroundPositionY: ['0px', '-90px'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(0,0,0,0.35) 0px, rgba(0,0,0,0.35) 1.5px, transparent 1.5px, transparent 3px)',
                      backgroundSize: '100% 24px',
                      willChange: 'background-position',
                    }}
                    className="absolute inset-0 pointer-events-none z-30 opacity-20"
                  />
                )}

                {/* Optical Glass Reflection Sheen */}
                <div
                  className="absolute inset-0 pointer-events-none z-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 35%, transparent 55%)',
                  }}
                />
              </motion.div>

              {/* Multiple Focal Areas Cycle Indicator Strip */}
              {hasMultipleAreas && (
                <div
                  onClick={handleCycleArea}
                  title="Click to cycle to next cockpit focal area"
                  className="mt-1.5 flex items-center justify-between px-2 py-0.5 rounded bg-black/90 border border-sky-500/40 text-[8px] font-mono select-none shadow backdrop-blur-sm pointer-events-auto cursor-pointer transition-[border-color] hover:border-sky-400"
                  style={{ width: `${activeWidth}px` }}
                >
                  <span className="flex items-center gap-1.5 text-sky-400 font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span>CLICK TO CYCLE</span>
                  </span>
                  <span className="font-bold text-amber-400 tracking-wider">
                    [{activeAreaIndex + 1}/{allAreas.length}]
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
