import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  RECEIPT_ATTESTATIONS,
  RECEIPT_DECISION,
  RECEIPT_METHOD,
  RECEIPT_STATEMENT,
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  canonicalJson,
  officialHostsForPrerequisiteScope,
  publicationGenerationFor,
  requiredUniversityCourseKeys,
  requiredVccsCourseKeys,
  sha256,
  sourceBundleHashForRows,
  validateVirginiaFigure6PrerequisiteSources,
} from '../../services/virginia/pathwayComplexityPrerequisites';
import {
  CORPUS_ARTIFACT,
  DEFAULT_RECEIPT,
  DEFAULT_UNIVERSITY_ARTIFACT,
  DEFAULT_UNIVERSITY_SCOPE,
  DEFAULT_VCCS_ARTIFACT,
  DEFAULT_VCCS_SCOPE,
  LEGACY_ARCHIVE_COLLECTION,
  PUBLICATION_COLLECTION,
  REVISION_COLLECTION,
  REVISION_DOCUMENT_COLLECTION,
  artifactHashesForBytes,
  buildPrerequisiteSnapshot,
  buildPublicationPlan,
  publishPlan,
  restorePrerequisiteSnapshot,
  run,
  validatePrerequisiteSnapshot,
} from './publishFigure6Prerequisites';

const NOW = new Date('2026-08-24T12:00:00.000Z');
let universityScope;
let promotedUniversityRowsByKey;

const EXACT_PROMOTED_FIXTURE_KEYS = Object.freeze([
  'va:uni:9219:ENGL111',
  'va:uni:9221:CSCI111',
  'va:uni:9221:CSCI382',
  'va:uni:9221:ENGL185',
  'va:uni:9229:ENGR395',
  'va:uni:9229:HONR230',
  'va:uni:9229:HONR240',
  'va:uni:9229:UNIV101',
  'va:uni:9229:UNIV191',
]);

beforeAll(() => {
  universityScope = JSON.parse(fs.readFileSync(
    new URL('../../.va-catalogs/research/va-university-prerequisite-scope.json', import.meta.url),
  ));
  const review = JSON.parse(fs.readFileSync(
    new URL('../../.va-catalogs/research/va-university-prerequisite-review.json', import.meta.url),
  ));
  promotedUniversityRowsByKey = new Map(EXACT_PROMOTED_FIXTURE_KEYS.map((courseKey) => {
    const row = review.promoted_rows.find((candidate) => candidate.course_key === courseKey);
    if (!row) throw new Error(`missing exact promoted fixture row ${courseKey}`);
    return [courseKey, row];
  }));
});

function formattedCode(code) {
  return String(code).replace(/^([A-Z]+)(\d)/, '$1 $2');
}

function noneRow({ courseKey, owner, source, sourceUrl }) {
  const code = courseKey.split(':').at(-1);
  const rawText = `${formattedCode(code)}. Catalog course entry. Prerequisites: None.`;
  const contentSha256 = sha256(rawText);
  return {
    course_key: courseKey,
    owner_namespace: owner,
    status: 'none',
    source,
    source_url: sourceUrl,
    source_content_sha256: contentSha256,
    source_evidence: {
      kind: 'official_course_entry',
      raw_text: rawText,
      content_sha256: contentSha256,
    },
    explicit_none_evidence: {
      kind: 'official_explicit_none_statement',
      raw_text: 'Prerequisites: None.',
      source_content_sha256: contentSha256,
    },
    raw_requisites: null,
    groups: [],
  };
}

function stampOwnerBundleHashes(rows) {
  for (const owner of new Set(rows.map((row) => row.owner_namespace))) {
    const bundle = sourceBundleHashForRows(rows, owner);
    for (const row of rows.filter((candidate) => candidate.owner_namespace === owner)) {
      row.source_bundle_hash = bundle;
    }
  }
  return rows;
}

