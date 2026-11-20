

export interface InteractiveControlDef {
  type: 'MOCK_SWITCH' | 'MOCK_BUTTON' | 'AXIS_MONITOR' | 'VOICE_CALLOUT' | 'VERIFICATION' | 'TIMER_COUNTDOWN';
  switchPositions?: string[];
  targetPosition?: string;
  axisChannel?: 'pitch' | 'roll' | 'yaw' | 'left_brake' | 'right_brake' | 'mpo';
  axisThreshold?: number;
  durationSeconds?: number;
  label: string;
  actionPrompt: string;
}

export interface StepSubstep {
  id: string;
  order: number;
  label: string;
  phaseType: 'ACTION' | 'VERBAL' | 'EXPECT' | 'VERIFY';
  description: string;
  cockpitPanel: string;
  visualCue: string;
  interactiveControl?: InteractiveControlDef;
  expectedChiefResponse?: string;
  rationale?: string;
}

export interface CockpitVisualTarget {
  panelName: string;
  subSystem: string;
  focalControls: string[];
}

export type DrillStepName =
  | 'ENGAGE_CHIEF'
  | 'ELEC_POWER'
  | 'JFS_START'
  | 'SEC_CHECK'
  | 'PRI_VERIFY'
  | 'EPU_PIN'
  | 'EPU_FLOW'
  | 'FLIGHT_CONTROLS_CLEAR'
  | 'FLCS_BIT'
  | 'TRIM_VERIFY'
  | 'TRIM_DISC'
  | 'TRIM_CONN'
  | 'BIG_MOVEMENTS'
  | 'DBU_CHECK'
  | 'LEFT_BRAKE'
  | 'RIGHT_BRAKE'
  | 'LEFT_BRAKE_CHAN2'
  | 'RIGHT_BRAKE_CHAN2'
  | 'AAR_DOOR'
  | 'CHOCKS_REMOVAL'
  | 'FINALE_SALUTE';

export interface RampStartStep {
  id: number;
  stepName?: DrillStepName;
  code: string;
  title: string;
  phase: 'PRE_START' | 'ENGINE_START' | 'SECONDARY_POWER' | 'FLIGHT_CONTROLS' | 'TAXI_CLEAR';
  whatHappenedLast: string;
  whatToPerformNow: string;
  whatToExpectNext: string;
  cockpitVisual: CockpitVisualTarget;
  pilotSpokenCalls: {
    primary: string;
    prefixVariants: string[];
    synonyms: string[];
  };
  expectedChiefResponse: string;
  substeps: StepSubstep[];
  engineParameters?: {
    throttleState?: string;
    targetRpm?: string;
    nozzlePosition?: string;
    checklistCautions?: string[];
  };
}

