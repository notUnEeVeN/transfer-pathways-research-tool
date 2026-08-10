/**
 * Virginia's published prerequisite graph.
 *
 * This service deliberately does not use the ASSIST prerequisite projector.
 * California infers course edges from a canonical concept DAG and may fall
 * through a concept a college does not offer. Virginia publishes course-level
 * prerequisites and corequisites, so hiding an unavailable course behind a
 * transitive fallback would discard source information. Here the published
 * formula is authoritative and missing supply is returned as an explicit node
 * and gap.
 */

const {
  primaryCohort,
  registryInstitutionFor,
  sourceNamesForInstitution,
} = require('./institutionCohorts');

const CONCEPT_KIND = 'prereq_concept';
const COLLECTIONS = Object.freeze({
  courses: 'va_courses',
  institutions: 'va_institutions',
  requirements: 'va_requirements',
  concepts: 'va_course_concepts',
  requisites: 'va_course_requisites',
});

class UnknownVirginiaInstitutionError extends Error {
  constructor(kind, selector) {
    super(`unknown Virginia ${kind}: ${selector}`);
    this.name = 'UnknownVirginiaInstitutionError';
    this.statusCode = 400;
  }
}

const slugOf = (value) => String(value || '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const normalizeCode = (value) => {
  if (value == null) return null;
  const raw = typeof value === 'object'
    ? value.code ?? value.course_code ?? value.course_key ?? value.course_ref ?? value._id
    : value;
  const code = String(raw || '')
    .replace(/^va:crs:/i, '')
    .replace(/^va:/i, '')
    .replace(/\s+/g, '')
    .toUpperCase();
  return code || null;
};

// `va_courses._id` is va:crs:CODE, while requirement option keys and the
// graph/UI contract are va:CODE. Normalize both (and raw codes) at the edge.
const graphKey = (value) => {
  const code = normalizeCode(value);
  return code ? `va:${code}` : null;
};

const splitCode = (value) => {
  const code = normalizeCode(value) || '';
  const match = /^([A-Z]+)(.*)$/.exec(code);
  return { code, prefix: match?.[1] || code, number: match?.[2] || '' };
};

const asArray = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const unique = (values) => [...new Set(values.filter((value) => value != null))];
const flagNames = (row) => {
  if (!row) return [];
  if (Array.isArray(row.flags)) return row.flags.map(String);
  if (row.flags && typeof row.flags === 'object') {
    return Object.entries(row.flags).filter(([, set]) => Boolean(set)).map(([name]) => name);
  }
  return row.flags ? [String(row.flags)] : [];
};

function isCommunityCollegeName(name) {
  return /community college/i.test(String(name || '')) || /^Richard Bland\b/i.test(String(name || ''));
}

function collegeNameCore(name) {
  return slugOf(name).replace(/-community-college$/, '').replace(/-college$/, '');
}

function sameCollegeName(left, right) {
  const a = collegeNameCore(left);
  const b = collegeNameCore(right);
  return Boolean(a && b && (a === b || a.endsWith(`-${b}`) || b.endsWith(`-${a}`)));
}

function courseIdentity(row) {
  return graphKey(row?.code ?? row?.course_key ?? row?.course_ref ?? row?._id);
}

function mappingIdentity(row) {
  return graphKey(row?.course_key ?? row?.course_ref ?? row?.code ?? row?._id);
}

function requisiteIdentity(row) {
  return graphKey(row?.course_key ?? row?.course_ref ?? row?.code ?? row?._id);
}

function institutionCandidates(kind, institutionRows, courseRows, requirementRows) {
  const expectedLevel = kind === 'college' ? 'community_college' : 'four_year';
  const prefix = kind === 'college' ? 'va:cc:' : 'va:uni:';
  const names = new Map();
  const addName = (name, row = null) => {
    if (!name) return;
    const slug = slugOf(name);
    if (!slug) return;
    const prior = names.get(slug) || {};
    names.set(slug, {
      slug,
      name: prior.name || String(name),
      id: `${prefix}${slug}`,
      catalog_id: row?._id || prior.catalog_id || `va:inst:${slug}`,
      level: expectedLevel,
      aliases: unique([...(prior.aliases || []), row?.alias_of, ...(row?.aliases || [])]),
    });
  };

  for (const row of institutionRows) {
    if (row.level === expectedLevel) addName(row.name, row);
  }
  // UVA and VMI are valid primary receiving selectors before the course corpus
  // happens to contain an equivalency for them. Keeping them in the resolver
  // makes the public rail stable and yields an honest empty scoped graph.
  if (kind === 'university') {
    for (const slug of primaryCohort.institution_slugs) {
      const institution = registryInstitutionFor(slug);
      addName(institution.name, {
        _id: `va:inst:${institution.slug}`,
        aliases: sourceNamesForInstitution(institution).filter((name) => name !== institution.name),
      });
    }
  }
  for (const course of courseRows) {
    if (kind === 'college') {
      for (const name of course.offered_by || []) {
        const known = institutionRows.find((row) => row.name === name);
        if (known?.level === expectedLevel || (!known && isCommunityCollegeName(name))) addName(name, known);
      }
    } else {
      for (const landing of course.articulates_to || []) addName(landing.institution);
    }
  }

  // A requirement document can keep a stable selector resolvable even if a
  // sparse/partial course import omitted the institution registry row.
  for (const row of requirementRows) {
    const owner = kind === 'college' ? row.college_id || row.community_college_id
      : row.school_id || row.institution_id;
    if (!String(owner || '').startsWith(prefix)) continue;
    const slug = String(owner).slice(prefix.length);
    const display = kind === 'college' ? row.college || row.institution
      : row.school || row.institution;
    if (display) addName(display);
    if (!names.has(slug)) {
      names.set(slug, {
        slug, name: display || slug.replace(/-/g, ' '), id: `${prefix}${slug}`,
        catalog_id: `va:inst:${slug}`, level: expectedLevel, aliases: [],
      });
    }
  }
  return [...names.values()];
}

function resolveInstitution(kind, selector, institutionRows, courseRows, requirementRows) {
  if (!selector) return null;
  const requested = String(selector).trim();
  const lower = requested.toLowerCase();
  const candidates = institutionCandidates(kind, institutionRows, courseRows, requirementRows);
  const hit = candidates.find((candidate) => {
    const stableIds = [candidate.id, candidate.catalog_id, candidate.slug]
      .map((value) => String(value).toLowerCase());
    return candidate.name.toLowerCase() === lower
      || stableIds.includes(lower)
      || candidate.aliases.some((alias) => String(alias).toLowerCase() === lower);
  });
  if (!hit) throw new UnknownVirginiaInstitutionError(kind, requested);
  return hit;
}

