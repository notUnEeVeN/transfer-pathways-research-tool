/**
 * Source-bound Figure 3/4 receipts for two receiver-free six-credit GE blocks.
 *
 * The retained Reynolds and Camp trees both carry `distinct_areas: 2`.  The
 * protected operational trees predate the explicit companion constraint now
 * present in the checked-in compositions.  That missing evaluator metadata
 * cannot change either paper unit total: each exact carrier is one fixed
 * six-credit aggregate.  It can change course/prerequisite selection, so this
 * receipt deliberately leaves Figure 6 closed and does not invent a roster.
 */

const { usesCanonicalSourceContract } = require('./canonicalSourceContract');
const {
  associateConflictProofTreeFingerprint,
} = require('./associateCollegeConstraintProofs');

const ALL_ASSOCIATE_FIGURES = Object.freeze(['3', '4', '6']);
const FIGURE_6_ONLY = Object.freeze(['6']);

const PLANS = Object.freeze({
  reynolds: Object.freeze({
    slug: 'j-sargeant-reynolds-community-college',
    numericId: 9307,
    name: 'J Sargeant Reynolds Community College',
    sourceId: 'va:as:j-sargeant-reynolds-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science, A.S. — B.S.-destination requirements',
    totalUnits: 63,
    totalUnitsMax: 63,
    catalogUrl: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4173',
    groupIndex: 5,
    groupTitle: 'B.S.-destination humanities, fine arts, and literature',
    geArea: 'reynolds_ucgs_humanities_fine_arts_literature',
    note: 'Choose the two printed UCGS courses from different discipline areas.',
    categories: Object.freeze(['fine_arts', 'humanities', 'literature']),
    companionDescription:
      'The two aggregate UCGS courses must come from different discipline areas.',
    reviewedTuples: Object.freeze({
      '8db587598e37b7e05ee45be734b461f8528dceb39909c4049aad2bc84a06b65b':
        Object.freeze({
          proofTreeSha256: '8b4732b5c23138dae37cd1f47c5fc392d4b029a21a434382ca3563032497688f',
          companionPresent: false,
          tupleStyle: 'protected_operational',
        }),
      '5d520c60b011fbec1b29ca9163018d916c535cd7f55a23662fc81e1c0d666278':
        Object.freeze({
          proofTreeSha256: '8c61256e4fba34e427a7bd1c5a174eb7d6e8c5fbc40f130138dc5bbfe82b8a1e',
          companionPresent: true,
          tupleStyle: 'checked_in_candidate',
        }),
    }),
    sources: Object.freeze([
      Object.freeze({
        id: 'catalog', role: 'catalog', kind: 'catalog', secure: true,
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4051&returnto=1496',
        requestedUrl: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4051&returnto=1496',
        sha256: 'f5d1f8c2901d54fa6ec09bfff231ccd7bed99a3a7f614f4aa5e2793995db7c1d',
      }),
      Object.freeze({
        id: 'major', role: 'program', kind: 'major', secure: true,
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4173',
        requestedUrl: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4173',
        sha256: '260a0254b8b4e1f7ff1f192d7de012261d7380a3d8e69034b1572f27dbf8e428',
      }),
      Object.freeze({
        id: 'program_ba', role: 'program_ba', kind: 'program_ba', secure: true,
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4134',
        requestedUrl: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=4134',
        sha256: '63cfd5ca341711f14957e36ae705e9aa51ce02b00c3a2f04128551eba2e540a0',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education', secure: true,
        url: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=3925',
        requestedUrl: 'https://catalog.reynolds.edu/preview_program.php?catoid=13&poid=3925',
        sha256: '1a043a2af888973343ddf2ac10ab1fb22b6357167388891514021ba097743d73',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation', secure: true,
        url: 'https://catalog.reynolds.edu/content.php?catoid=13&navoid=1487#classroom-graduation-and-program-requirements',
        requestedUrl: 'https://catalog.reynolds.edu/content.php?catoid=13&navoid=1487#classroom-graduation-and-program-requirements',
        sha256: '7556bdfa40d6cdda1e4e08d4e8d245d20ab06dced04460acef21c4af87fdc7fe',
      }),
      Object.freeze({
        id: 'college', role: 'college', kind: 'college', secure: true,
        url: 'https://www.reynolds.edu/programs/program-pages/computer-science-as.html',
        requestedUrl: 'https://www.reynolds.edu/programs/program-pages/computer-science-as.html',
        sha256: '861dc9107b88a338e5edd5e8b87df1109b91fdbaebd4acfa175bc6afb6cebeb4',
      }),
      Object.freeze({
        id: 'college_2', role: 'college', kind: 'college', secure: true,
        url: 'https://www.reynolds.edu/get_started/programs/smse/default.html',
        requestedUrl: 'https://www.reynolds.edu/get_started/programs/smse/default.html',
        sha256: '2e1304e9d92adc13c9578e1ad24472c308fb45fbb38b40df9d82bde0ea770cdb',
      }),
    ]),
  }),
  camp: Object.freeze({
    slug: 'paul-d-camp-community-college',
    numericId: 9314,
    name: 'Paul D. Camp Community College',
    sourceId: 'va:as:paul-d-camp-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science, Associate of Science (Plan 246)',
    totalUnits: 61,
    totalUnitsMax: 61,
    catalogUrl:
      'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
    groupIndex: 6,
    groupTitle: 'Humanities, art, and literature',
    geArea: 'camp_ucgs_humanities_art_literature',
    note: 'Complete two three-credit selections. They cannot come from the same humanities subgroup; if one is a humanities course, the other cannot be another humanities course. Some transfer universities require literature in the second year.',
    categories: Object.freeze(['art', 'humanities', 'literature']),
    companionDescription:
      'The two aggregate UCGS selections must come from different humanities, art, or literature subgroups.',
    reviewedTuples: Object.freeze({
      '0c5760c092672fd03a7f25952ef33da999d89b1e841d2650326d51df9f85d071':
        Object.freeze({
          proofTreeSha256: '7e1d9f68d4cf8a704cbb38fe564c513b79b8e44329ceeed82a6245b909b70c29',
          companionPresent: false,
          tupleStyle: 'protected_operational',
        }),
      'dada36fc64828ffc5a2063947e53630000842e0e616a7755bad80787bb2a03ea':
        Object.freeze({
          proofTreeSha256: 'a81d6c830ec33b0947f29a5894414dd17e9fda6fd4bf3d1419c5e9c1b54acff6',
          companionPresent: true,
          tupleStyle: 'checked_in_candidate',
        }),
    }),
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major', secure: true,
        url: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
        requestedUrl: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t#page=275',
        sha256: 'ead1e63dc89775cb89571e68497e865ce1a5f190d2ed367a010856331a942089',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education', secure: true,
        url: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
        requestedUrl: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t#page=156',
        sha256: 'ead1e63dc89775cb89571e68497e865ce1a5f190d2ed367a010856331a942089',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation', secure: true,
        url: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t',
        requestedUrl: 'https://drive.usercontent.google.com/download?id=1IX7TeVp6EPSHiWs8tm0UJidCOmQvwNu5&export=download&confirm=t#page=74',
        sha256: 'ead1e63dc89775cb89571e68497e865ce1a5f190d2ed367a010856331a942089',
      }),
    ]),
  }),
});

