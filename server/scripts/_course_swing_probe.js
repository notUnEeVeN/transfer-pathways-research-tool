#!/usr/bin/env node
/**
 * Probe: the course-level version of the income question. For EVERY receiving
 * course demanded anywhere in the corpus: its overall articulation level
 * (share of colleges) and its poorest-to-richest swing. Then the fair
 * comparison — conditioned on contestedness, because courses near 0% or 100%
 * cannot show gradients: within the contested band, are Computer Science
 * courses more income-graded than everyone else's contested courses?
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { bucketOf } = require('./lib/courseBuckets');

const dnorm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
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
      .map(([n, e]) => [dnorm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(dnorm(d)) }))
      .filter((x) => Number.isFinite(x.income)).sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));
    const collegeQ = new Map();
    for (const [cid, d] of districtOf) if (quartileOf.has(d)) collegeQ.set(cid, quartileOf.get(d));

    const ucTitle = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1 } }).toArray()) {
      ucTitle.set(Number(c.parent_id), c.title || '');
    }

    // Per receiving course: colleges seen / articulated, split by quartile.
    // Articulation is campus-wide per course pair, so any agreement showing
    // the pair articulated marks the college.
    const courses = new Map(); // pid -> { seen: [Set×4], ok: [Set×4] }
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { community_college_id: 1, requirement_groups: 1 } }).batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) process.stdout.write(`  …${n}\r`);
      const college = Number(a.community_college_id);
      const q = collegeQ.get(college);
      if (q == null) continue;
      for (const g of a.requirement_groups || []) {
        for (const s of g.sections || []) {
          for (const r of s.receivers || []) {
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            if (!courses.has(pid)) {
              courses.set(pid, {
                seen: [new Set(), new Set(), new Set(), new Set()],
                ok: [new Set(), new Set(), new Set(), new Set()],
              });
            }
            const c = courses.get(pid);
            c.seen[q].add(college);
            if (r.articulation_status === 'articulated') c.ok[q].add(college);
          }
        }
      }
    }
    console.log(`scanned ${n} · ${courses.size} distinct receiving courses`);

    const rows = [];
    for (const [pid, c] of courses) {
      const seenTotal = c.seen.reduce((s, set) => s + set.size, 0);
      if (seenTotal < 80) continue;
      const okTotal = c.ok.reduce((s, set) => s + set.size, 0);
      const q1 = c.ok[0].size / Math.max(1, c.seen[0].size);
      const q4 = c.ok[3].size / Math.max(1, c.seen[3].size);
      const title = ucTitle.get(pid) || '';
      const bucket = bucketOf(title)?.id ?? null;
      rows.push({
        pid, title,
        cs: bucket != null && CS_BUCKETS.has(bucket),
        level: okTotal / seenTotal,
        swing: q4 - q1,
      });
    }
    console.log(`courses with broad coverage: ${rows.length} (CS-subject ${rows.filter((r) => r.cs).length})`);

    const mean = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
    const bands = [
      ['solved  (≥90%)', (r) => r.level >= 0.9],
      ['contested (10–90%)', (r) => r.level >= 0.1 && r.level < 0.9],
      ['hopeless (<10%)', (r) => r.level < 0.1],
    ];
    console.log('\n== level bands: where courses live, and mean swing inside each ==');
    for (const [label, keep] of bands) {
      const inBand = rows.filter(keep);
      const csIn = inBand.filter((r) => r.cs); const rest = inBand.filter((r) => !r.cs);
      console.log(`  ${label.padEnd(20)} all ${String(inBand.length).padStart(4)} · mean swing +${Math.round(mean(inBand.map((r) => r.swing)) * 100)}` +
        ` · CS n=${csIn.length}${csIn.length ? ` swing +${Math.round(mean(csIn.map((r) => r.swing)) * 100)}` : ''}` +
        ` · others n=${rest.length}${rest.length ? ` swing +${Math.round(mean(rest.map((r) => r.swing)) * 100)}` : ''}`);
    }

    // Composition: what share of each population's courses sit in each band.
    console.log('\n== where each population lives (share of its courses per band) ==');
    for (const [popLabel, pop] of [['CS-subject courses', rows.filter((r) => r.cs)], ['all other courses', rows.filter((r) => !r.cs)]]) {
      const parts = bands.map(([label, keep]) => `${label.split(' ')[0]} ${Math.round((pop.filter(keep).length / pop.length) * 100)}%`);
      console.log(`  ${popLabel.padEnd(20)} ${parts.join(' · ')}`);
    }

    console.log('\n== steepest contested courses, all subjects ==');
    const contested = rows.filter((r) => r.level >= 0.1 && r.level < 0.9);
    for (const r of [...contested].sort((a, b) => b.swing - a.swing).slice(0, 10)) {
      console.log(`  +${Math.round(r.swing * 100)} pts · level ${Math.round(r.level * 100)}% · ${r.cs ? 'CS → ' : ''}${r.title.trim().slice(0, 56)}`);
    }
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
