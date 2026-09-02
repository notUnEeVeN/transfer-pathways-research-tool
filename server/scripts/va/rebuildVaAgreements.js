#!/usr/bin/env node
/**
 * Rebuild Virginia's articulation agreements from published Transfer Guides.
 *
 * What this replaces, and why. The existing `state: 'va'` agreements carry
 * `source: "derived from Transfer Virginia course equivalencies × published
 * degree requirements"` — a join we assembled ourselves between the portal's
 * per-course equivalency tables and each university's catalog requirements.
 * Two things are wrong with it. The equivalency layer disagrees with the
 * universities' own published matrices (12% of comparable rows at George Mason,
 * 30% at Virginia Commonwealth), and it is silent exactly where the major
 * begins — Lynchburg's guide maps CSC 221 to CS 131 while no Lynchburg row for
 * CSC221 appears on the course page at all. A guide is the receiving
 * institution's own statement of the same thing, so it replaces the join
 * outright rather than correcting it. Nothing derived from the old join is kept.
 *
 * Where each half of a cell comes from:
 *
 *   articulation  the guide states what a community-college course becomes.
 *                 That does not vary by college — there is one guide per
 *                 program, not one per college.
 *   supply        the college's own VCCS catalogue says whether it teaches the
 *                 course the guide asks for. This is the only thing that varies
 *                 across colleges, so it is what gives the heatmap its shape.
 *
 * A receiver is a BACHELOR-side requirement, so only requirements live in the
 * denominator. Community-college units that land in elective space are recorded
 * on `guide_elective_landings` and deliberately excluded from the groups: they
 * measure wasted associate credit, which is Figure 3's subject, and the
 * bachelor requirement they fail to satisfy is already present as
 * post-transfer work. Counting both would count one failure twice.
 *
 * Institutions without a guide are dropped, not carried over on the old data.
 * Shenandoah and Virginia State publish no computer-science guide; mixing two
 * cells of discarded provenance beside fourteen good ones is worse than a
 * smaller, honest grid.
 *
 *   node scripts/va/rebuildVaAgreements.js               # dry run, prints the diff
 *   node scripts/va/rebuildVaAgreements.js --apply       # replace state:'va' agreements
 *   node scripts/va/rebuildVaAgreements.js --scheduled   # supply = currently scheduled
 */
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const { outcome, credits } = require('./buildGuideFigures');
const { VA_INSTITUTION_REGISTRY } = require('../../services/virginia/institutionIds');
const { courseIdFor, courseKeyFor, institutionCourseIdFor } = require('../../services/virginia/courseIdentity');

const SERVER = path.resolve(__dirname, '..', '..');
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');
const CATALOG = path.join(SERVER, '.va-courses', 'catalog');

/**
 * University -> the guide that states its computer-science pathway.
 *
 * Written out rather than fuzzy-matched: guides abbreviate ("VCU", "W&M",
 * "RMC"), and a name matcher that half-works silently drops institutions. Where
 * a university publishes several concentrations, the base program stands for
 * the degree — Radford's four concentrations differ downstream of transfer, not
 * in what a community college supplies.
 */
/**
 * University -> every program it publishes a transfer guide for.
 *
 * Written out rather than fuzzy-matched: guides abbreviate ("VCU", "W&M",
 * "RMC", "UL"), and a name matcher that half-works silently drops institutions.
 *
 * The scope is the portal's own computing discipline filter, so it takes the
 * information-technology, cybersecurity and data-science programs alongside
 * computer science rather than second-guessing which of them belongs. Radford's
 * four concentrations and VCU's four are kept as distinct programs for the same
 * reason — the portal publishes them separately, and collapsing them is a
 * decision better made downstream than baked in here.
 */
const MAJOR = 'Computer Science, B.S.';

/**
 * University -> the guide standing for its computer-science pathway.
 *
 * ONE guide per university, and the agreement carries the program name the rest
 * of the corpus already uses. Both constraints come from the same place: the
 * coverage figure joins an agreement to a `curated_requirements` degree
 * document, and those hold exactly one Virginia degree per university, named
 * "Computer Science, B.S.". An agreement under any other name — a guide title,
 * an information-technology or cybersecurity program — has no degree to join to
 * and silently drops the cell. Renaming these to guide titles is what emptied
 * Figure 1; the extra computing guides can be added when degree documents exist
 * for them.
 *
 * Where a university publishes several concentrations, the base program stands
 * for the degree: they differ downstream of transfer, not in what a community
 * college supplies.
 */
