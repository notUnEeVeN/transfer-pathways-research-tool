#!/usr/bin/env node
/**
 * Project the Virginia corpus into the shared analysis schemas.
 *
 * The Virginia collections (`va_courses`, `va_requirements`, `va_institutions`)
 * are the source of truth and are not modified. This script writes the derived
 * projection the figure engine reads, exactly as the Massachusetts import does:
 *
 *   assist_institutions   universities 9201–9233, colleges 9301–9324
 *   assist_courses        receiving-side four-year courses, sending-side VCCS
 *   curated_requirements  kind `degree` per four-year, `as_degree` per college
 *   assist_agreements     the per-pair join (scripts/va/buildVaAgreements.js)
 *
 * Everything is keyed by `state: 'va'` so a rebuild replaces only Virginia and
 * California/Massachusetts data is never touched.
 *
 * Verification travels with the associate degrees: Virginia's `verification`
 * block has the same shape the California figures filter on
 * (`verification.verified`), so the verified/unverified cohort control works
 * here for the same reason it works in California — we gathered this data and
 * Roy Martinez verifies it.
 *
 *   node scripts/va/buildVaDocuments.js            # report only
 *   node scripts/va/buildVaDocuments.js --apply    # write the projection
 *
 * IMPORTANT — this script REPLACES every `state: 'va'` document, so it undoes
 * the schema normalization that puts Virginia on California's vocabulary.
 * Rebuilding is a three-step pipeline, not one command:
 *
 *   node scripts/va/buildVaDocuments.js --apply
 *   node scripts/normalizeVirginiaSchema.js --apply
 *   node scripts/normalizeDegreeCategories.js --state=va --apply
 *
 * Skipping steps 2-3 silently drops Virginia's computed Figure 3/4/5 cells
 * from 252 back to 124 and returns Figure 6 to zero rows, because the
 * projection this script emits carries `receiving` objects, no
 * `articulation_status`, `va:CODE` course keys, and no section categories.
 * The durable fix is to emit the normalized shape here directly and retire
 * scripts/normalizeVirginiaSchema.js.
 */
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');
const { deriveVaAgreements, VA_UNIVERSITY_BASE, VA_COLLEGE_BASE } = require('./buildVaAgreements');
const { parseCourseCode } = require('../../services/vaCourseCodes');

const MAJOR_SLUG = 'va-cs';
const PROGRAM = 'Computer Science, B.S.';
const SOURCE_METHOD = 'Derived from Transfer Virginia course equivalencies and published degree '
  + 'requirements; see docs/virginia-courses.md and docs/virginia-degree-collection.md';

const idSlug = (row) => String(row?._id ?? '').replace(/^va:(inst|uni|cc):/, '');
const degreeSlug = (degree) => String(degree?.institution_id ?? '').replace(/^va:(uni|inst):/, '');
const collegeSlugOf = (doc) => String(doc?.community_college_id ?? doc?.college_id ?? '')
  .replace(/^va:(cc|inst):/, '');

/** Split "CS108 + CS109" into its parts; a single code returns one entry. */
const codeParts = (value) => String(value ?? '')
  .split(/\s*\+\s*|\s+and\s+/i).map((part) => part.trim()).filter(Boolean);

/**
 * Receiving-side course rows for one four-year degree.
 *
 * The Virginia pipeline already minted a numeric `parent_id` per receiver, so
 * those ids carry through unchanged and the agreement documents point at the
 * same courses.
 */
function receivingCourses(degree, schoolId) {
  const rows = new Map();
  for (const group of degree.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const receiving = receiver.receiving || {};
        const ids = receiving.kind === 'series'
          ? (receiving.parent_ids || [])
          : [receiving.parent_id];
        const codes = codeParts(receiver.code_seen);
        ids.forEach((parentId, index) => {
          if (parentId == null || rows.has(parentId)) return;
          const code = codes[index] || codes[0] || '';
          const parsed = parseCourseCode(code);
          rows.set(parentId, {
            _id: `va:receiving:${parentId}`,
            institution_id: `va:uni:${schoolId}`,
            source_id: parentId,
            side: 'receiving',
            parent_id: parentId,
            prefix: parsed.prefix || '',
            number: parsed.number != null ? String(parsed.number) : '',
            title: receiving.name || code,
            min_units: receiving.units ?? null,
            max_units: receiving.units ?? null,
            state: 'va',
          });
        });
      }
    }
  }
  return [...rows.values()];
}

