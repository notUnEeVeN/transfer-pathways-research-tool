const fs = require('node:fs');
const path = require('node:path');

const {
  AMBIGUOUS_CODES,
  BLOCKED_CODES,
  CONDITIONAL_APPLICABILITY_BLOCKED_CODES,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  OUTSIDE_STATEMENTS,
  RESOLVED_CODES,
  TARGET_CODES,
  canonicalSha256,
  resolveVirginiaTechPrerequisiteCandidate,
  sha256,
} = require('./virginiaTechPrerequisiteResolution');

const SERVER_ROOT = path.resolve(__dirname, '../..');
const CANDIDATE_PATH = path.join(
  SERVER_ROOT,
  '.va-catalogs/research/va-university-prerequisite-candidates.json',
);
const ARTIFACT = JSON.parse(fs.readFileSync(CANDIDATE_PATH, 'utf8'));
const VT_CANDIDATES = ARTIFACT.candidates.filter((row) => row.school_id === 9230);
const byCode = new Map(VT_CANDIDATES.map((row) => [row.course_code, row]));
const clone = (value) => JSON.parse(JSON.stringify(value));

const EXACT_RESOLUTION_SHA256 = Object.freeze({
  BIOL1115: 'f7ca5e625508a7ddc96a40b1079f8833c221d1159d78f52f622b68f450b0f707',
  BIOL1116: '82a192966a96253d3e3727358ba2f7d4a7c4a550a4f894c6043e84c9c32cc463',
  CS3604: '341211fd7a2228aef12188e328f4c93e5682a0c4e462b24fca96f684f685b5db',
  MATH1225: '54ada713b4a7749fe1a0e9ab2c0b9aff927bc09f332914853a8f42675490b577',
  MATH2534: '33693f190ad719de0a1d06cb745e2c2167fb69c57cb763a965d7e38fc37c7097',
});

function result(code, candidate = byCode.get(code)) {
  return resolveVirginiaTechPrerequisiteCandidate(candidate);
}

function assertMutationFailsClosed(code, mutate) {
  const changed = clone(byCode.get(code));
  mutate(changed);
  const resolution = resolveVirginiaTechPrerequisiteCandidate(changed);
  expect(resolution.applicable, `${code} mutation must remain in exact resolver scope`).toBe(true);
  expect(resolution.ready, `${code} mutation must not resolve`).toBe(false);
  expect(resolution.status).not.toBe('none');
}

