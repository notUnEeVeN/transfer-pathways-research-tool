/**
 * Acceptance gate for normalized Virginia degree-requirement documents.
 *
 * This validator deliberately sits after scraping/parsing. It does not repair a
 * document or infer missing requirements; it answers two separate questions:
 *
 *   catalog         Is this a source-backed, structurally complete catalog record?
 *   analysis_ready  Can the requirement tree safely feed coverage/unit analysis?
 *
 * Expected input (irrelevant display fields are omitted):
 *
 *   validateDegreeAcceptance(doc, {
 *     institutionLevel: 'four_year' | 'community_college',
 *     resolveCourse({ side, id, key, path }) => boolean | course-object,
 *     isOfficialSource(source) => boolean,        // optional override
 *   })
 *
 * Every document has `catalog_year`, `unit_system`, `total_units`, and an
 * ordered `sources` registry. A source is `{ id, kind, label, url, official? }`;
 * every requirement group and ordinary section cites it by `source_refs`.
 *
 * Four-year documents additionally carry:
 *
 *   requirement_layers: {
 *     major: { status: 'complete', source_refs: [...] },
 *     ge_college: { status: 'complete', source_refs: [...] },
 *     university_graduation: { status: 'complete', source_refs: [...] },
 *   },
 *   unit_audit: {
 *     graduation_minimum, modeled_units,
 *     upper_division: {
 *       status: 'required' | 'none_stated', minimum_units?, modeled_units?,
 *       rule?, reason?, source_refs: [...]
 *     },
 *     residency: {
 *       status: 'required' | 'none_stated', minimum_units?, rule?, reason?,
 *       source_refs: [...]
 *     }
 *   }
 *
 * `requirement_layers` may be omitted when the layer is embedded in tagged
 * groups (`requirement_layer`) whose source kinds establish the same ownership.
 * This keeps a single official catalog that embeds major, GE, and graduation
 * rules representable without inventing three URLs.
 *
 * Ordinary sections always state both `section_advisement` and
 * `unit_advisement`. Four-year OR alternatives are separate course/series
 * receivers; a `series` is only an AND sequence. Associate-degree receivers
 * have `receiving: null`; alternative routes are separate options, and each
 * option's `course_ids`/`course_keys` are an AND bundle. Group-level `ge_area`
 * and `units_fill` are the only associate-degree special forms.
 */

const LEVEL_ALIASES = new Map([
  ['four_year', 'four_year'],
  ['four-year', 'four_year'],
  ['4-year', 'four_year'],
  ['university', 'four_year'],
  ['community_college', 'community_college'],
  ['community-college', 'community_college'],
  ['cc', 'community_college'],
  ['two_year', 'community_college'],
]);

const LAYER_ALIASES = {
  major: ['major'],
  ge_college: ['ge_college', 'college_ge', 'ge', 'general_education', 'college'],
  university_graduation: ['university_graduation', 'graduation', 'university', 'residency'],
};

const LAYER_SOURCE_KINDS = {
  major: new Set(['major', 'program', 'department']),
  ge_college: new Set(['ge', 'general_education', 'college', 'ge_authority']),
  university_graduation: new Set(['graduation', 'residency', 'university']),
};

const COMPLETE_LAYER_STATUSES = new Set(['complete', 'verified', 'embedded']);
const DECLARATION_STATUSES = new Set(['required', 'none_stated', 'not_applicable']);
const CONTAMINATION = /(?:sample|suggested|recommended)\s+(?:plan|program|schedule)|plan\s+of\s+study|accelerated|fast[-\s]?track|\b4\s*\+\s*1\b|honou?rs?\s+(?:program|track|curriculum|option)/i;
const CATALOG_YEAR = /\b20\d{2}(?:\s*[-\u2013/]\s*(?:20)?\d{2})?\b/;
const VA_OWNER = /^va:(cc|uni):([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const LOCAL_NAMESPACE_REQUIRED_OWNERS = new Set([
  'va:cc:richard-bland-college',
]);
// This collector models transfer-oriented science awards. An A.A.S. is a
// materially different, career-oriented award and must not be promoted to an
// A.S. merely because it was the closest computing result in a catalog search.
const AS_AWARD = /^(?:A\.?S\.?|AS-T|AA&S)$/i;
const AS_TITLE = /associate\s+(?:(?:in|of)\s+)?science|associate\s+(?:of\s+)?arts\s+and\s+sciences|\bA\.?S\.?\b|\bAA&S\b/i;
const UNRESOLVED_LABEL = /unresolved|unknown course|missing course|no (?:catalog )?(?:course|articulation|parent[_ ]?id)/i;
const PSEUDO_CODE = /(?:TRNS|ELEC)\d*X{1,3}|-{2,}|\b(?:ELECTIVE|PLACEHOLDER)\b/i;
// Two current official Acalog hosts serve only over HTTP or downgrade after an
// HTTPS certificate/redirect failure. Keep the exceptions host-exact; an
// arbitrary insecure .edu URL is still rejected.
const INSECURE_OFFICIAL_CATALOG_HOSTS = new Set([
  'catalog.rbc.edu',
  'catalog.uvawise.edu',
]);

const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const finite = (value) => Number.isFinite(value);
const positive = (value) => finite(value) && value > 0;
const nonNegative = (value) => finite(value) && value >= 0;
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const refsOf = (value) => Array.isArray(value?.source_refs) ? value.source_refs : [];

function makeChecks() {
  const checks = [];
  const add = (name, ok, detail, extra = {}) => {
    checks.push({ name, severity: ok ? 'pass' : 'fail', detail, ...extra });
  };
  return { checks, add };
}

function finish(checks, blocked = false) {
  const failed = checks.filter((check) => check.severity === 'fail');
  const ok = !blocked && failed.length === 0;
  return {
    ok,
    verdict: ok ? 'pass' : 'fail',
    checks,
    failed: failed.map((check) => check.name),
  };
}

function normalizedLevel(value) {
  return LEVEL_ALIASES.get(String(value || '').trim().toLowerCase()) || null;
}

function defaultOfficialSource(source) {
  if (source?.official === false) return false;
  if (source?.official === true) return true;
  try {
    const hostname = new URL(source.url).hostname.toLowerCase();
    return hostname.endsWith('.edu') || hostname.endsWith('.gov')
      || hostname === 'transfervirginia.org' || hostname.endsWith('.transfervirginia.org')
      || hostname === 'vccs.edu' || hostname.endsWith('.vccs.edu');
  } catch (_) {
    return false;
  }
}

function acceptableSourceUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      || (parsed.protocol === 'http:' && INSECURE_OFFICIAL_CATALOG_HOSTS.has(parsed.hostname.toLowerCase()));
  } catch (_) { return false; }
}

