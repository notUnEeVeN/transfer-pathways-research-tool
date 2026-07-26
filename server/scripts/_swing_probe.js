#!/usr/bin/env node
/**
 * Probe: the broad, no-cherry-picking test. For EVERY demand-matched program:
 * district-level access in the poorest and richest income quartiles, and the
 * swing between them. The discrepancy to explain is CS's income GRADIENT,
 * not its level — so the fair comparison is swings, program by program,
 * against engineering, the most-demanded majors, and the whole field.
 *
 * Known limitation, stated up front: programs closed everywhere on the
 * stated basis (UCLA Business Economics et al.) show swing 0 here, though
 * their floors might swing like UCLA CS's did (0 stated → 72 on the floor).
 * Those programs are listed as unmeasurable rather than counted as flat.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const dnorm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
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
      .map(([n, e]) => [dnorm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(dnorm(d)) }))
      .filter((x) => Number.isFinite(x.income)).sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));

    const demand = new Map();
    for (const d of await local.db('pmt_data').collection('uc_major_admissions').find({}).toArray()) {
      const key = `${Number(d.uc_school_id)}|${norm(d.major)}`;
      const applicants = (d.stats || []).reduce((s, st) => s + (st.applicants || 0), 0);
      demand.set(key, (demand.get(key) || 0) + applicants);
    }

    const programs = new Map(); // key -> [Set seen, Set complete] per quartile via district
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      if (/minor/i.test(a.major)) continue;
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      const campus = Number(a.uc_school_id);
      if (demand.get(`${campus}|${norm(a.major)}`) == null) continue;
      const district = districtOf.get(Number(a.community_college_id));
      const q = quartileOf.get(district);
      if (q == null) continue;
      const key = `${campus}|${a.major}`;
      if (!programs.has(key)) {
        programs.set(key, {
          seen: [new Set(), new Set(), new Set(), new Set()],
          complete: [new Set(), new Set(), new Set(), new Set()],
        });
      }
      const p = programs.get(key);
      p.seen[q].add(district);
      if (isMajorArticulable(a, true)) p.complete[q].add(district);
    }
    console.log(`scanned ${n}`);

    const rows = []; const unmeasurable = [];
    for (const [key, p] of programs) {
      const campus = Number(key.split('|')[0]);
      const major = key.split('|').slice(1).join('|');
      const totalSeen = p.seen.reduce((s, set) => s + set.size, 0);
      if (totalSeen < 60) continue;
      const q1 = p.complete[0].size / Math.max(1, p.seen[0].size);
      const q4 = p.complete[3].size / Math.max(1, p.seen[3].size);
      const overall = p.complete.reduce((s, set) => s + set.size, 0) / totalSeen;
      const row = {
        campus, major,
        cs: REGISTRY_CS.has(key),
        engineering: /engineering/i.test(major) && !REGISTRY_CS.has(key),
        applicants: demand.get(`${campus}|${norm(major)}`),
        q1, q4, swing: q4 - q1, overall,
      };
      if (overall === 0) unmeasurable.push(row);
      else rows.push(row);
    }
    console.log(`measurable programs ${rows.length} (CS ${rows.filter((r) => r.cs).length}) · closed-everywhere on stated (excluded, floors unknown): ${unmeasurable.length}`);

    const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
    const swingPts = (r) => Math.round(r.swing * 100);
    const groups = [
      ['nine CS programs', rows.filter((r) => r.cs)],
      ['engineering majors', rows.filter((r) => r.engineering)],
      ['top-30 by demand (non-CS)', [...rows.filter((r) => !r.cs)].sort((a, b) => b.applicants - a.applicants).slice(0, 30)],
      ['whole field (non-CS)', rows.filter((r) => !r.cs)],
    ];
    console.log('\n== mean poorest→richest swing, by group ==');
    for (const [label, g] of groups) {
      console.log(`  ${label.padEnd(28)} n=${String(g.length).padStart(3)} · mean swing +${Math.round(mean(g.map((r) => r.swing)) * 100)} pts`);
    }

    console.log('\n== every measurable program ranked by swing — top 20 ==');
    const bySwing = [...rows].sort((a, b) => b.swing - a.swing).slice(0, 20);
    for (const r of bySwing) {
      console.log(`  +${String(swingPts(r)).padStart(3)} pts (${Math.round(r.q1 * 100)}→${Math.round(r.q4 * 100)}) · ${String(r.applicants).padStart(5)} appl · ${r.cs ? 'CS → ' : r.engineering ? 'eng · ' : '     '}${r.major.slice(0, 46)} (${r.campus})`);
    }
    const csRows = rows.filter((r) => r.cs);
    const field = rows.filter((r) => !r.cs);
    for (const r of csRows.sort((a, b) => b.swing - a.swing)) {
      const pctile = Math.round((field.filter((f) => f.swing < r.swing).length / field.length) * 100);
      console.log(`  CS: ${r.major.slice(0, 40).padEnd(40)} swing +${swingPts(r)} · field percentile ${pctile}`);
    }
    console.log('\nclosed-everywhere high-demand programs (unmeasurable without curated floors):');
    for (const r of [...unmeasurable].sort((a, b) => b.applicants - a.applicants).slice(0, 6)) {
      console.log(`  ${String(r.applicants).padStart(5)} applicants · ${r.major.slice(0, 50)} (${r.campus})`);
    }
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
