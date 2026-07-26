/**
 * Coarse, transparent title classification of receiving courses, shared by
 * the Price of Place snapshot generator and the course-repair simulator.
 * Order matters: first match wins.
 */
const BUCKETS = [
  ['discrete', /discrete|mathematics for algorithms/i, 'Discrete mathematics'],
  ['linear_algebra', /linear alg/i, 'Linear algebra'],
  ['differential', /differential/i, 'Differential equations'],
  ['calculus', /calculus|analytic geometry/i, 'Calculus'],
  ['physics', /physics/i, 'Calculus-based physics'],
  ['programming', /data structure|program|software engineering|software construction|problem solving with computers|\bcomputer science\b|\bc\+\+|java(?!nese)/i, 'Programming and data structures'],
  ['architecture', /computer organi|computer architect|assembl|machine structure|logic design|digital system/i, 'Computer organization'],
  ['organic_chem', /organic chem/i, 'Organic chemistry'],
  ['chemistry', /chem/i, 'General chemistry'],
  ['statistics', /statist|probability/i, 'Statistics and probability'],
  ['biology', /biolog|physiolog|anatomy|molecular|cell/i, 'Biology sequence'],
  ['language', /spanish|french|german|japanese|chinese|italian|korean|latin|language|russian|portuguese/i, 'Foreign language sequence'],
  ['music', /music/i, 'Music theory and performance'],
  ['art_studio', /studio|drawing|painting|sculpture/i, 'Studio art sequence'],
  ['composition', /composition|writing|rhetoric|reading/i, 'Composition and writing'],
  ['economics', /econom/i, 'Economics principles'],
  ['psychology', /psycholog/i, 'Psychology core'],
];

function bucketOf(title) {
  for (const [id, re, name] of BUCKETS) if (re.test(title)) return { id, name };
  return null;
}

// Finer course types for the repair figures: the programming and organization
// families split into recognisable course kinds. Non-computing families keep
// their bucket granularity. Order matters: first match wins.
const COMPUTING_TYPES = [
  ['data_structures', /data structure/i, 'Data structures'],
  ['systems_assembly', /assembl|machine structure|computer organi|logic design|digital system|computer systems|systems programming/i, 'Computer organization and systems'],
  ['software_eng', /software/i, 'Software construction and engineering'],
  ['intro_programming', /introduction to|intro to|beginning|principles of computer science|problem solving with computers|programming abstractions|\bpython\b|c programming|programming in c/i, 'Introductory programming'],
];
function courseTypeOf(title) {
  const bucket = bucketOf(title);
  if (!bucket) return null;
  // A probability/statistics course for CS majors is a statistics course.
  if (/probabilit|statisti/i.test(title)) return { id: 'statistics', name: 'Statistics and probability' };
  if (bucket.id === 'programming' || bucket.id === 'architecture') {
    for (const [id, re, name] of COMPUTING_TYPES) if (re.test(title)) return { id, name };
    return { id: 'programming_other', name: 'Further programming courses' };
  }
  return bucket;
}

module.exports = { BUCKETS, bucketOf, courseTypeOf };