export const RAMP_START_STEPS: RampStartStep[] = [
  // =========================================================================
  // STEP 00: INTERPHONE CONNECTION & ENGAGE CREW CHIEF
  // =========================================================================
  {
    id: 0,
    stepName: 'ENGAGE_CHIEF',
    code: 'STEP-00',
    title: 'Interphone Connection & Engage Crew Chief',
    phase: 'PRE_START',
    whatHappenedLast: 'Canopy cracked open. Pilot strapped into ACES II ejection seat with electrical systems cold & dark.',
    whatToPerformNow: 'Open ground interphone comms to the crew chief standing beside the left forward fuselage.',
    whatToExpectNext: 'Headset chime sounds; Chief confirms interphone hot-mic circuit is established.',
    cockpitVisual: {
      panelName: 'LEFT FORWARD FUSELAGE / CANOPY SILL',
      subSystem: 'External Ground Interphone Receptacle',
      focalControls: ['Interphone Receptacle Door', 'Ground Headset Cord', 'Canopy Left Sill']
    },
    pilotSpokenCalls: {
      primary: 'Engage Chief',
      prefixVariants: ['Engage Crew Chief', 'Start Chief', 'Start Crew Chief', 'Turn On Chief'],
      synonyms: ['Engage Crew Chief', 'Enable Chief', 'Begin Chief']
    },
    expectedChiefResponse: '[Interphone acoustic link active, a beep will sound.]',
    substeps: [
      {
        id: '0-1',
        order: 1,
        label: 'Ground Interphone Hot-Mic Keying',
        phaseType: 'VERBAL',
        description: 'Initiate communication with the crew chief. Speak the voice trigger into the microphone.',
        cockpitPanel: 'External Fuselage / Canopy Left Sill',
        visualCue: 'External interphone circuit closed; hot-mic intercom link verified with ground personnel.',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT TRIGGER',
          actionPrompt: 'Speak "Engage Chief" or accepted variations into your microphone'
        },
        expectedChiefResponse: "[Interphone acoustic link active, a beep will sound.]",
        rationale: "Establishes a dedicated hardwired interphone circuit with the ground crew before energizing aircraft buses."
      }
    ]
  },

  // =========================================================================
  // STEP 01: COMMS & AUDIO CHECK
  // =========================================================================
  {
    id: 1,
    stepName: 'ELEC_POWER',
    code: 'STEP-01',
    title: 'Comms & Audio Check',
    phase: 'PRE_START',
    whatHappenedLast: 'Crew Chief acknowledged interphone link. Aircraft battery bus ready for energization.',
    whatToPerformNow: 'Set MAIN PWR switch to MAIN PWR, verify generator and FLCS caution lamps, then transmit Comms Check.',
    whatToExpectNext: 'You will contact with the Crew Chief after energising the aircraft.',
    cockpitVisual: {
      panelName: 'RIGHT FORWARD CONSOLE / ELEC PANEL',
      subSystem: 'Electrical Power Distribution & Audio 1',
      focalControls: ['MAIN PWR Switch', 'MAIN PWR Guard', 'MAIN GEN Lamp', 'STBY GEN Lamp']
    },
    pilotSpokenCalls: {
      primary: 'Comms Check',
      prefixVariants: ['Radio Check', 'Chief Comms Check', 'Crew Chief Comms Check'],
      synonyms: ['Comms Check']
    },
    expectedChiefResponse: 'Loud and clear, sir/ma\'am.',
    substeps: [
      {
        id: '1-1',
        order: 1,
        label: 'MAIN PWR Switch to MAIN PWR',
        phaseType: 'ACTION',
        description: 'Set MAIN PWR switch to MAIN PWR on the Electrical Power Panel.',
        cockpitPanel: 'Right Forward Console / ELEC Panel',
        visualCue: 'MAIN GEN, STBY GEN, and FLCS RLY lamps illuminate.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'BATT', 'MAIN PWR'],
          targetPosition: 'MAIN PWR',
          label: 'MAIN PWR SWITCH',
          actionPrompt: 'Set MAIN PWR switch to MAIN PWR position'
        },
        rationale: "Powers main aircraft battery and generator buses to energize cockpit instruments and radios."
      },
      {
        id: '1-2',
        order: 2,
        label: 'FLCS Power Test (TEST Panel)',
        phaseType: 'ACTION',
        description: 'Select and hold the FLCS PWR TEST switch to TEST on the TEST panel. Verify ABCD annunciators illuminate and ELEC panel lights transfer.',
        cockpitPanel: 'Left Console / TEST Panel',
        visualCue: 'A, B, C, D lamps illuminate green. On ELEC panel: FLCS RLY turns off; TO FLCS and FLCS PMG illuminate.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['MAINT', 'NORM', 'TEST'],
          targetPosition: 'TEST',
          label: 'FLCS PWR TEST',
          actionPrompt: 'Hold FLCS PWR TEST switch in TEST position'
        },
        rationale: "Verifies quadruplex flight control power supplies and battery backup circuits prior to engine start."
      },
      {
        id: '1-3',
        order: 3,
        label: 'Ground Interphone Comms Check',
        phaseType: 'VERBAL',
        description: 'Verify audio transmission clarity with the Crew Chief over the ground interphone line.',
        cockpitPanel: 'Left Console / AUDIO 1 Panel',
        visualCue: 'Ground intercom voice transmission received 5x5 loud and clear.',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT COMMS CHECK',
          actionPrompt: 'Speak "Comms Check" into your microphone'
        },
        expectedChiefResponse: "Loud and clear, sir/ma'am.",
        rationale: "Confirms two-way interphone voice fidelity between cockpit and ground crew."
      },
      {
        id: '1-4',
        order: 4,
        label: 'Pilot Acknowledgment / Continue',
        phaseType: 'ACTION',
        description: 'Chief confirmed loud and clear. Speak "Loud and clear" into microphone to acknowledge, or click Continue to proceed to How\'s Chief.',
        cockpitPanel: 'Left Console / AUDIO 1 Panel',
        visualCue: 'Ground interphone comms positive; Chief standing by for JFS start callout.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'CONTINUE TO HOW\'S CHIEF',
          actionPrompt: 'Speak "Loud and clear" or click Continue'
        },
        expectedChiefResponse: "[Standing by for JFS start callout.]",
        rationale: "Confirms positive two-way comms before commencing turbine start sequence."
      },
      {
        id: '1-5',
        order: 5,
        label: "Ground Interphone Check (How's Chief)",
        phaseType: 'ACTION',
        description: "Inquire after the Crew Chief over the ground interphone line to verify conversational fidelity before turbine start.",
        cockpitPanel: 'Left Console / AUDIO 1 Panel',
        visualCue: 'Interphone conversational fidelity confirmed with Crew Chief.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'CONTINUE TO STEP 02',
          actionPrompt: 'Speak "How\'s chief doing" or click Continue'
        },
        expectedChiefResponse: "Doin' good! How you doing?",
        rationale: "Confirms positive two-way comms and chief operational status before commencing turbine start sequence."
      }
    ]
  },

  // =========================================================================
  // STEP 02: READY START TWO (JFS LIGHT-OFF & ENGINE SPOOL)
  // =========================================================================
  {
    id: 2,
    stepName: 'JFS_START',
    code: 'STEP-02',
    title: 'Ready Start Two (JFS Light-Off & Core Spool)',
    phase: 'ENGINE_START',
    whatHappenedLast: 'Comms verified 5x5. Electrical buses energized; JFS hydraulic accumulators reading 3,000 PSI.',
    whatToPerformNow: 'Warn chief ("Start Two"), flip JFS switch to START 2, monitor JFS RUN lamp, and introduce fuel at 20% RPM.',
    whatToExpectNext: 'Chief responds: "Clear for Start Two." At 20% RPM, advance throttle to IDLE. Engine accelerates to 65% RPM.',
    cockpitVisual: {
      panelName: 'LEFT AUX CONSOLE & CENTER PEDESTAL',
      subSystem: 'Jet Fuel Starter (JFS) & Engine Tachometer',
      focalControls: ['JFS Switch (START 2)', 'JFS RUN Light', 'Throttle Cutoff Detent', 'Tachometer Gauge', 'FTIT Gauge']
    },
    pilotSpokenCalls: {
      primary: 'Ready Start Two',
      prefixVariants: ['Ready Start Two', 'Chief Start Two', 'Clear Start Two'],
      synonyms: ['Start Two']
    },
    expectedChiefResponse: 'Clear for Start Two. (Spool to 20% RPM, throttle to IDLE).',
    engineParameters: {
      throttleState: 'IDLE (detent lifted at 20% RPM)',
      targetRpm: '65% RPM (Idle)',
      nozzlePosition: '100% (Open)',
      checklistCautions: [
        'CRITICAL: Do NOT move the canopy while JFS is running — depletes accumulator hydraulic pressure/fuel and causes start abort!',
        'Do NOT advance throttle below 20% RPM (risk of severe hot start or tailpipe fire).',
        'Monitor FTIT: must not exceed 650°C during start.'
      ]
    },
    substeps: [
      {
        id: '2-1',
        order: 1,
        label: 'Turbine Hazard Briefing & Start Authorization',
        phaseType: 'VERBAL',
        description: 'Speak "Ready Start Two" to request JFS start clearance from the Chief.',
        cockpitPanel: 'Left Aux Console / ENG & JET START',
        visualCue: 'Engine intake and exhaust danger zones clear of ground personnel; Chief confirms "Clear for Start Two."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'START TWO CALLOUT',
          actionPrompt: 'Speak "Start Two" into your microphone'
        }
      ,
        expectedChiefResponse: "Clear for Start Two.",
        rationale: "Ensures intake and exhaust hazard zones are clear of personnel and equipment before JFS ignition."
      },
      {
        id: '2-2',
        order: 2,
        label: 'JFS START 2 Switch Actuation',
        phaseType: 'ACTION',
        description: 'Snap the spring-loaded JFS switch to START 2. Both hydraulic accumulators discharge to spool the starter.',
        cockpitPanel: 'Left Aux Console / ENG & JET START',
        visualCue: 'JFS ACCUM 1 & 2 drop from 3,000 to 500 PSI; green JFS RUN lamp illuminates solid.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['START 1', 'OFF', 'START 2'],
          targetPosition: 'START 2',
          label: 'JFS SWITCH',
          actionPrompt: 'Click switch to snap to START 2'
        }
      ,
        rationale: "Discharges both hydraulic accumulators through hydraulic start motor to crank the Jet Fuel Starter turbine."
      },
      {
        id: '2-3',
        order: 3,
        label: 'Core Spool to 20% RPM Minimum',
        phaseType: 'EXPECT',
        description: 'Observe engine core accelerating. Do NOT introduce fuel before achieving 20% RPM core speed.',
        cockpitPanel: 'Center Pedestal / Engine Cluster',
        visualCue: 'RPM needle sweeps smoothly: 0% -> 12% -> 15% -> 20% RPM.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RPM ACCELERATING',
          actionPrompt: 'Verify core speed reaches 20% RPM minimum'
        }
      ,
        rationale: "Introducing fuel below 20% RPM risks a hot start or tailpipe fire due to insufficient compressor airflow."
      },
      {
        id: '2-4',
        order: 4,
        label: 'Fuel Introduction (Throttle Detent to IDLE)',
        phaseType: 'ACTION',
        description: 'Lift the throttle cutoff finger-lift latch and push the throttle grip over the detent into IDLE.',
        cockpitPanel: 'Left Console / Throttle Quadrant',
        visualCue: 'Throttle grip seats forward in IDLE; FTIT needle rises smoothly toward 550°C.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'LIFT DETENT & ADVANCE IDLE',
          actionPrompt: 'Click finger-lift to move throttle to IDLE'
        }
      ,
        rationale: "Advances fuel flow valve past cutoff into idle metering schedule to begin light-off in the combustion chambers."
      },
      {
        id: '2-5',
        order: 5,
        label: 'Idle Stabilization & Self-Sustain Verification',
        phaseType: 'VERIFY',
        description: 'Verify engine self-sustains: RPM settles at 65%, HYD A & B reach 3,000 PSI, OIL pressure > 15 PSI. JFS RUN lamp turns off.',
        cockpitPanel: 'Center Pedestal & Warning Panels',
        visualCue: 'JFS RUN lamp extinguishes at 50% RPM; MAIN GEN caution lamp extinguishes at 55% RPM.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'IDLE STABLE',
          actionPrompt: 'Verify engine idle parameters stabilized'
        }
      ,
        rationale: "Confirms engine has reached self-sustaining idle speed (65-70% RPM) and hydraulic pumps have pressurized."
      }
    ]
  },

  // =========================================================================
  // STEP 03: SECONDARY ENGINE CONTROL (SEC) CHECK & SPOOL
  // =========================================================================
  {
    id: 3,
    stepName: 'SEC_CHECK',
    code: 'STEP-03',
    title: 'Secondary Engine Control (SEC) Check & Spool',
    phase: 'ENGINE_START',
    whatHappenedLast: 'Engine stabilized in primary IDLE. Ready for hydromechanical fuel governing check.',
    whatToPerformNow: 'Wait 30s in idle, hold toe brakes, request SEC check ("Clear SEC"), set ENG CONT to SEC, confirm nozzle closes, and spool to 73% RPM.',
    whatToExpectNext: 'Chief calls: "Ready for SEC check." Nozzle closes < 5%. Engine accelerates linearly to 73% RPM minimum in SEC mode.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (ENG & JET START) & PEDESTAL',
      subSystem: 'Digital Engine Electronic Control / Backup Hydromechanical Unit',
      focalControls: ['ENG CONT Switch (SEC)', 'ENG CONT Guard', 'SEC Caution Lamp (Left Eyebrow)', 'NOZZLE Position Indicator', 'Toe Brakes']
    },
    pilotSpokenCalls: {
      primary: 'Clear SEC',
      prefixVariants: ['Clear for SEC Check', 'Ready for SEC Check', 'Ready SEC', 'Clear for SEC'],
      synonyms: ['Clear S E C', 'Ready S E C']
    },
    expectedChiefResponse: 'Ready for SEC check. (Nozzle closes < 5%; spool to 73% RPM minimum).',
    engineParameters: {
      throttleState: 'Spool forward to 73% RPM minimum, then retard to IDLE',
      targetRpm: '73%–80% RPM (Spool check in SEC)',
      nozzlePosition: '< 5% (Closed in SEC mode)',
      checklistCautions: [
        'DASH-1 MANDATE: Engine must remain in IDLE for at least 30 seconds before switching to SEC.',
        'HOLD TOE BRAKES FIRMLY: Increasing throttle to 73% RPM requires full brake hold.',
        'Nozzle MUST close < 5% in SEC. Do not fly if nozzle fails to close in SEC.'
      ]
    },
    substeps: [
      {
        id: '3-1',
        order: 1,
        label: '30-Second IDLE Stabilization Requirement',
        phaseType: 'VERIFY',
        description: 'Dash-1 mandates engine must remain in IDLE for at least 30 seconds before selecting SEC to allow hydraulic and oil pressures to equilibrate.',
        cockpitPanel: 'Center Pedestal / Engine Instruments',
        visualCue: 'Engine stabilized at idle for 30 seconds; bearing temperatures and oil pressure equilibrated.',
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 30,
          label: '30S IDLE TIMER',
          actionPrompt: 'Wait 30 seconds in idle before SEC check'
        }
      ,
        rationale: "Stabilizing at idle for 30s allows bearing temperatures and lube oil pressure to equilibrate before mode switch."
      },
      {
        id: '3-2',
        order: 2,
        label: 'Toe Brake Hold & SEC Authorization Callout',
        phaseType: 'VERBAL',
        description: 'Depress toe brakes firmly to hold aircraft. Speak "Clear SEC" to coordinate the check with the Chief.',
        cockpitPanel: 'Rudder Footwell & Intercom',
        visualCue: 'Differential toe brake pedals depressed firmly; aircraft held stationary against idle thrust.',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEAR SEC CALLOUT',
          actionPrompt: 'Hold brakes and speak "Clear SEC"'
        }
      ,
        expectedChiefResponse: "Ready for SEC check.",
        rationale: "Alerts ground crew prior to manual nozzle closure and engine power surge during SEC test."
      },
      {
        id: '3-3',
        order: 3,
        label: 'ENG CONT Switch to SEC & Nozzle Closure',
        phaseType: 'ACTION',
        description: 'Lift the red safety guard on the Left Console Engine Panel and flip the ENG CONT switch from PRI to SEC.',
        cockpitPanel: 'Left Console / ENG & JET START Panel',
        visualCue: 'Amber SEC caution lamp illuminates on Left Eyebrow; NOZZLE % pointer drops from 100% to < 5%.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['PRI', 'SEC'],
          targetPosition: 'SEC',
          label: 'ENG CONT SWITCH',
          actionPrompt: 'Lift guard and flip ENG CONT switch to SEC'
        },
        rationale: "Transfers fuel metering from Digital Electronic Engine Control (DEEC) to hydromechanical backup governor."
      },
      {
        id: '3-4',
        order: 4,
        label: 'Mandatory Toe Brakes Hold',
        phaseType: 'ACTION',
        description: 'Depress both toe brake pedals firmly to ensure aircraft remains stationary prior to advancing throttle to 73% RPM.',
        cockpitPanel: 'Rudder Footwell (Toe Brakes)',
        visualCue: 'Both toe brake pedals held firmly depressed to prevent aircraft forward creep.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES HELD',
          actionPrompt: 'Hold toe brakes firmly'
        },
        rationale: "Holding toe brakes prevents aircraft rolling forward when advancing engine throttle above idle."
      },
      {
        id: '3-5',
        order: 5,
        label: 'Hydromechanical Fuel Spool to 73% RPM Minimum',
        phaseType: 'ACTION',
        description: 'Hold toe brakes firmly. Advance throttle forward until Tachometer reaches ≥ 73% RPM to verify hydromechanical fuel control.',
        cockpitPanel: 'Left Console (Throttle) & Center Pedestal',
        visualCue: 'Tachometer sweeps past 73% RPM target arc without hesitation or surging.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'ADVANCE THROTTLE TO 73%',
          actionPrompt: 'Advance throttle to verify 73% RPM spool'
        },
        rationale: "Verifies hydromechanical governor accelerates the core linearly and maintains flameout margin."
      },
      {
        id: '3-6',
        order: 6,
        label: 'Retard to IDLE & Closed Nozzle Verification',
        phaseType: 'VERIFY',
        description: 'Retard throttle back to IDLE. Verify engine returns smoothly to idle speed and NOZZLE needle remains tightly closed at < 5%.',
        cockpitPanel: 'Left Console (Throttle) & Center Pedestal',
        visualCue: 'RPM settles back to 65%; NOZZLE needle rests at < 5%.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'SEC IDLE CONFIRMED',
          actionPrompt: 'Retard throttle to IDLE and verify nozzle closed'
        },
        rationale: "Confirms engine retards cleanly back to idle and nozzle stays closed (< 5%) under hydromechanical scheduling."
      }
    ]
  },

  // =========================================================================
  // STEP 04: SEC CHECK GOOD & PRIMARY (PRI) RECOVERY
  // =========================================================================
  {
    id: 4,
    stepName: 'PRI_VERIFY',
    code: 'STEP-04',
    title: 'SEC Check Good & Primary (PRI) Recovery',
    phase: 'ENGINE_START',
    whatHappenedLast: 'Hydromechanical fuel spool to 73% verified. Nozzle verified tightly closed in SEC idle.',
    whatToPerformNow: 'Transmit "SEC Good", switch ENG CONT back to PRI, close guard, and confirm nozzle opens to 100%.',
    whatToExpectNext: 'Chief acknowledges: "Copy." SEC lamp turns off. Nozzle blooms wide open to 100% with air motor sound.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (ENG & JET START) & PEDESTAL',
      subSystem: 'Engine Digital Electronic Control (DEC/EEC)',
      focalControls: ['ENG CONT Switch (PRI)', 'ENG CONT Guard (Down)', 'SEC Caution Lamp (Extinguished)', 'NOZZLE Position Indicator (100%)']
    },
    pilotSpokenCalls: {
      primary: 'SEC Good',
      prefixVariants: ['SEC Check Good', 'S E C Good', 'Chief SEC Good', 'SEC Check Complete'],
      synonyms: ['SEC Pass', 'SEC OK']
    },
    expectedChiefResponse: 'Copy. (Switch to PRI; nozzle opens to 100%).',
    engineParameters: {
      throttleState: 'IDLE',
      targetRpm: '65% RPM',
      nozzlePosition: '100% (Open in PRI idle)'
    },
    substeps: [
      {
        id: '4-1',
        order: 1,
        label: 'Verbal Transmission "SEC Good"',
        phaseType: 'VERBAL',
        description: 'Inform the crew chief that the SEC check is good while still in SEC mode. Speak "SEC Good".',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Pilot transmits SEC Good; Chief acknowledges "Copy."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT SEC GOOD',
          actionPrompt: 'Speak "SEC Good" into your microphone'
        }
      ,
        expectedChiefResponse: "Copy.",
        rationale: "Confirms hydromechanical backup check passed before returning to primary digital engine control."
      },
      {
        id: '4-2',
        order: 2,
        label: 'Revert ENG CONT to PRI & Lower Guard',
        phaseType: 'ACTION',
        description: 'Snap the ENG CONT toggle switch back to PRI on the Left Console and seat the red mechanical safety guard flush DOWN.',
        cockpitPanel: 'Left Console / ENG & JET START Panel',
        visualCue: 'ENG CONT switch seated in PRI and guard lowered flush; amber SEC caution lamp extinguishes on Left Eyebrow.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['PRI', 'SEC'],
          targetPosition: 'PRI',
          label: 'ENG CONT SWITCH',
          actionPrompt: 'Set switch to PRI and lower guard'
        }
      ,
        rationale: "Re-engages Primary Electronic Control (PRI) and physically locks guard to prevent accidental transfer in flight."
      },
      {
        id: '4-3',
        order: 3,
        label: 'Nozzle Opening & CENC Acoustic Whistle',
        phaseType: 'EXPECT',
        description: 'Observe the Convergent Exhaust Nozzle Control (CENC) motor driving the exhaust petals open from < 5% to 100%.',
        cockpitPanel: 'Center Pedestal / NOZZLE Indicator',
        visualCue: 'Convergent exhaust nozzle petals drive open; NOZZLE pointer swings open to 100%.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'NOZZLE OPEN',
          actionPrompt: 'Verify nozzle needle indicates 100% open'
        }
      ,
        rationale: "Convergent Exhaust Nozzle Control (CENC) motor drives petals to 100% open at idle for minimum residual thrust."
      },
      {
        id: '4-4',
        order: 4,
        label: 'Release Toe Brakes',
        phaseType: 'ACTION',
        description: 'Release toe brake pedal pressure. Aircraft rests securely on wheel chocks in PRI idle.',
        cockpitPanel: 'Rudder Footwell',
        visualCue: 'Toe brake pressure released; aircraft secure on wheel chocks in PRI idle.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES RELEASED',
          actionPrompt: 'Release toe brakes'
        }
      ,
        rationale: "Releasing brakes relieves hydraulic backpressure once idle thrust settles with fully opened nozzle petals."
      }
    ]
  },

  // =========================================================================
  // STEP 05: PRE-EPU GROUND SAFETY & PIN REMOVAL
  // =========================================================================
  {
    id: 5,
    stepName: 'EPU_PIN',
    code: 'STEP-05',
    title: 'Pre-EPU Ground Safety & Pin Removal',
    phase: 'SECONDARY_POWER',
    whatHappenedLast: 'Primary engine operation verified. Preparing for Emergency Power Unit (EPU) ground run-up.',
    whatToPerformNow: 'Confirm EPU lamps are dark, set EPU switch to OFF, request pin removal ("Pull EPU Pin"), then arm EPU to NORM.',
    whatToExpectNext: 'Chief calls: "Copy." Chief pulls the EPU ground safety pin with red streamer from the right forward strake.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (EPU PANEL) & RIGHT FORWARD STRAKE',
      subSystem: 'Emergency Power Unit (EPU) Hydrazine Turbine',
      focalControls: ['EPU Switch (OFF / NORM / ON)', 'EPU GEN Lamp', 'EPU PMG Lamp', 'Ground Safety Lock Pin']
    },
    pilotSpokenCalls: {
      primary: 'Pull EPU Pin',
      prefixVariants: ['Pull EPU Safety Pin', 'Remove EPU Safety Pin', 'Remove EPU Pin', 'Remove Pin'],
      synonyms: ['Remove Safety']
    },
    expectedChiefResponse: 'Copy. (Pin pulled from right strake; red streamer stowed).',
    engineParameters: {
      checklistCautions: [
        'Do NOT send crew to strake if EPU GEN or EPU PMG lamps are illuminated.',
        'EPU switch MUST be placed to OFF while ground personnel pull the safety pin.'
      ]
    },
    substeps: [
      {
        id: '5-1',
        order: 1,
        label: 'Annunciator Dark Verification',
        phaseType: 'VERIFY',
        description: 'Verify both EPU GEN and EPU PMG rectangular annunciator lights are completely dark before ground crew approaches the strake.',
        cockpitPanel: 'Left Console / EPU Panel',
        visualCue: 'EPU GEN and EPU PMG annunciators verified dark (unlit).',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'LAMPS DARK',
          actionPrompt: 'Verify EPU GEN and PMG lamps are dark'
        }
      ,
        rationale: "Dark EPU lights verify electrical buses are stable and no stray firing voltage exists on the initiator circuit."
      },
      {
        id: '5-2',
        order: 2,
        label: 'EPU Switch to OFF for Ground Safety',
        phaseType: 'ACTION',
        description: 'Flip the EPU switch to OFF. This electrically isolates the hydrazine catalytic starter valve while ground crew pulls the pin.',
        cockpitPanel: 'Left Console / EPU Panel',
        visualCue: 'EPU toggle switch seated in down OFF position.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'NORM', 'ON'],
          targetPosition: 'OFF',
          label: 'EPU SWITCH',
          actionPrompt: 'Set EPU switch to OFF'
        }
      ,
        rationale: "Electrically isolates the hydrazine flow valve before ground crew approaches the right forward strake."
      },
      {
        id: '5-3',
        order: 3,
        label: 'Verbal Callout "Pull EPU Pin" & Ground Action',
        phaseType: 'VERBAL',
        description: 'Authorize the crew chief to pull the physical ground safety pin. Speak "Pull EPU Pin" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy"; ground pin with red "REMOVE BEFORE FLIGHT" streamer removed from right strake.',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'PULL PIN CALLOUT',
          actionPrompt: 'Speak "Pull EPU Pin" into your microphone'
        }
      ,
        expectedChiefResponse: "Copy. All clear for run up.",
        rationale: "Ground crew extracts mechanical safety lock pin from the EPU hydrazine valve assembly."
      },
      {
        id: '5-4',
        order: 4,
        label: 'Arm EPU to NORM & Seat Guard',
        phaseType: 'ACTION',
        description: 'Move the EPU switch up to NORM and seat the toggle guard. EPU is now armed for automated actuation in flight.',
        cockpitPanel: 'Left Console / EPU Panel',
        visualCue: 'EPU switch locked in center NORM position under safety guard.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'NORM', 'ON'],
          targetPosition: 'NORM',
          label: 'EPU SWITCH',
          actionPrompt: 'Set EPU switch to NORM'
        }
      ,
        rationale: "Arming switch to NORM enables automatic emergency actuation in flight if main AC power and both generators fail."
      }
    ]
  },

  // =========================================================================
  // STEP 06: EPU HYDRAZINE FLOW & RUN-UP CHECK
  // =========================================================================
  {
    id: 6,
    stepName: 'EPU_FLOW',
    code: 'STEP-06',
    title: 'EPU Hydrazine Flow & Run-Up Check',
    phase: 'SECONDARY_POWER',
    whatHappenedLast: 'EPU safety pin removed. EPU armed to NORM.',
    whatToPerformNow: 'Check flow ("Check Flow"), depress toe brakes firmly, spool engine to 80-85% RPM, hold EPU/GEN TEST switch for 5s, verify EPU RUN light, and retard throttle.',
    whatToExpectNext: 'Chief calls: "No flow" (1.5s delay). Green EPU RUN light illuminates during 5s test. Retard throttle to idle.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (TEST & EPU PANELS) & THROTTLE',
      subSystem: 'EPU Bleed Air Turbine & TEST Panel',
      focalControls: ['EPU/GEN TEST Switch', 'EPU RUN Light (Green)', 'AIR Light (Amber)', 'Throttle (80-85% RPM)', 'Toe Brakes']
    },
    pilotSpokenCalls: {
      primary: 'Check Flow',
      prefixVariants: ['Check for flow', 'Cleared to check for flow', 'Chief Check Flow', 'Flow Check'],
      synonyms: ['Verify Flow']
    },
    expectedChiefResponse: 'No flow. (Hold brakes; spool 80-85% RPM; hold test 5s; retard to IDLE).',
    engineParameters: {
      throttleState: 'Spool to 80–85% RPM for test, then retard to IDLE',
      targetRpm: '80%–85% RPM during 5-second test switch hold',
      checklistCautions: [
        'MANDATORY BRAKE HOLD: Neither parking brake nor chocks can hold high engine thrust at 80-85% RPM. Hold toe brakes firmly!',
        'Pre-Avionics Warning: Complete EPU run-up prior to turning on radar and avionics to avoid bus voltage surge spikes.',
        'Pilot monitors test panel lamps directly; Chief does NOT announce BIT results.'
      ]
    },
    substeps: [
      {
        id: '6-1',
        order: 1,
        label: 'Pre-Avionics Caution & Flow Clearance Callout',
        phaseType: 'VERBAL',
        description: 'Warn chief before spooling engine. Speak "Check Flow" into microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief replies "No flow" after 1.5s delay (confirming no uncommanded hydrazine leaks).',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CHECK FLOW CALLOUT',
          actionPrompt: 'Speak "Check Flow" into your microphone'
        },
        expectedChiefResponse: "No flow.",
        rationale: "Crew Chief inspects the underside strake exhaust port to verify zero toxic hydrazine leakage or odor."
      },
      {
        id: '6-2',
        order: 2,
        label: 'Mandatory Toe Brakes Hold',
        phaseType: 'ACTION',
        description: 'Depress both toe brake pedals firmly to ensure aircraft remains stationary prior to high engine run-up (80-85% RPM).',
        cockpitPanel: 'Rudder Footwell',
        visualCue: 'Both toe brake pedals held firmly depressed prior to engine spool.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES HELD',
          actionPrompt: 'Hold toe brakes firmly'
        },
        rationale: "Neither parking brake nor chocks can hold high engine thrust at 80-85% RPM. Toe brakes must be held firmly."
      },
      {
        id: '6-3',
        order: 3,
        label: 'Spool to 80-85% RPM',
        phaseType: 'ACTION',
        description: 'Advance throttle forward to 80–85% RPM to generate bleed air pressure for the EPU turbine.',
        cockpitPanel: 'Left Console (Throttle) & Center Pedestal',
        visualCue: 'Tachometer advances to 80-85% RPM to supply 13th-stage bleed air pressure.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'SPOOL TO ~82% RPM',
          actionPrompt: 'Advance throttle to ~82% RPM'
        },
        rationale: "Engine must be at 80-85% RPM to generate sufficient 13th-stage bleed air pressure to motor the EPU turbine."
      },
      {
        id: '6-4',
        order: 4,
        label: 'EPU/GEN TEST Switch Actuation (5s Countdown)',
        phaseType: 'ACTION',
        description: 'Click and hold the spring-loaded EPU/GEN TEST switch in the TEST position for 5 seconds.',
        cockpitPanel: 'Left Console / TEST Panel',
        visualCue: 'EPU/GEN TEST switch held in TEST for 5 seconds; green EPU RUN and amber AIR lamps illuminate.',
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 5,
          label: 'HOLD TEST SWITCH (5S)',
          actionPrompt: 'Hold EPU/GEN TEST switch for 5 seconds'
        },
        rationale: "Holding TEST checks automatic EPU generator and PMG emergency transfer under bleed air power."
      },
      {
        id: '6-5',
        order: 5,
        label: 'Throttle Retard to IDLE & Lamp Extinguishment',
        phaseType: 'VERIFY',
        description: 'Release test switch. Retard throttle back to IDLE (~65% RPM). Release toe brakes. Verify green EPU RUN light extinguishes.',
        cockpitPanel: 'Left Console (Throttle) & TEST Panel',
        visualCue: 'RPM settles to 65%; EPU RUN and AIR lamps extinguish.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RETARD TO IDLE',
          actionPrompt: 'Retard throttle to IDLE and verify lamps dark'
        },
        rationale: "Confirms EPU disengages cleanly and green RUN light extinguishes once test switch is released."
      },
      {
        id: '6-6',
        order: 6,
        label: 'Release Toe Brakes',
        phaseType: 'ACTION',
        description: 'Release toe brake pedal pressure. Aircraft rests securely on wheel chocks in PRI idle.',
        cockpitPanel: 'Rudder Footwell',
        visualCue: 'Toe brake pressure released; aircraft secure on wheel chocks in PRI idle.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES RELEASED',
          actionPrompt: 'Release toe brakes'
        }
      ,
        rationale: "Releasing brakes relieves hydraulic backpressure once idle thrust settles with fully opened nozzle petals."
      }
    ]
  },

  // =========================================================================
  // STEP 07: FLIGHT CONTROLS CLEAR
  // =========================================================================
  {
    id: 7,
    stepName: 'FLIGHT_CONTROLS_CLEAR',
    code: 'STEP-07',
    title: 'Flight Controls Clear',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'EPU flow and bleed air run-up check complete. Preparing for Flight Control System (FLCS) tests.',
    whatToPerformNow: 'Look out canopy left and right, verify ground crew is outside the 6-foot wingtip perimeter, transmit "Flight Controls Clear", then cycle stick and pedals for 15-20 seconds to warm hydraulic actuators prior to BIT.',
    whatToExpectNext: 'Chief responds: "Flight controls clear."',
    cockpitVisual: {
      panelName: 'CANOPY FIELD-OF-VIEW & WINGTIPS',
      subSystem: 'External Flight Control Surface Clearance Boundary',
      focalControls: ['Canopy Field of View', 'Port Wingtip Clearance', 'Starboard Wingtip Clearance']
    },
    pilotSpokenCalls: {
      primary: 'Flight Controls Clear',
      prefixVariants: ['Chief Flight Controls Clear', 'Controls Clear'],
      synonyms: ['Confirm Flight Controls Clear']
    },
    expectedChiefResponse: 'Speedbrakes, flight controls clear.',
    substeps: [
      {
        id: '7-1',
        order: 1,
        label: 'Authentic Canopy Perimeter Clearance Scan',
        phaseType: 'VERIFY',
        description: 'Visually scan out canopy left and right. Confirm all ground personnel have stepped back beyond the 6-foot wingtip clearance perimeter.',
        cockpitPanel: 'Cockpit Canopy / Left & Right Wings',
        visualCue: 'Ground personnel standing clear outside 6-foot wingtip and tail perimeter; Chief confirms clear.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'PERIMETER CLEAR',
          actionPrompt: 'Verify ground crew is clear outside wingtips'
        }
      ,
        expectedChiefResponse: "Speedbrakes, flight controls clear.",
        rationale: "Ensures entire travel arc of flaperons, horizontal tails, and rudder is clear of ladders, crew, and chocks."
      },
      {
        id: '7-2',
        order: 2,
        label: 'Verbal Transmission "Flight Controls Clear"',
        phaseType: 'VERBAL',
        description: 'Transmit flight controls clearance to the Chief over the ground interphone line. Speak "Flight Controls Clear".',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief confirms: "Speedbrakes, flight controls clear."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CONTROLS CLEAR CALLOUT',
          actionPrompt: 'Speak "Flight Controls Clear" into your microphone'
        }
      },
      {
        id: '7-3',
        order: 3,
        label: 'Pre-BIT Controls Exercise & Warm-Up (15–20s)',
        phaseType: 'ACTION',
        description: 'Wiggle flight controls freely for 15–20 seconds. This warms up hydraulic fluid and exercises all FLCS servoactuators before running the Built-In Test.',
        cockpitPanel: 'Flight Stick & Rudder Pedals',
        visualCue: 'Flight stick and pedals cycled freely for 15-20 seconds to warm hydraulic fluid and FLCS servoactuators.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'COMPLETE 15-20S WARM-UP',
          actionPrompt: 'Wiggle flight controls freely for 15–20 seconds to warm hydraulic actuators'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 08: CLEARED FOR FLCS BUILT-IN TEST (BIT)
  // =========================================================================
  {
    id: 8,
    stepName: 'FLCS_BIT',
    code: 'STEP-08',
    title: 'Cleared for FLCS Built-In Test (BIT)',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Flight controls cycled freely for 15-20s and hydraulic fluid warmed up. Aircraft ready for autonomous FLCS self-test.',
    whatToPerformNow: 'Authorize BIT ("Clear BIT"), click FLCS BIT switch to BIT, keep hands and feet off controls (Simulator: 45s; condensed to 15s in trainer), verify green RUN light, and check FAIL light dark.',
    whatToExpectNext: 'Chief calls: "Cleared for BIT." Switch magnetically latches in BIT. Surfaces animate automated sweep. Switch returns to OFF after 45s.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (FLT CONTROL PANEL)',
      subSystem: 'Quadruplex Digital Flight Control System (FLCS)',
      focalControls: ['FLCS BIT Switch (Magnetic Latch)', 'FLCS RUN Light (Green)', 'FLCS FAIL Light (Amber)', 'FLCS Power Panel']
    },
    pilotSpokenCalls: {
      primary: 'Clear BIT',
      prefixVariants: ['Cleared for BIT', 'Ready for BIT', 'BIT Check', 'Clear for FLCS BIT'],
      synonyms: ['Cleared for Bit', 'Clear for Bit', 'Ready Bit']
    },
    expectedChiefResponse: 'Cleared for BIT. (45-second hands-off surface sweep cycle).',
    engineParameters: {
      checklistCautions: [
        'HANDS AND FEET OFF CONTROLS: Touching flight stick or rudder pedals during BIT will fail the test.',
        'Pilot monitors test lamps directly: green RUN light turns off, amber FAIL light must remain dark.'
      ]
    },
    substeps: [
      {
        id: '8-1',
        order: 1,
        label: 'Verbal Authorization "Clear BIT"',
        phaseType: 'VERBAL',
        description: 'Coordinate the automated BIT cycle with the Chief. Speak "Clear BIT" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges: "Cleared for BIT."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEAR BIT CALLOUT',
          actionPrompt: 'Speak "Clear BIT" into your microphone'
        }
      ,
        expectedChiefResponse: "Cleared for BIT.",
        rationale: "Coordinates start of the autonomous 45-second flight control built-in test sweep with ground crew."
      },
      {
        id: '8-2',
        order: 2,
        label: 'FLCS BIT Switch Magnetic Latch',
        phaseType: 'ACTION',
        description: 'Click the FLCS BIT switch to snap to BIT. The switch magnetically latches in position and the green RUN light illuminates. (Note: FLCS BIT runs 45 seconds in the simulator/aircraft; condensed to 15 seconds in this trainer).',
        cockpitPanel: 'Left Console / FLT CONTROL Panel',
        visualCue: 'FLCS BIT switch magnetically latches in BIT position; green RUN light illuminates solid.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'TRIGGER FLCS BIT',
          actionPrompt: 'Click switch to trigger magnetically latched BIT'
        }
      ,
        rationale: "Engages magnetic solenoid latch; digital computers execute comprehensive surface sweeps and hydraulic rate checks."
      },
      {
        id: '8-3',
        order: 3,
        label: 'Hands-Off 45-Second Surface Sweep Cycle',
        phaseType: 'EXPECT',
        description: 'Keep hands and feet completely off controls for 45 seconds while the FLCS runs sequential deflections: Flaperons (0-15s), Stabilators (15-30s), Rudder & LEFs (30-45s).',
        cockpitPanel: 'Flight Controls / External Control Surfaces',
        visualCue: 'Hands and feet off controls; FLCS executes automated surface sweep (flaperons, stabilators, rudder, LEFs).',
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 45,
          label: 'HANDS-OFF BIT (45S)',
          actionPrompt: 'Hands and feet off controls during 45s test'
        }
      ,
        rationale: "Extinguished RUN lamp and dark FAIL lamp verify quadruplex FLCS computers passed all self-diagnostics."
      },
      {
        id: '8-4',
        order: 4,
        label: 'Test Pass Lamp Verification',
        phaseType: 'VERIFY',
        description: 'Verify FLCS BIT switch snaps magnetically back to OFF. Green RUN lamp extinguishes. Verify amber FAIL lamp remains unlit.',
        cockpitPanel: 'Left Console / FLT CONTROL Panel',
        visualCue: 'FLCS BIT switch releases magnetically to OFF; green RUN light extinguishes; amber FAIL light remains dark.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BIT PASSED',
          actionPrompt: 'Verify FAIL lamp remains dark'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 09: READY FOR TRIM CHECK
  // =========================================================================
  {
    id: 9,
    stepName: 'TRIM_VERIFY',
    code: 'STEP-09',
    title: 'Ready for Trim Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'FLCS BIT completed successfully. All quad branches operational.',
    whatToPerformNow: 'Verify Manual Trim indicator needles read zero neutral, then transmit "Ready Trim".',
    whatToExpectNext: 'Chief responds: "Ready for trim check."',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE / MANUAL TRIM PANEL',
      subSystem: 'Manual Trim Potentiometers & Indicators',
      focalControls: ['ROLL TRIM Wheel', 'PITCH TRIM Wheel', 'YAW TRIM Wheel', 'Trim Indicator Dials']
    },
    pilotSpokenCalls: {
      primary: 'Ready Trim',
      prefixVariants: ['Ready for Trim Check', 'Chief Ready Trim', 'Ready for Trim'],
      synonyms: ['Trim Check Ready']
    },
    expectedChiefResponse: 'Ready for trim.',
    substeps: [
      {
        id: '9-1',
        order: 1,
        label: 'Baseline Trim Gauge Neutral Verification',
        phaseType: 'VERIFY',
        description: 'Verify the three circular indicator dials on the Manual Trim panel (Roll, Pitch, Yaw) align with the white zero centerlines.',
        cockpitPanel: 'Left Console / MANUAL TRIM Panel',
        visualCue: 'Roll, Pitch, and Yaw trim indicator dial needles aligned with white center zero indices.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'TRIMS AT ZERO',
          actionPrompt: 'Verify all three trim needles are centered'
        }
      ,
        expectedChiefResponse: "Ready for trim.",
        rationale: "Alerts ground crew before testing manual trim inhibit safety functions."
      },
      {
        id: '9-2',
        order: 2,
        label: 'Verbal Callout "Ready Trim"',
        phaseType: 'VERBAL',
        description: 'Request trim check initiation from the Chief. Speak "Ready Trim" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief confirms: "Ready for trim."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY TRIM CALLOUT',
          actionPrompt: 'Speak "Ready Trim" into your microphone'
        }
      ,
        rationale: "Tests the cockpit emergency disconnect function that isolates trim actuators in the event of trim runaway."
      }
    ]
  },

  // =========================================================================
  // STEP 10: TRIM DISCONNECTED CHECK
  // =========================================================================
  {
    id: 10,
    stepName: 'TRIM_DISC',
    code: 'STEP-10',
    title: 'Trim Disconnected Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Chief acknowledged trim check. Ready to verify electrical disconnect circuit.',
    whatToPerformNow: 'Flip TRIM/AP DISC switch to DISC, transmit "Disconnected", actuate stick trim hat in 4 directions, and verify trim needles do not move.',
    whatToExpectNext: 'Chief calls: "Copy." Trim indicator needles remain completely frozen at zero.',
    cockpitVisual: {
      panelName: 'MISC PANEL & FLIGHT STICK GRIP',
      subSystem: 'Autopilot / Trim Disconnect Circuit & Stick Hat',
      focalControls: ['TRIM/AP DISC Switch (DISC)', '4-Way Castle Trim Hat', 'Roll/Pitch/Yaw Trim Dials']
    },
    pilotSpokenCalls: {
      primary: 'Disconnected',
      prefixVariants: ['Chief Trim Disconnected', 'Trim Disc'],
      synonyms: ['Trim Disconnected']
    },
    expectedChiefResponse: 'Copy.',
    substeps: [
      {
        id: '10-1',
        order: 1,
        label: 'Select TRIM/AP DISC to DISC',
        phaseType: 'ACTION',
        description: 'Push the two-position TRIM/AP DISC switch forward into the DISC position on the MISC panel.',
        cockpitPanel: 'MISC Panel (Left Quarter)',
        visualCue: 'TRIM/AP DISC switch seated in forward DISC position.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['DISC', 'NORM'],
          targetPosition: 'DISC',
          label: 'TRIM/AP DISC SWITCH',
          actionPrompt: 'Set switch to DISC position'
        }
      ,
        rationale: "Tests emergency disconnect isolation by actuating stick trim hat in roll and pitch with switch in DISC."
      },
      {
        id: '10-2',
        order: 2,
        label: 'Verbal Transmission "Trim Disconnected"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that trim is disconnected. Speak "Disconnected" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRIM DISC CALLOUT',
          actionPrompt: 'Speak "Trim Disconnected" into your microphone'
        }
      ,
        rationale: "Verifies manual pitch trim wheel on left console is also isolated when disconnect switch is held in DISC."
      },
      {
        id: '10-3',
        order: 3,
        label: 'Actuate 4-Way Stick Trim Hat',
        phaseType: 'ACTION',
        description: 'Push the 4-way castle trim hat on the flight stick UP, DOWN, LEFT, RIGHT. Verify trim indicator needles remain completely frozen at zero.',
        cockpitPanel: 'Right Console / Flight Stick Grip',
        visualCue: 'Trim indicator needles remain frozen at zero index; emergency disconnect verified.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'TEST 4-WAY TRIM HAT',
          actionPrompt: 'Actuate 4-way castle trim hat on flight stick in all 4 directions'
        }
      ,
        expectedChiefResponse: "Copy.",
        rationale: "Confirms neither stick trim nor manual console trim can deflect control surfaces while disconnected."
      }
    ]
  },

  // =========================================================================
  // STEP 11: TRIM CONNECTED & NEEDLE MOVEMENT CHECK
  // =========================================================================
  {
    id: 11,
    stepName: 'TRIM_CONN',
    code: 'STEP-11',
    title: 'Trim Connected & Needle Movement Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Trim disconnect verified. Hat produced zero needle motion.',
    whatToPerformNow: 'Return TRIM/AP switch to NORM, transmit "Connected", listen to Chief call out 6 axis deflections, then manually re-center all trims to zero.',
    whatToExpectNext: 'Chief calls: "Copy." Chief calls out deflections: Nose Up, Nose Down, Roll Left, Roll Right, Yaw Left, Yaw Right (1.5s intervals). Pilot manually re-centers trims.',
    cockpitVisual: {
      panelName: 'MISC PANEL & MANUAL TRIM PANEL',
      subSystem: 'Normal Trim Circuits & Indicator Dials',
      focalControls: ['TRIM/AP DISC Switch (NORM)', 'ROLL TRIM Dial', 'PITCH TRIM Dial', 'YAW TRIM Dial']
    },
    pilotSpokenCalls: {
      primary: 'Connected',
      prefixVariants: ['Chief Trim Connected', 'Trim Normal', 'Trim in Norm'],
      synonyms: ['Trim Connected']
    },
    expectedChiefResponse: 'Copy. (Nose Up -> Nose Down -> Roll Left -> Roll Right -> Yaw Left -> Yaw Right).',
    engineParameters: {
      checklistCautions: [
        'MANUAL RE-CENTERING: Re-centering trims is 100% pilot responsibility. Verify all three needles align with zero.',
        'Chief does NOT confirm centering; pilot verifies indicator needles directly.'
      ]
    },
    substeps: [
      {
        id: '11-1',
        order: 1,
        label: 'Revert Switch to NORM',
        phaseType: 'ACTION',
        description: 'Return the TRIM/AP DISC toggle switch aft to the center NORM position.',
        cockpitPanel: 'MISC Panel (Left Quarter)',
        visualCue: 'TRIM/AP DISC switch seated in center NORM position.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['DISC', 'NORM'],
          targetPosition: 'NORM',
          label: 'TRIM/AP DISC SWITCH',
          actionPrompt: 'Set switch to NORM position'
        }
      ,
        expectedChiefResponse: "Copy. (Nose Up -> Nose Down -> Roll Left -> Roll Right -> Yaw Left -> Yaw Right).",
        rationale: "Restores trim bus command authority to normal quadruplex flight control servo loops."
      },
      {
        id: '11-2',
        order: 2,
        label: 'Verbal Transmission "Trim Connected"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that trim is connected. Speak "Connected" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRIM CONNECTED CALLOUT',
          actionPrompt: 'Speak "Connected" into your microphone'
        }
      ,
        expectedChiefResponse: "Copy. (Nose Up -> Nose Down -> Roll Left -> Roll Right -> Yaw Left -> Yaw Right).",
        rationale: "Notifies Chief that trim is re-engaged and ready for surface deflection verification."
      },
      {
        id: '11-3',
        order: 3,
        label: 'Axis Deflection Sequence with Chief Callouts',
        phaseType: 'EXPECT',
        description: 'Listen to the Chief call out deflections when you move them (simulated here): "Nose Up", "Nose Down", "Roll Left", "Roll Right", "Yaw Left", "Yaw Right". Observe dials deflect.',
        cockpitPanel: 'Left Console / MANUAL TRIM Panel',
        visualCue: 'Trim pointers deflect clockwise and counter-clockwise matching Chief callouts: Nose Up, Down, Roll Left, Right, Yaw Left, Right.',
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 9,
          label: 'AXIS CALLOUTS (9S)',
          actionPrompt: 'Observe 6-axis trim deflection sequence'
        }
      ,
        expectedChiefResponse: "Nose Up... Nose Down... Roll Left... Roll Right... Yaw Left... Yaw Right.",
        rationale: "Chief confirms that control surfaces respond correctly to manual trim inputs across all three axes. You do that with joystick trim hat and manual trim wheel for Yaw in Falcon BMS."
      },
      {
        id: '11-4',
        order: 4,
        label: 'Manual Trim Centering to Neutral Zero Index',
        phaseType: 'ACTION',
        description: 'Manually center all three trim wheels until the Roll, Pitch, and Yaw pointers align precisely with the white zero centerlines.',
        cockpitPanel: 'Left Console / MANUAL TRIM Panel',
        visualCue: 'All three pointers aligned vertically with the zero index marks.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'MANUAL RE-CENTER COMPLETE',
          actionPrompt: 'Verify all three trim needles are centered at 0'
        }
      ,
        rationale: "All trim indicators must be mechanically centered to zero before flight to prevent uncommanded roll or pitch on takeoff."
      }
    ]
  },

  // =========================================================================
  // STEP 12: CLEAR FOR BIG MOVEMENTS (FLIGHT CONTROLS CYCLE)
  // =========================================================================
  {
    id: 12,
    stepName: 'BIG_MOVEMENTS',
    code: 'STEP-12',
    title: 'Clear for Big Movements (Flight Controls Cycle)',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Trims checked and manually centered at zero index.',
    whatToPerformNow: 'Request clearance ("Clear Big Movements"), cycle Roll (left/right), cycle Pitch (Nose Up then Down), test MPO kick while holding Nose Down, cycle Yaw, and cycle Speedbrakes.',
    whatToExpectNext: 'Chief calls: "Flight controls still clear." Surfaces deflect to full travel stops. Speedbrakes open and close on Chief callouts.',
    cockpitVisual: {
      panelName: 'FLIGHT STICK, RUDDER PEDALS & MISC PANEL',
      subSystem: 'Primary Flight Control Surface Actuators',
      focalControls: ['Flight Stick Grip', 'Rudder Pedals', 'MPO Switch (OVRD)', 'Speedbrake Switch', 'Flaperons', 'Stabilators', 'Rudder', 'Speedbrake Petals']
    },
    pilotSpokenCalls: {
      primary: 'Clear Big Movements',
      prefixVariants: ['Clear for Big Movements', 'Chief Clear Big Movements', 'Big Movements', 'Cycle Controls'],
      synonyms: ['Clear Big', 'Ready Movement', 'Ready Big Movements']
    },
    expectedChiefResponse: 'Flight controls still clear. (Roll -> Pitch -> MPO kick -> Yaw -> Speedbrakes).',
    substeps: [
      {
        id: '12-1',
        order: 1,
        label: 'Verbal Callout "Clear Big Movements"',
        phaseType: 'VERBAL',
        description: 'Request clearance for full control surface sweeps. Speak "Clear Big Movements" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief confirms: "Flight controls still clear."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'BIG MOVEMENTS CALLOUT',
          actionPrompt: 'Speak "Clear Big Movements" into your microphone'
        }
      ,
        expectedChiefResponse: "Flight controls still clear.",
        rationale: "Clears ground perimeter before pilot exercises full aerodynamic control authority to mechanical travel stops."
      },
      {
        id: '12-2',
        order: 2,
        label: 'Roll Axis Deflection (Left then Right)',
        phaseType: 'ACTION',
        description: 'Move the flight stick full left, then full right. Observe flaperons deflect differentially (+/-20°).',
        cockpitPanel: 'Flight Stick / Flaperons',
        visualCue: 'Stick full left then full right; flaperons deflect differentially (+/-20°).',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'roll',
          axisThreshold: 0.15,
          label: 'ROLL AXIS TEST',
          actionPrompt: 'Move stick full left, then full right (or skip)'
        }
      ,
        rationale: "Full roll stick travel tests differential flaperon deflection (+/-20°) and hydraulic actuator spool valves."
      },
      {
        id: '12-3',
        order: 3,
        label: 'Pitch Axis Deflection (Nose Up then Nose Down)',
        phaseType: 'ACTION',
        description: 'Pull the flight stick full aft (Nose Up, stabilators +25° TEU), then push full forward (Nose Down, stabilators -15° TED). Hold stick full forward for MPO test.',
        cockpitPanel: 'Flight Stick / Stabilators',
        visualCue: 'Stick full aft (+25° TEU) then full forward (-15° TED); stabilators sweep symmetric pitch.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'pitch',
          axisThreshold: 0.15,
          label: 'PITCH AXIS TEST',
          actionPrompt: 'Pull full aft, then push full forward and hold'
        }
      ,
        rationale: "Full pitch stick travel tests symmetric horizontal stabilator deflection (+25° TEU to -15° TED)."
      },
      {
        id: '12-4',
        order: 4,
        label: 'MPO Switch Actuation ("MPO Kick" Test during Nose Down)',
        phaseType: 'ACTION',
        description: 'While holding flight stick forward in Nose Down, actuate the MPO switch to OVRD (on MISC Panel or mapped throttle control). Observe stabilators kick downward an additional 5° to 8°. Release switch to NORM and release stick.',
        cockpitPanel: 'MISC Panel (Left Quarter)',
        visualCue: 'Stabilators kick downward an additional 5° to 8° past mechanical stop; MPO switch returns to NORM.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'pitch',
          axisThreshold: 0.15,
          label: 'MPO HARDWARE SWITCH',
          actionPrompt: 'Actuate physical MPO switch on throttle (or skip)'
        }
      ,
        rationale: "MPO override switch bypasses pitch limiter law, providing an additional 5-8° trailing edge down authority to recover from deep stall."
      },
      {
        id: '12-5',
        order: 5,
        label: 'Yaw Axis Deflection (Rudder Left then Right)',
        phaseType: 'ACTION',
        description: 'Push left rudder pedal full travel, then right rudder pedal full travel. Observe vertical fin rudder deflects +/-30°.',
        cockpitPanel: 'Rudder Footwell / Vertical Fin',
        visualCue: 'Rudder pedals full left then full right; vertical fin rudder sweeps +/-30°.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'yaw',
          axisThreshold: 0.15,
          label: 'YAW AXIS TEST',
          actionPrompt: 'Push full left pedal, then full right pedal (or skip)'
        }
      ,
        rationale: "Full pedal travel tests rudder servo actuator deflection (+/-30°) and ARI (Aileron-Rudder Interconnect) yaw damping."
      },
      {
        id: '12-6',
        order: 6,
        label: 'Speedbrake Cycle (OPEN then CLOSE)',
        phaseType: 'ACTION',
        description: 'Slide throttle speedbrake switch aft to OPEN (petals deploy 60°, Chief calls "Speed brakes open"), then push forward to CLOSE (petals snap flush, Chief calls "Speed brakes closed").',
        cockpitPanel: 'Throttle Quadrant / Fuselage Clamshell',
        visualCue: 'Upper and lower clamshell petals open 60° then snap closed flush.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OPEN', 'HOLD', 'CLOSE'],
          targetPosition: 'CLOSE',
          label: 'SPEEDBRAKE SWITCH',
          actionPrompt: 'Cycle speedbrake switch OPEN then CLOSE'
        }
      ,
        expectedChiefResponse: "Speedbrakes open... and closed.",
        rationale: "Cycles all 4 carbon-fiber speedbrake clamshell petals to 60° open to verify hydraulic deployment and flush closure."
      }
    ]
  },

  // =========================================================================
  // STEP 13: DIGITAL BACKUP (DBU) STILL CLEAR CHECK
  // =========================================================================
  {
    id: 13,
    stepName: 'DBU_CHECK',
    code: 'STEP-13',
    title: 'Digital Backup (DBU) Still Clear Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Primary flight control big movements and MPO kick verified.',
    whatToPerformNow: 'Transmit "DBU Still Clear", lift guard and flip DBU switch to ON, verify yellow DBU ON lamp, cycle controls (Chief acknowledges deflections), then return switch to OFF and lower guard.',
    whatToExpectNext: 'Chief calls: "Flight controls still clear." Surfaces respond under backup software law with Chief acknowledgments.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (FLT CONTROL PANEL) & LEFT EYEBROW',
      subSystem: 'Digital Backup Software Flight Law (DBU)',
      focalControls: ['DIGITAL BACKUP Switch (ON)', 'DBU Switch Guard', 'DBU ON Caution Lamp (Yellow)']
    },
    pilotSpokenCalls: {
      primary: 'DBU Still Clear',
      prefixVariants: ['Chief DBU Still Clear', 'DBU Clear'],
      synonyms: ['Digital Clear', 'Digital Backup Clear']
    },
    expectedChiefResponse: 'Flight controls still clear. (Chief confirms surface movements in DBU).',
    substeps: [
      {
        id: '13-1',
        order: 1,
        label: 'Verbal Transmission "DBU Still Clear"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that DBU check is starting. Speak "DBU Still Clear" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief confirms: "Flight controls still clear."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'DBU CLEAR CALLOUT',
          actionPrompt: 'Speak "DBU Still Clear" into your microphone'
        }
      ,
        expectedChiefResponse: "Flight controls still clear.",
        rationale: "Alerts ground crew before switching into independent analog/digital backup flight control software law."
      },
      {
        id: '13-2',
        order: 2,
        label: 'DBU Switch to ON',
        phaseType: 'ACTION',
        description: 'Lift the red safety guard on the FLT CONTROL panel and flip the DIGITAL BACKUP switch to ON.',
        cockpitPanel: 'Left Console / FLT CONTROL Panel',
        visualCue: 'DIGITAL BACKUP switch placed to ON; yellow DBU ON caution lamp illuminates solid on Left Eyebrow.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'ON'],
          targetPosition: 'ON',
          label: 'DBU SWITCH',
          actionPrompt: 'Lift guard and flip DBU switch to ON'
        }
      ,
        rationale: "Engages independent emergency flight control computer law to protect against quadruplex primary computer failure."
      },
      {
        id: '13-3',
        order: 3,
        label: 'Flight Control Input in DBU Law with Chief Acknowledgment',
        phaseType: 'ACTION',
        description: 'Deflect stick and rudder slightly. Observe surfaces respond under analog backup software law with Chief visual confirmation.',
        cockpitPanel: 'Flight Stick / Rudder',
        visualCue: 'Stick and pedals deflected; control surfaces respond smoothly under backup software flight law.',
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'DEFLECT CONTROLS IN DBU',
          actionPrompt: 'Deflect stick to test backup law response'
        }
      ,
        expectedChiefResponse: "Surfaces responding in DBU.",
        rationale: "Verifies backup software law correctly commands actuator servo valves with Chief visual confirmation."
      },
      {
        id: '13-4',
        order: 4,
        label: 'DBU Switch to OFF & Guard Down',
        phaseType: 'ACTION',
        description: 'Flip the DIGITAL BACKUP switch back to OFF and seat the red safety guard flush DOWN.',
        cockpitPanel: 'Left Console / FLT CONTROL Panel',
        visualCue: 'DIGITAL BACKUP switch set to OFF and guard lowered flush; yellow DBU ON caution lamp extinguishes.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'ON'],
          targetPosition: 'OFF',
          label: 'DBU SWITCH',
          actionPrompt: 'Set switch to OFF and lower guard'
        }
      ,
        rationale: "Restores primary digital flight control law and seats toggle guard to prevent inadvertent in-flight engagement."
      }
    ]
  },

  // =========================================================================
  // STEP 14: READY LEFT BRAKE CHECK
  // =========================================================================
  {
    id: 14,
    stepName: 'LEFT_BRAKE',
    code: 'STEP-14',
    title: 'Ready Left Brake Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'DBU check complete and switch guarded in OFF.',
    whatToPerformNow: 'Transmit "Ready Left Brake", wait for Chief ("Ready left brake"), then press and release left toe brake pedal.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready left brake." Chief verifies left caliper clamping and zero hydraulic leaks.',
    cockpitVisual: {
      panelName: 'LEFT RUDDER TOE BRAKE & LEFT MAIN GEAR',
      subSystem: 'Normal Hydraulic Brake Channel A & Caliper',
      focalControls: ['Left Rudder Toe Brake Pedal', 'Left Main Gear Hydraulic Caliper', 'HYD PRESS A Gauge']
    },
    pilotSpokenCalls: {
      primary: 'Ready Left Brake',
      prefixVariants: ['Chief Ready Left Brake', 'Left Brake', 'Ready on the Left Brake'],
      synonyms: ['Left Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready left brake. (Press and release toe brake pedal).',
    substeps: [
      {
        id: '14-1',
        order: 1,
        label: 'Verbal Callout "Ready Left Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that left brake check is beginning. Speak "Ready Left Brake" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy", pauses 2.5s, then calls "Ready left brake."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY LEFT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Left Brake" into your microphone'
        }
      ,
        expectedChiefResponse: "Ready left brake.",
        rationale: "Coordinates left main landing gear brake caliper and hydraulic line leak inspection with ground crew."
      },
      {
        id: '14-2',
        order: 2,
        label: 'Left Toe Brake Press and Release',
        phaseType: 'ACTION',
        description: 'Depress left toe brake pedal past 20% to announce movement, then release back to idle to verify caliper release.',
        cockpitPanel: 'Rudder Footwell (Left Brake Pedal)',
        visualCue: 'Left toe brake pedal depressed and released; hydraulic pressure transfers to left brake caliper.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'left_brake',
          axisThreshold: 0.20,
          label: 'PRESS & RELEASE LEFT BRAKE',
          actionPrompt: 'Press and release left toe brake (or skip)'
        }
      ,
        rationale: "Applies 3,000 PSI hydraulic pressure to multi-disc left carbon brake assembly."
      },
      {
        id: '14-3',
        order: 3,
        label: 'Left Brake Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on left main landing gear.',
        cockpitPanel: 'Left Main Landing Gear Caliper',
        visualCue: 'Left main gear brake caliper pistons clamp firmly; zero hydraulic fluid seepage.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'LEFT BRAKE GOOD',
          actionPrompt: 'Release left brake and proceed to right brake'
        }
      ,
        expectedChiefResponse: "Movement. No movement.",
        rationale: "Chief visually verifies left brake caliper piston clamping and confirms zero hydraulic fluid seepage."
      }
    ]
  },

  // =========================================================================
  // STEP 15: READY RIGHT BRAKE CHECK
  // =========================================================================
  {
    id: 15,
    stepName: 'RIGHT_BRAKE',
    code: 'STEP-15',
    title: 'Ready Right Brake Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Left brake inspected and verified good.',
    whatToPerformNow: 'Transmit "Ready Right Brake", wait for Chief ("Ready right brake"), then press and release right toe brake pedal.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready right brake." Chief verifies right caliper clamping and zero hydraulic leaks.',
    cockpitVisual: {
      panelName: 'RIGHT RUDDER TOE BRAKE & RIGHT MAIN GEAR',
      subSystem: 'Normal Hydraulic Brake Channel B & Caliper',
      focalControls: ['Right Rudder Toe Brake Pedal', 'Right Main Gear Hydraulic Caliper', 'HYD PRESS B Gauge']
    },
    pilotSpokenCalls: {
      primary: 'Ready Right Brake',
      prefixVariants: ['Chief Ready Right Brake', 'Right Brake', 'Ready on the Right Brake'],
      synonyms: ['Right Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready right brake. (Press and release toe brake pedal).',
    substeps: [
      {
        id: '15-1',
        order: 1,
        label: 'Verbal Callout "Ready Right Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that right brake check is beginning. Speak "Ready Right Brake" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy", pauses 2.5s, then calls "Ready right brake."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY RIGHT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Right Brake" into your microphone'
        }
      ,
        expectedChiefResponse: "Ready right brake.",
        rationale: "Coordinates right main landing gear brake caliper and hydraulic line leak inspection with ground crew."
      },
      {
        id: '15-2',
        order: 2,
        label: 'Right Toe Brake Press and Release',
        phaseType: 'ACTION',
        description: 'Depress right toe brake pedal past 20% to announce movement, then release back to idle to verify caliper release.',
        cockpitPanel: 'Rudder Footwell (Right Brake Pedal)',
        visualCue: 'Right toe brake pedal depressed and released; hydraulic pressure transfers to right brake caliper.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'right_brake',
          axisThreshold: 0.20,
          label: 'PRESS & RELEASE RIGHT BRAKE',
          actionPrompt: 'Press and release right toe brake (or skip)'
        }
      ,
        rationale: "Applies 3,000 PSI hydraulic pressure to multi-disc right carbon brake assembly."
      },
      {
        id: '15-3',
        order: 3,
        label: 'Right Brake Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on right main landing gear.',
        cockpitPanel: 'Right Main Landing Gear Caliper',
        visualCue: 'Right main gear brake caliper pistons clamp firmly; zero hydraulic fluid seepage.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RIGHT BRAKE GOOD',
          actionPrompt: 'Release right brake'
        }
      ,
        expectedChiefResponse: "Movement. No movement.",
        rationale: "Chief visually verifies right brake caliper piston clamping and confirms zero hydraulic fluid seepage."
      }
    ]
  },

  // =========================================================================
  // STEP 16A: BRAKE CHANNEL 2 - LEFT BRAKE CHECK
  // =========================================================================
  {
    id: 19,
    stepName: 'LEFT_BRAKE_CHAN2',
    code: 'STEP-16A',
    title: 'Brake Channel 2: Left Brake Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Primary brake checks complete on Channel 1.',
    whatToPerformNow: 'Set BRAKES switch to CHAN 2 on Landing Gear panel, transmit "Ready Left Brake", then press and release left toe brake pedal.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready left brake." Chief verifies left caliper clamping and zero hydraulic leaks on alternate Channel 2.',
    cockpitVisual: {
      panelName: 'LANDING GEAR PANEL & LEFT TOE BRAKE',
      subSystem: 'Alternate Hydraulic Brake Channel 2 & Caliper',
      focalControls: ['BRAKES Switch (CHAN 2)', 'Left Rudder Toe Brake Pedal', 'Left Main Gear Hydraulic Caliper']
    },
    pilotSpokenCalls: {
      primary: 'Ready Left Brake',
      prefixVariants: ['Chief Ready Left Brake', 'Left Brake', 'Ready on the Left Brake'],
      synonyms: ['Left Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready left brake. (Press and release toe brake pedal).',
    substeps: [
      {
        id: '16a-1',
        order: 1,
        label: 'Select Brake Channel 2',
        phaseType: 'ACTION',
        description: 'Set BRAKES switch to CHAN 2 (Right-click lever DOWN) on the Landing Gear panel to engage alternate brake hydraulic subsystem.',
        cockpitPanel: 'Landing Gear Panel (Left Auxiliary Console)',
        visualCue: 'BRAKES toggle flipped down to CHAN 2 position; red collar visible.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          label: 'BRAKES SWITCH -> CHAN 2',
          actionPrompt: 'Right-click BRAKES toggle to select CHAN 2'
        },
        rationale: 'Switches brake hydraulic supply to alternate Channel 2 (Hydraulic System A) to verify redundant braking capability.'
      },
      {
        id: '16a-2',
        order: 2,
        label: 'Verbal Callout "Ready Left Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that left brake Channel 2 check is beginning. Speak "Ready Left Brake" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy", pauses 2.5s, then calls "Ready left brake."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY LEFT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Left Brake" into your microphone'
        },
        expectedChiefResponse: 'Ready left brake.',
        rationale: 'Coordinates left main landing gear Channel 2 brake inspection with ground crew.'
      },
      {
        id: '16a-3',
        order: 3,
        label: 'Left Toe Brake Press and Release (Chan 2)',
        phaseType: 'ACTION',
        description: 'Depress left toe brake pedal past 20% to announce movement, then release back to idle to verify caliper release.',
        cockpitPanel: 'Rudder Footwell (Left Brake Pedal)',
        visualCue: 'Left toe brake pedal depressed and released; hydraulic pressure transfers to left brake caliper via Channel 2.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'left_brake',
          axisThreshold: 0.20,
          label: 'PRESS & RELEASE LEFT BRAKE',
          actionPrompt: 'Press and release left toe brake (or skip)'
        },
        rationale: 'Applies hydraulic pressure through Channel 2 to verify alternate piston operation.'
      },
      {
        id: '16a-4',
        order: 4,
        label: 'Left Brake Channel 2 Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on Channel 2.',
        cockpitPanel: 'Left Main Landing Gear Caliper',
        visualCue: 'Left main gear brake caliper pistons clamp firmly; zero hydraulic fluid seepage.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'LEFT BRAKE CHAN 2 GOOD',
          actionPrompt: 'Release left brake and proceed to right brake'
        },
        expectedChiefResponse: 'Movement. No movement.',
        rationale: 'Chief visually verifies left brake caliper operation on alternate Channel 2.'
      }
    ]
  },

  // =========================================================================
  // STEP 16B: BRAKE CHANNEL 2 - RIGHT BRAKE CHECK
  // =========================================================================
  {
    id: 20,
    stepName: 'RIGHT_BRAKE_CHAN2',
    code: 'STEP-16B',
    title: 'Brake Channel 2: Right Brake Check',
    phase: 'FLIGHT_CONTROLS',
    whatHappenedLast: 'Left brake Channel 2 inspected and verified good.',
    whatToPerformNow: 'Transmit "Ready Right Brake", wait for Chief ("Ready right brake"), press and release right toe brake pedal, then reset BRAKES switch to CHAN 1.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready right brake." Verify right caliper clamping on Channel 2, then return switch to CHAN 1.',
    cockpitVisual: {
      panelName: 'RIGHT RUDDER TOE BRAKE & LANDING GEAR PANEL',
      subSystem: 'Alternate Hydraulic Brake Channel 2 & Caliper',
      focalControls: ['Right Rudder Toe Brake Pedal', 'Right Main Gear Hydraulic Caliper', 'BRAKES Switch (CHAN 1)']
    },
    pilotSpokenCalls: {
      primary: 'Ready Right Brake',
      prefixVariants: ['Chief Ready Right Brake', 'Right Brake', 'Ready on the Right Brake'],
      synonyms: ['Right Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready right brake. (Press and release toe brake pedal).',
    substeps: [
      {
        id: '16b-1',
        order: 1,
        label: 'Verbal Callout "Ready Right Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that right brake Channel 2 check is beginning. Speak "Ready Right Brake" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges "Copy", pauses 2.5s, then calls "Ready right brake."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY RIGHT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Right Brake" into your microphone'
        },
        expectedChiefResponse: 'Ready right brake.',
        rationale: 'Coordinates right main landing gear Channel 2 brake inspection with ground crew.'
      },
      {
        id: '16b-2',
        order: 2,
        label: 'Right Toe Brake Press and Release (Chan 2)',
        phaseType: 'ACTION',
        description: 'Depress right toe brake pedal past 20% to announce movement, then release back to idle to verify caliper release.',
        cockpitPanel: 'Rudder Footwell (Right Brake Pedal)',
        visualCue: 'Right toe brake pedal depressed and released; hydraulic pressure transfers to right brake caliper via Channel 2.',
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'right_brake',
          axisThreshold: 0.20,
          label: 'PRESS & RELEASE RIGHT BRAKE',
          actionPrompt: 'Press and release right toe brake (or skip)'
        },
        rationale: 'Applies hydraulic pressure through Channel 2 to verify alternate right piston operation.'
      },
      {
        id: '16b-3',
        order: 3,
        label: 'Right Brake Channel 2 Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on Channel 2.',
        cockpitPanel: 'Right Main Landing Gear Caliper',
        visualCue: 'Right main gear brake caliper pistons clamp firmly; zero hydraulic fluid seepage.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RIGHT BRAKE CHAN 2 GOOD',
          actionPrompt: 'Release right brake and reset BRAKES switch to CHAN 1'
        },
        expectedChiefResponse: 'Movement. No movement.',
        rationale: 'Chief visually verifies right brake caliper operation on alternate Channel 2.'
      },
      {
        id: '16b-4',
        order: 4,
        label: 'Reset Brake Channel to CHAN 1',
        phaseType: 'ACTION',
        description: 'Return BRAKES switch to CHAN 1 (Left-click lever UP) on the Landing Gear panel for normal taxi and takeoff operations.',
        cockpitPanel: 'Landing Gear Panel (Left Auxiliary Console)',
        visualCue: 'BRAKES toggle flipped up to CHAN 1 position; normal primary braking restored.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          label: 'BRAKES SWITCH -> CHAN 1',
          actionPrompt: 'Left-click BRAKES toggle to restore CHAN 1'
        },
        rationale: 'Restores primary brake Channel 1 (Hydraulic System B) before taxi.'
      }
    ]
  },

  // =========================================================================
  // STEP 16: READY AIR REFUELING (AAR) DOOR CHECK
  // =========================================================================
  {
    id: 16,
    stepName: 'AAR_DOOR',
    code: 'STEP-16',
    title: 'Ready Air Refueling (AAR) Door Check',
    phase: 'SECONDARY_POWER',
    whatHappenedLast: 'Both left and right wheel brakes inspected and verified good.',
    whatToPerformNow: 'Transmit "Ready AAR Door", move AIR REFUEL switch to OPEN (blue RDY lamp on), wait for Chief ("Door open"), then move switch to CLOSE (blue lamp off).',
    whatToExpectNext: 'Chief calls: "Copy standby" (4s) -> "Ready for door check." Door slides open (4s) -> "Door open." Door closes (4s) -> "Door closed."',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (FUEL PANEL) & DORSAL SPINE',
      subSystem: 'Air Refueling Slipway Door & Eyebrow Indexer',
      focalControls: ['AIR REFUEL Switch (OPEN / CLOSE)', 'AR / NWS RDY Lamp (Blue)', 'Dorsal Slipway Door']
    },
    pilotSpokenCalls: {
      primary: 'Ready AAR Door',
      prefixVariants: ['Chief Ready AAR Door', 'AAR Door Check', 'Ready Air Refuel Door'],
      synonyms: ['Check Refuel', 'AAR Door']
    },
    expectedChiefResponse: 'Copy standby. -> Ready for refuel door check. -> Door open. -> And closed.',
    substeps: [
      {
        id: '16-1',
        order: 1,
        label: 'Verbal Callout "Ready AAR Door"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that AAR door check is starting. Speak "Ready AAR Door" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief calls: "Copy standby... Ready for refuel door check."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY AAR DOOR CALLOUT',
          actionPrompt: 'Speak "Ready AAR Door" into your microphone'
        }
      ,
        expectedChiefResponse: "Copy standby. -> Ready for refuel door check.",
        rationale: "Alerts ground crew before cycling the dorsal air refueling slipway door mechanism."
      },
      {
        id: '16-2',
        order: 2,
        label: 'AIR REFUEL Switch to OPEN',
        phaseType: 'ACTION',
        description: 'Move the AIR REFUEL toggle switch forward to OPEN on the FUEL panel.',
        cockpitPanel: 'Left Console / FUEL Panel',
        visualCue: 'AIR REFUEL switch set to OPEN; blue AR / NWS RDY lamp illuminates on Right Eyebrow; dorsal door slides open.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['CLOSE', 'OPEN'],
          targetPosition: 'OPEN',
          label: 'AIR REFUEL SWITCH',
          actionPrompt: 'Set switch forward to OPEN'
        }
      ,
        expectedChiefResponse: "Door open.",
        rationale: "Hydraulically unlocks and rotates the dorsal slipway door open; illuminates cockpit RDY light and depressurizes fuel tanks."
      },
      {
        id: '16-3',
        order: 3,
        label: 'AIR REFUEL Switch to CLOSE',
        phaseType: 'ACTION',
        description: 'Move the AIR REFUEL toggle switch aft to CLOSE. Verify blue RDY lamp extinguishes and door latches flush.',
        cockpitPanel: 'Left Console / FUEL Panel',
        visualCue: 'AIR REFUEL switch set to CLOSE; blue RDY lamp extinguishes; dorsal slipway door latches flush.',
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['CLOSE', 'OPEN'],
          targetPosition: 'CLOSE',
          label: 'AIR REFUEL SWITCH',
          actionPrompt: 'Set switch aft to CLOSE'
        }
      ,
        expectedChiefResponse: "And closed.",
        rationale: "Closes and latches dorsal door flush with upper fuselage; RDY light extinguishes and fuel tanks repressurize."
      }
    ]
  },

  // =========================================================================
  // STEP 17: WHEEL CHOCKS REMOVAL (OPTIONAL GROUND CHECK)
  // =========================================================================
  {
    id: 17,
    stepName: 'CHOCKS_REMOVAL',
    code: 'STEP-17',
    title: 'Wheel Chocks Removal (Optional Ground Check)',
    phase: 'TAXI_CLEAR',
    whatHappenedLast: 'AAR slipway door check completed and verified closed flush.',
    whatToPerformNow: 'Hold toe brakes firmly, then transmit "Remove Chocks" (or "Wheel Chocks") to pull wheel chocks.',
    whatToExpectNext: 'Ground crew pulls rubber/wood wheel chocks away from tires. Chief remains connected on interphone.',
    cockpitVisual: {
      panelName: 'MAIN GEAR WHEEL WELLS & TOE BRAKES',
      subSystem: 'Wheel Chocks & Ground Restraint Equipment',
      focalControls: ['Wheel Chocks', 'Main Landing Gear Wheels', 'Toe Brakes']
    },
    pilotSpokenCalls: {
      primary: 'Remove Chocks',
      prefixVariants: ['Wheel Chocks', 'Remove Wheel Chocks', 'Pull Chocks', 'Pull Wheel Chocks'],
      synonyms: ['Chocks Away', 'Chief Remove Chocks']
    },
    expectedChiefResponse: 'Chocks pulled away from tires. (Chief remains on interphone line).',
    engineParameters: {
      checklistCautions: [
        'HOLD TOE BRAKES: Aircraft will roll freely once chocks are removed.',
        'CRUCIAL: Removing chocks does NOT disconnect the Chief. Chief remains plugged in on interphone loop.'
      ]
    },
    substeps: [
      {
        id: '17-1',
        order: 1,
        label: 'Hold Toe Brakes Firmly',
        phaseType: 'ACTION',
        description: 'Depress both toe brake pedals firmly to ensure aircraft will not roll when chocks are removed.',
        cockpitPanel: 'Rudder Footwell (Toe Brakes)',
        visualCue: 'Both toe brake pedals held firmly depressed to ensure aircraft remains stationary.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES HELD',
          actionPrompt: 'Hold toe brakes firmly'
        }
      ,
        rationale: "Holding toe brakes prevents unexpected roll forward on sloping ramp surfaces while chocks are removed."
      },
      {
        id: '17-2',
        order: 2,
        label: 'Verbal Transmission "Remove Chocks"',
        phaseType: 'VERBAL',
        description: 'Instruct the ground crew to pull wheel chocks. Speak "Remove Chocks" or "Wheel Chocks" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Ground crew extracts wheel chocks away from main gear tires while pilot holds brakes.',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'REMOVE CHOCKS CALLOUT',
          actionPrompt: 'Speak "Remove Chocks" into your microphone'
        }
      ,
        expectedChiefResponse: "[Wheel chocks removed from the tires]",
        rationale: "Orders ground crew to pull rubber/wood wheel chocks away from main tires while pilot holds brakes."
      }
    ]
  },

  // =========================================================================
  // STEP 18: CLEARED OFF & FINAL MARSHAL SIGN-OFF
  // =========================================================================
  {
    id: 18,
    stepName: 'FINALE_SALUTE',
    code: 'STEP-18',
    title: 'Cleared Off & Final Marshal Sign-Off',
    phase: 'TAXI_CLEAR',
    whatHappenedLast: 'Wheel chocks removed. Ready for taxi out.',
    whatToPerformNow: 'Transmit "Cleared Off" (or "Clear Ground") to disconnect Chief, watch Chief disconnect headset, and return 10 o\'clock salute.',
    whatToExpectNext: 'Chief calls: "Copy that, bring her back Code 1, sir/ma\'am." Chief unplugs headset, snaps spring door, and gives sharp hand salute at 10 o\'clock.',
    cockpitVisual: {
      panelName: 'LEFT SILL RECEPTACLE & 10 O\'CLOCK MARSHAL POSITION',
      subSystem: 'Ground Headset Disconnect & Visual Marshaller',
      focalControls: ['Ground Headset Disconnect', 'Interphone Cap', '10 O\'Clock Marshaller']
    },
    pilotSpokenCalls: {
      primary: 'Cleared Off',
      prefixVariants: ['Clear Ground', 'Chief Cleared Off', 'Clear Off'],
      synonyms: ['Everything Off', 'All Go']
    },
    expectedChiefResponse: 'Copy that, bring her back Code 1, sir/ma\'am. (Headset disconnected, 10 o\'clock salute).',
    substeps: [
      {
        id: '18-1',
        order: 1,
        label: 'Verbal Transmission "Cleared Off"',
        phaseType: 'VERBAL',
        description: 'Clear the crew chief off the interphone loop. Speak "Cleared Off" into the microphone.',
        cockpitPanel: 'Left Console / Intercom',
        visualCue: 'Chief acknowledges: "Copy that, bring her back Code 1, sir/ma\'am."',
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEARED OFF CALLOUT',
          actionPrompt: 'Speak "Cleared Off" into your microphone'
        }
      ,
        expectedChiefResponse: "Copy that, bring her back Code 1, sir/ma'am.",
        rationale: "Directs ground crew to disconnect interphone headset and clear the ramp area for taxi."
      },
      {
        id: '18-2',
        order: 2,
        label: 'Final 10 O\'Clock Marshal Salute',
        phaseType: 'VERIFY',
        description: 'Chief unplugs ground headset cord, snaps receptacle door closed, walks to 10 o\'clock position in high-visibility vest and renders a sharp hand salute.',
        cockpitPanel: 'Canopy Left Field of View (10 O\'Clock)',
        visualCue: 'Chief unplugs headset, secures sill door, walks to 10 o\'clock position and renders a crisp hand salute.',
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RETURN SALUTE & TAXI',
          actionPrompt: 'Checklist 100% complete — cleared for taxi'
        }
      ,
        expectedChiefResponse: "[You are ready for taxi, good job!]",
        rationale: "Chief snaps interphone door closed, moves to 10 o'clock position, and renders final hand salute for taxi."
      }
    ]
  }
];

