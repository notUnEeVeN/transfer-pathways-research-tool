import { describe, expect, it } from 'vitest';
import {
  VIRGINIA_TECH_CSC_PAIR_CONTRACT,
  VIRGINIA_TECH_CSC_PAIR_IDS,
  VIRGINIA_TECH_CSC_PAIR_NOTE,
} from './virginiaTechAtomicArticulation';
import {
  EXACT_NONBLOCKING_NOTES,
  auditVirginiaSourceEquivalencyConditions,
  classifySourceEquivalencyNote,
  selectedEquivalenciesSha256,
  sourceEquivalenciesSha256,
  validateSelectedEquivalencyChannel,
  validateSourceEquivalencyChannel,
} from './virginiaTransferEquivalencyConditions';
import { courseIdFor } from '../virginia/courseIdentity';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import { auditVirginiaProjectionEquivalencyConditions } from './transferCreditRate';

function exactVirginiaTechPairProjection({ courseMutator = null, degreeMutator = null } = {}) {
  const source = cachedAcceptedSourcePlan().documents.find((document) => (
    document._id
      === 'va:degree:virginia-polytechnic-institute-and-state-university:cs'
  ));
  const degree = structuredClone(source);
  if (degreeMutator) degreeMutator(degree);
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
  if (courseMutator) courseMutator(courses);
  return buildProjection({
    courses,
    degrees: [degree],
    asDegrees: [],
    institutions: [college, university].map((row) => ({
      _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
      level: row.level,
      name: row.name,
    })),
  });
}

const URL = 'https://www.transfervirginia.org/course/ABC123';

function concreteRow(sendingCode, receivingCode, note = null, overrides = {}) {
  return {
    sending_course_id: courseIdFor(sendingCode),
    sending_course_key: `va:${sendingCode}`,
    sending_code: sendingCode,
    receiving_identifier: receivingCode,
    receiving_name: `${receivingCode} title`,
    receiving_notes: note,
    receiving_parent_id: courseIdFor(receivingCode),
    sending_source_url: URL,
    ...overrides,
  };
}

function selectedRow(sendingCode, receivingCode, note = null, overrides = {}) {
  return {
    requirement_group_index: 0,
    section_index: 0,
    receiver_index: 0,
    option_index: 0,
    demand_index: 0,
    sending_course_id: courseIdFor(sendingCode),
    sending_course_key: `va:${sendingCode}`,
    sending_code: sendingCode,
    source_receiving_identifier: receivingCode,
    source_receiving_name: `${receivingCode} title`,
    source_receiving_notes_supplied: true,
    source_receiving_notes: note,
    source_receiving_parent_id_supplied: false,
    source_receiving_parent_id: null,
    sending_source_url: URL,
    ...overrides,
  };
}

function seal(agreement) {
  agreement.source_equivalencies_count = agreement.source_equivalencies.length;
  agreement.source_equivalencies_sha256 = sourceEquivalenciesSha256(
    agreement.source_equivalencies,
  );
  agreement.selected_equivalencies_count = agreement.selected_equivalencies.length;
  agreement.selected_equivalencies_sha256 = selectedEquivalenciesSha256(
    agreement.selected_equivalencies,
  );
  agreement.derived_from.supply_edges = Math.max(
    agreement.source_equivalencies.length,
    agreement.selected_equivalencies.length,
  );
  return agreement;
}

function agreementFixture({ note = null } = {}) {
  const source = concreteRow('CHM111', 'CHEM111', note);
  const selected = selectedRow('CHM111', 'CHEM111', note);
  return seal({
    _id: 'va:agreement:fixture',
    state: 'va',
    pairing: 'course-equivalency-join',
    derived_from: { degree_id: 'va:degree:fixture', supply_edges: 1 },
    source_equivalencies_contract: 'va-concrete-supply-edge-v2',
    source_equivalencies: [source],
    selected_equivalencies_contract: 'va-selected-supply-edge-v1',
    selected_equivalencies: [selected],
    requirement_groups: [{ sections: [{ receivers: [{
      code_seen: 'CHEM111',
      receiving: { kind: 'course', parent_id: courseIdFor('CHEM111') },
      articulation_status: 'articulated',
      options: [{ course_ids: [courseIdFor('CHM111')], course_conjunction: 'and' }],
    }] }] }],
  });
}

