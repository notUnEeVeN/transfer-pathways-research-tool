const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  artifactDriftIssues,
  courseIdFor,
  classifyCourse,
  loadRichardBlandEvidence,
  prepareCorpus,
  buildArtifacts,
  fetchMasterClosure,
} = require('./buildVirginiaPrerequisites');

describe('Virginia prerequisite artifact builder', () => {
  it('checks generated artifacts byte-for-byte without modifying them', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'va-prerequisite-drift-'));
    const courseOutput = path.join(directory, 'concepts.json');
    const requisiteOutput = path.join(directory, 'requisites.json');
    const artifacts = { concepts: { rows: [{ code: 'CSC221' }] }, requisites: { rows: [] } };
    try {
      fs.writeFileSync(courseOutput, `${JSON.stringify(artifacts.concepts, null, 1)}\n`);
      fs.writeFileSync(requisiteOutput, `${JSON.stringify(artifacts.requisites, null, 1)}\n`);
      expect(artifactDriftIssues(artifacts, { courseOutput, requisiteOutput })).toEqual([]);
      fs.writeFileSync(requisiteOutput, '{}\n');
      expect(artifactDriftIssues(artifacts, { courseOutput, requisiteOutput }))
        .toEqual([`checked-in artifact drift ${requisiteOutput}`]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('applies owner evidence during the crawl so supplemental formulas reach a fixed point', async () => {
    const calls = [];
    const client = {
      mapLimit: async (values, fn) => Promise.all(values.map(fn)),
      getCourse: async (code) => {
        calls.push(code);
        return {
          code, found: false, status: 'missing', groups: [],
          source_url: `https://courses.vccs.edu/courses/${code}`,
          flags: ['no_exact_master_course'],
        };
      },
    };
    const formula = (code, dependency = null) => ({
      code, found: true, status: dependency ? 'parsed' : 'none', flags: [],
      groups: dependency ? [{
        kind: 'prerequisite', formula: 'paths_or__conditions_and', flags: [],
        paths: [{ all_of: [{ type: 'course', code: dependency }] }],
      }] : [],
    });
    const supplements = new Map([
      ['CSC201', formula('CSC201', 'CSC200')],
      ['CSC200', formula('CSC200', 'EGR126')],
    ]);
    const closure = await fetchMasterClosure(client, ['CSC201'], () => {}, supplements);
    expect(calls).toEqual(['CSC201', 'CSC200', 'EGR126']);
    expect([...closure.keys()]).toEqual(['CSC201', 'CSC200', 'EGR126']);
    expect(closure.get('CSC201')).toMatchObject({
      found: true,
      current_vccs_master_evidence: { status: 'missing' },
    });
    expect(closure.get('EGR126')).toMatchObject({ found: false, status: 'missing' });
  });

  it('rejects owner evidence outside the reachable canonical closure', async () => {
    const client = {
      mapLimit: async (values, fn) => Promise.all(values.map(fn)),
      getCourse: async (code) => ({
        code, found: false, status: 'missing', groups: [],
        source_url: `https://courses.vccs.edu/courses/${code}`,
      }),
    };
    await expect(fetchMasterClosure(client, ['CSC201'], () => {}, new Map([
      ['CSC201', { code: 'CSC201', found: true, status: 'none', groups: [] }],
      ['ENG249', { code: 'ENG249', found: true, status: 'none', groups: [] }],
    ]))).rejects.toThrow(/outside the canonical fixed-point closure: ENG249/);
  });

  it('uses the same deterministic Virginia ids and canonical join keys', () => {
    expect(courseIdFor('CSC221')).toBe(courseIdFor('CSC 221'));
    expect(courseIdFor('CSC221')).toBeGreaterThanOrEqual(900000000);
  });

  it('maps the accepted precalculus concepts instead of leaving candidates', () => {
    expect(classifyCourse({ code: 'MTH161', title: 'Precalculus I', supply_kind: 'vccs' }, { found: true }))
      .toMatchObject({ concept: 'precalc_1', review_status: 'reviewed', flags: [] });
    expect(classifyCourse({ code: 'MTH162', title: 'Precalculus II', supply_kind: 'vccs' }, { found: true }))
      .toMatchObject({ concept: 'precalc_2' });
    expect(classifyCourse({ code: 'MTH167', title: 'Precalculus with Trigonometry', supply_kind: 'vccs' }, { found: true }))
      .toMatchObject({ concept: 'precalc_combined' });
  });

  it('records reviewed legacy mappings and explicit legacy null decisions', () => {
    expect(classifyCourse({
      code: 'CSC201', title: null, supply_kind: 'vccs_requirement_scope',
      transfer_record_status: 'no_scope_college_overlap', legacy_review_population: true,
    })).toMatchObject({
      concept: 'cs_1',
      confidence: 0.8, classification_method: 'reviewed_legacy_scope', review_status: 'needs_review',
    });
    expect(classifyCourse({
      code: 'ECON202', title: null, supply_kind: 'richard_bland_scope',
      transfer_record_status: 'no_scope_college_overlap', legacy_review_population: true,
    })).toMatchObject({ concept: 'econ_micro', confidence: 0.8 });
    expect(classifyCourse({
      code: 'SOC202', title: null, supply_kind: 'vccs_requirement_scope',
      transfer_record_status: 'no_scope_college_overlap', legacy_review_population: true,
    })).toMatchObject({
      concept: null, classification_method: 'legacy_examined_null',
      flags: expect.arrayContaining(['legacy_vccs', 'legacy_examined_null', 'ambiguous_partial_legacy']),
    });
    expect(classifyCourse({
      code: 'OLD100', title: null, supply_kind: 'vccs_requirement_scope',
      transfer_record_status: 'missing', legacy_review_population: true,
    })).toMatchObject({
      concept: null, classification_method: 'legacy_examined_null', review_status: 'needs_review',
    });
  });

  it('extracts authoritative Richard Bland identities without trusting same-code VCCS titles', () => {
    const evidence = loadRichardBlandEvidence();
    expect(evidence.get('ART231')).toMatchObject({
      title: 'Art Appreciation', source: 'richard_bland_requirement_catalog',
    });
    expect(evidence.get('COMM101').title).toBe('Public Speaking');
    expect(evidence.get('COMM201').title).toBe('Interpersonal Communication');
    expect(evidence.get('REL210').title).toBe('Social History of Christianity');
  });

  it('retains every requirement-scoped code and audits title provenance', () => {
    const corpus = prepareCorpus([
      { code: 'CSC221', offered_by: ['Northern Virginia Community College'] },
      { code: 'MATH254', offered_by: ['Richard Bland College'] },
      { code: 'CSC201', title: 'Unrelated university course', offered_by: ['Some University'] },
    ], [
      { code: 'CSC221', colleges: ['Northern Virginia Community College'] },
      { code: 'MATH254', colleges: ['Richard Bland College'] },
      { code: 'CSC201', colleges: ['Blue Ridge Community College'] },
      { code: 'OLD100', colleges: ['Blue Ridge Community College'] },
    ]);
    expect(corpus.scoped.map((row) => row.code)).toEqual(['CSC201', 'CSC221', 'MATH254', 'OLD100']);
    expect(corpus.richardBlandScope.map((row) => row.code)).toEqual(['MATH254']);
    expect(corpus.scopeWithTrustedTransferOverlap.map((row) => row.code)).toEqual(['CSC221']);
    expect(corpus.scopeWithUntrustedTransferCollision[0]).toMatchObject({
      code: 'CSC201', title: null, transfer_record_status: 'no_scope_college_overlap',
    });
    expect(corpus.scopeWithoutTransferRecord.map((row) => row.code)).toEqual(['OLD100']);
  });

  it('emits backend-compatible concept fields and closure requisite rows', () => {
    const scope = [
      { code: 'CSC223', colleges: ['Northern Virginia Community College'] },
      { code: 'OLD100', colleges: ['Blue Ridge Community College'] },
    ];
    const corpus = prepareCorpus([
      {
        _id: 'va:crs:CSC223', code: 'CSC223', title: 'Data Structures',
        offered_by: ['Northern Virginia Community College'],
      },
    ], scope);
    const masterByCode = new Map([
      ['CSC223', {
        code: 'CSC223', found: true, title: 'Data Structures', description: 'Algorithms.',
        source_url: 'https://courses.vccs.edu/courses/CSC223', status: 'parsed', flags: [],
        supply: [], raw_requisites: 'Prerequisite: CSC 222', groups: [{
          kind: 'prerequisite', formula: 'paths_or__conditions_and', raw: 'CSC 222', flags: [],
          paths: [{ raw: 'CSC 222', all_of: [{
            type: 'course', code: 'CSC222', course_key: 'va:CSC222', course_ref: 'va:crs:CSC222',
          }] }],
        }],
      }],
      ['CSC222', {
        code: 'CSC222', found: true, title: 'Object-Oriented Programming', description: 'OOP.',
        source_url: 'https://courses.vccs.edu/courses/CSC222', status: 'none', flags: [], supply: [], groups: [],
      }],
    ]);
    const allowed = new Set(['cs_2_oop', 'cs_3_data_structures']);
    const artifacts = buildArtifacts({
      scope, corpus, masterByCode, allowedConcepts: allowed,
    });
    const concept = artifacts.concepts.rows.find((row) => row.code === 'CSC223');
    expect(concept).toMatchObject({
      course_key: 'va:CSC223', concept: 'cs_3_data_structures',
      concept_confidence: 1, review_status: 'reviewed',
    });
    expect(concept).toHaveProperty('concept_source');
    expect(concept).toHaveProperty('concept_note');
    expect(concept).not.toHaveProperty('confidence');
    expect(artifacts.requisites.rows.find((row) => row.code === 'CSC222'))
      .toMatchObject({ scope_role: 'prerequisite_only', course_key: 'va:CSC222' });
    expect(artifacts.requisites.rows.find((row) => row.code === 'OLD100')).toMatchObject({
      scope_role: 'major_preparation', scope_colleges: ['Blue Ridge Community College'], status: 'missing',
    });
    expect(artifacts.concepts.meta.totals.direct_rows).toBe(2);
    expect(artifacts.concepts.meta.coverage_issues.transfer_record_missing).toEqual(['OLD100']);
  });

  it('suppresses same-code VCCS identity and rules for Richard Bland-only rows', () => {
    const scope = [{ code: 'ART231', colleges: ['Richard Bland College'] }];
    const evidence = new Map([['ART231', {
      title: 'Art Appreciation', source: 'richard_bland_requirement_catalog',
      source_url: 'http://catalog.rbc.edu/example',
    }]]);
    const corpus = prepareCorpus([], scope, evidence);
    const masterByCode = new Map([['ART231', {
      code: 'ART231', found: true, title: 'Sculpture I', description: 'VCCS sculpture.',
      source_url: 'https://courses.vccs.edu/courses/ART231', status: 'parsed', flags: [], supply: [],
      raw_requisites: 'Prerequisite: ART 131', groups: [{
        kind: 'prerequisite', formula: 'paths_or__conditions_and', raw: 'ART 131', flags: [],
        paths: [{ raw: 'ART 131', all_of: [{
          type: 'course', code: 'ART131', course_key: 'va:ART131', course_ref: 'va:crs:ART131',
        }] }],
      }],
    }]]);
    const artifacts = buildArtifacts({ scope, corpus, masterByCode, allowedConcepts: new Set() });
    expect(artifacts.concepts.rows).toHaveLength(1);
    expect(artifacts.concepts.rows[0]).toMatchObject({
      code: 'ART231', title_seen: 'Art Appreciation', concept: null,
      source: 'richard_bland_requirement_catalog', review_status: 'needs_review',
      flags: expect.arrayContaining(['non_vccs', 'institution_local', 'vccs_master_not_applicable']),
    });
    expect(artifacts.requisites.rows[0]).toMatchObject({
      code: 'ART231', title: 'Art Appreciation', status: 'missing', groups: [],
      source: 'richard_bland_requirement_catalog',
      flags: expect.arrayContaining(['local_requisite_source_missing', 'vccs_master_not_applicable']),
    });
  });

  it('keeps VCCS identity plus an explicit Richard Bland override for mixed collisions', () => {
    const scope = [{
      code: 'REL210', colleges: ['Blue Ridge Community College', 'Richard Bland College'],
    }];
    const evidence = new Map([['REL210', {
      title: 'Social History of Christianity', source: 'richard_bland_requirement_catalog',
      source_url: 'http://catalog.rbc.edu/example',
    }]]);
    const corpus = prepareCorpus([], scope, evidence);
    const masterByCode = new Map([['REL210', {
      code: 'REL210', found: true, title: 'Survey of the New Testament', description: null,
      source_url: 'https://courses.vccs.edu/courses/REL210', status: 'none', flags: [], supply: [], groups: [],
    }]]);
    const artifacts = buildArtifacts({ scope, corpus, masterByCode, allowedConcepts: new Set() });
    for (const row of [artifacts.concepts.rows[0], artifacts.requisites.rows[0]]) {
      expect(row.flags).toEqual(expect.arrayContaining(['mixed_scope_identity_collision', 'needs_review']));
      expect(row.institution_overrides).toEqual([expect.objectContaining({
        institution: 'Richard Bland College', title: 'Social History of Christianity', concept: null,
      })]);
    }
    expect(artifacts.concepts.rows[0].title_seen).toBe('Survey of the New Testament');
    expect(artifacts.requisites.rows[0].status).toBe('none');
  });
});
