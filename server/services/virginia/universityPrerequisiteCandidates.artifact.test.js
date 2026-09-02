import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { validateUniversityPrerequisiteCandidates } from './universityPrerequisiteCandidates';

const require = createRequire(import.meta.url);
const { buildFromCache } = require('../../scripts/va/buildUniversityPrerequisiteCandidates');
const {
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
} = require('./shenandoahAcalogPrerequisiteAcquisition');

const scope = JSON.parse(fs.readFileSync(
  new URL('../../.va-catalogs/research/va-university-prerequisite-scope.json', import.meta.url),
  'utf8',
));
const artifact = JSON.parse(fs.readFileSync(
  new URL('../../.va-catalogs/research/va-university-prerequisite-candidates.json', import.meta.url),
  'utf8',
));
const catalogTexts = Object.fromEntries(scope.universities.map(({ slug }) => [
  slug,
  fs.readFileSync(new URL(`../../.va-catalogs/pages/${slug}__course_catalog.txt`, import.meta.url), 'utf8'),
]));

describe('checked-in Virginia university prerequisite entry candidates', () => {
  it('is source-exact, internally partitioned, and deliberately non-publishable', () => {
    expect(validateUniversityPrerequisiteCandidates(artifact, { scope, catalogTexts }))
      .toEqual({ valid: true, issues: [] });
    expect(buildFromCache()).toEqual(artifact);
    expect(artifact.summary).toEqual({
      active_universities: 16,
      direct_named_courses: 843,
      deterministic_resident_path_courses: 7,
      required_resident_path_courses: 850,
      exact_code_tokens_in_cached_official_text: 347,
      safely_bounded_review_candidates: 1169,
      safely_bounded_direct_review_candidates: 849,
      safely_bounded_closure_review_candidates: 320,
      acquired_exact_entry_candidates: 935,
      cached_safely_bounded_review_candidates: 280,
      cached_exact_tokens_without_bounded_entry: 67,
      exact_tokens_without_bounded_entry: 0,
      direct_codes_without_exact_token: 503,
      remaining_direct_capture_floor: 1,
      publication_contract_rows: 0,
      recursive_closure_courses: null,
    });
    expect(artifact.candidates).toHaveLength(1169);
    expect(new Set(artifact.candidates.map((row) => row.row_status)))
      .toEqual(new Set(['candidate_review_required']));
    expect(artifact.candidates.every((row) => row.publication_ready === false)).toBe(true);
  });

  it('propagates only the two exact current Virginia Tech graduate CS entries', () => {
    const rows = artifact.candidates.filter((row) => (
      row.source.source_format === 'virginia_tech_current_graduate_cs_heading_entry'
    ));
    expect(rows.map((row) => row.course_code)).toEqual(['CS5104', 'CS5114']);
    expect(rows.every((row) => (
      row.publication_ready === false
      && row.source.catalog_edition_claimed === false
      && row.source.source_response_sha256
        === 'e745b75628f4e0c9fc3ce53a6fd28725e50f52a5451d777c53c892ff504eab17'
      && row.source.evidence_artifact_sha256
        === 'fcd9e497ad705003082251a89ab4e5c79df9f594c0f8eeb0a5cf82f92782ffab'
    ))).toBe(true);
    expect(rows.find((row) => row.course_code === 'CS5104').source)
      .toMatchObject({
        required_requisite_clause: null,
        structural_none_evidence: {
          exact_complete_entry_present: true,
          same_page_positive_control: true,
          missing_search_result_used: false,
        },
      });
    expect(rows.find((row) => row.course_code === 'CS5114').source)
      .toMatchObject({ required_requisite_clause: { statement_raw: 'Pre: CS3114' } });

    const tampered = structuredClone(artifact);
    tampered.candidates.find((row) => row.course_code === 'CS5114')
      .source.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain('va:uni:9230:CS5114:virginia_tech_graduate_cs_exact_evidence');
  });

  it('retains exact Bridgewater CleanCatalog boundaries and does not infer none from silence', () => {
    const rows = artifact.candidates.filter((row) => (
      row.slug === 'bridgewater-college'
      && row.source.source_format === 'cleancatalog_course_page'
    ));
    expect(rows.map((row) => row.course_code).sort()).toEqual([
      'ART321', 'ART322', 'CL100', 'CL150', 'CL200', 'CL400', 'COMM100',
      'CSCI100', 'CSCI101', 'CSCI102', 'CSCI110', 'CSCI130', 'CSCI131',
      'CSCI220', 'CSCI250', 'CSCI261', 'CSCI320', 'CSCI331', 'CSCI332',
      'CSCI341', 'CSCI342', 'CSCI361', 'CSCI400', 'CSCI461', 'DSA230',
      'DSA350', 'MATH110', 'MATH140', 'MATH141', 'MATH150',
    ]);
    expect(rows.every((row) => (
      row.no_prerequisite_inference === true
      && row.source.boundary_contract
        === 'bridgewater_cleancatalog_unique_class_article_exact_h1_and_units_v1'
      && row.source.edition_catalog_year === row.source.catalog_year_verified
      && row.source.requisite_field_receipt.receipt_contract
        === 'bridgewater_cleancatalog_exact_article_requisite_field_labels_v1'
      && row.source.requisite_field_receipt.unrecognized_requisite_like_field_count === 0
    ))).toBe(true);
    const manifest = artifact.capture_manifest.find((row) => (
      row.slug === 'bridgewater-college'
    ));
    expect(manifest).toMatchObject({
      acquired_review_candidate_count: 30,
      acquired_superseding_cached_candidate_count: 22,
      closure_review_candidate_codes: ['CSCI100'],
    });

    const tampered = structuredClone(artifact);
    tampered.candidates.find((row) => (
      row.slug === 'bridgewater-college' && row.course_code === 'ART321'
    )).source.requisite_field_receipt.requisite_fields[0].values_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain('va:uni:9205:ART321:bridgewater_requisite_field_receipt');
  });

  it('propagates generic CourseLeaf boundary and same-response marker receipts', () => {
    const rows = artifact.candidates.filter((row) => (
      row.source.source_format === 'courseleaf_courseblock'
    ));
    expect(rows.length).toBeGreaterThan(400);
    expect(rows.every((row) => (
      row.source.capture_origin === 'official_acquisition'
      && row.source.boundary_contract
        === 'unique_courseblock_exact_leading_code_with_published_units'
      && row.source.source_response_sha256 === row.source.declared_normalized_text_sha256
      && row.source.source_response_sha256 === row.source.retained_normalized_text_sha256
      && /^[a-f0-9]{64}$/.test(row.source.raw_entry_html_sha256)
      && row.source.complete_entry_receipt.receipt_contract
        === 'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1'
    ))).toBe(true);
    expect(rows.find((row) => (
      row.slug === 'george-mason-university' && row.course_code === 'ARAB325'
    ))).toMatchObject({
      source: {
        courseblock_index: expect.any(Number),
        published_units: expect.objectContaining({ credit_hours_min: expect.any(Number) }),
        complete_entry_receipt: expect.objectContaining({
          source_complete_entries_with_required_requisite_marker_count: expect.any(Number),
        }),
      },
    });

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.source.source_format === 'courseleaf_courseblock'
    ));
    row.source.complete_entry_receipt.entry_constraint_like_signal_count += 1;
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:courseleaf_marker_control`);
  });

  it('retains the separate pinned Virginia Tech response/text receipt', () => {
    const rows = artifact.candidates.filter((row) => (
      row.slug === 'virginia-polytechnic-institute-and-state-university'
      && row.source.retained_source_contract
    ));
    expect(rows).toHaveLength(40);
    expect(rows.every((row) => (
      row.source.retained_source_contract
        === 'retained_official_2026_2027_department_whole_response_and_exact_courseblock_v1'
      && row.source.source_response_sha256
        === '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4'
      && row.source.retained_source_text_sha256
        === 'f528785a2ea8c8a37442ed618c72c61dd9064f7781084849613631e7820e618e'
      && row.source.live_recapture_claim === false
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.slug === rows[0].slug && candidate.source.retained_source_contract
    ));
    row.source.retained_source_text_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:virginia_tech_retained_source_receipt`);
  });

  it('propagates browser challenge, robots, and sitemap receipts without weakening review', () => {
    const rows = artifact.candidates.filter((row) => row.source.browser_challenge_contract);
    expect(rows).toHaveLength(220);
    expect(rows.every((row) => (
      row.publication_ready === false
      && row.no_prerequisite_inference === true
      && row.source.browser_challenge_receipt.document_responses[0].http_status === 202
      && row.source.browser_challenge_receipt.document_responses[1].http_status === 200
      && row.source.robots_receipt.path_allowed === true
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => candidate.source.browser_challenge_contract);
    row.source.robots_receipt.path_allowed = false;
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:browser_challenge_receipt`);
  });

  it('propagates every exact Radford detail/discovery/clause receipt without inferring silence', () => {
    const rows = artifact.candidates.filter((row) => row.slug === 'radford-university');
    expect(rows).toHaveLength(26);
    expect(rows.every((row) => (
      row.source.capture_origin === 'official_radford_acalog_course_page'
      && row.source.source_format === 'radford_acalog_course_page'
      && row.source.catoid === 62
      && row.source.robots_crawl_delay_seconds === 120
      && row.no_prerequisite_inference === true
    ))).toBe(true);
    expect(rows.filter((row) => row.source.required_requisite_clause)).toHaveLength(22);
    expect(rows.filter((row) => row.source.pre_or_corequisite_clause)).toHaveLength(2);
    expect(rows.filter((row) => row.source.discovery_contract
      === 'radford_hash_pinned_retained_course_entry_exact_link_and_coid_v1'))
      .toHaveLength(11);
    const silent = rows.filter((row) => !row.source.required_requisite_clause);
    expect(silent.every((row) => row.formula_status === 'unparsed_review_required')).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.slug === 'radford-university' && candidate.source.required_requisite_clause
    ));
    row.source.required_requisite_clause.relative_end -= 1;
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:radford_clause_receipt`);
  });

  it('propagates every exact UVA Wise HTTP/detail/discovery receipt without inferring silence', () => {
    const rows = artifact.candidates.filter((row) => (
      row.slug === 'the-university-of-virginia-s-college-at-wise'
    ));
    expect(rows).toHaveLength(34);
    expect(rows.every((row) => (
      row.source.capture_origin === 'official_uva_wise_acalog_course_page'
      && row.source.source_format === 'uva_wise_acalog_course_page'
      && row.source.catoid === 9
      && row.source.robots_crawl_delay_seconds === 120
      && row.source.http_exception_contract
        === 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1'
      && new URL(row.source.official_url).protocol === 'http:'
      && row.no_prerequisite_inference === true
    ))).toBe(true);
    const direct = rows.filter((row) => row.source.discovery_contract
      === 'uva_wise_two_retained_source_exact_course_link_and_coid_v1');
    const closure = rows.filter((row) => row.source.discovery_contract
      === 'uva_wise_hash_pinned_retained_course_entry_exact_link_and_coid_v1');
    expect(direct).toHaveLength(31);
    expect(closure).toHaveLength(3);
    expect(new Set(direct.map((row) => row.source.discovery_program_response_sha256)))
      .toEqual(new Set(['f0029d52ad30f4a795d79db032165ebb7e1c41f5742cb4753e3c55741002fd5e']));
    expect(new Set(direct.map((row) => row.source.discovery_ge_response_sha256)))
      .toEqual(new Set(['2ff74991394f4720a462d9e6e4b0d7276febbffe554f3095181f79f5e5cf127e']));
    const silent = rows.filter((row) => !row.source.required_requisite_clause);
    expect(silent.length).toBeGreaterThan(0);
    expect(silent.every((row) => row.formula_status === 'unparsed_review_required')).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.slug === 'the-university-of-virginia-s-college-at-wise'
        && candidate.source.required_requisite_clause
    ));
    row.source.required_requisite_clause.relative_end -= 1;
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:uva_wise_clause_receipt`);
  });

  it('propagates all exact Shenandoah detail and per-course discovery receipts fail closed', () => {
    const rows = artifact.candidates.filter((row) => row.slug === 'shenandoah-university');
    expect(rows).toHaveLength(19);
    expect(rows.every((row) => {
      const record = SHENANDOAH_DIRECT_COURSE_RECORDS[row.course_code];
      return row.source.capture_origin === 'official_shenandoah_acalog_course_page'
        && row.source.source_format === 'shenandoah_acalog_course_page'
        && row.source.catoid === 33
        && row.source.coid === record.coid
        && row.source.robots_crawl_delay_seconds === 120
        && row.source.discovery_contract
          === (record.discovery_contract || SHENANDOAH_DISCOVERY_CONTRACT)
        && row.source.discovery_cache_path
          === (record.discovery_cache_path || SHENANDOAH_PROGRAM_CACHE_PATH)
        && row.source.discovery_response_sha256
          === (record.discovery_response_sha256 || SHENANDOAH_PROGRAM_HTML_SHA256)
        && row.no_prerequisite_inference === true;
    })).toBe(true);
    expect(rows.filter((row) => row.source.required_requisite_clause)).toHaveLength(14);
    expect(rows.find((row) => row.course_code === 'CSC121')).toMatchObject({
      formula_status: 'unparsed_review_required',
      source: {
        required_requisite_clause: null,
        formal_corequisite_marker_count: 0,
        raw_entry_text: expect.stringContaining('programming experience is required'),
      },
    });
    expect(rows.find((row) => row.course_code === 'MATH102')
      .source.required_requisite_clause.raw)
      .toBe('Math 101 or assignment through the Math Placement Test.');
    expect(rows.find((row) => row.course_code === 'MATH101').source)
      .toMatchObject({ required_requisite_clause: null, formal_corequisite_marker_count: 0 });

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.slug === 'shenandoah-university' && candidate.source.required_requisite_clause
    ));
    row.source.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:shenandoah_clause_receipt`);
  });

  it('uses exact CNU PDF columns plus the exact-target-only current CPEN371W join', () => {
    const cnu = artifact.capture_manifest.find((row) => (
      row.slug === 'christopher-newport-university'
    ));
    expect(cnu).toMatchObject({
      exact_code_token_count: 46,
      cached_bounded_review_candidate_count: 0,
      acquired_review_candidate_count: 58,
      closure_review_candidate_count: 12,
      bounded_review_candidate_count: 46,
      direct_codes_without_bounded_candidate: [],
      capture_status: 'official_acquisition_boundaries_available',
      capture_strategy: 'official_pdf_bbox_nonoverlapping_columns',
    });
    const cnuRows = artifact.candidates.filter((row) => (
      row.slug === 'christopher-newport-university'
    ));
    expect(cnuRows).toHaveLength(58);
    const pdfRows = cnuRows.filter((row) => row.source.source_format === 'pdf_bbox_columns');
    expect(pdfRows).toHaveLength(57);
    expect(pdfRows.every((row) => (
      row.source.source_format === 'pdf_bbox_columns'
      && row.source.pdf_sha256 === '30e4ab16d575d4ab5a966012f37cf6a6b536ffb775d267fccba4f82fcd23d327'
      && row.source.source_blocks.length > 0
    ))).toBe(true);
    expect(cnuRows.find((row) => row.course_code === 'CPEN371W')).toMatchObject({
      source: {
        source_format: 'cnu_current_joint_identity_pdf_entry',
        identity_resolution: {
          scope: 'CPEN371W_only',
          broad_suffix_alias_rule_created: false,
        },
      },
    });
    const compounds = cnuRows.filter((row) => row.source.compound_entry === true);
    expect(compounds.map((row) => row.course_code).sort()).toEqual([
      'PHYS151', 'PHYS151L', 'PHYS152', 'PHYS152L',
    ]);
    expect(compounds.every((row) => (
      row.source.boundary_contract
        === 'cnu_pdf_bbox_pinned_compound_heading_course_specific_requisite_v1'
      && row.source.raw_entry_text.includes(row.source.compound_member_requisite.statement_raw)
      && row.source.compound_sibling_requisites.length === 1
      && row.source.raw_entry_text.includes(row.source.compound_sibling_requisites[0].statement_raw)
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => candidate.course_code === 'PHYS151');
    row.source.compound_member_requisite.raw_normalized = 'PHYS 999';
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:cnu_compound_receipt`);
    for (const row of artifact.capture_manifest.filter((entry) => (
      entry.exact_code_token_count === 0
    ))) {
      expect(row.cached_bounded_review_candidate_count).toBe(0);
    }
  });

  it('carries Longwood department and Banner entries with the independent edition context', () => {
    const manifest = artifact.capture_manifest.find((row) => (
      row.slug === 'longwood-university'
    ));
    expect(manifest).toMatchObject({
      capture_strategy: 'official_unique_entry_listings_with_separate_catoid_19_context',
      acquired_review_candidate_count: 31,
      closure_review_candidate_count: 2,
      bounded_review_candidate_count: 29,
      direct_codes_without_bounded_candidate: [],
    });
    const rows = artifact.candidates.filter((row) => row.slug === 'longwood-university');
    expect(rows).toHaveLength(31);
    expect(rows.every((row) => (
      ['longwood_department_course_listing', 'longwood_banner_course_listing']
        .includes(row.source.source_format)
      && row.source.catalog_context_catalog_year === '2026-2027'
      && row.source.catalog_context_catoid === 19
      && row.source.department_page_catalog_year_statement === null
      && row.source.two_source_binding_note.includes('does not print a catalog year')
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.candidates.find((candidate) => (
      candidate.source.source_format === 'longwood_banner_course_listing'
    ));
    row.source.catalog_context_catoid = 18;
    expect(validateUniversityPrerequisiteCandidates(tampered, { scope, catalogTexts }).issues)
      .toContain(`${row.course_key}:longwood_banner_catalog_context`);

    const identityTampered = structuredClone(artifact);
    const perspective = identityTampered.candidates.find((candidate) => (
      candidate.slug === 'longwood-university' && candidate.course_code === 'PSYC335'
    ));
    perspective.course_code = 'PSYC336';
    expect(validateUniversityPrerequisiteCandidates(
      identityTampered, { scope, catalogTexts },
    ).issues).toContain(`${perspective.course_key}:longwood_banner_identity`);
  });

  it('keeps the remaining direct-source gaps ranked by exact active-column impact', () => {
    const ranked = artifact.capture_manifest
      .filter((row) => row.direct_codes_without_bounded_candidate_count > 0)
      .sort((left, right) => (
        right.direct_codes_without_bounded_candidate_count
          - left.direct_codes_without_bounded_candidate_count
        || left.slug.localeCompare(right.slug)
      ))
      .map((row) => [row.slug, row.direct_codes_without_bounded_candidate_count]);
    expect(ranked).toEqual([
      ['virginia-polytechnic-institute-and-state-university', 1],
    ]);
    expect(ranked.reduce((total, [, count]) => total + count, 0)).toBe(1);
    expect(artifact.capture_manifest.find((row) => row.slug === 'longwood-university')
      .direct_codes_without_bounded_candidate_count).toBe(0);
    expect(artifact.capture_manifest.find((row) => row.slug === 'norfolk-state-university')
      .direct_codes_without_bounded_candidate_count).toBe(0);
  });
});
