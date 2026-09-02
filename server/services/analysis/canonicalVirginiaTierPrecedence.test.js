import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const cjs = createRequire(import.meta.url);
const { compileDegreeComposition } = cjs('../virginia/degreeComposition');
const {
  computeUnitBudget,
  resolveSectionTier,
} = cjs('../degreeSlots');
const { canonicalSourceContract } = cjs('./canonicalSourceContract');
const { _evaluateTemplate: evaluateTemplate } = cjs('./transferCreditRate');
const { assemblePathway } = cjs('./pathwayComplexity');
const { stampDegreeCategories } = cjs('../../scripts/normalizeDegreeCategories');

const COMPOSED = path.resolve(__dirname, '../../.va-catalogs/composed');
const CASES = [
  {
    slug: 'university-of-mary-washington',
    legacy: { transferable: 0, breadth: 74, nontransferable: 46 },
    canonical: { transferable: 13, breadth: 74, nontransferable: 33 },
    sourceUpperMinimum: 33,
  },
  {
    slug: 'william-mary',
    legacy: { transferable: 11, breadth: 72, nontransferable: 37 },
    canonical: { transferable: 21, breadth: 72, nontransferable: 27 },
    sourceUpperMinimum: 27,
  },
];

function realProjection(slug) {
  const source = JSON.parse(fs.readFileSync(path.join(COMPOSED, `${slug}.json`), 'utf8'));
  const compiled = compileDegreeComposition(source, { institutionLevel: 'four_year' });
  const projected = {
    _id: `degree:${slug}`,
    kind: 'degree',
    state: 'va',
    unit_system: 'semester',
    total_units: source.total_units,
    analysis_contract: canonicalSourceContract(),
    requirement_groups: compiled.requirement_groups,
  };
  return {
    source,
    document: stampDegreeCategories(projected).doc,
  };
}

function oneLowerCourseFixture(slug) {
  const { document } = realProjection(slug);
  const sourceGroup = document.requirement_groups[0];
  const sourceSection = sourceGroup.sections.find((section) => (
    section.cc_articulable === true
      && section.course_level === 'lower_division'
      && section.receivers?.[0]?.receiving?.kind === 'course'
  ));
  const group = { ...sourceGroup, sections: [structuredClone(sourceSection)] };
  const template = { ...document, requirement_groups: [group] };
  const receiver = group.sections[0].receivers[0];
  const parentId = Number(receiver.receiving.parent_id);
  const sendingId = 99001;
  const units = Number(group.sections[0].unit_advisement);
  const agreements = [{
    requirement_groups: [{
      sections: [{
        receivers: [{
          receiving: { kind: 'course', parent_id: parentId },
          articulation_status: 'articulated',
          options: [{ course_ids: [sendingId], course_conjunction: 'and' }],
        }],
      }],
    }],
  }];
  return {
    template,
    group,
    section: group.sections[0],
    receiver,
    parentId,
    sendingId,
    units,
    agreements,
  };
}

function everyConcreteReceiverFixture(template) {
  let sendingId = 99100;
  const sendingUnits = new Map();
  const planIds = new Set();
  const agreementReceivers = [];
  for (const group of template.requirement_groups) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        const receiving = receiver.receiving || {};
        const parentIds = receiving.kind === 'series'
          ? receiving.parent_ids || []
          : receiving.kind === 'course' ? [receiving.parent_id] : [];
        if (!parentIds.length) continue;
        sendingId += 1;
        planIds.add(sendingId);
        sendingUnits.set(sendingId, Number(section.unit_advisement));
        agreementReceivers.push({
          receiving: structuredClone(receiving),
          articulation_status: 'articulated',
          options: [{ course_ids: [sendingId], course_conjunction: 'and' }],
        });
      }
    }
  }
  return {
    agreements: [{
      requirement_groups: [{ sections: [{ receivers: agreementReceivers }] }],
    }],
    planIds,
    sendingUnits,
  };
}

