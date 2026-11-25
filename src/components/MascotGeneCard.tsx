import React from 'react';
import { ArrowDownRight, ArrowUpLeft, Compass, Sparkles } from 'lucide-react';
import type { ComputedMascotNode, JapanGeoJSON } from '../types/mascot';
import {
  DOMAIN_META,
  formatDnaCombo,
  formatTraitLabel,
  getContagiousnessTier,
  MUTATION_META,
  resolveSafeColor,
} from '../utils/theme';
import { PrefectureSilhouette } from './PrefectureSilhouette';
import { DomainOrbIcon, TraitIcon } from './TraitIcons';

interface MascotGeneCardProps {
  selectedNode: ComputedMascotNode | null;
  prefectureNodes: ComputedMascotNode[];
  nodesById: Record<string, ComputedMascotNode>;
  geojson: JapanGeoJSON;
  selectedJisCode: string | null;
  currentYear: number;
  windowYears: number;
  superSpreaderNode: ComputedMascotNode | null;
  onSelectMascot: (mascotId: string) => void;
}

function describeChildMutation(parent: ComputedMascotNode, child: ComputedMascotNode): string {
  const pTrait = formatTraitLabel(parent.mascot.dna.primary_trait);
  const cTrait = formatTraitLabel(child.mascot.dna.primary_trait);
  if (child.mutationType === 'mutation') {
    return `Mutation: ${pTrait} → ${cTrait}`;
  }
  if (child.mutationType === 'hybrid') {
    return `Hybrid: ${formatDnaCombo(
      child.mascot.dna.primary_trait,
      child.mascot.dna.secondary_traits
    )}`;
  }
  return `Pure copy: ${cTrait}`;
}