const UNIVERSITY_GUIDES = {
  'Bridgewater College': 'bridgewater-computer-science-bs-transfer-guide',
  'Christopher Newport University': 'cnu-computer-foundations-bs-computer-science-transfer-guide',
  'George Mason University': 'george-mason-computer-science-bs-transfer-guide',
  'James Madison University': 'jmu-information-technology-bs-transfer-guide',
  'Longwood University': 'longwood-computer-science-ba-or-bs-transfer-guide',
  'Norfolk State University': 'nsu-computer-science-bs-transfer-guide',
  'Old Dominion University': 'odu-computer-science-bs-transfer-guide',
  'Radford University': 'radford-computer-science-bs-advanced-computer-science-concentration-transfer-guide',
  'Randolph-Macon College': 'rmc-computer-science-bs-transfer-guide',
  "The University of Virginia's College at Wise": 'uva-wise-computer-science-bs-transfer-guide-0',
  'University of Mary Washington': 'umw-computer-science-bs-transfer-guide',
  'Virginia Commonwealth University': 'vcu-computer-science-bs-transfer-guide',
  'Virginia Polytechnic Institute and State University': 'vt-computer-science-bs-transfer-guide',
  'William & Mary': 'wm-computer-science-bs-transfer-guide-0',
};

// Configured with a degree document but no transfer guide, so they carry no
// rebuilt agreements rather than being retained on the superseded join.
const WITHOUT_GUIDE = ['Shenandoah University', 'Virginia State University'];

const APPLIED = new Set(['named_course', 'named_requirement']);
const PREFIX_ALIASES = new Map([['ENGR', 'EGR'], ['HIST', 'HIS'], ['MATH', 'MTH']]);

const resolveCode = (code, universe) => {
  if (universe.has(code)) return code;
  const parts = /^([A-Z]+)(\d.*)$/.exec(code);
  const alias = parts && PREFIX_ALIASES.get(parts[1]);
  const candidate = alias ? `${alias}${parts[2]}` : null;
  return candidate && universe.has(candidate) ? candidate : code;
};

function loadColleges(scheduledOnly) {
  return fs.readdirSync(CATALOG).filter((f) => f.endsWith('.json')).map((f) => {
    const doc = JSON.parse(fs.readFileSync(path.join(CATALOG, f), 'utf8'));
    const courses = scheduledOnly ? doc.courses.filter((c) => c.scheduled) : doc.courses;
    return { slug: doc.slug, name: doc.name, codes: new Set(courses.map((c) => c.code)) };
  });
}

/** One bachelor-side requirement, with the community-college courses that meet it. */
/**
 * The receiving institution's own id for the course a guide names.
 *
 * This is what joins an agreement to a degree document: the degree's receivers
 * carry `receiving.parent_id` for each required course, and the coverage
 * evaluator matches an articulated receiver to a requirement by that id.
 * Leaving it null is why every named requirement scored uncovered — the figure
 * found 24 requirements per cell and articulated none of them. The id is
 * derived, not looked up: institutionCourseIdFor('va:uni:9214', 'CTZN110')
 * reproduces the 1351537251 already stored in Longwood's degree document.
 *
 * A guide cell that names no real course — "Fine Arts and Humanities
 * Requirement", "Elective" — has no receiving course to point at and yields
 * null, which is correct: it satisfies a requirement stated in prose, and the
 * evaluator counts it through the requirement rather than a course id.
 */
function receivingCourseIds(university, equivalent) {
  const text = String(equivalent || '');
  if (!text.trim()) return [];
  // A cell can name several receiving courses — "MATH 164, MATH 280" at
  // Longwood, "APMA 1090 (3 cr.) APMA 2130 (1 cr.)" at UVA. Collapsing the
  // whole cell to one token matched nothing and silently lost the requirement,
  // so every course-shaped token is taken. A trailing wildcard ("ENGL 1XX") is
  // not a course and is left out by the code pattern itself.
  const tokens = text.match(/\b[A-Z]{2,5}\s?\d{3,4}[A-Z]?\b/g) || [];
  const ids = [];
  for (const token of tokens) {
    try {
      const id = institutionCourseIdFor(`va:uni:${university.source_id}`, token.replace(/\s+/g, ''));
      if (id != null && !ids.includes(id)) ids.push(id);
    } catch { /* not a resolvable course code */ }
  }
  return ids;
}

