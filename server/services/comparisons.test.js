import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const {
  ComparisonError,
  listComparisons, getComparison, createComparison, updateComparison, deleteComparison,
  addNote, editNote, deleteNote, fingerprintOf, kindOf, COLLECTION,
} = cjs('./comparisons');

let mongo;
let db;

// The flagship pair from the design: the printed MA Figure 6 against the
// recomputation from their own workbook.
const PANES = [
  { id: 'p1', figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'published' }, label: 'Paper (published)' },
  { id: 'p2', figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'ours' }, label: 'Ours (recomputed)' },
];
const TYBALT = { uid: 'uid-tybalt', label: 'Tybalt Mallet' };
const ROY = { uid: 'uid-roy', label: 'Roy Martinez' };

const create = (body = {}, actor = TYBALT) =>
  createComparison(db, { panes: PANES, ...body }, actor);

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('comparisons_test');
}, 60_000);
afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.collection(COLLECTION).deleteMany({}); });

describe('createComparison', () => {
  it('mints an opaque id, derives kind, and ships with zero notes', async () => {
    const doc = await create();

    expect(doc._id).toMatch(/^cmp-[0-9a-f]{8}$/);
    expect(doc.schema_version).toBe(1);
    expect(doc.kind).toBe('versions');
    expect(doc.baseline_pane).toBe('p1');
    expect(doc.breakdown_id).toBeNull();
    expect(doc.verdict_at_pin).toBeNull();
    expect(doc.notes).toEqual([]);
    expect(doc.author_uid).toBe('uid-tybalt');
    expect(doc.author_label).toBe('Tybalt Mallet');
    expect(doc.created_at).toBeInstanceOf(Date);
    expect(doc.updated_at).toEqual(doc.created_at);

    expect(await getComparison(db, doc._id)).toMatchObject({ _id: doc._id, notes: [] });
  });

  it('keeps a chosen slug, and a taken slug is a 409 rather than an overwrite', async () => {
    const doc = await create({ slug: 'ma-fig6-printed-vs-workbook' });
    expect(doc._id).toBe('ma-fig6-printed-vs-workbook');

    await expect(create({ slug: 'ma-fig6-printed-vs-workbook', title: 'Someone else' }, ROY))
      .rejects.toMatchObject({ status: 409 });
    // The first writer's document is untouched.
    const stored = await getComparison(db, 'ma-fig6-printed-vs-workbook');
    expect(stored.author_uid).toBe('uid-tybalt');
    expect(stored.title).not.toBe('Someone else');
  });

  it('bounds the pane count at 2..6', async () => {
    const pane = (id) => ({ id, figure: 'pathway-complexity', major: 'ma-cs', knobs: {} });

    await expect(create({ panes: [pane('p1')] })).rejects.toBeInstanceOf(ComparisonError);
    await expect(create({ panes: [] })).rejects.toBeInstanceOf(ComparisonError);
    await expect(create({ panes: null })).rejects.toBeInstanceOf(ComparisonError);
    await expect(create({ panes: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map(pane) }))
      .rejects.toMatchObject({ status: 400 });

    expect((await create({ panes: [pane('p1'), pane('p2')] })).panes).toHaveLength(2);
    expect((await create({ panes: ['a', 'b', 'c', 'd', 'e', 'f'].map(pane) })).panes).toHaveLength(6);
  });

  it('rejects an unknown major, a duplicate pane id, and a baseline naming no pane', async () => {
    await expect(create({
      panes: [PANES[0], { ...PANES[1], major: 'md-cs' }],
    })).rejects.toThrow(/unknown major "md-cs"/);

    await expect(create({
      panes: [PANES[0], { ...PANES[1], id: 'p1' }],
    })).rejects.toThrow(/duplicate pane id/);

    await expect(create({ baseline_pane: 'p9' })).rejects.toThrow(/baseline_pane/);
  });

  it('takes the figure id on shape alone — the ANALYSES registry is not mirrored here', async () => {
    // An id the frontend no longer has must still store and reopen; it fails
    // closed at render through getAnalysisById() -> null.
    const doc = await create({
      panes: PANES.map((pane) => ({ ...pane, figure: 'some-retired-figure' })),
    });
    expect(doc.panes[0].figure).toBe('some-retired-figure');
    await expect(create({
      panes: PANES.map((pane) => ({ ...pane, figure: 'Not A Slug' })),
    })).rejects.toThrow(/figure id/);
  });

  it('stamps verdict_at_pin server-side and validates its numbers', async () => {
    const doc = await create({
      verdict_at_pin: {
        computed_at: '1999-01-01', matched: 60, agreeing: 58, dropped: 0,
        mean_delta: 0.133, max_abs_delta: 62, max_cell: 'Springfield Technical × UMass Amherst',
      },
    });
    expect(doc.verdict_at_pin.matched).toBe(60);
    expect(doc.verdict_at_pin.max_cell).toBe('Springfield Technical × UMass Amherst');
    // Pinning is an act; its moment is the server's, not the caller's.
    expect(doc.verdict_at_pin.computed_at).toBeInstanceOf(Date);
    expect(doc.verdict_at_pin.computed_at.getFullYear()).toBeGreaterThan(1999);

    await expect(create({ verdict_at_pin: { matched: 'lots' } })).rejects.toThrow(/matched/);
  });
});

