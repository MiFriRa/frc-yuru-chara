import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import type {
  EpidemicComputationResult,
  JapanGeoJSON,
  TransmissionArc,
} from '../types/mascot';
import {
  formatDnaCombo,
  GENERATION_SCALE,
  getGenerationColor,
  MUTATION_META,
  type MapColorMode,
} from '../utils/theme';
import { TraitIcon } from './TraitIcons';

interface JapanEpidemicMapProps {
  geojson: JapanGeoJSON;
  prefectureSummary: EpidemicComputationResult['prefectureSummary'];
  arcs: TransmissionArc[];
  selectedJisCode: string | null;
  selectedMascotId: string | null;
  colorMode: MapColorMode;
  showArcs: boolean;
  showMutations: boolean;
  currentYear: number;
  focusNonce?: number;
  onSelectPrefecture: (jisCode: string) => void;
  onSelectMascot: (mascotId: string) => void;
}

const VIEW_W = 860;
const VIEW_H = 660;

// Fixed top-left Okinawa inset frame (in top-level SVG space so pan/zoom never clips it)
const INSET_X = 16;
const INSET_Y = 16;
const INSET_W = 156;
const INSET_H = 116;

// Okinawa Main Island (Okinawa-jima) geographic anchor [lng, lat]
const OKINAWA_MAIN_LNG_LAT: [number, number] = [127.95, 26.48];

interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

const DEFAULT_VIEW: ViewTransform = { scale: 1, tx: 0, ty: 0 };

function clampView(v: ViewTransform): ViewTransform {
  const scale = Math.max(1, Math.min(5.2, v.scale));
  const maxTx = VIEW_W * 0.45 * (scale - 1) + 60;
  const maxTy = VIEW_H * 0.45 * (scale - 1) + 60;
  return {
    scale,
    tx: Math.max(-maxTx, Math.min(maxTx, v.tx)),
    ty: Math.max(-maxTy, Math.min(maxTy, v.ty)),
  };
}

function getPrefectureGeneration(
  summary: EpidemicComputationResult['prefectureSummary'][string]
): number {
  if (summary.leadNode.generation === 1) return 1;
  let minGen = summary.leadNode.generation;
  for (const node of summary.nodes) {
    if (node.generation < minGen) minGen = node.generation;
  }
  return minGen;
}

