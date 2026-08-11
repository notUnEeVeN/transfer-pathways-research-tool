/**
 * Compile a source-walked Virginia degree composition into the canonical
 * requirement tree consumed by the API and analysis services.
 *
 * Raw catalog parsers deliberately stop at a neutral, reviewable AST. They do
 * not have enough information to decide that an adjacent table is an option,
 * a prerequisite-qualified sequence, or a supplemental menu. A composition is
 * the small human-reviewable layer that makes those decisions explicitly with
 * source references and readable course codes. This compiler adds only the
 * project's deterministic numeric identities and canonical receiver wrappers.
 */
const {
  canonicalCourseCode,
  courseIdFor,
  courseKeyFor,
} = require('./courseIdentity');

const text = (value) => typeof value === 'string' && value.trim().length > 0;

function concreteCode(value, path) {
  const code = canonicalCourseCode(value);
  if (courseIdFor(code) == null) throw new Error(`${path}: invalid concrete course code ${value}`);
  return code;
}

function canonicalReceiverBase(receiver) {
  return {
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    hash_id: null,
    tier: receiver.tier ?? null,
    course_level: receiver.course_level ?? null,
    cc_articulable: receiver.cc_articulable ?? null,
    overlap_key: receiver.overlap_key ?? null,
    note: receiver.note ?? null,
  };
}

function compileCommunityCollegeReceiver(receiver, path, collect) {
  if (receiver.kind !== 'cc_course') {
    throw new Error(`${path}: community-college receiver kind must be cc_course`);
  }
  if (!Array.isArray(receiver.options) || receiver.options.length === 0) {
    throw new Error(`${path}.options: at least one course route is required`);
  }
  const options = receiver.options.map((route, index) => {
    const raw = Array.isArray(route) ? route : route?.courses;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new Error(`${path}.options[${index}]: non-empty course array required`);
    }
    const codes = raw.map((value, ci) => concreteCode(value, `${path}.options[${index}][${ci}]`));
    codes.forEach(collect);
    return {
      course_ids: codes.map(courseIdFor),
      course_keys: codes.map(courseKeyFor),
      course_conjunction: 'and',
    };
  });
  return {
    ...canonicalReceiverBase(receiver),
    receiving: null,
    articulation_status: 'articulated',
    options,
    options_conjunction: 'or',
    code_seen: options.map((option) => option.course_keys.map((key) => key.slice(3)).join(' + ')).join(' / '),
    human_review: receiver.human_review ?? null,
  };
}

function compileUniversityReceiver(receiver, path, collect) {
  const base = canonicalReceiverBase(receiver);
  if (receiver.kind === 'course') {
    const code = concreteCode(receiver.code, `${path}.code`);
    collect(code, receiver.title);
    return {
      ...base,
      receiving: { kind: 'course', parent_id: courseIdFor(code), units: receiver.units ?? null },
      code_seen: code,
      human_review: receiver.human_review ?? null,
    };
  }
  if (receiver.kind === 'series') {
    if (!Array.isArray(receiver.codes) || receiver.codes.length < 2) {
      throw new Error(`${path}.codes: a series needs at least two courses`);
    }
    const codes = receiver.codes.map((value, index) => concreteCode(value, `${path}.codes[${index}]`));
    codes.forEach(collect);
    return {
      ...base,
      receiving: {
        kind: 'series',
        conjunction: 'and',
        parent_ids: codes.map(courseIdFor),
        units: receiver.units ?? null,
      },
      code_seen: codes.join(' + '),
      human_review: receiver.human_review ?? null,
    };
  }
  if (receiver.kind === 'ge_area') {
    if (!text(receiver.code) && !text(receiver.name)) {
      throw new Error(`${path}: ge_area needs a code or name`);
    }
    return {
      ...base,
      receiving: {
        kind: 'ge_area', parent_id: null,
        code: receiver.code ?? null, name: receiver.name ?? null,
        units: receiver.units ?? null,
      },
      code_seen: null,
      human_review: receiver.human_review ?? null,
    };
  }
  if (receiver.kind === 'requirement') {
    if (!text(receiver.name)) throw new Error(`${path}: requirement needs a name`);
    return {
      ...base,
      receiving: {
        kind: 'requirement', parent_id: null, name: receiver.name,
        units: receiver.units ?? null,
      },
      code_seen: null,
      human_review: receiver.human_review ?? null,
    };
  }
  throw new Error(`${path}: unsupported university receiver kind ${receiver.kind || '<missing>'}`);
}

