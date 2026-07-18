#!/usr/bin/env node

/**
 * Compare the three CS-related associate-degree categories school by school.
 *
 * This deliberately combines two sources:
 *   1. scripts/data/as_degrees_cs_extraction.json: the 115-school inventory.
 *   2. curated_requirements(kind=as_degree): requirement records that can
 *      actually be passed to downstream analyses.
 *
 * Run from the repository root:
 *   node analysis/as_degree_type_analysis.js
 *
 * Optional environment variables:
 *   MONGO_URI / TARGET_MONGO_URI (default mongodb://127.0.0.1:27017)
 *   DB_NAME / TARGET_DB_NAME     (default pmt_research)
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('../server/node_modules/mongodb');
const { asDegreeOverview } = require('../server/services/asDegreeView');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(ROOT, 'scripts/data/as_degrees_cs_extraction.json');
const OUTPUT_DIR = path.join(__dirname, 'results');
const SCHOOL_CSV = path.join(OUTPUT_DIR, 'as_degree_types_by_school.csv');
const SUMMARY_JSON = path.join(OUTPUT_DIR, 'as_degree_type_summary.json');
const SUMMARY_MD = path.join(OUTPUT_DIR, 'as_degree_type_analysis.md');

const DEGREE_TYPES = ['local_cs_as', 'ast', 'local_computing'];
const TYPE_LABELS = {
  local_cs_as: 'Local Computer Science A.S.',
  ast: 'Computer Science A.S.-T',
  local_computing: 'Local computing associate degree',
};

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function countCourseReferences(doc) {
  let resolved = 0;
  let unresolved = 0;
  for (const group of doc.requirement_groups || []) {
    unresolved += (group.unresolved_courses_seen || []).length;
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        for (const option of receiver.options || []) {
          resolved += (option.course_ids || []).length;
        }
      }
    }
  }
  return { resolved, unresolved };
}

function resolvedCourseSetKey(doc) {
  const ids = [];
  for (const group of doc.requirement_groups || []) {
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        for (const option of receiver.options || []) ids.push(...(option.course_ids || []));
      }
    }
  }
  return [...new Set(ids)].sort((a, b) => a - b).join(',');
}

function normalizedDegreeTitle(doc) {
  return String(doc.degree_title_seen || '')
    .replace(/\s*\[same program as local_cs_as[^\]]*\]\s*/i, '')
    .trim()
    .toLowerCase();
}

function findDuplicateLocalComputingIds(docs) {
  const bySchoolAndType = new Map(docs.map((doc) => [
    `${doc.community_college_id}:${doc.degree_type}`,
    doc,
  ]));
  const duplicateIds = new Set();
  for (const computing of docs.filter((doc) => doc.degree_type === 'local_computing')) {
    const localCs = bySchoolAndType.get(`${computing.community_college_id}:local_cs_as`);
    if (!localCs) continue;
    const sameTitle = normalizedDegreeTitle(computing) === normalizedDegreeTitle(localCs);
    const computingCourses = resolvedCourseSetKey(computing);
    const sameCourses = computingCourses && computingCourses === resolvedCourseSetKey(localCs);
    // Two genuinely distinct awards can share a core, so require the title
    // and exact resolved-course-set signals to agree before deduplicating.
    if (sameTitle && sameCourses) duplicateIds.add(computing._id);
  }
  return duplicateIds;
}

function csvCell(value) {
  if (value == null) return '';
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(rows) {
  const headers = [
    'community_college_id', 'college_name', 'district', 'region',
    'inventory_local_cs_as', 'inventory_ast', 'inventory_local_computing_count',
    'inventory_local_computing_titles',
    'stored_degree_mix', 'distinct_analyzable_degree_mix',
    'distinct_analyzable_degree_count', 'analysis_role', 'data_gap',
  ];
  for (const type of DEGREE_TYPES) {
    headers.push(
      `${type}_analyzable`, `${type}_degree_title`, `${type}_catalog_year`,
      `${type}_unit_system`, `${type}_total_units`, `${type}_confidence`,
      `${type}_template_coverage_pct`, `${type}_resolved_course_refs`,
      `${type}_unresolved_course_refs`, `${type}_verified`, `${type}_flags`,
    );
  }
  headers.push('local_computing_duplicate_of_local_cs_as');

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((header) => csvCell(row[header])).join(','));
  }
  fs.writeFileSync(SCHOOL_CSV, `${lines.join('\n')}\n`);
}

