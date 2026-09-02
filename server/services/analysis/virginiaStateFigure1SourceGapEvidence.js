const { createHash } = require('node:crypto');
const cheerio = require('cheerio');

const ARTIFACT = 'virginia_state_2026_2027_figure1_source_gap';
const CATALOG_YEAR = '2026-2027';
const DEGREE = 'Computer Science Major, Bachelor of Science (B.S.)';
const AUDITED_AT = '2026-08-25';

const PROGRAM_URL =
  'https://catalog.vsu.edu/undergraduate/college-engineering-technology/department-engineering-computer-science/computer-science-major-bs/';
const PROGRAM_PDF_URL = `${PROGRAM_URL}computer-science-major-bs.pdf`;
const DEPARTMENT_PLAN_URL =
  'https://www.vsu.edu/cet/departments/computer-science/programs/cs-courses.php';
const GENERAL_EDUCATION_URL =
  'https://catalog.vsu.edu/undergraduate/general-education-programs/';
const ACADEMIC_REGULATIONS_URL =
  'https://catalog.vsu.edu/undergraduate/academic-regulations-procedures/';
const POLICY_STATEMENTS_URL =
  'https://catalog.vsu.edu/undergraduate/university/policy-statements/';
const REGISTRAR_FAQ_URL = 'https://www.vsu.edu/registrar/faq/';
const CSCI_CATALOG_URL = 'https://catalog.vsu.edu/undergraduate/courses/csci/';
const GRADUATE_DUPLICATE_CREDIT_CONTROL_URL =
  'https://catalog.vsu.edu/graduate/academic-requirements/academic-performance-standards/';

const RETAINED_PATHS = Object.freeze({
  program_html: 'server/.va-catalogs/pages/virginia-state-university__program.html',
  program_text: 'server/.va-catalogs/pages/virginia-state-university__program.txt',
  general_education_text: 'server/.va-catalogs/pages/virginia-state-university__ge.txt',
  policy_statements_html:
    'server/.va-catalogs/pages/virginia-state-university__graduation.html',
  policy_statements_text:
    'server/.va-catalogs/pages/virginia-state-university__graduation.txt',
});