describe('canonical Virginia section-tier precedence', () => {
  it.each(CASES)(
    'reconciles the real $slug projection without moving its 120-credit total',
    ({ slug, legacy, canonical, sourceUpperMinimum }) => {
      const { source, document } = realProjection(slug);
      const oldBudget = computeUnitBudget(document.requirement_groups);
      const newBudget = computeUnitBudget(document.requirement_groups, {
        sourceDocument: document,
      });

      expect(oldBudget).toMatchObject({ modeled_units: 120, per_tier: legacy });
      expect(newBudget).toMatchObject({ modeled_units: 120, per_tier: canonical });
      expect(newBudget.per_tier.nontransferable).toBe(sourceUpperMinimum);
      expect(newBudget.per_tier.nontransferable)
        .toBe(source.unit_audit.major_scoped_upper_division_units_minimum);
    },
  );

  it.each(CASES)(
    'proves the real $slug source explicitly refines its mixed major carrier',
    ({ slug }) => {
      const { source, document } = realProjection(slug);
      const sourceMajor = source.requirement_groups[0];
      const projectedMajor = document.requirement_groups[0];
      expect(sourceMajor).toMatchObject({
        course_level: 'mixed',
        cc_articulable: false,
      });

      const refiningIndices = sourceMajor.sections
        .map((section, index) => ({ section, index }))
        .filter(({ section }) => section.cc_articulable === true);
      expect(refiningIndices.length).toBeGreaterThan(0);
      for (const { section, index } of refiningIndices) {
        expect(Object.hasOwn(section, 'cc_articulable')).toBe(true);
        expect(Object.hasOwn(section, 'course_level')).toBe(true);
        expect(projectedMajor.sections[index]).toMatchObject({
          cc_articulable: true,
          course_level: section.course_level,
        });
        expect(projectedMajor.sections[index].category).toBe('lower-division');
      }
    },
  );

  it('requires Virginia state, the complete contract, and a mixed group', () => {
    const { document } = realProjection('university-of-mary-washington');
    const group = document.requirement_groups[0];
    const section = group.sections[0];
    expect(resolveSectionTier(group, section, document)).toBe('transferable');

    expect(resolveSectionTier(group, section)).toBe('nontransferable');
    expect(resolveSectionTier(group, section, { ...document, state: 'ca' }))
      .toBe('nontransferable');
    expect(resolveSectionTier(group, section, { ...document, analysis_contract: null }))
      .toBe('nontransferable');
    expect(resolveSectionTier(
      { ...group, course_level: 'upper_division' }, section, document,
    )).toBe('nontransferable');
  });

  it('fails definite non-articulable or upper section facts closed', () => {
    const { document } = realProjection('william-mary');
    const group = document.requirement_groups[0];
    const lower = group.sections[0];
    expect(resolveSectionTier(group, {
      ...lower,
      course_level: 'lower_division',
      cc_articulable: false,
      tier: 'transferable',
    }, document)).toBe('nontransferable');
    expect(resolveSectionTier(group, {
      ...lower,
      course_level: 'upper_division',
      cc_articulable: true,
      tier: 'transferable',
    }, document)).toBe('nontransferable');
    expect(resolveSectionTier(group, {
      ...lower,
      course_level: 'mixed',
      cc_articulable: true,
      tier: 'breadth',
    }, document)).toBe('breadth');
  });

  it.each(CASES)(
    'returns a real $slug lower section to university-only when its proof fact mutates',
    ({ slug, canonical }) => {
      const { document } = realProjection(slug);
      const mutated = structuredClone(document);
      const section = mutated.requirement_groups[0].sections.find((candidate) => (
        candidate.cc_articulable === true && candidate.course_level === 'lower_division'
      ));
      const units = Number(section.unit_advisement);
      section.cc_articulable = false;
      const budget = computeUnitBudget(mutated.requirement_groups, { sourceDocument: mutated });
      expect(budget.per_tier.transferable).toBe(canonical.transferable - units);
      expect(budget.per_tier.nontransferable).toBe(canonical.nontransferable + units);
      expect(budget.modeled_units).toBe(120);
    },
  );
});

