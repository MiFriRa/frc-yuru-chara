import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');

const GEOJSON_PATH = path.join(DATA_DIR, 'japan_prefectures.geojson');
const ADJACENCY_PATH = path.join(DATA_DIR, 'prefecture_adjacency.json');
const MASCOTS_PATH = path.join(DATA_DIR, 'mascots.json');

const VALID_DOMAINS = new Set([
  'Fauna',
  'Flora_Food',
  'Lore_History',
  'Geo_Nature',
  'Object_Abstract',
]);

const VALID_REGIONS = new Set([
  'Hokkaido',
  'Tohoku',
  'Kanto',
  'Chubu',
  'Kansai',
  'Chugoku',
  'Shikoku',
  'Kyushu',
]);

const VALID_YEAR_TYPES = new Set(['debut', 'first_observed']);

const TRAIT_TO_FAMILY = {
  bear: 'mammal',
  cat: 'mammal',
  dog: 'mammal',
  rabbit: 'mammal',
  raccoon: 'mammal',
  fox: 'mammal',
  deer: 'mammal',
  cow: 'mammal',
  horse: 'mammal',
  bird: 'avian',
  fish: 'aquatic',
  frog: 'aquatic',
  turtle: 'aquatic',
  citrus: 'fruit',
  apple: 'fruit',
  peach: 'fruit',
  melon: 'fruit',
  rice: 'crop_dish',
  noodle: 'crop_dish',
  flower: 'botanical',
  tree: 'botanical',
  samurai: 'warrior',
  ninja: 'warrior',
  dragon: 'yokai_myth',
  kappa: 'yokai_myth',
  oni: 'yokai_myth',
  fairy: 'yokai_myth',
  mountain: 'landform',
  water: 'landform',
  castle: 'heritage_object',
  star: 'heritage_object',
  ceramic: 'heritage_object',
};

const REQUIRED_BRIDGES = [
  ['01', '02'], // Seikan
  ['28', '36'], // Akashi / Naruto
  ['33', '37'], // Seto Ohashi
  ['34', '38'], // Shimanami Kaido
  ['35', '40'], // Kanmon
  ['46', '47'], // Kagoshima-Okinawa ferry
];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const URL_RE = /https?:\/\/|www\.|\.(jpg|jpeg|png|gif|webp|svg)\b/i;

const errors = [];
function assert(cond, msg) {
  if (!cond) {
    errors.push(msg);
  }
}

const ALL_JIS = Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, '0'));
const ALL_JIS_SET = new Set(ALL_JIS);

// 1. Validate GeoJSON
assert(fs.existsSync(GEOJSON_PATH), `Missing ${GEOJSON_PATH}`);
const geoStat = fs.existsSync(GEOJSON_PATH) ? fs.statSync(GEOJSON_PATH) : null;
if (geoStat) {
  const geoSizeKb = geoStat.size / 1024;
  assert(geoStat.size < 200 * 1024, `GeoJSON exceeds 200 KB: ${geoSizeKb.toFixed(1)} KB`);
  assert(geoStat.size < 180 * 1024, `GeoJSON exceeds 180 KB target: ${geoSizeKb.toFixed(1)} KB`);

  const geo = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
  assert(geo.type === 'FeatureCollection', 'GeoJSON must be a FeatureCollection');
  assert(Array.isArray(geo.features), 'GeoJSON features must be an array');
  assert(geo.features.length === 47, `GeoJSON must have 47 features, found ${geo.features.length}`);

  const seenGeoJis = new Set();
  for (const feat of geo.features) {
    const p = feat.properties || {};
    assert(ALL_JIS_SET.has(p.jis_code), `Invalid GeoJSON jis_code: ${p.jis_code}`);
    assert(!seenGeoJis.has(p.jis_code), `Duplicate GeoJSON jis_code: ${p.jis_code}`);
    seenGeoJis.add(p.jis_code);
    assert(typeof p.name_en === 'string' && p.name_en.length > 0, `Missing name_en for ${p.jis_code}`);
    assert(typeof p.name_jp === 'string' && p.name_jp.length > 0, `Missing name_jp for ${p.jis_code}`);
    assert(VALID_REGIONS.has(p.region_en), `Invalid region_en ${p.region_en} for ${p.jis_code}`);

    const geom = feat.geometry;
    assert(
      geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon'),
      `Invalid geometry type for ${p.jis_code}: ${geom?.type}`
    );
    const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
    assert(polygons.length > 0, `Empty geometry for ${p.jis_code}`);
    for (const poly of polygons) {
      assert(poly.length > 0, `Empty polygon rings for ${p.jis_code}`);
      for (const ring of poly) {
        assert(ring.length >= 4, `Ring with < 4 coords in ${p.jis_code}`);
        const first = ring[0];
        const last = ring[ring.length - 1];
        assert(
          first[0] === last[0] && first[1] === last[1],
          `Unclosed ring in ${p.jis_code}`
        );
      }
    }
  }
  for (const code of ALL_JIS) {
    assert(seenGeoJis.has(code), `Missing prefecture ${code} in GeoJSON`);
  }
}

