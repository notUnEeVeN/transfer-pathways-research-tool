import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { maPathwayComplexity } from './maPathwayComplexity';

const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/raw/pathways.json'), 'utf8'));
const theirMath = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/their-math.json'), 'utf8'));
const validation = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/complexity-validation.json'), 'utf8'));
const pdfFigures = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../data/ma/pdf-figures.json'), 'utf8'));

describe('maPathwayComplexity', () => {
  it('gives each listed row its own vertex when two rows share an id', () => {
    // Two different courses are both labelled id 1, and a third names id 1 as
    // its prerequisite. Keying vertices by the id column would merge the pair
    // into a single course and lose a vertex.
    const rows = [
      { id: 1, name: 'Physics Labs', prereqs: [] },
      { id: 1, name: 'Organization of Programming Languages', prereqs: [] },
      { id: 2, name: 'Compilers', prereqs: [1] },
    ];
    const { perCourse } = maPathwayComplexity(rows);
    expect(perCourse).toHaveLength(3);
    // An edge naming an id two rows share reaches both — the only reading
    // available when the reference itself is ambiguous.
    expect(perCourse.map((c) => c.blocking)).toEqual([1, 1, 0]);
  });

  it("reproduces Bridgewater's archived resident score of 160", () => {
    const rows = raw.Bridgewater.resident;
    expect(rows.filter((r) => String(r.id) === '13')).toHaveLength(2);
    expect(maPathwayComplexity(rows).complexity).toBe(theirMath.currcomp.complexity.resident.Bridgewater);
  });

  it('matches 59 of the 60 archived score-tab values, missing only Dartmouth x Bristol', () => {
    const cells = theirMath.currcomp.complexity.cells || {};
    const resident = theirMath.currcomp.complexity.resident || {};
    const misses = [];
    let compared = 0;
    for (const [uni, block] of Object.entries(raw)) {
      const sheets = [[null, block.resident || []], ...Object.entries(block.pairs || {})];
      for (const [cc, rows] of sheets) {
        if (!rows.length) continue;
        const theirs = cc === null ? resident[uni] : cells[uni]?.[cc];
        if (!Number.isFinite(theirs)) continue;
        compared += 1;
        const ours = maPathwayComplexity(rows).complexity;
        if (ours !== theirs) misses.push(`${uni}${cc ? ` x ${cc}` : ' (resident)'}: ${ours} vs ${theirs}`);
      }
    }
    expect(compared).toBe(60);
    expect(misses).toEqual(['UMass Dartmouth x Bristol: 174 vs 170']);
  });

  it('keeps the final PDF, archived tab, and recomputation as separate artifacts', () => {
    expect(validation.final_pdf.source_sha256).toBe(pdfFigures.source_sha256);
    expect(validation.final_pdf.source_file_size_bytes).toBe(pdfFigures.source_file_size_bytes);
    expect(validation.final_pdf.summary).toEqual({ n: 49, sum: 715, mean: 14.591837 });
    expect(validation.final_pdf.cells).toEqual(pdfFigures.fig6_complexity_delta.cells);
    expect(validation.headline_means).toEqual({
      final_pdf: { n: 49, sum: 715, mean: 14.591837 },
      archived_tab: { n: 49, sum: 777, mean: 15.857143 },
      recomputed_archived_workbooks_scored: { n: 49, sum: 781, mean: 15.938776 },
      recomputed_all_archived_workbooks: { n: 61, sum: 627, mean: 10.278689 },
    });
    expect(validation.artifact_differences).toEqual([
      {
        uni: 'UMass Dartmouth', cc: 'Bristol', final_pdf_delta: -32,
        archived_tab_delta: -32, recomputed_archive_delta: -28,
        classification: 'recomputed_archive_vs_archived_tab',
      },
      {
        uni: 'UMass Amherst', cc: 'Springfield Technical', final_pdf_delta: -28,
        archived_tab_delta: 34, recomputed_archive_delta: 34,
        classification: 'final_pdf_vs_archived_tab',
      },
    ]);
  });

  it('records Figure 7 as a denominator reconciliation, not stale arithmetic', () => {
    expect(pdfFigures.fig7_summary_is_stale).toBeUndefined();
    expect(pdfFigures.fig7_cohort_reconciliation).toMatchObject({
      figure_7_cohort_n: {
        transfer_rate: 61, extra_hours: 61, curricular_complexity: 49, extra_cost: 61,
      },
      visible_matrix_cohort_n: {
        figure_4_extra_hours: 49, figure_5_extra_cost: 49, figure_6_curricular_complexity: 49,
      },
      restored_pathways: 12,
      classification: 'footnote_and_denominator_inconsistency_not_arithmetic_staleness',
    });
  });

  it('treats corequisites as edges, which is what reproduces the published scores', () => {
    const cells = theirMath.currcomp.complexity.cells || {};
    const resident = theirMath.currcomp.complexity.resident || {};
    const exactCount = (coreqs) => {
      let exact = 0;
      for (const [uni, block] of Object.entries(raw)) {
        const sheets = [[null, block.resident || []], ...Object.entries(block.pairs || {})];
        for (const [cc, rows] of sheets) {
          if (!rows.length) continue;
          const theirs = cc === null ? resident[uni] : cells[uni]?.[cc];
          if (!Number.isFinite(theirs)) continue;
          if (maPathwayComplexity(rows, { coreqs }).complexity === theirs) exact += 1;
        }
      }
      return exact;
    };
    expect(exactCount(true)).toBe(59);
    expect(exactCount(false)).toBeLessThan(20);
  });
});
