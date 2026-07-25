#!/usr/bin/env node
/**
 * Generates the committed data snapshot behind the "Price of Place" figure
 * sequence (frontend/src/analyses/priceOfPlaceSnapshot.json).
 *
 * Reads the FULL UC agreement corpus from the local research database
 * (pmt_data.uc_agreements — all ~120k agreements, every UC campus-program),
 * which is deliberately NOT imported into the application database. The
 * website only ever sees this committed, versioned aggregate.
 *
 * Definitions (shared with docs/design_handoff_price_of_place_figures*):
 *   subject   — exactly the nine registry Computer Science programs.
 *   field     — every other UC major; computing-adjacent programs (computer
 *               engineering, informatics, …) and minors are excluded from BOTH.
 *   access    — a complete transfer path formally exists at ≥1 college in the
 *               district, per the strict PMT eligibility engine, each college
 *               evaluated alone.
 *   binding   — a missing receiver slot inside a required group the engine
 *               reports unsatisfied; spare alternatives in satisfied choice
 *               lists are not binding.
 *   quartiles — the 72 income-matched districts split into four groups of 18
 *               by FTB mean AGI per return over district service areas.
 *
 * Usage: node server/scripts/generatePriceOfPlaceSnapshot.js
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');

const OUT_PATH = path.resolve(__dirname, '../../frontend/src/analyses/priceOfPlaceSnapshot.json');

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
const SHORT_CAMPUS = {
  'UC Los Angeles': 'UCLA', 'UC San Diego': 'San Diego', 'UC Santa Barbara': 'Santa Barbara',
  'UC Santa Cruz': 'Santa Cruz', 'UC Berkeley': 'Berkeley', 'UC Davis': 'Davis',
  'UC Irvine': 'Irvine', 'UC Riverside': 'Riverside', 'UC Merced': 'Merced',
};

// Course buckets for figure 4 — coarse, transparent title classification of
// receiving requirements. Order matters: first match wins.
const BUCKETS = [
  ['discrete', /discrete/i, 'Discrete mathematics'],
  ['linear_algebra', /linear alg/i, 'Linear algebra'],
  ['differential', /differential/i, 'Differential equations'],
  ['calculus', /calculus|analytic geometry/i, 'Calculus'],
  ['physics', /physics/i, 'Calculus-based physics'],
  ['programming', /data structure|program|software engineering|\bc\+\+|java(?!nese)/i, 'Programming and data structures'],
  ['architecture', /architect|assembl|organiz|machine structure/i, 'Computer organization'],
  ['organic_chem', /organic chem/i, 'Organic chemistry'],
  ['chemistry', /chem/i, 'General chemistry'],
  ['statistics', /statist|probability/i, 'Statistics and probability'],
  ['biology', /biolog|physiolog|anatomy|molecular|cell/i, 'Biology sequence'],
  ['language', /spanish|french|german|japanese|chinese|italian|korean|latin|language|russian|portuguese/i, 'Foreign language sequence'],
  ['music', /music/i, 'Music theory and performance'],
  ['art_studio', /studio|drawing|painting|sculpture|design(?!ated)/i, 'Studio art sequence'],
  ['composition', /composition|writing|rhetoric|reading/i, 'Composition and writing'],
  ['economics', /econom/i, 'Economics principles'],
  ['psychology', /psycholog/i, 'Psychology core'],
];
function bucketOf(label) {
  for (const [id, re, name] of BUCKETS) if (re.test(label)) return { id, name };
  return null;
}

const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const quantile = (values, q) => {
  const s = [...values].sort((a, b) => a - b);
  const idx = (s.length - 1) * q; const lo = Math.floor(idx);
  return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (idx - lo);
};
const round = (v, d = 3) => (v == null ? null : Number(v.toFixed(d)));

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    const appDb = atlas.db(process.env.DB_NAME || 'pmt_research');
    const insts = await appDb.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));

    // Income-quartile membership: rank the matched districts, split 18/18/18/18.
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(norm(d)) }))
      .filter((x) => Number.isFinite(x.income))
      .sort((a, b) => a.income - b.income);
    const quartileOfDistrict = new Map(matched.map((x, i) => [
      x.d, Math.min(3, Math.floor((i * 4) / matched.length)),
    ]));
    const districtsPerQuartile = [0, 1, 2, 3].map((q) => matched.filter((x) => quartileOfDistrict.get(x.d) === q).length);

    const ucCourses = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1, prefix: 1, number: 1 } }).toArray()) {
      ucCourses.set(Number(c.parent_id), c.title || `${c.prefix} ${c.number}`);
    }

    // ---- streaming aggregation state ----
    const programs = new Map();       // key -> program record
    const courseArticulated = new Map(); // receiving parent_id -> ever articulated anywhere
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school: 1, uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let agreements = 0;
    for await (const a of cursor) {
      agreements += 1;
      if (agreements % 20000 === 0) console.error(`…${agreements}`);
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      if (/minor/i.test(a.major)) continue;
      const isSubject = REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`);
      if (!isSubject && COMPUTING_RE.test(a.major)) continue; // adjacent: excluded
      const district = districtOf.get(Number(a.community_college_id));
      const quartile = quartileOfDistrict.get(district);
      if (quartile == null) continue;

      const key = `${a.uc_school_id}|${a.major}`;
      const p = programs.get(key) || {
        family: isSubject ? 'cs' : 'field',
        school: String(a.uc_school || '').replace(/^University of California,\s*/i, ''),
        major: a.major,
        completeDistricts: [new Set(), new Set(), new Set(), new Set()],
        seenDistricts: [new Set(), new Set(), new Set(), new Set()],
        cells: [{ n: 0, raw: 0, binding: 0 }, { n: 0, raw: 0, binding: 0 }, { n: 0, raw: 0, binding: 0 }, { n: 0, raw: 0, binding: 0 }],
        bindingByDistrict: new Map(), // district -> { sum, n } college-mean binding
        buckets: new Map(),           // bucketId -> { name, uses: true, bindingDistricts: [Set×4], nowhere: 0, occ: 0 }
        requiredTotals: [],           // required-group receiver count per agreement (size matching)
        collegeSeen: [0, 0, 0, 0],     // college-level tallies (no district pooling)
        collegeComplete: [0, 0, 0, 0],
      };

      const complete = isMajorArticulable(a, true);
      p.seenDistricts[quartile].add(district);
      if (complete) p.completeDistricts[quartile].add(district);
      p.collegeSeen[quartile] += 1;
      if (complete) p.collegeComplete[quartile] += 1;

      let raw = 0; let binding = 0; let requiredTotal = 0;
      for (const g of a.requirement_groups) {
        const required = g.is_required === true;
        const groupOk = required ? isMajorArticulable({ requirement_groups: [g] }, true) : true;
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            const missing = r.articulation_status !== 'articulated';
            if (missing) raw += 1;
            if (required) requiredTotal += 1;
            // course-articulation registry (fig4 "sector teaches it nowhere")
            const pid = r.receiving && r.receiving.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid != null && !courseArticulated.get(pid) && !missing) courseArticulated.set(pid, true);
            if (pid != null && !courseArticulated.has(pid)) courseArticulated.set(pid, false);
            if (!required) continue;
            const label = pid != null ? (ucCourses.get(pid) || '') : (r.receiving?.name || '');
            const bucket = label ? bucketOf(label) : null;
            if (bucket) {
              const b = p.buckets.get(bucket.id) || {
                name: bucket.name, bindingDistricts: [new Set(), new Set(), new Set(), new Set()], nowhere: 0, occ: 0,
              };
              if (!groupOk && missing) {
                b.bindingDistricts[quartile].add(district);
                b.occ += 1;
                if (pid != null && courseArticulated.get(pid) === false) b.nowhere += 1;
              }
              p.buckets.set(bucket.id, b);
            }
            if (!groupOk && missing) binding += 1;
          }
        }
      }
      const cell = p.cells[quartile];
      cell.n += 1; cell.raw += raw; cell.binding += binding;
      p.requiredTotals.push(requiredTotal);
      const bd = p.bindingByDistrict.get(district) || { sum: 0, n: 0, quartile };
      bd.sum += binding; bd.n += 1;
      p.bindingByDistrict.set(district, bd);
      programs.set(key, p);
    }
    console.error(`streamed ${agreements} agreements → ${programs.size} programs`);

    const all = [...programs.values()].filter((p) => {
      const seen = p.seenDistricts.reduce((s, set) => s + set.size, 0);
      return seen >= 30;
    });
    const cs = all.filter((p) => p.family === 'cs');
    const field = all.filter((p) => p.family === 'field');

    const shareQ = (p, q) => p.completeDistricts[q].size / Math.max(1, p.seenDistricts[q].size);

    // ---- fig 1: nine programs, three fates ----
    const fig1 = cs.map((p) => {
      const q1 = shareQ(p, 0); const q4 = shareQ(p, 3);
      const regime = (q1 === 0 && q4 === 0) ? 'closed' : (q1 > 0.8 ? 'open' : 'contested');
      return {
        campus: SHORT_CAMPUS[p.school] || p.school, program: p.major,
        q1: round(q1), q4: round(q4), regime,
      };
    });

    // ---- fig 2: twin maps ----
    const reachByDistrict = new Map();
    for (const p of cs) {
      for (let q = 0; q < 4; q += 1) {
        for (const d of p.completeDistricts[q]) reachByDistrict.set(d, (reachByDistrict.get(d) || 0) + 1);
        for (const d of p.seenDistricts[q]) if (!reachByDistrict.has(d)) reachByDistrict.set(d, 0);
      }
    }
    const centroidByName = new Map(mapGeometry.district_centroids
      .map(([name, lon, lat]) => [norm(name), { lon, lat }]));
    const reachBandOf = (r) => (r <= 2 ? 0 : r <= 4 ? 1 : r <= 6 ? 2 : 3);
    const fig2Districts = matched.map(({ d, income }) => {
      const c = centroidByName.get(norm(d));
      const reach = reachByDistrict.get(d) ?? 0;
      return c && {
        district: d, lon: c.lon, lat: c.lat,
        income: Math.round(income), incomeQuartile: quartileOfDistrict.get(d),
        reach, reachBand: reachBandOf(reach),
      };
    }).filter(Boolean);
    const fig2Stats = {
      reachNone: fig2Districts.filter((d) => d.reach === 0).length,
      reachNoneAllPoorest: fig2Districts.filter((d) => d.reach === 0)
        .every((d) => d.incomeQuartile === 0),
      reachTwoOrFewer: fig2Districts.filter((d) => d.reach <= 2).length,
      withinOneBand: fig2Districts.filter((d) => Math.abs(d.reachBand - d.incomeQuartile) <= 1).length,
      totalDistricts: fig2Districts.length,
    };

    // ---- fig 3: quartile access shares ----
    const districtShares = (list) => [0, 1, 2, 3].map((q) => {
      const perDistrict = new Map();
      for (const p of list) {
        for (const d of p.seenDistricts[q]) {
          const row = perDistrict.get(d) || { done: 0, n: 0 };
          row.n += 1;
          if (p.completeDistricts[q].has(d)) row.done += 1;
          perDistrict.set(d, row);
        }
      }
      return round(mean([...perDistrict.values()].map((r) => r.done / r.n)));
    });
    // Subject size, stated as a fact rather than controlled by construction:
    // the nine programs' required-course burden is ordinary for the corpus
    // (median at the field's ~65th percentile, two programs below the field
    // median), so "it's just a big major" is not an available explanation.
    const burdenOf = (p) => quantile(p.requiredTotals, 0.5);
    const csBurdens = cs.map(burdenOf);
    const fieldBurdens = field.map(burdenOf);
    const subjectMedianBurden = quantile(csBurdens, 0.5);
    const fieldMedianBurden = quantile(fieldBurdens, 0.5);
    const subjectSize = {
      medianBurden: subjectMedianBurden,
      fieldMedianBurden,
      fieldPercentile: Math.round(
        (fieldBurdens.filter((b) => b < subjectMedianBurden).length / fieldBurdens.length) * 100),
      belowFieldMedian: csBurdens.filter((b) => b < fieldMedianBurden).length,
    };

    // College-level robustness: the same access shares with each college
    // counted individually (no "any college in the district" pooling). Rich
    // districts hold more colleges (1.89 vs 1.22 per district, richest vs
    // poorest quartile), so pooling gives them more draws — this check shows
    // the contrast is not that mechanic: responses compress proportionally
    // and the subject-to-field ratio is unchanged.
    const collegeShares = (list) => [0, 1, 2, 3].map((q) => {
      let done = 0; let total = 0;
      for (const p of list) {
        done += p.collegeComplete[q];
        total += p.collegeSeen[q];
      }
      return total ? round(done / total) : null;
    });
    const fig3CollegeLevel = {
      cs: collegeShares(cs),
      field: collegeShares(field),
    };

    const fig3 = {
      cs: districtShares(cs),
      field: districtShares(field),
      collegeLevel: fig3CollegeLevel,
      subjectSize,
      medianIncome: [0, 1, 2, 3].map((q) => Math.round(
        quantile(matched.filter((x) => quartileOfDistrict.get(x.d) === q).map((x) => x.income), 0.5))),
    };

    // ---- fig 4: the gate has a course catalogue ----
    const panel = (list) => {
      const byBucket = new Map();
      for (const p of list) {
        for (const [id, b] of p.buckets) {
          const agg = byBucket.get(id) || { name: b.name, q1: [], q4: [], nowhere: 0, occ: 0 };
          agg.q1.push(b.bindingDistricts[0].size / Math.max(1, p.seenDistricts[0].size));
          agg.q4.push(b.bindingDistricts[3].size / Math.max(1, p.seenDistricts[3].size));
          agg.nowhere += b.nowhere; agg.occ += b.occ;
          byBucket.set(id, agg);
        }
      }
      return [...byBucket.entries()]
        .map(([id, agg]) => ({
          id, course: agg.name,
          programs: agg.q1.length,
          q1: round(mean(agg.q1)), q4: round(mean(agg.q4)),
          nowhereShare: agg.occ ? round(agg.nowhere / agg.occ, 2) : 0,
        }))
        .filter((row) => row.programs >= Math.min(3, list.length) && row.q1 > 0.02)
        .sort((a, b) => b.q1 - a.q1);
    };
    const fig4 = { cs: panel(cs).slice(0, 6), field: panel(field).slice(0, 5) };

    // ---- fig 5A: raw vs binding by quartile ----
    const meansFor = (list) => [0, 1, 2, 3].map((q) => {
      const cells = list.map((p) => p.cells[q]).filter((c) => c.n > 0);
      const n = cells.reduce((s, c) => s + c.n, 0);
      return {
        raw: round(cells.reduce((s, c) => s + c.raw, 0) / n, 2),
        binding: round(cells.reduce((s, c) => s + c.binding, 0) / n, 2),
      };
    });
    const fig5a = { cs: meansFor(cs), field: meansFor(field) };

    // ---- fig 5B: conditional recovery cloud ----
    const gapPoint = (p) => {
      const q1 = [...p.bindingByDistrict.values()].filter((b) => b.quartile === 0);
      const q4 = [...p.bindingByDistrict.values()].filter((b) => b.quartile === 3);
      if (q1.length < 5 || q4.length < 5) return null;
      const gap = mean(q1.map((b) => b.sum / b.n));
      if (gap < 0.3) return { structural: true };
      const recovery = (gap - mean(q4.map((b) => b.sum / b.n))) / gap;
      return { gap: round(gap, 2), recovery: round(recovery, 3) };
    };
    const fieldPoints = [];
    let structuralZeros = 0;
    for (const p of field) {
      const pt = gapPoint(p);
      if (!pt) continue;
      if (pt.structural) { structuralZeros += 1; continue; }
      fieldPoints.push([pt.gap, pt.recovery]);
    }
    const csPoints = cs.map((p) => {
      const pt = gapPoint(p);
      return pt && !pt.structural
        ? { campus: SHORT_CAMPUS[p.school] || p.school, gap: pt.gap, recovery: pt.recovery }
        : { campus: SHORT_CAMPUS[p.school] || p.school, structural: true };
    });
    const BIN_EDGES = [0.3, 1, 1.8, 2.8, 4, 5.5, 8];
    const bins = [];
    for (let i = 0; i < BIN_EDGES.length - 1; i += 1) {
      const inBin = fieldPoints.filter(([g]) => g >= BIN_EDGES[i] && g < BIN_EDGES[i + 1]).map(([, r]) => r);
      if (inBin.length < 8) continue;
      bins.push({
        x: round((BIN_EDGES[i] + BIN_EDGES[i + 1]) / 2, 2),
        median: round(quantile(inBin, 0.5)),
        p95: round(quantile(inBin, 0.95)),
        n: inBin.length,
      });
    }
    const fig5b = { fieldPoints, bins, cs: csPoints, structuralZeros };

    // ---- distance: is the staircase proximity-to-campus in disguise? ----
    // Rich districts cluster around the metros that also host UC campuses, so
    // income and campus proximity are entangled. Split the districts at the
    // median straight-line centroid distance to the nearest campus, then read
    // each factor with the other held: the income response within distance
    // halves, and the distance response within income halves.
    const UC_CAMPUS_SITES = [
      ['Berkeley', 37.8719, -122.2585],
      ['Davis', 38.5382, -121.7617],
      ['Los Angeles', 34.0689, -118.4452],
      ['Irvine', 33.6405, -117.8443],
      ['San Diego', 32.8801, -117.2340],
      ['Santa Barbara', 34.4140, -119.8489],
      ['Santa Cruz', 36.9914, -122.0609],
      ['Riverside', 33.9737, -117.3281],
      ['Merced', 37.3647, -120.4241],
    ];
    const havKm = (lat1, lon1, lat2, lon2) => {
      const toRad = (deg) => (deg * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
      const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    const tetherOf = new Map();
    for (const { d } of matched) {
      const c = centroidByName.get(norm(d));
      if (!c) continue;
      let best = null;
      for (const [campus, lat, lon] of UC_CAMPUS_SITES) {
        const km = havKm(c.lat, c.lon, lat, lon);
        if (!best || km < best.km) best = { campus, km };
      }
      tetherOf.set(d, { ...best, lon: c.lon, lat: c.lat });
    }
    const medianKm = quantile([...tetherOf.values()].map((t) => t.km), 0.5);
    const strat = new Map(matched.map((x) => [x.d, {
      near: (tetherOf.get(x.d)?.km ?? Infinity) <= medianKm,
      rich: quartileOfDistrict.get(x.d) >= 2,
    }]));
    const stratShare = (list, keep) => {
      let done = 0; let total = 0;
      for (const p of list) {
        for (let q = 0; q < 4; q += 1) {
          for (const d of p.seenDistricts[q]) {
            if (!keep(d)) continue;
            total += 1;
            if (p.completeDistricts[q].has(d)) done += 1;
          }
        }
      }
      return total ? round(done / total) : null;
    };
    const cellFor = (near, rich) => {
      const keep = (d) => strat.get(d)?.near === near && strat.get(d)?.rich === rich;
      return {
        cs: stratShare(cs, keep),
        field: stratShare(field, keep),
        n: matched.filter((x) => keep(x.d)).length,
      };
    };
    const cells = {
      nearPoor: cellFor(true, false), nearRich: cellFor(true, true),
      farPoor: cellFor(false, false), farRich: cellFor(false, true),
    };
    const resp = (from, to) => ({ cs: round(to.cs - from.cs), field: round(to.field - from.field) });
    const distance = {
      campuses: UC_CAMPUS_SITES.map(([name, lat, lon]) => ({ name, lat, lon })),
      tethers: matched.map(({ d }) => {
        const t = tetherOf.get(d);
        return t && {
          district: d, lon: t.lon, lat: t.lat, campus: t.campus,
          km: round(t.km, 1), quartile: quartileOfDistrict.get(d),
        };
      }).filter(Boolean),
      medianKm: round(medianKm, 1),
      medianKmByQuartile: [0, 1, 2, 3].map((q) => round(quantile(
        matched.filter((x) => quartileOfDistrict.get(x.d) === q)
          .map((x) => tetherOf.get(x.d)?.km).filter(Number.isFinite), 0.5), 0)),
      cells,
      responses: {
        income: { near: resp(cells.nearPoor, cells.nearRich), far: resp(cells.farPoor, cells.farRich) },
        proximity: { poor: resp(cells.farPoor, cells.nearPoor), rich: resp(cells.farRich, cells.nearRich) },
      },
    };

    const snapshot = {
      version: 1,
      generated_at: new Date().toISOString(),
      corpus: '2025-26 ASSIST agreement corpus (pmt_data.uc_agreements)',
      counts: {
        agreements,
        subjectPrograms: cs.length,
        fieldPrograms: field.length,
        districts: matched.length,
        districtsPerQuartile,
      },
      fig1, fig2: { districts: fig2Districts, stats: fig2Stats, outline: mapGeometry.california_outline },
      fig3, fig4, fig5a, fig5b, distance,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot));
    console.log(`wrote ${OUT_PATH} (${Math.round(fs.statSync(OUT_PATH).size / 1024)} KB)`);
    console.log('fig1:', fig1.map((f) => `${f.campus} ${Math.round(f.q1 * 100)}→${Math.round(f.q4 * 100)}% [${f.regime}]`).join(' · '));
    console.log('fig3 cs:', fig3.cs, 'field:', fig3.field);
    console.log('fig3 subject size:', JSON.stringify(subjectSize));
    console.log('fig4 cs:', fig4.cs.map((r) => `${r.course} ${Math.round(r.q1 * 100)}→${Math.round(r.q4 * 100)}%`).join(' · '));
    console.log('fig4 field:', fig4.field.map((r) => `${r.course} ${Math.round(r.q1 * 100)}→${Math.round(r.q4 * 100)}%${r.nowhereShare > 0.5 ? ' [nowhere]' : ''}`).join(' · '));
    console.log('fig5a cs:', JSON.stringify(fig5a.cs), '\nfig5a field:', JSON.stringify(fig5a.field));
    console.log('fig5b: field pts', fieldPoints.length, '· structural zeros', structuralZeros, '· cs', JSON.stringify(csPoints));
    console.log('distance: median km/quartile', JSON.stringify(distance.medianKmByQuartile), '· split at', distance.medianKm, 'km');
    console.log('distance cells:', JSON.stringify(cells));
    console.log('distance responses:', JSON.stringify(distance.responses));
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
