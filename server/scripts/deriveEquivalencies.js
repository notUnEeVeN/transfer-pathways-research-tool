#!/usr/bin/env node
/**
 * Derive the course-equivalency dictionary from the stored ASSIST agreements.
 *
 * ASSIST's by-prefix pages are incomplete (UCLA especially), so the best
 * available record of "which CC courses satisfy which UC course" is the
 * union of every by-major agreement we store for a college × campus pair.
 * This script walks all California agreements, extracts each articulated
 * receiver ↔ sending-option edge, dedupes across majors, and writes one
 * document per distinct edge with full provenance:
 *
 *   {
 *     _id: 'eq:<college>:<university>:<hash>',
 *     college_id, university_id, community_college_id, uc_school_id,
 *     receiving: { kind, parent_ids, code, name },
 *     sending: [{ course_ids, codes }],          // each distinct option
 *     majors_articulated: ['Computer Science, B.S.', ...],
 *     majors_not_articulated: [...],             // conflicts stay visible
 *     seen_in: <count of agreements>,
 *   }
 *
 * The same physical articulation frequently appears under several majors —
 * that agreement across sources is the verification value; a receiver marked
 * articulated in one major and not in another is recorded, never collapsed.
 * Idempotent: deterministic ids, full replace per run. Re-run after porting
 * more majors and the dictionary widens automatically.
 *
 *   node scripts/deriveEquivalencies.js            # report only
 *   node scripts/deriveEquivalencies.js --apply    # upsert assist_equivalencies
 */
const crypto = require('node:crypto');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');

const receivingKey = (receiving) => {
  if (!receiving) return null;
  if (receiving.kind === 'series') return `series:${(receiving.parent_ids || []).map(Number).sort((a, b) => a - b).join(',')}`;
  if (receiving.parent_id != null) return `course:${Number(receiving.parent_id)}`;
  if (receiving.name) return `requirement:${String(receiving.name).toLowerCase().trim()}`;
  return null;
};

const optionKey = (option) => [...new Set((option.course_ids || []).map(Number))].sort((a, b) => a - b).join(',');

async function deriveEquivalencies(db) {
  const agreements = await db.collection('assist_agreements')
    .find({ state: { $exists: false } })
    .toArray();

  const edges = new Map();
  for (const agreement of agreements) {
    const college = agreement.college_id || `cc:${agreement.community_college_id}`;
    const university = agreement.university_id || `uc:${agreement.uc_school_id}`;
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          const rkey = receivingKey(receiver.receiving);
          if (!rkey) continue;
          const key = `${college}|${university}|${rkey}`;
          if (!edges.has(key)) {
            edges.set(key, {
              college_id: college,
              university_id: university,
              community_college_id: agreement.community_college_id,
              uc_school_id: agreement.uc_school_id,
              receiving: receiver.receiving,
              options: new Map(),
              majors_articulated: new Set(),
              majors_not_articulated: new Set(),
              seen_in: 0,
            });
          }
          const edge = edges.get(key);
          edge.seen_in += 1;
          const major = String(agreement.major || 'unknown');
          if (receiver.articulation_status === 'articulated') edge.majors_articulated.add(major);
          else if (receiver.articulation_status === 'not_articulated') edge.majors_not_articulated.add(major);
          for (const option of receiver.options || []) {
            const okey = optionKey(option);
            if (okey) edge.options.set(okey, option);
          }
        }
      }
    }
  }

  const docs = [];
  for (const [key, edge] of edges) {
    // Only edges that articulate somewhere carry equivalency information; a
    // receiver universally not-articulated is a gap, recorded per major in the
    // agreements themselves.
    if (!edge.majors_articulated.size && !edge.options.size) continue;
    const hash = crypto.createHash('md5').update(key).digest('hex').slice(0, 12);
    docs.push({
      _id: `eq:${edge.community_college_id}:${edge.uc_school_id}:${hash}`,
      college_id: edge.college_id,
      university_id: edge.university_id,
      community_college_id: edge.community_college_id,
      uc_school_id: edge.uc_school_id,
      receiving: edge.receiving,
      sending_options: [...edge.options.values()].map((option) => ({
        course_ids: [...new Set((option.course_ids || []).map(Number))].sort((a, b) => a - b),
        course_conjunction: option.course_conjunction || 'and',
      })),
      majors_articulated: [...edge.majors_articulated].sort(),
      majors_not_articulated: [...edge.majors_not_articulated].sort(),
      conflicted: edge.majors_articulated.size > 0 && edge.majors_not_articulated.size > 0,
      seen_in: edge.seen_in,
      derived_from: 'union of stored by-major ASSIST agreements (scripts/deriveEquivalencies.js)',
    });
  }
  return docs;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const docs = await deriveEquivalencies(db);

  const pairs = new Set(docs.map((doc) => `${doc.community_college_id}|${doc.uc_school_id}`));
  const conflicted = docs.filter((doc) => doc.conflicted);
  const multiMajor = docs.filter((doc) => doc.majors_articulated.length > 1);
  console.log(`edges: ${docs.length} across ${pairs.size} college×campus pairs`);
  console.log(`cross-verified by 2+ majors: ${multiMajor.length}`);
  console.log(`conflicted (articulated in one major, not in another): ${conflicted.length}`);
  conflicted.slice(0, 8).forEach((doc) => console.log(
    '  conflict:', doc.college_id, '×', doc.university_id,
    JSON.stringify(doc.receiving.code || doc.receiving.name || doc.receiving.parent_id),
    '| yes:', doc.majors_articulated.join('; '), '| no:', doc.majors_not_articulated.join('; ')));

  if (apply) {
    const collection = db.collection('assist_equivalencies');
    await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs);
    await collection.createIndex({ community_college_id: 1, uc_school_id: 1 });
    console.log('applied: assist_equivalencies rebuilt.');
  } else {
    console.log('dry run — re-run with --apply to write assist_equivalencies.');
  }
  await client.close();
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { deriveEquivalencies };
