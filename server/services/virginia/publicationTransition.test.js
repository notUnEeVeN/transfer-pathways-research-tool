import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startInMemoryMongo } = require('../../test/mongoHarness');
const {
  VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION,
  VA_PUBLICATION_TRANSITION_COUNTER_ID,
  VA_PUBLICATION_TRANSITION_CONTRACT,
  VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION,
  VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
  allocateVirginiaPublicationTransition,
  buildTransitionEvent,
  persistVirginiaPublicationTransition,
  readVirginiaPublicationTransitionLedger,
  validateTransitionLedger,
} = require('./publicationTransition');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('va_publication_transition_test');
}, 60_000);

beforeEach(async () => { await db.dropDatabase(); });
afterAll(async () => { await mongo.stop(); });

describe('Virginia publication transition authority', () => {
  it('allocates one total order even when wall-clock time regresses', async () => {
    const session = mongo.client.startSession();
    try {
      // The production callers wrap both operations in their existing replica-
      // set transaction.  The test harness is a standalone mongod, so exercise
      // the same session-bound atomic allocator without starting a transaction.
      const prerequisite = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'prerequisite',
        operation: 'publish',
        generationId: 'prerequisite-generation',
        createdAt: new Date('2035-01-01T00:00:00.000Z'),
      });
      await persistVirginiaPublicationTransition(db, prerequisite, session);
      const projection = await allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'publish',
        generationId: 'projection-generation',
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      });
      await persistVirginiaPublicationTransition(db, projection, session);
    } finally {
      await session.endSession();
    }

    await expect(readVirginiaPublicationTransitionLedger(db)).resolves.toMatchObject({
      valid: true,
      issue: null,
      events: [
        { sequence: 1, domain: 'prerequisite', generation_id: 'prerequisite-generation' },
        { sequence: 2, domain: 'projection', generation_id: 'projection-generation' },
      ],
    });
    await expect(db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).findOne({}))
      .resolves.toMatchObject({ last_sequence: 2 });
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION)
      .updateOne({}, { $set: { last_sequence: 3 } });
    const corrupted = await readVirginiaPublicationTransitionLedger(db);
    expect(corrupted).toMatchObject({
      valid: false,
      issue: 'publication_transition_ledger_invalid',
    });
    expect(corrupted.detail.map((issue) => issue.code))
      .toContain('transition_counter_ledger_mismatch');
  });

  it('does not consume a sequence for an invalid transition request', async () => {
    const session = mongo.client.startSession();
    try {
      await expect(allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'invented-operation',
        generationId: 'invalid',
        createdAt: new Date('2026-08-25T00:00:00.000Z'),
      })).rejects.toThrow(/unknown Virginia publication transition operation/);
    } finally {
      await session.endSession();
    }
    await expect(db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).findOne({}))
      .resolves.toBeNull();
  });

  it('rejects gaps, duplicate sequences, malformed ids, and an absent legacy ledger', () => {
    const first = buildTransitionEvent({
      sequence: 1,
      domain: 'prerequisite',
      operation: 'publish',
      generationId: 'first',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    const third = buildTransitionEvent({
      sequence: 3,
      domain: 'projection',
      operation: 'restore',
      generationId: 'third',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    expect(validateTransitionLedger([])).toMatchObject({
      valid: false,
      issue: 'publication_transition_ledger_missing',
    });
    expect(validateTransitionLedger([first, third])).toMatchObject({
      valid: false,
      issue: 'publication_transition_ledger_invalid',
    });
    const duplicate = { ...first, _id: `${first._id}:duplicate` };
    const report = validateTransitionLedger([first, duplicate]);
    expect(report.valid).toBe(false);
    expect(report.detail.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'transition_event_id_invalid',
      'transition_sequence_not_contiguous',
    ]));
  });

  it('fails closed instead of adopting an incompatible pre-existing counter', async () => {
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).insertOne({
      _id: 'va:analysis-publication-transition-counter',
      contract: 'legacy-or-untrusted-counter',
      schema_version: 99,
      last_sequence: 9000,
    });
    const session = mongo.client.startSession();
    try {
      await expect(allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'prerequisite',
        operation: 'restore',
        generationId: 'must-not-allocate',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
      })).rejects.toThrow(/transition (?:authority|counter).*corrupt/i);
    } finally {
      await session.endSession();
    }
    await expect(db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).findOne({}))
      .resolves.toMatchObject({
        contract: 'legacy-or-untrusted-counter',
        schema_version: 99,
        last_sequence: 9000,
      });
    await expect(db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).countDocuments({}))
      .resolves.toBe(0);
  });

  it('refuses a canonical counter whose state is not Virginia', async () => {
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).insertOne({
      _id: VA_PUBLICATION_TRANSITION_COUNTER_ID,
      contract: VA_PUBLICATION_TRANSITION_CONTRACT,
      schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
      state: 'ca',
      last_sequence: 2,
    });
    const session = mongo.client.startSession();
    try {
      await expect(allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'publish',
        generationId: 'wrong-state-must-not-allocate',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
      })).rejects.toThrow(/transition (?:authority|counter).*corrupt/i);
    } finally {
      await session.endSession();
    }
    await expect(db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).findOne({}))
      .resolves.toMatchObject({ state: 'ca', last_sequence: 2 });
    await expect(db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).countDocuments({}))
      .resolves.toBe(0);
  });

  it('does not mutate an otherwise valid authority when any ledger row is malformed', async () => {
    const first = buildTransitionEvent({
      sequence: 1,
      domain: 'prerequisite',
      operation: 'publish',
      generationId: 'first-valid-generation',
      createdAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).insertMany([
      first,
      { ...buildTransitionEvent({
        sequence: 2,
        domain: 'projection',
        operation: 'publish',
        generationId: 'hidden-malformed-generation',
        createdAt: new Date('2026-08-25T01:00:00.000Z'),
      }), state: 'ma' },
    ]);
    await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).insertOne({
      _id: VA_PUBLICATION_TRANSITION_COUNTER_ID,
      contract: VA_PUBLICATION_TRANSITION_CONTRACT,
      schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
      state: 'va',
      last_sequence: 2,
    });
    const session = mongo.client.startSession();
    try {
      await expect(allocateVirginiaPublicationTransition({
        db,
        session,
        domain: 'projection',
        operation: 'restore',
        generationId: 'must-not-append',
        createdAt: new Date('2026-08-26T00:00:00.000Z'),
      })).rejects.toThrow(/authority is corrupt/i);
    } finally {
      await session.endSession();
    }
    await expect(db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION).findOne({}))
      .resolves.toMatchObject({ last_sequence: 2 });
    await expect(db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION).countDocuments({}))
      .resolves.toBe(2);
  });
});
