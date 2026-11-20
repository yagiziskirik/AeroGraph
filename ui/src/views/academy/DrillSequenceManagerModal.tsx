'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  Settings2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Layers,
  GripVertical,
  Link2,
} from 'lucide-react';
import { Sound } from '../../services/sound';
import { ShiningCheckbox } from '../../components/inputs';
import { DrillStepName, RAMP_STEPS_BY_NAME } from '../../services/voiceTrainingData';
import { DRILL_STEP_ORDER } from './CockpitDrillStage';

export interface BlockDefinition {
  id: string;
  name: string;
  badge?: string;
  isAnchor?: boolean;
  isMandatoryTick?: boolean;
  isFixed?: boolean;
  stepNames: DrillStepName[];
}

export const CANONICAL_BLOCK_DEFS: BlockDefinition[] = [
  {
    id: 'BLOCK_ENGAGE_CHIEF',
    name: 'Crew Chief Intercom Link',
    badge: 'START ANCHOR',
    isAnchor: true,
    isMandatoryTick: true,
    isFixed: true,
    stepNames: ['ENGAGE_CHIEF'],
  },
  {
    id: 'BLOCK_ELEC_POWER',
    name: 'Electrical Power & Comms Check',
    isFixed: true,
    stepNames: ['ELEC_POWER'],
  },
  {
    id: 'BLOCK_JFS_START',
    name: 'Ready to Start Two (JFS / Engine Start)',
    badge: 'MANDATORY',
    isMandatoryTick: true,
    isFixed: true,
    stepNames: ['JFS_START'],
  },
  {
    id: 'BLOCK_SEC_CHECKS',
    name: 'SEC & PRI System Check',
    badge: 'COUPLED • 2 STEPS',
    stepNames: ['SEC_CHECK', 'PRI_VERIFY'],
  },
  {
    id: 'BLOCK_EPU_CHECKS',
    name: 'EPU Safety Pin & Flow Check',
    badge: 'COUPLED • 2 STEPS',
    stepNames: ['EPU_PIN', 'EPU_FLOW'],
  },
  {
    id: 'BLOCK_FLIGHT_CONTROLS_CLEAR',
    name: 'Flight Controls Area Clearance',
    stepNames: ['FLIGHT_CONTROLS_CLEAR'],
  },
  {
    id: 'BLOCK_FLCS_BIT',
    name: 'FLCS Built-In Test (BIT)',
    stepNames: ['FLCS_BIT'],
  },
  {
    id: 'BLOCK_TRIM_CHECKS',
    name: 'Trim System Verification & AP Disconnect',
    badge: 'COUPLED • 3 STEPS',
    stepNames: ['TRIM_VERIFY', 'TRIM_DISC', 'TRIM_CONN'],
  },
  {
    id: 'BLOCK_BIG_MOVEMENTS',
    name: 'Full Flight Control Surface Travel',
    stepNames: ['BIG_MOVEMENTS'],
  },
  {
    id: 'BLOCK_DBU_CHECK',
    name: 'Digital Backup (DBU) Verification',
    stepNames: ['DBU_CHECK'],
  },
  {
    id: 'BLOCK_BRAKES',
    name: 'Toe Brakes Check (Left & Right Channel)',
    badge: 'COUPLED • 2 STEPS',
    stepNames: ['LEFT_BRAKE', 'RIGHT_BRAKE'],
  },
  {
    id: 'BLOCK_BRAKES_CHAN2',
    name: 'Brake Channel 2 Check (Alternate Channel)',
    badge: 'OPTIONAL • 2 STEPS',
    stepNames: ['LEFT_BRAKE_CHAN2', 'RIGHT_BRAKE_CHAN2'],
  },
  {
    id: 'BLOCK_AAR_DOOR',
    name: 'Air Refuel (AAR) Door Travel Check',
    stepNames: ['AAR_DOOR'],
  },
  {
    id: 'BLOCK_CHOCKS_REMOVAL',
    name: 'Wheel Chocks Removal & Pin Stowing',
    stepNames: ['CHOCKS_REMOVAL'],
  },
  {
    id: 'BLOCK_FINALE_SALUTE',
    name: 'Ground Crew Clearance & Final Salute',
    badge: 'FINAL SALUTE',
    isAnchor: true,
    isMandatoryTick: true,
    isFixed: true,
    stepNames: ['FINALE_SALUTE'],
  },
];

