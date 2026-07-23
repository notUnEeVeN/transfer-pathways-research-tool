/** Canonical research-data API over the permanent compact schema. */
const { asyncHandler } = require('../middleware/asyncHandler');
const { majorScope, pairClause } = require('../services/majorVisibility');
const { prerequisiteGraphData } = require('../services/prereqGraph');
const asDegreeView = require('../services/asDegreeView');
const { recomputeAsDegreeCoveredConcepts } = require('../services/asDegreeConcepts');
const { defaultMajor, getMajor, listMajors } = require('../config/majors');
const { AS_DEGREE_SLOTS, parseAsDegreeRowId } = require('../config/asDegreeSlots');

const COLLECTIONS = Object.freeze({
  institutions: 'assist_institutions',
  courses: 'assist_courses',
  agreements: 'assist_agreements',
  admissions: 'admissions',
  requirements: 'curated_requirements',
  prerequisites: 'curated_prerequisites',
});

const REQUIREMENT_PREFIX = Object.freeze({
  transfer_minimum: 'transfer_minimum',
  degree: 'degree',
  ge_pattern: 'ge_pattern',
  igetc: 'igetc',
  associate_degree: 'associate_degree',
  prereq_concept: 'prereq_concept',
  as_degree_template: 'as_degree_template',
  as_degree: 'as_degree',
});
const REQUIREMENT_KINDS = Object.keys(REQUIREMENT_PREFIX);

function validateDegreeIdentity(canonical) {
  const schoolId = Number(canonical.school_id);
  if (!Number.isFinite(schoolId)) return 'degree school_id must be a number';
  const slug = String(canonical.major_slug || defaultMajor().slug).trim();
  const major = getMajor(slug);
  if (!major) return `unknown degree major_slug: ${slug}`;
  const configuredPrograms = major.programs?.[schoolId] || [];
  if (!configuredPrograms.length) {
    return `major ${slug} is not configured at school ${schoolId}`;
  }
  // The major config owns the ASSIST program identity. Accept trimming at the
  // API boundary (Merced's source label has a trailing space), then store the
  // byte-exact configured value so a sibling program cannot be mislabeled as
  // this major and enter downstream degree figures.
  const requestedProgram = String(canonical.program || '').trim();
  const configuredProgram = configuredPrograms.find((program) =>
    String(program).trim() === requestedProgram);
  if (!configuredProgram) {
    return `degree program must match the configured ${slug} program at school ${schoolId}`;
  }
  const modernId = `degree:${schoolId}:${slug}`;
  const legacyCsId = `degree:${schoolId}`;
  if (canonical._id !== modernId
      && !(slug === defaultMajor().slug && canonical._id === legacyCsId)) {
    return `degree _id must be ${modernId}`;
  }
  canonical.major_slug = slug;
  canonical.program = configuredProgram;
  return null;
}

function parseInstitutionId(value, expectedKind = null) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const match = /^(cc|uc):(\d+)$/.exec(raw);
  if (match) {
    const kind = match[1] === 'cc' ? 'community_college' : 'university';
    if (expectedKind && kind !== expectedKind) return null;
    return { key: raw, sourceId: Number(match[2]), kind };
  }
  if (/^\d+$/.test(raw) && expectedKind) {
    const prefix = expectedKind === 'community_college' ? 'cc' : 'uc';
    return { key: `${prefix}:${raw}`, sourceId: Number(raw), kind: expectedKind };
  }
  return null;
}

// ── prereq_concept validation ──
// The concept vocabulary is the normative prerequisite model (see
// docs/superpowers/specs/2026-07-15-prerequisite-concept-graph-design.md);
// writes must keep the rule graph acyclic and self-consistent.
const CONCEPT_SLUG_RE = /^[a-z0-9_]+$/;
const CONCEPT_DISCIPLINES = ['math', 'physics', 'chem', 'cs', 'bio', 'engr', 'stats', 'other'];

