#!/usr/bin/env node
/**
 * Load extracted Virginia CS requirements into `va_requirements`.
 *
 * Reads the trees written by `extractVirginiaRequirements.js` and emits
 * documents in the canonical California shape — `as_degree` for community
 * colleges, `degree` for four-year institutions — so the existing API and the
 * shared `RequirementsLedger` render Virginia exactly as they render
 * California. No consumer changes; the documents simply stopped being flat.
 *
 * ## What replaced the old mapping
 *
 * The previous version of this script had a function whose entire job was to
 * put every course code the scraper found into one group called
 * "Requirements". That was not a shortcut — it was the only thing the input
 * supported, because the collector discarded headings. With a real tree
 * arriving, each catalog heading becomes a requirement group, each printed
 * "choose two of the following" becomes advisement, and each unenumerated line
 * ("HIS Elective") remains visible and explicitly unresolved instead of
 * vanishing or being treated as a course option.
 *
 * ## The two receiver models, and why they differ
 *
 * The ledger resolves the two sides of a row through different lookups, so a
 * document has to pick the side that matches what it is describing:
 *
 *   Community college  The requirement *is* the VCCS course. `receiving` is
 *                      null and the course sits in `options`, which is the
 *                      shape `RequirementsLedger` renders as a single
 *                      no-arrow row — the same branch California's local
 *                      A.S. degrees use.
 *   Four-year          The requirement is the university's own course, which
 *                      no community college has taken. It goes on the
 *                      receiving side with `code_seen`, and its title comes
 *                      from `course_titles` harvested off the same page.
 *
 * ## Refusing bad data
 *
 * A tree whose validation verdict is `fail` is not imported. The point of
 * validating was to be able to act on it: an unverifiable parse that lands in
 * the console anyway is indistinguishable from a good one, which is the
 * situation this rewrite exists to end. Those institutions keep their previous
 * document until a hand read replaces the tree.
 *
 * Usage:
 *   node scripts/importVirginiaCatalogDegrees.js --dry-run
 *   node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --dry-run --uri <uri> --db pmt_research
 *   node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --apply --uri <uri> --db pmt_research
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { diffDocs } = require('../services/docDiff');
const {
  courseIdFor,
  courseIdentityForNamespace,
  parseCourseKey,
} = require('../services/virginia/courseIdentity');
const { compileDegreeComposition } = require('../services/virginia/degreeComposition');
const { validateDegreeAcceptance } = require('../services/virginia/degreeAcceptance');
const { institutionCourseCatalog } = require('../services/virginia/institutionCourseCatalog');
const {
  majorCoreHash,
  verifiedCoreConflict,
} = require('../services/virginia/majorCoreIntegrity');

const CAT = path.join(__dirname, '..', '.va-catalogs');
const REQS = path.join(CAT, 'requirements');
const COMPOSED = path.join(CAT, 'composed');

const HELP_TEXT = `Usage:
  node scripts/importVirginiaCatalogDegrees.js --dry-run
  node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --dry-run --uri <uri> --db <name>
  node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --apply --uri <uri> --db <name>

Options:
  --only <slug,...>                 Limit the evaluated registry records
  --allow-failed                    Include failed machine extractions
  --accepted-compositions-only      Publish only catalog-accepted compositions
  --source-plan                     Read-only cache evaluation; ignore persisted requirement/verification state
  --dry-run                         Evaluate without writing MongoDB (the default)
  --apply                           Apply the exact evaluated plan atomically
  --allow-unaccepted-write          With --apply, explicitly allow the legacy research rebuild
  --allow-verified-reopen           After review, allow --apply to reopen changed-source verification
  --allow-verified-supersede        After review, allow --apply to reopen a verified retired record
  --help                            Show this help without connecting to MongoDB`;
const log = (...a) => console.log('[va:import]', ...a);

const CLI_VALUE_OPTIONS = new Set(['--uri', '--db', '--only']);
const CLI_BOOLEAN_OPTIONS = new Set([
  '--dry-run', '--apply', '--allow-failed', '--accepted-compositions-only',
  '--source-plan', '--allow-unaccepted-write', '--allow-verified-reopen',
  '--allow-verified-supersede', '--help',
]);

/**
 * Parse fail-closed: a misspelled publication flag must never degrade into an
 * ungated write. Importing this module from tests does not parse the test
 * runner's argv; only the executable entry point does.
 */
