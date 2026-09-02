import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { canonicalSourceContract } from './canonicalSourceContract';
import {
  associateNamedSections,
  planAssociateDegree,
} from './transferCreditRate';
import {
  associateConstraintContextIssues,
  categoryForCourse,
  hasAssociateConstraintEvaluator,
  resolveAssociateConstraint,
} from './transferCreditConstraints';
import { validateDegreeAcceptance } from '../virginia/degreeAcceptance';
import { compileDegreeComposition } from '../virginia/degreeComposition';

const require = createRequire(import.meta.url);
const REAL_COMPOSITIONS = [
  ['central', require('../../.va-catalogs/composed/central-virginia-community-college.json')],
  ['germanna', require('../../.va-catalogs/composed/germanna-community-college.json')],
  ['virginia_peninsula', require('../../.va-catalogs/composed/virginia-peninsula-community-college.json')],
];

const CATEGORY_KINDS = new Set(['distinct_ge_areas', 'distinct_categories_across_sections']);

function categoryOwner(doc) {
  for (const group of doc.requirement_groups || []) {
    const constraint = (group.analysis_constraints || [])
      .find((row) => CATEGORY_KINDS.has(row?.kind));
    if (constraint) return { owner: group, constraint };
  }
  throw new Error('fixture has no category-distinct owner');
}

function allSourceRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (Array.isArray(value)) {
    value.forEach((entry) => allSourceRefs(entry, refs));
    return refs;
  }
  (value.source_refs || []).forEach((ref) => refs.add(ref));
  Object.values(value).forEach((entry) => allSourceRefs(entry, refs));
  return refs;
}

function sourceShape(raw, name = 'fixture') {
  const compiled = compileDegreeComposition(raw, {
    institutionLevel: 'community_college',
    courseNamespace: raw.course_namespace ?? null,
  });
  const doc = structuredClone({ ...raw, ...compiled });
  const refs = [...allSourceRefs(doc)].sort();
  doc._id = `va:as:${name}:cs`;
  doc.kind = 'as_degree';
  doc.status = 'extracted';
  doc.source = 'institution_catalog';
  doc.source_method = 'official_catalog_composition';
  doc.degree_title_seen = doc.program || 'Associate of Science: Computer Science';
  doc.unit_system = 'semester';
  doc.catalog_url = `https://catalog.example.edu/${name}/program`;
  doc.source_url = doc.catalog_url;
  doc.sources = refs.map((id, index) => ({
    id,
    role: index === 0 ? 'program' : 'supporting',
    kind: index === 0 ? 'major' : 'catalog',
    label: `${id} official source`,
    url: index === 0 ? doc.catalog_url : `https://catalog.example.edu/${name}/${id}`,
    official: true,
    secure: true,
  }));
  doc.verification = { verified: true, stale: false };
  doc.provenance = { source_bundle_hash: `fixture-${name}` };
  doc.analysis_contract = canonicalSourceContract();
  return doc;
}

function verifiedCurrentShape(raw, name) {
  const doc = sourceShape(raw, name);
  const { constraint } = categoryOwner(doc);
  delete constraint.category_subjects;
  delete constraint.minimum_distinct_categories;
  return doc;
}

function routeEntries(owner) {
  return (owner.sections || []).flatMap((section) => (
    (section.receivers || []).flatMap((receiver) => receiver.options || [])
  ));
}

function exactCategoryOptionSet(doc, owner) {
  const routeCodes = [...new Set(routeEntries(owner).flatMap((option) => (
    option.course_keys || []
  )).map((key) => key.split(':').at(-1)))].sort();
  return Object.entries(doc.option_sets).find(([, optionSet]) => {
    if (!optionSet.categories) return false;
    const codes = [...new Set(Object.values(optionSet.categories).flat())].sort();
    return JSON.stringify(codes) === JSON.stringify(routeCodes);
  });
}

