#!/usr/bin/env node
/**
 * Turn captured Virginia catalog pages into requirement trees.
 *
 * Reads `.va-catalogs/pages/` (written by captureVirginiaCatalogs.js) and
 * writes one reviewable tree per institution to `.va-catalogs/requirements/`.
 * Nothing here touches the network or the database: extraction is a pure
 * function of the captured bytes, so a parser change can be re-run against the
 * same corpus and diffed.
 *
 * Every tree is validated before it is written, and the verdict is written into
 * the file. `fail` means the tree is not trustworthy and the institution needs
 * a hand read — the import step refuses those, so a bad parse cannot reach the
 * console by being ignored.
 *
 * Hand-authored trees live in the same directory with `"hand_read": true` and
 * are never overwritten by a re-run. That is the whole handoff: the machine
 * does what it can check, a person does the rest, and both end up in one place
 * in one shape.
 *
 * Usage:
 *   node scripts/extractVirginiaRequirements.js
 *   node scripts/extractVirginiaRequirements.js --only tcc,germanna
 *   node scripts/extractVirginiaRequirements.js --uri <mongo>   # registry check
 *   node scripts/extractVirginiaRequirements.js --report        # no writes
 */
const fs = require('node:fs');
const path = require('node:path');

const { parseTextProgram } = require('../services/virginia/catalogParse/lines');
const { parseCourseLeafProgram } = require('../services/virginia/catalogParse/courseleaf');
const { validateTree } = require('../services/virginia/catalogParse/validate');
const { narrowToProgram } = require('../services/virginia/catalogParse/pdf');
const {
  buildLayerCoverage,
  buildSourceRegistry,
  extractCatalogYear,
  sourceIdForRole,
} = require('../services/virginia/catalogSources');

const CAT = path.join(__dirname, '..', '.va-catalogs');
const PAGES = path.join(CAT, 'pages');
const OUT = path.join(CAT, 'requirements');
const CODE_CACHE = path.join(CAT, 'va_course_codes.json');

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const opts = {
  only: (val('--only') || '').split(',').map((s) => s.trim()).filter(Boolean),
  uri: val('--uri'),
  report: flag('--report'),
  force: flag('--force'),
};
const log = (...a) => console.log('[va:extract]', ...a);

/**
 * VCCS course codes, cached to disk.
 *
 * Refreshed when a Mongo URI is passed and reused offline otherwise, so
 * re-parsing never depends on the database being reachable.
 */
async function loadKnownCodes() {
  if (opts.uri) {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(opts.uri);
    await client.connect();
    try {
      const db = client.db(process.env.DB_NAME || 'pmt_research');
      const codes = await db.collection('va_courses').distinct('code');
      fs.writeFileSync(CODE_CACHE, JSON.stringify(codes.sort(), null, 0));
      log(`course registry: ${codes.length} VCCS codes (cached)`);
      return new Set(codes);
    } finally { await client.close(); }
  }
  if (fs.existsSync(CODE_CACHE)) {
    const codes = JSON.parse(fs.readFileSync(CODE_CACHE, 'utf8'));
    log(`course registry: ${codes.length} VCCS codes (from cache)`);
    return new Set(codes);
  }
  log('course registry: unavailable — skipping the resolve check');
  return null;
}

/** CourseLeaf keeps its structure in markup; everything else is read as text. */
function parseFor(institution, page, files) {
  if (institution.platform === 'courseleaf' && files.html) {
    const configured = institution.courseleaf_parse || {};
    const tree = parseCourseLeafProgram(files.html, {
      programTitle: page.title || null,
      requirementsSelector: configured.requirements_selector || null,
      excludeSelectors: configured.exclude_selectors || [],
      excludePlanGridsWhenCourseLists: configured.exclude_plan_grids_when_course_lists === true,
    });
    // A missing configured scope is a source-contract failure. Keep its empty
    // tree and marker so validation blocks it; falling through to the flat text
    // parser would hide the stale selector and may ingest sibling plan tabs.
    if (tree.parse_error) return { tree, parser: 'courseleaf' };
    // A CourseLeaf page that yields nothing is usually a department page served
    // from the catalog host — fall back rather than reporting an empty degree.
    if (tree.groups.length) return { tree, parser: 'courseleaf' };
  }

  // A whole-catalog PDF holds every program the college offers. Parsing it
  // unnarrowed attributes the entire catalog to Computer Science.
  if (institution.platform === 'pdf') {
    const window = narrowToProgram(files.text, institution.pdf_parse || {});
    const tree = parseTextProgram(window.text, { programTitle: page.title || null });
    return {
      tree,
      parser: 'pdf',
      window: {
        found: window.found,
        mode: window.mode || null,
        start: window.start,
        end: window.end,
        start_page: window.start_page,
        end_page: window.end_page,
        lines: window.lines || 0,
        reason: window.reason,
        evidence: window.evidence || null,
        missing_evidence: window.missing_evidence || [],
      },
    };
  }

  return { tree: parseTextProgram(files.text, { programTitle: page.title || null }), parser: 'lines' };
}