export const RAMP_STEPS_BY_NAME: Record<DrillStepName, RampStartStep> = {
  ENGAGE_CHIEF: RAMP_START_STEPS[0],
  ELEC_POWER: RAMP_START_STEPS[1],
  JFS_START: RAMP_START_STEPS[2],
  SEC_CHECK: RAMP_START_STEPS[3],
  PRI_VERIFY: RAMP_START_STEPS[4],
  EPU_PIN: RAMP_START_STEPS[5],
  EPU_FLOW: RAMP_START_STEPS[6],
  FLIGHT_CONTROLS_CLEAR: RAMP_START_STEPS[7],
  FLCS_BIT: RAMP_START_STEPS[8],
  TRIM_VERIFY: RAMP_START_STEPS[9],
  TRIM_DISC: RAMP_START_STEPS[10],
  TRIM_CONN: RAMP_START_STEPS[11],
  BIG_MOVEMENTS: RAMP_START_STEPS[12],
  DBU_CHECK: RAMP_START_STEPS[13],
  LEFT_BRAKE: RAMP_START_STEPS[14],
  RIGHT_BRAKE: RAMP_START_STEPS[15],
  LEFT_BRAKE_CHAN2: RAMP_START_STEPS[16],
  RIGHT_BRAKE_CHAN2: RAMP_START_STEPS[17],
  AAR_DOOR: RAMP_START_STEPS[18],
  CHOCKS_REMOVAL: RAMP_START_STEPS[19],
  FINALE_SALUTE: RAMP_START_STEPS[20],
};
