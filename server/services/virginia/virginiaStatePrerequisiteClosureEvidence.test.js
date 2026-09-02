import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import evidenceArtifact from '../../.va-catalogs/research/virginia-state-prerequisite-closure-evidence.json';
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
  DECISIONS,
  OWNER,
  REVIEW_REASON,
  TARGET_CODES,
  artifactIssues,
  candidateIssues,
  resolutionRowIssues,
  resolveVirginiaStatePrerequisiteClosure,
  sha256,
} from './virginiaStatePrerequisiteClosureEvidence';
import {
  renderArtifact,
} from '../../scripts/va/buildVirginiaStatePrerequisiteClosureEvidence';

const ROOT = path.resolve(__dirname, '../..');
const candidateByCode = new Map(candidatesArtifact.candidates.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.course_code)
)).map((row) => [row.course_code, row]));
const reviewByCode = new Map(reviewArtifact.review_rows.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.code)
)).map((row) => [row.code, row]));

function resolve(code, candidate = candidateByCode.get(code), artifact = evidenceArtifact) {
  return resolveVirginiaStatePrerequisiteClosure(
    candidate,
    extractRequiredClauses(candidate).clauses,
    artifact,
  );
}

describe('Virginia State exact prerequisite closure evidence', () => {
  it('replays the complete retained official pages, edition markers, and target courseblocks', () => {
    expect(artifactIssues(evidenceArtifact)).toEqual([]);
    expect(evidenceArtifact.summary).toMatchObject({
      exact_target_rows: 27,
      source_proven_parsed_rows: 7,
      source_proven_structural_none_rows: 19,
      blocked_rows: 1,
      retained_source_pages: 15,
      dropped_source_signals: 0,
      inferred_course_aliases: 0,
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
          url: 'https://catalog.vsu.edu/robots.txt',
          http_status: 200,
          content_sha256:
            '8ba3a5e25335b7e343ff1331a044873101011acdafde82726af28c9a9a02b365',
        },
      });
      const $ = cheerio.load(html);
      expect($('.site-title a').text().replace(/\s+/g, ' ').trim())
        .toBe('2026-2027 Academic Catalog Homepage');
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
          });
      }
    }
  });

  it('uses an exact same-catalog positive control when a target subject page is silent', () => {
    const control = evidenceArtifact.facts.same_catalog_positive_control;
    expect(control).toMatchObject({
      catalog_year: '2026-2027',
      owner_namespace: OWNER,
      course_code: 'CSCI281',
      formal_required_prerequisite_marker_count: 1,
      target_pages_using_cross_page_same_catalog_control: [
        'dram', 'geog', 'glst', 'hper',
      ],
    });
    expect(control.target_pages_with_same_response_positive_control).toHaveLength(11);
    expect(control.raw_entry_text).toContain(
      'Prerequisite: MATH 280 Discrete Mathematics for Computer Science.',
    );
    expect(sha256(control.raw_entry_text)).toBe(control.raw_entry_sha256);
  });

  it('promotes 25 direct rows and CHEM 105 without erasing corequisites or conditions', () => {
    expect(candidateByCode.size).toBe(27);
    expect(TARGET_CODES.filter((code) => code !== 'CHEM105')).toHaveLength(26);
    const parsedCodes = [];
    const noneCodes = [];
    let ignoredCount = 0;
    let internalCount = 0;
    for (const code of TARGET_CODES.filter((value) => value !== 'PHYS112')) {
      const result = resolve(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        issues: [],
        review_reason: REVIEW_REASON,
        proof: {
          content_accounting: {
            full_entry_retained_as_source_evidence: true,
            every_reviewed_corequisite_and_noncourse_signal_preserved: true,
            source_content_discarded: false,
          },
        },
      });
      if (result.status === 'parsed') parsedCodes.push(code);
      else noneCodes.push(code);
      ignoredCount += result.ignored_nonrequired_requisites.length;
      internalCount += result.internal_component_corequisites.length;
      for (const signal of [
        ...result.ignored_nonrequired_requisites,
        ...result.internal_component_corequisites,
      ]) {
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
    expect(parsedCodes).toEqual([
      'CHEM153', 'CHEM163', 'CSCI150', 'CSCI151',
      'FREN110', 'MATH130', 'SPAN110',
    ]);
    expect(noneCodes).toHaveLength(19);
    expect(ignoredCount).toBe(11);
    expect(internalCount).toBe(6);
  });

  it('retains exact distinct-course corequisite topology and non-course restrictions', () => {
    expect(resolve('CHEM153').groups[0].paths[0].all_of).toEqual([{
      type: 'course', code: 'CHEM151', raw: 'CHEM 151 General Chemistry I',
      course_key: `${OWNER}:CHEM151`,
    }]);
    expect(resolve('CSCI150').groups[0].paths[0].all_of.map((row) => row.code))
      .toEqual(['CSCI101', 'CSCI151']);
    expect(resolve('CSCI151').groups[0].paths[0].all_of.map((row) => row.code))
      .toEqual(['CSCI101', 'CSCI150']);
    expect(resolve('FREN110').groups[0].paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'no_admission_credit_in_french',
      admission_credit_allowed: false,
    });
    expect(resolve('MATH130').groups[0].paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'prek_3_or_prek_6_teacher_certification_student',
      eligible_certification_levels: ['PreK-3', 'PreK-6'],
    });
    expect(resolve('SPAN110').groups[0].paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'no_admission_credit_in_spanish',
      admission_credit_allowed: false,
    });
  });

  it('keeps PHYS 112 blocked rather than inventing a MATH 200 to MATH 260 alias', () => {
    const result = resolve('PHYS112');
    expect(result).toMatchObject({
      applicable: true,
      ready: false,
      blocked: true,
      issues: [],
      review_reason: BLOCKED_REVIEW_REASON,
      blocker_evidence: {
        disposition: 'blocked_conflicting_current_catalog_reference',
        referenced_course_code: 'MATH200',
        current_catalog_nearby_code: 'MATH260',
        current_math_subject_exact_entry_count_for_math200: 0,
        current_math_subject_exact_entry_count_for_math260: 1,
        alias_inferred: false,
        content_accounting: {
          complete_corequisite_clauses_preserved: true,
          source_content_discarded: false,
        },
      },
    });
    expect(result.preserved_corequisite_clauses).toHaveLength(2);
    expect(result.internal_component_corequisites).toHaveLength(1);
    expect(reviewByCode.get('PHYS112')).toMatchObject({
      status: 'unparsed',
      review_status: 'not_promoted',
      review_reason: BLOCKED_REVIEW_REASON,
      virginia_state_prerequisite_blocker: result.blocker_evidence,
    });
    expect(resolutionRowIssues(reviewByCode.get('PHYS112'))).toEqual([]);
  });

  it.each([
    ['response hash', (candidate) => { candidate.source.source_response_sha256 = '0'.repeat(64); }],
    ['entry boundary', (candidate) => { candidate.source.courseblock_index += 1; }],
    ['entry HTML', (candidate) => { candidate.source.raw_entry_html_sha256 = '0'.repeat(64); }],
    ['corequisite text', (candidate) => {
      candidate.source.raw_entry_text = candidate.source.raw_entry_text.replace(
        'CHEM 151 General Chemistry I', 'CHEM 152 General Chemistry I',
      );
      candidate.source.raw_entry_sha256 = sha256(candidate.source.raw_entry_text);
      candidate.source.character_end = candidate.source.raw_entry_text.length;
    }],
  ])('fails closed when the exact %s changes', (label, mutate) => {
    const candidate = structuredClone(candidateByCode.get('CHEM153'));
    mutate(candidate);
    const clauses = extractRequiredClauses(candidate).clauses;
    expect(candidateIssues(candidate, clauses, evidenceArtifact).length).toBeGreaterThan(0);
    expect(resolveVirginiaStatePrerequisiteClosure(candidate, clauses, evidenceArtifact))
      .toMatchObject({ applicable: true, ready: false });
  });

  it('rejects artifact and publication-row tampering', () => {
    const artifact = structuredClone(evidenceArtifact);
    artifact.facts.target_rows[0].raw_entry_sha256 = '0'.repeat(64);
    expect(artifactIssues(artifact)).toContain('facts_sha256_replay');

    const internalDropped = structuredClone(reviewByCode.get('BIOL120'));
    internalDropped.internal_component_corequisites.pop();
    expect(resolutionRowIssues(internalDropped)).toContain('internal_components');

    const conditionChanged = structuredClone(reviewByCode.get('MATH130'));
    conditionChanged.groups[0].paths[0].all_of[0].condition = 'generic_teacher';
    expect(resolutionRowIssues(conditionChanged)).toContain('review_status');

    const blockerAlias = structuredClone(reviewByCode.get('PHYS112'));
    blockerAlias.virginia_state_prerequisite_blocker.alias_inferred = true;
    expect(resolutionRowIssues(blockerAlias)).toContain('blocked_review_status');
  });
});
