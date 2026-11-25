# Yuru-Dex — Japan Mascot Outbreak Atlas

> *What happens if you treat Japan's regional mascot craze as a joyful, Pokémon-style meme epidemic?*

**Yuru-Dex** is a playful interactive atlas that tracks how Japan's beloved *yuru-chara* (regional and organizational mascots) spread, hybridized, and mutated across all **47 prefectures** from **1993 to 2019**. Built purely for curiosity and fun, it pairs a crisp Japanese washi-paper and Pokémon trading-card aesthetic with a real client-side epidemiological engine.

---

## The Idea & Spirit of Play

Every town, train line, citrus grove, and castle in Japan seems to have its own lovable mascot—bears with rosy cheeks, melon-headed beasts, samurai cats, and citrus fairies. Once one breaks out (like Kumamoto's **Kumamon** or Shiga's **Hikonyan**), neighboring towns catch the fever, remixing traits into unexpected hybrids and local mutations.

Yuru-Dex turns that real cultural phenomenon into an **Outbreak Field Guide**:

- **Playful Outbreak Stories** — Jump straight into curated waves like *The Great Yuru Wave*, *Bear Outbreak (Kumamon Strain)*, *Neko Fever*, *Fruit & Citrus Hybrids*, *Samurai & Yokai Lore*, or *Avian Swarm*.
- **Interactive Japan Map** — All 47 prefectures (plus a dedicated Okinawa inset) over a traditional *Seigaiha* wave ocean, with curved transmission arcs distinguishing **Pure Copies** (solid), **Hybrids** (dashed), and **Mutations** (dotted).
- **Collectible Mascot Gene Cards** — Zero external mascot images. Each card is generated live from the prefecture's real GeoJSON silhouette, mascot color DNA, bespoke vector trait icons, contagiousness ($R_0$), and a clickable **Outbreak Chain** (*Infected By* & *Infected Hosts*).
- **Epidemic Time Machine** — Press **Play** at `1x`, `2x`, or `4x` speed (or scrub the stacked incidence bar chart) to watch traits sweep across Japan year by year.

---

## How the Trait Epidemic Model Works

All epidemiology runs deterministically in the browser in TypeScript ([`src/engine/epidemic.ts`](src/engine/epidemic.ts)):

1. **Candidate Ancestors (`window_years`, default `5`)** — For any mascot $M$ appearing in year $t$, the engine searches earlier mascots ($t - \text{window} \le y \le t - 1$) that share a `primary_trait`, overlap in `secondary_traits`, or belong to the same `trait_family` (e.g. *mammal*, *fruit*, *yokai_myth*).
2. **Neighbor-First Contagion** — Direct neighboring prefectures (land borders plus major bridges, tunnels, and ferries such as Seikan, Seto Ohashi, and Kanmon) are prioritized over distant jumps, then ranked by Haversine distance.
3. **Strain Classification**
   - **Patient Zero (`Gen 1`)** — No matching ancestor within the transmission window.
   - **Pure Copy** — Same `primary_trait` as its parent, with no added hybrid traits.
   - **Hybrid** — Inherits the parent trait while fusing secondary traits (e.g. *Bear + Melon* or *Cat + Samurai*).
   - **Mutation** — Evolves into a sibling trait inside the same `trait_family` (e.g. *Bear → Raccoon*).
4. **Live Virality ($R_0$)** — Counts downstream mascots within the active timeline window that trace their lineage back to $M$.

---

## Real Data, Vector-First

- **Mascot DNA (`public/data/mascots.json`)**: **600 real Japanese mascots** distilled from the [tacookson/data `yuru-gp.txt`](https://github.com/tacookson/data/tree/master/japanese-mascots) Grand Prix dataset, enriched with verified historical debut years (`61` confirmed `debut` records vs. `first_observed` competition entries), `32` normalized traits across `5` domains (`Fauna`, `Flora_Food`, `Lore_History`, `Geo_Nature`, `Object_Abstract`), and `198` hybrids covering all `47/47` prefectures.
- **Geography (`public/data/japan_prefectures.geojson` & `prefecture_adjacency.json`)**: Simplified 47-prefecture boundaries (`134.9 KB`) derived from [`dataofjapan/land`](https://github.com/dataofjapan/land) paired with a symmetric neighbor and centroid graph.
- **Zero External Images**: Every mascot crest is rendered in SVG from prefecture geometry and custom vector icons—no broken image links or third-party hotlinking.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Run deterministic epidemiology unit tests (Vitest)
npm test

# Validate GeoJSON, adjacency symmetry, and mascot schema
npm run validate-data

# Build self-contained production bundle into dist/
npm run build
```

To regenerate the static datasets from source:

```bash
python scripts/build_dataset.py
npm run validate-data
```

---

## Self-Contained Static Deployment (Subfolder-Ready)

`vite.config.ts` uses `base: './'`, and `public/.htaccess` includes Apache security headers, gzip compression, and cache rules. You can upload the contents of `dist/` directly into any subfolder on static hosting (such as `https://yourdomain.com/yuru-chara/` on one.com) with no backend or database required.

---

## Project Structure

```text
├── doc/PRD specification.txt          # Product & epidemiology specification
├── public/
│   ├── .htaccess                      # Static Apache headers & caching
│   ├── frc-logo.png                   # Company emblem & favicon
│   └── data/                          # Static GeoJSON, adjacency & mascot DNA
├── scripts/
│   ├── build_dataset.py               # Offline ETL & trait extraction pipeline
│   └── validate_data.mjs              # Schema, size & graph integrity checks
└── src/
    ├── engine/                        # Deterministic epidemic model & Vitest suite
    ├── components/                    # Map, Gene Card, Timeline & Trait Icons
    └── utils/                         # Theme palette & visual helpers
```

---

Created by **[Frimer-Rasmussen Consulting](https://frimer-rasmussen.dk)** · Released under the [MIT License](LICENSE).