// Helper to construct blocks from incoming flat order
function buildBlocksFromOrder(rawOrder: string[]): BlockDefinition[] {
  const orderList = rawOrder && rawOrder.length > 0 ? rawOrder : (DRILL_STEP_ORDER as string[]);
  const blockMap = new Map<string, BlockDefinition>();
  CANONICAL_BLOCK_DEFS.forEach((b) => blockMap.set(b.id, b));

  const stepToBlockId = new Map<string, string>();
  CANONICAL_BLOCK_DEFS.forEach((b) => {
    b.stepNames.forEach((s) => stepToBlockId.set(s, b.id));
  });

  const orderedBlocks: BlockDefinition[] = [];
  const visitedBlockIds = new Set<string>();

  // Fixed head
  const headIds = ['BLOCK_ENGAGE_CHIEF', 'BLOCK_ELEC_POWER', 'BLOCK_JFS_START'];
  headIds.forEach((id) => {
    const b = blockMap.get(id);
    if (b) {
      orderedBlocks.push(b);
      visitedBlockIds.add(id);
    }
  });

  // Middle blocks according to rawOrder
  orderList.forEach((sName) => {
    const bId = stepToBlockId.get(sName);
    if (bId && !visitedBlockIds.has(bId) && bId !== 'BLOCK_FINALE_SALUTE') {
      const b = blockMap.get(bId);
      if (b) {
        orderedBlocks.push(b);
        visitedBlockIds.add(bId);
      }
    }
  });

  // Missing middle canonical blocks
  CANONICAL_BLOCK_DEFS.forEach((b) => {
    if (!visitedBlockIds.has(b.id) && b.id !== 'BLOCK_FINALE_SALUTE') {
      orderedBlocks.push(b);
      visitedBlockIds.add(b.id);
    }
  });

  // Fixed tail
  const tail = blockMap.get('BLOCK_FINALE_SALUTE');
  if (tail) {
    orderedBlocks.push(tail);
  }

  return orderedBlocks;
}

