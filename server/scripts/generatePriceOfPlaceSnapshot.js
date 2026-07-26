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

// Course buckets for figure 4 — shared with the course-repair simulator so
// both scripts classify titles identically.
const { bucketOf } = require('./lib/courseBuckets');

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

    // Curated transfer minimums — the second completeness basis, computed in
    // the same pass. ASSIST-strict asks "can every stated requirement be
    // completed"; the hand-verified minimums ask "can the eligibility floor
    // be met." ASSIST listings at competitive campuses mix competitiveness
    // into the requirements, so the two bases genuinely differ there (UCLA,
    // San Diego) and agree everywhere else. A minimum is groups of
    // alternative sets; a set is met when every requirement in it has some
    // articulated parent course at the college.
    const minRows = await appDb.collection('curated_requirements')
      .find({ kind: 'transfer_minimum' })
      .sort({ school_id: 1, group_id: 1, set_id: 1, source_order: 1 }).toArray();
    const minimumsBySchool = new Map();
    for (const row of minRows) {
      const sid = Number(row.school_id);
      if (!minimumsBySchool.has(sid)) minimumsBySchool.set(sid, { groups: new Map(), parentIds: new Set() });
      const m = minimumsBySchool.get(sid);
      const g = String(row.group_id); const s = String(row.set_id);
      if (!m.groups.has(g)) m.groups.set(g, new Map());
      if (!m.groups.get(g).has(s)) m.groups.get(g).set(s, []);
      const pids = (row.parent_ids || []).map(Number).filter(Number.isFinite);
      for (const p of pids) m.parentIds.add(p);
      m.groups.get(g).get(s).push(pids);
    }
    const meetsMinimum = (m, articulated) => {
      for (const sets of m.groups.values()) {
        let ok = false;
        for (const reqs of sets.values()) {
          if (reqs.length && reqs.every((pids) => pids.some((p) => articulated.has(p)))) { ok = true; break; }
        }
        if (!ok) return false;
      }
      return true;
    };

    // ---- streaming aggregation state ----
    const programs = new Map();       // key -> program record
    const courseArticulated = new Map(); // receiving parent_id -> ever articulated anywhere
    const csCompleteColleges = new Set(); // college ids with ≥1 complete subject path
    const csCountByCollege = new Map();   // college id -> complete subject programs (0-9)
    let csCompletePairs = 0;             // complete (college, program) subject cells
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
        completeDistrictsMin: [new Set(), new Set(), new Set(), new Set()], // curated-minimums basis (subject only)
        collegeCompleteMin: [0, 0, 0, 0],
      };

      const complete = isMajorArticulable(a, true);
      p.seenDistricts[quartile].add(district);
      if (complete) p.completeDistricts[quartile].add(district);
      p.collegeSeen[quartile] += 1;
      if (complete) p.collegeComplete[quartile] += 1;
      if (isSubject && complete) {
        const cid = Number(a.community_college_id);
        csCompleteColleges.add(cid);
        csCountByCollege.set(cid, (csCountByCollege.get(cid) || 0) + 1);
        csCompletePairs += 1;
      }
      if (isSubject) {
        const minimum = minimumsBySchool.get(Number(a.uc_school_id));
        if (minimum) {
          const articulated = new Set();
          for (const g of a.requirement_groups) {
            for (const s of g.sections || []) {
              for (const r of s.receivers || []) {
                if (r.articulation_status !== 'articulated') continue;
                const receiving = r.receiving || {};
                if (receiving.kind === 'course' && receiving.parent_id != null
                  && minimum.parentIds.has(Number(receiving.parent_id))) {
                  articulated.add(Number(receiving.parent_id));
                }
                if (receiving.kind === 'series') {
                  for (const pid of receiving.parent_ids || []) {
                    if (minimum.parentIds.has(Number(pid))) articulated.add(Number(pid));
                  }
                }
              }
            }
          }
          if (meetsMinimum(minimum, articulated)) {
            p.completeDistrictsMin[quartile].add(district);
            p.collegeCompleteMin[quartile] += 1;
          }
        }
      }

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
    const reachMinByDistrict = new Map();
    for (const p of cs) {
      for (let q = 0; q < 4; q += 1) {
        for (const d of p.completeDistricts[q]) reachByDistrict.set(d, (reachByDistrict.get(d) || 0) + 1);
        for (const d of p.completeDistrictsMin[q]) reachMinByDistrict.set(d, (reachMinByDistrict.get(d) || 0) + 1);
        for (const d of p.seenDistricts[q]) {
          if (!reachByDistrict.has(d)) reachByDistrict.set(d, 0);
          if (!reachMinByDistrict.has(d)) reachMinByDistrict.set(d, 0);
        }
      }
    }
    const centroidByName = new Map(mapGeometry.district_centroids
      .map(([name, lon, lat]) => [norm(name), { lon, lat }]));
    const reachBandOf = (r) => (r <= 2 ? 0 : r <= 4 ? 1 : r <= 6 ? 2 : 3);
    const fig2Districts = matched.map(({ d, income }) => {
      const c = centroidByName.get(norm(d));
      const reach = reachByDistrict.get(d) ?? 0;
      const reachMin = reachMinByDistrict.get(d) ?? 0;
      return c && {
        district: d, lon: c.lon, lat: c.lat,
        income: Math.round(income), incomeQuartile: quartileOfDistrict.get(d),
        reach, reachBand: reachBandOf(reach),
        reachMin, reachMinBand: reachBandOf(reachMin),
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
    const districtShares = (list, field = 'completeDistricts') => [0, 1, 2, 3].map((q) => {
      const perDistrict = new Map();
      for (const p of list) {
        for (const d of p.seenDistricts[q]) {
          const row = perDistrict.get(d) || { done: 0, n: 0 };
          row.n += 1;
          if (p[field][q].has(d)) row.done += 1;
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
    const collegeShares = (list, field = 'collegeComplete') => [0, 1, 2, 3].map((q) => {
      let done = 0; let total = 0;
      for (const p of list) {
        done += p[field][q];
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
    const stratShare = (list, keep, field = 'completeDistricts') => {
      let done = 0; let total = 0;
      for (const p of list) {
        for (let q = 0; q < 4; q += 1) {
          for (const d of p.seenDistricts[q]) {
            if (!keep(d)) continue;
            total += 1;
            if (p[field][q].has(d)) done += 1;
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

    // ---- people: human denominators and resident demographics ----
    // Joins the committed IPEDS and ACS artifacts: how many students and
    // residents sit behind the gate, who they are, and whether the staircase
    // survives enrollment weighting and an alternative income measure.
    const ipedsArt = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/ipeds_ccc.v1.json'), 'utf8'));
    const demoArt = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/district_demographics.v1.json'), 'utf8'));
    const headcountByDistrict = new Map();
    for (const c of ipedsArt.colleges) {
      const d = districtOf.get(c.college_id);
      if (d) headcountByDistrict.set(d, (headcountByDistrict.get(d) || 0) + (c.headcount || 0));
    }
    const demoByNorm = new Map(Object.entries(demoArt.districts).map(([n, v]) => [norm(n), v]));
    const peopleRows = fig2Districts.map((d) => ({
      ...d,
      headcount: headcountByDistrict.get(d.district) || 0,
      demo: demoByNorm.get(norm(d.district)),
    }));
    const sumBy = (list, f) => list.reduce((s, r) => s + f(r), 0);
    const gated = peopleRows.filter((r) => r.reach <= 2);
    const openRows = peopleRows.filter((r) => r.reach >= 7);
    const compOf = (list) => {
      const popTot = sumBy(list, (r) => r.demo?.population || 0);
      const share = (key) => (popTot ? round(sumBy(list, (r) => r.demo?.counts?.[key] || 0) / popTot) : null);
      return { hispanic: share('hispanic'), asian: share('asianNH'), white: share('whiteNH'), black: share('blackNH') };
    };
    const stairWeighted = (weightOf) => [0, 1, 2, 3].map((q) => {
      const inQ = peopleRows.filter((r) => r.incomeQuartile === q);
      const w = sumBy(inQ, weightOf);
      return w ? round(sumBy(inQ, (r) => (r.reach / 9) * weightOf(r)) / w) : null;
    });
    const acsRanked = peopleRows.filter((r) => Number.isFinite(r.demo?.median_household_income))
      .sort((a, b) => a.demo.median_household_income - b.demo.median_household_income);
    const acsQOf = new Map(acsRanked.map((r, i) => [
      r.district, Math.min(3, Math.floor((i * 4) / acsRanked.length))]));
    const people = {
      students: {
        gated: sumBy(gated, (r) => r.headcount),
        none: sumBy(peopleRows.filter((r) => r.reach === 0), (r) => r.headcount),
        total: sumBy(peopleRows, (r) => r.headcount),
      },
      residents: {
        gated: sumBy(gated, (r) => r.demo?.population || 0),
        total: sumBy(peopleRows, (r) => r.demo?.population || 0),
      },
      gatedDistricts: gated.length,
      openDistricts: openRows.length,
      // Residents in districts that reach at most four of nine — most doors shut.
      residentsMajorityShut: sumBy(peopleRows.filter((r) => r.reach <= 4), (r) => r.demo?.population || 0),
      composition: { gated: compOf(gated), open: compOf(openRows), statewide: compOf(peopleRows) },
      // Person-weighted mean reach by group — computed to test the demographic
      // story at person level. It nearly vanishes (spread < 1 program), which
      // is why there is no demographics beat: composition contrasts live only
      // in the sparse tail districts.
      groupReach: (() => {
        const g = {};
        for (const [label, key] of [['hispanic', 'hispanic'], ['asian', 'asianNH'], ['white', 'whiteNH'], ['black', 'blackNH']]) {
          let numer = 0; let denom = 0;
          for (const r of peopleRows) { const p = r.demo?.counts?.[key] || 0; numer += p * r.reach; denom += p; }
          g[label] = round(numer / denom, 2);
        }
        let numer = 0; let denom = 0;
        for (const r of peopleRows) { const p = r.demo?.population || 0; numer += p * r.reach; denom += p; }
        g.all = round(numer / denom, 2);
        return g;
      })(),
      weightedStair: {
        unweighted: stairWeighted(() => 1),
        enrollment: stairWeighted((r) => r.headcount),
        population: stairWeighted((r) => r.demo?.population || 0),
      },
      acsStair: [0, 1, 2, 3].map((q) => {
        const inQ = peopleRows.filter((r) => acsQOf.get(r.district) === q);
        return inQ.length ? round(sumBy(inQ, (r) => r.reach / 9) / inQ.length) : null;
      }),
      acsMovedDistricts: peopleRows.filter((r) => acsQOf.has(r.district)
        && acsQOf.get(r.district) !== r.incomeQuartile).length,
    };

    // ---- detour: extra miles to the nearest college with FULL CHOICE ----
    // "Any path" is a weak bar — one program (Berkeley) is open nearly
    // everywhere, so almost every college clears it and the detour to any
    // path is ~zero for 98% of residents (verified; that dead end is recorded
    // in the working notes). What wealth actually buys is choice. So the
    // detour is measured to the nearest college where MOST of the nine are
    // open (7+), versus the nearest college at all.
    const zctaArt = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/ca_zcta_population.v1.json'), 'utf8'));
    const collegeSites = ipedsArt.colleges.filter((c) => Number.isFinite(c.lat));
    const completeSites = collegeSites.filter((c) => (csCountByCollege.get(c.college_id) || 0) >= 7);
    const districtSites = mapGeometry.district_centroids
      .map(([name, lon, lat]) => ({ name, lon, lat }))
      .filter((d) => quartileOfDistrict.has(d.name));
    const nearestKm = (lat, lon, sites) => {
      let best = Infinity;
      for (const s of sites) { const km = havKm(lat, lon, s.lat, s.lon); if (km < best) best = km; }
      return best;
    };
    const detourRows = zctaArt.zctas.map((z) => {
      let bestD = Infinity; let bestName = null;
      for (const d of districtSites) {
        const km = havKm(z.lat, z.lon, d.lat, d.lon);
        if (km < bestD) { bestD = km; bestName = d.name; }
      }
      const dNearest = nearestKm(z.lat, z.lon, collegeSites);
      const dComplete = nearestKm(z.lat, z.lon, completeSites);
      return {
        population: z.population,
        quartile: quartileOfDistrict.get(bestName),
        detourKm: Math.max(0, dComplete - dNearest),
      };
    });
    const weightedMedian = (rows, valueOf) => {
      const sorted = [...rows].sort((a, b) => valueOf(a) - valueOf(b));
      const totalW = sorted.reduce((s, r) => s + r.population, 0);
      let acc = 0;
      for (const r of sorted) { acc += r.population; if (acc >= totalW / 2) return valueOf(r); }
      return null;
    };
    const detourQuartile = (q) => {
      const rows = detourRows.filter((r) => r.quartile === q);
      const popTot = rows.reduce((s, r) => s + r.population, 0);
      const detoured = rows.filter((r) => r.detourKm > 2); // >2 km = a real detour
      return {
        shareDetoured: round(detoured.reduce((s, r) => s + r.population, 0) / popTot),
        medianDetourKm: round(weightedMedian(rows, (r) => r.detourKm), 1),
        medianDetourKmAmongDetoured: detoured.length
          ? round(weightedMedian(detoured, (r) => r.detourKm), 1) : null,
      };
    };
    const detour = {
      byQuartile: [0, 1, 2, 3].map(detourQuartile),
      fullChoiceColleges: completeSites.length,
      threshold: 7,
    };

    // ---- wall: CS associate completions vs how far up the college connects ----
    // Almost no college has zero paths (4 colleges, 3 completions — the "no
    // path" wall doesn't exist). The real wall is narrow choice: graduates of
    // colleges where most of the nine programs are shut.
    const reachBandOfCount = (n) => (n <= 2 ? 0 : n <= 4 ? 1 : n <= 6 ? 2 : 3);
    const wallColleges = collegeSites.map((c) => ({
      name: c.name,
      completions: c.cs_associate_completions,
      reach: csCountByCollege.get(c.college_id) || 0,
    })).sort((a, b) => b.completions - a.completions);
    const wallBands = [0, 1, 2, 3].map((band) => {
      const inBand = wallColleges.filter((c) => reachBandOfCount(c.reach) === band);
      return {
        band,
        colleges: inBand.length,
        completions: inBand.reduce((s, c) => s + c.completions, 0),
      };
    });
    const wall = {
      colleges: wallColleges,
      bands: wallBands,
      totals: {
        completions: wallColleges.reduce((s, c) => s + c.completions, 0),
        completionsNarrow: wallColleges.filter((c) => c.reach <= 4)
          .reduce((s, c) => s + c.completions, 0),
        collegesNarrow: wallColleges.filter((c) => c.reach <= 4).length,
        colleges: wallColleges.length,
      },
    };

    // ---- participation: does CS participation follow CS access? ----
    // Completions per 1,000 enrolled, open-access vs narrow-access colleges,
    // and the observational bound: extra CS completers per year if the
    // narrow colleges matched the open rate. Access and wealth travel
    // together, so this bounds rather than proves.
    const participation = (() => {
      const rate = (list) => {
        const c = list.reduce((s, x) => s + x.cs_associate_completions, 0);
        const h = list.reduce((s, x) => s + x.headcount, 0);
        return { perK: round((c / h) * 1000, 2), completions: c, headcount: h, n: list.length };
      };
      const reachOf = (c) => csCountByCollege.get(c.college_id) || 0;
      const open = rate(collegeSites.filter((c) => reachOf(c) >= 7));
      const narrow = rate(collegeSites.filter((c) => reachOf(c) <= 4));
      return {
        open, narrow,
        extraPerYear: Math.round(((open.perK - narrow.perK) / 1000) * narrow.headcount),
      };
    })();

    // ---- lorenz: how unequally opportunity is spread over people ----
    // Person-weighted concentration: districts sorted worst- to best-served;
    // x = cumulative population share, y = cumulative share of opportunity
    // (population × reach). Drawn for the subject and the field, plus the
    // fixed-stock counterfactual: the same number of complete cells, placed
    // one fully-open college per district in population order.
    const fieldComplete = new Map(); const fieldSeen = new Map();
    for (const p of field) {
      for (let q = 0; q < 4; q += 1) {
        for (const d of p.seenDistricts[q]) fieldSeen.set(d, (fieldSeen.get(d) || 0) + 1);
        for (const d of p.completeDistricts[q]) fieldComplete.set(d, (fieldComplete.get(d) || 0) + 1);
      }
    }
    const popOfDistrict = (d) => demoByNorm.get(norm(d))?.population || 0;
    const lorenzCurve = (oppOf) => {
      const rows = matched.map(({ d }) => ({ pop: popOfDistrict(d), opp: oppOf(d) }))
        .filter((r) => r.pop > 0)
        .sort((a, b) => a.opp - b.opp);
      const popTot = rows.reduce((s, r) => s + r.pop, 0);
      const oppTot = rows.reduce((s, r) => s + r.pop * r.opp, 0);
      let cp = 0; let co = 0; let gini = 0; let px = 0; let py = 0;
      const points = [[0, 0]];
      for (const r of rows) {
        cp += r.pop / popTot; co += (r.pop * r.opp) / oppTot;
        gini += (cp - px) * (co + py);
        points.push([round(cp), round(co)]);
        px = cp; py = co;
      }
      return { points, gini: round(1 - gini) };
    };
    const csLorenz = lorenzCurve((d) => reachByDistrict.get(d) ?? 0);
    const fieldLorenz = lorenzCurve((d) => {
      const seen = fieldSeen.get(d) || 0;
      return seen ? (fieldComplete.get(d) || 0) / seen : 0;
    });
    const shareHeldByTopFifth = (curve) => {
      const at = curve.points.reduce((best, [x, y]) => (x <= 0.8 ? y : best), 0);
      return round(1 - at);
    };
    // Fixed-stock counterfactual: csCompletePairs cells, spent nine per
    // district (one fully open college), most-populous districts first.
    const byPop = matched.map(({ d }) => popOfDistrict(d)).sort((a, b) => b - a);
    const popTotal = byPop.reduce((s, v) => s + v, 0);
    const fullyOpenable = Math.min(byPop.length, Math.floor(csCompletePairs / 9));
    const counterfactual = {
      pairs: csCompletePairs,
      districtsFullyOpenable: fullyOpenable,
      optimalResidentShare: round(byPop.slice(0, fullyOpenable).reduce((s, v) => s + v, 0) / popTotal),
      actualResidentShare: round(matched.reduce((s, { d }) => (
        (reachByDistrict.get(d) ?? 0) >= 7 ? s + popOfDistrict(d) : s), 0) / popTotal),
    };
    const lorenz = {
      cs: csLorenz,
      field: fieldLorenz,
      topFifthShare: { cs: shareHeldByTopFifth(csLorenz), field: shareHeldByTopFifth(fieldLorenz) },
      counterfactual,
    };

    // ---- minimums basis: the same headline metrics on the eligibility floor ----
    const shareQMin = (p, q) => p.completeDistrictsMin[q].size / Math.max(1, p.seenDistricts[q].size);
    const fig1Min = cs.map((p) => {
      const q1 = shareQMin(p, 0); const q4 = shareQMin(p, 3);
      const regime = (q1 === 0 && q4 === 0) ? 'closed' : (q1 > 0.8 ? 'open' : 'contested');
      return {
        campus: SHORT_CAMPUS[p.school] || p.school, program: p.major,
        q1: round(q1), q4: round(q4), regime,
      };
    });
    const minimums = {
      fig1: fig1Min,
      fig3cs: districtShares(cs, 'completeDistrictsMin'),
      collegeLevelCs: collegeShares(cs, 'collegeCompleteMin'),
      cells: {
        nearPoor: stratShare(cs, (d) => strat.get(d)?.near === true && strat.get(d)?.rich === false, 'completeDistrictsMin'),
        nearRich: stratShare(cs, (d) => strat.get(d)?.near === true && strat.get(d)?.rich === true, 'completeDistrictsMin'),
        farPoor: stratShare(cs, (d) => strat.get(d)?.near === false && strat.get(d)?.rich === false, 'completeDistrictsMin'),
        farRich: stratShare(cs, (d) => strat.get(d)?.near === false && strat.get(d)?.rich === true, 'completeDistrictsMin'),
      },
    };
    minimums.responses = {
      income: {
        near: round(minimums.cells.nearRich - minimums.cells.nearPoor),
        far: round(minimums.cells.farRich - minimums.cells.farPoor),
      },
      proximity: {
        poor: round(minimums.cells.nearPoor - minimums.cells.farPoor),
        rich: round(minimums.cells.nearRich - minimums.cells.farRich),
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
      fig3, fig4, fig5a, fig5b, distance, people, detour, wall, lorenz, participation, minimums,
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
    console.log('people students:', JSON.stringify(people.students), '· residents gated', people.residents.gated.toLocaleString());
    console.log('people composition:', JSON.stringify(people.composition));
    console.log('people stairs — enrollment-weighted:', JSON.stringify(people.weightedStair.enrollment),
      '· acs-ranked:', JSON.stringify(people.acsStair), `(${people.acsMovedDistricts} districts moved)`);
    console.log('detour by quartile:', JSON.stringify(detour.byQuartile));
    console.log('wall:', JSON.stringify(wall.totals), '· bands:', JSON.stringify(wall.bands),
      '· top narrow:', wall.colleges.filter((c) => c.reach <= 4).slice(0, 3)
        .map((c) => `${c.name} ${c.completions}`).join(' · '));
    console.log('lorenz gini — cs:', lorenz.cs.gini, '· field:', lorenz.field.gini,
      '· top-fifth share:', JSON.stringify(lorenz.topFifthShare));
    console.log('counterfactual:', JSON.stringify(counterfactual));
    console.log('participation:', JSON.stringify(participation));
    console.log('minimums fig1:', fig1Min.map((f) => `${f.campus} ${Math.round(f.q1 * 100)}→${Math.round(f.q4 * 100)}% [${f.regime}]`).join(' · '));
    console.log('minimums fig3 cs:', JSON.stringify(minimums.fig3cs), '· college-level:', JSON.stringify(minimums.collegeLevelCs));
    console.log('minimums distance cells:', JSON.stringify(minimums.cells), '· responses:', JSON.stringify(minimums.responses));
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
