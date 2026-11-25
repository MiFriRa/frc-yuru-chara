import React, { useMemo } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import type { PrefectureFeatureProperties } from '../types/mascot';
import { resolveSafeColor } from '../utils/theme';

interface PrefectureSilhouetteProps {
  feature?: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, PrefectureFeatureProperties>;
  primaryColor: string;
  accentColor: string;
  prefectureName: string;
  width?: number;
  height?: number;
}

export const PrefectureSilhouette: React.FC<PrefectureSilhouetteProps> = ({
  feature,
  primaryColor,
  accentColor,
  prefectureName,
  width = 210,
  height = 148,
}) => {
  const safePrimary = resolveSafeColor(primaryColor, '#246BCE');
  const safeAccent = resolveSafeColor(accentColor, '#FFCB05');

  const pathD = useMemo(() => {
    if (!feature) return null;
    const projection = geoMercator().fitExtent(
      [
        [18, 16],
        [width - 18, height - 16],
      ],
      feature
    );
    const generator = geoPath(projection);
    return generator(feature) || null;
  }, [feature, width, height]);

  const gradId = useMemo(
    () => `pref-grad-${prefectureName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    [prefectureName]
  );

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block max-w-full h-auto"
      role="img"
      aria-label={`${prefectureName} prefecture silhouette`}
    >
      <defs>
        <radialGradient id={gradId} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={safePrimary} stopOpacity="0.96" />
          <stop offset="100%" stopColor={safePrimary} stopOpacity="1" />
        </radialGradient>
      </defs>

      {pathD ? (
        <g>
          {/* Accent glow shadow behind the prefecture silhouette */}
          <path
            d={pathD}
            transform="translate(4, 4)"
            fill={safeAccent}
            opacity="0.45"
            stroke={safeAccent}
            strokeWidth="5"
            strokeLinejoin="round"
          />
          {/* Accent outer rim */}
          <path
            d={pathD}
            fill="none"
            stroke={safeAccent}
            strokeWidth="4.5"
            strokeLinejoin="round"
            opacity="0.88"
          />
          {/* Main sumi-outlined silhouette */}
          <path
            d={pathD}
            fill={`url(#${gradId})`}
            stroke="#172038"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          <circle
            cx={width / 2}
            cy={height / 2}
            r={Math.min(width, height) * 0.34}
            fill={safePrimary}
            stroke="#172038"
            strokeWidth="2.4"
          />
          <circle
            cx={width / 2}
            cy={height / 2}
            r={Math.min(width, height) * 0.42}
            fill="none"
            stroke={safeAccent}
            strokeWidth="3"
            strokeDasharray="6 4"
          />
        </g>
      )}
    </svg>
  );
};
