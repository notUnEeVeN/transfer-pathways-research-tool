import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';
import { extractCourseLeafEntries } from './universityPrerequisiteAcquisition';
import {
  BLOCKED_CODES,
  BLOCKER_PAGES,
  CACHE_REACQUIRE_CODES,
  CLOSURE_CODES,
  CYSE_PAGE,
  FORMULA_ROWS,
  OUTSIDE_CODES,
  OWNER,
  PAGES,
  ROWS,
  blockedOutsideReferenceAudit,
  cachedCyseResolution,
  closureResolution,
  closureReviewRowIssues,
  expectedCompleteEntryReceipt,
  outsideFormulaIssues,
  pageFileIssues,
  pageReceipt,
  rowReceipt,
  sha256,
} from './georgeMasonPrerequisiteClosureAudit';

const ROOT = path.resolve(__dirname, '../..');

function readPage(tuple) {
  const page = pageReceipt(tuple);
  const absolute = path.join(ROOT, '.va-catalogs', page.cache_path);
  return {
    bytes: fs.readFileSync(absolute),
    metadata: JSON.parse(fs.readFileSync(absolute.replace(/\.html$/, '.json'), 'utf8')),
  };
}

function gmuClosureRows() {
  return reviewArtifact.closure_review_rows.filter((row) => (
    row.owner_namespace === OWNER && CLOSURE_CODES.includes(row.code)
  ));
}