// Response hashes were independently re-fetched from the current official
// routes on AUDITED_AT. A hash receipt without retained current bytes can
// document an attempted route, but can never support a positive topology.
const SOURCE_RECEIPTS = Object.freeze([
  Object.freeze({
    id: 'catalog_program_html',
    url: PROGRAM_URL,
    scope: 'authoritative current catalog Summary of Requirements and Plan of Study',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 125973,
    response_sha256: '3fd3202caeced75524b2f66d3619a756bce5d55b75e9d294d5703f4143a63804',
    normalized_text_bytes: 7440,
    normalized_text_sha256: 'a3b7b3e40240ae0a78a1c8ad07d1c965524a11a0e2dd65293f653dcd47128ec8',
    retained_html_path: RETAINED_PATHS.program_html,
    retained_text_path: RETAINED_PATHS.program_text,
    retention: 'exact_current_raw_and_normalized_bytes',
    result: 'closed course roster and 13-credit total; no per-menu distribution',
  }),
  Object.freeze({
    id: 'catalog_program_pdf',
    url: PROGRAM_PDF_URL,
    scope: 'current catalog-generated PDF control for the program page',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 90454,
    response_sha256: 'b69838a73194c417345719d0eb321f8b0c4ad3abd2cb6dc4da1e4b668a2ba28b',
    normalized_text_bytes: null,
    normalized_text_sha256: null,
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'same unresolved 13-credit table as the HTML program page',
  }),
  Object.freeze({
    id: 'department_course_of_study',
    url: DEPARTMENT_PLAN_URL,
    scope: 'official department semester schedule and elective labels',
    catalog_year: null,
    http_status: 200,
    response_bytes: 45375,
    response_sha256: '5dde2f6af4fe2670604d5dccc419504fd2239228f61302740156e877a8fb7bc2',
    normalized_text_bytes: 4257,
    normalized_text_sha256: '2d9d9e51f67d4622976481bafc9375043cd60ba1704548ada32921df1c8a5a9c',
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'unversioned plan conflicts with the current catalog and contains row-total errors',
  }),
  Object.freeze({
    id: 'catalog_general_education',
    url: GENERAL_EDUCATION_URL,
    scope: 'current General Education distribution and cross-layer reuse rule',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 114966,
    response_sha256: 'e95fd1e560df0316a94f1bc4748a74d3478045899074f3d36cb0ff41a472f500',
    normalized_text_bytes: 8903,
    normalized_text_sha256: '02d2e2935e9a20f1674f5998d76222bcd87e3e63caba167d2356f80e4fa78a39',
    retained_html_path: null,
    retained_text_path: RETAINED_PATHS.general_education_text,
    retention: 'exact_current_normalized_bytes_raw_transport_changed',
    result: 'permits GE-major reuse and forbids only reuse across two GE areas',
  }),
  Object.freeze({
    id: 'catalog_academic_regulations',
    url: ACADEMIC_REGULATIONS_URL,
    scope: 'current undergraduate duplicate-credit, repeat, and transfer-application policies',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 140797,
    response_sha256: 'bf6f6ec3e4b9c6a41897d1a67cbf7a43eaba652ee68f08854f11d278c8e3cef6',
    normalized_text_bytes: 25649,
    normalized_text_sha256: 'f4a933571c1eb545a29f177e6671b8fa249ab3e1912cc05cdaf221c0ee89f491',
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'no undergraduate major-slot reuse topology located; transfer application remains program-discretionary',
  }),
  Object.freeze({
    id: 'catalog_policy_statements',
    url: POLICY_STATEMENTS_URL,
    scope: 'current undergraduate university policy statements',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 150014,
    response_sha256: '91cc4437d3acb24d2508eb2045308b130df5d9c7f4a883b5a8254ad07a3a3a6c',
    normalized_text_bytes: 63248,
    normalized_text_sha256: '8231eec2870bed927cd7eff20b190aa1f2bdd8b3977b478d665caf555b7851ee',
    retained_html_path: RETAINED_PATHS.policy_statements_html,
    retained_text_path: RETAINED_PATHS.policy_statements_text,
    retention: 'exact_current_raw_and_normalized_bytes',
    result: 'no undergraduate major-slot reuse or restricted-elective distribution rule located',
  }),
  Object.freeze({
    id: 'registrar_faq',
    url: REGISTRAR_FAQ_URL,
    scope: 'current registrar graduation and degree-requirement guidance',
    catalog_year: null,
    http_status: 200,
    response_bytes: 98126,
    response_sha256: '687594670b1c2358941b9bfbe9e6e09f22c2b728a6a019e622414dedbe7a6e7a',
    normalized_text_bytes: 15206,
    normalized_text_sha256: 'cdc75c0af3f155048046efce0caf542bdce02324fab87dce78a24c44f345c745',
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'directs students to the departmental advisor; publishes no missing topology',
  }),
  Object.freeze({
    id: 'catalog_csci_courses',
    url: CSCI_CATALOG_URL,
    scope: 'current CSCI credits and repeatability, especially CSCI 298',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 108837,
    response_sha256: '38d7e37321ff41fb2a50949b2b45bc59d5123e1c809b2ede6d11c3a56e8879da',
    normalized_text_bytes: 20781,
    normalized_text_sha256: '7ee1d66dff64e490d142ab13c1be44130408a6d13e156b532c930229f4ccc39a',
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'CSCI 298 is one credit and repeatable up to three times; applicability repetitions are not specified',
  }),
  Object.freeze({
    id: 'graduate_duplicate_credit_negative_control',
    url: GRADUATE_DUPLICATE_CREDIT_CONTROL_URL,
    scope: 'graduate-only duplicate-credit rule, inspected solely as a scope control',
    catalog_year: CATALOG_YEAR,
    http_status: 200,
    response_bytes: 85704,
    response_sha256: '5712a1e6ae8fd7988b30f8580be7a52def4277c928163b0d2886a8962b49a21f',
    normalized_text_bytes: 9274,
    normalized_text_sha256: '1ba4d6f9c8225543d3ff43e343a62ecf743fba406b9389c1160b8b9a45b5b733',
    retained_html_path: null,
    retained_text_path: null,
    retention: 'current_hash_receipt_only',
    result: 'explicit no-duplicate-credit language is graduate-only and cannot be promoted to this bachelor degree',
  }),
]);

