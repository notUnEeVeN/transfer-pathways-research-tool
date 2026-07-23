// Read-time computed view over as_degree docs: college-name joins, per-group
// provenance/confidence rollups, and a diff against the statewide template.
// Display-level only — no analysis math lives here (spec §6). The stored doc
// is never mutated; template_default stubs are resolved by the CONSUMER
// joining `template`, not by copying template content into docs.

const DEFAULT_INVENTORY = require('../../scripts/data/as_degrees_cs_extraction.json').survey;
const { AS_DEGREE_SLOTS, LEGACY_TYPE_TO_SLOT } = require('../config/asDegreeSlots');

const LOW_CONFIDENCE = 0.7;

// ── GE pattern areas ─────────────────────────────────────────────────────────
// Display definitions for each GE pattern an as_degree GE group can reference,
// plus per-college qualifying-course counts from the catalog's area tags —
// the same "N qualifying courses" treatment degreeSlots gives graduation
// coverage. Local associate-degree patterns (Title 5 §55063) have no course
// tags in the dataset, so their areas render as assumed (verify locally).
const GE_PATTERN_AREAS = {
  calgetc: [
    ['1A', 'English Composition'], ['1B', 'Critical Thinking & Composition'],
    ['1C', 'Oral Communication'], ['2', 'Mathematical Concepts & Quantitative Reasoning'],
    ['3A', 'Arts'], ['3B', 'Humanities'], ['4', 'Social & Behavioral Sciences'],
    ['5A', 'Physical Science'], ['5B', 'Biological Science'], ['5C', 'Laboratory Activity'],
    ['6', 'Ethnic Studies'],
  ],
  igetc: [
    ['1A', 'English Composition'], ['1B', 'Critical Thinking'], ['1C', 'Oral Communication'],
    ['2', 'Mathematical Concepts'], ['3A', 'Arts'], ['3B', 'Humanities'],
    ['4', 'Social & Behavioral Sciences'], ['5A', 'Physical Science'],
    ['5B', 'Biological Science'], ['5C', 'Laboratory'], ['6', 'Language Other Than English'],
    ['7', 'Ethnic Studies'],
  ],
  csu_ge: [
    ['A1', 'Oral Communication'], ['A2', 'Written Communication'], ['A3', 'Critical Thinking'],
    ['B1', 'Physical Science'], ['B2', 'Life Science'], ['B3', 'Laboratory Activity'],
    ['B4', 'Mathematics / Quantitative Reasoning'], ['C1', 'Arts'], ['C2', 'Humanities'],
    ['D', 'Social Sciences'], ['E', 'Lifelong Learning & Self-Development'], ['F', 'Ethnic Studies'],
  ],
  local_pattern: [
    ['NS', 'Natural Sciences'], ['SB', 'Social & Behavioral Sciences'], ['H', 'Humanities'],
    ['LR', 'Language & Rationality'], ['M', 'Mathematics Competency'],
  ],
};
const GE_TAG_FIELD = { calgetc: 'calgetc_area', igetc: 'igetc_area', csu_ge: 'csu_ge_area' };
// Cal-GETC/IGETC are transfer patterns — count UC-transferable courses only
// (matching degreeSlots' population); CSU GE membership is independent of UC
// transferability.
const GE_UC_ONLY = { calgetc: true, igetc: true, csu_ge: false };

// Collapse legacy sub-area tags to the display areas above.
function normalizeGeTag(pattern, tag) {
  if (pattern === 'igetc') {
    if (tag === '2A') return '2';
    if (tag && tag.startsWith('4') && tag.length > 1) return '4';
    if (tag === '6A') return '6';
    return tag;
  }
  if (pattern === 'csu_ge' && tag && tag.startsWith('D') && tag.length > 1) return 'D';
  return tag;
}

function gePatternsOf(doc) {
  return [...new Set((doc.requirement_groups || []).map((g) => g.ge_area).filter(Boolean))];
}

async function loadGeAreaCounts(db, communityCollegeId, patterns) {
  const tagged = patterns.filter((p) => GE_TAG_FIELD[p]);
  if (!tagged.length) return {};
  const projection = { _id: 0, uc_transferable: 1 };
  for (const p of tagged) projection[GE_TAG_FIELD[p]] = 1;
  const rows = await db.collection('assist_courses')
    .find({ side: 'sending', community_college_id: Number(communityCollegeId) }, { projection })
    .toArray();
  const counts = {};
  for (const p of tagged) {
    const field = GE_TAG_FIELD[p];
    const m = new Map();
    for (const r of rows) {
      if (GE_UC_ONLY[p] && !r.uc_transferable) continue;
      for (const t of r[field] || []) {
        const code = normalizeGeTag(p, t);
        m.set(code, (m.get(code) || 0) + 1);
      }
    }
    counts[p] = m;
  }
  return counts;
}

