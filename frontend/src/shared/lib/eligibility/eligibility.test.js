import { describe, it, expect } from 'vitest';
import {
  isCourseCompleted,
  isReceiverCompleted,
  isReceiverAvailable,
  calculateUnitsFromCompletedReceivers,
  sectionMaxContribution,
  sectionContribution,
  getEffectiveGroupAsk,
  dBucketQualifyingCount,
  isSectionCompleted,
  isGroupCompleted,
  isMajorCompleted,
  calculateMajorCompletionPercentage,
  getGroupDisplayStat,
} from './index';

// ---------------------------------------------------------------------------
// Fixture builders matching the agreement shape documented at the top of
// eligibility/predicates.js: major.requirement_groups[].sections[].receivers[].
// Receivers default to articulated + no hash_id. Cross-CC equivalency is
// passed explicitly as the `crossCc` argument (the records array), so no
// localStorage is involved.
// ---------------------------------------------------------------------------

const uc = (course_id, course_units = 3, extra = {}) => ({
  course_id,
  course_units,
  ...extra,
});

const mkReceiver = ({
  options,
  optIds = [],
  optConj = 'and',
  optionsConj = 'or',
  units,
  kind = 'course',
  articulated = true,
  hash,
} = {}) => ({
  receiving: { kind, ...(units != null ? { units } : {}) },
  articulation_status: articulated ? 'articulated' : 'not_articulated',
  options: options ?? [{ course_ids: optIds, course_conjunction: optConj }],
  options_conjunction: optionsConj,
  ...(hash ? { hash_id: hash } : {}),
});

const mkSection = ({ receivers = [], section_advisement, unit_advisement } = {}) => ({
  receivers,
  ...(section_advisement != null ? { section_advisement } : {}),
  ...(unit_advisement != null ? { unit_advisement } : {}),
});

const mkGroup = (props = {}) => ({ is_required: true, ...props });

describe('isCourseCompleted', () => {
  it('returns true for a direct course_id match', () => {
    expect(isCourseCompleted(5, [uc(5)])).toBe(true);
  });
  it('returns true when a taken course lists the id as a same_as peer', () => {
    const taken = uc(9, 3, { same_as: [{ course_id: 5 }] });
    expect(isCourseCompleted(5, [taken])).toBe(true);
  });
  it('returns false when neither direct nor same_as matches', () => {
    expect(isCourseCompleted(5, [uc(1), uc(2)])).toBe(false);
  });
  it('counts C-or-better letter grades but not C-minus / D / F', () => {
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'A' })])).toBe(true);
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'C' })])).toBe(true);
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'C-' })])).toBe(false);
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'D' })])).toBe(false);
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'F' })])).toBe(false);
  });
  it('counts planned (PL) and in-progress (IP) courses', () => {
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'PL' })])).toBe(true);
    expect(isCourseCompleted(5, [uc(5, 3, { course_grade: 'IP' })])).toBe(true);
  });
  it('does not credit a same_as peer when the held course failed', () => {
    const failed = uc(9, 3, { course_grade: 'F', same_as: [{ course_id: 5 }] });
    expect(isCourseCompleted(5, [failed])).toBe(false);
  });
});

