/**
 * One transactional ordering authority for every Virginia publication change.
 *
 * Projection and Figure-6 prerequisite snapshots live in different
 * collections.  Their UUIDs and wall-clock timestamps cannot provide a total
 * order: UUIDs are random, timestamps can tie, and clocks can move backwards.
 * Both publishers therefore allocate a sequence from one counter and append a
 * manifest-bound event in the same Mongo transaction as the data replacement.
 *
 * Legacy snapshot rows intentionally remain valid rollback material, but they
 * are not publication authority.  A database without this ledger fails closed
 * until prerequisites and then the projection are republished by the current
 * writers.
 */

const VA_PUBLICATION_TRANSITION_CONTRACT = 'va-analysis-publication-transition-v1';
const VA_PUBLICATION_TRANSITION_SCHEMA_VERSION = 1;
const VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION
  = 'va_analysis_publication_transition_counters';
const VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION
  = 'va_analysis_publication_transitions';
const VA_PUBLICATION_TRANSITION_COUNTER_ID = 'va:analysis-publication-transition-counter';

const DOMAIN_CONFIG = Object.freeze({
  projection: Object.freeze({ revision_collection: 'va_projection_revisions' }),
  prerequisite: Object.freeze({ revision_collection: 'va_figure6_prerequisite_revisions' }),
});
const OPERATIONS = new Set(['publish', 'restore']);

function validDate(value) {
  return value != null && Number.isFinite(new Date(value).getTime());
}

function transitionEventId(sequence) {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error('Virginia publication transition sequence must be a positive safe integer');
  }
  return `va:analysis-publication-transition:${String(sequence).padStart(16, '0')}`;
}

function transitionBinding(event) {
  return {
    contract: event.contract,
    schema_version: event.schema_version,
    sequence: event.sequence,
    event_id: event._id,
    domain: event.domain,
  };
}

function buildTransitionEvent({ sequence, domain, operation, generationId, createdAt }) {
  const config = DOMAIN_CONFIG[domain];
  if (!config) throw new Error(`unknown Virginia publication transition domain ${domain}`);
  if (!OPERATIONS.has(operation)) {
    throw new Error(`unknown Virginia publication transition operation ${operation}`);
  }
  if (typeof generationId !== 'string' || !generationId.trim()) {
    throw new Error('Virginia publication transition generation id is required');
  }
  if (!validDate(createdAt)) {
    throw new Error('Virginia publication transition created_at must be a valid date');
  }
  return {
    _id: transitionEventId(sequence),
    contract: VA_PUBLICATION_TRANSITION_CONTRACT,
    schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
    sequence,
    state: 'va',
    domain,
    revision_collection: config.revision_collection,
    generation_id: generationId,
    operation,
    created_at: createdAt,
  };
}

async function allocateVirginiaPublicationTransition({
  db,
  session,
  domain,
  operation,
  generationId,
  createdAt,
}) {
  if (!db?.collection || !session) {
    throw new Error('Virginia publication transition allocation requires a database transaction');
  }
  // Validate every caller-owned field before the counter mutation.  The
  // publishers also run this inside a transaction, but the allocator itself
  // should never consume a sequence for an invalid event.
  buildTransitionEvent({
    sequence: 1,
    domain,
    operation,
    generationId,
    createdAt,
  });
  const existingAuthority = await readVirginiaPublicationTransitionLedger(db, { session });
  if (existingAuthority.issue
      && existingAuthority.issue !== 'publication_transition_ledger_missing') {
    throw new Error(
      `Virginia publication transition authority is corrupt: ${existingAuthority.issue}`,
    );
  }
  let counter;
  try {
    counter = await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION)
      .findOneAndUpdate(
        {
          _id: VA_PUBLICATION_TRANSITION_COUNTER_ID,
          contract: VA_PUBLICATION_TRANSITION_CONTRACT,
          schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
          state: 'va',
        },
        {
          $inc: { last_sequence: 1 },
          $set: { updated_at: createdAt },
          $setOnInsert: {
            _id: VA_PUBLICATION_TRANSITION_COUNTER_ID,
            contract: VA_PUBLICATION_TRANSITION_CONTRACT,
            schema_version: VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
            state: 'va',
          },
        },
        {
          upsert: true,
          returnDocument: 'after',
          includeResultMetadata: false,
          session,
        },
      );
  } catch (error) {
    throw new Error(
      `Virginia publication transition counter is incompatible or corrupt: ${error.message}`,
    );
  }
  if (!Number.isSafeInteger(counter?.last_sequence) || counter.last_sequence <= 0
      || counter.contract !== VA_PUBLICATION_TRANSITION_CONTRACT
      || counter.schema_version !== VA_PUBLICATION_TRANSITION_SCHEMA_VERSION
      || counter.state !== 'va') {
    throw new Error('Virginia publication transition counter returned an invalid sequence');
  }
  const event = buildTransitionEvent({
    sequence: counter.last_sequence,
    domain,
    operation,
    generationId,
    createdAt,
  });
  return { event, binding: transitionBinding(event) };
}