// Title 5 §55063 local-GE areas for associate degrees, plus pattern-level GE
// identifiers used when a requirement is satisfied by a whole GE pattern
// (e.g. CalGETC, IGETC, CSU GE) rather than one Title 5 area (spec §1A).
const GE_AREAS = [
  'natural_sciences', 'social_behavioral', 'humanities', 'language_rationality', 'math_competency',
  'local_pattern', 'calgetc', 'igetc', 'csu_ge',
];

// as_degree: status/source/unit-system vocab (spec §1B).
const AS_DEGREE_STATUSES = ['found', 'none_found', 'ambiguous'];
const AS_DEGREE_SOURCES = ['extracted', 'template_default', 'curated'];
const UNIT_SYSTEMS = ['semester', 'quarter'];
// as_degree: a college may hold up to one row per (major, degree_type); the
// row id is <cc>:<major>:<slot> (as_degree:<cc>:<major>:<slot>). The slot
// vocabulary and the major vocabulary each live in their own config module —
// see server/config/asDegreeSlots.js and server/config/majors.js.

async function validatePrereqConcept(db, canonical) {
  const slug = String(canonical.slug || '');
  if (!CONCEPT_SLUG_RE.test(slug)) return 'slug must match ^[a-z0-9_]+$';
  if (slug !== String(canonical.legacy_id)) return 'slug must equal the row id';
  if (!CONCEPT_DISCIPLINES.includes(canonical.discipline)) {
    return `discipline must be one of ${CONCEPT_DISCIPLINES.join(', ')}`;
  }
  // A requires entry is a slug (AND) or a non-empty array of slugs (OR-group).
  const requires = canonical.requires;
  if (!Array.isArray(requires)) return 'requires must be an array';
  const flat = [];
  for (const entry of requires) {
    if (typeof entry === 'string') flat.push(entry);
    else if (Array.isArray(entry) && entry.length && entry.every((a) => typeof a === 'string')) flat.push(...entry);
    else return 'each requires entry must be a concept slug or a non-empty array of slugs (an OR-group)';
  }
  const flatten = (reqs) => (reqs || []).flatMap((e) => (Array.isArray(e) ? e : [e])).map(String);
  const rows = await db.collection(COLLECTIONS.requirements)
    .find({ kind: 'prereq_concept' }, { projection: { slug: 1, requires: 1 } })
    .toArray();
  // Cycle/existence checks flatten OR-groups: an alternative that could close a
  // cycle is rejected, keeping the graph acyclic however the OR resolves.
  const graph = new Map(rows.map((r) => [String(r.slug), flatten(r.requires)]));
  graph.set(slug, flat.map(String));
  for (const r of flat) {
    if (!graph.has(String(r))) return `requires references unknown concept: ${r}`;
  }
  const state = new Map(); // 'visiting' | 'done'
  const visit = (node, path) => {
    if (state.get(node) === 'done') return null;
    if (state.get(node) === 'visiting') return [...path, node];
    state.set(node, 'visiting');
    for (const next of graph.get(node) || []) {
      const cycle = visit(next, [...path, node]);
      if (cycle) return cycle;
    }
    state.set(node, 'done');
    return null;
  };
  const cycle = visit(slug, []);
  if (cycle) return `requires would create a cycle: ${cycle.join(' → ')}`;
  // satisfies: combined-course concepts stand in for these slugs during
  // projection (optional; must name other existing concepts).
  const sat = canonical.satisfies;
  if (sat !== undefined) {
    if (!Array.isArray(sat) || sat.some((s) => typeof s !== 'string')) {
      return 'satisfies must be an array of concept slugs';
    }
    for (const s of sat) {
      if (s === slug) return 'satisfies must not reference the concept itself';
      if (!graph.has(String(s))) return `satisfies references unknown concept: ${s}`;
    }
  }
  return null;
}