function projectedDegree(schoolId) {
  const plan = cachedAcceptedSourcePlan();
  const degree = plan.documents.find((document) => (
    document.kind === 'degree'
      && Number(VA_INSTITUTION_REGISTRY.find((row) => (
        row.level === 'four_year'
          && document.institution_id === `va:uni:${row.slug}`
      ))?.id) === schoolId
  ));
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === schoolId);
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
    source_url: URL,
    offered_by: [college.name],
    articulates_to: [{
      institution: university.name,
      identifier: 'NO_MATCH_299',
      name: 'No match',
      notes: null,
    }],
  };
  return buildProjection({
    courses: [supply], degrees: [degree], asDegrees: [], institutions,
  }).degrees.find((document) => document.school_id === schoolId);
}

function agreementForProjectedPath(document, {
  receiverCode,
  sendingRows,
}) {
  const university = VA_INSTITUTION_REGISTRY.find((row) => row.id === document.school_id);
  const college = VA_INSTITUTION_REGISTRY.find((row) => row.id === 9301);
  const groups = structuredClone(document.requirement_groups);
  let path = null;
  for (const [groupIndex, group] of groups.entries()) {
    for (const [sectionIndex, section] of (group.sections || []).entries()) {
      for (const [receiverIndex, receiver] of (section.receivers || []).entries()) {
        receiver.articulation_status = 'not_articulated';
        receiver.options = [];
        const codes = String(receiver.code_seen || '').split(/\s*\+\s*/);
        if (codes.includes(receiverCode)) path = { groupIndex, sectionIndex, receiverIndex };
      }
    }
  }
  if (!path) throw new Error(`missing projected receiver ${receiverCode}`);
  const receiver = groups[path.groupIndex].sections[path.sectionIndex]
    .receivers[path.receiverIndex];
  receiver.articulation_status = 'articulated';
  receiver.options = [{
    course_ids: sendingRows.map((row) => courseIdFor(row.sending)),
    course_conjunction: 'and',
  }];
  const source = sendingRows.map((row) => concreteRow(
    row.sending,
    row.receiving,
    row.note,
    {
      receiving_name: row.receivingName,
      sending_source_url: row.url,
    },
  ));
  const selected = sendingRows.map((row, demandIndex) => selectedRow(
    row.sending,
    row.receiving,
    row.note,
    {
      requirement_group_index: path.groupIndex,
      section_index: path.sectionIndex,
      receiver_index: path.receiverIndex,
      demand_index: demandIndex,
      source_receiving_name: row.receivingName,
      sending_source_url: row.url,
    },
  ));
  return seal({
    _id: `va:agreement:${document.school_id}:9301`,
    university_id: `va:uni:${university.slug}`,
    college_id: `va:cc:${college.slug}`,
    uc_school_id: document.school_id,
    community_college_id: college.id,
    major: 'Computer Science, B.S.',
    state: 'va',
    source: 'derived from Transfer Virginia course equivalencies × published degree requirements',
    pairing: 'course-equivalency-join',
    derived_from: { degree_id: document.va_requirement_id, supply_edges: selected.length },
    source_equivalencies_contract: 'va-concrete-supply-edge-v2',
    source_equivalencies: source.sort((a, b) => (
      a.sending_course_id - b.sending_course_id
        || a.receiving_parent_id - b.receiving_parent_id
    )),
    selected_equivalencies_contract: 'va-selected-supply-edge-v1',
    selected_equivalencies: selected.sort((a, b) => a.demand_index - b.demand_index),
    requirement_groups: groups,
  });
}