export const JapanEpidemicMap: React.FC<JapanEpidemicMapProps> = ({
  geojson,
  prefectureSummary,
  arcs,
  selectedJisCode,
  selectedMascotId,
  colorMode,
  showArcs,
  showMutations,
  currentYear,
  focusNonce = 0,
  onSelectPrefecture,
  onSelectMascot,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewTransform>(DEFAULT_VIEW);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    origTx: number;
    origTy: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, origTx: 0, origTy: 0 });

  const [hoveredJis, setHoveredJis] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Build mainland + tightly framed Okinawa Main Island inset projections once from GeoJSON
  const mapGeometry = useMemo(() => {
    const mainlandFeatures = geojson.features.filter((f) => f.properties.jis_code !== '47');
    const okinawaFeature = geojson.features.find((f) => f.properties.jis_code === '47') ?? null;

    const mainlandCollection: JapanGeoJSON = {
      type: 'FeatureCollection',
      features: mainlandFeatures,
    };

    const mainlandProj = geoMercator().fitExtent(
      [
        [44, 24],
        [VIEW_W - 28, VIEW_H - 22],
      ],
      mainlandCollection
    );
    const mainlandPath = geoPath(mainlandProj);

    // Tight framing centered on Okinawa Main Island (Okinawa-jima) so it renders bold and unmistakable
    const okinawaProj = okinawaFeature
      ? geoMercator()
          .center(OKINAWA_MAIN_LNG_LAT)
          .scale(5400)
          .translate([INSET_X + INSET_W * 0.52, INSET_Y + INSET_H * 0.58])
      : null;
    const okinawaPath = okinawaProj ? geoPath(okinawaProj) : null;

    const okinawaAnchorRaw = okinawaProj ? okinawaProj(OKINAWA_MAIN_LNG_LAT) : null;
    const okinawaAnchor: [number, number] =
      okinawaAnchorRaw && Number.isFinite(okinawaAnchorRaw[0]) && Number.isFinite(okinawaAnchorRaw[1])
        ? [okinawaAnchorRaw[0], okinawaAnchorRaw[1]]
        : [INSET_X + INSET_W * 0.52, INSET_Y + INSET_H * 0.58];

    const mainlandItems = mainlandFeatures.map((feature) => {
      const jis = feature.properties.jis_code;
      const d = mainlandPath(feature) ?? '';
      const rawCentroid = mainlandPath.centroid(feature);
      const centroid: [number, number] =
        Number.isFinite(rawCentroid[0]) && Number.isFinite(rawCentroid[1])
          ? [rawCentroid[0], rawCentroid[1]]
          : [VIEW_W / 2, VIEW_H / 2];

      return { jis, feature, d, centroid };
    });

    const okinawaItem = okinawaFeature
      ? {
          jis: '47',
          feature: okinawaFeature,
          d: okinawaPath?.(okinawaFeature) ?? '',
          centroid: okinawaAnchor,
        }
      : null;

    const allItems = okinawaItem ? [...mainlandItems, okinawaItem] : mainlandItems;
    const centroidByJis: Record<string, [number, number]> = {};
    for (const item of allItems) {
      centroidByJis[item.jis] = item.centroid;
    }

    const projectMainlandLatLng = (jisCode: string, latLng: [number, number]): [number, number] => {
      const [lat, lng] = latLng;
      const projected = mainlandProj([lng, lat]);
      if (projected && Number.isFinite(projected[0]) && Number.isFinite(projected[1])) {
        return [projected[0], projected[1]];
      }
      return centroidByJis[jisCode] ?? [VIEW_W / 2, VIEW_H / 2];
    };

    return {
      mainlandItems,
      okinawaItem,
      allItems,
      centroidByJis,
      okinawaAnchor,
      projectMainlandLatLng,
    };
  }, [geojson]);

  // Gently focus the selected mainland prefecture when navigated externally (e.g. clicking Parent/Child)
  useEffect(() => {
    if (!selectedJisCode || focusNonce === 0) return;
    // Okinawa is always fixed and visible in the top-left inset, so no mainland pan needed
    if (selectedJisCode === '47') return;

    const targetPoint = mapGeometry.centroidByJis[selectedJisCode];
    if (!targetPoint) return;

    setView((prev) => {
      const targetScale = Math.max(prev.scale, 1.55);
      const tx = VIEW_W / 2 - targetPoint[0] * targetScale;
      const ty = VIEW_H / 2 - targetPoint[1] * targetScale;
      return clampView({ scale: targetScale, tx, ty });
    });
  }, [selectedJisCode, focusNonce, mapGeometry]);

  // Visible transmission arcs
  const visibleArcs = useMemo(() => {
    if (!showArcs) return [];
    return arcs.filter((arc) => {
      if (!showMutations && (arc.mutationType === 'hybrid' || arc.mutationType === 'mutation')) {
        return false;
      }
      return true;
    });
  }, [arcs, showArcs, showMutations]);

  const hasSelectedArc = useMemo(() => {
    if (!selectedMascotId) return false;
    return visibleArcs.some(
      (arc) => arc.sourceId === selectedMascotId || arc.targetId === selectedMascotId
    );
  }, [visibleArcs, selectedMascotId]);

  // Split arcs into mainland-only (inside pan/zoom group) and Okinawa-connected (in top-level SVG coords)
  const { mainlandArcs, okinawaArcs } = useMemo(() => {
    const buildCurve = (p1: [number, number], p2: [number, number], idx: number) => {
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const dist = Math.hypot(dx, dy) || 1;
      const mx = (p1[0] + p2[0]) / 2;
      const my = (p1[1] + p2[1]) / 2;
      const nx = -dy / dist;
      const ny = dx / dist;
      const bendDir = idx % 2 === 0 ? 1 : -1;
      const bendMag = Math.min(68, Math.max(18, dist * 0.22));
      const cx = mx + nx * bendMag * bendDir;
      const cy = my + ny * bendMag * bendDir;
      return `M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    };

    const ml: Array<{
      arc: TransmissionArc;
      d: string;
      isConnected: boolean;
      isNew: boolean;
    }> = [];
    const ok: Array<{
      arc: TransmissionArc;
      d: string;
      isConnected: boolean;
      isNew: boolean;
    }> = [];

    visibleArcs.forEach((arc, idx) => {
      const isConnected =
        selectedMascotId !== null &&
        (arc.sourceId === selectedMascotId || arc.targetId === selectedMascotId);
      const isNew = arc.year === currentYear;

      if (arc.sourceJis === '47' || arc.targetJis === '47') {
        const toScreen = (pt: [number, number]): [number, number] => [
          pt[0] * view.scale + view.tx,
          pt[1] * view.scale + view.ty,
        ];
        const p1 =
          arc.sourceJis === '47'
            ? mapGeometry.okinawaAnchor
            : toScreen(mapGeometry.projectMainlandLatLng(arc.sourceJis, arc.sourceCentroid));
        const p2 =
          arc.targetJis === '47'
            ? mapGeometry.okinawaAnchor
            : toScreen(mapGeometry.projectMainlandLatLng(arc.targetJis, arc.targetCentroid));
        ok.push({ arc, d: buildCurve(p1, p2, idx), isConnected, isNew });
      } else {
        const p1 = mapGeometry.projectMainlandLatLng(arc.sourceJis, arc.sourceCentroid);
        const p2 = mapGeometry.projectMainlandLatLng(arc.targetJis, arc.targetCentroid);
        ml.push({ arc, d: buildCurve(p1, p2, idx), isConnected, isNew });
      }
    });

    ml.sort((a, b) => Number(a.isConnected) - Number(b.isConnected));
    ok.sort((a, b) => Number(a.isConnected) - Number(b.isConnected));

    return { mainlandArcs: ml, okinawaArcs: ok };
  }, [visibleArcs, mapGeometry, selectedMascotId, currentYear, view.scale, view.tx, view.ty]);

  // Wheel zoom around cursor
  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const zoomFactor = e.deltaY < 0 ? 1.18 : 1 / 1.18;

    setView((prev) => {
      const nextScale = Math.max(1, Math.min(5.2, prev.scale * zoomFactor));
      const ratio = nextScale / prev.scale;
      const tx = px - (px - prev.tx) * ratio;
      const ty = py - (py - prev.ty) * ratio;
      return clampView({ scale: nextScale, tx, ty });
    });
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origTx: view.tx,
      origTy: view.ty,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      setPointerPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }

    const drag = dragStateRef.current;
    if (!drag.active || !svgRef.current) return;

    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    if (Math.hypot(dxScreen, dyScreen) > 4) {
      drag.moved = true;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const dxSvg = (dxScreen / rect.width) * VIEW_W;
    const dySvg = (dyScreen / rect.height) * VIEW_H;

    setView((prev) =>
      clampView({
        scale: prev.scale,
        tx: drag.origTx + dxSvg,
        ty: drag.origTy + dySvg,
      })
    );
  };

  const handlePointerUp = () => {
    dragStateRef.current.active = false;
    setIsDragging(false);
  };

  const zoomBy = (factor: number) => {
    setView((prev) => {
      const nextScale = Math.max(1, Math.min(5.2, prev.scale * factor));
      const ratio = nextScale / prev.scale;
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      return clampView({
        scale: nextScale,
        tx: cx - (cx - prev.tx) * ratio,
        ty: cy - (cy - prev.ty) * ratio,
      });
    });
  };

  const resetView = () => setView(DEFAULT_VIEW);

  const hoveredFeature = hoveredJis
    ? mapGeometry.allItems.find((f) => f.jis === hoveredJis)?.feature
    : null;
  const hoveredSummary = hoveredJis ? prefectureSummary[hoveredJis] : undefined;

  // Keep tooltip clamped inside container bounds
  const tooltipStyle = useMemo<React.CSSProperties>(() => {
    const cw = containerRef.current?.clientWidth ?? 760;
    const ch = containerRef.current?.clientHeight ?? 540;
    const left = Math.min(Math.max(12, pointerPos.x + 16), Math.max(12, cw - 260));
    const top = Math.min(Math.max(12, pointerPos.y - 16), Math.max(12, ch - 155));
    return { left, top };
  }, [pointerPos]);

  const getPrefFill = (jis: string): string => {
    const summary = prefectureSummary[jis];
    if (!summary) return '#E4E0D3';
    return colorMode === 'mutation'
      ? MUTATION_META[summary.dominantMutation].color
      : getGenerationColor(getPrefectureGeneration(summary));
  };

  const renderArcElement = (
    item: { arc: TransmissionArc; d: string; isConnected: boolean; isNew: boolean },
    scaleDivisor: number
  ) => {
    const { arc, d, isConnected, isNew } = item;
    const meta = MUTATION_META[arc.mutationType];
    const opacity = isConnected
      ? 0.96
      : hasSelectedArc
        ? 0.38
        : isNew
          ? 0.92
          : 0.7;
    const baseStroke = isConnected ? 3.1 : isNew ? 2.3 : 1.75;
    // Slightly clearer dash cadence when a dotted mutation arc is actively selected
    const dashArray =
      isConnected && arc.mutationType === 'mutation' ? '4.5 4' : meta.strokeDasharray;

    return (
      <g key={arc.id}>
        {isConnected && (
          <path
            d={d}
            fill="none"
            stroke="#FFFDF7"
            strokeWidth={(baseStroke + 2.8) / scaleDivisor}
            strokeLinecap="round"
            opacity={0.94}
            pointerEvents="none"
          />
        )}
        <path
          d={d}
          fill="none"
          stroke={meta.color}
          strokeWidth={baseStroke / scaleDivisor}
          strokeDasharray={dashArray}
          strokeLinecap="round"
          opacity={opacity}
          markerEnd={`url(#arrow-${arc.mutationType})`}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            if (dragStateRef.current.moved) return;
            onSelectMascot(arc.targetId);
          }}
        >
          <title>{`${meta.label} · ${arc.year} · ${arc.distanceKm} km`}</title>
        </path>
      </g>
    );
  };

  const okinawaSummary = prefectureSummary['47'];
  const okinawaSelected = selectedJisCode === '47';
  const okinawaHovered = hoveredJis === '47';

  return (
    <section
      ref={containerRef}
      aria-label="Interactive epidemic map of Japan"
      className="relative flex-1 min-h-[380px] rounded-2xl border-2 border-[#172038] shadow-[3px_3px_0_#172038] overflow-hidden select-none bg-[#E6F0F6] flex flex-col"
    >
      <div className="relative flex-1 min-h-[320px] w-full">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className={`w-full h-full block touch-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            handlePointerUp();
            setHoveredJis(null);
          }}
          role="img"
          aria-label="Map of Japan's 47 prefectures showing mascot trait outbreak spread and transmission arcs"
        >
          <defs>
            {/* Traditional Japanese Seigaiha wave ocean texture */}
            <pattern
              id="seigaiha-ocean"
              width="48"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <rect width="48" height="24" fill="#E6F0F6" />
              <g fill="none" stroke="#CFE1EC" strokeWidth="1.25">
                <circle cx="0" cy="24" r="20" />
                <circle cx="0" cy="24" r="14" />
                <circle cx="0" cy="24" r="8" />
                <circle cx="48" cy="24" r="20" />
                <circle cx="48" cy="24" r="14" />
                <circle cx="48" cy="24" r="8" />
                <circle cx="24" cy="12" r="20" />
                <circle cx="24" cy="12" r="14" />
                <circle cx="24" cy="12" r="8" />
              </g>
            </pattern>

            {/* Clip path for the fixed Okinawa Main Island inset */}
            <clipPath id="okinawa-inset-clip">
              <rect
                x={INSET_X + 2}
                y={INSET_Y + 2}
                width={INSET_W - 4}
                height={INSET_H - 4}
                rx={10}
              />
            </clipPath>

            {/* Directional arrowheads for transmission arcs */}
            <marker
              id="arrow-pure_copy"
              viewBox="0 0 10 10"
              refX="7.5"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill={MUTATION_META.pure_copy.color} />
            </marker>
            <marker
              id="arrow-hybrid"
              viewBox="0 0 10 10"
              refX="7.5"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill={MUTATION_META.hybrid.color} />
            </marker>
            <marker
              id="arrow-mutation"
              viewBox="0 0 10 10"
              refX="7.5"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 1 1.5 L 8.5 5 L 1 8.5 z" fill={MUTATION_META.mutation.color} />
            </marker>
          </defs>

          {/* Edge-to-edge oversized Seigaiha ocean backdrop so zero white bars ever appear */}
          <rect x="-1200" y="-1200" width="3260" height="3060" fill="url(#seigaiha-ocean)" />

          {/* Pan & Zoom mainland Japan world group */}
          <g
            transform={`translate(${view.tx}, ${view.ty}) scale(${view.scale})`}
            style={{
              transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* 46 Mainland Prefecture Polygons */}
            <g>
              {mapGeometry.mainlandItems.map(({ jis, feature, d }) => {
                const summary = prefectureSummary[jis];
                const isSelected = selectedJisCode === jis;
                const isHovered = hoveredJis === jis;
                const fill = getPrefFill(jis);

                const strokeColor = isSelected
                  ? '#172038'
                  : isHovered
                    ? '#172038'
                    : summary
                      ? '#FFFFFF'
                      : '#94A3B8';

                const strokeWidth = isSelected
                  ? 2.8 / Math.sqrt(view.scale)
                  : isHovered
                    ? 2 / Math.sqrt(view.scale)
                    : 0.95 / Math.sqrt(view.scale);

                return (
                  <g key={jis}>
                    {isSelected && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#FFCB05"
                        strokeWidth={6 / Math.sqrt(view.scale)}
                        strokeLinejoin="round"
                        pointerEvents="none"
                      />
                    )}
                    <path
                      d={d}
                      fill={fill}
                      fillOpacity={summary ? (isHovered ? 1 : 0.92) : isHovered ? 0.96 : 0.88}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeLinejoin="round"
                      tabIndex={0}
                      role="button"
                      aria-label={`${feature.properties.name_en} prefecture${
                        summary
                          ? `, ${summary.nodes.length} active mascot${summary.nodes.length > 1 ? 's' : ''}, lead ${summary.leadNode.mascot.name_en}`
                          : ', no active outbreak'
                      }`}
                      className="cursor-pointer outline-none focus-visible:stroke-[#246BCE]"
                      onMouseEnter={() => setHoveredJis(jis)}
                      onMouseLeave={() => setHoveredJis((cur) => (cur === jis ? null : cur))}
                      onClick={() => {
                        if (dragStateRef.current.moved) return;
                        onSelectPrefecture(jis);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectPrefecture(jis);
                        }
                      }}
                    />
                  </g>
                );
              })}
            </g>

            {/* Newly Infected Radar Pulse Rings (mainland) */}
            <g pointerEvents="none">
              {mapGeometry.mainlandItems.map(({ jis, centroid }) => {
                const summary = prefectureSummary[jis];
                if (!summary || summary.infectedYear !== currentYear) return null;
                const ringColor = getPrefFill(jis);
                return (
                  <g key={`pulse-${jis}`} transform={`translate(${centroid[0]}, ${centroid[1]})`}>
                    <circle
                      r={11 / Math.sqrt(view.scale)}
                      fill="none"
                      stroke="#FFCB05"
                      strokeWidth={3 / Math.sqrt(view.scale)}
                      className="radar-pulse-ring"
                    />
                    <circle
                      r={7 / Math.sqrt(view.scale)}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth={2 / Math.sqrt(view.scale)}
                      className="radar-pulse-ring"
                    />
                  </g>
                );
              })}
            </g>

            {/* Curved Mainland Transmission Arcs */}
            {showArcs && (
              <g>
                {mainlandArcs.map((item) => renderArcElement(item, Math.sqrt(view.scale)))}
              </g>
            )}

            {/* Mainland Centroid Nodes & English Labels */}
            <g pointerEvents="none">
              {mapGeometry.mainlandItems.map(({ jis, feature, centroid }) => {
                const summary = prefectureSummary[jis];
                const isSelected = selectedJisCode === jis;
                const isHovered = hoveredJis === jis;
                const showLabel =
                  isSelected || isHovered || (view.scale >= 1.85 && Boolean(summary));

                return (
                  <g key={`label-${jis}`}>
                    {summary && (
                      <circle
                        cx={centroid[0]}
                        cy={centroid[1]}
                        r={
                          (isSelected ? 4.8 : summary.leadNode.rValue >= 4 ? 4.2 : 2.8) /
                          Math.sqrt(view.scale)
                        }
                        fill={isSelected ? '#FFCB05' : '#FFFFFF'}
                        stroke="#172038"
                        strokeWidth={1.5 / Math.sqrt(view.scale)}
                      />
                    )}
                    {showLabel && (
                      <text
                        x={centroid[0]}
                        y={centroid[1] - 7 / Math.sqrt(view.scale)}
                        textAnchor="middle"
                        fontSize={(isSelected || isHovered ? 12.5 : 10.5) / Math.sqrt(view.scale)}
                        fontWeight="700"
                        fill="#172038"
                        stroke="#FFFFFF"
                        strokeWidth={3.2 / Math.sqrt(view.scale)}
                        paintOrder="stroke"
                      >
                        {feature.properties.name_en}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>

          {/* Fixed Top-Left Okinawa Inset (outside pan/zoom transform so it never clips!) */}
          {mapGeometry.okinawaItem && (
            <g>
              <rect
                x={INSET_X}
                y={INSET_Y}
                width={INSET_W}
                height={INSET_H}
                rx={12}
                fill="#EDF5FA"
                stroke="#172038"
                strokeWidth="2"
              />
              {/* Subtle Japanese map inset corner guide ticks */}
              <path
                d={`M ${INSET_X + INSET_W} ${INSET_Y + 28} L ${INSET_X + INSET_W + 12} ${INSET_Y + 28} M ${INSET_X + 32} ${INSET_Y + INSET_H} L ${INSET_X + 32} ${INSET_Y + INSET_H + 12}`}
                stroke="#64748B"
                strokeWidth="1.25"
                strokeDasharray="4 3"
              />

              {/* Clipped tightly-framed Okinawa Main Island */}
              <g clipPath="url(#okinawa-inset-clip)">
                {okinawaSelected && (
                  <path
                    d={mapGeometry.okinawaItem.d}
                    fill="none"
                    stroke="#FFCB05"
                    strokeWidth="6"
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                )}
                <path
                  d={mapGeometry.okinawaItem.d}
                  fill={getPrefFill('47')}
                  fillOpacity={
                    okinawaSummary ? (okinawaHovered ? 1 : 0.94) : okinawaHovered ? 0.96 : 0.88
                  }
                  stroke={
                    okinawaSelected || okinawaHovered
                      ? '#172038'
                      : okinawaSummary
                        ? '#FFFFFF'
                        : '#94A3B8'
                  }
                  strokeWidth={okinawaSelected ? 2.4 : okinawaHovered ? 1.8 : 1.1}
                  strokeLinejoin="round"
                  tabIndex={0}
                  role="button"
                  aria-label={`Okinawa prefecture${
                    okinawaSummary
                      ? `, ${okinawaSummary.nodes.length} active mascot${okinawaSummary.nodes.length > 1 ? 's' : ''}, lead ${okinawaSummary.leadNode.mascot.name_en}`
                      : ', no active outbreak'
                  }`}
                  className="cursor-pointer outline-none focus-visible:stroke-[#246BCE]"
                  onMouseEnter={() => setHoveredJis('47')}
                  onMouseLeave={() => setHoveredJis((cur) => (cur === '47' ? null : cur))}
                  onClick={() => {
                    if (dragStateRef.current.moved) return;
                    onSelectPrefecture('47');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPrefecture('47');
                    }
                  }}
                />

                {/* Okinawa newly infected radar pulse */}
                {okinawaSummary && okinawaSummary.infectedYear === currentYear && (
                  <g
                    transform={`translate(${mapGeometry.okinawaAnchor[0]}, ${mapGeometry.okinawaAnchor[1]})`}
                    pointerEvents="none"
                  >
                    <circle
                      r={11}
                      fill="none"
                      stroke="#FFCB05"
                      strokeWidth={3}
                      className="radar-pulse-ring"
                    />
                    <circle
                      r={7}
                      fill="none"
                      stroke={getPrefFill('47')}
                      strokeWidth={2}
                      className="radar-pulse-ring"
                    />
                  </g>
                )}
              </g>

              {/* Okinawa Inset Title */}
              <text
                x={INSET_X + 10}
                y={INSET_Y + 18}
                fill="#172038"
                fontSize="11"
                fontWeight="700"
                fontFamily="Fredoka, system-ui, sans-serif"
                pointerEvents="none"
              >
                Okinawa Inset
              </text>

              {/* Okinawa-jima Anchor Dot & Label */}
              {okinawaSummary && (
                <circle
                  cx={mapGeometry.okinawaAnchor[0]}
                  cy={mapGeometry.okinawaAnchor[1]}
                  r={okinawaSelected ? 4.8 : 3.2}
                  fill={okinawaSelected ? '#FFCB05' : '#FFFFFF'}
                  stroke="#172038"
                  strokeWidth="1.5"
                  pointerEvents="none"
                />
              )}
              {(okinawaSelected || okinawaHovered) && (
                <text
                  x={mapGeometry.okinawaAnchor[0]}
                  y={mapGeometry.okinawaAnchor[1] - 8}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="700"
                  fill="#172038"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  paintOrder="stroke"
                  pointerEvents="none"
                >
                  Okinawa
                </text>
              )}
            </g>
          )}

          {/* Top-level Okinawa-connected transmission arcs (bridge inset <-> zoomed mainland cleanly) */}
          {showArcs && okinawaArcs.length > 0 && (
            <g>{okinawaArcs.map((item) => renderArcElement(item, 1))}</g>
          )}
        </svg>

        {/* Top-Right Zoom Controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
          <button
            type="button"
            onClick={() => zoomBy(1.3)}
            aria-label="Zoom in map"
            title="Zoom in"
            className="w-8 h-8 rounded-lg bg-white text-[#172038] flex items-center justify-center ink-button cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1 / 1.3)}
            aria-label="Zoom out map"
            title="Zoom out"
            className="w-8 h-8 rounded-lg bg-white text-[#172038] flex items-center justify-center ink-button cursor-pointer"
          >
            <Minus className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset map view"
            title="Reset view"
            className="w-8 h-8 rounded-lg bg-[#FFCB05] text-[#172038] flex items-center justify-center ink-button cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Floating Hover Tooltip */}
        {hoveredFeature && (
          <div
            role="tooltip"
            style={tooltipStyle}
            className="pointer-events-none absolute z-30 w-[244px] rounded-xl bg-white border-2 border-[#172038] shadow-[3px_3px_0_#172038] px-3 py-2.5 text-xs"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-sm font-bold text-[#172038]">
                {hoveredFeature.properties.name_en}
              </span>
              <span className="text-[11px] font-medium text-[#4B556B]">
                {hoveredFeature.properties.region_en}
              </span>
            </div>

            {hoveredSummary ? (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <TraitIcon
                    trait={hoveredSummary.leadNode.mascot.dna.primary_trait}
                    size={28}
                    decorative
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-[#172038] truncate">
                      {hoveredSummary.leadNode.mascot.name_en}{' '}
                      <span className="font-semibold text-[#4B556B] tabular-nums">
                        ({hoveredSummary.leadNode.mascot.year})
                      </span>
                    </div>
                    <div className="text-[11px] text-[#4B556B] truncate">
                      {formatDnaCombo(
                        hoveredSummary.leadNode.mascot.dna.primary_trait,
                        hoveredSummary.leadNode.mascot.dna.secondary_traits
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#172038]/12">
                  <span
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md font-bold border border-[#172038]"
                    style={{
                      backgroundColor: MUTATION_META[hoveredSummary.leadNode.mutationType].softBg,
                      color: MUTATION_META[hoveredSummary.leadNode.mutationType].textColor,
                    }}
                  >
                    {MUTATION_META[hoveredSummary.leadNode.mutationType].label}
                  </span>
                  <span className="text-[11px] font-semibold text-[#172038] tabular-nums">
                    {hoveredSummary.leadNode.distanceKm !== null
                      ? `${hoveredSummary.leadNode.distanceKm} km · ${
                          hoveredSummary.leadNode.transmissionType === 'local'
                            ? 'Local neighbor'
                            : 'Long jump'
                        }`
                      : 'Patient Zero'}
                  </span>
                </div>

                {hoveredSummary.nodes.length > 1 && (
                  <div className="text-[11px] font-semibold text-[#246BCE]">
                    +{hoveredSummary.nodes.length - 1} more mascot
                    {hoveredSummary.nodes.length - 1 > 1 ? 's' : ''} in prefecture · click to inspect
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-[#4B556B]">
                No active outbreak in {currentYear}. Advance timeline or adjust filters.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Map Legend: Static below map on mobile (<sm) so Kyushu is never covered; absolute bottom-left overlay on sm+ */}
      <div className="bg-white/95 backdrop-blur-xs border-t-2 sm:border-2 border-[#172038] sm:rounded-xl px-3 py-2 sm:shadow-[2px_2px_0_#172038] text-[11px] sm:max-w-[300px] sm:absolute sm:bottom-3 sm:left-3 z-10">
        <div className="font-display font-bold text-[#172038] mb-1">
          {colorMode === 'mutation' ? 'Strain Classification' : 'Outbreak Generation'}
        </div>
        {colorMode === 'mutation' ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {(['patient_zero', 'pure_copy', 'hybrid', 'mutation'] as const).map((key) => {
              const meta = MUTATION_META[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-sm border border-[#172038] shrink-0"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="font-medium text-[#172038]">{meta.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            {GENERATION_SCALE.map((item) => (
              <div key={item.gen} className="flex items-center gap-1">
                <span
                  className="w-3 h-3 rounded-sm border border-[#172038] shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-medium text-[#172038]">{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {showArcs && (
          <div className="mt-1.5 pt-1.5 border-t border-[#172038]/15 flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="20" y2="3" stroke={MUTATION_META.pure_copy.color} strokeWidth="2.4" />
              </svg>
              <span>Pure copy</span>
            </div>
            {showMutations && (
              <>
                <div className="flex items-center gap-1.5">
                  <svg width="20" height="6" aria-hidden="true">
                    <line
                      x1="0"
                      y1="3"
                      x2="20"
                      y2="3"
                      stroke={MUTATION_META.hybrid.color}
                      strokeWidth="2.4"
                      strokeDasharray="5 3"
                    />
                  </svg>
                  <span>Hybrid</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg width="20" height="6" aria-hidden="true">
                    <line
                      x1="0"
                      y1="3"
                      x2="20"
                      y2="3"
                      stroke={MUTATION_META.mutation.color}
                      strokeWidth="2.4"
                      strokeDasharray="2 3"
                    />
                  </svg>
                  <span>Mutation</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
