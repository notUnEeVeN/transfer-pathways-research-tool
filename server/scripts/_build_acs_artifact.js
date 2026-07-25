#!/usr/bin/env node
/**
 * Builds analysis/data/district_demographics.v1.json — ACS resident
 * demographics aggregated to the 72 community college districts.
 *
 * Inputs (in the scratch dir passed as argv[2]):
 *   cr_ca_zcta.json — Census Reporter acs2024_5yr B03002 (Hispanic/race) and
 *                     B19013 (median household income) for all 1,808 CA ZCTAs
 *   US.txt          — GeoNames postal centroids (lat/lon per ZIP)
 *
 * Method mirrors district_income.v1.json: every ZCTA is assigned to the
 * community college district whose centroid is nearest (haversine on the
 * GeoNames ZIP centroid); district values are population-weighted sums, and
 * median household income is the population-weighted mean of ZCTA medians
 * (an approximation, flagged in the method string).
 */
const fs = require('fs');
const path = require('path');

const SCRATCH = process.argv[2];
if (!SCRATCH) { console.error('usage: node _build_acs_artifact.js <scratch dir>'); process.exit(1); }
const OUT = path.resolve(__dirname, '../../analysis/data/district_demographics.v1.json');

const mapGeometry = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../analysis/data/paper_articulation_map.json'), 'utf8'));
const cr = JSON.parse(fs.readFileSync(path.join(SCRATCH, 'cr_ca_zcta.json'), 'utf8'));

const havKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// ZIP centroids (GeoNames, CA rows only).
const zipCentroid = new Map();
for (const line of fs.readFileSync(path.join(SCRATCH, 'US.txt'), 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f[4] !== 'CA') continue;
  const lat = Number(f[9]); const lon = Number(f[10]);
  if (Number.isFinite(lat) && Number.isFinite(lon)) zipCentroid.set(f[1], { lat, lon });
}

const districts = mapGeometry.district_centroids.map(([name, lon, lat]) => ({ name, lon, lat }));
const nearestDistrict = (lat, lon) => {
  let best = null; let bestKm = Infinity;
  for (const d of districts) {
    const km = havKm(lat, lon, d.lat, d.lon);
    if (km < bestKm) { bestKm = km; best = d.name; }
  }
  return best;
};

const RACE_FIELDS = {
  total: 'B03002001',
  whiteNH: 'B03002003',
  blackNH: 'B03002004',
  americanIndianNH: 'B03002005',
  asianNH: 'B03002006',
  pacificIslanderNH: 'B03002007',
  otherNH: 'B03002008',
  twoOrMoreNH: 'B03002009',
  hispanic: 'B03002012',
};

const agg = new Map(districts.map((d) => [d.name, {
  zctas: 0, incomeWeight: 0, incomeSum: 0,
  ...Object.fromEntries(Object.keys(RACE_FIELDS).map((k) => [k, 0])),
}]));
let assignedPop = 0; let unlocatedPop = 0; let unlocatedZctas = 0;

for (const [geoid, tables] of Object.entries(cr.data)) {
  const zcta = geoid.replace('86000US', '');
  const est = tables.B03002.estimate;
  const pop = est[RACE_FIELDS.total] || 0;
  const c = zipCentroid.get(zcta);
  if (!c) { unlocatedZctas += 1; unlocatedPop += pop; continue; }
  const district = nearestDistrict(c.lat, c.lon);
  const a = agg.get(district);
  a.zctas += 1;
  for (const [k, code] of Object.entries(RACE_FIELDS)) a[k] += est[code] || 0;
  const income = tables.B19013?.estimate?.B19013001;
  if (Number.isFinite(income) && pop > 0) { a.incomeSum += income * pop; a.incomeWeight += pop; }
  assignedPop += pop;
}

const out = {};
for (const [name, a] of agg) {
  const shares = {};
  for (const k of Object.keys(RACE_FIELDS)) {
    if (k === 'total') continue;
    shares[k] = a.total ? Number((a[k] / a.total).toFixed(4)) : null;
  }
  out[name] = {
    population: a.total,
    counts: Object.fromEntries(Object.keys(RACE_FIELDS).filter((k) => k !== 'total').map((k) => [k, a[k]])),
    shares,
    median_household_income: a.incomeWeight ? Math.round(a.incomeSum / a.incomeWeight) : null,
    zctas: a.zctas,
  };
}

const artifact = {
  dataset_version: 'district-demographics.acs2024-5yr.v1',
  source: {
    name: 'American Community Survey 2020-2024 5-year estimates, tables B03002 (Hispanic or Latino origin by race) and B19013 (median household income), all California ZCTAs',
    publisher: 'U.S. Census Bureau, retrieved via the Census Reporter API (api.censusreporter.org, acs2024_5yr release)',
    page: 'https://censusreporter.org/tables/B03002/',
    license: 'public domain (U.S. federal data)',
  },
  centroid_source: 'GeoNames postal-code centroids (download.geonames.org/export/zip, CC-BY 4.0)',
  method: 'Every California ZCTA is assigned to the community college district whose centroid is nearest (haversine on the GeoNames ZIP centroid), mirroring the district_income.v1 method; district race counts are sums over assigned ZCTAs, and median household income is the population-weighted mean of ZCTA medians (an approximation of the true pooled median).',
  coverage: {
    zctas_assigned: [...agg.values()].reduce((s, a) => s + a.zctas, 0),
    zctas_without_centroid: unlocatedZctas,
    population_assigned: assignedPop,
    population_unlocated: unlocatedPop,
  },
  districts: out,
};
fs.writeFileSync(OUT, JSON.stringify(artifact, null, 1));
console.log(`wrote ${OUT} (${Math.round(fs.statSync(OUT).size / 1024)} KB)`);
console.log('assigned population:', assignedPop.toLocaleString(),
  '· unlocated:', unlocatedPop.toLocaleString(), `(${unlocatedZctas} ZCTAs)`);
const totals = [...agg.values()].reduce((s, a) => ({
  hispanic: s.hispanic + a.hispanic, total: s.total + a.total,
}), { hispanic: 0, total: 0 });
console.log('statewide Hispanic share (check ≈ 0.40):', (totals.hispanic / totals.total).toFixed(3));
const withData = Object.values(out).filter((d) => d.population > 0).length;
console.log('districts with population:', withData, '/', districts.length);