function compileSection(section, { cc, group, path, collect }) {
  if (!Number.isInteger(section.select) || section.select <= 0) {
    throw new Error(`${path}.select: positive integer required`);
  }
  if (!Number.isFinite(section.units) || section.units < 0) {
    throw new Error(`${path}.units: explicit non-negative units required`);
  }
  const refs = section.source_refs || group.source_refs || [];
  if (!Array.isArray(refs) || refs.length === 0) throw new Error(`${path}.source_refs: required`);
  const receiverCompiler = cc ? compileCommunityCollegeReceiver : compileUniversityReceiver;
  const receivers = (section.receivers || []).map((receiver, index) => receiverCompiler(
    receiver,
    `${path}.receivers[${index}]`,
    collect,
  ));
  if (!receivers.length) throw new Error(`${path}.receivers: non-empty array required`);
  return {
    section_advisement: section.select,
    unit_advisement: section.units,
    unit_advisement_max: section.units_max ?? section.units,
    label_seen: section.label ?? null,
    tier: section.tier ?? group.tier ?? null,
    course_level: section.course_level ?? group.course_level ?? null,
    cc_articulable: section.cc_articulable ?? group.cc_articulable ?? null,
    source_refs: refs,
    note: section.note ?? null,
    overlap_key: section.overlap_key ?? null,
    human_review: section.human_review ?? null,
    analysis_constraints: section.analysis_constraints || [],
    assume_satisfiable: section.assume_satisfiable === true,
    receivers,
  };
}

function compileGroup(group, index, { cc, collect }) {
  const path = `requirement_groups[${index}]`;
  if (!text(group.title)) throw new Error(`${path}.title: required`);
  if (!Array.isArray(group.source_refs) || group.source_refs.length === 0) {
    throw new Error(`${path}.source_refs: required`);
  }
  if (cc && group.units_fill === true) {
    return {
      title: group.title,
      group_conjunction: 'And',
      source_refs: group.source_refs,
      units_fill: true,
      sections: [],
      note: group.note ?? null,
    };
  }
  if (cc && text(group.ge_area)) {
    if (!Number.isFinite(group.units) || group.units <= 0) {
      throw new Error(`${path}.units: positive GE units required`);
    }
    return {
      title: group.title,
      group_conjunction: group.conjunction || 'And',
      source_refs: group.source_refs,
      ge_area: group.ge_area,
      distinct_areas: group.distinct_areas ?? null,
      note: group.note ?? null,
      human_review: group.human_review ?? null,
      analysis_constraints: group.analysis_constraints || [],
      stated_credits: group.stated_credits ?? null,
      sections: [{
        section_advisement: null,
        unit_advisement: group.units,
        unit_advisement_max: group.units_max ?? group.units,
        source_refs: group.source_refs,
        receivers: [],
      }],
    };
  }
  if (!Array.isArray(group.sections) || group.sections.length === 0) {
    throw new Error(`${path}.sections: non-empty array required`);
  }
  const sections = group.sections.map((section, si) => compileSection(section, {
    cc, group, path: `${path}.sections[${si}]`, collect,
  }));
  return {
    title: group.title,
    is_required: group.is_required !== false,
    group_conjunction: group.conjunction || 'And',
    requirement_layer: group.requirement_layer ?? (cc ? 'associate_degree' : null),
    tier: group.tier ?? null,
    course_level: group.course_level ?? null,
    cc_articulable: group.cc_articulable ?? null,
    source_refs: group.source_refs,
    note: group.note ?? null,
    overlap_key: group.overlap_key ?? null,
    human_review: group.human_review ?? null,
    analysis_constraints: group.analysis_constraints || [],
    stated_credits: group.stated_credits ?? null,
    ...(Number.isInteger(group.canonical_section_index)
      ? { canonical_section_index: group.canonical_section_index }
      : {}),
    distinct_course_ids_across_sections: group.distinct_course_ids_across_sections === true,
    sections,
  };
}

/**
 * Option dictionaries preserve catalog menus whose exact choose-by-credit,
 * no-double-count, or category rules cannot yet be represented as ordinary
 * receivers. They are still part of the degree's course identity catalog and
 * must therefore participate in `codes_seen`.
 *
 * The dictionaries intentionally remain schema-flexible. Walk their values
 * and collect only strings that satisfy the concrete Virginia course grammar;
 * prose, source ids, category labels, and placeholders are ignored.
 */
function collectOptionSetCodes(value, collect) {
  if (typeof value === 'string') {
    if (courseIdFor(value) != null) collect(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectOptionSetCodes(entry, collect));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((entry) => collectOptionSetCodes(entry, collect));
  }
}

/** Compile readable, cited composition JSON without mutating it. */
function compileDegreeComposition(composition, { institutionLevel } = {}) {
  const cc = ['community_college', 'community-college', 'cc'].includes(institutionLevel);
  const codes = new Set();
  const titles = { ...(composition.course_titles || {}) };
  const collect = (raw, title) => {
    const code = concreteCode(raw, 'course');
    codes.add(code);
    if (text(title) && !titles[code]) titles[code] = title.trim();
  };
  if (!Array.isArray(composition.requirement_groups) || composition.requirement_groups.length === 0) {
    throw new Error('requirement_groups: non-empty array required');
  }
  const requirementGroups = composition.requirement_groups.map((group, index) => compileGroup(
    group, index, { cc, collect },
  ));
  Object.keys(titles).forEach((code) => {
    if (courseIdFor(code) != null) collect(code);
  });
  collectOptionSetCodes(composition.option_sets, collect);
  return {
    requirement_groups: requirementGroups,
    codes_seen: [...codes].sort(),
    course_titles: titles,
  };
}

module.exports = { compileDegreeComposition };