describe('fingerprintOf', () => {
  it('canonicalizes ordering and boolean form', () => {
    expect(fingerprintOf({ figure: 'pathway-complexity', major: 'ma-cs', knobs: {} }))
      .toBe('pathway-complexity@ma-cs');
    expect(fingerprintOf({ figure: 'pathway-complexity', major: 'ma-cs', knobs: { source: 'ours' } }))
      .toBe('pathway-complexity@ma-cs?source=ours');
    expect(fingerprintOf({
      figure: 'transfer-credit-rate', major: 'cs', knobs: { verified_only: true, ma_ge: false, scope: 'lower-division' },
    })).toBe('transfer-credit-rate@cs?ma_ge=0&scope=lower-division&verified_only=1');
  });

  it('is the fallback only — the client mints the elided form and it is kept', async () => {
    // The client elides knobs at their declared default; the server has no
    // registry and cannot, so a supplied fingerprint wins over the local one.
    const doc = await create({
      panes: [
        { ...PANES[0], fingerprint: 'pathway-complexity@ma-cs' },
        PANES[1],
      ],
    });
    expect(doc.panes[0].fingerprint).toBe('pathway-complexity@ma-cs');
    expect(doc.panes[1].fingerprint).toBe('pathway-complexity@ma-cs?source=ours');
  });

  it('indexes discovery: ?fingerprint= finds every comparison using that view', async () => {
    await create({ slug: 'a' });
    await create({
      slug: 'b',
      panes: PANES.map((pane) => ({ ...pane, major: 'cs', figure: 'coverage-heatmap' })),
    });

    const found = await listComparisons(db, { fingerprint: 'pathway-complexity@ma-cs?source=ours' });
    expect(found.map((row) => row._id)).toEqual(['a']);
    expect(found[0].note_count).toBe(0);
    expect(await listComparisons(db, {})).toHaveLength(2);
  });
});

describe('kindOf', () => {
  it('names the axis that varies; state rides on the major', () => {
    const pane = (id, major, knobs = {}) => ({ id, figure: 'coverage-heatmap', major, knobs });
    expect(kindOf([pane('p1', 'ma-cs', { source: 'published' }), pane('p2', 'ma-cs', { source: 'ours' })]))
      .toBe('versions');
    expect(kindOf([pane('p1', 'cs'), pane('p2', 'bio'), pane('p3', 'econ')])).toBe('majors');
    expect(kindOf([pane('p1', 'cs'), pane('p2', 'ma-cs')])).toBe('states');
    expect(kindOf([pane('p1', 'cs'), pane('p2', 'ma-cs', { scope: 'upper' })])).toBe('mixed');
  });
});

