import { describe, expect, it } from 'vitest';
import {
  _evaluateTemplate,
  associateNamedSections,
  auditVirginiaProjectionEquivalencyConditions,
  planAssociateDegree,
  sourceSpecificUnitsById,
} from './transferCreditRate';
import {
  ASSOCIATE_MATRIX,
  baseSciencePairContext,
  radfordAssociateSciencePairCarrier,
  radfordSciencePairRuntimeContext,
  sourceEquivalenciesSha256,
} from './radfordSciencePairConstraint';
import { SCIENCE_FACTS } from './radfordSciencePairEvidence';
import radfordEvidence from '../../.va-catalogs/research/radford-science-pair-evidence.json';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { northernVirginiaFigure34Aggregates } from './associateCollegeConstraintProofs';

function scienceSupplies() {
  const incoming = new Map(radfordEvidence.courses.map((course) => [
    course.sending_code, course.equivalency,
  ]));
  return SCIENCE_FACTS.map((fact) => ({
    course_id: fact.sending_course_id,
    course_key: `va:${fact.sending_code}`,
    code: fact.sending_code,
    title: fact.sending_code,
    credits: fact.sending_credits,
    source_url: incoming.get(fact.sending_code).source.requested_url,
    offered_by: Object.values(ASSOCIATE_MATRIX)
      .filter((row) => row.pair?.includes(fact.sending_code))
      .map((row) => row.name),
    articulates_to: [{
      institution: 'Radford University',
      identifier: fact.receiving_code,
      name: incoming.get(fact.sending_code).receiving_name,
      notes: incoming.get(fact.sending_code).receiving_notes,
    }],
  }));
}

function finalDocuments(supplies = scienceSupplies()) {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document.institution_id === 'va:uni:radford-university'
  ));
  const asDegrees = plan.documents.filter((document) => (
    document.kind === 'as_degree' && document.status === 'extracted'
  ));
  const activeSlugs = new Set(asDegrees.map((document) => (
    document._id.replace(/^va:as:/, '').replace(/:cs$/, '')
  )));
  const institutions = VA_INSTITUTION_REGISTRY.filter((row) => (
    row.id === 9219 || (row.level === 'community_college' && activeSlugs.has(row.slug))
  )).map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level, name: row.name,
  }));
  const projection = buildProjection({
    courses: supplies, degrees: [degree], asDegrees, institutions,
  });
  return {
    bachelor: projection.degrees.find((document) => document.school_id === 9219),
    associates: projection.asDegrees,
    agreements: projection.agreements,
    courses: projection.courses,
  };
}

function idsInSections(sections) {
  return new Set(sections.flatMap((section) => (
    (section.receivers || []).flatMap((receiver) => (
      (receiver.options || []).flatMap((option) => option.course_ids || [])
    ))
  )).map(Number));
}

function aggregateFigure34Units(document) {
  const nova = northernVirginiaFigure34Aggregates(document);
  const exactNova = new Map(nova?.ready
    ? nova.groups.map((row) => [row.group, row.units]) : []);
  const generalEducation = /general\s*education|\bgen(?:eral)?[\s.]*ed\b/i;
  let units = 0;
  for (const group of document.requirement_groups || []) {
    if (group.units_fill) continue;
    if (exactNova.has(group)) {
      units += exactNova.get(group);
      continue;
    }
    const named = (group.sections || []).some((section) => (
      (section.receivers || []).some((receiver) => (
        (receiver.options || []).some((option) => option.course_ids?.length)
      ))
    ));
    if (named) continue;
    if (!group.ge_area && !generalEducation.test(group.label_seen || '')) continue;
    const stated = Number(group.sections?.[0]?.unit_advisement);
    units += Number.isFinite(stated) && stated > 0 ? stated : 18;
  }
  return units;
}

