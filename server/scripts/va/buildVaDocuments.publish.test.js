import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assertPublicationAllowed,
  buildProjection,
  buildSnapshot,
  canonicalDocumentHash,
  clearlyNamedStagingDatabase,
  parseCliArgs,
  operationalCourseUnitEvidenceOverlay,
  printPreflight,
  publishProjection,
  projectionTargetDocuments,
  projectionReceipt,
  publicationPreflight,
  recomputeVirginiaAcceptance,
  restoreProjection,
  targetManifest,
  validateSnapshot,
  validateTargetDocuments,
} from './buildVaDocuments';
import {
  institutionCourseIdentity,
  sharedCourseIdentity,
} from '../../services/virginia/courseIdentity';

const targetDocuments = () => ({
  assist_institutions: [{ _id: 'va:cc:9301', state: 'va', name: 'Example CC' }],
  assist_courses: [{ _id: 'va:sending:1', state: 'va', course_id: 1 }],
  assist_agreements: [{ _id: 'va:agreement:1', state: 'va' }],
  curated_requirements: [{ _id: 'as_degree:9301:va-cs:local_as', state: 'va' }],
});

const passingUnitEvidenceOverlay = () => ({
  ready: true,
  report_sha256: 'a'.repeat(64),
  output_documents_sha256: 'b'.repeat(64),
  counts: { conflicts: 0 },
  receipts: [],
  conflicts: [],
  issues: [],
});

function fakeMongo(initial, databaseName = 'pmt_research', { beforeRead = null } = {}) {
  let store = structuredClone(initial);
  const deletes = [];
  const matches = (document, filter) => Object.entries(filter)
    .every(([key, value]) => document?.[key] === value);
  const collection = (name) => ({
    find(filter) {
      let rows = (store[name] || []).filter((row) => matches(row, filter));
      return {
        sort(specification) {
          const fields = Object.keys(specification);
          rows = [...rows].sort((left, right) => {
            for (const field of fields) {
              const direction = specification[field];
              const result = String(left?.[field] ?? '').localeCompare(String(right?.[field] ?? ''),
                undefined, { numeric: true });
              if (result) return result * direction;
            }
            return 0;
          });
          return this;
        },
        async toArray() {
          if (beforeRead) await beforeRead();
          return structuredClone(rows);
        },
      };
    },
    async findOne(filter) {
      return structuredClone((store[name] || []).find((row) => matches(row, filter)) || null);
    },
    async deleteMany(filter) {
      deletes.push({ collection: name, filter: structuredClone(filter) });
      store[name] = (store[name] || []).filter((row) => !matches(row, filter));
    },
    async insertMany(documents) {
      store[name] = [...(store[name] || []), ...structuredClone(documents)];
    },
    async insertOne(document) {
      store[name] = [...(store[name] || []), structuredClone(document)];
    },
    async findOneAndUpdate(filter, update) {
      store[name] ||= [];
      let index = store[name].findIndex((row) => matches(row, filter));
      if (index < 0) {
        const inserted = Object.fromEntries(Object.entries(filter)
          .filter(([, value]) => value == null || typeof value !== 'object'));
        Object.assign(inserted, structuredClone(update.$setOnInsert || {}));
        store[name].push(inserted);
        index = store[name].length - 1;
      }
      const row = store[name][index];
      for (const [key, value] of Object.entries(update.$inc || {})) {
        row[key] = (row[key] || 0) + value;
      }
      Object.assign(row, structuredClone(update.$set || {}));
      return structuredClone(row);
    },
  });
  const db = { collection, databaseName };
  const client = {
    startSession() {
      return {
        async withTransaction(work) {
          const before = structuredClone(store);
          try { await work(); } catch (error) { store = before; throw error; }
        },
        async endSession() {},
      };
    },
  };
  return {
    client,
    db,
    deletes,
    rows: (name) => structuredClone(store[name] || []),
  };
}

