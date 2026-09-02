import { describe, expect, it } from 'vitest';
import {
  institutionCourseIdentity,
  sharedCourseIdentity,
} from './courseIdentity';
import { auditCourseIdentityResolution } from './courseIdentityAudit';

const RBC = 'va:cc:richard-bland-college';
const namespace = {
  kind: 'institution_local',
  institution_id: RBC,
  vccs_master_applicable: false,
  identity_contract: 'owner_plus_course_id',
  scoped_key_format: `${RBC}:<code>`,
};

function degreeFor(identities, extra = {}) {
  return {
    _id: 'va:as:richard-bland-college:cs',
    college_id: RBC,
    college_name: 'Richard Bland College',
    course_namespace: namespace,
    requirement_groups: [{ sections: [{ receivers: [{ options: [{
      course_ids: identities.map((identity) => identity.course_id),
      course_keys: identities.map((identity) => identity.course_key),
    }] }] }] }],
    ...extra,
  };
}

const exactUnits = (units = 3) => ({ units, min_units: units, max_units: units });

describe('Virginia course identity publication audit', () => {
  it('resolves Richard Bland citations only to owner-scoped rows', () => {
    const identities = ['MATH251', 'PHYS201', 'PHYS202']
      .map((code) => institutionCourseIdentity(RBC, code));
    const result = auditCourseIdentityResolution(
      [degreeFor(identities)],
      identities.map((identity) => ({
        _id: `local:${identity.code}`, ...identity, ...exactUnits(4),
      })),
    );
    expect(result).toMatchObject({
      publication_ready: true,
      stats: { references: 3, resolved: 3, issues: 0 },
    });
  });

  it.each(['MATH251', 'PHYS201', 'PHYS202'])(
    'reports rather than resolving %s through a same-code shared row',
    (code) => {
      const local = institutionCourseIdentity(RBC, code);
      const unrelated = sharedCourseIdentity(code);
      const result = auditCourseIdentityResolution(
        [degreeFor([local])],
        [{
          _id: `shared:${code}`,
          ...unrelated,
          ...exactUnits(),
          title: 'Unrelated same-code course',
        }],
      );
      expect(result.publication_ready).toBe(false);
      expect(result.stats).toMatchObject({ references: 1, resolved: 0, issues: 1 });
      expect(result.issues[0]).toMatchObject({
        code,
        issue: 'course_row_scope_mismatch',
        expected: {
          institution_id: RBC,
          identity_scope: 'institution_local',
        },
        candidates: [expect.objectContaining({
          institution_id: 'va:vccs',
          identity_scope: 'vccs_shared',
        })],
      });
    },
  );

  it('preserves VCCS shared-master supply while checking the selected college', () => {
    const shared = sharedCourseIdentity('CSC221');
    const doc = degreeFor([shared], {
      _id: 'va:as:blue-ridge-community-college:cs',
      college_id: 9301,
      college_name: 'Blue Ridge Community College',
      course_namespace: null,
    });
    const offered = {
      _id: 'shared:CSC221', ...shared, ...exactUnits(), offered_by_ids: [9301],
    };
    expect(auditCourseIdentityResolution([doc], [offered]).publication_ready).toBe(true);

    const unavailable = auditCourseIdentityResolution([doc], [{
      ...offered, offered_by_ids: [9302],
    }]);
    expect(unavailable.issues).toEqual([
      expect.objectContaining({ issue: 'course_not_offered_by_degree_owner', code: 'CSC221' }),
    ]);
  });

  it('audits projected cc:id mirrors through their preserved Virginia source keys', () => {
    const shared = sharedCourseIdentity('CSC221');
    const doc = degreeFor([shared], {
      _id: 'as_degree:9301:va-cs:local_as',
      college_id: 'va:cc:9301',
      community_college_id: 9301,
      college_name: 'Blue Ridge Community College',
      course_namespace: null,
    });
    const option = doc.requirement_groups[0].sections[0].receivers[0].options[0];
    option.source_course_keys = [...option.course_keys];
    option.course_keys = [`cc:${shared.course_id}`];

    const result = auditCourseIdentityResolution([doc], [{
      _id: 'shared:CSC221',
      ...shared,
      ...exactUnits(),
      offered_by_ids: [9301],
    }]);
    expect(result).toMatchObject({
      publication_ready: true,
      stats: { references: 1, resolved: 1, issues: 0 },
    });
  });

  it('fails closed when a referenced course has no single source-backed unit value', () => {
    const shared = sharedCourseIdentity('MTH263');
    const doc = degreeFor([shared], {
      _id: 'va:as:blue-ridge-community-college:cs',
      college_id: 9301,
      college_name: 'Blue Ridge Community College',
      course_namespace: null,
    });
    const result = auditCourseIdentityResolution([doc], [{
      _id: 'shared:MTH263',
      ...shared,
      offered_by_ids: [9301],
      units: null,
      min_units: 3,
      max_units: 4,
    }]);

    expect(result.publication_ready).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        issue: 'course_units_missing_or_ambiguous',
        code: 'MTH263',
      }),
    ]);
  });

  it('uses an exact owner-degree unit override instead of a conflicting shared default', () => {
    const shared = sharedCourseIdentity('CSC195');
    const sourceId = 'va:as:brightpoint-community-college:cs';
    const doc = degreeFor([shared], {
      _id: 'as_degree:9302:va-cs:local_as',
      va_requirement_id: sourceId,
      college_id: 'va:cc:9302',
      community_college_id: 9302,
      college_name: 'Brightpoint Community College',
      course_namespace: null,
    });
    const result = auditCourseIdentityResolution([doc], [{
      _id: 'shared:CSC195',
      ...shared,
      ...exactUnits(1),
      offered_by_ids: [9302],
      units_by_source_requirement: [{
        source_requirement_id: sourceId,
        ...exactUnits(3),
      }],
    }]);

    expect(result).toMatchObject({
      publication_ready: true,
      stats: { references: 1, resolved: 1, issues: 0 },
      resolved: [expect.objectContaining({
        code: 'CSC195',
        units: 3,
        unit_source_requirement_id: sourceId,
      })],
    });
  });

  it('resolves and owner-checks inactive requirement variants', () => {
    const top = sharedCourseIdentity('CSC221');
    const variant = sharedCourseIdentity('CSC222');
    const variantGroups = degreeFor([variant]).requirement_groups;
    const doc = degreeFor([top], {
      _id: 'as_degree:9301:va-cs:local_as',
      va_requirement_id: 'va:as:blue-ridge-community-college:cs',
      college_id: 'va:cc:9301', community_college_id: 9301,
      college_name: 'Blue Ridge Community College', course_namespace: null,
      requirement_variants: [{
        id: 'inactive', selected: false, requirement_groups: variantGroups,
      }],
    });
    const rows = [top, variant].map((identity) => ({
      _id: `shared:${identity.code}`, ...identity, ...exactUnits(), offered_by_ids: [9301],
    }));
    expect(auditCourseIdentityResolution([doc], rows)).toMatchObject({
      publication_ready: true,
      stats: { references: 2, resolved: 2, issues: 0 },
      resolved: [
        expect.objectContaining({ path: expect.stringContaining('requirement_groups[0]') }),
        expect.objectContaining({ path: expect.stringContaining('requirement_variants[0]') }),
      ],
    });

    const missing = auditCourseIdentityResolution([doc], rows.slice(0, 1));
    expect(missing.issues).toContainEqual(expect.objectContaining({
      path: expect.stringContaining('requirement_variants[0]'),
      issue: 'course_row_missing', code: 'CSC222',
    }));

    rows[1].offered_by_ids = [9302];
    const wrongOwner = auditCourseIdentityResolution([doc], rows);
    expect(wrongOwner.issues).toContainEqual(expect.objectContaining({
      path: expect.stringContaining('requirement_variants[0]'),
      issue: 'course_not_offered_by_degree_owner', code: 'CSC222',
    }));
  });
});
