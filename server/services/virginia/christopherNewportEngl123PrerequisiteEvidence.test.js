import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  POSITIVE_CONTROL,
  RETAINED_NON_PREREQUISITE_SIGNAL,
  cnuEngl123MarkerControl,
  resolveCnuEngl123Prerequisite,
} from './christopherNewportEngl123PrerequisiteEvidence';

const CANDIDATES_PATH = path.resolve(
  __dirname, '../../.va-catalogs/research/va-university-prerequisite-candidates.json',
);

function rows() {
  const artifact = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  return artifact.candidates.filter((row) => row.slug === 'christopher-newport-university');
}

function cloned(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('CNU ENGL 123 exact prerequisite evidence', () => {
  it('proves structural silence from one bounded entry and a same-PDF positive control', () => {
    const candidates = rows();
    const target = candidates.find((row) => row.course_code === 'ENGL123');
    const control = cnuEngl123MarkerControl(candidates);
    expect(control).toMatchObject({
      verified: true,
      issues: [],
      receipt: {
        same_pdf_positive_control: true,
        target_course_key: 'va:uni:9206:ENGL123',
        positive_control: { course_key: POSITIVE_CONTROL.course_key },
        retained_non_prerequisite_signals: [{
          kind: 'degree_completion_minimum_grade',
          minimum_grade: 'C-',
        }, {
          kind: 'descriptive_forward_course_relationship',
          related_course_code: 'ENGL223',
          formal_recommendation: false,
        }],
      },
    });
    const resolution = resolveCnuEngl123Prerequisite(target, control);
    expect(resolution).toMatchObject({
      applicable: true,
      ready: true,
      status: 'none',
      review_status: 'promoted_structural_none',
      ignored_nonrequired_requisites: [{
        raw: RETAINED_NON_PREREQUISITE_SIGNAL.raw,
        prerequisite_effect: false,
      }, {
        kind: 'descriptive_forward_course_relationship',
        related_course_code: 'ENGL223',
        prerequisite_effect: false,
      }],
      structural_none_evidence: {
        literal_none_statement: false,
        pdf_page_start: 107,
        page_column_span: ['107:right'],
      },
    });
  });

  it('fails closed when the target entry, PDF binding, or positive control drifts', () => {
    const candidates = rows();
    const mutations = [
      (changed) => { changed.find((row) => row.course_code === 'ENGL123').source.raw_entry_text += ' Prerequisite: ENGL 101.'; },
      (changed) => { changed.find((row) => row.course_code === 'ENGL123').source.pdf_sha256 = '0'.repeat(64); },
      (changed) => { changed.find((row) => row.course_code === 'ENGL223').source.raw_entry_sha256 = '0'.repeat(64); },
      (changed) => { changed.find((row) => row.course_code === 'ENGL223').source.raw_entry_text = changed.find((row) => row.course_code === 'ENGL223').source.raw_entry_text.replace('Prerequisites:', 'Recommended:'); },
      (changed) => { changed.push(cloned(changed.find((row) => row.course_code === 'ENGL123'))); },
    ];
    for (const mutate of mutations) {
      const changed = cloned(candidates);
      mutate(changed);
      expect(cnuEngl123MarkerControl(changed).verified).toBe(false);
    }
  });

  it('does not broaden the proof to a neighboring CNU course or accept receipt tampering', () => {
    const candidates = rows();
    const control = cnuEngl123MarkerControl(candidates);
    const target = candidates.find((row) => row.course_code === 'ENGL123');
    expect(resolveCnuEngl123Prerequisite(
      candidates.find((row) => row.course_code === 'ENGL223'), control,
    )).toEqual({ applicable: false, ready: false, issues: [] });

    const changed = cloned(control);
    changed.receipt.retained_non_prerequisite_signals = [];
    expect(resolveCnuEngl123Prerequisite(target, changed)).toMatchObject({
      applicable: true,
      ready: false,
      issues: ['marker_control_receipt'],
    });
  });
});
