import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const {
  conceptFromTitle,
  recomputeAsDegreeCoveredConcepts,
} = cjs('./asDegreeConcepts');

function fakeDb(rows) {
  const toArray = vi.fn(async () => rows);
  const find = vi.fn(() => ({ toArray }));
  return {
    collection: vi.fn((name) => {
      if (name !== 'assist_courses') throw new Error(`unexpected collection ${name}`);
      return { find };
    }),
    find,
    toArray,
  };
}

const option = (...courseIds) => ({
  course_ids: courseIds,
  course_keys: courseIds.map((id) => `cc:${id}`),
});

const foundDoc = {
  status: 'found',
  college_id: 'cc:110',
  community_college_id: 110,
  requirement_groups: [{
    group_id: 'core',
    sections: [{
      receivers: [
        { options: [option(101), option(102, 103)] },
        { options: [option(101)] },
      ],
    }],
    unresolved_courses_seen: [
      { course_code_seen: 'BIO 1', title_seen: 'Introduction to Cell Biology' },
      { course_code_seen: 'HIST 1', title_seen: 'World History' },
    ],
  }],
};

describe('AS-degree covered concept recomputation', () => {
  it('matches importer semantics: catalog concept, then title fallback, plus unresolved titles', async () => {
    const db = fakeDb([
      { course_id: 101, concept: 'cs_3_data_structures', title: 'Unrelated title' },
      { course_id: 102, concept: null, title: 'Linear Algebra' },
      { course_id: 103, concept: null, title: 'No classified topic' },
    ]);

    await expect(recomputeAsDegreeCoveredConcepts(db, foundDoc)).resolves.toEqual([
      'bio_cell_molec',
      'cs_3_data_structures',
      'linear_alg',
    ]);
    expect(db.find).toHaveBeenCalledWith(
      { institution_id: 'cc:110', course_id: { $in: [101, 102, 103] } },
      { projection: { course_id: 1, title: 1, concept: 1 } },
    );
  });

  it('can reuse an already-loaded college catalog without another database query', async () => {
    const db = { collection: vi.fn(() => { throw new Error('must not query'); }) };
    const result = await recomputeAsDegreeCoveredConcepts(db, foundDoc, {
      courses: [
        { course_id: 101, concept: 'cs_1', title: 'Programming I' },
        { course_id: 102, concept: 'discrete_math', title: 'Discrete Mathematics' },
        { course_id: 103, concept: null, title: 'General Chemistry' },
      ],
    });

    expect(result).toEqual(['bio_cell_molec', 'cs_1', 'discrete_math', 'gen_chem_1']);
    expect(db.collection).not.toHaveBeenCalled();
  });

  it('clears derived coverage for non-found rows without querying courses', async () => {
    const db = { collection: vi.fn(() => { throw new Error('must not query'); }) };
    await expect(recomputeAsDegreeCoveredConcepts(db, {
      ...foundDoc, status: 'none_found', requirement_groups: undefined,
    })).resolves.toEqual([]);
    expect(db.collection).not.toHaveBeenCalled();
  });

  it('excludes GE-pattern and units-fill groups like the importer', async () => {
    const doc = {
      ...foundDoc,
      requirement_groups: [
        ...foundDoc.requirement_groups,
        {
          group_id: 'ge', ge_area: 'calgetc', units_fill: false,
          sections: [{ receivers: [{ options: [option(104)] }] }],
          unresolved_courses_seen: [{ course_code_seen: 'CHEM 1', title_seen: 'General Chemistry' }],
        },
        {
          group_id: 'electives', ge_area: null, units_fill: true,
          unresolved_courses_seen: [{ course_code_seen: 'CS 3', title_seen: 'Data Structures' }],
        },
      ],
    };
    const result = await recomputeAsDegreeCoveredConcepts(null, doc, {
      courses: [
        { course_id: 101, concept: 'cs_1', title: 'Programming I' },
        { course_id: 102, concept: null, title: 'Linear Algebra' },
        { course_id: 103, concept: null, title: 'No classified topic' },
        { course_id: 104, concept: 'gen_chem_1', title: 'General Chemistry' },
      ],
    });

    expect(result).toEqual(['bio_cell_molec', 'cs_1', 'linear_alg']);
    expect(result).not.toContain('gen_chem_1');
    expect(result).not.toContain('cs_3_data_structures');
  });

  it('classifies the importer title families used when a catalog concept is absent', () => {
    expect(conceptFromTitle('Data Structures and Algorithms')).toBe('cs_3_data_structures');
    expect(conceptFromTitle('Computer Organization and Assembly')).toBe('comp_arch_assembly');
    expect(conceptFromTitle('Object-Oriented Programming in Java')).toBe('cs_2_oop');
    expect(conceptFromTitle('Differential Equations')).toBe('diff_eq');
    expect(conceptFromTitle('Electricity and Magnetism')).toBe('phys_em');
    expect(conceptFromTitle('Python Programming Fundamentals')).toBe('cs_1');
    expect(conceptFromTitle('Introduction to Biology')).toBe('bio_cell_molec');
    expect(conceptFromTitle('World History')).toBeNull();
  });
});
