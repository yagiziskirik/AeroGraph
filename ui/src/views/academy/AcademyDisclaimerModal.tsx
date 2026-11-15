'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Shield, BookOpen, Heart, Sparkles, X } from 'lucide-react';
import { Sound } from '../../services/sound';
import { ShiningCheckbox } from '../../components/inputs';

interface AcademyDisclaimerModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.12,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 420,
      damping: 26,
      mass: 0.8,
    },
  },
};

export const AcademyDisclaimerModal: React.FC<AcademyDisclaimerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aerograph_academy_disclaimer_dismissed') === 'true';
    }
    return false;
  });

  // Sync state whenever the modal opens (e.g. via top-right help icon)
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      setDontShowAgain(localStorage.getItem('aerograph_academy_disclaimer_dismissed') === 'true');
    }
  }, [isOpen]);

  const handleAcknowledge = () => {
    Sound.playCommit();
    onClose(dontShowAgain);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="academy-disclaimer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
          style={{ willChange: 'opacity' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              Sound.playClick();
              onClose(dontShowAgain);
            }
          }}
        >
          <motion.div
            key="academy-disclaimer-card"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 28,
              mass: 0.8,
            }}
            className="w-full max-w-xl rounded-2xl bg-zinc-900 border border-zinc-700/80 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden font-mono text-zinc-200"
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: -15, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  whileHover={{ rotate: 8, scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  style={{ willChange: 'transform' }}
                  className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)] cursor-default"
                >
                  <Shield className="w-5 h-5 text-cyan-400" />
                </motion.div>
                <div>
                  <h3 className="text-sm font-black tracking-wider uppercase text-zinc-100 flex items-center gap-2">
                    OPERATIONAL FAMILIARIZATION NOTICE
                  </h3>
                  <p className="text-[11px] text-zinc-400 tracking-wide">
                    Cockpit Voice Drill &amp; Dash-1 Checklist
                  </p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                style={{ willChange: 'transform' }}
                onClick={() => {
                  Sound.playClick();
                  onClose(dontShowAgain);
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-[background-color,color] cursor-pointer"
                title="Dismiss notice"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Content Body with Staggered Entrance */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="p-6 overflow-y-auto space-y-4 font-sans text-xs text-zinc-300 leading-relaxed custom-scrollbar"
            >
              {/* Note 1: Author Perspective */}
              <motion.div
                variants={itemVariants}
                whileHover={{
                  x: 3,
                  borderColor: 'rgba(6, 182, 212, 0.45)',
                  backgroundColor: 'rgba(6, 182, 212, 0.04)',
                }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                style={{ willChange: 'transform, border-color' }}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 cursor-default group"
              >
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                  <motion.div
                    whileHover={{ rotate: 18, scale: 1.15 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{ willChange: 'transform' }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                  </motion.div>
                  <span>A Note from the Author</span>
                </div>
                <p className="text-zinc-300">
                  I am a real-world pilot, but I am not an F-16 pilot. What you see here is a focused procedural slice of the ramp start and ground check sequence, structured around how I personally fly. Between these checklist steps, I naturally weave in my own flow; turning on sensors, loading the Data Cartridge (DTC), setting up MFDs, and prepping avionics. I&apos;m a human too, this is my understanding of the documents and the aircraft.
                </p>
              </motion.div>

              {/* Note 2: Documentation Priority */}
              <motion.div
                variants={itemVariants}
                whileHover={{
                  x: 3,
                  borderColor: 'rgba(245, 158, 11, 0.45)',
                  backgroundColor: 'rgba(245, 158, 11, 0.04)',
                }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                style={{ willChange: 'transform, border-color' }}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 cursor-default group"
              >
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                  <motion.div
                    whileHover={{ rotate: -14, scale: 1.15 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    style={{ willChange: 'transform' }}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400 group-hover:drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
                  </motion.div>
                  <span>Falcon BMS Documentation Comes First</span>
                </div>
                <p className="text-zinc-300">
                  This tool is built solely to help you familiarize yourself with the ground crew chief voice interactions and cockpit checks in an immersive way. It is <strong className="text-amber-300 font-semibold">not</strong> a replacement for reading the official manuals. The Falcon BMS training manuals, checklists, and technical documentation are far more comprehensive and should always be thoroughly studied.
                </p>
              </motion.div>

              {/* Note 3: Make it your own */}
              <motion.div
                variants={itemVariants}
                whileHover={{
                  x: 3,
                  borderColor: 'rgba(16, 185, 129, 0.45)',
                  backgroundColor: 'rgba(16, 185, 129, 0.04)',
                }}
                transition={{ type: 'spring', stiffness: 450, damping: 25 }}
                style={{ willChange: 'transform, border-color' }}
                className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5 cursor-default group"
              >
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  <motion.div
                    whileHover={{ scale: 1.25 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 15 }}
                    style={{ willChange: 'transform' }}
                  >
                    <Heart className="w-3.5 h-3.5 text-emerald-400 group-hover:drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  </motion.div>
                  <span>Fly It Your Way</span>
                </div>
                <p className="text-zinc-300">
                  You are more than welcome to fly with this script exactly as it is: That is what it is here for! But never feel locked in: every pilot develops their own rhythm. You are always free to adapt the sequence, adjust the speech commands, or create your own custom FoxVox profiles to match your personal style or standard operating procedures.
                </p>
              </motion.div>

              {/* Bottom callout */}
              <motion.div
                variants={itemVariants}
                className="pt-2 border-t border-zinc-800/60 text-center font-mono text-[11px] text-zinc-400 italic"
              >
                At the end of the day, the primary objective is to immerse yourself, work with your crew chief, and have fun. Welcome to the Falcon BMS world!
              </motion.div>
            </motion.div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-4 shrink-0 font-mono">
              <div className="flex items-center gap-3 select-none">
                <ShiningCheckbox
                  id="academy-disclaimer-dont-show"
                  size={20}
                  checked={dontShowAgain}
                  onChange={(e) => {
                    Sound.playClick();
                    setDontShowAgain(e.target.checked);
                  }}
                  style={{ '--accent-color': '#06b6d4' } as React.CSSProperties}
                />
                <label
                  htmlFor="academy-disclaimer-dont-show"
                  className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-[color] tracking-wide cursor-pointer select-none"
                >
                  Do not show this notice again
                </label>
              </div>

              <motion.button
                whileHover={{ scale: 1.025, boxShadow: '0 0 16px rgba(16, 185, 129, 0.35)' }}
                whileTap={{ scale: 0.975 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                style={{ willChange: 'transform, box-shadow' }}
                onClick={handleAcknowledge}
                className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold font-mono tracking-wider transition-[background-color] shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-2 group"
              >
                <span>ACKNOWLEDGE &amp; PROCEED</span>
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
                  style={{ willChange: 'transform' }}
                  className="text-emerald-200 group-hover:text-white"
                >
                  →
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
