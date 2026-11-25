import React, { useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { EpidemicComputationResult, YearlyIncidence } from '../types/mascot';
import { MUTATION_META } from '../utils/theme';

export type PlaybackSpeed = 1 | 2 | 4;

interface EpidemicTimelineProps {
  yearlyIncidence: YearlyIncidence[];
  minYear: number;
  maxYear: number;
  currentYear: number;
  onChangeYear: (year: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: PlaybackSpeed;
  onChangeSpeed: (speed: PlaybackSpeed) => void;
  onReset: () => void;
  stats: EpidemicComputationResult['stats'];
}

const CHART_W = 1000;
const CHART_H = 104;
const PAD_L = 32;
const PAD_R = 14;
const PAD_T = 10;
const PAD_B = 22;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

export const EpidemicTimeline: React.FC<EpidemicTimelineProps> = ({
  yearlyIncidence,
  minYear,
  maxYear,
  currentYear,
  onChangeYear,
  isPlaying,
  onTogglePlay,
  speed,
  onChangeSpeed,
  onReset,
  stats,
}) => {
  const [hoveredYear, setHoveredYear] = useState<YearlyIncidence | null>(null);

  const maxCount = useMemo(() => {
    const peak = yearlyIncidence.reduce((acc, row) => Math.max(acc, row.total), 0);
    return Math.max(4, peak);
  }, [yearlyIncidence]);

  const barLayout = useMemo(() => {
    const count = Math.max(1, yearlyIncidence.length);
    const step = PLOT_W / count;
    const barW = Math.max(4, Math.min(28, step * 0.72));
    return yearlyIncidence.map((row, i) => {
      const cx = PAD_L + step * i + step / 2;
      const x = cx - barW / 2;
      const scaleY = (val: number) => (val / maxCount) * PLOT_H;

      const hPz = scaleY(row.patient_zero);
      const hPc = scaleY(row.pure_copy);
      const hHy = scaleY(row.hybrid);
      const hMu = scaleY(row.mutation);

      const yBase = PAD_T + PLOT_H;
      const yPz = yBase - hPz;
      const yPc = yPz - hPc;
      const yHy = yPc - hHy;
      const yMu = yHy - hMu;

      return {
        row,
        x,
        cx,
        barW,
        step,
        segments: [
          { key: 'patient_zero' as const, y: yPz, h: hPz, color: MUTATION_META.patient_zero.color },
          { key: 'pure_copy' as const, y: yPc, h: hPc, color: MUTATION_META.pure_copy.color },
          { key: 'hybrid' as const, y: yHy, h: hHy, color: MUTATION_META.hybrid.color },
          { key: 'mutation' as const, y: yMu, h: hMu, color: MUTATION_META.mutation.color },
        ],
      };
    });
  }, [yearlyIncidence, maxCount]);

  // Decide X-axis tick interval so labels never collide
  const tickEvery = useMemo(() => {
    const n = yearlyIncidence.length;
    if (n <= 12) return 1;
    if (n <= 24) return 2;
    if (n <= 40) return 4;
    return 5;
  }, [yearlyIncidence.length]);

  const currentBar = barLayout.find((b) => b.row.year === currentYear);
  const safeMin = minYear;
  const safeMax = Math.max(minYear, maxYear);

  return (
    <footer
      aria-label="Epidemic playback timeline and incidence curve"
      className="bg-white border-y-2 lg:border-b-0 border-[#172038] shadow-[0_-3px_0_rgba(23,32,56,0.08)] shrink-0 z-10"
    >
      <div className="max-w-[1680px] mx-auto px-3 sm:px-4 py-2.5 flex flex-col gap-2">
        {/* Top Row: Playback Controls + Big Year Readout + Live Outbreak Counters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            {/* Poké-Red Play / Pause Tactile Button */}
            <button
              type="button"
              onClick={onTogglePlay}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#E3350D] text-white font-display font-bold text-sm ink-button cursor-pointer min-w-[94px] justify-center"
              aria-label={isPlaying ? 'Pause outbreak playback' : 'Play outbreak playback'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Speed Selector */}
            <div
              role="group"
              aria-label="Playback speed"
              className="flex items-center rounded-lg border-2 border-[#172038] bg-[#F7F4EA] p-0.5 text-xs"
            >
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={speed === s}
                  onClick={() => onChangeSpeed(s)}
                  className={`px-2 py-1 rounded-md font-bold tabular-nums cursor-pointer transition-[background-color,color] duration-150 ${
                    speed === s ? 'bg-[#172038] text-[#FFCB05]' : 'text-[#172038] hover:bg-white/75'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Reset Button */}
            <button
              type="button"
              onClick={onReset}
              aria-label="Reset timeline to start year"
              title="Reset to start year"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F7F4EA] text-[#172038] text-xs font-bold ink-button cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {/* Large Tabular Year Readout */}
            <div className="ml-1 pl-3 border-l-2 border-[#172038]/15 flex items-baseline gap-1.5">
              <span
                className="font-display text-2xl sm:text-3xl font-bold text-[#172038] tabular-nums leading-none"
                aria-live="polite"
              >
                {currentYear}
              </span>
              <span className="text-xs font-semibold text-[#4B556B] tabular-nums hidden sm:inline">
                / {safeMax}
              </span>
            </div>
          </div>

          {/* Live Outbreak Counters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-lg bg-[#F7F4EA] border-2 border-[#172038] px-2.5 py-1 font-semibold text-[#172038] tabular-nums">
              <strong className="font-bold text-[#246BCE]">{stats.infectedPrefectures}</strong> / 47
              Prefectures
            </div>
            <div className="rounded-lg bg-[#F7F4EA] border-2 border-[#172038] px-2.5 py-1 font-semibold text-[#172038] tabular-nums">
              <strong className="font-bold text-[#E3350D]">{stats.totalMascots}</strong> Mascots
            </div>
            <div className="rounded-lg bg-[#FEF3C7] border-2 border-[#172038] px-2.5 py-1 font-semibold text-[#78350F] tabular-nums">
              <strong className="font-bold">{stats.hybrids}</strong> Hybrids
            </div>
            <div className="rounded-lg bg-[#EDE9FE] border-2 border-[#172038] px-2.5 py-1 font-semibold text-[#4C1D95] tabular-nums">
              <strong className="font-bold">{stats.mutations}</strong> Mutations
            </div>
          </div>
        </div>

        {/* Middle Row: Native Accessible Year Range Slider */}
        <div className="flex items-center gap-3">
          <label htmlFor="yuru-year-slider" className="sr-only">
            Timeline year
          </label>
          <span className="text-[11px] font-bold text-[#4B556B] tabular-nums w-9">{safeMin}</span>
          <input
            id="yuru-year-slider"
            type="range"
            min={safeMin}
            max={safeMax}
            step={1}
            value={Math.min(safeMax, Math.max(safeMin, currentYear))}
            onChange={(e) => onChangeYear(Number(e.target.value))}
            style={
              {
                '--attr-min': safeMin,
                '--attr-max': safeMax,
                '--control-value': Math.min(safeMax, Math.max(safeMin, currentYear)),
              } as React.CSSProperties
            }
            className="yuru-range flex-1"
            aria-valuetext={`Year ${currentYear}`}
          />
          <span className="text-[11px] font-bold text-[#4B556B] tabular-nums w-9 text-right">
            {safeMax}
          </span>
        </div>

        {/* Bottom Row: Interactive Stacked Bar Chart (Epidemic Incidence Curve) */}
        <div className="relative rounded-xl border-2 border-[#172038] bg-[#FAF8F2] px-2 pt-1 pb-0.5">
          {hoveredYear && (
            <div
              role="status"
              className="pointer-events-none absolute -top-9 right-2 z-20 rounded-lg bg-[#172038] text-white px-2.5 py-1 text-[11px] font-semibold shadow-md flex items-center gap-2.5 tabular-nums"
            >
              <span className="font-display text-[#FFCB05] text-xs">{hoveredYear.year}</span>
              <span>Total: {hoveredYear.total}</span>
              <span className="text-[#93C5FD]">Origin: {hoveredYear.patient_zero}</span>
              <span className="text-[#FCA5A5]">Copy: {hoveredYear.pure_copy}</span>
              <span className="text-[#FCD34D]">Hybrid: {hoveredYear.hybrid}</span>
              <span className="text-[#C4B5FD]">Mut: {hoveredYear.mutation}</span>
            </div>
          )}

          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="none"
            className="w-full h-[88px] sm:h-[98px] block"
            role="img"
            aria-label="Stacked bar chart of new mascots per year colored by mutation type"
            onMouseLeave={() => setHoveredYear(null)}
          >
            {/* Horizontal dashed gridlines */}
            {[0.25, 0.5, 0.75, 1].map((frac) => {
              const y = PAD_T + PLOT_H * (1 - frac);
              const val = Math.round(maxCount * frac);
              return (
                <g key={frac}>
                  <line
                    x1={PAD_L}
                    x2={CHART_W - PAD_R}
                    y1={y}
                    y2={y}
                    stroke="#172038"
                    strokeOpacity={0.12}
                    strokeDasharray="3 4"
                  />
                  {(frac === 0.5 || frac === 1) && (
                    <text
                      x={PAD_L - 6}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill="#4B556B"
                    >
                      {val}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={PAD_L}
              x2={CHART_W - PAD_R}
              y1={PAD_T + PLOT_H}
              y2={PAD_T + PLOT_H}
              stroke="#172038"
              strokeWidth="1.4"
            />

            {/* Stacked Bars */}
            {barLayout.map(({ row, x, cx, barW, step, segments }, idx) => {
              const isFuture = row.year > currentYear;
              const isCurrent = row.year === currentYear;
              const isHovered = hoveredYear?.year === row.year;
              const showTick =
                idx === 0 || idx === barLayout.length - 1 || idx % tickEvery === 0;

              return (
                <g
                  key={row.year}
                  className="cursor-pointer"
                  onClick={() => onChangeYear(row.year)}
                  onMouseEnter={() => setHoveredYear(row)}
                >
                  {/* Full-column click hit area */}
                  <rect
                    x={cx - step / 2}
                    y={PAD_T}
                    width={step}
                    height={PLOT_H + PAD_B}
                    fill={isHovered ? 'rgba(255, 203, 5, 0.22)' : 'transparent'}
                  />

                  <g opacity={isFuture ? 0.32 : 1}>
                    {segments.map((seg) =>
                      seg.h > 0 ? (
                        <rect
                          key={seg.key}
                          x={x}
                          y={seg.y}
                          width={barW}
                          height={seg.h}
                          fill={seg.color}
                          stroke={isCurrent ? '#172038' : 'none'}
                          strokeWidth={isCurrent ? 0.9 : 0}
                        />
                      ) : null
                    )}
                  </g>

                  {showTick && (
                    <text
                      x={cx}
                      y={CHART_H - 5}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight={isCurrent ? '700' : '600'}
                      fill={isCurrent ? '#E3350D' : '#4B556B'}
                    >
                      {row.year}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Playhead Marker at currentYear */}
            {currentBar && (
              <g pointerEvents="none">
                <line
                  x1={currentBar.cx}
                  x2={currentBar.cx}
                  y1={PAD_T - 3}
                  y2={PAD_T + PLOT_H}
                  stroke="#172038"
                  strokeWidth="2.2"
                />
                <polygon
                  points={`${currentBar.cx - 5.5},${PAD_T - 7} ${currentBar.cx + 5.5},${PAD_T - 7} ${currentBar.cx},${PAD_T}`}
                  fill="#E3350D"
                  stroke="#172038"
                  strokeWidth="1.2"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </footer>
  );
};