describe('Radford exact science-pair allocation', () => {
  it('includes college-specific Radford pair proof in the publication cell audit', () => {
    const {
      bachelor, associates, agreements, courses,
    } = finalDocuments();
    const audit = auditVirginiaProjectionEquivalencyConditions({
      asDegrees: associates,
      degrees: [bachelor],
      agreements,
      courses,
    }, {
      expectedAssociateDegrees: 19,
      expectedBachelorDegrees: 1,
      expectedCells: 19,
    });
    expect(audit.counts).toMatchObject({
      cells: 19,
      ready_cells: 18,
      blocked_cells: 1,
      invalid_channel_cells: 0,
    });
    expect(audit.blocked_cells.every((cell) => (
      cell.blocking_conditions.some((condition) => (
        condition.condition_kind === 'radford_two_sciences_one_laboratory'
      ))
    ))).toBe(true);
    expect(audit.blocked_cells.map((cell) => cell.college_name))
      .toEqual(['Southwest Virginia Community College']);
  });

  it('applies eight named credits and reduces open capacity from 35 to 33', () => {
    const { bachelor, associates, agreements } = finalDocuments();
    const associate = associates.find((document) => document.community_college_id === 9301);
    const context = baseSciencePairContext(bachelor, associate);
    const agreement = agreements.find((row) => (
      row.uc_school_id === 9219 && row.community_college_id === 9301
    ));
    expect(agreement.source_equivalencies).toEqual(expect.arrayContaining(
      context.pair.map((fact) => ({
        sending_course_id: fact.sending_course_id,
        sending_course_key: `va:${fact.sending_code}`,
        sending_code: fact.sending_code,
        receiving_identifier: fact.receiving_code,
        receiving_name: fact.receiving_name,
        receiving_notes: fact.receiving_notes,
        receiving_parent_id: fact.receiving_parent_id,
        sending_source_url: fact.sending_source_url,
      })),
    ));
    const namedReceivingIds = agreement.requirement_groups.flatMap((group) => (
      group.sections.flatMap((section) => section.receivers.flatMap((receiver) => (
        receiver.receiving?.parent_id == null ? [] : [receiver.receiving.parent_id]
      )))
    ));
    expect(namedReceivingIds).not.toEqual(expect.arrayContaining(context.receiving_ids));
    const units = new Map(context.pair.map((fact) => [
      fact.sending_course_id, fact.sending_credits,
    ]));
    const evaluated = _evaluateTemplate(
      bachelor,
      [agreement],
      new Set(context.pair_ids),
      units,
      'semester',
      'semester',
      true,
      { associateDocument: associate },
    );
    expect(evaluated.sourceBoundApplicationIssues).toEqual([]);
    expect(evaluated).toMatchObject({
      directAppliedUnits: 8,
      lowerDirectAppliedUnits: 8,
      electiveCampusUnits: 33,
      lowerElectiveCampusUnits: 33,
      sourceBoundRadfordSciencePair: {
        sending_codes: ['CHM111', 'CHM112'],
        receiving_codes: ['CHEM111', 'CHEM112'],
        sending_units: 8,
        receiving_units: 8,
        free_elective_displacement: 2,
        remaining_free_elective_units: 33,
      },
    });
    expect([...evaluated.directIds].sort((left, right) => left - right))
      .toEqual([...context.pair_ids].sort((left, right) => left - right));
  });

  it('fails closed for an incomplete pair, a missing edge, or an unsupported sender', () => {
    const { bachelor, associates, agreements } = finalDocuments();
    const associate = associates.find((document) => document.community_college_id === 9301);
    const context = baseSciencePairContext(bachelor, associate);
    const agreement = agreements.find((row) => (
      row.uc_school_id === 9219 && row.community_college_id === 9301
    ));
    const units = new Map(context.pair.map((fact) => [
      fact.sending_course_id, fact.sending_credits,
    ]));
    const oneCourse = _evaluateTemplate(
      bachelor, [agreement], new Set([context.pair_ids[0]]), units,
      'semester', 'semester', true, { associateDocument: associate },
    );
    expect(oneCourse.sourceBoundApplicationIssues).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/source-tree identity/) }),
    ]);
    const contradictoryAgreement = structuredClone(agreement);
    contradictoryAgreement.source_equivalencies.find((row) => (
      row.sending_course_id === context.pair_ids[1]
    )).receiving_parent_id = courseIdFor('BIO101');
    contradictoryAgreement.source_equivalencies_sha256 = sourceEquivalenciesSha256(
      contradictoryAgreement.source_equivalencies,
    );
    const contradictoryEdge = _evaluateTemplate(
      bachelor, [contradictoryAgreement], new Set(context.pair_ids), units,
      'semester', 'semester', true, { associateDocument: associate },
    );
    expect(contradictoryEdge.sourceBoundApplicationIssues).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/identity contract/) }),
    ]);
    const blockedAssociate = associates.find((document) => (
      document.community_college_id === 9319
    ));
    const blocked = _evaluateTemplate(
      bachelor, agreements.filter((row) => row.community_college_id === 9319),
      new Set(), new Map(), 'semester', 'semester', true,
      { associateDocument: blockedAssociate },
    );
    expect(blocked.sourceBoundApplicationIssues).toEqual([
      expect.objectContaining({ reason: expect.stringMatching(/only one named eligible science course/) }),
    ]);
  });

  it('makes the complete pair an atomic terminal condition in the strict plan', () => {
    const first = courseIdFor('CHM111');
    const second = courseIdFor('CHM112');
    const alternatives = [courseIdFor('BIO101'), courseIdFor('BIO102')];
    const section = (ids, index) => ({
      groupIndex: index,
      groupConjunction: 'And',
      groupLabel: `science ${index + 1}`,
      section_advisement: 1,
      unit_advisement: 4,
      unit_advisement_max: 4,
      analysisConstraints: [],
      receivers: [{
        options_conjunction: 'or',
        options: ids.map((id) => ({ course_ids: [id], course_conjunction: 'and' })),
      }],
    });
    const sections = [section([first, alternatives[0]], 0), section([second, alternatives[1]], 1)];
    const units = new Map([first, second, ...alternatives].map((id) => [id, 4]));
    const all = new Set(units.keys());
    const common = {
      strictConstraints: true,
      totalUnits: 8,
      totalUnitsMax: 8,
      sourceBoundRequiredAnyIdSets: [[first, second]],
    };
    expect(planAssociateDegree(sections, all, all, units, common)).toMatchObject({
      complete: true, ids: [second, first].sort((left, right) => left - right),
    });
    // A source tree that loses the second pair identity cannot be rescued by
    // selecting another generally transferable four-credit science.
    const missingSections = [
      sections[0], section([alternatives[1]], 1),
    ];
    const missing = planAssociateDegree(
      missingSections,
      all,
      all,
      units,
      common,
    );
    expect(missing).toMatchObject({ complete: false });
  });

  it('selects every pair backed by its exact retained college-specific receipts', () => {
    const {
      bachelor, associates, agreements, courses,
    } = finalDocuments();
    const defaultUnits = new Map(courses.map((course) => [
      Number(course.course_id), Number(course.units) || 0,
    ]));
    const courseRows = new Map(courses.map((course) => [Number(course.course_id), course]));
    const matrix = [];
    for (const associate of associates) {
      const context = baseSciencePairContext(bachelor, associate);
      if (!context.ready) continue;
      const agreement = agreements.filter((row) => (
        row.uc_school_id === 9219
          && row.community_college_id === associate.community_college_id
      ));
      const carrier = radfordAssociateSciencePairCarrier(associate);
      const sections = [
        ...associateNamedSections(associate, { paperFigure: '3_4' }),
        ...carrier.runtime_sections,
      ];
      const courseSet = idsInSections(sections);
      const units = sourceSpecificUnitsById(defaultUnits, courseRows, associate);
      const runtime = baseSciencePairContext(bachelor, associate);
      for (const id of runtime.pair_ids) courseSet.add(id);
      const directlyEligible = new Set(agreement.flatMap((row) => (
        row.requirement_groups.flatMap((group) => group.sections.flatMap((section) => (
          section.receivers.flatMap((receiver) => (
            receiver.options.flatMap((option) => option.course_ids || [])
          ))
        )))
      )).map(Number).filter((id) => courseSet.has(id)));
      runtime.pair_ids.forEach((id) => directlyEligible.add(id));
      const exactRuntime = radfordSciencePairRuntimeContext(
        bachelor, associate, {
          degreeCourseSet: courseSet, unitsById: units, agreements: agreement,
        },
      );
      const plan = planAssociateDegree(
        sections,
        directlyEligible,
        courseSet,
        units,
        {
          strictConstraints: true,
          paperFigure: '3_4',
          sourceDocument: associate,
          totalUnits: associate.total_units,
          totalUnitsMax: associate.total_units_max ?? associate.total_units,
          aggregateUnits: aggregateFigure34Units(associate)
            - carrier.aggregate_units_replaced,
          hasUnitsFill: associate.requirement_groups.some((group) => group.units_fill === true),
          sourceBoundRequiredAnyIdSets: exactRuntime.ready
            ? exactRuntime.source_bound_required_any_id_sets : [],
        },
      );
      matrix.push({
        college: associate.college_name,
        runtime: exactRuntime.ready,
        complete: plan.complete,
        pairSelected: context.pair_ids.every((id) => plan.ids.includes(id)),
      });
    }
    expect(matrix).toHaveLength(18);
    expect(matrix.map((row) => row.college)).toEqual(expect.arrayContaining([
      'Blue Ridge Community College',
      'Brightpoint Community College',
      'J Sargeant Reynolds Community College',
      'Mountain Gateway Community College',
      'Paul D. Camp Community College',
      'Richard Bland College',
      'Wytheville Community College',
    ]));
    expect(matrix).toEqual(matrix.map((row) => ({
      ...row, runtime: true, complete: true, pairSelected: true,
    })));
  });

  it('fails closed when the raw supply loses, duplicates, or misidentifies an exact edge', () => {
    const assertBlocked = (mutate, reason) => {
      const supplies = structuredClone(scienceSupplies());
      mutate(supplies);
      const {
        bachelor, associates, agreements,
      } = finalDocuments(supplies);
      const associate = associates.find((row) => row.community_college_id === 9301);
      const base = baseSciencePairContext(bachelor, associate);
      const agreement = agreements.filter((row) => (
        row.uc_school_id === 9219 && row.community_college_id === 9301
      ));
      const result = radfordSciencePairRuntimeContext(bachelor, associate, {
        degreeCourseSet: new Set(base.pair_ids),
        unitsById: new Map(base.pair.map((fact) => [
          fact.sending_course_id, fact.sending_credits,
        ])),
        agreements: agreement,
      });
      expect(result, reason).toMatchObject({
        ready: false, reason: expect.stringMatching(reason),
      });
    };

    assertBlocked((supplies) => {
      supplies.find((row) => row.code === 'CHM112').articulates_to = [];
    }, /exact CHM112 to CHEM112/);
    assertBlocked((supplies) => {
      supplies.find((row) => row.code === 'CHM112')
        .articulates_to[0].parent_id = courseIdFor('BIO101');
    }, /exact CHM112 to CHEM112/);
    assertBlocked((supplies) => {
      const row = supplies.find((entry) => entry.code === 'CHM112');
      row.articulates_to.push(structuredClone(row.articulates_to[0]));
    }, /duplicate edges/);
    assertBlocked((supplies) => {
      supplies.find((row) => row.code === 'CHM112')
        .articulates_to[0].notes = 'Conditional: department approval required';
    }, /exact CHM112 to CHEM112/);
    assertBlocked((supplies) => {
      delete supplies.find((row) => row.code === 'CHM112').articulates_to[0].notes;
    }, /exact CHM112 to CHEM112/);
    assertBlocked((supplies) => {
      supplies.find((row) => row.code === 'CHM112').source_url =
        'https://www.transfervirginia.org/course/DEADBEEF';
    }, /exact CHM112 to CHEM112/);

    const generic = structuredClone(scienceSupplies());
    generic.find((row) => row.code === 'CHM111').articulates_to.push({
      institution: 'Radford University', identifier: 'CHEM2XX', name: 'Chemistry elective',
    });
    const agreement = finalDocuments(generic).agreements.find((row) => (
      row.uc_school_id === 9219 && row.community_college_id === 9301
    ));
    expect(agreement.source_equivalencies.some((row) => (
      row.receiving_identifier === 'CHEM2XX'
    ))).toBe(false);
  });
});