const array = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const number = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function exactSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const left = [...new Set(actual.map(text).filter(Boolean))].sort();
  const right = [...new Set(expected.map(text).filter(Boolean))].sort();
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function fail(reason, proof = {}) {
  return {
    handled: true,
    ready: false,
    supported: false,
    affected_figures: [...ALL_ASSOCIATE_FIGURES],
    reason,
    proof,
  };
}

function claimsPlan(document, plan) {
  return [
    document?._id,
    document?.va_requirement_id,
    document?.community_college_id,
    document?.college_id,
    document?.college_name,
  ].map(text).some((value) => [
    plan.sourceId,
    `va:cc:${plan.slug}`,
    `va:cc:${plan.numericId}`,
    String(plan.numericId),
    plan.name,
    `as_degree:${plan.numericId}:va-cs:local_as`,
  ].includes(value));
}

function claimedPlan(document) {
  return Object.values(PLANS).find((plan) => claimsPlan(document, plan)) || null;
}

function documentStyle(document, plan) {
  const source = document?._id === plan.sourceId
    && document?.kind === 'as_degree'
    && document?.va_requirement_id == null
    && document?.community_college_id === `va:cc:${plan.slug}`
    && document?.college_id === `va:cc:${plan.slug}`;
  const projection = document?._id === `as_degree:${plan.numericId}:va-cs:local_as`
    && document?.kind === 'as_degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs'
    && document?.va_requirement_id === plan.sourceId
    && Number(document?.community_college_id) === plan.numericId
    && document?.college_id === `va:cc:${plan.numericId}`
    && document?.college_name === plan.name;
  if (source === projection) return null;
  return source ? 'accepted_source' : 'final_projection';
}

function exactSources(document, plan) {
  const actual = array(document?.sources);
  if (actual.length !== plan.sources.length) return false;
  const byId = new Map(actual.map((source) => [text(source?.id), source]));
  if (byId.size !== actual.length) return false;
  return plan.sources.every((expected) => {
    const source = byId.get(expected.id);
    return source
      && text(source.role) === expected.role
      && text(source.kind) === expected.kind
      && text(source.url) === expected.url
      && text(source.requested_url) === expected.requestedUrl
      && text(source.sha256) === expected.sha256
      && source.official === true
      && source.secure === expected.secure;
  });
}

