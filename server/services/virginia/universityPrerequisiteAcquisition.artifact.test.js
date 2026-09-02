import crypto from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildAcquisitionPlan,
  validateAcquisitionArtifact,
} from './universityPrerequisiteAcquisition';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildFromCache,
  buildCnuCpen371wEvidenceCapture,
  buildCnuPdfCapture,
  buildLongwoodBannerCapture,
  buildLongwoodDepartmentCapture,
  buildRadfordCourseCapture,
  buildShenandoahCourseCapture,
  buildUvaWiseCourseCapture,
} = require('../../scripts/va/acquireUniversityPrerequisites');

const read = (relative) => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const scope = read('../../.va-catalogs/research/va-university-prerequisite-scope.json');
const candidates = read('../../.va-catalogs/research/va-university-prerequisite-candidates.json');
const review = read('../../.va-catalogs/research/va-university-prerequisite-review.json');
const artifact = read('../../.va-catalogs/research/va-university-prerequisite-acquisition.json');
const cacheRoot = new URL('../../.va-catalogs/', import.meta.url);
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

describe('checked-in university prerequisite official capture', () => {
  it('is review-only, internally exact, and at a supported-route fixed point', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    expect(validateAcquisitionArtifact(artifact, { plan }))
      .toEqual({ valid: true, issues: [] });
    expect(buildFromCache(plan)).toEqual(artifact);
    expect(artifact.summary).toEqual({
      planned_capture_keys: 980,
      planned_routes: 285,
      attempted_routes: 285,
      bounded_routes: 272,
      blocked_or_empty_routes: 11,
      exact_entry_candidates: 935,
      unique_exact_entry_candidates: 935,
      owner_specific_blocked_keys: 0,
      tested_route_keys_without_exact_entry: 45,
      remaining_capture_keys: 45,
    });
    expect(artifact.entries.every((row) => (
      row.publication_ready === false && row.no_prerequisite_inference === true
    ))).toBe(true);
    expect(artifact.institution_gaps.find((row) => (
      row.slug === 'virginia-state-university'
    ))).toMatchObject({
      tested_official_route_missing_codes: ['GEEN310', 'MATH201'],
      remaining_capture_gap: 2,
    });
  });

  it('replays the pinned retained Virginia Tech CS whole response without a live-access claim', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const capture = artifact.captures.find((row) => (
      row.slug === 'virginia-polytechnic-institute-and-state-university'
      && row.platform === 'retained_courseleaf_source'
    ));
    const rows = artifact.entries.filter((row) => (
      row.slug === capture.slug && row.retained_source_contract
    ));
    expect(capture).toMatchObject({
      platform: 'retained_courseleaf_source',
      capture_status: 'bounded_entries_available',
      source_response_sha256: '89225dfa30ddcfdedca1fd6ec6f26b7ea220979589a97d874b69cf98dc95fbc4',
      retained_source_text_sha256: 'f528785a2ea8c8a37442ed618c72c61dd9064f7781084849613631e7820e618e',
      courseblock_count: 74,
      complete_entry_count: 74,
      exact_entry_count: 40,
      missing: [],
      live_recapture_claim: false,
    });
    expect(rows).toHaveLength(40);
    expect(rows.map((row) => row.course_code)).toContain('CS3744');
    expect(rows.every((row) => (
      row.retained_source_contract
        === 'retained_official_2026_2027_department_whole_response_and_exact_courseblock_v1'
      && row.live_recapture_claim === false
      && row.source_response_sha256 === capture.source_response_sha256
      && row.retained_source_text_sha256 === capture.retained_source_text_sha256
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => (
      entry.slug === capture.slug && entry.retained_source_contract
    ));
    row.retained_source_text_sha256 = '0'.repeat(64);
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:virginia_tech_retained_source_receipt`);
  });

  it('revalidates only the two exact GMU CYSE entries from the pinned false-blocked cache', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const rows = artifact.entries.filter((row) => (
      row.owner_namespace === 'va:uni:9210'
      && ['CYSE101', 'CYSE130'].includes(row.course_code)
    ));
    expect(rows.map((row) => row.course_code)).toEqual(['CYSE101', 'CYSE130']);
    expect(rows.every((row) => (
      row.cache_reacquisition_receipt?.contract
        === 'gmu_exact_cached_courseleaf_response_revalidated_after_false_interstitial_block_v1'
      && row.cache_reacquisition_receipt.prior_capture_disposition_revalidated
        === 'blocked_fail_closed'
      && row.cache_reacquisition_receipt.network_request_used === false
      && row.source_response_sha256
        === 'e1c6f3d40c65fe9b9c814891d34253bb9260e77575ca4e3b6c25cb6fd147eb23'
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => entry.course_key === 'va:uni:9210:CYSE101');
    row.cache_reacquisition_receipt.network_request_used = true;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:gmu_cyse_cache_reacquisition_receipt`);
  });

  it('replays the exact current Virginia Tech graduate CS entries and fails closed on mutation', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const capture = artifact.captures.find((row) => (
      row.platform === 'virginia_tech_graduate_cs_current_department_evidence'
    ));
    expect(capture).toMatchObject({
      slug: 'virginia-polytechnic-institute-and-state-university',
      official_url: 'https://students.cs.vt.edu/Graduate/Courses/GradCourseDescriptions.html',
      source_catalog_edition_claimed: false,
      source_response_sha256:
        'e745b75628f4e0c9fc3ce53a6fd28725e50f52a5451d777c53c892ff504eab17',
      robots_response_sha256:
        '373aba6c1f3e06d978ca61387bc4cec762d5841311734ada9c679c81db0669eb',
      facts_sha256: 'f814c273b86092e8a0c0c0231621860486a1dcd432f399d0775f3f0cf35dbaac',
      evidence_artifact_sha256:
        'fcd9e497ad705003082251a89ab4e5c79df9f594c0f8eeb0a5cf82f92782ffab',
      exact_entry_codes: ['CS5104', 'CS5114'],
    });
    const rows = artifact.entries.filter((row) => (
      row.capture_origin === 'official_current_virginia_tech_graduate_cs_evidence'
    ));
    expect(rows.map((row) => row.course_code)).toEqual(['CS5104', 'CS5114']);
    expect(rows.find((row) => row.course_code === 'CS5104')).toMatchObject({
      catalog_edition_claimed: false,
      formal_prerequisite_marker_count: 0,
      formal_corequisite_marker_count: 0,
      prerequisite_marker_like_count: 0,
      constraint_like_signal_count: 0,
      structural_none_evidence: {
        exact_complete_entry_present: true,
        same_page_positive_control: true,
        source_bounded_entry_count: 56,
        source_entries_with_pre_marker_count: 43,
        source_pre_marker_count: 46,
        missing_search_result_used: false,
      },
    });
    expect(rows.find((row) => row.course_code === 'CS5114')).toMatchObject({
      required_requisite_clause: {
        statement_raw: 'Pre: CS3114',
        raw: 'CS3114',
      },
    });

    const tampered = structuredClone(artifact);
    tampered.entries.find((row) => row.course_code === 'CS5104')
      .structural_none_evidence.source_pre_marker_count -= 1;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(
        'va:uni:9230:CS5104:virginia_tech_graduate_cs_exact_current_heading_boundary_or_prerequisite_receipt',
      );
  });

  it('binds Virginia Tech browser entries to the exact official sitemap and 202-to-200 receipts', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const rows = artifact.entries.filter((row) => (
      row.slug === 'virginia-polytechnic-institute-and-state-university'
      && row.browser_challenge_contract
    ));
    expect(rows).toHaveLength(190);
    expect(new Set(rows.map((row) => row.target_subject_prefix)).size).toBe(30);
    expect(rows.every((row) => (
      row.sitemap_discovery_receipt.path_discovered === true
      && row.sitemap_discovery_receipt.discovered_course_url === row.official_url
      && row.browser_challenge_receipt.document_responses[0].http_status === 202
      && row.browser_challenge_receipt.document_responses[1].http_status === 200
      && row.robots_receipt.path_allowed === true
    ))).toBe(true);
    expect(artifact.institution_gaps.find((row) => row.slug === rows[0].slug))
      .toMatchObject({
        exact_entry_candidates: 232,
        tested_official_route_missing_codes: [
          'ACIS3554', 'BIT4614', 'CHEM1055H', 'ECE1574',
          'ESM3016', 'MATH1114', 'MATH1224', 'MATH2224', 'MATH2224H',
          'ME2124', 'ME3134',
        ],
        remaining_capture_gap: 11,
      });

    const recursiveSubjectRows = rows.filter((row) => (
      new URL(row.official_url).pathname.startsWith('/course-descriptions/')
    ));
    expect(recursiveSubjectRows).toHaveLength(33);
    expect(recursiveSubjectRows.map((row) => row.course_code).sort()).toEqual([
      'ACIS1504', 'ACIS2115', 'ACIS2116', 'ACIS2504', 'ACIS3504',
      'BC1114', 'BC1124', 'BC1214', 'BC1224', 'BC2014', 'BC2024', 'BC2064',
      'BC2114', 'CEE2834', 'CEE3014', 'CEE3804', 'ECON2005', 'ECON2006',
      'ESM2104', 'ESM2114', 'ESM2304', 'FIN3104', 'FIN3114', 'ISC1105',
      'ISC1106', 'ISC1106H', 'ISC1115', 'ISC1116', 'ISC2105', 'ISE2024',
      'REAL2004', 'REAL2034', 'UAP2004',
    ]);
    expect(recursiveSubjectRows.every((row) => row.sitemap_discovery_receipt.path_discovered))
      .toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => entry.course_key === 'va:uni:9230:AOE4434');
    row.sitemap_discovery_receipt.path_discovered = false;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:virginia_tech_sitemap_receipt`);
  });

  it('records the exact robots-aware outcome of every newly exposed subject route', () => {
    const newlyExposedRouteIds = [
      'george-mason-university__arab',
      'george-mason-university__chin',
      'george-mason-university__clas',
      'george-mason-university__eled',
      'george-mason-university__engl',
      'george-mason-university__fren',
      'george-mason-university__frln',
      'george-mason-university__germ',
      'george-mason-university__hist',
      'george-mason-university__ints',
      'george-mason-university__ital',
      'george-mason-university__japa',
      'george-mason-university__kore',
      'george-mason-university__nclc',
      'george-mason-university__reli',
      'george-mason-university__russ',
      'george-mason-university__seed',
      'george-mason-university__span',
      'virginia-state-university__geen',
    ];
    const rows = artifact.captures.filter((row) => newlyExposedRouteIds.includes(row.route_id));
    expect(rows.map((row) => row.route_id).sort()).toEqual([...newlyExposedRouteIds].sort());
    expect(rows.some((row) => row.capture_status === 'not_attempted')).toBe(false);
    expect(rows.reduce((total, row) => total + (row.exact_entry_count || 0), 0)).toBe(37);
    expect(rows.filter((row) => row.capture_status === 'blocked_fail_closed').map((row) => (
      [row.route_id, row.target_course_codes, row.blocked_reason]
    ))).toEqual([
      [
        'george-mason-university__engl', ['ENGL100', 'ENGL101', 'ENGL122'],
        'response_failed_status_content_type_or_interstitial_check',
      ],
      [
        'george-mason-university__nclc', ['NCLC101', 'NCLC203'],
        'response_failed_status_content_type_or_interstitial_check',
      ],
      [
        'virginia-state-university__geen', ['GEEN310'],
        'response_failed_status_content_type_or_interstitial_check',
      ],
    ]);
    expect(rows.filter((row) => row.capture_status === 'blocked_fail_closed').every((row) => (
      row.robots?.http_status === 200
      && row.robots?.crawl_delay_seconds === 0
      && /^[a-f0-9]{64}$/.test(row.robots?.content_sha256 || '')
    ))).toBe(true);
    expect(rows.find((row) => row.route_id === 'george-mason-university__reli'))
      .toMatchObject({
        capture_status: 'bounded_entries_available',
        exact_entry_count: 5,
        missing: ['RELI271'],
      });
  });

  it('replays JMU browser-challenge robots and exact complete-entry receipts', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const routes = plan.routes.filter((row) => row.slug === 'james-madison-university');
    const captures = artifact.captures.filter((row) => (
      row.slug === 'james-madison-university'
    ));
    expect(routes).toHaveLength(2);
    expect(routes.reduce((total, row) => total + row.target_count, 0)).toBe(30);
    expect(routes.map((row) => row.official_url).sort()).toEqual([
      'https://catalog.jmu.edu/courses/cs/',
      'https://catalog.jmu.edu/courses/math/',
    ]);
    expect(captures).toHaveLength(2);
    expect(captures.reduce((total, row) => total + row.exact_entry_count, 0)).toBe(30);
    expect(captures.every((row) => (
      row.platform === 'browser_challenge_courseleaf'
      && row.capture_status === 'bounded_entries_available'
      && row.missing.length === 0
      && row.browser_challenge_receipt.document_responses.map((receipt) => (
        receipt.http_status
      )).join(',') === '202,200'
      && row.robots_receipt.capture.document_responses.map((receipt) => (
        receipt.http_status
      )).join(',') === '202,200'
      && row.robots_receipt.path_allowed === true
    ))).toBe(true);
    const jmuEntries = artifact.entries.filter((row) => (
      row.slug === 'james-madison-university'
    ));
    expect(jmuEntries).toHaveLength(30);
    expect(jmuEntries.every((row) => (
      row.published_units.structural_field === 'unique_detail-hours_html'
      && row.browser_challenge_contract
        === 'known_courseleaf_host_exact_same_url_document_202_then_200_raw_response_v1'
      && row.structured_requisite_fields.every((field) => (
        field.receipt_contract
          === 'courseleaf_exact_structured_requisite_field_offsets_and_html_hash_v1'
        && field.structural_class === 'courseblockextra'
      ))
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const entry = tampered.entries.find((row) => row.slug === 'james-madison-university');
    entry.browser_challenge_receipt.document_responses[0].http_status = 200;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${entry.course_key}:browser_challenge_receipt`);

    const fieldTampered = structuredClone(artifact);
    const fieldEntry = fieldTampered.entries.find((row) => (
      row.slug === 'james-madison-university'
      && row.structured_requisite_fields.length
    ));
    fieldEntry.structured_requisite_fields[0].relative_start += 1;
    expect(validateAcquisitionArtifact(fieldTampered, { plan }).issues)
      .toContain(`${fieldEntry.course_key}:courseleaf_structured_requisite_fields`);

    const retainedIndex = fs.readFileSync(new URL(
      '../../.va-catalogs/pages/james-madison-university__course_catalog.html',
      import.meta.url,
    ));
    expect(hash(retainedIndex))
      .toBe('135596b523c6b89dc94bcf315a661632b07356165791d975aecbfca34b97d2e9');
    const retainedText = retainedIndex.toString('utf8');
    expect(retainedText).toContain('2026-2027 Academic Catalog');
    expect(retainedText).toContain('/pdf/JMU2026-2027UndergraduateCatalog.pdf');
    // The index establishes the exact-year official paths, but is not itself
    // used as a course-entry source.
    expect(retainedText).not.toMatch(/class="courseblock"/);
  });

  it('replays generic CourseLeaf entry, response, unit, and marker-control receipts', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const rows = artifact.entries.filter((row) => (
      row.boundary_contract === 'unique_courseblock_exact_leading_code_with_published_units'
    ));
    expect(rows.length).toBeGreaterThan(400);
    expect(rows.every((row) => (
      row.raw_entry_sha256 === hash(row.raw_entry_text)
      && /^[a-f0-9]{64}$/.test(row.source_response_sha256)
      && /^[a-f0-9]{64}$/.test(row.raw_entry_html_sha256)
      && row.published_units.credit_hours_min >= 0
      && row.published_units.credit_hours_max >= row.published_units.credit_hours_min
      && row.complete_entry_receipt.receipt_contract
        === 'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1'
    ))).toBe(true);
    expect(rows.find((row) => (
      row.slug === 'george-mason-university' && row.course_code === 'ARAB325'
    ))).toMatchObject({
      courseblock_index: expect.any(Number),
      complete_entry_receipt: {
        source_complete_entry_count: expect.any(Number),
        source_complete_entries_with_required_requisite_marker_count: expect.any(Number),
      },
    });

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => (
      entry.boundary_contract === 'unique_courseblock_exact_leading_code_with_published_units'
    ));
    row.complete_entry_receipt.entry_required_requisite_marker_count += 1;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:courseleaf_marker_control`);
  });

  it('pins Bridgewater course pages to the independently verified catalog edition', () => {
    const entries = artifact.entries.filter((row) => row.slug === 'bridgewater-college');
    expect(entries.map((row) => row.course_code).sort()).toEqual([
      'ART321', 'ART322', 'CL100', 'CL150', 'CL200', 'CL400', 'COMM100',
      'CSCI100', 'CSCI101', 'CSCI102', 'CSCI110', 'CSCI130', 'CSCI131',
      'CSCI220', 'CSCI250', 'CSCI261', 'CSCI320', 'CSCI331', 'CSCI332',
      'CSCI341', 'CSCI342', 'CSCI361', 'CSCI400', 'CSCI461', 'DSA230',
      'DSA350', 'MATH110', 'MATH140', 'MATH141', 'MATH150',
    ]);
    expect(new Set(entries.map((row) => row.edition_response_sha256))).toEqual(new Set([
      '705fb1cad1dab47b0e3b55537d7b84ec57e438263bff73425c08712cdf770825',
    ]));
    expect(entries.every((row) => (
      row.edition_catalog_year === '2026-2027'
      && row.edition_exact_year_statement
        === 'Course numbers and descriptions listed herein apply to the 2026-2027 academic year.'
      && row.published_units.credit_hours_min === row.published_units.credit_hours_max
      && row.published_units.credit_hours_min > 0
      && row.requisite_field_receipt.receipt_contract
        === 'bridgewater_cleancatalog_exact_article_requisite_field_labels_v1'
      && row.requisite_field_receipt.unrecognized_requisite_like_field_count === 0
    ))).toBe(true);

    const markerCounts = entries.reduce((totals, row) => ({
      prerequisite: totals.prerequisite
        + row.requisite_field_receipt.exact_prerequisite_field_count,
      corequisite: totals.corequisite
        + row.requisite_field_receipt.exact_corequisite_field_count,
      silent: totals.silent + Number(
        row.requisite_field_receipt.exact_prerequisite_field_count === 0
        && row.requisite_field_receipt.exact_corequisite_field_count === 0
      ),
    }), { prerequisite: 0, corequisite: 0, silent: 0 });
    expect(markerCounts).toEqual({ prerequisite: 20, corequisite: 1, silent: 10 });

    const tampered = structuredClone(artifact);
    tampered.entries.find((row) => (
      row.slug === 'bridgewater-college' && row.course_code === 'COMM100'
    )).requisite_field_receipt.unrecognized_requisite_like_field_count = 1;
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: tampered,
    });
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain('va:uni:9205:COMM100:bridgewater_requisite_field_receipt');

  });

  it('replays the pinned legacy CNU PDF plus the exact current CPEN371W identity join', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const route = plan.routes.find((row) => row.platform === 'pdf_bbox_columns');
    const recomputed = buildCnuPdfCapture(route);
    const capture = artifact.captures.find((row) => row.route_id === route.route_id);
    const entries = artifact.entries.filter((row) => (
      row.slug === route.slug && row.pdf_sha256 === route.expected_pdf_sha256
    ));
    expect(capture).toMatchObject({
      capture_status: 'bounded_entries_available',
      exact_entry_count: 57,
      source_response_sha256: '30e4ab16d575d4ab5a966012f37cf6a6b536ffb775d267fccba4f82fcd23d327',
      bbox_layout_sha256: '1156fb942db6673f24ea89c2958e3bc8d5e669593d710e4329651f45a6dfc342',
      pdf_page_count: 315,
      ambiguous: [],
      geometry_rejections: [],
      missing: [],
    });
    expect(recomputed.capture).toEqual(capture);
    expect(recomputed.entries).toEqual(entries);
    expect(capture.compound_heading_rejections).toEqual([]);
    expect(capture.compound_entry_receipts).toEqual([
      expect.objectContaining({
        heading_text: 'PHYS 151-152. College Physics (3-3-0)',
        compound_course_codes: ['PHYS151', 'PHYS152'],
        raw_entry_sha256: '55e67117fbf3806f58297ca3348114198f431595ca8da3ed70df61d0a5985c7f',
        pdf_page_start: 278,
        pdf_page_end: 279,
        page_column_span: ['278:right', '279:left'],
        integrated_target_course_codes: ['PHYS151', 'PHYS152'],
        member_requisites: [
          expect.objectContaining({
            course_code: 'PHYS151',
            label: 'Prerequisites for PHYS 151',
            raw_normalized: 'High school algebra and trigonometry or consent of instructor',
            concurrent_allowed: false,
          }),
          expect.objectContaining({
            course_code: 'PHYS152',
            label: 'Prerequisite for PHYS 152',
            raw_normalized: 'PHYS 151',
            concurrent_allowed: false,
          }),
        ],
      }),
      expect.objectContaining({
        heading_text: 'PHYS 151L-152L. College Physics Laboratory (1-0-3)',
        compound_course_codes: ['PHYS151L', 'PHYS152L'],
        raw_entry_sha256: 'ed83312dc0385e8352454b155caf259b60b3a6e8ebe4ef69e75b0f99870bd412',
        pdf_page_start: 279,
        pdf_page_end: 279,
        page_column_span: ['279:left'],
        integrated_target_course_codes: ['PHYS151L', 'PHYS152L'],
        member_requisites: [
          expect.objectContaining({
            course_code: 'PHYS151L',
            label: 'Pre or Corequisite for PHYS 151L',
            raw_normalized: 'PHYS 151',
            concurrent_allowed: true,
          }),
          expect.objectContaining({
            course_code: 'PHYS152L',
            label: 'Pre or Corequisite for PHYS 152L',
            raw_normalized: 'PHYS 152',
            concurrent_allowed: true,
          }),
        ],
      }),
    ]);
    expect(capture.identity_discrepancy_receipts).toEqual([]);
    const exactRoute = plan.routes.find((row) => (
      row.platform === 'cnu_cpen371w_current_joint_evidence'
    ));
    const exactRecomputed = buildCnuCpen371wEvidenceCapture(exactRoute);
    const exactCapture = artifact.captures.find((row) => row.route_id === exactRoute.route_id);
    const exactEntry = artifact.entries.find((row) => row.course_code === 'CPEN371W');
    expect(exactRecomputed).toEqual({ capture: exactCapture, entries: [exactEntry] });
    expect(exactCapture).toMatchObject({
      exact_entry_count: 1,
      exact_entry_codes: ['CPEN371W'],
      alias_scope: 'CPEN371W_only',
      broad_suffix_alias_rule_created: false,
    });
    expect(exactEntry).toMatchObject({
      boundary_contract: 'cnu_current_degree_code_title_plus_catalog_wi_entry_identity_v1',
      course_code: 'CPEN371W',
      identity_resolution: {
        scope: 'CPEN371W_only',
        broad_suffix_alias_rule_created: false,
      },
    });
    const compoundEntries = entries.filter((row) => row.compound_entry === true);
    expect(compoundEntries.map((row) => row.course_code).sort()).toEqual([
      'PHYS151', 'PHYS151L', 'PHYS152', 'PHYS152L',
    ]);
    expect(compoundEntries.every((row) => (
      row.boundary_contract
        === 'cnu_pdf_bbox_pinned_compound_heading_course_specific_requisite_v1'
      && row.raw_entry_text.includes(row.compound_member_requisite.statement_raw)
      && row.compound_sibling_requisites.length === 1
      && row.raw_entry_text.includes(row.compound_sibling_requisites[0].statement_raw)
    ))).toBe(true);
    expect(entries.every((row) => (
      row.no_prerequisite_inference === true
      && row.source_blocks.length > 0
      && row.source_blocks.every((block) => ['left', 'right'].includes(block.column))
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => entry.course_code === 'PHYS151');
    row.compound_member_requisite.raw_normalized = 'PHYS 999';
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:compound_receipt`);
  });

  it('reproduces the exact Longwood CMSC roster with a separate catoid 19 context', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const route = plan.routes.find((row) => (
      row.platform === 'longwood_department_course_listing'
    ));
    const recomputed = buildLongwoodDepartmentCapture(route);
    const capture = artifact.captures.find((row) => row.route_id === route.route_id);
    const entries = artifact.entries.filter((row) => (
      row.boundary_contract
        === 'longwood_department_unique_course_listing_entry_with_published_credits_v1'
    ));
    expect(recomputed).toEqual({ capture, entries });
    expect(entries.map((row) => row.course_code)).toEqual([
      'CMSC140', 'CMSC160', 'CMSC161', 'CMSC162', 'CMSC201', 'CMSC208', 'CMSC210',
      'CMSC242', 'CMSC262', 'CMSC280', 'CMSC283', 'CMSC360', 'CMSC415', 'CMSC442',
      'CMSC455', 'CMSC461', 'CMSC483',
    ]);
    expect(capture).toMatchObject({
      exact_entry_count: 17,
      source_response_sha256: '01802e9aff48430af3064550c8b8bb6eb5011953282e3c18633f16101788609d',
      catalog_context_html_sha256: '1f983cba698cff68f85d60b3735c23d83d5aebcf51f5856b0dc9213dbcf78bc4',
      catalog_context_normalized_text_sha256: '7a8378f7e9249dce4f138e5fa62c487853ce3ca2c2a044ef8cb80c2ab248d36a',
      catalog_context_catalog_year: '2026-2027',
      catalog_context_catoid: 19,
      department_page_catalog_year_statement: null,
      robots: { http_status: 200, crawl_delay_seconds: 0 },
    });
    expect(entries.every((row) => (
      row.two_source_binding_note.includes('does not print a catalog year')
      && row.catalog_context_catoid === 19
      && row.no_prerequisite_inference === true
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => entry.slug === 'longwood-university');
    row.department_page_catalog_year_statement = '2026-2027';
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:longwood_catalog_context`);
  });

  it('replays Longwood Banner entries, context binding, and recursive MATH164 closure', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const route = plan.routes.find((row) => row.platform === 'longwood_banner_course_listing');
    const recomputed = buildLongwoodBannerCapture(route);
    const capture = artifact.captures.find((row) => row.route_id === route.route_id);
    const entries = artifact.entries.filter((row) => (
      row.boundary_contract
        === 'longwood_banner_unique_course_listing_entry_with_published_credits_v1'
    ));
    expect(recomputed).toEqual({ capture, entries });
    expect(entries.map((row) => row.course_code)).toEqual([
      'CTZN110', 'CTZN410', 'ENGL165', 'ENGL319', 'MATH164', 'MATH171',
      'MATH175', 'MATH250', 'MATH261', 'MATH301', 'PSYC335', 'RELI301',
      'SPAN212', 'SPAN320',
    ]);
    expect(capture).toMatchObject({
      exact_entry_count: 14,
      source_response_sha256: '2f4fc77307b8b4f045ed0f3809a6c57e534fbe7145ad8d5142fb1ca7adb37841',
      catalog_context_catalog_year: '2026-2027',
      catalog_context_catoid: 19,
      department_page_catalog_year_statement: null,
      robots: { http_status: 200, crawl_delay_seconds: 0 },
    });
    expect(entries.every((row) => (
      row.two_source_binding_note.includes('does not print a catalog year')
      && row.no_prerequisite_inference === true
    ))).toBe(true);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => (
      entry.boundary_contract
        === 'longwood_banner_unique_course_listing_entry_with_published_credits_v1'
    ));
    row.catalog_context_catoid = 18;
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:longwood_banner_catalog_context`);

    const identityTampered = structuredClone(artifact);
    const perspective = identityTampered.entries.find((entry) => (
      entry.slug === 'longwood-university' && entry.course_code === 'PSYC335'
    ));
    perspective.course_code = 'PSYC336';
    expect(validateAcquisitionArtifact(identityTampered, { plan }).issues)
      .toContain(`${perspective.course_key}:longwood_banner_identity`);
  });

  it('replays all direct and recursive Radford Acalog course responses exactly', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const routes = plan.routes.filter((row) => row.platform === 'radford_acalog_course');
    const captures = artifact.captures.filter((row) => row.platform === 'radford_acalog_course');
    const entries = artifact.entries.filter((row) => (
      row.boundary_contract
        === 'radford_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1'
    ));
    expect(routes).toHaveLength(26);
    expect(captures).toHaveLength(26);
    expect(entries).toHaveLength(26);
    expect(entries.filter((row) => row.discovery_contract
      === 'radford_retained_current_program_exact_course_link_and_coid_v1'))
      .toHaveLength(15);
    expect(entries.filter((row) => row.discovery_contract
      === 'radford_hash_pinned_retained_course_entry_exact_link_and_coid_v1'))
      .toHaveLength(11);
    for (const route of routes) {
      const recomputed = buildRadfordCourseCapture(route);
      expect(recomputed.capture).toEqual(captures.find((row) => row.route_id === route.route_id));
      expect(recomputed.entries).toEqual(entries.filter((row) => (
        row.course_code === route.target_course_codes[0]
      )));
    }
    expect(captures.every((row) => (
      row.capture_status === 'bounded_entries_available'
      && row.exact_entry_count === 1
      && row.robots?.crawl_delay_seconds === 120
      && /^[a-f0-9]{64}$/.test(row.source_response_sha256)
    ))).toBe(true);
    const fetchedAt = captures.map((row) => Date.parse(row.fetched_at)).sort((a, b) => a - b);
    expect(fetchedAt.every(Number.isFinite)).toBe(true);
    expect(fetchedAt.slice(1).every((value, index) => value - fetchedAt[index] >= 120_000))
      .toBe(true);
    expect(entries.filter((row) => row.required_requisite_clause)).toHaveLength(22);
    expect(entries.filter((row) => row.pre_or_corequisite_clause)).toHaveLength(2);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => entry.slug === 'radford-university'
      && entry.required_requisite_clause);
    row.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:radford_clause_receipt`);
  });

  it('replays all direct and recursive HTTP-only UVA Wise detail responses exactly', () => {
    const plan = buildAcquisitionPlan({
      scope, candidates, review, priorAcquisition: artifact,
    });
    const routes = plan.routes.filter((row) => row.platform === 'uva_wise_acalog_course');
    const captures = artifact.captures.filter((row) => row.platform === 'uva_wise_acalog_course');
    const entries = artifact.entries.filter((row) => (
      row.boundary_contract
        === 'uva_wise_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1'
    ));
    expect(routes).toHaveLength(34);
    expect(captures).toHaveLength(34);
    expect(entries).toHaveLength(34);
    for (const route of routes) {
      const recomputed = buildUvaWiseCourseCapture(route);
      expect(recomputed.capture).toEqual(captures.find((row) => row.route_id === route.route_id));
      expect(recomputed.entries).toEqual(entries.filter((row) => (
        row.course_code === route.target_course_codes[0]
      )));
    }
    expect(captures.every((row) => (
      row.capture_status === 'bounded_entries_available'
      && row.exact_entry_count === 1
      && row.robots?.url === 'http://catalog.uvawise.edu/robots.txt'
      && row.robots?.crawl_delay_seconds === 120
      && new URL(row.official_url).protocol === 'http:'
      && /^[a-f0-9]{64}$/.test(row.source_response_sha256)
    ))).toBe(true);
    const fetchedAt = captures.map((row) => Date.parse(row.fetched_at)).sort((a, b) => a - b);
    expect(fetchedAt.every(Number.isFinite)).toBe(true);
    expect(fetchedAt.slice(1).every((value, index) => value - fetchedAt[index] >= 120_000))
      .toBe(true);
    expect(entries.every((row) => (
      row.catoid === 9
      && row.http_exception_contract
        === 'exact_official_uva_wise_host_preview_course_path_http_only_tls_unavailable_v1'
      && [
        'uva_wise_two_retained_source_exact_course_link_and_coid_v1',
        'uva_wise_hash_pinned_retained_course_entry_exact_link_and_coid_v1',
      ].includes(row.discovery_contract)
    ))).toBe(true);
    expect(entries.filter((row) => row.discovery_contract
      === 'uva_wise_two_retained_source_exact_course_link_and_coid_v1'))
      .toHaveLength(31);
    expect(entries.filter((row) => row.discovery_contract
      === 'uva_wise_hash_pinned_retained_course_entry_exact_link_and_coid_v1'))
      .toHaveLength(3);

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => (
      entry.slug === 'the-university-of-virginia-s-college-at-wise'
        && entry.required_requisite_clause
    ));
    row.required_requisite_clause.raw_sha256 = '0'.repeat(64);
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:uva_wise_clause_receipt`);
  });

  it('replays nineteen exact Shenandoah catoid-33 detail responses at the published delay', () => {
    const plan = buildAcquisitionPlan({ scope, candidates, review, priorAcquisition: artifact });
    const routes = plan.routes.filter((row) => row.platform === 'shenandoah_acalog_course');
    const captures = artifact.captures.filter((row) => (
      row.platform === 'shenandoah_acalog_course'
    ));
    const entries = artifact.entries.filter((row) => (
      row.boundary_contract
        === 'shenandoah_acalog_unique_preview_course_record_exact_catoid_coid_h1_and_credits_v1'
    ));
    expect(routes).toHaveLength(19);
    expect(captures).toHaveLength(19);
    expect(entries).toHaveLength(19);
    for (const route of routes) {
      const recomputed = buildShenandoahCourseCapture(route);
      expect(recomputed.capture).toEqual(captures.find((row) => row.route_id === route.route_id));
      expect(recomputed.entries).toEqual(entries.filter((row) => (
        row.course_code === route.target_course_codes[0]
      )));
    }
    expect(captures.every((row) => (
      row.capture_status === 'bounded_entries_available'
      && row.exact_entry_count === 1
      && row.robots?.crawl_delay_seconds === 120
      && /^[a-f0-9]{64}$/.test(row.source_response_sha256)
    ))).toBe(true);
    const fetchedAt = captures.map((row) => Date.parse(row.fetched_at)).sort((a, b) => a - b);
    expect(fetchedAt.slice(1).every((value, index) => value - fetchedAt[index] >= 120_000))
      .toBe(true);
    expect(entries.filter((row) => row.required_requisite_clause)).toHaveLength(14);
    expect(entries.find((row) => row.course_code === 'CSC121')).toMatchObject({
      required_requisite_clause: null,
      formal_corequisite_marker_count: 0,
      raw_entry_text: expect.stringContaining('programming experience is required'),
    });
    expect(entries.find((row) => row.course_code === 'MATH209')
      .required_requisite_clause.raw).toBe('MATH 102 or MATH 201');
    expect(entries.find((row) => row.course_code === 'MATH102')
      .required_requisite_clause.raw)
      .toBe('Math 101 or assignment through the Math Placement Test.');
    expect(entries.filter((row) => ['ENG101', 'FYS101', 'INT101', 'MATH101'].includes(
      row.course_code,
    )).every((row) => (
      row.required_requisite_clause === null
      && row.formal_corequisite_marker_count === 0
    ))).toBe(true);
    expect(entries.find((row) => row.course_code === 'FYS101').raw_entry_text)
      .toContain('Open only to first-year, first-semester students.');

    const tampered = structuredClone(artifact);
    const row = tampered.entries.find((entry) => (
      entry.slug === 'shenandoah-university' && entry.required_requisite_clause
    ));
    row.discovery_response_sha256 = '0'.repeat(64);
    expect(validateAcquisitionArtifact(tampered, { plan }).issues)
      .toContain(`${row.course_key}:shenandoah_receipt`);
  });

  it('retains byte-exact official response files behind every accepted entry', () => {
    const captures = new Map(artifact.captures.map((row) => [row.route_id, row]));
    for (const entry of artifact.entries) {
      const capture = captures.get(`${entry.slug}__${entry.cache_path.match(/__([^/.]+)\.html$/)?.[1]}`)
        || artifact.captures.find((row) => row.cache_path === entry.cache_path);
      expect(capture).toBeTruthy();
      const bytes = fs.readFileSync(new URL(entry.cache_path, cacheRoot));
      expect(hash(bytes)).toBe(entry.source_response_sha256);
      expect(hash(entry.raw_entry_text)).toBe(entry.raw_entry_sha256);
      expect(new URL(entry.official_url).hostname).toBe(new URL(capture.official_url).hostname);
    }
  });
});
