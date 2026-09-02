import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256,
  CNU_CPEN371W_EVIDENCE_CACHE_PATH,
  VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256,
  VSU_ARABIC_EVIDENCE_CACHE_PATH,
  validateAcquisitionArtifact,
} from './universityPrerequisiteAcquisition';
import {
  validateUniversityPrerequisiteCandidates,
} from './universityPrerequisiteCandidates';
import {
  reviewCandidate,
  validateUniversityPrerequisiteReview,
} from './universityPrerequisiteReview';

const require = createRequire(import.meta.url);
const {
  buildFromCache: buildAcquisition,
  planFromArtifacts,
} = require('../../scripts/va/acquireUniversityPrerequisites');
const {
  buildFromCache: buildCandidates,
} = require('../../scripts/va/buildUniversityPrerequisiteCandidates');
const {
  buildFromArtifacts: buildReview,
} = require('../../scripts/va/buildUniversityPrerequisiteReview');

const SERVER = path.resolve(__dirname, '../..');
const RESEARCH = path.join(SERVER, '.va-catalogs', 'research');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(RESEARCH, name), 'utf8'));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const clone = (value) => JSON.parse(JSON.stringify(value));

const CNU_KEY = 'va:uni:9206:CPEN371W';
const VSU_KEYS = ['ARAB110', 'ARAB111', 'ARAB212', 'ARAB213']
  .map((code) => `va:uni:9231:${code}`);

