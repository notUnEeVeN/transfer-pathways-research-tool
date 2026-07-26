#!/usr/bin/env node
/**
 * Probe: judge each major's bespoke-course articulation AGAINST ITS DEMAND.
 * Astronomy's unarticulated niche layer is excusable — nobody is queueing.
 * The claim to test: among the majors transfer students actually want
 * (applicants, from uc_major_admissions), Computer Science is the outlier
 * whose own-course layer is unsolved. Business — comparably demanded — is
 * near-100% solved.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { getMajor, programPairs } = require('../config/majors');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const SERVICE_MIN = 6; // own layer = required by fewer than this many majors

(async () => {
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    // Demand: transfer applicants per (campus, major).
    const demand = new Map();
    for (const d of await local.db('pmt_data').collection('uc_major_admissions').find({}).toArray()) {
      const key = `${Number(d.uc_school_id)}|${norm(d.major)}`;
      const applicants = (d.stats || []).reduce((s, st) => s + (st.applicants || 0), 0);
      demand.set(key, (demand.get(key) || 0) + applicants);
    }

    // Niche articulation per program (relaxed thresholds so all nine CS
    // programs place; niche = required by ≤2 majors at the campus).
    const majorsRequiring = new Map();
    const programs = new Map();
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      if (/minor/i.test(a.major)) continue;
      const campus = Number(a.uc_school_id);
      const college = Number(a.community_college_id);
      const key = `${campus}|${a.major}`;
      for (const g of a.requirement_groups || []) {
        if (g.is_required !== true) continue;
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            const mrKey = `${campus}|${pid}`;
            if (!majorsRequiring.has(mrKey)) majorsRequiring.set(mrKey, new Set());
            majorsRequiring.get(mrKey).add(a.major);
            if (!programs.has(key)) programs.set(key, new Map());
            const reqs = programs.get(key);
            if (!reqs.has(pid)) reqs.set(pid, { seen: new Set(), ok: new Set() });
            const req = reqs.get(pid);
            req.seen.add(college);
            if (r.articulation_status === 'articulated') req.ok.add(college);
          }
        }
      }
    }
    console.log(`scanned ${n}`);

    const rows = []
    for (const [key, reqs] of programs) {
      const campus = Number(key.split('|')[0]);
      const major = key.split('|').slice(1).join('|');
      let nOk = 0; let nSeen = 0; let nichePids = 0;
      for (const [pid, req] of reqs) {
        if (majorsRequiring.get(`${campus}|${pid}`).size >= SERVICE_MIN) continue;
        nichePids += 1; nSeen += req.seen.size; nOk += req.ok.size;
      }
      const applicants = demand.get(`${campus}|${norm(major)}`) ?? null;
      rows.push({
        campus, major,
        cs: REGISTRY_CS.has(key),
        applicants,
        nichePids,
        nicheRate: nSeen >= 50 ? nOk / nSeen : null,
      });
    }
    const withDemand = rows.filter((r) => r.applicants != null);
    console.log(`programs ${rows.length} · matched to admissions demand ${withDemand.length}`);

    // The demand-ranked table: the majors students actually queue for.
    const top = [...withDemand].sort((a, b) => b.applicants - a.applicants).slice(0, 22);
    console.log('\n== top programs by transfer applicants ==');
    console.log('applicants  niche-layer articulation   program');
    for (const r of top) {
      const nicheTxt = r.nicheRate == null
        ? (r.nichePids === 0 ? 'no niche layer' : 'thin')
        : `${Math.round(r.nicheRate * 100)}%`.padStart(4);
      console.log(`  ${String(r.applicants).padStart(6)}    ${String(nicheTxt).padEnd(14)}  ${r.cs ? '→ CS ' : '     '}${r.major.slice(0, 52)} (${r.campus})`);
    }

    // Demand-weighted seriousness: among the top-30 demanded programs WITH a
    // niche layer, where does CS sit?
    const topWithNiche = [...withDemand].filter((r) => r.nicheRate != null)
      .sort((a, b) => b.applicants - a.applicants).slice(0, 30);
    console.log('\n== of the 30 most-demanded programs with a measurable niche layer ==');
    for (const r of topWithNiche.sort((a, b) => a.nicheRate - b.nicheRate).slice(0, 12)) {
      console.log(`  niche ${Math.round(r.nicheRate * 100)}%`.padEnd(14) + ` · ${String(r.applicants).padStart(6)} applicants · ${r.cs ? 'CS → ' : ''}${r.major.slice(0, 48)} (${r.campus})`);
    }
  } finally { await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
