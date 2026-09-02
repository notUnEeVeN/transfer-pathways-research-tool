import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import evidenceArtifact from '../../.va-catalogs/research/norfolk-state-prerequisite-closure-evidence.json';
import reviewArtifact from '../../.va-catalogs/research/va-university-prerequisite-review.json';
import {
  extractCourseLeafEntries,
} from './universityPrerequisiteAcquisition';
import {
  extractRequiredClauses,
  reviewCandidate,
} from './universityPrerequisiteReview';
import {
  BLOCKED_REVIEW_REASON,
  CLOSURE_CODES,
  DECISIONS,
  DIRECT_REMEDIATION_CODES,
  MISSING_CLOSURE_CODES,
  OWNER,
  REVIEW_REASON,
  TARGET_CODES,
  artifactIssues,
  candidateIssues,
  resolutionRowIssues,
  resolveNorfolkStatePrerequisiteClosure,
  sha256,
} from './norfolkStatePrerequisiteClosureEvidence';
import {
  renderArtifact,
} from '../../scripts/va/buildNorfolkStatePrerequisiteClosureEvidence';

const ROOT = path.resolve(__dirname, '../..');
const candidateByCode = new Map(candidatesArtifact.candidates.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.course_code)
)).map((row) => [row.course_code, row]));
const reviewByCode = new Map(reviewArtifact.review_rows.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.code)
)).map((row) => [row.code, row]));

function resolve(code, candidate = candidateByCode.get(code), artifact = evidenceArtifact) {
  return resolveNorfolkStatePrerequisiteClosure(
    candidate,
    extractRequiredClauses(candidate).clauses,
    artifact,
  );
}