// as_degree_template: statewide concept-slotted degree template (spec §1A).
// Groups mirror the agreement skeleton but hold concept slots, not receivers.
async function validateAsDegreeTemplate(db, canonical) {
  const slug = String(canonical.slug || '');
  if (!CONCEPT_SLUG_RE.test(slug)) return 'slug must match ^[a-z0-9_]+$';
  if (slug !== String(canonical.legacy_id)) return 'slug must equal the row id';
  if (typeof canonical.name !== 'string' || !canonical.name.trim()) return 'name is required';
  if (!Number.isFinite(canonical.total_units_min) || canonical.total_units_min <= 0) {
    return 'total_units_min must be a positive number';
  }
  if (!Array.isArray(canonical.groups) || canonical.groups.length === 0) {
    return 'groups must be a non-empty array';
  }
  const conceptRows = await db.collection(COLLECTIONS.requirements)
    .find({ kind: 'prereq_concept' }, { projection: { slug: 1 } })
    .toArray();
  const known = new Set(conceptRows.map((r) => String(r.slug)));
  const seenIds = new Set();
  for (const g of canonical.groups) {
    if (!g || typeof g !== 'object') return 'each group must be an object';
    const gid = String(g.group_id || '');
    if (!CONCEPT_SLUG_RE.test(gid)) return 'each group needs a group_id matching ^[a-z0-9_]+$';
    if (seenIds.has(gid)) return `duplicate group_id: ${gid}`;
    seenIds.add(gid);
    if (typeof g.label !== 'string' || !g.label.trim()) return `group ${gid}: label is required`;
    if (g.ge_area != null && !GE_AREAS.includes(g.ge_area)) {
      return `group ${gid}: ge_area must be one of ${GE_AREAS.join(', ')}`;
    }
    if (g.units_fill === true) {
      if (g.sections != null) return `group ${gid}: a units_fill group must not have sections`;
      continue;
    }
    if (!Array.isArray(g.sections) || g.sections.length === 0) {
      return `group ${gid}: sections must be a non-empty array`;
    }
    for (const s of g.sections) {
      if (!s || typeof s !== 'object') return `group ${gid}: each section must be an object`;
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (s[key] != null && (!Number.isFinite(s[key]) || s[key] <= 0)) {
          return `group ${gid}: ${key} must be null or a positive number`;
        }
      }
      if (!Array.isArray(s.slots)) return `group ${gid}: each section needs a slots array`;
      if (g.ge_area == null && s.slots.length === 0) {
        return `group ${gid}: a non-ge_area section must list at least one slot`;
      }
      for (const slot of s.slots) {
        const alts = slot && slot.concepts;
        if (!Array.isArray(alts) || alts.length === 0 || alts.some((c) => typeof c !== 'string')) {
          return `group ${gid}: each slot needs a non-empty concepts array of slugs`;
        }
        for (const c of alts) {
          if (!known.has(c)) return `group ${gid}: slot references unknown concept: ${c}`;
        }
      }
    }
  }
  return null;
}

