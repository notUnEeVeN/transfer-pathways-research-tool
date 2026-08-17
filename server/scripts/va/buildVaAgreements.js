#!/usr/bin/env node
/**
 * Derive Virginia per-pair transfer agreements.
 *
 * California gets agreements from ASSIST and Massachusetts got them from the
 * paper's workbooks. Virginia publishes the two halves separately and never
 * joins them:
 *
 *   va_courses      — each VCCS course, which colleges offer it (`offered_by`)
 *                     and what it lands as at each four-year (`articulates_to`)
 *   va_requirements — what each four-year's CS degree requires (`code_seen`
 *                     per receiver), already tiered by the collection pipeline
 *
 * The join across them is the agreement: for a (community college × four-year)
 * pair, a requirement is articulated when some course the college offers lands
 * as the course that requirement names. Output is written to
 * `assist_agreements` with `state: 'va'`, in the same shape the California
 * engine already reads, so every figure runs unmodified.
 *
 * Two rules carry the accuracy of the result:
 *
 * 1. **Generic credit never satisfies a named requirement.** Virginia records
 *    roughly a quarter of its articulations as unspecified elective credit
 *    ("SOC268 lands as SOCY2XX — Sociology Transfer Elective"). That credit
 *    transfers but does not fill a named slot; `vaCourseCodes.satisfies`
 *    enforces the asymmetry.
 * 2. **Every match is consumed.** A college can offer several courses fitting
 *    one generic band and a degree can repeat an elective slot, so matching by
 *    membership would credit one course to many slots. Supply is a multiset and
 *    each entry is spent once.
 *
 * Named requirements are matched before generic ones, so a course that can fill
 * a specific slot is never spent on an elective slot first — the same
 * best-case-student reading the California credit-rate figure documents.
 *
 *   node scripts/va/buildVaAgreements.js            # report only
 *   node scripts/va/buildVaAgreements.js --apply    # write assist_agreements
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { parseCourseCode, satisfies } = require('../../services/vaCourseCodes');

/** Reserved numeric id blocks; California uses 2–200 and Massachusetts 9001–9115. */
const VA_UNIVERSITY_BASE = 9201;
const VA_COLLEGE_BASE = 9301;