function schoolRole(types) {
  if (types.includes('local_cs_as')) {
    return types.includes('ast')
      ? 'Primary local-degree case; paired A.S.-T benchmark available'
      : 'Primary local-degree case; no paired A.S.-T benchmark';
  }
  if (types.includes('ast')) return 'A.S.-T benchmark only; no local CS A.S. case';
  if (types.includes('local_computing')) return 'Descriptive only; no comparable CS degree';
  return 'No analyzable CS-related associate degree';
}

function mixLabel(types) {
  return types.length ? types.join(' + ') : 'none';
}

function typeSummary(type, docs, overviewRows, schoolCount, duplicateIds) {
  const storedTypeDocs = docs.filter((doc) => doc.degree_type === type);
  const typeDocs = storedTypeDocs.filter((doc) => !duplicateIds.has(doc._id));
  const typeRows = overviewRows.filter((row) => row.degree_type === type);
  const overviewById = new Map(typeRows.map((row) => [row._id, row]));
  const confidences = typeDocs.map((doc) => doc.extraction?.confidence).filter(Number.isFinite);
  const semesterUnits = typeDocs
    .filter((doc) => doc.unit_system === 'semester')
    .map((doc) => doc.total_units)
    .filter(Number.isFinite);
  const coverage = typeRows.map((row) => row.coverage_pct).filter(Number.isFinite);
  const conceptCounts = new Map();
  let resolved = 0;
  let unresolved = 0;
  let recordsWithUnresolved = 0;
  const flagCounts = {};

  for (const doc of typeDocs) {
    const counts = countCourseReferences(doc);
    resolved += counts.resolved;
    unresolved += counts.unresolved;
    if (counts.unresolved) recordsWithUnresolved += 1;
    for (const concept of doc.covered_concepts || []) {
      conceptCounts.set(concept, (conceptCounts.get(concept) || 0) + 1);
    }
    for (const flag of overviewById.get(doc._id)?.flags || []) {
      flagCounts[flag] = (flagCounts[flag] || 0) + 1;
    }
  }

  const topConcepts = [...conceptCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([concept, records]) => ({
      concept,
      records,
      pct: round((records / typeDocs.length) * 100),
    }));

  return {
    label: TYPE_LABELS[type],
    stored_records: storedTypeDocs.length,
    excluded_duplicate_records: storedTypeDocs.length - typeDocs.length,
    analyzable_records: typeDocs.length,
    schools: new Set(typeDocs.map((doc) => doc.community_college_id)).size,
    pct_of_115_schools: round((typeDocs.length / schoolCount) * 100),
    confidence_mean: round(mean(confidences), 3),
    confidence_median: round(median(confidences), 3),
    confidence_min: confidences.length ? Math.min(...confidences) : null,
    semester_total_units_median: round(median(semesterUnits)),
    semester_total_units_min: semesterUnits.length ? Math.min(...semesterUnits) : null,
    semester_total_units_max: semesterUnits.length ? Math.max(...semesterUnits) : null,
    quarter_records: typeDocs.filter((doc) => doc.unit_system === 'quarter').length,
    template_coverage_mean_pct: round(mean(coverage)),
    template_coverage_median_pct: round(median(coverage)),
    template_coverage_min_pct: coverage.length ? Math.min(...coverage) : null,
    resolved_course_references: resolved,
    unresolved_course_references: unresolved,
    course_resolution_pct: round((resolved / (resolved + unresolved)) * 100),
    records_with_unresolved_courses: recordsWithUnresolved,
    verified_records: typeDocs.filter((doc) => doc.verification?.verified).length,
    flag_counts: flagCounts,
    top_concepts: topConcepts,
  };
}

function markdownTable(headers, rows) {
  const render = (value) => value == null ? '—' : String(value);
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(render).join(' | ')} |`),
  ].join('\n');
}

function buildMarkdown(summary) {
  const typeRows = DEGREE_TYPES.map((type) => {
    const item = summary.by_type[type];
    return [
      item.label,
      `${item.schools} (${item.pct_of_115_schools}%)`,
      item.template_coverage_mean_pct == null ? 'No valid template' : `${item.template_coverage_mean_pct}%`,
      `${item.course_resolution_pct}%`,
      item.confidence_mean,
      item.verified_records,
    ];
  });
  const mixRows = Object.entries(summary.analyzable_school_mixes)
    .sort((a, b) => b[1] - a[1])
    .map(([mix, schools]) => [mix, schools]);
  const hierarchy = summary.credit_loss_role_counts;

  return `# Associate-degree type analysis

