import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  typeOfCourseCode, typeOfText, categoriesOfReceiver, degreeCategoryOf,
} from './courseTypesBio';
import { getMajor } from '../config/majors';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = JSON.parse(fs.readFileSync(
  path.resolve(HERE, '../../scripts/data/uc_degree_requirements_bio.json'), 'utf8'
));

/** Every "PREFIX NUMBER" token in one campus's requirement groups. */
function courseCodesOf(campus) {
  const codes = new Map();
  JSON.stringify(campus.groups).replace(
    /"([A-Z][A-Z ]{0,8}?) 0*(\d+[A-Z]*)"/g,
    (match, prefix, number) => { codes.set(`${prefix} ${number}`, [prefix, number]); return match; }
  );
  return codes;
}

describe('biology course typing', () => {
  it('types every course in the nine templates into a substantive category', () => {
    // The Non-STEM fallthrough is correct for GE and writing blocks, which have
    // no course code. A COURSE reaching it means a prefix is missing from the
    // tables, and the figure would silently show it as non-STEM coursework.
    const fellThrough = [];
    for (const [key, campus] of Object.entries(TEMPLATES)) {
      if (key === '_meta') continue;
      for (const [code, [prefix, number]] of courseCodesOf(campus)) {
        if (typeOfCourseCode(campus.school_id, prefix, number, '') === 'non_stem') {
          fellThrough.push(`${campus.school} ${code}`);
        }
      }
    }
    expect(fellThrough).toEqual([]);
  });

  it('every category it emits is declared on the major', () => {
    const declared = new Set(getMajor('bio').categories.map((category) => category.key));
    const emitted = new Set();
    for (const [key, campus] of Object.entries(TEMPLATES)) {
      if (key === '_meta') continue;
      for (const [, [prefix, number]] of courseCodesOf(campus)) {
        emitted.add(typeOfCourseCode(campus.school_id, prefix, number, ''));
      }
    }
    for (const category of emitted) expect(declared).toContain(category);
  });

  it('resolves the CHEM 3A collision by campus', () => {
    // Organic chemistry at Berkeley, general chemistry at Santa Cruz. Typing
    // without campus context would get one of them wrong.
    expect(typeOfCourseCode(79, 'CHEM', '3A')).toBe('organic_chem');
    expect(typeOfCourseCode(132, 'CHEM', '3A')).toBe('gen_chem');
  });

  it('reads leading zeroes and bare numbers as the same course', () => {
    expect(typeOfCourseCode(89, 'CHE', '008A')).toBe('organic_chem');
    expect(typeOfCourseCode(89, 'CHE', '8A')).toBe('organic_chem');
  });

  it('keeps both courses in UC San Diego\'s CHEM 41 organic sequence together', () => {
    expect(typeOfCourseCode(7, 'CHEM', '41A')).toBe('organic_chem');
    expect(typeOfCourseCode(7, 'CHEM', '41B')).toBe('organic_chem');
  });

  it('applies the UC Merced option-list overrides', () => {
    // Merced states computing and statistics as cross-department option lists,
    // so prefix alone files biostatistics under biology and probability under
    // calculus.
    expect(typeOfCourseCode(144, 'BIO', '018')).toBe('statistics');
    expect(typeOfCourseCode(144, 'MATH', '032')).toBe('statistics');
    expect(typeOfCourseCode(144, 'ME', '021')).toBe('computing');
    // The override is campus-scoped: a MATH 32 elsewhere is still calculus.
    expect(typeOfCourseCode(132, 'MATH', '032')).toBe('calculus');
  });

  it('types UCLA Life Sciences 30A/B by their calculus role', () => {
    expect(typeOfCourseCode(117, 'LIFESCI', '30A', 'Mathematics for Life Scientists'))
      .toBe('calculus');
    expect(typeOfCourseCode(117, 'LIFESCI', '30B', 'Mathematics for Life Scientists'))
      .toBe('calculus');
  });

  it('counts a combined chemistry series against both disciplines', () => {
    // Berkeley states general and organic chemistry as one indivisible series.
    // It is satisfied only when all of it articulates, so neither "type by the
    // first course" nor "type by the last" is true.
    const universityCoursesById = {
      1: { prefix: 'CHEM', number: '1A', title: 'General Chemistry' },
      2: { prefix: 'CHEM', number: '3A', title: 'Organic Chemistry' },
      3: { prefix: 'CHEM', number: '3B', title: 'Organic Chemistry' },
    };
    const receiver = { receiving: { kind: 'series', parent_ids: [1, 2, 3] } };
    const categories = categoriesOfReceiver(79, receiver, null, universityCoursesById);
    expect(categories).toContain('gen_chem');
    expect(categories).toContain('organic_chem');
    // The primary is the first, so a rollup into figure columns cannot
    // double-count the slot.
    expect(categories[0]).toBe('gen_chem');
  });

  it('types free-text requirements without a course code', () => {
    expect(typeOfText('Lower-division organic chemistry — one complete series')).toBe('organic_chem');
    expect(typeOfText('L&S general education remaining after canonical MCB overlap')).toBe('non_stem');
    expect(typeOfText('UC-transferable elective capacity to the 120-unit minimum')).toBe('non_stem');
    expect(typeOfText('Lower-division physics')).toBe('physics');
  });

  it('returns an array from the buildDegreeGroups callback', () => {
    const categoryOf = degreeCategoryOf(79, {
      1: { prefix: 'BILD', number: '1', title: 'The Cell' },
    });
    expect(categoryOf({ receiver: { receiving: { kind: 'course', parent_id: 1 } } }))
      .toEqual(['bio_series']);
  });

});

