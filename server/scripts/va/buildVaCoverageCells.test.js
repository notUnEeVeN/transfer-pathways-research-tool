import { describe, expect, it } from 'vitest';
import {
  build, classify, classifyPostTransferRow, classifyPreTransferRow, lowerDivisionCell,
} from './buildVaCoverageCells';
import { coverageRow, rateRow } from './emitVaFigureRows';

const item = (requirement, codes) => ({
  requirement_text: requirement, cc_codes: codes, kind: 'course_choice',
});
const verdict = (requirement, codes, offered) => classify(
  item(requirement, codes), { codes: new Set(offered) }, new Set(codes),
);

describe('Virginia guide supply preserves authored alternatives', () => {
  it('requires both courses when a conjunction omits the repeated prefix', () => {
    const codes = ['MTH161', 'MTH162', 'MTH167'];
    expect(verdict('MTH 161 and 162 or MTH 167', codes, ['MTH161'])).toBe('missing');
    expect(verdict('MTH 161 and 162 or MTH 167', codes, ['MTH162'])).toBe('missing');
    expect(verdict('MTH 161 and 162 or MTH 167', codes, ['MTH161', 'MTH162'])).toBe('supplied');
    expect(verdict('MTH 161 and 162 or MTH 167', codes, ['MTH167'])).toBe('supplied');
  });

  it('keeps comma-list shorthand as alternatives', () => {
    const codes = ['HIST101', 'HIST102', 'HIST111', 'HIST112'];
    for (const code of codes) {
      expect(verdict('Any UCGS History: HIST 101, 102, 111, or 112', codes, [code]))
        .toBe('supplied');
    }
  });

  it('retains an unrestricted UCGS alternative next to a required pair', () => {
    expect(verdict('Any UCGS course or PED 101 and HLT 110', ['PED101', 'HLT110'], []))
      .toBe('assumed');
    // A specific list following a category heading still needs a listed course.
    expect(verdict('Any UCGS History: HIS 101, 102', ['HIS101', 'HIS102'], []))
      .toBe('missing');
  });
});