function fixture() {
  const vccsScope = [{ code: 'CSC100', colleges: ['Blue Ridge Community College'] }];
  const vccsRows = stampOwnerBundleHashes([noneRow({
    courseKey: 'va:CSC100',
    owner: 'va:vccs',
    source: 'vccs_master_course_file',
    sourceUrl: 'https://courses.vccs.edu/courses/CSC100',
  })]);
  // This fixture models a hypothetical publication-ready generation. Do not
  // turn the currently blocked CS322 formula into a fake none row: use a
  // fixture-only identity in a cloned scope. The default dry-run test below
  // still exercises the real, blocked checked-in scope. Exact rows already
  // promoted by source-bound contracts retain those contracts verbatim.
  const fixtureUniversityScope = structuredClone(universityScope);
  const radford = fixtureUniversityScope.universities.find((row) => (
    row.owner_namespace === 'va:uni:9219'
  ));
  const blockedIndex = radford.direct_named_course_codes.indexOf('CS322');
  if (blockedIndex < 0) throw new Error('missing blocked Radford CS322 fixture identity');
  radford.direct_named_course_codes[blockedIndex] = 'CS9999Z';
  const blockedCaptureIndex = radford.cached_course_catalog.direct_codes_not_seen
    .indexOf('CS322');
  if (blockedCaptureIndex < 0) {
    throw new Error('missing blocked Radford CS322 capture partition');
  }
  radford.cached_course_catalog.direct_codes_not_seen[blockedCaptureIndex] = 'CS9999Z';

  const universityRows = stampOwnerBundleHashes(fixtureUniversityScope.universities.flatMap((university) => {
    const base = new URL(university.cached_course_catalog.official_url);
    const requiredCodes = [
      ...university.direct_named_course_codes,
      ...(university.deterministic_resident_path_course_codes || []),
    ];
    return requiredCodes.map((code) => {
      const courseKey = `${university.owner_namespace}:${code}`;
      const exact = promotedUniversityRowsByKey.get(courseKey);
      return exact ? structuredClone(exact) : noneRow({
        courseKey,
        owner: university.owner_namespace,
        source: 'institution_catalog',
        sourceUrl: `${base.protocol}//${base.host}/courses/${code}`,
      });
    });
  }));
  const vccsArtifact = {
    schema_version: 1,
    artifact: CORPUS_ARTIFACT,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    corpus_role: 'community_college',
    rows: vccsRows,
  };
  const universityArtifact = {
    schema_version: 1,
    artifact: CORPUS_ARTIFACT,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    corpus_role: 'university',
    rows: universityRows,
  };
  const bytes = {
    community_college_corpus: Buffer.from(JSON.stringify(vccsArtifact)),
    university_corpus: Buffer.from(JSON.stringify(universityArtifact)),
    vccs_scope: Buffer.from(JSON.stringify(vccsScope)),
    university_scope: Buffer.from(JSON.stringify(fixtureUniversityScope)),
  };
  const artifactHashes = artifactHashesForBytes(bytes);
  const publicationGeneration = publicationGenerationFor({
    communityCollegeRows: vccsRows,
    universityRows,
    requiredCommunityCollegeKeys: requiredVccsCourseKeys(vccsScope),
    requiredUniversityKeys: requiredUniversityCourseKeys(fixtureUniversityScope),
    officialHostsByOwner: officialHostsForPrerequisiteScope(fixtureUniversityScope),
  });
  const receipt = {
    schema_version: 1,
    artifact: 'virginia_figure6_prerequisite_verification_receipt',
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    decision: RECEIPT_DECISION,
    verification_method: RECEIPT_METHOD,
    verified_by: { kind: 'human', name: 'Independent Reviewer', role: 'data verifier' },
    verified_at: '2026-08-24T11:00:00.000Z',
    signed_statement: RECEIPT_STATEMENT,
    publication_generation: publicationGeneration,
    artifact_sha256: { ...artifactHashes },
    attestations: Object.fromEntries(RECEIPT_ATTESTATIONS.map((name) => [name, true])),
  };
  return {
    vccsArtifact,
    universityArtifact,
    vccsScope,
    universityScope: fixtureUniversityScope,
    artifactHashes,
    receipt,
  };
}

function planFor(values) {
  return buildPublicationPlan({
    ...values,
    verificationReceipt: values.receipt,
    now: NOW,
  });
}

