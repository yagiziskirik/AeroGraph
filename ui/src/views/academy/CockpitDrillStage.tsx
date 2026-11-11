'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Zap,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  SkipForward,
  Award,
  Radio,
  Sliders,
  Check,
  Volume2,
  ShieldCheck,
  Footprints,
  AlertTriangle,
  Mic,
} from 'lucide-react';
import { Sound } from '../../services/sound';
import { TelemetryData } from '../../types/ipc';
import { RampStartStep, StepSubstep } from '../../services/voiceTrainingData';

interface CockpitDrillStageProps {
  activeStep: RampStartStep;
  currentSubstepIndex: number;
  onAdvanceSubstep: (nextSubstepIndex: number) => void;
  onAdvanceStep: (nextStepIndex: number) => void;
  onRestartDrill: () => void;
  telemetry: TelemetryData;
  invertBrakes: boolean;
  lastSpeech: {
    id: number;
    phrase: string;
    confidence: number;
    status: 'VERIFIED' | 'DENIED' | 'PTT_GATED' | 'GROUP_INACTIVE' | 'STANDBY';
    command?: string;
    reason?: string;
  };
  chiefEngaged: boolean;
  onEngageChief: () => void;
  onConsumeSpeech: () => void;
  onExitDrill: () => void;
}

