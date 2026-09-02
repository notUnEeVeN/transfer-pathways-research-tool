const fs = require('node:fs');
const {
  cachePathForRow,
} = require('../../services/virginia/southwestCourseLeafCapture');
const {
  DEFAULT_EVIDENCE,
} = require('../../services/virginia/southwestVccsPrerequisiteEvidence');
const {
  validatedCaptures,
} = require('./importSouthwestCourseLeafCaptures');

const artifact = JSON.parse(fs.readFileSync(DEFAULT_EVIDENCE, 'utf8'));

function argvFor(rows = artifact.rows) {
  return rows.flatMap((row) => [
    `--${row.code.toLowerCase()}-file`,
    cachePathForRow(row),
  ]);
}

describe('offline Southwest response importer', () => {
  it('validates all exact official response bodies before the write phase', () => {
    const captures = validatedCaptures({ argv: argvFor(), artifact: structuredClone(artifact) });
    expect(captures.map((capture) => capture.row.code)).toEqual(['ENG249', 'ENG268', 'PHI102']);
    expect(captures.every((capture) => (
      capture.output === cachePathForRow(capture.row)
      && capture.receipt.extracted_entry_sha256 === capture.row.raw_entry_sha256
    ))).toBe(true);
  });

  it('fails before returning a partial capture plan when any input is missing', () => {
    const argv = argvFor().filter((_, index) => index < 4);
    expect(() => validatedCaptures({ argv, artifact: structuredClone(artifact) }))
      .toThrow(/phi102-file.*retained PHI102 response/);
  });
});