function requirementIsCs(row) {
  if (row.major_slug != null) return String(row.major_slug).toLowerCase() === 'cs';
  return /:cs(?::|$)/i.test(String(row._id || ''));
}

function ownerMatches(row, college) {
  const ids = [row.college_id, row.community_college_id].filter(Boolean).map(String);
  return ids.includes(college.id)
    || ids.some((id) => id.replace(/^va:cc:/, '') === college.slug);
}

function collectRequirementScope(requirementRows, college, coursesById) {
  if (!college) return { keys: new Set(), documents: 0, unresolved: [], source: null };
  const docs = requirementRows.filter((row) => row.kind === 'as_degree'
    && requirementIsCs(row) && ownerMatches(row, college));
  const keys = new Set();
  const unresolved = new Set();

  const addCode = (value) => {
    const key = graphKey(value);
    if (key) keys.add(key);
  };
  const addId = (id) => {
    const course = coursesById.get(String(id));
    if (course) addCode(course.code);
    else if (id != null) unresolved.add(String(id));
  };

  for (const doc of docs) {
    for (const code of doc.codes_seen || []) addCode(code);
    for (const group of doc.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          // Community-college degree rows normally put the VCCS courses in
          // options. Accept explicit codes/keys as well as the older numeric id.
          for (const option of receiver.options || []) {
            for (const key of option.course_keys || []) addCode(key);
            for (const code of option.codes || []) addCode(code);
            if (option.course_key) addCode(option.course_key);
            if (option.code) addCode(option.code);
            for (const id of option.course_ids || []) addId(id);
          }
          if (receiver.course_key) addCode(receiver.course_key);
          if (receiver.code_seen && !receiver.receiving) addCode(receiver.code_seen);
        }
      }
    }
  }

  return {
    keys,
    documents: docs.length,
    unresolved: [...unresolved].sort(),
    source: keys.size ? 'va_requirements' : docs.length ? 'offered_by_fallback' : 'offered_by_fallback',
  };
}

function normalizeCondition(value, inheritedGrade = null) {
  const item = typeof value === 'string' ? { course_key: value } : value || {};
  const code = normalizeCode(item.code ?? item.course_code ?? item.course_key ?? item.course_ref ?? item._id);
  const explicitNonCourse = /non.?course|placement|consent|permission|admission/i
    .test(String(item.type ?? item.kind ?? ''));
  if (!code || explicitNonCourse) {
    const text = item.text ?? item.label ?? item.description ?? item.raw
      ?? (typeof value === 'string' ? value : '');
    if (!String(text).trim()) return null;
    return {
      ...item,
      type: 'non_course',
      text: String(text),
      minimum_grade: item.minimum_grade ?? item.min_grade ?? inheritedGrade ?? null,
      raw: item.raw ?? String(text),
    };
  }
  return {
    ...item,
    type: 'course',
    course_key: graphKey(code),
    code,
    minimum_grade: item.minimum_grade ?? item.min_grade ?? inheritedGrade ?? null,
    raw: item.raw ?? null,
  };
}

function normalizePath(value, pathIndex, group) {
  const path = typeof value === 'string' ? { all_of: [value] } : value || {};
  let conditions = path.all_of ?? path.conditions ?? path.courses;
  if (conditions == null && (path.course_key || path.course_ref || path.code)) conditions = [path];
  // A nested `any_of` is used by some artifacts to retain compatibility. At
  // the path level it denotes one-course paths, not an AND condition list.
  if (conditions == null && path.any_of) conditions = path.any_of;
  return {
    ...path,
    id: path.id || null,
    index: pathIndex,
    raw: path.raw ?? null,
    non_course_alternatives: unique(asArray(path.non_course_alternatives).map(String)),
    all_of: asArray(conditions)
      .map((condition) => normalizeCondition(condition, path.minimum_grade ?? group.minimum_grade))
      .filter(Boolean),
  };
}

function pathsFromGroup(group) {
  if (Array.isArray(group.paths) && group.paths.length) {
    return group.paths.map((path, index) => normalizePath(path, index, group));
  }
  if (group.all_of) return [normalizePath({ all_of: group.all_of }, 0, group)];
  // Flattened compatibility form: each member of any_of is an OR path. An
  // element may itself be `{all_of:[...]}`, preserving A OR (B AND C).
  if (Array.isArray(group.any_of) && group.any_of.length) {
    return group.any_of.map((alternative, index) => {
      if (alternative && typeof alternative === 'object' && Array.isArray(alternative.all_of)) {
        return normalizePath(alternative, index, group);
      }
      return normalizePath({ all_of: [alternative] }, index, group);
    });
  }
  return [];
}

function documentPathGroups(doc) {
  if (!doc.paths) return [];
  if (Array.isArray(doc.paths)) {
    const byKind = new Map();
    for (const [index, path] of doc.paths.entries()) {
      const kind = String(path?.kind || 'prerequisite').replace(/s$/, '');
      const groupKey = path?.group_id ?? path?.formula_id ?? kind;
      if (!byKind.has(groupKey)) byKind.set(groupKey, { kind, paths: [], index, group_id: path?.group_id ?? path?.formula_id ?? null });
      byKind.get(groupKey).paths.push(path);
    }
    return [...byKind.values()];
  }
  if (typeof doc.paths === 'object') {
    return Object.entries(doc.paths).map(([kind, paths], index) => ({
      kind: String(kind).replace(/s$/, ''), paths: asArray(paths), index,
    }));
  }
  return [];
}

/**
 * Normalize both the initial flat `groups[].any_of` artifact and the lossless
 * formula representation. A formula is an AND requirement relative to sibling
 * formulas; its paths are OR alternatives; conditions within one path are AND.
 */