interface MovableBlockItemProps {
  block: BlockDefinition;
  isManagedProfile: boolean;
  isBlockDisabled: boolean;
  isPartiallyDisabled: boolean;
  stepNumLabel: string;
  stepNumbersMap: Record<string, number>;
  onToggleBlock: (block: BlockDefinition) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const MovableBlockItem: React.FC<MovableBlockItemProps> = ({
  block,
  isManagedProfile,
  isBlockDisabled,
  isPartiallyDisabled,
  stepNumLabel,
  stepNumbersMap,
  onToggleBlock,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      value={block}
      id={block.id}
      dragListener={false}
      dragControls={dragControls}
      style={{ willChange: 'transform' }}
      whileDrag={{
        scale: 1.015,
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.75)',
        borderColor: '#10B981',
        zIndex: 40,
      }}
      className={`rounded-lg border transition-[border-color,background-color] ${
        isBlockDisabled
          ? 'bg-zinc-950/60 border-zinc-800/40 opacity-50'
          : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
      }`}
    >
      {/* Block Header Row */}
      <div className="flex items-center justify-between px-3.5 py-2.5">
        {/* Left: Sequence Range, Checkbox & Title */}
        <div className="flex items-center space-x-3.5 min-w-0">
          <span className="font-mono text-xs font-bold text-zinc-500 w-10 text-right">
            {stepNumLabel}
          </span>

          <div className="flex items-center">
            <ShiningCheckbox
              id={`block-toggle-${block.id}`}
              checked={!isBlockDisabled && !isPartiallyDisabled}
              onChange={() => onToggleBlock(block)}
              disabled={!isManagedProfile}
              size={18}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-semibold truncate ${
                  isBlockDisabled ? 'line-through text-zinc-500' : 'text-zinc-200'
                }`}
              >
                {block.name}
              </span>
              {block.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold bg-zinc-800/80 text-cyan-400 border-cyan-500/30 flex items-center gap-1">
                  {block.stepNames.length > 1 && <Link2 className="w-2.5 h-2.5" />}
                  {block.badge}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Drag Handle & Order Movement Controls */}
        <div className="flex items-center pl-2 space-x-1">
          <div
            onPointerDown={(e) => {
              if (isManagedProfile) {
                dragControls.start(e);
              }
            }}
            className={`p-1 text-zinc-500 touch-none ${
              isManagedProfile
                ? 'hover:text-emerald-400 cursor-grab active:cursor-grabbing'
                : 'opacity-20 cursor-not-allowed'
            }`}
            title="Drag handle to reorder check"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <button
            type="button"
            onClick={onMoveUp}
            disabled={!isManagedProfile || !canMoveUp}
            title="Move Block Up"
            className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 disabled:hover:bg-transparent transition-[color,background-color] cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={!isManagedProfile || !canMoveDown}
            title="Move Block Down"
            className="p-1 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 disabled:opacity-20 disabled:hover:text-zinc-400 disabled:hover:bg-transparent transition-[color,background-color] cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sub-steps Details */}
      <div className="border-t border-zinc-800/40 bg-zinc-950/30 px-3.5 py-2 space-y-1.5">
        {block.stepNames.map((sName) => {
          const sData = RAMP_STEPS_BY_NAME[sName];
          const sNumber = stepNumbersMap[sName];
          return (
            <div
              key={sName}
              className="flex items-center justify-between text-[11px] text-zinc-400 pl-14 pr-2"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-mono text-[10px] font-bold text-zinc-500 w-5">
                  {String(sNumber).padStart(2, '0')}
                </span>
                <span
                  className={`truncate ${
                    isBlockDisabled ? 'line-through text-zinc-600' : 'text-zinc-300'
                  }`}
                >
                  {sData?.title || sName}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[280px]">
                {sData?.pilotSpokenCalls?.primary
                  ? `"${sData.pilotSpokenCalls.primary}"`
                  : ''}
              </div>
            </div>
          );
        })}
      </div>
    </Reorder.Item>
  );
};

interface StaticFixedBlockItemProps {
  block: BlockDefinition;
  isManagedProfile: boolean;
  isBlockDisabled: boolean;
  stepNumLabel: string;
  stepNumbersMap: Record<string, number>;
  onToggleBlock: (block: BlockDefinition) => void;
}

const StaticFixedBlockItem: React.FC<StaticFixedBlockItemProps> = ({
  block,
  isManagedProfile,
  isBlockDisabled,
  stepNumLabel,
  stepNumbersMap,
  onToggleBlock,
}) => {
  return (
    <div
      className={`rounded-lg border bg-zinc-900/60 border-zinc-700/60 transition-[border-color,background-color] ${
        isBlockDisabled ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <div className="flex items-center space-x-3.5 min-w-0">
          <span className="font-mono text-xs font-bold text-zinc-500 w-10 text-right">
            {stepNumLabel}
          </span>

          <div className="flex items-center">
            {block.isMandatoryTick ? (
              <div
                className="w-[18px] h-[18px] flex items-center justify-center text-emerald-400 shrink-0"
                title="Mandatory step — active at all times"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            ) : (
              <ShiningCheckbox
                id={`block-toggle-${block.id}`}
                checked={!isBlockDisabled}
                onChange={() => onToggleBlock(block)}
                disabled={!isManagedProfile}
                size={18}
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span
                className={`text-xs font-semibold truncate ${
                  isBlockDisabled ? 'line-through text-zinc-500' : 'text-zinc-200'
                }`}
              >
                {block.name}
              </span>
              {block.badge && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border font-semibold ${
                    block.isAnchor
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {block.badge}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center pl-2">
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
            FIXED
          </span>
        </div>
      </div>

      <div className="border-t border-zinc-800/40 bg-zinc-950/30 px-3.5 py-2 space-y-1.5">
        {block.stepNames.map((sName) => {
          const sData = RAMP_STEPS_BY_NAME[sName];
          const sNumber = stepNumbersMap[sName];
          return (
            <div
              key={sName}
              className="flex items-center justify-between text-[11px] text-zinc-400 pl-14 pr-2"
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span className="font-mono text-[10px] font-bold text-zinc-500 w-5">
                  {String(sNumber).padStart(2, '0')}
                </span>
                <span
                  className={`truncate ${
                    isBlockDisabled ? 'line-through text-zinc-600' : 'text-zinc-300'
                  }`}
                >
                  {sData?.title || sName}
                </span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono truncate max-w-[280px]">
                {sData?.pilotSpokenCalls?.primary
                  ? `"${sData.pilotSpokenCalls.primary}"`
                  : ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface DrillSequenceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: string[];
  disabledSteps: string[];
  isManagedProfile: boolean;
  onSaveSequence: (newOrder: string[], newDisabled: string[]) => void;
  onResetSequence: () => void;
}

export const DrillSequenceManagerModal: React.FC<DrillSequenceManagerModalProps> = ({
  isOpen,
  onClose,
  currentOrder,
  disabledSteps,
  isManagedProfile,
  onSaveSequence,
  onResetSequence,
}) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [blocks, setBlocks] = useState<BlockDefinition[]>(() => buildBlocksFromOrder(currentOrder));
  const [disabled, setDisabled] = useState<string[]>(() => {
    return (disabledSteps || []).filter(
      (s) => s !== 'ENGAGE_CHIEF' && s !== 'JFS_START' && s !== 'FINALE_SALUTE'
    );
  });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBlocks(buildBlocksFromOrder(currentOrder));
      setDisabled(
        (disabledSteps || []).filter(
          (s) => s !== 'ENGAGE_CHIEF' && s !== 'JFS_START' && s !== 'FINALE_SALUTE'
        )
      );
      setHasChanges(false);
    }
  }, [isOpen, currentOrder, disabledSteps]);

  // Head blocks (first 3), movable middle blocks, and tail block (last 1)
  const headBlocks = useMemo(() => blocks.slice(0, 3), [blocks]);
  const movableBlocks = useMemo(() => blocks.slice(3, blocks.length - 1), [blocks]);
  const tailBlock = useMemo(() => blocks[blocks.length - 1], [blocks]);

  // Compute map of step name -> 1-based sequence number
  const stepNumbersMap = useMemo(() => {
    const map: Record<string, number> = {};
    let stepCount = 1;
    blocks.forEach((b) => {
      b.stepNames.forEach((s) => {
        map[s] = stepCount++;
      });
    });
    return map;
  }, [blocks]);

  // Total steps & active steps calculation
  const totalStepsCount = useMemo(() => {
    return blocks.reduce((acc, b) => acc + b.stepNames.length, 0);
  }, [blocks]);

  const activeStepsCount = totalStepsCount - disabled.length;

  const handleToggleBlock = (block: BlockDefinition) => {
    if (!isManagedProfile || block.isMandatoryTick) return;

    Sound.playClick();
    setDisabled((prev) => {
      const isAnyActive = block.stepNames.some((s) => !prev.includes(s));
      let next: string[];
      if (isAnyActive) {
        const set = new Set(prev);
        block.stepNames.forEach((s) => set.add(s));
        next = Array.from(set);
      } else {
        next = prev.filter((s) => !block.stepNames.includes(s as DrillStepName));
      }
      setHasChanges(true);
      return next;
    });
  };

  const handleReorderMovable = (newMovable: BlockDefinition[]) => {
    if (!isManagedProfile) return;
    setBlocks([...headBlocks, ...newMovable, tailBlock]);
    setHasChanges(true);
  };

  const handleMoveUpMovable = (indexInMovable: number) => {
    if (!isManagedProfile || indexInMovable <= 0) return;
    Sound.playClick();
    const nextMovable = [...movableBlocks];
    const temp = nextMovable[indexInMovable - 1];
    nextMovable[indexInMovable - 1] = nextMovable[indexInMovable];
    nextMovable[indexInMovable] = temp;
    setBlocks([...headBlocks, ...nextMovable, tailBlock]);
    setHasChanges(true);
  };

  const handleMoveDownMovable = (indexInMovable: number) => {
    if (!isManagedProfile || indexInMovable >= movableBlocks.length - 1) return;
    Sound.playClick();
    const nextMovable = [...movableBlocks];
    const temp = nextMovable[indexInMovable + 1];
    nextMovable[indexInMovable + 1] = nextMovable[indexInMovable];
    nextMovable[indexInMovable] = temp;
    setBlocks([...headBlocks, ...nextMovable, tailBlock]);
    setHasChanges(true);
  };

  const handleReset = () => {
    Sound.playClick();
    setBlocks(CANONICAL_BLOCK_DEFS);
    setDisabled([]);
    setHasChanges(true);
    onResetSequence();
  };

  const handleSave = () => {
    Sound.playCommit();
    const flattenedOrder = blocks.flatMap((b) => b.stepNames);
    onSaveSequence(flattenedOrder, disabled);
    setHasChanges(false);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="drill-sequence-manager-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 select-none"
          style={{ willChange: 'opacity' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              Sound.playClick();
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
            className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
            style={{ willChange: 'transform, opacity' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-zinc-100 font-mono uppercase">
                    Procedural Sequence &amp; FoxVox State Manager
                  </h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Drag-and-drop or reorder procedural checkpoints. Combined checks move and toggle together.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  Sound.playClick();
                  onClose();
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-[color,background-color] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Profile Advisory Notice */}
            {!isManagedProfile && (
              <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/20 flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-300/90 leading-relaxed">
                  <strong className="font-semibold text-amber-200">Custom FoxVox Profile In Use: </strong>
                  Procedural reordering and step disabling are locked in AeroGraph to prevent corrupting custom state machine conditions. You can modify command triggers directly in FoxVox.
                </div>
              </div>
            )}

            {/* Sequence Status Bar */}
            <div className="px-6 py-2.5 bg-zinc-900/30 border-b border-zinc-800/60 flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center space-x-2">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                <span>
                  Sequence Status:{' '}
                  <strong className="text-emerald-400 font-mono">{activeStepsCount}</strong> of{' '}
                  <span className="font-mono">{totalStepsCount}</span> active
                </span>
                {disabled.length > 0 && (
                  <span className="text-zinc-500 font-mono text-[11px]">
                    ({disabled.length} skipped)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-zinc-500 font-mono">
                Order is automatically synchronized with Falcon BMS
              </span>
            </div>

            {/* Steps & Coupled Blocks List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Pinned Starting Sequence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 tracking-wider uppercase px-1">
                  <span>Mandatory Starting Steps (Fixed)</span>
                  <span>Steps 01 - 03</span>
                </div>
                <div className="space-y-2">
                  {headBlocks.map((block) => {
                    const isBlockDisabled = block.stepNames.every((s) => disabled.includes(s));
                    const stepNumLabel = String(stepNumbersMap[block.stepNames[0]]).padStart(2, '0');
                    return (
                      <StaticFixedBlockItem
                        key={block.id}
                        block={block}
                        isManagedProfile={isManagedProfile}
                        isBlockDisabled={isBlockDisabled}
                        stepNumLabel={stepNumLabel}
                        stepNumbersMap={stepNumbersMap}
                        onToggleBlock={handleToggleBlock}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Movable Tactical System Checks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 tracking-wider uppercase px-1">
                  <span>Configurable Checks (Drag Handle to Reorder)</span>
                  <span className="text-emerald-500/70 font-sans normal-case text-[11px]">
                    Drag or use arrows to rearrange
                  </span>
                </div>

                <Reorder.Group
                  axis="y"
                  values={movableBlocks}
                  onReorder={handleReorderMovable}
                  className="space-y-2"
                >
                  {movableBlocks.map((block, idx) => {
                    const isBlockDisabled = block.stepNames.every((s) => disabled.includes(s));
                    const isPartiallyDisabled =
                      !isBlockDisabled && block.stepNames.some((s) => disabled.includes(s));
                    const firstStepNum = stepNumbersMap[block.stepNames[0]];
                    const lastStepNum = stepNumbersMap[block.stepNames[block.stepNames.length - 1]];
                    const stepNumLabel =
                      block.stepNames.length > 1
                        ? `${String(firstStepNum).padStart(2, '0')}-${String(lastStepNum).padStart(2, '0')}`
                        : String(firstStepNum).padStart(2, '0');

                    return (
                      <MovableBlockItem
                        key={block.id}
                        block={block}
                        isManagedProfile={isManagedProfile}
                        isBlockDisabled={isBlockDisabled}
                        isPartiallyDisabled={isPartiallyDisabled}
                        stepNumLabel={stepNumLabel}
                        stepNumbersMap={stepNumbersMap}
                        onToggleBlock={handleToggleBlock}
                        onMoveUp={() => handleMoveUpMovable(idx)}
                        onMoveDown={() => handleMoveDownMovable(idx)}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < movableBlocks.length - 1}
                      />
                    );
                  })}
                </Reorder.Group>
              </div>

              {/* Pinned Clearance & Salute */}
              {tailBlock && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 tracking-wider uppercase px-1">
                    <span>Mandatory Final Salute (Fixed)</span>
                    <span>Step {String(stepNumbersMap[tailBlock.stepNames[0]]).padStart(2, '0')}</span>
                  </div>
                  <StaticFixedBlockItem
                    key={tailBlock.id}
                    block={tailBlock}
                    isManagedProfile={isManagedProfile}
                    isBlockDisabled={false}
                    stepNumLabel={String(stepNumbersMap[tailBlock.stepNames[0]]).padStart(2, '0')}
                    stepNumbersMap={stepNumbersMap}
                    onToggleBlock={handleToggleBlock}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800/80 bg-zinc-900/50">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isManagedProfile}
                className="flex items-center space-x-2 px-3 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg border border-zinc-800 disabled:opacity-30 transition-[color,background-color] cursor-pointer disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    onClose();
                  }}
                  className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-[color,background-color] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isManagedProfile || !hasChanges}
                  className="flex items-center space-x-2 px-4 py-2 text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-lg transition-[color,background-color] shadow-lg shadow-emerald-950/40 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Apply &amp; Sync FoxVox</span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
