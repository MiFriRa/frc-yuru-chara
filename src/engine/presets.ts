import type { MascotDomain } from '../types/mascot';

export interface OutbreakPreset {
  id: string;
  label: string;
  tagline: string;
  domain: MascotDomain | 'ALL';
  primaryTrait: string | 'ALL';
  windowYears: number;
  focusMascotId?: string;
}

export const OUTBREAK_PRESETS: OutbreakPreset[] = [
  {
    id: 'all-wave',
    label: 'The Great Yuru Wave',
    tagline: 'Track every mascot lineage sweeping across all 47 prefectures.',
    domain: 'ALL',
    primaryTrait: 'ALL',
    windowYears: 5,
    focusMascotId: 'kumamon-43',
  },
  {
    id: 'bear-fever',
    label: 'Bear Outbreak',
    tagline: 'Follow Kumamon and the bear-to-mammal wave radiating from Kyushu.',
    domain: 'Fauna',
    primaryTrait: 'bear',
    windowYears: 5,
    focusMascotId: 'kumamon-43',
  },
  {
    id: 'cat-fever',
    label: 'Neko Fever',
    tagline: 'Watch castle cats and lucky felines leap across Honshu.',
    domain: 'Fauna',
    primaryTrait: 'cat',
    windowYears: 5,
  },
  {
    id: 'fruit-hybrids',
    label: 'Fruit & Citrus Hybrids',
    tagline: 'See apples, peaches, melons, and citrus splice into bold regional hybrids.',
    domain: 'Flora_Food',
    primaryTrait: 'ALL',
    windowYears: 5,
  },
  {
    id: 'lore-yokai',
    label: 'Samurai & Yokai Lore',
    tagline: 'Trace samurai heroes, mischievous kappa, and mythic spirits through time.',
    domain: 'Lore_History',
    primaryTrait: 'ALL',
    windowYears: 6,
  },
  {
    id: 'bird-flock',
    label: 'Avian Swarm',
    tagline: 'Chart cranes, chicks, and island birds migrating prefecture to prefecture.',
    domain: 'Fauna',
    primaryTrait: 'bird',
    windowYears: 5,
  },
];
