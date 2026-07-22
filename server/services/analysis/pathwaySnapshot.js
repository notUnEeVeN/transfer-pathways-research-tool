const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_METHOD_ID = 'joint_major_preparation_v2';
const DEFAULT_SNAPSHOT_PATH = path.resolve(
  __dirname,
  '../../data/analysis/multi-campus-pathways.v1.json',
);

const COMBINED_FIELDS = Object.freeze([
  'distinct_courses',
  'major_course_count',
  'prerequisite_course_count',
  'major_native_units',
  'native_units',
  'semester_equiv_units',
  'estimated_terms',
  'min_terms',
  'lower_bound_terms',
  'upper_bound_terms',
  'unit_lower_bound_terms',
  'sequence_lower_bound_terms',
  'academic_years',
  'optionality_premium_courses',
  'optionality_premium_direct_courses',
  'optionality_premium_units',
  'optionality_premium_terms',
  'product_complete',
  'strict_complete',
  'prerequisite_complete',
]);
const ROW_FIELDS = Object.freeze([
  'status',
  'plan_status',
  'prerequisite_status',
  'schedule_status',
  'warning_indices',
  'strict_complete_mask',
  ...COMBINED_FIELDS.map((field) => `combined.${field}`),
]);

function loadProfileKey(semesterLoad, quarterLoad) {
  const token = (value) => String(Number(value)).replace('.', '_');
  return `s${token(semesterLoad)}-q${token(quarterLoad)}`;
}

function maskForSchoolIds(campuses, schoolIds) {
  const selected = new Set(schoolIds.map(Number));
  let mask = 0;
  campuses.forEach((campus, index) => {
    if (selected.has(Number(campus.school_id))) mask |= (1 << index);
  });
  return mask >>> 0;
}

function schoolIdsForMask(campuses, mask) {
  return campuses
    .filter((_, index) => mask & (1 << index))
    .map((campus) => Number(campus.school_id));
}

function compactCombined(combined = {}) {
  return Object.fromEntries(COMBINED_FIELDS.map((field) => [field, combined[field] ?? null]));
}

function compactMultiCampusCombination(data, { campuses, colleges }) {
  const schoolIds = (data?.params?.school_ids || []).map(Number).sort((a, b) => a - b);
  const mask = maskForSchoolIds(campuses, schoolIds);
  const expectedRows = new Map((data?.rows || []).map((row) => [
    Number(row.community_college_id), row,
  ]));
  const rows = colleges.map((college) => {
    const row = expectedRows.get(Number(college.community_college_id));
    if (!row) throw new Error(`Combination ${mask} has no row for college ${college.community_college_id}.`);
    const strictSchoolIds = (row.campuses || [])
      .filter((campus) => campus.strict_complete === true || campus.fully_satisfiable === true)
      .map((campus) => Number(campus.school_id));
    return {
      status: row.status || 'unavailable',
      plan_status: row.plan_status || 'unavailable',
      prerequisite_status: row.prerequisite_status || 'complete',
      schedule_status: row.schedule_status || 'unavailable',
      warnings: (row.warnings || []).map(String),
      strict_complete_mask: maskForSchoolIds(campuses, strictSchoolIds),
      combined: compactCombined(row.combined),
    };
  });
  return {
    mask,
    school_ids: schoolIds,
    summary: data.summary || {},
    calendar_groups: data.calendar_groups || [],
    rows,
    method: data.method || null,
    global_warnings: (data.warnings || []).map(String),
  };
}

