import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { courseIdFor } from '../services/virginia/courseIdentity';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const slug = 'richard-bland-college';

function fixture() {
  const institution = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'),
  ).institutions.find((row) => row.slug === slug);
  const extract = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'requirements', `${slug}.json`), 'utf8'),
  );
  const composition = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'composed', `${slug}.json`), 'utf8'),
  );
  return { institution, extract, composition };
}

function build(compositionOverride = null) {
  const { institution, extract, composition } = fixture();
  const selectedComposition = compositionOverride || composition;
  const credits = new Map();
  const doc = toDocument(extract, institution, credits, selectedComposition);
  const acceptance = validateDegreeAcceptance(doc, {
    institutionLevel: institution.level,
    resolveCourse: acceptanceResolver(doc, credits),
  });
  return { acceptance, composition: selectedComposition, doc, extract, institution };
}

const identityCheck = (acceptance) => acceptance.catalog.checks
  .find((check) => check.name === 'identity');

describe('Richard Bland institution-local course identity', () => {
  it('preserves the validated namespace without changing legacy option identities', () => {
    const { acceptance, composition, doc } = build();
    expect(doc.course_namespace).toEqual(composition.course_namespace);
    expect(doc.course_namespace).toEqual({
      kind: 'institution_local',
      institution_id: 'va:cc:richard-bland-college',
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: 'va:cc:richard-bland-college:<code>',
      source_refs: ['major'],
    });

    const math251 = doc.requirement_groups.flatMap((group) => group.sections || [])
      .flatMap((section) => section.receivers || [])
      .flatMap((receiver) => receiver.options || [])
      .find((option) => option.course_keys.includes('va:MATH251'));
    expect(math251.course_ids[math251.course_keys.indexOf('va:MATH251')])
      .toBe(courseIdFor('MATH251'));
    expect(acceptance.accepted).toBe(true);
    expect(identityCheck(acceptance)).toMatchObject({ severity: 'pass' });
  });

  it('fails composition import on forged, incomplete, or uncited local namespaces', () => {
    const { composition } = fixture();
    for (const courseNamespace of [
      { ...composition.course_namespace, institution_id: 'va:cc:another-college' },
      { ...composition.course_namespace, identity_contract: undefined },
      { ...composition.course_namespace, scoped_key_format: 'va:MATH251' },
      { ...composition.course_namespace, source_refs: ['missing'] },
    ]) {
      expect(() => build({ ...composition, course_namespace: courseNamespace }))
        .toThrow(/invalid or unsupported course_namespace/);
    }
  });

  it('rejects a saved Richard Bland document if its required namespace is removed or altered', () => {
    const { doc, institution } = build();
    const validate = (candidate) => validateDegreeAcceptance(candidate, {
      institutionLevel: institution.level,
      resolveCourse: () => true,
    });

    const missing = structuredClone(doc);
    delete missing.course_namespace;
    expect(identityCheck(validate(missing))).toMatchObject({
      severity: 'fail',
      issues: expect.arrayContaining([
        'course_namespace is required for this institution-local catalog',
      ]),
    });

    const forged = structuredClone(doc);
    forged.course_namespace.identity_contract = 'global_code_hash';
    expect(identityCheck(validate(forged))).toMatchObject({
      severity: 'fail',
      issues: expect.arrayContaining([
        'course_namespace.identity_contract must be owner_plus_course_id',
      ]),
    });
  });
});
