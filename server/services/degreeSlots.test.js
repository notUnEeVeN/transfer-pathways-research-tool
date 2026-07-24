import { describe, expect, it } from 'vitest';
import { buildDegreeGroups, buildLedgerGroups, degreeUnitSystem } from './degreeSlots';

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

describe('unit-weighted degree coverage', () => {
  it('weights covered slots by the section unit budget and preserves fractional units', () => {
    const groups = [{
      title: 'Ten-unit sequence', tier: 'transferable',
      sections: [{
        section_advisement: 3,
        unit_advisement: 10,
        receivers: [
          { receiving: { kind: 'course', parent_id: 1 } },
          { receiving: { kind: 'course', parent_id: 2 } },
          { receiving: { kind: 'course', parent_id: 3 } },
        ],
      }],
    }];
    const result = buildDegreeGroups(groups, { articulated: new Set([1]) });
    expect(result).toMatchObject({
      total: 3,
      covered: 1,
      units: { total: 10, covered: 3.3 },
    });
  });

  it('uses stored or reference calendars before the unit-total fallback', () => {
    expect(degreeUnitSystem({ unit_system: 'semester', total_units: 180 }, 'quarter')).toBe('semester');
    expect(degreeUnitSystem({ total_units: 120 }, 'quarter')).toBe('quarter');
    expect(degreeUnitSystem({ total_units: 180 })).toBe('quarter');
    expect(degreeUnitSystem({ total_units: 120 })).toBe('semester');
    expect(degreeUnitSystem({})).toBe(null);
  });
});

// A campus may state a whole requirement as one NAMED ASSIST block rather than
// as course rows — UC Irvine's biology "Mathematics Requirement" is articulated
// at 114 of 115 colleges but carries no course id, so id-to-id matching reports
// 0% coverage for the entire discipline. A template group names the block it is
// satisfied by, and coverage honours it.
const namedRequirementGroups = [{
  title: 'Lower-division mathematics and statistics',
  tier: 'transferable',
  course_level: 'lower_division',
  assist_requirement: 'Mathematics Requirement',
  sections: [
    {
      section_advisement: 1,
      receivers: [
        { receiving: { kind: 'series', parent_ids: [901, 902] } },
        { receiving: { kind: 'series', parent_ids: [903, 904] } },
      ],
    },
    {
      section_advisement: 1,
      receivers: [{ receiving: { kind: 'course', parent_id: 905 } }],
    },
  ],
}];

describe('buildDegreeGroups named ASSIST requirements', () => {
  it('counts a group as covered when the ASSIST block it names is articulated', () => {
    const result = buildDegreeGroups(namedRequirementGroups, {
      articulated: new Set(),
      articulatedRequirements: new Set(['mathematics requirement']),
    });

    expect(result.total).toBe(2);
    expect(result.covered).toBe(2);
    expect(result.groups[0].lines.every((line) => line.status === 'covered')).toBe(true);
  });

  it('leaves the group uncovered where that block is not articulated', () => {
    const result = buildDegreeGroups(namedRequirementGroups, {
      articulated: new Set(),
      articulatedRequirements: new Set(),
    });

    expect(result.total).toBe(2);
    expect(result.covered).toBe(0);
  });

  it('matches the block name case- and whitespace-insensitively', () => {
    const result = buildDegreeGroups(namedRequirementGroups, {
      articulated: new Set(),
      articulatedRequirements: new Set(['  MATHEMATICS   REQUIREMENT '.toLowerCase().replace(/\s+/g, ' ').trim()]),
    });

    expect(result.covered).toBe(2);
  });

  it('still credits course-id articulation when no block name is declared', () => {
    const [group] = namedRequirementGroups;
    const withoutName = [{ ...group, assist_requirement: undefined }];
    const result = buildDegreeGroups(withoutName, {
      articulated: new Set([901, 902]),
      articulatedRequirements: new Set(['mathematics requirement']),
    });

    // The first section's first series articulates; the second section does not.
    expect(result.covered).toBe(1);
  });

  it('attributes a named-block group to its course categories', () => {
    const result = buildDegreeGroups(namedRequirementGroups, {
      articulated: new Set(),
      articulatedRequirements: new Set(['mathematics requirement']),
      universityCoursesById: {
        901: { prefix: 'MATH', number: '5A' }, 902: { prefix: 'MATH', number: '5B' },
        903: { prefix: 'MATH', number: '2A' }, 904: { prefix: 'MATH', number: '2B' },
        905: { prefix: 'STATS', number: '7' },
      },
      categoryOf: ({ section }) => (
        section?.receivers?.[0]?.receiving?.parent_id === 905 ? ['statistics'] : ['calculus']
      ),
    });

    expect(result.by_category.calculus).toMatchObject({ total: 1, covered: 1 });
    expect(result.by_category.statistics).toMatchObject({ total: 1, covered: 1 });
  });
});