describe('source-backed associate category evidence', () => {
  it.each(REAL_COMPOSITIONS)(
    'derives the current verified %s shape and is equivalent to candidate metadata',
    (name, raw) => {
      const candidate = sourceShape(raw, `${name}-candidate`);
      const current = verifiedCurrentShape(raw, `${name}-current`);
      const { owner, constraint } = categoryOwner(current);
      const candidateConstraint = categoryOwner(candidate).constraint;
      const resolution = resolveAssociateConstraint(constraint, { owner, doc: current });

      expect(resolution).toMatchObject({
        issues: [],
        constraint: {
          minimum_distinct_categories: 2,
          category_evidence: {
            kind: 'source_option_set_categories',
            course_count: expect.any(Number),
            category_count: 3,
          },
        },
      });
      expect(resolution.constraint.category_evidence.course_count).toBeGreaterThan(10);
      expect(hasAssociateConstraintEvaluator(constraint, { owner, doc: current })).toBe(true);
      expect(associateConstraintContextIssues(constraint, owner, current)).toEqual([]);

      for (const option of routeEntries(owner)) {
        for (const key of option.course_keys || []) {
          expect(categoryForCourse(resolution.constraint, key))
            .toBe(categoryForCourse(candidateConstraint, key));
        }
      }

      const acceptance = validateDegreeAcceptance(current, {
        institutionLevel: 'community_college',
        resolveCourse: () => true,
      });
      expect(acceptance.analysis_ready.checks.find((check) => (
        check.name === 'constraint_support'
      ))).toMatchObject({ severity: 'pass' });
    },
  );

  it('threads derived categories into the strict planner without changing candidate results', () => {
    const raw = REAL_COMPOSITIONS[0][1];
    const current = verifiedCurrentShape(raw, 'central-current-plan');
    const candidate = sourceShape(raw, 'central-candidate-plan');
    current.requirement_groups = [categoryOwner(current).owner];
    candidate.requirement_groups = [categoryOwner(candidate).owner];
    current.total_units = 6;
    current.total_units_max = 6;
    candidate.total_units = 6;
    candidate.total_units_max = 6;

    const currentSections = associateNamedSections(current);
    const candidateSections = associateNamedSections(candidate);
    const options = routeEntries(current.requirement_groups[0]);
    const ids = [...new Set(options.flatMap((option) => option.course_ids || []))];
    const units = new Map(ids.map((id) => [id, 3]));
    const generallyTransferable = new Set(ids);
    const artIds = Object.values(current.option_sets)
      .find((optionSet) => optionSet.categories)?.categories.art
      .slice(0, 2)
      .map((code) => options.find((option) => (
        option.course_keys?.some((key) => key.endsWith(`:${code}`))
      )).course_ids[0]);
    const directlyEligible = new Set(artIds);
    const plannerOptions = {
      strictConstraints: true,
      totalUnits: 6,
      totalUnitsMax: 6,
      aggregateUnits: 0,
      hasUnitsFill: false,
    };

    const currentPlan = planAssociateDegree(
      currentSections, directlyEligible, generallyTransferable, units, plannerOptions,
    );
    const candidatePlan = planAssociateDegree(
      candidateSections, directlyEligible, generallyTransferable, units, plannerOptions,
    );
    expect(currentPlan).toEqual(candidatePlan);
    expect(currentPlan).toMatchObject({ complete: true, total: 6, transferred: 3 });
  });

  it('accepts multiple byte-identical exact mappings but rejects ambiguous mappings', () => {
    const doc = verifiedCurrentShape(REAL_COMPOSITIONS[0][1], 'central-duplicates');
    const { owner, constraint } = categoryOwner(doc);
    const [name, optionSet] = exactCategoryOptionSet(doc, owner);
    doc.option_sets[`${name}_identical`] = structuredClone(optionSet);
    expect(resolveAssociateConstraint(constraint, { owner, doc })).toMatchObject({
      issues: [],
      evidence: { option_set_names: [name, `${name}_identical`] },
    });

    const conflicting = structuredClone(optionSet);
    const moved = conflicting.categories.art.pop();
    conflicting.categories.humanities.push(moved);
    doc.option_sets[`${name}_conflicting`] = conflicting;
    expect(resolveAssociateConstraint(constraint, { owner, doc }).issues)
      .toContain('multiple exact option-set category mappings disagree');

    const reordered = verifiedCurrentShape(REAL_COMPOSITIONS[0][1], 'central-reordered');
    const reorderedOwner = categoryOwner(reordered);
    const [reorderedName, reorderedSet] = exactCategoryOptionSet(
      reordered, reorderedOwner.owner,
    );
    const sameMembershipDifferentBytes = structuredClone(reorderedSet);
    sameMembershipDifferentBytes.categories.art.reverse();
    reordered.option_sets[`${reorderedName}_reordered`] = sameMembershipDifferentBytes;
    expect(resolveAssociateConstraint(reorderedOwner.constraint, {
      owner: reorderedOwner.owner, doc: reordered,
    }).issues).toContain('multiple exact option-set category mappings disagree');
  });

  it.each([
    ['duplicate membership', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      optionSet.categories.humanities.push(optionSet.categories.art[0]);
    }, /duplicate course membership/],
    ['missing course', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      optionSet.categories.art.pop();
    }, /union exactly equals/],
    ['extra course', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      optionSet.categories.art.push('ZZZ999');
    }, /union exactly equals/],
    ['unresolved option-set source', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      optionSet.source_refs = ['missing_source'];
    }, /unresolved or non-overlapping source_refs/],
    ['resolved but non-overlapping option-set source', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      doc.sources.push({ id: 'other_official_source' });
      optionSet.source_refs = ['other_official_source'];
    }, /unresolved or non-overlapping source_refs/],
    ['unresolved owner source', (_doc, owner) => {
      owner.sections[0].source_refs.push('missing_source');
    }, /owner has missing or unresolved source_refs/],
    ['contradictory source rule', (doc, owner) => {
      const [, optionSet] = exactCategoryOptionSet(doc, owner);
      optionSet.rule = 'Choose one course from any category.';
    }, /does not establish a machine-readable distinct-category minimum/],
    ['cross-category AND bundle', (_doc, owner) => {
      const options = routeEntries(owner);
      const art = options.find((option) => option.course_keys?.includes('va:ART100'));
      const humanities = options.find((option) => option.course_keys?.includes('va:HUM256'));
      art.course_keys.push(humanities.course_keys[0]);
      art.course_ids.push(humanities.course_ids[0]);
      art.course_conjunction = 'and';
    }, /AND option bundle spans/],
  ])('fails closed on %s', (_label, mutate, expected) => {
    const doc = verifiedCurrentShape(REAL_COMPOSITIONS[0][1], `negative-${_label}`);
    const { owner, constraint } = categoryOwner(doc);
    mutate(doc, owner);
    expect(resolveAssociateConstraint(constraint, { owner, doc }).issues.join(' '))
      .toMatch(expected);
  });

  it('does not infer a two-category minimum from prose or a single six-credit slot', () => {
    const blueRidge = verifiedCurrentShape(
      require('../../.va-catalogs/composed/blue-ridge-community-college.json'),
      'blue-ridge-current',
    );
    const { owner, constraint } = categoryOwner(blueRidge);
    owner.sections = [owner.sections[0]];
    owner.sections[0].unit_advisement = 6;
    owner.sections[0].unit_advisement_max = 6;
    expect(owner.sections).toHaveLength(1);
    expect(owner.sections[0]).toMatchObject({ section_advisement: 1, unit_advisement: 6 });
    expect(resolveAssociateConstraint(constraint, { owner, doc: blueRidge }).issues)
      .toContain('exact option-set evidence does not establish a machine-readable distinct-category minimum');
  });
});
