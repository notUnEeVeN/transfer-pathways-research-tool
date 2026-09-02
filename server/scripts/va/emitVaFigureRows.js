#!/usr/bin/env node
/**
 * Emit the committed Virginia rows for Figures 1 and 3 from the coverage cells.
 *
 * The rows were first generated ad hoc, which meant the only way to add a
 * measure was to hand-edit a megabyte of JSON. This is the same transform
 * written down: cells in, the two frontend modules out, four supply variants
 * each. The prose header of each module is preserved verbatim — it documents
 * why these numbers are committed rather than served, and it is not this
 * script's to rewrite.
 *
 *   node scripts/va/buildVaCoverageCells.js --write   # cells
 *   node scripts/va/emitVaFigureRows.js               # rows
 */
const fs = require('node:fs');
const path = require('node:path');

const SERVER = path.resolve(__dirname, '..', '..');
const CELLS = path.join(SERVER, '.va-courses', 'va-coverage-cells.json');
const FRONTEND = path.resolve(SERVER, '..', 'frontend', 'src', 'analyses');
const VARIANTS = ['catalog', 'scheduled', 'catalog_all', 'scheduled_all'];
const GUIDES = path.join(SERVER, '.va-guides', 'guides.json');

/**
 * Which institution each guide belongs to.
 *
 * Written out rather than matched, because the guides abbreviate ("UL", "RMC",
 * "W&M", "NSU") and a fuzzy match resolved four of fifteen. The keys are the
 * `assist_institutions` names exactly; the values are the guide slugs the
 * FIGURE selects, after concentrations collapse to one program per university —
 * so the university page and the heatmap column are the same document.
 */
const GUIDE_BY_INSTITUTION = {
  'Bridgewater College': 'bridgewater-computer-science-bs-transfer-guide',
  'Christopher Newport University': 'cnu-computer-foundations-bs-computer-science-transfer-guide',
  'George Mason University': 'george-mason-computer-science-bs-transfer-guide',
  'Longwood University': 'longwood-computer-science-ba-or-bs-transfer-guide',
  'Norfolk State University': 'nsu-computer-science-bs-transfer-guide',
  'Old Dominion University': 'odu-computer-science-bs-transfer-guide',
  'Radford University': 'radford-computer-science-bs-network-concentration-transfer-guide',
  'Randolph-Macon College': 'rmc-computer-science-bs-transfer-guide',
  "The University of Virginia's College at Wise": 'uva-wise-computer-science-bs-transfer-guide-0',
  'University of Lynchburg': 'ul-computer-science-bs-transfer-guide',
  'University of Mary Washington': 'umw-computer-science-bs-transfer-guide',
  'University of Virginia': 'uva-computer-science-bs-transfer-guide',
  'Virginia Commonwealth University': 'vcu-computer-science-ba-transfer-guide',
  'Virginia Polytechnic Institute and State University': 'vt-computer-science-bs-transfer-guide',
  'William & Mary': 'wm-computer-science-ba-transfer-guide-0',
};

const pct = (x) => (x == null ? null : Math.round(x * 1000) / 10);
const round1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

/**
 * Keep the existing file's documentation. Regeneration replaces data, never
 * the explanation of what the data is.
 */
function header(file) {
  const text = fs.readFileSync(path.join(FRONTEND, file), 'utf8');
  const at = text.indexOf('export const');
  if (at < 0) throw new Error(`${file}: no export to split on`);
  return text.slice(0, at);
}