describe('Virginia selected-equivalency condition gate', () => {
  it('uses exact full-string classifications and treats explicit empty as invalid', () => {
    expect(classifySourceEquivalencyNote(null)).toEqual({ kind: 'none', blocking: false });
    expect(classifySourceEquivalencyNote('')).toEqual({
      kind: 'invalid_empty_note', blocking: true,
    });
    for (const note of EXACT_NONBLOCKING_NOTES.keys()) {
      expect(classifySourceEquivalencyNote(note).blocking, note).toBe(false);
      expect(classifySourceEquivalencyNote(`${note} changed`).blocking, note).toBe(true);
    }
    expect(classifySourceEquivalencyNote(
      'Must take CSC 205 + 215 to receive CS 2505 + 2XXX.',
    )).toMatchObject({ kind: 'compound_sending_requirement', blocking: true });
    expect(classifySourceEquivalencyNote('A minimum grade of C is required.'))
      .toMatchObject({ kind: 'minimum_grade_condition', blocking: true });
    expect(classifySourceEquivalencyNote('Consult your advisor.'))
      .toMatchObject({ kind: 'advisor_or_approval_condition', blocking: true });
  });

  it('validates both channel receipts and preserves unresolved VCU/VT notes', () => {
    const vcu = agreementFixture({
      note: 'Students will receive transfer credit for either STAT 210 or STAT 212, depending on their degree requirements.',
    });
    expect(validateSourceEquivalencyChannel(vcu).valid).toBe(true);
    expect(validateSelectedEquivalencyChannel(vcu, vcu.source_equivalencies).valid).toBe(true);
    expect(auditVirginiaSourceEquivalencyConditions([vcu]))
      .toMatchObject({ ready: false, blocking_conditions: [{
        condition_kind: 'alternative_receiving_award',
      }] });

    const vt = agreementFixture({
      note: 'Elective equivalent credit hours varies based on transfer course.',
    });
    expect(auditVirginiaSourceEquivalencyConditions([vt]))
      .toMatchObject({ ready: false, blocking_conditions: [{
        condition_kind: 'variable_receiving_credit',
      }] });
  });

  it('filters only after the exact A.S. candidate course identity is known', () => {
    const agreement = agreementFixture({ note: 'Consult your advisor.' });
    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('CHM111')]),
    }).ready).toBe(false);
    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('BIO101')]),
    })).toMatchObject({ ready: true, blocking_conditions: [] });
  });

  it('does not treat Passport/UCGS annotations as globally safe', () => {
    const note = 'With Passport or UCGS, applies to General Education, Pathway 4.';
    const audit = auditVirginiaSourceEquivalencyConditions([agreementFixture({ note })]);
    expect(audit).toMatchObject({
      ready: false,
      blocking_conditions: [{ receiving_notes: note }],
      advisory_conditions: [],
    });
  });

  it('carries and blocks a noted generic selected edge omitted from concrete v2', () => {
    const agreement = agreementFixture();
    agreement.source_equivalencies = [];
    agreement.requirement_groups[0].sections[0].receivers[0] = {
      code_seen: 'HIST2XX',
      receiving: { kind: 'ge_area', code: 'HIST2XX' },
      articulation_status: 'articulated',
      options: [{ course_ids: [courseIdFor('HIS101')], course_conjunction: 'and' }],
    };
    agreement.selected_equivalencies = [selectedRow('HIS101', 'HIST2XX',
      'Consult an advisor before applying this credit.', {
        source_receiving_name: 'History Transfer Elective',
      })];
    seal(agreement);
    const audit = auditVirginiaSourceEquivalencyConditions([agreement]);
    expect(audit).toMatchObject({
      ready: false,
      invalid_channels: [],
      blocking_conditions: [{ condition_kind: 'advisor_or_approval_condition' }],
    });
  });

  it('rejects tampered count/hash/schema, omissions, and wrong receiver bindings', () => {
    const mutations = [
      (row) => { row.source_equivalencies_count += 1; },
      (row) => { row.source_equivalencies_sha256 = '0'.repeat(64); },
      (row) => {
        delete row.selected_equivalencies[0].source_receiving_notes;
        row.selected_equivalencies_sha256 = selectedEquivalenciesSha256(row.selected_equivalencies);
      },
      (row) => {
        row.selected_equivalencies[0].source_receiving_notes = 'Mutated after v2 capture';
        row.selected_equivalencies_sha256 = selectedEquivalenciesSha256(row.selected_equivalencies);
      },
      (row) => {
        row.selected_equivalencies = [];
        seal(row);
      },
      (row) => {
        row.selected_equivalencies[0].source_receiving_identifier = 'CHEM112';
        row.selected_equivalencies_sha256 = selectedEquivalenciesSha256(row.selected_equivalencies);
      },
      (row) => {
        row.selected_equivalencies[0].source_receiving_parent_id_supplied = true;
        row.selected_equivalencies[0].source_receiving_parent_id = courseIdFor('CHEM112');
        row.selected_equivalencies_sha256 = selectedEquivalenciesSha256(row.selected_equivalencies);
      },
    ];
    for (const mutate of mutations) {
      const agreement = agreementFixture();
      mutate(agreement);
      const audit = auditVirginiaSourceEquivalencyConditions([agreement]);
      expect(audit.ready).toBe(false);
      expect(audit.invalid_channels.length).toBe(1);
    }
  });

  it('rejects stripped production channels and swapped multi-course demand topology', () => {
    expect(auditVirginiaSourceEquivalencyConditions([{
      _id: 'va:agreement:9201:9301',
      requirement_groups: [],
    }])).toMatchObject({ ready: false, invalid_channels: [{
      reason: expect.stringMatching(/contract is missing/i),
    }] });

    const agreement = agreementFixture();
    agreement.source_equivalencies = [
      concreteRow('CHM111', 'CHEM112'),
      concreteRow('CHM112', 'CHEM111'),
    ].sort((a, b) => a.sending_course_id - b.sending_course_id);
    agreement.requirement_groups[0].sections[0].receivers[0] = {
      code_seen: 'CHEM111 + CHEM112',
      receiving: {
        kind: 'series', conjunction: 'and',
        parent_ids: [courseIdFor('CHEM111'), courseIdFor('CHEM112')],
      },
      articulation_status: 'articulated',
      options: [{
        course_ids: [courseIdFor('CHM111'), courseIdFor('CHM112')],
        course_conjunction: 'and',
      }],
    };
    agreement.selected_equivalencies = [
      selectedRow('CHM111', 'CHEM112', null, { demand_index: 0 }),
      selectedRow('CHM112', 'CHEM111', null, { demand_index: 1 }),
    ];
    seal(agreement);
    expect(auditVirginiaSourceEquivalencyConditions([agreement]))
      .toMatchObject({ ready: false, invalid_channels: [{
        reason: expect.stringMatching(/binds to its articulated option/i),
      }] });
  });

  it('treats CA/MA agreements as nonapplicable and does not add fields to them', () => {
    const agreement = {
      state: 'ma', pairing: 'order-approximate', requirement_groups: [],
    };
    expect(auditVirginiaSourceEquivalencyConditions([agreement])).toMatchObject({
      applicable: false, ready: true, claimed_agreement_count: 0,
    });
    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      requireVirginiaChannels: true,
    })).toMatchObject({
      applicable: false,
      ready: false,
      invalid_channels: [{
        reason: expect.stringMatching(/does not claim the required/i),
      }],
    });
  });

  it('exports a pure degree-aware projection audit for pre-publication gates', () => {
    const agreement = agreementFixture({ note: 'Consult your advisor.' });
    Object.assign(agreement, {
      uc_school_id: 9201,
      community_college_id: 9301,
      major: 'Computer Science, B.S.',
    });
    const projection = {
      asDegrees: [{
        _id: 'as_degree:9301:va-cs:local_as',
        kind: 'as_degree', state: 'va', community_college_id: 9301,
        college_name: 'Fixture College',
        requirement_groups: [{
          label_seen: 'Named requirements', ge_area: null,
          sections: [{ receivers: [{
            receiving: { kind: 'requirement' },
            options: [{ course_ids: [courseIdFor('CHM111')] }],
          }] }],
        }],
      }],
      degrees: [{
        _id: 'degree:9201:va-cs', kind: 'degree', state: 'va', school_id: 9201,
        school: 'Fixture University', program: 'Computer Science, B.S.',
        requirement_groups: [],
      }],
      agreements: [agreement],
      courses: [{
        side: 'sending', course_id: courseIdFor('CHM111'), units: 4,
      }],
    };
    const report = auditVirginiaProjectionEquivalencyConditions(projection, {
      expectedAssociateDegrees: 1,
      expectedBachelorDegrees: 1,
      expectedCells: 1,
    });
    expect(report).toMatchObject({
      ready: false,
      blocker: 'unresolved_selected_equivalency_conditions',
      counts: {
        cells: 1,
        ready_cells: 0,
        blocked_cells: 1,
        selected_edges: 1,
        selected_generic_edges: 0,
      },
      blocked_cells: [{
        community_college_id: 9301,
        school_id: 9201,
        blocking_conditions: [{ condition_kind: 'advisor_or_approval_condition' }],
      }],
    });
  });

  it('resolves only the exact VCU equal-unit statistics alternative', () => {
    const document = projectedDegree(9229);
    const agreement = agreementForProjectedPath(document, {
      receiverCode: 'STAT210',
      sendingRows: [{
        sending: 'MTH245', receiving: 'STAT210',
        receivingName: 'BASIC PRACTICE OF STATISTICS',
        note: 'Students will receive transfer credit for either STAT 210 or STAT 212, depending on their degree requirements.',
        url: 'https://www.transfervirginia.org/course/D37BC31B1F9411F082AC0242AC15010A',
      }],
    });
    const audit = auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('MTH245')]),
      bachelorDocument: document,
      unitsById: new Map([[courseIdFor('MTH245'), 3]]),
    });
    expect(audit).toMatchObject({
      ready: true,
      blocking_conditions: [],
      advisory_conditions: [{
        condition_kind: 'equal_unit_receiving_alternative_resolved',
        resolution: { accepted_receiving_codes: ['STAT210', 'STAT212'] },
      }],
    });
    const changed = structuredClone(document);
    const section = changed.requirement_groups
      .flatMap((group) => group.sections)
      .find((row) => row.receivers.some((receiver) => receiver.code_seen === 'STAT210'));
    section.unit_advisement = 4;
    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('MTH245')]),
      bachelorDocument: changed,
      unitsById: new Map([[courseIdFor('MTH245'), 3]]),
    }).ready).toBe(false);
  });

  it('resolves the same-credit text only for exact VCU SDV100→UNIV101 1→1', () => {
    const document = projectedDegree(9229);
    const note = 'Students will earn the same number of transfer credits (semester hours) as the course taken.';
    const agreement = agreementForProjectedPath(document, {
      receiverCode: 'UNIV101',
      sendingRows: [{
        sending: 'SDV100', receiving: 'UNIV101',
        receivingName: 'INTRODUCTION TO THE UNIVERSITY',
        note,
        url: 'https://www.transfervirginia.org/course/D3A1BC681F9411F082AC0242AC15010A',
      }],
    });
    const exact = auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('SDV100')]),
      bachelorDocument: document,
      unitsById: new Map([[courseIdFor('SDV100'), 1]]),
    });
    expect(exact).toMatchObject({
      ready: true,
      blocking_conditions: [],
      advisory_conditions: [{
        condition_kind: 'same_credit_hours_confirmation_resolved',
        resolution: { sending_units: 1, receiving_units: 1 },
      }],
    });
    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('SDV100')]),
      bachelorDocument: document,
      unitsById: new Map([[courseIdFor('SDV100'), 2]]),
    }).ready).toBe(false);
  });

  it('resolves only the two exact source-bound VT split-credit quantities', () => {
    const document = projectedDegree(9230);
    const cases = [
      {
        receiverCode: 'CS2114',
        sendingRows: [{
          sending: 'CSC223', receiving: 'CS2114',
          receivingName: 'Softw Des & Data Structures',
          note: 'Elective equivalent credit hours varies based on transfer course.',
          url: 'https://www.transfervirginia.org/course/D37A6B421F9411F082AC0242AC15010A',
        }],
        units: [['CSC223', 4]],
      },
      {
        receiverCode: 'ENGE1215',
        sendingRows: [{
          sending: 'EGR121', receiving: 'ENGE1215',
          receivingName: 'Foundations of Engineering', note: null,
          url: 'https://www.transfervirginia.org/course/D37A86ED1F9411F082AC0242AC15010A',
        }, {
          sending: 'EGR122', receiving: 'ENGE1216',
          receivingName: 'Foundations of Engineering',
          note: 'Elective equivalent credit hours varies based on transfer course.',
          url: 'https://www.transfervirginia.org/course/D37A87231F9411F082AC0242AC15010A',
        }],
        units: [['EGR121', 2], ['EGR122', 3]],
      },
    ];
    for (const row of cases) {
      const agreement = agreementForProjectedPath(document, row);
      const unitsById = new Map(row.units.map(([code, units]) => [courseIdFor(code), units]));
      const audit = auditVirginiaSourceEquivalencyConditions([agreement], {
        degreeCourseSet: new Set(row.units.map(([code]) => courseIdFor(code))),
        bachelorDocument: document,
        unitsById,
        figureModel: 'complete_degree_path',
      });
      expect(audit.ready, row.receiverCode).toBe(true);
      expect(audit.blocking_conditions).toEqual([]);
      expect(audit.advisory_conditions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          condition_kind: 'exact_vt_split_receiving_credit_resolved',
          resolution: expect.objectContaining({
            rule: 'exact-vt-vccs-split-receiving-credit-v1',
            residual_elective_credit_supported: true,
            total_receiving_units: row.receiverCode === 'CS2114' ? 4 : 3,
          }),
        }),
      ]));

      const targetCode = row.sendingRows.at(-1).sending;
      for (const mutate of [
        (candidate) => {
          candidate.selected_equivalencies.find((edge) => (
            edge.sending_code === targetCode
          )).sending_source_url = 'https://www.transfervirginia.org/course/ABCDEF';
          candidate.source_equivalencies.find((edge) => (
            edge.sending_code === targetCode
          )).sending_source_url = 'https://www.transfervirginia.org/course/ABCDEF';
        },
        (candidate) => { candidate.selected_equivalencies[0].option_index = 1; },
      ]) {
        const changedAgreement = structuredClone(agreement);
        mutate(changedAgreement);
        seal(changedAgreement);
        expect(auditVirginiaSourceEquivalencyConditions([changedAgreement], {
          degreeCourseSet: new Set(row.units.map(([code]) => courseIdFor(code))),
          bachelorDocument: document,
          unitsById,
          figureModel: 'complete_degree_path',
        }).ready, row.receiverCode).toBe(false);
      }

      const wrongUnits = new Map(unitsById);
      wrongUnits.set(courseIdFor(row.sendingRows.at(-1).sending), 99);
      expect(auditVirginiaSourceEquivalencyConditions([agreement], {
        degreeCourseSet: new Set(row.units.map(([code]) => courseIdFor(code))),
        bachelorDocument: document,
        unitsById: wrongUnits,
        figureModel: 'complete_degree_path',
      }).ready, row.receiverCode).toBe(false);

      expect(auditVirginiaSourceEquivalencyConditions([agreement], {
        degreeCourseSet: new Set(row.units.map(([code]) => courseIdFor(code))),
        bachelorDocument: document,
        unitsById,
      }).ready, row.receiverCode).toBe(false);
    }

    const changedDocument = structuredClone(document);
    changedDocument.requirement_groups[3].sections[1].unit_advisement = 4;
    const cscAgreement = agreementForProjectedPath(document, cases[0]);
    expect(auditVirginiaSourceEquivalencyConditions([cscAgreement], {
      degreeCourseSet: new Set([courseIdFor('CSC223')]),
      bachelorDocument: changedDocument,
      unitsById: new Map([[courseIdFor('CSC223'), 4]]),
      figureModel: 'complete_degree_path',
    }).ready).toBe(false);
  });

  it('resolves only one exact source-bound CSC205+CSC215→VT CS2505 topology', () => {
    const projection = exactVirginiaTechPairProjection();
    const agreement = projection.agreements[0];
    const document = projection.degrees[0];
    const unitsById = new Map(VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => [id, 3]));
    const exact = auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
      bachelorDocument: document,
      unitsById,
      requireVirginiaChannels: true,
    });
    expect(exact).toMatchObject({
      ready: true,
      blocking_conditions: [],
      advisory_conditions: [{
        condition_kind: 'compound_sending_requirement_resolved',
        resolution: {
          rule: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
          named_application_cap_units: 3,
          residual_elective_credit_supported: false,
        },
      }],
      source_bound_required_any_id_sets: [VIRGINIA_TECH_CSC_PAIR_IDS],
      source_bound_applications: [{
        contract: VIRGINIA_TECH_CSC_PAIR_CONTRACT,
        sending_course_ids: VIRGINIA_TECH_CSC_PAIR_IDS,
        named_application_cap_units: 3,
        residual_elective_credit_supported: false,
        requirement_group_index: 0,
        section_index: 1,
        receiver_index: 0,
      }],
    });

    for (const candidate of VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => new Set([id]))) {
      const loneId = [...candidate][0];
      const companionId = VIRGINIA_TECH_CSC_PAIR_IDS.find((id) => id !== loneId);
      expect(auditVirginiaSourceEquivalencyConditions([agreement], {
        degreeCourseSet: candidate,
        bachelorDocument: document,
        unitsById,
      })).toMatchObject({
        ready: true,
        blocking_conditions: [],
        advisory_conditions: [{
          condition_kind: 'compound_sending_requirement_edge_unusable',
          resolution: {
            disposition: 'exclude_exact_lone_half_from_associate_plan',
            forbidden_sending_course_ids: [loneId],
            required_companion_course_ids: [companionId],
            named_application_cap_units: 0,
            residual_elective_credit_supported: false,
          },
        }],
        source_bound_required_any_id_sets: [],
        source_bound_applications: [],
        source_bound_forbidden_course_ids: [loneId],
      });
    }
  });

  it('does not promote an unselected VT pair source observation into a cell condition', () => {
    const projection = exactVirginiaTechPairProjection();
    const agreement = structuredClone(projection.agreements[0]);
    const receiver = agreement.requirement_groups[0].sections[1].receivers[0];
    receiver.articulation_status = 'not_articulated';
    receiver.options = [];
    agreement.selected_equivalencies = [];
    seal(agreement);
    const unitsById = new Map(VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => [id, 3]));

    expect(auditVirginiaSourceEquivalencyConditions([agreement], {
      degreeCourseSet: new Set([courseIdFor('CSC205')]),
      bachelorDocument: projection.degrees[0],
      unitsById,
      requireVirginiaChannels: true,
    })).toMatchObject({
      ready: true,
      blocking_conditions: [],
      advisory_conditions: [],
      source_bound_required_any_id_sets: [],
      source_bound_applications: [],
      source_bound_forbidden_course_ids: [],
    });
  });

  it('fails the VT pair closed on topology, provenance, quantity, and bundle mutations', () => {
    const projection = exactVirginiaTechPairProjection();
    const document = projection.degrees[0];
    const unitsById = new Map(VIRGINIA_TECH_CSC_PAIR_IDS.map((id) => [id, 3]));
    const audit = (agreement, bachelor = document, units = unitsById) => (
      auditVirginiaSourceEquivalencyConditions([agreement], {
        degreeCourseSet: new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
        bachelorDocument: bachelor,
        unitsById: units,
        requireVirginiaChannels: true,
      })
    );
    const mutations = [
      (agreement) => {
        agreement.requirement_groups[0].sections[1].receivers[0]
          .options[0].source_bound_atomic_articulation.contract += '-changed';
      },
      (agreement) => {
        agreement.requirement_groups[0].sections[1].receivers[0]
          .options[0].source_bound_atomic_articulation.future_condition = true;
      },
      (agreement) => {
        agreement.selected_equivalencies[0].demand_index = 1;
        agreement.selected_equivalencies[1].demand_index = 0;
        agreement.selected_equivalencies_sha256 = selectedEquivalenciesSha256(
          agreement.selected_equivalencies,
        );
      },
      (agreement) => {
        agreement.selected_equivalencies.pop();
        seal(agreement);
      },
      (agreement) => {
        agreement.selected_equivalencies.push(structuredClone(
          agreement.selected_equivalencies[0],
        ));
        seal(agreement);
      },
      (agreement) => { agreement.college_id = 'va:cc:blue-ridge-community-college'; },
      (agreement) => { agreement.source = 'unbound source'; },
      (agreement) => {
        agreement.source_equivalencies[0].sending_source_url += '-changed';
        seal(agreement);
      },
    ];
    for (const mutate of mutations) {
      const agreement = structuredClone(projection.agreements[0]);
      mutate(agreement);
      expect(audit(agreement).ready).toBe(false);
    }

    const wrongUnits = new Map(unitsById);
    wrongUnits.set(courseIdFor('CSC215'), 4);
    expect(audit(projection.agreements[0], document, wrongUnits).ready).toBe(false);

    const loneWrongUnits = new Map(unitsById);
    loneWrongUnits.set(courseIdFor('CSC215'), 4);
    expect(auditVirginiaSourceEquivalencyConditions([projection.agreements[0]], {
      degreeCourseSet: new Set([courseIdFor('CSC205')]),
      bachelorDocument: document,
      unitsById: loneWrongUnits,
      requireVirginiaChannels: true,
    }).ready).toBe(false);

    const treeDrift = structuredClone(document);
    treeDrift.requirement_groups[0].sections[1].unit_advisement = 4;
    expect(audit(projection.agreements[0], treeDrift).ready).toBe(false);

    const split = exactVirginiaTechPairProjection();
    const left = structuredClone(split.agreements[0]);
    const right = structuredClone(split.agreements[0]);
    left._id = 'va:agreement:9230:9307-left';
    left.source_equivalencies = left.source_equivalencies.slice(0, 1);
    left.selected_equivalencies = [];
    seal(left);
    right._id = 'va:agreement:9230:9307-right';
    right.source_equivalencies = right.source_equivalencies.slice(1);
    right.selected_equivalencies = [];
    seal(right);
    expect(auditVirginiaSourceEquivalencyConditions([left, right], {
      degreeCourseSet: new Set(VIRGINIA_TECH_CSC_PAIR_IDS),
      bachelorDocument: document,
      unitsById,
      requireVirginiaChannels: true,
    }).ready).toBe(false);
  });
});
