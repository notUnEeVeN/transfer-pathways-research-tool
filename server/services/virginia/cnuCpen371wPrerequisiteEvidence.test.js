import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  CNU_ALIAS_RECEIPT_CONTRACT,
  CNU_CATALOG_URL,
  CNU_CLAUSE_RECEIPT_CONTRACT,
  CNU_PROGRAM_URL,
  CNU_ROBOTS_URL,
  buildCnuCpen371wPrerequisiteEvidence,
  cnuCpen371wPrerequisiteEvidenceIssue,
  parseCnuCpen371wPrerequisiteEvidence,
  sha256,
} = require('./cnuCpen371wPrerequisiteEvidence');

const sourceRoot = new URL(
  '../../.va-catalogs/research/cnu-cpen371w-prerequisite-sources/',
  import.meta.url,
);
const read = (name, encoding = null) => fs.readFileSync(new URL(name, sourceRoot), encoding);
const artifact = JSON.parse(fs.readFileSync(new URL(
  '../../.va-catalogs/research/cnu-cpen371w-prerequisite-evidence.json',
  import.meta.url,
), 'utf8'));
const sources = {
  catalogBytes: read('cnu-2026-2027-undergraduate-catalog.pdf'),
  programHtml: read('computer-science-program.html', 'utf8'),
  robotsText: read('cnu-robots.txt', 'utf8'),
  pdfInfoText: read('catalog.pdfinfo.txt', 'utf8'),
  catalogRawText: read('catalog.raw.txt', 'utf8'),
  programPageRawText: read('catalog-physical-page-272.raw.txt', 'utf8'),
  coursePageRawText: read('catalog-physical-page-275.raw.txt', 'utf8'),
  catalogRequestedUrl: CNU_CATALOG_URL,
  catalogFinalUrl: CNU_CATALOG_URL,
  catalogContentType: 'application/pdf',
  catalogStatus: 200,
  programRequestedUrl: CNU_PROGRAM_URL,
  programFinalUrl: CNU_PROGRAM_URL,
  programContentType: 'text/html; charset=UTF-8',
  programStatus: 200,
  robotsRequestedUrl: CNU_ROBOTS_URL,
  robotsFinalUrl: CNU_ROBOTS_URL,
  robotsContentType: 'text/plain; charset=UTF-8',
  robotsStatus: 200,
};