async function persistVirginiaPublicationTransition(db, transition, session) {
  if (!transition?.event || !transition?.binding) {
    throw new Error('Virginia publication transition event and binding are required');
  }
  const expected = transitionBinding(transition.event);
  if (JSON.stringify(transition.binding) !== JSON.stringify(expected)) {
    throw new Error('Virginia publication transition binding does not match its event');
  }
  await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION)
    .insertOne(transition.event, { session });
}

function transitionEventIssues(event) {
  const issues = [];
  const config = DOMAIN_CONFIG[event?.domain];
  if (event?.contract !== VA_PUBLICATION_TRANSITION_CONTRACT
      || event?.schema_version !== VA_PUBLICATION_TRANSITION_SCHEMA_VERSION
      || event?.state !== 'va') {
    issues.push('transition_contract_invalid');
  }
  if (!Number.isSafeInteger(event?.sequence) || event.sequence <= 0) {
    issues.push('transition_sequence_invalid');
  } else if (event._id !== transitionEventId(event.sequence)) {
    issues.push('transition_event_id_invalid');
  }
  if (!config || event?.revision_collection !== config.revision_collection) {
    issues.push('transition_domain_invalid');
  }
  if (!OPERATIONS.has(event?.operation)) issues.push('transition_operation_invalid');
  if (typeof event?.generation_id !== 'string' || !event.generation_id.trim()) {
    issues.push('transition_generation_id_invalid');
  }
  if (!validDate(event?.created_at)) issues.push('transition_created_at_invalid');
  return issues;
}

function validateTransitionLedger(events = []) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      valid: false,
      issue: 'publication_transition_ledger_missing',
      detail: [],
      events: [],
    };
  }
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const detail = [];
  for (const [index, event] of ordered.entries()) {
    for (const code of transitionEventIssues(event)) {
      detail.push({ event_id: event?._id || null, code });
    }
    const expectedSequence = index + 1;
    if (event?.sequence !== expectedSequence) {
      detail.push({
        event_id: event?._id || null,
        code: 'transition_sequence_not_contiguous',
        expected: expectedSequence,
        actual: event?.sequence ?? null,
      });
    }
  }
  return {
    valid: detail.length === 0,
    issue: detail.length ? 'publication_transition_ledger_invalid' : null,
    detail,
    events: ordered,
  };
}

async function readVirginiaPublicationTransitionLedger(db, { session = null } = {}) {
  const options = session ? { session } : undefined;
  const events = await db.collection(VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION)
    // This is a dedicated authority collection. Filtering to the expected
    // contract/state would let a malformed newer row become invisible while
    // an older publication remained enabled.
    .find({}, options)
    .toArray();
  const counters = await db.collection(VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION)
    // Likewise, an unexpected second counter is corruption, not unrelated
    // application data that can safely be ignored.
    .find({}, options)
    .toArray();
  const ledger = validateTransitionLedger(events);
  if (counters.length === 0
      && ledger.issue === 'publication_transition_ledger_missing') return ledger;

  const detail = [...ledger.detail];
  if (counters.length !== 1) {
    detail.push({
      event_id: null,
      code: 'transition_counter_count_invalid',
      expected: 1,
      actual: counters.length,
    });
  }
  const counter = counters.length === 1 ? counters[0] : null;
  if (counter && (counter._id !== VA_PUBLICATION_TRANSITION_COUNTER_ID
      || counter.contract !== VA_PUBLICATION_TRANSITION_CONTRACT
      || counter.schema_version !== VA_PUBLICATION_TRANSITION_SCHEMA_VERSION
      || counter.state !== 'va'
      || !Number.isSafeInteger(counter.last_sequence)
      || counter.last_sequence <= 0)) {
    detail.push({ event_id: null, code: 'transition_counter_invalid' });
  } else if (counter) {
    const lastEventSequence = ledger.events.at(-1)?.sequence ?? 0;
    if (counter.last_sequence !== lastEventSequence) {
      detail.push({
        event_id: null,
        code: 'transition_counter_ledger_mismatch',
        counter: counter.last_sequence,
        ledger: lastEventSequence,
      });
    }
  }
  if (!ledger.valid || detail.length) {
    return {
      valid: false,
      issue: 'publication_transition_ledger_invalid',
      detail,
      events: ledger.events,
    };
  }
  return ledger;
}

module.exports = {
  DOMAIN_CONFIG,
  VA_PUBLICATION_TRANSITION_CONTRACT,
  VA_PUBLICATION_TRANSITION_COUNTER_COLLECTION,
  VA_PUBLICATION_TRANSITION_COUNTER_ID,
  VA_PUBLICATION_TRANSITION_LEDGER_COLLECTION,
  VA_PUBLICATION_TRANSITION_SCHEMA_VERSION,
  allocateVirginiaPublicationTransition,
  buildTransitionEvent,
  persistVirginiaPublicationTransition,
  readVirginiaPublicationTransitionLedger,
  transitionBinding,
  transitionEventId,
  transitionEventIssues,
  validateTransitionLedger,
};