const EXPECTED_CSCI_MENU = Object.freeze([
  'CSCI312', 'CSCI361', 'CSCI389', 'CSCI396', 'CSCI298', 'CSCI398',
  'CSCI402', 'CSCI450', 'CSCI451', 'CSCI452', 'CSCI453', 'CSCI456',
  'CSCI457', 'CSCI460', 'CSCI462', 'CSCI480', 'CSCI482', 'CSCI488',
  'CSCI492', 'CSCI495', 'CSCI496',
]);
const EXPECTED_MATH_MENU = Object.freeze([
  'MATH292', 'MATH317', 'MATH321', 'MATH325', 'MATH335', 'MATH340',
  'MATH348', 'MATH350', 'MATH352', 'MATH360', 'MATH392', 'MATH415',
  'MATH417', 'MATH425', 'MATH452', 'MATH473', 'MATH490', 'STAT380',
]);
const EXPECTED_SCIENCE_MENU = Object.freeze([
  Object.freeze(['PHYS105']),
  Object.freeze(['PHYS106']),
  Object.freeze(['PHYS112']),
  Object.freeze(['PHYS113']),
  Object.freeze(['CHEM151', 'CHEM153']),
  Object.freeze(['CHEM152', 'CHEM154']),
  Object.freeze(['BIOL120']),
  Object.freeze(['BIOL121']),
]);

const GE_REUSE_RULE =
  'Students may use one course simultaneously to satisfy a requirement for general education and their major discipline; however students may not use one course to satisfy more than one general education course requirement.';
const PROGRAM_GE_REUSE_RULE =
  'A single course may simultaneously fulfill a general education requirement and a departmental or major/minor requirement. A single course cannot be used to fulfill more than one general education requirement. Department or major/minor areas may opt to exceed the minimum credit hour requirements above.';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeText = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const normalizeCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

const stableSha256 = (value) => sha256(JSON.stringify(stable(value)));

function rowHours($, row) {
  const raw = normalizeText($(row).find('.hourscol').last().text());
  return /^\d+$/.test(raw) ? Number(raw) : null;
}

function tableAfterHeading($, root, heading) {
  const headings = root.find('h3').filter((index, element) => (
    normalizeText($(element).text()) === heading
  ));
  return {
    headingCount: headings.length,
    table: headings.first().nextAll('table.sc_courselist').first(),
  };
}

function extractRequirementCodes($, root, heading) {
  const found = tableAfterHeading($, root, heading);
  return found.table.find('tbody > tr:not(.listsum) a.code')
    .map((index, element) => normalizeCode($(element).text())).get();
}

