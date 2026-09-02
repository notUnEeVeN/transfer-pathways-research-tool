/**
 * Deterministic source fingerprint for Virginia's publication authority.
 *
 * Publication receipts outlive a server process. Content manifests alone
 * cannot prove that the code which currently interprets those documents still
 * reaches the same readiness verdict. Starting at the production publisher
 * and publication-readiness evaluator, walk every literal, repository-local
 * CommonJS dependency and hash both its stable server-relative path and exact
 * bytes. Any evaluator, proof, configuration, or imported evidence change
 * therefore invalidates an older receipt until the projection is republished
 * under the new code.
 *
 * The value is memoized because a running process executes the modules it
 * loaded at startup. Deployments must restart the process, at which point the
 * checked-out sources are fingerprinted again.
 */

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CONTRACT = 'va-publication-evaluator-source-graph-v1';
const SERVER_ROOT = fs.realpathSync(path.resolve(__dirname, '../..'));
const ROOT_FILES = Object.freeze([
  path.resolve(SERVER_ROOT, 'scripts/va/buildVaDocuments.js'),
  path.resolve(SERVER_ROOT, 'services/virginia/publicationReadiness.js'),
]);
const LITERAL_REQUIRE = /\brequire\s*\(\s*(['"])([^'"\r\n]+)\1\s*\)/g;
const HASHED_EXTENSIONS = new Set(['.cjs', '.js', '.json']);

let memoized = null;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function withinServerRoot(filename) {
  const relative = path.relative(SERVER_ROOT, filename);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
    && relative !== 'node_modules'
    && !relative.startsWith(`node_modules${path.sep}`);
}

function resolveLocalDependency(specifier, parentFile) {
  let resolved;
  try {
    resolved = require.resolve(specifier, { paths: [path.dirname(parentFile)] });
  } catch {
    // An unresolved token can occur in explanatory text. It is not executable
    // by Node and therefore is not a production dependency.
    return null;
  }
  if (!path.isAbsolute(resolved)) return null;
  const real = fs.realpathSync(resolved);
  if (!withinServerRoot(real) || !HASHED_EXTENSIONS.has(path.extname(real))) return null;
  return real;
}

function literalDependencies(filename, source) {
  const dependencies = new Set();
  LITERAL_REQUIRE.lastIndex = 0;
  let match;
  while ((match = LITERAL_REQUIRE.exec(source)) !== null) {
    const resolved = resolveLocalDependency(match[2], filename);
    if (resolved) dependencies.add(resolved);
  }
  return [...dependencies].sort();
}

function collectSourceGraph() {
  const pending = ROOT_FILES.map((filename) => fs.realpathSync(filename));
  const seen = new Set();
  const files = [];
  while (pending.length) {
    const filename = pending.pop();
    if (seen.has(filename)) continue;
    seen.add(filename);
    const bytes = fs.readFileSync(filename);
    const relativePath = path.relative(SERVER_ROOT, filename).split(path.sep).join('/');
    files.push({ path: relativePath, sha256: sha256(bytes) });
    if (path.extname(filename) !== '.json') {
      for (const dependency of literalDependencies(filename, bytes.toString('utf8'))) {
        if (!seen.has(dependency)) pending.push(dependency);
      }
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function currentVirginiaPublicationEvaluatorFingerprint() {
  if (memoized) return memoized;
  const files = collectSourceGraph();
  const combined = createHash('sha256');
  combined.update(`${CONTRACT}\n`);
  for (const file of files) combined.update(`${file.path}\0${file.sha256}\n`);
  memoized = Object.freeze({
    contract: CONTRACT,
    algorithm: 'sha256',
    sha256: combined.digest('hex'),
    file_count: files.length,
    files: Object.freeze(files.map((file) => Object.freeze(file))),
  });
  return memoized;
}

module.exports = {
  VA_PUBLICATION_EVALUATOR_FINGERPRINT_CONTRACT: CONTRACT,
  currentVirginiaPublicationEvaluatorFingerprint,
};
