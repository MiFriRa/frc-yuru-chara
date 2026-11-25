import type {
  ComputedMascotNode,
  EpidemicComputationResult,
  EpidemicFilter,
  MascotDomain,
  MascotRecord,
  MutationType,
  PrefectureAdjacencyMap,
  TransmissionArc,
  TransmissionType,
  YearlyIncidence,
} from '../types/mascot';
import { haversineKm } from './haversine';

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sharesGeneticLink(parent: MascotRecord, child: MascotRecord): boolean {
  const pDna = parent.dna;
  const cDna = child.dna;

  if (pDna.primary_trait === cDna.primary_trait) {
    return true;
  }

  if (pDna.trait_family === cDna.trait_family) {
    return true;
  }

  if (cDna.secondary_traits.includes(pDna.primary_trait)) {
    return true;
  }

  if (pDna.secondary_traits.includes(cDna.primary_trait)) {
    return true;
  }

  for (const trait of cDna.secondary_traits) {
    if (pDna.secondary_traits.includes(trait)) {
      return true;
    }
  }

  return false;
}

function isDirectNeighborOrSamePref(
  childJis: string,
  parentJis: string,
  adjacency: PrefectureAdjacencyMap
): boolean {
  if (parentJis === childJis) {
    return true;
  }
  const entry = adjacency[childJis];
  return Boolean(entry && entry.neighbors.includes(parentJis));
}

function compareLeadCandidates(a: ComputedMascotNode, b: ComputedMascotNode): number {
  if (b.rValue !== a.rValue) {
    return b.rValue - a.rValue;
  }
  if (a.mascot.year !== b.mascot.year) {
    return a.mascot.year - b.mascot.year;
  }
  return compareStrings(a.mascot.id, b.mascot.id);
}

/**
 * Returns all distinct primary traits present in the given mascot list (filtered by domain),
 * sorted deterministically by frequency descending, then trait name ascending.
 */
export function getAvailableTraits(
  mascots: MascotRecord[],
  domain: MascotDomain | 'ALL'
): Array<{ trait: string; count: number; domain: MascotDomain; family: string }> {
  const traitBuckets = new Map<
    string,
    {
      count: number;
      domainCounts: Map<MascotDomain, number>;
      familyCounts: Map<string, number>;
    }
  >();

  for (const mascot of mascots) {
    if (domain !== 'ALL' && mascot.dna.domain !== domain) {
      continue;
    }

    const trait = mascot.dna.primary_trait;
    let bucket = traitBuckets.get(trait);
    if (!bucket) {
      bucket = {
        count: 0,
        domainCounts: new Map<MascotDomain, number>(),
        familyCounts: new Map<string, number>(),
      };
      traitBuckets.set(trait, bucket);
    }

    bucket.count += 1;
    bucket.domainCounts.set(
      mascot.dna.domain,
      (bucket.domainCounts.get(mascot.dna.domain) ?? 0) + 1
    );
    bucket.familyCounts.set(
      mascot.dna.trait_family,
      (bucket.familyCounts.get(mascot.dna.trait_family) ?? 0) + 1
    );
  }

  const results: Array<{
    trait: string;
    count: number;
    domain: MascotDomain;
    family: string;
  }> = [];

  for (const [trait, bucket] of traitBuckets.entries()) {
    let bestDomain: MascotDomain = 'Fauna';
    let bestDomainCount = -1;
    for (const [d, c] of bucket.domainCounts.entries()) {
      if (
        c > bestDomainCount ||
        (c === bestDomainCount && compareStrings(d, bestDomain) < 0)
      ) {
        bestDomain = d;
        bestDomainCount = c;
      }
    }

    let bestFamily = '';
    let bestFamilyCount = -1;
    for (const [f, c] of bucket.familyCounts.entries()) {
      if (
        c > bestFamilyCount ||
        (c === bestFamilyCount && compareStrings(f, bestFamily) < 0)
      ) {
        bestFamily = f;
        bestFamilyCount = c;
      }
    }

    results.push({
      trait,
      count: bucket.count,
      domain: bestDomain,
      family: bestFamily,
    });
  }

  results.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return compareStrings(a.trait, b.trait);
  });

  return results;
}

/**
 * Deterministic client-side epidemiological calculation engine for Yuru-Dex.
 */
