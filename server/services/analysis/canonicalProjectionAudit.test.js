import { describe, expect, it } from 'vitest';
import { auditCanonicalProjection } from './canonicalProjectionAudit';
import { canonicalSourceContract } from './canonicalSourceContract';
import { courseIdFor, institutionCourseIdentity } from '../virginia/courseIdentity';

const receivingIdentity = institutionCourseIdentity('va:uni:1', 'CS101');

const projection = () => ({
  institutions: [
    { _id: 'va:uni:1', institution_id: 'va:uni:1', kind: 'university', source_id: 1, name: 'U', state: 'va' },
    { _id: 'va:cc:2', institution_id: 'va:cc:2', kind: 'community_college', source_id: 2, name: 'C', state: 'va' },
  ],
  courses: [
    {
      _id: `va:r:${receivingIdentity.course_id}`,
      side: 'receiving', source_id: receivingIdentity.course_id,
      source_parent_id: courseIdFor('CS101'),
      parent_id: receivingIdentity.course_id, institution_id: 'va:uni:1',
      code: 'CS101', course_key: receivingIdentity.course_key,
      identity_scope: 'institution_local', identity_contract: 'owner_plus_course_id',
      vccs_master_applicable: false,
      prefix: 'CS', number: '101', title: 'Programming I',
      units: 3, min_units: 3, max_units: 3, unit_evidence: 'official_course_row', state: 'va',
    },
    {
      _id: 'va:s:20', side: 'sending', source_id: 20, course_id: 20,
      course_key: 'va:CSC1', institution_id: 'va:vccs',
      code: 'CSC1', prefix: 'CSC', number: '1', state: 'va',
    },
  ],
  degrees: [{
    _id: 'degree:1:va-cs', kind: 'degree', state: 'va', school_id: 1,
    institution_id: 'va:uni:1', major_slug: 'va-cs', program: 'Computer Science, B.S.',
    total_units: 120, unit_system: 'semester', va_requirement_id: 'source:degree',
    analysis_contract: canonicalSourceContract(),
    course_titles: { CS101: 'Programming I' },
    course_unit_evidence: [{ code: 'CS101', units: 3 }],
    requirement_groups: [{ group_conjunction: 'And', sections: [{ receivers: [{
      code_seen: 'CS101',
      receiving: { kind: 'course', parent_id: receivingIdentity.course_id }, options: [],
    }] }] }],
  }],
  asDegrees: [{
    _id: 'as_degree:2:va-cs:local_as', kind: 'as_degree', status: 'found', state: 'va',
    community_college_id: 2, college_id: 'va:cc:2', major_slug: 'va-cs', degree_type: 'local_as',
    total_units: 60, unit_system: 'semester', va_requirement_id: 'source:as',
    analysis_contract: canonicalSourceContract(),
    requirement_groups: [{ group_conjunction: 'And', sections: [{ receivers: [{
      receiving: null, options_conjunction: 'or',
      options: [{ course_ids: [20], course_conjunction: 'and' }],
    }] }] }],
    requirement_variants: [{
      id: 'inactive', selected: false,
      requirement_groups: [{ group_conjunction: 'And', sections: [{ receivers: [{
        receiving: null, options_conjunction: 'and',
        options: [{ course_ids: [20], course_conjunction: 'and' }],
      }] }] }],
    }],
  }],
  agreements: [{
    _id: 'agreement:1:2', state: 'va', uc_school_id: 1, community_college_id: 2,
    major: 'Computer Science, B.S.',
    source_named_offerings_contract: 'va-associate-requirement-course-offer-v1',
    source_named_offerings_count: 0,
    source_named_offerings_sha256: '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945',
    source_named_offerings: [],
    requirement_groups: [{
      group_conjunction: 'And', sections: [{ receivers: [{
        code_seen: 'CS101',
        receiving: { kind: 'course', parent_id: receivingIdentity.course_id },
        options: [{ course_ids: [20], course_conjunction: 'and' }],
      }] }],
    }],
  }],
});

