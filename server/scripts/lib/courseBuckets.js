/**
 * Title classification of receiving courses, shared by the Price of Place
 * snapshot generator and the course-repair simulator.
 *
 * v2 — the validated-audit rebuild. Computing families are classified at
 * course-TYPE granularity, so same-class evidence means a like course
 * (a data-structures course supported by data-structures acceptance), not a
 * loosely related one. Order matters: first match wins, and three ordering
 * rules are deliberate:
 *   - statistics and probability are checked before every computing pattern,
 *     so "Probability and Statistics for Computer Science" is statistics;
 *   - the differential-equations rule requires the word "equation", so
 *     "Differential and Integral Calculus" is calculus;
 *   - the generic programming / "computer science" pattern is the LAST
 *     computing rule — a catch-all for further programming coursework, never
 *     an umbrella that swallows organization, statistics, or software titles.
 */
const CLASSES = [
  // Mathematics and statistics first: computing titles often embed them.
  ['statistics', /statist|probabilit/i, 'Statistics and probability'],
  ['discrete', /discrete|mathematics for algorithms/i, 'Discrete mathematics'],
  ['linear_algebra', /linear alg/i, 'Linear algebra'],
  ['differential', /differential equation/i, 'Differential equations'],
  ['calculus', /calculus|analytic geometry|infinite series/i, 'Calculus'],
  ['physics', /physics/i, 'Calculus-based physics'],
  // Computing, finest classes first.
  ['data_structures', /data structure/i, 'Data structures'],
  ['algorithms', /algorithm/i, 'Algorithms'],
  ['software_eng', /software/i, 'Software construction and engineering'],
  ['computer_org', /computer organi|computer architect|logic design|digital system|system design/i, 'Computer organization'],
  ['assembly_systems', /assembl|machine structure|computer systems|systems programming/i, 'Assembly and systems programming'],
  ['intro_programming_2', /(?:introduction to comput|intro to comput|introduction to programming|intro to programming|principles of computer science|problem solving with computers|programming abstractions|programming fundamentals|programming concepts|c programming)[^]*\b(?:ii|2)\b|\bcse 8b\b/i, 'Introductory programming II'],
  ['intro_programming', /introduction to comput|intro to comput|introduction to programming|intro to programming|beginning programming|principles of computer science|problem solving with computers|programming abstractions|programming fundamentals|programming concepts|\bpython\b|c programming|programming in c\b/i, 'Introductory programming'],
  ['programming_other', /\bprogram|\bc\+\+|java(?!nese)|\bcomputer science\b|object[- ]oriented/i, 'Further programming courses'],
  // The rest of the curriculum keeps its family granularity.
  ['organic_chem', /organic chem/i, 'Organic chemistry'],
  ['chemistry', /chem/i, 'General chemistry'],
  ['biology', /biolog|physiolog|anatomy|molecular|cell/i, 'Biology sequence'],
  ['language', /spanish|french|german|japanese|chinese|italian|korean|latin|language|russian|portuguese/i, 'Foreign language sequence'],
  ['music', /music/i, 'Music theory and performance'],
  ['art_studio', /studio|drawing|painting|sculpture/i, 'Studio art sequence'],
  ['composition', /composition|writing|rhetoric|reading/i, 'Composition and writing'],
  ['economics', /econom/i, 'Economics principles'],
  ['psychology', /psycholog/i, 'Psychology core'],
];

/** Computing-adjacent classes: the "CS-flavored requirement" set used for the
 * arch, the ingredient gradients, and campus core-share profiles. Statistics
 * stays out (a CS-serving statistics course is still statistics). */
const COMPUTING_IDS = new Set([
  'data_structures', 'algorithms', 'software_eng', 'computer_org',
  'assembly_systems', 'intro_programming', 'intro_programming_2',
  'programming_other', 'discrete',
]);

/** The introductory sequence: the "lowest bar" scenario's unit. CS1 and CS2
 * are separate evidence classes but one policy unit. */
const INTRO_IDS = new Set(['intro_programming', 'intro_programming_2']);

function bucketOf(title) {
  for (const [id, re, name] of CLASSES) if (re.test(title)) return { id, name };
  return null;
}

// v1 compatibility: the finer taxonomy IS the type layer now. Kept as a
// named export so the probes and generators that asked for types keep
// working; both names classify identically.
const courseTypeOf = bucketOf;

// v1 alias for consumers that iterated the rule table.
const BUCKETS = CLASSES;

module.exports = { CLASSES, BUCKETS, COMPUTING_IDS, INTRO_IDS, bucketOf, courseTypeOf };
