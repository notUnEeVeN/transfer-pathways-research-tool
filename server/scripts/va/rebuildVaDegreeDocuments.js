#!/usr/bin/env node
/**
 * Rebuild Virginia's degree documents from published Transfer Guides.
 *
 * The coverage figure divides articulated named requirements by all named
 * requirements, and it takes that denominator from `curated_requirements`.
 * Virginia's documents were composed from each university's own catalog, so the
 * denominator was the catalog's course list — 24 named courses per degree,
 * mostly upper-division — while the numerator came from a transfer guide that
 * only ever speaks about lower-division preparation. Coverage read 15.9%: not a
 * measurement, a mismatch between two different statements of the degree.
 *
 * A guide states the whole degree in its own terms. Its community-college half
 * is the preparation, its post-transfer half is what remains, and the two sum
 * to the credential. Taking the guide as the degree makes numerator and
 * denominator the same document, which is what the figure assumes and what the
 * California and Massachusetts corpora already satisfy.
 *
 * That also fixes the ceiling. A guide splits the degree roughly evenly, so
 * about half the named work sits after the transfer point and no community
 * college can reach it. Coverage therefore tops out near 49%, and the distance
 * below that is supply — whether a college's own catalogue carries the course
 * the guide asks for.
 *
 * The catalog-composed documents are not deleted blindly: `--apply` writes a
 * snapshot to `.va-backups/` first, and the catalog remains the better source
 * for anything asking what a university requires overall rather than what a
 * transfer student is told to take.
 *
 *   node scripts/va/rebuildVaDegreeDocuments.js            # dry run
 *   node scripts/va/rebuildVaDegreeDocuments.js --apply    # replace, after backup
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { outcome, credits } = require('./buildGuideFigures');
const { UNIVERSITY_GUIDES } = require('./rebuildVaAgreements');
const { institutionCourseIdFor } = require('../../services/virginia/courseIdentity');
const { CANONICAL_SOURCE_CONTRACT } = require('../../services/analysis/canonicalSourceContract');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const BACKUPS = path.join(SERVER, '.va-backups');
const MAJOR_SLUG = 'va-cs';
const PROGRAM = 'Computer Science, B.S.';
const APPLIED = new Set(['named_course', 'named_requirement']);
const COURSE_TOKEN = /\b[A-Z]{2,5}\s?\d{3,4}[A-Z]?\b/g;

/** Every receiving course a guide cell names. A cell may name several. */
function receivingCourses(schoolId, text) {
  const out = [];
  for (const token of String(text || '').match(COURSE_TOKEN) || []) {
    const code = token.replace(/\s+/g, '');
    try {
      const id = institutionCourseIdFor(`va:uni:${schoolId}`, code);
      if (id != null && !out.some((x) => x.id === id)) out.push({ id, code });
    } catch { /* not a resolvable course code */ }
  }
  return out;
}

/**
 * A degree receiver. `articulation_status` is null by design: the document
 * states the requirement, and the coverage evaluator decides whether a given
 * community college discharges it by matching an agreement's receiver on
 * `receiving.parent_id`.
 */
const receiver = ({ id, code }, units) => ({
  articulation_status: null,
  not_articulated_reason: null,
  options: [],
  options_conjunction: 'or',
  hash_id: null,
  tier: null,
  course_level: null,
  cc_articulable: null,
  overlap_key: null,
  note: null,
  receiving: { kind: 'course', parent_id: id, units },
  code_seen: code,
  human_review: null,
});

const section = (receivers, over = {}) => ({
  section_advisement: 1,
  unit_advisement: null,
  unit_advisement_max: null,
  label_seen: null,
  tier: 'transferable',
  course_level: 'lower_division',
  cc_articulable: true,
  source_refs: ['transfer_guide'],
  note: null,
  overlap_key: null,
  human_review: null,
  analysis_constraints: [],
  assume_satisfiable: false,
  ...over,
  receivers,
});

/**
 * Build the guide's requirement tree onto the EXISTING degree document.
 *
 * A degree document carries far more than its requirements: acceptance and
 * verification records, provenance, unit audits, catalog year, readiness flags.
 * The coverage path reads several of them, and a document authored from scratch
 * without them is loaded and then silently scores nothing — which is what a
 * from-scratch rebuild did. Only the requirement tree is guide-derived; every
 * other field is carried across untouched, so the composition, its human
 * verification record and its provenance all still describe the same degree.
 */