function geBreakdownFor(pattern, counts) {
  const defs = GE_PATTERN_AREAS[pattern];
  if (!defs) return null;
  if (!GE_TAG_FIELD[pattern]) {
    return { pattern, assumed: true, areas: defs.map(([code, name]) => ({ code, name, qualifying_count: null })) };
  }
  const m = counts[pattern] || new Map();
  return { pattern, assumed: false, areas: defs.map(([code, name]) => ({ code, name, qualifying_count: m.get(code) || 0 })) };
}

function collectCourseIds(docs) {
  const ids = new Set();
  for (const doc of docs) {
    for (const g of doc.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          for (const o of r.options || []) {
            for (const id of o.course_ids || []) ids.add(id);
          }
        }
      }
    }
  }
  return [...ids];
}

function courseSetKey(doc) {
  return collectCourseIds([doc]).sort((a, b) => Number(a) - Number(b)).join(',');
}

// Historical extraction titles sometimes carry a bracketed note ("[same
// program as <pre-migration type name>; ...]") using one of the retired type
// names from before the slot rename (see
// scripts/data/as_degrees_cs_extraction.json). Built from the
// LEGACY_TYPE_TO_SLOT entries whose key actually changed, so the legacy
// strings themselves stay confined to asDegreeSlots.js rather than being
// re-hardcoded here. `ast` maps to itself (it was never renamed) and must be
// excluded — it's not a legacy note vocabulary word, and including it widens
// this regex to match bracket notes it never matched before.
const LEGACY_TITLE_NOTE_RE = new RegExp(
  `\\s*\\[same program as (?:${
    Object.entries(LEGACY_TYPE_TO_SLOT).filter(([k, v]) => k !== v).map(([k]) => k).join('|')
  })[^\\]]*\\]\\s*`, 'i');

function normalizedDegreeTitle(doc) {
  return String(doc.degree_title_seen || '')
    .replace(LEGACY_TITLE_NOTE_RE, '')
    .trim()
    .toLowerCase();
}

// The statewide extraction currently contains a small set of rows where the
// same local A.S. was emitted once as local_as and again as local_other.
// Surface these as QA candidates; never silently hide them. Keyed by major
// too so two majors' local degrees at one college never collide.
function duplicateLocalOtherIds(docs) {
  const byKey = new Map(docs.map((doc) => [
    `${doc.community_college_id}:${doc.major_slug}:${doc.degree_type}`,
    doc,
  ]));
  const ids = new Set();
  for (const other of docs.filter((doc) => doc.degree_type === 'local_other')) {
    const localAs = byKey.get(`${other.community_college_id}:${other.major_slug}:local_as`);
    if (!localAs) continue;
    const courses = courseSetKey(other);
    if (courses && courses === courseSetKey(localAs)
        && normalizedDegreeTitle(other) === normalizedDegreeTitle(localAs)) {
      ids.add(other._id);
    }
  }
  return ids;
}

async function loadCourses(db, docs) {
  const ids = collectCourseIds(docs);
  if (!ids.length) return [];
  return db.collection('assist_courses')
    .find({ _id: { $in: ids.map((id) => `cc:${id}`) } },
      { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, concept: 1 } })
    .toArray();
}

// Best-effort display sum (spec §5 unit accounting): unit-advisement sections
// contribute their stated units; all-required sections sum each receiver's
// first option; choose-N sections contribute N × the mean receiver units.
function groupUnits(group, unitsByCourseId) {
  if (group.units_fill || group.source === 'template_default') return 0;
  let total = 0;
  for (const s of group.sections || []) {
    if (s.unit_advisement != null) { total += s.unit_advisement; continue; }
    const perReceiver = (s.receivers || []).map((r) => {
      const opt = (r.options || [])[0];
      if (!opt) return 0;
      return (opt.course_ids || []).reduce((sum, id) => sum + (unitsByCourseId.get(id) || 0), 0);
    });
    const sum = perReceiver.reduce((a, b) => a + b, 0);
    if (s.section_advisement != null && perReceiver.length) {
      total += s.section_advisement * (sum / perReceiver.length);
    } else {
      total += sum;
    }
  }
  return total;
}

