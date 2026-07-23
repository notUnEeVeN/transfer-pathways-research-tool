import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { list } = cjs('./DegreeRequirements');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('degree_requirements_controller_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.dropDatabase();
  await db.collection('assist_institutions').insertOne({
    kind: 'university', source_id: 79, academic_calendar: 'semester',
  });
  await db.collection('curated_requirements').insertOne({
    _id: 'degree:79:bio',
    kind: 'degree',
    school_id: 79,
    school: 'UC Berkeley',
    major_slug: 'bio',
    program: 'Molecular and Cell Biology, B.A.',
    total_units: 120,
    catalog_year: '2026-27',
    college: 'College of Letters and Science',
    academic_unit: 'Molecular and Cell Biology',
    ge_authority: 'College of Letters and Science',
    research_status: 'ai_researched_needs_human_verification',
    source_method: 'ai_web_research',
    sources: [{
      id: 'ucb-bio-major',
      kind: 'major',
      label: 'MCB requirements',
      url: 'https://undergraduate.catalog.berkeley.edu/mcb',
    }],
    unit_audit: { graduation_minimum: 120, modeled_units: 120 },
    modeling_notes: ['Human verification is still required.'],
    requirement_groups: [],
  });
});

function run() {
  return new Promise((resolve, reject) => {
    const req = { app: { locals: { db } } };
    const res = {
      json(body) { resolve(body); return this; },
    };
    Promise.resolve(list(req, res, (error) => (error ? reject(error) : null)))
      .catch(reject);
  });
}

describe('GET /degree-requirements', () => {
  it('serves the dimensional template provenance needed by the verification UI', async () => {
    const body = await run();
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0]).toMatchObject({
      major_slug: 'bio',
      catalog_year: '2026-27',
      academic_unit: 'Molecular and Cell Biology',
      ge_authority: 'College of Letters and Science',
      research_status: 'ai_researched_needs_human_verification',
      source_method: 'ai_web_research',
      sources: [expect.objectContaining({ id: 'ucb-bio-major' })],
      unit_audit: { graduation_minimum: 120, modeled_units: 120 },
    });
  });
});
