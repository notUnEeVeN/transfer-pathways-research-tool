import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROWS,
  auditLongwoodPrerequisiteCandidate,
  buildLongwoodPrerequisiteClosureControl,
} from './longwoodPrerequisiteClosureEvidence';

const CATALOGS = path.resolve(__dirname, '../../.va-catalogs');

function inputs() {
  const artifact = JSON.parse(fs.readFileSync(
    path.join(CATALOGS, 'research/va-university-prerequisite-candidates.json'), 'utf8',
  ));
  return {
    candidates: artifact.candidates.filter((row) => row.slug === 'longwood-university'),
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
  };
}

function cloned(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('Longwood prerequisite closure evidence', () => {
  it('binds all eight exact entries but promotes none across the missing edition join', () => {
    const { candidates, ...source } = inputs();
    const control = buildLongwoodPrerequisiteClosureControl(source);
    expect(control).toMatchObject({
      verified: true,
      issues: [],
      receipt: {
        catalog_year_context: '2026-2027',
        exact_course_entry_edition_binding: false,
      },
    });
    expect(Object.keys(control.receipt.entries).sort()).toEqual(Object.keys(ROWS).sort());
    const resolutions = Object.keys(ROWS).map((code) => auditLongwoodPrerequisiteCandidate(
      candidates.find((row) => row.course_code === code), control,
    ));
    expect(resolutions.every((row) => row.applicable && !row.ready && !row.issues.length))
      .toBe(true);
  });

  it('parses and preserves the two corequisite formulas without treating them as none', () => {
    const { candidates, ...source } = inputs();
    const control = buildLongwoodPrerequisiteClosureControl(source);
    const cmsc160 = auditLongwoodPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CMSC160'), control,
    );
    const cmsc161 = auditLongwoodPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CMSC161'), control,
    );
    expect(cmsc160).toMatchObject({
      ready: false,
      preserved_corequisite_groups: [{
        kind: 'corequisite',
        paths: [{ all_of: [{ course_key: 'va:uni:9214:CMSC161' }] }],
      }],
    });
    expect(cmsc161.preserved_corequisite_groups[0].paths.map((pathRow) => (
      pathRow.all_of[0].course_key
    ))).toEqual(['va:uni:9214:CMSC160', 'va:uni:9214:CMSC162']);
  });

  it('retains CMSC 140 prior-credit exclusion and keeps all six silent rows blocked', () => {
    const { candidates, ...source } = inputs();
    const control = buildLongwoodPrerequisiteClosureControl(source);
    const cmsc140 = auditLongwoodPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CMSC140'), control,
    );
    expect(cmsc140).toMatchObject({
      ready: false,
      retained_non_prerequisite_signals: [{
        kind: 'prior_credit_enrollment_exclusion',
        excluded_if_completed_course_code: 'CMSC160',
        source_typo_preserved: true,
      }],
    });
    for (const code of ['CMSC483', 'CTZN110', 'ENGL165', 'MATH171', 'MATH175']) {
      expect(auditLongwoodPrerequisiteCandidate(
        candidates.find((row) => row.course_code === code), control,
      )).toMatchObject({
        ready: false,
        review_reason: 'unversioned_course_entry_silence_not_catalog_edition_proof',
      });
    }
  });

  it('fails closed on course source, context edition, positive control, or candidate drift', () => {
    const base = inputs();
    expect(buildLongwoodPrerequisiteClosureControl({
      ...base, departmentHtml: base.departmentHtml.replace('CMSC160', 'CMSC999'),
    }).verified).toBe(false);
    expect(buildLongwoodPrerequisiteClosureControl({
      ...base, catalogContextHtml: base.catalogContextHtml.replace('2026-2027', '2025-2026'),
    }).verified).toBe(false);
    expect(buildLongwoodPrerequisiteClosureControl({
      ...base, bannerHtml: base.bannerHtml.replace(
        'Prerequisites: MATH 175 or MATH 261.', 'Recommended: MATH 175 or MATH 261.',
      ),
    }).verified).toBe(false);

    const control = buildLongwoodPrerequisiteClosureControl(base);
    const changed = cloned(base.candidates.find((row) => row.course_code === 'MATH175'));
    changed.source.department_page_catalog_year_statement = '2026-2027';
    expect(auditLongwoodPrerequisiteCandidate(changed, control)).toMatchObject({
      applicable: true, ready: false,
    });
    expect(auditLongwoodPrerequisiteCandidate(changed, control).issues.length).toBeGreaterThan(0);
  });
});
