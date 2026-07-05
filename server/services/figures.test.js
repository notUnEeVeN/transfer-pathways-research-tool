import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import { upsertFigure, listFigures, markFigureLive, clearFigureLive } from './figures';

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('figures_live_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.collection('figures').deleteMany({}); });

const payload = (slug) => ({
  slug, title: 'T', caption: null, source_url: null,
  dataset_version: '2026-07-01-v1', formats: { svg: 'aGk=' },
});

describe('live figure state', () => {
  it('markFigureLive flips a published figure to live and stamps compute state', async () => {
    await upsertFigure(db, payload('fig-a'), { author_uid: 'u1', author_label: 'U' });
    await markFigureLive(db, 'fig-a', { status: 'ok' });

    const [fig] = await listFigures(db);
    expect(fig.mode).toBe('live');
    expect(fig.live.status).toBe('ok');
    expect(fig.live.computed_at).toBeInstanceOf(Date);
  });

  it('an error state keeps the previous computed_at (last good render is still shown)', async () => {
    await upsertFigure(db, payload('fig-a'), { author_uid: 'u1', author_label: 'U' });
    await markFigureLive(db, 'fig-a', { status: 'ok' });
    const [before] = await listFigures(db);

    await markFigureLive(db, 'fig-a', { status: 'error' });
    const [after] = await listFigures(db);
    expect(after.live.status).toBe('error');
    expect(after.live.computed_at.getTime()).toBe(before.live.computed_at.getTime());
  });

  it('clearFigureLive returns the figure to a plain static one', async () => {
    await upsertFigure(db, payload('fig-a'), { author_uid: 'u1', author_label: 'U' });
    await markFigureLive(db, 'fig-a', { status: 'ok' });
    await clearFigureLive(db, 'fig-a');

    const [fig] = await listFigures(db);
    expect(fig.mode).toBeUndefined();
    expect(fig.live).toBeUndefined();
  });
});
