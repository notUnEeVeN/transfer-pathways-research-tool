#!/usr/bin/env node
/**
 * Rebuild/check Longwood's exact supplemental Civitae Figure 3/4 evidence.
 * This command is network-only and never opens or writes the database.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  COURSE_SOURCES,
  PROGRAM_SOURCES,
  buildLongwoodCivitaeFigureEvidence,
} = require('../../services/analysis/longwoodCivitaeFigureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const OUTPUT = path.join(
  SERVER, '.va-catalogs', 'research', 'longwood-civitae-figure34-evidence.json',
);
const PAGE = (suffix) => path.join(
  SERVER, '.va-catalogs', 'pages', `longwood-university__${suffix}.txt`,
);
const USER_AGENT = 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

async function get(url) {
  const response = await fetch(url, {
    headers: { accept: 'text/html', 'user-agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function buildFromOfficialCatalog() {
  const programResponses = {};
  const courseResponses = {};
  await Promise.all([
    ...PROGRAM_SOURCES.map(async (source) => {
      programResponses[source.id] = await get(
        `https://catalog.longwood.edu/ajax/preview_program.php?catoid=19&poid=${source.poid}&link_text=x&display_options=&show`,
      );
    }),
    ...COURSE_SOURCES.map(async (source) => {
      courseResponses[source.code] = await get(
        `https://catalog.longwood.edu/ajax/preview_course.php?catoid=19&coid=${source.coid}&display_options%5Blocation%5D=tooltip&show`,
      );
    }),
  ]);
  return buildLongwoodCivitaeFigureEvidence({
    programResponses,
    courseResponses,
    retainedGeText: fs.readFileSync(PAGE('ge'), 'utf8'),
    retainedGeSha256: 'fae1bd018d79fd6b92d6c0df855c3d6997d874bda8efa911396b0adbb2d907e0',
    retainedProgramText: fs.readFileSync(PAGE('program'), 'utf8'),
    retainedProgramSha256: '4a606eb3c72ad6cd10fb96dab19c5fde56c69a187349ff18099c7f2d947f27f0',
  });
}

async function main(argv = process.argv.slice(2)) {
  const write = argv.includes('--write');
  const jsonOnly = argv.includes('--json');
  const unknown = argv.filter((argument) => !['--write', '--json'].includes(argument));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(', ')}`);
  const evidence = await buildFromOfficialCatalog();
  const rendered = `${JSON.stringify(evidence, null, 2)}\n`;
  if (write) {
    fs.writeFileSync(OUTPUT, rendered);
  } else if (!jsonOnly) {
    if (!fs.existsSync(OUTPUT)) throw new Error(`missing checked-in evidence: ${OUTPUT}`);
    if (fs.readFileSync(OUTPUT, 'utf8') !== rendered) {
      throw new Error('Longwood Civitae evidence drifted; inspect and rerun with --write');
    }
  }
  if (jsonOnly) process.stdout.write(rendered);
  else {
    console.log('Longwood Civitae Figure 3/4 evidence: PASS');
    console.log(`  selected distinct courses: ${evidence.deterministic_witness.selected_course_codes.length}`);
    console.log(`  fixed Civitae units: ${evidence.deterministic_witness.total_civitae_units}`);
    console.log(`  Figures proven zero-impact: ${evidence.paper_scope.figures_proven_zero_impact.join(', ')}`);
    console.log(write ? `  wrote ${OUTPUT}` : '  checked artifact: no drift');
  }
  return evidence;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = { OUTPUT, buildFromOfficialCatalog, main };

