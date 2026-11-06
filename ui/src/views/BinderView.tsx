'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Ipc } from '../services/ipc';
import { Sound } from '../services/sound';
import { SlotConfig, TemplateMetadata, QuickStamp } from '../types/ipc';
import { AVAILABLE_TEMPLATES_CATALOG, DEFAULT_DEV_SLOTS, EMBEDDED_NOTES } from '../services/templatesData';
import { AEROGRAPH_LOGO_B64 } from '../components/ChassisBar';
import { ShiningCheckbox } from '../components/inputs';

interface BinderViewProps {
  initialSlots?: Record<string, SlotConfig>;
  availableTemplates?: TemplateMetadata[];
  customTemplates?: TemplateMetadata[];
  customStamps?: QuickStamp[];
}

const DEFAULT_STAMPS: QuickStamp[] = [
  { id: 'bingo', label: 'BINGO 2500', template: 'BINGO FUEL: {red: 2500 LBS} // JOKER: {yellow: 3200 LBS}' },
  { id: 'laser', label: 'LASER 1688', template: 'PRIMARY LASER PRF: {green: 1688}' },
  { id: 'ramrod', label: 'RAMROD', template: 'RAMROD CODE: {blue: CHARLIE}' },
  { id: 'roe', label: 'ROE 25NM', template: 'ROE: Weapons Free beyond {green: 25NM} from Bullseye' },
  { id: 'threat', label: 'SAM THREAT', template: 'WARNING: {highlight: Active SA-10 Grumble} tracking near STPT' },
  { id: 'ip_vector', label: 'IP VECTOR', template: 'TGT IP: Bearing {blue: 045} / Distance {blue: 12NM} / Pullup 18,000 FT' },
];