describe('CNU current CPEN 371W identity and prerequisite evidence', () => {
  it('resolves only CPEN 371W from the joint current requirement and catalog entry', () => {
    const evidence = buildCnuCpen371wPrerequisiteEvidence(sources);
    expect(evidence).toEqual(artifact);
    expect(cnuCpen371wPrerequisiteEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      verified: true,
      issues: [],
      catalog_source: {
        response_bytes: 12618538,
        pdf_info: {
          title: 'CNU 2026-2027 Undergraduate Catalog',
          pages: '321',
        },
      },
      facts: {
        target_course_code: 'CPEN371W',
        program_requirement: {
          program: 'Computer Science',
          target_course_code: 'CPEN371W',
          target_title: 'Computer Ethics',
          exact_requirement_text: 'CPEN 371W - Computer Ethics',
        },
        catalog_degree_requirement: {
          exact_requirement_text: '1. CPEN 214, 371W;',
          physical_pdf_page: 272,
        },
        identity_resolution: {
          receipt_contract: CNU_ALIAS_RECEIPT_CONTRACT,
          resolved: true,
          scope: 'CPEN371W_only',
          broad_suffix_alias_rule_created: false,
          exact_catalog_entry_count: 1,
          competing_target_heading_count: 0,
          same_catalog_target_reference_count: 5,
        },
      },
      disposition: {
        resolved_course_codes: ['CPEN371W'],
        unresolved_course_codes: [],
        verified_major_core_changed: false,
      },
    });
  });

  it('retains the complete CPEN 371 prerequisite semantics under the exact target identity', () => {
    const entry = artifact.facts.catalog_course_entry;
    expect(entry).toMatchObject({
      resolved_course_code: 'CPEN371W',
      catalog_entry_course_code: 'CPEN371',
      heading_text: 'CPEN 371. WI: Computer Ethics (2-2-0)',
      identity_title: 'Computer Ethics',
      published_units: { credit_hours_min: 2, credit_hours_max: 2 },
      required_requisite_clause: {
        receipt_contract: CNU_CLAUSE_RECEIPT_CONTRACT,
        raw: 'ENGL 223 with a C- or higher; major or minor in PCSE',
      },
      semantic_prerequisite: {
        status: 'parsed',
        paths: [{ all_of: [
          { type: 'course', code: 'ENGL223', course_key: 'va:uni:9206:ENGL223', minimum_grade: 'C-', raw: 'ENGL 223 with a C- or higher' },
          { type: 'non_course', condition: 'pcse_major_or_minor', academic_program: 'PCSE', eligible_academic_program_roles: ['major', 'minor'], raw: 'major or minor in PCSE' },
        ] }],
      },
    });
    const receipt = entry.required_requisite_clause;
    expect(entry.raw_entry_text.slice(receipt.relative_start, receipt.relative_end))
      .toBe(receipt.raw);

    expect(entry.semantic_prerequisite.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'ENGL223', minimum_grade: 'C-' }),
      expect.objectContaining({ type: 'non_course', condition: 'pcse_major_or_minor' }),
    ]);
  });

  it('fails closed if either half of the joint identity proof drifts', () => {
    const changedProgram = sources.programHtml.replace(
      'CPEN 371W - Computer Ethics',
      'CPEN 371X - Computer Ethics',
    );
    const changedProgramResult = parseCnuCpen371wPrerequisiteEvidence({
      ...sources,
      programHtml: changedProgram,
      expectedProgramSha256: sha256(changedProgram),
    });
    expect(changedProgramResult.verified).toBe(false);
    expect(changedProgramResult.issues).toEqual(expect.arrayContaining([
      'unique_cpen371w_code_title_requirement', 'joint_current_source_identity_proof',
    ]));

    const changedCoursePage = sources.coursePageRawText.replace(
      'CPEN 371. WI: Computer Ethics (2-2-0)',
      'CPEN 371. WI: Engineering Ethics (2-2-0)',
    );
    const changedCourseResult = parseCnuCpen371wPrerequisiteEvidence({
      ...sources,
      coursePageRawText: changedCoursePage,
      expectedCoursePageRawTextSha256: sha256(changedCoursePage),
    });
    expect(changedCourseResult.verified).toBe(false);
    expect(changedCourseResult.issues).toEqual(expect.arrayContaining([
      'unique_cpen371_heading', 'joint_current_source_identity_proof',
    ]));
  });

  it('rejects a broad suffix interpretation, changed formula, or unpinned bytes', () => {
    const changedRequirement = sources.programPageRawText.replace(
      '1. CPEN 214, 371W;',
      '1. CPEN 214, 371;',
    );
    expect(parseCnuCpen371wPrerequisiteEvidence({
      ...sources,
      programPageRawText: changedRequirement,
      expectedProgramPageRawTextSha256: sha256(changedRequirement),
    }).issues).toContain('catalog_exact_degree_requirement');

    const changedPrerequisite = sources.coursePageRawText.replace(
      'minor in PCSE.',
      'minor in any program.',
    );
    expect(parseCnuCpen371wPrerequisiteEvidence({
      ...sources,
      coursePageRawText: changedPrerequisite,
      expectedCoursePageRawTextSha256: sha256(changedPrerequisite),
    }).issues).toContain('exact_prerequisite_statement');

    expect(() => buildCnuCpen371wPrerequisiteEvidence({
      ...sources,
      catalogBytes: Buffer.concat([sources.catalogBytes, Buffer.from('changed')]),
    })).toThrow(/catalog_response_sha256/);
  });

  it('pins the facts independently of a self-consistently edited JSON artifact', () => {
    const changed = structuredClone(artifact);
    changed.facts.identity_resolution.broad_suffix_alias_rule_created = true;
    expect(cnuCpen371wPrerequisiteEvidenceIssue(changed)).toMatch(/receipt changed/);
  });
});
