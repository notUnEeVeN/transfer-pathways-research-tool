const crypto = require('node:crypto');
const {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
  CNU_CPEN371W_EVIDENCE_CACHE_PATH,
  CNU_CPEN371W_SOURCE_CACHE_PATH,
  VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
  VSU_ARABIC_EVIDENCE_CACHE_PATH,
  VSU_ARABIC_SOURCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256,
  VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH,
  VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH,
  cnuCpen371wEntryIssue,
  requisiteMarkerCounts,
  structuredCourseLeafRequisiteFieldsValid,
  virginiaTechGraduateCsEntryIssue,
  vsuArabicEntryIssue,
} = require('./universityPrerequisiteAcquisition');
const {
  requiredResidentPathCourseCodes,
} = require('./universityPrerequisiteScope');
const {
  officialHostsForPrerequisiteScope,
  officialSourceEvidenceIssues,
  hasUnmodeledConstraintSignal,
  BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND,
  BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND,
  SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
  sourceBundleHashForRows,
  UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
} = require('./pathwayComplexityPrerequisites');
const {
  BRIDGEWATER_BOUNDARY_CONTRACT,
  BRIDGEWATER_EDITION_PATH,
  BRIDGEWATER_HOST,
  BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT,
  BRIDGEWATER_SLUG,
  bridgewaterUnmodeledTimingSignals,
  expectedCoursePath: expectedBridgewaterCoursePath,
} = require('./bridgewaterCleanCatalogPrerequisiteAcquisition');
const {
  LONGWOOD_BOUNDARY_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_CATOID,
  LONGWOOD_CATALOG_CONTEXT_CONTRACT,
  LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH,
  LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256,
  LONGWOOD_CATALOG_CONTEXT_URL,
  LONGWOOD_CATALOG_CONTEXT_YEAR,
  LONGWOOD_DEPARTMENT_HOST,
  LONGWOOD_DEPARTMENT_PATH,
  LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
  LONGWOOD_DIRECT_CMSC_TARGETS,
  LONGWOOD_SLUG,
  LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY,
} = require('./longwoodDepartmentPrerequisiteAcquisition');
const {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
  LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS,
  LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS,
  LONGWOOD_BANNER_HOST,
  LONGWOOD_BANNER_PATH,
  LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY,
} = require('./longwoodBannerCourseAcquisition');
const {
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  CNU_COMPOUND_RECEIPT_CONTRACT,
} = require('./cnuPdfPrerequisiteAcquisition');
const {
  CNU_ALIAS_RECEIPT_CONTRACT,
  CNU_CLAUSE_RECEIPT_CONTRACT,
} = require('./cnuCpen371wPrerequisiteEvidence');
const {
  VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
  VSU_ARABIC_BOUNDARY_CONTRACT,
  VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
} = require('./virginiaStateArabicPrerequisiteEvidence');
const {
  VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
} = require('./virginiaTechGraduateCsPrerequisiteEvidence');
const {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
  RADFORD_CATALOG_YEAR,
  RADFORD_CATOID,
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_COURSE_RECORDS,
  RADFORD_DIRECT_COURSE_RECORDS,
  RADFORD_DISCOVERY_CONTRACT,
  RADFORD_HOST,
  RADFORD_PROGRAM_CACHE_PATH,
  RADFORD_PROGRAM_HTML_SHA256,
  RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  RADFORD_SLUG,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  VIRGINIA_TECH_CATALOG_YEAR,
  VIRGINIA_TECH_CS_DEPARTMENT_URL,
  VIRGINIA_TECH_CS_HTML_CACHE_PATH,
  VIRGINIA_TECH_CS_HTML_SHA256,
  VIRGINIA_TECH_CS_TEXT_CACHE_PATH,
  VIRGINIA_TECH_CS_TEXT_SHA256,
  VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT,
  VIRGINIA_TECH_SLUG,
} = require('./virginiaTechCourseLeafPrerequisiteAcquisition');
const {
  resolveVirginiaTechPrerequisiteCandidate,
} = require('./virginiaTechPrerequisiteResolution');
const {
  resolveVirginiaTechRemainingPrerequisiteCandidate,
} = require('./virginiaTechRemainingPrerequisiteEvidence');
const {
  SAFE_COREQUISITE_CODES: VIRGINIA_TECH_RECURSIVE_SAFE_COREQUISITE_CODES,
  buildVirginiaTechRecursivePrerequisiteControl,
  resolveVirginiaTechRecursivePrerequisiteCandidate,
  summarizeVirginiaTechRecursivePrerequisites,
  resolutionRowIssues: virginiaTechRecursivePrerequisiteResolutionRowIssues,
} = require('./virginiaTechRecursivePrerequisiteClosureEvidence');
const {
  resolveVirginiaTechCs4784ClosureCandidate,
} = require('./virginiaTechCs4784ClosurePrerequisiteEvidence');
const {
  projectionRowIssues: vsuEnglishProjectionRowIssues,
  resolveVirginiaStateEnglishPrerequisite,
} = require('./virginiaStateEnglishPrerequisiteEvidence');
const {
  CONTRACT: VSU_PREREQUISITE_CLOSURE_CONTRACT,
  isScopedVirginiaStatePrerequisite,
  resolutionRowIssues: vsuPrerequisiteClosureResolutionRowIssues,
  resolveVirginiaStatePrerequisiteClosure,
} = require('./virginiaStatePrerequisiteClosureEvidence');
const {
  resolutionRowIssues: norfolkStateCsc295ResolutionRowIssues,
  resolveNorfolkStateCsc295Prerequisite,
} = require('./norfolkStateCsc295PrerequisiteEvidence');
const {
  CONTRACT: NORFOLK_STATE_PREREQUISITE_CLOSURE_CONTRACT,
  isScopedNorfolkStatePrerequisite,
  resolutionRowIssues: norfolkStatePrerequisiteClosureResolutionRowIssues,
  resolveNorfolkStatePrerequisiteClosure,
} = require('./norfolkStatePrerequisiteClosureEvidence');
const {
  CONTRACT: VCU_PREREQUISITE_CLOSURE_CONTRACT,
  STRUCTURAL_NONE_KIND: VCU_PREREQUISITE_STRUCTURAL_NONE_KIND,
  buildVcuPrerequisiteControlFromCandidates,
  resolveVcuPrerequisiteCandidate,
  vcuPrerequisiteControlSummary,
  vcuPrerequisiteResolutionRowIssues,
} = require('./vcuPrerequisiteClosureEvidence');
const {
  CONTRACT: SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT,
  artifactIssues: smallUniversityPrerequisiteArtifactIssues,
  isScopedSmallUniversityPrerequisite,
  loadEvidenceArtifact: loadSmallUniversityPrerequisiteEvidence,
  resolutionRowIssues: smallUniversityPrerequisiteResolutionRowIssues,
  resolveSmallUniversityPrerequisite,
} = require('./smallUniversityPrerequisiteClosureEvidence');
const {
  CONTRACT: UNIVERSITY_PREREQUISITE_TAIL_CONTRACT,
  isScopedUniversityPrerequisiteTail,
  loadUniversityPrerequisiteTailControl,
  resolutionRowIssues: universityPrerequisiteTailResolutionRowIssues,
  resolveUniversityPrerequisiteTailCandidate,
  universityPrerequisiteTailControlSummary,
} = require('./universityPrerequisiteTailClosureEvidence');
const {
  CONTRACT: RADFORD_RANDOLPH_MACON_TAIL_CONTRACT,
  evidenceIssues: radfordRandolphMaconTailEvidenceIssues,
  evidenceSummary: radfordRandolphMaconTailEvidenceSummary,
  isScopedRadfordRandolphMaconTail,
  loadEvidenceArtifact: loadRadfordRandolphMaconTailEvidence,
  resolutionRowIssues: radfordRandolphMaconTailResolutionRowIssues,
  resolveRadfordRandolphMaconPrerequisiteTail,
} = require('./radfordRandolphMaconPrerequisiteTailEvidence');
const {
  CONTRACT: REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
  evidenceIssues: remainingUniversityPrerequisiteEvidenceIssues,
  isScopedRemainingUniversityPrerequisite,
  loadEvidenceArtifact: loadRemainingUniversityPrerequisiteEvidence,
  resolutionRowIssues: remainingUniversityPrerequisiteResolutionRowIssues,
  resolveRemainingUniversityPrerequisite,
} = require('./remainingUniversityPrerequisiteClosureEvidence');
const {
  CONTRACT: VCU_EGMN_PREREQUISITE_CONTRACT,
  evidenceIssues: vcuEgmnPrerequisiteEvidenceIssues,
  isScopedVcuEgmnPrerequisite,
  loadEvidenceArtifact: loadVcuEgmnPrerequisiteEvidence,
  resolutionRowIssues: vcuEgmnPrerequisiteResolutionRowIssues,
  resolveVcuEgmnPrerequisite,
} = require('./vcuEgmnOutsideScopePrerequisiteEvidence');
const {
  CONTRACT: RADFORD_UVA_WISE_RECURSIVE_PREREQUISITE_CONTRACT,
  evidenceIssues: radfordUvaWiseRecursiveEvidenceIssues,
  loadEvidenceArtifact: loadRadfordUvaWiseRecursiveEvidence,
  resolutionRowIssues: radfordUvaWiseRecursiveResolutionRowIssues,
  resolveRadfordUvaWiseRecursive,
} = require('./radfordUvaWiseRecursivePrerequisiteEvidence');
const {
  REVIEW_REASON: GEORGE_MASON_SILENCE_REVIEW_REASON,
  isScopedGeorgeMasonPrerequisiteSilence,
  resolutionRowIssues: georgeMasonSilenceResolutionRowIssues,
  resolveGeorgeMasonPrerequisiteSilence,
} = require('./georgeMasonPrerequisiteSilenceEvidence');
const {
  BLOCKED_CODES: GEORGE_MASON_BLOCKED_CLOSURE_CODES,
  CACHE_REACQUIRE_CODES: GEORGE_MASON_CACHE_REACQUIRE_CODES,
  CLOSURE_CODES: GEORGE_MASON_CLOSURE_CODES,
  CONTRACT: GEORGE_MASON_CLOSURE_CONTRACT,
  REVIEW_REASON: GEORGE_MASON_CLOSURE_REVIEW_REASON,
  blockerForCode: georgeMasonBlockerForCode,
  cachedCyseReviewResolution,
  cachedCyseResolutionRowIssues,
  closureResolution: resolveGeorgeMasonPrerequisiteClosure,
  closureResolutionRowIssues: georgeMasonClosureResolutionRowIssues,
  outsideFormulaIssues: georgeMasonOutsideFormulaIssues,
} = require('./georgeMasonPrerequisiteClosureAudit');
const {
  cnuEngl123MarkerControl,
  cnuEngl123ResolutionRowIssues,
  resolveCnuEngl123Prerequisite,
} = require('./christopherNewportEngl123PrerequisiteEvidence');
const {
  auditBridgewaterTimingPrerequisiteCandidate,
} = require('./bridgewaterTimingPrerequisiteEvidence');
const {
  auditLongwoodPrerequisiteCandidate,
  buildLongwoodPrerequisiteClosureControlFromCandidates,
} = require('./longwoodPrerequisiteClosureEvidence');
const {
  buildOldDominionPrerequisiteMarkerControlFromCandidates,
  oldDominionResolutionRowIssues,
  resolveOldDominionPrerequisiteCandidate,
} = require('./oldDominionPrerequisiteClosureEvidence');
const {
  CONTRACT: FIGURE6_NONCOURSE_DISPOSITION_CONTRACT,
  STRUCTURAL_NONE_KIND: FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND,
  figure6NonCourseDispositionResolutionRowIssues,
  resolveFigure6NonCoursePrerequisiteDisposition,
} = require('./figure6NonCoursePrerequisiteDisposition');
const {
  BROWSER_CHALLENGE_CONTRACT,
  JMU_SLUG,
  VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT,
  exactKnownBrowserResource,
  validateBrowserChallengeReceipt,
  validateBrowserRobotsReceipt,
} = require('./browserChallengeCourseLeafAcquisition');
const {
  UVA_WISE_BOUNDARY_CONTRACT,
  UVA_WISE_CATALOG_YEAR,
  UVA_WISE_CATOID,
  UVA_WISE_CLAUSE_RECEIPT_CONTRACT,
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  UVA_WISE_COURSE_RECORDS,
  UVA_WISE_DIRECT_COURSE_RECORDS,
  UVA_WISE_DISCOVERY_CONTRACT,
  UVA_WISE_GE_CACHE_PATH,
  UVA_WISE_GE_HTML_SHA256,
  UVA_WISE_HOST,
  UVA_WISE_PROGRAM_CACHE_PATH,
  UVA_WISE_PROGRAM_HTML_SHA256,
  UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS,
  UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT,
  UVA_WISE_SLUG,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');
const {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CATALOG_YEAR,
  SHENANDOAH_CATOID,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_HOST,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
  SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS,
  SHENANDOAH_SLUG,
} = require('./shenandoahAcalogPrerequisiteAcquisition');

const ARTIFACT = 'virginia_figure6_university_prerequisite_formula_review';
const FORMULA = 'paths_or__conditions_and';
const AUTHORITY = 'institution_catalog';
const PUBLISHABLE = new Set(['parsed', 'none']);

// VSU publishes BIOL 121 lecture and laboratory components under the same
// catalog code. The two Corequisite fields therefore describe internal
// components of the one BIOL 121 receiver, not prerequisite-graph edges to a
// second course. Pin the complete entry and both exact clauses so a future
// catalog wording or boundary change fails closed instead of silently
// suppressing a real course relationship.
const VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT = Object.freeze({
  slug: 'virginia-state-university',
  code: 'BIOL121',
  source_response_sha256:
    '29cbaeed3575cf8b354065206d1eb90bf6ea324f08102b40db1c528fdd9d5e61',
  raw_entry_sha256:
    'c21a61afe711c4b0f747ec1aa07506c69b7d071a1973f0965458855bd7f11572',
  raw_entry_html_sha256:
    'f491c87f3db4536fdd89462d29ce9f57fc631caa02e9970295e29174f8cd6251',
  clauses: Object.freeze([
    Object.freeze({
      raw: 'BIOL 121 Principles of Biology II laboratory Lab: A laboratory course required to be taken in conjunction with BIOL 121 Principles of Biology II lecture course. This course will involve hands on laboratory exercises related to selected lecture topics.',
      raw_sha256:
        '5ac955dd9bf62680dc36051ddfb8f07c982779ba8631c1bd5ee1318f1193e70e',
      component: 'laboratory',
    }),
    Object.freeze({
      raw: 'BIOL 121 Principles of Biology II.',
      raw_sha256:
        'a8fd20a29d61ea953a7833147949642b6c338345061196646fd2b606fbc280d2',
      component: 'lecture',
    }),
  ]),
});

const VSU_PHYSICS_COMBINED_COMPONENT_RECEIPT_CONTRACT =
  'vsu_exact_combined_lecture_laboratory_component_entry_v1';

// VSU's PHYS 106 and PHYS 113 CourseLeaf blocks each publish a variable-credit
// receiver whose one courseblock contains a lecture followed by a literal
// "Lab" component.  The component boundary is not represented by HTML
// nesting, so this exception is deliberately finite and binds the complete
// response, complete entry, entry HTML, every marker-bounded clause, and each
// subspan used to identify the two components.  Receiver-level graph edges
// may coalesce the same upstream course required by both components, but the
// two source assertions remain separately retained below.  A same-code lab
// corequisite is evidence about the internal PHYS 113 component and must not
// become a prerequisite-graph self-edge.
const VSU_PHYSICS_COMBINED_COMPONENT_RECEIPTS = Object.freeze({
  PHYS106: Object.freeze({
    school_id: 9231,
    owner_namespace: 'va:uni:9231',
    course_key: 'va:uni:9231:PHYS106',
    official_url: 'https://catalog.vsu.edu/undergraduate/courses/phys/',
    catalog_year_verified: '2026-2027',
    cache_path:
      'university-prerequisites/raw/virginia-state-university/virginia-state-university__phys.html',
    source_response_sha256:
      '2faf104bd68b8384c9f65dc1d223ec1b1e782a6e73492cfdc03e46aba588f2ce',
    source_response_bytes: 83082,
    courseblock_index: 2,
    raw_entry_sha256:
      'e6c3c15f8bc25ff3603f88e215f14f45d195138a911a0d310c735fc6b3e7b4c4',
    raw_entry_html_sha256:
      '3aa430464a0a03a577340c997557ac216f071c8141cdf4df5c228ff802fa212f',
    published_units: Object.freeze({
      kind: 'published_variable_credit_range',
      notation: '1-3 Credits',
      credit_hours_min: 1,
      credit_hours_max: 3,
      heading_text_sha256:
        '520ddee1322d914a42cb94aae62b1fa5af8ea22936c87ce657c226680d265a75',
    }),
    complete_entry_receipt: Object.freeze({
      receipt_contract: COURSELEAF_RECEIPT_CONTRACT,
      source_courseblock_count: 38,
      source_complete_entry_count: 38,
      source_complete_entries_with_required_requisite_marker_count: 2,
      entry_required_requisite_marker_count: 2,
      entry_corequisite_marker_count: 0,
      entry_requisite_marker_like_count: 2,
      entry_constraint_like_signal_count: 0,
      same_source_positive_control: true,
    }),
    clauses: Object.freeze([
      Object.freeze({
        kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 105 Introduction to Physics I Lab A continuation of PHYS 105 treating electrostatics, magnetism, circuits, optics, relativity, atomic structure, the nucleus and fundamental particles.',
        relative_start: 217, relative_end: 405,
        statement_relative_start: 202, statement_relative_end: 405,
      }),
      Object.freeze({
        kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 105 Introduction to Physics I.',
        relative_start: 421, relative_end: 456,
        statement_relative_start: 406, statement_relative_end: 456,
      }),
    ]),
    component_boundaries: Object.freeze([
      Object.freeze({
        id: 'laboratory_component',
        component: 'laboratory',
        kind: 'literal_lab_component_boundary',
        raw: 'Lab A continuation of PHYS 105 treating electrostatics, magnetism, circuits, optics, relativity, atomic structure, the nucleus and fundamental particles.',
        relative_start: 252,
        relative_end: 405,
        raw_sha256:
          '68a2da6269f2d59e1e79598b55524b40d872f9cfc80aa6efe459a0f4153c1d98',
      }),
    ]),
    component_requirements: Object.freeze([
      Object.freeze({
        id: 'lecture_prerequisite_phys105',
        component: 'lecture', kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 105 Introduction to Physics I',
        relative_start: 217, relative_end: 251,
        statement_relative_start: 202, statement_relative_end: 251,
        raw_sha256:
          '0fef1730200ffa53559dd3f963de4a42d941a5ceb48be57c79f86de21409ceda',
        required_course_code: 'PHYS105',
        catalog_title_text: 'Introduction to Physics I',
        graph_edge_emitted: true,
        graph_projection: 'emitted_receiver_graph_edge',
      }),
      Object.freeze({
        id: 'laboratory_prerequisite_phys105',
        component: 'laboratory', kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 105 Introduction to Physics I.',
        relative_start: 421, relative_end: 456,
        statement_relative_start: 406, statement_relative_end: 456,
        raw_sha256:
          'fb59953753bdc102c9756316753a8510a077e812c424e59ec069b565fc257348',
        required_course_code: 'PHYS105',
        catalog_title_text: 'Introduction to Physics I',
        graph_edge_emitted: false,
        graph_projection: 'coalesced_with_identical_receiver_graph_edge',
        coalesced_with_requirement_id: 'lecture_prerequisite_phys105',
      }),
    ]),
    graph_groups: Object.freeze([
      Object.freeze({
        kind: 'prerequisite',
        raw: 'PHYS 105 Introduction to Physics I',
        required_course_code: 'PHYS105',
        catalog_title_text: 'Introduction to Physics I',
        component_requirement_ids: Object.freeze([
          'lecture_prerequisite_phys105', 'laboratory_prerequisite_phys105',
        ]),
      }),
    ]),
  }),
  PHYS113: Object.freeze({
    school_id: 9231,
    owner_namespace: 'va:uni:9231',
    course_key: 'va:uni:9231:PHYS113',
    official_url: 'https://catalog.vsu.edu/undergraduate/courses/phys/',
    catalog_year_verified: '2026-2027',
    cache_path:
      'university-prerequisites/raw/virginia-state-university/virginia-state-university__phys.html',
    source_response_sha256:
      '2faf104bd68b8384c9f65dc1d223ec1b1e782a6e73492cfdc03e46aba588f2ce',
    source_response_bytes: 83082,
    courseblock_index: 4,
    raw_entry_sha256:
      '00ab8ab5c4e50dddf46f13a62b5f56292d8585cfdd6039ba6f8dadff6e0ccc5c',
    raw_entry_html_sha256:
      'c69a89f329cd1ff8ae96473e0c5206ab2337e617e6a9d3d19712103f0b08ef0f',
    published_units: Object.freeze({
      kind: 'published_variable_credit_range',
      notation: '1-4 Credits',
      credit_hours_min: 1,
      credit_hours_max: 4,
      heading_text_sha256:
        '0b40bab524449582325d4c55a332e840baf89ef208d2bf92b0b8453273acef7f',
    }),
    complete_entry_receipt: Object.freeze({
      receipt_contract: COURSELEAF_RECEIPT_CONTRACT,
      source_courseblock_count: 38,
      source_complete_entry_count: 38,
      source_complete_entries_with_required_requisite_marker_count: 2,
      entry_required_requisite_marker_count: 2,
      entry_corequisite_marker_count: 2,
      entry_requisite_marker_like_count: 4,
      entry_constraint_like_signal_count: 0,
      same_source_positive_control: true,
    }),
    clauses: Object.freeze([
      Object.freeze({
        kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 112 General Physics I',
        relative_start: 124, relative_end: 150,
        statement_relative_start: 109, statement_relative_end: 150,
      }),
      Object.freeze({
        kind: 'corequisite', label: 'Co-requisite',
        raw: 'MATH 201 Calculus II Lab Laboratory experiments in electromagnetism and optics designed to complement PHYS 113.',
        relative_start: 165, relative_end: 276,
        statement_relative_start: 151, statement_relative_end: 276,
      }),
      Object.freeze({
        kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 112 General Physics I Laboratory',
        relative_start: 292, relative_end: 329,
        statement_relative_start: 277, statement_relative_end: 329,
      }),
      Object.freeze({
        kind: 'corequisite', label: 'Co-requisite',
        raw: 'PHYS 113 General Physics II.',
        relative_start: 344, relative_end: 372,
        statement_relative_start: 330, statement_relative_end: 372,
      }),
    ]),
    component_boundaries: Object.freeze([
      Object.freeze({
        id: 'laboratory_component',
        component: 'laboratory',
        kind: 'literal_lab_component_boundary',
        raw: 'Lab Laboratory experiments in electromagnetism and optics designed to complement PHYS 113.',
        relative_start: 186,
        relative_end: 276,
        raw_sha256:
          'daee529c98e0c778e05234e49d3ad75c3674f1e38a3da8f953b13bbb04846e58',
      }),
    ]),
    component_requirements: Object.freeze([
      Object.freeze({
        id: 'lecture_prerequisite_phys112',
        component: 'lecture', kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 112 General Physics I',
        relative_start: 124, relative_end: 150,
        statement_relative_start: 109, statement_relative_end: 150,
        raw_sha256:
          '7207509225c6df46eee8a926b83bccfa1a15596674d5ca7feee9145845f5e43a',
        required_course_code: 'PHYS112',
        catalog_title_text: 'General Physics I',
        graph_edge_emitted: true,
        graph_projection: 'emitted_receiver_graph_edge',
      }),
      Object.freeze({
        id: 'lecture_corequisite_math201',
        component: 'lecture', kind: 'corequisite', label: 'Co-requisite',
        raw: 'MATH 201 Calculus II',
        relative_start: 165, relative_end: 185,
        statement_relative_start: 151, statement_relative_end: 185,
        raw_sha256:
          'b57848e96ca6d391b66e7c51f5ce31f90d692603ed8cd17679d1b62a9b906b82',
        required_course_code: 'MATH201',
        catalog_title_text: 'Calculus II',
        graph_edge_emitted: true,
        graph_projection: 'emitted_receiver_graph_edge',
      }),
      Object.freeze({
        id: 'laboratory_prerequisite_phys112',
        component: 'laboratory', kind: 'prerequisite', label: 'Pre-requisite',
        raw: 'PHYS 112 General Physics I Laboratory',
        relative_start: 292, relative_end: 329,
        statement_relative_start: 277, statement_relative_end: 329,
        raw_sha256:
          'c8151fec059c3f6bf3b05617f1e76bd4f2eadc7008a735053508f4704dc28af1',
        required_course_code: 'PHYS112',
        catalog_title_text: 'General Physics I Laboratory',
        graph_edge_emitted: false,
        graph_projection: 'coalesced_with_identical_receiver_graph_edge',
        coalesced_with_requirement_id: 'lecture_prerequisite_phys112',
      }),
      Object.freeze({
        id: 'laboratory_corequisite_phys113',
        component: 'laboratory', kind: 'corequisite', label: 'Co-requisite',
        raw: 'PHYS 113 General Physics II.',
        relative_start: 344, relative_end: 372,
        statement_relative_start: 330, statement_relative_end: 372,
        raw_sha256:
          '527f89fb171df7bb4e875fc8b46ae756b40cb319c8e205f29af05c4380fcb595',
        required_course_code: 'PHYS113',
        catalog_title_text: 'General Physics II',
        graph_edge_emitted: false,
        graph_projection: 'preserved_internal_component_corequisite_without_self_edge',
      }),
    ]),
    graph_groups: Object.freeze([
      Object.freeze({
        kind: 'prerequisite',
        raw: 'PHYS 112 General Physics I',
        required_course_code: 'PHYS112',
        catalog_title_text: 'General Physics I',
        component_requirement_ids: Object.freeze([
          'lecture_prerequisite_phys112', 'laboratory_prerequisite_phys112',
        ]),
      }),
      Object.freeze({
        kind: 'corequisite',
        raw: 'MATH 201 Calculus II',
        required_course_code: 'MATH201',
        catalog_title_text: 'Calculus II',
        component_requirement_ids: Object.freeze(['lecture_corequisite_math201']),
      }),
    ]),
  }),
});

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const asArray = (value) => Array.isArray(value) ? value : [];

const STRICT_FORMULA_REJECTION_AUDIT_CONTRACT =
  'va_university_strict_formula_rejection_source_bound_audit_v1';

// This finite roster records the adversarial re-review of the eight exact
// entries that were previously rejected by the strict formula parsers.  It is
// deliberately not a generic punctuation heuristic: every decision is bound
// to the complete retained entry, the complete retained response, the exact
// required clause, and (where available) the exact entry HTML.  A recapture or
// wording change therefore returns the row to review rather than inheriting a
// semantic decision made for a different source.
const STRICT_FORMULA_REJECTION_AUDIT = Object.freeze({
  'radford-university:CS322': Object.freeze({
    decision: 'blocked_ambiguous_formula',
    official_url:
      'https://catalog.radford.edu/preview_course_nopop.php?catoid=62&coid=108998',
    source_response_sha256:
      'd758a62ec2310f5e1a8652d9a9669a518a391afb2ba9589845700d9096ec9b74',
    raw_entry_sha256:
      'a43ab5b50c8e64f7ed7e2d5cc8ebe22e4c201489640624c839371d69182f5b24',
    raw_entry_html_sha256:
      '5ab2cb5cc47e41b9ba1efd0f33b2f06afeaee613c5472a8dd0da27918c30f3e6',
    clause:
      'CS 220 (Grade of “C” or better) and MATH 171 , MATH 169 , or MATH 151 .',
    clause_sha256:
      '7ad66cfbe703575c2fc8c303a41e4e2aaba08d8190ea34391b9a885bc63a8cb2',
    decision_reason:
      'The unparenthesized conjunction followed by a comma/OR list permits both a common-CS220 reading and a top-level OR reading; the source supplies no grouping token.',
  }),
  'radford-university:MATH171': Object.freeze({
    decision: 'promoted_lossless_formula',
    strategy: 'radford_math171_nested_grade_or_placement',
    official_url:
      'https://catalog.radford.edu/preview_course_nopop.php?catoid=62&coid=109887',
    source_response_sha256:
      '56be2a63e4192a9f28fa56dd219de3190623fcc4c35d2dd7a7a48f04ea5eaaf8',
    raw_entry_sha256:
      '8b96057fbb1a2cc584f0765c619c7eee765dc59938236c58c37f884c9d0b3752',
    raw_entry_html_sha256:
      'dad92852e0ee07129cf094898b79e800ecf740612b92fa5b1bf339f9d114a29b',
    clause:
      'A grade of C or better in MATH 138 or another approved college-level precalculus course including some trigonometry OR a passing score on a placement exam approved by the Department of Mathematics and Statistics.',
    clause_sha256:
      '9dad34e100d3911059bacd1037c24cd1f3dc861830b546115b985b6aa7a9fb8d',
    decision_reason:
      'The first lowercase or coordinates the two objects governed by “grade of C or better in”; the separate uppercase OR introduces the placement-exam route.',
  }),
  'randolph-macon-college:CSCI311': Object.freeze({
    decision: 'blocked_ambiguous_formula',
    official_url: 'https://catalog.rmc.edu/courses-az/csci/',
    source_response_sha256:
      'b6ee05eb964575f1e93cec4dd9899c8fc62ceb5782bcbd2ae93a8ff4072ee494',
    raw_entry_sha256:
      '6f32b063adb60adf46c2a2f20d8580b3f853a5463ca872c3824acf6b52b6f045',
    raw_entry_html_sha256: null,
    clause: 'MATH 220 or CSCI 210 AND CSCI 212 or CSCI 213',
    clause_sha256:
      '18ad8db0f49b5787af2fedb3d304c92efa4cffa7446adb0ecdce0d237a907656',
    decision_reason:
      'The mixed unparenthesized OR/AND/OR expression has multiple valid Boolean trees and the typography does not define precedence.',
  }),
  'the-university-of-virginia-s-college-at-wise:CSC2180': Object.freeze({
    decision: 'promoted_lossless_formula',
    strategy: 'uva_wise_csc2180_atom_local_trailing_grade',
    official_url:
      'http://catalog.uvawise.edu/preview_course_nopop.php?catoid=9&coid=17965',
    source_response_sha256:
      '321c6211d3e8bddda50228f5a24678f769f866e7dd4f4b576f7ea63ee1815a23',
    raw_entry_sha256:
      '6764d1fa9655ff7df42b30e5685d2d96d02ff62bd84ecfd5433e8704a055ee19',
    raw_entry_html_sha256:
      '4697e33ff81f3eced8582bdb910564ea217004168c62a120ca6613d5f92273f1',
    clause: 'CSC 1180 and MTH 1110 with a C or better',
    clause_sha256:
      'bf9601097b6c0efa04f6dff4b19302796640104f21b71fe22c8a695beaaf4c05',
    decision_reason:
      'The grade phrase is atom-local to the immediately preceding MTH 1110 anchor, matching the catalog’s retained atom-local grade construction; the conjunction itself is explicit.',
  }),
  'virginia-commonwealth-university:BNFO201': Object.freeze({
    decision: 'promoted_lossless_formula',
    strategy: 'vcu_bnfo201_atom_local_grade_or_placement',
    official_url: 'https://bulletin.vcu.edu/azcourses/bnfo/',
    source_response_sha256:
      'bf68b3fc618cda0fb6ec54cbe3947ade7dac42755a69f51d709e58b6337cd8e5',
    raw_entry_sha256:
      '6fd785db490bcd92bfccf9c16188f92a3ee19c401f0c93c422e9955cdcf3232d',
    raw_entry_html_sha256:
      '9ceca4a323c9b2d47344bad8542bb38ec92ed7a7ac89bcff7b3ae84fe6c8d843',
    clause:
      'MATH 151 or 200 with a minimum grade of C, or satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
    clause_sha256:
      '6ee4fdb60c211ee4bc3c0639cf5f53524bfc50eeddc6d92a42e05e5c0374dfa8',
    decision_reason:
      'The exact HTML identifies the displayed 200 anchor as MATH 200; its trailing grade is atom-local and the final comma-or introduces the placement route.',
  }),
  'virginia-commonwealth-university:EGRE254': Object.freeze({
    decision: 'promoted_lossless_formula',
    strategy: 'vcu_egre254_department_applicable_or_of_routes',
    official_url: 'https://bulletin.vcu.edu/azcourses/egre/',
    source_response_sha256:
      '9676e761ea9e8741dc9d6a31c833dc54b6116c496f96f7ba68d9a817c9132c9b',
    raw_entry_sha256:
      'fa5f8bcb146a28f7a18d1c74bd87741cb2e28e102382fb24fcec57cd5cba3825',
    raw_entry_html_sha256:
      '6d60cd04dd84b9c244b64f10307e82e0f188b8262f8ecd4f51c290cd9358ca99',
    clause:
      'EGRE 101, EGRB 102 or CLSE 101; or both EGMN 190 and EGMN 203; or both EGMN 102 and EGMN 190, as applicable per department, all with minimum grades of C',
    clause_sha256:
      '523f5a0416ef13859f907c6c57cd363c2b627abd0e1add5efa0fcc17cebaea16',
    decision_reason:
      'Semicolons and both delimit five routes, “all” scopes the C minimum to every course atom, and each path retains a route-specific department-applicability condition.',
  }),
  'virginia-commonwealth-university:ENGR261': Object.freeze({
    decision: 'promoted_lossless_formula',
    strategy: 'vcu_engr261_choice_and_cmsc254_shared_grade',
    official_url: 'https://bulletin.vcu.edu/azcourses/engr/',
    source_response_sha256:
      'f5ba24ba0e45205e23e537669cc333790924e7ed87b1c48665b5fd1b69ac0b6e',
    raw_entry_sha256:
      'a9116ad95cebc02b316faf41cf68e8ca7dd71d23c4b728bbac47e7bdefc383e4',
    raw_entry_html_sha256:
      '9b8b184445cadaef46d079a414506ad0c06bd1cb22352a01c4f889d7e29aefc8',
    clause:
      'CLSE 101, EGMN 190, EGRB 102, EGRE 101 or ENGR 105; and CMSC 254, each with a minimum grade of C',
    clause_sha256:
      'fa50bc6341e57cc2451636816809d58c2bc2e15178259bf4231fcfe44c6ee92c',
    decision_reason:
      'The semicolon and explicit and divide the five-course alternative list from mandatory CMSC 254, while “each” explicitly scopes the C minimum across both sides.',
  }),
  'virginia-polytechnic-institute-and-state-university:CS3704': Object.freeze({
    decision: 'blocked_conflicting_source_statements',
    official_url:
      'https://catalog.vt.edu/undergraduate/college-engineering/computer-science/',
    source_response_sha256:
      '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4',
    raw_entry_sha256:
      '4116e7099f7b50d5fbc426b02c8706b1251a966980d906f97aa836563c88a9d6',
    raw_entry_html_sha256:
      '875f87101d6e480bc55882cbb1aac2f5ae033f286ea9add82cc51af89b99b659',
    clause: 'CS 2114',
    clause_sha256:
      '3bb501e3d39136002a3e60e55bca7b62304f749bd04ad3b919c8321a7d115674',
    decision_reason:
      'The complete entry calls CS 3114 the grade-bearing CS prerequisite while the structured prerequisite field names CS 2114; selecting or conjoining them would resolve a catalog conflict without authority.',
  }),
});

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function vsuPhysicsCombinedComponentReceipt(candidate) {
  if (candidate?.slug !== 'virginia-state-university') return null;
  return VSU_PHYSICS_COMBINED_COMPONENT_RECEIPTS[candidate.course_code] || null;
}

function bindVsuPhysicsSpan(candidate, row) {
  return {
    ...row,
    source_character_start: candidate.source.character_start + row.relative_start,
    source_character_end: candidate.source.character_start + row.relative_end,
  };
}

function resolveVsuPhysicsCombinedComponents(candidate, clauses) {
  const receipt = vsuPhysicsCombinedComponentReceipt(candidate);
  if (!receipt) return { applicable: false, ready: false };
  const source = candidate?.source || {};
  const issues = [];
  const requireEqual = (condition, issue) => {
    if (!condition) issues.push(issue);
  };

  requireEqual(candidate.school_id === receipt.school_id, 'school_id_changed');
  requireEqual(
    candidate.owner_namespace === receipt.owner_namespace,
    'owner_namespace_changed',
  );
  requireEqual(candidate.course_key === receipt.course_key, 'course_key_changed');
  requireEqual(
    source.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT,
    'boundary_contract_changed',
  );
  requireEqual(source.official_url === receipt.official_url, 'official_url_changed');
  requireEqual(
    source.catalog_year_verified === receipt.catalog_year_verified,
    'catalog_year_changed',
  );
  requireEqual(source.cache_path === receipt.cache_path, 'cache_path_changed');
  requireEqual(
    source.declared_normalized_text_sha256 === receipt.source_response_sha256
      && source.retained_normalized_text_sha256 === receipt.source_response_sha256
      && source.source_response_sha256 === receipt.source_response_sha256,
    'source_response_hash_changed',
  );
  requireEqual(
    source.source_response_bytes === receipt.source_response_bytes,
    'source_response_bytes_changed',
  );
  requireEqual(
    source.courseblock_index === receipt.courseblock_index,
    'courseblock_index_changed',
  );
  requireEqual(
    source.raw_entry_sha256 === receipt.raw_entry_sha256
      && sha256(source.raw_entry_text) === receipt.raw_entry_sha256,
    'raw_entry_changed',
  );
  requireEqual(
    source.raw_entry_html_sha256 === receipt.raw_entry_html_sha256,
    'raw_entry_html_changed',
  );
  requireEqual(
    sameJson(source.published_units, receipt.published_units),
    'published_units_changed',
  );
  requireEqual(
    sameJson(source.complete_entry_receipt, receipt.complete_entry_receipt),
    'complete_entry_receipt_changed',
  );
  requireEqual(
    Array.isArray(source.structured_requisite_fields)
      && source.structured_requisite_fields.length === 0,
    'structured_requisite_fields_changed',
  );
  const boundedClauses = asArray(clauses).map((clause) => ({
    kind: clause.kind,
    label: clause.label,
    raw: clause.raw,
    relative_start: clause.relative_start,
    relative_end: clause.relative_end,
    statement_relative_start: clause.statement_relative_start,
    statement_relative_end: clause.statement_relative_end,
  }));
  requireEqual(sameJson(boundedClauses, receipt.clauses), 'bounded_clauses_changed');
  for (const row of [
    ...receipt.component_boundaries,
    ...receipt.component_requirements,
  ]) {
    requireEqual(
      source.raw_entry_text?.slice(row.relative_start, row.relative_end) === row.raw
        && sha256(row.raw) === row.raw_sha256,
      `${row.id}_subspan_changed`,
    );
  }

  const sourceBinding = {
    source_response_sha256: receipt.source_response_sha256,
    raw_entry_sha256: receipt.raw_entry_sha256,
    raw_entry_html_sha256: receipt.raw_entry_html_sha256,
    courseblock_index: receipt.courseblock_index,
  };
  if (issues.length) {
    return {
      applicable: true,
      ready: false,
      receipt_contract: VSU_PHYSICS_COMBINED_COMPONENT_RECEIPT_CONTRACT,
      code: candidate.course_code,
      source_binding: sourceBinding,
      issues,
    };
  }

  const componentBoundaries = receipt.component_boundaries.map((row) => (
    bindVsuPhysicsSpan(candidate, row)
  ));
  const componentRequirements = receipt.component_requirements.map((row) => ({
    ...bindVsuPhysicsSpan(candidate, row),
    required_course_key: `${candidate.owner_namespace}:${row.required_course_code}`,
    receiver_graph_edge_identity: row.graph_projection
        === 'preserved_internal_component_corequisite_without_self_edge'
      ? null
      : `${row.kind}:${candidate.course_key}:${candidate.owner_namespace}:${row.required_course_code}`,
  }));
  const groups = receipt.graph_groups.map((row) => ({
    ...formulaGroup({
      owner: candidate.owner_namespace,
      courseKey: candidate.course_key,
      kind: row.kind,
      raw: row.raw,
      tokens: oneCourseToken(row.required_course_code, candidate.owner_namespace, {
        catalog_title_text: row.catalog_title_text,
      }),
      flags: [
        'strict_full_text_accounting',
        'source:virginia-state-university',
        'vsu_exact_combined_lecture_laboratory_component_receipt',
        'identical_component_edges_coalesced_at_receiver_graph_boundary',
      ],
    }),
    component_requirement_ids: [...row.component_requirement_ids],
  }));
  const internalComponents = componentRequirements
    .filter((row) => (
      row.kind === 'corequisite'
      && row.required_course_code === candidate.course_code
      && row.graph_projection
        === 'preserved_internal_component_corequisite_without_self_edge'
    ))
    .map((row) => ({
      kind: 'same_catalog_code_internal_lecture_laboratory_corequisite',
      label: row.label,
      raw: row.raw,
      relative_start: row.relative_start,
      relative_end: row.relative_end,
      statement_relative_start: row.statement_relative_start,
      statement_relative_end: row.statement_relative_end,
      course_code: candidate.course_code,
      component: row.component,
      graph_edge_emitted: false,
      reason:
        'The exact VSU entry assigns the laboratory component the same catalog code as the receiver; emitting this internal corequisite as a graph edge would invent a prerequisite cycle.',
      raw_sha256: row.raw_sha256,
      source_character_start: row.source_character_start,
      source_character_end: row.source_character_end,
      component_requirement_id: row.id,
    }));
  return {
    applicable: true,
    ready: true,
    receipt_contract: VSU_PHYSICS_COMBINED_COMPONENT_RECEIPT_CONTRACT,
    code: candidate.course_code,
    source_binding: sourceBinding,
    component_boundary_evidence: componentBoundaries,
    component_requirements: componentRequirements,
    receiver_graph_semantics:
      'One receiver graph edge represents identical upstream-course requirements repeated for lecture and laboratory components; every component assertion remains separately retained.',
    internal_components: internalComponents,
    groups,
    issues: [],
  };
}

function normalizeCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2,8}\d{2,4}[A-Z]?$/.test(code) ? code : null;
}

function vsuBiol121InternalComponent(candidate, clause) {
  const receipt = VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT;
  if (candidate?.slug !== receipt.slug
      || candidate?.course_code !== receipt.code
      || candidate?.source?.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || candidate.source.source_response_sha256 !== receipt.source_response_sha256
      || candidate.source.raw_entry_sha256 !== receipt.raw_entry_sha256
      || candidate.source.raw_entry_html_sha256 !== receipt.raw_entry_html_sha256
      || clause?.kind !== 'corequisite') return null;
  const exact = receipt.clauses.find((row) => row.raw === clause.raw);
  if (!exact || sha256(clause.raw) !== exact.raw_sha256) return null;
  return {
    ...clause,
    kind: 'same_catalog_code_internal_lecture_laboratory_corequisite',
    course_code: receipt.code,
    component: exact.component,
    graph_edge_emitted: false,
    reason:
      'The official entry assigns the lecture and laboratory component the same BIOL 121 code; emitting a self-edge would invent a second catalog course and a prerequisite cycle.',
    raw_sha256: exact.raw_sha256,
  };
}

function courseCondition(owner, code, raw, extra = {}) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new Error(`invalid university prerequisite code: ${code}`);
  return {
    type: 'course',
    code: normalized,
    course_key: `${owner}:${normalized}`,
    raw,
    ...extra,
  };
}

function nonCourseCondition(condition, raw, extra = {}) {
  return { type: 'non_course', condition, raw, ...extra };
}

function atom(condition) {
  return { type: 'atom', condition };
}

function and(left, right) {
  return { type: 'and', left, right };
}

function or(left, right) {
  return { type: 'or', left, right };
}

function parseBooleanTokens(tokens) {
  let cursor = 0;
  const peek = () => tokens[cursor];
  const take = () => tokens[cursor++];

  function primary() {
    const token = take();
    if (!token) throw new Error('formula ended before an atom');
    if (token.type === 'atom') return atom(token.condition);
    if (token.type === 'lparen') {
      const expression = parseOr();
      if (take()?.type !== 'rparen') throw new Error('formula has an unmatched opening parenthesis');
      return expression;
    }
    throw new Error(`expected formula atom, found ${token.type}`);
  }

  function parseAnd() {
    let expression = primary();
    while (peek()?.type === 'and') {
      take();
      expression = and(expression, primary());
    }
    return expression;
  }

  function parseOr() {
    let expression = parseAnd();
    while (peek()?.type === 'or') {
      take();
      expression = or(expression, parseAnd());
    }
    return expression;
  }

  const expression = parseOr();
  if (cursor !== tokens.length) throw new Error(`formula has trailing ${peek()?.type || 'input'}`);
  return expression;
}

function conditionIdentity(condition) {
  return condition.type === 'course'
    ? `course:${condition.course_key}`
    : `non_course:${condition.condition}:${condition.raw}`;
}

function mergeConditionVariants(conditions) {
  const byIdentity = new Map();
  for (const condition of conditions) {
    const identity = conditionIdentity(condition);
    const prior = byIdentity.get(identity);
    if (!prior) {
      byIdentity.set(identity, { ...condition });
      continue;
    }
    const variants = [
      ...asArray(prior.catalog_variants),
      ...(prior.catalog_variants ? [] : [{
        raw: prior.raw,
        catalog_qualifier: prior.catalog_qualifier || null,
        concurrent_allowed: prior.concurrent_allowed === true,
        minimum_grade: prior.minimum_grade || null,
      }]),
      ...asArray(condition.catalog_variants),
      ...(condition.catalog_variants ? [] : [{
        raw: condition.raw,
        catalog_qualifier: condition.catalog_qualifier || null,
        concurrent_allowed: condition.concurrent_allowed === true,
        minimum_grade: condition.minimum_grade || null,
      }]),
    ];
    prior.catalog_variants = [...new Map(variants.map((row) => [JSON.stringify(row), row])).values()];
    const concurrentValues = new Set(variants.map((row) => row.concurrent_allowed === true));
    if (concurrentValues.size === 1 && concurrentValues.has(true)) prior.concurrent_allowed = true;
    else delete prior.concurrent_allowed;
    if (concurrentValues.size > 1) prior.concurrency_varies_by_catalog_variant = true;
    const grades = new Set(variants.map((row) => row.minimum_grade || null));
    if (grades.size === 1 && !grades.has(null)) prior.minimum_grade = [...grades][0];
    else delete prior.minimum_grade;
    if (grades.size > 1) prior.grade_varies_by_catalog_variant = true;
    delete prior.catalog_qualifier;
  }
  return [...byIdentity.values()];
}

function dnf(expression) {
  if (expression.type === 'atom') return [[expression.condition]];
  if (expression.type === 'or') return [...dnf(expression.left), ...dnf(expression.right)];
  const left = dnf(expression.left);
  const right = dnf(expression.right);
  // CourseLeaf can enumerate several registration variants of the same
  // underlying course. They collapse by topology after expansion; 16384 keeps
  // the raw expansion bounded while accommodating the retained ENGH 302 pair
  // of explicit alternative groups (490 distinct paths after variant merge).
  if (left.length * right.length > 16384) throw new Error('formula expansion exceeds 16384 paths');
  return left.flatMap((leftPath) => right.map((rightPath) => [...leftPath, ...rightPath]));
}

function dedupePaths(paths) {
  const byTopology = new Map();
  for (const path of paths) {
    const merged = mergeConditionVariants(path);
    const topology = merged.map(conditionIdentity).sort().join('|');
    if (!byTopology.has(topology)) {
      byTopology.set(topology, merged);
      continue;
    }
    const combined = mergeConditionVariants([...byTopology.get(topology), ...merged]);
    byTopology.set(topology, combined);
  }
  return [...byTopology.values()];
}

function formulaGroup({ owner, courseKey, kind, raw, tokens, flags = [] }) {
  const expression = parseBooleanTokens(tokens);
  const paths = dedupePaths(dnf(expression));
  if (!paths.length || paths.some((path) => !path.length)) throw new Error('formula has an empty path');
  return {
    id: `${courseKey}:${kind}:0`,
    kind,
    raw,
    flags,
    formula: FORMULA,
    paths: paths.map((allOf, index) => ({
      id: `${courseKey}:${kind}:0:path:${index}`,
      raw,
      all_of: allOf.map((condition) => (
        condition.type === 'course' && !condition.course_key
          ? { ...condition, course_key: `${owner}:${condition.code}` }
          : condition
      )),
    })),
  };
}

function tokenizeGmu(raw, owner) {
  const tokens = [];
  let offset = 0;
  let inheritedPrefix = null;
  const input = String(raw || '').trim();
  while (offset < input.length) {
    const rest = input.slice(offset);
    let match;
    if ((match = rest.match(/^\s+/))) {
      offset += match[0].length;
    } else if (rest[0] === '(') {
      tokens.push({ type: 'lparen' }); offset += 1;
    } else if (rest[0] === ')') {
      tokens.push({ type: 'rparen' }); offset += 1;
    } else if (rest[0] === ',') {
      tokens.push({ type: 'or' }); offset += 1;
    } else if ((match = rest.match(/^(and|or)\b/i))) {
      tokens.push({ type: match[1].toLowerCase() }); offset += match[0].length;
    } else if ((match = rest.match(/^minimum score of (\d+) in '([^']+)'/i))) {
      const score = Number(match[1]);
      const placement = match[2];
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition(
          `minimum_score_${score}_${placement.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
          match[0],
          { placement_test: placement, minimum_score: score },
        ),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^([A-Z]{2,8})\s+(\d)---(?![A-Z0-9-])/i))) {
      const subject = match[1].toUpperCase();
      const level = Number(match[2]);
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition(
          `catalog_course_range_${subject.toLowerCase()}_${level}xx`,
          match[0],
          {
            catalog_course_range: match[0].toUpperCase(),
            subject,
            minimum_catalog_level: level * 100,
            maximum_catalog_level: (level * 100) + 99,
          },
        ),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^([A-Z]{2,8})\s+(U|L)?(\d{2,4})(\*)?(C-|XS|XP|TC|C|T|D|A)?(\*)?(?![A-Z0-9*-])/i))) {
      inheritedPrefix = match[1].toUpperCase();
      const qualifier = [match[2], match[5]].filter(Boolean).join('').toUpperCase() || null;
      const grade = /^(?:U|L)?(C-|C|D)$/.test(qualifier || '')
        ? qualifier.replace(/^(?:U|L)/, '') : null;
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${inheritedPrefix}${match[3]}`, match[0], {
          ...(qualifier ? { catalog_qualifier: qualifier } : {}),
          ...(grade ? { minimum_grade: grade } : {}),
          ...(match[4] || match[6] ? { concurrent_allowed: true } : {}),
        }),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^(U|L)?(\d{2,4})(\*)?(C-|XS|XP|TC|C|T|D|A)?(\*)?(?![A-Z0-9*-])/i)) && inheritedPrefix) {
      const qualifier = [match[1], match[4]].filter(Boolean).join('').toUpperCase() || null;
      const grade = /^(?:U|L)?(C-|C|D)$/.test(qualifier || '')
        ? qualifier.replace(/^(?:U|L)/, '') : null;
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${inheritedPrefix}${match[2]}`, match[0], {
          ...(qualifier ? { catalog_qualifier: qualifier } : {}),
          ...(grade ? { minimum_grade: grade } : {}),
          ...(match[3] || match[5] ? { concurrent_allowed: true } : {}),
        }),
      });
      offset += match[0].length;
    } else {
      throw new Error(`unaccounted GMU formula text at ${JSON.stringify(rest.slice(0, 60))}`);
    }
  }
  return tokens;
}

function tokenizeCourseOnly(raw, owner) {
  const tokens = [];
  let offset = 0;
  let inheritedPrefix = null;
  let input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  while (offset < input.length) {
    const rest = input.slice(offset);
    let match;
    if ((match = rest.match(/^\s+/))) {
      offset += match[0].length;
    } else if ((match = rest.match(/^,\s*(?=or\b)/i))) {
      offset += match[0].length;
    } else if (rest[0] === '(') {
      tokens.push({ type: 'lparen' }); offset += 1;
    } else if (rest[0] === ')') {
      tokens.push({ type: 'rparen' }); offset += 1;
    } else if ((match = rest.match(/^(and|or)\b/i))) {
      tokens.push({ type: match[1].toLowerCase() }); offset += match[0].length;
    } else if ((match = rest.match(/^([A-Z]{2,8})[ -]?(\d{2,4}[A-Z]?)\b/i))) {
      inheritedPrefix = match[1].toUpperCase();
      let concurrent = false;
      let consumed = match[0].length;
      const after = rest.slice(consumed);
      const concurrentMatch = after.match(/^\s*\(may be taken concurrently\)/i);
      if (concurrentMatch) {
        concurrent = true;
        consumed += concurrentMatch[0].length;
      }
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${inheritedPrefix}${match[2]}`, rest.slice(0, consumed), {
          ...(concurrent ? { concurrent_allowed: true } : {}),
        }),
      });
      offset += consumed;
    } else if ((match = rest.match(/^(\d{2,4}[A-Z]?)\b/i)) && inheritedPrefix) {
      let concurrent = false;
      let consumed = match[0].length;
      const after = rest.slice(consumed);
      const concurrentMatch = after.match(/^\s*\(may be taken concurrently\)/i);
      if (concurrentMatch) {
        concurrent = true;
        consumed += concurrentMatch[0].length;
      }
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${inheritedPrefix}${match[1]}`, rest.slice(0, consumed), {
          ...(concurrent ? { concurrent_allowed: true } : {}),
        }),
      });
      offset += consumed;
    } else {
      throw new Error(`unaccounted course-only formula text at ${JSON.stringify(rest.slice(0, 60))}`);
    }
  }
  return tokens;
}

function tokenizeNsuTake(raw, owner) {
  const input = String(raw || '').trim();
  const tokens = [];
  let offset = 0;
  while (offset < input.length) {
    const match = input.slice(offset).match(/^(Take\s+)?([A-Z]{2,8})[- ](\d{2,4}[A-Z]?)\.\s*/i);
    if (!match) throw new Error(`unaccounted NSU Take formula text at ${JSON.stringify(input.slice(offset, offset + 60))}`);
    if (!match[1] && tokens.length === 0) throw new Error('NSU formula must begin with an explicit Take statement');
    if (tokens.length) tokens.push({ type: 'and' });
    tokens.push({
      type: 'atom',
      condition: courseCondition(owner, `${match[2]}${match[3]}`, match[0].trim()),
    });
    offset += match[0].length;
  }
  return tokens;
}

function withMinimumGrade(tokens, grade) {
  return tokens.map((token) => token.type === 'atom' && token.condition.type === 'course'
    ? { ...token, condition: { ...token.condition, minimum_grade: grade.toUpperCase() } }
    : token);
}

function normalizeFlatList(raw, operator) {
  let text = String(raw || '').trim();
  if (operator === 'or') {
    text = text.replace(/^any (?:one )?of:\s*/i, '').replace(/^one of\s+/i, '');
    text = text.replace(/,\s*or\b/gi, ' or ').replace(/,/g, ' or ');
  } else {
    text = text.replace(/,\s*(?:and\s+)?/gi, ' and ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * A second, still closed grammar for grade phrases whose scope is explicit in
 * the source. It deliberately rejects clauses where a trailing grade phrase
 * could modify only the last item, and mixed unparenthesized AND/OR lists.
 */
function tokenizeStrictGradeFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  let match;

  match = input.match(/^(?:A\s+)?grade of ([A-F]) or better in any (?:one )?of:\s*(.+)$/i);
  if (match) {
    return withMinimumGrade(
      tokenizeCourseOnly(normalizeFlatList(match[2], 'or'), owner),
      match[1],
    );
  }

  match = input.match(/^(?:A\s+)?grade of ([A-F]) or better in\s+(.+)$/i);
  if (match) {
    const body = match[2];
    if (body.includes(',') && /\bor\b/i.test(body) && !/\band\b/i.test(body)) {
      return withMinimumGrade(
        tokenizeCourseOnly(normalizeFlatList(body, 'or'), owner),
        match[1],
      );
    }
    if (body.includes(',') || body.includes(';')) {
      throw new Error('grade scope over a punctuated list is not explicit');
    }
    return withMinimumGrade(tokenizeCourseOnly(body, owner), match[1]);
  }

  match = input.match(/^([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?)\s*\(grade of ([A-F]) or better\)$/i);
  if (match) return withMinimumGrade(tokenizeCourseOnly(match[1], owner), match[2]);

  match = input.match(/^([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?),? with (?:a )?(?:minimum )?grade of ([A-F])(?: or (?:better|higher))?$/i);
  if (match) return withMinimumGrade(tokenizeCourseOnly(match[1], owner), match[2]);

  match = input.match(/^(.+?),?\s+(both|each|either) with (?:a )?minimum grades? of ([A-F])$/i);
  if (match) {
    const body = match[1];
    const listWord = match[2].toLowerCase();
    if (/\band\b/i.test(body) && /\bor\b/i.test(body) && !/[()]/.test(body)) {
      throw new Error('mixed AND/OR grade list has no explicit grouping');
    }
    const operator = listWord === 'either' ? 'or' : 'and';
    return withMinimumGrade(
      tokenizeCourseOnly(normalizeFlatList(body, operator), owner),
      match[3],
    );
  }

  match = input.match(/^([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?) with (?:a )?grade of ([A-F]) or better and ([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?) with (?:a )?grade of \2 or better$/i);
  if (match) {
    return withMinimumGrade(tokenizeCourseOnly(`${match[1]} and ${match[3]}`, owner), match[2]);
  }

  throw new Error('clause is outside the strict grade-phrase grammar');
}

/**
 * Shenandoah's Acalog detail rows expose a separately bounded structured
 * prerequisite field. Accept only full-field course formulas plus the exact
 * retained MATH 102 placement-assignment alternative. An ungrouped mixture
 * of AND and OR, punctuation-implied connectors, authorization, or free prose
 * is deliberately left unparsed.
 */
function tokenizeShenandoahStrictFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim()
    .replace(/\s+([,;.()])/g, '$1');
  const courseNormalized = input.replace(/\b([A-Z]{2,8})-(\d{2,4}[A-Z]?)\b/g, '$1 $2');
  if (/^Math 101 or assignment through the Math Placement Test\.$/i.test(courseNormalized)) {
    return joinTokenLists(
      oneCourseToken('MATH 101', owner),
      'or',
      oneNonCourseToken(
        'assignment_through_math_placement_test',
        'assignment through the Math Placement Test',
        {
          assessment_kind: 'placement_test',
          placement_test: 'Math Placement Test',
          placement_assignment_required: true,
        },
      ),
    );
  }
  let match = courseNormalized.match(
    /^Earned grade of [“"]([A-F][+-]?)[”"] or better in ([A-Z]{2,8}\s+\d{2,4}[A-Z]?)[.]?$/i,
  );
  if (match) return [{
    type: 'atom',
    condition: courseCondition(owner, match[2], match[2], {
      minimum_grade: match[1].toUpperCase(),
    }),
  }];
  const booleanText = courseNormalized.replace(/[.]$/, '');
  if (/[;,]/.test(booleanText)) {
    throw new Error('Shenandoah punctuation cannot imply a Boolean connector');
  }
  if (/\band\b/i.test(booleanText) && /\bor\b/i.test(booleanText)
      && !/[()]/.test(booleanText)) {
    throw new Error('Shenandoah mixed AND/OR formula has no explicit grouping');
  }
  const tokens = tokenizeCourseOnly(booleanText, owner);
  parseBooleanTokens(tokens);
  return tokens;
}

/**
 * UVA Wise's Acalog entries use atom-local grade suffixes. Accept a grade only
 * on the leading atom, before any connector; a trailing grade after a
 * conjunction could scope to that atom or the whole list and fails closed.
 * Otherwise accept only course atoms, explicit Boolean operators/parentheses,
 * and the literal class-standing atom observed in the pinned detail records.
 * Authorization, placement, recommendation, and implied punctuation never
 * enter this grammar.
 */
function tokenizeUvaWiseStrictFormula(raw, owner) {
  const tokens = [];
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  if (/^Permission of instructor$/i.test(input)) {
    return oneNonCourseToken(
      'permission_of_instructor', input,
      { authorization_kind: 'permission', authorization_authority: 'instructor' },
    );
  }
  const booleanText = input.replace(/\bor better\b/gi, '');
  if (/\band\b/i.test(booleanText) && /\bor\b/i.test(booleanText) && !/[()]/.test(input)) {
    throw new Error('UVA Wise mixed AND/OR formula has no explicit grouping');
  }
  let offset = 0;
  while (offset < input.length) {
    const rest = input.slice(offset);
    let match;
    if ((match = rest.match(/^\s+/))) {
      offset += match[0].length;
    } else if (rest[0] === '(') {
      tokens.push({ type: 'lparen' }); offset += 1;
    } else if (rest[0] === ')') {
      tokens.push({ type: 'rparen' }); offset += 1;
    } else if ((match = rest.match(/^(and|or)\b/i))) {
      tokens.push({ type: match[1].toLowerCase() }); offset += match[0].length;
    } else if ((match = rest.match(/^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)(?:\s+with a(?: grade of)?\s+([A-F][+-]?)\s+or better)?\b/i))) {
      if (match[3] && tokens.some((token) => token.type === 'atom')) {
        throw new Error('UVA Wise trailing grade phrase has ambiguous conjunction scope');
      }
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${match[1]}${match[2]}`, match[0], {
          ...(match[3] ? { minimum_grade: match[3].toUpperCase() } : {}),
        }),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^(senior standing)\b/i))) {
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition('senior_standing_or_higher', match[0], {
          minimum_class_standing: 'senior',
        }),
      });
      offset += match[0].length;
    } else {
      throw new Error(`unaccounted UVA Wise formula text at ${JSON.stringify(rest.slice(0, 60))}`);
    }
  }
  parseBooleanTokens(tokens);
  return tokens;
}

const STRICT_CODE = '[A-Z]{2,8}[ -]?\\d{2,4}[A-Z]?';

function parenthesized(tokens) {
  return [{ type: 'lparen' }, ...tokens, { type: 'rparen' }];
}

function joinTokenLists(left, operator, right, { groupRight = false } = {}) {
  return [...left, { type: operator }, ...(groupRight ? parenthesized(right) : right)];
}

function combineTokenLists(lists, operator) {
  if (!Array.isArray(lists) || !lists.length) throw new Error('cannot combine an empty token-list set');
  return lists.slice(1).reduce(
    (combined, current) => joinTokenLists(combined, operator, current),
    lists[0],
  );
}

function oneCourseToken(raw, owner, extra = {}) {
  const code = normalizeCode(raw);
  if (!code) throw new Error(`invalid explicit course atom: ${raw}`);
  return [{ type: 'atom', condition: courseCondition(owner, code, raw, extra) }];
}

function oneNonCourseToken(condition, raw, extra = {}) {
  return [{ type: 'atom', condition: nonCourseCondition(condition, raw, extra) }];
}

function strictFormulaRejectionAuditReceipt(candidate, clauses) {
  const key = `${candidate?.slug}:${candidate?.course_code}`;
  const contract = STRICT_FORMULA_REJECTION_AUDIT[key];
  if (!contract) return { applicable: false };
  const source = candidate?.source || {};
  const boundedClauses = asArray(clauses);
  const clause = boundedClauses[0];
  const sourceResponseSha256 = source.source_response_sha256
    || source.retained_normalized_text_sha256;
  const issues = [];
  if (boundedClauses.length !== 1) issues.push('required_clause_count_changed');
  if (source.official_url !== contract.official_url) issues.push('official_url_changed');
  if (sourceResponseSha256 !== contract.source_response_sha256
      || source.declared_normalized_text_sha256 !== contract.source_response_sha256
      || source.retained_normalized_text_sha256 !== contract.source_response_sha256) {
    issues.push('complete_source_response_changed');
  }
  if (source.raw_entry_sha256 !== contract.raw_entry_sha256
      || sha256(source.raw_entry_text) !== contract.raw_entry_sha256) {
    issues.push('complete_entry_changed');
  }
  if (contract.raw_entry_html_sha256 != null
      && source.raw_entry_html_sha256 !== contract.raw_entry_html_sha256) {
    issues.push('complete_entry_html_changed');
  }
  if (clause?.raw !== contract.clause
      || sha256(clause?.raw) !== contract.clause_sha256) {
    issues.push('required_clause_changed');
  }
  return {
    applicable: true,
    receipt_contract: STRICT_FORMULA_REJECTION_AUDIT_CONTRACT,
    prior_review_reason: 'strict_formula_parser_rejected',
    decision: contract.decision,
    strategy: contract.strategy || null,
    official_url: contract.official_url,
    source_response_sha256: contract.source_response_sha256,
    raw_entry_sha256: contract.raw_entry_sha256,
    raw_entry_html_sha256: contract.raw_entry_html_sha256,
    required_clause_sha256: contract.clause_sha256,
    source_receipt_valid: issues.length === 0,
    issues,
    decision_reason: contract.decision_reason,
    inference_boundary: contract.decision === 'promoted_lossless_formula'
      ? 'This decision applies only to the hash-pinned complete entry and exact required clause. It does not broaden the institution parser or infer a formula for similar punctuation.'
      : 'No formula is emitted. Resolving this row requires a newly unambiguous official source or authoritative institutional clarification.',
  };
}

function auditedStrictFormulaTokens(candidate, audit) {
  if (!audit?.applicable) return null;
  if (!audit.source_receipt_valid) {
    throw new Error(`strict formula rejection audit receipt changed: ${audit.issues.join(', ')}`);
  }
  if (audit.decision !== 'promoted_lossless_formula') {
    throw new Error(audit.decision_reason);
  }
  const owner = candidate.owner_namespace;
  switch (audit.strategy) {
    case 'radford_math171_nested_grade_or_placement': {
      const gradeScope =
        'leading_grade_phrase_over_lowercase_or_course_alternatives_before_uppercase_or';
      return combineTokenLists([
        oneCourseToken('MATH 138', owner, {
          minimum_grade: 'C', catalog_grade_scope: gradeScope,
        }),
        oneNonCourseToken(
          'approved_college_level_precalculus_course_including_trigonometry',
          'another approved college-level precalculus course including some trigonometry',
          {
            represents_course_choice: true,
            course_level: 'college-level',
            course_subject_area: 'precalculus',
            trigonometry_included: true,
            approval_required: true,
            minimum_grade: 'C',
            catalog_grade_scope: gradeScope,
          },
        ),
        oneNonCourseToken(
          'passing_score_on_department_approved_mathematics_placement_exam',
          'a passing score on a placement exam approved by the Department of Mathematics and Statistics',
          {
            assessment_kind: 'placement_exam',
            passing_score_required: true,
            approval_authority: 'Department of Mathematics and Statistics',
          },
        ),
      ], 'or');
    }
    case 'uva_wise_csc2180_atom_local_trailing_grade':
      return joinTokenLists(
        oneCourseToken('CSC 1180', owner),
        'and',
        oneCourseToken('MTH 1110', owner, {
          minimum_grade: 'C',
          catalog_grade_scope: 'atom_local_trailing_grade_phrase',
        }),
      );
    case 'vcu_bnfo201_atom_local_grade_or_placement':
      return combineTokenLists([
        oneCourseToken('MATH 151', owner),
        oneCourseToken('MATH 200', owner, {
          minimum_grade: 'C',
          catalog_grade_scope: 'atom_local_trailing_minimum_grade_phrase',
          catalog_displayed_code: '200',
          inherited_subject_from_preceding_course: 'MATH',
        }),
        oneNonCourseToken(
          'recent_satisfactory_vcu_mathematics_placement_test_score',
          'satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
          {
            evidence_kind: 'placement_assessment',
            placement_test: 'VCU Mathematics Placement Test',
            satisfactory_score_required: true,
            maximum_age_years: 1,
            recency_measured_before: 'the beginning of the course',
          },
        ),
      ], 'or');
    case 'vcu_egre254_department_applicable_or_of_routes': {
      const gradeScope =
        'explicit_all_over_semicolon_delimited_department_applicable_routes';
      const route = (codes) => {
        const normalizedCodes = codes.map((code) => normalizeCode(code));
        const courses = combineTokenLists(codes.map((code) => oneCourseToken(code, owner, {
          minimum_grade: 'C',
          catalog_grade_scope: gradeScope,
          departmentally_applicable_route_required: true,
        })), 'and');
        const applicability = oneNonCourseToken(
          `departmental_applicability_for_${normalizedCodes.join('_').toLowerCase()}_route`,
          'as applicable per department',
          {
            route_course_codes: normalizedCodes,
            route_selection_authority: 'department',
            departmental_applicability_required: true,
          },
        );
        return joinTokenLists(courses, 'and', applicability);
      };
      return combineTokenLists([
        route(['EGRE 101']),
        route(['EGRB 102']),
        route(['CLSE 101']),
        route(['EGMN 190', 'EGMN 203']),
        route(['EGMN 102', 'EGMN 190']),
      ].map(parenthesized), 'or');
    }
    case 'vcu_engr261_choice_and_cmsc254_shared_grade': {
      const gradeScope = 'explicit_each_over_semicolon_delimited_choice_and_requirement';
      const choice = combineTokenLists([
        'CLSE 101', 'EGMN 190', 'EGRB 102', 'EGRE 101', 'ENGR 105',
      ].map((code) => oneCourseToken(code, owner, {
        minimum_grade: 'C', catalog_grade_scope: gradeScope,
      })), 'or');
      return joinTokenLists(
        parenthesized(choice),
        'and',
        oneCourseToken('CMSC 254', owner, {
          minimum_grade: 'C', catalog_grade_scope: gradeScope,
        }),
      );
    }
    default:
      throw new Error(`unsupported strict formula rejection audit strategy: ${audit.strategy}`);
  }
}

function courseOrHigherTokens(value, owner) {
  const match = String(value || '').trim().match(new RegExp(`^(${STRICT_CODE}) or higher$`, 'i'));
  if (!match) throw new Error(`course-or-higher phrase is not exact: ${value}`);
  const floorCode = normalizeCode(match[1]);
  return joinTokenLists(
    oneCourseToken(match[1], owner),
    'or',
    oneNonCourseToken(
      `course_higher_than_${floorCode.toLowerCase()}`,
      'higher',
      {
        subject: floorCode.match(/^[A-Z]+/)[0],
        exclusive_course_floor: floorCode,
        represents_course_choice: true,
      },
    ),
  );
}

function expandCnuSlashPairs(value) {
  return String(value || '').replace(
    /\b([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)\s*\/\s*(\d{2,4}[A-Z]?)\b/gi,
    (match, prefix, first, second) => `(${prefix} ${first} and ${prefix} ${second})`,
  );
}

function cnuCourseTokens(value, owner) {
  return tokenizeCourseOnly(expandCnuSlashPairs(value), owner);
}

function hasMixedWords(value) {
  return /\band\b/i.test(value) && /\bor\b/i.test(value);
}

const CNU_PINNED_WHOLE_CLAUSE_FORMULAS = Object.freeze({
  CPSC250_COREQUISITE:
    'CPSC 250L and MATH 135 or 140 or 148 or permission of department chair',
  CPSC471_472:
    'CPSC 255 or 256 and MATH 235 or 260 or ENGR 210 or PHYS 340 each with a grade of C- or higher',
  SPECIAL_TOPICS: 'As announced',
  MATH135:
    'MATH 130 or 132 with a C- or higher or an acceptable score on the Calculus Readiness Assessment',
  MATH140:
    'MATH 130 or 132 with a C- or higher (MATH 132 is preferred) or an acceptable score on the Calculus Readiness Assessment',
  PHYS341: 'PHYS 151/152 or 202/202L and MATH 140 or 148',
  PHYS441:
    'PHYS 152 or 202 and CPSC 250 and (MATH 140 or 148) or consent of instructor',
});
const CNU_PINNED_WHOLE_CLAUSE_VALUES = Object.freeze(
  Object.values(CNU_PINNED_WHOLE_CLAUSE_FORMULAS),
);

function cnuAlternatives(codes, owner, extra = {}) {
  return combineTokenLists(codes.map((code) => oneCourseToken(code, owner, extra)), 'or');
}

function cnuSharedGradeAlternatives(codes, owner, grade, scope) {
  return cnuAlternatives(codes, owner, {
    minimum_grade: grade,
    catalog_grade_scope: scope,
  });
}

/**
 * Strict grammar for the finite CNU phrasings present in the retained PDF.
 * Slash pairs are conjunctive only when the same printed prefix owns both
 * numbers. Mixed unparenthesized AND/OR prose is deliberately rejected unless
 * one of the explicit grouped forms below accounts for it in full.
 */
function tokenizeCnuStrictFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.]\s*$/, '');
  const grade = '([A-F][+-]?)';
  let match;

  // These exact retained clauses use CNU's owner-local list conventions. They
  // are intentionally a closed roster: every atom, connector, grade phrase,
  // parenthetical preference, and authorization phrase is accounted for, and
  // any content mutation falls back to manual review.
  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.CPSC250_COREQUISITE) {
    const mathOrAuthorization = combineTokenLists([
      ...['MATH 135', 'MATH 140', 'MATH 148'].map((code) => oneCourseToken(code, owner)),
      oneNonCourseToken(
        'permission_of_department_chair', 'permission of department chair',
        { authorization_kind: 'permission', authorization_authority: 'department chair' },
      ),
    ], 'or');
    return joinTokenLists(
      oneCourseToken('CPSC 250L', owner),
      'and',
      mathOrAuthorization,
      { groupRight: true },
    );
  }

  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.CPSC471_472) {
    const sharedScope = 'explicit_each_over_pinned_cnu_course_roster';
    return joinTokenLists(
      parenthesized(cnuSharedGradeAlternatives(
        ['CPSC 255', 'CPSC 256'], owner, 'C-', sharedScope,
      )),
      'and',
      parenthesized(cnuSharedGradeAlternatives(
        ['MATH 235', 'MATH 260', 'ENGR 210', 'PHYS 340'], owner, 'C-', sharedScope,
      )),
    );
  }

  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.SPECIAL_TOPICS) {
    return oneNonCourseToken(
      'prerequisites_as_announced', input,
      { dynamic_catalog_prerequisite: true, announcement_required: true },
    );
  }

  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.MATH135
      || input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.MATH140) {
    const gradedCourses = cnuSharedGradeAlternatives(
      ['MATH 130', 'MATH 132'], owner, 'C-',
      'shared_trailing_grade_phrase_over_pinned_cnu_alternatives',
    );
    return joinTokenLists(
      parenthesized(gradedCourses),
      'or',
      oneNonCourseToken(
        'acceptable_calculus_readiness_assessment_score',
        'an acceptable score on the Calculus Readiness Assessment',
        {
          placement_test: 'Calculus Readiness Assessment',
          acceptable_score_required: true,
        },
      ),
    );
  }

  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.PHYS341) {
    const physics = joinTokenLists(
      parenthesized(combineTokenLists([
        oneCourseToken('PHYS 151', owner), oneCourseToken('PHYS 152', owner),
      ], 'and')),
      'or',
      parenthesized(combineTokenLists([
        oneCourseToken('PHYS 202', owner), oneCourseToken('PHYS 202L', owner),
      ], 'and')),
    );
    return joinTokenLists(
      parenthesized(physics),
      'and',
      parenthesized(cnuAlternatives(['MATH 140', 'MATH 148'], owner)),
    );
  }

  if (input === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.PHYS441) {
    let courseRoute = joinTokenLists(
      parenthesized(cnuAlternatives(['PHYS 152', 'PHYS 202'], owner)),
      'and',
      oneCourseToken('CPSC 250', owner),
    );
    courseRoute = joinTokenLists(
      courseRoute,
      'and',
      parenthesized(cnuAlternatives(['MATH 140', 'MATH 148'], owner)),
    );
    return joinTokenLists(
      parenthesized(courseRoute),
      'or',
      oneNonCourseToken(
        'consent_of_instructor', 'consent of instructor',
        { authorization_kind: 'consent', authorization_authority: 'instructor' },
      ),
    );
  }

  if (/^High school algebra and trigonometry or consent of instructor$/i.test(input)) {
    return joinTokenLists(
      oneNonCourseToken(
        'high_school_algebra_and_trigonometry',
        'High school algebra and trigonometry',
        {
          education_level: 'high_school',
          subject_requirements: ['algebra', 'trigonometry'],
          source_phrase_kept_as_one_condition: true,
        },
      ),
      'or',
      oneNonCourseToken(
        'consent_of_instructor', 'consent of instructor',
        { authorization_kind: 'consent', authorization_authority: 'instructor' },
      ),
    );
  }

  match = input.match(/^An acceptable score on the Calculus Readiness Assessment and consent of department chair$/i);
  if (match) {
    return joinTokenLists(
      oneNonCourseToken('acceptable_calculus_readiness_assessment_score', 'An acceptable score on the Calculus Readiness Assessment'),
      'and',
      oneNonCourseToken('consent_of_department_chair', 'consent of department chair'),
    );
  }

  if (/^An acceptable score on the Calculus Readiness Assessment$/i.test(input)) {
    return oneNonCourseToken(
      'acceptable_calculus_readiness_assessment_score',
      'An acceptable score on the Calculus Readiness Assessment',
    );
  }

  if (/^Through Algebra II in high school$/i.test(input)) {
    return oneNonCourseToken('high_school_algebra_ii', 'Through Algebra II in high school');
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) with a ${grade} or higher and (sophomore|junior|senior) standing$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner, { minimum_grade: match[2].toUpperCase() }),
      'and',
      oneNonCourseToken(`${match[3].toLowerCase()}_standing`, `${match[3]} standing`),
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) with (?:a )?(?:grade of )?${grade} or higher or consent of instructor$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner, { minimum_grade: match[2].toUpperCase() }),
      'or',
      oneNonCourseToken('consent_of_instructor', 'consent of instructor'),
    );
  }

  match = input.match(new RegExp(`^(.+?) and (?:a )?grade of ${grade} or higher in (${STRICT_CODE})$`, 'i'));
  if (match) {
    if (/\bor\b/i.test(match[1])) throw new Error('CNU leading conjuncts have ungrouped OR');
    return joinTokenLists(
      cnuCourseTokens(match[1], owner),
      'and',
      oneCourseToken(match[3], owner, { minimum_grade: match[2].toUpperCase() }),
    );
  }

  match = input.match(new RegExp(`^(.+?);\\s*(.+?),\\s*all with (?:a )?${grade} or higher$`, 'i'));
  if (match) {
    if (/\bor\b/i.test(match[1]) || /\band\b/i.test(match[2])) {
      throw new Error('CNU semicolon grade groups have unsupported internal topology');
    }
    const grouped = joinTokenLists(
      cnuCourseTokens(match[1], owner),
      'and',
      cnuCourseTokens(match[2], owner),
      { groupRight: true },
    );
    return withMinimumGrade(grouped, match[3]);
  }

  match = input.match(new RegExp(`^(?:Grade of )?${grade} or higher in (.+)$`, 'i'));
  if (match) {
    if (hasMixedWords(match[2])) throw new Error('CNU graded course list has mixed ungrouped AND/OR');
    return withMinimumGrade(cnuCourseTokens(match[2], owner), match[1]);
  }

  match = input.match(new RegExp(`^(.+) with (?:a )?(?:grade of )?${grade} or higher$`, 'i'));
  if (match) {
    if (hasMixedWords(match[1])) throw new Error('CNU grade suffix has mixed ungrouped AND/OR');
    return withMinimumGrade(cnuCourseTokens(match[1], owner), match[2]);
  }

  match = input.match(/^(.+) and (sophomore|junior|senior) standing$/i);
  if (match) {
    if (hasMixedWords(match[1])) throw new Error('CNU standing formula has mixed ungrouped AND/OR');
    return joinTokenLists(
      cnuCourseTokens(match[1], owner),
      'and',
      oneNonCourseToken(`${match[2].toLowerCase()}_standing`, `${match[2]} standing`),
    );
  }

  match = input.match(new RegExp(`^(.+),\\s*(${STRICT_CODE})$`, 'i'));
  if (match && /\bor\b/i.test(match[1]) && !/\band\b/i.test(match[1])) {
    return joinTokenLists(
      parenthesized(cnuCourseTokens(match[1], owner)),
      'and',
      oneCourseToken(match[2], owner),
    );
  }

  if (hasMixedWords(input)) throw new Error('CNU formula has mixed ungrouped AND/OR');
  if (/[,;]/.test(input)) {
    if (/\bor\b/i.test(input)) throw new Error('CNU punctuated formula also contains OR');
    return cnuCourseTokens(input.replace(/[,;]/g, ' and '), owner);
  }
  return cnuCourseTokens(input, owner);
}

/**
 * Closed grammar for the finite Bridgewater CleanCatalog clauses retained by
 * the official-course-page acquisition adapter.  A missing labelled field is
 * intentionally handled by reviewCandidate as unparsed, never as none.
 */
function tokenizeBridgewaterStrictFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.]\s*$/, '');
  if (/^Sophomore standing$/i.test(input)) {
    return oneNonCourseToken('sophomore_standing', input);
  }

  let match = input.match(
    /^A grade of ([A-F][+-]?) or greater in ([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?(?:\s+or\s+[A-Z]{2,8}[ -]?\d{2,4}[A-Z]?)+)$/i,
  );
  if (match) {
    return withMinimumGrade(tokenizeCourseOnly(match[2], owner), match[1]);
  }

  match = input.match(
    /^A grade of ([A-F][+-]?) or greater in ([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?)$/i,
  );
  if (match) return withMinimumGrade(oneCourseToken(match[2], owner), match[1]);

  match = input.match(
    /^A grade of ([A-F][+-]?) or greater in (CSCI[ -]?101)\s*,\s*or both (CSCI[ -]?100) and a grade of \1 or greater on the (CSCI[ -]?101) assessment exam$/i,
  );
  if (match) {
    const direct = withMinimumGrade(oneCourseToken(match[2], owner), match[1]);
    const assessmentRoute = joinTokenLists(
      oneCourseToken(match[3], owner),
      'and',
      oneNonCourseToken(
        'csci101_assessment_exam_minimum_grade_c',
        `a grade of ${match[1].toUpperCase()} or greater on the ${match[4]} assessment exam`,
        {
          assessment_for_course_code: 'CSCI101',
          minimum_grade: match[1].toUpperCase(),
        },
      ),
    );
    return joinTokenLists(direct, 'or', assessmentRoute, { groupRight: true });
  }

  if (/^C SCI-130 with a minimum grade of C or on the CSCI-130 assessment exam$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('C SCI-130', owner, { minimum_grade: 'C' }),
      'or',
      oneNonCourseToken(
        'csci130_assessment_exam_catalog_requirement',
        'on the CSCI-130 assessment exam',
        {
          assessment_for_course_code: 'CSCI130',
          // The source does not print a score after "or on". Retain the
          // assessment route without manufacturing a threshold.
          threshold_published: false,
        },
      ),
    );
  }

  match = input.match(
    /^(CL[ -]?200)\s*;\s*CSCI major\s*;\s*(\d+)\+ credits completed$/i,
  );
  if (match) {
    const minimum = Number(match[2]);
    if (!Number.isSafeInteger(minimum) || minimum <= 0) {
      throw new Error('Bridgewater completed-credit threshold is invalid');
    }
    return combineTokenLists([
      oneCourseToken(match[1], owner),
      oneNonCourseToken('csci_major', 'CSCI major', { required_major_code: 'CSCI' }),
      oneNonCourseToken(
        `minimum_${minimum}_completed_credits`,
        `${match[2]}+ credits completed`,
        { minimum_completed_credits: minimum },
      ),
    ], 'and');
  }

  match = input.match(
    /^([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?) or permission of instructor$/i,
  );
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'or',
      oneNonCourseToken('instructor_permission', 'permission of instructor'),
    );
  }

  const completedCredits = input.match(/^(\d+)\+ credits completed;\s*([A-Z]{2,8}[ -]?\d{2,4}[A-Z]?)$/i);
  if (completedCredits) {
    const minimum = Number(completedCredits[1]);
    if (!Number.isSafeInteger(minimum) || minimum <= 0) {
      throw new Error('Bridgewater completed-credit threshold is invalid');
    }
    return joinTokenLists(
      oneNonCourseToken(
        `minimum_${minimum}_completed_credits`,
        `${completedCredits[1]}+ credits completed`,
        { minimum_completed_credits: minimum },
      ),
      'and',
      oneCourseToken(completedCredits[2], owner),
    );
  }

  return tokenizeCourseOnly(input, owner);
}

/**
 * Closed grammar for the finite required clauses on Longwood's first-party
 * Computer Science Course Listing. Commas are conjunctive list separators;
 * AND/OR may not be mixed without grouping (none of the accepted clauses uses
 * grouping). Grade language is atom-local, and consent/standing remain typed
 * non-course conditions rather than being discarded as prose.
 */
function tokenizeLongwoodStrictFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.]\s*$/, '');
  const perspectives = input.match(/^Completion of three perspective level courses\. The fourth perspectives level course must be taken prior to or concurrently with (CTZN\s+410)$/i);
  if (perspectives) {
    return joinTokenLists(
      oneNonCourseToken(
        'minimum_three_completed_perspective_level_courses',
        'Completion of three perspective level courses',
        {
          course_category: 'perspective_level_course',
          minimum_completed_courses: 3,
        },
      ),
      'and',
      oneNonCourseToken(
        'fourth_perspective_level_course_prior_or_concurrent_with_ctzn410',
        `The fourth perspectives level course must be taken prior to or concurrently with ${perspectives[1]}`,
        {
          course_category: 'perspective_level_course',
          required_ordinal_course: 4,
          target_course_code: 'CTZN410',
          concurrent_allowed: true,
        },
      ),
    );
  }
  if (/^SPAN 212 or an appropriate placement score$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('SPAN 212', owner),
      'or',
      oneNonCourseToken(
        'appropriate_spanish_placement_score',
        'an appropriate placement score',
        {
          placement_domain: 'Spanish',
          appropriate_score_required: true,
          threshold_published: false,
        },
      ),
    );
  }
  const tokens = [];
  const connectors = new Set();
  let offset = 0;
  while (offset < input.length) {
    const rest = input.slice(offset);
    let match;
    if ((match = rest.match(/^\s+/))) {
      offset += match[0].length;
    } else if ((match = rest.match(/^,\s*/))) {
      tokens.push({ type: 'and' });
      connectors.add('and');
      offset += match[0].length;
    } else if ((match = rest.match(/^(and|or)\b/i))) {
      const operator = match[1].toLowerCase();
      tokens.push({ type: operator });
      connectors.add(operator);
      offset += match[0].length;
    } else if ((match = rest.match(/^([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)(?:\s+with\s+(?:(?:a\s+)?grade\s+of\s+|a\s+)([A-F][+-]?)\s+or\s+(better|higher))?(?![A-Z0-9])/i))) {
      const rawAtom = match[0];
      tokens.push({
        type: 'atom',
        condition: courseCondition(owner, `${match[1]}${match[2]}`, rawAtom, {
          ...(match[3] ? { minimum_grade: match[3].toUpperCase() } : {}),
        }),
      });
      offset += rawAtom.length;
    } else if ((match = rest.match(/^completion of (FHBS|FGLO) pillar\b/i))) {
      const pillar = match[1].toUpperCase();
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition(`completion_of_${pillar.toLowerCase()}_pillar`, match[0], {
          civitae_pillar: pillar,
          completion_required: true,
        }),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^Sophomore standing or higher\b/i))) {
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition('sophomore_standing_or_higher', match[0], {
          minimum_class_standing: 'sophomore',
        }),
      });
      offset += match[0].length;
    } else if ((match = rest.match(/^(consent|permission) of (?:the )?(instructor|department chair)\b/i))) {
      const kind = match[1].toLowerCase();
      const authority = match[2].toLowerCase().replace(/\s+/g, '_');
      tokens.push({
        type: 'atom',
        condition: nonCourseCondition(`${kind}_of_${authority}`, match[0], {
          authorization_kind: kind,
          authorization_authority: match[2].toLowerCase(),
        }),
      });
      offset += match[0].length;
    } else {
      throw new Error(`unaccounted Longwood formula text at ${JSON.stringify(rest.slice(0, 60))}`);
    }
  }
  if (connectors.size > 1) {
    throw new Error('Longwood formula has mixed ungrouped AND/OR');
  }
  parseBooleanTokens(tokens);
  return tokens;
}

/**
 * Radford's Acalog pages use a small set of prose grade/list forms rather
 * than CourseLeaf's encoded registration syntax. Every accepted production
 * below is anchored over the entire retained clause after whitespace-only
 * DOM punctuation normalization. The ungrouped CS 322 mixed AND/OR form is
 * intentionally outside this grammar.
 */
function tokenizeRadfordStrictFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim()
    .replace(/\s+([,;.()])/g, '$1');
  const code = `(${STRICT_CODE})`;
  const quote = '[“”"]';
  const graded = (value) => oneCourseToken(value, owner, { minimum_grade: 'C' });
  const credit = (value) => oneCourseToken(value, owner, {
    completion_credit_required: true,
    catalog_scope: 'credit_for',
  });
  let match;

  match = input.match(new RegExp(
    `^Grade of ${quote}C${quote} or better in either ${code} or ${code}\\.$`, 'i',
  ));
  if (match) return joinTokenLists(graded(match[1]), 'or', graded(match[2]));

  match = input.match(new RegExp(
    `^${code} or ${code} with a grade of ${quote}C${quote} or better\\.$`, 'i',
  ));
  if (match) return joinTokenLists(graded(match[1]), 'or', graded(match[2]));

  match = input.match(new RegExp(
    `^${code}, ${code}, or ${code} with a grade of ${quote}C${quote} or better\\.$`, 'i',
  ));
  if (match) return combineTokenLists([
    graded(match[1]), graded(match[2]), graded(match[3]),
  ], 'or');

  match = input.match(new RegExp(
    `^${code} with a grade of ${quote}C${quote} or better, and ${code}\\.$`, 'i',
  ));
  if (match) return joinTokenLists(graded(match[1]), 'and', oneCourseToken(match[2], owner));

  match = input.match(new RegExp(
    `^${code} with a grade of ${quote}C${quote} or better\\.$`, 'i',
  ));
  if (match) return graded(match[1]);

  if (/^SCIS major with sophomore standing\.$/i.test(input)) {
    return joinTokenLists(
      oneNonCourseToken(
        'major_in_school_of_computing_and_information_sciences',
        'SCIS major',
        {
          required_major: 'School of Computing and Information Sciences',
          source_abbreviation: 'SCIS',
        },
      ),
      'and',
      oneNonCourseToken('sophomore_standing_or_higher', 'sophomore standing', {
        minimum_class_standing: 'sophomore',
      }),
    );
  }

  match = input.match(/^(Sophomore|Junior|Senior) Standing\.$/i);
  if (match) {
    const standing = match[1].toLowerCase();
    return oneNonCourseToken(`${standing}_standing_or_higher`, match[0].slice(0, -1), {
      minimum_class_standing: standing,
    });
  }

  match = input.match(new RegExp(
    `^Either 1\\) a C or better in ${code}, or 2\\) a passing grade on a placement test approved by the Department of Mathematics and Statistics\\.$`,
    'i',
  ));
  if (match) {
    return joinTokenLists(
      graded(match[1]),
      'or',
      oneNonCourseToken(
        'passing_result_on_department_approved_mathematics_placement_test',
        'a passing grade on a placement test approved by the Department of Mathematics and Statistics',
        {
          assessment_kind: 'placement_test',
          passing_result_required: true,
          approval_authority: 'Department of Mathematics and Statistics',
        },
      ),
    );
  }

  match = input.match(new RegExp(
    `^A grade of C or better in ${code} or permission of the Department of Mathematics and Statistics\\.$`,
    'i',
  ));
  if (match) {
    return joinTokenLists(
      graded(match[1]),
      'or',
      oneNonCourseToken(
        'permission_of_department_of_mathematics_and_statistics',
        'permission of the Department of Mathematics and Statistics',
        {
          authorization_kind: 'permission',
          authorization_authority: 'Department of Mathematics and Statistics',
        },
      ),
    );
  }

  const complex = input.match(new RegExp(
    `^A ${quote}C${quote} or better in ${code} or ${code}; or credit for ${code}, ${code}, OR ${code}\\. and one of the following\\. 1\\. A ${quote}C${quote} or better in ${code}\\. 2\\. A passing score on a placement exam approved by the School of Computing and Information Sciences\\. 3\\. A ${quote}C${quote} or better in one of the following courses\\s*\\(${code}, ${code}, ${code}, or ${code}\\)\\.$`,
    'i',
  ));
  if (complex) {
    const firstChoice = combineTokenLists([
      graded(complex[1]), graded(complex[2]),
      credit(complex[3]), credit(complex[4]), credit(complex[5]),
    ], 'or');
    const placement = oneNonCourseToken(
      'passing_score_on_school_approved_placement_exam',
      'A passing score on a placement exam approved by the School of Computing and Information Sciences',
      {
        assessment_kind: 'placement_exam',
        passing_score_required: true,
        approval_authority: 'School of Computing and Information Sciences',
      },
    );
    const secondChoice = combineTokenLists([
      graded(complex[6]), placement,
      graded(complex[7]), graded(complex[8]), graded(complex[9]), graded(complex[10]),
    ], 'or');
    return [
      ...parenthesized(firstChoice),
      { type: 'and' },
      ...parenthesized(secondChoice),
    ];
  }

  if (new RegExp(
    `^${code}\\s*\\(Grade of ${quote}C${quote} or better\\) and ${code}, ${code}, or ${code}\\.$`,
    'i',
  ).test(input)) {
    throw new Error('Radford formula has an ungrouped AND followed by a comma/OR list');
  }
  if (/^A grade of C or better in MATH 138 or another approved college-level precalculus course including some trigonometry OR a passing score on a placement exam approved by the Department of Mathematics and Statistics\.$/i.test(input)) {
    throw new Error('Radford MATH 171 does not state whether the C-or-better grade applies to the open approved-course alternative');
  }

  const plain = input.replace(/[.]$/, '').trim();
  if (/\band\b/i.test(plain) && /\bor\b/i.test(plain) && !/[()]/.test(plain)) {
    throw new Error('Radford formula has mixed ungrouped AND/OR');
  }
  try {
    return tokenizeCourseOnly(plain, owner);
  } catch {
    throw new Error('clause is outside the exact Radford Acalog formula grammar');
  }
}

function tokenizeExplicitChoiceFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  let match;

  match = input.match(new RegExp(`^(${STRICT_CODE}) and either (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'and',
      joinTokenLists(oneCourseToken(match[2], owner), 'or', oneCourseToken(match[3], owner)),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) and one of (.+)$`, 'i'));
  if (match) {
    const choice = match[2];
    if (!new RegExp(`^${STRICT_CODE}(?:\\s*,\\s*${STRICT_CODE})*(?:\\s*,?\\s*or\\s+${STRICT_CODE})$`, 'i').test(choice)) {
      throw new Error('one-of choice contains non-course or unscoped text');
    }
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'and',
      tokenizeCourseOnly(normalizeFlatList(choice, 'or'), owner),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}),? (?:a )?grade of ([A-F]) or better in (${STRICT_CODE}),? and either (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    let tokens = oneCourseToken(match[1], owner);
    tokens = joinTokenLists(tokens, 'and', oneCourseToken(match[3], owner, { minimum_grade: match[2].toUpperCase() }));
    return joinTokenLists(
      tokens,
      'and',
      joinTokenLists(oneCourseToken(match[4], owner), 'or', oneCourseToken(match[5], owner)),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}),? and grade of ([A-F]) or better in (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    const alternatives = joinTokenLists(
      oneCourseToken(match[3], owner, { minimum_grade: match[2].toUpperCase() }),
      'or',
      oneCourseToken(match[4], owner, { minimum_grade: match[2].toUpperCase() }),
    );
    return joinTokenLists(oneCourseToken(match[1], owner), 'and', alternatives, { groupRight: true });
  }

  throw new Error('clause is outside the explicit either/one-of grammar');
}

function tokenizeRmcStructuredFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  if (/^Senior status and departmental approval$/i.test(input)) {
    return joinTokenLists(
      oneNonCourseToken(
        'senior_status', 'Senior status', { minimum_class_standing: 'senior' },
      ),
      'and',
      oneNonCourseToken(
        'departmental_approval', 'departmental approval',
        { authorization_kind: 'approval', authorization_authority: 'department' },
      ),
    );
  }
  const permission = input.match(new RegExp(`^(${STRICT_CODE}) or permission of (?:the )?instructor$`, 'i'));
  if (permission) {
    return joinTokenLists(
      oneCourseToken(permission[1], owner),
      'or',
      oneNonCourseToken(
        'permission_of_instructor', input.slice(input.toLowerCase().indexOf('permission')),
        { authorization_kind: 'permission', authorization_authority: 'instructor' },
      ),
    );
  }
  return tokenizeExplicitChoiceFormula(input, owner);
}

const ODU_PINNED_WHOLE_CLAUSE_FORMULAS = Object.freeze({
  BIOL123N:
    'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, or completion of MATH 102M or higher, and BIOL 121N passed with a grade of C (2.0) or higher',
  BIOL124N:
    'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, or completion of MATH 102M or higher, and BIOL 121N',
  BIOL136N_137N:
    'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, and enrollment in the Honors College',
  BIOL138N_139N:
    'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, or completion of MATH 102M or higher, enrollment in the Honors College, and BIOL 136N',
  CHEM121N: 'MATH 102M or MATH 103M or higher with a grade of C or better',
  CS250: 'CS 150 or ENGN 122 with a grade of C or better and MATH 163',
  PHYS227N:
    'PHYS 231N or PHYS 226N or PHYS 261N with a grade of C or better, and both MATH 211 and MATH 212 each with a grade of C or better',
  PHYS232N:
    'PHYS 231N or PHYS 226N or PHYS 261N with a grade of C or better, and both MATH 211 and MATH 212 with each a grade of C or better',
});
const ODU_PINNED_WHOLE_CLAUSE_VALUES = Object.freeze(
  Object.values(ODU_PINNED_WHOLE_CLAUSE_FORMULAS),
);

function oduAlternatives(codes, owner, extra = {}) {
  return combineTokenLists(codes.map((code) => oneCourseToken(code, owner, extra)), 'or');
}

function oduCompletedCourseOrHigherTokens(code, owner, extra = {}) {
  const normalized = normalizeCode(code);
  const subject = normalized?.match(/^[A-Z]+/)?.[0];
  if (!normalized || !subject) throw new Error(`invalid ODU completed-course floor: ${code}`);
  return joinTokenLists(
    oneCourseToken(code, owner, { completion_required: true, ...extra }),
    'or',
    oneNonCourseToken(
      `course_higher_than_${normalized.toLowerCase()}`,
      'higher',
      {
        subject,
        exclusive_course_floor: normalized,
        represents_course_choice: true,
        completion_required: true,
        ...extra,
      },
    ),
  );
}

function oduEnglishPlacementTokens(owner) {
  return oneNonCourseToken(
    'placement_into_engl110c', 'Placement into ENGL 110C',
    {
      placement_course_code: 'ENGL110C',
      placement_required: true,
    },
  );
}

function oduMathReadinessTokens(owner, { includeCompletedCourseFloor = false } = {}) {
  const alternatives = [
    oneNonCourseToken(
      'qualifying_math_sat_or_act_score', 'qualifying Math SAT/ACT score',
      {
        subject: 'mathematics',
        eligible_assessments: ['SAT', 'ACT'],
        qualifying_score_required: true,
      },
    ),
    oneNonCourseToken(
      'qualifying_math_placement_test_score',
      'qualifying score on the Math placement test',
      {
        subject: 'mathematics',
        placement_test: 'Math placement test',
        qualifying_score_required: true,
      },
    ),
  ];
  if (includeCompletedCourseFloor) {
    alternatives.push(oduCompletedCourseOrHigherTokens('MATH 102M', owner));
  }
  return combineTokenLists(alternatives, 'or');
}

function oduPlacementAndMathReadinessTokens(owner, options = {}) {
  return joinTokenLists(
    oduEnglishPlacementTokens(owner),
    'and',
    oduMathReadinessTokens(owner, options),
    { groupRight: true },
  );
}

function tokenizeOduStructuredFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  let match;

  // These are exact, retained ODU clauses whose comma-delimited choice groups
  // and trailing grade phrases need the institution's own catalog grammar.
  // Keeping a closed full-clause roster prevents a similar-looking mutation
  // from inheriting a topology or grade scope that the source did not prove.
  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.BIOL123N
      || input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.BIOL124N) {
    let tokens = oduPlacementAndMathReadinessTokens(owner, {
      includeCompletedCourseFloor: true,
    });
    tokens = joinTokenLists(
      tokens,
      'and',
      oneCourseToken('BIOL 121N', owner, input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.BIOL123N
        ? {
          minimum_grade: 'C',
          minimum_grade_points: 2,
          catalog_grade_scope: 'atom_local_passed_with_grade_phrase',
        }
        : {}),
    );
    return tokens;
  }

  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.BIOL136N_137N) {
    return joinTokenLists(
      oduPlacementAndMathReadinessTokens(owner),
      'and',
      oneNonCourseToken(
        'enrollment_in_honors_college', 'enrollment in the Honors College',
        { enrollment_restriction: 'college', required_college: 'Honors College' },
      ),
    );
  }

  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.BIOL138N_139N) {
    let tokens = oduPlacementAndMathReadinessTokens(owner, {
      includeCompletedCourseFloor: true,
    });
    tokens = joinTokenLists(
      tokens,
      'and',
      oneNonCourseToken(
        'enrollment_in_honors_college', 'enrollment in the Honors College',
        { enrollment_restriction: 'college', required_college: 'Honors College' },
      ),
    );
    return joinTokenLists(tokens, 'and', oneCourseToken('BIOL 136N', owner));
  }

  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.CHEM121N) {
    const gradeScope = 'shared_trailing_grade_phrase_over_pinned_odu_math_roster';
    return combineTokenLists([
      oneCourseToken('MATH 102M', owner, {
        minimum_grade: 'C', catalog_grade_scope: gradeScope,
      }),
      oneCourseToken('MATH 103M', owner, {
        minimum_grade: 'C', catalog_grade_scope: gradeScope,
      }),
      oneNonCourseToken(
        'course_higher_than_math103m', 'higher',
        {
          subject: 'MATH',
          exclusive_course_floor: 'MATH103M',
          represents_course_choice: true,
          minimum_grade: 'C',
          catalog_grade_scope: gradeScope,
        },
      ),
    ], 'or');
  }

  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.CS250) {
    const programming = oduAlternatives(
      ['CS 150', 'ENGN 122'], owner,
      {
        minimum_grade: 'C',
        catalog_grade_scope: 'shared_trailing_grade_phrase_over_pinned_odu_alternatives',
      },
    );
    return joinTokenLists(parenthesized(programming), 'and', oneCourseToken('MATH 163', owner));
  }

  if (input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.PHYS227N
      || input === ODU_PINNED_WHOLE_CLAUSE_FORMULAS.PHYS232N) {
    const physics = oduAlternatives(
      ['PHYS 231N', 'PHYS 226N', 'PHYS 261N'], owner,
      {
        minimum_grade: 'C',
        catalog_grade_scope: 'shared_trailing_grade_phrase_over_pinned_odu_alternatives',
      },
    );
    const math = combineTokenLists([
      oneCourseToken('MATH 211', owner, {
        minimum_grade: 'C',
        catalog_grade_scope: 'explicit_both_each_grade_phrase',
      }),
      oneCourseToken('MATH 212', owner, {
        minimum_grade: 'C',
        catalog_grade_scope: 'explicit_both_each_grade_phrase',
      }),
    ], 'and');
    return joinTokenLists(parenthesized(physics), 'and', parenthesized(math));
  }

  if (/^knowledge of basic algebra$/i.test(input)) {
    return oneNonCourseToken(
      'knowledge_of_basic_algebra', input,
      { subject: 'basic algebra', knowledge_required: true },
    );
  }

  if (/^A prior programming course$/i.test(input)) {
    return oneNonCourseToken(
      'prior_programming_course', input,
      { course_category: 'programming', prior_course_required: true },
    );
  }

  if (/^MATH 162M and familiarity with computer security area$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('MATH 162M', owner),
      'and',
      oneNonCourseToken(
        'familiarity_with_computer_security_area',
        'familiarity with computer security area',
        { subject: 'computer security', familiarity_required: true },
      ),
    );
  }

  if (/^CS 462 or CS 455 or experience in cybersecurity$/i.test(input)) {
    return combineTokenLists([
      oneCourseToken('CS 462', owner),
      oneCourseToken('CS 455', owner),
      oneNonCourseToken(
        'experience_in_cybersecurity', 'experience in cybersecurity',
        { subject: 'cybersecurity', experience_required: true },
      ),
    ], 'or');
  }

  if (/^MATH 316; knowledge of a high level language$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('MATH 316', owner),
      'and',
      oneNonCourseToken(
        'knowledge_of_a_high_level_language',
        'knowledge of a high level language',
        { subject: 'high level programming language', knowledge_required: true },
      ),
    );
  }

  // Two independently grade-scoped conjuncts. The repeated "a grade ... in"
  // phrase is the boundary: the first grade applies to its explicit OR list,
  // and the second grade applies to the final course. Do not generalize this
  // to trailing-grade lists, where the catalog leaves modifier scope open.
  match = input.match(new RegExp(
    `^A grade of ([A-F]) or better in ((?:${STRICT_CODE})(?: or ${STRICT_CODE})+) and a grade of ([A-F]) or better in (${STRICT_CODE})$`,
    'i',
  ));
  if (match) {
    return joinTokenLists(
      parenthesized(withMinimumGrade(tokenizeCourseOnly(match[2], owner), match[1])),
      'and',
      oneCourseToken(match[4], owner, { minimum_grade: match[3].toUpperCase() }),
    );
  }

  match = input.match(new RegExp(`^Writing Success Placement Tool \\(WSPT\\) Score of (\\d+) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    const score = Number(match[1]);
    return joinTokenLists(
      oneNonCourseToken(
        'writing_success_placement_tool_minimum_score',
        `Writing Success Placement Tool (WSPT) Score of ${match[1]}`,
        {
          placement_test: 'Writing Success Placement Tool (WSPT)',
          minimum_score: score,
        },
      ),
      'or',
      oneCourseToken(match[2], owner),
    );
  }

  match = input.match(new RegExp(`^Placement into (${STRICT_CODE})$`, 'i'));
  if (match) {
    const placementCode = normalizeCode(match[1]);
    return oneNonCourseToken(
      `placement_into_${placementCode.toLowerCase()}`,
      input,
      { placement_course_code: placementCode },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) and (${STRICT_CODE} or higher)$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'and',
      courseOrHigherTokens(match[2], owner),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) or (${STRICT_CODE}) or higher$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'or',
      courseOrHigherTokens(`${match[2]} or higher`, owner),
    );
  }

  if (/^SAT score of 540 or above, or ACT score of 22 or above, or qualifying score on the ALEKS placement exam$/i.test(input)) {
    return combineTokenLists([
      oneNonCourseToken(
        'sat_minimum_score_540', 'SAT score of 540 or above',
        { assessment: 'SAT', minimum_score: 540 },
      ),
      oneNonCourseToken(
        'act_minimum_score_22', 'ACT score of 22 or above',
        { assessment: 'ACT', minimum_score: 22 },
      ),
      oneNonCourseToken(
        'qualifying_aleks_placement_exam_score',
        'qualifying score on the ALEKS placement exam',
        { placement_test: 'ALEKS placement exam', qualifying_score_required: true },
      ),
    ], 'or');
  }

  if (/^High school GPA of 3\.4 or above, or qualifying score on the ALEKS placement exam, or MATH 100$/i.test(input)) {
    return combineTokenLists([
      oneNonCourseToken(
        'high_school_minimum_gpa_3_4', 'High school GPA of 3.4 or above',
        { minimum_high_school_gpa: 3.4 },
      ),
      oneNonCourseToken(
        'qualifying_aleks_placement_exam_score',
        'qualifying score on the ALEKS placement exam',
        { placement_test: 'ALEKS placement exam', qualifying_score_required: true },
      ),
      oneCourseToken('MATH 100', owner),
    ], 'or');
  }

  if (/^qualifying score on SAT or ACT, or qualifying score on a placement test administered by the University Testing Center or a grade of C or better in MATH 102M or MATH 103M$/i.test(input)) {
    return combineTokenLists([
      oneNonCourseToken(
        'qualifying_score_on_sat_or_act', 'qualifying score on SAT or ACT',
        { eligible_assessments: ['SAT', 'ACT'], qualifying_score_required: true },
      ),
      oneNonCourseToken(
        'qualifying_university_testing_center_placement_test_score',
        'qualifying score on a placement test administered by the University Testing Center',
        {
          placement_test: 'placement test',
          administering_authority: 'University Testing Center',
          qualifying_score_required: true,
        },
      ),
      oneCourseToken('MATH 102M', owner, { minimum_grade: 'C' }),
      oneCourseToken('MATH 103M', owner, { minimum_grade: 'C' }),
    ], 'or');
  }

  match = input.match(/^Junior\/senior standing as a computer science major; and a grade of ([A-F]) or better in any of:\s*(.+)$/i);
  if (match) {
    const choices = match[2];
    if (/\band\b|\bor\b|[;]/i.test(choices)) {
      throw new Error('ODU any-of standing formula has unexpected Boolean prose');
    }
    return joinTokenLists(
      oneNonCourseToken(
        'junior_or_senior_standing_as_computer_science_major',
        'Junior/senior standing as a computer science major',
        {
          minimum_class_standing: 'junior',
          required_major: 'computer science',
        },
      ),
      'and',
      withMinimumGrade(
        tokenizeCourseOnly(normalizeFlatList(choices, 'or'), owner),
        match[1],
      ),
      { groupRight: true },
    );
  }

  if (/^Approval by department is required$/i.test(input)) {
    return oneNonCourseToken(
      'department_approval_required', input,
      { authorization_kind: 'approval', authorization_authority: 'department' },
    );
  }

  if (/^Instructor permission required$/i.test(input)) {
    return oneNonCourseToken(
      'instructor_permission_required', input,
      { authorization_kind: 'permission', authorization_authority: 'instructor' },
    );
  }

  if (/^A passing grade on the Writing Success Placement Tool \(WSPT\)$/i.test(input)) {
    return oneNonCourseToken(
      'passing_writing_success_placement_tool_grade', input,
      { placement_test: 'Writing Success Placement Tool (WSPT)', passing_grade_required: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) or permission of (?:the )?instructor$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'or',
      oneNonCourseToken(
        'permission_of_instructor', input.slice(input.toLowerCase().indexOf('permission')),
        { authorization_kind: 'permission', authorization_authority: 'instructor' },
      ),
    );
  }

  // One or more ungraded conjuncts followed by an explicitly grade-scoped
  // alternative set. The words "any [one] of" and the final OR make the
  // choice topology and grade scope explicit.
  match = input.match(/^(.*?)(?:,)?\s+and\s+(?:a\s+)?(?:(?:grade of\s+)?([A-F])|([A-F]))\s+or better in\s+(?:any(?:\s+one)?\s+of:\s*)?(.+)$/i);
  if (match) {
    const prefix = match[1].trim().replace(/,\s*$/, '');
    const choices = match[4].trim();
    if (!/\bor\b/i.test(prefix) && !/\band\b/i.test(choices) && !/[;]/.test(`${prefix}${choices}`)) {
      const left = tokenizeCourseOnly(normalizeFlatList(prefix, 'and'), owner);
      const right = withMinimumGrade(
        tokenizeCourseOnly(normalizeFlatList(choices, 'or'), owner),
        match[2] || match[3],
      );
      return joinTokenLists(left, 'and', right, { groupRight: true });
    }
  }

  match = input.match(new RegExp(`^A grade of ([A-F]) or better in (${STRICT_CODE}) and in any one of: (.+)$`, 'i'));
  if (match) {
    const choices = match[3];
    if (/\band\b/i.test(choices)) throw new Error('graded any-one-of list contains AND');
    return joinTokenLists(
      oneCourseToken(match[2], owner, { minimum_grade: match[1].toUpperCase() }),
      'and',
      withMinimumGrade(tokenizeCourseOnly(normalizeFlatList(choices, 'or'), owner), match[1]),
      { groupRight: true },
    );
  }

  match = input.match(/^(.+) with grades? of ([A-F]) or better$/i);
  if (match && !/\bor\b/i.test(match[1])) {
    return withMinimumGrade(
      tokenizeCourseOnly(normalizeFlatList(match[1], 'and'), owner),
      match[2],
    );
  }

  match = input.match(new RegExp(`^A ([A-F]) or better in (${STRICT_CODE})$`, 'i'));
  if (match) return oneCourseToken(match[2], owner, { minimum_grade: match[1].toUpperCase() });

  match = input.match(new RegExp(`^(${STRICT_CODE}) and a grade of ([A-F]) or better in (${STRICT_CODE}) and either (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    let tokens = joinTokenLists(
      oneCourseToken(match[1], owner),
      'and',
      oneCourseToken(match[3], owner, { minimum_grade: match[2].toUpperCase() }),
    );
    return joinTokenLists(
      tokens,
      'and',
      joinTokenLists(oneCourseToken(match[4], owner), 'or', oneCourseToken(match[5], owner)),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^A grade of ([A-F]) or better in (${STRICT_CODE}) and either (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[2], owner, { minimum_grade: match[1].toUpperCase() }),
      'and',
      joinTokenLists(oneCourseToken(match[3], owner), 'or', oneCourseToken(match[4], owner)),
      { groupRight: true },
    );
  }

  if (/^PHYS 111N and MATH 102M \(or MATH 103M\) or MATH 162M or MATH 166$/i.test(input)) {
    return tokenizeCourseOnly('PHYS 111N and (MATH 102M or MATH 103M) or MATH 162M or MATH 166', owner);
  }

  match = input.match(new RegExp(`^A grade of ([A-F]) or better in (.+); (${STRICT_CODE}) or (${STRICT_CODE}); (${STRICT_CODE}); and (${STRICT_CODE})$`, 'i'));
  if (match && !/\band\b/i.test(match[2])) {
    let tokens = parenthesized(withMinimumGrade(
      tokenizeCourseOnly(normalizeFlatList(match[2], 'or'), owner),
      match[1],
    ));
    tokens = joinTokenLists(tokens, 'and', joinTokenLists(
      oneCourseToken(match[3], owner), 'or', oneCourseToken(match[4], owner),
    ), { groupRight: true });
    tokens = joinTokenLists(tokens, 'and', oneCourseToken(match[5], owner));
    return joinTokenLists(tokens, 'and', oneCourseToken(match[6], owner));
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) or (${STRICT_CODE}) or a grade of ([A-F]) or better in (${STRICT_CODE}) and (${STRICT_CODE}); a grade of ([A-F]) or better in (${STRICT_CODE}) or (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    const gradedPair = joinTokenLists(
      oneCourseToken(match[4], owner, { minimum_grade: match[3].toUpperCase() }),
      'and',
      oneCourseToken(match[5], owner, { minimum_grade: match[3].toUpperCase() }),
    );
    let left = joinTokenLists(oneCourseToken(match[1], owner), 'or', oneCourseToken(match[2], owner));
    left = joinTokenLists(left, 'or', gradedPair, { groupRight: true });
    let right = joinTokenLists(
      oneCourseToken(match[7], owner, { minimum_grade: match[6].toUpperCase() }),
      'or',
      oneCourseToken(match[8], owner, { minimum_grade: match[6].toUpperCase() }),
    );
    right = joinTokenLists(
      right,
      'or',
      oneCourseToken(match[9], owner, { minimum_grade: match[6].toUpperCase() }),
    );
    return joinTokenLists(parenthesized(left), 'and', parenthesized(right));
  }

  return tokenizeExplicitChoiceFormula(input, owner);
}

const TITLE_CONDITION_WORDS = /\b(?:grade|better|higher|permission|consent|equivalent|status|standing|major|minor|enrollment|score|placement|approval|recommended|required|prerequisite|corequisite|semester hours?|taken in conjunction|laboratory experiments?|lecture course)\b/i;

/**
 * VSU publishes a code, then its catalog title, then an explicit connector and
 * the next code. Titles are retained on their atoms but may be ignored for
 * topology only when they contain no condition language. Mixed AND/OR remains
 * rejected unless another grammar supplies explicit grouping.
 */
function tokenizeVsuTitledFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  const codePattern = /(?:^|(?<=[\s,;()]))([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)(?![A-Z0-9])/gi;
  const matches = [...input.matchAll(codePattern)];
  if (!matches.length || matches[0].index !== 0) throw new Error('VSU titled formula does not begin with a course code');
  const atoms = [];
  const operators = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const codeText = match[0].trim();
    const segmentStart = match.index + match[0].length;
    const segmentEnd = matches[index + 1]?.index ?? input.length;
    let between = input.slice(segmentStart, segmentEnd).trim();
    let operator = null;
    if (index < matches.length - 1) {
      const word = between.match(/(?:,|;)?\s*\b(and|or)\s*$/i);
      if (word) {
        operator = word[1].toLowerCase();
        between = between.slice(0, word.index).trim();
      } else if (/[,;]\s*$/.test(between)) {
        operator = 'and';
        between = between.replace(/[,;]\s*$/, '').trim();
      } else {
        throw new Error('VSU title has no explicit connector before the next code');
      }
      operators.push(operator);
    }
    const title = between.replace(/^[:,]\s*/, '').replace(/[,;]\s*$/, '').trim();
    if (TITLE_CONDITION_WORDS.test(title)) throw new Error(`VSU title contains condition language: ${title}`);
    if (title && !/^[\p{L}\p{N}\s&/'():.,-]+$/u.test(title)) throw new Error('VSU title contains unsupported characters');
    atoms.push(oneCourseToken(codeText, owner, {
      ...(title ? { catalog_title_text: title } : {}),
    }));
  }
  if (new Set(operators).size > 1) throw new Error('VSU titled formula has mixed ungrouped AND/OR');
  let tokens = atoms[0];
  for (let index = 0; index < operators.length; index += 1) {
    tokens = joinTokenLists(tokens, operators[index], atoms[index + 1]);
  }
  return tokens;
}

function vsuCourseWithTitle(raw, owner, extra = {}) {
  const input = String(raw || '').trim();
  const match = input.match(new RegExp(`^(${STRICT_CODE})(?:\\s+(.+))?$`, 'i'));
  if (!match) throw new Error(`VSU course/title atom is malformed: ${raw}`);
  const title = String(match[2] || '').trim();
  if (TITLE_CONDITION_WORDS.test(title)) {
    throw new Error(`VSU title contains condition language: ${title}`);
  }
  if (title && !/^[\p{L}\p{N}\s&/'():.,-]+$/u.test(title)) {
    throw new Error('VSU title contains unsupported characters');
  }
  return oneCourseToken(match[1], owner, {
    ...(title ? { catalog_title_text: title } : {}),
    ...extra,
  });
}

function authorizationToken(kind, authority, raw) {
  return oneNonCourseToken(
    `${kind}_of_${authority.replace(/\s+/g, '_')}`,
    raw,
    { authorization_kind: kind, authorization_authority: authority },
  );
}

function tokenizeVsuStructuredFormula(raw, owner) {
  const input = String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.]\s*$/, '');
  let match;

  if (input === 'MATH 120 with a C or better or higher placement or CHEM 105 with a C or better') {
    return combineTokenLists([
      oneCourseToken('MATH 120', owner, {
        minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_with_c_or_better',
      }),
      oneNonCourseToken(
        'higher_placement_than_math_120', 'higher placement', {
          placement_floor_course_code: 'MATH120',
          placement_relation: 'higher_than',
        },
      ),
      oneCourseToken('CHEM 105', owner, {
        minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_with_c_or_better',
      }),
    ], 'or');
  }

  if (input === 'Chemistry Majors or Permission from the Department Chair') {
    return joinTokenLists(
      oneNonCourseToken(
        'chemistry_major', 'Chemistry Majors', {
          required_major: 'Chemistry',
        },
      ),
      'or',
      authorizationToken(
        'permission', 'department chair', 'Permission from the Department Chair',
      ),
    );
  }

  if (input === 'CHEM 161 Chemistry I with a C or better') {
    return oneCourseToken('CHEM 161', owner, {
      catalog_title_text: 'Chemistry I',
      minimum_grade: 'C',
      catalog_grade_scope: 'atom_local_with_c_or_better',
    });
  }

  const honorsCompositionEligibility = (chairSpelling = 'department') => {
    const honorsRaw = 'Enrollment is limited to students who are in the University Honors program.';
    const additionalRaw = `Additional enrollment can result from limited recommendations from English faculty, if approved by Languages and Literature ${chairSpelling} chairman, and if space is available`;
    return joinTokenLists(
      oneNonCourseToken(
        'enrollment_in_university_honors_program', honorsRaw,
        { required_program: 'University Honors program' },
      ),
      'or',
      oneNonCourseToken(
        'english_faculty_recommendation_with_department_chair_approval_and_space_available',
        additionalRaw,
        {
          recommendation_authority: 'English faculty',
          approval_authority: 'Languages and Literature department chairman',
          available_space_required: true,
        },
      ),
    );
  };

  if (input === 'Enrollment is limited to students who are in the University Honors program. Additional enrollment can result from limited recommendations from English faculty, if approved by Languages and Literature department chairman, and if space is available') {
    return honorsCompositionEligibility();
  }

  if (input === 'ENGL 112 Enrollment is limited to students who are in the University Honors program. Additional enrollment can result from limited recommendations from English faculty, if approved by Languages and Literature departmemt chairman, and if space is available') {
    return joinTokenLists(
      oneCourseToken('ENGL 112', owner),
      'and',
      parenthesized(honorsCompositionEligibility('departmemt')),
    );
  }

  if (/^MATH 360, STAT 330 or STAT 340$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('MATH 360', owner),
      'and',
      joinTokenLists(oneCourseToken('STAT 330', owner), 'or', oneCourseToken('STAT 340', owner)),
      { groupRight: true },
    );
  }

  if (/^MATH 260 Calculus I, BIOL 120 Principles of Biology I and BIOL 121 Principles of Biology II, or consent of instructor$/i.test(input)) {
    const courseRoute = combineTokenLists([
      vsuCourseWithTitle('MATH 260 Calculus I', owner),
      vsuCourseWithTitle('BIOL 120 Principles of Biology I', owner),
      vsuCourseWithTitle('BIOL 121 Principles of Biology II', owner),
    ], 'and');
    return joinTokenLists(
      parenthesized(courseRoute),
      'or',
      authorizationToken('consent', 'instructor', 'consent of instructor'),
    );
  }

  if (/^Major\/Minor in Computer Science$/i.test(input)) {
    return oneNonCourseToken(
      'computer_science_major_or_minor', input,
      { eligible_academic_program_roles: ['major', 'minor'], academic_program: 'computer science' },
    );
  }

  match = input.match(/^(Permission of Department Chair|Consent of instructor)$/i);
  if (match) {
    const permission = /^Permission/i.test(match[1]);
    return authorizationToken(
      permission ? 'permission' : 'consent',
      permission ? 'department chair' : 'instructor',
      match[1],
    );
  }

  match = input.match(/^Senior status or permission of instructor$/i);
  if (match) {
    return joinTokenLists(
      oneNonCourseToken(
        'senior_status', 'Senior status', { minimum_class_standing: 'senior' },
      ),
      'or',
      authorizationToken('permission', 'instructor', 'permission of instructor'),
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE})(?:\\s+(.+?))? or (?:its )?equivalent$`, 'i'));
  if (match) {
    const code = normalizeCode(match[1]);
    return joinTokenLists(
      vsuCourseWithTitle([match[1], match[2]].filter(Boolean).join(' '), owner),
      'or',
      oneNonCourseToken(
        `equivalent_to_${code.toLowerCase()}`, input.slice(input.toLowerCase().lastIndexOf('or ') + 3),
        { equivalent_to_course_code: code },
      ),
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE})(?:\\s+(.+?))? or (Permission|permission) of (?:the )?instructor$`, 'i'));
  if (match && !/,\s*and\s+Junior status/i.test(input)) {
    return joinTokenLists(
      vsuCourseWithTitle([match[1], match[2]].filter(Boolean).join(' '), owner),
      'or',
      authorizationToken(
        'permission', 'instructor',
        input.slice(input.toLowerCase().lastIndexOf('permission')),
      ),
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE})\\s+(.+?) or (${STRICT_CODE})\\s+(.+?), and Junior status or permission of Instructor$`, 'i'));
  if (match) {
    const courses = joinTokenLists(
      vsuCourseWithTitle(`${match[1]} ${match[2]}`, owner),
      'or',
      vsuCourseWithTitle(`${match[3]} ${match[4]}`, owner),
    );
    const authorization = joinTokenLists(
      oneNonCourseToken(
        'junior_status', 'Junior status', { minimum_class_standing: 'junior' },
      ),
      'or',
      authorizationToken('permission', 'instructor', 'permission of Instructor'),
    );
    return joinTokenLists(parenthesized(courses), 'and', parenthesized(authorization));
  }

  match = input.match(new RegExp(`^(${STRICT_CODE})\\s+(.+?) (\\d+) semester hours$`, 'i'));
  if (match) {
    const hours = Number(match[3]);
    return vsuCourseWithTitle(`${match[1]} ${match[2]}`, owner, {
      referenced_course_published_semester_hours: hours,
    });
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}); (${STRICT_CODE}) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner),
      'and',
      joinTokenLists(oneCourseToken(match[2], owner), 'or', oneCourseToken(match[3], owner)),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^[“"]C[”"] or better in (${STRICT_CODE}) and in (${STRICT_CODE})$`, 'i'));
  if (match) {
    return joinTokenLists(
      oneCourseToken(match[1], owner, { minimum_grade: 'C' }),
      'and',
      oneCourseToken(match[2], owner, { minimum_grade: 'C' }),
    );
  }

  return tokenizeVsuTitledFormula(input, owner);
}

function tokenizeVcuStructuredFormula(raw, owner) {
  const input = String(raw || '').trim().replace(/[.]\s*$/, '').trim();
  const courseAlternatives = (codes, extra = {}) => combineTokenLists(
    codes.map((code) => oneCourseToken(code, owner, extra)), 'or',
  );
  const sharedGradedAlternatives = (codes, grade = 'C') => courseAlternatives(codes, {
    minimum_grade: grade,
    catalog_grade_scope: 'explicit_either_or_each_shared_minimum_grade_phrase',
  });
  const atomLocalTrailingGradeAlternatives = (codes, grade = 'C') => combineTokenLists(
    codes.map((code, index) => oneCourseToken(code, owner, index === codes.length - 1 ? {
      minimum_grade: grade,
      catalog_grade_scope: 'atom_local_trailing_minimum_grade_phrase',
    } : {})),
    'or',
  );
  const groupedConjunction = (left, right) => joinTokenLists(
    parenthesized(left), 'and', parenthesized(right),
  );
  const placement = (condition, rawText, extra = {}) => oneNonCourseToken(
    condition, rawText, { evidence_kind: 'placement_assessment', ...extra },
  );
  let match;

  // These are the finite, retained 2026-2027 VCU phrasings whose commas,
  // repeated grade phrases, "either", or "each" make their grouping explicit.
  // Keep the whole-clause matches closed: a wording or punctuation change must
  // return to review instead of being flattened by the generic Boolean parser.
  if (/^BNFO 201, CLSE 115, CMSC 210, CMSC 254, EGRB 215 or INFO 202 with a minimum grade of C$/i.test(input)) {
    return atomLocalTrailingGradeAlternatives([
      'BNFO 201', 'CLSE 115', 'CMSC 210', 'CMSC 254', 'EGRB 215', 'INFO 202',
    ]);
  }

  if (/^CMSC 255 or EGRE 246 with a minimum grade of C, and either MATH 151, MATH 200 or MATH 201, with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course$/i.test(input)) {
    const programming = atomLocalTrailingGradeAlternatives(['CMSC 255', 'EGRE 246']);
    const calculus = combineTokenLists([
      sharedGradedAlternatives(['MATH 151', 'MATH 200', 'MATH 201']),
      placement(
        'recent_calculus_level_vcu_mathematics_placement',
        'calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          minimum_placement_level: 'calculus',
          maximum_age_years: 1,
          recency_measured_before: 'enrollment in the course',
        },
      ),
    ], 'or');
    return groupedConjunction(programming, calculus);
  }

  if (/^CMSC 255, EGRE 246, or ENGR 261 with a minimum grade of C, and either MATH 151, MATH 200, or MATH 201, each with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course$/i.test(input)) {
    const programming = atomLocalTrailingGradeAlternatives([
      'CMSC 255', 'EGRE 246', 'ENGR 261',
    ]);
    const calculus = combineTokenLists([
      sharedGradedAlternatives(['MATH 151', 'MATH 200', 'MATH 201']),
      placement(
        'recent_calculus_level_vcu_mathematics_placement',
        'calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          minimum_placement_level: 'calculus',
          maximum_age_years: 1,
          recency_measured_before: 'enrollment in the course',
        },
      ),
    ], 'or');
    return groupedConjunction(programming, calculus);
  }

  if (/^CMSC 302 or the equivalent with a grade of C or better$/i.test(input)) {
    return joinTokenLists(
      oneCourseToken('CMSC 302', owner),
      'or',
      oneNonCourseToken(
        'equivalent_to_cmsc_302', 'the equivalent',
        {
          equivalent_to_course_code: 'CMSC302',
          minimum_grade: 'C',
          catalog_grade_scope: 'atom_local_trailing_minimum_grade_phrase',
        },
      ),
    );
  }

  if (/^CMSC 311 and CMSC 357 or EGRE 364 and EGRE 347, each with a minimum grade of C$/i.test(input)) {
    const route = (codes) => combineTokenLists(
      codes.map((code) => oneCourseToken(code, owner, {
        minimum_grade: 'C',
        catalog_grade_scope: 'explicit_each_over_complete_or_of_and_formula',
      })),
      'and',
    );
    return joinTokenLists(
      parenthesized(route(['CMSC 311', 'CMSC 357'])),
      'or',
      parenthesized(route(['EGRE 364', 'EGRE 347'])),
    );
  }

  if (/^CMSC 210 or CMSC 254 with a minimum grade of C and MATH 310 or MATH 370 with a minimum grade of C$/i.test(input)) {
    return groupedConjunction(
      atomLocalTrailingGradeAlternatives(['CMSC 210', 'CMSC 254']),
      atomLocalTrailingGradeAlternatives(['MATH 310', 'MATH 370']),
    );
  }

  if (/^CMSC 357 with a minimum grade of C or by permission of the instructor and MATH 310 or MATH 370 with a minimum grade of C$/i.test(input)) {
    const algorithmOrPermission = joinTokenLists(
      oneCourseToken('CMSC 357', owner, { minimum_grade: 'C' }),
      'or',
      oneNonCourseToken(
        'permission_of_instructor', 'by permission of the instructor',
        { authorization_kind: 'permission', authorization_authority: 'instructor' },
      ),
    );
    return groupedConjunction(
      algorithmOrPermission,
      atomLocalTrailingGradeAlternatives(['MATH 310', 'MATH 370']),
    );
  }

  if (/^UNIV 111 or HONR 250 with a minimum grade of C$/i.test(input)) {
    return atomLocalTrailingGradeAlternatives(['UNIV 111', 'HONR 250']);
  }

  if (/^MATH 139 or MATH 141 with a minimum grade of C, or satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course$/i.test(input)) {
    return combineTokenLists([
      atomLocalTrailingGradeAlternatives(['MATH 139', 'MATH 141']),
      placement(
        'recent_satisfactory_vcu_mathematics_placement_test_score',
        'satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          satisfactory_score_required: true,
          maximum_age_years: 1,
          recency_measured_before: 'the beginning of the course',
        },
      ),
    ], 'or');
  }

  if (/^MATH 139, MATH 141, MATH 151, MATH 200 or MATH 201 with a minimum grade of C or a score on the VCU Mathematics Placement Test sufficiently high to place into MATH 151 or higher$/i.test(input)) {
    return combineTokenLists([
      atomLocalTrailingGradeAlternatives([
        'MATH 139', 'MATH 141', 'MATH 151', 'MATH 200', 'MATH 201',
      ]),
      placement(
        'vcu_mathematics_placement_into_math_151_or_higher',
        'a score on the VCU Mathematics Placement Test sufficiently high to place into MATH 151 or higher',
        {
          placement_test: 'VCU Mathematics Placement Test',
          placement_course_code: 'MATH151',
          inclusive_course_floor: 'MATH151',
          represents_course_choice: true,
        },
      ),
    ], 'or');
  }

  if (/^MATH 139 or MATH 141 or a math placement test into MATH 151$/i.test(input)) {
    return combineTokenLists([
      oneCourseToken('MATH 139', owner),
      oneCourseToken('MATH 141', owner),
      placement(
        'math_placement_test_into_math_151', 'a math placement test into MATH 151',
        { placement_test: 'math placement test', placement_course_code: 'MATH151' },
      ),
    ], 'or');
  }

  match = input.match(/^MATH 129 with a minimum grade of ([A-F]) or placement through the VCU Math Placement Test within the one-year period immediately preceding the beginning of the course$/i);
  if (match) {
    return joinTokenLists(
      oneCourseToken('MATH 129', owner, { minimum_grade: match[1].toUpperCase() }),
      'or',
      placement(
        'recent_vcu_math_placement_test_placement',
        'placement through the VCU Math Placement Test within the one-year period immediately preceding the beginning of the course',
        { placement_test: 'VCU Math Placement Test', maximum_age_years: 1 },
      ),
    );
  }

  if (/^one year of high school algebra and satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course$/i.test(input)) {
    return joinTokenLists(
      oneNonCourseToken(
        'minimum_one_year_high_school_algebra', 'one year of high school algebra',
        { minimum_high_school_algebra_years: 1 },
      ),
      'and',
      placement(
        'recent_satisfactory_vcu_mathematics_placement_test_score',
        'satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          satisfactory_score_required: true,
          maximum_age_years: 1,
        },
      ),
    );
  }

  if (/^MATH 139, MATH 141, MATH 151, MATH 200, MATH 201 or a satisfactory score on the math placement exam; and CHEM 100 with a minimum grade of B, CHEM 101 with a minimum grade of C or a satisfactory score on the chemistry placement exam$/i.test(input)) {
    const math = combineTokenLists([
      courseAlternatives(['MATH 139', 'MATH 141', 'MATH 151', 'MATH 200', 'MATH 201']),
      placement(
        'satisfactory_math_placement_exam_score',
        'a satisfactory score on the math placement exam',
        { placement_test: 'math placement exam', satisfactory_score_required: true },
      ),
    ], 'or');
    const chemistry = combineTokenLists([
      oneCourseToken('CHEM 100', owner, { minimum_grade: 'B' }),
      oneCourseToken('CHEM 101', owner, { minimum_grade: 'C' }),
      placement(
        'satisfactory_chemistry_placement_exam_score',
        'a satisfactory score on the chemistry placement exam',
        { placement_test: 'chemistry placement exam', satisfactory_score_required: true },
      ),
    ], 'or');
    return joinTokenLists(parenthesized(math), 'and', parenthesized(chemistry));
  }

  if (/^MATH 139, MATH 141, MATH 151, MATH 200, MATH 201 or placement into MATH 151, MATH 200 or MATH 201 by the VCU mathematics placement test within the one-year period immediately preceding the beginning of the course; and CHEM 100 with a minimum grade of B or satisfactory score on the chemistry placement exam\/assessment within the one-year period immediately preceding the beginning of the course$/i.test(input)) {
    const math = combineTokenLists([
      courseAlternatives(['MATH 139', 'MATH 141', 'MATH 151', 'MATH 200', 'MATH 201']),
      placement(
        'recent_vcu_math_placement_into_calculus',
        'placement into MATH 151, MATH 200 or MATH 201 by the VCU mathematics placement test within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'VCU mathematics placement test',
          placement_course_codes: ['MATH151', 'MATH200', 'MATH201'],
          maximum_age_years: 1,
        },
      ),
    ], 'or');
    const chemistry = combineTokenLists([
      oneCourseToken('CHEM 100', owner, { minimum_grade: 'B' }),
      placement(
        'recent_satisfactory_chemistry_placement_exam_or_assessment_score',
        'satisfactory score on the chemistry placement exam/assessment within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'chemistry placement exam/assessment',
          satisfactory_score_required: true,
          maximum_age_years: 1,
        },
      ),
    ], 'or');
    return joinTokenLists(parenthesized(math), 'and', parenthesized(chemistry));
  }

  match = input.match(/^CMSC 355, 357 and 401 each with a minimum grade of ([A-F]); and UNIV 200 or HONR 200 or equivalent, with minimum grades of ([A-F])$/i);
  if (match) {
    const left = combineTokenLists(
      ['CMSC 355', 'CMSC 357', 'CMSC 401'].map((code) => (
        oneCourseToken(code, owner, { minimum_grade: match[1].toUpperCase() })
      )),
      'and',
    );
    const right = combineTokenLists([
      oneCourseToken('UNIV 200', owner, { minimum_grade: match[2].toUpperCase() }),
      oneCourseToken('HONR 200', owner, { minimum_grade: match[2].toUpperCase() }),
      oneNonCourseToken(
        'equivalent_to_univ_200_or_honr_200', 'equivalent',
        {
          equivalent_to_course_codes: ['UNIV200', 'HONR200'],
          minimum_grade: match[2].toUpperCase(),
        },
      ),
    ], 'or');
    return joinTokenLists(left, 'and', right, { groupRight: true });
  }

  match = input.match(/^CMSC 355, CMSC 357, and CMSC 401 each with minimum grade of ([A-F]); and UNIV 200 or HONR 200 or equivalent$/i);
  if (match) {
    const left = combineTokenLists(
      ['CMSC 355', 'CMSC 357', 'CMSC 401'].map((code) => (
        oneCourseToken(code, owner, { minimum_grade: match[1].toUpperCase() })
      )),
      'and',
    );
    const right = combineTokenLists([
      oneCourseToken('UNIV 200', owner),
      oneCourseToken('HONR 200', owner),
      oneNonCourseToken(
        'equivalent_to_univ_200_or_honr_200', 'equivalent',
        { equivalent_to_course_codes: ['UNIV200', 'HONR200'] },
      ),
    ], 'or');
    return joinTokenLists(left, 'and', right, { groupRight: true });
  }

  if (/^permission of instructor$/i.test(input)) {
    return oneNonCourseToken(
      'permission_of_instructor', input,
      { authorization_kind: 'permission', authorization_authority: 'instructor' },
    );
  }

  match = input.match(/^MATH 151 with a minimum grade of ([A-F]) or a satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course$/i);
  if (match) {
    return joinTokenLists(
      oneCourseToken('MATH 151', owner, { minimum_grade: match[1].toUpperCase() }),
      'or',
      placement(
        'recent_satisfactory_vcu_mathematics_placement_test_score',
        'a satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          satisfactory_score_required: true,
          maximum_age_years: 1,
        },
      ),
    );
  }

  match = input.match(/^satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course, or (.+)$/i);
  if (match) {
    const choices = match[1];
    if (/\band\b|[;]/i.test(choices)) {
      throw new Error('VCU placement alternative has unsupported Boolean prose');
    }
    return joinTokenLists(
      placement(
        'recent_satisfactory_vcu_mathematics_placement_test_score',
        'satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
        {
          placement_test: 'VCU Mathematics Placement Test',
          satisfactory_score_required: true,
          maximum_age_years: 1,
        },
      ),
      'or',
      tokenizeCourseOnly(normalizeFlatList(choices, 'or'), owner),
      { groupRight: true },
    );
  }

  match = input.match(new RegExp(`^(${STRICT_CODE}) with a minimum grade of ([A-F]), (${STRICT_CODE}) with a minimum grade of ([A-F]) or (${STRICT_CODE})$`, 'i'));
  if (match) {
    return combineTokenLists([
      oneCourseToken(match[1], owner, { minimum_grade: match[2].toUpperCase() }),
      oneCourseToken(match[3], owner, { minimum_grade: match[4].toUpperCase() }),
      oneCourseToken(match[5], owner),
    ], 'or');
  }

  throw new Error('clause is outside the strict VCU structured grammar');
}

function spanFromMatch(raw, match, groupIndex = 1) {
  const captured = match[groupIndex];
  const value = captured.trim();
  const leadingWhitespace = captured.length - captured.trimStart().length;
  const relative = match.index + match[0].indexOf(captured) + leadingWhitespace;
  return {
    raw: value,
    relative_start: relative,
    relative_end: relative + value.length,
    statement_relative_start: match.index,
    statement_relative_end: relative + value.length,
  };
}

// Three CNU PDF fields omit punctuation between a one-line requisite and the
// first sentence of the description. These source-hash-bound, course-specific
// receipts stop at the exact newline only when the retained following line is
// also present. A changed entry therefore falls back to the conservative PDF
// sentence boundary and remains unparsed.
const CNU_EXACT_NEWLINE_REQUISITE_RECEIPTS = Object.freeze({
  CPSC150: Object.freeze({
    label: 'Pre or Corequisite',
    raw: 'CPSC 150L',
    following_line: 'This course is an introduction to problem solving and',
  }),
  CYBR428: Object.freeze({
    label: 'Prerequisites',
    raw: 'CYBR 328 and CPSC 335',
    following_line: 'Study of encryption algorithms and network security prac-',
  }),
  CPSC250: Object.freeze({
    label: 'Corequisites',
    raw: 'CPSC 250L and MATH 135 or 140 or 148 or\npermission of department chair',
    following_line: 'This course builds upon concepts taught in CPSC 150 and',
  }),
});

function extractCnuRequiredClauses(candidate) {
  if (candidate?.source?.boundary_contract === CNU_COMPOUND_BOUNDARY_CONTRACT) {
    const receipt = candidate.source.compound_member_requisite;
    if (candidate.source.compound_receipt_contract !== CNU_COMPOUND_RECEIPT_CONTRACT
        || receipt?.course_code !== candidate.course_code) {
      return { clauses: [], ignored: [] };
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        ...(receipt.concurrent_allowed ? { concurrent_allowed: true } : {}),
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  const text = candidate.source.raw_entry_text;
  const marker = /^(Prerequisites?|Pre\s+or\s+Corequisites?|Corequisites?):[ \t]*/gim;
  const matches = [...text.matchAll(marker)];
  const clauses = [];
  const ignored = [];
  matches.forEach((labelMatch, index) => {
    const start = labelMatch.index + labelMatch[0].length;
    const nextMarker = matches[index + 1]?.index ?? text.length;
    const region = text.slice(start, nextMarker);
    const exactNewline = CNU_EXACT_NEWLINE_REQUISITE_RECEIPTS[candidate.course_code];
    const exactNewlineMatches = exactNewline?.label.toLowerCase()
      === labelMatch[1].replace(/\s+/g, ' ').toLowerCase()
      && region.startsWith(`${exactNewline.raw}\n${exactNewline.following_line}`);
    const period = region.indexOf('.');
    const boundedEnd = exactNewlineMatches
      ? start + exactNewline.raw.length
      : (period >= 0 ? start + period : nextMarker);
    const bounded = text.slice(start, boundedEnd);
    const raw = bounded.trim();
    if (!raw) return;
    const relativeStart = start + bounded.indexOf(raw);
    let retained = raw;
    const recommended = retained.match(/;\s*[A-Z]{2,8}\s+\d{2,4}[A-Z]?\s+is recommended$/i);
    if (recommended) {
      retained = retained.slice(0, recommended.index).trim();
      ignored.push('explicit_recommended_requisite_suffix_not_modeled');
    }
    const label = labelMatch[1].replace(/\s+/g, ' ');
    const embeddedPreference = retained.match(/\(MATH\s+132 is preferred\)/i);
    if (embeddedPreference) {
      const ignoredRaw = embeddedPreference[0];
      const ignoredStart = relativeStart + embeddedPreference.index;
      ignored.push({
        kind: 'explicit_embedded_course_preference_not_modeled',
        raw: ignoredRaw,
        relative_start: ignoredStart,
        relative_end: ignoredStart + ignoredRaw.length,
        raw_sha256: sha256(ignoredRaw),
      });
    }
    clauses.push({
      kind: /^core/i.test(label) ? 'corequisite' : 'prerequisite',
      label,
      ...(/^pre\s+or\s+core/i.test(label) ? { concurrent_allowed: true } : {}),
      raw: retained,
      relative_start: relativeStart,
      relative_end: relativeStart + retained.length,
      statement_relative_start: labelMatch.index,
      statement_relative_end: exactNewlineMatches
        ? boundedEnd
        : (period >= 0 ? start + period + 1 : nextMarker),
    });
  });
  return { clauses, ignored };
}

function extractBridgewaterRequiredClauses(candidate) {
  if (candidate?.source?.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT
      || candidate?.source?.source_format !== 'cleancatalog_course_page') {
    return { clauses: [], ignored: [] };
  }
  const text = candidate.source.raw_entry_text;
  const marker = /\b(Prerequisites?|Corequisites?|Term Offered):\s*/gi;
  const matches = [...text.matchAll(marker)];
  const clauses = [];
  matches.forEach((labelMatch, index) => {
    const label = labelMatch[1];
    if (/^Term Offered$/i.test(label)) return;
    const start = labelMatch.index + labelMatch[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    const bounded = text.slice(start, end);
    const raw = bounded.trim();
    if (!raw) return;
    const relativeStart = start + bounded.indexOf(raw);
    clauses.push({
      kind: /^Core/i.test(label) ? 'corequisite' : 'prerequisite',
      label,
      raw,
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: labelMatch.index,
      statement_relative_end: end,
    });
  });
  return { clauses, ignored: [] };
}

function extractLongwoodRequiredClauses(candidate) {
  const department = candidate?.source?.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT
    && candidate?.source?.source_format === 'longwood_department_course_listing';
  const banner = candidate?.source?.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT
    && candidate?.source?.source_format === 'longwood_banner_course_listing';
  if (!department && !banner) {
    return { clauses: [], ignored: [] };
  }
  const text = candidate.source.raw_entry_text;
  const marker = /\b(Prerequisite\/Corequisite|Pre-requisites?|Prerequisites?|Corequisite|Co-requisites):[ \t]*/gi;
  const matches = [...text.matchAll(marker)];
  const clauses = [];
  const ignored = [];
  matches.forEach((labelMatch, index) => {
    const start = labelMatch.index + labelMatch[0].length;
    const nextMarker = matches[index + 1]?.index ?? text.length;
    const region = text.slice(start, nextMarker);
    const period = region.indexOf('.');
    const bannerUnitMatches = banner
      ? [...region.matchAll(/\s+\d+(?:\s*-\s*\d+)?\s+credits?\b/gi)]
      : [];
    const terminalUnits = bannerUnitMatches.length === 1
      && /^[.\s]*(?:[A-Z]{1,8}(?:,\s*[A-Z]{1,8})*)?[.\s]*$/.test(
        region.slice(bannerUnitMatches[0].index + bannerUnitMatches[0][0].length),
      )
      ? bannerUnitMatches[0]
      : null;
    const end = banner && terminalUnits
      ? start + terminalUnits.index
      : (period >= 0 ? start + period : nextMarker);
    const bounded = text.slice(start, end);
    let raw = bounded.trim();
    if (!raw) return;
    const relativeStart = start + bounded.indexOf(raw);
    let catalogDesignationSuffix = null;
    const designation = banner
      ? raw.match(/\.\s+((?:[A-Z][A-Z0-9]{0,7}(?:[.,;]\s*|$))+?)\.?$/)
      : null;
    if (designation) {
      const suffixRaw = designation[1].trim();
      const suffixStart = relativeStart + designation.index
        + designation[0].indexOf(suffixRaw);
      catalogDesignationSuffix = {
        kind: 'exact_catalog_designation_suffix_outside_requisite_clause',
        raw: suffixRaw,
        relative_start: suffixStart,
        relative_end: suffixStart + suffixRaw.length,
        raw_sha256: sha256(suffixRaw),
      };
      raw = raw.slice(0, designation.index).trim();
    }
    const recommended = raw.match(/;\s*([A-Z]{2,8}\s+\d{2,4}[A-Z]?\s+recommended)$/i);
    if (recommended) {
      const ignoredRaw = recommended[1];
      const ignoredStart = relativeStart + recommended.index
        + recommended[0].indexOf(ignoredRaw);
      ignored.push({
        kind: 'explicit_recommended_requisite_suffix_not_modeled',
        raw: ignoredRaw,
        relative_start: ignoredStart,
        relative_end: ignoredStart + ignoredRaw.length,
        raw_sha256: sha256(ignoredRaw),
      });
      raw = raw.slice(0, recommended.index).trim();
    }
    const label = labelMatch[1];
    clauses.push({
      kind: /^(?:Corequisite|Co-requisites)$/i.test(label) ? 'corequisite' : 'prerequisite',
      label,
      ...(/^Prerequisite\/Corequisite$/i.test(label) ? { concurrent_allowed: true } : {}),
      raw,
      ...(catalogDesignationSuffix ? {
        catalog_designation_suffix: catalogDesignationSuffix,
      } : {}),
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: labelMatch.index,
      statement_relative_end: catalogDesignationSuffix
        ? relativeStart + designation.index + 1
        : banner && terminalUnits
        ? start + terminalUnits.index
        : (period >= 0 ? start + period + 1 : nextMarker),
    });
  });
  return { clauses, ignored };
}

const JMU_BROWSER_STRICT_CLAUSE_CONTRACTS = Object.freeze({
  CS149: Object.freeze({
    prerequisite: 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam.',
    field: 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam. You may only attempt CS 149 two times.',
    ignored: 'You may only attempt CS 149 two times.',
  }),
  CS159: Object.freeze({
    prerequisite: 'A minimum grade of "B-" in CS 149 or equivalent.',
    field: 'A minimum grade of "B-" in CS 149 or equivalent. You may only attempt CS 159 two times.',
    ignored: 'You may only attempt CS 159 two times.',
  }),
  CS227: Object.freeze({ prerequisite: 'A minimum grade of "B-" in CS 149.' }),
  CS240: Object.freeze({
    prerequisite: 'Fully admitted Computer Science majors or minors only and grades of "C-" or better in CS 159, CS 227/MATH 227 or MATH 245, and MATH 231 or equivalent.',
    field: 'Fully admitted Computer Science majors or minors only and grades of "C-" or better in CS 159, CS 227/MATH 227 or MATH 245, and MATH 231 or equivalent. You may only attempt CS 240 two times.',
    ignored: 'You may only attempt CS 240 two times.',
  }),
  CS261: Object.freeze({
    prerequisite: 'Fully admitted Computer Science majors or minors only and minimum grade of "C-" in either CS 227/MATH 227 or MATH 245, and in CS 159.',
    field: 'Fully admitted Computer Science majors or minors only and minimum grade of "C-" in either CS 227/MATH 227 or MATH 245, and in CS 159. You may only take CS 261 two times.',
    ignored: 'You may only take CS 261 two times.',
  }),
  CS327: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors only and a minimum grade of "C-" in CS 227/MATH 227 or MATH 245, and CS 240.' }),
  CS345: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 159.' }),
  CS361: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors only and a minimum grade of "C-" in CS 240 and CS 261.' }),
  CS412: Object.freeze({
    prerequisite: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 327 and either MATH 220 or MATH 229 or MATH 318.',
    field: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 327 and either MATH 220 or MATH 229 or MATH 318. Students may not receive credit for both CS 412 and CS 452.',
    ignored: 'Students may not receive credit for both CS 412 and CS 452.',
  }),
  CS430: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 240 and CS 261.' }),
  CS432: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 327 and CS 361.' }),
  CS450: Object.freeze({ prerequisite: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 361.' }),
  CS452: Object.freeze({
    prerequisite: 'A grade of "C-" or better in CS 327 and either MATH 220 or MATH 229 or MATH 318.',
    field: 'A grade of "C-" or better in CS 327 and either MATH 220 or MATH 229 or MATH 318. Students may not receive credit for both CS 412 and CS 452.',
    ignored: 'Students may not receive credit for both CS 412 and CS 452.',
  }),
  CS455: Object.freeze({ prerequisite: 'Fully admitted computer science majors or minors only and a minimum grade of "C-" in CS 361.' }),
  CS456: Object.freeze({ prerequisite: 'Fully admitted computer science majors or minors only and a minimum grade of "C-" in CS 361.' }),
  CS470: Object.freeze({ prerequisite: 'Fully admitted computer science majors or minors only and a minimum grade of "C-" in CS 361.' }),
  MATH220: Object.freeze({ prerequisite: 'MATH 105 with a grade of "C-" or better or sufficient score on the Mathematics Placement Exam.' }),
  MATH227: Object.freeze({ prerequisite: 'A minimum grade of "B-" in CS 149.' }),
  MATH229: Object.freeze({
    prerequisite: 'Sufficient statistics and calculus placement scores. The calculus score requirement may be waived for students with "C-" or better in MATH 231.',
    field: 'Sufficient statistics and calculus placement scores. The calculus score requirement may be waived for students with "C-" or better in MATH 231. Not open to students with credit in MATH 220, MATH 220H, MATH 318, MATH 329 or equivalent.',
    ignored: 'Not open to students with credit in MATH 220, MATH 220H, MATH 318, MATH 329 or equivalent.',
  }),
  MATH231: Object.freeze({ prerequisite: 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam.' }),
  MATH232: Object.freeze({
    prerequisite: 'MATH 231 with a grade of "C-" or better.',
    field: 'MATH 231 with a grade of "C-" or better. Not open to students with credit in MATH 234 or MATH 235.',
    ignored: 'Not open to students with credit in MATH 234 or MATH 235.',
  }),
  MATH235: Object.freeze({
    prerequisite: 'Sufficient score on the Mathematics Placement Exam.',
    field: 'Sufficient score on the Mathematics Placement Exam. MATH 235 is not open to students who have already earned credit in MATH 232 or MATH 234.',
    ignored: 'MATH 235 is not open to students who have already earned credit in MATH 232 or MATH 234.',
  }),
  MATH245: Object.freeze({
    prerequisite: 'MATH 236.',
    corequisite: 'MATH 236.',
  }),
  MATH318: Object.freeze({
    prerequisite: 'MATH 236.',
    field: 'MATH 236. Not open to students with credit in MATH 229 or MATH 329.',
    ignored: 'Not open to students with credit in MATH 229 or MATH 329.',
  }),
});

const VIRGINIA_TECH_BROWSER_OUTSIDE_CONTRACTS = Object.freeze({
  CEE3014: Object.freeze({
    prerequisite: 'Junior standing',
    outside_statement: 'Pre: Junior standing',
    raw_entry_sha256: 'a353df3a952bad15fbf7ed229e686b016724b39b9a067c203d516c4ffa1afdb9',
    strategy: 'outside_junior_standing_only',
    synthetic_prerequisite: true,
  }),
  CEE3804: Object.freeze({
    prerequisite: 'Junior Standing',
    outside_statement: 'Pre: Junior Standing.',
    raw_entry_sha256: '771b92f294329ab84e3029a54e90bef0e327e661b5f62e321742449abcab4770',
    strategy: 'outside_junior_standing_only',
    synthetic_prerequisite: true,
  }),
  CHEM1035: Object.freeze({
    prerequisite: 'CHEM 1014 or MATH 1014 or MATH 1025 or MATH 1536 or MATH 1225 or MATH 1214 or MATH 1524',
    outside_statement: 'Students may bypass prerequisites for 1035 through testing alternatives listed in the Registrar’s Timetable.',
    strategy: 'testing_bypass_alternative',
  }),
  CHEM1036: Object.freeze({
    prerequisite: 'CHEM 1035 or CHEM 1055 or CHEM 1055H',
    outside_statement: 'Students may bypass prerequisites for 1035 through testing alternatives listed in the Registrar’s Timetable.',
    strategy: 'sibling_course_context',
    ignored_kind: 'exact_sibling_course_prerequisite_context_not_applicable_to_current_course',
  }),
  ECE4504: Object.freeze({
    prerequisite: 'ECE 3504 or CS 3214',
    outside_statement: 'A grade of C or better required in prerequisites.',
    strategy: 'minimum_grade_all_prerequisite_courses',
    minimum_grade: 'C',
  }),
  ENGL3804: Object.freeze({
    prerequisite: 'ENGL 1106 or COMM 1016',
    outside_statement: 'Must have pre-requisites or the consent of the Director of Professional Writing.',
    strategy: 'director_consent_alternative',
  }),
  ENGL3814: Object.freeze({
    prerequisite: 'ENGL 1106 or COMM 1016',
    outside_statement: 'Must have pre-requisites or the consent of the Director of Professional Writing.',
    strategy: 'director_consent_alternative',
  }),
  MATH2114: Object.freeze({
    prerequisite: 'MATH 1225 or MATH 1226',
    outside_statement: 'Math 1226 or a grade of at least B in VT MATH 1225.',
    strategy: 'minimum_grade_named_course',
    minimum_grade: 'B',
    minimum_grade_codes: Object.freeze(['MATH1225']),
  }),
  MATH2114H: Object.freeze({
    prerequisite: 'MATH 1225 or MATH 1226',
    outside_statement: 'Math 1226 or a grade of at least B in VT MATH 1225.',
    strategy: 'minimum_grade_named_course',
    minimum_grade: 'B',
    minimum_grade_codes: Object.freeze(['MATH1225']),
  }),
  MATH1226: Object.freeze({
    prerequisite: 'MATH 1225',
    outside_statement: 'Pre: Grade of at least C- in 1225 for 1226.',
    strategy: 'minimum_grade_named_course',
    minimum_grade: 'C-',
    minimum_grade_codes: Object.freeze(['MATH1225']),
    ignored_outside_statements: Object.freeze([Object.freeze({
      statement: 'Assumes 2 units of high school algebra, 1 unit of geometry, 1/2 unit each of trigonometry and precalculus, and placement by Math Dept.',
      kind: 'exact_sibling_course_prerequisite_context_not_applicable_to_current_course',
      applies_to_course_code: 'MATH1225',
    })]),
  }),
  ISC2105: Object.freeze({
    prerequisite: 'ISC 1106H',
    outside_statement:
      'Restricted to majors in the College of Science. Only by permission of the instructor.',
    raw_entry_sha256: '9771569b32613b152982116b75d88be0fb9d3d9872316009da69e459bf0fc00c',
    strategy: 'college_of_science_major_and_instructor_permission',
  }),
});

function exactUniqueStatementOffset(text, statement) {
  const first = String(text || '').indexOf(statement);
  return first >= 0 && String(text || '').indexOf(statement, first + 1) < 0 ? first : -1;
}

function exactBrowserCourseLeafRequiredClauses(candidate) {
  if (candidate?.source?.browser_challenge_contract !== BROWSER_CHALLENGE_CONTRACT
      || candidate?.source?.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || !structuredCourseLeafRequisiteFieldsValid({
        ...candidate.source,
        slug: candidate.slug,
      })) return { clauses: [], ignored: [] };
  const fields = asArray(candidate.source.structured_requisite_fields);
  if (candidate.slug === JMU_SLUG) {
    const contract = JMU_BROWSER_STRICT_CLAUSE_CONTRACTS[candidate.course_code];
    if (!contract) return { clauses: [], ignored: [] };
    const expectedKinds = ['prerequisite', ...(contract.corequisite ? ['corequisite'] : [])];
    if (fields.length !== expectedKinds.length) return { clauses: [], ignored: [] };
    const clauses = [];
    const ignored = [];
    for (const kind of expectedKinds) {
      const field = fields.find((row) => row.kind === kind);
      const raw = contract[kind];
      const expectedField = kind === 'prerequisite' ? (contract.field || raw) : raw;
      if (!field || field.raw !== expectedField || !field.raw.startsWith(raw)) {
        return { clauses: [], ignored: [] };
      }
      clauses.push({
        kind,
        label: field.label,
        ...(kind === 'corequisite' ? { concurrent_allowed: true } : {}),
        raw,
        relative_start: field.relative_start,
        relative_end: field.relative_start + raw.length,
        statement_relative_start: field.statement_relative_start,
        statement_relative_end: field.relative_start + raw.length,
      });
      if (kind === 'prerequisite' && contract.ignored) {
        if (field.raw !== `${raw} ${contract.ignored}`) return { clauses: [], ignored: [] };
        const ignoredStart = field.relative_start + raw.length + 1;
        ignored.push({
          kind: /^You may only/.test(contract.ignored)
            ? 'exact_attempt_limit_outside_required_prerequisite_formula'
            : 'exact_course_credit_exclusion_outside_required_prerequisite_formula',
          raw: contract.ignored,
          relative_start: ignoredStart,
          relative_end: ignoredStart + contract.ignored.length,
          raw_sha256: sha256(contract.ignored),
        });
      }
    }
    return { clauses, ignored };
  }
  if (candidate.slug === VIRGINIA_TECH_SLUG) {
    const contract = VIRGINIA_TECH_BROWSER_OUTSIDE_CONTRACTS[candidate.course_code];
    const exactEntry = !contract?.raw_entry_sha256 || (
      candidate.source.raw_entry_sha256 === contract.raw_entry_sha256
      && sha256(candidate.source.raw_entry_text) === contract.raw_entry_sha256
    );
    const clauses = fields.map((field) => ({
        kind: field.kind,
        label: field.label,
        ...(field.kind === 'corequisite' ? { concurrent_allowed: true } : {}),
        raw: field.raw,
        relative_start: field.relative_start,
        relative_end: field.relative_end,
        statement_relative_start: field.statement_relative_start,
        statement_relative_end: field.statement_relative_end,
      }));
    if (contract?.synthetic_prerequisite && exactEntry && fields.length === 0) {
      const statementStart = exactUniqueStatementOffset(
        candidate.source.raw_entry_text, contract.outside_statement,
      );
      const rawOffset = contract.outside_statement.indexOf(contract.prerequisite);
      if (statementStart >= 0 && rawOffset >= 0) clauses.push({
        kind: 'prerequisite',
        label: 'Pre',
        raw: contract.prerequisite,
        relative_start: statementStart + rawOffset,
        relative_end: statementStart + rawOffset + contract.prerequisite.length,
        statement_relative_start: statementStart,
        statement_relative_end: statementStart + contract.outside_statement.length,
      });
    }
    const ignoredContracts = [
      ...(contract?.ignored_kind ? [{
        statement: contract.outside_statement,
        kind: contract.ignored_kind,
        applies_to_course_code: 'CHEM1035',
      }] : []),
      ...asArray(contract?.ignored_outside_statements),
    ];
    const ignored = [];
    for (const ignoredContract of ignoredContracts) {
      const offset = exactUniqueStatementOffset(
        candidate.source.raw_entry_text, ignoredContract.statement,
      );
      if (offset < 0) return { clauses: [], ignored: [] };
      ignored.push({
        kind: ignoredContract.kind,
        raw: ignoredContract.statement,
        relative_start: offset,
        relative_end: offset + ignoredContract.statement.length,
        raw_sha256: sha256(ignoredContract.statement),
        applies_to_course_code: ignoredContract.applies_to_course_code,
        current_course_code: candidate.course_code,
      });
    }
    return { clauses, ignored };
  }
  return { clauses: [], ignored: [] };
}

function tokenizeJmuBrowserStrictFormula(candidate, clause) {
  const owner = candidate.owner_namespace;
  const raw = clause.raw;
  const course = (code, extra = {}) => oneCourseToken(code, owner, extra);
  const courses = (codes, operator, extra = {}) => combineTokenLists(
    codes.map((code) => course(code, extra)), operator,
  );
  const placement = (condition, source, extra = {}) => oneNonCourseToken(
    condition, source, { placement_test: 'JMU Mathematics Placement Exam', ...extra },
  );
  const major = (majorOnly = false) => oneNonCourseToken(
    majorOnly
      ? 'fully_admitted_computer_science_major'
      : 'fully_admitted_computer_science_major_or_minor',
    majorOnly
      ? 'Fully admitted Computer Science majors only'
      : 'Fully admitted Computer Science majors or minors only',
    {
      admission_status: 'fully_admitted',
      program: 'Computer Science',
      eligible_program_roles: majorOnly ? ['major'] : ['major', 'minor'],
    },
  );
  const mathPlacement = placement(
    'sufficient_jmu_mathematics_placement_exam_score',
    'sufficient score on the Mathematics Placement Exam',
    { sufficient_score_required: true },
  );
  if (raw === 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam.') {
    return combineTokenLists([course('MATH 155'), course('MATH 156'), mathPlacement], 'or');
  }
  if (raw === 'A minimum grade of "B-" in CS 149 or equivalent.') {
    return combineTokenLists([
      course('CS 149', { minimum_grade: 'B-' }),
      oneNonCourseToken('equivalent_to_cs_149', 'equivalent', {
        equivalent_to_course_codes: ['CS149'], minimum_grade: 'B-',
      }),
    ], 'or');
  }
  if (raw === 'A minimum grade of "B-" in CS 149.') {
    return course('CS 149', { minimum_grade: 'B-' });
  }
  const crosslistedDiscrete = courses(['CS 227', 'MATH 227', 'MATH 245'], 'or', {
    minimum_grade: 'C-',
  });
  if (raw === 'Fully admitted Computer Science majors or minors only and grades of "C-" or better in CS 159, CS 227/MATH 227 or MATH 245, and MATH 231 or equivalent.') {
    return combineTokenLists([
      major(), course('CS 159', { minimum_grade: 'C-' }), parenthesized(crosslistedDiscrete),
      parenthesized(combineTokenLists([
        course('MATH 231', { minimum_grade: 'C-' }),
        oneNonCourseToken('equivalent_to_math_231', 'equivalent', {
          equivalent_to_course_codes: ['MATH231'], minimum_grade: 'C-',
        }),
      ], 'or')),
    ], 'and');
  }
  if (raw === 'Fully admitted Computer Science majors or minors only and minimum grade of "C-" in either CS 227/MATH 227 or MATH 245, and in CS 159.') {
    return combineTokenLists([
      major(), parenthesized(crosslistedDiscrete), course('CS 159', { minimum_grade: 'C-' }),
    ], 'and');
  }
  if (raw === 'Fully admitted Computer Science majors only and a minimum grade of "C-" in CS 227/MATH 227 or MATH 245, and CS 240.') {
    return combineTokenLists([
      major(true), parenthesized(crosslistedDiscrete), course('CS 240', { minimum_grade: 'C-' }),
    ], 'and');
  }
  const admittedSingle = /^(Fully admitted (?:Computer Science|computer science) majors(?: or minors)? only) and a minimum grade of "C-" in (CS \d{3})(?: and (CS \d{3}))?[.]$/.exec(raw);
  if (admittedSingle) {
    const majorOnly = !/or minors/i.test(admittedSingle[1]);
    return combineTokenLists([
      major(majorOnly),
      course(admittedSingle[2], { minimum_grade: 'C-' }),
      ...(admittedSingle[3] ? [course(admittedSingle[3], { minimum_grade: 'C-' })] : []),
    ], 'and');
  }
  const majorMathChoice = /^Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS (327) and either MATH 220 or MATH 229 or MATH 318[.]$/.exec(raw);
  const noMajorMathChoice = /^A grade of "C-" or better in CS (327) and either MATH 220 or MATH 229 or MATH 318[.]$/.exec(raw);
  if (majorMathChoice || noMajorMathChoice) {
    return combineTokenLists([
      ...(majorMathChoice ? [major()] : []),
      course('CS 327', { minimum_grade: 'C-' }),
      parenthesized(courses(['MATH 220', 'MATH 229', 'MATH 318'], 'or', {
        minimum_grade: 'C-',
      })),
    ], 'and');
  }
  if (raw === 'MATH 105 with a grade of "C-" or better or sufficient score on the Mathematics Placement Exam.') {
    return combineTokenLists([course('MATH 105', { minimum_grade: 'C-' }), mathPlacement], 'or');
  }
  if (raw === 'Sufficient statistics and calculus placement scores. The calculus score requirement may be waived for students with "C-" or better in MATH 231.') {
    return combineTokenLists([
      placement('sufficient_jmu_statistics_placement_score', 'Sufficient statistics placement score', {
        placement_domain: 'statistics', sufficient_score_required: true,
      }),
      parenthesized(combineTokenLists([
        placement('sufficient_jmu_calculus_placement_score', 'sufficient calculus placement score', {
          placement_domain: 'calculus', sufficient_score_required: true,
        }),
        course('MATH 231', { minimum_grade: 'C-', waives_calculus_placement_score: true }),
      ], 'or')),
    ], 'and');
  }
  if (raw === 'MATH 231 with a grade of "C-" or better.') {
    return course('MATH 231', { minimum_grade: 'C-' });
  }
  if (raw === 'Sufficient score on the Mathematics Placement Exam.') return mathPlacement;
  if (raw === 'MATH 236.') return course('MATH 236');
  throw new Error('JMU clause is outside the pinned browser CourseLeaf formula roster');
}

function booleanOperatorsAtDepth(raw) {
  const operators = new Map();
  let depth = 0;
  const token = /[()]|\b(?:and|or)\b/gi;
  for (const match of raw.matchAll(token)) {
    const value = match[0].toLowerCase();
    if (value === '(') depth += 1;
    else if (value === ')') {
      depth -= 1;
      if (depth < 0) return null;
    } else {
      const set = operators.get(depth) || new Set();
      set.add(value);
      operators.set(depth, set);
    }
  }
  if (depth !== 0) return null;
  return operators;
}

function tokenizeVirginiaTechBrowserStrictFormula(candidate, clause) {
  const contract = VIRGINIA_TECH_BROWSER_OUTSIDE_CONTRACTS[candidate.course_code];
  if (contract?.raw_entry_sha256 && (
    candidate.source.raw_entry_sha256 !== contract.raw_entry_sha256
    || sha256(candidate.source.raw_entry_text) !== contract.raw_entry_sha256
  )) throw new Error('Virginia Tech exact outside-condition entry hash changed');
  const firstStructured = candidate.source.structured_requisite_fields[0]?.statement_relative_start;
  const unmodeled = String(candidate.source.raw_entry_text || '')
    .slice(0, Number.isInteger(firstStructured)
      ? firstStructured : candidate.source.raw_entry_text.length);
  let unmodeledRemainder = unmodeled;
  let outsideEvidence = null;
  if (contract) {
    const expected = contract[clause.kind];
    if (expected !== clause.raw.replace(/[.]\s*$/, '').trim()) {
      throw new Error('Virginia Tech browser clause changed from its exact outside-condition contract');
    }
    const offset = exactUniqueStatementOffset(unmodeled, contract.outside_statement);
    if (offset < 0) {
      throw new Error('Virginia Tech exact outside-condition statement is absent or non-unique');
    }
    outsideEvidence = {
      kind: 'exact_full_entry_requirement_statement',
      raw: contract.outside_statement,
      raw_sha256: sha256(contract.outside_statement),
    };
    unmodeledRemainder = `${unmodeled.slice(0, offset)}${unmodeled.slice(
      offset + contract.outside_statement.length,
    )}`;
    for (const ignoredContract of asArray(contract.ignored_outside_statements)) {
      const ignoredOffset = exactUniqueStatementOffset(
        unmodeledRemainder, ignoredContract.statement,
      );
      if (ignoredOffset < 0) {
        throw new Error('Virginia Tech exact sibling-course statement is absent or non-unique');
      }
      unmodeledRemainder = `${unmodeledRemainder.slice(0, ignoredOffset)}${unmodeledRemainder.slice(
        ignoredOffset + ignoredContract.statement.length,
      )}`;
    }
  }
  if (/\b(?:students may bypass prerequisites|must have pre-requisites|grade of [A-F][+-]? or better (?:is )?required in prerequisites|Pre:\s*(?:Grade|Junior standing)|Restricted to majors in the College of Science|Only by permission of the instructor|placement by Math Dept|grade of at least [A-F][+-]? in VT MATH|units? of high school .{0,120}required|may not be taken by math majors.{0,80}permission)\b/i.test(unmodeledRemainder)) {
    throw new Error('Virginia Tech entry has an additional prerequisite condition outside the structured requisite field');
  }
  const operators = booleanOperatorsAtDepth(clause.raw);
  if (!operators || [...operators.values()].some((set) => set.size > 1)) {
    throw new Error('Virginia Tech structured field has mixed ungrouped AND/OR operators');
  }
  const exactBrowserFields = candidate.course_code === 'ECE2024'
    ? {
      prerequisite: 'ECE 1004 and (MATH 2114 or MATH 2114H or MATH 2405H)',
      corequisite: 'MATH 2214, PHYS 2306',
    }
    : null;
  if (exactBrowserFields && exactBrowserFields[clause.kind]
      !== clause.raw.replace(/[.]\s*$/, '').trim()) {
    throw new Error('Virginia Tech browser clause changed from its exact course-specific field contract');
  }
  let tokens = contract?.strategy === 'outside_junior_standing_only'
    ? oneNonCourseToken('junior_standing_or_higher', clause.raw, {
      minimum_class_standing: 'junior',
      outside_entry_requirement_evidence: outsideEvidence,
    })
    : exactBrowserFields && clause.kind === 'corequisite'
    ? tokenizeCourseOnly('MATH 2214 and PHYS 2306', candidate.owner_namespace)
    : tokenizeCourseOnly(clause.raw, candidate.owner_namespace);
  if (contract?.strategy === 'testing_bypass_alternative') {
    tokens = joinTokenLists(
      parenthesized(tokens),
      'or',
      oneNonCourseToken(
        'registrar_timetable_testing_alternative_for_chem_1035',
        contract.outside_statement,
        {
          assessment_kind: 'testing_alternative',
          administering_source: 'Registrar’s Timetable',
          bypasses_course_prerequisites: true,
          outside_entry_requirement_evidence: outsideEvidence,
        },
      ),
    );
  } else if (contract?.strategy === 'director_consent_alternative') {
    tokens = joinTokenLists(
      parenthesized(tokens),
      'or',
      oneNonCourseToken(
        'consent_of_director_of_professional_writing',
        'consent of the Director of Professional Writing',
        {
          authorization_kind: 'consent',
          authorization_authority: 'Director of Professional Writing',
          outside_entry_requirement_evidence: outsideEvidence,
        },
      ),
    );
  } else if (contract?.strategy === 'minimum_grade_all_prerequisite_courses') {
    const gradeEvidence = { ...outsideEvidence, kind: 'exact_full_entry_grade_statement' };
    tokens = tokens.map((token) => token.type === 'atom' && token.condition.type === 'course'
      ? {
        ...token,
        condition: {
          ...token.condition,
          minimum_grade: contract.minimum_grade,
          minimum_grade_evidence: gradeEvidence,
        },
      }
      : token);
  } else if (contract?.strategy === 'minimum_grade_named_course') {
    const gradeEvidence = { ...outsideEvidence, kind: 'exact_full_entry_grade_statement' };
    const expectedCodes = new Set(contract.minimum_grade_codes);
    const matched = new Set();
    tokens = tokens.map((token) => {
      if (token.type !== 'atom' || token.condition.type !== 'course'
          || !expectedCodes.has(token.condition.code)) return token;
      matched.add(token.condition.code);
      return {
        ...token,
        condition: {
          ...token.condition,
          minimum_grade: contract.minimum_grade,
          minimum_grade_evidence: gradeEvidence,
        },
      };
    });
    if ([...expectedCodes].some((code) => !matched.has(code))) {
      throw new Error('Virginia Tech outside grade statement names a course absent from the field');
    }
  } else if (contract?.strategy === 'college_of_science_major_and_instructor_permission') {
    if (clause.kind !== 'prerequisite') {
      throw new Error('Virginia Tech enrollment restriction is not attached to a prerequisite clause');
    }
    tokens = combineTokenLists([
      parenthesized(tokens),
      oneNonCourseToken(
        'major_in_college_of_science',
        'Restricted to majors in the College of Science',
        {
          enrollment_restriction: 'major',
          college: 'College of Science',
          outside_entry_requirement_evidence: outsideEvidence,
        },
      ),
      oneNonCourseToken(
        'permission_of_instructor',
        'Only by permission of the instructor',
        {
          authorization_kind: 'permission',
          authorization_authority: 'instructor',
          outside_entry_requirement_evidence: outsideEvidence,
        },
      ),
    ], 'and');
  } else if (contract?.strategy === 'outside_junior_standing_only') {
    // The exact entry-level "Pre:" statement is itself the whole formula.
  } else if (contract && contract.strategy !== 'sibling_course_context') {
    throw new Error('Virginia Tech outside-condition contract strategy is unsupported');
  }
  parseBooleanTokens(tokens);
  return tokens;
}

const VIRGINIA_TECH_STRICT_FORMULA_CONTRACTS = Object.freeze({
  CS1944: Object.freeze({ prerequisite: 'CS 1114 or CS 2064 or ECE 2514' }),
  CS2064: Object.freeze({ prerequisite: 'CS 1064' }),
  CS2104: Object.freeze({ prerequisite: 'CS 1114 or CS 1064 or ECE 2514' }),
  CS2114: Object.freeze({ prerequisite: 'CS 1114 or CS 2064' }),
  CS2144: Object.freeze({ prerequisite: 'CS 1114' }),
  CS3654: Object.freeze({
    prerequisite: '(CS 1114 or CS 1044 or CS 1054 or CS 1064) and (MATH 2204 or MATH 2204H or MATH 2406H or CMDA 2005) and (STAT 3006 or STAT 4105 or STAT 4705 or STAT 4714 or CMDA 2006)',
  }),
  CS3714: Object.freeze({
    prerequisite: 'CS 2114 or ECE 3514',
    grade_statement: 'A grade of C or better required in CS prerequisite.',
    minimum_grade_all_prerequisite_courses: true,
  }),
  CS3754: Object.freeze({
    prerequisite: 'CS 2114 or ECE 3514',
    grade_statement: 'A grade of C or better is required in prerequisite.',
    minimum_grade_all_prerequisite_courses: true,
  }),
  CS4704: Object.freeze({
    prerequisite: 'CS 3704 or CS 3714 or CS 3754',
    grade_statement: 'Pre: A grade of C or better in CS 3704.',
    minimum_grade_codes: Object.freeze(['CS3704']),
  }),
  CS3114: Object.freeze({
    prerequisite: '(CS 2114 or ECE 3514) and (CS 2505 or ECE 2564) and (MATH 2534 or MATH 3034)',
  }),
  CS4094: Object.freeze({ prerequisite: 'CS 2506 and CS 3114' }),
  CS4114: Object.freeze({ prerequisite: 'MATH 3134 or MATH 3034' }),
  CS4124: Object.freeze({ prerequisite: 'MATH 3134 or MATH 3034' }),
  CS4134: Object.freeze({ prerequisite: 'MATH 2114 or MATH 2114H' }),
  CS4144: Object.freeze({ prerequisite: 'CS 2114 and CS 2144' }),
  CS4274: Object.freeze({ prerequisite: 'CS 3114 and CS 3214', corequisite: 'CS 4264' }),
  CS4624: Object.freeze({ prerequisite: 'CS 3114' }),
  CS4944: Object.freeze({ prerequisite: 'CS 3604' }),
  CS2505: Object.freeze({
    corequisite: 'MATH 2534 or MATH 3034',
    prerequisite: 'CS 2114',
    grade_statement: 'A grade of C or better is required in CS prerequisite.',
    minimum_grade_codes: Object.freeze(['CS2114']),
  }),
  CS2506: Object.freeze({
    prerequisite: '(CS 2114 or ECE 3514) and (CS 2505 or ECE 2564) and (MATH 2534 or MATH 3034)',
    grade_statement: 'A grade of C or better is required in CS pre-requisite 2505 and 2114.',
    minimum_grade_codes: Object.freeze(['CS2114', 'CS2505']),
  }),
  CS3214: Object.freeze({
    prerequisite: '(CS 2506 and CS 2114) or (ECE 2564 and ECE 3574)',
    grade_statement: 'A grade of C or better is required in CS pre-requisites 2506 and 2114.',
    minimum_grade_codes: Object.freeze(['CS2506', 'CS2114']),
  }),
  CS3304: Object.freeze({
    prerequisite: 'CS 3114',
    grade_statement: 'A grade of C or better required in CS prerequisite 3114.',
    minimum_grade_codes: Object.freeze(['CS3114']),
  }),
  CS4104: Object.freeze({
    prerequisite: 'CS 3114 and (MATH 3034 or MATH 3134)',
    grade_statement: 'A grade of C or better is required in CS prerequisite 3114.',
    minimum_grade_codes: Object.freeze(['CS3114']),
  }),
  CS4284: Object.freeze({
    prerequisite: 'CS 3114 and CS 3214',
    grade_statement: 'A grade of C or better required in CS prerequisites.',
    minimum_grade_codes: Object.freeze(['CS3114', 'CS3214']),
  }),
  CS4634: Object.freeze({
    prerequisite: 'CS 3114 and CS 3724',
    grade_statement: 'A grade of C or better is required in CS prerequisites 3114 and 3724.',
    minimum_grade_codes: Object.freeze(['CS3114', 'CS3724']),
  }),
  CS4644: Object.freeze({
    prerequisite: 'CS 3724',
    grade_statement: 'A grade of C or better is required in prerequisite CS 3724.',
    minimum_grade_codes: Object.freeze(['CS3724']),
  }),
  CS4884: Object.freeze({
    prerequisite: 'CS 3824',
    grade_statement: 'A grade of C or better required in CS prerequisite 3824.',
    minimum_grade_codes: Object.freeze(['CS3824']),
  }),
  CS4264: Object.freeze({
    prerequisite: 'CS 3214 or (ECE 3504 and ECE 3574)',
    grade_statement: 'A grade of C or better is required in prerequisites.',
    minimum_grade_all_prerequisite_courses: true,
  }),
  CS3824: Object.freeze({
    prerequisite: 'CS 3114',
    grade_statement: 'Pre-requisite: Grade of C or better in CS 3114.',
    minimum_grade_codes: Object.freeze(['CS3114']),
  }),
});

function extractVirginiaTechRequiredClauses(candidate) {
  if (candidate?.source?.retained_source_contract !== VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT) {
    return { clauses: [], ignored: [] };
  }
  const text = candidate.source.raw_entry_text;
  const marker = /\b(Prerequisite\(s\)|Corequisite\(s\)|Corequisites):\s*/gi;
  const matches = [...text.matchAll(marker)];
  // A corequisite-only entry is deliberately not promoted into the required-
  // prerequisite graph. Its source silence remains distinct from "none".
  if (!matches.some((match) => /^Prerequisite/i.test(match[1]))) {
    return { clauses: [], ignored: [] };
  }
  const clauses = [];
  matches.forEach((labelMatch, index) => {
    const start = labelMatch.index + labelMatch[0].length;
    const nextMarker = matches[index + 1]?.index ?? text.length;
    const region = text.slice(start, nextMarker);
    const terminal = region.search(/\s+(?:Pathway Concept Area\(s\)|Instructional Contact Hours|Course Crosslist|Repeatability):/i);
    const end = terminal >= 0 ? start + terminal : nextMarker;
    const bounded = text.slice(start, end);
    const raw = bounded.trim();
    if (!raw) return;
    const relativeStart = start + bounded.indexOf(raw);
    const corequisite = /^Corequisite/i.test(labelMatch[1]);
    clauses.push({
      kind: corequisite ? 'corequisite' : 'prerequisite',
      label: labelMatch[1],
      ...(corequisite ? { concurrent_allowed: true } : {}),
      raw,
      relative_start: relativeStart,
      relative_end: relativeStart + raw.length,
      statement_relative_start: labelMatch.index,
      statement_relative_end: relativeStart + raw.length,
    });
  });
  return { clauses, ignored: [] };
}

function tokenizeVirginiaTechStrictFormula(candidate, clause) {
  const contract = VIRGINIA_TECH_STRICT_FORMULA_CONTRACTS[candidate.course_code];
  const key = clause.kind === 'corequisite' ? 'corequisite' : 'prerequisite';
  if (!contract || contract[key] !== clause.raw.replace(/[.]\s*$/, '').trim()) {
    throw new Error('Virginia Tech clause is outside the pinned clean-formula roster');
  }
  let tokens = tokenizeCourseOnly(clause.raw, candidate.owner_namespace);
  if (contract.grade_statement) {
    const entry = String(candidate?.source?.raw_entry_text || '');
    const first = entry.indexOf(contract.grade_statement);
    if (first < 0 || entry.indexOf(contract.grade_statement, first + 1) >= 0) {
      throw new Error('Virginia Tech exact grade statement is absent or non-unique');
    }
    const gradeCodes = new Set(contract.minimum_grade_codes || []);
    const matched = new Set();
    tokens = tokens.map((token) => {
      if (token.type !== 'atom' || token.condition.type !== 'course') return token;
      const receivesGrade = key === 'prerequisite' && (
        contract.minimum_grade_all_prerequisite_courses
          || gradeCodes.has(token.condition.code)
      );
      if (!receivesGrade) return token;
      matched.add(token.condition.code);
      return {
        ...token,
        condition: {
          ...token.condition,
          minimum_grade: 'C',
          minimum_grade_evidence: {
            kind: 'exact_full_entry_grade_statement',
            raw: contract.grade_statement,
            raw_sha256: sha256(contract.grade_statement),
          },
        },
      };
    });
    if (key === 'prerequisite' && !contract.minimum_grade_all_prerequisite_courses
        && [...gradeCodes].some((code) => !matched.has(code))) {
      throw new Error('Virginia Tech grade statement names a course outside the prerequisite clause');
    }
  }
  parseBooleanTokens(tokens);
  return tokens;
}

function extractRequiredClauses(candidate) {
  if (candidate?.source?.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT) {
    if (virginiaTechGraduateCsEntryIssue({
      ...candidate.source,
      slug: candidate.slug,
      owner_namespace: candidate.owner_namespace,
      course_key: candidate.course_key,
      course_code: candidate.course_code,
    })) return { clauses: [], ignored: [] };
    const receipt = candidate.source.required_requisite_clause;
    if (!receipt) return { clauses: [], ignored: [] };
    if (receipt.receipt_contract !== VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT) {
      return { clauses: [], ignored: [] };
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  if (candidate?.source?.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT) {
    const receipt = candidate.source.required_requisite_clause;
    if (cnuCpen371wEntryIssue({
      ...candidate.source,
      slug: candidate.slug,
      owner_namespace: candidate.owner_namespace,
      course_key: candidate.course_key,
      course_code: candidate.course_code,
    }) || receipt?.receipt_contract !== CNU_CLAUSE_RECEIPT_CONTRACT) {
      return { clauses: [], ignored: [] };
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  if (candidate?.source?.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT) {
    if (vsuArabicEntryIssue({
      ...candidate.source,
      slug: candidate.slug,
      owner_namespace: candidate.owner_namespace,
      course_key: candidate.course_key,
      course_code: candidate.course_code,
    })) return { clauses: [], ignored: [] };
    const receipt = candidate.source.required_requisite_clause
      || candidate.source.enrollment_restriction;
    if (!receipt || ![
      VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
      VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
    ].includes(receipt.receipt_contract)) return { clauses: [], ignored: [] };
    const restriction = receipt.receipt_contract
      === VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT;
    return {
      clauses: [{
        kind: 'prerequisite',
        label: restriction ? 'Enrollment restriction' : receipt.label,
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: restriction
          ? receipt.relative_start : receipt.statement_relative_start,
        statement_relative_end: restriction
          ? receipt.relative_end : receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  if (candidate?.source?.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT) {
    const receipt = candidate.source.required_requisite_clause;
    if (!receipt) return { clauses: [], ignored: [] };
    if (receipt.receipt_contract !== SHENANDOAH_CLAUSE_RECEIPT_CONTRACT
        || receipt.kind !== 'prerequisite'
        || sha256(receipt.raw) !== receipt.raw_sha256
        || candidate.source.raw_entry_text.slice(receipt.relative_start, receipt.relative_end)
          !== receipt.raw
        || receipt.statement_relative_end !== receipt.relative_end) {
      return { clauses: [], ignored: [] };
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  if (candidate?.source?.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT) {
    const receipt = candidate.source.required_requisite_clause;
    if (!receipt) return { clauses: [], ignored: [] };
    if (receipt.receipt_contract !== UVA_WISE_CLAUSE_RECEIPT_CONTRACT
        || receipt.kind !== 'prerequisite'
        || sha256(receipt.raw) !== receipt.raw_sha256
        || candidate.source.raw_entry_text.slice(receipt.relative_start, receipt.relative_end)
          !== receipt.raw
        || receipt.statement_relative_end !== receipt.relative_end) {
      return { clauses: [], ignored: [] };
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        raw: receipt.raw,
        relative_start: receipt.relative_start,
        relative_end: receipt.relative_end,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: receipt.statement_relative_end,
      }],
      ignored: [],
    };
  }
  if (candidate?.source?.boundary_contract === RADFORD_BOUNDARY_CONTRACT) {
    const receipt = candidate.source.required_requisite_clause;
    if (!receipt) return { clauses: [], ignored: [] };
    if (receipt.receipt_contract !== RADFORD_CLAUSE_RECEIPT_CONTRACT
        || receipt.kind !== 'prerequisite'
        || sha256(receipt.raw) !== receipt.raw_sha256
        || candidate.source.raw_entry_text.slice(receipt.relative_start, receipt.relative_end)
          !== receipt.raw
        || receipt.statement_relative_end !== receipt.relative_end) {
      return { clauses: [], ignored: [] };
    }
    let raw = receipt.raw;
    let relativeEnd = receipt.relative_end;
    let statementRelativeEnd = receipt.statement_relative_end;
    const ignored = [];
    const encouraged = raw.match(/\s+(Students with credit for MATH 126 Business Calculus or another college level calculus course are encouraged to contact the Department of Mathematics and Statistics for permission\.)$/i);
    if (encouraged) {
      const ignoredRaw = encouraged[1];
      const ignoredStart = receipt.relative_start + encouraged.index
        + encouraged[0].indexOf(ignoredRaw);
      ignored.push({
        kind: 'explicit_encouraged_contact_suffix_not_modeled',
        raw: ignoredRaw,
        relative_start: ignoredStart,
        relative_end: ignoredStart + ignoredRaw.length,
        raw_sha256: sha256(ignoredRaw),
      });
      raw = raw.slice(0, encouraged.index).trim();
      relativeEnd = receipt.relative_start + raw.length;
      statementRelativeEnd = relativeEnd;
    }
    return {
      clauses: [{
        kind: receipt.kind,
        label: receipt.label,
        raw,
        relative_start: receipt.relative_start,
        relative_end: relativeEnd,
        statement_relative_start: receipt.statement_relative_start,
        statement_relative_end: statementRelativeEnd,
      }],
      ignored,
    };
  }
  const text = candidate.source.raw_entry_text;
  const clauses = [];
  const ignored = [];
  const internalComponents = [];
  let match;
  switch (candidate.slug) {
    case BRIDGEWATER_SLUG: {
      return extractBridgewaterRequiredClauses(candidate);
    }
    case LONGWOOD_SLUG: {
      return extractLongwoodRequiredClauses(candidate);
    }
    case 'christopher-newport-university': {
      return extractCnuRequiredClauses(candidate);
    }
    case 'george-mason-university': {
      match = text.match(/(Required Prerequisites?):\s*([\s\S]*?)(?=\.\* May be taken concurrently|\.(?:C-|C|D|XS|XP|T|A) Requires minimum grade|\.Students with|\.Enrollment|\.Schedule Type|$)/i);
      if (match) clauses.push({
        kind: 'prerequisite', label: match[1], ...spanFromMatch(text, match, 2),
      });
      if (/Recommended (?:Pre|Co)requisite:/i.test(text)) ignored.push('recommended_requisite_not_required');
      break;
    }
    case 'norfolk-state-university': {
      match = text.match(/Prerequisites?:\s*([\s\S]*?)\s*$/i);
      if (match) clauses.push({ kind: 'prerequisite', label: match[0].split(':')[0], ...spanFromMatch(text, match) });
      break;
    }
    case 'old-dominion-university': {
      match = text.match(/Prerequisites?:\s*([\s\S]*?)(?=\s+(?:Pre-?\s*or\s*corequisite|Corequisites?):|\s*$)/i);
      if (match) clauses.push({ kind: 'prerequisite', label: 'Prerequisites', ...spanFromMatch(text, match) });
      const concurrent = text.match(/Pre-?\s*or\s*corequisite:\s*([\s\S]*?)\s*$/i);
      if (concurrent) clauses.push({
        kind: 'prerequisite', label: 'Pre- or corequisite', concurrent_allowed: true,
        ...spanFromMatch(text, concurrent),
      });
      const coreq = text.match(/(?<!or )Corequisites?:\s*([\s\S]*?)\s*$/i);
      if (coreq) clauses.push({
        kind: 'corequisite', label: 'Corequisites', ...spanFromMatch(text, coreq),
      });
      for (const clause of clauses) {
        const optionalSupport = clause.raw.match(/;\s*(Additional support may be provided by the Monarch Internship and Co-Op Office in the semester prior to enrollment)$/i);
        if (optionalSupport) {
          const ignoredRaw = optionalSupport[1];
          const ignoredStart = clause.relative_start + optionalSupport.index
            + optionalSupport[0].indexOf(ignoredRaw);
          ignored.push({
            kind: 'explicit_optional_support_suffix_not_modeled',
            raw: ignoredRaw,
            relative_start: ignoredStart,
            relative_end: ignoredStart + ignoredRaw.length,
            raw_sha256: sha256(ignoredRaw),
          });
          clause.raw = clause.raw.slice(0, optionalSupport.index).trim();
          clause.relative_end = clause.relative_start + clause.raw.length;
          clause.statement_relative_end = clause.relative_end;
        }
        const nonrequired = clause.raw.search(/;\s*[^;]*(?:\b(?:strongly\s+)?recommended\b|\bno prior knowledge\b)[\s\S]*$/i);
        if (nonrequired < 0) continue;
        ignored.push('explicit_nonrequired_suffix_not_modeled');
        clause.raw = clause.raw.slice(0, nonrequired).trim();
        clause.relative_end = clause.relative_start + clause.raw.length;
        clause.statement_relative_end = clause.relative_end;
      }
      break;
    }
    case 'randolph-macon-college': {
      match = text.match(/Prerequisite\(s\):\s*([\s\S]*?)(?=\s+Curriculum:|\s*$)/i);
      if (match) clauses.push({ kind: 'prerequisite', label: 'Prerequisite(s)', ...spanFromMatch(text, match) });
      break;
    }
    case 'university-of-mary-washington': {
      match = text.match(/Prerequisites?:\s*([^.]*)\./i);
      if (match) clauses.push({ kind: 'prerequisite', label: 'Prerequisite', ...spanFromMatch(text, match) });
      break;
    }
    case 'virginia-commonwealth-university': {
      match = text.match(/Prerequisites?:\s*([^.]*)\./i);
      if (match) clauses.push({ kind: 'prerequisite', label: 'Prerequisite', ...spanFromMatch(text, match) });
      const coreq = text.match(/Corequisite:\s*([^.]*)\./i);
      if (coreq) clauses.push({ kind: 'corequisite', label: 'Corequisite', ...spanFromMatch(text, coreq) });
      break;
    }
    case 'virginia-state-university': {
      const marker = /(?:Pre-?requisite(?:s|\(s\)|s\(s\))?|Co-?requisite(?:s|\(s\))?)\s*:/ig;
      const matches = [...text.matchAll(marker)];
      matches.forEach((labelMatch, index) => {
        const start = labelMatch.index + labelMatch[0].length;
        const end = matches[index + 1]?.index ?? text.length;
        const value = text.slice(start, end).trim();
        const clause = {
          kind: /^co/i.test(labelMatch[0]) ? 'corequisite' : 'prerequisite',
          label: labelMatch[0].slice(0, -1),
          raw: value,
          relative_start: start + text.slice(start, end).indexOf(value),
          relative_end: start + text.slice(start, end).indexOf(value) + value.length,
          statement_relative_start: labelMatch.index,
          statement_relative_end: start + text.slice(start, end).indexOf(value) + value.length,
        };
        const internal = vsuBiol121InternalComponent(candidate, clause);
        if (internal) internalComponents.push(internal);
        else clauses.push(clause);
      });
      break;
    }
    case 'william-mary': {
      match = text.match(/Prerequisite\(s\):\s*([\s\S]*?)(?=\s+College Curriculum:|\s+Domain:|\s*$)/i);
      if (match) clauses.push({ kind: 'prerequisite', label: 'Prerequisite(s)', ...spanFromMatch(text, match) });
      const coreq = text.match(/Corequisite\(s\):\s*([\s\S]*?)(?=\s+College Curriculum:|\s+Domain:|\s*$)/i);
      if (coreq) clauses.push({ kind: 'corequisite', label: 'Corequisite(s)', ...spanFromMatch(text, coreq) });
      break;
    }
    case JMU_SLUG: {
      return exactBrowserCourseLeafRequiredClauses(candidate);
    }
    case VIRGINIA_TECH_SLUG: {
      if (candidate.source.browser_challenge_contract === BROWSER_CHALLENGE_CONTRACT) {
        return exactBrowserCourseLeafRequiredClauses(candidate);
      }
      return extractVirginiaTechRequiredClauses(candidate);
    }
    default:
      break;
  }
  return { clauses, ignored, internal_components: internalComponents };
}

function isExplicitNone(clause) {
  return /^(?:none|no prerequisites?|not required|n\/a)[.]?$/i.test(String(clause?.raw || '').trim());
}

function parseClause(candidate, clause) {
  const { owner_namespace: owner, course_key: courseKey } = candidate;
  let tokens;
  const flags = ['strict_full_text_accounting', `source:${candidate.slug}`];
  const strictRejectionAudit = strictFormulaRejectionAuditReceipt(candidate, [clause]);
  if (strictRejectionAudit.applicable) {
    tokens = auditedStrictFormulaTokens(candidate, strictRejectionAudit);
    parseBooleanTokens(tokens);
    flags.push('source_bound_strict_formula_rejection_audit');
    flags.push(strictRejectionAudit.strategy);
  } else if (candidate.source.boundary_contract === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT) {
    if (candidate.course_code !== 'CS5114'
        || clause.kind !== 'prerequisite'
        || clause.label !== 'Pre'
        || clause.raw !== 'CS3114') {
      throw new Error('Virginia Tech graduate CS exact prerequisite clause changed');
    }
    tokens = oneCourseToken('CS3114', owner);
    flags.push('virginia_tech_current_graduate_cs_exact_heading_entry');
    flags.push('virginia_tech_cs5114_exact_pre_cs3114');
  } else if (candidate.source.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT) {
    if (candidate.course_code !== 'CPEN371W'
        || clause.kind !== 'prerequisite'
        || clause.raw !== 'ENGL 223 with a C- or higher; major or minor in PCSE') {
      throw new Error('CNU CPEN371W exact-target formula changed');
    }
    tokens = joinTokenLists(
      oneCourseToken('ENGL 223', owner, {
        raw: 'ENGL 223 with a C- or higher',
        minimum_grade: 'C-',
        minimum_grade_evidence: {
          kind: 'exact_full_entry_grade_statement',
          raw: 'ENGL 223 with a C- or higher',
          raw_sha256: sha256('ENGL 223 with a C- or higher'),
        },
      }),
      'and',
      oneNonCourseToken('pcse_major_or_minor', 'major or minor in PCSE', {
        academic_program: 'PCSE',
        eligible_academic_program_roles: ['major', 'minor'],
      }),
    );
    flags.push('cnu_cpen371w_exact_target_only_alias_formula');
    flags.push('cnu_current_degree_identity_join');
  } else if (candidate.source.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT) {
    if (candidate.course_code === 'ARAB110') {
      if (clause.kind !== 'prerequisite'
          || clause.raw
            !== 'open to those students presenting no admission credit in Arabic') {
        throw new Error('VSU ARAB110 enrollment restriction changed');
      }
      tokens = oneNonCourseToken(
        'no_admission_credit_in_arabic', clause.raw, {
          admission_credit_subject: 'Arabic',
          admission_credit_allowed: false,
        },
      );
      flags.push('vsu_arab110_exact_noncourse_enrollment_restriction');
    } else {
      if (clause.kind !== 'prerequisite') {
        throw new Error('VSU Arabic formal prerequisite kind changed');
      }
      tokens = tokenizeVsuStructuredFormula(clause.raw, owner);
      parseBooleanTokens(tokens);
      flags.push('vsu_arabic_exact_course_or_equivalent_formula');
    }
  } else if (candidate.slug === BRIDGEWATER_SLUG
      && candidate.source.boundary_contract === BRIDGEWATER_BOUNDARY_CONTRACT) {
    tokens = tokenizeBridgewaterStrictFormula(clause.raw, owner);
    parseBooleanTokens(tokens);
    flags.push('bridgewater_exact_cleancatalog_formula_grammar');
  } else if (candidate.slug === LONGWOOD_SLUG
      && [LONGWOOD_BOUNDARY_CONTRACT, LONGWOOD_BANNER_BOUNDARY_CONTRACT]
        .includes(candidate.source.boundary_contract)) {
    tokens = tokenizeLongwoodStrictFormula(clause.raw, owner);
    flags.push(candidate.source.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT
      ? 'longwood_exact_banner_clause_formula_grammar'
      : 'longwood_exact_department_clause_formula_grammar');
    flags.push('comma_lists_are_conjunctive');
  } else if (candidate.slug === UVA_WISE_SLUG
      && candidate.source.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT) {
    tokens = tokenizeUvaWiseStrictFormula(clause.raw, owner);
    flags.push('uva_wise_exact_acalog_atom_local_grade_and_standing_grammar');
  } else if (candidate.slug === RADFORD_SLUG
      && candidate.source.boundary_contract === RADFORD_BOUNDARY_CONTRACT) {
    tokens = tokenizeRadfordStrictFormula(clause.raw, owner);
    parseBooleanTokens(tokens);
    flags.push('radford_exact_acalog_clause_formula_grammar');
  } else if (candidate.slug === SHENANDOAH_SLUG
      && candidate.source.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT) {
    tokens = tokenizeShenandoahStrictFormula(clause.raw, owner);
    parseBooleanTokens(tokens);
    flags.push('shenandoah_exact_acalog_or_of_and_formula_grammar');
  } else if (candidate.slug === JMU_SLUG
      && candidate.source.browser_challenge_contract === BROWSER_CHALLENGE_CONTRACT) {
    tokens = tokenizeJmuBrowserStrictFormula(candidate, clause);
    parseBooleanTokens(tokens);
    flags.push('jmu_pinned_browser_courseleaf_formula_grammar');
    flags.push('jmu_exact_grade_major_placement_scope');
  } else if (candidate.slug === VIRGINIA_TECH_SLUG
      && candidate.source.browser_challenge_contract === BROWSER_CHALLENGE_CONTRACT) {
    tokens = tokenizeVirginiaTechBrowserStrictFormula(candidate, clause);
    flags.push('virginia_tech_exact_structured_browser_courseleaf_formula_grammar');
  } else if (candidate.slug === VIRGINIA_TECH_SLUG
      && candidate.source.retained_source_contract
        === VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT) {
    tokens = tokenizeVirginiaTechStrictFormula(candidate, clause);
    flags.push('virginia_tech_pinned_retained_courseblock_clean_formula_grammar');
    if (tokens.some((token) => (
      token.type === 'atom' && token.condition.minimum_grade_evidence
    ))) {
      flags.push('virginia_tech_exact_full_entry_grade_statement');
    }
  } else if (candidate.slug === 'george-mason-university') {
    tokens = tokenizeGmu(clause.raw, owner);
    flags.push('gmu_structured_registration_formula');
  } else if (candidate.slug === 'norfolk-state-university') {
    tokens = tokenizeNsuTake(clause.raw, owner);
    flags.push('nsu_take_sentences_are_conjunctive');
  } else {
    if (candidate.slug === 'randolph-macon-college'
        && /\band\b/i.test(clause.raw)
        && /\bor\b/i.test(clause.raw)
        && !/\b(?:either|one of)\b/i.test(clause.raw)
        && !/[()]/.test(clause.raw)) {
      throw new Error('mixed AND/OR source text has no explicit grouping');
    }
    try {
      tokens = tokenizeCourseOnly(clause.raw, owner);
      parseBooleanTokens(tokens);
      flags.push('course_codes_and_explicit_boolean_operators_only');
    } catch (courseOnlyError) {
      try {
        tokens = tokenizeStrictGradeFormula(clause.raw, owner);
        parseBooleanTokens(tokens);
        flags.push('strict_explicit_grade_scope');
      } catch (gradeError) {
        try {
          if (candidate.slug === 'old-dominion-university') {
            tokens = tokenizeOduStructuredFormula(clause.raw, owner);
            flags.push('odu_explicit_choice_and_grade_scope');
            if (ODU_PINNED_WHOLE_CLAUSE_VALUES.includes(
              String(clause.raw || '').trim().replace(/[.]\s*$/, '').trim(),
            )) {
              flags.push('odu_exact_whole_clause_formula_roster');
            }
          } else if (candidate.slug === 'randolph-macon-college') {
            tokens = tokenizeRmcStructuredFormula(clause.raw, owner);
            flags.push(/^Senior status and departmental approval[.]?$/i.test(clause.raw)
              ? 'rmc_typed_standing_and_departmental_approval'
              : 'literal_either_or_one_of_scope');
          } else if (candidate.slug === 'university-of-mary-washington') {
            tokens = tokenizeExplicitChoiceFormula(clause.raw, owner);
            flags.push('literal_either_or_one_of_scope');
          } else if (candidate.slug === 'virginia-state-university') {
            tokens = tokenizeVsuStructuredFormula(clause.raw, owner);
            const sharedMinimumGrade = /^[“"]C[”"] or better in [A-Z]{2,8}[ -]?\d{2,4}[A-Z]? and in [A-Z]{2,8}[ -]?\d{2,4}[A-Z]?[.]?$/i
              .test(clause.raw);
            const typed = tokens.some((token) => (
              token.type === 'atom' && (
                token.condition.type === 'non_course'
                  || token.condition.referenced_course_published_semester_hours != null
              )
            ));
            flags.push(sharedMinimumGrade
              ? 'vsu_explicit_shared_minimum_grade'
              : (typed
                ? 'vsu_catalog_titles_and_typed_noncourse_atoms'
                : 'vsu_catalog_titles_between_explicit_course_atoms'));
            if (!typed && /;/.test(clause.raw) && /\bor\b/i.test(clause.raw)) {
              flags.push('vsu_semicolon_delimits_conjunctive_groups');
            }
          } else if (candidate.slug === 'virginia-commonwealth-university') {
            tokens = tokenizeVcuStructuredFormula(clause.raw, owner);
            flags.push('vcu_atom_local_minimum_grades');
          } else if (candidate.slug === 'christopher-newport-university') {
            tokens = tokenizeCnuStrictFormula(clause.raw, owner);
            flags.push('cnu_exact_pdf_formula_grammar');
            const normalizedCnuClause = String(clause.raw || '')
              .replace(/\s+/g, ' ').trim().replace(/[.]\s*$/, '');
            if (CNU_PINNED_WHOLE_CLAUSE_VALUES.includes(normalizedCnuClause)) {
              flags.push('cnu_exact_whole_clause_formula_roster');
            }
            if (normalizedCnuClause === CNU_PINNED_WHOLE_CLAUSE_FORMULAS.MATH140) {
              flags.push('cnu_embedded_course_preference_explicitly_not_modeled');
            }
          } else {
            throw new Error('no institution-specific strict grammar matched');
          }
          parseBooleanTokens(tokens);
        } catch (institutionError) {
          throw new Error(`${courseOnlyError.message}; ${gradeError.message}; ${institutionError.message}`);
        }
      }
    }
  }
  if (clause.concurrent_allowed) {
    tokens = tokens.map((token) => token.type === 'atom' && (
      token.condition.type === 'course' || token.condition.represents_course_choice === true
    )
      ? { ...token, condition: { ...token.condition, concurrent_allowed: true } }
      : token);
  }
  return formulaGroup({ owner, courseKey, kind: clause.kind, raw: clause.raw, tokens, flags });
}

function baseEvidence(candidate, clauses) {
  return {
    candidate_row_status: candidate.row_status,
    official_url: candidate.source.official_url,
    declared_normalized_text_sha256: candidate.source.declared_normalized_text_sha256,
    retained_normalized_text_sha256: candidate.source.retained_normalized_text_sha256,
    entry_character_start: candidate.source.character_start,
    entry_character_end: candidate.source.character_end,
    heading_text: candidate.source.heading_text,
    raw_entry_sha256: candidate.source.raw_entry_sha256,
    raw_entry_text: candidate.source.raw_entry_text,
    ...(candidate.source.source_format === 'pdf_bbox_columns' ? {
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      pdf_sha256: candidate.source.pdf_sha256,
      bbox_layout_sha256: candidate.source.bbox_layout_sha256,
      pdftotext_version: candidate.source.pdftotext_version,
      published_units: candidate.source.published_units,
      pdf_page_start: candidate.source.pdf_page_start,
      pdf_page_end: candidate.source.pdf_page_end,
      page_column_span: candidate.source.page_column_span,
      source_blocks: candidate.source.source_blocks,
      ...(candidate.source.boundary_contract === CNU_COMPOUND_BOUNDARY_CONTRACT ? {
        compound_entry: candidate.source.compound_entry,
        compound_receipt_contract: candidate.source.compound_receipt_contract,
        compound_receipt_sha256: candidate.source.compound_receipt_sha256,
        compound_heading_course_codes: candidate.source.compound_heading_course_codes,
        compound_member_requisite: candidate.source.compound_member_requisite,
        compound_sibling_requisites: candidate.source.compound_sibling_requisites,
      } : {}),
    } : {}),
    ...(candidate.source.source_format === 'cleancatalog_course_page' ? {
      capture_origin: candidate.source.capture_origin,
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      canonical_path: candidate.source.canonical_path,
      published_units: candidate.source.published_units,
      requisite_field_receipt: candidate.source.requisite_field_receipt,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      edition_response_sha256: candidate.source.edition_response_sha256,
      edition_cache_path: candidate.source.edition_cache_path,
      edition_catalog_year: candidate.source.edition_catalog_year,
      edition_path: candidate.source.edition_path,
      edition_exact_year_statement: candidate.source.edition_exact_year_statement,
      edition_normalized_main_text_sha256:
        candidate.source.edition_normalized_main_text_sha256,
    } : {}),
    ...(candidate.source.source_format === 'longwood_department_course_listing' ? {
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      published_units: candidate.source.published_units,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      department_page_catalog_year_statement:
        candidate.source.department_page_catalog_year_statement,
      catalog_context_contract: candidate.source.catalog_context_contract,
      catalog_context_official_url: candidate.source.catalog_context_official_url,
      catalog_context_html_cache_path: candidate.source.catalog_context_html_cache_path,
      catalog_context_text_cache_path: candidate.source.catalog_context_text_cache_path,
      catalog_context_html_sha256: candidate.source.catalog_context_html_sha256,
      catalog_context_normalized_text_sha256:
        candidate.source.catalog_context_normalized_text_sha256,
      catalog_context_relevant_sha256: candidate.source.catalog_context_relevant_sha256,
      catalog_context_catalog_year: candidate.source.catalog_context_catalog_year,
      catalog_context_catoid: candidate.source.catalog_context_catoid,
      two_source_edition_boundary: candidate.source.two_source_edition_boundary,
      two_source_binding_note: candidate.source.two_source_binding_note,
    } : {}),
    ...(candidate.source.source_format === 'longwood_banner_course_listing' ? {
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      published_units: candidate.source.published_units,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      department_page_catalog_year_statement:
        candidate.source.department_page_catalog_year_statement,
      catalog_context_contract: candidate.source.catalog_context_contract,
      catalog_context_official_url: candidate.source.catalog_context_official_url,
      catalog_context_html_cache_path: candidate.source.catalog_context_html_cache_path,
      catalog_context_text_cache_path: candidate.source.catalog_context_text_cache_path,
      catalog_context_html_sha256: candidate.source.catalog_context_html_sha256,
      catalog_context_normalized_text_sha256:
        candidate.source.catalog_context_normalized_text_sha256,
      catalog_context_relevant_sha256: candidate.source.catalog_context_relevant_sha256,
      catalog_context_catalog_year: candidate.source.catalog_context_catalog_year,
      catalog_context_catoid: candidate.source.catalog_context_catoid,
      two_source_edition_boundary: candidate.source.two_source_edition_boundary,
      two_source_binding_note: candidate.source.two_source_binding_note,
    } : {}),
    ...(candidate.source.source_format === 'courseleaf_courseblock' ? {
      capture_origin: candidate.source.capture_origin,
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      catalog_year_verified: candidate.source.catalog_year_verified,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      courseblock_index: candidate.source.courseblock_index,
      published_units: candidate.source.published_units,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      complete_entry_receipt: candidate.source.complete_entry_receipt,
      structured_requisite_fields: candidate.source.structured_requisite_fields,
      ...(candidate.source.cache_reacquisition_receipt ? {
        cache_reacquisition_receipt: candidate.source.cache_reacquisition_receipt,
      } : {}),
      ...(candidate.source.retained_source_contract ? {
        retained_source_contract: candidate.source.retained_source_contract,
        retained_source_text_cache_path:
          candidate.source.retained_source_text_cache_path,
        retained_source_text_sha256:
          candidate.source.retained_source_text_sha256,
        live_recapture_claim: candidate.source.live_recapture_claim,
      } : {}),
      ...(candidate.source.browser_challenge_contract ? {
        target_subject_prefix: candidate.source.target_subject_prefix,
        browser_challenge_contract: candidate.source.browser_challenge_contract,
        browser_challenge_receipt: candidate.source.browser_challenge_receipt,
        robots_receipt: candidate.source.robots_receipt,
        sitemap_discovery_receipt: candidate.source.sitemap_discovery_receipt,
      } : {}),
    } : {}),
    ...(candidate.source.source_format === 'radford_acalog_course_page' ? {
      capture_origin: candidate.source.capture_origin,
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      catalog_year_verified: candidate.source.catalog_year_verified,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      catoid: candidate.source.catoid,
      coid: candidate.source.coid,
      published_units: candidate.source.published_units,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      required_requisite_clause: candidate.source.required_requisite_clause,
      pre_or_corequisite_clause: candidate.source.pre_or_corequisite_clause,
      formal_requisite_marker_count: candidate.source.formal_requisite_marker_count,
      discovery_contract: candidate.source.discovery_contract,
      discovery_cache_path: candidate.source.discovery_cache_path,
      discovery_response_sha256: candidate.source.discovery_response_sha256,
      discovery_link_receipt: candidate.source.discovery_link_receipt,
      robots_crawl_delay_seconds: candidate.source.robots_crawl_delay_seconds,
    } : {}),
    ...(candidate.source.source_format === 'uva_wise_acalog_course_page' ? {
      capture_origin: candidate.source.capture_origin,
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      catalog_year_verified: candidate.source.catalog_year_verified,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      catoid: candidate.source.catoid,
      coid: candidate.source.coid,
      published_units: candidate.source.published_units,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      required_requisite_clause: candidate.source.required_requisite_clause,
      formal_requisite_marker_count: candidate.source.formal_requisite_marker_count,
      discovery_contract: candidate.source.discovery_contract,
      discovery_cache_path: candidate.source.discovery_cache_path,
      discovery_response_sha256: candidate.source.discovery_response_sha256,
      discovery_program_cache_path: candidate.source.discovery_program_cache_path,
      discovery_program_response_sha256: candidate.source.discovery_program_response_sha256,
      discovery_ge_cache_path: candidate.source.discovery_ge_cache_path,
      discovery_ge_response_sha256: candidate.source.discovery_ge_response_sha256,
      discovery_link_receipt: candidate.source.discovery_link_receipt,
      robots_crawl_delay_seconds: candidate.source.robots_crawl_delay_seconds,
      http_exception_contract: candidate.source.http_exception_contract,
    } : {}),
    ...(candidate.source.source_format === 'shenandoah_acalog_course_page' ? {
      capture_origin: candidate.source.capture_origin,
      source_format: candidate.source.source_format,
      boundary_contract: candidate.source.boundary_contract,
      catalog_year_verified: candidate.source.catalog_year_verified,
      source_response_sha256: candidate.source.source_response_sha256,
      source_response_bytes: candidate.source.source_response_bytes,
      cache_path: candidate.source.cache_path,
      catoid: candidate.source.catoid,
      coid: candidate.source.coid,
      published_units: candidate.source.published_units,
      raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
      required_requisite_clause: candidate.source.required_requisite_clause,
      formal_corequisite_marker_count: candidate.source.formal_corequisite_marker_count,
      discovery_contract: candidate.source.discovery_contract,
      discovery_cache_path: candidate.source.discovery_cache_path,
      discovery_response_sha256: candidate.source.discovery_response_sha256,
      discovery_link_receipt: candidate.source.discovery_link_receipt,
      robots_crawl_delay_seconds: candidate.source.robots_crawl_delay_seconds,
    } : {}),
    ...(candidate.source.source_format
        === 'virginia_tech_current_graduate_cs_heading_entry' ? {
        capture_origin: candidate.source.capture_origin,
        source_format: candidate.source.source_format,
        boundary_contract: candidate.source.boundary_contract,
        source_current_contract: candidate.source.source_current_contract,
        catalog_year_verified: candidate.source.catalog_year_verified,
        source_response_sha256: candidate.source.source_response_sha256,
        source_response_bytes: candidate.source.source_response_bytes,
        cache_path: candidate.source.cache_path,
        robots_official_url: candidate.source.robots_official_url,
        evidence_cache_path: candidate.source.evidence_cache_path,
        evidence_artifact_sha256: candidate.source.evidence_artifact_sha256,
        robots_response_sha256: candidate.source.robots_response_sha256,
        facts_sha256: candidate.source.facts_sha256,
        source_effective_pubdate: candidate.source.source_effective_pubdate,
        source_captured_on: candidate.source.source_captured_on,
        catalog_edition_claimed: candidate.source.catalog_edition_claimed,
        title: candidate.source.title,
        boundary_start: candidate.source.boundary_start,
        boundary_end: candidate.source.boundary_end,
        next_heading_code: candidate.source.next_heading_code,
        published_units: candidate.source.published_units,
        raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
        formal_prerequisite_marker_count:
          candidate.source.formal_prerequisite_marker_count,
        formal_corequisite_marker_count:
          candidate.source.formal_corequisite_marker_count,
        prerequisite_marker_like_count:
          candidate.source.prerequisite_marker_like_count,
        constraint_like_signal_count: candidate.source.constraint_like_signal_count,
        required_requisite_clause: candidate.source.required_requisite_clause,
        structural_none_evidence: candidate.source.structural_none_evidence,
        semantic_prerequisite: candidate.source.semantic_prerequisite,
      } : {}),
    ...(['cnu_current_joint_identity_pdf_entry', 'vsu_languages_department_courseblock']
      .includes(candidate.source.source_format) ? {
        capture_origin: candidate.source.capture_origin,
        source_format: candidate.source.source_format,
        boundary_contract: candidate.source.boundary_contract,
        catalog_year_verified: candidate.source.catalog_year_verified,
        source_response_sha256: candidate.source.source_response_sha256,
        source_response_bytes: candidate.source.source_response_bytes,
        cache_path: candidate.source.cache_path,
        evidence_cache_path: candidate.source.evidence_cache_path,
        evidence_artifact_sha256: candidate.source.evidence_artifact_sha256,
        robots_response_sha256: candidate.source.robots_response_sha256,
        facts_sha256: candidate.source.facts_sha256,
        title: candidate.source.title,
        published_units: candidate.source.published_units,
        required_requisite_clause: candidate.source.required_requisite_clause,
        semantic_prerequisite: candidate.source.semantic_prerequisite,
        ...(candidate.source.source_format === 'cnu_current_joint_identity_pdf_entry' ? {
          course_boundary_contract: candidate.source.course_boundary_contract,
          program_official_url: candidate.source.program_official_url,
          program_response_sha256: candidate.source.program_response_sha256,
          program_response_bytes: candidate.source.program_response_bytes,
          catalog_raw_text_sha256: candidate.source.catalog_raw_text_sha256,
          physical_pdf_page: candidate.source.physical_pdf_page,
          program_requirement: candidate.source.program_requirement,
          catalog_degree_requirement: candidate.source.catalog_degree_requirement,
          identity_resolution: candidate.source.identity_resolution,
        } : {
          arabic_section_html_sha256: candidate.source.arabic_section_html_sha256,
          arabic_section_courseblock_count:
            candidate.source.arabic_section_courseblock_count,
          raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
          formal_prerequisite_marker_count:
            candidate.source.formal_prerequisite_marker_count,
          enrollment_restriction: candidate.source.enrollment_restriction,
          catalog_silence_inferred_as_no_prerequisite:
            candidate.source.catalog_silence_inferred_as_no_prerequisite,
        }),
      } : {}),
    clauses: clauses.map((clause) => ({
      ...clause,
      source_character_start: candidate.source.character_start + clause.relative_start,
      source_character_end: candidate.source.character_start + clause.relative_end,
      raw_clause_sha256: sha256(clause.raw),
    })),
  };
}

function exactRequisiteSourceText(candidate, clauses) {
  if (!clauses.length) return null;
  const start = Math.min(...clauses.map((clause) => clause.statement_relative_start));
  const end = Math.max(...clauses.map((clause) => clause.statement_relative_end));
  return candidate.source.raw_entry_text.slice(start, end);
}

function explicitNoneEvidence(candidate, clauses) {
  const clause = clauses.find((row) => row.kind === 'prerequisite' && isExplicitNone(row));
  if (!clause) return null;
  return {
    kind: 'official_explicit_none_statement',
    raw_text: candidate.source.raw_entry_text.slice(
      clause.statement_relative_start,
      clause.statement_relative_end,
    ),
    source_content_sha256: candidate.source.raw_entry_sha256,
  };
}

function controlledCourseLeafSilenceEvidence(candidate) {
  const source = candidate?.source || {};
  const receipt = source.complete_entry_receipt;
  const markers = requisiteMarkerCounts(source.raw_entry_text);
  const units = source.published_units;
  if (source.capture_origin !== 'official_acquisition'
      || source.source_format !== 'courseleaf_courseblock'
      || source.boundary_contract !== COURSELEAF_BOUNDARY_CONTRACT
      || source.declared_normalized_text_sha256 !== source.source_response_sha256
      || source.retained_normalized_text_sha256 !== source.source_response_sha256
      || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
      || !Number.isInteger(source.courseblock_index) || source.courseblock_index < 0
      || !units || !(units.credit_hours_min >= 0)
      || units.credit_hours_max < units.credit_hours_min
      || receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
      || receipt.entry_required_requisite_marker_count !== 0
      || receipt.entry_corequisite_marker_count !== 0
      || receipt.entry_requisite_marker_like_count !== 0
      || receipt.entry_constraint_like_signal_count !== 0
      || markers.required !== 0 || markers.corequisite !== 0 || markers.marker_like !== 0
      || markers.constraint_like !== 0
      || receipt.same_source_positive_control !== true
      || !(receipt.source_complete_entries_with_required_requisite_marker_count > 0)
      || !(receipt.source_complete_entry_count > 1)
      || receipt.source_courseblock_count < receipt.source_complete_entry_count) return null;
  return {
    kind: 'official_complete_entry_structural_silence_with_same_source_positive_control',
    course_entry_status: 'published_exact_courseleaf_courseblock',
    finding: 'no_required_prerequisite_marker_in_complete_entry_with_same_response_positive_control',
    literal_none_statement: false,
    boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
    receipt_contract: COURSELEAF_RECEIPT_CONTRACT,
    source_response_sha256: source.source_response_sha256,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    courseblock_index: source.courseblock_index,
    published_units: units,
    marker_control: receipt,
    inference_boundary: 'No prerequisite value is inferred from null, an unbounded cached candidate, or a corequisite-only entry. This row is none only because a complete exact CourseLeaf entry is silent while the same hashed response contains at least one complete entry with an explicit required-prerequisite marker.',
  };
}

function controlledVirginiaTechGraduateCsSilenceEvidence(candidate) {
  const source = candidate?.source || {};
  if (candidate?.course_code !== 'CS5104'
      || source.boundary_contract !== VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT
      || virginiaTechGraduateCsEntryIssue({
        ...source,
        slug: candidate.slug,
        owner_namespace: candidate.owner_namespace,
        course_key: candidate.course_key,
        course_code: candidate.course_code,
      })) return null;
  const receipt = source.structural_none_evidence;
  if (receipt?.receipt_contract
      !== VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT
      || receipt.missing_search_result_used !== false
      || receipt.exact_complete_entry_present !== true
      || receipt.same_page_positive_control !== true
      || receipt.entry_required_prerequisite_marker_count !== 0
      || receipt.entry_corequisite_marker_count !== 0
      || receipt.entry_requisite_marker_like_count !== 0
      || receipt.entry_constraint_like_signal_count !== 0) return null;
  return {
    kind: 'official_current_virginia_tech_graduate_cs_complete_entry_structural_silence',
    course_entry_status: 'published_exact_heading_to_next_heading_entry',
    finding:
      'zero requisite and constraint-like markers in exact complete current entry with same-page Pre-marker positive controls',
    literal_none_statement: false,
    boundary_contract: VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT,
    receipt_contract: VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
    source_response_sha256: source.source_response_sha256,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    evidence_artifact_sha256: source.evidence_artifact_sha256,
    facts_sha256: source.facts_sha256,
    source_effective_pubdate: source.source_effective_pubdate,
    source_captured_on: source.source_captured_on,
    catalog_edition_claimed: false,
    next_heading_code: source.next_heading_code,
    published_units: source.published_units,
    marker_control: receipt,
    inference_boundary: 'This is structural silence in one exact, present, complete first-party heading-to-next-heading entry with 43 same-page Pre-positive entries and 46 Pre markers. It is never inferred from a missing search result and does not claim a literal none statement or catalog edition.',
  };
}

function bridgewaterCleanCatalogMarkerControl(candidates, expectedCourseCodes) {
  const expectedCodes = [...new Set(asArray(expectedCourseCodes).map(normalizeCode).filter(Boolean))]
    .sort();
  if (!expectedCodes.length) return null;
  const rows = asArray(candidates).filter((candidate) => (
    candidate.slug === BRIDGEWATER_SLUG
    && candidate.source?.source_format === 'cleancatalog_course_page'
    && expectedCodes.includes(candidate.course_code)
  )).sort((left, right) => left.course_code.localeCompare(right.course_code));
  if (rows.length !== expectedCodes.length
      || rows.some((row, index) => row.course_code !== expectedCodes[index])) return null;
  const population = [];
  for (const row of rows) {
    const source = row.source || {};
    const receipt = source.requisite_field_receipt;
    const expectedPath = expectedBridgewaterCoursePath(row.course_code);
    let sourceUrl = null;
    try { sourceUrl = new URL(source.official_url); } catch { /* checked below */ }
    const prerequisiteMarkerCount = (
      String(source.raw_entry_text || '').match(/\bPrerequisites?:/gi) || []
    ).length;
    const corequisiteMarkerCount = (
      String(source.raw_entry_text || '').match(/\bCorequisites?:/gi) || []
    ).length;
    if (!expectedPath
        || source.capture_origin !== 'official_cleancatalog_course_page'
        || source.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT
        || source.source_format !== 'cleancatalog_course_page'
        || source.catalog_year_verified !== '2026-2027'
        || source.edition_catalog_year !== source.catalog_year_verified
        || source.edition_path !== BRIDGEWATER_EDITION_PATH
        || source.edition_exact_year_statement
          !== `Course numbers and descriptions listed herein apply to the ${source.catalog_year_verified} academic year.`
        || sourceUrl?.protocol !== 'https:'
        || sourceUrl?.hostname.toLowerCase() !== BRIDGEWATER_HOST
        || sourceUrl?.pathname.replace(/\/$/, '') !== expectedPath
        || source.canonical_path !== expectedPath
        || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.edition_response_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.edition_normalized_main_text_sha256 || '')
        || !source.published_units || !(source.published_units.credit_hours_min > 0)
        || source.published_units.credit_hours_max
          !== source.published_units.credit_hours_min
        || receipt?.receipt_contract !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
        || !Number.isInteger(receipt.field_label_count) || receipt.field_label_count <= 0
        || !/^[a-f0-9]{64}$/.test(receipt.field_labels_sha256 || '')
        || !Number.isInteger(receipt.exact_prerequisite_field_count)
        || receipt.exact_prerequisite_field_count < 0
        || receipt.exact_prerequisite_field_count > 1
        || !Number.isInteger(receipt.exact_corequisite_field_count)
        || receipt.exact_corequisite_field_count < 0
        || receipt.exact_corequisite_field_count > 1
        || receipt.unrecognized_requisite_like_field_count !== 0
        || !Array.isArray(receipt.requisite_fields)
        || receipt.requisite_fields.length !== (
          receipt.exact_prerequisite_field_count + receipt.exact_corequisite_field_count
        )
        || receipt.requisite_fields.some((field) => (
          !/^(?:Pre|Co)requisites?$/i.test(field.label)
          || !Array.isArray(field.values) || !field.values.length
          || sha256(JSON.stringify(field.values)) !== field.values_sha256
        ))
        || prerequisiteMarkerCount !== receipt.exact_prerequisite_field_count
        || corequisiteMarkerCount !== receipt.exact_corequisite_field_count) return null;
    const genericConstraintSignal = hasUnmodeledConstraintSignal(source.raw_entry_text);
    const timingSignals = bridgewaterUnmodeledTimingSignals(source.raw_entry_text);
    population.push({
      course_key: row.course_key,
      canonical_path: source.canonical_path,
      source_response_sha256: source.source_response_sha256,
      raw_entry_sha256: source.raw_entry_sha256,
      raw_entry_html_sha256: source.raw_entry_html_sha256,
      edition_response_sha256: source.edition_response_sha256,
      requisite_field_receipt_sha256: sha256(JSON.stringify(receipt)),
      prerequisite_field_count: receipt.exact_prerequisite_field_count,
      corequisite_field_count: receipt.exact_corequisite_field_count,
      generic_unmodeled_constraint_signal: genericConstraintSignal,
      bridgewater_timing_signals: timingSignals,
    });
  }
  const editionHashes = new Set(population.map((row) => row.edition_response_sha256));
  const positive = population.filter((row) => row.prerequisite_field_count > 0);
  const corequisitePositive = population.filter((row) => row.corequisite_field_count > 0);
  const silent = population.filter((row) => (
    row.prerequisite_field_count === 0 && row.corequisite_field_count === 0
  ));
  const safeSilent = silent.filter((row) => (
    !row.generic_unmodeled_constraint_signal && row.bridgewater_timing_signals.length === 0
  ));
  const blocked = silent.filter((row) => !safeSilent.includes(row));
  if (editionHashes.size !== 1 || !positive.length || !corequisitePositive.length
      || !safeSilent.length || !blocked.length) return null;
  return {
    receipt_contract: BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    catalog_year: '2026-2027',
    edition_response_sha256: [...editionHashes][0],
    exact_complete_entry_count: population.length,
    exact_complete_entries_with_prerequisite_field_count: positive.length,
    exact_complete_entries_with_corequisite_field_count: corequisitePositive.length,
    exact_complete_entries_without_requisite_fields_count: silent.length,
    exact_safe_silent_entry_count: safeSilent.length,
    exact_blocked_constraint_entry_count: blocked.length,
    same_edition_positive_controls: true,
    population_receipts: population,
    population_sha256: sha256(JSON.stringify(population)),
    positive_control_sha256: sha256(JSON.stringify(positive)),
    corequisite_positive_control_sha256: sha256(JSON.stringify(corequisitePositive)),
    positive_control_course_keys: positive.map((row) => row.course_key),
    corequisite_positive_control_course_keys:
      corequisitePositive.map((row) => row.course_key),
    safe_silent_course_keys: safeSilent.map((row) => row.course_key),
    blocked_constraint_course_keys: blocked.map((row) => row.course_key),
  };
}

function controlledBridgewaterCleanCatalogSilenceEvidence(candidate, markerControl) {
  const source = candidate?.source || {};
  const receipt = source.requisite_field_receipt;
  const units = source.published_units;
  const expectedPath = expectedBridgewaterCoursePath(candidate?.course_code);
  if (candidate?.slug !== BRIDGEWATER_SLUG || !expectedPath
      || source.capture_origin !== 'official_cleancatalog_course_page'
      || source.source_format !== 'cleancatalog_course_page'
      || source.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT
      || source.catalog_year_verified !== '2026-2027'
      || source.edition_catalog_year !== source.catalog_year_verified
      || source.edition_path !== BRIDGEWATER_EDITION_PATH
      || source.canonical_path !== expectedPath
      || receipt?.receipt_contract !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
      || receipt.exact_prerequisite_field_count !== 0
      || receipt.exact_corequisite_field_count !== 0
      || receipt.unrecognized_requisite_like_field_count !== 0
      || !Array.isArray(receipt.requisite_fields) || receipt.requisite_fields.length !== 0
      || /\b(?:Pre|Co)requisites?:/i.test(source.raw_entry_text || '')
      || hasUnmodeledConstraintSignal(source.raw_entry_text)
      || bridgewaterUnmodeledTimingSignals(source.raw_entry_text).length
      || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(source.edition_response_sha256 || '')
      || !units || !(units.credit_hours_min > 0)
      || units.credit_hours_max !== units.credit_hours_min
      || markerControl?.receipt_contract
        !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || markerControl.catalog_year !== source.catalog_year_verified
      || markerControl.edition_response_sha256 !== source.edition_response_sha256
      || markerControl.exact_complete_entry_count !== 30
      || markerControl.exact_complete_entries_with_prerequisite_field_count !== 20
      || markerControl.exact_complete_entries_with_corequisite_field_count !== 1
      || markerControl.exact_complete_entries_without_requisite_fields_count !== 10
      || markerControl.exact_safe_silent_entry_count !== 8
      || markerControl.exact_blocked_constraint_entry_count !== 2
      || markerControl.same_edition_positive_controls !== true
      || !markerControl.safe_silent_course_keys?.includes(candidate.course_key)
      || !/^[a-f0-9]{64}$/.test(markerControl.population_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(markerControl.positive_control_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(
        markerControl.corequisite_positive_control_sha256 || '',
      )) return null;
  return {
    kind: BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND,
    course_entry_status: 'published_exact_bridgewater_cleancatalog_course_page',
    finding:
      'no_prerequisite_or_corequisite_field_in_complete_entry_with_same_edition_positive_controls',
    literal_none_statement: false,
    boundary_contract: BRIDGEWATER_BOUNDARY_CONTRACT,
    receipt_contract: BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    source_response_sha256: source.source_response_sha256,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    canonical_path: source.canonical_path,
    edition_response_sha256: source.edition_response_sha256,
    edition_catalog_year: source.edition_catalog_year,
    published_units: units,
    entry_marker_receipt: receipt,
    marker_control: markerControl,
    inference_boundary: 'This means only that the complete official Bridgewater CleanCatalog entry publishes neither a prerequisite nor corequisite field, contains no modeled-or-unmodeled sequencing signal, and belongs to the exact hashed edition population with both prerequisite and corequisite positive controls. It does not infer a literal none statement from a missing field on an unbounded page.',
  };
}

function uvaWiseAcalogMarkerControl(candidates) {
  const expectedCodes = Object.keys(UVA_WISE_DIRECT_COURSE_RECORDS).sort();
  const rows = asArray(candidates).filter((candidate) => (
    candidate.slug === UVA_WISE_SLUG
    && candidate.source?.source_format === 'uva_wise_acalog_course_page'
    && expectedCodes.includes(candidate.course_code)
  )).sort((a, b) => a.course_code.localeCompare(b.course_code));
  if (rows.length !== expectedCodes.length
      || rows.some((row, index) => row.course_code !== expectedCodes[index])) return null;
  const population = [];
  for (const row of rows) {
    const source = row.source || {};
    const expected = UVA_WISE_DIRECT_COURSE_RECORDS[row.course_code];
    if (!expected
        || source.boundary_contract !== UVA_WISE_BOUNDARY_CONTRACT
        || source.catalog_year_verified !== UVA_WISE_CATALOG_YEAR
        || source.catoid !== UVA_WISE_CATOID
        || source.coid !== expected.coid
        || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_sha256 || '')) return null;
    const clause = source.required_requisite_clause;
    if (clause && (clause.receipt_contract !== UVA_WISE_CLAUSE_RECEIPT_CONTRACT
        || sha256(clause.raw) !== clause.raw_sha256)) return null;
    population.push({
      course_key: row.course_key,
      coid: source.coid,
      source_response_sha256: source.source_response_sha256,
      raw_entry_html_sha256: source.raw_entry_html_sha256,
      raw_entry_sha256: source.raw_entry_sha256,
      required_requisite_clause_sha256: clause?.raw_sha256 || null,
    });
  }
  const positive = population.filter((row) => row.required_requisite_clause_sha256);
  const silent = population.length - positive.length;
  if (!positive.length || !silent) return null;
  return {
    receipt_contract: UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    catalog_year: UVA_WISE_CATALOG_YEAR,
    catoid: UVA_WISE_CATOID,
    exact_complete_entry_count: population.length,
    exact_complete_entries_with_required_requisite_marker_count: positive.length,
    exact_complete_entries_without_required_requisite_marker_count: silent,
    same_catalog_positive_control: true,
    population_sha256: sha256(JSON.stringify(population)),
    positive_control_sha256: sha256(JSON.stringify(positive)),
    positive_control_course_keys: positive.map((row) => row.course_key),
  };
}

function controlledUvaWiseAcalogSilenceEvidence(candidate, markerControl) {
  const source = candidate?.source || {};
  const expected = UVA_WISE_DIRECT_COURSE_RECORDS[candidate?.course_code];
  const units = source.published_units;
  if (candidate?.slug !== UVA_WISE_SLUG || !expected
      || source.capture_origin !== 'official_uva_wise_acalog_course_page'
      || source.source_format !== 'uva_wise_acalog_course_page'
      || source.boundary_contract !== UVA_WISE_BOUNDARY_CONTRACT
      || source.catalog_year_verified !== UVA_WISE_CATALOG_YEAR
      || source.catoid !== UVA_WISE_CATOID || source.coid !== expected.coid
      || source.required_requisite_clause !== null
      || /\bPrerequisites?\b/i.test(source.raw_entry_text || '')
      || hasUnmodeledConstraintSignal(source.raw_entry_text)
      || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
      || !units || !(units.credit_hours_min > 0)
      || units.credit_hours_max < units.credit_hours_min
      || markerControl?.receipt_contract
        !== UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || markerControl.catalog_year !== UVA_WISE_CATALOG_YEAR
      || markerControl.catoid !== UVA_WISE_CATOID
      || markerControl.exact_complete_entry_count !== Object.keys(
        UVA_WISE_DIRECT_COURSE_RECORDS,
      ).length
      || !(markerControl.exact_complete_entries_with_required_requisite_marker_count > 0)
      || !(markerControl.exact_complete_entries_without_required_requisite_marker_count > 0)
      || markerControl.same_catalog_positive_control !== true
      || !/^[a-f0-9]{64}$/.test(markerControl.population_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(markerControl.positive_control_sha256 || '')) return null;
  return {
    kind: 'official_complete_entry_structural_silence_with_same_catalog_positive_control',
    course_entry_status: 'published_exact_uva_wise_acalog_course_page',
    finding: 'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control',
    literal_none_statement: false,
    boundary_contract: UVA_WISE_BOUNDARY_CONTRACT,
    receipt_contract: UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    source_response_sha256: source.source_response_sha256,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    catoid: source.catoid,
    coid: source.coid,
    published_units: units,
    marker_control: markerControl,
    inference_boundary: 'This means only that the complete official UVA Wise Acalog entry publishes no required-prerequisite field. It does not infer a literal none statement, erase enrollment restrictions, or generalize from a null or unbounded candidate.',
  };
}

function shenandoahAcalogMarkerControl(candidates) {
  const expectedCodes = Object.keys(SHENANDOAH_DIRECT_COURSE_RECORDS).sort();
  const rows = asArray(candidates).filter((candidate) => (
    candidate.slug === SHENANDOAH_SLUG
    && candidate.source?.source_format === 'shenandoah_acalog_course_page'
    && expectedCodes.includes(candidate.course_code)
  )).sort((left, right) => left.course_code.localeCompare(right.course_code));
  if (rows.length !== expectedCodes.length
      || rows.some((row, index) => row.course_code !== expectedCodes[index])) return null;
  const population = [];
  for (const row of rows) {
    const source = row.source || {};
    const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[row.course_code];
    const expectedDiscoveryContract = expected?.discovery_contract
      || SHENANDOAH_DISCOVERY_CONTRACT;
    const expectedDiscoveryCachePath = expected?.discovery_cache_path
      || SHENANDOAH_PROGRAM_CACHE_PATH;
    const expectedDiscoveryResponseSha256 = expected?.discovery_response_sha256
      || SHENANDOAH_PROGRAM_HTML_SHA256;
    const discovery = source.discovery_link_receipt;
    let sourceUrl = null;
    try { sourceUrl = new URL(source.official_url); } catch { /* checked below */ }
    if (!expected
        || source.capture_origin !== 'official_shenandoah_acalog_course_page'
        || source.source_format !== 'shenandoah_acalog_course_page'
        || source.boundary_contract !== SHENANDOAH_BOUNDARY_CONTRACT
        || source.catalog_year_verified !== SHENANDOAH_CATALOG_YEAR
        || source.catoid !== SHENANDOAH_CATOID || source.coid !== expected.coid
        || sourceUrl?.protocol !== 'https:'
        || sourceUrl?.hostname.toLowerCase() !== SHENANDOAH_HOST
        || sourceUrl?.pathname !== '/preview_course_nopop.php'
        || Number(sourceUrl?.searchParams.get('catoid')) !== SHENANDOAH_CATOID
        || Number(sourceUrl?.searchParams.get('coid')) !== expected.coid
        || source.discovery_contract !== expectedDiscoveryContract
        || source.discovery_cache_path !== expectedDiscoveryCachePath
        || source.discovery_response_sha256 !== expectedDiscoveryResponseSha256
        || discovery?.course_code !== row.course_code
        || discovery?.catoid !== SHENANDOAH_CATOID
        || discovery?.coid !== expected.coid
        || discovery?.title !== expected.title
        || source.robots_crawl_delay_seconds !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
        || source.source_response_sha256 !== source.declared_normalized_text_sha256
        || source.source_response_sha256 !== source.retained_normalized_text_sha256
        || !Number.isInteger(source.formal_corequisite_marker_count)
        || source.formal_corequisite_marker_count < 0
        || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
        || !/^[a-f0-9]{64}$/.test(source.raw_entry_sha256 || '')
        || sha256(source.raw_entry_text) !== source.raw_entry_sha256) return null;
    const clause = source.required_requisite_clause;
    if (clause && (clause.receipt_contract !== SHENANDOAH_CLAUSE_RECEIPT_CONTRACT
        || clause.kind !== 'prerequisite' || clause.label !== 'Prerequisite(s)'
        || sha256(clause.raw) !== clause.raw_sha256
        || source.raw_entry_text.slice(clause.relative_start, clause.relative_end)
          !== clause.raw
        || clause.statement_relative_end !== clause.relative_end)) return null;
    population.push({
      course_key: row.course_key,
      coid: source.coid,
      source_response_sha256: source.source_response_sha256,
      raw_entry_html_sha256: source.raw_entry_html_sha256,
      raw_entry_sha256: source.raw_entry_sha256,
      required_requisite_clause_sha256: clause?.raw_sha256 || null,
      formal_corequisite_marker_count: source.formal_corequisite_marker_count,
    });
  }
  const positive = population.filter((row) => row.required_requisite_clause_sha256);
  const silent = population.length - positive.length;
  if (!positive.length || !silent) return null;
  return {
    receipt_contract: SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    catalog_year: SHENANDOAH_CATALOG_YEAR,
    catoid: SHENANDOAH_CATOID,
    exact_complete_entry_count: population.length,
    exact_complete_entries_with_required_requisite_marker_count: positive.length,
    exact_complete_entries_without_required_requisite_marker_count: silent,
    same_catalog_positive_control: true,
    population_sha256: sha256(JSON.stringify(population)),
    positive_control_sha256: sha256(JSON.stringify(positive)),
    positive_control_course_keys: positive.map((row) => row.course_key),
  };
}

function controlledShenandoahAcalogSilenceEvidence(candidate, markerControl) {
  const source = candidate?.source || {};
  const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[candidate?.course_code];
  const expectedDiscoveryContract = expected?.discovery_contract
    || SHENANDOAH_DISCOVERY_CONTRACT;
  const expectedDiscoveryCachePath = expected?.discovery_cache_path
    || SHENANDOAH_PROGRAM_CACHE_PATH;
  const expectedDiscoveryResponseSha256 = expected?.discovery_response_sha256
    || SHENANDOAH_PROGRAM_HTML_SHA256;
  const units = source.published_units;
  const discovery = source.discovery_link_receipt;
  let sourceUrl = null;
  try { sourceUrl = new URL(source.official_url); } catch { /* checked below */ }
  if (candidate?.slug !== SHENANDOAH_SLUG || !expected
      || source.capture_origin !== 'official_shenandoah_acalog_course_page'
      || source.source_format !== 'shenandoah_acalog_course_page'
      || source.boundary_contract !== SHENANDOAH_BOUNDARY_CONTRACT
      || source.catalog_year_verified !== SHENANDOAH_CATALOG_YEAR
      || source.catoid !== SHENANDOAH_CATOID || source.coid !== expected.coid
      || sourceUrl?.protocol !== 'https:'
      || sourceUrl?.hostname.toLowerCase() !== SHENANDOAH_HOST
      || sourceUrl?.pathname !== '/preview_course_nopop.php'
      || Number(sourceUrl?.searchParams.get('catoid')) !== SHENANDOAH_CATOID
      || Number(sourceUrl?.searchParams.get('coid')) !== expected.coid
      || source.discovery_contract !== expectedDiscoveryContract
      || source.discovery_cache_path !== expectedDiscoveryCachePath
      || source.discovery_response_sha256 !== expectedDiscoveryResponseSha256
      || discovery?.course_code !== candidate.course_code
      || discovery?.catoid !== SHENANDOAH_CATOID
      || discovery?.coid !== expected.coid
      || discovery?.title !== expected.title
      || source.robots_crawl_delay_seconds !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
      || source.source_response_sha256 !== source.declared_normalized_text_sha256
      || source.source_response_sha256 !== source.retained_normalized_text_sha256
      || source.required_requisite_clause !== null
      || source.formal_corequisite_marker_count !== 0
      || /(?:Pre|Co)requisite\(s\):/i.test(source.raw_entry_text || '')
      || hasUnmodeledConstraintSignal(source.raw_entry_text)
      || !/^[a-f0-9]{64}$/.test(source.source_response_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(source.raw_entry_html_sha256 || '')
      || sha256(source.raw_entry_text) !== source.raw_entry_sha256
      || !units || !(units.credit_hours_min > 0)
      || units.credit_hours_max < units.credit_hours_min
      || markerControl?.receipt_contract
        !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
      || markerControl.catalog_year !== SHENANDOAH_CATALOG_YEAR
      || markerControl.catoid !== SHENANDOAH_CATOID
      || markerControl.exact_complete_entry_count
        !== Object.keys(SHENANDOAH_DIRECT_COURSE_RECORDS).length
      || !(markerControl.exact_complete_entries_with_required_requisite_marker_count > 0)
      || !(markerControl.exact_complete_entries_without_required_requisite_marker_count > 0)
      || markerControl.same_catalog_positive_control !== true
      || !/^[a-f0-9]{64}$/.test(markerControl.population_sha256 || '')
      || !/^[a-f0-9]{64}$/.test(markerControl.positive_control_sha256 || '')) return null;
  return {
    kind: SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND,
    course_entry_status: 'published_exact_shenandoah_acalog_course_page',
    finding: 'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control',
    literal_none_statement: false,
    boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
    receipt_contract: SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT,
    source_response_sha256: source.source_response_sha256,
    raw_entry_sha256: source.raw_entry_sha256,
    raw_entry_html_sha256: source.raw_entry_html_sha256,
    catoid: source.catoid,
    coid: source.coid,
    published_units: units,
    marker_control: markerControl,
    inference_boundary: 'This means only that the complete official Shenandoah Acalog entry publishes no structured required-prerequisite field, has no corequisite field, and contains no unmodeled constraint signal while the same exact catalog population supplies positive controls. It does not infer a literal none statement from a missing row or catalog search result.',
  };
}

function reviewCandidate(candidate, {
  bridgewaterMarkerControl = null,
  uvaWiseMarkerControl = null,
  shenandoahMarkerControl = null,
  cnuEngl123Control = null,
  longwoodClosureControl = null,
  oldDominionClosureControl = null,
  vcuPrerequisiteControl = null,
  virginiaTechRecursivePrerequisiteControl = null,
  smallUniversityPrerequisiteEvidence = null,
  universityPrerequisiteTailControl = null,
  radfordRandolphMaconTailEvidence = null,
  remainingUniversityPrerequisiteEvidence = null,
  vcuEgmnPrerequisiteEvidence = null,
  radfordUvaWiseRecursiveEvidence = null,
} = {}) {
  const exactVirginiaTech = resolveVirginiaTechPrerequisiteCandidate(candidate);
  const exactVirginiaTechRemaining =
    resolveVirginiaTechRemainingPrerequisiteCandidate(candidate);
  const exactVirginiaTechRecursive =
    resolveVirginiaTechRecursivePrerequisiteCandidate(
      candidate, virginiaTechRecursivePrerequisiteControl,
    );
  const exactVirginiaTechCs4784Closure =
    resolveVirginiaTechCs4784ClosureCandidate(candidate);
  const {
    clauses,
    ignored,
    internal_components: internalComponents = [],
  } = extractRequiredClauses(candidate);
  const strictFormulaAudit = strictFormulaRejectionAuditReceipt(candidate, clauses);
  const exactVsuPhysics = resolveVsuPhysicsCombinedComponents(candidate, clauses);
  const exactVsuEnglish = resolveVirginiaStateEnglishPrerequisite(candidate, clauses);
  const exactVsuPrerequisiteClosure = resolveVirginiaStatePrerequisiteClosure(
    candidate, clauses,
  );
  const exactNsuCsc295 = resolveNorfolkStateCsc295Prerequisite(candidate, clauses);
  const exactNsuPrerequisiteClosure = resolveNorfolkStatePrerequisiteClosure(
    candidate, clauses,
  );
  const exactVcuPrerequisiteClosure = resolveVcuPrerequisiteCandidate(
    candidate, clauses, vcuPrerequisiteControl,
  );
  const exactSmallUniversityPrerequisite = smallUniversityPrerequisiteEvidence
    ? resolveSmallUniversityPrerequisite(candidate, smallUniversityPrerequisiteEvidence)
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactUniversityPrerequisiteTail = universityPrerequisiteTailControl
    ? resolveUniversityPrerequisiteTailCandidate(
      candidate, universityPrerequisiteTailControl,
    )
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactRadfordRandolphMaconTail = radfordRandolphMaconTailEvidence
    ? resolveRadfordRandolphMaconPrerequisiteTail(
      candidate, radfordRandolphMaconTailEvidence,
    )
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactRemainingUniversityPrerequisite = remainingUniversityPrerequisiteEvidence
    ? resolveRemainingUniversityPrerequisite(
      candidate, remainingUniversityPrerequisiteEvidence,
    )
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactVcuEgmnPrerequisite = vcuEgmnPrerequisiteEvidence
    ? resolveVcuEgmnPrerequisite(candidate, vcuEgmnPrerequisiteEvidence)
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactRadfordUvaWiseRecursive = radfordUvaWiseRecursiveEvidence
    ? resolveRadfordUvaWiseRecursive(candidate, radfordUvaWiseRecursiveEvidence)
    : { applicable: false, ready: false, blocked: false, issues: [] };
  const exactGeorgeMasonSilence = resolveGeorgeMasonPrerequisiteSilence(
    candidate, clauses,
  );
  const closureEvidenceEnabled = cnuEngl123Control != null
    || longwoodClosureControl != null || oldDominionClosureControl != null;
  const inactiveClosureAudit = { applicable: false, ready: false, issues: [] };
  const exactCnuEngl123 = closureEvidenceEnabled
    ? resolveCnuEngl123Prerequisite(candidate, cnuEngl123Control) : inactiveClosureAudit;
  const bridgewaterTimingAudit = closureEvidenceEnabled
    ? auditBridgewaterTimingPrerequisiteCandidate(candidate) : inactiveClosureAudit;
  const longwoodClosureAudit = closureEvidenceEnabled
    ? auditLongwoodPrerequisiteCandidate(candidate, longwoodClosureControl)
    : inactiveClosureAudit;
  const oldDominionClosureAudit = closureEvidenceEnabled
    ? resolveOldDominionPrerequisiteCandidate(candidate, oldDominionClosureControl)
    : inactiveClosureAudit;
  const exactFigure6NonCourseDisposition = closureEvidenceEnabled
    ? resolveFigure6NonCoursePrerequisiteDisposition(candidate, {
      oldDominionMarkerControl: oldDominionClosureControl,
    }) : inactiveClosureAudit;
  const evidence = baseEvidence(candidate, clauses);
  const officialEvidenceText = candidate.source?.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT
    ? `${candidate.source.program_requirement.exact_requirement_text}\n${candidate.source.raw_entry_text}`
    : candidate.source.raw_entry_text;
  const ignoredEvidence = ignored.map((row) => (
    row && typeof row === 'object' ? {
      ...row,
      source_character_start: candidate.source.character_start + row.relative_start,
      source_character_end: candidate.source.character_start + row.relative_end,
    } : row
  ));
  const common = {
    school_id: candidate.school_id,
    slug: candidate.slug,
    owner_namespace: candidate.owner_namespace,
    course_key: candidate.course_key,
    code: candidate.course_code,
    source: AUTHORITY,
    catalog_year: candidate.source.catalog_year_verified || null,
    source_url: candidate.source.official_url,
    source_bundle_hash: null,
    source_content_sha256: sha256(officialEvidenceText),
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: officialEvidenceText,
      content_sha256: sha256(officialEvidenceText),
    },
    review_evidence: evidence,
    ignored_nonrequired_requisites: ignoredEvidence,
    ...(strictFormulaAudit.applicable ? {
      strict_formula_rejection_audit: strictFormulaAudit,
    } : {}),
    ...(internalComponents.length ? {
      internal_component_corequisites: internalComponents.map((row) => ({
        ...row,
        source_character_start: candidate.source.character_start + row.relative_start,
        source_character_end: candidate.source.character_start + row.relative_end,
      })),
    } : {}),
  };
  const absoluteSignals = (rows) => asArray(rows).map((row) => ({
    ...row,
    source_character_start: candidate.source.character_start + row.relative_start,
    source_character_end: candidate.source.character_start + row.relative_end,
  }));
  const exactGeorgeMasonClosure = resolveGeorgeMasonPrerequisiteClosure({
    ...common,
    raw_requisites: null,
    groups: [],
  });
  const exactGeorgeMasonCachedCyse = cachedCyseReviewResolution({
    ...common,
    raw_requisites: null,
    groups: [],
  });
  if (exactVsuPhysics.applicable) {
    if (!exactVsuPhysics.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: 'vsu_combined_component_receipt_mismatch',
        parser_error: exactVsuPhysics.issues.join(', '),
        vsu_physics_combined_component_resolution: exactVsuPhysics,
      };
    }
    const {
      groups,
      internal_components: physicsInternalComponents,
      ...resolution
    } = exactVsuPhysics;
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups,
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_vsu_combined_lecture_laboratory_component_receipt',
      explicit_none_group_kinds: [],
      ...(physicsInternalComponents.length ? {
        internal_component_corequisites: physicsInternalComponents,
      } : {}),
      vsu_physics_combined_component_resolution: resolution,
    };
  }
  if (exactVsuEnglish.applicable) {
    if (!exactVsuEnglish.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactVsuEnglish.review_reason,
        parser_error: exactVsuEnglish.issues.join(', '),
        vsu_english_cs_scope_projection_attempt: exactVsuEnglish,
      };
    }
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups: exactVsuEnglish.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactVsuEnglish.review_reason,
      explicit_none_group_kinds: [],
      vsu_english_cs_scope_projection: exactVsuEnglish.projection,
    };
  }
  if (exactVsuPrerequisiteClosure.applicable) {
    if (!exactVsuPrerequisiteClosure.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactVsuPrerequisiteClosure.review_reason,
        ...(exactVsuPrerequisiteClosure.issues.length ? {
          parser_error: exactVsuPrerequisiteClosure.issues.join(', '),
        } : {}),
        ...(exactVsuPrerequisiteClosure.preserved_corequisite_clauses ? {
          preserved_corequisite_clauses:
            exactVsuPrerequisiteClosure.preserved_corequisite_clauses,
        } : {}),
        ...(exactVsuPrerequisiteClosure.internal_component_corequisites?.length ? {
          internal_component_corequisites:
            exactVsuPrerequisiteClosure.internal_component_corequisites,
        } : {}),
        ...(exactVsuPrerequisiteClosure.blocker_evidence ? {
          virginia_state_prerequisite_blocker:
            exactVsuPrerequisiteClosure.blocker_evidence,
        } : {
          virginia_state_prerequisite_resolution_attempt:
            exactVsuPrerequisiteClosure,
        }),
      };
    }
    return {
      ...common,
      status: exactVsuPrerequisiteClosure.status,
      raw_requisites: exactVsuPrerequisiteClosure.raw_requisites,
      groups: exactVsuPrerequisiteClosure.groups,
      review_status: exactVsuPrerequisiteClosure.review_status,
      review_reason: exactVsuPrerequisiteClosure.review_reason,
      ignored_nonrequired_requisites:
        exactVsuPrerequisiteClosure.ignored_nonrequired_requisites,
      ...(exactVsuPrerequisiteClosure.internal_component_corequisites.length ? {
        internal_component_corequisites:
          exactVsuPrerequisiteClosure.internal_component_corequisites,
      } : {}),
      ...(exactVsuPrerequisiteClosure.status === 'none' ? {
        structural_none_evidence: exactVsuPrerequisiteClosure.proof,
      } : {
        explicit_none_group_kinds: [],
        virginia_state_prerequisite_resolution: exactVsuPrerequisiteClosure.proof,
      }),
    };
  }
  if (exactNsuPrerequisiteClosure.applicable) {
    if (!exactNsuPrerequisiteClosure.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactNsuPrerequisiteClosure.review_reason,
        ...(exactNsuPrerequisiteClosure.issues.length ? {
          parser_error: exactNsuPrerequisiteClosure.issues.join(', '),
          norfolk_state_prerequisite_resolution_attempt:
            exactNsuPrerequisiteClosure,
        } : {
          preserved_sequence_signals:
            exactNsuPrerequisiteClosure.preserved_sequence_signals,
          prerequisite_constraint_blocker_evidence:
            exactNsuPrerequisiteClosure.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactNsuPrerequisiteClosure.status,
      raw_requisites: exactNsuPrerequisiteClosure.raw_requisites,
      groups: exactNsuPrerequisiteClosure.groups,
      review_status: exactNsuPrerequisiteClosure.review_status,
      review_reason: exactNsuPrerequisiteClosure.review_reason,
      ignored_nonrequired_requisites:
        exactNsuPrerequisiteClosure.ignored_nonrequired_requisites,
      ...(exactNsuPrerequisiteClosure.status === 'none' ? {
        structural_none_evidence: exactNsuPrerequisiteClosure.proof,
      } : {
        explicit_none_group_kinds: [],
        norfolk_state_prerequisite_resolution:
          exactNsuPrerequisiteClosure.proof,
      }),
    };
  }
  if (exactNsuCsc295.applicable) {
    if (!exactNsuCsc295.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactNsuCsc295.review_reason,
        parser_error: exactNsuCsc295.issues.join(', '),
        norfolk_state_csc295_resolution_attempt: exactNsuCsc295,
      };
    }
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactNsuCsc295.raw_requisites,
      groups: exactNsuCsc295.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactNsuCsc295.review_reason,
      explicit_none_group_kinds: [],
      norfolk_state_csc295_resolution: exactNsuCsc295.proof,
    };
  }
  if (exactRemainingUniversityPrerequisite.applicable) {
    if (!exactRemainingUniversityPrerequisite.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRemainingUniversityPrerequisite.raw_requisites || null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactRemainingUniversityPrerequisite.review_reason,
        ...(exactRemainingUniversityPrerequisite.issues.length ? {
          parser_error: exactRemainingUniversityPrerequisite.issues.join(', '),
          remaining_university_prerequisite_resolution_attempt:
            exactRemainingUniversityPrerequisite,
        } : {
          preserved_source_formulas:
            exactRemainingUniversityPrerequisite.preserved_source_formulas,
          preserved_prerequisite_signals:
            exactRemainingUniversityPrerequisite.preserved_signals,
          prerequisite_constraint_blocker_evidence:
            exactRemainingUniversityPrerequisite.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactRemainingUniversityPrerequisite.status,
      raw_requisites: exactRemainingUniversityPrerequisite.raw_requisites,
      groups: exactRemainingUniversityPrerequisite.groups,
      review_status: exactRemainingUniversityPrerequisite.review_status,
      review_reason: exactRemainingUniversityPrerequisite.review_reason,
      ignored_nonrequired_requisites:
        exactRemainingUniversityPrerequisite.ignored_nonrequired_requisites,
      structural_none_evidence: exactRemainingUniversityPrerequisite.proof,
    };
  }
  if (exactVcuEgmnPrerequisite.applicable) {
    if (!exactVcuEgmnPrerequisite.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactVcuEgmnPrerequisite.raw_requisites || null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactVcuEgmnPrerequisite.review_reason,
        ...(exactVcuEgmnPrerequisite.issues.length ? {
          parser_error: exactVcuEgmnPrerequisite.issues.join(', '),
          vcu_egmn_prerequisite_resolution_attempt: exactVcuEgmnPrerequisite,
        } : {
          preserved_source_formulas: exactVcuEgmnPrerequisite.preserved_source_formulas,
          preserved_prerequisite_signals: exactVcuEgmnPrerequisite.preserved_signals,
          prerequisite_constraint_blocker_evidence:
            exactVcuEgmnPrerequisite.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactVcuEgmnPrerequisite.status,
      raw_requisites: null,
      groups: [],
      review_status: exactVcuEgmnPrerequisite.review_status,
      review_reason: exactVcuEgmnPrerequisite.review_reason,
      ignored_nonrequired_requisites: [],
      structural_none_evidence: exactVcuEgmnPrerequisite.proof,
    };
  }
  if (exactRadfordUvaWiseRecursive.applicable) {
    if (!exactRadfordUvaWiseRecursive.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRadfordUvaWiseRecursive.raw_requisites || null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactRadfordUvaWiseRecursive.review_reason,
        ...(exactRadfordUvaWiseRecursive.issues.length ? {
          parser_error: exactRadfordUvaWiseRecursive.issues.join(', '),
          radford_uva_wise_recursive_prerequisite_resolution_attempt:
            exactRadfordUvaWiseRecursive,
        } : {
          preserved_source_formulas:
            exactRadfordUvaWiseRecursive.preserved_source_formulas,
          preserved_prerequisite_signals:
            exactRadfordUvaWiseRecursive.preserved_signals,
          prerequisite_constraint_blocker_evidence:
            exactRadfordUvaWiseRecursive.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactRadfordUvaWiseRecursive.status,
      raw_requisites: exactRadfordUvaWiseRecursive.raw_requisites,
      groups: exactRadfordUvaWiseRecursive.groups,
      review_status: exactRadfordUvaWiseRecursive.review_status,
      review_reason: exactRadfordUvaWiseRecursive.review_reason,
      ignored_nonrequired_requisites:
        exactRadfordUvaWiseRecursive.ignored_nonrequired_requisites,
      explicit_none_group_kinds: [],
      radford_uva_wise_recursive_prerequisite_resolution:
        exactRadfordUvaWiseRecursive.proof,
    };
  }
  if (exactVcuPrerequisiteClosure.applicable) {
    if (!exactVcuPrerequisiteClosure.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactVcuPrerequisiteClosure.review_reason,
        ...(exactVcuPrerequisiteClosure.issues.length ? {
          parser_error: exactVcuPrerequisiteClosure.issues.join(', '),
          vcu_prerequisite_resolution_attempt: exactVcuPrerequisiteClosure,
        } : {
          retained_non_prerequisite_signals: absoluteSignals(
            exactVcuPrerequisiteClosure.retained_non_prerequisite_signals,
          ),
          prerequisite_constraint_blocker_evidence:
            exactVcuPrerequisiteClosure.blocker_evidence,
          vcu_prerequisite_closure_audit:
            exactVcuPrerequisiteClosure.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactVcuPrerequisiteClosure.status,
      raw_requisites: null,
      groups: [],
      review_status: exactVcuPrerequisiteClosure.review_status,
      review_reason: exactVcuPrerequisiteClosure.review_reason,
      ignored_nonrequired_requisites: absoluteSignals(
        exactVcuPrerequisiteClosure.ignored_nonrequired_requisites,
      ),
      structural_none_evidence:
        exactVcuPrerequisiteClosure.structural_none_evidence,
    };
  }
  if (exactSmallUniversityPrerequisite.applicable) {
    if (!exactSmallUniversityPrerequisite.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactSmallUniversityPrerequisite.review_reason,
        ...(exactSmallUniversityPrerequisite.issues.length ? {
          parser_error: exactSmallUniversityPrerequisite.issues.join(', '),
          small_university_prerequisite_resolution_attempt:
            exactSmallUniversityPrerequisite,
        } : {
          preserved_prerequisite_signals:
            exactSmallUniversityPrerequisite.preserved_signals,
          prerequisite_constraint_blocker_evidence:
            exactSmallUniversityPrerequisite.blocker_evidence,
        }),
      };
    }
    return {
      ...common,
      status: exactSmallUniversityPrerequisite.status,
      raw_requisites: exactSmallUniversityPrerequisite.raw_requisites,
      groups: exactSmallUniversityPrerequisite.groups,
      review_status: exactSmallUniversityPrerequisite.review_status,
      review_reason: exactSmallUniversityPrerequisite.review_reason,
      ignored_nonrequired_requisites:
        exactSmallUniversityPrerequisite.ignored_nonrequired_requisites,
      ...(exactSmallUniversityPrerequisite.status === 'none' ? {
        structural_none_evidence: exactSmallUniversityPrerequisite.proof,
      } : {
        explicit_none_group_kinds: [],
        small_university_prerequisite_resolution:
          exactSmallUniversityPrerequisite.proof,
      }),
    };
  }
  if (exactUniversityPrerequisiteTail.applicable) {
    if (!exactUniversityPrerequisiteTail.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactUniversityPrerequisiteTail.raw_requisites
          || exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactUniversityPrerequisiteTail.review_reason,
        ...(exactUniversityPrerequisiteTail.issues.length ? {
          parser_error: exactUniversityPrerequisiteTail.issues.join(', '),
          university_prerequisite_tail_resolution_attempt:
            exactUniversityPrerequisiteTail,
        } : {
          preserved_source_formula_groups:
            exactUniversityPrerequisiteTail.preserved_source_formula_groups,
          prerequisite_constraint_blocker_evidence:
            exactUniversityPrerequisiteTail.blocker_evidence,
        }),
      };
    }
    const tailSignals = absoluteSignals(
      exactUniversityPrerequisiteTail.ignored_nonrequired_requisites,
    );
    return {
      ...common,
      status: exactUniversityPrerequisiteTail.status,
      raw_requisites: exactUniversityPrerequisiteTail.raw_requisites,
      groups: exactUniversityPrerequisiteTail.groups,
      review_status: exactUniversityPrerequisiteTail.review_status,
      review_reason: exactUniversityPrerequisiteTail.review_reason,
      ignored_nonrequired_requisites: tailSignals,
      ...(exactUniversityPrerequisiteTail.status === 'none' ? {
        structural_none_evidence:
          exactUniversityPrerequisiteTail.structural_none_evidence,
      } : {
        explicit_none_group_kinds: [],
        university_prerequisite_tail_resolution:
          exactUniversityPrerequisiteTail.exact_tail_prerequisite_evidence,
      }),
    };
  }
  if (exactRadfordRandolphMaconTail.applicable) {
    const sourceProjection = exactRadfordRandolphMaconTail.source_projection;
    const exactCommon = sourceProjection ? {
      ...common,
      source_url: sourceProjection.source_url,
      source_content_sha256: sourceProjection.source_content_sha256,
      source_evidence: sourceProjection.source_evidence,
      review_evidence: {
        ...common.review_evidence,
        ...sourceProjection.review_evidence_overlay,
      },
    } : common;
    if (!exactRadfordRandolphMaconTail.ready) {
      if (exactRadfordRandolphMaconTail.issues.length) return {
        ...exactCommon,
        status: 'unparsed',
        raw_requisites: exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactRadfordRandolphMaconTail.review_reason,
        parser_error: exactRadfordRandolphMaconTail.issues.join(', '),
        radford_randolph_macon_tail_resolution_attempt:
          exactRadfordRandolphMaconTail,
      };
      const entryStart = Number(
        exactCommon.review_evidence?.entry_character_start || 0,
      );
      const preservedSignals = asArray(
        exactRadfordRandolphMaconTail.preserved_signals,
      ).map((row) => ({
        ...row,
        source_character_start: entryStart + row.relative_start,
        source_character_end: entryStart + row.relative_end,
      }));
      return {
        ...exactCommon,
        status: 'unparsed',
        raw_requisites: exactRadfordRandolphMaconTail.raw_requisites,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactRadfordRandolphMaconTail.review_reason,
        preserved_prerequisite_signals: preservedSignals,
        prerequisite_constraint_blocker_evidence:
          exactRadfordRandolphMaconTail.blocker_evidence,
      };
    }
    const entryStart = Number(exactCommon.review_evidence?.entry_character_start || 0);
    const ignoredSignals = asArray(
      exactRadfordRandolphMaconTail.ignored_nonrequired_requisites,
    ).map((row) => ({
      ...row,
      source_character_start: entryStart + row.relative_start,
      source_character_end: entryStart + row.relative_end,
    }));
    return {
      ...exactCommon,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: exactRadfordRandolphMaconTail.review_status,
      review_reason: exactRadfordRandolphMaconTail.review_reason,
      ignored_nonrequired_requisites: ignoredSignals,
      structural_none_evidence:
        exactRadfordRandolphMaconTail.structural_none_evidence,
    };
  }
  if (exactGeorgeMasonSilence.applicable) {
    if (!exactGeorgeMasonSilence.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactGeorgeMasonSilence.review_reason,
        parser_error: exactGeorgeMasonSilence.issues.join(', '),
        george_mason_required_requisite_silence_attempt:
          exactGeorgeMasonSilence,
      };
    }
    return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_structural_none',
      review_reason: exactGeorgeMasonSilence.review_reason,
      ignored_nonrequired_requisites:
        exactGeorgeMasonSilence.ignored_nonrequired_requisites,
      structural_none_evidence:
        exactGeorgeMasonSilence.structural_none_evidence,
    };
  }
  if (exactGeorgeMasonClosure.applicable) {
    if (!exactGeorgeMasonClosure.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'gmu_recursive_closure_exact_receipt_changed',
      parser_error: exactGeorgeMasonClosure.issues.join(', '),
      george_mason_recursive_closure_resolution_attempt:
        exactGeorgeMasonClosure,
    };
    return {
      ...common,
      status: exactGeorgeMasonClosure.status,
      raw_requisites: exactGeorgeMasonClosure.raw_requisites,
      groups: exactGeorgeMasonClosure.groups,
      review_status: exactGeorgeMasonClosure.review_status,
      review_reason: exactGeorgeMasonClosure.review_reason,
      ignored_nonrequired_requisites: absoluteSignals(
        exactGeorgeMasonClosure.ignored_nonrequired_requisites,
      ),
      structural_none_evidence:
        exactGeorgeMasonClosure.structural_none_evidence,
    };
  }
  if (exactGeorgeMasonCachedCyse.applicable) {
    if (!exactGeorgeMasonCachedCyse.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: exactGeorgeMasonCachedCyse.review_reason,
      parser_error: exactGeorgeMasonCachedCyse.issues.join(', '),
      george_mason_cached_cyse_resolution_attempt:
        exactGeorgeMasonCachedCyse,
    };
    return {
      ...common,
      status: exactGeorgeMasonCachedCyse.status,
      raw_requisites: exactGeorgeMasonCachedCyse.raw_requisites,
      groups: exactGeorgeMasonCachedCyse.groups,
      review_status: exactGeorgeMasonCachedCyse.review_status,
      review_reason: exactGeorgeMasonCachedCyse.review_reason,
      ignored_nonrequired_requisites: absoluteSignals(
        exactGeorgeMasonCachedCyse.ignored_nonrequired_requisites,
      ),
      structural_none_evidence:
        exactGeorgeMasonCachedCyse.structural_none_evidence,
    };
  }
  if (exactCnuEngl123.applicable) {
    if (!exactCnuEngl123.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: exactCnuEngl123.review_reason,
      parser_error: exactCnuEngl123.issues.join(', '),
      cnu_engl123_resolution_attempt: exactCnuEngl123,
    };
    return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: exactCnuEngl123.review_status,
      review_reason: exactCnuEngl123.review_reason,
      ignored_nonrequired_requisites: absoluteSignals(
        exactCnuEngl123.ignored_nonrequired_requisites,
      ),
      structural_none_evidence: exactCnuEngl123.structural_none_evidence,
    };
  }
  if (exactFigure6NonCourseDisposition.applicable) {
    if (!exactFigure6NonCourseDisposition.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: exactFigure6NonCourseDisposition.review_reason,
      ...(exactFigure6NonCourseDisposition.issues.length ? {
        parser_error: exactFigure6NonCourseDisposition.issues.join(', '),
      } : {}),
      retained_non_prerequisite_signals: absoluteSignals(
        exactFigure6NonCourseDisposition.retained_non_prerequisite_signals,
      ),
      prerequisite_constraint_blocker_evidence:
        exactFigure6NonCourseDisposition.blocker_evidence,
      figure6_noncourse_prerequisite_disposition_audit:
        exactFigure6NonCourseDisposition,
    };
    const retainedSignals = absoluteSignals(
      exactFigure6NonCourseDisposition.retained_non_prerequisite_signals,
    );
    return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: exactFigure6NonCourseDisposition.review_status,
      review_reason: exactFigure6NonCourseDisposition.review_reason,
      retained_non_prerequisite_signals: retainedSignals,
      ignored_nonrequired_requisites: retainedSignals,
      structural_none_evidence:
        exactFigure6NonCourseDisposition.structural_none_evidence,
    };
  }
  if (bridgewaterTimingAudit.applicable) return {
    ...common,
    status: 'unparsed',
    raw_requisites: null,
    groups: [],
    review_status: 'not_promoted',
    review_reason: bridgewaterTimingAudit.review_reason,
    ...(bridgewaterTimingAudit.issues.length ? {
      parser_error: bridgewaterTimingAudit.issues.join(', '),
    } : {}),
    retained_non_prerequisite_signals: absoluteSignals(
      bridgewaterTimingAudit.retained_non_prerequisite_signals,
    ),
    prerequisite_constraint_blocker_evidence: bridgewaterTimingAudit.blocker_evidence,
    bridgewater_timing_constraint_audit: bridgewaterTimingAudit,
  };
  if (longwoodClosureAudit.applicable) return {
    ...common,
    status: 'unparsed',
    raw_requisites: null,
    groups: [],
    review_status: 'not_promoted',
    review_reason: longwoodClosureAudit.review_reason,
    ...(longwoodClosureAudit.issues.length ? {
      parser_error: longwoodClosureAudit.issues.join(', '),
    } : {}),
    preserved_corequisite_groups: longwoodClosureAudit.preserved_corequisite_groups || [],
    retained_non_prerequisite_signals: absoluteSignals(
      longwoodClosureAudit.retained_non_prerequisite_signals,
    ),
    prerequisite_constraint_blocker_evidence: longwoodClosureAudit.blocker_evidence,
    longwood_prerequisite_closure_audit: longwoodClosureAudit,
  };
  if (oldDominionClosureAudit.applicable) {
    if (!oldDominionClosureAudit.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: oldDominionClosureAudit.review_reason,
      ...(oldDominionClosureAudit.issues.length ? {
        parser_error: oldDominionClosureAudit.issues.join(', '),
      } : {}),
      retained_non_prerequisite_signals: absoluteSignals(
        oldDominionClosureAudit.retained_non_prerequisite_signals,
      ),
      prerequisite_constraint_blocker_evidence: oldDominionClosureAudit.blocker_evidence,
      old_dominion_prerequisite_closure_audit: oldDominionClosureAudit,
    };
    return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: oldDominionClosureAudit.review_status,
      review_reason: oldDominionClosureAudit.review_reason,
      ignored_nonrequired_requisites: [],
      structural_none_evidence: oldDominionClosureAudit.structural_none_evidence,
    };
  }
  if (exactVirginiaTechRecursive.applicable) {
    const promoteCorequisite = exactVirginiaTechRecursive.ready
      && VIRGINIA_TECH_RECURSIVE_SAFE_COREQUISITE_CODES
        .includes(exactVirginiaTechRecursive.code);
    if (!promoteCorequisite) {
      const runtimeNonCourseBlock = exactVirginiaTechRecursive.code === 'MATH1014';
      const exactSourceFormula = exactVirginiaTechRecursive.raw_requisites
        || exactVirginiaTechRecursive.proof?.exact_source_formula?.raw_requisites;
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactSourceFormula
          || exactRequisiteSourceText(candidate, clauses)
          || exactVirginiaTechRecursive.proof?.modeled_statements?.[0]?.raw
          || null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: runtimeNonCourseBlock
          ? 'virginia_tech_high_school_non_course_condition_runtime_unresolved'
          : (exactVirginiaTechRecursive.code === 'CS3704'
            ? 'strict_formula_parser_rejected'
            : exactVirginiaTechRecursive.review_reason),
        parser_error: runtimeNonCourseBlock
          ? 'non_course_formula_path_unresolved'
          : exactVirginiaTechRecursive.issues.join(', '),
        virginia_tech_recursive_prerequisite_resolution: {
          ...exactVirginiaTechRecursive,
          integration_disposition: {
            promoted: false,
            status: 'unparsed',
            blocker: runtimeNonCourseBlock
              ? 'non_course_formula_path_unresolved'
              : exactVirginiaTechRecursive.issues[0],
            formula_emitted: false,
            source_evidence_preserved: true,
          },
        },
      };
    }
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactVirginiaTechRecursive.raw_requisites,
      groups: exactVirginiaTechRecursive.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactVirginiaTechRecursive.review_reason,
      explicit_none_group_kinds: [],
      virginia_tech_recursive_prerequisite_resolution: {
        code: exactVirginiaTechRecursive.code,
        classification: exactVirginiaTechRecursive.classification,
        proof: exactVirginiaTechRecursive.proof,
        integration_disposition: {
          promoted: true,
          status: 'parsed',
          blocker: null,
          formula_emitted: true,
          source_evidence_preserved: true,
        },
      },
    };
  }
  if (exactVirginiaTechRemaining.applicable) {
    if (!exactVirginiaTechRemaining.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups: [],
      review_status: 'not_promoted',
      review_reason: exactVirginiaTechRemaining.review_reason,
      parser_error: exactVirginiaTechRemaining.issues.join(', '),
      virginia_tech_remaining_prerequisite_resolution:
        exactVirginiaTechRemaining,
    };
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactVirginiaTechRemaining.raw_requisites,
      groups: exactVirginiaTechRemaining.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactVirginiaTechRemaining.review_reason,
      explicit_none_group_kinds: [],
      virginia_tech_remaining_prerequisite_resolution: {
        code: exactVirginiaTechRemaining.code,
        classification: exactVirginiaTechRemaining.classification,
        proof: exactVirginiaTechRemaining.proof,
      },
    };
  }
  if (exactVirginiaTechCs4784Closure.applicable) {
    if (!exactVirginiaTechCs4784Closure.ready) return {
      ...common,
      status: 'unparsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups: [],
      review_status: 'not_promoted',
      review_reason: exactVirginiaTechCs4784Closure.review_reason,
      parser_error: exactVirginiaTechCs4784Closure.issues.join(', '),
      virginia_tech_cs4784_recursive_closure_resolution:
        exactVirginiaTechCs4784Closure,
    };
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactVirginiaTechCs4784Closure.raw_requisites,
      groups: exactVirginiaTechCs4784Closure.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactVirginiaTechCs4784Closure.review_reason,
      explicit_none_group_kinds: [],
      virginia_tech_cs4784_recursive_closure_resolution: {
        code: exactVirginiaTechCs4784Closure.code,
        proof: exactVirginiaTechCs4784Closure.proof,
      },
    };
  }
  if (exactVirginiaTech.applicable) {
    if (!exactVirginiaTech.ready) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: exactRequisiteSourceText(candidate, clauses),
        groups: [],
        review_status: 'not_promoted',
        review_reason: exactVirginiaTech.review_reason,
        parser_error: exactVirginiaTech.ambiguity || exactVirginiaTech.issues.join(', '),
        virginia_tech_exact_resolution: exactVirginiaTech,
      };
    }
    const preservedNoncurrent = asArray(
      exactVirginiaTech.proof?.preserved_noncurrent_sibling_statements,
    ).map((row) => ({
      ...row,
      source_character_start: candidate.source.character_start + row.relative_start,
      source_character_end: candidate.source.character_start + row.relative_end,
    }));
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactVirginiaTech.raw_requisites,
      groups: exactVirginiaTech.groups,
      review_status: 'promoted_strict_formula',
      review_reason: exactVirginiaTech.review_reason,
      ignored_nonrequired_requisites: [
        ...ignoredEvidence,
        ...preservedNoncurrent,
      ],
      explicit_none_group_kinds: [],
      virginia_tech_exact_resolution: {
        code: exactVirginiaTech.code,
        candidate_sha256: exactVirginiaTech.candidate_sha256,
        source_sha256: exactVirginiaTech.source_sha256,
        publication_scope: exactVirginiaTech.publication_scope,
        source_or_core_content_changed: exactVirginiaTech.source_or_core_content_changed,
        proof: exactVirginiaTech.proof,
      },
    };
  }
  if (candidate.source?.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT
      && candidate.source.formal_corequisite_marker_count !== 0) {
    return {
      ...common,
      status: 'unparsed',
      raw_requisites: candidate.source.raw_entry_text,
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'shenandoah_corequisite_field_not_bounded_by_required_clause_receipt',
    };
  }
  if (!clauses.length) {
    const structuralNone = controlledVirginiaTechGraduateCsSilenceEvidence(candidate)
      || controlledCourseLeafSilenceEvidence(candidate)
      || controlledBridgewaterCleanCatalogSilenceEvidence(
        candidate, bridgewaterMarkerControl,
      )
      || controlledUvaWiseAcalogSilenceEvidence(candidate, uvaWiseMarkerControl)
      || controlledShenandoahAcalogSilenceEvidence(candidate, shenandoahMarkerControl);
    if (structuralNone) return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_structural_none',
      review_reason:
        structuralNone.receipt_contract
            === VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT
          ? 'complete_current_virginia_tech_graduate_cs_entry_silence_with_same_page_pre_controls'
          : (structuralNone.receipt_contract === COURSELEAF_RECEIPT_CONTRACT
          ? 'complete_courseleaf_entry_silence_with_same_source_required_marker_control'
          : (structuralNone.receipt_contract
              === BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
            ? 'complete_bridgewater_cleancatalog_entry_silence_with_same_edition_requisite_marker_controls'
            : (structuralNone.receipt_contract
                === UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
              ? 'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control'
              : 'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control'))),
      structural_none_evidence: structuralNone,
    };
    return {
      ...common,
      status: 'unparsed',
      raw_requisites: null,
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'no_explicit_required_requisite_statement',
    };
  }
  const exactVsuEnrollmentRestriction = candidate.source?.boundary_contract
      === VSU_ARABIC_BOUNDARY_CONTRACT
    && candidate.course_code === 'ARAB110'
    && clauses.some((clause) => clause.kind === 'prerequisite');
  if (!clauses.some((clause) => clause.kind === 'prerequisite')
      && !exactVsuEnrollmentRestriction) {
    return {
      ...common,
      status: 'unparsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'corequisite_statement_does_not_prove_no_prerequisite',
    };
  }
  const substantive = clauses.filter((clause) => !isExplicitNone(clause));
  const explicitNone = clauses.filter(isExplicitNone);
  if (!substantive.length) {
    const prerequisiteNone = explicitNone.some((clause) => clause.kind === 'prerequisite');
    if (!prerequisiteNone) {
      return {
        ...common,
        status: 'unparsed',
        raw_requisites: null,
        groups: [],
        review_status: 'not_promoted',
        review_reason: 'corequisite_none_does_not_prove_no_prerequisite',
      };
    }
    return {
      ...common,
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_explicit_none',
      review_reason: 'explicit_catalog_no_prerequisite_statement',
      explicit_none_evidence: explicitNoneEvidence(candidate, clauses),
    };
  }

  try {
    const groups = substantive.map((clause) => parseClause(candidate, clause));
    return {
      ...common,
      status: 'parsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups,
      review_status: 'promoted_strict_formula',
      review_reason: 'every_required_clause_character_accounted_for_by_strict_grammar',
      explicit_none_group_kinds: explicitNone.map((clause) => clause.kind),
    };
  } catch (error) {
    return {
      ...common,
      status: 'unparsed',
      raw_requisites: exactRequisiteSourceText(candidate, clauses),
      groups: [],
      review_status: 'not_promoted',
      review_reason: 'strict_formula_parser_rejected',
      parser_error: error.message,
    };
  }
}

function missingReviewRow(university, code, manifest) {
  const exactToken = manifest.exact_tokens_without_bounded_entry.includes(code);
  return {
    school_id: university.school_id,
    slug: university.slug,
    owner_namespace: university.owner_namespace,
    course_key: `${university.owner_namespace}:${code}`,
    code,
    status: 'missing',
    source: null,
    source_url: university.cached_course_catalog.official_url,
    source_bundle_hash: university.cached_course_catalog.retained_normalized_text_sha256,
    raw_requisites: null,
    groups: [],
    review_status: 'not_promoted',
    review_reason: exactToken
      ? 'exact_token_not_safely_bounded_as_complete_entry'
      : 'direct_code_not_present_as_exact_token_in_cached_source',
    review_evidence: null,
  };
}

function closureReport(rows, promotedRows, { directKeys = null } = {}) {
  const allByKey = new Map(rows.map((row) => [row.course_key, row]));
  const promotedByKey = new Map(promotedRows.map((row) => [row.course_key, row]));
  const referenced = new Set();
  for (const row of promotedRows) {
    for (const group of row.groups || []) {
      for (const path of group.paths || []) {
        for (const condition of path.all_of || []) {
          if (condition.type === 'course') referenced.add(condition.course_key);
        }
      }
    }
  }
  const resolved = [];
  const unparsedDirect = [];
  const unparsedClosure = [];
  const missingDirect = [];
  const outsideDirect = [];
  for (const key of [...referenced].sort()) {
    if (promotedByKey.has(key)) resolved.push(key);
    else if (allByKey.get(key)?.status === 'unparsed') {
      if (!directKeys || directKeys.has(key)) unparsedDirect.push(key);
      else unparsedClosure.push(key);
    }
    else if (allByKey.get(key)?.status === 'missing') missingDirect.push(key);
    else outsideDirect.push(key);
  }
  const unresolved = [...unparsedDirect, ...unparsedClosure, ...missingDirect, ...outsideDirect].sort();
  return {
    complete: unresolved.length === 0,
    recursive_walk_status: unresolved.length ? 'blocked_at_unpromoted_reference' : 'closed',
    formula_reference_keys: referenced.size,
    resolved_promoted_keys: resolved.length,
    unresolved_reference_keys: unresolved.length,
    unresolved_unparsed_direct_keys: unparsedDirect.length,
    unresolved_unparsed_closure_keys: unparsedClosure.length,
    unresolved_missing_direct_keys: missingDirect.length,
    unresolved_outside_direct_scope_keys: outsideDirect.length,
    resolved,
    unresolved_unparsed_direct: unparsedDirect,
    unresolved_unparsed_closure: unparsedClosure,
    unresolved_missing_direct: missingDirect,
    unresolved_outside_direct_scope: outsideDirect,
  };
}

function georgeMasonRecursiveClosureAudit(rows, closure) {
  const owner = 'va:uni:9210';
  const promotedCodes = rows.filter((row) => (
    row.owner_namespace === owner
      && GEORGE_MASON_CLOSURE_CODES.includes(row.code)
      && row.status === 'none'
      && row.review_status === 'promoted_structural_none'
  )).map((row) => row.code).sort();
  const cacheReacquiredCodes = rows.filter((row) => (
    row.owner_namespace === owner
      && GEORGE_MASON_CACHE_REACQUIRE_CODES.includes(row.code)
      && row.status === 'none'
      && row.review_status === 'promoted_structural_none'
  )).map((row) => row.code).sort();
  const blockedReferences = GEORGE_MASON_BLOCKED_CLOSURE_CODES.map((code) => {
    const found = georgeMasonBlockerForCode(code);
    const tuple = found?.tuple || [];
    return {
      course_key: `${owner}:${code}`,
      status: 'blocked_fail_closed',
      blocker_reason: tuple[8] || null,
      source_url: tuple[0] || null,
      source_cache_path: tuple[1] || null,
      source_response_sha256: tuple[2] || null,
      inference_boundary:
        'absence from an exact current subject page or a 404 subject route does not prove historical prerequisite silence and cannot create an alias or none row',
    };
  });
  return {
    contract: GEORGE_MASON_CLOSURE_CONTRACT,
    review_reason: GEORGE_MASON_CLOSURE_REVIEW_REASON,
    expected_existing_closure_none_rows: GEORGE_MASON_CLOSURE_CODES.length,
    promoted_existing_closure_none_codes: promotedCodes,
    expected_cache_reacquisition_none_rows: GEORGE_MASON_CACHE_REACQUIRE_CODES.length,
    cache_reacquired_none_codes: cacheReacquiredCodes,
    blocked_outside_reference_count: blockedReferences.length,
    blocked_outside_references: blockedReferences,
    all_blocked_references_remain_unresolved: blockedReferences.every((row) => (
      closure.unresolved_outside_direct_scope.includes(row.course_key)
    )),
  };
}

function strictFormulaRejectionAuditReport(rows) {
  const expectedKeys = Object.keys(STRICT_FORMULA_REJECTION_AUDIT).sort();
  const reviewed = asArray(rows).filter((row) => (
    row.strict_formula_rejection_audit?.receipt_contract
      === STRICT_FORMULA_REJECTION_AUDIT_CONTRACT
  )).sort((left, right) => left.course_key.localeCompare(right.course_key));
  const reviewedKeys = reviewed.map((row) => `${row.slug}:${row.code}`);
  const promoted = reviewed.filter((row) => (
    row.strict_formula_rejection_audit.decision === 'promoted_lossless_formula'
  ));
  const blocked = reviewed.filter((row) => (
    row.strict_formula_rejection_audit.decision !== 'promoted_lossless_formula'
  ));
  const rowsValid = reviewed.every((row) => {
    const audit = row.strict_formula_rejection_audit;
    const shouldPromote = audit.decision === 'promoted_lossless_formula';
    return audit.source_receipt_valid === true
      && audit.issues.length === 0
      && (shouldPromote
        ? row.status === 'parsed'
          && row.review_status === 'promoted_strict_formula'
          && row.groups.length === 1
          && row.groups[0].flags.includes('source_bound_strict_formula_rejection_audit')
          && row.groups[0].flags.includes(audit.strategy)
        : row.status === 'unparsed'
          && row.review_status === 'not_promoted'
          && (row.review_reason === 'strict_formula_parser_rejected'
            || (row.review_evidence?.raw_entry_sha256 === audit.raw_entry_sha256
              && row.prerequisite_constraint_blocker_evidence?.contract
                === REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT))
          && row.groups.length === 0);
  });
  return {
    receipt_contract: STRICT_FORMULA_REJECTION_AUDIT_CONTRACT,
    prior_strict_parser_rejected_rows: expectedKeys.length,
    audited_rows: reviewed.length,
    newly_promoted_lossless_formula_rows: promoted.length,
    remaining_blocked_rows: blocked.length,
    promoted_keys: promoted.map((row) => `${row.slug}:${row.code}`).sort(),
    blocked_keys: blocked.map((row) => `${row.slug}:${row.code}`).sort(),
    exact_decisions: reviewed.map((row) => ({
      course_key: row.course_key,
      decision: row.strict_formula_rejection_audit.decision,
      source_response_sha256:
        row.strict_formula_rejection_audit.source_response_sha256,
      raw_entry_sha256: row.strict_formula_rejection_audit.raw_entry_sha256,
      required_clause_sha256:
        row.strict_formula_rejection_audit.required_clause_sha256,
      decision_reason: row.strict_formula_rejection_audit.decision_reason,
    })),
    complete: reviewed.length === expectedKeys.length
      && sameJson([...reviewedKeys].sort(), expectedKeys)
      && rowsValid,
  };
}

function buildUniversityPrerequisiteReview({ scope, candidates }) {
  const candidateByKey = new Map(candidates.candidates.map((row) => [row.course_key, row]));
  const bridgewaterScope = scope.universities.find((row) => row.slug === BRIDGEWATER_SLUG);
  const bridgewaterManifest = candidates.capture_manifest.find(
    (row) => row.slug === BRIDGEWATER_SLUG,
  );
  const bridgewaterMarkerControl = bridgewaterCleanCatalogMarkerControl(
    candidates.candidates,
    bridgewaterScope ? [
      ...requiredResidentPathCourseCodes(bridgewaterScope),
      ...asArray(bridgewaterManifest?.closure_review_candidate_codes),
    ] : [],
  );
  const uvaWiseMarkerControl = uvaWiseAcalogMarkerControl(candidates.candidates);
  const shenandoahMarkerControl = shenandoahAcalogMarkerControl(candidates.candidates);
  const cnuEngl123Control = cnuEngl123MarkerControl(candidates.candidates);
  const longwoodClosureControl = buildLongwoodPrerequisiteClosureControlFromCandidates(
    candidates.candidates,
  );
  const oldDominionClosureControl = buildOldDominionPrerequisiteMarkerControlFromCandidates(
    candidates.candidates,
  );
  const vcuPrerequisiteControl = buildVcuPrerequisiteControlFromCandidates(
    candidates.candidates,
  );
  const virginiaTechRecursivePrerequisiteControl =
    buildVirginiaTechRecursivePrerequisiteControl(candidates.candidates);
  const smallUniversityPrerequisiteEvidence =
    loadSmallUniversityPrerequisiteEvidence();
  const universityPrerequisiteTailControl =
    loadUniversityPrerequisiteTailControl();
  const radfordRandolphMaconTailEvidence =
    loadRadfordRandolphMaconTailEvidence();
  const remainingUniversityPrerequisiteEvidence =
    loadRemainingUniversityPrerequisiteEvidence();
  const vcuEgmnPrerequisiteEvidence = loadVcuEgmnPrerequisiteEvidence();
  const radfordUvaWiseRecursiveEvidence = loadRadfordUvaWiseRecursiveEvidence();
  const manifestBySlug = new Map(candidates.capture_manifest.map((row) => [row.slug, row]));
  const directRows = [];
  const directKeys = new Set();
  for (const university of scope.universities) {
    const manifest = manifestBySlug.get(university.slug);
    for (const code of requiredResidentPathCourseCodes(university)) {
      const key = `${university.owner_namespace}:${code}`;
      directKeys.add(key);
      const candidate = candidateByKey.get(key);
      directRows.push(candidate
        ? reviewCandidate(candidate, {
          bridgewaterMarkerControl, uvaWiseMarkerControl, shenandoahMarkerControl,
          cnuEngl123Control, longwoodClosureControl, oldDominionClosureControl,
          vcuPrerequisiteControl, virginiaTechRecursivePrerequisiteControl,
          smallUniversityPrerequisiteEvidence,
          universityPrerequisiteTailControl,
          radfordRandolphMaconTailEvidence,
          remainingUniversityPrerequisiteEvidence,
          vcuEgmnPrerequisiteEvidence,
          radfordUvaWiseRecursiveEvidence,
        })
        : missingReviewRow(university, code, manifest));
    }
  }
  const closureRows = candidates.candidates
    .filter((candidate) => !directKeys.has(candidate.course_key))
    .map((candidate) => reviewCandidate(candidate, {
      bridgewaterMarkerControl, uvaWiseMarkerControl, shenandoahMarkerControl,
      cnuEngl123Control, longwoodClosureControl, oldDominionClosureControl,
      vcuPrerequisiteControl, virginiaTechRecursivePrerequisiteControl,
      smallUniversityPrerequisiteEvidence,
      universityPrerequisiteTailControl,
      radfordRandolphMaconTailEvidence,
      remainingUniversityPrerequisiteEvidence,
      vcuEgmnPrerequisiteEvidence,
      radfordUvaWiseRecursiveEvidence,
    }));
  const rows = [...directRows, ...closureRows];
  rows.sort((a, b) => a.course_key.localeCompare(b.course_key));
  directRows.sort((a, b) => a.course_key.localeCompare(b.course_key));
  closureRows.sort((a, b) => a.course_key.localeCompare(b.course_key));
  const promotedRows = rows.filter((row) => PUBLISHABLE.has(row.status));
  for (const owner of new Set(promotedRows.map((row) => row.owner_namespace))) {
    const ownerRows = promotedRows.filter((row) => row.owner_namespace === owner);
    const bundleHash = sourceBundleHashForRows(ownerRows, owner);
    for (const row of ownerRows) row.source_bundle_hash = bundleHash;
  }
  const closure = closureReport(rows, promotedRows, { directKeys });
  const georgeMasonClosureAudit = georgeMasonRecursiveClosureAudit(rows, closure);
  const strictFormulaAudit = strictFormulaRejectionAuditReport(rows);
  const directCount = (status) => directRows.filter((row) => row.status === status).length;
  const closureCount = (status) => closureRows.filter((row) => row.status === status).length;
  const institutionReview = scope.universities.map((university) => {
    const ownerRows = directRows.filter((row) => row.owner_namespace === university.owner_namespace);
    const unparsed = ownerRows.filter((row) => row.status === 'unparsed');
    const missing = ownerRows.filter((row) => row.status === 'missing');
    return {
      school_id: university.school_id,
      slug: university.slug,
      owner_namespace: university.owner_namespace,
      direct_required_rows: ownerRows.length,
      exact_bounded_entry_rows: ownerRows.length - missing.length,
      parsed_exact_formulas: ownerRows.filter((row) => row.status === 'parsed').length,
      explicit_none_rows: ownerRows.filter((row) => row.status === 'none').length,
      unparsed_review_rows: unparsed.length,
      missing_source_entry_rows: missing.length,
      no_explicit_required_statement_rows: unparsed.filter((row) => (
        row.review_reason === 'no_explicit_required_requisite_statement'
      )).length,
      strict_parser_rejected_rows: unparsed.filter((row) => (
        row.review_reason === 'strict_formula_parser_rejected'
      )).length,
      other_evidence_policy_rows: unparsed.filter((row) => ![
        'no_explicit_required_requisite_statement',
        'strict_formula_parser_rejected',
      ].includes(row.review_reason)).length,
      unparsed_codes: unparsed.map((row) => row.code).sort(),
      missing_codes: missing.map((row) => row.code).sort(),
    };
  });
  return {
    schema_version: 1,
    artifact: ARTIFACT,
    snapshot_date: scope.snapshot_date,
    formula_contract: FORMULA,
    authority: AUTHORITY,
    publication_ready: false,
    publication_blocker: closure.complete
      ? 'direct_course_review_incomplete' : 'recursive_prerequisite_closure_incomplete',
    summary: {
      active_universities: scope.universities.length,
      direct_required_rows: directRows.length,
      closure_candidate_rows: closureRows.length,
      bounded_candidates_reviewed: candidates.candidates.length,
      parsed: directCount('parsed'),
      none: directCount('none'),
      unparsed: directCount('unparsed'),
      missing: directCount('missing'),
      closure_parsed: closureCount('parsed'),
      closure_none: closureCount('none'),
      closure_unparsed: closureCount('unparsed'),
      promoted_contract_rows: promotedRows.length,
      publication_rows: 0,
    },
    policy: {
      silence: 'Never infer status=none from null, an unbounded candidate, or an unsupported platform omission. A complete exact entry may become controlled structural none only under its platform-specific, same-source or same-catalog positive-marker contract.',
      promotion: 'Promote only when every character of every required requisite clause is accepted by an institution-specific strict grammar, the prerequisite clause explicitly states none, an exact platform-specific complete-entry structural-silence contract passes, or one finite exact-row policy proves that every retained non-course signal has zero Figure 6 prerequisite/corequisite edge effect.',
      recommendations: 'Recommended prerequisites and corequisites are retained as audit notes but are not modeled as requirements.',
      import: `No reviewed row is publication-importable until all ${directRows.length} direct or deterministic resident-path rows and recursive owner-local references are parsed or explicitly none.`,
    },
    institution_review: institutionReview,
    closure,
    george_mason_recursive_closure_audit: georgeMasonClosureAudit,
    vcu_prerequisite_closure_audit:
      vcuPrerequisiteControlSummary(vcuPrerequisiteControl),
    virginia_tech_recursive_prerequisite_audit:
      summarizeVirginiaTechRecursivePrerequisites(candidates.candidates),
    university_prerequisite_tail_closure_audit:
      universityPrerequisiteTailControlSummary(universityPrerequisiteTailControl),
    radford_randolph_macon_prerequisite_tail_audit:
      radfordRandolphMaconTailEvidenceSummary(radfordRandolphMaconTailEvidence),
    remaining_university_prerequisite_closure_audit: {
      contract: REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
      facts_sha256: remainingUniversityPrerequisiteEvidence.facts_sha256,
      summary: remainingUniversityPrerequisiteEvidence.summary,
    },
    vcu_egmn_prerequisite_closure_audit: {
      contract: VCU_EGMN_PREREQUISITE_CONTRACT,
      facts_sha256: vcuEgmnPrerequisiteEvidence.facts_sha256,
      summary: vcuEgmnPrerequisiteEvidence.summary,
    },
    radford_uva_wise_recursive_prerequisite_audit: {
      contract: RADFORD_UVA_WISE_RECURSIVE_PREREQUISITE_CONTRACT,
      facts_sha256: radfordUvaWiseRecursiveEvidence.facts_sha256,
      summary: radfordUvaWiseRecursiveEvidence.summary,
    },
    strict_formula_rejection_audit: strictFormulaAudit,
    promoted_rows: promotedRows,
    direct_review_rows: directRows,
    closure_review_rows: closureRows,
    review_rows: rows,
  };
}

function groupMatchesPinnedSemantic(row, expectedKind, expectedFlag) {
  const expectedPaths = asArray(row.review_evidence?.semantic_prerequisite?.paths);
  const groups = asArray(row.groups);
  if (groups.length !== 1 || groups[0].kind !== expectedKind
      || !asArray(groups[0].flags).includes(expectedFlag)
      || groups[0].formula !== FORMULA
      || groups[0].paths.length !== expectedPaths.length) return false;
  return expectedPaths.every((expectedPath, pathIndex) => {
    const actual = asArray(groups[0].paths[pathIndex]?.all_of);
    const expected = asArray(expectedPath.all_of);
    if (actual.length !== expected.length) return false;
    return expected.every((condition, conditionIndex) => Object.entries(condition)
      .every(([key, value]) => (
        JSON.stringify(actual[conditionIndex]?.[key]) === JSON.stringify(value)
      )));
  });
}

function validateUniversityPrerequisiteReview(artifact, { scope, candidates } = {}) {
  const issues = [];
  if (artifact?.schema_version !== 1) issues.push('schema_version');
  if (artifact?.artifact !== ARTIFACT) issues.push('artifact');
  if (artifact?.formula_contract !== FORMULA) issues.push('formula_contract');
  if (artifact?.publication_ready !== false) issues.push('publication_ready_must_remain_false');
  if (artifact?.summary?.publication_rows !== 0) issues.push('publication_rows_must_remain_zero');
  const rows = asArray(artifact?.review_rows);
  const directRows = asArray(artifact?.direct_review_rows);
  const closureRows = asArray(artifact?.closure_review_rows);
  const promoted = asArray(artifact?.promoted_rows);
  const rebuiltStrictFormulaAudit = strictFormulaRejectionAuditReport(rows);
  if (!sameJson(artifact?.strict_formula_rejection_audit, rebuiltStrictFormulaAudit)
      || !rebuiltStrictFormulaAudit.complete) {
    issues.push('strict_formula_rejection_audit');
  }
  for (const issue of georgeMasonOutsideFormulaIssues(artifact)) {
    issues.push(`gmu_recursive_closure:${issue}`);
  }
  const bridgewaterScope = asArray(scope?.universities)
    .find((row) => row.slug === BRIDGEWATER_SLUG);
  const bridgewaterManifest = asArray(candidates?.capture_manifest)
    .find((row) => row.slug === BRIDGEWATER_SLUG);
  const recomputedBridgewaterMarkerControl = candidates && bridgewaterScope
    ? bridgewaterCleanCatalogMarkerControl(
      candidates.candidates, [
        ...requiredResidentPathCourseCodes(bridgewaterScope),
        ...asArray(bridgewaterManifest?.closure_review_candidate_codes),
      ],
    ) : null;
  const recomputedUvaWiseMarkerControl = candidates
    ? uvaWiseAcalogMarkerControl(candidates.candidates) : null;
  const recomputedShenandoahMarkerControl = candidates
    ? shenandoahAcalogMarkerControl(candidates.candidates) : null;
  const recomputedCnuEngl123Control = candidates
    ? cnuEngl123MarkerControl(candidates.candidates) : null;
  const recomputedLongwoodClosureControl = candidates
    ? buildLongwoodPrerequisiteClosureControlFromCandidates(candidates.candidates) : null;
  const recomputedOldDominionClosureControl = candidates
    ? buildOldDominionPrerequisiteMarkerControlFromCandidates(candidates.candidates) : null;
  const recomputedVcuPrerequisiteControl = candidates
    ? buildVcuPrerequisiteControlFromCandidates(candidates.candidates) : null;
  const recomputedVirginiaTechRecursivePrerequisiteControl = candidates
    ? buildVirginiaTechRecursivePrerequisiteControl(candidates.candidates) : null;
  const recomputedSmallUniversityPrerequisiteEvidence = candidates
    ? loadSmallUniversityPrerequisiteEvidence() : null;
  const recomputedUniversityPrerequisiteTailControl = candidates
    ? loadUniversityPrerequisiteTailControl() : null;
  const recomputedRadfordRandolphMaconTailEvidence = candidates
    ? loadRadfordRandolphMaconTailEvidence() : null;
  const recomputedRemainingUniversityPrerequisiteEvidence = candidates
    ? loadRemainingUniversityPrerequisiteEvidence() : null;
  const recomputedVcuEgmnPrerequisiteEvidence = candidates
    ? loadVcuEgmnPrerequisiteEvidence() : null;
  const recomputedRadfordUvaWiseRecursiveEvidence = candidates
    ? loadRadfordUvaWiseRecursiveEvidence() : null;
  if (candidates && (
    !sameJson(
      artifact?.vcu_prerequisite_closure_audit,
      vcuPrerequisiteControlSummary(recomputedVcuPrerequisiteControl),
    ) || recomputedVcuPrerequisiteControl?.verified !== true
  )) issues.push('vcu_prerequisite_closure_audit');
  if (candidates && (
    !sameJson(
      artifact?.virginia_tech_recursive_prerequisite_audit,
      summarizeVirginiaTechRecursivePrerequisites(candidates.candidates),
    ) || recomputedVirginiaTechRecursivePrerequisiteControl?.verified !== true
  )) issues.push('virginia_tech_recursive_prerequisite_audit');
  if (candidates && smallUniversityPrerequisiteArtifactIssues(
    recomputedSmallUniversityPrerequisiteEvidence,
  ).length) issues.push('small_university_prerequisite_closure_evidence');
  if (candidates && (
    recomputedUniversityPrerequisiteTailControl?.verified !== true
      || !sameJson(
        artifact?.university_prerequisite_tail_closure_audit,
        universityPrerequisiteTailControlSummary(
          recomputedUniversityPrerequisiteTailControl,
        ),
      )
  )) issues.push('university_prerequisite_tail_closure_audit');
  if (candidates && (
    radfordRandolphMaconTailEvidenceIssues(
      recomputedRadfordRandolphMaconTailEvidence,
    ).length
      || !sameJson(
        artifact?.radford_randolph_macon_prerequisite_tail_audit,
        radfordRandolphMaconTailEvidenceSummary(
          recomputedRadfordRandolphMaconTailEvidence,
        ),
      )
  )) issues.push('radford_randolph_macon_prerequisite_tail_audit');
  if (candidates && (
    remainingUniversityPrerequisiteEvidenceIssues(
      recomputedRemainingUniversityPrerequisiteEvidence,
    ).length
      || !sameJson(artifact?.remaining_university_prerequisite_closure_audit, {
        contract: REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT,
        facts_sha256: recomputedRemainingUniversityPrerequisiteEvidence.facts_sha256,
        summary: recomputedRemainingUniversityPrerequisiteEvidence.summary,
      })
  )) issues.push('remaining_university_prerequisite_closure_audit');
  if (candidates && (
    vcuEgmnPrerequisiteEvidenceIssues(recomputedVcuEgmnPrerequisiteEvidence).length
      || !sameJson(artifact?.vcu_egmn_prerequisite_closure_audit, {
        contract: VCU_EGMN_PREREQUISITE_CONTRACT,
        facts_sha256: recomputedVcuEgmnPrerequisiteEvidence.facts_sha256,
        summary: recomputedVcuEgmnPrerequisiteEvidence.summary,
      })
  )) issues.push('vcu_egmn_prerequisite_closure_audit');
  if (candidates && (
    radfordUvaWiseRecursiveEvidenceIssues(
      recomputedRadfordUvaWiseRecursiveEvidence,
    ).length
      || !sameJson(artifact?.radford_uva_wise_recursive_prerequisite_audit, {
        contract: RADFORD_UVA_WISE_RECURSIVE_PREREQUISITE_CONTRACT,
        facts_sha256: recomputedRadfordUvaWiseRecursiveEvidence.facts_sha256,
        summary: recomputedRadfordUvaWiseRecursiveEvidence.summary,
      })
  )) issues.push('radford_uva_wise_recursive_prerequisite_audit');
  const keys = new Set();
  for (const row of rows) {
    if (keys.has(row.course_key)) issues.push(`${row.course_key}:duplicate`);
    keys.add(row.course_key);
    if (!['parsed', 'none', 'unparsed', 'missing'].includes(row.status)) issues.push(`${row.course_key}:status`);
    if (row.status === 'parsed' && !asArray(row.groups).length) issues.push(`${row.course_key}:parsed_groups`);
    if (row.status === 'none' && (row.raw_requisites != null || asArray(row.groups).length)) issues.push(`${row.course_key}:none_contract`);
    if (row.status === 'parsed' || row.status === 'none') {
      if (row.source !== AUTHORITY) issues.push(`${row.course_key}:authority`);
      if (!row.source_url || !row.source_bundle_hash) issues.push(`${row.course_key}:source`);
    }
    for (const issue of vsuEnglishProjectionRowIssues(row)) {
      issues.push(`${row.course_key}:vsu_english_cs_scope_projection:${issue}`);
    }
    for (const issue of vsuPrerequisiteClosureResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:vsu_prerequisite_closure:${issue}`);
    }
    for (const issue of norfolkStateCsc295ResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:nsu_csc295_resolution:${issue}`);
    }
    for (const issue of norfolkStatePrerequisiteClosureResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:nsu_prerequisite_closure:${issue}`);
    }
    if (!isScopedRemainingUniversityPrerequisite(row)
        && !isScopedVcuEgmnPrerequisite(row)) {
      for (const issue of vcuPrerequisiteResolutionRowIssues(row)) {
        issues.push(`${row.course_key}:vcu_prerequisite_closure:${issue}`);
      }
    }
    for (const issue of virginiaTechRecursivePrerequisiteResolutionRowIssues?.(row) || []) {
      issues.push(`${row.course_key}:virginia_tech_recursive_prerequisite:${issue}`);
    }
    for (const issue of smallUniversityPrerequisiteResolutionRowIssues(
      row, recomputedSmallUniversityPrerequisiteEvidence,
    )) {
      issues.push(`${row.course_key}:small_university_prerequisite_closure:${issue}`);
    }
    for (const issue of universityPrerequisiteTailResolutionRowIssues(
      row, recomputedUniversityPrerequisiteTailControl,
    )) {
      issues.push(`${row.course_key}:university_prerequisite_tail_closure:${issue}`);
    }
    for (const issue of radfordRandolphMaconTailResolutionRowIssues(
      row, recomputedRadfordRandolphMaconTailEvidence,
    )) {
      issues.push(`${row.course_key}:radford_randolph_macon_tail:${issue}`);
    }
    for (const issue of remainingUniversityPrerequisiteResolutionRowIssues(
      row, recomputedRemainingUniversityPrerequisiteEvidence,
    )) {
      issues.push(`${row.course_key}:remaining_university_prerequisite:${issue}`);
    }
    for (const issue of vcuEgmnPrerequisiteResolutionRowIssues(
      row, recomputedVcuEgmnPrerequisiteEvidence,
    )) {
      issues.push(`${row.course_key}:vcu_egmn_prerequisite:${issue}`);
    }
    for (const issue of radfordUvaWiseRecursiveResolutionRowIssues(
      row, recomputedRadfordUvaWiseRecursiveEvidence,
    )) {
      issues.push(`${row.course_key}:radford_uva_wise_recursive:${issue}`);
    }
    for (const issue of georgeMasonSilenceResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:gmu_required_requisite_silence:${issue}`);
    }
    for (const issue of georgeMasonClosureResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:gmu_recursive_closure_resolution:${issue}`);
    }
    for (const issue of cachedCyseResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:gmu_cached_cyse_resolution:${issue}`);
    }
    for (const issue of cnuEngl123ResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:cnu_engl123_resolution:${issue}`);
    }
    for (const issue of oldDominionResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:odu_closure_resolution:${issue}`);
    }
    for (const issue of figure6NonCourseDispositionResolutionRowIssues(row)) {
      issues.push(`${row.course_key}:figure6_noncourse_disposition:${issue}`);
    }
    if (row.review_evidence) {
      if (sha256(row.review_evidence.raw_entry_text) !== row.review_evidence.raw_entry_sha256) {
        issues.push(`${row.course_key}:entry_hash`);
      }
      for (const clause of row.review_evidence.clauses || []) {
        if (sha256(clause.raw) !== clause.raw_clause_sha256) issues.push(`${row.course_key}:clause_hash`);
        const relativeStart = clause.source_character_start
          - row.review_evidence.entry_character_start;
        const relativeEnd = clause.source_character_end
          - row.review_evidence.entry_character_start;
        if (row.review_evidence.raw_entry_text.slice(relativeStart, relativeEnd) !== clause.raw) {
          issues.push(`${row.course_key}:clause_offsets`);
        }
      }
      for (const ignored of row.ignored_nonrequired_requisites || []) {
        if (!ignored || typeof ignored !== 'object') continue;
        const relativeStart = ignored.source_character_start
          - row.review_evidence.entry_character_start;
        const relativeEnd = ignored.source_character_end
          - row.review_evidence.entry_character_start;
        if (sha256(ignored.raw) !== ignored.raw_sha256
            || row.review_evidence.raw_entry_text.slice(relativeStart, relativeEnd)
              !== ignored.raw) {
          issues.push(`${row.course_key}:ignored_recommendation_evidence`);
        }
      }
      const internalComponents = asArray(row.internal_component_corequisites);
      for (const internal of internalComponents) {
        const relativeStart = internal.source_character_start
          - row.review_evidence.entry_character_start;
        const relativeEnd = internal.source_character_end
          - row.review_evidence.entry_character_start;
        if (sha256(internal.raw) !== internal.raw_sha256
            || row.review_evidence.raw_entry_text.slice(relativeStart, relativeEnd)
              !== internal.raw) {
          issues.push(`${row.course_key}:internal_component_evidence`);
        }
      }
      const vsuPhysicsReceipt = row.slug === 'virginia-state-university'
        ? VSU_PHYSICS_COMBINED_COMPONENT_RECEIPTS[row.code]
        : null;
      if (vsuPhysicsReceipt) {
        const evidence = row.review_evidence;
        const replayCandidate = {
          school_id: row.school_id,
          slug: row.slug,
          owner_namespace: row.owner_namespace,
          course_key: row.course_key,
          course_code: row.code,
          row_status: evidence.candidate_row_status,
          source: {
            official_url: evidence.official_url,
            declared_normalized_text_sha256:
              evidence.declared_normalized_text_sha256,
            retained_normalized_text_sha256:
              evidence.retained_normalized_text_sha256,
            character_start: evidence.entry_character_start,
            character_end: evidence.entry_character_end,
            heading_text: evidence.heading_text,
            raw_entry_sha256: evidence.raw_entry_sha256,
            raw_entry_text: evidence.raw_entry_text,
            capture_origin: evidence.capture_origin,
            source_format: evidence.source_format,
            boundary_contract: evidence.boundary_contract,
            catalog_year_verified: evidence.catalog_year_verified,
            source_response_sha256: evidence.source_response_sha256,
            source_response_bytes: evidence.source_response_bytes,
            cache_path: evidence.cache_path,
            courseblock_index: evidence.courseblock_index,
            published_units: evidence.published_units,
            raw_entry_html_sha256: evidence.raw_entry_html_sha256,
            complete_entry_receipt: evidence.complete_entry_receipt,
            structured_requisite_fields: evidence.structured_requisite_fields,
          },
        };
        const extracted = extractRequiredClauses(replayCandidate);
        const expected = resolveVsuPhysicsCombinedComponents(
          replayCandidate, extracted.clauses,
        );
        if (!expected.ready) {
          if (row.status !== 'unparsed'
              || row.review_status !== 'not_promoted'
              || row.review_reason !== 'vsu_combined_component_receipt_mismatch'
              || asArray(row.groups).length !== 0
              || internalComponents.length !== 0
              || !sameJson(
                row.vsu_physics_combined_component_resolution, expected,
              )) {
            issues.push(`${row.course_key}:vsu_physics_component_receipt`);
          }
        } else {
          const {
            groups: expectedGroups,
            internal_components: expectedInternal,
            ...expectedResolution
          } = expected;
          if (row.status !== 'parsed'
              || row.review_status !== 'promoted_strict_formula'
              || row.review_reason
                !== 'exact_vsu_combined_lecture_laboratory_component_receipt'
              || row.raw_requisites
                !== exactRequisiteSourceText(replayCandidate, extracted.clauses)
              || !sameJson(row.groups, expectedGroups)
              || !sameJson(internalComponents, expectedInternal)
              || !sameJson(
                row.vsu_physics_combined_component_resolution,
                expectedResolution,
              )
              || asArray(row.groups).flatMap((group) => asArray(group.paths))
                .flatMap((path) => asArray(path.all_of))
                .some((condition) => condition.course_key === row.course_key)) {
            issues.push(`${row.course_key}:vsu_physics_component_receipt`);
          }
        }
      }
      const exactVsuBiol121Entry = row.slug
          === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.slug
        && row.code === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.code
        && row.review_evidence.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT
        && row.review_evidence.source_response_sha256
          === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.source_response_sha256
        && row.review_evidence.raw_entry_sha256
          === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.raw_entry_sha256
        && row.review_evidence.raw_entry_html_sha256
          === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.raw_entry_html_sha256;
      if (exactVsuBiol121Entry) {
        const expected = VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.clauses;
        if (internalComponents.length !== expected.length
            || expected.some((receipt) => !internalComponents.some((internal) => (
              internal.kind
                === 'same_catalog_code_internal_lecture_laboratory_corequisite'
              && internal.course_code === VSU_BIOL121_INTERNAL_COMPONENT_RECEIPT.code
              && internal.component === receipt.component
              && internal.raw === receipt.raw
              && internal.raw_sha256 === receipt.raw_sha256
              && internal.graph_edge_emitted === false
            )))) {
          issues.push(`${row.course_key}:vsu_biol121_internal_components`);
        }
      } else if (!vsuPhysicsReceipt
          && !isScopedVirginiaStatePrerequisite(row)
          && internalComponents.length) {
        issues.push(`${row.course_key}:unexpected_internal_components`);
      }
      if (row.review_evidence.boundary_contract === COURSELEAF_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const receipt = evidence.complete_entry_receipt;
        const markers = requisiteMarkerCounts(evidence.raw_entry_text);
        if (evidence.capture_origin !== 'official_acquisition'
            || evidence.source_format !== 'courseleaf_courseblock'
            || evidence.source_response_sha256 !== evidence.declared_normalized_text_sha256
            || evidence.source_response_sha256 !== evidence.retained_normalized_text_sha256
            || !/^[a-f0-9]{64}$/.test(evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(evidence.raw_entry_html_sha256 || '')
            || !Number.isInteger(evidence.courseblock_index)
            || !evidence.published_units
            || !(evidence.published_units.credit_hours_min >= 0)
            || evidence.published_units.credit_hours_max
              < evidence.published_units.credit_hours_min) {
          issues.push(`${row.course_key}:courseleaf_boundary_receipt`);
        }
        if (receipt?.receipt_contract !== COURSELEAF_RECEIPT_CONTRACT
            || receipt.entry_required_requisite_marker_count !== markers.required
            || receipt.entry_corequisite_marker_count !== markers.corequisite
            || receipt.entry_requisite_marker_like_count !== markers.marker_like
            || receipt.entry_constraint_like_signal_count !== markers.constraint_like
            || receipt.same_source_positive_control !== (
              receipt.source_complete_entries_with_required_requisite_marker_count
                > (markers.required > 0 ? 1 : 0)
            )) {
          issues.push(`${row.course_key}:courseleaf_marker_control`);
        }
        if (evidence.browser_challenge_contract) {
          const documentReceipt = validateBrowserChallengeReceipt(
            evidence.browser_challenge_receipt,
            {
              expectedUrl: evidence.official_url,
              expectedFinalContentType: 'text/html',
              expectedFinalSha256: evidence.source_response_sha256,
            },
          );
          const sourceUrl = new URL(evidence.official_url);
          const robotsReceipt = validateBrowserRobotsReceipt(evidence.robots_receipt, {
            origin: sourceUrl.origin,
            checkedPath: sourceUrl.pathname,
          });
          if (evidence.browser_challenge_contract !== BROWSER_CHALLENGE_CONTRACT
              || !documentReceipt.valid || !robotsReceipt.valid
              || !exactKnownBrowserResource({
                slug: row.slug,
                platform: 'browser_challenge_courseleaf',
                officialUrl: evidence.official_url,
                targetSubjectPrefix: evidence.target_subject_prefix,
              })) issues.push(`${row.course_key}:browser_challenge_receipt`);
          if ([JMU_SLUG, VIRGINIA_TECH_SLUG].includes(row.slug)
              && !structuredCourseLeafRequisiteFieldsValid({
                ...evidence,
                slug: row.slug,
              })) issues.push(`${row.course_key}:browser_structured_requisite_fields`);
          if (row.slug === JMU_SLUG && (
            evidence.published_units?.structural_field !== 'unique_detail-hours_html'
            || !/^[a-f0-9]{64}$/.test(
              evidence.published_units?.structural_field_html_sha256 || '',
            )
          )) issues.push(`${row.course_key}:jmu_structured_units_receipt`);
          if (row.slug === VIRGINIA_TECH_SLUG && (
            evidence.sitemap_discovery_receipt?.discovery_contract
              !== VIRGINIA_TECH_SITEMAP_DISCOVERY_CONTRACT
            || evidence.sitemap_discovery_receipt?.discovered_course_url
              !== evidence.official_url
            || evidence.sitemap_discovery_receipt?.path_discovered !== true
          )) issues.push(`${row.course_key}:virginia_tech_sitemap_receipt`);
        }
        if (row.slug === VIRGINIA_TECH_SLUG && !evidence.browser_challenge_contract && (
          evidence.catalog_year_verified !== VIRGINIA_TECH_CATALOG_YEAR
          || evidence.official_url !== VIRGINIA_TECH_CS_DEPARTMENT_URL
          || evidence.cache_path !== VIRGINIA_TECH_CS_HTML_CACHE_PATH
          || evidence.source_response_sha256 !== VIRGINIA_TECH_CS_HTML_SHA256
          || evidence.retained_source_contract !== VIRGINIA_TECH_RETAINED_SOURCE_CONTRACT
          || evidence.retained_source_text_cache_path
            !== VIRGINIA_TECH_CS_TEXT_CACHE_PATH
          || evidence.retained_source_text_sha256 !== VIRGINIA_TECH_CS_TEXT_SHA256
          || evidence.live_recapture_claim !== false
        )) issues.push(`${row.course_key}:virginia_tech_retained_source_receipt`);
        if (row.review_status === 'promoted_structural_none'
            && row.structural_none_evidence?.contract
              !== SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT) {
          const structural = row.structural_none_evidence;
          const exactGeorgeMasonSilence =
            isScopedGeorgeMasonPrerequisiteSilence(row)
              && row.review_reason === GEORGE_MASON_SILENCE_REVIEW_REASON;
          const exactGeorgeMasonClosure =
            georgeMasonClosureResolutionRowIssues(row).length === 0
              && GEORGE_MASON_CLOSURE_CODES.includes(row.code)
              && row.owner_namespace === 'va:uni:9210';
          const exactGeorgeMasonCachedCyse =
            cachedCyseResolutionRowIssues(row).length === 0
              && GEORGE_MASON_CACHE_REACQUIRE_CODES.includes(row.code)
              && row.owner_namespace === 'va:uni:9210';
          const exactOldDominionClosure = oldDominionResolutionRowIssues(row).length === 0
            && row.structural_none_evidence?.kind
              === 'official_complete_odu_courseleaf_entry_structural_silence_with_same_response_positive_control';
          const exactVirginiaStateClosure = isScopedVirginiaStatePrerequisite(row)
            && row.structural_none_evidence?.contract
              === VSU_PREREQUISITE_CLOSURE_CONTRACT
            && vsuPrerequisiteClosureResolutionRowIssues(row).length === 0;
          const exactNorfolkStateClosure = isScopedNorfolkStatePrerequisite(row)
            && row.structural_none_evidence?.contract
              === NORFOLK_STATE_PREREQUISITE_CLOSURE_CONTRACT
            && norfolkStatePrerequisiteClosureResolutionRowIssues(row).length === 0;
          const exactVcuClosure = row.structural_none_evidence?.contract
              === VCU_PREREQUISITE_CLOSURE_CONTRACT
            && row.structural_none_evidence?.kind
              === VCU_PREREQUISITE_STRUCTURAL_NONE_KIND
            && vcuPrerequisiteResolutionRowIssues(row).length === 0;
          const exactFigure6NonCourseDisposition =
            row.structural_none_evidence?.contract
              === FIGURE6_NONCOURSE_DISPOSITION_CONTRACT
            && row.structural_none_evidence?.kind
              === FIGURE6_NONCOURSE_STRUCTURAL_NONE_KIND
            && figure6NonCourseDispositionResolutionRowIssues(row).length === 0;
          const exactSmallUniversityClosure =
            isScopedSmallUniversityPrerequisite(row)
            && row.structural_none_evidence?.contract
              === SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT
            && smallUniversityPrerequisiteResolutionRowIssues(
              row, recomputedSmallUniversityPrerequisiteEvidence,
            ).length === 0;
          const exactUniversityPrerequisiteTail =
            isScopedUniversityPrerequisiteTail(row)
            && row.structural_none_evidence?.contract
              === UNIVERSITY_PREREQUISITE_TAIL_CONTRACT
            && universityPrerequisiteTailResolutionRowIssues(
              row, recomputedUniversityPrerequisiteTailControl,
            ).length === 0;
          const exactRadfordRandolphMaconTail =
            isScopedRadfordRandolphMaconTail(row)
            && row.structural_none_evidence?.contract
              === RADFORD_RANDOLPH_MACON_TAIL_CONTRACT
            && radfordRandolphMaconTailResolutionRowIssues(
              row, recomputedRadfordRandolphMaconTailEvidence,
            ).length === 0;
          const exactRemainingUniversityPrerequisite =
            row.structural_none_evidence?.contract
              === REMAINING_UNIVERSITY_PREREQUISITE_CONTRACT
            && remainingUniversityPrerequisiteResolutionRowIssues(
              row, recomputedRemainingUniversityPrerequisiteEvidence,
            ).length === 0;
          const exactVcuEgmnPrerequisite =
            row.structural_none_evidence?.contract === VCU_EGMN_PREREQUISITE_CONTRACT
            && vcuEgmnPrerequisiteResolutionRowIssues(
              row, recomputedVcuEgmnPrerequisiteEvidence,
            ).length === 0;
          if (!exactGeorgeMasonSilence && !exactGeorgeMasonClosure
              && !exactGeorgeMasonCachedCyse && !exactOldDominionClosure
              && !exactVirginiaStateClosure && !exactNorfolkStateClosure
              && !exactVcuClosure && !exactFigure6NonCourseDisposition
              && !exactSmallUniversityClosure
              && !exactUniversityPrerequisiteTail
              && !exactRadfordRandolphMaconTail
              && !exactRemainingUniversityPrerequisite
              && !exactVcuEgmnPrerequisite
              && (row.status !== 'none'
              || row.review_reason
                !== 'complete_courseleaf_entry_silence_with_same_source_required_marker_control'
              || structural?.kind
                !== 'official_complete_entry_structural_silence_with_same_source_positive_control'
              || structural?.source_response_sha256 !== evidence.source_response_sha256
              || structural?.raw_entry_sha256 !== evidence.raw_entry_sha256
              || structural?.raw_entry_html_sha256 !== evidence.raw_entry_html_sha256
              || structural?.courseblock_index !== evidence.courseblock_index
              || JSON.stringify(structural?.published_units)
                !== JSON.stringify(evidence.published_units)
              || JSON.stringify(structural?.marker_control) !== JSON.stringify(receipt)
              || markers.required !== 0 || markers.corequisite !== 0
              || markers.marker_like !== 0 || markers.constraint_like !== 0
              || receipt.same_source_positive_control !== true)) {
            issues.push(`${row.course_key}:courseleaf_structural_none`);
          }
        }
      }
      if (row.review_evidence.boundary_contract === CNU_ALIAS_RECEIPT_CONTRACT) {
        const evidence = row.review_evidence;
        const sourceProjection = {
          ...evidence,
          slug: row.slug,
          owner_namespace: row.owner_namespace,
          course_key: row.course_key,
          course_code: row.code,
        };
        const expectedOfficialEvidence =
          `${evidence.program_requirement?.exact_requirement_text}\n${evidence.raw_entry_text}`;
        const clause = evidence.clauses?.[0];
        if (evidence.source_format !== 'cnu_current_joint_identity_pdf_entry'
            || evidence.cache_path !== CNU_CPEN371W_SOURCE_CACHE_PATH
            || evidence.evidence_cache_path !== CNU_CPEN371W_EVIDENCE_CACHE_PATH
            || evidence.evidence_artifact_sha256 !== CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256
            || cnuCpen371wEntryIssue(sourceProjection)
            || evidence.clauses?.length !== 1
            || evidence.required_requisite_clause?.receipt_contract
              !== CNU_CLAUSE_RECEIPT_CONTRACT
            || clause?.raw !== evidence.required_requisite_clause?.raw
            || row.status !== 'parsed'
            || row.review_status !== 'promoted_strict_formula'
            || row.raw_requisites
              !== 'Prerequisites: ENGL 223 with a C- or higher; major or minor in PCSE.'
            || row.source_evidence?.raw_text !== expectedOfficialEvidence
            || row.source_content_sha256 !== sha256(expectedOfficialEvidence)
            || !groupMatchesPinnedSemantic(
              row,
              'prerequisite',
              'cnu_cpen371w_exact_target_only_alias_formula',
            )) {
          issues.push(`${row.course_key}:cnu_cpen371w_review_receipt`);
        }
      }
      if (row.review_evidence.boundary_contract === VSU_ARABIC_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const sourceProjection = {
          ...evidence,
          slug: row.slug,
          owner_namespace: row.owner_namespace,
          course_key: row.course_key,
          course_code: row.code,
        };
        const arab110 = row.code === 'ARAB110';
        const receipt = arab110
          ? evidence.enrollment_restriction : evidence.required_requisite_clause;
        const expectedKind = 'prerequisite';
        const expectedFlag = arab110
          ? 'vsu_arab110_exact_noncourse_enrollment_restriction'
          : 'vsu_arabic_exact_course_or_equivalent_formula';
        if (evidence.source_format !== 'vsu_languages_department_courseblock'
            || evidence.cache_path !== VSU_ARABIC_SOURCE_CACHE_PATH
            || evidence.evidence_cache_path !== VSU_ARABIC_EVIDENCE_CACHE_PATH
            || evidence.evidence_artifact_sha256 !== VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256
            || vsuArabicEntryIssue(sourceProjection)
            || evidence.clauses?.length !== 1
            || receipt?.receipt_contract !== (arab110
              ? VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT
              : VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT)
            || row.status !== 'parsed'
            || row.review_status !== 'promoted_strict_formula'
            || row.source_evidence?.raw_text !== evidence.raw_entry_text
            || row.source_content_sha256 !== evidence.raw_entry_sha256
            || !groupMatchesPinnedSemantic(row, expectedKind, expectedFlag)) {
          issues.push(`${row.course_key}:vsu_arabic_review_receipt`);
        }
      }
      if (row.review_evidence.boundary_contract
          === VIRGINIA_TECH_GRADUATE_CS_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const sourceProjection = {
          ...evidence,
          slug: row.slug,
          owner_namespace: row.owner_namespace,
          course_key: row.course_key,
          course_code: row.code,
        };
        const structuralNone = row.code === 'CS5104';
        const exactStatus = structuralNone
          ? row.status === 'none'
            && row.review_status === 'promoted_structural_none'
            && row.review_reason
              === 'complete_current_virginia_tech_graduate_cs_entry_silence_with_same_page_pre_controls'
            && row.groups.length === 0
            && row.raw_requisites === null
            && row.structural_none_evidence?.receipt_contract
              === VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT
            && row.structural_none_evidence?.marker_control?.missing_search_result_used
              === false
          : row.status === 'parsed'
            && row.review_status === 'promoted_strict_formula'
            && row.review_reason
              === 'every_required_clause_character_accounted_for_by_strict_grammar'
            && row.raw_requisites === 'Pre: CS3114'
            && evidence.clauses?.length === 1
            && evidence.required_requisite_clause?.receipt_contract
              === VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT
            && groupMatchesPinnedSemantic(
              row,
              'prerequisite',
              'virginia_tech_cs5114_exact_pre_cs3114',
            );
        if (evidence.source_format
              !== 'virginia_tech_current_graduate_cs_heading_entry'
            || evidence.cache_path !== VIRGINIA_TECH_GRADUATE_CS_SOURCE_CACHE_PATH
            || evidence.evidence_cache_path
              !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_CACHE_PATH
            || evidence.evidence_artifact_sha256
              !== VIRGINIA_TECH_GRADUATE_CS_EVIDENCE_ARTIFACT_SHA256
            || virginiaTechGraduateCsEntryIssue(sourceProjection)
            || row.source_evidence?.raw_text !== evidence.raw_entry_text
            || row.source_content_sha256 !== evidence.raw_entry_sha256
            || !exactStatus) {
          issues.push(`${row.course_key}:virginia_tech_graduate_cs_review_receipt`);
        }
      }
      if (row.review_evidence.boundary_contract === RADFORD_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const expected = RADFORD_COURSE_RECORDS[row.code];
        const closureExpected = RADFORD_CLOSURE_COURSE_RECORDS[row.code];
        const expectedDiscoveryContract = closureExpected
          ? RADFORD_RETAINED_ENTRY_DISCOVERY_CONTRACT : RADFORD_DISCOVERY_CONTRACT;
        const expectedDiscoveryCachePath = closureExpected?.discovery_cache_path
          || RADFORD_PROGRAM_CACHE_PATH;
        const expectedDiscoveryResponseSha256 = closureExpected?.discovery_response_sha256
          || RADFORD_PROGRAM_HTML_SHA256;
        const discovery = evidence.discovery_link_receipt;
        const clause = evidence.required_requisite_clause;
        const markerCount = (evidence.raw_entry_text.match(/\bPrerequisites?:/gi) || []).length;
        const reviewedClause = evidence.clauses?.[0];
        const encouraged = asArray(row.ignored_nonrequired_requisites).filter((ignored) => (
          ignored?.kind === 'explicit_encouraged_contact_suffix_not_modeled'
        ));
        const exactClauseProjection = clause && reviewedClause && (
          reviewedClause.raw === clause.raw
          || (encouraged.length === 1
            && `${reviewedClause.raw} ${encouraged[0].raw}` === clause.raw
            && encouraged[0].source_character_start === reviewedClause.source_character_end + 1
            && encouraged[0].source_character_end
              === evidence.entry_character_start + clause.relative_end)
        );
        let sourceUrl = null;
        try { sourceUrl = new URL(row.source_url); } catch { /* recorded below */ }
        if (row.slug !== RADFORD_SLUG || !expected
            || evidence.capture_origin !== 'official_radford_acalog_course_page'
            || evidence.source_format !== 'radford_acalog_course_page'
            || evidence.catalog_year_verified !== RADFORD_CATALOG_YEAR
            || sourceUrl?.protocol !== 'https:'
            || sourceUrl?.hostname.toLowerCase() !== RADFORD_HOST
            || sourceUrl?.pathname !== '/preview_course_nopop.php'
            || Number(sourceUrl?.searchParams.get('catoid')) !== RADFORD_CATOID
            || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
            || evidence.catoid !== RADFORD_CATOID || evidence.coid !== expected?.coid
            || evidence.source_response_sha256 !== evidence.declared_normalized_text_sha256
            || evidence.source_response_sha256 !== evidence.retained_normalized_text_sha256
            || !/^[a-f0-9]{64}$/.test(evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(evidence.raw_entry_html_sha256 || '')
            || !evidence.published_units
            || !(evidence.published_units.credit_hours_min > 0)
            || evidence.published_units.credit_hours_max
              < evidence.published_units.credit_hours_min
            || evidence.discovery_contract !== expectedDiscoveryContract
            || evidence.discovery_cache_path !== expectedDiscoveryCachePath
            || evidence.discovery_response_sha256 !== expectedDiscoveryResponseSha256
            || discovery?.course_code !== row.code
            || discovery?.catoid !== RADFORD_CATOID
            || discovery?.coid !== expected?.coid
            || (closureExpected
              ? discovery?.discovery_course_code !== closureExpected.discovery_course_code
              : discovery?.title !== expected?.title)
            || evidence.robots_crawl_delay_seconds !== 120) {
          issues.push(`${row.course_key}:radford_boundary_receipt`);
        }
        if (markerCount !== (clause ? 1 : 0)
            || (clause && (clause.receipt_contract !== RADFORD_CLAUSE_RECEIPT_CONTRACT
              || clause.kind !== 'prerequisite'
              || !/^Prerequisites?$/.test(clause.label || '')
              || sha256(clause.raw) !== clause.raw_sha256
              || evidence.raw_entry_text.slice(clause.relative_start, clause.relative_end)
                !== clause.raw
              || evidence.raw_entry_text.slice(
                clause.statement_relative_start,
                clause.statement_relative_start + clause.label.length + 1,
              ) !== `${clause.label}:`
              || clause.statement_relative_end !== clause.relative_end
              || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
              || clause.boundary_terminal
                !== 'first_br_after_unique_strong_prerequisite_marker'))
            || (clause ? evidence.clauses?.length !== 1 : evidence.clauses?.length !== 0)
            || (clause && (!exactClauseProjection
              || reviewedClause?.source_character_start
                !== evidence.entry_character_start + clause.relative_start
              || reviewedClause?.source_character_end
                !== evidence.entry_character_start + clause.relative_start
                  + reviewedClause.raw.length))) {
          issues.push(`${row.course_key}:radford_clause_receipt`);
        }
      }
      if (row.review_evidence.boundary_contract === UVA_WISE_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const expected = UVA_WISE_COURSE_RECORDS[row.code];
        const closureExpected = UVA_WISE_CLOSURE_COURSE_RECORDS[row.code];
        const discovery = evidence.discovery_link_receipt;
        const clause = evidence.required_requisite_clause;
        const reviewedClause = evidence.clauses?.[0];
        let sourceUrl = null;
        try { sourceUrl = new URL(row.source_url); } catch { /* recorded below */ }
        if (row.slug !== UVA_WISE_SLUG || !expected
            || evidence.capture_origin !== 'official_uva_wise_acalog_course_page'
            || evidence.source_format !== 'uva_wise_acalog_course_page'
            || evidence.catalog_year_verified !== UVA_WISE_CATALOG_YEAR
            || sourceUrl?.protocol !== 'http:'
            || sourceUrl?.hostname.toLowerCase() !== UVA_WISE_HOST
            || sourceUrl?.pathname !== '/preview_course_nopop.php'
            || Number(sourceUrl?.searchParams.get('catoid')) !== UVA_WISE_CATOID
            || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
            || evidence.catoid !== UVA_WISE_CATOID || evidence.coid !== expected?.coid
            || evidence.source_response_sha256 !== evidence.declared_normalized_text_sha256
            || evidence.source_response_sha256 !== evidence.retained_normalized_text_sha256
            || !/^[a-f0-9]{64}$/.test(evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(evidence.raw_entry_html_sha256 || '')
            || !evidence.published_units
            || !(evidence.published_units.credit_hours_min > 0)
            || evidence.published_units.credit_hours_max
              < evidence.published_units.credit_hours_min
            || evidence.discovery_contract !== (closureExpected
              ? UVA_WISE_RETAINED_ENTRY_DISCOVERY_CONTRACT : UVA_WISE_DISCOVERY_CONTRACT)
            || (closureExpected
              ? (evidence.discovery_cache_path !== closureExpected.discovery_cache_path
                || evidence.discovery_response_sha256
                  !== closureExpected.discovery_response_sha256)
              : (evidence.discovery_program_cache_path !== UVA_WISE_PROGRAM_CACHE_PATH
                || evidence.discovery_program_response_sha256 !== UVA_WISE_PROGRAM_HTML_SHA256
                || evidence.discovery_ge_cache_path !== UVA_WISE_GE_CACHE_PATH
                || evidence.discovery_ge_response_sha256 !== UVA_WISE_GE_HTML_SHA256))
            || discovery?.course_code !== row.code
            || discovery?.catoid !== UVA_WISE_CATOID
            || discovery?.coid !== expected?.coid
            || (closureExpected
              ? discovery?.discovery_course_code !== closureExpected.discovery_course_code
              : discovery?.title !== expected?.title)
            || evidence.robots_crawl_delay_seconds !== UVA_WISE_REQUIRED_CRAWL_DELAY_SECONDS
            || evidence.http_exception_contract
              !== 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1') {
          issues.push(`${row.course_key}:uva_wise_boundary_receipt`);
        }
        if ((clause ? evidence.clauses?.length !== 1 : evidence.clauses?.length !== 0)
            || (clause && (clause.receipt_contract !== UVA_WISE_CLAUSE_RECEIPT_CONTRACT
              || clause.kind !== 'prerequisite'
              || sha256(clause.raw) !== clause.raw_sha256
              || evidence.raw_entry_text.slice(clause.relative_start, clause.relative_end)
                !== clause.raw
              || clause.statement_relative_end !== clause.relative_end
              || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
              || clause.boundary_terminal
                !== 'next_br_after_unique_strong_prerequisite_marker_and_first_br'
              || reviewedClause?.raw !== clause.raw
              || reviewedClause?.source_character_start
                !== evidence.entry_character_start + clause.relative_start
              || reviewedClause?.source_character_end
                !== evidence.entry_character_start + clause.relative_end))) {
          issues.push(`${row.course_key}:uva_wise_clause_receipt`);
        }
        if (row.review_status === 'promoted_structural_none'
            && row.structural_none_evidence?.contract
              !== SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT) {
          const structural = row.structural_none_evidence;
          if (row.status !== 'none'
              || row.review_reason
                !== 'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control'
              || clause !== null
              || /\bPrerequisites?\b/i.test(evidence.raw_entry_text || '')
              || structural?.kind
                !== 'official_complete_entry_structural_silence_with_same_catalog_positive_control'
              || structural?.course_entry_status
                !== 'published_exact_uva_wise_acalog_course_page'
              || structural?.literal_none_statement !== false
              || structural?.boundary_contract !== UVA_WISE_BOUNDARY_CONTRACT
              || structural?.receipt_contract
                !== UVA_WISE_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
              || structural?.source_response_sha256 !== evidence.source_response_sha256
              || structural?.raw_entry_sha256 !== evidence.raw_entry_sha256
              || structural?.raw_entry_html_sha256 !== evidence.raw_entry_html_sha256
              || structural?.catoid !== evidence.catoid
              || structural?.coid !== evidence.coid
              || JSON.stringify(structural?.published_units)
                !== JSON.stringify(evidence.published_units)
              || !recomputedUvaWiseMarkerControl
              || JSON.stringify(structural?.marker_control)
                !== JSON.stringify(recomputedUvaWiseMarkerControl)) {
            issues.push(`${row.course_key}:uva_wise_structural_none`);
          }
        }
      }
      if (row.review_evidence.boundary_contract === SHENANDOAH_BOUNDARY_CONTRACT) {
        const evidence = row.review_evidence;
        const expected = SHENANDOAH_DIRECT_COURSE_RECORDS[row.code];
        const expectedDiscoveryContract = expected?.discovery_contract
          || SHENANDOAH_DISCOVERY_CONTRACT;
        const expectedDiscoveryCachePath = expected?.discovery_cache_path
          || SHENANDOAH_PROGRAM_CACHE_PATH;
        const expectedDiscoveryResponseSha256 = expected?.discovery_response_sha256
          || SHENANDOAH_PROGRAM_HTML_SHA256;
        const discovery = evidence.discovery_link_receipt;
        const clause = evidence.required_requisite_clause;
        const reviewedClause = evidence.clauses?.[0];
        const structuredMarkerCount = (
          evidence.raw_entry_text.match(/Prerequisite\(s\):/gi) || []
        ).length;
        let sourceUrl = null;
        try { sourceUrl = new URL(row.source_url); } catch { /* recorded below */ }
        if (row.slug !== SHENANDOAH_SLUG || !expected
            || evidence.capture_origin !== 'official_shenandoah_acalog_course_page'
            || evidence.source_format !== 'shenandoah_acalog_course_page'
            || evidence.catalog_year_verified !== SHENANDOAH_CATALOG_YEAR
            || sourceUrl?.protocol !== 'https:'
            || sourceUrl?.hostname.toLowerCase() !== SHENANDOAH_HOST
            || sourceUrl?.pathname !== '/preview_course_nopop.php'
            || Number(sourceUrl?.searchParams.get('catoid')) !== SHENANDOAH_CATOID
            || Number(sourceUrl?.searchParams.get('coid')) !== expected?.coid
            || evidence.catoid !== SHENANDOAH_CATOID || evidence.coid !== expected?.coid
            || evidence.source_response_sha256 !== evidence.declared_normalized_text_sha256
            || evidence.source_response_sha256 !== evidence.retained_normalized_text_sha256
            || !/^[a-f0-9]{64}$/.test(evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(evidence.raw_entry_html_sha256 || '')
            || !evidence.published_units
            || !(evidence.published_units.credit_hours_min > 0)
            || evidence.published_units.credit_hours_max
              < evidence.published_units.credit_hours_min
            || evidence.discovery_contract !== expectedDiscoveryContract
            || evidence.discovery_cache_path !== expectedDiscoveryCachePath
            || evidence.discovery_response_sha256 !== expectedDiscoveryResponseSha256
            || discovery?.course_code !== row.code
            || discovery?.catoid !== SHENANDOAH_CATOID
            || discovery?.coid !== expected?.coid
            || discovery?.title !== expected?.title
            || evidence.robots_crawl_delay_seconds
              !== SHENANDOAH_REQUIRED_CRAWL_DELAY_SECONDS
            || !Number.isInteger(evidence.formal_corequisite_marker_count)
            || evidence.formal_corequisite_marker_count < 0) {
          issues.push(`${row.course_key}:shenandoah_boundary_receipt`);
        }
        if (structuredMarkerCount !== (clause ? 1 : 0)
            || (clause ? evidence.clauses?.length !== 1 : evidence.clauses?.length !== 0)
            || (clause && (clause.receipt_contract !== SHENANDOAH_CLAUSE_RECEIPT_CONTRACT
              || clause.kind !== 'prerequisite'
              || clause.label !== 'Prerequisite(s)'
              || sha256(clause.raw) !== clause.raw_sha256
              || evidence.raw_entry_text.slice(clause.relative_start, clause.relative_end)
                !== clause.raw
              || evidence.raw_entry_text.slice(
                clause.statement_relative_start,
                clause.statement_relative_start + clause.label.length + 1,
              ) !== `${clause.label}:`
              || clause.statement_relative_end !== clause.relative_end
              || !/^[a-f0-9]{64}$/.test(clause.raw_html_sha256 || '')
              || clause.boundary_terminal
                !== 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker'
              || reviewedClause?.raw !== clause.raw
              || reviewedClause?.source_character_start
                !== evidence.entry_character_start + clause.relative_start
              || reviewedClause?.source_character_end
                !== evidence.entry_character_start + clause.relative_end))) {
          issues.push(`${row.course_key}:shenandoah_clause_receipt`);
        }
        if (row.review_status === 'promoted_structural_none'
            && row.structural_none_evidence?.contract
              !== SMALL_UNIVERSITY_PREREQUISITE_CLOSURE_CONTRACT) {
          const structural = row.structural_none_evidence;
          if (row.status !== 'none'
              || row.review_reason
                !== 'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control'
              || clause !== null
              || evidence.formal_corequisite_marker_count !== 0
              || /(?:Pre|Co)requisite\(s\):/i.test(evidence.raw_entry_text || '')
              || hasUnmodeledConstraintSignal(evidence.raw_entry_text)
              || structural?.kind !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_KIND
              || structural?.course_entry_status
                !== 'published_exact_shenandoah_acalog_course_page'
              || structural?.literal_none_statement !== false
              || structural?.boundary_contract !== SHENANDOAH_BOUNDARY_CONTRACT
              || structural?.receipt_contract
                !== SHENANDOAH_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
              || structural?.source_response_sha256 !== evidence.source_response_sha256
              || structural?.raw_entry_sha256 !== evidence.raw_entry_sha256
              || structural?.raw_entry_html_sha256 !== evidence.raw_entry_html_sha256
              || structural?.catoid !== evidence.catoid
              || structural?.coid !== evidence.coid
              || JSON.stringify(structural?.published_units)
                !== JSON.stringify(evidence.published_units)
              || !recomputedShenandoahMarkerControl
              || JSON.stringify(structural?.marker_control)
                !== JSON.stringify(recomputedShenandoahMarkerControl)) {
            issues.push(`${row.course_key}:shenandoah_structural_none`);
          }
        }
      }
      if (row.review_evidence.boundary_contract === BRIDGEWATER_BOUNDARY_CONTRACT) {
        let sourceUrl = null;
        try {
          sourceUrl = new URL(row.source_url);
        } catch {
          issues.push(`${row.course_key}:bridgewater_source_url`);
        }
        const expectedPath = expectedBridgewaterCoursePath(row.code);
        if (!sourceUrl || sourceUrl.protocol !== 'https:'
            || sourceUrl.hostname.toLowerCase() !== BRIDGEWATER_HOST
            || sourceUrl.pathname.replace(/\/$/, '') !== expectedPath
            || row.review_evidence.canonical_path !== expectedPath
            || row.review_evidence.source_format !== 'cleancatalog_course_page') {
          issues.push(`${row.course_key}:bridgewater_boundary`);
        }
        const units = row.review_evidence.published_units;
        if (units?.kind !== 'published_fixed_credits'
            || !(units.credit_hours_min > 0)
            || units.credit_hours_max !== units.credit_hours_min) {
          issues.push(`${row.course_key}:bridgewater_units`);
        }
        if (!/^[a-f0-9]{64}$/.test(row.review_evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.raw_entry_html_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.edition_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(
              row.review_evidence.edition_normalized_main_text_sha256 || '',
            )) {
          issues.push(`${row.course_key}:bridgewater_hashes`);
        }
        if (row.review_evidence.source_response_sha256
              !== row.review_evidence.declared_normalized_text_sha256
            || row.review_evidence.source_response_sha256
              !== row.review_evidence.retained_normalized_text_sha256) {
          issues.push(`${row.course_key}:bridgewater_source_hash_binding`);
        }
        if (row.review_evidence.edition_path !== BRIDGEWATER_EDITION_PATH
            || row.review_evidence.edition_catalog_year !== row.catalog_year
            || row.review_evidence.edition_exact_year_statement
              !== `Course numbers and descriptions listed herein apply to the ${row.catalog_year} academic year.`) {
          issues.push(`${row.course_key}:bridgewater_edition`);
        }
        const fieldReceipt = row.review_evidence.requisite_field_receipt;
        const prerequisiteMarkerCount = (
          row.review_evidence.raw_entry_text.match(/\bPrerequisites?:/gi) || []
        ).length;
        const corequisiteMarkerCount = (
          row.review_evidence.raw_entry_text.match(/\bCorequisites?:/gi) || []
        ).length;
        if (row.review_evidence.capture_origin
              !== 'official_cleancatalog_course_page'
            || fieldReceipt?.receipt_contract
              !== BRIDGEWATER_REQUISITE_FIELD_RECEIPT_CONTRACT
            || !Number.isInteger(fieldReceipt.field_label_count)
            || fieldReceipt.field_label_count <= 0
            || !/^[a-f0-9]{64}$/.test(fieldReceipt.field_labels_sha256 || '')
            || !Number.isInteger(fieldReceipt.exact_prerequisite_field_count)
            || fieldReceipt.exact_prerequisite_field_count < 0
            || fieldReceipt.exact_prerequisite_field_count > 1
            || !Number.isInteger(fieldReceipt.exact_corequisite_field_count)
            || fieldReceipt.exact_corequisite_field_count < 0
            || fieldReceipt.exact_corequisite_field_count > 1
            || fieldReceipt.unrecognized_requisite_like_field_count !== 0
            || !Array.isArray(fieldReceipt.requisite_fields)
            || fieldReceipt.requisite_fields.length !== (
              fieldReceipt.exact_prerequisite_field_count
                + fieldReceipt.exact_corequisite_field_count
            )
            || prerequisiteMarkerCount !== fieldReceipt.exact_prerequisite_field_count
            || corequisiteMarkerCount !== fieldReceipt.exact_corequisite_field_count
            || fieldReceipt.requisite_fields.some((field) => (
              !/^(?:Pre|Co)requisites?$/i.test(field.label)
              || !Array.isArray(field.values) || !field.values.length
              || sha256(JSON.stringify(field.values)) !== field.values_sha256
            ))) {
          issues.push(`${row.course_key}:bridgewater_requisite_field_receipt`);
        }
        if (row.review_status === 'promoted_structural_none'
            && row.structural_none_evidence?.contract
              !== FIGURE6_NONCOURSE_DISPOSITION_CONTRACT) {
          const structural = row.structural_none_evidence;
          if (row.status !== 'none'
              || row.review_reason
                !== 'complete_bridgewater_cleancatalog_entry_silence_with_same_edition_requisite_marker_controls'
              || prerequisiteMarkerCount !== 0 || corequisiteMarkerCount !== 0
              || hasUnmodeledConstraintSignal(row.review_evidence.raw_entry_text)
              || bridgewaterUnmodeledTimingSignals(
                row.review_evidence.raw_entry_text,
              ).length !== 0
              || structural?.kind !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_KIND
              || structural?.course_entry_status
                !== 'published_exact_bridgewater_cleancatalog_course_page'
              || structural?.literal_none_statement !== false
              || structural?.boundary_contract !== BRIDGEWATER_BOUNDARY_CONTRACT
              || structural?.receipt_contract
                !== BRIDGEWATER_UNIVERSITY_STRUCTURAL_NONE_RECEIPT_CONTRACT
              || structural?.source_response_sha256
                !== row.review_evidence.source_response_sha256
              || structural?.raw_entry_sha256 !== row.review_evidence.raw_entry_sha256
              || structural?.raw_entry_html_sha256
                !== row.review_evidence.raw_entry_html_sha256
              || structural?.canonical_path !== row.review_evidence.canonical_path
              || structural?.edition_response_sha256
                !== row.review_evidence.edition_response_sha256
              || structural?.edition_catalog_year
                !== row.review_evidence.edition_catalog_year
              || JSON.stringify(structural?.published_units)
                !== JSON.stringify(row.review_evidence.published_units)
              || JSON.stringify(structural?.entry_marker_receipt)
                !== JSON.stringify(fieldReceipt)
              || !recomputedBridgewaterMarkerControl
              || JSON.stringify(structural?.marker_control)
                !== JSON.stringify(recomputedBridgewaterMarkerControl)) {
            issues.push(`${row.course_key}:bridgewater_structural_none`);
          }
        }
      }
      if (row.review_evidence.boundary_contract === LONGWOOD_BOUNDARY_CONTRACT) {
        let sourceUrl = null;
        try { sourceUrl = new URL(row.source_url); } catch { /* recorded below */ }
        if (row.slug !== LONGWOOD_SLUG
            || ![
              ...LONGWOOD_DIRECT_CMSC_TARGETS,
              ...LONGWOOD_DETERMINISTIC_CMSC_TARGETS,
            ].includes(row.code)
            || sourceUrl?.protocol !== 'https:'
            || sourceUrl?.hostname.toLowerCase() !== LONGWOOD_DEPARTMENT_HOST
            || sourceUrl?.pathname.replace(/\/$/, '') !== LONGWOOD_DEPARTMENT_PATH
            || row.review_evidence.source_format !== 'longwood_department_course_listing') {
          issues.push(`${row.course_key}:longwood_boundary`);
        }
        const units = row.review_evidence.published_units;
        if (!units || !(units.credit_hours_min >= 0)
            || units.credit_hours_max < units.credit_hours_min) {
          issues.push(`${row.course_key}:longwood_units`);
        }
        if (!/^[a-f0-9]{64}$/.test(row.review_evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.raw_entry_html_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.catalog_context_html_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.catalog_context_relevant_sha256 || '')) {
          issues.push(`${row.course_key}:longwood_hashes`);
        }
        if (row.review_evidence.source_response_sha256
              !== row.review_evidence.declared_normalized_text_sha256
            || row.review_evidence.source_response_sha256
              !== row.review_evidence.retained_normalized_text_sha256) {
          issues.push(`${row.course_key}:longwood_source_hash_binding`);
        }
        if (row.catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
            || row.review_evidence.department_page_catalog_year_statement !== null
            || row.review_evidence.catalog_context_contract
              !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
            || row.review_evidence.catalog_context_official_url
              !== LONGWOOD_CATALOG_CONTEXT_URL
            || row.review_evidence.catalog_context_html_cache_path
              !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
            || row.review_evidence.catalog_context_text_cache_path
              !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
            || row.review_evidence.catalog_context_normalized_text_sha256
              !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
            || row.review_evidence.catalog_context_catalog_year
              !== LONGWOOD_CATALOG_CONTEXT_YEAR
            || row.review_evidence.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
            || row.review_evidence.two_source_edition_boundary
              !== LONGWOOD_TWO_SOURCE_EDITION_BOUNDARY
            || !/does not print a catalog year/i.test(
              row.review_evidence.two_source_binding_note || '',
            )) {
          issues.push(`${row.course_key}:longwood_catalog_context`);
        }
      }
      if (row.review_evidence.boundary_contract === LONGWOOD_BANNER_BOUNDARY_CONTRACT) {
        let sourceUrl = null;
        try { sourceUrl = new URL(row.source_url); } catch { /* recorded below */ }
        if (row.slug !== LONGWOOD_SLUG
            || (!/^(?:CTZN|ENGL|MATH)\d{2,4}[A-Z]?$/.test(row.code || '')
              && !LONGWOOD_BANNER_DETERMINISTIC_PERSPECTIVE_TARGETS.includes(row.code)
              && !LONGWOOD_BANNER_PREREQUISITE_CLOSURE_TARGETS.includes(row.code))
            || sourceUrl?.protocol !== 'https:'
            || sourceUrl?.hostname.toLowerCase() !== LONGWOOD_BANNER_HOST
            || sourceUrl?.pathname.replace(/\/$/, '') !== LONGWOOD_BANNER_PATH
            || row.review_evidence.source_format !== 'longwood_banner_course_listing') {
          issues.push(`${row.course_key}:longwood_banner_boundary`);
        }
        const units = row.review_evidence.published_units;
        if (!units || !(units.credit_hours_min >= 0)
            || units.credit_hours_max < units.credit_hours_min) {
          issues.push(`${row.course_key}:longwood_banner_units`);
        }
        if (!/^[a-f0-9]{64}$/.test(row.review_evidence.source_response_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.raw_entry_html_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.catalog_context_html_sha256 || '')
            || !/^[a-f0-9]{64}$/.test(row.review_evidence.catalog_context_relevant_sha256 || '')) {
          issues.push(`${row.course_key}:longwood_banner_hashes`);
        }
        if (row.review_evidence.source_response_sha256
              !== row.review_evidence.declared_normalized_text_sha256
            || row.review_evidence.source_response_sha256
              !== row.review_evidence.retained_normalized_text_sha256) {
          issues.push(`${row.course_key}:longwood_banner_source_hash_binding`);
        }
        if (row.catalog_year !== LONGWOOD_CATALOG_CONTEXT_YEAR
            || row.review_evidence.department_page_catalog_year_statement !== null
            || row.review_evidence.catalog_context_contract
              !== LONGWOOD_CATALOG_CONTEXT_CONTRACT
            || row.review_evidence.catalog_context_official_url
              !== LONGWOOD_CATALOG_CONTEXT_URL
            || row.review_evidence.catalog_context_html_cache_path
              !== LONGWOOD_CATALOG_CONTEXT_HTML_CACHE_PATH
            || row.review_evidence.catalog_context_text_cache_path
              !== LONGWOOD_CATALOG_CONTEXT_TEXT_CACHE_PATH
            || row.review_evidence.catalog_context_normalized_text_sha256
              !== LONGWOOD_CATALOG_CONTEXT_TEXT_SHA256
            || row.review_evidence.catalog_context_catalog_year
              !== LONGWOOD_CATALOG_CONTEXT_YEAR
            || row.review_evidence.catalog_context_catoid !== LONGWOOD_CATALOG_CONTEXT_CATOID
            || row.review_evidence.two_source_edition_boundary
              !== LONGWOOD_BANNER_TWO_SOURCE_EDITION_BOUNDARY
            || !/does not print a catalog year/i.test(
              row.review_evidence.two_source_binding_note || '',
            )) {
          issues.push(`${row.course_key}:longwood_banner_catalog_context`);
        }
      }
    }
    for (const group of row.groups || []) {
      if (group.formula !== FORMULA || !asArray(group.paths).length) issues.push(`${row.course_key}:formula`);
      for (const path of group.paths || []) {
        if (!asArray(path.all_of).length) issues.push(`${row.course_key}:empty_path`);
        for (const condition of path.all_of || []) {
          if (condition.type === 'course'
              && condition.course_key !== `${row.owner_namespace}:${condition.code}`) {
            issues.push(`${row.course_key}:cross_owner_condition`);
          }
          if (condition.minimum_grade_evidence) {
            const gradeEvidence = condition.minimum_grade_evidence;
            if (condition.type !== 'course'
                || !/^[A-F][+-]?$/.test(condition.minimum_grade || '')
                || gradeEvidence.kind !== 'exact_full_entry_grade_statement'
                || sha256(gradeEvidence.raw) !== gradeEvidence.raw_sha256
                || !row.review_evidence?.raw_entry_text?.includes(gradeEvidence.raw)) {
              issues.push(`${row.course_key}:minimum_grade_evidence`);
            }
          }
        }
      }
    }
  }
  const promotedKeys = new Set(promoted.map((row) => row.course_key));
  const rowByKey = new Map(rows.map((row) => [row.course_key, row]));
  for (const [partition, partitionRows] of [
    ['direct', directRows],
    ['closure', closureRows],
    ['promoted', promoted],
  ]) {
    for (const row of partitionRows) {
      if (JSON.stringify(rowByKey.get(row.course_key)) !== JSON.stringify(row)) {
        issues.push(`${row.course_key}:${partition}_row_copy`);
      }
    }
  }
  if (promoted.some((row) => !PUBLISHABLE.has(row.status))) issues.push('promoted_status');
  if (promoted.some((row) => !keys.has(row.course_key))) issues.push('promoted_not_reviewed');
  if (promotedKeys.size !== promoted.length) issues.push('promoted_duplicate');
  const counts = Object.fromEntries(['parsed', 'none', 'unparsed', 'missing'].map((status) => [
    status, rows.filter((row) => row.status === status).length,
  ]));
  for (const [status, count] of Object.entries(counts)) {
    const directCount = directRows.filter((row) => row.status === status).length;
    if (artifact?.summary?.[status] !== directCount) issues.push(`summary_${status}`);
  }
  for (const status of ['parsed', 'none', 'unparsed']) {
    const count = closureRows.filter((row) => row.status === status).length;
    if (artifact?.summary?.[`closure_${status}`] !== count) issues.push(`summary_closure_${status}`);
  }
  if (artifact?.summary?.direct_required_rows !== directRows.length) issues.push('summary_direct');
  if (artifact?.summary?.closure_candidate_rows !== closureRows.length) issues.push('summary_closure');
  if (artifact?.summary?.promoted_contract_rows !== promoted.length) issues.push('summary_promoted');
  if (scope) {
    const expectedDirect = scope.summary.required_resident_path_courses
      ?? scope.summary.direct_named_courses;
    if (directRows.length !== expectedDirect) issues.push('scope_direct_count');
  }
  if (scope) {
    const institutionRows = asArray(artifact?.institution_review);
    if (institutionRows.length !== scope.universities.length) issues.push('institution_review_count');
    for (const university of scope.universities) {
      const report = institutionRows.find((row) => row.owner_namespace === university.owner_namespace);
      const ownerRows = directRows.filter((row) => row.owner_namespace === university.owner_namespace);
      if (!report || report.direct_required_rows !== ownerRows.length) {
        issues.push(`${university.slug}:institution_review_direct`);
      } else if (report.parsed_exact_formulas !== ownerRows.filter((row) => row.status === 'parsed').length
          || report.explicit_none_rows !== ownerRows.filter((row) => row.status === 'none').length
          || report.unparsed_review_rows !== ownerRows.filter((row) => row.status === 'unparsed').length
          || report.missing_source_entry_rows !== ownerRows.filter((row) => row.status === 'missing').length) {
        issues.push(`${university.slug}:institution_review_partition`);
      }
    }
  }
  if (rows.length !== directRows.length + closureRows.length) issues.push('review_partition_count');
  if (new Set([...directRows, ...closureRows].map((row) => row.course_key)).size !== rows.length) {
    issues.push('review_partition_keys');
  }
  if (candidates && artifact?.summary?.bounded_candidates_reviewed !== candidates.candidates.length) {
    issues.push('candidate_count');
  }
  if (candidates) {
    const candidateByKey = new Map(asArray(candidates.candidates).map((candidate) => (
      [candidate.course_key, candidate]
    )));
    for (const row of rows) {
      const candidate = candidateByKey.get(row.course_key);
      if (!candidate) continue;
      const replayed = reviewCandidate(candidate, {
        bridgewaterMarkerControl: recomputedBridgewaterMarkerControl,
        uvaWiseMarkerControl: recomputedUvaWiseMarkerControl,
        shenandoahMarkerControl: recomputedShenandoahMarkerControl,
        cnuEngl123Control: recomputedCnuEngl123Control,
        longwoodClosureControl: recomputedLongwoodClosureControl,
        oldDominionClosureControl: recomputedOldDominionClosureControl,
        vcuPrerequisiteControl: recomputedVcuPrerequisiteControl,
        virginiaTechRecursivePrerequisiteControl:
          recomputedVirginiaTechRecursivePrerequisiteControl,
        smallUniversityPrerequisiteEvidence:
          recomputedSmallUniversityPrerequisiteEvidence,
        universityPrerequisiteTailControl:
          recomputedUniversityPrerequisiteTailControl,
        radfordRandolphMaconTailEvidence:
          recomputedRadfordRandolphMaconTailEvidence,
        remainingUniversityPrerequisiteEvidence:
          recomputedRemainingUniversityPrerequisiteEvidence,
        vcuEgmnPrerequisiteEvidence:
          recomputedVcuEgmnPrerequisiteEvidence,
        radfordUvaWiseRecursiveEvidence:
          recomputedRadfordUvaWiseRecursiveEvidence,
      });
      replayed.source_bundle_hash = row.source_bundle_hash;
      if (JSON.stringify(replayed) !== JSON.stringify(row)) {
        issues.push(`${row.course_key}:review_replay`);
      }
    }
  }
  const rebuiltClosure = closureReport(rows, promoted, {
    directKeys: new Set(directRows.map((row) => row.course_key)),
  });
  if (JSON.stringify(artifact?.closure) !== JSON.stringify(rebuiltClosure)) issues.push('closure_report');
  const rebuiltGeorgeMasonAudit = georgeMasonRecursiveClosureAudit(rows, rebuiltClosure);
  if (JSON.stringify(artifact?.george_mason_recursive_closure_audit)
      !== JSON.stringify(rebuiltGeorgeMasonAudit)) {
    issues.push('gmu_recursive_closure_audit');
  }
  if (artifact?.closure?.complete) issues.push('closure_unexpectedly_complete_requires_publication_review');
  if (scope) {
    const evidenceIssues = officialSourceEvidenceIssues(promoted, {
      role: 'university',
      officialHostsByOwner: officialHostsForPrerequisiteScope(scope),
      allowedOwners: scope.universities.map((row) => row.owner_namespace),
    });
    issues.push(...evidenceIssues.map((issue) => `${issue.path}:${issue.code}`));
  }
  return { valid: issues.length === 0, issues };
}

module.exports = {
  ARTIFACT,
  AUTHORITY,
  FORMULA,
  STRICT_FORMULA_REJECTION_AUDIT,
  STRICT_FORMULA_REJECTION_AUDIT_CONTRACT,
  auditedStrictFormulaTokens,
  buildUniversityPrerequisiteReview,
  bridgewaterCleanCatalogMarkerControl,
  closureReport,
  controlledBridgewaterCleanCatalogSilenceEvidence,
  controlledCourseLeafSilenceEvidence,
  controlledShenandoahAcalogSilenceEvidence,
  controlledUvaWiseAcalogSilenceEvidence,
  resolveGeorgeMasonPrerequisiteSilence,
  extractBridgewaterRequiredClauses,
  extractCnuRequiredClauses,
  extractLongwoodRequiredClauses,
  extractRequiredClauses,
  exactBrowserCourseLeafRequiredClauses,
  formulaGroup,
  isExplicitNone,
  normalizeCode,
  parseBooleanTokens,
  reviewCandidate,
  tokenizeBridgewaterStrictFormula,
  tokenizeCourseOnly,
  tokenizeCnuStrictFormula,
  tokenizeLongwoodStrictFormula,
  tokenizeJmuBrowserStrictFormula,
  tokenizeExplicitChoiceFormula,
  tokenizeGmu,
  tokenizeNsuTake,
  tokenizeOduStructuredFormula,
  tokenizeRadfordStrictFormula,
  tokenizeRmcStructuredFormula,
  tokenizeShenandoahStrictFormula,
  tokenizeStrictGradeFormula,
  tokenizeVcuStructuredFormula,
  tokenizeUvaWiseStrictFormula,
  tokenizeVirginiaTechStrictFormula,
  tokenizeVirginiaTechBrowserStrictFormula,
  tokenizeVsuStructuredFormula,
  tokenizeVsuTitledFormula,
  shenandoahAcalogMarkerControl,
  strictFormulaRejectionAuditReceipt,
  strictFormulaRejectionAuditReport,
  uvaWiseAcalogMarkerControl,
  validateUniversityPrerequisiteReview,
};