// The template's required units, as SLOTS rather than a flat concept set.
// Each slot in an is_required group's sections[].slots[] is ONE requirement;
// slot.concepts lists its acceptable alternatives (a slot with >1 concept is
// an OR / choose-one — e.g. the cs_ast "List B science" slot
// ['bio_cell_molec', 'gen_chem_1', 'phys_em'], satisfied by any one of the
// three). Groups that aren't is_required (e.g. the optional science group)
// and sections with no slots (GE blocks, units_fill electives) contribute
// nothing. Identical slots (same concept set, order-insensitive) are deduped
// across groups/sections so two groups requiring the same single concept
// count as one requirement.
function templateRequiredSlots(template) {
  const bySlotKey = new Map();
  for (const g of (template && template.groups) || []) {
    if (g.is_required !== true) continue;
    for (const s of g.sections || []) {
      for (const slot of s.slots || []) {
        const concepts = slot.concepts || [];
        if (!concepts.length) continue;
        const key = [...concepts].sort().join(' ');
        if (!bySlotKey.has(key)) bySlotKey.set(key, { concepts });
      }
    }
  }
  return [...bySlotKey.values()];
}

// Concept-level template comparison (replaces the old group-id deviation
// diff, which was meaningless while every extracted group carried
// template_group: null — see spec). Compares the degree's covered_concepts
// (computed at import time — scripts/import_as_degrees.py) against the
// template's required slots: a slot is satisfied if the degree covers ANY
// one of its alternative concepts, so a choose-one slot isn't penalized for
// the alternatives the degree didn't take.
function computeConceptCoverage(doc, template) {
  const covered = new Set(doc.covered_concepts || []);
  const slots = templateRequiredSlots(template);
  if (!slots.length) {
    return { covered_concepts: doc.covered_concepts || [], missing_core_concepts: [], coverage_pct: null };
  }
  const coveredSlotConcepts = new Set();
  const uncoveredSlots = [];
  for (const slot of slots) {
    if (slot.concepts.some((c) => covered.has(c))) {
      for (const c of slot.concepts) coveredSlotConcepts.add(c);
    } else {
      uncoveredSlots.push(slot);
    }
  }
  // Flatten uncovered slots' alternatives into missing_core_concepts,
  // deduplicated — but never list a concept that's satisfied elsewhere via a
  // covered slot (e.g. it also appears as an alternative in a satisfied
  // choose-one).
  const missing = [];
  const seenMissing = new Set();
  for (const slot of uncoveredSlots) {
    for (const c of slot.concepts) {
      if (coveredSlotConcepts.has(c) || seenMissing.has(c)) continue;
      seenMissing.add(c);
      missing.push(c);
    }
  }
  return {
    covered_concepts: doc.covered_concepts || [],
    missing_core_concepts: missing,
    coverage_pct: Math.round(((slots.length - uncoveredSlots.length) / slots.length) * 100),
  };
}

function summarizeDoc(doc, template, collegeName, unitsByCourseId, duplicateIds = new Set()) {
  const groups = doc.requirement_groups || [];
  const sourceCounts = { extracted: 0, template_default: 0, curated: 0 };
  const confidences = [];
  let unresolved = 0;
  for (const g of groups) {
    if (sourceCounts[g.source] != null) sourceCounts[g.source] += 1;
    if (g.source === 'extracted' && Number.isFinite(g.confidence)) confidences.push(g.confidence);
    unresolved += (g.unresolved_courses_seen || []).length;
  }
  const unitsAccounted = Math.round(
    groups.reduce((sum, g) => sum + groupUnits(g, unitsByCourseId), 0) * 10) / 10;
  const coverage = computeConceptCoverage(doc, template);
  const flags = [];
  if (doc.status === 'ambiguous') flags.push('ambiguous');
  if (sourceCounts.template_default > 0) flags.push('template_default_groups');
  if (confidences.some((c) => c < LOW_CONFIDENCE)) flags.push('low_confidence');
  if (unresolved > 0) flags.push('unresolved_courses');
  if (duplicateIds.has(doc._id)) flags.push('duplicate_candidate');
  const hasFill = groups.some((g) => g.units_fill);
  if (doc.status === 'found' && !hasFill && Number.isFinite(doc.total_units)
      && Math.abs(unitsAccounted - doc.total_units) > 1) {
    flags.push('units_mismatch');
  }
  return {
    _id: doc._id,
    community_college_id: doc.community_college_id,
    college_id: doc.college_id,
    college_name: collegeName || null,
    degree_type: doc.degree_type ?? null,
    major_slug: doc.major_slug ?? null,
    status: doc.status,
    degree_title_seen: doc.degree_title_seen || null,
    catalog_url: doc.catalog_url || null,
    catalog_year: doc.catalog_year || null,
    unit_system: doc.unit_system || null,
    total_units: doc.total_units ?? null,
    group_count: groups.length,
    source_counts: sourceCounts,
    confidence_min: confidences.length ? Math.min(...confidences) : null,
    confidence_mean: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : null,
    unresolved_count: unresolved,
    units_accounted: unitsAccounted,
    coverage_pct: coverage.coverage_pct,
    missing_core_count: coverage.missing_core_concepts.length,
    flags,
    verified: !!(doc.verification && doc.verification.verified),
    updated_at: doc.updated_at ?? null,
  };
}

