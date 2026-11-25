export type MascotDomain =
  | 'Fauna'
  | 'Flora_Food'
  | 'Lore_History'
  | 'Geo_Nature'
  | 'Object_Abstract';

export type YearType = 'debut' | 'first_observed';

export interface MascotDNA {
  domain: MascotDomain;
  primary_trait: string;
  secondary_traits: string[];
  trait_family: string;
  primary_color: string;
  accent_color: string;
  is_hybrid: boolean;
}

export interface MascotRecord {
  id: string;
  name_en: string;
  name_jp: string | null;
  jis_code: string; // "01".."47"
  prefecture_en: string;
  municipality_en: string | null;
  year: number;
  year_type: YearType;
  bio_en?: string;
  dna: MascotDNA;
}

export interface PrefectureAdjacencyEntry {
  jis_code: string;
  name_en: string;
  name_jp: string;
  region_en: string;
  neighbors: string[]; // Array of adjacent jis_code strings
  centroid: [number, number]; // [lat, lng]
}

export type PrefectureAdjacencyMap = Record<string, PrefectureAdjacencyEntry>;

export type TransmissionType = 'origin' | 'local' | 'long_distance';

export type MutationType = 'patient_zero' | 'pure_copy' | 'hybrid' | 'mutation';

export interface ComputedMascotNode {
  mascot: MascotRecord;
  parentId: string | null;
  childrenIds: string[];
  transmissionType: TransmissionType;
  mutationType: MutationType;
  distanceKm: number | null;
  rValue: number;
  generation: number;
}

export interface TransmissionArc {
  id: string;
  sourceId: string;
  targetId: string;
  sourceJis: string;
  targetJis: string;
  sourceCentroid: [number, number]; // [lat, lng]
  targetCentroid: [number, number]; // [lat, lng]
  year: number;
  transmissionType: Exclude<TransmissionType, 'origin'>;
  mutationType: Exclude<MutationType, 'patient_zero'>;
  distanceKm: number;
}

export interface YearlyIncidence {
  year: number;
  total: number;
  patient_zero: number;
  pure_copy: number;
  hybrid: number;
  mutation: number;
}

export interface EpidemicFilter {
  domain: MascotDomain | 'ALL';
  primaryTrait: string | 'ALL';
  windowYears: number; // 1..10, default 5
  confirmedDebutOnly: boolean;
  maxYear: number;
}

export interface EpidemicComputationResult {
  nodesById: Record<string, ComputedMascotNode>;
  orderedNodes: ComputedMascotNode[];
  activeNodes: ComputedMascotNode[]; // nodes with year <= maxYear
  arcs: TransmissionArc[]; // arcs with year <= maxYear
  allArcs: TransmissionArc[]; // all arcs across full timeline
  yearlyIncidence: YearlyIncidence[];
  minYear: number;
  maxYear: number;
  prefectureSummary: Record<
    string,
    {
      jisCode: string;
      nodes: ComputedMascotNode[];
      leadNode: ComputedMascotNode;
      highestGeneration: number;
      dominantMutation: MutationType;
      infectedYear: number;
    }
  >;
  stats: {
    totalMascots: number;
    infectedPrefectures: number;
    patientZeros: number;
    pureCopies: number;
    hybrids: number;
    mutations: number;
    avgR: number;
    superSpreaderId: string | null;
  };
}

export interface PrefectureFeatureProperties {
  jis_code: string;
  name_en: string;
  name_jp: string;
  region_en: string;
}

export type JapanGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  PrefectureFeatureProperties
>;
