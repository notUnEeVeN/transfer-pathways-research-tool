#!/usr/bin/env node
/**
 * Stamp every CA degree section with a canonical display category, so all 27
 * documents (9 campuses × 3 majors) read with ONE organization instead of each
 * campus's hand-authored idiosyncrasies.
 *
 * The taxonomy is DERIVED, not authored: each section's category comes from the
 * same classifier functions the figure engine applies (degreeSlots.namedPadding,
 * namedGeFlavored, resolveSectionTier), so the display bucket a section lands in
 * can never contradict how the figures counted it.
 *
 *   lower-division     transferable, non-GE — articulable at a community college
 *   general-education  GE/breadth flavored — satisfied via IGETC / area certification
 *   upper-division     nontransferable, non-GE — completed after transfer
 *   electives          padding blocks — unit room to the degree total
 *   unit-accounting    where units are earned, not courses to take
 *
 * TWO GATES, either failing rolls everything back:
 *   1. Additive-only: stripping the stamped fields must reproduce the original
 *      document byte-for-byte. This writer cannot change existing data.
 *   2. Figure fingerprint: coverage + credit-rate recomputed for all three
 *      majors must be byte-identical before/after.
 *
 *   node scripts/normalizeDegreeCategories.js            # dry run
 *   node scripts/normalizeDegreeCategories.js --apply
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { MongoClient } = require('mongodb');
const {
  namedPadding, namedGeFlavored, resolveSectionTier,
} = require('../services/degreeSlots');
const { getMajor } = require('../config/majors');
const { coverageData } = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');

const CATEGORY_ORDER = ['lower-division', 'general-education', 'upper-division', 'electives', 'unit-accounting'];

function categoryOf(group, section) {
  if (section.requirement_kind === 'unit-accounting') return 'unit-accounting';
  // Padding is a group-level classification in the reader; a padding group's
  // sections are all elective capacity.
  if (namedPadding(group)) return 'electives';
  if (namedGeFlavored(group, section)) return 'general-education';
  return resolveSectionTier(group, section) === 'nontransferable' ? 'upper-division' : 'lower-division';
}

/** Deep-clone with the stamped fields removed, for the additive-only proof. */
function stripStamps(doc) {
  const clone = JSON.parse(JSON.stringify(doc));
  for (const group of clone.requirement_groups || []) {
    delete group.category;
    for (const section of group.sections || []) delete section.category;
  }
  return clone;
}

async function figureFingerprint(db, majorSlug) {
  const parts = [];
  const coverage = await coverageData(db, db, { requirements: 'degree', majorSlug });
  parts.push(...coverage.map((r) => [
    'cov', r.school_id, r.community_college_id, r.pct_named_requirement_courses,
    r.named_requirement_courses_total, r.named_requirement_courses_articulated,
    r.pctUnits, r.unitCovered, r.pct_named_requirement_courses_with_ge,
  ].join(',')));
  // Every configured associate-degree slot, and a service failure is a GATE
  // FAILURE rather than an empty fingerprint that silently passes.
  const slots = getMajor(majorSlug)?.degreeAnalysisSlots?.length
    ? getMajor(majorSlug).degreeAnalysisSlots : ['ast', 'local_as'];
  for (const degreeType of slots) {
    const rate = await transferCreditRateData(db, db, { degreeType, majorSlug, verifiedOnly: false });
    const rows = rate.rows || rate || [];
    parts.push(...rows.map((r) => [
      'rate', degreeType, r.school_id ?? r.uc_school_id, r.community_college_id,
      r.full_degree_completion_pct, r.lower_division_completion_pct,
      r.as_unit_utilization_pct, r.extra_units,
    ].join(',')));
  }
  return parts.sort();
}

async function main() {
  const apply = process.argv.includes('--apply');
  // The classifier is state-neutral — it reads the same degreeSlots predicates
  // every figure reads — so the only state-specific part was this query. A
  // ported corpus needs the same stamps for the same reason California did:
  // the complexity figure keys its GE vertices on `category`, and an unstamped
  // corpus silently reads as having none.
  const stateArg = (process.argv.find((a) => a.startsWith('--state=')) || '').split('=')[1] || null;
  const stateClause = stateArg ? { state: stateArg } : { state: { $exists: false } };
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const degrees = await db.collection('curated_requirements')
    .find({ ...stateClause, kind: 'degree' }).sort({ _id: 1 }).toArray();
  console.log(`${stateArg || 'ca'}: ${degrees.length} bachelor templates`);

  const majors = [...new Set(degrees.map((d) => d.major_slug))];
  console.log('Baseline figures…');
  const before = {};
  for (const m of majors) before[m] = await figureFingerprint(db, m);

  const plan = [];
  const tally = {};
  const mixedGroups = [];
  for (const degree of degrees) {
    const doc = JSON.parse(JSON.stringify(degree));
    for (const group of doc.requirement_groups || []) {
      const unitsByCategory = {};
      for (const section of group.sections || []) {
        const category = categoryOf(group, section);
        section.category = category;
        tally[category] = (tally[category] || 0) + 1;
        unitsByCategory[category] = (unitsByCategory[category] || 0) + (Number(section.unit_advisement) || 0);
      }
      // The group's bucket is where most of its units live; ties break by
      // canonical order. Mixed groups are reported for the audit.
      const present = Object.keys(unitsByCategory);
      group.category = present.sort((a, b) => (unitsByCategory[b] - unitsByCategory[a])
        || (CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)))[0] || 'lower-division';
      if (present.length > 1) {
        mixedGroups.push({ doc: doc._id, group: group.title || '(untitled)', categories: present });
      }
    }
    // Gate 1: this writer is additive-only, provably. Stamps are stripped from
    // BOTH sides so a re-run (which rewrites earlier stamps) still proves it
    // touched nothing but the stamped fields.
    if (JSON.stringify(stripStamps(doc)) !== JSON.stringify(stripStamps(degree))) {
      throw new Error(`normalizer modified existing data on ${degree._id} — refusing`);
    }
    plan.push({ id: degree._id, original: degree, doc });
  }

  console.log('sections stamped:', JSON.stringify(tally));
  console.log(`mixed-category groups: ${mixedGroups.length}`);
  mixedGroups.slice(0, 8).forEach((m) => console.log('   ', m.doc, '|', String(m.group).slice(0, 44), '|', m.categories.join('+')));

  if (!apply) { console.log('\ndry run — re-run with --apply.'); await client.close(); return; }

  for (const p of plan) {
    await db.collection('curated_requirements').replaceOne({ _id: p.id }, p.doc);
  }
  console.log('\nwritten. Recomputing figures…');
  let drift = 0;
  for (const m of majors) {
    const after = await figureFingerprint(db, m);
    const b = before[m];
    if (b.length !== after.length) drift += Math.abs(b.length - after.length);
    for (let i = 0; i < Math.max(b.length, after.length); i += 1) if (b[i] !== after[i]) drift += 1;
  }
  if (drift) {
    console.log(`✗ ${drift} figure values moved — rolling back.`);
    for (const p of plan) await db.collection('curated_requirements').replaceOne({ _id: p.id }, p.original);
    process.exitCode = 1;
  } else {
    console.log('✓ every figure byte-identical. Categories are display metadata only.');
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