const coverageRow = (cell) => ({
  row_group_key: cell.college,
  row_group_label: cell.collegeName,
  row_group_kind: 'college',
  community_college_id: cell.college,
  community_college: cell.collegeName,
  school_id: cell.guide,
  school: cell.guideTitle,
  major: 'Computer Science, B.S.',
  // The Massachusetts convention: required courses, binary, general education
  // excluded. Rows are converted to courses at the credits-per-course the guide
  // itself exhibits, so a 30-credit "Required Core Courses" row is ten.
  // The figure recomputes every cell as articulated ÷ total and never reads the
  // percentage, so these three pairs must each reproduce the percentage beside
  // them exactly. They are the covered counts, not the supplied ones: a guide's
  // stated pre-transfer half includes elective padding it never itemises, which
  // is covered by any college and belongs in the numerator.
  // Scaling a half to its stated credit leaves fractional courses. They are
  // rounded once, here, and the percentage is computed FROM the rounded pair —
  // so what the figure recomputes is exactly what is published.
  pct_named_requirement_courses: cell.courses_total
    ? pct(round1(cell.covered_courses) / round1(cell.courses_total)) : null,
  named_requirement_courses_total: round1(cell.courses_total),
  named_requirement_courses_articulated: round1(cell.covered_courses),
  // Our unit-weighted reading of the same guide, general education counted.
  pct_named_requirement_courses_with_ge: pct(cell.coverage),
  named_requirement_courses_with_ge_total: cell.denominator,
  named_requirement_courses_with_ge_articulated: cell.covered_units,
  pct_articulated: pct(cell.coverage),
  degree_requirements_total: cell.denominator,
  degree_requirements_with_equivalent: cell.covered_units,
  degree_unit_system: 'semester',
  va_ceiling_pct: pct(cell.ceiling),
  va_ceiling_paper_pct: pct(cell.ceiling_paper),
  va_ceiling_courses_pct: cell.courses_total
    ? pct(round1(cell.pre_courses) / round1(cell.courses_total)) : null,
  // The intermediate reading: credits with general education off both sides.
  va_units_no_ge_pct: pct(cell.coverage_paper),
  va_units_no_ge_total: cell.denominator - cell.assumed,
  va_units_no_ge_articulated: cell.covered_units_no_ge,
  va_course_size: cell.course_size,
  va_ge_units: cell.ge_units,
  va_offers_cs: cell.collegeOffersCs,
  va_supplied_units: cell.supplied,
  va_missing_units: cell.missing_units,
  va_assumed_units: cell.assumed,
  va_university_only_units: cell.universityOnly,
  va_missing: cell.missing,
});

const rateRow = (cell) => ({
  community_college_id: cell.college,
  college_name: cell.collegeName,
  school_id: cell.guide,
  school: cell.guideTitle,
  major_slug: 'va-cs',
  degree_type: 'local_as',
  record_id: `as_degree:${cell.college}:va-cs:local_as`,
  as_unit_utilization_pct: pct(cell.utilization),
  paper_equivalent_as_unit_utilization_pct: pct(cell.utilization),
  lower_division_completion_pct: pct(cell.utilization),
  full_degree_completion_pct: pct(cell.coverage),
  as_total_units: cell.as_total_units,
  as_unit_system: 'semester',
  transferred_units: cell.as_applied_units,
  known_nontransferable_units: cell.as_wasted_units,
  prescribed_units: cell.as_total_units,
  degree_unit_system: 'semester',
  va_wasted_units: cell.as_wasted_units,
  // Figure 4: hours the student takes that do no requirement work.
  //
  // The Massachusetts construct is "pathway hours above the 120-hour
  // benchmark", which on their 120-hour curricula IS the unused associate
  // credit — the two coincide because there is no curriculum length to
  // separate. Virginia's guides state 120 to 134 credits, so the two come
  // apart, and summing them read as credit loss while mostly measuring degree
  // size: UVA's guide describes a 134-credit pathway, so it showed +14 hours
  // while Figure 3 reported it at 100% utilization with nothing wasted.
  //
  // So this is the unused credit alone, which is what the Massachusetts figure
  // means and what makes this the complement of Figure 3. The pathway's own
  // length above the benchmark is a real and separate fact about the guide, and
  // rides along beside it rather than inside it.
  modeled_hours_above_120: cell.as_wasted_units,
  va_degree_units_over_benchmark: Math.max(0, cell.denominator - 120),
  degree_units_stated_minimum: cell.denominator,
  va_offers_cs: cell.collegeOffersCs,
  va_wasted: cell.missing,
  method_status: 'ok',
});