function parseCliArgs(args = [], env = {}) {
  const values = new Map();
  const booleans = new Set();
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (CLI_VALUE_OPTIONS.has(token)) {
      if (values.has(token)) throw new Error(`${token} may be supplied only once`);
      const value = args[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${token} requires a value`);
      values.set(token, value);
      i += 1;
      continue;
    }
    if (CLI_BOOLEAN_OPTIONS.has(token)) {
      if (booleans.has(token)) throw new Error(`${token} may be supplied only once`);
      booleans.add(token);
      continue;
    }
    throw new Error(`unknown option: ${token}`);
  }

  const apply = booleans.has('--apply');
  const explicitDryRun = booleans.has('--dry-run');
  const acceptedCompositionsOnly = booleans.has('--accepted-compositions-only');
  const sourcePlan = booleans.has('--source-plan');
  const allowUnacceptedWrite = booleans.has('--allow-unaccepted-write');
  const allowVerifiedReopen = booleans.has('--allow-verified-reopen');
  const allowVerifiedSupersede = booleans.has('--allow-verified-supersede');
  const help = booleans.has('--help');
  const uri = values.get('--uri') || env.MONGO_URI || null;
  const dbName = values.get('--db') || env.DB_NAME || null;

  if (!help && apply && explicitDryRun) throw new Error('--apply and --dry-run are mutually exclusive');
  if (!help && sourcePlan && apply) throw new Error('--source-plan is read-only and cannot be combined with --apply');
  if (!help && sourcePlan && !acceptedCompositionsOnly) {
    throw new Error('--source-plan requires --accepted-compositions-only');
  }
  if (!help && apply && !acceptedCompositionsOnly && !allowUnacceptedWrite) {
    throw new Error('--apply requires --accepted-compositions-only (or the explicit --allow-unaccepted-write research override)');
  }
  if (!help && apply && !uri) throw new Error('--apply requires --uri or MONGO_URI');
  if (!help && apply && !dbName) throw new Error('--apply requires --db or DB_NAME');
  if (!help && allowUnacceptedWrite && !apply) {
    throw new Error('--allow-unaccepted-write is valid only with --apply');
  }
  if (!help && allowVerifiedSupersede && !apply) {
    throw new Error('--allow-verified-supersede is valid only with --apply');
  }
  if (!help && allowVerifiedReopen && !apply) {
    throw new Error('--allow-verified-reopen is valid only with --apply');
  }
  const only = (values.get('--only') || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (values.has('--only') && !only.length) throw new Error('--only requires at least one complete institution slug');

  return {
    uri,
    dbName,
    apply,
    dryRun: !apply,
    allowFailed: booleans.has('--allow-failed'),
    acceptedCompositionsOnly,
    sourcePlan,
    allowUnacceptedWrite,
    allowVerifiedReopen,
    allowVerifiedSupersede,
    help,
    only,
  };
}

const opts = require.main === module
  ? parseCliArgs(process.argv.slice(2), process.env)
  : parseCliArgs([], {});

const isCC = (level) => level === 'community_college';

function selectedInstitutions(institutions, only = []) {
  if (!only.length) return institutions;
  if (new Set(only).size !== only.length) throw new Error('--only contains duplicate slugs');
  const available = new Set((institutions || []).map((institution) => institution.slug));
  const unknown = only.filter((slug) => !available.has(slug));
  if (unknown.length) throw new Error(`--only contains unknown institution slug(s): ${unknown.join(', ')}`);
  const selected = new Set(only);
  return institutions.filter((institution) => selected.has(institution.slug));
}

const courseNumber = (code) => Number((/\d{3,4}/.exec(String(code || '')) || [])[0] || 0);

function requirementLayer(title, cc) {
  if (cc) return 'associate_degree';
  if (/mason core|general education|breadth|core curriculum|pathways/i.test(title || '')) return 'general_education';
  if (/elective/i.test(title || '')) return 'electives';
  return 'major';
}

function rowAcademicMetadata(row, { cc, layer }) {
  if (!(row.codes || []).length) {
    return {
      tier: cc ? 'transferable' : 'nontransferable',
      course_level: cc ? 'unenumerated_requirement' : 'university_requirement',
      cc_articulable: false,
    };
  }
  if (cc) return { tier: 'transferable', course_level: 'lower_division', cc_articulable: true };
  if (layer === 'general_education') return { tier: 'breadth', course_level: 'lower_division_or_category', cc_articulable: true };
  const numbers = (row.codes || []).map((course) => courseNumber(course.code)).filter(Boolean);
  if (!numbers.length) return { tier: layer === 'electives' ? 'breadth' : 'nontransferable', course_level: null, cc_articulable: null };
  const upper = numbers.every((number) => number >= 300);
  const lower = numbers.every((number) => number < 300);
  return {
    tier: upper ? 'nontransferable' : layer === 'electives' ? 'breadth' : 'transferable',
    course_level: upper ? 'upper_division' : lower ? 'lower_division' : 'mixed',
    cc_articulable: upper ? false : lower ? true : null,
  };
}

function sourceRefsForLayer(layer, available) {
  const refs = ['major'];
  if (layer === 'general_education' && available.has('general_education')) refs.push('general_education');
  if (layer === 'electives' && available.has('graduation')) refs.push('graduation');
  return refs.filter((ref) => available.has(ref));
}

function sourceBundleHash(extract, composition = null) {
  const parts = (extract.sources || []).map((source) => `${source.id}:${source.sha256 || source.url}`).sort();
  if (!parts.length && extract.source_url) parts.push(`major:${extract.source_url}`);
  if (composition) {
    const compositionHash = createHash('sha256').update(JSON.stringify(composition)).digest('hex');
    parts.push(`composition:${compositionHash}`);
  }
  return createHash('sha256').update(`${extract.catalog_year || ''}\n${parts.join('\n')}`).digest('hex');
}

function acceptanceResolver(doc, creditsByCode) {
  const namespace = doc.course_namespace || null;
  const identityFor = (code) => courseIdentityForNamespace(code, namespace);
  const codeById = new Map((doc.codes_seen || []).map((code) => {
    const identity = identityFor(code);
    return [identity?.course_id, identity?.code];
  }).filter(([id]) => id != null));
  return ({ side, id, key }) => {
    const parsedKey = key == null ? null : parseCourseKey(key);
    const code = parsedKey?.code || codeById.get(Number(id));
    if (!code) return false;
    // `va_courses` began as the Transfer Virginia sending-course corpus and is
    // not a complete VCCS catalog. A course named and titled by this college's
    // own reviewed degree composition is direct official catalog evidence even
    // when Transfer Virginia has no equivalency row for it (NOVA MTH 283 is a
    // real example). The API already returns these document-local identities
    // with `identity_source: degree_document`; do not reject that stronger
    // evidence merely because the corroborating statewide table is sparse.
    if (side === 'community_college'
        && !creditsByCode.has(code)
        && !(doc.course_titles && doc.course_titles[code])) return false;
    if (side !== 'community_college') return { parent_id: Number(id) };
    const expected = identityFor(code);
    // Namespace metadata is not enough: reject a legacy `va:CODE` reference
    // in an institution-local document even when its readable code is valid.
    // This is the check that prevents RBC MATH251 resolving to JMU's unrelated
    // same-code course through the old numeric hash.
    if (!expected || Number(id) !== expected.course_id || key !== expected.course_key) return false;
    return expected;
  };
}

// ── tree -> canonical requirement groups ────────────────────────────────────

/**
 * What a row costs in credits.
 *
 * Printed hours first; otherwise the registry. An `or` row costs one course, so
 * the alternatives are compared rather than summed; an `and` row costs all of
 * them. Used only to tell a required set from a menu — see `groupAdvisement`.
 */
function rowCredits(row, creditsByCode = new Map(), { allowRegistry = true } = {}) {
  if (Number.isFinite(row?.credits?.min)) return row.credits.min;
  if (!allowRegistry) return null;
  const each = (row.codes || []).map((c) => creditsByCode.get(c.code) ?? null).filter((n) => n != null);
  if (!each.length) return null;
  return row.conjunction === 'or' ? Math.max(...each) : each.reduce((a, b) => a + b, 0);
}

/**
 * Group-level advisement: how many of this group's rows a student must take.
 *
 * Explicit instructions win. Where the catalog printed none, the arithmetic
 * decides: a group stating 3 credits against eleven 3-credit options is a menu,
 * and rendering it as "complete all eleven" would be a plain misreading of the
 * page. A group whose rows already add up to its stated figure is a required
 * set and gets no advisement, so it reads "Complete all of:".
 */
function groupAdvisement(group, creditsByCode = new Map(), { allowRegistry = true } = {}) {
  const rows = (group.sections || []).flatMap((s) => s.rows || []);
  const out = {
    group_advisement: null,
    group_unit_advisement: null,
    group_min_distinct_sections: null,
    group_section_min_courses: null,
    advisement_basis: null,
  };

  if (group.choose != null) {
    out.group_advisement = group.choose;
    out.advisement_basis = 'stated_course_count';
    if (group.distinct_sections != null && group.distinct_sections > 0) {
      out.group_min_distinct_sections = group.distinct_sections;
      out.group_section_min_courses = Math.max(1, Math.floor(group.choose / group.distinct_sections));
    }
    return out;
  }
  if (group.choose_credits) {
    out.group_unit_advisement = group.choose_credits.min;
    out.advisement_basis = 'stated_credit_ask';
    return out;
  }
  if (!group.credits || rows.length < 2) return out;

  const costs = rows.map((r) => rowCredits(r, creditsByCode, { allowRegistry }));
  if (costs.some((c) => c == null)) return out;
  const takeAll = costs.reduce((a, b) => a + b, 0);
  if (takeAll > group.credits.max + 0.5) {
    out.group_unit_advisement = group.credits.min;
    out.advisement_basis = 'inferred_menu';
  }
  return out;
}

/** One parsed row into one or more canonical receivers. */
function receiversForRow(row, { cc, layer }) {
  const academic = rowAcademicMetadata(row, { cc, layer });
  const base = ({
    articulationStatus = null,
    notArticulatedReason = null,
    options = [],
  } = {}) => ({
    articulation_status: articulationStatus,
    not_articulated_reason: notArticulatedReason,
    options,
    options_conjunction: 'or',
    hash_id: null,
    ...academic,
  });

  // A catalog requirement without a course list is real but cannot be treated
  // as a made-up course option. On the university side it is the canonical
  // university-only `requirement` receiver. On the CC side `receiving` remains
  // null and the unresolved marker intentionally blocks analysis until a human
  // enumerates the local choices.
  if (!(row.codes || []).length) {
    const name = row.category || row.text || 'Unenumerated catalog requirement';
    if (cc) {
      return [{
        ...base({
          articulationStatus: 'not_articulated',
          notArticulatedReason: 'no_course_list_published',
        }),
        receiving: null,
        code_seen: null,
        unresolved: true,
        human_review: `course choices are not enumerated for: ${name}`,
      }];
    }
    return [{
      ...base(),
      receiving: {
        kind: 'requirement',
        parent_id: null,
        name,
        units: Number.isFinite(row?.credits?.min) ? row.credits.min : null,
      },
      code_seen: null,
      human_review: 'requirement stated without an enumerated course list',
    }];
  }

  if (cc) {
    // The VCCS course is the requirement. `receiving: null` + options is the
    // branch the ledger renders as a single row with no receiving column.
    const options = row.conjunction === 'and'
      ? [{
        course_ids: row.codes.map((c) => courseIdFor(c.code)),
        course_conjunction: 'and',
        course_keys: row.codes.map((c) => `va:${c.code}`),
      }]
      : row.codes.map((c) => ({
        course_ids: [courseIdFor(c.code)],
        course_conjunction: 'and',
        course_keys: [`va:${c.code}`],
      }));
    return [{
      ...base({ articulationStatus: 'articulated', options }),
      receiving: null,
      code_seen: row.codes.map((c) => c.code).join(row.conjunction === 'and' ? ' + ' : ' / '),
    }];
  }

  // Four-year OR alternatives are independent receivers in a choose-one
  // section. A `series` means every parent is required in shared evaluation,
  // so storing an OR inside a series makes the solver require both courses.
  if (row.codes.length > 1 && row.conjunction === 'or') {
    return row.codes.map((course) => ({
      ...base(),
      receiving: { kind: 'course', parent_id: courseIdFor(course.code), units: row.credits ? row.credits.min : null },
      code_seen: course.code,
    }));
  }

  // A multi-code AND is one complete route. Keeping only codes[0] silently
  // erased lecture/lab pairs and full sequences from the prior importer.
  if (row.codes.length > 1) {
    return [{
      ...base(),
      receiving: {
        kind: 'series',
        conjunction: 'and',
        parent_ids: row.codes.map((course) => courseIdFor(course.code)),
        units: row.credits ? row.credits.min : null,
      },
      code_seen: row.codes.map((course) => course.code).join(' + '),
    }];
  }

  return [{
    ...base(),
    receiving: { kind: 'course', parent_id: courseIdFor(row.codes[0].code), units: row.credits ? row.credits.min : null },
    code_seen: row.codes[0].code,
  }];
}

function sectionMetadata(rows, { cc, layer }) {
  const values = rows.map((row) => rowAcademicMetadata(row, { cc, layer }));
  const one = (key) => values.length && values.every((value) => value[key] === values[0][key]) ? values[0][key] : null;
  return { tier: one('tier') || (layer === 'general_education' ? 'breadth' : 'transferable'), course_level: one('course_level'), cc_articulable: one('cc_articulable') };
}

function sectionUnitAdvisement(group, parsed, rows, {
  cc, creditsByCode, allowGroupCredits = false,
}) {
  if (Number.isFinite(parsed?.credits?.min)) return parsed.credits.min;
  if (allowGroupCredits && Number.isFinite(group?.credits?.min)) return group.credits.min;
  if (!rows.length) return null;

  // VCCS's common catalog is valid fallback evidence for its own A.S. courses.
  // A university course with the same printed code is a different course: its
  // credits must come from this university page, never `va_courses`.
  const costs = rows.map((row) => rowCredits(row, creditsByCode, { allowRegistry: cc }));
  if (costs.some((cost) => cost == null)) return null;
  if (parsed?.choose != null) {
    const count = Number(parsed.choose);
    if (!Number.isInteger(count) || count <= 0 || count > costs.length) return null;
    return [...costs].sort((a, b) => a - b).slice(0, count).reduce((sum, cost) => sum + cost, 0);
  }
  return costs.reduce((sum, cost) => sum + cost, 0);
}

function canonicalSections(group, {
  cc, layer, sourceRefs, creditsByCode = new Map(),
}) {
  const out = [];
  const make = (rows, parsed = {}, { allowGroupCredits = false } = {}) => {
    let modeledRows = rows;
    const receivers = modeledRows.flatMap((row) => receiversForRow(row, { cc, layer }));
    // A credit-only category (`8 elective credits`) is still a requirement,
    // even though the catalog intentionally supplies no closed course menu.
    if (!receivers.length && parsed.credits) {
      const fallback = {
        codes: [], category: group.title, text: group.note || group.title, credits: parsed.credits,
      };
      modeledRows = [fallback];
      receivers.push(...receiversForRow(fallback, { cc, layer }));
    }
    const explicitCount = parsed.choose ?? null;
    return {
      section_advisement: explicitCount != null
        ? explicitCount
        : parsed.credits ? null : Math.max(1, receivers.length),
      unit_advisement: sectionUnitAdvisement(group, parsed, modeledRows, {
        cc, creditsByCode, allowGroupCredits,
      }),
      label_seen: parsed.label || null,
      ...sectionMetadata(modeledRows, { cc, layer }),
      source_refs: sourceRefs,
      note: null,
      overlap_key: null,
      human_review: null,
      receivers,
    };
  };

  const parsedSections = group.sections || [];
  for (const parsed of parsedSections) {
    const rows = parsed.rows || [];
    if (parsed.choose != null || parsed.credits) {
      out.push(make(rows, parsed, { allowGroupCredits: parsedSections.length === 1 }));
      continue;
    }

    // Without a printed menu instruction, each row is its own required slot.
    // This preserves inline OR as choose-one and multi-code AND as one series,
    // instead of relying on conflicting consumer interpretations of null.
    for (const row of rows) {
      if (row.alternative_to_previous && out.length) {
        const previous = out[out.length - 1];
        previous.receivers.push(...receiversForRow(row, { cc, layer }));
        previous.section_advisement = 1;
        previous.human_review = previous.human_review
          ? `${previous.human_review}; alternative row joined from catalog markup`
          : 'alternative row joined from catalog markup';
      } else {
        out.push(make([row], {}, {
          allowGroupCredits: parsedSections.length === 1 && rows.length === 1,
        }));
      }
    }
  }
  return out;
}

/** The whole tree into `requirement_groups`. */
function requirementGroups(tree, {
  cc, creditsByCode = new Map(), availableSourceIds = new Set(['major']),
}) {
  return (tree.groups || []).map((group) => {
    const advisement = groupAdvisement(group, creditsByCode, { allowRegistry: cc });
    const layer = requirementLayer(group.title, cc);
    const sourceRefs = sourceRefsForLayer(layer, availableSourceIds);
    const sections = canonicalSections(group, {
      cc, layer, sourceRefs, creditsByCode,
    });
    const tiers = new Set(sections.map((section) => section.tier).filter(Boolean));
    const levels = new Set(sections.map((section) => section.course_level).filter(Boolean));
    return {
      is_required: true,
      group_conjunction: 'And',
      title: group.title,
      requirement_layer: layer,
      tier: layer === 'general_education' ? 'breadth' : tiers.size === 1 ? [...tiers][0] : 'transferable',
      source_refs: sourceRefs,
      note: group.note || null,
      course_level: levels.size === 1 ? [...levels][0] : levels.size > 1 ? 'mixed' : null,
      cc_articulable: sections.length && sections.every((section) => section.cc_articulable === true)
        ? true : sections.some((section) => section.cc_articulable === false) ? false : null,
      overlap_key: null,
      human_review: null,
      // The credit figure the catalog printed for this heading, kept whether or
      // not it became advisement, so a verifier can check our arithmetic
      // against the page without re-reading it.
      stated_credits: group.credits ? group.credits.raw : null,
      ...advisement,
      // Verbatim lines this group was read from — the audit trail that makes a
      // disagreement checkable in one glance.
      source_text: (group.source_text || []).slice(0, 40),
      sections,
    };
  });
}

/** `{ CODE: title }` for every course the tree names, from the catalog page. */
function courseTitles(tree) {
  const out = {};
  for (const g of tree.groups || []) {
    for (const s of g.sections || []) {
      for (const r of s.rows || []) {
        for (const c of r.codes || []) if (c.title && !out[c.code]) out[c.code] = c.title;
      }
    }
  }
  return out;
}

const allCodes = (tree) => [...new Set((tree.groups || [])
  .flatMap((g) => (g.sections || []).flatMap((s) => (s.rows || []).flatMap((r) => (r.codes || []).map((c) => c.code)))))];

/**
 * Exact per-course credit facts retained by the source extractor.
 *
 * Compiling a catalog may legitimately turn two printed course rows into one
 * AND bundle. The bundle's seven-credit total cannot be divided safely, but
 * the original rows (for example CSCI 222 = 4 and MATH 254 = 3) remain direct
 * official evidence. Preserve only single-code, single-valued observations;
 * conflicting or range-valued rows remain absent and therefore fail closed.
 */
function sourceCourseUnitEvidence(extract, composition, {
  namespace = null,
  availableSourceIds = new Set(),
  requiredCodes = null,
} = {}) {
  const observations = new Map();
  const add = (entry, explicit = false) => {
    const code = String(entry?.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const min = Number(entry?.min_units ?? entry?.units);
    const max = Number(entry?.max_units ?? entry?.units);
    if (!code || (requiredCodes && !requiredCodes.has(code))
        || !Number.isFinite(min) || !Number.isFinite(max)
        || min <= 0 || max !== min) return;
    const refs = Array.isArray(entry?.source_refs) ? entry.source_refs : [];
    if (refs.some((ref) => !availableSourceIds.has(ref))) {
      throw new Error(`course-unit evidence for ${code} cites an unknown source`);
    }
    if (!observations.has(code)) observations.set(code, []);
    observations.get(code).push({
      code,
      units: min,
      source_refs: refs,
      source_path: entry?.source_path || null,
      evidence: entry?.evidence || (explicit
        ? 'reviewed_composition_course_row'
        : 'extracted_single_course_credit_row'),
      unit_source: entry?.official_url ? {
        official_url: entry.official_url,
        source_sha256: entry.source_sha256 || null,
        source_excerpt: entry.source_excerpt || null,
        source_excerpt_sha256: entry.source_excerpt_sha256 || null,
        source_path: entry.source_path || null,
      } : null,
      explicit,
    });
  };

  for (const [gi, group] of (extract?.groups || []).entries()) {
    for (const [si, section] of (group?.sections || []).entries()) {
      for (const [ri, row] of (section?.rows || []).entries()) {
        if ((row?.codes || []).length !== 1) continue;
        const credits = row?.credits;
        if (!credits || Number(credits.min) !== Number(credits.max)) continue;
        const code = String(row.codes[0]?.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const match = /^([A-Z]{2,5})(\d{3,4}[A-Z]?)$/.exec(code);
        const sourceText = String(row?.text || '');
        const printedCode = match && new RegExp(
          `(?:^|[^A-Z0-9])${match[1]}\\s*[-–—]?\\s*${match[2]}(?![A-Z0-9])`, 'i',
        ).test(sourceText);
        // Parsed rows are evidence only when the captured row still proves
        // the exact identity and has a plausible single-course value. This
        // rejects known parser artifacts such as HIS 121 "...to 1877", SDV
        // 100 "or SDV 101", ITE 152 truncated to TE152, and footnote 2.
        if (!printedCode || Number(credits.max) > 8 || /\bor\b/i.test(sourceText)) continue;
        add({
          code,
          units: credits.min,
          source_refs: availableSourceIds.has('major') ? ['major'] : [],
          source_path: `groups[${gi}].sections[${si}].rows[${ri}]`,
        });
      }
    }
  }
  const reviewedEntries = [...(composition?.course_unit_evidence || [])];
  const artifact = composition?.course_unit_evidence_artifact;
  if (artifact) {
    const relativePath = String(artifact.path || '');
    const expectedHash = String(artifact.sha256 || '');
    if (!/^research\/[A-Za-z0-9._/-]+\.json$/.test(relativePath)
        || !/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new Error('course_unit_evidence_artifact requires a safe research JSON path and sha256');
    }
    const absolutePath = path.resolve(CAT, relativePath);
    if (!absolutePath.startsWith(`${path.resolve(CAT, 'research')}${path.sep}`)) {
      throw new Error('course_unit_evidence_artifact escapes the research directory');
    }
    const bytes = fs.readFileSync(absolutePath);
    const actualHash = createHash('sha256').update(bytes).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`course_unit_evidence_artifact hash mismatch for ${relativePath}`);
    }
    const parsed = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(parsed.entries)) {
      throw new Error(`course_unit_evidence_artifact has no entries: ${relativePath}`);
    }
    const selectedCodes = artifact.codes == null
      ? null
      : new Set((Array.isArray(artifact.codes) ? artifact.codes : []).map((code) => (
        String(code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      )));
    if (artifact.codes != null && (!Array.isArray(artifact.codes)
        || selectedCodes.size !== artifact.codes.length
        || [...selectedCodes].some((code) => !/^[A-Z]{2,5}\d{3,4}[A-Z]?$/.test(code)))) {
      throw new Error('course_unit_evidence_artifact.codes must contain unique canonical course codes');
    }
    const availableArtifactCodes = new Set(parsed.entries.map((entry) => (
      String(entry?.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
    )));
    const missingSelectedCodes = selectedCodes == null ? []
      : [...selectedCodes].filter((code) => !availableArtifactCodes.has(code));
    if (missingSelectedCodes.length) {
      throw new Error(
        `course_unit_evidence_artifact selects missing code(s): ${missingSelectedCodes.join(', ')}`,
      );
    }
    for (const entry of parsed.entries) {
      const artifactCode = String(entry?.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (selectedCodes && !selectedCodes.has(artifactCode)) continue;
      const excerpt = String(entry?.source_excerpt || '');
      const excerptHash = createHash('sha256').update(excerpt).digest('hex');
      const exactExcerpt = excerptHash === entry?.source_excerpt_sha256
        && /^https:\/\//.test(entry?.official_url || '')
        && /^[a-f0-9]{64}$/.test(entry?.source_sha256 || '')
        && new RegExp(`\\b${String(entry?.code || '').replace(/(\D+)(\d.*)/, '$1\\s*$2')}\\b`, 'i')
          .test(excerpt)
        && new RegExp(`\\bCredits:\\s*${Number(entry?.units)}\\b`, 'i').test(excerpt);
      if (!exactExcerpt) {
        throw new Error(`invalid supplemental course-unit evidence for ${entry?.code || '<missing>'}`);
      }
      reviewedEntries.push({
        ...entry,
        source_refs: artifact.source_refs || [],
        source_path: `${relativePath}#${entry.code}`,
        evidence: 'captured_official_course_detail',
      });
    }
  }
  for (const entry of reviewedEntries) add(entry, true);

  const evidence = [];
  for (const [code, rows] of observations) {
    const explicit = rows.filter((row) => row.explicit);
    const candidates = explicit.length ? explicit : rows;
    const units = [...new Set(candidates.map((row) => row.units))];
    if (units.length !== 1) continue;
    const identity = courseIdentityForNamespace(code, namespace);
    if (!identity) continue;
    evidence.push({
      ...identity,
      units: units[0],
      min_units: units[0],
      max_units: units[0],
      source_refs: [...new Set(candidates.flatMap((row) => row.source_refs))].sort(),
      source_paths: candidates.map((row) => row.source_path).filter(Boolean),
      evidence: candidates[0].evidence,
      unit_sources: candidates.map((row) => row.unit_source).filter(Boolean),
    });
  }
  return evidence.sort((a, b) => a.code.localeCompare(b.code));
}

