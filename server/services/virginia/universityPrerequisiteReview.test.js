import { describe, expect, it } from 'vitest';
import {
  closureReport,
  controlledCourseLeafSilenceEvidence,
  controlledShenandoahAcalogSilenceEvidence,
  extractBridgewaterRequiredClauses,
  extractCnuRequiredClauses,
  extractLongwoodRequiredClauses,
  extractRequiredClauses,
  exactBrowserCourseLeafRequiredClauses,
  formulaGroup,
  parseBooleanTokens,
  reviewCandidate,
  shenandoahAcalogMarkerControl,
  tokenizeBridgewaterStrictFormula,
  tokenizeCourseOnly,
  tokenizeCnuStrictFormula,
  tokenizeLongwoodStrictFormula,
  tokenizeJmuBrowserStrictFormula,
  tokenizeExplicitChoiceFormula,
  tokenizeGmu,
  tokenizeNsuTake,
  tokenizeOduStructuredFormula,
  tokenizeRadfordStrictFormula,
  tokenizeRmcStructuredFormula,
  tokenizeShenandoahStrictFormula,
  tokenizeVcuStructuredFormula,
  tokenizeUvaWiseStrictFormula,
  tokenizeVirginiaTechStrictFormula,
  tokenizeVirginiaTechBrowserStrictFormula,
  tokenizeVsuStructuredFormula,
  tokenizeVsuTitledFormula,
} from './universityPrerequisiteReview';
import {
  COURSELEAF_BOUNDARY_CONTRACT,
  COURSELEAF_RECEIPT_CONTRACT,
  extractCourseLeafEntries,
} from './universityPrerequisiteAcquisition';
import {
  BRIDGEWATER_BOUNDARY_CONTRACT,
} from './bridgewaterCleanCatalogPrerequisiteAcquisition';
import {
  LONGWOOD_BOUNDARY_CONTRACT,
} from './longwoodDepartmentPrerequisiteAcquisition';
import {
  LONGWOOD_BANNER_BOUNDARY_CONTRACT,
} from './longwoodBannerCourseAcquisition';
import {
  CNU_COMPOUND_BOUNDARY_CONTRACT,
  CNU_COMPOUND_RECEIPT_CONTRACT,
  extractCnuCompoundMemberRequisites,
} from './cnuPdfPrerequisiteAcquisition';
import {
  RADFORD_BOUNDARY_CONTRACT,
  RADFORD_CLAUSE_RECEIPT_CONTRACT,
} from './radfordAcalogPrerequisiteAcquisition';
import {
  SHENANDOAH_BOUNDARY_CONTRACT,
  SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
  SHENANDOAH_DIRECT_COURSE_RECORDS,
  SHENANDOAH_DISCOVERY_CONTRACT,
  SHENANDOAH_PROGRAM_CACHE_PATH,
  SHENANDOAH_PROGRAM_HTML_SHA256,
} from './shenandoahAcalogPrerequisiteAcquisition';

const radfordGroup = (raw) => formulaGroup({
  owner: 'va:uni:9223',
  courseKey: 'va:uni:9223:CS120',
  kind: 'prerequisite',
  raw,
  tokens: tokenizeRadfordStrictFormula(raw, 'va:uni:9223'),
});

const candidate = (rawEntryText, overrides = {}) => ({
  school_id: 9228,
  slug: 'university-of-mary-washington',
  owner_namespace: 'va:uni:9228',
  course_key: 'va:uni:9228:CPSC220',
  course_code: 'CPSC220',
  row_status: 'candidate_review_required',
  source: {
    official_url: 'https://catalog.example.edu/cpsc',
    declared_normalized_text_sha256: 'source-hash',
    retained_normalized_text_sha256: 'source-hash',
    character_start: 100,
    character_end: 100 + rawEntryText.length,
    heading_text: 'CPSC 220 - Fixture (3 Credits)',
    raw_entry_sha256: require('node:crypto').createHash('sha256').update(rawEntryText).digest('hex'),
    raw_entry_text: rawEntryText,
  },
  ...overrides,
});

const bridgewaterCandidate = (courseCode, rawEntryText) => candidate(rawEntryText, {
  school_id: 9205,
  slug: 'bridgewater-college',
  owner_namespace: 'va:uni:9205',
  course_key: `va:uni:9205:${courseCode}`,
  course_code: courseCode,
  source: {
    official_url: `https://bridgewater.cleancatalog.io/${courseCode.toLowerCase()}`,
    boundary_contract: BRIDGEWATER_BOUNDARY_CONTRACT,
    source_format: 'cleancatalog_course_page',
    declared_normalized_text_sha256: 'source-hash',
    retained_normalized_text_sha256: 'source-hash',
    character_start: 0,
    character_end: rawEntryText.length,
    heading_text: courseCode,
    raw_entry_sha256: require('node:crypto').createHash('sha256')
      .update(rawEntryText).digest('hex'),
    raw_entry_text: rawEntryText,
  },
});

const longwoodCandidate = (courseCode, rawEntryText) => candidate(rawEntryText, {
  school_id: 9214,
  slug: 'longwood-university',
  owner_namespace: 'va:uni:9214',
  course_key: `va:uni:9214:${courseCode}`,
  course_code: courseCode,
  source: {
    official_url: 'https://www.longwood.edu/computerscience/computer-science-course-listing/',
    boundary_contract: LONGWOOD_BOUNDARY_CONTRACT,
    source_format: 'longwood_department_course_listing',
    declared_normalized_text_sha256: 'source-hash',
    retained_normalized_text_sha256: 'source-hash',
    character_start: 0,
    character_end: rawEntryText.length,
    heading_text: courseCode,
    raw_entry_sha256: require('node:crypto').createHash('sha256')
      .update(rawEntryText).digest('hex'),
    raw_entry_text: rawEntryText,
  },
});

const longwoodBannerCandidate = (courseCode, rawEntryText) => candidate(rawEntryText, {
  school_id: 9214,
  slug: 'longwood-university',
  owner_namespace: 'va:uni:9214',
  course_key: `va:uni:9214:${courseCode}`,
  course_code: courseCode,
  source: {
    official_url: 'https://www.longwood.edu/site-assets/courses-from-banner/',
    boundary_contract: LONGWOOD_BANNER_BOUNDARY_CONTRACT,
    source_format: 'longwood_banner_course_listing',
    declared_normalized_text_sha256: 'source-hash',
    retained_normalized_text_sha256: 'source-hash',
    character_start: 0,
    character_end: rawEntryText.length,
    heading_text: courseCode,
    raw_entry_sha256: require('node:crypto').createHash('sha256')
      .update(rawEntryText).digest('hex'),
    raw_entry_text: rawEntryText,
  },
});

const cnuCompoundCandidate = (courseCode, rawEntryText, compoundCodes) => {
  const result = extractCnuCompoundMemberRequisites(rawEntryText, compoundCodes);
  const member = result.receipts.find((row) => row.course_code === courseCode);
  return candidate(rawEntryText, {
    school_id: 9206,
    slug: 'christopher-newport-university',
    owner_namespace: 'va:uni:9206',
    course_key: `va:uni:9206:${courseCode}`,
    course_code: courseCode,
    source: {
      official_url: 'https://cnu.edu/catalog.pdf',
      boundary_contract: CNU_COMPOUND_BOUNDARY_CONTRACT,
      source_format: 'pdf_bbox_columns',
      compound_entry: true,
      compound_receipt_contract: CNU_COMPOUND_RECEIPT_CONTRACT,
      compound_receipt_sha256: 'receipt-hash',
      compound_heading_course_codes: compoundCodes,
      compound_member_requisite: member,
      compound_sibling_requisites: result.receipts.filter((row) => row !== member),
      declared_normalized_text_sha256: 'source-hash',
      retained_normalized_text_sha256: 'source-hash',
      character_start: 0,
      character_end: rawEntryText.length,
      heading_text: rawEntryText.split('\n')[0],
      raw_entry_sha256: require('node:crypto').createHash('sha256')
        .update(rawEntryText).digest('hex'),
      raw_entry_text: rawEntryText,
    },
  });
};