describe('shared-schema projection audit', () => {
  it('accepts one referentially closed canonical projection', () => {
    expect(auditCanonicalProjection(projection())).toMatchObject({ ready: true, issues: [] });
  });

  it('fails missing contracts, dangling ids, inferred conjunctions, and state leakage', () => {
    const value = projection();
    delete value.asDegrees[0].analysis_contract;
    value.asDegrees[0].requirement_groups[0].group_conjunction = null;
    value.asDegrees[0].requirement_groups[0].sections[0].receivers[0]
      .options[0].course_ids = [999];
    value.agreements[0].state = 'ca';
    const report = auditCanonicalProjection(value);
    expect(report.ready).toBe(false);
    expect(report.issues.map((row) => row.code)).toEqual(expect.arrayContaining([
      'analysis_contract_required',
      'explicit_group_conjunction_required',
      'sending_course_reference_missing',
      'projection_state_mismatch',
    ]));
  });

  it('rejects null, duplicate, and mismatched numeric identities', () => {
    const value = projection();
    value.institutions[0].source_id = null;
    value.courses.push({
      ...value.courses[1],
      _id: 'va:s:duplicate',
      source_id: 999,
    });

    const report = auditCanonicalProjection(value);
    expect(report.ready).toBe(false);
    expect(report.issues.map((row) => row.code)).toEqual(expect.arrayContaining([
      'numeric_source_id_required',
      'sending_course_id_collision',
      'sending_source_id_mismatch',
    ]));
  });

  it('fails closed on a forged source-named offering receipt', () => {
    const value = projection();
    value.agreements[0].source_named_offerings_count = 1;
    const report = auditCanonicalProjection(value);
    expect(report.issues.map((row) => row.code)).toContain(
      'source_named_offerings_contract_mismatch',
    );
  });

  it('audits inactive associate variants instead of silently skipping them', () => {
    const value = projection();
    value.asDegrees[0].requirement_variants[0].requirement_groups[0]
      .sections[0].receivers[0].options[0].course_ids = [999];
    const report = auditCanonicalProjection(value);
    expect(report.issues).toContainEqual(expect.objectContaining({
      path: expect.stringContaining('requirement_variants[0]'),
      code: 'sending_course_reference_missing',
    }));
  });

  it('retains same-code receiving courses with different owner units and rejects cross-owner refs', () => {
    const value = projection();
    const other = institutionCourseIdentity('va:uni:3', 'CS101');
    value.institutions.push({
      _id: 'va:uni:3', institution_id: 'va:uni:3', kind: 'university',
      source_id: 3, name: 'Other U', state: 'va',
    });
    value.courses[0].min_units = 3;
    value.courses[0].max_units = 3;
    value.courses.push({
      _id: `va:r:${other.course_id}`,
      side: 'receiving', source_id: other.course_id, parent_id: other.course_id,
      source_parent_id: courseIdFor('CS101'),
      institution_id: 'va:uni:3', code: 'CS101', course_key: other.course_key,
      identity_scope: 'institution_local', identity_contract: 'owner_plus_course_id',
      vccs_master_applicable: false,
      prefix: 'CS', number: '101', units: 4, min_units: 4, max_units: 4, state: 'va',
      title: 'Programming I', unit_evidence: 'official_course_row',
    });
    value.degrees.push({
      ...structuredClone(value.degrees[0]),
      _id: 'degree:3:va-cs', school_id: 3, institution_id: 'va:uni:3',
      va_requirement_id: 'source:degree:3',
      course_unit_evidence: [{ code: 'CS101', units: 4 }],
      requirement_groups: [{ group_conjunction: 'And', sections: [{ receivers: [{
        code_seen: 'CS101',
        receiving: { kind: 'course', parent_id: other.course_id }, options: [],
      }] }] }],
    });

    expect(other.course_id).not.toBe(receivingIdentity.course_id);
    expect(auditCanonicalProjection(value)).toMatchObject({ ready: true, issues: [] });

    value.degrees[1].requirement_groups[0].sections[0]
      .receivers[0].receiving.parent_id = receivingIdentity.course_id;
    const report = auditCanonicalProjection(value);
    expect(report.ready).toBe(false);
    expect(report.issues.map((row) => row.code)).toEqual(expect.arrayContaining([
      'receiving_reference_identity_mismatch',
      'receiving_course_owner_mismatch',
    ]));
  });
});
