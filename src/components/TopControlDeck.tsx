import React from 'react';
import type { MascotDomain } from '../types/mascot';
import type { OutbreakPreset } from '../engine/presets';
import { DOMAIN_LIST, DOMAIN_META, formatTraitLabel, type MapColorMode } from '../utils/theme';

export interface AvailableTraitOption {
  trait: string;
  count: number;
  domain: MascotDomain;
  family: string;
}

interface TopControlDeckProps {
  presets: OutbreakPreset[];
  activePresetId: string | null;
  onSelectPreset: (preset: OutbreakPreset) => void;
  domain: MascotDomain | 'ALL';
  onChangeDomain: (domain: MascotDomain | 'ALL') => void;
  primaryTrait: string | 'ALL';
  onChangePrimaryTrait: (trait: string | 'ALL') => void;
  availableTraits: AvailableTraitOption[];
  windowYears: number;
  onChangeWindowYears: (years: number) => void;
  confirmedDebutOnly: boolean;
  onChangeConfirmedDebutOnly: (confirmedOnly: boolean) => void;
  showArcs: boolean;
  onChangeShowArcs: (show: boolean) => void;
  showMutations: boolean;
  onChangeShowMutations: (show: boolean) => void;
  colorMode: MapColorMode;
  onChangeColorMode: (mode: MapColorMode) => void;
}