function exactReviewedDocument(document, plan) {
  const style = documentStyle(document, plan);
  if (!style) return fail(`document identity is not the reviewed ${plan.name} source/projection tuple`);
  if (style === 'final_projection' && !usesCanonicalSourceContract(document)) {
    return fail(`the reviewed ${plan.name} canonical projection contract changed or is missing`);
  }
  if (text(document?.catalog_year) !== plan.catalogYear
      || text(document?.degree_title_seen) !== plan.degreeTitle
      || number(document?.total_units) !== plan.totalUnits
      || number(document?.total_units_max) !== plan.totalUnitsMax
      || text(document?.source) !== 'institution_catalog'
      || text(document?.source_method) !== 'official_catalog_composition'
      || text(document?.catalog_url) !== plan.catalogUrl) {
    return fail(`the reviewed ${plan.name} degree identity, cohort, or fixed total changed`);
  }
  const sourceBundleSha256 = text(document?.provenance?.source_bundle_hash);
  const tuple = plan.reviewedTuples[sourceBundleSha256];
  if (!tuple || !exactSources(document, plan)) {
    return fail(`the reviewed ${plan.name} official source bundle or exact source receipts changed`);
  }
  const proofTreeSha256 = associateConflictProofTreeFingerprint(document);
  if (proofTreeSha256 !== tuple.proofTreeSha256) {
    return fail(`the reviewed ${plan.name} authored requirement/rule/accounting tree changed`);
  }
  return {
    handled: true,
    ready: true,
    supported: true,
    tuple,
    proof: {
      document_style: style,
      tuple_style: tuple.tupleStyle,
      source_bundle_sha256: sourceBundleSha256,
      proof_tree_sha256: proofTreeSha256,
      official_source_sha256: Object.fromEntries(plan.sources.map((source) => (
        [source.id, source.sha256]
      ))),
    },
  };
}

function exactCompanion(constraint, plan) {
  return text(constraint?.kind) === 'distinct_ge_areas'
    && text(constraint?.status).toLowerCase() === 'supported'
    && text(constraint?.evaluation_scope) === 'aggregate_ge_units'
    && number(constraint?.minimum_distinct_categories) === 2
    && JSON.stringify(constraint?.category_names) === JSON.stringify(plan.categories)
    && text(constraint?.description) === plan.companionDescription;
}

function exactCarrier(document, owner, plan, tuple) {
  const groups = array(document?.requirement_groups);
  const group = groups[plan.groupIndex];
  const occurrences = groups.filter((entry) => text(entry?.ge_area) === plan.geArea);
  const sections = array(group?.sections);
  const section = sections[0];
  const constraints = array(group?.analysis_constraints);
  return group
    && owner === group
    && occurrences.length === 1
    && text(group.title) === plan.groupTitle
    && group.is_required !== false
    && text(group.group_conjunction).toLowerCase() === 'and'
    && exactSet(group.source_refs, ['major', 'general_education'])
    && text(group.ge_area) === plan.geArea
    && number(group.distinct_areas) === 2
    && text(group.note) === plan.note
    && group.human_review == null
    && group.stated_credits == null
    && group.units == null
    && group.units_fill !== true
    && sections.length === 1
    && number(section.section_advisement) == null
    && number(section.unit_advisement) === 6
    && number(section.unit_advisement_max) === 6
    && exactSet(section.source_refs, ['major', 'general_education'])
    && array(section.receivers).length === 0
    && (tuple.companionPresent
      ? constraints.length === 1 && exactCompanion(constraints[0], plan)
      : constraints.length === 0);
}

/**
 * Prove only the fixed aggregate effect used by Figures 3/4.  This is not a
 * category-roster proof and intentionally cannot make Figure 6 ready.
 */
function proveReynoldsCampFixedDistinctAreaAggregate(owner, document) {
  const plan = claimedPlan(document);
  if (!plan) return { handled: false };
  const exact = exactReviewedDocument(document, plan);
  if (!exact.ready) return exact;
  if (!exactCarrier(document, owner, plan, exact.tuple)) {
    return fail(
      `the exact ${plan.name} receiver-free six-credit distinct-area carrier changed or moved`,
      exact.proof,
    );
  }
  return {
    handled: true,
    ready: true,
    supported: false,
    affected_figures: [...FIGURE_6_ONLY],
    reason: 'Figures 3/4 consume the exact fixed six-credit aggregate; Figure 6 remains closed because this receipt neither enumerates nor selects the source-defined course categories',
    proof: {
      ...exact.proof,
      source_bound_rule: 'reynolds_camp_fixed_distinct_area_aggregate',
      ge_area: plan.geArea,
      fixed_aggregate_units: 6,
      distinct_areas_retained: 2,
      explicit_companion_present: exact.tuple.companionPresent,
      figure_3_4_aggregate_resolved: true,
      figure_6_category_roster_resolved: false,
      category_rule_validity_proven_by_this_receipt: false,
      core_tree_changed_by_this_receipt: false,
    },
  };
}

module.exports = {
  ALL_ASSOCIATE_FIGURES,
  FIGURE_6_ONLY,
  PLANS,
  exactReviewedDocument,
  proveReynoldsCampFixedDistinctAreaAggregate,
};
