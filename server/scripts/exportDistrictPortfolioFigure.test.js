import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const cjs = createRequire(import.meta.url);
const {
  buildFigureSnapshot,
  validateFigureSnapshot,
} = cjs('./exportDistrictPortfolioFigure');

const canonicalPath = path.resolve(
  import.meta.dirname,
  '../data/analysis/district-portfolio-subsets.v1.json',
);
const installedPath = path.resolve(
  import.meta.dirname,
  '../../frontend/src/analyses/data/district-portfolio-subsets.v1.json',
);

describe('district portfolio figure exporter', () => {
  it('keeps the installed compact figure data synchronized with the canonical artifact', () => {
    const canonical = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));
    const installed = validateFigureSnapshot(
      JSON.parse(fs.readFileSync(installedPath, 'utf8')),
    );
    const rebuilt = validateFigureSnapshot(buildFigureSnapshot(canonical));

    expect(installed).toEqual(rebuilt);
    expect(installed.summary).toMatchObject({
      districts_total: 72,
      scenarios_total: 3266,
      usable_scenarios: 3256,
      exact_scenarios: 1970,
      bounded_scenarios: 1286,
      unavailable_scenarios: 10,
    });
    expect(installed.rows.map((row) => row.district_equal.distinct_courses.mean))
      .toEqual([8.8, 12.1, 14, 15.2, 16.1, 17.4, 17.7]);
  });

  it('rejects a noncanonical or structurally incomplete source', () => {
    expect(() => buildFigureSnapshot({ schema_version: 1, canonical: false }))
      .toThrow(/canonical/);
    expect(() => validateFigureSnapshot({ schema_version: 1, rows: [] }))
      .toThrow(/seven/);
  });
});