function sourceRegistry(doc, isOfficialSource) {
  const sources = Array.isArray(doc?.sources) ? doc.sources : [];
  const ids = sources.map((source) => String(source?.id || '').trim());
  const duplicates = [...new Set(ids.filter((id, index) => id && ids.indexOf(id) !== index))];
  const malformed = [];
  const unofficial = [];
  sources.forEach((source, index) => {
    const path = `sources[${index}]`;
    if (!source || !text(source.id) || !text(source.kind) || !text(source.label)
        || !acceptableSourceUrl(source.url)) malformed.push(path);
    else if (!isOfficialSource(source)) unofficial.push(path);
  });
  return {
    sources, ids: new Set(ids.filter(Boolean)), duplicates, malformed, unofficial,
  };
}

function walkSourceRefs(value, sourceIds, path = 'doc', out = []) {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkSourceRefs(entry, sourceIds, `${path}[${index}]`, out));
    return out;
  }
  if (own(value, 'source_refs')) {
    const refs = value.source_refs;
    const notApplicable = String(value.status || '').trim().toLowerCase() === 'not_applicable';
    if (!Array.isArray(refs) || (refs.length === 0 && !notApplicable)
        || refs.some((ref) => !text(ref))) {
      out.push({ path: `${path}.source_refs`, reason: 'must be a non-empty array of source ids' });
    } else {
      const unknown = refs.filter((ref) => !sourceIds.has(ref));
      if (unknown.length) out.push({ path: `${path}.source_refs`, reason: 'unknown source ids', refs: unknown });
    }
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'sources' && key !== 'source_refs') walkSourceRefs(child, sourceIds, `${path}.${key}`, out);
  }
  return out;
}

function requiredTreeRefs(doc, sourceIds) {
  const issues = [];
  (doc.requirement_groups || []).forEach((group, gi) => {
    const gp = `requirement_groups[${gi}]`;
    if (!refsOf(group).length) issues.push({ path: `${gp}.source_refs`, reason: 'group source refs required' });
    else {
      const unknown = refsOf(group).filter((ref) => !sourceIds.has(ref));
      if (unknown.length) issues.push({ path: `${gp}.source_refs`, reason: 'unknown source ids', refs: unknown });
    }
    if (group?.units_fill === true) return;
    (group?.sections || []).forEach((section, si) => {
      const sp = `${gp}.sections[${si}]`;
      if (!refsOf(section).length) issues.push({ path: `${sp}.source_refs`, reason: 'section source refs required' });
      else {
        const unknown = refsOf(section).filter((ref) => !sourceIds.has(ref));
        if (unknown.length) issues.push({ path: `${sp}.source_refs`, reason: 'unknown source ids', refs: unknown });
      }
    });
  });
  return issues;
}

function courseNamespaceIssues(doc, owner) {
  const namespace = doc.course_namespace;
  if (namespace == null) {
    return LOCAL_NAMESPACE_REQUIRED_OWNERS.has(owner)
      ? ['course_namespace is required for this institution-local catalog']
      : [];
  }
  if (!namespace || typeof namespace !== 'object' || Array.isArray(namespace)) {
    return ['course_namespace must be an object'];
  }
  const issues = [];
  if (namespace.kind !== 'institution_local') issues.push('course_namespace.kind must be institution_local');
  if (namespace.institution_id !== owner) issues.push('course_namespace.institution_id must match college ownership');
  if (namespace.vccs_master_applicable !== false) {
    issues.push('course_namespace.vccs_master_applicable must be false');
  }
  if (namespace.identity_contract !== 'owner_plus_course_id') {
    issues.push('course_namespace.identity_contract must be owner_plus_course_id');
  }
  if (namespace.scoped_key_format !== `${owner}:<code>`) {
    issues.push('course_namespace.scoped_key_format must be <college_id>:<code>');
  }
  if (!Array.isArray(namespace.source_refs) || namespace.source_refs.length === 0) {
    issues.push('course_namespace.source_refs must cite official namespace evidence');
  }
  return issues;
}

