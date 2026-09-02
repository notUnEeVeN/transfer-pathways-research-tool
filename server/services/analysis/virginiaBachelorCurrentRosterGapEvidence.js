/**
 * Fail-closed source audit for the two highest-leverage remaining bachelor
 * roster gaps.  It records what the current official sources prove and, just
 * as importantly, what their exact response boundaries do not prove.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const ROOT = path.resolve(__dirname, '../..');
const RMC_DIR = path.join(
  ROOT,
  '.va-catalogs/research/randolph-macon-mymaconweb-current-roster-sources',
);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const text = (value) => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const code = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const UVA_SOURCES = Object.freeze({
  ge: Object.freeze({
    file: '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__ge.txt',
    sha256: 'eeaf89b77c60ab9b29edf6ee9f11fe89bd2ef7bef2b04a9c686196ffabd88a11',
  }),
  major: Object.freeze({
    file: '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__program.txt',
    sha256: '351dcdfb593b6eb07d8a13d406e1b63bb383ce0f5e132ae7b96b09309348f944',
  }),
  course_catalog_page_1: Object.freeze({
    file: '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__course_catalog.txt',
    sha256: '8550e101ff93853ec8ad3e5a4786c6a96ba45c9f002ae7aeb9c8a73926f03f93',
  }),
  inclusive_excellence: Object.freeze({
    file: '.va-catalogs/research/uva-wise-ge-roster-sources/inclusive-excellence.html',
    sha256: '948e602804a30b70807ac62979aea7361e56772d7ccac50b5cd08a9d44bb8b68',
  }),
  catalog_robots: Object.freeze({
    file: '.va-catalogs/university-prerequisites/raw/_robots/catalog.uvawise.edu__http.txt',
    sha256: '1dfe956a6b5e20dc3c081043faf71e746170ae4dfefa0f00c2bacc8dc8c8a0c3',
  }),
  transfer_policy: Object.freeze({
    file: '.va-catalogs/research/uva-wise-vccs-transfer-policy-evidence.json',
    sha256: 'ebdc7cf04dd1a00f05e523e3472cade34444db70b8d55814fd734d4a822d81d7',
  }),
});

const RMC_HASHES = Object.freeze({
  robots: 'dc1d54dab6ec8c00f70137927504e4f222c8395f10760b6beecfcfa94e08249f',
  academics_collegiate_requirements: '97b000a6d99e0a47637b7486ad6f6a5d849a797c666ab90533bb334371d13c4e',
  curriculum21_landing: '752cbd3c524290787e0de721c419b62a32a17d64264055645d8ef754d3818cdb',
  curriculum21_all_courses_query: '9bd67f94499f35bf16e4e7f5026a95f6daf17016ecfc7b1b9501265020200b23',
  curriculum21_all_courses_data: '3403080867e350722bc0c0fe52e293aee169057d49fdce4ef88da50fdb4c551f',
  curriculum21_fall_2026_data: '7fb190120dcc02f2f54b98f397546039e6edeab975a9bfb64122d1b946d7717c',
  curriculum21_jterm_2027_data: '720768d3b9ef133a6c620fb43196fd80b070d19b3318a1897afb03c25b076d60',
  curriculum21_spring_2027_data: 'cb412cb2fd9f87be057c01439aeebaec92e69a8ab2db92b2c634aba5acd8dd40',
});

const QUERY_COLUMNS = Object.freeze([
  ['course', 'Course'],
  ['coursetitle', 'Course Title'],
  ['effectivecommunication', 'Effective Communication'],
  ['pillarsofliberalarts', 'Pillars of Liberal Arts'],
  ['writingattentive', 'Writing Attentive'],
  ['hussns', 'HU/SS/NS'],
  ['crossarearequirements', 'Cross-Area Requirements'],
  ['lastoffered', 'Last Offered'],
  ['courseinformation', 'Course Information'],
]);

function exactFile(spec, overrides = {}) {
  const bytes = overrides[spec.file] ?? fs.readFileSync(path.join(ROOT, spec.file));
  if (sha256(bytes) !== spec.sha256) throw new Error(`source hash changed: ${spec.file}`);
  return bytes;
}

function auditUvaWiseCurrentRosterGaps(overrides = {}) {
  const ge = exactFile(UVA_SOURCES.ge, overrides).toString('utf8');
  const major = exactFile(UVA_SOURCES.major, overrides).toString('utf8');
  const listing = exactFile(UVA_SOURCES.course_catalog_page_1, overrides).toString('utf8');
  const ie = exactFile(UVA_SOURCES.inclusive_excellence, overrides).toString('utf8');
  const robots = exactFile(UVA_SOURCES.catalog_robots, overrides).toString('utf8');
  const transfer = JSON.parse(exactFile(UVA_SOURCES.transfer_policy, overrides));
  const majorRule = 'BIO XXXX/LAB, CHM XXXX/LAB, ENV XXXX/LAB, GLG XXXX/LAB or PHY XXXX/LAB - At least two natural science with associated labs. Courses must be chosen from biology, chemistry, environmental science, geology or physics. Credit(s) 8-10 *';
  const ieRule = 'Inclusive Excellence (IE) – At least one course (minimum 3 credit hours) taken in the Liberal Arts Core Curriculum must be deignated as IE.';
  const issues = [];
  if (!ge.includes(ieRule)) issues.push('ie_requirement_changed');
  if (!text(major).includes(text(majorRule))) issues.push('major_lab_rule_changed');
  if (!listing.includes('2026-2027 UVA Wise Catalog')) issues.push('course_listing_edition_changed');
  if (!/Page:\s*1\s*\|\s*2[\s\S]*Forward 10 -> 13/.test(listing)) {
    issues.push('course_listing_pagination_boundary_changed');
  }
  if (!ie.includes('IE course interest?') || !ie.includes("Contact Registrar's Office")) {
    issues.push('ie_office_boundary_changed');
  }
  if (!robots.includes('crawl-delay: 120')) issues.push('catalog_robots_changed');
  if (transfer?.paper_interpretation?.qualifying_vccs_sender_count !== 18
      || transfer?.paper_interpretation?.major_specific_two_lab_sciences_waived !== false
      || transfer?.paper_interpretation?.bachelor_source_constraints_cleared_without_pair_context !== false
      || transfer?.paper_interpretation?.figure_3_4_cells_made_ready_without_lab_science_proof !== 0) {
    issues.push('transfer_pair_boundary_changed');
  }
  if (issues.length) throw new Error(issues.join(', '));
  return {
    institution: 'The University of Virginia’s College at Wise',
    catalog_year: '2026-2027',
    source_receipts: Object.fromEntries(Object.entries(UVA_SOURCES).map(([id, value]) => (
      [id, { path: value.file, sha256: value.sha256 }]
    ))),
    inclusive_excellence: {
      requirement_proved: true,
      current_exact_designation_roster_proved: false,
      exact_negative_receipt: 'The current official IE page defines the designation and directs course interest to the Registrar; it publishes no course membership rows. The exact catalog GE page states the requirement but likewise publishes no IE roster.',
      required_input: 'A current Registrar/Liberal Arts Committee export or signed course-level IE designation roster for the 2026-2027 cohort.',
    },
    cs_major_lab_science: {
      five_prefix_rule_proved: true,
      prefixes: ['BIO', 'CHM', 'ENV', 'GLG', 'PHY'],
      full_catalog_capture_proved: false,
      retained_course_listing_page: 1,
      advertised_course_listing_pages: 13,
      closed_eligible_lab_roster_proved: false,
      sender_pair_qualification_proved: false,
      qualifying_sender_contexts_with_policy_receipts: 18,
      figure_3_4_cells_closed_by_this_probe: 0,
      exact_negative_receipt: 'The retained official “Full Course Listing” response is only page 1 of 13, and the major uses prefix wildcards rather than enumerated lecture/lab pairs. The 18 sender-policy receipts do not decide which incoming pair satisfies two distinct major sciences.',
      required_input: 'All 13 current catalog pages (or an official complete course export) plus exact UVA Wise transfer-equivalency/application decisions for each sender’s two distinct lecture/lab science pairs.',
    },
    whole_bachelor_document_safe_to_integrate: false,
  };
}

function rmcSource(id, overrides = {}) {
  const extension = id === 'robots' ? 'txt' : id.endsWith('_data') ? 'json' : 'html';
  const relative = `.va-catalogs/research/randolph-macon-mymaconweb-current-roster-sources/${id}.${extension}`;
  const bytes = overrides[relative] ?? fs.readFileSync(path.join(ROOT, relative));
  const receiptPath = path.join(RMC_DIR, `${id}.receipt.json`);
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  if (sha256(bytes) !== RMC_HASHES[id]
      || receipt.response_sha256 !== RMC_HASHES[id]
      || receipt.response_bytes !== bytes.length) throw new Error(`RMC receipt changed: ${id}`);
  return bytes.toString('utf8');
}

function queryPayload(source, expectedColumns, expectedRows) {
  const value = JSON.parse(source)?.d;
  if (value?.success !== true || value?.data?.length !== expectedRows
      || JSON.stringify(value.columns.map(({ name, title }) => [name, title]))
        !== JSON.stringify(expectedColumns)
      || value.data.some((row) => row.length !== expectedColumns.length)) {
    throw new Error('RMC query response shape changed');
  }
  return value;
}

function membershipCounts(rows) {
  const fields = [
    ['effective_communication', 2], ['pillars', 3], ['writing_attentive', 4],
    ['distribution', 5], ['cross_area', 6],
  ];
  return Object.fromEntries(fields.map(([name, index]) => {
    const counts = new Map();
    for (const row of rows) {
      for (const value of String(row[index]).split(',').map(text).filter(Boolean)) {
        counts.set(value, (counts.get(value) || 0) + 1);
      }
    }
    return [name, Object.fromEntries([...counts].sort())];
  }));
}

function auditRandolphMaconCurrentRosterGap(overrides = {}) {
  const robots = rmcSource('robots', overrides);
  const academics = rmcSource('academics_collegiate_requirements', overrides);
  const landing = rmcSource('curriculum21_landing', overrides);
  const query = rmcSource('curriculum21_all_courses_query', overrides);
  const all = queryPayload(rmcSource('curriculum21_all_courses_data', overrides), QUERY_COLUMNS, 745);
  const termColumns = QUERY_COLUMNS.slice(0, 7);
  const fall = queryPayload(rmcSource('curriculum21_fall_2026_data', overrides), termColumns, 216);
  const jterm = queryPayload(rmcSource('curriculum21_jterm_2027_data', overrides), termColumns, 74);
  const springRaw = JSON.parse(rmcSource('curriculum21_spring_2027_data', overrides))?.d;
  const issues = [];
  if (!robots.includes('404 - File or directory not found.')) issues.push('robots_404_body_changed');
  if (!academics.includes('Courses Approved for Curriculum21')) issues.push('official_entry_link_changed');
  for (const marker of ['View All Courses', 'Listed in the RMC catalog', 'Offered for Fall 2026', 'Offered for J-Term 2027', 'Offered for Spring 2027']) {
    if (!landing.includes(marker)) issues.push(`landing:${marker}`);
  }
  if (!query.includes('Curriculum21 Courses')
      || !query.includes('9e1fb40b-9fad-4eeb-bcfa-25363794acfa')
      || !query.includes('action: "RunQuery"')
      || !query.includes('Export_Data.aspx?format=csv')) issues.push('all_courses_query_contract_changed');
  if (springRaw?.success !== true
      || JSON.stringify(springRaw.columns?.map(({ name, title }) => [name, title]))
        !== JSON.stringify([['courses', 'Courses']])
      || JSON.stringify(springRaw.data) !== JSON.stringify([['Spring courses are not yet available']])) {
    issues.push('spring_unavailable_receipt_changed');
  }
  const normalized = all.data.map((row) => ({ code: code(row[0]), row: row.map(text) }));
  const unique = new Set(normalized.map((row) => row.code));
  const comm201 = normalized.filter((row) => row.code === 'COMM201');
  if (unique.size !== 743 || comm201.length !== 3
      || new Set(comm201.map((row) => JSON.stringify(row.row))).size !== 1
      || normalized.some(({ code: value, row }) => !value || row.slice(2, 7).every((entry) => !entry))) {
    issues.push('all_courses_row_contract_changed');
  }
  if (issues.length) throw new Error(issues.join(', '));
  return {
    institution: 'Randolph-Macon College',
    current_cycle_proved_by_official_landing: ['Fall 2026', 'J-Term 2027', 'Spring 2027'],
    robots: { http_status: 404, policy_file_published: false, sha256: RMC_HASHES.robots },
    official_query_receipts: Object.fromEntries(Object.entries(RMC_HASHES).map(([id, hash]) => (
      [id, { sha256: hash }]
    ))),
    all_catalog_courses_query: {
      response_complete: true,
      row_occurrences: 745,
      unique_course_codes: 743,
      exact_duplicate: { code: 'COMM201', occurrences: 3, byte_identical_rows: true },
      membership_counts: membershipCounts(all.data),
    },
    current_offering_queries: {
      fall_2026_rows: fall.data.length,
      jterm_2027_rows: jterm.data.length,
      spring_2027_rows: 0,
      spring_2027_exact_response: 'Spring courses are not yet available',
    },
    exhaustive_current_collegiate_membership_proved: false,
    negative_membership_inference_allowed: false,
    exact_negative_receipt: 'MyMaconWeb returns a complete 745-row “all courses listed in the RMC catalog” result and complete Fall/J-Term offering results, but its Spring 2027 query explicitly says courses are not yet available. The hidden query definition is not exposed, so these bytes cannot prove the absent temporary, special-topics, and future Spring memberships that the catalog says require MyMaconWeb.',
    required_input: 'Repeat and retain all three term queries after Spring 2027 is published, or obtain a Registrar export explicitly certified as exhaustive for all current Curriculum21 attributes and temporary/recent approvals.',
    whole_bachelor_document_safe_to_integrate: false,
    independent_remaining_document_blockers: [
      'Registrar foreign-language proficiency and curricular-project application decisions',
      'conflicting physical-education wording',
      'program-level transfer-credit application decisions',
      'final independent current-source approval receipt',
    ],
  };
}

function buildVirginiaBachelorCurrentRosterGapEvidence(overrides = {}) {
  return {
    schema_version: 1,
    artifact: 'virginia_bachelor_current_roster_source_gap_evidence',
    generated_on: '2026-08-25',
    uva_wise: auditUvaWiseCurrentRosterGaps(overrides),
    randolph_macon: auditRandolphMaconCurrentRosterGap(overrides),
    database_writes: 0,
    core_major_edits: 0,
  };
}

module.exports = {
  QUERY_COLUMNS,
  RMC_HASHES,
  UVA_SOURCES,
  auditRandolphMaconCurrentRosterGap,
  auditUvaWiseCurrentRosterGaps,
  buildVirginiaBachelorCurrentRosterGapEvidence,
};
