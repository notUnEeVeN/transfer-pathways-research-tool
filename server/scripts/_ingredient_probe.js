#!/usr/bin/env node
/**
 * Probe: is the income gradient carried by the CS-proper courses?
 * Per subject bucket, per college: (a) does the catalog hold a UC-transferable
 * course in the subject (taught)? (b) does any campus articulate one from
 * this college (accepted)? Then split by district income quartile and by
 * near/far half. If generic subjects are flat and CS subjects steep, the
 * Price of Place staircase is the CS-course curve.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { bucketOf } = require('./lib/courseBuckets');

const placeSnapshot = require('../../frontend/src/analyses/priceOfPlaceSnapshot.json');
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

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
    const nearOf = new Map(placeSnapshot.distance.tethers
      .map((t) => [t.district, t.km <= placeSnapshot.distance.medianKm]));
    const collegeQuartile = new Map(); const collegeNear = new Map();
    for (const [cid, d] of districtOf) {
      if (quartileOf.has(d)) collegeQuartile.set(cid, quartileOf.get(d));
      if (nearOf.has(d)) collegeNear.set(cid, nearOf.get(d));
    }

    // Taught: catalog holds a UC-transferable course in the bucket.
    const taught = new Map(); // bucket -> Set(college)
    for (const c of await local.db('pmt_data').collection('courses')
      .find({ uc_transferable: true }, { projection: { community_college_id: 1, title: 1 } }).toArray()) {
      const b = bucketOf(c.title || '');
      if (!b) continue;
      if (!taught.has(b.id)) taught.set(b.id, new Set());
      taught.get(b.id).add(Number(c.community_college_id));
    }

    // Accepted: any campus articulates a course of this college in the bucket.
    const ucTitle = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1 } }).toArray()) {
      ucTitle.set(Number(c.parent_id), c.title || '');
    }
    const accepted = new Map(); // bucket -> Set(college)
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { community_college_id: 1, requirement_groups: 1 } }).batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      const college = Number(a.community_college_id);
      for (const g of a.requirement_groups || []) {
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            if (r.articulation_status !== 'articulated') continue;
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            const b = bucketOf(ucTitle.get(pid) || '');
            if (!b) continue;
            if (!accepted.has(b.id)) accepted.set(b.id, new Set());
            accepted.get(b.id).add(college);
          }
        }
      }
    }
    console.log(`scanned ${n} agreements`);

    const colleges = [...collegeQuartile.keys()];
    const share = (set, keep = () => true) => {
      const pool = colleges.filter(keep);
      return pool.length ? pool.filter((c) => set?.has(c)).length / pool.length : null;
    };
    const pct = (v) => (v == null ? '  — ' : `${Math.round(v * 100)}`.padStart(3));
    const ROWS = [
      ['programming', 'CS · programming'],
      ['architecture', 'CS · computer organization'],
      ['discrete', 'CS · discrete mathematics'],
      ['calculus', 'generic · calculus'],
      ['physics', 'generic · physics'],
      ['chemistry', 'generic · chemistry'],
      ['linear_algebra', 'generic · linear algebra'],
      ['statistics', 'generic · statistics'],
      ['composition', 'generic · composition'],
      ['biology', 'generic · biology'],
    ];
    console.log('\nsubject                        taught%  accepted%   accepted by income quartile   near/far');
    console.log('                                                     Q1   Q2   Q3   Q4');
    for (const [bucket, label] of ROWS) {
      const t = taught.get(bucket); const acc = accepted.get(bucket);
      const byQ = [0, 1, 2, 3].map((q) => share(acc, (c) => collegeQuartile.get(c) === q));
      const near = share(acc, (c) => collegeNear.get(c) === true);
      const far = share(acc, (c) => collegeNear.get(c) === false);
      console.log(`${label.padEnd(30)} ${pct(share(t))}     ${pct(share(acc))}      ${byQ.map(pct).join('  ')}    ${pct(near)}/${pct(far)}`);
    }
    console.log('\ntaught by quartile (supply gradient), CS buckets:');
    for (const bucket of ['programming', 'architecture', 'discrete']) {
      const t = taught.get(bucket);
      const byQ = [0, 1, 2, 3].map((q) => share(t, (c) => collegeQuartile.get(c) === q));
      console.log(`  ${bucket.padEnd(14)} ${byQ.map(pct).join('  ')}`);
    }
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
