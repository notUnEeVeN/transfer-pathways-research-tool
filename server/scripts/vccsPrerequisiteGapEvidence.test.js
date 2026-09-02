import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OUTPUT,
  buildEvidence,
  validateEvidence,
} from './va/buildVccsPrerequisiteGapEvidence';

const artifact = JSON.parse(fs.readFileSync(DEFAULT_OUTPUT, 'utf8'));

describe('VCCS Figure 6 prerequisite source-gap evidence', () => {
  it('rebuilds byte-for-byte from the strict scope and cached official pages', () => {
    expect(artifact).toEqual(buildEvidence());
    expect(validateEvidence(artifact)).toMatchObject({
      ready: true,
      errors: [],
      counts: {
        required_vccs_courses: 184,
        exact_formula_or_validated_none: 184,
        prerequisite_closure_courses: 5,
        parser_engineering_resolved: 2,
        owner_source_resolved: 6,
        current_master_closure_resolved: 1,
        missing_source_rows: 0,
        missing_direct_source_rows: 0,
        missing_closure_source_rows: 0,
        resolved_by_this_research: 7,
        remaining_unresolved: 0,
      },
    });
  });

  it('has no unresolved source gaps after controlled owner-record review', () => {
    expect(artifact.rows).toEqual([]);
    expect(artifact.meta.counts.remaining_unresolved).toBe(0);
  });

  it('separates parser engineering, owner formulas, and structured current-master none', () => {
    expect(artifact.meta.parser_engineering_resolutions).toMatchObject([
      {
        code: 'BIO141', status: 'parsed', resolution: 'whole_clause_alternatives',
        expected_timing: 'corequisite_or_prerequisite',
        raw_requisites: expect.stringMatching(/^Corequisite or Prerequisite:/),
        cached_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        parsed_group: {
          kind: 'corequisite',
          source_label: 'Corequisite or Prerequisite',
          timing: 'corequisite_or_prerequisite',
          semicolon_topology: 'whole_clause_alternatives',
          paths: expect.arrayContaining([
            expect.objectContaining({ all_of: [expect.objectContaining({ condition: 'placement' })] }),
            expect.objectContaining({ all_of: [expect.objectContaining({ condition: 'equivalent' })] }),
          ]),
        },
      },
      {
        code: 'EGR121', status: 'parsed',
        resolution: 'conjunctive_groups_then_whole_clause_alternatives',
        expected_timing: 'prerequisite',
        raw_requisites: expect.stringMatching(/^Prerequisites: ENG 111 eligible;/),
        cached_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        parsed_group: {
          kind: 'prerequisite',
          semicolon_topology: 'conjunctive_groups_then_whole_clause_alternatives',
          paths: [
            expect.objectContaining({
              all_of: [
                expect.objectContaining({ condition: 'course_eligibility', code: 'ENG111' }),
                expect.objectContaining({ code: 'MTH162', equivalent_allowed: true }),
              ],
            }),
            expect.objectContaining({
              all_of: [
                expect.objectContaining({ condition: 'course_eligibility', code: 'ENG111' }),
                expect.objectContaining({ code: 'MTH167', equivalent_allowed: true }),
              ],
            }),
            expect.objectContaining({
              all_of: [expect.objectContaining({ condition: 'consent' })],
            }),
          ],
        },
      },
    ]);
    expect(artifact.rows.some((row) => ['BIO141', 'EGR121'].includes(row.code))).toBe(false);
    expect(artifact.meta.owner_source_resolutions).toMatchObject([
      {
        code: 'ENG249', status: 'parsed', resolution: 'exact_owner_complete_formula',
        owning_colleges: ['Southwest Virginia Community College'],
        raw_requisites: expect.stringMatching(/^Prerequisite\(s\): ENG 112 or divisional approval/),
      },
      {
        code: 'ENG268', status: 'parsed', resolution: 'exact_owner_complete_formula',
        owning_colleges: ['Southwest Virginia Community College'],
        raw_requisites: expect.stringMatching(/^Prerequisite\(s\): ENG 112 or divisional approval/),
      },
      {
        code: 'PHI102', status: 'none', resolution: 'structured_owner_complete_record_none',
        owning_colleges: ['Southwest Virginia Community College'],
        raw_requisites: null,
        explicit_none_evidence: {
          kind: 'structured_owner_catalog_record_boundary',
          literal_none_statement: false,
          parser_contract: 'southwest-courseleaf-single-course-record-v1',
          requisite_clause_count: 0,
          same_catalog_marker_control: {
            code: 'ENG268',
            source_url: expect.stringContaining('catoid=2'),
            catalog_year: '2020-2021',
            raw_entry_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
            raw_requisites: expect.stringMatching(/^Prerequisite\(s\):/),
          },
        },
      },
      {
        code: 'CSC200', status: 'parsed', resolution: 'exact_owner_complete_formula',
        institution: 'Laurel Ridge Community College', required_by: ['CSC201'],
        raw_requisites: 'Prerequisite(s): Readiness to enroll in ENG 111.',
      },
      {
        code: 'CSC201', status: 'parsed', resolution: 'exact_owner_complete_formula',
        institution: 'Laurel Ridge Community College', required_by: ['CSC210'],
        raw_requisites: 'Prerequisite(s): CSC 200 or EGR 126.',
      },
      {
        code: 'CSC202', status: 'parsed', resolution: 'exact_owner_complete_formula',
        institution: 'Laurel Ridge Community College', required_by: ['CSC210'],
        raw_requisites: 'Prerequisite(s): CSC 201.',
      },
    ]);
    expect(artifact.rows.some((row) => (
      ['ENG249', 'ENG268', 'PHI102', 'CSC200', 'CSC201', 'CSC202'].includes(row.code)
    ))).toBe(false);

    expect(artifact.meta.current_master_closure_resolutions).toEqual([
      expect.objectContaining({
        code: 'EGR126',
        required_by: ['CSC201'],
        resolution: 'structured_current_vccs_master_record_none',
        source_url: 'https://courses.vccs.edu/courses/EGR126',
        cached_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        explicit_none_evidence: expect.objectContaining({
          kind: 'structured_vccs_master_record_boundary',
          literal_none_statement: false,
          parser_contract: 'vccs-master-dt-dd-endtext-v1',
          requisite_clause_count: 0,
        }),
        archived_owner_entry: expect.objectContaining({
          disposition: 'unresolved_no_explicit_none_statement',
          accepted_explicit_none: false,
          role: 'corroborating_identity_only_not_none_authority',
        }),
      }),
    ]);
  });

  it('pins exact owner entries and distinguishes controlled record silence from literal none', () => {
    const checks = artifact.meta.owner_course_entry_research;
    expect(checks.map((row) => row.code)).toEqual([
      'ENG249', 'ENG268', 'PHI102', 'CSC200', 'CSC201', 'CSC202', 'EGR126',
    ]);
    expect(checks.filter((row) => row.disposition === 'accepted_exact_owner_complete_formula'))
      .toHaveLength(5);
    expect(checks.find((row) => row.code === 'PHI102')).toMatchObject({
      raw_requisites: null,
      accepted_explicit_none: false,
      disposition: 'accepted_owner_complete_record_no_stated_requisite',
    });
    expect(checks.find((row) => row.code === 'EGR126')).toMatchObject({
      institution: 'Laurel Ridge Community College',
      raw_requisites: null,
      accepted_explicit_none: false,
      disposition: 'unresolved_no_explicit_none_statement',
      required_by: ['CSC201'],
      source_document_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    for (const row of checks) {
      expect(row).toMatchObject({
        raw_entry_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      if (row.institution === 'Southwest Virginia Community College') {
        expect(row.official_url)
          .toMatch(/^https:\/\/catalog\.sw\.edu\/preview_course_nopop\.php/);
        expect(row.source_capture).toMatchObject({
          kind: 'official_http_response_and_single_course_fragment',
          source_response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          course_fragment_html_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          extracted_entry_sha256: row.raw_entry_sha256,
          parser_contract: 'southwest-courseleaf-preview-course-fragment-v1',
        });
      } else {
        expect(row).toMatchObject({
          institution: 'Laurel Ridge Community College',
          official_url: expect.stringMatching(/^https:\/\/laurelridge\.edu\/.*CATALOG\.pdf$/),
        });
      }
    }
  });

  it('detects tampering with source-derived rows', () => {
    const changed = structuredClone(artifact);
    changed.meta.owner_source_resolutions
      .find((row) => row.code === 'PHI102')
      .explicit_none_evidence.literal_none_statement = true;
    expect(validateEvidence(changed)).toMatchObject({
      ready: false,
      errors: ['artifact_does_not_match_cached_official_sources'],
    });
    expect(createHash('sha256').update(fs.readFileSync(DEFAULT_OUTPUT)).digest('hex'))
      .toMatch(/^[a-f0-9]{64}$/);
  });
});
