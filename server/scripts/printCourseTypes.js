#!/usr/bin/env node
/**
 * Print the course-type assignment behind the MA Figure 2 recreation:
 * every requirement slot in every curated UC degree template, grouped by the
 * type courseTypes.js gives it. Local inspection only — the figure itself
 * reads the same typing through the coverage endpoint.
 *
 * Usage (from server/):  node scripts/printCourseTypes.js
 */
const path = require('path');
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const { typeOfSection, typeOfReceiver } = require('../services/courseTypes');
dotenv.config({ path: path.resolve(__dirname, '../../scripts/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
(async () => {
  const uri = process.env.MONGO_URI || process.env.TARGET_MONGO_URI;
  const client = await MongoClient.connect(uri);
  const db = client.db(process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research');
  const ucs = {};
  for (const c of await db.collection('assist_courses').find({ side: 'receiving' }, { projection: { parent_id: 1, prefix: 1, number: 1, title: 1 } }).toArray()) ucs[c.parent_id] = c;
  const degrees = await db.collection('curated_requirements').find({ kind: 'degree' }).sort({ school_id: 1 }).toArray();
  const perCampus = {}; const byType = { computing: [], math: [], science: [], non_stem: [] };
  for (const d of degrees) {
    perCampus[d.school] = { computing: 0, math: 0, science: 0, non_stem: 0 };
    for (const g of d.requirement_groups || []) for (const s of g.sections || []) {
      const ask = s.section_advisement ?? 1;
      const recvs = s.receivers || [];
      // Same grain as the figure: distinct-course sections type per receiver,
      // choose-N and free-text sections type as a whole.
      const parts = recvs.length === ask
        ? recvs.map((r) => ({ type: typeOfReceiver(r, g, ucs), slots: 1, receiver: r }))
        : [{ type: typeOfSection(s, g, ucs), slots: ask, receiver: recvs[0] }];
      for (const part of parts) {
        perCampus[d.school][part.type] += part.slots;
        const rec = part.receiver?.receiving || {};
        const pid = rec.kind === 'series' ? (rec.parent_ids || [])[0] : rec.parent_id;
        const label = ucs[pid] ? `${ucs[pid].prefix} ${ucs[pid].number}` : (rec.name || g.title || '').slice(0, 54);
        byType[part.type].push(`${d.school.padEnd(18)} ${String(g.tier || 'transferable').padEnd(16)} x${String(part.slots).padEnd(3)} ${label}`);
      }
    }
  }
  console.log('campus'.padEnd(20), 'comp  math   sci  nonSTEM  total');
  for (const [k, v] of Object.entries(perCampus)) console.log(k.padEnd(20), String(v.computing).padStart(4), String(v.math).padStart(5), String(v.science).padStart(5), String(v.non_stem).padStart(7), String(v.computing + v.math + v.science + v.non_stem).padStart(7));
  for (const t of ['computing', 'math', 'science', 'non_stem']) {
    console.log(`\n===== ${t} (${byType[t].length} sections)`);
    console.log(byType[t].join('\n'));
  }
  await client.close();
})();
