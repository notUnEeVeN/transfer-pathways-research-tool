/**
 * Source-bound proofs for the exact associate-side rules whose generic shape
 * is not enough to establish paper safety.
 *
 * These proofs deliberately do not parse labels or descriptions. Official
 * source identities and content hashes establish the reviewed evidence; the
 * canonical requirement carriers establish the executable rule. A moved
 * declaration, changed source bundle, changed course roster, changed ask, or
 * changed unit value fails closed in both the accepted source and final
 * projection.
 */

const { createHash } = require('node:crypto');
const { courseIdFor } = require('../virginia/courseIdentity');
const { usesCanonicalSourceContract } = require('./canonicalSourceContract');

const ALL_ASSOCIATE_FIGURES = Object.freeze(['3', '4', '6']);

const COLLEGES = Object.freeze({
  blueRidge: Object.freeze({
    slug: 'blue-ridge-community-college',
    numericId: 9301,
    name: 'Blue Ridge Community College',
    sourceId: 'va:as:blue-ridge-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science, Associate of Science',
    totalUnits: 60,
    totalUnitsMax: 62,
    // The first bundle is the checked-in two-section composition. The second
    // is the protected operational source whose legacy normalization folded
    // the two identical three-credit menus into one six-credit section. Both
    // retain the same official pages and exact 21-course category dictionary;
    // the proof below gives the protected carrier its source-stated choose-two
    // semantics at runtime without rewriting its verified major core.
    sourceBundleHash: '2b25b54fbb7b9d029cde78b3544cac6706c001114f9596aae532d152b92bdf99',
    sourceBundleHashes: Object.freeze([
      '2b25b54fbb7b9d029cde78b3544cac6706c001114f9596aae532d152b92bdf99',
      'abbc11169ae8def70573bfaae2d0e707c7ef445079214a5c38d75ed12663bb45',
    ]),
    catalogUrl: 'https://catalog.brcc.edu/programs-study/science-computer-science/',
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major',
        url: 'https://catalog.brcc.edu/programs-study/science-computer-science/',
        sha256: '84e213d33c56a545f155ff1b662c2dcc0e07656d0ee824c3ff3ac00a6bd8e72a',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education',
        url: 'https://catalog.brcc.edu/programs-study/ucgselectives/',
        sha256: '30b29dc99d019760fa37564f2d252a0350141ad03695dca5f50c133466226875',
      }),
      Object.freeze({
        id: 'elective', role: 'elective', kind: 'elective',
        url: 'https://catalog.brcc.edu/programs-study/world-language/',
        sha256: '733db560bae8db9892a5a2aea866d8d8690e0229b6a8d2b38ee0bbe9892f4b6c',
      }),
      Object.freeze({
        id: 'student_development', role: 'student_development', kind: 'student_development',
        url: 'https://catalog.brcc.edu/programs-study/sdv/',
        sha256: '4f1fbf9cfb9016ff62238b94d4e44670bc92f159156a8a60e5c31021ff781d15',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation',
        url: 'https://catalog.brcc.edu/student-handbook/policies/graduation/',
        sha256: '44275307fe7041ae34136f3b5440a6021f1cd1b3c18bfe6e872a8891af90f6b2',
      }),
    ]),
  }),
  laurelRidge: Object.freeze({
    slug: 'laurel-ridge-community-college',
    numericId: 9308,
    name: 'Laurel Ridge Community College',
    sourceId: 'va:as:laurel-ridge-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science Degree, Associate of Science (Plan 246)',
    totalUnits: 60,
    totalUnitsMax: 64,
    sourceBundleHash: '7e2f93069b9cc8b725540d1b7cd1c9e68bfcdd902b47861bebd92228c154e4c0',
    catalogUrl: 'https://catalog.laurelridge.edu/preview_program.php?catoid=25&poid=1940&returnto=996&print=1',
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major',
        url: 'https://catalog.laurelridge.edu/preview_program.php?catoid=25&poid=1940&returnto=996&print=1',
        sha256: '6bdf1df27805e887c3d56937033391e7993fb7dd41fa241884c8604e60f22659',
      }),
      Object.freeze({
        id: 'catalog', role: 'catalog', kind: 'catalog',
        url: 'https://catalog.laurelridge.edu/index.php?catoid=25',
        sha256: 'e04e809965b2c415c579b615ea622d22f5f1d1e8d46b272b8447922263aff2cf',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation',
        url: 'https://catalog.laurelridge.edu/content.php?catoid=25&navoid=1001',
        sha256: 'ef8a7d1d207a94683fec7ccb7fdd0e95fbb6af0f5881094923ec1357722bbe8c',
      }),
    ]),
  }),
  mountainGateway: Object.freeze({
    slug: 'mountain-gateway-community-college',
    numericId: 9310,
    name: 'Mountain Gateway Community College',
    sourceId: 'va:as:mountain-gateway-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Science, Associate of Science — Computer Science-supported generic transfer path',
    totalUnits: 60,
    totalUnitsMax: 64,
    sourceBundleHash: '2c688475f1da92bf51c46b0b5cf7574251a82e426635aee3637491a366b42be0',
    // The second bundle is the protected operational document. It retains
    // the same six exact official pages and published UCGS arithmetic, but
    // predates the candidate composition's removal of incomplete local
    // destination menus. Each bundle/style is paired with a different exact
    // whole-tree fingerprint below; admitting one hash never admits the
    // other tree, and neither receipt resolves those incomplete menus.
    sourceBundleHashes: Object.freeze([
      '2c688475f1da92bf51c46b0b5cf7574251a82e426635aee3637491a366b42be0',
      'd9d62f38fd9f39cb89d3da1fa5c9ffbfe06bb698b400ef0030eb99a56ed83a79',
    ]),
    catalogUrl: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=895&returnto=478&print=1',
    sources: Object.freeze([
      Object.freeze({
        id: 'catalog', role: 'catalog', kind: 'catalog',
        url: 'https://catalog.mgcc.edu/index.php?catoid=9',
        sha256: 'c91c3dfad32e0dc405eb74e5649e6360715e9ac033c977e3b22af0034ce6339a',
      }),
      Object.freeze({
        id: 'major', role: 'program', kind: 'major',
        url: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=895&returnto=478&print=1',
        sha256: '4f9494ae5e63cbc37fc0253d6aabe84cafe812997cc34f328a1b3d81a33c2655',
      }),
      Object.freeze({
        id: 'uniform_general_studies', role: 'uniform_general_studies', kind: 'general_education',
        url: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=909&returnto=478',
        sha256: '4c377bd2f74ed9a7f41e23b5c07496a985536a37dad23fd37c686fc7eba7da21',
      }),
      Object.freeze({
        id: 'science_specialized', role: 'science_specialized', kind: 'major',
        url: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=975&returnto=478',
        sha256: 'dc40c89a36f35758f31c4355b6d6ace8c58822bf0bf6c09fe55d5e0245a39521',
      }),
      Object.freeze({
        id: 'transfer_core', role: 'transfer_core', kind: 'general_education',
        url: 'https://catalog.mgcc.edu/preview_program.php?catoid=9&poid=967&returnto=478',
        sha256: '570ac276cf5cfe45c8b7ef646039688f4b4058f6f9d2af1697b9d0cb09a8324c',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation',
        url: 'https://catalog.mgcc.edu/content.php?catoid=9&navoid=487',
        sha256: '18abb70961c6b81c14180dc9e41847de9e5a4d5e0a43264727f71ac620c8aa23',
      }),
    ]),
  }),
  northernVirginia: Object.freeze({
    slug: 'northern-virginia-community-college',
    numericId: 9312,
    name: 'Northern Virginia Community College',
    sourceId: 'va:as:northern-virginia-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science, A.S.',
    totalUnits: 60,
    totalUnitsMax: 63,
    // The first hash is the current candidate composition. The second is the
    // protected, human-verified operational source after the course-unit
    // evidence overlay. The overlay changes evidence/wrapper bytes but not
    // the reviewed official source pages; both complete tuples below are
    // tested and every other bundle fails closed.
    sourceBundleHash: '0f5e6e408029d35de0ae6b6975a6ebd8d7135d9d175b17e1d293df872357fae0',
    sourceBundleHashes: Object.freeze([
      '0f5e6e408029d35de0ae6b6975a6ebd8d7135d9d175b17e1d293df872357fae0',
      'bd4a83638659300e6ed507ad80673388ee9ec3b8fec7b0015cdd15d4b4e10b2f',
    ]),
    catalogUrl: 'https://catalog.nvcc.edu/programs/computer-science-as/',
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major',
        url: 'https://catalog.nvcc.edu/programs/computer-science-as/',
        sha256: 'ebf19aaea42553f6a436ceff772e7ebe3c5ffdf079af8485929477585803a6dc',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education',
        url: 'https://catalog.nvcc.edu/general-education-electives/',
        sha256: '80fdc7d6b2b98f0b0ffdf6f04165b2bc020b1e114ca960f0d8d4b7b3c2f291dd',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation',
        url: 'https://catalog.nvcc.edu/academic-programs-requirements/',
        sha256: '740ecc996ddcb9480032e3de97cb297a35268d320fb017f4f9cc816647c969b3',
      }),
      Object.freeze({
        id: 'policy', role: 'policy', kind: 'policy',
        url: 'https://catalog.nvcc.edu/academic-policies-information/',
        sha256: 'f781269503295a8543c5c2f725759a501171e0e924e9933ec742b38dcd5c61ca',
      }),
    ]),
  }),
  newRiver: Object.freeze({
    slug: 'new-river-community-college',
    numericId: 9311,
    name: 'New River Community College',
    sourceId: 'va:as:new-river-community-college:cs',
    catalogYear: '2026-2027',
    degreeTitle: 'Computer Science, Associate of Science',
    totalUnits: 61,
    totalUnitsMax: 63,
    sourceBundleHash: '2eb566b844869dd6e1dd2eca09a181f3fc29eb4a3780c93adb2a2af4d36ac20d',
    catalogUrl: 'https://catalog.nr.edu/preview_program.php?catoid=42&poid=1965&returnto=3275&print=1',
    sources: Object.freeze([
      Object.freeze({
        id: 'major', role: 'program', kind: 'major',
        url: 'https://catalog.nr.edu/preview_program.php?catoid=42&poid=1965&returnto=3275&print=1',
        sha256: '9d8cc1f06a98516558d5941210877af3bb5da5d193f0db64be484be9cf4482b7',
      }),
      Object.freeze({
        id: 'general_education', role: 'ge', kind: 'general_education',
        url: 'https://catalog.nr.edu/content.php?catoid=42&navoid=3260',
        sha256: '569fb1e10c95f92e94ba57e01d0a8dde6f4a61360229c9f34fcfbafc04f2c29f',
      }),
      Object.freeze({
        id: 'graduation', role: 'graduation', kind: 'graduation',
        url: 'https://www.nr.edu/graduation/',
        sha256: 'a10d34a010cbed892d6e93aaeac062b3e40c1bc2550b2874d1c1e395ffc47d18',
      }),
      Object.freeze({
        id: 'course_catalog', role: 'course_catalog', kind: 'course_catalog',
        url: 'https://catalog.nr.edu/content.php?catoid=42&navoid=3271',
        sha256: 'cb54ed984f146a4bb3b87d5eaba6bb905b44af8342ecd235e403d06f264185fd',
      }),
    ]),
  }),
});

