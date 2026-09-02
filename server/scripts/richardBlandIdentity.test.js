import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  courseIdFor,
  institutionCourseIdFor,
  institutionCourseKeyFor,
} from '../services/virginia/courseIdentity';
import { auditCourseIdentityResolution } from '../services/virginia/courseIdentityAudit';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const slug = 'richard-bland-college';
const owner = `va:cc:${slug}`;

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
  it('materializes the validated namespace into owner-scoped option identities', () => {
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

    const options = doc.requirement_groups.flatMap((group) => group.sections || [])
      .flatMap((section) => section.receivers || [])
      .flatMap((receiver) => receiver.options || []);
    for (const code of ['MATH251', 'PHYS201', 'PHYS202']) {
      const key = institutionCourseKeyFor(owner, code);
      const option = options.find((candidate) => candidate.course_keys.includes(key));
      expect(option, `${code} is referenced through its owner-scoped key`).toBeTruthy();
      expect(option.course_ids[option.course_keys.indexOf(key)])
        .toBe(institutionCourseIdFor(owner, code));
      expect(option.course_ids).not.toContain(courseIdFor(code));
      expect(doc.institution_course_catalog).toContainEqual(expect.objectContaining({
        code,
        course_id: institutionCourseIdFor(owner, code),
        course_key: key,
        institution_id: owner,
        identity_scope: 'institution_local',
        title: doc.course_titles[code],
        units: 4,
        unit_evidence: 'single_course_source_section',
      }));
    }
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

  it.each(['MATH251', 'PHYS201', 'PHYS202'])(
    'rejects a legacy global %s identity even when its code is readable',
    (code) => {
      const { doc, institution } = build();
      const candidate = structuredClone(doc);
      const localKey = institutionCourseKeyFor(owner, code);
      const option = candidate.requirement_groups.flatMap((group) => group.sections || [])
        .flatMap((section) => section.receivers || [])
        .flatMap((receiver) => receiver.options || [])
        .find((entry) => entry.course_keys.includes(localKey));
      const index = option.course_keys.indexOf(localKey);
      option.course_ids[index] = courseIdFor(code);
      option.course_keys[index] = `va:${code}`;

      const result = validateDegreeAcceptance(candidate, {
        institutionLevel: institution.level,
        resolveCourse: () => true,
      });
      expect(result.catalog.checks.find((check) => check.name === 'receiver_structure'))
        .toMatchObject({
          severity: 'fail',
          issues: expect.arrayContaining([
            expect.objectContaining({
              reason: 'course ids/keys must include the owning institution namespace',
            }),
          ]),
        });
      expect(result.ready_for_analysis).toBe(false);
    },
  );

  it('passes the publication audit using exact source-row units and no shared impostors', () => {
    const { doc } = build();
    const result = auditCourseIdentityResolution([doc], [
      ...doc.institution_course_catalog.map((row) => ({
        _id: `va:sending:${row.institution_id}:${row.code}`,
        ...row,
      })),
      ...['MATH251', 'PHYS201', 'PHYS202'].map((code) => ({
        _id: `unrelated:${code}`,
        code,
        course_id: courseIdFor(code),
        course_key: `va:${code}`,
        institution_id: 'va:vccs',
        identity_scope: 'vccs_shared',
        identity_contract: 'vccs_master_course_code',
        vccs_master_applicable: true,
      })),
    ]);
    expect(result).toMatchObject({
      publication_ready: true,
      stats: { references: 93, resolved: 93, issues: 0 },
    });
  });
});