function extractProgramFacts(programHtml, programText) {
  const source = String(programHtml || '');
  const retainedText = String(programText || '');
  const $ = cheerio.load(source);
  const issues = [];
  if (sha256(source) !== SOURCE_RECEIPTS[0].response_sha256) {
    issues.push('program_response_hash');
  }
  if (sha256(retainedText) !== SOURCE_RECEIPTS[0].normalized_text_sha256) {
    issues.push('program_normalized_text_hash');
  }
  if (normalizeText($('title').text())
      !== `${DEGREE} | Virginia State University Catalog`) {
    issues.push('program_document_title');
  }
  const edition = $('.site-title > a').first().clone();
  edition.find('.sr-only').remove();
  if (normalizeText(edition.text()) !== `${CATALOG_YEAR} Academic Catalog`) {
    issues.push('program_catalog_edition');
  }
  const summary = $('#summaryofrequirementstextcontainer');
  const plan = $('#planofstudytextcontainer');
  if (summary.length !== 1 || plan.length !== 1) issues.push('program_tab_boundaries');

  const elective = tableAfterHeading($, summary, 'Unrestricted and Restricted Electives');
  if (elective.headingCount !== 1 || elective.table.length !== 1) {
    issues.push('elective_table');
  }
  const menus = { csci: [], math_statistics: [], laboratory_science: [] };
  let activeMenu = null;
  let unrestrictedCredits = null;
  let restrictedCredits = null;
  const perMenuPublishedHours = {};
  elective.table.find('tbody > tr').each((index, row) => {
    const label = normalizeText($(row).find('.courselistcomment').first().text());
    if (label === 'Unrestricted Electives') unrestrictedCredits = rowHours($, row);
    if (label === 'Restricted Electives') restrictedCredits = rowHours($, row);
    if (label === 'CSCI Electives Menu') activeMenu = 'csci';
    if (label === 'MATH Electives Menu') activeMenu = 'math_statistics';
    if (label === 'BIOL/CHEM/PHYS Laboratory Courses') activeMenu = 'laboratory_science';
    if (activeMenu && label.endsWith('Menu') || label === 'BIOL/CHEM/PHYS Laboratory Courses') {
      perMenuPublishedHours[activeMenu] = rowHours($, row);
    }
    const codes = $(row).find('a.code')
      .map((codeIndex, element) => normalizeCode($(element).text())).get();
    if (!codes.length || !activeMenu) return;
    if (activeMenu === 'laboratory_science') menus[activeMenu].push(codes);
    else if (codes.length === 1) menus[activeMenu].push(codes[0]);
    else issues.push(`unexpected_${activeMenu}_compound_row_${index}`);
  });
  const totalCredits = rowHours($, elective.table.find('tbody > tr.listsum').first());
  if (unrestrictedCredits !== 6 || restrictedCredits !== 13 || totalCredits !== 19) {
    issues.push('elective_credit_totals');
  }
  if (!exact(menus.csci, EXPECTED_CSCI_MENU)) issues.push('csci_menu');
  if (!exact(menus.math_statistics, EXPECTED_MATH_MENU)) issues.push('math_menu');
  if (!exact(menus.laboratory_science, EXPECTED_SCIENCE_MENU)) {
    issues.push('laboratory_science_menu');
  }
  if (!exact(perMenuPublishedHours, {
    csci: null, math_statistics: null, laboratory_science: null,
  })) issues.push('per_menu_hours_are_not_blank');

  const coreCodes = extractRequirementCodes($, summary, 'Core Requirements');
  const requiredCodes = extractRequirementCodes($, summary, 'Required Courses');
  const restrictedCodes = [
    ...menus.csci,
    ...menus.math_statistics,
    ...menus.laboratory_science.flat(),
  ];
  const fixedIntersection = [...new Set(restrictedCodes.filter((code) => (
    [...coreCodes, ...requiredCodes].includes(code)
  )))].sort();
  if (fixedIntersection.length) issues.push('restricted_fixed_roster_intersection');

  const summaryText = normalizeText(summary.text());
  if (!summaryText.includes(PROGRAM_GE_REUSE_RULE)) issues.push('program_ge_reuse_rule');
  const planRows = plan.find('table.sc_plangrid tr').toArray();
  const matchingRows = (pattern) => planRows.filter((row) => pattern.test(normalizeText($(row).text())));
  const exactPlanHours = (pattern) => matchingRows(pattern).map((row) => rowHours($, row));
  const planFacts = {
    csci_math_stat_elective_hours: exactPlanHours(/CSCI\/MATH\/STAT Elective/),
    csci_330_plus_elective_hours: exactPlanHours(/CSCI Elective \(330 level or higher\)/),
    math_restricted_elective_hours: exactPlanHours(/MATH Restricted Elective \*/),
    laboratory_science_hours: exactPlanHours(/BIOL\/CHEM\/PHYS Laboratory Science \*\*/),
    csci_470_hours: exactPlanHours(/\bCSCI 470\b/),
    csci_471_row_count: matchingRows(/\bCSCI 471\b/).length,
  };
  const expectedPlanFacts = {
    csci_math_stat_elective_hours: [3],
    csci_330_plus_elective_hours: [6],
    math_restricted_elective_hours: [3],
    laboratory_science_hours: [4, 4],
    csci_470_hours: [3],
    csci_471_row_count: 0,
  };
  if (!exact(planFacts, expectedPlanFacts) || !coreCodes.includes('CSCI471')) {
    issues.push('plan_summary_conflict');
  }

  const roster = {
    csci: menus.csci,
    math_statistics: menus.math_statistics,
    laboratory_science_alternatives: menus.laboratory_science,
  };
  return {
    verified: issues.length === 0,
    issues,
    catalog_year: CATALOG_YEAR,
    unrestricted_credits: unrestrictedCredits,
    restricted_credits: restrictedCredits,
    combined_elective_credits: totalCredits,
    menu_alternative_counts: {
      csci: menus.csci.length,
      math_statistics: menus.math_statistics.length,
      laboratory_science: menus.laboratory_science.length,
      total: menus.csci.length + menus.math_statistics.length
        + menus.laboratory_science.length,
    },
    underlying_course_code_count: new Set(restrictedCodes).size,
    roster_sha256: stableSha256(roster),
    per_menu_published_hours: perMenuPublishedHours,
    fixed_required_roster_intersection: fixedIntersection,
    plan_facts: planFacts,
    summary_core_uses_csci_471: coreCodes.includes('CSCI471'),
    exact_program_ge_reuse_rule: PROGRAM_GE_REUSE_RULE,
  };
}

