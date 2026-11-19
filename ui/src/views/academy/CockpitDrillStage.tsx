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
import { RampStartStep, StepSubstep, DrillStepName, RAMP_STEPS_BY_NAME } from '../../services/voiceTrainingData';
import { getCockpitLocatorConfig } from './cockpitLocatorConfig';

export type { DrillStepName };

/**
 * ============================================================================
 * DRILL_STEP_ORDER: Procedural Sequence Configuration
 * ============================================================================
 * Defines the order of execution for all steps in the cockpit startup drill.
 * Changing the order or names here alters the step sequence dynamically while
 * keeping all switch logic, telemetry bindings, and skip routing intact.
 */
export const DRILL_STEP_ORDER: DrillStepName[] = [
  'ENGAGE_CHIEF',
  'ELEC_POWER',
  'JFS_START',
  'SEC_CHECK',
  'PRI_VERIFY',
  'EPU_PIN',
  'EPU_FLOW',
  'FLIGHT_CONTROLS_CLEAR',
  'FLCS_BIT',
  'TRIM_VERIFY',
  'TRIM_DISC',
  'TRIM_CONN',
  'BIG_MOVEMENTS',
  'DBU_CHECK',
  'LEFT_BRAKE',
  'RIGHT_BRAKE',
  'AAR_DOOR',
  'CHOCKS_REMOVAL',
  'FINALE_SALUTE',
];

export const getOrderedDrillSteps = (order: DrillStepName[] = DRILL_STEP_ORDER): RampStartStep[] => {
  return order.map((name) => RAMP_STEPS_BY_NAME[name]).filter(Boolean);
};

