import { describe, expect, it } from 'vitest';
import type {
  EpidemicFilter,
  MascotRecord,
  PrefectureAdjacencyMap,
} from '../../types/mascot';
import { computeEpidemic, getAvailableTraits } from '../epidemic';
import { haversineKm } from '../haversine';
import { OUTBREAK_PRESETS } from '../presets';
import { validateMascotRecords } from '../schema';

const TEST_ADJACENCY: PrefectureAdjacencyMap = {
  '13': {
    jis_code: '13',
    name_en: 'Tokyo',
    name_jp: '東京都',
    region_en: 'Kanto',
    neighbors: ['11', '12', '14', '19'],
    centroid: [35.6762, 139.6503],
  },
  '27': {
    jis_code: '27',
    name_en: 'Osaka',
    name_jp: '大阪府',
    region_en: 'Kansai',
    neighbors: ['26', '28', '29', '30'],
    centroid: [34.6937, 135.5023],
  },
  '40': {
    jis_code: '40',
    name_en: 'Fukuoka',
    name_jp: '福岡県',
    region_en: 'Kyushu',
    neighbors: ['35', '41', '43', '44'],
    centroid: [33.5904, 130.4017],
  },
  '41': {
    jis_code: '41',
    name_en: 'Saga',
    name_jp: '佐賀県',
    region_en: 'Kyushu',
    neighbors: ['40', '42'],
    centroid: [33.2635, 130.3009],
  },
  '42': {
    jis_code: '42',
    name_en: 'Nagasaki',
    name_jp: '長崎県',
    region_en: 'Kyushu',
    neighbors: ['41'],
    centroid: [32.7503, 129.8777],
  },
  '43': {
    jis_code: '43',
    name_en: 'Kumamoto',
    name_jp: '熊本県',
    region_en: 'Kyushu',
    neighbors: ['40', '44', '45', '46'],
    centroid: [32.7898, 130.7417],
  },
  '44': {
    jis_code: '44',
    name_en: 'Oita',
    name_jp: '大分県',
    region_en: 'Kyushu',
    neighbors: ['40', '43', '45'],
    centroid: [33.2382, 131.6126],
  },
  '46': {
    jis_code: '46',
    name_en: 'Kagoshima',
    name_jp: '鹿児島県',
    region_en: 'Kyushu',
    neighbors: ['43', '45', '47'],
    centroid: [31.5966, 130.5571],
  },
};

function makeMascot(
  overrides: Omit<Partial<MascotRecord>, 'dna'> & {
    id: string;
    jis_code: string;
    year: number;
    dna: Partial<MascotRecord['dna']>;
  }
): MascotRecord {
  const secondaryTraits = overrides.dna.secondary_traits ?? [];
  return {
    id: overrides.id,
    name_en: overrides.name_en ?? overrides.id,
    name_jp: overrides.name_jp ?? null,
    jis_code: overrides.jis_code,
    prefecture_en:
      overrides.prefecture_en ??
      TEST_ADJACENCY[overrides.jis_code]?.name_en ??
      'Unknown',
    municipality_en: overrides.municipality_en ?? null,
    year: overrides.year,
    year_type: overrides.year_type ?? 'debut',
    bio_en: overrides.bio_en,
    dna: {
      domain: overrides.dna.domain ?? 'Fauna',
      primary_trait: overrides.dna.primary_trait ?? 'bear',
      secondary_traits: secondaryTraits,
      trait_family: overrides.dna.trait_family ?? 'mammal',
      primary_color: overrides.dna.primary_color ?? '#1F2937',
      accent_color: overrides.dna.accent_color ?? '#E3350D',
      is_hybrid: overrides.dna.is_hybrid ?? secondaryTraits.length > 0,
    },
  };
}

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm([35.6762, 139.6503], [35.6762, 139.6503])).toBe(0);
  });

  it('computes accurate Tokyo-to-Osaka and Kumamoto-to-Fukuoka distances', () => {
    const tokyoToOsaka = haversineKm(
      TEST_ADJACENCY['13'].centroid,
      TEST_ADJACENCY['27'].centroid
    );
    expect(tokyoToOsaka).toBeGreaterThan(390);
    expect(tokyoToOsaka).toBeLessThan(405);

    const kumamotoToFukuoka = haversineKm(
      TEST_ADJACENCY['43'].centroid,
      TEST_ADJACENCY['40'].centroid
    );
    expect(kumamotoToFukuoka).toBeGreaterThan(90);
    expect(kumamotoToFukuoka).toBeLessThan(100);
  });
});

