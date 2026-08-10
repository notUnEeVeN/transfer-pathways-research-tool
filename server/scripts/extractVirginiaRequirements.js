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
    const window = narrowToProgram(files.text);
    const tree = parseTextProgram(window.text, { programTitle: page.title || null });
    return { tree, parser: 'pdf', window: { found: window.found, lines: window.lines || null, reason: window.reason } };
  }

  return { tree: parseTextProgram(files.text, { programTitle: page.title || null }), parser: 'lines' };
}

/** Official-source registry and layer coverage retained beside every tree. */
function sourceContext(institution, capture) {
  const sources = buildSourceRegistry(institution, capture);
  const texts = ((capture && capture.pages) || []).map((page) => {
    if (!page.file) return '';
    const file = path.join(PAGES, `${page.file}.txt`);
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

(async () => {
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
      const outcome = captured ? captured.outcome : 'not_captured';
      const doc = {
        slug: inst.slug,
        name: inst.name,
        level: inst.level,
        platform: inst.platform,
        outcome,
        source_url: captured && captured.pages && captured.pages[0] ? captured.pages[0].final_url : (inst.seeds[0] || {}).url || inst.catalog_root,
        offers_cs: outcome === 'no_cs_program' ? false : null,
        program_title: null,
        ...context,
        total_credits: null,
        groups: [],
        validation: { verdict: 'n/a', needs_hand_read: outcome !== 'no_cs_program', checks: [], stats: {} },
        evidence: captured ? captured.discovery : null,
        extracted_at: new Date().toISOString(),
      };
      if (!opts.report) fs.writeFileSync(outFile, JSON.stringify(doc, null, 1));
      rows.push({ slug: inst.slug, level: inst.level, verdict: outcome, parser: '-', stats: {} });
      log(`${outcome.padEnd(14)} ${inst.slug}`);
      continue;
    }

    const page = captured.pages.find((p) => p.role === 'program' && p.has_requirements) || captured.pages[0];
    const base = path.join(PAGES, page.file || '');
    const files = {
      html: fs.existsSync(`${base}.html`) ? fs.readFileSync(`${base}.html`, 'utf8') : null,
      text: fs.existsSync(`${base}.txt`) ? fs.readFileSync(`${base}.txt`, 'utf8') : '',
    };

    const { tree, parser, window } = parseFor(inst, page, files);
    const validation = validateTree(tree, {
      sourceText: files.text,
      knownCodes: inst.level === 'community_college' ? knownCodes : null,
      level: inst.level,
    });

    const doc = {
      slug: inst.slug,
      name: inst.name,
      level: inst.level,
      platform: inst.platform,
      parser,
      pdf_window: window || null,
      outcome: 'captured',
      offers_cs: true,
      source_url: page.final_url,
      ...context,
      captured_at: captured.captured_at,
      program_title: tree.program_title || (captured.discovery && captured.discovery.title) || null,
      parse_error: tree.parse_error || null,
      total_credits: tree.total_credits,
      stopped_at: tree.stopped_at,
      groups: tree.groups,
      narrative: tree.narrative,
      unassigned: tree.unassigned,
      validation,
      extracted_at: new Date().toISOString(),
    };
    if (!opts.report) fs.writeFileSync(outFile, JSON.stringify(doc, null, 1));

    rows.push({ slug: inst.slug, level: inst.level, verdict: validation.verdict, parser, stats: validation.stats });
    const s = validation.stats;
    log(`${validation.verdict.padEnd(14)} ${inst.slug.padEnd(52)} ${parser.padEnd(10)} ${s.groups}g ${s.rows}r ${s.distinct_courses}c  credits ${s.credit_span.min}-${s.credit_span.max} vs ${s.stated_total || '?'}`);
  }

  console.log('\n── fidelity ─────────────────────────────────────────────────');
  const tally = rows.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
  console.log(JSON.stringify(tally, null, 1));
  const handRead = rows.filter((r) => r.verdict === 'fail');
  if (handRead.length) {
    console.log(`\n${handRead.length} institution(s) need a hand read:`);
    handRead.forEach((r) => console.log(`  ${r.slug}`));
  }
})();
