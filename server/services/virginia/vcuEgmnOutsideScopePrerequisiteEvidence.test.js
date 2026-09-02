import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CONTRACT,
  EVIDENCE_PATH,
  EXPECTED_FACTS_SHA256,
  FORMULA,
  SOURCE,
  TARGET_KEYS,
  buildEvidence,
  defaultReadFile,
  evidenceIssues,
  factRowIssues,
} from './vcuEgmnOutsideScopePrerequisiteEvidence';

const artifact = JSON.parse(fs.readFileSync(EVIDENCE_PATH, 'utf8'));
const byCode = new Map(artifact.facts.target_rows.map((row) => [row.course_code, row]));

describe('VCU EGMN outside-scope prerequisite evidence', () => {
  it('replays all three exact current entries and the checked artifact', () => {
    expect(buildEvidence()).toEqual(artifact);
    expect(evidenceIssues(artifact)).toEqual([]);
    expect(artifact).toMatchObject({
      contract: CONTRACT,
      publication_ready: false,
      facts_sha256: EXPECTED_FACTS_SHA256,
      summary: {
        target_rows: 3,
        exact_complete_entry_rows: 3,
        exact_formula_rows: 1,
        safe_structural_none_rows: 2,
        runtime_blocked_rows: 1,
        prerequisite_groups: 1,
        corequisite_groups: 1,
        owner_local_course_reference_keys: 2,
        non_course_condition_occurrences: 2,
      },
    });
    expect(artifact.facts.target_rows.map((row) => row.course_key)).toEqual(TARGET_KEYS);
    expect(artifact.facts.source).toMatchObject({
      official_url: 'https://bulletin.vcu.edu/azcourses/egmn/',
      response_sha256: SOURCE.response_sha256,
      response_bytes: 103695,
      courseblock_count: 110,
      complete_entry_count: 110,
      positive_required_marker_entry_count: 67,
      same_source_positive_control: true,
    });
  });

  it('preserves both EGMN 102 Boolean formulas without deleting instructor permission', () => {
    const row = byCode.get('EGMN102');
    expect(row).toMatchObject({
      disposition: 'exact_formula_runtime_blocked',
      publication_status_recommendation: 'unparsed',
      review_status_recommendation: 'not_promoted',
      formula_status: 'exact_source_formula_preserved',
      raw_requisites:
        'Prerequisite: MATH 200 with a minimum grade of C or by permission of the instructor. Concurrent prerequisite: PHYS 207 or by permission of the instructor.',
      course_reference_keys: ['va:uni:9229:MATH200', 'va:uni:9229:PHYS207'],
      incoming_course_edge_count: 2,
      non_course_condition_occurrences: 2,
      runtime_blockers: [{
        kind: 'non_course_condition_binding_required',
        condition: 'permission_of_instructor',
        occurrence_count: 2,
        formula_dropped_or_rewritten: false,
      }],
      content_accounting: {
        required_marker_count: 2,
        classified_required_statement_count: 2,
        constraint_like_signal_count: 4,
        classified_constraint_signal_count: 4,
        every_formula_character_preserved: true,
        non_course_alternatives_preserved: true,
        source_content_discarded: false,
      },
    });
    expect(row.groups.map((group) => group.kind)).toEqual([
      'prerequisite', 'corequisite',
    ]);
    expect(row.groups.every((group) => group.formula === FORMULA)).toBe(true);
    expect(row.groups[0].paths.map((path) => path.all_of[0])).toEqual([
      expect.objectContaining({
        type: 'course', code: 'MATH200', minimum_grade: 'C',
      }),
      expect.objectContaining({
        type: 'non_course', condition: 'permission_of_instructor',
        runtime_binding_status: 'unresolved',
      }),
    ]);
    expect(row.groups[1]).toMatchObject({
      catalog_label: 'Concurrent prerequisite',
      source_semantics: 'catalog_labelled_concurrent_prerequisite',
      concurrent_required: true,
      paths: [
        { all_of: [{ type: 'course', code: 'PHYS207', concurrent_required: true }] },
        { all_of: [{
          type: 'non_course', condition: 'permission_of_instructor',
          runtime_binding_status: 'unresolved',
        }] },
      ],
    });
  });

  it('introduces only the two exact owner-local course references', () => {
    expect(artifact.facts.formula_reference_keys).toEqual([
      'va:uni:9229:MATH200', 'va:uni:9229:PHYS207',
    ]);
    const conditions = byCode.get('EGMN102').groups.flatMap((group) => (
      group.paths.flatMap((path) => path.all_of)
    ));
    expect(conditions.filter((condition) => condition.type === 'course')
      .map((condition) => condition.course_key)).toEqual([
      'va:uni:9229:MATH200', 'va:uni:9229:PHYS207',
    ]);
    expect(conditions.filter((condition) => condition.type === 'non_course'))
      .toHaveLength(2);
  });

  it('classifies only EGMN 190 and 203 as exact structural none', () => {
    for (const code of ['EGMN190', 'EGMN203']) {
      expect(byCode.get(code)).toMatchObject({
        disposition: 'safe_structural_none',
        publication_status_recommendation: 'none',
        groups: [],
        formula_status: 'structural_none_source_proved',
        incoming_course_edge_count: 0,
        structural_none_safe_for_figure6_course_graph: true,
        literal_no_requirement_statement: false,
        content_accounting: {
          exact_complete_present_entry: true,
          same_source_positive_control: true,
          required_marker_count: 0,
          corequisite_marker_count: 0,
          requisite_marker_like_count: 0,
          constraint_like_signal_count: 0,
          source_content_discarded: false,
        },
      });
    }
  });

  it('fails closed when any retained official source byte changes', () => {
    expect(() => buildEvidence({
      readFile(relative) {
        const bytes = defaultReadFile(relative);
        return relative === SOURCE.cache_path
          ? Buffer.concat([bytes, Buffer.from(' ')]) : bytes;
      },
    })).toThrow(/source_bytes/);
  });

  it('rejects artifact disposition, formula, and accounting mutation', () => {
    const disposition = structuredClone(artifact);
    disposition.facts.target_rows.find((row) => row.course_code === 'EGMN102')
      .disposition = 'safe_structural_none';
    expect(evidenceIssues(disposition)).toEqual(expect.arrayContaining([
      'facts_sha256', 'artifact_replay',
    ]));

    const formula = structuredClone(artifact);
    formula.facts.target_rows.find((row) => row.course_code === 'EGMN102')
      .groups[0].paths.splice(1, 1);
    expect(evidenceIssues(formula)).toEqual(expect.arrayContaining([
      'facts_sha256', 'artifact_replay',
    ]));

    const accounting = structuredClone(artifact);
    accounting.facts.target_rows.find((row) => row.course_code === 'EGMN190')
      .content_accounting.source_content_discarded = true;
    expect(evidenceIssues(accounting)).toEqual(expect.arrayContaining([
      'facts_sha256', 'artifact_replay',
    ]));
  });

  it('provides a strict row-level replay validator for later integration', () => {
    for (const row of artifact.facts.target_rows) {
      expect(factRowIssues(row, artifact)).toEqual([]);
    }
    const tampered = structuredClone(byCode.get('EGMN102'));
    tampered.groups[1].paths[0].all_of[0].course_key = 'va:uni:9229:PHYS000';
    expect(factRowIssues(tampered, artifact)).toEqual(['row_replay']);
    const tamperedEvidence = structuredClone(artifact);
    tamperedEvidence.facts.target_rows.find((row) => row.course_code === 'EGMN102')
      .groups[0].paths.splice(1, 1);
    expect(factRowIssues(tamperedEvidence.facts.target_rows.find(
      (row) => row.course_code === 'EGMN102',
    ), tamperedEvidence)).toEqual(expect.arrayContaining([
      'evidence:facts_sha256', 'evidence:artifact_replay',
    ]));
    expect(factRowIssues({ course_key: 'va:uni:9229:OTHER' }, artifact))
      .toEqual(['not_scoped']);
  });
});