function identityIssues(doc, level) {
  const issues = [];
  if (level === 'four_year') {
    if (doc.kind !== 'degree') issues.push('kind must be degree');
    const owner = doc.school_id || doc.institution_id;
    const match = VA_OWNER.exec(String(owner || ''));
    if (!match || match[1] !== 'uni') issues.push('school_id/institution_id must be va:uni:<slug>');
    if (doc.school_id && doc.institution_id && doc.school_id !== doc.institution_id) {
      issues.push('school_id and institution_id disagree');
    }
    if (!text(doc._id) || !match || !doc._id.startsWith(`va:degree:${match[2]}:`)) {
      issues.push('_id must begin va:degree:<owner-slug>:');
    }
    if (!text(doc.major_slug)) issues.push('major_slug is required');
    if (!text(doc.program)) issues.push('program title is required');
    if (doc.course_namespace != null) issues.push('course_namespace is only supported for community-college degrees');
  } else if (level === 'community_college') {
    if (doc.kind !== 'as_degree') issues.push('kind must be as_degree');
    const owner = doc.college_id || doc.community_college_id;
    const match = VA_OWNER.exec(String(owner || ''));
    if (!match || match[1] !== 'cc') issues.push('college_id/community_college_id must be va:cc:<slug>');
    if (doc.college_id && doc.community_college_id && doc.college_id !== doc.community_college_id) {
      issues.push('college_id and community_college_id disagree');
    }
    if (!text(doc._id) || !match || !doc._id.startsWith(`va:as:${match[2]}:`)) {
      issues.push('_id must begin va:as:<owner-slug>:');
    }
    if (!text(doc.major_slug)) issues.push('major_slug is required');
    if (!text(doc.degree_title_seen)) issues.push('degree_title_seen is required');
    else if (!AS_TITLE.test(doc.degree_title_seen)) issues.push('degree_title_seen must identify an associate science award');
    if (!text(doc.degree_type) || !AS_AWARD.test(doc.degree_type.trim())) {
      issues.push('degree_type must identify an A.S. award');
    }
    if (!text(doc.source)) issues.push('source is required');
    issues.push(...courseNamespaceIssues(doc, owner));
  } else {
    issues.push('institutionLevel must be four_year or community_college');
  }
  return issues;
}

function catalogMetadataIssues(doc, level, sourceUrls) {
  const issues = [];
  if (!text(doc.catalog_year) || !CATALOG_YEAR.test(doc.catalog_year)) issues.push('explicit catalog_year is required');
  if (!positive(doc.total_units)) issues.push('total_units must be a positive number');
  if (!['semester', 'quarter'].includes(doc.unit_system)) issues.push('unit_system must be semester or quarter');
  const title = level === 'four_year' ? doc.program : doc.degree_title_seen;
  if (!text(title)) issues.push('degree title is required');
  const primary = level === 'four_year' ? doc.source_url : (doc.catalog_url || doc.source_url);
  if (!acceptableSourceUrl(primary)) issues.push('primary catalog URL must be HTTPS or an allowlisted official HTTP catalog');
  else if (!sourceUrls.has(primary)) issues.push('primary catalog URL must appear in sources');
  return issues;
}

function contaminationHits(doc) {
  const values = [
    ['program', doc.program], ['degree_title_seen', doc.degree_title_seen],
    ['status', doc.status], ['research_status', doc.research_status],
  ];
  (doc.requirement_groups || []).forEach((group, gi) => {
    values.push([`requirement_groups[${gi}].title`, group?.title]);
    values.push([`requirement_groups[${gi}].label_seen`, group?.label_seen]);
    (group?.source_text || []).forEach((line, li) => values.push([
      `requirement_groups[${gi}].source_text[${li}]`, line,
    ]));
    (group?.sections || []).forEach((section, si) => {
      values.push([`requirement_groups[${gi}].sections[${si}].title`, section?.title]);
      values.push([`requirement_groups[${gi}].sections[${si}].label_seen`, section?.label_seen]);
    });
  });
  return values.filter(([, value]) => text(value) && CONTAMINATION.test(value))
    .map(([path, value]) => ({ path, value }));
}

function layerName(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return Object.keys(LAYER_ALIASES).find((name) => LAYER_ALIASES[name].includes(normalized)) || null;
}

function explicitLayer(doc, name) {
  const layers = doc.requirement_layers || doc.degree_layers || doc.layers || {};
  for (const alias of LAYER_ALIASES[name]) if (layers[alias]) return layers[alias];
  return null;
}

function sourceKindsFor(refs, byId) {
  return new Set((refs || []).map((ref) => String(byId.get(ref)?.kind || '').toLowerCase()).filter(Boolean));
}

function embeddedLayer(doc, name, byId) {
  const allowedKinds = LAYER_SOURCE_KINDS[name];
  return (doc.requirement_groups || []).some((group) => {
    const tagged = layerName(group?.requirement_layer || group?.layer) === name;
    const kinds = sourceKindsFor(refsOf(group), byId);
    const sourced = [...kinds].some((kind) => allowedKinds.has(kind));
    if (tagged && sourced) return true;
    if (!sourced) return false;
    if (name === 'major') return group?.tier === 'transferable' || /major/i.test(group?.title || group?.label_seen || '');
    if (name === 'ge_college') return group?.tier === 'breadth' || group?.ge_area != null;
    return group?.tier === 'nontransferable'
      || ['upper_division', 'residency'].includes(group?.course_level);
  });
}

function fourYearLayerIssues(doc, sourceIds, byId) {
  const issues = [];
  for (const name of Object.keys(LAYER_ALIASES)) {
    const explicit = explicitLayer(doc, name);
    if (explicit) {
      if (!COMPLETE_LAYER_STATUSES.has(String(explicit.status || '').toLowerCase())) {
        issues.push({ layer: name, reason: 'status must be complete, verified, or embedded' });
        continue;
      }
      const refs = refsOf(explicit);
      if (!refs.length || refs.some((ref) => !sourceIds.has(ref))) {
        issues.push({ layer: name, reason: 'layer source_refs must resolve' });
      }
      continue;
    }
    if (!embeddedLayer(doc, name, byId)) {
      issues.push({ layer: name, reason: 'no explicit complete layer or source-backed embedded group' });
    }
  }
  if (!text(doc.ge_authority)) issues.push({ layer: 'ge_college', reason: 'ge_authority is required' });
  if (!text(doc.academic_unit)) issues.push({ layer: 'major', reason: 'academic_unit is required' });
  return issues;
}

