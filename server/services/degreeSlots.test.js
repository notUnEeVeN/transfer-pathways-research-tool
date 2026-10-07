import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDegreeGroups, buildLedgerGroups, computeUnitBudget, degreeUnitSystem, maResidueRole,
} from './degreeSlots';
import { getMajor } from '../config/majors';
import { compileDegreeComposition } from './virginia/degreeComposition';
import { canonicalSourceContract } from './analysis/canonicalSourceContract';

const VA_COMPOSED = path.resolve(__dirname, '../.va-catalogs/composed');
const vaRequirementGroups = (slug) => compileDegreeComposition(
  JSON.parse(fs.readFileSync(path.join(VA_COMPOSED, `${slug}.json`), 'utf8')),
  { institutionLevel: 'four_year' },
).requirement_groups;

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
  it('sums authored credits of covered courses instead of spreading a block evenly', () => {
    const groups = [{
      title: 'UCSB lower-division computer science', tier: 'transferable',
      sections: [{
        section_advisement: 5, unit_advisement: 21,
        receivers: [4, 4, 4, 5, 4].map((units, index) => ({
          receiving: { kind: 'course', parent_id: index + 1, units },
        })),
      }],
    }];
    const result = buildDegreeGroups(groups, { articulated: new Set([1, 2, 3, 5]) });
    expect(result.units).toMatchObject({ total: 21, covered: 16 });
    expect(result.covered).toBe(4);
  });

  it('prices an articulated series at its stated credits and preserves real fractional credits', () => {
    const groups = [{
      title: 'Biology and lab', tier: 'transferable',
      sections: [{
        section_advisement: 2, unit_advisement: 6.5,
        receivers: [
          { receiving: { kind: 'series', parent_ids: [1, 2], units: 5 } },
          { receiving: { kind: 'course', parent_id: 3, units: 1.5 } },
        ],
      }],
    }];
    expect(buildDegreeGroups(groups, { articulated: new Set([1, 2]) }).units.covered).toBe(5);
    expect(buildDegreeGroups(groups, { articulated: new Set([3]) }).units.covered).toBe(1.5);
    expect(buildDegreeGroups(groups, { articulated: new Set([1]) }).units.covered).toBe(0);
  });

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

