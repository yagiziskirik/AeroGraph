import {
  CockpitTargetArea,
  CockpitPin,
} from '../../components/cockpit/CockpitLocatorOverlay';
import { DrillStepName } from '../../services/voiceTrainingData';

/**
 * Configuration schema for activating CockpitLocatorOverlay on specific drill steps and substeps.
 */
export interface CockpitLocatorStepConfig {
  stepId?: number;
  stepName?: DrillStepName;
  /**
   * - `[0]`: Active only on substep 1
   * - `[0, 1]`: Active on substeps 1 and 2
   * - `undefined` / omitted: Active on ALL substeps of this step
   */
  substeps?: number[];
  targetArea: CockpitTargetArea;
  secondaryAreas?: CockpitTargetArea[];
  pins?: CockpitPin[];
}

/**
 * Registry of active cockpit locator overlays per step and substep.
 * 
 * Edit this array to engage or disengage the locator on any step, adjust target
 * focus areas, or define callout pins.
 */
export const COCKPIT_LOCATOR_CONFIGS: CockpitLocatorStepConfig[] = [
  {
    stepId: 1,
    stepName: 'ELEC_POWER',
    substeps: [0],
    targetArea: {
      id: 'area-elec-panel',
      label: 'ELEC POWER PANEL',
      x: 5,
      y: 64,
      width: 22,
      height: 30.5,
    },
    pins: [
      { id: 'pin-elec', label: 'ELEC', x: 14, y: 69, color: '#9efb24' },
      { id: 'pin-eng', label: 'TEST', x: 10, y: 92, color: '#38bdf8' },
    ],
  },
  {
    stepId: 2,
    stepName: 'JFS_START',
    substeps: [0, 1],
    targetArea: {
      id: 'area-jfs-panel',
      label: 'ENG START / JFS PANEL',
      x: 10,
      y: 54,
      width: 8,
      height: 10,
    },
    secondaryAreas: [
      {
        id: 'area-tachometer',
        label: 'ENGINE IND',
        x: 72,
        y: 16,
        width: 8,
        height: 12,
      },
    ],
    pins: [
      { id: 'pin-jfs-sw', label: 'JFS SWITCH', x: 15, y: 56, color: '#38bdf8' },
      { id: 'pin-tach-mt', label: 'RPM', x: 75, y: 22.5, color: '#8b38f8' },
    ],
  },
  {
    stepId: 2,
    stepName: 'JFS_START',
    substeps: [2],
    targetArea: {
      id: 'area-tachometer',
      label: 'ENGINE IND',
      x: 72,
      y: 16,
      width: 8,
      height: 12,
    },
    secondaryAreas: [
      {
        id: 'area-hyd-press',
        label: 'HYD PRESS',
        x: 84,
        y: 33,
        width: 5.2,
        height: 5,
      },
    ],
    pins: [
      { id: 'pin-tach-mt', label: 'RPM', x: 75, y: 22.5, color: '#8b38f8' },
      { id: 'pin-ftit', label: 'FTIT', x: 76.4, y: 25.8, color: '#38bdf8' },
      { id: 'pin-hyd-press', label: 'HYD PRESS', x: 86.6, y: 35.5, color: '#fbbf24' },
    ],
  },
  {
    stepId: 3,
    stepName: 'SEC_CHECK',
    substeps: [1],
    targetArea: {
      id: 'area-tachometer',
      label: 'ENGINE IND',
      x: 72,
      y: 16,
      width: 8,
      height: 12,
    },
    pins: [
      { id: 'pin-nos-pos', label: 'NOS POS', x: 74.8, y: 19.4, color: '#fbbf24' },
    ],
  },
  {
    stepId: 5,
    stepName: 'EPU_PIN',
    substeps: [0],
    targetArea: {
      id: 'area-epu',
      label: 'EPU PANEL',
      x: 6,
      y: 64.5,
      width: 5,
      height: 8,
    },
    pins: [
      { id: 'pin-epu', label: 'EPU', x: 8.5, y: 70, color: '#fb7324' },
    ],
  },
  {
    stepId: 8,
    stepName: 'FLCS_BIT',
    substeps: [0],
    targetArea: {
      id: 'area-flt-ctrl-panel',
      label: 'FLT CONTROL PANEL',
      x: 5,
      y: 80.5,
      width: 12,
      height: 10,
    },
    pins: [
      { id: 'pin-flt-ctrl-panel', label: 'FLT CONTROL', x: 10, y: 85.5, color: '#38bdf8' },
    ],
  },
  {
    stepId: 9,
    stepName: 'TRIM_VERIFY',
    substeps: [0],
    targetArea: {
      id: 'area-trim-panel',
      label: 'TRIM PANEL',
      x: 15,
      y: 80.5,
      width: 10.5,
      height: 10,
    },
    pins: [
      { id: 'pin-trim-panel', label: 'TRIM', x: 20, y: 85.5, color: '#38bdf8' },
    ],
  },
  {
    stepId: 12,
    stepName: 'BIG_MOVEMENTS',
    substeps: [0],
    targetArea: {
      id: 'area-mpo',
      label: 'MPO PANEL',
      x: 10,
      y: 50,
      width: 8,
      height: 5,
    },
    secondaryAreas: [
      {
        id: 'area-spd-brk',
        label: 'SPD BRK PANEL',
        x: 11,
        y: 37,
        width: 9.2,
        height: 7,
      }
    ],
    pins: [
      { id: 'pin-mpo', label: 'MPO', x: 14, y: 51.95, color: '#38bdf8' },
      { id: 'pin-spd-brk', label: 'SPD BRK', x: 15.85, y: 40.6, color: '#fbbf24' },
    ],
  },
  {
    stepId: 16,
    stepName: 'AAR_DOOR',
    substeps: [0],
    targetArea: {
      id: 'area-fuel-panel',
      label: 'FUEL PANEL',
      x: 5,
      y: 72,
      width: 7,
      height: 10,
    },
    pins: [
      { id: 'pin-fuel-panel', label: 'FUEL', x: 8.5, y: 77, color: '#8b38f8' },
    ],
  },
];

/**
 * Lookup active locator overlay configuration for a given step and substep.
 * Accepts either stepName (preferred) or legacy stepId.
 * Returns null if the locator should be disengaged/hidden.
 */
export const getCockpitLocatorConfig = (
  step: DrillStepName | number,
  substepIndex: number
): CockpitLocatorStepConfig | null => {
  const match = COCKPIT_LOCATOR_CONFIGS.find((cfg) => {
    if (typeof step === 'string') {
      if (cfg.stepName !== step) return false;
    } else {
      if (cfg.stepId !== step) return false;
    }
    if (!cfg.substeps || cfg.substeps.length === 0) return true;
    return cfg.substeps.includes(substepIndex);
  });
  return match || null;
};
