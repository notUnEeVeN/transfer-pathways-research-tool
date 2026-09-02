#!/usr/bin/env node
/** Read-only replay for JMU MATH 234, ODU MATH 100, and W&M CSCI 141L. */

const fs = require('node:fs');
const path = require('node:path');
const {
  buildExactVirginiaParentMap,
  compileValidatedVirginiaFormulaCorpora,
} = require('../../services/analysis/pathwayComplexity');
const {
  TARGET_KEYS,
  buildUniversityPrerequisiteTailControl,
  reciprocalWilliamMaryCompilerRows,
  resolveUniversityPrerequisiteTailCandidate,
} = require('../../services/virginia/universityPrerequisiteTailClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const RAW = path.join(SERVER, '.va-catalogs/university-prerequisites/raw');
const CANDIDATES = path.join(
  SERVER, '.va-catalogs/research/va-university-prerequisite-candidates.json',
);

function inputs() {
  return {
    jmuMathHtml: fs.readFileSync(path.join(
      RAW, 'james-madison-university/james-madison-university__math.html',
    ), 'utf8'),
    oduMathHtml: fs.readFileSync(path.join(
      RAW, 'old-dominion-university/old-dominion-university__math.html',
    ), 'utf8'),
    wmCsciHtml: fs.readFileSync(path.join(
      RAW, 'william-mary/william-mary__csci.html',
    ), 'utf8'),
  };
}

function productionCycleProbe(control) {
  const wmRows = reciprocalWilliamMaryCompilerRows(control);
  const vccs = {
    course_key: 'va:CSC100',
    owner_namespace: 'va:vccs',
    status: 'none',
    source: 'vccs_master_course_file',
    source_url: 'https://courses.vccs.edu/courses/CSC100',
    raw_requisites: null,
    groups: [],
  };
  const compiled = compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows: [vccs],
    universityRows: wmRows,
    requiredCommunityCollegeKeys: [vccs.course_key],
    requiredUniversityKeys: wmRows.map((row) => row.course_key),
  });
  if (!compiled.ready) return { compiled, graph: null };
  return {
    compiled,
    graph: buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [vccs.course_key, ...wmRows.map((row) => row.course_key)],
    }),
  };
}

function run() {
  const control = buildUniversityPrerequisiteTailControl(inputs());
  if (!control.verified) throw new Error(`tail source replay failed: ${control.issues.join(',')}`);
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8')).candidates;
  const resolutions = Object.fromEntries(TARGET_KEYS.map((key) => {
    const candidate = candidates.find((row) => `${row.slug}:${row.course_code}` === key);
    return [key, resolveUniversityPrerequisiteTailCandidate(candidate, control)];
  }));
  if (!resolutions['james-madison-university:MATH234']?.ready
      || resolutions['james-madison-university:MATH234']?.status !== 'parsed'
      || !resolutions['old-dominion-university:MATH100']?.ready
      || resolutions['old-dominion-university:MATH100']?.status !== 'none'
      || resolutions['william-mary:CSCI141L']?.ready
      || !resolutions['william-mary:CSCI141L']?.blocked) {
    throw new Error('tail candidate disposition changed');
  }
  const probe = productionCycleProbe(control);
  if (!probe.compiled.ready || probe.graph?.ready
      || !probe.graph?.issues?.some((issue) => issue.code === 'requisite_graph_cycle')) {
    throw new Error('W&M reciprocal corequisite production-cycle probe changed');
  }
  console.log('University prerequisite tail closure: PASS');
  console.log('  JMU MATH234: parsed exact MATH233 C- prerequisite (not structural-none)');
  console.log('  ODU MATH100: structural-none with 2 retained zero-edge signals');
  console.log('  W&M CSCI141L: exact formula, blocked by reciprocal requisite_graph_cycle');
  console.log(`  facts SHA-256: ${control.facts_sha256}`);
  return { control, resolutions, cycle_probe: probe };
}

if (require.main === module) {
  try { run(); } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { CANDIDATES, RAW, inputs, productionCycleProbe, run };