describe('canonical Virginia tier precedence at figure runtimes', () => {
  it.each([
    ['university-of-mary-washington', 0, 13],
    ['william-mary', 11, 21],
  ])(
    'moves exactly the real %s lower-demand budget into the Figures 3/4 allocator',
    (slug, legacyUnits, canonicalUnits) => {
      const { document } = realProjection(slug);
      const fixture = everyConcreteReceiverFixture(document);
      const evaluate = (template) => evaluateTemplate(
        template,
        fixture.agreements,
        fixture.planIds,
        fixture.sendingUnits,
        'semester',
        'semester',
        true,
      );
      expect(evaluate(document).directAppliedUnits).toBe(canonicalUnits);
      expect(evaluate({ ...document, state: undefined }).directAppliedUnits).toBe(legacyUnits);
    },
  );

  it.each(CASES)(
    'makes a real $slug lower articulation reachable to Figures 3/4 only in canonical VA',
    ({ slug }) => {
      const fixture = oneLowerCourseFixture(slug);
      const evaluate = (template) => evaluateTemplate(
        template,
        fixture.agreements,
        new Set([fixture.sendingId]),
        new Map([[fixture.sendingId, fixture.units]]),
        'semester',
        'semester',
        true,
      );

      expect(evaluate(fixture.template)).toMatchObject({
        directAppliedUnits: fixture.units,
        lowerDirectAppliedUnits: fixture.units,
        requirementRoleIssues: [],
      });
      expect(evaluate({ ...fixture.template, state: undefined })).toMatchObject({
        directAppliedUnits: 0,
        lowerDirectAppliedUnits: 0,
      });

      const mutated = structuredClone(fixture.template);
      mutated.requirement_groups[0].sections[0].course_level = 'upper_division';
      expect(evaluate(mutated)).toMatchObject({
        directAppliedUnits: 0,
        lowerDirectAppliedUnits: 0,
      });
    },
  );

  it.each(CASES)(
    'consumes a real $slug lower requirement in Figure 6 only in canonical VA',
    ({ slug }) => {
      const fixture = oneLowerCourseFixture(slug);
      const courseCode = fixture.receiver.code_seen;
      const pathway = (degree) => assemblePathway({
        degree,
        asIds: [fixture.sendingId],
        asSlots: 0,
        asSlotUnits: 0,
        agreementByParent: new Map([[
          fixture.parentId,
          { options: [[fixture.sendingId]], parentIds: [fixture.parentId] },
        ]]),
        ucCatalog: new Map([[
          courseCode,
          { id: `uc:${fixture.parentId}`, units: fixture.units },
        ]]),
        ucCodeByParent: new Map([[fixture.parentId, courseCode]]),
        ccUnits: new Map([[fixture.sendingId, fixture.units]]),
        normalizeCatalogCode: (value) => value,
      });

      const canonical = pathway(fixture.template);
      expect(canonical.consumed).toBe(1);
      expect([...canonical.vertices.keys()]).toEqual([`cc:${fixture.sendingId}`]);

      const unstampedLegacy = structuredClone({ ...fixture.template, state: undefined });
      for (const group of unstampedLegacy.requirement_groups) {
        delete group.category;
        for (const section of group.sections || []) delete section.category;
      }
      const legacy = pathway(stampDegreeCategories(unstampedLegacy).doc);
      expect(legacy.consumed).toBe(0);
      expect([...legacy.vertices.keys()].sort()).toEqual([
        `cc:${fixture.sendingId}`,
        `uc:${fixture.parentId}`,
      ]);
    },
  );
});
