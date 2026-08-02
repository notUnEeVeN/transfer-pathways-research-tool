#!/usr/bin/env node
/**
 * Import Transfer Virginia course equivalencies into Mongo.
 *
 * Scope is deliberately two collections — `va_courses` and `va_institutions` —
 * kept under their own `va_` prefix so nothing can be confused with the ASSIST
 * corpus in the same database.
 *
 * The destination is stated explicitly and logged before any write. An earlier
 * import in this project wrote to the shared research cluster because
 * `scripts/.env` set `TARGET_MONGO_URI` and the script silently preferred it, so
 * `--uri`/`--db` beat every environment variable here and the resolved target is
 * printed whether or not it was overridden.
 *
 * Usage:
 *   node scripts/importVirginiaCourses.js --uri mongodb://localhost:27017 --db pmt_research
 *   node scripts/importVirginiaCourses.js --codes CSC221,CSC222 --dry-run
 *   node scripts/importVirginiaCourses.js --crosscheck 20      # validate the invariant
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { VirginiaClient } = require('../services/virginia/fetch');
const {
  parseCoursePage, parseCourseSearch, queryForm, crossCheck,
} = require('../services/virginia/courseEquivalency');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

const opts = {
  uri: val('--uri'),
  dbName: val('--db'),
  codes: val('--codes'),
  scopeFile: val('--scope', path.join(__dirname, '..', '.va-degrees', 'cs_course_scope.json')),
  crosscheck: Number(val('--crosscheck', 0)),
  limit: Number(val('--limit', 0)),
  delayMs: Number(val('--delay', 2500)),
  dryRun: has('--dry-run'),
  refresh: has('--refresh'),
};

const log = (...a) => console.log('[va:courses]', ...a);

/** Community college vs four-year, from the name. Richard Bland is two-year. */
function levelOf(name) {
  if (/community college/i.test(name)) return 'community_college';
  if (/^Richard Bland/i.test(name)) return 'community_college';
  return 'four_year';
}

function courseCodes() {
  if (opts.codes) return opts.codes.split(',').map((c) => queryForm(c)).filter(Boolean);
  if (!fs.existsSync(opts.scopeFile)) {
    throw new Error(`no scope file at ${opts.scopeFile} — pass --codes, or generate the scope first`);
  }
  const scope = JSON.parse(fs.readFileSync(opts.scopeFile, 'utf8'));
  return scope.map((s) => queryForm(s.code)).filter(Boolean);
}

async function fetchCourse(client, code, { renderings = 1 } = {}) {
  const search = await client.get(`/courses?query=${encodeURIComponent(code)}`);
  if (!search) return { code, ok: false, reason: 'search_failed', parsed: [] };
  const guids = parseCourseSearch(search);
  if (!guids.length) return { code, ok: false, reason: 'no_results', parsed: [] };

  const parsed = [];
  for (const guid of guids.slice(0, Math.max(1, renderings))) {
    const html = await client.get(`/course/${guid}`);
    if (!html) continue;
    const p = parseCoursePage(html, { url: `https://www.transfervirginia.org/course/${guid}` });
    // The search is fuzzy enough to return neighbours; keep only exact matches
    // so a request for CSC221 can never be satisfied by CSC222's page.
    if (p.code === code) parsed.push({ ...p, guid });
  }
  if (!parsed.length) return { code, ok: false, reason: 'no_exact_match', guid_count: guids.length, parsed: [] };
  return { code, ok: true, guid_count: guids.length, parsed };
}

/** One canonical course doc, with the sending-college supply set folded in. */
function toDoc(code, parsed) {
  const base = parsed[0];
  const offeredBy = new Set();
  const fourYear = new Map();
  const unknown = [];
  for (const p of parsed) {
    if (p.institution) offeredBy.add(p.institution);
    for (const e of p.equivalencies) {
      if (e.level === 'two_year') offeredBy.add(e.institution);
      else if (e.level === 'four_year' && !fourYear.has(e.institution)) fourYear.set(e.institution, e);
      else if (!e.level) unknown.push(e);
    }
  }
  const four = [...fourYear.values()].sort((a, b) => a.institution.localeCompare(b.institution));
  return {
    _id: `va:crs:${code}`,
    source: 'transferva',
    code,
    title: base.title,
    credits: base.credits,
    credits_raw: base.credits_raw,
    department: base.department,
    description: base.description,
    source_url: base.source_url,
    renderings: parsed.map((p) => ({ institution: p.institution, guid: p.guid, url: p.source_url })),
    offered_by: [...offeredBy].sort(),
    articulates_to: four.map((e) => ({
      institution: e.institution,
      identifier: e.identifier,
      name: e.name,
      notes: e.notes,
    })),
    unrecognised_levels: unknown,
    counts: {
      offered_by: offeredBy.size,
      four_year: four.length,
      with_notes: four.filter((e) => e.notes).length,
    },
    imported_at: new Date(),
  };
}

