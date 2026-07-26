#!/usr/bin/env node
/**
 * Builds analysis/data/ca_zcta_population.v1.json — population point cloud
 * for person-weighted geography (detour distances, coverage counterfactuals).
 * One row per California ZCTA: code, centroid, ACS population.
 *
 * Inputs (in the scratch dir passed as argv[2]):
 *   cr_ca_zcta.json — Census Reporter acs2024_5yr B03002 (total population)
 *   US.txt          — GeoNames postal centroids
 */
const fs = require('fs');
const path = require('path');

const SCRATCH = process.argv[2];
if (!SCRATCH) { console.error('usage: node _build_zcta_artifact.js <scratch dir>'); process.exit(1); }
const OUT = path.resolve(__dirname, '../../analysis/data/ca_zcta_population.v1.json');

const cr = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'cr_ca_zcta.json'), 'utf8'));
const zipCentroid = new Map();
for (const line of fs.readFileSync(path.join(SCRATCH, 'US.txt'), 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f[4] !== 'CA') continue;
  const lat = Number(f[9]); const lon = Number(f[10]);
  if (Number.isFinite(lat) && Number.isFinite(lon)) zipCentroid.set(f[1], { lat, lon });
}

const zctas = [];
let unlocated = 0; let unlocatedPop = 0;
for (const [geoid, tables] of Object.entries(cr.data)) {
  const zcta = geoid.replace('86000US', '');
  const population = tables.B03002?.estimate?.B03002001 || 0;
  const c = zipCentroid.get(zcta);
  if (!c) { unlocated += 1; unlocatedPop += population; continue; }
  if (!population) continue;
  zctas.push({ zcta, lat: c.lat, lon: c.lon, population });
}

const artifact = {
  dataset_version: 'ca-zcta-population.acs2024-5yr.v1',
  source: {
    name: 'American Community Survey 2020-2024 5-year estimates, table B03002 total population, all California ZCTAs',
    publisher: 'U.S. Census Bureau, retrieved via the Census Reporter API (acs2024_5yr release)',
    license: 'public domain (U.S. federal data)',
  },
  centroid_source: 'GeoNames postal-code centroids (download.geonames.org/export/zip, CC-BY 4.0)',
  coverage: {
    zctas: zctas.length,
    population: zctas.reduce((s, z) => s + z.population, 0),
    zctas_without_centroid: unlocated,
    population_unlocated: unlocatedPop,
  },
  zctas,
};
fs.writeFileSync(OUT, JSON.stringify(artifact, null, 1));
console.log(`wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
console.log('zctas:', zctas.length, '· population:', artifact.coverage.population.toLocaleString(),
  '· unlocated pop:', unlocatedPop.toLocaleString());
