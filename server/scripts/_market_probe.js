#!/usr/bin/env node
/**
 * Probe: the market view — transfer demand (applicants) against
 * engine-computed access (share of colleges with a complete path), one point
 * per program, every major. No ingredient instrument, no thresholds: the
 * strict eligibility engine decides completeness, exactly as everywhere else
 * in both collections. The claim to test: heavily-demanded majors are
 * solved — except Computer Science.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

(async () => {
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    const demand = new Map();
    for (const d of await local.db('pmt_data').collection('uc_major_admissions').find({}).toArray()) {
      const key = `${Number(d.uc_school_id)}|${norm(d.major)}`;
      const applicants = (d.stats || []).reduce((s, st) => s + (st.applicants || 0), 0);
      demand.set(key, (demand.get(key) || 0) + applicants);
    }

    const programs = new Map(); // `${campus}|${major}` -> {seen, complete}
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      if (/minor/i.test(a.major)) continue;
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      const key = `${Number(a.uc_school_id)}|${a.major}`;
      if (demand.get(`${Number(a.uc_school_id)}|${norm(a.major)}`) == null) continue; // only demand-matched programs
      if (!programs.has(key)) programs.set(key, { seen: 0, complete: 0 });
      const p = programs.get(key);
      p.seen += 1;
      if (isMajorArticulable(a, true)) p.complete += 1;
    }
    console.log(`scanned ${n}`);

    const rows = [];
    for (const [key, p] of programs) {
      if (p.seen < 60) continue;
      const campus = Number(key.split('|')[0]);
      const major = key.split('|').slice(1).join('|');
      rows.push({
        campus, major,
        cs: REGISTRY_CS.has(key),
        applicants: demand.get(`${campus}|${norm(major)}`),
        access: p.complete / p.seen,
      });
    }
    console.log(`programs with demand + full coverage: ${rows.length} (CS ${rows.filter((r) => r.cs).length})`);

    const top = [...rows].sort((a, b) => b.applicants - a.applicants).slice(0, 25);
    console.log('\n== top 25 by transfer applicants: demand vs engine access ==');
    for (const r of top) {
      console.log(`  ${String(r.applicants).padStart(6)} applicants · access ${(r.access * 100).toFixed(0).padStart(3)}% ${r.cs ? '→ CS ' : '     '}${r.major.slice(0, 50)} (${r.campus})`);
    }

    // The anomaly test: among the top-30 demanded, list by access ascending.
    console.log('\n== the 30 most-demanded, worst access first ==');
    const top30 = [...rows].sort((a, b) => b.applicants - a.applicants).slice(0, 30)
      .sort((a, b) => a.access - b.access);
    for (const r of top30.slice(0, 14)) {
      console.log(`  access ${(r.access * 100).toFixed(0).padStart(3)}% · ${String(r.applicants).padStart(6)} applicants · ${r.cs ? 'CS → ' : ''}${r.major.slice(0, 50)} (${r.campus})`);
    }
    // Demand-weighted summary: access of the demand-weighted average student.
    const wAccess = (list) => list.reduce((s, r) => s + r.access * r.applicants, 0) / list.reduce((s, r) => s + r.applicants, 0);
    const csRows = rows.filter((r) => r.cs); const rest = rows.filter((r) => !r.cs);
    console.log(`\ndemand-weighted access — CS applicants: ${(wAccess(csRows) * 100).toFixed(0)}% · all other applicants: ${(wAccess(rest) * 100).toFixed(0)}%`);
  } finally { await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