describe('Virginia Tech exact prerequisite resolution', () => {
  it('resolves exactly five bounded rows and keeps all five unsafe rows blocked', () => {
    expect(RESOLVED_CODES).toEqual([
      'BIOL1115',
      'BIOL1116',
      'CS3604',
      'MATH1225',
      'MATH2534',
    ]);
    expect(CONDITIONAL_APPLICABILITY_BLOCKED_CODES).toEqual(['ENGE4735', 'ENGE4736']);
    expect(AMBIGUOUS_CODES).toEqual(['CS4664', 'MATH3414', 'MATH4445']);
    expect(BLOCKED_CODES).toEqual([
      'ENGE4735', 'ENGE4736', 'CS4664', 'MATH3414', 'MATH4445',
    ]);
    expect(TARGET_CODES).toHaveLength(10);

    for (const code of RESOLVED_CODES) {
      const resolution = result(code);
      expect(resolution).toMatchObject({
        applicable: true,
        ready: true,
        status: 'parsed',
        code,
        issues: [],
        source_or_core_content_changed: false,
      });
      expect(resolution.status).not.toBe('none');
      expect(canonicalSha256(resolution)).toBe(EXACT_RESOLUTION_SHA256[code]);
    }

    for (const code of AMBIGUOUS_CODES) {
      expect(result(code)).toMatchObject({
        applicable: true,
        ready: false,
        code,
        issues: ['ambiguous_boolean_grouping'],
        review_reason: 'virginia_tech_courseleaf_boolean_grouping_not_explicit',
      });
      expect(result(code).groups).toBeUndefined();
    }
  });

  it('binds the complete current candidate/source objects and retained response bytes', () => {
    const checkedResponseHashes = new Set();
    for (const code of TARGET_CODES) {
      const candidate = byCode.get(code);
      expect(candidate).toBeTruthy();
      expect(canonicalSha256(candidate)).toBe(EXACT_CANDIDATE_SHA256[code]);
      expect(canonicalSha256(candidate.source)).toBe(EXACT_SOURCE_SHA256[code]);
      expect(sha256(candidate.source.raw_entry_text)).toBe(candidate.source.raw_entry_sha256);

      if (checkedResponseHashes.has(candidate.source.source_response_sha256)) continue;
      checkedResponseHashes.add(candidate.source.source_response_sha256);
      const retained = fs.readFileSync(path.join(
        SERVER_ROOT,
        '.va-catalogs',
        candidate.source.cache_path,
      ));
      expect(retained.length).toBe(candidate.source.source_response_bytes);
      expect(sha256(retained)).toBe(candidate.source.source_response_sha256);
    }
    expect(checkedResponseHashes.size).toBe(4);
  });

  it('promotes BIOL1115/1116 only as exact corequisite-only parsed rows, never none', () => {
    for (const [code, expectedDependency] of [
      ['BIOL1115', 'BIOL1105'],
      ['BIOL1116', 'BIOL1106'],
    ]) {
      const resolution = result(code);
      expect(resolution.status).toBe('parsed');
      expect(resolution.proof).toMatchObject({
        corequisite_edge_preserved: true,
        status_none_authorized: false,
      });
      expect(resolution.groups).toHaveLength(1);
      expect(resolution.groups[0]).toMatchObject({ kind: 'corequisite' });
      expect(resolution.groups[0].paths).toHaveLength(1);
      expect(resolution.groups[0].paths[0].all_of).toEqual([expect.objectContaining({
        type: 'course',
        code: expectedDependency,
        course_key: `va:uni:9230:${expectedDependency}`,
        concurrent_allowed: true,
      })]);
      expect(resolution.proof.complete_entry_receipt).toMatchObject({
        source_courseblock_count: 96,
        source_complete_entry_count: 95,
        source_complete_entries_with_required_requisite_marker_count: 63,
        entry_required_requisite_marker_count: 0,
        entry_corequisite_marker_count: 1,
        entry_requisite_marker_like_count: 1,
        entry_constraint_like_signal_count: 0,
        same_source_positive_control: true,
      });
    }
  });

  it('preserves CS3604 grouping and the separate CS3114 minimum-grade statement', () => {
    const resolution = result('CS3604');
    const paths = resolution.groups[0].paths.map((row) => row.all_of);
    expect(paths).toHaveLength(4);
    expect(paths.map((pathRow) => pathRow.map((condition) => condition.code))).toEqual([
      ['CS3114', 'CS1944', 'CS2114', 'COMM2004'],
      ['CS3114', 'CS1944', 'CS2114', 'COMM2014'],
      ['CS3114', 'CS1944', 'ECE3514', 'COMM2004'],
      ['CS3114', 'CS1944', 'ECE3514', 'COMM2014'],
    ]);
    for (const pathRow of paths) {
      expect(pathRow[0]).toMatchObject({
        code: 'CS3114',
        minimum_grade: 'C',
        raw: 'CS prerequisite 3114',
        minimum_grade_evidence: {
          raw: OUTSIDE_STATEMENTS.CS3604_GRADE,
        },
      });
    }
    expect(resolution.raw_requisites).toContain(OUTSIDE_STATEMENTS.CS3604_GRADE);
  });

  it('audits ENGE exactly but emits no formula, universal corequisite, or inferred major mapping', () => {
    for (const code of CONDITIONAL_APPLICABILITY_BLOCKED_CODES) {
      const resolution = result(code);
      expect(resolution).toMatchObject({
        applicable: true,
        ready: false,
        code,
        issues: ['conditional_applicability_not_losslessly_representable'],
        review_reason:
          'virginia_tech_courseleaf_conditional_applicability_not_losslessly_representable',
        source_or_core_content_changed: false,
      });
      expect(resolution.groups).toBeUndefined();
      expect(resolution.status).toBeUndefined();
      expect(resolution.proof).toMatchObject({
        exact_conditional_branch_count: 2,
        exact_course_codes: ['MSE4055', 'ISE4404'],
        exact_program_qualifiers: ['MSE majors', 'ISE majors'],
        conditional_corequisite_default_branch_published: false,
        universal_corequisite_projection_authorized: false,
        route_to_major_mapping_published: false,
        route_to_major_mapping_inferred: false,
        shared_formula_projection_emitted: false,
        conditional_applicability_losslessly_representable: false,
        no_corequisite_complement_branch_invented: true,
      });
      expect(resolution.proof.exact_major_scope_statement.raw)
        .toBe(OUTSIDE_STATEMENTS.ENGE_MAJOR_SCOPE);
    }
    expect(result('ENGE4735').proof).toMatchObject({
      prerequisite_path_count: 81,
      prerequisite_course_atom_count: expect.any(Number),
      prerequisite_path_course_codes_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(result('ENGE4736').proof).toMatchObject({
      prerequisite_path_count: 1,
      exact_prerequisite_course_code: 'ENGE4735',
    });
  });

  it('retains the MATH1225 background/placement and MATH2534 required/major conditions', () => {
    const math1225 = result('MATH1225');
    expect(math1225.groups[0].paths[0].all_of).toEqual([
      expect.objectContaining({ code: 'MATH1214', type: 'course' }),
      expect.objectContaining({
        type: 'non_course',
        condition: 'catalog_assumed_high_school_mathematics_and_math_department_placement',
        catalog_semantic_force: 'assumes',
        placement_authority: 'Math Dept.',
        raw: OUTSIDE_STATEMENTS.MATH1225_BACKGROUND,
      }),
    ]);
    expect(math1225.proof.preserved_noncurrent_sibling_statements[0]).toMatchObject({
      raw: OUTSIDE_STATEMENTS.MATH1225_SIBLING_GRADE,
      kind: 'exact_sibling_course_prerequisite_context_not_applicable_to_current_course',
    });

    const math2534 = result('MATH2534');
    expect(math2534.groups[0].paths).toHaveLength(4);
    expect(math2534.groups[0].paths.map((row) => row.all_of[0].code)).toEqual([
      'CS1114', 'ECE1574', 'ECE1004', 'CS2064',
    ]);
    for (const pathRow of math2534.groups[0].paths) {
      expect(pathRow.all_of[1]).toMatchObject({
        condition: 'required_high_school_algebra_geometry_trigonometry_and_precalculus',
        required: true,
        raw: OUTSIDE_STATEMENTS.MATH2534_BACKGROUND,
      });
      expect(pathRow.all_of[2]).toMatchObject({
        condition: 'mathematics_major_credit_requires_special_permission',
        authorization_kind: 'special_permission',
        raw: OUTSIDE_STATEMENTS.MATH2534_MAJOR_RESTRICTION,
      });
    }
  });

  it('fails closed on identity, source, entry, field, receipt, units, and browser evidence mutation', () => {
    for (const code of TARGET_CODES) {
      assertMutationFailsClosed(code, (row) => { row.school_id = 9999; });
      assertMutationFailsClosed(code, (row) => { row.slug = 'not-virginia-tech'; });
      assertMutationFailsClosed(code, (row) => { row.course_key += 'X'; });
      assertMutationFailsClosed(code, (row) => {
        row.course_code = 'OTHER9999';
        row.course_key = 'va:uni:9230:OTHER9999';
      });
      assertMutationFailsClosed(code, (row) => { row.source.source_response_sha256 = '0'.repeat(64); });
      assertMutationFailsClosed(code, (row) => { row.source.source_response_bytes += 1; });
      assertMutationFailsClosed(code, (row) => { row.source.raw_entry_text += ' '; });
      assertMutationFailsClosed(code, (row) => { row.source.raw_entry_sha256 = '1'.repeat(64); });
      assertMutationFailsClosed(code, (row) => { row.source.raw_entry_html_sha256 = '2'.repeat(64); });
      assertMutationFailsClosed(code, (row) => { row.source.published_units.credit_hours_max += 1; });
      assertMutationFailsClosed(code, (row) => {
        row.source.complete_entry_receipt.same_source_positive_control = false;
      });
      assertMutationFailsClosed(code, (row) => {
        row.source.complete_entry_receipt.source_complete_entry_count -= 1;
      });
      assertMutationFailsClosed(code, (row) => {
        row.source.structured_requisite_fields[0].raw += ' ';
      });
      assertMutationFailsClosed(code, (row) => {
        row.source.structured_requisite_fields[0].raw_field_html_sha256 = '3'.repeat(64);
      });
      assertMutationFailsClosed(code, (row) => {
        row.source.structured_requisite_fields[0].relative_start += 1;
      });
      if (byCode.get(code).source.browser_challenge_receipt) {
        assertMutationFailsClosed(code, (row) => {
          row.source.browser_challenge_receipt.document_responses[1].content_sha256
            = '4'.repeat(64);
        });
        assertMutationFailsClosed(code, (row) => {
          row.source.robots_receipt.parsed_policy.policy_sha256 = '5'.repeat(64);
        });
        assertMutationFailsClosed(code, (row) => {
          row.source.sitemap_discovery_receipt.locations_sha256 = '6'.repeat(64);
        });
      } else {
        assertMutationFailsClosed(code, (row) => {
          row.source.retained_source_text_sha256 = '7'.repeat(64);
        });
      }
    }
  });

  it('rejects attempts to make ambiguity disappear by editing only the displayed field', () => {
    const replacements = {
      CS4664: 'CS 3114 and (CS 3654 or CMDA 3654 or STAT 3654)',
      MATH3414:
        '((CS 1044 or CS 1705 or CS 1114 or CS 1124) and MATH 2406H) or (CMDA 2005 and CMDA 2006)',
      MATH4445:
        'MATH 2406H or (CMDA 2005 and CMDA 2006) or ((MATH 2214 or MATH 2214H) and (MATH 2204 or MATH 2204H))',
    };
    for (const code of AMBIGUOUS_CODES) {
      assertMutationFailsClosed(code, (row) => {
        row.source.structured_requisite_fields[0].raw = replacements[code];
      });
    }
  });

  it('does not generalize to another Virginia Tech or non-Virginia-Tech row', () => {
    expect(resolveVirginiaTechPrerequisiteCandidate(byCode.get('CS1114'))).toEqual({
      applicable: false,
      ready: false,
      issues: [],
    });
    expect(resolveVirginiaTechPrerequisiteCandidate({
      school_id: 1,
      slug: 'california-example',
      owner_namespace: 'ca:uni:1',
      course_key: 'ca:uni:1:CS1114',
      course_code: 'CS1114',
      source: {},
    })).toEqual({ applicable: false, ready: false, issues: [] });
  });
});
