'use client';

import React, { useState, useId } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Aspect ratio of the original f16cockpit.webp image (3254 x 4609)
  const imageAspect = 3254 / 4609; // ~0.706
  const unzoomedHeight = Math.round(unzoomedWidth / imageAspect); // ~297px

  // Target area aspect ratio in image coordinate space
  const tWidth = targetArea ? targetArea.width : 20;
  const tHeight = targetArea ? targetArea.height : 16;
  const targetAspect = (tWidth / Math.max(1, tHeight)) * imageAspect;

  // Zoomed dimensions matching the target area's aspect ratio exactly
  const zoomedWidth = 230;
  const zoomedHeight = Math.round(
    Math.max(160, Math.min(280, zoomedWidth / Math.max(0.4, targetAspect)))
  );

  const activeWidth = isHovered ? zoomedWidth : unzoomedWidth;
  const activeHeight = isHovered ? zoomedHeight : unzoomedHeight;

  // Stable hit boundary dimensions to prevent hover oscillation/jitter
  const hitWidth = Math.max(unzoomedWidth, zoomedWidth) + 16;
  const hitHeight = Math.max(unzoomedHeight, zoomedHeight) + 16;

  // Exact image scaling & translation so selected area fills 100% of zoomed frame
  const scaleX = 100 / Math.max(1, tWidth);
  const scaleY = 100 / Math.max(1, tHeight);
  const offsetXPercent = (targetArea?.x ?? 0) * scaleX;
  const offsetYPercent = (targetArea?.y ?? 0) * scaleY;

  return (
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
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{
            top: `${topOffset}px`,
            willChange: 'transform, opacity',
          }}
          className={`fixed right-6 z-50 select-none ${className}`}
        >
          {/* Stable Hover Wrapper: Prevents shrink/grow oscillation when mouse enters from edges */}
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex items-start justify-end p-2 -m-2"
            style={{
              minWidth: `${hitWidth}px`,
              minHeight: `${hitHeight}px`,
            }}
          >
            {/* Avionics Frame with Cyan/Sky Bloom and Dynamic Aspect Ratio */}
            <motion.div
              animate={{
                width: activeWidth,
                height: activeHeight,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative rounded-md border border-sky-500/50 bg-[#06080d] overflow-hidden cursor-pointer"
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
                    width: isHovered ? `${scaleX * 100}%` : '100%',
                    height: isHovered ? `${scaleY * 100}%` : '100%',
                    left: isHovered ? `-${offsetXPercent}%` : '0%',
                    top: isHovered ? `-${offsetYPercent}%` : '0%',
                  }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  style={{
                    position: 'absolute',
                    willChange: 'left, top, width, height',
                  }}
                  className="w-full h-full"
                >
                  {/* Cockpit Map Image */}
                  <Image
                    src={src}
                    alt={alt}
                    fill
                    priority
                    sizes="400px"
                    className="select-none pointer-events-none object-cover contrast-[1.08] brightness-[0.98]"
                    draggable={false}
                  />

                  {/* Dashed Rounded Rectangle Target Outline (Hidden when zoomed in) */}
                  {targetArea && (
                    <motion.div
                      animate={{
                        opacity: isHovered ? 0 : 1,
                      }}
                      transition={{ duration: 0.12 }}
                      className="absolute border-2 border-dashed border-amber-400 rounded-md pointer-events-none z-10"
                      style={{
                        left: `${targetArea.x}%`,
                        top: `${targetArea.y}%`,
                        width: `${targetArea.width}%`,
                        height: `${targetArea.height}%`,
                        boxShadow: '0 0 10px rgba(251,191,36,0.6)',
                      }}
                    />
                  )}

                  {/* Echoing Dot Pins (Retained when inside target area on zoom) */}
                  <div className="absolute inset-0 pointer-events-none">
                    {pins.map((pin) => {
                      const pinColor = pin.color || '#38bdf8';
                      const isInsideTarget = targetArea
                        ? pin.x >= targetArea.x &&
                          pin.x <= targetArea.x + targetArea.width &&
                          pin.y >= targetArea.y &&
                          pin.y <= targetArea.y + targetArea.height
                        : false;
                      const isVisible = !isHovered || isInsideTarget;

                      return (
                        <motion.div
                          key={pin.id}
                          initial={false}
                          animate={{
                            opacity: isVisible ? 1 : 0,
                            scale: isHovered ? 1.5 : 1,
                          }}
                          transition={{
                            opacity: { duration: 0.15 },
                            scale: { type: 'spring', stiffness: 320, damping: 28 },
                          }}
                          className="absolute pointer-events-none z-20 flex items-center space-x-1"
                          style={{
                            left: `${pin.x}%`,
                            top: `${pin.y}%`,
                            x: '-50%',
                            y: '-50%',
                            willChange: 'transform, opacity',
                          }}
                        >
                          {/* Echoing Radar Ping Ripple */}
                          <div className="relative w-3 h-3 flex items-center justify-center">
                            <span
                              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                              style={{ backgroundColor: pinColor }}
                            />
                            <span
                              className="relative inline-flex rounded-full h-1.5 w-1.5 shadow-sm border border-black/80"
                              style={{ backgroundColor: pinColor }}
                            />
                          </div>

                          {/* Pin Label */}
                          {pin.label && (
                            <span
                              className="text-[6px] font-mono font-bold px-0.8 py-0.2 rounded bg-black/85 border shadow-sm leading-none tracking-tight whitespace-nowrap"
                              style={{
                                color: pinColor,
                                borderColor: `${pinColor}66`,
                              }}
                            >
                              {pin.label}
                            </span>
                          )}
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
