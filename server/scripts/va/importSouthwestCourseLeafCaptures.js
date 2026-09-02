#!/usr/bin/env node
/**
 * Import manually rate-limited official Southwest CourseLeaf responses into
 * the deterministic evidence cache. This command never connects to MongoDB
 * and never fetches the network itself.
 *
 * The caller is responsible for observing catalog.sw.edu/robots.txt. Every
 * input must be the unmodified HTTP response body for the exact URL already
 * pinned in southwest-vccs-prerequisite-evidence.json.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  cachePathForRow,
  captureReceipt,
} = require('../../services/virginia/southwestCourseLeafCapture');
const {
  DEFAULT_EVIDENCE,
} = require('../../services/virginia/southwestVccsPrerequisiteEvidence');

const INPUT_FLAGS = Object.freeze({
  ENG249: '--eng249-file',
  ENG268: '--eng268-file',
  PHI102: '--phi102-file',
});

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : null;
}

function validatedCaptures({ argv, artifact }) {
  return (artifact.rows || []).map((row) => {
    const input = valueAfter(argv, INPUT_FLAGS[row.code]);
    if (!input || !fs.existsSync(input)) {
      throw new Error(`${INPUT_FLAGS[row.code]} must name the retained ${row.code} response body`);
    }
    const body = fs.readFileSync(input);
    return {
      row,
      body,
      output: cachePathForRow(row),
      receipt: captureReceipt(body, row),
    };
  });
}

function writeFileAtomic(file, body) {
  const temporary = `${file}.import-${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(temporary, body);
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function importCaptures({ argv = process.argv.slice(2), evidenceFile = DEFAULT_EVIDENCE } = {}) {
  if (!argv.includes('--write')) throw new Error('--write is required to import retained responses');
  const artifact = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  // Validate every input before changing any retained cache. A malformed later
  // response therefore cannot leave a partially imported evidence set.
  const captures = validatedCaptures({ argv, artifact });
  for (const capture of captures) {
    writeFileAtomic(capture.output, capture.body);
    capture.row.source_capture = capture.receipt;
  }
  artifact.schema_version = 3;
  writeFileAtomic(evidenceFile, `${JSON.stringify(artifact, null, 2)}\n`);
  return artifact;
}

if (require.main === module) {
  try {
    const artifact = importCaptures();
    console.log(JSON.stringify({
      imported: artifact.rows.map((row) => ({
        code: row.code,
        ...row.source_capture,
      })),
    }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { INPUT_FLAGS, importCaptures, validatedCaptures };
