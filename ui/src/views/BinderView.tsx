'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { SlotConfig, TemplateMetadata, QuickStamp, CustomPreset, AppConfig } from '../types/ipc';
import { AVAILABLE_TEMPLATES_CATALOG, DEFAULT_DEV_SLOTS, EMBEDDED_NOTES, BUILTIN_PRESETS_CATALOG, PRESET_COLOR_PALETTE } from '../services/templatesData';
import { AEROGRAPH_LOGO_B64 } from '../components/ChassisBar';
import { ShiningCheckbox } from '../components/inputs';

interface BinderViewProps {
  initialSlots?: Record<string, SlotConfig>;
  availableTemplates?: TemplateMetadata[];
  customTemplates?: TemplateMetadata[];
  customStamps?: QuickStamp[];
  customPresets?: CustomPreset[];
  accentColor?: string;
  onSelectAccent?: (color: string) => void;
  generatedImages?: string[];
  config?: AppConfig;
}

const DEFAULT_STAMPS: QuickStamp[] = [
  { id: 'bingo', label: 'BINGO 2500', template: 'BINGO FUEL: {red: 2500 LBS} // JOKER: {yellow: 3200 LBS}' },
  { id: 'laser', label: 'LASER 1688', template: 'PRIMARY LASER PRF: {green: 1688}' },
  { id: 'ramrod', label: 'RAMROD', template: 'RAMROD CODE: {blue: CHARLIE}' },
  { id: 'roe', label: 'ROE 25NM', template: 'ROE: Weapons Free beyond {green: 25NM} from Bullseye' },
  { id: 'threat', label: 'SAM THREAT', template: 'WARNING: {highlight: Active SA-10 Grumble} tracking near STPT' },
  { id: 'ip_vector', label: 'IP VECTOR', template: 'TGT IP: Bearing {blue: 045} / Distance {blue: 12NM} / Pullup 18,000 FT' },
];

const PREDEFINED_COLORS = [
  { label: 'Red', tag: 'red', hex: '#D32F2F', bg: false },
  { label: 'Yellow', tag: 'yellow', hex: '#F57F17', bg: false },
  { label: 'Green', tag: 'green', hex: '#2E7D32', bg: false },
  { label: 'Blue', tag: 'blue', hex: '#1565C0', bg: false },
  { label: 'Orange', tag: 'orange', hex: '#E65100', bg: false },
  { label: 'Cyan', tag: 'cyan', hex: '#00838F', bg: false },
  { label: 'Purple', tag: 'purple', hex: '#7B1FA2', bg: false },
  { label: 'Magenta', tag: 'magenta', hex: '#C2185B', bg: false },
  { label: 'Pink', tag: 'pink', hex: '#D81B60', bg: false },
  { label: 'Violet', tag: 'violet', hex: '#5E35B1', bg: false },
  { label: 'Teal', tag: 'teal', hex: '#00796B', bg: false },
  { label: 'Lime', tag: 'lime', hex: '#689F38', bg: false },
  { label: 'Brown', tag: 'brown', hex: '#5D4037', bg: false },
  { label: 'White', tag: 'white', hex: '#FFFFFF', bg: false },
  { label: 'Bg Yellow', tag: 'bg-yellow', hex: '#FFF59D', textColor: '#111111', bg: true },
  { label: 'Bg Red', tag: 'bg-red', hex: '#FFCDD2', textColor: '#B71C1C', bg: true },
  { label: 'Bg Green', tag: 'bg-green', hex: '#C8E6C9', textColor: '#1B5E20', bg: true },
  { label: 'Bg Blue', tag: 'bg-blue', hex: '#BBDEFB', textColor: '#0D47A1', bg: true },
  { label: 'Bg Purple', tag: 'bg-purple', hex: '#E1BEE7', textColor: '#4A148C', bg: true },
];

