#!/usr/bin/env node
/**
 * Probe: how do the Price of Place headline results change if "a complete
 * path exists" means the CURATED TRANSFER MINIMUMS (the hand-verified
 * eligibility floor) instead of ASSIST-strict (everything the campus lists
 * as required)? ASSIST listings for competitive campuses mix eligibility
 * with competitiveness, so the two bases answer different questions:
 * "can you be eligible" vs "can you complete the stated preparation."
 *
 * Uses the app database's curated_requirements (kind: transfer_minimum,
 * groups of alternative sets; a set is satisfied when every requirement in
 * it has some articulated parent course) and the app's assist_agreements for
 * the nine CS programs. Read-only.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { getMajor, programPairs } = require('../config/majors');

const placeSnapshot = require('../../frontend/src/analyses/priceOfPlaceSnapshot.json');

const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const pct = (v) => `${(v * 100).toFixed(1)}%`;

function receiverParentIds(receiver) {
  const receiving = receiver.receiving || {};
  if (receiving.kind === 'course' && receiving.parent_id != null) return [Number(receiving.parent_id)];
  if (receiving.kind === 'series') return (receiving.parent_ids || []).map(Number).filter(Number.isFinite);
  return [];
}

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  try {
    const db = atlas.db(process.env.DB_NAME || 'pmt_research');

    // District/quartile machinery, identical to the Place generator.
    const insts = await db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));
    const districtIncome = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../../analysis/data/district_income.v1.json'), 'utf8'));
    const incomeOf = new Map(Object.entries(districtIncome.districts)
      .map(([n, e]) => [norm(n), e?.catchment?.mean_agi_per_return]));
    const matched = [...new Set([...districtOf.values()])]
      .map((d) => ({ d, income: incomeOf.get(norm(d)) }))
      .filter((x) => Number.isFinite(x.income))
      .sort((a, b) => a.income - b.income);
    const quartileOf = new Map(matched.map((x, i) => [x.d, Math.min(3, Math.floor((i * 4) / matched.length))]));

    // Curated minimums: school -> groups -> alternative sets -> requirements.
    const rows = await db.collection('curated_requirements')
      .find({ kind: 'transfer_minimum' }).sort({ school_id: 1, group_id: 1, set_id: 1, source_order: 1 }).toArray();
    const minimums = new Map();
    for (const row of rows) {
      const sid = Number(row.school_id);
      if (!minimums.has(sid)) minimums.set(sid, { school: row.school, groups: new Map(), parentIds: new Set() });
      const m = minimums.get(sid);
      const g = String(row.group_id); const s = String(row.set_id);
      if (!m.groups.has(g)) m.groups.set(g, new Map());
      if (!m.groups.get(g).has(s)) m.groups.get(g).set(s, []);
      const pids = (row.parent_ids || []).map(Number).filter(Number.isFinite);
      for (const p of pids) m.parentIds.add(p);
      m.groups.get(g).get(s).push(pids);
    }

    const satisfiesMinimum = (m, articulated) => {
      for (const sets of m.groups.values()) {
        let groupOk = false;
        for (const reqs of sets.values()) {
          if (reqs.length && reqs.every((pids) => pids.some((p) => articulated.has(p)))) { groupOk = true; break; }
        }
        if (!groupOk) return false;
      }
      return true;
    };

    // Evaluate every CS agreement against its campus minimum.
    const pairs = programPairs(getMajor('cs').programs);
    const perProgram = new Map(); // school_id -> Map(district -> {seen, ok})
    for (const pair of pairs) {
      const m = minimums.get(Number(pair.school_id));
      if (!m) { console.log('no minimum for school', pair.school_id); continue; }
      const docs = await db.collection('assist_agreements')
        .find({ uc_school_id: pair.school_id, major: pair.major },
          { projection: { community_college_id: 1, requirement_groups: 1 } }).toArray();
      const byDistrict = new Map();
      for (const doc of docs) {
        const district = districtOf.get(Number(doc.community_college_id));
        if (!quartileOf.has(district)) continue;
        const articulated = new Set();
        for (const g of doc.requirement_groups || []) {
          for (const s of g.sections || []) {
            for (const r of s.receivers || []) {
              if (r.articulation_status !== 'articulated') continue;
              for (const p of receiverParentIds(r)) if (m.parentIds.has(p)) articulated.add(p);
            }
          }
        }
        const ok = satisfiesMinimum(m, articulated);
        const cell = byDistrict.get(district) || { seen: true, ok: false };
        cell.ok = cell.ok || ok;
        byDistrict.set(district, cell);
      }
      perProgram.set(pair.school_id, { school: m.school, byDistrict, agreements: docs.length });
    }

    // Per-campus q1/q4 shares (fig-1 analog) under minimums.
    console.log('== per campus, share of districts satisfying the curated minimum ==');
    const strictFig1 = new Map(placeSnapshot.fig1.map((p) => [p.campus, p]));
    for (const [sid, p] of perProgram) {
      const share = (q) => {
        const inQ = [...p.byDistrict.entries()].filter(([d]) => quartileOf.get(d) === q);
        return inQ.length ? inQ.filter(([, c]) => c.ok).length / inQ.length : null;
      };
      const short = p.school.replace(/^UC\s*/, '');
      const strict = strictFig1.get(short === 'Los Angeles' ? 'UCLA' : short);
      console.log(`${p.school.padEnd(18)} minimums Q1 ${pct(share(0))} → Q4 ${pct(share(3))}` +
        `   | assist-strict Q1 ${strict ? pct(strict.q1) : '?'} → Q4 ${strict ? pct(strict.q4) : '?'}`);
    }

    // District staircase under minimums (fig-3 method).
    const perDistrict = new Map();
    for (const p of perProgram.values()) {
      for (const [district, cell] of p.byDistrict) {
        const d = perDistrict.get(district) || { seen: 0, ok: 0 };
        d.seen += 1; if (cell.ok) d.ok += 1;
        perDistrict.set(district, d);
      }
    }
    const stair = [0, 1, 2, 3].map((q) => {
      const shares = [...perDistrict.entries()]
        .filter(([d]) => quartileOf.get(d) === q)
        .map(([, v]) => v.ok / v.seen);
      return shares.reduce((s, v) => s + v, 0) / shares.length;
    });
    console.log('\n== district access staircase ==');
    console.log('curated minimums:', stair.map(pct).join(' → '), `· gap ${((stair[3] - stair[0]) * 100).toFixed(1)} pts`);
    console.log('assist-strict:   ', placeSnapshot.fig3.cs.map(pct).join(' → '),
      `· gap ${((placeSnapshot.fig3.cs[3] - placeSnapshot.fig3.cs[0]) * 100).toFixed(1)} pts`);
    console.log('field (assist-strict):', placeSnapshot.fig3.field.map(pct).join(' → '));
  } finally { await atlas.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
