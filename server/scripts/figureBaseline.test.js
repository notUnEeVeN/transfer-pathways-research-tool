import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const cjs = createRequire(import.meta.url);
const {
  canonicalJson,
  complexityFigure6Cell,
  coverageFigure1Cell,
  hashFigureRows,
} = cjs('./figureBaseline');

describe('cell-sensitive figure baseline', () => {
  // Baseline provenance for the VA normalization review: these hashes were
  // regenerated only after an isolated parent checkout and this checkout,
  // pointed at the same live DB, matched on 6,558 Figure 1-5 core rows and
  // 15,741 wider grouped-view rows. The complete uncached CA Figure 6 export
  // was byte-identical (2.0 MB; SHA-256
  // f46e3c411c602b60f95d236344a338cf90df07860c9d01b8303a265fa3b171d9).
  it('pins every CA/MA Figure 1-6 corpus and every selectable associate-degree slot', () => {
    const baseline = JSON.parse(readFileSync(
      new URL('../data/figure-baseline.json', import.meta.url),
      'utf8',
    ));
    const hex = /^[a-f0-9]{64}$/;
    const corpora = {
      cs: ['local_as', 'ast'],
      bio: ['local_as', 'ast'],
      econ: ['ast', 'local_other'],
      'ma-cs': ['local_as'],
    };

    for (const [slug, degreeTypes] of Object.entries(corpora)) {
      expect(baseline[`${slug}|figure1`]?.cell_values_sha256).toMatch(hex);
      expect(baseline[`${slug}|figure2`]?.cell_values_sha256).toMatch(hex);
      for (const groupBy of ['district', 'county']) {
        expect(baseline[`${slug}|coverage|degree|${groupBy}`]
          ?.figure1_cell_values_sha256).toMatch(hex);
        expect(baseline[`${slug}|coverage|degree|${groupBy}`]
          ?.figure2_cell_values_sha256).toMatch(hex);
      }
      for (const degreeType of degreeTypes) {
        const transfer = baseline[`${slug}|${degreeType}`];
        expect(transfer?.figure3_cell_values_sha256).toMatch(hex);
        expect(transfer?.figure4_cell_values_sha256).toMatch(hex);
        expect(transfer?.figure5_cell_values_sha256).toMatch(hex);
        if (slug !== 'ma-cs') {
          expect(baseline[`${slug}|${degreeType}|figure6`]?.cell_values_sha256)
            .toMatch(hex);
        }
      }
    }
    for (const slug of ['cs', 'bio', 'econ']) {
      for (const groupBy of ['college', 'district', 'county']) {
        expect(baseline[`${slug}|coverage|assist|${groupBy}`]?.cell_values_sha256)
          .toMatch(hex);
      }
    }
    for (const groupBy of ['college', 'district', 'county']) {
      expect(baseline[`cs|coverage|paper|${groupBy}`]?.cell_values_sha256).toMatch(hex);
    }
    expect(Object.values(baseline['ca|static-paper-artifacts'] || {})).not.toHaveLength(0);
    expect(Object.values(baseline['ca|static-paper-artifacts'] || {}))
      .toEqual(expect.arrayContaining([expect.stringMatching(hex)]));
    expect(baseline['ma-cs|figure2']?.final_pdf_artifact_sha256).toMatch(hex);
    expect(baseline['ma-cs|figure2']?.archive_direct_artifact_sha256).toMatch(hex);
    expect(baseline['ma-cs|figure6']?.artifact_sha256).toMatch(hex);
  });

  it('detects offsetting cell movement even when the aggregate mean is unchanged', () => {
    const row = (communityCollegeId, value) => ({
      system: 'uc',
      school_id: 1,
      community_college_id: communityCollegeId,
      community_college_ids: [communityCollegeId],
      major: 'Computer Science',
      row_group_kind: 'college',
      row_group_key: String(communityCollegeId),
      pct_named_requirement_courses: value,
    });
    const before = [row(10, 20), row(20, 40)];
    const offsettingDrift = [row(10, 19), row(20, 41)];

    expect(before.reduce((sum, item) => sum + item.pct_named_requirement_courses, 0))
      .toBe(offsettingDrift.reduce(
        (sum, item) => sum + item.pct_named_requirement_courses,
        0,
      ));
    expect(hashFigureRows(before, coverageFigure1Cell))
      .not.toBe(hashFigureRows(offsettingDrift, coverageFigure1Cell));
  });

  it('is invariant to Mongo row order and object key insertion order', () => {
    const rows = [
      { record_id: 'b', school_id: 2, complexity: 7, delta_vs_resident: 1 },
      { record_id: 'a', school_id: 1, complexity: 5, delta_vs_resident: -1 },
    ];
    const reordered = [
      { delta_vs_resident: -1, complexity: 5, school_id: 1, record_id: 'a' },
      { delta_vs_resident: 1, complexity: 7, school_id: 2, record_id: 'b' },
    ];
    expect(hashFigureRows(rows, complexityFigure6Cell))
      .toBe(hashFigureRows(reordered, complexityFigure6Cell));
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } }))
      .toBe(canonicalJson({ a: { b: 3, y: 2 }, z: 1 }));
  });

  it('is order-invariant when two distinct cells share the same display identity', () => {
    const first = {
      record_id: 'duplicate', school_id: 1, community_college_id: 2,
      degree_type: 'ast', complexity: 5, delta_vs_resident: 1,
    };
    const second = { ...first, complexity: 9, delta_vs_resident: 5 };
    expect(hashFigureRows([first, second], complexityFigure6Cell))
      .toBe(hashFigureRows([second, first], complexityFigure6Cell));
  });

  it('pins every rendered Figure 6 graph metric rather than only its mean', () => {
    const row = {
      record_id: 'as:1',
      school_id: 1,
      community_college_id: 2,
      degree_type: 'ast',
      method_status: 'ok',
      as_courses: 10,
      as_selected_units: 30,
      requirements_consumed: 4,
      n_courses: 20,
      n_placeholder: 2,
      n_edges: 9,
      complexity: 45,
      max_delay: 4,
      edge_info_pct: 90,
      resident_complexity: 40,
      delta_vs_resident: 5,
    };
    for (const field of [
      'as_courses', 'as_selected_units', 'requirements_consumed', 'n_courses',
      'n_placeholder', 'n_edges', 'complexity', 'max_delay', 'edge_info_pct',
      'resident_complexity', 'delta_vs_resident',
    ]) {
      expect(hashFigureRows([row], complexityFigure6Cell))
        .not.toBe(hashFigureRows([{ ...row, [field]: row[field] + 1 }], complexityFigure6Cell));
    }
  });
});
