import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
  VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
  VSU_DEPARTMENT_URL,
  VSU_ROBOTS_URL,
  buildVirginiaStateArabicPrerequisiteEvidence,
  parseVirginiaStateArabicPrerequisiteEvidence,
  sha256,
  virginiaStateArabicPrerequisiteEvidenceIssue,
} = require('./virginiaStateArabicPrerequisiteEvidence');
const {
  formulaGroup,
  tokenizeVsuStructuredFormula,
} = require('./universityPrerequisiteReview');

const page = fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-state-arabic-prerequisite-sources/languages-and-literature-2026-2027.html',
  import.meta.url,
), 'utf8');
const robots = fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-state-arabic-prerequisite-sources/catalog-vsu-robots.txt',
  import.meta.url,
), 'utf8');
const artifact = JSON.parse(fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-state-arabic-prerequisite-evidence.json',
  import.meta.url,
), 'utf8'));

const options = {
  requestedUrl: VSU_DEPARTMENT_URL,
  finalUrl: VSU_DEPARTMENT_URL,
  contentType: 'text/html; charset=UTF-8',
  status: 200,
  robotsText: robots,
  robotsRequestedUrl: VSU_ROBOTS_URL,
  robotsFinalUrl: VSU_ROBOTS_URL,
  robotsContentType: 'text/plain; charset=UTF-8',
  robotsStatus: 200,
};