function receiverFor(row, college, universe, receivingId) {
  const isCategory = row.kind === 'gened_category';
  const codes = row.cc_codes.map((code) => resolveCode(code, universe));
  const supplied = isCategory || !codes.length || codes.some((code) => college.codes.has(code));
  return {
    // A general-education category names no course, and every VCCS college
    // teaches the general-education blocks, so it is supplied by construction —
    // an assumption the guide capture flags rather than a catalogue check.
    articulation_status: supplied ? 'articulated' : 'not_articulated',
    not_articulated_reason: supplied ? null : 'course_not_offered_at_college',
    // The completion evaluator is a port of PMT's, and it reads
    // `option.course_ids`. A bare code string satisfies nothing: every receiver
    // scored not-articulated and the whole figure read 0%. Ids are derived
    // deterministically from the course key, so this needs no lookup.
    options: supplied
      ? codes.filter((code) => college.codes.has(code)).map((code) => ({
        course_ids: [courseIdFor(code)],
        course_keys: [courseKeyFor(code)],
        course_conjunction: 'and',
      }))
      : [],
    options_conjunction: 'or',
    hash_id: null,
    tier: 'transferable',
    course_level: 'lower_division',
    cc_articulable: true,
    overlap_key: null,
    note: row.notes || null,
    receiving: {
      kind: outcome(row.equivalent) === 'named_requirement' ? 'requirement' : 'course',
      parent_id: receivingId,
      units: credits(row.credits) ?? 0,
    },
    code_seen: row.equivalent,
    human_review: null,
    // Kept so a cell can say which course cost it, not merely that one did.
    requested_codes: row.cc_codes,
    assumed_supplied: isCategory,
  };
}

/** Bachelor-side work the guide places after the transfer point. */
function postTransferReceiver(item, university) {
  return {
    articulation_status: 'not_articulated',
    not_articulated_reason: 'after_transfer_point',
    options: [],
    options_conjunction: 'or',
    hash_id: null,
    tier: 'nontransferable',
    course_level: 'upper_division',
    cc_articulable: false,
    overlap_key: null,
    note: item.notes || null,
    receiving: {
      kind: 'course',
      parent_id: receivingCourseIds(university, item.requirement_text)[0] ?? null,
      units: credits(item.credits) ?? 0,
    },
    code_seen: item.requirement_text,
    human_review: null,
  };
}

const section = (receivers, over) => ({
  section_advisement: 1,
  unit_advisement: null,
  unit_advisement_max: null,
  label_seen: null,
  tier: 'transferable',
  course_level: 'lower_division',
  cc_articulable: true,
  source_refs: ['transfer_guide'],
  note: null,
  overlap_key: null,
  human_review: null,
  analysis_constraints: [],
  assume_satisfiable: false,
  ...over,
  receivers,
});

