import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ROWS,
  buildOldDominionPrerequisiteMarkerControl,
  resolveOldDominionPrerequisiteCandidate,
} from './oldDominionPrerequisiteClosureEvidence';

const ROOT = path.resolve(__dirname, '../../.va-catalogs');

function inputs() {
  const artifact = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'research/va-university-prerequisite-candidates.json'), 'utf8',
  ));
  return {
    candidates: artifact.candidates.filter((row) => row.slug === 'old-dominion-university'),
    csHtml: fs.readFileSync(path.join(
      ROOT, 'university-prerequisites/raw/old-dominion-university/old-dominion-university__cs.html',
    ), 'utf8'),
    oeasHtml: fs.readFileSync(path.join(
      ROOT, 'university-prerequisites/raw/old-dominion-university/old-dominion-university__oeas.html',
    ), 'utf8'),
  };
}

function cloned(value) {
  return JSON.parse(JSON.stringify(value));
}

describe('Old Dominion exact prerequisite closure evidence', () => {
  it('binds all seven audited entries and promotes only the two signal-free rows', () => {
    const { candidates, csHtml, oeasHtml } = inputs();
    const control = buildOldDominionPrerequisiteMarkerControl({ csHtml, oeasHtml });
    expect(control).toMatchObject({
      verified: true,
      issues: [],
      receipt: {
        sources: {
          cs: { source_complete_entry_count: 205, source_positive_count: 136 },
          oeas: { source_complete_entry_count: 129, source_positive_count: 69 },
        },
      },
    });
    expect(Object.keys(control.receipt.entries).sort()).toEqual(Object.keys(ROWS).sort());
    const readyCodes = Object.keys(ROWS).filter((code) => (
      resolveOldDominionPrerequisiteCandidate(
        candidates.find((row) => row.course_code === code), control,
      ).ready
    ));
    expect(readyCodes).toEqual(['CS121G', 'CS222']);
    expect(['CS121G', 'CS222'].map((code) => resolveOldDominionPrerequisiteCandidate(
      candidates.find((row) => row.course_code === code), control,
    ))).toEqual([
      expect.objectContaining({ applicable: true, ready: true, status: 'none' }),
      expect.objectContaining({ applicable: true, ready: true, status: 'none' }),
    ]);
  });

  it('retains every blocking knowledge, enrollment, component, and credit signal', () => {
    const { candidates, csHtml, oeasHtml } = inputs();
    const control = buildOldDominionPrerequisiteMarkerControl({ csHtml, oeasHtml });
    const expectedKinds = {
      CS115: ['intended_audience', 'required_course_component', 'prior_credit_exclusion'],
      OEAS106N: ['required_prior_knowledge', 'required_course_component'],
      OEAS110N: ['mutual_credit_exclusion'],
      OEAS111N: ['mutual_credit_exclusion'],
      OEAS126N: ['enrollment_restriction'],
    };
    for (const [code, kinds] of Object.entries(expectedKinds)) {
      const resolution = resolveOldDominionPrerequisiteCandidate(
        candidates.find((row) => row.course_code === code), control,
      );
      expect(resolution).toMatchObject({ applicable: true, ready: false, issues: [] });
      expect(resolution.retained_non_prerequisite_signals.map((row) => row.kind)).toEqual(kinds);
      for (const signal of resolution.retained_non_prerequisite_signals) {
        const raw = candidates.find((row) => row.course_code === code).source.raw_entry_text;
        expect(raw.slice(signal.relative_start, signal.relative_end)).toBe(signal.raw);
      }
    }
  });

  it('fails closed on source, entry, receipt, or inventory drift', () => {
    const { candidates, csHtml, oeasHtml } = inputs();
    expect(buildOldDominionPrerequisiteMarkerControl({
      csHtml: csHtml.replace('CS 121G', 'CS 121X'), oeasHtml,
    }).verified).toBe(false);
    expect(buildOldDominionPrerequisiteMarkerControl({
      csHtml, oeasHtml: oeasHtml.replace('Open only to students', 'Recommended for students'),
    }).verified).toBe(false);

    const control = buildOldDominionPrerequisiteMarkerControl({ csHtml, oeasHtml });
    const target = candidates.find((row) => row.course_code === 'CS121G');
    const changedCandidate = cloned(target);
    changedCandidate.source.raw_entry_text += ' Prerequisites: CS 115.';
    expect(resolveOldDominionPrerequisiteCandidate(changedCandidate, control).ready).toBe(false);

    const changedControl = cloned(control);
    changedControl.receipt.sources.cs.source_positive_count = 0;
    expect(resolveOldDominionPrerequisiteCandidate(target, changedControl)).toMatchObject({
      applicable: true, ready: false,
    });
  });

  it('never broadens the resolver to neighboring ODU rows', () => {
    const { candidates, csHtml, oeasHtml } = inputs();
    const control = buildOldDominionPrerequisiteMarkerControl({ csHtml, oeasHtml });
    expect(resolveOldDominionPrerequisiteCandidate(
      candidates.find((row) => row.course_code === 'CS202G'), control,
    )).toEqual({ applicable: false, ready: false, issues: [] });
  });
});