const namespaceFor = (owner) => ({
  kind: 'institution_local',
  institution_id: owner,
  vccs_master_applicable: false,
  identity_contract: 'owner_plus_course_id',
  scoped_key_format: `${owner}:<code>`,
});

const asSource = (overrides = {}) => ({
  _id: 'va:as:brightpoint-community-college:cs',
  kind: 'as_degree',
  status: 'extracted',
  source: 'institution_catalog',
  source_method: 'official_catalog_composition',
  community_college_id: 'va:cc:brightpoint-community-college',
  total_units: 60,
  acceptance: { accepted: true, ready_for_analysis: true },
  verification: { verified: true },
  provenance: { source_bundle_hash: 'source-hash' },
  course_titles: {},
  requirement_groups: [],
  ...overrides,
});

describe('Virginia projection snapshot contract', () => {
  it('removes volatile candidate import timestamps from the evidence receipt', () => {
    const current = asSource({ sources: [{ id: 'major', url: 'https://example.edu/major' }] });
    const candidateA = { ...structuredClone(current), updated_at: '2026-08-24T01:00:00Z' };
    const candidateB = { ...structuredClone(current), updated_at: '2026-08-24T02:00:00Z' };
    const first = operationalCourseUnitEvidenceOverlay({
      sourceDocuments: [current], candidateDocuments: [candidateA], courses: [],
    });
    const second = operationalCourseUnitEvidenceOverlay({
      sourceDocuments: [current], candidateDocuments: [candidateB], courses: [],
    });
    expect(first.ready).toBe(true);
    expect(first.report_sha256).toBe(second.report_sha256);
    expect(first.receipts[0].candidate_document_sha256)
      .toBe(second.receipts[0].candidate_document_sha256);
  });

  it('manifests all four state-scoped targets with deterministic counts and hashes', () => {
    const documents = targetDocuments();
    const reordered = Object.fromEntries(Object.entries(documents)
      .map(([collection, rows]) => [collection, rows.map((row) => (
        Object.fromEntries(Object.entries(row).reverse())
      ))]));

    expect(targetManifest(documents)).toHaveLength(4);
    expect(targetManifest(documents).map((row) => row.collection)).toEqual([
      'assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements',
    ]);
    expect(targetManifest(documents).every((row) => (
      row.count === 1 && row.filter.state === 'va' && /^[a-f0-9]{64}$/.test(row.sha256)
    ))).toBe(true);
    expect(canonicalDocumentHash(documents.assist_courses))
      .toBe(canonicalDocumentHash(reordered.assist_courses));
  });

  it('rejects non-Virginia or duplicate targets before any database mutation', () => {
    const wrongState = targetDocuments();
    wrongState.assist_courses[0].state = 'ca';
    expect(validateTargetDocuments(wrongState)).toMatchObject({ valid: false });

    const duplicate = targetDocuments();
    duplicate.assist_courses.push({ ...duplicate.assist_courses[0] });
    expect(validateTargetDocuments(duplicate).errors.join('\n')).toContain('duplicate _id');
    expect(() => projectionTargetDocuments({
      institutions: duplicate.assist_institutions,
      courses: duplicate.assist_courses,
      agreements: duplicate.assist_agreements,
      degrees: duplicate.curated_requirements,
      asDegrees: [],
    })).toThrow('invalid Virginia projection');
  });

  it('validates an exact generation and detects missing or tampered payload rows', () => {
    const snapshot = buildSnapshot({
      generationId: 'generation-001',
      documentsByCollection: targetDocuments(),
      createdAt: new Date('2026-08-23T00:00:00Z'),
    });
    expect(validateSnapshot(snapshot.manifest, snapshot.payload)).toMatchObject({
      valid: true, errors: [],
    });

    const missing = snapshot.payload.slice(1);
    expect(validateSnapshot(snapshot.manifest, missing)).toMatchObject({ valid: false });
    expect(validateSnapshot(snapshot.manifest, missing).errors.join('\n'))
      .toContain('content hash does not match manifest');

    const tampered = structuredClone(snapshot.payload);
    tampered[0].document.name = 'Changed after backup';
    expect(validateSnapshot(snapshot.manifest, tampered).errors.join('\n'))
      .toContain('content hash does not match manifest');
  });

  it('rejects tampered manifests and mixed-generation payloads before any target write', async () => {
    const exact = buildSnapshot({
      generationId: 'rollback-target',
      documentsByCollection: targetDocuments(),
      createdAt: new Date('2026-08-23T00:00:00Z'),
    });
    const current = Object.fromEntries(Object.entries(targetDocuments()).map(([collection, rows]) => [
      collection,
      rows.map((row) => ({ ...row, _id: `${row._id}:current` })),
    ]));
    const variants = [
      ['tampered manifest', (snapshot) => {
        snapshot.manifest.targets[0].sha256 = '0'.repeat(64);
      }],
      ['mixed generation', (snapshot) => {
        snapshot.payload[0].generation_id = 'different-generation';
      }],
    ];

    for (const [, mutate] of variants) {
      const snapshot = structuredClone(exact);
      mutate(snapshot);
      const mongo = fakeMongo({
        ...structuredClone(current),
        va_projection_revisions: [snapshot.manifest],
        va_projection_revision_documents: snapshot.payload,
      });
      await expect(restoreProjection({
        client: mongo.client,
        db: mongo.db,
        generationId: 'rollback-target',
        backupGenerationId: 'should-not-exist',
      })).rejects.toThrow(/backup rollback-target is incomplete/i);
      expect(mongo.deletes).toEqual([]);
      for (const [collection, rows] of Object.entries(current)) {
        expect(mongo.rows(collection)).toEqual(rows);
      }
      expect(mongo.rows('va_projection_revisions')).toHaveLength(1);
    }
  });

  it('requires a passing release gate unless the target is explicitly staging', async () => {
    const pass = { publishable: true };
    const fail = { publishable: false };
    expect(assertPublicationAllowed(pass, {
      allowIncomplete: false, staging: false,
    }, 'pmt_research')).toEqual({ override: false });
    expect(() => assertPublicationAllowed(fail, {
      allowIncomplete: false, staging: false,
    }, 'pmt_research')).toThrow('readiness failed');
    expect(() => assertPublicationAllowed(fail, {
      allowIncomplete: true, staging: true,
    }, 'pmt_research')).toThrow('restricted');
    expect(assertPublicationAllowed(fail, {
      allowIncomplete: true, staging: true,
    }, 'pmt_research_staging')).toEqual({ override: true });

    expect(parseCliArgs(['--restore=generation-001'])).toMatchObject({
      apply: false, restoreGenerationId: 'generation-001',
    });
    expect(parseCliArgs([
      '--restore=generation-001', '--apply', '--allow-incomplete', '--staging',
    ])).toMatchObject({
      apply: true, allowIncomplete: true, staging: true,
      restoreGenerationId: 'generation-001',
    });
    expect(() => parseCliArgs(['--allow-incomplete'])).toThrow('must be supplied together');
    expect(() => parseCliArgs(['--apply', '--db', 'va_staging']))
      .toThrow('unknown option');
    await expect(publishProjection({ client: null, db: null, projection: null }))
      .rejects.toThrow('requires a passing preflight report');
  });

  it('allows incomplete publication only for the exact reviewed database allowlist', () => {
    for (const name of [
      'pmt_research_staging',
      'pmt_research_preview',
      'pmt_research_sandbox',
      'pmt_research_test',
    ]) expect(clearlyNamedStagingDatabase(name)).toBe(true);

    for (const name of [
      'pmt_research',
      'production_dev',
      'dev_production',
      'pmt_research_dev',
      'pmt_research_staging_backup',
      'PMT_RESEARCH_STAGING',
      '',
    ]) {
      expect(clearlyNamedStagingDatabase(name)).toBe(false);
      expect(() => assertPublicationAllowed({ publishable: false }, {
        allowIncomplete: true,
        staging: true,
      }, name)).toThrow(/allowlisted non-production database/);
    }
  });

  it('documents the environment-scoped projection command without an unsupported --db flag', () => {
    const docs = readFileSync(new URL('../../../docs/virginia-degree-collection.md', import.meta.url), 'utf8');
    expect(docs).toContain('MONGO_URI=<staging-uri> DB_NAME=pmt_research_staging');
    expect(docs).toContain('buildVaDocuments.js --apply --allow-incomplete --staging');
    for (const name of [
      'pmt_research_staging',
      'pmt_research_preview',
      'pmt_research_sandbox',
      'pmt_research_test',
    ]) expect(docs).toContain(name);
    expect(docs).not.toMatch(/buildVaDocuments\.js --apply --db/);
    expect(docs).toContain('eight analysis-ready records (all associate degrees)');
  });

  it('prints projection identity failures during production preflight', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    printPreflight({
      verdict: 'fail',
      publication: {
        verdict: 'fail',
        source_summary: { ready: 0, total: 0 },
        source_accounting: [], source_accounting_failures: [],
        projection_conservation: [], projection_losses: [],
        cohort_failures: [], sources: [],
        identity_cohort: { issues: [{ path: 'degrees[0]', code: 'degree_numeric_identity_mismatch', detail: { expected: 9205, actual: 9204 } }] },
      },
      identity: { stats: { resolved: 0, references: 0, issue_counts: {} } },
    });
    expect(log.mock.calls.flat().join('\n'))
      .toContain('identity:degrees[0] [degree_numeric_identity_mismatch]');
    log.mockRestore();
  });

  it('recomputes stale associate acceptance before production preflight', () => {
    const stale = asSource({
      acceptance: { accepted: true, ready_for_analysis: true },
      requirement_groups: [{
        title: 'Unresolved requirement',
        unresolved_courses_seen: [{ course_code_seen: 'MISSING 101' }],
        sections: [],
      }],
    });
    const [evaluated] = recomputeVirginiaAcceptance([stale], []);
    expect(evaluated.acceptance.ready_for_analysis).toBe(false);
    expect(evaluated.acceptance.analysis_ready.checks).toContainEqual(expect.objectContaining({
      name: 'unresolved_courses', severity: 'fail',
    }));

    const projected = {
      ...structuredClone(stale),
      _id: 'as_degree:9302:va-cs:local_as',
      state: 'va',
      status: 'found',
      va_requirement_status: 'extracted',
      va_requirement_id: stale._id,
      analysis_ready: true,
      community_college_id: 9302,
      college_id: 'va:cc:9302',
      college_name: 'Brightpoint Community College',
    };
    const report = publicationPreflight({
      sourceDocuments: [stale],
      projection: { institutions: [], courses: [], agreements: [], degrees: [], asDegrees: [projected] },
    });
    expect(report.publishable).toBe(false);
    expect(report.publication.sources[0].analysis_failures).toContain('unresolved_courses');
    expect(report.publication.projection_losses[0].issues.map((row) => row.field))
      .toContain('acceptance_receipt');
  });

  it('passes actual prerequisite collection rows through the production preflight', () => {
    const source = asSource();
    const projected = {
      ...structuredClone(source),
      _id: 'as_degree:9302:va-cs:example',
      state: 'va',
      status: 'found',
      va_requirement_status: 'extracted',
      va_requirement_id: source._id,
      analysis_ready: true,
      community_college_id: 9302,
      college_id: 'va:cc:9302',
      college_name: 'Brightpoint Community College',
    };
    const report = publicationPreflight({
      sourceDocuments: [source],
      projection: {
        asDegrees: [projected],
        degrees: [],
        agreements: [],
        courses: [],
      },
      prerequisiteCorpora: {
        communityCollegeRows: [{
          course_key: 'va:CSC221',
          owner_namespace: 'va:vccs',
          status: 'none',
          source: 'vccs_master_course_file',
          source_url: 'https://courses.vccs.edu/courses/CSC221',
          raw_requisites: null,
          groups: [],
        }],
        universityRows: [],
        vccsScopeRows: [{
          code: 'CSC221', colleges: ['Brightpoint Community College'],
        }],
        adapterIntegrated: true,
      },
    });

    expect(report.publication.figure_readiness.pathway_complexity).toMatchObject({
      ready: false,
      counts: {
        community_college: 1,
        required_community_college: 1,
        university: 0,
        required_university: 850,
      },
    });
    expect(report.publication.figure_readiness.pathway_complexity.issues
      .map((issue) => issue.code)).not.toContain('exact_formula_adapter_not_integrated');
    expect(report.publication.figure_readiness.transfer_equivalency_conditions)
      .toMatchObject({
        ready: false,
        counts: { associate_degrees: 1, bachelor_degrees: 0, cells: 0 },
      });
  });

  it('restores all four targets exactly, leaves CA untouched, and disables publication', async () => {
    const previous = targetDocuments();
    const initial = Object.fromEntries(Object.entries(previous).map(([collection, rows]) => [
      collection,
      [...rows, { _id: `ca:${collection}`, state: 'ca', sentinel: true }],
    ]));
    initial.va_projection_revisions = [];
    initial.va_projection_revision_documents = [];
    const mongo = fakeMongo(initial, 'pmt_research_staging');
    const projection = {
      institutions: [{ _id: 'va:cc:9302', state: 'va', name: 'Replacement CC' }],
      courses: [{ _id: 'va:sending:2', state: 'va', course_id: 2 }],
      agreements: [{ _id: 'va:agreement:2', state: 'va' }],
      degrees: [{ _id: 'degree:9201:va-cs', state: 'va' }],
      asDegrees: [],
    };

    const preflightReport = publicationPreflight({ sourceDocuments: [], projection });
    expect(preflightReport.publishable).toBe(false);
    await publishProjection({
      client: mongo.client,
      db: mongo.db,
      projection,
      preflightReport,
      allowIncompleteStaging: true,
      generationId: 'publish-generation',
    });
    expect(mongo.rows('va_projection_revisions')[0]).toMatchObject({
      generation_id: 'publish-generation',
      incomplete_staging_override: true,
      analysis_publication_receipt: null,
      publication_transition: {
        contract: 'va-analysis-publication-transition-v1',
        sequence: 1,
        domain: 'projection',
      },
    });
    for (const [collection, expected] of Object.entries(projectionTargetDocuments(projection))) {
      expect(mongo.rows(collection).filter((row) => row.state === 'va')).toEqual(expected);
      expect(mongo.rows(collection).filter((row) => row.state === 'ca'))
        .toEqual([{ _id: `ca:${collection}`, state: 'ca', sentinel: true }]);
    }

    await restoreProjection({
      client: mongo.client,
      db: mongo.db,
      generationId: 'publish-generation',
      backupGenerationId: 'restore-generation',
    });
    for (const [collection, expected] of Object.entries(previous)) {
      expect(mongo.rows(collection).filter((row) => row.state === 'va')).toEqual(expected);
      expect(mongo.rows(collection).filter((row) => row.state === 'ca'))
        .toEqual([{ _id: `ca:${collection}`, state: 'ca', sentinel: true }]);
    }
    expect(mongo.deletes).toHaveLength(8);
    expect(mongo.deletes.every((row) => (
      ['assist_institutions', 'assist_courses', 'assist_agreements', 'curated_requirements']
        .includes(row.collection)
      && JSON.stringify(row.filter) === JSON.stringify({ state: 'va' })
    ))).toBe(true);
    expect(mongo.rows('va_projection_revisions')[1]).toMatchObject({
      generation_id: 'restore-generation',
      operation: 'restore',
      source_generation_id: 'publish-generation',
      restore_policy_contract: 'va-exact-snapshot-restore-v1',
      analysis_visibility: 'disabled_pending_revalidation',
      analysis_publication_receipt: null,
      preflight_verdict: 'not_revalidated',
      incomplete_staging_override: false,
      publication_transition: {
        contract: 'va-analysis-publication-transition-v1',
        sequence: 2,
        domain: 'projection',
      },
    });
    expect(mongo.rows('va_projection_revisions')[1]
      .restored_snapshot_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mongo.rows('va_analysis_publication_transitions')).toMatchObject([
      { sequence: 1, domain: 'projection', operation: 'publish' },
      { sequence: 2, domain: 'projection', operation: 'restore' },
    ]);
  });

  it('restores an exact production snapshot after authoritative source drift', async () => {
    const previous = targetDocuments();
    const snapshot = buildSnapshot({
      generationId: 'pre-drift-snapshot',
      documentsByCollection: previous,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    // This historical receipt remains immutable evidence, but it attested the
    // old publication's replacement rather than this pre-publication payload.
    snapshot.manifest.analysis_publication_receipt = {
      contract: 'va-analysis-publication-receipt-v1',
      generation_id: 'pre-drift-snapshot',
      ready: true,
      publishable: true,
    };
    const current = {
      assist_institutions: [{ _id: 'va:cc:9991', state: 'va', name: 'Current CC' }],
      assist_courses: [{ _id: 'va:sending:9991', state: 'va', course_id: 9991 }],
      assist_agreements: [{ _id: 'va:agreement:9991', state: 'va' }],
      curated_requirements: [{ _id: 'degree:9991:va-cs', state: 'va' }],
    };
    const initial = Object.fromEntries(Object.entries(current).map(([collection, rows]) => [
      collection,
      [...rows, { _id: `ca:${collection}`, state: 'ca', sentinel: true }],
    ]));
    Object.assign(initial, {
      // These authoritative sources intentionally no longer describe either
      // the snapshot or the current projection.
      va_courses: [{ _id: 'source-course-after-snapshot', code: 'DRIFT 999' }],
      va_requirements: [{ _id: 'source-degree-after-snapshot', status: 'changed' }],
      va_institutions: [{ _id: 'source-institution-after-snapshot' }],
      va_projection_revisions: [snapshot.manifest],
      va_projection_revision_documents: snapshot.payload,
    });
    const mongo = fakeMongo(initial, 'pmt_research');

    const result = await restoreProjection({
      client: mongo.client,
      db: mongo.db,
      generationId: 'pre-drift-snapshot',
      backupGenerationId: 'post-drift-restore',
    });

    expect(result).toMatchObject({
      restored_generation_id: 'pre-drift-snapshot',
      rollback_generation_id: 'post-drift-restore',
    });
    for (const [collection, expected] of Object.entries(previous)) {
      expect(mongo.rows(collection).filter((row) => row.state === 'va')).toEqual(expected);
      expect(mongo.rows(collection).filter((row) => row.state === 'ca'))
        .toEqual([{ _id: `ca:${collection}`, state: 'ca', sentinel: true }]);
    }
    const latestTransition = mongo.rows('va_projection_revisions')[1];
    expect(latestTransition).toMatchObject({
      operation: 'restore',
      source_generation_id: 'pre-drift-snapshot',
      analysis_visibility: 'disabled_pending_revalidation',
      analysis_publication_receipt: null,
    });
  });

  it('rejects a passing report generated for a different projection', async () => {
    const original = {
      institutions: [{ _id: 'va:cc:9302', state: 'va' }],
      courses: [], agreements: [], degrees: [], asDegrees: [],
    };
    const changed = {
      ...original,
      courses: [{ _id: 'va:sending:2', state: 'va', course_id: 2 }],
    };
    const mongo = fakeMongo({
      assist_institutions: [], assist_courses: [], assist_agreements: [],
      curated_requirements: [], va_projection_revisions: [],
      va_projection_revision_documents: [],
    }, 'pmt_research_staging');
    const preflightReport = publicationPreflight({ sourceDocuments: [], projection: original });
    await expect(publishProjection({
      client: mongo.client,
      db: mongo.db,
      projection: changed,
      preflightReport,
      allowIncompleteStaging: true,
    })).rejects.toThrow('not bound to this Virginia projection');
  });

  it('rejects a forged top-level pass without the selected-equivalency audit', async () => {
    const projection = {
      institutions: [{ _id: 'va:cc:9302', state: 'va' }],
      courses: [], agreements: [], degrees: [], asDegrees: [],
    };
    await expect(publishProjection({
      client: null,
      db: null,
      projection,
      preflightReport: {
        publishable: true,
        course_unit_evidence_overlay: passingUnitEvidenceOverlay(),
        ...projectionReceipt(projection),
      },
    })).rejects.toThrow('requires an internally generated, untampered preflight report');
  });

  it('rejects a direct incomplete override against a production-named database', async () => {
    const projection = {
      institutions: [{ _id: 'va:cc:9302', state: 'va' }],
      courses: [], agreements: [], degrees: [], asDegrees: [],
    };
    const report = publicationPreflight({ sourceDocuments: [], projection });
    const mongo = fakeMongo({
      assist_institutions: [], assist_courses: [], assist_agreements: [],
      curated_requirements: [], va_projection_revisions: [],
      va_projection_revision_documents: [],
    });
    await expect(publishProjection({
      client: mongo.client,
      db: mongo.db,
      projection,
      preflightReport: report,
      allowIncompleteStaging: true,
    })).rejects.toThrow('restricted to an allowlisted non-production database');
  });

  it('publishes its private projection snapshot when the caller mutates during an await', async () => {
    const projection = {
      institutions: [{ _id: 'va:cc:9302', state: 'va', name: 'Original' }],
      courses: [], agreements: [], degrees: [], asDegrees: [],
    };
    const report = publicationPreflight({ sourceDocuments: [], projection });
    let releaseRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    const mongo = fakeMongo({
      assist_institutions: [], assist_courses: [], assist_agreements: [],
      curated_requirements: [], va_projection_revisions: [],
      va_projection_revision_documents: [],
    }, 'pmt_research_staging', { beforeRead: () => readGate });

    const publishing = publishProjection({
      client: mongo.client,
      db: mongo.db,
      projection,
      preflightReport: report,
      allowIncompleteStaging: true,
      generationId: 'caller-mutation-generation',
    });
    projection.institutions[0].name = 'Mutated after validation';
    report.publication.figure_readiness.transfer_equivalency_conditions.ready = true;
    releaseRead();
    await publishing;

    expect(mongo.rows('assist_institutions')).toEqual([
      { _id: 'va:cc:9302', state: 'va', name: 'Original' },
    ]);
  });
});

describe('Virginia projection course identity boundary', () => {
  it('keeps Richard Bland MATH251 distinct from the same-code VCCS row', () => {
    const owner = 'va:cc:richard-bland-college';
    const local = institutionCourseIdentity(owner, 'MATH251');
    const shared = sharedCourseIdentity('MATH251');
    const source = asSource({
      _id: 'va:as:richard-bland-college:cs',
      community_college_id: owner,
      course_namespace: namespaceFor(owner),
      course_titles: { MATH251: 'Calculus I' },
      institution_course_catalog: [{
        ...local,
        title: 'Calculus I', units: 4, min_units: 4, max_units: 4,
        unit_evidence: 'single_course_source_section',
      }],
      requirement_groups: [{ title: 'Calculus', sections: [{
        section_advisement: 1, unit_advisement: 4,
        receivers: [{ options: [{
          course_ids: [local.course_id], course_keys: [local.course_key],
          course_conjunction: 'and',
        }] }],
      }] }],
    });
    const projection = buildProjection({
      courses: [{
        ...shared,
        sending_eligible: true,
        title: 'Unrelated shared MATH251', credits: 3,
        offered_by: ['Richard Bland College'],
      }],
      degrees: [],
      asDegrees: [source],
      institutions: [{
        _id: owner, level: 'community_college', name: 'Richard Bland College',
      }],
    });
    const mathRows = projection.courses.filter((row) => row.number === '251');

    expect(mathRows).toHaveLength(2);
    expect(mathRows.find((row) => row.identity_scope === 'institution_local')).toMatchObject({
      course_id: local.course_id,
      course_key: local.course_key,
      institution_id: owner,
      identity_contract: 'owner_plus_course_id',
      vccs_master_applicable: false,
      title: 'Calculus I',
      units: 4,
    });
    expect(mathRows.find((row) => row.identity_scope === 'vccs_shared')).toMatchObject({
      course_id: shared.course_id,
      course_key: shared.course_key,
      institution_id: 'va:vccs',
      title: 'Unrelated shared MATH251',
      units: 3,
    });
    expect(local.course_id).not.toBe(shared.course_id);
  });

  it('adds a missing shared row from degree evidence without inventing bundled units', () => {
    const statistics = sharedCourseIdentity('MTH283');
    const programming = sharedCourseIdentity('CSC221');
    const source = asSource({
      course_titles: {
        MTH283: 'Probability and Statistics',
        CSC221: 'Introduction to Programming',
      },
      requirement_groups: [
        { title: 'Statistics', source_refs: ['major'], sections: [{
          section_advisement: 1, unit_advisement: 3,
          receivers: [{ options: [{
            course_ids: [statistics.course_id], course_keys: [statistics.course_key],
          }] }],
        }] },
        { title: 'Programming bundle', source_refs: ['major'], sections: [{
          section_advisement: 1, unit_advisement: 7,
          receivers: [{ options: [{
            course_ids: [programming.course_id, statistics.course_id],
            course_keys: [programming.course_key, statistics.course_key],
          }] }],
        }] },
      ],
    });
    const projection = buildProjection({
      courses: [], degrees: [], asDegrees: [source],
      institutions: [{
        _id: 'va:cc:brightpoint-community-college',
        level: 'community_college', name: 'Brightpoint Community College',
      }],
    });

    expect(projection.courses.find((row) => row.course_id === statistics.course_id))
      .toMatchObject({
        identity_scope: 'vccs_shared', units: 3, min_units: 3, max_units: 3,
        offered_by: ['Brightpoint Community College'],
        source_requirement_ids: [source._id],
      });
    expect(projection.courses.find((row) => row.course_id === programming.course_id))
      .toMatchObject({
        identity_scope: 'vccs_shared', units: null, min_units: null, max_units: null,
        unit_evidence: 'not_individually_stated',
      });
  });

  it('retains exact owner-degree units when they differ from the shared registry row', () => {
    const identity = sharedCourseIdentity('CSC195');
    const source = asSource({
      course_titles: { CSC195: 'AI Foundations for Computer Science' },
      course_unit_evidence: [{
        ...identity,
        units: 3, min_units: 3, max_units: 3,
        source_refs: ['major'],
      }],
      requirement_groups: [{ title: 'Elective', source_refs: ['major'], sections: [{
        section_advisement: 1,
        unit_advisement: 3,
        receivers: [{ options: [{
          course_ids: [identity.course_id], course_keys: [identity.course_key],
        }] }],
      }] }],
    });
    const projection = buildProjection({
      courses: [{
        ...identity,
        sending_eligible: true,
        title: 'Special Topics in Computer Science',
        credits: 1,
        offered_by: ['Brightpoint Community College'],
      }],
      degrees: [],
      asDegrees: [source],
      institutions: [{
        _id: 'va:cc:brightpoint-community-college',
        level: 'community_college', name: 'Brightpoint Community College',
      }],
    });

    expect(projection.courses.find((row) => row.course_id === identity.course_id))
      .toMatchObject({
        units: 1,
        units_by_source_requirement: [{
          source_requirement_id: source._id,
          units: 3,
          min_units: 3,
          max_units: 3,
          differs_from_global: true,
          source_refs: ['major'],
        }],
      });
  });
});
