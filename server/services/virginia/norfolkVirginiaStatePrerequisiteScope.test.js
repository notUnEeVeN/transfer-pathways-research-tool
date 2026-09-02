import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONS,
  isScopedNorfolkVirginiaStatePrerequisite,
  scopedInventoryAudit,
  scopedUnparsedCourseKeys,
} from './norfolkVirginiaStatePrerequisiteScope';
import { acquisitionTargets } from './universityPrerequisiteAcquisition';
import { buildUniversityPrerequisiteCandidates } from './universityPrerequisiteCandidates';

const RESEARCH = path.resolve(__dirname, '../../.va-catalogs/research');

function acquiredEntry(courseCode, rawEntryText) {
  return {
    school_id: 9217,
    slug: 'norfolk-state-university',
    owner_namespace: 'va:uni:9217',
    course_key: `va:uni:9217:${courseCode}`,
    course_code: courseCode,
    capture_origin: 'official_acquisition',
    boundary_contract: 'unique_courseblock_exact_leading_code_with_published_units',
    official_url: 'https://catalog.nsu.edu/undergraduate/course-descriptions/csc/',
    source_response_sha256: 'a'.repeat(64),
    source_response_bytes: 1000,
    catalog_year_verified: '2025-2026',
    courseblock_index: 0,
    published_units: {
      kind: 'published_fixed_credits',
      notation: '1 Credits',
      credit_hours_min: 1,
      credit_hours_max: 1,
    },
    complete_entry_receipt: {
      receipt_contract: 'courseleaf_complete_entry_response_and_same_source_requisite_marker_control_v1',
      source_courseblock_count: 3,
      source_complete_entry_count: 3,
      source_complete_entries_with_required_requisite_marker_count: 1,
      entry_required_requisite_marker_count: 0,
      entry_corequisite_marker_count: 0,
      entry_requisite_marker_like_count: 0,
      entry_constraint_like_signal_count: 0,
      same_source_positive_control: true,
    },
    raw_entry_html_sha256: 'b'.repeat(64),
    raw_entry_text: rawEntryText,
    raw_entry_sha256: require('node:crypto').createHash('sha256')
      .update(rawEntryText).digest('hex'),
  };
}

describe('Norfolk State / Virginia State prerequisite remediation scope', () => {
  it('pins the exact 50-row unparsed inventory in the checked-in review', () => {
    const review = JSON.parse(fs.readFileSync(
      path.join(RESEARCH, 'va-university-prerequisite-review.json'), 'utf8',
    ));
    expect(INSTITUTIONS['norfolk-state-university'].course_codes).toHaveLength(22);
    expect(INSTITUTIONS['virginia-state-university'].course_codes).toHaveLength(28);
    const reconstructedBaseline = { direct_review_rows: Object.entries(INSTITUTIONS)
      .flatMap(([slug, row]) => row.course_codes.map((code) => ({
        slug,
        owner_namespace: row.owner_namespace,
        course_key: `${row.owner_namespace}:${code}`,
        code,
        status: 'unparsed',
      }))) };
    expect(scopedInventoryAudit(reconstructedBaseline)).toEqual({
      expected_count: 50,
      actual_count: 50,
      missing_expected_keys: [],
      unexpected_scoped_keys: [],
    });
    const current = scopedInventoryAudit(review);
    expect(current.expected_count).toBe(50);
    expect(current.unexpected_scoped_keys).toEqual([]);
  });

  it('fails closed for owner drift, course expansion, or a row no longer unparsed', () => {
    const valid = {
      slug: 'norfolk-state-university',
      owner_namespace: 'va:uni:9217',
      course_key: 'va:uni:9217:CSC101',
      course_code: 'CSC101',
      status: 'unparsed',
    };
    expect(isScopedNorfolkVirginiaStatePrerequisite(valid)).toBe(true);
    expect(isScopedNorfolkVirginiaStatePrerequisite({
      ...valid, owner_namespace: 'va:uni:9999', course_key: 'va:uni:9999:CSC101',
    })).toBe(false);
    expect(isScopedNorfolkVirginiaStatePrerequisite({
      ...valid, course_code: 'CSC999', course_key: 'va:uni:9217:CSC999',
    })).toBe(false);
    expect(scopedUnparsedCourseKeys({
      direct_review_rows: [{ ...valid, status: 'none' }, valid, {
        ...valid, course_code: 'CSC999', course_key: 'va:uni:9217:CSC999',
      }],
    })).toEqual(['va:uni:9217:CSC101']);
  });

  it('recaptures an existing scoped candidate but not an unreviewed neighboring code', () => {
    const scope = { universities: [{
      slug: 'norfolk-state-university',
      owner_namespace: 'va:uni:9217',
      direct_named_course_codes: ['CSC101', 'CSC150'],
    }] };
    const candidates = { candidates: [
      { course_key: 'va:uni:9217:CSC101' },
      { course_key: 'va:uni:9217:CSC150' },
    ] };
    const review = { direct_review_rows: [{
      slug: 'norfolk-state-university',
      owner_namespace: 'va:uni:9217',
      course_key: 'va:uni:9217:CSC101',
      code: 'CSC101',
      status: 'unparsed',
    }, {
      slug: 'norfolk-state-university',
      owner_namespace: 'va:uni:9217',
      course_key: 'va:uni:9217:CSC150',
      code: 'CSC150',
      status: 'unparsed',
    }], closure: {} };
    expect(acquisitionTargets({ scope, candidates, review }).captureKeys)
      .toEqual(['va:uni:9217:CSC101']);
  });

  it('lets exact acquisition supersede cached text only inside the fixed inventory', () => {
    const cached101 = 'CSC 101 Cached Course (1 Credits) Cached body.';
    const cached150 = 'CSC 150 Cached Neighbor (3 Credits) Cached neighbor body.';
    const catalogText = `${cached101} ${cached150}\n\n 2025-2026 Academic Catalog`;
    const acquired101 = 'CSC 101 Exact Official Course (1 Credits) Exact official body.';
    const acquired150 = 'CSC 150 Exact Neighbor (3 Credits) Neighbor acquisition body.';
    const scope = {
      snapshot_date: '2026-08-25',
      summary: {
        direct_named_courses: 2,
        exact_code_tokens_in_cached_official_text: 2,
      },
      universities: [{
        school_id: 9217,
        slug: 'norfolk-state-university',
        owner_namespace: 'va:uni:9217',
        catalog_platform: 'courseleaf',
        direct_named_course_codes: ['CSC101', 'CSC150'],
        cached_course_catalog: {
          official_url: 'https://catalog.nsu.edu/undergraduate/course-descriptions/csc/',
          declared_normalized_text_sha256: 'c'.repeat(64),
          retained_normalized_text_sha256: 'c'.repeat(64),
          byte_match: true,
          exact_code_tokens_seen: ['CSC101', 'CSC150'],
        },
      }],
    };
    const artifact = buildUniversityPrerequisiteCandidates({
      scope,
      catalogTexts: { 'norfolk-state-university': catalogText },
      acquisition: { entries: [
        acquiredEntry('CSC101', acquired101),
        acquiredEntry('CSC150', acquired150),
      ] },
    });
    expect(artifact.candidates.find((row) => row.course_code === 'CSC101')
      .source.raw_entry_text).toBe(acquired101);
    expect(artifact.candidates.find((row) => row.course_code === 'CSC150')
      .source.raw_entry_text).toContain('Cached Neighbor');
    expect(artifact.capture_manifest[0]).toMatchObject({
      acquired_superseding_cached_candidate_count: 1,
      acquired_superseding_cached_candidate_codes: ['CSC101'],
    });
  });
});