describe('combined Virginia Figure 6 prerequisite publication plan', () => {
  it('binds all 16 owners and both complete direct sets to one content generation', () => {
    const values = fixture();
    const plan = planFor(values);
    expect(plan).toMatchObject({
      ready: true,
      counts: {
        community_college: 1,
        required_community_college: 1,
        university: 850,
        required_university: 850,
        owners: 16,
      },
      issues: [],
    });
    expect(new Set([
      ...plan.publicationRows.community_college,
      ...plan.publicationRows.university,
    ].map((row) => row.publication_generation))).toEqual(
      new Set([plan.publication_generation]),
    );
    expect(publicationGenerationFor({
      communityCollegeRows: [...values.vccsArtifact.rows].reverse(),
      universityRows: [...values.universityArtifact.rows].reverse(),
      requiredCommunityCollegeKeys: requiredVccsCourseKeys(values.vccsScope).reverse(),
      requiredUniversityKeys: requiredUniversityCourseKeys(values.universityScope).reverse(),
      officialHostsByOwner: officialHostsForPrerequisiteScope(values.universityScope),
    })).toBe(plan.publication_generation);
    const expandedHosts = officialHostsForPrerequisiteScope(values.universityScope);
    expandedHosts['va:uni:9205'] = [...expandedHosts['va:uni:9205'], 'unreviewed.example'];
    expect(publicationGenerationFor({
      communityCollegeRows: values.vccsArtifact.rows,
      universityRows: values.universityArtifact.rows,
      requiredCommunityCollegeKeys: requiredVccsCourseKeys(values.vccsScope),
      requiredUniversityKeys: requiredUniversityCourseKeys(values.universityScope),
      officialHostsByOwner: expandedHosts,
    })).not.toBe(plan.publication_generation);
    const storedReceipt = {
      ...plan.receipt,
      _id: plan.verification_receipt_id,
      active: true,
      corpus_counts: plan.counts,
      receipt_sha256: plan.verification_receipt_sha256,
    };
    expect(validateVirginiaFigure6PrerequisiteSources({
      communityCollegeRows: plan.publicationRows.community_college,
      universityRows: plan.publicationRows.university,
      vccsScopeRows: values.vccsScope,
      universityScope: values.universityScope,
      adapterIntegrated: true,
      verificationReceipt: storedReceipt,
    })).toMatchObject({ ready: true, issues: [] });
  });

  it('rejects a non-owner host and source text whose retained bytes do not match its hash', () => {
    const values = fixture();
    const row = values.universityArtifact.rows[0];
    row.source_url = 'https://catalog.attacker.example/courses/CSCI101';
    row.source_evidence.raw_text += ' changed';
    const plan = planFor(values);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'source_url_not_official_owner_host',
      'source_content_hash_mismatch',
      'source_bundle_hash_not_content_derived',
      'verification_generation_mismatch',
    ]));
  });

  it('rejects a missing direct row and a receipt for a different artifact byte stream', () => {
    const values = fixture();
    values.universityArtifact.rows.shift();
    values.receipt.artifact_sha256.university_corpus = '0'.repeat(64);
    const plan = planFor(values);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'required_course_requisite_missing',
      'verification_artifact_hash_mismatch',
      'verification_generation_mismatch',
    ]));
  });

  it('requires every separately proved deterministic resident-path row', () => {
    const values = fixture();
    expect(values.universityArtifact.rows.filter((row) => (
      row.owner_namespace === 'va:uni:9214'
      && [
        'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
      ].includes(row.course_key.split(':').at(-1))
    )).map((row) => row.course_key).sort()).toEqual([
      'va:uni:9214:CMSC360',
      'va:uni:9214:CMSC415',
      'va:uni:9214:CMSC455',
      'va:uni:9214:MATH301',
      'va:uni:9214:PSYC335',
      'va:uni:9214:RELI301',
      'va:uni:9214:SPAN320',
    ]);
    values.universityArtifact.rows = values.universityArtifact.rows.filter((row) => (
      row.course_key !== 'va:uni:9214:CMSC415'
    ));
    const plan = planFor(values);
    expect(plan.ready).toBe(false);
    expect(plan.issues).toContainEqual({
      code: 'required_course_requisite_missing',
      path: 'university.va:uni:9214:CMSC415',
    });
  });

  it('does not accept a bare none row or an automation receipt as human review', () => {
    const values = fixture();
    delete values.vccsArtifact.rows[0].explicit_none_evidence;
    values.receipt.verified_by = { kind: 'automation', name: 'build bot', role: 'generator' };
    const plan = planFor(values);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'explicit_none_evidence_required',
      'named_human_verifier_required',
    ]));
  });

  it('does not accept an unrelated occurrence of "none" as an official no-prerequisite statement', () => {
    const values = fixture();
    values.vccsArtifact.rows[0].explicit_none_evidence.raw_text = 'None';
    const plan = planFor(values);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map((issue) => issue.code))
      .toContain('explicit_none_statement_not_in_source');
  });
});