// 2. Validate Adjacency Graph
assert(fs.existsSync(ADJACENCY_PATH), `Missing ${ADJACENCY_PATH}`);
let adj = {};
if (fs.existsSync(ADJACENCY_PATH)) {
  adj = JSON.parse(fs.readFileSync(ADJACENCY_PATH, 'utf8'));
  const keys = Object.keys(adj);
  assert(keys.length === 47, `Adjacency map must have 47 keys, found ${keys.length}`);

  for (const code of ALL_JIS) {
    const entry = adj[code];
    assert(Boolean(entry), `Missing adjacency entry for ${code}`);
    if (!entry) continue;
    assert(entry.jis_code === code, `Mismatched jis_code in adjacency[${code}]`);
    assert(typeof entry.name_en === 'string' && entry.name_en.length > 0, `Missing name_en in adj[${code}]`);
    assert(typeof entry.name_jp === 'string' && entry.name_jp.length > 0, `Missing name_jp in adj[${code}]`);
    assert(VALID_REGIONS.has(entry.region_en), `Invalid region_en in adj[${code}]: ${entry.region_en}`);
    assert(Array.isArray(entry.neighbors) && entry.neighbors.length > 0, `Prefecture ${code} has no neighbors`);

    const neighborSet = new Set(entry.neighbors);
    assert(neighborSet.size === entry.neighbors.length, `Duplicate neighbors in adj[${code}]`);
    assert(!neighborSet.has(code), `Self-loop in adj[${code}]`);

    for (const nb of entry.neighbors) {
      assert(ALL_JIS_SET.has(nb), `Invalid neighbor ${nb} in adj[${code}]`);
      assert(
        adj[nb] && Array.isArray(adj[nb].neighbors) && adj[nb].neighbors.includes(code),
        `Asymmetric adjacency: ${code} -> ${nb} without ${nb} -> ${code}`
      );
    }

    assert(
      Array.isArray(entry.centroid) && entry.centroid.length === 2,
      `Invalid centroid format in adj[${code}]`
    );
    const [lat, lng] = entry.centroid;
    assert(
      typeof lat === 'number' && lat >= 24 && lat <= 46,
      `Out-of-bounds Japan latitude ${lat} in adj[${code}]`
    );
    assert(
      typeof lng === 'number' && lng >= 122 && lng <= 146,
      `Out-of-bounds Japan longitude ${lng} in adj[${code}]`
    );
  }

  for (const [a, b] of REQUIRED_BRIDGES) {
    assert(
      adj[a]?.neighbors?.includes(b) && adj[b]?.neighbors?.includes(a),
      `Missing required island bridge/ferry link: ${a} <-> ${b}`
    );
  }

  // Verify graph is a single connected component
  const visited = new Set(['01']);
  const queue = ['01'];
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const nb of adj[cur]?.neighbors || []) {
      if (!visited.has(nb)) {
        visited.add(nb);
        queue.push(nb);
      }
    }
  }
  assert(visited.size === 47, `Adjacency graph is not fully connected (${visited.size}/47 reached)`);
}

