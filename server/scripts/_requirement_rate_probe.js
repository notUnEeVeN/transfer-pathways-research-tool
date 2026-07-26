#!/usr/bin/env node
/**
 * Probe: per-REQUIREMENT articulation rates — the right granularity for
 * "how do CS courses compare with other courses." For every receiving course
 * required in the nine subject asks: at what share of colleges is THAT course
 * articulated, and how does the share move across income quartiles?
 * Hypothesis: generic requirements (a campus's calculus) are commodities —
 * high and flat — while CS requirements are campus-idiosyncratic pairings —
 * lower and steep. If so, the access staircase is the CS-requirement curve.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { getMajor, programPairs } = require('../config/majors');
const { bucketOf } = require('./lib/courseBuckets');

const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const CS_BUCKETS = new Set(['programming', 'architecture', 'discrete']);

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    const insts = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));
    const districtIncome = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/district_income.v1.json'), 'utf8'));
    const incomeOf = new Map(Object.entries(districtIncome.districts)
      .map(([n, e]) => [norm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(norm(d)) }))
      .filter((x) => Number.isFinite(x.income)).sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));
    const collegeQuartile = new Map();
    for (const [cid, d] of districtOf) if (quartileOf.has(d)) collegeQuartile.set(cid, quartileOf.get(d));

    const ucTitle = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1 } }).toArray()) {
      ucTitle.set(Number(c.parent_id), c.title || '');
    }

    // Per required receiving course in the subject asks: colleges seen and
    // colleges where it is articulated, plus per-quartile splits.
    const reqs = new Map(); // pid -> { title, bucket, seen:Set, ok:Set }
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      if (!REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`)) continue;
      const college = Number(a.community_college_id);
      if (!collegeQuartile.has(college)) continue;
      for (const g of a.requirement_groups || []) {
        if (g.is_required !== true) continue;
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            if (!reqs.has(pid)) {
              const title = ucTitle.get(pid) || '';
              reqs.set(pid, { title, bucket: bucketOf(title)?.id ?? null, seen: new Set(), ok: new Set() });
            }
            const req = reqs.get(pid);
            req.seen.add(college);
            if (r.articulation_status === 'articulated') req.ok.add(college);
          }
        }
      }
    }
    console.log(`scanned ${n} agreements · ${reqs.size} distinct required receiving courses`);

    // Classify each requirement: CS-proper vs generic (bucketed non-CS).
    const rows = [...reqs.values()].filter((r) => r.seen.size >= 30);
    const csReqs = rows.filter((r) => r.bucket && CS_BUCKETS.has(r.bucket));
    const genReqs = rows.filter((r) => r.bucket && !CS_BUCKETS.has(r.bucket));
    const rate = (r) => r.ok.size / r.seen.size;
    const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    console.log(`\nrequirements: CS-proper ${csReqs.length} · generic ${genReqs.length}`);
    console.log(`articulation rate per requirement — CS: mean ${(mean(csReqs.map(rate)) * 100).toFixed(0)}% median ${(median(csReqs.map(rate)) * 100).toFixed(0)}%`);
    console.log(`                               generic: mean ${(mean(genReqs.map(rate)) * 100).toFixed(0)}% median ${(median(genReqs.map(rate)) * 100).toFixed(0)}%`);

    // The gradient: pooled requirement-college cells by quartile.
    const pooled = (list, q) => {
      let ok = 0; let seen = 0;
      for (const r of list) {
        for (const c of r.seen) {
          if (collegeQuartile.get(c) !== q) continue;
          seen += 1; if (r.ok.has(c)) ok += 1;
        }
      }
      return seen ? ok / seen : null;
    };
    const line = (list) => [0, 1, 2, 3].map((q) => `${Math.round(pooled(list, q) * 100)}`.padStart(3)).join('  ');
    console.log('\nshare of requirement-college cells articulated, by income quartile:');
    console.log(`  CS-proper requirements   ${line(csReqs)}`);
    console.log(`  generic requirements     ${line(genReqs)}`);

    // Distribution extremes for the figure: worst CS requirements.
    const worst = [...csReqs].sort((a, b) => rate(a) - rate(b)).slice(0, 6);
    console.log('\nleast-articulated CS requirements:');
    for (const r of worst) {
      console.log(`  ${(r.title || '?').trim()} — ${Math.round(rate(r) * 100)}% of ${r.seen.size} colleges`);
    }
    const bestGen = [...genReqs].sort((a, b) => rate(b) - rate(a)).slice(0, 3);
    console.log('most-articulated generic requirements:',
      bestGen.map((r) => `${r.title.trim()} ${Math.round(rate(r) * 100)}%`).join(' · '));
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
