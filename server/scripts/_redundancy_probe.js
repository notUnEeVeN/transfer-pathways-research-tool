#!/usr/bin/env node
/**
 * Probe: of the complete subject (college, program) cells, how many are
 * redundant in coverage terms — the same program already complete at another
 * college in the same district? Assumption-free version of the
 * "concentrated, not scarce" claim: a duplicated cell adds zero district
 * coverage no matter what one believes about movability.
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const { isMajorArticulable } = require('../services/analysis/eligibility');
const { getMajor, programPairs } = require('../config/majors');

const REGISTRY_CS = new Set(programPairs(getMajor('cs').programs)
  .map((pair) => `${pair.school_id}|${pair.major}`));

(async () => {
  const atlas = await MongoClient.connect(process.env.MONGO_URI);
  const local = await MongoClient.connect('mongodb://127.0.0.1:27017');
  try {
    const insts = await atlas.db(process.env.DB_NAME || 'pmt_research')
      .collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, district: 1 } }).toArray();
    const districtOf = new Map(insts.map((i) => [Number(i.source_id), i.district]));

    // district|program -> count of complete colleges
    const cellsPerDistrictProgram = new Map();
    let cells = 0;
    const cursor = local.db('pmt_data').collection('uc_agreements')
      .find({}, { projection: { uc_school_id: 1, major: 1, community_college_id: 1, requirement_groups: 1 } })
      .batchSize(200);
    let n = 0;
    for await (const a of cursor) {
      n += 1;
      if (n % 20000 === 0) console.error(`…${n}`);
      if (!REGISTRY_CS.has(`${a.uc_school_id}|${a.major}`)) continue;
      if (!Array.isArray(a.requirement_groups) || !a.requirement_groups.length) continue;
      const district = districtOf.get(Number(a.community_college_id));
      if (!district) continue;
      if (!isMajorArticulable(a, true)) continue;
      cells += 1;
      const key = `${district}|${a.uc_school_id}|${a.major}`;
      cellsPerDistrictProgram.set(key, (cellsPerDistrictProgram.get(key) || 0) + 1);
    }
    const covered = cellsPerDistrictProgram.size; // distinct district-programs opened
    const duplicated = cells - covered;
    console.log(`complete cells: ${cells}`);
    console.log(`distinct district-program doors opened: ${covered}`);
    console.log(`duplicated cells (add zero district coverage): ${duplicated} (${Math.round((duplicated / cells) * 100)}%)`);
    // How concentrated: distribution of colleges-per-open-door.
    const dist = {};
    for (const c of cellsPerDistrictProgram.values()) dist[c] = (dist[c] || 0) + 1;
    console.log('colleges per open door:', JSON.stringify(dist));
  } finally { await atlas.close(); await local.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