describe('lower-division named-requirement units', () => {
  const groups = [
    {
      title: 'Lower-division major', tier: 'transferable',
      sections: [{
        section_advisement: 3,
        receivers: [4, 4, 5].map((units, index) => ({
          receiving: { kind: 'course', parent_id: index + 1, units },
        })),
      }],
    },
    {
      title: 'Upper-division major', tier: 'nontransferable',
      sections: [{
        section_advisement: 2,
        receivers: [4, 4].map((units, index) => ({
          receiving: { kind: 'course', parent_id: index + 10, units },
        })),
      }],
    },
    {
      title: 'General education', tier: 'breadth',
      sections: [{
        section_advisement: 3, unit_advisement: 12,
        receivers: [{ receiving: { kind: 'ge_area', code: 'H/SS', name: 'Breadth' } }],
      }],
    },
    {
      title: 'Upper-division GE', tier: 'nontransferable',
      sections: [{
        section_advisement: 1, unit_advisement: 4,
        receivers: [{ receiving: { kind: 'ge_area', code: 'UD', name: 'Upper-division GE' } }],
      }],
    },
    {
      title: 'Free electives', tier: 'transferable',
      sections: [{ section_advisement: 2, unit_advisement: 8, receivers: [] }],
    },
    {
      title: 'Further units earned at UC Test — transfer cap reached', tier: 'nontransferable',
      cc_articulable: false,
      sections: [{ section_advisement: 3, unit_advisement: 12, receivers: [] }],
    },
  ];

  it('keeps upper division off both sides and counts lower-division elective credit as covered', () => {
    const { named_requirements: named } = buildDegreeGroups(groups, {
      articulated: new Set([1, 3, 10]),
    });
    // 4 + 5 of the 13 lower-division major credits, plus the 8 free-elective
    // credits any transferable course fills. The articulated upper-division
    // course and the cap-reached block, earned at the university, do not count.
    expect(named.units_lower).toEqual({ total: 21, covered: 17 });
    // Lower-division GE is cleared by certification and joins both sides; the
    // upper-division GE block does not.
    expect(named.units_lower_with_ge).toEqual({ total: 33, covered: 29 });
    expect(named.elective_units_lower).toBe(8);
    // The required population on its own, free-elective capacity left out:
    // 13 lower-division major credits with 9 articulated, and the same plus
    // certified lower-division GE. This is the pair Figure 1's lower-division
    // reading divides, so it can never exceed the campus's own named total the
    // way an elective-inclusive ceiling can.
    expect(named.units_lower_required).toEqual({ total: 13, covered: 9 });
    expect(named.units_lower_with_ge_required).toEqual({ total: 25, covered: 21 });
  });

  it('holds a California template’s elective credit to the transfer cap', () => {
    const padded = groups.map((g) => (g.title === 'Free electives'
      ? { ...g, sections: [{ section_advisement: 25, unit_advisement: 100, receivers: [] }] }
      : g));
    const { named_requirements: named } = buildDegreeGroups(padded, {
      articulated: new Set([1, 3]), sourceDocument: { total_units: 180, unit_system: 'quarter' },
    });
    // 13 major + 12 GE leave 80 of the 105-unit cap for electives, not 100.
    expect(named.elective_units_lower).toBe(80);
    expect(named.units_lower_with_ge.total).toBe(105);
  });

  it('reads the Massachusetts residue row by row', () => {
    const maGroups = [
      groups[0],
      {
        title: "GE: general education and electives (excluded from the paper's articulation analysis)",
        tier: 'transferable',
        sections: [{
          section_advisement: 5, unit_advisement: 16,
          receivers: [
            { receiving: { kind: 'course', parent_id: 20, code: 'ELEC XXX', name: 'Humanities', units: 3 } },
            { receiving: { kind: 'course', parent_id: 21, code: 'ENGL 0101', name: 'Composition I', units: 4 } },
            { receiving: { kind: 'course', parent_id: 22, code: 'ELEC XXX', name: 'Free Elective', units: 3 } },
            { receiving: { kind: 'course', parent_id: 23, code: 'ELEC XXXX', name: 'Minor', units: 3 } },
            { receiving: { kind: 'course', parent_id: 24, code: 'CICS 305', name: 'Social Issues in Computing', units: 3 } },
          ],
        }],
      },
    ];
    const ma = buildDegreeGroups(maGroups, {
      articulated: new Set([1]), sourceDocument: { state: 'ma' },
    }).named_requirements;
    // The free-elective and minor rows are elective credit on both readings; the
    // 300-level course is upper division and counts on neither.
    expect(ma.units_lower).toEqual({ total: 19, covered: 10 });
    expect(ma.units_lower_with_ge).toEqual({ total: 26, covered: 17 });
    // The residue's elective rows drop out of the required reading; its GE
    // rows stay, because certification clears them.
    expect(ma.units_lower_required).toEqual({ total: 13, covered: 4 });
    expect(ma.units_lower_with_ge_required).toEqual({ total: 20, covered: 11 });
    // Any other corpus keeps a GE section whole: the row reading is the
    // Massachusetts source's, not a general rule.
    const whole = buildDegreeGroups(maGroups, { articulated: new Set([1]) }).named_requirements;
    expect(whole.units_lower_with_ge).toEqual({ total: 29, covered: 20 });
  });

  it('classifies residue rows by name and conventional course level', () => {
    expect(maResidueRole({ code: 'ELEC XXX', name: 'free elective' })).toBe('elective');
    expect(maResidueRole({ code: 'ELEC XXX', name: 'Free elec' })).toBe('elective');
    expect(maResidueRole({ code: 'ELEC XXXX', name: 'Minor' })).toBe('elective');
    expect(maResidueRole({ code: 'COMP 4010', name: 'Software Project I' })).toBe('upper');
    expect(maResidueRole({ code: 'CIS 381', name: 'Social and Ethical Aspects' })).toBe('upper');
    // A letter suffix is part of the course number, not the end of it.
    expect(maResidueRole({ code: 'COMPSCI 396A', name: 'Independent Study' })).toBe('upper');
    expect(maResidueRole({ code: 'COMPSCI 198C', name: 'Introduction to C' })).toBe('ge');
    expect(maResidueRole({ code: 'CHEM 0109', name: 'General Chemistry I' })).toBe('ge');
    expect(maResidueRole({ code: 'XXXX 299', name: 'Second Year Seminar' })).toBe('ge');
    expect(maResidueRole({ code: '', name: 'First Year Seminar' })).toBe('ge');
  });
});