// ── documents ───────────────────────────────────────────────────────────────

function validatedCourseNamespace(composition, inst, availableSourceIds) {
  const namespace = composition?.course_namespace;
  if (namespace == null) return null;
  const owner = `va:cc:${inst.slug}`;
  const sourceRefs = Array.isArray(namespace.source_refs) ? namespace.source_refs : [];
  const missingSources = sourceRefs.filter((sourceId) => !availableSourceIds.has(sourceId));
  const supported = isCC(inst.level)
    && namespace.kind === 'institution_local'
    && namespace.institution_id === owner
    && namespace.vccs_master_applicable === false
    && namespace.identity_contract === 'owner_plus_course_id'
    && namespace.scoped_key_format === `${owner}:<code>`
    && sourceRefs.length > 0
    && missingSources.length === 0;
  if (!supported) {
    const missing = missingSources.length ? `; unknown source_refs: ${missingSources.join(', ')}` : '';
    throw new Error(`${inst.slug} has an invalid or unsupported course_namespace${missing}`);
  }
  return structuredClone(namespace);
}

function toDocument(extract, inst, creditsByCode, composition = null) {
  const cc = isCC(inst.level);
  const slug = inst.slug;
  // Registry/extraction audits are source research: they may know the
  // published total, GE block, or residency rule before those layers have
  // actually been composed. Keep that evidence, but do not expose it as the
  // canonical `unit_audit` that downstream analysis treats as unit closure.
  const publishedUnitAudit = extract.degree_context?.unit_audit
    ?? inst.degree_context?.unit_audit
    ?? null;
  const context = {
    ...(inst.degree_context || {}),
    ...(extract.degree_context || {}),
    ...(composition || {}),
  };
  const sources = (extract.sources || []).length
    ? extract.sources
    : extract.source_url ? [{ id: 'major', kind: 'major', label: `${inst.name} degree requirements`, url: extract.source_url }] : [];
  const availableSourceIds = new Set(sources.map((source) => source.id));
  if (!availableSourceIds.size && extract.source_url) availableSourceIds.add('major');
  if (composition && composition.slug !== slug) {
    throw new Error(`composition slug ${composition.slug || '<missing>'} does not match ${slug}`);
  }
  if (composition) {
    const missingSources = (composition.source_bundle_required || [])
      .filter((sourceId) => !availableSourceIds.has(sourceId));
    if (missingSources.length) {
      throw new Error(`${slug} composition is missing captured source(s): ${missingSources.join(', ')}`);
    }
  }
  const courseNamespace = validatedCourseNamespace(composition, inst, availableSourceIds);
  const compiled = composition
    ? compileDegreeComposition(composition, {
      institutionLevel: inst.level,
      courseNamespace,
    })
    : null;
  // Some awards publish materially different requirement maps under one award
  // identity (Reynolds' B.A.-destination and B.S.-destination A.S. maps are the
  // first concrete case). The shared ledger still renders the explicitly
  // selected canonical map, but preserve and compile every alternate map on
  // the API object so researchers can inspect it and obtain all of its course
  // identities without reverse-engineering numeric ids.
  const requirementVariants = Array.isArray(composition?.requirement_variants)
    ? composition.requirement_variants.map((variant) => {
      if (!Array.isArray(variant?.requirement_groups) || !variant.requirement_groups.length) {
        return { ...variant };
      }
      const variantCompiled = compileDegreeComposition({
        requirement_groups: variant.requirement_groups,
        course_titles: { ...(composition.course_titles || {}), ...(variant.course_titles || {}) },
      }, {
        institutionLevel: inst.level,
        courseNamespace,
      });
      return {
        ...variant,
        requirement_groups: variantCompiled.requirement_groups,
        codes_seen: variantCompiled.codes_seen,
        course_titles: variantCompiled.course_titles,
      };
    })
    : [];
  const variantCodes = requirementVariants.flatMap((variant) => variant.codes_seen || []);
  const codes = compiled
    ? [...new Set([...compiled.codes_seen, ...variantCodes])].sort()
    : allCodes(extract);
  const groups = compiled
    ? compiled.requirement_groups
    : requirementGroups(extract, { cc, creditsByCode, availableSourceIds });
  const resolvedCourseTitles = {
    ...courseTitles(extract),
    ...(compiled?.course_titles || {}),
    ...Object.assign({}, ...requirementVariants.map((variant) => variant.course_titles || {})),
  };
  const exactCourseUnits = sourceCourseUnitEvidence(extract, composition, {
    namespace: courseNamespace,
    availableSourceIds,
    requiredCodes: new Set(codes),
  });
  const localCourseCatalog = institutionCourseCatalog({
    codes,
    courseTitles: resolvedCourseTitles,
    requirementGroups: groups,
    unitEvidence: exactCourseUnits,
    namespace: courseNamespace,
  });
  const captured = extract.outcome === 'captured' && groups.length > 0;

  const status = captured ? 'extracted'
    : extract.outcome === 'no_cs_program' ? 'no_program'
      : 'url_only';

  const base = {
    kind: cc ? 'as_degree' : 'degree',
    major_slug: 'cs',
    source: 'institution_catalog',
    source_method: composition ? 'official_catalog_composition' : 'scraped_catalog',
    research_status: composition
      ? 'composed_from_official_sources_needs_human_verification'
      : 'machine_collected_needs_human_verification',
    collection_status: captured ? (context.composition_status || 'major_only') : 'captured_only',
    total_units: composition?.total_units ?? (extract.total_credits ? extract.total_credits.min : null),
    // A parser subtotal/range is not a whole-degree maximum. Once a reviewed
    // composition exists, only its explicit whole-degree maximum may populate
    // this field; otherwise keep the parser evidence in published_unit_audit.
    total_units_max: composition
      ? (composition.total_units_max ?? null)
      : (extract.total_credits ? extract.total_credits.max : null),
    requirement_groups: groups,
    requirement_variants: requirementVariants,
    // Source-composed category rules can have exact, cited dictionaries even
    // when the canonical receiver tree cannot express a universal choose-N
    // (for example, a variable-credit transfer-elective pool). Keep those
    // dictionaries on the API document so researchers can inspect options and
    // obtain their course identities without opening a repository artifact.
    option_sets: composition?.option_sets || null,
    catalog_platform: inst.platform || null,
    codes_seen: codes,
    course_titles: resolvedCourseTitles,
    ...(exactCourseUnits.length ? { course_unit_evidence: exactCourseUnits } : {}),
    ...(localCourseCatalog.length ? { institution_course_catalog: localCourseCatalog } : {}),
    offers_cs: extract.offers_cs !== false,
    capture_layers: extract.source_layers || null,
    requirement_layers: composition?.requirement_layers || null,
    ...(courseNamespace ? { course_namespace: courseNamespace } : {}),
    sources,
    published_unit_audit: publishedUnitAudit,
    // How this document was produced and how far it can be trusted, carried on
    // the document itself so the console never has to guess.
    provenance: {
      parser: extract.parser || null,
      hand_read: extract.hand_read === true,
      captured_at: extract.captured_at || null,
      extracted_at: extract.extracted_at || null,
      source_bundle_hash: sourceBundleHash(extract, composition),
      composition_artifact: composition ? `server/.va-catalogs/composed/${slug}.json` : null,
      composition_schema_version: composition?.schema_version ?? null,
      validation: extract.validation ? {
        verdict: extract.validation.verdict,
        checks: extract.validation.checks,
        stats: extract.validation.stats,
      } : null,
    },
    updated_at: new Date(),
  };

  if (cc) {
    return {
      ...base,
      _id: `va:as:${slug}:cs`,
      legacy_id: `${slug}:cs`,
      community_college_id: `va:cc:${slug}`,
      college_id: `va:cc:${slug}`,
      degree_type: context.award || 'AS',
      template_ref: null,
      status,
      degree_title_seen: composition?.program || extract.program_title || 'Computer Science',
      catalog_url: extract.source_url,
      catalog_year: composition?.catalog_year || extract.catalog_year || context.catalog_year || null,
      unit_system: 'semester',
      unit_audit: composition?.unit_audit || null,
      modeling_notes: composition?.modeling_notes || context.modeling_notes || [],
      data_quality_flags: composition?.data_quality_flags || context.data_quality_flags || [],
      covered_concepts: [],
      extraction: {
        artifact: `server/.va-catalogs/requirements/${slug}.json`,
        composition_artifact: composition ? `server/.va-catalogs/composed/${slug}.json` : null,
        confidence: captured ? (extract.validation && extract.validation.verdict === 'pass' ? 0.9 : 0.7) : 0,
        needs_browser: inst.platform === 'acalog',
        notes: extract.hand_read_notes || inst.note || null,
      },
    };
  }

  return {
    ...base,
    _id: `va:degree:${slug}:cs`,
    legacy_id: `${slug}:cs`,
    school: inst.name,
    school_id: `va:uni:${slug}`,
    program: composition?.program || extract.program_title || 'Computer Science, B.S.',
    source_url: extract.source_url,
    status,
    // Every field a California `degree` carries, so a consumer written against
    // the California shape reads these unchanged. Populated where Virginia has
    // an equivalent, explicitly null/[] where it does not — a missing key and a
    // known-empty one are different facts.
    academic_unit: composition?.academic_unit ?? context.academic_unit ?? null,
    campus_key: inst.name,
    catalog_year: composition?.catalog_year || extract.catalog_year || context.catalog_year || null,
    college: composition?.college ?? context.college ?? null,
    data_quality_flags: composition?.data_quality_flags || context.data_quality_flags || (captured ? [] : [{ code: 'no_course_list_published', severity: 'block' }]),
    degree_variant: composition?.award || context.award || null,
    ge_authority: composition?.ge_authority ?? context.general_education_authority ?? null,
    ge_model: composition?.ge_authority ?? context.general_education_authority ?? null,
    ge_variants: [],
    institution_id: `va:uni:${slug}`,
    modeling_notes: [...(composition?.modeling_notes || context.modeling_notes || []), ...(inst.note ? [inst.note] : [])],
    unit_audit: composition?.unit_audit || null,
    unit_system: 'semester',
  };
}