/** Official-source registry and layer coverage retained beside every tree. */
function sourceContext(institution, capture, { pagesDir = PAGES } = {}) {
  const sources = buildSourceRegistry(institution, capture);
  const texts = ((capture && capture.pages) || []).map((page) => {
    if (!page.file) return '';
    const file = path.join(pagesDir, `${page.file}.txt`);
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  });
  const configured = institution.degree_context || {};
  const catalogYear = configured.catalog_year
    || texts.map(extractCatalogYear).find(Boolean)
    || null;
  return {
    catalog_year: catalogYear,
    degree_context: { ...configured, catalog_year: catalogYear },
    sources,
    source_layers: buildLayerCoverage(institution, sources),
  };
}

/**
 * Requirement-bearing capture roles are a registry contract, not a naming
 * convention. Most institutions use only `program`; Reynolds deliberately
 * declares `program` plus `program_ba` because the two official destination
 * maps are materially different curricula.
 */
function requirementBearingRoles(institution) {
  const configured = institution?.degree_context?.layers?.major?.source_roles;
  const roles = Array.isArray(configured) ? configured.filter(Boolean) : [];
  return [...new Set(roles.length ? roles : ['program'])];
}

/** One successful capture per configured program role, in registry order. */
function requirementBearingPages(institution, capture) {
  const pages = Array.isArray(capture?.pages) ? capture.pages : [];
  return requirementBearingRoles(institution).flatMap((role) => {
    const page = pages.find((candidate) => candidate?.role === role
      && candidate.has_requirements === true
      && candidate.file
      && candidate.status >= 200
      && candidate.status < 300);
    return page ? [page] : [];
  });
}

function readCapturedFiles(page, { pagesDir = PAGES } = {}) {
  const base = path.join(pagesDir, page.file || '');
  return {
    html: fs.existsSync(`${base}.html`) ? fs.readFileSync(`${base}.html`, 'utf8') : null,
    text: fs.existsSync(`${base}.txt`) ? fs.readFileSync(`${base}.txt`, 'utf8') : '',
  };
}

/** Match a captured page back to its stable source-registry ID. */
function sourceRefForPage(page, sources = []) {
  const sameRole = sources.filter((source) => source.role === page.role);
  const exact = sameRole.find((source) => source.requested_url === page.requested_url)
    || sameRole.find((source) => source.url === page.final_url)
    || sameRole[0];
  return exact?.id || sourceIdForRole(page.role);
}

/**
 * Parse every configured requirement-bearing source into an independent tree.
 * Nothing here chooses between variants or merges their groups. That decision
 * belongs to the cited degree-composition stage.
 */
function extractRequirementVariants(institution, capture, {
  knownCodes = null,
  sources = null,
  readFiles = readCapturedFiles,
  pagesDir = PAGES,
} = {}) {
  const sourceRegistry = sources || buildSourceRegistry(institution, capture);
  return requirementBearingPages(institution, capture).map((page) => {
    const files = readFiles(page, { pagesDir }) || { html: null, text: '' };
    const { tree, parser, window } = parseFor(institution, page, files);
    const validation = validateTree(tree, {
      sourceText: files.text || '',
      knownCodes: institution.level === 'community_college' ? knownCodes : null,
      level: institution.level,
    });
    return {
      key: page.role,
      source_role: page.role,
      source_ref: sourceRefForPage(page, sourceRegistry),
      source_url: page.final_url || page.requested_url || null,
      requested_url: page.requested_url || null,
      capture_sha256: page.sha256 || null,
      capture_file: page.file,
      parser,
      pdf_window: window || null,
      tree: {
        program_title: tree.program_title || null,
        parse_error: tree.parse_error || null,
        total_credits: tree.total_credits,
        stopped_at: tree.stopped_at,
        groups: tree.groups,
        narrative: tree.narrative,
        unassigned: tree.unassigned,
      },
      validation,
    };
  });
}