/** Rebuild one Virginia requirement tree in the shape the shared reader expects. */
function projectGroups(source) {
  return (source.requirement_groups || []).map((group) => ({
    title: group.label_seen || group.group_id || null,
    tier: group.tier || null,
    group_conjunction: 'And',
    course_level: group.course_level || null,
    cc_articulable: group.cc_articulable ?? null,
    sections: (group.sections || []).map((section) => ({
      section_advisement: section.section_advisement ?? null,
      unit_advisement: section.unit_advisement ?? null,
      unit_advisement_max: section.unit_advisement_max ?? null,
      tier: section.tier || null,
      course_level: section.course_level || null,
      cc_articulable: section.cc_articulable ?? null,
      ge_areas: section.ge_areas || null,
      assume_satisfiable: section.assume_satisfiable ?? false,
      title: section.label_seen || null,
      receivers: (section.receivers || []).map((receiver) => ({
        receiving: {
          ...receiver.receiving,
          code: receiver.code_seen || receiver.receiving?.code || null,
          name: receiver.receiving?.name || receiver.code_seen || null,
        },
        ...(receiver.options?.length ? { options: receiver.options } : {}),
      })),
    })),
  }));
}

function buildProjection({ courses, degrees, asDegrees, institutions }) {
  const colleges = institutions.filter((row) => row.level === 'community_college')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const universities = institutions.filter((row) => row.level === 'four_year')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const collegeIdBySlug = new Map(colleges.map((row, index) => [idSlug(row), VA_COLLEGE_BASE + index]));
  const universityIdBySlug = new Map(universities.map((row, index) => [idSlug(row), VA_UNIVERSITY_BASE + index]));
  const nameBySlug = new Map([...colleges, ...universities].map((row) => [idSlug(row), row.name]));

  const agreements = deriveVaAgreements({ courses, degrees, colleges, universities });
  // Only institutions that actually carry agreements enter the projection; a
  // four-year with requirements but no published equivalencies would otherwise
  // render as a column of zeroes rather than as absent.
  const activeUniversities = new Set(agreements.map((a) => a.uc_school_id));

  const institutionDocs = [
    ...universities
      .filter((row) => activeUniversities.has(universityIdBySlug.get(idSlug(row))))
      .map((row) => {
        const schoolId = universityIdBySlug.get(idSlug(row));
        return {
          _id: `va:uni:${schoolId}`,
          institution_id: `va:uni:${schoolId}`,
          kind: 'university',
          source_id: schoolId,
          name: row.name,
          state: 'va',
          academic_calendar: 'semester',
          va_institution_id: row._id,
        };
      }),
    ...colleges.map((row) => {
      const collegeId = collegeIdBySlug.get(idSlug(row));
      return {
        _id: `va:cc:${collegeId}`,
        institution_id: `va:cc:${collegeId}`,
        kind: 'community_college',
        source_id: collegeId,
        name: row.name,
        state: 'va',
        academic_calendar: 'semester',
        va_institution_id: row._id,
      };
    }),
  ];

  // Keyed globally: the Virginia pipeline reuses a course id across degrees
  // wherever two four-years require the same catalog course, so deduplicating
  // per degree is not enough.
  const courseById = new Map();
  const degreeDocs = [];
  for (const degree of degrees) {
    const schoolId = universityIdBySlug.get(degreeSlug(degree));
    if (schoolId == null || !activeUniversities.has(schoolId)) continue;
    for (const row of receivingCourses(degree, schoolId)) {
      if (!courseById.has(row._id)) courseById.set(row._id, row);
    }
    degreeDocs.push({
      _id: `degree:${schoolId}:${MAJOR_SLUG}`,
      kind: 'degree',
      major_slug: MAJOR_SLUG,
      state: 'va',
      school_id: schoolId,
      school: nameBySlug.get(degreeSlug(degree)),
      program: PROGRAM,
      total_units: degree.total_units ?? null,
      unit_system: degree.unit_system || 'semester',
      catalog_year: degree.catalog_year || null,
      research_status: degree.research_status || 'collected',
      source_method: SOURCE_METHOD,
      source_url: degree.source_url || null,
      verification: degree.verification || null,
      modeling_notes: degree.modeling_notes || [],
      va_requirement_id: degree._id,
      requirement_groups: projectGroups(degree),
    });
  }

  // Sending-side rows: one per VCCS course, not one per college.
  //
  // California mints a catalog course per college, so its ids are naturally
  // per-college and `assist_courses` carries a unique index on
  // (side, source_id). Virginia uses statewide common course numbering: MTH 263
  // is one object taught at many colleges and carries one id. Modelling it as
  // the statewide course it is keeps that index satisfied and stays true to the
  // source; `offered_by_ids` records which colleges teach it.
  const collegeIdByName = new Map(colleges.map((row) => [row.name, collegeIdBySlug.get(idSlug(row))]));
  for (const course of courses) {
    const parsed = parseCourseCode(course.code);
    const offeredIds = (course.offered_by || [])
      .map((name) => collegeIdByName.get(name))
      .filter((id) => id != null);
    const row = {
      _id: `va:sending:${course.course_id}`,
      institution_id: 'va:vccs',
      source_id: course.course_id,
      course_id: course.course_id,
      course_key: course.course_key,
      side: 'sending',
      prefix: parsed.prefix || '',
      number: parsed.number != null ? String(parsed.number) : '',
      title: course.title || '',
      units: course.credits ?? null,
      min_units: course.credits ?? null,
      max_units: course.credits ?? null,
      state: 'va',
      offered_by: course.offered_by || [],
      offered_by_ids: offeredIds,
    };
    if (!courseById.has(row._id)) courseById.set(row._id, row);
  }

  // A college can publish more than one extracted CS associate degree (a
  // specialization alongside the general track). The analysis carries one
  // program per college slot, so take the one the collection pipeline marked
  // primary and record the alternates rather than silently dropping them.
  const asByCollege = new Map();
  for (const source of asDegrees) {
    const slug = collegeSlugOf(source);
    if (!asByCollege.has(slug)) asByCollege.set(slug, []);
    asByCollege.get(slug).push(source);
  }
  const asAlternates = [];
  const chosenAsDegrees = [...asByCollege.values()].map((candidates) => {
    if (candidates.length === 1) return candidates[0];
    const sorted = [...candidates].sort((a, b) => {
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      return String(a._id).localeCompare(String(b._id));
    });
    asAlternates.push({ chosen: sorted[0]._id, dropped: sorted.slice(1).map((d) => d._id) });
    return sorted[0];
  });

  const asDegreeDocs = [];
  for (const source of chosenAsDegrees) {
    const slug = collegeSlugOf(source);
    const collegeId = collegeIdBySlug.get(slug);
    if (collegeId == null) continue;
    asDegreeDocs.push({
      _id: `as_degree:${collegeId}:${MAJOR_SLUG}:local_as`,
      kind: 'as_degree',
      major_slug: MAJOR_SLUG,
      state: 'va',
      community_college_id: collegeId,
      college_id: `va:cc:${collegeId}`,
      college_name: nameBySlug.get(slug),
      degree_type: 'local_as',
      status: 'found',
      degree_title_seen: source.degree_title_seen || null,
      catalog_url: source.catalog_url || null,
      catalog_year: source.catalog_year || null,
      unit_system: source.unit_system || 'semester',
      total_units: source.total_units ?? null,
      // Carried through unchanged: this is what the verified-cohort control
      // filters on, and it is the same shape California uses.
      verification: source.verification || null,
      extraction: source.extraction || null,
      va_requirement_id: source._id,
      requirement_groups: projectGroups(source),
    });
  }

  return {
    institutions: institutionDocs,
    courses: [...courseById.values()],
    degrees: degreeDocs,
    asDegrees: asDegreeDocs,
    agreements,
    asAlternates,
    withoutEquivalencies: agreements.withoutEquivalencies || [],
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const [courses, degrees, asDegrees, institutions] = await Promise.all([
    db.collection('va_courses').find({}).toArray(),
    db.collection('va_requirements').find({ kind: 'degree', status: 'extracted' }).toArray(),
    db.collection('va_requirements').find({ kind: 'as_degree', status: 'extracted' }).toArray(),
    db.collection('va_institutions').find({}).toArray(),
  ]);

  const projection = buildProjection({ courses, degrees, asDegrees, institutions });
  const verified = projection.asDegrees.filter((doc) => doc.verification?.verified === true).length;
  console.log('Virginia projection');
  console.log(`  institutions      ${projection.institutions.length}`);
  console.log(`  courses           ${projection.courses.length}`);
  console.log(`  degrees           ${projection.degrees.length}`);
  console.log(`  associate degrees ${projection.asDegrees.length} (${verified} verified)`);
  console.log(`  agreements        ${projection.agreements.length}`);
  for (const alt of projection.asAlternates) {
    console.log(`  note: ${alt.chosen} chosen as the college's program; also published ${alt.dropped.join(', ')}`);
  }
  for (const skipped of projection.withoutEquivalencies) {
    console.log(`  note: ${skipped.degree_id} excluded — ${skipped.reason}`);
  }

  if (!apply) {
    console.log('\ndry run — re-run with --apply to write the projection.');
    await client.close();
    return;
  }

  const write = async (name, docs, filter) => {
    const collection = db.collection(name);
    await collection.deleteMany(filter);
    if (docs.length) await collection.insertMany(docs);
    console.log(`  wrote ${docs.length} -> ${name}`);
  };
  console.log('\napplying:');
  await write('assist_institutions', projection.institutions, { state: 'va' });
  await write('assist_courses', projection.courses, { state: 'va' });
  await write('assist_agreements', projection.agreements, { state: 'va' });
  await write('curated_requirements', [...projection.degrees, ...projection.asDegrees], { state: 'va' });
  // This projection is in Virginia's own vocabulary. Two more steps put it on
  // California's, and the figures read the California one.
  console.log('\nthis rebuild reset Virginia to its own schema — run BOTH of these now:');
  console.log('  node scripts/normalizeVirginiaSchema.js --apply');
  console.log('  node scripts/normalizeDegreeCategories.js --state=va --apply');
  await client.close();
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = { buildProjection, projectGroups, receivingCourses };
