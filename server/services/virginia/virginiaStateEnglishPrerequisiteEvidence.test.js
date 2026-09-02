import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import {
  extractCourseLeafEntries,
} from './universityPrerequisiteAcquisition';
import { extractRequiredClauses, reviewCandidate } from './universityPrerequisiteReview';
import {
  COURSE_CACHE_PATH,
  COURSE_RESPONSE_SHA256,
  DEGREE_SCOPE_RECEIPT,
  SIBLING_CONTEXT,
  TARGET_CODES,
  TARGET_RECEIPTS,
  projectionRowIssues,
  resolveVirginiaStateEnglishPrerequisite,
  runtimeDegreeScopeIssues,
  sha256,
} from './virginiaStateEnglishPrerequisiteEvidence';

const ROOT = path.resolve(__dirname, '../..');
const candidates = candidatesArtifact.candidates.filter((candidate) => (
  candidate.school_id === 9231 && TARGET_CODES.includes(candidate.course_code)
));

function resolution(candidate) {
  return resolveVirginiaStateEnglishPrerequisite(
    candidate,
    extractRequiredClauses(candidate).clauses,
  );
}

function projectedRow(candidate) {
  const resolved = resolution(candidate);
  return {
    school_id: candidate.school_id,
    slug: candidate.slug,
    owner_namespace: candidate.owner_namespace,
    course_key: candidate.course_key,
    code: candidate.course_code,
    source: 'institution_catalog',
    catalog_year: candidate.source.catalog_year_verified,
    source_url: candidate.source.official_url,
    source_bundle_hash: 'a'.repeat(64),
    source_content_sha256: candidate.source.raw_entry_sha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: candidate.source.raw_entry_text,
      content_sha256: candidate.source.raw_entry_sha256,
    },
    review_evidence: {},
    ignored_nonrequired_requisites: [],
    status: 'parsed',
    raw_requisites: `Prerequisites: ${TARGET_RECEIPTS[candidate.course_code].raw_clause}`,
    groups: structuredClone(resolved.groups),
    review_status: 'promoted_strict_formula',
    review_reason: resolved.review_reason,
    explicit_none_group_kinds: [],
    vsu_english_cs_scope_projection: structuredClone(resolved.projection),
  };
}

function exactDegreeProof() {
  return {
    supported: true,
    proof: {
      proof_tree_sha256: DEGREE_SCOPE_RECEIPT.accepted_degree_proof_tree_sha256[0],
      source_bundle_sha256: DEGREE_SCOPE_RECEIPT.accepted_source_bundle_sha256[0],
      official_source_sha256: {
        major: DEGREE_SCOPE_RECEIPT.major_source.text_sha256,
        general_education: DEGREE_SCOPE_RECEIPT.general_education_source.text_sha256,
      },
    },
  };
}

