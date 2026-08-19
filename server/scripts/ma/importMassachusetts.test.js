import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../../test/mongoHarness');
const {
  runMaImport, loadRaw, loadPdfFigures, mergePdfFigures,
} = cjs('./importMassachusetts');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('ma_import_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

// The real raw JSON produced by the converter: the import test runs over the
// actual dataset, so counts here are the counts the port stands on.
const RAW_DIR = path.resolve(__dirname, '../../data/ma/raw');
const raw = {
  heatmap: JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'heatmap.json'), 'utf8')),
  as_degrees: JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'as_degrees.json'), 'utf8')),
  pathways: JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'pathways.json'), 'utf8')),
  baselines: JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'baselines.json'), 'utf8')),
};

describe('runMaImport', () => {
  it('applies the full dataset idempotently with state stamps everywhere', async () => {
    const first = await runMaImport(db, raw, { apply: true });
    expect(first.failures).toEqual([]);

    expect(await db.collection('assist_institutions').countDocuments({ state: 'ma' })).toBe(26);
    expect(await db.collection('curated_requirements')
      .countDocuments({ kind: 'degree', state: 'ma' })).toBe(11);
    expect(await db.collection('curated_requirements')
      .countDocuments({ kind: 'as_degree', state: 'ma' })).toBe(15);
    expect(await db.collection('assist_agreements').countDocuments({ state: 'ma' })).toBe(165);
    expect(await db.collection('assist_courses').countDocuments({ state: 'ma' })).toBeGreaterThan(300);
    expect(await db.collection('ma_paper_baselines').countDocuments({})).toBeGreaterThan(100);
    // Nothing un-stamped slipped in.
    expect(await db.collection('curated_requirements')
      .countDocuments({ state: { $exists: false } })).toBe(0);

    const second = await runMaImport(db, raw, { apply: true });
    expect(second.failures).toEqual([]);
    expect(await db.collection('assist_agreements').countDocuments({ state: 'ma' })).toBe(165);
  });

  it('stamps every university with the per-credit tuition its own cost tab implies', async () => {
    await runMaImport(db, raw, { apply: true });
    const universities = await db.collection('assist_institutions')
      .find({ kind: 'university', state: 'ma' }).toArray();
    expect(universities).toHaveLength(11);
    for (const university of universities) {
      expect(university.tuition_per_credit_usd).toBeGreaterThan(300);
      // The credit-rate pricer divides annual by 24 semester units; the
      // stamped annual is the derived rate re-expressed on that convention.
      expect(university.tuition_annual_resident_usd)
        .toBeCloseTo(university.tuition_per_credit_usd * 24, 5);
      expect(university.tuition_source).toMatch(/CurrComp Master\.xlsx Cost tab/i);
    }
    const bridgewater = universities.find((row) => row.name === 'Bridgewater');
    expect(bridgewater.tuition_per_credit_usd).toBeCloseTo(488.92, 1);
    const amherst = universities.find((row) => row.name === 'UMass Amherst');
    expect(amherst.tuition_per_credit_usd).toBeCloseTo(740.5, 1);
  });

  it('imports the final PDF Figures 4 and 5 as an exact, shared 49-pair baseline', async () => {
    const withPdf = loadRaw();
    const report = await runMaImport(db, withPdf, { apply: true });
    expect(report.failures).toEqual([]);

    const hours = await db.collection('ma_paper_baselines')
      .find({ measure: 'extra_hours_pdf', community_college_id: { $ne: null } }).toArray();
    const costs = await db.collection('ma_paper_baselines')
      .find({ measure: 'extra_cost_pdf', community_college_id: { $ne: null } }).toArray();
    expect(hours).toHaveLength(49);
    expect(costs).toHaveLength(49);
    expect(hours.reduce((sum, row) => sum + row.value, 0) / hours.length)
      .toBeCloseTo(12.9183673469, 8);
    expect(costs.reduce((sum, row) => sum + row.value, 0) / costs.length)
      .toBeCloseTo(7129.4285714286, 8);
    expect(new Set(hours.map((row) => `${row.school_id}|${row.community_college_id}`)))
      .toEqual(new Set(costs.map((row) => `${row.school_id}|${row.community_college_id}`)));
    expect(hours.every((row) => row.source.includes('Figure 4'))).toBe(true);
    expect(costs.every((row) => row.source.includes('Figure 5'))).toBe(true);
  });

  it('rejects a Figure-5 transcription that no longer shares Figure 4 arithmetic', () => {
    const pdf = JSON.parse(JSON.stringify(loadPdfFigures()));
    pdf.fig5_extra_cost.cells.Berkshire.MCLA += 500;
    expect(() => mergePdfFigures(raw, pdf)).toThrow(/Figure 5/i);
  });

  it('refuses to apply when validation fails', async () => {
    const broken = JSON.parse(JSON.stringify(raw));
    broken.heatmap.universities[0].matrix[
      Object.keys(broken.heatmap.universities[0].matrix)[0]
    ][0] = !broken.heatmap.universities[0].matrix[
      Object.keys(broken.heatmap.universities[0].matrix)[0]
    ][0];
    const report = await runMaImport(db, broken, { apply: true });
    expect(report.failures.length).toBeGreaterThan(0);
    expect(await db.collection('assist_agreements').countDocuments({ state: 'ma' })).toBe(0);
  });
});
