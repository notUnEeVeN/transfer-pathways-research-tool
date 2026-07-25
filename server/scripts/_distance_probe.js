#!/usr/bin/env node
/**
 * Probe: is the income-access staircase a proximity-to-UC effect in disguise?
 * Rich districts cluster around the big metros, which is also where UC
 * campuses sit. Test: stratify the 72 districts by distance to the nearest
 * UC campus, then check whether income still moves access WITHIN strata.
 * Mirrors generatePriceOfPlaceSnapshot.js definitions exactly.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');

const districtIncome = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../analysis/data/district_income.v1.json'), 'utf8'));
const mapGeometry = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../analysis/data/paper_articulation_map.json'), 'utf8'));

const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const incomeOf = new Map(Object.entries(districtIncome.districts)
  .map(([n, e]) => [norm(n), e?.catchment?.mean_agi_per_return]));

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const COMPUTING_RE = /computer|computing|informatics|software/i;

// Nine UC campus locations (lat, lon) — public, stable facts.
const UC_CAMPUSES = [
  ['Berkeley', 37.8719, -122.2585],
  ['Davis', 38.5382, -121.7617],
  ['UCLA', 34.0689, -118.4452],
  ['Irvine', 33.6405, -117.8443],
  ['San Diego', 32.8801, -117.2340],
  ['Santa Barbara', 34.4140, -119.8489],
  ['Santa Cruz', 36.9914, -122.0609],
  ['Riverside', 33.9737, -117.3281],
  ['Merced', 37.3647, -120.4241],
];

const havKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

const median = (v) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (v) => `${(v * 100).toFixed(1)}%`;

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    const appDb = atlas.db(process.env.DB_NAME || 'pmt_research');
    const insts = await appDb.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));

    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(norm(d)) }))
      .filter((x) => Number.isFinite(x.income))
      .sort((a, b) => a.income - b.income);
    const quartileOfDistrict = new Map(matched.map((x, i) => [
      x.d, Math.min(3, Math.floor((i * 4) / matched.length)),
    ]));

    // Distance to nearest UC campus per district centroid.
    const centroidByName = new Map(mapGeometry.district_centroids
      .map(([name, lon, lat]) => [norm(name), { lon, lat }]));
    const distOf = new Map();
    for (const { d } of matched) {
      const c = centroidByName.get(norm(d));
      if (!c) { console.error(`no centroid: ${d}`); continue; }
      let best = Infinity; let bestCampus = null;
      for (const [campus, lat, lon] of UC_CAMPUSES) {
        const km = havKm(c.lat, c.lon, lat, lon);
        if (km < best) { best = km; bestCampus = campus; }
      }
      distOf.set(d, { km: best, campus: bestCampus });
    }

    // ---- confound structure ----
    console.log('== Confound: distance to nearest UC by income quartile ==');
    for (const q of [0, 1, 2, 3]) {
      const ds = matched.filter((x) => quartileOfDistrict.get(x.d) === q)
        .map((x) => distOf.get(x.d)?.km).filter(Number.isFinite);
      console.log(`Q${q + 1}: median ${median(ds).toFixed(0)} km · mean ${(ds.reduce((s, v) => s + v, 0) / ds.length).toFixed(0)} km · n=${ds.length}`);
    }
    const kms = matched.map((x) => distOf.get(x.d)?.km).filter(Number.isFinite);
    const medKm = median(kms);
    console.log(`overall median distance: ${medKm.toFixed(0)} km`);
    const medIncome = median(matched.map((x) => x.income));

    const stratumOf = new Map(matched.map((x) => {
      const km = distOf.get(x.d)?.km;
      return [x.d, {
        near: km <= medKm,
        rich: x.income > medIncome,
        km,
      }];
    }));

    // ---- stream agreements: per-program, per-district completion ----
    const programs = new Map();
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) console.error(`…${n}`);
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      if (/minor/i.test(a.major)) continue;
      const isSubject = REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`);
      if (!isSubject && COMPUTING_RE.test(a.major)) continue;
      const district = districtOf.get(Number(a.community_college_id));
      if (!quartileOfDistrict.has(district)) continue;
      const key = `${a.uc_school_id}|${a.major}`;
      const p = programs.get(key) || { family: isSubject ? 'cs' : 'field', districts: new Map() };
      const prev = p.districts.get(district) || false;
      p.districts.set(district, prev || isMajorArticulable(a, true));
      programs.set(key, p);
    }
    console.error(`streamed ${n}`);

    const all = [...programs.values()].filter((p) => p.districts.size >= 30);
    const cs = all.filter((p) => p.family === 'cs');
    const field = all.filter((p) => p.family === 'field');
    console.log(`programs: cs ${cs.length} · field ${field.length}`);

    // Access share over program×district cells restricted to a district set.
    const share = (list, keep) => {
      let done = 0; let total = 0;
      for (const p of list) {
        for (const [d, complete] of p.districts) {
          if (!keep(d)) continue;
          total += 1; if (complete) done += 1;
        }
      }
      return total ? done / total : null;
    };

    console.log('\n== 2×2: distance half × income half (18 districts/cell) ==');
    for (const near of [true, false]) {
      for (const rich of [false, true]) {
        const keep = (d) => {
          const s = stratumOf.get(d);
          return s && s.near === near && s.rich === rich;
        };
        const nD = matched.filter((x) => keep(x.d)).length;
        console.log(`${near ? 'NEAR' : 'FAR '} · ${rich ? 'rich' : 'poor'} (n=${nD}): cs ${pct(share(cs, keep))} · field ${pct(share(field, keep))}`);
      }
    }

    console.log('\n== Income response within each distance half ==');
    for (const near of [true, false]) {
      const csPoor = share(cs, (d) => stratumOf.get(d)?.near === near && !stratumOf.get(d)?.rich);
      const csRich = share(cs, (d) => stratumOf.get(d)?.near === near && stratumOf.get(d)?.rich);
      const fPoor = share(field, (d) => stratumOf.get(d)?.near === near && !stratumOf.get(d)?.rich);
      const fRich = share(field, (d) => stratumOf.get(d)?.near === near && stratumOf.get(d)?.rich);
      console.log(`${near ? 'NEAR' : 'FAR '}: cs +${((csRich - csPoor) * 100).toFixed(1)} pts · field +${((fRich - fPoor) * 100).toFixed(1)} pts`);
    }

    console.log('\n== Distance response within each income half (the reverse cut) ==');
    for (const rich of [false, true]) {
      const csFar = share(cs, (d) => stratumOf.get(d)?.rich === rich && !(stratumOf.get(d)?.near));
      const csNear = share(cs, (d) => stratumOf.get(d)?.rich === rich && stratumOf.get(d)?.near);
      const fFar = share(field, (d) => stratumOf.get(d)?.rich === rich && !(stratumOf.get(d)?.near));
      const fNear = share(field, (d) => stratumOf.get(d)?.rich === rich && stratumOf.get(d)?.near);
      console.log(`${rich ? 'rich' : 'poor'}: cs near−far ${((csNear - csFar) * 100).toFixed(1)} pts · field near−far ${((fNear - fFar) * 100).toFixed(1)} pts`);
    }

    // Quartile staircase restricted to far-half districts only (thin cells, caveat).
    console.log('\n== Q1→Q4 staircase, FAR-half districts only (~9/quartile — thin) ==');
    for (const q of [0, 1, 2, 3]) {
      const keep = (d) => quartileOfDistrict.get(d) === q && !(stratumOf.get(d)?.near);
      const nD = matched.filter((x) => keep(x.d)).length;
      console.log(`Q${q + 1} (n=${nD}): cs ${pct(share(cs, keep))} · field ${pct(share(field, keep))}`);
    }
  } finally {
    await atlas.close(); await local.close();
  }
})();
