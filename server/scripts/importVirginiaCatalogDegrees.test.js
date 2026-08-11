import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { courseIdFor } from '../services/virginia/courseIdentity';
import {
  acceptedCompositionPublication,
  assertPrimaryPublicationCohort,
  canonicalSections,
  coverageRow,
  coverageReplacementFilter,
  parseCliArgs,
  receiversForRow,
  retiredRequirementIds,
  requirementGroups,
  replacementRevision,
  selectedInstitutions,
  sourceBundleHash,
  supersededCatalogPatch,
  toDocument,
  unpublishedRequirementIds,
  verificationForSourceBundle,
  verifiedImportConflict,
} from './importVirginiaCatalogDegrees';

const course = (code, title = code) => ({ code, title });

describe('Virginia catalog requirement conversion', () => {
  it('defaults to no-write and rejects ambiguous or misspelled publication flags', () => {
    expect(parseCliArgs([], {})).toMatchObject({ apply: false, dryRun: true });
    expect(() => parseCliArgs(['--accepted-compositons-only', '--apply'], {}))
      .toThrow(/unknown option/);
    expect(() => parseCliArgs(['--apply'], { MONGO_URI: 'mongodb://example', DB_NAME: 'db' }))
      .toThrow(/accepted-compositions-only/);
    expect(() => parseCliArgs([
      '--accepted-compositions-only', '--apply', '--dry-run',
    ], { MONGO_URI: 'mongodb://example', DB_NAME: 'db' })).toThrow(/mutually exclusive/);
    expect(() => parseCliArgs(['--accepted-compositions-only', '--apply'], {}))
      .toThrow(/--uri or MONGO_URI/);
    expect(() => parseCliArgs(['--accepted-compositions-only', '--only', ' , '], {}))
      .toThrow(/at least one complete institution slug/);
    expect(() => parseCliArgs(['--allow-verified-supersede'], {}))
      .toThrow(/valid only with --apply/);
    expect(() => parseCliArgs(['--allow-verified-reopen'], {}))
      .toThrow(/valid only with --apply/);
    expect(parseCliArgs([
      '--accepted-compositions-only', '--apply', '--uri', 'mongodb://example', '--db', 'research',
    ], {})).toMatchObject({
      apply: true,
      dryRun: false,
      acceptedCompositionsOnly: true,
      uri: 'mongodb://example',
      dbName: 'research',
    });
  });

  it('selects --only institutions by exact slug and rejects prefixes or duplicates', () => {
    const institutions = [
      { slug: 'virginia-state-university' },
      { slug: 'virginia-tech' },
    ];
    expect(selectedInstitutions(institutions, ['virginia-tech'])).toEqual([institutions[1]]);
    expect(() => selectedInstitutions(institutions, ['virginia']))
      .toThrow(/unknown institution slug/);
    expect(() => selectedInstitutions(institutions, ['virginia-tech', 'virginia-tech']))
      .toThrow(/duplicate slugs/);
  });

  it('keeps every member of an AND sequence and models OR as receiver alternatives', () => {
    const and = receiversForRow({
      codes: [course('CHEM211'), course('CHEM213')], conjunction: 'and', credits: { min: 4, max: 4 },
    }, { cc: false, layer: 'major' });
    expect(and).toHaveLength(1);
    expect(and[0].receiving).toEqual({
      kind: 'series', conjunction: 'and',
      parent_ids: [courseIdFor('CHEM211'), courseIdFor('CHEM213')], units: 4,
    });

    const or = receiversForRow({
      codes: [course('CS471'), course('CS571')], conjunction: 'or', credits: { min: 3, max: 3 },
    }, { cc: false, layer: 'major' });
    expect(or.map((receiver) => receiver.receiving)).toEqual([
      { kind: 'course', parent_id: courseIdFor('CS471'), units: 3 },
      { kind: 'course', parent_id: courseIdFor('CS571'), units: 3 },
    ]);
  });

  it('makes ordinary fixed rows explicit required slots and joins a marked OR alternative', () => {
    const tree = {
      groups: [{
        title: 'Computer Science Core', credits: null, sections: [{
          choose: null, credits: null, rows: [
            { codes: [course('CS112')], conjunction: 'and' },
            { codes: [course('CS108'), course('CS109')], conjunction: 'and', alternative_to_previous: true },
            { codes: [course('CS211')], conjunction: 'and' },
          ],
        }],
      }],
    };
    const [group] = requirementGroups(tree, {
      cc: false, creditsByCode: new Map(), availableSourceIds: new Set(['major']),
    });
    expect(group.sections).toHaveLength(2);
    expect(group.sections[0].section_advisement).toBe(1);
    expect(group.sections[0].receivers.map((receiver) => receiver.receiving.kind)).toEqual(['course', 'series']);
    expect(group.sections[1].section_advisement).toBe(1);
  });

  it('copies fixed-row credits into explicit section unit advisement', () => {
    const [group] = requirementGroups({
      groups: [{
        title: 'Computer Science Core', credits: null, sections: [{
          choose: null, credits: null, rows: [{
            codes: [course('CS112')], conjunction: 'and', credits: { min: 3, max: 3 },
          }],
        }],
      }],
    }, {
      cc: false,
      // A conflicting VCCS figure must not matter when the university printed 3.
      creditsByCode: new Map([['CS112', 9]]),
      availableSourceIds: new Set(['major']),
    });

    expect(group.sections[0]).toMatchObject({
      section_advisement: 1,
      unit_advisement: 3,
      receivers: [{ receiving: { kind: 'course', units: 3 } }],
    });

    const [groupTotal] = requirementGroups({
      groups: [{
        title: 'Capstone', credits: { min: 4, max: 4, raw: '4' }, sections: [{
          choose: null, credits: null, rows: [{ codes: [course('CS499')], conjunction: 'and' }],
        }],
      }],
    }, {
      cc: false,
      creditsByCode: new Map([['CS499', 1]]),
      availableSourceIds: new Set(['major']),
    });
    expect(groupTotal.sections[0].unit_advisement).toBe(4);
  });

  it('never borrows a same-code VCCS credit figure for a four-year course', () => {
    const parsed = {
      title: 'Computer Science Core', credits: null, sections: [{
        choose: null, credits: null, rows: [{ codes: [course('CS112')], conjunction: 'and' }],
      }],
    };
    const [university] = requirementGroups({ groups: [parsed] }, {
      cc: false,
      creditsByCode: new Map([['CS112', 4]]),
      availableSourceIds: new Set(['major']),
    });
    const [college] = requirementGroups({ groups: [parsed] }, {
      cc: true,
      creditsByCode: new Map([['CS112', 4]]),
      availableSourceIds: new Set(['major']),
    });

    expect(university.sections[0].unit_advisement).toBeNull();
    expect(university.sections[0].receivers[0].receiving.units).toBeNull();
    expect(college.sections[0].unit_advisement).toBe(4);

    const menu = {
      title: 'Choose one elective', credits: { min: 4, max: 4, raw: '4' },
      sections: [{ choose: null, credits: null, rows: [
        { codes: [course('CS112')], conjunction: 'and' },
        { codes: [course('CS211')], conjunction: 'and' },
      ] }],
    };
    const [universityMenu] = requirementGroups({ groups: [menu] }, {
      cc: false,
      creditsByCode: new Map([['CS112', 4], ['CS211', 4]]),
      availableSourceIds: new Set(['major']),
    });
    const [collegeMenu] = requirementGroups({ groups: [menu] }, {
      cc: true,
      creditsByCode: new Map([['CS112', 4], ['CS211', 4]]),
      availableSourceIds: new Set(['major']),
    });
    expect(universityMenu.advisement_basis).toBeNull();
    expect(universityMenu.group_unit_advisement).toBeNull();
    expect(collegeMenu).toMatchObject({
      advisement_basis: 'inferred_menu', group_unit_advisement: 4,
    });
  });

  it('uses stable VA course IDs and keys for an AS alternative', () => {
    const [receiver] = receiversForRow({
      codes: [course('CSC208'), course('MTH288')], conjunction: 'or', credits: { min: 3, max: 3 },
    }, { cc: true, layer: 'associate_degree' });
    expect(receiver.receiving).toBeNull();
    expect(receiver.options_conjunction).toBe('or');
    expect(receiver.options).toEqual([
      { course_ids: [courseIdFor('CSC208')], course_conjunction: 'and', course_keys: ['va:CSC208'] },
      { course_ids: [courseIdFor('MTH288')], course_conjunction: 'and', course_keys: ['va:MTH288'] },
    ]);
  });

  it('uses canonical university-only requirements and blocks unenumerated CC rows', () => {
    const row = {
      codes: [], category: 'Technical electives', text: 'Eight technical elective credits',
      credits: { min: 8, max: 8 },
    };
    const [university] = receiversForRow(row, { cc: false, layer: 'electives' });
    expect(university).toMatchObject({
      receiving: {
        kind: 'requirement', parent_id: null, name: 'Technical electives', units: 8,
      },
      cc_articulable: false,
      options: [],
    });

    const [college] = receiversForRow(row, { cc: true, layer: 'associate_degree' });
    expect(college).toMatchObject({
      receiving: null,
      articulation_status: 'not_articulated',
      not_articulated_reason: 'no_course_list_published',
      options: [],
      unresolved: true,
      cc_articulable: false,
    });

    const [section] = canonicalSections({ title: 'Technical electives', sections: [{ rows: [row] }] }, {
      cc: false, layer: 'electives', sourceRefs: ['major'], creditsByCode: new Map(),
    });
    expect(section).toMatchObject({ unit_advisement: 8, cc_articulable: false });
  });

  it('keeps published unit research separate from a composed unit audit', () => {
    const extract = {
      outcome: 'captured', parser: 'courseleaf', program_title: 'Computer Science, BS',
      source_url: 'https://catalog.example.edu/cs/', catalog_year: '2026-2027',
      total_credits: { min: 120, max: 120 },
      degree_context: {
        award: 'BS', college: 'Engineering', academic_unit: 'Computer Science',
        general_education_authority: 'University Core', unit_audit: { graduation_minimum: 120, modeled_units: 120 },
      },
      sources: [
        { id: 'major', kind: 'major', url: 'https://catalog.example.edu/cs/', sha256: 'a' },
        { id: 'graduation', kind: 'graduation', url: 'https://catalog.example.edu/policies/', sha256: 'b' },
      ],
      source_layers: { major: { status: 'captured', source_refs: ['major'] } },
      groups: [{
        title: 'Core', credits: { min: 3, max: 3, raw: '3' }, source_text: [],
        sections: [{ choose: null, credits: null, rows: [{ codes: [course('CS101')], conjunction: 'and' }] }],
      }],
    };
    const doc = toDocument(extract, {
      slug: 'example-university', name: 'Example University', level: 'four_year', platform: 'courseleaf',
    }, new Map());
    expect(doc).toMatchObject({
      catalog_year: '2026-2027', college: 'Engineering', academic_unit: 'Computer Science',
      ge_authority: 'University Core', unit_audit: null,
      published_unit_audit: { graduation_minimum: 120, modeled_units: 120 },
      collection_status: 'major_only',
    });
    expect(doc.sources.map((source) => source.id)).toEqual(['major', 'graduation']);
    expect(doc.requirement_groups[0].source_refs).toEqual(['major']);
    expect(doc.capture_layers).toEqual(extract.source_layers);
    expect(doc.requirement_layers).toBeNull();
    expect(doc).not.toHaveProperty('source_layers');
    expect(doc.provenance.source_bundle_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('publishes exact source-composed option dictionaries on the API document', () => {
    const extract = {
      outcome: 'captured', parser: 'lines', program_title: 'Computer Science, AS',
      source_url: 'https://catalog.example.edu/cs/', catalog_year: '2026-2027',
      // This is a parser subtotal, not the composed whole-degree maximum.
      total_credits: { min: 3, max: 6 },
      sources: [{
        id: 'major', kind: 'major', label: 'Program requirements',
        url: 'https://catalog.example.edu/cs/', sha256: 'bytes',
      }],
      source_layers: { major: { status: 'captured', source_refs: ['major'] } },
      groups: [{ title: 'Parsed source evidence', sections: [] }],
    };
    const composition = {
      schema_version: 1,
      slug: 'example-community-college',
      program: 'Computer Science, Associate of Science',
      award: 'AS',
      catalog_year: '2026-2027',
      total_units: 3,
      composition_status: 'composed_full_degree',
      source_bundle_required: ['major'],
      option_sets: {
        transfer_electives: {
          source_refs: ['major'],
          required_credits: 3,
          courses: ['CSC205', 'MTH288'],
        },
      },
      course_titles: { CSC205: 'Computer Organization', MTH288: 'Discrete Mathematics' },
      requirement_groups: [{
        title: 'Programming', source_refs: ['major'], sections: [{
          select: 1, units: 3, receivers: [{ kind: 'cc_course', options: [['CSC205']] }],
        }],
      }],
    };
    const doc = toDocument(extract, {
      slug: 'example-community-college', name: 'Example Community College',
      level: 'community_college', platform: 'acalog',
    }, new Map([['CSC205', 3], ['MTH288', 3]]), composition);

    expect(doc.option_sets).toEqual(composition.option_sets);
    expect(doc.course_titles).toMatchObject(composition.course_titles);
    expect(doc.total_units).toBe(3);
    expect(doc.total_units_max).toBeNull();
  });

  it('reopens verification when the official source bundle changes', () => {
    const first = {
      catalog_year: '2026-2027',
      sources: [{ id: 'major', url: 'https://catalog.example.edu/cs/', sha256: 'bytes-a' }],
    };
    const second = {
      ...first,
      sources: [{ id: 'major', url: 'https://catalog.example.edu/cs/', sha256: 'bytes-b' }],
    };
    const prior = {
      research_status: 'hand_verified',
      provenance: { source_bundle_hash: sourceBundleHash(first) },
      verification: {
        verified: true, verified_by: 'researcher-1', verified_at: '2026-08-01', notes: 'walked',
      },
    };

    const unchanged = verificationForSourceBundle(prior, sourceBundleHash(first));
    expect(unchanged).toMatchObject({
      source_changed: false,
      research_status: 'hand_verified',
      verification: { verified: true, verified_by: 'researcher-1' },
    });

    const changed = verificationForSourceBundle(prior, sourceBundleHash(second));
    expect(changed).toMatchObject({
      source_changed: true,
      research_status: 'source_changed_needs_human_reverification',
      verification: {
        verified: false,
        verified_by: null,
        verified_at: null,
        stale: true,
        stale_reason: 'official source bundle changed after verification',
        previous: { verified: true, verified_by: 'researcher-1' },
      },
    });
  });

  it('includes reviewed composition decisions in the source-bundle identity', () => {
    const extract = {
      catalog_year: '2026-2027',
      sources: [{ id: 'major', sha256: 'captured-bytes' }],
    };
    const first = sourceBundleHash(extract, { schema_version: 1, requirement_groups: [{ title: 'A' }] });
    const second = sourceBundleHash(extract, { schema_version: 1, requirement_groups: [{ title: 'B' }] });
    expect(first).not.toBe(second);
    expect(sourceBundleHash(extract)).toBe(sourceBundleHash(extract));
  });

  it('refuses to replace a verified hand edit while its artifact bundle is unchanged', () => {
    const base = {
      _id: 'va:degree:example:cs',
      provenance: { source_bundle_hash: 'same-bundle' },
      verification: { verified: true, verified_by: 'researcher' },
      requirement_groups: [{ group_id: 'core', title: 'Core' }],
      acceptance: { accepted: true },
      collection_status: 'catalog_accepted',
      research_status: 'hand_verified',
      updated_at: new Date('2026-08-01T00:00:00.000Z'),
    };
    const operationalOnly = {
      ...base,
      verification: { verified: false },
      acceptance: { accepted: false },
      collection_status: 'major_only',
      research_status: 'recomputed',
      updated_at: new Date('2026-08-10T00:00:00.000Z'),
    };
    expect(verifiedImportConflict(base, operationalOnly)).toBe(false);
    expect(verifiedImportConflict(base, {
      ...operationalOnly,
      requirement_groups: [{ group_id: 'core', title: 'Researcher-corrected Core' }],
    })).toBe(true);
    expect(verifiedImportConflict(base, {
      ...operationalOnly,
      provenance: { source_bundle_hash: 'new-bundle' },
      requirement_groups: [{ group_id: 'core', title: 'New source Core' }],
    })).toBe(false);
  });

  it('records reconstructible field changes when an import replaces a catalog document', () => {
    const prior = {
      _id: 'va:degree:example:cs', status: 'extracted', codes_seen: ['CS101'],
      requirement_groups: [{ title: 'Researcher-corrected Core' }],
      provenance: { source_bundle_hash: 'old-bundle' },
    };
    const next = {
      ...prior,
      codes_seen: ['CS101', 'CS102'],
      requirement_groups: [{ title: 'Current Catalog Core' }],
      provenance: { source_bundle_hash: 'new-bundle' },
    };
    const at = new Date('2026-08-10T00:00:00.000Z');
    const revision = replacementRevision(prior, next, at);
    expect(revision).toMatchObject({
      doc_id: prior._id,
      at,
      action: 'replace_catalog_document',
      before: { groups: 1, codes: 1, source_bundle_hash: 'old-bundle' },
      after: { groups: 1, codes: 2, source_bundle_hash: 'new-bundle' },
    });
    expect(revision.changes).toContainEqual({
      path: 'requirement_groups[0].title',
      from: 'Researcher-corrected Core',
      to: 'Current Catalog Core',
    });
  });

  it('requires the exact primary release manifest before a full publication', () => {
    const publicSlugs = Array.from({ length: 15 }, (_, index) => `public-${index + 1}`);
    const positiveColleges = Array.from({ length: 19 }, (_, index) => ({
      slug: `college-${index + 1}`, level: 'community_college',
    }));
    const negativeColleges = Array.from({ length: 5 }, (_, index) => ({
      slug: `negative-${index + 1}`, level: 'community_college', offers_cs: false,
    }));
    const registry = {
      cohorts: { schev_public_four_year: { institution_slugs: publicSlugs } },
      institutions: [
        ...positiveColleges,
        ...negativeColleges,
        ...publicSlugs.map((slug) => ({ slug, level: 'four_year' })),
      ],
    };
    const docs = [
      ...publicSlugs.map((slug) => ({
        _id: `va:degree:${slug}:cs`, kind: 'degree', acceptance: { accepted: true },
      })),
      ...positiveColleges.map(({ slug }) => ({
        _id: `va:as:${slug}:cs`, kind: 'as_degree', acceptance: { accepted: true },
      })),
      ...['bridgewater-college', 'randolph-macon-college', 'shenandoah-university']
        .map((slug) => ({
          _id: `va:degree:${slug}:cs`, kind: 'degree', acceptance: { accepted: true },
        })),
    ];
    const coverage = negativeColleges.map(({ slug }) => ({
      _id: `va:cov:cc:${slug}`, outcome: 'no_cs_program', finding_complete: true,
      publication_applicable: false, collected: true,
    }));

    expect(assertPrimaryPublicationCohort(registry, docs, coverage)).toEqual({
      public_degrees: 15,
      associate_degrees: 19,
      negative_findings: 5,
      secondary_bachelors: 3,
      documents: 37,
    });
    expect(() => assertPrimaryPublicationCohort(registry, docs.slice(1), coverage))
      .toThrow(/missing public degrees/);
    expect(() => assertPrimaryPublicationCohort(registry, docs, coverage.slice(1)))
      .toThrow(/incomplete negative findings/);
  });

  it('replaces only selected coverage rows during a targeted import', () => {
    const rows = [
      { _id: 'va:cov:cc:northern-virginia-community-college' },
      { _id: 'va:cov:uni:george-mason-university' },
    ];
    expect(coverageReplacementFilter(rows, true)).toEqual({
      _id: { $in: rows.map((row) => row._id) },
    });
    expect(coverageReplacementFilter([], true)).toBeNull();
    expect(coverageReplacementFilter(rows, false)).toEqual({
      _id: { $regex: '^va:cov:' },
    });
  });

  it('publishes only an extracted composition that passes the catalog gate', () => {
    const composition = { schema_version: 1 };
    const accepted = {
      source_method: 'official_catalog_composition',
      status: 'extracted',
      acceptance: { accepted: true },
    };

    expect(acceptedCompositionPublication(composition, accepted)).toEqual({
      eligible: true, reason: null,
    });
    expect(acceptedCompositionPublication({
      ...composition,
      course_namespace: {
        kind: 'institution_local',
        institution_id: 'va:cc:richard-bland-college',
        vccs_master_applicable: false,
      },
    }, accepted)).toEqual({
      eligible: false, reason: 'owner_scoped_course_identity_required',
    });
    const ownerScopedNamespace = {
      kind: 'institution_local',
      institution_id: 'va:cc:richard-bland-college',
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: 'va:cc:richard-bland-college:<code>',
    };
    expect(acceptedCompositionPublication({
      ...composition, course_namespace: ownerScopedNamespace,
    }, {
      ...accepted, course_namespace: ownerScopedNamespace,
    })).toEqual({
      eligible: true, reason: null,
    });
    expect(acceptedCompositionPublication(null, {
      ...accepted, source_method: 'scraped_catalog',
    })).toEqual({
      eligible: false, reason: 'source_composition_required',
    });
    expect(acceptedCompositionPublication(composition, {
      ...accepted, status: 'url_only',
    })).toEqual({
      eligible: false, reason: 'current_extraction_required',
    });
    expect(acceptedCompositionPublication(composition, {
      ...accepted, acceptance: { accepted: false },
    })).toEqual({
      eligible: false, reason: 'catalog_acceptance_failed',
    });
  });

  it('keeps parser-only candidates out of collected and accepted coverage totals', () => {
    const institution = {
      slug: 'example-university', name: 'Example University', level: 'four_year',
      catalog_root: 'https://catalog.example.edu/',
    };
    const extract = {
      outcome: 'captured', source_url: 'https://catalog.example.edu/cs/', offers_cs: true,
      program_finding: {
        code: 'broad_science_as_no_cs_specific_curriculum',
        summary: 'A broad Science A.S. exists without a prescribed CS branch.',
      },
      validation: { verdict: 'pass' },
    };
    const parserOnly = {
      source_method: 'scraped_catalog',
      acceptance: {
        accepted: true,
        ready_for_analysis: false,
        catalog: { failed: [] },
        analysis_ready: { failed: ['unit_closure'] },
      },
    };
    const row = coverageRow(institution, extract, false, parserOnly, {
      publication: { eligible: false, reason: 'source_composition_required' },
    });

    expect(row).toMatchObject({
      collected: false,
      source_composed: false,
      publication_eligible: false,
      publication_blocker: 'source_composition_required',
      catalog_accepted: false,
      analysis_ready: false,
      acceptance_failures: { catalog: [], analysis: ['unit_closure'] },
      program_finding: {
        code: 'broad_science_as_no_cs_specific_curriculum',
        summary: 'A broad Science A.S. exists without a prescribed CS branch.',
      },
    });
  });

  it('keeps every negative-finding source ref resolvable through coverage', () => {
    const institution = {
      slug: 'example-college', name: 'Example College', level: 'community_college',
      catalog_root: 'https://catalog.example.edu/',
      degree_context: { catalog_year: '2026-2027' },
    };
    const extract = {
      outcome: 'no_cs_program', offers_cs: false, catalog_year: '2026-2027',
      source_url: 'https://catalog.example.edu/programs/',
      program_finding: {
        code: 'broad_science_as_no_cs_specific_curriculum',
        summary: 'A broad Science A.S. exists without a prescribed CS branch.',
        source_refs: ['catalog_index', 'broad_science_program'],
        alternate_path: { source_refs: ['alternate_program'] },
      },
      sources: [
        {
          id: 'catalog_index', kind: 'catalog_index', label: 'Programs A-Z',
          url: 'https://catalog.example.edu/programs/', captured_at: '2026-08-10T00:00:00.000Z',
          sha256: 'a'.repeat(64), official: true, secure: true,
        },
        {
          id: 'broad_science_program', kind: 'program', label: 'Science, A.S.',
          requested_url: 'https://catalog.example.edu/science-as/',
          final_url: 'https://catalog.example.edu/science/', sha256: 'b'.repeat(64),
          official: true, secure: true,
        },
        {
          id: 'alternate_program', kind: 'program', label: 'Alternate Science path',
          url: 'https://catalog.example.edu/alternate/', sha256: 'c'.repeat(64),
          official: true, secure: true,
        },
        { id: 'unrelated', url: 'https://catalog.example.edu/other/' },
      ],
    };

    const row = coverageRow(institution, extract, false, null, {
      publication: { eligible: false, reason: 'source_composition_required' },
    });

    expect(row.catalog_year).toBe('2026-2027');
    expect(row).toMatchObject({
      collected: true,
      finding_complete: true,
      finding_source_refs_resolved: true,
      publication_applicable: false,
      source_composition_applicable: false,
      publication_eligible: false,
      publication_blocker: null,
      catalog_accepted: false,
    });
    expect(row.finding_sources).toEqual([
      expect.objectContaining({
        id: 'catalog_index', label: 'Programs A-Z',
        url: 'https://catalog.example.edu/programs/', sha256: 'a'.repeat(64),
        official: true, secure: true,
      }),
      expect.objectContaining({
        id: 'broad_science_program', label: 'Science, A.S.',
        url: 'https://catalog.example.edu/science-as/',
        final_url: 'https://catalog.example.edu/science/', sha256: 'b'.repeat(64),
        official: true, secure: true,
      }),
      expect.objectContaining({
        id: 'alternate_program', label: 'Alternate Science path',
        url: 'https://catalog.example.edu/alternate/', sha256: 'c'.repeat(64),
        official: true, secure: true,
      }),
    ]);
    expect(row.finding_sources.map((source) => source.id)).toEqual([
      ...row.program_finding.source_refs,
      ...row.program_finding.alternate_path.source_refs,
    ]);
  });

  it('publishes Richard Bland only with its validated owner-scoped identity contract', () => {
    const composition = JSON.parse(fs.readFileSync(
      new URL('../.va-catalogs/composed/richard-bland-college.json', import.meta.url),
      'utf8',
    ));
    expect(composition.course_namespace).toMatchObject({
      kind: 'institution_local',
      institution_id: 'va:cc:richard-bland-college',
      vccs_master_applicable: false,
    });
    expect(acceptedCompositionPublication(composition, {
      source_method: 'official_catalog_composition',
      status: 'extracted',
      acceptance: { accepted: true },
      course_namespace: composition.course_namespace,
    })).toEqual({
      eligible: true,
      reason: null,
    });
    expect(acceptedCompositionPublication(composition, {
      source_method: 'official_catalog_composition',
      status: 'extracted',
      acceptance: { accepted: true },
    })).toEqual({
      eligible: false,
      reason: 'owner_scoped_course_identity_required',
    });
  });

  it('retires a scoped prior accepted or verified document that is no longer publishable', () => {
    const institutions = [
      { slug: 'accepted-university', level: 'four_year' },
      { slug: 'changed-university', level: 'four_year' },
      { slug: 'already-superseded', level: 'four_year' },
    ];
    const existing = new Map([
      ['va:degree:accepted-university:cs', {
        _id: 'va:degree:accepted-university:cs', source: 'institution_catalog', verification: { verified: true },
      }],
      ['va:degree:changed-university:cs', {
        _id: 'va:degree:changed-university:cs', source: 'institution_catalog', verification: { verified: true },
      }],
      ['va:degree:outside-scope:cs', {
        _id: 'va:degree:outside-scope:cs', verification: { verified: true },
      }],
      ['va:degree:already-superseded:cs', {
        _id: 'va:degree:already-superseded:cs', status: 'superseded',
        source: 'institution_catalog', verification: { verified: false, stale: true },
      }],
      ['va:degree:other-source:cs', {
        _id: 'va:degree:other-source:cs', source: 'transfer_virginia',
      }],
    ]);
    const published = [{ _id: 'va:degree:accepted-university:cs' }];

    expect(unpublishedRequirementIds(existing, institutions, published)).toEqual([
      'va:degree:changed-university:cs',
    ]);
    expect(unpublishedRequirementIds(existing, [institutions[1]], [])).toEqual([
      'va:degree:changed-university:cs',
    ]);
    expect(unpublishedRequirementIds(existing, [{
      slug: 'other-source', level: 'four_year',
    }], [])).toEqual([]);
  });

  it('supersedes registry-retired identities instead of selecting them for deletion', () => {
    const existing = new Map([
      ['va:degree:old-name:cs', {
        _id: 'va:degree:old-name:cs', source: 'institution_catalog', verification: { verified: true },
      }],
      ['va:as:old-name:cs', {
        _id: 'va:as:old-name:cs', source: 'institution_catalog', status: 'superseded',
      }],
      ['va:degree:unrelated:cs', {
        _id: 'va:degree:unrelated:cs', verification: { verified: true },
      }],
    ]);

    expect(retiredRequirementIds(existing, [{
      slug: 'new-name', level: 'four_year', retires: ['old-name'],
    }])).toEqual(['va:degree:old-name:cs']);
  });

  it('reopens verification and preserves the prior verdict when superseding publication', () => {
    const prior = {
      status: 'extracted',
      collection_status: 'catalog_accepted',
      acceptance: { accepted: true, ready_for_analysis: false },
      verification: {
        verified: true,
        verified_by: 'researcher-1',
        verified_by_label: 'Researcher One',
        verified_at: '2026-08-01T00:00:00.000Z',
        notes: 'Source walk complete',
      },
    };
    const at = new Date('2026-08-10T00:00:00.000Z');
    const patch = supersededCatalogPatch(prior, {
      reason: 'catalog_acceptance_failed', at,
    });

    expect(patch).toMatchObject({
      status: 'superseded',
      collection_status: 'superseded',
      research_status: 'unpublished_needs_source_review',
      verification: {
        verified: false,
        verified_by: null,
        verified_at: null,
        stale: true,
        stale_reason: expect.stringContaining('catalog_acceptance_failed'),
        previous: prior.verification,
      },
      unpublication: {
        at,
        by: 'importVirginiaCatalogDegrees',
        reason: 'catalog_acceptance_failed',
        previous_status: 'extracted',
        previous_collection_status: 'catalog_accepted',
        previous_acceptance: prior.acceptance,
      },
      updated_at: at,
    });
    expect(prior.verification.verified).toBe(true);
  });
});