describe('computeEpidemic — PRD §6.3 golden test', () => {
  const kumamotoBear = makeMascot({
    id: 'kumamon-43',
    name_en: 'Kumamon',
    name_jp: 'くまモン',
    jis_code: '43',
    year: 2010,
    dna: {
      domain: 'Fauna',
      primary_trait: 'bear',
      secondary_traits: [],
      trait_family: 'mammal',
      is_hybrid: false,
    },
  });

  const fukuokaRaccoon = makeMascot({
    id: 'fukuoka-raccoon-40',
    name_en: 'Fukuoka Tanuki',
    jis_code: '40',
    year: 2015,
    dna: {
      domain: 'Fauna',
      primary_trait: 'raccoon',
      secondary_traits: [],
      trait_family: 'mammal',
      is_hybrid: false,
    },
  });

  it('links Kumamoto (2010, bear) as Parent with mutationType "mutation" to Fukuoka (2015, raccoon) when windowYears = 5', () => {
    const filter: EpidemicFilter = {
      domain: 'Fauna',
      primaryTrait: 'bear',
      windowYears: 5,
      confirmedDebutOnly: false,
      maxYear: 2020,
    };

    const result = computeEpidemic(
      [fukuokaRaccoon, kumamotoBear], // intentionally unsorted input
      TEST_ADJACENCY,
      filter
    );

    const parentNode = result.nodesById['kumamon-43'];
    const childNode = result.nodesById['fukuoka-raccoon-40'];

    expect(parentNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(parentNode.parentId).toBeNull();
    expect(parentNode.mutationType).toBe('patient_zero');
    expect(parentNode.generation).toBe(1);
    expect(parentNode.rValue).toBe(1);
    expect(parentNode.childrenIds).toEqual(['fukuoka-raccoon-40']);

    expect(childNode.parentId).toBe('kumamon-43');
    expect(childNode.mutationType).toBe('mutation');
    expect(childNode.transmissionType).toBe('local');
    expect(childNode.generation).toBe(2);
    expect(childNode.distanceKm).toBe(
      Math.round(
        haversineKm(TEST_ADJACENCY['43'].centroid, TEST_ADJACENCY['40'].centroid)
      )
    );
    expect(result.arcs).toHaveLength(1);
    expect(result.arcs[0].mutationType).toBe('mutation');
  });

  it('does NOT link Kumamoto (2010) to Fukuoka (2015) when windowYears = 3; Fukuoka becomes patient_zero', () => {
    const filter: EpidemicFilter = {
      domain: 'Fauna',
      primaryTrait: 'bear',
      windowYears: 3,
      confirmedDebutOnly: false,
      maxYear: 2020,
    };

    const result = computeEpidemic(
      [kumamotoBear, fukuokaRaccoon],
      TEST_ADJACENCY,
      filter
    );

    const parentNode = result.nodesById['kumamon-43'];
    const fukuokaNode = result.nodesById['fukuoka-raccoon-40'];

    expect(parentNode.rValue).toBe(0);
    expect(fukuokaNode.parentId).toBeNull();
    expect(fukuokaNode.mutationType).toBe('patient_zero');
    expect(fukuokaNode.transmissionType).toBe('origin');
    expect(fukuokaNode.generation).toBe(1);
    expect(fukuokaNode.distanceKm).toBeNull();
    expect(result.arcs).toHaveLength(0);
  });
});

describe('computeEpidemic — mutation types, topology, playback, and filters', () => {
  it('classifies pure_copy and hybrid (bear + apple inheriting from bear) accurately', () => {
    const originBear = makeMascot({
      id: 'bear-origin-43',
      jis_code: '43',
      year: 2010,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const pureCopyBear = makeMascot({
      id: 'bear-copy-40',
      jis_code: '40',
      year: 2011,
      dna: { primary_trait: 'bear', trait_family: 'mammal', is_hybrid: false },
    });
    const bearAppleHybrid = makeMascot({
      id: 'bear-apple-44',
      jis_code: '44',
      year: 2012,
      dna: {
        primary_trait: 'bear',
        secondary_traits: ['apple'],
        trait_family: 'mammal',
        is_hybrid: true,
      },
    });
    const appleBearHybrid = makeMascot({
      id: 'apple-bear-46',
      jis_code: '46',
      year: 2013,
      dna: {
        domain: 'Flora_Food',
        primary_trait: 'apple',
        secondary_traits: ['bear'],
        trait_family: 'fruit',
        is_hybrid: true,
      },
    });

    const result = computeEpidemic(
      [originBear, pureCopyBear, bearAppleHybrid, appleBearHybrid],
      TEST_ADJACENCY,
      {
        domain: 'ALL',
        primaryTrait: 'bear',
        windowYears: 5,
        confirmedDebutOnly: false,
        maxYear: 2020,
      }
    );

    expect(result.nodesById['bear-copy-40'].mutationType).toBe('pure_copy');
    expect(result.nodesById['bear-apple-44'].mutationType).toBe('hybrid');
    expect(result.nodesById['apple-bear-46'].mutationType).toBe('hybrid');
    expect(result.nodesById['apple-bear-46'].parentId).toBe('bear-origin-43');
    expect(result.stats.pureCopies).toBe(1);
    expect(result.stats.hybrids).toBe(2);
    expect(result.stats.patientZeros).toBe(1);
  });

  it('prioritizes direct geographic neighbors over closer or equal non-neighbors', () => {
    // Saga (41) borders Fukuoka (40) and Nagasaki (42), NOT Kumamoto (43).
    // Even if Kumamoto is geographically closer to Saga than a slightly farther neighbor,
    // or if we compare Nagasaki (direct neighbor of Saga, ~69km) vs Kumamoto (non-neighbor of Saga, ~66km),
    // Saga must pick its direct neighbor Nagasaki!
    const distKumamotoToSaga = haversineKm(
      TEST_ADJACENCY['43'].centroid,
      TEST_ADJACENCY['41'].centroid
    );
    const distNagasakiToSaga = haversineKm(
      TEST_ADJACENCY['42'].centroid,
      TEST_ADJACENCY['41'].centroid
    );
    expect(distKumamotoToSaga).toBeLessThan(distNagasakiToSaga);

    const kumamotoNonNeighbor = makeMascot({
      id: 'bear-kumamoto',
      jis_code: '43',
      year: 2010,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const nagasakiNeighbor = makeMascot({
      id: 'bear-nagasaki',
      jis_code: '42',
      year: 2010,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const sagaTarget = makeMascot({
      id: 'bear-saga',
      jis_code: '41',
      year: 2012,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });

    const result = computeEpidemic(
      [kumamotoNonNeighbor, nagasakiNeighbor, sagaTarget],
      TEST_ADJACENCY,
      {
        domain: 'Fauna',
        primaryTrait: 'ALL',
        windowYears: 5,
        confirmedDebutOnly: false,
        maxYear: 2020,
      }
    );

    const sagaNode = result.nodesById['bear-saga'];
    expect(sagaNode.parentId).toBe('bear-nagasaki');
    expect(sagaNode.transmissionType).toBe('local');
  });

  it('tracks generation depth (Gen 1 -> Gen 2 -> Gen 3), playback rValue growth, and continuous yearlyIncidence', () => {
    // Chain: Kumamoto (2008) -> Fukuoka (2012) -> Saga (2016)
    // Window = 4 ensures Saga (2016) can only link to Fukuoka (2012), not Kumamoto (2008).
    const gen1 = makeMascot({
      id: 'g1-kumamoto',
      jis_code: '43',
      year: 2008,
      dna: { primary_trait: 'cat', trait_family: 'mammal' },
    });
    const gen2 = makeMascot({
      id: 'g2-fukuoka',
      jis_code: '40',
      year: 2012,
      dna: { primary_trait: 'cat', trait_family: 'mammal' },
    });
    const gen3 = makeMascot({
      id: 'g3-saga',
      jis_code: '41',
      year: 2016,
      dna: { primary_trait: 'cat', trait_family: 'mammal' },
    });

    // Mid-playback snapshot at maxYear = 2012
    const midResult = computeEpidemic([gen1, gen2, gen3], TEST_ADJACENCY, {
      domain: 'Fauna',
      primaryTrait: 'cat',
      windowYears: 4,
      confirmedDebutOnly: false,
      maxYear: 2012,
    });

    expect(midResult.activeNodes).toHaveLength(2);
    expect(midResult.nodesById['g1-kumamoto'].generation).toBe(1);
    expect(midResult.nodesById['g2-fukuoka'].generation).toBe(2);
    expect(midResult.nodesById['g3-saga'].generation).toBe(3);

    // At 2012, g2-fukuoka has not yet infected g3-saga, so rValue = 0
    expect(midResult.nodesById['g1-kumamoto'].rValue).toBe(1);
    expect(midResult.nodesById['g2-fukuoka'].rValue).toBe(0);
    expect(midResult.arcs).toHaveLength(1);
    expect(midResult.allArcs).toHaveLength(2);

    // yearlyIncidence spans full 2008..2016 (9 consecutive years) even while maxYear = 2012
    expect(midResult.minYear).toBe(2008);
    expect(midResult.maxYear).toBe(2016);
    expect(midResult.yearlyIncidence).toHaveLength(9);
    expect(midResult.yearlyIncidence.map((y) => y.year)).toEqual([
      2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016,
    ]);
    expect(midResult.yearlyIncidence[1].total).toBe(0); // 2009 gap year present with 0

    // Full playback at maxYear = 2016
    const fullResult = computeEpidemic([gen1, gen2, gen3], TEST_ADJACENCY, {
      domain: 'Fauna',
      primaryTrait: 'cat',
      windowYears: 4,
      confirmedDebutOnly: false,
      maxYear: 2016,
    });

    expect(fullResult.activeNodes).toHaveLength(3);
    expect(fullResult.nodesById['g2-fukuoka'].rValue).toBe(1);
    expect(fullResult.nodesById['g2-fukuoka'].childrenIds).toEqual(['g3-saga']);
    expect(fullResult.stats.infectedPrefectures).toBe(3);
    expect(fullResult.stats.avgR).toBeCloseTo(2 / 3, 5);
    expect(fullResult.stats.superSpreaderId).toBe('g1-kumamoto');
  });

  it('respects confirmedDebutOnly filter and computes long_distance arcs when non-neighbor is the only parent', () => {
    const confirmedOrigin = makeMascot({
      id: 'tokyo-bear',
      jis_code: '13',
      year: 2010,
      year_type: 'debut',
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const observedOnly = makeMascot({
      id: 'osaka-bear-observed',
      jis_code: '27',
      year: 2011,
      year_type: 'first_observed',
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const confirmedChild = makeMascot({
      id: 'fukuoka-bear-debut',
      jis_code: '40',
      year: 2012,
      year_type: 'debut',
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });

    const debutOnly = computeEpidemic(
      [confirmedOrigin, observedOnly, confirmedChild],
      TEST_ADJACENCY,
      {
        domain: 'ALL',
        primaryTrait: 'ALL',
        windowYears: 5,
        confirmedDebutOnly: true,
        maxYear: 2020,
      }
    );

    expect(debutOnly.orderedNodes).toHaveLength(2);
    expect(debutOnly.nodesById['osaka-bear-observed']).toBeUndefined();
    expect(debutOnly.nodesById['fukuoka-bear-debut'].parentId).toBe('tokyo-bear');
    expect(debutOnly.nodesById['fukuoka-bear-debut'].transmissionType).toBe(
      'long_distance'
    );
  });

  it('links same-prefecture mascots locally with 0 km distance, omits self-arcs, and selects leadNode by highest rValue', () => {
    const first = makeMascot({
      id: 'kuma-a',
      jis_code: '43',
      year: 2010,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const secondSamePref = makeMascot({
      id: 'kuma-b',
      jis_code: '43',
      year: 2011,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });
    const thirdFukuoka = makeMascot({
      id: 'fukuoka-c',
      jis_code: '40',
      year: 2012,
      dna: { primary_trait: 'bear', trait_family: 'mammal' },
    });

    const res = computeEpidemic([first, secondSamePref, thirdFukuoka], TEST_ADJACENCY, {
      domain: 'Fauna',
      primaryTrait: 'bear',
      windowYears: 5,
      confirmedDebutOnly: false,
      maxYear: 2020,
    });

    // kuma-b links locally to kuma-a (distance 0, no self-loop arc)
    expect(res.nodesById['kuma-b'].parentId).toBe('kuma-a');
    expect(res.nodesById['kuma-b'].transmissionType).toBe('local');
    expect(res.nodesById['kuma-b'].distanceKm).toBe(0);

    // fukuoka-c picks kuma-b over kuma-a (same distance, same neighbor, exact primary, more recent year 2011 > 2010)
    expect(res.nodesById['fukuoka-c'].parentId).toBe('kuma-b');
    expect(res.arcs).toHaveLength(1);
    expect(res.arcs[0].sourceId).toBe('kuma-b');
    expect(res.arcs[0].targetId).toBe('fukuoka-c');

    // Both kuma-a and kuma-b have rValue = 1; tie-break by earliest year -> kuma-a is leadNode
    expect(res.prefectureSummary['43'].leadNode.mascot.id).toBe('kuma-a');
    expect(res.prefectureSummary['43'].infectedYear).toBe(2010);
    expect(res.prefectureSummary['43'].highestGeneration).toBe(2);
  });

  it('handles empty inputs gracefully', () => {
    const res = computeEpidemic([], TEST_ADJACENCY, {
      domain: 'ALL',
      primaryTrait: 'ALL',
      windowYears: 5,
      confirmedDebutOnly: false,
      maxYear: 2025,
    });

    expect(res.orderedNodes).toEqual([]);
    expect(res.activeNodes).toEqual([]);
    expect(res.arcs).toEqual([]);
    expect(res.allArcs).toEqual([]);
    expect(res.yearlyIncidence).toEqual([]);
    expect(res.stats).toEqual({
      totalMascots: 0,
      infectedPrefectures: 0,
      patientZeros: 0,
      pureCopies: 0,
      hybrids: 0,
      mutations: 0,
      avgR: 0,
      superSpreaderId: null,
    });
  });
});

describe('getAvailableTraits, presets, and schema validation', () => {
  it('lists available traits sorted by count DESC then trait ASC', () => {
    const list = [
      makeMascot({
        id: 'm1',
        jis_code: '13',
        year: 2010,
        dna: { domain: 'Fauna', primary_trait: 'cat', trait_family: 'mammal' },
      }),
      makeMascot({
        id: 'm2',
        jis_code: '27',
        year: 2011,
        dna: { domain: 'Fauna', primary_trait: 'bear', trait_family: 'mammal' },
      }),
      makeMascot({
        id: 'm3',
        jis_code: '43',
        year: 2012,
        dna: { domain: 'Fauna', primary_trait: 'bear', trait_family: 'mammal' },
      }),
      makeMascot({
        id: 'm4',
        jis_code: '40',
        year: 2013,
        dna: {
          domain: 'Flora_Food',
          primary_trait: 'apple',
          trait_family: 'fruit',
        },
      }),
    ];

    expect(getAvailableTraits(list, 'Fauna')).toEqual([
      { trait: 'bear', count: 2, domain: 'Fauna', family: 'mammal' },
      { trait: 'cat', count: 1, domain: 'Fauna', family: 'mammal' },
    ]);

    expect(getAvailableTraits(list, 'ALL').map((t) => t.trait)).toEqual([
      'bear',
      'apple',
      'cat',
    ]);
  });

  it('exports all 6 outbreak presets with expected ids', () => {
    expect(OUTBREAK_PRESETS.map((p) => p.id)).toEqual([
      'all-wave',
      'bear-fever',
      'cat-fever',
      'fruit-hybrids',
      'lore-yokai',
      'bird-flock',
    ]);
  });

  it('validates well-formed mascot records and catches invalid JIS codes, duplicates, and hybrid mismatches', () => {
    const validRecord = makeMascot({
      id: 'kumamon-43',
      name_en: 'Kumamon',
      name_jp: 'くまモン',
      jis_code: '43',
      year: 2010,
      dna: {
        domain: 'Fauna',
        primary_trait: 'bear',
        secondary_traits: [],
        trait_family: 'mammal',
        is_hybrid: false,
      },
    });

    expect(validateMascotRecords([validRecord])).toEqual({
      valid: true,
      errors: [],
    });

    const invalidRecord = {
      ...validRecord,
      jis_code: '99',
      dna: {
        ...validRecord.dna,
        secondary_traits: ['apple'],
        is_hybrid: false,
      },
    };

    const res = validateMascotRecords([validRecord, invalidRecord]);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(res.errors.some((e) => e.includes('jis_code'))).toBe(true);
    expect(res.errors.some((e) => e.includes('is_hybrid'))).toBe(true);
  });
});