function degreeFor(university, guide, existing) {
  const codesSeen = new Set();
  const titles = {};

  const prep = [];
  for (const item of guide.cc_items.filter((i) => i.counts_toward_stats)) {
    if (!APPLIED.has(outcome(item.equivalent))) continue;
    const courses = receivingCourses(university.source_id, item.equivalent);
    if (!courses.length) continue;
    const units = credits(item.credits) ?? 0;
    for (const course of courses) {
      codesSeen.add(course.code);
      titles[course.code] = item.requirement_text;
    }
    // Each named receiving course is its own requirement, so a cell naming two
    // discharges two. Splitting them into one section keeps them a unit of the
    // same guide row.
    prep.push(section(courses.map((course) => receiver(course, units / courses.length))));
  }

  const post = [];
  for (const item of (guide.post_items || []).filter((p) => p.counts_toward_stats)) {
    const courses = receivingCourses(university.source_id, item.requirement_text);
    if (!courses.length) continue;
    const units = credits(item.credits) ?? 0;
    for (const course of courses) {
      codesSeen.add(course.code);
      titles[course.code] = item.requirement_text;
    }
    post.push(section(courses.map((course) => receiver(course, units / courses.length)), {
      tier: 'nontransferable', course_level: 'upper_division', cc_articulable: false,
    }));
  }

  const group = (title, sections, over) => ({
    title,
    is_required: true,
    group_conjunction: 'And',
    requirement_layer: 'major',
    tier: 'transferable',
    course_level: 'lower_division',
    cc_articulable: true,
    source_refs: ['transfer_guide'],
    note: null,
    overlap_key: null,
    human_review: null,
    analysis_constraints: [],
    stated_credits: null,
    distinct_course_ids_across_sections: false,
    ...over,
    sections,
  });

  return {
    ...existing,
    // Virginia declares `canonicalSourceRequirements`; the evaluator reads the
    // named-requirement population only from documents carrying this contract.
    analysis_contract: existing.analysis_contract || { ...CANONICAL_SOURCE_CONTRACT },
    codes_seen: [...codesSeen].sort(),
    course_titles: { ...existing.course_titles, ...titles },
    requirements_source: 'transfer_guide',
    guide_source_url: guide.source_url,
    derived_from: { guide_slug: guide.slug, guide_title: guide.title },
    requirement_groups: [
      group('Transferable preparation', prep, {
        note: 'Community-college coursework the guide directs a transfer student to complete.',
      }),
      group('Post-transfer requirements', post, {
        tier: 'nontransferable',
        course_level: 'upper_division',
        cc_articulable: false,
        note: 'Coursework the guide places after the transfer point; no community college supplies it.',
      }),
    ],
    rebuilt_at: new Date().toISOString(),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const bySlug = new Map(guides.map((g) => [g.slug, g]));

  const client = await MongoClient.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = client.db('pmt_research');
  const institutions = await db.collection('assist_institutions')
    .find({ state: 'va', kind: 'university' }).toArray();
  const byName = new Map(institutions.map((i) => [i.name, i]));

  const priorDocs = await db.collection('curated_requirements')
    .find({ state: 'va', kind: 'degree' }).toArray();
  const priorById = new Map(priorDocs.map((d) => [d.school_id, d]));

  const documents = [];
  for (const [name, slug] of Object.entries(UNIVERSITY_GUIDES)) {
    const university = byName.get(name);
    if (!university) throw new Error(`no institution row for ${name}`);
    const existing = priorById.get(university.source_id);
    if (!existing) {
      throw new Error(`no existing degree document for ${name} (${university.source_id}). `
        + 'This script re-trees an existing document; it cannot author one from scratch.');
    }
    documents.push(degreeFor(university, bySlug.get(slug), existing));
  }

  const existing = await db.collection('curated_requirements')
    .countDocuments({ state: 'va', kind: 'degree' });
  console.log(`existing VA degree documents : ${existing}`);
  console.log(`rebuilt from guides          : ${documents.length}`);
  for (const doc of documents) {
    const groups = doc.requirement_groups;
    const named = groups.map((g) => g.sections.reduce((n, s) => n + s.receivers.length, 0));
    console.log(`  ${doc.school.slice(0, 40).padEnd(40)} prep ${String(named[0]).padStart(2)} · post ${String(named[1]).padStart(2)} · ${named[0] + named[1]} named`);
  }
  const total = documents.reduce((n, d) => n + d.requirement_groups
    .reduce((m, g) => m + g.sections.reduce((k, s) => k + s.receivers.length, 0), 0), 0);
  console.log(`named requirements total     : ${total}`);

  if (!apply) {
    console.log('\ndry run — pass --apply to replace the Virginia degree documents');
    await client.close();
    return;
  }

  fs.mkdirSync(BACKUPS, { recursive: true });
  const prior = await db.collection('curated_requirements')
    .find({ state: 'va', kind: 'degree' }).toArray();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(BACKUPS, `curated_requirements.va.degree.${stamp}.json`);
  fs.writeFileSync(out, JSON.stringify({
    backed_up_at: new Date().toISOString(),
    collection: 'curated_requirements',
    filter: { state: 'va', kind: 'degree' },
    note: 'Catalog-composed Virginia degree documents, replaced by transfer-guide-derived ones.',
    count: prior.length,
    documents: prior,
  }, null, 1));
  console.log(`\nbacked up ${prior.length} documents -> ${out}`);

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection('curated_requirements')
        .deleteMany({ state: 'va', kind: 'degree' }, { session });
      await db.collection('curated_requirements').insertMany(documents, { session });
    });
    console.log(`applied: ${prior.length} discarded, ${documents.length} inserted`);
  } finally {
    await session.endSession();
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { degreeFor, receivingCourses };