/**
 * Carry a human verdict only while it still describes the same official bytes.
 * Kept pure so import behavior is regression-testable without Mongo.
 */
function verificationForSourceBundle(prior, nextHash) {
  const previous = prior?.verification;
  const priorHash = prior?.provenance?.source_bundle_hash;
  const sourceChanged = Boolean(previous?.verified && priorHash !== nextHash);
  if (sourceChanged) {
    return {
      source_changed: true,
      verification: {
        verified: false,
        verified_by: null,
        verified_at: null,
        notes: null,
        stale: true,
        stale_reason: 'official source bundle changed after verification',
        previous,
      },
      research_status: 'source_changed_needs_human_reverification',
    };
  }
  return {
    source_changed: false,
    verification: previous || {
      verified: false, verified_by: null, verified_at: null, notes: null,
    },
    research_status: previous?.verified ? (prior.research_status || 'unverified') : null,
  };
}

const IMPORT_OPERATIONAL_FIELDS = new Set([
  'acceptance', 'collection_status', 'curated_at', 'curated_by',
  'research_status', 'updated_at', 'verification',
]);

function stableMaterial(value, { topLevel = true } = {}) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => stableMaterial(entry, { topLevel: false }));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().filter((key) => (
    !topLevel || !IMPORT_OPERATIONAL_FIELDS.has(key)
  )).map((key) => [key, stableMaterial(value[key], { topLevel: false })]));
}

