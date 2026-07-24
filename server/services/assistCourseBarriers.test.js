import { describe, expect, it } from 'vitest';
import { assistCourseCategoryCoverage } from './assistCourseBarriers';

const receiver = (hash, category) => ({
  hash_id: hash,
  receiving: { kind: 'course', parent_id: hash, category },
});

const section = (ask, receivers) => ({
  section_advisement: ask,
  receivers,
});

const group = (conjunction, sections, groupAdvisement = null) => ({
  is_required: true,
  group_conjunction: conjunction,
  group_advisement: groupAdvisement,
  sections,
});

const categoryOf = ({ receiver: item }) => [item.receiving.category];
const coverage = (groups, articulated = []) => assistCourseCategoryCoverage(
  groups,
  ['biology', 'calculus', 'statistics'],
  categoryOf,
  new Map(articulated.map((hash) => [hash, true]))
);

describe('assistCourseCategoryCoverage', () => {
  it('requires a category shared by every alternative pathway and accepts either path', () => {
    const groups = [group('Or', [
      section(2, [receiver('business-1', 'calculus'), receiver('business-2', 'calculus')]),
      section(3, [
        receiver('stem-1', 'calculus'), receiver('stem-2', 'calculus'),
        receiver('stem-3', 'calculus'),
      ]),
    ])];

    expect(coverage(groups, ['business-1', 'business-2']).calculus)
      .toMatchObject({ required: true, satisfied: true, missing_groups: 0 });
    expect(coverage(groups, ['stem-1', 'stem-2']).calculus)
      .toMatchObject({ required: true, satisfied: false, missing_groups: 1 });
  });

  it('does not call either side of a cross-category choice independently required', () => {
    const groups = [group('Or', [section(1, [
      receiver('stats', 'statistics'), receiver('life-science', 'biology'),
    ])], 1)];
    const result = coverage(groups);

    expect(result.statistics).toMatchObject({ required: false, satisfied: null });
    expect(result.biology).toMatchObject({ required: false, satisfied: null });
  });

  it('isolates one category from missing requirements in another category', () => {
    const groups = [group('And', [
      section(1, [receiver('bio', 'biology')]),
      section(2, [receiver('calc-1', 'calculus'), receiver('calc-2', 'calculus')]),
    ])];
    const result = coverage(groups, ['calc-1', 'calc-2']);

    expect(result.calculus).toMatchObject({ required: true, satisfied: true });
    expect(result.biology).toMatchObject({ required: true, satisfied: false });
  });

  it('requires a category receiver that is unavoidable inside a mixed section', () => {
    const groups = [group('And', [section(3, [
      receiver('calc-1', 'calculus'), receiver('calc-2', 'calculus'),
      receiver('stats', 'statistics'),
    ])])];
    const result = coverage(groups, ['calc-1', 'calc-2']);

    expect(result.calculus).toMatchObject({ required: true, satisfied: true });
    expect(result.statistics).toMatchObject({ required: true, satisfied: false });
  });

  it('keeps every receiver in a required ASSIST group', () => {
    const groups = [group('And', [section(2, [
      receiver('bio-1', 'biology'),
      receiver('bio-2', 'biology'),
    ])])];
    const result = assistCourseCategoryCoverage(
      groups,
      ['biology'],
      categoryOf,
      new Map([['bio-1', true]])
    );

    expect(result.biology).toMatchObject({
      required: true,
      satisfied: false,
      missing_groups: 1,
    });
  });

  it('uses PMT is_required semantics without campus-specific exceptions', () => {
    const optional = {
      ...group('And', [section(1, [receiver('optional', 'calculus')])]),
      is_required: false,
    };
    const result = assistCourseCategoryCoverage(
      [optional],
      ['calculus'],
      categoryOf,
      new Map([['optional', true]])
    );

    expect(result.calculus).toMatchObject({ required: false, satisfied: null });
  });
});