function buildMultiCampusSnapshot({
  context,
  combinations,
  semesterLoad = 15,
  quarterLoad = 15,
  generatedAt = new Date().toISOString(),
}) {
  const campuses = context.targets.map((target) => ({
    school_id: Number(target.school_id),
    school: target.school,
    major: target.major,
    program: target.program || target.major,
  })).sort((left, right) => left.school_id - right.school_id);
  const colleges = context.colleges.map((college) => ({
    community_college_id: Number(college.source_id),
    community_college: college.name,
    unit_system: context.calendarForCollege
      ? context.calendarForCollege(Number(college.source_id))
      : null,
    calendar_source: 'PMT reviewed college calendar file, 2026-06-08',
  }));
  const entries = combinations instanceof Map
    ? [...combinations.entries()]
    : Object.entries(combinations || {}).map(([mask, value]) => [Number(mask), value]);
  entries.sort(([left], [right]) => Number(left) - Number(right));
  const warningSet = new Set();
  for (const [, combination] of entries) {
    for (const warning of combination.global_warnings || []) warningSet.add(String(warning));
    for (const row of combination.rows || []) {
      for (const warning of row.warnings || []) warningSet.add(String(warning));
    }
  }
  const warnings = [...warningSet].sort();
  const warningIndex = new Map(warnings.map((warning, index) => [warning, index]));
  const packedCombinations = {};
  for (const [rawMask, combination] of entries) {
    const mask = Number(rawMask);
    packedCombinations[String(mask)] = {
      school_ids: combination.school_ids.map(Number),
      summary: combination.summary,
      calendar_groups: combination.calendar_groups,
      rows: combination.rows.map((row) => [
        row.status,
        row.plan_status,
        row.prerequisite_status,
        row.schedule_status,
        (row.warnings || []).map((warning) => warningIndex.get(String(warning))),
        Number(row.strict_complete_mask) >>> 0,
        ...COMBINED_FIELDS.map((field) => row.combined?.[field] ?? null),
      ]),
    };
  }
  const first = entries[0]?.[1] || {};
  const profile = loadProfileKey(semesterLoad, quarterLoad);
  const snapshot = {
    schema_version: SNAPSHOT_SCHEMA_VERSION,
    method_id: SNAPSHOT_METHOD_ID,
    generated_at: generatedAt,
    source_fingerprint: context.sourceFingerprint,
    default_load_profile: profile,
    method: first.method || { id: SNAPSHOT_METHOD_ID },
    row_fields: ROW_FIELDS,
    warnings,
    global_warning_indices: (first.global_warnings || [])
      .map((warning) => warningIndex.get(String(warning))),
    campuses,
    colleges,
    load_profiles: {
      [profile]: {
        semester_load: Number(semesterLoad),
        quarter_load: Number(quarterLoad),
        combinations: packedCombinations,
      },
    },
  };
  snapshot.artifact_fingerprint = createHash('sha256')
    .update(JSON.stringify(snapshot))
    .digest('hex');
  validateMultiCampusSnapshot(snapshot);
  return snapshot;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid multi-campus snapshot: ${message}`);
}

function validateMultiCampusSnapshot(snapshot) {
  assert(snapshot && typeof snapshot === 'object', 'root must be an object');
  assert(snapshot.schema_version === SNAPSHOT_SCHEMA_VERSION, 'unsupported schema_version');
  assert(snapshot.method_id === SNAPSHOT_METHOD_ID, 'method_id does not match this reader');
  assert(!Number.isNaN(Date.parse(snapshot.generated_at)), 'generated_at must be an ISO date');
  assert(typeof snapshot.source_fingerprint === 'string'
    && /^[a-f0-9]{64}$/.test(snapshot.source_fingerprint), 'source_fingerprint must be sha256');
  assert(typeof snapshot.artifact_fingerprint === 'string'
    && /^[a-f0-9]{64}$/.test(snapshot.artifact_fingerprint),
  'artifact_fingerprint must be sha256');
  const campuses = snapshot.campuses;
  assert(Array.isArray(campuses) && campuses.length >= 1 && campuses.length <= 9,
    'campuses must contain one to nine entries');
  const campusIds = campuses.map((campus) => Number(campus.school_id));
  assert(new Set(campusIds).size === campusIds.length, 'campus ids must be unique');
  assert(campusIds.every((id, index) => index === 0 || campusIds[index - 1] < id),
    'campuses must be ordered by school_id');
  const colleges = snapshot.colleges;
  assert(Array.isArray(colleges) && colleges.length > 0, 'colleges must be nonempty');
  const collegeIds = colleges.map((college) => Number(college.community_college_id));
  assert(new Set(collegeIds).size === collegeIds.length, 'college ids must be unique');
  assert(colleges.every((college) => ['semester', 'quarter', 'unknown'].includes(college.unit_system)),
    'every college must have a recognized unit_system');
  assert(Array.isArray(snapshot.warnings), 'warnings must be an array');
  assert(JSON.stringify(snapshot.row_fields) === JSON.stringify(ROW_FIELDS),
    'row_fields do not match schema version 1');
  assert(snapshot.load_profiles && typeof snapshot.load_profiles === 'object',
    'load_profiles must be an object');
  const profile = snapshot.load_profiles[snapshot.default_load_profile];
  assert(profile, 'default_load_profile is missing');
  assert(Number.isFinite(profile.semester_load) && Number.isFinite(profile.quarter_load),
    'profile loads must be finite');
  const combinations = profile.combinations;
  assert(combinations && typeof combinations === 'object', 'profile combinations must be an object');
  const expectedCount = (1 << campuses.length) - 1;
  assert(Object.keys(combinations).length === expectedCount,
    `expected ${expectedCount} nonempty combinations`);
  for (let mask = 1; mask <= expectedCount; mask += 1) {
    const combination = combinations[String(mask)];
    assert(combination, `combination ${mask} is missing`);
    const expectedSchoolIds = schoolIdsForMask(campuses, mask);
    assert(JSON.stringify(combination.school_ids) === JSON.stringify(expectedSchoolIds),
      `combination ${mask} school_ids do not match its mask`);
    assert(Array.isArray(combination.rows) && combination.rows.length === colleges.length,
      `combination ${mask} rows must align with colleges`);
    for (const [rowIndex, row] of combination.rows.entries()) {
      assert(Array.isArray(row) && row.length === ROW_FIELDS.length,
        `combination ${mask} row ${rowIndex} must match row_fields`);
      const warningIndices = row[ROW_FIELDS.indexOf('warning_indices')];
      const strictCompleteMask = row[ROW_FIELDS.indexOf('strict_complete_mask')];
      assert(Array.isArray(warningIndices),
        `combination ${mask} row ${rowIndex} warning_indices must be an array`);
      assert(warningIndices.every((index) => Number.isInteger(index)
        && index >= 0 && index < snapshot.warnings.length),
      `combination ${mask} row ${rowIndex} has an invalid warning index`);
      assert(Number.isInteger(strictCompleteMask)
        && (strictCompleteMask & ~mask) === 0,
      `combination ${mask} row ${rowIndex} has an invalid strict_complete_mask`);
    }
  }
  const { artifact_fingerprint: installedFingerprint, ...fingerprinted } = snapshot;
  const expectedFingerprint = createHash('sha256')
    .update(JSON.stringify(fingerprinted))
    .digest('hex');
  assert(installedFingerprint === expectedFingerprint, 'artifact_fingerprint does not match content');
  return snapshot;
}

let loadedSnapshot = null;
let loadedSnapshotPath = null;
let loadedSnapshotStat = null;

async function loadMultiCampusSnapshot(filePath = process.env.MULTI_CAMPUS_SNAPSHOT_PATH
  || DEFAULT_SNAPSHOT_PATH) {
  const resolved = path.resolve(filePath);
  const stat = await fs.promises.stat(resolved);
  const signature = `${stat.ino}|${stat.size}|${stat.mtimeMs}`;
  if (loadedSnapshot && loadedSnapshotPath === resolved && loadedSnapshotStat === signature) {
    return loadedSnapshot;
  }
  const raw = await fs.promises.readFile(resolved, 'utf8');
  const parsed = JSON.parse(raw);
  validateMultiCampusSnapshot(parsed);
  loadedSnapshot = parsed;
  loadedSnapshotPath = resolved;
  loadedSnapshotStat = signature;
  return parsed;
}

function clearMultiCampusSnapshotCache() {
  loadedSnapshot = null;
  loadedSnapshotPath = null;
  loadedSnapshotStat = null;
}

module.exports = {
  COMBINED_FIELDS,
  DEFAULT_SNAPSHOT_PATH,
  SNAPSHOT_METHOD_ID,
  SNAPSHOT_SCHEMA_VERSION,
  ROW_FIELDS,
  buildMultiCampusSnapshot,
  clearMultiCampusSnapshotCache,
  compactMultiCampusCombination,
  loadMultiCampusSnapshot,
  loadProfileKey,
  maskForSchoolIds,
  schoolIdsForMask,
  validateMultiCampusSnapshot,
};
