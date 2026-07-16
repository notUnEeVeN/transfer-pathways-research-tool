import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { projectEdges, projectPrereqEdges, prerequisiteGraphData } = cjs('./prereqGraph');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('prereq_graph_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

const CONCEPTS = [
  { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: [] },
  { slug: 'calc_2', name: 'Calculus II', discipline: 'math', requires: ['calc_1'] },
  { slug: 'calc_3', name: 'Calculus III', discipline: 'math', requires: ['calc_2'] },
  { slug: 'linear_alg', name: 'Linear Algebra', discipline: 'math', requires: ['calc_3'] },
  { slug: 'diff_eq', name: 'Differential Equations', discipline: 'math', requires: ['linear_alg'] },
];
const course = (id, college, concept, extra = {}) => ({
  _id: `cc:${id}`, side: 'sending', course_id: id, institution_id: `cc:${college}`,
  community_college_id: college, prefix: 'MATH', number: String(id), title: `Course ${id}`,
  ...(concept === undefined ? {} : { concept, concept_source: 'llm_session_v1', concept_confidence: 1 }),
  ...extra,
});

describe('projectEdges', () => {
  it('projects direct edges within one college', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(2, 10, 'calc_2'), course(3, 10, 'calc_3'),
    ]);
    expect(edges.get('cc:2')).toEqual(['cc:1']);
    expect(edges.get('cc:3')).toEqual(['cc:2']);
    expect(edges.get('cc:1')).toEqual([]);
  });

  it('falls through a concept the college lacks (transitive fallback)', () => {
    // College 20 has no linear_alg course → diff_eq requires its calc_3 course.
    const edges = projectEdges(CONCEPTS, [
      course(21, 20, 'calc_3'), course(22, 20, 'diff_eq'),
    ]);
    expect(edges.get('cc:22')).toEqual(['cc:21']);
  });

  it('never crosses colleges', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(21, 20, 'calc_2'),
    ]);
    expect(edges.get('cc:21')).toEqual([]);
  });

  it('registers combined-course concepts under everything they satisfy', () => {
    const withCombined = [...CONCEPTS, {
      slug: 'linear_alg_diff_eq', name: 'Linear Algebra + Differential Equations',
      discipline: 'math', requires: ['calc_3'], satisfies: ['linear_alg', 'diff_eq'],
    }, {
      slug: 'engr_circuits', name: 'Circuits', discipline: 'engr', requires: ['diff_eq'],
    }];
    // College 30 offers calc_3, a combined LA+DE course, and circuits.
    const edges = projectEdges(withCombined, [
      course(31, 30, 'calc_3'), course(32, 30, 'linear_alg_diff_eq'), course(33, 30, 'engr_circuits'),
    ]);
    expect(edges.get('cc:32')).toEqual(['cc:31']);   // combined ← calc_3
    expect(edges.get('cc:33')).toEqual(['cc:32']);   // circuits finds diff_eq via satisfies
  });

  it('gives examined-not-relevant courses an empty entry and skips unexamined ones', () => {
    const edges = projectEdges(CONCEPTS, [
      course(5, 10, null),          // examined, no concept
      course(6, 10, undefined),     // never examined
    ]);
    expect(edges.get('cc:5')).toEqual([]);
    expect(edges.has('cc:6')).toBe(false);
  });

  it('links every local course mapped to a required concept', () => {
    const edges = projectEdges(CONCEPTS, [
      course(1, 10, 'calc_1'), course(7, 10, 'calc_1'), course(2, 10, 'calc_2'),
    ]);
    expect(new Set(edges.get('cc:2'))).toEqual(new Set(['cc:1', 'cc:7']));
  });
});

describe('prerequisiteGraphData', () => {
  beforeEach(async () => {
    await db.collection('curated_requirements').insertMany(CONCEPTS.map((c) => ({
      _id: `prereq_concept:${c.slug}`, kind: 'prereq_concept', legacy_id: c.slug, ...c,
    })));
    await db.collection('assist_courses').insertMany([
      course(1, 10, 'calc_1', { concept_note: 'obvious fit' }), course(2, 10, 'calc_2'), course(6, 10, undefined),
    ]);
    await db.collection('assist_agreements').insertOne({
      college_id: 'cc:10', university_id: 'uc:1', major: 'CS',
      requirement_groups: [{ sections: [{ receivers: [
        { options: [{ course_ids: [1, 2] }] },
        { options: [{ course_ids: [6, 999] }] },   // 999 = phantom
      ] }] }],
    });
    await db.collection('curated_prerequisites').insertOne({
      _id: 'cc:2', course_id: 'cc:2', institution_id: 'cc:10', prerequisite_ids: ['cc:1', 'cc:6'],
    });
  });

  it('returns the concept DAG without a college', async () => {
    const data = await prerequisiteGraphData(db, {});
    expect(data.concepts).toHaveLength(5);
    expect(data.rules).toContainEqual({ from: 'calc_1', to: 'calc_2' });
    expect(data.courses).toBeUndefined();
    expect(data.stats.examined).toBe(2);
    // agreement references ids 1, 2, 6, 999 but only 1, 2, 6 exist in the catalog
    expect(data.stats.in_scope).toBe(3);
  });

  it('returns courses, edges, phantom ids, and legacy overlap for a college', async () => {
    const data = await prerequisiteGraphData(db, { collegeKey: 'cc:10' });
    const keys = data.courses.map((c) => c.key).sort();
    expect(keys).toEqual(['cc:1', 'cc:2', 'cc:6']);       // in-scope ∪ examined
    expect(data.courses.find((c) => c.key === 'cc:6').in_scope).toBe(true);
    expect(data.courses.find((c) => c.key === 'cc:1').concept_note).toBe('obvious fit');
    expect(data.edges).toContainEqual({ from: 'cc:1', to: 'cc:2' });
    expect(data.stats.phantom_course_ids).toEqual([999]);
    expect(data.stats.in_scope).toBe(3);
    expect(data.stats.examined).toBe(2);
    // legacy row for cc:2 claims [cc:1, cc:6]; we project [cc:1] → 1 shared of 2 legacy, 1 projected
    expect(data.legacy).toEqual({
      courses_compared: 1, legacy_edges: 2, projected_edges: 1, shared_edges: 1,
    });
  });
});

describe('projectPrereqEdges', () => {
  it('loads and projects from the db', async () => {
    await db.collection('curated_requirements').insertMany(CONCEPTS.map((c) => ({
      _id: `prereq_concept:${c.slug}`, kind: 'prereq_concept', legacy_id: c.slug, ...c,
    })));
    await db.collection('assist_courses').insertMany([course(1, 10, 'calc_1'), course(2, 10, 'calc_2')]);
    const edges = await projectPrereqEdges(db);
    expect(edges.get('cc:2')).toEqual(['cc:1']);
  });
});
