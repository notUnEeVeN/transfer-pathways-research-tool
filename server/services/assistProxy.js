/**
 * Minimal ASSIST.org API proxy — ported from the PMT scraper's local server.
 *
 * assist.org's JSON API sits behind an XSRF cookie/token handshake, so a
 * browser can't fetch it directly. This service bootstraps a session (visit
 * the homepage, capture the X-XSRF-TOKEN cookie) and then fetches the raw
 * per-major articulation payload — the same upstream JSON the parser's
 * raw_cache mirrors (which is 14 GB and stays on the admin's machine; this
 * serves the per-major slice live instead).
 *
 * Responses are cached in-memory (they change at most yearly) both to keep
 * the console snappy and to be polite to assist.org.
 */
const ASSIST_ACADEMIC_YEAR = 76;
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const SESSION_TTL_MS = 10 * 60 * 1000;
let session = null;
let sessionExpiry = 0;

async function refreshSession() {
  const res = await fetch('https://assist.org/', {
    headers: { 'User-Agent': CHROME_UA },
    redirect: 'follow',
  });
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const cookies = {};
  for (const c of setCookies) {
    const m = /^([^=]+)=([^;]+)/.exec(c);
    if (m) cookies[m[1]] = m[2];
  }
  if (!cookies['X-XSRF-TOKEN']) {
    throw new Error('Failed to obtain X-XSRF-TOKEN cookie from assist.org');
  }
  session = {
    xsrfToken: cookies['X-XSRF-TOKEN'],
    cookieHeader: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; '),
  };
  sessionExpiry = Date.now() + SESSION_TTL_MS;
}

async function getSession() {
  if (!session || Date.now() >= sessionExpiry) await refreshSession();
  return session;
}

async function assistGet(path) {
  let s = await getSession();
  const doFetch = () =>
    fetch(`https://assist.org${path}`, {
      headers: {
        'User-Agent': CHROME_UA,
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://assist.org/',
        'x-xsrf-token': s.xsrfToken,
        Cookie: s.cookieHeader,
      },
    });
  let res = await doFetch();
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    // Stale session — refresh once and retry.
    await refreshSession();
    s = session;
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`assist.org ${res.status} for ${path}`);
  return res.json();
}

// key → { at, data }; agreements change at most once per academic year.
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map();

/**
 * Raw per-major articulation payload for (cc → uc, major). `majorId` is the
 * ASSIST major UUID we store on every agreement (`major_id`).
 */
async function fetchRawAgreement(ccId, ucId, majorId, year = ASSIST_ACADEMIC_YEAR) {
  const key = `${year}/${ccId}/to/${ucId}/Major/${majorId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await assistGet(`/api/articulation/Agreements?Key=${encodeURIComponent(key)}`);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { fetchRawAgreement, ASSIST_ACADEMIC_YEAR };