function sectionShapeIssues(doc, level) {
  const issues = [];
  const groups = doc.requirement_groups;
  if (!Array.isArray(groups) || groups.length === 0) return [{ path: 'requirement_groups', reason: 'non-empty array required' }];
  let fillGroups = 0;
  groups.forEach((group, gi) => {
    const gp = `requirement_groups[${gi}]`;
    if (!group || typeof group !== 'object') { issues.push({ path: gp, reason: 'group must be an object' }); return; }
    if (!text(group.title) && !text(group.label_seen)) issues.push({ path: gp, reason: 'group title is required' });
    const conjunction = String(group.group_conjunction || '').toLowerCase();
    if (!own(group, 'group_conjunction') || !['and', 'or'].includes(conjunction)) {
      issues.push({ path: `${gp}.group_conjunction`, reason: 'explicit And or Or is required' });
    }
    if (level === 'four_year') {
      if (!['transferable', 'breadth', 'nontransferable'].includes(group.tier)) {
        issues.push({ path: `${gp}.tier`, reason: 'four-year tier must be transferable, breadth, or nontransferable' });
      }
      if (!text(group.course_level)) issues.push({ path: `${gp}.course_level`, reason: 'four-year course_level is required' });
      if (typeof group.cc_articulable !== 'boolean') {
        issues.push({ path: `${gp}.cc_articulable`, reason: 'four-year cc_articulable boolean is required' });
      }
    }
    if (own(group, 'group_unit_advisement') && group.group_unit_advisement != null
        && !nonNegative(group.group_unit_advisement)) {
      issues.push({ path: `${gp}.group_unit_advisement`, reason: 'must be null or a non-negative number' });
    }

    const fill = level === 'community_college' && group.units_fill === true;
    const ge = level === 'community_college' && text(group.ge_area);
    if (fill) {
      fillGroups += 1;
      if (ge) issues.push({ path: gp, reason: 'units_fill and ge_area are mutually exclusive' });
      if (Array.isArray(group.sections) && group.sections.length) {
        issues.push({ path: `${gp}.sections`, reason: 'units_fill must not carry sections' });
      }
      return;
    }

    if (!Array.isArray(group.sections) || group.sections.length === 0) {
      issues.push({ path: `${gp}.sections`, reason: 'non-empty sections required' });
      return;
    }
    if (conjunction === 'or' && group.sections.length < 2) {
      issues.push({ path: `${gp}.group_conjunction`, reason: 'Or requires at least two alternative sections' });
    }
    group.sections.forEach((section, si) => {
      const sp = `${gp}.sections[${si}]`;
      if (!section || typeof section !== 'object') { issues.push({ path: sp, reason: 'section must be an object' }); return; }
      if (!own(section, 'unit_advisement') || !nonNegative(section.unit_advisement)) {
        issues.push({ path: `${sp}.unit_advisement`, reason: 'explicit non-negative units required' });
      }
      if (ge) {
        if (!positive(section.unit_advisement)) {
          issues.push({ path: `${sp}.unit_advisement`, reason: 'CC ge_area needs an explicit positive unit amount' });
        }
        if (own(section, 'section_advisement') && section.section_advisement != null
            && (!Number.isInteger(section.section_advisement) || section.section_advisement < 0)) {
          issues.push({ path: `${sp}.section_advisement`, reason: 'GE selection must be null or a non-negative integer' });
        }
        if (Array.isArray(section.receivers) && section.receivers.length) {
          issues.push({ path: `${sp}.receivers`, reason: 'CC ge_area sections must not enumerate receivers' });
        }
        return;
      }
      if (!own(section, 'section_advisement') || !Number.isInteger(section.section_advisement)
          || section.section_advisement <= 0) {
        issues.push({ path: `${sp}.section_advisement`, reason: 'explicit positive integer selection required' });
      }
      if (!Array.isArray(section.receivers) || section.receivers.length === 0) {
        issues.push({ path: `${sp}.receivers`, reason: 'ordinary section needs receivers' });
      } else if (Number.isInteger(section.section_advisement)
          && section.section_advisement > section.receivers.length
          && !section.assume_satisfiable
          && !section.receivers.some((receiver) => receiver?.receiving?.kind === 'ge_area')) {
        issues.push({ path: `${sp}.section_advisement`, reason: 'selection exceeds receiver count' });
      }
    });
  });
  if (fillGroups > 1) issues.push({ path: 'requirement_groups', reason: 'at most one units_fill group is allowed' });
  return issues;
}

function callResolver(resolveCourse, query) {
  if (typeof resolveCourse !== 'function') return { ok: false, reason: 'resolver not supplied' };
  try {
    const found = resolveCourse(query);
    if (found && typeof found.then === 'function') return { ok: false, reason: 'resolver must be synchronous' };
    if (found === true) return { ok: true };
    if (!found) return { ok: false, reason: 'not found' };
    if (typeof found !== 'object') return { ok: false, reason: 'invalid resolver result' };
    const foundId = found.course_id ?? found.parent_id ?? found.id;
    const foundKey = found.course_key ?? found.key;
    if (foundId != null && Number(foundId) !== Number(query.id)) return { ok: false, reason: 'id mismatch' };
    if (query.key != null && foundKey != null && foundKey !== query.key) return { ok: false, reason: 'key mismatch' };
    return { ok: foundId != null || foundKey != null, reason: 'resolver object has no identity' };
  } catch (error) {
    return { ok: false, reason: error.message || 'resolver threw' };
  }
}

