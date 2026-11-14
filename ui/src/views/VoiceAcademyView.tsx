'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  Target,
  Radio,
  BookOpen,
  Pin,
  CheckCircle2,
  Mic,
  Layers,
  SkipForward,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Sound } from '../services/sound';
import { Ipc } from '../services/ipc';
import { TelemetryData, ProfileCategoryView, CrewChiefStateData } from '../types/ipc';
import { RampStartStep, StepSubstep, RAMP_START_STEPS } from '../services/voiceTrainingData';
import { TacticalBrevityView } from './academy/TacticalBrevityView';
import { Dash1ManualView } from './academy/Dash1ManualView';
import { CockpitDrillStage } from './academy/CockpitDrillStage';

interface VoiceAcademyViewProps {
  onBack: () => void;
  profileName: string;
  profilePath: string;
  categories: ProfileCategoryView[];
  telemetry: TelemetryData;
  initialMode?: 'practice' | 'brevity' | 'manual';
}

// Deterministic spoken phrase required for each verbal phase in Cockpit Drill
const getRequiredSpokenPhrase = (
  stepId: number,
  substepOrder: number,
  substepIndex: number,
  phaseType?: string,
  primaryCall?: string
): string | null => {
  if (stepId === 1 && substepIndex === 3) {
    return 'LOUD AND CLEAR';
  }
  if (phaseType !== 'VERBAL') {
    return null;
  }
  switch (stepId) {
    case 0:
      return 'ENGAGE CHIEF';
    case 1:
      return substepOrder === 3 ? 'COMMS CHECK' : null;
    case 2:
      return substepOrder === 1 ? 'START TWO' : null;
    case 3:
      return substepOrder === 2 ? 'CLEAR SEC' : null;
    case 4:
      return substepOrder === 1 ? 'SEC GOOD' : null;
    case 5:
      return substepOrder === 3 ? 'PULL EPU PIN' : null;
    case 6:
      return substepOrder === 1 ? 'CHECK FLOW' : null;
    case 7:
      return substepOrder === 2 ? 'FLIGHT CONTROLS CLEAR' : null;
    case 8:
      return substepOrder === 1 ? 'CLEAR BIT' : null;
    case 9:
      return substepOrder === 2 ? 'READY TRIM' : null;
    case 10:
      return substepOrder === 2 ? 'TRIM DISCONNECTED' : null;
    case 11:
      return substepOrder === 2 ? 'TRIM CONNECTED' : null;
    case 12:
      return substepOrder === 1 ? 'CLEAR BIG MOVEMENTS' : null;
    case 13:
      return substepOrder === 1 ? 'DBU STILL CLEAR' : null;
    case 14:
      return substepOrder === 1 ? 'READY LEFT BRAKE' : null;
    case 15:
      return substepOrder === 1 ? 'READY RIGHT BRAKE' : null;
    case 16:
      return substepOrder === 1 ? 'READY AAR DOOR' : null;
    case 17:
      return substepOrder === 2 ? 'REMOVE CHOCKS' : null;
    case 18:
      return substepOrder === 1 ? 'CLEARED OFF' : null;
    default:
      return primaryCall ? primaryCall.toUpperCase() : null;
  }
};

