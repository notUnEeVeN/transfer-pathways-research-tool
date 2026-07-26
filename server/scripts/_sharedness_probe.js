#!/usr/bin/env node
/**
 * Probe: is the CS fall-off special, or does every major have one?
 * Definition that needs no hand labels: a required receiving course is
 * SERVICE if many majors at that campus require it (broad constituency),
 * NICHE if few do. Calculus is service for everyone; organic chemistry is
 * niche for biology; CS 61B is niche for CS. Then, per program:
 * articulation rate of its niche requirements — and the question becomes
 * "where do the nine CS programs sit in the field's niche-rate distribution?"
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { getMajor, programPairs } = require('../config/majors');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const NICHE_MAX_MAJORS = 2;   // required by ≤2 majors at the campus
const SERVICE_MIN_MAJORS = 6; // required by ≥6 majors

(async () => {
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    // Pass: per campus, how many majors require each receiving course; per
    // program, per required course, colleges seen and articulated.
    const majorsRequiring = new Map(); // `${campus}|${pid}` -> Set(major)
    const programs = new Map();        // `${campus}|${major}` -> Map(pid -> {seen, ok})
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
    console.log(`scanned ${n} agreements · ${programs.size} programs`);

    // Per program: pooled articulation over niche vs service cells.
    const rows = [];
    for (const [key, reqs] of programs) {
      const [campus, major] = [key.split('|')[0], key.split('|').slice(1).join('|')];
      let nicheOk = 0; let nicheSeen = 0; let nichePids = 0;
      let servOk = 0; let servSeen = 0;
      for (const [pid, req] of reqs) {
        const shared = majorsRequiring.get(`${campus}|${pid}`).size;
        if (shared <= NICHE_MAX_MAJORS) {
          nichePids += 1; nicheSeen += req.seen.size; nicheOk += req.ok.size;
        } else if (shared >= SERVICE_MIN_MAJORS) {
          servSeen += req.seen.size; servOk += req.ok.size;
        }
      }
      if (nicheSeen < 100 || servSeen < 100) continue; // needs both layers, measured
      rows.push({
        campus, major,
        cs: REGISTRY_CS.has(key),
        engineering: /engineering/i.test(major),
        nicheRate: nicheOk / nicheSeen,
        serviceRate: servOk / servSeen,
        nichePids,
      });
    }
    console.log(`programs with both layers: ${rows.length} (CS ${rows.filter((r) => r.cs).length})`);

    const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    const field = rows.filter((r) => !r.cs)
    console.log('\n== the universal fall-off (every major, pooled) ==');
    console.log(`service courses articulate: mean ${(mean(rows.map((r) => r.serviceRate)) * 100).toFixed(0)}%`);
    console.log(`niche courses articulate:   mean ${(mean(rows.map((r) => r.nicheRate)) * 100).toFixed(0)}%`);

    console.log('\n== is the CS fall-off deeper? per-program niche articulation rate ==');
    const csRows = rows.filter((r) => r.cs);
    console.log(`field (${field.length} programs): mean ${(mean(field.map((r) => r.nicheRate)) * 100).toFixed(0)}% · median ${(median(field.map((r) => r.nicheRate)) * 100).toFixed(0)}%`);
    const eng = field.filter((r) => r.engineering);
    console.log(`engineering majors (${eng.length}): mean ${(mean(eng.map((r) => r.nicheRate)) * 100).toFixed(0)}% · median ${(median(eng.map((r) => r.nicheRate)) * 100).toFixed(0)}%`);
    console.log(`the nine CS programs:`);
    for (const r of csRows.sort((a, b) => a.nicheRate - b.nicheRate)) {
      const pctile = Math.round((field.filter((f) => f.nicheRate < r.nicheRate).length / field.length) * 100);
      console.log(`  ${r.major.slice(0, 44).padEnd(44)} niche ${(r.nicheRate * 100).toFixed(0).padStart(3)}% · service ${(r.serviceRate * 100).toFixed(0)}% · field percentile ${pctile}`);
    }
    console.log(`CS mean niche rate: ${(mean(csRows.map((r) => r.nicheRate)) * 100).toFixed(0)}%`);

    console.log('\n== majors with the LEAST articulated niche layers (field) ==');
    for (const r of [...field].sort((a, b) => a.nicheRate - b.nicheRate).slice(0, 8)) {
      console.log(`  ${(r.major.slice(0, 40)).padEnd(40)} niche ${(r.nicheRate * 100).toFixed(0)}%`);
    }
    console.log('\n== majors with the MOST articulated niche layers ==');
    for (const r of [...field].sort((a, b) => b.nicheRate - a.nicheRate).slice(0, 5)) {
      console.log(`  ${(r.major.slice(0, 40)).padEnd(40)} niche ${(r.nicheRate * 100).toFixed(0)}%`);
    }
  } finally { await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