describe('Virginia university prerequisite formula review', () => {
  it('accounts for exact Radford grade, choice, placement, and standing topology', () => {
    const complex = 'A “C” or better in MATH 125 or MATH 138 ; or credit for MATH 126 , MATH 168 , OR MATH 171 . and one of the following. 1. A “C” or better in CS 101 . 2. A passing score on a placement exam approved by the School of Computing and Information Sciences. 3. A “C” or better in one of the following courses (PHYS 111 , PHYS 112 , PHYS 221 , or PHYS 222 ).';
    const complexGroup = radfordGroup(complex);
    expect(complexGroup.paths).toHaveLength(30);
    expect(complexGroup.paths.every((path) => path.all_of.length === 2)).toBe(true);
    expect(complexGroup.paths.flatMap((path) => path.all_of).some((condition) => (
      condition.type === 'non_course'
      && condition.condition === 'passing_score_on_school_approved_placement_exam'
    ))).toBe(true);
    expect(complexGroup.paths.flatMap((path) => path.all_of).filter((condition) => (
      ['MATH126', 'MATH168', 'MATH171'].includes(condition.code)
    )).every((condition) => condition.completion_credit_required === true)).toBe(true);

    const gradedChoice = radfordGroup(
      'Grade of ”C” or better in either CS 119 or CS 120 .',
    );
    expect(gradedChoice.paths.map((path) => path.all_of)).toEqual([
      [expect.objectContaining({ code: 'CS119', minimum_grade: 'C' })],
      [expect.objectContaining({ code: 'CS120', minimum_grade: 'C' })],
    ]);
    expect(radfordGroup('SCIS major with sophomore standing.').paths[0].all_of)
      .toEqual([
        expect.objectContaining({
          type: 'non_course',
          condition: 'major_in_school_of_computing_and_information_sciences',
        }),
        expect.objectContaining({
          type: 'non_course',
          condition: 'sophomore_standing_or_higher',
        }),
      ]);
    expect(radfordGroup('Junior Standing.').paths[0].all_of).toEqual([
      expect.objectContaining({
        type: 'non_course',
        condition: 'junior_standing_or_higher',
        minimum_class_standing: 'junior',
      }),
    ]);
    expect(radfordGroup(
      'Either 1) a C or better in MATH 125 , or 2) a passing grade on a placement test approved by the Department of Mathematics and Statistics.',
    ).paths.map((path) => path.all_of)).toEqual([
      [expect.objectContaining({ code: 'MATH125', minimum_grade: 'C' })],
      [expect.objectContaining({
        type: 'non_course',
        condition: 'passing_result_on_department_approved_mathematics_placement_test',
      })],
    ]);
  });

  it('keeps Radford mixed AND/OR and near-match prose outside the grammar', () => {
    expect(() => tokenizeRadfordStrictFormula(
      'CS 220 (Grade of “C” or better) and MATH 171 , MATH 169 , or MATH 151 .',
      'va:uni:9223',
    )).toThrow();
    expect(() => tokenizeRadfordStrictFormula(
      'Grade of “C” or better in CS 119 or CS 120 with adviser approval.',
      'va:uni:9223',
    )).toThrow();
    expect(() => tokenizeRadfordStrictFormula(
      'A grade of C or better in MATH 138 or another approved college-level precalculus course including some trigonometry OR a passing score on a placement exam approved by the Department of Mathematics and Statistics.',
      'va:uni:9223',
    )).toThrow(/does not state whether the C-or-better grade applies/);
  });

  it('separates Radford MATH 169 encouraged-contact prose with exact evidence', () => {
    const required = 'A grade of C or better in MATH 168 or permission of the Department of Mathematics and Statistics.';
    const encouraged = 'Students with credit for MATH 126 Business Calculus or another college level calculus course are encouraged to contact the Department of Mathematics and Statistics for permission.';
    const rawClause = `${required} ${encouraged}`;
    const rawEntryText = `MATH 169 - Fixture Credits: (3) Prerequisites: ${rawClause} Description.`;
    const relativeStart = rawEntryText.indexOf(rawClause);
    const statementStart = rawEntryText.indexOf('Prerequisites:');
    const hash = require('node:crypto').createHash('sha256');
    const row = candidate(rawEntryText, {
      school_id: 9223,
      slug: 'radford-university',
      owner_namespace: 'va:uni:9223',
      course_key: 'va:uni:9223:MATH169',
      course_code: 'MATH169',
      source: {
        official_url: 'https://catalog.radford.edu/preview_course_nopop.php?catoid=62&coid=109886',
        boundary_contract: RADFORD_BOUNDARY_CONTRACT,
        character_start: 0,
        character_end: rawEntryText.length,
        heading_text: 'MATH 169 - Fixture',
        raw_entry_sha256: require('node:crypto').createHash('sha256')
          .update(rawEntryText).digest('hex'),
        raw_entry_text: rawEntryText,
        required_requisite_clause: {
          receipt_contract: RADFORD_CLAUSE_RECEIPT_CONTRACT,
          kind: 'prerequisite',
          label: 'Prerequisites',
          raw: rawClause,
          raw_sha256: hash.update(rawClause).digest('hex'),
          relative_start: relativeStart,
          relative_end: relativeStart + rawClause.length,
          statement_relative_start: statementStart,
          statement_relative_end: relativeStart + rawClause.length,
        },
      },
    });
    const extracted = extractRequiredClauses(row);
    expect(extracted.clauses).toEqual([
      expect.objectContaining({ raw: required, relative_end: relativeStart + required.length }),
    ]);
    expect(extracted.ignored).toEqual([
      expect.objectContaining({
        kind: 'explicit_encouraged_contact_suffix_not_modeled',
        raw: encouraged,
        relative_start: relativeStart + required.length + 1,
      }),
    ]);
    const reviewed = reviewCandidate(row);
    expect(reviewed.status).toBe('parsed');
    expect(reviewed.groups[0].paths.map((path) => path.all_of)).toEqual([
      [expect.objectContaining({ code: 'MATH168', minimum_grade: 'C' })],
      [expect.objectContaining({
        type: 'non_course',
        condition: 'permission_of_department_of_mathematics_and_statistics',
      })],
    ]);
  });

  it('promotes only hash-bound complete CourseLeaf silence with a same-response positive control', () => {
    const raw = 'CS 101 First Course (3 Credits) An introductory course.';
    const hash = require('node:crypto').createHash('sha256').update(raw).digest('hex');
    const source = {
      capture_origin: 'official_acquisition',
      source_format: 'courseleaf_courseblock',
      boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      official_url: 'https://catalog.umw.edu/undergraduate/course-descriptions/cpsc/',
      catalog_year_verified: '2025-2026',
      declared_normalized_text_sha256: 'a'.repeat(64),
      retained_normalized_text_sha256: 'a'.repeat(64),
      source_response_sha256: 'a'.repeat(64),
      source_response_bytes: 1000,
      cache_path: 'university-prerequisites/raw/example.html',
      character_start: 0,
      character_end: raw.length,
      courseblock_index: 4,
      heading_text: 'CS 101 First Course (3 Credits)',
      published_units: { credit_hours_min: 3, credit_hours_max: 3 },
      raw_entry_html_sha256: 'b'.repeat(64),
      raw_entry_sha256: hash,
      raw_entry_text: raw,
      complete_entry_receipt: {
        receipt_contract: COURSELEAF_RECEIPT_CONTRACT,
        source_courseblock_count: 10,
        source_complete_entry_count: 10,
        source_complete_entries_with_required_requisite_marker_count: 2,
        entry_required_requisite_marker_count: 0,
        entry_corequisite_marker_count: 0,
        entry_requisite_marker_like_count: 0,
        entry_constraint_like_signal_count: 0,
        same_source_positive_control: true,
      },
    };
    const row = reviewCandidate(candidate(raw, {
      school_id: 9228,
      slug: 'university-of-mary-washington',
      owner_namespace: 'va:uni:9228',
      course_key: 'va:uni:9228:CPSC101',
      course_code: 'CPSC101',
      source,
    }));
    expect(row).toMatchObject({
      status: 'none',
      review_status: 'promoted_structural_none',
      review_reason: 'complete_courseleaf_entry_silence_with_same_source_required_marker_control',
      structural_none_evidence: {
        kind: 'official_complete_entry_structural_silence_with_same_source_positive_control',
      },
      review_evidence: {
        source_format: 'courseleaf_courseblock',
        boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
      },
    });

    const noControl = structuredClone(source);
    noControl.complete_entry_receipt.same_source_positive_control = false;
    noControl.complete_entry_receipt.source_complete_entries_with_required_requisite_marker_count = 0;
    expect(controlledCourseLeafSilenceEvidence({ source: noControl })).toBeNull();
    const corequisite = structuredClone(source);
    corequisite.raw_entry_text = `${raw} Corequisite: CS 100.`;
    corequisite.raw_entry_sha256 = require('node:crypto').createHash('sha256')
      .update(corequisite.raw_entry_text).digest('hex');
    expect(controlledCourseLeafSilenceEvidence({ source: corequisite })).toBeNull();
    const administrative = structuredClone(source);
    administrative.raw_entry_text = `${raw} Registration Restrictions: Open only to honors students.`;
    administrative.raw_entry_sha256 = require('node:crypto').createHash('sha256')
      .update(administrative.raw_entry_text).digest('hex');
    administrative.complete_entry_receipt.entry_constraint_like_signal_count = 2;
    expect(controlledCourseLeafSilenceEvidence({ source: administrative })).toBeNull();
    const unbounded = { ...source, capture_origin: 'retained_catalog_text' };
    expect(controlledCourseLeafSilenceEvidence({ source: unbounded })).toBeNull();
  });

  it('parses explicit parentheses into OR-of-AND paths without flattening', () => {
    const owner = 'va:uni:1';
    const group = formulaGroup({
      owner,
      courseKey: `${owner}:CS300`,
      kind: 'prerequisite',
      raw: 'CS 100 and (MATH 100 or MATH 101)',
      tokens: tokenizeCourseOnly('CS 100 and (MATH 100 or MATH 101)', owner),
    });
    expect(group.paths.map((path) => path.all_of.map((row) => row.code))).toEqual([
      ['CS100', 'MATH100'],
      ['CS100', 'MATH101'],
    ]);
  });

  it('accounts for GMU shorthand, grade qualifiers, placement, and concurrency', () => {
    const owner = 'va:uni:9210';
    const raw = "(CS 110*C, 110XS or 101*) and (minimum score of 80 in 'Math Placement Aleks' or MATH 104C)";
    const tokens = tokenizeGmu(raw, owner);
    expect(() => parseBooleanTokens(tokens)).not.toThrow();
    const group = formulaGroup({ owner, courseKey: `${owner}:CS200`, kind: 'prerequisite', raw, tokens });
    expect(group.paths).toHaveLength(4);
    const cs110 = group.paths.flatMap((path) => path.all_of).find((row) => row.code === 'CS110');
    expect(cs110.catalog_variants).toEqual(expect.arrayContaining([
      expect.objectContaining({ catalog_qualifier: 'C', concurrent_allowed: true }),
      expect.objectContaining({ catalog_qualifier: 'XS' }),
    ]));
    expect(group.paths.flatMap((path) => path.all_of).some((row) => (
      row.type === 'non_course' && row.minimum_score === 80
    ))).toBe(true);
  });

  it('retains George Mason singular Required Prerequisite fields exactly', () => {
    const raw = 'GEOL 103: Physical Geology Lab. 1 credit. Registration Restrictions: Required Prerequisite: GEOL 101*D.* May be taken concurrently.D Requires minimum grade of D.Schedule Type: Laboratory';
    const row = candidate(raw, {
      school_id: 9210,
      slug: 'george-mason-university',
      owner_namespace: 'va:uni:9210',
      course_key: 'va:uni:9210:GEOL103',
      course_code: 'GEOL103',
    });
    expect(extractRequiredClauses(row)).toMatchObject({
      clauses: [expect.objectContaining({
        kind: 'prerequisite',
        label: 'Required Prerequisite',
        raw: 'GEOL 101*D',
      })],
      ignored: [],
    });
    expect(reviewCandidate(row)).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      groups: [expect.objectContaining({
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({
            code: 'GEOL101',
            concurrent_allowed: true,
            minimum_grade: 'D',
          })],
        })],
      })],
    });
  });

  it('preserves GMU U/L and grade variants plus exact placement scores', () => {
    const owner = 'va:uni:9210';
    const variants = formulaGroup({
      owner,
      courseKey: `${owner}:CHEM212`,
      kind: 'prerequisite',
      raw: '(CHEM 211C, 211T, U211 or 211XS)',
      tokens: tokenizeGmu('(CHEM 211C, 211T, U211 or 211XS)', owner),
    });
    expect(variants.paths).toHaveLength(1);
    expect(variants.paths[0].all_of[0]).toMatchObject({ code: 'CHEM211' });
    expect(variants.paths[0].all_of[0].catalog_variants.map((row) => row.catalog_qualifier))
      .toEqual(expect.arrayContaining(['C', 'T', 'U', 'XS']));

    const placement = formulaGroup({
      owner,
      courseKey: `${owner}:MATH123`,
      kind: 'prerequisite',
      raw: "minimum score of 65 in 'Math Placement Aleks' or MATH 105C",
      tokens: tokenizeGmu("minimum score of 65 in 'Math Placement Aleks' or MATH 105C", owner),
    });
    expect(placement.paths).toEqual(expect.arrayContaining([
      expect.objectContaining({ all_of: [expect.objectContaining({ minimum_score: 65 })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({ code: 'MATH105' })] }),
    ]));

    const large = '((CS 112C, 112XS, 112, 109C, 109XS or 109) and (ECE 285C, 285XS, 285, 330C, 330XS or 330) and ((ECE 301C, 301XS or L301) or (ECE 231C, 231XS or 231) and (ECE 232C, 232XS or 232) or (ME 331C, 331XS or 331)))';
    const expanded = formulaGroup({
      owner,
      courseKey: `${owner}:ECE350`,
      kind: 'prerequisite',
      raw: large,
      tokens: tokenizeGmu(large, owner),
    });
    expect(expanded.paths).toHaveLength(12);
  });

  it('retains a GMU printed course-range alternative as a typed open atom', () => {
    const owner = 'va:uni:9210';
    const raw = '(ENGH 100C-) and (ENGH 2--- or ENGH 201D)';
    const group = formulaGroup({
      owner, courseKey: `${owner}:ENGH302`, kind: 'prerequisite', raw,
      tokens: tokenizeGmu(raw, owner),
    });
    expect(group.paths).toHaveLength(2);
    expect(group.paths.flatMap((path) => path.all_of)).toContainEqual(
      expect.objectContaining({
        type: 'non_course',
        condition: 'catalog_course_range_engr_2xx'.replace('engr', 'engh'),
        catalog_course_range: 'ENGH 2---',
        subject: 'ENGH',
        minimum_catalog_level: 200,
        maximum_catalog_level: 299,
      }),
    );
  });

  it('parses only explicitly scoped ODU base-plus-graded-choice formulas', () => {
    const owner = 'va:uni:9218';
    const raw = 'CS 252 and a grade of C or better in CS 330 or CS 361';
    const group = formulaGroup({
      owner,
      courseKey: `${owner}:CS350`,
      kind: 'prerequisite',
      raw,
      tokens: tokenizeOduStructuredFormula(raw, owner),
    });
    expect(group.paths.map((path) => path.all_of.map((row) => row.code))).toEqual([
      ['CS252', 'CS330'],
      ['CS252', 'CS361'],
    ]);
    expect(group.paths.flatMap((path) => path.all_of)
      .filter((row) => row.code !== 'CS252').every((row) => row.minimum_grade === 'C'))
      .toBe(true);
    const pinnedProgramming = 'CS 150 or ENGN 122 with a grade of C or better and MATH 163';
    const pinnedProgrammingGroup = formulaGroup({
      owner, courseKey: `${owner}:CS250`, kind: 'prerequisite',
      raw: pinnedProgramming,
      tokens: tokenizeOduStructuredFormula(pinnedProgramming, owner),
    });
    expect(pinnedProgrammingGroup.paths.map((path) => path.all_of.map((row) => (
      [row.code, row.minimum_grade || null]
    )))).toEqual([
      [['CS150', 'C'], ['MATH163', null]],
      [['ENGN122', 'C'], ['MATH163', null]],
    ]);
    expect(() => tokenizeOduStructuredFormula(
      'CS 150 or ENGN 122 with a grade of C or better or MATH 163', owner,
    )).toThrow();

    const repeatedGradeScopes = 'A grade of C or better in CS 150 or ENGN 150 or ENGN 122 and a grade of C or better in MATH 211';
    const repeatedGradeGroup = formulaGroup({
      owner,
      courseKey: `${owner}:ECE241`,
      kind: 'prerequisite',
      raw: repeatedGradeScopes,
      tokens: tokenizeOduStructuredFormula(repeatedGradeScopes, owner),
    });
    expect(repeatedGradeGroup.paths.map((path) => (
      path.all_of.map((row) => [row.code, row.minimum_grade])
    ))).toEqual([
      [['CS150', 'C'], ['MATH211', 'C']],
      [['ENGN150', 'C'], ['MATH211', 'C']],
      [['ENGN122', 'C'], ['MATH211', 'C']],
    ]);
    expect(() => tokenizeOduStructuredFormula(
      'A grade of C or better in CS 150 or ENGN 150 or ENGN 122 and MATH 211',
      owner,
    )).toThrow();

    const capstone = 'A grade of C or better in ENGL 211C, ENGL 221C, or ENGL 231C; CS 350 or CS 352; CS 330; and CS 410';
    const capstoneGroup = formulaGroup({
      owner,
      courseKey: `${owner}:CS411W`,
      kind: 'prerequisite',
      raw: capstone,
      tokens: tokenizeOduStructuredFormula(capstone, owner),
    });
    expect(capstoneGroup.paths).toHaveLength(6);
    expect(capstoneGroup.paths.every((path) => path.all_of.length === 4)).toBe(true);

    const security = 'ECE 346 or ECE 443 or a grade of C or better in CS 361 and CS 170; a grade of C or better in ENGN 122 or CS 150 or CS 260';
    const securityGroup = formulaGroup({
      owner,
      courseKey: `${owner}:CS471`,
      kind: 'prerequisite',
      raw: security,
      tokens: tokenizeOduStructuredFormula(security, owner),
    });
    expect(securityGroup.paths).toHaveLength(9);
  });

  it('retains ODU open knowledge, experience, and prior-course conditions as typed atoms', () => {
    const owner = 'va:uni:9218';
    const cases = [
      ['knowledge of basic algebra', 'knowledge_of_basic_algebra'],
      ['A prior programming course', 'prior_programming_course'],
    ];
    for (const [raw, condition] of cases) {
      const group = formulaGroup({
        owner, courseKey: `${owner}:FIXTURE`, kind: 'prerequisite', raw,
        tokens: tokenizeOduStructuredFormula(raw, owner),
      });
      expect(group.paths[0].all_of[0]).toMatchObject({ type: 'non_course', condition });
    }

    const security = formulaGroup({
      owner, courseKey: `${owner}:CS469`, kind: 'prerequisite',
      raw: 'CS 462 or CS 455 or experience in cybersecurity',
      tokens: tokenizeOduStructuredFormula(
        'CS 462 or CS 455 or experience in cybersecurity', owner,
      ),
    });
    expect(security.paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'CS462' }),
      expect.objectContaining({ code: 'CS455' }),
      expect.objectContaining({
        type: 'non_course', condition: 'experience_in_cybersecurity',
      }),
    ]);

    const language = formulaGroup({
      owner, courseKey: `${owner}:CS486`, kind: 'prerequisite',
      raw: 'MATH 316; knowledge of a high level language',
      tokens: tokenizeOduStructuredFormula(
        'MATH 316; knowledge of a high level language', owner,
      ),
    });
    expect(language.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'MATH316' }),
      expect.objectContaining({
        type: 'non_course', condition: 'knowledge_of_a_high_level_language',
      }),
    ]);
  });

  it('binds Virginia Tech grades only through an exact complete-entry statement', () => {
    const owner = 'va:uni:9230';
    const raw = '(CS 2114 or ECE 3514) and (CS 2505 or ECE 2564) and (MATH 2534 or MATH 3034)';
    const gradeStatement = 'A grade of C or better is required in CS pre-requisite 2505 and 2114.';
    const sourceCandidate = {
      owner_namespace: owner,
      course_code: 'CS2506',
      source: { raw_entry_text: `Description. ${gradeStatement}Prerequisite(s): ${raw}` },
    };
    const group = formulaGroup({
      owner, courseKey: `${owner}:CS2506`, kind: 'prerequisite', raw,
      tokens: tokenizeVirginiaTechStrictFormula(sourceCandidate, { kind: 'prerequisite', raw }),
    });
    expect(group.paths).toHaveLength(8);
    for (const condition of group.paths.flatMap((path) => path.all_of)) {
      expect(condition.minimum_grade).toBe(
        ['CS2114', 'CS2505'].includes(condition.code) ? 'C' : undefined,
      );
      if (condition.minimum_grade) {
        expect(condition.minimum_grade_evidence).toMatchObject({
          kind: 'exact_full_entry_grade_statement',
          raw: gradeStatement,
        });
      }
    }
    expect(() => tokenizeVirginiaTechStrictFormula({
      ...sourceCandidate,
      source: { raw_entry_text: sourceCandidate.source.raw_entry_text.replace('2505 and 2114', '2505 or 2114') },
    }, { kind: 'prerequisite', raw })).toThrow(/grade statement/);
    expect(() => tokenizeVirginiaTechStrictFormula({
      ...sourceCandidate,
      course_code: 'CS3604',
    }, {
      kind: 'prerequisite',
      raw: 'CS 1944 and (CS 2114 or ECE 3514) and (COMM 2004 or COMM 2014)',
    })).toThrow(/clean-formula roster/);

    const analyticsRaw = '(CS 1114 or CS 1044 or CS 1054 or CS 1064) and (MATH 2204 or MATH 2204H or MATH 2406H or CMDA 2005) and (STAT 3006 or STAT 4105 or STAT 4705 or STAT 4714 or CMDA 2006)';
    expect(formulaGroup({
      owner, courseKey: `${owner}:CS3654`, kind: 'prerequisite', raw: analyticsRaw,
      tokens: tokenizeVirginiaTechStrictFormula({
        owner_namespace: owner,
        course_code: 'CS3654',
        source: { raw_entry_text: `Description.Prerequisite(s): ${analyticsRaw}` },
      }, { kind: 'prerequisite', raw: analyticsRaw }),
    }).paths).toHaveLength(80);

    const capstoneGrade = 'Pre: A grade of C or better in CS 3704.';
    const capstoneTokens = tokenizeVirginiaTechStrictFormula({
      owner_namespace: owner,
      course_code: 'CS4704',
      source: { raw_entry_text: `Description. ${capstoneGrade}Prerequisite(s): CS 3704 or CS 3714 or CS 3754` },
    }, { kind: 'prerequisite', raw: 'CS 3704 or CS 3714 or CS 3754' });
    expect(formulaGroup({
      owner, courseKey: `${owner}:CS4704`, kind: 'prerequisite', raw: 'fixture',
      tokens: capstoneTokens,
    }).paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'CS3704', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'CS3714' }),
      expect.objectContaining({ code: 'CS3754' }),
    ]);

    const closureGrade = 'Pre-requisite: Grade of C or better in CS 3114.';
    const closureTokens = tokenizeVirginiaTechStrictFormula({
      owner_namespace: owner,
      course_code: 'CS3824',
      source: { raw_entry_text: `Description. ${closureGrade}Prerequisite(s): CS 3114` },
    }, { kind: 'prerequisite', raw: 'CS 3114' });
    expect(closureTokens.find((token) => token.type === 'atom').condition).toMatchObject({
      code: 'CS3114',
      minimum_grade: 'C',
      minimum_grade_evidence: {
        kind: 'exact_full_entry_grade_statement',
        raw: closureGrade,
      },
    });
    expect(() => tokenizeVirginiaTechStrictFormula({
      owner_namespace: owner,
      course_code: 'CS3824',
      source: { raw_entry_text: 'Prerequisite(s): CS 3114' },
    }, { kind: 'prerequisite', raw: 'CS 3114' })).toThrow(/grade statement/);

    for (const [courseCode, exactGradeStatement] of [
      ['CS3714', 'A grade of C or better required in CS prerequisite.'],
      ['CS3754', 'A grade of C or better is required in prerequisite.'],
    ]) {
      const closureRaw = 'CS 2114 or ECE 3514';
      const closureCandidate = {
        owner_namespace: owner,
        course_code: courseCode,
        source: {
          raw_entry_text: `Description. ${exactGradeStatement}Prerequisite(s): ${closureRaw}`,
        },
      };
      const conditions = tokenizeVirginiaTechStrictFormula(
        closureCandidate, { kind: 'prerequisite', raw: closureRaw },
      ).filter((token) => token.type === 'atom').map((token) => token.condition);
      expect(conditions).toEqual([
        expect.objectContaining({ code: 'CS2114', minimum_grade: 'C' }),
        expect.objectContaining({ code: 'ECE3514', minimum_grade: 'C' }),
      ]);
      expect(() => tokenizeVirginiaTechStrictFormula({
        ...closureCandidate,
        source: {
          raw_entry_text: closureCandidate.source.raw_entry_text.replace('grade of C', 'grade of B'),
        },
      }, { kind: 'prerequisite', raw: closureRaw })).toThrow(/grade statement/);
    }
  });

  it('parses only the pinned JMU browser field and rejects a fully rehashed near-match', () => {
    const field = 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam. You may only attempt CS 149 two times.';
    const html = `<div class="courseblock"><div><strong>CS 149</strong> Intro</div><span class="detail-hours_html"><strong>Credits</strong> 3</span><div class="courseblockdesc">Enrollment is limited twice.</div><div class="courseblockextra">Prerequisites: ${field}</div></div>`;
    const entry = extractCourseLeafEntries(html, ['CS149']).entries[0];
    const row = candidate(entry.raw_entry_text, {
      school_id: 9213,
      slug: 'james-madison-university',
      owner_namespace: 'va:uni:9213',
      course_key: 'va:uni:9213:CS149',
      course_code: 'CS149',
      source: {
        browser_challenge_contract:
          'known_courseleaf_host_exact_same_url_document_202_then_200_raw_response_v1',
        boundary_contract: COURSELEAF_BOUNDARY_CONTRACT,
        official_url: 'https://catalog.jmu.edu/courses/cs/',
        character_start: 0,
        character_end: entry.raw_entry_text.length,
        heading_text: 'CS 149 Intro',
        raw_entry_sha256: entry.raw_entry_sha256,
        raw_entry_text: entry.raw_entry_text,
        structured_requisite_fields: entry.structured_requisite_fields,
      },
    });
    expect(exactBrowserCourseLeafRequiredClauses(row)).toMatchObject({
      clauses: [expect.objectContaining({
        raw: 'MATH 155, MATH 156 or sufficient score on the Mathematics Placement Exam.',
      })],
      ignored: [expect.objectContaining({
        kind: 'exact_attempt_limit_outside_required_prerequisite_formula',
        raw: 'You may only attempt CS 149 two times.',
      })],
    });
    const reviewed = reviewCandidate(row);
    expect(reviewed).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({
        flags: expect.arrayContaining([
          'jmu_pinned_browser_courseleaf_formula_grammar',
          'jmu_exact_grade_major_placement_scope',
        ]),
      })],
    });
    expect(reviewed.groups[0].paths).toHaveLength(3);
    expect(reviewed.groups[0].paths[2].all_of[0]).toMatchObject({
      type: 'non_course',
      condition: 'sufficient_jmu_mathematics_placement_exam_score',
    });

    const tampered = structuredClone(row);
    tampered.source.raw_entry_text = tampered.source.raw_entry_text.replace('MATH 155', 'MATH 157');
    tampered.source.raw_entry_sha256 = require('node:crypto').createHash('sha256')
      .update(tampered.source.raw_entry_text).digest('hex');
    const receipt = tampered.source.structured_requisite_fields[0];
    receipt.raw_field_text = receipt.raw_field_text.replace('MATH 155', 'MATH 157');
    receipt.raw_field_text_sha256 = require('node:crypto').createHash('sha256')
      .update(receipt.raw_field_text).digest('hex');
    receipt.raw = receipt.raw.replace('MATH 155', 'MATH 157');
    receipt.raw_sha256 = require('node:crypto').createHash('sha256')
      .update(receipt.raw).digest('hex');
    expect(reviewCandidate(tampered)).toMatchObject({
      status: 'unparsed',
      review_reason: 'no_explicit_required_requisite_statement',
    });

    const majorTokens = tokenizeJmuBrowserStrictFormula({
      owner_namespace: 'va:uni:9213',
    }, {
      raw: 'Fully admitted Computer Science majors or minors only and a minimum grade of "C-" in CS 240 and CS 261.',
    });
    const majorGroup = formulaGroup({
      owner: 'va:uni:9213', courseKey: 'va:uni:9213:CS430',
      kind: 'prerequisite', raw: 'fixture', tokens: majorTokens,
    });
    expect(majorGroup.paths[0].all_of).toEqual([
      expect.objectContaining({
        type: 'non_course', condition: 'fully_admitted_computer_science_major_or_minor',
      }),
      expect.objectContaining({ code: 'CS240', minimum_grade: 'C-' }),
      expect.objectContaining({ code: 'CS261', minimum_grade: 'C-' }),
    ]);
  });

  it('accepts only fully grouped VT browser fields and blocks external prerequisite prose', () => {
    const sourceCandidate = {
      owner_namespace: 'va:uni:9230',
      source: {
        raw_entry_text: 'AOE 4434 description.Prerequisite(s): MATH 2214 Corequisite(s): AOE 3044 or ME 3404',
        structured_requisite_fields: [{ statement_relative_start: 21 }],
      },
    };
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(sourceCandidate, {
      raw: '(CEM 2104 or BC 2024) and (BC 2114 or CEE 3804)',
    })).not.toThrow();
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(sourceCandidate, {
      raw: 'CS 1044 and MATH 2406H or CMDA 2005',
    })).toThrow(/mixed ungrouped/);
    const withExternalGrade = structuredClone(sourceCandidate);
    withExternalGrade.source.raw_entry_text = 'A grade of C or better is required in prerequisites.Prerequisite(s): ECE 3504';
    withExternalGrade.source.structured_requisite_fields[0].statement_relative_start = 54;
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(withExternalGrade, {
      raw: 'ECE 3504',
    })).toThrow(/additional prerequisite condition/);
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(sourceCandidate, {
      raw: 'MATH 2214 or permission of instructor',
    })).toThrow(/course-only/);

    const exactCandidate = (courseCode, before, raw) => ({
      owner_namespace: 'va:uni:9230',
      course_code: courseCode,
      source: {
        raw_entry_text: `${before}Prerequisite(s): ${raw}`,
        structured_requisite_fields: [{ statement_relative_start: before.length }],
      },
    });
    const eceStatement = 'A grade of C or better required in prerequisites.';
    const eceRaw = 'ECE 3504 or CS 3214';
    const eceTokens = tokenizeVirginiaTechBrowserStrictFormula(
      exactCandidate('ECE4504', eceStatement, eceRaw),
      { kind: 'prerequisite', raw: eceRaw },
    );
    expect(eceTokens.filter((token) => token.type === 'atom').map((token) => (
      token.condition
    ))).toEqual([
      expect.objectContaining({ code: 'ECE3504', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'CS3214', minimum_grade: 'C' }),
    ]);

    const chemStatement = 'Students may bypass prerequisites for 1035 through testing alternatives listed in the Registrar’s Timetable.';
    const chemRaw = 'CHEM 1014 or MATH 1014';
    expect(formulaGroup({
      owner: 'va:uni:9230', courseKey: 'va:uni:9230:CHEM1035',
      kind: 'prerequisite', raw: chemRaw,
      tokens: tokenizeVirginiaTechBrowserStrictFormula(
        exactCandidate('CHEM1035', chemStatement,
          'CHEM 1014 or MATH 1014 or MATH 1025 or MATH 1536 or MATH 1225 or MATH 1214 or MATH 1524'),
        { kind: 'prerequisite', raw: 'CHEM 1014 or MATH 1014 or MATH 1025 or MATH 1536 or MATH 1225 or MATH 1214 or MATH 1524' },
      ),
    }).paths.at(-1).all_of[0]).toMatchObject({
      type: 'non_course',
      condition: 'registrar_timetable_testing_alternative_for_chem_1035',
      bypasses_course_prerequisites: true,
    });
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(
      exactCandidate('ECE4504', eceStatement.replace('C', 'B'), eceRaw),
      { kind: 'prerequisite', raw: eceRaw },
    )).toThrow(/absent|additional prerequisite/i);

    const circuitsCandidate = exactCandidate(
      'ECE2024', 'Description.',
      'ECE 1004 and (MATH 2114 or MATH 2114H or MATH 2405H)',
    );
    const circuitsCorequisite = tokenizeVirginiaTechBrowserStrictFormula(
      circuitsCandidate, { kind: 'corequisite', raw: 'MATH 2214, PHYS 2306' },
    );
    expect(formulaGroup({
      owner: 'va:uni:9230', courseKey: 'va:uni:9230:ECE2024',
      kind: 'corequisite', raw: 'MATH 2214, PHYS 2306', tokens: circuitsCorequisite,
    }).paths[0].all_of.map((condition) => condition.code)).toEqual(['MATH2214', 'PHYS2306']);
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(
      circuitsCandidate, { kind: 'corequisite', raw: 'MATH 2214 and PHYS 2306' },
    )).toThrow(/exact course-specific field contract/);

    const math1225Context = 'Assumes 2 units of high school algebra, 1 unit of geometry, 1/2 unit each of trigonometry and precalculus, and placement by Math Dept.';
    const math1226Grade = 'Pre: Grade of at least C- in 1225 for 1226.';
    const math1226Candidate = exactCandidate(
      'MATH1226', `${math1225Context}${math1226Grade}`, 'MATH 1225',
    );
    expect(tokenizeVirginiaTechBrowserStrictFormula(
      math1226Candidate, { kind: 'prerequisite', raw: 'MATH 1225' },
    ).find((token) => token.type === 'atom').condition).toMatchObject({
      code: 'MATH1225',
      minimum_grade: 'C-',
      minimum_grade_evidence: { raw: math1226Grade },
    });
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(
      exactCandidate(
        'MATH1226', `${math1225Context.replace('2 units', 'two units')}${math1226Grade}`,
        'MATH 1225',
      ),
      { kind: 'prerequisite', raw: 'MATH 1225' },
    )).toThrow(/sibling-course|additional prerequisite/i);

    const cee3014Text = 'CEE 3014 - Construction Management (3 credits) Introduction to the fundamental elements involved in managing construction projects. Project lifecycle, delivery methods and contracts, equipment and labor productivity, scheduling, and cost estimating and control. Pre: Junior standingInstructional Contact Hours: (3 Lec, 3 Crd)';
    const cee3014 = {
      owner_namespace: 'va:uni:9230',
      course_code: 'CEE3014',
      source: {
        raw_entry_text: cee3014Text,
        raw_entry_sha256: require('node:crypto').createHash('sha256')
          .update(cee3014Text).digest('hex'),
        structured_requisite_fields: [],
      },
    };
    expect(formulaGroup({
      owner: cee3014.owner_namespace,
      courseKey: 'va:uni:9230:CEE3014',
      kind: 'prerequisite',
      raw: 'Junior standing',
      tokens: tokenizeVirginiaTechBrowserStrictFormula(
        cee3014, { kind: 'prerequisite', raw: 'Junior standing' },
      ),
    }).paths[0].all_of).toEqual([expect.objectContaining({
      type: 'non_course',
      condition: 'junior_standing_or_higher',
      minimum_class_standing: 'junior',
      outside_entry_requirement_evidence: {
        kind: 'exact_full_entry_requirement_statement',
        raw: 'Pre: Junior standing',
        raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
    })]);
    const changedCee3014 = structuredClone(cee3014);
    changedCee3014.source.raw_entry_text = cee3014Text.replace('Junior', 'Senior');
    expect(() => tokenizeVirginiaTechBrowserStrictFormula(
      changedCee3014, { kind: 'prerequisite', raw: 'Junior standing' },
    )).toThrow(/entry hash changed/);
  });

  it('accounts for UVA Wise atom-local grades and standing without broad prose inference', () => {
    const owner = 'va:uni:9226';
    const raw = 'CSC 2180 with a C or better and MTH 2040 and senior standing';
    const group = formulaGroup({
      owner, courseKey: `${owner}:CSC4200`, kind: 'prerequisite', raw,
      tokens: tokenizeUvaWiseStrictFormula(raw, owner),
    });
    expect(group.paths).toEqual([expect.objectContaining({ all_of: [
      expect.objectContaining({ code: 'CSC2180', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'MTH2040' }),
      expect.objectContaining({
        type: 'non_course',
        condition: 'senior_standing_or_higher',
        minimum_class_standing: 'senior',
      }),
    ] })]);
    expect(group.paths[0].all_of[1]).not.toHaveProperty('minimum_grade');
    expect(formulaGroup({
      owner, courseKey: `${owner}:CSC1180`, kind: 'prerequisite',
      raw: 'CSC 1010 with a C or better and MTH 1010',
      tokens: tokenizeUvaWiseStrictFormula(
        'CSC 1010 with a C or better and MTH 1010', owner,
      ),
    }).paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CSC1010', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'MTH1010' }),
    ]);
    expect(() => tokenizeUvaWiseStrictFormula(
      'CSC 2180 or permission of instructor', owner,
    )).toThrow(/unaccounted UVA Wise/);
    expect(tokenizeUvaWiseStrictFormula(
      'Permission of instructor', owner,
    )[0].condition).toMatchObject({
      type: 'non_course',
      condition: 'permission_of_instructor',
      authorization_kind: 'permission',
      authorization_authority: 'instructor',
    });
    expect(() => tokenizeUvaWiseStrictFormula(
      'CSC 1180 and MTH 1110 with a C or better', owner,
    )).toThrow(/ambiguous conjunction scope/);
    expect(() => tokenizeUvaWiseStrictFormula(
      'CSC 1180 or CSC 2180 and MTH 2040', owner,
    )).toThrow(/no explicit grouping/);
    expect(() => tokenizeUvaWiseStrictFormula(
      'CSC 2180, MTH 2040', owner,
    )).toThrow(/unaccounted UVA Wise/);
  });

  it('parses Shenandoah only as an explicit OR of explicit AND paths', () => {
    const owner = 'va:uni:9224';
    const graded = formulaGroup({
      owner, courseKey: `${owner}:CSC122`, kind: 'prerequisite',
      raw: 'Earned grade of “C-” or better in CSC-121',
      tokens: tokenizeShenandoahStrictFormula(
        'Earned grade of “C-” or better in CSC-121', owner,
      ),
    });
    expect(graded.paths).toEqual([expect.objectContaining({ all_of: [expect.objectContaining({
      code: 'CSC121', minimum_grade: 'C-',
    })] })]);

    const groupedRaw = '(CSC 121 and MATH 201) or CSC 122';
    const grouped = formulaGroup({
      owner, courseKey: `${owner}:CSC210`, kind: 'prerequisite', raw: groupedRaw,
      tokens: tokenizeShenandoahStrictFormula(groupedRaw, owner),
    });
    expect(grouped.paths).toEqual([
      expect.objectContaining({ all_of: [
        expect.objectContaining({ code: 'CSC121' }),
        expect.objectContaining({ code: 'MATH201' }),
      ] }),
      expect.objectContaining({ all_of: [expect.objectContaining({ code: 'CSC122' })] }),
    ]);
    const placementRaw = 'Math 101 or assignment through the Math Placement Test.';
    const placement = formulaGroup({
      owner, courseKey: `${owner}:MATH102`, kind: 'prerequisite', raw: placementRaw,
      tokens: tokenizeShenandoahStrictFormula(placementRaw, owner),
    });
    expect(placement.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'course', code: 'MATH101', course_key: `${owner}:MATH101`,
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course',
        condition: 'assignment_through_math_placement_test',
        assessment_kind: 'placement_test',
        placement_test: 'Math Placement Test',
        placement_assignment_required: true,
      })] }),
    ]);
    expect(() => tokenizeShenandoahStrictFormula(
      'Math 101 or recommendation through the Math Placement Test.', owner,
    )).toThrow(/unaccounted|invalid/i);
    expect(() => tokenizeShenandoahStrictFormula(
      'CSC 121 and MATH 201 or CSC 122', owner,
    )).toThrow(/no explicit grouping/);
    expect(() => tokenizeShenandoahStrictFormula(
      'CSC 121, MATH 201 or CSC 122', owner,
    )).toThrow(/punctuation cannot imply/);
    expect(() => tokenizeShenandoahStrictFormula(
      'Earned C- or better grade in CSC-121', owner,
    )).toThrow(/unaccounted|invalid/i);
    expect(() => tokenizeShenandoahStrictFormula(
      'CSC 121 or permission of instructor', owner,
    )).toThrow(/unaccounted|invalid/i);
  });

  it('models ODU placement, open course floors, standing, and authorization atoms exactly', () => {
    const owner = 'va:uni:9218';
    const placement = formulaGroup({
      owner, courseKey: `${owner}:BIOL121N`, kind: 'prerequisite',
      raw: 'Writing Success Placement Tool (WSPT) Score of 3 or ENGL 110C',
      tokens: tokenizeOduStructuredFormula(
        'Writing Success Placement Tool (WSPT) Score of 3 or ENGL 110C', owner,
      ),
    });
    expect(placement.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', minimum_score: 3,
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({ code: 'ENGL110C' })] }),
    ]);

    const concurrent = formulaGroup({
      owner, courseKey: `${owner}:BIOL121N`, kind: 'prerequisite',
      raw: 'BIOL 122N and MATH 102M or higher',
      tokens: tokenizeOduStructuredFormula('BIOL 122N and MATH 102M or higher', owner)
        .map((token) => token.type === 'atom'
          ? { ...token, condition: { ...token.condition, concurrent_allowed: true } }
          : token),
    });
    expect(concurrent.paths).toHaveLength(2);
    expect(concurrent.paths[1].all_of).toEqual([
      expect.objectContaining({ code: 'BIOL122N', concurrent_allowed: true }),
      expect.objectContaining({
        type: 'non_course', exclusive_course_floor: 'MATH102M',
        represents_course_choice: true, concurrent_allowed: true,
      }),
    ]);

    const standing = formulaGroup({
      owner, courseKey: `${owner}:CS315`, kind: 'prerequisite',
      raw: 'Junior/senior standing as a computer science major; and a grade of C or better in any of: CS 150, CS 151, DASC 257',
      tokens: tokenizeOduStructuredFormula(
        'Junior/senior standing as a computer science major; and a grade of C or better in any of: CS 150, CS 151, DASC 257',
        owner,
      ),
    });
    expect(standing.paths).toHaveLength(3);
    expect(standing.paths.every((path) => (
      path.all_of[0].minimum_class_standing === 'junior'
        && path.all_of[1].minimum_grade === 'C'
    ))).toBe(true);
    expect(tokenizeOduStructuredFormula('Instructor permission required', owner)[0].condition)
      .toMatchObject({ type: 'non_course', authorization_authority: 'instructor' });
  });

  it('models every pinned ODU retained mixed clause without dropping grade or enrollment scope', () => {
    const owner = 'va:uni:9218';
    const group = (course, raw) => formulaGroup({
      owner, courseKey: `${owner}:${course}`, kind: 'prerequisite', raw,
      tokens: tokenizeOduStructuredFormula(raw, owner),
    });

    const biology = 'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, or completion of MATH 102M or higher, and BIOL 121N passed with a grade of C (2.0) or higher';
    const biologyGroup = group('BIOL123N', biology);
    expect(biologyGroup.paths).toHaveLength(4);
    expect(biologyGroup.paths.every((path) => (
      path.all_of.some((row) => row.condition === 'placement_into_engl110c')
      && path.all_of.some((row) => (
        row.code === 'BIOL121N' && row.minimum_grade === 'C'
          && row.minimum_grade_points === 2
      ))
    ))).toBe(true);
    expect(biologyGroup.paths.flatMap((path) => path.all_of)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ condition: 'qualifying_math_sat_or_act_score' }),
        expect.objectContaining({ condition: 'qualifying_math_placement_test_score' }),
        expect.objectContaining({ code: 'MATH102M', completion_required: true }),
        expect.objectContaining({
          exclusive_course_floor: 'MATH102M', completion_required: true,
        }),
      ]),
    );

    const honors = 'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, and enrollment in the Honors College';
    const honorsGroup = group('BIOL136N', honors);
    expect(honorsGroup.paths).toHaveLength(2);
    expect(honorsGroup.paths.every((path) => path.all_of.some((row) => (
      row.condition === 'enrollment_in_honors_college'
        && row.required_college === 'Honors College'
    )))).toBe(true);

    const honorsSequence = 'Placement into ENGL 110C and qualifying Math SAT/ACT score, or qualifying score on the Math placement test, or completion of MATH 102M or higher, enrollment in the Honors College, and BIOL 136N';
    const honorsSequenceGroup = group('BIOL138N', honorsSequence);
    expect(honorsSequenceGroup.paths).toHaveLength(4);
    expect(honorsSequenceGroup.paths.every((path) => (
      path.all_of.some((row) => row.condition === 'placement_into_engl110c')
      && path.all_of.some((row) => row.condition === 'enrollment_in_honors_college')
      && path.all_of.some((row) => row.code === 'BIOL136N')
    ))).toBe(true);

    const chemistry = 'MATH 102M or MATH 103M or higher with a grade of C or better';
    const chemistryGroup = group('CHEM121N', chemistry);
    expect(chemistryGroup.paths).toHaveLength(3);
    expect(chemistryGroup.paths.every((path) => (
      path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);
    expect(chemistryGroup.paths[2].all_of[0]).toMatchObject({
      type: 'non_course', exclusive_course_floor: 'MATH103M',
      represents_course_choice: true,
    });

    for (const raw of [
      'PHYS 231N or PHYS 226N or PHYS 261N with a grade of C or better, and both MATH 211 and MATH 212 each with a grade of C or better',
      'PHYS 231N or PHYS 226N or PHYS 261N with a grade of C or better, and both MATH 211 and MATH 212 with each a grade of C or better',
    ]) {
      const physics = group('PHYS232N', raw);
      expect(physics.paths).toHaveLength(3);
      expect(physics.paths.every((path) => (
        path.all_of.length === 3
        && path.all_of.every((row) => row.minimum_grade === 'C')
        && path.all_of.some((row) => row.code === 'MATH211')
        && path.all_of.some((row) => row.code === 'MATH212')
      ))).toBe(true);
    }

    const mutations = [
      biology.replace(', and BIOL 121N', ', or BIOL 121N'),
      honors.replace('enrollment in', 'membership in'),
      honorsSequence.replace(', enrollment in', ', or enrollment in'),
      chemistry.replace('grade of C', 'grade of D'),
      'PHYS 231N or PHYS 226N or PHYS 261N with a grade of C or better, and either MATH 211 or MATH 212 each with a grade of C or better',
    ];
    for (const mutated of mutations) {
      expect(() => tokenizeOduStructuredFormula(mutated, owner)).toThrow();
    }
  });

  it('retains ODU optional internship support with exact offsets while parsing required approval', () => {
    const raw = 'CS 367 Internship. Prerequisites: Approval by department is required; Additional support may be provided by the Monarch Internship and Co-Op Office in the semester prior to enrollment';
    const reviewed = reviewCandidate(candidate(raw, {
      slug: 'old-dominion-university',
      owner_namespace: 'va:uni:9218',
      course_key: 'va:uni:9218:CS367',
      course_code: 'CS367',
    }));
    expect(reviewed).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({
        all_of: [expect.objectContaining({ condition: 'department_approval_required' })],
      })] })],
      ignored_nonrequired_requisites: [expect.objectContaining({
        kind: 'explicit_optional_support_suffix_not_modeled',
        raw: 'Additional support may be provided by the Monarch Internship and Co-Op Office in the semester prior to enrollment',
      })],
    });
    const ignored = reviewed.ignored_nonrequired_requisites[0];
    expect(raw.slice(ignored.source_character_start - 100, ignored.source_character_end - 100))
      .toBe(ignored.raw);
  });

  it('models RMC senior status and approval without accepting its ambiguous mixed course list', () => {
    const owner = 'va:uni:9221';
    const group = formulaGroup({
      owner, courseKey: `${owner}:CSCI485`, kind: 'prerequisite',
      raw: 'Senior status and departmental approval',
      tokens: tokenizeRmcStructuredFormula('Senior status and departmental approval', owner),
    });
    expect(group.paths[0].all_of).toEqual([
      expect.objectContaining({ condition: 'senior_status' }),
      expect.objectContaining({ condition: 'departmental_approval' }),
    ]);
    expect(() => tokenizeRmcStructuredFormula(
      'MATH 220 or CSCI 210 AND CSCI 212 or CSCI 213', owner,
    )).toThrow();
  });

  it('honors literal either and one-of grouping', () => {
    const owner = 'va:uni:9221';
    const group = formulaGroup({
      owner,
      courseKey: `${owner}:CSEC323`,
      kind: 'prerequisite',
      raw: 'CSEC 222 and either CSCI 212 or CSCI 213',
      tokens: tokenizeExplicitChoiceFormula(
        'CSEC 222 and either CSCI 212 or CSCI 213', owner,
      ),
    });
    expect(group.paths.map((path) => path.all_of.map((row) => row.code))).toEqual([
      ['CSEC222', 'CSCI212'],
      ['CSEC222', 'CSCI213'],
    ]);
  });

  it('accounts for VSU catalog titles only when no condition language is hidden', () => {
    const owner = 'va:uni:9231';
    const raw = 'CSCI 250 Programming II and CSCI 251 Programming II Lab';
    const group = formulaGroup({
      owner,
      courseKey: `${owner}:CSCI303`,
      kind: 'prerequisite',
      raw,
      tokens: tokenizeVsuTitledFormula(raw, owner),
    });
    expect(group.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CSCI250', catalog_title_text: 'Programming II' }),
      expect.objectContaining({ code: 'CSCI251', catalog_title_text: 'Programming II Lab' }),
    ]);
    expect(() => tokenizeVsuTitledFormula(
      'CSCI 250 Programming II or equivalent', owner,
    )).toThrow(/condition language/i);
    expect(() => tokenizeVsuTitledFormula(
      'ENGL 110 Composition I or ENGL 112 Honors and ENGL 111 Composition II', owner,
    )).toThrow(/mixed ungrouped/i);
  });

  it('accepts an NSU Take continuation and atom-local VCU grades', () => {
    const nsu = tokenizeNsuTake('Take CSC-292. Take CSC-372. CSC-420.', 'va:uni:9217');
    expect(nsu.filter((row) => row.type === 'atom').map((row) => row.condition.code))
      .toEqual(['CSC292', 'CSC372', 'CSC420']);
    const vcu = formulaGroup({
      owner: 'va:uni:9229',
      courseKey: 'va:uni:9229:ECON211',
      kind: 'prerequisite',
      raw: 'ECON 203 with a minimum grade of B, ECON 205 with a minimum grade of B or ECON 210',
      tokens: tokenizeVcuStructuredFormula(
        'ECON 203 with a minimum grade of B, ECON 205 with a minimum grade of B or ECON 210',
        'va:uni:9229',
      ),
    });
    expect(vcu.paths.map((path) => path.all_of[0].minimum_grade || null)).toEqual(['B', 'B', null]);
  });

  it('preserves VCU semicolon groups, placement windows, grades, and equivalents', () => {
    const owner = 'va:uni:9229';
    const raw = 'MATH 139, MATH 141, MATH 151, MATH 200, MATH 201 or a satisfactory score on the math placement exam; and CHEM 100 with a minimum grade of B, CHEM 101 with a minimum grade of C or a satisfactory score on the chemistry placement exam';
    const generalBiology = formulaGroup({
      owner, courseKey: `${owner}:BIOL151`, kind: 'prerequisite', raw,
      tokens: tokenizeVcuStructuredFormula(raw, owner),
    });
    expect(generalBiology.paths).toHaveLength(18);
    expect(generalBiology.paths.some((path) => path.all_of.every((condition) => (
      condition.type === 'non_course'
    )))).toBe(true);
    expect(generalBiology.paths.some((path) => (
      path.all_of.some((condition) => condition.code === 'MATH139')
        && path.all_of.some((condition) => (
          condition.code === 'CHEM100' && condition.minimum_grade === 'B'
        ))
    ))).toBe(true);

    const writing = 'CMSC 355, 357 and 401 each with a minimum grade of C; and UNIV 200 or HONR 200 or equivalent, with minimum grades of C';
    const capstone = formulaGroup({
      owner, courseKey: `${owner}:CMSC441`, kind: 'prerequisite', raw: writing,
      tokens: tokenizeVcuStructuredFormula(writing, owner),
    });
    expect(capstone.paths).toHaveLength(3);
    expect(capstone.paths.every((path) => (
      path.all_of.length === 4
        && path.all_of.every((condition) => condition.minimum_grade === 'C')
    ))).toBe(true);
  });

  it('preserves the exact VCU OR-of-AND routes, atom-local/shared grades, placements, permission, and equivalence', () => {
    const owner = 'va:uni:9229';
    const parse = (code, raw) => formulaGroup({
      owner, courseKey: `${owner}:${code}`, kind: 'prerequisite', raw,
      tokens: tokenizeVcuStructuredFormula(raw, owner),
    });
    const identities = (group) => group.paths.map((path) => (
      path.all_of.map((condition) => condition.code || condition.condition)
    ));

    const cmsc255Raw = 'BNFO 201, CLSE 115, CMSC 210, CMSC 254, EGRB 215 or INFO 202 with a minimum grade of C';
    const cmsc255 = parse('CMSC255', cmsc255Raw);
    expect(identities(cmsc255)).toEqual([
      ['BNFO201'], ['CLSE115'], ['CMSC210'], ['CMSC254'], ['EGRB215'], ['INFO202'],
    ]);
    expect(cmsc255.raw).toBe(cmsc255Raw);
    expect(cmsc255.paths.map((path) => path.all_of[0].minimum_grade || null))
      .toEqual([null, null, null, null, null, 'C']);
    expect(cmsc255.paths[5].all_of[0].catalog_grade_scope)
      .toBe('atom_local_trailing_minimum_grade_phrase');

    const cmsc256 = parse(
      'CMSC256',
      'CMSC 255 or EGRE 246 with a minimum grade of C, and either MATH 151, MATH 200 or MATH 201, with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course',
    );
    expect(identities(cmsc256)).toEqual([
      ['CMSC255', 'MATH151'],
      ['CMSC255', 'MATH200'],
      ['CMSC255', 'MATH201'],
      ['CMSC255', 'recent_calculus_level_vcu_mathematics_placement'],
      ['EGRE246', 'MATH151'],
      ['EGRE246', 'MATH200'],
      ['EGRE246', 'MATH201'],
      ['EGRE246', 'recent_calculus_level_vcu_mathematics_placement'],
    ]);
    const cmsc256Placement = cmsc256.paths[3].all_of[1];
    expect(cmsc256Placement).toMatchObject({
      type: 'non_course', minimum_placement_level: 'calculus', maximum_age_years: 1,
      recency_measured_before: 'enrollment in the course',
      raw: expect.stringContaining('one-year period'),
    });
    expect(cmsc256.paths.slice(0, 4).every((path) => (
      path.all_of[0].minimum_grade == null
    ))).toBe(true);
    expect(cmsc256.paths.slice(4).every((path) => (
      path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);
    expect(cmsc256.paths.filter((path) => path.all_of[1].type === 'course')
      .every((path) => path.all_of[1].minimum_grade === 'C')).toBe(true);

    const cmsc302 = parse(
      'CMSC302',
      'CMSC 255, EGRE 246, or ENGR 261 with a minimum grade of C, and either MATH 151, MATH 200, or MATH 201, each with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course',
    );
    expect(cmsc302.paths).toHaveLength(12);
    expect(identities(cmsc302)).toEqual([
      ['CMSC255', 'MATH151'],
      ['CMSC255', 'MATH200'],
      ['CMSC255', 'MATH201'],
      ['CMSC255', 'recent_calculus_level_vcu_mathematics_placement'],
      ['EGRE246', 'MATH151'],
      ['EGRE246', 'MATH200'],
      ['EGRE246', 'MATH201'],
      ['EGRE246', 'recent_calculus_level_vcu_mathematics_placement'],
      ['ENGR261', 'MATH151'],
      ['ENGR261', 'MATH200'],
      ['ENGR261', 'MATH201'],
      ['ENGR261', 'recent_calculus_level_vcu_mathematics_placement'],
    ]);
    expect(cmsc302.paths.slice(0, 8).every((path) => (
      path.all_of[0].minimum_grade == null
    ))).toBe(true);
    expect(cmsc302.paths.slice(8).every((path) => (
      path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);
    expect(cmsc302.paths.filter((path) => path.all_of[1].type === 'course')
      .every((path) => path.all_of[1].minimum_grade === 'C')).toBe(true);

    const cmsc303 = parse(
      'CMSC303', 'CMSC 302 or the equivalent with a grade of C or better',
    );
    expect(cmsc303.paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'CMSC302' }),
      expect.objectContaining({
        type: 'non_course', condition: 'equivalent_to_cmsc_302',
        equivalent_to_course_code: 'CMSC302', minimum_grade: 'C', raw: 'the equivalent',
      }),
    ]);
    expect(cmsc303.paths[0].all_of[0].minimum_grade).toBeUndefined();

    const cmsc405 = parse(
      'CMSC405',
      'CMSC 311 and CMSC 357 or EGRE 364 and EGRE 347, each with a minimum grade of C',
    );
    expect(identities(cmsc405)).toEqual([
      ['CMSC311', 'CMSC357'],
      ['EGRE364', 'EGRE347'],
    ]);
    expect(cmsc405.paths.flatMap((path) => path.all_of).every((condition) => (
      condition.minimum_grade === 'C'
        && condition.catalog_grade_scope === 'explicit_each_over_complete_or_of_and_formula'
    ))).toBe(true);

    const cmsc436 = parse(
      'CMSC436',
      'CMSC 210 or CMSC 254 with a minimum grade of C and MATH 310 or MATH 370 with a minimum grade of C',
    );
    expect(identities(cmsc436)).toEqual([
      ['CMSC210', 'MATH310'], ['CMSC210', 'MATH370'],
      ['CMSC254', 'MATH310'], ['CMSC254', 'MATH370'],
    ]);
    expect(cmsc436.paths.map((path) => path.all_of.map((condition) => (
      condition.minimum_grade || null
    )))).toEqual([
      [null, null], [null, 'C'], ['C', null], ['C', 'C'],
    ]);

    const cmsc438 = parse(
      'CMSC438',
      'CMSC 357 with a minimum grade of C or by permission of the instructor and MATH 310 or MATH 370 with a minimum grade of C',
    );
    expect(identities(cmsc438)).toEqual([
      ['CMSC357', 'MATH310'], ['CMSC357', 'MATH370'],
      ['permission_of_instructor', 'MATH310'],
      ['permission_of_instructor', 'MATH370'],
    ]);
    const permission = cmsc438.paths[2].all_of[0];
    expect(permission).toMatchObject({
      type: 'non_course', raw: 'by permission of the instructor',
      authorization_kind: 'permission', authorization_authority: 'instructor',
    });
    expect(cmsc438.paths.map((path) => path.all_of.map((condition) => (
      condition.minimum_grade || null
    )))).toEqual([
      ['C', null], ['C', 'C'], [null, null], [null, 'C'],
    ]);

    const univ200 = parse('UNIV200', 'UNIV 111 or HONR 250 with a minimum grade of C');
    expect(univ200.paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'UNIV111' }),
      expect.objectContaining({ code: 'HONR250', minimum_grade: 'C' }),
    ]);
    expect(univ200.paths[0].all_of[0].minimum_grade).toBeUndefined();

    const math151 = parse(
      'MATH151',
      'MATH 139 or MATH 141 with a minimum grade of C, or satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
    );
    expect(identities(math151)).toEqual([
      ['MATH139'], ['MATH141'],
      ['recent_satisfactory_vcu_mathematics_placement_test_score'],
    ]);
    expect(math151.paths.slice(0, 2).map((path) => (
      path.all_of[0].minimum_grade || null
    ))).toEqual([null, 'C']);
    expect(math151.paths[2].all_of[0]).toMatchObject({
      satisfactory_score_required: true, maximum_age_years: 1,
      recency_measured_before: 'the beginning of the course',
    });

    const math310 = parse(
      'MATH310',
      'MATH 139, MATH 141, MATH 151, MATH 200 or MATH 201 with a minimum grade of C or a score on the VCU Mathematics Placement Test sufficiently high to place into MATH 151 or higher',
    );
    expect(identities(math310)).toEqual([
      ['MATH139'], ['MATH141'], ['MATH151'], ['MATH200'], ['MATH201'],
      ['vcu_mathematics_placement_into_math_151_or_higher'],
    ]);
    expect(math310.paths.slice(0, 5).map((path) => (
      path.all_of[0].minimum_grade || null
    ))).toEqual([null, null, null, null, 'C']);
    expect(math310.paths[5].all_of[0]).toMatchObject({
      type: 'non_course', placement_test: 'VCU Mathematics Placement Test',
      placement_course_code: 'MATH151', inclusive_course_floor: 'MATH151',
      represents_course_choice: true,
      raw: expect.stringContaining('sufficiently high to place into MATH 151 or higher'),
    });
  });

  it('fails closed when any exact VCU grouping, grade, placement, or authority wording drifts', () => {
    const owner = 'va:uni:9229';
    const mutations = [
      'BNFO 201, CLSE 115, CMSC 210, CMSC 254, EGRB 215 or INFO 202 with a minimum grade of B',
      'CMSC 255 or EGRE 246 with a minimum grade of C, and both MATH 151, MATH 200 or MATH 201, with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the one-year period immediately preceding enrollment in the course',
      'CMSC 255, EGRE 246, or ENGR 261 with a minimum grade of C, and either MATH 151, MATH 200, or MATH 201, each with a minimum grade of C, or calculus-level placement on the VCU Mathematics Placement Test within the two-year period immediately preceding enrollment in the course',
      'CMSC 302 or an equivalent with a grade of C or better',
      'CMSC 311 and CMSC 357 or EGRE 364 and EGRE 347, either with a minimum grade of C',
      'CMSC 210 or CMSC 254 with a minimum grade of C or MATH 310 or MATH 370 with a minimum grade of C',
      'CMSC 357 with a minimum grade of C or by permission of the department and MATH 310 or MATH 370 with a minimum grade of C',
      'UNIV 111 and HONR 250 with a minimum grade of C',
      'MATH 139 or MATH 141 with a minimum grade of C, or satisfactory score on the VCU Mathematics Placement Test within the two-year period immediately preceding the beginning of the course',
      'MATH 139, MATH 141, MATH 151, MATH 200 or MATH 201 with a minimum grade of C or a score on the VCU Mathematics Placement Test sufficiently high to place into MATH 151 or above',
    ];
    for (const mutation of mutations) {
      expect(() => tokenizeVcuStructuredFormula(mutation, owner)).toThrow(
        /outside the strict VCU structured grammar/,
      );
    }
  });

  it('models VSU explicit titles, equivalence, standing/permission, and semicolon groups', () => {
    const owner = 'va:uni:9231';
    const capstoneRaw = 'ENGL 342 Technical Communication or GEEN 310 Advanced Communication Skills, and Junior status or permission of Instructor';
    const capstone = formulaGroup({
      owner, courseKey: `${owner}:CSCI400`, kind: 'prerequisite', raw: capstoneRaw,
      tokens: tokenizeVsuStructuredFormula(capstoneRaw, owner),
    });
    expect(capstone.paths).toHaveLength(4);
    expect(capstone.paths.every((path) => path.all_of.length === 2)).toBe(true);

    const equivalent = formulaGroup({
      owner, courseKey: `${owner}:FREN111`, kind: 'prerequisite',
      raw: 'FREN 110 Elementary French I or its equivalent',
      tokens: tokenizeVsuStructuredFormula(
        'FREN 110 Elementary French I or its equivalent', owner,
      ),
    });
    expect(equivalent.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'FREN110', catalog_title_text: 'Elementary French I',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', equivalent_to_course_code: 'FREN110',
      })] }),
    ]);

    const grouped = formulaGroup({
      owner, courseKey: `${owner}:STAT380`, kind: 'prerequisite',
      raw: 'MATH 360; STAT 330 or STAT 340',
      tokens: tokenizeVsuStructuredFormula('MATH 360; STAT 330 or STAT 340', owner),
    });
    expect(grouped.paths.map((path) => path.all_of.map((condition) => condition.code)))
      .toEqual([['MATH360', 'STAT330'], ['MATH360', 'STAT340']]);
    const commaGrouped = formulaGroup({
      owner, courseKey: `${owner}:MATH317`, kind: 'prerequisite',
      raw: 'MATH 360, STAT 330 or STAT 340.',
      tokens: tokenizeVsuStructuredFormula('MATH 360, STAT 330 or STAT 340.', owner),
    });
    expect(commaGrouped.paths.map((path) => path.all_of.map((condition) => condition.code)))
      .toEqual([['MATH360', 'STAT330'], ['MATH360', 'STAT340']]);

    const consentRaw = 'MATH 260 Calculus I, BIOL 120 Principles of Biology I and BIOL 121 Principles of Biology II, or consent of instructor.';
    const consent = formulaGroup({
      owner, courseKey: `${owner}:MATH352`, kind: 'prerequisite', raw: consentRaw,
      tokens: tokenizeVsuStructuredFormula(consentRaw, owner),
    });
    expect(consent.paths).toEqual([
      expect.objectContaining({ all_of: [
        expect.objectContaining({ code: 'MATH260', catalog_title_text: 'Calculus I' }),
        expect.objectContaining({ code: 'BIOL120', catalog_title_text: 'Principles of Biology I' }),
        expect.objectContaining({ code: 'BIOL121', catalog_title_text: 'Principles of Biology II' }),
      ] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', authorization_kind: 'consent',
        authorization_authority: 'instructor',
      })] }),
    ]);
    expect(() => tokenizeVsuStructuredFormula(
      'ENGL 110 or ENGL 112 and ENGL 111 or ENGL 113 and for English majors, ENGL 203',
      owner,
    )).toThrow(/mixed|condition|connector/i);

    const honorsRaw = 'Enrollment is limited to students who are in the University Honors program. Additional enrollment can result from limited recommendations from English faculty, if approved by Languages and Literature department chairman, and if space is available.';
    const honors = formulaGroup({
      owner, courseKey: `${owner}:ENGL112`, kind: 'prerequisite', raw: honorsRaw,
      tokens: tokenizeVsuStructuredFormula(honorsRaw, owner),
    });
    expect(honors.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        condition: 'enrollment_in_university_honors_program',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        condition: 'english_faculty_recommendation_with_department_chair_approval_and_space_available',
        recommendation_authority: 'English faculty',
        approval_authority: 'Languages and Literature department chairman',
        available_space_required: true,
      })] }),
    ]);
    const honorsContinuation = `ENGL 112 ${honorsRaw.replace('department chairman', 'departmemt chairman')}`;
    const honorsTwo = formulaGroup({
      owner, courseKey: `${owner}:ENGL113`, kind: 'prerequisite', raw: honorsContinuation,
      tokens: tokenizeVsuStructuredFormula(honorsContinuation, owner),
    });
    expect(honorsTwo.paths).toHaveLength(2);
    expect(honorsTwo.paths.every((path) => (
      path.all_of[0].code === 'ENGL112' && path.all_of.length === 2
    ))).toBe(true);
    expect(() => tokenizeVsuStructuredFormula(
      honorsRaw.replace('if space is available', 'subject to capacity'), owner,
    )).toThrow(/does not begin with a course code/i);
  });

  it('models the three retained VSU chemistry formulas without widening their wording', () => {
    const owner = 'va:uni:9231';
    const group = (course, raw) => formulaGroup({
      owner, courseKey: `${owner}:${course}`, kind: 'prerequisite', raw,
      tokens: tokenizeVsuStructuredFormula(raw, owner),
    });

    const chemistryOne = group(
      'CHEM151',
      'MATH 120 with a C or better or higher placement or CHEM 105 with a C or better',
    );
    expect(chemistryOne.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'MATH120', minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_with_c_or_better',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', condition: 'higher_placement_than_math_120',
        placement_floor_course_code: 'MATH120', placement_relation: 'higher_than',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'CHEM105', minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_with_c_or_better',
      })] }),
    ]);

    const chemistryMajor = group(
      'CHEM161', 'Chemistry Majors or Permission from the Department Chair',
    );
    expect(chemistryMajor.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', condition: 'chemistry_major', required_major: 'Chemistry',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', authorization_kind: 'permission',
        authorization_authority: 'department chair',
      })] }),
    ]);

    expect(group('CHEM162', 'CHEM 161 Chemistry I with a C or better').paths)
      .toEqual([expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'CHEM161', catalog_title_text: 'Chemistry I', minimum_grade: 'C',
        catalog_grade_scope: 'atom_local_with_c_or_better',
      })] })]);

    for (const drifted of [
      'MATH 120 with a B or better or higher placement or CHEM 105 with a C or better',
      'Chemistry Majors or Approval from the Department Chair',
      'CHEM 161 Chemistry I with a B or better',
    ]) {
      expect(() => tokenizeVsuStructuredFormula(drifted, owner)).toThrow();
    }
  });

  it('models only the two hash-bound VSU combined physics entries and preserves component facts', () => {
    const retained = require('../../.va-catalogs/research/va-university-prerequisite-candidates.json')
      .candidates.filter((row) => (
        row.slug === 'virginia-state-university'
        && ['PHYS106', 'PHYS113'].includes(row.course_code)
      ));
    expect(retained.map((row) => row.course_code).sort()).toEqual(['PHYS106', 'PHYS113']);

    const reviewed = Object.fromEntries(retained.map((row) => (
      [row.course_code, reviewCandidate(structuredClone(row))]
    )));
    expect(reviewed.PHYS106).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_vsu_combined_lecture_laboratory_component_receipt',
      groups: [expect.objectContaining({
        kind: 'prerequisite',
        component_requirement_ids: [
          'lecture_prerequisite_phys105', 'laboratory_prerequisite_phys105',
        ],
        paths: [expect.objectContaining({
          all_of: [expect.objectContaining({ code: 'PHYS105' })],
        })],
      })],
      vsu_physics_combined_component_resolution: expect.objectContaining({
        ready: true,
        receipt_contract: 'vsu_exact_combined_lecture_laboratory_component_entry_v1',
        component_requirements: [
          expect.objectContaining({
            id: 'lecture_prerequisite_phys105', component: 'lecture',
            required_course_code: 'PHYS105', graph_edge_emitted: true,
          }),
          expect.objectContaining({
            id: 'laboratory_prerequisite_phys105', component: 'laboratory',
            required_course_code: 'PHYS105', graph_edge_emitted: false,
            graph_projection: 'coalesced_with_identical_receiver_graph_edge',
          }),
        ],
      }),
    });
    expect(reviewed.PHYS106.internal_component_corequisites).toBeUndefined();

    expect(reviewed.PHYS113).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      review_reason: 'exact_vsu_combined_lecture_laboratory_component_receipt',
      groups: [
        expect.objectContaining({
          kind: 'prerequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'PHYS112' })],
          })],
        }),
        expect.objectContaining({
          kind: 'corequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'MATH201' })],
          })],
        }),
      ],
      internal_component_corequisites: [expect.objectContaining({
        kind: 'same_catalog_code_internal_lecture_laboratory_corequisite',
        component: 'laboratory', course_code: 'PHYS113', graph_edge_emitted: false,
        component_requirement_id: 'laboratory_corequisite_phys113',
      })],
    });

    for (const row of Object.values(reviewed)) {
      expect(row.groups.flatMap((group) => group.paths)
        .flatMap((path) => path.all_of)
        .some((condition) => condition.course_key === row.course_key)).toBe(false);
      const evidence = row.vsu_physics_combined_component_resolution;
      for (const component of [
        ...evidence.component_boundary_evidence,
        ...evidence.component_requirements,
      ]) {
        const start = component.source_character_start
          - row.review_evidence.entry_character_start;
        const end = component.source_character_end
          - row.review_evidence.entry_character_start;
        expect(row.review_evidence.raw_entry_text.slice(start, end)).toBe(component.raw);
      }
    }
  });

  it('fails both VSU physics component exceptions closed on source, entry, or clause drift', () => {
    const retained = require('../../.va-catalogs/research/va-university-prerequisite-candidates.json')
      .candidates.filter((row) => (
        row.slug === 'virginia-state-university'
        && ['PHYS106', 'PHYS113'].includes(row.course_code)
      ));
    for (const original of retained) {
      const mutations = [
        (row) => {
          row.source.source_response_sha256 = '0'.repeat(64);
          row.source.declared_normalized_text_sha256 = '0'.repeat(64);
          row.source.retained_normalized_text_sha256 = '0'.repeat(64);
        },
        (row) => { row.source.raw_entry_html_sha256 = '0'.repeat(64); },
        (row) => {
          row.source.raw_entry_text = row.source.raw_entry_text.replace(' Lab ', ' Laboratory ');
          row.source.raw_entry_sha256 = require('node:crypto').createHash('sha256')
            .update(row.source.raw_entry_text).digest('hex');
          row.source.character_end = row.source.character_start
            + row.source.raw_entry_text.length;
        },
        (row) => {
          row.source.complete_entry_receipt.entry_required_requisite_marker_count += 1;
        },
      ];
      for (const mutate of mutations) {
        const changed = structuredClone(original);
        mutate(changed);
        const row = reviewCandidate(changed);
        expect(row).toMatchObject({
          status: 'unparsed',
          review_status: 'not_promoted',
          review_reason: 'vsu_combined_component_receipt_mismatch',
          groups: [],
          vsu_physics_combined_component_resolution: expect.objectContaining({
            ready: false,
            receipt_contract:
              'vsu_exact_combined_lecture_laboratory_component_entry_v1',
          }),
        });
        expect(row.vsu_physics_combined_component_resolution.issues.length)
          .toBeGreaterThan(0);
      }
    }
  });

  it('recognizes VSU hyphenated Pre-requisite fields without broadening the marker', () => {
    const raw = 'CHEM 152. General Chemistry II. (3 Credits) Description. Pre-requisite: CHEM 151 General Chemistry I Co-requisite: CHEM 154 General Chemistry Laboratory II.';
    const fixture = candidate(raw);
    Object.assign(fixture, {
      school_id: 9231,
      slug: 'virginia-state-university',
      owner_namespace: 'va:uni:9231',
      course_key: 'va:uni:9231:CHEM152',
      course_code: 'CHEM152',
    });
    fixture.source = {
      ...fixture.source,
      character_start: 0,
      character_end: raw.length,
      heading_text: 'CHEM 152. General Chemistry II. (3 Credits)',
    };
    const reviewed = reviewCandidate(fixture);
    expect(reviewed).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
      groups: [
        expect.objectContaining({
          kind: 'prerequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'CHEM151' })],
          })],
        }),
        expect.objectContaining({
          kind: 'corequisite',
          paths: [expect.objectContaining({
            all_of: [expect.objectContaining({ code: 'CHEM154' })],
          })],
        }),
      ],
    });

    const driftedRaw = raw.replace('Pre-requisite:', 'Pre requisite:');
    const drifted = structuredClone(fixture);
    drifted.source.raw_entry_text = driftedRaw;
    drifted.source.raw_entry_sha256 = require('node:crypto')
      .createHash('sha256').update(driftedRaw).digest('hex');
    expect(reviewCandidate(drifted)).toMatchObject({
      status: 'unparsed',
      review_reason: 'corequisite_statement_does_not_prove_no_prerequisite',
    });
  });

  it('parses captured closure clauses only when grade and Boolean scope are explicit', () => {
    const odu = 'va:uni:9218';
    const permission = formulaGroup({
      owner: odu, courseKey: `${odu}:DASC157`, kind: 'prerequisite',
      raw: 'MATH 102M or permission of the instructor',
      tokens: tokenizeOduStructuredFormula('MATH 102M or permission of the instructor', odu),
    });
    expect(permission.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({ code: 'MATH102M' })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course', authorization_authority: 'instructor',
      })] }),
    ]);

    const floor = formulaGroup({
      owner: odu, courseKey: `${odu}:ENGN122`, kind: 'prerequisite',
      raw: 'MATH 163 or MATH 166 or higher',
      tokens: tokenizeOduStructuredFormula('MATH 163 or MATH 166 or higher', odu),
    });
    expect(floor.paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'MATH163' }),
      expect.objectContaining({ code: 'MATH166' }),
      expect.objectContaining({
        type: 'non_course', exclusive_course_floor: 'MATH166', represents_course_choice: true,
      }),
    ]);

    const assessments = formulaGroup({
      owner: odu, courseKey: `${odu}:MATH102M`, kind: 'prerequisite',
      raw: 'SAT score of 540 or above, or ACT score of 22 or above, or qualifying score on the ALEKS placement exam',
      tokens: tokenizeOduStructuredFormula(
        'SAT score of 540 or above, or ACT score of 22 or above, or qualifying score on the ALEKS placement exam',
        odu,
      ),
    });
    expect(assessments.paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ assessment: 'SAT', minimum_score: 540 }),
      expect.objectContaining({ assessment: 'ACT', minimum_score: 22 }),
      expect.objectContaining({ placement_test: 'ALEKS placement exam' }),
    ]);
    expect(formulaGroup({
      owner: odu, courseKey: `${odu}:MATH103M`, kind: 'prerequisite',
      raw: 'High school GPA of 3.4 or above, or qualifying score on the ALEKS placement exam, or MATH 100',
      tokens: tokenizeOduStructuredFormula(
        'High school GPA of 3.4 or above, or qualifying score on the ALEKS placement exam, or MATH 100',
        odu,
      ),
    }).paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ minimum_high_school_gpa: 3.4 }),
      expect.objectContaining({ placement_test: 'ALEKS placement exam' }),
      expect.objectContaining({ code: 'MATH100' }),
    ]);
    const math162 = formulaGroup({
      owner: odu, courseKey: `${odu}:MATH162M`, kind: 'prerequisite',
      raw: 'qualifying score on SAT or ACT, or qualifying score on a placement test administered by the University Testing Center or a grade of C or better in MATH 102M or MATH 103M',
      tokens: tokenizeOduStructuredFormula(
        'qualifying score on SAT or ACT, or qualifying score on a placement test administered by the University Testing Center or a grade of C or better in MATH 102M or MATH 103M',
        odu,
      ),
    });
    expect(math162.paths).toHaveLength(4);
    expect(math162.paths.slice(2).every((path) => (
      path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);
    expect(formulaGroup({
      owner: odu, courseKey: `${odu}:ECE241`, kind: 'prerequisite',
      raw: 'A grade of C or better in CS 150 or ENGN 150 or ENGN 122 and a grade of C or better in MATH 211',
      tokens: tokenizeOduStructuredFormula(
        'A grade of C or better in CS 150 or ENGN 150 or ENGN 122 and a grade of C or better in MATH 211',
        odu,
      ),
    }).paths).toHaveLength(3);

    const rmc = 'va:uni:9221';
    expect(formulaGroup({
      owner: rmc, courseKey: `${rmc}:MATH132`, kind: 'prerequisite',
      raw: 'MATH 131 or permission of instructor',
      tokens: tokenizeRmcStructuredFormula('MATH 131 or permission of instructor', rmc),
    }).paths).toHaveLength(2);

    const vcu = 'va:uni:9229';
    expect(formulaGroup({
      owner: vcu, courseKey: `${vcu}:CHEM100`, kind: 'prerequisite',
      raw: 'MATH 139 or MATH 141 or a math placement test into MATH 151',
      tokens: tokenizeVcuStructuredFormula(
        'MATH 139 or MATH 141 or a math placement test into MATH 151', vcu,
      ),
    }).paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({ code: 'MATH139' }),
      expect.objectContaining({ code: 'MATH141' }),
      expect.objectContaining({ placement_course_code: 'MATH151' }),
    ]);
    expect(formulaGroup({
      owner: vcu, courseKey: `${vcu}:MATH141`, kind: 'prerequisite',
      raw: 'one year of high school algebra and satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
      tokens: tokenizeVcuStructuredFormula(
        'one year of high school algebra and satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
        vcu,
      ),
    }).paths[0].all_of).toEqual([
      expect.objectContaining({ minimum_high_school_algebra_years: 1 }),
      expect.objectContaining({ maximum_age_years: 1, satisfactory_score_required: true }),
    ]);
    expect(tokenizeVcuStructuredFormula(
      'MATH 139 or MATH 141 with a minimum grade of C, or satisfactory score on the VCU Mathematics Placement Test within the one-year period immediately preceding the beginning of the course',
      vcu,
    )).toEqual(expect.any(Array));
    expect(tokenizeVcuStructuredFormula(
      'MATH 139, MATH 141, MATH 151, MATH 200 or MATH 201 with a minimum grade of C or a score on the VCU Mathematics Placement Test sufficiently high to place into MATH 151 or higher',
      vcu,
    )).toEqual(expect.any(Array));

    const vsu = 'va:uni:9231';
    const sharedGrade = formulaGroup({
      owner: vsu, courseKey: `${vsu}:ENGL342`, kind: 'prerequisite',
      raw: '“C” or better in ENGL 110 and in ENGL 111',
      tokens: tokenizeVsuStructuredFormula('“C” or better in ENGL 110 and in ENGL 111', vsu),
    });
    expect(sharedGrade.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'ENGL110', minimum_grade: 'C' }),
      expect.objectContaining({ code: 'ENGL111', minimum_grade: 'C' }),
    ]);

    const cnuOwner = 'va:uni:9206';
    const cnuMath = 'MATH 130 or 132 with a C- or higher or an acceptable score on the Calculus Readiness Assessment';
    expect(formulaGroup({
      owner: cnuOwner, courseKey: `${cnuOwner}:MATH135`, kind: 'prerequisite',
      raw: cnuMath, tokens: tokenizeCnuStrictFormula(cnuMath, cnuOwner),
    }).paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'MATH130', minimum_grade: 'C-',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'MATH132', minimum_grade: 'C-',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        condition: 'acceptable_calculus_readiness_assessment_score',
        acceptable_score_required: true,
      })] }),
    ]);
    expect(() => tokenizeCnuStrictFormula(
      cnuMath.replace('acceptable score', 'qualifying score'), cnuOwner,
    )).toThrow();
  });

  it('extracts only explicitly labelled CNU PDF clauses and preserves concurrency', () => {
    const row = candidate(
      'CPSC 270. Data Structures (3-3-0)\nPrerequisite: CPSC 255 with a grade of C- or higher.\nPre or Corequisite: ENGR 213.\nDescription.',
      { slug: 'christopher-newport-university' },
    );
    const result = extractCnuRequiredClauses(row);
    expect(result).toEqual({
      ignored: [],
      clauses: [
        expect.objectContaining({
          kind: 'prerequisite', raw: 'CPSC 255 with a grade of C- or higher',
        }),
        expect.objectContaining({
          kind: 'prerequisite', raw: 'ENGR 213', concurrent_allowed: true,
        }),
      ],
    });
    const reviewed = reviewCandidate(row);
    expect(reviewed.status).toBe('parsed');
    expect(reviewed.groups).toHaveLength(2);
    expect(reviewed.groups[0].paths[0].all_of[0]).toMatchObject({
      code: 'CPSC255', minimum_grade: 'C-',
    });
    expect(reviewed.groups[1].paths[0].all_of[0]).toMatchObject({
      code: 'ENGR213', concurrent_allowed: true,
    });
  });

  it('uses exact CNU newline receipts only for the three punctuation-free retained fields', () => {
    const cpscRaw = [
      'CPSC 150. Introduction to Programming (3-3-0) LLFR',
      'Pre or Corequisite: CPSC 150L',
      'This course is an introduction to problem solving and',
      'programming. Topics continue.',
    ].join('\n');
    const cpsc = candidate(cpscRaw, {
      school_id: 9206,
      slug: 'christopher-newport-university',
      owner_namespace: 'va:uni:9206',
      course_key: 'va:uni:9206:CPSC150',
      course_code: 'CPSC150',
    });
    expect(extractCnuRequiredClauses(cpsc).clauses).toEqual([
      expect.objectContaining({
        raw: 'CPSC 150L', concurrent_allowed: true,
        statement_relative_end: cpscRaw.indexOf('\nThis course'),
      }),
    ]);
    expect(reviewCandidate(cpsc)).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({ code: 'CPSC150L', concurrent_allowed: true }),
      ] })] })],
    });

    const changed = structuredClone(cpsc);
    changed.source.raw_entry_text = changed.source.raw_entry_text.replace(
      'This course is an introduction', 'The course is an introduction',
    );
    expect(extractCnuRequiredClauses(changed).clauses[0].raw).toContain(
      'The course is an introduction',
    );
    expect(reviewCandidate(changed)).toMatchObject({
      status: 'unparsed', review_reason: 'strict_formula_parser_rejected',
    });

    const cybrRaw = [
      'CYBR 428. Network Security and Cryptography (3-3-0)',
      'Prerequisites: CYBR 328 and CPSC 335',
      'Study of encryption algorithms and network security prac-',
      'tices. More description.',
    ].join('\n');
    expect(extractCnuRequiredClauses(candidate(cybrRaw, {
      slug: 'christopher-newport-university', course_code: 'CYBR428',
    })).clauses[0].raw).toBe('CYBR 328 and CPSC 335');

    const cpsc250Raw = [
      'CPSC 250. Programming for Data Manipulation (3-3-0)',
      'Prerequisites: Grade of C- or higher in CPSC 150/150L',
      'Corequisites: CPSC 250L and MATH 135 or 140 or 148 or',
      'permission of department chair',
      'This course builds upon concepts taught in CPSC 150 and',
      'provides continuing study. More description.',
    ].join('\n');
    const cpsc250 = candidate(cpsc250Raw, {
      school_id: 9206,
      slug: 'christopher-newport-university',
      owner_namespace: 'va:uni:9206',
      course_key: 'va:uni:9206:CPSC250',
      course_code: 'CPSC250',
    });
    const cpsc250Review = reviewCandidate(cpsc250);
    expect(cpsc250Review).toMatchObject({
      status: 'parsed',
      groups: [
        expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
          expect.objectContaining({ code: 'CPSC150', minimum_grade: 'C-' }),
          expect.objectContaining({ code: 'CPSC150L', minimum_grade: 'C-' }),
        ] })] }),
        expect.objectContaining({ paths: expect.arrayContaining([
          expect.objectContaining({ all_of: [
            expect.objectContaining({ code: 'CPSC250L' }),
            expect.objectContaining({ condition: 'permission_of_department_chair' }),
          ] }),
        ]) }),
      ],
    });
    expect(cpsc250Review.groups[1].paths).toHaveLength(4);

    const changed250 = structuredClone(cpsc250);
    changed250.source.raw_entry_text = changed250.source.raw_entry_text.replace(
      'This course builds upon', 'The course builds upon',
    );
    expect(reviewCandidate(changed250)).toMatchObject({
      status: 'unparsed', review_reason: 'strict_formula_parser_rejected',
    });
  });

  it('models exact CNU slash pairs and grade scope without flattening alternatives', () => {
    const owner = 'va:uni:9206';
    const raw = 'MATH 240 and 260; MATH 128 or CPSC 150/150L, all with a C- or higher';
    const tokens = tokenizeCnuStrictFormula(raw, owner);
    const group = formulaGroup({
      owner, courseKey: `${owner}:MATH380`, kind: 'prerequisite', raw, tokens,
    });
    expect(group.paths.map((path) => path.all_of.map((condition) => condition.code)))
      .toEqual([
        ['MATH240', 'MATH260', 'MATH128'],
        ['MATH240', 'MATH260', 'CPSC150', 'CPSC150L'],
      ]);
    expect(group.paths.flatMap((path) => path.all_of)
      .every((condition) => condition.minimum_grade === 'C-')).toBe(true);
  });

  it('accounts for every atom in the pinned CNU mixed clauses and rejects semantic mutations', () => {
    const owner = 'va:uni:9206';
    const group = (course, raw) => formulaGroup({
      owner, courseKey: `${owner}:${course}`, kind: 'prerequisite', raw,
      tokens: tokenizeCnuStrictFormula(raw, owner),
    });

    const ai = 'CPSC 255 or 256 and MATH 235 or 260 or ENGR 210 or PHYS 340 each with a grade of C- or higher';
    const aiGroup = group('CPSC471', ai);
    expect(aiGroup.paths).toHaveLength(8);
    expect(aiGroup.paths.every((path) => (
      path.all_of.length === 2
      && path.all_of.every((row) => (
        row.minimum_grade === 'C-'
        && row.catalog_grade_scope === 'explicit_each_over_pinned_cnu_course_roster'
      ))
    ))).toBe(true);

    const announced = group('CPSC495', 'As announced');
    expect(announced.paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'prerequisites_as_announced',
      dynamic_catalog_prerequisite: true,
    });

    const simulation = 'PHYS 152 or 202 and CPSC 250 and (MATH 140 or 148) or consent of instructor';
    const simulationGroup = group('PHYS441', simulation);
    expect(simulationGroup.paths).toHaveLength(5);
    expect(simulationGroup.paths.slice(0, 4).every((path) => (
      path.all_of.length === 3
      && path.all_of.some((row) => row.code === 'CPSC250')
    ))).toBe(true);
    expect(simulationGroup.paths[4].all_of[0]).toMatchObject({
      condition: 'consent_of_instructor', authorization_authority: 'instructor',
    });

    const math140Raw = [
      'MATH 140. Calculus and Analytic Geometry (3-3-1)',
      'Prerequisite: MATH 130 or 132 with a C- or higher (MATH',
      '132 is preferred) or an acceptable score on the Calculus',
      'Readiness Assessment.',
      'Description.',
    ].join('\n');
    const math140 = reviewCandidate(candidate(math140Raw, {
      school_id: 9206,
      slug: 'christopher-newport-university',
      owner_namespace: owner,
      course_key: `${owner}:MATH140`,
      course_code: 'MATH140',
    }));
    expect(math140).toMatchObject({
      status: 'parsed',
      ignored_nonrequired_requisites: [expect.objectContaining({
        kind: 'explicit_embedded_course_preference_not_modeled',
        raw: '(MATH\n132 is preferred)',
      })],
    });
    expect(math140.groups[0].flags).toEqual(expect.arrayContaining([
      'cnu_exact_whole_clause_formula_roster',
      'cnu_embedded_course_preference_explicitly_not_modeled',
    ]));
    expect(math140.groups[0].paths).toHaveLength(3);

    for (const mutated of [
      ai.replace('each with', 'with'),
      'As later announced',
      simulation.replace('(MATH 140 or 148)', 'MATH 140 or 148'),
      simulation.replace('consent of instructor', 'consent of department chair'),
    ]) {
      expect(() => tokenizeCnuStrictFormula(mutated, owner)).toThrow();
    }
  });

  it('reviews each pinned CNU compound member without dropping sibling formulas', () => {
    const lecture = [
      'PHYS 151-152. College Physics (3-3-0) AINW',
      'Prerequisites for PHYS 151: High school algebra and',
      '',
      'trigonometry or consent of instructor.',
      'Prerequisite for PHYS 152: PHYS 151.',
      'Shared description.',
    ].join('\n');
    const phys151 = reviewCandidate(cnuCompoundCandidate(
      'PHYS151', lecture, ['PHYS151', 'PHYS152'],
    ));
    expect(phys151).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [
        expect.objectContaining({ all_of: [expect.objectContaining({
          condition: 'high_school_algebra_and_trigonometry',
          subject_requirements: ['algebra', 'trigonometry'],
        })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          condition: 'consent_of_instructor',
        })] }),
      ] })],
    });
    expect(phys151.review_evidence.raw_entry_text).toContain(
      'Prerequisite for PHYS 152: PHYS 151.',
    );
    expect(phys151.review_evidence.clauses).toHaveLength(1);

    const phys152 = reviewCandidate(cnuCompoundCandidate(
      'PHYS152', lecture, ['PHYS151', 'PHYS152'],
    ));
    expect(phys152.groups[0].paths[0].all_of[0]).toMatchObject({ code: 'PHYS151' });

    const lab = [
      'PHYS 151L-152L. College Physics Laboratory (1-0-3)',
      'Pre or Corequisite for PHYS 151L: PHYS 151.',
      'Pre or Corequisite for PHYS 152L: PHYS 152.',
      'Shared laboratory description.',
    ].join('\n');
    const phys151l = reviewCandidate(cnuCompoundCandidate(
      'PHYS151L', lab, ['PHYS151L', 'PHYS152L'],
    ));
    expect(phys151l.groups[0].paths[0].all_of[0]).toMatchObject({
      code: 'PHYS151', concurrent_allowed: true,
    });
  });

  it('accepts only pinned CNU mixed-list topology and rejects near matches', () => {
    const owner = 'va:uni:9206';
    expect(() => tokenizeCnuStrictFormula(
      'CPSC 255 or 256 and MATH 235 or 260 or ENGR 210 each with a grade of C- or higher',
      owner,
    )).toThrow(/mixed ungrouped/i);
    const raw = 'PHYS 151/152 or 202/202L and MATH 140 or 148';
    expect(formulaGroup({
      owner, courseKey: `${owner}:PHYS341`, kind: 'prerequisite', raw,
      tokens: tokenizeCnuStrictFormula(raw, owner),
    }).paths.map((path) => path.all_of.map((row) => row.code))).toEqual([
      ['PHYS151', 'PHYS152', 'MATH140'],
      ['PHYS151', 'PHYS152', 'MATH148'],
      ['PHYS202', 'PHYS202L', 'MATH140'],
      ['PHYS202', 'PHYS202L', 'MATH148'],
    ]);
    expect(() => tokenizeCnuStrictFormula(
      raw.replace('202/202L', '202/203L'), owner,
    )).toThrow(/mixed ungrouped/i);
  });

  it('bounds Bridgewater labelled fields and preserves prerequisite/corequisite topology', () => {
    const row = bridgewaterCandidate(
      'ART321',
      'ART-321: Graphic Design Credits: 3 Prerequisites: Sophomore standing Corequisites: CL-200 Term Offered: Fall and Spring',
    );
    expect(extractBridgewaterRequiredClauses(row)).toEqual({
      ignored: [],
      clauses: [
        expect.objectContaining({ kind: 'prerequisite', raw: 'Sophomore standing' }),
        expect.objectContaining({ kind: 'corequisite', raw: 'CL-200' }),
      ],
    });
    const reviewed = reviewCandidate(row);
    expect(reviewed.status).toBe('parsed');
    expect(reviewed.groups).toHaveLength(2);
    expect(reviewed.groups[0].paths[0].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'sophomore_standing',
    });
    expect(reviewed.groups[1].paths[0].all_of[0]).toMatchObject({
      type: 'course', code: 'CL200', course_key: 'va:uni:9205:CL200',
    });
    expect(reviewed.raw_requisites).toBe(
      'Prerequisites: Sophomore standing Corequisites: CL-200 ',
    );
  });

  it('models Bridgewater completed-credit thresholds conjunctively and fails closed on prose', () => {
    const owner = 'va:uni:9205';
    const group = formulaGroup({
      owner,
      courseKey: `${owner}:CL400`,
      kind: 'prerequisite',
      raw: '70+ credits completed; CL-200',
      tokens: tokenizeBridgewaterStrictFormula('70+ credits completed; CL-200', owner),
    });
    expect(group.paths).toEqual([
      expect.objectContaining({
        all_of: [
          expect.objectContaining({
            type: 'non_course', minimum_completed_credits: 70,
          }),
          expect.objectContaining({ type: 'course', code: 'CL200' }),
        ],
      }),
    ]);
    expect(() => tokenizeBridgewaterStrictFormula(
      'Permission of instructor or CL-200', owner,
    )).toThrow(/unaccounted/i);
  });

  it('preserves Bridgewater grade, assessment, major, and permission topology exactly', () => {
    const owner = 'va:uni:9205';
    const csci102 = formulaGroup({
      owner,
      courseKey: `${owner}:CSCI102`,
      kind: 'prerequisite',
      raw: 'A grade of C or greater in CSCI-101, or both CSCI-100 and a grade of C or greater on the CSCI-101 assessment exam',
      tokens: tokenizeBridgewaterStrictFormula(
        'A grade of C or greater in CSCI-101, or both CSCI-100 and a grade of C or greater on the CSCI-101 assessment exam',
        owner,
      ),
    });
    expect(csci102.paths).toHaveLength(2);
    expect(csci102.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CSCI101', minimum_grade: 'C' }),
    ]);
    expect(csci102.paths[1].all_of).toEqual([
      expect.objectContaining({ code: 'CSCI100' }),
      expect.objectContaining({
        type: 'non_course',
        condition: 'csci101_assessment_exam_minimum_grade_c',
        minimum_grade: 'C',
      }),
    ]);

    const alternatives = formulaGroup({
      owner,
      courseKey: `${owner}:CSCI131`,
      kind: 'prerequisite',
      raw: 'A grade of C or greater in CSCI-100 or CSCI-101 or CSCI-130',
      tokens: tokenizeBridgewaterStrictFormula(
        'A grade of C or greater in CSCI-100 or CSCI-101 or CSCI-130', owner,
      ),
    });
    expect(alternatives.paths).toHaveLength(3);
    expect(alternatives.paths.every((path) => (
      path.all_of.length === 1 && path.all_of[0].minimum_grade === 'C'
    ))).toBe(true);

    const capstone = formulaGroup({
      owner,
      courseKey: `${owner}:CSCI400`,
      kind: 'prerequisite',
      raw: 'CL-200; CSCI major; 90+ credits completed',
      tokens: tokenizeBridgewaterStrictFormula(
        'CL-200; CSCI major; 90+ credits completed', owner,
      ),
    });
    expect(capstone.paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CL200' }),
      expect.objectContaining({ condition: 'csci_major', required_major_code: 'CSCI' }),
      expect.objectContaining({ minimum_completed_credits: 90 }),
    ]);

    const database = formulaGroup({
      owner,
      courseKey: `${owner}:DSA230`,
      kind: 'prerequisite',
      raw: 'CSCI-110 or permission of instructor',
      tokens: tokenizeBridgewaterStrictFormula(
        'CSCI-110 or permission of instructor', owner,
      ),
    });
    expect(database.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({ code: 'CSCI110' })] }),
      expect.objectContaining({
        all_of: [expect.objectContaining({ condition: 'instructor_permission' })],
      }),
    ]);
  });

  it('retains Bridgewater CSCI-130 course and assessment routes without inventing an exam threshold', () => {
    const owner = 'va:uni:9205';
    const raw = 'C SCI-130 with a minimum grade of C or on the CSCI-130 assessment exam';
    const group = formulaGroup({
      owner, courseKey: `${owner}:DSA350`, kind: 'prerequisite', raw,
      tokens: tokenizeBridgewaterStrictFormula(raw, owner),
    });
    expect(group.paths).toEqual([
      expect.objectContaining({ all_of: [expect.objectContaining({
        code: 'CSCI130', minimum_grade: 'C',
      })] }),
      expect.objectContaining({ all_of: [expect.objectContaining({
        type: 'non_course',
        condition: 'csci130_assessment_exam_catalog_requirement',
        assessment_for_course_code: 'CSCI130',
        threshold_published: false,
      })] }),
    ]);
    expect(() => tokenizeBridgewaterStrictFormula(
      'C SCI-130 with a minimum grade of C or on the CSCI-130 assessment exam',
      'va:uni:9999',
    )).not.toThrow();
    expect(() => tokenizeBridgewaterStrictFormula(
      'C SCI-130 with a minimum grade of C or a 70 on the CSCI-130 assessment exam',
      owner,
    )).toThrow(/unaccounted/i);
  });

  it('does not convert an omitted Bridgewater prerequisite field into none', () => {
    const exactSilence = bridgewaterCandidate(
      'CL100',
      'CL-100: Connected Learning Seminar Credits: 3 Term Offered: Fall and Spring',
    );
    expect(reviewCandidate(exactSilence)).toMatchObject({
      status: 'unparsed',
      review_reason: 'no_explicit_required_requisite_statement',
    });
    const unbounded = bridgewaterCandidate(
      'CL200',
      'CL-200: Fixture Prerequisites: CL-100 or CL-150 Term Offered: Fall',
    );
    unbounded.source.boundary_contract = 'not-the-pinned-contract';
    expect(reviewCandidate(unbounded)).toMatchObject({
      status: 'unparsed',
      review_reason: 'no_explicit_required_requisite_statement',
    });
  });

  it('extracts exact Longwood markers and retains excluded recommendations as evidence', () => {
    const raw = 'CMSC208. Grammars Prerequisite: CMSC 160 with a C- or better, MATH 175; CMSC 162 recommended. 3 credits.';
    const row = longwoodCandidate('CMSC208', raw);
    const extracted = extractLongwoodRequiredClauses(row);
    expect(extracted.clauses).toEqual([
      expect.objectContaining({
        kind: 'prerequisite',
        label: 'Prerequisite',
        raw: 'CMSC 160 with a C- or better, MATH 175',
      }),
    ]);
    expect(extracted.ignored).toEqual([
      expect.objectContaining({
        kind: 'explicit_recommended_requisite_suffix_not_modeled',
        raw: 'CMSC 162 recommended',
        raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    ]);
    const reviewed = reviewCandidate(row);
    expect(reviewed.status).toBe('parsed');
    expect(reviewed.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'CMSC160', minimum_grade: 'C-' }),
      expect.objectContaining({ code: 'MATH175' }),
    ]);
    expect(raw.slice(
      reviewed.ignored_nonrequired_requisites[0].source_character_start,
      reviewed.ignored_nonrequired_requisites[0].source_character_end,
    )).toBe('CMSC 162 recommended');
  });

  it('preserves Longwood OR, comma-list, standing, consent, and concurrency topology', () => {
    const owner = 'va:uni:9214';
    const orGroup = formulaGroup({
      owner, courseKey: `${owner}:CMSC210`, kind: 'prerequisite',
      raw: 'CMSC 140 or CMSC 160',
      tokens: tokenizeLongwoodStrictFormula('CMSC 140 or CMSC 160', owner),
    });
    expect(orGroup.paths.map((path) => path.all_of.map((row) => row.code)))
      .toEqual([['CMSC140'], ['CMSC160']]);
    const listGroup = formulaGroup({
      owner, courseKey: `${owner}:CMSC442`, kind: 'prerequisite',
      raw: 'CMSC 201, CMSC 242',
      tokens: tokenizeLongwoodStrictFormula('CMSC 201, CMSC 242', owner),
    });
    expect(listGroup.paths[0].all_of.map((row) => row.code))
      .toEqual(['CMSC201', 'CMSC242']);
    const consent = tokenizeLongwoodStrictFormula(
      'CMSC 160 or consent of the instructor', owner,
    );
    expect(formulaGroup({
      owner, courseKey: `${owner}:CMSC280`, kind: 'prerequisite',
      raw: 'CMSC 160 or consent of the instructor', tokens: consent,
    }).paths[1].all_of[0]).toMatchObject({
      type: 'non_course', condition: 'consent_of_instructor',
    });
    const standing = tokenizeLongwoodStrictFormula('Sophomore standing or higher', owner);
    expect(standing[0].condition).toMatchObject({
      condition: 'sophomore_standing_or_higher', minimum_class_standing: 'sophomore',
    });
    const concurrent = reviewCandidate(longwoodCandidate(
      'CMSC162',
      'CMSC162. Intro Prerequisite: CMSC 160 with a grade of C- or higher. Prerequisite/Corequisite: CMSC 161. 4 credits.',
    ));
    expect(concurrent.groups[1].paths[0].all_of[0]).toMatchObject({
      code: 'CMSC161', concurrent_allowed: true,
    });
    expect(() => tokenizeLongwoodStrictFormula(
      'CMSC 160 or CMSC 162, MATH 175', owner,
    )).toThrow(/mixed ungrouped/i);
  });

  it('keeps Longwood silence and corequisite-only entries unparsed, never none', () => {
    for (const [code, raw] of [
      ['CMSC140', 'CMSC140. Introduction to Programming. 3 credits.'],
      ['CMSC483', 'CMSC483. Experiential Learning Seminar II. 0 credits.'],
    ]) {
      expect(reviewCandidate(longwoodCandidate(code, raw))).toMatchObject({
        status: 'unparsed',
        review_reason: 'no_explicit_required_requisite_statement',
      });
    }
    expect(reviewCandidate(longwoodCandidate(
      'CMSC160', 'CMSC160. Intro Corequisite: CMSC 161. 4 credits.',
    ))).toMatchObject({
      status: 'unparsed',
      review_reason: 'corequisite_statement_does_not_prove_no_prerequisite',
    });
  });

  it('bounds the complete Longwood Banner prerequisite region before units and designations', () => {
    const raw = 'CTZN410. Symposium Prerequisites: Completion of three perspective level courses. The fourth perspectives level course must be taken prior to or concurrently with CTZN 410. 3 credits. WI, SI.';
    const extracted = extractLongwoodRequiredClauses(longwoodBannerCandidate('CTZN410', raw));
    expect(extracted.clauses).toEqual([expect.objectContaining({
      kind: 'prerequisite',
      raw: 'Completion of three perspective level courses. The fourth perspectives level course must be taken prior to or concurrently with CTZN 410.',
    })]);
    expect(reviewCandidate(longwoodBannerCandidate('CTZN410', raw))).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({ minimum_completed_courses: 3 }),
        expect.objectContaining({
          required_ordinal_course: 4,
          target_course_code: 'CTZN410',
          concurrent_allowed: true,
        }),
      ] })] })],
    });

    const math = reviewCandidate(longwoodBannerCandidate(
      'MATH261',
      'MATH261. Calculus I Prerequisite: MATH 164 with a C- or better. 4 credits.',
    ));
    expect(math).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({
        all_of: [expect.objectContaining({ code: 'MATH164', minimum_grade: 'C-' })],
      })] })],
    });

    expect(reviewCandidate(longwoodBannerCandidate(
      'ENGL165', 'ENGL165. Writing and Rhetoric. 3 credits. WI.',
    ))).toMatchObject({
      status: 'unparsed', review_reason: 'no_explicit_required_requisite_statement',
    });
  });

  it('parses only the exact Longwood resident Perspective formulas with full suffix accounting', () => {
    const mathRaw = 'MATH301. Applied Statistics Prerequisites: MATH 171 with a grade of C- or better and completion of FHBS pillar. 3 credits. PQRC, WI.';
    const math = reviewCandidate(longwoodBannerCandidate('MATH301', mathRaw));
    expect(math).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({
        raw: 'MATH 171 with a grade of C- or better and completion of FHBS pillar.',
        paths: [expect.objectContaining({ all_of: [
          expect.objectContaining({ code: 'MATH171', minimum_grade: 'C-' }),
          expect.objectContaining({
            type: 'non_course',
            condition: 'completion_of_fhbs_pillar',
            civitae_pillar: 'FHBS',
            completion_required: true,
          }),
        ] })],
      })],
    });

    const psychology = reviewCandidate(longwoodBannerCandidate(
      'PSYC335',
      'PSYC335. Psychology of Belief Pre-requisites: Completion of FHBS pillar. 3 Credits PHBS. WI.',
    ));
    expect(psychology).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({
          type: 'non_course',
          condition: 'completion_of_fhbs_pillar',
          civitae_pillar: 'FHBS',
        }),
      ] })] })],
    });

    const religionRaw = 'RELI301. Elements of World Religion Pre-requisites: Completion of FGLO Pillar. WI. PGLO. 3 credits.';
    const extractedReligion = extractLongwoodRequiredClauses(
      longwoodBannerCandidate('RELI301', religionRaw),
    );
    expect(extractedReligion.clauses).toEqual([expect.objectContaining({
      raw: 'Completion of FGLO Pillar',
      catalog_designation_suffix: expect.objectContaining({
        kind: 'exact_catalog_designation_suffix_outside_requisite_clause',
        raw: 'WI. PGLO.',
        raw_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    })]);
    expect(religionRaw.slice(
      extractedReligion.clauses[0].catalog_designation_suffix.relative_start,
      extractedReligion.clauses[0].catalog_designation_suffix.relative_end,
    )).toBe('WI. PGLO.');
    expect(reviewCandidate(longwoodBannerCandidate('RELI301', religionRaw))).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [expect.objectContaining({ all_of: [
        expect.objectContaining({
          type: 'non_course',
          condition: 'completion_of_fglo_pillar',
          civitae_pillar: 'FGLO',
        }),
      ] })] })],
    });
  });

  it('retains Longwood placement alternatives without inventing a score threshold', () => {
    expect(reviewCandidate(longwoodBannerCandidate(
      'SPAN320',
      'SPAN320. Integrated Inquiry Cult & Lang Prerequisite: SPAN 212 or an appropriate placement score. G10; PWLA, SI, WI. 3 credits.',
    ))).toMatchObject({
      status: 'parsed',
      groups: [expect.objectContaining({ paths: [
        expect.objectContaining({ all_of: [expect.objectContaining({ code: 'SPAN212' })] }),
        expect.objectContaining({ all_of: [expect.objectContaining({
          type: 'non_course',
          condition: 'appropriate_spanish_placement_score',
          appropriate_score_required: true,
          threshold_published: false,
        })] }),
      ] })],
    });
    expect(() => tokenizeLongwoodStrictFormula(
      'Completion of FQRC pillar', 'va:uni:9214',
    )).toThrow(/unaccounted Longwood formula text/i);
  });

  it('requires the complete same-catalog Shenandoah population before structural silence', () => {
    const crypto = require('node:crypto');
    const makeCandidate = (code, { positive = false, signal = '' } = {}) => {
      const record = SHENANDOAH_DIRECT_COURSE_RECORDS[code];
      const prefix = `${code.replace(/^(\D+)(\d)/, '$1 $2')} ${record.title} Credit(s): 3`;
      const clauseRaw = 'CSC 121';
      const raw = `${prefix}${signal}${positive ? ` Prerequisite(s): ${clauseRaw}` : ''}`;
      const clauseStart = raw.indexOf(clauseRaw);
      const statementStart = raw.indexOf('Prerequisite(s):');
      const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
      return {
        school_id: 9224,
        slug: 'shenandoah-university',
        owner_namespace: 'va:uni:9224',
        course_key: `va:uni:9224:${code}`,
        course_code: code,
        row_status: 'candidate_review_required',
        source: {
          capture_origin: 'official_shenandoah_acalog_course_page',
          source_format: 'shenandoah_acalog_course_page',
          boundary_contract: SHENANDOAH_BOUNDARY_CONTRACT,
          catalog_year_verified: '2025-2026',
          official_url: `https://catalog.su.edu/preview_course_nopop.php?catoid=33&coid=${record.coid}`,
          declared_normalized_text_sha256: 'a'.repeat(64),
          retained_normalized_text_sha256: 'a'.repeat(64),
          source_response_sha256: 'a'.repeat(64),
          source_response_bytes: 1000,
          character_start: 0,
          character_end: raw.length,
          heading_text: `${code} ${record.title}`,
          raw_entry_text: raw,
          raw_entry_sha256: hash(raw),
          raw_entry_html_sha256: hash(`<td>${raw}</td>`),
          catoid: 33,
          coid: record.coid,
          published_units: {
            kind: 'published_fixed_credits', notation: 'Credit(s): 3',
            credit_hours_min: 3, credit_hours_max: 3,
          },
          required_requisite_clause: positive ? {
            receipt_contract: SHENANDOAH_CLAUSE_RECEIPT_CONTRACT,
            kind: 'prerequisite',
            label: 'Prerequisite(s)',
            raw: clauseRaw,
            raw_sha256: hash(clauseRaw),
            relative_start: clauseStart,
            relative_end: clauseStart + clauseRaw.length,
            statement_relative_start: statementStart,
            statement_relative_end: clauseStart + clauseRaw.length,
            raw_html_sha256: hash(clauseRaw),
            boundary_terminal: 'closing_p_after_unique_terminal_prerequisite_parenthetical_marker',
          } : null,
          formal_corequisite_marker_count: 0,
          discovery_contract: record.discovery_contract || SHENANDOAH_DISCOVERY_CONTRACT,
          discovery_cache_path: record.discovery_cache_path || SHENANDOAH_PROGRAM_CACHE_PATH,
          discovery_response_sha256:
            record.discovery_response_sha256 || SHENANDOAH_PROGRAM_HTML_SHA256,
          discovery_link_receipt: {
            course_code: code, catoid: 33, coid: record.coid, title: record.title,
          },
          robots_crawl_delay_seconds: 120,
        },
      };
    };
    const candidates = Object.keys(SHENANDOAH_DIRECT_COURSE_RECORDS)
      .map((code) => makeCandidate(code, { positive: code === 'CSC122' }));
    const control = shenandoahAcalogMarkerControl(candidates);
    expect(control).toMatchObject({
      catalog_year: '2025-2026',
      catoid: 33,
      exact_complete_entry_count: 19,
      exact_complete_entries_with_required_requisite_marker_count: 1,
      exact_complete_entries_without_required_requisite_marker_count: 18,
      same_catalog_positive_control: true,
      positive_control_course_keys: ['va:uni:9224:CSC122'],
    });
    expect(controlledShenandoahAcalogSilenceEvidence(candidates[0], control))
      .toMatchObject({
        literal_none_statement: false,
        course_entry_status: 'published_exact_shenandoah_acalog_course_page',
        marker_control: control,
      });
    expect(reviewCandidate(candidates[0], { shenandoahMarkerControl: control }))
      .toMatchObject({
        status: 'none',
        review_status: 'promoted_structural_none',
        review_reason:
          'complete_shenandoah_acalog_entry_silence_with_same_catalog_required_marker_control',
      });

    expect(shenandoahAcalogMarkerControl(candidates.slice(1))).toBeNull();
    const yearDrift = structuredClone(candidates);
    yearDrift[0].source.catalog_year_verified = '2026-2027';
    expect(shenandoahAcalogMarkerControl(yearDrift)).toBeNull();
    const corequisite = structuredClone(candidates[0]);
    corequisite.source.formal_corequisite_marker_count = 1;
    expect(controlledShenandoahAcalogSilenceEvidence(corequisite, control)).toBeNull();
    expect(reviewCandidate(corequisite, { shenandoahMarkerControl: control })).toMatchObject({
      status: 'unparsed',
      review_reason: 'shenandoah_corequisite_field_not_bounded_by_required_clause_receipt',
    });
    const hidden = makeCandidate('CSC121', { signal: ' Permission of instructor required.' });
    expect(controlledShenandoahAcalogSilenceEvidence(hidden, control)).toBeNull();
  });

  it('never promotes silence to an explicit none row', () => {
    const reviewed = reviewCandidate(candidate(
      'CPSC 220 - Fixture (3 Credits) A course description with no requisite statement.',
    ));
    expect(reviewed).toMatchObject({
      status: 'unparsed',
      review_reason: 'no_explicit_required_requisite_statement',
    });
  });

  it('does not let a corequisite-only statement stand in for prerequisite evidence', () => {
    const reviewed = reviewCandidate(candidate(
      'CSCI 141 Fixture (3 Credits) Corequisite(s): CSCI 141L Domain: NQR ',
      {
        school_id: 9233,
        slug: 'william-mary',
        owner_namespace: 'va:uni:9233',
        course_key: 'va:uni:9233:CSCI141',
        course_code: 'CSCI141',
      },
    ));
    expect(reviewed).toMatchObject({
      status: 'unparsed',
      review_reason: 'corequisite_statement_does_not_prove_no_prerequisite',
    });
  });

  it('promotes only an explicit prerequisite-none statement to none', () => {
    const reviewed = reviewCandidate(candidate(
      'CPSC 220 - Fixture (3 Credits) Prerequisite: None. Description.',
    ));
    expect(reviewed).toMatchObject({
      status: 'none',
      raw_requisites: null,
      groups: [],
      review_status: 'promoted_explicit_none',
    });
    expect(reviewed.review_evidence.clauses[0].raw).toBe('None');
  });

  it('fails closed when natural-language residue is outside the strict grammar', () => {
    const reviewed = reviewCandidate(candidate(
      'CPSC 220 - Fixture (3 Credits) Prerequisite: CPSC 110 or equivalent experience. Description.',
    ));
    expect(reviewed).toMatchObject({
      status: 'unparsed',
      review_reason: 'strict_formula_parser_rejected',
    });
    expect(reviewed.parser_error).toMatch(/unaccounted|outside/i);
  });

  it('distinguishes unresolved unparsed, missing-direct, and outside-scope closure keys', () => {
    const owner = 'va:uni:1';
    const target = {
      course_key: `${owner}:CS300`, owner_namespace: owner, status: 'parsed',
      groups: [formulaGroup({
        owner, courseKey: `${owner}:CS300`, kind: 'prerequisite',
        raw: 'CS 100 and CS 200 and CS 250',
        tokens: tokenizeCourseOnly('CS 100 and CS 200 and CS 250', owner),
      })],
    };
    const rows = [
      target,
      { course_key: `${owner}:CS100`, status: 'unparsed', groups: [] },
      { course_key: `${owner}:CS200`, status: 'missing', groups: [] },
    ];
    expect(closureReport(rows, [target])).toMatchObject({
      complete: false,
      formula_reference_keys: 3,
      unresolved_unparsed_direct_keys: 1,
      unresolved_missing_direct_keys: 1,
      unresolved_outside_direct_scope_keys: 1,
    });
  });
});
