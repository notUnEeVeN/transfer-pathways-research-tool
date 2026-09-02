import { describe, expect, it } from 'vitest';
import {
  boundedEntries,
  buildUniversityPrerequisiteCandidates,
  scanHeadings,
  validateUniversityPrerequisiteCandidates,
} from './universityPrerequisiteCandidates';
import {
  CNU_BOUNDARY_CONTRACT,
  CNU_EXPECTED_PDF_SHA256,
} from './cnuPdfPrerequisiteAcquisition';
import {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
} from './shenandoahAcalogPrerequisiteAcquisition';

const compactRule = {
  heading: /(CS) (\d{3}) ([A-Za-z0-9][^\n]{1,100}?) \((\d Credits?)\)/g,
  terminal: '\n\n Close this window',
};

describe('Virginia university prerequisite entry candidates', () => {
  it('uses headings as boundaries and does not promote prerequisite references', () => {
    const text = 'CS 101 First Course (3 Credits) Body. Prerequisite: CS 100. CS 102 Second Course (3 Credits) More.\n\n Close this window';
    const headings = scanHeadings(text, compactRule);
    expect(headings.map((row) => row.course_code)).toEqual(['CS101', 'CS102']);
    const { entries, terminal_found: terminalFound } = boundedEntries(text, compactRule);
    expect(terminalFound).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0].raw_entry_text).toContain('Prerequisite: CS 100.');
    expect(entries[0].raw_entry_text).not.toContain('CS 102 Second Course');
    expect(entries[1].raw_entry_text).not.toContain('Close this window');
  });

  it('restarts after a compact prerequisite run so the overlapping real heading is retained', () => {
    const text = 'Prior body. CS 100 or CS 101 CS 102 Second Course (3 Credits) More.\n\n Close this window';
    expect(scanHeadings(text, compactRule).map((row) => row.course_code)).toEqual(['CS102']);
  });

  it('emits review-only rows and never interprets a missing marker as none', () => {
    const text = 'CS 101 First Course (3 Credits) No requisite label here. CS 102 Second Course (3 Credits) More.\n\n Close this window';
    const hash = require('node:crypto').createHash('sha256').update(text).digest('hex');
    const scope = {
      snapshot_date: '2026-08-23',
      summary: { direct_named_courses: 2, exact_code_tokens_in_cached_official_text: 2 },
      universities: [{
        school_id: 1,
        slug: 'fixture',
        owner_namespace: 'va:uni:1',
        catalog_platform: 'fixture',
        direct_named_course_codes: ['CS101', 'CS102'],
        cached_course_catalog: {
          official_url: 'https://catalog.example.edu/cs',
          declared_normalized_text_sha256: hash,
          retained_normalized_text_sha256: hash,
          byte_match: true,
          exact_code_tokens_seen: ['CS101', 'CS102'],
        },
      }],
    };
    // Supply a rule only within this test by exercising the already-bounded
    // primitive; production construction deliberately refuses unknown owners.
    const entries = boundedEntries(text, compactRule).entries;
    expect(entries[0].raw_entry_text).not.toMatch(/prerequisites?/i);
    expect(entries[0].raw_entry_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(buildUniversityPrerequisiteCandidates({ scope, catalogTexts: { fixture: text } }).summary)
      .toMatchObject({ safely_bounded_review_candidates: 0, publication_contract_rows: 0 });
  });

  it('rejects a missing terminal boundary rather than returning partial entries', () => {
    const result = boundedEntries('CS 101 First Course (3 Credits) Body.', compactRule);
    expect(result).toMatchObject({ entries: [], terminal_found: false });
  });

  it('validates review-only candidate hashes and source offsets', () => {
    const artifact = {
      schema_version: 1,
      artifact: 'virginia_figure6_university_prerequisite_entry_candidates',
      publication_ready: false,
      summary: {
        publication_contract_rows: 0,
        safely_bounded_review_candidates: 0,
        remaining_direct_capture_floor: 0,
      },
      capture_manifest: [],
      candidates: [],
    };
    expect(validateUniversityPrerequisiteCandidates(artifact)).toEqual({ valid: true, issues: [] });
  });

  it('carries exact CNU PDF block evidence into a review-only candidate', () => {
    const raw = 'CPSC 150. Introduction to Programming (3-3-0)\nPre or Corequisite: CPSC 150L';
    const rawHash = require('node:crypto').createHash('sha256').update(raw).digest('hex');
    const scope = {
      snapshot_date: '2026-08-23',
      summary: { direct_named_courses: 1, exact_code_tokens_in_cached_official_text: 1 },
      universities: [{
        school_id: 9206,
        slug: 'christopher-newport-university',
        owner_namespace: 'va:uni:9206',
        catalog_platform: 'pdf',
        catalog_year: '2025-2026',
        direct_named_course_codes: ['CPSC150'],
        cached_course_catalog: {
          official_url: 'https://cnu.edu/catalog.pdf',
          declared_normalized_text_sha256: 'text-hash',
          retained_normalized_text_sha256: 'text-hash',
          byte_match: true,
          exact_code_tokens_seen: ['CPSC150'],
        },
      }],
    };
    const acquisition = { entries: [{
      school_id: 9206,
      slug: 'christopher-newport-university',
      owner_namespace: 'va:uni:9206',
      course_key: 'va:uni:9206:CPSC150',
      course_code: 'CPSC150',
      title: 'Introduction to Programming',
      heading_text: 'CPSC 150. Introduction to Programming (3-3-0)',
      capture_origin: 'retained_official_pdf_bbox',
      boundary_contract: CNU_BOUNDARY_CONTRACT,
      catalog_year_verified: '2025-2026',
      official_url: 'https://cnu.edu/catalog.pdf',
      source_response_sha256: CNU_EXPECTED_PDF_SHA256,
      source_response_bytes: 100,
      cache_path: 'pages/cnu.pdf',
      pdf_sha256: CNU_EXPECTED_PDF_SHA256,
      bbox_layout_sha256: 'a'.repeat(64),
      pdftotext_version: 'pdftotext version 1.0 fixture',
      published_units: { credit_hours_min: 3, credit_hours_max: 3 },
      pdf_page_start: 1,
      pdf_page_end: 1,
      page_column_span: ['1:left'],
      source_blocks: [{
        pdf_page: 1,
        page_block_index: 0,
        column: 'left',
        bbox_points: { x_min: 40, y_min: 100, x_max: 280, y_max: 200 },
        raw_text_sha256: rawHash,
      }],
      raw_entry_text: raw,
      raw_entry_sha256: rawHash,
    }] };
    const artifact = buildUniversityPrerequisiteCandidates({
      scope, catalogTexts: { 'christopher-newport-university': 'interleaved text' }, acquisition,
    });
    expect(artifact.capture_manifest[0]).toMatchObject({
      capture_strategy: 'official_pdf_bbox_nonoverlapping_columns',
      capture_status: 'official_acquisition_boundaries_available',
      bounded_review_candidate_count: 1,
    });
    expect(artifact.candidates[0].source).toMatchObject({
      source_format: 'pdf_bbox_columns',
      pdf_sha256: CNU_EXPECTED_PDF_SHA256,
      source_blocks: [{ column: 'left' }],
    });
    expect(validateUniversityPrerequisiteCandidates(artifact, {
      scope, catalogTexts: { 'christopher-newport-university': 'interleaved text' },
    })).toEqual({ valid: true, issues: [] });
    const tampered = structuredClone(artifact);
    tampered.candidates[0].source.source_blocks[0].bbox_points.x_max = 330;
    expect(validateUniversityPrerequisiteCandidates(tampered, {
      scope, catalogTexts: { 'christopher-newport-university': 'interleaved text' },
    }).issues).toContain('va:uni:9206:CPSC150:cnu_pdf_geometry');
  });

  it('carries exact Shenandoah discovery, entry, and clause receipts fail closed', () => {
    const crypto = require('node:crypto');
    const raw = 'CSC 122 Introduction to Computer Programming II Credit(s): 3 Prerequisite(s): Earned grade of “C-” or better in CSC-121';
    const clauseRaw = 'Earned grade of “C-” or better in CSC-121';
    const rawHash = crypto.createHash('sha256').update(raw).digest('hex');
    const clauseHash = crypto.createHash('sha256').update(clauseRaw).digest('hex');
    const clauseStart = raw.indexOf(clauseRaw);
    const statementStart = raw.indexOf('Prerequisite(s):');
    const scope = {
      snapshot_date: '2026-08-23',
      summary: { direct_named_courses: 1, exact_code_tokens_in_cached_official_text: 0 },
      universities: [{
        school_id: 9224,
        slug: 'shenandoah-university',
        owner_namespace: 'va:uni:9224',
        catalog_platform: 'acalog',
        catalog_year: '2025-2026',
        direct_named_course_codes: ['CSC122'],
        cached_course_catalog: {
          official_url: 'https://catalog.su.edu/content.php?catoid=33&navoid=1985',
          declared_normalized_text_sha256: SHENANDOAH_PROGRAM_HTML_SHA256,
          retained_normalized_text_sha256: SHENANDOAH_PROGRAM_HTML_SHA256,
          byte_match: true,
          exact_code_tokens_seen: [],
        },
      }],
    };
    const acquisition = { entries: [{
      school_id: 9224,
      slug: 'shenandoah-university',
      owner_namespace: 'va:uni:9224',
      course_key: 'va:uni:9224:CSC122',
      course_code: 'CSC122',
      title: 'Introduction to Computer Programming II',
      heading_text: 'CSC 122 Introduction to Computer Programming II',
      capture_origin: 'official_shenandoah_acalog_course_page',
      boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
      catalog_year_verified: '2025-2026',
      official_url: 'https://catalog.su.edu/preview_course_nopop.php?catoid=33&coid=55149',
      source_response_sha256: 'a'.repeat(64),
      source_response_bytes: 1000,
      cache_path: 'university-prerequisites/raw/shenandoah-university/csc122.html',
      catoid: 33,
      coid: 55149,
      published_units: {
        kind: 'published_fixed_credits', notation: 'Credit(s): 3',
        credit_hours_min: 3, credit_hours_max: 3,
      },
      raw_entry_html_sha256: 'b'.repeat(64),
      required_requisite_clause: {
        receipt_contract: SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
        kind: 'prerequisite',
        label: 'Prerequisite(s)',
        raw: clauseRaw,
        raw_sha256: clauseHash,
        relative_start: clauseStart,
        relative_end: clauseStart + clauseRaw.length,
        statement_relative_start: statementStart,
        statement_relative_end: clauseStart + clauseRaw.length,
        raw_html_sha256: clauseHash,
        boundary_terminal: 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker',
      },
      formal_corequisite_marker_count: 0,
      raw_entry_text: raw,
      raw_entry_sha256: rawHash,
      discovery_contract: SHENANDOAH_DISCOVERY_CONTRACT,
      discovery_cache_path: SHENANDOAH_PROGRAM_CACHE_PATH,
      discovery_response_sha256: SHENANDOAH_PROGRAM_HTML_SHA256,
      discovery_link_receipt: {
        course_code: 'CSC122', catoid: 33, coid: 55149,
        title: 'Introduction to Computer Programming II',
      },
      robots_crawl_delay_seconds: 120,
    }] };
    const artifact = buildUniversityPrerequisiteCandidates({
      scope, catalogTexts: { 'shenandoah-university': '' }, acquisition,
    });
    expect(artifact.candidates[0].source).toMatchObject({
      source_format: 'shenandoah_acalog_course_page',
      boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
      catoid: 33,
      coid: 55149,
      formal_corequisite_marker_count: 0,
      discovery_response_sha256: SHENANDOAH_PROGRAM_HTML_SHA256,
    });
    expect(validateUniversityPrerequisiteCandidates(artifact, {
      scope, catalogTexts: { 'shenandoah-university': '' },
    })).toEqual({ valid: true, issues: [] });

    for (const mutate of [
      (row) => { row.source.coid = 1; },
      (row) => { row.source.discovery_response_sha256 = '0'.repeat(64); },
      (row) => { row.source.required_requisite_clause.raw = 'CSC 121'; },
      (row) => { row.source.formal_corequisite_marker_count = -1; },
    ]) {
      const tampered = structuredClone(artifact);
      mutate(tampered.candidates[0]);
      expect(validateUniversityPrerequisiteCandidates(tampered, {
        scope, catalogTexts: { 'shenandoah-university': '' },
      }).valid).toBe(false);
    }
  });
});