**Generated:** ${summary.generated_at} from the local \`pmt_research\` database and the 115-school survey artifact.

## Recommendation

For an analysis of **credit loss or alignment between a college's own CS associate degree and UC transfer requirements**, use \`local_cs_as\` as the primary cohort. Keep \`ast\` as a separately reported standardized transfer benchmark. Do not pool \`local_computing\` into either cohort: it combines CIS, IT, networking, cybersecurity, business applications, programming, and a few other CS-named awards, and it has no defensible statewide curriculum template.

The cleanest controlled descriptive comparison available in these data is the **${summary.paired_local_cs_as_and_ast} schools with both a local CS A.S. and an A.S.-T**. Compare the two degree outcomes within those schools, then show the full ${summary.by_type.local_cs_as.schools}-school local-CS cohort as the main descriptive estimate and the full ${summary.by_type.ast.schools}-school A.S.-T cohort as a benchmark.

Do not build one pooled statewide estimate using a fallback such as local CS A.S. → A.S.-T → local computing. That changes the degree construct from school to school and makes the result difficult to interpret.

## Current analyzable records

${markdownTable(
    ['Degree category', 'Schools', 'Mean template coverage', 'Course linkage', 'Mean extraction confidence', 'Hand-verified'],
    typeRows,
  )}

The database contains **${summary.total_stored_records}** rows with \`status: found\`. After removing **${summary.duplicate_local_computing_records.length}** \`local_computing\` rows that repeat the same local CS A.S. title and exact course set, there are **${summary.total_distinct_records} distinct analyzable awards**. None is hand-verified yet. Course linkage is the share of resolved plus unresolved course references that link to canonical ASSIST course IDs. Template coverage is meaningful only for the two CS templates.

## Inventory versus analyzable coverage

The inventory and requirement-level datasets answer different questions:

- The survey finds a local CS A.S. at **${summary.inventory.local_cs_as_schools}** schools; all ${summary.by_type.local_cs_as.schools} have analyzable records.
- The survey finds a CS A.S.-T at **${summary.inventory.ast_schools}** schools; **${summary.by_type.ast.schools}** currently have analyzable records. The gaps are ${summary.missing_ast_records.map((row) => row.college_name).join(', ')}.
- The survey's non-disjoint \`local_computing_degrees\` list is nonempty at **${summary.inventory.local_computing_schools}** schools, but the database has only **${summary.by_type.local_computing.stored_records}** tagged rows. Of those, **${summary.by_type.local_computing.excluded_duplicate_records}** repeat a local CS A.S., leaving **${summary.by_type.local_computing.schools}** distinct representative local-computing records. The schema stores at most one row per school/type, so this is not an exhaustive program inventory.
- Woodland Community College is the one verified school with no CS-related associate degree and has no stored \`as_degree\` row.

## School mixes in the requirement-level data

${markdownTable(['Analyzable degree mix', 'Schools'], mixRows)}

These mixes remove the ${summary.duplicate_local_computing_records.length} duplicate tags. For credit-loss work, that becomes: **${hierarchy.primary_local_cs_as}** schools in the primary local-CS cohort, **${hierarchy.ast_benchmark_without_local_cs_as}** additional schools with only an A.S.-T benchmark (possibly plus local computing), **${hierarchy.descriptive_local_computing_only}** schools usable only for descriptive local-computing work, and **${hierarchy.no_degree}** school with no degree.

## Why the types should not be pooled

- **Local CS A.S.** is the construct closest to “complete the college's own CS degree.” Its template coverage averages **${summary.by_type.local_cs_as.template_coverage_mean_pct}%**, showing meaningful local variation—the variation a credit-loss analysis is meant to study.
- **A.S.-T** is highly standardized: mean template coverage is **${summary.by_type.ast.template_coverage_mean_pct}%**. It is designed around the statewide transfer curriculum and is therefore a useful contrast, but it is oriented to CSU transfer rather than specifically to UC requirements; UC credit loss should be measured rather than assumed to be low.
- **Local computing** has no statewide template. Even the most common mapped concepts vary widely, and some courses are absent from ASSIST because they are not transferable. Treat it as a family of programs that requires subtyping, not as a third interchangeable CS degree.

## Analysis rules I would use

1. Define the main estimand on \`local_cs_as\` only (${summary.by_type.local_cs_as.schools} schools).
2. Report \`ast\` separately (${summary.by_type.ast.schools} analyzable schools), explicitly labeling it a standardized transfer benchmark.
3. Use the ${summary.paired_local_cs_as_and_ast}-school paired subset as the strongest degree-type comparison.
4. Exclude \`local_computing\` from pooled CS estimates. If needed, first subtype it (CS/programming, CIS/business applications, IT/network/security, etc.) and analyze those strata separately.
5. Keep semester and quarter schools separate or convert units before aggregation. Five records use quarter units.
6. Hand-verify the paper's analytic subset. Current confidence is high, but 0/${summary.total_distinct_records} distinct records are marked verified and ${summary.total_records_with_unresolved_courses} records still contain at least one unresolved course reference.
7. Do not interpret the service's \`units_mismatch\` flag as missing degree data without review: GE and electives-to-total are often represented as blocks rather than enumerated courses.

## Outputs

- \`analysis/results/as_degree_types_by_school.csv\` — all 115 colleges, inventory presence, analyzable records, quality fields, and suggested analysis role.
- \`analysis/results/as_degree_type_summary.json\` — machine-readable aggregate results.
`;
}

