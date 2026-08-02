/**
 * Polite cached HTTP client for Transfer Virginia.
 *
 * Same contract as the ARTSYS client (bounded concurrency, a delay between
 * requests, a persistent on-disk cache, explicit refresh) for the same reasons:
 * this is a public state-run site, not an API we were granted, and re-running
 * the parser after a grammar change must cost zero requests.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const BASE = 'https://www.transfervirginia.org';
const USER_AGENT = 'pmt-research-import/0.1 (+transfer pathways research; contact via repo owner)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * An AWS WAF challenge served in place of the page. Returned with HTTP 200, so
 * status alone cannot distinguish it from real content.
 */
function isBotChallenge(body) {
  return typeof body === 'string'
    && body.length < 8000
    && /AwsWafIntegration|awswaf|challenge\.js/i.test(body);
}

class VirginiaClient {
  constructor({ cacheDir, delayMs = 300, concurrency = 4, refresh = false, maxRetries = 3 } = {}) {
    Object.assign(this, { cacheDir, delayMs, concurrency: Math.max(1, concurrency), refresh, maxRetries });
    this.stats = { hits: 0, misses: 0, errors: 0, retries: 0, blocked: 0 };
    this._chain = Promise.resolve();
    if (cacheDir) fs.mkdirSync(cacheDir, { recursive: true });
  }

  cachePath(url) {
    if (!this.cacheDir) return null;
    return path.join(this.cacheDir, `${createHash('sha1').update(url).digest('hex')}.html`);
  }

  readCache(url) {
    const f = this.cachePath(url);
    if (!f || this.refresh || !fs.existsSync(f)) return null;
    return fs.readFileSync(f, 'utf8');
  }

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
        if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
        if (!res.ok) { this.stats.errors += 1; return null; }
        const body = await res.text();
        // Transfer Virginia sits behind AWS WAF, which answers a tripped bot
        // rule with HTTP **200** and a ~2KB JavaScript challenge page. Treating
        // that as content is the worst possible failure here: the parser finds
        // no table, reports the guide as empty, and the corpus quietly claims
        // most Virginia programs state no requirements. Detect it, never cache
        // it, and surface it as its own counter.
        if (isBotChallenge(body)) {
          this.stats.blocked += 1;
          throw new Error('AWS WAF challenge');
        }
        this.stats.misses += 1;
        const f = this.cachePath(url);
        if (f) fs.writeFileSync(f, body);
        return body;
      } catch {
        if (attempt === this.maxRetries) { this.stats.errors += 1; return null; }
        this.stats.retries += 1;
        await sleep(this.delayMs * 4 * (attempt + 1));
      }
    }
    return null;
  }

  async mapLimit(items, worker) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(this.concurrency, items.length) }, async () => {
      for (;;) {
        const idx = i; i += 1;
        if (idx >= items.length) return;
        out[idx] = await worker(items[idx], idx);
      }
    }));
    return out;
  }
}

/** Every transfer-guide slug, from the resource listing's type facet. */
async function discoverGuideSlugs(client, { maxPages = 30 } = {}) {
  const slugs = new Set();
  for (let page = 0; page < maxPages; page += 1) {
    const html = await client.get(
      `/resources?f%5B0%5D=field_cc_resource_type%3A37&page=${page}`
    );
    if (!html) break;
    const found = [...html.matchAll(/href="(\/content\/[^"#?]+)"/g)].map((m) => m[1]);
    if (!found.length) break;
    const before = slugs.size;
    for (const s of found) slugs.add(s);
    if (slugs.size === before && page > 0) break;
  }
  return [...slugs];
}

module.exports = { VirginiaClient, discoverGuideSlugs, isBotChallenge, BASE };
