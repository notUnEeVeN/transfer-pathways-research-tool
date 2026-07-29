/**
 * Polite HTTP client with an on-disk cache for the ARTSYS import.
 *
 * ARTSYS is a public student-facing site run by a third party (Quottly /
 * Parchment), not an API we have been granted. Three consequences are encoded
 * here rather than left to the caller: a bounded concurrency, a delay between
 * requests, and a persistent cache so re-running the importer after a parser
 * change costs zero requests. A full pass is ~9,600 pages; without the cache
 * every iteration of the parser would re-fetch all of them.
 *
 * The cache is keyed on the URL and never expires on its own — refreshing is an
 * explicit `--refresh`, because ARTSYS updates on a term boundary, not
 * continuously, and a silent mid-run refresh would mix two vintages into one
 * import.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const BASE = 'https://artsys.usmd.edu';
const USER_AGENT = 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class ArtsysClient {
  constructor({
    cacheDir,
    delayMs = 350,
    concurrency = 4,
    refresh = false,
    maxRetries = 3,
  } = {}) {
    this.cacheDir = cacheDir;
    this.delayMs = delayMs;
    this.concurrency = Math.max(1, concurrency);
    this.refresh = refresh;
    this.maxRetries = maxRetries;
    this.stats = { hits: 0, misses: 0, errors: 0, retries: 0 };
    this._chain = Promise.resolve();
    if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
  }

  cachePath(url) {
    if (!this.cacheDir) return null;
    const key = createHash('sha1').update(url).digest('hex');
    return path.join(this.cacheDir, `${key}.html`);
  }

  readCache(url) {
    const file = this.cachePath(url);
    if (!file || this.refresh || !fs.existsSync(file)) return null;
    return fs.readFileSync(file, 'utf8');
  }

  writeCache(url, body) {
    const file = this.cachePath(url);
    if (file) fs.writeFileSync(file, body);
  }

  /** Serialize the politeness delay across all in-flight callers. */
  async _throttle() {
    const wait = this._chain.then(() => sleep(this.delayMs));
    this._chain = wait;
    await wait;
  }

  async get(pathOrUrl) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`;
    const cached = this.readCache(url);
    if (cached != null) { this.stats.hits += 1; return cached; }

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      await this._throttle();
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
          redirect: 'follow',
        });
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status}`);
        }
        if (!res.ok) {
          this.stats.errors += 1;
          return null;
        }
        const body = await res.text();
        this.stats.misses += 1;
        this.writeCache(url, body);
        return body;
      } catch (error) {
        if (attempt === this.maxRetries) {
          this.stats.errors += 1;
          return null;
        }
        this.stats.retries += 1;
        // Back off hard on throttling; ARTSYS is someone else's server.
        await sleep(this.delayMs * 4 * (attempt + 1));
      }
    }
    return null;
  }

  /** Bounded-concurrency map that preserves input order. */
  async mapLimit(items, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const runners = Array.from({ length: Math.min(this.concurrency, items.length) }, async () => {
      for (;;) {
        const index = cursor;
        cursor += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    });
    await Promise.all(runners);
    return results;
  }
}

/** Every guide id, harvested from the paginated index. */
async function discoverGuideIds(client, { maxPages = 80 } = {}) {
  const ids = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const html = await client.get(`/program_transfer_guides?page=${page}`);
    if (!html) break;
    const found = [...html.matchAll(/href="\/program_transfer_guides\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)];
    if (!found.length) break;
    let added = 0;
    for (const m of found) {
      const id = Number(m[1]);
      const label = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (!label || ids.has(id)) continue;
      ids.set(id, label);
      added += 1;
    }
    if (!added && page > 1) break;
  }
  return ids;
}

module.exports = { ArtsysClient, discoverGuideIds, BASE };