async function main() {
  const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
  const mongoUri = process.env.MONGO_URI
    || process.env.TARGET_MONGO_URI
    || 'mongodb://127.0.0.1:27017';
  const dbName = process.env.DB_NAME || process.env.TARGET_DB_NAME || 'pmt_research';
  const client = await MongoClient.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });

  try {
    const db = client.db(dbName);
    const [docs, institutions, overview] = await Promise.all([
      db.collection('curated_requirements').find({ kind: 'as_degree' }).toArray(),
      db.collection('assist_institutions').find(
        { kind: 'community_college' },
        { projection: { source_id: 1, name: 1, district: 1, region: 1 } },
      ).toArray(),
      asDegreeOverview(db),
    ]);

    const institutionBySourceId = new Map(institutions.map((row) => [row.source_id, row]));
    const docBySchoolAndType = new Map(docs.map((doc) => [
      `${doc.community_college_id}:${doc.degree_type}`,
      doc,
    ]));
    const duplicateLocalComputingIds = findDuplicateLocalComputingIds(docs);
    const overviewById = new Map(overview.rows.map((row) => [row._id, row]));
    const schoolRows = [];

    for (const survey of inventory.survey) {
      const institution = institutionBySourceId.get(survey.community_college_id) || {};
      const storedTypes = DEGREE_TYPES.filter((type) => docBySchoolAndType.has(
        `${survey.community_college_id}:${type}`,
      ));
      const computingDoc = docBySchoolAndType.get(`${survey.community_college_id}:local_computing`);
      const computingIsDuplicate = !!computingDoc && duplicateLocalComputingIds.has(computingDoc._id);
      const distinctTypes = storedTypes.filter((type) => type !== 'local_computing' || !computingIsDuplicate);
      const gaps = [];
      if (survey.local_cs_as_exists && !storedTypes.includes('local_cs_as')) gaps.push('local_cs_as inventory only');
      if (survey.ast_cs_exists && !storedTypes.includes('ast')) gaps.push('ast inventory only');
      if ((survey.local_computing_degrees || []).length && !storedTypes.includes('local_computing')) {
        gaps.push('local_computing inventory only');
      }
      if (computingIsDuplicate) gaps.push('local_computing duplicates local_cs_as');
      const row = {
        community_college_id: survey.community_college_id,
        college_name: institution.name || survey.college_name,
        district: institution.district || '',
        region: institution.region || '',
        inventory_local_cs_as: survey.local_cs_as_exists,
        inventory_ast: survey.ast_cs_exists,
        inventory_local_computing_count: (survey.local_computing_degrees || []).length,
        inventory_local_computing_titles: (survey.local_computing_degrees || []).map(
          (degree) => `${degree.name}${degree.award ? ` (${degree.award})` : ''}`,
        ),
        stored_degree_mix: mixLabel(storedTypes),
        distinct_analyzable_degree_mix: mixLabel(distinctTypes),
        distinct_analyzable_degree_count: distinctTypes.length,
        analysis_role: schoolRole(distinctTypes),
        data_gap: gaps,
      };

      for (const type of DEGREE_TYPES) {
        const doc = docBySchoolAndType.get(`${survey.community_college_id}:${type}`);
        const summary = doc ? overviewById.get(doc._id) : null;
        const counts = doc ? countCourseReferences(doc) : { resolved: null, unresolved: null };
        row[`${type}_analyzable`] = !!doc;
        row[`${type}_degree_title`] = doc?.degree_title_seen || '';
        row[`${type}_catalog_year`] = doc?.catalog_year || '';
        row[`${type}_unit_system`] = doc?.unit_system || '';
        row[`${type}_total_units`] = doc?.total_units ?? '';
        row[`${type}_confidence`] = doc?.extraction?.confidence ?? '';
        row[`${type}_template_coverage_pct`] = summary?.coverage_pct ?? '';
        row[`${type}_resolved_course_refs`] = counts.resolved ?? '';
        row[`${type}_unresolved_course_refs`] = counts.unresolved ?? '';
        row[`${type}_verified`] = doc ? !!doc.verification?.verified : '';
        row[`${type}_flags`] = summary?.flags || [];
      }
      row.local_computing_duplicate_of_local_cs_as = computingIsDuplicate;
      schoolRows.push(row);
    }

    schoolRows.sort((a, b) => a.college_name.localeCompare(b.college_name));

    const schoolMixCounts = {};
    for (const row of schoolRows) {
      const mix = row.distinct_analyzable_degree_mix;
      schoolMixCounts[mix] = (schoolMixCounts[mix] || 0) + 1;
    }
    const byType = Object.fromEntries(DEGREE_TYPES.map((type) => [
      type,
      typeSummary(type, docs, overview.rows, inventory.survey.length, duplicateLocalComputingIds),
    ]));
    const missingAstRecords = schoolRows
      .filter((row) => row.inventory_ast && !row.ast_analyzable)
      .map((row) => ({ community_college_id: row.community_college_id, college_name: row.college_name }));
    const localAndAst = schoolRows.filter((row) => row.local_cs_as_analyzable && row.ast_analyzable).length;
    const primaryLocal = schoolRows.filter((row) => row.local_cs_as_analyzable).length;
    const astWithoutLocal = schoolRows.filter((row) => !row.local_cs_as_analyzable && row.ast_analyzable).length;
    const computingOnly = schoolRows.filter((row) => (
      !row.local_cs_as_analyzable && !row.ast_analyzable && row.local_computing_analyzable
    )).length;
    const noDegree = schoolRows.filter((row) => row.distinct_analyzable_degree_count === 0).length;
    const duplicateLocalComputingRecords = docs
      .filter((doc) => duplicateLocalComputingIds.has(doc._id))
      .map((doc) => ({
        community_college_id: doc.community_college_id,
        college_name: institutionBySourceId.get(doc.community_college_id)?.name || null,
        degree_title: doc.degree_title_seen,
      }))
      .sort((a, b) => String(a.college_name).localeCompare(String(b.college_name)));

    const summary = {
      generated_at: new Date().toISOString(),
      database: dbName,
      inventory_schools: inventory.survey.length,
      total_stored_records: docs.length,
      total_distinct_records: docs.length - duplicateLocalComputingIds.size,
      schools_with_analyzable_record: new Set(docs.map((doc) => doc.community_college_id)).size,
      inventory: {
        local_cs_as_schools: inventory.survey.filter((row) => row.local_cs_as_exists).length,
        ast_schools: inventory.survey.filter((row) => row.ast_cs_exists).length,
        local_computing_schools: inventory.survey.filter(
          (row) => (row.local_computing_degrees || []).length > 0,
        ).length,
      },
      by_type: byType,
      analyzable_school_mixes: schoolMixCounts,
      duplicate_local_computing_records: duplicateLocalComputingRecords,
      paired_local_cs_as_and_ast: localAndAst,
      credit_loss_role_counts: {
        primary_local_cs_as: primaryLocal,
        ast_benchmark_without_local_cs_as: astWithoutLocal,
        descriptive_local_computing_only: computingOnly,
        no_degree: noDegree,
      },
      missing_ast_records: missingAstRecords,
      records_with_inventory_only_local_computing: schoolRows.filter(
        (row) => row.data_gap.includes('local_computing inventory only'),
      ).map((row) => ({ community_college_id: row.community_college_id, college_name: row.college_name })),
      total_records_with_unresolved_courses: overview.rows.filter(
        (row) => row.unresolved_count > 0 && !duplicateLocalComputingIds.has(row._id),
      ).length,
      total_unresolved_course_references: byType.local_cs_as.unresolved_course_references
        + byType.ast.unresolved_course_references
        + byType.local_computing.unresolved_course_references,
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    writeCsv(schoolRows);
    fs.writeFileSync(SUMMARY_JSON, `${JSON.stringify(summary, null, 2)}\n`);
    fs.writeFileSync(SUMMARY_MD, buildMarkdown(summary));

    console.log(`Wrote ${path.relative(ROOT, SCHOOL_CSV)} (${schoolRows.length} schools)`);
    console.log(`Wrote ${path.relative(ROOT, SUMMARY_JSON)}`);
    console.log(`Wrote ${path.relative(ROOT, SUMMARY_MD)}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
