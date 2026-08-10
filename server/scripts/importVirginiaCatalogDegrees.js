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
 *   node scripts/importVirginiaCatalogDegrees.js --uri <uri> --db pmt_research
 *   node scripts/importVirginiaCatalogDegrees.js --accepted-compositions-only --uri <uri> --db pmt_research
 *   node scripts/importVirginiaCatalogDegrees.js --dry-run
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { courseIdFor } = require('../services/virginia/courseIdentity');
const { compileDegreeComposition } = require('../services/virginia/degreeComposition');
const { validateDegreeAcceptance } = require('../services/virginia/degreeAcceptance');

const CAT = path.join(__dirname, '..', '.va-catalogs');
const REQS = path.join(CAT, 'requirements');
const COMPOSED = path.join(CAT, 'composed');

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const opts = {
  uri: val('--uri'),
  dbName: val('--db'),
  dryRun: flag('--dry-run'),
  allowFailed: flag('--allow-failed'),
  acceptedCompositionsOnly: flag('--accepted-compositions-only'),
  only: (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
};
const log = (...a) => console.log('[va:import]', ...a);

const isCC = (level) => level === 'community_college';

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
  const codeById = new Map((doc.codes_seen || []).map((code) => [courseIdFor(code), code]));
  return ({ side, id, key }) => {
    const code = key && /^va:/.test(key) ? key.slice(3) : codeById.get(Number(id));
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
    return side === 'community_college'
      ? { course_id: Number(id), course_key: key || `va:${code}` }
      : { parent_id: Number(id) };
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
    ? compileDegreeComposition(composition, { institutionLevel: inst.level })
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
      }, { institutionLevel: inst.level });
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
    total_units_max: composition?.total_units_max ?? (extract.total_credits ? extract.total_credits.max : null),
    requirement_groups: groups,
    requirement_variants: requirementVariants,
    catalog_platform: inst.platform || null,
    codes_seen: codes,
    course_titles: {
      ...courseTitles(extract),
      ...(compiled?.course_titles || {}),
      ...Object.assign({}, ...requirementVariants.map((variant) => variant.course_titles || {})),
    },
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

// ── driver ──────────────────────────────────────────────────────────────────