describe('isReceiverCompleted', () => {
  it('AND option: requires every course_id', () => {
    const r = mkReceiver({ options: [{ course_ids: [1, 2], course_conjunction: 'and' }] });
    expect(isReceiverCompleted(r, [uc(1), uc(2)])).toBe(true);
    expect(isReceiverCompleted(r, [uc(1)])).toBe(false);
  });
  it('OR option: any one course_id satisfies', () => {
    const r = mkReceiver({ options: [{ course_ids: [1, 2], course_conjunction: 'or' }] });
    expect(isReceiverCompleted(r, [uc(2)])).toBe(true);
  });
  it('options_conjunction OR: any one option satisfies', () => {
    const r = mkReceiver({
      options: [
        { course_ids: [1], course_conjunction: 'and' },
        { course_ids: [2], course_conjunction: 'and' },
      ],
      optionsConj: 'or',
    });
    expect(isReceiverCompleted(r, [uc(2)])).toBe(true);
  });
  it('options_conjunction AND: every option must be satisfied', () => {
    const r = mkReceiver({
      options: [
        { course_ids: [1], course_conjunction: 'and' },
        { course_ids: [2], course_conjunction: 'and' },
      ],
      optionsConj: 'and',
    });
    expect(isReceiverCompleted(r, [uc(1)])).toBe(false);
    expect(isReceiverCompleted(r, [uc(1), uc(2)])).toBe(true);
  });
  it('no options and no hash_id → false', () => {
    const r = mkReceiver({ options: [] });
    expect(isReceiverCompleted(r, [uc(1)])).toBe(false);
  });
  it('cross-CC hash fallback: satisfied when crossCc holds the hash', () => {
    const r = mkReceiver({ options: [], hash: 'h1' });
    expect(isReceiverCompleted(r, [])).toBe(false);
    expect(isReceiverCompleted(r, [], [{ hash_id: 'h1' }])).toBe(true);
  });
});

describe('isReceiverAvailable', () => {
  it('articulated receiver is always available', () => {
    expect(isReceiverAvailable(mkReceiver({ articulated: true }))).toBe(true);
  });
  it('not-articulated with no hash is unavailable', () => {
    expect(isReceiverAvailable(mkReceiver({ articulated: false }))).toBe(false);
  });
  it('not-articulated becomes available once a cross-CC hash is supplied', () => {
    const r = mkReceiver({ articulated: false, hash: 'h2' });
    expect(isReceiverAvailable(r)).toBe(false);
    expect(isReceiverAvailable(r, [{ hash_id: 'h2' }])).toBe(true);
  });
});

describe('calculateUnitsFromCompletedReceivers', () => {
  it('sums receiving.units for completed receivers', () => {
    const receivers = [
      mkReceiver({ optIds: [1], units: 4 }),
      mkReceiver({ optIds: [2], units: 5 }),
    ];
    expect(calculateUnitsFromCompletedReceivers(receivers, [uc(1), uc(2)])).toBe(9);
  });
  it('skips receivers that are not completed', () => {
    const receivers = [mkReceiver({ optIds: [1], units: 4 })];
    expect(calculateUnitsFromCompletedReceivers(receivers, [uc(99)])).toBe(0);
  });
  it('falls back to the satisfying option CC units when receiving.units is absent', () => {
    const r = mkReceiver({ options: [{ course_ids: [1], course_conjunction: 'and' }], kind: 'requirement' });
    expect(calculateUnitsFromCompletedReceivers([r], [uc(1, 3)])).toBe(3);
  });
});

describe('sectionMaxContribution / sectionContribution', () => {
  const threeArticulated = [
    mkReceiver({ optIds: [1] }),
    mkReceiver({ optIds: [2] }),
    mkReceiver({ optIds: [3] }),
  ];
  it('max contribution defaults to the reachable receiver count', () => {
    expect(sectionMaxContribution(mkSection({ receivers: threeArticulated }))).toBe(3);
  });
  it('section_advisement caps the max contribution', () => {
    expect(sectionMaxContribution(mkSection({ receivers: threeArticulated, section_advisement: 1 }))).toBe(1);
    expect(sectionMaxContribution(mkSection({ receivers: threeArticulated, section_advisement: 9 }))).toBe(3);
  });
  it('contribution counts completed receivers, clamped by the cap', () => {
    const sec = mkSection({ receivers: threeArticulated });
    expect(sectionContribution(sec, [uc(1), uc(2)])).toBe(2);
    const capped = mkSection({ receivers: threeArticulated, section_advisement: 1 });
    expect(sectionContribution(capped, [uc(1), uc(2)])).toBe(1);
  });
});

