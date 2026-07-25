#!/usr/bin/env node
/**
 * Probe: what do the IPEDS + ACS artifacts say when joined to the committed
 * Price of Place snapshot? Decides what earns figure ink vs a notes line.
 *  1. Students (12-month headcount) attending colleges in gated districts.
 *  2. Resident demographics of gated vs open districts.
 *  3. Enrollment-weighted access staircase (does it survive weighting?).
 *  4. Staircase re-ranked by ACS median household income (alt income measure).
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const snapshot = require('../../frontend/src/analyses/priceOfPlaceSnapshot.json');
const ipeds = require('../../analysis/data/ipeds_ccc.v1.json');
const demo = require('../../analysis/data/district_demographics.v1.json');

const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const pct = (v) => `${(v * 100).toFixed(1)}%`;

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const insts = await atlas.db(process.env.DB_NAME || 'pmt_research')
    .collection('assist_institutions')
    .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
  await atlas.close();
  const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));

  // Headcount per district.
  const headcountByDistrict = new Map();
  let unmatchedColleges = 0;
  for (const c of ipeds.colleges) {
    const d = districtOf.get(c.college_id);
    if (!d) { unmatchedColleges += 1; continue; }
    headcountByDistrict.set(d, (headcountByDistrict.get(d) || 0) + (c.headcount || 0));
  }
  if (unmatchedColleges) console.log('colleges with no district:', unmatchedColleges);

  const rows = snapshot.fig2.districts.map((d) => ({
    ...d,
    headcount: headcountByDistrict.get(d.district) || 0,
    demo: demo.districts[d.district]
      || demo.districts[Object.keys(demo.districts).find((k) => norm(k) === norm(d.district))],
  }));
  const missingDemo = rows.filter((r) => !r.demo).map((r) => r.district);
  if (missingDemo.length) console.log('districts missing demographics:', missingDemo);

  // 1. Students behind the gate.
  const sum = (list, f) => list.reduce((s, r) => s + f(r), 0);
  const none = rows.filter((r) => r.reach === 0);
  const le2 = rows.filter((r) => r.reach <= 2);
  const open79 = rows.filter((r) => r.reach >= 7);
  console.log('\n== students (12-month headcount at district colleges) ==');
  console.log('no path at all:', sum(none, (r) => r.headcount).toLocaleString(), `(${none.length} districts)`);
  console.log('reach ≤2 of nine:', sum(le2, (r) => r.headcount).toLocaleString(), `(${le2.length} districts)`);
  console.log('reach 7–9:', sum(open79, (r) => r.headcount).toLocaleString(), `(${open79.length} districts)`);
  console.log('all 72 districts:', sum(rows, (r) => r.headcount).toLocaleString());

  // 2. Resident demographics, gated vs open.
  const shareOf = (list, key) => {
    const popTot = sum(list, (r) => r.demo?.population || 0);
    return popTot ? sum(list, (r) => r.demo?.counts?.[key] || 0) / popTot : null;
  };
  console.log('\n== resident demographics (ACS) ==');
  for (const key of ['hispanic', 'whiteNH', 'asianNH', 'blackNH']) {
    console.log(`${key}: reach≤2 ${pct(shareOf(le2, key))} · reach 7–9 ${pct(shareOf(open79, key))} · statewide ${pct(shareOf(rows, key))}`);
  }
  console.log('residents in reach≤2 districts:', sum(le2, (r) => r.demo?.population || 0).toLocaleString());

  // 3. Enrollment-weighted staircase (district reach/9 as access fraction).
  const wStair = (weightOf) => [0, 1, 2, 3].map((q) => {
    const inQ = rows.filter((r) => r.incomeQuartile === q);
    const w = sum(inQ, weightOf);
    return w ? pct(sum(inQ, (r) => (r.reach / 9) * weightOf(r)) / w) : null;
  });
  console.log('\n== CS access staircase (mean reach/9 per quartile) ==');
  console.log('unweighted:', wStair(() => 1).join(' → '));
  console.log('enrollment-weighted:', wStair((r) => r.headcount).join(' → '));
  console.log('population-weighted:', wStair((r) => r.demo?.population || 0).join(' → '));

  // 4. Re-rank quartiles by ACS median household income.
  const ranked = [...rows].filter((r) => Number.isFinite(r.demo?.median_household_income))
    .sort((a, b) => a.demo.median_household_income - b.demo.median_household_income);
  const q4 = (i, n) => Math.min(3, Math.floor((i * 4) / n));
  const acsQ = new Map(ranked.map((r, i) => [r.district, q4(i, ranked.length)]));
  const acsStair = [0, 1, 2, 3].map((q) => {
    const inQ = rows.filter((r) => acsQ.get(r.district) === q);
    return inQ.length ? pct(sum(inQ, (r) => r.reach / 9) / inQ.length) : null;
  });
  console.log('\n== staircase with quartiles re-ranked by ACS median household income ==');
  console.log(acsStair.join(' → '));
  let moved = 0;
  for (const r of rows) if (acsQ.has(r.district) && acsQ.get(r.district) !== r.incomeQuartile) moved += 1;
  console.log('districts changing quartile under the alt measure:', moved, '/', ranked.length);
})().catch((e) => { console.error(e); process.exit(1); });