function receiverIssues(doc, level, resolveCourse) {
  const semantics = [];
  const unresolved = [];
  const resolution = [];
  const seenIds = [];

  const recordResolution = (id, key, side, path) => {
    seenIds.push({ id, key, side, path });
    const result = callResolver(resolveCourse, { side, id, key, path, doc });
    if (!result.ok) resolution.push({ path, id, key, reason: result.reason });
  };

  (doc.requirement_groups || []).forEach((group, gi) => {
    if (group?.units_fill === true || (level === 'community_college' && text(group?.ge_area))) return;
    (group?.sections || []).forEach((section, si) => {
      const sp = `requirement_groups[${gi}].sections[${si}]`;
      (section?.receivers || []).forEach((receiver, ri) => {
        const rp = `${sp}.receivers[${ri}]`;
        if (!receiver || typeof receiver !== 'object') { semantics.push({ path: rp, reason: 'receiver must be an object' }); return; }
        if (receiver.unresolved === true || UNRESOLVED_LABEL.test(receiver.human_review || '')
            || PSEUDO_CODE.test(receiver.code_seen || '')) {
          unresolved.push({ path: rp, values: [receiver.code_seen || receiver.human_review] });
        }
        if (level === 'community_college') {
          if (receiver.receiving != null) semantics.push({ path: `${rp}.receiving`, reason: 'AS receiver must be null' });
          if (receiver.articulation_status !== 'articulated') {
            semantics.push({ path: `${rp}.articulation_status`, reason: 'AS course receiver must be articulated' });
          }
          if (receiver.options_conjunction !== 'or') {
            semantics.push({ path: `${rp}.options_conjunction`, reason: 'alternative options must use or' });
          }
          if (!Array.isArray(receiver.options) || receiver.options.length === 0) {
            semantics.push({ path: `${rp}.options`, reason: 'AS receiver needs explicit options' });
            return;
          }
          receiver.options.forEach((option, oi) => {
            const op = `${rp}.options[${oi}]`;
            if (!option || option.course_conjunction !== 'and') {
              semantics.push({ path: `${op}.course_conjunction`, reason: 'courses inside one option must use and' });
            }
            const ids = option?.course_ids;
            const keys = option?.course_keys;
            if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
              semantics.push({ path: `${op}.course_ids`, reason: 'non-empty positive integer ids required' });
              return;
            }
            if (!Array.isArray(keys) || keys.length !== ids.length || keys.some((key) => !/^va:[A-Z]{2,5}\d{2,4}[A-Z]?$/.test(key))) {
              semantics.push({ path: `${op}.course_keys`, reason: 'course_keys must align with ids as va:CODE' });
              return;
            }
            if (new Set(ids).size !== ids.length || new Set(keys).size !== keys.length) {
              semantics.push({ path: op, reason: 'duplicate course identity inside option' });
            }
            ids.forEach((id, ii) => recordResolution(id, keys[ii], 'community_college', `${op}.course_ids[${ii}]`));
          });
          return;
        }

        if (!Array.isArray(receiver.options) || receiver.options.length !== 0) {
          semantics.push({ path: `${rp}.options`, reason: 'generic four-year template options must be empty' });
        }
        if (receiver.options_conjunction !== 'or') {
          semantics.push({ path: `${rp}.options_conjunction`, reason: 'template options_conjunction must be or' });
        }
        const receiving = receiver.receiving;
        if (!receiving || typeof receiving !== 'object') {
          semantics.push({ path: `${rp}.receiving`, reason: 'four-year receiver is required' });
          return;
        }
        if (receiving.kind === 'course') {
          if (!Number.isInteger(receiving.parent_id) || receiving.parent_id <= 0) {
            semantics.push({ path: `${rp}.receiving.parent_id`, reason: 'course needs a positive integer parent_id' });
            unresolved.push({ path: rp, values: [receiver.code_seen || null] });
          } else {
            recordResolution(receiving.parent_id, null, 'receiving', `${rp}.receiving.parent_id`);
          }
          if (Array.isArray(receiving.parent_ids) && receiving.parent_ids.length) {
            semantics.push({ path: `${rp}.receiving.parent_ids`, reason: 'course must not carry parent_ids' });
          }
        } else if (receiving.kind === 'series') {
          if (String(receiving.conjunction || '').toLowerCase() !== 'and') {
            semantics.push({ path: `${rp}.receiving.conjunction`, reason: 'series is an AND sequence; OR alternatives are separate receivers' });
          }
          const ids = receiving.parent_ids;
          if (!Array.isArray(ids) || ids.length < 2 || ids.some((id) => !Number.isInteger(id) || id <= 0)) {
            semantics.push({ path: `${rp}.receiving.parent_ids`, reason: 'series needs at least two positive integer parent_ids' });
            unresolved.push({ path: rp, values: [receiver.code_seen || null] });
          } else {
            if (new Set(ids).size !== ids.length) semantics.push({ path: `${rp}.receiving.parent_ids`, reason: 'series parent_ids must be distinct' });
            ids.forEach((id, ii) => recordResolution(id, null, 'receiving', `${rp}.receiving.parent_ids[${ii}]`));
          }
          if (receiving.parent_id != null) semantics.push({ path: `${rp}.receiving.parent_id`, reason: 'series parent_id must be null/absent' });
        } else if (receiving.kind === 'requirement') {
          if (receiving.parent_id != null || !text(receiving.name)) {
            semantics.push({ path: `${rp}.receiving`, reason: 'university-only requirement needs name and null parent_id' });
          }
          const articulable = section.cc_articulable ?? group.cc_articulable;
          if (articulable !== false) {
            semantics.push({ path: rp, reason: 'university-only requirement must explicitly set cc_articulable false' });
          }
          if (UNRESOLVED_LABEL.test(receiving.name || '')) {
            unresolved.push({ path: `${rp}.receiving.name`, values: [receiving.name] });
          }
        } else if (receiving.kind === 'ge_area') {
          if (receiving.parent_id != null || !text(receiving.code || receiving.name)) {
            semantics.push({ path: `${rp}.receiving`, reason: 'ge_area needs a code/name and no parent_id' });
          }
          if ((section.tier || group.tier) !== 'breadth') {
            semantics.push({ path: rp, reason: 'ge_area must be in the breadth tier' });
          }
        } else {
          semantics.push({ path: `${rp}.receiving.kind`, reason: `unsupported receiver kind: ${receiving.kind || '<missing>'}` });
        }
      });
    });
  });

  // Importers and hand-editors have used both document/group arrays and parser
  // validation checks for this signal. Treat every explicit unresolved marker
  // the same; changing where it was recorded must not make it disappear.
  (function findMarkers(value, path = 'doc') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => findMarkers(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      const childPath = `${path}.${key}`;
      if (/^unresolved(?:_courses_seen|_codes)?$/.test(key)
          && ((Array.isArray(child) && child.length) || (!Array.isArray(child) && child))) {
        unresolved.push({ path: childPath, values: Array.isArray(child) ? child : [child] });
      }
      if (key === 'data_quality_flags' && Array.isArray(child)) {
        const flags = child.filter((flag) => /unresolved.*course|course.*unresolved|missing.*course.*id/i
          .test(`${flag?.code || ''} ${flag?.message || ''}`));
        if (flags.length) unresolved.push({ path: childPath, values: flags });
      }
      if (key === 'checks' && Array.isArray(child)) {
        const checks = child.filter((entry) => /codes?_unresolved|unresolved_courses?/i.test(entry?.name || '')
          && (entry?.severity !== 'pass' || (entry?.codes || []).length));
        if (checks.length) unresolved.push({ path: childPath, values: checks });
      }
      findMarkers(child, childPath);
    }
  }(doc));
  const distinctUnresolved = unresolved.filter((issue, index) => unresolved.findIndex((other) =>
    other.path === issue.path) === index);
  return { semantics, unresolved: distinctUnresolved, resolution, referenced: seenIds.length };
}