// as_degree: one college's local AS degree in the agreement skeleton
// (spec §1B). Body fields mirror assist_agreements exactly so the golden
// engines can evaluate the doc with no translation layer.
async function validateAsDegree(db, canonical) {
  const parsed = parseAsDegreeRowId(canonical.legacy_id);
  if (!parsed) {
    return 'row id must look like <community_college_id>:<major>:<slot>, e.g. 110:cs:ast';
  }
  const { communityCollegeId: ccId, majorSlug, slot } = parsed;
  if (canonical.community_college_id !== ccId) {
    return 'community_college_id must match the numeric part of the row id';
  }
  if (canonical.college_id !== `cc:${ccId}`) return `college_id must be 'cc:${ccId}'`;
  if (!AS_DEGREE_SLOTS.includes(canonical.degree_type)) {
    return `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}`;
  }
  if (canonical.degree_type !== slot) {
    return 'degree_type must match the slot segment of the row id';
  }
  if (!getMajor(canonical.major_slug)) {
    return `major_slug must be a configured major (${listMajors().map((m) => m.slug).join(', ')})`;
  }
  if (canonical.major_slug !== majorSlug) {
    return 'major_slug must match the major segment of the row id';
  }
  const inst = await db.collection(COLLECTIONS.institutions)
    .findOne({ _id: `cc:${ccId}` }, { projection: { kind: 1 } });
  if (!inst || inst.kind !== 'community_college') return `no community college with id cc:${ccId}`;
  if (canonical.template_ref != null) {
    const tpl = await db.collection(COLLECTIONS.requirements)
      .findOne({ _id: canonical.template_ref, kind: 'as_degree_template' }, { projection: { _id: 1 } });
    if (!tpl) return `template_ref not found: ${canonical.template_ref}`;
  }
  if (!AS_DEGREE_STATUSES.includes(canonical.status)) {
    return `status must be one of ${AS_DEGREE_STATUSES.join(', ')}`;
  }
  if (canonical.verification != null && typeof canonical.verification !== 'object') {
    return 'verification must be an object';
  }
  if (canonical.covered_concepts != null) {
    if (!Array.isArray(canonical.covered_concepts)
        || canonical.covered_concepts.some((c) => typeof c !== 'string')) {
      return 'covered_concepts must be an array of strings';
    }
  }
  if (canonical.status !== 'found') {
    if (canonical.requirement_groups != null
        && (!Array.isArray(canonical.requirement_groups) || canonical.requirement_groups.length)) {
      return `a ${canonical.status} row must not carry requirement_groups`;
    }
    return null;
  }
  if (typeof canonical.degree_title_seen !== 'string' || !canonical.degree_title_seen.trim()) {
    return 'degree_title_seen is required on a found row';
  }
  if (typeof canonical.catalog_url !== 'string' || !/^https?:\/\//.test(canonical.catalog_url)) {
    return 'catalog_url must be an http(s) URL';
  }
  if (typeof canonical.catalog_year !== 'string' || !canonical.catalog_year.trim()) {
    return 'catalog_year is required on a found row';
  }
  if (!UNIT_SYSTEMS.includes(canonical.unit_system)) {
    return `unit_system must be one of ${UNIT_SYSTEMS.join(', ')}`;
  }
  if (!Number.isFinite(canonical.total_units) || canonical.total_units <= 0) {
    return 'total_units must be a positive number';
  }
  if (!Array.isArray(canonical.requirement_groups) || !canonical.requirement_groups.length) {
    return 'requirement_groups must be a non-empty array on a found row';
  }
  const seenIds = new Set();
  for (const g of canonical.requirement_groups) {
    if (!g || typeof g !== 'object') return 'each group must be an object';
    const gid = String(g.group_id || '');
    if (!CONCEPT_SLUG_RE.test(gid)) return 'each group needs a group_id matching ^[a-z0-9_]+$';
    if (seenIds.has(gid)) return `duplicate group_id: ${gid}`;
    seenIds.add(gid);
    if (g.template_group != null && g.template_group !== gid) {
      return `group ${gid}: template_group must equal group_id or be null`;
    }
    if (!AS_DEGREE_SOURCES.includes(g.source)) {
      return `group ${gid}: source must be one of ${AS_DEGREE_SOURCES.join(', ')}`;
    }
    if (g.source === 'extracted') {
      if (!Number.isFinite(g.confidence) || g.confidence < 0 || g.confidence > 1) {
        return `group ${gid}: an extracted group needs confidence in [0,1]`;
      }
    } else if (g.confidence != null) {
      return `group ${gid}: confidence must be null unless source is extracted`;
    }
    if (g.ge_area != null && !GE_AREAS.includes(g.ge_area)) {
      return `group ${gid}: ge_area must be one of ${GE_AREAS.join(', ')}`;
    }
    if (g.source === 'template_default') {
      // A stub: the template's group renders in its place at read time.
      if (g.template_group == null) return `group ${gid}: a template_default group needs template_group`;
      if (Array.isArray(g.sections) && g.sections.length) {
        return `group ${gid}: a template_default stub must not carry sections`;
      }
      continue;
    }
    if (g.units_fill === true) {
      if (Array.isArray(g.sections) && g.sections.length) {
        return `group ${gid}: a units_fill group must not have sections`;
      }
      continue;
    }
    if (!Array.isArray(g.sections) || !g.sections.length) {
      return `group ${gid}: sections must be a non-empty array`;
    }
    for (const s of g.sections) {
      if (!s || typeof s !== 'object') return `group ${gid}: each section must be an object`;
      for (const key of ['section_advisement', 'unit_advisement']) {
        if (s[key] != null && (!Number.isFinite(s[key]) || s[key] <= 0)) {
          return `group ${gid}: ${key} must be null or a positive number`;
        }
      }
      if (!Array.isArray(s.receivers)) return `group ${gid}: each section needs a receivers array`;
      if (g.ge_area == null && !s.receivers.length) {
        return `group ${gid}: a non-ge_area section must list at least one receiver`;
      }
      for (const r of s.receivers) {
        if (!r || typeof r !== 'object') return `group ${gid}: each receiver must be an object`;
        if (r.receiving != null) return `group ${gid}: receiving must be null on as_degree receivers`;
        if (r.articulation_status !== 'articulated') {
          return `group ${gid}: articulation_status must be 'articulated'`;
        }
        if (!Array.isArray(r.options) || !r.options.length) {
          return `group ${gid}: each receiver needs at least one option`;
        }
        for (const o of r.options) {
          if (!o || typeof o !== 'object') return `group ${gid}: each option must be an object`;
          if (!Array.isArray(o.course_ids) || !o.course_ids.length
              || o.course_ids.some((id) => !Number.isInteger(id))) {
            return `group ${gid}: option course_ids must be a non-empty array of Numbers`;
          }
          const keys = o.course_keys;
          if (!Array.isArray(keys) || keys.length !== o.course_ids.length
              || keys.some((k, i) => k !== `cc:${o.course_ids[i]}`)) {
            return `group ${gid}: course_keys must mirror course_ids as 'cc:<n>'`;
          }
        }
      }
    }
    const unresolved = g.unresolved_courses_seen;
    if (unresolved != null && (!Array.isArray(unresolved)
        || unresolved.some((u) => typeof (u && u.course_code_seen) !== 'string'))) {
      return `group ${gid}: unresolved_courses_seen must be an array of {course_code_seen, ...}`;
    }
  }
  return null;
}

