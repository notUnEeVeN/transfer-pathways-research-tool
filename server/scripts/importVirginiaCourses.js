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
 *   node scripts/importVirginiaCourses.js                    # dry run
 *   node scripts/importVirginiaCourses.js --apply --uri mongodb://localhost:27017 --db pmt_research
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
const {
  canonicalCourseCode,
  parentIdForLanding,
  sharedCourseIdentity,
} = require('../services/virginia/courseIdentity');
const { mergeInstitutionRows } = require('../services/virginia/institutionCohorts');

const DEFAULT_SCOPE = path.join(__dirname, '..', '.va-degrees', 'cs_course_scope.json');
const CLI_VALUE_OPTIONS = new Set([
  '--uri', '--db', '--codes', '--scope', '--crosscheck', '--limit', '--delay',
]);
const CLI_BOOLEAN_OPTIONS = new Set(['--apply', '--dry-run', '--refresh']);

/**
 * Parse fail-closed: a bare invocation is a report-only run, and a misspelled
 * flag can never fall through to the database writer. `--dry-run` remains as
 * an explicit/backward-compatible spelling, but Mongo writes require
 * `--apply`.
 */
function optionsFrom(argv = [], env = {}) {
  const values = new Map();
  const booleans = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (CLI_VALUE_OPTIONS.has(argument)) {
      if (values.has(argument)) throw new Error(`${argument} may be supplied only once`);
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      values.set(argument, value);
      index += 1;
      continue;
    }
    if (CLI_BOOLEAN_OPTIONS.has(argument)) {
      if (booleans.has(argument)) throw new Error(`${argument} may be supplied only once`);
      booleans.add(argument);
      continue;
    }
    throw new Error(`unknown option: ${argument}`);
  }

  const apply = booleans.has('--apply');
  if (apply && booleans.has('--dry-run')) {
    throw new Error('--apply and --dry-run are mutually exclusive');
  }
  return {
    uri: values.get('--uri') || env.MONGO_URI || null,
    dbName: values.get('--db') || env.DB_NAME || null,
    codes: values.get('--codes') || null,
    scopeFile: values.get('--scope') || DEFAULT_SCOPE,
    crosscheck: Number(values.get('--crosscheck') || 0),
    limit: Number(values.get('--limit') || 0),
    delayMs: Number(values.get('--delay') || 2500),
    apply,
    dryRun: !apply,
    refresh: booleans.has('--refresh'),
  };
}

const opts = require.main === module
  ? optionsFrom(process.argv.slice(2), process.env)
  : optionsFrom([], {});

const log = (...a) => console.log('[va:courses]', ...a);

/** Community college vs four-year, from the name. Richard Bland is two-year. */
function levelOf(name) {
  if (/community college/i.test(name)) return 'community_college';
  if (/^Richard Bland/i.test(name)) return 'community_college';
  return 'four_year';
}

const isRichardBland = (name) => /^Richard Bland College$/i.test(String(name || '').trim());
const isVccsSharedInstitution = (name) => (
  /community college/i.test(String(name || '')) && !isRichardBland(name)
);

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
  // Search ordering is not namespace-aware: MATH251 currently returns JMU's
  // Database Queries before Richard Bland's Calculus I, and PHYS201 returns a
  // CNU course before any two-year result. Keep walking exact results until we
  // have actual VCCS source evidence instead of blessing the first same-code
  // university page as a VCCS course.
  let vccsRenderings = 0;
  for (const guid of guids) {
    const html = await client.get(`/course/${guid}`);
    if (!html) continue;
    const p = parseCoursePage(html, { url: `https://www.transfervirginia.org/course/${guid}` });
    // The search is fuzzy enough to return neighbours; keep only exact matches
    // so a request for CSC221 can never be satisfied by CSC222's page.
    if (p.code === code) {
      parsed.push({ ...p, guid });
      if (isVccsSharedInstitution(p.institution)) vccsRenderings += 1;
      if (vccsRenderings >= Math.max(1, renderings)) break;
    }
  }
  if (!parsed.length) return { code, ok: false, reason: 'no_exact_match', guid_count: guids.length, parsed: [] };
  return { code, ok: true, guid_count: guids.length, parsed };
}

