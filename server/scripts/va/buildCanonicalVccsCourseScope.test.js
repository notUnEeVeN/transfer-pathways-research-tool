import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OUTPUT,
  buildCanonicalCourseScope,
  serializedScope,
  validateCheckedInScope,
} from './buildCanonicalVccsCourseScope';
import { cachedAcceptedSourcePlan } from '../importVirginiaCatalogDegrees';
import { parseCourseKey } from '../../services/virginia/courseIdentity';

describe('canonical Virginia community-college prerequisite scope', () => {
  it('independently projects every paired identity from 19 distinct raw source plans', () => {
    const plan = cachedAcceptedSourcePlan();
    const documents = plan.documents.filter((document) => document.kind === 'as_degree');
    const names = new Map(plan.registry.institutions.map((institution) => (
      [institution.slug, institution.name]
    )));
    const owners = new Map();
    const authorities = new Map();
    let concreteOptions = 0;
    let concreteIdentities = 0;

    expect(documents).toHaveLength(19);
    expect(new Set(documents.map((document) => document.community_college_id)).size).toBe(19);
    for (const document of documents) {
      const slug = document.community_college_id.replace(/^va:cc:/, '');
      const college = names.get(slug);
      const expectedInstitution = slug === 'richard-bland-college'
        ? 'va:cc:richard-bland-college' : 'va:vccs';
      const options = (document.requirement_groups || []).flatMap((group) => (
        (group.sections || []).flatMap((section) => (
          (section.receivers || []).flatMap((receiver) => receiver.options || [])
        ))
      ));
      for (const option of options) {
        const ids = option.course_ids || [];
        const keys = option.course_keys || [];
        expect(ids).toHaveLength(keys.length);
        if (keys.length) concreteOptions += 1;
        for (const [index, key] of keys.entries()) {
          const identity = parseCourseKey(key);
          expect(identity).not.toBeNull();
          expect(Number(ids[index])).toBe(identity.course_id);
          expect(identity.institution_id).toBe(expectedInstitution);
          concreteIdentities += 1;
          if (!owners.has(identity.code)) owners.set(identity.code, new Set());
          if (!authorities.has(identity.code)) authorities.set(identity.code, new Set());
          owners.get(identity.code).add(college);
          authorities.get(identity.code).add(identity.institution_id);
        }
      }
    }
    const rows = [...owners]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, colleges]) => ({ code, colleges: [...colleges].sort() }));
    expect({ concreteOptions, concreteIdentities, codes: rows.length }).toEqual({
      concreteOptions: 1410,
      concreteIdentities: 1425,
      codes: 260,
    });
    expect([...authorities.values()].filter((ids) => ids.has('va:vccs'))).toHaveLength(184);
    expect([...authorities.values()].filter((ids) => (
      ids.has('va:cc:richard-bland-college')
    ))).toHaveLength(76);
    expect([...authorities.values()].filter((ids) => ids.size > 1)).toHaveLength(0);
    expect(JSON.parse(fs.readFileSync(DEFAULT_OUTPUT, 'utf8'))).toEqual(rows);
  });

  it('is byte-derived from the same 19 accepted associate documents used by the figures', () => {
    const built = buildCanonicalCourseScope();
    expect(built.report).toMatchObject({
      accepted_associate_documents: 19,
      direct_course_codes: 260,
      vccs_course_codes: 184,
      richard_bland_course_codes: 76,
      cross_authority_course_codes: 0,
    });
    expect(fs.readFileSync(DEFAULT_OUTPUT, 'utf8')).toBe(serializedScope(built.rows));
    expect(validateCheckedInScope()).toMatchObject({ ready: true, issue: null });
  });

  it('retains exact owner provenance and never merges Richard Bland into VCCS authority', () => {
    const { rows } = buildCanonicalCourseScope();
    expect(rows.find((row) => row.code === 'CSC221')?.colleges)
      .toEqual(expect.arrayContaining([
        'Blue Ridge Community College',
        'Brightpoint Community College',
      ]));
    expect(rows.find((row) => row.code === 'CSCI221')).toEqual({
      code: 'CSCI221',
      colleges: ['Richard Bland College'],
    });
    expect(rows.some((row) => (
      row.colleges.includes('Richard Bland College')
        && row.colleges.some((college) => /Community College$/.test(college))
    ))).toBe(false);
  });

  it('fails closed when an accepted option crosses owner namespaces', () => {
    const plan = structuredClone(cachedAcceptedSourcePlan());
    const vccs = plan.documents.find((document) => (
      document.kind === 'as_degree'
        && document.community_college_id !== 'va:cc:richard-bland-college'
    ));
    const option = vccs.requirement_groups[0].sections[0].receivers[0].options[0];
    option.course_keys[0] = 'va:cc:richard-bland-college:CSC221';
    option.course_ids[0] = parseCourseKey(option.course_keys[0]).course_id;
    expect(() => buildCanonicalCourseScope(plan)).toThrow(/ownership boundary/);
  });

  it('fails closed when course ids and source keys stop being one-to-one', () => {
    const plan = structuredClone(cachedAcceptedSourcePlan());
    const associate = plan.documents.find((document) => document.kind === 'as_degree');
    const option = associate.requirement_groups[0].sections[0].receivers[0].options[0];
    option.course_keys = [];
    expect(() => buildCanonicalCourseScope(plan)).toThrow(/course ids but 0 source keys/);
  });

  it('fails closed when a numeric id is paired with a different valid source key', () => {
    const plan = structuredClone(cachedAcceptedSourcePlan());
    const associate = plan.documents.find((document) => document.kind === 'as_degree');
    const option = associate.requirement_groups[0].sections[0].receivers[0].options[0];
    option.course_ids[0] += 1;
    expect(() => buildCanonicalCourseScope(plan)).toThrow(/does not match source key/);
  });

  it('requires 19 distinct source owners rather than accepting a duplicated college', () => {
    const plan = structuredClone(cachedAcceptedSourcePlan());
    plan.documents = plan.documents.filter((document) => document.kind !== 'degree');
    plan.documents[1].community_college_id = plan.documents[0].community_college_id;
    plan.documents[1].college_id = plan.documents[0].college_id;
    expect(() => buildCanonicalCourseScope(plan)).toThrow(/one accepted source per college/);
  });
});