function normalizeRequisiteFormulas(doc) {
  const explicitPathGroups = documentPathGroups(doc);
  let groups = Array.isArray(doc.groups) ? doc.groups : [];
  if (!groups.length && explicitPathGroups.length) {
    groups = explicitPathGroups;
  } else if (groups.length && explicitPathGroups.length) {
    // Never collapse two source groups merely because both are prerequisites:
    // sibling groups are AND requirements. A document-level paths block may
    // enrich a group only when the match is unambiguous (or explicitly keyed).
    groups = groups.map((group, index) => {
      if (Array.isArray(group.paths) && group.paths.length) return group;
      const kind = String(group.kind || 'prerequisite').replace(/s$/, '');
      const sameKindSourceGroups = groups.filter((candidate) =>
        String(candidate.kind || 'prerequisite').replace(/s$/, '') === kind);
      const explicit = explicitPathGroups.find((candidate) =>
        candidate.group_id != null && (candidate.group_id === group.id || candidate.group_id === group.group_id))
        || (sameKindSourceGroups.length === 1
          ? explicitPathGroups.find((candidate) => candidate.kind === kind)
          : explicitPathGroups.find((candidate) => candidate.index === index));
      return explicit ? { ...group, paths: explicit.paths } : group;
    });
  }

  // An unsafe parse may intentionally have no structured groups. Preserve its
  // source prose as a rule for the verification queue, without fabricating a
  // graph formula from text the parser rejected.
  if (!groups.length && String(doc.status || '').toLowerCase() === 'unparsed'
      && (doc.raw_requisites || doc.raw_course_endtext)) {
    groups = [{
      kind: 'prerequisite',
      raw: doc.raw_requisites || doc.raw_course_endtext,
      paths: [],
      flags: ['unparsed'],
    }];
  }

  return groups.map((group, index) => {
    const kind = String(group.kind || 'prerequisite').toLowerCase().replace(/s$/, '');
    const validKind = kind === 'corequisite' ? 'corequisite' : 'prerequisite';
    const formulaId = `${graphKey(doc.course_key ?? doc.course_ref ?? doc.code ?? doc._id)}:${validKind}:${index}`;
    return {
      ...group,
      id: formulaId,
      index,
      kind: validKind,
      raw: group.raw ?? null,
      minimum_grade: group.minimum_grade ?? group.min_grade ?? null,
      non_course_alternatives: unique(asArray(group.non_course_alternatives).map(String)),
      semantics: 'any path; all conditions within a path',
      paths: pathsFromGroup(group).map((path, pathIndex) => ({
        ...path,
        id: path.id || `${formulaId}:path:${pathIndex}`,
      })),
    };
  });
}

function conceptRowsForMappings(conceptRows, mappedSlugs) {
  if (!mappedSlugs.size) return conceptRows;
  const bySlug = new Map(conceptRows.map((row) => [String(row.slug), row]));
  const included = new Set([...mappedSlugs].filter((slug) => bySlug.has(slug)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const slug of [...included]) {
      const row = bySlug.get(slug);
      const related = [
        ...(row?.requires || []).flatMap((entry) => Array.isArray(entry) ? entry : [entry]),
        ...(row?.satisfies || []),
      ].map(String);
      for (const next of related) {
        if (bySlug.has(next) && !included.has(next)) { included.add(next); changed = true; }
      }
    }
    for (const row of conceptRows) {
      if (included.has(String(row.slug))) continue;
      if ((row.satisfies || []).map(String).some((slug) => included.has(slug))) {
        included.add(String(row.slug)); changed = true;
      }
    }
  }
  return conceptRows.filter((row) => included.has(String(row.slug)));
}

function conceptContract(conceptRows) {
  const concepts = conceptRows.map((row) => ({
    slug: String(row.slug),
    name: row.name || row.slug,
    discipline: row.discipline || 'other',
    requires: row.requires || [],
    satisfies: (row.satisfies || []).map(String),
    note: row.note || '',
  }));
  let orSequence = 0;
  const rules = [];
  for (const concept of concepts) {
    for (const entry of concept.requires) {
      if (Array.isArray(entry)) {
        const group = `or:${concept.slug}:${orSequence++}`;
        for (const alternative of entry) {
          rules.push({ from: String(alternative), to: concept.slug, option: true, group });
        }
      } else {
        rules.push({ from: String(entry), to: concept.slug });
      }
    }
  }
  return { concepts, rules };
}

function courseContract(row, mapping, knownConcepts, extras = {}) {
  const identity = splitCode(row?.code ?? mapping?.code ?? extras.code ?? extras.key);
  const requestedConcept = mapping?.concept ?? null;
  const invalidConcept = requestedConcept && !knownConcepts.has(String(requestedConcept));
  const flags = unique([...flagNames(mapping), ...flagNames(row)]);
  const offeredBy = row?.offered_by || [];
  const appliedInstitutionOverride = Boolean(row?.institution_override);
  const institutionLocal = appliedInstitutionOverride
    || flags.some((flag) => /not_vccs|institution_local/i.test(flag))
    || (offeredBy.length > 0 && offeredBy.every((name) => /^Richard Bland\b/i.test(name)));
  return {
    key: graphKey(identity.code),
    source_course_id: row?._id ?? null,
    source_url: row?.source_url ?? mapping?.source_url ?? null,
    code: identity.code,
    prefix: identity.prefix,
    number: identity.number,
    title: row?.title ?? mapping?.title_seen ?? null,
    units: row?.credits ?? mapping?.credits ?? null,
    concept: invalidConcept ? null : requestedConcept,
    concept_invalid: invalidConcept ? String(requestedConcept) : null,
    concept_source: mapping?.concept_source
      ?? (mapping?.examined ? mapping?.source ?? mapping?.classifier_source ?? null : null),
    concept_confidence: mapping?.concept_confidence ?? mapping?.confidence ?? null,
    concept_note: mapping?.concept_note ?? mapping?.evidence?.rationale ?? null,
    review_status: mapping?.review_status ?? null,
    classification_method: mapping?.classification_method ?? null,
    language: mapping?.language ?? null,
    flags,
    examined: mapping ? mapping.examined !== false : false,
    mapping_scope_role: mapping?.scope_role ?? null,
    supply_kind: mapping?.supply_kind ?? null,
    scope_colleges: mapping?.scope_colleges ?? row?.scope_colleges ?? [],
    scope_source: mapping?.scope_source ?? row?.scope_source ?? null,
    transfer_evidence: mapping?.transfer_evidence ?? row?.transfer_evidence ?? null,
    scope_kind: institutionLocal ? 'institution_local' : 'vccs_shared',
    institution_override_source: row?.institution_override?.source ?? null,
    offered_by: offeredBy,
    transfer_observed_offered_by: row?.transfer_observed_offered_by ?? offeredBy,
    requirement_scope_supply_unconfirmed: row?.requirement_scope_supply_unconfirmed ?? [],
    source: appliedInstitutionOverride ? 'institution_local_override'
      : row?._synthetic_from_artifacts || row?._synthetic_from_requisite ? 'va_course_requisites'
      : row ? 'transfervirginia_course' : 'published_requisite_reference',
    source_label: row
      ? appliedInstitutionOverride
        ? 'Institution-local course identity from the selected institution’s requirement catalog; no local prerequisite policy is claimed'
        : row._synthetic_from_artifacts || row._synthetic_from_requisite
        ? 'Course identity and requirement-derived supply preserved by the Virginia prerequisite artifacts'
        : row.requirement_scope_supply_unconfirmed?.length
          ? 'Transfer Virginia identity with additional requirement-derived college supply awaiting verification'
        : institutionLocal ? 'Institution-local Virginia course' : 'Transfer Virginia shared course'
      : 'Published requisite missing from the Virginia course corpus',
    ...extras,
  };
}