async function main() {
  const registry = JSON.parse(fs.readFileSync(path.join(CAT, 'institutions.json'), 'utf8'));
  let list = registry.institutions;
  if (opts.only.length) list = list.filter((i) => opts.only.some((o) => i.slug.startsWith(o)));

  const uri = opts.uri || process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = opts.dbName || process.env.DB_NAME || 'pmt_research';
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db(dbName);
    const creditsByCode = new Map(
      (await db.collection('va_courses').find({}, { projection: { code: 1, credits: 1 } }).toArray())
        .map((c) => [c.code, c.credits]),
    );
    log(`course registry: ${creditsByCode.size} VCCS courses with credit figures`);

    const existing = new Map(
      (await db.collection('va_requirements').find({ source: 'institution_catalog' }).toArray()).map((d) => [d._id, d]),
    );

    const docs = [];
    const evaluatedDocs = [];
    const skipped = [];
    const coverage = [];
    const publicationReasons = new Map();

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
      evaluatedDocs.push(doc);

      const publication = opts.acceptedCompositionsOnly
        ? acceptedCompositionPublication(composition, doc)
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

    // A full run is the authoritative registry-wide coverage snapshot even
    // though only accepted compositions become degree documents. The registry
    // count grows when the comparison scope adds a previously missing school.
    if (!opts.only.length && coverage.length !== registry.institutions.length) {
      throw new Error(`coverage invariant failed: evaluated ${coverage.length}/${registry.institutions.length} institutions`);
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
    if (opts.acceptedCompositionsOnly) {
      log(`accepted-composition publication: ${docs.length} document(s); ${unpublishedIds.length} scoped prior document(s) to supersede`);
    }
    const coverageSummary = {
      rows: coverage.length,
      offering: coverage.filter((row) => row.offers_cs).length,
      collected: coverage.filter((row) => row.collected).length,
    };
    log(`coverage snapshot: ${coverageSummary.rows} rows · offering CS ${coverageSummary.offering} · collected ${coverageSummary.collected}`);

    if (opts.dryRun) { log('dry run — nothing written'); return; }

    log(`writing to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${dbName}`);
    for (const d of docs) {
      const prior = existing.get(d._id);
      await db.collection('va_requirements').replaceOne({ _id: d._id }, d, { upsert: true });
      if (prior) {
        await db.collection('va_revisions').insertOne({
          doc_id: d._id,
          at: new Date(),
          by: 'importVirginiaCatalogDegrees',
          before: { groups: (prior.requirement_groups || []).length, codes: (prior.codes_seen || []).length, status: prior.status },
          after: { groups: d.requirement_groups.length, codes: d.codes_seen.length, status: d.status },
        });
      }
    }

    if (unpublishedIds.length) {
      let superseded = 0;
      for (const id of unpublishedIds) {
        const prior = existing.get(id);
        const patch = supersededCatalogPatch(prior, {
          reason: publicationReasons.get(id) || 'no_longer_eligible_for_accepted_composition_publication',
          at: new Date(),
        });
        const res = await db.collection('va_requirements').updateOne(
          { _id: id, source: 'institution_catalog' },
          { $set: patch },
        );
        if (!res.modifiedCount) continue;
        superseded += 1;
        await db.collection('va_revisions').insertOne({
          doc_id: id,
          at: patch.unpublication.at,
          by: 'importVirginiaCatalogDegrees',
          action: 'unpublish_catalog_document',
          reason: patch.unpublication.reason,
          before: {
            status: prior?.status || null,
            collection_status: prior?.collection_status || null,
            acceptance: prior?.acceptance || null,
            verification: prior?.verification || null,
            provenance: prior?.provenance || null,
          },
          after: {
            status: patch.status,
            collection_status: patch.collection_status,
            research_status: patch.research_status,
            verification: patch.verification,
            unpublication: patch.unpublication,
          },
        });
      }
      log(`superseded ${superseded} ineligible prior catalog document(s): ${unpublishedIds.join(', ')}`);
    }

    // A targeted `--only` import must not erase the other 54 institutions from
    // coverage. Full sweeps replace the Virginia coverage namespace; targeted
    // sweeps replace only the rows they just evaluated.
    const coverageFilter = coverageReplacementFilter(coverage, opts.only.length > 0);
    if (coverageFilter) await db.collection('va_coverage').deleteMany(coverageFilter);
    if (coverage.length) await db.collection('va_coverage').insertMany(coverage, { ordered: false });
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

/** One coverage row: does this institution offer CS, and did we publish it. */
function coverageRow(inst, extract, collected, doc = null, { publication = null } = {}) {
  const source = extract || {};
  const publicationEligible = publication ? publication.eligible === true : Boolean(collected);
  return {
    _id: `va:cov:${isCC(inst.level) ? 'cc' : 'uni'}:${inst.slug}`,
    institution: inst.name,
    level: inst.level,
    offers_cs: extract ? extract.offers_cs !== false : inst.offers_cs !== false,
    vccs_slug: inst.vccs_slug || null,
    registry_url: inst.catalog_root || null,
    source_url: source.source_url || null,
    outcome: source.outcome || 'not_extracted',
    validation: source.validation ? source.validation.verdict : null,
    source_composed: doc?.source_method === 'official_catalog_composition',
    publication_eligible: publicationEligible,
    publication_blocker: publicationEligible ? null : (publication?.reason || 'not_collected'),
    catalog_accepted: publicationEligible && doc?.acceptance?.accepted === true,
    analysis_ready: publicationEligible && doc?.acceptance?.ready_for_analysis === true,
    acceptance_failures: doc ? {
      catalog: doc.acceptance.catalog.failed,
      analysis: doc.acceptance.analysis_ready.failed,
    } : null,
    collected: Boolean(collected),
  };
}

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

module.exports = {
  acceptanceResolver,
  acceptedCompositionPublication,
  canonicalSections,
  courseTitles,
  coverageRow,
  coverageReplacementFilter,
  receiversForRow,
  retiredRequirementIds,
  requirementGroups,
  sourceBundleHash,
  supersededCatalogPatch,
  unpublishedRequirementIds,
  validatedCourseNamespace,
  verificationForSourceBundle,
  toDocument,
};