// Deterministic phrase matcher per step and substep order
const matchSubstepPhrase = (
  stepId: number,
  substepOrder: number,
  rawPhrase: string,
  rawCmd?: string
): boolean => {
  const phrase = rawPhrase.trim().toUpperCase();
  const cmd = (rawCmd || '').trim().toUpperCase();

  // Step 0 Substep 1: Engage Chief
  if (stepId === 0) {
    const valid = [
      'ENGAGE CHIEF', 'ENGAGE CREW CHIEF', 'START CHIEF', 'START CREW CHIEF',
      'CHIEF', 'ENABLE CHIEF', 'BEGIN CHIEF', 'TURN ON CHIEF'
    ];
    return valid.includes(phrase) || cmd.includes('ENGAGE');
  }

  // Step 1 Substep 2: Comms Check
  if (stepId === 1 && substepOrder === 2) {
    const valid = ['COMMS CHECK', 'RADIO CHECK', 'CHIEF COMMS CHECK', 'CREW CHIEF COMMS CHECK'];
    return valid.includes(phrase) || cmd.includes('COMMS');
  }

  // Step 2 Substep 1: Start Two
  if (stepId === 2 && substepOrder === 1) {
    const valid = ['START TWO', 'READY START TWO', 'CHIEF START TWO', 'CLEAR START TWO', 'START 2', 'READY START 2'];
    return valid.includes(phrase) || cmd.includes('START TWO') || cmd.includes('START_TWO');
  }

  // Step 3 Substep 2: Clear SEC
  if (stepId === 3 && substepOrder === 2) {
    const valid = [
      'CLEAR SEC', 'CLEAR S E C', 'READY SEC', 'READY S E C',
      'CLEAR FOR SEC', 'CLEAR FOR SEC CHECK', 'READY FOR SEC CHECK'
    ];
    return valid.includes(phrase) || cmd.includes('SEC');
  }

  // Step 4 Substep 1: SEC Good
  if (stepId === 4 && substepOrder === 1) {
    const valid = [
      'SEC GOOD', 'S E C GOOD', 'SEC CHECK GOOD', 'CHIEF SEC GOOD',
      'SEC CHECK COMPLETE', 'SEC PASS', 'SEC OK'
    ];
    return valid.includes(phrase) || cmd.includes('SEC');
  }

  // Step 5 Substep 3: Pull EPU Pin
  if (stepId === 5 && substepOrder === 3) {
    const valid = [
      'PULL EPU PIN', 'PULL PIN', 'REMOVE EPU PIN', 'REMOVE PIN',
      'PULL EPU SAFETY PIN', 'REMOVE EPU SAFETY PIN', 'CHIEF PULL EPU PIN'
    ];
    return valid.includes(phrase) || cmd.includes('PIN');
  }

  // Step 6 Substep 1: Check Flow
  if (stepId === 6 && substepOrder === 1) {
    const valid = [
      'CHECK FLOW', 'FLOW CHECK', 'CLEARED TO CHECK FOR FLOW',
      'CHECK FOR FLOW', 'CHIEF CHECK FLOW', 'VERIFY FLOW'
    ];
    return valid.includes(phrase) || cmd.includes('FLOW');
  }

  // Step 7 Substep 2: Flight Controls Clear
  if (stepId === 7 && substepOrder === 2) {
    const valid = [
      'FLIGHT CONTROLS CLEAR', 'CONTROLS CLEAR', 'CHIEF FLIGHT CONTROLS CLEAR',
      'CONFIRM FLIGHT CONTROLS CLEAR'
    ];
    return valid.includes(phrase) || cmd.includes('CONTROLS CLEAR');
  }

  // Step 8 Substep 1: Cleared for BIT
  if (stepId === 8 && substepOrder === 1) {
    const valid = [
      'CLEARED FOR BIT', 'READY FOR BIT', 'CLEAR FOR FLCS BIT',
      'CHIEF CLEARED FOR BIT', 'BIT CHECK', 'CLEAR FOR BIT', 'READY BIT'
    ];
    return valid.includes(phrase) || cmd.includes('BIT');
  }

  // Step 9 Substep 2: Ready Trim
  if (stepId === 9 && substepOrder === 2) {
    const valid = [
      'READY TRIM', 'READY FOR TRIM CHECK', 'CHIEF READY TRIM',
      'READY FOR TRIM', 'TRIM CHECK READY'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM');
  }

  // Step 10 Substep 2: Trim Disconnected
  if (stepId === 10 && substepOrder === 2) {
    const valid = [
      'TRIM DISCONNECTED', 'CHIEF TRIM DISCONNECTED', 'TRIM DISC', 'TRIM DISCONNECT'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM DISC');
  }

  // Step 11 Substep 2: Trim Connected
  if (stepId === 11 && substepOrder === 2) {
    const valid = [
      'TRIM CONNECTED', 'CHIEF TRIM CONNECTED', 'TRIM NORMAL', 'TRIM IN NORM', 'TRIM CONNECT'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM CONN');
  }

  // Step 12 Substep 1: Clear Big Movements
  if (stepId === 12 && substepOrder === 1) {
    const valid = [
      'CLEAR BIG MOVEMENTS', 'CLEAR FOR BIG MOVEMENTS', 'CHIEF CLEAR BIG MOVEMENTS',
      'BIG MOVEMENTS', 'CYCLE CONTROLS', 'WIGGLE SURFACES', 'READY BIG MOVEMENTS'
    ];
    return valid.includes(phrase) || cmd.includes('BIG MOVEMENTS');
  }

  // Step 13 Substep 1: DBU Still Clear
  if (stepId === 13 && substepOrder === 1) {
    const valid = [
      'DBU STILL CLEAR', 'CHIEF DBU STILL CLEAR', 'DBU CLEAR', 'DIGITAL BACKUP CLEAR'
    ];
    return valid.includes(phrase) || cmd.includes('DBU');
  }

  // Step 14 Substep 1: Ready Left Brake
  if (stepId === 14 && substepOrder === 1) {
    const valid = [
      'READY LEFT BRAKE', 'CHIEF READY LEFT BRAKE', 'LEFT BRAKE', 'READY ON THE LEFT BRAKE'
    ];
    return valid.includes(phrase) || cmd.includes('LEFT BRAKE');
  }

  // Step 15 Substep 1: Ready Right Brake
  if (stepId === 15 && substepOrder === 1) {
    const valid = [
      'READY RIGHT BRAKE', 'CHIEF READY RIGHT BRAKE', 'RIGHT BRAKE', 'READY ON THE RIGHT BRAKE'
    ];
    return valid.includes(phrase) || cmd.includes('RIGHT BRAKE');
  }

  // Step 16 Substep 1: Ready AAR Door
  if (stepId === 16 && substepOrder === 1) {
    const valid = [
      'READY AAR DOOR', 'CHIEF READY AAR DOOR', 'AAR DOOR CHECK', 'READY AIR REFUEL DOOR', 'AAR DOOR'
    ];
    return valid.includes(phrase) || cmd.includes('AAR');
  }

  // Step 17 Substep 2: Remove Chocks
  if (stepId === 17 && substepOrder === 2) {
    const valid = [
      'REMOVE CHOCKS', 'WHEEL CHOCKS', 'REMOVE WHEEL CHOCKS', 'PULL CHOCKS',
      'PULL WHEEL CHOCKS', 'CHOCKS AWAY', 'CHIEF REMOVE CHOCKS'
    ];
    return valid.includes(phrase) || cmd.includes('CHOCKS');
  }

  // Step 18 Substep 1: Cleared Off
  if (stepId === 18 && substepOrder === 1) {
    const valid = [
      'CLEARED OFF', 'CLEAR GROUND', 'CHIEF CLEARED OFF', 'CLEAR OFF',
      'EVERYTHING OFF', 'ALL OFF'
    ];
    return valid.includes(phrase) || cmd.includes('CLEARED OFF');
  }

  return false;
};

export const CockpitDrillStage: React.FC<CockpitDrillStageProps> = ({
  activeStep,
  currentSubstepIndex,
  onAdvanceSubstep,
  onAdvanceStep,
  onRestartDrill,
  telemetry,
  invertBrakes,
  lastSpeech,
  chiefEngaged,
  onEngageChief,
  onConsumeSpeech,
  onExitDrill,
}) => {
  const activeSubstep: StepSubstep | undefined = activeStep.substeps[currentSubstepIndex];

  // =========================================================================
  // SIMULATION PROCEDURAL & MECHANICAL STATES
  // =========================================================================
  const [interphoneConnected, setInterphoneConnected] = useState(chiefEngaged);
  const [isChiefResponding, setIsChiefResponding] = useState(false);
  const [chiefDialogue, setChiefDialogue] = useState('');

  // Step 01: ELEC Panel
  const [elecSwitchPos, setElecSwitchPos] = useState<'OFF' | 'BATT' | 'MAIN_PWR'>('OFF');

  // Step 02: JFS & Engine Spool & Throttle Detent
  const [jfsAccumPsi, setJfsAccumPsi] = useState(3000);
  const [jfsSwitch, setJfsSwitch] = useState<'START_1' | 'OFF' | 'START_2'>('OFF');
  const [jfsRunLit, setJfsRunLit] = useState(false);
  const [tachRpm, setTachRpm] = useState(0);
  const [ftitDeg, setFtitDeg] = useState(20);
  const [throttlePosition, setThrottlePosition] = useState<'CUTOFF' | 'IDLE' | '73_SEC' | '82_EPU'>('CUTOFF');

  // Step 03 & 04: SEC Check & Nozzle
  const [secTimerRemaining, setSecTimerRemaining] = useState(30);
  const [engContMode, setEngContMode] = useState<'PRI' | 'SEC'>('PRI');
  const [nozzlePercent, setNozzlePercent] = useState(100);

  // Step 05 & 06: EPU
  const [epuSwitch, setEpuSwitch] = useState<'OFF' | 'NORM' | 'ON'>('NORM');
  const [epuPinRemoved, setEpuPinRemoved] = useState(false);
  const [epuRunLightLit, setEpuRunLightLit] = useState(false);
  const [epuAirLightLit, setEpuAirLightLit] = useState(false);
  const [epuTestHoldProgress, setEpuTestHoldProgress] = useState(0);

  // Step 08: FLCS BIT (15s sweep)
  const [flcsBitSwitch, setFlcsBitSwitch] = useState<'OFF' | 'BIT'>('OFF');
  const [flcsBitActive, setFlcsBitActive] = useState(false);
  const [flcsBitElapsed, setFlcsBitElapsed] = useState(0);

  // Step 09-11: Trims
  const [trimDiscSwitch, setTrimDiscSwitch] = useState<'DISC' | 'NORM'>('NORM');
  const [rollTrim, setRollTrim] = useState(0);
  const [pitchTrim, setPitchTrim] = useState(0);
  const [yawTrim, setYawTrim] = useState(0);

  // Step 07: Pre-BIT Flight Control Exercise (15-20s Warm-Up)
  const [controlWarmupRemaining, setControlWarmupRemaining] = useState(18);

  // Step 12: Big Movements & MPO Kick & Speedbrakes
  const [speedbrakesOpen, setSpeedbrakesOpen] = useState(false);
  const [speedbrakesEverOpened, setSpeedbrakesEverOpened] = useState(false);

  // Step 13: DBU
  const [dbuSwitchOn, setDbuSwitchOn] = useState(false);

  // Step 14 & 15: Brakes (Physical Axis Integration)
  const [brakeHoldTimer, setBrakeHoldTimer] = useState(0);

  // Step 16: AAR Door
  const [aarSwitch, setAarSwitch] = useState<'CLOSE' | 'OPEN'>('CLOSE');

  // Step 17: Chocks
  const [chocksInPlace, setChocksInPlace] = useState(true);

  // Step 18: Cleared Off & Marshal Finale
  const [finaleSaluteActive, setFinaleSaluteActive] = useState(false);

  // Sync chief engaged state
  useEffect(() => {
    if (chiefEngaged) setInterphoneConnected(true);
  }, [chiefEngaged]);

  // =========================================================================
  // HARDWARE AXES TELEMETRY ALIGNMENT
  // =========================================================================
  const rawLeftBrake = telemetry.left_brake !== undefined ? telemetry.left_brake : 0.0;
  const rawRightBrake = telemetry.right_brake !== undefined ? telemetry.right_brake : 0.0;
  const rawPitch = telemetry.pitch_axis !== undefined ? telemetry.pitch_axis : 0.5;
  const rawRoll = telemetry.roll_axis !== undefined ? telemetry.roll_axis : 0.5;
  const rawYaw = telemetry.yaw_axis !== undefined ? telemetry.yaw_axis : 0.5;

  // Correct DirectInput inversion: stick left moves left, pull aft moves aft
  const rollDisplay = 1.0 - rawRoll;
  const pitchDisplay = 1.0 - rawPitch;
  const yawDisplay = 1.0 - rawYaw;

  const leftBrakeDeflection = invertBrakes
    ? Math.max(0, Math.min(1.0, 1.0 - rawLeftBrake))
    : Math.max(0, Math.min(1.0, rawLeftBrake));
  const rightBrakeDeflection = invertBrakes
    ? Math.max(0, Math.min(1.0, 1.0 - rawRightBrake))
    : Math.max(0, Math.min(1.0, rawRightBrake));
  const areBrakesHeld = leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15;

  // Physical MPO switch evaluation from hardware telemetry (strictly an indicator)
  const isMpoActive = Boolean(telemetry.mpo_active);

  // =========================================================================
  // DETERMINISTIC SPEECH RECOGNITION CONSUMPTION
  // =========================================================================
  const lastProcessedSpeechIdRef = useRef<number>(0);

  const triggerVerbalAdvance = useCallback((expectedDialogue: string) => {
    Sound.playCommit();
    onConsumeSpeech();

    if (activeStep.id === 0) {
      onEngageChief();
      setInterphoneConnected(true);
    }

    setIsChiefResponding(true);
    setChiefDialogue(expectedDialogue);

    setTimeout(() => {
      setIsChiefResponding(false);
      if (currentSubstepIndex < activeStep.substeps.length - 1) {
        onAdvanceSubstep(currentSubstepIndex + 1);
      } else if (activeStep.id < 18) {
        onAdvanceStep(activeStep.id + 1);
      }
    }, 1200);
  }, [activeStep, currentSubstepIndex, onAdvanceSubstep, onAdvanceStep, onConsumeSpeech, onEngageChief]);

  useEffect(() => {
    if (!lastSpeech.phrase || lastSpeech.status !== 'VERIFIED') return;
    if (lastSpeech.id === lastProcessedSpeechIdRef.current) return;

    // Optional pilot acknowledgment: Step 01 Substep 1-3 ("Loud and clear" or continue)
    if (activeStep.id === 1 && currentSubstepIndex === 2) {
      const p = lastSpeech.phrase.toUpperCase();
      if (
        p.includes('LOUD AND CLEAR') ||
        p.includes('LOUD & CLEAR') ||
        p === 'CLEAR' ||
        lastSpeech.command?.toLowerCase().includes('clear')
      ) {
        lastProcessedSpeechIdRef.current = lastSpeech.id;
        Sound.playCommit();
        onConsumeSpeech();
        onAdvanceStep(2);
        return;
      }
    }

    // Non-verbal phases: silently ignore without alarms or scolding
    if (activeSubstep?.phaseType !== 'VERBAL') {
      return;
    }

    const isMatch = matchSubstepPhrase(
      activeStep.id,
      activeSubstep.order,
      lastSpeech.phrase,
      lastSpeech.command
    );

    if (isMatch) {
      lastProcessedSpeechIdRef.current = lastSpeech.id;
      triggerVerbalAdvance(activeStep.expectedChiefResponse);
    }
  }, [
    lastSpeech,
    activeStep,
    activeSubstep,
    currentSubstepIndex,
    onAdvanceStep,
    onConsumeSpeech,
    triggerVerbalAdvance,
  ]);

  // =========================================================================
  // STEP 02: JFS START 2 & ENGINE SPOOL ANIMATION
  // =========================================================================
  const handleSnapJfsStart2 = () => {
    Sound.playSwitch();
    setJfsSwitch('START_2');

    // Dual accumulators discharge 3000 -> 500 PSI over 1.5s
    let psi = 3000;
    const interval = setInterval(() => {
      psi -= 250;
      if (psi <= 500) {
        psi = 500;
        clearInterval(interval);
        setJfsRunLit(true);

        // Core spools smoothly from 0 to 20% RPM
        let rpm = 0;
        const rpmInterval = setInterval(() => {
          rpm += 2.5;
          if (rpm >= 20) {
            rpm = 20;
            clearInterval(rpmInterval);
            Sound.playCommit();
            // Advance cleanly to Substep 2-3 (20% RPM Gate achieved)
            onAdvanceSubstep(2);
          }
          setTachRpm(rpm);
        }, 50);
      }
      setJfsAccumPsi(psi);
    }, 50);
  };

  // Direct Throttle Advance to IDLE
  const handleThrottleCutoffToIdle = () => {
    Sound.playSwitch();
    setThrottlePosition('IDLE');

    // FTIT climbs to 550°C and Tachometer stabilizes at 65% RPM
    let temp = 20;
    let rpm = tachRpm > 0 ? tachRpm : 20;
    const lightoffInterval = setInterval(() => {
      temp += 45;
      if (rpm < 65) rpm += 4;
      if (temp >= 550) {
        temp = 550;
        rpm = 65;
        clearInterval(lightoffInterval);
        Sound.playCommit();
        // Advance to Substep 2-5 (Idle Stabilization Verification)
        onAdvanceSubstep(4);
      }
      setFtitDeg(temp);
      setTachRpm(rpm);
    }, 50);
  };

  // =========================================================================
  // STEP 03: 30-SECOND IDLE STABILIZATION COUNTDOWN
  // =========================================================================
  useEffect(() => {
    if (activeStep.id !== 3 || currentSubstepIndex !== 0) return;
    const timer = setInterval(() => {
      setSecTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Sound.playCommit();
          onAdvanceSubstep(1); // Advance to Substep 3-2 (Brakes & Clear SEC call)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeStep.id, currentSubstepIndex, onAdvanceSubstep]);

  // Step 3-3: Toggle ENG CONT to SEC
  const handleToggleEngContToSec = () => {
    Sound.playSwitch();
    setEngContMode('SEC');
    setNozzlePercent(4); // Nozzle closes tightly to < 5%
    Sound.playCommit();
    // Advance to Substep 3-4 (Spool to 73% RPM in SEC)
    onAdvanceSubstep(3);
  };

  // Step 3-4: Spool to 73% RPM in SEC
  const handleSpoolTo73Rpm = () => {
    Sound.playSwitch();
    setThrottlePosition('73_SEC');
    let rpm = 65;
    const spoolInterval = setInterval(() => {
      rpm += 2;
      if (rpm >= 75) {
        rpm = 75;
        clearInterval(spoolInterval);
        Sound.playCommit();
        onAdvanceSubstep(4); // Substep 3-5: Retard to IDLE
      }
      setTachRpm(rpm);
    }, 50);
  };

  // Step 3-5: Retard to IDLE in SEC
  const handleRetardToIdleSec = () => {
    Sound.playSwitch();
    setThrottlePosition('IDLE');
    setTachRpm(65);
    Sound.playCommit();
  };

  // Step 4-2: Revert to PRI
  const handleRevertEngContToPri = () => {
    Sound.playSwitch();
    setEngContMode('PRI');
    setNozzlePercent(100);
    Sound.playCommit();
    onAdvanceSubstep(2); // Substep 4-3: Observe Nozzle Opening to 100%
  };

  // =========================================================================
  // STEP 06: EPU/GEN TEST SWITCH (5-SECOND COUNTDOWN HOLD)
  // =========================================================================
  const epuTestTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startEpuTestHold = () => {
    Sound.playSwitch();
    let elapsed = 0;
    setEpuRunLightLit(true);
    setEpuAirLightLit(true);

    epuTestTimerRef.current = setInterval(() => {
      elapsed += 1;
      setEpuTestHoldProgress((elapsed / 5) * 100);
      if (elapsed >= 5) {
        if (epuTestTimerRef.current) clearInterval(epuTestTimerRef.current);
        Sound.playCommit();
        onAdvanceSubstep(3); // Advance to Substep 6-4: Retard to IDLE
      }
    }, 1000);
  };

  const cancelEpuTestHold = () => {
    if (epuTestTimerRef.current) {
      clearInterval(epuTestTimerRef.current);
      epuTestTimerRef.current = null;
    }
    if (epuTestHoldProgress < 100) {
      setEpuTestHoldProgress(0);
      setEpuRunLightLit(false);
      setEpuAirLightLit(false);
    }
  };

  // =========================================================================
  // STEP 07: FLIGHT CONTROL EXERCISE & HYDRAULIC WARM-UP (15-20S WIGGLE)
  // =========================================================================
  useEffect(() => {
    if (activeStep.id !== 7) {
      setControlWarmupRemaining(18);
    }
  }, [activeStep.id]);

  useEffect(() => {
    if (activeStep.id !== 7 || currentSubstepIndex !== 2) return;

    const interval = setInterval(() => {
      setControlWarmupRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          Sound.playCommit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeStep.id, currentSubstepIndex]);

  // =========================================================================
  // STEP 08: 15-SECOND FLCS BIT SEQUENCE
  // =========================================================================
  const handleTriggerFlcsBit = () => {
    Sound.playSwitch();
    setFlcsBitSwitch('BIT');
    setFlcsBitActive(true);
    setFlcsBitElapsed(0);

    const bitTimer = setInterval(() => {
      setFlcsBitElapsed((prev) => {
        const next = prev + 1;
        if (next >= 15) {
          clearInterval(bitTimer);
          setFlcsBitActive(false);
          setFlcsBitSwitch('OFF'); // Magnetic auto unlatch
          Sound.playSwitch();
          Sound.playCommit();
          onAdvanceSubstep(3); // Substep 8-4: Test Pass Verification
          return 15;
        }
        return next;
      });
    }, 1000);
  };

  // =========================================================================
  // STEP 11: SEQUENTIAL TRIM DEFLECTIONS & MANUAL RE-CENTERING
  // =========================================================================
  useEffect(() => {
    if (activeStep.id === 11 && currentSubstepIndex === 2) {
      const timers = [
        setTimeout(() => setPitchTrim(4), 1000),   // Nose Up
        setTimeout(() => setPitchTrim(-4), 2500),  // Nose Down
        setTimeout(() => setRollTrim(-5), 4000),   // Roll Left
        setTimeout(() => setRollTrim(5), 5500),    // Roll Right
        setTimeout(() => setYawTrim(-6), 7000),    // Yaw Left
        setTimeout(() => setYawTrim(6), 8500),     // Yaw Right
        setTimeout(() => {
          Sound.playCommit();
          onAdvanceSubstep(3); // Substep 11-4: Pilot Manual Centering
        }, 10000),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [activeStep.id, currentSubstepIndex, onAdvanceSubstep]);

  const handleCenterTrimDial = (dial: 'roll' | 'pitch' | 'yaw') => {
    Sound.playClick();
    if (dial === 'roll') setRollTrim(0);
    if (dial === 'pitch') setPitchTrim(0);
    if (dial === 'yaw') setYawTrim(0);
  };

  // =========================================================================
  // STEP 12: SMALL FLIGHT CONTROL DEFLECTION (10-15%) & MPO KICK & SPEEDBRAKES
  // =========================================================================
  const rollSatisfied = Math.abs(rollDisplay - 0.5) >= 0.08;
  const pitchSatisfied = Math.abs(pitchDisplay - 0.5) >= 0.08;
  const yawSatisfied = Math.abs(yawDisplay - 0.5) >= 0.08;

  // Auto-advance on small control sweeps
  useEffect(() => {
    if (activeStep.id !== 12) return;

    if (currentSubstepIndex === 1 && rollSatisfied) {
      const t = setTimeout(() => {
        Sound.playCommit();
        onAdvanceSubstep(2);
      }, 700);
      return () => clearTimeout(t);
    }

    if (currentSubstepIndex === 2 && pitchSatisfied) {
      const t = setTimeout(() => {
        Sound.playCommit();
        onAdvanceSubstep(3);
      }, 700);
      return () => clearTimeout(t);
    }

    if (currentSubstepIndex === 3 && isMpoActive) {
      const t = setTimeout(() => {
        Sound.playCommit();
        onAdvanceSubstep(4);
      }, 700);
      return () => clearTimeout(t);
    }

    if (currentSubstepIndex === 4 && yawSatisfied) {
      const t = setTimeout(() => {
        Sound.playCommit();
        onAdvanceSubstep(5);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [activeStep.id, currentSubstepIndex, rollSatisfied, pitchSatisfied, isMpoActive, yawSatisfied, onAdvanceSubstep]);

  // Speedbrake cycle (Open once, then Close to advance - strictly when prompted on Substep 12-6)
  const handleToggleSpeedbrakes = () => {
    if (activeStep.id !== 12 || currentSubstepIndex !== 5) return;
    Sound.playSwitch();
    if (!speedbrakesOpen) {
      setSpeedbrakesOpen(true);
      setSpeedbrakesEverOpened(true);
    } else {
      setSpeedbrakesOpen(false);
      if (speedbrakesEverOpened) {
        Sound.playCommit();
        setTimeout(() => {
          onAdvanceStep(13);
        }, 800);
      }
    }
  };

  // =========================================================================
  // STEP 14 & 15: PHYSICAL BRAKE PEDAL INTEGRATION (3-SECOND HOLD)
  // =========================================================================
  useEffect(() => {
    if (activeStep.id === 14 && currentSubstepIndex === 1) {
      let interval: NodeJS.Timeout | null = null;
      if (leftBrakeDeflection >= 0.15) {
        interval = setInterval(() => {
          setBrakeHoldTimer((prev) => {
            const next = prev + 1;
            if (next >= 3) {
              if (interval) clearInterval(interval);
              Sound.playCommit();
              onAdvanceSubstep(2);
              return 3;
            }
            return next;
          });
        }, 1000);
      } else {
        setBrakeHoldTimer(0);
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }

    if (activeStep.id === 15 && currentSubstepIndex === 1) {
      let interval: NodeJS.Timeout | null = null;
      if (rightBrakeDeflection >= 0.15) {
        interval = setInterval(() => {
          setBrakeHoldTimer((prev) => {
            const next = prev + 1;
            if (next >= 3) {
              if (interval) clearInterval(interval);
              Sound.playCommit();
              onAdvanceSubstep(2);
              return 3;
            }
            return next;
          });
        }, 1000);
      } else {
        setBrakeHoldTimer(0);
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [activeStep.id, currentSubstepIndex, leftBrakeDeflection, rightBrakeDeflection, onAdvanceSubstep]);

  // =========================================================================
  // STEP 18: FINALE SALUTE & DELAYED RETURN TO COMMS
  // =========================================================================
  const handleTriggerFinale = () => {
    Sound.playCommit();
    setFinaleSaluteActive(true);
    // Wait a brief moment showing departure salute before returning to station
    setTimeout(() => {
      onExitDrill();
    }, 1800);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 font-mono select-none">
      {/* ============================================================== */}
      {/* 1. CINEMATIC SCENE VIEWPORT                                     */}
      {/* ============================================================== */}
      <div className="w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Scene Header */}
        <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-black text-zinc-200 uppercase tracking-wider">
              {activeStep.code} • {activeSubstep?.cockpitPanel || activeStep.cockpitVisual.panelName}
            </span>
          </div>

          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
            PHASE: {activeSubstep?.phaseType || 'DIRECTIVE'} • SUBSTEP {currentSubstepIndex + 1} OF {activeStep.substeps.length}
          </span>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* SCENE 00: COCKPIT SILL & GROUND INTERPHONE JACK              */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 0 && (
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-lg h-56 flex items-center justify-center my-2 rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-inner">
              <svg className="w-full h-full" viewBox="0 0 500 240">
                <path d="M 0 40 L 500 40 L 500 240 L 0 240 Z" fill="#18181b" />
                <path d="M 0 40 L 500 40" stroke="#27272a" strokeWidth="3" />
                {[40, 100, 160, 220, 280, 340, 400, 460].map((x) => (
                  <circle key={x} cx={x} cy="55" r="2" fill="#52525b" />
                ))}

                <rect x="180" y="70" width="140" height="110" rx="8" fill="#27272a" stroke="#3f3f46" strokeWidth="2.5" />
                <text x="250" y="92" textAnchor="middle" fill="#a1a1aa" fontSize="9" fontWeight="bold" letterSpacing="1">
                  GROUND INTERPHONE
                </text>

                <g transform="translate(250, 105)">
                  <rect x="-35" y="-35" width="70" height="12" rx="3" fill="#3f3f46" stroke="#52525b" strokeWidth="1.5" />
                  <circle cx="0" cy="-29" r="3" fill="#71717a" />
                </g>

                <circle cx="250" cy="135" r="22" fill="#09090b" stroke="#3f3f46" strokeWidth="3" />
                <circle cx="250" cy="135" r="14" fill="#18181b" stroke="#27272a" strokeWidth="2" />

                {interphoneConnected ? (
                  <g>
                    <rect x="242" y="125" width="16" height="30" rx="2" fill="#eab308" stroke="#ca8a04" strokeWidth="1.5" />
                    <path
                      d="M 250 155 Q 240 185 260 210 Q 280 235 250 240"
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <circle cx="250" cy="135" r="3" fill="#22c55e" className="animate-ping" />
                  </g>
                ) : (
                  <text x="250" y="140" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">
                    CIRCUIT READY
                  </text>
                )}
              </svg>
            </div>

            <div className="flex flex-col items-center gap-2 mt-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Mic className="w-4 h-4 animate-pulse" />
                <span>HOT-MIC LISTENING • Speak &quot;Engage Chief&quot; into your microphone</span>
              </div>
              <p className="text-[11px] text-zinc-400 text-center max-w-md">
                Connect ground interphone to establish direct audio link with Crew Chief standing beside the left sill.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 01: RIGHT REAR CONSOLE — ELEC PANEL                    */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 1 && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MAIN PWR Switch */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  MAIN PWR SWITCH
                </span>

                <div className="flex flex-col items-center my-3">
                  <div className="w-20 h-28 bg-zinc-950 border-2 border-zinc-700 rounded p-2 flex flex-col items-center justify-between relative shadow-inner">
                    <span className="text-[9px] font-bold text-emerald-400">MAIN PWR</span>
                    <span className="text-[9px] font-bold text-zinc-500">BATT</span>
                    <span className="text-[9px] font-bold text-zinc-400">OFF</span>

                    <div
                      onClick={() => {
                        if (currentSubstepIndex === 0) {
                          Sound.playSwitch();
                          setElecSwitchPos('MAIN_PWR');
                          Sound.playCommit();
                          onAdvanceSubstep(1);
                        }
                      }}
                      className={`absolute w-10 h-10 rounded-full border-2 transition-[top,background-color] duration-200 flex items-center justify-center ${
                        currentSubstepIndex === 0 ? 'cursor-pointer hover:border-emerald-400' : 'cursor-default'
                      } ${
                        elecSwitchPos === 'MAIN_PWR'
                          ? 'top-2 bg-emerald-400 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                          : 'bottom-2 bg-zinc-600 border-zinc-500'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-zinc-900" />
                    </div>
                  </div>
                </div>

                {currentSubstepIndex === 0 ? (
                  <button
                    onClick={() => {
                      Sound.playSwitch();
                      setElecSwitchPos('MAIN_PWR');
                      Sound.playCommit();
                      onAdvanceSubstep(1);
                    }}
                    className="w-full py-2 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-xs font-bold cursor-pointer transition-[background-color]"
                  >
                    CLICK TO FLIP MAIN PWR TO MAIN PWR
                  </button>
                ) : (
                  <div className="text-[11px] font-bold text-emerald-400">MAIN PWR ENERGIZED</div>
                )}
              </div>

              {/* Annunciator Bus Status */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 text-center">
                  ANNUNCIATOR BUS
                </span>

                <div className="grid grid-cols-2 gap-3 my-auto">
                  <div
                    className={`p-3 rounded-lg border text-center transition-[background-color,border-color] ${
                      elecSwitchPos === 'MAIN_PWR'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    <div className="text-xs font-black">MAIN GEN</div>
                    <div className="text-[9px] mt-0.5">{elecSwitchPos === 'MAIN_PWR' ? 'CAUTION LIT' : 'DARK'}</div>
                  </div>

                  <div
                    className={`p-3 rounded-lg border text-center transition-[background-color,border-color] ${
                      elecSwitchPos === 'MAIN_PWR'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    <div className="text-xs font-black">STBY GEN</div>
                    <div className="text-[9px] mt-0.5">{elecSwitchPos === 'MAIN_PWR' ? 'CAUTION LIT' : 'DARK'}</div>
                  </div>

                  <div
                    className={`col-span-2 p-2 rounded-lg border text-center transition-[background-color,border-color] ${
                      elecSwitchPos === 'MAIN_PWR'
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    <span className="text-[11px] font-bold">FLCS PWR TEST • PASS</span>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 text-center mt-2">
                  Battery bus connected. Generators offline awaiting engine spool.
                </p>
              </div>
            </div>

            {/* Substep 1-2 Verbal Action */}
            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Ground Interphone Comms Check</div>
                  <div className="text-[11px] text-zinc-400">Speak &quot;Comms Check&quot; into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {/* Substep 1-3 Optional Pilot "Loud and Clear" or Continue button */}
            {currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Chief Responded: &quot;Loud and clear, sir/ma&apos;am.&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak &quot;Loud and clear&quot; into mic OR click button to continue to Step 02.</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                    <Mic className="w-3.5 h-3.5 animate-pulse" />
                    <span>VOICE READY</span>
                  </div>
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      onAdvanceStep(2);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-[background-color]"
                  >
                    <Check className="w-4 h-4" />
                    <span>CONTINUE TO STEP 02</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 02: JFS ACCUMULATORS & THROTTLE CUTOFF DETENT          */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 2 && (
          <div className="w-full space-y-4">
            {/* Substep 2-1: Verbal "Start Two" */}
            {currentSubstepIndex === 0 && (
              <div className="w-full max-w-xl mx-auto p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs leading-relaxed max-w-lg">
                  <strong className="text-amber-400">DASH-1 NOTE:</strong> Moving canopy during JFS operation depletes accumulator hydraulic pressure and aborts start. Ensure canopy remains stationary.
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE • Speak &quot;Start Two&quot; into your microphone</span>
                </div>
              </div>
            )}

            {/* Substeps 2-2 & 2-3: JFS START 2 Switch & Dual Accumulators */}
            {(currentSubstepIndex === 1 || currentSubstepIndex === 2) && (
              <div className="w-full max-w-2xl mx-auto space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-zinc-400 mb-1">JFS ACCUM 1</span>
                    <svg className="w-28 h-28" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="#09090b" stroke="#27272a" strokeWidth="4" />
                      <path d="M 24 88 A 45 45 0 0 1 20 60" fill="none" stroke="#ef4444" strokeWidth="4" />
                      {(() => {
                        const deg = -135 + (jfsAccumPsi / 3000) * 270;
                        const rad = ((deg - 90) * Math.PI) / 180;
                        return (
                          <line
                            x1="60"
                            y1="60"
                            x2={60 + 38 * Math.cos(rad)}
                            y2={60 + 38 * Math.sin(rad)}
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        );
                      })()}
                      <circle cx="60" cy="60" r="5" fill="#e4e4e7" />
                      <text x="60" y="85" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                        {Math.round(jfsAccumPsi)}
                      </text>
                      <text x="60" y="96" textAnchor="middle" fill="#71717a" fontSize="7">PSI</text>
                    </svg>
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase text-center">JFS SWITCH</span>

                    <div
                      onClick={() => {
                        if (currentSubstepIndex === 1) handleSnapJfsStart2();
                      }}
                      className={`w-16 h-28 bg-zinc-950 border-2 border-zinc-700 rounded-lg p-2 flex flex-col items-center justify-between relative shadow-inner ${
                        currentSubstepIndex === 1 ? 'cursor-pointer hover:border-emerald-500/60' : 'cursor-default'
                      }`}
                    >
                      <span className="text-[9px] font-bold text-zinc-400">START 1</span>
                      <span className="text-[9px] font-bold text-zinc-500">OFF</span>
                      <span className="text-[9px] font-bold text-emerald-400">START 2</span>

                      <div
                        className={`absolute w-8 h-8 rounded-full border-2 transition-[bottom,background-color] duration-200 flex items-center justify-center ${
                          jfsSwitch === 'START_2'
                            ? 'bottom-2 bg-emerald-400 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                            : 'top-10 bg-zinc-400 border-zinc-200'
                        }`}
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />
                      </div>
                    </div>

                    {currentSubstepIndex === 1 ? (
                      <button
                        onClick={handleSnapJfsStart2}
                        className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-[10px] font-bold cursor-pointer"
                      >
                        SNAP START 2
                      </button>
                    ) : (
                      <div className="text-[10px] text-emerald-400 font-bold">START 2 ENGAGED</div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center">
                    <span className="text-[10px] font-bold text-zinc-400 mb-1">JFS ACCUM 2</span>
                    <svg className="w-28 h-28" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="52" fill="#09090b" stroke="#27272a" strokeWidth="4" />
                      <path d="M 24 88 A 45 45 0 0 1 20 60" fill="none" stroke="#ef4444" strokeWidth="4" />
                      {(() => {
                        const deg = -135 + (jfsAccumPsi / 3000) * 270;
                        const rad = ((deg - 90) * Math.PI) / 180;
                        return (
                          <line
                            x1="60"
                            y1="60"
                            x2={60 + 38 * Math.cos(rad)}
                            y2={60 + 38 * Math.sin(rad)}
                            stroke="#10b981"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        );
                      })()}
                      <circle cx="60" cy="60" r="5" fill="#e4e4e7" />
                      <text x="60" y="85" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="bold">
                        {Math.round(jfsAccumPsi)}
                      </text>
                      <text x="60" y="96" textAnchor="middle" fill="#71717a" fontSize="7">PSI</text>
                    </svg>
                  </div>
                </div>

                {/* Substep 2-3 Proceed Button once 20% RPM is reached */}
                {currentSubstepIndex === 2 && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Core Spooling: {Math.round(tachRpm)}% RPM (20% Target Achieved)</div>
                      <div className="text-[11px] text-zinc-400">JFS RUN light solid. Ready for fuel introduction.</div>
                    </div>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(3);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      <span>PROCEED TO FUEL INTRODUCTION</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Substeps 2-4 & 2-5: Throttle Detent & Engine Light-Off */}
            {currentSubstepIndex >= 3 && (
              <div className="w-full max-w-2xl mx-auto space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                    <div className="w-full flex items-center justify-between text-[10px] text-zinc-400 font-bold mb-2">
                      <span>F-16 TQS THROTTLE GATE</span>
                      <span className={throttlePosition !== 'CUTOFF' ? 'text-emerald-400' : 'text-amber-400'}>
                        GATE: {throttlePosition}
                      </span>
                    </div>

                    <div className="relative w-full h-40 my-2 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                      <svg className="w-full h-full" viewBox="0 0 320 160">
                        <path d="M 40 120 Q 160 110 280 120" fill="none" stroke="#27272a" strokeWidth="16" strokeLinecap="round" />
                        <line x1="50" y1="102" x2="50" y2="138" stroke="#ef4444" strokeWidth="2.5" />
                        <text x="50" y="96" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold">CUTOFF</text>
                        <line x1="120" y1="104" x2="120" y2="136" stroke="#10b981" strokeWidth="2.5" />
                        <text x="120" y="98" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="bold">IDLE</text>

                        {(() => {
                          const leverX = throttlePosition !== 'CUTOFF' ? 120 : 50;
                          return (
                            <g transform={`translate(${leverX}, 75)`} style={{ transition: 'transform 0.4s ease-out' }}>
                              <line x1="0" y1="0" x2="0" y2="45" stroke="#52525b" strokeWidth="10" strokeLinecap="round" />
                              <path d="M -22 -28 C -22 -36, 15 -36, 25 -28 C 30 -22, 28 -5, 18 0 C 8 2, -18 2, -22 -28 Z" fill="#27272a" stroke="#3f3f46" strokeWidth="2" />
                              <path d="M -18 2 L -2 2 L -4 -6 L -16 -6 Z" fill="#10b981" stroke="#ffffff" strokeWidth="1.2" />
                            </g>
                          );
                        })()}
                      </svg>
                    </div>

                    {currentSubstepIndex === 3 ? (
                      <button
                        onClick={handleThrottleCutoffToIdle}
                        className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs tracking-wider cursor-pointer shadow-lg flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4" />
                        <span>LIFT DETENT &amp; ADVANCE THROTTLE TO IDLE</span>
                      </button>
                    ) : (
                      <div className="text-xs font-bold text-emerald-400">THROTTLE SEATED IN IDLE</div>
                    )}
                  </div>

                  <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center mb-2">
                      FTIT &amp; CORE TACHOMETER
                    </span>
                    <div className="flex flex-col items-center my-auto">
                      <svg className="w-36 h-36" viewBox="0 0 140 140">
                        <circle cx="70" cy="70" r="60" fill="#09090b" stroke="#27272a" strokeWidth="5" />
                        <path d="M 108 42 A 52 52 0 0 1 120 70" fill="none" stroke="#ef4444" strokeWidth="5" />
                        {(() => {
                          const deg = -135 + (ftitDeg / 1000) * 270;
                          const rad = ((deg - 90) * Math.PI) / 180;
                          return (
                            <line
                              x1="70"
                              y1="70"
                              x2={70 + 44 * Math.cos(rad)}
                              y2={70 + 44 * Math.sin(rad)}
                              stroke="#f59e0b"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                          );
                        })()}
                        <circle cx="70" cy="70" r="6" fill="#f4f4f5" />
                        <text x="70" y="98" textAnchor="middle" fill="#f59e0b" fontSize="16" fontWeight="bold">
                          {Math.round(ftitDeg)}°C
                        </text>
                        <text x="70" y="110" textAnchor="middle" fill="#71717a" fontSize="8">FTIT</text>
                      </svg>
                    </div>
                    <div className="text-[11px] text-center text-emerald-400 font-bold mt-2">
                      CORE: {Math.round(tachRpm)}% RPM // IDLE STABILIZED
                    </div>
                  </div>
                </div>

                {/* Substep 2-5 Proceed to Step 03 */}
                {currentSubstepIndex === 4 && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Light-Off Successful • Core 65% RPM • FTIT 550°C</div>
                      <div className="text-[11px] text-zinc-400">JFS RUN light extinguished. Hydraulic systems pressurized.</div>
                    </div>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceStep(3);
                      }}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                    >
                      <Check className="w-4 h-4" />
                      <span>ENGINE IDLE STABILIZED — PROCEED TO STEP 03</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENES 03 & 04: SEC CHECK & EXHAUST NOZZLE CLOSURE           */}
        {/* ------------------------------------------------------------ */}
        {(activeStep.id === 3 || activeStep.id === 4) && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  ENG CONT SWITCH (LEFT EYEBROW)
                </span>

                {/* 30s Countdown Display */}
                {activeStep.id === 3 && currentSubstepIndex === 0 && (
                  <div className="p-3 my-2 rounded bg-zinc-950 border border-zinc-800 text-center w-full">
                    <div className="text-xs text-amber-300 font-bold">30s IDLE EQUILIBRATION</div>
                    <div className="text-2xl font-black text-amber-400 my-1">{secTimerRemaining}s</div>
                    <button
                      onClick={() => onAdvanceSubstep(1)}
                      className="mt-1 px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 font-bold border border-zinc-700 cursor-pointer"
                    >
                      SKIP 30s WAIT
                    </button>
                  </div>
                )}

                {/* Switch Physical Render */}
                <div className="flex flex-col items-center my-2">
                  <div className="w-20 h-28 bg-zinc-950 border-2 border-zinc-700 rounded p-2 flex flex-col items-center justify-between relative shadow-inner">
                    <span className="text-[10px] font-bold text-amber-400">SEC</span>
                    <span className="text-[10px] font-bold text-emerald-400">PRI</span>

                    <div
                      onClick={() => {
                        if (activeStep.id === 3 && currentSubstepIndex === 2) {
                          handleToggleEngContToSec();
                        } else if (activeStep.id === 4 && currentSubstepIndex === 1) {
                          handleRevertEngContToPri();
                        }
                      }}
                      className={`absolute w-10 h-10 rounded-full border-2 transition-[top,background-color] duration-200 flex items-center justify-center ${
                        (activeStep.id === 3 && currentSubstepIndex === 2) || (activeStep.id === 4 && currentSubstepIndex === 1)
                          ? 'cursor-pointer hover:border-white'
                          : 'cursor-default'
                      } ${
                        engContMode === 'SEC'
                          ? 'top-2 bg-amber-400 border-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.9)]'
                          : 'bottom-2 bg-emerald-400 border-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full bg-zinc-900" />
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="text-[11px] font-bold mt-1">
                  {engContMode === 'SEC' ? (
                    <span className="text-amber-400">CAUTION: SEC MODE ACTIVE</span>
                  ) : (
                    <span className="text-emerald-400">NORMAL: PRI MODE ACTIVE</span>
                  )}
                </div>
              </div>

              {/* Nozzle Petals Iris */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  EXHAUST NOZZLE PETALS
                </span>

                <div className="relative w-36 h-36 my-2 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-zinc-800 bg-zinc-950" />
                  <div
                    className={`rounded-full border-4 transition-[width,height,border-color,background-color] duration-500 flex items-center justify-center ${
                      nozzlePercent < 15
                        ? 'border-amber-400 bg-amber-500/20'
                        : 'border-cyan-400 bg-cyan-500/10'
                    }`}
                    style={{
                      width: `${Math.max(20, (nozzlePercent / 100) * 120)}px`,
                      height: `${Math.max(20, (nozzlePercent / 100) * 120)}px`,
                    }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow">
                      {Math.round(nozzlePercent)}%
                    </span>
                  </div>
                </div>

                <div className="text-[11px] font-bold text-center">
                  {nozzlePercent < 15 ? (
                    <span className="text-amber-400">NOZZLE CLOSED (&lt; 5%)</span>
                  ) : (
                    <span className="text-cyan-400">NOZZLE OPEN (~100%)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Context Actions for Step 03 */}
            {activeStep.id === 3 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Depress Toe Brakes &amp; Transmit &quot;Clear SEC&quot;</div>
                  <div className="text-[11px] text-zinc-400">
                    Brakes Held: <strong className={areBrakesHeld ? 'text-emerald-400' : 'text-amber-400'}>{areBrakesHeld ? 'YES (PEDALS HELD)' : 'DEPRESS PEDALS'}</strong> • Speak &quot;Clear SEC&quot; into mic
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 3 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Chief Ready: Flip ENG CONT Switch to SEC</div>
                  <div className="text-[11px] text-zinc-400">Lift red guard and switch to SEC. Verify nozzle closes &lt; 5%.</div>
                </div>
                <button
                  onClick={handleToggleEngContToSec}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  FLIP SWITCH TO SEC
                </button>
              </div>
            )}

            {activeStep.id === 3 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Hold Toe Brakes &amp; Spool Engine to ≥ 73% RPM</div>
                  <div className="text-[11px] text-zinc-400">
                    Brakes Held: <strong className={areBrakesHeld ? 'text-emerald-400' : 'text-amber-400'}>{areBrakesHeld ? 'YES' : 'HOLD PEDALS'}</strong>
                  </div>
                </div>
                <button
                  onClick={handleSpoolTo73Rpm}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  SPOOL TO 73% RPM
                </button>
              </div>
            )}

            {activeStep.id === 3 && currentSubstepIndex === 4 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Retard Throttle to IDLE • Confirm Nozzle Remains Closed</div>
                  <div className="text-[11px] text-zinc-400">RPM settles to 65%. Ready for SEC Good callout.</div>
                </div>
                <button
                  onClick={() => {
                    handleRetardToIdleSec();
                    onAdvanceStep(4);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>RETARD TO IDLE &amp; PROCEED TO STEP 04</span>
                </button>
              </div>
            )}

            {/* Context Actions for Step 04 */}
            {activeStep.id === 4 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;SEC Good&quot; to Ground Crew</div>
                  <div className="text-[11px] text-zinc-400">Speak &quot;SEC Good&quot; into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 4 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Chief Acknowledged: Revert Switch to PRI</div>
                  <div className="text-[11px] text-zinc-400">Seat red guard flush down over switch in PRI.</div>
                </div>
                <button
                  onClick={handleRevertEngContToPri}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  REVERT TO PRI &amp; LOWER GUARD
                </button>
              </div>
            )}

            {activeStep.id === 4 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-cyan-300">Observe CENC Motor Driving Nozzle to 100% Open</div>
                  <div className="text-[11px] text-zinc-400">Convergent flaps blooming wide open in primary idle.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(3);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>NOZZLE OPEN CONFIRMED (100%) — PROCEED</span>
                </button>
              </div>
            )}

            {activeStep.id === 4 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Release Toe Brakes</div>
                  <div className="text-[11px] text-zinc-400">Aircraft rests securely on wheel chocks in PRI idle.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceStep(5);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>RELEASE TOE BRAKES — PROCEED TO STEP 05</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENES 05 & 06: EPU GROUND PIN REMOVAL & FLOW CHECK          */}
        {/* ------------------------------------------------------------ */}
        {(activeStep.id === 5 || activeStep.id === 6) && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  LEFT CONSOLE EPU PANEL
                </span>

                <div className="grid grid-cols-2 gap-2 my-2 w-full">
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-[10px] font-bold text-zinc-400">EPU GEN</div>
                    <div className={`text-[9px] font-bold ${epuRunLightLit ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {epuRunLightLit ? 'TEST LIT' : 'DARK'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-center">
                    <div className="text-[10px] font-bold text-zinc-400">EPU PMG</div>
                    <div className={`text-[9px] font-bold ${epuAirLightLit ? 'text-amber-400' : 'text-zinc-600'}`}>
                      {epuAirLightLit ? 'TEST LIT' : 'DARK'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center my-1 w-full">
                  <span className="text-[9px] text-zinc-400 mb-1">EPU SWITCH: {epuSwitch}</span>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => {
                        Sound.playSwitch();
                        setEpuSwitch('OFF');
                        if (activeStep.id === 5 && currentSubstepIndex === 1) onAdvanceSubstep(2);
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-bold border cursor-pointer ${
                        epuSwitch === 'OFF' ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      OFF
                    </button>
                    <button
                      onClick={() => {
                        Sound.playSwitch();
                        setEpuSwitch('NORM');
                        if (activeStep.id === 5 && currentSubstepIndex === 3) onAdvanceStep(6);
                      }}
                      className={`flex-1 py-1.5 rounded text-xs font-bold border cursor-pointer ${
                        epuSwitch === 'NORM' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      NORM
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Forward Strake EPU Port & Pin */}
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  RIGHT FORWARD STRAKE EPU PORT
                </span>

                <div className="relative w-full h-32 my-2 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                  <svg className="w-full h-full" viewBox="0 0 200 100">
                    <path d="M 10 50 Q 100 20 190 50" fill="none" stroke="#3f3f46" strokeWidth="4" />
                    <circle cx="100" cy="50" r="14" fill="#18181b" stroke="#52525b" strokeWidth="2" />
                    {!epuPinRemoved ? (
                      <g>
                        <line x1="100" y1="50" x2="100" y2="85" stroke="#ef4444" strokeWidth="3" />
                        <rect x="85" y="75" width="30" height="8" rx="2" fill="#ef4444" />
                        <text x="100" y="81" textAnchor="middle" fill="#ffffff" fontSize="5" fontWeight="bold">REMOVE</text>
                      </g>
                    ) : (
                      <text x="100" y="53" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold">PIN CLEAR</text>
                    )}
                  </svg>
                </div>

                <div className="text-[10px] text-center text-zinc-400">
                  {epuPinRemoved ? 'Ground Safety Pin Removed' : 'Safety Pin Locked in Strake'}
                </div>
              </div>
            </div>

            {/* Context Actions for Step 05 */}
            {activeStep.id === 5 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Verify Annunciator Dark Verification</div>
                  <div className="text-[11px] text-zinc-400">Confirm EPU GEN and EPU PMG lamps are completely unlit before crew approaches.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>LAMPS CONFIRMED DARK — PROCEED</span>
                </button>
              </div>
            )}

            {activeStep.id === 5 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Set EPU Switch to OFF for Ground Crew Safety</div>
                  <div className="text-[11px] text-zinc-400">Isolates hydrazine catalytic starter valve while ground crew pulls pin.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setEpuSwitch('OFF');
                    Sound.playCommit();
                    onAdvanceSubstep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  FLIP EPU SWITCH TO OFF
                </button>
              </div>
            )}

            {activeStep.id === 5 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Authorize Pin Removal: Speak &quot;Pull EPU Pin&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 5 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Pin Removed: Arm EPU Switch to NORM</div>
                  <div className="text-[11px] text-zinc-400">Arm EPU to NORM and seat mechanical toggle guard.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setEpuSwitch('NORM');
                    Sound.playCommit();
                    onAdvanceStep(6);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  ARM EPU TO NORM &amp; PROCEED TO STEP 06
                </button>
              </div>
            )}

            {/* Context Actions for Step 06 */}
            {activeStep.id === 6 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Pre-Avionics Hydrazine Flow Check: Speak &quot;Check Flow&quot;</div>
                  <div className="text-[11px] text-zinc-400">Chief checks right strake exhaust port for liquid leaks.</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 6 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Chief Confirmed No Flow: Hold Brakes &amp; Spool to 82% RPM</div>
                  <div className="text-[11px] text-zinc-400">Bleed air extraction requires high compressor spool.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setTachRpm(82);
                    Sound.playCommit();
                    onAdvanceSubstep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  HOLD BRAKES &amp; SPOOL TO 82% RPM
                </button>
              </div>
            )}

            {activeStep.id === 6 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Actuate EPU/GEN TEST Switch (5s Hold)</div>
                  <div className="text-[11px] text-zinc-400">Hold button for 5 seconds to observe EPU RUN &amp; AIR lamps.</div>
                </div>
                <button
                  onMouseDown={startEpuTestHold}
                  onMouseUp={cancelEpuTestHold}
                  onMouseLeave={cancelEpuTestHold}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg relative overflow-hidden"
                >
                  <div
                    className="absolute inset-0 bg-emerald-400/40 transition-[width]"
                    style={{ width: `${epuTestHoldProgress}%` }}
                  />
                  <span className="relative z-10">HOLD TEST SWITCH (5 SECONDS)</span>
                </button>
              </div>
            )}

            {activeStep.id === 6 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Retard Throttle to IDLE • Release Brakes</div>
                  <div className="text-[11px] text-zinc-400">RPM returns to 65%. EPU test lamps turn dark.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setTachRpm(65);
                    setEpuRunLightLit(false);
                    setEpuAirLightLit(false);
                    Sound.playCommit();
                    onAdvanceStep(7);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>RETARD TO IDLE &amp; PROCEED TO STEP 07</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 07: FLIGHT CONTROLS CLEAR (CANOPY WINGTIP SWEEP)       */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 7 && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                CANOPY 360° GROUND SAFETY SWEEP
              </span>

              <div className="relative w-full h-40 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 160">
                  <path d="M 200 150 L 50 80 L 100 20 L 200 40 L 300 20 L 350 80 Z" fill="#27272a" stroke="#3f3f46" strokeWidth="2" />
                  <ellipse cx="200" cy="110" rx="90" ry="30" fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" className="animate-pulse" />
                  <text x="200" y="115" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">
                    6-FOOT SAFETY EXCLUSION PERIMETER • CLEAR
                  </text>
                  <circle cx="80" cy="50" r="8" fill="#eab308" />
                  <text x="80" y="70" textAnchor="middle" fill="#eab308" fontSize="8" fontWeight="bold">CHIEF (10 O&apos;CLOCK)</text>
                </svg>
              </div>

              <p className="text-xs text-zinc-300">
                Ground crew verified standing back beyond 6-foot perimeter outside wingtips.
              </p>
            </div>

            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Verify 6-Foot Exclusion Perimeter Clear</div>
                  <div className="text-[11px] text-zinc-400">Confirm wingtips and tail clear of all ground equipment.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>6-FT PERIMETER CLEAR — PROCEED</span>
                </button>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Flight Controls Clear&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {currentSubstepIndex === 2 && (
              <div className="space-y-4">
                <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center space-y-4">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    HYDRAULIC FLUID CIRCULATION &amp; FLCS ACTUATOR WARM-UP
                  </span>

                  {/* Flight Stick & Rudder Live Movement Visualizer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                    {/* Stick Crosshair */}
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col items-center">
                      <span className="text-[10px] font-bold text-zinc-400 mb-2">FLIGHT STICK POSITION</span>
                      <div className="relative w-28 h-28 flex items-center justify-center bg-zinc-900 rounded-full border border-zinc-700">
                        <svg className="w-28 h-28" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="2" />
                          <line x1="50" y1="8" x2="50" y2="92" stroke="#27272a" strokeWidth="1.5" />
                          <line x1="8" y1="50" x2="92" y2="50" stroke="#27272a" strokeWidth="1.5" />
                          <circle
                            cx={50 + (rollDisplay - 0.5) * 60}
                            cy={50 + (pitchDisplay - 0.5) * 60}
                            r="7"
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </div>
                      <span className="text-[10px] text-zinc-400 mt-2 font-mono">
                        R: {Math.round(rollDisplay * 100)}% • P: {Math.round(pitchDisplay * 100)}%
                      </span>
                    </div>

                    {/* Rudder & Hydraulic Status */}
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-zinc-400 block mb-2 text-center">RUDDER &amp; HYDRAULIC STATUS</span>
                        <div className="relative w-full h-6 bg-zinc-900 rounded border border-zinc-700 flex items-center justify-center my-2">
                          <div className="absolute top-0 bottom-0 w-0.5 bg-zinc-500" />
                          <div
                            className="w-4 h-full bg-emerald-500 rounded transition-[left] duration-75"
                            style={{
                              position: 'absolute',
                              left: `calc(${yawDisplay * 100}% - 8px)`
                            }}
                          />
                        </div>
                        <div className="text-[9px] text-zinc-400 text-center font-mono">
                          PEDALS: {yawDisplay < 0.45 ? 'LEFT DEFLECTION' : yawDisplay > 0.55 ? 'RIGHT DEFLECTION' : 'CENTERED (NEUTRAL)'}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400">HYD A/B CIRCULATION:</span>
                        <span className="text-emerald-400 font-bold font-mono">3,000 PSI • NORMAL</span>
                      </div>
                    </div>
                  </div>

                  {/* Warm-Up Progress Bar */}
                  <div className="w-full space-y-1">
                    <div className="flex justify-between text-xs font-mono font-bold">
                      <span className="text-zinc-300">ACTUATOR WARM-UP (15–20 SECONDS FREE WIGGLE)</span>
                      <span className={controlWarmupRemaining === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        {controlWarmupRemaining === 0 ? 'WARM-UP COMPLETE' : `${controlWarmupRemaining}s REMAINING`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${Math.round(((18 - controlWarmupRemaining) / 18) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-zinc-200">
                      {controlWarmupRemaining === 0 ? 'FLCS Servoactuators Exercised & Warmed' : 'Cycle Controls Freely'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {controlWarmupRemaining === 0
                        ? 'Hydraulic valves warm and responsive. Ready to authorize FLCS Built-In Test.'
                        : 'Wiggle flight stick in circular patterns and cycle rudder pedals.'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      onAdvanceStep(8);
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-[background-color] ${
                      controlWarmupRemaining === 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-zinc-950 animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200'
                    }`}
                  >
                    {controlWarmupRemaining === 0 ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>WARMED UP — PROCEED TO FLCS BIT</span>
                      </>
                    ) : (
                      <span>PROCEED TO FLCS BIT ({controlWarmupRemaining}s)</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 08: 15-SECOND FLCS BUILT-IN TEST (BIT)                 */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 8 && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  TEST PANEL • FLCS BIT
                </span>

                <div className="flex flex-col items-center my-2">
                  <button
                    onClick={handleTriggerFlcsBit}
                    disabled={flcsBitActive || currentSubstepIndex !== 1}
                    className={`px-4 py-2 rounded-lg font-bold text-xs tracking-wider transition-[background-color,border-color] border ${
                      currentSubstepIndex === 1 ? 'cursor-pointer' : 'cursor-default'
                    } ${
                      flcsBitActive
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                        : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                    }`}
                  >
                    {flcsBitActive ? 'MAGNETICALLY LATCHED' : 'CLICK TO LATCH BIT'}
                  </button>
                </div>

                <div className="flex gap-4 my-2">
                  <div className="text-center">
                    <div className={`w-4 h-4 rounded-full mx-auto ${flcsBitActive ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-zinc-800'}`} />
                    <span className="text-[9px] text-zinc-400 mt-1 block">RUN</span>
                  </div>
                  <div className="text-center">
                    <div className="w-4 h-4 rounded-full mx-auto bg-zinc-800" />
                    <span className="text-[9px] text-zinc-400 mt-1 block">FAIL</span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400">
                  {flcsBitActive ? `AUTONOMOUS SWEEP: ${flcsBitElapsed}s / 15s` : 'Status: READY FOR BIT'}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  AIRFRAME SURFACE DEFLECTION
                </span>

                <div className="relative w-full h-36 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                  <svg className="w-full h-full" viewBox="0 0 200 120">
                    <polygon points="100,10 115,40 160,80 160,95 110,85 100,110 90,85 40,95 40,80 85,40" fill="#27272a" stroke="#3f3f46" strokeWidth="1.5" />
                    {/* Flaperons (0s - 5s) */}
                    <rect x="42" y="80" width="24" height="6" fill={flcsBitActive && flcsBitElapsed <= 5 ? '#22c55e' : '#3f3f46'} />
                    <rect x="134" y="80" width="24" height="6" fill={flcsBitActive && flcsBitElapsed <= 5 ? '#22c55e' : '#3f3f46'} />
                    {/* Stabilators (5s - 10s) */}
                    <polygon points="80,100 95,100 90,115 75,115" fill={flcsBitActive && flcsBitElapsed > 5 && flcsBitElapsed <= 10 ? '#22c55e' : '#3f3f46'} />
                    <polygon points="120,100 105,100 110,115 125,115" fill={flcsBitActive && flcsBitElapsed > 5 && flcsBitElapsed <= 10 ? '#22c55e' : '#3f3f46'} />
                    {/* Rudder / LEF (10s - 15s) */}
                    <line x1="100" y1="80" x2="100" y2="105" stroke={flcsBitActive && flcsBitElapsed > 10 ? '#22c55e' : '#3f3f46'} strokeWidth="4" />
                  </svg>
                </div>

                <div className="text-[10px] text-center text-emerald-400 font-bold">
                  {flcsBitActive ? (flcsBitElapsed <= 5 ? 'ROLL & DROOP' : flcsBitElapsed <= 10 ? 'PITCH STABS' : 'RUDDER & LEFs') : 'HANDS OFF CONTROLS'}
                </div>
              </div>
            </div>

            {/* Context Actions for Step 08 */}
            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Coordinate FLCS BIT: Speak &quot;Cleared for BIT&quot;</div>
                  <div className="text-[11px] text-zinc-400">Chief coordinates 15s automated surface sweep cycle.</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Latch FLCS BIT Switch</div>
                  <div className="text-[11px] text-zinc-400">Magnetically holds in position and initiates self-test.</div>
                </div>
                <button
                  onClick={handleTriggerFlcsBit}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  CLICK TO LATCH BIT SWITCH
                </button>
              </div>
            )}

            {currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">BIT in Progress • Hands and Feet Off Controls</div>
                  <div className="text-[11px] text-zinc-400">Automated surface deflection cycle in progress ({flcsBitElapsed}s / 15s).</div>
                </div>
                <button
                  onClick={() => onAdvanceSubstep(3)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 cursor-pointer"
                >
                  ACCELERATE BIT
                </button>
              </div>
            )}

            {currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Switch Unlatched to OFF • Amber FAIL Lamp Dark</div>
                  <div className="text-[11px] text-zinc-400">All 4 digital FLCS branches verified operational.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceStep(9);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>BIT PASSED — PROCEED TO STEP 09</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENES 09 TO 11: MANUAL TRIMS & DISC CHECK                   */}
        {/* ------------------------------------------------------------ */}
        {(activeStep.id === 9 || activeStep.id === 10 || activeStep.id === 11) && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                MANUAL TRIM CONSOLE • 3-AXIS INDICATORS
              </span>

              <div className="grid grid-cols-3 gap-3 w-full">
                {[
                  { label: 'ROLL TRIM', val: rollTrim, dial: 'roll' as const },
                  { label: 'PITCH TRIM', val: pitchTrim, dial: 'pitch' as const },
                  { label: 'YAW TRIM', val: yawTrim, dial: 'yaw' as const },
                ].map(({ label, val, dial }) => (
                  <div
                    key={label}
                    onClick={() => handleCenterTrimDial(dial)}
                    className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 flex flex-col items-center cursor-pointer hover:border-emerald-500/60 transition-[border-color]"
                    title="Click to center needle to zero"
                  >
                    <span className="text-[9px] font-bold text-zinc-400">{label}</span>
                    <svg className="w-16 h-16 my-1" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                      <line x1="40" y1="8" x2="40" y2="16" stroke="#ffffff" strokeWidth="2" />
                      {(() => {
                        const deg = (val / 10) * 90;
                        const rad = ((deg - 90) * Math.PI) / 180;
                        return (
                          <line
                            x1="40"
                            y1="40"
                            x2={40 + 24 * Math.cos(rad)}
                            y2={40 + 24 * Math.sin(rad)}
                            stroke={val === 0 ? '#10b981' : '#f59e0b'}
                            strokeWidth="2"
                          />
                        );
                      })()}
                      <circle cx="40" cy="40" r="3" fill="#e4e4e7" />
                    </svg>
                    <span className={`text-[10px] font-bold ${val === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {val === 0 ? '0 (NEUTRAL)' : `${val > 0 ? '+' : ''}${val}° OFF`}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-400 text-center">
                {activeStep.id === 11 && currentSubstepIndex === 3
                  ? 'CLICK EACH DIAL TO CENTER NEEDLES TO ZERO INDEX'
                  : 'Confirm all trim indices align with white centerline.'}
              </p>
            </div>

            {/* Context Actions for Step 09 */}
            {activeStep.id === 9 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Verify Baseline Trims at Zero</div>
                  <div className="text-[11px] text-zinc-400">Confirm all three pointers align vertically with center zero index.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>TRIMS AT ZERO — PROCEED</span>
                </button>
              </div>
            )}

            {activeStep.id === 9 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Ready Trim&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak &quot;Ready Trim&quot; into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {/* Context Actions for Step 10 */}
            {activeStep.id === 10 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Select TRIM/AP DISC Switch to DISC</div>
                  <div className="text-[11px] text-zinc-400">Electrically isolates stick trim hat from control surfaces.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setTrimDiscSwitch('DISC');
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  SET SWITCH TO DISC
                </button>
              </div>
            )}

            {activeStep.id === 10 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Trim Disconnected&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 10 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Actuate 4-Way Stick Trim Hat • Verify Zero Movement</div>
                  <div className="text-[11px] text-zinc-400">Trim dials remain completely stationary at zero.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceStep(11);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>ZERO MOVEMENT VERIFIED — PROCEED TO STEP 11</span>
                </button>
              </div>
            )}

            {/* Context Actions for Step 11 */}
            {activeStep.id === 11 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Return TRIM/AP Switch to NORM</div>
                  <div className="text-[11px] text-zinc-400">Re-connects trim drive motor circuits.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setTrimDiscSwitch('NORM');
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  RETURN SWITCH TO NORM
                </button>
              </div>
            )}

            {activeStep.id === 11 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Trim Connected&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 11 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Chief Calling Out 6 Deflections</div>
                  <div className="text-[11px] text-zinc-400">Nose Up, Nose Down, Roll Left, Roll Right, Yaw Left, Yaw Right.</div>
                </div>
                <button
                  onClick={() => onAdvanceSubstep(3)}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 cursor-pointer"
                >
                  PROCEED TO RE-CENTERING
                </button>
              </div>
            )}

            {activeStep.id === 11 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Center All Three Trim Dials to Zero</div>
                  <div className="text-[11px] text-zinc-400">Click each dial above until all needles align at 0.</div>
                </div>
                <button
                  onClick={() => {
                    setRollTrim(0);
                    setPitchTrim(0);
                    setYawTrim(0);
                    Sound.playCommit();
                    onAdvanceStep(12);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>CENTER TRIMS &amp; PROCEED TO STEP 12</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENES 12 & 13: BIG MOVEMENTS, MPO KICK & DBU CHECK          */}
        {/* ------------------------------------------------------------ */}
        {(activeStep.id === 12 || activeStep.id === 13) && (
          <div className="w-full max-w-2xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  FLIGHT STICK &amp; MPO SWITCH
                </span>

                <div className="relative w-full h-32 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                  <svg className="w-32 h-32" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                    <line x1="50" y1="10" x2="50" y2="90" stroke="#27272a" strokeWidth="1.5" />
                    <line x1="10" y1="50" x2="90" y2="50" stroke="#27272a" strokeWidth="1.5" />
                    {/* Crosshair correctly moves left-on-left, right-on-right */}
                    <circle
                      cx={50 + (rollDisplay - 0.5) * 60}
                      cy={50 + (pitchDisplay - 0.5) * 60}
                      r="8"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>

                <div className="flex flex-col items-center gap-1 mt-2 w-full">
                  <div className="text-[10px] text-zinc-400">
                    Stick: Roll {Math.round(rollDisplay * 100)}% • Pitch {Math.round(pitchDisplay * 100)}%
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded text-xs font-bold border w-full text-center select-none ${
                      isMpoActive
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                    }`}
                  >
                    MPO SWITCH (HARDWARE): {isMpoActive ? 'OVRD (KICK DETECTED)' : 'NORM'}
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">
                  SPEEDBRAKE CLAMSHELL PETALS
                </span>

                <div className="relative w-full h-32 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                  <svg className="w-full h-full" viewBox="0 0 160 100">
                    <rect x="30" y="45" width="100" height="10" fill="#3f3f46" rx="2" />
                    <line
                      x1="110"
                      y1="45"
                      x2={110 + 25 * Math.cos(((speedbrakesOpen ? -60 : 0) * Math.PI) / 180)}
                      y2={45 + 25 * Math.sin(((speedbrakesOpen ? -60 : 0) * Math.PI) / 180)}
                      stroke="#22c55e"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <line
                      x1="110"
                      y1="55"
                      x2={110 + 25 * Math.cos(((speedbrakesOpen ? 60 : 0) * Math.PI) / 180)}
                      y2={55 + 25 * Math.sin(((speedbrakesOpen ? 60 : 0) * Math.PI) / 180)}
                      stroke="#22c55e"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="flex flex-col items-center gap-1 mt-2 w-full">
                  {currentSubstepIndex === 5 ? (
                    <button
                      onClick={handleToggleSpeedbrakes}
                      className={`px-3 py-1.5 rounded text-xs font-bold border transition-[background-color] cursor-pointer w-full text-center ${
                        speedbrakesOpen
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                          : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      SPEEDBRAKES: {speedbrakesOpen ? 'DEPLOYED (60°) • CLICK TO CLOSE' : 'CLOSED (FLUSH) • CLICK TO OPEN'}
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded text-xs font-bold border border-zinc-800 bg-zinc-950 text-zinc-500 w-full text-center select-none cursor-not-allowed">
                      SPEEDBRAKES: CLOSED (LOCKED UNTIL SUBSTEP 12-6)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Context Actions for Step 12 */}
            {activeStep.id === 12 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Clear Big Movements&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak &quot;Clear Big Movements&quot; into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 12 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">
                    Roll Axis Check (~10-15% Deflection)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Deflect stick left or right ~10-15% to satisfy check automatically.
                  </div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer shadow-lg"
                >
                  PROCEED TO PITCH CHECK
                </button>
              </div>
            )}

            {activeStep.id === 12 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">
                    Pitch Axis Check (~10-15% Deflection)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Move stick forward (Nose Down) or aft (Nose Up) ~10-15%. Hold forward for MPO test.
                  </div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(3);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer shadow-lg"
                >
                  PROCEED TO MPO KICK
                </button>
              </div>
            )}

            {activeStep.id === 12 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">
                    MPO Kick Test (While Holding Nose Down)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Actuate physical MPO switch on throttle/HOTAS to trigger +8° stabilator kick.
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 border select-none ${
                      isMpoActive
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${isMpoActive ? 'bg-amber-400 animate-ping' : 'bg-zinc-700'}`} />
                    <span>{isMpoActive ? 'MPO KICK DETECTED' : 'AWAITING PHYSICAL MPO SWITCH'}</span>
                  </div>
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      onAdvanceSubstep(4);
                    }}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold text-xs cursor-pointer shadow-lg"
                  >
                    PROCEED TO RUDDER CHECK
                  </button>
                </div>
              </div>
            )}

            {activeStep.id === 12 && currentSubstepIndex === 4 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">
                    Yaw Axis Check (~10-15% Deflection)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Push rudder pedal left or right ~10-15% to satisfy check automatically.
                  </div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(5);
                  }}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer shadow-lg"
                >
                  PROCEED TO SPEEDBRAKES
                </button>
              </div>
            )}

            {activeStep.id === 12 && currentSubstepIndex === 5 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-emerald-400">Cycle Speedbrakes (Open 60° then Close Flush)</div>
                    <div className="text-[11px] text-zinc-400">Click switch above to OPEN, then click again to CLOSE flush to clear step.</div>
                  </div>
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      onAdvanceStep(13);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Check className="w-4 h-4" />
                    <span>COMPLETE SPEEDBRAKES • STEP 13</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-400">
                  <strong className="text-amber-400">NOTE:</strong> In BMS/FVX script testing, speedbrake audio calls may cycle automatically. Click switch to open (60°) then close to complete check.
                </div>
              </div>
            )}

            {/* Context Actions for Step 13 */}
            {activeStep.id === 13 && currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;DBU Still Clear&quot;</div>
                  <div className="text-[11px] text-zinc-400">Request clearance for Digital Backup software flight law check.</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {activeStep.id === 13 && currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-300">Lift Red Guard &amp; Flip DBU Switch to ON</div>
                  <div className="text-[11px] text-zinc-400">Yellow DBU ON caution lamp illuminates on left eyebrow.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setDbuSwitchOn(true);
                    Sound.playCommit();
                    onAdvanceSubstep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  SET DBU SWITCH TO ON
                </button>
              </div>
            )}

            {activeStep.id === 13 && currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Deflect Controls Under Backup DBU Law</div>
                  <div className="text-[11px] text-zinc-400">Surfaces respond with simplified feedback. Chief acknowledges.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(3);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>DBU RESPONSE CONFIRMED — NEXT</span>
                </button>
              </div>
            )}

            {activeStep.id === 13 && currentSubstepIndex === 3 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Revert DBU Switch to OFF &amp; Seat Guard Down</div>
                  <div className="text-[11px] text-zinc-400">Yellow DBU ON caution lamp turns off.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setDbuSwitchOn(false);
                    Sound.playCommit();
                    onAdvanceStep(14);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>GUARD DBU IN OFF &amp; PROCEED TO STEP 14</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENES 14 & 15: LEFT & RIGHT BRAKE TESTS                     */}
        {/* ------------------------------------------------------------ */}
        {(activeStep.id === 14 || activeStep.id === 15) && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                {activeStep.id === 14 ? 'LEFT MAIN GEAR' : 'RIGHT MAIN GEAR'} BRAKE CALIPER
              </span>

              <div className="relative w-full h-36 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                <svg className="w-40 h-40" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="#18181b" stroke="#3f3f46" strokeWidth="6" />
                  <circle cx="60" cy="60" r="30" fill="#09090b" stroke="#27272a" strokeWidth="2" />
                  <rect
                    x="75"
                    y="45"
                    width="20"
                    height="30"
                    rx="3"
                    fill={activeStep.id === 14 ? (leftBrakeDeflection >= 0.15 ? '#22c55e' : '#52525b') : (rightBrakeDeflection >= 0.15 ? '#22c55e' : '#52525b')}
                  />
                </svg>
              </div>

              <div className="w-full flex flex-col items-center gap-2">
                <div className="w-full flex items-center justify-between text-[11px] text-zinc-400 px-4">
                  <span>Pedal Deflection:</span>
                  <span className="font-bold text-emerald-400">
                    {activeStep.id === 14 ? Math.round(leftBrakeDeflection * 100) : Math.round(rightBrakeDeflection * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-950 border border-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-100"
                    style={{ width: `${(activeStep.id === 14 ? leftBrakeDeflection : rightBrakeDeflection) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">
                    Transmit &quot;{activeStep.id === 14 ? 'Ready Left Brake' : 'Ready Right Brake'}&quot;
                  </div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">
                    Depress {activeStep.id === 14 ? 'Left' : 'Right'} Toe Brake (3s Hold)
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Pedal Hold: <strong className="text-amber-400">{brakeHoldTimer}s / 3s</strong> • Depress physical pedal firmly or click skip.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      onAdvanceSubstep(2);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                  >
                    SIMULATE 3s HOLD
                  </button>
                  <button
                    onClick={() => onAdvanceSubstep(2)}
                    className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold text-xs cursor-pointer border border-zinc-700"
                  >
                    SKIP AXIS
                  </button>
                </div>
              </div>
            )}

            {currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">
                    {activeStep.id === 14 ? 'Left' : 'Right'} Brake Caliper Clamping Verified Good
                  </div>
                  <div className="text-[11px] text-zinc-400">Zero fluid leaks. Pucks compressed tight on carbon rotor.</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceStep(activeStep.id + 1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>BRAKE GOOD — PROCEED TO STEP {activeStep.id === 14 ? '15' : '16'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 16: AIR REFUELING (AAR) SLIPWAY DOOR                   */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 16 && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                DORSAL RECEPTACLE SLIPWAY DOOR &amp; RDY LIGHT
              </span>

              <div className="relative w-full h-36 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                <svg className="w-full h-full" viewBox="0 0 240 100">
                  <rect x="40" y="30" width="160" height="40" rx="4" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
                  <rect
                    x={aarSwitch === 'OPEN' ? 140 : 45}
                    y="34"
                    width="50"
                    height="32"
                    rx="2"
                    fill="#52525b"
                    stroke="#71717a"
                    strokeWidth="1.5"
                    style={{ transition: 'x 0.6s ease-in-out' }}
                  />
                  <circle cx="120" cy="50" r="10" fill="#09090b" />
                </svg>
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-3 py-1.5 rounded border text-xs font-bold ${aarSwitch === 'OPEN' ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                  AR / NWS RDY • {aarSwitch === 'OPEN' ? 'LIT' : 'DARK'}
                </div>
              </div>
            </div>

            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Ready AAR Door&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-cyan-300">Move AIR REFUEL Switch to OPEN</div>
                  <div className="text-[11px] text-zinc-400">Blue RDY light illuminates. Dorsal door slides open. Chief calls &quot;Door open.&quot;</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setAarSwitch('OPEN');
                    Sound.playCommit();
                    onAdvanceSubstep(2);
                  }}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-xs cursor-pointer shadow-lg"
                >
                  FLIP SWITCH TO OPEN
                </button>
              </div>
            )}

            {currentSubstepIndex === 2 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-emerald-400">Move AIR REFUEL Switch to CLOSE</div>
                  <div className="text-[11px] text-zinc-400">Blue RDY light turns off. Door seals flush. Chief calls &quot;Door closed.&quot;</div>
                </div>
                <button
                  onClick={() => {
                    Sound.playSwitch();
                    setAarSwitch('CLOSE');
                    Sound.playCommit();
                    onAdvanceStep(17);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>CLOSE SWITCH &amp; PROCEED TO STEP 17</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 17: WHEEL CHOCKS REMOVAL                               */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 17 && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center space-y-4">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                MAIN GEAR CHOCKS • RAMP CLEARANCE
              </span>

              <div className="relative w-full h-36 flex items-center justify-center bg-zinc-950 rounded-lg border border-zinc-800">
                <svg className="w-48 h-32" viewBox="0 0 160 100">
                  <circle cx="80" cy="50" r="35" fill="#18181b" stroke="#3f3f46" strokeWidth="6" />
                  {chocksInPlace ? (
                    <g>
                      <polygon points="35,80 50,80 42,60" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
                      <polygon points="125,80 110,80 118,60" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />
                    </g>
                  ) : (
                    <text x="80" y="55" textAnchor="middle" fill="#10b981" fontSize="9" fontWeight="bold">CHOCKS AWAY</text>
                  )}
                </svg>
              </div>

              <p className="text-xs text-zinc-300 text-center">
                Hold toe brakes firmly. Removing chocks does NOT disconnect Chief. Chief remains on interphone.
              </p>
            </div>

            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Hold Toe Brakes Firmly</div>
                  <div className="text-[11px] text-zinc-400">
                    Brakes Held: <strong className={areBrakesHeld ? 'text-emerald-400' : 'text-amber-400'}>{areBrakesHeld ? 'YES (PEDALS HELD)' : 'DEPRESS PEDALS'}</strong>
                  </div>
                </div>
                <button
                  onClick={() => {
                    Sound.playCommit();
                    onAdvanceSubstep(1);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Check className="w-4 h-4" />
                  <span>BRAKES HELD FIRMLY — PROCEED</span>
                </button>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Remove Chocks&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* SCENE 18: CLEARED OFF & 10 O'CLOCK MARSHAL SALUTE            */}
        {/* ------------------------------------------------------------ */}
        {activeStep.id === 18 && (
          <div className="w-full max-w-xl mx-auto space-y-4">
            <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center space-y-4">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-400" />
                MISSION READINESS COMPLETE • 10 O&apos;CLOCK MARSHAL
              </span>

              <div className="relative w-full h-44 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 300 140">
                  <rect x="0" y="0" width="300" height="140" fill="#09090b" />
                  <circle cx="150" cy="45" r="12" fill="#eab308" />
                  <line x1="150" y1="57" x2="150" y2="105" stroke="#eab308" strokeWidth="8" strokeLinecap="round" />
                  <line x1="150" y1="70" x2="175" y2="50" stroke="#eab308" strokeWidth="5" strokeLinecap="round" />
                  <line x1="150" y1="75" x2="125" y2="95" stroke="#eab308" strokeWidth="5" strokeLinecap="round" />
                  <text x="150" y="125" textAnchor="middle" fill="#10b981" fontSize="10" fontWeight="bold">
                    CREW CHIEF RENDERING SHARP HAND SALUTE
                  </text>
                </svg>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 text-xs font-bold leading-relaxed">
                &quot;Copy that, bring her back Code 1, sir.&quot; • Headset disconnected. Cleared for taxi!
              </div>
            </div>

            {currentSubstepIndex === 0 && (
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Transmit &quot;Cleared Off&quot;</div>
                  <div className="text-[11px] text-zinc-400">Speak into your microphone</div>
                </div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <Mic className="w-4 h-4 animate-pulse" />
                  <span>HOT-MIC ACTIVE</span>
                </div>
              </div>
            )}

            {currentSubstepIndex === 1 && (
              <div className="w-full">
                {finaleSaluteActive ? (
                  <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/80 text-center text-emerald-300 font-bold text-xs animate-pulse">
                    🫡 SALUTE RETURNED • RETURNING TO COMMS STATION...
                  </div>
                ) : (
                  <button
                    onClick={handleTriggerFinale}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-sm tracking-wider cursor-pointer shadow-2xl flex items-center justify-center gap-2 transition-[background-color]"
                  >
                    <Award className="w-5 h-5" />
                    <span>RETURN SALUTE • COMPLETE DRILL PASS</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. DIRECTIVE & COMMS NARRATIVE CARD                            */}
      {/* ============================================================== */}
      <div className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
            ▶ PROCEDURAL DIRECTIVE:
          </span>
          <p className="font-bold text-zinc-200 leading-snug">
            {activeSubstep?.description || activeStep.whatToPerformNow}
          </p>
        </div>

        {/* ONLY display spoken callout when the active substep is actively VERBAL */}
        {activeSubstep?.phaseType === 'VERBAL' ? (
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block mb-1">
              🎙️ SPOKEN CALLOUT REQUIRED:
            </span>
            <p className="font-black text-emerald-300 text-sm">
              &quot;{activeStep.pilotSpokenCalls.primary}&quot;
            </p>
            <span className="text-[9px] text-zinc-500 mt-0.5 block truncate">
              Accepted: {activeStep.pilotSpokenCalls.synonyms.slice(0, 2).join(', ') || 'Exact phrase'}
            </span>
          </div>
        ) : activeSubstep?.phaseType === 'ACTION' ? (
          <div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
              ⚡ COCKPIT ACTION REQUIRED:
            </span>
            <p className="font-black text-cyan-200 text-xs">
              {activeSubstep?.interactiveControl?.actionPrompt || activeSubstep?.label || 'Actuate cockpit control'}
            </p>
            <span className="text-[9px] text-zinc-500 mt-0.5 block">
              Direct physical click or switch throw
            </span>
          </div>
        ) : (
          <div>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
              👁️ OBSERVE &amp; VERIFY:
            </span>
            <p className="font-bold text-amber-200 text-xs">
              {activeSubstep?.visualCue || 'Observe cockpit instrument response'}
            </p>
          </div>
        )}

        {/* Right column: only show RX when speaking or in verbal phases */}
        {isChiefResponding || activeSubstep?.phaseType === 'VERBAL' ? (
          <div className={isChiefResponding ? 'animate-pulse' : ''}>
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
              🎧 CREW CHIEF (RX):
            </span>
            <p className="text-amber-200 italic font-medium">
              &quot;{chiefDialogue || activeStep.expectedChiefResponse}&quot;
            </p>
          </div>
        ) : (
          <div>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
              💡 PROCEDURAL RATIONALE:
            </span>
            <p className="text-zinc-400 text-[11px] leading-snug">
              {activeStep.whatToExpectNext}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