exports.listInstitutions = asyncHandler(async (req, res) => {
  const kind = ['community_college', 'university'].includes(req.query.kind)
    ? req.query.kind
    : null;
  const rows = await req.app.locals.db.collection(COLLECTIONS.institutions)
    .find(kind ? { kind } : {})
    .sort({ name: 1 })
    .toArray();
  res.json({ rows });
});

exports.listCourses = asyncHandler(async (req, res) => {
  const requestedInstitution = String(req.query.institution_id || '').trim();
  const parsed = requestedInstitution
    ? parseInstitutionId(
      requestedInstitution,
      requestedInstitution.startsWith('uc:') ? 'university' : 'community_college'
    )
    : null;
  if (requestedInstitution && !parsed) {
    return res.status(400).json({ error: 'institution_id must be cc:<id> or uc:<id>' });
  }

  const ids = String(req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length > 500) return res.status(400).json({ error: 'ids supports at most 500 course ids' });
  if (!parsed && !ids.length) {
    return res.status(400).json({ error: 'institution_id or ids is required; use /exports/courses for the full catalog' });
  }

  const filter = ids.length ? { _id: { $in: ids } } : { institution_id: parsed.key };
  const rows = await req.app.locals.db.collection(COLLECTIONS.courses)
    .find(filter)
    .sort({ prefix: 1, number: 1 })
    .toArray();
  res.json({ rows });
});

exports.listAgreements = asyncHandler(async (req, res) => {
  const college = parseInstitutionId(req.query.college_id, 'community_college');
  const university = req.query.university_id
    ? parseInstitutionId(req.query.university_id, 'university')
    : null;
  if (!college) return res.status(400).json({ error: 'college_id=cc:<id> is required' });
  if (req.query.university_id && !university) {
    return res.status(400).json({ error: 'university_id must be uc:<id>' });
  }

  const visiblePairs = await majorScope(req);
  const filter = { college_id: college.key };
  if (university) filter.university_id = university.key;
  const major = String(req.query.major || '').trim();
  if (major) filter.major = major;
  if (visiblePairs != null) Object.assign(filter, pairClause(visiblePairs, 'uc_school_id'));

  const rows = await req.app.locals.db.collection(COLLECTIONS.agreements)
    .find(filter)
    .sort({ uc_school: 1, major: 1 })
    .toArray();
  res.json({ rows });
});

