#!/usr/bin/env node
/**
 * Probe: dump the receiving-course titles the v2 classifier cannot place —
 * the "unclassified" squares in the Computing Bottleneck ledger. Reproduces
 * the simulator's instance definition exactly (binding-missing receivers in
 * unsatisfied required groups, income-matched districts) on both bases.
 */
const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');
const { bucketOf } = require('./lib/courseBuckets');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));
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
    const matchedDistricts = new Set([...new Set([...districtOf.values()])]
      .filter((d) => Number.isFinite(incomeOf.get(norm(d)))));

    const ucTitle = new Map();
    for (const c of await local.db('pmt_data').collection('university_courses')
      .find({}, { projection: { parent_id: 1, title: 1, prefix: 1, number: 1 } }).toArray()) {
      ucTitle.set(Number(c.parent_id), c.title || `${c.prefix} ${c.number}`);
    }
    const campusName = new Map();

    // Stated basis: unclassified binding-missing instances.
    const stated = new Map(); // `${campus}|${title}` -> count
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school: 1, uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(400);
    for await (const a of cursor) {
      if (!REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`)) continue;
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      if (!matchedDistricts.has(districtOf.get(Number(a.community_college_id)))) continue;
      campusName.set(Number(a.uc_school_id), String(a.uc_school || '').replace(/^University of California,\s*/i, ''));
      for (const g of a.requirement_groups) {
        if (g.is_required !== true) continue;
        if (isMajorArticulable({ requirement_groups: [g] }, true)) continue;
        for (const sct of g.sections || []) {
          for (const r of sct.receivers || []) {
            if (r.articulation_status !== 'not_articulated') continue;
            const pid = r.receiving?.kind === 'course' ? Number(r.receiving.parent_id) : null;
            if (pid == null) continue;
            const title = ucTitle.get(pid) || `course ${pid}`;
            if (bucketOf(title)) continue;
            const key = `${campusName.get(Number(a.uc_school_id))}|${title}`;
            stated.set(key, (stated.get(key) || 0) + 1);
          }
        }
      }
    }

    // Floor basis: unclassified curated-minimum requirement titles.
    const minRows = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('curated_requirements').find({ kind: 'transfer_minimum' }).toArray();
    const floorTitles = new Map();
    for (const row of minRows) {
      const pids = (row.parent_ids || []).map(Number).filter(Number.isFinite);
      const title = pids.length ? (ucTitle.get(pids[0]) || row.receiving_code || 'course') : (row.receiving_code || 'course');
      if (bucketOf(title)) continue;
      const key = `${row.school}|${title}`;
      floorTitles.set(key, (floorTitles.get(key) || 0) + 1);
    }

    const dump = (label, map) => {
      console.log(`\n== ${label} ==`);
      for (const [key, n] of [...map.entries()].sort((x, y) => y[1] - x[1])) {
        const [campus, title] = key.split('|');
        console.log(`  ${String(n).padStart(4)} × ${title}  (${campus})`);
      }
    };
    dump('STATED: unclassified binding-missing receiving titles (instance counts)', stated);
    dump('FLOOR: unclassified curated-minimum requirement titles (row counts, before per-college expansion)', floorTitles);
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