async function asDegreeOverview(db, { degreeType = null, major = 'cs' } = {}) {
  // There are now two statewide templates (cs_local / cs_ast — one per
  // degree_type); coverage_pct only means anything if each row is compared
  // against ITS OWN template_ref, not one arbitrary template for every row.
  const [templates, allDocs, institutions] = await Promise.all([
    db.collection('curated_requirements').find({ kind: 'as_degree_template' }).toArray(),
    db.collection('curated_requirements').find({ kind: 'as_degree' }).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1 } }).toArray(),
  ]);
  const docs = allDocs.filter((doc) => doc.major_slug === major
    && (!degreeType || doc.degree_type === degreeType));
  const duplicateIds = duplicateLocalOtherIds(allDocs);
  const templatesById = new Map(templates.map((t) => [t._id, t]));
  const nameById = new Map(institutions.map((i) => [i._id, i.name]));
  const courses = await loadCourses(db, docs);
  const unitsByCourseId = new Map(courses.map((c) => [c.course_id, c.units || 0]));
  const rows = docs
    .map((d) => summarizeDoc(
      d, templatesById.get(d.template_ref) || null, nameById.get(d.college_id), unitsByCourseId,
      duplicateIds))
    .sort((a, b) => String(a.college_name).localeCompare(String(b.college_name)));
  const template = degreeType
    ? templates.find((row) => row.degree_type === degreeType) || null
    : templates[0] || null;
  return { params: { degree_type: degreeType, major }, template, n: rows.length, rows };
}

// The statewide survey is a Computer Science inventory (see
// scripts/data/as_degrees_cs_extraction.json); these are the SURVEY's own
// field names, not degree_type values, and renaming them would break the
// data file. asDegreeAvailability is CS-only for that reason.
function inventoryOffers(survey, slot) {
  if (slot === 'ast') return !!survey.ast_cs_exists;
  if (slot === 'local_as') return !!survey.local_cs_as_exists;
  return (survey.local_computing_degrees || []).length > 0;
}

function availabilityFor(survey, slot, doc, duplicateIds) {
  const offered = inventoryOffers(survey, slot);
  let status;
  if (doc?.status === 'found' && duplicateIds.has(doc._id)) status = 'duplicate_candidate';
  else if (doc?.status === 'found') status = 'available';
  else if (offered) status = 'data_gap';
  else status = 'confirmed_none';
  return {
    status,
    inventory_offered: offered,
    record_id: doc?._id || null,
    degree_title_seen: doc?.degree_title_seen || null,
    catalog_url: doc?.catalog_url || null,
    catalog_year: doc?.catalog_year || null,
    verified: !!doc?.verification?.verified,
    inventory_titles: slot === 'local_other'
      ? (survey.local_computing_degrees || []).map((degree) => ({
        name: degree.name || null,
        award: degree.award || null,
      }))
      : [],
  };
}

