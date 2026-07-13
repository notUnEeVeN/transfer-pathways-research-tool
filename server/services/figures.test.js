import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startInMemoryMongo } from '../test/mongoHarness';
import {
  validateFigurePayload, upsertFigure, listFigures, getFigureFormat, removeFigure,
  ensureFigureIndexes,
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

const variantPayload = () => ({
  slug: 'paper-figure',
  title: 'Paper figure',
  caption: null,
  source_url: null,
  controls: [
    {
      key: 'version', label: 'Version', type: 'select', default: 'current',
      options: [
        { value: 'paper', label: 'Paper baseline' },
        { value: 'current', label: 'Current data' },
      ],
    },
    { key: 'differences', label: 'Show differences', type: 'toggle', default: false },
  ],
  default_variant: 'current',
  variants: [
    {
      key: 'paper', label: 'Paper baseline', state: { version: 'paper', differences: false },
      formats: { svg: b64('<svg id="paper"/>'), png: b64('paper-png'), pdf: b64('paper-pdf') },
    },
    {
      key: 'current', label: 'Current data', state: { version: 'current', differences: false },
      formats: { svg: b64('<svg id="current"/>'), png: b64('current-png'), pdf: b64('current-pdf') },
    },
    {
      key: 'current-diff', label: 'Current differences', state: { version: 'current', differences: true },
      formats: { svg: b64('<svg id="diff"/>'), png: b64('diff-png'), pdf: b64('diff-pdf') },
    },
  ],
});

const interactivePayload = () => ({
  slug: 'paper-credit-loss-copy',
  title: 'Paper-style credit loss (published copy)',
  caption: 'Interactive publication pilot',
  source_url: null,
  visual: 'paper-credit-loss',
});

describe('published figures', () => {
  it('stores binary files while the list response stays metadata-only', async () => {
    await upsertFigure(db, payload(), { author_uid: 'u1', author_label: 'Ada' });

    const stored = await db.collection('published_figures').findOne({ _id: 'figure-a' });
    expect(Buffer.from(stored.formats.png.buffer).toString()).toBe('png');
    expect(stored.created_at).toBeInstanceOf(Date);

    const [listed] = await listFigures(db);
    expect(listed).toMatchObject({ slug: 'figure-a', title: 'Figure A', author_uid: 'u1' });
    expect(listed.svg).toBeUndefined();
    expect(listed.formats).toBeUndefined();
  });

  it('returns decoded downloads with stable filenames', async () => {
    await upsertFigure(db, payload(), { author_uid: 'u1', author_label: 'Ada' });
    const file = await getFigureFormat(db, 'figure-a', 'pdf');
    expect(file.contentType).toBe('application/pdf');
    expect(file.filename).toBe('figure-a.pdf');
    expect(file.buffer.toString()).toBe('pdf');
  });

  it('stores named states as child records and lists their control metadata', async () => {
    const checked = validateFigurePayload(variantPayload());
    expect(checked.error).toBeUndefined();
    await upsertFigure(db, checked.value, { author_uid: 'u1', author_label: 'Ada' });

    const stored = await db.collection('published_figures').find().toArray();
    expect(stored).toHaveLength(3); // root/default plus two non-default states
    const root = stored.find((row) => row._id === 'paper-figure');
    expect(root.default_variant).toBe('current');
    expect(Buffer.from(root.formats.svg.buffer).toString()).toContain('current');

    const [listed] = await listFigures(db);
    expect(listed.variants.map((variant) => variant.key)).toEqual(['paper', 'current', 'current-diff']);
    expect(listed.variants.every((variant) => variant.svg === undefined)).toBe(true);

    const file = await getFigureFormat(db, 'paper-figure', 'pdf', 'current-diff');
    expect(file.filename).toBe('paper-figure-current-diff.pdf');
    expect(file.buffer.toString()).toBe('diff-pdf');
  });

  it('stores a validated interactive renderer manifest without image files', async () => {
    const checked = validateFigurePayload(interactivePayload());
    expect(checked.error).toBeUndefined();
    expect(checked.value).toMatchObject({
      publication_type: 'interactive',
      visual: { id: 'paper-credit-loss', options: {} },
    });

    await upsertFigure(db, checked.value, { author_uid: 'u1', author_label: 'Ada' });
    const stored = await db.collection('published_figures').findOne({ _id: 'paper-credit-loss-copy' });
    expect(stored.publication_type).toBe('interactive');
    expect(stored.visual.id).toBe('paper-credit-loss');
    expect(stored.formats).toEqual({});

    const [listed] = await listFigures(db);
    expect(listed.visual).toEqual({ id: 'paper-credit-loss', options: {} });
    expect(listed.formats).toBeUndefined();
  });

  it('validates slugs, required SVG, and the total file cap', () => {
    expect(validateFigurePayload(payload()).error).toBeUndefined();
    expect(validateFigurePayload(payload('Bad slug')).error).toMatch(/slug/);
    expect(validateFigurePayload({ ...payload(), formats: { png: b64('png') } }).error).toMatch(/svg/);
    expect(validateFigurePayload({
      ...payload(), formats: { svg: 'A'.repeat(17 * 1024 * 1024) },
    }).error).toMatch(/12MB/);
    expect(validateFigurePayload({
      ...variantPayload(),
      variants: variantPayload().variants.map((variant) => ({ ...variant, state: {} })),
    }).error).toMatch(/missing state.version/);
    expect(validateFigurePayload({ ...interactivePayload(), visual: 'not-a-renderer' }).error)
      .toMatch(/unknown interactive visual/);
    expect(validateFigurePayload({ ...interactivePayload(), source: 'live' }).error)
      .toMatch(/use source_url/);
    expect(validateFigurePayload({ ...interactivePayload(), formats: { svg: b64('<svg/>') } }).error)
      .toMatch(/cannot include formats/);
  });

  it('clears stale static variants when a slug becomes interactive', async () => {
    const staticChecked = validateFigurePayload({ ...variantPayload(), slug: 'paper-credit-loss-copy' });
    await upsertFigure(db, staticChecked.value, { author_uid: 'u1', author_label: 'Ada' });
    expect(await db.collection('published_figures').countDocuments()).toBe(3);

    const interactiveChecked = validateFigurePayload(interactivePayload());
    await upsertFigure(db, interactiveChecked.value, { author_uid: 'u1', author_label: 'Ada' });
    expect(await db.collection('published_figures').countDocuments()).toBe(1);
    const root = await db.collection('published_figures').findOne({ _id: 'paper-credit-loss-copy' });
    expect(root.variants).toBeUndefined();
    expect(root.visual.id).toBe('paper-credit-loss');
  });

  it('deletes by durable slug', async () => {
    const checked = validateFigurePayload(variantPayload());
    await upsertFigure(db, checked.value, { author_uid: 'u1', author_label: 'Ada' });
    expect(await removeFigure(db, 'paper-figure')).toBe(true);
    expect(await db.collection('published_figures').countDocuments()).toBe(0);
    expect(await removeFigure(db, 'paper-figure')).toBe(false);
  });

  it('creates idempotent root-list and variant lookup indexes', async () => {
    await ensureFigureIndexes(db);
    await ensureFigureIndexes(db);
    const indexes = await db.collection('published_figures').indexes();
    expect(indexes.some((index) => index.name === 'record_type_1_updated_at_-1')).toBe(true);
    expect(indexes.some((index) => index.name === 'figure_slug_1_variant_key_1')).toBe(true);
  });
});
