#!/usr/bin/env node
/**
 * Import Transfer Virginia associate program maps as corroborating
 * `as_degree`-shaped documents.
 *
 * These maps are intentionally `captured_only`: unenumerated categories and
 * missing catalog-year/college-policy layers mean they are not canonical full
 * degrees and cannot pass the Virginia verification gate. They coexist in
 * `va_requirements` with the source-of-record institution-catalog documents so
 * a researcher can compare the two without either source overwriting the other.
 *
 * ── The one genuine structural difference ────────────────────────────────────
 * California identifies courses by numeric ASSIST ids (`course_ids: [353249]`,
 * `course_keys: ['cc:353249']`). Virginia has no such registry — its courses
 * are identified by the VCCS common code (`CSC221`). To keep `course_ids`
 * numeric, as the schema expects, each code is mapped to a deterministic id in
 * a disjoint range (900,000,000+) that cannot collide with an ASSIST id, and
 * `course_keys` carries the readable `va:CSC221` form. The mapping is written
 * to `va_course_ids` so it is inspectable and stable across re-imports.
 *
 * ── Four-year degrees are deliberately not imported ──────────────────────────
 * The same parser reconciles 14 of 21 associate maps within ±3 credits but only
 * 1 of 16 four-year maps. Transfer Virginia publishes four-year program maps
 * for just 12 of 25 universities, skewed to small privates, and their structure
 * leans on unenumerated category requirements the map never lists. Those are
 * being gathered from institution catalogs instead.
 *
 * Every document carries `catalog_url` (the human-readable program page) and a
 * `reconciliation` block. These maps are corroboration, not hand verification:
 * the institution catalog remains the source of record for the degree.
 */
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { parseDegreeMap, creditReconciliation } = require('../services/virginia/degreeMap');
const { courseIdFor, courseKeyFor } = require('../services/virginia/courseIdentity');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d = null) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};
const opts = {
  uri: val('--uri'),
  dbName: val('--db'),
  cache: val('--cache', path.join(__dirname, '..', '.va-degrees')),
  major: val('--major', 'cs'),
  dryRun: has('--dry-run'),
};
const log = (...a) => console.log('[va:degrees]', ...a);

const BASE = 'https://www.transfervirginia.org';
const isCC = (n) => /community college|Richard Bland/i.test(n || '');

/** Transfer-oriented associate awards only; certificates and A.A.S. are out of scope. */
function eligibleAssociateProgram(name) {
  const value = String(name || '').trim();
  if (!value || /certificate|\bC\.?S\.?C\.?\b|associate\s+(?:of\s+)?applied\s+science|\bA\.?A\.?S\.?\b/i.test(value)) {
    return false;
  }
  return /associate\s+(?:(?:in|of)\s+)?science|associate\s+(?:of\s+)?arts\s*(?:&|and)\s*sciences|\bA\.?S\.?\b|\bAA&S\b/i.test(value);
}

async function writeTransferVirginiaDocuments(db, docs, idMap) {
  // Replace only this importer's corroborating documents. A staging rename of
  // `va_requirements` used to erase every institution-catalog degree.
  await db.collection('va_requirements').deleteMany({ source: 'transferva_program_map' });
  if (docs.length) await db.collection('va_requirements').insertMany(docs, { ordered: false });

  const idStaging = 'va_course_ids__staging';
  await db.collection(idStaging).drop().catch(() => {});
  if (idMap.length) await db.collection(idStaging).insertMany(idMap, { ordered: false });
  await db.collection(idStaging).rename('va_course_ids', { dropTarget: true });
}

const keyOf = (code) => ({ id: courseIdFor(code), key: courseKeyFor(code) });

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A parsed node tree -> canonical `requirement_groups`. */
function toRequirementGroups(groups) {
  const walk = (node) => {
    // A branch becomes a group whose sections are its children; a leaf becomes
    // a single section holding one receiver.
    if (!node.leaf) {
      return {
        group_id: slug(node.title || 'group'),
        template_group: null,
        source: 'extracted',
        confidence: 0.8,
        curated_by: null,
        label_seen: node.title,
        unresolved_courses_seen: [],
        sections: node.children.map((c) => sectionFor(c)),
      };
    }
    return {
      group_id: slug(node.title || 'requirement'),
      template_group: null,
      source: 'extracted',
      confidence: node.kind === 'course' ? 0.8 : 0.4,
      curated_by: null,
      label_seen: node.title,
      unresolved_courses_seen: node.kind === 'unenumerated' && node.rule_text ? [node.rule_text] : [],
      sections: [sectionFor(node)],
    };
  };

  const sectionFor = (node) => ({
    section_advisement: null,
    unit_advisement: node.credits ?? null,
    receivers: [{
      receiving: node.title ? { kind: 'category', parent_id: null, units: node.credits ?? null } : null,
      articulation_status: node.kind === 'course' ? 'articulated' : 'not_articulated',
      not_articulated_reason: node.kind === 'course' ? null
        : node.kind === 'administrative' ? 'administrative_requirement'
        : 'no_course_list_published',
      options: node.options || [],
      options_conjunction: node.options_conjunction || 'or',
      hash_id: null,
    }],
  });

  return groups.map(walk);
}