export function computeEpidemic(
  mascots: MascotRecord[],
  adjacency: PrefectureAdjacencyMap,
  filter: EpidemicFilter
): EpidemicComputationResult {
  // 1. Filter mascots by data quality and domain
  let scoped = mascots.filter((mascot) => {
    if (filter.confirmedDebutOnly && mascot.year_type !== 'debut') {
      return false;
    }
    if (filter.domain !== 'ALL' && mascot.dna.domain !== filter.domain) {
      return false;
    }
    return true;
  });

  // 2. Apply primaryTrait filter while retaining downstream same-family mutations
  if (filter.primaryTrait !== 'ALL') {
    const targetTrait = filter.primaryTrait;
    const directMatches: MascotRecord[] = [];
    const primaryFamilies = new Set<string>();
    let earliestTraitYear = Number.POSITIVE_INFINITY;

    for (const mascot of scoped) {
      const isPrimary = mascot.dna.primary_trait === targetTrait;
      const isSecondary = mascot.dna.secondary_traits.includes(targetTrait);

      if (isPrimary) {
        primaryFamilies.add(mascot.dna.trait_family);
      }

      if (isPrimary || isSecondary) {
        directMatches.push(mascot);
        if (mascot.year < earliestTraitYear) {
          earliestTraitYear = mascot.year;
        }
      }
    }

    // Fallback: if the trait only appeared as a secondary trait in scoped mascots,
    // infer its canonical trait_family from the full mascot dataset.
    if (primaryFamilies.size === 0 && directMatches.length > 0) {
      for (const mascot of mascots) {
        if (mascot.dna.primary_trait === targetTrait) {
          primaryFamilies.add(mascot.dna.trait_family);
        }
      }
    }

    scoped = scoped.filter((mascot) => {
      if (
        mascot.dna.primary_trait === targetTrait ||
        mascot.dna.secondary_traits.includes(targetTrait)
      ) {
        return true;
      }
      if (
        primaryFamilies.size > 0 &&
        earliestTraitYear !== Number.POSITIVE_INFINITY &&
        primaryFamilies.has(mascot.dna.trait_family) &&
        mascot.year >= earliestTraitYear
      ) {
        return true;
      }
      return false;
    });
  }

  // 3. Sort deterministically by (year ASC, id ASC)
  const sortedMascots = [...scoped].sort((a, b) => {
    if (a.year !== b.year) {
      return a.year - b.year;
    }
    return compareStrings(a.id, b.id);
  });

  const windowYears = Math.max(0, Math.floor(filter.windowYears));
  const nodesById: Record<string, ComputedMascotNode> = {};
  const orderedNodes: ComputedMascotNode[] = [];

  // 4. Compute deterministic parent linkage, transmission type, mutation type, and generation
  for (const mascot of sortedMascots) {
    const minCandidateYear = mascot.year - windowYears;
    const maxCandidateYear = mascot.year - 1;
    const childCentroid = adjacency[mascot.jis_code]?.centroid;

    let bestCandidate: {
      node: ComputedMascotNode;
      isNeighborOrSame: boolean;
      rawDistanceKm: number;
      isExactPrimary: boolean;
    } | null = null;

    for (let i = 0; i < orderedNodes.length; i += 1) {
      const candidateNode = orderedNodes[i];
      const candidate = candidateNode.mascot;

      if (candidate.year < minCandidateYear) {
        continue;
      }
      if (candidate.year > maxCandidateYear) {
        break;
      }

      if (!sharesGeneticLink(candidate, mascot)) {
        continue;
      }

      const isNeighborOrSame = isDirectNeighborOrSamePref(
        mascot.jis_code,
        candidate.jis_code,
        adjacency
      );
      const parentCentroid = adjacency[candidate.jis_code]?.centroid;
      const rawDistanceKm =
        parentCentroid && childCentroid
          ? haversineKm(parentCentroid, childCentroid)
          : candidate.jis_code === mascot.jis_code
            ? 0
            : Number.POSITIVE_INFINITY;
      const isExactPrimary = candidate.dna.primary_trait === mascot.dna.primary_trait;

      if (!bestCandidate) {
        bestCandidate = {
          node: candidateNode,
          isNeighborOrSame,
          rawDistanceKm,
          isExactPrimary,
        };
        continue;
      }

      const better = isBetterCandidate(
        {
          node: candidateNode,
          isNeighborOrSame,
          rawDistanceKm,
          isExactPrimary,
        },
        bestCandidate
      );

      if (better) {
        bestCandidate = {
          node: candidateNode,
          isNeighborOrSame,
          rawDistanceKm,
          isExactPrimary,
        };
      }
    }

    let node: ComputedMascotNode;

    if (!bestCandidate) {
      node = {
        mascot,
        parentId: null,
        childrenIds: [],
        transmissionType: 'origin',
        mutationType: 'patient_zero',
        distanceKm: null,
        rValue: 0,
        generation: 1,
      };
    } else {
      const parent = bestCandidate.node.mascot;
      const transmissionType: TransmissionType = bestCandidate.isNeighborOrSame
        ? 'local'
        : 'long_distance';

      const distanceKm = Number.isFinite(bestCandidate.rawDistanceKm)
        ? Math.round(bestCandidate.rawDistanceKm)
        : 0;

      let mutationType: MutationType;
      if (
        mascot.dna.primary_trait === parent.dna.primary_trait &&
        !mascot.dna.is_hybrid
      ) {
        mutationType = 'pure_copy';
      } else if (
        mascot.dna.is_hybrid &&
        (mascot.dna.primary_trait === parent.dna.primary_trait ||
          mascot.dna.secondary_traits.includes(parent.dna.primary_trait))
      ) {
        mutationType = 'hybrid';
      } else {
        mutationType = 'mutation';
      }

      node = {
        mascot,
        parentId: parent.id,
        childrenIds: [],
        transmissionType,
        mutationType,
        distanceKm,
        rValue: 0,
        generation: bestCandidate.node.generation + 1,
      };
    }

    nodesById[mascot.id] = node;
    orderedNodes.push(node);
  }

  // 5. Partition activeNodes (year <= filter.maxYear) and compute active childrenIds + rValue
  const activeNodes: ComputedMascotNode[] = [];
  for (const node of orderedNodes) {
    if (node.mascot.year <= filter.maxYear) {
      activeNodes.push(node);
      if (node.parentId !== null) {
        const parentNode = nodesById[node.parentId];
        if (parentNode) {
          parentNode.childrenIds.push(node.mascot.id);
          parentNode.rValue += 1;
        }
      }
    }
  }

  // 6. Build allArcs (full timeline) and arcs (active timeline)
  const allArcs: TransmissionArc[] = [];
  const arcs: TransmissionArc[] = [];

  for (const node of orderedNodes) {
    if (node.parentId === null) {
      continue;
    }
    const parentNode = nodesById[node.parentId];
    if (!parentNode) {
      continue;
    }
    if (parentNode.mascot.jis_code === node.mascot.jis_code) {
      continue;
    }

    const sourceCentroid = adjacency[parentNode.mascot.jis_code]?.centroid;
    const targetCentroid = adjacency[node.mascot.jis_code]?.centroid;
    if (!sourceCentroid || !targetCentroid) {
      continue;
    }

    const arc: TransmissionArc = {
      id: `${parentNode.mascot.id}->${node.mascot.id}`,
      sourceId: parentNode.mascot.id,
      targetId: node.mascot.id,
      sourceJis: parentNode.mascot.jis_code,
      targetJis: node.mascot.jis_code,
      sourceCentroid,
      targetCentroid,
      year: node.mascot.year,
      transmissionType: node.transmissionType as Exclude<TransmissionType, 'origin'>,
      mutationType: node.mutationType as Exclude<MutationType, 'patient_zero'>,
      distanceKm: node.distanceKm ?? 0,
    };

    allArcs.push(arc);
    if (node.mascot.year <= filter.maxYear) {
      arcs.push(arc);
    }
  }

  // 7. Build continuous yearlyIncidence across the full filtered timeline (minYear..maxYear)
  const minYear = orderedNodes.length > 0 ? orderedNodes[0].mascot.year : 0;
  const maxYear =
    orderedNodes.length > 0
      ? orderedNodes[orderedNodes.length - 1].mascot.year
      : 0;

  const yearlyIncidence: YearlyIncidence[] = [];
  if (orderedNodes.length > 0) {
    const byYear = new Map<number, YearlyIncidence>();
    for (let y = minYear; y <= maxYear; y += 1) {
      const entry: YearlyIncidence = {
        year: y,
        total: 0,
        patient_zero: 0,
        pure_copy: 0,
        hybrid: 0,
        mutation: 0,
      };
      byYear.set(y, entry);
      yearlyIncidence.push(entry);
    }

    for (const node of orderedNodes) {
      const bucket = byYear.get(node.mascot.year);
      if (bucket) {
        bucket.total += 1;
        bucket[node.mutationType] += 1;
      }
    }
  }

  // 8. Build prefectureSummary for activeNodes
  const nodesByPrefecture = new Map<string, ComputedMascotNode[]>();
  for (const node of activeNodes) {
    const jis = node.mascot.jis_code;
    let list = nodesByPrefecture.get(jis);
    if (!list) {
      list = [];
      nodesByPrefecture.set(jis, list);
    }
    list.push(node);
  }

  const prefectureSummary: EpidemicComputationResult['prefectureSummary'] = {};

  for (const [jisCode, prefNodes] of nodesByPrefecture.entries()) {
    let leadNode = prefNodes[0];
    let highestGeneration = prefNodes[0].generation;
    let infectedYear = prefNodes[0].mascot.year;

    for (let i = 1; i < prefNodes.length; i += 1) {
      const candidate = prefNodes[i];
      if (compareLeadCandidates(candidate, leadNode) < 0) {
        leadNode = candidate;
      }
      if (candidate.generation > highestGeneration) {
        highestGeneration = candidate.generation;
      }
      if (candidate.mascot.year < infectedYear) {
        infectedYear = candidate.mascot.year;
      }
    }

    prefectureSummary[jisCode] = {
      jisCode,
      nodes: prefNodes,
      leadNode,
      highestGeneration,
      dominantMutation: leadNode.mutationType,
      infectedYear,
    };
  }

  // 9. Build aggregate outbreak stats for activeNodes
  let patientZeros = 0;
  let pureCopies = 0;
  let hybrids = 0;
  let mutations = 0;
  let totalR = 0;
  let topSpreader: ComputedMascotNode | null = null;

  for (const node of activeNodes) {
    switch (node.mutationType) {
      case 'patient_zero':
        patientZeros += 1;
        break;
      case 'pure_copy':
        pureCopies += 1;
        break;
      case 'hybrid':
        hybrids += 1;
        break;
      case 'mutation':
        mutations += 1;
        break;
    }

    totalR += node.rValue;

    if (
      node.rValue > 0 &&
      (!topSpreader || compareLeadCandidates(node, topSpreader) < 0)
    ) {
      topSpreader = node;
    }
  }

  const stats: EpidemicComputationResult['stats'] = {
    totalMascots: activeNodes.length,
    infectedPrefectures: Object.keys(prefectureSummary).length,
    patientZeros,
    pureCopies,
    hybrids,
    mutations,
    avgR: activeNodes.length > 0 ? totalR / activeNodes.length : 0,
    superSpreaderId: topSpreader ? topSpreader.mascot.id : null,
  };

  return {
    nodesById,
    orderedNodes,
    activeNodes,
    arcs,
    allArcs,
    yearlyIncidence,
    minYear,
    maxYear,
    prefectureSummary,
    stats,
  };
}

interface CandidateComparison {
  node: ComputedMascotNode;
  isNeighborOrSame: boolean;
  rawDistanceKm: number;
  isExactPrimary: boolean;
}

function isBetterCandidate(
  candidate: CandidateComparison,
  current: CandidateComparison
): boolean {
  // 1) Direct geographic neighbor or same prefecture first
  if (candidate.isNeighborOrSame !== current.isNeighborOrSame) {
    return candidate.isNeighborOrSame;
  }

  // 2) Shorter Haversine distance first
  if (candidate.rawDistanceKm !== current.rawDistanceKm) {
    return candidate.rawDistanceKm < current.rawDistanceKm;
  }

  // 3) Exact primary_trait match first
  if (candidate.isExactPrimary !== current.isExactPrimary) {
    return candidate.isExactPrimary;
  }

  // 4) Most recent year first
  if (candidate.node.mascot.year !== current.node.mascot.year) {
    return candidate.node.mascot.year > current.node.mascot.year;
  }

  // 5) Deterministic ID ascending tie-breaker
  return compareStrings(candidate.node.mascot.id, current.node.mascot.id) < 0;
}