function canonicalUnits(doc, level) {
  const issues = [];
  let total = 0;
  let fill = 0;
  (doc.requirement_groups || []).forEach((group, gi) => {
    const gp = `requirement_groups[${gi}]`;
    if (group?.units_fill === true) { fill += 1; return; }
    if (positive(group?.group_unit_advisement) || group?.group_unit_advisement === 0) {
      total += Number(group.group_unit_advisement);
      return;
    }
    const units = (group?.sections || []).map((section) => section?.unit_advisement);
    if (units.some((value) => !nonNegative(value))) return;
    const isOr = String(group?.group_conjunction || '').toLowerCase() === 'or' && units.length > 1;
    if (!isOr) { total += units.reduce((sum, value) => sum + value, 0); return; }
    const index = group.canonical_section_index;
    if (own(group, 'canonical_section_index')) {
      if (Number.isInteger(index) && index >= 0 && index < units.length) total += units[index];
      else issues.push({ path: `${gp}.canonical_section_index`, reason: 'must select an existing OR section' });
    } else if (units.every((value) => value === units[0])) total += units[0];
    else issues.push({ path: gp, reason: 'OR paths have different units; canonical_section_index required' });
  });
  if (level === 'four_year' && fill) issues.push({ path: 'requirement_groups', reason: 'four-year model must state elective capacity, not use units_fill' });
  if (level === 'community_college' && fill) {
    if (total > doc.total_units) issues.push({ path: 'requirement_groups', reason: 'stated groups exceed total before units_fill' });
    else total = doc.total_units;
  }
  return { total, fill_groups: fill, issues };
}

function declarationIssues(name, declaration, sourceIds) {
  const issues = [];
  if (!declaration || typeof declaration !== 'object') return [{ field: name, reason: 'explicit declaration required' }];
  const status = String(declaration.status || '').toLowerCase();
  if (!DECLARATION_STATUSES.has(status)) issues.push({ field: name, reason: 'status must be required, none_stated, or not_applicable' });
  const refs = refsOf(declaration);
  if (!refs.length || refs.some((ref) => !sourceIds.has(ref))) issues.push({ field: name, reason: 'source_refs must resolve' });
  if (status === 'required') {
    if (name === 'upper_division') {
      if (!positive(declaration.minimum_units)) issues.push({ field: name, reason: 'upper division needs numeric minimum_units' });
      if (!nonNegative(declaration.modeled_units)) issues.push({ field: name, reason: 'upper division needs modeled_units' });
      else if (positive(declaration.minimum_units) && declaration.modeled_units < declaration.minimum_units) {
        issues.push({ field: name, reason: 'modeled upper-division units are below minimum' });
      }
    } else if (!positive(declaration.minimum_units) && !text(declaration.rule)) {
      issues.push({ field: name, reason: 'required declaration needs minimum_units or rule' });
    }
  } else if (DECLARATION_STATUSES.has(status) && !text(declaration.reason || declaration.note)) {
    issues.push({ field: name, reason: `${status} declaration needs a reason` });
  }
  return issues;
}

