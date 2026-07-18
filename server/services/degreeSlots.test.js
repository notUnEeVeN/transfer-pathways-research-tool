import { describe, expect, it } from 'vitest';
import { buildLedgerGroups } from './degreeSlots';

const breadthGroups = [{
  title: 'Humanities & Social Sciences breadth',
  tier: 'breadth',
  sections: [{
    section_advisement: 4,
    ge_areas: ['3A', '3B', '4'],
    receivers: [{
      receiving: { kind: 'ge_area', code: 'H/SS', name: 'Humanities & Social Sciences breadth' },
      ge_areas: ['3A', '3B', '4'],
      options: [],
    }],
  }],
}];

describe('buildLedgerGroups GE categories', () => {
  it('keeps the template as a category rule instead of an empty course row', () => {
    const ledger = buildLedgerGroups(breadthGroups, { template: true });
    const receiver = ledger.requirement_groups[0].sections[0].receivers[0];
    expect(receiver.options).toEqual([]);
    expect(receiver.category_match).toEqual({
      kind: 'ge_area',
      areas: ['3A', '3B', '4'],
      required_count: 4,
      qualifying_count: null,
      assumed: false,
    });
  });

  it('reports the complete qualifying count without emitting a three-course sample', () => {
    const ccGeAreas = new Map([
      ['3A', [{ course_id: 1, prefix: 'ART', number: '1' }, { course_id: 2, prefix: 'DRMA', number: '10' }]],
      ['3B', [{ course_id: 3, prefix: 'ENGL', number: '2' }]],
      ['4', [{ course_id: 4, prefix: 'HIST', number: '7' }, { course_id: 5, prefix: 'SOC', number: '1' }]],
    ]);
    const ledger = buildLedgerGroups(breadthGroups, { ccGeAreas });
    const receiver = ledger.requirement_groups[0].sections[0].receivers[0];
    expect(receiver.options).toEqual([]);
    expect(receiver.category_match.qualifying_count).toBe(5);
    expect(ledger.courses).toEqual([]);
  });

  it('carries CC catalog title + units into the ledger course lookup', () => {
    const groups = [{
      title: 'Major preparation', tier: 'transferable',
      sections: [{
        section_advisement: 1,
        receivers: [{ receiving: { kind: 'course', parent_id: 9 } }],
      }],
    }];
    const optionsByParent = new Map([[9, [{ course_ids: [7], course_conjunction: 'and' }]]]);
    const coursesById = new Map([[7, { course_id: 7, prefix: 'CS', number: '1', title: 'Intro to Computer Science', units: 4 }]]);
    const ledger = buildLedgerGroups(groups, { articulated: new Set([9]), optionsByParent, coursesById });
    expect(ledger.courses).toEqual([
      { course_id: 7, prefix: 'CS', number: '1', title: 'Intro to Computer Science', units: 4 },
    ]);
  });
});