/** A neutral wrapper that blocks accidental AND-flattening of variant trees. */
function validationForVariantSet(variants, { expectedRoles = variants.map((variant) => variant.source_role) } = {}) {
  const failed = variants.filter((variant) => variant.validation?.verdict === 'fail');
  const warned = variants.filter((variant) => variant.validation?.verdict === 'warn');
  const capturedRoles = new Set(variants.map((variant) => variant.source_role));
  const missingRoles = expectedRoles.filter((role) => !capturedRoles.has(role));
  const blocked = failed.length > 0 || missingRoles.length > 0;
  return {
    verdict: blocked ? 'fail' : 'warn',
    needs_hand_read: blocked,
    checks: [{
      severity: blocked ? 'fail' : 'warn',
      name: 'multiple_program_variants_preserved',
      detail: missingRoles.length
        ? `requirement-bearing source role(s) are missing: ${missingRoles.join(', ')}`
        : `${variants.length} requirement-bearing program sources were parsed separately; a cited composition must select or relate them`,
      source_roles: variants.map((variant) => variant.source_role),
      expected_source_roles: expectedRoles,
      missing_source_roles: missingRoles,
      failed_source_roles: failed.map((variant) => variant.source_role),
      warned_source_roles: warned.map((variant) => variant.source_role),
    }],
    stats: {
      groups: 0,
      sections: 0,
      rows: 0,
      course_rows: 0,
      category_rows: 0,
      distinct_courses: 0,
      credit_span: { min: 0, max: 0, groups_with_credits: 0 },
      stated_total: null,
      variants: variants.length,
      missing_variants: missingRoles.length,
      variant_stats: variants.map((variant) => ({
        source_role: variant.source_role,
        source_ref: variant.source_ref,
        verdict: variant.validation?.verdict || null,
        ...variant.validation?.stats,
      })),
    },
  };
}

function missingVariantValidation(institution) {
  const roles = requirementBearingRoles(institution);
  return {
    verdict: 'fail',
    needs_hand_read: true,
    checks: [{
      severity: 'fail',
      name: 'configured_program_sources_missing',
      detail: `no successful requirement-bearing capture for configured role(s): ${roles.join(', ')}`,
      source_roles: roles,
    }],
    stats: {
      groups: 0,
      sections: 0,
      rows: 0,
      course_rows: 0,
      category_rows: 0,
      distinct_courses: 0,
      credit_span: { min: 0, max: 0, groups_with_credits: 0 },
      stated_total: null,
      variants: 0,
    },
  };
}

/** Build one captured artifact without selecting semantics between source variants. */
function buildCapturedDocument(institution, capture, {
  knownCodes = null,
  pagesDir = PAGES,
  readFiles = readCapturedFiles,
  context = null,
  extractedAt = new Date().toISOString(),
} = {}) {
  const source = context || sourceContext(institution, capture, { pagesDir });
  const expectedRoles = requirementBearingRoles(institution);
  const variants = extractRequirementVariants(institution, capture, {
    knownCodes,
    sources: source.sources,
    pagesDir,
    readFiles,
  });
  const primary = variants[0] || null;
  const common = {
    slug: institution.slug,
    name: institution.name,
    level: institution.level,
    platform: institution.platform,
    outcome: 'captured',
    offers_cs: true,
    source_url: primary?.source_url || null,
    ...source,
    captured_at: capture.captured_at,
    extracted_at: extractedAt,
  };

  if (!primary) {
    return {
      ...common,
      parser: null,
      pdf_window: null,
      program_title: institution.degree_context?.program || capture.discovery?.title || null,
      parse_error: {
        code: 'configured_program_sources_missing',
        source_roles: requirementBearingRoles(institution),
      },
      total_credits: null,
      stopped_at: null,
      groups: [],
      narrative: [],
      unassigned: [],
      validation: missingVariantValidation(institution),
    };
  }

  if (expectedRoles.length === 1 && variants.length === 1) {
    return {
      ...common,
      parser: primary.parser,
      pdf_window: primary.pdf_window,
      source_role: primary.source_role,
      source_ref: primary.source_ref,
      program_title: primary.tree.program_title || capture.discovery?.title || null,
      parse_error: primary.tree.parse_error,
      total_credits: primary.tree.total_credits,
      stopped_at: primary.tree.stopped_at,
      groups: primary.tree.groups,
      narrative: primary.tree.narrative,
      unassigned: primary.tree.unassigned,
      validation: primary.validation,
    };
  }

  return {
    ...common,
    parser: 'variant_set',
    pdf_window: null,
    program_title: institution.degree_context?.program || capture.discovery?.title
      || primary.tree.program_title || null,
    parse_error: null,
    total_credits: null,
    stopped_at: null,
    groups: [],
    narrative: [],
    unassigned: [],
    requirement_variants: {
      schema_version: 1,
      // Capture proves that these role-specific trees coexist, not how a
      // student chooses between them. Composition must supply that relation.
      relationship: null,
      flattened: false,
      selection_rule: null,
      source_roles: expectedRoles,
      captured_source_roles: variants.map((variant) => variant.source_role),
      missing_source_roles: expectedRoles.filter((role) => !variants.some((variant) => variant.source_role === role)),
      items: variants,
    },
    validation: validationForVariantSet(variants, { expectedRoles }),
  };
}

