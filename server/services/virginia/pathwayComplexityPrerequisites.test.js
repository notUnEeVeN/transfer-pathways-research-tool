import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  adaptExactRequisiteRow,
  adaptVccsPrerequisiteArtifact,
  officialSourceEvidenceIssues,
  requiredVccsCourseKeys,
  sha256,
  sourceBundleHashForRows,
  validateVccsFigure6PrerequisiteCorpus,
  validateVirginiaFigure6PrerequisiteCorpus,
} from './pathwayComplexityPrerequisites';

const requisite = (overrides = {}) => ({
  course_key: 'va:CSC222',
  owner_namespace: 'va:vccs',
  status: 'parsed',
  source: 'vccs_master_course_file',
  source_url: 'https://courses.vccs.edu/courses/CSC222',
  raw_requisites: 'Prerequisite: CSC 221; or CSC 110 and CSC 111.',
  groups: [{
    kind: 'prerequisite',
    raw: 'CSC 221; or CSC 110 and CSC 111',
    flags: ['reviewed_fixture'],
    formula: 'paths_or__conditions_and',
    paths: [
      { raw: 'CSC 221', all_of: [{ type: 'course', code: 'CSC221', course_key: 'va:CSC221' }] },
      { raw: 'CSC 110 and CSC 111', all_of: [
        { type: 'course', code: 'CSC110', course_key: 'va:CSC110' },
        { type: 'course', code: 'CSC111', course_key: 'va:CSC111' },
      ] },
    ],
  }],
  ...overrides,
});