function unitAuditIssues(doc, level, sourceIds) {
  const issues = [];
  const modeled = canonicalUnits(doc, level);
  issues.push(...modeled.issues);
  if (level === 'community_college') {
    if (positive(doc.total_units) && Math.abs(modeled.total - doc.total_units) > 0.001) {
      issues.push({ field: 'total_units', reason: `modeled ${modeled.total} does not close to ${doc.total_units}` });
    }
    return { issues, modeled_units: modeled.total };
  }

  const audit = doc.unit_audit;
  if (!audit || typeof audit !== 'object') return {
    issues: [...issues, { field: 'unit_audit', reason: 'unit_audit is required' }],
    modeled_units: modeled.total,
  };
  if (!positive(audit.graduation_minimum) || Math.abs(audit.graduation_minimum - doc.total_units) > 0.001) {
    issues.push({ field: 'unit_audit.graduation_minimum', reason: 'must equal total_units' });
  }
  if (!positive(audit.modeled_units) || Math.abs(audit.modeled_units - doc.total_units) > 0.001) {
    issues.push({ field: 'unit_audit.modeled_units', reason: 'must equal total_units' });
  }
  if (!modeled.issues.length && Math.abs(modeled.total - doc.total_units) > 0.001) {
    issues.push({ field: 'requirement_groups', reason: `explicit section units sum to ${modeled.total}, not ${doc.total_units}` });
  }
  issues.push(...declarationIssues('upper_division', audit.upper_division, sourceIds));
  issues.push(...declarationIssues('residency', audit.residency, sourceIds));
  if (String(audit.upper_division?.status || '').toLowerCase() === 'required'
      && nonNegative(audit.upper_division.modeled_units)) {
    const upperGroups = (doc.requirement_groups || []).map((group) => (
      group?.course_level === 'upper_division'
        ? group
        : { ...group, sections: (group?.sections || []).filter((section) => section?.course_level === 'upper_division') }
    )).filter((group) => (group?.sections || []).length);
    const upper = canonicalUnits({ ...doc, requirement_groups: upperGroups }, 'four_year');
    if (!upper.issues.length && Math.abs(upper.total - audit.upper_division.modeled_units) > 0.001) {
      issues.push({
        field: 'unit_audit.upper_division.modeled_units',
        reason: `declares ${audit.upper_division.modeled_units}, but upper-division groups sum to ${upper.total}`,
      });
    }
  }
  return { issues, modeled_units: modeled.total };
}

/**
 * Exact source modeling may legitimately outrun the current evaluators. Keep
 * that richer requirement in the catalog record, but do not call the document
 * analysis-ready until every cross-choice/exclusion rule has an implementation.
 */
function unsupportedConstraintIssues(doc) {
  const issues = [];
  const visit = (value, path = 'doc') => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    if (value.distinct_course_ids_across_sections === true) {
      issues.push({ path: `${path}.distinct_course_ids_across_sections`, reason: 'cross-section distinct-course evaluator is not implemented' });
    }
    if (positive(value.distinct_areas)) {
      issues.push({ path: `${path}.distinct_areas`, reason: 'distinct GE-area evaluator is not implemented' });
    }
    if (text(value.overlap_key)) {
      issues.push({ path: `${path}.overlap_key`, reason: 'cross-requirement overlap evaluator is not implemented' });
    }
    if (Array.isArray(value.analysis_constraints)) {
      value.analysis_constraints.forEach((constraint, index) => {
        if (String(constraint?.status || '').toLowerCase() !== 'supported') {
          issues.push({
            path: `${path}.analysis_constraints[${index}]`,
            reason: constraint?.description || constraint?.kind || 'constraint has no supported evaluator',
            kind: constraint?.kind || null,
          });
        }
      });
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'analysis_constraints') visit(child, `${path}.${key}`);
    }
  };
  visit(doc);
  return issues.filter((issue, index) => issues.findIndex((other) =>
    other.path === issue.path && other.reason === issue.reason) === index);
}

/**
 * Validate a normalized Virginia degree document without mutating it.
 *
 * `catalog.ok` means a researcher has a complete, official, source-walkable
 * record. `analysis_ready.ok` additionally means choices, identities, and unit
 * arithmetic are deterministic. Analysis readiness is always blocked when the
 * catalog verdict fails, even if its own checks happen to pass.
 */