describe('getEffectiveGroupAsk', () => {
  it('returns 0 when the group has no group_advisement', () => {
    expect(getEffectiveGroupAsk(mkGroup({ sections: [] }))).toBe(0);
  });
  it('AND group: caps the stated ask at the total reachable contribution', () => {
    const sections = [mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] })];
    expect(getEffectiveGroupAsk(mkGroup({ group_advisement: 5, group_conjunction: 'And', sections }))).toBe(2);
    expect(getEffectiveGroupAsk(mkGroup({ group_advisement: 1, group_conjunction: 'And', sections }))).toBe(1);
  });
  it('OR group with per-section asks returns the raw group_advisement (pick-one-path)', () => {
    const sections = [
      mkSection({ receivers: [mkReceiver({ optIds: [1] })], section_advisement: 1 }),
      mkSection({ receivers: [mkReceiver({ optIds: [2] })], section_advisement: 1 }),
    ];
    expect(getEffectiveGroupAsk(mkGroup({ group_advisement: 1, group_conjunction: 'Or', sections }))).toBe(1);
  });
});

describe('isSectionCompleted', () => {
  it('unit_advisement: satisfied once completed units reach the threshold', () => {
    const sec = mkSection({ receivers: [mkReceiver({ optIds: [1], units: 5 })], unit_advisement: 5 });
    expect(isSectionCompleted(sec, [uc(1)])).toBe(true);
    expect(isSectionCompleted(sec, [])).toBe(false);
  });
  it('section_advisement: needs that many completed receivers (capped by reachable)', () => {
    const sec = mkSection({
      receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] }), mkReceiver({ optIds: [3] })],
      section_advisement: 2,
    });
    expect(isSectionCompleted(sec, [uc(1)])).toBe(false);
    expect(isSectionCompleted(sec, [uc(1), uc(2)])).toBe(true);
  });
  it('no advisement: any one completed receiver satisfies', () => {
    const sec = mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] });
    expect(isSectionCompleted(sec, [uc(2)])).toBe(true);
    expect(isSectionCompleted(sec, [])).toBe(false);
  });
  it('a fully-unarticulated section is auto-satisfied (completed after transfer)', () => {
    const sec = mkSection({ receivers: [mkReceiver({ articulated: false }), mkReceiver({ articulated: false })] });
    expect(isSectionCompleted(sec, [])).toBe(true);
  });
  it('unit_advisement is capped to achievable units', () => {
    // Needs 8 units but only one 4-unit course articulates here → cap to 4.
    const sec = mkSection({
      receivers: [mkReceiver({ optIds: [1], units: 4 }), mkReceiver({ articulated: false, units: 4 })],
      unit_advisement: 8,
    });
    expect(isSectionCompleted(sec, [uc(1)])).toBe(true);
    expect(isSectionCompleted(sec, [])).toBe(false);
  });
});

