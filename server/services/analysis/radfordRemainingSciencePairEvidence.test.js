import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/radford-remaining-science-pair-evidence.json';
import { courseIdFor } from '../virginia/courseIdentity';
import {
  FACTS_SHA256,
  SOUTHWEST_REQUIRED_ROWS,
  buildRadfordRemainingSciencePairEvidence,
  radfordRemainingSciencePairEvidenceIssue,
} from './radfordRemainingSciencePairEvidence';
import {
  buildFromRetainedSources,
  loadRetainedEvidenceInput,
} from '../../scripts/va/buildRadfordRemainingSciencePairEvidence';

function cell(result, numericId) {
  return result.facts.cells.find((row) => row.numeric_id === numericId);
}

function replaceBuffer(buffer, before, after) {
  const changed = buffer.toString('utf8').replace(before, after);
  expect(changed).not.toBe(buffer.toString('utf8'));
  return Buffer.from(changed, 'utf8');
}

describe('remaining Radford science-pair exact-source audit', () => {
  it('replays every retained byte to one safe closure and one irreducible blocker', () => {
    const rebuilt = buildFromRetainedSources();
    expect(rebuilt).toEqual(evidence);
    expect(radfordRemainingSciencePairEvidenceIssue(rebuilt)).toBeNull();
    expect(rebuilt).toMatchObject({
      verified: true,
      issues: [],
      safe_resolution_delta: 1,
      exact_cells_closed: [9317],
      irreducible_numeric_ids: [9319],
      facts_sha256: FACTS_SHA256,
    });
  });

  it('reproduces why the original 34-receipt college corpus omitted both cells', () => {
    const rebuilt = buildFromRetainedSources();
    expect(cell(rebuilt, 9317).existing_omission).toEqual({
      existing_pair_target: false,
      observed_legacy_discovery_codes: ['CHEM101', 'CHEM102', 'PHYS101', 'PHYS102'],
      selected_plan_codes: ['PHYS201', 'PHYS202'],
      exact_selected_codes_discovered: [],
      matrix_pair: null,
      matrix_blocker:
        'the exact A.S. tree has local PHYS identities but the current incoming Radford equivalency corpus has no exact edge',
      matrix_source_bundle_sha256:
        'eaae55d519535782ad80339e3365627a7855dededae58b8326bf643478d94186',
      reproduced: true,
    });
    expect(cell(rebuilt, 9319).existing_omission).toMatchObject({
      existing_pair_target: false,
      observed_legacy_discovery_codes: ['CHM111', 'CHM112', 'PHY201', 'PHY202'],
      selected_plan_codes: ['PHY241'],
      exact_selected_codes_discovered: [],
      matrix_pair: null,
      reproduced: true,
    });
  });

  it('closes Richard Bland only through its owner-local selected pair and exact Radford edges', () => {
    const richardBland = cell(buildFromRetainedSources(), 9317);
    expect(richardBland).toMatchObject({
      verdict: 'closed_by_exact_college_specific_evidence',
      safe_to_close: true,
      selected_sending_units: 8,
      selected_receiving_units: 8,
      distinct_selected_sciences: 2,
      selected_laboratory_courses: 2,
      sending_plan: {
        degree_total_units: 60,
        science_requirement_units: 8,
        laboratory_basis: 'Both exact official plan rows are labeled Lecture and Lab.',
      },
      selected_pair: [
        {
          source_institution: 'Richard Bland College',
          sending_code: 'PHYS201', sending_credits: 4,
          receiving_institution: 'Radford University', receiving_code: 'PHYS221',
          sending_course_note:
            'Continuous course; three hours lecture; one hour laboratory. UCGS approved course, 2021.',
        },
        {
          source_institution: 'Richard Bland College',
          sending_code: 'PHYS202', sending_credits: 4,
          receiving_institution: 'Radford University', receiving_code: 'PHYS222',
          sending_course_note:
            'Continuous course; three hours lecture; one hour laboratory. UCGS approved course, 2021.',
        },
      ],
      receiving_courses: [
        { course_code: 'PHYS221', credits: 4 },
        { course_code: 'PHYS222', credits: 4 },
      ],
    });
    for (const identity of richardBland.sending_plan.selected_sciences) {
      expect(identity).toMatchObject({
        institution_id: 'va:cc:richard-bland-college',
        identity_scope: 'institution_local',
        identity_contract: 'owner_plus_course_id',
        vccs_master_applicable: false,
      });
      expect(identity.course_id).not.toBe(courseIdFor(identity.code));
    }
  });

  it('retains Southwest PHY242 as a real edge but never adds it to the exact 60-credit plan', () => {
    const southwest = cell(buildFromRetainedSources(), 9319);
    expect(southwest).toMatchObject({
      safe_to_close: false,
      verdict: 'irreducible_selected_plan_gap',
      blocker: expect.stringMatching(/contains PHY241 but not PHY242.*no open science capacity/i),
      selected_sending_units: 4,
      selected_receiving_units: 4,
      distinct_selected_sciences: 1,
      selected_laboratory_courses: 1,
      sending_plan: {
        degree_total_units: 60,
        fixed_or_typed_rows: SOUTHWEST_REQUIRED_ROWS,
        fixed_or_typed_row_units: 60,
        selected_sciences: ['PHY241'],
        open_science_capacity: false,
        missing_pair_course: 'PHY242',
      },
      selected_course_receipt: {
        source_institution: 'Southwest Virginia Community College',
        sending_code: 'PHY241', receiving_code: 'PHYS221',
      },
      absent_plan_course_receipt: {
        source_institution: 'Southwest Virginia Community College',
        sending_code: 'PHY242', receiving_code: 'PHYS222',
      },
    });
  });

  it.each([
    ['Richard Bland course bytes', (input) => {
      input.transferPages['richard-bland-college:PHYS201'] = replaceBuffer(
        input.transferPages['richard-bland-college:PHYS201'],
        'Radford University', 'Different University',
      );
    }],
    ['Richard Bland redirect', (input) => {
      input.transferResponses['richard-bland-college:PHYS202'].finalUrl
        = 'https://www.transfervirginia.org/course/different';
    }],
    ['Richard Bland shared owner substitution', (input) => {
      input.compositions['richard-bland-college'].course_namespace = null;
    }],
    ['Richard Bland plan pair substitution', (input) => {
      const group = input.compositions['richard-bland-college'].requirement_groups
        .find((row) => row.title === 'Investigation of the Natural World');
      group.sections[1].receivers[0].options = [['PHY242']];
    }],
    ['Southwest unselected-course injection', (input) => {
      const group = input.compositions['southwest-virginia-community-college']
        .requirement_groups.find((row) => row.title === 'Mathematics and laboratory science');
      group.sections.push({
        select: 1, units: 4,
        receivers: [{ kind: 'cc_course', options: [['PHY242']] }],
      });
    }],
    ['Southwest official-plan injection', (input) => {
      input.planTexts['southwest-virginia-community-college'] = replaceBuffer(
        input.planTexts['southwest-virginia-community-college'],
        'Fourth Semester:', 'PHY 242: University Physics II 4 Credits\nFourth Semester:',
      );
    }],
    ['Radford laboratory removal', (input) => {
      input.radfordPages.PHYS221 = replaceBuffer(
        input.radfordPages.PHYS221,
        'A lab report must be submitted for each lab exercise.',
        'A report may be submitted for an exercise.',
      );
    }],
    ['Transfer robots delay', (input) => { input.robots.transfer.crawlDelay = 0; }],
    ['Radford robots path denial', (input) => {
      input.robots.radford.body = Buffer.from(
        'User-agent: *\nDisallow: /registrar/course-descriptions/\n', 'utf8',
      );
    }],
  ])('fails both closures closed on adversarial %s', (_label, mutate) => {
    const input = loadRetainedEvidenceInput();
    mutate(input);
    const changed = buildRadfordRemainingSciencePairEvidence(input);
    expect(changed.verified).toBe(false);
    expect(changed.safe_resolution_delta).toBe(0);
    expect(changed.exact_cells_closed).toEqual([]);
    expect(cell(changed, 9317)).toMatchObject({ safe_to_close: false, verdict: 'not_verified' });
    expect(cell(changed, 9319)).toMatchObject({ safe_to_close: false, verdict: 'not_verified' });
  });

  it.each([
    ['facts hash', (changed) => { changed.facts_sha256 = '0'.repeat(64); }],
    ['safe count', (changed) => { changed.safe_resolution_delta = 2; }],
    ['closed inventory', (changed) => { changed.exact_cells_closed.push(9319); }],
    ['robots receipt', (changed) => { changed.robots.transfer.crawl_delay_seconds = 0; }],
  ])('rejects artifact %s drift', (_label, mutate) => {
    const changed = structuredClone(evidence);
    mutate(changed);
    expect(radfordRemainingSciencePairEvidenceIssue(changed)).toBeTruthy();
  });
});