import {
  TacticalDisplayCard,
  TacticalControlInputCard,
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
  currentStepIndex?: number;
  totalSteps?: number;
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
  step: DrillStepName | number,
  substepOrder: number,
  rawPhrase: string,
  rawCmd?: string
): boolean => {
  const phrase = rawPhrase.trim().toUpperCase();
  const cmd = (rawCmd || '').trim().toUpperCase();

  // ENGAGE_CHIEF (Step 0) Substep 1: Engage Chief
  if (step === 'ENGAGE_CHIEF' || step === 0) {
    const valid = [
      'ENGAGE CHIEF', 'ENGAGE CREW CHIEF', 'START CHIEF', 'START CREW CHIEF',
      'CHIEF', 'ENABLE CHIEF', 'BEGIN CHIEF', 'TURN ON CHIEF'
    ];
    return valid.includes(phrase) || cmd.includes('ENGAGE');
  }

  // ELEC_POWER (Step 1) Substep 3 (or 2): Comms Check
  if ((step === 'ELEC_POWER' || step === 1) && (substepOrder === 2 || substepOrder === 3)) {
    const valid = ['COMMS CHECK', 'RADIO CHECK', 'CHIEF COMMS CHECK', 'CREW CHIEF COMMS CHECK'];
    return valid.includes(phrase) || cmd.includes('COMMS');
  }

  // JFS_START (Step 2) Substep 1: Start Two
  if ((step === 'JFS_START' || step === 2) && substepOrder === 1) {
    const valid = ['START TWO', 'READY START TWO', 'CHIEF START TWO', 'CLEAR START TWO', 'START 2', 'READY START 2'];
    return valid.includes(phrase) || cmd.includes('START TWO') || cmd.includes('START_TWO');
  }

  // SEC_CHECK (Step 3) Substep 2: Clear SEC
  if ((step === 'SEC_CHECK' || step === 3) && substepOrder === 2) {
    const valid = [
      'CLEAR SEC', 'CLEAR S E C', 'READY SEC', 'READY S E C',
      'CLEAR FOR SEC', 'CLEAR FOR SEC CHECK', 'READY FOR SEC CHECK'
    ];
    return valid.includes(phrase) || cmd.includes('SEC');
  }

  // PRI_VERIFY (Step 4) Substep 1: SEC Good
  if ((step === 'PRI_VERIFY' || step === 4) && substepOrder === 1) {
    const valid = [
      'SEC GOOD', 'S E C GOOD', 'SEC CHECK GOOD', 'CHIEF SEC GOOD',
      'SEC CHECK COMPLETE', 'SEC PASS', 'SEC OK'
    ];
    return valid.includes(phrase) || cmd.includes('SEC');
  }

  // EPU_PIN (Step 5) Substep 3: Pull EPU Pin
  if ((step === 'EPU_PIN' || step === 5) && substepOrder === 3) {
    const valid = [
      'PULL EPU PIN', 'PULL PIN', 'REMOVE EPU PIN', 'REMOVE PIN',
      'PULL EPU SAFETY PIN', 'REMOVE EPU SAFETY PIN', 'CHIEF PULL EPU PIN'
    ];
    return valid.includes(phrase) || cmd.includes('PIN');
  }

  // EPU_FLOW (Step 6) Substep 1: Check Flow
  if ((step === 'EPU_FLOW' || step === 6) && substepOrder === 1) {
    const valid = [
      'CHECK FLOW', 'FLOW CHECK', 'CLEARED TO CHECK FOR FLOW',
      'CHECK FOR FLOW', 'CHIEF CHECK FLOW', 'VERIFY FLOW'
    ];
    return valid.includes(phrase) || cmd.includes('FLOW');
  }

  // FLIGHT_CONTROLS_CLEAR (Step 7) Substep 2: Flight Controls Clear
  if ((step === 'FLIGHT_CONTROLS_CLEAR' || step === 7) && substepOrder === 2) {
    const valid = [
      'FLIGHT CONTROLS CLEAR', 'CONTROLS CLEAR', 'CHIEF FLIGHT CONTROLS CLEAR',
      'CONFIRM FLIGHT CONTROLS CLEAR'
    ];
    return valid.includes(phrase) || cmd.includes('CONTROLS CLEAR');
  }

  // FLCS_BIT (Step 8) Substep 1: Clear BIT
  if ((step === 'FLCS_BIT' || step === 8) && substepOrder === 1) {
    const valid = [
      'CLEAR BIT', 'CLEARED FOR BIT', 'READY FOR BIT', 'CLEAR FOR FLCS BIT',
      'CHIEF CLEARED FOR BIT', 'BIT CHECK', 'CLEAR FOR BIT', 'READY BIT'
    ];
    return valid.includes(phrase) || cmd.includes('BIT');
  }

  // TRIM_VERIFY (Step 9) Substep 2: Ready Trim
  if ((step === 'TRIM_VERIFY' || step === 9) && substepOrder === 2) {
    const valid = [
      'READY TRIM', 'READY FOR TRIM CHECK', 'CHIEF READY TRIM',
      'READY FOR TRIM', 'TRIM CHECK READY'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM');
  }

  // TRIM_DISC (Step 10) Substep 2: Trim Disconnected
  if ((step === 'TRIM_DISC' || step === 10) && substepOrder === 2) {
    const valid = [
      'TRIM DISCONNECTED', 'CHIEF TRIM DISCONNECTED', 'TRIM DISC', 'TRIM DISCONNECT'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM DISC');
  }

  // TRIM_CONN (Step 11) Substep 2: Trim Connected
  if ((step === 'TRIM_CONN' || step === 11) && substepOrder === 2) {
    const valid = [
      'TRIM CONNECTED', 'CHIEF TRIM CONNECTED', 'TRIM NORMAL', 'TRIM IN NORM', 'TRIM CONNECT'
    ];
    return valid.includes(phrase) || cmd.includes('TRIM CONN');
  }

  // BIG_MOVEMENTS (Step 12) Substep 1: Clear Big Movements
  if ((step === 'BIG_MOVEMENTS' || step === 12) && substepOrder === 1) {
    const valid = [
      'CLEAR BIG MOVEMENTS', 'CLEAR FOR BIG MOVEMENTS', 'CHIEF CLEAR BIG MOVEMENTS',
      'BIG MOVEMENTS', 'CYCLE CONTROLS', 'WIGGLE SURFACES', 'READY BIG MOVEMENTS'
    ];
    return valid.includes(phrase) || cmd.includes('BIG MOVEMENTS');
  }

  // DBU_CHECK (Step 13) Substep 1: DBU Still Clear
  if ((step === 'DBU_CHECK' || step === 13) && substepOrder === 1) {
    const valid = [
      'DBU STILL CLEAR', 'CHIEF DBU STILL CLEAR', 'DBU CLEAR', 'DIGITAL BACKUP CLEAR'
    ];
    return valid.includes(phrase) || cmd.includes('DBU');
  }

  // LEFT_BRAKE (Step 14) Substep 1: Ready Left Brake
  if ((step === 'LEFT_BRAKE' || step === 14) && substepOrder === 1) {
    const valid = [
      'READY LEFT BRAKE', 'CHIEF READY LEFT BRAKE', 'LEFT BRAKE', 'READY ON THE LEFT BRAKE'
    ];
    return valid.includes(phrase) || cmd.includes('LEFT BRAKE');
  }

  // RIGHT_BRAKE (Step 15) Substep 1: Ready Right Brake
  if ((step === 'RIGHT_BRAKE' || step === 15) && substepOrder === 1) {
    const valid = [
      'READY RIGHT BRAKE', 'CHIEF READY RIGHT BRAKE', 'RIGHT BRAKE', 'READY ON THE RIGHT BRAKE'
    ];
    return valid.includes(phrase) || cmd.includes('RIGHT BRAKE');
  }

  // AAR_DOOR (Step 16) Substep 1: Ready AAR Door
  if ((step === 'AAR_DOOR' || step === 16) && substepOrder === 1) {
    const valid = [
      'READY AAR DOOR', 'CHIEF READY AAR DOOR', 'AAR DOOR CHECK', 'READY AIR REFUEL DOOR', 'AAR DOOR'
    ];
    return valid.includes(phrase) || cmd.includes('AAR');
  }

  // CHOCKS_REMOVAL (Step 17) Substep 2: Remove Chocks
  if ((step === 'CHOCKS_REMOVAL' || step === 17) && substepOrder === 2) {
    const valid = [
      'REMOVE CHOCKS', 'WHEEL CHOCKS', 'REMOVE WHEEL CHOCKS', 'PULL CHOCKS',
      'PULL WHEEL CHOCKS', 'CHOCKS AWAY', 'CHIEF REMOVE CHOCKS'
    ];
    return valid.includes(phrase) || cmd.includes('CHOCKS');
  }

  // FINALE_SALUTE (Step 18) Substep 1: Cleared Off
  if ((step === 'FINALE_SALUTE' || step === 18) && substepOrder === 1) {
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
  currentStepIndex,
  totalSteps,
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

  const resolvedStepIndex =
    currentStepIndex ??
    (activeStep.stepName ? DRILL_STEP_ORDER.indexOf(activeStep.stepName) : activeStep.id);
  const stepCount = totalSteps ?? DRILL_STEP_ORDER.length;
  const currentStepName: DrillStepName =
    activeStep.stepName || DRILL_STEP_ORDER[resolvedStepIndex] || 'ENGAGE_CHIEF';

  const advanceToNextStep = useCallback(() => {
    if (resolvedStepIndex < stepCount - 1) {
      onAdvanceStep(resolvedStepIndex + 1);
    }
  }, [resolvedStepIndex, stepCount, onAdvanceStep]);

  // =========================================================================
  // SIMULATION PROCEDURAL & MECHANICAL STATES
  // =========================================================================
  const [interphoneConnected, setInterphoneConnected] = useState(chiefEngaged);
  const [isChiefResponding, setIsChiefResponding] = useState(false);
  const [chiefDialogue, setChiefDialogue] = useState('');

  // Manage Cockpit Drill Mode: ENGAGE_CHIEF begins in default profile with Chief disengaged so "Engage Chief" is detectable.
  // Silent drill mode and Chief mode are engaged upon speaking "Engage Chief" or when entering Step >= 1.
  useEffect(() => {
    if (currentStepName === 'ENGAGE_CHIEF') {
      Ipc.setCockpitDrillActive(false);
      Ipc.resetCrewChief();
    } else {
      Ipc.engageCrewChief();
      Ipc.setCockpitDrillActive(true);
    }
    return () => {
      Ipc.setCockpitDrillActive(false);
    };
  }, [currentStepName]);

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
  const [trimPitchUpDone, setTrimPitchUpDone] = useState(false);
  const [trimPitchDownDone, setTrimPitchDownDone] = useState(false);
  const [trimRollLeftDone, setTrimRollLeftDone] = useState(false);
  const [trimRollRightDone, setTrimRollRightDone] = useState(false);
  const [trimYawLeftDone, setTrimYawLeftDone] = useState(false);
  const [trimYawRightDone, setTrimYawRightDone] = useState(false);
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
  const mpoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 14 & 15: Brakes (Physical Axis Integration)

  // Step 16: Fuel Panel / AAR Door
  const [airRefuelDoorPos, setAirRefuelDoorPos] = useState<'CLOSE' | 'OPEN'>('CLOSE');

  // Step 17: Chocks Removal
  const [chocksInPlace, setChocksInPlace] = useState(true);

  // Step 18: Finale Salute
  const [finaleSaluteActive, setFinaleSaluteActive] = useState(false);

  // Sync chief engaged state
  useEffect(() => {
    setInterphoneConnected(chiefEngaged);
  }, [chiefEngaged]);

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

  // Step 08 FLCS BIT timer tracking
  const bitTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Step 13 DBU flight control surface audio tracking
  const dbuRollAnnouncedRef = useRef<'left' | 'right' | null>(null);
  const dbuPitchAnnouncedRef = useRef<'up' | 'down' | null>(null);
  const dbuYawAnnouncedRef = useRef<'left' | 'right' | null>(null);
  const dbuControlsCheckedRef = useRef<boolean>(false);

  // Step 14 & 15 Brake pedal movement audio tracking
  const leftBrakeMovedRef = useRef<boolean>(false);
  const leftBrakeIdleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rightBrakeMovedRef = useRef<boolean>(false);
  const rightBrakeIdleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Clear sticky Chief dialogue and response state
    setChiefDialogue('');
    setIsChiefResponding(false);

    // 2. Clear mistake timeouts & active state
    clearMistakeWarning();
    clearMistakeRollback();

    // 3. ENGAGE_CHIEF & ELEC_POWER switch and indicator state synchronization
    if (currentStepName === 'ENGAGE_CHIEF') {
      setElecSwitchPos('OFF');
      setFlcsPwrTestPassed(false);
      setFlcsPwrTestTriggered(false);
      setFlcsPwrTestPos('NORM');
      setIsFlcsPwrTestHeld(false);
    } else if (currentStepName === 'ELEC_POWER') {
      if (currentSubstepIndex === 0) {
        setElecSwitchPos('OFF');
        setFlcsPwrTestPassed(false);
        setFlcsPwrTestTriggered(false);
        setFlcsPwrTestPos('NORM');
        setIsFlcsPwrTestHeld(false);
      } else if (currentSubstepIndex === 1) {
        setElecSwitchPos('MAIN_PWR');
        setFlcsPwrTestPassed(false);
        setFlcsPwrTestTriggered(false);
        setFlcsPwrTestPos('NORM');
        setIsFlcsPwrTestHeld(false);
      } else {
        // Substep 2 and 3: Power test completed & transferred to buses
        setElecSwitchPos('MAIN_PWR');
        setFlcsPwrTestPassed(true);
        setFlcsPwrTestTriggered(true);
        setFlcsPwrTestPos('NORM');
        setIsFlcsPwrTestHeld(false);
      }
    }

    // 4. JFS_START switch position reset when leaving JFS_START or entering JFS_START substep 0/1
    if ((currentStepName === 'JFS_START' && currentSubstepIndex === 0) || (currentStepName === 'JFS_START' && currentSubstepIndex === 1)) {
      setJfsPosition('OFF');
      setJfsRunLit(false);
      setEngContPosition('PRI');
      setTachRpm(0);
      setHydPressA(0);
      setHydPressB(0);
      setFtitDeg(100);
      engineSpoolingRef.current = false;
      setStep2EngineStabilized(false);
    }

    if (currentStepName === 'JFS_START' && currentSubstepIndex === 2) {
      setHydPressA(0);
      setHydPressB(0);
      setFtitDeg(100);
      setTachRpm(25);
      setThrottlePosition('CUTOFF');
      setStep2EngineStabilized(false);
    }

    if (currentStepName === 'JFS_START' && currentSubstepIndex === 3) {
      setTachRpm(25);
      setThrottlePosition('IDLE');
      setStep2EngineStabilized(false);
    }

    // 5. SEC_CHECK & Throttle Spool (73% RPM)
    if (currentStepName === 'SEC_CHECK') {
      setThrottlePosition('IDLE');
      if (currentSubstepIndex === 0) {
        setSecTimerRemaining(30);
      }

      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setTachRpm(63);
        setNozPosPercent(96);
        setEngContPosition('PRI');
        setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
      } else if (currentSubstepIndex === 2) {
        setStep3FlirSrc('/crewchief/FLCS/nozzleOpen.webp');
        setStep3FlirOpen(true);
        setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
      } else if (currentSubstepIndex === 3) {
        setEngContPosition('SEC');
        setNozPosPercent(0);
        setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
      } else if (currentSubstepIndex === 4) {
        setEngContPosition('SEC');
        setNozPosPercent(0);
        setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
        setTachRpm(63);
      } else if (currentSubstepIndex === 5) {
        setEngContPosition('SEC');
        setNozPosPercent(0);
        setStep4ThrottleAngle(THROTTLE_DETENTS['MIL'].angle);
        setTachRpm(75);
      }
    } else {
      setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
    }

    // 6. PRI_VERIFY: SEC mode and closed nozzle when beginning Step 4
    if (currentStepName === 'PRI_VERIFY') {
      setThrottlePosition('IDLE');
      setStep4ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
      setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
      setTachRpm(63);

      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setEngContPosition('SEC');
        setNozPosPercent(0);
      } else {
        setEngContPosition('PRI');
        setNozPosPercent(96);
      }
    }

    // 7. EPU switch position reset when leaving EPU_PIN/EPU_FLOW or entering EPU_FLOW substep 0
    if ((currentStepName !== 'EPU_PIN' && currentStepName !== 'EPU_FLOW') || (currentStepName === 'EPU_FLOW' && currentSubstepIndex === 0)) {
      setEpuSwitch('NORM');
    }

    if (currentStepName === 'EPU_PIN') {
      setThrottlePosition('IDLE');
      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setEpuSwitch('NORM');
        setTachRpm(63);
        setEpuPinRemoved(false);
      } else if (currentSubstepIndex === 2) {
        setEpuSwitch('OFF');
        setEpuPinRemoved(false);
      } else if (currentSubstepIndex === 3) {
        setEpuPinRemoved(true);
      }
    }

    // EPU_FLOW Run-Up Check Throttle Spool (80-85% RPM)
    if (currentStepName === 'EPU_FLOW') {
      setThrottlePosition('IDLE');
      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
        setTachRpm(63);
        setEpuWarningLampsLit(false);
      } else if (currentSubstepIndex === 2) {
        setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
        setTachRpm(63);
        setEpuWarningLampsLit(false);
      } else if (currentSubstepIndex === 3) {
        setStep6ThrottleAngle(2);
        setTachRpm(85);
        setEpuWarningLampsLit(false);
      } else if (currentSubstepIndex === 4) {
        setStep6ThrottleAngle(2);
        setTachRpm(82);
        setEpuWarningLampsLit(true);
      }
    } else {
      setStep6ThrottleAngle(THROTTLE_DETENTS['IDLE'].angle);
    }

    // FLCS_BIT switch and lamp state synchronization
    if (currentStepName !== 'FLCS_BIT') {
      setFlcsBitSwitch(false);
      setFlcsBitActive(false);
      setFlcsBitElapsed(0);
      if (bitTimerRef.current) {
        clearInterval(bitTimerRef.current);
        bitTimerRef.current = null;
      }
    } else {
      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setFlcsBitSwitch(false);
        setFlcsBitActive(false);
        setFlcsBitElapsed(0);
        if (bitTimerRef.current) {
          clearInterval(bitTimerRef.current);
          bitTimerRef.current = null;
        }
      } else if (currentSubstepIndex === 2) {
        setFlcsBitSwitch(true);
        setFlcsBitActive(true);
      } else if (currentSubstepIndex === 3) {
        setFlcsBitSwitch(false);
        setFlcsBitActive(false);
        if (bitTimerRef.current) {
          clearInterval(bitTimerRef.current);
          bitTimerRef.current = null;
        }
      }
    }

    if (currentStepName === 'TRIM_DISC' && currentSubstepIndex === 0) {
      setTrimDiscSwitch(true);
    }

    if (currentStepName === 'TRIM_DISC' && currentSubstepIndex === 1) {
      setTrimDiscSwitch(false);
    }

    if (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 0) {
      setTrimDiscSwitch(false);
    }

    if (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 1) {
      setTrimDiscSwitch(true);
    }

    if (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 2) {
      setTrimPitchUpDone(false);
      setTrimPitchDownDone(false);
      setTrimRollLeftDone(false);
      setTrimRollRightDone(false);
      setTrimYawLeftDone(false);
      setTrimYawRightDone(false);
      setRollTrim(0.0);
      setPitchTrim(0.0);
      setYawTrim(0.0);
      hasAdvancedStep11Ref.current = false;
    }

    if ((currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 0) || (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 1)) {
      setSpeedbrakesOpen(false);
      setSpeedbrakeCycleDone(false);
      setRollLeftDone(false);
      setRollRightDone(false);
      setPitchNoseUpDone(false);
      setPitchNoseDownDone(false);
      setYawLeftDone(false);
      setYawRightDone(false);
      hasAdvancedStep12SubstepRef.current = false;
      if (mpoTimerRef.current) {
        clearTimeout(mpoTimerRef.current);
        mpoTimerRef.current = null;
      }
    }

    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 2) {
      setPitchNoseUpDone(false);
      setPitchNoseDownDone(false);
    }

    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 3) {
      if (mpoTimerRef.current) {
        clearTimeout(mpoTimerRef.current);
        mpoTimerRef.current = null;
      }
    }

    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 4) {
      setYawLeftDone(false);
      setYawRightDone(false);
    }

    // DBU_CHECK switch state synchronization
    if (currentStepName !== 'DBU_CHECK') {
      setDbuSwitchOn(false);
      dbuControlsCheckedRef.current = false;
    } else {
      if (currentSubstepIndex === 0 || currentSubstepIndex === 1) {
        setDbuSwitchOn(false);
        dbuControlsCheckedRef.current = false;
      } else if (currentSubstepIndex === 2 || currentSubstepIndex === 3) {
        setDbuSwitchOn(true);
      }
    }

    // 8. BIG_MOVEMENTS speedbrake cycle, MPO kick, and axis detection states reset
    if (currentStepName !== 'BIG_MOVEMENTS') {
      setSpeedbrakeCycleDone(false);
      setSpeedbrakesOpen(false);
      setMpoKickActive(false);
      if (mpoTimerRef.current) {
        clearTimeout(mpoTimerRef.current);
        mpoTimerRef.current = null;
      }
      setRollLeftDone(false);
      setRollRightDone(false);
      setPitchNoseUpDone(false);
      setPitchNoseDownDone(false);
      setYawLeftDone(false);
      setYawRightDone(false);
      hasAdvancedStep12SubstepRef.current = false;
    } else {
      hasAdvancedStep12SubstepRef.current = false;
      if (currentSubstepIndex !== 0) {
        setSpeedbrakeCycleDone(false);
        setSpeedbrakesOpen(false);
      }
      if (currentSubstepIndex !== 3) {
        setMpoKickActive(false);
        if (mpoTimerRef.current) {
          clearTimeout(mpoTimerRef.current);
          mpoTimerRef.current = null;
        }
      }
    }

    // 9. Brake tracking timers & refs reset
    if (currentStepName !== 'LEFT_BRAKE' || currentSubstepIndex !== 1) {
      leftBrakeMovedRef.current = false;
      if (leftBrakeIdleTimerRef.current) {
        clearTimeout(leftBrakeIdleTimerRef.current);
        leftBrakeIdleTimerRef.current = null;
      }
    }
    if (currentStepName !== 'RIGHT_BRAKE' || currentSubstepIndex !== 1) {
      rightBrakeMovedRef.current = false;
      if (rightBrakeIdleTimerRef.current) {
        clearTimeout(rightBrakeIdleTimerRef.current);
        rightBrakeIdleTimerRef.current = null;
      }
    }

    // 10. AAR_DOOR switch position reset
    if (currentStepName !== 'AAR_DOOR' || currentSubstepIndex === 0) {
      setAirRefuelDoorPos('CLOSE');
    }

    if (currentStepName === 'AAR_DOOR' && currentSubstepIndex === 1) {
      setAirRefuelDoorPos('CLOSE');
    }

    if (currentStepName === 'AAR_DOOR' && currentSubstepIndex === 2) {
      setAirRefuelDoorPos('OPEN');
    }

    // 11. CHOCKS_REMOVAL state reset
    if (currentStepName === 'CHOCKS_REMOVAL' && currentSubstepIndex === 0) {
      setChocksInPlace(true);
    }
  }, [currentStepName, currentSubstepIndex, clearMistakeWarning, clearMistakeRollback]);

  const triggerVerbalAdvance = useCallback((expectedDialogue: string) => {
    Sound.playCommit();
    onConsumeSpeech();

    if (currentStepName === 'ENGAGE_CHIEF') {
      onEngageChief();
      setInterphoneConnected(true);
      Ipc.engageCrewChief();
      Ipc.setCockpitDrillActive(true);
    }

    setIsChiefResponding(true);
    setChiefDialogue(expectedDialogue);

    // CHOCKS_REMOVAL Substep 2: Display chocks-off visual for 2.5s before advancing
    if (currentStepName === 'CHOCKS_REMOVAL' && currentSubstepIndex === 1) {
      setChocksInPlace(false);
      setTimeout(() => {
        setIsChiefResponding(false);
        advanceToNextStep();
      }, 2500);
      return;
    }

    // EPU_PIN: Pull EPU Pin (Multi-sound: "Copy" -> 4000ms delay -> "Clear for run up")
    if (currentStepName === 'EPU_PIN') {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('epu-runup');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else {
          advanceToNextStep();
        }
      }, 5800);
      return;
    }

    // TRIM_DISC: Trim Disconnected (Multi-sound: "Copy" -> 4000ms observation delay -> "Trim no movement")
    if (currentStepName === 'TRIM_DISC') {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('trim-no-movement');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else {
          advanceToNextStep();
        }
      }, 5800);
      return;
    }

    // LEFT_BRAKE: Ready Left Brake (Multi-sound: "Copy" -> 2500ms walk delay -> "Ready left brake")
    if (currentStepName === 'LEFT_BRAKE') {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('ready-left-brake');
      }, 2500);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else {
          advanceToNextStep();
        }
      }, 4200);
      return;
    }

    // RIGHT_BRAKE: Ready Right Brake (Multi-sound: "Copy" -> 2500ms walk delay -> "Ready right brake")
    if (currentStepName === 'RIGHT_BRAKE') {
      Ipc.playDrillSound('copy');
      setTimeout(() => {
        Ipc.playDrillSound('ready-right-brake');
      }, 2500);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else {
          advanceToNextStep();
        }
      }, 4200);
      return;
    }

    // AAR_DOOR: Ready AAR Door (Multi-sound: "Copy standby" -> 4000ms walk delay -> "Refuel door check ready")
    if (currentStepName === 'AAR_DOOR') {
      Ipc.playDrillSound('copy-standby');
      setTimeout(() => {
        Ipc.playDrillSound('refuel-door-ready');
      }, 4000);
      setTimeout(() => {
        setIsChiefResponding(false);
        if (currentSubstepIndex < activeStep.substeps.length - 1) {
          onAdvanceSubstep(currentSubstepIndex + 1);
        } else {
          advanceToNextStep();
        }
      }, 5800);
      return;
    }

    // Authentic FoxVox audio readback triggered in Rust for standard steps
    let advanceDelay = 1800;
    switch (currentStepName) {
      case 'ENGAGE_CHIEF':
        // Native FoxVox profile execution plays start-beep.mp3 on "Engage Crew Chief" when transitioning
        advanceDelay = 1200;
        break;
      case 'ELEC_POWER':
        Ipc.playDrillSound('comms-check');
        advanceDelay = 2000;
        break;
      case 'JFS_START':
        Ipc.playDrillSound('clear-start-two');
        advanceDelay = 2000;
        break;
      case 'SEC_CHECK':
        Ipc.playDrillSound('clear-sec');
        advanceDelay = 2200;
        break;
      case 'PRI_VERIFY':
      case 'TRIM_CONN':
        Ipc.playDrillSound('copy');
        advanceDelay = 1800;
        break;
      case 'EPU_FLOW':
        Ipc.playDrillSound('no-flow');
        advanceDelay = 2000;
        break;
      case 'FLIGHT_CONTROLS_CLEAR':
        Ipc.playDrillSound('controls-clear');
        advanceDelay = 2200;
        break;
      case 'FLCS_BIT':
        Ipc.playDrillSound('cleared-for-bit');
        advanceDelay = 2000;
        break;
      case 'TRIM_VERIFY':
        Ipc.playDrillSound('ready-trim');
        advanceDelay = 2000;
        break;
      case 'BIG_MOVEMENTS':
      case 'DBU_CHECK':
        Ipc.playDrillSound('controls-still-clear');
        advanceDelay = 2200;
        break;
      case 'CHOCKS_REMOVAL':
        // Intentionally empty per user directive
        advanceDelay = 1200;
        break;
      case 'FINALE_SALUTE':
        Ipc.playDrillSound('cleared-off');
        advanceDelay = 3500;
        break;
    }

    setTimeout(() => {
      setIsChiefResponding(false);
      if (currentSubstepIndex < activeStep.substeps.length - 1) {
        onAdvanceSubstep(currentSubstepIndex + 1);
      } else {
        advanceToNextStep();
      }
    }, advanceDelay);
  }, [currentStepName, activeStep, currentSubstepIndex, onAdvanceSubstep, advanceToNextStep, onConsumeSpeech, onEngageChief]);

  useEffect(() => {
    if (!lastSpeech.phrase || lastSpeech.status !== 'VERIFIED') return;
    if (lastSpeech.id === lastProcessedSpeechIdRef.current) return;

    // Pilot acknowledgment: ELEC_POWER Substep 4 ("Loud and clear" or continue)
    if (currentStepName === 'ELEC_POWER' && currentSubstepIndex === 3) {
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
        onAdvanceSubstep(4);
        return;
      }
    }

    // ELEC_POWER Substep 5: How's Chief (phaseType: 'ACTION')
    if (currentStepName === 'ELEC_POWER' && currentSubstepIndex === 4) {
      const p = lastSpeech.phrase.toUpperCase();
      const c = (lastSpeech.command || '').toUpperCase();
      const valid = [
        "HOW'S CHIEF DOING", "HOW'S CHIEF", "HOW IS CHIEF", "HOW ARE YOU DOING",
        "HOW YOU DOING", "HOW YOU DOING CHIEF", "HOW'S IT GOING", "WHAT'S HAPPENING",
        "HOW ARE YOU", "HOWS CHIEF DOING", "HOWS CHIEF", "WHATS HAPPENING", "HOWS IT GOING"
      ];
      if (
        valid.includes(p) ||
        p.includes("HOW'S CHIEF") ||
        p.includes("HOWS CHIEF") ||
        p.includes("HOW YOU DOING") ||
        p.includes("HOW ARE YOU") ||
        c.includes("HOW'S CHIEF") ||
        c.includes("HOWS CHIEF") ||
        c.includes("HOW'S") ||
        c.includes("HOWS")
      ) {
        lastProcessedSpeechIdRef.current = lastSpeech.id;
        Sound.playCommit();
        onConsumeSpeech();
        Ipc.playDrillSound('hows-chief');
        setIsChiefResponding(true);
        setChiefDialogue("Doin' good! How you doing?");
        setTimeout(() => {
          setIsChiefResponding(false);
          advanceToNextStep();
        }, 2500);
        return;
      }
    }

    // Non-verbal phases: silently ignore
    if (activeSubstep?.phaseType !== 'VERBAL') {
      return;
    }

    const isMatch = matchSubstepPhrase(
      currentStepName,
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
    currentStepName,
    activeStep,
    activeSubstep,
    currentSubstepIndex,
    advanceToNextStep,
    onConsumeSpeech,
    triggerVerbalAdvance,
    onAdvanceSubstep,
  ]);

  // =========================================================================
  // STEP 01: ELEC PANEL LIGHT MATRIX & FLCS TEST HOLD
  // =========================================================================
  const elecPanelLights = useMemo<ElecPanelLights>(() => {
    if (currentStepName !== 'ENGAGE_CHIEF' && currentStepName !== 'ELEC_POWER') {
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
  }, [currentStepName, elecSwitchPos, isFlcsPwrTestHeld, flcsPwrTestPassed, epuWarningLampsLit]);

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
          if (currentStepName === 'ELEC_POWER' && currentSubstepIndex === 1) {
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
    if (pos === 'START 1' && currentStepName === 'JFS_START' && currentSubstepIndex === 1) {
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
            if (currentStepName === 'JFS_START' && currentSubstepIndex === 1) {
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
    // FTIT: 120°C -> 650°C -> 550°C
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

      // 2. FTIT progression: rise to 650°C over first 35 ticks, then settle to 550°C over next 40 ticks
      if (tick <= 35) {
        curTemp += (650 - 120) / 35;
      } else if (tick <= 75) {
        curTemp -= (650 - 550) / 40;
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

  // Ensure JFS switch is OFF when not in JFS_START
  useEffect(() => {
    if (currentStepName !== 'JFS_START') {
      setJfsPosition('OFF');
      setJfsRunLit(false);
    }
  }, [currentStepName]);

  // =========================================================================
  // STEP 03: 30-SECOND COUNTDOWN & SEC NOZZLE OVERLAY
  // =========================================================================
  useEffect(() => {
    if (currentStepName !== 'SEC_CHECK' || currentSubstepIndex !== 0) return;
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
  }, [currentStepName, currentSubstepIndex, onAdvanceSubstep]);

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
        if (currentStepName === 'SEC_CHECK') {
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
        if (currentStepName === 'PRI_VERIFY') {
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
    if (pos === 'ON' && currentStepName === 'EPU_PIN' && currentSubstepIndex === 1) {
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

    if (pos === 'OFF' && currentStepName === 'EPU_PIN' && currentSubstepIndex === 1) {
      clearMistakeWarning();
      clearMistakeRollback();
      Sound.playCommit();
      onAdvanceSubstep(2);
    } else if (pos === 'NORM' && currentStepName === 'EPU_PIN' && currentSubstepIndex === 3) {
      clearMistakeWarning();
      clearMistakeRollback();
      Sound.playCommit();
      advanceToNextStep();
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
      if (currentStepName === 'EPU_FLOW' && currentSubstepIndex === 3) {
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
    if (currentStepName !== 'FLIGHT_CONTROLS_CLEAR') {
      setControlWarmupRemaining(20);
      setStep7CardVisible(true);
    }
  }, [currentStepName]);

  useEffect(() => {
    if (currentStepName !== 'FLIGHT_CONTROLS_CLEAR' || currentSubstepIndex !== 2) return;

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
  }, [currentStepName, currentSubstepIndex]);

  // =========================================================================
  // STEP 08: FLCS BIT (15-SECOND VIDEO PLAYBACK IN FLIR OVERLAY)
  // =========================================================================
  const handleTriggerFlcsBit = () => {
    Sound.playSwitch();
    Sound.playCommit();
    setFlcsBitSwitch(true);
    setFlcsBitActive(true);
    setFlcsBitElapsed(0);
    onAdvanceSubstep(2);
  };

  // Step 08 Substep 3: 15-Second Hands-off BIT Surface Sweep Timer
  useEffect(() => {
    if (currentStepName !== 'FLCS_BIT' || currentSubstepIndex !== 2) {
      if (bitTimerRef.current) {
        clearInterval(bitTimerRef.current);
        bitTimerRef.current = null;
      }
      return;
    }

    setFlcsBitSwitch(true);
    setFlcsBitActive(true);
    setFlcsBitElapsed(0);

    bitTimerRef.current = setInterval(() => {
      setFlcsBitElapsed((prev) => {
        const next = prev + 1;
        if (next >= 15) {
          if (bitTimerRef.current) {
            clearInterval(bitTimerRef.current);
            bitTimerRef.current = null;
          }
          setFlcsBitActive(false);
          setFlcsBitSwitch(false);
          Sound.playSwitch();
          Sound.playCommit();
          onAdvanceSubstep(3);
          return 15;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (bitTimerRef.current) {
        clearInterval(bitTimerRef.current);
        bitTimerRef.current = null;
      }
    };
  }, [currentStepName, currentSubstepIndex, onAdvanceSubstep]);

  // =========================================================================
  // STEP 09 - 11: MANUAL TRIM PANEL & WHEEL RE-CENTERING
  // =========================================================================
  const isTrimsCentered = useMemo(() => {
    return Math.abs(rollTrim) <= 0.2 && Math.abs(pitchTrim) <= 0.2 && Math.abs(yawTrim) <= 0.2;
  }, [rollTrim, pitchTrim, yawTrim]);

  // Reset Step 11 trim checks when leaving Step 11
  useEffect(() => {
    if (currentStepName !== 'TRIM_CONN') {
      setTrimPitchUpDone(false);
      setTrimPitchDownDone(false);
      setTrimRollLeftDone(false);
      setTrimRollRightDone(false);
      setTrimYawLeftDone(false);
      setTrimYawRightDone(false);
    }
  }, [currentStepName]);

  // Step 11 Substep 2: User-driven 6-Axis Trim Deflection Checks (Past 1.0 or -1.0)
  useEffect(() => {
    if (currentStepName !== 'TRIM_CONN' || currentSubstepIndex !== 2) return;

    if (pitchTrim <= -1.0 && !trimPitchUpDone) {
      setTrimPitchUpDone(true);
      Ipc.playDrillSound('trim-nose-up');
    }
    if (pitchTrim >= 1.0 && !trimPitchDownDone) {
      setTrimPitchDownDone(true);
      Ipc.playDrillSound('trim-nose-down');
    }
    if (rollTrim <= -1.0 && !trimRollLeftDone) {
      setTrimRollLeftDone(true);
      Ipc.playDrillSound('trim-roll-left');
    }
    if (rollTrim >= 1.0 && !trimRollRightDone) {
      setTrimRollRightDone(true);
      Ipc.playDrillSound('trim-roll-right');
    }
    if (yawTrim <= -1.0 && !trimYawLeftDone) {
      setTrimYawLeftDone(true);
      Ipc.playDrillSound('trim-yaw-left');
    }
    if (yawTrim >= 1.0 && !trimYawRightDone) {
      setTrimYawRightDone(true);
      Ipc.playDrillSound('trim-yaw-right');
    }
  }, [
    currentStepName,
    currentSubstepIndex,
    pitchTrim,
    rollTrim,
    yawTrim,
    trimPitchUpDone,
    trimPitchDownDone,
    trimRollLeftDone,
    trimRollRightDone,
    trimYawLeftDone,
    trimYawRightDone,
  ]);

  // Step 11 Substep 2 Advance: When all 6 axes are verified, proceed directly to centering step
  useEffect(() => {
    if (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 2) {
      if (
        trimPitchUpDone &&
        trimPitchDownDone &&
        trimRollLeftDone &&
        trimRollRightDone &&
        trimYawLeftDone &&
        trimYawRightDone
      ) {
        const t = setTimeout(() => {
          onAdvanceSubstep(3);
        }, 800);
        return () => clearTimeout(t);
      }
    }
  }, [
    currentStepName,
    currentSubstepIndex,
    trimPitchUpDone,
    trimPitchDownDone,
    trimRollLeftDone,
    trimRollRightDone,
    trimYawLeftDone,
    trimYawRightDone,
    onAdvanceSubstep,
  ]);

  // Advance to next step when all trims re-centered
  useEffect(() => {
    if (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 3) {
      if (isTrimsCentered && !hasAdvancedStep11Ref.current) {
        hasAdvancedStep11Ref.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          advanceToNextStep();
        }, 500);
        return () => clearTimeout(t);
      }
    } else {
      hasAdvancedStep11Ref.current = false;
    }
  }, [currentStepName, currentSubstepIndex, isTrimsCentered, advanceToNextStep]);

  // Step 12 Substep 2: Roll Axis Detection (20% deflection from neutral: <0.40 or >0.60; order does not matter)
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 1) {
      if (rollDisplay < 0.40 && !rollLeftDone) {
        setRollLeftDone(true);
        Ipc.playDrillSound('big-roll-left');
      }
      if (rollDisplay > 0.60 && !rollRightDone) {
        setRollRightDone(true);
        Ipc.playDrillSound('big-roll-right');
      }
    }
  }, [currentStepName, currentSubstepIndex, rollDisplay, rollLeftDone, rollRightDone]);

  // Step 12 Substep 2 Advance: Trigger when both roll directions completed
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 1 && rollLeftDone && rollRightDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(2);
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [currentStepName, currentSubstepIndex, rollLeftDone, rollRightDone, onAdvanceSubstep]);

  // Step 12 Substep 3: Pitch Axis Detection (20% deflection: Strict order: Nose Up >0.60 first, then Nose Down <0.40)
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 2) {
      if (pitchDisplay > 0.60 && !pitchNoseUpDone) {
        setPitchNoseUpDone(true);
        Ipc.playDrillSound('big-nose-up');
      }
      if (pitchNoseUpDone && pitchDisplay < 0.40 && !pitchNoseDownDone) {
        setPitchNoseDownDone(true);
        Ipc.playDrillSound('big-nose-down');
      }
    }
  }, [currentStepName, currentSubstepIndex, pitchDisplay, pitchNoseUpDone, pitchNoseDownDone]);

  // Step 12 Substep 3 Advance: Trigger when Nose Down reached after Nose Up
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 2 && pitchNoseUpDone && pitchNoseDownDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(3); // Advance to MPO while stick is held nose down
        }, 400);
        return () => clearTimeout(t);
      }
    }
  }, [currentStepName, currentSubstepIndex, pitchNoseUpDone, pitchNoseDownDone, onAdvanceSubstep]);

  // Step 12 Substep 4: MPO Detection (DirectInput hardware binding or simulate)
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 3) {
      if (telemetry.mpo_active && !hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        Ipc.playDrillSound('mpo-kick');
        setMpoKickActive(true);
        if (mpoTimerRef.current) clearTimeout(mpoTimerRef.current);
        mpoTimerRef.current = setTimeout(() => {
          mpoTimerRef.current = null;
          setMpoKickActive(false);
          onAdvanceSubstep(4);
        }, 600);
      }
    }
  }, [currentStepName, currentSubstepIndex, telemetry.mpo_active, onAdvanceSubstep]);

  // Step 12 Substep 5: Yaw Axis Detection (20% deflection from neutral: <0.40 or >0.60; order does not matter)
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 4) {
      if (yawDisplay < 0.40 && !yawLeftDone) {
        setYawLeftDone(true);
        Ipc.playDrillSound('big-yaw-left');
      }
      if (yawDisplay > 0.60 && !yawRightDone) {
        setYawRightDone(true);
        Ipc.playDrillSound('big-yaw-right');
      }
    }
  }, [currentStepName, currentSubstepIndex, yawDisplay, yawLeftDone, yawRightDone]);

  // Step 12 Substep 5 Advance: Trigger when both rudder directions completed
  useEffect(() => {
    if (currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 4 && yawLeftDone && yawRightDone) {
      if (!hasAdvancedStep12SubstepRef.current) {
        hasAdvancedStep12SubstepRef.current = true;
        Sound.playCommit();
        const t = setTimeout(() => {
          onAdvanceSubstep(5); // Advance to Substep 6: Speedbrakes
        }, 500);
        return () => clearTimeout(t);
      }
    }
  }, [currentStepName, currentSubstepIndex, yawLeftDone, yawRightDone, onAdvanceSubstep]);

  // =========================================================================
  // STEP 12 & 13: DYNAMIC FLIR SURFACE RESPONSE & SPEEDBRAKES & DBU
  // =========================================================================
  const dynamicFlirInfo = useMemo<{ src: string; label: string }>(() => {
    if (speedbrakesOpen) {
      return { src: '/crewchief/FLCS/spdBrakes.webp', label: 'SPEEDBRAKES OPEN' };
    }
    if ((currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 3 && telemetry.mpo_active) || mpoKickActive) {
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
  }, [currentStepName, currentSubstepIndex, speedbrakesOpen, telemetry.mpo_active, mpoKickActive, rollDisplay, pitchDisplay, yawDisplay]);

  // Unified FLIR overlay state across all training scenes
  const flirOverlayState = useMemo(() => {
    if (currentStepName === 'SEC_CHECK' || currentStepName === 'PRI_VERIFY') {
      return {
        isOpen: step3FlirOpen,
        src: step3FlirSrc,
        targetLabel: 'EXHAUST NOZZLE',
        alt: 'Engine Nozzle Petals',
      };
    }
    if (currentStepName === 'FLCS_BIT') {
      return {
        isOpen: flcsBitActive,
        src: '/crewchief/BIT.mp4',
        targetLabel: 'FLCS SURFACE SWEEP',
        alt: 'FLCS BIT Automated Surface Sweep',
      };
    }
    if (currentStepName === 'BIG_MOVEMENTS' || currentStepName === 'DBU_CHECK') {
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
  }, [currentStepName, step3FlirOpen, step3FlirSrc, flcsBitActive, dynamicFlirInfo]);

  // Top-Right Cockpit Locator Overlay: Programmatically driven by cockpitLocatorConfig
  const locatorConfig = useMemo(() => {
    return getCockpitLocatorConfig(currentStepName, currentSubstepIndex);
  }, [currentStepName, currentSubstepIndex]);

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
        advanceToNextStep(); // Proceed to next step (DBU)
      }, 800);
    }
  };

  // Step 13: Digital Backup Switch Toggle
  const handleToggleDbu = (val: boolean) => {
    Sound.playSwitch();
    setDbuSwitchOn(val);
    if (currentStepName === 'DBU_CHECK') {
      if (currentSubstepIndex === 1 && val) {
        // Substep 13-2: Switched to ON -> advance to Substep 13-3
        Sound.playCommit();
        onAdvanceSubstep(2);
      } else if (currentSubstepIndex === 3 && !val) {
        // Substep 13-4: Switched to OFF -> advance to next step
        Sound.playCommit();
        setTimeout(() => {
          advanceToNextStep();
        }, 800);
      }
    }
  };

  // Step 13: Flight stick & rudder movement audio callouts during Digital Backup Check
  useEffect(() => {
    if (currentStepName !== 'DBU_CHECK' || !dbuSwitchOn) {
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

    // Step 13 Substep 3: Detect flight stick or rudder movement in hardware
    if (currentSubstepIndex === 2 && !dbuControlsCheckedRef.current) {
      const isDeflected =
        Math.abs(rollDisplay - 0.5) > 0.15 ||
        Math.abs(pitchDisplay - 0.5) > 0.15 ||
        Math.abs(yawDisplay - 0.5) > 0.15;
      if (isDeflected) {
        dbuControlsCheckedRef.current = true;
        Sound.playCommit();
        setChiefDialogue('[Chief announces the surface deflections]');
        setIsChiefResponding(true);
        setTimeout(() => {
          setIsChiefResponding(false);
          onAdvanceSubstep(3);
        }, 1200);
      }
    }
  }, [currentStepName, currentSubstepIndex, dbuSwitchOn, rollDisplay, pitchDisplay, yawDisplay, onAdvanceSubstep]);

  // =========================================================================
  // STEP 14 & 15: PHYSICAL BRAKE PEDAL INTEGRATION (MOVEMENT & IDLE DETECTION)
  // =========================================================================
  useEffect(() => {
    if (currentStepName === 'LEFT_BRAKE' && currentSubstepIndex === 1) {
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
      } else {
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
    }

    if (currentStepName === 'RIGHT_BRAKE' && currentSubstepIndex === 1) {
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
      } else {
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
    }
    if (currentStepName === 'SEC_CHECK' && currentSubstepIndex === 3) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(4);
      }
    }
    if (currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 3) {
      if (leftBrakeDeflection <= 0.15 && rightBrakeDeflection <= 0.15) {
        Sound.playCommit();
        advanceToNextStep();
      }
    }
    if (currentStepName === 'EPU_FLOW' && currentSubstepIndex === 1) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(2);
      }
    }
    if (currentStepName === 'EPU_FLOW' && currentSubstepIndex === 5) {
      if (leftBrakeDeflection <= 0.15 && rightBrakeDeflection <= 0.15) {
        Sound.playCommit();
        advanceToNextStep();
      }
    }
    if (currentStepName === 'CHOCKS_REMOVAL' && currentSubstepIndex === 0) {
      if (leftBrakeDeflection >= 0.15 && rightBrakeDeflection >= 0.15) {
        Sound.playCommit();
        onAdvanceSubstep(1);
      }
    }
  }, [currentStepName, currentSubstepIndex, leftBrakeDeflection, rightBrakeDeflection, onAdvanceSubstep, advanceToNextStep]);

  // =========================================================================
  // STEP 16: FUEL PANEL / AAR DOOR CYCLE
  // =========================================================================
  const handleAarSwitchChange = (pos: any) => {
    Sound.playSwitch();
    setAirRefuelDoorPos(pos);
    if (currentStepName === 'AAR_DOOR') {
      if (pos === 'OPEN' && currentSubstepIndex === 1) {
        Sound.playCommit();
        Ipc.playDrillSound('aar-door-open');
        onAdvanceSubstep(2);
      } else if (pos === 'CLOSE' && currentSubstepIndex >= 2) {
        Sound.playCommit();
        Ipc.playDrillSound('aar-door-closed');
        setTimeout(() => {
          advanceToNextStep();
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
            {currentStepName === 'ENGAGE_CHIEF' && (
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
            {/* PANEL: Solotürk Crew Chief Interphone (Step 1 Substep 5) */}
            {/* -------------------------------------------------------- */}
            {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 4 && (
              <motion.div
                key="panel-crew-chief-soloturk"
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
                  src="/crewchief/soloturk.webp"
                  alt="Crew Chief Solotürk"
                  title="CREW CHIEF // SOLOTÜRK"
                  badge="INTERPHONE COMM"
                  badgeColor="#38bdf8"
                  badgeBg="rgba(56, 189, 248, 0.15)"
                  badgeBorder="rgba(56, 189, 248, 0.4)"
                  caption="GROUND INTERPHONE // HOW'S CHIEF"
                  footerRight="SOLOTURK-01"
                  width={540}
                  aspectRatio="video"
                  priority
                />

                <div className="flex flex-col items-center gap-2 mt-4 font-mono">
                  <p className="text-[11px] text-zinc-400 text-center max-w-md font-sans">
                    Ground interphone verified. Inquire &quot;How&apos;s chief doing&quot; over the loop before commencing turbine start.
                  </p>
                </div>
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: TEST Panel (Step 1, Step 6-3)                     */}
            {/* -------------------------------------------------------- */}
            {((currentStepName === 'ELEC_POWER' && currentSubstepIndex < 4) || (currentStepName === 'EPU_FLOW' && currentSubstepIndex === 3)) && (
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
                  {currentStepName === 'EPU_FLOW' ? 'TEST PANEL (HOLD EPU/GEN)' : 'TEST PANEL (LEFT CONSOLE)'}
                </span>
                <TestPanel
                  switches={
                    currentStepName === 'EPU_FLOW'
                      ? { epuGen: epuGenSwitchHeld }
                      : { flcsPwrTest: flcsPwrTestPos }
                  }
                  onSwitchChange={handleTestPanelSwitchChange}
                  lights={
                    currentStepName === 'EPU_FLOW'
                      ? epuAirLightLit ? { a: true, b: true, c: true, d: true } : {}
                      : flcsTestLights
                  }
                  allowSwitchClick={
                    currentStepName === 'EPU_FLOW'
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
            {((currentStepName === 'ELEC_POWER' && currentSubstepIndex < 4) || (currentStepName === 'EPU_FLOW' && (currentSubstepIndex === 3 || currentSubstepIndex === 4))) && (
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
                  {currentStepName === 'EPU_FLOW' ? 'ELEC POWER PANEL (EPU GEN & PMG LAMPS)' : 'ELEC POWER PANEL (RIGHT CONSOLE)'}
                </span>
                <ElecPowerPanel
                  switchPosition={currentStepName === 'EPU_FLOW' ? 'MAIN_PWR' : elecSwitchPos}
                  onSwitchChange={(pos) => {
                    if (currentStepName === 'ELEC_POWER' && currentSubstepIndex === 0) {
                      Sound.playSwitch();
                      setElecSwitchPos(pos);
                      if (pos === 'MAIN_PWR') {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      }
                    }
                  }}
                  lights={elecPanelLights}
                  allowSwitchClick={currentStepName === 'ELEC_POWER' ? { mainPwr: currentSubstepIndex === 0 } : false}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: ENG & JET START Panel (Step 2 Substeps 0 & 1, Step 3, Step 4) */}
            {/* -------------------------------------------------------- */}
            {((currentStepName === 'JFS_START' && currentSubstepIndex < 2) || currentStepName === 'SEC_CHECK' || currentStepName === 'PRI_VERIFY') && (
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
                      currentStepName === 'JFS_START' &&
                      currentSubstepIndex === 1 &&
                      jfsPosition === 'OFF' &&
                      !isMistakeRollingBack,
                    engContSwitch:
                      (currentStepName === 'SEC_CHECK' && currentSubstepIndex === 2 && engContPosition === 'PRI') ||
                      (currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 1 && engContPosition === 'SEC'),
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: Throttle Quadrant (Step 2-3+, Step 3-4+, Step 6-2 & 6-4) */}
            {/* -------------------------------------------------------- */}
            {((currentStepName === 'JFS_START' && currentSubstepIndex >= 2) ||
              (currentStepName === 'SEC_CHECK' && currentSubstepIndex >= 4) ||
              (currentStepName === 'EPU_FLOW' && (currentSubstepIndex === 2 || currentSubstepIndex === 4))) && (
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
                  {currentStepName === 'JFS_START'
                    ? 'THROTTLE (CUTOFF ➔ IDLE)'
                    : currentStepName === 'SEC_CHECK'
                    ? currentSubstepIndex === 5
                      ? 'THROTTLE (RETARD TO IDLE)'
                      : 'THROTTLE (SPOOL TO 73% RPM)'
                    : currentSubstepIndex === 4
                    ? 'THROTTLE (RETARD TO IDLE)'
                    : 'THROTTLE (SPOOL TO 82% RPM)'}
                </span>
                {currentStepName === 'JFS_START' ? (
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
                ) : currentStepName === 'SEC_CHECK' ? (
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
                          advanceToNextStep();
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
                          advanceToNextStep();
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
            {(currentStepName === 'JFS_START' || currentStepName === 'SEC_CHECK' || currentStepName === 'PRI_VERIFY' || (currentStepName === 'EPU_FLOW' && currentSubstepIndex >= 2)) && (
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
            {currentStepName === 'JFS_START' && currentSubstepIndex >= 2 && (
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
            {currentStepName === 'JFS_START' && currentSubstepIndex >= 2 && (
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
            {(currentStepName === 'SEC_CHECK' || currentStepName === 'PRI_VERIFY') && (
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
            {(currentStepName === 'EPU_PIN' || (currentStepName === 'EPU_FLOW' && currentSubstepIndex <= 3)) && (
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
                      currentStepName === 'EPU_PIN' &&
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
            {currentStepName === 'EPU_PIN' && currentSubstepIndex < 3 && (
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
            {currentStepName === 'FLIGHT_CONTROLS_CLEAR' && currentSubstepIndex < 2 && step7CardVisible && (
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
            {/* CARD: Modernized FLCS Deflection Monitor (Step 7, 12, 13) */}
            {/* -------------------------------------------------------- */}
            {(currentStepName === 'FLIGHT_CONTROLS_CLEAR' || currentStepName === 'BIG_MOVEMENTS' || currentStepName === 'DBU_CHECK') && (
              <motion.div
                key="card-flcs-deflection"
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
              >
                <TacticalControlInputCard
                  title={currentStepName === 'FLIGHT_CONTROLS_CLEAR' ? 'FLCS // SURFACE DEFLECTION' : 'FLCS // DEFLECTION MONITOR'}
                  roll={rollDisplay}
                  pitch={pitchDisplay}
                  yaw={yawDisplay}
                  leftBrake={leftBrakeDeflection}
                  rightBrake={rightBrakeDeflection}
                  showGimbal={true}
                  showBrakes={false}
                  width={270}
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: FLT CONTROL Panel (Step 8: BIT, Step 13: DBU)     */}
            {/* -------------------------------------------------------- */}
            {(currentStepName === 'FLCS_BIT' || currentStepName === 'DBU_CHECK') && (
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
                  {currentStepName === 'FLCS_BIT' ? 'FLT CONTROL PANEL (FLCS BIT)' : 'FLT CONTROL PANEL (DBU)'}
                </span>
                <FltControlPanel
                  switches={
                    currentStepName === 'FLCS_BIT'
                      ? { bit: flcsBitSwitch }
                      : { digitalBackup: dbuSwitchOn }
                  }
                  onSwitchChange={(key, val) => {
                    if (currentStepName === 'FLCS_BIT' && key === 'bit' && !flcsBitActive) {
                      handleTriggerFlcsBit();
                    } else if (currentStepName === 'DBU_CHECK' && key === 'digitalBackup') {
                      handleToggleDbu(val);
                    }
                  }}
                  lights={currentStepName === 'FLCS_BIT' ? { run: flcsBitActive } : undefined}
                  allowSwitchClick={{
                    bit: currentStepName === 'FLCS_BIT' && currentSubstepIndex === 1 && !flcsBitActive,
                    digitalBackup: currentStepName === 'DBU_CHECK' && (currentSubstepIndex === 1 || currentSubstepIndex === 3),
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: MANUAL TRIM Panel (Step 9, 10, 11)                */}
            {/* -------------------------------------------------------- */}
            {(currentStepName === 'TRIM_VERIFY' || currentStepName === 'TRIM_DISC' || currentStepName === 'TRIM_CONN') && (
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
                      if (val === false && currentStepName === 'TRIM_DISC' && currentSubstepIndex === 0) {
                        Sound.playCommit();
                        onAdvanceSubstep(1);
                      } else if (val === true && currentStepName === 'TRIM_CONN' && currentSubstepIndex === 0) {
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
                    trimDisc: (currentStepName === 'TRIM_DISC' && currentSubstepIndex === 0) || (currentStepName === 'TRIM_CONN' && currentSubstepIndex === 0),
                    rollTrim: currentStepName === 'TRIM_CONN' && (currentSubstepIndex === 2 || currentSubstepIndex === 3),
                    pitchTrim: currentStepName === 'TRIM_CONN' && (currentSubstepIndex === 2 || currentSubstepIndex === 3),
                    yawTrim: currentStepName === 'TRIM_CONN' && (currentSubstepIndex === 2 || currentSubstepIndex === 3),
                  }}
                  className="scale-95"
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: MANUAL PITCH OVRD (MPO) (Step 12)                 */}
            {/* -------------------------------------------------------- */}
            {currentStepName === 'BIG_MOVEMENTS' && (
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
                  isOvrd={telemetry.mpo_active || mpoKickActive}
                  allowSwitchClick={currentSubstepIndex === 3}
                  onOvrdChange={(val) => {
                    if (val && currentSubstepIndex === 3 && !hasAdvancedStep12SubstepRef.current) {
                      hasAdvancedStep12SubstepRef.current = true;
                      Sound.playCommit();
                      Ipc.playDrillSound('mpo-kick');
                      setMpoKickActive(true);
                      setTimeout(() => {
                        setMpoKickActive(false);
                        onAdvanceSubstep(4);
                      }, 600);
                    }
                  }}
                />
                {currentSubstepIndex === 3 && (
                  <button
                    onClick={() => {
                      Sound.playCommit();
                      Ipc.playDrillSound('mpo-kick');
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
            {(currentStepName === 'BIG_MOVEMENTS' || currentStepName === 'DBU_CHECK') && (
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
                  interactive={currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 5 && !speedbrakeCycleDone}
                  onToggle={handleToggleSpeedbrakes}
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* CARD: Main Gear Brake Calipers & Deflection (Step 14 & 15) */}
            {/* -------------------------------------------------------- */}
            {(currentStepName === 'LEFT_BRAKE' || currentStepName === 'RIGHT_BRAKE') && (
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
                className="flex flex-col lg:flex-row items-center justify-center gap-6"
              >
                <TacticalDisplayCard
                  src={currentStepName === 'LEFT_BRAKE' ? '/crewchief/FLCS/leftBrake.webp' : '/crewchief/FLCS/rightBrake.webp'}
                  alt={currentStepName === 'LEFT_BRAKE' ? 'Left Main Gear Brake Caliper' : 'Right Main Gear Brake Caliper'}
                  title={currentStepName === 'LEFT_BRAKE' ? 'LEFT MAIN GEAR BRAKE CALIPER' : 'RIGHT MAIN GEAR BRAKE CALIPER'}
                  badge="HYDRAULIC LINE"
                  badgeColor="#22c55e"
                  badgeBg="rgba(34, 197, 94, 0.15)"
                  badgeBorder="rgba(34, 197, 94, 0.4)"
                  caption="OBSERVE BRAKE CLAMPING ACTION"
                  width={380}
                  aspectRatio="video"
                />

                <TacticalControlInputCard
                  title={currentStepName === 'LEFT_BRAKE' ? 'BRAKES // LEFT BRAKE CHECK' : 'BRAKES // RIGHT BRAKE CHECK'}
                  roll={rollDisplay}
                  pitch={pitchDisplay}
                  yaw={yawDisplay}
                  leftBrake={leftBrakeDeflection}
                  rightBrake={rightBrakeDeflection}
                  showGimbal={false}
                  showBrakes={true}
                  width={270}
                />
              </motion.div>
            )}

            {/* -------------------------------------------------------- */}
            {/* PANEL: FUEL SYSTEM Panel (Step 16)                       */}
            {/* -------------------------------------------------------- */}
            {currentStepName === 'AAR_DOOR' && (
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
            {currentStepName === 'CHOCKS_REMOVAL' && (
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
            {currentStepName === 'FINALE_SALUTE' && currentSubstepIndex === 0 && (
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
            {currentStepName === 'FINALE_SALUTE' && currentSubstepIndex >= 1 && (
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
        {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 0 && (
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
        {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 3 && (
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
        {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 4 && (
          <div className="w-full max-w-xl p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2 mt-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>PROCEDURAL NOTE:</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed font-sans">
              Normally, the EPU GEN and EPU PMG caution lights illuminate when the EPU/GEN switch is held below 82% RPM. In this training environment, the sequence is verified sequentially before retarding to idle.
            </p>
            <button
              onClick={() => onAdvanceSubstep(5)}
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
        {!(currentStepName === 'FINALE_SALUTE' && currentSubstepIndex >= 1) && (
          <div className="w-full max-w-3xl p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-center text-xs overflow-hidden mt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`banner-${currentStepName}-${currentSubstepIndex}-${step2EngineStabilized}-${flcsBitActive}-${chocksInPlace}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.18 }}
                style={{ willChange: 'opacity, transform' }}
              >
                {/* Step 0 Banner */}
                {currentStepName === 'ENGAGE_CHIEF' && (
                  <span className="text-emerald-400 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Verbal Required: Speak &quot;Engage Chief&quot; into microphone.</span>
                  </span>
                )}

                {/* Step 1 Banner */}
                {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set MAIN PWR switch to MAIN PWR position on the ELEC panel.
                  </span>
                )}
                {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 1 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Click and hold FLCS PWR TEST switch to TEST on the TEST panel.
                  </span>
                )}
                {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 2 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Comms Check&quot; over the ground interphone loop.</span>
                  </span>
                )}
                {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-emerald-400 font-bold">
                      Chief Responded: &quot;Loud and clear, sir/ma&apos;am.&quot; Speak &quot;Loud and clear&quot; to acknowledge.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(4);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {currentStepName === 'ELEC_POWER' && currentSubstepIndex === 4 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                      <span>Action Required: Inquire &quot;How&apos;s chief doing&quot;.</span>
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        Ipc.playDrillSound('hows-chief');
                        setIsChiefResponding(true);
                        setChiefDialogue("Oh, I'm alright, how you doin' sir?");
                        setTimeout(() => {
                          setIsChiefResponding(false);
                          advanceToNextStep();
                        }, 2500);
                      }}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 2 Banner */}
                {currentStepName === 'JFS_START' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready Start Two&quot; to clear ground personnel.</span>
                  </span>
                )}
                {currentStepName === 'JFS_START' && currentSubstepIndex === 1 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Set JFS switch to START 2. Await JFS RUN light and spool past 20% RPM.
                  </span>
                )}
                {currentStepName === 'JFS_START' && currentSubstepIndex >= 2 && !step2EngineStabilized && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Advance throttle over cutoff detent to IDLE. Observe FTIT climb and HYD pressure.
                  </span>
                )}
                {currentStepName === 'JFS_START' && step2EngineStabilized && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Engine stabilized at idle (63% RPM, 550°C FTIT, 3,000 PSI Hyd A/B).
                    </span>
                    <button
                      onClick={() => advanceToNextStep()}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 3 Banner */}
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 0 && (
                  <span className="text-amber-300 font-bold">
                    ⏳ Engine warm-up in progress. Await stabilization timer or click Skip.
                  </span>
                )}
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear for SEC check&quot;.</span>
                  </span>
                )}
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Flip ENG CONT switch to SEC. Observe nozzle close to 0%.
                  </span>
                )}
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 3 && (
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
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 4 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Click or advance throttle forward to spool engine to 73% RPM minimum.
                  </span>
                )}
                {currentStepName === 'SEC_CHECK' && currentSubstepIndex === 5 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Click or retard throttle back to IDLE. Observe nozzle remain closed (&lt; 5%).
                  </span>
                )}

                {/* Step 4 Banner */}
                {currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;SEC check good&quot; to coordinate with crew chief.</span>
                  </span>
                )}
                {currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Snap ENG CONT switch back to PRI and seat red safety guard down.
                  </span>
                )}
                {currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Convergent nozzle opened to 100%. Engine electronic control restored to PRI.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        onAdvanceSubstep(3);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {currentStepName === 'PRI_VERIFY' && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-cyan-300 font-bold">
                      ⚡ Action Required: Release toe brakes.
                    </span>
                    <button
                        onClick={() => {
                          Sound.playCommit();
                          advanceToNextStep();
                        }}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                      >
                        <span>Continue</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                )}

                {/* Step 5 Banner */}
                {currentStepName === 'EPU_PIN' && currentSubstepIndex === 0 && (
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
                {currentStepName === 'EPU_PIN' && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set EPU switch to OFF on EPU panel.
                  </span>
                )}
                {currentStepName === 'EPU_PIN' && currentSubstepIndex === 2 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Pull EPU safety pin&quot; to ground crew.</span>
                  </span>
                )}
                {currentStepName === 'EPU_PIN' && currentSubstepIndex === 3 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set EPU switch back to NORM.
                  </span>
                )}

                {/* Step 6 Banner */}
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Cleared to check for flow&quot;.</span>
                  </span>
                )}
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 1 && (
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
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Advance throttle forward to ~82% RPM to generate bleed air for EPU.
                  </span>
                )}
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 3 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Action Required: Click and hold EPU/GEN switch on TEST panel for 5 seconds.
                  </span>
                )}
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 4 && (
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
                {currentStepName === 'EPU_FLOW' && currentSubstepIndex === 5 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-cyan-300 font-bold">
                      ⚡ Action Required: Release toe brakes.
                    </span>
                    <button
                        onClick={() => {
                          Sound.playCommit();
                          advanceToNextStep();
                        }}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                      >
                        <span>Continue</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                )}

                {/* Step 7 Banner */}
                {currentStepName === 'FLIGHT_CONTROLS_CLEAR' && currentSubstepIndex === 0 && (
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
                {currentStepName === 'FLIGHT_CONTROLS_CLEAR' && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Flight Controls Clear&quot; to ground crew.</span>
                  </span>
                )}
                {currentStepName === 'FLIGHT_CONTROLS_CLEAR' && currentSubstepIndex === 2 && (
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
                      onClick={() => advanceToNextStep()}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 8 Banner */}
                {currentStepName === 'FLCS_BIT' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear BIT&quot;.</span>
                  </span>
                )}
                {currentStepName === 'FLCS_BIT' && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Toggle BIT switch to initiate FLCS surface sweep (Note: In simulator/jet takes 45s; condensed to 15s in drill).
                  </span>
                )}
                {currentStepName === 'FLCS_BIT' && currentSubstepIndex === 2 && (
                  <span className="text-amber-400 font-bold animate-pulse">
                    FLCS BIT IN PROGRESS — SURFACE DEFLECTION RECORDING ({15 - flcsBitElapsed}s remaining • 45s on simulator/jet)
                  </span>
                )}
                {currentStepName === 'FLCS_BIT' && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-zinc-300 font-bold text-xs">
                      ✓ FLCS BIT switch released to OFF • Green RUN light extinguished • Amber FAIL light remains dark.
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        advanceToNextStep();
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 9-11 Banners */}
                {currentStepName === 'TRIM_VERIFY' && currentSubstepIndex === 0 && (
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
                {currentStepName === 'TRIM_VERIFY' && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready for trim check&quot;.</span>
                  </span>
                )}
                {currentStepName === 'TRIM_DISC' && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set TRIM / AP DISC switch to DISC.
                  </span>
                )}
                {currentStepName === 'TRIM_DISC' && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Disconnected&quot;.</span>
                  </span>
                )}
                {currentStepName === 'TRIM_DISC' && currentSubstepIndex >= 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-300 font-bold">
                      Chief confirmed: &quot;No trim movement observed, disconnect confirmed.&quot;
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        advanceToNextStep();
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {currentStepName === 'TRIM_CONN' && currentSubstepIndex === 0 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set TRIM / AP DISC switch back to NORM.
                  </span>
                )}
                {currentStepName === 'TRIM_CONN' && currentSubstepIndex === 1 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Connected&quot;.</span>
                  </span>
                )}
                {currentStepName === 'TRIM_CONN' && currentSubstepIndex === 2 && (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-cyan-300 font-bold">
                      ⚡ Slew pitch, roll, and yaw trim dials past ±1.0 to verify each axis deflection.
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-mono mt-1">
                      <span className={`px-2 py-0.5 rounded border ${trimPitchUpDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        PITCH UP {trimPitchUpDone ? '✓' : '(-1.0)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${trimPitchDownDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        PITCH DN {trimPitchDownDone ? '✓' : '(+1.0)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${trimRollLeftDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        ROLL L {trimRollLeftDone ? '✓' : '(-1.0)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${trimRollRightDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        ROLL R {trimRollRightDone ? '✓' : '(+1.0)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${trimYawLeftDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        YAW L {trimYawLeftDone ? '✓' : '(-1.0)'}
                      </span>
                      <span className={`px-2 py-0.5 rounded border ${trimYawRightDone ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold' : 'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>
                        YAW R {trimYawRightDone ? '✓' : '(+1.0)'}
                      </span>
                    </div>
                  </div>
                )}
                {currentStepName === 'TRIM_CONN' && currentSubstepIndex === 3 && (
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
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Clear big movements&quot;.</span>
                  </span>
                )}
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 1 && (
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
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 2 && (
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
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 3 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-cyan-300 font-bold">
                      ⚡ While holding Nose Down, actuate physical MPO switch on throttle (or simulate/skip):
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        Ipc.playDrillSound('mpo-kick');
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
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 4 && (
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
                {currentStepName === 'BIG_MOVEMENTS' && currentSubstepIndex === 5 && (
                  <span className="text-amber-300 font-bold">
                    ⚡ Click Speedbrake indicator to cycle petals OPEN, then click again to CLOSE.
                  </span>
                )}

                {/* Step 13 Banner */}
                {currentStepName === 'DBU_CHECK' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;DBU Still Clear&quot; to ground crew.</span>
                  </span>
                )}
                {currentStepName === 'DBU_CHECK' && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Lift safety guard and flip DIGITAL BACKUP switch to ON.
                  </span>
                )}
                {currentStepName === 'DBU_CHECK' && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-cyan-300 font-bold text-xs">
                      ⚡ Action Required: Deflect stick or rudder pedals to verify surface response in DBU law:
                    </span>
                    <button
                      onClick={() => {
                        Sound.playCommit();
                        setChiefDialogue('[Chief announces the surface deflection]');
                        setIsChiefResponding(true);
                        setTimeout(() => {
                          setIsChiefResponding(false);
                          onAdvanceSubstep(3);
                        }, 1200);
                      }}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                {currentStepName === 'DBU_CHECK' && currentSubstepIndex === 3 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Flip DIGITAL BACKUP switch to OFF and lower safety guard flush down.
                  </span>
                )}

                {/* Step 14 & 15 Banner */}
                {(currentStepName === 'LEFT_BRAKE' || currentStepName === 'RIGHT_BRAKE') && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;{currentStepName === 'LEFT_BRAKE' ? 'Ready on the left brake' : 'Ready on the right brake'}&quot;.</span>
                  </span>
                )}
                {(currentStepName === 'LEFT_BRAKE' || currentStepName === 'RIGHT_BRAKE') && currentSubstepIndex === 1 && (
                  <div className="flex items-center justify-between gap-4 w-full">
                    <span className="text-amber-300 font-bold text-xs">
                      ⚡ Action Required: Press and release the {currentStepName === 'LEFT_BRAKE' ? 'left' : 'right'} toe brake pedal.
                    </span>
                    <button
                      onClick={() => advanceToNextStep()}
                      className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold text-xs cursor-pointer shadow transition-[background-color] shrink-0"
                    >
                      SKIP BRAKE
                    </button>
                  </div>
                )}
                {(currentStepName === 'LEFT_BRAKE' || currentStepName === 'RIGHT_BRAKE') && currentSubstepIndex === 2 && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Caliper clamping verified good.
                    </span>
                    <button
                      onClick={() => advanceToNextStep()}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs cursor-pointer shadow transition-[background-color] flex items-center gap-1.5 shrink-0"
                    >
                      <span>Continue</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Step 16 Banner */}
                {currentStepName === 'AAR_DOOR' && currentSubstepIndex === 0 && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Ready for AAR door check&quot;.</span>
                  </span>
                )}
                {currentStepName === 'AAR_DOOR' && currentSubstepIndex === 1 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Set AIR REFUEL switch to OPEN on FUEL panel.
                  </span>
                )}
                {currentStepName === 'AAR_DOOR' && currentSubstepIndex >= 2 && (
                  <span className="text-cyan-300 font-bold">
                    ⚡ Action Required: Return AIR REFUEL switch to CLOSE on FUEL panel.
                  </span>
                )}

                {/* Step 17 Banner */}
                {currentStepName === 'CHOCKS_REMOVAL' && currentSubstepIndex === 0 && (
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
                {currentStepName === 'CHOCKS_REMOVAL' && currentSubstepIndex === 1 && chocksInPlace && (
                  <span className="text-emerald-300 font-bold inline-flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                    <span>Verbal Required: Transmit &quot;Remove Chocks&quot; (or &quot;Wheel Chocks&quot;).</span>
                  </span>
                )}
                {currentStepName === 'CHOCKS_REMOVAL' && !chocksInPlace && (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-emerald-400 font-bold">
                      ✓ Chocks removed and stowed in equipment bay. Proceeding to marshal salute...
                    </span>
                  </div>
                )}

                {/* Step 18 Banner */}
                {currentStepName === 'FINALE_SALUTE' && currentSubstepIndex === 0 && (
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
            key={`${currentStepName}-${currentSubstepIndex}-dir`}
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
              key={`${currentStepName}-${currentSubstepIndex}-callout`}
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
              key={`${currentStepName}-${currentSubstepIndex}-action`}
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
              key={`${currentStepName}-${currentSubstepIndex}-verify`}
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
              key={`${currentStepName}-${currentSubstepIndex}-rx`}
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
              key={`${currentStepName}-${currentSubstepIndex}-rationale`}
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