describe('Virginia committed-source accounting', () => {
  const variants = [
    build({ scheduledOnly: false }), build({ scheduledOnly: true }),
    build({ scheduledOnly: false, includeNonCs: true }),
    build({ scheduledOnly: true, includeNonCs: true }),
  ];

  it('never reports NSU’s unrestricted UCGS option as a missing PE pair', () => {
    for (const { cells } of variants) {
      for (const cell of cells.filter((row) => row.guide === 'nsu-computer-science-bs-transfer-guide')) {
        expect(cell.missing.some((row) => row.requirement === 'Any UCGS course or PED 101 and HLT 110'))
          .toBe(false);
      }
    }
  });

  it('keeps explicit no-credit courses in earned totals and out of applied credit', () => {
    const cell = variants[0].cells.find((row) => row.college === 'nova'
      && row.guide === 'uva-computer-science-bs-transfer-guide');
    expect(cell).toMatchObject({ as_total_units: 66, as_denied_units: 2,
      as_wasted_units: 2, as_applied_units: 64, missing_units: 0 });
    expect(cell.denied).toEqual([expect.objectContaining({ equivalent: 'Does not transfer', units: 2 })]);
    const row = rateRow(cell);
    expect(row).toMatchObject({ transferred_units: 64, known_nontransferable_units: 2,
      modeled_hours_above_120: 2, va_wasted_units: 2 });
    expect(row.va_wasted).toHaveLength(1);
  });

  it('conserves earned credits and emits finite counts in every supply variant', () => {
    for (const { cells } of variants) {
      for (const cell of cells) {
        const label = `${cell.college}/${cell.guide}`;
        expect(cell.as_applied_units + cell.as_wasted_units, label).toBe(cell.as_total_units);
        expect(cell.utilization, label).toBe(cell.as_applied_units / cell.as_total_units);
        expect(cell.itemised_units, label).toBe(
          cell.supplied + cell.missing_units + cell.assumed + cell.universityOnly,
        );
        for (const [key, value] of Object.entries(cell)) {
          if (typeof value === 'number') expect(Number.isFinite(value), `${label}/${key}`).toBe(true);
        }
        for (const key of ['covered_courses', 'pre_courses', 'courses_total']) {
          expect(Number.isInteger(cell[key]), `${label}/${key}`).toBe(true);
        }
        expect(cell.coverage, label).toBeLessThanOrEqual(cell.ceiling);
      }
    }
  });

  it('does not relabel a bachelor of arts guide as a bachelor of science', () => {
    const cell = variants[0].cells.find((row) => row.guide === 'vcu-computer-science-ba-transfer-guide');
    expect(coverageRow(cell).major).toBe('Computer Science, B.A.');
  });

  it('flags a source cardinality the supply-only join has not proved', () => {
    const cell = variants[3].cells.find((row) => row.college === 'escc'
      && row.guide === 'nsu-computer-science-bs-transfer-guide');
    expect(cell.method_status).toBe('estimated');
    expect(cell.source_interpretation_warnings.some((warning) => /supplies 1 of the two required courses/.test(warning)))
      .toBe(true);
    expect(rateRow(cell).method_warning).toContain('unverified estimate, not demonstrated coverage');
    expect(coverageRow(cell).va_source_warnings).toEqual(cell.source_interpretation_warnings);
  });

  it('keeps the committed cells reproducible from their captured sources', () => {
    const committed = require('../../.va-courses/va-coverage-cells.json');
    for (const [index, name] of ['catalog', 'scheduled', 'catalog_all', 'scheduled_all'].entries()) {
      expect(committed[name].cells, name).toEqual(variants[index].cells.map((cell) => ({
        ...cell, missing: cell.missing.slice(0, 12),
      })));
    }
  });
});