/** One canonical course doc, with the sending-college supply set folded in. */
function toDoc(code, parsed) {
  const canonical = canonicalCourseCode(code);
  const vccsRenderings = parsed.filter((row) => isVccsSharedInstitution(row.institution));
  const base = vccsRenderings[0] || parsed[0];
  const offeredBy = new Set();
  const fourYear = new Map();
  const unknown = [];
  const excludedIdentityEvidence = [];
  for (const p of parsed) {
    const sourceIsVccs = isVccsSharedInstitution(p.institution);
    if (sourceIsVccs) offeredBy.add(p.institution);
    else if (p.institution) excludedIdentityEvidence.push({
      institution: p.institution,
      role: 'source_rendering',
      reason: isRichardBland(p.institution)
        ? 'institution_local_namespace'
        : 'four_year_same_code_is_not_vccs_identity',
    });
    for (const e of p.equivalencies) {
      if (e.level === 'two_year') {
        // An equivalency row is another institution's course, not proof that
        // it offers the source code. It can corroborate statewide common
        // numbering only when its identifier is exactly the same VCCS code.
        const sameCode = canonicalCourseCode(e.identifier) === canonical;
        if (sameCode && isVccsSharedInstitution(e.institution)) offeredBy.add(e.institution);
        else if (sameCode && isRichardBland(e.institution)) excludedIdentityEvidence.push({
          institution: e.institution,
          role: 'same_code_equivalency',
          reason: 'institution_local_namespace',
        });
      } else if (e.level === 'four_year' && sourceIsVccs) {
        // One VCCS course can land as multiple courses at the same university.
        // Keying only by institution silently dropped the second target (for
        // example ENV121 -> EVPP108 + EVPP109 at George Mason).
        const target = canonicalCourseCode(e.identifier)
          || String(e.name || '').trim().toLowerCase();
        const key = [e.institution, target].join('\u0000');
        if (!fourYear.has(key)) fourYear.set(key, e);
      } else if (!e.level) unknown.push(e);
    }
  }
  // Array#sort is stable: group institutions for deterministic output while
  // preserving Transfer Virginia's source order inside each institution. The
  // first target remains the legacy singular `lands_as` after a refresh.
  const four = [...fourYear.values()].sort((a, b) =>
    a.institution.localeCompare(b.institution));
  const receivingInstitutions = new Set(four.map((e) => e.institution));
  const identity = sharedCourseIdentity(canonical);
  return {
    _id: `va:crs:${code}`,
    course_id: identity.course_id,
    course_key: identity.course_key,
    institution_id: identity.institution_id,
    identity_scope: identity.identity_scope,
    identity_contract: identity.identity_contract,
    vccs_master_applicable: identity.vccs_master_applicable,
    // Import publication filters on this field. A four-year or Richard Bland
    // page with the same code remains reportable evidence, never a sending row.
    sending_eligible: vccsRenderings.length > 0,
    source: 'transferva',
    code: canonical,
    title: base.title,
    credits: base.credits,
    credits_raw: base.credits_raw,
    department: base.department,
    description: base.description,
    source_url: base.source_url,
    renderings: parsed.map((p) => ({ institution: p.institution, guid: p.guid, url: p.source_url })),
    vccs_renderings: vccsRenderings.map((p) => ({
      institution: p.institution, guid: p.guid, url: p.source_url,
    })),
    excluded_identity_evidence: excludedIdentityEvidence,
    offered_by: [...offeredBy].sort(),
    articulates_to: four.map((e) => ({
      institution: e.institution,
      identifier: e.identifier,
      // The receiving-course identity used by four-year degree receivers.
      // Keeping it on the stored equivalency also makes raw Mongo exports as
      // useful as the public API; the controller backfills it for older rows.
      parent_id: parentIdForLanding(e),
      name: e.name,
      notes: e.notes,
    })),
    unrecognised_levels: unknown,
    counts: {
      offered_by: offeredBy.size,
      four_year: receivingInstitutions.size,
      four_year_targets: four.length,
      with_notes: four.filter((e) => e.notes).length,
    },
    imported_at: new Date(),
  };
}

async function write(docs, institutions) {
  const uri = opts.uri || 'mongodb://localhost:27017';
  const dbName = opts.dbName || 'pmt_research';
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
    await db.collection('va_courses').createIndex({ course_id: 1 }, { unique: true });
    await db.collection('va_courses').createIndex({ course_key: 1 }, { unique: true });
    await db.collection('va_courses').createIndex({ 'articulates_to.institution': 1 });
    await db.collection('va_courses').createIndex({ offered_by: 1 });
  } finally {
    await client.close();
  }
}

async function main() {
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
    const doc = toDoc(code, r.parsed);
    if (!doc.sending_eligible) {
      failures.push({
        code,
        reason: 'no_vccs_source_identity',
        observed_at: doc.renderings.map((row) => row.institution),
      });
      continue;
    }
    docs.push(doc);
    if ((i + 1) % 25 === 0) {
      log(`  ${i + 1}/${codes.length} · ${docs.length} ok · ${failures.length} failed · cache ${client.stats.hits}h/${client.stats.misses}m · blocked ${client.stats.blocked}`);
    }
  }

  const corpusInstitutions = [...new Map(
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
  // The equivalency corpus is broader than the public comparison cohort and
  // does not currently emit UVA or VMI rows. Preserve every receiver, collapse
  // known rename aliases, and persist zero-count SCHEV rows so the primary
  // research rail is complete immediately after every refresh.
  const institutions = mergeInstitutionRows(corpusInstitutions);

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

  if (!opts.apply) { log('dry run — nothing written; pass --apply to replace the two Virginia source collections'); return; }
  await write(docs, institutions);
  log('done');
}

module.exports = {
  levelOf,
  isVccsSharedInstitution,
  fetchCourse,
  optionsFrom,
  toDoc,
};

if (require.main === module) {
  main().catch((e) => { console.error('[va:courses] FATAL', e); process.exit(1); });
}
