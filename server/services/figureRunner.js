/**
 * Figure runner — executes a partner's figure script in a subprocess so live
 * figures can be recomputed against current data.
 *
 * Isolation model (trusted collaborators, not a hard sandbox):
 *   - The environment is built from scratch — never inherited — so Mongo URIs,
 *     Firebase credentials, ADMIN_UIDS and anything else in process.env can't
 *     reach partner code. The subprocess sees only PMT_* plus python/matplotlib
 *     housekeeping vars.
 *   - Data access goes through the normal HTTP API with a short-lived
 *     ephemeral token minted for the figure's author, so every enforcement
 *     layer (allowlist, major visibility, rate limits) applies unchanged.
 *   - starter.py and its old pmt.py alias are written fresh into the workdir
 *     each run, pointed at this server, with PMT_CAPTURE set: publish() writes
 *     its payload to a file
 *     instead of POSTing, and the caller decides what to store.
 *   - A wall-clock kill, an output cap, and a small serial queue bound
 *     resource use.
 */
const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createEphemeralToken } = require('./apiTokens');

const DEFAULT_TIMEOUT_MS = 60 * 1000;
const DEFAULT_MAX_OUTPUT_BYTES = 64 * 1024;

async function executeScript({
  code,
  pmtSource,
  pythonBin,
  apiBaseUrl,
  token,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
  workRoot = os.tmpdir(),
}) {
  const started = Date.now();
  const workdir = await fs.mkdtemp(path.join(workRoot, 'pmt-fig-run-'));
  const captureFile = path.join(workdir, '_capture.json');
  try {
    const mplDir = path.join(workdir, '.mpl');
    await fs.mkdir(mplDir);
    await fs.writeFile(path.join(workdir, 'starter.py'), pmtSource, 'utf8');
    await fs.writeFile(path.join(workdir, 'pmt.py'), pmtSource, 'utf8');
    await fs.writeFile(path.join(workdir, 'script.py'), code, 'utf8');

    // Absolute interpreters (venvs) get their own dir prepended so sibling
    // tools resolve; a bare "python3" must NOT contribute "." — that would put
    // the partner-writable workdir first on PATH.
    const baseDirs = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];
    const pathDirs = path.isAbsolute(pythonBin) ? [path.dirname(pythonBin), ...baseDirs] : baseDirs;
    const env = {
      PATH: pathDirs.join(':'),
      HOME: workdir,
      TMPDIR: workdir,
      LANG: 'C.UTF-8',
      LC_ALL: 'C.UTF-8',
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONUNBUFFERED: '1',
      MPLBACKEND: 'Agg',
      MPLCONFIGDIR: mplDir,
      PMT_API_URL: apiBaseUrl,
      PMT_TOKEN: token,
      PMT_CAPTURE: captureFile,
    };

    let log = '';
    let truncated = false;
    let timedOut = false;
    const append = (chunk) => {
      if (truncated) return;
      log += chunk.toString('utf8');
      if (log.length > maxOutputBytes) {
        log = log.slice(0, maxOutputBytes);
        truncated = true;
      }
    };

    // detached → the child leads its own process group, so the kill below can
    // take out any grandchildren it spawned, not just the python process.
    const child = spawn(pythonBin, ['script.py'], {
      cwd: workdir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    let exited = false;
    const killGroup = () => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already gone */ }
      try { child.kill('SIGKILL'); } catch { /* already dead */ }
    };
    const timer = setTimeout(() => {
      if (exited) return;
      timedOut = true;
      killGroup();
    }, timeoutMs);
    // Completion races 'close' (streams drained — the normal path) against
    // 'exit' + a short grace: a grandchild inheriting our pipes would hold
    // 'close' open forever and wedge the run queue with it.
    const exitCode = await new Promise((resolve) => {
      let settled = false;
      const settle = (code) => { if (!settled) { settled = true; resolve(code); } };
      child.on('error', (e) => {
        append(Buffer.from(`[runner] failed to start python: ${e.message}\n`));
        settle(-1);
      });
      child.on('close', (codeOrNull) => settle(codeOrNull ?? -1));
      child.on('exit', (codeOrNull) => {
        exited = true;
        setTimeout(() => settle(codeOrNull ?? -1), 250);
      });
    });
    clearTimeout(timer);
    killGroup(); // reap anything the script left running in its group

    if (truncated) log += '\n… output truncated …';
    const durationMs = Date.now() - started;
    const result = { exitCode, log, durationMs, captured: null };

    if (timedOut) {
      return { ...result, status: 'timeout', exitCode: null, log: `${log}\n[runner] killed after ${timeoutMs}ms` };
    }

    let captureBroken = false;
    try {
      result.captured = JSON.parse(await fs.readFile(captureFile, 'utf8'));
    } catch (e) {
      if (e.code !== 'ENOENT') captureBroken = true;
    }
    if (exitCode !== 0) return { ...result, status: 'error', captured: null };
    if (captureBroken) {
      return { ...result, status: 'error', captured: null, log: `${log}\n[runner] the capture file was not valid JSON` };
    }
    return { ...result, status: 'ok' };
  } finally {
    await fs.rm(workdir, { recursive: true, force: true }).catch(() => {});
  }
}

// Execute as a console user: mint a run-scoped credential, run, always revoke.
// The token outlives the timeout slightly so a run never dies mid-fetch to an
// expired credential.
async function runAsUser({ auditDb, uid, ...opts }) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { token, revoke } = await createEphemeralToken(auditDb, uid, { ttlMs: timeoutMs + 60 * 1000 });
  try {
    return await executeScript({ ...opts, token });
  } finally {
    await revoke().catch(() => {});
  }
}

// One-at-a-time queue with a shallow waiting line: interactive publishes and
// scheduled refreshes share it, so partner scripts never stack up on the box.
function createRunQueue({ concurrency = 1, maxPending = 8 } = {}) {
  let active = 0;
  const waiting = [];
  const pump = () => {
    while (active < concurrency && waiting.length) {
      const { fn, resolve, reject } = waiting.shift();
      active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  };
  return {
    push(fn) {
      if (active + waiting.length >= concurrency + maxPending) {
        const err = new Error('runner busy — try again shortly');
        err.code = 'QUEUE_FULL';
        return Promise.reject(err);
      }
      return new Promise((resolve, reject) => {
        waiting.push({ fn, resolve, reject });
        pump();
      });
    },
  };
}

module.exports = {
  executeScript,
  runAsUser,
  createRunQueue,
  DEFAULT_TIMEOUT_MS,
};
