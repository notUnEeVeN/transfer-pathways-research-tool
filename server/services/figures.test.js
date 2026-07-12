import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  validateFigurePayload, upsertFigure, listFigures, getFigureFormat, removeFigure,
} from './figures';

let mongo;
let db;
const b64 = (value) => Buffer.from(value).toString('base64');

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('published_figures_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.collection('published_figures').deleteMany({}); });

const payload = (slug = 'figure-a') => ({
  slug,
  title: 'Figure A',
  caption: null,
  source_url: null,
  formats: { svg: b64('<svg/>'), png: b64('png'), pdf: b64('pdf') },
});

describe('published figures', () => {
  it('stores binary files and lists only an inline base64 SVG', async () => {
    await upsertFigure(db, payload(), { author_uid: 'u1', author_label: 'Ada' });

    const stored = await db.collection('published_figures').findOne({ _id: 'figure-a' });
    expect(Buffer.from(stored.formats.png.buffer).toString()).toBe('png');
    expect(stored.created_at).toBeInstanceOf(Date);

    const [listed] = await listFigures(db);
    expect(listed).toMatchObject({ slug: 'figure-a', title: 'Figure A', author_uid: 'u1' });
    expect(listed.svg).toBe(b64('<svg/>'));
    expect(listed.formats).toBeUndefined();
  });

  it('returns decoded downloads with stable filenames', async () => {
    await upsertFigure(db, payload(), { author_uid: 'u1', author_label: 'Ada' });
    const file = await getFigureFormat(db, 'figure-a', 'pdf');
    expect(file.contentType).toBe('application/pdf');
    expect(file.filename).toBe('figure-a.pdf');
    expect(file.buffer.toString()).toBe('pdf');
  });

  it('validates slugs, required SVG, and the total file cap', () => {
    expect(validateFigurePayload(payload()).error).toBeUndefined();
    expect(validateFigurePayload(payload('Bad slug')).error).toMatch(/slug/);
    expect(validateFigurePayload({ ...payload(), formats: { png: b64('png') } }).error).toMatch(/svg/);
    expect(validateFigurePayload({
      ...payload(), formats: { svg: 'A'.repeat(17 * 1024 * 1024) },
    }).error).toMatch(/12MB/);
  });

  it('deletes by durable slug', async () => {
    await upsertFigure(db, payload(), { author_uid: 'u1', author_label: 'Ada' });
    expect(await removeFigure(db, 'figure-a')).toBe(true);
    expect(await removeFigure(db, 'figure-a')).toBe(false);
  });
});
