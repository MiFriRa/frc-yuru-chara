import type { MascotDomain, MutationType } from '../types/mascot';

export type MapColorMode = 'mutation' | 'generation';

export interface MutationVisualMeta {
  key: MutationType;
  label: string;
  shortLabel: string;
  color: string;
  softBg: string;
  borderColor: string;
  textColor: string;
  strokeDasharray?: string;
  description: string;
}

export const MUTATION_META: Record<MutationType, MutationVisualMeta> = {
  patient_zero: {
    key: 'patient_zero',
    label: 'Patient Zero',
    shortLabel: 'Origin',
    color: '#2563EB',
    softBg: '#DBEAFE',
    borderColor: '#1D4ED8',
    textColor: '#1E3A8A',
    description: 'Independent origin with no matching prior host in the transmission window.',
  },
  pure_copy: {
    key: 'pure_copy',
    label: 'Pure Copy',
    shortLabel: 'Pure Copy',
    color: '#E3350D',
    softBg: '#FEE2E2',
    borderColor: '#B91C1C',
    textColor: '#7F1D1D',
    strokeDasharray: undefined,
    description: 'Directly inherits the primary trait with no secondary trait fusion.',
  },
  hybrid: {
    key: 'hybrid',
    label: 'Hybrid',
    shortLabel: 'Hybrid',
    color: '#D97706',
    softBg: '#FEF3C7',
    borderColor: '#B45309',
    textColor: '#78350F',
    strokeDasharray: '7 5',
    description: 'Inherits the parent trait and fuses it with one or more local secondary traits.',
  },
  mutation: {
    key: 'mutation',
    label: 'Mutation',
    shortLabel: 'Mutation',
    color: '#7C3AED',
    softBg: '#EDE9FE',
    borderColor: '#6D28D9',
    textColor: '#4C1D95',
    strokeDasharray: '2 5',
    description: 'Shifts to a new primary trait within the same biological or thematic family.',
  },
};

export interface DomainVisualMeta {
  key: MascotDomain;
  label: string;
  shortLabel: string;
  color: string;
  softBg: string;
  inkText: string;
}

export const DOMAIN_META: Record<MascotDomain, DomainVisualMeta> = {
  Fauna: {
    key: 'Fauna',
    label: 'Fauna',
    shortLabel: 'Fauna',
    color: '#E3350D',
    softBg: '#FEE2E2',
    inkText: '#991B1B',
  },
  Flora_Food: {
    key: 'Flora_Food',
    label: 'Flora & Food',
    shortLabel: 'Flora/Food',
    color: '#16A34A',
    softBg: '#DCFCE7',
    inkText: '#14532D',
  },
  Lore_History: {
    key: 'Lore_History',
    label: 'Lore & History',
    shortLabel: 'Lore',
    color: '#7C3AED',
    softBg: '#EDE9FE',
    inkText: '#4C1D95',
  },
  Geo_Nature: {
    key: 'Geo_Nature',
    label: 'Geo & Nature',
    shortLabel: 'Geo',
    color: '#246BCE',
    softBg: '#DBEAFE',
    inkText: '#1E3A8A',
  },
  Object_Abstract: {
    key: 'Object_Abstract',
    label: 'Object & Abstract',
    shortLabel: 'Object',
    color: '#D97706',
    softBg: '#FEF3C7',
    inkText: '#78350F',
  },
};

export const DOMAIN_LIST: MascotDomain[] = [
  'Fauna',
  'Flora_Food',
  'Lore_History',
  'Geo_Nature',
  'Object_Abstract',
];

export const GENERATION_SCALE = [
  { gen: 1, label: 'Gen 1', color: '#246BCE' },
  { gen: 2, label: 'Gen 2', color: '#16A34A' },
  { gen: 3, label: 'Gen 3', color: '#EAB308' },
  { gen: 4, label: 'Gen 4', color: '#F97316' },
  { gen: 5, label: 'Gen 5+', color: '#DC2626' },
] as const;

export function getGenerationColor(generation: number): string {
  if (generation <= 1) return GENERATION_SCALE[0].color;
  if (generation === 2) return GENERATION_SCALE[1].color;
  if (generation === 3) return GENERATION_SCALE[2].color;
  if (generation === 4) return GENERATION_SCALE[3].color;
  return GENERATION_SCALE[4].color;
}

export interface ContagiousnessTier {
  label: string;
  color: string;
  softBg: string;
}

export function getContagiousnessTier(rValue: number): ContagiousnessTier {
  if (rValue >= 5) {
    return { label: 'Super-Spreader', color: '#B91C1C', softBg: '#FEE2E2' };
  }
  if (rValue >= 3) {
    return { label: 'Contagious', color: '#B45309', softBg: '#FEF3C7' };
  }
  if (rValue >= 1) {
    return { label: 'Spreading', color: '#15803D', softBg: '#DCFCE7' };
  }
  return { label: 'Isolated', color: '#475569', softBg: '#E2E8F0' };
}

export function formatTraitLabel(trait: string): string {
  if (!trait) return 'Unknown';
  return trait
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const NAMED_COLOR_MAP: Record<string, string> = {
  black: '#232733',
  white: '#F8FAFC',
  red: '#E3350D',
  crimson: '#DC2626',
  blue: '#246BCE',
  navy: '#1E3A8A',
  sky: '#38BDF8',
  cyan: '#06B6D4',
  green: '#16A34A',
  lime: '#65A30D',
  emerald: '#10B981',
  yellow: '#FACC15',
  gold: '#FFCB05',
  orange: '#F97316',
  amber: '#D97706',
  purple: '#7C3AED',
  violet: '#8B5CF6',
  pink: '#EC4899',
  magenta: '#DB2777',
  brown: '#92400E',
  tan: '#D6B08C',
  beige: '#E7D8B9',
  gray: '#64748B',
  grey: '#64748B',
  silver: '#CBD5E1',
  teal: '#0D9488',
  peach: '#FB923C',
};

export function resolveSafeColor(rawColor: string | undefined | null, fallback: string): string {
  if (!rawColor) return fallback;
  const trimmed = rawColor.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) {
    return trimmed;
  }
  const mapped = NAMED_COLOR_MAP[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return fallback;
}

export function formatDnaCombo(primaryTrait: string, secondaryTraits: string[]): string {
  const parts = [formatTraitLabel(primaryTrait), ...secondaryTraits.map(formatTraitLabel)];
  return parts.join(' + ');
}
