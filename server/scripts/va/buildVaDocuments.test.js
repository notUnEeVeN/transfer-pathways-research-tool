import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildProjection,
  localSendingCourses,
  operationalVirginiaDegreeSources,
  projectGroups,
  receivingCourses,
  selectAssociateSources,
} from './buildVaDocuments';
import {
  courseIdFor,
  institutionCourseIdFor,
  institutionCourseIdentity,
  projectInstitutionReceivingGroups,
  sharedCourseIdentity,
} from '../../services/virginia/courseIdentity';

const asSource = (overrides = {}) => ({
  _id: 'va:as:virginia-western-community-college:cs',
  kind: 'as_degree',
  community_college_id: 'va:cc:virginia-western-community-college',
  status: 'extracted',
  source: 'institution_catalog',
  source_method: 'official_catalog_composition',
  degree_title_seen: 'Computer Science, A.S.',
  catalog_url: 'https://catalog.example.edu/program',
  catalog_year: '2026-2027',
  total_units: 60,
  unit_system: 'semester',
  extraction: { confidence: 0.97 },
  verification: { verified: false },
  acceptance: { accepted: true, ready_for_analysis: false },
  requirement_groups: [],
  ...overrides,
});

describe('Virginia shared-schema projection', () => {
  it('chooses explicit analysis readiness, then verification/provenance, never legacy primary', () => {
    const legacyPrimary = asSource({
      _id: 'legacy-primary',
      source: 'transferva_program_map',
      source_method: null,
      primary: true,
      acceptance: null,
    });
    const verifiedCatalog = asSource({
      _id: 'verified-catalog',
      verification: { verified: true },
    });
    const readyCatalog = asSource({
      _id: 'ready-catalog',
      acceptance: { accepted: true, ready_for_analysis: true },
    });
    const nonExtracted = asSource({
      _id: 'superseded-ready', status: 'superseded',
      acceptance: { accepted: true, ready_for_analysis: true },
      verification: { verified: true },
    });

    const { selected, alternates } = selectAssociateSources([
      legacyPrimary, verifiedCatalog, readyCatalog, nonExtracted,
    ]);

    expect(selected.map((source) => source._id)).toEqual(['ready-catalog']);
    expect(alternates[0]).toMatchObject({
      chosen: 'ready-catalog',
      dropped: ['verified-catalog', 'legacy-primary'],
    });

    const withoutReady = selectAssociateSources([legacyPrimary, verifiedCatalog]);
    expect(withoutReady.selected[0]._id).toBe('verified-catalog');
  });

  it('retains every extracted alternate in an exact, fail-closed source-disposition ledger', () => {
    const official = asSource({
      _id: 'official-catalog',
      verification: { verified: false },
      requirement_groups: [{
        group_id: 'official_core',
        sections: [{ unit_advisement: 6, receivers: [] }],
      }],
    });
    const verifiedTransferVa = asSource({
      _id: 'verified-transferva',
      source: 'transferva_program_map',
      source_method: null,
      verification: { verified: true, verified_by: 'researcher' },
      requirement_groups: [{
        group_id: 'verified_core',
        sections: [{ unit_advisement: 9, receivers: [] }],
      }],
    });
    const { selected, dispositions } = selectAssociateSources([
      official,
      verifiedTransferVa,
    ]);

    expect(selected.map((row) => row._id)).toEqual(['official-catalog']);
    expect(dispositions).toHaveLength(1);
    expect(dispositions[0]).toMatchObject({
      contract: 'va-associate-source-disposition-v1',
      selected_source_id: 'official-catalog',
      alternate_source_id: 'verified-transferva',
      disposition: 'superseded_by_selected_source',
      projected: false,
      selected_verification: { verified: false },
      alternate_verification: { verified: true, verified_by: 'researcher' },
      comparison: {
        exact_major_core_match: false,
        exact_requirement_semantics_match: false,
        differing_requirement_fields: expect.arrayContaining(['unit_facts']),
      },
      safe: false,
      issues: [
        'verified_alternate_replaced_by_unverified_source',
        'verified_alternate_major_core_not_reverified',
      ],
    });
    for (const hash of [
      dispositions[0].comparison.selected_major_core_sha256,
      dispositions[0].comparison.alternate_major_core_sha256,
      dispositions[0].comparison.selected_requirement_semantics_sha256,
      dispositions[0].comparison.alternate_requirement_semantics_sha256,
    ]) expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejoins non-catalog alternates after the official-only evidence overlay', () => {
    const official = asSource({ _id: 'official' });
    const legacy = asSource({
      _id: 'legacy',
      source: 'transferva_program_map',
      source_method: null,
      verification: { verified: true },
    });
    const overlaidOfficial = structuredClone(official);
    overlaidOfficial.course_unit_evidence = [{ code: 'CSC221', units: 3 }];

    const result = operationalVirginiaDegreeSources(
      [official, legacy],
      [overlaidOfficial],
    );
    expect(result).toHaveLength(2);
    expect(result.find((row) => row._id === 'official')?.course_unit_evidence)
      .toEqual([{ code: 'CSC221', units: 3 }]);
    expect(result.find((row) => row._id === 'legacy')).toEqual(legacy);
  });

  it('preserves Western AND-inside-OR routes and source-authored group metadata', () => {
    const source = asSource({
      requirement_groups: [{
        title: 'Laboratory science sequence',
        source_refs: ['major'],
        analysis_constraints: [{ kind: 'complete_one_route', status: 'supported' }],
        stated_credits: '8',
        sections: [{
          section_advisement: 1,
          unit_advisement: 8,
          unit_advisement_max: 8,
          source_refs: ['major'],
          receivers: [{
            receiving: null,
            articulation_status: 'articulated',
            options_conjunction: 'or',
            options: [
              {
                course_ids: [101, 102],
                course_keys: ['va:CHM111', 'va:CHM112'],
                course_conjunction: 'and',
              },
              {
                course_ids: [201, 202],
                course_keys: ['va:PHY241', 'va:PHY242'],
                course_conjunction: 'and',
              },
            ],
          }],
        }],
      }],
    });
    const before = structuredClone(source);

    const [science] = projectGroups(source);

    expect(source).toEqual(before);
    expect(science).toMatchObject({
      group_id: 'laboratory_science_sequence',
      label_seen: 'Laboratory science sequence',
      title: 'Laboratory science sequence',
      group_conjunction: 'And',
      source: 'extracted',
      confidence: 0.97,
      source_refs: ['major'],
      analysis_constraints: [{ kind: 'complete_one_route', status: 'supported' }],
      stated_credits: '8',
      ge_area: null,
      units_fill: false,
      unresolved_courses_seen: [],
    });
    const receiver = science.sections[0].receivers[0];
    expect(receiver.options_conjunction).toBe('or');
    const expectedIds = [
      ['CHM111', 'CHM112'], ['PHY241', 'PHY242'],
    ].map((route) => route.map((code) => sharedCourseIdentity(code).course_id));
    expect(receiver.options.map((option) => option.course_ids)).toEqual([
      ...expectedIds,
    ]);
    expect(receiver.options.map((option) => option.course_conjunction)).toEqual(['and', 'and']);
    expect(receiver.options.map((option) => option.course_keys)).toEqual([
      expectedIds[0].map((id) => `cc:${id}`),
      expectedIds[1].map((id) => `cc:${id}`),
    ]);
    expect(receiver.options.map((option) => option.source_course_keys)).toEqual([
      ['va:CHM111', 'va:CHM112'], ['va:PHY241', 'va:PHY242'],
    ]);
  });

  it('honors structural conjunctions and never infers OR from a label', () => {
    const groups = projectGroups(asSource({
      requirement_groups: [
        {
          title: 'Catalog-authored track choice',
          group_conjunction: 'Or',
          sections: [{ receivers: [] }, { receivers: [] }],
        },
        {
          title: 'X or Y appears only in prose',
          group_conjunction: 'And',
          sections: [{ receivers: [] }, { receivers: [] }],
        },
      ],
    }));

    expect(groups.map((group) => group.group_conjunction)).toEqual(['Or', 'And']);
    expect(groups.map((group) => group.sections)).toHaveLength(2);
  });

  it('remints legacy wrappers under an authored institution-local namespace', () => {
    const owner = 'va:cc:richard-bland-college';
    const namespace = {
      kind: 'institution_local',
      institution_id: owner,
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: `${owner}:<code>`,
    };
    const shared = sharedCourseIdentity('HIST248');
    const local = institutionCourseIdentity(owner, 'HIST248');
    const source = asSource({
      _id: 'va:as:richard-bland-college:cs',
      community_college_id: owner,
      college_id: owner,
      course_namespace: namespace,
      codes_seen: ['HIST248'],
      course_titles: { HIST248: 'Modern Germany' },
      requirement_groups: [{
        title: 'U.S. and World Cultures',
        sections: [{
          section_advisement: 1,
          unit_advisement: 3,
          receivers: [{ options: [{
            course_ids: [shared.course_id],
            course_keys: [shared.course_key],
            course_conjunction: 'and',
          }] }],
        }],
      }],
    });

    const [group] = projectGroups(source);
    expect(group.sections[0].receivers[0].options[0]).toMatchObject({
      course_ids: [local.course_id],
      course_keys: [`cc:${local.course_id}`],
      source_course_keys: [local.course_key],
      legacy_source_course_keys: [shared.course_key],
    });
    expect(localSendingCourses(source, {
      collegeId: 9317,
      collegeName: 'Richard Bland College',
    })).toEqual([expect.objectContaining({
      course_id: local.course_id,
      course_key: local.course_key,
      institution_id: owner,
      title: 'Modern Germany',
      units: 3,
    })]);
  });

  it('retains GE/fill groups and records unresolved or empty substantive asks', () => {
    const groups = projectGroups(asSource({
      requirement_groups: [
        {
          title: 'Transfer core', ge_area: 'va_destination_aligned_transfer_core',
          sections: [{ unit_advisement: 16, receivers: [] }],
        },
        { title: 'Remaining degree electives', units_fill: true, sections: [] },
        {
          title: 'Named course gap',
          unresolved_courses_seen: ['CSC 205'],
          sections: [{
            unit_advisement: 3,
            receivers: [{
              receiving: { kind: 'category', name: 'CSC 205', units: 3 },
              options: [],
              human_review: 'catalog identity unresolved',
            }],
          }],
        },
        { title: 'Substantive published block', stated_credits: '15', sections: [] },
      ],
    }));

    expect(groups).toHaveLength(4);
    expect(groups[0]).toMatchObject({
      ge_area: 'va_destination_aligned_transfer_core',
      sections: [{ unit_advisement: 16, receivers: [] }],
    });
    expect(groups[1]).toMatchObject({ units_fill: true, sections: [] });
    expect(groups[2].sections[0].receivers).toEqual([]);
    expect(groups[2].unresolved_courses_seen.map((row) => row.course_code_seen))
      .toEqual(['CSC 205', 'CSC 205']);
    expect(groups[2].unresolved_courses_seen[1]).toMatchObject({
      units_seen: 3,
      reason: 'no_resolved_course_option',
      source_receiver: { human_review: 'catalog identity unresolved' },
    });
    expect(groups[3]).toMatchObject({
      title: 'Substantive published block', stated_credits: '15', sections: [],
      unresolved_courses_seen: [{
        course_code_seen: 'Substantive published block',
        reason: 'empty_substantive_requirement_group',
      }],
    });
  });

  it('carries acceptance, verification, provenance, and non-course rules onto the selected document', () => {
    const source = asSource({
      acceptance: {
        accepted: true,
        ready_for_analysis: true,
        analysis_ready: { failed: [] },
      },
      verification: { verified: true, verified_by_label: 'Researcher' },
      research_status: 'human_verified',
      provenance: { source_bundle_hash: 'abc123' },
      non_course_requirements_seen: [{
        label_seen: 'Minimum 2.0 curriculum GPA', source_refs: ['graduation'],
      }],
      requirement_groups: [{
        title: 'Core', sections: [{ receivers: [{
          receiving: null,
          options: [{ course_ids: [301], course_keys: ['va:CSC221'], course_conjunction: 'and' }],
        }] }],
      }],
    });

    const projection = buildProjection({
      courses: [], degrees: [], asDegrees: [source],
      institutions: [{
        _id: 'va:cc:virginia-western-community-college',
        level: 'community_college', name: 'Virginia Western Community College',
      }],
    });

    expect(projection.asDegrees).toHaveLength(1);
    expect(projection.asDegrees[0]).toMatchObject({
      status: 'found',
      va_requirement_status: 'extracted',
      analysis_ready: true,
      acceptance: source.acceptance,
      verification: source.verification,
      provenance: source.provenance,
      research_status: 'human_verified',
      non_course_requirements_seen: source.non_course_requirements_seen,
    });
  });

  it('carries the explicit acceptance verdict onto projected bachelor documents too', () => {
    const degree = {
      _id: 'va:degree:bridgewater-college:cs',
      kind: 'degree',
      status: 'extracted',
      institution_id: 'va:uni:bridgewater-college',
      source: 'institution_catalog',
      source_method: 'official_catalog_composition',
      program: 'Bachelor of Science in Computer Science',
      catalog_year: '2026-2027',
      total_units: 120,
      acceptance: { accepted: true, ready_for_analysis: true },
      verification: { verified: true },
      research_status: 'human_verified',
      provenance: { source_bundle_hash: 'degree-hash' },
      course_titles: { CS101: 'Introduction to Computing' },
      course_unit_evidence: [{
        code: 'CS101', units: 3, min_units: 3, max_units: 3,
        evidence: 'official_course_row',
      }],
      requirement_groups: [{
        title: 'Choose a lower-division route',
        group_conjunction: 'Or',
        sections: [{
          section_advisement: 1,
          unit_advisement: 3,
          cc_articulable: true,
          receivers: [{
            receiving: { kind: 'course', parent_id: courseIdFor('CS101'), units: 3 },
            code_seen: 'CS101',
          }],
        }],
      }],
    };
    const projection = buildProjection({
      courses: [{
        course_id: 401,
        course_key: 'va:CSC101',
        code: 'CSC101',
        title: 'Introduction to Computer Science',
        credits: 3,
        offered_by: ['Blue Ridge Community College'],
        articulates_to: [{ institution: 'Bridgewater College', identifier: 'CS101' }],
      }],
      degrees: [degree],
      asDegrees: [],
      institutions: [
        { _id: 'va:cc:blue-ridge-community-college', level: 'community_college', name: 'Blue Ridge Community College' },
        { _id: 'va:uni:bridgewater-college', level: 'four_year', name: 'Bridgewater College' },
      ],
    });

    expect(projection.degrees).toHaveLength(1);
    expect(projection.degrees[0]).toMatchObject({
      program: 'Computer Science, B.S.',
      source_program: 'Bachelor of Science in Computer Science',
      analysis_ready: true,
      acceptance: degree.acceptance,
      verification: degree.verification,
      research_status: 'human_verified',
      provenance: degree.provenance,
      va_requirement_status: 'extracted',
      requirement_groups: [{
        title: 'Choose a lower-division route', group_conjunction: 'Or',
        category: 'lower-division',
        sections: [{ category: 'lower-division' }],
      }],
    });
    const owner = `va:uni:${projection.degrees[0].school_id}`;
    const parentId = institutionCourseIdFor(owner, 'CS101');
    expect(projection.degrees[0].requirement_groups[0].sections[0]
      .receivers[0].receiving.parent_id).toBe(parentId);
    expect(projection.agreements[0].requirement_groups[0].sections[0]
      .receivers[0].receiving.parent_id).toBe(parentId);
    expect(projection.courses).toContainEqual(expect.objectContaining({
      side: 'receiving', institution_id: owner, code: 'CS101',
      parent_id: parentId, source_parent_id: courseIdFor('CS101'),
      min_units: 3, max_units: 3,
    }));
  });

  it('does not collapse same-code receiving courses with different owners or units', () => {
    const makeDegree = (slug, units) => ({
      _id: `va:degree:${slug}:cs`,
      kind: 'degree', status: 'extracted', institution_id: `va:uni:${slug}`,
      source: 'institution_catalog', source_method: 'official_catalog_composition',
      program: 'Computer Science, B.S.', total_units: 120,
      acceptance: { accepted: true, ready_for_analysis: true },
      course_titles: { CS101: `${slug} Programming I` },
      course_unit_evidence: [{
        code: 'CS101', units, min_units: units, max_units: units,
        evidence: 'official_course_row',
      }],
      requirement_groups: [{
        title: 'Core', group_conjunction: 'And', sections: [{
          section_advisement: 1, unit_advisement: units, cc_articulable: true,
          receivers: [{
            code_seen: 'CS101',
            receiving: { kind: 'course', parent_id: courseIdFor('CS101'), units },
          }],
        }],
      }],
    });
    const colleges = [{
      _id: 'va:cc:blue-ridge-community-college', level: 'community_college',
      name: 'Blue Ridge Community College',
    }];
    const universities = [
      { _id: 'va:uni:bridgewater-college', level: 'four_year', name: 'Bridgewater College' },
      { _id: 'va:uni:christopher-newport-university', level: 'four_year', name: 'Christopher Newport University' },
    ];
    const sending = sharedCourseIdentity('CSC101');
    const value = buildProjection({
      courses: [{
        ...sending,
        title: 'Introduction to Computer Science', credits: 3,
        offered_by: ['Blue Ridge Community College'],
        articulates_to: universities.map((row) => ({
          institution: row.name, identifier: 'CS101',
        })),
      }],
      degrees: [
        makeDegree('bridgewater-college', 3),
        makeDegree('christopher-newport-university', 4),
      ],
      asDegrees: [],
      institutions: [...colleges, ...universities],
    });

    const receiving = value.courses.filter((row) => row.side === 'receiving');
    expect(receiving).toHaveLength(2);
    expect(new Set(receiving.map((row) => row.parent_id)).size).toBe(2);
    expect(receiving.map((row) => [row.institution_id, row.min_units])).toEqual([
      ['va:uni:9205', 3],
      ['va:uni:9206', 4],
    ]);
    expect(receiving.every((row) => row.source_parent_id === courseIdFor('CS101')))
      .toBe(true);
    for (const degree of value.degrees) {
      const parentId = degree.requirement_groups[0].sections[0]
        .receivers[0].receiving.parent_id;
      expect(value.courses.filter((row) => (
        row.parent_id === parentId && row.institution_id === degree.institution_id
      ))).toHaveLength(1);
    }
    for (const agreement of value.agreements) {
      const owner = `va:uni:${agreement.uc_school_id}`;
      const parentId = agreement.requirement_groups[0].sections[0]
        .receivers[0].receiving.parent_id;
      expect(value.courses.filter((row) => (
        row.parent_id === parentId && row.institution_id === owner
      ))).toHaveLength(1);
    }
  });

  it('does not copy an aggregate series total onto component course rows', () => {
    const owner = 'va:uni:9205';
    const source = {
      _id: 'va:degree:bridgewater-college:cs',
      course_titles: {
        CS101: 'Programming I',
        MATH101: 'College Mathematics',
      },
      course_unit_evidence: [{
        code: 'CS101', units: 3, min_units: 3, max_units: 3,
        evidence: 'official_course_row', source_refs: ['course_catalog'],
      }],
      requirement_groups: [{ sections: [{ receivers: [{
        code_seen: 'CS101 + MATH101',
        receiving: {
          kind: 'series',
          parent_ids: [courseIdFor('CS101'), courseIdFor('MATH101')],
          units: 7,
        },
      }] }] }],
    };
    const projectedGroups = projectInstitutionReceivingGroups(
      source.requirement_groups,
      owner,
    );
    const rows = receivingCourses(source, projectedGroups, owner);

    expect(source.requirement_groups[0].sections[0]
      .receivers[0].receiving.units).toBe(7);
    expect(projectedGroups[0].sections[0].receivers[0].receiving.units).toBe(7);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CS101', title: 'Programming I', units: 3, min_units: 3, max_units: 3,
        unit_evidence: 'official_course_row',
      }),
      expect.objectContaining({
        code: 'MATH101', title: 'College Mathematics',
        units: null, min_units: null, max_units: null,
        unit_evidence: 'not_individually_stated',
      }),
    ]));
    expect(rows.reduce((sum, row) => sum + Number(row.min_units || 0), 0)).toBe(3);
  });

  it('adds only the owning college offering proved by its selected official degree', () => {
    const sending = sharedCourseIdentity('CSC101');
    const associate = asSource({
      _id: 'va:as:blue-ridge-community-college:cs',
      community_college_id: 'va:cc:blue-ridge-community-college',
      college_id: 'va:cc:blue-ridge-community-college',
      codes_seen: ['CSC101'],
      course_titles: { CSC101: 'Introduction to Computer Science' },
      requirement_groups: [{
        title: 'Core', group_conjunction: 'And', source_refs: ['program'],
        sections: [{
          section_advisement: 1, unit_advisement: 3, source_refs: ['program'],
          receivers: [{ options: [{
            course_ids: [sending.course_id], course_keys: [sending.course_key],
            course_conjunction: 'and',
          }] }],
        }],
      }],
      requirement_variants: [{
        id: 'inactive-ba', selected: false,
        requirement_groups: [{
          title: 'Inactive alternative', group_conjunction: 'And',
          sections: [{ receivers: [{ options: [{
            course_ids: [sending.course_id],
            course_keys: [sending.course_key],
            course_conjunction: 'and',
          }] }] }],
        }],
      }],
    });
    const degree = {
      _id: 'va:degree:bridgewater-college:cs', kind: 'degree', status: 'extracted',
      institution_id: 'va:uni:bridgewater-college', total_units: 120,
      course_titles: { CS101: 'Programming I' },
      course_unit_evidence: [{ code: 'CS101', units: 3 }],
      requirement_groups: [{
        title: 'Core', group_conjunction: 'And', sections: [{
          section_advisement: 1, unit_advisement: 3, cc_articulable: true,
          receivers: [{
            code_seen: 'CS101',
            receiving: { kind: 'course', parent_id: courseIdFor('CS101'), units: 3 },
          }],
        }],
      }],
    };
    const value = buildProjection({
      courses: [{
        ...sending,
        title: 'Introduction to Computer Science', credits: 3, offered_by: [],
        source_url: 'https://www.transfervirginia.org/course/ABC123',
        articulates_to: [{
          institution: 'Bridgewater College', identifier: 'CS101',
          name: 'Programming I', notes: null,
        }],
      }],
      degrees: [degree],
      asDegrees: [associate],
      institutions: [
        { _id: 'va:cc:blue-ridge-community-college', level: 'community_college', name: 'Blue Ridge Community College' },
        { _id: 'va:cc:central-virginia-community-college', level: 'community_college', name: 'Central Virginia Community College' },
        { _id: 'va:uni:bridgewater-college', level: 'four_year', name: 'Bridgewater College' },
      ],
    });

    expect(value.agreementOfferingAugmentation).toMatchObject({
      contract: 'va-associate-requirement-course-offer-v1',
      added_offerings: 1,
      receipts: [{
        source_requirement_id: associate._id,
        community_college_id: 9301,
        college_name: 'Blue Ridge Community College',
        course_id: sending.course_id,
        code: 'CSC101',
      }],
    });
    const blueRidge = value.agreements.find((row) => row.community_college_id === 9301);
    const central = value.agreements.find((row) => row.community_college_id === 9303);
    expect(blueRidge).toMatchObject({
      articulated_receivers: 1,
      source_named_offerings_count: 1,
      source_named_offerings: [{
        source_requirement_id: associate._id,
        community_college_id: 9301,
        course_id: sending.course_id,
      }],
    });
    expect(central).toMatchObject({
      articulated_receivers: 0,
      source_named_offerings_count: 0,
      source_named_offerings: [],
    });
    expect(blueRidge.source_named_offerings_sha256).toBe(
      createHash('sha256')
        .update(JSON.stringify(blueRidge.source_named_offerings))
        .digest('hex'),
    );
    expect(value.courses.find((row) => row.side === 'sending')).toMatchObject({
      course_id: sending.course_id,
      offered_by_ids: [9301],
    });
    expect(value.courses.find((row) => row.side === 'sending').offered_by_ids)
      .not.toContain(9303);
    expect(value.asDegrees[0].requirement_variants[0]).toMatchObject({
      id: 'inactive-ba',
      selected: false,
      requirement_groups: [{ sections: [{ receivers: [{ options: [{
        course_ids: [sending.course_id],
        course_keys: [`cc:${sending.course_id}`],
        source_course_keys: [sending.course_key],
      }] }] }] }],
    });
  });

  it('fails closed on conflicting exact receiving-course unit evidence', () => {
    const owner = 'va:uni:9205';
    const source = {
      _id: 'va:degree:bridgewater-college:cs',
      course_titles: { CS101: 'Programming I' },
      course_unit_evidence: [
        { code: 'CS101', units: 3 },
        { code: 'CS101', units: 4 },
      ],
      requirement_groups: [{ sections: [{ receivers: [{
        code_seen: 'CS101',
        receiving: {
          kind: 'course', parent_id: courseIdFor('CS101'), units: 3,
        },
      }] }] }],
    };
    const projectedGroups = projectInstitutionReceivingGroups(
      source.requirement_groups,
      owner,
    );
    expect(() => receivingCourses(source, projectedGroups, owner))
      .toThrow(/conflicting Virginia receiving unit evidence/);
  });

  it('accounts for a degree owner absent from the equivalency institution corpus', () => {
    const degree = {
      _id: 'va:degree:university-of-virginia:cs',
      kind: 'degree',
      status: 'extracted',
      institution_id: 'va:uni:university-of-virginia',
      school: 'University of Virginia',
      source_url: 'https://records.ureg.virginia.edu/program',
      requirement_groups: [],
    };

    const projection = buildProjection({
      courses: [],
      degrees: [degree],
      asDegrees: [],
      institutions: [],
    });

    expect(projection.withoutEquivalencies).toEqual([{
      degree_id: degree._id,
      reason: 'no published course equivalencies',
    }]);
  });
});
