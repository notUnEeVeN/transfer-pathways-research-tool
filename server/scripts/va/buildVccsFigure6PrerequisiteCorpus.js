#!/usr/bin/env node
/**
 * Build the deterministic VCCS half of the Virginia Figure 6 publication
 * corpus.  The legacy research artifact remains the source input; this script
 * adapts it to the strict owner-scoped v2 contract, binds every row to the
 * complete VCCS source bundle, and refuses to emit an incomplete corpus.
 *
 * The default is read-only.  Use --write only to refresh the checked-in
 * publication candidate after the in-memory validation passes.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  VA_FIGURE6_PREREQUISITE_CONTRACT,
  adaptVccsPrerequisiteArtifact,
  officialHostsForPrerequisiteScope,
  officialSourceEvidenceIssues,
  requiredVccsCourseKeys,
  sha256,
  sourceBundleHashForRows,
  validateVccsFigure6PrerequisiteCorpus,
} = require('../../services/virginia/pathwayComplexityPrerequisites');

const SERVER = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(SERVER, '..');
const CORPUS_ARTIFACT = 'virginia_figure6_prerequisite_corpus';
const DEFAULT_SOURCE = path.join(REPO, 'scripts', 'data', 'va_course_requisites.json');
const DEFAULT_SCOPE = path.join(SERVER, '.va-degrees', 'cs_course_scope.json');
const DEFAULT_UNIVERSITY_SCOPE = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'va-university-prerequisite-scope.json',
);
const DEFAULT_OUTPUT = path.join(
  SERVER,
  '.va-catalogs',
  'research',
  'va-vccs-course-requisites.json',
);

const readJsonBytes = (file) => {
  const bytes = fs.readFileSync(file);
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
};

function buildVccsFigure6PrerequisiteCorpus({
  sourceArtifact,
  scope,
  universityScope,
  sourceArtifactSha256 = null,
  scopeSha256 = null,
} = {}) {
  const adapted = adaptVccsPrerequisiteArtifact(sourceArtifact, scope);
  if (!adapted.report.ready) {
    const summary = adapted.report.issues
      .map((issue) => `${issue.path}:${issue.code}`).join(', ');
    throw new Error(`refusing incomplete VCCS Figure 6 corpus: ${summary}`);
  }

  const ordered = [...adapted.rows].sort((left, right) => (
    String(left.course_key).localeCompare(String(right.course_key))
  ));
  const sourceBundleHash = sourceBundleHashForRows(ordered, 'va:vccs');
  const rows = ordered.map((row) => ({
    ...row,
    source_bundle_hash: sourceBundleHash,
  }));
  const strict = validateVccsFigure6PrerequisiteCorpus({
    rows,
    requiredKeys: requiredVccsCourseKeys(scope),
  });
  const sourceIssues = officialSourceEvidenceIssues(rows, {
    role: 'community_college',
    officialHostsByOwner: officialHostsForPrerequisiteScope(universityScope),
    allowedOwners: ['va:vccs'],
  });
  if (!strict.ready || sourceIssues.length) {
    const summary = [...strict.issues, ...sourceIssues]
      .map((issue) => `${issue.path}:${issue.code}`).join(', ');
    throw new Error(`refusing invalid VCCS Figure 6 corpus: ${summary}`);
  }

  return {
    schema_version: 1,
    artifact: CORPUS_ARTIFACT,
    contract_version: VA_FIGURE6_PREREQUISITE_CONTRACT.version,
    corpus_role: 'community_college',
    source_artifact: 'scripts/data/va_course_requisites.json',
    source_artifact_sha256: sourceArtifactSha256,
    required_scope_artifact: 'server/.va-degrees/cs_course_scope.json',
    required_scope_sha256: scopeSha256,
    source_bundle_hash: sourceBundleHash,
    counts: strict.counts,
    rows,
  };
}

function optionsFrom(argv = process.argv.slice(2)) {
  const knownValues = new Set(['--source', '--scope', '--university-scope', '--output']);
  const options = {
    write: false,
    json: false,
    sourceFile: DEFAULT_SOURCE,
    scopeFile: DEFAULT_SCOPE,
    universityScopeFile: DEFAULT_UNIVERSITY_SCOPE,
    outputFile: DEFAULT_OUTPUT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--write') options.write = true;
    else if (arg === '--json') options.json = true;
    else if (knownValues.has(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`missing value for ${arg}`);
      index += 1;
      if (arg === '--source') options.sourceFile = path.resolve(value);
      if (arg === '--scope') options.scopeFile = path.resolve(value);
      if (arg === '--university-scope') options.universityScopeFile = path.resolve(value);
      if (arg === '--output') options.outputFile = path.resolve(value);
    } else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function run(options = optionsFrom()) {
  const source = readJsonBytes(options.sourceFile);
  const scope = readJsonBytes(options.scopeFile);
  const universityScope = readJsonBytes(options.universityScopeFile);
  const artifact = buildVccsFigure6PrerequisiteCorpus({
    sourceArtifact: source.value,
    scope: scope.value,
    universityScope: universityScope.value,
    sourceArtifactSha256: sha256(source.bytes),
    scopeSha256: sha256(scope.bytes),
  });
  const bytes = `${JSON.stringify(artifact, null, 2)}\n`;
  const report = {
    ready: true,
    rows: artifact.rows.length,
    required: artifact.counts.required,
    parsed: artifact.counts.parsed,
    none: artifact.counts.none,
    source_bundle_hash: artifact.source_bundle_hash,
    artifact_sha256: sha256(bytes),
    output: options.outputFile,
    matches_checked_in: fs.existsSync(options.outputFile)
      && fs.readFileSync(options.outputFile, 'utf8') === bytes,
    wrote: false,
  };
  if (options.write) {
    fs.mkdirSync(path.dirname(options.outputFile), { recursive: true });
    fs.writeFileSync(options.outputFile, bytes);
    report.matches_checked_in = true;
    report.wrote = true;
  }
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log('[va:figure6-vccs-corpus] READY');
    console.log(`  rows        ${report.rows}`);
    console.log(`  required    ${report.required}`);
    console.log(`  bundle      ${report.source_bundle_hash}`);
    console.log(`  artifact    ${report.artifact_sha256}`);
    console.log(options.write
      ? `  wrote       ${report.output}`
      : `  dry run     ${report.matches_checked_in ? 'checked-in artifact matches' : 'checked-in artifact missing or stale'}`);
  }
  return { artifact, bytes, report };
}

if (require.main === module) {
  try {
    run();
  } catch (error) {
    console.error(`[va:figure6-vccs-corpus] BLOCKED ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  CORPUS_ARTIFACT,
  DEFAULT_OUTPUT,
  DEFAULT_SCOPE,
  DEFAULT_SOURCE,
  DEFAULT_UNIVERSITY_SCOPE,
  buildVccsFigure6PrerequisiteCorpus,
  optionsFrom,
  run,
};
