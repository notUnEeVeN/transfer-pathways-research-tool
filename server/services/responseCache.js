// A serialized-response cache for hot, non-personalized, rarely-changing reads
// (the per-college agreements batch). Three properties matter, in order:
//
//   1. In-flight dedupe — the real fix for the concurrent-load OOM. When a
//      flash crowd hits the same college at once, only ONE build runs and the
//      rest await its Buffer, instead of each request materialising its own
//      ~10-60MB array+JSON simultaneously.
//   2. TTL — repeats inside the window serve the cached Buffer (the data
//      changes infrequently, so a short staleness window is fine).
//   3. Byte-bounded LRU — the cache itself can never become a new memory leak;
//      total cached bytes stay under maxBytes, evicting least-recently-used.
//
// Values are Buffers (pre-serialized payloads) so concurrent responders share
// one copy and skip re-serialization; the controller just res.send()s it.
function createSerializedCache({ ttlMs, maxBytes, now = Date.now } = {}) {
  if (!(ttlMs > 0)) throw new Error('createSerializedCache: ttlMs must be > 0');
  if (!(maxBytes > 0)) throw new Error('createSerializedCache: maxBytes must be > 0');

  const store = new Map();    // key -> { buf, bytes, expiresAt }; iteration order = LRU (oldest first)
  const inflight = new Map(); // key -> Promise<Buffer> (shared while a build is running)
  let totalBytes = 0;

  function evictKey(key) {
    const v = store.get(key);
    if (v) { store.delete(key); totalBytes -= v.bytes; }
  }

  function set(key, buf) {
    const bytes = buf.length;
    evictKey(key); // drop any prior/expired copy of this key first
    // A single payload larger than the whole budget is served but not cached —
    // caching it would evict everything else for one entry.
    if (bytes > maxBytes) return;
    while (totalBytes + bytes > maxBytes && store.size > 0) {
      evictKey(store.keys().next().value); // evict the least-recently-used
    }
    store.set(key, { buf, bytes, expiresAt: now() + ttlMs });
    totalBytes += bytes;
  }

  // get(key, build): return the cached Buffer for `key`, building it via the
  // async `build()` exactly once across concurrent callers and cache misses.
  function get(key, build) {
    const hit = store.get(key);
    if (hit) {
      if (hit.expiresAt > now()) {
        store.delete(key);   // re-insert → move to MRU (most-recently-used)
        store.set(key, hit);
        return Promise.resolve(hit.buf);
      }
      evictKey(key);         // expired
    }

    const pending = inflight.get(key);
    if (pending) return pending;

    const p = (async () => {
      const buf = await build();
      if (!Buffer.isBuffer(buf)) {
        throw new TypeError('responseCache build() must resolve to a Buffer');
      }
      set(key, buf);
      return buf;
    })();
    inflight.set(key, p);
    // Clear the in-flight slot on settle (success OR failure) so a failed build
    // isn't cached and the next caller retries.
    p.then(() => inflight.delete(key), () => inflight.delete(key));
    return p;
  }

  function clear() {
    store.clear();
    inflight.clear();
    totalBytes = 0;
  }

  function stats() {
    return { entries: store.size, totalBytes, inflight: inflight.size };
  }

  return { get, clear, stats };
}

module.exports = { createSerializedCache };