const NEW_RIVER_LAB_CODES = Object.freeze([
  'BIO101', 'BIO102', 'CHM111', 'CHM112', 'GOL105', 'PHY241', 'PHY242',
]);
const NEW_RIVER_FIGURE_6_LAB_CODES = Object.freeze(['GOL105', 'PHY241']);

const BLUE_RIDGE_CATEGORY_COURSES = Object.freeze({
  art: Object.freeze(['ART100', 'ART101', 'ART102', 'CST130', 'CST151', 'MUS121']),
  humanities: Object.freeze([
    'HUM202', 'HUM210', 'HUM216', 'HUM220', 'PHI100', 'PHI220', 'REL100', 'REL230',
  ]),
  literature: Object.freeze([
    'ENG225', 'ENG245', 'ENG246', 'ENG250', 'ENG255', 'ENG258', 'ENG275',
  ]),
});
const BLUE_RIDGE_CATEGORY_SUBJECTS = Object.freeze({
  art: Object.freeze(['ART', 'CST', 'MUS']),
  humanities: Object.freeze(['HUM', 'PHI', 'REL']),
  literature: Object.freeze(['ENG']),
});
const BLUE_RIDGE_CODES = Object.freeze(Object.values(BLUE_RIDGE_CATEGORY_COURSES).flat());
const BLUE_RIDGE_SOURCE_BOUND_RULE = 'blue_ridge_ucgs_block_ii_distinct_categories';
const BLUE_RIDGE_GENERAL_EDUCATION_CODES = Object.freeze([
  'BIO101', 'BIO102', 'CHM111', 'CHM112', 'CST100', 'CST110', 'GOL105', 'GOL110',
  'MTH245', 'MTH264', 'PHY201', 'PHY202', 'PHY241', 'PHY242',
  'ASL101', 'ASL102', 'ASL201', 'SPA101', 'SPA102', 'SPA115', 'SPA201', 'SPA202',
]);
const BLUE_RIDGE_THREE_CREDIT_GENERAL_EDUCATION_CODES = Object.freeze([
  'CST100', 'CST110', 'MTH245', 'ASL201', 'SPA201', 'SPA202',
]);
const LAUREL_RIDGE_ELECTIVE_CODES = Object.freeze([
  'CSC110', 'CSC205', 'CSC210', 'CSC215', 'CSC295', 'CSC298', 'EGR121',
  'EGR122', 'EGR270', 'MTH161', 'MTH162', 'MTH167', 'MTH265', 'MTH266',
]);
// Filled from `associateConflictProofTreeFingerprint` after checking the
// accepted source and the actual final numeric `buildProjection` document.
// Projection-only wrappers and rewritten `cc:<id>` keys are normalized away;
// every authored group, section, option identity, rule, unit-audit value, and
// quality flag remains in the receipt.
const LAUREL_RIDGE_PROOF_TREE_SHA256 = '8251bba9c3b7dd75bd582fead9ace50e6e62a69116069c55e5a91985e9faaccd';
const MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256 =
  'e59528de56e210237d6b0d6b003981d5ebb78fb1b03a6a4c2318946080640ccc';
const MOUNTAIN_GATEWAY_UCGS_PROOF_TREES = Object.freeze({
  '2c688475f1da92bf51c46b0b5cf7574251a82e426635aee3637491a366b42be0': Object.freeze({
    accepted_source: MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256,
    final_projection: MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256,
  }),
  'd9d62f38fd9f39cb89d3da1fa5c9ffbfe06bb698b400ef0030eb99a56ed83a79': Object.freeze({
    accepted_source: '5d2b190d77516c929eb90f054bbc3febb12350ae77eb88541e7677bb2825245b',
    final_projection: 'a39416991e6e295736fba6fcea53e8428e5d48fb22543c1ee68864a4a1321fcd',
  }),
});
const MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE =
  'mountain_gateway_blocks_i_vii_published_31_33_cap';
const MOUNTAIN_GATEWAY_PROTECTED_BLOCK_VII_CODES = Object.freeze([
  'CST110', 'FRE201', 'FRE202', 'ITE152', 'SPA201', 'SPA202',
]);
const MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS = Object.freeze([
  Object.freeze({ index: 1, block: 'I', title: 'UCGS Block I — Written Communication', minimum: 6, maximum: 6 }),
  Object.freeze({ index: 2, block: 'II', title: 'UCGS Block II — Humanities, Art, and Literature', minimum: 6, maximum: 6 }),
  Object.freeze({ index: 3, block: 'III', title: 'UCGS Block III — Social and Behavioral Sciences', minimum: 3, maximum: 3 }),
  Object.freeze({ index: 4, block: 'IV', title: 'UCGS Block IV — Natural Sciences', minimum: 4, maximum: 4 }),
  Object.freeze({ index: 5, block: 'V', title: 'UCGS Block V — Mathematics', minimum: 3, maximum: 5 }),
  Object.freeze({ index: 6, block: 'VI', title: 'UCGS Block VI — History', minimum: 3, maximum: 3 }),
  Object.freeze({ index: 7, block: 'VII', title: 'UCGS Block VII — Specialized General Education', minimum: 6, maximum: 8 }),
]);

const NOVA_AGGREGATE_GROUPS = Object.freeze({
  nova_humanities_fine_arts_literature: Object.freeze({
    units: 6,
    kind: 'distinct_ge_areas',
    distinctAreas: 2,
    // This is the exact protected operational carrier, not a claim that the
    // nine rows are the complete official three-area roster. They are all in
    // the Fine Arts portion of the retained GE page, which is precisely why
    // Figure 6 remains closed below.
    protectedCodes: Object.freeze([
      'ART100', 'ART101', 'ART102', 'CST130', 'CST151',
      'MUS121', 'MUS221', 'MUS222', 'MUS226',
    ]),
  }),
  nova_history: Object.freeze({
    units: 3,
    kind: null,
    distinctAreas: null,
    protectedCodes: Object.freeze([
      'HIS101', 'HIS102', 'HIS111', 'HIS112',
      'HIS121', 'HIS122', 'HIS203', 'HIS254',
    ]),
  }),
  nova_social_behavioral_nonhistory: Object.freeze({
    units: 3,
    kind: 'excluded_ge_subject',
    distinctAreas: null,
    protectedCodes: Object.freeze([
      'ADJ100', 'ECO150', 'ECO201', 'ECO202', 'GEO200', 'GEO210', 'GEO220',
      'PLS135', 'PLS140', 'PLS241', 'PSY200', 'PSY216', 'PSY230',
      'SOC200', 'SOC211', 'SOC268',
    ]),
  }),
});

const asArray = (value) => Array.isArray(value) ? value : [];
const text = (value) => String(value ?? '').trim();
const finite = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) ? Number(value) : null;