function main() {
  const cells = JSON.parse(fs.readFileSync(CELLS, 'utf8'));
  const built_at = cells.built_at;

  const bundle = (shape, extra) => {
    const out = { built_at, census: cells.census };
    for (const variant of VARIANTS) {
      const list = cells[variant].cells;
      out[variant] = { ...extra(list), rows: list.map(shape) };
    }
    return out;
  };

  const mean = (list, key) => {
    const seen = list.map((c) => c[key]).filter((x) => x != null);
    return seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : null;
  };

  const coverage = bundle(coverageRow, (list) => ({
    pooled: {
      coverage: mean(list, 'coverage'),
      missing_units: list.reduce((n, c) => n + c.missing_units, 0),
      assumed_units: list.reduce((n, c) => n + c.assumed, 0),
    },
  }));
  const rate = bundle(rateRow, (list) => ({
    pooled: {
      utilization: mean(list, 'utilization'),
      wasted_units: list.reduce((n, c) => n + c.as_wasted_units, 0),
    },
  }));

  const write = (file, name, data) => {
    const body = `${header(file)}export const ${name} = ${JSON.stringify(data)}\n\nexport default ${name}\n`;
    fs.writeFileSync(path.join(FRONTEND, file), body);
    const rows = VARIANTS.reduce((n, v) => n + data[v].rows.length, 0);
    console.log(`${file.padEnd(24)} ${rows} rows across ${VARIANTS.length} variants`);
  };

  write('vaCoverageRows.js', 'VA_COVERAGE_ROWS', coverage);
  write('vaCreditRateRows.js', 'VA_CREDIT_RATE_ROWS', rate);
  writeGuides(cells);
}

/**
 * The guides themselves, as the university pages read them.
 *
 * The pages used to show catalog-composed degree documents, which is not what
 * any figure is computed from. A guide states the pathway in the state's own
 * terms, and it is the document the measurement actually reads, so it is the
 * one to put on the page.
 */
function writeGuides(cells) {
  const { guides } = JSON.parse(fs.readFileSync(GUIDES, 'utf8'));
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  const perGuide = new Map();
  for (const cell of cells.catalog.cells) {
    if (!perGuide.has(cell.guide)) {
      perGuide.set(cell.guide, {
        stated_pre_units: cell.stated_pre_units,
        stated_total_units: cell.stated_total_units,
        ge_units: cell.ge_units,
        university_only_units: cell.universityOnly,
        ceiling_pct: cell.ceiling == null ? null : Math.round(cell.ceiling * 1000) / 10,
      });
    }
  }
  const out = { built_at: cells.built_at, universities: {} };
  for (const [institution, slug] of Object.entries(GUIDE_BY_INSTITUTION)) {
    const guide = bySlug.get(slug);
    if (!guide) throw new Error(`no captured guide for ${institution} (${slug})`);
    const row = (item) => ({
      requirement: item.requirement_text,
      credits: item.credits ?? null,
      equivalent: item.equivalent ?? null,
    });
    out.universities[institution] = {
      slug,
      // Titled exactly as the figure titles its column, so a reader moving
      // between the university page and the heatmap sees one name.
      title: guide.title.replace(/ Transfer Guide$/, ''),
      source_url: guide.source_url,
      totals: guide.totals || null,
      derived: perGuide.get(slug) || null,
      before_transfer: (guide.cc_items || []).filter((i) => i.counts_toward_stats).map(row),
      after_transfer: (guide.post_items || []).filter((i) => i.counts_toward_stats).map(row),
    };
  }
  const file = 'vaTransferGuides.js';
  const body = `${header(file)}export const VA_TRANSFER_GUIDES = ${JSON.stringify(out)}\n\nexport default VA_TRANSFER_GUIDES\n`;
  fs.writeFileSync(path.join(FRONTEND, file), body);
  console.log(`${file.padEnd(24)} ${Object.keys(out.universities).length} universities`);
}

if (require.main === module) main();
module.exports = { coverageRow, rateRow };
