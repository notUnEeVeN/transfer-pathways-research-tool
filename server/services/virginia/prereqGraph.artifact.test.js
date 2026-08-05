import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const { virginiaPrerequisiteGraphData } = cjs('./prereqGraph');

const conceptsArtifact = JSON.parse(readFileSync(
  new URL('../../../scripts/data/va_course_concepts.json', import.meta.url),
  'utf8',
));
const requisitesArtifact = JSON.parse(readFileSync(
  new URL('../../../scripts/data/va_course_requisites.json', import.meta.url),
  'utf8',
));
const vocabulary = JSON.parse(readFileSync(
  new URL('../../../scripts/data/prereq_concepts.json', import.meta.url),
  'utf8',
));

const RICHARD_BLAND = 'Richard Bland College';

const slugOf = (value) => String(value || '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('va_prereq_artifact_integration');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

async function seedGeneratedCorpus() {
  const direct = conceptsArtifact.rows.filter((row) => row.scope_role === 'major_preparation');
  const colleges = [...new Set(direct.flatMap((row) => row.scope_colleges || []))].sort();

  await Promise.all([
    db.collection('va_course_concepts').insertMany(conceptsArtifact.rows),
    db.collection('va_course_requisites').insertMany(requisitesArtifact.rows),
    db.collection('curated_requirements').insertMany(vocabulary.concepts.map((concept) => ({
      _id: `prereq_concept:${concept.slug}`,
      kind: 'prereq_concept',
      ...concept,
    }))),
    db.collection('va_institutions').insertMany(colleges.map((name) => ({
      _id: `va:inst:${slugOf(name)}`,
      name,
      level: 'community_college',
    }))),
  ]);
}

describe('generated Virginia prerequisite corpus integration', () => {
  beforeEach(seedGeneratedCorpus);

  it('serves the complete 335-course direct ledger and its published closure', async () => {
    const data = await virginiaPrerequisiteGraphData(db);
    const direct = data.courses.filter((row) => row.in_scope);

    expect(data.stats).toMatchObject({
      corpus_available: true,
      in_scope: 335,
      examined: 335,
      mapped: 81,
      richard_bland_only: 69,
    });
    expect(direct).toHaveLength(335);
    expect(new Set(direct.map((row) => row.key)).size).toBe(335);
    expect(data.courses).toHaveLength(359);
    expect(data.missing).toEqual([]);
    expect(data.courses.every((row) => /^va:[A-Z]/.test(row.key))).toBe(true);
    expect(data.scope.course_scope_source).toBe('va_prerequisite_scope_artifacts');

    const mth263 = data.rules.find((row) => row.dependent_course_key === 'va:MTH263');
    expect(mth263.paths.map((path) => path.all_of.map((condition) => condition.course_key)))
      .toEqual([['va:MTH167'], ['va:MTH161', 'va:MTH162']]);

    for (const code of ['BIO141', 'EGR121']) {
      expect(data.rules).toContainEqual(expect.objectContaining({
        dependent_course_key: `va:${code}`,
        provisional: true,
        satisfiable_in_projection: null,
      }));
      expect(data.edges.some((edge) => edge.to === `va:${code}`)).toBe(false);
    }
  });

  it('projects Richard Bland as local mapping evidence without VCCS policy', async () => {
    const data = await virginiaPrerequisiteGraphData(db, { college: RICHARD_BLAND });
    const direct = data.courses.filter((row) => row.in_scope);

    expect(data.projection).toMatchObject({
      mode: 'community_college',
      label: expect.stringMatching(/mapping review/i),
      disclaimer: expect.stringMatching(/no published institution-local prerequisite policy/i),
    });
    expect(data.scope).toMatchObject({ authority: 'not_vccs', coverage: 'not_vccs' });
    expect(direct).toHaveLength(75);
    expect(data.stats.institution_local).toBe(75);
    expect(data.rules).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(direct.find((row) => row.key === 'va:SOC201')).toMatchObject({
      title: 'General Sociology',
      concept: 'intro_sociology',
      scope_kind: 'institution_local',
    });
    expect(direct.find((row) => row.key === 'va:REL210')).toMatchObject({
      title: 'Social History of Christianity',
      concept: null,
      scope_kind: 'institution_local',
      source: 'institution_local_override',
    });
  });
});