describe('isGroupCompleted', () => {
  it('group_unit_advisement: total completed units across sections must reach it', () => {
    const g = mkGroup({
      group_unit_advisement: 8,
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1], units: 4 })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [2], units: 4 })] }),
      ],
    });
    expect(isGroupCompleted(g, [uc(1), uc(2)])).toBe(true);
    expect(isGroupCompleted(g, [uc(1)])).toBe(false);
  });
  it('group_unit_advisement is capped to achievable units', () => {
    // 12 units asked, but only 4 articulate here → complete that 4 → satisfied.
    const g = mkGroup({
      group_unit_advisement: 12,
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1], units: 4 })] }),
        mkSection({ receivers: [mkReceiver({ articulated: false, units: 4 })] }),
        mkSection({ receivers: [mkReceiver({ articulated: false, units: 4 })] }),
      ],
    });
    expect(isGroupCompleted(g, [uc(1)])).toBe(true);
    expect(isGroupCompleted(g, [])).toBe(false);
  });
  it('plain AND group: a fully-unarticulated section does not block it', () => {
    const g = mkGroup({
      group_conjunction: 'And',
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] })] }),
        mkSection({ receivers: [mkReceiver({ articulated: false }), mkReceiver({ articulated: false })] }),
      ],
    });
    expect(isGroupCompleted(g, [uc(1)])).toBe(true); // unarticulated section auto-credited
    expect(isGroupCompleted(g, [])).toBe(false); // the completable section is still required
  });
  it('AND + group_advisement: summed capped contributions must meet the ask', () => {
    const g = mkGroup({
      group_advisement: 2,
      group_conjunction: 'And',
      sections: [mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] }), mkReceiver({ optIds: [3] })] })],
    });
    expect(isGroupCompleted(g, [uc(1)])).toBe(false);
    expect(isGroupCompleted(g, [uc(1), uc(2)])).toBe(true);
  });
  it('OR + per-section asks: any one fully-completed reachable section satisfies', () => {
    const g = mkGroup({
      group_advisement: 1,
      group_conjunction: 'Or',
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] })], section_advisement: 1 }),
        mkSection({ receivers: [mkReceiver({ optIds: [2] })], section_advisement: 1 }),
      ],
    });
    expect(isGroupCompleted(g, [])).toBe(false);
    expect(isGroupCompleted(g, [uc(2)])).toBe(true);
  });
  it('plain AND group (no advisement): every section must be completed', () => {
    const g = mkGroup({
      group_conjunction: 'And',
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [2] })] }),
      ],
    });
    expect(isGroupCompleted(g, [uc(1)])).toBe(false);
    expect(isGroupCompleted(g, [uc(1), uc(2)])).toBe(true);
  });
  it('plain OR group (no advisement): any one reachable section satisfies', () => {
    const g = mkGroup({
      group_conjunction: 'Or',
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [2] })] }),
      ],
    });
    expect(isGroupCompleted(g, [uc(2)])).toBe(true);
  });
  it('distinct-section constraint: needs K sections each with ≥M completed', () => {
    const g = mkGroup({
      group_advisement: 2,
      group_conjunction: 'And',
      group_min_distinct_sections: 2,
      group_section_min_courses: 1,
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [3] }), mkReceiver({ optIds: [4] })] }),
      ],
    });
    // Two courses from ONE section meet the count (2) but only 1 distinct section → not complete.
    expect(isGroupCompleted(g, [uc(1), uc(2)])).toBe(false);
    // One from each section → 2 distinct sections → complete.
    expect(isGroupCompleted(g, [uc(1), uc(3)])).toBe(true);
  });

  it('D-bucket: an unarticulated area does NOT reduce the ask when enough areas articulate', () => {
    // "2 courses from 3 of these 4 areas." One area has no articulation; the
    // other three do — so all three must be completed (no free credit).
    const g = mkGroup({
      group_advisement: 6,
      group_conjunction: 'And',
      group_min_distinct_sections: 3,
      group_section_min_courses: 2,
      sections: [
        mkSection({ receivers: [mkReceiver({ articulated: false }), mkReceiver({ articulated: false })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [3] }), mkReceiver({ optIds: [4] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [5] }), mkReceiver({ optIds: [6] })] }),
      ],
    });
    // 3 areas articulate, need 3 → no auto-credit; two areas isn't enough.
    expect(isGroupCompleted(g, [uc(1), uc(2), uc(3), uc(4)])).toBe(false);
    expect(isGroupCompleted(g, [uc(1), uc(2), uc(3), uc(4), uc(5), uc(6)])).toBe(true);
  });

  it('D-bucket: auto-credits only the genuine shortfall when too few areas articulate', () => {
    // Only 2 of the 4 areas can reach 2 courses here → exactly 1 area is
    // auto-credited; the student must still complete BOTH reachable areas.
    const g = mkGroup({
      group_advisement: 6,
      group_conjunction: 'And',
      group_min_distinct_sections: 3,
      group_section_min_courses: 2,
      sections: [
        mkSection({ receivers: [mkReceiver({ articulated: false }), mkReceiver({ articulated: false })] }),
        mkSection({ receivers: [mkReceiver({ articulated: false }), mkReceiver({ optIds: [1] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [2] }), mkReceiver({ optIds: [3] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [4] }), mkReceiver({ optIds: [5] })] }),
      ],
    });
    expect(dBucketQualifyingCount(g, [])).toBe(1); // only the unfillable gap
    expect(isGroupCompleted(g, [uc(2), uc(3)])).toBe(false); // 1 reachable + 1 auto = 2 < 3
    expect(isGroupCompleted(g, [uc(2), uc(3), uc(4), uc(5)])).toBe(true); // 2 reachable + 1 auto = 3
    const major = { requirement_groups: [g] };
    expect(calculateMajorCompletionPercentage(major, [uc(2), uc(3), uc(4), uc(5)])).toBe(100);
  });

  it('D-bucket still enforced when the CC articulates enough areas', () => {
    const g = mkGroup({
      group_advisement: 4,
      group_conjunction: 'And',
      group_min_distinct_sections: 2,
      group_section_min_courses: 2,
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [3] }), mkReceiver({ optIds: [4] })] }),
      ],
    });
    expect(isGroupCompleted(g, [])).toBe(false);
    expect(isGroupCompleted(g, [uc(1), uc(2)])).toBe(false); // 1 area only
    expect(isGroupCompleted(g, [uc(1), uc(2), uc(3), uc(4)])).toBe(true); // 2 areas, 2 each
  });
});

