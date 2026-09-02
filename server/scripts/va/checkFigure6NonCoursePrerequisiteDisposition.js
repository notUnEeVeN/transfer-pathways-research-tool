#!/usr/bin/env node
/**
 * Read-only replay of the finite Bridgewater/ODU non-course disposition.
 *
 * This opens only retained JSON artifacts. It performs no network, MongoDB, or
 * filesystem writes and is suitable for a mandatory checkRelease phase.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  BLOCKED_COURSE_KEYS,
  SAFE_COURSE_KEYS,
  TARGET_COURSE_KEYS,
  canonicalJson,
  figure6NonCourseDispositionResolutionRowIssues,
  resolveFigure6NonCoursePrerequisiteDisposition,
} = require('../../services/virginia/figure6NonCoursePrerequisiteDisposition');
const {
  buildOldDominionPrerequisiteMarkerControlFromCandidates,
} = require('../../services/virginia/oldDominionPrerequisiteClosureEvidence');

const SERVER = path.resolve(__dirname, '../..');
const RESEARCH = path.join(SERVER, '.va-catalogs', 'research');
const CANDIDATES_PATH = path.join(
  RESEARCH, 'va-university-prerequisite-candidates.json',
);
const REVIEW_PATH = path.join(RESEARCH, 'va-university-prerequisite-review.json');

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const asArray = (value) => Array.isArray(value) ? value : [];

function replayFigure6NonCoursePrerequisiteDisposition({
  candidatesArtifact = readJson(CANDIDATES_PATH),
  reviewArtifact = readJson(REVIEW_PATH),
} = {}) {
  const candidates = asArray(candidatesArtifact?.candidates);
  const reviewRows = asArray(reviewArtifact?.review_rows);
  const control = buildOldDominionPrerequisiteMarkerControlFromCandidates(candidates);
  const issues = [];
  if (control.verified !== true || asArray(control.issues).length) {
    issues.push(...asArray(control.issues).map((issue) => `odu_control:${issue}`));
  }
  const resolutions = {};
  let retainedSignalCount = 0;
  for (const courseKey of TARGET_COURSE_KEYS) {
    const matchingCandidates = candidates.filter((row) => row?.course_key === courseKey);
    const matchingRows = reviewRows.filter((row) => row?.course_key === courseKey);
    if (matchingCandidates.length !== 1) issues.push(`${courseKey}:candidate_count`);
    if (matchingRows.length !== 1) issues.push(`${courseKey}:review_row_count`);
    const result = resolveFigure6NonCoursePrerequisiteDisposition(
      matchingCandidates[0], { oldDominionMarkerControl: control },
    );
    resolutions[courseKey] = result;
    retainedSignalCount += asArray(result.retained_non_prerequisite_signals).length;
    if (result.applicable !== true || asArray(result.issues).length) {
      issues.push(`${courseKey}:resolution`);
    }
    const row = matchingRows[0];
    for (const issue of figure6NonCourseDispositionResolutionRowIssues(row)) {
      issues.push(`${courseKey}:row:${issue}`);
    }
    if (SAFE_COURSE_KEYS.includes(courseKey)) {
      if (result.ready !== true || result.status !== 'none'
          || canonicalJson(row?.structural_none_evidence)
            !== canonicalJson(result.structural_none_evidence)) {
        issues.push(`${courseKey}:safe_projection`);
      }
    } else if (result.ready !== false
        || canonicalJson(row?.figure6_noncourse_prerequisite_disposition_audit)
          !== canonicalJson(result)) issues.push(`${courseKey}:blocked_projection`);
  }
  const safeKeys = TARGET_COURSE_KEYS.filter((key) => resolutions[key]?.ready === true);
  const blockedKeys = TARGET_COURSE_KEYS.filter((key) => resolutions[key]?.ready === false
    && asArray(resolutions[key]?.issues).length === 0);
  if (canonicalJson(safeKeys) !== canonicalJson(SAFE_COURSE_KEYS)) {
    issues.push('safe_inventory');
  }
  if (canonicalJson(blockedKeys) !== canonicalJson(BLOCKED_COURSE_KEYS)) {
    issues.push('blocked_inventory');
  }
  return {
    ready: issues.length === 0,
    scoped_rows: TARGET_COURSE_KEYS.length,
    safe_rows: safeKeys.length,
    blocked_rows: blockedKeys.length,
    retained_signals: retainedSignalCount,
    safe_course_keys: safeKeys,
    blocked_course_keys: blockedKeys,
    issues: [...new Set(issues)].sort(),
  };
}

function main() {
  const report = replayFigure6NonCoursePrerequisiteDisposition();
  if (!report.ready) {
    console.error('Virginia Figure 6 exact non-course disposition: BLOCKED');
    for (const issue of report.issues) console.error(`  ${issue}`);
    process.exitCode = 1;
    return;
  }
  console.log('Virginia Figure 6 exact non-course disposition: READY');
  console.log(`  scoped ${report.scoped_rows}; safe ${report.safe_rows}; blocked ${report.blocked_rows}`);
  console.log(`  retained signals ${report.retained_signals}`);
  console.log(`  fail-closed row ${report.blocked_course_keys.join(', ')}`);
}

if (require.main === module) main();

module.exports = {
  CANDIDATES_PATH,
  REVIEW_PATH,
  replayFigure6NonCoursePrerequisiteDisposition,
};
