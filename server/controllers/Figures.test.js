import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

// One native require graph so module-level caches (dataset version TTL) are
// shared between the test and the controller under test.
const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { publish, list, download, update, remove, pmtPy } = cjs('./Figures');
const { _resetDatasetVersionCache } = cjs('../services/datasetVersion');

let mongo;
let db;

const b64 = (s) => Buffer.from(s).toString('base64');
const SVG = b64('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
const PNG = b64('png-bytes');
const PDF = b64('pdf-bytes');

beforeAll(async () => {
  // admin1 is the ADMIN_UIDS allowlist for these tests; u1/u2 stay partners.
  process.env.ADMIN_UIDS = 'admin1';
  mongo = await startInMemoryMongo();
  db = mongo.client.db('figures_test');
});

afterAll(async () => {
  await mongo.stop();
});

beforeEach(async () => {
  await db.collection('figures').deleteMany({});
  await db.collection('dataset_meta').deleteMany({});
  _resetDatasetVersionCache();
});

function fakeReq(user, { body = {}, params = {}, protocol = 'https', host = 'api.example.test' } = {}) {
  return {
    user, body, params, protocol,
    get: (h) => (h.toLowerCase() === 'host' ? host : undefined),
    app: { locals: { db, auditDb: db } },
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    sendStatus(c) { this.statusCode = c; this.body = String(c); return this; },
    json(o) { this.body = o; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    send(payload) { this.body = payload; return this; },
    type(t) { this.headers['Content-Type'] = t; return this; },
  };
}

const run = (handler, req) => new Promise((resolve, reject) => {
  const res = fakeRes();
  const maybe = handler(req, res, (err) => (err ? reject(err) : resolve(res)));
  Promise.resolve(maybe).then(() => resolve(res), reject);
});

const validBody = (over = {}) => ({
  slug: 'coverage-heatmap',
  title: 'Coverage heatmap',
  caption: 'College × campus articulation',
  formats: { svg: SVG, png: PNG, pdf: PDF },
  ...over,
});

describe('POST /figures (publish)', () => {
  it('stores a figure keyed by slug, stamped with author and dataset_version', async () => {
    await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: '2026-07-01-v3' });
    const res = await run(publish, fakeReq({ uid: 'u1', email: 'ada@b.edu' }, { body: validBody() }));
    expect(res.body).toMatchObject({ ok: true, slug: 'coverage-heatmap', dataset_version: '2026-07-01-v3' });
    const doc = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    expect(doc.title).toBe('Coverage heatmap');
    expect(doc.author_uid).toBe('u1');
    expect(doc.author_label).toBe('ada@b.edu');
    expect(doc.dataset_version).toBe('2026-07-01-v3');
    expect(doc.formats.svg).toBe(SVG);
    expect(doc.created_at).toBeInstanceOf(Date);
  });

  it('prefers the client-reported dataset_version (the version the data was fetched at)', async () => {
    await db.collection('dataset_meta').insertOne({ _id: 'current', dataset_version: '2026-07-02-v4' });
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ dataset_version: '2026-07-01-v3' }) }));
    const doc = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    expect(doc.dataset_version).toBe('2026-07-01-v3');
  });

  it('republish updates content and updated_at but keeps created_at', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const first = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    await new Promise((r) => setTimeout(r, 5));
    await run(publish, fakeReq({ uid: 'u2' }, { body: validBody({ title: 'v2' }) }));
    const doc = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    expect(doc.title).toBe('v2');
    expect(doc.author_uid).toBe('u2');
    expect(doc.created_at.getTime()).toBe(first.created_at.getTime());
    expect(doc.updated_at.getTime()).toBeGreaterThan(first.updated_at.getTime());
  });

  it('resolves an author label from access_grants when the token has no email (pmtr_ path)', async () => {
    await db.collection('access_grants').insertOne({ _id: 'u9', email: 'partner@b.edu' });
    await run(publish, fakeReq({ uid: 'u9', api_token: true }, { body: validBody() }));
    const doc = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    expect(doc.author_label).toBe('partner@b.edu');
  });

  it('rejects bad slugs, missing title, and missing svg', async () => {
    expect((await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ slug: 'Bad Slug!' }) }))).statusCode).toBe(400);
    expect((await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ title: '' }) }))).statusCode).toBe(400);
    expect((await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ formats: { png: PNG } }) }))).statusCode).toBe(400);
  });

  it('rejects oversized format payloads', async () => {
    const huge = 'A'.repeat(17 * 1024 * 1024); // ~12.75MB decoded > 12MB cap
    const res = await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ formats: { svg: huge } }) }));
    expect(res.statusCode).toBe(400);
  });
});