function fakeMongo(initial) {
  const state = structuredClone(initial);
  const calls = [];
  const matches = (row, query = {}) => Object.entries(query)
    .every(([key, value]) => row?.[key] === value);
  const collection = (name) => ({
    find(query, options = {}) {
      calls.push({ name, method: 'find', session: options.session });
      return {
        toArray: async () => structuredClone((state[name] || [])
          .filter((row) => matches(row, query))),
      };
    },
    async findOne(query, options = {}) {
      calls.push({ name, method: 'findOne', session: options.session });
      const row = (state[name] || []).find((candidate) => candidate._id === query._id);
      return row ? structuredClone(row) : null;
    },
    async updateOne(filter, update, options = {}) {
      calls.push({ name, method: 'updateOne', session: options.session });
      state[name] ||= [];
      if (!state[name].some((row) => row._id === filter._id)) {
        state[name].push(structuredClone(update.$setOnInsert));
      }
    },
    async deleteMany(filter, options = {}) {
      calls.push({ name, method: 'deleteMany', session: options.session });
      state[name] = [];
    },
    async insertMany(rows, options = {}) {
      calls.push({ name, method: 'insertMany', session: options.session });
      state[name] ||= [];
      state[name].push(...structuredClone(rows));
    },
    async insertOne(row, options = {}) {
      calls.push({ name, method: 'insertOne', session: options.session });
      state[name] ||= [];
      state[name].push(structuredClone(row));
    },
    async findOneAndUpdate(filter, update, options = {}) {
      calls.push({ name, method: 'findOneAndUpdate', session: options.session });
      state[name] ||= [];
      let index = state[name].findIndex((row) => matches(row, filter));
      if (index < 0) {
        const inserted = Object.fromEntries(Object.entries(filter)
          .filter(([, value]) => value == null || typeof value !== 'object'));
        Object.assign(inserted, structuredClone(update.$setOnInsert || {}));
        state[name].push(inserted);
        index = state[name].length - 1;
      }
      const row = state[name][index];
      for (const [key, value] of Object.entries(update.$inc || {})) {
        row[key] = (row[key] || 0) + value;
      }
      Object.assign(row, structuredClone(update.$set || {}));
      return structuredClone(row);
    },
    async updateMany(filter, update, options = {}) {
      calls.push({ name, method: 'updateMany', session: options.session });
      state[name] ||= [];
      for (const row of state[name]) {
        if (filter.active === undefined || row.active === filter.active) Object.assign(row, update.$set);
      }
    },
    async replaceOne(filter, row, options = {}) {
      calls.push({ name, method: 'replaceOne', session: options.session });
      state[name] ||= [];
      const index = state[name].findIndex((candidate) => candidate._id === filter._id);
      if (index >= 0) state[name][index] = structuredClone(row);
      else state[name].push(structuredClone(row));
    },
  });
  const session = {
    transactionCalls: 0,
    options: null,
    ended: false,
    async withTransaction(callback, options) {
      this.transactionCalls += 1;
      this.options = options;
      const before = structuredClone(state);
      try {
        await callback();
      } catch (error) {
        for (const key of Object.keys(state)) delete state[key];
        Object.assign(state, before);
        throw error;
      }
    },
    async endSession() { this.ended = true; },
  };
  return {
    state,
    calls,
    client: { startSession: () => session },
    db: { collection },
    session,
  };
}

