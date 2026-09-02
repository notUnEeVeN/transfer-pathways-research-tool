import { describe, expect, it } from 'vitest';
import {
  _applyAssociateUnits,
  _evaluateTemplate,
  _sourceBoundTransferCapUnits,
  associateNamedSections,
  planAssociateDegree,
} from './transferCreditRate';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { courseIdFor } from '../virginia/courseIdentity';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import {
  VIRGINIA_TECH_CSC_PAIR_IDS,
  VIRGINIA_TECH_CSC_PAIR_NOTE,
} from './virginiaTechAtomicArticulation';
import {
  auditVirginiaSourceEquivalencyConditions,
} from './virginiaTransferEquivalencyConditions';

const SLUG = 'virginia-polytechnic-institute-and-state-university';

function finalProjection() {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const institutions = [college, university].map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  const supply = {
    course_id: courseIdFor('CSC299'),
    course_key: 'va:CSC299',
    code: 'CSC299',
    title: 'Virginia Tech transfer-credit allocator witness',
    credits: 3,
    offered_by: [college.name],
    articulates_to: [{ institution: university.name, identifier: 'NO_MATCH_299' }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === 9230);
}

function atomicPairProjection({ coursesMutator = null } = {}) {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9307);
  const pairCourse = (code) => ({
    course_id: courseIdFor(code),
    course_key: `va:${code}`,
    code,
    credits: 3,
    source_url: code === 'CSC205'
      ? 'https://www.transfervirginia.org/course/D37A690E1F9411F082AC0242AC15010A'
      : 'https://www.transfervirginia.org/course/D37A6A2A1F9411F082AC0242AC15010A',
    offered_by: [college.name],
    articulates_to: [{
      institution: university.name,
      identifier: 'CS2505',
      name: 'Intro Computer Organization',
      notes: VIRGINIA_TECH_CSC_PAIR_NOTE,
    }],
  });
  const courses = [pairCourse('CSC205'), pairCourse('CSC215')];
  if (coursesMutator) coursesMutator(courses);
  return buildProjection({
    courses,
    degrees: [degree],
    asDegrees: [],
    institutions: [college, university].map((entry) => ({
      _id: `va:${entry.level === 'four_year' ? 'uni' : 'cc'}:${entry.slug}`,
      level: entry.level,
      name: entry.name,
    })),
  });
}

function splitCreditProjection(courses) {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document.institution_id === `va:uni:${SLUG}`
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9230);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  return buildProjection({
    courses: courses.map((course) => ({
      course_id: courseIdFor(course.code),
      course_key: `va:${course.code}`,
      code: course.code,
      credits: course.units,
      source_url: course.url,
      offered_by: [college.name],
      articulates_to: [{
        institution: university.name,
        identifier: course.receiving,
        name: course.receivingName,
        notes: course.note,
      }],
    })),
    degrees: [degree],
    asDegrees: [],
    institutions: [college, university].map((entry) => ({
      _id: `va:${entry.level === 'four_year' ? 'uni' : 'cc'}:${entry.slug}`,
      level: entry.level,
      name: entry.name,
    })),
  });
}

function parentIdsByCode(document) {
  const out = new Map();
  for (const group of document.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        if (receiver.code_seen) out.set(receiver.code_seen, receiver.receiving.parent_id);
      }
    }
  }
  return out;
}

function evaluate(document, rows) {
  const parents = parentIdsByCode(document);
  const receivers = rows.map(({ code, ids }) => ({
    articulation_status: 'articulated',
    receiving: { kind: 'course', parent_id: parents.get(code) },
    options: [{ course_ids: ids }],
  }));
  const unitsById = new Map();
  for (const row of rows) {
    for (const [index, id] of row.ids.entries()) {
      const units = Array.isArray(row.units) ? row.units[index] : row.units;
      if (!unitsById.has(id)) unitsById.set(id, units);
    }
  }
  return _evaluateTemplate(
    document,
    [{ requirement_groups: [{ sections: [{ receivers }] }] }],
    new Set(unitsById.keys()),
    unitsById,
    'semester',
    'semester',
    true,
  );
}

const row = (code, id, units = 3) => ({ code, ids: [id], units });