export const MascotGeneCard: React.FC<MascotGeneCardProps> = ({
  selectedNode,
  prefectureNodes,
  nodesById,
  geojson,
  selectedJisCode,
  currentYear,
  windowYears,
  superSpreaderNode,
  onSelectMascot,
}) => {
  const selectedFeature = selectedJisCode
    ? geojson.features.find((f) => f.properties.jis_code === selectedJisCode)
    : selectedNode
      ? geojson.features.find((f) => f.properties.jis_code === selectedNode.mascot.jis_code)
      : undefined;

  // Empty state if clicking an uninfected prefecture or no active mascots in current year
  if (!selectedNode) {
    const prefName = selectedFeature?.properties.name_en ?? 'Japan';
    return (
      <aside
        aria-label="Mascot Gene Card"
        className="w-full shrink-0 rounded-2xl ink-panel p-4 flex flex-col justify-between overflow-y-auto yuru-scroll"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#172038]">{prefName}</h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#E4E0D3] border border-[#172038] text-[#172038] tabular-nums">
              {currentYear}
            </span>
          </div>

          <div className="rounded-xl border-2 border-dashed border-[#172038]/35 bg-[#F7F4EA] p-4 flex flex-col items-center text-center gap-3">
            <PrefectureSilhouette
              feature={selectedFeature}
              primaryColor="#CBD5E1"
              accentColor="#94A3B8"
              prefectureName={prefName}
              width={180}
              height={116}
            />
            <div>
              <p className="font-display text-base font-bold text-[#172038]">
                No Active Outbreak Yet
              </p>
              <p className="text-xs text-[#4B556B] mt-1 leading-relaxed">
                {prefName} has no matching mascots on or before {currentYear}. Scrub the timeline
                forward or click a colored prefecture on the map.
              </p>
            </div>

            {superSpreaderNode && (
              <button
                type="button"
                onClick={() => onSelectMascot(superSpreaderNode.mascot.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFCB05] text-[#172038] text-xs font-bold ink-button cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                Inspect {superSpreaderNode.mascot.name_en} ({superSpreaderNode.mascot.prefecture_en})
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  }

  const { mascot } = selectedNode;
  const domainMeta = DOMAIN_META[mascot.dna.domain];
  const mutationMeta = MUTATION_META[selectedNode.mutationType];
  const tier = getContagiousnessTier(selectedNode.rValue);
  const primaryHex = resolveSafeColor(mascot.dna.primary_color, domainMeta.color);
  const accentHex = resolveSafeColor(mascot.dna.accent_color, '#FFCB05');

  const parentNode = selectedNode.parentId ? nodesById[selectedNode.parentId] : null;
  const activeChildren = selectedNode.childrenIds
    .map((id) => nodesById[id])
    .filter((n): n is ComputedMascotNode => Boolean(n) && n.mascot.year <= currentYear)
    .sort((a, b) => a.mascot.year - b.mascot.year || (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  const feature = geojson.features.find((f) => f.properties.jis_code === mascot.jis_code);
  const secondaryTraits = mascot.dna.secondary_traits ?? [];

  return (
    <aside
      aria-label="Mascot Gene Card"
      className="w-full shrink-0 flex flex-col min-h-0 overflow-y-auto yuru-scroll pr-0.5"
    >
      {/* Multi-mascot prefecture selector strip with count & soft right-edge fade mask */}
      {prefectureNodes.length > 1 && (
        <div
          aria-label={`Active mascots in ${mascot.prefecture_en}`}
          className="mb-1.5 shrink-0 flex items-center gap-1.5"
        >
          <span className="shrink-0 text-[11px] font-bold text-[#4B556B] tabular-nums">
            {prefectureNodes.length} mascots
          </span>
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-1.5 overflow-x-auto yuru-scroll pb-1 pr-7">
              {prefectureNodes.map((node) => {
                const isCurrent = node.mascot.id === mascot.id;
                return (
                  <button
                    key={node.mascot.id}
                    type="button"
                    onClick={() => onSelectMascot(node.mascot.id)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border-2 border-[#172038] cursor-pointer transition-[background-color,color,transform] duration-150 ${
                      isCurrent
                        ? 'bg-[#FFCB05] text-[#172038] shadow-[2px_2px_0_#172038]'
                        : 'bg-white text-[#172038] hover:bg-[#F7F4EA]'
                    }`}
                  >
                    <TraitIcon trait={node.mascot.dna.primary_trait} size={15} decorative />
                    <span className="max-w-[104px] truncate">{node.mascot.name_en}</span>
                    <span className="text-[10px] opacity-75 tabular-nums">{node.mascot.year}</span>
                  </button>
                );
              })}
            </div>
            {/* Soft right-edge fade indicator so overflowing pills never look abruptly chopped */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 right-0 bottom-1 w-8 bg-gradient-to-l from-[#F7F4EA] via-[#F7F4EA]/80 to-transparent"
            />
          </div>
        </div>
      )}

      {/* Collectible Japanese Pokémon Trading Card Outer Gold Rim */}
      <article className="tcg-gold-rim rounded-2xl p-1.5 flex flex-col">
        <div className="rounded-[12px] bg-[#FFFDF7] border-2 border-[#172038] p-2.5 flex flex-col gap-2">
          {/* TCG Card Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <h2 className="font-display text-lg font-bold text-[#172038] leading-tight">
                  {mascot.name_en}
                </h2>
                {mascot.name_jp && (
                  <span lang="ja" className="text-xs font-semibold text-[#4B556B]">
                    {mascot.name_jp}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-[#4B556B] leading-tight mt-0.5">
                {mascot.prefecture_en}
                {mascot.municipality_en ? ` · ${mascot.municipality_en}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-bold border-2 border-[#172038] tabular-nums"
                style={{
                  backgroundColor:
                    selectedNode.generation === 1 ? '#DBEAFE' : '#FEF3C7',
                  color: '#172038',
                }}
              >
                {selectedNode.generation === 1 ? 'Patient Zero' : `Gen ${selectedNode.generation}`}
              </span>
              <DomainOrbIcon domain={mascot.dna.domain} size={24} />
            </div>
          </div>

          {/* Visual Center Stage: Compact Prefecture Silhouette + Vector DNA Pictograms (ZERO external images) */}
          <div
            className="tcg-stage-holo rounded-xl border-2 border-[#172038] px-2.5 py-2 flex flex-col items-center gap-1.5"
            style={{
              background: `radial-gradient(circle at 50% 42%, #FFFFFF 0%, ${primaryHex}1C 58%, ${accentHex}2C 100%)`,
            }}
          >
            <div className="relative w-full flex items-center justify-center h-[112px]">
              <PrefectureSilhouette
                feature={feature}
                primaryColor={primaryHex}
                accentColor={accentHex}
                prefectureName={mascot.prefecture_en}
                width={196}
                height={112}
              />

              {/* Overlaid DNA Pictogram Crest */}
              <div className="absolute bottom-0.5 right-0.5 flex items-center gap-1 bg-white/95 border-2 border-[#172038] rounded-xl px-1.5 py-1 shadow-[2px_2px_0_#172038]">
                <TraitIcon trait={mascot.dna.primary_trait} size={36} />
                {secondaryTraits.slice(0, 2).map((sec) => (
                  <React.Fragment key={sec}>
                    <span className="font-display font-bold text-xs text-[#E3350D]" aria-hidden="true">
                      +
                    </span>
                    <TraitIcon trait={sec} size={28} />
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* DNA Formula Strip */}
            <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-[#172038]/15 text-xs">
              <span className="font-bold text-[#172038] truncate">
                {formatDnaCombo(mascot.dna.primary_trait, secondaryTraits)}
              </span>
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0"
                style={{
                  backgroundColor: domainMeta.softBg,
                  color: domainMeta.inkText,
                }}
              >
                {domainMeta.label}
              </span>
            </div>
          </div>

          {/* Virality Moveset / Stats Block */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div className="rounded-xl bg-[#F7F4EA] border-2 border-[#172038] px-2 py-1.5">
              <div className="text-[10.5px] font-semibold text-[#4B556B] leading-tight">Year</div>
              <div className="font-display text-base font-bold text-[#172038] tabular-nums leading-tight">
                {mascot.year}
              </div>
              <div className="text-[10.5px] font-medium text-[#4B556B] leading-tight">
                {mascot.year_type === 'debut' ? 'Confirmed debut' : 'First observed'}
              </div>
            </div>

            <div className="rounded-xl bg-[#F7F4EA] border-2 border-[#172038] px-2 py-1.5">
              <div className="text-[10.5px] font-semibold text-[#4B556B] leading-tight">
                Contagiousness (R₀)
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-display text-base font-bold text-[#172038] tabular-nums leading-tight">
                  {selectedNode.rValue}
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none"
                  style={{ backgroundColor: tier.softBg, color: tier.color }}
                >
                  {tier.label}
                </span>
              </div>
              <div className="text-[10.5px] font-medium text-[#4B556B] leading-tight">
                {selectedNode.rValue === 1 ? '1 host infected' : `${selectedNode.rValue} hosts infected`}
              </div>
            </div>

            <div className="rounded-xl bg-[#F7F4EA] border-2 border-[#172038] px-2 py-1.5">
              <div className="text-[10.5px] font-semibold text-[#4B556B] leading-tight">
                Strain Class
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full border border-[#172038] shrink-0"
                  style={{ backgroundColor: mutationMeta.color }}
                />
                <span className="font-bold text-[#172038] leading-tight">{mutationMeta.label}</span>
              </div>
              <div className="text-[10.5px] font-medium text-[#4B556B] leading-tight mt-0.5">
                Family: {formatTraitLabel(mascot.dna.trait_family)}
              </div>
            </div>

            <div className="rounded-xl bg-[#F7F4EA] border-2 border-[#172038] px-2 py-1.5">
              <div className="text-[10.5px] font-semibold text-[#4B556B] leading-tight">
                Transmission
              </div>
              <div className="mt-0.5 font-bold text-[#172038] flex items-center gap-1 leading-tight">
                <Compass className="w-3.5 h-3.5 text-[#246BCE] shrink-0" aria-hidden="true" />
                <span>
                  {selectedNode.transmissionType === 'origin'
                    ? 'Origin point'
                    : selectedNode.transmissionType === 'local'
                      ? 'Local neighbor'
                      : 'Long jump'}
                </span>
              </div>
              <div className="text-[10.5px] font-medium text-[#4B556B] tabular-nums leading-tight mt-0.5">
                {selectedNode.distanceKm !== null
                  ? `${selectedNode.distanceKm} km from parent`
                  : `${windowYears}-yr window`}
              </div>
            </div>
          </div>

          {/* Authentic Pokémon TCG Flavor Text Box */}
          {mascot.bio_en && (
            <p
              title={mascot.bio_en}
              className="rounded-xl bg-[#FFF9E3] border border-[#172038]/30 px-2.5 py-1.5 text-[11.5px] italic text-[#172038] leading-snug line-clamp-2"
            >
              “{mascot.bio_en}”
            </p>
          )}

          {/* Clickable Outbreak Chain (Lineage Tree) — visible above the fold on 1440x900 */}
          <div className="space-y-2 pt-1 border-t-2 border-[#172038]/12">
            <h3 className="font-display text-sm font-bold text-[#172038]">Outbreak Chain</h3>

            {/* Infected By (Parent) */}
            <div>
              <div className="text-[11px] font-semibold text-[#4B556B] mb-1">
                Infected By (Parent)
              </div>
              {parentNode ? (
                <button
                  type="button"
                  onClick={() => onSelectMascot(parentNode.mascot.id)}
                  className="w-full text-left rounded-xl bg-white px-2.5 py-1.5 flex items-center gap-2 ink-button cursor-pointer"
                >
                  <ArrowUpLeft className="w-4 h-4 text-[#246BCE] shrink-0" aria-hidden="true" />
                  <TraitIcon trait={parentNode.mascot.dna.primary_trait} size={26} decorative />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#172038] truncate">
                      {parentNode.mascot.name_en}
                    </div>
                    <div className="text-[11px] text-[#4B556B] tabular-nums truncate">
                      {parentNode.mascot.prefecture_en} · {parentNode.mascot.year}
                      {selectedNode.distanceKm !== null ? ` · ${selectedNode.distanceKm} km` : ''}
                    </div>
                  </div>
                </button>
              ) : (
                <div className="rounded-xl bg-[#EFF6FF] border border-[#2563EB]/35 px-2.5 py-1.5 text-xs text-[#1E3A8A]">
                  <strong>Patient Zero</strong> — No matching ancestor within the {windowYears}-year
                  window.
                </div>
              )}
            </div>

            {/* Infected Hosts (Children) */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#4B556B] mb-1">
                <span>Infected Hosts (Children)</span>
                <span className="tabular-nums">{activeChildren.length}</span>
              </div>

              {activeChildren.length > 0 ? (
                <ul className="space-y-1.5">
                  {activeChildren.map((child) => {
                    const delta = child.mascot.year - mascot.year;
                    const childMut = MUTATION_META[child.mutationType];
                    return (
                      <li key={child.mascot.id}>
                        <button
                          type="button"
                          onClick={() => onSelectMascot(child.mascot.id)}
                          className="w-full text-left rounded-xl bg-white px-2.5 py-1.5 flex items-center gap-2 ink-button cursor-pointer"
                        >
                          <ArrowDownRight
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: childMut.color }}
                            aria-hidden="true"
                          />
                          <TraitIcon trait={child.mascot.dna.primary_trait} size={24} decorative />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-[#172038] truncate">
                              {child.mascot.name_en}
                            </div>
                            <div className="text-[11px] text-[#4B556B] truncate tabular-nums">
                              +{delta} {delta === 1 ? 'yr' : 'yrs'} · {child.mascot.prefecture_en} ·{' '}
                              <span style={{ color: childMut.textColor }} className="font-semibold">
                                {describeChildMutation(selectedNode, child)}
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl bg-[#F7F4EA] border border-[#172038]/15 px-2.5 py-1.5 text-xs text-[#4B556B]">
                  No downstream transmissions recorded on or before {currentYear}.
                </p>
              )}
            </div>
          </div>
        </div>
      </article>
    </aside>
  );
};