describe('Virginia Figure 6 prerequisite contract', () => {
  it('accepts structured VCCS master-boundary none without claiming a literal statement', () => {
    const rawText = 'CSC 221 - Programming Description. Lecture 3 hours. 3 credits';
    const contentHash = sha256(rawText);
    const row = requisite({
      code: 'CSC221',
      course_key: 'va:CSC221',
      status: 'none',
      raw_requisites: null,
      groups: [],
      source_content_sha256: contentHash,
      source_evidence: {
        kind: 'official_course_entry',
        raw_text: rawText,
        content_sha256: contentHash,
        source_page_content_sha256: '1'.repeat(64),
        record_html_sha256: '2'.repeat(64),
        record_boundary: 'dl > dt + dd',
        requisite_text_boundary: '.endtext',
        parser_contract: 'vccs-master-dt-dd-endtext-v1',
      },
      explicit_none_evidence: {
        kind: 'structured_vccs_master_record_boundary',
        course_entry_status: 'published_exact_vccs_master_course_record',
        finding: 'no_prerequisite_or_corequisite_published_in_complete_master_record',
        literal_none_statement: false,
        source_content_sha256: contentHash,
        source_page_content_sha256: '1'.repeat(64),
        record_html_sha256: '2'.repeat(64),
        parser_contract: 'vccs-master-dt-dd-endtext-v1',
        record_boundary: 'dl > dt + dd',
        requisite_text_boundary: '.endtext',
        requisite_clause_count: 0,
      },
    });
    row.source_bundle_hash = sourceBundleHashForRows([row], 'va:vccs');
    expect(officialSourceEvidenceIssues([row], {
      role: 'community_college',
      officialHostsByOwner: { 'va:vccs': ['courses.vccs.edu'] },
      allowedOwners: ['va:vccs'],
    })).toEqual([]);

    const changed = structuredClone(row);
    changed.explicit_none_evidence.literal_none_statement = true;
    expect(officialSourceEvidenceIssues([changed], {
      role: 'community_college',
      officialHostsByOwner: { 'va:vccs': ['courses.vccs.edu'] },
      allowedOwners: ['va:vccs'],
    }).map((issue) => issue.code)).toContain('structured_master_record_none_evidence_required');
  });

  it('accepts only hash-bound CourseLeaf structural silence with a same-response control', () => {
    const rawText = 'CS 101 - Introduction (3 Credits) A first course in computing.';
    const contentHash = sha256(rawText);
    const responseHash = '1'.repeat(64);
    const entryHtmlHash = '2'.repeat(64);
    const units = {
      kind: 'published_fixed_credits', notation: '3 Credits',
      credit_hours_min: 3, credit_hours_max: 3,
    };
    const control = {
      receipt_contract:
        'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1',
      source_courseblock_count: 20,
      source_complete_entry_count: 20,
      source_complete_entries_with_required_requisite_marker_count: 4,
      entry_required_requisite_marker_count: 0,
      entry_corequisite_marker_count: 0,
      entry_requisite_marker_like_count: 0,
      entry_constraint_like_signal_count: 0,
      same_source_positive_control: true,
    };
    const structural = {
      kind: 'official_complete_entry_structural_silence_with_same_source_positive_control',
      course_entry_status: 'published_exact_courseleaf_courseblock',
      finding:
        'no_required_prerequisite_marker_in_complete_entry_with_same_response_positive_control',
      literal_none_statement: false,
      boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
      receipt_contract:
        'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1',
      source_response_sha256: responseHash,
      raw_entry_sha256: contentHash,
      raw_entry_html_sha256: entryHtmlHash,
      courseblock_index: 2,
      published_units: units,
      marker_control: control,
      inference_boundary:
        'This row is none only because a complete exact CourseLeaf entry is silent while the same hashed response contains an explicit marker control.',
    };
    const row = requisite({
      code: 'CS101',
      course_key: 'va:uni:1:CS101',
      owner_namespace: 'va:uni:1',
      status: 'none',
      source: 'institution_catalog',
      source_url: 'https://catalog.example.edu/courses/cs/',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_structural_none',
      review_reason:
        'complete_courseleaf_entry_silence_with_same_source_required_marker_control',
      source_content_sha256: contentHash,
      source_evidence: {
        kind: 'official_course_entry', raw_text: rawText, content_sha256: contentHash,
      },
      review_evidence: {
        capture_origin: 'official_acquisition',
        source_format: 'courseleaf_courseblock',
        boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
        declared_normalized_text_sha256: responseHash,
        retained_normalized_text_sha256: responseHash,
        source_response_sha256: responseHash,
        raw_entry_sha256: contentHash,
        raw_entry_html_sha256: entryHtmlHash,
        raw_entry_text: rawText,
        courseblock_index: 2,
        published_units: units,
        complete_entry_receipt: control,
      },
      structural_none_evidence: structural,
    });
    row.source_bundle_hash = sourceBundleHashForRows([row], row.owner_namespace);
    expect(officialSourceEvidenceIssues([row], {
      role: 'university',
      officialHostsByOwner: { 'va:uni:1': ['catalog.example.edu'] },
      allowedOwners: ['va:uni:1'],
    })).toEqual([]);

    const tampered = structuredClone(row);
    tampered.structural_none_evidence.marker_control.same_source_positive_control = false;
    expect(officialSourceEvidenceIssues([tampered], {
      role: 'university',
      officialHostsByOwner: { 'va:uni:1': ['catalog.example.edu'] },
      allowedOwners: ['va:uni:1'],
    }).map((issue) => issue.code)).toContain('structured_courseleaf_none_evidence_required');
  });

  it('accepts UVA Wise silence only with the exact cross-response Acalog marker control', () => {
    const rawText = 'FRE 1010 - Elementary French Credit(s) 3 Introductory French. Course Frequency: Fall';
    const contentHash = sha256(rawText);
    const responseHash = '3'.repeat(64);
    const entryHtmlHash = '4'.repeat(64);
    const units = {
      kind: 'published_fixed_credits', notation: '3',
      credit_hours_min: 3, credit_hours_max: 3,
    };
    const control = {
      receipt_contract:
        'uva_wise_acalog_complete_entry_cross_response_required_marker_control_v1',
      catalog_year: '2026-2027',
      catoid: 9,
      exact_complete_entry_count: 31,
      exact_complete_entries_with_required_requisite_marker_count: 20,
      exact_complete_entries_without_required_requisite_marker_count: 11,
      same_catalog_positive_control: true,
      population_sha256: '5'.repeat(64),
      positive_control_sha256: '6'.repeat(64),
      positive_control_course_keys: Array.from(
        { length: 20 }, (_, index) => `va:uni:9226:CTRL${index + 100}`,
      ),
    };
    const structural = {
      kind: 'official_complete_entry_structural_silence_with_same_catalog_positive_control',
      course_entry_status: 'published_exact_uva_wise_acalog_course_page',
      finding:
        'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control',
      literal_none_statement: false,
      boundary_contract:
        'uva_wise_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1',
      receipt_contract:
        'uva_wise_acalog_complete_entry_cross_response_required_marker_control_v1',
      source_response_sha256: responseHash,
      raw_entry_sha256: contentHash,
      raw_entry_html_sha256: entryHtmlHash,
      catoid: 9,
      coid: 18111,
      published_units: units,
      marker_control: control,
      inference_boundary:
        'This finding does not infer a literal none statement or erase an enrollment rule.',
    };
    const row = requisite({
      code: 'FRE1010',
      course_key: 'va:uni:9226:FRE1010',
      owner_namespace: 'va:uni:9226',
      status: 'none',
      source: 'institution_catalog',
      source_url: 'http://catalog.uvawise.edu/preview_course_nopop.php?catoid=9&coid=18111',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_structural_none',
      review_reason:
        'complete_uva_wise_acalog_entry_silence_with_same_catalog_required_marker_control',
      source_content_sha256: contentHash,
      source_evidence: {
        kind: 'official_course_entry', raw_text: rawText, content_sha256: contentHash,
      },
      review_evidence: {
        capture_origin: 'official_uva_wise_acalog_course_page',
        source_format: 'uva_wise_acalog_course_page',
        boundary_contract:
          'uva_wise_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1',
        source_response_sha256: responseHash,
        raw_entry_sha256: contentHash,
        raw_entry_html_sha256: entryHtmlHash,
        raw_entry_text: rawText,
        catoid: 9,
        coid: 18111,
        published_units: units,
        required_requisite_clause: null,
      },
      structural_none_evidence: structural,
    });
    row.source_bundle_hash = sourceBundleHashForRows([row], row.owner_namespace);
    const options = {
      role: 'university',
      officialHostsByOwner: { 'va:uni:9226': ['catalog.uvawise.edu'] },
      allowedOwners: ['va:uni:9226'],
    };
    expect(officialSourceEvidenceIssues([row], options)).toEqual([]);

    const tampered = structuredClone(row);
    tampered.structural_none_evidence.marker_control.same_catalog_positive_control = false;
    expect(officialSourceEvidenceIssues([tampered], options).map((issue) => issue.code))
      .toContain('structured_uva_wise_acalog_none_evidence_required');

    const hiddenConstraint = structuredClone(row);
    hiddenConstraint.source_evidence.raw_text += ' Permission required.';
    expect(officialSourceEvidenceIssues([hiddenConstraint], options).map((issue) => issue.code))
      .toContain('structured_uva_wise_acalog_none_evidence_required');
  });

  it('accepts Shenandoah silence only with all nineteen exact entries and positive controls', () => {
    const rawText = 'ENG 101 Composition Credit(s): 3';
    const contentHash = sha256(rawText);
    const responseHash = '7'.repeat(64);
    const entryHtmlHash = '8'.repeat(64);
    const units = {
      kind: 'published_fixed_credits', notation: 'Credit(s): 3',
      credit_hours_min: 3, credit_hours_max: 3,
    };
    const control = {
      receipt_contract:
        'shenandoah_acalog_complete_entry_cross_response_required_marker_control_v1',
      catalog_year: '2025-2026',
      catoid: 33,
      exact_complete_entry_count: 19,
      exact_complete_entries_with_required_requisite_marker_count: 14,
      exact_complete_entries_without_required_requisite_marker_count: 5,
      same_catalog_positive_control: true,
      population_sha256: '9'.repeat(64),
      positive_control_sha256: 'a'.repeat(64),
      positive_control_course_keys: [
        'va:uni:9224:CSC122', 'va:uni:9224:CSC210', 'va:uni:9224:CSC301',
        'va:uni:9224:CSC310', 'va:uni:9224:CSC403', 'va:uni:9224:CSC407',
        'va:uni:9224:CSC410', 'va:uni:9224:CSC430', 'va:uni:9224:CSC480',
        'va:uni:9224:MATH102', 'va:uni:9224:MATH201', 'va:uni:9224:MATH202',
        'va:uni:9224:MATH209', 'va:uni:9224:MATH370',
      ],
    };
    const structural = {
      kind:
        'official_complete_shenandoah_acalog_entry_structural_silence_with_same_catalog_positive_control',
      course_entry_status: 'published_exact_shenandoah_acalog_course_page',
      finding:
        'no_required_prerequisite_field_in_complete_entry_with_same_catalog_positive_control',
      literal_none_statement: false,
      boundary_contract:
        'shenandoah_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1',
      receipt_contract:
        'shenandoah_acalog_complete_entry_cross_response_required_marker_control_v1',
      source_response_sha256: responseHash,
      raw_entry_sha256: contentHash,
      raw_entry_html_sha256: entryHtmlHash,
      catoid: 33,
      coid: 54326,
      published_units: units,
      marker_control: control,
      inference_boundary:
        'This exact complete-entry finding does not infer a literal none statement.',
    };
    const row = requisite({
      code: 'ENG101',
      course_key: 'va:uni:9224:ENG101',
      owner_namespace: 'va:uni:9224',
      status: 'none',
      source: 'institution_catalog',
      source_url: 'https://catalog.su.edu/preview_course_nopop.php?catoid=33&coid=54326',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_structural_none',
      review_reason:
        'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control',
      source_content_sha256: contentHash,
      source_evidence: {
        kind: 'official_course_entry', raw_text: rawText, content_sha256: contentHash,
      },
      review_evidence: {
        capture_origin: 'official_shenandoah_acalog_course_page',
        source_format: 'shenandoah_acalog_course_page',
        boundary_contract:
          'shenandoah_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1',
        source_response_sha256: responseHash,
        raw_entry_sha256: contentHash,
        raw_entry_html_sha256: entryHtmlHash,
        raw_entry_text: rawText,
        catoid: 33,
        coid: 54326,
        published_units: units,
        required_requisite_clause: null,
        formal_corequisite_marker_count: 0,
      },
      structural_none_evidence: structural,
    });
    row.source_bundle_hash = sourceBundleHashForRows([row], row.owner_namespace);
    const options = {
      role: 'university',
      officialHostsByOwner: { 'va:uni:9224': ['catalog.su.edu'] },
      allowedOwners: ['va:uni:9224'],
    };
    expect(officialSourceEvidenceIssues([row], options)).toEqual([]);

    for (const mutate of [
      (changed) => { changed.structural_none_evidence.marker_control.exact_complete_entry_count = 13; },
      (changed) => { changed.structural_none_evidence.marker_control.positive_control_course_keys = []; },
      (changed) => { changed.review_evidence.formal_corequisite_marker_count = 1; },
      (changed) => { changed.source_evidence.raw_text += ' Permission required.'; },
    ]) {
      const tampered = structuredClone(row);
      mutate(tampered);
      expect(officialSourceEvidenceIssues([tampered], options).map((issue) => issue.code))
        .toContain('structured_shenandoah_acalog_none_evidence_required');
    }
  });

  it('preserves OR-of-AND source paths without flattening them', () => {
    const adapted = adaptExactRequisiteRow(requisite());
    expect(adapted.raw_requisites).toBe('Prerequisite: CSC 221; or CSC 110 and CSC 111.');
    expect(adapted.groups[0].flags).toEqual(['reviewed_fixture']);
    expect(adapted.groups[0].paths).toEqual([
      { raw: 'CSC 221', all_of: [{ type: 'course', code: 'CSC221', course_key: 'va:CSC221' }] },
      { raw: 'CSC 110 and CSC 111', all_of: [
        { type: 'course', code: 'CSC110', course_key: 'va:CSC110' },
        { type: 'course', code: 'CSC111', course_key: 'va:CSC111' },
      ] },
    ]);
  });

  it('fails closed without a university-local corpus and integrated adapter', () => {
    const report = validateVirginiaFigure6PrerequisiteCorpus({
      communityCollegeRows: [requisite()],
      requiredCommunityCollegeKeys: ['va:CSC222'],
    });
    expect(report).toMatchObject({
      ready: false,
      blocker: 'virginia_figure6_prerequisite_model_unavailable',
      contract: {
        formula: 'paths_or__conditions_and',
        community_college: { owner_namespace: 'va:vccs' },
        university: { owner_namespace: 'va:uni:<school_id>' },
      },
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'prerequisite_corpus_missing',
      'exact_formula_adapter_not_integrated',
    ]));
  });

  it('accepts only complete, source-backed corpora after the exact adapter is integrated', () => {
    const closureRows = [
      requisite({
        course_key: 'va:CSC221', status: 'none', raw_requisites: null, groups: [],
        source_url: 'https://courses.vccs.edu/courses/CSC221',
      }),
      requisite({
        course_key: 'va:CSC110', status: 'none', raw_requisites: null, groups: [],
        source_url: 'https://courses.vccs.edu/courses/CSC110',
      }),
      requisite({
        course_key: 'va:CSC111', status: 'none', raw_requisites: null, groups: [],
        source_url: 'https://courses.vccs.edu/courses/CSC111',
      }),
    ];
    const university = requisite({
      course_key: 'va:uni:9205:CSC201',
      owner_namespace: 'va:uni:9205',
      source: 'institution_catalog',
      source_url: 'https://catalog.example.edu/courses/CSC201',
      source_bundle_hash: 'catalog-sha256',
      status: 'none',
      raw_requisites: null,
      groups: [],
    });
    const report = validateVirginiaFigure6PrerequisiteCorpus({
      communityCollegeRows: [requisite(), ...closureRows],
      universityRows: [university],
      requiredCommunityCollegeKeys: ['va:CSC222'],
      requiredUniversityKeys: ['va:uni:9205:CSC201'],
      adapterIntegrated: true,
    });
    expect(report).toMatchObject({ ready: true, blocker: null, issues: [] });
  });

  it('rejects owner, authority, formula, and required-course gaps independently', () => {
    const report = validateVirginiaFigure6PrerequisiteCorpus({
      communityCollegeRows: [requisite({
        owner_namespace: 'uc:9205', source: 'transfer_equivalency',
      })],
      universityRows: [requisite({
        course_key: 'va:uni:9205:CSC201',
        owner_namespace: 'uc:9205',
        source: 'transfer_equivalency',
        source_bundle_hash: null,
        groups: [{ kind: 'prerequisite', formula: 'flat_and', paths: [] }],
      })],
      requiredCommunityCollegeKeys: ['va:CSC999'],
      requiredUniversityKeys: ['va:uni:9205:CSC999'],
      adapterIntegrated: true,
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'required_course_requisite_missing',
      'vccs_owner_namespace_required',
      'wrong_prerequisite_authority',
      'university_owner_namespace_required',
      'source_bundle_hash_required',
      'lossless_formula_contract_required',
      'formula_paths_required',
    ]));
  });

  it('derives the VCCS direct set, excludes Richard Bland-only rows, and retains gaps', () => {
    const scope = [
      { code: 'CSC221', colleges: ['Blue Ridge Community College'] },
      { code: 'MATH251', colleges: ['Richard Bland College'] },
      { code: 'REL210', colleges: ['Blue Ridge Community College', 'Richard Bland College'] },
    ];
    expect(requiredVccsCourseKeys(scope)).toEqual(['va:CSC221', 'va:REL210']);
    const artifact = { rows: [
      requisite({
        code: 'CSC221', course_key: 'va:CSC221', status: 'none', groups: [],
        raw_requisites: null, supply_kind: 'vccs_requirement_scope', scope_role: 'major_preparation',
        source_url: 'https://courses.vccs.edu/courses/CSC221', flags: ['source_flag'],
      }),
      requisite({
        code: 'REL210', course_key: 'va:REL210', status: 'missing', groups: [],
        raw_requisites: null, supply_kind: 'vccs_requirement_scope', scope_role: 'major_preparation',
        source: 'requirement_scope_only', institution_overrides: [{ institution: 'Richard Bland College' }],
      }),
      requisite({
        code: 'MATH251', course_key: 'va:MATH251', status: 'missing', groups: [],
        supply_kind: 'richard_bland_scope', scope_role: 'major_preparation',
      }),
    ] };
    const adapted = adaptVccsPrerequisiteArtifact(artifact, scope);
    expect(adapted.rows.map((row) => row.course_key)).toEqual(['va:CSC221', 'va:REL210']);
    expect(adapted.rows.every((row) => row.owner_namespace === 'va:vccs')).toBe(true);
    expect(adapted.rows[0].flags).toEqual(['source_flag']);
    expect(adapted.rows[1].institution_overrides).toEqual([{ institution: 'Richard Bland College' }]);
    expect(adapted.report).toMatchObject({
      ready: false,
      counts: { rows: 2, required: 2, required_present: 2, none: 1, missing: 1 },
    });
    expect(adapted.report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'wrong_prerequisite_authority',
      'requisite_status_not_publishable',
    ]));
  });

  it('fails on duplicate rows and incomplete prerequisite closure', () => {
    const row = requisite();
    const report = validateVccsFigure6PrerequisiteCorpus({
      rows: [row, { ...row }],
      requiredKeys: ['va:CSC222'],
    });
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate_course_requisite',
      'prerequisite_formula_closure_missing',
    ]));
  });

  it('rejects a claimed explicit none that still carries requisite text', () => {
    const report = validateVccsFigure6PrerequisiteCorpus({
      rows: [requisite({ status: 'none', groups: [] })],
      requiredKeys: ['va:CSC222'],
    });
    expect(report.issues.map((issue) => issue.code))
      .toContain('explicit_none_has_raw_requisite');
  });

  it('accepts owner-complete archive formulas only with canonical closure ownership', () => {
    const archived = requisite({
      code: 'CSC200',
      course_key: 'va:CSC200',
      scope_role: 'prerequisite_only',
      scope_colleges: [],
      source: 'official_owner_catalog_course_entry',
      source_url: 'https://laurelridge.edu/files/documents/current-students/college-catalog/2019-20/2019-20%20CATALOG.pdf',
      authority_scope: 'owner_complete_for_canonical_dependency_scope',
      owner_coverage: ['Laurel Ridge Community College'],
      required_by: ['CSC201'],
      required_by_owner_coverage: ['Laurel Ridge Community College'],
      current_vccs_master_evidence: {
        status: 'missing', source_url: 'https://courses.vccs.edu/courses/CSC200',
      },
      raw_requisites: 'Prerequisite(s): Readiness to enroll in ENG 111.',
      source_content_sha256: '16f2987261bffa8a36b7c5849c88c104e9a77f0567f5b7b0b07301806048ec67',
      source_evidence: {
        kind: 'official_course_entry',
        raw_text: 'CSC 200 Introduction to Computer Science. Prerequisite(s): Readiness to enroll in ENG 111.',
        content_sha256: '16f2987261bffa8a36b7c5849c88c104e9a77f0567f5b7b0b07301806048ec67',
        document_content_sha256: 'eaf380a923383e2c59c41df590ca6d6e6c3306f1d4d8249dc4446e4aaaac9273',
        catalog_page: 158,
        pdf_page: 168,
      },
      groups: [{
        kind: 'prerequisite', formula: 'paths_or__conditions_and',
        paths: [{ all_of: [{
          type: 'non_course', condition: 'course_eligibility', code: 'ENG111',
          course_key: 'va:ENG111', raw: 'Readiness to enroll in ENG 111',
        }] }],
      }],
    });
    expect(validateVccsFigure6PrerequisiteCorpus({ rows: [archived] }))
      .toMatchObject({ ready: true, issues: [] });

    const missingOwnerReceipt = structuredClone(archived);
    missingOwnerReceipt.required_by_owner_coverage = [];
    const issueCodes = validateVccsFigure6PrerequisiteCorpus({
      rows: [missingOwnerReceipt],
    }).issues.map((issue) => issue.code);
    expect(issueCodes).toContain('owner_formula_scope_incomplete');

    const wrongScope = structuredClone(archived);
    wrongScope.authority_scope = 'owner_complete_for_requirement_scope';
    expect(validateVccsFigure6PrerequisiteCorpus({ rows: [wrongScope] }).issues
      .map((issue) => issue.code)).toContain('owner_complete_scope_required');
  });

  it('rejects unknown or incomplete conditions, cross-owner closure, and unsourced university rows', () => {
    const malformed = requisite({
      course_key: 'va:uni:9205:CSC201',
      owner_namespace: 'va:uni:9205',
      source: 'institution_catalog',
      source_bundle_hash: 'catalog-sha256',
      source_url: null,
      groups: [{
        kind: 'prerequisite',
        formula: 'paths_or__conditions_and',
        paths: [{ all_of: [
          { type: 'banana' },
          { type: 'non_course', condition: '', raw: '' },
          { type: 'course', code: 'CSC101', course_key: 'va:uni:9206:CSC101' },
        ] }],
      }],
    });
    const crossOwnerClosure = requisite({
      course_key: 'va:uni:9206:CSC101',
      owner_namespace: 'va:uni:9205',
      source: 'institution_catalog',
      source_bundle_hash: 'catalog-sha256',
      source_url: 'https://catalog.example.edu/courses/CSC101',
      status: 'none',
      raw_requisites: null,
      groups: [],
    });
    const report = validateVirginiaFigure6PrerequisiteCorpus({
      universityRows: [malformed, crossOwnerClosure],
      requiredUniversityKeys: ['va:uni:9205:CSC201'],
      adapterIntegrated: true,
    });

    expect(report.ready).toBe(false);
    expect(report.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'university_catalog_source_url_required',
      'requisite_condition_not_supported',
      'non_course_condition_required',
      'non_course_raw_required',
      'prerequisite_key_outside_owner_namespace',
      'course_key_outside_owner_namespace',
    ]));
  });

  it('audits the complete checked-in VCCS artifact without hiding source provenance', () => {
    const artifact = JSON.parse(fs.readFileSync(
      new URL('../../../scripts/data/va_course_requisites.json', import.meta.url),
    ));
    const scope = JSON.parse(fs.readFileSync(
      new URL('../../.va-degrees/cs_course_scope.json', import.meta.url),
    ));
    const adapted = adaptVccsPrerequisiteArtifact(artifact, scope);
    expect(adapted.report).toMatchObject({
      ready: true,
      blocker: null,
      counts: {
        rows: 189,
        required: 184,
        required_present: 184,
        parsed: 87,
        none: 97,
        missing: 0,
        unparsed: 0,
      },
    });
    expect(new Set(adapted.rows.map((row) => row.owner_namespace)))
      .toEqual(new Set(['va:vccs']));
    const issueCounts = adapted.report.issues.reduce((counts, issue) => ({
      ...counts,
      [issue.code]: (counts[issue.code] || 0) + 1,
    }), {});
    expect(issueCounts).toEqual({});
    expect(adapted.rows.filter((row) => row.status === 'none').every((row) => (
      row.raw_requisites === null
      && row.groups.length === 0
      && (
        /^https:\/\/courses\.vccs\.edu\/courses\//.test(row.source_url)
        || /^https:\/\/catalog\.sw\.edu\/preview_course_nopop\.php/.test(row.source_url)
      )
    ))).toBe(true);
    expect(adapted.rows.filter((row) => row.status === 'unparsed').map((row) => row.code))
      .toEqual([]);
    expect(adapted.rows.filter((row) => row.status === 'missing').map((row) => row.code))
      .toEqual([]);
    expect(adapted.rows.find((row) => row.code === 'PHI102')).toMatchObject({
      scope_role: 'major_preparation',
      status: 'none',
      source: 'official_owner_catalog_course_entry',
      source_evidence: {
        source_capture: {
          source_response_sha256: 'e84ae9af17aa950e1430e746212f14c6f7e2338042bb3ebf04df492c15ef3a0f',
          course_fragment_html_sha256: '9106c24d941673e0f0c3e90314010a57c7b61bd541cd9e7a0bddd3a53242afe2',
          extracted_entry_sha256: 'abe25a096233bd14ee2d20935d2b456f1ae740c924c4c658870296da7e682a6e',
          parser_contract: 'southwest-courseleaf-preview-course-fragment-v1',
        },
      },
      explicit_none_evidence: {
        kind: 'structured_owner_catalog_record_boundary',
        literal_none_statement: false,
        parser_contract: 'southwest-courseleaf-single-course-record-v1',
        requisite_clause_count: 0,
        same_catalog_marker_control: {
          code: 'ENG268',
          source_url: expect.stringContaining('catoid=2'),
          catalog_year: '2020-2021',
        },
      },
    });
    expect(adapted.rows.find((row) => row.code === 'EGR126')).toMatchObject({
      scope_role: 'prerequisite_only',
      status: 'none',
      source: 'vccs_master_course_file',
      explicit_none_evidence: {
        kind: 'structured_vccs_master_record_boundary',
        literal_none_statement: false,
        parser_contract: 'vccs-master-dt-dd-endtext-v1',
        requisite_clause_count: 0,
      },
    });
    expect(adapted.rows.filter((row) => ['BIO141', 'EGR121'].includes(row.code)).every((row) => (
      row.status === 'parsed'
    ))).toBe(true);
    expect(adapted.report.issues.some((issue) => (
      issue.code === 'prerequisite_formula_closure_missing'
    ))).toBe(false);
  });

  it('fails closed if the structured owner-record none control is weakened', () => {
    const artifact = JSON.parse(fs.readFileSync(
      new URL('../../../scripts/data/va_course_requisites.json', import.meta.url),
    ));
    const scope = JSON.parse(fs.readFileSync(
      new URL('../../.va-degrees/cs_course_scope.json', import.meta.url),
    ));
    const mutations = [
      (row) => { row.explicit_none_evidence.literal_none_statement = true; },
      (row) => { row.explicit_none_evidence.same_catalog_marker_control.source_url = row.explicit_none_evidence.same_catalog_marker_control.source_url.replace('catoid=2', 'catoid=99'); },
      (row) => { row.explicit_none_evidence.same_catalog_marker_control.raw_entry_sha256 = '0'.repeat(63); },
      (row) => { row.source_evidence.record_boundary = 'unbounded page'; },
      (row) => { row.source_evidence.source_capture.source_response_sha256 = '0'.repeat(64); },
      (row) => { row.explicit_none_evidence.same_catalog_marker_control.source_capture.parser_contract = 'unbounded-page-v0'; },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(artifact);
      mutate(changed.rows.find((row) => row.code === 'PHI102'));
      const report = adaptVccsPrerequisiteArtifact(changed, scope).report;
      expect(report.ready).toBe(false);
      expect(report.issues.map((issue) => issue.code)).toContain(
        'structured_owner_record_none_evidence_required',
      );
    }
  });

  it('accepts Bridgewater structural silence only with the exact edition population receipt', () => {
    const review = JSON.parse(fs.readFileSync(new URL(
      '../../.va-catalogs/research/va-university-prerequisite-review.json',
      import.meta.url,
    )));
    const source = review.promoted_rows.find((row) => (
      row.slug === 'bridgewater-college' && row.code === 'COMM100'
    ));
    const row = structuredClone(source);
    row.source_bundle_hash = sourceBundleHashForRows([row], row.owner_namespace);
    const options = {
      role: 'university',
      officialHostsByOwner: { [row.owner_namespace]: ['bridgewater.cleancatalog.io'] },
      allowedOwners: [row.owner_namespace],
    };
    expect(officialSourceEvidenceIssues([row], options)).toEqual([]);

    const mutations = [
      (changed) => {
        changed.structural_none_evidence.marker_control.population_sha256 = '0'.repeat(64);
      },
      (changed) => {
        changed.structural_none_evidence.entry_marker_receipt
          .exact_corequisite_field_count = 1;
      },
      (changed) => {
        changed.review_evidence.edition_response_sha256 = '1'.repeat(64);
      },
      (changed) => {
        changed.structural_none_evidence.marker_control.safe_silent_course_keys = [];
      },
    ];
    for (const mutate of mutations) {
      const changed = structuredClone(row);
      mutate(changed);
      changed.source_bundle_hash = sourceBundleHashForRows([changed], changed.owner_namespace);
      expect(officialSourceEvidenceIssues([changed], options).map((issue) => issue.code))
        .toContain('structured_bridgewater_cleancatalog_none_evidence_required');
    }
  });
});
