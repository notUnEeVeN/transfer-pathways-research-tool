import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { listCategories, putCategory, listOverrides, putOverride } = cjs('./Curation');
const { getMajor } = cjs('../config/majors');

function fakeReq({ query = {}, params = {}, body = {}, rows = [], capture, captureFind } = {}) {
  const collection = () => ({
    find: (filter) => {
      captureFind?.(filter);
      return { toArray: async () => rows };
    },
    replaceOne: async (filter, doc) => { capture?.(doc); return { acknowledged: true }; },
    deleteOne: async () => ({ acknowledged: true }),
  });
  return {
    query, params, body,
    user: { uid: 'curator-1' },
    app: { locals: { db: { collection }, auditDb: { collection } } },
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const run = (handler, req) => new Promise((resolve, reject) => {
  const res = fakeRes();
  Promise.resolve(handler(req, res, (e) => (e ? reject(e) : resolve(res))))
    .then(() => resolve(res), reject);
});

describe('course categories', () => {
  it('serves the cs vocabulary from the majors config', async () => {
    const res = await run(listCategories, fakeReq());
    expect(res.body.canonical).toEqual(getMajor('cs').categories.map((c) => c.key));
    expect(res.body.broad).toEqual(getMajor('cs').broadAxes);
  });

  it('rejects an unknown major slug', async () => {
    const res = await run(listCategories, fakeReq({ query: { majorSlug: 'nope' } }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('unknown major');
  });

  it('rejects a category outside the major vocabulary', async () => {
    const res = await run(putCategory, fakeReq({
      params: { parentId: '42' },
      body: { category: 'underwater_basket_weaving' },
    }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('category must be one of');
  });

  it('stamps major_slug on the saved mapping', async () => {
    let saved;
    const res = await run(putCategory, fakeReq({
      params: { parentId: '42' },
      body: { category: 'calculus', broad: 'math' },
      capture: (doc) => { saved = doc; },
    }));
    expect(res.statusCode).toBe(200);
    expect(saved.major_slug).toBe('cs');
    expect(saved.category).toBe('calculus');
    expect(saved.curated_by).toBe('curator-1');
  });

  it('uses a separate mapping id for a newly onboarded major', async () => {
    let saved;
    await run(putCategory, fakeReq({
      query: { majorSlug: 'bio' },
      params: { parentId: '42' },
      body: { category: 'gen_chem', broad: 'science' },
      capture: (doc) => { saved = doc; },
    }));
    expect(saved).toMatchObject({
      _id: 'course_category:bio:42',
      major_slug: 'bio',
      category: 'gen_chem',
    });
  });

  it('only lists mappings for the selected major', async () => {
    let filter;
    await run(listCategories, fakeReq({
      query: { majorSlug: 'econ' },
      captureFind: (value) => { filter = value; },
    }));
    expect(filter).toEqual({ kind: 'course_category', major_slug: 'econ' });
  });
});

describe('receiver overrides', () => {
  it('stamps and namespaces overrides by major', async () => {
    let saved;
    await run(putOverride, fakeReq({
      query: { majorSlug: 'bio' },
      params: { hashId: 'receiver-1' },
      body: { exclude: true },
      capture: (doc) => { saved = doc; },
    }));
    expect(saved).toMatchObject({
      _id: 'receiver_override:bio:receiver-1',
      receiver_hash: 'receiver-1',
      major_slug: 'bio',
      exclude: true,
    });
  });

  it('keeps unstamped legacy overrides in CS only', async () => {
    const filters = [];
    await run(listOverrides, fakeReq({
      captureFind: (value) => filters.push(value),
    }));
    await run(listOverrides, fakeReq({
      query: { majorSlug: 'bio' },
      captureFind: (value) => filters.push(value),
    }));
    expect(filters[0]).toMatchObject({ kind: 'receiver_override' });
    expect(filters[0].$or).toContainEqual({ major_slug: { $exists: false } });
    expect(filters[1]).toEqual({ kind: 'receiver_override', major_slug: 'bio' });
  });
});
