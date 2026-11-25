import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type {
  ComputedMascotNode,
  JapanGeoJSON,
  MascotDomain,
  MascotRecord,
  PrefectureAdjacencyMap,
} from './types/mascot';
import { computeEpidemic, getAvailableTraits } from './engine/epidemic';
import { OUTBREAK_PRESETS, type OutbreakPreset } from './engine/presets';
import type { MapColorMode } from './utils/theme';
import { TopControlDeck } from './components/TopControlDeck';
import { JapanEpidemicMap } from './components/JapanEpidemicMap';
import { MascotGeneCard } from './components/MascotGeneCard';
import { EpidemicTimeline, type PlaybackSpeed } from './components/EpidemicTimeline';

interface LoadedAtlasData {
  mascots: MascotRecord[];
  geojson: JapanGeoJSON;
  adjacency: PrefectureAdjacencyMap;
}

function pickBestMascotNode(
  activeNodes: ComputedMascotNode[],
  nodesById: Record<string, ComputedMascotNode>,
  superSpreaderId: string | null,
  focusMascotId?: string
): ComputedMascotNode | null {
  if (activeNodes.length === 0) return null;

  if (focusMascotId) {
    const focused = nodesById[focusMascotId];
    if (focused && activeNodes.some((n) => n.mascot.id === focused.mascot.id)) {
      return focused;
    }
  }

  const kumamon = activeNodes.find(
    (n) =>
      n.mascot.id === 'kumamon-43' ||
      n.mascot.name_en.toLowerCase().includes('kumamon')
  );
  if (kumamon) return kumamon;

  if (superSpreaderId && nodesById[superSpreaderId]) {
    return nodesById[superSpreaderId];
  }

  const patientZero = activeNodes.find((n) => n.mutationType === 'patient_zero');
  return patientZero ?? activeNodes[0];
}

const SPEED_INTERVAL_MS: Record<PlaybackSpeed, number> = {
  1: 680,
  2: 340,
  4: 170,
};