describe('buildDegreeGroups receiver-level ASSIST blocks', () => {
  // UCLA lists four computer science courses by id in one section, but states
  // the first as a named block. Only that receiver may be credited by it.
  const groups = [{
    title: 'Lower-division computer science',
    tier: 'transferable',
    sections: [{
      section_advisement: 4,
      receivers: [
        { receiving: { kind: 'course', parent_id: 31 },
          assist_requirement: 'Computer programming courses: C++ preferred' },
        { receiving: { kind: 'course', parent_id: 32 } },
        { receiving: { kind: 'course', parent_id: 33 } },
        { receiving: { kind: 'course', parent_id: 35 } },
      ],
    }],
  }];

  it('credits only the receiver that declares the block', () => {
    const result = buildDegreeGroups(groups, {
      articulated: new Set(),
      articulatedRequirements: new Set(['computer programming courses: c++ preferred']),
    });

    expect(result.total).toBe(4);
    expect(result.covered).toBe(1);
  });

  it('leaves the other receivers on their own articulation', () => {
    const result = buildDegreeGroups(groups, {
      articulated: new Set([32, 33]),
      articulatedRequirements: new Set(['computer programming courses: c++ preferred']),
    });

    expect(result.covered).toBe(3);
  });

  it('credits nothing extra when the block is absent at this college', () => {
    const result = buildDegreeGroups(groups, {
      articulated: new Set([32]),
      articulatedRequirements: new Set(),
    });

    expect(result.covered).toBe(1);
  });

  it('works inside a choose-N section too', () => {
    const chooseOne = [{
      title: 'Physics',
      tier: 'transferable',
      sections: [{
        section_advisement: 1,
        receivers: [
          { receiving: { kind: 'course', parent_id: 700 } },
          { receiving: { kind: 'course', parent_id: 701 },
            assist_requirement: 'Level I Physics' },
        ],
      }],
    }];
    const result = buildDegreeGroups(chooseOne, {
      articulated: new Set(),
      articulatedRequirements: new Set(['level i physics']),
    });

    expect(result.covered).toBe(1);
  });
});

describe('buildDegreeGroups combination ASSIST blocks', () => {
  // Berkeley's engineering physics is PHYSICS 7A/7B/7C. The alternative is a
  // community college's introductory physics sequence, which Berkeley accepts
  // ONLY in combination — it publishes that as three separate Level blocks, so
  // a college carrying two of the three has not completed the alternative.
  const LEVELS = [
    'Courses that satisfy the Level I Physics requirement for Engineering major only',
    'Courses that satisfy the Level II Physics requirement for Engineering major only',
    'Courses that satisfy the Level III Physics requirement for Engineering major only',
  ];
  const groups = [{
    title: 'Physics',
    tier: 'transferable',
    assist_requirement: LEVELS,
    sections: [
      { section_advisement: 1, receivers: [{ receiving: { kind: 'course', parent_id: 7001 } }] },
      { section_advisement: 1, receivers: [{ receiving: { kind: 'course', parent_id: 7002 } }] },
    ],
  }];
  const names = (list) => new Set(list.map((n) => n.toLowerCase()));

  it('covers the group only when every block in the combination is articulated', () => {
    const all = buildDegreeGroups(groups, {
      articulated: new Set(), articulatedRequirements: names(LEVELS),
    });

    expect(all.total).toBe(2);
    expect(all.covered).toBe(2);
  });

  it('covers nothing when the college carries only part of the combination', () => {
    const partial = buildDegreeGroups(groups, {
      articulated: new Set(), articulatedRequirements: names(LEVELS.slice(1)),
    });

    expect(partial.covered).toBe(0);
  });

  it('still credits the primary course path when the combination is absent', () => {
    const viaCourses = buildDegreeGroups(groups, {
      articulated: new Set([7001, 7002]), articulatedRequirements: new Set(),
    });

    expect(viaCourses.covered).toBe(2);
  });

  it('treats a single block name as a combination of one', () => {
    const single = buildDegreeGroups(
      [{ ...groups[0], assist_requirement: LEVELS[0] }],
      { articulated: new Set(), articulatedRequirements: names([LEVELS[0]]) }
    );

    expect(single.covered).toBe(2);
  });
});