describe('Norfolk State exact prerequisite closure evidence', () => {
  it('replays every complete retained official page, edition marker, and target entry', () => {
    expect(artifactIssues(evidenceArtifact)).toEqual([]);
    expect(evidenceArtifact.summary).toEqual({
      exact_target_rows: 19,
      exact_direct_remediation_rows: 12,
      exact_recursive_closure_rows: 7,
      source_proven_parsed_rows: 2,
      source_proven_structural_none_rows: 16,
      blocked_rows: 1,
      publication_blocker_rows: 6,
      retained_source_pages: 10,
      retained_missing_subject_pages: 1,
      unresolved_owner_local_reference_rows: 5,
      bounded_absent_complete_entry_rows: 5,
      unresolved_subject_page_404_rows: 1,
      preserved_reviewed_signals: 13,
      dropped_source_signals: 0,
      inferred_course_aliases_or_sequence_directions: 0,
    });
    expect(renderArtifact()).toBe(`${JSON.stringify(evidenceArtifact, null, 2)}\n`);

    for (const page of evidenceArtifact.facts.source_pages) {
      const html = fs.readFileSync(path.join(ROOT, '.va-catalogs', page.cache_path));
      const metadata = JSON.parse(fs.readFileSync(
        path.join(ROOT, '.va-catalogs', page.metadata_cache_path), 'utf8',
      ));
      expect(sha256(html)).toBe(page.source_response_sha256);
      expect(html.length).toBe(page.source_response_bytes);
      expect(metadata).toMatchObject({
        requested_url: page.official_url,
        final_url: page.official_url,
        http_status: 200,
        byte_length: page.source_response_bytes,
        content_sha256: page.source_response_sha256,
        robots: {
          url: 'https://catalog.nsu.edu/robots.txt',
          http_status: 200,
          content_sha256:
            '9ea34488a311795f8883efe1bb0a049a093184e738d9c89d8086b427754ef768',
        },
      });
      const $ = cheerio.load(html);
      expect($('#edition').text().replace(/\s+/g, ' ').trim())
        .toBe('2025-2026 Academic Catalog');
      expect($('title').text().replace(/\s+/g, ' ').trim())
        .toBe(page.document_title);
      const pageRows = evidenceArtifact.facts.target_rows.filter((row) => (
        row.page_id === page.page_id
      ));
      const extracted = extractCourseLeafEntries(
        html, pageRows.map((row) => row.course_code),
      );
      expect(extracted).toMatchObject({
        missing: [],
        ambiguous: [],
        courseblock_count: page.source_courseblock_count,
        complete_entry_count: page.source_complete_entry_count,
        complete_entries_with_required_requisite_marker_count:
          page.source_complete_entries_with_required_requisite_marker_count,
      });
      for (const expected of pageRows) {
        expect(extracted.entries.find((row) => row.course_code === expected.course_code))
          .toMatchObject({
            courseblock_index: expected.courseblock_index,
            raw_entry_sha256: expected.raw_entry_sha256,
            raw_entry_html_sha256: expected.raw_entry_html_sha256,
            published_units: expected.published_units,
            complete_entry_receipt: expected.complete_entry_receipt,
            structured_requisite_fields: expected.structured_requisite_fields,
          });
      }
    }
  });

  it('enumerates every owner-local missing closure reference and never turns absence into none', () => {
    const audit = evidenceArtifact.facts.recursive_reference_inventory;
    expect(audit).toMatchObject({
      exact_owner_candidate_rows: 88,
      exact_named_required_reference_code_count: 29,
      additional_source_bound_narrative_reference_codes: ['CSC260'],
      additional_source_bound_narrative_references_all_published: true,
      missing_candidate_reference_codes: [
        'CSC195', 'CSC311', 'EEN470', 'ENGG101H', 'MTH101',
      ],
    });
    expect(evidenceArtifact.facts.missing_closure_references.map((row) => (
      row.course_code
    ))).toEqual(MISSING_CLOSURE_CODES);

    for (const gap of evidenceArtifact.facts.missing_closure_references) {
      expect(gap).toMatchObject({
        course_key: `${OWNER}:${gap.course_code}`,
        scope_role: 'recursive_closure_reference_without_published_entry',
        disposition: 'blocked_missing_current_official_course_entry',
        absence_receipt: {
          catalog_year: '2025-2026',
          http_status: 200,
          matching_complete_entry_count: 0,
        },
        incoming_prerequisite_formula_inferred: false,
        course_alias_inferred: false,
      });
      const html = fs.readFileSync(path.join(
        ROOT, '.va-catalogs', gap.absence_receipt.cache_path,
      ));
      const extracted = extractCourseLeafEntries(html, [gap.course_code]);
      expect(extracted).toMatchObject({
        entries: [],
        ambiguous: [],
        missing: [gap.course_code],
        courseblock_count: gap.absence_receipt.source_courseblock_count,
        complete_entry_count: gap.absence_receipt.source_complete_entry_count,
      });
      for (const referrer of gap.exact_referrer_entries) {
        expect(referrer.matched_required_prerequisite_field.kind).toBe('prerequisite');
        expect(referrer.matched_required_prerequisite_field.raw)
          .toContain(gap.course_code.replace(/^(\D+)(\d)/, '$1-$2'));
      }
    }

    const engg = evidenceArtifact.facts.missing_closure_references.find((row) => (
      row.course_code === 'ENGG101H'
    ));
    expect(engg).toMatchObject({
      expected_subject_page_receipt: {
        page_id: 'engg',
        http_status: 404,
        catalog_label: '2025-2026 Academic Catalog',
        page_heading: 'Page Not Found',
        source_courseblock_count: 0,
      },
      distinct_published_near_match: {
        course_code: 'ENG101H',
        course_key: `${OWNER}:ENG101H`,
      },
      course_alias_inferred: false,
    });
    expect(evidenceArtifact.publication_blockers.map((row) => row.course_key))
      .toEqual([
        `${OWNER}:CHM221L`,
        ...MISSING_CLOSURE_CODES.map((code) => `${OWNER}:${code}`),
      ]);
    expect(reviewArtifact.closure.unresolved_outside_direct_scope.filter((key) => (
      key.startsWith(`${OWNER}:`)
    ))).toEqual(MISSING_CLOSURE_CODES.map((code) => `${OWNER}:${code}`));
  });

  it('uses an exact same-catalog formal prerequisite control for silent subject pages', () => {
    const control = evidenceArtifact.facts.same_catalog_positive_control;
    expect(control).toMatchObject({
      catalog_year: '2025-2026',
      owner_namespace: OWNER,
      same_catalog_positive_control: true,
      course_code: 'CSC170',
      formal_required_prerequisite_marker_count: 1,
      target_pages_using_cross_page_same_catalog_control: ['ecn', 'hrp', 'sem'],
    });
    expect(control.raw_entry_text).toContain(
      'Prerequisites: Take MTH-151. Take CSC-169.',
    );
    expect(sha256(control.raw_entry_text)).toBe(control.raw_entry_sha256);
    expect(control.structured_requisite_fields).toHaveLength(1);
  });

  it('promotes eleven direct silences and all seven closure rows without dropping prose', () => {
    expect(candidateByCode.size).toBe(19);
    expect(DIRECT_REMEDIATION_CODES).toHaveLength(12);
    expect(CLOSURE_CODES).toHaveLength(7);
    const safeCodes = TARGET_CODES.filter((code) => code !== 'CHM221L');
    const parsedCodes = [];
    const noneCodes = [];
    let signalCount = 0;
    for (const code of safeCodes) {
      const result = resolve(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        blocked: false,
        issues: [],
        review_reason: REVIEW_REASON,
        proof: {
          content_accounting: {
            full_entry_retained_as_source_evidence: true,
            every_reviewed_non_prerequisite_signal_preserved: true,
            source_content_discarded: false,
          },
        },
      });
      if (result.status === 'parsed') parsedCodes.push(code);
      else noneCodes.push(code);
      signalCount += result.ignored_nonrequired_requisites.length;
      for (const signal of result.ignored_nonrequired_requisites) {
        const source = candidateByCode.get(code).source.raw_entry_text;
        expect(source.slice(signal.relative_start, signal.relative_end)).toBe(signal.raw);
        expect(sha256(signal.raw)).toBe(signal.raw_sha256);
        expect(signal.required_prerequisite_graph_edge_emitted).toBe(false);
        expect(signal.source_content_preserved).toBe(true);
      }
      expect(reviewCandidate(candidateByCode.get(code))).toMatchObject({
        status: result.status,
        review_status: result.review_status,
        review_reason: REVIEW_REASON,
      });
      expect(resolutionRowIssues(reviewByCode.get(code))).toEqual([]);
    }
    expect(parsedCodes).toEqual(['MTH105', 'MTH151']);
    expect(noneCodes).toHaveLength(16);
    expect(signalCount).toBe(12);
  });

  it('retains the two exact closure formulas and their AND semantics', () => {
    expect(resolve('MTH105').groups[0].paths[0].all_of).toEqual([{
      type: 'course', code: 'MTH101', raw: 'Take MTH-101.',
      course_key: `${OWNER}:MTH101`,
    }]);
    expect(resolve('MTH151').groups[0].paths[0].all_of.map((row) => row.code))
      .toEqual(['MTH105', 'MTH102']);
    expect(resolve('MTH151').raw_requisites)
      .toBe('Prerequisites: Take MTH-105. Take MTH-102.');
  });

  it('keeps CHM 221L blocked rather than inventing a sequence edge', () => {
    const result = resolve('CHM221L');
    expect(result).toMatchObject({
      applicable: true,
      ready: false,
      blocked: true,
      issues: [],
      review_reason: BLOCKED_REVIEW_REASON,
      preserved_sequence_signals: [{
        kind: 'unnamed_sequence_requirement',
        raw: 'Must be taken in sequence.',
        incoming_prerequisite_effect: 'unresolved',
        named_course_codes: [],
        sequence_direction: null,
        required_prerequisite_graph_edge_emitted: false,
      }],
      blocker_evidence: {
        disposition: 'blocked_unnamed_sequence_requirement',
        named_course_code_count: 0,
        sequence_direction: null,
        course_alias_or_direction_inferred: false,
        content_accounting: {
          sequence_statement_preserved: true,
          source_content_discarded: false,
        },
      },
    });
    expect(reviewByCode.get('CHM221L')).toMatchObject({
      status: 'unparsed',
      review_status: 'not_promoted',
      review_reason: BLOCKED_REVIEW_REASON,
      prerequisite_constraint_blocker_evidence: result.blocker_evidence,
    });
    expect(resolutionRowIssues(reviewByCode.get('CHM221L'))).toEqual([]);
  });

  it.each([
    ['response hash', (candidate) => { candidate.source.source_response_sha256 = '0'.repeat(64); }],
    ['entry boundary', (candidate) => { candidate.source.courseblock_index += 1; }],
    ['entry HTML', (candidate) => { candidate.source.raw_entry_html_sha256 = '0'.repeat(64); }],
    ['accounted prose', (candidate) => {
      candidate.source.raw_entry_text = candidate.source.raw_entry_text.replace(
        'required academic course', 'recommended academic course',
      );
      candidate.source.raw_entry_sha256 = sha256(candidate.source.raw_entry_text);
      candidate.source.character_end = candidate.source.raw_entry_text.length;
    }],
  ])('fails closed when the exact %s changes', (label, mutate) => {
    const candidate = structuredClone(candidateByCode.get('SEM101'));
    mutate(candidate);
    const clauses = extractRequiredClauses(candidate).clauses;
    expect(candidateIssues(candidate, clauses, evidenceArtifact).length).toBeGreaterThan(0);
    expect(resolveNorfolkStatePrerequisiteClosure(candidate, clauses, evidenceArtifact))
      .toMatchObject({ applicable: true, ready: false });
  });

  it('rejects artifact, formula, signal, and blocker tampering', () => {
    const artifact = structuredClone(evidenceArtifact);
    artifact.facts.target_rows[0].raw_entry_sha256 = '0'.repeat(64);
    expect(artifactIssues(artifact)).toContain('facts_sha256_replay');

    const formula = structuredClone(reviewByCode.get('MTH151'));
    formula.groups[0].paths[0].all_of.pop();
    expect(resolutionRowIssues(formula)).toContain('review_status');

    const signal = structuredClone(reviewByCode.get('SEM101'));
    signal.ignored_nonrequired_requisites.pop();
    expect(resolutionRowIssues(signal)).toContain('nonrequired_signals');

    const blocker = structuredClone(reviewByCode.get('CHM221L'));
    blocker.prerequisite_constraint_blocker_evidence.course_alias_or_direction_inferred = true;
    expect(resolutionRowIssues(blocker)).toContain('blocked_review_status');
  });
});
