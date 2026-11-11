export interface SubstepImageTarget {
  overviewLocator: {
    xPercent: number; // percentage from left (0 - 100)
    yPercent: number; // percentage from top (0 - 100)
    regionName: string; // e.g. "LEFT AUX CONSOLE"
  };
  detailCloseup: {
    title: string;
    description: string;
    focalControl: string;
  };
}

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
  controlElement: string;
  visualCue: string;
  images: SubstepImageTarget;
  interactiveControl?: InteractiveControlDef;
}

export interface CockpitVisualTarget {
  panelName: string;
  subSystem: string;
  schematicType: 'THROTTLE' | 'SWITCH' | 'DIAL' | 'ANNUNCIATOR' | 'GROUND_CREW' | 'STICK_RUDDER';
  focalControls: string[];
  operationalState: string;
  lookFor: string;
}

export interface RampStartStep {
  id: number;
  code: string;
  title: string;
  phase: 'PRE_START' | 'ENGINE_START' | 'SECONDARY_POWER' | 'FLIGHT_CONTROLS' | 'TAXI_CLEAR';
  expectedCommandName: string;
  backendStepKey?: string;
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
    annunciatorsExpected?: string[];
    checklistCautions?: string[];
  };
}

export const RAMP_START_STEPS: RampStartStep[] = [
  // =========================================================================
  // STEP 00: INTERPHONE CONNECTION & ENGAGE CREW CHIEF
  // =========================================================================
  {
    id: 0,
    code: 'STEP-00',
    title: 'Interphone Connection & Engage Crew Chief',
    phase: 'PRE_START',
    expectedCommandName: 'Engage Crew Chief',
    backendStepKey: 'Init',
    whatHappenedLast: 'Canopy cracked open. Pilot strapped into ACES II ejection seat with electrical systems cold & dark.',
    whatToPerformNow: 'Open ground interphone comms to the crew chief standing beside the left forward fuselage.',
    whatToExpectNext: 'Headset chime sounds; Chief confirms interphone hot-mic circuit is established.',
    cockpitVisual: {
      panelName: 'LEFT FORWARD FUSELAGE / CANOPY SILL',
      subSystem: 'Ground Communications Interphone Receptacle',
      schematicType: 'GROUND_CREW',
      focalControls: ['Interphone Receptacle Door', 'Ground Headset Cord', 'Canopy Sill'],
      operationalState: 'Ground communication cord plugged into aircraft external receptacle.',
      lookFor: 'Crew Chief on headset giving visual thumbs-up beside left forward fuselage.'
    },
    pilotSpokenCalls: {
      primary: 'Engage Chief',
      prefixVariants: ['Engage Crew Chief', 'Start Chief', 'Start Crew Chief', 'Turn On Chief'],
      synonyms: ['Chief', 'Enable Chief', 'Begin Chief']
    },
    expectedChiefResponse: 'Interphone acoustic link active — Chief online on ground headset.',
    substeps: [
      {
        id: '0-1',
        order: 1,
        label: 'Ground Interphone Hot-Mic Keying',
        phaseType: 'VERBAL',
        description: 'Initiate communication with the crew chief over the external interphone cord. Speak the voice trigger into the microphone.',
        cockpitPanel: 'Left Sill / Audio 1',
        controlElement: 'HOTAS Intercom / Mic Hot',
        visualCue: 'Speech waveform active; audio visualizer responds to voice.',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 46, regionName: 'LEFT SILL INTERPHONE PORT' },
          detailCloseup: {
            title: 'EXTERNAL GROUND INTERPHONE RECEPTACLE',
            description: 'Weatherproof interphone door open; yellow ground headset pigtail plugged in securely.',
            focalControl: 'External Interphone Jack'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT TRIGGER',
          actionPrompt: 'Speak "Engage Chief" or accepted variations into your microphone'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 01: COMMS & AUDIO CHECK
  // =========================================================================
  {
    id: 1,
    code: 'STEP-01',
    title: 'Comms & Audio Check',
    phase: 'PRE_START',
    expectedCommandName: 'Comms Check',
    backendStepKey: 'CommsCheck',
    whatHappenedLast: 'Crew Chief acknowledged interphone link. Aircraft battery bus ready for energization.',
    whatToPerformNow: 'Set MAIN PWR switch to MAIN PWR, verify generator and FLCS caution lamps, then transmit Comms Check.',
    whatToExpectNext: 'Chief responds: "Loud and clear, sir/ma\'am."',
    cockpitVisual: {
      panelName: 'RIGHT REAR CONSOLE / ELEC PANEL',
      subSystem: 'Electrical Power Distribution & Audio 1',
      schematicType: 'SWITCH',
      focalControls: ['MAIN PWR Switch', 'MAIN PWR Guard', 'MAIN GEN Lamp', 'STBY GEN Lamp'],
      operationalState: 'Aircraft main electrical bus energized; warning and caution lamps self-testing.',
      lookFor: 'Yellow MAIN GEN and STBY GEN lamps illuminated solid on eyebrow/caution panels.'
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
        description: 'Lift the red mechanical switch guard and move the MAIN PWR switch through BATT to MAIN PWR.',
        cockpitPanel: 'Right Rear Console / ELEC Panel',
        controlElement: 'MAIN PWR Toggle Switch & Guard',
        visualCue: 'MAIN GEN & STBY GEN yellow caution lights illuminate; FLCS PWR TEST green lights momentarily.',
        images: {
          overviewLocator: { xPercent: 82, yPercent: 78, regionName: 'RIGHT REAR CONSOLE (ELEC PANEL)' },
          detailCloseup: {
            title: 'ELEC PANEL — MAIN POWER SWITCH',
            description: 'Guarded 3-position toggle switch (OFF - BATT - MAIN PWR). Red guard flipped up.',
            focalControl: 'MAIN PWR Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'BATT', 'MAIN PWR'],
          targetPosition: 'MAIN PWR',
          label: 'MAIN PWR SWITCH',
          actionPrompt: 'Set MAIN PWR switch to MAIN PWR position'
        }
      },
      {
        id: '1-2',
        order: 2,
        label: 'Ground Interphone Comms Check',
        phaseType: 'VERBAL',
        description: 'Verify audio transmission clarity with the Crew Chief over the ground interphone line.',
        cockpitPanel: 'Left Console / AUDIO 1 Panel',
        controlElement: 'Intercom Volume Knob',
        visualCue: 'Intercom VU meter reads active audio signal.',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 68, regionName: 'LEFT CONSOLE (AUDIO 1)' },
          detailCloseup: {
            title: 'AUDIO 1 PANEL — INTERCOM VOLUME',
            description: 'Intercom rotary potentiometer set to 12 o\'clock normal listening level.',
            focalControl: 'INTERCOM Knob'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT COMMS CHECK',
          actionPrompt: 'Speak "Comms Check" into your microphone'
        }
      },
      {
        id: '1-3',
        order: 3,
        label: 'Pilot Acknowledgment / Continue',
        phaseType: 'ACTION',
        description: 'Chief confirmed loud and clear. Speak "Loud and clear" into microphone to acknowledge, or click Continue to proceed to Step 02.',
        cockpitPanel: 'Left Console / AUDIO 1 Panel',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief online on ground headset. Interphone comms established 5x5.',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 68, regionName: 'LEFT CONSOLE (AUDIO 1)' },
          detailCloseup: {
            title: 'AUDIO ACKNOWLEDGMENT',
            description: 'Pilot acknowledges comms check clarity before engine start.',
            focalControl: 'Intercom Audio'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'CONTINUE TO STEP 02',
          actionPrompt: 'Speak "Loud and clear" or click Continue'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 02: READY START TWO (JFS LIGHT-OFF & ENGINE SPOOL)
  // =========================================================================
  {
    id: 2,
    code: 'STEP-02',
    title: 'Ready Start Two (JFS Light-Off & Core Spool)',
    phase: 'ENGINE_START',
    expectedCommandName: 'Ready Start Two',
    backendStepKey: 'StartTwo',
    whatHappenedLast: 'Comms verified 5x5. Electrical buses energized; JFS hydraulic accumulators reading 3,000 PSI.',
    whatToPerformNow: 'Warn chief ("Start Two"), flip JFS switch to START 2, monitor JFS RUN lamp, and introduce fuel at 20% RPM.',
    whatToExpectNext: 'Chief responds: "Clear for Start Two." At 20% RPM, advance throttle to IDLE. Engine accelerates to 65% RPM.',
    cockpitVisual: {
      panelName: 'LEFT AUX CONSOLE & CENTER PEDESTAL',
      subSystem: 'Jet Fuel Starter (JFS) & Engine Tachometer',
      schematicType: 'THROTTLE',
      focalControls: ['JFS Switch (START 2)', 'JFS RUN Light', 'Throttle Cutoff Detent', 'Tachometer Gauge', 'FTIT Gauge'],
      operationalState: 'JFS turbine accelerating engine core past 20% RPM toward idle.',
      lookFor: 'Green JFS RUN light solid; RPM needle accelerating past 20%; FTIT rising below 650°C.'
    },
    pilotSpokenCalls: {
      primary: 'Start Two',
      prefixVariants: ['Ready Start Two', 'Chief Start Two', 'Clear Start Two'],
      synonyms: ['Start Two']
    },
    expectedChiefResponse: 'Clear for Start Two. (Spool to 20% RPM, throttle to IDLE).',
    engineParameters: {
      throttleState: 'IDLE (detent lifted at 20% RPM)',
      targetRpm: '65% RPM (Idle)',
      nozzlePosition: '100% (Open)',
      annunciatorsExpected: ['JFS RUN (illuminates then turns off at 50% RPM)', 'MAIN GEN (turns off at 55% RPM)'],
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
        description: 'Verify JFS exhaust duct is clear. Speak "Start Two" to request JFS start clearance from the Chief.',
        cockpitPanel: 'Left Aux Console / Warning Placards',
        controlElement: 'JFS Danger Placard',
        visualCue: 'Hazard chevrons active; Chief confirms "Clear for Start Two" after 4.0s delay.',
        images: {
          overviewLocator: { xPercent: 15, yPercent: 55, regionName: 'LEFT AUX CONSOLE (ENG PANEL)' },
          detailCloseup: {
            title: 'JFS EXHAUST & ACCUMULATOR PLACARD',
            description: 'Canopy movement hazard warning: do not move canopy during JFS operation.',
            focalControl: 'Turbine Exhaust Hazard Zone'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'START TWO CALLOUT',
          actionPrompt: 'Speak "Start Two" into your microphone'
        }
      },
      {
        id: '2-2',
        order: 2,
        label: 'JFS START 2 Switch Actuation',
        phaseType: 'ACTION',
        description: 'Snap the spring-loaded JFS switch to START 2. Both hydraulic accumulators discharge to spool the starter.',
        cockpitPanel: 'Left Aux Console / ENG & JET START',
        controlElement: 'JFS Switch (START 1 / OFF / START 2)',
        visualCue: 'JFS ACCUM 1 & 2 drop from 3,000 to 500 PSI; green JFS RUN lamp illuminates solid.',
        images: {
          overviewLocator: { xPercent: 15, yPercent: 55, regionName: 'LEFT AUX CONSOLE (ENG PANEL)' },
          detailCloseup: {
            title: 'JFS CONTROL SWITCH & ACCUMULATOR GAUGES',
            description: 'Two-position spring-loaded toggle switch snapping to START 2 with accumulator pressure drop.',
            focalControl: 'JFS Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['START 1', 'OFF', 'START 2'],
          targetPosition: 'START 2',
          label: 'JFS SWITCH',
          actionPrompt: 'Click switch to snap to START 2'
        }
      },
      {
        id: '2-3',
        order: 3,
        label: 'Core Spool to 20% RPM Minimum',
        phaseType: 'EXPECT',
        description: 'Observe engine core accelerating. Do NOT introduce fuel before achieving 20% RPM core speed.',
        cockpitPanel: 'Center Pedestal / Engine Cluster',
        controlElement: 'Tachometer (% RPM)',
        visualCue: 'RPM needle sweeps smoothly: 0% -> 12% -> 15% -> 20% RPM.',
        images: {
          overviewLocator: { xPercent: 52, yPercent: 62, regionName: 'CENTER PEDESTAL (ENGINE GAUGES)' },
          detailCloseup: {
            title: 'ENGINE TACHOMETER GAUGE',
            description: 'Dial showing core RPM. 20% RPM minimum gate highlighted in green.',
            focalControl: 'Tachometer Indicator'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RPM ACCELERATING',
          actionPrompt: 'Verify core speed reaches 20% RPM minimum'
        }
      },
      {
        id: '2-4',
        order: 4,
        label: 'Fuel Introduction (Throttle Detent to IDLE)',
        phaseType: 'ACTION',
        description: 'Lift the throttle cutoff finger-lift latch and push the throttle grip over the detent into IDLE.',
        cockpitPanel: 'Left Console / Throttle Quadrant',
        controlElement: 'Throttle Grip & Finger-Lift Gate',
        visualCue: 'Throttle grip seats forward in IDLE; FTIT needle rises smoothly toward 550°C.',
        images: {
          overviewLocator: { xPercent: 12, yPercent: 72, regionName: 'LEFT CONSOLE (THROTTLE)' },
          detailCloseup: {
            title: 'THROTTLE QUADRANT & CUTOFF DETENT',
            description: 'Finger-lift latch raised, unlocking throttle from OFF into IDLE forward stop.',
            focalControl: 'Throttle Finger-Lift Latch'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'LIFT DETENT & ADVANCE IDLE',
          actionPrompt: 'Click finger-lift to move throttle to IDLE'
        }
      },
      {
        id: '2-5',
        order: 5,
        label: 'Idle Stabilization & Self-Sustain Verification',
        phaseType: 'VERIFY',
        description: 'Verify engine self-sustains: RPM settles at 65%, HYD A & B reach 3,000 PSI, OIL pressure > 15 PSI. JFS RUN lamp turns off.',
        cockpitPanel: 'Center Pedestal & Warning Panels',
        controlElement: 'Engine Gauge Cluster',
        visualCue: 'JFS RUN lamp extinguishes at 50% RPM; MAIN GEN caution lamp extinguishes at 55% RPM.',
        images: {
          overviewLocator: { xPercent: 52, yPercent: 62, regionName: 'CENTER PEDESTAL (ENGINE GAUGES)' },
          detailCloseup: {
            title: 'ENGINE STABILIZATION CLUSTER',
            description: 'Tachometer stable at 65% RPM, FTIT < 600°C, Hydraulic pressure at 3,000 PSI.',
            focalControl: 'Multi-Gauge Cluster'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'IDLE STABLE',
          actionPrompt: 'Verify engine idle parameters stabilized'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 03: SECONDARY ENGINE CONTROL (SEC) CHECK & SPOOL
  // =========================================================================
  {
    id: 3,
    code: 'STEP-03',
    title: 'Secondary Engine Control (SEC) Check & Spool',
    phase: 'ENGINE_START',
    expectedCommandName: 'Clear for SEC Check',
    backendStepKey: 'SecCheck',
    whatHappenedLast: 'Engine stabilized in primary IDLE. Ready for hydromechanical fuel governing check.',
    whatToPerformNow: 'Wait 30s in idle, hold toe brakes, request SEC check ("Clear SEC"), set ENG CONT to SEC, confirm nozzle closes, and spool to 73% RPM.',
    whatToExpectNext: 'Chief calls: "Ready for SEC check." Nozzle closes < 5%. Engine accelerates linearly to 73% RPM minimum in SEC mode.',
    cockpitVisual: {
      panelName: 'LEFT EYEBROW & RUDDER TOE BRAKES',
      subSystem: 'Digital Engine Control / Backup Hydromechanical Unit',
      schematicType: 'SWITCH',
      focalControls: ['ENG CONT Switch (SEC)', 'ENG CONT Guard', 'SEC Caution Lamp', 'NOZZLE Position Gauge', 'Toe Brakes'],
      operationalState: 'Hydromechanical fuel control active; digital EEC offline; convergent nozzle closed.',
      lookFor: 'Yellow SEC caution lamp on left eyebrow; Nozzle position needle at 0% (closed).'
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
      annunciatorsExpected: ['SEC caution light (Yellow on Left Eyebrow)'],
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
        cockpitPanel: 'Center Pedestal / Chronometer',
        controlElement: 'Digital Clock / Timer',
        visualCue: '30-second countdown timer active.',
        images: {
          overviewLocator: { xPercent: 52, yPercent: 62, regionName: 'CENTER PEDESTAL (CHRONO)' },
          detailCloseup: {
            title: '30-SECOND STABILIZATION TIMER',
            description: 'Countdown ensuring mechanical systems thermal equilibration before SEC selection.',
            focalControl: 'Chrono Timer'
          }
        },
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 30,
          label: '30S IDLE TIMER',
          actionPrompt: 'Wait 30 seconds in idle before SEC check'
        }
      },
      {
        id: '3-2',
        order: 2,
        label: 'Toe Brake Hold & SEC Authorization Callout',
        phaseType: 'VERBAL',
        description: 'Depress toe brakes firmly to hold aircraft. Speak "Clear SEC" to coordinate the check with the Chief.',
        cockpitPanel: 'Rudder Footwell / Left Sill',
        controlElement: 'Rudder Toe Brakes',
        visualCue: 'Brake deflection meter registers firm application (inverted axis aligned with HardwareView).',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL' },
          detailCloseup: {
            title: 'TOE BRAKE PEDAL FORCE',
            description: 'Both brake pedals held firmly; hydraulic calipers clamped.',
            focalControl: 'Left/Right Toe Brakes'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEAR SEC CALLOUT',
          actionPrompt: 'Hold brakes and speak "Clear SEC"'
        }
      },
      {
        id: '3-3',
        order: 3,
        label: 'ENG CONT Switch to SEC & Nozzle Closure',
        phaseType: 'ACTION',
        description: 'Lift the red safety guard on the Left Eyebrow and flip the ENG CONT switch from PRI to SEC.',
        cockpitPanel: 'Left Eyebrow Panel',
        controlElement: 'ENG CONT Switch & Red Guard',
        visualCue: 'Amber SEC caution lamp illuminates; NOZZLE % needle drops from 100% to < 5%.',
        images: {
          overviewLocator: { xPercent: 35, yPercent: 32, regionName: 'LEFT EYEBROW (ENG CONT)' },
          detailCloseup: {
            title: 'ENG CONT SWITCH & GUARD',
            description: 'Red mechanical switch guard lifted; two-position toggle switch in SEC.',
            focalControl: 'ENG CONT Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['PRI', 'SEC'],
          targetPosition: 'SEC',
          label: 'ENG CONT SWITCH',
          actionPrompt: 'Lift guard and flip ENG CONT switch to SEC'
        }
      },
      {
        id: '3-4',
        order: 4,
        label: 'Hydromechanical Fuel Spool to 73% RPM Minimum',
        phaseType: 'ACTION',
        description: 'Hold toe brakes firmly. Advance throttle forward until Tachometer reaches ≥ 73% RPM to verify hydromechanical fuel control.',
        cockpitPanel: 'Throttle Quadrant & Center Pedestal',
        controlElement: 'Throttle Grip & Tachometer',
        visualCue: 'Tachometer sweeps past 73% RPM target arc without hesitation or surging.',
        images: {
          overviewLocator: { xPercent: 52, yPercent: 62, regionName: 'CENTER PEDESTAL (TACH)' },
          detailCloseup: {
            title: 'SEC SPOOL VERIFICATION ARC',
            description: 'Green target arc from 73% to 80% RPM on tachometer indicator.',
            focalControl: 'Tachometer Target Arc'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'ADVANCE THROTTLE TO 73%',
          actionPrompt: 'Advance throttle to verify 73% RPM spool'
        }
      },
      {
        id: '3-5',
        order: 5,
        label: 'Retard to IDLE & Closed Nozzle Verification',
        phaseType: 'VERIFY',
        description: 'Retard throttle back to IDLE. Verify engine returns smoothly to idle speed and NOZZLE needle remains tightly closed at < 5%.',
        cockpitPanel: 'Throttle Quadrant & Center Pedestal',
        controlElement: 'Throttle Grip & NOZZLE Gauge',
        visualCue: 'RPM settles back to 65%; NOZZLE needle rests at < 5%.',
        images: {
          overviewLocator: { xPercent: 54, yPercent: 68, regionName: 'CENTER PEDESTAL (NOZZLE)' },
          detailCloseup: {
            title: 'EXHAUST NOZZLE POSITION INDICATOR',
            description: 'Circular gauge reading exhaust nozzle open percentage. Pointer at 0%.',
            focalControl: 'NOZZLE % Gauge'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'SEC IDLE CONFIRMED',
          actionPrompt: 'Retard throttle to IDLE and verify nozzle closed'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 04: SEC CHECK GOOD & PRIMARY (PRI) RECOVERY
  // =========================================================================
  {
    id: 4,
    code: 'STEP-04',
    title: 'SEC Check Good & Primary (PRI) Recovery',
    phase: 'ENGINE_START',
    expectedCommandName: 'SEC Check Good',
    backendStepKey: 'SecGood',
    whatHappenedLast: 'Hydromechanical fuel spool to 73% verified. Nozzle verified tightly closed in SEC idle.',
    whatToPerformNow: 'Transmit "SEC Good", switch ENG CONT back to PRI, close guard, and confirm nozzle opens to 100%.',
    whatToExpectNext: 'Chief acknowledges: "Copy." SEC lamp turns off. Nozzle blooms wide open to 100% with air motor sound.',
    cockpitVisual: {
      panelName: 'LEFT EYEBROW & CENTER PEDESTAL',
      subSystem: 'Engine Digital Electronic Control (DEC/EEC)',
      schematicType: 'ANNUNCIATOR',
      focalControls: ['ENG CONT Switch (PRI)', 'ENG CONT Guard (Down)', 'SEC Caution Lamp (Extinguished)', 'NOZZLE Position Gauge (100%)'],
      operationalState: 'Digital engine electronic control restored; nozzle fully opened in idle.',
      lookFor: 'SEC caution lamp OFF; NOZZLE position needle swings rapidly to 100%.'
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
      nozzlePosition: '100% (Open in PRI idle)',
      annunciatorsExpected: ['SEC light extinguished']
    },
    substeps: [
      {
        id: '4-1',
        order: 1,
        label: 'Verbal Transmission "SEC Good"',
        phaseType: 'VERBAL',
        description: 'Inform the crew chief that the SEC check is good while still in SEC mode. Speak "SEC Good".',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Speech recognized; Chief acknowledges "Copy" after 2.0s delay.',
        images: {
          overviewLocator: { xPercent: 35, yPercent: 32, regionName: 'LEFT EYEBROW (ENG CONT)' },
          detailCloseup: {
            title: 'SEC CHECK VERBAL CONFIRMATION',
            description: 'Chief monitors nozzle opening response upon PRI reversion.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRANSMIT SEC GOOD',
          actionPrompt: 'Speak "SEC Good" into your microphone'
        }
      },
      {
        id: '4-2',
        order: 2,
        label: 'Revert ENG CONT to PRI & Lower Guard',
        phaseType: 'ACTION',
        description: 'Snap the ENG CONT toggle switch back to PRI and seat the red mechanical safety guard flush DOWN.',
        cockpitPanel: 'Left Eyebrow Panel',
        controlElement: 'ENG CONT Switch & Red Guard',
        visualCue: 'Amber SEC caution lamp extinguishes completely.',
        images: {
          overviewLocator: { xPercent: 35, yPercent: 32, regionName: 'LEFT EYEBROW (ENG CONT)' },
          detailCloseup: {
            title: 'ENG CONT SWITCH GUARDED IN PRI',
            description: 'Red switch guard seated flush down over toggle switch in PRI position.',
            focalControl: 'ENG CONT Guard'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['PRI', 'SEC'],
          targetPosition: 'PRI',
          label: 'ENG CONT SWITCH',
          actionPrompt: 'Set switch to PRI and lower guard'
        }
      },
      {
        id: '4-3',
        order: 3,
        label: 'Nozzle Opening & CENC Acoustic Whistle',
        phaseType: 'EXPECT',
        description: 'Observe the Convergent Exhaust Nozzle Control (CENC) motor driving the exhaust petals open from < 5% to 100%.',
        cockpitPanel: 'Center Pedestal / NOZZLE Indicator',
        controlElement: 'NOZZLE Position Gauge',
        visualCue: 'NOZZLE pointer swings rapidly from 0% past 80% to 100%.',
        images: {
          overviewLocator: { xPercent: 54, yPercent: 68, regionName: 'CENTER PEDESTAL (NOZZLE)' },
          detailCloseup: {
            title: 'NOZZLE GAUGE 100% OPEN',
            description: 'Convergent exhaust flaps open to maximum exit area in primary idle.',
            focalControl: 'NOZZLE % Needle'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'NOZZLE OPEN',
          actionPrompt: 'Verify nozzle needle indicates 100% open'
        }
      },
      {
        id: '4-4',
        order: 4,
        label: 'Release Toe Brakes',
        phaseType: 'ACTION',
        description: 'Release toe brake pedal pressure. Aircraft rests securely on wheel chocks in PRI idle.',
        cockpitPanel: 'Rudder Footwell',
        controlElement: 'Left/Right Toe Brakes',
        visualCue: 'Toe brake deflection returns to zero.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL' },
          detailCloseup: {
            title: 'BRAKE PRESSURE RELEASED',
            description: 'Pedals resting in neutral; chocks holding aircraft stationary.',
            focalControl: 'Rudder Pedals'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES RELEASED',
          actionPrompt: 'Release toe brakes'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 05: PRE-EPU GROUND SAFETY & PIN REMOVAL
  // =========================================================================
  {
    id: 5,
    code: 'STEP-05',
    title: 'Pre-EPU Ground Safety & Pin Removal',
    phase: 'SECONDARY_POWER',
    expectedCommandName: 'Pull EPU Safety Pin',
    backendStepKey: 'EpuPin',
    whatHappenedLast: 'Primary engine operation verified. Preparing for Emergency Power Unit (EPU) ground run-up.',
    whatToPerformNow: 'Confirm EPU lamps are dark, set EPU switch to OFF, request pin removal ("Pull EPU Pin"), then arm EPU to NORM.',
    whatToExpectNext: 'Chief calls: "Copy." Chief pulls the EPU ground safety pin with red streamer from the right forward strake.',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE & RIGHT FORWARD STRAKE',
      subSystem: 'Emergency Power Unit (EPU) Hydrazine Turbine',
      schematicType: 'GROUND_CREW',
      focalControls: ['EPU Switch (OFF / NORM / ON)', 'EPU GEN Lamp', 'EPU PMG Lamp', 'Ground Safety Lock Pin'],
      operationalState: 'EPU safety pin removed; system armed to automatic mode (NORM).',
      lookFor: 'Chief holding red "REMOVE BEFORE FLIGHT" safety streamer outside right strake.'
    },
    pilotSpokenCalls: {
      primary: 'Pull EPU Pin',
      prefixVariants: ['Pull EPU Safety Pin', 'Remove EPU Safety Pin', 'Remove EPU Pin', 'Remove Pin'],
      synonyms: ['Chief Pull EPU Pin']
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
        controlElement: 'EPU GEN & EPU PMG Lamps',
        visualCue: 'Lamps completely unlit.',
        images: {
          overviewLocator: { xPercent: 20, yPercent: 58, regionName: 'LEFT CONSOLE (EPU PANEL)' },
          detailCloseup: {
            title: 'EPU ANNUNCIATOR LAMPS',
            description: 'Two rectangular warning lamps indicating generator/alternator trigger state.',
            focalControl: 'EPU GEN / PMG Lamps'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'LAMPS DARK',
          actionPrompt: 'Verify EPU GEN and PMG lamps are dark'
        }
      },
      {
        id: '5-2',
        order: 2,
        label: 'EPU Switch to OFF for Ground Safety',
        phaseType: 'ACTION',
        description: 'Flip the EPU switch to OFF. This electrically isolates the hydrazine catalytic starter valve while ground crew pulls the pin.',
        cockpitPanel: 'Left Console / EPU Panel',
        controlElement: 'EPU Switch (OFF / NORM / ON)',
        visualCue: 'Switch toggle seated in down OFF position.',
        images: {
          overviewLocator: { xPercent: 20, yPercent: 58, regionName: 'LEFT CONSOLE (EPU PANEL)' },
          detailCloseup: {
            title: 'EPU THREE-POSITION SWITCH',
            description: 'Heavy toggle switch with metal latch lever. Seated down in OFF position.',
            focalControl: 'EPU Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'NORM', 'ON'],
          targetPosition: 'OFF',
          label: 'EPU SWITCH',
          actionPrompt: 'Set EPU switch to OFF'
        }
      },
      {
        id: '5-3',
        order: 3,
        label: 'Verbal Callout "Pull EPU Pin" & Ground Action',
        phaseType: 'VERBAL',
        description: 'Authorize the crew chief to pull the physical ground safety pin. Speak "Pull EPU Pin" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy"; ground pin with red "REMOVE BEFORE FLIGHT" streamer removed.',
        images: {
          overviewLocator: { xPercent: 88, yPercent: 42, regionName: 'RIGHT FORWARD STRAKE' },
          detailCloseup: {
            title: 'RIGHT STRAKE EPU SAFETY PIN',
            description: 'Ground crew pulls steel safety pin and holds red streamer aloft for pilot visual check.',
            focalControl: 'EPU Ground Safety Pin'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'PULL PIN CALLOUT',
          actionPrompt: 'Speak "Pull EPU Pin" into your microphone'
        }
      },
      {
        id: '5-4',
        order: 4,
        label: 'Arm EPU to NORM & Seat Guard',
        phaseType: 'ACTION',
        description: 'Move the EPU switch up to NORM and seat the toggle guard. EPU is now armed for automated actuation in flight.',
        cockpitPanel: 'Left Console / EPU Panel',
        controlElement: 'EPU Switch & Metal Latch',
        visualCue: 'Switch locked in center NORM position.',
        images: {
          overviewLocator: { xPercent: 20, yPercent: 58, regionName: 'LEFT CONSOLE (EPU PANEL)' },
          detailCloseup: {
            title: 'EPU ARMED IN NORM POSITION',
            description: 'Switch lever locked in NORM position with safety guard seated.',
            focalControl: 'EPU Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'NORM', 'ON'],
          targetPosition: 'NORM',
          label: 'EPU SWITCH',
          actionPrompt: 'Set EPU switch to NORM'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 06: EPU HYDRAZINE FLOW & RUN-UP CHECK
  // =========================================================================
  {
    id: 6,
    code: 'STEP-06',
    title: 'EPU Hydrazine Flow & Run-Up Check',
    phase: 'SECONDARY_POWER',
    expectedCommandName: 'Cleared to check for flow',
    backendStepKey: 'CheckFlow',
    whatHappenedLast: 'EPU safety pin removed. EPU armed to NORM.',
    whatToPerformNow: 'Check flow ("Check Flow"), depress toe brakes firmly, spool engine to 80-85% RPM, hold EPU/GEN TEST switch for 5s, verify EPU RUN light, and retard throttle.',
    whatToExpectNext: 'Chief calls: "No flow" (1.5s delay). Green EPU RUN light illuminates during 5s test. Retard throttle to idle.',
    cockpitVisual: {
      panelName: 'LEFT AUX CONSOLE & TEST PANEL',
      subSystem: 'EPU Bleed Air Turbine & TEST Panel',
      schematicType: 'ANNUNCIATOR',
      focalControls: ['EPU/GEN TEST Switch', 'EPU RUN Light (Green)', 'AIR Light (Amber)', 'Throttle (80-85% RPM)', 'Toe Brakes'],
      operationalState: 'High-pressure engine bleed air driving EPU turbine during ground functional test.',
      lookFor: 'Green circular EPU RUN light illuminates solid; amber AIR light illuminates.'
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
      annunciatorsExpected: ['EPU RUN light (Green solid)', 'AIR light (Amber)'],
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
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief replies "No flow" after 1.5s delay (confirming no uncommanded hydrazine leaks).',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'TEST PANEL FLOW CHECK',
            description: 'Pilot requests flow check clearance prior to high-thrust run-up.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CHECK FLOW CALLOUT',
          actionPrompt: 'Speak "Check Flow" into your microphone'
        }
      },
      {
        id: '6-2',
        order: 2,
        label: 'Mandatory Toe Brakes Hold & Spool to 80-85% RPM',
        phaseType: 'ACTION',
        description: 'Depress toe brakes firmly. Advance throttle forward to 80–85% RPM to generate bleed air pressure for the EPU turbine.',
        cockpitPanel: 'Rudder Footwell & Throttle Quadrant',
        controlElement: 'Toe Brakes & Throttle Grip',
        visualCue: 'Brakes held firm; Tachometer needle stabilizes between 80% and 85% RPM.',
        images: {
          overviewLocator: { xPercent: 52, yPercent: 62, regionName: 'CENTER PEDESTAL (TACH)' },
          detailCloseup: {
            title: '80–85% BLEED AIR TARGET ARC',
            description: 'Tachometer indicating sufficient core compressor speed for bleed air extraction.',
            focalControl: 'Tachometer Dial'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'HOLD BRAKES & SPOOL 82%',
          actionPrompt: 'Hold toe brakes and advance throttle to ~82% RPM'
        }
      },
      {
        id: '6-3',
        order: 3,
        label: 'EPU/GEN TEST Switch Actuation (5s Countdown)',
        phaseType: 'ACTION',
        description: 'Click and hold the spring-loaded EPU/GEN TEST switch in the TEST position for 5 seconds.',
        cockpitPanel: 'Left Aux Console / TEST Panel',
        controlElement: 'EPU/GEN TEST Switch',
        visualCue: '5-second countdown fills; green EPU RUN lamp illuminates solid; amber AIR lamp illuminates.',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'EPU/GEN TEST TOGGLE & RUN LAMP',
            description: 'Spring-loaded switch held in TEST position with green circular RUN light illuminated.',
            focalControl: 'EPU/GEN TEST Switch'
          }
        },
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 5,
          label: 'HOLD TEST SWITCH (5S)',
          actionPrompt: 'Hold EPU/GEN TEST switch for 5 seconds'
        }
      },
      {
        id: '6-4',
        order: 4,
        label: 'Throttle Retard to IDLE & Lamp Extinguishment',
        phaseType: 'VERIFY',
        description: 'Release test switch. Retard throttle back to IDLE (~65% RPM). Release toe brakes. Verify green EPU RUN light extinguishes.',
        cockpitPanel: 'Throttle Quadrant & TEST Panel',
        controlElement: 'Throttle Grip & EPU RUN Lamp',
        visualCue: 'RPM settles to 65%; EPU RUN and AIR lamps turn dark.',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'TEST PANEL LAMPS EXTINGUISHED',
            description: 'Bleed air drive terminated; EPU turbine coasting to stop.',
            focalControl: 'EPU RUN Lamp'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RETARD TO IDLE',
          actionPrompt: 'Retard throttle to IDLE and verify lamps dark'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 07: FLIGHT CONTROLS CLEAR
  // =========================================================================
  {
    id: 7,
    code: 'STEP-07',
    title: 'Flight Controls Clear',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Flight Controls Clear',
    backendStepKey: 'ControlsClear',
    whatHappenedLast: 'EPU flow and bleed air run-up check complete. Preparing for Flight Control System (FLCS) tests.',
    whatToPerformNow: 'Look out canopy left and right, verify ground crew is outside the 6-foot wingtip perimeter, transmit "Flight Controls Clear", then cycle stick and pedals for 15-20 seconds to warm hydraulic actuators prior to BIT.',
    whatToExpectNext: 'Chief responds: "Flight controls clear."',
    cockpitVisual: {
      panelName: 'CANOPY FIELD-OF-VIEW & WINGTIPS',
      subSystem: 'External Flight Control Surface Clearance Boundary',
      schematicType: 'GROUND_CREW',
      focalControls: ['Canopy Field of View', 'Port Wingtip Clearance', 'Starboard Wingtip Clearance'],
      operationalState: 'Ground crew cleared outside 6-foot surface deflection perimeter.',
      lookFor: 'Crew Chief visible outside port wingtip clear zone giving visual thumbs-up.'
    },
    pilotSpokenCalls: {
      primary: 'Flight Controls Clear',
      prefixVariants: ['Chief Flight Controls Clear', 'Controls Clear'],
      synonyms: ['Confirm Flight Controls Clear']
    },
    expectedChiefResponse: 'Flight controls clear.',
    substeps: [
      {
        id: '7-1',
        order: 1,
        label: 'Authentic Canopy Perimeter Clearance Scan',
        phaseType: 'VERIFY',
        description: 'Visually scan out canopy left and right. Confirm all ground personnel have stepped back beyond the 6-foot wingtip clearance perimeter.',
        cockpitPanel: 'Canopy Field of View',
        controlElement: 'Canopy Arch Left/Right',
        visualCue: 'Chief outside port wingtip giving thumbs-up; safety boundary clear.',
        images: {
          overviewLocator: { xPercent: 10, yPercent: 30, regionName: 'PORT WINGTIP PERIMETER' },
          detailCloseup: {
            title: 'WINGTIP EXCLUSION ZONE',
            description: '6-foot clearance zone marked around flaperons, stabilators, and rudder.',
            focalControl: 'Clearance Perimeter'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'PERIMETER CLEAR',
          actionPrompt: 'Verify ground crew is clear outside wingtips'
        }
      },
      {
        id: '7-2',
        order: 2,
        label: 'Verbal Transmission "Flight Controls Clear"',
        phaseType: 'VERBAL',
        description: 'Transmit flight controls clearance to the Chief over the ground interphone line. Speak "Flight Controls Clear".',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Flight controls clear."',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 68, regionName: 'LEFT CONSOLE (HOTAS MIC)' },
          detailCloseup: {
            title: 'FLIGHT CONTROLS CLEAR TRANSMISSION',
            description: 'Chief confirms physical clearance for surface actuation.',
            focalControl: 'Interphone Line'
          }
        },
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
        cockpitPanel: 'Cockpit Flight Controls / Stick & Pedals',
        controlElement: 'Flight Control Stick & Rudder Pedals',
        visualCue: 'Stick and rudder deflect smoothly; hydraulic fluid circulation warms servo valves.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 75, regionName: 'CENTER STICK & RUDDER PEDALS' },
          detailCloseup: {
            title: 'FLIGHT CONTROL HYDRAULIC WARM-UP',
            description: 'Freely cycle stick and pedals for 15-20 seconds to warm actuators prior to FLCS BIT.',
            focalControl: 'Flight Controls'
          }
        },
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
    code: 'STEP-08',
    title: 'Cleared for FLCS Built-In Test (BIT)',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Cleared for Bit',
    backendStepKey: 'FlcsBit',
    whatHappenedLast: 'Flight controls cycled freely for 15-20s and hydraulic fluid warmed up. Aircraft ready for autonomous FLCS self-test.',
    whatToPerformNow: 'Authorize BIT ("Cleared for BIT"), click FLCS BIT switch to BIT, keep hands and feet off controls for 45s, verify green RUN light, and check FAIL light dark.',
    whatToExpectNext: 'Chief calls: "Cleared for BIT." Switch magnetically latches in BIT. Surfaces animate automated sweep. Switch returns to OFF after 45s.',
    cockpitVisual: {
      panelName: 'LEFT AUX CONSOLE / TEST PANEL',
      subSystem: 'Quadruplex Digital Flight Control System (FLCS)',
      schematicType: 'STICK_RUDDER',
      focalControls: ['FLCS BIT Switch (Magnetic Latch)', 'FLCS RUN Light (Green)', 'FLCS FAIL Light (Amber)', 'Flaperons', 'Stabilators', 'Rudder'],
      operationalState: 'Autonomous 45-second pre-programmed surface deflection self-test.',
      lookFor: 'Green RUN light illuminated; surfaces deflecting autonomously; amber FAIL light dark at completion.'
    },
    pilotSpokenCalls: {
      primary: 'Cleared for BIT',
      prefixVariants: ['Ready for BIT', 'Chief Cleared for BIT', 'Clear for FLCS BIT', 'BIT Check'],
      synonyms: ['Clear for Bit', 'Ready Bit']
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
        label: 'Verbal Authorization "Cleared for BIT"',
        phaseType: 'VERBAL',
        description: 'Coordinate the automated BIT cycle with the Chief. Speak "Cleared for BIT" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Cleared for BIT."',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'FLCS BIT AUTHORIZATION',
            description: 'Chief stands by to observe automated control surface deflections.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEARED FOR BIT CALLOUT',
          actionPrompt: 'Speak "Cleared for BIT" into your microphone'
        }
      },
      {
        id: '8-2',
        order: 2,
        label: 'FLCS BIT Switch Magnetic Latch',
        phaseType: 'ACTION',
        description: 'Click the FLCS BIT switch to snap to BIT. The switch magnetically latches in position and the green RUN light illuminates.',
        cockpitPanel: 'Left Aux Console / TEST Panel',
        controlElement: 'FLCS BIT Switch & RUN Lamp',
        visualCue: 'Switch holds magnetically; circular green RUN lamp illuminates solid.',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'FLCS BIT SWITCH & ANNUNCIATOR',
            description: 'Electromagnetically held switch toggle with green circular RUN indicator.',
            focalControl: 'FLCS BIT Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'TRIGGER FLCS BIT',
          actionPrompt: 'Click switch to trigger magnetically latched BIT'
        }
      },
      {
        id: '8-3',
        order: 3,
        label: 'Hands-Off 45-Second Surface Sweep Cycle',
        phaseType: 'EXPECT',
        description: 'Keep hands and feet completely off controls for 45 seconds while the FLCS runs sequential deflections: Flaperons (0-15s), Stabilators (15-30s), Rudder & LEFs (30-45s).',
        cockpitPanel: 'External Aircraft Flight Surfaces',
        controlElement: 'Autonomous Surface Deflections',
        visualCue: '45-second circular progress ring fills as surfaces cycle through automated patterns.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 40, regionName: 'AIRCRAFT CONTROL SURFACES' },
          detailCloseup: {
            title: 'AUTONOMOUS BIT DEFLECTION PATTERNS',
            description: 'Differential flaperons, symmetric pitch stabilators, and full yaw sweeps.',
            focalControl: 'Control Surfaces'
          }
        },
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 45,
          label: 'HANDS-OFF BIT (45S)',
          actionPrompt: 'Hands and feet off controls during 45s test'
        }
      },
      {
        id: '8-4',
        order: 4,
        label: 'Test Pass Lamp Verification',
        phaseType: 'VERIFY',
        description: 'Verify FLCS BIT switch snaps magnetically back to OFF. Green RUN lamp extinguishes. Verify amber FAIL lamp remains unlit.',
        cockpitPanel: 'Left Aux Console / TEST Panel',
        controlElement: 'FLCS FAIL Lamp',
        visualCue: 'Switch returns to OFF; green RUN lamp dark; amber FAIL lamp dark.',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 52, regionName: 'LEFT AUX CONSOLE (TEST PANEL)' },
          detailCloseup: {
            title: 'FLCS BIT TEST PASS INDICATION',
            description: 'RUN light dark, FAIL light dark, confirming all 4 FLCS electronic branches passed.',
            focalControl: 'FLCS FAIL Lamp'
          }
        },
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
    code: 'STEP-09',
    title: 'Ready for Trim Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Ready for Trim Check',
    backendStepKey: 'ReadyTrim',
    whatHappenedLast: 'FLCS BIT completed successfully. All quad branches operational.',
    whatToPerformNow: 'Verify Manual Trim indicator needles read zero neutral, then transmit "Ready Trim".',
    whatToExpectNext: 'Chief responds: "Ready for trim check."',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE / MANUAL TRIM PANEL',
      subSystem: 'Manual Trim Potentiometers & Indicators',
      schematicType: 'DIAL',
      focalControls: ['ROLL TRIM Wheel', 'PITCH TRIM Wheel', 'YAW TRIM Wheel', 'Trim Indicator Dials'],
      operationalState: 'Roll, pitch, and yaw manual trim pointers aligned with zero index marks.',
      lookFor: 'Three white pointers aligned vertically with the center 0 index marks.'
    },
    pilotSpokenCalls: {
      primary: 'Ready Trim',
      prefixVariants: ['Ready for Trim Check', 'Chief Ready Trim', 'Ready for Trim'],
      synonyms: ['Trim Check Ready']
    },
    expectedChiefResponse: 'Ready for trim check.',
    substeps: [
      {
        id: '9-1',
        order: 1,
        label: 'Baseline Trim Gauge Neutral Verification',
        phaseType: 'VERIFY',
        description: 'Verify the three circular indicator dials on the Manual Trim panel (Roll, Pitch, Yaw) align with the white zero centerlines.',
        cockpitPanel: 'Left Console / MANUAL TRIM',
        controlElement: 'Trim Indicator Dials',
        visualCue: 'All three indicator needles read zero neutral.',
        images: {
          overviewLocator: { xPercent: 24, yPercent: 62, regionName: 'LEFT CONSOLE (MANUAL TRIM)' },
          detailCloseup: {
            title: 'MANUAL TRIM INDICATOR DIALS',
            description: 'Three analog dials showing trim displacement for Roll, Pitch, and Yaw.',
            focalControl: 'Trim Dials'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'TRIMS AT ZERO',
          actionPrompt: 'Verify all three trim needles are centered'
        }
      },
      {
        id: '9-2',
        order: 2,
        label: 'Verbal Callout "Ready Trim"',
        phaseType: 'VERBAL',
        description: 'Request trim check initiation from the Chief. Speak "Ready Trim" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Ready for trim check."',
        images: {
          overviewLocator: { xPercent: 24, yPercent: 62, regionName: 'LEFT CONSOLE (MANUAL TRIM)' },
          detailCloseup: {
            title: 'TRIM CHECK COORDINATION',
            description: 'Chief prepares to monitor trim disconnect and surface drive circuits.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY TRIM CALLOUT',
          actionPrompt: 'Speak "Ready Trim" into your microphone'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 10: TRIM DISCONNECTED CHECK
  // =========================================================================
  {
    id: 10,
    code: 'STEP-10',
    title: 'Trim Disconnected Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Trim Disconnected',
    backendStepKey: 'TrimDisc',
    whatHappenedLast: 'Chief acknowledged trim check. Ready to verify electrical disconnect circuit.',
    whatToPerformNow: 'Flip TRIM/AP DISC switch to DISC, transmit "Trim Disconnected", actuate stick trim hat in 4 directions, and verify trim needles do not move.',
    whatToExpectNext: 'Chief calls: "Copy." Trim indicator needles remain completely frozen at zero.',
    cockpitVisual: {
      panelName: 'MISC PANEL & FLIGHT STICK GRIP',
      subSystem: 'Autopilot / Trim Disconnect Circuit & Stick Hat',
      schematicType: 'SWITCH',
      focalControls: ['TRIM/AP DISC Switch (DISC)', '4-Way Castle Trim Hat', 'Roll/Pitch/Yaw Trim Dials'],
      operationalState: 'Trim electrical drive isolated via disconnect switch; zero response to stick trim hat.',
      lookFor: 'Trim/AP switch in DISC; trim indicator dials motionless when hat is actuated.'
    },
    pilotSpokenCalls: {
      primary: 'Trim Disconnected',
      prefixVariants: ['Chief Trim Disconnected', 'Trim Disc'],
      synonyms: ['Trim Disconnect']
    },
    expectedChiefResponse: 'Copy. (Trim hat produces zero needle movement).',
    substeps: [
      {
        id: '10-1',
        order: 1,
        label: 'Select TRIM/AP DISC to DISC',
        phaseType: 'ACTION',
        description: 'Push the two-position TRIM/AP DISC switch forward into the DISC position on the MISC panel.',
        cockpitPanel: 'MISC Panel (Left Quarter)',
        controlElement: 'TRIM/AP DISC Switch',
        visualCue: 'Toggle switch seated in forward DISC position.',
        images: {
          overviewLocator: { xPercent: 32, yPercent: 44, regionName: 'MISC PANEL' },
          detailCloseup: {
            title: 'TRIM / AP DISC SWITCH',
            description: 'Two-position lever switch (NORM - DISC). Moved to DISC.',
            focalControl: 'TRIM/AP DISC Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['DISC', 'NORM'],
          targetPosition: 'DISC',
          label: 'TRIM/AP DISC SWITCH',
          actionPrompt: 'Set switch to DISC position'
        }
      },
      {
        id: '10-2',
        order: 2,
        label: 'Verbal Transmission "Trim Disconnected"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that trim is disconnected. Speak "Trim Disconnected" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy."',
        images: {
          overviewLocator: { xPercent: 32, yPercent: 44, regionName: 'MISC PANEL' },
          detailCloseup: {
            title: 'TRIM DISCONNECTED CALLOUT',
            description: 'Chief monitors ground feedback for zero surface motion.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRIM DISC CALLOUT',
          actionPrompt: 'Speak "Trim Disconnected" into your microphone'
        }
      },
      {
        id: '10-3',
        order: 3,
        label: 'Actuate 4-Way Stick Trim Hat',
        phaseType: 'ACTION',
        description: 'Push the 4-way castle trim hat on the flight stick UP, DOWN, LEFT, RIGHT. Verify trim indicator needles remain completely frozen at zero.',
        cockpitPanel: 'Right Side Console / Flight Stick Grip',
        controlElement: '4-Way Castle Trim Hat Switch',
        visualCue: 'Trim indicator needles show zero deflection.',
        images: {
          overviewLocator: { xPercent: 78, yPercent: 60, regionName: 'FLIGHT STICK GRIP' },
          detailCloseup: {
            title: '4-WAY CASTLE TRIM HAT SWITCH',
            description: 'Castle-top multi-directional switch actuated in 4 directions.',
            focalControl: 'Trim Hat Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'TEST 4-WAY TRIM HAT',
          actionPrompt: 'Click D-pad to test trim hat disconnect'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 11: TRIM CONNECTED & NEEDLE MOVEMENT CHECK
  // =========================================================================
  {
    id: 11,
    code: 'STEP-11',
    title: 'Trim Connected & Needle Movement Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Trim Connected',
    backendStepKey: 'TrimConn',
    whatHappenedLast: 'Trim disconnect verified. Hat produced zero needle motion.',
    whatToPerformNow: 'Return TRIM/AP switch to NORM, transmit "Trim Connected", listen to Chief call out 6 axis deflections (1.5s each), then manually re-center all trims to zero.',
    whatToExpectNext: 'Chief calls: "Copy." Chief calls out deflections: Nose Up, Nose Down, Roll Left, Roll Right, Yaw Left, Yaw Right (1.5s intervals). Pilot manually re-centers trims.',
    cockpitVisual: {
      panelName: 'MISC PANEL & MANUAL TRIM PANEL',
      subSystem: 'Normal Trim Circuits & Indicator Dials',
      schematicType: 'DIAL',
      focalControls: ['TRIM/AP DISC Switch (NORM)', 'ROLL TRIM Dial', 'PITCH TRIM Dial', 'YAW TRIM Dial'],
      operationalState: 'Trim drive re-connected; needle deflections confirmed; manually returned to zero neutral.',
      lookFor: 'Needles deflect on Chief callouts, then manually returned to exact white zero marks.'
    },
    pilotSpokenCalls: {
      primary: 'Trim Connected',
      prefixVariants: ['Chief Trim Connected', 'Trim Normal', 'Trim in Norm'],
      synonyms: ['Trim Connect']
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
        controlElement: 'TRIM/AP DISC Switch',
        visualCue: 'Switch seated in center NORM position.',
        images: {
          overviewLocator: { xPercent: 32, yPercent: 44, regionName: 'MISC PANEL' },
          detailCloseup: {
            title: 'TRIM / AP DISC SWITCH IN NORM',
            description: 'Two-position switch returned to NORM position.',
            focalControl: 'TRIM/AP DISC Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['DISC', 'NORM'],
          targetPosition: 'NORM',
          label: 'TRIM/AP DISC SWITCH',
          actionPrompt: 'Set switch to NORM position'
        }
      },
      {
        id: '11-2',
        order: 2,
        label: 'Verbal Transmission "Trim Connected"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that trim is connected. Speak "Trim Connected" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy."',
        images: {
          overviewLocator: { xPercent: 32, yPercent: 44, regionName: 'MISC PANEL' },
          detailCloseup: {
            title: 'TRIM CONNECTED CALLOUT',
            description: 'Chief initiates visual observation of surface deflections.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'TRIM CONNECTED CALLOUT',
          actionPrompt: 'Speak "Trim Connected" into your microphone'
        }
      },
      {
        id: '11-3',
        order: 3,
        label: 'Axis Deflection Sequence with Chief Callouts',
        phaseType: 'EXPECT',
        description: 'Listen to the Chief call out deflections with 1.5s intervals: "Nose Up", "Nose Down", "Roll Left", "Roll Right", "Yaw Left", "Yaw Right". Observe dials deflect.',
        cockpitPanel: 'Left Console / MANUAL TRIM',
        controlElement: 'Trim Indicator Dials',
        visualCue: 'Trim pointers deflect clockwise and counter-clockwise matching Chief callouts.',
        images: {
          overviewLocator: { xPercent: 24, yPercent: 62, regionName: 'LEFT CONSOLE (MANUAL TRIM)' },
          detailCloseup: {
            title: 'TRIM DIAL DEFLECTIONS',
            description: 'Indicators showing deflection corresponding to 6 directional callouts.',
            focalControl: 'Trim Dial Pointers'
          }
        },
        interactiveControl: {
          type: 'TIMER_COUNTDOWN',
          durationSeconds: 9,
          label: 'AXIS CALLOUTS (9S)',
          actionPrompt: 'Observe 6-axis trim deflection sequence'
        }
      },
      {
        id: '11-4',
        order: 4,
        label: 'Manual Trim Centering to Neutral Zero Index',
        phaseType: 'ACTION',
        description: 'Manually center all three trim wheels until the Roll, Pitch, and Yaw pointers align precisely with the white zero centerlines.',
        cockpitPanel: 'Left Console / MANUAL TRIM',
        controlElement: 'Roll, Pitch, Yaw Trim Wheels',
        visualCue: 'All three pointers aligned vertically with the zero index marks.',
        images: {
          overviewLocator: { xPercent: 24, yPercent: 62, regionName: 'LEFT CONSOLE (MANUAL TRIM)' },
          detailCloseup: {
            title: 'ZERO NEUTRAL INDEX ALIGNMENT',
            description: 'Three analog dials with pointers resting on zero index marks.',
            focalControl: 'Manual Trim Centerlines'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'MANUAL RE-CENTER COMPLETE',
          actionPrompt: 'Verify all three trim needles are centered at 0'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 12: CLEAR FOR BIG MOVEMENTS (FLIGHT CONTROLS CYCLE)
  // =========================================================================
  {
    id: 12,
    code: 'STEP-12',
    title: 'Clear for Big Movements (Flight Controls Cycle)',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Clear for Big Movements',
    backendStepKey: 'BigMovements',
    whatHappenedLast: 'Trims checked and manually centered at zero index.',
    whatToPerformNow: 'Request clearance ("Clear Big Movements"), cycle Roll (left/right), cycle Pitch (Nose Up then Down), test MPO kick while holding Nose Down, cycle Yaw, and cycle Speedbrakes.',
    whatToExpectNext: 'Chief calls: "Flight controls still clear." Surfaces deflect to full travel stops. Speedbrakes open and close on Chief callouts.',
    cockpitVisual: {
      panelName: 'FLIGHT STICK, RUDDER PEDALS & MISC PANEL',
      subSystem: 'Primary Flight Control Surface Actuators',
      schematicType: 'STICK_RUDDER',
      focalControls: ['Flight Stick Grip', 'Rudder Pedals', 'MPO Switch (OVRD)', 'Speedbrake Switch', 'Flaperons', 'Stabilators', 'Rudder', 'Speedbrake Petals'],
      operationalState: 'Full physical surface deflection sweeps; MPO over-travel kick verified; speedbrakes cycled.',
      lookFor: 'Full mechanical deflection of flaperons (+/-20°), stabilators (+25°/-15°), MPO kick down, rudder (+/-30°), speedbrake petals (60°).'
    },
    pilotSpokenCalls: {
      primary: 'Clear Big Movements',
      prefixVariants: ['Clear for Big Movements', 'Chief Clear Big Movements', 'Big Movements', 'Cycle Controls'],
      synonyms: ['Wiggle Surfaces', 'Ready Big Movements']
    },
    expectedChiefResponse: 'Flight controls still clear. (Roll -> Pitch -> MPO kick -> Yaw -> Speedbrakes).',
    substeps: [
      {
        id: '12-1',
        order: 1,
        label: 'Verbal Callout "Clear Big Movements"',
        phaseType: 'VERBAL',
        description: 'Request clearance for full control surface sweeps. Speak "Clear Big Movements" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Flight controls still clear."',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 40, regionName: 'AIRCRAFT CONTROL SURFACES' },
          detailCloseup: {
            title: 'BIG MOVEMENTS AUTHORIZATION',
            description: 'Chief verifies physical perimeter clearance around tail and wings.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'BIG MOVEMENTS CALLOUT',
          actionPrompt: 'Speak "Clear Big Movements" into your microphone'
        }
      },
      {
        id: '12-2',
        order: 2,
        label: 'Roll Axis Deflection (Left then Right)',
        phaseType: 'ACTION',
        description: 'Move the flight stick full left, then full right. Observe flaperons deflect differentially (+/-20°).',
        cockpitPanel: 'Flight Stick / Wings',
        controlElement: 'Flight Stick Roll Axis & Flaperons',
        visualCue: 'Roll axis meter registers full deflection; flaperons sweep full travel.',
        images: {
          overviewLocator: { xPercent: 78, yPercent: 60, regionName: 'FLIGHT STICK GRIP' },
          detailCloseup: {
            title: 'ROLL AXIS DEFLECTION',
            description: 'Left stick deflects left flaperon up, right down; right stick reverses.',
            focalControl: 'Flaperon Deflection'
          }
        },
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'roll',
          axisThreshold: 0.15,
          label: 'ROLL AXIS TEST',
          actionPrompt: 'Move stick full left, then full right (or skip)'
        }
      },
      {
        id: '12-3',
        order: 3,
        label: 'Pitch Axis Deflection (Nose Up then Nose Down)',
        phaseType: 'ACTION',
        description: 'Pull the flight stick full aft (Nose Up, stabilators +25° TEU), then push full forward (Nose Down, stabilators -15° TED). Hold stick full forward for MPO test.',
        cockpitPanel: 'Flight Stick / Horizontal Stabilators',
        controlElement: 'Flight Stick Pitch Axis & Stabilators',
        visualCue: 'Pitch axis meter registers full travel; stabilators sweep symmetric pitch.',
        images: {
          overviewLocator: { xPercent: 78, yPercent: 60, regionName: 'FLIGHT STICK GRIP' },
          detailCloseup: {
            title: 'PITCH AXIS DEFLECTION',
            description: 'Symmetric all-moving horizontal tail stabilator sweeps.',
            focalControl: 'Stabilator Deflection'
          }
        },
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'pitch',
          axisThreshold: 0.15,
          label: 'PITCH AXIS TEST',
          actionPrompt: 'Pull full aft, then push full forward and hold'
        }
      },
      {
        id: '12-4',
        order: 4,
        label: 'MPO Switch Actuation ("MPO Kick" Test during Nose Down)',
        phaseType: 'ACTION',
        description: 'While holding flight stick forward in Nose Down, actuate the physical MPO switch to OVRD on your hardware throttle. Observe stabilators kick downward an additional 5° to 8°. Release switch to NORM and release stick.',
        cockpitPanel: 'MISC Panel (Left Quarter)',
        controlElement: 'MPO Switch (NORM / OVRD)',
        visualCue: 'Stabilators kick downward past mechanical stop; MPO returns to NORM.',
        images: {
          overviewLocator: { xPercent: 32, yPercent: 44, regionName: 'MISC PANEL (MPO)' },
          detailCloseup: {
            title: 'MANUAL PITCH OVERRIDE (MPO) SWITCH',
            description: 'Physical spring-loaded toggle switch held in OVRD position while stick is held forward.',
            focalControl: 'MPO Switch'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'MPO HARDWARE SWITCH',
          actionPrompt: 'Actuate physical MPO switch on throttle while stick is forward'
        }
      },
      {
        id: '12-5',
        order: 5,
        label: 'Yaw Axis Deflection (Rudder Left then Right)',
        phaseType: 'ACTION',
        description: 'Push left rudder pedal full travel, then right rudder pedal full travel. Observe vertical fin rudder deflects +/-30°.',
        cockpitPanel: 'Rudder Footwell / Vertical Fin',
        controlElement: 'Rudder Pedals & Vertical Rudder',
        visualCue: 'Yaw axis meter registers full deflection; rudder sweeps left and right.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL' },
          detailCloseup: {
            title: 'YAW RUDDER DEFLECTION',
            description: 'Full 30-degree mechanical rudder travel on vertical stabilizer.',
            focalControl: 'Vertical Fin Rudder'
          }
        },
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'yaw',
          axisThreshold: 0.15,
          label: 'YAW AXIS TEST',
          actionPrompt: 'Push full left pedal, then full right pedal (or skip)'
        }
      },
      {
        id: '12-6',
        order: 6,
        label: 'Speedbrake Cycle (OPEN then CLOSE)',
        phaseType: 'ACTION',
        description: 'Slide throttle speedbrake switch aft to OPEN (petals deploy 60°, Chief calls "Speed brakes open"), then push forward to CLOSE (petals snap flush, Chief calls "Speed brakes closed").',
        cockpitPanel: 'Throttle Quadrant / Fuselage Clamshell',
        controlElement: 'Speedbrake Slide Switch & Petals',
        visualCue: 'Upper and lower clamshell petals open 60° then snap closed flush.',
        images: {
          overviewLocator: { xPercent: 12, yPercent: 72, regionName: 'LEFT CONSOLE (THROTTLE)' },
          detailCloseup: {
            title: 'THROTTLE SPEEDBRAKE SWITCH',
            description: '3-position momentary slide switch on inboard throttle grip.',
            focalControl: 'Speedbrake Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OPEN', 'HOLD', 'CLOSE'],
          targetPosition: 'CLOSE',
          label: 'SPEEDBRAKE SWITCH',
          actionPrompt: 'Cycle speedbrake switch OPEN then CLOSE'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 13: DIGITAL BACKUP (DBU) STILL CLEAR CHECK
  // =========================================================================
  {
    id: 13,
    code: 'STEP-13',
    title: 'Digital Backup (DBU) Still Clear Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'DBU Still Clear',
    backendStepKey: 'DbuCheck',
    whatHappenedLast: 'Primary flight control big movements and MPO kick verified.',
    whatToPerformNow: 'Transmit "DBU Still Clear", lift guard and flip DBU switch to ON, verify yellow DBU ON lamp, cycle controls (Chief acknowledges deflections), then return switch to OFF and lower guard.',
    whatToExpectNext: 'Chief calls: "Flight controls still clear." Surfaces respond under backup software law with Chief acknowledgments.',
    cockpitVisual: {
      panelName: 'FLCS PANEL & LEFT EYEBROW',
      subSystem: 'Digital Backup Software Flight Law (DBU)',
      schematicType: 'SWITCH',
      focalControls: ['DIGITAL BACKUP Switch (ON)', 'DBU Switch Guard', 'DBU ON Caution Lamp (Yellow)'],
      operationalState: 'Digital Backup software law active; primary flight software bypassed.',
      lookFor: 'Yellow DBU ON caution lamp illuminated on left eyebrow.'
    },
    pilotSpokenCalls: {
      primary: 'DBU Still Clear',
      prefixVariants: ['Chief DBU Still Clear', 'DBU Clear'],
      synonyms: ['Digital Backup Clear']
    },
    expectedChiefResponse: 'Flight controls still clear. (Chief confirms surface movements in DBU).',
    substeps: [
      {
        id: '13-1',
        order: 1,
        label: 'Verbal Transmission "DBU Still Clear"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that DBU check is starting. Speak "DBU Still Clear" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Flight controls still clear."',
        images: {
          overviewLocator: { xPercent: 16, yPercent: 48, regionName: 'FLCS PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'DBU CHECK CLEARANCE',
            description: 'Chief stands by to observe control deflections under backup law.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'DBU CLEAR CALLOUT',
          actionPrompt: 'Speak "DBU Still Clear" into your microphone'
        }
      },
      {
        id: '13-2',
        order: 2,
        label: 'DBU Switch to ON',
        phaseType: 'ACTION',
        description: 'Lift the red safety guard on the FLCS panel and flip the DIGITAL BACKUP switch to ON.',
        cockpitPanel: 'Left Console / FLCS Panel',
        controlElement: 'DIGITAL BACKUP Switch & Guard',
        visualCue: 'Yellow DBU ON caution lamp illuminates solid on left eyebrow.',
        images: {
          overviewLocator: { xPercent: 16, yPercent: 48, regionName: 'FLCS PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'DIGITAL BACKUP SWITCH & RED GUARD',
            description: 'Red guarded toggle switch on FLCS panel lifted and set to ON.',
            focalControl: 'DBU Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'ON'],
          targetPosition: 'ON',
          label: 'DBU SWITCH',
          actionPrompt: 'Lift guard and flip DBU switch to ON'
        }
      },
      {
        id: '13-3',
        order: 3,
        label: 'Flight Control Input in DBU Law with Chief Acknowledgment',
        phaseType: 'ACTION',
        description: 'Deflect stick and rudder slightly. Observe surfaces respond under analog backup software law with Chief visual confirmation.',
        cockpitPanel: 'Flight Stick / Rudder',
        controlElement: 'Flight Controls in DBU',
        visualCue: 'Surfaces deflect smoothly; Chief acknowledges deflection.',
        images: {
          overviewLocator: { xPercent: 78, yPercent: 60, regionName: 'FLIGHT STICK GRIP' },
          detailCloseup: {
            title: 'DBU SURFACE DEFLECTION RESPONSE',
            description: 'Simplified pitch and roll rate feedback laws governing surfaces.',
            focalControl: 'Stick Deflection'
          }
        },
        interactiveControl: {
          type: 'MOCK_BUTTON',
          label: 'DEFLECT CONTROLS IN DBU',
          actionPrompt: 'Deflect stick to test backup law response'
        }
      },
      {
        id: '13-4',
        order: 4,
        label: 'DBU Switch to OFF & Guard Down',
        phaseType: 'ACTION',
        description: 'Flip the DIGITAL BACKUP switch back to OFF and seat the red safety guard flush DOWN.',
        cockpitPanel: 'Left Console / FLCS Panel',
        controlElement: 'DIGITAL BACKUP Switch & Guard',
        visualCue: 'Yellow DBU ON caution lamp extinguishes.',
        images: {
          overviewLocator: { xPercent: 16, yPercent: 48, regionName: 'FLCS PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'DBU GUARDED IN OFF POSITION',
            description: 'Red switch guard seated flush down over toggle switch.',
            focalControl: 'DBU Switch Guard'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['OFF', 'ON'],
          targetPosition: 'OFF',
          label: 'DBU SWITCH',
          actionPrompt: 'Set switch to OFF and lower guard'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 14: READY LEFT BRAKE CHECK
  // =========================================================================
  {
    id: 14,
    code: 'STEP-14',
    title: 'Ready Left Brake Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Ready Left Brake',
    backendStepKey: 'LeftBrake',
    whatHappenedLast: 'DBU check complete and switch guarded in OFF.',
    whatToPerformNow: 'Transmit "Ready Left Brake", wait for Chief ("Ready left brake"), then depress left toe brake firmly for 3 seconds.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready left brake." Chief verifies left caliper clamping and zero hydraulic leaks.',
    cockpitVisual: {
      panelName: 'LEFT RUDDER TOE BRAKE & LEFT MAIN GEAR',
      subSystem: 'Normal Hydraulic Brake Channel A & Caliper',
      schematicType: 'STICK_RUDDER',
      focalControls: ['Left Rudder Toe Brake Pedal', 'Left Main Gear Hydraulic Caliper', 'HYD PRESS A Gauge'],
      operationalState: 'Left main landing gear carbon brake disc clamped tightly under 3,000 PSI.',
      lookFor: 'Left brake caliper pucks compressed tightly onto rotor; zero fluid leakage.'
    },
    pilotSpokenCalls: {
      primary: 'Ready Left Brake',
      prefixVariants: ['Chief Ready Left Brake', 'Left Brake', 'Ready on the Left Brake'],
      synonyms: ['Left Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready left brake. (Depress left brake for 3s).',
    substeps: [
      {
        id: '14-1',
        order: 1,
        label: 'Verbal Callout "Ready Left Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that left brake check is beginning. Speak "Ready Left Brake" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy", waits 2.5s, then calls "Ready left brake."',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL (LEFT BRAKE)' },
          detailCloseup: {
            title: 'LEFT BRAKE INSPECTION COORDINATION',
            description: 'Chief positions at left main landing gear wheel well to observe caliper.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY LEFT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Left Brake" into your microphone'
        }
      },
      {
        id: '14-2',
        order: 2,
        label: 'Left Toe Brake Pressure Application (3 Seconds)',
        phaseType: 'ACTION',
        description: 'Apply firm downward pressure on the left toe brake pedal for 3 seconds. Uses inverted axis calibration matching HardwareView.',
        cockpitPanel: 'Rudder Footwell (Left Pedal)',
        controlElement: 'Left Toe Brake Pedal',
        visualCue: 'Left brake progress bar fills to 100% for 3 seconds.',
        images: {
          overviewLocator: { xPercent: 28, yPercent: 78, regionName: 'LEFT MAIN LANDING GEAR' },
          detailCloseup: {
            title: 'LEFT MAIN GEAR BRAKE CALIPER',
            description: 'Hydraulic piston pucks clamping carbon composite brake rotor disc.',
            focalControl: 'Left Brake Caliper'
          }
        },
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'left_brake',
          axisThreshold: 0.15,
          label: 'APPLY LEFT BRAKE (3S)',
          actionPrompt: 'Depress left toe brake firmly for 3s (or skip)'
        }
      },
      {
        id: '14-3',
        order: 3,
        label: 'Left Brake Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on left main landing gear.',
        cockpitPanel: 'Left Main Gear Caliper',
        controlElement: 'Caliper Hydraulic Fitting',
        visualCue: 'Zero fluid leaks; caliper clamps tight.',
        images: {
          overviewLocator: { xPercent: 28, yPercent: 78, regionName: 'LEFT MAIN LANDING GEAR' },
          detailCloseup: {
            title: 'LEFT BRAKE INTEGRITY VERIFIED',
            description: 'Inspection confirms zero hydraulic fluid seepage and pad wear within limits.',
            focalControl: 'Caliper Fitting'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'LEFT BRAKE GOOD',
          actionPrompt: 'Release left brake and proceed to right brake'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 15: READY RIGHT BRAKE CHECK
  // =========================================================================
  {
    id: 15,
    code: 'STEP-15',
    title: 'Ready Right Brake Check',
    phase: 'FLIGHT_CONTROLS',
    expectedCommandName: 'Ready Right Brake',
    backendStepKey: 'RightBrake',
    whatHappenedLast: 'Left brake inspected and verified good.',
    whatToPerformNow: 'Transmit "Ready Right Brake", wait for Chief ("Ready right brake"), then depress right toe brake firmly for 3 seconds.',
    whatToExpectNext: 'Chief calls: "Copy" (wait 2.5s) -> "Ready right brake." Chief verifies right caliper clamping and zero hydraulic leaks.',
    cockpitVisual: {
      panelName: 'RIGHT RUDDER TOE BRAKE & RIGHT MAIN GEAR',
      subSystem: 'Normal Hydraulic Brake Channel B & Caliper',
      schematicType: 'STICK_RUDDER',
      focalControls: ['Right Rudder Toe Brake Pedal', 'Right Main Gear Hydraulic Caliper', 'HYD PRESS B Gauge'],
      operationalState: 'Right main landing gear carbon brake disc clamped tightly under 3,000 PSI.',
      lookFor: 'Right brake caliper pucks compressed tightly onto rotor; zero fluid leakage.'
    },
    pilotSpokenCalls: {
      primary: 'Ready Right Brake',
      prefixVariants: ['Chief Ready Right Brake', 'Right Brake', 'Ready on the Right Brake'],
      synonyms: ['Right Brake']
    },
    expectedChiefResponse: 'Copy. (2.5s delay) -> Ready right brake. (Depress right brake for 3s).',
    substeps: [
      {
        id: '15-1',
        order: 1,
        label: 'Verbal Callout "Ready Right Brake"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that right brake check is beginning. Speak "Ready Right Brake" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy", waits 2.5s, then calls "Ready right brake."',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL (RIGHT BRAKE)' },
          detailCloseup: {
            title: 'RIGHT BRAKE INSPECTION COORDINATION',
            description: 'Chief positions at right main landing gear wheel well to observe caliper.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY RIGHT BRAKE CALLOUT',
          actionPrompt: 'Speak "Ready Right Brake" into your microphone'
        }
      },
      {
        id: '15-2',
        order: 2,
        label: 'Right Toe Brake Pressure Application (3 Seconds)',
        phaseType: 'ACTION',
        description: 'Apply firm downward pressure on the right toe brake pedal for 3 seconds. Uses inverted axis calibration matching HardwareView.',
        cockpitPanel: 'Rudder Footwell (Right Pedal)',
        controlElement: 'Right Toe Brake Pedal',
        visualCue: 'Right brake progress bar fills to 100% for 3 seconds.',
        images: {
          overviewLocator: { xPercent: 72, yPercent: 78, regionName: 'RIGHT MAIN LANDING GEAR' },
          detailCloseup: {
            title: 'RIGHT MAIN GEAR BRAKE CALIPER',
            description: 'Hydraulic piston pucks clamping carbon composite brake rotor disc.',
            focalControl: 'Right Brake Caliper'
          }
        },
        interactiveControl: {
          type: 'AXIS_MONITOR',
          axisChannel: 'right_brake',
          axisThreshold: 0.15,
          label: 'APPLY RIGHT BRAKE (3S)',
          actionPrompt: 'Depress right toe brake firmly for 3s (or skip)'
        }
      },
      {
        id: '15-3',
        order: 3,
        label: 'Right Brake Inspection Complete',
        phaseType: 'VERIFY',
        description: 'Chief confirms solid caliper clamping and zero hydraulic line leaks on right main landing gear.',
        cockpitPanel: 'Right Main Gear Caliper',
        controlElement: 'Caliper Hydraulic Fitting',
        visualCue: 'Zero fluid leaks; caliper clamps tight.',
        images: {
          overviewLocator: { xPercent: 72, yPercent: 78, regionName: 'RIGHT MAIN LANDING GEAR' },
          detailCloseup: {
            title: 'RIGHT BRAKE INTEGRITY VERIFIED',
            description: 'Inspection confirms zero hydraulic fluid seepage and pad wear within limits.',
            focalControl: 'Caliper Fitting'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RIGHT BRAKE GOOD',
          actionPrompt: 'Release right brake'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 16: READY AIR REFUELING (AAR) DOOR CHECK
  // =========================================================================
  {
    id: 16,
    code: 'STEP-16',
    title: 'Ready Air Refueling (AAR) Door Check',
    phase: 'SECONDARY_POWER',
    expectedCommandName: 'Ready AAR Door',
    backendStepKey: 'AarDoor',
    whatHappenedLast: 'Both left and right wheel brakes inspected and verified good.',
    whatToPerformNow: 'Transmit "Ready AAR Door", move AIR REFUEL switch to OPEN (blue RDY lamp on), wait for Chief ("Door open"), then move switch to CLOSE (blue lamp off).',
    whatToExpectNext: 'Chief calls: "Copy standby" (4s) -> "Ready for door check." Door slides open (4s) -> "Door open." Door closes (4s) -> "Door closed."',
    cockpitVisual: {
      panelName: 'LEFT CONSOLE (FUEL PANEL) & DORSAL SPINE',
      subSystem: 'Air Refueling Slipway Door & Eyebrow Indexer',
      schematicType: 'SWITCH',
      focalControls: ['AIR REFUEL Switch (OPEN / CLOSE)', 'AR / NWS RDY Lamp (Blue)', 'Dorsal Slipway Door'],
      operationalState: 'Dorsal slipway door cycled open and closed; flush mechanical closure confirmed.',
      lookFor: 'Blue RDY lamp illuminates when OPEN; dorsal slipway door slides fully open and closed flush.'
    },
    pilotSpokenCalls: {
      primary: 'Ready AAR Door',
      prefixVariants: ['Chief Ready AAR Door', 'AAR Door Check', 'Ready Air Refuel Door'],
      synonyms: ['AAR Door']
    },
    expectedChiefResponse: 'Copy standby. -> Ready for door check. -> Door open. -> Door closed.',
    substeps: [
      {
        id: '16-1',
        order: 1,
        label: 'Verbal Callout "Ready AAR Door"',
        phaseType: 'VERBAL',
        description: 'Inform the Chief that AAR door check is starting. Speak "Ready AAR Door" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief acknowledges "Copy standby", waits 4.0s, then calls "Ready for door check."',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 54, regionName: 'FUEL PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'AIR REFUEL DOOR COORDINATION',
            description: 'Chief positions to visually inspect dorsal fuselage slipway door.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'READY AAR DOOR CALLOUT',
          actionPrompt: 'Speak "Ready AAR Door" into your microphone'
        }
      },
      {
        id: '16-2',
        order: 2,
        label: 'AIR REFUEL Switch to OPEN',
        phaseType: 'ACTION',
        description: 'Move the AIR REFUEL toggle switch forward to OPEN on the FUEL panel.',
        cockpitPanel: 'Left Console / FUEL Panel',
        controlElement: 'AIR REFUEL Switch & AR/NWS RDY Lamp',
        visualCue: 'Blue AR / NWS RDY lamp illuminates on right eyebrow; dorsal door slides open. Chief calls "Door open."',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 54, regionName: 'FUEL PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'AIR REFUEL SWITCH (OPEN)',
            description: 'Two-position toggle switch moved forward to OPEN position.',
            focalControl: 'AIR REFUEL Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['CLOSE', 'OPEN'],
          targetPosition: 'OPEN',
          label: 'AIR REFUEL SWITCH',
          actionPrompt: 'Set switch forward to OPEN'
        }
      },
      {
        id: '16-3',
        order: 3,
        label: 'AIR REFUEL Switch to CLOSE',
        phaseType: 'ACTION',
        description: 'Move the AIR REFUEL toggle switch aft to CLOSE. Verify blue RDY lamp extinguishes and door latches flush.',
        cockpitPanel: 'Left Console / FUEL Panel',
        controlElement: 'AIR REFUEL Switch & Dorsal Door',
        visualCue: 'Blue RDY lamp extinguishes; dorsal door slides closed. Chief calls "Door closed."',
        images: {
          overviewLocator: { xPercent: 22, yPercent: 54, regionName: 'FUEL PANEL (LEFT CONSOLE)' },
          detailCloseup: {
            title: 'AIR REFUEL SWITCH (CLOSE)',
            description: 'Switch returned to CLOSE; slipway door sealed flush with spine.',
            focalControl: 'AIR REFUEL Switch'
          }
        },
        interactiveControl: {
          type: 'MOCK_SWITCH',
          switchPositions: ['CLOSE', 'OPEN'],
          targetPosition: 'CLOSE',
          label: 'AIR REFUEL SWITCH',
          actionPrompt: 'Set switch aft to CLOSE'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 17: WHEEL CHOCKS REMOVAL (OPTIONAL GROUND CHECK)
  // =========================================================================
  {
    id: 17,
    code: 'STEP-17',
    title: 'Wheel Chocks Removal (Optional Ground Check)',
    phase: 'TAXI_CLEAR',
    expectedCommandName: 'Wheel Chocks',
    backendStepKey: 'Chocks',
    whatHappenedLast: 'AAR slipway door check completed and verified closed flush.',
    whatToPerformNow: 'Hold toe brakes firmly, then transmit "Remove Chocks" (or "Wheel Chocks") to pull wheel chocks.',
    whatToExpectNext: 'Ground crew pulls rubber/wood wheel chocks away from tires. Chief remains connected on interphone.',
    cockpitVisual: {
      panelName: 'MAIN GEAR WHEEL WELLS & TOE BRAKES',
      subSystem: 'Wheel Chocks & Ground Restraint Equipment',
      schematicType: 'GROUND_CREW',
      focalControls: ['Wheel Chocks', 'Main Landing Gear Wheels', 'Toe Brakes'],
      operationalState: 'Wheel chocks pulled; aircraft held solely by toe brakes; Chief remains online.',
      lookFor: 'Chocks cleared away from tires; interphone headset remains connected.'
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
        cockpitPanel: 'Rudder Footwell',
        controlElement: 'Left and Right Toe Brakes',
        visualCue: 'Toe brake progress bars register firm depression.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 90, regionName: 'RUDDER FOOTWELL' },
          detailCloseup: {
            title: 'TOE BRAKES FIRM HOLD',
            description: 'Holding hydraulic pressure to prevent forward roll upon chock removal.',
            focalControl: 'Toe Brakes'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'BRAKES HELD',
          actionPrompt: 'Hold toe brakes firmly'
        }
      },
      {
        id: '17-2',
        order: 2,
        label: 'Verbal Transmission "Remove Chocks"',
        phaseType: 'VERBAL',
        description: 'Instruct the ground crew to pull wheel chocks. Speak "Remove Chocks" or "Wheel Chocks" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Ground crew pulls heavy chocks away from main gear tires.',
        images: {
          overviewLocator: { xPercent: 50, yPercent: 82, regionName: 'MAIN GEAR CHOCKS' },
          detailCloseup: {
            title: 'WHEEL CHOCKS REMOVED',
            description: 'Ground crew drags rubber/wood chocks clear of tire roll paths.',
            focalControl: 'Wheel Chocks'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'REMOVE CHOCKS CALLOUT',
          actionPrompt: 'Speak "Remove Chocks" into your microphone'
        }
      }
    ]
  },

  // =========================================================================
  // STEP 18: CLEARED OFF & FINAL MARSHAL SIGN-OFF
  // =========================================================================
  {
    id: 18,
    code: 'STEP-18',
    title: 'Cleared Off & Final Marshal Sign-Off',
    phase: 'TAXI_CLEAR',
    expectedCommandName: 'Cleared Off',
    backendStepKey: 'ClearedOff',
    whatHappenedLast: 'Wheel chocks removed. Ready for taxi out.',
    whatToPerformNow: 'Transmit "Cleared Off" (or "Clear Ground") to disconnect Chief, watch Chief disconnect headset, and return 10 o\'clock salute.',
    whatToExpectNext: 'Chief calls: "Copy that, bring her back Code 1, sir/ma\'am." Chief unplugs headset, snaps spring door, and gives sharp hand salute at 10 o\'clock.',
    cockpitVisual: {
      panelName: 'LEFT SILL RECEPTACLE & 10 O\'CLOCK MARSHAL POSITION',
      subSystem: 'Ground Headset Disconnect & Visual Marshaller',
      schematicType: 'GROUND_CREW',
      focalControls: ['Ground Headset Disconnect', 'Interphone Cap', '10 O\'Clock Marshaller'],
      operationalState: 'Ground crew clear; interphone disconnected; cleared for taxi.',
      lookFor: 'Crew Chief standing at 10 o\'clock position in high-vis vest rendering a sharp hand salute.'
    },
    pilotSpokenCalls: {
      primary: 'Cleared Off',
      prefixVariants: ['Clear Ground', 'Chief Cleared Off', 'Clear Off'],
      synonyms: ['Everything Off', 'All Off']
    },
    expectedChiefResponse: 'Copy that, bring her back Code 1, sir/ma\'am. (Headset disconnected, 10 o\'clock salute).',
    substeps: [
      {
        id: '18-1',
        order: 1,
        label: 'Verbal Transmission "Cleared Off"',
        phaseType: 'VERBAL',
        description: 'Clear the crew chief off the interphone loop. Speak "Cleared Off" into the microphone.',
        cockpitPanel: 'Left Console / HOTAS Mic',
        controlElement: 'Interphone Transmission',
        visualCue: 'Chief replies: "Copy that, bring her back Code 1, sir/ma\'am."',
        images: {
          overviewLocator: { xPercent: 18, yPercent: 46, regionName: 'LEFT SILL INTERPHONE PORT' },
          detailCloseup: {
            title: 'FINAL DEPARTURE CLEARANCE',
            description: 'Chief authorizes taxi and concludes interphone communications.',
            focalControl: 'Interphone Line'
          }
        },
        interactiveControl: {
          type: 'VOICE_CALLOUT',
          label: 'CLEARED OFF CALLOUT',
          actionPrompt: 'Speak "Cleared Off" into your microphone'
        }
      },
      {
        id: '18-2',
        order: 2,
        label: 'Final 10 O\'Clock Marshal Salute',
        phaseType: 'VERIFY',
        description: 'Chief unplugs ground headset cord, snaps receptacle door closed, walks to 10 o\'clock position in high-visibility vest and renders a sharp hand salute.',
        cockpitPanel: 'Canopy Front-Left Field of View',
        controlElement: '10 O\'Clock Visual Marshal Station',
        visualCue: 'Chief saluting outside taxi line. F-16C ramp start 100% complete — cleared for taxi.',
        images: {
          overviewLocator: { xPercent: 20, yPercent: 25, regionName: '10 O\'CLOCK MARSHAL STATION' },
          detailCloseup: {
            title: 'CREW CHIEF HAND SALUTE',
            description: 'Crew Chief at attention rendering crisp departure salute.',
            focalControl: 'Ramp Marshaller'
          }
        },
        interactiveControl: {
          type: 'VERIFICATION',
          label: 'RETURN SALUTE & TAXI',
          actionPrompt: 'Checklist 100% complete — cleared for taxi'
        }
      }
    ]
  }
];