export const BinderView: React.FC<BinderViewProps> = ({
  initialSlots,
  availableTemplates = AVAILABLE_TEMPLATES_CATALOG,
  customTemplates: initialCustomTemplates = [],
  customStamps: initialCustomStamps = [],
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

  // Interactive Ctrl + Mouse Wheel Zoom on Kneeboards
  useEffect(() => {
    const handleLeftWheel = (e: WheelEvent) => {
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
  }, [leftFitScale, rightFitScale]);

  // Template Library Popover State & Categorization
  const [libraryOpenFor, setLibraryOpenFor] = useState<'left' | 'right' | null>(null);
  const [libraryCategory, setLibraryCategory] = useState<'all' | 'notes' | 'checklist' | 'chart'>('all');
  const [librarySearch, setLibrarySearch] = useState('');

  // Cache for template texts loaded from disk / fallback
  const [templateContentCache, setTemplateContentCache] = useState<Record<string, string>>(EMBEDDED_NOTES);

  // Commit to Cockpit Pipeline State
  const [commitState, setCommitState] = useState<'idle' | 'committing' | 'success'>('idle');
  const [regenState, setRegenState] = useState<'idle' | 'running'>('idle');

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
  const [newStampLabel, setNewStampLabel] = useState('');
  const [newStampTemplate, setNewStampTemplate] = useState('');

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

  // Sync initialSlots when passed from parent
  useEffect(() => {
    if (initialSlots && Object.keys(initialSlots).length > 0) {
      setSlots(initialSlots);
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
        if (newTemplateModalOpen) setNewTemplateModalOpen(false);
        if (editStampDropdownOpen) setEditStampDropdownOpen(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [radialOpenFor, libraryOpenFor, settingsSlotKey, stampsModalOpen, newTemplateModalOpen, editStampDropdownOpen]);

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

  // Maps a slot to a high-res pre-rendered PNG if available
  const getSlotImagePath = (slotKey: string, slot: SlotConfig): string | null => {
    if (slot.type === 'briefing_roster') return '/images/page_1.png';
    if (slot.type === 'briefing_steerpoints') return '/images/page_2.png';
    if (slot.type === 'mission_route') return '/images/mission_route.png';
    if (slot.type === 'mission_target') return '/images/mission_target.png';
    if (slot.type === 'dep_taxi') return '/images/dep_gnd.png';
    if (slot.type === 'arr_taxi') return '/images/arr_gnd.png';
    if (slot.type === 'arr_ils_primary') return '/images/arr_ils.png';
    if (slot.type === 'arr_ils_secondary') return '/images/arr_ils_sec.png';
    if (slot.type === 'custom_html') {
      if (slot.path?.includes('checklist-1')) return '/images/checklist-1.png';
      if (slot.path?.includes('checklist-2')) return '/images/checklist-2.png';
      if (slot.path?.includes('checklist-3')) return '/images/checklist-3.png';
      if (slot.path?.includes('checklist-4')) return '/images/checklist-4.png';
      if (slot.path?.includes('checklist-5')) return '/images/checklist-5.png';
      if (slot.path?.includes('threats-air')) return '/images/threats-air.png';
      if (slot.path?.includes('threats-gnd')) return '/images/threats-gnd.png';
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

  // Revert slot to default profile state
  const handleRevertSlot = (side: 'left' | 'right') => {
    Sound.playSwitch();
    const slotKey = side === 'left' ? leftKey : rightKey;
    const def = DEFAULT_DEV_SLOTS[slotKey];
    if (def) {
      setSlots((prev) => ({ ...prev, [slotKey]: def }));
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

  // Authentic Blank Aeronautical Card HTML (Matching blank_html.rs)
  const generateBlankCardHtml = (title: string, reason: string): string => {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background-color: #FAFAF8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
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
    font-weight: 900;
    padding: 10px 24px;
    border-radius: 8px;
    margin: 0 auto 30px auto;
    display: inline-block;
    text-align: center;
  }
  .main-title {
    font-size: 48px;
    font-weight: 900;
    color: #263238;
    margin-bottom: 25px;
    text-align: center;
    text-transform: uppercase;
  }
  .rule {
    width: 320px;
    height: 4px;
    background: #B0BEC5;
    margin: 0 auto 30px auto;
  }
  .reason {
    font-size: 26px;
    font-weight: 700;
    color: #546E7A;
    line-height: 1.4;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
<div class="outer-card">
  <div class="badge">AERONAUTICAL KNEEBOARD</div>
  <div class="main-title">${title}</div>
  <div class="rule"></div>
  <div class="reason">${reason}</div>
</div>
</body>
</html>`;
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

    const isBriefing = slot.type.startsWith('briefing_');
    const isCustomHtml = slot.type === 'custom_html' || slot.path?.endsWith('.html');
    const headerCode = slot.header_code || 'T.O. 1F-16CM-1 // FLIGHT-OPS';
    const notchClass = isLeft ? 'notch-left' : 'notch-right';
    const title = slot.title || (isLeft ? 'LEFT KNEEBOARD' : 'RIGHT KNEEBOARD');
    const rawContent = getSlotDisplayContent(slot);

    // 2. Custom HTML Checklists
    if (isCustomHtml) {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { background: white; font-family: -apple-system, sans-serif; margin: 0; padding: 24px; color: #111; }
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
th.title { background: #FFFF44; color: #222222; font-weight: 900; font-size: 16px; text-transform: uppercase; padding: 8px 12px; text-align: left; border: 1px solid #CCCC00; }
tr.odd { background: #F8F8F8; }
tr.even { background: #EEEEEE; }
td { padding: 6px 12px; font-weight: 600; border-bottom: 1px solid #DDDDDD; }
td.half { width: 50%; }
td.rightalign { text-align: right; font-weight: 800; color: #0D47A1; }
.footer { position: fixed; bottom: 12px; left: 24px; right: 24px; border-top: 2px solid #90A4AE; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 11px; color: #546E7A; }
.page-badge { background: #263238; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold; }
</style>
</head>
<body>
<div class="page">
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
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background-color: #FAFAF8; font-family: -apple-system, sans-serif; color: #1A1A1A; width: 1024px; height: 1554px; position: relative; overflow: hidden; }
.top-banner { position: absolute; top: 0; left: 0; width: 1024px; height: 130px; overflow: hidden; background: #0D47A1; }
.header-notch { position: absolute; bottom: 0px; background-color: #FAFAF8; z-index: 10; font-weight: 900; font-size: 22px; padding: 6px 26px; color: #0D47A1; }
.notch-left { left: 48px; }
.notch-right { right: 48px; }
.content-container { position: absolute; top: 130px; left: 0; width: 1024px; height: 1344px; padding: 32px 54px; }
.main-title { font-size: 38px; font-weight: 900; font-style: italic; color: #111; margin-bottom: 6px; text-transform: uppercase; }
.subtitle { font-size: 18px; font-weight: 800; color: #546E7A; margin-bottom: 20px; border-bottom: 2px solid #CFD8DC; padding-bottom: 6px; }
.lock-banner { background: #ECEFF1; border-left: 6px solid #455A64; padding: 8px 14px; font-family: monospace; font-size: 13px; color: #37474F; margin-bottom: 20px; font-weight: bold; }
.footer-table { position: absolute; bottom: 24px; left: 54px; width: 916px; border-top: 2.5px solid #90A4AE; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; font-family: monospace; font-size: 13px; color: #455A64; }
.footer-page-badge { background: #263238; color: white; font-weight: 900; padding: 4px 14px; border-radius: 4px; }
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
    const displayPageNum = slot.page_num || pageNum;
    const subtitle = slot.subtitle || 'PILOT FLIGHT NOTES // T.O. 1F-16CM-1';

    const parseInline = (text: string): string => {
      return text.replace(/\{([a-zA-Z0-9#-]+):\s*([^}]+)\}/g, (_, tag, content) => {
        const t = tag.toLowerCase();
        switch (t) {
          case 'red': return `<span style="color:#D32F2F;font-weight:bold;">${content}</span>`;
          case 'yellow': return `<span style="color:#F57F17;font-weight:bold;">${content}</span>`;
          case 'green': return `<span style="color:#2E7D32;font-weight:bold;">${content}</span>`;
          case 'blue': return `<span style="color:#1565C0;font-weight:bold;">${content}</span>`;
          case 'orange': return `<span style="color:#E65100;font-weight:bold;">${content}</span>`;
          case 'cyan': return `<span style="color:#00838F;font-weight:bold;">${content}</span>`;
          case 'white': return `<span style="color:#FFFFFF;background-color:#263238;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'highlight':
          case 'bg-yellow': return `<span style="background-color:#FFF59D;color:#111111;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-red': return `<span style="background-color:#FFCDD2;color:#B71C1C;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-green': return `<span style="background-color:#C8E6C9;color:#1B5E20;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          case 'bg-blue': return `<span style="background-color:#BBDEFB;color:#0D47A1;padding:1px 6px;border-radius:3px;font-weight:bold;">${content}</span>`;
          default:
            if (t.startsWith('#')) return `<span style="color:${t};font-weight:bold;">${content}</span>`;
            return `{${tag}: ${content}}`;
        }
      });
    };

    let bodyFormatted = '';
    const lines = rawContent.split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t) {
        bodyFormatted += '<div style="height:12px;"></div>';
      } else if (t.startsWith('# ')) {
        bodyFormatted += `<div style="font-size:26px; font-weight:900; color:${headerTextColor}; background:#ECEFF1; border-left:6px solid ${headerTextColor}; padding:8px 14px; margin:14px 0 8px 0; text-transform:uppercase;">${parseInline(t.substring(2))}</div>`;
      } else if (t.startsWith('## ')) {
        bodyFormatted += `<div style="font-size:22px; font-weight:900; color:#263238; border-bottom:2px solid #90A4AE; padding-bottom:4px; margin:14px 0 6px 0; text-transform:uppercase;">${parseInline(t.substring(3))}</div>`;
      } else if (t.toUpperCase().startsWith('WARNING:')) {
        bodyFormatted += `<div style="background:#FFEBEE; border:2px solid #C62828; border-radius:6px; padding:10px 14px; margin:10px 0; display:flex; align-items:center; font-size:18px; font-weight:700; color:#B71C1C;"><span style="background:#C62828; color:white; font-size:13px; font-weight:900; padding:3px 8px; border-radius:4px; margin-right:12px;">WARNING</span>${parseInline(t.substring(8))}</div>`;
      } else if (t.toUpperCase().startsWith('CAUTION:')) {
        bodyFormatted += `<div style="background:#FFF8E1; border:2px solid #F57F17; border-radius:6px; padding:10px 14px; margin:10px 0; display:flex; align-items:center; font-size:18px; font-weight:700; color:#E65100;"><span style="background:#F57F17; color:white; font-size:13px; font-weight:900; padding:3px 8px; border-radius:4px; margin-right:12px;">CAUTION</span>${parseInline(t.substring(8))}</div>`;
      } else if (t.startsWith('- [ ]') || t.startsWith('[ ]') || t.startsWith('- [x]') || t.startsWith('[x]')) {
        const isChecked = t.toLowerCase().includes('[x]');
        const text = t.replace(/^(\- )?\[[ xX]\]\s*/, '');
        bodyFormatted += `<div style="display:flex; align-items:center; font-size:18px; font-weight:600; color:#263238; margin:6px 0;"><div style="width:20px; height:20px; border:2px solid #455A64; border-radius:3px; margin-right:12px; background:${isChecked ? '#263238' : 'white'}; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:14px;">${isChecked ? '✓' : ''}</div>${parseInline(text)}</div>`;
      } else if (t.startsWith('- ') || t.startsWith('* ')) {
        bodyFormatted += `<div style="font-size:19px; font-weight:600; color:#212121; margin:4px 0 4px 18px;">&bull; ${parseInline(t.substring(2))}</div>`;
      }
      // Special Meaning for ":" Key-Value Badge Rows (Matching notes_html.rs lines 190-219 & 595-621)
      else if (t.includes(':') && !t.toUpperCase().startsWith('WARNING:') && !t.toUpperCase().startsWith('CAUTION:')) {
        const colonIdx = t.indexOf(':');
        const key = t.substring(0, colonIdx).trim();
        const val = t.substring(colonIdx + 1).trim();
        if (key.length > 0 && key.length <= 28 && val.length > 0 && /^[\w\s\/\-_]+$/.test(key)) {
          bodyFormatted += `<table style="width:100%; background:#ECEFF1; border-radius:6px; margin:6px 0; border-collapse:separate;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 16px; font-weight:900; font-size:22px; color:#37474F; text-align:left; text-transform:uppercase; vertical-align:middle;">${parseInline(key)}</td>
              <td style="padding:8px 16px; font-weight:900; font-size:22px; color:#0D47A1; text-align:right; font-family:'Lucida Console',Consolas,monospace; letter-spacing:0.5px; vertical-align:middle;">${parseInline(val)}</td>
            </tr>
          </table>`;
        } else {
          bodyFormatted += `<div style="font-size:18px; line-height:1.45; color:#263238; font-weight:500; margin:4px 0;">${parseInline(t)}</div>`;
        }
      } else {
        bodyFormatted += `<div style="font-size:18px; line-height:1.45; color:#263238; font-weight:500; margin:4px 0;">${parseInline(t)}</div>`;
      }
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

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background-color: #FAFAF8; font-family: -apple-system, sans-serif; color: #1A1A1A; width: 1024px; height: 1554px; position: relative; overflow: hidden; }
.top-banner { position: absolute; top: 0; left: 0; width: 1024px; height: 130px; overflow: hidden; background: #ECEFF1; }
.header-notch { position: absolute; bottom: 0px; background-color: #FAFAF8; z-index: 10; font-weight: 900; font-size: 22px; padding: 6px 26px; color: ${headerTextColor}; }
.notch-left { left: 48px; }
.notch-right { right: 48px; }
.content-container { position: absolute; top: 130px; left: 0; width: 1024px; height: 1344px; padding: 32px 54px; }
.main-title { font-size: 38px; font-weight: 900; font-style: italic; color: #111; margin-bottom: 6px; text-transform: uppercase; }
.subtitle { font-size: 18px; font-weight: 800; color: #546E7A; margin-bottom: 20px; border-bottom: 2px solid #CFD8DC; padding-bottom: 6px; }
.footer-table { position: absolute; bottom: 24px; left: 54px; width: 916px; border-top: 2.5px solid #90A4AE; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; font-family: monospace; font-size: 13px; color: #455A64; }
.footer-page-badge { background: #263238; color: white; font-weight: 900; padding: 4px 14px; border-radius: 4px; }
</style>
</head>
<body>
<div class="top-banner">
  ${bannerSvg}
  <div class="header-notch ${notchClass}">${headerCode}</div>
</div>
<div class="content-container">
  <div class="main-title">${title}</div>
  <div class="subtitle">${subtitle}</div>
  ${bodyFormatted}
</div>
<div class="footer-table">
  <div><img src="data:image/png;base64,${AEROGRAPH_LOGO_B64}" width="22" height="22" style="vertical-align:middle;margin-right:8px;" /><strong>AEROGRAPH</strong> // TACTICAL KNEEBOARDS</div>
  <div>* COCKPIT CERTIFIED FLIGHT NOTES</div>
  <div class="footer-page-badge">${displayPageNum}</div>
</div>
</body>
</html>`;
  };

  const leftImgSrc = getSlotImagePath(leftKey, leftSlot);
  const rightImgSrc = getSlotImagePath(rightKey, rightSlot);

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
                  <textarea
                    ref={leftTextareaRef}
                    value={getSlotDisplayContent(leftSlot)}
                    onChange={(e) => handleUpdateSlotContent('left', e.target.value)}
                    className="flex-1 w-full bg-[#18181B] border border-white/[0.08] rounded p-3 text-zinc-200 font-mono text-xs focus:outline-none focus:border-accent resize-none leading-relaxed"
                    placeholder="Enter pilot notes, check items, or flight protocols in markdown..."
                  />
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Syntax: # Heading &bull; ## Subheading &bull; KEY: VALUE &bull; WARNING: / CAUTION:</span>
                    <span>Staged in-memory</span>
                  </div>
                </div>
              ) : (
                <div className="w-fit min-w-full min-h-full flex items-start justify-start">
                  {leftImgSrc ? (
                    /* High-Resolution Pre-Rendered Flight Chart Surface */
                    <div
                      className="bg-[#18181B] rounded shadow-2xl overflow-hidden relative border border-white/[0.06] m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeLeftScale)}px`,
                        height: `${Math.round(1554 * activeLeftScale)}px`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={leftImgSrc}
                        alt={`Slot ${leftSlotIndex}L Chart`}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
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
                  <textarea
                    ref={rightTextareaRef}
                    value={getSlotDisplayContent(rightSlot)}
                    onChange={(e) => handleUpdateSlotContent('right', e.target.value)}
                    className="flex-1 w-full bg-[#18181B] border border-white/[0.08] rounded p-3 text-zinc-200 font-mono text-xs focus:outline-none focus:border-accent resize-none leading-relaxed"
                    placeholder="Enter pilot notes, check items, or flight protocols in markdown..."
                  />
                  <div className="text-[10px] text-zinc-500 flex justify-between">
                    <span>Syntax: # Heading &bull; ## Subheading &bull; KEY: VALUE &bull; WARNING: / CAUTION:</span>
                    <span>Staged in-memory</span>
                  </div>
                </div>
              ) : (
                <div className="w-fit min-w-full min-h-full flex items-start justify-start">
                  {rightImgSrc ? (
                    /* High-Resolution Pre-Rendered Flight Chart Surface */
                    <div
                      className="bg-[#18181B] rounded shadow-2xl overflow-hidden relative border border-white/[0.06] m-auto shrink-0"
                      style={{
                        width: `${Math.round(1024 * activeRightScale)}px`,
                        height: `${Math.round(1554 * activeRightScale)}px`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={rightImgSrc}
                        alt={`Slot ${rightSlotIndex}R Chart`}
                        className="w-full h-full object-contain pointer-events-none select-none"
                      />
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