// 3. Validate Mascots Dataset
assert(fs.existsSync(MASCOTS_PATH), `Missing ${MASCOTS_PATH}`);
let mascots = [];
if (fs.existsSync(MASCOTS_PATH)) {
  const rawText = fs.readFileSync(MASCOTS_PATH, 'utf8');
  const mSizeKb = Buffer.byteLength(rawText, 'utf8') / 1024;
  assert(Buffer.byteLength(rawText, 'utf8') < 450 * 1024, `mascots.json exceeds 450 KB: ${mSizeKb.toFixed(1)} KB`);
  assert(!URL_RE.test(rawText), 'mascots.json contains prohibited external URL or image URL reference');

  mascots = JSON.parse(rawText);
  assert(Array.isArray(mascots), 'mascots.json must be an array');
  assert(mascots.length >= 450 && mascots.length <= 750, `Expected ~500-700 mascots, got ${mascots.length}`);

  const seenIds = new Set();
  const byPref = Object.fromEntries(ALL_JIS.map((c) => [c, 0]));
  const traitCounts = {};
  let hybridCount = 0;
  let debutCount = 0;
  let minYear = 9999;
  let maxYear = 0;

  for (const m of mascots) {
    assert(typeof m.id === 'string' && m.id.length > 0, 'Mascot missing id');
    assert(!seenIds.has(m.id), `Duplicate mascot id: ${m.id}`);
    seenIds.add(m.id);

    assert(typeof m.name_en === 'string' && m.name_en.trim().length > 0, `Missing name_en for ${m.id}`);
    assert(m.name_jp === null || (typeof m.name_jp === 'string' && m.name_jp.length > 0), `Invalid name_jp for ${m.id}`);
    assert(ALL_JIS_SET.has(m.jis_code), `Invalid jis_code ${m.jis_code} for ${m.id}`);
    if (ALL_JIS_SET.has(m.jis_code)) {
      byPref[m.jis_code] += 1;
      assert(
        m.prefecture_en === adj[m.jis_code]?.name_en,
        `Mismatched prefecture_en for ${m.id}: ${m.prefecture_en} vs ${adj[m.jis_code]?.name_en}`
      );
    }
    assert(
      m.municipality_en === null || typeof m.municipality_en === 'string',
      `Invalid municipality_en for ${m.id}`
    );
    assert(
      Number.isInteger(m.year) && m.year >= 1980 && m.year <= 2025,
      `Invalid year ${m.year} for ${m.id}`
    );
    minYear = Math.min(minYear, m.year);
    maxYear = Math.max(maxYear, m.year);

    assert(VALID_YEAR_TYPES.has(m.year_type), `Invalid year_type ${m.year_type} for ${m.id}`);
    if (m.year_type === 'debut') debutCount += 1;

    if (m.bio_en !== undefined) {
      assert(
        typeof m.bio_en === 'string' && m.bio_en.length > 0 && m.bio_en.length <= 160,
        `Invalid bio_en length (${m.bio_en?.length}) for ${m.id}`
      );
      assert(!URL_RE.test(m.bio_en), `URL detected in bio_en for ${m.id}`);
    }

    const dna = m.dna;
    assert(dna && typeof dna === 'object', `Missing dna for ${m.id}`);
    if (dna) {
      assert(VALID_DOMAINS.has(dna.domain), `Invalid domain ${dna.domain} for ${m.id}`);
      assert(
        Object.prototype.hasOwnProperty.call(TRAIT_TO_FAMILY, dna.primary_trait),
        `Unknown primary_trait ${dna.primary_trait} for ${m.id}`
      );
      assert(
        dna.trait_family === TRAIT_TO_FAMILY[dna.primary_trait],
        `Mismatched trait_family for ${m.id}: ${dna.trait_family} vs expected ${TRAIT_TO_FAMILY[dna.primary_trait]}`
      );
      assert(Array.isArray(dna.secondary_traits), `secondary_traits must be array for ${m.id}`);
      for (const st of dna.secondary_traits) {
        assert(
          Object.prototype.hasOwnProperty.call(TRAIT_TO_FAMILY, st),
          `Unknown secondary_trait ${st} for ${m.id}`
        );
        assert(st !== dna.primary_trait, `secondary_trait duplicates primary_trait in ${m.id}`);
      }
      assert(
        new Set(dna.secondary_traits).size === dna.secondary_traits.length,
        `Duplicate secondary_traits in ${m.id}`
      );
      assert(
        dna.is_hybrid === (dna.secondary_traits.length > 0),
        `is_hybrid mismatch for ${m.id}`
      );
      assert(HEX_COLOR_RE.test(dna.primary_color), `Invalid primary_color ${dna.primary_color} for ${m.id}`);
      assert(HEX_COLOR_RE.test(dna.accent_color), `Invalid accent_color ${dna.accent_color} for ${m.id}`);

      if (dna.is_hybrid) hybridCount += 1;
      traitCounts[dna.primary_trait] = (traitCounts[dna.primary_trait] || 0) + 1;
    }
  }

  const coveredPrefs = Object.values(byPref).filter((c) => c > 0).length;
  const minPrefCount = Math.min(...Object.values(byPref));
  assert(coveredPrefs === 47, `Only ${coveredPrefs}/47 prefectures covered in mascots.json`);
  assert(minPrefCount >= 5, `Minimum mascot count in a prefecture is ${minPrefCount} (expected >= 5)`);

  const hybridPct = (hybridCount / mascots.length) * 100;
  const topTraits = Object.entries(traitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([t, c]) => `${t}(${c})`)
    .join(', ');

  console.log('=== Yuru-Dex Dataset Validation Summary ===');
  console.log(`GeoJSON size: ${(geoStat.size / 1024).toFixed(1)} KB (47 features)`);
  console.log(`Mascots size: ${mSizeKb.toFixed(1)} KB (${mascots.length} mascots)`);
  console.log(`Prefectures covered: ${coveredPrefs}/47 (min per pref: ${minPrefCount})`);
  console.log(`Year range: ${minYear}–${maxYear}`);
  console.log(`Confirmed debut records: ${debutCount} (${((debutCount / mascots.length) * 100).toFixed(1)}%)`);
  console.log(`Hybrids: ${hybridCount} (${hybridPct.toFixed(1)}%)`);
  console.log(`Unique primary traits used: ${Object.keys(traitCounts).length}/32`);
  console.log(`Top traits: ${topTraits}`);
}

if (errors.length > 0) {
  console.error(`\nVALIDATION FAILED with ${errors.length} error(s):`);
  for (const err of errors.slice(0, 30)) {
    console.error(`  - ${err}`);
  }
  if (errors.length > 30) {
    console.error(`  ... and ${errors.length - 30} more errors.`);
  }
  process.exit(1);
} else {
  console.log('\nALL VALIDATION CHECKS PASSED!');
}
