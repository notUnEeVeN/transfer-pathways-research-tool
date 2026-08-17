import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { computeTransferBudget } = cjs('./degreeTransferBudget');

const group = (units, over = {}) => ({
  group_conjunction: 'And',
  sections: [{ unit_advisement: units, section_advisement: 1, receivers: [] }],
  ...over,
});

describe('degree transfer budget', () => {
  it('lets the cap bind when the university side fits inside the gap', () => {
    // UCLA Biology: 73 preparation + 36 GE transferable, 60 upper division,
    // 180 total, 105 cap. 180 - 105 = 75 of room against 60 required.
    const budget = computeTransferBudget({
      total_units: 180,
      unit_system: 'quarter',
      requirement_groups: [
        group(73), group(36),
        group(60, { course_level: 'upper_division', cc_articulable: false }),
      ],
    });
    expect(budget.transferred).toBe(105);
    expect(budget.university.total).toBe(75);
    expect(budget.university.required).toBe(60);
    expect(budget.university.unallocated).toBe(15);
    expect(budget.binding).toBe('transfer_cap');
  });

  it('lets the requirements bind when they exceed the gap the cap leaves', () => {
    // The case the old approach could not express: 120 units, a 70-unit cap,
    // and 60 units that cannot transfer. The gap is 50, so the student takes
    // 60 at the university and transfers 60 — not the 70 the cap allows.
    const budget = computeTransferBudget({
      total_units: 120,
      unit_system: 'semester',
      requirement_groups: [
        group(80),
        group(60, { course_level: 'upper_division', cc_articulable: false }),
      ],
    });
    expect(budget.university.total).toBe(60);
    expect(budget.transferred).toBe(60);
    expect(budget.transferred).toBeLessThan(budget.cap);
    expect(budget.binding).toBe('university_requirements');
  });

  it('reports what a college satisfies apart from what it carries', () => {
    // Satisfying every general education requirement does not mean carrying the
    // units: the work is done, the credit is capped.
    const degree = {
      total_units: 180,
      unit_system: 'quarter',
      requirement_groups: [
        group(120),
        group(60, { course_level: 'upper_division', cc_articulable: false }),
      ],
    };
    const full = computeTransferBudget(degree);
    expect(full.satisfied).toBe(120);
    expect(full.transferred).toBe(105);

    // A weaker college satisfies less and so carries less; nothing is capped.
    const partial = computeTransferBudget(degree, { satisfiedUnits: 60 });
    expect(partial.satisfied).toBe(60);
    expect(partial.transferred).toBe(60);
    expect(partial.binding).toBe('articulation');
    expect(partial.university.total).toBe(120);
  });

  it('never counts a college as satisfying more than the degree asks', () => {
    const budget = computeTransferBudget({
      total_units: 120, unit_system: 'semester',
      requirement_groups: [group(40), group(44, { course_level: 'upper_division' })],
    }, { satisfiedUnits: 999 });
    expect(budget.satisfied).toBe(40);
  });

  it('prices a choice on the cheapest block a college can actually supply', () => {
    // The cheaper alternative articulates nowhere, so it cannot set the floor.
    const budget = computeTransferBudget({
      total_units: 180, unit_system: 'quarter',
      requirement_groups: [{
        group_conjunction: 'Or',
        sections: [
          { unit_advisement: 19, articulation_reach: 0, receivers: [] },
          { unit_advisement: 23, articulation_reach: 102, receivers: [] },
        ],
      }],
    });
    expect(budget.requirements.transferable).toBe(23);
  });

  it('treats a lower-division course no college articulates as university work', () => {
    // MATH 31AL at UCLA: lower division, absent from ASSIST, so it can only be
    // taken after transferring even though it is not upper-division work.
    const budget = computeTransferBudget({
      total_units: 180, unit_system: 'quarter',
      requirement_groups: [
        group(24),
        group(5, { course_level: 'lower_division', cc_articulable: false }),
        group(60, { course_level: 'upper_division', cc_articulable: false }),
      ],
    });
    expect(budget.requirements.university).toBe(65);
    expect(budget.requirements.upper_division).toBe(60);
  });

  it('does not require the stated requirements to close at the total', () => {
    // Real degrees leave room for free electives; forcing closure is what
    // produced padding groups in the first place.
    const budget = computeTransferBudget({
      total_units: 120, unit_system: 'semester',
      requirement_groups: [group(40), group(44, { course_level: 'upper_division' })],
    });
    expect(budget.requirements.stated).toBe(84);
    expect(budget.within_total).toBe(true);
    expect(budget.university.unallocated).toBe(6);
  });

  it('counts an unmet campus upper-division floor as required university work', () => {
    const base = {
      total_units: 120, unit_system: 'semester',
      requirement_groups: [group(40), group(43, { course_level: 'upper_division' })],
    };
    // Merced Biology: 43 named upper-division units against a 44-unit floor, so
    // one more is required and it can only be earned on campus.
    const met = computeTransferBudget({ ...base, upper_division_minimum: { units: 44 } });
    expect(met.upper_division_shortfall).toBe(1);
    expect(met.university.required).toBe(44);

    const short = computeTransferBudget({ ...base, upper_division_minimum: { units: 60 } });
    expect(short.upper_division_shortfall).toBe(17);
    expect(short.university.required).toBe(60);

    // Irvine states no floor, so there is nothing to fall short of.
    expect(computeTransferBudget(base).upper_division_shortfall).toBe(null);
    expect(computeTransferBudget(base).university.required).toBe(43);
  });

  it('prefers the documented cap to the one the calendar implies', () => {
    const budget = computeTransferBudget({
      total_units: 120, unit_system: 'semester',
      transfer_unit_cap: { units: 60, source: 'https://example.edu' },
      requirement_groups: [group(100), group(20, { course_level: 'upper_division' })],
    });
    expect(budget.cap).toBe(60);
    expect(budget.transferred).toBe(60);
  });

  it('reads either vocabulary for work that cannot transfer', () => {
    // The same degree, said two ways. Biology and Economics mark university-only
    // work with course_level and cc_articulable; the computer-science documents
    // leave course_level unset throughout and say tier: 'nontransferable'.
    // Reading only the first reported every CS document as having no
    // university-side requirement at all, so the whole degree looked
    // transferable and the cap never engaged.
    const asCourseLevel = computeTransferBudget({
      total_units: 120, unit_system: 'semester',
      requirement_groups: [
        group(80),
        group(45, { course_level: 'upper_division', cc_articulable: false }),
      ],
    });
    const asTier = computeTransferBudget({
      total_units: 120,
      requirement_groups: [
        { ...group(80), tier: 'transferable' },
        { ...group(45), tier: 'nontransferable' },
      ],
    });
    expect(asTier.requirements.university).toBe(asCourseLevel.requirements.university);
    expect(asTier.transferred).toBe(asCourseLevel.transferred);
    expect(asTier.university.total).toBe(asCourseLevel.university.total);
  });

  it('infers the calendar from the unit total when unit_system is absent', () => {
    // Several documents never stored unit_system. Without the fallback the cap
    // vanished and a 120-unit degree reported all 120 units as transferable.
    expect(computeTransferBudget({
      total_units: 120,
      requirement_groups: [group(80), group(45, { tier: 'nontransferable' })],
    }).cap).toBe(70);
    expect(computeTransferBudget({
      total_units: 180,
      requirement_groups: [group(120), group(60, { tier: 'nontransferable' })],
    }).cap).toBe(105);
  });
});