describe('standalone George Mason recursive prerequisite closure audit', () => {
  it('pins the exact 40-row closure inventory and all complete source pages', () => {
    expect(CLOSURE_CODES).toEqual([
      'ARAB325', 'ARAB365', 'BUS210', 'CDS130', 'CHIN310', 'CHIN311',
      'CHIN325', 'CHIN328', 'CLAS250', 'CLAS260', 'CLAS340', 'CLAS350',
      'CLAS360', 'CLAS380', 'CS105', 'ELED258', 'ENGH122', 'ENGH123',
      'ENGH201', 'ENGH202', 'ENGH203', 'ENGH204', 'ENGH206', 'FREN325',
      'FREN329', 'FRLN330', 'GERM325', 'HIST403', 'HNRS310', 'INTS101',
      'ITAL320', 'ITAL325', 'JAPA340', 'KORE311', 'RELI338', 'RUSS325',
      'RUSS326', 'SPAN325', 'STAT250', 'SYST130',
    ]);
    expect(gmuClosureRows()).toHaveLength(40);

    for (const [pageId, tuple] of Object.entries(PAGES)) {
      const pageCodes = CLOSURE_CODES.filter((code) => ROWS[code][0] === pageId);
      const { bytes, metadata } = readPage(tuple);
      expect(pageFileIssues(tuple, bytes, metadata)).toEqual([]);
      const page = pageReceipt(tuple);
      const extracted = extractCourseLeafEntries(bytes, pageCodes);
      expect(extracted).toMatchObject({
        missing: [],
        ambiguous: [],
        courseblock_count: page.source_courseblock_count,
        complete_entry_count: page.source_complete_entry_count,
        complete_entries_with_required_requisite_marker_count:
          page.source_positive_control_count,
      });
      for (const code of pageCodes) {
        const fixed = rowReceipt(ROWS[code]);
        expect(extracted.entries.find((entry) => entry.course_code === code)).toMatchObject({
          courseblock_index: fixed.courseblock_index,
          raw_entry_sha256: fixed.raw_entry_sha256,
          raw_entry_html_sha256: fixed.raw_entry_html_sha256,
          published_units: fixed.published_units,
          complete_entry_receipt: expectedCompleteEntryReceipt(page, fixed),
          structured_requisite_fields: [],
        });
      }
    }
  });

  it('resolves all 40 only in the required prerequisite/corequisite dimension', () => {
    let signalCount = 0;
    const kinds = new Set();
    for (const reviewRow of gmuClosureRows()) {
      expect(closureReviewRowIssues(reviewRow)).toEqual([]);
      const result = closureResolution(reviewRow);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        issues: [],
        status: 'none',
        raw_requisites: null,
        groups: [],
        structural_none_evidence: {
          literal_none_statement: false,
          finding: 'no_required_prerequisite_or_corequisite_label_in_complete_entry',
          content_accounting: {
            every_reviewed_nonrequired_signal_marker_accounted_for: true,
            source_content_discarded: false,
          },
        },
      });
      signalCount += result.ignored_nonrequired_requisites.length;
      for (const signal of result.ignored_nonrequired_requisites) {
        kinds.add(signal.kind);
        expect(signal.required_prerequisite_graph_edge_emitted).toBe(false);
        expect(reviewRow.source_evidence.raw_text.slice(
          signal.relative_start, signal.relative_end,
        )).toBe(signal.raw);
        expect(sha256(signal.raw)).toBe(signal.raw_sha256);
      }
    }
    // Sum the independently pinned per-entry counts as well as asserting the
    // fixed total, so a missing row and a changed extractor cannot cancel out.
    const fixedSignalCount = Object.values(ROWS).reduce((total, row) => total + row[7], 0);
    expect(fixedSignalCount).toBe(112);
    expect(signalCount).toBe(fixedSignalCount);
    expect(kinds).toEqual(new Set([
      'anti_credit',
      'attempt_approval',
      'attempt_limit',
      'background_note',
      'background_recommendation',
      'degree_grade',
      'equivalence',
      'recommended_prerequisite',
      'registration_restrictions',
      'repeat_restriction',
    ]));
  });

  it('safely reacquires exactly CYSE 101 and CYSE 130 from the valid cached page', () => {
    expect(CACHE_REACQUIRE_CODES).toEqual(['CYSE101', 'CYSE130']);
    const { bytes, metadata } = readPage(CYSE_PAGE);
    expect(metadata).toMatchObject({
      http_status: 200,
      capture_status: 'blocked_fail_closed',
      blocked_reason: 'response_failed_status_content_type_or_interstitial_check',
    });
    let signalCount = 0;
    for (const code of CACHE_REACQUIRE_CODES) {
      const result = cachedCyseResolution(code, bytes, metadata);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        issues: [],
        status: 'none',
        groups: [],
        structural_none_evidence: {
          kind: 'safe_cache_only_courseleaf_reacquisition',
          network_request_used: false,
          prior_capture_disposition_revalidated: 'blocked_fail_closed',
        },
      });
      signalCount += result.ignored_nonrequired_requisites.length;
    }
    expect(signalCount).toBe(6);
  });

  it('keeps all 17 unsupported references blocked instead of inferring aliases or none', () => {
    expect(OUTSIDE_CODES).toHaveLength(19);
    expect(BLOCKED_CODES).toHaveLength(17);
    expect(BLOCKED_CODES).not.toContain('CYSE101');
    expect(BLOCKED_CODES).not.toContain('CYSE130');
    const counts = {};
    for (const tuple of Object.values(BLOCKER_PAGES)) {
      const { bytes, metadata } = readPage(tuple);
      for (const code of tuple[7]) {
        const result = blockedOutsideReferenceAudit(code, bytes, metadata);
        expect(result).toMatchObject({
          applicable: true,
          verified: true,
          issues: [],
          status: 'blocked',
          inference_boundary: expect.stringContaining('does not prove'),
        });
        counts[result.blocker_reason] = (counts[result.blocker_reason] || 0) + 1;
      }
    }
    expect(counts).toEqual({
      exact_current_subject_page_absence: 11,
      official_subject_route_http_404: 6,
    });
  });

  it('pins every outside reference inside its exact parsed Boolean formula', () => {
    expect(Object.keys(FORMULA_ROWS)).toHaveLength(19);
    expect(outsideFormulaIssues(reviewArtifact)).toEqual([]);
  });

  it('fails closed on source, signal, cache, and Boolean-formula tampering', () => {
    const closureRow = structuredClone(gmuClosureRows().find((row) => row.code === 'CS105'));
    closureRow.review_evidence.raw_entry_text = closureRow.review_evidence.raw_entry_text
      .replace('should not register', 'must register');
    closureRow.review_evidence.raw_entry_sha256 = sha256(
      closureRow.review_evidence.raw_entry_text,
    );
    closureRow.review_evidence.entry_character_end =
      closureRow.review_evidence.raw_entry_text.length;
    expect(closureResolution(closureRow)).toMatchObject({
      applicable: true,
      ready: false,
      issues: expect.arrayContaining(['raw_entry', 'nonrequired_signal_digest']),
    });

    const cyse = readPage(CYSE_PAGE);
    const changedCyse = Buffer.from(cyse.bytes);
    changedCyse[100] ^= 1;
    expect(cachedCyseResolution('CYSE101', changedCyse, cyse.metadata)).toMatchObject({
      applicable: true,
      ready: false,
      issues: expect.arrayContaining(['source_response_sha256']),
    });

    const formulaReview = structuredClone(reviewArtifact);
    const syst210 = formulaReview.closure_review_rows.find((row) => (
      row.owner_namespace === OWNER && row.code === 'SYST210'
    ));
    syst210.groups[0].paths.pop();
    expect(outsideFormulaIssues(formulaReview)).toEqual(expect.arrayContaining([
      'SYST210:formula_hash',
      'SYST210:formula_shape',
    ]));
  });
});