describe('notes', () => {
  it('stores text byte-exact, including leading and trailing whitespace', async () => {
    const doc = await create();
    // Deliberately ugly: the store must not trim, collapse, or normalize a
    // single character of what was typed.
    const text = '  their printed Figure 6 contradicts their own tab by 62 points.\n\n  — check before Friday  ';

    const after = await addNote(db, doc._id, { text }, TYBALT);
    expect(after.notes).toHaveLength(1);
    expect(after.notes[0].text).toBe(text);

    const reread = await getComparison(db, doc._id);
    expect(reread.notes[0].text).toBe(text);
    expect(reread.notes[0].author_uid).toBe('uid-tybalt');
    expect(reread.notes[0].author_label).toBe('Tybalt Mallet');
    expect(reread.notes[0].updated_at).toBeNull();
    expect(reread.notes[0].anchor).toBeNull();
  });

  it('stamps authorship server-side and tolerates a labelless API-token caller', async () => {
    const doc = await create();
    // A pmtr_ token resolves to a uid with no name and no email.
    const after = await addNote(
      db, doc._id, { text: 'from a script', author_label: 'Somebody Else' },
      { uid: 'uid-token', label: null }
    );
    expect(after.notes[0].author_uid).toBe('uid-token');
    expect(after.notes[0].author_label).toBeNull();
  });

  it('rejects empty, non-string, and oversized text', async () => {
    const doc = await create();
    await expect(addNote(db, doc._id, { text: '   ' }, TYBALT)).rejects.toBeInstanceOf(ComparisonError);
    await expect(addNote(db, doc._id, { text: null }, TYBALT)).rejects.toBeInstanceOf(ComparisonError);
    await expect(addNote(db, doc._id, { text: 'x'.repeat(20001) }, TYBALT)).rejects.toThrow(/20000/);
    expect((await getComparison(db, doc._id)).notes).toEqual([]);
  });

  it('anchors a note to a cell without trimming its keys', async () => {
    const doc = await create();
    const after = await addNote(db, doc._id, {
      text: 'this is the cell',
      anchor: { rowKey: 'Springfield Technical ', colKey: 'UMass Amherst', label: 'Springfield Technical × UMass Amherst' },
    }, TYBALT);
    expect(after.notes[0].anchor).toEqual({
      rowKey: 'Springfield Technical ',
      colKey: 'UMass Amherst',
      label: 'Springfield Technical × UMass Amherst',
    });
    await expect(addNote(db, doc._id, { text: 'x', anchor: { rowKey: 'a' } }, TYBALT))
      .rejects.toThrow(/colKey/);
  });

  it('edits and deletes are author-only', async () => {
    const doc = await create();
    const withNote = await addNote(db, doc._id, { text: 'mine' }, TYBALT);
    const noteId = withNote.notes[0].id;

    await expect(editNote(db, doc._id, noteId, { text: 'rewritten by roy' }, ROY))
      .rejects.toMatchObject({ status: 403 });
    await expect(deleteNote(db, doc._id, noteId, ROY))
      .rejects.toMatchObject({ status: 403 });
    expect((await getComparison(db, doc._id)).notes[0].text).toBe('mine');

    const edited = await editNote(db, doc._id, noteId, { text: '  mine, revised  ' }, TYBALT);
    expect(edited.notes[0].text).toBe('  mine, revised  ');
    expect(edited.notes[0].updated_at).toBeInstanceOf(Date);
    expect(edited.notes[0].created_at).toEqual(withNote.notes[0].created_at);

    const deleted = await deleteNote(db, doc._id, noteId, TYBALT);
    expect(deleted.notes).toEqual([]);
  });

  it('keeps each note addressable and ignores a colliding client id', async () => {
    const doc = await create();
    await addNote(db, doc._id, { id: 'note-1', text: 'first' }, TYBALT);
    const after = await addNote(db, doc._id, { id: 'note-1', text: 'second' }, ROY);

    expect(after.notes.map((note) => note.text)).toEqual(['first', 'second']);
    expect(after.notes[0].id).toBe('note-1');
    expect(after.notes[1].id).not.toBe('note-1');

    // Roy's own second note is his to edit; the first still is not.
    await expect(editNote(db, doc._id, 'note-1', { text: 'nope' }, ROY))
      .rejects.toMatchObject({ status: 403 });
    const edited = await editNote(db, doc._id, after.notes[1].id, { text: 'second, revised' }, ROY);
    expect(edited.notes.map((note) => note.text)).toEqual(['first', 'second, revised']);
  });

  it('an unknown note id is rejected, not silently ignored', async () => {
    const doc = await create();
    await expect(editNote(db, doc._id, 'nope', { text: 'x' }, TYBALT)).rejects.toThrow(/no such note/);
    await expect(deleteNote(db, doc._id, 'nope', TYBALT)).rejects.toThrow(/no such note/);
  });

  it('returns null for a missing comparison instead of creating one', async () => {
    expect(await addNote(db, 'nope', { text: 'x' }, TYBALT)).toBeNull();
    expect(await editNote(db, 'nope', 'n', { text: 'x' }, TYBALT)).toBeNull();
    expect(await deleteNote(db, 'nope', 'n', TYBALT)).toBeNull();
    expect(await db.collection(COLLECTION).countDocuments()).toBe(0);
  });
});