export function App() {
  const [atlasData, setAtlasData] = useState<LoadedAtlasData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Filter & visualization state
  const defaultPreset = OUTBREAK_PRESETS[0];
  const [activePresetId, setActivePresetId] = useState<string | null>(defaultPreset.id);
  const [domain, setDomain] = useState<MascotDomain | 'ALL'>(defaultPreset.domain);
  const [primaryTrait, setPrimaryTrait] = useState<string | 'ALL'>(defaultPreset.primaryTrait);
  const [windowYears, setWindowYears] = useState<number>(defaultPreset.windowYears);
  const [confirmedDebutOnly, setConfirmedDebutOnly] = useState<boolean>(false);

  const [colorMode, setColorMode] = useState<MapColorMode>('mutation');
  const [showArcs, setShowArcs] = useState<boolean>(true);
  const [showMutations, setShowMutations] = useState<boolean>(true);

  // Timeline & playback state
  const [currentYear, setCurrentYear] = useState<number>(2025);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);

  // Selection & map focus state
  const [selectedJisCode, setSelectedJisCode] = useState<string | null>(null);
  const [selectedMascotId, setSelectedMascotId] = useState<string | null>(null);
  const [focusNonce, setFocusNonce] = useState<number>(0);
  const [pendingFocusId, setPendingFocusId] = useState<string | undefined>(
    defaultPreset.focusMascotId
  );

  // Fetch all static data in parallel using relative ./data/... paths
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setLoadError(null);
      try {
        const [mascotsRes, geoRes, adjRes] = await Promise.all([
          fetch('./data/mascots.json', { signal: controller.signal }),
          fetch('./data/japan_prefectures.geojson', { signal: controller.signal }),
          fetch('./data/prefecture_adjacency.json', { signal: controller.signal }),
        ]);

        if (!mascotsRes.ok) {
          throw new Error(`Failed to load mascots.json (${mascotsRes.status})`);
        }
        if (!geoRes.ok) {
          throw new Error(`Failed to load japan_prefectures.geojson (${geoRes.status})`);
        }
        if (!adjRes.ok) {
          throw new Error(`Failed to load prefecture_adjacency.json (${adjRes.status})`);
        }

        const [mascots, geojson, adjacency] = (await Promise.all([
          mascotsRes.json(),
          geoRes.json(),
          adjRes.json(),
        ])) as [MascotRecord[], JapanGeoJSON, PrefectureAdjacencyMap];

        if (!Array.isArray(mascots) || !geojson?.features?.length) {
          throw new Error('Atlas datasets are empty or malformed.');
        }

        if (!cancelled) {
          setAtlasData({ mascots, geojson, adjacency });
          const maxDataYear = mascots.reduce((acc, m) => Math.max(acc, m.year), 2020);
          setCurrentYear(maxDataYear);
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Unable to load Yuru-Dex static datasets.';
        setLoadError(message);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadNonce]);

  const availableTraits = useMemo(() => {
    if (!atlasData) return [];
    const source = confirmedDebutOnly
      ? atlasData.mascots.filter((m) => m.year_type === 'debut')
      : atlasData.mascots;
    return getAvailableTraits(source, domain);
  }, [atlasData, domain, confirmedDebutOnly]);

  // Run deterministic client-side epidemiological model
  const epidemic = useMemo(() => {
    if (!atlasData) return null;
    return computeEpidemic(atlasData.mascots, atlasData.adjacency, {
      domain,
      primaryTrait,
      windowYears,
      confirmedDebutOnly,
      maxYear: currentYear,
    });
  }, [atlasData, domain, primaryTrait, windowYears, confirmedDebutOnly, currentYear]);

  // Keep currentYear bounded within the active filtered dataset's [minYear, maxYear]
  useEffect(() => {
    if (!epidemic || epidemic.orderedNodes.length === 0) return;
    setCurrentYear((prev) => {
      if (prev < epidemic.minYear) return epidemic.minYear;
      if (prev > epidemic.maxYear) return epidemic.maxYear;
      return prev;
    });
  }, [epidemic?.minYear, epidemic?.maxYear, epidemic?.orderedNodes.length]);

  // Auto-select Kumamon / preset focus / super-spreader on initial load or preset change
  useEffect(() => {
    if (!epidemic) return;

    const currentNode = selectedMascotId ? epidemic.nodesById[selectedMascotId] : null;
    const isCurrentValid =
      Boolean(currentNode) &&
      epidemic.activeNodes.some((n) => n.mascot.id === selectedMascotId);

    if (pendingFocusId || (!isCurrentValid && !selectedJisCode)) {
      const best = pickBestMascotNode(
        epidemic.activeNodes,
        epidemic.nodesById,
        epidemic.stats.superSpreaderId,
        pendingFocusId
      );
      if (best) {
        setSelectedMascotId(best.mascot.id);
        setSelectedJisCode(best.mascot.jis_code);
      } else {
        setSelectedMascotId(null);
      }
      if (pendingFocusId) {
        setPendingFocusId(undefined);
      }
      return;
    }

    // If user clicked a prefecture that now has active nodes (e.g. during playback), show its lead node
    if (!isCurrentValid && selectedJisCode) {
      const prefSummary = epidemic.prefectureSummary[selectedJisCode];
      if (prefSummary) {
        setSelectedMascotId(prefSummary.leadNode.mascot.id);
      } else {
        setSelectedMascotId(null);
      }
    }
  }, [epidemic, selectedMascotId, selectedJisCode, pendingFocusId]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || !epidemic) return;
    if (currentYear >= epidemic.maxYear) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setInterval(() => {
      setCurrentYear((prev) => {
        if (prev >= epidemic.maxYear) {
          setIsPlaying(false);
          return epidemic.maxYear;
        }
        return prev + 1;
      });
    }, SPEED_INTERVAL_MS[speed]);

    return () => window.clearInterval(timer);
  }, [isPlaying, speed, epidemic, currentYear]);

  const handleSelectPreset = useCallback(
    (preset: OutbreakPreset) => {
      setIsPlaying(false);
      setActivePresetId(preset.id);
      setDomain(preset.domain);
      setPrimaryTrait(preset.primaryTrait);
      setWindowYears(preset.windowYears);
      setPendingFocusId(preset.focusMascotId ?? '__auto__');
      if (atlasData) {
        const preview = computeEpidemic(atlasData.mascots, atlasData.adjacency, {
          domain: preset.domain,
          primaryTrait: preset.primaryTrait,
          windowYears: preset.windowYears,
          confirmedDebutOnly,
          maxYear: 9999,
        });
        setCurrentYear(preview.maxYear);
      }
    },
    [atlasData, confirmedDebutOnly]
  );

  const handleChangeDomain = useCallback(
    (nextDomain: MascotDomain | 'ALL') => {
      setActivePresetId(null);
      setDomain(nextDomain);
      if (nextDomain !== 'ALL' && atlasData) {
        const nextTraits = getAvailableTraits(atlasData.mascots, nextDomain);
        if (primaryTrait !== 'ALL' && !nextTraits.some((t) => t.trait === primaryTrait)) {
          setPrimaryTrait('ALL');
        }
      }
      setPendingFocusId('__auto__');
    },
    [atlasData, primaryTrait]
  );

  const handleChangePrimaryTrait = useCallback((nextTrait: string | 'ALL') => {
    setActivePresetId(null);
    setPrimaryTrait(nextTrait);
    setPendingFocusId('__auto__');
  }, []);

  const handleChangeWindowYears = useCallback((years: number) => {
    setWindowYears(years);
  }, []);

  const handleSelectPrefecture = useCallback(
    (jisCode: string) => {
      setSelectedJisCode(jisCode);
      const summary = epidemic?.prefectureSummary[jisCode];
      if (summary) {
        setSelectedMascotId(summary.leadNode.mascot.id);
      } else {
        setSelectedMascotId(null);
      }
    },
    [epidemic]
  );

  const handleSelectMascot = useCallback(
    (mascotId: string) => {
      const node = epidemic?.nodesById[mascotId];
      if (!node) return;
      setSelectedMascotId(node.mascot.id);
      setSelectedJisCode(node.mascot.jis_code);
      setFocusNonce((n) => n + 1);
    },
    [epidemic]
  );

  const handleTogglePlay = useCallback(() => {
    if (!epidemic) return;
    if (!isPlaying && currentYear >= epidemic.maxYear) {
      setCurrentYear(epidemic.minYear);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [epidemic, isPlaying, currentYear]);

  const handleResetTimeline = useCallback(() => {
    if (!epidemic) return;
    setIsPlaying(false);
    setCurrentYear(epidemic.minYear);
  }, [epidemic]);

  const handleScrubYear = useCallback((year: number) => {
    setIsPlaying(false);
    setCurrentYear(year);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="ink-panel rounded-2xl px-8 py-7 max-w-sm w-full text-center space-y-4">
          <svg
            width="56"
            height="56"
            viewBox="0 0 64 64"
            className="mx-auto poke-loader-spin"
            role="img"
            aria-label="Loading Yuru-Dex atlas"
          >
            <circle cx="32" cy="32" r="28" fill="#E3350D" stroke="#172038" strokeWidth="3.5" />
            <path d="M4 32 A28 28 0 0 0 60 32 Z" fill="#FFFFFF" stroke="#172038" strokeWidth="3.5" />
            <line x1="4" y1="32" x2="60" y2="32" stroke="#172038" strokeWidth="4" />
            <circle cx="32" cy="32" r="10" fill="#FFCB05" stroke="#172038" strokeWidth="3.5" />
          </svg>
          <div>
            <h1 className="font-display text-2xl font-bold text-[#172038]">Loading Yuru-Dex</h1>
            <p className="text-sm text-[#4B556B] mt-1">
              Preparing Japan&apos;s 47 prefectures and mascot DNA lineages…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Honest error state (no fabricated fallback data)
  if (loadError || !atlasData || !epidemic) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="ink-panel rounded-2xl px-7 py-6 max-w-md w-full space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FEE2E2] border-2 border-[#172038] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-[#E3350D]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[#172038]">
                Atlas Data Unavailable
              </h1>
              <p className="text-xs text-[#4B556B]">Could not fetch static JSON / GeoJSON files.</p>
            </div>
          </div>
          <p className="rounded-xl bg-[#F7F4EA] border border-[#172038]/20 p-3 text-xs font-mono text-[#7F1D1D] break-words">
            {loadError ?? 'Unknown data loading error.'}
          </p>
          <button
            type="button"
            onClick={() => setReloadNonce((n) => n + 1)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E3350D] text-white font-display font-bold text-sm ink-button cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry Loading Atlas
          </button>
        </div>
      </div>
    );
  }

  const selectedNode =
    selectedMascotId &&
    epidemic.nodesById[selectedMascotId] &&
    epidemic.nodesById[selectedMascotId].mascot.year <= currentYear
      ? epidemic.nodesById[selectedMascotId]
      : null;

  const activePrefJis = selectedNode?.mascot.jis_code ?? selectedJisCode;
  const prefectureNodes =
    activePrefJis && epidemic.prefectureSummary[activePrefJis]
      ? epidemic.prefectureSummary[activePrefJis].nodes
      : [];

  const superSpreaderNode = epidemic.stats.superSpreaderId
    ? epidemic.nodesById[epidemic.stats.superSpreaderId] ?? null
    : null;

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col">
      <TopControlDeck
        presets={OUTBREAK_PRESETS}
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        domain={domain}
        onChangeDomain={handleChangeDomain}
        primaryTrait={primaryTrait}
        onChangePrimaryTrait={handleChangePrimaryTrait}
        availableTraits={availableTraits}
        windowYears={windowYears}
        onChangeWindowYears={handleChangeWindowYears}
        confirmedDebutOnly={confirmedDebutOnly}
        onChangeConfirmedDebutOnly={setConfirmedDebutOnly}
        showArcs={showArcs}
        onChangeShowArcs={setShowArcs}
        showMutations={showMutations}
        onChangeShowMutations={setShowMutations}
        colorMode={colorMode}
        onChangeColorMode={setColorMode}
      />

      {/* Responsive Workspace: Mobile = Map -> Timeline -> Gene Card; Desktop (lg+) = [Map | Gene Card] -> Timeline */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_364px] xl:grid-cols-[minmax(0,1fr)_404px] lg:grid-rows-[minmax(0,1fr)_auto]">
        <main className="order-1 lg:order-none lg:col-start-1 lg:row-start-1 min-h-0 flex px-3 sm:px-4 pt-2.5 pb-2 lg:py-2.5 lg:pr-1.5">
          <JapanEpidemicMap
            geojson={atlasData.geojson}
            prefectureSummary={epidemic.prefectureSummary}
            arcs={epidemic.arcs}
            selectedJisCode={selectedJisCode}
            selectedMascotId={selectedNode?.mascot.id ?? null}
            colorMode={colorMode}
            showArcs={showArcs}
            showMutations={showMutations}
            currentYear={currentYear}
            focusNonce={focusNonce}
            onSelectPrefecture={handleSelectPrefecture}
            onSelectMascot={handleSelectMascot}
          />
        </main>

        <div className="order-2 lg:order-none lg:col-span-2 lg:row-start-2">
          <EpidemicTimeline
            yearlyIncidence={epidemic.yearlyIncidence}
            minYear={epidemic.minYear}
            maxYear={epidemic.maxYear}
            currentYear={currentYear}
            onChangeYear={handleScrubYear}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            speed={speed}
            onChangeSpeed={setSpeed}
            onReset={handleResetTimeline}
            stats={epidemic.stats}
          />
        </div>

        <div className="order-3 lg:order-none lg:col-start-2 lg:row-start-1 min-h-0 flex px-3 sm:px-4 py-2.5 lg:pl-1.5">
          <MascotGeneCard
            selectedNode={selectedNode}
            prefectureNodes={prefectureNodes}
            nodesById={epidemic.nodesById}
            geojson={atlasData.geojson}
            selectedJisCode={selectedJisCode}
            currentYear={currentYear}
            windowYears={windowYears}
            superSpreaderNode={superSpreaderNode}
            onSelectMascot={handleSelectMascot}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
