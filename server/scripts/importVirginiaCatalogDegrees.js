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

/**
 * Stable numeric ids for Virginia courses.
 *
 * Virginia has no ASSIST-style registry, so ids are minted from the code. The
 * base keeps them clear of California's real ids, and the hash keeps them
 * stable across runs — a re-import must not renumber the corpus.
 */
const VA_ID_BASE = 900000000;
const courseIdFor = (code) => VA_ID_BASE + (createHash('sha1').update(`va:${code}`).digest().readUInt32BE(0) % 0x0fffffff);

const isCC = (level) => level === 'community_college';

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

/** One parsed row into one canonical receiver. */
function receiverFor(row, { cc, sourceUrl }) {
  const base = {
    articulation_status: null,
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'or',
    hash_id: null,
    tier: 'transferable',
  };

  // A requirement the catalog states without naming courses. Kept as a named
  // receiver rather than dropped: it is real, it consumes credits, and the
  // ledger renders `kind: 'category'` as a titled `Requirement` row.
  if (!(row.codes || []).length) {
    return {
      ...base,
      receiving: { kind: 'category', parent_id: null, name: row.category || row.text, units: row.credits ? row.credits.min : null },
      code_seen: null,
      human_review: 'requirement stated without an enumerated course list',
    };
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
    return {
      ...base,
      receiving: null,
      options,
      options_conjunction: row.conjunction === 'and' ? 'and' : 'or',
      articulation_status: 'articulated',
      code_seen: row.codes.map((c) => c.code).join(row.conjunction === 'and' ? ' + ' : ' / '),
    };
  }

  // Four-year: the university's own course is the requirement. Alternatives
  // become a series so both codes stay visible instead of one being dropped.
  if (row.codes.length > 1 && row.conjunction === 'or') {
    return {
      ...base,
      receiving: {
        kind: 'series',
        conjunction: 'or',
        parent_ids: row.codes.map((c) => courseIdFor(c.code)),
        units: row.credits ? row.credits.min : null,
      },
      code_seen: row.codes.map((c) => c.code).join(' / '),
      source_url: sourceUrl,
    };
  }
  return {
    ...base,
    receiving: { kind: 'course', parent_id: courseIdFor(row.codes[0].code), units: row.credits ? row.credits.min : null },
    code_seen: row.codes[0].code,
  };
}

/** The whole tree into `requirement_groups`. */
function requirementGroups(tree, { cc, sourceUrl, creditsByCode }) {
  return (tree.groups || []).map((group) => {
    const advisement = groupAdvisement(group, creditsByCode);
    return {
      is_required: true,
      group_conjunction: 'And',
      title: group.title,
      tier: 'transferable',
      source_refs: sourceUrl ? [sourceUrl] : [],
      note: group.note || null,
      course_level: null,
      cc_articulable: null,
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
      sections: (group.sections || []).map((section) => ({
        section_advisement: section.choose ?? null,
        unit_advisement: section.credits ? section.credits.min : null,
        label_seen: section.label || null,
        tier: 'transferable',
        source_refs: [],
        note: null,
        course_level: null,
        cc_articulable: null,
        overlap_key: null,
        human_review: null,
        receivers: (section.rows || []).map((row) => receiverFor(row, { cc, sourceUrl })),
      })),
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
  const codes = allCodes(extract);
  const groups = requirementGroups(extract, { cc, sourceUrl: extract.source_url, creditsByCode });
  const captured = extract.outcome === 'captured' && groups.length > 0;

  const status = captured ? 'extracted'
    : extract.outcome === 'no_cs_program' ? 'no_program'
      : 'url_only';

  const base = {
    kind: cc ? 'as_degree' : 'degree',
    major_slug: 'cs',
    source: 'institution_catalog',
    source_method: 'scraped_catalog',
    research_status: 'unverified',
    total_units: extract.total_credits ? extract.total_credits.min : null,
    requirement_groups: groups,
    catalog_platform: inst.platform || null,
    codes_seen: codes,
    course_titles: courseTitles(extract),
    offers_cs: extract.offers_cs !== false,
    // How this document was produced and how far it can be trusted, carried on
    // the document itself so the console never has to guess.
    provenance: {
      parser: extract.parser || null,
      hand_read: extract.hand_read === true,
      captured_at: extract.captured_at || null,
      extracted_at: extract.extracted_at || null,
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
      degree_type: 'AS',
      template_ref: null,
      status,
      degree_title_seen: extract.program_title || 'Computer Science',
      catalog_url: extract.source_url,
      catalog_year: null,
      unit_system: 'semester',
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
    academic_unit: null,
    campus_key: inst.name,
    catalog_year: null,
    college: null,
    data_quality_flags: captured ? [] : ['no_course_list_published'],
    degree_variant: null,
    ge_authority: null,
    ge_model: null,
    ge_variants: [],
    institution_id: `va:uni:${slug}`,
    modeling_notes: inst.note ? [inst.note] : [],
    sources: extract.source_url ? [{ kind: 'catalog', url: extract.source_url, platform: inst.platform || null }] : [],
    unit_audit: null,
    unit_system: 'semester',
  };
}

// ── driver ──────────────────────────────────────────────────────────────────

(async () => {
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
      // A human verdict outlives a re-scrape. Carry it forward rather than
      // resetting every verified degree to unverified on each run.
      const prior = existing.get(doc._id);
      doc.verification = prior && prior.verification
        ? prior.verification
        : { verified: false, verified_by: null, verified_at: null, notes: null };
      if (prior && prior.verification && prior.verification.verified) {
        doc.research_status = prior.research_status || 'unverified';
      }
      docs.push(doc);
      coverage.push(coverageRow(inst, extract, doc.status === 'extracted'));
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
})();

/** One coverage row: does this institution offer CS, and did we collect it. */
function coverageRow(inst, extract, collected) {
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
    collected: Boolean(collected),
  };
}
