'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Mic, Headphones, CheckCircle2, Gauge, AlertTriangle } from 'lucide-react';
import { RampStartStep } from '../../services/voiceTrainingData';

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
  return (
    <div className="max-w-4xl mx-auto space-y-5 font-mono select-none">
      {/* Manual Document Header & Step Navigator */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-zinc-800 text-emerald-400 text-xs font-bold">
              {activeStep.code}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-bold uppercase">
              PHASE: {activeStep.phase}
            </span>
          </div>
          <h2 className="text-xl font-black text-zinc-100 mt-1.5 tracking-wide">
            {activeStep.title}
          </h2>
          <p className="text-xs text-cyan-400 mt-0.5 italic">
            {activeStep.whatToPerformNow}
          </p>
        </div>

        {/* Quick Step Nav Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevStep}
            disabled={currentStepIndex === 0}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>PREV</span>
          </button>
          <button
            onClick={onNextStep}
            disabled={currentStepIndex === totalSteps - 1}
            className="p-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>NEXT</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CARD 1: WHAT TO SAY (PILOT VOICE CALLOUT) */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm space-y-3">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Mic className="w-4 h-4 text-emerald-400" />
          <span>WHAT TO SAY (PILOT VOICE COMMAND &amp; VARIATIONS)</span>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-[11px] text-zinc-500 block mb-1">
              PRIMARY RECOGNIZED CALL:
            </span>
            <span className="inline-block px-4 py-2 bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 rounded font-black text-base tracking-wide shadow-sm">
              &quot;{activeStep.pilotSpokenCalls.primary}&quot;
            </span>
          </div>

          {activeStep.pilotSpokenCalls.prefixVariants.length > 0 && (
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1">
                ACCEPTED VARIATIONS:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeStep.pilotSpokenCalls.prefixVariants.map((v) => (
                  <span
                    key={v}
                    className="px-2.5 py-1 bg-zinc-800 text-zinc-300 border border-zinc-700/80 rounded text-xs"
                  >
                    &quot;{v}&quot;
                  </span>
                ))}
              </div>
            </div>
          )}

          {activeStep.pilotSpokenCalls.synonyms.length > 0 && (
            <div>
              <span className="text-[11px] text-zinc-500 block mb-1">
                SHORT SYNONYMS:
              </span>
              <div className="flex flex-wrap gap-2">
                {activeStep.pilotSpokenCalls.synonyms.map((s) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 rounded text-xs italic"
                  >
                    &quot;{s}&quot;
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* EXPECTED RESPONSE */}
        <div className="mt-4 pt-4 border-t border-zinc-800/80">
          <div className="p-4 rounded-lg border border-amber-500/40 bg-amber-950/20 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-bold uppercase tracking-wider">
              <Headphones className="w-4 h-4 text-amber-400" />
              <span>EXPECTED CREW CHIEF INTERCOM RESPONSE (RX)</span>
            </div>
            <div className="text-base font-bold text-amber-200 pl-6 italic">
              {activeStep.expectedChiefResponse}
            </div>
          </div>
        </div>
      </div>

      {/* CARD 2: PROCEDURAL ACTIONS CHECKLIST */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-sm space-y-3">
        <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>PROCEDURAL DIRECTIVES &amp; ACTIONS</span>
        </div>

        <div className="space-y-2">
          {activeStep.substeps && activeStep.substeps.map((sub, i) => (
            <div
              key={sub.id}
              className="flex items-start gap-3 p-3 rounded bg-zinc-950/60 border border-zinc-800/80 text-xs text-zinc-300"
            >
              <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] shrink-0 font-bold">
                {i + 1}
              </span>
              <div className="space-y-1">
                <span className="font-bold text-zinc-200 block">{sub.label}</span>
                <p className="leading-relaxed text-zinc-400">{sub.description}</p>
                <span className="text-[10px] text-cyan-400 block mt-1">
                  Panel: {sub.cockpitPanel} • Visual cue: {sub.visualCue}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CARD 3: ENGINE & COCKPIT PARAMETERS (If applicable) */}
      {activeStep.engineParameters && (
        <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/40 shadow-sm space-y-3">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>ENGINE &amp; COCKPIT PARAMETERS</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-zinc-950/80 rounded border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">THROTTLE GATE</span>
              <span className="text-zinc-200 font-bold">{activeStep.engineParameters.throttleState || 'IDLE'}</span>
            </div>
            <div className="p-3 bg-zinc-950/80 rounded border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">TARGET RPM</span>
              <span className="text-emerald-400 font-bold">{activeStep.engineParameters.targetRpm || '65% RPM'}</span>
            </div>
            <div className="p-3 bg-zinc-950/80 rounded border border-zinc-800">
              <span className="text-[10px] text-zinc-500 block uppercase font-bold">NOZZLE POSITION</span>
              <span className="text-cyan-400 font-bold">{activeStep.engineParameters.nozzlePosition || '100%'}</span>
            </div>
          </div>

          {activeStep.engineParameters.checklistCautions && (
            <div className="mt-2 space-y-1.5">
              {activeStep.engineParameters.checklistCautions.map((caution, i) => (
                <div
                  key={i}
                  className="p-3 rounded bg-amber-950/30 border border-amber-500/40 text-xs text-amber-300 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{caution}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CARD 4: COCKPIT PANEL & SYSTEMS KNOWLEDGE */}
      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-2 text-xs text-zinc-400 leading-relaxed">
        <span className="text-zinc-500 uppercase font-bold block text-[10px]">
          SYSTEM CONSOLE &amp; FOCAL CONTROLS:
        </span>
        <p>
          <strong>Console:</strong> {activeStep.cockpitVisual.panelName} •{' '}
          <strong>Subsystem:</strong> {activeStep.cockpitVisual.subSystem}
        </p>
        <p>
          <strong>Focal Controls:</strong> {activeStep.cockpitVisual.focalControls.join(', ')}
        </p>
      </div>
    </div>
  );
};