/**
 * A non-capture can still be a completed catalog finding. Keep its official
 * source registry and the registry-authored explanation instead of reducing it
 * to an untraceable boolean that a forced extraction would overwrite.
 */
function buildUnavailableDocument(institution, capture, {
  context = sourceContext(institution, capture),
  extractedAt = new Date().toISOString(),
} = {}) {
  const outcome = capture ? capture.outcome : 'not_captured';
  return {
    slug: institution.slug,
    name: institution.name,
    level: institution.level,
    platform: institution.platform,
    outcome,
    source_url: capture?.pages?.[0]?.final_url
      || institution.seeds?.[0]?.url
      || institution.catalog_root,
    offers_cs: outcome === 'no_cs_program' ? false : null,
    program_title: null,
    program_finding: institution.program_finding || null,
    ...context,
    total_credits: null,
    groups: [],
    validation: { verdict: 'n/a', needs_hand_read: outcome !== 'no_cs_program', checks: [], stats: {} },
    evidence: capture ? capture.discovery : null,
    extracted_at: extractedAt,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const registry = JSON.parse(fs.readFileSync(path.join(CAT, 'institutions.json'), 'utf8'));
  const index = JSON.parse(fs.readFileSync(path.join(PAGES, 'index.json'), 'utf8'));
  const knownCodes = await loadKnownCodes();

  let list = registry.institutions;
  if (opts.only.length) list = list.filter((i) => opts.only.some((o) => i.slug.startsWith(o) || (i.vccs_slug || '') === o));

  const rows = [];
  for (const inst of list) {
    const captured = index[inst.slug];
    const outFile = path.join(OUT, `${inst.slug}.json`);
    const context = sourceContext(inst, captured);

    if (fs.existsSync(outFile) && !opts.force) {
      const existing = JSON.parse(fs.readFileSync(outFile, 'utf8'));
      if (existing.hand_read) {
        rows.push({ slug: inst.slug, level: inst.level, verdict: 'hand', parser: 'hand_read', stats: existing.validation ? existing.validation.stats : {} });
        log(`hand_read      ${inst.slug}`);
        continue;
      }
    }

    if (!captured || captured.outcome !== 'captured') {
      const doc = buildUnavailableDocument(inst, captured, { context });
      if (!opts.report) fs.writeFileSync(outFile, JSON.stringify(doc, null, 1));
      rows.push({ slug: inst.slug, level: inst.level, verdict: doc.outcome, parser: '-', stats: {} });
      log(`${doc.outcome.padEnd(14)} ${inst.slug}`);
      continue;
    }

    const doc = buildCapturedDocument(inst, captured, { knownCodes, context });
    if (!opts.report) fs.writeFileSync(outFile, JSON.stringify(doc, null, 1));

    rows.push({ slug: inst.slug, level: inst.level, verdict: doc.validation.verdict, parser: doc.parser, stats: doc.validation.stats });
    const s = doc.validation.stats;
    log(`${doc.validation.verdict.padEnd(14)} ${inst.slug.padEnd(52)} ${(doc.parser || '-').padEnd(10)} ${s.groups}g ${s.rows}r ${s.distinct_courses}c  credits ${s.credit_span.min}-${s.credit_span.max} vs ${s.stated_total || '?'}`);
  }

  console.log('\n── fidelity ─────────────────────────────────────────────────');
  const tally = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
  console.log(JSON.stringify(tally, null, 1));
  const handRead = rows.filter((r) => r.verdict === 'fail');
  if (handRead.length) {
    console.log(`\n${handRead.length} institution(s) need a hand read:`);
    handRead.forEach((r) => console.log(`  ${r.slug}`));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  buildCapturedDocument,
  buildUnavailableDocument,
  extractRequirementVariants,
  readCapturedFiles,
  requirementBearingPages,
  requirementBearingRoles,
  sourceContext,
  sourceRefForPage,
  validationForVariantSet,
};
