#!/usr/bin/env node
/**
 * Resolve categorical degree blocks into the pool of courses that satisfy them.
 *
 * A block like "Ten upper-division Biology courses (40 units)" names no course
 * because it is a CHOICE, not a list: any ten upper-division Biology courses
 * will do. Those are mechanical to resolve rather than research, because the UC
 * numbering convention is uniform — **a course numbered 100 or above is upper
 * division** — so the eligible set is every catalogue course in the block's
 * subject at or above 100.
 *
 * Unlike an enumerated requirement, a pool needs NO per-course unit value: the
 * section already states its own units, and the pool only says which courses
 * count toward them. That matters because two campus catalogues (Berkeley and
 * UCSB) carry almost no unit values, and demanding them would block exactly the
 * blocks this resolves.
 *
 * UNITS ARE NEVER TOUCHED. The block keeps its authored unit total; all that is
 * added is `eligibility` describing what may fill it and how many are needed.
 *
 *   node scripts/resolveDegreePools.js --major bio
 *   node scripts/resolveDegreePools.js --major bio --apply
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const { codeExpression } = require('./resolveDegreeCourseGaps');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** Subject vocabularies, matched against whatever prefixes a campus actually uses. */
const SUBJECTS = [
  { key: 'biology', words: /biolog|biological|life science/i, prefix: /^(BIO|BIOL|BILD|BIBC|BICD|BIEB|BIMM|BIPN|BISP|MCELLBI|INTEGBI|PLANTBI|EEMB|MCDB|BIS|BIOSCI|BIO SCI|NPB|EVE|MIC|PMB)/i },
  { key: 'economics', words: /econom/i, prefix: /^(ECON|ECN)/i },
  { key: 'computing', words: /computer science|computing|CSE|CMPSC|technical elective/i, prefix: /^(CS|CSE|CMPSC|COM SCI|COMPSCI|I&C SCI|ICS|EECS|ECS)/i },
  { key: 'science-engineering', words: /science\/engineering|science or engineering/i, prefix: /^(BIO|CHEM|PHYS|MATH|ENGR|CSE|EE|ME|MSE|BIOE|ESS)/i },
];

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
};

const courseNumber = (code) => {
  const m = String(code || '').match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
};

/**
 * Read a categorical block: how many courses, in what subject, at what level.
 * Returns null when the block is not a course pool at all.
 */
function readBlock(label, receiverCount, statedUnits) {
  const text = String(label || '');
  // Unit accounting, not a course requirement: "Units beyond the 105-unit
  // community-college transfer cap" describes where units are earned.
  if (/units? beyond|units earned at|transfer cap/i.test(text)) {
    return { kind: 'unit-accounting' };
  }
  if (/double-counts/i.test(text)) return { kind: 'unit-accounting' };

  const upper = /upper-division|upper division|advanced|approved/i.test(text);
  const subject = SUBJECTS.find((s) => s.words.test(text)) || null;
  // "Additional upper-division coursework" — any subject, upper division.
  const anyField = !subject && upper;
  if (!subject && !anyField) return null;

  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen)\b/i);
  const digitMatch = text.match(/\b(\d{1,2})\s+(?:courses?|approved|additional|upper)/i);
  // No single signal is reliable: Berkeley's label says "incl. one design
  // elective" (a constraint, not the count) while its section carries five
  // receivers; Davis writes "One complete six-course specialization" over a
  // single receiver. The count is the LARGEST consistent reading — label
  // number, receiver count, or the stated units at a standard course size.
  const labelCount = digitMatch ? Number(digitMatch[1])
    : wordMatch ? NUMBER_WORDS[wordMatch[1].toLowerCase()] : 0;
  const unitCount = Number(statedUnits) ? Math.round(Number(statedUnits) / 4) : 0;
  const count = Math.max(labelCount, receiverCount || 0, unitCount) || null;

  return {
    kind: 'pool',
    subject: subject?.key || 'any',
    prefix: subject?.prefix || null,
    min_number: upper ? 100 : 1,
    count,
    stated_units: statedUnits,
  };
}

function poolFor(block, catalogue) {
  const eligible = catalogue.filter((c) => {
    const num = courseNumber(c.course_code);
    if (num == null || num < block.min_number) return false;
    if (!block.prefix) return true;
    return block.prefix.test(String(c.course_code).trim());
  });
  return eligible;
}

async function main() {
  const major = arg('major', 'bio');
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const degrees = await db.collection('curated_requirements')
    .find({ state: { $exists: false }, kind: 'degree', major_slug: major }).sort({ _id: 1 }).toArray();

  let pools = 0; let accounting = 0; let unread = 0;
  const writes = [];
  for (const degree of degrees) {
    const catalogue = await db.collection('curated_prerequisites')
      .find({ institution_id: `uc:${degree.school_id}` }).project({ course_code: 1, course_name: 1, units: 1 }).toArray();
    const doc = JSON.parse(JSON.stringify(degree));
    let touched = 0;

    for (const group of doc.requirement_groups || []) {
      for (const section of group.sections || []) {
        const receivers = section.receivers || [];
        const explicit = receivers.some((r) => r.receiving?.parent_id != null || r.receiving?.code);
        if (explicit) continue;
        // A section that names ANY course — even one, even as an alternative —
        // is already specific. Berkeley biology enumerates 53 approved courses
        // and asks for six of them; swapping that for "any upper-division
        // biology course" would discard the approved list and admit 724.
        // Only blocks that name nothing at all are pools.
        const namesSomething = receivers.some((r) => codeExpression(r.receiving?.name || '').alternatives.length > 0);
        if (namesSomething) continue;
        const label = receivers[0]?.receiving?.name || section.title || group.title || '';
        const block = readBlock(label, section.section_advisement ?? receivers.length, section.unit_advisement);
        if (!block) { unread += 1; continue; }
        if (block.kind === 'unit-accounting') {
          accounting += 1;
          section.requirement_kind = 'unit-accounting';
          touched += 1;
          continue;
        }
        const eligible = poolFor(block, catalogue);
        if (!eligible.length) { unread += 1; continue; }
        pools += 1;
        touched += 1;
        // The block keeps its authored units; this only says what may fill it.
        section.eligibility = {
          rule: 'catalogue pool',
          subject: block.subject,
          min_course_number: block.min_number,
          courses_required: block.count,
          pool_size: eligible.length,
          pool_sample: eligible.slice(0, 12).map((c) => c.course_code),
          derived: 'UC numbering: a course numbered >= 100 is upper division',
        };
        console.log(`  ${String(degree.school).slice(0, 14).padEnd(15)} ${String(section.unit_advisement ?? '—').padStart(4)}u  `
          + `${String(block.count ?? '?').padStart(2)} × ${block.subject.padEnd(20)} pool ${String(eligible.length).padStart(5)}  ${String(label).slice(0, 44)}`);
      }
    }
    if (touched) writes.push({ id: degree._id, doc, touched });
  }

  console.log(`\npools resolved ${pools} | unit-accounting blocks marked ${accounting} | not a pool ${unread}`);
  if (!apply) { console.log('dry run — re-run with --apply.'); await client.close(); return; }
  for (const w of writes) {
    await db.collection('curated_requirements').replaceOne({ _id: w.id }, w.doc);
  }
  console.log(`written to ${writes.length} documents.`);
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
