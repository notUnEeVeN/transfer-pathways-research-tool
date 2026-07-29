import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide } from './parseGuide';
import { transformGuide } from './transform';
import {
  isMajorArticulable, isMajorCompleted, allArticulatingCourses,
  calculateMajorCompletionPercentage,
} from '../analysis/eligibility';

const FIXTURE = path.resolve(__dirname, '../../test/fixtures/artsys/guide-3354-montgomery.html');

let out;
beforeAll(() => {
  out = transformGuide(parseGuide(fs.readFileSync(FIXTURE, 'utf8'), { guideId: 3354 }));
});

describe('transformGuide', () => {
  it('produces one agreement keyed on (college, university, program)', () => {
    expect(out.problems).toEqual([]);
    expect(out.agreement._id).toBe('md:agr:3354:1768');
    expect(out.agreement.college_id).toBe('md:cc:1768');
    expect(out.agreement.university_id).toBe('md:uni:1735');
    expect(out.agreement.major).toBe('Computer Science, B.S.');
  });

  // Every id is namespaced so a combined export or a careless $unionWith can
  // never collide a Maryland college with a California one on `cc:<n>`.
  it('namespaces every identifier to the source', () => {
    const ids = [
      out.agreement._id,
      ...out.institutions.map((i) => i._id),
      ...out.courses.map((c) => c._id),
    ];
    expect(ids.every((id) => id.startsWith('md:'))).toBe(true);
    expect(ids.some((id) => /^(cc|uc|university):/.test(id))).toBe(false);
  });

  it('stamps provenance on every document', () => {
    for (const doc of [out.agreement, ...out.institutions, ...out.courses]) {
      expect(doc.source).toBe('artsys');
      expect(doc.state).toBe('MD');
    }
  });

  it('emits both institutions with the right kinds', () => {
    const kinds = Object.fromEntries(out.institutions.map((i) => [i.kind, i.name]));
    expect(kinds.community_college).toBe('Montgomery College');
    expect(kinds.university).toBe('Capitol Technology University');
  });

  it('splits courses by side and keeps the ARTSYS course id when given', () => {
    const receiving = out.courses.filter((c) => c.side === 'receiving');
    const sending = out.courses.filter((c) => c.side === 'sending');
    expect(receiving.length).toBeGreaterThan(0);
    expect(sending.length).toBeGreaterThan(0);
    expect(receiving.every((c) => c.institution_id === 'md:uni:1735')).toBe(true);
    expect(sending.every((c) => c.institution_id === 'md:cc:1768')).toBe(true);
    expect(receiving.some((c) => c.artsys_course_id > 0)).toBe(true);
  });

  it('maps an and-branch to "complete all" and an or-branch to "choose one"', () => {
    // Only when the group states no count of its own.
    const groups = out.agreement.requirement_groups.filter((g) => g.group_advisement == null);
    const sections = groups.flatMap((g) => g.sections);
    const and = sections.find((s) => s.conjunction === 'and');
    expect(and.section_advisement).toBe(and.receivers.length);
  });

  // "Complete the following 2 requirements" over an or-section of 19
  // alternatives means pick 2 of the 19. Capping the section at 1 would make
  // the group unsatisfiable however many courses the college offers, so a
  // group that states its own count leaves its sections uncapped and lets
  // getEffectiveGroupAsk do the limiting.
  it('does not cap a section when the group states its own count', () => {
    const counted = out.agreement.requirement_groups.find((g) => g.group_advisement != null);
    expect(counted).toBeTruthy();
    expect(counted.sections.every((s) => s.section_advisement === null)).toBe(true);
  });

  it('carries the not-articulated signal into the canonical receiver', () => {
    const missing = out.agreement.requirement_groups
      .flatMap((g) => g.sections.flatMap((s) => s.receivers))
      .filter((r) => r.articulation_status === 'not_articulated');
    expect(missing.length).toBe(6);
    expect(missing[0].not_articulated_reason).toBe('no_course_articulated');
    expect(missing[0].options).toEqual([]);
  });

  it('gives every receiver a hash that does not depend on the sending college', () => {
    const receivers = out.agreement.requirement_groups.flatMap((g) => g.sections.flatMap((s) => s.receivers));
    expect(receivers.every((r) => typeof r.hash_id === 'string' && r.hash_id.length === 12)).toBe(true);
    // Same guide, different sender -> same receiver hashes.
    const html = fs.readFileSync(FIXTURE, 'utf8').replace('value="/program_transfer_guides/3354?sender_university_id=1768#ptgrequirements" selected', 'value="/program_transfer_guides/3354?sender_university_id=1725#ptgrequirements" selected');
    const other = transformGuide(parseGuide(html, { guideId: 3354 }));
    const hashesA = receivers.map((r) => r.hash_id);
    const hashesB = other.agreement.requirement_groups.flatMap((g) => g.sections.flatMap((s) => s.receivers)).map((r) => r.hash_id);
    expect(hashesB).toEqual(hashesA);
    expect(other.agreement.college_id).toBe('md:cc:1725');
  });

  it('mirrors course_ids into course_keys so either field reads the same', () => {
    const options = out.agreement.requirement_groups
      .flatMap((g) => g.sections.flatMap((s) => s.receivers.flatMap((r) => r.options)));
    expect(options.length).toBeGreaterThan(0);
    expect(options.every((o) => JSON.stringify(o.course_ids) === JSON.stringify(o.course_keys))).toBe(true);
  });
});

// The point of matching the ASSIST shape is that no analysis code changes.
describe('the vendored eligibility engine runs unmodified', () => {
  it('evaluates articulability without translation', () => {
    expect(typeof isMajorArticulable(out.agreement, true)).toBe('boolean');
    // Montgomery cannot satisfy every stated Capitol Tech CS requirement:
    // DS235, CS356, CT406 and EL262 have no equivalent anywhere in Maryland.
    expect(isMajorArticulable(out.agreement, true)).toBe(false);
  });

  it('reproduces PMT default-accept when strict is off', () => {
    expect(isMajorArticulable(out.agreement, false)).toBe(true);
  });

  it('computes a completion percentage strictly between 0 and 100', () => {
    const pct = calculateMajorCompletionPercentage(
      out.agreement, allArticulatingCourses(out.agreement), [], true
    );
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThan(100);
  });

  it('reports complete when every missing requirement is articulated', () => {
    // Flip the four structural gaps to articulated and the engine must agree
    // the program is now satisfiable — proof the gaps, not the shape, are what
    // makes it fail above.
    const repaired = JSON.parse(JSON.stringify(out.agreement));
    let synthetic = 0;
    for (const g of repaired.requirement_groups) {
      for (const s of g.sections) {
        for (const r of s.receivers) {
          if (r.articulation_status !== 'not_articulated') continue;
          synthetic += 1;
          r.articulation_status = 'articulated';
          r.not_articulated_reason = null;
          r.options = [{
            course_ids: [`md:crs:synthetic${synthetic}`],
            course_keys: [`md:crs:synthetic${synthetic}`],
            course_conjunction: 'or',
          }];
        }
      }
    }
    expect(isMajorCompleted(repaired, allArticulatingCourses(repaired), [], true)).toBe(true);
  });
});