async function main() {
  const mapsFile = path.join(opts.cache, 'maps_Computer_Science.json');
  if (!fs.existsSync(mapsFile)) throw new Error(`no map index at ${mapsFile}`);
  const index = JSON.parse(fs.readFileSync(mapsFile, 'utf8'))
    .filter((m) => m.map === 'populated' && isCC(m.institution) && eligibleAssociateProgram(m.program));
  log(`${index.length} populated associate maps across ${new Set(index.map((m) => m.institution)).size} colleges`);

  const docs = [];
  const codes = new Set();
  const skipped = [];
  for (const m of index) {
    const f = path.join(opts.cache, `map_${m.degreeId}.json`);
    if (!fs.existsSync(f)) { skipped.push({ ...m, why: 'no cached map' }); continue; }
    const parsed = parseDegreeMap(JSON.parse(fs.readFileSync(f, 'utf8')), { keyOf });
    if (parsed.deferred || !parsed.groups.length) { skipped.push({ ...m, why: 'deferred/empty' }); continue; }
    const rec = creditReconciliation(parsed);

    const collect = (n) => { (n.codes || []).forEach((c) => codes.add(c)); (n.children || []).forEach(collect); };
    parsed.groups.forEach(collect);

    docs.push({
      _id: `va:as:${slug(m.institution)}:${opts.major}:${m.degreeId}`,
      legacy_id: `${slug(m.institution)}:${opts.major}`,
      kind: 'as_degree',
      community_college_id: `va:cc:${slug(m.institution)}`,
      college_id: `va:cc:${slug(m.institution)}`,
      major_slug: opts.major,
      degree_type: /AA&S|AA & S/i.test(m.program) ? 'AA&S' : /\bAA\b/i.test(m.program) ? 'AA' : 'AS',
      template_ref: null,
      status: 'extracted',
      collection_status: 'captured_only',
      research_status: 'corroboration_only_needs_catalog_verification',
      degree_title_seen: m.program,
      catalog_url: `${BASE}/degrees/${m.degreeId}`,
      catalog_year: null,
      unit_system: 'semester',
      total_units: parsed.stats.stated_total ?? null,
      requirement_groups: toRequirementGroups(parsed.groups),
      covered_concepts: [],
      verification: { verified: false, verified_by: null, verified_at: null, notes: null },
      extraction: {
        artifact: `.va-degrees/map_${m.degreeId}.json`,
        confidence: rec.ok ? 0.8 : 0.5,
        needs_browser: false,
        notes: `Parsed from the Transfer Virginia program map. ${parsed.stats.course_leaves} course requirements, `
          + `${parsed.stats.unenumerated} unenumerated, ${parsed.stats.administrative} administrative.`,
      },
      // Not a California field: the credit check this source makes possible.
      // Surfaced so the hand verifier knows which documents to look hard at.
      reconciliation: {
        leaf_credits: parsed.stats.leaf_credits,
        stated_total: parsed.stats.stated_total,
        delta: rec.delta ?? null,
        within_tolerance: rec.ok ?? null,
      },
      source: 'transferva_program_map',
      updated_at: new Date(),
    });
  }

  const idMap = [...codes].sort().map((c) => ({
    _id: `va:crs:${c}`, code: c, course_id: courseIdFor(c), key: courseKeyFor(c),
  }));
  const good = docs.filter((d) => d.reconciliation.within_tolerance).length;
  log(`documents: ${docs.length} · reconciling: ${good} · needing a close look: ${docs.length - good}`);
  log(`distinct courses referenced: ${idMap.length}`);
  if (skipped.length) log(`skipped: ${skipped.length} (${skipped.map((s) => s.why).join(', ')})`);

  if (opts.dryRun) { log('dry run — nothing written'); console.log(JSON.stringify(docs[0], null, 1).slice(0, 900)); return; }

  const uri = opts.uri || process.env.MONGO_URI || 'mongodb://localhost:27017';
  const dbName = opts.dbName || process.env.DB_NAME || 'pmt_research';
  log(`writing to ${uri.replace(/\/\/[^@]*@/, '//<redacted>@')} · db ${dbName}`);
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(dbName);
    await writeTransferVirginiaDocuments(db, docs, idMap);
    log(`  va_requirements (Transfer Virginia only): ${docs.length} docs`);
    log(`  va_course_ids: ${idMap.length} docs`);
    await db.collection('va_requirements').createIndex({ kind: 1, college_id: 1 });
    await db.collection('va_course_ids').createIndex({ course_id: 1 }, { unique: true });
  } finally {
    await client.close();
  }
  log('done');
}

if (require.main === module) main().catch((e) => {
  console.error('[va:degrees] FATAL', e);
  process.exitCode = 1;
});

module.exports = {
  eligibleAssociateProgram,
  main,
  toRequirementGroups,
  writeTransferVirginiaDocuments,
};