describe('GET /figures (list)', () => {
  it('returns figures newest-first with inline svg but without png/pdf payloads', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ slug: 'older' }) }));
    await new Promise((r) => setTimeout(r, 5));
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ slug: 'newer' }) }));
    const res = await run(list, fakeReq({ uid: 'u1' }));
    const rows = res.body.figures;
    expect(rows.map((f) => f.slug)).toEqual(['newer', 'older']);
    expect(rows[0].svg).toBe(SVG);
    expect(rows[0].formats).toBeUndefined();
    expect(JSON.stringify(rows)).not.toContain(PNG);
  });
});

describe('GET /figures/:slug/:format (download)', () => {
  it('serves the decoded bytes with the right content type and filename', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody({ dataset_version: '2026-07-01-v3' }) }));
    const res = await run(download, fakeReq({ uid: 'u1' }, { params: { slug: 'coverage-heatmap', format: 'pdf' } }));
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(res.headers['Content-Disposition']).toContain('coverage-heatmap');
    expect(res.headers['Content-Disposition']).toContain('2026-07-01-v3');
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect(res.body.toString()).toBe('pdf-bytes');
  });

  it('404s on unknown slug or format', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    expect((await run(download, fakeReq({ uid: 'u1' }, { params: { slug: 'nope', format: 'svg' } }))).statusCode).toBe(404);
    expect((await run(download, fakeReq({ uid: 'u1' }, { params: { slug: 'coverage-heatmap', format: 'exe' } }))).statusCode).toBe(404);
  });
});

describe('PATCH /figures/:slug (edit metadata)', () => {
  it('lets the owner edit title/caption/source_url without touching the image', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(update, fakeReq({ uid: 'u1' }, {
      params: { slug: 'coverage-heatmap' },
      body: { title: 'New title', caption: 'New caption', source_url: 'https://x.test' },
    }));
    expect(res.body).toMatchObject({ ok: true, slug: 'coverage-heatmap' });
    const doc = await db.collection('figures').findOne({ _id: 'coverage-heatmap' });
    expect(doc.title).toBe('New title');
    expect(doc.caption).toBe('New caption');
    expect(doc.source_url).toBe('https://x.test');
    expect(doc.formats.svg).toBe(SVG); // image left alone — edits are metadata only
  });

  it("lets an admin edit another user's figure", async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(update, fakeReq({ uid: 'admin1' }, {
      params: { slug: 'coverage-heatmap' }, body: { title: 'Admin edit' },
    }));
    expect(res.body).toMatchObject({ ok: true });
    expect((await db.collection('figures').findOne({ _id: 'coverage-heatmap' })).title).toBe('Admin edit');
  });

  it('forbids a non-owner non-admin, leaving the figure unchanged', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(update, fakeReq({ uid: 'u2' }, {
      params: { slug: 'coverage-heatmap' }, body: { title: 'nope' },
    }));
    expect(res.statusCode).toBe(403);
    expect((await db.collection('figures').findOne({ _id: 'coverage-heatmap' })).title).toBe('Coverage heatmap');
  });

  it('404s on unknown slug, 400 on an empty patch', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    expect((await run(update, fakeReq({ uid: 'u1' }, { params: { slug: 'ghost' }, body: { title: 'x' } }))).statusCode).toBe(404);
    expect((await run(update, fakeReq({ uid: 'u1' }, { params: { slug: 'coverage-heatmap' }, body: {} }))).statusCode).toBe(400);
  });
});

describe('DELETE /figures/:slug', () => {
  it('lets the owner delete their figure', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(remove, fakeReq({ uid: 'u1' }, { params: { slug: 'coverage-heatmap' } }));
    expect(res.body).toMatchObject({ ok: true });
    expect(await db.collection('figures').countDocuments()).toBe(0);
  });

  it("lets an admin delete anyone's figure", async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(remove, fakeReq({ uid: 'admin1' }, { params: { slug: 'coverage-heatmap' } }));
    expect(res.body).toMatchObject({ ok: true });
    expect(await db.collection('figures').countDocuments()).toBe(0);
  });

  it('forbids a non-owner non-admin, leaving the figure intact', async () => {
    await run(publish, fakeReq({ uid: 'u1' }, { body: validBody() }));
    const res = await run(remove, fakeReq({ uid: 'u2' }, { params: { slug: 'coverage-heatmap' } }));
    expect(res.statusCode).toBe(403);
    expect(await db.collection('figures').countDocuments()).toBe(1);
  });

  it('404s when nothing matches', async () => {
    expect((await run(remove, fakeReq({ uid: 'u1' }, { params: { slug: 'ghost' } }))).statusCode).toBe(404);
  });
});

describe('GET /client/pmt.py', () => {
  it('serves the python client with the API base URL baked in', async () => {
    const res = await run(pmtPy, fakeReq({ uid: 'u1' }, { protocol: 'https', host: 'api.example.test' }));
    expect(res.headers['Content-Type']).toContain('text/x-python');
    expect(res.body).toContain('API = os.environ.get("PMT_API_URL") or "https://api.example.test"');
    expect(res.body).toContain('def fetch(');
    expect(res.body).toContain('def publish(');
    expect(res.body).toContain('PMT_TOKEN');
  });
});
