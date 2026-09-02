import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_PATH,
  TARGET_KEYS,
  buildEvidence,
  defaultReadFile,
  evidenceIssues,
} from './radfordRandolphMaconPrerequisiteTailEvidence';

const artifact = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));

describe('Radford and Randolph-Macon prerequisite tail evidence', () => {
  it('replays all six exact current entries and the checked artifact', () => {
    const replayed = buildEvidence();
    expect(replayed).toEqual(artifact);
    expect(evidenceIssues(artifact)).toEqual([]);
    expect(artifact.facts.target_rows.map((row) => row.course_key).sort())
      .toEqual(TARGET_KEYS);
    expect(artifact.summary).toEqual({
      target_rows: 6,
      exact_current_complete_entry_rows: 6,
      source_upgrade_rows: 2,
      safe_zero_course_edge_rows: 5,
      blocked_required_prior_knowledge_rows: 1,
      direct_rows: 4,
      closure_rows: 2,
    });
  });

  it('upgrades only the two weak CSCI projections from the exact current response', () => {
    const upgraded = artifact.facts.target_rows.filter((row) => (
      row.source_upgrade_from_candidate_projection
    ));
    expect(upgraded.map((row) => row.course_code)).toEqual(['CSCI111', 'CSCI382']);
    expect(upgraded.every((row) => (
      row.source.source_response_sha256
        === '69a52cffc501f52ae561a0febefb8cc74f2c330bcfa5645a9799d97aa29b5885'
      && row.marker_control.exact_current_edition_marker_present === true
      && row.marker_control.source_complete_entry_count === 39
      && row.marker_control.source_complete_entries_with_required_requisite_marker_count === 23
      && row.marker_control.same_source_positive_control === true
    ))).toBe(true);
  });

  it('retains absolute timing as zero-edge but blocks required prior knowledge', () => {
    const engl = artifact.facts.target_rows.find((row) => row.course_code === 'ENGL185');
    expect(engl).toMatchObject({
      disposition: 'safe_zero_course_edge',
      incoming_course_edge_count: 0,
      preserved_signals: [{
        kind: 'absolute_first_year_timing_constraint',
        student_year_maximum: 1,
        figure6_h_g_effect: false,
      }],
    });
    const math = artifact.facts.target_rows.find((row) => row.course_code === 'MATH131');
    expect(math).toMatchObject({
      disposition: 'blocked_required_prior_knowledge',
      publication_status_recommendation: 'unparsed',
      incoming_course_edge_count: null,
      structural_none_safe_for_figure6_course_graph: false,
      preserved_signals: [{
        kind: 'required_prior_knowledge_without_runtime_binding',
        named_course_code: null,
        named_assessment: null,
      }],
    });
  });

  it('classifies the CSEC detector hit as an outcome, not prior knowledge', () => {
    const row = artifact.facts.target_rows.find((item) => item.course_code === 'CSEC121');
    expect(row).toMatchObject({
      disposition: 'safe_zero_course_edge',
      preserved_signals: [{
        kind: 'course_learning_outcome_not_prior_knowledge',
        knowledge_is_developed_by_course: true,
        incoming_course_edge: false,
      }],
    });
  });

  it('fails closed when any retained source byte changes', () => {
    const target = 'university-prerequisites/raw/randolph-macon-college/randolph-macon-college__csci.html';
    expect(() => buildEvidence({
      readFile(relative) {
        const bytes = defaultReadFile(relative);
        return relative === target ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes;
      },
    })).toThrow(/source_bytes|source_sha256/);
  });

  it('rejects disposition or content-accounting mutation', () => {
    const disposition = structuredClone(artifact);
    disposition.facts.target_rows.find((row) => row.course_code === 'MATH131')
      .disposition = 'safe_zero_course_edge';
    expect(evidenceIssues(disposition)).toContain('facts_sha256_replay');

    const accounting = structuredClone(artifact);
    accounting.facts.target_rows[0].content_accounting.source_content_discarded = true;
    expect(evidenceIssues(accounting)).toEqual(expect.arrayContaining([
      'facts_sha256_replay', 'content_accounting',
    ]));
  });
});