describe('exact owner evidence integration for CNU CPEN371W and VSU Arabic', () => {
  it('pins the retained evidence bytes and replaces only the five failed routes', () => {
    expect(sha256(fs.readFileSync(path.join(SERVER, '.va-catalogs', CNU_CPEN371W_EVIDENCE_CACHE_PATH))))
      .toBe(CNU_CPEN371W_EVIDENCE_ARTIFACT_SHA256);
    expect(sha256(fs.readFileSync(path.join(SERVER, '.va-catalogs', VSU_ARABIC_EVIDENCE_CACHE_PATH))))
      .toBe(VSU_ARABIC_EVIDENCE_ARTIFACT_SHA256);

    const plan = planFromArtifacts();
    const cnu = plan.routes.find((route) => (
      route.platform === 'cnu_cpen371w_current_joint_evidence'
    ));
    const cnuLegacy = plan.routes.find((route) => route.platform === 'pdf_bbox_columns');
    const vsu = plan.routes.find((route) => (
      route.platform === 'vsu_arabic_current_department_evidence'
    ));
    expect(cnu.target_course_codes).toEqual(['CPEN371W']);
    expect(cnu.alias_scope).toBe('CPEN371W_only');
    expect(cnuLegacy.target_course_codes).not.toContain('CPEN371W');
    expect(vsu.target_course_codes).toEqual(['ARAB110', 'ARAB111', 'ARAB212', 'ARAB213']);
    expect(plan.routes.some((route) => (
      route.route_id === 'virginia-state-university__arab'
    ))).toBe(false);
  });

  it('replays deterministically through acquisition, candidates, and review', () => {
    const plan = planFromArtifacts();
    const acquisition = buildAcquisition(plan);
    expect(validateAcquisitionArtifact(acquisition, { plan })).toEqual({ valid: true, issues: [] });
    expect(acquisition).toEqual(readJson('va-university-prerequisite-acquisition.json'));

    const candidates = buildCandidates();
    expect(validateUniversityPrerequisiteCandidates(candidates).valid).toBe(true);
    expect(candidates).toEqual(readJson('va-university-prerequisite-candidates.json'));

    const review = buildReview();
    expect(validateUniversityPrerequisiteReview(review, {
      scope: readJson('va-university-prerequisite-scope.json'),
      candidates,
    }).valid).toBe(true);
    expect(review).toEqual(readJson('va-university-prerequisite-review.json'));
  });

  it('preserves the exact alias, non-course restriction, and OR-equivalent formulas', () => {
    const candidates = readJson('va-university-prerequisite-candidates.json');
    const byKey = new Map(candidates.candidates.map((row) => [row.course_key, row]));
    const cnu = reviewCandidate(byKey.get(CNU_KEY));
    expect(cnu.status).toBe('parsed');
    expect(cnu.groups[0].paths[0].all_of).toMatchObject([
      { type: 'course', code: 'ENGL223', minimum_grade: 'C-' },
      {
        type: 'non_course',
        condition: 'pcse_major_or_minor',
        eligible_academic_program_roles: ['major', 'minor'],
      },
    ]);

    const arab110 = reviewCandidate(byKey.get(VSU_KEYS[0]));
    expect(arab110.status).toBe('parsed');
    expect(arab110.groups).toHaveLength(1);
    expect(arab110.groups[0]).toMatchObject({
      kind: 'prerequisite',
      paths: [{
        all_of: [{
          type: 'non_course',
          condition: 'no_admission_credit_in_arabic',
          admission_credit_allowed: false,
        }],
      }],
    });

    for (const key of VSU_KEYS.slice(1)) {
      const reviewed = reviewCandidate(byKey.get(key));
      expect(reviewed.status).toBe('parsed');
      expect(reviewed.groups[0].paths).toHaveLength(2);
      expect(reviewed.groups[0].paths[0].all_of[0].type).toBe('course');
      expect(reviewed.groups[0].paths[1].all_of[0]).toMatchObject({
        type: 'non_course',
        equivalent_to_course_code: reviewed.groups[0].paths[0].all_of[0].code,
      });
    }
  });

  it('fails closed if the CNU alias broadens or ARAB110 is made to look silent', () => {
    const plan = planFromArtifacts();
    const acquisition = buildAcquisition(plan);
    const broadened = clone(acquisition);
    const cnu = broadened.entries.find((row) => row.course_key === CNU_KEY);
    cnu.identity_resolution.broad_suffix_alias_rule_created = true;
    expect(validateAcquisitionArtifact(broadened, { plan }).issues)
      .toContain(`${CNU_KEY}:cnu_cpen371w_exact_current_identity_or_prerequisite_receipt`);

    const silent = clone(acquisition);
    const arab110 = silent.entries.find((row) => row.course_key === VSU_KEYS[0]);
    arab110.enrollment_restriction = null;
    arab110.semantic_prerequisite = null;
    expect(validateAcquisitionArtifact(silent, { plan }).issues)
      .toContain(`${VSU_KEYS[0]}:vsu_arabic_exact_department_entry_or_constraint_receipt`);
  });

  it('rejects dropping an equivalent path or rewriting ARAB110 as none in review', () => {
    const scope = readJson('va-university-prerequisite-scope.json');
    const candidates = readJson('va-university-prerequisite-candidates.json');
    const review = buildReview();

    const droppedEquivalent = clone(review);
    const arab111 = droppedEquivalent.review_rows.find((row) => row.course_key === VSU_KEYS[1]);
    arab111.groups[0].paths.pop();
    expect(validateUniversityPrerequisiteReview(droppedEquivalent, { scope, candidates }).issues)
      .toContain(`${VSU_KEYS[1]}:vsu_arabic_review_receipt`);

    const falseNone = clone(review);
    const arab110 = falseNone.review_rows.find((row) => row.course_key === VSU_KEYS[0]);
    arab110.status = 'none';
    arab110.raw_requisites = null;
    arab110.groups = [];
    expect(validateUniversityPrerequisiteReview(falseNone, { scope, candidates }).issues)
      .toContain(`${VSU_KEYS[0]}:vsu_arabic_review_receipt`);
  });

  it('introduces no unresolved dependency from the five newly resolved rows', () => {
    const review = readJson('va-university-prerequisite-review.json');
    const byKey = new Map(review.review_rows.map((row) => [row.course_key, row]));
    expect(byKey.get('va:uni:9206:ENGL223')).toMatchObject({
      status: 'parsed',
      review_status: 'promoted_strict_formula',
    });
    for (const key of [CNU_KEY, ...VSU_KEYS]) {
      expect(byKey.get(key)).toMatchObject({
        status: 'parsed',
        review_status: 'promoted_strict_formula',
      });
    }
    const newReferences = new Set([CNU_KEY, ...VSU_KEYS].flatMap((key) => (
      byKey.get(key).groups.flatMap((group) => group.paths.flatMap((formulaPath) => (
        formulaPath.all_of.filter((condition) => condition.type === 'course')
          .map((condition) => condition.course_key)
      )))
    )));
    expect([...newReferences].sort()).toEqual([
      'va:uni:9206:ENGL223',
      'va:uni:9231:ARAB110',
      'va:uni:9231:ARAB111',
      'va:uni:9231:ARAB212',
    ]);
    expect([...newReferences].every((key) => ['parsed', 'none'].includes(byKey.get(key)?.status)))
      .toBe(true);
  });
});