// One row per surveyed college, including explicit negative findings. This is
// separate from the record overview because an absent as_degree row cannot by
// itself distinguish "confirmed not offered" from "offered, extraction gap".
// CS-only: the statewide survey has no equivalent for other majors, so the
// doc set is restricted to major_slug 'cs' regardless of caller.
async function asDegreeAvailability(db, inventory = DEFAULT_INVENTORY) {
  const [allDocs, institutions] = await Promise.all([
    db.collection('curated_requirements').find({ kind: 'as_degree' }).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1, district: 1, region: 1, source_id: 1 } })
      .toArray(),
  ]);
  const docs = allDocs.filter((doc) => doc.major_slug === 'cs');
  const docBySchoolAndSlot = new Map(docs
    .map((doc) => [`${doc.community_college_id}:${doc.degree_type}`, doc]));
  const institutionBySourceId = new Map(institutions.map((row) => [row.source_id, row]));
  const duplicateIds = duplicateLocalOtherIds(docs);
  const rows = inventory.map((survey) => {
    const institution = institutionBySourceId.get(Number(survey.community_college_id));
    const types = Object.fromEntries(AS_DEGREE_SLOTS.map((slot) => [
      slot,
      availabilityFor(
        survey,
        slot,
        docBySchoolAndSlot.get(`${survey.community_college_id}:${slot}`),
        duplicateIds,
      ),
    ]));
    return {
      college_id: `cc:${survey.community_college_id}`,
      community_college_id: Number(survey.community_college_id),
      college_name: institution?.name || survey.college_name,
      district: institution?.district || null,
      region: institution?.region || null,
      inventory_source_url: survey.source_url || null,
      survey_confidence: survey.confidence ?? null,
      types,
    };
  }).sort((a, b) => String(a.college_name).localeCompare(String(b.college_name)));

  const counts = { total_colleges: rows.length };
  for (const slot of AS_DEGREE_SLOTS) {
    counts[slot] = { available: 0, data_gap: 0, confirmed_none: 0, duplicate_candidate: 0 };
    for (const row of rows) counts[slot][row.types[slot].status] += 1;
  }
  return { counts, rows };
}

function courseView(course) {
  return {
    course_id: course.course_id,
    prefix: course.prefix ?? null,
    number: course.number ?? null,
    code: `${course.prefix} ${course.number}`,
    title: course.title ?? null,
    units: course.units ?? null,
    concept: course.concept ?? null,
  };
}

// Full nested degree documents for notebook/visualization work. Unlike the QA
// overview, this preserves requirement logic and includes a joined course map
// so an analysis needs one request rather than 69 per-college detail calls.
async function asDegreesExportData(db, { degreeType = 'ast', major = 'cs' } = {}) {
  const [docs, institutions] = await Promise.all([
    db.collection('curated_requirements')
      .find({ kind: 'as_degree', degree_type: degreeType, major_slug: major, status: 'found' })
      .sort({ community_college_id: 1 })
      .toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1 } }).toArray(),
  ]);
  const courses = await loadCourses(db, docs);
  const courseById = new Map(courses.map((course) => [course.course_id, course]));
  const nameById = new Map(institutions.map((row) => [row._id, row.name]));
  return docs.map((doc) => {
    const coursesById = {};
    for (const id of collectCourseIds([doc])) {
      const course = courseById.get(id);
      if (course) coursesById[`cc:${id}`] = courseView(course);
    }
    return { ...doc, college_name: nameById.get(doc.college_id) || null, courses_by_id: coursesById };
  });
}

async function asDegreeDetail(db, collegeId, { major = 'cs' } = {}) {
  const docs = await db.collection('curated_requirements')
    .find({ kind: 'as_degree', college_id: String(collegeId), major_slug: major }).toArray();
  if (!docs.length) return null;
  const inst = await db.collection('assist_institutions')
    .findOne({ _id: String(collegeId) }, { projection: { name: 1 } });
  const degrees = await Promise.all(docs.map(async (doc) => {
    // template_ref is intentionally null for a degree_type with no statewide
    // template (e.g. the local_other slot) — no fallback; that degree simply
    // has no template to compare against (coverage_pct null, see below).
    const [template, courses] = await Promise.all([
      doc.template_ref
        ? db.collection('curated_requirements').findOne({ _id: doc.template_ref })
        : Promise.resolve(null),
      loadCourses(db, [doc]),
    ]);
    const coursesById = Object.fromEntries(courses.map((c) => [`cc:${c.course_id}`, courseView(c)]));
    const coverage = computeConceptCoverage(doc, template);
    // Per-pattern GE area breakdown ("N qualifying courses" per area) for the
    // GE groups this degree carries.
    const patterns = gePatternsOf(doc);
    const geCounts = patterns.length
      ? await loadGeAreaCounts(db, doc.community_college_id, patterns)
      : {};
    const geBreakdowns = {};
    for (const p of patterns) {
      const b = geBreakdownFor(p, geCounts);
      if (b) geBreakdowns[p] = b;
    }
    return {
      doc,
      courses_by_id: coursesById,
      covered_concepts: coverage.covered_concepts,
      missing_core_concepts: coverage.missing_core_concepts,
      coverage_pct: coverage.coverage_pct,
      ge_breakdowns: geBreakdowns,
      degree_type: doc.degree_type ?? null,
    };
  }));
  return {
    college_name: inst ? inst.name : null,
    degrees,
  };
}

module.exports = {
  asDegreeOverview,
  asDegreeAvailability,
  asDegreesExportData,
  asDegreeDetail,
  duplicateLocalOtherIds,
  templateRequiredSlots,
};
