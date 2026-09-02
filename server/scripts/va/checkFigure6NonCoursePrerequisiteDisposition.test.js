import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  CANDIDATES_PATH,
  REVIEW_PATH,
  replayFigure6NonCoursePrerequisiteDisposition,
} = require('./checkFigure6NonCoursePrerequisiteDisposition');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));

describe('read-only Figure 6 non-course disposition replay', () => {
  it('replays six safe rows, one blocker, and all twelve retained signals', () => {
    expect(replayFigure6NonCoursePrerequisiteDisposition()).toEqual({
      ready: true,
      scoped_rows: 7,
      safe_rows: 6,
      blocked_rows: 1,
      retained_signals: 12,
      safe_course_keys: [
        'va:uni:9205:CL100',
        'va:uni:9205:CL150',
        'va:uni:9218:CS115',
        'va:uni:9218:OEAS110N',
        'va:uni:9218:OEAS111N',
        'va:uni:9218:OEAS126N',
      ],
      blocked_course_keys: ['va:uni:9218:OEAS106N'],
      issues: [],
    });
  });

  it('fails closed on a dropped signal or an apparent OEAS 106N promotion', () => {
    const candidatesArtifact = read(CANDIDATES_PATH);
    const reviewArtifact = read(REVIEW_PATH);

    const dropped = clone(reviewArtifact);
    dropped.review_rows.find((row) => row.course_key === 'va:uni:9218:CS115')
      .retained_non_prerequisite_signals.pop();
    expect(replayFigure6NonCoursePrerequisiteDisposition({
      candidatesArtifact, reviewArtifact: dropped,
    })).toMatchObject({ ready: false, issues: expect.arrayContaining([
      'va:uni:9218:CS115:row:retained_signal_projection',
    ]) });

    const promoted = clone(reviewArtifact);
    const oeas = promoted.review_rows.find((row) => (
      row.course_key === 'va:uni:9218:OEAS106N'
    ));
    oeas.status = 'none';
    oeas.review_status = 'promoted_structural_none';
    expect(replayFigure6NonCoursePrerequisiteDisposition({
      candidatesArtifact, reviewArtifact: promoted,
    })).toMatchObject({ ready: false, issues: expect.arrayContaining([
      'va:uni:9218:OEAS106N:row:blocked_row_projection',
    ]) });
  });
});