export const TopControlDeck: React.FC<TopControlDeckProps> = ({
  presets,
  activePresetId,
  onSelectPreset,
  domain,
  onChangeDomain,
  primaryTrait,
  onChangePrimaryTrait,
  availableTraits,
  windowYears,
  onChangeWindowYears,
  confirmedDebutOnly,
  onChangeConfirmedDebutOnly,
  showArcs,
  onChangeShowArcs,
  showMutations,
  onChangeShowMutations,
  colorMode,
  onChangeColorMode,
}) => {
  const activePreset = presets.find((p) => p.id === activePresetId);

  return (
    <header className="bg-white border-b-2 border-[#172038] shadow-[0_3px_0_rgba(23,32,56,0.12)] z-20 shrink-0">
      <div className="max-w-[1680px] mx-auto px-3 sm:px-4 pt-2.5 pb-2.5 flex flex-col gap-2">
        {/* Row 1: Brand Identity + Story Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <a
              href="https://frimer-rasmussen.dk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Frimer-Rasmussen Consulting"
              className="group inline-flex items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-[#172038] focus-visible:outline-offset-2"
            >
              <img
                src="./frc-logo.png"
                alt="Frimer-Rasmussen Consulting"
                className="w-10 h-10 object-contain shrink-0 transition-transform duration-150 group-hover:scale-105"
              />
            </a>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#172038] leading-none">
                  Yuru-Dex
                </h1>
                <a
                  href="https://frimer-rasmussen.dk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#3D6B14] hover:text-[#172038] hover:underline underline-offset-2 transition-[color] duration-150"
                >
                  by Frimer-Rasmussen Consulting
                </a>
              </div>
              <p className="text-xs font-medium text-[#4B556B] mt-0.5 leading-tight">
                Japan Mascot Outbreak Atlas
                {activePreset ? (
                  <span className="hidden xl:inline text-[#172038]"> · {activePreset.tagline}</span>
                ) : null}
              </p>
            </div>
          </div>

          {/* Connected Segmented Story Presets */}
          <div
            role="radiogroup"
            aria-label="Outbreak story presets"
            className="flex flex-wrap items-center rounded-xl border-2 border-[#172038] bg-[#F7F4EA] p-0.5 shadow-[2px_2px_0_#172038]"
          >
            {presets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  title={preset.tagline}
                  onClick={() => onSelectPreset(preset)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-[background-color,color,box-shadow] duration-150 cursor-pointer ${
                    isSelected
                      ? 'bg-[#E3350D] text-white shadow-[inset_0_-2px_0_rgba(23,32,56,0.28)]'
                      : 'text-[#172038] hover:bg-[#FFCB05]/45'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Interactive Controls Deck */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1.5 border-t border-[#172038]/15 text-xs">
          {/* Domain & Trait Selects: 2-col side-by-side grid on mobile (<sm), inline flex on sm+ */}
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
            {/* Domain Select */}
            <div className="flex items-center gap-1.5 min-w-0">
              <label htmlFor="yuru-domain-select" className="font-semibold text-[#172038] shrink-0">
                Domain
              </label>
              <select
                id="yuru-domain-select"
                value={domain}
                onChange={(e) => onChangeDomain(e.target.value as MascotDomain | 'ALL')}
                className="h-8 flex-1 min-w-0 sm:flex-none rounded-lg border-2 border-[#172038] bg-[#F7F4EA] px-2 font-semibold text-[#172038] cursor-pointer hover:bg-white transition-[background-color] duration-150"
              >
                <option value="ALL">All Domains</option>
                {DOMAIN_LIST.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_META[d].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Specific Trait Select */}
            <div className="flex items-center gap-1.5 min-w-0">
              <label htmlFor="yuru-trait-select" className="font-semibold text-[#172038] shrink-0">
                Trait
              </label>
              <select
                id="yuru-trait-select"
                value={primaryTrait}
                onChange={(e) => onChangePrimaryTrait(e.target.value)}
                className="h-8 flex-1 min-w-0 sm:flex-none sm:min-w-[138px] rounded-lg border-2 border-[#172038] bg-[#F7F4EA] px-2 font-semibold text-[#172038] cursor-pointer hover:bg-white transition-[background-color] duration-150"
              >
                <option value="ALL">All Traits</option>
                {availableTraits.map((item) => (
                  <option key={item.trait} value={item.trait}>
                    {formatTraitLabel(item.trait)} ({item.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transmission Window Native Slider */}
          <div className="flex items-center gap-2 bg-[#F7F4EA] border-2 border-[#172038] rounded-lg px-2.5 h-8">
            <label htmlFor="yuru-window-slider" className="font-semibold text-[#172038] whitespace-nowrap">
              Window
            </label>
            <input
              id="yuru-window-slider"
              type="range"
              min={1}
              max={10}
              step={1}
              value={windowYears}
              onChange={(e) => onChangeWindowYears(Number(e.target.value))}
              style={
                {
                  '--attr-min': 1,
                  '--attr-max': 10,
                  '--control-value': windowYears,
                } as React.CSSProperties
              }
              className="yuru-range yuru-range-blue w-20 sm:w-24"
              aria-valuetext={`${windowYears} ${windowYears === 1 ? 'year' : 'years'}`}
            />
            <span className="font-bold text-[#246BCE] tabular-nums min-w-[34px] text-right">
              {windowYears} {windowYears === 1 ? 'yr' : 'yrs'}
            </span>
          </div>

          {/* Data Quality Toggle */}
          <div
            role="group"
            aria-label="Data quality filter"
            className="flex items-center rounded-lg border-2 border-[#172038] bg-[#F7F4EA] p-0.5"
          >
            <button
              type="button"
              aria-pressed={!confirmedDebutOnly}
              onClick={() => onChangeConfirmedDebutOnly(false)}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-[background-color,color] duration-150 ${
                !confirmedDebutOnly ? 'bg-[#172038] text-white' : 'text-[#172038] hover:bg-white/70'
              }`}
            >
              All records
            </button>
            <button
              type="button"
              aria-pressed={confirmedDebutOnly}
              onClick={() => onChangeConfirmedDebutOnly(true)}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-[background-color,color] duration-150 ${
                confirmedDebutOnly ? 'bg-[#172038] text-white' : 'text-[#172038] hover:bg-white/70'
              }`}
            >
              Confirmed debuts
            </button>
          </div>

          {/* Color-by Toggle */}
          <div
            role="group"
            aria-label="Map color mode"
            className="flex items-center rounded-lg border-2 border-[#172038] bg-[#F7F4EA] p-0.5"
          >
            <button
              type="button"
              aria-pressed={colorMode === 'mutation'}
              onClick={() => onChangeColorMode('mutation')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-[background-color,color] duration-150 ${
                colorMode === 'mutation' ? 'bg-[#246BCE] text-white' : 'text-[#172038] hover:bg-white/70'
              }`}
            >
              Mutation type
            </button>
            <button
              type="button"
              aria-pressed={colorMode === 'generation'}
              onClick={() => onChangeColorMode('generation')}
              className={`px-2 py-1 rounded-md font-semibold cursor-pointer transition-[background-color,color] duration-150 ${
                colorMode === 'generation' ? 'bg-[#246BCE] text-white' : 'text-[#172038] hover:bg-white/70'
              }`}
            >
              Generation
            </button>
          </div>

          {/* Visual Overlays Checkboxes */}
          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-1.5 font-semibold text-[#172038] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArcs}
                onChange={(e) => onChangeShowArcs(e.target.checked)}
                className="w-4 h-4 accent-[#E3350D] rounded cursor-pointer"
              />
              <span>Transmission arcs</span>
            </label>
            <label
              className={`flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
                showArcs ? 'text-[#172038]' : 'text-[#4B556B] opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={showMutations}
                disabled={!showArcs}
                onChange={(e) => onChangeShowMutations(e.target.checked)}
                className="w-4 h-4 accent-[#7C3AED] rounded cursor-pointer disabled:cursor-not-allowed"
              />
              <span>Mutations</span>
            </label>
          </div>
        </div>
      </div>
    </header>
  );
};