function exactSet(actual, expected) {
  if (!Array.isArray(actual)) return false;
  const left = [...new Set(actual.map(text).filter(Boolean))].sort();
  const right = [...new Set(expected.map(text).filter(Boolean))].sort();
  return left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function fail(reason, affectedFigures = ALL_ASSOCIATE_FIGURES, proof = null) {
  return {
    handled: true,
    supported: false,
    affected_figures: [...affectedFigures],
    reason,
    ...(proof ? { proof } : {}),
  };
}

function pass(reason, affectedFigures, proof) {
  return {
    handled: true,
    supported: true,
    affected_figures: [...affectedFigures],
    reason,
    proof,
  };
}

function claimsCollege(document, college) {
  const values = [
    document?._id,
    document?.va_requirement_id,
    document?.community_college_id,
    document?.college_id,
    document?.college_name,
  ].map(text).filter(Boolean);
  return values.some((value) => [
    college.sourceId,
    `va:cc:${college.slug}`,
    `va:cc:${college.numericId}`,
    String(college.numericId),
    college.name,
    `as_degree:${college.numericId}:va-cs:local_as`,
  ].includes(value))
    // Keep a reviewed rule on its source-specific, fail-closed path even if
    // every identity carrier is corrupted at once.  A retained bundle hash or
    // one exact official source is enough to *claim* the college, but never
    // enough to pass `exactReviewedDocument`, which still requires the full
    // identity/source/projection tuple.
    || asArray(college.sourceBundleHashes || [college.sourceBundleHash])
      .includes(text(document?.provenance?.source_bundle_hash))
    || asArray(document?.sources).some((source) => college.sources.some((expected) => (
      text(source?.id) === expected.id
      && text(source?.url) === expected.url
      && text(source?.sha256) === expected.sha256
    )));
}

function hasReviewedSourceSignal(document, college) {
  return asArray(college.sourceBundleHashes || [college.sourceBundleHash])
    .includes(text(document?.provenance?.source_bundle_hash))
    || asArray(document?.sources).some((source) => college.sources.some((expected) => (
      text(source?.id) === expected.id
      && text(source?.url) === expected.url
      && text(source?.sha256) === expected.sha256
    )));
}

function documentStyle(document, college) {
  const source = document?._id === college.sourceId
    && document?.kind === 'as_degree'
    && document?.va_requirement_id == null
    && document?.community_college_id === `va:cc:${college.slug}`
    && document?.college_id === `va:cc:${college.slug}`;
  const projection = document?._id === `as_degree:${college.numericId}:va-cs:local_as`
    && document?.kind === 'as_degree'
    && document?.state === 'va'
    && document?.major_slug === 'va-cs'
    && document?.va_requirement_id === college.sourceId
    && Number(document?.community_college_id) === college.numericId
    && document?.college_id === `va:cc:${college.numericId}`
    && document?.college_name === college.name;
  if (source === projection) return null;
  return source ? 'accepted_source' : 'final_projection';
}

function exactOfficialSources(document, expected) {
  const actual = asArray(document?.sources);
  if (actual.length !== expected.length) return false;
  const byId = new Map(actual.map((source) => [text(source?.id), source]));
  if (byId.size !== actual.length) return false;
  return expected.every((source) => {
    const row = byId.get(source.id);
    return row
      && text(row.role) === source.role
      && text(row.kind) === source.kind
      && text(row.url) === source.url
      && text(row.requested_url) === source.url
      && text(row.sha256) === source.sha256
      && row.official === true
      && row.secure === true;
  });
}

function exactReviewedDocument(document, college) {
  const style = documentStyle(document, college);
  if (!style) return fail(`document identity is not the reviewed ${college.name} source/projection tuple`);
  if (style === 'final_projection' && !usesCanonicalSourceContract(document)) {
    return fail(`the reviewed ${college.name} canonical projection contract changed or is missing`);
  }
  if (text(document?.catalog_year) !== college.catalogYear
      || text(document?.degree_title_seen) !== college.degreeTitle
      || finite(document?.total_units) !== college.totalUnits
      || finite(document?.total_units_max) !== college.totalUnitsMax) {
    return fail(`the reviewed ${college.name} cohort, degree identity, or unit range changed`);
  }
  if (text(document?.source) !== 'institution_catalog'
      || text(document?.source_method) !== 'official_catalog_composition'
      || text(document?.catalog_url) !== college.catalogUrl) {
    return fail(`the reviewed ${college.name} official-catalog provenance changed`);
  }
  const sourceBundleHash = text(document?.provenance?.source_bundle_hash);
  const acceptedBundleHashes = asArray(
    college.sourceBundleHashes || [college.sourceBundleHash],
  );
  if (!acceptedBundleHashes.includes(sourceBundleHash)) {
    return fail(`the reviewed ${college.name} source-bundle hash changed`);
  }
  if (!exactOfficialSources(document, college.sources)) {
    return fail(`the reviewed ${college.name} official source identities or content hashes changed`);
  }
  return pass(`the reviewed ${college.name} source bundle matches`, ALL_ASSOCIATE_FIGURES, {
    document_style: style,
    source_bundle_hash: sourceBundleHash,
    accepted_source_bundle_sha256: [...acceptedBundleHashes],
    official_source_sha256: Object.fromEntries(college.sources.map((source) => (
      [source.id, source.sha256]
    ))),
  });
}

function occurrences(document, kind) {
  const rows = [];
  const visit = (value, path = 'doc') => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${path}[${index}]`));
      return;
    }
    asArray(value.analysis_constraints).forEach((constraint, index) => {
      if (text(constraint?.kind) === kind) {
        rows.push({ owner: value, constraint, path: `${path}.analysis_constraints[${index}]` });
      }
    });
    for (const [key, child] of Object.entries(value)) {
      if (key !== 'analysis_constraints') visit(child, `${path}.${key}`);
    }
  };
  visit({
    analysis_constraints: document?.analysis_constraints,
    unit_audit: document?.unit_audit,
    requirement_groups: document?.requirement_groups,
  });
  return rows;
}

function exactAttachment(document, owner, constraint, kind) {
  const matches = occurrences(document, kind);
  return matches.length === 1
    && matches[0].owner === owner
    && matches[0].constraint === constraint;
}

function exactAggregateGroup(owner, {
  units,
  geArea,
  distinctAreas = null,
}) {
  const sections = asArray(owner?.sections);
  return text(owner?.group_conjunction).toLowerCase() === 'and'
    && owner?.ge_area === geArea
    && owner?.units_fill !== true
    && exactSet(owner?.source_refs, ['major', 'general_education', 'graduation'])
    && (distinctAreas == null
      ? owner?.distinct_areas == null : finite(owner?.distinct_areas) === distinctAreas)
    && sections.length === 1
    && sections[0]?.section_advisement == null
    && finite(sections[0]?.unit_advisement) === units
    && finite(sections[0]?.unit_advisement_max) === units
    && exactSet(sections[0]?.source_refs, ['major', 'general_education', 'graduation'])
    && asArray(sections[0]?.receivers).length === 0;
}

function exactProtectedNamedAggregate(owner, spec) {
  const sections = asArray(owner?.sections);
  if (text(owner?.group_conjunction).toLowerCase() !== 'and'
      || owner?.ge_area == null
      || owner?.units_fill === true
      || !exactSet(owner?.source_refs, ['major', 'general_education', 'graduation'])
      || (spec.distinctAreas == null
        ? owner?.distinct_areas != null
        : finite(owner?.distinct_areas) !== spec.distinctAreas)
      || sections.length !== 1) return false;
  const section = sections[0];
  const receivers = asArray(section?.receivers);
  if (section?.section_advisement != null
      || finite(section?.unit_advisement) !== spec.units
      || finite(section?.unit_advisement_max) !== spec.units
      || !exactSet(section?.source_refs, ['major', 'general_education', 'graduation'])
      || receivers.length !== 1
      || text(receivers[0]?.options_conjunction).toLowerCase() !== 'or') return false;
  const options = asArray(receivers[0]?.options);
  const codes = options.map(optionCode);
  return options.length === spec.protectedCodes.length
    && exactSet(codes, spec.protectedCodes)
    && options.every((option, index) => (
      // The protected pre-normalization source stores each singleton route
      // with `course_conjunction: or`; one id makes the Boolean result exact.
      text(option?.course_conjunction).toLowerCase() === 'or'
      && asArray(option?.course_ids).length === 1
      && Number(option.course_ids[0]) === courseIdFor(codes[index])
    ));
}

function exactNovaAggregateCarrier(owner, spec) {
  return exactAggregateGroup(owner, {
    units: spec.units,
    geArea: owner?.ge_area,
    distinctAreas: spec.distinctAreas,
  }) || exactProtectedNamedAggregate(owner, spec);
}

function exactNovaConstraintShape(value, kind) {
  const status = text(value?.status).toLowerCase();
  if (!['supported', 'evaluator_not_implemented'].includes(status)) return false;
  if (kind === 'distinct_ge_areas') {
    const optionalFieldsAbsent = value?.evaluation_scope == null
      && value?.minimum_distinct_categories == null
      && value?.category_names == null;
    return optionalFieldsAbsent || (
      text(value?.evaluation_scope) === 'aggregate_ge_units'
      && finite(value?.minimum_distinct_categories) === 2
      && exactSet(value?.category_names, ['fine_arts', 'humanities', 'literature'])
    );
  }
  const optionalFieldsAbsent = value?.evaluation_scope == null
    && value?.excluded_subjects == null;
  return optionalFieldsAbsent || (
    text(value?.evaluation_scope) === 'aggregate_ge_units'
    && exactSet(value?.excluded_subjects, ['HIS'])
  );
}

/**
 * Exact Figure 3/4 interpretation of NOVA's three printed GE blocks.
 *
 * Those figures consume fixed GE credit capacity, so the retained source's
 * 6 + 3 + 3 printed credits are invariant to the student's category/course
 * selection. Figure 6 is different: it needs the selected course vertices and
 * prerequisites. The protected operational tree carries only a partial Fine
 * Arts menu for the two-area requirement, while the candidate tree carries no
 * menu at all. This proof therefore authorizes aggregate use only for Figures
 * 3/4 and deliberately does not turn either carrier into a Figure 6 roster.
 */
function northernVirginiaFigure34Aggregates(document) {
  // Do not commandeer an unrelated synthetic fixture merely because it uses
  // NOVA's production numeric id. At least one reviewed source/bundle signal
  // is required before this runtime preflight becomes authoritative.
  if (!hasReviewedSourceSignal(document, COLLEGES.northernVirginia)) {
    return { handled: false, ready: false, reason: 'not the reviewed NOVA document' };
  }
  const exact = exactReviewedDocument(document, COLLEGES.northernVirginia);
  if (!exact.supported) return { handled: true, ready: false, reason: exact.reason };
  const groups = asArray(document?.requirement_groups).filter((group) => (
    Object.hasOwn(NOVA_AGGREGATE_GROUPS, text(group?.ge_area))
  ));
  if (groups.length !== Object.keys(NOVA_AGGREGATE_GROUPS).length) {
    return { handled: true, ready: false, reason: 'the reviewed three NOVA GE aggregate carriers are missing or duplicated' };
  }
  const rows = [];
  for (const [geArea, spec] of Object.entries(NOVA_AGGREGATE_GROUPS)) {
    const matches = groups.filter((group) => text(group?.ge_area) === geArea);
    if (matches.length !== 1 || !exactNovaAggregateCarrier(matches[0], spec)) {
      return { handled: true, ready: false, reason: `the reviewed NOVA ${geArea} aggregate carrier changed` };
    }
    if (spec.kind) {
      const constraints = asArray(matches[0]?.analysis_constraints)
        .filter((constraint) => text(constraint?.kind) === spec.kind);
      if (constraints.length !== 1 || !exactNovaConstraintShape(constraints[0], spec.kind)) {
        return { handled: true, ready: false, reason: `the reviewed NOVA ${spec.kind} declaration changed` };
      }
    } else if (asArray(matches[0]?.analysis_constraints).length !== 0) {
      return { handled: true, ready: false, reason: `the reviewed NOVA ${geArea} carrier gained an unproved rule` };
    }
    rows.push({ ge_area: geArea, units: spec.units, group: matches[0] });
  }
  return {
    handled: true,
    ready: true,
    total_units: rows.reduce((sum, row) => sum + row.units, 0),
    groups: rows,
    proof: {
      ...exact.proof,
      affected_figures: ['3', '4'],
      fixed_aggregate_units_by_area: Object.fromEntries(rows.map((row) => [
        row.ge_area, row.units,
      ])),
      fixed_aggregate_units: rows.reduce((sum, row) => sum + row.units, 0),
      figure_6_roster_complete: false,
    },
  };
}

function proveNorthernVirginiaConstraint(value, { owner, doc } = {}) {
  const kind = text(value?.kind);
  if (!['distinct_ge_areas', 'excluded_ge_subject'].includes(kind)
      || !claimsCollege(doc, COLLEGES.northernVirginia)) return { handled: false };
  const exact = exactReviewedDocument(doc, COLLEGES.northernVirginia);
  if (!exact.supported) return exact;
  if (!exactAttachment(doc, owner, value, kind)) {
    return fail(`the NOVA ${kind} declaration is moved, duplicated, or detached from its exact carrier`);
  }
  const spec = kind === 'distinct_ge_areas'
    ? NOVA_AGGREGATE_GROUPS.nova_humanities_fine_arts_literature
    : NOVA_AGGREGATE_GROUPS.nova_social_behavioral_nonhistory;
  if (text(owner?.ge_area) !== (kind === 'distinct_ge_areas'
    ? 'nova_humanities_fine_arts_literature'
    : 'nova_social_behavioral_nonhistory')
      || !exactNovaAggregateCarrier(owner, spec)) {
    return fail(`the NOVA ${kind} aggregate carrier changed`, ['6']);
  }
  if (!exactNovaConstraintShape(value, kind)) {
    return fail(`the NOVA ${kind} declaration or optional dictionary changed`, ['6']);
  }
  const aggregateProof = northernVirginiaFigure34Aggregates(doc);
  if (!aggregateProof.ready) return fail(aggregateProof.reason, ['6']);
  return fail(
    'Figures 3/4 use the exact fixed NOVA GE credit aggregates; Figure 6 remains closed because the protected/candidate trees do not carry the complete official course roster needed for course and prerequisite selection',
    ['6'],
    {
      ...aggregateProof.proof,
      minimum_distinct_categories: kind === 'distinct_ge_areas' ? 2 : null,
      category_names: kind === 'distinct_ge_areas'
        ? ['fine_arts', 'humanities', 'literature'] : null,
      excluded_subjects: kind === 'excluded_ge_subject' ? ['HIS'] : null,
      aggregate_units: spec.units,
      figure_3_4_impact: 'fixed aggregate credits only',
      figure_6_blocker: 'complete official GE course roster is not projected and prerequisite-scoped',
    },
  );
}

function optionCode(option) {
  const keys = asArray(option?.source_course_keys).length
    ? option.source_course_keys : asArray(option?.course_keys);
  if (keys.length !== 1) return null;
  const code = text(keys[0]).split(':').at(-1).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}[0-9]{2,4}[A-Z]?$/.test(code) ? code : null;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function normalizedAssociateOption(option) {
  return {
    codes: asArray(option?.source_course_keys).length
      ? option.source_course_keys.map((key) => text(key).split(':').at(-1))
      : asArray(option?.course_keys).map((key) => text(key).split(':').at(-1)),
    ids: asArray(option?.course_ids).map(Number),
    conjunction: text(option?.course_conjunction).toLowerCase() || null,
  };
}

function normalizedAssociateReceiver(receiver) {
  return {
    articulation_status: text(receiver?.articulation_status) || null,
    not_articulated_reason: text(receiver?.not_articulated_reason) || null,
    options_conjunction: text(receiver?.options_conjunction).toLowerCase() || null,
    options: asArray(receiver?.options).map(normalizedAssociateOption),
    tier: text(receiver?.tier) || null,
    course_level: text(receiver?.course_level) || null,
    cc_articulable: receiver?.cc_articulable ?? null,
    overlap_key: text(receiver?.overlap_key) || null,
    note: text(receiver?.note) || null,
    code_seen: text(receiver?.code_seen) || null,
    human_review: receiver?.human_review ?? null,
  };
}

function normalizedAssociateSection(section) {
  return {
    section_advisement: finite(section?.section_advisement),
    unit_advisement: finite(section?.unit_advisement),
    unit_advisement_max: finite(section?.unit_advisement_max),
    label_seen: text(section?.label_seen) || null,
    tier: text(section?.tier) || null,
    course_level: text(section?.course_level) || null,
    cc_articulable: section?.cc_articulable ?? null,
    source_refs: [...asArray(section?.source_refs)],
    note: text(section?.note) || null,
    overlap_key: text(section?.overlap_key) || null,
    human_review: section?.human_review ?? null,
    analysis_constraints: asArray(section?.analysis_constraints),
    assume_satisfiable: section?.assume_satisfiable === true,
    receivers: asArray(section?.receivers).map(normalizedAssociateReceiver),
  };
}

function normalizedAssociateGroup(group) {
  return {
    title: text(group?.title) || null,
    is_required: group?.is_required !== false,
    group_conjunction: text(group?.group_conjunction).toLowerCase() || 'and',
    requirement_layer: text(group?.requirement_layer) || null,
    tier: text(group?.tier) || null,
    course_level: text(group?.course_level) || null,
    cc_articulable: group?.cc_articulable ?? null,
    source_refs: [...asArray(group?.source_refs)],
    note: text(group?.note) || null,
    overlap_key: text(group?.overlap_key) || null,
    human_review: group?.human_review ?? null,
    analysis_constraints: asArray(group?.analysis_constraints),
    stated_credits: text(group?.stated_credits) || null,
    distinct_course_ids_across_sections:
      group?.distinct_course_ids_across_sections === true,
    ge_area: text(group?.ge_area) || null,
    units: finite(group?.units),
    units_fill: group?.units_fill === true,
    sections: asArray(group?.sections).map(normalizedAssociateSection),
  };
}

function normalizedAssociateConflictProofTree(document) {
  return {
    catalog_year: text(document?.catalog_year),
    degree_title_seen: text(document?.degree_title_seen),
    total_units: finite(document?.total_units),
    total_units_max: finite(document?.total_units_max),
    unit_audit: document?.unit_audit || null,
    option_sets: document?.option_sets || null,
    modeling_notes: [...asArray(document?.modeling_notes)],
    data_quality_flags: [...asArray(document?.data_quality_flags)],
    course_titles: document?.course_titles || null,
    requirement_groups: asArray(document?.requirement_groups).map(normalizedAssociateGroup),
  };
}

function associateConflictProofTreeFingerprint(document) {
  return hash(normalizedAssociateConflictProofTree(document));
}

function exactMountainGatewayProtectedBlockVIIReceiver(receiver) {
  const options = asArray(receiver?.options);
  const codes = options.map(optionCode);
  return text(receiver?.articulation_status) === 'articulated'
    && text(receiver?.options_conjunction).toLowerCase() === 'or'
    && text(receiver?.code_seen) === 'HIS121 / HIS122'
    && options.length === MOUNTAIN_GATEWAY_PROTECTED_BLOCK_VII_CODES.length
    && exactSet(codes, MOUNTAIN_GATEWAY_PROTECTED_BLOCK_VII_CODES)
    && options.every((option, index) => (
      text(option?.course_conjunction).toLowerCase() === 'or'
      && asArray(option?.course_ids).length === 1
      && Number(option.course_ids[0]) === courseIdFor(codes[index])
    ));
}

function exactMountainGatewayUcgsGroup(group, spec, {
  protectedOperational = false,
} = {}) {
  const sections = asArray(group?.sections);
  const sectionMinimum = sections.reduce((sum, section) => (
    sum + (finite(section?.unit_advisement) ?? Number.NaN)
  ), 0);
  const sectionMaximum = sections.reduce((sum, section) => (
    sum + (finite(section?.unit_advisement_max) ?? Number.NaN)
  ), 0);
  if (text(group?.title) !== spec.title
      || group?.is_required === false
      || text(group?.group_conjunction).toLowerCase() !== 'and'
      || group?.units_fill === true
      || !exactSet(group?.source_refs, ['uniform_general_studies'])
      || !sections.length
      || sectionMinimum !== spec.minimum
      || sectionMaximum !== spec.maximum
      || sections.some((section) => !exactSet(
        section?.source_refs,
        ['uniform_general_studies'],
      ))) return false;
  if (spec.block === 'VII') {
    const receivers = asArray(sections[0]?.receivers);
    return text(group?.ge_area) === 'mgcc_ucgs_block_vii_destination_aligned'
      && text(group?.stated_credits) === '6-8; select two courses'
      && sections.length === 1
      && sections[0]?.section_advisement == null
      && (protectedOperational
        ? receivers.length === 1
          && exactMountainGatewayProtectedBlockVIIReceiver(receivers[0])
        : receivers.length === 0)
      && asArray(group?.analysis_constraints).length === 1
      && text(group.analysis_constraints[0]?.kind) === 'choose_two_variable_credit_open_roster';
  }
  return group?.ge_area == null
    && sections.every((section) => (
      finite(section?.section_advisement) === 1
        && asArray(section?.receivers).length === 1
        && asArray(section.receivers[0]?.options).length > 0
    ));
}

function exactMountainGatewayPublishedUnitAudit(document) {
  const audit = document?.unit_audit;
  const published = document?.published_unit_audit;
  return finite(audit?.published_program_units_minimum) === 60
    && finite(audit?.published_program_units_maximum) === 64
    && finite(audit?.modeled_units_minimum) === 60
    && finite(audit?.modeled_units_maximum) === 64
    && finite(audit?.canonical_component_units?.college_success) === 1
    && finite(audit?.canonical_component_units?.uniform_general_studies) === 31
    && finite(audit?.canonical_component_units?.science_specialized) === 12
    && finite(audit?.canonical_component_units?.transfer_core) === 16
    && audit?.generic_multi_pathway_degree === true
    && audit?.computer_science_supported_pathway === true
    && audit?.computer_science_specific_prescribed_branch === false
    && finite(published?.published_program_units_minimum) === 60
    && finite(published?.published_program_units_maximum) === 64
    && finite(published?.modeled_units_minimum) === 60
    && finite(published?.modeled_units_maximum) === 64
    && finite(published?.component_units?.college_success) === 1
    && finite(published?.component_units?.uniform_general_studies_minimum) === 31
    && finite(published?.component_units?.uniform_general_studies_maximum) === 33
    && finite(published?.component_units?.science_specialized) === 12
    && finite(published?.component_units?.transfer_core_minimum) === 16
    && finite(published?.component_units?.transfer_core_maximum) === 18;
}

function mountainGatewayUcgsUnitTuples() {
  const tuples = [];
  for (let mathematics = 3; mathematics <= 5; mathematics += 1) {
    for (let blockVII = 6; blockVII <= 8; blockVII += 1) {
      const total = 22 + mathematics + blockVII;
      tuples.push({
        block_units: {
          I: 6,
          II: 6,
          III: 3,
          IV: 4,
          V: mathematics,
          VI: 3,
          VII: blockVII,
        },
        fixed_blocks_i_iv_vi_units: 22,
        mathematics_units: mathematics,
        block_vii_units: blockVII,
        ucgs_units: total,
        allowed: total >= 31 && total <= 33,
      });
    }
  }
  return tuples;
}

/**
 * Reconstruct the exact source-owned UCGS cap carrier without choosing a
 * Block VII course. The cap is a numeric filter over an eventual selection:
 * open-roster identity affects which course can occupy Block VII, but cannot
 * alter the published sum of the seven block-unit values.
 */
function mountainGatewayUcgsComponentCap(document) {
  if (!claimsCollege(document, COLLEGES.mountainGateway)) {
    return { handled: false, ready: false, reason: 'not the reviewed Mountain Gateway document' };
  }
  const exact = exactReviewedDocument(document, COLLEGES.mountainGateway);
  if (!exact.supported) return { handled: true, ready: false, reason: exact.reason };
  const sourceBundleHash = text(document?.provenance?.source_bundle_hash);
  const documentStyleName = exact.proof?.document_style;
  const proofTreeSha256 = associateConflictProofTreeFingerprint(document);
  const expectedProofTreeSha256 =
    MOUNTAIN_GATEWAY_UCGS_PROOF_TREES[sourceBundleHash]?.[documentStyleName];
  if (!expectedProofTreeSha256 || proofTreeSha256 !== expectedProofTreeSha256) {
    return {
      handled: true,
      ready: false,
      reason: 'the reviewed Mountain Gateway whole authored course/rule/accounting tree changed',
    };
  }
  if (!exactMountainGatewayPublishedUnitAudit(document)) {
    return {
      handled: true,
      ready: false,
      reason: 'the reviewed Mountain Gateway program/component unit audit changed',
    };
  }
  const groups = asArray(document?.requirement_groups);
  const protectedOperational = sourceBundleHash
    === 'd9d62f38fd9f39cb89d3da1fa5c9ffbfe06bb698b400ef0030eb99a56ed83a79';
  if (groups.length !== 10 || MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.some((spec) => (
    !exactMountainGatewayUcgsGroup(groups[spec.index], spec, { protectedOperational })
  ))) {
    return {
      handled: true,
      ready: false,
      reason: 'one or more exact Mountain Gateway UCGS Block I-VII unit carriers changed',
    };
  }
  const matches = occurrences(document, 'published_ucgs_component_cap');
  const target = groups[5]?.analysis_constraints?.[0];
  if (matches.length !== 1
      || matches[0].owner !== groups[5]
      || matches[0].constraint !== target
      || text(target?.status).toLowerCase() !== 'evaluator_not_implemented'
      || text(target?.description) !== 'The UCGS component must remain within its published 31-33 credit total even though MTH 167 carries five credits.') {
    return {
      handled: true,
      ready: false,
      reason: 'the Mountain Gateway published UCGS cap is moved, duplicated, detached, or altered',
    };
  }
  const independentOpenKinds = [
    'choose_two_variable_credit_open_roster',
    'destination_selected_open_stem_roster',
    'destination_selected_transfer_core',
  ];
  if (independentOpenKinds.some((kind) => occurrences(document, kind).length !== 1)) {
    return {
      handled: true,
      ready: false,
      reason: 'an independent Mountain Gateway destination-selected component is absent or duplicated',
    };
  }
  const unitTuples = mountainGatewayUcgsUnitTuples();
  const allowed = unitTuples.filter((tuple) => tuple.allowed);
  const rejected = unitTuples.filter((tuple) => !tuple.allowed);
  if (allowed.length !== 6 || rejected.length !== 3
      || !exactSet(allowed.map((tuple) => tuple.ucgs_units), [31, 32, 33])
      || !exactSet(rejected.map((tuple) => tuple.ucgs_units), [34, 35])) {
    return {
      handled: true,
      ready: false,
      reason: 'the Mountain Gateway UCGS cap arithmetic no longer closes to the exact 31-33 feasible set',
    };
  }
  return {
    handled: true,
    ready: true,
    constraint: target,
    owner: groups[5],
    group_indices: MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.map((spec) => spec.index),
    unit_tuples: unitTuples,
    proof: {
      ...exact.proof,
      proof_tree_sha256: proofTreeSha256,
      expected_proof_tree_sha256: expectedProofTreeSha256,
      source_bound_rule: MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
      component_group_indices: MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.map((spec) => spec.index),
      exact_block_unit_ranges: Object.fromEntries(
        MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.map((spec) => [
          spec.block,
          { minimum: spec.minimum, maximum: spec.maximum },
        ]),
      ),
      fixed_blocks_i_iv_vi_units: 22,
      published_ucgs_units: { minimum: 31, maximum: 33 },
      raw_unit_tuple_count: unitTuples.length,
      allowed_unit_tuples: allowed.map((tuple) => ({
        mathematics_units: tuple.mathematics_units,
        block_vii_units: tuple.block_vii_units,
        ucgs_units: tuple.ucgs_units,
      })),
      rejected_unit_tuples: rejected.map((tuple) => ({
        mathematics_units: tuple.mathematics_units,
        block_vii_units: tuple.block_vii_units,
        ucgs_units: tuple.ucgs_units,
      })),
      computer_science_specific_prescribed_branch: false,
      destination_selected_course_identities_resolved: false,
      protected_partial_destination_roster_retained: protectedOperational,
      independent_open_constraint_kinds: independentOpenKinds,
    },
  };
}

/** Apply the exact cap to one eventual seven-block unit assignment. */
function evaluateMountainGatewayUcgsUnitAssignment(document, blockUnits) {
  const carrier = mountainGatewayUcgsComponentCap(document);
  if (!carrier.ready) return { ...carrier, allowed: false };
  const expectedBlocks = MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.map((spec) => spec.block);
  if (!blockUnits || typeof blockUnits !== 'object' || Array.isArray(blockUnits)
      || !exactSet(Object.keys(blockUnits), expectedBlocks)) {
    return {
      handled: true,
      ready: false,
      supported: false,
      allowed: false,
      reason: 'a UCGS cap assignment must provide exact unit values for Blocks I-VII',
      proof: carrier.proof,
    };
  }
  const normalized = Object.fromEntries(expectedBlocks.map((block) => [
    block, finite(blockUnits[block]),
  ]));
  if (MOUNTAIN_GATEWAY_UCGS_GROUP_SPECS.some((spec) => (
    normalized[spec.block] == null
      || !Number.isInteger(normalized[spec.block])
      || normalized[spec.block] < spec.minimum
      || normalized[spec.block] > spec.maximum
  ))) {
    return {
      handled: true,
      ready: false,
      supported: false,
      allowed: false,
      reason: 'a UCGS block unit value is outside its exact source-authored range',
      proof: carrier.proof,
    };
  }
  const ucgsUnits = Object.values(normalized).reduce((sum, units) => sum + units, 0);
  const allowed = ucgsUnits >= 31 && ucgsUnits <= 33;
  return {
    handled: true,
    ready: true,
    supported: true,
    allowed,
    block_units: normalized,
    ucgs_units: ucgsUnits,
    reason: allowed
      ? 'the exact seven-block assignment is within the published 31-33 UCGS cap'
      : 'the exact seven-block assignment exceeds the published 31-33 UCGS cap',
    proof: carrier.proof,
  };
}

function proveMountainGatewayPublishedUcgsCap(value, { owner, doc } = {}) {
  if (text(value?.kind) !== 'published_ucgs_component_cap'
      || !claimsCollege(doc, COLLEGES.mountainGateway)) return { handled: false };
  const carrier = mountainGatewayUcgsComponentCap(doc);
  if (!carrier.ready) return fail(carrier.reason);
  if (carrier.owner !== owner || carrier.constraint !== value
      || !exactAttachment(doc, owner, value, 'published_ucgs_component_cap')) {
    return fail(
      'the Mountain Gateway published UCGS cap is moved, duplicated, or detached from Block V',
    );
  }
  return {
    ...pass(
      'the exact retained UCGS source publishes one 31-33 total across Blocks I-VII; the evaluator rejects only the three 34-35 arithmetic combinations and does not choose any destination-selected course',
      ALL_ASSOCIATE_FIGURES,
      carrier.proof,
    ),
    resolved_constraint: {
      ...value,
      status: 'supported',
      source_bound_rule: MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
      evaluation_scope: 'source_bound_component_unit_sum',
      component_group_indices: [...carrier.group_indices],
      minimum_component_units: 31,
      maximum_component_units: 33,
      allowed_math_block_vii_unit_pairs: carrier.proof.allowed_unit_tuples.map((tuple) => ({
        mathematics_units: tuple.mathematics_units,
        block_vii_units: tuple.block_vii_units,
      })),
    },
  };
}

function exactBlueRidgeCategoryObject(actual, expected) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)
      || !exactSet(Object.keys(actual), Object.keys(expected))) return false;
  return Object.entries(expected).every(([category, values]) => (
    exactSet(actual[category], values)
  ));
}

function exactBlueRidgeOptionSet(document) {
  const optionSets = document?.option_sets;
  if (!optionSets || typeof optionSets !== 'object' || Array.isArray(optionSets)) return false;
  const block = optionSets.ucgs_block_ii;
  return block && typeof block === 'object' && !Array.isArray(block)
    && exactSet(Object.keys(block), ['source_refs', 'categories'])
    && exactSet(block.source_refs, ['general_education'])
    && exactBlueRidgeCategoryObject(block.categories, BLUE_RIDGE_CATEGORY_COURSES);
}

function exactBlueRidgeSection(section, units) {
  const receivers = asArray(section?.receivers);
  if (finite(section?.section_advisement) !== 1
      || finite(section?.unit_advisement) !== units
      || finite(section?.unit_advisement_max) !== units
      || !exactSet(section?.source_refs, ['major', 'general_education'])
      || receivers.length !== 1
      || text(receivers[0]?.options_conjunction).toLowerCase() !== 'or') return false;
  const options = asArray(receivers[0]?.options);
  const codes = options.map(optionCode);
  return options.length === BLUE_RIDGE_CODES.length
    && exactSet(codes, BLUE_RIDGE_CODES)
    && options.every((option, index) => (
      text(option?.course_conjunction).toLowerCase() === 'and'
      && asArray(option?.course_ids).length === 1
      && Number(option.course_ids[0]) === courseIdFor(codes[index])
    ));
}

function exactBlueRidgeConstraintShape(value, carrierStyle) {
  if (carrierStyle === 'checked_in_two_sections') {
    return text(value?.status).toLowerCase() === 'supported'
      && finite(value?.minimum_distinct_categories) === 2
      && exactBlueRidgeCategoryObject(
        value?.category_subjects,
        BLUE_RIDGE_CATEGORY_SUBJECTS,
      )
      && value?.category_courses == null
      && value?.evaluation_scope == null;
  }
  return text(value?.status).toLowerCase() === 'evaluator_not_implemented'
    && value?.minimum_distinct_categories == null
    && value?.category_subjects == null
    && value?.category_courses == null
    && value?.evaluation_scope == null;
}

function blueRidgeCarrierStyle(document, owner, value) {
  const bundle = text(document?.provenance?.source_bundle_hash);
  const candidateBundle = COLLEGES.blueRidge.sourceBundleHashes[0];
  const protectedBundle = COLLEGES.blueRidge.sourceBundleHashes[1];
  const common = text(owner?.group_conjunction).toLowerCase() === 'and'
    && owner?.distinct_course_ids_across_sections === true
    && owner?.distinct_areas == null
    && owner?.ge_area == null
    && owner?.units_fill !== true
    && exactSet(owner?.source_refs, ['major', 'general_education'])
    && asArray(owner?.analysis_constraints).length === 1
    && exactBlueRidgeOptionSet(document);
  if (!common) return null;
  const sections = asArray(owner?.sections);
  if (bundle === candidateBundle
      && sections.length === 2
      && sections.every((section) => exactBlueRidgeSection(section, 3))
      && exactBlueRidgeConstraintShape(value, 'checked_in_two_sections')) {
    return 'checked_in_two_sections';
  }
  if (bundle === protectedBundle
      && sections.length === 1
      && exactBlueRidgeSection(sections[0], 6)
      && exactBlueRidgeConstraintShape(value, 'protected_folded_section')) {
    return 'protected_folded_section';
  }
  return null;
}

function resolvedBlueRidgeConstraint(value) {
  return {
    ...value,
    minimum_distinct_categories: 2,
    category_courses: Object.fromEntries(Object.entries(BLUE_RIDGE_CATEGORY_COURSES)
      .map(([category, codes]) => [category, [...codes]])),
    category_evidence: {
      kind: 'source_bound_exact_course_categories',
      source_bound_rule: BLUE_RIDGE_SOURCE_BOUND_RULE,
      source_refs: ['major', 'general_education'],
      course_count: BLUE_RIDGE_CODES.length,
      category_count: Object.keys(BLUE_RIDGE_CATEGORY_COURSES).length,
    },
    source_bound_rule: BLUE_RIDGE_SOURCE_BOUND_RULE,
  };
}

function proveBlueRidgeDistinctAreas(value, { owner, doc } = {}) {
  const kind = text(value?.kind);
  if (kind !== 'distinct_ge_areas' || !claimsCollege(doc, COLLEGES.blueRidge)) {
    return { handled: false };
  }
  const exact = exactReviewedDocument(doc, COLLEGES.blueRidge);
  if (!exact.supported) return exact;
  if (!exactAttachment(doc, owner, value, kind)) {
    return fail(
      'the Blue Ridge distinct-category declaration is moved, duplicated, or detached from its exact carrier',
    );
  }
  const carrierStyle = blueRidgeCarrierStyle(doc, owner, value);
  if (!carrierStyle) {
    return fail(
      'the Blue Ridge Block II source dictionary, two-choice carrier, or declaration changed',
    );
  }
  return {
    ...pass(
      'the exact official Block II roster and program footnote require two three-credit courses from different source-defined categories',
      ALL_ASSOCIATE_FIGURES,
      {
        ...exact.proof,
        source_bound_rule: BLUE_RIDGE_SOURCE_BOUND_RULE,
        carrier_style: carrierStyle,
        selected_courses: 2,
        selected_units: 6,
        minimum_distinct_categories: 2,
        category_courses: Object.fromEntries(Object.entries(BLUE_RIDGE_CATEGORY_COURSES)
          .map(([category, codes]) => [category, [...codes]])),
        figure_impact: 'the exact category assignment can change the selected course in Figures 3, 4, and 6 without changing the fixed six-credit block total',
      },
    ),
    resolved_constraint: resolvedBlueRidgeConstraint(value),
  };
}

function exactBlueRidgeGeneralEducationCarrier(owner, value) {
  const constraints = asArray(owner?.analysis_constraints);
  const sections = asArray(owner?.sections);
  if (text(owner?.title) !== 'General Education Elective'
      || text(owner?.group_conjunction).toLowerCase() !== 'and'
      || owner?.ge_area != null
      || owner?.units_fill === true
      || !exactSet(owner?.source_refs, ['major', 'elective'])
      || constraints.length !== 2
      || constraints[0] !== value
      || text(constraints[0]?.kind) !== 'alternative_course_credit_mismatch'
      || text(constraints[0]?.status).toLowerCase() !== 'evaluator_not_implemented'
      || text(constraints[0]?.description) !== 'The evaluator cannot close the printed four-credit slot when a listed three-credit option is selected because the source states no compensating-credit rule.'
      || text(constraints[1]?.kind) !== 'no_double_count_across_requirement_slots'
      || sections.length !== 1) return false;
  const section = sections[0];
  const receivers = asArray(section?.receivers);
  if (finite(section?.section_advisement) !== 1
      || finite(section?.unit_advisement) !== 4
      || finite(section?.unit_advisement_max) !== 4
      || !exactSet(section?.source_refs, ['major', 'elective'])
      || asArray(section?.analysis_constraints).length !== 0
      || receivers.length !== 1
      || text(receivers[0]?.options_conjunction).toLowerCase() !== 'or') return false;
  const options = asArray(receivers[0]?.options);
  const codes = options.map(optionCode);
  if (options.length !== BLUE_RIDGE_GENERAL_EDUCATION_CODES.length
      || !exactSet(codes, BLUE_RIDGE_GENERAL_EDUCATION_CODES)
      || !options.every((option, index) => (
        text(option?.course_conjunction).toLowerCase() === 'and'
        && asArray(option?.course_ids).length === 1
        && Number(option.course_ids[0]) === courseIdFor(codes[index])
      ))) return false;
  return true;
}

/**
 * Blue Ridge's conflict is not evaluator work. The retained program page
 * prints a four-credit slot, the retained approved menu includes six exact
 * three-credit alternatives, and the retained graduation rule requires both
 * the specified courses and credit hours. No source in the complete reviewed
 * bundle authorizes a filler or cross-category credit. Keep every paper figure
 * closed and return the exact missing source fact instead of guessing one.
 */
function proveBlueRidgeAlternativeCreditMismatch(value, { owner, doc } = {}) {
  const kind = text(value?.kind);
  if (kind !== 'alternative_course_credit_mismatch'
      || !claimsCollege(doc, COLLEGES.blueRidge)) return { handled: false };
  const exact = exactReviewedDocument(doc, COLLEGES.blueRidge);
  if (!exact.supported) return exact;
  if (!exactAttachment(doc, owner, value, kind)) {
    return fail(
      'the Blue Ridge four-credit General Education Elective conflict is moved, duplicated, or detached from its exact carrier',
    );
  }
  if (!exactBlueRidgeGeneralEducationCarrier(owner, value)) {
    return fail(
      'the Blue Ridge four-credit General Education Elective carrier, exact approved roster, or conflict declaration changed',
    );
  }
  const optionSet = doc?.option_sets?.general_education_elective;
  if (!optionSet || finite(optionSet?.printed_slot_credits) !== 4
      || !exactSet(optionSet?.source_refs, ['major', 'elective'])
      || !exactSet(optionSet?.courses, BLUE_RIDGE_GENERAL_EDUCATION_CODES)) {
    return fail('the Blue Ridge source-owned General Education Elective dictionary changed');
  }
  return fail(
    'the exact official source still authorizes three-credit alternatives inside a printed four-credit category and supplies no filler or compensating-credit rule',
    ALL_ASSOCIATE_FIGURES,
    {
      ...exact.proof,
      printed_slot_units: 4,
      exact_option_count: BLUE_RIDGE_GENERAL_EDUCATION_CODES.length,
      exact_three_credit_options: [...BLUE_RIDGE_THREE_CREDIT_GENERAL_EDUCATION_CODES],
      graduation_rule: 'fulfill all course and credit hour requirements specified in the catalog',
      missing_source_fact: 'an official filler/compensating-credit rule or a corrected four-credit-only option roster',
      source_conflict_reconciled: false,
    },
  );
}

function exactStructuredSectionRange(document) {
  let minimum = 0;
  let maximum = 0;
  for (const group of asArray(document?.requirement_groups)) {
    if (group?.is_required === false
        || text(group?.group_conjunction).toLowerCase() !== 'and'
        || group?.units_fill === true
        || group?.ge_area != null
        || finite(group?.units) != null) return null;
    const sections = asArray(group?.sections);
    if (!sections.length) return null;
    for (const section of sections) {
      const lower = finite(section?.unit_advisement);
      const upper = finite(section?.unit_advisement_max);
      if (lower == null || upper == null || lower < 0 || upper < lower
          || asArray(section?.receivers).length === 0) return null;
      minimum += lower;
      maximum += upper;
    }
  }
  return { minimum, maximum };
}

/**
 * Laurel Ridge's printed 64-credit maximum is not reconciled here. It remains
 * a complete-degree and Figure 6 source blocker because the missing one-credit
 * explanation could carry a course/prerequisite identity. Figures 3/4 use the
 * stated 60-credit minimum as their denominator, however, and their strict
 * planner can select only the closed authored tree. That tree has an exact
 * 60-63 range, so changing the loose upper ceiling from 64 to 63 removes no
 * feasible Figure 3/4 plan and changes no numerator or denominator.
 */
function proveLaurelRidgePublishedMaximumConflict(value, { owner, doc } = {}) {
  const kind = text(value?.kind);
  if (kind !== 'published_maximum_source_conflict'
      || !claimsCollege(doc, COLLEGES.laurelRidge)) return { handled: false };
  const exact = exactReviewedDocument(doc, COLLEGES.laurelRidge);
  if (!exact.supported) return exact;
  if (!exactAttachment(doc, owner, value, kind) || owner !== doc?.unit_audit) {
    return fail(
      'the Laurel Ridge published-maximum conflict is moved, duplicated, or detached from the degree-wide unit audit',
    );
  }
  if (text(value?.status).toLowerCase() !== 'evaluator_not_implemented'
      || text(value?.description) !== 'The printed requirement rows model at most 63 credits while the same page publishes a 64-credit program maximum.'
      || asArray(owner?.analysis_constraints).length !== 1
      || finite(owner?.published_program_units_minimum) !== 60
      || finite(owner?.published_program_units_maximum) !== 64
      || finite(owner?.modeled_units_minimum) !== 60
      || finite(owner?.modeled_units_maximum) !== 63
      || finite(owner?.fixed_requirements_before_electives) !== 55
      || finite(owner?.printed_elective_units_minimum) !== 5
      || finite(owner?.printed_elective_units_maximum) !== 8) {
    return fail('the exact Laurel Ridge published/modelled unit audit changed');
  }
  const range = exactStructuredSectionRange(doc);
  if (!range || range.minimum !== 60 || range.maximum !== 63) {
    return fail('the Laurel Ridge structured requirement tree no longer proves the exact 60-63 range');
  }
  const electiveGroups = asArray(doc?.requirement_groups).filter((group) => (
    asArray(group?.analysis_constraints).some((constraint) => (
      text(constraint?.kind) === 'variable_credit_exactly_two_course_choice'
    ))
  ));
  if (electiveGroups.length !== 1) {
    return fail('the Laurel Ridge exact two-course elective carrier is absent or duplicated');
  }
  const elective = electiveGroups[0];
  const electiveSection = asArray(elective?.sections)[0];
  if (asArray(elective?.sections).length !== 1
      || finite(electiveSection?.section_advisement) !== 2
      || finite(electiveSection?.unit_advisement) !== 5
      || finite(electiveSection?.unit_advisement_max) !== 8
      || !exactSet(asArray(electiveSection?.receivers).map((receiver) => (
        optionCode(asArray(receiver?.options)[0])
      )), LAUREL_RIDGE_ELECTIVE_CODES)
      || asArray(electiveSection?.receivers).some((receiver) => (
        asArray(receiver?.options).length !== 1
      ))) {
    return fail('the Laurel Ridge exact two-course, 5-8 credit elective carrier changed');
  }
  const treeSha256 = associateConflictProofTreeFingerprint(doc);
  if (treeSha256 !== LAUREL_RIDGE_PROOF_TREE_SHA256) {
    return fail('the Laurel Ridge whole authored course/rule/accounting tree changed');
  }
  return fail(
    'Figures 3/4 use the exact published 60-credit minimum and a structured plan whose maximum is 63; the unexplained published 64-credit ceiling cannot change either paper value, but remains open for Figure 6 and complete-degree analysis',
    ['6'],
    {
      ...exact.proof,
      proof_tree_sha256: treeSha256,
      published_units: { minimum: 60, maximum: 64 },
      structured_units: { minimum: 60, maximum: 63 },
      fixed_units_before_electives: 55,
      elective_rule: { selected_courses: 2, minimum_units: 5, maximum_units: 8 },
      figure_3_4_denominator_units: 60,
      figure_3_4_feasible_set_change_if_ceiling_is_63: 0,
      missing_source_fact_for_figure_6: 'the official source of the unexplained one-credit maximum, including any course identity and prerequisites',
      source_conflict_reconciled: false,
    },
  );
}

/**
 * Runtime view of Blue Ridge's exact choose-two Block II carrier.
 *
 * The checked-in source already has two one-course sections. The protected
 * operational core predates that representation and stores the same menu as
 * one six-credit, one-choice section. Its exact source bundle and official
 * footnote prove that this is a folded two-choice carrier, so the planner may
 * raise only the runtime selection count from one to two. No source document
 * or verified core is rewritten.
 */
function blueRidgeDistinctAreaRuntimeCarrier(document) {
  const collegeClaim = claimsCollege(document, COLLEGES.blueRidge);
  const matches = occurrences(document, 'distinct_ge_areas');
  // Numeric id 9301 also appears in compact service fixtures that are not
  // representations of the reviewed Blue Ridge source. Do not commandeer
  // those fixtures unless the source/bundle is recognizable or the exact
  // source rule is actually present. A real document with stripped evidence
  // still takes the fail-closed path because it retains the rule carrier.
  if (!collegeClaim || (!hasReviewedSourceSignal(document, COLLEGES.blueRidge)
      && matches.length === 0)) {
    return { handled: false, ready: false, reason: 'not the reviewed Blue Ridge document' };
  }
  if (matches.length !== 1) {
    return {
      handled: true,
      ready: false,
      reason: 'the exact Blue Ridge distinct-category declaration is absent or duplicated',
    };
  }
  const row = matches[0];
  const proof = proveBlueRidgeDistinctAreas(row.constraint, {
    owner: row.owner,
    doc: document,
  });
  if (!proof.supported) {
    return { handled: true, ready: false, reason: proof.reason };
  }
  const protectedFold = proof.proof.carrier_style === 'protected_folded_section';
  const sections = protectedFold
    ? [{ ...structuredClone(row.owner.sections[0]), section_advisement: 2 }]
    : row.owner.sections;
  return {
    handled: true,
    ready: true,
    group: row.owner,
    group_index: asArray(document?.requirement_groups).indexOf(row.owner),
    sections,
    source_bound_rule: BLUE_RIDGE_SOURCE_BOUND_RULE,
    proof: proof.proof,
  };
}

function exactNewRiverLabSection(section) {
  const receivers = asArray(section?.receivers);
  if (finite(section?.section_advisement) !== 1
      || finite(section?.unit_advisement) !== 4
      || finite(section?.unit_advisement_max) !== 4
      || !exactSet(section?.source_refs, ['major'])
      || receivers.length !== 1
      || text(receivers[0]?.options_conjunction).toLowerCase() !== 'or') return false;
  const options = asArray(receivers[0]?.options);
  const codes = options.map(optionCode);
  return options.length === NEW_RIVER_LAB_CODES.length
    && exactSet(codes, NEW_RIVER_LAB_CODES)
    && options.every((option, index) => (
      text(option?.course_conjunction).toLowerCase() === 'and'
      && asArray(option?.course_ids).length === 1
      && Number(option.course_ids[0]) === courseIdFor(codes[index])
    ));
}

function exactFixedCourseSections(document, code, units) {
  const matches = [];
  for (const group of asArray(document?.requirement_groups)) {
    for (const section of asArray(group?.sections)) {
      const receivers = asArray(section?.receivers);
      if (finite(section?.section_advisement) !== 1
          || finite(section?.unit_advisement) !== units
          || finite(section?.unit_advisement_max) !== units
          || receivers.length !== 1) continue;
      const options = asArray(receivers[0]?.options);
      if (options.length === 1 && optionCode(options[0]) === code
          && asArray(options[0]?.course_ids).length === 1
          && Number(options[0].course_ids[0]) === courseIdFor(code)) matches.push(section);
    }
  }
  return matches;
}

function proveNewRiverLaboratoryCompatibility(value, { owner, doc } = {}) {
  const kind = text(value?.kind);
  if (kind !== 'prerequisite_and_sequence_compatibility'
      || !claimsCollege(doc, COLLEGES.newRiver)) return { handled: false };
  const exact = exactReviewedDocument(doc, COLLEGES.newRiver);
  if (!exact.supported) return { ...exact, affected_figures: ['6'] };
  if (!exactAttachment(doc, owner, value, kind)) {
    return fail(
      'the New River laboratory compatibility declaration is moved, duplicated, or detached from its exact carrier',
      ['6'],
    );
  }
  const sections = asArray(owner?.sections);
  if (text(value?.status).toLowerCase() !== 'evaluator_not_implemented'
      || text(owner?.group_conjunction).toLowerCase() !== 'and'
      || owner?.distinct_course_ids_across_sections !== true
      || owner?.ge_area != null
      || !exactSet(owner?.source_refs, ['major'])
      || asArray(owner?.analysis_constraints).length !== 1
      || sections.length !== 2
      || !sections.every(exactNewRiverLabSection)) {
    return fail(
      'the New River two-slot, distinct-course laboratory carrier or exact seven-course roster changed',
      ['6'],
    );
  }
  return pass(
    'the degree tree already enforces two distinct fixed four-credit choices; same-discipline sequencing is advisory, while Figure 6 remains gated on the exact VCCS prerequisite publication',
    ['6'],
    {
      ...exact.proof,
      fixed_sections: 2,
      selections_per_section: 1,
      units_per_section: 4,
      exact_course_codes: [...NEW_RIVER_LAB_CODES],
      deterministic_figure_6_course_codes: [...NEW_RIVER_FIGURE_6_LAB_CODES],
      destination_sequence_is_advisory: true,
      figure_3_4_increment_units: 0,
      figure_6_runtime_gate: 'validated exact VCCS prerequisite publication',
    },
  );
}

/**
 * Give Figure 6 one deterministic, source-valid laboratory choice without
 * narrowing Figures 3/4's transfer-oriented optimization. GOL 105 has no
 * prerequisite in the exact VCCS publication; PHY 241's sole course
 * prerequisite is the fixed MTH 263 already present in this degree. The
 * Figure 6 runtime still revalidates both formulas against its active human
 * publication receipt, so this selector cannot bypass changed requisite data.
 */
function newRiverFigure6LaboratorySelection(document) {
  const matches = occurrences(document, 'prerequisite_and_sequence_compatibility');
  if (matches.length !== 1) {
    return { ready: false, reason: 'the exact New River laboratory rule is absent or duplicated' };
  }
  const row = matches[0];
  const proof = proveNewRiverLaboratoryCompatibility(row.constraint, {
    owner: row.owner,
    doc: document,
  });
  if (!proof.supported) return { ready: false, reason: proof.reason };
  if (exactFixedCourseSections(document, 'MTH263', 4).length !== 1) {
    return {
      ready: false,
      reason: 'the exact fixed four-credit MTH 263 prerequisite carrier changed',
    };
  }
  return {
    ready: true,
    group: row.owner,
    group_index: asArray(document?.requirement_groups).indexOf(row.owner),
    course_codes: [...NEW_RIVER_FIGURE_6_LAB_CODES],
    course_ids: NEW_RIVER_FIGURE_6_LAB_CODES.map(courseIdFor),
    proof: proof.proof,
  };
}

function evaluateAssociateCollegeConstraint(value, context = {}) {
  const blueRidgeCreditConflict = proveBlueRidgeAlternativeCreditMismatch(value, context);
  if (blueRidgeCreditConflict.handled) return blueRidgeCreditConflict;
  const blueRidge = proveBlueRidgeDistinctAreas(value, context);
  if (blueRidge.handled) return blueRidge;
  const laurelRidge = proveLaurelRidgePublishedMaximumConflict(value, context);
  if (laurelRidge.handled) return laurelRidge;
  const nova = proveNorthernVirginiaConstraint(value, context);
  if (nova.handled) return nova;
  const newRiver = proveNewRiverLaboratoryCompatibility(value, context);
  if (newRiver.handled) return newRiver;
  const mountainGateway = proveMountainGatewayPublishedUcgsCap(value, context);
  if (mountainGateway.handled) return mountainGateway;
  // Loaded lazily because the Rappahannock receipt reuses this module's
  // normalized whole-tree fingerprint. Evaluation happens only after both
  // modules have completed initialization, avoiding a partial circular export.
  const {
    proveRappahannockApprovedTransferElectiveCombinations,
    proveRappahannockPairedMathematics,
    proveRappahannockReceivingProgramAlignment,
  } = require('./rappahannockRichardBlandConstraintProofs');
  for (const proveRappahannock of [
    proveRappahannockApprovedTransferElectiveCombinations,
    proveRappahannockPairedMathematics,
    proveRappahannockReceivingProgramAlignment,
  ]) {
    const rappahannock = proveRappahannock(value, context);
    if (rappahannock.handled) return rappahannock;
  }
  return { handled: false };
}

module.exports = {
  ALL_ASSOCIATE_FIGURES,
  BLUE_RIDGE_CATEGORY_COURSES,
  BLUE_RIDGE_GENERAL_EDUCATION_CODES,
  BLUE_RIDGE_SOURCE_BOUND_RULE,
  BLUE_RIDGE_THREE_CREDIT_GENERAL_EDUCATION_CODES,
  COLLEGES,
  LAUREL_RIDGE_ELECTIVE_CODES,
  LAUREL_RIDGE_PROOF_TREE_SHA256,
  MOUNTAIN_GATEWAY_UCGS_PROOF_TREE_SHA256,
  MOUNTAIN_GATEWAY_UCGS_PROOF_TREES,
  MOUNTAIN_GATEWAY_UCGS_SOURCE_BOUND_RULE,
  NEW_RIVER_FIGURE_6_LAB_CODES,
  NEW_RIVER_LAB_CODES,
  associateConflictProofTreeFingerprint,
  blueRidgeDistinctAreaRuntimeCarrier,
  evaluateAssociateCollegeConstraint,
  evaluateMountainGatewayUcgsUnitAssignment,
  exactReviewedDocument,
  mountainGatewayUcgsComponentCap,
  mountainGatewayUcgsUnitTuples,
  northernVirginiaFigure34Aggregates,
  newRiverFigure6LaboratorySelection,
  proveBlueRidgeDistinctAreas,
  proveBlueRidgeAlternativeCreditMismatch,
  proveLaurelRidgePublishedMaximumConflict,
  proveMountainGatewayPublishedUcgsCap,
  proveNewRiverLaboratoryCompatibility,
  proveNorthernVirginiaConstraint,
};
