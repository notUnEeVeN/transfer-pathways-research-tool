import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { baselinesData, evidenceData } = cjs('./Massachusetts');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('ma_baselines_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

describe('baselinesData', () => {
  it('groups published values by measure with resident rows separated', async () => {
    await db.collection('ma_paper_baselines').insertMany([
      { _id: 'b1', measure: 'pct_as', school_id: 9001, school: 'Bridgewater', community_college_id: 9103, college_name: 'Bunker Hill Community College', value: 0.508, state: 'ma' },
      { _id: 'b2', measure: 'credit_hours', school_id: 9001, school: 'Bridgewater', community_college_id: null, value: 120, state: 'ma' },
      { _id: 'b3', measure: 'credit_hours', school_id: 9001, school: 'Bridgewater', community_college_id: 9103, college_name: 'Bunker Hill Community College', value: 149, state: 'ma' },
    ]);

    const payload = await baselinesData(db);
    expect(payload.measures.pct_as.cells).toHaveLength(1);
    expect(payload.measures.pct_as.cells[0]).toMatchObject({ school_id: 9001, community_college_id: 9103, value: 0.508 });
    expect(payload.measures.credit_hours.resident).toEqual([
      expect.objectContaining({ school_id: 9001, value: 120 }),
    ]);
    expect(payload.measures.credit_hours.cells).toHaveLength(1);
    expect(payload.source).toMatch(/CurrComp Master/);
  });
});

describe('evidenceData', () => {
  it('leads with the final-PDF rule and quarantines legacy verdict prose', () => {
    const evidence = evidenceData();
    expect(evidence.authority).toMatch(/Final PDF/);
    expect(evidence.evidence_rule).toMatch(/version divergence, not a final-paper error/i);
    expect(evidence.final_pdf).toBeTruthy();
    expect(evidence.complexity).toBeTruthy();
    expect(evidence.archived_diagnostics.caution).toMatch(/must not be quoted/i);
    expect(evidence.archived_diagnostics.reconciliation).not.toHaveProperty('cells');
    expect(evidence.archived_diagnostics.reconciliation.summary).not.toHaveProperty('verdicts');
  });
});