describe('updateComparison', () => {
  it('cannot touch notes, even when the body carries them', async () => {
    const doc = await create();
    await addNote(db, doc._id, { text: 'the argument' }, TYBALT);

    // A metadata save that also carries a notes array — the exact accident the
    // strip exists to make harmless.
    const after = await updateComparison(db, doc._id, {
      title: 'MA Figure 6 — printed vs their own workbook',
      notes: [],
    }, ROY);

    expect(after.title).toBe('MA Figure 6 — printed vs their own workbook');
    expect(after.notes).toHaveLength(1);
    expect(after.notes[0].text).toBe('the argument');
    expect(after.notes[0].author_uid).toBe('uid-tybalt');

    // And a body claiming replacement prose changes nothing either.
    const again = await updateComparison(db, doc._id, {
      notes: [{ id: 'x', text: 'a note nobody wrote', author_uid: 'uid-roy' }],
    }, ROY);
    expect(again.notes.map((note) => note.text)).toEqual(['the argument']);
  });

  it('re-derives kind and re-validates the baseline when the panes change', async () => {
    const doc = await create();
    const after = await updateComparison(db, doc._id, {
      panes: [
        { id: 'a', figure: 'coverage-heatmap', major: 'cs', knobs: {} },
        { id: 'b', figure: 'coverage-heatmap', major: 'bio', knobs: {} },
      ],
    }, TYBALT);

    expect(after.kind).toBe('majors');
    // 'p1' went away with the old pane list, so the baseline falls to the first.
    expect(after.baseline_pane).toBe('a');
    expect(after.updated_by_uid).toBe('uid-tybalt');

    // A baseline the caller names must still be one of the panes.
    await expect(updateComparison(db, doc._id, { baseline_pane: 'p1' }, TYBALT))
      .rejects.toThrow(/baseline_pane/);
    // And a surviving baseline is carried forward untouched.
    const kept = await updateComparison(db, doc._id, {
      panes: [
        { id: 'b', figure: 'coverage-heatmap', major: 'bio', knobs: {} },
        { id: 'a', figure: 'coverage-heatmap', major: 'cs', knobs: {} },
      ],
    }, TYBALT);
    expect(kept.baseline_pane).toBe('a');
  });

  it('stamps the editor, leaves authorship alone, and 404s as null', async () => {
    const doc = await create();
    const after = await updateComparison(db, doc._id, { breakdown_id: 'ma-complexity-figure-6' }, ROY);
    expect(after.breakdown_id).toBe('ma-complexity-figure-6');
    expect(after.author_uid).toBe('uid-tybalt');
    expect(after.updated_by_uid).toBe('uid-roy');
    expect(after.updated_by_label).toBe('Roy Martinez');

    // Clearing the name falls back to the derived one rather than failing, so
    // the field the reader sees can never disagree with what is stored.
    const cleared = await updateComparison(db, doc._id, { title: '  ' }, ROY);
    expect(cleared.title).toBeTruthy();
    expect(cleared.title).toContain('pathway-complexity');

    expect(await updateComparison(db, 'nope', { title: 'x' }, ROY)).toBeNull();
  });

  // The drift banner exists to say how old the pinned numbers are, so an
  // unrelated save must not quietly reset that clock. The pinned time is aged
  // in the database first, so the assertion does not depend on the clock
  // ticking between two writes.
  it('keeps the pin timestamp across an unrelated save and moves it when the reading changes', async () => {
    const verdict = {
      matched: 60, agreeing: 58, dropped: 0,
      mean_delta: 0.133, max_abs_delta: 62, max_cell: 'Springfield Technical × UMass Amherst',
    };
    const doc = await create({ verdict_at_pin: verdict });
    const aged = new Date('2026-01-01T00:00:00.000Z');
    await db.collection(COLLECTION).updateOne(
      { _id: doc._id }, { $set: { 'verdict_at_pin.computed_at': aged } },
    );

    const renamed = await updateComparison(db, doc._id, { title: 'Renamed', verdict_at_pin: verdict }, ROY);
    expect(renamed.verdict_at_pin.computed_at).toEqual(aged);

    const moved = await updateComparison(db, doc._id, {
      verdict_at_pin: { ...verdict, agreeing: 57 },
    }, ROY);
    expect(moved.verdict_at_pin.computed_at.getTime()).toBeGreaterThan(aged.getTime());
    expect(moved.verdict_at_pin.agreeing).toBe(57);
  });
});

describe('deleteComparison', () => {
  it('removes the document and reports whether it existed', async () => {
    const doc = await create();
    expect(await deleteComparison(db, doc._id)).toBe(true);
    expect(await getComparison(db, doc._id)).toBeNull();
    expect(await deleteComparison(db, doc._id)).toBe(false);
  });
});