/** Content identity used to keep an importer from overwriting a hand edit. */
function importMaterialHash(doc) {
  return createHash('sha256').update(JSON.stringify(stableMaterial(doc))).digest('hex');
}

/**
 * A verified Mongo document may contain a researcher correction not yet
 * reflected in the composition artifact. The source bundle can be unchanged
 * in that case, so carrying its verdict while replacing its tree would be
 * dishonest. Fail the preflight and require an explicit artifact reconciliation.
 */
function verifiedImportConflict(prior, next) {
  if (prior?.verification?.verified !== true) return false;
  const priorHash = prior?.provenance?.source_bundle_hash;
  const nextHash = next?.provenance?.source_bundle_hash;
  if (!priorHash || priorHash !== nextHash) return false;
  return importMaterialHash(prior) !== importMaterialHash(next);
}

const idsFor = (rows) => new Set((rows || []).map((row) => row?._id).filter(Boolean));

/**
 * Exact primary-release manifest. This is deliberately stricter than the
 * generic registry row-count check: losing one accepted public university or
 * turning a resolved negative into an unfinished row must abort publication.
 */
function assertPrimaryPublicationCohort(registry, docs, coverage) {
  const publicSlugs = registry?.cohorts?.schev_public_four_year?.institution_slugs || [];
  const colleges = (registry?.institutions || []).filter((institution) => (
    institution.level === 'community_college'
  ));
  const negativeColleges = colleges.filter((institution) => institution.offers_cs === false);
  const positiveColleges = colleges.filter((institution) => institution.offers_cs !== false);
  const secondarySlugs = [
    'bridgewater-college',
    'randolph-macon-college',
    'shenandoah-university',
  ];
  if (publicSlugs.length !== 15 || colleges.length !== 24
      || positiveColleges.length !== 19 || negativeColleges.length !== 5) {
    throw new Error(
      `primary cohort manifest changed: public=${publicSlugs.length}, colleges=${colleges.length}, `
      + `positive_colleges=${positiveColleges.length}, negative_findings=${negativeColleges.length}`,
    );
  }
  if (new Set(publicSlugs).size !== publicSlugs.length
      || new Set(colleges.map((institution) => institution.slug)).size !== colleges.length) {
    throw new Error('primary cohort manifest contains duplicate institution slugs');
  }
  const registryBySlug = new Map((registry.institutions || []).map((institution) => [institution.slug, institution]));
  const invalidPublic = publicSlugs.filter((slug) => registryBySlug.get(slug)?.level !== 'four_year');
  if (invalidPublic.length) {
    throw new Error(`SCHEV public cohort slugs missing from the four-year registry: ${invalidPublic.join(', ')}`);
  }

  const documentIds = idsFor(docs);
  const expectedDocumentIds = new Set([
    ...publicSlugs.map((slug) => `va:degree:${slug}:cs`),
    ...positiveColleges.map((institution) => `va:as:${institution.slug}:cs`),
    ...secondarySlugs.map((slug) => `va:degree:${slug}:cs`),
  ]);
  const coverageBySlug = new Map((coverage || []).map((row) => [
    String(row?._id || '').replace(/^va:cov:(?:cc|uni):/, ''), row,
  ]));
  const missingPublic = publicSlugs.filter((slug) => !documentIds.has(`va:degree:${slug}:cs`));
  const missingColleges = positiveColleges
    .map((institution) => institution.slug)
    .filter((slug) => !documentIds.has(`va:as:${slug}:cs`));
  const unresolvedNegatives = negativeColleges
    .map((institution) => institution.slug)
    .filter((slug) => {
      const row = coverageBySlug.get(slug);
      return !row?.finding_complete || row?.outcome !== 'no_cs_program'
        || row?.publication_applicable !== false || row?.collected !== true;
    });
  const wronglyPublishedNegatives = negativeColleges
    .map((institution) => institution.slug)
    .filter((slug) => documentIds.has(`va:as:${slug}:cs`));
  const unaccepted = (docs || []).filter((doc) => doc?.acceptance?.accepted !== true).map((doc) => doc?._id);
  const unexpectedDocuments = [...documentIds].filter((id) => !expectedDocumentIds.has(id));
  const duplicateDocuments = docs.length !== documentIds.size;
  const associateCount = (docs || []).filter((doc) => doc?.kind === 'as_degree').length;
  const bachelorCount = (docs || []).filter((doc) => doc?.kind === 'degree').length;
  const problems = [];
  if (missingPublic.length) problems.push(`missing public degrees: ${missingPublic.join(', ')}`);
  if (missingColleges.length) problems.push(`missing associate degrees: ${missingColleges.join(', ')}`);
  if (unresolvedNegatives.length) problems.push(`incomplete negative findings: ${unresolvedNegatives.join(', ')}`);
  if (wronglyPublishedNegatives.length) problems.push(`negative findings published as degrees: ${wronglyPublishedNegatives.join(', ')}`);
  if (unaccepted.length) problems.push(`unaccepted published documents: ${unaccepted.join(', ')}`);
  if (unexpectedDocuments.length) problems.push(`unexpected release documents: ${unexpectedDocuments.join(', ')}`);
  if (duplicateDocuments) problems.push('release contains duplicate document IDs');
  if (associateCount !== 19 || bachelorCount !== 18 || docs.length !== 37) {
    problems.push(`release document counts are AS ${associateCount}, BS ${bachelorCount}, total ${docs.length}; expected 19/18/37`);
  }
  if (problems.length) throw new Error(`primary publication invariant failed — ${problems.join('; ')}`);
  return {
    public_degrees: publicSlugs.length,
    associate_degrees: associateCount,
    negative_findings: negativeColleges.length,
    secondary_bachelors: bachelorCount - publicSlugs.length,
    documents: docs.length,
  };
}