describe('degree ledger preserves the evaluated requirement', () => {
  it('keeps the two Davis statistics alternatives as choose-one paths', () => {
    const groups = [{
      title: 'Lower-division statistics — complete one course', group_conjunction: 'Or',
      sections: [354134, 219073].map((parent_id) => ({
        section_advisement: 1, unit_advisement: 4,
        receivers: [{ receiving: { kind: 'course', parent_id } }],
      })),
    }];
    const ledger = buildLedgerGroups(groups, { template: true });
    expect(ledger.requirement_groups[0].sections).toHaveLength(2);
    expect(ledger.requirement_groups[0].sections.map((s) => s.section_advisement)).toEqual([1, 1]);
    expect(buildDegreeGroups(ledger.requirement_groups).total).toBe(1);
  });

  it('carries named ASSIST coverage through to the ledger', () => {
    const ledger = buildLedgerGroups(namedRequirementGroups, {
      articulatedRequirements: new Set(['mathematics requirement']),
    });
    const receivers = ledger.requirement_groups.flatMap((g) => g.sections.flatMap((s) => s.receivers));
    expect(receivers.every((r) => r.articulation_status === 'articulated')).toBe(true);
    expect(receivers.every((r) => r.assist_requirement === 'Mathematics Requirement')).toBe(true);
    expect(receivers.every((r) => r.options.length === 0)).toBe(true);
  });

  it('preserves concrete sending options when named-block and course evidence both exist', () => {
    const option = { course_ids: [7], course_conjunction: 'and' };
    const ledger = buildLedgerGroups(namedRequirementGroups, {
      articulated: new Set([905]),
      articulatedRequirements: new Set(['mathematics requirement']),
      optionsByParent: new Map([[905, [option]]]),
      coursesById: new Map([[7, { course_id: 7, prefix: 'STAT', number: '1', units: 4 }]]),
    });
    const receiver = ledger.requirement_groups[0].sections.flatMap((s) => s.receivers)
      .find((r) => r.receiving.parent_id === 905);
    expect(receiver.options).toEqual([option]);
    expect(ledger.courses).toHaveLength(1);
  });
});

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

    // The base evaluator is source-neutral: callers that do not opt in keep
    // GE receivers in their category rollup.
    const kept = buildDegreeGroups(groups, ctx);
    expect(kept.by_category.computing).toMatchObject({ total: 2, covered: 2 });

    // Massachusetts opts in: the paper's matrix has no GE columns, so the
    // GE-titled group leaves the rollup (slot totals are unaffected).
    const excluded = buildDegreeGroups(groups, { ...ctx, excludeGeFromCategories: true });
    expect(excluded.by_category.computing).toMatchObject({ total: 1, covered: 1 });
    expect(excluded.total).toBe(kept.total);
  });

  it.each(['cs', 'bio', 'econ'])(
    'keeps %s GE/padding out of Figure 2 without changing overall coverage',
    (majorSlug) => {
      const groups = [
        {
          title: 'Lower-division major requirements',
          sections: [{ receivers: [{ receiving: { kind: 'course', parent_id: 1 } }] }],
        },
        {
          title: 'GE: general education breadth',
          sections: [{ receivers: [{ receiving: { kind: 'course', parent_id: 2 } }] }],
        },
        {
          title: 'UC-transferable elective capacity to reach the 120-unit minimum',
          sections: [{ receivers: [{ receiving: { kind: 'course', parent_id: 3 } }] }],
        },
      ];
      const ctx = {
        articulated: new Set([1, 3]),
        categoryOf: () => ['non_stem'],
      };
      const allGroups = buildDegreeGroups(groups, ctx);
      const courseTypeFigure = buildDegreeGroups(groups, {
        ...ctx,
        excludeGeFromCategories: Boolean(
          getMajor(majorSlug)?.courseTypes?.excludeGeGroups,
        ),
      });

      expect(getMajor(majorSlug).courseTypes.excludeGeGroups).toBe(true);
      expect(allGroups.by_category.non_stem).toMatchObject({ total: 3, covered: 2 });
      expect(courseTypeFigure.by_category.non_stem)
        .toMatchObject({ total: 1, covered: 1 });
      expect(courseTypeFigure.by_category_multi.non_stem)
        .toMatchObject({ total: 1, covered: 1 });

      // Category bumps are the only changed output. The coverage heatmap and
      // every overall slot/unit field retain the complete degree population.
      expect(courseTypeFigure.total).toBe(allGroups.total);
      expect(courseTypeFigure.covered).toBe(allGroups.covered);
      expect(courseTypeFigure.units).toEqual(allGroups.units);
      expect(courseTypeFigure.by_tier).toEqual(allGroups.by_tier);
      expect(courseTypeFigure.groups).toEqual(allGroups.groups);
    },
  );
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
    // The slot/unit collapse alone left by_category summing every alternative.
    // Figure 2 now follows Figure 1's course population, so the picked
    // two-course series contributes two typed courses, not one receiver slot.
    const result = buildDegreeGroups(orGroups, {
      articulated: new Set([51, 52]),
      categoryOf: () => 'math',
      excludeGeFromCategories: true,
    });
    expect(result.by_category.math.total).toBe(2);
    expect(result.by_category.math.covered).toBe(2);
    // The multi-category diagnostic intentionally retains receiver-slot grain.
    expect(result.by_category_multi.math.total).toBe(1);
  });

  it('types the template of an Or group by one alternative as well', () => {
    const result = buildDegreeGroups(orGroups, {
      categoryOf: () => 'math', excludeGeFromCategories: true,
    });
    expect(result.by_category.math.total).toBe(2);
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

  it('partitions the exact named-course population into Figure 2 categories', () => {
    const groups = [
      {
        title: 'Required science sequence', tier: 'transferable',
        sections: [{ section_advisement: 1, receivers: [{
          receiving: { kind: 'series', parent_ids: [301, 302, 303] },
        }] }],
      },
      {
        title: 'GE: Humanities breadth', tier: 'breadth',
        sections: [{ section_advisement: 2, receivers: [{
          receiving: { kind: 'ge_area', code: 'H/SS' }, ge_areas: ['3A'],
        }] }],
      },
      {
        title: 'Upper-division computing', tier: 'nontransferable',
        sections: [{ section_advisement: 2, unit_advisement: 8, receivers: [{
          receiving: { kind: 'requirement', name: 'Upper-division computing' },
        }] }],
      },
    ];
    const categoryOf = ({ receiver, section }) => {
      const parent = receiver?.receiving?.parent_id;
      if (parent === 301) return ['science'];
      if (parent === 302 || parent === 303) return ['math'];
      if (/upper-division/i.test(section?.receivers?.[0]?.receiving?.name || '')) {
        return ['computing'];
      }
      return ['non_stem'];
    };
    const result = buildDegreeGroups(groups, {
      articulated: new Set([301, 302, 303]),
      categoryOf,
      excludeGeFromCategories: true,
    });
    expect(result.named_requirements.courses).toEqual({ total: 5, covered: 3 });
    expect(result.by_category).toMatchObject({
      science: { total: 1, covered: 1, lower_division_total: 1, lower_division_covered: 1 },
      math: { total: 2, covered: 2, lower_division_total: 2, lower_division_covered: 2 },
      computing: { total: 2, covered: 0, lower_division_total: 0, lower_division_covered: 0 },
    });
    const totals = Object.values(result.by_category).reduce((sum, bucket) => ({
      total: sum.total + bucket.total,
      covered: sum.covered + bucket.covered,
    }), { total: 0, covered: 0 });
    expect(totals).toEqual(result.named_requirements.courses);
    expect(result.by_category.non_stem).toBeUndefined();
  });

  it('keeps university-only named courses as uncovered paper observations', () => {
    // The paper counts degree/college requirements other than GE. A source flag
    // saying the second course cannot articulate explains its zero; it does not
    // remove that named requirement from the paper-equivalent denominator.
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
    // Both named courses are in the population; only the first is covered.
    expect(buildDegreeGroups(groups, { articulated: new Set([401]) })
      .named_requirements.courses).toEqual({ total: 2, covered: 1 });
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

  it('does not treat a breadth tier as GE without GE semantics', () => {
    const groups = [{
      title: 'College writing requirement',
      tier: 'breadth',
      sections: [{
        section_advisement: 1,
        receivers: [{ receiving: { kind: 'course', parent_id: 411 } }],
      }],
    }];
    expect(buildDegreeGroups(groups, { articulated: new Set([411]) })
      .named_requirements.courses).toEqual({ total: 1, covered: 1 });
  });

  it('keeps a named School requirement despite a GE-shaped open-course carrier', () => {
    const groups = [{
      title: 'School additional Social Sciences — two distinct courses',
      tier: 'breadth',
      sections: [{
        section_advisement: 2,
        assume_satisfiable: true,
        receivers: [{
          receiving: { kind: 'ge_area', name: 'Two additional Social Sciences courses' },
          assume_satisfiable: true,
        }],
      }],
    }];
    expect(buildDegreeGroups(groups, { articulated: new Set() })
      .named_requirements.courses).toEqual({ total: 2, covered: 2 });
  });

  it('still excludes an explicitly named College GE requirement', () => {
    const groups = [{
      title: 'Campus/College GE remaining after major overlap',
      tier: 'breadth',
      sections: [{
        section_advisement: 2,
        assume_satisfiable: true,
        receivers: [{ receiving: { kind: 'ge_area' }, assume_satisfiable: true }],
      }],
    }];
    expect(buildDegreeGroups(groups, { articulated: new Set() })
      .named_requirements.courses).toEqual({ total: 0, covered: 0 });
  });

  it('keeps a mixed named-course menu when one alternative is an open GE-shaped carrier', () => {
    const groups = [{
      title: 'Advanced major selection',
      tier: 'nontransferable',
      sections: [{
        section_advisement: 3,
        receivers: [
          { receiving: { kind: 'course', parent_id: 1 } },
          { receiving: { kind: 'course', parent_id: 2 } },
          { receiving: { kind: 'ge_area', code: 'OPEN-500' } },
        ],
      }],
    }];
    expect(buildDegreeGroups(groups, {}).named_requirements.courses)
      .toEqual({ total: 3, covered: null });
  });

  it.each([
    ['christopher-newport-university', 37],
    ['norfolk-state-university', 39],
    // VMI has pure GE-shaped sections, not a mixed-receiver section; the
    // stricter classification must leave its existing denominator unchanged.
    ['virginia-military-institute', 36],
  ])('retains every named Virginia course slot in the real %s tree', (slug, expected) => {
    const groups = vaRequirementGroups(slug);
    const result = buildDegreeGroups(groups, {});
    expect(result.named_requirements.courses.total).toBe(expected);

    // Removing only open GE-shaped alternatives must not change the named
    // course denominator of an otherwise concrete course-choice section.
    const withoutOpenCarriers = structuredClone(groups);
    for (const group of withoutOpenCarriers) {
      for (const section of group.sections || []) {
        if ((section.receivers || []).some((receiver) => receiver.receiving?.kind === 'course')) {
          section.receivers = section.receivers.filter((receiver) => (
            receiver.receiving?.kind !== 'ge_area'
          ));
        }
      }
    }
    expect(buildDegreeGroups(withoutOpenCarriers, {}).named_requirements.courses.total)
      .toBe(expected);
  });

  it.each([
    ['james-madison-university', 16],
    ['christopher-newport-university', 26],
    ['norfolk-state-university', 29],
    ['william-mary', 12],
  ])('uses authored roles for the canonical Figure 1 population in %s', (slug, expected) => {
    const requirementGroups = vaRequirementGroups(slug);
    const sourceDocument = {
      state: 'va',
      analysis_contract: canonicalSourceContract(),
      requirement_groups: requirementGroups,
    };
    const result = buildDegreeGroups(requirementGroups, {
      sourceDocument,
      articulated: new Set(),
    });

    expect(result.requirement_role_issues).toEqual([]);
    expect(result.named_requirements.courses).toEqual({ total: expected, covered: 0 });
  });

  it('counts an all-open upper-level major menu as named and gives it no assumed coverage', () => {
    const groups = [{
      requirement_layer: 'major',
      course_level: 'upper_division',
      tier: 'breadth',
      cc_articulable: false,
      sections: [{
        section_advisement: 3,
        unit_advisement: 9,
        receivers: [
          { receiving: { kind: 'ge_area', code: 'OPEN-A' } },
          { receiving: { kind: 'ge_area', code: 'OPEN-B' } },
          { receiving: { kind: 'ge_area', code: 'OPEN-C' } },
        ],
      }],
    }];
    const sourceDocument = {
      analysis_contract: canonicalSourceContract(),
      requirement_groups: groups,
    };
    const result = buildDegreeGroups(groups, {
      sourceDocument,
      articulated: new Set(),
    });

    expect(result.named_requirements.courses).toEqual({ total: 3, covered: 0 });
    expect(result.named_requirements.courses_with_ge).toEqual({ total: 3, covered: 0 });
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

// The Massachusetts Figure 1 population, weighted by credit instead of counted
// binary. It has to be the SAME walk that produces `courses` — a second
// derivation would be free to drift from the figure it claims to re-weight —
// so these assertions pin the two rollups to one another as well as to their
// own arithmetic.
describe('named requirement units', () => {
  // An MA template's shape: one take-all section per group, receivers priced
  // by the university course catalogue rather than by a `units` field on the
  // receiver itself.
  const maUniversityCourses = {
    1001: { parent_id: 1001, min_units: 4 },
    1002: { parent_id: 1002, min_units: 3 },
    1003: { parent_id: 1003, min_units: 4 },
    2001: { parent_id: 2001, min_units: 3 },
    3001: { parent_id: 3001, min_units: 3 },
    3002: { parent_id: 3002, min_units: 4 },
  };
  const course = (parentId) => ({ receiving: { kind: 'course', parent_id: parentId } });
  const maGroups = [
    {
      title: 'Lower-division major requirements',
      tier: 'transferable',
      sections: [{
        section_advisement: 3,
        unit_advisement: 11,
        receivers: [course(1001), course(1002), course(1003)],
      }],
    },
    {
      title: 'Upper-division major requirements',
      tier: 'nontransferable',
      sections: [{ section_advisement: 1, unit_advisement: 3, receivers: [course(2001)] }],
    },
    {
      title: "GE: general education and electives (excluded from the paper's articulation analysis)",
      tier: 'transferable',
      sections: [{
        section_advisement: 2,
        unit_advisement: 7,
        receivers: [course(3001), course(3002)],
      }],
    },
  ];

  it('weights the figure-1 course population by each requirement’s own credits', () => {
    const result = buildDegreeGroups(maGroups, {
      articulated: new Set([1001, 1002]),
      universityCoursesById: maUniversityCourses,
    });
    // Two of four named courses articulate, but they are a 4-credit and a
    // 3-credit course out of 14 non-GE credits — not half of them.
    expect(result.named_requirements.courses).toEqual({ total: 4, covered: 2 });
    expect(result.named_requirements.units).toEqual({ total: 14, covered: 7 });
  });

  it('credits the whole general-education block under the GE-included variant', () => {
    const result = buildDegreeGroups(maGroups, {
      articulated: new Set([1001]),
      universityCoursesById: maUniversityCourses,
    });
    // GE clears below the upper division by the modelling standard, exactly as
    // the course variant already assumes, so all 7 GE credits count covered.
    expect(result.named_requirements.courses_with_ge).toEqual({ total: 6, covered: 3 });
    expect(result.named_requirements.units_with_ge).toEqual({ total: 21, covered: 11 });
  });

  it('falls back to the section’s own credit share for an unpriced requirement', () => {
    const groups = [{
      title: 'Lower-division major requirements',
      tier: 'transferable',
      sections: [{
        section_advisement: 2,
        unit_advisement: 9,
        receivers: [course(9001), course(9002)],
      }],
    }];
    const result = buildDegreeGroups(groups, {
      articulated: new Set([9001]),
      universityCoursesById: {},
    });
    // Nothing prices either course, so the section's own 9 credits divide
    // evenly — the documented proportional estimate, not a 4-credit guess.
    expect(result.named_requirements.units).toEqual({ total: 9, covered: 4.5 });
  });

  it('reports no units rather than zero when the template is unevaluated', () => {
    const result = buildDegreeGroups(maGroups, { universityCoursesById: maUniversityCourses });
    expect(result.named_requirements.units).toEqual({ total: 14, covered: null });
    expect(result.named_requirements.units_with_ge).toEqual({ total: 21, covered: null });
  });
});
