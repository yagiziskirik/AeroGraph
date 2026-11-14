'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Check,
  AlertTriangle,
  Mic,
  Headphones,
  ChevronRight,
} from 'lucide-react';
import { Sound } from '../../services/sound';
import { Ipc } from '../../services/ipc';
import { TelemetryData } from '../../types/ipc';
import { RampStartStep, StepSubstep } from '../../services/voiceTrainingData';
import { getCockpitLocatorConfig } from './cockpitLocatorConfig';
import {
  TacticalDisplayCard,
  TacticalFlirOverlay,
  CockpitLocatorOverlay,
  ElecPowerPanel,
  TestPanel,
  EngJetStartPanel,
  RpmIndicator,
  FtitIndicator,
  HydPressPanel,
  NozPosIndicator,
  EpuPanel,
  ThrottleQuadrant,
  FltControlPanel,
  ManualTrimPanel,
  ManualPitchPanel,
  SpeedBrakeIndicator,
  FuelPanel,
  MainPwrPosition,
  ElecPanelLights,
  TestPanelSwitches,
  FlcsPwrLights,
  JfsSwitchPosition,
  EngContSwitchPosition,
  EpuSwitchPosition,
  ThrottleDetent,
  THROTTLE_DETENTS,
} from '../../components/cockpit';

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

  // Step 1 Substep 3 (or 2): Comms Check
  if (stepId === 1 && (substepOrder === 2 || substepOrder === 3)) {
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

  // Step 8 Substep 1: Clear BIT
  if (stepId === 8 && substepOrder === 1) {
    const valid = [
      'CLEAR BIT', 'CLEARED FOR BIT', 'READY FOR BIT', 'CLEAR FOR FLCS BIT',
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

  // Clear sticky Chief dialogue and response state when advancing steps or substeps
  useEffect(() => {
    setChiefDialogue('');
    setIsChiefResponding(false);
  }, [activeStep.id, currentSubstepIndex]);

  // Manage Cockpit Drill Mode: Step 0 begins in default profile with Chief disengaged so "Engage Chief" is detectable.
  // Silent drill mode and Chief mode are engaged upon speaking "Engage Chief" or when entering Step >= 1.
  useEffect(() => {
    if (activeStep.id === 0) {
      Ipc.setCockpitDrillActive(false);
      Ipc.resetCrewChief();
    } else {
      Ipc.engageCrewChief();
      Ipc.setCockpitDrillActive(true);
    }
    return () => {
      Ipc.setCockpitDrillActive(false);
    };
  }, [activeStep.id]);

  // Step 01: ELEC Panel & TEST Panel
  const [elecSwitchPos, setElecSwitchPos] = useState<MainPwrPosition>('OFF');
  const [flcsPwrTestPos, setFlcsPwrTestPos] = useState<'MAINT' | 'NORM' | 'TEST'>('NORM');
  const [isFlcsPwrTestHeld, setIsFlcsPwrTestHeld] = useState(false);
  const [flcsPwrTestPassed, setFlcsPwrTestPassed] = useState(false);
  const [flcsPwrTestTriggered, setFlcsPwrTestTriggered] = useState(false);

  // Step 02: JFS & Engine Spool & Throttle Detent & Hyd
  const [jfsPosition, setJfsPosition] = useState<JfsSwitchPosition>('OFF');
  const [jfsRunLit, setJfsRunLit] = useState(false);
  const [tachRpm, setTachRpm] = useState(0);
  const [ftitDeg, setFtitDeg] = useState(100);
  const [throttlePosition, setThrottlePosition] = useState<ThrottleDetent>('CUTOFF');
  const [hydPressA, setHydPressA] = useState(0);
  const [hydPressB, setHydPressB] = useState(0);
  const [step2EngineStabilized, setStep2EngineStabilized] = useState(false);

  // Step 03 & 04: SEC Check, NozPos & FLIR
  const [secTimerRemaining, setSecTimerRemaining] = useState(30);
  const [engContPosition, setEngContPosition] = useState<EngContSwitchPosition>('PRI');
  const [nozPosPercent, setNozPosPercent] = useState(96);
  const [step3FlirOpen, setStep3FlirOpen] = useState(false);
  const [step3FlirSrc, setStep3FlirSrc] = useState('/crewchief/FLCS/nozzleOpen.webp');
  const [step4ThrottleAngle, setStep4ThrottleAngle] = useState(THROTTLE_DETENTS['IDLE'].angle);
  const [step6ThrottleAngle, setStep6ThrottleAngle] = useState(THROTTLE_DETENTS['IDLE'].angle);

  // Step 05 & 06: EPU & EPU/GEN Test
  const [epuSwitch, setEpuSwitch] = useState<EpuSwitchPosition>('NORM');
  const [epuPinRemoved, setEpuPinRemoved] = useState(false);
  const [epuRunLightLit, setEpuRunLightLit] = useState(false);
  const [epuAirLightLit, setEpuAirLightLit] = useState(false);
  const [epuGenSwitchHeld, setEpuGenSwitchHeld] = useState(false);
  const [epuTestHoldProgress, setEpuTestHoldProgress] = useState(0);
  const [epuWarningLampsLit, setEpuWarningLampsLit] = useState(false);

  // Step 07: 6ft Exclusion Area & Control Warm-Up
  const [step7CardVisible, setStep7CardVisible] = useState(true);
  const [controlWarmupRemaining, setControlWarmupRemaining] = useState(20);

  // Step 08: FLCS BIT (15s video in FLIR)
  const [flcsBitSwitch, setFlcsBitSwitch] = useState(false);
  const [flcsBitActive, setFlcsBitActive] = useState(false);
  const [flcsBitElapsed, setFlcsBitElapsed] = useState(0);

  // Step 09-11: Manual Trim System
  const [trimDiscSwitch, setTrimDiscSwitch] = useState(true); // true = NORM, false = DISC
  const [rollTrim, setRollTrim] = useState(0.0);
  const [pitchTrim, setPitchTrim] = useState(0.0);
  const [yawTrim, setYawTrim] = useState(0.0);
  const hasAdvancedStep11Ref = useRef(false);

  // Step 12 & 13: Big Movements, MPO Kick & Speedbrakes & DBU
  const [speedbrakesOpen, setSpeedbrakesOpen] = useState(false);
  const [speedbrakeCycleDone, setSpeedbrakeCycleDone] = useState(false);
  const [mpoKickActive, setMpoKickActive] = useState(false);
  const [dbuSwitchOn, setDbuSwitchOn] = useState(false);
  const [rollLeftDone, setRollLeftDone] = useState(false);
  const [rollRightDone, setRollRightDone] = useState(false);
  const [pitchNoseUpDone, setPitchNoseUpDone] = useState(false);
  const [pitchNoseDownDone, setPitchNoseDownDone] = useState(false);
  const [yawLeftDone, setYawLeftDone] = useState(false);
  const [yawRightDone, setYawRightDone] = useState(false);
  const hasAdvancedStep12SubstepRef = useRef(false);

  // Step 14 & 15: Brakes (Physical Axis Integration)
  const [brakeHoldTimer, setBrakeHoldTimer] = useState(0);

  // Step 16: Fuel Panel / AAR Door
  const [airRefuelDoorPos, setAirRefuelDoorPos] = useState<'CLOSE' | 'OPEN'>('CLOSE');

  // Step 17: Chocks Removal
  const [chocksInPlace, setChocksInPlace] = useState(true);

  // Step 18: Finale Salute
  const [finaleSaluteActive, setFinaleSaluteActive] = useState(false);

  // Sync chief engaged state
  useEffect(() => {
    if (chiefEngaged) setInterphoneConnected(true);
  }, [chiefEngaged]);

  // Reset Step 12 speedbrake cycle and axis detection states when leaving Step 12
  useEffect(() => {
    if (activeStep.id !== 12) {
      setSpeedbrakeCycleDone(false);
      setSpeedbrakesOpen(false);
      setRollLeftDone(false);
      setRollRightDone(false);
      setPitchNoseUpDone(false);
      setPitchNoseDownDone(false);
      setYawLeftDone(false);
      setYawRightDone(false);
      hasAdvancedStep12SubstepRef.current = false;
    } else {
      hasAdvancedStep12SubstepRef.current = false;
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Reset Step 16 AAR door switch position when leaving Step 16 or entering Step 16 substep 0
  useEffect(() => {
    if (activeStep.id !== 16 || currentSubstepIndex === 0) {
      setAirRefuelDoorPos('CLOSE');
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Reset Step 17 chocks state when entering Step 17
  useEffect(() => {
    if (activeStep.id === 17 && currentSubstepIndex === 0) {
      setChocksInPlace(true);
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Reset Step 02 JFS switch position when leaving Step 02 or entering Step 02 substep 0
  useEffect(() => {
    if (activeStep.id !== 2 || currentSubstepIndex === 0) {
      setJfsPosition('OFF');
      engineSpoolingRef.current = false;
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Reset Step 05 EPU switch position when leaving Step 05 or entering Step 05 substep 0
  useEffect(() => {
    if ((activeStep.id !== 5 && activeStep.id !== 6) || (activeStep.id === 5 && currentSubstepIndex === 0)) {
      setEpuSwitch('NORM');
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Dynamic Mistake Warning & Rollback Safety Mechanism
  const [mistakeWarning, setMistakeWarning] = useState<{
    type: 'warning' | 'danger';
    title: string;
    message: string;
  } | null>(null);
  const [isMistakeRollingBack, setIsMistakeRollingBack] = useState(false);
  const mistakeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearMistakeRollback = useCallback(() => {
    if (mistakeTimeoutRef.current) {
      clearTimeout(mistakeTimeoutRef.current);
      mistakeTimeoutRef.current = null;
    }
    setIsMistakeRollingBack(false);
  }, []);

  const clearMistakeWarning = useCallback(() => {
    setMistakeWarning(null);
    if (warningDismissTimeoutRef.current) {
      clearTimeout(warningDismissTimeoutRef.current);
      warningDismissTimeoutRef.current = null;
    }
  }, []);

  const triggerMistakeWarning = useCallback(
    (warning: { type: 'warning' | 'danger'; title: string; message: string }) => {
      if (warningDismissTimeoutRef.current) {
        clearTimeout(warningDismissTimeoutRef.current);
      }
      setMistakeWarning(warning);
      // Auto-dismiss after 9 seconds
      warningDismissTimeoutRef.current = setTimeout(() => {
        setMistakeWarning(null);
        warningDismissTimeoutRef.current = null;
      }, 9000);
    },
    []
  );

  // Clear mistake timeouts & state on step or substep change
  useEffect(() => {
    clearMistakeWarning();
    clearMistakeRollback();
  }, [activeStep.id, currentSubstepIndex, clearMistakeWarning, clearMistakeRollback]);

  // Clean up timeouts on component unmount
  useEffect(() => {
    return () => {
      clearMistakeWarning();
      clearMistakeRollback();
    };
  }, [clearMistakeWarning, clearMistakeRollback]);

  // =========================================================================
  // HARDWARE AXES TELEMETRY ALIGNMENT
  // =========================================================================
  const rawLeftBrake = telemetry.left_brake !== undefined ? telemetry.left_brake : 0.0;
  const rawRightBrake = telemetry.right_brake !== undefined ? telemetry.right_brake : 0.0;
  const rawPitch = telemetry.pitch_axis !== undefined ? telemetry.pitch_axis : 0.5;
  const rawRoll = telemetry.roll_axis !== undefined ? telemetry.roll_axis : 0.5;
  const rawYaw = telemetry.yaw_axis !== undefined ? telemetry.yaw_axis : 0.5;

  const rollDisplay = 1.0 - rawRoll;
  const pitchDisplay = 1.0 - rawPitch;
  const yawDisplay = 1.0 - rawYaw;

  const leftBrakeDeflection = invertBrakes ? 1.0 - rawLeftBrake : rawLeftBrake;
  const rightBrakeDeflection = invertBrakes ? 1.0 - rawRightBrake : rawRightBrake;

  // =========================================================================
  // SPEECH PROCESSING & AUTOMATIC DRILL ADVANCE
  // =========================================================================
  const lastProcessedSpeechIdRef = useRef<number>(0);
  const engineSpoolingRef = useRef<boolean>(false);

  // Step 13 DBU flight control surface audio tracking
  const dbuRollAnnouncedRef = useRef<'left' | 'right' | null>(null);
  const dbuPitchAnnouncedRef = useRef<'up' | 'down' | null>(null);
  const dbuYawAnnouncedRef = useRef<'left' | 'right' | null>(null);

  // Step 14 & 15 Brake pedal movement audio tracking
  const leftBrakeMovedRef = useRef<boolean>(false);
  const leftBrakeIdleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rightBrakeMovedRef = useRef<boolean>(false);
  const rightBrakeIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerVerbalAdvance = useCallback((expectedDialogue: string) => {
    Sound.playCommit();
    onConsumeSpeech();

    if (activeStep.id === 0) {
      onEngageChief();
      setInterphoneConnected(true);
      Ipc.engageCrewChief();
      Ipc.setCockpitDrillActive(true);
    }

    setIsChiefResponding(true);
    setChiefDialogue(expectedDialogue);

    // Step 17 Substep 2: Display chocks-off visual for 2.5s before advancing to Step 18
    if (activeStep.id === 17 && currentSubstepIndex === 1) {
      setChocksInPlace(false);
      setTimeout(() => {
        setIsChiefResponding(false);
        onAdvanceStep(18);
      }, 2500);
      return;
    }

    // Step 05: Pull EPU Pin (Multi-sound: "Copy" -> 4000ms delay -> "Clear for run up")
    if (activeStep.id === 5) {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('epu-runup');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else if (activeStep.id < 18) {
          onAdvanceStep(activeStep.id + 1);
        }
      }, 5800);
      return;
    }

    // Step 10: Trim Disconnected (Multi-sound: "Copy" -> 4000ms observation delay -> "Trim no movement")
    if (activeStep.id === 10) {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('trim-no-movement');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else if (activeStep.id < 18) {
          onAdvanceStep(activeStep.id + 1);
        }
      }, 5800);
      return;
    }

    // Step 14: Ready Left Brake (Multi-sound: "Copy" -> 2500ms walk delay -> "Ready left brake")
    if (activeStep.id === 14) {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('ready-left-brake');
      }, 2500);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else if (activeStep.id < 18) {
          onAdvanceStep(activeStep.id + 1);
        }
      }, 4200);
      return;
    }

    // Step 15: Ready Right Brake (Multi-sound: "Copy" -> 2500ms walk delay -> "Ready right brake")
    if (activeStep.id === 15) {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('ready-right-brake');
      }, 2500);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else if (activeStep.id < 18) {
          onAdvanceStep(activeStep.id + 1);
        }
      }, 4200);
      return;
    }

    // Step 16: Ready AAR Door (Multi-sound: "Copy standby" -> 4000ms walk delay -> "Refuel door check ready")
    if (activeStep.id === 16) {
      Ipc.playDrillSound('copy-standby');
      setTimeout(() => {
        Ipc.playDrillSound('refuel-door-ready');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else if (activeStep.id < 18) {
          onAdvanceStep(activeStep.id + 1);
        }
      }, 5800);
      return;
    }

    // Authentic FoxVox audio readback triggered in Rust for standard steps
    let advanceDelay = 1800;
    switch (activeStep.id) {
      case 0:
        // Native FoxVox profile execution plays start-beep.mp3 on "Engage Crew Chief" when transitioning
        advanceDelay = 1200;
        break;
      case 1:
        Ipc.playDrillSound('comms-check');
        advanceDelay = 2000;
        break;
      case 2:
        Ipc.playDrillSound('clear-start-two');
        advanceDelay = 2000;
        break;
      case 3:
        Ipc.playDrillSound('clear-sec');
        advanceDelay = 2200;
        break;
      case 4:
      case 11:
        Ipc.playDrillSound('copy');
        advanceDelay = 1800;
        break;
      case 6:
        Ipc.playDrillSound('no-flow');
        advanceDelay = 2000;
        break;
      case 7:
        Ipc.playDrillSound('controls-clear');
        advanceDelay = 2200;
        break;
      case 8:
        Ipc.playDrillSound('cleared-for-bit');
        advanceDelay = 2000;
        break;
      case 9:
        Ipc.playDrillSound('ready-trim');
        advanceDelay = 2000;
        break;
      case 12:
      case 13:
        Ipc.playDrillSound('controls-still-clear');
        advanceDelay = 2200;
        break;
      case 17:
        // Intentionally empty per user directive
        advanceDelay = 1200;
        break;
      case 18:
        Ipc.playDrillSound('cleared-off');
        advanceDelay = 3500;
        break;
    }

    setTimeout(() => {
      setIsChiefResponding(false);
      if (currentSubstepIndex < activeStep.substeps.length - 1) {
        onAdvanceSubstep(currentSubstepIndex + 1);
      } else if (activeStep.id < 18) {
        onAdvanceStep(activeStep.id + 1);
      }
    }, advanceDelay);
  }, [activeStep, currentSubstepIndex, onAdvanceSubstep, onAdvanceStep, onConsumeSpeech, onEngageChief]);

  useEffect(() => {
    if (!lastSpeech.phrase || lastSpeech.status !== 'VERIFIED') return;
    if (lastSpeech.id === lastProcessedSpeechIdRef.current) return;

    // Optional pilot acknowledgment: Step 01 Substep 4 (or 3) ("Loud and clear" or continue)
    if (activeStep.id === 1 && (currentSubstepIndex === 2 || currentSubstepIndex === 3)) {
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

    // Non-verbal phases: silently ignore
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
      triggerVerbalAdvance(activeSubstep?.expectedChiefResponse || activeStep.expectedChiefResponse);
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

  // Reset FLCS Power Test passed status when returning to Step 0 or beginning of Step 1
  useEffect(() => {
    if (activeStep.id === 0 || (activeStep.id === 1 && currentSubstepIndex === 0)) {
      setFlcsPwrTestPassed(false);
      setFlcsPwrTestTriggered(false);
      setFlcsPwrTestPos('NORM');
      setIsFlcsPwrTestHeld(false);
    }
  }, [activeStep.id, currentSubstepIndex]);

  // =========================================================================
  // STEP 01: ELEC PANEL LIGHT MATRIX & FLCS TEST HOLD
  // =========================================================================
  const elecPanelLights = useMemo<ElecPanelLights>(() => {
    if (activeStep.id >= 2) {
      // Once engine is running and generators come online, FLCS PMG, MAIN GEN, STBY GEN, and TO FLCS extinguish
      return {
        flcsPmg: false,
        mainGen: false,
        stbyGen: false,
        toFlcs: false,
        flcsRly: false,
        epuGen: epuWarningLampsLit,
        epuPmg: epuWarningLampsLit,
      };
    }
    if (elecSwitchPos === 'OFF') return {};
    if (isFlcsPwrTestHeld || flcsPwrTestPassed) {
      return {
        flcsPmg: true,
        mainGen: true,
        stbyGen: true,
        toFlcs: true,
        flcsRly: false,
        epuGen: epuWarningLampsLit,
        epuPmg: epuWarningLampsLit,
      };
    }
    if (elecSwitchPos === 'MAIN_PWR') {
      return {
        mainGen: true,
        stbyGen: true,
        flcsRly: true,
        epuGen: epuWarningLampsLit,
        epuPmg: epuWarningLampsLit,
      };
    }
    if (elecSwitchPos === 'BATT') {
      return {
        flcsRly: true,
        epuGen: epuWarningLampsLit,
        epuPmg: epuWarningLampsLit,
      };
    }
    return {};
  }, [activeStep.id, elecSwitchPos, isFlcsPwrTestHeld, flcsPwrTestPassed, epuWarningLampsLit]);

  const flcsTestLights = useMemo<FlcsPwrLights>(() => {
    if (flcsPwrTestPos === 'TEST' || isFlcsPwrTestHeld) {
      return { a: true, b: true, c: true, d: true };
    }
    return {};
  }, [flcsPwrTestPos, isFlcsPwrTestHeld]);

  const handleTestPanelSwitchChange = (switchKey: keyof TestPanelSwitches, value: any) => {
    if (switchKey === 'flcsPwrTest') {
      if (flcsPwrTestTriggered) return;
      Sound.playSwitch();
      setFlcsPwrTestPos(value);
      if (value === 'TEST') {
        setIsFlcsPwrTestHeld(true);
        setFlcsPwrTestPassed(true);
      } else if (value === 'NORM') {
        setIsFlcsPwrTestHeld(false);
        if (flcsPwrTestPassed) {
          setFlcsPwrTestTriggered(true); // Disable switch once let go back to NORM
          Sound.playCommit();
          if (activeStep.id === 1 && currentSubstepIndex === 1) {
            onAdvanceSubstep(2);
          }
        }
      }
    } else if (switchKey === 'epuGen') {
      if (value) {
        startEpuTestHold();
      } else {
        releaseEpuTestHold();
      }
    }
  };

  // =========================================================================
  // STEP 02: JFS START 2, CORE SPOOL, THROTTLE TO IDLE & HYD PRESSURE
  // =========================================================================
  const handleJfsSwitchChange = (pos: JfsSwitchPosition) => {
    Sound.playSwitch();
    setJfsPosition(pos);

    // Accidental selection of START 1 during Step 2 Substep 2 (currentSubstepIndex === 1)
    if (pos === 'START 1' && activeStep.id === 2 && currentSubstepIndex === 1) {
      setIsMistakeRollingBack(true);
      clearMistakeWarning();
      if (mistakeTimeoutRef.current) clearTimeout(mistakeTimeoutRef.current);

      mistakeTimeoutRef.current = setTimeout(() => {
        setJfsPosition('OFF');
        Sound.playSwitch();
        Sound.playCaution();
        setIsMistakeRollingBack(false);
        triggerMistakeWarning({
          type: 'warning',
          title: 'CAUTION: JFS START 1 SELECTED (SINGLE ACCUMULATOR)',
          message:
            'START 1 discharges only hydraulic accumulator #1. In cold weather or normal field conditions, a single accumulator provides insufficient torque to motor the engine core to starting RPM, risking a failed start. Standard Dash-1 procedures mandate START 2 to discharge both accumulators. Switch returned to OFF — right-click to select START 2.',
        });
      }, 1000);
      return;
    }

    if (pos === 'START 2') {
      clearMistakeWarning();
      clearMistakeRollback();
      // Activate RUN light at 2.0s
      setTimeout(() => {
        setJfsRunLit(true);
        Sound.playCommit();

        // Core slowly spools from 0% to 24-25%
        let rpm = 0;
        let advanced = false;
        const rpmInterval = setInterval(() => {
          rpm += 0.8;
          if (rpm >= 20 && !advanced) {
            advanced = true;
            Sound.playCommit();
            // Automatically advance to Substep 3 (Fuel Introduction) when passing 20%
            if (activeStep.id === 2 && currentSubstepIndex === 1) {
              onAdvanceSubstep(2);
            }
          }
          if (rpm >= 24.5) {
            rpm = 24.5;
            clearInterval(rpmInterval);
          }
          setTachRpm(Math.round(rpm * 10) / 10);
        }, 120);
      }, 2000);
    }
  };

  const handleThrottleCutoffToIdle = () => {
    if (engineSpoolingRef.current) return;
    engineSpoolingRef.current = true;

    Sound.playSwitch();
    setThrottlePosition('IDLE');

    // Smooth 8.5s multi-stage progression:
    // Tachometer: 24% -> 63%
    // FTIT: 120°C -> 700°C -> 550°C
    // Hyd A & B: 0.0 -> 3.0 (3,000 PSI / 12 o'clock)
    let tick = 0;
    const totalTicks = 85;
    const startRpm = tachRpm > 0 ? tachRpm : 24;
    let curTemp = 120;
    let curRpm = startRpm;
    let curHyd = 0.0;

    const engineInterval = setInterval(() => {
      tick += 1;

      // 1. RPM progression to 63%
      if (curRpm < 63) {
        curRpm += (63 - startRpm) / 75;
        if (curRpm > 63) curRpm = 63;
      }

      // 2. FTIT progression: rise to 700°C over first 35 ticks, then settle to 550°C over next 40 ticks
      if (tick <= 35) {
        curTemp += (700 - 120) / 35;
      } else if (tick <= 75) {
        curTemp -= (700 - 550) / 40;
      } else {
        curTemp = 550;
      }

      // 3. Hydraulic pressure: pump builds from 0.0 to 3.0 after tick 15 to tick 75
      if (tick > 15 && curHyd < 3.1) {
        curHyd += 3.0 / 20;
        if (curHyd > 3.1) curHyd = 3.1;
      }

      // At ~50% RPM, JFS automatically disconnects and RUN light turns off
      if (curRpm >= 50) {
        setJfsPosition('OFF');
        setJfsRunLit(false);
      }

      setFtitDeg(Math.round(curTemp));
      setTachRpm(Math.round(curRpm * 10) / 10);
      setHydPressA(Math.round(curHyd * 100) / 100);
      setHydPressB(Math.round(curHyd * 100) / 100);

      if (tick >= totalTicks) {
        clearInterval(engineInterval);
        setFtitDeg(550);
        setTachRpm(63);
        setHydPressA(3.0);
        setHydPressB(3.0);
        setJfsPosition('OFF');
        setJfsRunLit(false);
        Sound.playCommit();
        Ipc.playDrillSound('good-start');
        setStep2EngineStabilized(true);
      }
    }, 100);
  };

  // Step 3+: Ensure JFS switch is OFF and RUN light is dark
  useEffect(() => {
    if (activeStep.id >= 3) {
      setJfsPosition('OFF');
      setJfsRunLit(false);
    }
  }, [activeStep.id]);

  // =========================================================================
  // STEP 03: 30-SECOND COUNTDOWN & SEC NOZZLE OVERLAY
  // =========================================================================
  useEffect(() => {
    if (activeStep.id !== 3 || currentSubstepIndex !== 0) return;
    const timer = setInterval(() => {
      setSecTimerRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Sound.playCommit();
          onAdvanceSubstep(1); // Advance to Substep 3-2 (Clear SEC callout)
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeStep.id, currentSubstepIndex, onAdvanceSubstep]);

  // When reaching Substep 3-3 (Flip ENG CONT to SEC), show FLIR overlay
  useEffect(() => {
    if (activeStep.id === 3 && currentSubstepIndex === 2) {
      setStep3FlirSrc('/crewchief/FLCS/nozzleOpen.webp');
      setStep3FlirOpen(true);
    }
  }, [activeStep.id, currentSubstepIndex]);

  // Step 4 direct entry: Ensure SEC mode and closed nozzle when beginning Step 4
  useEffect(() => {
    if (activeStep.id === 4 && currentSubstepIndex === 0) {
      setEngContPosition('SEC');
      setNozPosPercent(0);
    }
  }, [activeStep.id, currentSubstepIndex]);

  const handleEngContChange = (pos: EngContSwitchPosition) => {
    Sound.playSwitch();
    setEngContPosition(pos);
    if (pos === 'SEC') {
      setNozPosPercent(0);
      setStep3FlirSrc('/crewchief/FLCS/nozzleClosed.webp');
      setStep3FlirOpen(true);
      Sound.playCommit();
      Ipc.playDrillSound('nozzle-closed');
      // Keep FLIR overlay for 3s then close and proceed to Substep 3 (Spool to 73%)
      setTimeout(() => {
        setStep3FlirOpen(false);
        if (activeStep.id === 3) {
          onAdvanceSubstep(3);
        }
      }, 3000);
    } else if (pos === 'PRI') {
      setNozPosPercent(96);
      setStep3FlirSrc('/crewchief/FLCS/nozzleOpen.webp');
      setStep3FlirOpen(true);
      Sound.playCommit();
      Ipc.playDrillSound('nozzle-open');
      // Hang for 3 seconds then close and proceed to Substep 2 (Nozzle 100% open verification)
      setTimeout(() => {
        setStep3FlirOpen(false);
        if (activeStep.id === 4) {
          onAdvanceSubstep(2);
        }
      }, 3000);
    }
  };

  const handleSpoolTo73Rpm = (targetRpm: number) => {
    setTachRpm(targetRpm);
    if (targetRpm >= 73) {
      Sound.playCommit();
      setStep3FlirSrc('/crewchief/FLCS/nozzleClosed.webp');
      setStep3FlirOpen(true);
    }
  };

  // =========================================================================
  // STEP 05 & 06: EPU SWITCH & 5-SECOND TEST HOLD
  // =========================================================================
  const epuTestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const epuAirTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const epuHoldCompletedRef = useRef<boolean>(false);

  const handleEpuSwitchChange = (pos: EpuSwitchPosition) => {
    Sound.playSwitch();
    setEpuSwitch(pos);

    // Accidental selection of ON during Step 5 Substep 2 (currentSubstepIndex === 1)
    if (pos === 'ON' && activeStep.id === 5 && currentSubstepIndex === 1) {
      setIsMistakeRollingBack(true);
      clearMistakeWarning();
      if (mistakeTimeoutRef.current) clearTimeout(mistakeTimeoutRef.current);

      mistakeTimeoutRef.current = setTimeout(() => {
        setEpuSwitch('NORM');
        Sound.playSwitch();
        Sound.playCaution();
        setIsMistakeRollingBack(false);
        triggerMistakeWarning({
          type: 'danger',
          title: 'DANGER: EPU SWITCH SET TO ON (LETHAL GROUND HAZARD)',
          message:
            'Placing EPU to ON manually commands hydrazine ignition on the ground! This discharges lethal toxic H-70 fuel, endangers ground crew approaching the aircraft, and risks turbine overspeed. The switch must be set to OFF before pulling the ground safety pin. Switch returned to NORM — right-click to select OFF.',
        });
      }, 1000);
      return;
    }

    if (pos === 'OFF' && activeStep.id === 5 && currentSubstepIndex === 1) {
      clearMistakeWarning();
      clearMistakeRollback();
      Sound.playCommit();
      onAdvanceSubstep(2);
    } else if (pos === 'NORM' && activeStep.id === 5 && currentSubstepIndex === 3) {
      clearMistakeWarning();
      clearMistakeRollback();
      Sound.playCommit();
      onAdvanceStep(6);
    }
  };

  const startEpuTestHold = () => {
    Sound.playSwitch();
    setEpuGenSwitchHeld(true);
    setEpuRunLightLit(true);
    epuHoldCompletedRef.current = false;
    let elapsedMs = 0;

    // After 1.5 seconds: AIR caution lamp turns on, ABCD lights turn on
    if (epuAirTimeoutRef.current) clearTimeout(epuAirTimeoutRef.current);
    epuAirTimeoutRef.current = setTimeout(() => {
      setEpuAirLightLit(true);
    }, 1500);

    if (epuTestTimerRef.current) clearInterval(epuTestTimerRef.current);
    epuTestTimerRef.current = setInterval(() => {
      elapsedMs += 100;
      const progress = Math.min(100, (elapsedMs / 5000) * 100);
      setEpuTestHoldProgress(progress);
      if (elapsedMs >= 5000 && !epuHoldCompletedRef.current) {
        epuHoldCompletedRef.current = true;
        Sound.playCommit();
      }
    }, 100);
  };

  const releaseEpuTestHold = () => {
    if (epuTestTimerRef.current) {
      clearInterval(epuTestTimerRef.current);
      epuTestTimerRef.current = null;
    }
    if (epuAirTimeoutRef.current) {
      clearTimeout(epuAirTimeoutRef.current);
      epuAirTimeoutRef.current = null;
    }

    setEpuGenSwitchHeld(false);
    setEpuRunLightLit(false);
    setEpuAirLightLit(false);

    // Only advance if the user held consecutively for 5 full seconds
    if (epuHoldCompletedRef.current) {
      if (activeStep.id === 6 && currentSubstepIndex === 3) {
        // EPU GEN and EPU PMG warning lights show up on release
        setStep6ThrottleAngle(2);
        setTachRpm(82);
        setEpuWarningLampsLit(true);
        Sound.playCommit();
        setTimeout(() => {
          onAdvanceSubstep(4); // Advance to Substep 6-5: Throttle to idle with note
        }, 800);
      }
    } else {
      // Released before 5 full seconds: reset progress so user must hold consecutively
      setEpuTestHoldProgress(0);
    }
  };

  // =========================================================================
  // STEP 07: FLIGHT CONTROL EXERCISE (20s WARM-UP)
  // =========================================================================
  useEffect(() => {
    if (activeStep.id !== 7) {
      setControlWarmupRemaining(20);
      setStep7CardVisible(true);
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
  // STEP 08: FLCS BIT (15-SECOND VIDEO PLAYBACK IN FLIR OVERLAY)
  // =========================================================================
  const handleTriggerFlcsBit = () => {
    Sound.playSwitch();
    setFlcsBitSwitch(true);
    setFlcsBitActive(true);
    setFlcsBitElapsed(0);

    const bitTimer = setInterval(() => {
      setFlcsBitElapsed((prev) => {
        const next = prev + 1;
        if (next >= 15) {
          clearInterval(bitTimer);
          setFlcsBitActive(false);
          setFlcsBitSwitch(false);
          Sound.playSwitch();
          Sound.playCommit();
          onAdvanceStep(9);
          return 15;
        }
        return next;
      });
    }, 1000);
  };

  // =========================================================================
  // STEP 09 - 11: MANUAL TRIM PANEL & WHEEL RE-CENTERING
  // =========================================================================
  const isTrimsCentered = useMemo(() => {
    return Math.abs(rollTrim) <= 0.2 && Math.abs(pitchTrim) <= 0.2 && Math.abs(yawTrim) <= 0.2;
  }, [rollTrim, pitchTrim, yawTrim]);

  // Step 11 Trim Animation
  useEffect(() => {
    if (activeStep.id === 11 && currentSubstepIndex === 2) {
      const timers = [
        setTimeout(() => {
          setPitchTrim(1.0);
          Ipc.playDrillSound('trim-nose-up');
        }, 800),
        setTimeout(() => {
          setPitchTrim(-1.1);
          Ipc.playDrillSound('trim-nose-down');
        }, 2000),
        setTimeout(() => {
          setRollTrim(-1.2);
          Ipc.playDrillSound('trim-roll-left');
        }, 3200),
        setTimeout(() => {
          setRollTrim(1.1);
          Ipc.playDrillSound('trim-roll-right');
        }, 4400),
        setTimeout(() => {
          setYawTrim(-1.5);
          Ipc.playDrillSound('trim-yaw-left');
        }, 5600),
        setTimeout(() => {
          setYawTrim(1.6);
          Ipc.playDrillSound('trim-yaw-right');
        }, 6800),
        setTimeout(() => {
          Sound.playCommit();
          onAdvanceSubstep(3); // Prompt user to manually re-center trims
        }, 8000),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [activeStep.id, currentSubstepIndex, onAdvanceSubstep]);

  // Advance to Step 12 when all trims re-centered
  useEffect(() => {
    if (activeStep.id === 11 && currentSubstepIndex === 3) {
      if (isTrimsCentered && !hasAdvancedStep11Ref.current) {
        hasAdvancedStep11Ref.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceStep(12);
        }, 500);
        return () => clearTimeout(t);
      }
    } else {
      hasAdvancedStep11Ref.current = false;
    }
  }, [activeStep.id, currentSubstepIndex, isTrimsCentered, onAdvanceStep]);

  // Step 12 Substep 2: Roll Axis Detection (20% deflection from neutral: <0.40 or >0.60; order does not matter)
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 1) {
      if (rollDisplay < 0.40 && !rollLeftDone) {
        setRollLeftDone(true);
        Ipc.playDrillSound('big-roll-left');
      }
      if (rollDisplay > 0.60 && !rollRightDone) {
        setRollRightDone(true);
        Ipc.playDrillSound('big-roll-right');
      }
    }
  }, [activeStep.id, currentSubstepIndex, rollDisplay, rollLeftDone, rollRightDone]);

  // Step 12 Substep 2 Advance: Trigger when both roll directions completed
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 1 && rollLeftDone && rollRightDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(2);
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [activeStep.id, currentSubstepIndex, rollLeftDone, rollRightDone, onAdvanceSubstep]);

  // Step 12 Substep 3: Pitch Axis Detection (20% deflection: Strict order: Nose Up >0.60 first, then Nose Down <0.40)
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 2) {
      if (pitchDisplay > 0.60 && !pitchNoseUpDone) {
        setPitchNoseUpDone(true);
        Ipc.playDrillSound('big-nose-up');
      }
      if (pitchNoseUpDone && pitchDisplay < 0.40 && !pitchNoseDownDone) {
        setPitchNoseDownDone(true);
        Ipc.playDrillSound('big-nose-down');
      }
    }
  }, [activeStep.id, currentSubstepIndex, pitchDisplay, pitchNoseUpDone, pitchNoseDownDone]);

  // Step 12 Substep 3 Advance: Trigger when Nose Down reached after Nose Up
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 2 && pitchNoseUpDone && pitchNoseDownDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(3); // Advance to MPO while stick is held nose down
        }, 400);
        return () => clearTimeout(t);
      }
    }
  }, [activeStep.id, currentSubstepIndex, pitchNoseUpDone, pitchNoseDownDone, onAdvanceSubstep]);

  // Step 12 Substep 4: MPO Detection (DirectInput hardware binding or simulate)
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 3) {
      if (telemetry.mpo_active && !hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        Ipc.playDrillSound('mpo-kick');
        setMpoKickActive(true);
        const t = setTimeout(() => {
          setMpoKickActive(false);
          onAdvanceSubstep(4);
        }, 600);
        return () => clearTimeout(t);
      }
    }
  }, [activeStep.id, currentSubstepIndex, telemetry.mpo_active, onAdvanceSubstep]);

  // Step 12 Substep 5: Yaw Axis Detection (20% deflection from neutral: <0.40 or >0.60; order does not matter)
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 4) {
      if (yawDisplay < 0.40 && !yawLeftDone) {
        setYawLeftDone(true);
        Ipc.playDrillSound('big-yaw-left');
      }
      if (yawDisplay > 0.60 && !yawRightDone) {
        setYawRightDone(true);
        Ipc.playDrillSound('big-yaw-right');
      }
    }
  }, [activeStep.id, currentSubstepIndex, yawDisplay, yawLeftDone, yawRightDone]);

  // Step 12 Substep 5 Advance: Trigger when both rudder directions completed
  useEffect(() => {
    if (activeStep.id === 12 && currentSubstepIndex === 4 && yawLeftDone && yawRightDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(5); // Advance to Substep 6: Speedbrakes
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [activeStep.id, currentSubstepIndex, yawLeftDone, yawRightDone, onAdvanceSubstep]);

  // =========================================================================
  // STEP 12 & 13: DYNAMIC FLIR SURFACE RESPONSE & SPEEDBRAKES & DBU
  // =========================================================================
  const dynamicFlirInfo = useMemo<{ src: string; label: string }>(() => {
    if (speedbrakesOpen) {
      return { src: '/crewchief/FLCS/spdBrakes.webp', label: 'SPEEDBRAKES OPEN' };
    }
    if (telemetry.mpo_active || mpoKickActive) {
      return { src: '/crewchief/FLCS/mpoKick.webp', label: 'MPO ACTIVE' };
    }
    if (rollDisplay < 0.38) {
      return { src: '/crewchief/FLCS/rollLeft.webp', label: 'FLCS ROLL LEFT' };
    }
    if (rollDisplay > 0.62) {
      return { src: '/crewchief/FLCS/rollRight.webp', label: 'FLCS ROLL RIGHT' };
    }
    if (pitchDisplay < 0.38) {
      return { src: '/crewchief/FLCS/noseDown.webp', label: 'FLCS PITCH NOSE DOWN' };
    }
    if (pitchDisplay > 0.62) {
      return { src: '/crewchief/FLCS/noseUp.webp', label: 'FLCS PITCH NOSE UP' };
    }
    if (yawDisplay < 0.38) {
      return { src: '/crewchief/FLCS/rudderLeft.webp', label: 'FLCS RUDDER LEFT' };
    }
    if (yawDisplay > 0.62) {
      return { src: '/crewchief/FLCS/rudderRight.webp', label: 'FLCS RUDDER RIGHT' };
    }
    return { src: '/crewchief/FLCS/neutral.webp', label: 'FLCS NEUTRAL' };
  }, [speedbrakesOpen, telemetry.mpo_active, mpoKickActive, rollDisplay, pitchDisplay, yawDisplay]);

  // Unified FLIR overlay state across all training scenes
  const flirOverlayState = useMemo(() => {
    if (activeStep.id === 3 || activeStep.id === 4) {
      return {
        isOpen: step3FlirOpen,
        src: step3FlirSrc,
        targetLabel: 'EXHAUST NOZZLE',
        alt: 'Engine Nozzle Petals',
      };
    }
    if (activeStep.id === 8) {
      return {
        isOpen: flcsBitActive,
        src: '/crewchief/BIT.mp4',
        targetLabel: 'FLCS SURFACE SWEEP',
        alt: 'FLCS BIT Automated Surface Sweep',
      };
    }
    if (activeStep.id === 12 || activeStep.id === 13) {
      return {
        isOpen: true,
        src: dynamicFlirInfo.src,
        targetLabel: dynamicFlirInfo.label,
        alt: 'Dynamic Flight Control Surfaces',
      };
    }
    return {
      isOpen: false,
      src: '',
      targetLabel: '',
      alt: '',
    };
  }, [activeStep.id, step3FlirOpen, step3FlirSrc, flcsBitActive, dynamicFlirInfo]);

  // Top-Right Cockpit Locator Overlay: Programmatically driven by cockpitLocatorConfig
  const locatorConfig = useMemo(() => {
    return getCockpitLocatorConfig(activeStep.id, currentSubstepIndex);
  }, [activeStep.id, currentSubstepIndex]);

  // Toggle speedbrakes in Step 12 Substep 6
  const handleToggleSpeedbrakes = () => {
    if (speedbrakeCycleDone) return;
    Sound.playSwitch();
    if (!speedbrakesOpen) {
      setSpeedbrakesOpen(true);
      Ipc.playDrillSound('speedbrakes-open');
    } else {
      setSpeedbrakesOpen(false);
      setSpeedbrakeCycleDone(true); // Disable immediately after second click
      Sound.playCommit();
      Ipc.playDrillSound('speedbrakes-closed');
      setTimeout(() => {
        onAdvanceStep(13); // Proceed to Step 13 (DBU)
      }, 800);
    }
  };

  // Step 13: Digital Backup Switch Toggle
  const handleToggleDbu = (val: boolean) => {
    Sound.playSwitch();
    setDbuSwitchOn(val);
    if (!val) {
      // Switched back to OFF -> advance to Step 14
      Sound.playCommit();
      setTimeout(() => {
        onAdvanceStep(14);
      }, 800);
    }
  };

  // Step 13: Flight stick & rudder movement audio callouts during Digital Backup Check
  useEffect(() => {
    if (activeStep.id !== 13 || !dbuSwitchOn) {
      dbuRollAnnouncedRef.current = null;
      dbuPitchAnnouncedRef.current = null;
      dbuYawAnnouncedRef.current = null;
      return;
    }

    // Roll
    if (rollDisplay < 0.38) {
      if (dbuRollAnnouncedRef.current !== 'left') {
        dbuRollAnnouncedRef.current = 'left';
        Ipc.playDrillSound('big-roll-left');
      }
    } else if (rollDisplay > 0.62) {
      if (dbuRollAnnouncedRef.current !== 'right') {
        dbuRollAnnouncedRef.current = 'right';
        Ipc.playDrillSound('big-roll-right');
      }
    } else if (rollDisplay >= 0.44 && rollDisplay <= 0.56) {
      dbuRollAnnouncedRef.current = null;
    }

    // Pitch
    if (pitchDisplay < 0.38) {
      if (dbuPitchAnnouncedRef.current !== 'down') {
        dbuPitchAnnouncedRef.current = 'down';
        Ipc.playDrillSound('big-nose-down');
      }
    } else if (pitchDisplay > 0.62) {
      if (dbuPitchAnnouncedRef.current !== 'up') {
        dbuPitchAnnouncedRef.current = 'up';
        Ipc.playDrillSound('big-nose-up');
      }
    } else if (pitchDisplay >= 0.44 && pitchDisplay <= 0.56) {
      dbuPitchAnnouncedRef.current = null;
    }

    // Yaw
    if (yawDisplay < 0.38) {
      if (dbuYawAnnouncedRef.current !== 'left') {
        dbuYawAnnouncedRef.current = 'left';
        Ipc.playDrillSound('big-yaw-left');
      }
    } else if (yawDisplay > 0.62) {
      if (dbuYawAnnouncedRef.current !== 'right') {
        dbuYawAnnouncedRef.current = 'right';
        Ipc.playDrillSound('big-yaw-right');
      }
    } else if (yawDisplay >= 0.44 && yawDisplay <= 0.56) {
      dbuYawAnnouncedRef.current = null;
    }
  }, [activeStep.id, dbuSwitchOn, rollDisplay, pitchDisplay, yawDisplay]);

  // Reset brake tracking timers on step or substep change
  useEffect(() => {
    if (activeStep.id !== 14 || currentSubstepIndex !== 1) {
      leftBrakeMovedRef.current = false;
      if (leftBrakeIdleTimerRef.current) {
        clearTimeout(leftBrakeIdleTimerRef.current);
        leftBrakeIdleTimerRef.current = null;
      }
    }
    if (activeStep.id !== 15 || currentSubstepIndex !== 1) {
      rightBrakeMovedRef.current = false;
      if (rightBrakeIdleTimerRef.current) {
        clearTimeout(rightBrakeIdleTimerRef.current);
        rightBrakeIdleTimerRef.current = null;
      }
    }
  }, [activeStep.id, currentSubstepIndex]);

  // =========================================================================
  // STEP 14 & 15: PHYSICAL BRAKE PEDAL INTEGRATION (MOVEMENT & IDLE DETECTION)
  // =========================================================================
  useEffect(() => {
    if (activeStep.id === 14 && currentSubstepIndex === 1) {
      let holdInterval: NodeJS.Timeout | null = null;
      if (leftBrakeDeflection >= 0.20) {
        if (leftBrakeIdleTimerRef.current) {
          clearTimeout(leftBrakeIdleTimerRef.current);
          leftBrakeIdleTimerRef.current = null;
        }
        if (!leftBrakeMovedRef.current) {
          leftBrakeMovedRef.current = true;
          Sound.playCommit();
          Ipc.playDrillSound('left-brake-movement');
        }
        holdInterval = setInterval(() => {
          setBrakeHoldTimer((prev) => Math.min(3, prev + 1));
        }, 1000);
      } else {
        setBrakeHoldTimer(0);
        if (leftBrakeDeflection <= 0.05 && leftBrakeMovedRef.current) {
          if (!leftBrakeIdleTimerRef.current) {
            leftBrakeIdleTimerRef.current = setTimeout(() => {
              leftBrakeIdleTimerRef.current = null;
              leftBrakeMovedRef.current = false;
              Sound.playCommit();
              Ipc.playDrillSound('left-brake-nomovement');
              onAdvanceSubstep(2);
            }, 2000);
          }
        }
      }
      return () => {
        if (holdInterval) clearInterval(holdInterval);
      };
    }

    if (activeStep.id === 15 && currentSubstepIndex === 1) {
      let holdInterval: NodeJS.Timeout | null = null;
      if (rightBrakeDeflection >= 0.20) {
        if (rightBrakeIdleTimerRef.current) {
          clearTimeout(rightBrakeIdleTimerRef.current);
          rightBrakeIdleTimerRef.current = null;
        }
        if (!rightBrakeMovedRef.current) {
          rightBrakeMovedRef.current = true;
          Sound.playCommit();
          Ipc.playDrillSound('right-brake-movement');
        }
        holdInterval = setInterval(() => {
          setBrakeHoldTimer((prev) => Math.min(3, prev + 1));
        }, 1000);
      } else {
        setBrakeHoldTimer(0);
        if (rightBrakeDeflection <= 0.05 && rightBrakeMovedRef.current) {
          if (!rightBrakeIdleTimerRef.current) {
            rightBrakeIdleTimerRef.current = setTimeout(() => {
              rightBrakeIdleTimerRef.current = null;
              rightBrakeMovedRef.current = false;
              Sound.playCommit();
              Ipc.playDrillSound('right-brake-nomovement');
              onAdvanceSubstep(2);
            }, 2000);
          }
        }
      }
      return () => {
        if (holdInterval) clearInterval(holdInterval);
      };
    }
    if (activeStep.id === 3 && currentSubstepIndex === 3) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(4);
      }
    }
    if (activeStep.id === 6 && currentSubstepIndex === 1) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(2);
      }
    }
    if (activeStep.id === 17 && currentSubstepIndex === 0) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(1);
      }
    }
  }, [activeStep.id, currentSubstepIndex, leftBrakeDeflection, rightBrakeDeflection, onAdvanceSubstep]);

  // =========================================================================
  // STEP 16: FUEL PANEL / AAR DOOR CYCLE
  // =========================================================================
  const handleAarSwitchChange = (pos: any) => {
    Sound.playSwitch();
    setAirRefuelDoorPos(pos);
    if (activeStep.id === 16) {
      if (pos === 'OPEN' && currentSubstepIndex === 1) {
        Sound.playCommit();
        Ipc.playDrillSound('aar-door-open');
        onAdvanceSubstep(2);
      } else if (pos === 'CLOSE' && currentSubstepIndex >= 2) {
        Sound.playCommit();
        Ipc.playDrillSound('aar-door-closed');
        setTimeout(() => {
          onAdvanceStep(17);
        }, 1000);
      }
    }
  };

  // =========================================================================
  // STEP 18: FINALE SALUTE & DELAYED RETURN TO COMMS
  // =========================================================================
  const handleTriggerFinale = () => {
    Sound.playCommit();
    setFinaleSaluteActive(true);
    setTimeout(() => {
      onExitDrill();
    }, 1800);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 font-mono select-none">
      {/* ============================================================== */}
      {/* 1. CINEMATIC SCENE VIEWPORT                                     */}
      {/* ============================================================== */}
      <div className="w-full min-h-[440px] flex flex-col items-center justify-center py-2 relative">
        {/* Dynamic & Layout-Animated Cockpit Panels Stage */}
        <div className="w-full flex flex-wrap items-center justify-center gap-6 min-h-[320px]">
          <AnimatePresence>
            {/* -------------------------------------------------------- */}
            {/* CARD: Welcome & Interphone (Step 0)                     */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 0 && (
              <motion.div
                key="card-welcome"
                layout
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center"
              >
                <TacticalDisplayCard
                  src="/crewchief/welcome.webp"
                  alt="F-16C Cockpit Welcome & Ground Interphone"
                  title="RAMP START INITIALIZATION // INTERPHONE"
                  badge="STANDBY"
                  badgeColor="#38bdf8"
                  badgeBg="rgba(56, 189, 248, 0.15)"
                  badgeBorder="rgba(56, 189, 248, 0.4)"
                  caption="EXTERNAL GROUND INTERPHONE LINK"
                  footerRight="LINE-01"
                  width={540}
                  aspectRatio="video"
                  priority
                />

                <div className="flex flex-col items-center gap-2 mt-4 font-mono">
                  <p className="text-[11px] text-zinc-400 text-center max-w-md font-sans">
                    Connect ground interphone to establish direct audio link with Crew Chief standing beside the left sill.
                  </p>
                </div>
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: TEST Panel (Step 1, Step 6-3)                     */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 1 || (activeStep.id === 6 && currentSubstepIndex === 3)) && (
              <motion.div
                key="panel-test"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeStep.id === 6 ? 'TEST PANEL (HOLD EPU/GEN)' : 'TEST PANEL (LEFT CONSOLE)'}
                </span>
                <TestPanel
                  switches={
                    activeStep.id === 6
                      ? { epuGen: epuGenSwitchHeld }
                      : { flcsPwrTest: flcsPwrTestPos }
                  }
                  onSwitchChange={handleTestPanelSwitchChange}
                  lights={
                    activeStep.id === 6
                      ? epuAirLightLit ? { a: true, b: true, c: true, d: true } : {}
                      : flcsTestLights
                  }
                  allowSwitchClick={
                    activeStep.id === 6
                      ? { epuGen: true }
                      : { flcsPwrTest: currentSubstepIndex === 1 && !flcsPwrTestTriggered }
                  }
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: ELEC Power Panel (Step 1, Step 6-3 & 6-4)         */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 1 || (activeStep.id === 6 && (currentSubstepIndex === 3 || currentSubstepIndex === 4))) && (
              <motion.div
                key="panel-elec-power"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeStep.id === 6 ? 'ELEC POWER PANEL (EPU GEN & PMG LAMPS)' : 'ELEC POWER PANEL (RIGHT CONSOLE)'}
                </span>
                <ElecPowerPanel
                  switchPosition={activeStep.id === 6 ? 'MAIN_PWR' : elecSwitchPos}
                  onSwitchChange={(pos) => {
                    if (activeStep.id === 1 && currentSubstepIndex === 0) {
                      Sound.playSwitch();
                      setElecSwitchPos(pos);
                      if (pos === 'MAIN_PWR') {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }
                    }
                  }}
                  lights={elecPanelLights}
                  allowSwitchClick={activeStep.id === 1 ? { mainPwr: currentSubstepIndex === 0 } : false}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: ENG & JET START Panel (Step 2 Substeps 0 & 1, Step 3, Step 4) */}
            {/* -------------------------------------------------------- */}
            {((activeStep.id === 2 && currentSubstepIndex < 2) || activeStep.id === 3 || activeStep.id === 4) && (
              <motion.div
                key="panel-eng-jet-start"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  ENG &amp; JET START PANEL
                </span>
                <EngJetStartPanel
                  jfsPosition={jfsPosition}
                  onJfsChange={handleJfsSwitchChange}
                  runLight={jfsRunLit}
                  engContPosition={engContPosition}
                  onEngContChange={handleEngContChange}
                  allowSwitchClick={{
                    jfsSwitch:
                      activeStep.id === 2 &&
                      currentSubstepIndex === 1 &&
                      jfsPosition === 'OFF' &&
                      !isMistakeRollingBack,
                    engContSwitch:
                      (activeStep.id === 3 && currentSubstepIndex === 2 && engContPosition === 'PRI') ||
                      (activeStep.id === 4 && currentSubstepIndex === 1 && engContPosition === 'SEC'),
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: Throttle Quadrant (Step 2-3+, Step 3-4+, Step 6-2 & 6-4) */}
            {/* -------------------------------------------------------- */}
            {((activeStep.id === 2 && currentSubstepIndex >= 2) ||
              (activeStep.id === 3 && currentSubstepIndex >= 4) ||
              (activeStep.id === 6 && (currentSubstepIndex === 2 || currentSubstepIndex === 4))) && (
              <motion.div
                key="panel-throttle"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeStep.id === 2
                    ? 'THROTTLE (CUTOFF ➔ IDLE)'
                    : activeStep.id === 3
                    ? currentSubstepIndex === 5
                      ? 'THROTTLE (RETARD TO IDLE)'
                      : 'THROTTLE (SPOOL TO 73% RPM)'
                    : currentSubstepIndex === 4
                    ? 'THROTTLE (RETARD TO IDLE)'
                    : 'THROTTLE (SPOOL TO 82% RPM)'}
                </span>
                {activeStep.id === 2 ? (
                  <ThrottleQuadrant
                    position={throttlePosition}
                    pointA="CUTOFF"
                    pointB="IDLE"
                    disableDrag
                    interactive={throttlePosition === 'CUTOFF'}
                    onClick={(detent) => {
                      if (detent === 'IDLE' && throttlePosition === 'CUTOFF') {
                        handleThrottleCutoffToIdle();
                      }
                    }}
                  />
                ) : activeStep.id === 3 ? (
                  <ThrottleQuadrant
                    position={step4ThrottleAngle >= -3 ? 'MIL' : 'IDLE'}
                    angle={step4ThrottleAngle}
                    pointA="IDLE"
                    pointB="MIL"
                    disableDrag
                    hideMilBadge
                    customPointBLabel={currentSubstepIndex === 5 ? undefined : "73%"}
                    interactive={currentSubstepIndex === 4 || currentSubstepIndex === 5}
                    onClick={() => {
                      Sound.playSwitch();
                      if (currentSubstepIndex === 4) {
                        const targetAngle = -2;
                        setStep4ThrottleAngle(targetAngle);
                        setTachRpm(75);
                        handleSpoolTo73Rpm(75);
                        Sound.playCommit();
                        onAdvanceSubstep(5);
                      } else if (currentSubstepIndex === 5) {
                        setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
                        setTachRpm(63);
                        Sound.playCommit();
                        setTimeout(() => {
                          onAdvanceStep(4);
                        }, 500);
                      }
                    }}
                    onPositionChange={(detent, angle) => {
                      setStep4ThrottleAngle(angle);
                      const ratio = Math.max(0, Math.min(1, (angle - (-14)) / (-2 - (-14))));
                      const computedRpm = Math.round(63 + ratio * 12);
                      setTachRpm(computedRpm);
                      if (currentSubstepIndex === 4 && computedRpm >= 73) {
                        handleSpoolTo73Rpm(computedRpm);
                        Sound.playCommit();
                        onAdvanceSubstep(5);
                      } else if (currentSubstepIndex === 5 && computedRpm <= 65) {
                        Sound.playCommit();
                        setTimeout(() => {
                          onAdvanceStep(4);
                        }, 500);
                      }
                    }}
                  />
                ) : (
                  <ThrottleQuadrant
                    angle={step6ThrottleAngle}
                    pointA="IDLE"
                    pointB="MIL"
                    disableDrag
                    allowContinuous
                    interactive={currentSubstepIndex === 2 || currentSubstepIndex === 4}
                    onClick={() => {
                      Sound.playSwitch();
                      if (currentSubstepIndex === 2) {
                        setStep6ThrottleAngle(2);
                        setTachRpm(82);
                        Sound.playCommit();
                        onAdvanceSubstep(3);
                      } else if (currentSubstepIndex === 4) {
                        setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
                        setTachRpm(63);
                        setEpuWarningLampsLit(false);
                      }
                    }}
                    onPositionChange={(detent, angle) => {
                      setStep6ThrottleAngle(angle);
                      const ratio = Math.max(0, Math.min(1, (angle - (-14)) / (6 - (-14))));
                      const computedRpm = Math.round(63 + ratio * 24);
                      setTachRpm(computedRpm);
                      if (currentSubstepIndex === 2 && computedRpm >= 82) {
                        Sound.playCommit();
                        onAdvanceSubstep(3);
                      } else if (currentSubstepIndex === 4 && computedRpm <= 65) {
                        setEpuWarningLampsLit(false);
                      }
                    }}
                  />
                )}
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GAUGE: Tachometer % RPM (Step 2, 3, 4, 6)                */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 2 || activeStep.id === 3 || activeStep.id === 4 || (activeStep.id === 6 && currentSubstepIndex >= 2)) && (
              <motion.div
                key="gauge-tach-rpm"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  TACHOMETER (% RPM)
                </span>
                <RpmIndicator value={tachRpm} />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GAUGE: FTIT Indicator (Step 2, Substep 2+)               */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 2 && currentSubstepIndex >= 2 && (
              <motion.div
                key="gauge-ftit"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  FTIT INDICATOR (x100 °C)
                </span>
                <FtitIndicator value={ftitDeg / 100} />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GAUGE: Hydraulic Pressure (Step 2, Substep 2+)            */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 2 && currentSubstepIndex >= 2 && (
              <motion.div
                key="gauge-hyd-press"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  HYDRAULIC PRESSURE (SYS A / B)
                </span>
                <HydPressPanel pressA={hydPressA} pressB={hydPressB} />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GAUGE: Exhaust Nozzle Position (Step 3 & Step 4)         */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 3 || activeStep.id === 4) && (
              <motion.div
                key="gauge-noz-pos"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  EXHAUST NOZZLE POSITION (% OPEN)
                </span>
                <NozPosIndicator value={nozPosPercent} />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: EPU Panel (Step 5, Step 6-0 to 6-3)               */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 5 || (activeStep.id === 6 && currentSubstepIndex <= 3)) && (
              <motion.div
                key="panel-epu"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  EPU PANEL (LEFT CONSOLE)
                </span>
                <EpuPanel
                  switchPosition={epuSwitch}
                  onSwitchChange={handleEpuSwitchChange}
                  lights={{ runLight: epuRunLightLit, air: epuAirLightLit }}
                  allowSwitchClick={{
                    epuSwitch:
                      activeStep.id === 5 &&
                      !isMistakeRollingBack &&
                      ((currentSubstepIndex === 1 && epuSwitch === 'NORM') ||
                        (currentSubstepIndex === 3 && epuSwitch === 'OFF')),
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: EPU Ground Safety Pin (Step 5, Substeps 0 & 1)     */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 5 && currentSubstepIndex < 2 && (
              <motion.div
                key="card-epu-pin"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  EPU GROUND SAFETY PIN
                </span>
                <TacticalDisplayCard
                  src="/crewchief/FLCS/EPUPin.webp"
                  alt="EPU Safety Pin"
                  title="EPU SAFETY PIN // INSERTED"
                  badge="CAUTION"
                  badgeColor="#f59e0b"
                  badgeBg="rgba(245, 158, 11, 0.15)"
                  badgeBorder="rgba(245, 158, 11, 0.4)"
                  caption="REMOVE PIN BEFORE SYSTEM OPERATION"
                  width={320}
                  aspectRatio="square"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: 6-Ft Exclusion Zone (Step 7, Substeps 0 & 1)       */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 7 && currentSubstepIndex < 2 && step7CardVisible && (
              <motion.div
                key="card-6ft-exclusion"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <TacticalDisplayCard
                  src="/crewchief/FLCS/6ftExclusion.webp"
                  alt="6-Foot Surface Exclusion Zone"
                  title="FLIGHT CONTROLS // EXCLUSION ZONE"
                  badge="SAFETY CLEARANCE"
                  badgeColor="#ef4444"
                  badgeBg="rgba(239, 68, 68, 0.15)"
                  badgeBorder="rgba(239, 68, 68, 0.4)"
                  caption="VERIFY 6-FOOT PERIMETER CLEAR OF PERSONNEL"
                  width={380}
                  aspectRatio="square"
                  objectFit="contain"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Flight Stick & Rudder Crosshair (Step 7, 12, 13)   */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 7 || activeStep.id === 12 || activeStep.id === 13) && (
              <motion.div
                key="card-stick-crosshair"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-zinc-900 border border-zinc-800"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeStep.id === 7 ? 'FLIGHT CONTROL SURFACE DEFLECTION' : 'FLIGHT STICK POSITION'}
                </span>
                <div className="relative w-44 h-44 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shadow-inner">
                  <div className="absolute inset-x-0 h-px bg-zinc-800" />
                  <div className="absolute inset-y-0 w-px bg-zinc-800" />
                  <div
                    className={`w-5 h-5 rounded-full border transition-[transform] duration-75 ${
                      activeStep.id === 7
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] border-emerald-200'
                        : 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] border-cyan-200'
                    }`}
                    style={{
                      transform: `translate(${(rollDisplay - 0.5) * 140}px, ${(pitchDisplay - 0.5) * 140}px)`,
                    }}
                  />
                </div>
                <div className="text-[10px] text-zinc-400">
                  RUDDER: {Math.round((yawDisplay - 0.5) * 200)}%
                </div>
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: FLT CONTROL Panel (Step 8: BIT, Step 13: DBU)     */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 8 || activeStep.id === 13) && (
              <motion.div
                key="panel-flt-control"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  {activeStep.id === 8 ? 'FLT CONTROL PANEL (FLCS BIT)' : 'FLT CONTROL PANEL (DBU)'}
                </span>
                <FltControlPanel
                  switches={
                    activeStep.id === 8
                      ? { bit: flcsBitSwitch }
                      : { digitalBackup: dbuSwitchOn }
                  }
                  onSwitchChange={(key, val) => {
                    if (activeStep.id === 8 && key === 'bit' && !flcsBitActive) {
                      handleTriggerFlcsBit();
                    } else if (activeStep.id === 13 && key === 'digitalBackup') {
                      handleToggleDbu(val);
                    }
                  }}
                  lights={activeStep.id === 8 ? { run: flcsBitActive } : undefined}
                  allowSwitchClick={{
                    bit: activeStep.id === 8 && currentSubstepIndex >= 1 && !flcsBitActive,
                    digitalBackup: activeStep.id === 13 && currentSubstepIndex >= 1,
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: MANUAL TRIM Panel (Step 9, 10, 11)                */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 9 || activeStep.id === 10 || activeStep.id === 11) && (
              <motion.div
                key="panel-manual-trim"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  MANUAL TRIM PANEL (LEFT CONSOLE)
                </span>
                <ManualTrimPanel
                  values={{
                    rollTrim,
                    pitchTrim,
                    yawTrim,
                    trimDisc: trimDiscSwitch,
                  }}
                  onValueChange={(key, val) => {
                    Sound.playClick();
                    if (key === 'trimDisc') {
                      setTrimDiscSwitch(val as boolean);
                      if (val === false && activeStep.id === 10 && currentSubstepIndex === 0) {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      } else if (val === true && activeStep.id === 11 && currentSubstepIndex === 0) {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }
                    } else if (key === 'rollTrim') {
                      setRollTrim(val as number);
                    } else if (key === 'pitchTrim') {
                      setPitchTrim(val as number);
                    } else if (key === 'yawTrim') {
                      setYawTrim(val as number);
                    }
                  }}
                  allowSwitchClick={{
                    trimDisc: (activeStep.id === 10 && currentSubstepIndex === 0) || (activeStep.id === 11 && currentSubstepIndex === 0),
                    rollTrim: activeStep.id === 11 && currentSubstepIndex === 3,
                    pitchTrim: activeStep.id === 11 && currentSubstepIndex === 3,
                    yawTrim: activeStep.id === 11 && currentSubstepIndex === 3,
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: MANUAL PITCH OVRD (MPO) (Step 12)                 */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 12 && (
              <motion.div
                key="panel-manual-pitch"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  MANUAL PITCH OVRD (MPO)
                </span>
                <ManualPitchPanel
                  isOvrd={telemetry.mpo_active ?? mpoKickActive}
                  allowSwitchClick={false}
                />
                {currentSubstepIndex === 3 && (
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      setMpoKickActive(true);
                      setTimeout(() => {
                        setMpoKickActive(false);
                        onAdvanceSubstep(4);
                      }, 600);
                    }}
                    className="mt-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-[10px] cursor-pointer transition-[background-color]"
                  >
                    SIMULATE MPO KICK
                  </button>
                )}
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* GAUGE: SPEEDBRAKES Indicator (Step 12 & Step 13)         */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 12 || activeStep.id === 13) && (
              <motion.div
                key="gauge-speedbrakes"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  SPEEDBRAKES
                </span>
                <SpeedBrakeIndicator
                  isOpen={speedbrakesOpen}
                  interactive={activeStep.id === 12 && currentSubstepIndex === 5 && !speedbrakeCycleDone}
                  onToggle={handleToggleSpeedbrakes}
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Main Gear Brake Calipers & Deflection (Step 14 & 15) */}
            {/* -------------------------------------------------------- */}
            {(activeStep.id === 14 || activeStep.id === 15) && (
              <motion.div
                key="card-brake-cluster"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-6"
              >
                <TacticalDisplayCard
                  src={activeStep.id === 14 ? '/crewchief/FLCS/leftBrake.webp' : '/crewchief/FLCS/rightBrake.webp'}
                  alt={activeStep.id === 14 ? 'Left Main Gear Brake Caliper' : 'Right Main Gear Brake Caliper'}
                  title={activeStep.id === 14 ? 'LEFT MAIN GEAR BRAKE CALIPER' : 'RIGHT MAIN GEAR BRAKE CALIPER'}
                  badge="HYDRAULIC LINE"
                  badgeColor="#22c55e"
                  badgeBg="rgba(34, 197, 94, 0.15)"
                  badgeBorder="rgba(34, 197, 94, 0.4)"
                  caption="OBSERVE BRAKE CLAMPING ACTION"
                  width={420}
                  aspectRatio="video"
                />

                <div className="w-full max-w-md p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-300">
                    <span>{activeStep.id === 14 ? 'LEFT' : 'RIGHT'} BRAKE DEFLECTION</span>
                    <span className="text-emerald-400 font-mono">
                      {Math.round((activeStep.id === 14 ? leftBrakeDeflection : rightBrakeDeflection) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-700/80">
                    <div
                      className="h-full bg-emerald-400 transition-[width] duration-100 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      style={{
                        width: `${Math.round((activeStep.id === 14 ? leftBrakeDeflection : rightBrakeDeflection) * 100)}%`,
                      }}
                    />
                  </div>

                  {currentSubstepIndex === 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-amber-300 font-bold">
                        Hold pedal down for 3 seconds ({brakeHoldTimer}/3s)
                      </span>
                      <button
                        onClick={() => onAdvanceStep(activeStep.id === 14 ? 15 : 16)}
                        className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-600 text-xs font-bold cursor-pointer transition-[background-color]"
                      >
                        SKIP BRAKE
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: FUEL SYSTEM Panel (Step 16)                       */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 16 && (
              <motion.div
                key="panel-fuel"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  FUEL SYSTEM PANEL (LEFT CONSOLE)
                </span>
                <FuelPanel
                  switches={{ airRefuel: airRefuelDoorPos }}
                  onSwitchChange={(key, val) => {
                    if (key === 'airRefuel') {
                      handleAarSwitchChange(val);
                    }
                  }}
                  allowSwitchClick={{ airRefuel: currentSubstepIndex >= 1 }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Wheel Chocks (Step 17)                             */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 17 && (
              <motion.div
                key="card-chocks"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center"
              >
                <TacticalDisplayCard
                  src={chocksInPlace ? '/crewchief/FLCS/chocksOn.webp' : '/crewchief/FLCS/chocksOff.webp'}
                  alt="Main Gear Wheel Chocks"
                  title="WHEEL CHOCKS // STATUS"
                  badge={chocksInPlace ? 'CHOCKS IN PLACE' : 'CHOCKS REMOVED'}
                  badgeColor={chocksInPlace ? '#f59e0b' : '#22c55e'}
                  badgeBg={chocksInPlace ? 'rgba(245, 158, 11, 0.15)' : 'rgba(34, 197, 94, 0.15)'}
                  badgeBorder={chocksInPlace ? 'rgba(245, 158, 11, 0.4)' : 'rgba(34, 197, 94, 0.4)'}
                  caption={chocksInPlace ? 'HOLD TOE BRAKES FIRM' : 'FREE TO TAXI'}
                  width={420}
                  aspectRatio="video"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Chief Final Salute (Step 18, Substep 0)            */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 18 && currentSubstepIndex === 0 && (
              <motion.div
                key="card-chief-salute"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -12 }}
                transition={{
                  layout: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.22 },
                  scale: { duration: 0.22 },
                  y: { duration: 0.22 },
                }}
                style={{ willChange: 'opacity, transform' }}
                className="flex flex-col items-center"
              >
                <TacticalDisplayCard
                  src="/crewchief/chiefSalute.webp"
                  alt="Crew Chief Final Salute"
                  title="DEPARTURE MARSHALLER // 10 O'CLOCK"
                  badge="CLEARED TAXI"
                  badgeColor="#22c55e"
                  badgeBg="rgba(34, 197, 94, 0.15)"
                  badgeBorder="rgba(34, 197, 94, 0.4)"
                  caption="CHIEF RENDERING SHARP HAND SALUTE"
                  width={420}
                  aspectRatio="square"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Grand Celebration View (Step 18, Substep >= 1)     */}
            {/* -------------------------------------------------------- */}
            {activeStep.id === 18 && currentSubstepIndex >= 1 && (
              <motion.div
                key="card-celebration"
                layout
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -15 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                style={{ willChange: 'opacity, transform' }}
                className="w-full max-w-xl p-6 rounded-2xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 border-2 border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col items-center text-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_24px_rgba(52,211,153,0.5)]">
                  <Award className="w-9 h-9 text-emerald-300 animate-pulse" />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-emerald-400 uppercase">
                    MISSION READY // TAXI AUTHORIZED
                  </span>
                  <h3 className="text-xl font-mono font-black text-white tracking-wide">
                    COCKPIT VOICE DRILL COMPLETED
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md font-sans">
                    All 18 Dash-1 procedural checkpoints, interphone voice drills, and ground crew coordinations successfully verified.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 w-full my-2 font-mono">
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">CHECKS</span>
                    <span className="text-sm font-black text-emerald-400">18 / 18</span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">STATUS</span>
                    <span className="text-sm font-black text-cyan-400">CODE 1</span>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 block">LINE</span>
                    <span className="text-sm font-black text-emerald-400">DISCONNECTED</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    Sound.playCommit();
                    if (onExitDrill) {
                      onExitDrill();
                    } else {
                      onRestartDrill();
                    }
                  }}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-black font-mono text-sm cursor-pointer shadow-lg shadow-emerald-950/40 transition-[background-color] flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  <span>RETURN SALUTE • CONCLUDE DRILL</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* ACTIVE TIMERS & NOTICES PLACED CLEANLY UNDER PANELS          */}
        {/* ------------------------------------------------------------ */}
        {/* 30-Second Countdown Timer in Step 03 Substep 0 */}
        {activeStep.id === 3 && currentSubstepIndex === 0 && (
          <div className="w-full max-w-xl p-4 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between mt-4">
            <div>
              <div className="text-xs font-bold text-amber-300">
                Engine Warm-up Stabilization Timer ({secTimerRemaining}s remaining)
              </div>
              <div className="text-[11px] text-zinc-400">
                Allow engine oil &amp; hydraulic seals to normalize prior to secondary controller check.
              </div>
            </div>
            <button
              onClick={() => {
                Sound.playCommit();
                onAdvanceSubstep(1);
              }}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer transition-[background-color]"
            >
              SKIP TIMER
            </button>
          </div>
        )}

        {/* EPU Hold Progress Indicator in Step 06 Substep 4 (Hold EPU/GEN Switch) */}
        {activeStep.id === 6 && currentSubstepIndex === 3 && (
          <div className="flex flex-col items-center gap-2 mt-4">
            <span className="text-xs font-bold text-amber-400">
              {epuGenSwitchHeld
                ? `HOLDING EPU/GEN SWITCH (${Math.round(epuTestHoldProgress)}%)`
                : 'CLICK AND HOLD EPU/GEN SWITCH ON TEST PANEL (5 SECONDS)'}
            </span>
            <div className="w-64 h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-300"
                style={{ width: `${epuTestHoldProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Explanatory Note on Retard to Idle in Step 06 Substep 5 */}
        {activeStep.id === 6 && currentSubstepIndex === 4 && (
          <div className="w-full max-w-xl p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 mt-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>PROCEDURAL NOTE:</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              Normally, the EPU GEN and EPU PMG caution lights illuminate when the EPU/GEN switch is held below 82% RPM. In this training environment, the sequence is verified sequentially before retarding to idle.
            </p>
            <button
              onClick={() => onAdvanceStep(7)}
              className="w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center justify-center gap-1.5"
            >
              <span>Continue</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------ */}
        {/* DYNAMIC WARNING ALERT FOR COCKPIT SWITCH MISTAKES             */}
        {/* ------------------------------------------------------------ */}
        <AnimatePresence>
          {mistakeWarning && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              style={{ willChange: 'opacity, transform' }}
              className={`w-full max-w-xl p-3.5 rounded-xl border mt-3 select-none shadow-lg backdrop-blur-sm ${
                mistakeWarning.type === 'danger'
                  ? 'bg-rose-950/70 border-rose-500/80 text-rose-200 shadow-rose-950/40'
                  : 'bg-amber-950/70 border-amber-500/80 text-amber-200 shadow-amber-950/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 text-left">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      mistakeWarning.type === 'danger'
                        ? 'text-rose-400 animate-pulse'
                        : 'text-amber-400'
                    }`}
                  />
                  <div className="space-y-1">
                    <span className="font-mono font-bold text-xs tracking-wider block">
                      {mistakeWarning.title}
                    </span>
                    <p className="text-[11px] leading-relaxed opacity-95 font-sans">
                      {mistakeWarning.message}
                    </p>
                  </div>
                </div>
                <button
                  onClick={clearMistakeWarning}
                  className="text-zinc-400 hover:text-zinc-200 p-1 text-xs shrink-0 cursor-pointer transition-colors"
                  title="Dismiss warning"
                >
                  ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ------------------------------------------------------------ */}
        {/* DYNAMIC STATUS / ACTION BANNER                               */}
        {/* ------------------------------------------------------------ */}
        {!(activeStep.id === 18 && currentSubstepIndex >= 1) && (
          <div className="w-full max-w-xl p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs overflow-hidden mt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`banner-${activeStep.id}-${currentSubstepIndex}-${step2EngineStabilized}-${flcsBitActive}-${chocksInPlace}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                style={{ willChange: 'opacity, transform' }}
              >
                {/* Step 0 Banner */}
                {activeStep.id === 0 && (
                  <span className="text-emerald-400 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Verbal Required: Speak &quot;Engage Chief&quot; into microphone.</span>
                  </span>
                )}

                {/* Step 1 Banner */}
                {activeStep.id === 1 && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set MAIN PWR switch to MAIN PWR position on the ELEC panel.
                  </span>
                )}
                {activeStep.id === 1 && currentSubstepIndex === 1 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Click and hold FLCS PWR TEST switch to TEST on the TEST panel.
                  </span>
                )}
                {activeStep.id === 1 && currentSubstepIndex === 2 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Comms Check&quot; over the ground interphone loop.</span>
                  </span>
                )}
                {activeStep.id === 1 && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      Chief Responded: &quot;Loud and clear, sir/ma&apos;am.&quot;
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceStep(2);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 2 Banner */}
                {activeStep.id === 2 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready Start Two&quot; to clear ground personnel.</span>
                  </span>
                )}
                {activeStep.id === 2 && currentSubstepIndex === 1 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Set JFS switch to START 2. Await JFS RUN light and spool past 20% RPM.
                  </span>
                )}
                {activeStep.id === 2 && currentSubstepIndex >= 2 && !step2EngineStabilized && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Advance throttle over cutoff detent to IDLE. Observe FTIT climb and HYD pressure.
                  </span>
                )}
                {activeStep.id === 2 && step2EngineStabilized && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Engine stabilized at idle (63% RPM, 550°C FTIT, 3,000 PSI Hyd A/B).
                    </span>
                    <button
                      onClick={() => onAdvanceStep(3)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 3 Banner */}
                {activeStep.id === 3 && currentSubstepIndex === 0 && (
                  <span className="text-amber-300 font-bold">
                    ⏳ Engine warm-up in progress. Await stabilization timer or click Skip.
                  </span>
                )}
                {activeStep.id === 3 && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear for SEC check&quot;.</span>
                  </span>
                )}
                {activeStep.id === 3 && currentSubstepIndex === 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Flip ENG CONT switch to SEC. Observe nozzle close to 0%.
                  </span>
                )}
                {activeStep.id === 3 && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-amber-300 font-bold">
                      ⚡ Depress toe brakes firmly (or click simulate) to hold aircraft stationary prior to throttle spool.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(4);
                      }}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      HOLD TOE BRAKES • PROCEED
                    </button>
                  </div>
                )}
                {activeStep.id === 3 && currentSubstepIndex === 4 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Click or advance throttle forward to spool engine to 73% RPM minimum.
                  </span>
                )}
                {activeStep.id === 3 && currentSubstepIndex === 5 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Click or retard throttle back to IDLE. Observe nozzle remain closed (&lt; 5%).
                  </span>
                )}

                {/* Step 4 Banner */}
                {activeStep.id === 4 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;SEC check good&quot; to coordinate with crew chief.</span>
                  </span>
                )}
                {activeStep.id === 4 && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Snap ENG CONT switch back to PRI and seat red safety guard down.
                  </span>
                )}
                {activeStep.id === 4 && currentSubstepIndex >= 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Convergent nozzle opened to 100%. Engine electronic control restored to PRI.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceStep(5);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 5 Banner */}
                {activeStep.id === 5 && currentSubstepIndex === 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">
                      Observe EPU RUN &amp; AIR lights dark. Verify safety pin installed.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeStep.id === 5 && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set EPU switch to OFF on EPU panel.
                  </span>
                )}
                {activeStep.id === 5 && currentSubstepIndex === 2 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Pull EPU safety pin&quot; to ground crew.</span>
                  </span>
                )}
                {activeStep.id === 5 && currentSubstepIndex === 3 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set EPU switch back to NORM.
                  </span>
                )}

                {/* Step 6 Banner */}
                {activeStep.id === 6 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Cleared to check for flow&quot;.</span>
                  </span>
                )}
                {activeStep.id === 6 && currentSubstepIndex === 1 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-amber-300 font-bold">
                      ⚡ Depress toe brakes firmly (or click simulate) to hold aircraft stationary prior to engine run-up.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(2);
                      }}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      HOLD TOE BRAKES • PROCEED
                    </button>
                  </div>
                )}
                {activeStep.id === 6 && currentSubstepIndex === 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Advance throttle forward to ~82% RPM to generate bleed air for EPU.
                  </span>
                )}
                {activeStep.id === 6 && currentSubstepIndex === 3 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Click and hold EPU/GEN switch on TEST panel for 5 seconds.
                  </span>
                )}
                {activeStep.id === 6 && currentSubstepIndex === 4 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-cyan-300 font-bold">
                      ⚡ Action Required: Retard throttle back to IDLE. Observe EPU GEN and EPU PMG lamps.
                    </span>
                    {tachRpm > 65 && (
                      <button
                        onClick={() => {
                          Sound.playSwitch();
                          setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
                          setTachRpm(63);
                          setEpuWarningLampsLit(false);
                          Sound.playCommit();
                        }}
                        className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                      >
                        RETARD TO IDLE
                      </button>
                    )}
                  </div>
                )}

                {/* Step 7 Banner */}
                {activeStep.id === 7 && currentSubstepIndex === 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">
                      Observe ground crew outside 6-ft surface exclusion zone.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeStep.id === 7 && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Flight Controls Clear&quot; to ground crew.</span>
                  </span>
                )}
                {activeStep.id === 7 && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-left">
                      <div className="text-xs font-bold text-emerald-300">
                        Cycle Controls &amp; Warm Hydraulics ({controlWarmupRemaining}s remaining)
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Exercise sidestick and rudder pedals through full deflection range.
                      </div>
                    </div>
                    <button
                      onClick={() => onAdvanceStep(8)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 8 Banner */}
                {activeStep.id === 8 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear BIT&quot;.</span>
                  </span>
                )}
                {activeStep.id === 8 && currentSubstepIndex >= 1 && !flcsBitActive && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Toggle BIT switch to initiate FLCS surface sweep (Note: In simulator/jet takes 45s; condensed to 15s in drill).
                  </span>
                )}
                {activeStep.id === 8 && flcsBitActive && (
                  <span className="text-amber-400 font-bold animate-pulse">
                    FLCS BIT IN PROGRESS — SURFACE DEFLECTION RECORDING ({15 - flcsBitElapsed}s remaining • 45s on simulator/jet)
                  </span>
                )}

                {/* Step 9-11 Banners */}
                {activeStep.id === 9 && currentSubstepIndex === 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">
                      Observe Manual Trim indicators (Roll, Pitch, Yaw) centered at neutral zero (0.0).
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeStep.id === 9 && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready for trim check&quot;.</span>
                  </span>
                )}
                {activeStep.id === 10 && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set TRIM / AP DISC switch to DISC.
                  </span>
                )}
                {activeStep.id === 10 && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Disconnected&quot;.</span>
                  </span>
                )}
                {activeStep.id === 10 && currentSubstepIndex >= 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">
                      Chief confirmed: &quot;No trim movement observed, disconnect confirmed.&quot;
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceStep(11);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {activeStep.id === 11 && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set TRIM / AP DISC switch back to NORM.
                  </span>
                )}
                {activeStep.id === 11 && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Connected&quot;.</span>
                  </span>
                )}
                {activeStep.id === 11 && currentSubstepIndex === 3 && (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-amber-300 font-bold">
                      ⚡ Turn roll, pitch, and yaw trim wheels to re-center them.
                    </span>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-400 mt-1">
                      <span>ROLL: {rollTrim.toFixed(1)}</span>
                      <span>PITCH: {pitchTrim.toFixed(1)}</span>
                      <span>YAW: {yawTrim.toFixed(1)}</span>
                    </div>
                  </div>
                )}

                {/* Step 12 Banner */}
                {activeStep.id === 12 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear big movements&quot;.</span>
                  </span>
                )}
                {activeStep.id === 12 && currentSubstepIndex === 1 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-300 font-bold">
                        ⚡ Deflect flight stick full LEFT and full RIGHT:
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${rollLeftDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {rollLeftDone ? '✓' : '○'} ROLL LEFT
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${rollRightDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {rollRightDone ? '✓' : '○'} ROLL RIGHT
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(2);
                      }}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      SKIP ROLL TEST
                    </button>
                  </div>
                )}
                {activeStep.id === 12 && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-300 font-bold">
                        ⚡ Pull stick full AFT (Nose Up), then push full FWD (Nose Down):
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${pitchNoseUpDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {pitchNoseUpDone ? '✓' : '1.'} NOSE UP (AFT)
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${pitchNoseDownDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : pitchNoseUpDone ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {pitchNoseDownDone ? '✓' : '2.'} NOSE DOWN (FWD &amp; HOLD)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(3);
                      }}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      SKIP PITCH TEST
                    </button>
                  </div>
                )}
                {activeStep.id === 12 && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-cyan-300 font-bold">
                      ⚡ While holding Nose Down, actuate physical MPO switch on throttle (or simulate/skip):
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        setMpoKickActive(true);
                        setTimeout(() => {
                          setMpoKickActive(false);
                          onAdvanceSubstep(4);
                        }, 600);
                      }}
                      className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      SIMULATE MPO • SKIP
                    </button>
                  </div>
                )}
                {activeStep.id === 12 && currentSubstepIndex === 4 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-300 font-bold">
                        ⚡ Deflect rudder pedals full LEFT and full RIGHT:
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${yawLeftDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {yawLeftDone ? '✓' : '○'} RUDDER LEFT
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${yawRightDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                        {yawRightDone ? '✓' : '○'} RUDDER RIGHT
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(5);
                      }}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      SKIP YAW TEST
                    </button>
                  </div>
                )}
                {activeStep.id === 12 && currentSubstepIndex === 5 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Click Speedbrake indicator to cycle petals OPEN, then click again to CLOSE.
                  </span>
                )}

                {/* Step 13 Banner */}
                {activeStep.id === 13 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;DBU Still Clear&quot; to ground crew.</span>
                  </span>
                )}
                {activeStep.id === 13 && currentSubstepIndex >= 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Toggle DIGITAL BACKUP switch to ON, verify surface movements in FLIR, then return to OFF to proceed.
                  </span>
                )}

                {/* Step 14 & 15 Banner */}
                {(activeStep.id === 14 || activeStep.id === 15) && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;{activeStep.id === 14 ? 'Ready on the left brake' : 'Ready on the right brake'}&quot;.</span>
                  </span>
                )}
                {(activeStep.id === 14 || activeStep.id === 15) && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Caliper clamping verified good.
                    </span>
                    <button
                      onClick={() => onAdvanceStep(activeStep.id === 14 ? 15 : 16)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 16 Banner */}
                {activeStep.id === 16 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready for AAR door check&quot;.</span>
                  </span>
                )}
                {activeStep.id === 16 && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set AIR REFUEL switch to OPEN on FUEL panel.
                  </span>
                )}
                {activeStep.id === 16 && currentSubstepIndex >= 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Return AIR REFUEL switch to CLOSE on FUEL panel.
                  </span>
                )}

                {/* Step 17 Banner */}
                {activeStep.id === 17 && currentSubstepIndex === 0 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-amber-300 font-bold">
                      ⚡ Depress toe brakes firmly (or click simulate) to hold aircraft stationary.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      HOLD TOE BRAKES • PROCEED
                    </button>
                  </div>
                )}
                {activeStep.id === 17 && currentSubstepIndex === 1 && chocksInPlace && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Remove Chocks&quot; (or &quot;Wheel Chocks&quot;).</span>
                  </span>
                )}
                {activeStep.id === 17 && !chocksInPlace && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Chocks removed and stowed in equipment bay. Proceeding to marshal salute...
                    </span>
                  </div>
                )}

                {/* Step 18 Banner */}
                {activeStep.id === 18 && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Cleared Off&quot; over the interphone loop.</span>
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. DIRECTIVE & COMMS NARRATIVE CARD                            */}
      {/* ============================================================== */}
      <div className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeStep.id}-${currentSubstepIndex}-dir`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ willChange: 'opacity, transform' }}
          >
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
              ▶ PROCEDURAL DIRECTIVE:
            </span>
            <p className="font-bold text-zinc-200 leading-snug">
              {activeSubstep?.description || activeStep.whatToPerformNow}
            </p>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {activeSubstep?.phaseType === 'VERBAL' ? (
            <motion.div
              key={`${activeStep.id}-${currentSubstepIndex}-callout`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ willChange: 'opacity, transform' }}
            >
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Mic className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>SPOKEN CALLOUT REQUIRED:</span>
              </span>
              <p className="font-black text-emerald-300 text-sm">
                &quot;{activeStep.pilotSpokenCalls.primary}&quot;
              </p>
              <span className="text-[9px] text-zinc-500 mt-0.5 block truncate">
                Accepted: {activeStep.pilotSpokenCalls.synonyms.slice(0, 2).join(', ') || 'Exact phrase'}
              </span>
            </motion.div>
          ) : activeSubstep?.phaseType === 'ACTION' ? (
            <motion.div
              key={`${activeStep.id}-${currentSubstepIndex}-action`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ willChange: 'opacity, transform' }}
            >
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                ⚡ COCKPIT ACTION REQUIRED:
              </span>
              <p className="font-black text-cyan-200 text-xs">
                {activeSubstep?.interactiveControl?.actionPrompt || activeSubstep?.label || 'Actuate cockpit control'}
              </p>
              <span className="text-[9px] text-zinc-500 mt-0.5 block">
                Direct physical click or switch throw
              </span>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeStep.id}-${currentSubstepIndex}-verify`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ willChange: 'opacity, transform' }}
            >
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block mb-1">
                👁️ OBSERVE &amp; VERIFY:
              </span>
              <p className="font-bold text-amber-200 text-xs">
                {activeSubstep?.visualCue || 'Observe cockpit instrument response'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {isChiefResponding || (activeSubstep?.expectedChiefResponse ? true : (activeSubstep?.rationale ? false : activeSubstep?.phaseType === 'VERBAL')) ? (
            <motion.div
              key={`${activeStep.id}-${currentSubstepIndex}-rx`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ willChange: 'opacity, transform' }}
              className={isChiefResponding ? 'animate-pulse' : ''}
            >
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <Headphones className="w-3 h-3 text-amber-400 shrink-0" />
                <span>CREW CHIEF (RX):</span>
              </span>
              <p className="text-amber-200 italic font-medium">
                &quot;{chiefDialogue || activeSubstep?.expectedChiefResponse || activeStep.expectedChiefResponse}&quot;
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`${activeStep.id}-${currentSubstepIndex}-rationale`}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ willChange: 'opacity, transform' }}
            >
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                💡 PROCEDURAL RATIONALE:
              </span>
              <p className="text-zinc-400 text-[11px] leading-snug">
                {activeSubstep?.rationale || activeStep.whatToExpectNext}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================================== */}
      {/* 3. TACTICAL FLIR BOTTOM-RIGHT OVERLAY                          */}
      {/* Persists at root for smooth CRT collapse exit animation       */}
      {/* ============================================================== */}
      <TacticalFlirOverlay
        isOpen={flirOverlayState.isOpen}
        src={flirOverlayState.src}
        alt={flirOverlayState.alt}
        targetLabel={flirOverlayState.targetLabel}
      />

      {/* ============================================================== */}
      {/* 4. TOP-RIGHT COCKPIT LOCATOR OVERLAY                           */}
      {/* ============================================================== */}
      <CockpitLocatorOverlay
        isOpen={!!locatorConfig}
        targetArea={locatorConfig?.targetArea}
        secondaryAreas={locatorConfig?.secondaryAreas}
        pins={locatorConfig?.pins}
      />
    </div>
  );
};