async function write(docs, institutions) {
  const uri = opts.uri || process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = opts.dbName || process.env.DB_NAME || 'pmt_research';
  log(`writing to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${dbName}`);
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    // Staged, then renamed over the live names, so a failed run never leaves a
    // half-written collection in place of a good one.
    for (const [name, rows] of [['va_courses', docs], ['va_institutions', institutions]]) {
      const staging = `${name}__staging`;
      await db.collection(staging).drop().catch(() => {});
      if (rows.length) await db.collection(staging).insertMany(rows, { ordered: false });
      await db.collection(staging).rename(name, { dropTarget: true });
      log(`  ${name}: ${rows.length} docs`);
    }
    await db.collection('va_courses').createIndex({ code: 1 }, { unique: true });
    await db.collection('va_courses').createIndex({ 'articulates_to.institution': 1 });
    await db.collection('va_courses').createIndex({ offered_by: 1 });
  } finally {
    await client.close();
  }
}

(async () => {
  let codes = courseCodes();
  if (opts.limit) codes = codes.slice(0, opts.limit);
  const client = new VirginiaClient({
    cacheDir: path.join(__dirname, '..', '.virginia-courses'),
    delayMs: opts.delayMs,
    concurrency: 1,
    refresh: opts.refresh,
  });
  log(`${codes.length} course codes · delay ${opts.delayMs}ms · cache ${client.cacheDir}`);

  const docs = [];
  const failures = [];
  const conflicts = [];
  for (const [i, code] of codes.entries()) {
    const renderings = i < opts.crosscheck ? 3 : 1;
    const r = await fetchCourse(client, code, { renderings });
    if (!r.ok) { failures.push({ code, reason: r.reason }); continue; }
    if (r.parsed.length > 1) {
      const cc = crossCheck(r.parsed);
      if (!cc.consistent) conflicts.push({ code, ...cc });
    }
    docs.push(toDoc(code, r.parsed));
    if ((i + 1) % 25 === 0) {
      log(`  ${i + 1}/${codes.length} · ${docs.length} ok · ${failures.length} failed · cache ${client.stats.hits}h/${client.stats.misses}m · blocked ${client.stats.blocked}`);
    }
  }

  const institutions = [...new Map(
    docs.flatMap((d) => [
      ...d.offered_by.map((n) => [n, { name: n, level: levelOf(n) }]),
      ...d.articulates_to.map((e) => [e.institution, { name: e.institution, level: levelOf(e.institution) }]),
    ])
  ).values()].map((inst) => ({
    _id: `va:inst:${inst.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    source: 'transferva',
    ...inst,
    course_count: docs.filter((d) => d.offered_by.includes(inst.name)).length,
    receives_count: docs.filter((d) => d.articulates_to.some((e) => e.institution === inst.name)).length,
    imported_at: new Date(),
  })).sort((a, b) => a.name.localeCompare(b.name));

  log('');
  log(`courses: ${docs.length} · failed: ${failures.length}`);
  log(`institutions: ${institutions.length} (${institutions.filter((i) => i.level === 'community_college').length} CC, ${institutions.filter((i) => i.level === 'four_year').length} four-year)`);
  log(`fetch: ${client.stats.hits} cached, ${client.stats.misses} fetched, ${client.stats.errors} errors, ${client.stats.blocked} WAF-blocked`);
  const unk = docs.flatMap((d) => d.unrecognised_levels);
  log(`cross-check: ${opts.crosscheck} codes with multiple renderings · ${conflicts.length} inconsistent`);
  if (conflicts.length) log('  conflicts:', JSON.stringify(conflicts.slice(0, 5), null, 1));
  if (unk.length) log(`unrecognised level tags: ${unk.length}`);
  if (failures.length) {
    const by = {};
    for (const f of failures) by[f.reason] = (by[f.reason] || 0) + 1;
    log('failure reasons:', JSON.stringify(by));
    log('  sample:', failures.slice(0, 12).map((f) => f.code).join(' '));
  }

  const out = path.join(__dirname, '..', '.virginia-courses', 'import-report.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ docs: docs.length, failures, conflicts, stats: client.stats }, null, 1));
  log(`report: ${out}`);

  if (opts.dryRun) { log('dry run — nothing written'); return; }
  await write(docs, institutions);
  log('done');
})().catch((e) => { console.error('[va:courses] FATAL', e); process.exit(1); });