function retainedSourceIssues({
  programHtml,
  programText,
  generalEducationText,
  policyStatementsHtml,
  policyStatementsText,
}) {
  const issues = [];
  const checks = [
    ['program_html', programHtml, SOURCE_RECEIPTS[0].response_sha256],
    ['program_text', programText, SOURCE_RECEIPTS[0].normalized_text_sha256],
    ['general_education_text', generalEducationText, SOURCE_RECEIPTS[3].normalized_text_sha256],
    ['policy_statements_html', policyStatementsHtml, SOURCE_RECEIPTS[5].response_sha256],
    ['policy_statements_text', policyStatementsText, SOURCE_RECEIPTS[5].normalized_text_sha256],
  ];
  for (const [name, value, expectedHash] of checks) {
    if (sha256(String(value || '')) !== expectedHash) issues.push(`${name}_retained_bytes`);
  }
  const geText = normalizeText(generalEducationText);
  if (!geText.includes(GE_REUSE_RULE)) issues.push('general_education_reuse_rule');
  const policyText = normalizeText(policyStatementsText).toLowerCase();
  for (const absent of [
    'double count', 'duplicate credit', 'course may be used only once',
    'restricted electives', 'csci electives menu',
  ]) {
    if (policyText.includes(absent)) issues.push(`policy_statements_unexpected_${absent.replace(/\s+/g, '_')}`);
  }
  return issues;
}

function evidenceCore(sources) {
  const program = extractProgramFacts(sources.programHtml, sources.programText);
  const issues = [
    ...program.issues,
    ...retainedSourceIssues(sources),
  ];
  const core = {
    schema_version: 1,
    artifact: ARTIFACT,
    audited_at: AUDITED_AT,
    owner: {
      institution: 'Virginia State University',
      slug: 'virginia-state-university',
      catalog_year: CATALOG_YEAR,
      degree: DEGREE,
      target_figures: ['1', '6'],
    },
    source_policy: {
      allowed: 'current official Virginia State University catalog, department, and registrar sources only',
      excluded: [
        'search-result snippets as evidence',
        'prior catalog editions as current authority',
        'graduate-only rules applied to a bachelor degree',
        'advisor-dependent practice inferred without an official written rule',
      ],
      absence_rule: 'A searched phrase being absent is not positive proof; it leaves the affected topology blocked.',
    },
    attempted_official_routes: SOURCE_RECEIPTS,
    exact_published_facts: {
      restricted_credits: program.restricted_credits,
      unrestricted_credits: program.unrestricted_credits,
      combined_elective_credits: program.combined_elective_credits,
      roster_is_closed: program.verified,
      menu_alternative_counts: program.menu_alternative_counts,
      underlying_course_code_count: program.underlying_course_code_count,
      restricted_roster_sha256: program.roster_sha256,
      per_menu_published_hours: program.per_menu_published_hours,
      fixed_required_roster_intersection: program.fixed_required_roster_intersection,
      csci_298: {
        credits: 1,
        catalog_repeatability: 'may be taken more than once for credit but no more than 3 times',
        repeated_attempts_applicable_to_restricted_13: 'not_published',
      },
      general_education_reuse: {
        ge_and_major_same_course: 'explicitly_allowed',
        same_course_in_two_ge_areas: 'explicitly_forbidden',
        exact_rule: GE_REUSE_RULE,
      },
    },
    conflicting_non_authoritative_topology: {
      current_catalog_plan_of_study: program.plan_facts,
      current_catalog_summary_core_uses_csci_471: program.summary_core_uses_csci_471,
      official_department_page: {
        catalog_year_label: null,
        csci_470_present: true,
        csci_471_present: false,
        row_total_conflicts: [
          { row: 'Health & Wellness', semester_hours: 2, displayed_total_hours: 3 },
          { row: 'CSCI 303', semester_hours: 3, displayed_total_hours: 4 },
          { row: 'CSCI 470', semester_hours: 3, displayed_total_hours: 1 },
        ],
      },
      arithmetic_ambiguity: {
        if_csci_math_stat_is_restricted_and_one_lab_is_ge: 16,
        if_csci_math_stat_is_not_restricted_and_one_lab_is_ge: 13,
        published_restricted_total: 13,
        finding: 'Neither current official page labels which interpretation governs the 13-credit summary row.',
      },
      authority_decision: 'Do not promote either plan as the missing requirement topology.',
    },
    unresolved_topology: {
      exact_submenu_credit_distribution: false,
      exact_selection_cardinality: false,
      csci_298_repeat_application: false,
      exact_ge_science_and_restricted_science_credit_application: false,
      universal_undergraduate_major_slot_no_double_count_rule: false,
      figure_1_named_course_count_safe: false,
      figure_6_identity_graph_safe: false,
    },
    disposition: {
      status: 'blocked_source_gap',
      publishable_for_figure_1: false,
      publishable_for_figure_6: false,
      safe_for_figures_3_4_aggregate_only: true,
      mutation_authorized: false,
      reason: 'The current catalog closes the eligible roster and 13-credit total but not the submenu allocation, selection count, repeat application, or cross-layer identity topology.',
    },
    institutional_request: {
      authority_needed: 'Virginia State University Department of Computer Science degree-audit owner, confirmed by the Registrar if necessary',
      exact_question: 'For a student governed by the 2026-2027 Computer Science B.S. catalog, how must the 13 restricted-elective credits be allocated among the CSCI menu, the MATH/STAT menu, and the approved BIOL/CHEM/PHYS laboratory-science menu? Please state the exact minimum or maximum credits/courses from each menu, whether the total must equal 13 or may exceed it, whether repeated CSCI 298 registrations may apply more than once, and whether a laboratory-science course used for the four-credit General Education science area also satisfies the restricted pool while its credits count only once toward the 120-credit degree.',
      acceptable_closure: 'A catalog erratum, official curriculum checksheet, or signed degree-audit rule that is explicitly effective for the 2026-2027 Computer Science B.S. and answers every clause above.',
    },
    verification: {
      verified: issues.length === 0,
      issues,
    },
  };
  return core;
}

