#!/usr/bin/env node
/**
 * Probe: does CS participation follow CS access? Per college: CS associate
 * completions per 1,000 enrolled students, grouped by how many of the nine
 * programs are open from that college and by district income quartile. If
 * participation is higher where access is open, the difference times the
 * headcount behind the wall estimates the CS transfer attempts the missing
 * paperwork may be suppressing. Observational — access and wealth travel
 * together, so this bounds, it does not prove.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const placeSnapshot = require('../../frontend/src/analyses/priceOfPlaceSnapshot.json');
const ipeds = require('../../analysis/data/ipeds_ccc.v1.json');
const dnorm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  try {
    const insts = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, name: 1, district: 1 } }).toArray();
    const districtIncome = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/district_income.v1.json'), 'utf8'));
    const incomeOf = new Map(Object.entries(districtIncome.districts)
      .map(([n, e]) => [dnorm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set(insts.map((i) => i.district))]
      .map((d) => ({ d, income: incomeOf.get(dnorm(d)) }))
      .filter((x) => Number.isFinite(x.income)).sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));
    const districtByCollegeId = new Map(insts.map((i) => [Number(i.source_id), i.district]));

    // Join: reach (strict, from the wall) + headcount (IPEDS) + quartile.
    const byName = new Map(ipeds.colleges.map((c) => [dnorm(c.name), c]));
    const rows = [];
    for (const w of placeSnapshot.wall.colleges) {
      const ip = byName.get(dnorm(w.name));
      if (!ip || !ip.headcount) continue;
      const q = quartileOf.get(districtByCollegeId.get(ip.college_id));
      rows.push({
        name: w.name, reach: w.reach, completions: w.completions,
        headcount: ip.headcount, quartile: q,
      });
    }
    console.log(`colleges joined: ${rows.length}`);

    const rate = (list) => {
      const c = list.reduce((s, r) => s + r.completions, 0);
      const h = list.reduce((s, r) => s + r.headcount, 0);
      return { perK: (c / h) * 1000, completions: c, headcount: h, n: list.length };
    };
    const fmt = (g) => `${g.perK.toFixed(2)} per 1,000 (${g.completions.toLocaleString()} completers · ${(g.headcount / 1000).toFixed(0)}k students · ${g.n} colleges)`;

    console.log('\n== CS associate completions per 1,000 students, by college CS reach ==');
    const bands = [
      ['reach 0–2 of nine', (r) => r.reach <= 2],
      ['reach 3–4', (r) => r.reach > 2 && r.reach <= 4],
      ['reach 5–6', (r) => r.reach > 4 && r.reach <= 6],
      ['reach 7+', (r) => r.reach >= 7],
    ];
    for (const [label, keep] of bands) {
      console.log(`  ${label.padEnd(20)} ${fmt(rate(rows.filter(keep)))}`);
    }

    console.log('\n== by district income quartile ==');
    for (const q of [0, 1, 2, 3]) {
      console.log(`  Q${q + 1}  ${fmt(rate(rows.filter((r) => r.quartile === q)))}`);
    }

    console.log('\n== reach within income halves (to separate the two, roughly) ==');
    for (const [half, keep] of [['poorer half', (r) => r.quartile <= 1], ['richer half', (r) => r.quartile >= 2]]) {
      const lo = rate(rows.filter((r) => keep(r) && r.reach <= 4));
      const hi = rate(rows.filter((r) => keep(r) && r.reach >= 7));
      console.log(`  ${half}: reach ≤4 ${lo.perK.toFixed(2)} vs reach 7+ ${hi.perK.toFixed(2)} per 1,000  (n=${lo.n} vs ${hi.n})`);
    }

    // The suppressed-demand bound: if narrow-access colleges produced CS
    // completers at the open-access rate.
    const open = rate(rows.filter((r) => r.reach >= 7));
    const narrow = rate(rows.filter((r) => r.reach <= 4));
    const extra = (open.perK - narrow.perK) / 1000 * narrow.headcount;
    console.log(`\nif the ${narrow.n} narrow-access colleges (${(narrow.headcount / 1000).toFixed(0)}k students) matched the open-access rate:`);
    console.log(`  ${Math.round(extra).toLocaleString()} additional CS completers per year (${narrow.completions.toLocaleString()} today → ${Math.round(narrow.completions + extra).toLocaleString()})`);
    console.log('  — an observational bound: access and wealth travel together, and completions undercount transfer-intent students.');
  } finally { await atlas.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
