/**
 * Rebuild an AS-degree document's derived concept coverage from its current
 * agreement-skeleton courses. This mirrors scripts/import_as_degrees.py:
 * a curated catalog concept wins, otherwise the catalog/unresolved title is
 * classified with the importer's conservative title rules.
 */

function conceptFromTitle(title) {
  const value = String(title || '').toLowerCase();
  if (/data struct/.test(value)) return 'cs_3_data_structures';
  if (/discrete/.test(value)) return 'discrete_math';
  if (/comput(er)? (org|architecture)|assembly|organization/.test(value)) return 'comp_arch_assembly';
  if (/object.orient|\boop\b|advanced (java|c\+\+|programming)|program(ming)? (ii|2)|intermediate (java|c\+\+|programming)|programming concepts (ii|2)/.test(value)) return 'cs_2_oop';
  if (/calculus ii|calculus 2|calc ii\b|analytic geometry.*ii/.test(value)) return 'calc_2';
  if (/calculus iii|calculus 3|multivariable|calculus.*iii/.test(value)) return 'calc_3';
  if (/linear algebra/.test(value)) return 'linear_alg';
  if (/differential equations/.test(value)) return 'diff_eq';
  if (/calculus|analytic geometry/.test(value)) return 'calc_1';
  if (/mechanic|physics.*i\b|general physics.*i|physics for scien.*i/.test(value)) return 'phys_mech';
  if (/electricity|magnetism|physics.*ii|e&m|physics for scien.*ii/.test(value)) return 'phys_em';
  if (/introduction to (computer )?program|programming (fundamentals|i|concepts (i|methodology i)|1)|intro.*programming|problem solv|program structures|computer science i\b|cs 1\b/.test(value)) return 'cs_1';
  if (/program|java|c\+\+|python|software/.test(value)) return 'cs_1';
  if (/general chem|chemistry/.test(value)) return 'gen_chem_1';
  if (/biolog|cell/.test(value)) return 'bio_cell_molec';
  return null;
}

function courseIdsFromDoc(doc) {
  const ids = new Set();
  for (const group of doc?.requirement_groups || []) {
    // Import semantics: GE-pattern and fill/elective groups do not represent
    // subject coverage, even if a malformed/legacy row happens to carry
    // nested course references.
    if (group?.ge_area != null || group?.units_fill === true) continue;
    for (const section of group?.sections || []) {
      for (const receiver of section?.receivers || []) {
        for (const option of receiver?.options || []) {
          for (const rawId of option?.course_ids || []) {
            if (Number.isInteger(rawId)) ids.add(rawId);
          }
        }
      }
    }
  }
  return [...ids];
}

function unresolvedTitlesFromDoc(doc) {
  const titles = [];
  for (const group of doc?.requirement_groups || []) {
    if (group?.ge_area != null || group?.units_fill === true) continue;
    for (const unresolved of group?.unresolved_courses_seen || []) {
      if (typeof unresolved?.title_seen === 'string') titles.push(unresolved.title_seen);
    }
  }
  return titles;
}

async function recomputeAsDegreeCoveredConcepts(db, doc, { courses = null } = {}) {
  if (doc?.status !== 'found') return [];

  const courseIds = courseIdsFromDoc(doc);
  let catalogRows = courses;
  if (catalogRows == null) {
    catalogRows = courseIds.length
      ? await db.collection('assist_courses').find(
        { institution_id: doc.college_id, course_id: { $in: courseIds } },
        { projection: { course_id: 1, title: 1, concept: 1 } },
      ).toArray()
      : [];
  }

  const wanted = new Set(courseIds);
  const byCourseId = new Map((catalogRows || [])
    .filter((course) => wanted.has(Number(course.course_id)))
    .map((course) => [Number(course.course_id), course]));
  const concepts = new Set();
  for (const courseId of courseIds) {
    const course = byCourseId.get(courseId);
    if (!course) continue;
    const concept = typeof course.concept === 'string' && course.concept
      ? course.concept
      : conceptFromTitle(course.title);
    if (concept) concepts.add(concept);
  }
  for (const title of unresolvedTitlesFromDoc(doc)) {
    const concept = conceptFromTitle(title);
    if (concept) concepts.add(concept);
  }
  return [...concepts].sort();
}

module.exports = {
  conceptFromTitle,
  recomputeAsDegreeCoveredConcepts,
  _courseIdsFromDoc: courseIdsFromDoc,
};