function buildVirginiaStateFigure1SourceGapEvidence(sources) {
  const core = evidenceCore(sources);
  return {
    ...core,
    evidence_fingerprint_sha256: stableSha256(core),
  };
}

function auditVirginiaStateFigure1SourceGapEvidence(artifact, sources) {
  const expected = buildVirginiaStateFigure1SourceGapEvidence(sources);
  const errors = [];
  if (!expected.verification.verified) {
    errors.push(...expected.verification.issues.map((issue) => `source:${issue}`));
  }
  if (!exact(artifact, expected)) errors.push('artifact_does_not_match_current_retained_source_receipt');
  if (artifact?.disposition?.status !== 'blocked_source_gap'
      || artifact?.disposition?.publishable_for_figure_1 !== false
      || artifact?.disposition?.mutation_authorized !== false) {
    errors.push('artifact_not_fail_closed');
  }
  return {
    verified: errors.length === 0,
    errors,
    expected,
  };
}

function virginiaStateFigure1SourceGapGate(artifact, sources) {
  const audit = auditVirginiaStateFigure1SourceGapEvidence(artifact, sources);
  return {
    supported: false,
    status: 'blocked_source_gap',
    affected_figures: ['1', '6'],
    reason: audit.verified
      ? artifact.disposition.reason
      : 'Virginia State Figure 1 source-gap evidence drifted and must remain blocked',
    evidence_fingerprint_sha256: audit.verified
      ? artifact.evidence_fingerprint_sha256 : null,
    issues: audit.errors,
  };
}

module.exports = {
  ARTIFACT,
  AUDITED_AT,
  CATALOG_YEAR,
  DEGREE,
  EXPECTED_CSCI_MENU,
  EXPECTED_MATH_MENU,
  EXPECTED_SCIENCE_MENU,
  GE_REUSE_RULE,
  PROGRAM_GE_REUSE_RULE,
  RETAINED_PATHS,
  SOURCE_RECEIPTS,
  auditVirginiaStateFigure1SourceGapEvidence,
  buildVirginiaStateFigure1SourceGapEvidence,
  extractProgramFacts,
  normalizeText,
  stableSha256,
  virginiaStateFigure1SourceGapGate,
};