const slugify = (value) => String(value ?? '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A receiver demands one or more codes; a series demands all of its parts. */
function demandedCodes(receiver) {
  const seen = String(receiver?.code_seen ?? '').trim();
  if (seen) return seen.split(/\s*\+\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  const name = receiver?.receiving?.name;
  return name ? [String(name).trim()] : [];
}

/**
 * A receiver is generic when it names no specific course — a category, a GE
 * area, or a free-text requirement. Generic receivers are the only ones
 * Virginia's unspecified elective credit can fill.
 */
function isGenericReceiver(receiver) {
  const kind = receiver?.receiving?.kind;
  if (kind === 'category' || kind === 'ge_area' || kind === 'requirement') return true;
  const codes = demandedCodes(receiver);
  if (!codes.length) return true;
  return codes.every((code) => parseCourseCode(code).kind !== 'concrete');
}

/**
 * Build one agreement's requirement groups.
 *
 * `supply` is the college's articulated identifiers at this four-year, each
 * `{ identifier, course_id, course_key, code }`. Returns the rebuilt groups
 * plus the tallies the report prints.
 */
function articulateGroups(degree, supply) {
  const pool = supply.map((entry) => ({ entry, used: false }));
  const claim = (codes) => {
    // A series needs every part, and each part spends its own supply row.
    const spent = [];
    for (const code of codes) {
      const row = pool.find((candidate) => !candidate.used && !spent.includes(candidate)
        && satisfies(code, candidate.entry.identifier));
      if (!row) return null;
      spent.push(row);
    }
    spent.forEach((row) => { row.used = true; });
    return spent.map((row) => row.entry);
  };

  // Index every receiver once, then resolve named demands before generic ones
  // so a specific course is not spent filling an elective slot.
  const slots = [];
  const groups = (degree.requirement_groups || []).map((group) => ({
    ...group,
    sections: (group.sections || []).map((section) => ({
      ...section,
      receivers: (section.receivers || []).map((receiver) => {
        const slot = {
          receiver, section, generic: isGenericReceiver(receiver), codes: demandedCodes(receiver), matched: null,
        };
        slots.push(slot);
        return slot;
      }),
    })),
  }));

  for (const generic of [false, true]) {
    for (const slot of slots) {
      if (slot.generic !== generic || slot.matched || !slot.codes.length) continue;
      // The collection pipeline already decided which requirements a community
      // college could ever satisfy; upper-division residency work is excluded
      // at the source rather than by our matcher.
      if (slot.section?.cc_articulable === false) continue;
      slot.matched = claim(slot.codes);
    }
  }

  let articulated = 0; let considered = 0;
  const rebuilt = groups.map((group) => ({
    ...group,
    sections: group.sections.map((section) => ({
      ...section,
      receivers: section.receivers.map((slot) => {
        const { receiver, matched } = slot;
        if (slot.section?.cc_articulable !== false && slot.codes.length) considered += 1;
        if (matched) articulated += 1;
        return {
          ...receiver,
          articulation_status: matched ? 'articulated' : 'not_articulated',
          options: matched
            ? [{
              course_ids: matched.map((entry) => entry.course_id).filter((id) => id != null),
              course_keys: matched.map((entry) => entry.course_key).filter(Boolean),
              course_conjunction: 'and',
            }]
            : [],
        };
      }),
    })),
  }));
  return { groups: rebuilt, articulated, considered };
}

/**
 * Derive every (college × four-year) agreement.
 *
 * `courses` are va_courses documents, `degrees` the extracted four-year degree
 * documents, `colleges`/`universities` the institution rows.
 */
function deriveVaAgreements({ courses, degrees, colleges, universities }) {
  // Key institutions on their own document id, not on a slug of their display
  // name: "William & Mary" slugs to `william-and-mary` while its id and the
  // degree that points at it both say `william-mary`.
  const idSlug = (row) => String(row._id ?? '').replace(/^va:(inst|uni|cc):/, '');
  const collegeIdBySlug = new Map(colleges.map((row, index) => [idSlug(row), VA_COLLEGE_BASE + index]));
  const collegeNameBySlug = new Map(colleges.map((row) => [idSlug(row), row.name]));
  const collegeSlugByName = new Map(colleges.map((row) => [slugify(row.name), idSlug(row)]));
  const universityBySlug = new Map(universities.map((row, index) => [idSlug(row), {
    numericId: VA_UNIVERSITY_BASE + index, name: row.name,
  }]));
  const universitySlugByName = new Map(universities.map((row) => [slugify(row.name), idSlug(row)]));

  // supply[collegeSlug][universitySlug] = articulated identifiers
  const supply = new Map();
  for (const course of courses) {
    // `offered_by` and `articulates_to[].institution` are display names, so they
    // resolve through the name index back to the document id.
    const offered = (course.offered_by || [])
      .map((name) => collegeSlugByName.get(slugify(name)))
      .filter(Boolean);
    if (!offered.length) continue;
    for (const edge of course.articulates_to || []) {
      const uniSlug = universitySlugByName.get(slugify(edge.institution));
      if (!uniSlug || !universityBySlug.has(uniSlug)) continue;
      const entry = {
        identifier: edge.identifier,
        course_id: course.course_id,
        course_key: course.course_key,
        code: course.code,
      };
      for (const collegeSlug of offered) {
        if (!supply.has(collegeSlug)) supply.set(collegeSlug, new Map());
        const byUni = supply.get(collegeSlug);
        if (!byUni.has(uniSlug)) byUni.set(uniSlug, []);
        byUni.get(uniSlug).push(entry);
      }
    }
  }

  const agreements = [];
  const withoutEquivalencies = [];
  for (const degree of degrees) {
    const uniSlug = String(degree.institution_id || '').replace(/^va:(uni|inst):/, '');
    const university = universityBySlug.get(uniSlug);
    if (!university) {
      withoutEquivalencies.push({ degree_id: degree._id, reason: 'no institution record' });
      continue;
    }
    // A four-year that publishes no equivalencies at all (the University of
    // Virginia and Virginia Military Institute do not) has requirements but no
    // articulation evidence. Emitting zeroes would read as "nothing transfers"
    // when the truth is "nothing is published" — leave the pair out and say so.
    const anySupply = [...collegeIdBySlug.keys()].some((slug) => (supply.get(slug)?.get(uniSlug) || []).length);
    if (!anySupply) {
      withoutEquivalencies.push({ degree_id: degree._id, reason: 'no published course equivalencies' });
      continue;
    }
    for (const [collegeSlug, numericId] of collegeIdBySlug) {
      const entries = supply.get(collegeSlug)?.get(uniSlug) || [];
      const { groups, articulated, considered } = articulateGroups(degree, entries);
      agreements.push({
        _id: `va:agreement:${university.numericId}:${numericId}`,
        university_id: `va:uni:${uniSlug}`,
        college_id: `va:cc:${collegeSlug}`,
        uc_school_id: university.numericId,
        community_college_id: numericId,
        university_name: university.name,
        college_name: collegeNameBySlug.get(collegeSlug),
        major: 'Computer Science, B.S.',
        state: 'va',
        source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
        pairing: 'course-equivalency-join',
        derived_from: { degree_id: degree._id, supply_edges: entries.length },
        articulated_receivers: articulated,
        considered_receivers: considered,
        requirement_groups: groups,
      });
    }
  }
  agreements.withoutEquivalencies = withoutEquivalencies;
  return agreements;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const [courses, degrees, institutions] = await Promise.all([
    db.collection('va_courses').find({}).toArray(),
    db.collection('va_requirements').find({ kind: 'degree', status: 'extracted' }).toArray(),
    db.collection('va_institutions').find({}).toArray(),
  ]);
  const colleges = institutions.filter((row) => row.level === 'community_college')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const universities = institutions.filter((row) => row.level === 'four_year')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const agreements = deriveVaAgreements({ courses, degrees, colleges, universities });
  const rates = agreements.map((a) => (a.considered_receivers
    ? (100 * a.articulated_receivers) / a.considered_receivers : 0));
  const mean = rates.reduce((sum, value) => sum + value, 0) / (rates.length || 1);
  const withSupply = agreements.filter((a) => a.derived_from.supply_edges > 0);

  console.log(`agreements: ${agreements.length} (${degrees.length} degrees × ${colleges.length} colleges)`);
  console.log(`pairs with any articulation edge: ${withSupply.length}`);
  for (const skipped of agreements.withoutEquivalencies || []) {
    console.log(`  excluded: ${skipped.degree_id} — ${skipped.reason}`);
  }
  console.log(`mean articulated share of CC-articulable receivers: ${mean.toFixed(1)}%`);
  const byUni = new Map();
  for (const a of agreements) {
    if (!byUni.has(a.university_name)) byUni.set(a.university_name, []);
    byUni.get(a.university_name).push(a.considered_receivers
      ? (100 * a.articulated_receivers) / a.considered_receivers : 0);
  }
  console.log('\nper four-year mean:');
  [...byUni].map(([name, values]) => [name, values.reduce((s, v) => s + v, 0) / values.length])
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, value]) => console.log('  ', value.toFixed(1).padStart(5) + '%', name));

  if (apply) {
    const collection = db.collection('assist_agreements');
    await collection.deleteMany({ state: 'va' });
    if (agreements.length) await collection.insertMany(agreements);
    console.log(`\napplied: ${agreements.length} Virginia agreements written.`);
  } else {
    console.log('\ndry run — re-run with --apply to write assist_agreements.');
  }
  await client.close();
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = {
  deriveVaAgreements, articulateGroups, isGenericReceiver, demandedCodes, slugify,
  VA_UNIVERSITY_BASE, VA_COLLEGE_BASE,
};
