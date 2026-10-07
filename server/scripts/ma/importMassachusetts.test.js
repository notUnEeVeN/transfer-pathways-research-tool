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

  // The rate is BACK-DERIVED as cost divided by hours above 120, so a campus
  // whose studied pathways all land at exactly 120 divides by zero and gets no
  // rate. That is not a gap in the import: in the final workbook UMass Amherst
  // (3 pathways) and UMass Dartmouth (2) carry no excess hours at all, and the
  // paper prints no per-credit rate for either — its Figure 5 legend lists
  // nine. The older workbook showed excess for both, which is why this once
  // read as eleven.
  it('derives a per-credit rate wherever the cost tab divides, and nowhere else', async () => {
    await runMaImport(db, raw, { apply: true });
    const universities = await db.collection('assist_institutions')
      .find({ kind: 'university', state: 'ma' }).toArray();
    expect(universities).toHaveLength(11);
    const priced = universities.filter((u) => u.tuition_per_credit_usd != null);
    const unpriced = universities.filter((u) => u.tuition_per_credit_usd == null);
    expect(priced).toHaveLength(9);
    expect(unpriced.map((u) => u.name).sort()).toEqual(['UMass Amherst', 'UMass Dartmouth']);
    for (const university of priced) {
      expect(university.tuition_per_credit_usd).toBeGreaterThan(300);
      // The credit-rate pricer divides annual by 24 semester units; the
      // stamped annual is the derived rate re-expressed on that convention.
      expect(university.tuition_annual_resident_usd)
        .toBeCloseTo(university.tuition_per_credit_usd * 24, 5);
      expect(university.tuition_source).toMatch(/Cost tab/i);
    }
    const bridgewater = universities.find((row) => row.name === 'Bridgewater');
    expect(bridgewater.tuition_per_credit_usd).toBeCloseTo(489, 0);
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

  it('rejects a missing printed Figure-3 value instead of converting null to zero percent', () => {
    const pdf = structuredClone(loadPdfFigures());
    pdf.fig3_pct_as.cells.Berkshire.MCLA = null;
    expect(() => mergePdfFigures(raw, pdf)).toThrow(/nonnumeric/);
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

  it('removes the old imported Bristol duplicate without leaving a phantom course', async () => {
    await db.collection('assist_courses').insertOne({
      _id: 'ma:sending:9102064', state: 'ma', side: 'sending',
      prefix: 'ELEC', number: 'xxx', title: 'Human Expression', units: 3,
    });
    const report = await runMaImport(db, raw, { apply: true });
    expect(report.failures).toEqual([]);
    expect(await db.collection('assist_courses').findOne({ _id: 'ma:sending:9102064' })).toBeNull();
    const degree = await db.collection('curated_requirements').findOne({ _id: 'as_degree:ma:9102:local_as' });
    expect(degree.total_units).toBe(69);
    expect(degree.requirement_groups[0].sections[0].receivers).toHaveLength(20);
  });
});

// The cross-state lens, gated on the real corpus rather than on a fixture.
// Figure 1's published value is a course COUNT; Virginia's guides and
// California's GE-excluded unit lens are written in credit. These assertions
// pin what happens when the Massachusetts population is read the same way, so
// the comparison the three figures invite is reproducible — and so that
// re-weighting can never quietly move the published number it sits beside.
describe('credit-weighted reading of the Massachusetts Figure 1 population', () => {
  const mean = (values) => {
    const finite = values.filter(Number.isFinite);
    return finite.reduce((sum, value) => sum + value, 0) / finite.length;
  };

  it('re-weights all 165 cells without moving the published course figure', async () => {
    const report = await runMaImport(db, raw, { apply: true });
    expect(report.failures).toEqual([]);
    const { coverageData } = cjs('../../services/analysis/pathways');
    const rows = await coverageData(db, db, { requirements: 'degree', majorSlug: 'ma-cs' });
    const cells = rows.filter((row) => row.community_college_id != null);
    expect(cells).toHaveLength(165);

    // Unchanged: the paper's own published mean, which the import already
    // gates cell by cell. The stored cells carry one decimal, so their mean is
    // 38.2642 where the unrounded ratios average the printed 38.2671 — the
    // figure draws the stored values, so that is what this pins.
    expect(mean(cells.map((cell) => cell.pct_named_requirement_courses)))
      .toBeCloseTo(38.2642, 3);
    expect(mean(cells.map((cell) => (
      (cell.named_requirement_courses_articulated
        / cell.named_requirement_courses_total) * 100
    )))).toBeCloseTo(38.2671, 3);
    // The same 270 required-course columns weighted by their own credits.
    // Every cell is priced, so the lens never silently thins the population.
    expect(cells.every((cell) => Number.isFinite(cell.pct_named_requirement_units)))
      .toBe(true);
    expect(mean(cells.map((cell) => cell.pct_named_requirement_units)))
      .toBeCloseTo(40.5739, 3);
    // GE included, on the modelling standard the course variant already
    // applies: general education clears below the upper division.
    expect(mean(cells.map((cell) => cell.pct_named_requirement_units_with_ge)))
      .toBeCloseTo(60.5842, 3);
    expect(mean(cells.map((cell) => cell.pct_named_requirement_courses_with_ge)))
      .toBeCloseTo(59.6782, 3);
  }, 60_000);

  it('models each degree at about the size the resident plan states', async () => {
    // A Figure 1 slot column and the resident example course that represents it
    // are ONE requirement. Counting them separately inflated the degree by 17%
    // statewide and put upper-division major courses inside general education,
    // which the GE-included reading then granted at every college.
    await runMaImport(db, raw, { apply: true });
    const { coverageData } = cjs('../../services/analysis/pathways');
    const rows = await coverageData(db, db, { requirements: 'degree', majorSlug: 'ma-cs' });
    const byCampus = new Map();
    for (const row of rows) if (!byCampus.has(row.school)) byCampus.set(row.school, row);
    expect(byCampus.size).toBe(11);
    let exact = 0;
    for (const row of byCampus.values()) {
      const stated = row.degree_units_stated_minimum;
      const modeled = row.named_requirement_units_with_ge_total;
      if (modeled === stated) exact += 1;
      // Nothing may run away: the worst residual is UMass Dartmouth, whose
      // heatmap names 31 columns against a 120-credit plan.
      expect(modeled).toBeGreaterThanOrEqual(stated - 1);
      expect(modeled).toBeLessThanOrEqual(stated + 16);
    }
    expect(exact).toBeGreaterThanOrEqual(8);
    // And the residue left over is a plausible general-education block rather
    // than a dumping ground: Massachusetts' own transfer block is 34 credits.
    const geMean = [...byCampus.values()]
      .reduce((sum, row) => sum + row.degree_units_ge_total, 0) / byCampus.size;
    expect(geMean).toBeGreaterThan(30);
    expect(geMean).toBeLessThan(45);
  }, 60_000);

  it('keeps the lower-division reading inside the whole-degree one', async () => {
    // The invariant that caught an elective-inflated lower-division tally:
    // credit a transfer can articulate below the division line is a SUBSET of
    // the credit the degree names, so neither side of the lower-division ratio
    // may exceed its whole-degree counterpart, and the ratio cannot pass 100%.
    await runMaImport(db, raw, { apply: true });
    const { coverageData } = cjs('../../services/analysis/pathways');
    const rows = await coverageData(db, db, { requirements: 'degree', majorSlug: 'ma-cs' });
    const cells = rows.filter((row) => row.community_college_id != null);
    const sum = (cell, field) => Object.values(cell.degree_requirements_by_course_type || {})
      .reduce((total, bucket) => total + (bucket[field] || 0), 0);
    for (const cell of cells) {
      expect(cell.named_requirement_units_lower_total)
        .toBeLessThanOrEqual(cell.named_requirement_units_total);
      expect(cell.named_requirement_units_lower_articulated)
        .toBeLessThanOrEqual(cell.named_requirement_units_articulated);
      expect(cell.named_requirement_units_lower_articulated)
        .toBeLessThanOrEqual(cell.named_requirement_units_lower_total);
      expect(cell.named_requirement_units_lower_ge_articulated)
        .toBeLessThanOrEqual(cell.named_requirement_units_lower_ge_total);
      expect(cell.named_requirement_units_lower_ge_total)
        .toBeGreaterThanOrEqual(cell.named_requirement_units_lower_total);
      // Two independent paths over the same walk: the row fields come from the
      // requirement rollup, the buckets from the per-observation one that
      // Figure 2 partitions. A credit-weighted reading that disagreed with its
      // own counted population would be describing a different degree.
      expect(sum(cell, 'units')).toBeCloseTo(cell.named_requirement_units_total, 1);
      expect(sum(cell, 'units_covered'))
        .toBeCloseTo(cell.named_requirement_units_articulated, 1);
      expect(sum(cell, 'lower_division_units'))
        .toBeCloseTo(cell.named_requirement_units_lower_total, 1);
      expect(sum(cell, 'lower_division_units_covered'))
        .toBeCloseTo(cell.named_requirement_units_lower_articulated, 1);
    }
    // Massachusetts articulates less of its lower division than any other
    // corpus measured, while its degrees name MORE of their credit there — the
    // pair of facts behind its whole-degree figure sitting above California's.
    expect(mean(cells.map((cell) => (
      (cell.named_requirement_units_lower_articulated
        / cell.named_requirement_units_lower_total) * 100
    )))).toBeCloseTo(58.98, 1);
  }, 60_000);

  it('leaves the California unit-budget lens unmodelled on this corpus', async () => {
    await runMaImport(db, raw, { apply: true });
    const { coverageData } = cjs('../../services/analysis/pathways');
    const rows = await coverageData(db, db, { requirements: 'degree', majorSlug: 'ma-cs' });
    // The requirement rollup is available; the cap-and-netting budget is not,
    // and adding the first must not switch the second back on.
    for (const row of rows) {
      expect(row.pct_degree_units).toBeNull();
      expect(row.degree_transfer_cap).toBeNull();
    }
  }, 60_000);
});