exports.listAdmissions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.institution_id) {
    const institution = parseInstitutionId(req.query.institution_id, 'university');
    if (!institution) return res.status(400).json({ error: 'institution_id must be uc:<id>' });
    filter.institution_id = institution.key;
  }
  const major = String(req.query.major || '').trim();
  if (major) filter.major = major;
  const visiblePairs = await majorScope(req);
  if (visiblePairs != null) Object.assign(filter, pairClause(visiblePairs, 'uc_school_id'));
  const rows = await req.app.locals.db.collection(COLLECTIONS.admissions)
    .find(filter)
    .sort({ uc_school: 1, major: 1 })
    .toArray();
  res.json({ rows });
});

exports.listRequirements = asyncHandler(async (req, res) => {
  const kind = String(req.query.kind || '').trim();
  if (kind && !REQUIREMENT_KINDS.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of ${REQUIREMENT_KINDS.join(', ')}` });
  }
  const rows = await req.app.locals.db.collection(COLLECTIONS.requirements)
    .find(kind ? { kind } : {})
    .toArray();
  res.json({ rows });
});

exports.putRequirement = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const kind = String(req.params.kind || '').trim();
  if (!REQUIREMENT_KINDS.includes(kind)) {
    return res.status(404).json({ error: 'unknown requirement kind' });
  }
  const row = req.body || {};
  const rawId = row._id ?? row.legacy_id;
  if (rawId == null || rawId === '') return res.status(400).json({ error: 'row _id required' });
  const prefix = `${REQUIREMENT_PREFIX[kind]}:`;
  const canonicalId = String(rawId).startsWith(prefix) ? String(rawId) : `${prefix}${rawId}`;
  const legacyId = row.legacy_id ?? String(rawId).replace(new RegExp(`^${prefix}`), '');
  const canonical = {
    ...row,
    _id: canonicalId,
    legacy_id: legacyId,
    kind,
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
    updated_at: new Date(),
  };
  if (kind === 'prereq_concept') {
    // Dedupe within each OR-group and across top-level entries, without
    // flattening groups (an entry may be a slug or an array of slugs). A
    // single-alternative group collapses back to a plain slug.
    if (Array.isArray(canonical.requires)) {
      const seen = new Set();
      canonical.requires = canonical.requires.map((e) => {
        if (Array.isArray(e)) {
          const alts = [...new Set(e.map(String))];
          return alts.length === 1 ? alts[0] : alts;
        }
        return String(e);
      }).filter((e) => {
        const key = Array.isArray(e) ? `|${e.join('|')}` : e;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const invalid = await validatePrereqConcept(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
    canonical.source = canonical.source || 'hand_curated';
  }
  if (kind === 'degree') {
    const invalid = validateDegreeIdentity(canonical);
    if (invalid) return res.status(400).json({ error: invalid });
  }
  if (kind === 'as_degree_template') {
    const invalid = await validateAsDegreeTemplate(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
  }
  if (kind === 'as_degree') {
    const invalid = await validateAsDegree(db, canonical);
    if (invalid) return res.status(400).json({ error: invalid });
    canonical.covered_concepts = await recomputeAsDegreeCoveredConcepts(db, canonical);
    // Group-level curation stamp: the doc-level curated_by above records who
    // last saved; group-level curated_by records who confirmed THIS group.
    for (const g of canonical.requirement_groups || []) {
      if (g.source === 'curated' && !g.curated_by) {
        g.curated_by = req.user?.uid ?? null;
        g.curated_at = new Date();
      }
    }
  }
  await db.collection(COLLECTIONS.requirements).replaceOne(
    { _id: canonicalId }, canonical, { upsert: true }
  );
  res.json({ ok: true, id: canonicalId });
});

exports.deleteRequirement = asyncHandler(async (req, res) => {
  const kind = String(req.params.kind || '').trim();
  if (!REQUIREMENT_KINDS.includes(kind)) {
    return res.status(404).json({ error: 'unknown requirement kind' });
  }
  const prefix = `${REQUIREMENT_PREFIX[kind]}:`;
  const rawId = decodeURIComponent(String(req.params.id));
  const canonicalId = rawId.startsWith(prefix) ? rawId : `${prefix}${rawId}`;
  if (kind === 'prereq_concept') {
    const slug = canonicalId.slice(prefix.length);
    const [dependents, mapped, templated] = await Promise.all([
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'prereq_concept', requires: slug }),
      req.app.locals.db.collection(COLLECTIONS.courses)
        .countDocuments({ concept: slug }),
      req.app.locals.db.collection(COLLECTIONS.requirements)
        .countDocuments({ kind: 'as_degree_template', 'groups.sections.slots.concepts': slug }),
    ]);
    if (dependents || mapped || templated) {
      return res.status(400).json({
        error: `concept is referenced by ${dependents} concept(s), ${mapped} course(s), and ${templated} degree template(s); reassign them first`,
      });
    }
  }
  if (kind === 'as_degree_template') {
    const referencing = await req.app.locals.db.collection(COLLECTIONS.requirements)
      .countDocuments({ kind: 'as_degree', template_ref: canonicalId });
    if (referencing) {
      return res.status(400).json({
        error: `template is referenced by ${referencing} as_degree row(s); delete or repoint them first`,
      });
    }
  }
  const result = await req.app.locals.db.collection(COLLECTIONS.requirements)
    .deleteOne({ _id: canonicalId });
  if (!result.deletedCount) return res.status(404).json({ error: 'no such row' });
  res.json({ ok: true });
});

exports.listPrerequisites = asyncHandler(async (req, res) => {
  const rows = await req.app.locals.db.collection(COLLECTIONS.prerequisites).find().toArray();
  res.json({ rows });
});

exports.putPrerequisite = asyncHandler(async (req, res) => {
  const row = req.body || {};
  const rawId = row._id || row.course_id;
  if (!rawId) return res.status(400).json({ error: 'row _id required' });
  const id = String(rawId);
  const canonical = {
    ...row,
    _id: id,
    status: row.status || (row.course_id ? 'resolved' : 'needs_review'),
    curated_by: req.user?.uid ?? null,
    curated_at: new Date(),
  };
  await req.app.locals.db.collection(COLLECTIONS.prerequisites)
    .replaceOne({ _id: id }, canonical, { upsert: true });
  res.json({ ok: true, id });
});

exports.deletePrerequisite = asyncHandler(async (req, res) => {
  const id = decodeURIComponent(String(req.params.id));
  const result = await req.app.locals.db.collection(COLLECTIONS.prerequisites).deleteOne({ _id: id });
  if (!result.deletedCount) return res.status(404).json({ error: 'no such row' });
  res.json({ ok: true });
});

// Computed view over the concept vocabulary + course mapping (like
// /curated/degree-evaluation: a view over curated tables, so it lives here).
exports.prerequisiteGraph = asyncHandler(async (req, res) => {
  const requested = String(req.query.college_id || '').trim();
  const parsed = requested ? parseInstitutionId(requested, 'community_college') : null;
  if (requested && !parsed) return res.status(400).json({ error: 'college_id must be cc:<id>' });
  const data = await prerequisiteGraphData(req.app.locals.db, { collegeKey: parsed?.key ?? null });
  res.json(data);
});

exports.putInstitutionProfile = asyncHandler(async (req, res) => {
  const parsed = parseInstitutionId(req.params.id, 'community_college');
  if (!parsed) return res.status(400).json({ error: 'institution id must be cc:<id>' });
  const { district, region, counties_served } = req.body || {};
  const result = await req.app.locals.db.collection(COLLECTIONS.institutions).updateOne(
    { _id: parsed.key },
    { $set: {
      district: district || null,
      region: region || null,
      counties_served: Array.isArray(counties_served) ? counties_served : [],
      curated_by: req.user?.uid ?? null,
      curated_at: new Date(),
    } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'no such institution' });
  res.json({ ok: true, id: parsed.key });
});

exports.deleteInstitutionProfile = asyncHandler(async (req, res) => {
  const parsed = parseInstitutionId(req.params.id, 'community_college');
  if (!parsed) return res.status(400).json({ error: 'institution id must be cc:<id>' });
  const result = await req.app.locals.db.collection(COLLECTIONS.institutions).updateOne(
    { _id: parsed.key },
    { $set: {
      district: null,
      region: null,
      counties_served: [],
      curated_by: req.user?.uid ?? null,
      curated_at: new Date(),
    } }
  );
  if (!result.matchedCount) return res.status(404).json({ error: 'no such institution' });
  res.json({ ok: true });
});

// Course→concept mapping: enrichment fields on the sending-course doc (the
// spec's §1B). Human console edits only — imports use scripts/import_course_concepts.py.
exports.putCourseConcept = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const id = decodeURIComponent(String(req.params.id || ''));
  if (!/^cc:.+$/.test(id)) return res.status(400).json({ error: 'course id must be cc:<course_id>' });
  const { concept = null, note = '', language = null } = req.body || {};
  if (concept != null && typeof concept !== 'string') {
    return res.status(400).json({ error: 'concept must be a string slug or null' });
  }
  if (language != null && typeof language !== 'string') {
    return res.status(400).json({ error: 'language must be a string or null' });
  }
  if (concept != null) {
    const known = await db.collection(COLLECTIONS.requirements)
      .findOne({ _id: `prereq_concept:${concept}` }, { projection: { _id: 1 } });
    if (!known) return res.status(400).json({ error: `unknown concept slug: ${concept}` });
  }
  const course = await db.collection(COLLECTIONS.courses)
    .findOne({ _id: id, side: 'sending' }, { projection: { title: 1 } });
  if (!course) return res.status(404).json({ error: 'no such sending course' });
  await db.collection(COLLECTIONS.courses).updateOne(
    { _id: id },
    { $set: {
      concept: concept ?? null,
      concept_source: 'console_edit',
      concept_confidence: 1,
      concept_title_seen: course.title ?? null,
      concept_note: String(note || ''),
      language: language ? String(language) : null,
      concept_curated_by: req.user?.uid ?? null,
      concept_curated_at: new Date(),
    } }
  );
  res.json({ ok: true, id });
});

// Read-time computed view: college joins, provenance/confidence rollups, and
// a template-deviation diff over as_degree docs (server/services/asDegreeView.js).
exports.asDegrees = asyncHandler(async (req, res) => {
  const db = req.app.locals.db;
  const collegeId = String(req.query.college_id || '').trim();
  const degreeType = String(req.query.degree_type || '').trim() || null;
  if (degreeType && !AS_DEGREE_SLOTS.includes(degreeType)) {
    return res.status(400).json({ error: `degree_type must be one of ${AS_DEGREE_SLOTS.join(', ')}` });
  }
  if (collegeId) {
    const detail = await asDegreeView.asDegreeDetail(db, collegeId);
    if (!detail) return res.status(404).json({ error: 'no as_degree row for that college' });
    return res.json(detail);
  }
  res.json(await asDegreeView.asDegreeOverview(db, { degreeType }));
});

// One row per college with explicit available / confirmed-none / data-gap
// states for each degree type. Absence from as_degree alone is not evidence of
// absence from the catalog, so this joins the completed statewide inventory.
exports.asDegreeAvailability = asyncHandler(async (req, res) => {
  res.json(await asDegreeView.asDegreeAvailability(req.app.locals.db));
});

exports.COLLECTIONS = COLLECTIONS;
exports.REQUIREMENT_KINDS = REQUIREMENT_KINDS;
exports.parseInstitutionId = parseInstitutionId;
exports.validateAsDegree = validateAsDegree;
