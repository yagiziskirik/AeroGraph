'use client';

import React, { useId, useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

export interface TacticalFlirOverlayProps {
  isOpen?: boolean;
  src: string;
  alt?: string;
  targetLabel?: string;
  fov?: string;
  zoom?: string;
  azimuth?: string;
  elevation?: string;
  showScanlines?: boolean;
  className?: string;
}

export const TacticalFlirOverlay: React.FC<TacticalFlirOverlayProps> = ({
  isOpen = true,
  src,
  alt = 'Tactical FLIR Optical Feed',
  targetLabel = 'ENG NOZZLE',
  fov = 'NFOV',
  zoom = '1.8x',
  azimuth = 'AZ: +002°',
  elevation = 'EL: -014°',
  showScanlines = true,
  className = '',
}) => {
  const overlayId = useId();
  const [glitchCycle, setGlitchCycle] = useState(0);

  // Trigger glitch pulse on mount and when image source swaps
  useEffect(() => {
    if (isOpen) {
      setGlitchCycle((prev) => prev + 1);
    }
  }, [isOpen, src]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={overlayId}
          initial={{
            opacity: 0,
            scaleY: 0.85,
            filter: 'brightness(2.2) contrast(1.6)',
            clipPath: 'inset(42% 0% 42% 0%)',
          }}
          animate={{
            opacity: [0, 1, 0.35, 1, 0.85, 1],
            scaleY: [0.85, 1.03, 0.98, 1],
            filter: [
              'brightness(2.4) contrast(1.8)',
              'brightness(0.7) contrast(1.3)',
              'brightness(1.3) contrast(1.1)',
              'brightness(1) contrast(1)',
            ],
            clipPath: [
              'inset(45% 0% 45% 0%)',
              'inset(12% 0% 20% 0%)',
              'inset(0% 0% 0% 0%)',
            ],
          }}
          exit={{
            opacity: [1, 0.9, 0],
            scaleY: [1, 1.02, 0.8],
            filter: ['brightness(1)', 'brightness(2.6)', 'brightness(0)'],
            clipPath: [
              'inset(0% 0% 0% 0%)',
              'inset(28% 0% 32% 0%)',
              'inset(48% 0% 50% 0%)',
            ],
            transition: { duration: 0.18, ease: 'easeOut' },
          }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          style={{ willChange: 'opacity, transform, filter, clip-path' }}
          className={`fixed bottom-6 right-6 z-50 select-none ${className}`}
        >
          {/* Frameless HUD Optical Viewport */}
          <div
            className="relative w-[390px] aspect-video rounded-md border border-emerald-500/50 bg-[#06080a] overflow-hidden"
            style={{
              boxShadow:
                '0 24px 48px -12px rgba(0,0,0,0.95), 0 0 24px -2px rgba(16,185,129,0.22), inset 0 0 1px 1px rgba(52,211,153,0.3)',
            }}
          >
            {/* Real-time Image Cross-fade */}
            <AnimatePresence mode="popLayout">
              <motion.div
                key={src}
                initial={{ opacity: 0, filter: 'brightness(1.3)' }}
                animate={{ opacity: 1, filter: 'brightness(1)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ willChange: 'opacity, filter' }}
                className="absolute inset-0 w-full h-full"
              >
                <Image
                  src={src}
                  alt={alt}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 390px"
                  className="select-none pointer-events-none object-cover contrast-[1.08] brightness-[0.98] saturate-[0.88]"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>

            {/* Tactical Live-Feed Subtle Vignette */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.45) 85%, rgba(0,0,0,0.75) 100%)',
              }}
            />

            {/* Infinitely Scrolling Scanlines (Continuous Upward Roll) */}
            {showScanlines && (
              <motion.div
                animate={{ backgroundPositionY: ['0px', '-120px'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1.5px, transparent 1.5px, transparent 3px)',
                  backgroundSize: '100% 24px',
                  willChange: 'background-position',
                }}
                className="absolute inset-0 pointer-events-none z-20 opacity-30"
              />
            )}

            {/* Tactical Signal Glitch Strobe Slice */}
            <motion.div
              key={glitchCycle}
              initial={{ opacity: 0.95, x: -8 }}
              animate={{
                opacity: [0.95, 0.1, 0.85, 0],
                x: [-8, 10, -3, 0],
              }}
              transition={{ duration: 0.26, ease: 'easeInOut' }}
              style={{ willChange: 'opacity, transform' }}
              className="absolute inset-0 z-25 pointer-events-none mix-blend-screen overflow-hidden"
            >
              <div
                className="absolute inset-x-0 top-[26%] h-3 bg-emerald-400/30"
                style={{ clipPath: 'polygon(0 0, 100% 0, 96% 100%, 0 100%)' }}
              />
              <div
                className="absolute inset-x-0 top-[62%] h-2.5 bg-emerald-400/25"
                style={{ clipPath: 'polygon(4% 0, 100% 0, 100% 100%, 0 100%)' }}
              />
            </motion.div>

            {/* HUD Optical Telemetry & Framing Reticle */}
            <div className="absolute inset-0 pointer-events-none z-30 flex flex-col justify-between p-3 select-none font-mono">
              {/* Top HUD Line */}
              <div className="flex items-center justify-between text-[8.5px] font-bold text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.95)]">
                <span className="flex items-center space-x-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{`TGT // ${targetLabel}`}</span>
                </span>
                <span>{`FOV: ${fov} // ${zoom}`}</span>
              </div>

              {/* 4 Corner Targeting Reticles */}
              <div className="absolute inset-2 pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.9)]" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.9)]" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.9)]" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.9)]" />
              </div>

              {/* Bottom HUD Line */}
              <div className="flex items-center justify-between text-[8px] font-bold text-emerald-400 drop-shadow-[0_0_3px_rgba(52,211,153,0.95)]">
                <span>{azimuth}</span>
                <span className="tracking-widest flex items-center space-x-1">
                  <span>{'SIG: 98%'}</span>
                  <span>{'//'}</span>
                  <span>{'60 FPS'}</span>
                  <span>{'//'}</span>
                  <span className="text-emerald-300">{'LOCK ●'}</span>
                </span>
                <span>{elevation}</span>
              </div>
            </div>

            {/* Optical Glass Reflection Sheen */}
            <div
              className="absolute inset-0 pointer-events-none z-30"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 35%, transparent 55%)',
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