function projectionInfo(college, university) {
  const richardBland = Boolean(college && /^Richard Bland\b/i.test(college.name));
  if (richardBland && university) return {
    mode: 'college_to_university',
    label: `${college.name} → ${university.name} local mapping review`,
    disclaimer: 'Richard Bland uses an institution-local course namespace. Its equivalencies are excluded from this VCCS transfer-preparation projection, and no Richard Bland prerequisite policy is claimed.',
  };
  if (richardBland) return {
    mode: 'community_college',
    label: `${college.name} CS course mapping review`,
    disclaimer: 'Requirement-scoped Richard Bland courses are shown for mapping review only; no published institution-local prerequisite policy is included.',
  };
  if (college && university) return {
    mode: 'college_to_university',
    label: `${college.name} → ${university.name} transfer preparation`,
    disclaimer: 'VCCS preparation accepted by the selected university; not the university’s local prerequisite policy.',
  };
  if (college) return {
    mode: 'community_college',
    label: `${college.name} CS prerequisites`,
    disclaimer: 'Published VCCS prerequisites projected against this college’s documented course supply.',
  };
  if (university) return {
    mode: 'transfer_preparation',
    label: `${university.name} accepted VCCS preparation`,
    disclaimer: 'Transfer preparation only; these are not university-local prerequisites.',
  };
  return {
    mode: 'canonical',
    label: 'Virginia CS prerequisite graph',
    disclaimer: 'Published Virginia course requisites across the community-college CS corpus.',
  };
}

