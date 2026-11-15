'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  Headphones,
  Gauge,
  AlertTriangle,
  FileText,
  Sliders,
  Shield,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { RampStartStep, StepSubstep } from '../../services/voiceTrainingData';

interface Dash1ManualViewProps {
  activeStep: RampStartStep;
  currentStepIndex: number;
  totalSteps: number;
  onPrevStep: () => void;
  onNextStep: () => void;
}

export const Dash1ManualView: React.FC<Dash1ManualViewProps> = ({
  activeStep,
  currentStepIndex,
  totalSteps,
  onPrevStep,
  onNextStep,
}) => {
  const phaseColors: Record<string, { bg: string; text: string; border: string }> = {
    PRE_START: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    ENGINE_START: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    SECONDARY_POWER: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    FLIGHT_CONTROLS: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' },
    TAXI_CLEAR: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  };

  const currentPhaseStyle = phaseColors[activeStep.phase] || phaseColors.PRE_START;

  const substepTypeBadges: Record<StepSubstep['phaseType'], { bg: string; text: string; border: string }> = {
    ACTION: { bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/40' },
    VERBAL: { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/40' },
    EXPECT: { bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/40' },
    VERIFY: { bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/40' },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 font-mono select-none pb-12">
      {/* ============================================================== */}
      {/* 1. MILITARY DASH-1 DOCUMENT HEADER & STEP NAVIGATOR            */}
      {/* ============================================================== */}
      <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            {/* Document Header Metadata */}
            <div className="flex items-center flex-wrap gap-2 text-[10px] font-bold tracking-widest uppercase">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-zinc-300">
                <FileText className="w-3 h-3 text-emerald-400" />
                T.O. 1F-16CM-1-CL // FLIGHT MANUAL CHECKLIST
              </span>
              <span className={`px-2 py-0.5 rounded border ${currentPhaseStyle.bg} ${currentPhaseStyle.text} ${currentPhaseStyle.border}`}>
                PHASE: {activeStep.phase.replace('_', ' ')}
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 text-zinc-400">
                STEP {String(currentStepIndex + 1).padStart(2, '0')} OF {String(totalSteps).padStart(2, '0')}
              </span>
            </div>

            {/* Step Title & Directive */}
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-emerald-400 font-black text-sm">
                  {activeStep.code}
                </span>
                <h1 className="text-lg md:text-xl font-black text-zinc-100 tracking-wide">
                  {activeStep.title}
                </h1>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                <span className="text-cyan-400 font-bold mr-1">ACTION DIRECTIVE:</span>
                {activeStep.whatToPerformNow}
              </p>
            </div>
          </div>

          {/* Quick Step Navigation Controls */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={onPrevStep}
              disabled={currentStepIndex === 0}
              className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-25 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
              title="Previous Checklist Step"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-400" />
              <span>PREV</span>
            </button>
            <div className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] font-bold text-zinc-400">
              {currentStepIndex + 1} / {totalSteps}
            </div>
            <button
              onClick={onNextStep}
              disabled={currentStepIndex === totalSteps - 1}
              className="px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 disabled:opacity-25 border border-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
              title="Next Checklist Step"
            >
              <span>NEXT</span>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. INTERPHONE & COMMUNICATIONS PROTOCOL (PILOT / CHIEF CALLS)  */}
      {/* ============================================================== */}
      <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-lg space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
          <div className="text-xs font-bold text-zinc-300 tracking-wider flex items-center gap-2 uppercase">
            <Mic className="w-4 h-4 text-emerald-400" />
            <span>INTERPHONE COORDINATION PROTOCOL</span>
          </div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            GROUND HOT-MIC LINE
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Pilot Spoken Callout */}
          <div className="p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col justify-between space-y-2">
            <div>
              <span className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase block mb-1">
                PILOT TRANSMISSION (PRIMARY):
              </span>
              <span className="inline-block px-3 py-1.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded font-black text-sm md:text-base tracking-wider shadow-sm">
                &quot;{activeStep.pilotSpokenCalls.primary}&quot;
              </span>
            </div>

            {/* Variations / Synonyms */}
            {(activeStep.pilotSpokenCalls.prefixVariants.length > 0 ||
              activeStep.pilotSpokenCalls.synonyms.length > 0) && (
              <div className="pt-2 border-t border-zinc-800/60 space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase block">
                  ACCEPTED SPOKEN BREVITY SYNONYMS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {activeStep.pilotSpokenCalls.prefixVariants.map((variant) => (
                    <span
                      key={variant}
                      className="px-2 py-0.5 bg-zinc-900 text-zinc-300 border border-zinc-700/60 rounded text-[11px]"
                    >
                      &quot;{variant}&quot;
                    </span>
                  ))}
                  {activeStep.pilotSpokenCalls.synonyms.map((syn) => (
                    <span
                      key={syn}
                      className="px-2 py-0.5 bg-zinc-900/60 text-zinc-400 border border-zinc-800 rounded text-[11px] italic"
                    >
                      &quot;{syn}&quot;
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Expected Crew Chief Response */}
          <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex flex-col justify-between space-y-2">
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-bold tracking-widest uppercase mb-1">
                <Headphones className="w-3.5 h-3.5 text-amber-400" />
                <span>EXPECTED CREW CHIEF INTERCOM (RX):</span>
              </div>
              <div className="text-sm md:text-base font-bold text-amber-200 pl-1 italic leading-relaxed">
                {activeStep.expectedChiefResponse}
              </div>
            </div>

            <div className="pt-2 border-t border-amber-500/20 text-[10px] text-zinc-400">
              <span className="text-amber-400/80 font-bold uppercase mr-1">STATUS:</span>
              <span>{activeStep.whatToExpectNext}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. DASH-1 PROCEDURAL CHECKLIST TABLE (CHECKLIST LEDGER)        */}
      {/* ============================================================== */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 shadow-xl overflow-hidden">
        {/* Table Header Strip */}
        <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold text-zinc-200 tracking-wider uppercase">
              DASH-1 PROCEDURAL CHECKLIST LEDGER
            </h2>
          </div>
          <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold">
            {activeStep.substeps.length} {activeStep.substeps.length === 1 ? 'CHECK ITEM' : 'CHECK ITEMS'}
          </span>
        </div>

        {/* Tabular Checklist View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950/70 text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-24">PHASE</th>
                <th className="py-2.5 px-4 w-44">ITEM / CONTROL</th>
                <th className="py-2.5 px-4 w-48">PANEL &amp; LOCATION</th>
                <th className="py-2.5 px-4 w-52">ACTION / POSITION</th>
                <th className="py-2.5 px-4">INDICATION &amp; DASH-1 VERIFICATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-xs">
              {activeStep.substeps.map((sub, idx) => {
                const badge = substepTypeBadges[sub.phaseType] || substepTypeBadges.ACTION;
                return (
                  <tr
                    key={sub.id}
                    className="hover:bg-zinc-800/30 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-bold text-zinc-500 font-mono">
                      {idx + 1}
                    </td>

                    {/* Phase Badge */}
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}>
                        {sub.phaseType}
                      </span>
                    </td>

                    {/* Item / Control Name */}
                    <td className="py-3 px-4 font-bold text-zinc-100">
                      <div>{sub.label}</div>
                      {sub.rationale && (
                        <div className="text-[10px] font-normal text-zinc-500 mt-0.5 flex items-start gap-1">
                          <HelpCircle className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
                          <span className="italic leading-tight">{sub.rationale}</span>
                        </div>
                      )}
                    </td>

                    {/* Panel & Cockpit Location */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-cyan-400">
                        {sub.cockpitPanel}
                      </div>
                    </td>

                    {/* Action / Position Directive */}
                    <td className="py-3 px-4 text-zinc-300">
                      {sub.interactiveControl?.targetPosition ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">SET:</span>
                          <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-bold text-amber-300 text-[11px]">
                            {sub.interactiveControl.targetPosition}
                          </span>
                        </div>
                      ) : sub.interactiveControl?.label ? (
                        <div className="font-bold text-zinc-200">
                          {sub.interactiveControl.label}
                        </div>
                      ) : null}
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                        {sub.description}
                      </p>
                    </td>

                    {/* Indication & Verification Cue */}
                    <td className="py-3 px-4">
                      <div className="p-2 rounded bg-zinc-950/70 border border-zinc-800 text-[11px] text-emerald-300 leading-relaxed">
                        <span className="text-emerald-500 font-bold uppercase text-[9px] block tracking-wider">
                          VERIFICATION INDICATION:
                        </span>
                        {sub.visualCue}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. ENGINE & SYSTEMS OPERATING TOLERANCES (If applicable)       */}
      {/* ============================================================== */}
      {activeStep.engineParameters && (
        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-lg space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 tracking-wider uppercase">
              ENGINE &amp; FLIGHT CONTROL OPERATING TOLERANCES
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">
                THROTTLE GATE / DETENT
              </span>
              <span className="text-zinc-100 font-black text-sm block">
                {activeStep.engineParameters.throttleState || 'IDLE DETENT'}
              </span>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">
                TARGET CORE SPEED (RPM)
              </span>
              <span className="text-emerald-400 font-black text-sm block">
                {activeStep.engineParameters.targetRpm || '65%–70% RPM'}
              </span>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">
                EXHAUST NOZZLE POSITION
              </span>
              <span className="text-cyan-400 font-black text-sm block">
                {activeStep.engineParameters.nozzlePosition || '100% OPEN'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. T.O. 1F-16CM-1 OFFICIAL CAUTIONS & OPERATIONAL WARNINGS     */}
      {/* ============================================================== */}
      {activeStep.engineParameters?.checklistCautions &&
        activeStep.engineParameters.checklistCautions.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 shadow-lg space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>T.O. 1F-16CM-1 OPERATIONAL WARNINGS &amp; CAUTIONS</span>
            </div>
            <div className="space-y-1.5 pl-6">
              {activeStep.engineParameters.checklistCautions.map((caution, i) => (
                <div
                  key={i}
                  className="text-xs text-amber-200/90 leading-relaxed list-item list-disc marker:text-amber-400"
                >
                  {caution}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ============================================================== */}
      {/* 6. COCKPIT CONSOLE & SUBSYSTEM LOCATION REFERENCE              */}
      {/* ============================================================== */}
      <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-xs text-zinc-400 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-zinc-500 shrink-0" />
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">
              FOCAL PANEL:
            </span>
            <span className="text-zinc-200 font-bold">
              {activeStep.cockpitVisual.panelName}
            </span>
            <span className="text-zinc-600 mx-2">•</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold mr-1">
              SUBSYSTEM:
            </span>
            <span className="text-zinc-300">
              {activeStep.cockpitVisual.subSystem}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Shield className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500 uppercase font-bold text-[10px]">
            FOCAL CONTROLS:
          </span>
          <span className="text-zinc-300">
            {activeStep.cockpitVisual.focalControls.join(', ')}
          </span>
        </div>
      </div>
    </div>
  );
};
