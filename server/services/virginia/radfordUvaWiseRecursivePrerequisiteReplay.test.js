import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  RADFORD_CLOSURE_COURSE_RECORDS,
  RADFORD_DIRECT_COURSE_RECORDS,
  extractRadfordCourseEntry,
} = require('./radfordAcalogPrerequisiteAcquisition');
const {
  UVA_WISE_CLOSURE_COURSE_RECORDS,
  extractUvaWiseCourseEntry,
} = require('./uvaWiseAcalogPrerequisiteAcquisition');
const {
  formulaGroup,
  tokenizeRadfordStrictFormula,
  tokenizeUvaWiseStrictFormula,
} = require('./universityPrerequisiteReview');
const {
  extractRequisiteClauses,
  parseRequisiteClause,
} = require('./vccsCourse');

const radfordOwner = 'va:uni:9219';
const uvaWiseOwner = 'va:uni:9226';

function capturedEntry({ slug, code, extractor }) {
  const stem = `../../.va-catalogs/university-prerequisites/raw/${slug}/${slug}__${code.toLowerCase()}`;
  const html = fs.readFileSync(new URL(`${stem}.html`, import.meta.url), 'utf8');
  const metadata = JSON.parse(fs.readFileSync(new URL(`${stem}.json`, import.meta.url), 'utf8'));
  const result = extractor(html, code, { finalUrl: metadata.final_url });
  expect(result).toMatchObject({ verified: true, issues: [], entries: [{ course_code: code }] });
  return result.entries[0];
}

function radfordEntry(code) {
  return capturedEntry({ slug: 'radford-university', code, extractor: extractRadfordCourseEntry });
}

function uvaWiseEntry(code) {
  return capturedEntry({
    slug: 'the-university-of-virginia-s-college-at-wise',
    code,
    extractor: extractUvaWiseCourseEntry,
  });
}

function replay(raw, owner, courseKey, kind, tokenizer) {
  return formulaGroup({
    owner,
    courseKey,
    kind,
    raw,
    tokens: tokenizer(raw, owner),
  }).paths.map((path) => path.all_of.map((condition) => ({
    code: condition.code,
    minimum_grade: condition.minimum_grade || null,
  })));
}

function formalCourseRefs(entry) {
  return [entry.required_requisite_clause, entry.pre_or_corequisite_clause]
    .filter(Boolean)
    .flatMap(({ raw }) => [...raw.matchAll(/\b([A-Z]{2,8})\s+(\d{2,4}[A-Z]?)\b/g)]
      .map((match) => `${match[1]}${match[2]}`));
}

describe('Radford and UVA Wise recursive prerequisite capture replay', () => {
  it('replays the five currently compiler-safe course formulas exactly', () => {
    const radfordExpected = {
      PHYS112: [[{ code: 'PHYS111', minimum_grade: null }]],
      PHYS221: [
        [{ code: 'MATH169', minimum_grade: null }],
        [{ code: 'MATH171', minimum_grade: null }],
      ],
      PHYS222: [[{ code: 'PHYS221', minimum_grade: null }]],
    };
    for (const [code, expected] of Object.entries(radfordExpected)) {
      const clause = radfordEntry(code).required_requisite_clause;
      expect(replay(
        clause.raw, radfordOwner, `${radfordOwner}:${code}`, 'prerequisite',
        tokenizeRadfordStrictFormula,
      )).toEqual(expected);
    }

    const uvaWiseExpected = {
      MTH1110: [[{ code: 'MTH1010', minimum_grade: 'C' }]],
      MTH1210: [[{ code: 'MTH1110', minimum_grade: 'C' }]],
    };
    for (const [code, expected] of Object.entries(uvaWiseExpected)) {
      const clause = uvaWiseEntry(code).required_requisite_clause;
      expect(replay(
        clause.raw, uvaWiseOwner, `${uvaWiseOwner}:${code}`, 'prerequisite',
        tokenizeUvaWiseStrictFormula,
      )).toEqual(expected);
    }
  });

  it('keeps exact non-course and Pre-or-Corequisite rows blocked by current semantics', () => {
    for (const code of ['CS119', 'MATH125', 'MATH126', 'MATH138', 'PHYS111']) {
      const clause = radfordEntry(code).required_requisite_clause;
      expect(() => tokenizeRadfordStrictFormula(clause.raw, radfordOwner)).toThrow();
    }
    for (const code of ['CS118', 'CS119']) {
      const entry = radfordEntry(code);
      expect(entry.pre_or_corequisite_clause).toMatchObject({
        kind: 'pre_or_corequisite',
        label: 'Pre- or Corequisites',
      });
      expect(() => tokenizeRadfordStrictFormula(
        entry.pre_or_corequisite_clause.raw, radfordOwner,
      )).toThrow();
      expect(formalCourseRefs({
        required_requisite_clause: null,
        pre_or_corequisite_clause: entry.pre_or_corequisite_clause,
      })).toEqual(['MATH125', 'MATH138', 'MATH168', 'MATH169', 'MATH171']);
      const [timingClause] = extractRequisiteClauses(
        `Prerequisite or Corequisite: ${entry.pre_or_corequisite_clause.raw}`,
      );
      expect(timingClause).toMatchObject({
        kind: 'corequisite',
        sourceLabel: 'Prerequisite or Corequisite',
      });
      expect(parseRequisiteClause(
        timingClause.kind, timingClause.raw, { sourceLabel: timingClause.sourceLabel },
      )).toMatchObject({ kind: 'corequisite', timing: 'corequisite_or_prerequisite' });
    }
  });

  it('does not convert silent entries with explicit constraint signals into none', () => {
    expect(radfordEntry('CS101')).toMatchObject({
      required_requisite_clause: null,
      pre_or_corequisite_clause: null,
      raw_entry_text: expect.stringMatching(/credit for CS 120 may not take CS 101/i),
    });
    expect(radfordEntry('CS109')).toMatchObject({
      required_requisite_clause: null,
      pre_or_corequisite_clause: null,
      raw_entry_text: expect.stringMatching(/may not take ITEC 109 and CS 120 concurrently/i),
    });
    expect(uvaWiseEntry('MTH1010')).toMatchObject({
      required_requisite_clause: null,
      raw_entry_text: expect.stringMatching(/No credit is given.*MTH 1110 or above/i),
    });
  });

  it('reaches a formal-course-reference fixed point after the exact CS109 capture', () => {
    const originalClosureCodes = Object.keys(RADFORD_CLOSURE_COURSE_RECORDS)
      .filter((code) => code !== 'CS109');
    const originallyKnown = new Set([
      ...Object.keys(RADFORD_DIRECT_COURSE_RECORDS),
      ...originalClosureCodes,
    ]);
    const induced = [...new Set(originalClosureCodes.flatMap((code) => (
      formalCourseRefs(radfordEntry(code)).filter((ref) => !originallyKnown.has(ref))
    )))].sort();
    expect(induced).toEqual(['CS109']);
    expect(formalCourseRefs(radfordEntry('CS109'))).toEqual([]);

    const fixedPointKnown = new Set([
      ...Object.keys(RADFORD_DIRECT_COURSE_RECORDS),
      ...Object.keys(RADFORD_CLOSURE_COURSE_RECORDS),
    ]);
    const unresolved = Object.keys(RADFORD_CLOSURE_COURSE_RECORDS).flatMap((code) => (
      formalCourseRefs(radfordEntry(code)).filter((ref) => !fixedPointKnown.has(ref))
    ));
    expect(unresolved).toEqual([]);
  });
});