async function virginiaPrerequisiteGraphData(db, selectors = {}) {
  const [courseRows, institutionRows, requirementRows, mappingRows, requisiteRows, allConceptRows] = await Promise.all([
    db.collection(COLLECTIONS.courses).find({}).toArray(),
    db.collection(COLLECTIONS.institutions).find({}).toArray(),
    db.collection(COLLECTIONS.requirements).find({}).toArray(),
    db.collection(COLLECTIONS.concepts).find({}).toArray(),
    db.collection(COLLECTIONS.requisites).find({}).toArray(),
    db.collection('curated_requirements').find({ kind: CONCEPT_KIND }).sort({ discipline: 1, slug: 1 }).toArray(),
  ]);

  const coursesByKey = new Map();
  const coursesById = new Map();
  for (const row of courseRows) {
    const key = courseIdentity(row);
    if (key) coursesByKey.set(key, row);
    if (row.course_id != null) coursesById.set(String(row.course_id), row);
  }
  const mappingsByKey = new Map(mappingRows.map((row) => [mappingIdentity(row), row]).filter(([key]) => key));
  const requisitesByKey = new Map(requisiteRows.map((row) => [requisiteIdentity(row), row]).filter(([key]) => key));
  const knownConcepts = new Set(allConceptRows.map((row) => String(row.slug)));
  const mappingGenerations = unique(mappingRows.map((row) => row.import_generation));
  const requisiteGenerations = unique(requisiteRows.map((row) => row.import_generation));
  const anyGeneration = mappingGenerations.length > 0 || requisiteGenerations.length > 0;
  const generationsComplete = !anyGeneration || (
    mappingRows.every((row) => row.import_generation)
    && requisiteRows.every((row) => row.import_generation)
  );
  const generationsAligned = !anyGeneration || (
    generationsComplete
    && mappingGenerations.length === 1
    && requisiteGenerations.length === 1
    && mappingGenerations[0] === requisiteGenerations[0]
  );
  const bothArtifactsPresent = mappingRows.length > 0 && requisiteRows.length > 0;
  const corpusAvailable = bothArtifactsPresent && generationsAligned;
  const corpusStatus = !mappingRows.length && !requisiteRows.length ? 'not_imported'
    : !bothArtifactsPresent ? 'incomplete_import'
      : !generationsAligned ? 'generation_mismatch' : 'available';
  const explicitDirectKeys = unique([
    ...mappingRows.filter((row) => row.scope_role === 'major_preparation').map(mappingIdentity),
    ...requisiteRows.filter((row) => row.scope_role === 'major_preparation').map(requisiteIdentity),
  ]);
  const hasExplicitArtifactScope = explicitDirectKeys.length > 0;

  const artifactSupplyNames = (key) => {
    const mapping = mappingsByKey.get(key);
    const requisite = requisitesByKey.get(key);
    return unique([
      ...asArray(requisite?.scope_colleges),
      ...asArray(mapping?.scope_colleges),
      ...asArray(requisite?.offered_by),
      ...asArray(requisite?.vccs_colleges),
      ...asArray(mapping?.offered_by),
      ...asArray(mapping?.vccs_colleges),
    ].map(String));
  };

  const institutionOverrideFor = (row, institution = college) => {
    if (!row?.institution_overrides || !institution) return null;
    const raw = row.institution_overrides;
    const candidates = Array.isArray(raw) ? raw
      : Object.entries(raw).map(([name, value]) => ({
        ...(value && typeof value === 'object' ? value : {}), institution: name,
      }));
    return candidates.find((override) => sameCollegeName(
      override.institution ?? override.college ?? override.name,
      institution.name,
    )) || null;
  };

  // Scope artifacts can preserve a legitimate VCCS/Richard Bland code even
  // when the broad Transfer Virginia search returned an unrelated four-year
  // course with the same code. Include their supplier names while resolving a
  // college selector; never use the colliding four-year row as course evidence.
  const artifactInstitutionCourses = explicitDirectKeys.map((key) => ({
    code: normalizeCode(key),
    offered_by: artifactSupplyNames(key),
    articulates_to: [],
  }));
  const institutionCourseRows = [...courseRows, ...artifactInstitutionCourses];
  const college = resolveInstitution('college', selectors.college, institutionRows, institutionCourseRows, requirementRows);
  const university = resolveInstitution('university', selectors.university, institutionRows, institutionCourseRows, requirementRows);
  const projection = { ...projectionInfo(college, university), college, university };
  const richardBlandProjection = Boolean(college && /^Richard Bland\b/i.test(college.name));

  const knownCcNames = new Set(institutionRows
    .filter((row) => row.level === 'community_college').map((row) => row.name));
  const isCcSupplyName = (name) => knownCcNames.has(name)
    || [...knownCcNames].some((known) => sameCollegeName(known, name))
    || (!institutionRows.some((row) => row.name === name) && isCommunityCollegeName(name));
  const hasCcSupply = (row) => (row.offered_by || []).some(isCcSupplyName);
  const offeredAtCollege = (row) => !college
    || (row.offered_by || []).some((name) => sameCollegeName(name, college.name));
  const universitySourceNames = university ? sourceNamesForInstitution(university.name) : [];
  const landingAtUniversity = (row) => university
    ? (row.articulates_to || []).find((landing) => universitySourceNames.includes(landing.institution)) || null
    : null;

  const courseFromArtifacts = (key) => {
    const requisite = requisitesByKey.get(key);
    const mapping = mappingsByKey.get(key);
    if (!requisite && !mapping) return null;
    const embedded = requisite?.course && typeof requisite.course === 'object'
      ? requisite.course : requisite || mapping;
    const code = normalizeCode(embedded?.code ?? embedded?.course_key ?? embedded?.course_ref
      ?? mapping?.code ?? mapping?.course_key ?? key);
    if (!code) return null;

    const sourceRow = coursesByKey.get(key);
    const institutionOverride = institutionOverrideFor(requisite)
      || institutionOverrideFor(mapping);
    const institutionIdentityCollision = Boolean(institutionOverride
      && [
        ...flagNames(institutionOverride),
        ...flagNames(requisite),
        ...flagNames(mapping),
      ].includes('mixed_scope_identity_collision'));
    const suppressInheritedArticulations = institutionIdentityCollision
      || Boolean(richardBlandProjection && institutionOverride);
    const artifactSupply = artifactSupplyNames(key);
    const scopeColleges = unique([
      ...asArray(requisite?.scope_colleges),
      ...asArray(mapping?.scope_colleges),
    ].map(String));
    const overlapsRequirementScope = !scopeColleges.length
      || (sourceRow?.offered_by || []).some((name) =>
        scopeColleges.some((scopeName) => sameCollegeName(name, scopeName)));
    // A Transfer Virginia row is safe only when a real community-college
    // supplier overlaps the requirement-derived scope. A same-code row carried
    // only by four-year institutions—or by
    // different community colleges than those that named this requirement—is
    // a search collision, so use the scoped artifact identity instead.
    const trustedSource = sourceRow && hasCcSupply(sourceRow) && overlapsRequirementScope
      ? sourceRow : null;
    const offeredBy = unique([
      ...(trustedSource?.offered_by || []),
      ...artifactSupply,
    ]);
    const unconfirmedScopeColleges = scopeColleges.filter((scopeName) =>
      !(trustedSource?.offered_by || []).some((name) => sameCollegeName(name, scopeName)));
    if (!trustedSource && !embedded?.title && !mapping?.title_seen && !offeredBy.length) return null;
    return {
      ...(trustedSource || {}),
      _id: trustedSource?._id ?? null,
      code,
      title: institutionOverride?.title ?? embedded?.title ?? mapping?.title_seen
        ?? trustedSource?.title ?? null,
      credits: institutionOverride?.credits ?? embedded?.credits ?? trustedSource?.credits ?? null,
      department: trustedSource?.department ?? embedded?.department ?? splitCode(code).prefix,
      source_url: institutionOverride?.source_url ?? embedded?.source_url
        ?? mapping?.source_url ?? trustedSource?.source_url ?? null,
      offered_by: offeredBy,
      transfer_observed_offered_by: trustedSource?.offered_by || [],
      requirement_scope_supply_unconfirmed: unconfirmedScopeColleges,
      scope_colleges: requisite?.scope_colleges ?? mapping?.scope_colleges ?? [],
      scope_source: requisite?.scope_source ?? mapping?.scope_source ?? null,
      transfer_evidence: requisite?.transfer_evidence ?? mapping?.transfer_evidence ?? null,
      institution_override: institutionOverride,
      // University equivalencies are valid only when they came from the
      // trusted community-college course record, never from a code collision
      // or an institution-specific identity override.
      articulates_to: suppressInheritedArticulations ? [] : trustedSource?.articulates_to || [],
      flags: unique([
        ...flagNames(mapping),
        ...flagNames(requisite),
        ...flagNames(trustedSource),
        ...flagNames(institutionOverride),
        ...(trustedSource && unconfirmedScopeColleges.length
          ? ['requirement_scope_supply_unconfirmed'] : []),
      ]),
      _synthetic_from_artifacts: !trustedSource,
      _transferva_code_collision: Boolean(sourceRow && !trustedSource),
    };
  };

  if (corpusAvailable && hasExplicitArtifactScope) {
    for (const key of explicitDirectKeys) {
      const scopedCourse = courseFromArtifacts(key);
      if (scopedCourse) coursesByKey.set(key, scopedCourse);
    }
  }

  const requisiteForProjection = (key) => {
    const requisite = requisitesByKey.get(key);
    if (!requisite || !college || richardBlandProjection) return requisite;
    const difference = (requisite.local_override_audit?.differences || []).find((row) =>
      sameCollegeName(row.college_name ?? row.college ?? row.college_slug, college.name));
    if (!difference) return requisite;
    return {
      ...requisite,
      status: difference.local_status || requisite.status,
      raw_requisites: difference.local_raw ?? requisite.raw_requisites,
      groups: difference.local_groups || requisite.groups,
      source: 'vccs_college_course_file',
      source_url: difference.source_url || requisite.source_url,
      flags: unique([...flagNames(requisite), 'local_override_applied']),
    };
  };

  const requirementScope = collectRequirementScope(requirementRows, college, coursesById);
  const direct = new Map();
  let excludedNoCcArtifacts = 0;
  let excludedNonVccsTransfer = 0;
  const directCandidates = !corpusAvailable ? []
    : hasExplicitArtifactScope
      ? explicitDirectKeys.map((key) => coursesByKey.get(key) || courseFromArtifacts(key)).filter(Boolean)
      : courseRows;
  for (const row of directCandidates) {
    const key = courseIdentity(row);
    if (!key) continue;
    const mapping = mappingsByKey.get(key);
    const requisite = requisitesByKey.get(key);
    const transferFlags = unique([
      ...flagNames(row), ...flagNames(mapping), ...flagNames(requisite),
    ]);
    const vccsTransferEligible = mapping?.supply_kind !== 'richard_bland_scope'
      && requisite?.supply_kind !== 'richard_bland_scope'
      && !transferFlags.some((flag) => /^(?:non_vccs|richard_bland_scope)$/.test(flag))
      && !((row.offered_by || []).length
        && (row.offered_by || []).every((name) => /^Richard Bland\b/i.test(name)));
    const hasSupply = hasCcSupply(row);
    const offered = offeredAtCollege(row);
    const landing = landingAtUniversity(row);
    if (university && landing && !vccsTransferEligible) excludedNonVccsTransfer += 1;
    let include = false;
    if (college && university) {
      include = vccsTransferEligible && offered && Boolean(landing);
    } else if (college) {
      // This imported universe is already CS-scoped. Local degree documents
      // annotate its coverage; they do not remove CS-relevant courses used by
      // another Virginia pathway from a college's offered-course projection.
      include = offered;
    } else if (university) {
      include = vccsTransferEligible && hasSupply && Boolean(landing);
      if (landing && !hasSupply) excludedNoCcArtifacts += 1;
    } else {
      include = hasSupply;
      if (!hasSupply) excludedNoCcArtifacts += 1;
    }
    if (include) direct.set(key, { row, landing });
  }

  const availableInProjection = (row) => {
    if (!row) return false;
    if (college) return offeredAtCollege(row);
    if (university) return hasCcSupply(row);
    return hasCcSupply(row);
  };

  const visibleAvailable = new Set(direct.keys());
  const missing = new Map();
  const pending = [...direct.keys()];
  const publishedGroups = [];
  const edges = [];
  const gaps = [];
  const processed = new Set();

  while (pending.length) {
    const dependentKey = pending.pop();
    if (processed.has(dependentKey)) continue;
    processed.add(dependentKey);
    const requisite = requisiteForProjection(dependentKey);
    if (!requisite) continue;
    // Richard Bland has its own numbering and local prerequisite policy. A
    // same-code VCCS master rule can describe a different course entirely, so
    // it is not projected onto Richard Bland without institution-local proof.
    if (richardBlandProjection && requisite.source === 'vccs_master_course_file') continue;

    const requisiteFlags = flagNames(requisite);
    const unsafeSource = String(requisite.status || '').toLowerCase() === 'unparsed'
      || requisiteFlags.some((flag) => ['unsafe_parse', 'unsafe_formula', 'parse_failed'].includes(flag));

    for (const formula of normalizeRequisiteFormulas(requisite)) {
      const renderedPaths = [];
      for (const [pathIndex, path] of formula.paths.entries()) {
        const renderedConditions = [];
        for (const [conditionIndex, condition] of path.all_of.entries()) {
          if (unsafeSource) {
            renderedConditions.push({
              ...condition,
              available: null,
              external: condition.type === 'non_course',
              provisional: true,
            });
            continue;
          }
          // Placement, consent, admission, and other non-course conditions are
          // part of the lossless rule, but never become fake graph edges.
          if (condition.type === 'non_course') {
            renderedConditions.push({ ...condition, available: null, external: true });
            continue;
          }
          const prerequisiteKey = graphKey(condition.course_key || condition.code);
          const prerequisite = coursesByKey.get(prerequisiteKey)
            || courseFromArtifacts(prerequisiteKey);
          if (prerequisite?._synthetic_from_artifacts && !coursesByKey.has(prerequisiteKey)) {
            coursesByKey.set(prerequisiteKey, prerequisite);
          }
          const available = availableInProjection(prerequisite);
          if (available) {
            if (!visibleAvailable.has(prerequisiteKey)) {
              visibleAvailable.add(prerequisiteKey);
              pending.push(prerequisiteKey);
            }
          } else if (!missing.has(prerequisiteKey)) {
            missing.set(prerequisiteKey, {
              row: prerequisite || null,
              code: condition.code,
              required_by: new Set(),
            });
          }
          if (!available) missing.get(prerequisiteKey)?.required_by.add(dependentKey);

          const edge = {
            from: prerequisiteKey,
            to: dependentKey,
            kind: formula.kind,
            published: true,
            source: 'vccs_published_requisite',
            source_label: formula.kind === 'corequisite'
              ? 'Published Virginia corequisite' : 'Published Virginia prerequisite',
            source_status: requisite.status ?? null,
            flags: unique([...flagNames(formula), ...requisiteFlags]),
            provisional: false,
            formula_id: formula.id,
            path_id: path.id,
            path_index: pathIndex,
            condition_index: conditionIndex,
            option: formula.paths.length > 1,
            group: formula.id,
            path_conjunction: 'and',
            formula_disjunction: 'or',
            formula_semantics: 'visual_projection; inspect published_groups for the lossless formula',
            minimum_grade: condition.minimum_grade ?? formula.minimum_grade,
            equivalent_allowed: condition.equivalent_allowed === true,
            condition: condition.condition ?? null,
            raw: condition.raw ?? path.raw ?? formula.raw,
            non_course_alternatives: unique([
              ...formula.non_course_alternatives,
              ...path.non_course_alternatives,
            ]),
            available,
            missing: !available,
          };
          edges.push(edge);
          renderedConditions.push({ ...condition, available });
        }
        const courseConditions = renderedConditions.filter((condition) => condition.type !== 'non_course');
        const nonCourseConditions = renderedConditions.filter((condition) => condition.type === 'non_course');
        renderedPaths.push({
          ...path,
          all_of: renderedConditions,
          course_supply_available: courseConditions.every((condition) => condition.available),
          available: courseConditions.length
            ? courseConditions.every((condition) => condition.available)
            : nonCourseConditions.length > 0,
          requires_non_course: nonCourseConditions.length > 0,
        });
      }

      if (unsafeSource) {
        publishedGroups.push({
          ...formula,
          course_key: dependentKey,
          dependent_course_key: dependentKey,
          paths: renderedPaths.map((path) => ({
            ...path, available: null, course_supply_available: null,
          })),
          course_supply_satisfiable: null,
          satisfiable_in_projection: null,
          status: requisite.status ?? null,
          source_status: requisite.status ?? null,
          source: requisite.source ?? 'vccs_catalog',
          source_url: requisite.source_url ?? null,
          flags: unique([...flagNames(formula), ...requisiteFlags, 'unparsed']),
          provisional: true,
        });
        continue;
      }

      const hasStandaloneNonCourseAlternative = formula.non_course_alternatives.length > 0
        || renderedPaths.some((path) => (
          path.non_course_alternatives.length > 0
          || (path.all_of.length > 0 && path.all_of.every((condition) => condition.type === 'non_course'))
        ));
      const coursePathAvailable = renderedPaths.some((path) => {
        const courseConditions = path.all_of.filter((condition) => condition.type !== 'non_course');
        return courseConditions.length > 0 && courseConditions.every((condition) => condition.available);
      });
      const supplySatisfiable = coursePathAvailable || hasStandaloneNonCourseAlternative;
      const pathVerdicts = renderedPaths.map((path) => {
        const courseConditions = path.all_of.filter((condition) => condition.type !== 'non_course');
        if (courseConditions.some((condition) => !condition.available)) return false;
        if (path.requires_non_course) return null;
        return courseConditions.length > 0;
      });
      const satisfiableInProjection = pathVerdicts.includes(true) ? true
        : pathVerdicts.includes(null) || hasStandaloneNonCourseAlternative ? null : false;
      const renderedFormula = {
        ...formula,
        course_key: dependentKey,
        dependent_course_key: dependentKey,
        paths: renderedPaths,
        course_supply_satisfiable: supplySatisfiable,
        // External conditions cannot be evaluated here. A mixed course +
        // consent path is not declared satisfied merely because its course is
        // available; the full formula remains explicit for the consumer.
        satisfiable_in_projection: satisfiableInProjection,
        status: requisite.status ?? null,
        source_status: requisite.status ?? null,
        source: requisite.source ?? 'vccs_catalog',
        source_url: requisite.source_url ?? null,
        flags: unique([...flagNames(formula), ...requisiteFlags]),
        provisional: false,
      };
      publishedGroups.push(renderedFormula);
      if (!supplySatisfiable) {
        gaps.push({
          dependent_course_key: dependentKey,
          formula_id: formula.id,
          kind: formula.kind,
          status: 'missing_course_supply',
          missing_course_keys: unique(renderedPaths
            .flatMap((path) => path.all_of.filter((condition) =>
              condition.type !== 'non_course' && !condition.available)
              .map((condition) => condition.course_key))),
          non_course_alternatives: unique([
            ...formula.non_course_alternatives,
            ...renderedPaths.flatMap((path) => path.non_course_alternatives),
          ]),
          raw: formula.raw,
        });
      }
    }
  }

  const directRole = university ? 'transfer_preparation' : 'major_preparation';
  const mappingForProjection = (key) => {
    const mapping = mappingsByKey.get(key);
    if (!richardBlandProjection || !mapping) return mapping;
    const institutionOverride = institutionOverrideFor(mapping);
    if (mapping.supply_kind === 'richard_bland_scope') return mapping;
    return {
      ...mapping,
      concept: institutionOverride
        && Object.prototype.hasOwnProperty.call(institutionOverride, 'concept')
        ? institutionOverride.concept : null,
      flags: unique([
        ...flagNames(mapping),
        ...flagNames(institutionOverride),
        'vccs_mapping_not_applicable_to_richard_bland',
      ]),
    };
  };
  const requisiteContractForProjection = (requisite) => {
    if (!richardBlandProjection || requisite?.source !== 'vccs_master_course_file') {
      return {
        status: requisite?.status ?? null,
        flags: flagNames(requisite),
        source_url: requisite?.source_url ?? null,
        raw: requisite?.raw_requisites ?? null,
      };
    }
    return {
      status: 'not_applicable',
      flags: unique([...flagNames(requisite), 'vccs_master_not_applicable_to_richard_bland']),
      source_url: null,
      raw: null,
    };
  };
  const courseContracts = [];
  for (const key of visibleAvailable) {
    const row = coursesByKey.get(key);
    const directEntry = direct.get(key);
    const requisite = requisiteForProjection(key);
    const projectedRequisite = requisiteContractForProjection(requisite);
    courseContracts.push(courseContract(row, mappingForProjection(key), knownConcepts, {
      in_scope: Boolean(directEntry),
      role: directEntry ? directRole : 'prerequisite_only',
      available: true,
      missing: false,
      lands_as: directEntry?.landing || landingAtUniversity(row),
      accepted_by_university: university ? Boolean(landingAtUniversity(row)) : null,
      requisite_status: projectedRequisite.status,
      requisite_flags: projectedRequisite.flags,
      requisite_source_url: projectedRequisite.source_url,
      raw_requisites: projectedRequisite.raw,
    }));
  }
  for (const [key, entry] of missing) {
    const requisite = requisiteForProjection(key);
    const projectedRequisite = requisiteContractForProjection(requisite);
    courseContracts.push(courseContract(entry.row, mappingForProjection(key), knownConcepts, {
      key,
      code: entry.code,
      in_scope: false,
      role: 'missing_prerequisite',
      available: false,
      missing: true,
      reason: entry.row && college
        ? `Not found in ${college.name} course supply`
        : entry.row ? 'No community-college supplier in the gathered Virginia corpus'
          : 'Referenced by a published requisite but absent from the gathered course corpus',
      required_by: [...entry.required_by].sort(),
      lands_as: entry.row ? landingAtUniversity(entry.row) : null,
      accepted_by_university: university && entry.row ? Boolean(landingAtUniversity(entry.row)) : null,
      requisite_status: projectedRequisite.status,
      requisite_flags: projectedRequisite.flags,
      requisite_source_url: projectedRequisite.source_url,
      raw_requisites: projectedRequisite.raw,
      source_label: entry.row
        ? `Published requisite not offered by ${college?.name || 'a Virginia community college'}`
        : 'Published requisite missing from the Virginia course corpus',
    }));
  }
  courseContracts.sort((left, right) => left.code.localeCompare(right.code));

  const mappedSlugs = new Set(courseContracts.map((row) => row.concept).filter(Boolean));
  const displayConceptRows = corpusAvailable
    ? conceptRowsForMappings(allConceptRows, mappedSlugs) : [];
  const { concepts, rules: conceptRules } = conceptContract(displayConceptRows);

  const directCourses = courseContracts.filter((row) => row.in_scope);
  const examined = directCourses.filter((row) => mappingsByKey.has(row.key)).length;
  const mapped = directCourses.filter((row) => row.concept).length;
  const institutionLocal = courseContracts.filter((row) => row.scope_kind === 'institution_local').length;
  const richardBlandOnly = courseContracts.filter((row) => row.supply_kind === 'richard_bland_scope'
    || row.flags.includes('richard_bland_scope')).length;
  const noMasterCourse = courseContracts.filter((row) => row.flags.includes('no_master_course')).length;
  const unconfirmedProjectedSupply = college
    ? directCourses.filter((row) => row.requirement_scope_supply_unconfirmed.some((name) =>
      sameCollegeName(name, college.name))).length
    : 0;
  const invalidConcepts = courseContracts.filter((row) => row.concept_invalid).map((row) => ({
    course_key: row.key, concept: row.concept_invalid,
  }));
  const requirementNotOffered = college && requirementScope.keys.size
    ? [...requirementScope.keys].filter((key) => {
      const row = coursesByKey.get(key);
      return !row || !offeredAtCollege(row);
    }).sort()
    : [];
  const coverageWarnings = [];
  const directMissingRequisites = directCourses.filter((row) => row.requisite_status === 'missing').length;
  const directUnparsedRequisites = directCourses.filter((row) => row.requisite_status === 'unparsed').length;
  const coverageIncomplete = directMissingRequisites > 0 || invalidConcepts.length > 0
    || unconfirmedProjectedSupply > 0
    || publishedGroups.some((rule) => rule.provisional) || !corpusAvailable;
  if (!corpusAvailable) coverageWarnings.push({
    code: 'prerequisite_corpus_not_imported',
    message: corpusStatus === 'generation_mismatch'
      ? 'The Virginia prerequisite mapping and requisite collections are from different import generations.'
      : corpusStatus === 'incomplete_import'
        ? 'Only part of the Virginia prerequisite corpus has been imported.'
        : 'The Virginia prerequisite mapping and requisite collections have not been imported.',
  });
  if (institutionLocal) coverageWarnings.push({
    code: 'institution_local_courses', count: institutionLocal,
    message: 'Institution-local/Richard Bland courses are not statewide VCCS equivalencies.',
  });
  if (excludedNoCcArtifacts) coverageWarnings.push({
    code: 'excluded_no_cc_supply', count: excludedNoCcArtifacts,
    message: 'Records with no community-college supplier were excluded from the statewide projection.',
  });
  if (excludedNonVccsTransfer) coverageWarnings.push({
    code: 'excluded_non_vccs_transfer_rows', count: excludedNonVccsTransfer,
    message: 'Richard Bland/institution-local equivalencies were excluded from this VCCS transfer-preparation view.',
  });
  if (requirementNotOffered.length) coverageWarnings.push({
    code: 'required_course_not_offered', count: requirementNotOffered.length,
    message: 'Courses referenced by the selected CS degree document were not found in this college’s supply.',
  });
  if (unconfirmedProjectedSupply) coverageWarnings.push({
    code: 'requirement_scope_supply_unconfirmed', count: unconfirmedProjectedSupply,
    message: 'Requirement-derived course relevance is retained, but current Transfer Virginia supply at the selected college was not corroborated.',
  });
  if (directMissingRequisites) coverageWarnings.push({
    code: 'published_requisite_source_missing', count: directMissingRequisites,
    message: 'The VCCS requisite source could not be collected for these in-scope courses.',
  });
  if (directUnparsedRequisites) coverageWarnings.push({
    code: 'published_requisite_formula_unparsed', count: directUnparsedRequisites,
    message: 'Raw VCCS requisite text is retained, but unsafe formulas were omitted from visual graph edges.',
  });

  return {
    concepts,
    // Virginia's authoritative rules are the published course formulas. Keep
    // canonical concept-DAG links available separately for template display;
    // consumers must not mistake those normative links for VCCS publication.
    rules: publishedGroups,
    concept_rules: conceptRules,
    stats: {
      in_scope: directCourses.length,
      examined,
      mapped,
      edges: edges.length,
      prerequisite_only: courseContracts.filter((row) => row.role === 'prerequisite_only').length,
      missing_prerequisites: missing.size,
      gaps: gaps.filter((gap) => gap.status === 'missing_course_supply').length,
      published_groups: publishedGroups.length,
      institution_local: institutionLocal,
      richard_bland_only: richardBlandOnly,
      no_master_course: noMasterCourse,
      requirement_scope_supply_unconfirmed: unconfirmedProjectedSupply,
      excluded_no_cc_artifacts: excludedNoCcArtifacts,
      excluded_non_vccs_transfer_rows: excludedNonVccsTransfer,
      invalid_concepts: invalidConcepts,
      requisite_examined: directCourses.filter((row) => row.requisite_status != null).length,
      requisite_parsed: directCourses.filter((row) => row.requisite_status === 'parsed').length,
      requisite_none: directCourses.filter((row) => row.requisite_status === 'none').length,
      requisite_missing: directMissingRequisites,
      requisite_unparsed: directUnparsedRequisites,
      requisite_not_applicable: directCourses.filter((row) => row.requisite_status === 'not_applicable').length,
      requisite_flagged: directCourses.filter((row) => row.requisite_flags.length > 0).length,
      provisional_rules: publishedGroups.filter((rule) => rule.provisional).length,
      no_result: directCourses.length === 0,
      corpus_available: corpusAvailable,
      corpus_status: corpusStatus,
      import_generation: generationsAligned && mappingGenerations.length === 1
        ? mappingGenerations[0] : null,
    },
    courses: courseContracts,
    edges,
    published_groups: publishedGroups,
    missing: courseContracts.filter((row) => row.missing),
    gaps,
    projection,
    scope: {
      major_slug: 'cs',
      course_scope_source: hasExplicitArtifactScope
        ? college
          ? university ? 'va_prerequisite_scope_supply_intersect_articulates_to' : 'va_prerequisite_scope_supply'
          : university ? 'va_prerequisite_scope_community_college_supply_intersect_articulates_to'
            : 'va_prerequisite_scope_artifacts'
        : college
          ? university ? 'va_courses.offered_by_intersect_articulates_to' : 'va_courses.offered_by'
          : university ? 'va_courses.community_college_supply_intersect_articulates_to'
            : 'va_courses_cs_corpus',
      requirement_documents: requirementScope.documents,
      requirement_annotation_source: college ? requirementScope.source : null,
      unresolved_requirement_ids: requirementScope.unresolved,
      requirement_courses_not_offered: requirementNotOffered,
      not_vccs: Boolean(college && /^Richard Bland\b/i.test(college.name)),
      authority: college && /^Richard Bland\b/i.test(college.name)
        ? 'not_vccs' : 'vccs_statewide_minimum',
      incomplete: coverageIncomplete,
      corpus_imported: corpusAvailable,
      corpus_status: corpusStatus,
      coverage: !corpusAvailable ? 'unavailable'
        : college && /^Richard Bland\b/i.test(college.name) ? 'not_vccs'
          : coverageIncomplete ? 'incomplete' : 'complete',
    },
    sources: {
      courses: { collection: COLLECTIONS.courses, label: 'Transfer Virginia course corpus' },
      scope: { collections: [COLLECTIONS.concepts, COLLECTIONS.requisites], label: 'Virginia CS requirement-derived course scope' },
      mappings: { collection: COLLECTIONS.concepts, label: 'Reviewed Virginia course-to-concept mappings' },
      requisites: { collection: COLLECTIONS.requisites, label: 'Published Virginia prerequisites and corequisites' },
      concepts: { collection: 'curated_requirements', kind: CONCEPT_KIND, label: 'Shared canonical prerequisite concepts' },
      university_projection: university
        ? 'articulates_to equivalencies; not university-local prerequisite rules' : null,
    },
    coverage_warnings: coverageWarnings,
  };
}

module.exports = {
  UnknownVirginiaInstitutionError,
  graphKey,
  normalizeCode,
  normalizeRequisiteFormulas,
  resolveInstitution,
  virginiaPrerequisiteGraphData,
};