describe('isMajorCompleted', () => {
  const reqGroup = mkGroup({
    is_required: true,
    group_conjunction: 'And',
    sections: [mkSection({ receivers: [mkReceiver({ optIds: [1] })] })],
  });
  it('returns false when there are no required groups', () => {
    const major = { requirement_groups: [{ ...reqGroup, is_required: false }] };
    expect(isMajorCompleted(major, [uc(1)])).toBe(false);
  });
  it('requires every required group to be completed', () => {
    const major = {
      requirement_groups: [
        reqGroup,
        mkGroup({ is_required: true, group_conjunction: 'And', sections: [mkSection({ receivers: [mkReceiver({ optIds: [2] })] })] }),
      ],
    };
    expect(isMajorCompleted(major, [uc(1)])).toBe(false);
    expect(isMajorCompleted(major, [uc(1), uc(2)])).toBe(true);
  });
  it('ignores non-required groups', () => {
    const major = {
      requirement_groups: [
        reqGroup,
        mkGroup({ is_required: false, group_conjunction: 'And', sections: [mkSection({ receivers: [mkReceiver({ optIds: [99] })] })] }),
      ],
    };
    expect(isMajorCompleted(major, [uc(1)])).toBe(true);
  });
});

describe('calculateMajorCompletionPercentage', () => {
  it('returns 0 when there are no required groups', () => {
    expect(calculateMajorCompletionPercentage({ requirement_groups: [] }, [])).toBe(0);
  });
  it('AND group with a section_advisement of 2: one of two done → 50%', () => {
    const major = {
      requirement_groups: [
        mkGroup({
          is_required: true,
          group_conjunction: 'And',
          sections: [
            mkSection({
              receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })],
              section_advisement: 2,
            }),
          ],
        }),
      ],
    };
    expect(calculateMajorCompletionPercentage(major, [uc(1)])).toBe(50);
  });
  it('reaches 100% when all required work is done', () => {
    const major = {
      requirement_groups: [
        mkGroup({
          is_required: true,
          group_conjunction: 'And',
          sections: [mkSection({ receivers: [mkReceiver({ optIds: [1] })], section_advisement: 1 })],
        }),
      ],
    };
    expect(calculateMajorCompletionPercentage(major, [uc(1)])).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Cross-paradigm consistency: the completion boolean, the display chip, and
// the percentage must never disagree. A group complete per isGroupCompleted
// must show done>=total on the chip and contribute 100% to the percentage,
// and vice-versa.
// ---------------------------------------------------------------------------

describe('consistency: C-bucket group_max_distinct_sections', () => {
  // "Complete 4 courses from any 2 of these 4 areas."
  const mk = () =>
    mkGroup({
      group_advisement: 4,
      group_conjunction: 'And',
      group_max_distinct_sections: 2,
      sections: [
        mkSection({ receivers: [mkReceiver({ optIds: [1] }), mkReceiver({ optIds: [2] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [3] }), mkReceiver({ optIds: [4] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [5] }), mkReceiver({ optIds: [6] })] }),
        mkSection({ receivers: [mkReceiver({ optIds: [7] }), mkReceiver({ optIds: [8] })] }),
      ],
    });

  it('spread across too many areas: boolean, chip, and percentage all agree it is incomplete', () => {
    const g = mk();
    const spread = [uc(1), uc(3), uc(5), uc(7)]; // 4 courses, but 4 distinct areas > cap of 2
    const stat = getGroupDisplayStat(g, spread);
    expect(isGroupCompleted(g, spread)).toBe(false);
    expect(stat.done).toBeLessThan(stat.total); // chip must not look complete
    expect(calculateMajorCompletionPercentage({ requirement_groups: [g] }, spread)).toBeLessThan(100);
  });

  it('concentrated within the cap: all three agree it is complete', () => {
    const g = mk();
    const concentrated = [uc(1), uc(2), uc(3), uc(4)]; // 4 courses from 2 areas
    const stat = getGroupDisplayStat(g, concentrated);
    expect(isGroupCompleted(g, concentrated)).toBe(true);
    expect(stat.done).toBe(stat.total);
    expect(calculateMajorCompletionPercentage({ requirement_groups: [g] }, concentrated)).toBe(100);
  });

  it('an extra course in a third area does not un-complete a satisfied C-bucket', () => {
    const g = mk();
    const done = [uc(1), uc(2), uc(3), uc(4), uc(5)]; // 4 from two areas + 1 extra
    expect(isGroupCompleted(g, done)).toBe(true);
  });
});

describe('consistency: unit-advisement chip is reachability-capped', () => {
  // 12 units asked but only one 4-unit course articulates here.
  const g = mkGroup({
    group_unit_advisement: 12,
    sections: [
      mkSection({ receivers: [mkReceiver({ optIds: [1], units: 4 })] }),
      mkSection({ receivers: [mkReceiver({ articulated: false, units: 4 })] }),
      mkSection({ receivers: [mkReceiver({ articulated: false, units: 4 })] }),
    ],
  });

  it('a complete unit group shows done>=total on the chip (matching the boolean and percentage)', () => {
    const done = [uc(1, 4)];
    const stat = getGroupDisplayStat(g, done);
    expect(isGroupCompleted(g, done)).toBe(true);
    expect(stat.done).toBe(stat.total);
    expect(stat.total).toBe(4); // capped to achievable, not the raw 12
    expect(stat.originalTotal).toBe(12); // ASSIST's stated ask preserved
  });
});

describe('consistency: unit-advisement section in the percentage', () => {
  // Section asks 4 units; the courses are 2 units each (three available).
  const g = mkGroup({
    group_conjunction: 'And',
    sections: [
      mkSection({
        receivers: [
          mkReceiver({ optIds: [1], units: 2 }),
          mkReceiver({ optIds: [2], units: 2 }),
          mkReceiver({ optIds: [3], units: 2 }),
        ],
        unit_advisement: 4,
      }),
    ],
  });

  it('one 2-unit course (2 of 4 units) is not 100% — percentage tracks real units, matching the boolean', () => {
    const major = { requirement_groups: [g] };
    expect(isGroupCompleted(g, [uc(1, 2)])).toBe(false);
    expect(calculateMajorCompletionPercentage(major, [uc(1, 2)])).toBeLessThan(100);
  });

  it('reaching the unit ask is 100%, matching the boolean', () => {
    const major = { requirement_groups: [g] };
    expect(isGroupCompleted(g, [uc(1, 2), uc(2, 2)])).toBe(true);
    expect(calculateMajorCompletionPercentage(major, [uc(1, 2), uc(2, 2)])).toBe(100);
  });
});
