'use client';

import React from 'react';
import { Mic, CheckCircle2, Search, ChevronDown } from 'lucide-react';
import { Sound } from '../../services/sound';
import { ProfileCategoryView } from '../../types/ipc';

interface TacticalBrevityViewProps {
  categories: ProfileCategoryView[];
  selectedCategoryName: string;
  onSelectCategory: (name: string) => void;
  searchFilter: string;
  onSearchChange: (value: string) => void;
  isPrefixExpanded: boolean;
  onTogglePrefix: () => void;
  lastSpeech: {
    phrase: string;
    confidence: number;
    status: 'VERIFIED' | 'DENIED' | 'PTT_GATED' | 'GROUP_INACTIVE' | 'STANDBY';
    command?: string;
    group?: string;
  };
}

export const TacticalBrevityView: React.FC<TacticalBrevityViewProps> = ({
  categories,
  selectedCategoryName,
  onSelectCategory,
  searchFilter,
  onSearchChange,
  isPrefixExpanded,
  onTogglePrefix,
  lastSpeech,
}) => {
  const activeCategory =
    categories.find((c) => c.name === selectedCategoryName) || categories[0];

  const filteredCommands = React.useMemo(() => {
    if (!activeCategory || !activeCategory.commands) return [];
    if (!searchFilter.trim()) return activeCategory.commands;
    const q = searchFilter.toLowerCase();
    return activeCategory.commands.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.spoken_phrases.some((p) => p.toLowerCase().includes(q))
    );
  }, [activeCategory, searchFilter]);

  // Auto-scroll to matching command card when verified voice recognition arrives
  React.useEffect(() => {
    if (lastSpeech.status !== 'VERIFIED' || !lastSpeech.phrase) return;

    // Disambiguate by group: if lastSpeech.group is specified, ensure it belongs to this category
    if (lastSpeech.group && lastSpeech.group !== 'System' && lastSpeech.group !== 'Command') {
      const gUpper = lastSpeech.group.trim().toUpperCase();
      const catUpper = activeCategory?.name ? activeCategory.name.trim().toUpperCase() : '';
      if (!catUpper) return;
      const isGroupMatch = catUpper === gUpper || catUpper.includes(gUpper) || gUpper.includes(catUpper);
      if (!isGroupMatch) return;
    }

    const normPhrase = lastSpeech.phrase.toUpperCase();
    const normCmd = lastSpeech.command?.toLowerCase();

    const matched = filteredCommands.find(
      (c) =>
        (normCmd && c.name.toLowerCase() === normCmd) ||
        c.name.toUpperCase() === normPhrase ||
        c.spoken_phrases.some((p) => p.toUpperCase() === normPhrase)
    );

    if (matched && activeCategory?.name) {
      const safeId = `brevity-cmd-${activeCategory.name.replace(/[^a-zA-Z0-9_-]/g, '_')}--${matched.name.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      const el = document.getElementById(safeId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [lastSpeech, filteredCommands, activeCategory?.name]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Category Selector Pill Bar (with enabled status dot) */}
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-800 pb-3">
        {categories.map((cat, catIdx) => (
          <button
            key={`${cat.name}-${catIdx}`}
            onClick={() => {
              Sound.playClick();
              onSelectCategory(cat.name);
            }}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold transition-[background-color,border-color] flex items-center gap-1.5 border cursor-pointer ${
              selectedCategoryName === cat.name
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <span>{cat.name}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                cat.is_enabled ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
          </button>
        ))}
      </div>

      {/* Category Header with Search & Clickable Prefix Strip */}
      {activeCategory && (
        <div className="space-y-2 font-mono">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-zinc-100 uppercase tracking-wide">
                {activeCategory.name}
              </h2>
              <span className="text-xs text-zinc-500">
                {activeCategory.commands.length} Commands Available //{' '}
                {activeCategory.is_enabled ? 'Active in Profile' : 'Disabled in Profile'}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative w-80">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search ${activeCategory.name} phrases...`}
                className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-emerald-500 text-xs text-zinc-200 rounded outline-none placeholder:text-zinc-600 transition-[border-color]"
              />
            </div>
          </div>

          {/* Entire Strip is Clickable to Toggle Prefixes */}
          {activeCategory.prefix_phrases.length > 0 && (
            <div
              onClick={onTogglePrefix}
              className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800 text-xs cursor-pointer hover:bg-zinc-900/90 transition-[background-color]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 font-bold uppercase text-[11px]">
                    CATEGORY PREFIXES:
                  </span>
                  <span className="px-2 py-0.5 bg-zinc-800 text-cyan-400 rounded text-[11px] font-bold">
                    {activeCategory.prefix_phrases.length} Variants
                  </span>
                </div>

                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <span>{isPrefixExpanded ? 'Collapse' : 'Show All'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-[transform] duration-150 ${
                      isPrefixExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </div>

              {isPrefixExpanded && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2.5 pt-2 border-t border-zinc-800 flex flex-wrap gap-1.5"
                >
                  {activeCategory.prefix_phrases.map((prefix, idx) => (
                    <span
                      key={`${prefix}-${idx}`}
                      className="px-2 py-0.5 bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 rounded text-[11px]"
                    >
                      {`"${prefix}"`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Commands Grid (All commands shown directly without 6-limit pagination) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 font-mono">
        {filteredCommands.map((cmd, idx) => {
          const catName = activeCategory?.name || 'category';
          // Disambiguate matching: ensure the speech group matches this category if group is present
          const isGroupMatch =
            !lastSpeech.group ||
            lastSpeech.group === 'System' ||
            lastSpeech.group === 'Command' ||
            catName.toLowerCase() === lastSpeech.group.toLowerCase() ||
            catName.toLowerCase().includes(lastSpeech.group.toLowerCase()) ||
            lastSpeech.group.toLowerCase().includes(catName.toLowerCase());

          const isMatchingVoice =
            isGroupMatch &&
            lastSpeech.status === 'VERIFIED' &&
            (lastSpeech.command?.toLowerCase() === cmd.name.toLowerCase() ||
              lastSpeech.phrase === cmd.name.toUpperCase() ||
              cmd.spoken_phrases.some((p) => p.toUpperCase() === lastSpeech.phrase));

          const safeId = `brevity-cmd-${catName.replace(/[^a-zA-Z0-9_-]/g, '_')}--${cmd.name.replace(/[^a-zA-Z0-9_-]/g, '_')}--${idx}`;

          return (
            <div
              key={`${cmd.name}-${cmd.key_combination || ''}-${idx}`}
              id={safeId}
              className={`p-3.5 rounded border transition-[border-color,background-color] flex flex-col justify-between gap-3 shadow-sm ${
                isMatchingVoice
                  ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                  : 'bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-zinc-100 truncate">
                    {cmd.name}
                  </span>
                  {cmd.key_combination && (
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[10px] shrink-0">
                      {cmd.key_combination}
                    </span>
                  )}
                </div>

                {/* Spoken Phrases Chips */}
                <div className="mt-2.5 space-y-1.5">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold">
                    SPOKEN CALLOUT PHRASES:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cmd.spoken_phrases.length > 0 ? (
                      cmd.spoken_phrases.map((phrase, pIdx) => (
                        <span
                          key={`${phrase}-${pIdx}`}
                          className={`px-2 py-0.5 rounded text-[11px] border ${
                            lastSpeech.phrase === phrase.toUpperCase()
                              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400 font-bold'
                              : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/60'
                          }`}
                        >
                          {`"${phrase}"`}
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] border bg-zinc-800/80 text-zinc-400 border-zinc-700/60">
                        {`"${cmd.name}"`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer: Live Practice Status */}
              <div className="pt-2 border-t border-zinc-800/70 flex items-center justify-between text-[11px] text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <Mic className="w-3 h-3 text-zinc-400" />
                  <span>Voice ready</span>
                </div>
                {isMatchingVoice && (
                  <span className="text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5" /> ACKNOWLEDGED
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