/**
 * Publication is narrower than parser or catalog evaluation.
 *
 * A parser-only tree remains useful collection evidence, but it is not the
 * complete, source-walked degree researchers are being asked to verify.  This
 * predicate therefore fails closed unless a composition exists, the canonical
 * catalog gate passes, and the current extraction actually produced a degree.
 */
function acceptedCompositionPublication(composition, doc) {
  if (!composition) return { eligible: false, reason: 'source_composition_required' };
  if (composition.course_namespace?.kind === 'institution_local'
      && composition.course_namespace?.vccs_master_applicable === false) {
    const namespace = composition.course_namespace;
    const expectedFormat = `${namespace.institution_id}:<code>`;
    const ownerScoped = namespace.identity_contract === 'owner_plus_course_id'
      && namespace.scoped_key_format === expectedFormat
      && doc?.course_namespace?.identity_contract === namespace.identity_contract
      && doc?.course_namespace?.institution_id === namespace.institution_id
      && doc?.course_namespace?.scoped_key_format === namespace.scoped_key_format;
    if (!ownerScoped) {
      return { eligible: false, reason: 'owner_scoped_course_identity_required' };
    }
  }
  if (doc?.source_method !== 'official_catalog_composition') {
    return { eligible: false, reason: 'official_catalog_composition_required' };
  }
  if (doc?.status !== 'extracted') {
    return { eligible: false, reason: 'current_extraction_required' };
  }
  if (doc?.acceptance?.accepted !== true) {
    return { eligible: false, reason: 'catalog_acceptance_failed' };
  }
  return { eligible: true, reason: null };
}

const requirementIdForInstitution = (inst) => (
  `${isCC(inst?.level) ? 'va:as' : 'va:degree'}:${inst?.slug}:cs`
);

/**
 * Existing official-catalog documents in this run's institution scope that
 * are no longer publishable. Removing them is the fail-closed half of an
 * accepted-only publication: otherwise a refreshed source that stops passing
 * would leave yesterday's accepted or verified document visible indefinitely.
 */
function unpublishedRequirementIds(existingDocs, institutions, publishedDocs) {
  const scoped = new Set((institutions || []).map(requirementIdForInstitution));
  const published = new Set((publishedDocs || []).map((doc) => doc?._id).filter(Boolean));
  const existing = existingDocs instanceof Map
    ? [...existingDocs.entries()].map(([id, doc]) => ({ id, doc }))
    : (existingDocs || []).map((doc) => (
      typeof doc === 'string' ? { id: doc, doc: null } : { id: doc?._id, doc }
    ));
  return [...new Set(existing.filter(({ id, doc }) => (
    id && scoped.has(id) && !published.has(id) && doc?.status !== 'superseded'
      && doc?.source === 'institution_catalog'
  )).map(({ id }) => id))].sort();
}

/** Legacy IDs explicitly retired by the registry, retained for audit only. */
function retiredRequirementIds(existingDocs, institutions) {
  const existing = existingDocs instanceof Map
    ? existingDocs
    : new Map((existingDocs || []).map((doc) => [doc?._id, doc]));
  const retired = (institutions || []).flatMap((inst) => (
    (inst.retires || []).flatMap((slug) => [`va:as:${slug}:cs`, `va:degree:${slug}:cs`])
  ));
  return [...new Set(retired.filter((id) => (
    existing.has(id) && existing.get(id)?.status !== 'superseded'
      && existing.get(id)?.source === 'institution_catalog'
  )))].sort();
}

/** Recoverably remove a prior document from publication without erasing it. */
function supersededCatalogPatch(prior, {
  reason,
  at = new Date(),
} = {}) {
  const timestamp = at instanceof Date ? at : new Date(at);
  const previousVerification = prior?.verification || {
    verified: false, verified_by: null, verified_at: null, notes: null,
  };
  const why = reason || 'no_longer_eligible_for_accepted_composition_publication';
  return {
    status: 'superseded',
    collection_status: 'superseded',
    research_status: 'unpublished_needs_source_review',
    verification: {
      verified: false,
      verified_by: null,
      verified_by_label: null,
      verified_at: null,
      notes: null,
      stale: true,
      stale_reason: `accepted-composition publication closed: ${why}`,
      previous: previousVerification,
    },
    unpublication: {
      at: timestamp,
      by: 'importVirginiaCatalogDegrees',
      reason: why,
      previous_status: prior?.status || null,
      previous_collection_status: prior?.collection_status || null,
      previous_acceptance: prior?.acceptance || null,
    },
    updated_at: timestamp,
  };
}

function replacementRevision(prior, next, at = new Date()) {
  return {
    doc_id: next._id,
    at,
    by: 'importVirginiaCatalogDegrees',
    action: 'replace_catalog_document',
    before: {
      groups: (prior?.requirement_groups || []).length,
      codes: (prior?.codes_seen || []).length,
      status: prior?.status || null,
      source_bundle_hash: prior?.provenance?.source_bundle_hash || null,
    },
    after: {
      groups: (next.requirement_groups || []).length,
      codes: (next.codes_seen || []).length,
      status: next.status || null,
      source_bundle_hash: next?.provenance?.source_bundle_hash || null,
    },
    // The leaf diff is for review, not rollback: it intentionally omits
    // bookkeeping fields. Retain the complete prior BSON document so a
    // publication replacement is exactly recoverable, including signatures
    // and timestamps that must never be reconstructed from prose.
    before_document: prior,
    // Preserve the old values, not just counts. This makes a source-driven
    // replacement of a previously curated tree reconstructible from history.
    changes: diffDocs(prior, next),
  };
}

// ── driver ──────────────────────────────────────────────────────────────────