function validateDegreeAcceptance(doc, options = {}) {
  const value = doc && typeof doc === 'object' ? doc : {};
  const level = normalizedLevel(options.institutionLevel ?? options.level ?? options.institution?.level);
  const official = typeof options.isOfficialSource === 'function'
    ? options.isOfficialSource : defaultOfficialSource;
  const catalogChecks = makeChecks();
  const analysisChecks = makeChecks();

  const registry = sourceRegistry(value, official);
  const byId = new Map(registry.sources.map((source) => [source?.id, source]));
  const sourceUrls = new Set(registry.sources.map((source) => source?.url).filter(Boolean));

  const identity = identityIssues(value, level);
  catalogChecks.add('identity', identity.length === 0,
    identity.length ? 'degree identity does not match institution level' : 'degree identity matches institution level',
    identity.length ? { issues: identity } : {});

  const metadata = catalogMetadataIssues(value, level, sourceUrls);
  catalogChecks.add('catalog_metadata', metadata.length === 0,
    metadata.length ? 'catalog metadata is incomplete' : 'catalog year, title, total, and primary source are explicit',
    metadata.length ? { issues: metadata } : {});

  const sourceIssues = [
    ...(registry.sources.length ? [] : ['sources registry is empty']),
    ...registry.duplicates.map((id) => `duplicate source id: ${id}`),
    ...registry.malformed.map((path) => `${path} needs id, kind, label, and HTTPS url`),
    ...registry.unofficial.map((path) => `${path} is not an official source`),
  ];
  catalogChecks.add('official_sources', sourceIssues.length === 0,
    sourceIssues.length ? 'official source registry is invalid' : `${registry.sources.length} official source(s)`,
    sourceIssues.length ? { issues: sourceIssues } : {});

  const refs = [...requiredTreeRefs(value, registry.ids), ...walkSourceRefs(value, registry.ids)];
  const uniqueRefs = refs.filter((issue, index) => refs.findIndex((other) =>
    other.path === issue.path && other.reason === issue.reason) === index);
  catalogChecks.add('source_references', uniqueRefs.length === 0,
    uniqueRefs.length ? 'source_refs are missing or unresolved' : 'all required source_refs resolve',
    uniqueRefs.length ? { issues: uniqueRefs } : {});

  const contamination = contaminationHits(value);
  catalogChecks.add('catalog_scope', contamination.length === 0,
    contamination.length ? 'sample-plan, accelerated, or honors material contaminated the degree tree' : 'degree tree is isolated from schedule/accelerated variants',
    contamination.length ? { issues: contamination } : {});

  if (level === 'four_year') {
    const layers = fourYearLayerIssues(value, registry.ids, byId);
    catalogChecks.add('four_year_layers', layers.length === 0,
      layers.length ? 'major, GE/college, and university graduation layers are incomplete' : 'all three four-year layers are source-backed',
      layers.length ? { issues: layers } : {});
  } else if (level === 'community_college') {
    catalogChecks.add('associate_degree_record', identity.length === 0 && text(value.source),
      identity.length ? 'associate-degree identity/source is incomplete' : 'associate-degree identity and source are explicit');
  }

  const tree = sectionShapeIssues(value, level);
  catalogChecks.add('requirement_structure', tree.length === 0,
    tree.length ? 'requirement groups/sections are not structurally complete' : 'requirement tree is structurally complete',
    tree.length ? { issues: tree } : {});
  analysisChecks.add('requirement_structure', tree.length === 0,
    tree.length ? 'requirement groups/sections are not explicit' : 'requirement groups and section asks are explicit',
    tree.length ? { issues: tree } : {});

  const receiver = receiverIssues(value, level, options.resolveCourse);
  catalogChecks.add('receiver_structure', receiver.semantics.length === 0,
    receiver.semantics.length ? 'receiver shapes do not encode exact AND/OR semantics' : 'receiver shapes are structurally canonical',
    receiver.semantics.length ? { issues: receiver.semantics } : {});
  catalogChecks.add('unresolved_courses', receiver.unresolved.length === 0,
    receiver.unresolved.length ? 'catalog record still contains unresolved course references' : 'catalog record has no explicit unresolved course references',
    receiver.unresolved.length ? { issues: receiver.unresolved } : {});
  analysisChecks.add('choice_semantics', receiver.semantics.length === 0,
    receiver.semantics.length ? 'AND/OR receiver semantics are ambiguous or invalid' : 'AND/OR receiver semantics are canonical',
    receiver.semantics.length ? { issues: receiver.semantics } : {});
  analysisChecks.add('unresolved_courses', receiver.unresolved.length === 0,
    receiver.unresolved.length ? 'unresolved course references remain' : 'no unresolved course references remain',
    receiver.unresolved.length ? { issues: receiver.unresolved } : {});
  analysisChecks.add('course_resolution', receiver.referenced === 0 || receiver.resolution.length === 0,
    receiver.resolution.length ? 'one or more course identities do not resolve' : `${receiver.referenced} referenced course identit${receiver.referenced === 1 ? 'y resolves' : 'ies resolve'}`,
    receiver.resolution.length ? { issues: receiver.resolution } : {});

  const audit = unitAuditIssues(value, level, registry.ids);
  analysisChecks.add('unit_closure', audit.issues.length === 0,
    audit.issues.length ? 'unit budget or upper-division/residency declarations are incomplete' : `modeled units close at ${audit.modeled_units}`,
    audit.issues.length ? { issues: audit.issues, modeled_units: audit.modeled_units } : { modeled_units: audit.modeled_units });

  const unsupportedConstraints = unsupportedConstraintIssues(value);
  analysisChecks.add('constraint_support', unsupportedConstraints.length === 0,
    unsupportedConstraints.length
      ? 'one or more exact catalog constraints do not yet have an analysis evaluator'
      : 'all modeled constraints have evaluator support',
    unsupportedConstraints.length ? { issues: unsupportedConstraints } : {});

  const catalog = finish(catalogChecks.checks);
  analysisChecks.checks.unshift({
    name: 'catalog_acceptance',
    severity: catalog.ok ? 'pass' : 'fail',
    detail: catalog.ok
      ? 'catalog/structural gate passed'
      : 'analysis is blocked by the catalog/structural verdict',
  });
  const analysisReady = finish(analysisChecks.checks);
  return {
    level,
    accepted: catalog.ok,
    ready_for_analysis: analysisReady.ok,
    catalog,
    catalog_structural: catalog,
    analysis_ready: analysisReady,
  };
}

module.exports = {
  validateDegreeAcceptance,
  defaultOfficialSource,
  normalizedLevel,
};