describe('Virginia Tech exact Figure 3/4 transfer-credit allocation', () => {
  it('uses the exact eight-credit ordinary Or-path capacity without changing named credit', () => {
    const document = finalProjection();
    const empty = evaluate(document, []);
    expect(empty).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'ordinary_or_standalone_2405h',
      directAppliedUnits: 0,
      geCampusUnits: 33,
      // Eight credits from the exact group-10 path plus the separate exact
      // three-credit minimum-total capacity in group 16.
      electiveCampusUnits: 11,
      lowerElectiveCampusUnits: 3,
      sourceBoundApplicationIssues: [],
    });

    for (const second of ['MATH2204', 'CMDA2005']) {
      const ordinary = evaluate(document, [
        row('MATH2114', 101), row(second, 102),
      ]);
      expect(ordinary).toMatchObject({
        sourceBoundVirginiaTechMathRoute: 'ordinary_or_standalone_2405h',
        directAppliedUnits: 6,
        lowerDirectAppliedUnits: 6,
        electiveCampusUnits: 11,
        sourceBoundElectiveAppliedUnits: 0,
        sourceBoundReceivingCreditBonusCampusUnits: 0,
        sourceBoundApplicationIssues: [],
      });
      expect(ordinary.directIds).toEqual(new Set([101, 102]));
    }
  });

  it('preserves standalone MATH 2405H but fails closed on its unproved surplus', () => {
    const document = finalProjection();
    const state = evaluate(document, [row('MATH2405H', 201)]);
    expect(state).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'ordinary_or_standalone_2405h',
      directAppliedUnits: 3,
      sourceBoundElectiveAppliedUnits: 0,
      sourceBoundReceivingCreditBonusCampusUnits: 0,
      electiveCampusUnits: 11,
      sourceBoundApplicationIssues: [{
        kind: 'virginia_tech_standalone_math_2405h_surplus',
      }],
    });
    expect(state.directIds).toEqual(new Set([201]));

    // Merely retaining an honors equivalency is not itself a blocker. When an
    // ordinary three-credit articulation provides the same slot/credit gain,
    // the deterministic exact route uses it and never needs the unknown
    // standalone surplus assumption.
    const safeTie = evaluate(document, [
      row('MATH2405H', 202), row('MATH2114', 203),
    ]);
    expect(safeTie).toMatchObject({
      directAppliedUnits: 3,
      sourceBoundApplicationIssues: [],
    });
    expect(safeTie.directIds).toEqual(new Set([203]));
  });

  it('admits MATH 2406H only through the atomic honors route with 2405H resident', () => {
    const document = finalProjection();
    const secondOnly = evaluate(document, [row('MATH2406H', 301)]);
    expect(secondOnly).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'honors_pair',
      directAppliedUnits: 3,
      sourceBoundElectiveAppliedUnits: 0,
      sourceBoundReceivingCreditBonusCampusUnits: 2,
      // Four path-adjusted free credits remain, plus group 16's three.
      electiveCampusUnits: 7,
      sourceBoundApplicationIssues: [],
    });
    expect(secondOnly.directIds).toEqual(new Set([301]));

    // With one ordinary first-slot articulation and only the honors second
    // half, both route families cover one slot. The shared selector keeps the
    // ordinary family, so 2406H cannot leak into a mixed route.
    const noMixedRoute = evaluate(document, [
      row('MATH2114', 302), row('MATH2406H', 303),
    ]);
    expect(noMixedRoute).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'ordinary_or_standalone_2405h',
      directAppliedUnits: 3,
      electiveCampusUnits: 11,
      sourceBoundReceivingCreditBonusCampusUnits: 0,
      sourceBoundApplicationIssues: [],
    });
    expect(noMixedRoute.directIds).toEqual(new Set([302]));
  });

  it('separates pair-bound AS credits from the receiving-credit bonus', () => {
    const document = finalProjection();
    const threeUnitPair = evaluate(document, [
      row('MATH2405H', 401, 3), row('MATH2406H', 402, 3),
    ]);
    expect(threeUnitPair).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'honors_pair',
      directAppliedUnits: 6,
      sourceBoundElectiveAppliedUnits: 0,
      sourceBoundReceivingCreditBonusCampusUnits: 4,
      sourceBoundUnappliedUnits: 0,
      electiveCampusUnits: 7,
      sourceBoundApplicationIssues: [],
    });

    const fiveUnitPair = evaluate(document, [
      row('MATH2405H', 403, 5), row('MATH2406H', 404, 5),
    ]);
    expect(fiveUnitPair).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'honors_pair',
      // Figure 3's named numerator remains the two three-credit slots.
      directAppliedUnits: 6,
      // The other four sending credits occupy the source-authored
      // free-elective displacement and are available only to Figure 4.
      sourceBoundElectiveAppliedUnits: 4,
      sourceBoundReceivingCreditBonusCampusUnits: 0,
      sourceBoundUnappliedUnits: 0,
      electiveCampusUnits: 7,
      sourceBoundApplicationIssues: [],
    });
  });

  it('never spends one sending identity on both honors halves', () => {
    const state = evaluate(finalProjection(), [
      row('MATH2405H', 501), row('MATH2406H', 501),
    ]);
    expect(state).toMatchObject({
      sourceBoundVirginiaTechMathRoute: 'honors_pair',
      directAppliedUnits: 3,
      sourceBoundElectiveAppliedUnits: 0,
      sourceBoundReceivingCreditBonusCampusUnits: 2,
      sourceBoundApplicationIssues: [],
    });
    expect(state.directIds).toEqual(new Set([501]));
  });

  it('reserves receiving bonus under the transfer cap and outside Figure 3', () => {
    expect(_sourceBoundTransferCapUnits({
      transferCapUnits: null,
      receivingCreditBonusCampusUnits: 4,
      campusSystem: 'semester',
      collegeSystem: 'semester',
    })).toBeNull();
    const adjustedCap = _sourceBoundTransferCapUnits({
      transferCapUnits: 61.5,
      receivingCreditBonusCampusUnits: 4,
      campusSystem: 'semester',
      collegeSystem: 'semester',
    });
    expect(adjustedCap).toBe(57.5);
    const application = _applyAssociateUnits({
      asTotal: 60,
      directApplied: 20,
      geUnits: 33,
      geDemand: 33,
      electiveDemand: 7,
      transferCapUnits: adjustedCap,
    });
    expect(application).toMatchObject({
      direct: 20,
      geCounted: 33,
      generalElectiveCounted: 4.5,
      applied: 57.5,
      transferCapBinding: true,
    });
    expect(application.applied + 4).toBe(61.5);
    // Figure 3 is named plus GE only: neither unrestricted elective credit nor
    // the receiving-campus bonus enters its AS-credit numerator.
    expect(application.direct + application.geCounted).toBe(53);

    const pairSendingCredit = _applyAssociateUnits({
      asTotal: 60,
      directApplied: 20,
      sourceBoundElectiveApplied: 4,
      geUnits: 33,
      geDemand: 33,
      electiveDemand: 7,
      transferCapUnits: 61.5,
    });
    expect(pairSendingCredit).toMatchObject({
      sourceBoundElectiveCounted: 4,
      applied: 60,
    });
    expect(pairSendingCredit.direct + pairSendingCredit.geCounted).toBe(53);
  });

  it('fails closed when the exact tree or free-capacity receipt drifts', () => {
    const drift = structuredClone(finalProjection());
    drift.requirement_groups[10].sections[4].receivers[1].receiving.units = 9;
    const state = evaluate(drift, []);
    expect(state).toMatchObject({
      directAppliedUnits: 0,
      geCampusUnits: 0,
      electiveCampusUnits: 0,
      sourceBoundApplicationIssues: [{
        kind: 'virginia_tech_source_bound_application',
      }],
    });
  });

  it('applies the exact CSC205+CSC215 award as three named credits with no inferred residue', () => {
    const projection = atomicPairProjection();
    const unitsById = new Map(VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => [id, 3]));
    const state = _evaluateTemplate(
      projection.degrees[0],
      projection.agreements,
      new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
      unitsById,
      'semester',
      'semester',
      true,
    );
    expect(state).toMatchObject({
      directAppliedUnits: 3,
      lowerDirectAppliedUnits: 3,
      sourceBoundElectiveAppliedUnits: 0,
      sourceBoundUnappliedUnits: 3,
      sourceBoundReceivingCreditBonusCampusUnits: 0,
      sourceBoundApplicationIssues: [],
      sourceBoundVirginiaTechCscPair: {
        named_application_cap_units: 3,
        residual_elective_credit_supported: false,
        requirement_group_index: 0,
        section_index: 1,
        receiver_index: 0,
      },
    });
    expect(state.directIds).toEqual(new Set(VIRGINIA_TECH_CSC_PAIR_IDS));
    expect(state.lowerDirectIds).toEqual(new Set(VIRGINIA_TECH_CSC_PAIR_IDS));
  });

  it('keeps exact CSC223 and EGR122 split-credit residue elective-only', () => {
    const note = 'Elective equivalent credit hours varies based on transfer course.';
    const cases = [
      {
        courses: [{
          code: 'CSC223', units: 4, receiving: 'CS2114',
          receivingName: 'Softw Des & Data Structures', note,
          url: 'https://www.transfervirginia.org/course/D37A6B421F9411F082AC0242AC15010A',
        }],
        directUnits: 3,
        geSendingUnits: 0,
        totalSendingUnits: 4,
      },
      {
        courses: [{
          code: 'EGR121', units: 2, receiving: 'ENGE1215',
          receivingName: 'Foundations of Engineering', note: null,
          url: 'https://www.transfervirginia.org/course/D37A86ED1F9411F082AC0242AC15010A',
        }, {
          code: 'EGR122', units: 3, receiving: 'ENGE1216',
          receivingName: 'Foundations of Engineering', note,
          url: 'https://www.transfervirginia.org/course/D37A87231F9411F082AC0242AC15010A',
        }],
        directUnits: 0,
        geSendingUnits: 4,
        totalSendingUnits: 5,
      },
    ];
    for (const fixture of cases) {
      const projection = splitCreditProjection(fixture.courses);
      const ids = fixture.courses.map((course) => courseIdFor(course.code));
      const unitsById = new Map(fixture.courses.map((course) => [
        courseIdFor(course.code), course.units,
      ]));
      const conditionAudit = auditVirginiaSourceEquivalencyConditions(
        projection.agreements,
        {
          degreeCourseSet: new Set(ids),
          bachelorDocument: projection.degrees[0],
          unitsById,
          figureModel: 'complete_degree_path',
          requireVirginiaChannels: true,
        },
      );
      expect(conditionAudit).toMatchObject({
        ready: true,
        blocking_conditions: [],
        advisory_conditions: [expect.objectContaining({
          condition_kind: 'exact_vt_split_receiving_credit_resolved',
          resolution: expect.objectContaining({
            residual_elective_credit_supported: true,
          }),
        })],
      });

      const state = _evaluateTemplate(
        projection.degrees[0],
        projection.agreements,
        new Set(ids),
        unitsById,
        'semester',
        'semester',
        true,
      );
      expect(state).toMatchObject({
        directAppliedUnits: fixture.directUnits,
        sourceBoundApplicationIssues: [],
      });
      expect(state.directIds).toEqual(
        fixture.directUnits ? new Set(ids) : new Set(),
      );
      if (fixture.geSendingUnits) expect(state.geCampusUnits).toBeGreaterThanOrEqual(4);

      const application = _applyAssociateUnits({
        asTotal: fixture.totalSendingUnits,
        directApplied: state.directAppliedUnits,
        geUnits: fixture.geSendingUnits,
        geDemand: fixture.geSendingUnits,
        electiveDemand: state.electiveCampusUnits,
      });
      expect(application).toMatchObject({
        direct: fixture.directUnits,
        geCounted: fixture.geSendingUnits,
        electiveCounted: 1,
        applied: fixture.totalSendingUnits,
      });
    }
  });

  it('never applies a lone half or a mutated atomic receipt', () => {
    const projection = atomicPairProjection();
    const unitsById = new Map(VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => [id, 3]));
    for (const id of VIRGINIA_TECH_CSC_PAIR_IDS) {
      const state = _evaluateTemplate(
        projection.degrees[0],
        projection.agreements,
        new Set([id]),
        unitsById,
        'semester',
        'semester',
        true,
      );
      expect(state).toMatchObject({
        directAppliedUnits: 0,
        sourceBoundApplicationIssues: [{
          kind: 'virginia_tech_csc205_csc215_atomic_articulation',
        }],
      });
    }

    const changed = structuredClone(projection.agreements);
    changed[0].requirement_groups[0].sections[1].receivers[0]
      .options[0].source_bound_atomic_articulation.named_application_cap_units = 4;
    const changedState = _evaluateTemplate(
      projection.degrees[0],
      changed,
      new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
      unitsById,
      'semester',
      'semester',
      true,
    );
    expect(changedState).toMatchObject({
      directAppliedUnits: 0,
      sourceBoundApplicationIssues: [{
        kind: 'virginia_tech_csc205_csc215_atomic_articulation',
      }],
    });

    const wrongUnits = new Map(unitsById);
    wrongUnits.set(courseIdFor('CSC215'), 4);
    expect(_evaluateTemplate(
      projection.degrees[0],
      projection.agreements,
      new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
      wrongUnits,
      'semester',
      'semester',
      true,
    )).toMatchObject({
      directAppliedUnits: 0,
      sourceBoundApplicationIssues: [{
        kind: 'virginia_tech_csc205_csc215_atomic_articulation',
      }],
    });
  });

  it('removes an exact unusable lone-half edge from both the degree plan and applied credit', () => {
    const projection = atomicPairProjection();
    const loneId = courseIdFor('CSC205');
    const alternativeId = courseIdFor('MTH265');
    const choiceSection = {
      groupIndex: 0,
      groupConjunction: 'And',
      groupLabel: 'Exact source choice',
      section_advisement: 1,
      unit_advisement: 3,
      unit_advisement_max: 3,
      constraintKinds: [],
      analysisConstraints: [],
      receivers: [{
        options_conjunction: 'or',
        options: [loneId, alternativeId].map((id) => ({
          course_ids: [id],
          course_keys: [`va:${id === loneId ? 'CSC205' : 'MTH265'}`],
          course_conjunction: 'and',
        })),
      }],
    };
    const unitsById = new Map([[loneId, 3], [alternativeId, 3]]);
    const plan = planAssociateDegree(
      [choiceSection],
      // Make the forbidden edge the otherwise preferred direct-credit route.
      new Set([loneId]),
      new Set([loneId, alternativeId]),
      unitsById,
      {
        strictConstraints: true,
        totalUnits: 3,
        totalUnitsMax: 3,
        sourceBoundForbiddenCourseIds: [loneId],
      },
    );

    expect(plan).toMatchObject({ complete: true, ids: [alternativeId] });
    expect(plan.ids).not.toContain(loneId);
    const applied = _evaluateTemplate(
      projection.degrees[0],
      projection.agreements,
      new Set(plan.ids),
      unitsById,
      'semester',
      'semester',
      true,
    );
    expect(applied).toMatchObject({
      directAppliedUnits: 0,
      sourceBoundApplicationIssues: [],
    });
    expect(applied.directIds).not.toContain(loneId);

    // If the authored section makes the lone edge mandatory, avoidance is
    // impossible and the cell remains excluded instead of looking complete.
    const mandatory = structuredClone(choiceSection);
    mandatory.receivers[0].options = mandatory.receivers[0].options.slice(0, 1);
    const blocked = planAssociateDegree(
      [mandatory],
      new Set([loneId]),
      new Set([loneId]),
      new Map([[loneId, 3]]),
      {
        strictConstraints: true,
        totalUnits: 3,
        totalUnitsMax: 3,
        sourceBoundForbiddenCourseIds: [loneId],
      },
    );
    expect(blocked).toMatchObject({ complete: false, ids: [] });
  });

  it('forces both identities through the real associate Boolean topology', () => {
    const source = cachedAcceptedSourcePlan().documents;
    const institutions = VA_INSTITUTION_REGISTRY.map((entry) => ({
      _id: `va:${entry.level === 'four_year' ? 'uni' : 'cc'}:${entry.slug}`,
      level: entry.level,
      name: entry.name,
    }));
    const projection = buildProjection({
      courses: [],
      degrees: [],
      asDegrees: source.filter((document) => document.kind === 'as_degree'),
      institutions,
    });
    const expected = new Map([
      [9301, false], // one choose-one Blue Ridge section
      [9303, false], // one choose-one Central Virginia section
      [9307, true],
      [9308, true],
      [9312, true],
      [9320, true],
    ]);
    for (const document of projection.asDegrees.filter((row) => (
      expected.has(Number(row.community_college_id))
    ))) {
      const sections = associateNamedSections(document, { paperFigure: '3_4' });
      const pairSections = sections.filter((section) => (
        (section.receivers || []).some((receiver) => (
          (receiver.options || []).some((option) => (
            (option.course_ids || []).some((id) => (
              VIRGINIA_TECH_CSC_PAIR_IDS.includes(Number(id))
            ))
          ))
        ))
      ));
      const allIds = new Set(pairSections.flatMap((section) => (
        (section.receivers || []).flatMap((receiver) => (
          (receiver.options || []).flatMap((option) => option.course_ids || [])
        ))
      )).map(Number));
      const plan = planAssociateDegree(
        pairSections,
        new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
        allIds,
        new Map([...allIds].map((id) => [id, 3])),
        {
          strictConstraints: true,
          paperFigure: '3_4',
          sourceDocument: document,
          totalUnits: 0,
          totalUnitsMax: 100,
          aggregateUnits: 0,
          hasUnitsFill: false,
          sourceBoundRequiredAnyIdSets: [VIRGINIA_TECH_CSC_PAIR_IDS],
        },
      );
      expect(plan.complete, document.college_name)
        .toBe(expected.get(Number(document.community_college_id)));
      if (plan.complete) {
        expect(VIRGINIA_TECH_CSC_PAIR_IDS.every((id) => plan.ids.includes(id)),
          document.college_name).toBe(true);
      }
    }
  });
});