async function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(CAT, 'institutions.json'), 'utf8'));
  const list = selectedInstitutions(registry.institutions, opts.only);

  const uri = opts.uri || 'mongodb://localhost:27017';
  const dbName = opts.dbName || 'pmt_research';
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const creditsByCode = new Map(
      (await db.collection('va_courses').find({}, { projection: { code: 1, credits: 1 } }).toArray())
        .map((c) => [c.code, c.credits]),
    );
    log(`course registry: ${creditsByCode.size} VCCS courses with credit figures`);
    if (opts.apply && creditsByCode.size === 0) {
      throw new Error('refusing --apply because va_courses is empty; publish the Virginia course corpus first');
    }

    // Read every source for collision detection. A non-catalog document that
    // happens to use a catalog-shaped ID must abort rather than be overwritten
    // through an `_id`-only upsert.
    // A source plan answers whether the checked-in cache is internally ready;
    // it deliberately does not inspect or authorize replacement of persisted
    // researcher verification. Normal dry-runs still enforce those conflicts,
    // and every write path always does.
    const existing = opts.sourcePlan
      ? new Map()
      : new Map(
        (await db.collection('va_requirements').find({}).toArray())
          .map((document) => [document._id, document]),
      );
    const idCollisions = list.map((institution) => requirementIdForInstitution(institution))
      .filter((id) => {
        const prior = existing.get(id);
        return prior && prior.source !== 'institution_catalog';
      });
    if (idCollisions.length) {
      throw new Error(`catalog document ID collides with another source: ${idCollisions.join(', ')}`);
    }

    const docs = [];
    const evaluatedDocs = [];
    const skipped = [];
    const coverage = [];
    const publicationReasons = new Map();
    const reopenedVerificationIds = [];

    for (const inst of list) {
      const file = path.join(REQS, `${inst.slug}.json`);
      if (!fs.existsSync(file)) {
        skipped.push({ slug: inst.slug, why: 'no extraction file' });
        publicationReasons.set(requirementIdForInstitution(inst), 'current_extraction_required');
        coverage.push(coverageRow(inst, null, false, null, {
          publication: { eligible: false, reason: 'current_extraction_required' },
        }));
        continue;
      }
      const extract = JSON.parse(fs.readFileSync(file, 'utf8'));
      const compositionFile = path.join(COMPOSED, `${inst.slug}.json`);
      const composition = fs.existsSync(compositionFile)
        ? JSON.parse(fs.readFileSync(compositionFile, 'utf8'))
        : null;

      const verdict = extract.validation ? extract.validation.verdict : 'n/a';
      if (verdict === 'fail' && !composition && !opts.allowFailed) {
        skipped.push({ slug: inst.slug, why: `validation ${verdict}` });
        publicationReasons.set(requirementIdForInstitution(inst), 'parser_validation_failed');
        coverage.push(coverageRow(inst, extract, false, null, {
          publication: { eligible: false, reason: 'parser_validation_failed' },
        }));
        continue;
      }

      const doc = toDocument(extract, inst, creditsByCode, composition);
      doc.acceptance = validateDegreeAcceptance(doc, {
        institutionLevel: inst.level,
        resolveCourse: acceptanceResolver(doc, creditsByCode),
      });
      if (doc.acceptance.ready_for_analysis) doc.collection_status = 'analysis_ready';
      else if (doc.acceptance.accepted) doc.collection_status = 'catalog_accepted';
      const prior = existing.get(doc._id);
      const nextHash = doc.provenance.source_bundle_hash;
      const carried = verificationForSourceBundle(prior?.status === 'superseded' ? null : prior, nextHash);
      doc.verification = carried.verification;
      if (carried.research_status) doc.research_status = carried.research_status;
      if (carried.source_changed) reopenedVerificationIds.push(doc._id);
      evaluatedDocs.push(doc);

      const findingEvidence = programFindingEvidence(extract);
      const publication = opts.acceptedCompositionsOnly
        ? (findingEvidence.complete
          ? { eligible: false, reason: 'not_applicable_no_program', finding_complete: true }
          : acceptedCompositionPublication(composition, doc))
        : { eligible: true, reason: null };
      publicationReasons.set(doc._id, publication.reason);
      if (publication.eligible) docs.push(doc);
      else skipped.push({ slug: inst.slug, why: publication.reason });
      coverage.push(coverageRow(
        inst,
        extract,
        publication.eligible && doc.status === 'extracted',
        doc,
        { publication },
      ));
    }

    const verifiedConflicts = docs.filter((doc) => verifiedImportConflict(existing.get(doc._id), doc));
    if (verifiedConflicts.length) {
      throw new Error(
        'refusing to overwrite verified Mongo content that differs from the unchanged composition artifact: '
        + verifiedConflicts.map((doc) => doc._id).join(', '),
      );
    }
    const verifiedCoreConflicts = docs.filter((doc) => (
      verifiedCoreConflict(existing.get(doc._id), doc)
    ));
    if (verifiedCoreConflicts.length) {
      log(
        'verified core-content conflicts (course/choice/unit/policy changes are not standardization): '
        + verifiedCoreConflicts.map((doc) => doc._id).join(', '),
      );
      if (opts.apply) {
        throw new Error(
          'refusing to change the core content of verified Virginia majors: '
          + verifiedCoreConflicts.map((doc) => doc._id).join(', '),
        );
      }
    }
    if (reopenedVerificationIds.length) {
      log(`verified records reopened by changed/missing source bundle hash: ${reopenedVerificationIds.join(', ')}`);
      if (opts.apply && !opts.allowVerifiedReopen) {
        throw new Error(
          'refusing to reopen verified records without --allow-verified-reopen: '
          + reopenedVerificationIds.join(', '),
        );
      }
    }

    // A full run is the authoritative registry-wide coverage snapshot even
    // though only accepted compositions become degree documents. The registry
    // count grows when the comparison scope adds a previously missing school.
    if (!opts.only.length && coverage.length !== registry.institutions.length) {
      throw new Error(`coverage invariant failed: evaluated ${coverage.length}/${registry.institutions.length} institutions`);
    }
    if (opts.acceptedCompositionsOnly && !opts.only.length) {
      const manifest = assertPrimaryPublicationCohort(registry, docs, coverage);
      log(
        `primary publication invariant: ${manifest.public_degrees}/15 public degrees · `
        + `${manifest.associate_degrees}/19 associate degrees · `
        + `${manifest.negative_findings}/5 source-backed negative findings · `
        + `${manifest.secondary_bachelors} secondary bachelors`,
      );
    }

    const as = docs.filter((d) => d.kind === 'as_degree');
    const bs = docs.filter((d) => d.kind === 'degree');
    const groupsTotal = docs.reduce((n, d) => n + d.requirement_groups.length, 0);
    const receiversTotal = docs.reduce((n, d) => n + d.requirement_groups.reduce((m, g) => m + g.sections.reduce((k, s) => k + s.receivers.length, 0), 0), 0);

    log(`documents: ${docs.length} (AS ${as.length}, BS ${bs.length})${opts.acceptedCompositionsOnly ? ` from ${evaluatedDocs.length} evaluated candidates` : ''}`);
    log(`requirement groups: ${groupsTotal} · receivers: ${receiversTotal}`);
    log(`flat (single-group) documents: ${docs.filter((d) => d.requirement_groups.length === 1).length}`);
    log(`catalog accepted: ${docs.filter((d) => d.acceptance.accepted).length}/${docs.length} · analysis ready: ${docs.filter((d) => d.acceptance.ready_for_analysis).length}/${docs.length}`);
    const blocked = docs.filter((d) => !d.acceptance.ready_for_analysis);
    for (const doc of blocked) {
      const failures = [
        ...doc.acceptance.catalog.failed.map((name) => `catalog:${name}`),
        ...doc.acceptance.analysis_ready.failed
          .filter((name) => name !== 'catalog_acceptance')
          .map((name) => `analysis:${name}`),
      ];
      log(`not ready: ${doc._id} — ${[...new Set(failures)].join(', ')}`);
    }
    if (skipped.length) log(`skipped ${skipped.length}: ${skipped.map((s) => `${s.slug} (${s.why})`).join(', ')}`);

    const retiredIds = retiredRequirementIds(existing, list);
    for (const id of retiredIds) publicationReasons.set(id, 'institution_registry_slug_retired');
    const unpublishedIds = [...new Set([
      ...(opts.acceptedCompositionsOnly ? unpublishedRequirementIds(existing, list, docs) : []),
      ...retiredIds,
    ])].sort();
    const verifiedSupersedeIds = unpublishedIds.filter((id) => (
      existing.get(id)?.verification?.verified === true
    ));
    if (opts.acceptedCompositionsOnly) {
      log(`accepted-composition publication: ${docs.length} document(s); ${unpublishedIds.length} scoped prior document(s) to supersede`);
    }
    if (verifiedSupersedeIds.length) {
      log(`verified records in supersede plan: ${verifiedSupersedeIds.join(', ')}`);
      if (opts.apply && !opts.allowVerifiedSupersede) {
        throw new Error(
          'refusing to supersede verified records without --allow-verified-supersede: '
          + verifiedSupersedeIds.join(', '),
        );
      }
    }
    const coverageSummary = {
      rows: coverage.length,
      offering: coverage.filter((row) => row.offers_cs).length,
      collected: coverage.filter((row) => row.collected).length,
    };
    log(`coverage snapshot: ${coverageSummary.rows} rows · offering CS ${coverageSummary.offering} · collected ${coverageSummary.collected}`);

    if (opts.dryRun) { log('dry run — nothing written (pass --apply to write)'); return; }

    log(`writing to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${dbName}`);
    const session = client.startSession();
    let superseded = 0;
    try {
      await session.withTransaction(async () => {
        // withTransaction may retry this callback after a transient error.
        superseded = 0;
        for (const d of docs) {
          const prior = existing.get(d._id);
          const filter = prior
            ? {
              _id: d._id,
              ...(prior.source != null
                ? { source: prior.source }
                : { source: { $exists: false } }),
              ...(prior.updated_at != null
                ? { updated_at: prior.updated_at }
                : { updated_at: { $exists: false } }),
            }
            : { _id: d._id, source: 'institution_catalog' };
          const result = await db.collection('va_requirements').replaceOne(
            filter,
            d,
            { upsert: !prior, session },
          );
          if (prior && result.matchedCount !== 1) {
            throw new Error(`concurrent edit detected for ${d._id}; publication transaction aborted`);
          }
          if (prior) {
            await db.collection('va_revisions').insertOne(
              replacementRevision(prior, d),
              { session },
            );
          }
        }

        for (const id of unpublishedIds) {
          const prior = existing.get(id);
          const supersedePatch = supersededCatalogPatch(prior, {
            reason: publicationReasons.get(id) || 'no_longer_eligible_for_accepted_composition_publication',
            at: new Date(),
          });
          const concurrency = prior?.updated_at != null
            ? { updated_at: prior.updated_at }
            : { updated_at: { $exists: false } };
          const sourceGuard = prior?.source != null
            ? { source: prior.source }
            : { source: { $exists: false } };
          const result = await db.collection('va_requirements').updateOne(
            { _id: id, ...sourceGuard, ...concurrency },
            { $set: supersedePatch },
            { session },
          );
          if (!result.matchedCount) {
            throw new Error(`concurrent edit detected for ${id}; publication transaction aborted`);
          }
          if (!result.modifiedCount) continue;
          superseded += 1;
          await db.collection('va_revisions').insertOne({
            doc_id: id,
            at: supersedePatch.unpublication.at,
            by: 'importVirginiaCatalogDegrees',
            action: 'unpublish_catalog_document',
            reason: supersedePatch.unpublication.reason,
            before: {
              status: prior?.status || null,
              collection_status: prior?.collection_status || null,
              acceptance: prior?.acceptance || null,
              verification: prior?.verification || null,
              provenance: prior?.provenance || null,
            },
            before_document: prior,
            after: {
              status: supersedePatch.status,
              collection_status: supersedePatch.collection_status,
              research_status: supersedePatch.research_status,
              verification: supersedePatch.verification,
              unpublication: supersedePatch.unpublication,
            },
          }, { session });
        }

        // A targeted `--only` import must not erase other institutions from
        // coverage. Full sweeps replace the Virginia coverage namespace;
        // targeted sweeps replace only the rows they evaluated.
        const coverageFilter = coverageReplacementFilter(coverage, opts.only.length > 0);
        if (coverageFilter) await db.collection('va_coverage').deleteMany(coverageFilter, { session });
        if (coverage.length) {
          await db.collection('va_coverage').insertMany(coverage, { ordered: false, session });
        }
      });
    } finally {
      await session.endSession();
    }
    if (unpublishedIds.length) {
      log(`superseded ${superseded} ineligible prior catalog document(s): ${unpublishedIds.join(', ')}`);
    }
    log(`coverage written: ${coverageSummary.rows} rows`);
  } finally {
    await client.close();
  }
}

