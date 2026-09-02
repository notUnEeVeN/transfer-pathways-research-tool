#!/usr/bin/env node
/** Read-only Tidewater Figure 3/4 source-gap check. */
const {
  auditCheckedInTidewaterFigure34OpenRuleEvidence,
} = require('../../services/analysis/tidewaterFigure34OpenRuleEvidence');

function main(argv = process.argv.slice(2)) {
  const unknown = argv.filter((arg) => arg !== '--json');
  if (unknown.length) throw new Error(`unknown option: ${unknown.join(', ')}`);
  const result = auditCheckedInTidewaterFigure34OpenRuleEvidence();
  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Tidewater Figure 3/4 open-rule evidence: ${result.valid ? 'PASS' : 'FAIL'}`);
    console.log(`  active source constraints: ${result.active_constraints.length}`);
    console.log(`  modeled language courses: ${result.world_language.modeled_count}`);
    console.log(`  unadjudicated ASL candidates: ${result.world_language.additional_asl_candidates.length}`);
    console.log(`  institutional questions: ${result.institutional_questions.length}`);
    console.log(`  Figure 3 ready: ${result.figure_3_ready ? 'yes' : 'no'}`);
    console.log(`  Figure 4 ready: ${result.figure_4_ready ? 'yes' : 'no'}`);
    result.issues.forEach((issue) => console.log(`  BLOCK ${issue}`));
  }
  if (!result.valid) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { main };