export const BinderView: React.FC<BinderViewProps> = ({
  initialSlots,
  availableTemplates = AVAILABLE_TEMPLATES_CATALOG,
  customTemplates: initialCustomTemplates = [],
  customStamps: initialCustomStamps = [],
  customPresets: initialCustomPresets = [],
  accentColor = '#10B981',
  onSelectAccent,
  generatedImages = [],
  config,
}) => {
  const [leftSlotIndex, setLeftSlotIndex] = useState(1);
  const [rightSlotIndex, setRightSlotIndex] = useState(1);
  const [slots, setSlots] = useState<Record<string, SlotConfig>>(
    initialSlots && Object.keys(initialSlots).length > 0 ? initialSlots : DEFAULT_DEV_SLOTS
  );
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');

  // Preview vs Edit Mode for each side
  const [leftViewMode, setLeftViewMode] = useState<'preview' | 'edit'>('preview');
  const [rightViewMode, setRightViewMode] = useState<'preview' | 'edit'>('preview');

  // Zoom Levels: 'fit' or numeric scale (0.35 to 1.5)
  const [leftZoom, setLeftZoom] = useState<'fit' | number>('fit');
  const [rightZoom, setRightZoom] = useState<'fit' | number>('fit');

  // Container refs for dynamic aspect-fit scaling and cursor tracking
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [leftFitScale, setLeftFitScale] = useState(0.42);
  const [rightFitScale, setRightFitScale] = useState(0.42);

  // Measure containers to eliminate dead space in preview mode
  useEffect(() => {
    const updateScales = () => {
      if (leftContainerRef.current) {
        const { clientWidth, clientHeight } = leftContainerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          const s = Math.min((clientWidth - 16) / 1024, (clientHeight - 16) / 1554);
          setLeftFitScale(Math.max(0.2, s));
        }
      }
      if (rightContainerRef.current) {
        const { clientWidth, clientHeight } = rightContainerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          const s = Math.min((clientWidth - 16) / 1024, (clientHeight - 16) / 1554);
          setRightFitScale(Math.max(0.2, s));
        }
      }
    };

    updateScales();
    window.addEventListener('resize', updateScales);
    const observer = new ResizeObserver(updateScales);
    if (leftContainerRef.current) observer.observe(leftContainerRef.current);
    if (rightContainerRef.current) observer.observe(rightContainerRef.current);

    return () => {
      window.removeEventListener('resize', updateScales);
      observer.disconnect();
    };
  }, []);

  // Interactive Ctrl + Mouse Wheel Zoom on Kneeboards & Alt + Scroll Wheel Page Navigation
  useEffect(() => {
    const handleLeftWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        Sound.playClick();
        const rawStep = e.deltaY < 0 ? 1 : -1;
        const delta = config?.invert_kneeboard_scroll ? -rawStep : rawStep;
        setLeftSlotIndex((p) => Math.max(1, Math.min(16, p + delta)));
        return;
      }
      if (!e.ctrlKey) return;
      e.preventDefault();
      setLeftZoom((current) => {
        const base = current === 'fit' ? leftFitScale : current;
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        const next = Math.round((base + delta) * 100) / 100;
        return Math.max(0.25, Math.min(1.5, next));
      });
    };

    const handleRightWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        Sound.playClick();
        const rawStep = e.deltaY < 0 ? 1 : -1;
        const delta = config?.invert_kneeboard_scroll ? -rawStep : rawStep;
        setRightSlotIndex((p) => Math.max(1, Math.min(16, p + delta)));
        return;
      }
      if (!e.ctrlKey) return;
      e.preventDefault();
      setRightZoom((current) => {
        const base = current === 'fit' ? rightFitScale : current;
        const delta = e.deltaY < 0 ? 0.05 : -0.05;
        const next = Math.round((base + delta) * 100) / 100;
        return Math.max(0.25, Math.min(1.5, next));
      });
    };

    const leftEl = leftContainerRef.current;
    const rightEl = rightContainerRef.current;

    if (leftEl) leftEl.addEventListener('wheel', handleLeftWheel, { passive: false });
    if (rightEl) rightEl.addEventListener('wheel', handleRightWheel, { passive: false });

    return () => {
      if (leftEl) leftEl.removeEventListener('wheel', handleLeftWheel);
      if (rightEl) rightEl.removeEventListener('wheel', handleRightWheel);
    };
  }, [leftFitScale, rightFitScale, config?.invert_kneeboard_scroll]);

  // Template Library Popover State & Categorization
  const [libraryOpenFor, setLibraryOpenFor] = useState<'left' | 'right' | null>(null);
  const [libraryCategory, setLibraryCategory] = useState<'all' | 'notes' | 'checklist' | 'chart'>('all');
  const [librarySearch, setLibrarySearch] = useState('');

  // Cache for template texts loaded from disk / fallback
  const [templateContentCache, setTemplateContentCache] = useState<Record<string, string>>(EMBEDDED_NOTES);

  // Commit to Cockpit Pipeline State
  const [commitState, setCommitState] = useState<'idle' | 'committing' | 'success'>('idle');
  const [regenState, setRegenState] = useState<'idle' | 'running'>('idle');
  const [imageRevision, setImageRevision] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Slot Customization Inspector Modal
  const [settingsSlotKey, setSettingsSlotKey] = useState<string | null>(null);

  // Quick Stamps (Insertables) State & IPC Persistence
  const [stamps, setStamps] = useState<QuickStamp[]>(() => {
    if (initialCustomStamps && initialCustomStamps.length > 0) {
      return initialCustomStamps;
    }
    return DEFAULT_STAMPS;
  });

  useEffect(() => {
    if (initialCustomStamps && initialCustomStamps.length > 0) {
      setStamps(initialCustomStamps);
    }
  }, [initialCustomStamps]);

  const [stampsModalOpen, setStampsModalOpen] = useState(false);
  const [editStampDropdownOpen, setEditStampDropdownOpen] = useState<'left' | 'right' | null>(null);
  const [colorDropdownOpen, setColorDropdownOpen] = useState<'left' | 'right' | null>(null);
  const [newStampLabel, setNewStampLabel] = useState('');
  const [newStampTemplate, setNewStampTemplate] = useState('');

  // AeroPreset Management Modal State
  const [presetsModalOpen, setPresetsModalOpen] = useState(false);
  const [presetTab, setPresetTab] = useState<'builtin' | 'custom' | 'import_export'>('builtin');
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [exportPresetName, setExportPresetName] = useState('My Custom Mission');
  const [exportPresetTheater, setExportPresetTheater] = useState('KOREA');
  const [exportPresetDesc, setExportPresetDesc] = useState('Custom 32-slot operational kneeboard configuration');
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Custom Presets State & Synchronization
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(initialCustomPresets || []);
  useEffect(() => {
    if (initialCustomPresets) {
      setCustomPresets(initialCustomPresets);
    }
  }, [initialCustomPresets]);

  // Form State for creating/saving custom presets
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetTheater, setNewPresetTheater] = useState('ALL');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [selectedPresetColor, setSelectedPresetColor] = useState('#10B981');

  // Custom Templates State & IPC Persistence
  const [customTemplates, setCustomTemplates] = useState<TemplateMetadata[]>(
    initialCustomTemplates || []
  );

  useEffect(() => {
    if (initialCustomTemplates) {
      setCustomTemplates(initialCustomTemplates);
    }
  }, [initialCustomTemplates]);

  const [newTemplateModalOpen, setNewTemplateModalOpen] = useState(false);
  const [newTmplName, setNewTmplName] = useState('');
  const [newTmplCategory, setNewTmplCategory] = useState<'notes' | 'checklist'>('notes');
  const [newTmplTitle, setNewTmplTitle] = useState('');
  const [newTmplCode, setNewTmplCode] = useState('');
  const [newTmplDesc, setNewTmplDesc] = useState('');
  const [newTmplContent, setNewTmplContent] = useState('');

  // Radial Page Clock Selector State (Anchored small circle via Portal)
  const [mounted, setMounted] = useState(false);
  const leftPageBtnRef = useRef<HTMLButtonElement | null>(null);
  const rightPageBtnRef = useRef<HTMLButtonElement | null>(null);
  const [radialCoords, setRadialCoords] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [radialOpenFor, setRadialOpenFor] = useState<'left' | 'right' | null>(null);
  const [radialHoverPage, setRadialHoverPage] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Save/Delete/Reset stamps via IPC (persisted in %APPDATA%\ygz\AeroGraph\config\custom_stamps.json)
  const handleSaveStamp = (newStamp: QuickStamp) => {
    setStamps((prev) => [...prev, newStamp]);
    Ipc.saveCustomStamp(newStamp);
  };

  const handleDeleteStamp = (id: string) => {
    setStamps((prev) => prev.filter((s) => s.id !== id));
    Ipc.deleteCustomStamp(id);
  };

  const handleResetStamps = () => {
    setStamps(DEFAULT_STAMPS);
    Ipc.resetCustomStamps();
  };

  // Save/Delete custom templates via IPC (persisted in %APPDATA%\ygz\AeroGraph\config\custom_templates.json + templates/<id>.md)
  const handleSaveCustomTemplate = (created: TemplateMetadata, content: string) => {
    setCustomTemplates((prev) => [...prev.filter((t) => t.id !== created.id), created]);
    if (content) {
      setTemplateContentCache((prev) => ({
        ...prev,
        [created.path]: content,
      }));
    }
    Ipc.saveCustomTemplate(created, content);
  };

  const handleDeleteCustomTemplate = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
    Ipc.deleteCustomTemplate(id);
  };

  // Sync initialSlots when passed from parent (only on first mount with valid slots to avoid clobbering staged workspace edits)
  const slotsInitializedRef = useRef(false);
  useEffect(() => {
    if (!slotsInitializedRef.current && initialSlots && Object.keys(initialSlots).length > 0) {
      setSlots(initialSlots);
      slotsInitializedRef.current = true;
    }
  }, [initialSlots]);

  // Listen for template content loaded from host via IPC
  useEffect(() => {
    const unsub = Ipc.on('TemplateContent', (data: { path: string; content: string }) => {
      if (data && data.path && data.content) {
        setTemplateContentCache((prev) => ({
          ...prev,
          [data.path]: data.content,
        }));
      }
    });
    return unsub;
  }, []);

  // Listen for backend kneeboard generation completion cue (synchronized with audio)
  useEffect(() => {
    const unsub = Ipc.on('KneeboardRegenFinished', () => {
      setRegenState('idle');
      setImageRevision((rev) => rev + 1);
      setFailedImages({});
      setCommitState((prev) => {
        if (prev === 'committing') {
          setTimeout(() => setCommitState('idle'), 2500);
          return 'success';
        }
        return prev;
      });
      Sound.playPageTurn();
    });
    return unsub;
  }, []);

  // Keyboard navigation and dismiss handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (radialOpenFor) setRadialOpenFor(null);
        if (libraryOpenFor) setLibraryOpenFor(null);
        if (settingsSlotKey) setSettingsSlotKey(null);
        if (stampsModalOpen) setStampsModalOpen(false);
        if (presetsModalOpen) setPresetsModalOpen(false);
        if (newTemplateModalOpen) setNewTemplateModalOpen(false);
        if (editStampDropdownOpen) setEditStampDropdownOpen(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [radialOpenFor, libraryOpenFor, settingsSlotKey, stampsModalOpen, presetsModalOpen, newTemplateModalOpen, editStampDropdownOpen]);

  const leftKey = `F16_${leftSlotIndex}L`;
  const rightKey = `F16_${rightSlotIndex}R`;

  const leftSlot: SlotConfig = slots[leftKey] || DEFAULT_DEV_SLOTS[leftKey] || {
    type: 'notes',
    description: `Slot ${leftSlotIndex}L`,
    title: `TAKEOFF & DEPARTURE // CLIMB`,
    header_code: 'T.O. 1F-16CM-1 // FLIGHT-OPS',
  };

  const rightSlot: SlotConfig = slots[rightKey] || DEFAULT_DEV_SLOTS[rightKey] || {
    type: 'notes',
    description: `Slot ${rightSlotIndex}R`,
    title: `AIR COMBAT TACTICS // BVR`,
    header_code: 'T.O. 1F-16CM-1 // WEAPONS',
  };

  // Maps a slot to a high-res pre-rendered PNG, extracted DDS texture, or user image
  const getSlotImagePath = (slotKey: string, slot: SlotConfig, rev = imageRevision): string | null => {
    const withRev = (url: string) => (rev > 0 ? `${url}?v=${rev}` : url);

    // When restore_original or pass_through is selected, serve the extracted DDS texture
    if (slot.type === 'restore_original') {
      return withRev(`/dds-page/restore/${slotKey}.png`);
    }
    if (slot.type === 'pass_through') {
      return withRev(`/dds-page/passthrough/${slotKey}.png`);
    }

    if (slot.type === 'briefing_roster') return withRev('/images/page_1.png');
    if (slot.type === 'briefing_steerpoints') return withRev('/images/page_2.png');
    if (slot.type === 'mission_route') return withRev('/images/mission_route.png');
    if (slot.type === 'mission_target') return withRev('/images/mission_target.png');
    if (slot.type === 'dep_taxi') return withRev('/images/dep_gnd.png');
    if (slot.type === 'arr_taxi') return withRev('/images/arr_gnd.png');
    if (slot.type === 'arr_ils_primary') return withRev('/images/arr_ils.png');
    if (slot.type === 'arr_ils_secondary') return withRev('/images/arr_ils_sec.png');
    if (slot.type === 'custom_html') {
      if (slot.path?.includes('checklist-1')) return withRev('/images/checklist-1.png');
      if (slot.path?.includes('checklist-2')) return withRev('/images/checklist-2.png');
      if (slot.path?.includes('checklist-3')) return withRev('/images/checklist-3.png');
      if (slot.path?.includes('checklist-4')) return withRev('/images/checklist-4.png');
      if (slot.path?.includes('checklist-5')) return withRev('/images/checklist-5.png');
      if (slot.path?.includes('threats-air')) return withRev('/images/threats-air.png');
      if (slot.path?.includes('threats-gnd')) return withRev('/images/threats-gnd.png');
    }

    // User PNG/JPG image slot type: covers the entire kneeboard page
    if (slot.type === 'image') {
      if (slot.path && slot.path.trim().length > 0) {
        const p = slot.path.trim();
        if (p.startsWith('data:') || p.startsWith('http://') || p.startsWith('https://')) {
          return p;
        }
        const clean = p.replace(/\\/g, '/');
        if (clean.startsWith('/')) {
          return withRev(clean);
        }
        return withRev(`/local-image/${clean}`);
      }
      return null;
    }

    return null;
  };

  const getSlotImageFilename = (slot: SlotConfig): string | null => {
    if (slot.type === 'briefing_roster') return 'page_1.png';
    if (slot.type === 'briefing_steerpoints') return 'page_2.png';
    if (slot.type === 'mission_route') return 'mission_route.png';
    if (slot.type === 'mission_target') return 'mission_target.png';
    if (slot.type === 'dep_taxi') return 'dep_gnd.png';
    if (slot.type === 'arr_taxi') return 'arr_gnd.png';
    if (slot.type === 'arr_ils_primary') return 'arr_ils.png';
    if (slot.type === 'arr_ils_secondary') return 'arr_ils_sec.png';
    if (slot.type === 'custom_html') {
      if (slot.path?.includes('checklist-1')) return 'checklist-1.png';
      if (slot.path?.includes('checklist-2')) return 'checklist-2.png';
      if (slot.path?.includes('checklist-3')) return 'checklist-3.png';
      if (slot.path?.includes('checklist-4')) return 'checklist-4.png';
      if (slot.path?.includes('checklist-5')) return 'checklist-5.png';
      if (slot.path?.includes('threats-air')) return 'threats-air.png';
      if (slot.path?.includes('threats-gnd')) return 'threats-gnd.png';
    }
    return null;
  };

  const getSlotDisplayContent = (slot: SlotConfig): string => {
    if (slot.content && slot.content.trim().length > 0) {
      return slot.content;
    }
    if (slot.notes) {
      if (Array.isArray(slot.notes)) {
        return slot.notes.join('\n');
      }
      if (typeof slot.notes === 'string' && slot.notes.trim().length > 0) {
        return slot.notes;
      }
    }
    if (slot.path) {
      if (templateContentCache[slot.path]) return templateContentCache[slot.path];
      if (EMBEDDED_NOTES[slot.path]) return EMBEDDED_NOTES[slot.path];
      const cleanPath = slot.path.replace(/^notes\//, '');
      if (EMBEDDED_NOTES[cleanPath]) return EMBEDDED_NOTES[cleanPath];
      if (EMBEDDED_NOTES[`notes/${cleanPath}`]) return EMBEDDED_NOTES[`notes/${cleanPath}`];
      const match = Object.keys(templateContentCache).find((p) => p.endsWith(cleanPath));
      if (match) return templateContentCache[match];
    }
    if (slot.description && slot.title) {
      return `# ${slot.title}\n\n${slot.description}`;
    }
    return `# ${slot.title || 'PILOT NOTES'}`;
  };

  // Staged locally only! Never touch kneeboards.json until COMMIT TO COCKPIT is pressed!
  const handleUpdateSlotContent = (side: 'left' | 'right', newContent: string) => {
    const slotKey = side === 'left' ? leftKey : rightKey;
    const currentSlot = side === 'left' ? leftSlot : rightSlot;
    const updatedSlot: SlotConfig = { ...currentSlot, content: newContent };
    setSlots((prev) => ({ ...prev, [slotKey]: updatedSlot }));
  };

  // Select template from catalog
  const handleSelectTemplate = (side: 'left' | 'right', template: TemplateMetadata) => {
    Sound.playSwitch();
    const slotKey = side === 'left' ? leftKey : rightKey;
    const currentSlot = side === 'left' ? leftSlot : rightSlot;

    const resolvedType =
      template.type ||
      (template.category === 'checklist'
        ? 'custom_html'
        : template.category === 'chart'
        ? template.id
        : 'notes');

    const updatedSlot: SlotConfig = {
      ...currentSlot,
      type: resolvedType,
      path: template.path || null,
      title: template.title || template.default_title || currentSlot.title,
      header_code: template.header_code || template.default_code || currentSlot.header_code,
      preset: template.preset || currentSlot.preset || 'standard',
      stripe_color: template.stripe_color || currentSlot.stripe_color || null,
      notes: null,
      content:
        (template.path && (templateContentCache[template.path] || EMBEDDED_NOTES[template.path])) ||
        currentSlot.content,
    };

    setSlots((prev) => ({ ...prev, [slotKey]: updatedSlot }));
    setLibraryOpenFor(null);
  };

  // Active preset detection based on explicit selection or full 32-slot matching
  const activePreset = useMemo(() => {
    const getSlotText = (s: SlotConfig): string => {
      if (s.content !== undefined) return s.content;
      if (s.notes) {
        return Array.isArray(s.notes) ? s.notes.join('\n') : s.notes;
      }
      if (s.path) {
        if (templateContentCache[s.path]) return templateContentCache[s.path];
        if (EMBEDDED_NOTES[s.path]) return EMBEDDED_NOTES[s.path];
        const cleanPath = s.path.replace(/^notes\//, '');
        if (EMBEDDED_NOTES[cleanPath]) return EMBEDDED_NOTES[cleanPath];
        if (EMBEDDED_NOTES[`notes/${cleanPath}`]) return EMBEDDED_NOTES[`notes/${cleanPath}`];
      }
      return '';
    };

    const areSlotsEqual = (a: Record<string, SlotConfig>, b: Record<string, SlotConfig>): boolean => {
      const keysB = Object.keys(b);
      for (const k of keysB) {
        const slotA = a[k];
        const slotB = b[k];
        if (!slotA || !slotB) return false;
        if (slotA.type !== slotB.type) return false;
        if ((slotA.path || '') !== (slotB.path || '')) return false;
        if (slotA.type === 'notes') {
          const aPreset = slotA.preset || 'standard';
          const bPreset = slotB.preset || 'standard';
          if (aPreset !== bPreset) return false;

          const aSpaced = slotA.spaced !== false;
          const bSpaced = slotB.spaced !== false;
          if (aSpaced !== bSpaced) return false;

          const textA = getSlotText(slotA).trim();
          const textB = getSlotText(slotB).trim();
          if (textA !== textB) {
            return false;
          }
        }
      }
      return true;
    };

    // 1. If an activePresetId is explicitly selected, check if workspace matches it
    if (activePresetId) {
      const builtin = BUILTIN_PRESETS_CATALOG.find((p) => p.id === activePresetId);
      if (builtin && areSlotsEqual(slots, builtin.slots)) {
        return { id: builtin.id, name: builtin.name, color: builtin.color, isBuiltin: true };
      }
      const custom = customPresets.find((p) => p.id === activePresetId);
      if (custom && areSlotsEqual(slots, custom.slots)) {
        return { id: custom.id, name: custom.name, color: custom.color, isBuiltin: false };
      }
    }

    // 2. Check built-in catalog first (official presets take precedence over duplicate custom presets)
    for (const p of BUILTIN_PRESETS_CATALOG) {
      if (areSlotsEqual(slots, p.slots)) {
        return { id: p.id, name: p.name, color: p.color, isBuiltin: true };
      }
    }

    // 3. Check custom presets
    for (const p of customPresets) {
      if (areSlotsEqual(slots, p.slots)) {
        return { id: p.id, name: p.name, color: p.color, isBuiltin: false };
      }
    }

    return null;
  }, [slots, customPresets, activePresetId, templateContentCache]);

  // Revert slot to default profile state
  const handleRevertSlot = (side: 'left' | 'right') => {
    Sound.playSwitch();
    const slotKey = side === 'left' ? leftKey : rightKey;
    const def = DEFAULT_DEV_SLOTS[slotKey];
    if (def) {
      setSlots((prev) => ({ ...prev, [slotKey]: JSON.parse(JSON.stringify(def)) }));
    }
  };

  // Commit all staged modifications to kneeboards.json and regenerate
  const handleCommitToCockpit = () => {
    Sound.playCommit();
    setCommitState('committing');

    const preparedSlots: Record<string, SlotConfig> = {};
    for (const [key, slot] of Object.entries(slots)) {
      if (slot.content !== undefined) {
        preparedSlots[key] = {
          ...slot,
          notes: slot.content.split('\n'),
        };
      } else {
        preparedSlots[key] = slot;
      }
    }

    Ipc.commitKneeboardLayout(preparedSlots);
    Ipc.regenerateKneeboards();

    // Fallback watchdog in case host encounters an error
    setTimeout(() => {
      setCommitState((prev) => (prev === 'committing' ? 'idle' : prev));
    }, 35000);
  };

  // Trigger manual chart regeneration
  const handleRegenerateCharts = () => {
    Sound.playSwitch();
    setRegenState('running');
    Ipc.regenerateKneeboards();

    // Fallback watchdog in case host encounters an error
    setTimeout(() => {
      setRegenState((prev) => (prev === 'running' ? 'idle' : prev));
    }, 35000);
  };

  // Stamp Insertion at current text cursor position
  const handleInsertStamp = (side: 'left' | 'right', stampTemplate: string) => {
    Sound.playClick();
    const textarea = side === 'left' ? leftTextareaRef.current : rightTextareaRef.current;
    const currentContent = getSlotDisplayContent(side === 'left' ? leftSlot : rightSlot);

    if (textarea && textarea.selectionStart !== undefined) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const insertText = '\n' + stampTemplate;
      const updated = currentContent.substring(0, start) + insertText + currentContent.substring(end);
      handleUpdateSlotContent(side, updated);
      setTimeout(() => {
        textarea.focus();
        const nextPos = start + insertText.length;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 20);
    } else {
      const updated = currentContent + '\n' + stampTemplate;
      handleUpdateSlotContent(side, updated);
    }
    setEditStampDropdownOpen(null);
  };

  // Text formatting insertion/wrapping at cursor or selection
  const handleFormatText = (
    side: 'left' | 'right',
    prefix: string,
    suffix: string = '',
    defaultText: string = ''
  ) => {
    Sound.playClick();
    const textarea = side === 'left' ? leftTextareaRef.current : rightTextareaRef.current;
    const currentContent = getSlotDisplayContent(side === 'left' ? leftSlot : rightSlot);
    if (!textarea) return;

    const start = textarea.selectionStart ?? currentContent.length;
    const end = textarea.selectionEnd ?? currentContent.length;
    const selectedText = currentContent.substring(start, end);

    const replacement =
      selectedText.length > 0
        ? `${prefix}${selectedText}${suffix}`
        : `${prefix}${defaultText}${suffix}`;

    const updated = currentContent.substring(0, start) + replacement + currentContent.substring(end);
    handleUpdateSlotContent(side, updated);

    setTimeout(() => {
      textarea.focus();
      if (selectedText.length > 0) {
        const newStart = start + prefix.length;
        const newEnd = newStart + selectedText.length;
        textarea.setSelectionRange(newStart, newEnd);
      } else {
        const cursorPos = start + prefix.length + defaultText.length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }
    }, 20);
  };

  // Authentic Blank Aeronautical Card HTML (Matching blank_html.rs)
  const generateBlankCardHtml = (title: string, reason: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }
  body {
    background-color: #FAFAF8;
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    color: #1A1A1A;
    width: 1024px;
    height: 1554px;
    padding: 82px 42px 42px 42px;
    overflow: hidden;
  }
  .outer-card {
    width: 940px;
    height: 1430px;
    margin: 0 auto;
    border: 4px dashed #90A4AE;
    border-radius: 16px;
    background: #FFFFFF;
    text-align: center;
    padding-top: 500px;
  }
  .badge {
    background: #C62828;
    color: #FFFFFF;
    font-size: 26px;
    font-weight: 700;
    padding: 10px 24px;
    border-radius: 8px;
    margin: 0 auto 30px auto;
    display: inline-block;
    text-align: center;
  }
  .main-title {
    font-size: 50px;
    font-weight: 700;
    color: #263238;
    margin-bottom: 25px;
    text-align: center;
  }
  .rule {
    width: 320px;
    height: 4px;
    background: #B0BEC5;
    margin: 0 auto 30px auto;
    border-radius: 2px;
  }
  .ap-title {
    font-size: 38px;
    font-weight: 700;
    color: #0D47A1;
    margin-bottom: 16px;
    text-align: center;
  }
  .reason-desc {
    font-size: 24px;
    font-weight: 700;
    color: #C62828;
    text-transform: uppercase;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="outer-card">
    <div class="badge">AERONAUTICAL KNEEBOARD</div>
    <div class="main-title">[INTENTIONALLY LEFT BLANK]</div>
    <div class="rule"></div>
    <div class="ap-title">${title.toUpperCase()}</div>
    <div class="reason-desc">${reason.toUpperCase()}</div>
  </div>
</body>
</html>`;
  };

  const generatePendingChartCardHtml = (slotKey: string, slot: SlotConfig): string => {
    const title = (slot.title || slot.description || `SLOT ${slotKey}`).toUpperCase();
    return generateBlankCardHtml(title, 'CHART PENDING GENERATION // LOAD MISSION IN BMS OR REGENERATE IN UI');
  };

  // Authentic HTML generator matching notes_html.rs and kneeboard.css
  const generateAuthenticHtml = (
    slot: SlotConfig,
    isLeft: boolean,
    pageNum: string
  ): string => {
    // 1. Blank Page Type
    if (slot.type === 'blank') {
      return generateBlankCardHtml(
        slot.title || 'INTENTIONALLY LEFT BLANK',
        slot.reason || 'INTENTIONALLY LEFT BLANK'
      );
    }

    const slotKey = isLeft ? leftKey : rightKey;
    const isRestore = slot.type === 'restore_original';
    const isPassThrough = slot.type === 'pass_through';

    const effectiveSlot =
      isRestore || isPassThrough
        ? DEFAULT_DEV_SLOTS[slotKey] || { type: 'notes', title: 'STOCK PAGE', preset: 'standard' }
        : slot;

    const bannerHtml = isRestore
      ? `<div style="background: rgba(16, 185, 129, 0.95); color: #000; font-family: monospace; font-size: 13px; font-weight: 700; text-align: center; padding: 8px 12px; margin-bottom: 14px; border-radius: 4px; letter-spacing: 1px;">RESTORE ORIGINAL // STOCK BMS TEXTURE PREVIEW</div>`
      : isPassThrough
      ? `<div style="background: rgba(245, 158, 11, 0.95); color: #000; font-family: monospace; font-size: 13px; font-weight: 700; text-align: center; padding: 8px 12px; margin-bottom: 14px; border-radius: 4px; letter-spacing: 1px;">PASS-THROUGH // UNTOUCHED BMS COCKPIT TEXTURE</div>`
      : '';

    const isBriefing = effectiveSlot.type.startsWith('briefing_');
    const isCustomHtml = effectiveSlot.type === 'custom_html' || effectiveSlot.path?.endsWith('.html');
    const headerCode =
      effectiveSlot.header_code ||
      (isRestore
        ? 'RESTORE // STOCK BMS'
        : isPassThrough
        ? 'PASS-THROUGH // UNTOUCHED'
        : 'T.O. 1F-16CM-1 // FLIGHT-OPS');
    const notchClass = isLeft ? 'notch-left' : 'notch-right';
    const title = effectiveSlot.title || (isLeft ? 'LEFT KNEEBOARD' : 'RIGHT KNEEBOARD');
    const rawContent = getSlotDisplayContent(effectiveSlot);

    // 2. Custom HTML Checklists
    if (isCustomHtml) {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }
body { background: white; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; margin: 0; padding: 24px; color: #111; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
th.title { background: #FFFF44; color: #222222; font-weight: 700; font-size: 16px; text-transform: uppercase; padding: 8px 12px; text-align: left; border: 1px solid #CCCC00; }
tr.odd { background: #F8F8F8; }
tr.even { background: #EEEEEE; }
td { padding: 6px 12px; font-weight: 600; border-bottom: 1px solid #DDDDDD; }
td.half { width: 50%; }
td.rightalign { text-align: right; font-weight: 700; color: #0D47A1; }
.footer { position: fixed; bottom: 12px; left: 24px; right: 24px; border-top: 2px solid #90A4AE; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 11px; color: #546E7A; }
.page-badge { background: #263238; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
</style>
</head>
<body>
<div class="page">
${bannerHtml}
${rawContent}
</div>
<div class="footer">
  <div><img src="data:image/png;base64,${AEROGRAPH_LOGO_B64}" width="16" height="16" style="vertical-align:middle;margin-right:6px;" /> AEROGRAPH TACTICAL KNEEBOARDS</div>
  <div class="page-badge">${pageNum}</div>
</div>
</body>
</html>`;
    }

    // 3. Briefing Card Dynamic Visuals (Read-only flight data)
    if (isBriefing) {
      let bodyHtml = '';
      if (slot.type === 'briefing_roster') {
        bodyHtml = `
<table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-family:monospace; font-size:12px;">
  <tr style="background:#ECEFF1;"><th style="padding:6px;text-align:left;">PACKAGE 4201</th><th style="padding:6px;text-align:right;">4-SHIP F-16CM BLK 50</th></tr>
  <tr><td style="padding:6px;">#1 VIPER 1-1 (LEAD)</td><td style="padding:6px;text-align:right;font-weight:bold;color:#0D47A1;">UHF 305.000 // PRF 1688</td></tr>
  <tr style="background:#F5F5F5;"><td style="padding:6px;">#2 VIPER 1-2 (WING)</td><td style="padding:6px;text-align:right;font-weight:bold;color:#0D47A1;">UHF 305.000 // PRF 1685</td></tr>
  <tr><td style="padding:6px;">#3 VIPER 1-3 (ELEM LEAD)</td><td style="padding:6px;text-align:right;font-weight:bold;color:#0D47A1;">UHF 305.000 // PRF 1681</td></tr>
  <tr style="background:#F5F5F5;"><td style="padding:6px;">#4 VIPER 1-4 (WING)</td><td style="padding:6px;text-align:right;font-weight:bold;color:#0D47A1;">UHF 305.000 // PRF 1684</td></tr>
</table>
<div style="background:#E3F2FD; border-left:4px solid #1565C0; padding:8px 12px; font-family:monospace; font-size:11px; margin-bottom:12px;">
  <strong>IFF MODE 4:</strong> 4211 | <strong>VHF COM 2:</strong> 121.500 | <strong>BULLSEYE:</strong> 045&deg; / 60NM
</div>`;
      } else if (slot.type === 'briefing_steerpoints') {
        bodyHtml = `
<table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-family:monospace; font-size:11px;">
  <tr style="background:#263238; color:white;"><th style="padding:5px;">STPT</th><th style="padding:5px;">NAME</th><th style="padding:5px;">ALT</th><th style="padding:5px;">SPD</th><th style="padding:5px;">TOS</th></tr>
  <tr style="background:#F5F5F5;"><td style="padding:5px;font-weight:bold;">01</td><td>TAKEOFF (RKJK)</td><td>0 FT</td><td>250K</td><td>12:00:00Z</td></tr>
  <tr><td style="padding:5px;font-weight:bold;">02</td><td>DEPARTURE</td><td>15,000</td><td>350K</td><td>12:06:30Z</td></tr>
  <tr style="background:#F5F5F5;"><td style="padding:5px;font-weight:bold;">03</td><td>INGRESS GATE</td><td>22,000</td><td>420K</td><td>12:15:00Z</td></tr>
  <tr><td style="padding:5px;font-weight:bold;">04</td><td>FENCE-IN / IP</td><td>18,000</td><td>480K</td><td>12:22:10Z</td></tr>
  <tr style="background:#F5F5F5;"><td style="padding:5px;font-weight:bold;">05</td><td>TARGET STRIKE</td><td>16,000</td><td>500K</td><td>12:28:45Z</td></tr>
  <tr><td style="padding:5px;font-weight:bold;">06</td><td>RECOVERY BASE</td><td>1,500</td><td>300K</td><td>12:42:00Z</td></tr>
</table>`;
      } else {
        bodyHtml = `<div style="font-family:monospace; font-size:12px; line-height:1.5;">${rawContent.replace(/\n/g, '<br/>')}</div>`;
      }

      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }
body { background-color: #FAFAF8; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #1A1A1A; width: 1024px; height: 1554px; position: relative; overflow: hidden; }
.top-banner { position: absolute; top: 0; left: 0; width: 1024px; height: 130px; overflow: hidden; background: #0D47A1; }
.header-notch { position: absolute; bottom: 0px; background-color: #FAFAF8; z-index: 10; font-weight: 700; font-size: 22px; padding: 6px 26px; color: #0D47A1; }
.notch-left { left: 48px; }
.notch-right { right: 48px; }
.content-container { position: absolute; top: 130px; left: 0; width: 1024px; height: 1344px; padding: 32px 54px; }
.main-title { font-size: 38px; font-weight: 700; font-style: italic; color: #111; margin-bottom: 6px; text-transform: uppercase; }
.subtitle { font-size: 18px; font-weight: 700; color: #546E7A; margin-bottom: 20px; border-bottom: 2px solid #CFD8DC; padding-bottom: 6px; }
.lock-banner { background: #ECEFF1; border-left: 6px solid #455A64; padding: 8px 14px; font-family: monospace; font-size: 13px; color: #37474F; margin-bottom: 20px; font-weight: bold; }
.footer-table { position: absolute; bottom: 24px; left: 54px; width: 916px; border-top: 2.5px solid #90A4AE; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; font-family: monospace; font-size: 13px; color: #455A64; }
.footer-page-badge { background: #263238; color: white; font-weight: 700; padding: 4px 14px; border-radius: 4px; }
</style>
</head>
<body>
<div class="top-banner">
  <svg width="1024" height="130" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="stripes" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="20" height="40" fill="#0D47A1"/>
        <rect width="20" height="40" x="20" fill="#1565C0"/>
      </pattern>
    </defs>
    <rect width="1024" height="130" fill="url(#stripes)"/>
  </svg>
  <div class="header-notch ${notchClass}">${headerCode}</div>
</div>
<div class="content-container">
  ${bannerHtml}
  <div class="main-title">${title}</div>
  <div class="subtitle">AUTOMATED MISSION BRIEFING EXTRACT // T.O. 1F-16CM-1</div>
  <div class="lock-banner">&#128274; DYNAMIC GAME CONTENT &mdash; SYNCHRONIZED DIRECTLY WITH BRIEFING.TXT (READ-ONLY)</div>
  <div style="font-size: 22px;">
    ${bodyHtml}
  </div>
</div>
<div class="footer-table">
  <div><img src="data:image/png;base64,${AEROGRAPH_LOGO_B64}" width="22" height="22" style="vertical-align:middle;margin-right:8px;" /><strong>AEROGRAPH</strong> // TACTICAL KNEEBOARDS</div>
  <div>* DYNAMIC BRIEFING DATA</div>
  <div class="footer-page-badge">${pageNum}</div>
</div>
</body>
</html>`;
    }

    // 4. Authentic Pilot Notes with Strict 'spaced' and ':' Key-Value Badge Row Parser (Matching notes_html.rs)
    let stripeColors = ['#111111'];
    let defaultHdr = '#111111';

    if (slot.stripe_colors && slot.stripe_colors.length > 0) {
      stripeColors = [...slot.stripe_colors];
      defaultHdr = stripeColors[0];
    } else if (slot.preset) {
      switch (slot.preset.toLowerCase()) {
        case 'caution':
          stripeColors = ['#111111', '#F5D742'];
          defaultHdr = '#111111';
          break;
        case 'warning':
          stripeColors = ['#111111', '#D32F2F'];
          defaultHdr = '#D32F2F';
          break;
        case 'emergency':
          stripeColors = ['#D32F2F'];
          defaultHdr = '#D32F2F';
          break;
        case 'tactical':
        case 'blue':
          stripeColors = ['#0D47A1', '#0288D1'];
          defaultHdr = '#0D47A1';
          break;
        case 'green':
          stripeColors = ['#1B5E20', '#388E3C'];
          defaultHdr = '#1B5E20';
          break;
        default:
          stripeColors = ['#111111'];
          defaultHdr = '#111111';
          break;
      }
    } else if (slot.stripe_color) {
      stripeColors = [slot.stripe_color];
      defaultHdr = slot.stripe_color;
    }

    const headerTextColor = slot.header_color || defaultHdr;
    const isSpaced = slot.spaced !== undefined && slot.spaced !== null ? slot.spaced : true;
    const subtitle = slot.subtitle;
    const titleText = slot.title;

    const parseInline = (text: string): string => {
      // 1. Color tags: {color: text}
      let res = text.replace(/\{([a-zA-Z0-9#-]+):\s*([^}]+)\}/g, (_, tag, content) => {
        const t = tag.toLowerCase();
        switch (t) {
          case 'red': return `<span style="color:#D32F2F;font-weight:bold;">${content}</span>`;
          case 'yellow': return `<span style="color:#F57F17;font-weight:bold;">${content}</span>`;
          case 'green': return `<span style="color:#2E7D32;font-weight:bold;">${content}</span>`;
          case 'blue': return `<span style="color:#1565C0;font-weight:bold;">${content}</span>`;
          case 'orange': return `<span style="color:#E65100;font-weight:bold;">${content}</span>`;
          case 'cyan': return `<span style="color:#00838F;font-weight:bold;">${content}</span>`;
          case 'purple': return `<span style="color:#7B1FA2;font-weight:bold;">${content}</span>`;
          case 'magenta': return `<span style="color:#C2185B;font-weight:bold;">${content}</span>`;
          case 'pink': return `<span style="color:#D81B60;font-weight:bold;">${content}</span>`;
          case 'violet': return `<span style="color:#5E35B1;font-weight:bold;">${content}</span>`;
          case 'teal': return `<span style="color:#00796B;font-weight:bold;">${content}</span>`;
          case 'lime': return `<span style="color:#689F38;font-weight:bold;">${content}</span>`;
          case 'brown': return `<span style="color:#5D4037;font-weight:bold;">${content}</span>`;
          case 'white': return `<span style="color:#FFFFFF;background-color:#263238;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'highlight':
          case 'bg-yellow': return `<span style="background-color:#FFF59D;color:#111111;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-red': return `<span style="background-color:#FFCDD2;color:#B71C1C;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-green': return `<span style="background-color:#C8E6C9;color:#1B5E20;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-blue': return `<span style="background-color:#BBDEFB;color:#0D47A1;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-purple': return `<span style="background-color:#E1BEE7;color:#4A148C;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          default:
            if (t.startsWith('#')) return `<span style="color:${t};font-weight:bold;">${content}</span>`;
            return `{${tag}: ${content}}`;
        }
      });

      // 2. Bold: **text**
      res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

      // 3. Italic: *text* (word boundaries or whitespace/punctuation)
      res = res.replace(/(^|\s)\*([^*\n]+?)\*($|\s|[.,;:!?])/g, '$1<em>$2</em>$3');

      // 4. Italic: _text_
      res = res.replace(/(^|\s)_([^_\n]+?)_($|\s|[.,;:!?])/g, '$1<em>$2</em>$3');

      // 5. Unescape \:, \[, \], \#, \>, \*, \_
      res = res
        .replace(/\\:/g, ':')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']')
        .replace(/\\#/g, '#')
        .replace(/\\>/g, '>')
        .replace(/\\\*/g, '*')
        .replace(/\\_/g, '_');

      return res;
    };

    let inList = false;
    let bodyFormatted = '';
    const lines = rawContent.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        if (inList) {
          bodyFormatted += '</ul>\n';
          inList = false;
        }
        bodyFormatted += '<div class="spacer"></div>\n';
      } else if (t.startsWith('### ')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        bodyFormatted += `<div class="section-h3">${parseInline(t.substring(4))}</div>\n`;
      } else if (t.startsWith('## ')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        bodyFormatted += `<div class="section-h2">${parseInline(t.substring(3))}</div>\n`;
      } else if (t.startsWith('# ')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        bodyFormatted += `<div class="section-h1" style="color:${headerTextColor};border-left-color:${headerTextColor};">${parseInline(t.substring(2))}</div>\n`;
      } else if (t.startsWith('> ') || t.startsWith('>')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const quoteText = t.startsWith('> ') ? t.substring(2) : t.substring(1);
        bodyFormatted += `<div class="note-quote">${parseInline(quoteText)}</div>\n`;
      } else if (t.startsWith('![') && t.endsWith(')') && t.includes('](')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const closeIdx = t.indexOf('](');
        const alt = t.substring(2, closeIdx);
        const src = t.substring(closeIdx + 2, t.length - 1);
        bodyFormatted += `<div class="note-img-wrap"><img src="${src.trim()}" alt="${alt.trim()}" class="note-img" /></div>\n`;
      } else if (
        t.startsWith('[') && t.endsWith(']') &&
        !t.startsWith('[ ]') && !t.startsWith('[x]') && !t.startsWith('[X]') &&
        !t.startsWith('\\[')
      ) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const badgeTitle = t.slice(1, -1);
        bodyFormatted += `<div class="section-badge">${parseInline(badgeTitle)}</div>\n`;
      } else if (
        (t.toUpperCase().startsWith('WARNING:') || t.toUpperCase().startsWith('[WARNING]')) &&
        !t.startsWith('\\WARNING:') && !t.startsWith('\\[WARNING]') &&
        !t.startsWith('\\warning:') && !t.startsWith('\\[warning]')
      ) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const content = t.toUpperCase().startsWith('WARNING:') ? t.substring(8) : t.substring(9);
        bodyFormatted += `<table class="alert-table warning" cellpadding="0" cellspacing="0"><tr><td class="alert-badge-cell"><span class="alert-badge">WARNING</span></td><td class="alert-text-cell">${parseInline(content.trim())}</td></tr></table>\n`;
      } else if (
        (t.toUpperCase().startsWith('CAUTION:') || t.toUpperCase().startsWith('[CAUTION]')) &&
        !t.startsWith('\\CAUTION:') && !t.startsWith('\\[CAUTION]') &&
        !t.startsWith('\\caution:') && !t.startsWith('\\[caution]')
      ) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const content = t.toUpperCase().startsWith('CAUTION:') ? t.substring(8) : t.substring(9);
        bodyFormatted += `<table class="alert-table caution" cellpadding="0" cellspacing="0"><tr><td class="alert-badge-cell"><span class="alert-badge">CAUTION</span></td><td class="alert-text-cell">${parseInline(content.trim())}</td></tr></table>\n`;
      } else if (t.startsWith('[ ] ') || t.startsWith('- [ ] ')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const text = t.startsWith('- ') ? t.substring(6) : t.substring(4);
        bodyFormatted += `<table class="check-table" cellpadding="0" cellspacing="0"><tr><td class="check-box-cell"><div class="check-box"></div></td><td class="check-text-cell">${parseInline(text.trim())}</td></tr></table>\n`;
      } else if (t.startsWith('[x] ') || t.startsWith('[X] ') || t.startsWith('- [x] ') || t.startsWith('- [X] ')) {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        const text = t.startsWith('- ') ? t.substring(6) : t.substring(4);
        bodyFormatted += `<table class="check-table checked" cellpadding="0" cellspacing="0"><tr><td class="check-box-cell"><div class="check-box checked">&#x2714;</div></td><td class="check-text-cell">${parseInline(text.trim())}</td></tr></table>\n`;
      } else if (t.startsWith('- ') || t.startsWith('* ')) {
        if (!inList) {
          bodyFormatted += '<ul class="notes-list">\n';
          inList = true;
        }
        bodyFormatted += `  <li>${parseInline(t.substring(2))}</li>\n`;
      } else if (t.includes(':')) {
        const colonIdx = t.indexOf(':');
        const isEscaped = colonIdx > 0 && t[colonIdx - 1] === '\\';
        const key = t.substring(0, colonIdx).trim();
        const val = t.substring(colonIdx + 1).trim();
        if (!isEscaped && key.length > 0 && key.length <= 28 && val.length > 0 && /^[\w\s\/\-_]+$/.test(key)) {
          if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
          bodyFormatted += `<table class="kv-table" cellpadding="0" cellspacing="0"><tr><td class="kv-key">${parseInline(key)}</td><td class="kv-val">${parseInline(val)}</td></tr></table>\n`;
        } else {
          if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
          bodyFormatted += `<p class="note-line">${parseInline(t)}</p>\n`;
        }
      } else {
        if (inList) { bodyFormatted += '</ul>\n'; inList = false; }
        bodyFormatted += `<p class="note-line">${parseInline(t)}</p>\n`;
      }
    }
    if (inList) {
      bodyFormatted += '</ul>\n';
    }

    // Precise SVG Stripe Generation adhering strictly to spaced parameter
    let bannerSvg = '';
    if (isSpaced) {
      const stripeW = 20;
      const pw = stripeW * 2 * stripeColors.length;
      let rects = '';
      for (let i = 0; i < stripeColors.length; i++) {
        const xColor = i * 2 * stripeW;
        const xGap = xColor + stripeW;
        rects += `<rect width="${stripeW}" height="40" x="${xColor}" fill="${stripeColors[i]}"/>\n`;
        rects += `<rect width="${stripeW}" height="40" x="${xGap}" fill="#FAFAF8"/>\n`;
      }
      bannerSvg = `<svg width="1024" height="130" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="stripes" width="${pw}" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            ${rects}
          </pattern>
        </defs>
        <rect width="1024" height="130" fill="url(#stripes)"/>
      </svg>`;
    } else {
      if (stripeColors.length === 1) {
        bannerSvg = `<svg width="1024" height="130" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="stripes" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="20" height="40" x="0" fill="${stripeColors[0]}"/>
              <rect width="20" height="40" x="20" fill="#FAFAF8"/>
            </pattern>
          </defs>
          <rect width="1024" height="130" fill="url(#stripes)"/>
        </svg>`;
      } else {
        const pw = 20 * stripeColors.length;
        let rects = '';
        for (let i = 0; i < stripeColors.length; i++) {
          rects += `<rect width="20" height="40" x="${i * 20}" fill="${stripeColors[i]}"/>\n`;
        }
        bannerSvg = `<svg width="1024" height="130" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="stripes" width="${pw}" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              ${rects}
            </pattern>
          </defs>
          <rect width="1024" height="130" fill="url(#stripes)"/>
        </svg>`;
      }
    }

    const titleHtml = titleText && titleText.trim().length > 0
      ? `<div class="main-title">${titleText.trim()}</div>\n`
      : '';
    const subtitleHtml = subtitle && subtitle.trim().length > 0
      ? `<div class="subtitle">${parseInline(subtitle.trim())}</div>\n`
      : '';
    const pageBadgeHtml = slot.page_num && slot.page_num.trim().length > 0
      ? `<span class="footer-page-badge">${slot.page_num.trim()}</span>`
      : '';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; }
body {
  background-color: #FAFAF8;
  font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
  color: #1A1A1A;
  width: 1024px;
  height: 1554px;
  position: relative;
  overflow: hidden;
}

.top-banner {
  position: absolute;
  top: 0;
  left: 0;
  width: 1024px;
  height: 130px;
  overflow: hidden;
}

.header-notch {
  position: absolute;
  bottom: 0px;
  background-color: #FAFAF8;
  border: none;
  border-collapse: collapse;
  z-index: 10;
}
.header-notch-inner {
  padding: 4px 26px;
  font-weight: 700;
  font-size: 22px;
  letter-spacing: 0.5px;
  color: ${headerTextColor};
  white-space: nowrap;
  vertical-align: middle;
}
.notch-left { left: 48px; }
.notch-right { right: 48px; }

.content-container {
  position: absolute;
  top: 130px;
  left: 0;
  width: 1024px;
  height: 1344px;
  padding: 24px 64px 20px 64px;
}

.main-title {
  font-size: 40px;
  font-weight: 700;
  font-style: italic;
  color: #111111;
  line-height: 1.15;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 20px;
  font-weight: 700;
  color: #546E7A;
  letter-spacing: 1.2px;
  margin-bottom: 18px;
  text-transform: uppercase;
  border-bottom: 2px solid #CFD8DC;
  padding-bottom: 8px;
}

.spacer { height: 12px; }

.section-h1 {
  font-size: 28px;
  font-weight: 700;
  color: #0D47A1;
  background-color: #E3F2FD;
  border-left: 6px solid #1565C0;
  padding: 8px 14px;
  margin: 14px 0 8px 0;
  text-transform: uppercase;
  border-radius: 0 4px 4px 0;
}

.section-h2 {
  font-size: 24px;
  font-weight: 700;
  color: #263238;
  border-bottom: 2px solid #90A4AE;
  padding-bottom: 4px;
  margin: 14px 0 6px 0;
  text-transform: uppercase;
}

.section-h3 {
  font-size: 21px;
  font-weight: 700;
  color: #37474F;
  margin: 12px 0 6px 0;
}

.section-badge {
  display: inline-block;
  background-color: #263238;
  color: #FFFFFF;
  font-size: 19px;
  font-weight: 700;
  padding: 4px 16px;
  border-radius: 4px;
  margin: 12px 0 6px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.note-quote {
  border-left: 5px solid #455A64;
  background-color: #ECEFF1;
  padding: 8px 16px;
  margin: 8px 0;
  font-size: 21px;
  font-weight: 600;
  color: #263238;
  border-radius: 0 4px 4px 0;
}

.note-img-wrap {
  text-align: center;
  margin: 10px 0;
}
.note-img {
  max-width: 100%;
  max-height: 480px;
  height: auto;
  border-radius: 6px;
  border: 1px solid #CFD8DC;
}

.alert-table {
  width: 100%;
  margin: 8px 0;
  border-radius: 6px;
  border-collapse: separate;
  padding: 8px 14px;
}
.alert-table.warning {
  background-color: #FFEBEE;
  border: 2px solid #C62828;
}
.alert-table.caution {
  background-color: #FFF8E1;
  border: 2px solid #F57F17;
}
.alert-badge-cell {
  width: 130px;
  vertical-align: middle;
  padding-right: 14px;
}
.alert-badge {
  display: inline-block;
  color: #FFFFFF;
  padding: 3px 12px;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 1px;
  text-align: center;
}
.alert-table.warning .alert-badge { background-color: #C62828; }
.alert-table.caution .alert-badge { background-color: #F57F17; }
.alert-text-cell {
  font-size: 22px;
  font-weight: 700;
  vertical-align: middle;
}
.alert-table.warning .alert-text-cell { color: #B71C1C; }
.alert-table.caution .alert-text-cell { color: #E65100; }

.check-table {
  width: 100%;
  margin: 6px 0;
  border-collapse: collapse;
}
.check-box-cell {
  width: 36px;
  vertical-align: middle;
  padding-right: 12px;
}
.check-box {
  width: 24px;
  height: 24px;
  border: 2px solid #455A64;
  border-radius: 4px;
  background-color: #FFFFFF;
  box-sizing: border-box;
}
.check-box.checked {
  background-color: #2E7D32;
  border-color: #2E7D32;
  color: #FFFFFF;
  font-size: 17px;
  line-height: 20px;
  text-align: center;
  font-weight: 700;
}
.check-text-cell {
  font-size: 22px;
  font-weight: 700;
  color: #263238;
  vertical-align: middle;
}

.notes-list {
  list-style-type: square;
  margin-left: 32px;
  margin-bottom: 8px;
}
.notes-list li {
  font-size: 22px;
  font-weight: 600;
  color: #212121;
  padding: 3px 0;
  line-height: 1.35;
}

.kv-table {
  width: 100%;
  background-color: #ECEFF1;
  border-radius: 6px;
  margin: 5px 0;
  border-collapse: separate;
}
.kv-key {
  padding: 8px 16px;
  font-weight: 700;
  font-size: 22px;
  color: #37474F;
  text-align: left;
  text-transform: uppercase;
  vertical-align: middle;
}
.kv-val {
  padding: 8px 16px;
  font-weight: 700;
  font-size: 22px;
  color: #0D47A1;
  text-align: right;
  font-family: "Lucida Console", "Consolas", monospace;
  letter-spacing: 0.5px;
  vertical-align: middle;
}

.note-line {
  font-size: 22px;
  line-height: 1.4;
  color: #263238;
  font-weight: 500;
  padding: 2px 0;
  white-space: pre-wrap;
}

.footer-table {
  position: absolute;
  bottom: 24px;
  left: 64px;
  width: 896px;
  border-top: 2.5px solid #90A4AE;
  border-collapse: collapse;
}
.footer-left {
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
  width: 320px;
  padding-top: 14px;
  padding-bottom: 2px;
}
.footer-logo {
  width: 28px;
  height: 28px;
  vertical-align: middle;
  margin-right: 8px;
}
.footer-title {
  font-size: 18px;
  font-weight: 700;
  color: #263238;
  letter-spacing: 1px;
  vertical-align: middle;
}
.footer-sub {
  font-size: 14px;
  font-weight: 700;
  color: #78909C;
  vertical-align: middle;
}
.footer-center {
  text-align: center;
  vertical-align: middle;
  font-size: 15px;
  font-weight: 700;
  color: #546E7A;
  font-style: italic;
  padding-top: 14px;
  padding-bottom: 2px;
}
.footer-right {
  text-align: right;
  vertical-align: middle;
  white-space: nowrap;
  width: 160px;
  padding-top: 14px;
  padding-bottom: 2px;
}
.footer-page-badge {
  background-color: #263238;
  color: #FFFFFF;
  font-size: 18px;
  font-weight: 700;
  padding: 4px 18px;
  border-radius: 6px;
  letter-spacing: 1px;
  display: inline-block;
}
</style>
</head>
<body>
<div class="top-banner">
  ${bannerSvg}
  <table class="header-notch ${notchClass}" cellpadding="0" cellspacing="0">
    <tr>
      <td class="header-notch-inner">${headerCode}</td>
    </tr>
  </table>
</div>
<div class="content-container">
  ${bannerHtml}
  ${titleHtml}
  ${subtitleHtml}
  ${bodyFormatted}
</div>
<table class="footer-table" cellpadding="0" cellspacing="0">
  <tr>
    <td class="footer-left">
      <img src="data:image/png;base64,${AEROGRAPH_LOGO_B64}" class="footer-logo" alt="AeroGraph Logo" />
      <span class="footer-title">AEROGRAPH</span>
      <span class="footer-sub">&nbsp;// TACTICAL</span>
    </td>
    <td class="footer-center">
      * COCKPIT CERTIFIED FLIGHT NOTES
    </td>
    <td class="footer-right">
      ${pageBadgeHtml}
    </td>
  </tr>
</table>
</body>
</html>`;
  };

  const leftImgSrc = getSlotImagePath(leftKey, leftSlot);
  const rightImgSrc = getSlotImagePath(rightKey, rightSlot);
  const leftFilename = getSlotImageFilename(leftSlot);
  const rightFilename = getSlotImageFilename(rightSlot);

  // If a slot requires a generated chart/checklist image, verify it exists in generatedImages
  const isLeftImageMissing = leftFilename !== null && !generatedImages.includes(leftFilename);
  const isRightImageMissing = rightFilename !== null && !generatedImages.includes(rightFilename);

  // Combine built-in templates catalog with user-created custom templates
  const allTemplates = useMemo(() => {
    return [...customTemplates, ...availableTemplates];
  }, [customTemplates, availableTemplates]);

  // Filter templates based on active category tab and search input
  const filteredTemplates = allTemplates.filter((t) => {
    if (libraryCategory !== 'all') {
      if (libraryCategory === 'notes' && t.category !== 'notes') return false;
      if (libraryCategory === 'checklist' && t.category !== 'checklist') return false;
      if (libraryCategory === 'chart' && t.category !== 'chart') return false;
    }
    if (!librarySearch) return true;
    const query = librarySearch.toLowerCase();
    return (
      t.name.toLowerCase().includes(query) ||
      (t.default_title && t.default_title.toLowerCase().includes(query)) ||
      (t.description && t.description.toLowerCase().includes(query)) ||
      t.path.toLowerCase().includes(query)
    );
  });

  // Radial Page Clock Navigation (1-16)
  const handleRadialPageSelect = (side: 'left' | 'right', pageNum: number) => {
    Sound.playPageTurn();
    if (side === 'left') {
      setLeftSlotIndex(pageNum);
    } else {
      setRightSlotIndex(pageNum);
    }
    setRadialOpenFor(null);
  };

  // Compute scale for left and right previews
  const activeLeftScale = leftZoom === 'fit' ? leftFitScale : leftZoom;
  const activeRightScale = rightZoom === 'fit' ? rightFitScale : rightZoom;

  const renderEditorToolbar = (side: 'left' | 'right') => {
    return (
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#141416] border border-white/[0.08] rounded text-[10px]">
        {/* Bold */}
        <button
          type="button"
          title="Bold (**text**)"
          onClick={() => handleFormatText(side, '**', '**', 'bold text')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          B
        </button>
        {/* Italic */}
        <button
          type="button"
          title="Italic (_text_)"
          onClick={() => handleFormatText(side, '_', '_', 'italic text')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white italic font-serif cursor-pointer transition-colors"
        >
          I
        </button>

        {/* Color Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setColorDropdownOpen(colorDropdownOpen === side ? null : side)}
            className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-accent font-bold cursor-pointer flex items-center gap-1 transition-colors"
          >
            <span>🎨 Color ▾</span>
          </button>
          {colorDropdownOpen === side && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColorDropdownOpen(null)} />
              <div className="absolute left-0 top-full mt-1 w-60 bg-[#18181B] border border-white/10 rounded-lg shadow-2xl p-2 z-40 max-h-72 overflow-y-auto space-y-2">
                <div>
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Text Colors
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {PREDEFINED_COLORS.filter((c) => !c.bg).map((c) => (
                      <button
                        key={c.tag}
                        type="button"
                        onClick={() => {
                          handleFormatText(side, `{${c.tag}: `, '}', 'text');
                          setColorDropdownOpen(null);
                        }}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-[#27272A] text-left cursor-pointer transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-black/30 flex-shrink-0"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="text-zinc-200 text-[10px] font-mono">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-white/[0.08] pt-1.5">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                    Background Badges
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    {PREDEFINED_COLORS.filter((c) => c.bg).map((c) => (
                      <button
                        key={c.tag}
                        type="button"
                        onClick={() => {
                          handleFormatText(side, `{${c.tag}: `, '}', 'text');
                          setColorDropdownOpen(null);
                        }}
                        className="flex items-center gap-1.5 p-1 rounded hover:bg-[#27272A] text-left cursor-pointer transition-colors"
                      >
                        <span
                          className="px-1 rounded text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: c.hex, color: c.textColor }}
                        >
                          Abc
                        </span>
                        <span className="text-zinc-200 text-[10px] font-mono">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />

        {/* Headings */}
        <button
          type="button"
          title="Heading 1 (# Title)"
          onClick={() => handleFormatText(side, '# ', '', 'TITLE')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          H1
        </button>
        <button
          type="button"
          title="Heading 2 (## Subtitle)"
          onClick={() => handleFormatText(side, '## ', '', 'SUBTITLE')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          H2
        </button>
        <button
          type="button"
          title="Heading 3 (### Subheader)"
          onClick={() => handleFormatText(side, '### ', '', 'SUBHEADER')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          H3
        </button>
        <button
          type="button"
          title="Section Badge ([SECTION])"
          onClick={() => handleFormatText(side, '[', ']', 'SECTION')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          [SEC]
        </button>

        <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />

        {/* Alerts & Quotes */}
        <button
          type="button"
          title="Warning Alert (WARNING: message)"
          onClick={() => handleFormatText(side, 'WARNING: ', '', 'Alert message')}
          className="px-1.5 py-0.5 rounded bg-[#2A1515] hover:bg-[#381B1B] border border-red-500/30 text-red-400 hover:text-red-300 font-bold cursor-pointer transition-colors"
        >
          WARN
        </button>
        <button
          type="button"
          title="Caution Alert (CAUTION: message)"
          onClick={() => handleFormatText(side, 'CAUTION: ', '', 'Caution message')}
          className="px-1.5 py-0.5 rounded bg-[#2A2315] hover:bg-[#382E1B] border border-amber-500/30 text-amber-400 hover:text-amber-300 font-bold cursor-pointer transition-colors"
        >
          CAUT
        </button>
        <button
          type="button"
          title="Blockquote Note (> Note)"
          onClick={() => handleFormatText(side, '> ', '', 'Important note')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          &gt; NOTE
        </button>

        <div className="w-[1px] h-3.5 bg-white/[0.1] mx-0.5" />

        {/* Checklists & Table */}
        <button
          type="button"
          title="Check item ([ ] item)"
          onClick={() => handleFormatText(side, '[ ] ', '', 'Item')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          [ ]
        </button>
        <button
          type="button"
          title="Checked item ([x] item)"
          onClick={() => handleFormatText(side, '[x] ', '', 'Completed item')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-green-400 hover:text-green-300 font-bold cursor-pointer transition-colors"
        >
          [✔]
        </button>
        <button
          type="button"
          title="Bullet list (- item)"
          onClick={() => handleFormatText(side, '- ', '', 'Bullet item')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          &bull; List
        </button>
        <button
          type="button"
          title="Key-Value Card (KEY: VALUE)"
          onClick={() => handleFormatText(side, 'PARAM: ', '', 'VALUE')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          KEY:VAL
        </button>
        <button
          type="button"
          title="Image embed (![alt](path))"
          onClick={() => handleFormatText(side, '![', '](image.png)', 'Description')}
          className="px-1.5 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.06] text-zinc-300 hover:text-white font-bold cursor-pointer transition-colors"
        >
          IMG
        </button>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0E0E10] select-none overflow-hidden font-sans relative">
      {/* 1. Global Tactical Binder Action Ribbon */}
      <div className="h-10 w-full bg-[#141416] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0 font-mono text-xs">
        {/* Left Side: Kneeboards Title */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-white font-bold text-xs uppercase tracking-wider">
              KNEEBOARDS // 32 SLOTS
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            ACTIVE: Left ({leftSlotIndex}L) &bull; Right ({rightSlotIndex}R)
          </span>
        </div>

        {/* Right Side: Primary Actions */}
        <div className="flex items-center space-x-2">
          {/* Active Preset Indicator Pill & Presets Launcher */}
          <button
            type="button"
            onClick={() => {
              Sound.playClick();
              setPresetTab('builtin');
              setPresetsModalOpen(true);
              setPresetFeedback(null);
            }}
            className="h-7 px-2.5 rounded bg-[#1A1A1E] hover:bg-[#222228] border border-white/[0.08] flex items-center space-x-2 cursor-pointer transition-colors"
            title="Current active preset. Click to open Mission Presets catalog."
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{
                backgroundColor: activePreset ? activePreset.color : '#F59E0B',
                boxShadow: `0 0 8px ${activePreset ? activePreset.color : '#F59E0B'}80`,
              }}
            />
            <span className="text-[10px] font-mono text-zinc-300 font-semibold uppercase tracking-wide truncate max-w-[160px]">
              {activePreset ? activePreset.name : 'CUSTOMIZED'}
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                activePreset
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}
            >
              {activePreset ? 'ACTIVE' : 'MODIFIED'}
            </span>
          </button>

          {/* Manage Quick Stamps with Authentic Icon */}
          <button
            type="button"
            onClick={() => {
              Sound.playClick();
              setStampsModalOpen(true);
            }}
            className="h-7 px-2.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
            title="Manage custom stamps (insertables)"
          >
            <svg
              className="w-3.5 h-3.5 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 22h14" />
              <path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77z" />
              <path d="M14 13V8.5C14 7.12 12.88 6 11.5 6S9 7.12 9 8.5V13" />
            </svg>
            <span>STAMPS ({stamps.length})</span>
          </button>

          {/* Refresh Charts */}
          <button
            type="button"
            onClick={handleRegenerateCharts}
            disabled={regenState === 'running'}
            className="h-7 px-3 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 hover:text-white font-mono text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 transition-colors"
            title="Force immediate re-render of mission briefing and flight maps"
          >
            <span className={regenState === 'running' ? 'animate-spin' : ''}>&#8635;</span>
            <span>{regenState === 'running' ? 'REGENERATING...' : 'REFRESH CHARTS'}</span>
          </button>

          {/* Commit To Cockpit */}
          <button
            type="button"
            onClick={handleCommitToCockpit}
            disabled={commitState === 'committing'}
            className={`h-7 px-4 rounded font-mono text-[11px] font-bold uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-colors cursor-pointer ${
              commitState === 'success'
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-accent hover:brightness-110 active:brightness-95 text-black shadow-accent/20'
            }`}
          >
            <span>&#10003;</span>
            <span>
              {commitState === 'committing'
                ? 'COMMITTING...'
                : commitState === 'success'
                ? 'COMMITTED TO COCKPIT!'
                : 'COMMIT TO COCKPIT'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Dual Kneeboard Stations Viewport */}
      <div className="flex-1 w-full p-3 overflow-hidden min-h-0">
        <div className="h-full w-full grid grid-cols-2 gap-3">
          {/* ================= LEFT KNEEBOARD STATION ================= */}
          <div
            onClick={() => setActiveSide('left')}
            className={`h-full flex flex-col rounded bg-[#121214] border transition-colors overflow-hidden ${
              activeSide === 'left' ? 'border-accent/40 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'border-white/[0.08]'
            }`}
          >
            {/* Top Pad Header Bar (Clean, Uncrowded) */}
            <div className="h-10 bg-[#18181B] border-b border-white/[0.08] px-3 flex items-center justify-between shrink-0 font-mono text-xs">
              {/* Slot Pager with Anchored Small Radial Clock Trigger */}
              <div className="flex items-center space-x-2">
                <span className="text-accent font-bold text-xs">LEFT PAD</span>
                <div className="flex items-center space-x-1 bg-black/40 rounded px-1.5 py-0.5 border border-white/[0.06] relative">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.playPageTurn();
                      setLeftSlotIndex((p) => Math.max(1, p - 1));
                    }}
                    disabled={leftSlotIndex <= 1}
                    className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    &larr;
                  </button>

                  {/* Click Badge triggers Anchored Small Circle Selector via Portal */}
                  <div className="relative inline-block">
                    <button
                      ref={leftPageBtnRef}
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        if (radialOpenFor === 'left') {
                          setRadialOpenFor(null);
                        } else {
                          if (leftPageBtnRef.current) {
                            const rect = leftPageBtnRef.current.getBoundingClientRect();
                            setRadialCoords({
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                            });
                          }
                          setRadialOpenFor('left');
                        }
                      }}
                      className="text-white hover:text-accent font-bold text-xs w-8 text-center cursor-pointer transition-colors hover:bg-white/[0.08] rounded py-0.5"
                      title="Click to open page dial"
                    >
                      {leftSlotIndex}L
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      Sound.playPageTurn();
                      setLeftSlotIndex((p) => Math.min(16, p + 1));
                    }}
                    disabled={leftSlotIndex >= 16}
                    className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    &rarr;
                  </button>
                </div>
              </div>

              {/* View / Edit Mode & Primary Actions */}
              <div className="flex items-center space-x-1.5">
                {leftSlot.type === 'notes' ? (
                  <div className="flex bg-black/40 rounded p-0.5 border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        setLeftViewMode('preview');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        leftViewMode === 'preview' ? 'bg-[#27272A] text-accent' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      PREVIEW
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        setLeftViewMode('edit');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        leftViewMode === 'edit' ? 'bg-[#27272A] text-accent' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      EDIT
                    </button>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#1E1E22] border border-white/[0.08] text-zinc-400 uppercase tracking-wider">
                    LOCKED
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setLibraryOpenFor('left')}
                  className="px-2 py-1 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 text-[10px] font-bold cursor-pointer"
                  title="Choose from Template Library"
                >
                  TEMPLATES
                </button>

                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setSettingsSlotKey(leftKey);
                  }}
                  className="px-2 py-1 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 text-[10px] font-bold cursor-pointer"
                  title="Configure slot title, header code, preset and stripes"
                >
                  SETTINGS
                </button>

                <button
                  type="button"
                  onClick={() => handleRevertSlot('left')}
                  title="Restore default slot template"
                  className="p-1 rounded bg-[#18181B] hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 text-[10px] cursor-pointer flex items-center justify-center border border-white/[0.06]"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Left Kneepad Workspace (Scroll from Top, No Clipped Tops or Left Edges) */}
            <div
              ref={leftContainerRef}
              className="flex-1 w-full bg-[#0E0E10] overflow-auto relative p-3 min-h-0"
            >
              {leftViewMode === 'edit' && leftSlot.type === 'notes' ? (
                /* Notes Markdown Editor with Cursor-Aware Stamp Insertion */
                <div className="h-full w-full flex flex-col space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5 relative">
                    <span className="text-zinc-400 text-[11px]">PILOT NOTES MARKDOWN EDITOR</span>
                    {/* Stamp insertion dropdown popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setEditStampDropdownOpen(editStampDropdownOpen === 'left' ? null : 'left')
                        }
                        className="px-2 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-accent text-[10px] font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <span>INSERT STAMP &#9662;</span>
                      </button>
                      {editStampDropdownOpen === 'left' && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setEditStampDropdownOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-64 bg-[#18181B] border border-white/10 rounded shadow-xl p-1 z-40 max-h-56 overflow-y-auto space-y-1">
                            {stamps.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleInsertStamp('left', st.template)}
                                className="w-full text-left p-1.5 rounded hover:bg-[#27272A] text-zinc-300 hover:text-white font-mono text-[10px] block cursor-pointer transition-colors"
                              >
                                <span className="font-bold text-accent block">{st.label}</span>
                                <span className="text-zinc-500 text-[9px] block truncate">{st.template}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {renderEditorToolbar('left')}
                  <textarea
                    ref={leftTextareaRef}
                    value={getSlotDisplayContent(leftSlot)}
                    onChange={(e) => handleUpdateSlotContent('left', e.target.value)}
                    className="flex-1 w-full bg-[#18181B] border border-white/[0.08] rounded p-3 text-zinc-200 font-mono text-xs focus:outline-none focus:border-accent resize-none leading-relaxed"
                    placeholder="Enter pilot notes, check items, or flight protocols in markdown..."
                  />
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Syntax: # H1 &bull; ## H2 &bull; ### H3 &bull; **Bold** &bull; _Italic_ &bull; [SEC] &bull; KEY: VAL &bull; WARNING:</span>
                    <span>Staged in-memory</span>
                  </div>
                </div>
              ) : (
                <div className="w-fit min-w-full min-h-full flex items-start justify-start">
                  {leftImgSrc && !isLeftImageMissing && !failedImages[leftKey] ? (
                    /* High-Resolution Pre-Rendered Flight Chart or User Image Surface */
                    <div
                      className="bg-[#18181B] rounded shadow-2xl overflow-hidden relative border border-white/[0.06] m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeLeftScale)}px`,
                        height: `${Math.round(1554 * activeLeftScale)}px`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={`${leftKey}-${imageRevision}-${leftImgSrc}`}
                        src={leftImgSrc}
                        alt={`Slot ${leftSlotIndex}L Chart`}
                        className={`w-full h-full pointer-events-none select-none ${
                          leftSlot.type === 'image' ? 'object-cover' : 'object-contain'
                        }`}
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [leftKey]: true }));
                        }}
                      />
                      {(leftSlot.type === 'restore_original' || leftSlot.type === 'pass_through') && (
                        <div
                          className="absolute top-0 left-0 right-0 py-1.5 px-3 text-[11px] font-mono font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-2 z-10 shadow-lg"
                          style={{
                            backgroundColor:
                              leftSlot.type === 'restore_original'
                                ? 'rgba(16, 185, 129, 0.95)'
                                : 'rgba(245, 158, 11, 0.95)',
                            color: '#000',
                          }}
                        >
                          <span>
                            {leftSlot.type === 'restore_original'
                              ? 'RESTORE ORIGINAL // STOCK BMS TEXTURE PREVIEW'
                              : 'PASS-THROUGH // UNTOUCHED BMS TEXTURE'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : leftImgSrc && (isLeftImageMissing || failedImages[leftKey]) ? (
                    /* Authentic 1024x1554 Paper Fallback when chart image is not yet generated or failed */
                    <div
                      className="bg-[#FAFAF8] rounded shadow-2xl overflow-hidden relative m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeLeftScale)}px`,
                        height: `${Math.round(1554 * activeLeftScale)}px`,
                      }}
                    >
                      <iframe
                        title="Left Kneeboard Pending Generation View"
                        srcDoc={generatePendingChartCardHtml(leftKey, leftSlot)}
                        className="w-[1024px] h-[1554px] border-none pointer-events-none select-none"
                        style={{
                          transform: `scale(${activeLeftScale})`,
                          transformOrigin: '0 0',
                          width: '1024px',
                          height: '1554px',
                        }}
                      />
                    </div>
                  ) : leftSlot.type === 'image' ? (
                    /* User Image Placeholder when file path not found or empty */
                    <div
                      className="bg-[#121214] rounded shadow-2xl overflow-hidden relative border border-dashed border-white/20 m-auto shrink-0 flex flex-col items-center justify-center p-8 text-center"
                      style={{
                        width: `${Math.round(1024 * activeLeftScale)}px`,
                        height: `${Math.round(1554 * activeLeftScale)}px`,
                      }}
                    >
                      <svg
                        className="w-16 h-16 text-zinc-600 mb-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                        USER IMAGE SLOT (1024 &times; 1554)
                      </span>
                      <span className="text-[11px] text-zinc-500 max-w-xs font-mono">
                        {leftSlot.path
                          ? `Attempting to load: ${leftSlot.path}`
                          : `Slot ${leftKey} is configured as an Image. Specify a PNG/JPG file path in Slot Settings.`}
                      </span>
                    </div>
                  ) : (
                    /* Authentic 1024x1554 Kneeboard Preview Surface (Top-origin zoom) */
                    <div
                      className="bg-[#FAFAF8] rounded shadow-2xl overflow-hidden relative m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeLeftScale)}px`,
                        height: `${Math.round(1554 * activeLeftScale)}px`,
                      }}
                    >
                      <iframe
                        title="Left Kneeboard Authentic View"
                        srcDoc={generateAuthenticHtml(leftSlot, true, `PAGE ${leftSlotIndex}L`)}
                        className="w-[1024px] h-[1554px] border-none pointer-events-none select-none"
                        style={{
                          transform: `scale(${activeLeftScale})`,
                          transformOrigin: '0 0',
                          width: '1024px',
                          height: '1554px',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* New Left Pad Bottom Bar (Type, Name, and Zoom Controls on Right) */}
            <div className="h-8 bg-[#141416] border-t border-white/[0.08] px-3 flex items-center justify-between shrink-0 font-mono text-[11px]">
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/[0.08] text-accent font-bold uppercase shrink-0">
                  {leftSlot.type}
                </span>
                <span className="text-zinc-300 truncate font-medium" title={leftSlot.title || leftSlot.description}>
                  {leftSlot.title || leftSlot.description || `PAGE ${leftSlotIndex}L`}
                </span>
              </div>

              {/* Zoom Controls on the Right */}
              <div className="flex items-center space-x-1 bg-black/40 rounded px-1.5 py-0.5 border border-white/[0.06] text-[10px] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setLeftZoom((z) => (z === 'fit' ? 0.35 : Math.max(0.25, z - 0.1)));
                  }}
                  className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                  title="Zoom Out"
                >
                  &minus;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setLeftZoom('fit');
                  }}
                  className={`px-1.5 font-bold ${leftZoom === 'fit' ? 'text-accent' : 'text-zinc-500 hover:text-white'}`}
                  title="Fit to Window"
                >
                  FIT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setLeftZoom(1.0);
                  }}
                  className={`px-1.5 font-bold ${leftZoom === 1.0 ? 'text-accent' : 'text-zinc-500 hover:text-white'}`}
                  title="Actual Size 100%"
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setLeftZoom((z) => (z === 'fit' ? 0.55 : Math.min(1.5, z + 0.1)));
                  }}
                  className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                  title="Zoom In"
                >
                  &#43;
                </button>
                <span className="text-[9px] text-zinc-500 font-mono pl-1 border-l border-white/[0.1]">
                  {Math.round(activeLeftScale * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* ================= RIGHT KNEEBOARD STATION ================= */}
          <div
            onClick={() => setActiveSide('right')}
            className={`h-full flex flex-col rounded bg-[#121214] border transition-colors overflow-hidden ${
              activeSide === 'right' ? 'border-accent/40 shadow-[0_0_12px_rgba(16,185,129,0.1)]' : 'border-white/[0.08]'
            }`}
          >
            {/* Top Pad Header Bar (Clean, Uncrowded) */}
            <div className="h-10 bg-[#18181B] border-b border-white/[0.08] px-3 flex items-center justify-between shrink-0 font-mono text-xs">
              {/* Slot Pager with Anchored Small Radial Clock Trigger */}
              <div className="flex items-center space-x-2">
                <span className="text-accent font-bold text-xs">RIGHT PAD</span>
                <div className="flex items-center space-x-1 bg-black/40 rounded px-1.5 py-0.5 border border-white/[0.06] relative">
                  <button
                    type="button"
                    onClick={() => {
                      Sound.playPageTurn();
                      setRightSlotIndex((p) => Math.max(1, p - 1));
                    }}
                    disabled={rightSlotIndex <= 1}
                    className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    &larr;
                  </button>

                  {/* Click Badge triggers Anchored Small Circle Selector via Portal */}
                  <div className="relative inline-block">
                    <button
                      ref={rightPageBtnRef}
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        if (radialOpenFor === 'right') {
                          setRadialOpenFor(null);
                        } else {
                          if (rightPageBtnRef.current) {
                            const rect = rightPageBtnRef.current.getBoundingClientRect();
                            setRadialCoords({
                              x: rect.left + rect.width / 2,
                              y: rect.top + rect.height / 2,
                            });
                          }
                          setRadialOpenFor('right');
                        }
                      }}
                      className="text-white hover:text-accent font-bold text-xs w-8 text-center cursor-pointer transition-colors hover:bg-white/[0.08] rounded py-0.5"
                      title="Click to open page dial"
                    >
                      {rightSlotIndex}R
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      Sound.playPageTurn();
                      setRightSlotIndex((p) => Math.min(16, p + 1));
                    }}
                    disabled={rightSlotIndex >= 16}
                    className="px-1.5 text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    &rarr;
                  </button>
                </div>
              </div>

              {/* View / Edit Mode & Primary Actions */}
              <div className="flex items-center space-x-1.5">
                {rightSlot.type === 'notes' ? (
                  <div className="flex bg-black/40 rounded p-0.5 border border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        setRightViewMode('preview');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        rightViewMode === 'preview' ? 'bg-[#27272A] text-accent' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      PREVIEW
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        setRightViewMode('edit');
                      }}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        rightViewMode === 'edit' ? 'bg-[#27272A] text-accent' : 'text-zinc-500 hover:text-white'
                      }`}
                    >
                      EDIT
                    </button>
                  </div>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#1E1E22] border border-white/[0.08] text-zinc-400 uppercase tracking-wider">
                    LOCKED
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setLibraryOpenFor('right')}
                  className="px-2 py-1 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 text-[10px] font-bold cursor-pointer"
                  title="Choose from Template Library"
                >
                  TEMPLATES
                </button>

                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setSettingsSlotKey(rightKey);
                  }}
                  className="px-2 py-1 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-zinc-300 text-[10px] font-bold cursor-pointer"
                  title="Configure slot title, header code, preset and stripes"
                >
                  SETTINGS
                </button>

                <button
                  type="button"
                  onClick={() => handleRevertSlot('right')}
                  title="Restore default slot template"
                  className="p-1 rounded bg-[#18181B] hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 text-[10px] cursor-pointer flex items-center justify-center border border-white/[0.06]"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Kneepad Workspace (Scroll from Top, No Clipped Tops or Left Edges) */}
            <div
              ref={rightContainerRef}
              className="flex-1 w-full bg-[#0E0E10] overflow-auto relative p-3 min-h-0"
            >
              {rightViewMode === 'edit' && rightSlot.type === 'notes' ? (
                /* Notes Markdown Editor with Cursor-Aware Stamp Insertion */
                <div className="h-full w-full flex flex-col space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-1.5 relative">
                    <span className="text-zinc-400 text-[11px]">PILOT NOTES MARKDOWN EDITOR</span>
                    {/* Stamp insertion dropdown popover */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setEditStampDropdownOpen(editStampDropdownOpen === 'right' ? null : 'right')
                        }
                        className="px-2 py-0.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.08] text-accent text-[10px] font-bold cursor-pointer flex items-center space-x-1"
                      >
                        <span>INSERT STAMP &#9662;</span>
                      </button>
                      {editStampDropdownOpen === 'right' && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setEditStampDropdownOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-64 bg-[#18181B] border border-white/10 rounded shadow-xl p-1 z-40 max-h-56 overflow-y-auto space-y-1">
                            {stamps.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => handleInsertStamp('right', st.template)}
                                className="w-full text-left p-1.5 rounded hover:bg-[#27272A] text-zinc-300 hover:text-white font-mono text-[10px] block cursor-pointer transition-colors"
                              >
                                <span className="font-bold text-accent block">{st.label}</span>
                                <span className="text-zinc-500 text-[9px] block truncate">{st.template}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {renderEditorToolbar('right')}
                  <textarea
                    ref={rightTextareaRef}
                    value={getSlotDisplayContent(rightSlot)}
                    onChange={(e) => handleUpdateSlotContent('right', e.target.value)}
                    className="flex-1 w-full bg-[#18181B] border border-white/[0.08] rounded p-3 text-zinc-200 font-mono text-xs focus:outline-none focus:border-accent resize-none leading-relaxed"
                    placeholder="Enter pilot notes, check items, or flight protocols in markdown..."
                  />
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Syntax: # H1 &bull; ## H2 &bull; ### H3 &bull; **Bold** &bull; _Italic_ &bull; [SEC] &bull; KEY: VAL &bull; WARNING:</span>
                    <span>Staged in-memory</span>
                  </div>
                </div>
              ) : (
                <div className="w-fit min-w-full min-h-full flex items-start justify-start">
                  {rightImgSrc && !isRightImageMissing && !failedImages[rightKey] ? (
                    /* High-Resolution Pre-Rendered Flight Chart or User Image Surface */
                    <div
                      className="bg-[#18181B] rounded shadow-2xl overflow-hidden relative border border-white/[0.06] m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeRightScale)}px`,
                        height: `${Math.round(1554 * activeRightScale)}px`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        key={`${rightKey}-${imageRevision}-${rightImgSrc}`}
                        src={rightImgSrc}
                        alt={`Slot ${rightSlotIndex}R Chart`}
                        className={`w-full h-full pointer-events-none select-none ${
                          rightSlot.type === 'image' ? 'object-cover' : 'object-contain'
                        }`}
                        onError={() => {
                          setFailedImages((prev) => ({ ...prev, [rightKey]: true }));
                        }}
                      />
                      {(rightSlot.type === 'restore_original' || rightSlot.type === 'pass_through') && (
                        <div
                          className="absolute top-0 left-0 right-0 py-1.5 px-3 text-[11px] font-mono font-bold uppercase tracking-wider text-center flex items-center justify-center space-x-2 z-10 shadow-lg"
                          style={{
                            backgroundColor:
                              rightSlot.type === 'restore_original'
                                ? 'rgba(16, 185, 129, 0.95)'
                                : 'rgba(245, 158, 11, 0.95)',
                            color: '#000',
                          }}
                        >
                          <span>
                            {rightSlot.type === 'restore_original'
                              ? 'RESTORE ORIGINAL // STOCK BMS TEXTURE PREVIEW'
                              : 'PASS-THROUGH // UNTOUCHED BMS TEXTURE'}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : rightImgSrc && (isRightImageMissing || failedImages[rightKey]) ? (
                    /* Authentic 1024x1554 Paper Fallback when chart image is not yet generated or failed */
                    <div
                      className="bg-[#FAFAF8] rounded shadow-2xl overflow-hidden relative m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeRightScale)}px`,
                        height: `${Math.round(1554 * activeRightScale)}px`,
                      }}
                    >
                      <iframe
                        title="Right Kneeboard Pending Generation View"
                        srcDoc={generatePendingChartCardHtml(rightKey, rightSlot)}
                        className="w-[1024px] h-[1554px] border-none pointer-events-none select-none"
                        style={{
                          transform: `scale(${activeRightScale})`,
                          transformOrigin: '0 0',
                          width: '1024px',
                          height: '1554px',
                        }}
                      />
                    </div>
                  ) : rightSlot.type === 'image' ? (
                    /* User Image Placeholder when file path not found or empty */
                    <div
                      className="bg-[#121214] rounded shadow-2xl overflow-hidden relative border border-dashed border-white/20 m-auto shrink-0 flex flex-col items-center justify-center p-8 text-center"
                      style={{
                        width: `${Math.round(1024 * activeRightScale)}px`,
                        height: `${Math.round(1554 * activeRightScale)}px`,
                      }}
                    >
                      <svg
                        className="w-16 h-16 text-zinc-600 mb-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1">
                        USER IMAGE SLOT (1024 &times; 1554)
                      </span>
                      <span className="text-[11px] text-zinc-500 max-w-xs font-mono">
                        {rightSlot.path
                          ? `Attempting to load: ${rightSlot.path}`
                          : `Slot ${rightKey} is configured as an Image. Specify a PNG/JPG file path in Slot Settings.`}
                      </span>
                    </div>
                  ) : (
                    /* Authentic 1024x1554 Kneeboard Preview Surface (Top-origin zoom) */
                    <div
                      className="bg-[#FAFAF8] rounded shadow-2xl overflow-hidden relative m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeRightScale)}px`,
                        height: `${Math.round(1554 * activeRightScale)}px`,
                      }}
                    >
                      <iframe
                        title="Right Kneeboard Authentic View"
                        srcDoc={generateAuthenticHtml(rightSlot, false, `PAGE ${rightSlotIndex}R`)}
                        className="w-[1024px] h-[1554px] border-none pointer-events-none select-none"
                        style={{
                          transform: `scale(${activeRightScale})`,
                          transformOrigin: '0 0',
                          width: '1024px',
                          height: '1554px',
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* New Right Pad Bottom Bar (Type, Name, and Zoom Controls on Right) */}
            <div className="h-8 bg-[#141416] border-t border-white/[0.08] px-3 flex items-center justify-between shrink-0 font-mono text-[11px]">
              <div className="flex items-center space-x-2 min-w-0 pr-2">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/[0.08] text-accent font-bold uppercase shrink-0">
                  {rightSlot.type}
                </span>
                <span className="text-zinc-300 truncate font-medium" title={rightSlot.title || rightSlot.description}>
                  {rightSlot.title || rightSlot.description || `PAGE ${rightSlotIndex}R`}
                </span>
              </div>

              {/* Zoom Controls on the Right */}
              <div className="flex items-center space-x-1 bg-black/40 rounded px-1.5 py-0.5 border border-white/[0.06] text-[10px] shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setRightZoom((z) => (z === 'fit' ? 0.35 : Math.max(0.25, z - 0.1)));
                  }}
                  className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                  title="Zoom Out"
                >
                  &minus;
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setRightZoom('fit');
                  }}
                  className={`px-1.5 font-bold ${rightZoom === 'fit' ? 'text-accent' : 'text-zinc-500 hover:text-white'}`}
                  title="Fit to Window"
                >
                  FIT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setRightZoom(1.0);
                  }}
                  className={`px-1.5 font-bold ${rightZoom === 1.0 ? 'text-accent' : 'text-zinc-500 hover:text-white'}`}
                  title="Actual Size 100%"
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setRightZoom((z) => (z === 'fit' ? 0.55 : Math.min(1.5, z + 0.1)));
                  }}
                  className="px-1 text-zinc-400 hover:text-white cursor-pointer"
                  title="Zoom In"
                >
                  &#43;
                </button>
                <span className="text-[9px] text-zinc-500 font-mono pl-1 border-l border-white/[0.1]">
                  {Math.round(activeRightScale * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 4. SLOT SETTINGS INSPECTOR MODAL ================= */}
      {settingsSlotKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-mono">
          <div className="w-[640px] max-h-[90vh] bg-[#121214] border border-white/[0.12] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  SLOT SETTINGS &bull; {settingsSlotKey}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSettingsSlotKey(null)}
                className="text-zinc-400 hover:text-white text-base cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {(() => {
                const currentSlot = slots[settingsSlotKey] || DEFAULT_DEV_SLOTS[settingsSlotKey];
                const updateField = (fields: Partial<SlotConfig>) => {
                  setSlots((prev) => ({
                    ...prev,
                    [settingsSlotKey]: { ...currentSlot, ...fields },
                  }));
                };

                return (
                  <>
                    {/* Slot Type Selection */}
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Slot Page Type</label>
                      <select
                        value={currentSlot.type}
                        onChange={(e) => updateField({ type: e.target.value })}
                        className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                      >
                        <option value="notes">notes (Pilot Flight Notes)</option>
                        <option value="blank">blank (Intentionally Left Blank)</option>
                        <option value="restore_original">restore_original (Restore Theater Backup DDS)</option>
                        <option value="pass_through">pass_through (Leave Existing DDS Untouched)</option>
                        <option value="custom_html">custom_html (Checklist HTML)</option>
                        <option value="briefing_roster">briefing_roster (Package Roster)</option>
                        <option value="briefing_steerpoints">briefing_steerpoints (Nav Steerpoints)</option>
                        <option value="mission_route">mission_route (Route Flight Map)</option>
                        <option value="mission_target">mission_target (Target Recon Map)</option>
                        <option value="dep_taxi">dep_taxi (Departure Airfield Taxi)</option>
                        <option value="arr_taxi">arr_taxi (Arrival Airfield Taxi)</option>
                        <option value="arr_ils_primary">arr_ils_primary (Primary ILS Plate)</option>
                        <option value="arr_ils_secondary">arr_ils_secondary (Secondary ILS Plate)</option>
                        <option value="image">image (User PNG/JPG Image)</option>
                      </select>
                    </div>

                    {/* Title */}
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Page Title</label>
                      <input
                        type="text"
                        value={currentSlot.title || ''}
                        onChange={(e) => updateField({ title: e.target.value })}
                        placeholder="e.g. TAKEOFF & DEPARTURE // CLIMB"
                        className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                      />
                    </div>

                    {currentSlot.type === 'notes' && (
                      <>
                        {/* Subtitle */}
                        <div>
                          <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Subtitle</label>
                          <input
                            type="text"
                            value={currentSlot.subtitle || ''}
                            onChange={(e) => updateField({ subtitle: e.target.value })}
                            placeholder="e.g. PILOT FLIGHT NOTES // T.O. 1F-16CM-1"
                            className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>

                        {/* Header Code & Page Num */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Header Notch Code</label>
                            <input
                              type="text"
                              value={currentSlot.header_code || ''}
                              onChange={(e) => updateField({ header_code: e.target.value })}
                              placeholder="e.g. T.O. 1F-16CM-1 // FUEL-OPS"
                              className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Footer Page Badge</label>
                            <input
                              type="text"
                              value={currentSlot.page_num || ''}
                              onChange={(e) => updateField({ page_num: e.target.value })}
                              placeholder="e.g. FUEL-1"
                              className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>

                        {/* Preset & Spaced Stripes */}
                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div>
                            <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Stripe Preset</label>
                            <select
                              value={currentSlot.preset || 'standard'}
                              onChange={(e) => updateField({ preset: e.target.value })}
                              className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                            >
                              <option value="standard">standard (Black / White)</option>
                              <option value="caution">caution (Black / Yellow)</option>
                              <option value="warning">warning (Black / Red)</option>
                              <option value="emergency">emergency (Solid Red / White)</option>
                              <option value="tactical">tactical (Navy / Sky Blue)</option>
                              <option value="green">green (Forest Green)</option>
                            </select>
                          </div>

                          <div className="pt-4">
                            <div className="flex items-center space-x-3">
                              <ShiningCheckbox
                                size={22}
                                checked={currentSlot.spaced !== undefined && currentSlot.spaced !== null ? currentSlot.spaced : true}
                                onChange={(e) => updateField({ spaced: e.target.checked })}
                              />
                              <div>
                                <span className="text-zinc-300 font-bold text-xs block">Spaced Stripes (White Gaps)</span>
                                <span className="text-[10px] text-zinc-500 block">
                                  When enabled, alternates color with #FAFAF8 background gaps
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Custom Header & Stripe Colors */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Custom Header Color</label>
                            <input
                              type="text"
                              value={currentSlot.header_color || ''}
                              onChange={(e) => updateField({ header_color: e.target.value })}
                              placeholder="e.g. #D32F2F"
                              className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                          <div>
                            <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Stripe Color Hex</label>
                            <input
                              type="text"
                              value={currentSlot.stripe_color || ''}
                              onChange={(e) => updateField({ stripe_color: e.target.value })}
                              placeholder="e.g. #F5D742"
                              className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {currentSlot.type === 'blank' && (
                      <div>
                        <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Blank Reason</label>
                        <input
                          type="text"
                          value={currentSlot.reason || ''}
                          onChange={(e) => updateField({ reason: e.target.value })}
                          placeholder="e.g. INTENTIONALLY LEFT BLANK or RESERVED FOR TACTICAL EXPANSION"
                          className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                    )}

                    {(currentSlot.type === 'custom_html' || currentSlot.type === 'image') && (
                      <div>
                        <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">File Path</label>
                        <input
                          type="text"
                          value={currentSlot.path || ''}
                          onChange={(e) => updateField({ path: e.target.value })}
                          placeholder="e.g. custom/kneeboard-checklist-1-start.html"
                          className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="h-11 bg-[#18181B] border-t border-white/[0.08] px-4 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setSettingsSlotKey(null)}
                className="h-7 px-4 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-xs cursor-pointer transition-all"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. QUICK STAMPS (INSERTABLES) MANAGEMENT MODAL ================= */}
      {stampsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-mono">
          <div className="w-[600px] max-h-[85vh] bg-[#121214] border border-white/[0.12] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs">
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  QUICK STAMPS &bull; INSERTABLE SNIPPETS
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStampsModalOpen(false)}
                className="text-zinc-400 hover:text-white text-base cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Stamp List */}
            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {stamps.map((st) => (
                <div
                  key={st.id}
                  className="p-2.5 rounded bg-[#18181B] border border-white/[0.06] flex items-center justify-between"
                >
                  <div className="min-w-0 pr-3">
                    <span className="text-white font-bold text-xs block">{st.label}</span>
                    <span className="text-zinc-400 text-[11px] font-mono block truncate">{st.template}</span>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDeleteStamp(st.id)}
                      className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                      title="Delete stamp"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}

              {/* Add New Stamp Form */}
              <div className="mt-4 pt-3 border-t border-white/[0.08] space-y-2 bg-[#0E0E10] p-3 rounded">
                <span className="text-accent font-bold text-[11px] block uppercase">Add New Stamp</span>
                <input
                  type="text"
                  placeholder="Stamp Label (e.g. BULLSEYE 120)"
                  value={newStampLabel}
                  onChange={(e) => setNewStampLabel(e.target.value)}
                  className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  placeholder="Template Text (e.g. BULLSEYE: {blue: 120 / 45NM})"
                  value={newStampTemplate}
                  onChange={(e) => setNewStampTemplate(e.target.value)}
                  className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                />
                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={handleResetStamps}
                    className="text-[10px] text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    Restore Defaults
                  </button>
                  <button
                    type="button"
                    disabled={!newStampLabel || !newStampTemplate}
                    onClick={() => {
                      const newStamp: QuickStamp = {
                        id: `custom_${Date.now()}`,
                        label: newStampLabel.trim(),
                        template: newStampTemplate.trim(),
                      };
                      handleSaveStamp(newStamp);
                      setNewStampLabel('');
                      setNewStampTemplate('');
                    }}
                    className="h-6 px-3 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[10px] disabled:opacity-40 cursor-pointer transition-all"
                  >
                    + ADD STAMP
                  </button>
                </div>
              </div>
            </div>

            <div className="h-10 bg-[#18181B] border-t border-white/[0.08] px-4 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setStampsModalOpen(false)}
                className="h-6 px-3 rounded bg-[#27272A] hover:bg-[#323238] text-white font-bold text-xs cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= AEROPRESET MANAGEMENT MODAL ================= */}
      {presetsModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 select-none font-mono">
          <div className="w-[660px] max-h-[88vh] bg-[#121214] border border-white/[0.12] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  MISSION PRESETS &bull; .AEROPRESET MANAGEMENT
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPresetsModalOpen(false)}
                className="text-zinc-400 hover:text-white text-base cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-white/[0.08] bg-[#0E0E10] px-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  Sound.playClick();
                  setPresetTab('builtin');
                }}
                className={`pb-2 px-3 text-[11px] font-bold border-b-2 cursor-pointer transition-colors ${
                  presetTab === 'builtin'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                PRE-BUILT COMBAT PRESETS
              </button>
              <button
                type="button"
                onClick={() => {
                  Sound.playClick();
                  setPresetTab('custom');
                }}
                className={`pb-2 px-3 text-[11px] font-bold border-b-2 cursor-pointer transition-colors ${
                  presetTab === 'custom'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                CUSTOM PRESETS ({customPresets.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  Sound.playClick();
                  setPresetTab('import_export');
                }}
                className={`pb-2 px-3 text-[11px] font-bold border-b-2 cursor-pointer transition-colors ${
                  presetTab === 'import_export'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                IMPORT / EXPORT BUNDLES
              </button>
            </div>

            {/* Notification / Feedback Banner */}
            {presetFeedback && (
              <div className="bg-accent/10 border-b border-accent/30 text-accent px-4 py-2 text-[11px] font-bold flex items-center justify-between">
                <span>&#10003; {presetFeedback}</span>
                <button
                  type="button"
                  onClick={() => setPresetFeedback(null)}
                  className="text-accent hover:text-white text-xs cursor-pointer"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              {presetTab === 'builtin' && (
                <div className="space-y-2.5">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">
                    Select a ready-to-fly combat preset to immediately configure your 32 cockpit slots:
                  </span>

                  {BUILTIN_PRESETS_CATALOG.map((preset) => {
                    const isActive = activePreset?.id === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className={`p-3 rounded bg-[#18181B] border transition-colors flex items-center justify-between ${
                          isActive
                            ? 'border-emerald-500/50 bg-emerald-950/10'
                            : 'border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        <div className="min-w-0 pr-4">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-white font-bold text-xs">{preset.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${preset.tagColor.bg} ${preset.tagColor.text} ${preset.tagColor.border}`}
                            >
                              {preset.badge}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1E1E22] text-zinc-400">
                              32 SLOTS
                            </span>
                            {isActive && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>ACTIVE</span>
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-400 text-[11px]">{preset.description}</p>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              Sound.playClick();
                              const nextSlots = JSON.parse(JSON.stringify(preset.slots));
                              setSlots(nextSlots);
                              setActivePresetId(preset.id);
                              if (onSelectAccent) {
                                onSelectAccent(preset.color);
                              } else {
                                Ipc.setAccentColor(preset.color);
                              }
                              Ipc.loadBuiltinPreset(preset.id);
                              setPresetFeedback(`Loaded "${preset.name}" into active cockpit workspace and applied theme!`);
                            }}
                            className="px-3 py-1.5 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[10px] cursor-pointer shadow-md shadow-accent/20 transition-all"
                          >
                            {isActive ? 'RE-APPLY' : 'LOAD PRESET'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {presetTab === 'custom' && (
                <div className="space-y-4">
                  {/* Save Current Workspace Card */}
                  <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.08] space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold text-xs uppercase">
                        Save Current Cockpit Setup (32 Slots)
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-current text-accent bg-accent/15">
                        NEW PRESET
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">
                          Preset Name
                        </label>
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="e.g. Red Flag Strike Bravo"
                          className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">
                          Theater Tag
                        </label>
                        <input
                          type="text"
                          value={newPresetTheater}
                          onChange={(e) => setNewPresetTheater(e.target.value)}
                          placeholder="e.g. NEVADA, KOREA, BALKANS, ALL"
                          className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={newPresetDesc}
                        onChange={(e) => setNewPresetDesc(e.target.value)}
                        placeholder="e.g. Dedicated SEAD loadout with custom ALIC tables and SFO profile"
                        className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                      />
                    </div>

                    {/* Color Palette Selector */}
                    <div>
                      <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1.5">
                        Preset Accent Color (Curated Avionics Palette)
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLOR_PALETTE.map((c) => {
                          const isSelected = selectedPresetColor === c.hex;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                Sound.playClick();
                                setSelectedPresetColor(c.hex);
                              }}
                              className={`h-6 px-2 rounded flex items-center space-x-1.5 border transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-white ring-1 ring-white/80 bg-white/10'
                                  : 'border-white/[0.1] hover:border-white/30 bg-[#1A1A1E]'
                              }`}
                              title={c.name}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: c.hex }}
                              >
                                {c.name.split(' ')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={!newPresetName.trim()}
                        onClick={() => {
                          Sound.playClick();
                          const exportableSlots: Record<string, SlotConfig> = {};
                          for (const [k, v] of Object.entries(slots)) {
                            exportableSlots[k] = {
                              ...v,
                              notes: v.content !== undefined ? v.content : v.notes,
                            };
                          }
                          const created: CustomPreset = {
                            id: `custom_${Date.now()}`,
                            name: newPresetName.trim() || 'Custom Cockpit Preset',
                            description:
                              newPresetDesc.trim() || 'Custom 32-slot operational layout.',
                            theater: newPresetTheater.trim().toUpperCase() || 'ALL',
                            color: selectedPresetColor,
                            slots: exportableSlots,
                            created_at: new Date().toISOString().split('T')[0],
                          };
                          setCustomPresets((prev) => [
                            created,
                            ...prev.filter((p) => p.id !== created.id),
                          ]);
                          setActivePresetId(created.id);
                          if (onSelectAccent) {
                            onSelectAccent(created.color);
                          } else {
                            Ipc.setAccentColor(created.color);
                          }
                          Ipc.saveCustomPreset(created);
                          setNewPresetName('');
                          setNewPresetDesc('');
                          setPresetFeedback(`Saved "${created.name}" and set as active preset!`);
                        }}
                        className="h-7 px-4 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[11px] disabled:opacity-40 cursor-pointer shadow-md shadow-accent/20 transition-all flex items-center space-x-1.5"
                      >
                        <span>SAVE CURRENT AS PRESET</span>
                      </button>
                    </div>
                  </div>

                  {/* List of Custom Presets */}
                  <div className="space-y-2">
                    <span className="text-zinc-400 text-[10px] uppercase font-bold block">
                      Saved Custom Presets ({customPresets.length})
                    </span>

                    {customPresets.length === 0 ? (
                      <div className="p-4 rounded bg-[#18181B] border border-white/[0.06] text-center text-zinc-500 text-xs">
                        No custom presets saved yet. Save your current 32-slot cockpit setup above, or double-click any .aeropreset file in Windows Explorer to import it.
                      </div>
                    ) : (
                      customPresets.map((p) => {
                        const isActive = activePreset?.id === p.id;
                        return (
                          <div
                            key={p.id}
                            className={`p-3 rounded bg-[#18181B] border transition-colors flex items-center justify-between ${
                              isActive
                                ? 'border-emerald-500/50 bg-emerald-950/10'
                                : 'border-white/[0.06] hover:border-white/20'
                            }`}
                          >
                            <div className="min-w-0 pr-4">
                              <div className="flex items-center space-x-2 mb-1">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-white font-bold text-xs">{p.name}</span>
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                                  style={{
                                    borderColor: `${p.color}60`,
                                    backgroundColor: `${p.color}20`,
                                    color: p.color,
                                  }}
                                >
                                  {p.theater || 'ALL'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1E1E22] text-zinc-400">
                                  32 SLOTS
                                </span>
                                {isActive && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>ACTIVE</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-zinc-400 text-[11px] mb-1">{p.description}</p>
                              <span className="text-[10px] text-zinc-500">
                                Created: {p.created_at || 'Recent'}
                              </span>
                            </div>

                            <div className="flex items-center space-x-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  Sound.playClick();
                                  const exportableSlots: Record<string, SlotConfig> = {};
                                  for (const [k, v] of Object.entries(slots)) {
                                    exportableSlots[k] = {
                                      ...v,
                                      notes: v.content !== undefined ? v.content : v.notes,
                                    };
                                  }
                                  const updated = {
                                    ...p,
                                    slots: exportableSlots,
                                  };
                                  setCustomPresets((prev) =>
                                    prev.map((x) => (x.id === p.id ? updated : x))
                                  );
                                  setActivePresetId(p.id);
                                  if (onSelectAccent) {
                                    onSelectAccent(p.color);
                                  } else {
                                    Ipc.setAccentColor(p.color);
                                  }
                                  Ipc.saveCustomPreset(updated);
                                  setPresetFeedback(
                                    `Overwrote "${p.name}" with current cockpit layout and set as active!`
                                  );
                                }}
                                className="px-2 py-1.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.12] text-zinc-300 hover:text-white font-bold text-[10px] cursor-pointer transition-colors"
                                title="Overwrite this preset's 32 slots with current working layout"
                              >
                                OVERRIDE
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  Sound.playClick();
                                  Ipc.exportPreset(p.name, p.description, p.theater, p.color);
                                  setPresetFeedback(`Exporting "${p.name}" bundle to file...`);
                                }}
                                className="px-2 py-1.5 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.12] text-zinc-300 hover:text-white font-bold text-[10px] cursor-pointer transition-colors"
                                title="Export as standalone .aeropreset file"
                              >
                                EXPORT
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  Sound.playClick();
                                  setSlots(JSON.parse(JSON.stringify(p.slots)));
                                  setActivePresetId(p.id);
                                  if (onSelectAccent) {
                                    onSelectAccent(p.color);
                                  } else {
                                    Ipc.setAccentColor(p.color);
                                  }
                                  Ipc.applyCustomPreset(p.id);
                                  setPresetFeedback(
                                    `Activated "${p.name}" into cockpit layout and applied theme!`
                                  );
                                }}
                                className="px-3 py-1.5 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[10px] cursor-pointer shadow-md shadow-accent/20 transition-all"
                              >
                                {isActive ? 'RE-APPLY' : 'LOAD PRESET'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  Sound.playClick();
                                  setCustomPresets((prev) => prev.filter((x) => x.id !== p.id));
                                  Ipc.deleteCustomPreset(p.id);
                                  setPresetFeedback(`Deleted preset "${p.name}".`);
                                }}
                                className="px-2 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-bold text-[10px] cursor-pointer transition-colors"
                                title="Delete this custom preset"
                              >
                                &times;
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {presetTab === 'import_export' && (
                /* Import / Export Section */
                <div className="space-y-4">
                  {/* Import Card */}
                  <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.08] space-y-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold text-xs uppercase">Import .aeropreset Package</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-current text-accent bg-accent/15">COMMUNITY BUNDLE</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Select an exported <code className="text-accent">.aeropreset</code> bundle from your filesystem. AeroGraph will unpack the layout and all custom notes files directly into your workspace.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        Sound.playClick();
                        Ipc.importPreset('');
                        setPresetFeedback('Opening file picker to import .aeropreset bundle...');
                      }}
                      className="h-7 px-3 rounded bg-[#1E1E22] hover:bg-[#27272A] border border-white/[0.12] text-white text-[11px] font-bold flex items-center space-x-1.5 cursor-pointer transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-accent"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>BROWSE & IMPORT (.AEROPRESET)</span>
                    </button>
                  </div>

                  {/* Export Card */}
                  <div className="p-3.5 rounded bg-[#18181B] border border-white/[0.08] space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-bold text-xs uppercase">Export Current Mission Workspace</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-current text-accent bg-accent/15">STANDALONE ARCHIVE</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">
                      Packages your active 32 kneeboard slots and any referenced custom notes or checklist files into a compressed <code className="text-accent">.aeropreset</code> file you can share with your flight wingmen.
                    </p>

                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Preset Title</label>
                        <input
                          type="text"
                          value={exportPresetName}
                          onChange={(e) => setExportPresetName(e.target.value)}
                          placeholder="e.g. Package 4201 Strike"
                          className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Theater</label>
                          <input
                            type="text"
                            value={exportPresetTheater}
                            onChange={(e) => setExportPresetTheater(e.target.value)}
                            placeholder="e.g. KOREA, BALKANS, ISRAEL"
                            className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Description</label>
                          <input
                            type="text"
                            value={exportPresetDesc}
                            onChange={(e) => setExportPresetDesc(e.target.value)}
                            placeholder="e.g. Korea Campaign Day 3 strike"
                            className="w-full h-7 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                          />
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          disabled={!exportPresetName.trim()}
                          onClick={() => {
                            Sound.playClick();
                            Ipc.exportPreset(
                              exportPresetName.trim(),
                              exportPresetDesc.trim(),
                              exportPresetTheater.trim(),
                              activePreset?.color || accentColor || '#10B981'
                            );
                            setPresetFeedback(`Opening save dialog for "${exportPresetName}"...`);
                          }}
                          className="h-7 px-4 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[11px] disabled:opacity-40 cursor-pointer shadow-md shadow-accent/20 transition-all flex items-center space-x-1.5"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-black"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span>EXPORT .AEROPRESET FILE</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="h-10 bg-[#18181B] border-t border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <span className="text-[10px] text-zinc-500 font-mono">
                AeroPreset format compresses layout + referenced notes
              </span>
              <button
                type="button"
                onClick={() => setPresetsModalOpen(false)}
                className="h-6 px-3 rounded bg-[#27272A] hover:bg-[#323238] text-white font-bold text-xs cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. CREATE CUSTOM TEMPLATE MODAL ================= */}
      {newTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-6 select-none font-mono">
          <div className="w-[620px] max-h-[90vh] bg-[#121214] border border-white/[0.12] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs">
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  CREATE CUSTOM TEMPLATE
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNewTemplateModalOpen(false)}
                className="text-zinc-400 hover:text-white text-base cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Template Name</label>
                <input
                  type="text"
                  placeholder="e.g. Korea 2026 Strike Package"
                  value={newTmplName}
                  onChange={(e) => setNewTmplName(e.target.value)}
                  className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Category</label>
                  <select
                    value={newTmplCategory}
                    onChange={(e) => setNewTmplCategory(e.target.value as any)}
                    className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                  >
                    <option value="notes">Pilot Notes</option>
                    <option value="checklist">Checklist</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Header Notch Code</label>
                  <input
                    type="text"
                    placeholder="e.g. T.O. 1F-16CM-1 // STRIKE"
                    value={newTmplCode}
                    onChange={(e) => setNewTmplCode(e.target.value)}
                    className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Default Page Title</label>
                <input
                  type="text"
                  placeholder="e.g. STRIKE MISSION NOTES"
                  value={newTmplTitle}
                  onChange={(e) => setNewTmplTitle(e.target.value)}
                  className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Brief description of this template"
                  value={newTmplDesc}
                  onChange={(e) => setNewTmplDesc(e.target.value)}
                  className="w-full h-8 px-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-[10px] uppercase font-bold block mb-1">Default Content (Markdown)</label>
                <textarea
                  rows={6}
                  placeholder="Enter initial markdown content..."
                  value={newTmplContent}
                  onChange={(e) => setNewTmplContent(e.target.value)}
                  className="w-full p-2 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent font-mono resize-none"
                />
              </div>
            </div>

            <div className="h-11 bg-[#18181B] border-t border-white/[0.08] px-4 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setNewTemplateModalOpen(false)}
                className="h-7 px-3 rounded bg-[#27272A] hover:bg-[#323238] text-zinc-300 font-bold text-xs cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                disabled={!newTmplName}
                onClick={() => {
                  const tmplId = `custom_tmpl_${Date.now()}`;
                  const created: TemplateMetadata = {
                    id: tmplId,
                    type: newTmplCategory === 'checklist' ? 'custom_html' : 'notes',
                    name: newTmplName.trim(),
                    category: newTmplCategory,
                    default_title: newTmplTitle.trim() || newTmplName.trim(),
                    default_code: newTmplCode.trim() || 'CUSTOM // TEMPLATE',
                    path: `custom/${tmplId}.md`,
                    description: newTmplDesc.trim() || 'Custom user template',
                  };
                  handleSaveCustomTemplate(created, newTmplContent);
                  setNewTemplateModalOpen(false);
                  setNewTmplName('');
                  setNewTmplTitle('');
                  setNewTmplCode('');
                  setNewTmplDesc('');
                  setNewTmplContent('');
                }}
                className="h-7 px-4 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-xs disabled:opacity-40 cursor-pointer transition-all"
              >
                SAVE TEMPLATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 7. TEMPLATE LIBRARY SELECTION MODAL ================= */}
      {libraryOpenFor && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8 select-none font-mono">
          <div className="w-[740px] max-h-[85vh] bg-[#121214] border border-white/[0.1] rounded-lg shadow-2xl flex flex-col overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="h-11 bg-[#18181B] border-b border-white/[0.08] px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-white font-bold text-xs uppercase tracking-wider">
                  SELECT KNEEBOARD TEMPLATE // SLOT {libraryOpenFor === 'left' ? `${leftSlotIndex}L` : `${rightSlotIndex}R`}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setNewTemplateModalOpen(true)}
                  className="px-2.5 py-1 rounded bg-accent hover:brightness-110 active:brightness-95 text-black font-bold text-[10px] cursor-pointer transition-all"
                >
                  + CREATE TEMPLATE
                </button>
                <button
                  type="button"
                  onClick={() => setLibraryOpenFor(null)}
                  className="text-zinc-400 hover:text-white text-base cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Categorization Tabs */}
            <div className="h-10 bg-[#0E0E10] border-b border-white/[0.08] px-4 flex items-center space-x-2 shrink-0">
              {(
                [
                  { id: 'all', label: 'ALL TEMPLATES' },
                  { id: 'notes', label: 'PILOT NOTES' },
                  { id: 'checklist', label: 'CHECKLISTS' },
                  { id: 'chart', label: 'CHARTS & TAXI' },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    Sound.playClick();
                    setLibraryCategory(cat.id);
                  }}
                  className={`h-7 px-3 rounded text-[11px] font-bold uppercase border transition-colors cursor-pointer ${
                    libraryCategory === cat.id
                      ? 'bg-[#27272A] border-accent text-accent shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                      : 'bg-[#18181B] border-white/[0.06] text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="p-3 border-b border-white/[0.08] bg-[#0E0E10]">
              <input
                type="text"
                placeholder="Search by title, description, or system code (e.g. BVR, PFL, Fuel, ILS, Taxi)..."
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                className="w-full h-8 px-3 rounded bg-[#1E1E22] border border-white/[0.08] text-white text-xs focus:outline-none focus:border-accent"
              />
            </div>

            {/* Template Catalog Grid */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {filteredTemplates.length > 0 ? (
                filteredTemplates.map((tmpl) => {
                  const isCustom = customTemplates.some((c) => c.id === tmpl.id);
                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(libraryOpenFor, tmpl)}
                      className="p-3 rounded bg-[#18181B] hover:bg-[#27272A] border border-white/[0.06] hover:border-accent/40 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-bold text-xs truncate">{tmpl.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/50 border border-white/[0.08] text-accent font-bold uppercase shrink-0">
                            {tmpl.type || tmpl.id}
                          </span>
                          {isCustom && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-300 font-bold uppercase shrink-0">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">
                          {tmpl.description || tmpl.default_title}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1 font-mono">
                          {tmpl.default_code || tmpl.path}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomTemplate(tmpl.id);
                            }}
                            className="px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                            title="Delete custom template"
                          >
                            &times;
                          </button>
                        )}
                        <span className="text-[10px] px-2.5 py-1 rounded bg-black/40 border border-white/[0.08] text-accent uppercase font-bold tracking-wider">
                          {tmpl.category === 'notes'
                            ? 'NOTE'
                            : tmpl.category === 'checklist'
                            ? 'CHECKLIST'
                            : tmpl.category === 'chart'
                            ? 'CHART'
                            : 'TEMPLATE'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-zinc-500 font-mono text-xs">
                  No matching templates found in category: {libraryCategory.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Radial Page Selector Popover (Overflown via Portal directly into document.body) */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {radialOpenFor && (
            <div className="fixed inset-0 z-[9999] pointer-events-none select-none">
              {/* Invisible Click-Catching Backdrop to close on click outside */}
              <div
                className="absolute inset-0 pointer-events-auto"
                onClick={() => setRadialOpenFor(null)}
              />

              {/* Radial Clock Dial Centered on the Trigger Badge Button */}
              <div
                className="absolute pointer-events-none select-none"
                style={{ left: radialCoords.x, top: radialCoords.y }}
              >
                {Array.from({ length: 16 }, (_, idx) => {
                  const pageNum = idx + 1;
                  const angleDeg = idx * 22.5 - 90;
                  const angleRad = (angleDeg * Math.PI) / 180;
                  const r = 56;
                  const x = Math.round(r * Math.cos(angleRad));
                  const y = Math.round(r * Math.sin(angleRad));
                  const isCur = (radialOpenFor === 'left' ? leftSlotIndex : rightSlotIndex) === pageNum;

                  return (
                    <motion.button
                      key={pageNum}
                      type="button"
                      initial={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                      animate={{ scale: 1, opacity: 1, x, y }}
                      exit={{ scale: 0, opacity: 0, x: 0, y: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28, delay: idx * 0.006 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRadialPageSelect(radialOpenFor, pageNum);
                      }}
                      className={`absolute -ml-2.5 -mt-2.5 w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold pointer-events-auto cursor-pointer shadow-lg will-change-transform ${
                        isCur
                          ? 'bg-accent text-black border border-accent scale-110 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                          : 'bg-[#18181B] text-zinc-200 border border-white/20 hover:bg-accent hover:text-black hover:border-accent hover:scale-125'
                      }`}
                    >
                      {pageNum}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};