function coverageReplacementFilter(rows, selective) {
  if (!selective) return { _id: { $regex: '^va:cov:' } };
  const ids = (rows || []).map((row) => row?._id).filter(Boolean);
  return ids.length ? { _id: { $in: ids } } : null;
}

function collectSourceRefs(value, refs = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSourceRefs(entry, refs));
    return refs;
  }
  if (!value || typeof value !== 'object') return refs;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'source_refs' && Array.isArray(child)) {
      child.filter((sourceId) => typeof sourceId === 'string' && sourceId.trim())
        .forEach((sourceId) => refs.add(sourceId));
    } else collectSourceRefs(child, refs);
  }
  return refs;
}

function programFindingEvidence(source = {}) {
  const refs = collectSourceRefs(source.program_finding);
  const sources = (source.sources || [])
    .filter((entry) => refs.has(entry.id))
    .map((entry) => ({
      id: entry.id,
      kind: entry.kind || null,
      label: entry.label || null,
      url: entry.url || entry.requested_url || null,
      requested_url: entry.requested_url || null,
      final_url: entry.final_url || null,
      retrieval_url: entry.retrieval_url || null,
      captured_at: entry.captured_at || null,
      sha256: entry.sha256 || null,
      official: entry.official === true,
      secure: entry.secure === true,
    }));
  const sourceIds = new Set(sources.map((entry) => entry.id));
  const refsResolved = refs.size > 0 && [...refs].every((sourceId) => sourceIds.has(sourceId));
  const sourceEvidenceValid = sources.every((entry) => (
    entry.official === true
    && /^https?:\/\//.test(entry.url || '')
    && /^[a-f0-9]{64}$/.test(entry.sha256 || '')
  ));
  const complete = source.outcome === 'no_cs_program'
    && Boolean(source.catalog_year)
    && Boolean(source.program_finding?.code)
    && Boolean(source.program_finding?.summary)
    && refsResolved
    && sourceEvidenceValid;
  return { complete, refsResolved, sources };
}

/** One coverage row: does this institution offer CS, and did we publish it. */
function coverageRow(inst, extract, collected, doc = null, { publication = null } = {}) {
  const source = extract || {};
  const publicationEligible = publication ? publication.eligible === true : Boolean(collected);
  const findingEvidence = programFindingEvidence(source);
  const findingComplete = findingEvidence.complete;
  return {
    _id: `va:cov:${isCC(inst.level) ? 'cc' : 'uni'}:${inst.slug}`,
    institution: inst.name,
    level: inst.level,
    offers_cs: extract ? extract.offers_cs !== false : inst.offers_cs !== false,
    vccs_slug: inst.vccs_slug || null,
    registry_url: inst.catalog_root || null,
    source_url: source.source_url || null,
    catalog_year: source.catalog_year || inst.degree_context?.catalog_year || null,
    outcome: source.outcome || 'not_extracted',
    // Negative findings need to be inspectable without opening a repository
    // artifact. In particular, "no CS-specific degree" can coexist with a
    // broad Science A.S. or a recently discontinued specialization.
    program_finding: source.program_finding || null,
    // Negative findings have no publishable degree document. Carry the exact
    // official evidence their source_refs name on the coverage row so those
    // refs remain resolvable through the API instead of dangling into a local
    // extraction artifact.
    finding_sources: findingEvidence.sources,
    finding_source_refs_resolved: findingEvidence.refsResolved,
    finding_complete: findingComplete,
    publication_applicable: !findingComplete,
    source_composition_applicable: !findingComplete,
    validation: source.validation ? source.validation.verdict : null,
    source_composed: doc?.source_method === 'official_catalog_composition',
    publication_eligible: publicationEligible,
    publication_blocker: publicationEligible || findingComplete
      ? null
      : (publication?.reason || 'not_collected'),
    catalog_accepted: publicationEligible && doc?.acceptance?.accepted === true,
    analysis_ready: publicationEligible && doc?.acceptance?.ready_for_analysis === true,
    acceptance_failures: doc ? {
      catalog: doc.acceptance.catalog.failed,
      analysis: doc.acceptance.analysis_ready.failed,
    } : null,
    collected: Boolean(collected) || findingComplete,
  };
}

/**
 * Rebuild the accepted 37-document publication source set from checked-in
 * cache artifacts without consulting persisted requirement documents. This is
 * a read-only pre-import plan: it intentionally carries no Mongo verification
 * signatures, so the publication audit will require fresh human review.
 */
function cachedAcceptedSourcePlan(creditsByCode = new Map()) {
  const registry = JSON.parse(fs.readFileSync(path.join(CAT, 'institutions.json'), 'utf8'));
  const documents = [];
  const evaluatedDocuments = [];
  const coverage = [];
  const skipped = [];

  for (const inst of registry.institutions) {
    const file = path.join(REQS, `${inst.slug}.json`);
    if (!fs.existsSync(file)) {
      skipped.push({ slug: inst.slug, why: 'current_extraction_required' });
      coverage.push(coverageRow(inst, null, false, null, {
        publication: { eligible: false, reason: 'current_extraction_required' },
      }));
      continue;
    }
    const extract = JSON.parse(fs.readFileSync(file, 'utf8'));
    const compositionFile = path.join(COMPOSED, `${inst.slug}.json`);
    const composition = fs.existsSync(compositionFile)
      ? JSON.parse(fs.readFileSync(compositionFile, 'utf8'))
      : null;
    if (extract?.validation?.verdict === 'fail' && !composition) {
      skipped.push({ slug: inst.slug, why: 'parser_validation_failed' });
      coverage.push(coverageRow(inst, extract, false, null, {
        publication: { eligible: false, reason: 'parser_validation_failed' },
      }));
      continue;
    }

    const doc = toDocument(extract, inst, creditsByCode, composition);
    doc.acceptance = validateDegreeAcceptance(doc, {
      institutionLevel: inst.level,
      resolveCourse: acceptanceResolver(doc, creditsByCode),
    });
    if (doc.acceptance.ready_for_analysis) doc.collection_status = 'analysis_ready';
    else if (doc.acceptance.accepted) doc.collection_status = 'catalog_accepted';
    evaluatedDocuments.push(doc);

    const findingEvidence = programFindingEvidence(extract);
    const publication = findingEvidence.complete
      ? { eligible: false, reason: 'not_applicable_no_program', finding_complete: true }
      : acceptedCompositionPublication(composition, doc);
    if (publication.eligible) documents.push(doc);
    else skipped.push({ slug: inst.slug, why: publication.reason });
    coverage.push(coverageRow(inst, extract, publication.eligible && doc.status === 'extracted', doc, {
      publication,
    }));
  }

  const manifest = assertPrimaryPublicationCohort(registry, documents, coverage);
  return { registry, documents, evaluatedDocuments, coverage, skipped, manifest };
}

if (require.main === module) {
  if (opts.help) console.log(HELP_TEXT);
  else main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  acceptanceResolver,
  acceptedCompositionPublication,
  assertPrimaryPublicationCohort,
  cachedAcceptedSourcePlan,
  canonicalSections,
  courseTitles,
  coverageRow,
  coverageReplacementFilter,
  importMaterialHash,
  majorCoreHash,
  parseCliArgs,
  receiversForRow,
  retiredRequirementIds,
  requirementGroups,
  replacementRevision,
  selectedInstitutions,
  sourceCourseUnitEvidence,
  sourceBundleHash,
  supersededCatalogPatch,
  unpublishedRequirementIds,
  validatedCourseNamespace,
  verificationForSourceBundle,
  verifiedImportConflict,
  verifiedCoreConflict,
  toDocument,
};