describe('exact VSU English prerequisite evidence for the Computer Science scope', () => {
  it('binds the retained official page, same-catalog sibling grammar, and degree scope', () => {
    const courseFile = path.join(ROOT, '.va-catalogs', COURSE_CACHE_PATH);
    const courseHtml = fs.readFileSync(courseFile);
    expect(sha256(courseHtml)).toBe(COURSE_RESPONSE_SHA256);
    const siblingCodes = SIBLING_CONTEXT.map((row) => row.course_code);
    const extracted = extractCourseLeafEntries(
      courseHtml, [...siblingCodes, ...TARGET_CODES],
    );
    expect(extracted.missing).toEqual([]);
    expect(extracted.ambiguous).toEqual([]);
    for (const receipt of SIBLING_CONTEXT) {
      const row = extracted.entries.find((entry) => entry.course_code === receipt.course_code);
      expect(row).toMatchObject({
        courseblock_index: receipt.courseblock_index,
        raw_entry_sha256: receipt.raw_entry_sha256,
      });
      expect(row.raw_entry_text).toContain(receipt.exact_statement);
    }
    for (const code of TARGET_CODES) {
      const row = extracted.entries.find((entry) => entry.course_code === code);
      const receipt = TARGET_RECEIPTS[code];
      expect(row).toMatchObject({
        courseblock_index: receipt.courseblock_index,
        raw_entry_sha256: receipt.raw_entry_sha256,
        raw_entry_html_sha256: receipt.raw_entry_html_sha256,
      });
      expect(row.raw_entry_text.slice(receipt.clause_start)).toBe(receipt.raw_clause);
    }

    for (const receipt of [
      DEGREE_SCOPE_RECEIPT.major_source,
      DEGREE_SCOPE_RECEIPT.general_education_source,
    ]) {
      const source = fs.readFileSync(path.join(ROOT, '.va-catalogs', receipt.cache_path));
      expect(sha256(source)).toBe(receipt.text_sha256);
    }
    const program = fs.readFileSync(
      path.join(ROOT, '.va-catalogs', DEGREE_SCOPE_RECEIPT.major_source.cache_path),
      'utf8',
    ).replace(/\s+/g, ' ');
    const ge = fs.readFileSync(
      path.join(ROOT, '.va-catalogs', DEGREE_SCOPE_RECEIPT.general_education_source.cache_path),
      'utf8',
    ).replace(/\s+/g, ' ');
    expect(program).toContain('GE Literature 3');
    expect(program).toContain('CSCI 101 Intro the Cmptr Sci Profession');
    expect(program).toContain('Core Requirements54');
    for (const code of TARGET_CODES) {
      const spaced = code.replace(/^ENGL/, 'ENGL ');
      expect(ge).toContain(spaced);
    }
  });

  it('projects all six exact rows without deleting or universalizing ENGL 203', () => {
    expect(candidates.map((candidate) => candidate.course_code).sort())
      .toEqual([...TARGET_CODES].sort());
    for (const candidate of candidates) {
      const resolved = resolution(candidate);
      expect(resolved).toMatchObject({
        applicable: true,
        ready: true,
        code: candidate.course_code,
        issues: [],
        review_reason: 'exact_vsu_cs_scope_english_major_conditional_projection',
      });
      expect(resolved.groups).toHaveLength(1);
      expect(resolved.groups[0].paths).toHaveLength(4);
      const paths = resolved.groups[0].paths.map((formulaPath) => (
        formulaPath.all_of.map((condition) => condition.code)
      ));
      expect(paths).toEqual([
        ['ENGL110', 'ENGL111'],
        ['ENGL110', 'ENGL113'],
        ['ENGL112', 'ENGL111'],
        ['ENGL112', 'ENGL113'],
      ]);
      expect(resolved.groups[0].paths.flatMap((formulaPath) => formulaPath.all_of)
        .some((condition) => condition.code === 'ENGL203')).toBe(false);

      const clause = extractRequiredClauses(candidate).clauses[0];
      const proof = resolved.projection;
      const allStudent = proof.all_student_prerequisite;
      const conditional = proof.english_major_conditional;
      expect(clause.raw.slice(
        allStudent.clause_relative_start,
        allStudent.clause_relative_end,
      )).toBe(allStudent.raw);
      expect(clause.raw.slice(
        conditional.clause_relative_start,
        conditional.clause_relative_end,
      )).toBe(conditional.raw);
      expect(`${allStudent.raw}${conditional.raw}`).toBe(clause.raw);
      expect(conditional).toMatchObject({
        required_major: 'English',
        modeled_major: 'Computer Science',
        applicable_to_modeled_degree_scope: false,
        preserved_in_source_evidence: true,
        graph_edge_emitted: false,
        omitted_course_key: 'va:uni:9231:ENGL203',
      });
      expect(proof.content_accounting).toEqual({
        clause_length: clause.raw.length,
        all_student_characters: allStudent.raw.length,
        connector_and_conditional_characters: conditional.raw.length,
        accounted_characters: clause.raw.length,
        source_content_discarded: false,
      });
      expect(projectionRowIssues(projectedRow(candidate))).toEqual([]);
      expect(reviewCandidate(candidate)).toMatchObject({
        status: 'parsed',
        review_status: 'promoted_strict_formula',
        review_reason: 'exact_vsu_cs_scope_english_major_conditional_projection',
        groups: resolved.groups,
        vsu_english_cs_scope_projection: resolved.projection,
      });
    }
  });

  it.each([
    ['response hash', (candidate) => { candidate.source.source_response_sha256 = '0'.repeat(64); }],
    ['raw entry', (candidate) => { candidate.source.raw_entry_text += ' drift'; }],
    ['entry HTML hash', (candidate) => { candidate.source.raw_entry_html_sha256 = '0'.repeat(64); }],
    ['courseblock index', (candidate) => { candidate.source.courseblock_index += 1; }],
    ['clause wording', (candidate, clauses) => { clauses[0].raw = clauses[0].raw.replace('and for', 'or for'); }],
    ['clause span', (candidate, clauses) => { clauses[0].relative_start += 1; }],
  ])('fails closed when the exact candidate %s changes', (label, mutate) => {
    const candidate = structuredClone(candidates[0]);
    const clauses = extractRequiredClauses(candidate).clauses;
    mutate(candidate, clauses);
    expect(resolveVirginiaStateEnglishPrerequisite(candidate, clauses)).toMatchObject({
      applicable: true,
      ready: false,
      review_reason: 'vsu_english_exact_candidate_or_scope_receipt_changed',
    });
  });

  it.each([
    ['formula', (row) => { row.groups[0].paths.pop(); }],
    ['raw prerequisite', (row) => { row.raw_requisites = row.raw_requisites.replace('and for', 'or for'); }],
    ['conditional applicability', (row) => {
      row.vsu_english_cs_scope_projection.english_major_conditional
        .applicable_to_modeled_degree_scope = true;
    }],
    ['conditional source retention', (row) => {
      row.vsu_english_cs_scope_projection.english_major_conditional
        .preserved_in_source_evidence = false;
    }],
    ['conditional graph edge', (row) => {
      row.vsu_english_cs_scope_projection.english_major_conditional.graph_edge_emitted = true;
    }],
    ['scope hash', (row) => {
      row.vsu_english_cs_scope_projection.degree_scope.major_source.text_sha256 = '0'.repeat(64);
    }],
    ['content accounting', (row) => {
      row.vsu_english_cs_scope_projection.content_accounting.source_content_discarded = true;
    }],
  ])('rejects a published row with changed %s evidence', (label, mutate) => {
    const row = projectedRow(candidates[0]);
    mutate(row);
    expect(projectionRowIssues(row)).not.toEqual([]);
  });

  it('requires all six rows and the exact VSU Computer Science degree proof at runtime', () => {
    const rows = candidates.map(projectedRow);
    expect(runtimeDegreeScopeIssues(rows, exactDegreeProof())).toEqual([]);
    expect(runtimeDegreeScopeIssues(rows.slice(1), exactDegreeProof()))
      .toContain('vsu_english_projection_target_roster_changed');
    const wrongMajor = exactDegreeProof();
    wrongMajor.proof.official_source_sha256.major = '0'.repeat(64);
    expect(runtimeDegreeScopeIssues(rows, wrongMajor))
      .toContain('vsu_english_projection_exact_cs_degree_scope_not_proven');
    const wrongTree = exactDegreeProof();
    wrongTree.proof.proof_tree_sha256 = '0'.repeat(64);
    expect(runtimeDegreeScopeIssues(rows, wrongTree))
      .toContain('vsu_english_projection_exact_cs_degree_scope_not_proven');
  });
});