describe('biology figure taxonomy', () => {
  const { courseTypes, categories } = getMajor('bio');

  it('assigns every fine category to exactly one column in each axis set', () => {
    const keys = categories.map((category) => category.key);
    for (const [name, axes] of Object.entries(courseTypes.axes)) {
      const assigned = axes.flatMap((axis) => axis.categories);
      expect(new Set(assigned).size, `${name} assigns a category twice`).toBe(assigned.length);
      expect([...assigned].sort()).toEqual([...keys].sort());
    }
  });

  it('keeps the faithful rollup at four columns, mirroring Computer Science', () => {
    expect(courseTypes.axes.faithful).toHaveLength(getMajor('cs').courseTypes.axes.faithful.length);
    expect(courseTypes.axes.faithful.map((axis) => axis.label))
      .toEqual(['Biology', 'Math', 'Chemistry & Physics', 'Non-STEM']);
  });

  it('never splits general from organic chemistry in either Figure 2 variant', () => {
    // The gen/organic split exists only for Figure 5's panels. If a Figure 2
    // rollup separated them, the combined-series double assignment would
    // double-count a slot inside one column.
    for (const axes of Object.values(courseTypes.axes)) {
      const withGen = axes.find((axis) => axis.categories.includes('gen_chem'));
      expect(withGen.categories).toContain('organic_chem');
    }
  });

  it('gives Figure 5 six panels drawn from the declared categories', () => {
    const keys = new Set(categories.map((category) => category.key));
    expect(courseTypes.barrierPanels).toHaveLength(6);
    for (const panel of courseTypes.barrierPanels) expect(keys).toContain(panel.key);
  });

  it('leaves Computer Science with no extended variant to toggle into', () => {
    expect(getMajor('cs').courseTypes.axes.extended).toBeUndefined();
  });
});

describe('biology GE group titles', () => {
  it('does not read a GE block as biology just because it names the major', () => {
    // "Campus/College GE remaining after Biology overlap" describes what is
    // LEFT once the major's science is counted. Matching on `biolog` would file
    // the whole general-education block as biology coursework.
    expect(typeOfText('Campus/College GE remaining after Biology overlap')).toBe('non_stem');
    expect(typeOfText('Cal-GETC/IGETC lower GE remaining after Biology overlap')).toBe('non_stem');
    expect(typeOfText('L&S B.S. GE remaining after Biology overlap')).toBe('non_stem');
    expect(typeOfText('Campuswide GE remaining after Biology/DC overlap')).toBe('non_stem');
  });
});