describe('Virginia State current Arabic prerequisite evidence', () => {
  it('resolves exactly four complete owner entries from the current department page', () => {
    const evidence = buildVirginiaStateArabicPrerequisiteEvidence(page, options);
    expect(evidence).toEqual(artifact);
    expect(virginiaStateArabicPrerequisiteEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      verified: true,
      issues: [],
      facts: {
        catalog_year: '2026-2027',
        target_course_codes: ['ARAB110', 'ARAB111', 'ARAB212', 'ARAB213'],
      },
      disposition: {
        resolved_course_codes: ['ARAB110', 'ARAB111', 'ARAB212', 'ARAB213'],
        unresolved_course_codes: [],
        equivalent_alternatives_preserved: true,
      },
    });
    expect(evidence.source).toMatchObject({
      response_bytes: 200845,
      arabic_section_courseblock_count: 4,
    });
  });

  it('keeps ARAB 110 as a non-course admission restriction, never inferred none', () => {
    const row = artifact.facts.entries.find((entry) => entry.course_code === 'ARAB110');
    expect(row).toMatchObject({
      formal_prerequisite_marker_count: 0,
      required_requisite_clause: null,
      catalog_silence_inferred_as_no_prerequisite: false,
      enrollment_restriction: {
        receipt_contract: VSU_ARAB110_RESTRICTION_RECEIPT_CONTRACT,
        kind: 'enrollment_restriction',
        restriction_type: 'prior_admission_credit',
        subject: 'Arabic',
        admission_credit_allowed: false,
        raw: 'open to those students presenting no admission credit in Arabic',
      },
      semantic_prerequisite: {
        status: 'parsed_non_course_enrollment_restriction',
        paths: [{ all_of: [{
          type: 'non_course',
          condition: 'no_admission_credit_in_arabic',
          admission_credit_allowed: false,
        }] }],
      },
    });
    const receipt = row.enrollment_restriction;
    expect(row.raw_entry_text.slice(receipt.relative_start, receipt.relative_end))
      .toBe(receipt.raw);
  });

  it('retains every "or its equivalent" as a separate non-course path', () => {
    const expected = {
      ARAB111: 'ARAB110',
      ARAB212: 'ARAB111',
      ARAB213: 'ARAB212',
    };
    for (const [code, prerequisiteCode] of Object.entries(expected)) {
      const row = artifact.facts.entries.find((entry) => entry.course_code === code);
      expect(row.required_requisite_clause).toMatchObject({
        receipt_contract: VSU_ARABIC_CLAUSE_RECEIPT_CONTRACT,
        kind: 'prerequisite',
        raw: `${prerequisiteCode.replace(/^(ARAB)(\d+)$/, '$1 $2')} or its equivalent`,
      });
      const receipt = row.required_requisite_clause;
      expect(row.raw_entry_text.slice(receipt.relative_start, receipt.relative_end))
        .toBe(receipt.raw);
      expect(row.semantic_prerequisite.paths).toEqual([
        { all_of: [expect.objectContaining({ type: 'course', code: prerequisiteCode })] },
        { all_of: [expect.objectContaining({
          type: 'non_course', equivalent_to_course_code: prerequisiteCode,
        })] },
      ]);

      const reviewed = formulaGroup({
        owner: 'va:uni:9231',
        courseKey: `va:uni:9231:${code}`,
        kind: 'prerequisite',
        raw: receipt.raw,
        tokens: tokenizeVsuStructuredFormula(receipt.raw, 'va:uni:9231'),
      });
      expect(reviewed.paths.map((path) => path.all_of.map((condition) => (
        condition.code || condition.equivalent_to_course_code
      )))).toEqual([[prerequisiteCode], [prerequisiteCode]]);
    }
  });

  it('fails closed on route, edition, restriction, equivalent, or source-byte drift', () => {
    expect(parseVirginiaStateArabicPrerequisiteEvidence(page, {
      ...options,
      finalUrl: 'https://catalog.vsu.edu/undergraduate/courses/arab/',
    }).issues).toContain('department_url_identity');
    expect(parseVirginiaStateArabicPrerequisiteEvidence(
      page.replace('2026-2027 Academic Catalog', '2025-2026 Academic Catalog'),
      { ...options, expectedDepartmentSha256: sha256(page.replace(
        '2026-2027 Academic Catalog', '2025-2026 Academic Catalog',
      )) },
    ).issues).toContain('catalog_edition_label');

    const weakenedRestriction = page.replace(
      'open to those students presenting no admission credit in Arabic',
      'open to all students',
    );
    expect(parseVirginiaStateArabicPrerequisiteEvidence(weakenedRestriction, {
      ...options,
      expectedDepartmentSha256: sha256(weakenedRestriction),
    }).issues).toEqual(expect.arrayContaining([
      'ARAB110:exact_description', 'ARAB110:admission_restriction_projection',
    ]));

    const arab111Start = page.indexOf('ARAB\u00a0111.');
    const arab212Start = page.indexOf('ARAB\u00a0212.', arab111Start + 1);
    expect(arab111Start).toBeGreaterThan(0);
    expect(arab212Start).toBeGreaterThan(arab111Start);
    const arab111Block = page.slice(arab111Start, arab212Start);
    const weakenedEquivalent = page.slice(0, arab111Start)
      + arab111Block.replace(' or its equivalent.', '.')
      + page.slice(arab212Start);
    expect(weakenedEquivalent).not.toBe(page);
    expect(parseVirginiaStateArabicPrerequisiteEvidence(weakenedEquivalent, {
      ...options,
      expectedDepartmentSha256: sha256(weakenedEquivalent),
    }).issues).toEqual(expect.arrayContaining([
      'ARAB111:exact_description', 'ARAB111:formal_prerequisite_suffix',
      'ARAB111:prerequisite_projection',
    ]));

    expect(() => buildVirginiaStateArabicPrerequisiteEvidence(`${page} `, options))
      .toThrow(/department_response_sha256/);
  });

  it('rejects a self-consistently edited artifact through the pinned facts digest', () => {
    const changed = structuredClone(artifact);
    changed.facts.entries[0].semantic_prerequisite.paths[0].all_of[0]
      .admission_credit_allowed = true;
    expect(virginiaStateArabicPrerequisiteEvidenceIssue(changed))
      .toMatch(/receipt changed/);
  });
});