function buildAgreement({ university, college, guide, universe }) {
  const rows = guide.cc_items
    .filter((i) => i.counts_toward_stats)
    .map((i) => ({ ...i, outcome: outcome(i.equivalent) }));
  const named = rows.filter((r) => APPLIED.has(r.outcome));
  const elective = rows.filter((r) => r.outcome === 'elective_only' || r.outcome === 'no_credit');
  const post = (guide.post_items || []).filter((p) => p.counts_toward_stats);

  const groups = [
    {
      title: 'Transferable preparation',
      is_required: true,
      group_conjunction: 'And',
      requirement_layer: 'major',
      tier: 'transferable',
      course_level: 'lower_division',
      cc_articulable: true,
      source_refs: ['transfer_guide'],
      note: null,
      overlap_key: null,
      human_review: null,
      analysis_constraints: [],
      stated_credits: guide.totals?.pre_transfer_raw || null,
      distinct_course_ids_across_sections: false,
      // One receiver per receiving course the cell names, so a two-course cell
      // discharges both requirements rather than neither.
      sections: named.map((row) => {
        const ids = receivingCourseIds(university, row.equivalent);
        const targets = ids.length ? ids : [null];
        return section(targets.map((id) => receiverFor(row, college, universe, id)));
      }),
    },
    {
      title: 'Post-transfer requirements',
      is_required: true,
      group_conjunction: 'And',
      requirement_layer: 'major',
      tier: 'nontransferable',
      course_level: 'upper_division',
      cc_articulable: false,
      source_refs: ['transfer_guide'],
      note: 'Coursework the guide places after the transfer point; no community college supplies it.',
      overlap_key: null,
      human_review: null,
      analysis_constraints: [],
      stated_credits: guide.totals?.post_transfer_raw || null,
      distinct_course_ids_across_sections: false,
      sections: post.map((item) => section([postTransferReceiver(item, university)], {
        tier: 'nontransferable', course_level: 'upper_division', cc_articulable: false,
      })),
    },
  ];

  const all = groups.flatMap((g) => g.sections.flatMap((s) => s.receivers));
  return {
    _id: `va:agreement:${university.source_id}:${college.source_id}`,
    university_id: university._id,
    college_id: college._id,
    uc_school_id: university.source_id,
    community_college_id: college.source_id,
    university_name: university.name,
    college_name: college.name,
    major: MAJOR,
    state: 'va',
    source: 'Transfer Virginia published transfer guide × VCCS course catalogue',
    pairing: 'transfer-guide',
    derived_from: {
      guide_slug: guide.slug,
      guide_title: guide.title,
      guide_url: guide.source_url,
      catalogue_source: 'https://courses.vccs.edu',
    },
    articulated_receivers: all.filter((r) => r.articulation_status === 'articulated').length,
    considered_receivers: all.length,
    // Community-college units that land in elective space. Not a bachelor
    // requirement, so not in the groups; retained because Figure 3 needs them.
    guide_elective_landings: elective.map((r) => ({
      requirement_text: r.requirement_text,
      cc_codes: r.cc_codes,
      units: credits(r.credits) ?? 0,
      equivalent: r.equivalent,
      outcome: r.outcome,
    })),
    requirement_groups: groups,
    rebuilt_at: new Date().toISOString(),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const scheduledOnly = process.argv.includes('--scheduled');

  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  const colleges = loadColleges(scheduledOnly);
  const universe = new Set(colleges.flatMap((c) => [...c.codes]));

  const missingGuides = Object.entries(UNIVERSITY_GUIDES)
    .filter(([, slug]) => !bySlug.has(slug)).map(([uni, slug]) => `${uni} -> ${slug}`);
  if (missingGuides.length) throw new Error(`guide slugs not found: ${missingGuides.join('; ')}`);

  const client = await MongoClient.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const db = client.db('pmt_research');
  const institutions = await db.collection('assist_institutions').find({ state: 'va' }).toArray();
  const uniByName = new Map(institutions.filter((i) => i.kind === 'university').map((i) => [i.name, i]));
  const ccRows = institutions.filter((i) => i.kind === 'community_college');
  // The catalogue ledger carries short names ("Blue Ridge") while the
  // institution registry carries full ones ("Blue Ridge Community College").
  // Resolve by unique prefix and fail loudly on ambiguity rather than letting a
  // college silently drop out of the grid.
  const resolveCollege = (shortName) => {
    const needle = shortName.toLowerCase();
    const hits = ccRows.filter((i) => i.name.toLowerCase().startsWith(needle));
    if (hits.length === 1) return hits[0];
    const exact = ccRows.filter((i) => i.name.toLowerCase() === needle);
    if (exact.length === 1) return exact[0];
    throw new Error(`college "${shortName}" matched ${hits.length} institutions: ${hits.map((h) => h.name).join(', ')}`);
  };

  // Universities the guides cover that the projection has never carried. Their
  // ids come from the checked-in registry, never from max+1 — that registry
  // exists precisely because a recomputed id lands on somebody else's school.
  // Allocating here once assigned 9234 to George Washington, which is
  // canonically the University of Virginia.
  const registryByName = new Map(VA_INSTITUTION_REGISTRY
    .filter((r) => r.level === 'four_year').map((r) => [r.name, r]));
  // "New" means absent OR sitting on an id the registry does not sanction —
  // the second case is how the mis-minted rows get corrected rather than kept.
  const newUniversities = Object.keys(UNIVERSITY_GUIDES).filter((n) => {
    const present = uniByName.get(n);
    if (!present) return true;
    const identity = registryByName.get(n);
    return Boolean(identity) && present.source_id !== identity.id;
  });
  const unregistered = newUniversities.filter((n) => !registryByName.has(n));
  if (unregistered.length) {
    throw new Error(`not in services/virginia/institutionIds.js: ${unregistered.join(', ')}. `
      + 'Add a stable id there first; this script must never mint one.');
  }
  const newDocs = newUniversities.map((name) => {
    const identity = registryByName.get(name);
    return {
      _id: `va:uni:${identity.id}`,
      institution_id: `va:uni:${identity.id}`,
      kind: 'university',
      source_id: identity.id,
      name: identity.name,
      state: 'va',
      academic_calendar: 'semester',
      va_institution_id: `va:inst:${identity.slug}`,
    };
  });
  const agreements = [];
  const unmatchedColleges = [];
  for (const doc of newDocs) uniByName.set(doc.name, doc);

  for (const [name, slug] of Object.entries(UNIVERSITY_GUIDES)) {
    const university = uniByName.get(name);
    if (!university) throw new Error(`no institution row for ${name}`);
    for (const college of colleges) {
      let inst;
      try { inst = resolveCollege(college.name); } catch (error) {
        unmatchedColleges.push(`${college.name} (${error.message})`); continue;
      }
      agreements.push(buildAgreement({
        university,
        college: { ...inst, codes: college.codes },
        guide: bySlug.get(slug),
        universe,
      }));
    }
  }

  const existing = await db.collection('assist_agreements').countDocuments({ state: 'va' });
  const pct = (v) => `${(100 * v).toFixed(1)}%`;
  const cov = agreements.reduce((n, a) => n + a.articulated_receivers, 0);
  const tot = agreements.reduce((n, a) => n + a.considered_receivers, 0);

  console.log(`basis            : ${scheduledOnly ? 'scheduled' : 'catalogue'}`);
  console.log(`existing VA rows : ${existing}  (to be discarded)`);
  console.log(`rebuilt rows     : ${agreements.length}  = `
    + `${Object.keys(UNIVERSITY_GUIDES).length} universities × ${colleges.length} colleges`);
  console.log(`dropped          : ${WITHOUT_GUIDE.join(', ')} (publish no guide)`);
  if (newDocs.length) console.log(`new institutions : ${newDocs.map((d) => `${d.name} (${d.source_id})`).join(', ')}`);
  if (unmatchedColleges.length) console.log(`UNMATCHED colleges: ${[...new Set(unmatchedColleges)].join(', ')}`);
  console.log(`receiver coverage: ${cov}/${tot} = ${pct(cov / tot)}`);

  if (!apply) {
    console.log('\ndry run — pass --apply to replace the Virginia agreements');
    await client.close();
    return;
  }

  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      // Drop any four-year row whose id disagrees with the registry. An
      // earlier run of this script minted ids with max+1 and wrote five such
      // rows; leaving them would keep a second identity for schools that
      // already have a canonical one.
      const canonical = new Map(VA_INSTITUTION_REGISTRY
        .filter((r) => r.level === 'four_year').map((r) => [r.name, r.id]));
      const stale = institutions
        .filter((i) => i.kind === 'university' && canonical.has(i.name)
          && canonical.get(i.name) !== i.source_id)
        .map((i) => i._id);
      if (stale.length) {
        await db.collection('assist_institutions').deleteMany({ _id: { $in: stale } }, { session });
        console.log(`removed ${stale.length} institution rows with non-registry ids: ${stale.join(', ')}`);
      }
      if (newDocs.length) await db.collection('assist_institutions').insertMany(newDocs, { session });
      await db.collection('assist_agreements').deleteMany({ state: 'va' }, { session });
      await db.collection('assist_agreements').insertMany(agreements, { session });
    });
    console.log(`\napplied: ${existing} discarded, ${agreements.length} inserted`);
  } finally {
    await session.endSession();
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { UNIVERSITY_GUIDES, buildAgreement, receiverFor };