describe('atomic Virginia prerequisite publisher', () => {
  const priorPrerequisiteState = () => ({
    va_course_requisites: [{ _id: 'vccs-before', course_key: 'va:CSC200', status: 'none' }],
    va_university_course_requisites: [{
      _id: 'university-before', course_key: 'va:uni:9201:CS200', status: 'resolved',
    }],
    [PUBLICATION_COLLECTION]: [
      { _id: 'receipt-before', active: true, publication_generation: 'approved-before' },
      { _id: 'receipt-older', active: false, publication_generation: 'approved-older' },
    ],
  });

  it('validates a generation-complete snapshot and rejects tampering or mixed generations', () => {
    const snapshot = buildPrerequisiteSnapshot({
      generationId: 'prerequisite-generation',
      documentsByCollection: priorPrerequisiteState(),
      createdAt: NOW,
    });
    expect(validatePrerequisiteSnapshot(snapshot.manifest, snapshot.payload))
      .toMatchObject({ valid: true, errors: [] });

    const tampered = structuredClone(snapshot.payload);
    tampered[0].document.status = 'changed';
    expect(validatePrerequisiteSnapshot(snapshot.manifest, tampered).errors.join('\n'))
      .toContain('content hash does not match manifest');

    const mixed = structuredClone(snapshot.payload);
    mixed[0].generation_id = 'another-generation';
    expect(validatePrerequisiteSnapshot(snapshot.manifest, mixed).errors.join('\n'))
      .toContain('payload generation_id does not match manifest');
  });

  it('restores both corpora and all publication receipts byte-for-byte in one transaction', async () => {
    const previous = priorPrerequisiteState();
    const snapshot = buildPrerequisiteSnapshot({
      generationId: 'restore-this-prerequisite-generation',
      documentsByCollection: previous,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    const current = {
      va_course_requisites: [{ _id: 'vccs-current', status: 'resolved' }],
      va_university_course_requisites: [{ _id: 'university-current', status: 'none' }],
      [PUBLICATION_COLLECTION]: [{
        _id: 'receipt-current', active: true, publication_generation: 'current',
      }],
    };
    const mongo = fakeMongo({
      ...current,
      [REVISION_COLLECTION]: [snapshot.manifest],
      [REVISION_DOCUMENT_COLLECTION]: snapshot.payload,
    });

    const result = await restorePrerequisiteSnapshot({
      client: mongo.client,
      db: mongo.db,
      generationId: 'restore-this-prerequisite-generation',
      backupGenerationId: 'undo-prerequisite-restore',
      now: NOW,
    });

    expect(result).toMatchObject({
      restored_generation_id: 'restore-this-prerequisite-generation',
      rollback_generation_id: 'undo-prerequisite-restore',
    });
    for (const [collection, rows] of Object.entries(previous)) {
      expect(mongo.state[collection]).toEqual(rows);
    }
    expect(mongo.state[REVISION_COLLECTION][1]).toMatchObject({
      generation_id: 'undo-prerequisite-restore',
      operation: 'restore',
      source_generation_id: 'restore-this-prerequisite-generation',
      status: 'complete',
      publication_transition: {
        contract: 'va-analysis-publication-transition-v1',
        sequence: 1,
        domain: 'prerequisite',
      },
    });
    expect(mongo.state[REVISION_COLLECTION][1]
      .restored_snapshot_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mongo.session.transactionCalls).toBe(1);
  });

  it('rejects corrupt or mixed prerequisite backups before deleting live rows', async () => {
    const exact = buildPrerequisiteSnapshot({
      generationId: 'corruption-target',
      documentsByCollection: priorPrerequisiteState(),
      createdAt: NOW,
    });
    const variants = [
      (snapshot) => { snapshot.manifest.targets[0].sha256 = '0'.repeat(64); },
      (snapshot) => { snapshot.payload[0].generation_id = 'mixed-generation'; },
    ];
    for (const mutate of variants) {
      const snapshot = structuredClone(exact);
      mutate(snapshot);
      const live = {
        va_course_requisites: [{ _id: 'live-vccs' }],
        va_university_course_requisites: [{ _id: 'live-university' }],
        [PUBLICATION_COLLECTION]: [{ _id: 'live-receipt', active: true }],
      };
      const mongo = fakeMongo({
        ...live,
        [REVISION_COLLECTION]: [snapshot.manifest],
        [REVISION_DOCUMENT_COLLECTION]: snapshot.payload,
      });
      await expect(restorePrerequisiteSnapshot({
        client: mongo.client,
        db: mongo.db,
        generationId: 'corruption-target',
        backupGenerationId: 'must-not-exist',
      })).rejects.toThrow(/backup corruption-target is incomplete/i);
      expect(mongo.calls.filter((call) => call.method === 'deleteMany')).toEqual([]);
      for (const [collection, rows] of Object.entries(live)) {
        expect(mongo.state[collection]).toEqual(rows);
      }
    }
  });

  it('does not construct a Mongo client for the default blocked dry run', async () => {
    let clients = 0;
    class ForbiddenClient {
      constructor() { clients += 1; }
    }
    const plan = await run({
      apply: false,
      json: false,
      uri: 'mongodb://must-not-connect',
      dbName: 'must_not_write',
      vccsArtifactFile: DEFAULT_VCCS_ARTIFACT,
      universityArtifactFile: DEFAULT_UNIVERSITY_ARTIFACT,
      vccsScopeFile: DEFAULT_VCCS_SCOPE,
      universityScopeFile: DEFAULT_UNIVERSITY_SCOPE,
      receiptFile: DEFAULT_RECEIPT,
    }, { MongoClient: ForbiddenClient, log: () => {}, now: NOW });
    expect(plan.ready).toBe(false);
    expect(clients).toBe(0);
  });

  it('archives legacy research and replaces both corpora inside one session', async () => {
    const plan = planFor(fixture());
    const mongo = fakeMongo({
      va_course_requisites: [{ _id: 'legacy-vccs', status: 'missing' }],
      va_university_course_requisites: [{ _id: 'legacy-university', status: 'unparsed' }],
      [PUBLICATION_COLLECTION]: [{ _id: 'old-receipt', active: true }],
      [LEGACY_ARCHIVE_COLLECTION]: [],
    });
    const result = await publishPlan({
      client: mongo.client,
      db: mongo.db,
      plan,
      now: NOW,
      snapshotGenerationId: 'before-prerequisite-publication',
    });

    expect(result).toMatchObject({
      published: true,
      rollback_generation_id: 'before-prerequisite-publication',
      counts: { university: 850 },
    });
    expect(mongo.session.transactionCalls).toBe(1);
    expect(mongo.session.options).toMatchObject({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
    expect(mongo.session.ended).toBe(true);
    expect(mongo.state[LEGACY_ARCHIVE_COLLECTION]).toHaveLength(2);
    expect(mongo.state[LEGACY_ARCHIVE_COLLECTION].map((row) => row.document._id).sort())
      .toEqual(['legacy-university', 'legacy-vccs']);
    expect(mongo.state.va_course_requisites).toHaveLength(1);
    expect(mongo.state.va_university_course_requisites).toHaveLength(850);
    expect(mongo.state[PUBLICATION_COLLECTION].filter((row) => row.active)).toHaveLength(1);
    expect(mongo.state[REVISION_COLLECTION]).toMatchObject([{
      generation_id: 'before-prerequisite-publication',
      operation: 'publish',
      replacement_publication_generation: plan.publication_generation,
      status: 'complete',
      publication_transition: {
        contract: 'va-analysis-publication-transition-v1',
        sequence: 1,
        domain: 'prerequisite',
      },
    }]);
    expect(mongo.state.va_analysis_publication_transitions).toMatchObject([{
      sequence: 1,
      domain: 'prerequisite',
      operation: 'publish',
      generation_id: 'before-prerequisite-publication',
    }]);
    expect(mongo.state[REVISION_COLLECTION][0].targets).toHaveLength(3);
    expect(mongo.state[REVISION_DOCUMENT_COLLECTION]).toHaveLength(3);
    expect(mongo.calls.every((call) => call.session === mongo.session)).toBe(true);
  });

  it('refuses to delete a legacy row when its archive cannot be verified', async () => {
    const plan = planFor(fixture());
    const legacy = { _id: 'legacy-vccs', status: 'missing' };
    const documentSha256 = sha256(canonicalJson(legacy));
    const archiveId = `va:prerequisite-archive:va_course_requisites:${documentSha256}`;
    const mongo = fakeMongo({
      va_course_requisites: [legacy],
      va_university_course_requisites: [],
      [LEGACY_ARCHIVE_COLLECTION]: [{
        _id: archiveId,
        document_sha256: documentSha256,
        document: { _id: 'corrupt' },
      }],
    });
    await expect(publishPlan({
      client: mongo.client,
      db: mongo.db,
      plan,
      now: NOW,
    })).rejects.toThrow('legacy research archive verification failed');
    expect(mongo.state.va_course_requisites).toEqual([legacy]);
  });

  it('refuses a blocked plan before opening a transaction', async () => {
    const mongo = fakeMongo({});
    await expect(publishPlan({
      client: mongo.client,
      db: mongo.db,
      plan: { ready: false },
    })).rejects.toThrow('blocked prerequisite plan');
    await expect(publishPlan({
      client: mongo.client,
      db: mongo.db,
      plan: { ready: true },
    })).rejects.toThrow('missing validation marker');
    const mutated = planFor(fixture());
    mutated.publicationRows.community_college[0].status = 'missing';
    await expect(publishPlan({
      client: mongo.client,
      db: mongo.db,
      plan: mutated,
    })).rejects.toThrow('missing validation marker');
    expect(mongo.session.transactionCalls).toBe(0);
  });
});