describe('Virginia lower-division lens', () => {
  const pre = (requirement, codes, equivalent, kind = 'course') => classifyPreTransferRow({
    requirement_text: requirement, cc_codes: codes, equivalent, kind, counts_toward_stats: true,
  });
  const post = (requirement, credits, notes = null) => classifyPostTransferRow({
    requirement_text: requirement, credits, notes, kind: 'named', counts_toward_stats: true,
  });

  it('classifies each pre-transfer row by what the university grants for it', () => {
    expect(pre('CSC 222', ['CSC222'], 'Elective')).toBe('elective');
    expect(pre('CSC 221', ['CSC221'], 'General Elective: CS 108')).toBe('elective');
    expect(pre('CSC 222', ['CSC222'], 'Unrestricted Elective (3 of 4)')).toBe('elective');
    expect(pre('SDV 100 or 101', ['SDV100', 'SDV101'], 'Does not transfer')).toBe('no_credit');
    expect(pre('CSC 222', ['CSC222'], 'Major: CS 112')).toBe('major');
    expect(pre('CSC 223', ['CSC223'], 'CS Elective')).toBe('major');
    expect(pre('CHM 111', ['CHM111'], 'CHEM 1410/1411')).toBe('major');
    expect(pre('ENG 111', ['ENG111'], 'ENGL 110')).toBe('ge');
    expect(pre('ENG 112 or 113', ['ENG112', 'ENG113'], 'ENGL non-major')).toBe('ge');
    expect(pre('Any UCGS History', [], 'Gen Ed: Interpreting the Past', 'gened_category')).toBe('ge');
  });

  it('keeps only lower-division requirements of their own from the university half', () => {
    expect(post('CS 141', '4')).toBe('major');
    expect(post('CS 2506 Intro to Computer Organization', '3')).toBe('major');
    expect(post('COLL 150', '4')).toBe('ge');
    expect(post('CS 3114', '3')).toBeNull();
    expect(post('ART-120, 322, 323; CSCI 230, 430, & 432', '18')).toBeNull();
    expect(post('Senior Major Electives', '9')).toBeNull();
    expect(post('Major: MATH 203', '0-3',
      'If MTH 266 is not completed at the community college, MATH 203 must be completed at George Mason.'))
      .toBeNull();
  });

  const { guides } = require('../../.va-guides/guides.json');
  const lynchburg = guides.find((guide) => guide.slug === 'ul-computer-science-bs-transfer-guide');
  const everything = new Set(lynchburg.cc_items.flatMap((row) => row.cc_codes));

  it('keeps work the guide moves after transfer in the denominator, uncovered', () => {
    const cell = lowerDivisionCell(lynchburg, { codes: everything }, everything);
    // The stated 62 pre-transfer credits less the 2 the university grants no
    // credit for, plus CS 141, 142, 241 and 242 at four credits and MATH 231 at
    // three, which the guide schedules after transfer.
    expect(cell).toEqual({ total: 79, covered: 60, ge_total: 21, ge_covered: 21 });
  });

  it('counts elective credit as satisfied whatever the college teaches', () => {
    const cell = lowerDivisionCell(lynchburg, { codes: new Set() }, everything);
    // CSC 222, CSC 223 and the discrete-structures row land as elective credit
    // at Lynchburg (11 credits) and two GE rows are open categories (6). The
    // guide's stated half is one credit under its itemised rows, so an empty
    // catalogue still covers 11 + 6 - 1 = 16.
    expect(cell.covered).toBe(16);
    expect(cell.total).toBe(79);
  });

  it('credits post-transfer work the guide says a VCCS college can do, and counts a repeated course once', () => {
    const vt = guides.find((guide) => guide.slug === 'vt-computer-science-bs-transfer-guide');
    const odu = guides.find((guide) => guide.slug === 'odu-computer-science-bs-transfer-guide');
    const uva = guides.find((guide) => guide.slug === 'uva-computer-science-bs-transfer-guide');
    const all = (guide) => new Set(guide.cc_items.flatMap((row) => row.cc_codes)
      .concat(['MTH266', 'CST100', 'CST110', 'ITN171']));
    const withAlternatives = (guide) => lowerDivisionCell(guide, { codes: all(guide) }, all(guide));
    const without = (guide) => lowerDivisionCell(guide, { codes: new Set(guide.cc_items.flatMap((row) => row.cc_codes)) }, all(guide));
    // VT: MATH 2114 (MTH 266) and COMM 2004/2014 (CST 100/110) can be done at
    // the college; CS 1944, CS 2104 and CS 2506 (7 credits) cannot.
    expect(withAlternatives(vt).total - withAlternatives(vt).covered).toBe(7);
    expect(without(vt).total - without(vt).covered).toBe(13);
    // ODU: CS 270 is already mapped from CSC 215 before transfer; CS 252 is
    // reachable through ITN 171; one credit of CS 260/261/263 remains.
    expect(withAlternatives(odu).total - withAlternatives(odu).covered).toBe(1);
    // UVA: CS 2130 is mapped from CSC 215 before transfer; only STS 2600 remains.
    expect(withAlternatives(uva).total - withAlternatives(uva).covered).toBe(3);
  });

  it('never covers more than it counts, in any supply variant', () => {
    for (const variant of [build({ scheduledOnly: false }), build({ scheduledOnly: true }),
      build({ scheduledOnly: false, includeNonCs: true })]) {
      for (const cell of variant.cells) {
        const row = coverageRow(cell);
        expect(row.named_requirement_units_lower_articulated)
          .toBeLessThanOrEqual(row.named_requirement_units_lower_total);
        expect(row.named_requirement_units_lower_ge_articulated)
          .toBeLessThanOrEqual(row.named_requirement_units_lower_ge_total);
        expect(row.named_requirement_units_lower_ge_total)
          .toBeGreaterThanOrEqual(row.named_requirement_units_lower_total);
      }
    }
  });
});
