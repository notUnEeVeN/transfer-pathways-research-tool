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
 * ("HIS Elective") becomes a named category receiver instead of vanishing.
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
 *   node scripts/importVirginiaCatalogDegrees.js --dry-run
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MongoClient } = require('mongodb');
const { courseIdFor } = require('../services/virginia/courseIdentity');
const { validateDegreeAcceptance } = require('../services/virginia/degreeAcceptance');

const CAT = path.join(__dirname, '..', '.va-catalogs');
const REQS = path.join(CAT, 'requirements');

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

function sourceBundleHash(extract) {
  const parts = (extract.sources || []).map((source) => `${source.id}:${source.sha256 || source.url}`).sort();
  if (!parts.length && extract.source_url) parts.push(`major:${extract.source_url}`);
  return createHash('sha256').update(`${extract.catalog_year || ''}\n${parts.join('\n')}`).digest('hex');
}

function acceptanceResolver(doc, creditsByCode) {
  const codeById = new Map((doc.codes_seen || []).map((code) => [courseIdFor(code), code]));
  return ({ side, id, key }) => {
    const code = key && /^va:/.test(key) ? key.slice(3) : codeById.get(Number(id));
    if (!code) return false;
    if (side === 'community_college' && !creditsByCode.has(code)) return false;
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
function rowCredits(row, creditsByCode) {
  if (row.credits) return row.credits.min;
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
function groupAdvisement(group, creditsByCode) {
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

  const costs = rows.map((r) => rowCredits(r, creditsByCode));
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
  const base = {
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    hash_id: null,
    ...academic,
  };

  // A requirement the catalog states without naming courses. Kept as a named
  // receiver rather than dropped: it is real, it consumes credits, and the
  // ledger renders `kind: 'category'` as a titled `Requirement` row.
  if (!(row.codes || []).length) {
    return [{
      ...base,
      receiving: { kind: 'category', parent_id: null, name: row.category || row.text, units: row.credits ? row.credits.min : null },
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
      ...base,
      receiving: null,
      options,
      options_conjunction: 'or',
      articulation_status: 'articulated',
      code_seen: row.codes.map((c) => c.code).join(row.conjunction === 'and' ? ' + ' : ' / '),
    }];
  }

  // Four-year OR alternatives are independent receivers in a choose-one
  // section. A `series` means every parent is required in shared evaluation,
  // so storing an OR inside a series makes the solver require both courses.
  if (row.codes.length > 1 && row.conjunction === 'or') {
    return row.codes.map((course) => ({
      ...base,
      receiving: { kind: 'course', parent_id: courseIdFor(course.code), units: row.credits ? row.credits.min : null },
      code_seen: course.code,
    }));
  }

  // A multi-code AND is one complete route. Keeping only codes[0] silently
  // erased lecture/lab pairs and full sequences from the prior importer.
  if (row.codes.length > 1) {
    return [{
      ...base,
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
    ...base,
    receiving: { kind: 'course', parent_id: courseIdFor(row.codes[0].code), units: row.credits ? row.credits.min : null },
    code_seen: row.codes[0].code,
  }];
}

function sectionMetadata(rows, { cc, layer }) {
  const values = rows.map((row) => rowAcademicMetadata(row, { cc, layer }));
  const one = (key) => values.length && values.every((value) => value[key] === values[0][key]) ? values[0][key] : null;
  return { tier: one('tier') || (layer === 'general_education' ? 'breadth' : 'transferable'), course_level: one('course_level'), cc_articulable: one('cc_articulable') };
}

function canonicalSections(group, { cc, layer, sourceRefs }) {
  const out = [];
  const make = (rows, parsed = {}) => {
    const receivers = rows.flatMap((row) => receiversForRow(row, { cc, layer }));
    // A credit-only category (`8 elective credits`) is still a requirement,
    // even though the catalog intentionally supplies no closed course menu.
    if (!receivers.length && parsed.credits) {
      receivers.push(...receiversForRow({
        codes: [], category: group.title, text: group.note || group.title, credits: parsed.credits,
      }, { cc, layer }));
    }
    const explicitCount = parsed.choose ?? null;
    return {
      section_advisement: explicitCount != null
        ? explicitCount
        : parsed.credits ? null : Math.max(1, receivers.length),
      unit_advisement: parsed.credits ? parsed.credits.min : null,
      label_seen: parsed.label || null,
      ...sectionMetadata(rows, { cc, layer }),
      source_refs: sourceRefs,
      note: null,
      overlap_key: null,
      human_review: null,
      receivers,
    };
  };

  for (const parsed of group.sections || []) {
    const rows = parsed.rows || [];
    if (parsed.choose != null || parsed.credits) {
      out.push(make(rows, parsed));
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
        out.push(make([row]));
      }
    }
  }
  return out;
}

/** The whole tree into `requirement_groups`. */
function requirementGroups(tree, { cc, creditsByCode, availableSourceIds = new Set(['major']) }) {
  return (tree.groups || []).map((group) => {
    const advisement = groupAdvisement(group, creditsByCode);
    const layer = requirementLayer(group.title, cc);
    const sourceRefs = sourceRefsForLayer(layer, availableSourceIds);
    const sections = canonicalSections(group, { cc, layer, sourceRefs });
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

function toDocument(extract, inst, creditsByCode) {
  const cc = isCC(inst.level);
  const slug = inst.slug;
  const context = extract.degree_context || inst.degree_context || {};
  const sources = (extract.sources || []).length
    ? extract.sources
    : extract.source_url ? [{ id: 'major', kind: 'major', label: `${inst.name} degree requirements`, url: extract.source_url }] : [];
  const availableSourceIds = new Set(sources.map((source) => source.id));
  if (!availableSourceIds.size && extract.source_url) availableSourceIds.add('major');
  const codes = allCodes(extract);
  const groups = requirementGroups(extract, { cc, creditsByCode, availableSourceIds });
  const captured = extract.outcome === 'captured' && groups.length > 0;

  const status = captured ? 'extracted'
    : extract.outcome === 'no_cs_program' ? 'no_program'
      : 'url_only';

  const base = {
    kind: cc ? 'as_degree' : 'degree',
    major_slug: 'cs',
    source: 'institution_catalog',
    source_method: 'scraped_catalog',
    research_status: 'machine_collected_needs_human_verification',
    collection_status: captured ? (context.composition_status || 'major_only') : 'captured_only',
    total_units: extract.total_credits ? extract.total_credits.min : null,
    total_units_max: extract.total_credits ? extract.total_credits.max : null,
    requirement_groups: groups,
    catalog_platform: inst.platform || null,
    codes_seen: codes,
    course_titles: courseTitles(extract),
    offers_cs: extract.offers_cs !== false,
    source_layers: extract.source_layers || null,
    requirement_layers: extract.source_layers || null,
    sources,
    // How this document was produced and how far it can be trusted, carried on
    // the document itself so the console never has to guess.
    provenance: {
      parser: extract.parser || null,
      hand_read: extract.hand_read === true,
      captured_at: extract.captured_at || null,
      extracted_at: extract.extracted_at || null,
      source_bundle_hash: sourceBundleHash(extract),
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
      degree_title_seen: extract.program_title || 'Computer Science',
      catalog_url: extract.source_url,
      catalog_year: extract.catalog_year || context.catalog_year || null,
      unit_system: 'semester',
      unit_audit: context.unit_audit || null,
      modeling_notes: context.modeling_notes || [],
      data_quality_flags: context.data_quality_flags || [],
      covered_concepts: [],
      extraction: {
        artifact: `server/.va-catalogs/requirements/${slug}.json`,
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
    program: extract.program_title || 'Computer Science, B.S.',
    source_url: extract.source_url,
    status,
    // Every field a California `degree` carries, so a consumer written against
    // the California shape reads these unchanged. Populated where Virginia has
    // an equivalent, explicitly null/[] where it does not — a missing key and a
    // known-empty one are different facts.
    academic_unit: context.academic_unit ?? null,
    campus_key: inst.name,
    catalog_year: extract.catalog_year || context.catalog_year || null,
    college: context.college ?? null,
    data_quality_flags: context.data_quality_flags || (captured ? [] : [{ code: 'no_course_list_published', severity: 'block' }]),
    degree_variant: context.award || null,
    ge_authority: context.general_education_authority ?? null,
    ge_model: context.general_education_authority ?? null,
    ge_variants: [],
    institution_id: `va:uni:${slug}`,
    modeling_notes: [...(context.modeling_notes || []), ...(inst.note ? [inst.note] : [])],
    unit_audit: context.unit_audit || null,
    unit_system: 'semester',
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
    const skipped = [];
    const coverage = [];

    for (const inst of list) {
      const file = path.join(REQS, `${inst.slug}.json`);
      if (!fs.existsSync(file)) { skipped.push({ slug: inst.slug, why: 'no extraction file' }); continue; }
      const extract = JSON.parse(fs.readFileSync(file, 'utf8'));

      const verdict = extract.validation ? extract.validation.verdict : 'n/a';
      if (verdict === 'fail' && !opts.allowFailed) {
        skipped.push({ slug: inst.slug, why: `validation ${verdict}` });
        coverage.push(coverageRow(inst, extract, false));
        continue;
      }

      const doc = toDocument(extract, inst, creditsByCode);
      doc.acceptance = validateDegreeAcceptance(doc, {
        institutionLevel: inst.level,
        resolveCourse: acceptanceResolver(doc, creditsByCode),
      });
      if (doc.acceptance.ready_for_analysis) doc.collection_status = 'analysis_ready';
      else if (doc.acceptance.accepted) doc.collection_status = 'catalog_accepted';
      const prior = existing.get(doc._id);
      const priorHash = prior && prior.provenance && prior.provenance.source_bundle_hash;
      const nextHash = doc.provenance.source_bundle_hash;
      const sourceChanged = Boolean(prior && prior.verification && prior.verification.verified && priorHash !== nextHash);
      if (sourceChanged) {
        // A human verified specific captured bytes. A new catalog bundle is a
        // new claim, so retain the old audit trail but never silently stamp the
        // replacement as verified.
        doc.verification = {
          verified: false,
          verified_by: null,
          verified_at: null,
          notes: null,
          stale: true,
          stale_reason: 'official source bundle changed after verification',
          previous: prior.verification,
        };
        doc.research_status = 'source_changed_needs_human_reverification';
      } else {
        doc.verification = prior && prior.verification
          ? prior.verification
          : { verified: false, verified_by: null, verified_at: null, notes: null };
      }
      if (!sourceChanged && prior && prior.verification && prior.verification.verified) {
        doc.research_status = prior.research_status || 'unverified';
      }
      docs.push(doc);
      coverage.push(coverageRow(inst, extract, doc.status === 'extracted', doc));
    }

    const as = docs.filter((d) => d.kind === 'as_degree');
    const bs = docs.filter((d) => d.kind === 'degree');
    const groupsTotal = docs.reduce((n, d) => n + d.requirement_groups.length, 0);
    const receiversTotal = docs.reduce((n, d) => n + d.requirement_groups.reduce((m, g) => m + g.sections.reduce((k, s) => k + s.receivers.length, 0), 0), 0);

    log(`documents: ${docs.length} (AS ${as.length}, BS ${bs.length})`);
    log(`requirement groups: ${groupsTotal} · receivers: ${receiversTotal}`);
    log(`flat (single-group) documents: ${docs.filter((d) => d.requirement_groups.length === 1).length}`);
    if (skipped.length) log(`skipped ${skipped.length}: ${skipped.map((s) => `${s.slug} (${s.why})`).join(', ')}`);

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

    // Documents for institutions the registry renamed. Left in place they
    // duplicate a school under two names in the console rails.
    const retired = list.flatMap((i) => (i.retires || []).flatMap((s) => [`va:as:${s}:cs`, `va:degree:${s}:cs`]));
    if (retired.length) {
      const res = await db.collection('va_requirements').deleteMany({ _id: { $in: retired } });
      if (res.deletedCount) log(`retired ${res.deletedCount} document(s) under superseded institution names`);
    }

    await db.collection('va_coverage').deleteMany({ _id: { $regex: '^va:cov:' } });
    if (coverage.length) await db.collection('va_coverage').insertMany(coverage, { ordered: false });
    log(`coverage: ${coverage.length} rows · offering CS ${coverage.filter((c) => c.offers_cs).length} · collected ${coverage.filter((c) => c.collected).length}`);
  } finally {
    await client.close();
  }
}

/** One coverage row: does this institution offer CS, and did we collect it. */
function coverageRow(inst, extract, collected, doc = null) {
  return {
    _id: `va:cov:${isCC(inst.level) ? 'cc' : 'uni'}:${inst.slug}`,
    institution: inst.name,
    level: inst.level,
    offers_cs: extract.offers_cs !== false,
    vccs_slug: inst.vccs_slug || null,
    registry_url: inst.catalog_root || null,
    source_url: extract.source_url || null,
    outcome: extract.outcome,
    validation: extract.validation ? extract.validation.verdict : null,
    catalog_accepted: doc ? doc.acceptance.accepted : false,
    analysis_ready: doc ? doc.acceptance.ready_for_analysis : false,
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
  canonicalSections,
  courseTitles,
  receiversForRow,
  requirementGroups,
  sourceBundleHash,
  toDocument,
};