export const VoiceAcademyView: React.FC<VoiceAcademyViewProps> = ({
  onBack,
  profileName,
  profilePath,
  categories,
  telemetry,
  initialMode = 'practice',
}) => {
  const isIn3D = telemetry.is_3d || telemetry.bms_running;

  // View Mode: practice (Cockpit Drill), brevity (TBA Browser), or manual (Dash-1 Manual)
  const [activeMode, setActiveMode] = useState<'practice' | 'brevity' | 'manual'>(initialMode);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSubstepIndex, setCurrentSubstepIndex] = useState(0);

  // Tactical Confirmation Modal on Exit during active drill
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);

  // Dynamic TBA Categories loaded directly from profile
  const [profileCategories, setProfileCategories] = useState<ProfileCategoryView[]>(categories);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(() => {
    return categories.length > 0 ? categories[0].name : '';
  });
  const [searchFilter, setSearchFilter] = useState('');
  const [isPrefixExpanded, setIsPrefixExpanded] = useState(false);

  useEffect(() => {
    if (categories.length > 0) {
      setProfileCategories(categories);
      setSelectedCategoryName((prev) => prev || categories[0].name);
    }
  }, [categories]);

  useEffect(() => {
    Ipc.getProfileVoiceCommands();
    const unsub = Ipc.on('ProfileVoiceCommands', (data: ProfileCategoryView[]) => {
      if (Array.isArray(data) && data.length > 0) {
        setProfileCategories(data);
        setSelectedCategoryName((prev) => prev || data[0].name);
      }
    });
    return unsub;
  }, []);

  // Simulation State Overrides & Mock Controls
  const [chiefEngaged, setChiefEngaged] = useState(false);

  // In Tactical Brevity mode, ensure Crew Chief state is disengaged so all cockpit radio categories are active
  useEffect(() => {
    if (activeMode === 'brevity') {
      Ipc.resetCrewChief();
      setChiefEngaged(false);
    }
  }, [activeMode]);
  const [axisOverrides, setAxisOverrides] = useState<Record<string, boolean>>({});

  // Inverted Brake Calibration (matching HardwareView)
  const [invertBrakes] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aerograph_invert_brakes');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });

  // Live Speech Recognition Status with unique sequence ID
  const speechCounterRef = useRef(0);
  const [lastSpeech, setLastSpeech] = useState<{
    id: number;
    phrase: string;
    confidence: number;
    status: 'VERIFIED' | 'DENIED' | 'PTT_GATED' | 'GROUP_INACTIVE' | 'STANDBY';
    command?: string;
    group?: string;
    reason?: string;
  }>({
    id: 0,
    phrase: '',
    confidence: 0,
    status: 'STANDBY',
  });

  const handleConsumeSpeech = () => {
    // Keep phrase visible in the bottom HUD pill so the user sees what was recognized
    setLastSpeech((prev) => ({ ...prev, status: 'VERIFIED' }));
  };

  // Step Ladder Drawer State
  const [isLadderHovered, setIsLadderHovered] = useState(false);
  const [isLadderPinned, setIsLadderPinned] = useState(false);

  // Active Step & Substep
  const activeStep: RampStartStep = RAMP_START_STEPS[currentStepIndex] || RAMP_START_STEPS[0];
  const activeSubstep: StepSubstep | undefined = activeStep.substeps[currentSubstepIndex];

  // Active Category in TBA
  const activeCategory = useMemo(() => {
    return profileCategories.find((c) => c.name === selectedCategoryName) || profileCategories[0];
  }, [profileCategories, selectedCategoryName]);

  // Disambiguated category & command matcher using SAPI group name, category prefixes, and current context
  const findMatchingBrevityCommand = useCallback(
    (phrase: string, commandName?: string, groupName?: string) => {
      const normPhrase = (phrase || '').trim().toUpperCase();
      const normCommand = (commandName || '').trim().toUpperCase();
      const normGroup = (groupName || '').trim().toUpperCase();

      // 1. Exact or partial match on Rust groupName (e.g. "JTAC", "ATC", "AWACS", "Wingman", "Flight", etc.)
      if (normGroup && normGroup !== 'SYSTEM' && normGroup !== 'COMMAND') {
        const cat = profileCategories.find((c) => {
          const catUpper = c.name.trim().toUpperCase();
          return catUpper === normGroup || catUpper.includes(normGroup) || normGroup.includes(catUpper);
        });

        if (cat && cat.commands) {
          let cmd = cat.commands.find((c) => c.name.trim().toUpperCase() === normCommand);
          if (!cmd && normCommand) {
            cmd = cat.commands.find((c) => {
              const cUpper = c.name.trim().toUpperCase();
              return cUpper.includes(normCommand) || normCommand.includes(cUpper);
            });
          }
          if (!cmd) {
            cmd = cat.commands.find((c) => {
              const cUpper = c.name.trim().toUpperCase();
              return (
                cUpper === normPhrase ||
                c.spoken_phrases?.some((p) => {
                  const pUpper = p.trim().toUpperCase();
                  return pUpper === normPhrase || normPhrase.includes(pUpper) || pUpper.includes(normPhrase);
                })
              );
            });
          }
          if (cmd) {
            return { categoryName: cat.name, commandName: cmd.name };
          }
        }
      }

      // 2. Disambiguate by checking Category Prefix Phrases in the spoken phrase
      // (e.g. "JTAC Close Menu" starts with "JTAC", "Flight Weapons Free" starts with "Flight", "Three Weapons Free" matches Wingman prefix "Three")
      const prefixMatchedCat = profileCategories.find((cat) => {
        return cat.prefix_phrases?.some((p) => {
          const pUpper = p.trim().toUpperCase();
          if (pUpper.length < 2) return false;
          return normPhrase.startsWith(pUpper) || normPhrase.includes(pUpper);
        });
      });

      if (prefixMatchedCat && prefixMatchedCat.commands) {
        let cmd = prefixMatchedCat.commands.find((c) => c.name.trim().toUpperCase() === normCommand);
        if (!cmd && normCommand) {
          cmd = prefixMatchedCat.commands.find((c) => {
            const cUpper = c.name.trim().toUpperCase();
            return cUpper.includes(normCommand) || normCommand.includes(cUpper);
          });
        }
        if (!cmd) {
          cmd = prefixMatchedCat.commands.find((c) => {
            const cUpper = c.name.trim().toUpperCase();
            return (
              cUpper === normPhrase ||
              c.spoken_phrases?.some((p) => {
                const pUpper = p.trim().toUpperCase();
                return pUpper === normPhrase || normPhrase.includes(pUpper) || pUpper.includes(normPhrase);
              })
            );
          });
        }
        if (cmd) {
          return { categoryName: prefixMatchedCat.name, commandName: cmd.name };
        }
      }

      // 3. Check current selectedCategory first to avoid unnecessarily jumping pages when speaking context commands
      const activeCat = profileCategories.find((c) => c.name === selectedCategoryName);
      if (activeCat && activeCat.commands) {
        const cmd = activeCat.commands.find((c) => {
          const cUpper = c.name.trim().toUpperCase();
          const matchesCmd = normCommand && (cUpper === normCommand || cUpper.includes(normCommand) || normCommand.includes(cUpper));
          const matchesPhraseExact = cUpper === normPhrase;
          const matchesSpoken = c.spoken_phrases?.some((p) => {
            const pUpper = p.trim().toUpperCase();
            return pUpper === normPhrase || normPhrase.includes(pUpper) || pUpper.includes(normPhrase);
          });
          return matchesCmd || matchesPhraseExact || matchesSpoken;
        });
        if (cmd) {
          return { categoryName: activeCat.name, commandName: cmd.name };
        }
      }

      // 4. Fallback search across all remaining categories
      for (const cat of profileCategories) {
        if (!cat.commands) continue;
        for (const cmd of cat.commands) {
          const cUpper = cmd.name.trim().toUpperCase();
          const matchesCmd = normCommand && (cUpper === normCommand || cUpper.includes(normCommand) || normCommand.includes(cUpper));
          const matchesPhraseExact = cUpper === normPhrase;
          const matchesSpoken = cmd.spoken_phrases?.some((p) => {
            const pUpper = p.trim().toUpperCase();
            return pUpper === normPhrase || normPhrase.includes(pUpper) || pUpper.includes(normPhrase);
          });

          if (matchesCmd || matchesPhraseExact || matchesSpoken) {
            return { categoryName: cat.name, commandName: cmd.name };
          }
        }
      }

      return null;
    },
    [profileCategories, selectedCategoryName]
  );

  // Listen to IPC Speech & Crew Chief state (No rogue switch clicks)
  useEffect(() => {
    const unsubSpeech = Ipc.on('SpeechRecognized', (data: any) => {
      if (data && data.phrase) {
        speechCounterRef.current += 1;
        setLastSpeech({
          id: speechCounterRef.current,
          phrase: data.phrase.toUpperCase(),
          confidence: data.confidence || 95,
          status: data.status || 'VERIFIED',
          command: data.command,
          group: data.group,
          reason: data.reason,
        });

        if (data.status === 'VERIFIED') {
          if (activeMode === 'practice') {
            if (activeStep.id === 0) {
              setChiefEngaged(true);
            }
          } else if (activeMode === 'brevity') {
            const match = findMatchingBrevityCommand(data.phrase, data.command, data.group);
            if (match) {
              setSearchFilter('');
              if (selectedCategoryName !== match.categoryName) {
                setSelectedCategoryName(match.categoryName);
              }
              setTimeout(() => {
                const safeId = `brevity-cmd-${match.categoryName.replace(/[^a-zA-Z0-9_-]/g, '_')}--${match.commandName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                const el = document.getElementById(safeId);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 120);
            }
          }
        }
      }
    });

    const unsubState = Ipc.on('CrewChiefState', (data: CrewChiefStateData) => {
      if (data) {
        setChiefEngaged(data.is_chief_engaged);
      }
    });

    return () => {
      unsubSpeech();
      unsubState();
    };
  }, [activeMode, activeStep.id, findMatchingBrevityCommand, selectedCategoryName]);

  // Step Navigation in Practice & Manual Views
  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      Sound.playClick();
      setCurrentStepIndex(currentStepIndex - 1);
      setCurrentSubstepIndex(0);
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < RAMP_START_STEPS.length - 1) {
      Sound.playClick();
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      setCurrentSubstepIndex(0);
      if (activeMode === 'practice' && nextIdx > 0) {
        setChiefEngaged(true);
      }
    }
  };

  // Simulated Voice Callout Execution
  const [isSimulatingSpeech, setIsSimulatingSpeech] = useState(false);

  const requiredSpokenPhrase = useMemo(() => {
    if (activeMode !== 'practice') return null;
    return getRequiredSpokenPhrase(
      activeStep.id,
      activeSubstep?.order || 1,
      currentSubstepIndex,
      activeSubstep?.phaseType,
      activeStep.pilotSpokenCalls?.primary
    );
  }, [
    activeMode,
    activeStep.id,
    activeStep.pilotSpokenCalls?.primary,
    activeSubstep?.order,
    activeSubstep?.phaseType,
    currentSubstepIndex,
  ]);

  const handleSimulateSpeech = (phraseToSpeak: string) => {
    if (isSimulatingSpeech) return;
    setIsSimulatingSpeech(true);
    Sound.playSwitch();
    speechCounterRef.current += 1;
    const clean = phraseToSpeak.trim().toUpperCase();
    setLastSpeech({
      id: speechCounterRef.current,
      phrase: clean,
      confidence: 99,
      status: 'VERIFIED',
      command: clean,
      group: 'CREW CHIEF',
    });
    if (activeStep.id === 0) {
      setChiefEngaged(true);
    }
    setTimeout(() => {
      setIsSimulatingSpeech(false);
    }, 1400);
  };

  const handleResetChief = () => {
    Sound.playSwitch();
    Ipc.resetCrewChief();
    setChiefEngaged(false);
    setCurrentStepIndex(0);
    setCurrentSubstepIndex(0);
    setAxisOverrides({});
    setLastSpeech({
      id: 0,
      phrase: '',
      confidence: 0,
      status: 'STANDBY',
    });
  };

  const handleSkipAxis = (substepId: string) => {
    Sound.playClick();
    setAxisOverrides((prev) => ({ ...prev, [substepId]: true }));
    if (currentSubstepIndex < activeStep.substeps.length - 1) {
      setCurrentSubstepIndex(currentSubstepIndex + 1);
    } else if (currentStepIndex < RAMP_START_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCurrentSubstepIndex(0);
    }
  };

  // Top Header Back Click Handler with Confirmation in Practice Mode
  const handleHeaderBack = () => {
    Sound.playClick();
    if (activeMode === 'practice' && currentStepIndex > 0) {
      setShowExitConfirmModal(true);
    } else {
      onBack();
    }
  };

  return (
    <div
      className={`w-full h-full flex flex-col bg-[#0A0A0C] text-zinc-100 select-none overflow-hidden font-sans ${
        activeMode === 'practice'
          ? 'fixed top-11 inset-x-0 bottom-0 z-40'
          : 'relative'
      }`}
    >
      {/* ============================================================== */}
      {/* TACTICAL CONFIRMATION MODAL ON EXIT DURING ACTIVE DRILL        */}
      {/* ============================================================== */}
      {showExitConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 text-amber-400 animate-pulse" />
              <h3 className="text-sm font-black tracking-wider uppercase text-zinc-100">
                ABORT DRILL IN PROGRESS?
              </h3>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Current procedural sequence will be lost and the Crew Chief interphone circuit will be disengaged. Are you sure you want to return to station?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowExitConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition-[background-color] cursor-pointer"
              >
                RESUME DRILL
              </button>
              <button
                onClick={() => {
                  setShowExitConfirmModal(false);
                  handleResetChief();
                  onBack();
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-[background-color] shadow-lg cursor-pointer"
              >
                ABORT &amp; EXIT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TOP COMMAND HEADER                                             */}
      {/* ============================================================== */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-900/90 px-6 flex items-center justify-between shrink-0 z-30 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button
            onClick={handleHeaderBack}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-200 hover:text-white rounded text-xs font-mono font-bold tracking-wider border border-zinc-700 transition-[background-color,border-color] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>BACK TO STATION</span>
          </button>

          <div className="h-4 w-px bg-zinc-700" />

          <div className="flex items-center gap-2">
            {activeMode === 'practice' ? (
              <Target className="w-4 h-4 text-emerald-400" />
            ) : activeMode === 'brevity' ? (
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            ) : (
              <BookOpen className="w-4 h-4 text-amber-400" />
            )}
            <h1 className="font-mono font-black text-sm text-zinc-100 tracking-wider uppercase">
              {activeMode === 'practice'
                ? `STEP ${activeStep.code} • ${activeStep.title.toUpperCase()}`
                : activeMode === 'brevity'
                ? 'TACTICAL BREVITY & AGENCIES DIRECTORY'
                : 'DASH-1 PROCEDURAL CHECKLIST MANUAL'}
            </h1>
          </div>
        </div>

        {/* Right Status Actions */}
        <div className="flex items-center gap-3">
          {activeMode === 'practice' ? (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-400 font-bold uppercase tracking-wider">
                PHASE: <span className="text-zinc-100">{activeSubstep?.phaseType || 'DIRECTIVE'}</span>
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-cyan-400 font-bold">
                SUBSTEP {currentSubstepIndex + 1}/{activeStep.substeps.length}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-xs">
              <span className="text-zinc-500">PROFILE:</span>
              <span className="font-bold truncate max-w-[160px] text-zinc-300">
                {profileName}
              </span>
            </div>
          )}

          {activeMode === 'practice' && (
            <button
              onClick={handleResetChief}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-mono font-bold border border-zinc-700/80 transition-[background-color] cursor-pointer"
              title="Reset Crew Chief state to Step 00"
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
              <span>RESET CHIEF</span>
            </button>
          )}
        </div>
      </header>

      {/* ============================================================== */}
      {/* MAIN VIEWPORT WORKSPACE                                        */}
      {/* ============================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Step Ladder Slide-Over Drawer (In Practice Drill & Manual) */}
        {(activeMode === 'practice' || activeMode === 'manual') && (
          <aside
            onMouseEnter={() => setIsLadderHovered(true)}
            onMouseLeave={() => !isLadderPinned && setIsLadderHovered(false)}
            className={`absolute top-0 left-0 bottom-0 z-30 transition-[transform] duration-200 ease-out flex ${
              isLadderHovered || isLadderPinned ? 'translate-x-0' : '-translate-x-[calc(100%-28px)]'
            }`}
            style={{ willChange: 'transform' }}
          >
            <div className="w-72 bg-zinc-900/95 border-r border-zinc-800 shadow-2xl flex flex-col h-full backdrop-blur-md">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-zinc-300 tracking-wider">
                  PROCEDURAL LADDER
                </span>
                <button
                  onClick={() => setIsLadderPinned(!isLadderPinned)}
                  className={`p-1 rounded text-xs transition-[color] cursor-pointer ${
                    isLadderPinned ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={isLadderPinned ? 'Unpin Ladder' : 'Pin Ladder Open'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Ladder items with pb-36 for full bottom clearance */}
              <div className="flex-1 overflow-y-auto p-2 pb-36 space-y-1">
                {RAMP_START_STEPS.map((step, idx) => {
                  const isCurrent = idx === currentStepIndex;
                  const isCompleted = idx < currentStepIndex;

                  return (
                    <button
                      key={step.id}
                      onClick={() => {
                        Sound.playClick();
                        setCurrentStepIndex(idx);
                        setCurrentSubstepIndex(0);
                        if (activeMode === 'practice' && idx > 0) {
                          setChiefEngaged(true);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded border transition-[background-color,border-color] flex items-center gap-2.5 font-mono text-xs cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold shadow-sm'
                          : isCompleted
                          ? 'bg-zinc-900/80 border-zinc-800/80 text-zinc-400'
                          : 'bg-zinc-950/60 border-transparent text-zinc-500'
                      }`}
                    >
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : isCurrent ? (
                          <div className="w-4 h-4 rounded-full border-2 border-emerald-400 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500">
                            {idx}
                          </div>
                        )}
                      </div>

                      <div className="truncate">
                        <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {step.code}
                        </div>
                        <div className="truncate">{step.title}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hover Trigger Vertical Tab */}
            <div className="w-7 bg-zinc-900/90 border-r border-y border-zinc-800 hover:bg-zinc-800 cursor-pointer flex flex-col items-center justify-center gap-2 shadow-lg transition-[background-color]">
              <span className="font-mono text-[10px] font-bold text-zinc-400 [writing-mode:vertical-lr] tracking-widest uppercase">
                {isLadderPinned ? 'PINNED' : 'STEP LADDER'}
              </span>
              <Pin className={`w-3.5 h-3.5 ${isLadderPinned ? 'text-emerald-400' : 'text-zinc-500'}`} />
            </div>
          </aside>
        )}

        {/* Primary Dynamic Stage Canvas */}
        <main className="flex-1 overflow-y-auto p-6 pb-28 relative">
          {/* SIMULATOR ONLINE LOCKOUT OVERLAY */}
          {isIn3D && activeMode === 'practice' && (
            <div className="absolute inset-0 z-40 bg-black/90 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md font-mono">
              <div className="w-16 h-16 rounded-full bg-rose-950/60 border-2 border-rose-500/80 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-rose-400 animate-pulse" />
              </div>
              <h2 className="text-base font-black text-rose-300 tracking-wider uppercase mb-2">
                SIMULATOR ONLINE — PRACTICE DRILL LOCKED
              </h2>
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed font-sans mb-6">
                Active Falcon BMS 3D session detected. Procedural rehearsal is inhibited while simulator is connected to prevent SAPI voice command conflicts. Use your in-cockpit radios or exit to Comms.
              </p>
              <button
                onClick={onBack}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs font-bold cursor-pointer transition-[background-color]"
              >
                RETURN TO COMMS STATION
              </button>
            </div>
          )}

          {/* MODE 1: COCKPIT VOICE PRACTICE DRILL */}
          {activeMode === 'practice' && (
            <CockpitDrillStage
              activeStep={activeStep}
              currentSubstepIndex={currentSubstepIndex}
              onAdvanceSubstep={setCurrentSubstepIndex}
              onAdvanceStep={(nextStepIdx) => {
                setCurrentStepIndex(nextStepIdx);
                setCurrentSubstepIndex(0);
              }}
              onRestartDrill={handleResetChief}
              telemetry={telemetry}
              invertBrakes={invertBrakes}
              lastSpeech={lastSpeech}
              chiefEngaged={chiefEngaged}
              onEngageChief={() => setChiefEngaged(true)}
              onConsumeSpeech={handleConsumeSpeech}
              onExitDrill={onBack}
            />
          )}

          {/* MODE 2: TACTICAL BREVITY & AGENCIES DIRECTORY (TBA) */}
          {activeMode === 'brevity' && (
            <TacticalBrevityView
              categories={profileCategories}
              selectedCategoryName={selectedCategoryName}
              onSelectCategory={setSelectedCategoryName}
              searchFilter={searchFilter}
              onSearchChange={setSearchFilter}
              isPrefixExpanded={isPrefixExpanded}
              onTogglePrefix={() => setIsPrefixExpanded(!isPrefixExpanded)}
              lastSpeech={lastSpeech}
            />
          )}

          {/* MODE 3: DASH-1 PROCEDURAL CHECKLIST MANUAL */}
          {activeMode === 'manual' && (
            <Dash1ManualView
              activeStep={activeStep}
              currentStepIndex={currentStepIndex}
              totalSteps={RAMP_START_STEPS.length}
              onPrevStep={handlePrevStep}
              onNextStep={handleNextStep}
            />
          )}
        </main>

        {/* ============================================================== */}
        {/* FLOATING BOTTOM DYNAMIC HUD PILL (TACTICAL PROGRESS HUD)        */}
        {/* Only rendered in interactive voice modes (practice & brevity)   */}
        {/* ============================================================== */}
        {activeMode !== 'manual' && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto w-[90%] max-w-3xl xl:max-w-4xl"
            style={{ willChange: 'transform' }}
          >
            <div className="flex items-center justify-between px-6 py-3 rounded-full bg-zinc-900/95 border border-zinc-700/90 shadow-2xl backdrop-blur-md font-mono text-xs">
              {/* Step / Substep Indicator Badge */}
              {activeMode === 'practice' ? (
                <div className="flex items-center gap-2.5 pr-4 border-r border-zinc-700/80 shrink-0">
                  <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded font-bold text-[11px]">
                    STEP {activeStep.code} • {currentSubstepIndex + 1}/{activeStep.substeps.length}
                  </span>
                  <span className="text-zinc-300 font-bold truncate max-w-[260px]">
                    {activeSubstep?.label || activeStep.title}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 pr-4 border-r border-zinc-700/80 shrink-0">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span className="text-zinc-300 font-bold">{activeCategory?.name || 'TBA'}</span>
                </div>
              )}

              {/* Microphone & SAPI Voice Feedback */}
              <div className="flex items-center gap-3 px-3 flex-1 min-w-[260px] truncate">
                <Mic
                  className={`w-4 h-4 shrink-0 ${
                    lastSpeech.status === 'VERIFIED'
                      ? 'text-emerald-400 animate-pulse'
                      : lastSpeech.status === 'DENIED' || lastSpeech.status === 'PTT_GATED'
                      ? 'text-amber-400 animate-bounce'
                      : 'text-cyan-400'
                  }`}
                />

                <div className="truncate flex items-center gap-2">
                  {lastSpeech.phrase ? (
                    <div key="speech-active" className="flex items-center gap-2 truncate">
                      <span className="text-zinc-100 font-bold truncate">
                        {`"${lastSpeech.phrase}"`}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold shrink-0 ${
                          lastSpeech.status === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : lastSpeech.status === 'DENIED'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {lastSpeech.status === 'VERIFIED'
                          ? `SAPI VERIFIED (${lastSpeech.confidence}%)`
                          : lastSpeech.status === 'DENIED'
                          ? 'GATE LOCKED'
                          : 'PTT REQUIRED'}
                      </span>
                    </div>
                  ) : (
                    <div key="speech-idle" className="truncate">
                      <span className="text-zinc-500 italic">
                        {activeMode === 'brevity'
                          ? 'Hot-mic active • Speak any tactical brevity phrase or callsign...'
                          : activeStep.id === 1 && currentSubstepIndex === 2
                          ? 'Speak "Loud and clear" or click Continue to Step 02...'
                          : chiefEngaged
                          ? 'Interphone active • Awaiting directive...'
                          : 'Speak "Engage Chief" to connect intercom...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* In analog substeps: Skip Button in pill */}
              {activeMode === 'practice' && activeSubstep?.interactiveControl?.type === 'AXIS_MONITOR' && (
                <button
                  onClick={() => handleSkipAxis(activeSubstep.id)}
                  className="px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-[background-color] cursor-pointer shrink-0 ml-3"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>SKIP AXIS</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TEMPORARY FLOATING STEP NAVIGATION ARROWS & SPEECH BUTTON       */}
        {/* Rapidly step through Cockpit Drill steps during development   */}
        {/* ============================================================== */}
        {(activeMode === 'practice' || activeMode === 'manual') && (
          <aside
            aria-label="Temporary Step Navigation"
            className="fixed bottom-6 left-6 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-zinc-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-md font-mono select-none"
            style={{ willChange: 'transform' }}
          >
            <button
              type="button"
              onClick={handlePrevStep}
              disabled={currentStepIndex === 0}
              aria-label="Previous step"
              title={
                currentStepIndex > 0
                  ? `Previous: [${RAMP_START_STEPS[currentStepIndex - 1]?.code}] ${RAMP_START_STEPS[currentStepIndex - 1]?.title}`
                  : 'At first step'
              }
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-30 disabled:hover:bg-zinc-800/90 text-cyan-400 hover:text-cyan-300 disabled:text-zinc-600 flex items-center justify-center transition-[background-color,color] cursor-pointer disabled:cursor-not-allowed border border-zinc-700/80 shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center justify-center px-2 min-w-[76px] leading-tight">
              <span className="text-[10px] text-zinc-400 font-bold tracking-wider uppercase">
                STEP {RAMP_START_STEPS[currentStepIndex]?.code || String(currentStepIndex).padStart(2, '0')}
              </span>
              <span className="text-[9px] text-cyan-400/80 font-semibold">
                {activeMode === 'practice'
                  ? `${currentSubstepIndex + 1}/${activeStep.substeps.length} • ${currentStepIndex + 1}/${RAMP_START_STEPS.length}`
                  : `${currentStepIndex + 1} / ${RAMP_START_STEPS.length}`}
              </span>
            </div>

            {/* Simulated Voice Callout Button (Visible whenever a spoken phrase is required) */}
            {activeMode === 'practice' && requiredSpokenPhrase && (
              <button
                type="button"
                onClick={() => handleSimulateSpeech(requiredSpokenPhrase)}
                disabled={isSimulatingSpeech}
                aria-label={`Say ${requiredSpokenPhrase}`}
                title={`Transmit simulated voice callout: "${requiredSpokenPhrase}"`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/25 hover:bg-emerald-500/35 active:bg-emerald-500/45 disabled:opacity-50 border border-emerald-400/60 text-emerald-300 hover:text-emerald-200 font-mono text-xs font-bold tracking-wide transition-[background-color,border-color,color] cursor-pointer disabled:cursor-wait shadow-lg shadow-emerald-950/40"
              >
                <Mic
                  className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${
                    isSimulatingSpeech ? 'animate-bounce' : 'animate-pulse'
                  }`}
                />
                <span className="whitespace-nowrap">
                  {isSimulatingSpeech ? 'TRANSMITTING...' : `SAY "${requiredSpokenPhrase}"`}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNextStep}
              disabled={currentStepIndex === RAMP_START_STEPS.length - 1}
              aria-label="Next step"
              title={
                currentStepIndex < RAMP_START_STEPS.length - 1
                  ? `Next: [${RAMP_START_STEPS[currentStepIndex + 1]?.code}] ${RAMP_START_STEPS[currentStepIndex + 1]?.title}`
                  : 'At last step'
              }
              className="w-9 h-9 rounded-full bg-zinc-800/90 hover:bg-zinc-700 active:bg-zinc-600 disabled:opacity-30 disabled:hover:bg-zinc-800/90 text-cyan-400 hover:text-cyan-300 disabled:text-zinc-600 flex items-center justify-center transition-[background-color,color] cursor-pointer disabled:cursor-not-allowed border border-zinc-700/80 shrink-0"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </aside>
        )}
      </div>
    </div>
  );
};
