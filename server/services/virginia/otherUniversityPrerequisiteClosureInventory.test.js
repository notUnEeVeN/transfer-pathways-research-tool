import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cnuEngl123MarkerControl,
  resolveCnuEngl123Prerequisite,
} from './christopherNewportEngl123PrerequisiteEvidence';
import {
  auditLongwoodPrerequisiteCandidate,
  buildLongwoodPrerequisiteClosureControl,
} from './longwoodPrerequisiteClosureEvidence';
import {
  buildOldDominionPrerequisiteMarkerControl,
  resolveOldDominionPrerequisiteCandidate,
} from './oldDominionPrerequisiteClosureEvidence';
import {
  resolveFigure6NonCoursePrerequisiteDisposition,
} from './figure6NonCoursePrerequisiteDisposition';
import {
  EXPECTED_DIRECT_REVIEW_DELTA,
  SAFE_RESOLUTION_KEYS,
  SCOPED_COURSE_KEYS,
  auditOtherUniversityPrerequisiteClosureInventory,
} from './otherUniversityPrerequisiteClosureInventory';

const CATALOGS = path.resolve(__dirname, '../../.va-catalogs');

describe('other university prerequisite closure inventory', () => {
  it('accounts for exactly 18 rows, with nine safe resolutions and nine blockers', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(
      CATALOGS, 'research/va-university-prerequisite-candidates.json',
    ), 'utf8'));
    const candidates = artifact.candidates;
    const byKey = new Map(candidates.map((row) => [row.course_key, row]));
    const cnuRows = candidates.filter((row) => row.slug === 'christopher-newport-university');
    const cnuControl = cnuEngl123MarkerControl(cnuRows);
    const longwoodControl = buildLongwoodPrerequisiteClosureControl({
      departmentHtml: fs.readFileSync(path.join(
        CATALOGS,
        'university-prerequisites/raw/longwood-university/longwood-university__computer_science_course_listing.html',
      ), 'utf8'),
      bannerHtml: fs.readFileSync(path.join(
        CATALOGS,
        'university-prerequisites/raw/longwood-university/longwood-university__courses_from_banner.html',
      ), 'utf8'),
      catalogContextHtml: fs.readFileSync(path.join(
        CATALOGS, 'pages/longwood-university__course_catalog.html',
      ), 'utf8'),
    });
    const oduControl = buildOldDominionPrerequisiteMarkerControl({
      csHtml: fs.readFileSync(path.join(
        CATALOGS,
        'university-prerequisites/raw/old-dominion-university/old-dominion-university__cs.html',
      ), 'utf8'),
      oeasHtml: fs.readFileSync(path.join(
        CATALOGS,
        'university-prerequisites/raw/old-dominion-university/old-dominion-university__oeas.html',
      ), 'utf8'),
    });
    const resolutions = Object.fromEntries(SCOPED_COURSE_KEYS.map((key) => {
      const candidate = byKey.get(key);
      if (candidate.slug === 'bridgewater-college'
          || (candidate.slug === 'old-dominion-university'
            && !['CS121G', 'CS222'].includes(candidate.course_code))) {
        return [key, resolveFigure6NonCoursePrerequisiteDisposition(candidate, {
          oldDominionMarkerControl: oduControl,
        })];
      }
      if (candidate.slug === 'christopher-newport-university') {
        return [key, resolveCnuEngl123Prerequisite(candidate, cnuControl)];
      }
      if (candidate.slug === 'longwood-university') {
        return [key, auditLongwoodPrerequisiteCandidate(candidate, longwoodControl)];
      }
      return [key, resolveOldDominionPrerequisiteCandidate(candidate, oduControl)];
    }));
    expect(auditOtherUniversityPrerequisiteClosureInventory(resolutions)).toEqual({
      valid: true,
      scoped_count: 18,
      ready_count: 9,
      blocked_count: 9,
      missing_scoped_keys: [],
      unexpected_keys: [],
      ready_keys: [...SAFE_RESOLUTION_KEYS].sort(),
      blocked_keys: SCOPED_COURSE_KEYS.filter((key) => !SAFE_RESOLUTION_KEYS.includes(key)).sort(),
      expected_direct_review_delta: EXPECTED_DIRECT_REVIEW_DELTA,
    });
  });

  it('fails the inventory if a resolver over-fires or a scoped row disappears', () => {
    const fake = Object.fromEntries(SCOPED_COURSE_KEYS.map((key) => [key, {
      applicable: true,
      ready: SAFE_RESOLUTION_KEYS.includes(key),
    }]));
    expect(auditOtherUniversityPrerequisiteClosureInventory(fake).valid).toBe(true);
    delete fake['va:uni:9205:CL100'];
    expect(auditOtherUniversityPrerequisiteClosureInventory(fake)).toMatchObject({
      valid: false,
      missing_scoped_keys: ['va:uni:9205:CL100'],
    });
    fake['va:uni:9205:CL100'] = { applicable: true, ready: true };
    fake['va:uni:9218:OEAS106N'] = { applicable: true, ready: true };
    expect(auditOtherUniversityPrerequisiteClosureInventory(fake).valid).toBe(false);
  });
});
