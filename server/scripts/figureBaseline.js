#!/usr/bin/env node
/**
 * One-command proof that a change moved no published figure.
 *
 * This project's product is the figures. A refactor that changes a rendered
 * value by a tenth of a point is a failure even when every unit test passes,
 * and the suites do not pin figure values — they pin behavior on seeded
 * fixtures. This script closes that gap: it computes a fingerprint over every
 * configured corpus from the live database and diffs it against a committed
 * baseline.
 *
 * The measures are the ones actually rendered.  Summary means remain human
 * readable, while canonical row hashes make the proof cell-sensitive: two
 * cells moving in opposite directions can no longer cancel out and pass.
 *
 *   Figure 1  pct_named_requirement_courses          (coverage, degree lens)
 *   Figure 2  course-type coverage numerators and denominators
 *   Figure 3  paper_equivalent_as_unit_utilization_pct
 *             full_degree_completion_pct
 *   Figure 4  modeled_hours_above_120
 *   Figure 5  modeled cost and its unrounded Figure-4 numerator
 *   Figure 6  complete live CA pathway-complexity rows and committed MA paper
 *             reproduction
 * plus the row/computed/excluded counts, because a figure can also change by
 * gaining or losing cells while its mean holds still.
 *
 * `scripts/normalizeDegreeCategories.js` runs a narrower version of this
 * inline as its own write gate. This is the standalone, all-corpus form.
 *
 *   node scripts/figureBaseline.js            # diff against the committed baseline
 *   node scripts/figureBaseline.js --write    # record a new baseline
 *   node scripts/figureBaseline.js --json     # print the fingerprint, no diff
 *
 * Exit code is 1 on any drift, so it works as a pre-merge check.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { listMajors } = require('../config/majors');
const { coverageData } = require('../services/analysis/pathways');
const { transferCreditRateData } = require('../services/analysis/transferCreditRate');
const { pathwayComplexityData } = require('../services/analysis/pathwayComplexity');

const MA_FIGURE2_FINAL = require('../../frontend/src/analyses/data/ma-figure2-final-pdf.json');
const MA_FIGURE2_ARCHIVE = require('../../frontend/src/analyses/data/ma-figure2-archive-direct.json');
const MA_FIGURE6 = require('../data/ma/complexity-validation.json');

const CA_STATIC_FIGURE_ARTIFACTS = Object.freeze([
  '../../frontend/src/analyses/paperCreditLossBaseline.js',
  '../../frontend/src/analyses/paperDistrictBaseline.js',
  '../../frontend/src/analyses/paperCourseBarriersBaseline.js',
  '../../frontend/src/analyses/data/paper-credit-loss.ours.json',
  '../../frontend/src/analyses/data/paper-credit-loss.assist.json',
  '../../frontend/src/analyses/data/paper-credit-loss.bio.assist.json',
  '../../frontend/src/analyses/data/paper-credit-loss.econ.assist.json',
  '../../analysis/data/paper_articulation_map.json',
]);

const BASELINE = path.resolve(__dirname, '../data/figure-baseline.json');
const WRITE = process.argv.includes('--write');
const JSON_ONLY = process.argv.includes('--json');

// Three decimals: below display precision, above floating-point noise. A
// change smaller than this cannot reach a reader; a change larger than it is
// real and must be explained.
const round = (value) => (Number.isFinite(value) ? Number(value.toFixed(3)) : null);
const mean = (values) => {
  const finite = values.filter(Number.isFinite);
  return finite.length ? round(finite.reduce((a, b) => a + b, 0) / finite.length) : null;
};

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalValue(value[key])]));
};
const canonicalJson = (value) => JSON.stringify(canonicalValue(value));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const hashFigureRows = (rows, project) => {
  const projected = rows.map(project);
  projected.sort((a, b) => {
    const identityA = canonicalJson(a.identity);
    const identityB = canonicalJson(b.identity);
    if (identityA < identityB) return -1;
    if (identityA > identityB) return 1;
    // Some grouped views can legitimately produce repeated display identities.
    // Make those rows a multiset, not a dependence on Mongo return order.
    const rowA = canonicalJson(a);
    const rowB = canonicalJson(b);
    return rowA < rowB ? -1 : (rowA > rowB ? 1 : 0);
  });
  return sha256(canonicalJson(projected));
};

const coverageIdentity = (row) => ({
  system: row.system ?? null,
  school_id: row.school_id ?? null,
  community_college_id: row.community_college_id ?? null,
  community_college_ids: row.community_college_ids ?? [],
  major: row.major ?? null,
  row_group_kind: row.row_group_kind ?? null,
  row_group_key: row.row_group_key ?? null,
});

const coverageFigure1Cell = (row) => ({
  identity: coverageIdentity(row),
  named_requirement_courses_total: row.named_requirement_courses_total ?? null,
  named_requirement_courses_articulated: row.named_requirement_courses_articulated ?? null,
  pct_named_requirement_courses: row.pct_named_requirement_courses ?? null,
  named_requirement_courses_with_ge_total:
    row.named_requirement_courses_with_ge_total ?? null,
  named_requirement_courses_with_ge_articulated:
    row.named_requirement_courses_with_ge_articulated ?? null,
  pct_named_requirement_courses_with_ge:
    row.pct_named_requirement_courses_with_ge ?? null,
  published_pdf_pct_named_requirement_courses:
    row.published_pdf_pct_named_requirement_courses ?? null,
  published_pdf_named_requirement_column_average:
    row.published_pdf_named_requirement_column_average ?? null,
  published_pdf_named_requirement_prose_mean:
    row.published_pdf_named_requirement_prose_mean ?? null,
});

const coverageFigure2Cell = (row) => ({
  identity: coverageIdentity(row),
  degree_requirements_total: row.degree_requirements_total ?? null,
  degree_requirements_with_equivalent: row.degree_requirements_with_equivalent ?? null,
  pct_degree_requirements: row.pct_degree_requirements ?? null,
  degree_requirement_slots_total: row.degree_requirement_slots_total ?? null,
  degree_requirement_slots_with_equivalent:
    row.degree_requirement_slots_with_equivalent ?? null,
  pct_degree_requirement_slots: row.pct_degree_requirement_slots ?? null,
  degree_requirements_by_course_type: row.degree_requirements_by_course_type ?? null,
  degree_requirements_by_course_category: row.degree_requirements_by_course_category ?? null,
});

const coverageArticulationCell = (row) => ({
  identity: coverageIdentity(row),
  assist_base_agreement_id: row.assist_base_agreement_id ?? null,
  assist_base_community_college_id: row.assist_base_community_college_id ?? null,
  receivers_required: row.receivers_required ?? null,
  receivers_articulated: row.receivers_articulated ?? null,
  pct_articulated: row.pct_articulated ?? null,
  fully_articulated: row.fully_articulated ?? null,
  requirement_groups: row.requirement_groups ?? null,
  assist_requirements_by_course_category:
    row.assist_requirements_by_course_category ?? null,
});

const transferIdentity = (row) => ({
  record_id: row.record_id ?? null,
  school_id: row.school_id ?? null,
  community_college_id: row.community_college_id ?? null,
  degree_type: row.degree_type ?? null,
});

const transferPopulation = (row) => ({
  identity: transferIdentity(row),
  method_status: row.method_status ?? null,
  exclusion_reason: row.exclusion_reason ?? null,
});

const transferFigure3Cell = (row) => ({
  ...transferPopulation(row),
  as_total_units: row.as_total_units ?? null,
  as_unit_system: row.as_unit_system ?? null,
  as_unit_utilization_pct: row.as_unit_utilization_pct ?? null,
  paper_equivalent_as_unit_utilization_pct:
    row.paper_equivalent_as_unit_utilization_pct ?? null,
  prescribed_units: row.prescribed_units ?? null,
  transferred_units: row.transferred_units ?? null,
  paper_equivalent_transferred_units: row.paper_equivalent_transferred_units ?? null,
  named_units: row.named_units ?? null,
  named_transferred_units: row.named_transferred_units ?? null,
  ge_demand_units: row.ge_demand_units ?? null,
  ge_counted_units: row.ge_counted_units ?? null,
  ge_verified_units: row.ge_verified_units ?? null,
  ge_assumed_units: row.ge_assumed_units ?? null,
  elective_demand_units: row.elective_demand_units ?? null,
  elective_counted_units: row.elective_counted_units ?? null,
  published_as_transfer_pct: row.published_as_transfer_pct ?? null,
  published_pdf_as_transfer_pct: row.published_pdf_as_transfer_pct ?? null,
  archive_gray_detail_as_transfer_pct: row.archive_gray_detail_as_transfer_pct ?? null,
  archive_gray_detail_numerator_units: row.archive_gray_detail_numerator_units ?? null,
  archive_gray_detail_denominator_units: row.archive_gray_detail_denominator_units ?? null,
  archive_gray_detail_blue_units_excluded:
    row.archive_gray_detail_blue_units_excluded ?? null,
});

const transferFigure4Cell = (row) => ({
  ...transferPopulation(row),
  degree_unit_system: row.degree_unit_system ?? null,
  full_degree_required_units: row.full_degree_required_units ?? null,
  full_degree_fulfilled_units: row.full_degree_fulfilled_units ?? null,
  full_degree_completion_pct: row.full_degree_completion_pct ?? null,
  lower_division_required_units: row.lower_division_required_units ?? null,
  lower_division_fulfilled_units: row.lower_division_fulfilled_units ?? null,
  lower_division_completion_pct: row.lower_division_completion_pct ?? null,
  known_nontransferable_units: row.known_nontransferable_units ?? null,
  extra_units: row.extra_units ?? null,
  extra_units_semester: row.extra_units_semester ?? null,
  modeled_pathway_units_semester: row.modeled_pathway_units_semester ?? null,
  modeled_hours_above_120: row.modeled_hours_above_120 ?? null,
  modeled_hours_above_120_unrounded: row.modeled_hours_above_120_unrounded ?? null,
  published_pdf_extra_hours: row.published_pdf_extra_hours ?? null,
  archived_pathway_sheet_total_hours: row.archived_pathway_sheet_total_hours ?? null,
  archived_pathway_sheet_extra_hours: row.archived_pathway_sheet_extra_hours ?? null,
});

const transferFigure5Cell = (row) => ({
  ...transferPopulation(row),
  modeled_hours_above_120_unrounded: row.modeled_hours_above_120_unrounded ?? null,
  extra_cost_usd: row.extra_cost_usd ?? null,
  extra_cost_standard_load_usd: row.extra_cost_standard_load_usd ?? null,
  modeled_cost_above_120_usd: row.modeled_cost_above_120_usd ?? null,
  modeled_cost_above_120_standard_load_usd:
    row.modeled_cost_above_120_standard_load_usd ?? null,
  published_pdf_extra_cost_usd: row.published_pdf_extra_cost_usd ?? null,
  tuition_annual_resident_usd: row.tuition_annual_resident_usd ?? null,
  tuition_price_year: row.tuition_price_year ?? null,
});

const complexityFigure6Cell = (row) => ({
  identity: transferIdentity(row),
  method_status: row.method_status ?? null,
  exclusion_reason: row.exclusion_reason ?? null,
  as_courses: row.as_courses ?? null,
  as_selected_units: row.as_selected_units ?? null,
  requirements_consumed: row.requirements_consumed ?? null,
  n_courses: row.n_courses ?? null,
  n_placeholder: row.n_placeholder ?? null,
  n_edges: row.n_edges ?? null,
  complexity: row.complexity ?? null,
  max_delay: row.max_delay ?? null,
  edge_info_pct: row.edge_info_pct ?? null,
  resident_complexity: row.resident_complexity ?? null,
  delta_vs_resident: row.delta_vs_resident ?? null,
});

async function fingerprint(db) {
  const out = {};
  out['ca|static-paper-artifacts'] = Object.fromEntries(CA_STATIC_FIGURE_ARTIFACTS
    .map((relativePath) => {
      const absolutePath = path.resolve(__dirname, relativePath);
      const extension = path.extname(absolutePath);
      const bytes = fs.readFileSync(absolutePath, 'utf8');
      return [path.relative(path.resolve(__dirname, '../..'), absolutePath),
        extension === '.json' ? sha256(canonicalJson(JSON.parse(bytes))) : sha256(bytes)];
    }));
  // Every configured major, states included, so a newly ported corpus is
  // covered the moment it lands in the registry rather than when someone
  // remembers to add it here.
  for (const major of listMajors({ includeStates: true })) {
    const slug = major.slug;
    const coverage = await coverageData(db, db, { majorSlug: slug, requirements: 'degree' });
    out[`${slug}|figure1`] = {
      rows: coverage.length,
      pct_named_requirement_courses: mean(coverage.map((r) => r.pct_named_requirement_courses)),
      pct_named_requirement_courses_with_ge:
        mean(coverage.map((r) => r.pct_named_requirement_courses_with_ge)),
      ...((major.state == null || major.state === 'ma') ? {
        cell_values_sha256: hashFigureRows(coverage, coverageFigure1Cell),
      } : {}),
    };
    if (major.state == null || major.state === 'ma') {
      out[`${slug}|figure2`] = {
        rows: coverage.length,
        cell_values_sha256: hashFigureRows(coverage, coverageFigure2Cell),
        ...(major.state === 'ma' ? {
          final_pdf_artifact_sha256: sha256(canonicalJson(MA_FIGURE2_FINAL)),
          archive_direct_artifact_sha256: sha256(canonicalJson(MA_FIGURE2_ARCHIVE)),
        } : {}),
      };
      for (const groupBy of ['district', 'county']) {
        const grouped = await coverageData(db, db, {
          majorSlug: slug, requirements: 'degree', groupBy,
        });
        out[`${slug}|coverage|degree|${groupBy}`] = {
          rows: grouped.length,
          figure1_cell_values_sha256: hashFigureRows(grouped, coverageFigure1Cell),
          figure2_cell_values_sha256: hashFigureRows(grouped, coverageFigure2Cell),
        };
      }
      if (major.state == null) {
        const requirementsModes = slug === 'cs' ? ['assist', 'paper'] : ['assist'];
        for (const requirements of requirementsModes) {
          for (const groupBy of ['college', 'district', 'county']) {
            const grouped = await coverageData(db, db, {
              majorSlug: slug,
              requirements,
              groupBy,
              ...(requirements === 'paper' ? { pin: 'paper' } : {}),
            });
            out[`${slug}|coverage|${requirements}|${groupBy}`] = {
              rows: grouped.length,
              cell_values_sha256: hashFigureRows(grouped, coverageArticulationCell),
            };
          }
        }
      }
    }
    const slots = major.degreeAnalysisSlots?.length ? major.degreeAnalysisSlots : ['local_as'];
    for (const degreeType of slots) {
      const rows = await transferCreditRateData(db, null, {
        degreeType, majorSlug: slug, verifiedOnly: false,
      });
      const computed = rows.filter((r) => (
        Number.isFinite(r.paper_equivalent_as_unit_utilization_pct)
      ));
      out[`${slug}|${degreeType}`] = {
        rows: rows.length,
        computed: computed.length,
        excluded: rows.filter((r) => r.method_status === 'excluded').length,
        paper_equivalent_as_unit_utilization_pct:
          mean(computed.map((r) => r.paper_equivalent_as_unit_utilization_pct)),
        full_degree_completion_pct: mean(computed.map((r) => r.full_degree_completion_pct)),
        lower_division_completion_pct: mean(computed.map((r) => r.lower_division_completion_pct)),
        modeled_hours_above_120: mean(computed.map((r) => r.modeled_hours_above_120)),
        ...((major.state == null || major.state === 'ma') ? {
          figure3_cell_values_sha256: hashFigureRows(rows, transferFigure3Cell),
          figure4_cell_values_sha256: hashFigureRows(rows, transferFigure4Cell),
          figure5_cell_values_sha256: hashFigureRows(rows, transferFigure5Cell),
        } : {}),
      };
      // Use the direct scorer, never pathwayComplexityCached: this proof is
      // read-only and must not populate or mutate the shared analysis cache.
      if (major.state == null) {
        const complexity = await pathwayComplexityData(db, null, {
          degreeType, majorSlug: slug, verifiedOnly: false,
        });
        out[`${slug}|${degreeType}|figure6`] = {
          rows: complexity.length,
          computed: complexity.filter((row) => Number.isFinite(row.delta_vs_resident)).length,
          excluded: complexity.filter((row) => row.method_status === 'excluded').length,
          cell_values_sha256: hashFigureRows(complexity, complexityFigure6Cell),
        };
      }
    }
    if (major.state === 'ma') {
      out[`${slug}|figure6`] = {
        pathways: Array.isArray(MA_FIGURE6.pathways) ? MA_FIGURE6.pathways.length : 0,
        final_pdf_cells: Object.values(MA_FIGURE6?.final_pdf?.cells || {})
          .reduce((sum, cells) => sum + Object.keys(cells || {}).length, 0),
        artifact_sha256: sha256(canonicalJson(MA_FIGURE6)),
      };
    }
  }
  return out;
}

function diff(before, after) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const drift = [];
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (!a) { drift.push(`  + ${key} is NEW (not in the baseline)`); continue; }
    if (!b) { drift.push(`  - ${key} is GONE (present in the baseline)`); continue; }
    for (const field of [...new Set([...Object.keys(a), ...Object.keys(b)])]) {
      if (a[field] !== b[field]) {
        drift.push(`  ~ ${key}.${field}: ${a[field]} -> ${b[field]}`);
      }
    }
  }
  return drift;
}

async function main() {
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db(process.env.DB_NAME || 'pmt_research');
  try {
    const current = await fingerprint(db);
    if (JSON_ONLY) {
      console.log(JSON.stringify(current, null, 1));
      return;
    }
    if (WRITE) {
      fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 1)}\n`);
      console.log(`baseline written: ${BASELINE}`);
      console.log(`${Object.keys(current).length} measures across ${new Set(Object.keys(current).map((k) => k.split('|')[0])).size} corpora`);
      return;
    }
    if (!fs.existsSync(BASELINE)) {
      console.error(`no baseline at ${BASELINE} — run with --write first`);
      process.exitCode = 1;
      return;
    }
    const drift = diff(JSON.parse(fs.readFileSync(BASELINE, 'utf8')), current);
    if (!drift.length) {
      console.log(`✓ no figure drift — ${Object.keys(current).length} measures match the baseline`);
      return;
    }
    console.error(`✗ ${drift.length} figure value(s) moved:\n${drift.join('\n')}`);
    console.error('\nIf the change is intended, re-record with --write and say why in the commit.');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exit(1); });
}

module.exports = {
  canonicalJson,
  complexityFigure6Cell,
  coverageArticulationCell,
  coverageFigure1Cell,
  coverageFigure2Cell,
  diff,
  fingerprint,
  hashFigureRows,
  transferFigure3Cell,
  transferFigure4Cell,
  transferFigure5Cell,
};
