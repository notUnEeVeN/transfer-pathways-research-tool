import { describe, expect, it } from 'vitest';
import {
  buildDegreeGroups, buildLedgerGroups, computeUnitBudget, degreeUnitSystem,
} from './degreeSlots';

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

  it('keeps GE-titled groups out of the category rollup only when the corpus opts in', () => {
    const groups = [
      {
        title: 'Lower-division major requirements',
        sections: [{ receivers: [{ receiving: { kind: 'course', parent_id: 1 } }] }],
      },
      {
        title: 'GE: general education and electives',
        sections: [{ receivers: [{ receiving: { kind: 'course', parent_id: 2 } }] }],
      },
    ];
    const ctx = {
      articulated: new Set([1, 2]),
      categoryOf: () => ['computing'],
    };

    // Default (California): GE receivers keep counting, the verified figure
    // semantics stay untouched.
    const kept = buildDegreeGroups(groups, ctx);
    expect(kept.by_category.computing).toMatchObject({ total: 2, covered: 2 });

    // Massachusetts opts in: the paper's matrix has no GE columns, so the
    // GE-titled group leaves the rollup (slot totals are unaffected).
    const excluded = buildDegreeGroups(groups, { ...ctx, excludeGeFromCategories: true });
    expect(excluded.by_category.computing).toMatchObject({ total: 1, covered: 1 });
    expect(excluded.total).toBe(kept.total);
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

// Berkeley MCB names two calculus sequences and twelve emphasis tracks as `Or`
// groups. Summing their sections charged the degree once per alternative and
// pushed its denominator from 120 units to 392, which collapsed the coverage
// heatmap to single digits.
const orGroups = [{
  title: 'Lower-division mathematics — one complete sequence',
  group_conjunction: 'Or',
  sections: [
    {
      section_advisement: 1,
      unit_advisement: 8,
      receivers: [{ receiving: { kind: 'series', parent_ids: [51, 52] }, options: [] }],
    },
    {
      section_advisement: 1,
      unit_advisement: 8,
      receivers: [{ receiving: { kind: 'series', parent_ids: [10, 11] }, options: [] }],
    },
  ],
}];

describe('buildDegreeGroups alternative (Or) groups', () => {
  it('charges one path, not one per alternative', () => {
    const template = buildDegreeGroups(orGroups, {});
    expect(template.units.total).toBe(8);
    expect(template.total).toBe(1);
  });

  it('counts the group covered when any one alternative articulates', () => {
    const result = buildDegreeGroups(orGroups, { articulated: new Set([51, 52]) });
    expect(result.covered).toBe(1);
    expect(result.units.covered).toBe(8);
  });

  it('does not average an articulated path with an unarticulated one', () => {
    const result = buildDegreeGroups(orGroups, { articulated: new Set([10, 11]) });
    expect(result.covered).toBe(1);
    expect(result.units.covered).toBe(8);
  });

  it('reports the group missing when no alternative articulates', () => {
    const result = buildDegreeGroups(orGroups, { articulated: new Set([999]) });
    expect(result.covered).toBe(0);
    expect(result.units.covered).toBe(0);
    expect(result.units.total).toBe(8);
  });

  it('still sums the sections of an And group', () => {
    const and = [{ ...orGroups[0], group_conjunction: 'And' }];
    expect(buildDegreeGroups(and, {}).units.total).toBe(16);
  });

  it('collapses the named-requirement rollup to the picked path too, in courses', () => {
    // Each alternative is a two-course series; the paper counts courses, so
    // one picked path = two required courses, both articulated.
    const result = buildDegreeGroups(orGroups, { articulated: new Set([51, 52]) })
    expect(result.named_requirements.courses).toEqual({ total: 2, covered: 2 });
  });

  it('collapses the course-type rollup to the picked path too', () => {
    // The slot/unit collapse alone left by_category summing every alternative:
    // Berkeley MCB's twelve tracks reported 94 typed slots against a 26-slot
    // degree, so the course-type figure disagreed with the heatmap it sits by.
    const result = buildDegreeGroups(orGroups, {
      articulated: new Set([51, 52]),
      categoryOf: () => 'math',
    });
    expect(result.by_category.math.total).toBe(1);
    expect(result.by_category.math.covered).toBe(1);
    expect(result.by_category_multi.math.total).toBe(1);
  });

  it('types the template of an Or group by one alternative as well', () => {
    const result = buildDegreeGroups(orGroups, { categoryOf: () => 'math' });
    expect(result.by_category.math.total).toBe(1);
  });
});

// The Massachusetts paper's published heatmap (final SIGCSE submission,
// Figure 1) measures required courses at EVERY level — department, college,
// or campus — excluding general education, binary articulated-or-not per
// course. Upper-division requirements rarely articulate, which is exactly why
// their statewide mean is 38.2%. This rollup reproduces that population from
// our templates: every named course requirement, with GE (any tier) and
// free-elective padding excluded.
describe('buildDegreeGroups named-requirement rollup (MA-paper population)', () => {
  const maGroups = [
    {
      title: 'Lower-division computer science',
      tier: 'transferable',
      sections: [{
        section_advisement: 2,
        unit_advisement: 8,
        receivers: [
          { receiving: { kind: 'course', parent_id: 61 } },
          { receiving: { kind: 'course', parent_id: 62 } },
        ],
      }],
    },
    {
      title: 'GE: Humanities breadth',
      tier: 'breadth',
      sections: [{
        section_advisement: 2,
        unit_advisement: 8,
        receivers: [{ receiving: { kind: 'ge_area', code: 'H/SS' }, ge_areas: ['3A', '4'] }],
      }],
    },
    {
      title: 'GE: Reading & Composition',
      tier: 'transferable',
      sections: [{
        section_advisement: 1,
        unit_advisement: 4,
        receivers: [{ receiving: { kind: 'course', parent_id: 71 }, ge_areas: ['1A'] }],
      }],
    },
    {
      title: 'American History & Institutions',
      tier: 'transferable',
      sections: [{
        section_advisement: 1,
        receivers: [{ receiving: { kind: 'ge_area', code: 'AH&I' }, assume_satisfiable: true }],
      }],
    },
    {
      title: 'Upper-division major coursework',
      tier: 'nontransferable',
      sections: [{
        section_advisement: 5,
        unit_advisement: 20,
        receivers: [{ receiving: { kind: 'requirement' } }],
      }],
    },
    {
      title: 'GE: Humanities breadth — upper-division (2 courses, at campus)',
      tier: 'nontransferable',
      sections: [{
        section_advisement: 2,
        receivers: [{ receiving: { kind: 'requirement' } }],
      }],
    },
    {
      title: 'Unrestricted electives — to reach the 120-unit minimum',
      tier: 'nontransferable',
      sections: [{
        section_advisement: 4,
        receivers: [{ receiving: { kind: 'requirement' } }],
      }],
    },
  ];

  it('counts named course requirements at every level, GE and padding excluded', () => {
    const result = buildDegreeGroups(maGroups, { articulated: new Set([61]) });
    // Two CS courses plus five stated upper-division courses in scope, one
    // articulated. Breadth, R&C (course receiver with a GE fallback), AH&I,
    // the upper-division GE block, and the elective padding all stay out.
    expect(result.named_requirements.courses).toEqual({ total: 7, covered: 1 });
  });

  it('reports totals with null coverage on an unevaluated template', () => {
    const result = buildDegreeGroups(maGroups, {});
    expect(result.named_requirements.courses).toEqual({ total: 7, covered: null });
  });

  it('expands a series requirement to its courses, covered all-or-nothing', () => {
    const groups = [{
      title: 'Lower-division physics — one series',
      tier: 'transferable',
      sections: [{
        section_advisement: 1,
        unit_advisement: 15,
        receivers: [{ receiving: { kind: 'series', parent_ids: [301, 302, 303] } }],
      }],
    }];
    // Articulated series: every course in it articulates.
    expect(buildDegreeGroups(groups, { articulated: new Set([301, 302, 303]) })
      .named_requirements.courses).toEqual({ total: 3, covered: 3 });
    // Unarticulated: three required courses, none covered — not one slot.
    expect(buildDegreeGroups(groups, { articulated: new Set() })
      .named_requirements.courses).toEqual({ total: 3, covered: 0 });
  });

  it('leaves out sections the source says no community college can satisfy', () => {
    // Virginia flags senior residency work `cc_articulable: false`. Counting it
    // as an unarticulated requirement caps the figure far below 100% for
    // structural reasons and makes corpora that enumerate upper-division work
    // to different depths incomparable — Virginia's mean read 14.6% against
    // Massachusetts' 38.2% on what is nominally the same measure.
    const groups = [{
      title: 'Major requirements',
      tier: 'transferable',
      sections: [
        {
          unit_advisement: 4,
          cc_articulable: true,
          receivers: [{ receiving: { kind: 'course', parent_id: 401 } }],
        },
        {
          unit_advisement: 3,
          cc_articulable: false,
          receivers: [{ receiving: { kind: 'course', parent_id: 402 } }],
        },
      ],
    }];
    // Only the articulable section is in the population, and it is covered.
    expect(buildDegreeGroups(groups, { articulated: new Set([401]) })
      .named_requirements.courses).toEqual({ total: 1, covered: 1 });
  });

  it('keeps a section whose articulability the source never states', () => {
    // California and Massachusetts documents carry no flag, so the rule above
    // must be a no-op for them rather than silently shrinking their population.
    const groups = [{
      title: 'Major requirements',
      tier: 'transferable',
      sections: [{
        unit_advisement: 4,
        receivers: [{ receiving: { kind: 'course', parent_id: 401 } }],
      }],
    }];
    expect(buildDegreeGroups(groups, { articulated: new Set() })
      .named_requirements.courses).toEqual({ total: 1, covered: 0 });
  });

  it('prices a choose-one between alternative series at the cheapest path', () => {
    const groups = [{
      title: 'Lower-division mathematics — choose one complete sequence',
      tier: 'transferable',
      sections: [{
        section_advisement: 1,
        receivers: [
          { receiving: { kind: 'series', parent_ids: [401, 402, 403] } },
          { receiving: { kind: 'series', parent_ids: [404, 405] } },
        ],
      }],
    }];
    // The requirement costs one path; the cheapest is the two-course series.
    const result = buildDegreeGroups(groups, { articulated: new Set([401, 402, 403]) });
    expect(result.named_requirements.courses.total).toBe(2);
    // The articulated path is the longer one; covered stays within the total.
    expect(result.named_requirements.courses.covered).toBe(2);
  });

  it('derives a course count from units only where nothing else is stated', () => {
    const groups = [{
      title: 'Upper-division coursework outside the major',
      tier: 'nontransferable',
      sections: [{
        unit_advisement: 8,
        receivers: [{ receiving: { kind: 'requirement' } }],
      }],
    }];
    expect(buildDegreeGroups(groups, {}).named_requirements.courses.total).toBe(2);
  });

  it('keeps a major requirement whose title merely mentions double-counting GE', () => {
    // Merced and San Diego annotate major groups with "also satisfies GE …" —
    // the annotation must not read as a general-education block, or whole
    // campuses lose their mathematics to a phrase.
    const groups = [
      {
        title: 'Lower-division mathematics & statistics — also satisfies GE Approaches to Knowledge',
        tier: 'transferable',
        sections: [{ section_advisement: 2, receivers: [
          { receiving: { kind: 'course', parent_id: 71 } },
          { receiving: { kind: 'course', parent_id: 72 } },
        ] }],
      },
      {
        title: 'Upper-division campus GE experiences',
        tier: 'nontransferable',
        sections: [{ section_advisement: 2, receivers: [{ receiving: { kind: 'requirement' } }] }],
      },
    ];
    const result = buildDegreeGroups(groups, { articulated: new Set([71]) });
    expect(result.named_requirements.courses).toEqual({ total: 2, covered: 1 });
  });

  it('optionally includes GE, articulable below the upper division', () => {
    // Economics-style degrees are mostly general education, so the GE-excluded
    // measure reads artificially low for them. The GE-on variant counts GE
    // courses too: lower-division GE is articulable everywhere (IGETC or
    // Cal-GETC certification clears it, per the modelling standard), while
    // upper-division GE still counts against. Padding stays excluded.
    const result = buildDegreeGroups(maGroups, { articulated: new Set([61]) });
    // 7 GE-excluded courses + breadth 2 + R&C 1 + AH&I 1 + upper-division GE 2.
    expect(result.named_requirements.courses_with_ge).toEqual({ total: 13, covered: 5 });
  });

  it('credits an articulated named ASSIST block inside the population', () => {
    const named = [{
      title: 'Mathematics',
      tier: 'transferable',
      assist_requirement: 'Mathematics Requirement',
      sections: [{
        section_advisement: 1,
        unit_advisement: 8,
        receivers: [{ receiving: { kind: 'course', parent_id: 90 } }],
      }],
    }];
    const result = buildDegreeGroups(named, {
      articulated: new Set(),
      articulatedRequirements: new Set(['mathematics requirement']),
    });
    expect(result.named_requirements.courses).toEqual({ total: 1, covered: 1 });
  });
});

// The unit budget is the denominator of the transfer figures, so it must price
// a degree the way buildDegreeGroups and degreeTransferBudget already do: an
// `Or` group costs one path, and a group marked university-only at the group
// level is university-only in its entirety — in either vocabulary (the CS
// documents' `tier`, or the bio/econ documents' `course_level` +
// `cc_articulable`). Berkeley MCB carried section-level `tier: 'transferable'`
// under its nontransferable groups, and the section winning over the group is
// what reported all 392 mis-summed units as lower division.
describe('computeUnitBudget', () => {
  const section = (units, over = {}) => ({
    section_advisement: 1, unit_advisement: units, receivers: [], ...over,
  });

  it('charges an Or group one path, not one per alternative', () => {
    const budget = computeUnitBudget([{
      group_conjunction: 'Or',
      tier: 'transferable',
      sections: [section(8), section(8)],
    }]);
    expect(budget.modeled_units).toBe(8);
    expect(budget.per_tier.transferable).toBe(8);
  });

  it('prices a choice at the cheapest alternative a college can reach', () => {
    const budget = computeUnitBudget([{
      group_conjunction: 'Or',
      tier: 'transferable',
      sections: [
        section(12, { articulation_reach: 0 }),
        section(17, { articulation_reach: 41 }),
        section(15, { articulation_reach: 12 }),
      ],
    }]);
    // The 12-unit path reaches no college, so it cannot set the price.
    expect(budget.modeled_units).toBe(15);
  });

  it('assumes an alternative is live where reach is unrecorded', () => {
    const budget = computeUnitBudget([{
      group_conjunction: 'Or',
      tier: 'transferable',
      sections: [section(12), section(17)],
    }]);
    expect(budget.modeled_units).toBe(12);
  });

  it('lets a nontransferable group override contradictory section tiers', () => {
    const budget = computeUnitBudget([{
      group_conjunction: 'Or',
      tier: 'nontransferable',
      course_level: 'upper_division',
      cc_articulable: false,
      sections: [section(24, { tier: 'transferable' }), section(24, { tier: 'transferable' })],
    }]);
    expect(budget.per_tier.nontransferable).toBe(24);
    expect(budget.per_tier.transferable).toBe(0);
  });

  it('reads the course_level vocabulary as university-only work', () => {
    const budget = computeUnitBudget([{
      course_level: 'upper_division',
      sections: [section(8, { tier: 'transferable' })],
    }]);
    expect(budget.per_tier.nontransferable).toBe(8);
  });

  it('reads cc_articulable: false as university-only work', () => {
    const budget = computeUnitBudget([{
      cc_articulable: false,
      sections: [section(10, { tier: 'transferable' })],
    }]);
    expect(budget.per_tier.nontransferable).toBe(10);
  });

  it('still lets a section state its own tier under an ordinary group', () => {
    const budget = computeUnitBudget([{
      tier: 'transferable',
      sections: [section(4), section(8, { tier: 'nontransferable' })],
    }]);
    expect(budget.per_tier.transferable).toBe(4);
    expect(budget.per_tier.nontransferable).toBe(8);
  });

  it('still sums the sections of an And group', () => {
    const budget = computeUnitBudget([{
      tier: 'transferable',
      sections: [section(4), section(6), section(null, { section_advisement: 2 })],
    }]);
    // Two unpriced slots take the documented four-unit assumption.
    expect(budget.modeled_units).toBe(18);
  });
});
