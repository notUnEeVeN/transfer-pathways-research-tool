import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildSnapshot,
} = require('./buildVaDocuments');
const {
  buildPrerequisiteSnapshot,
} = require('./publishFigure6Prerequisites');
const {
  auditLiveRollbackInventory,
  optionsFrom,
} = require('./auditLiveRollbackInventory');

function fakeDb(initial = {}) {
  return {
    collection(name) {
      const rows = initial[name] || [];
      return {
        find(filter = {}) {
          const filtered = rows.filter((row) => Object.entries(filter)
            .every(([key, value]) => row?.[key] === value));
          return {
            sort() { return this; },
            async toArray() { return structuredClone(filtered); },
          };
        },
      };
    },
  };
}

describe('live Virginia rollback inventory', () => {
  it('distinguishes exact release snapshots from the degree-only legacy backup', async () => {
    const requirements = Array.from({ length: 35 }, (_, index) => ({
      _id: `degree-${index}`,
      state: 'va',
      kind: index < 19 ? 'as_degree' : 'degree',
    }));
    const projection = buildSnapshot({
      generationId: 'projection-generation',
      documentsByCollection: {
        assist_institutions: [{ _id: 'institution', state: 'va' }],
        assist_courses: [{ _id: 'course', state: 'va' }],
        assist_agreements: [{ _id: 'agreement', state: 'va' }],
        curated_requirements: requirements,
      },
    });
    const prerequisites = buildPrerequisiteSnapshot({
      generationId: 'prerequisite-generation',
      documentsByCollection: {
        va_course_requisites: [{ _id: 'vccs-row' }],
        va_university_course_requisites: [{ _id: 'university-row' }],
        va_figure6_prerequisite_publications: [{ _id: 'receipt' }],
      },
    });
    const report = await auditLiveRollbackInventory({
      db: fakeDb({
        va_projection_revisions: [projection.manifest],
        va_projection_revision_documents: projection.payload,
        va_figure6_prerequisite_revisions: [prerequisites.manifest],
        va_figure6_prerequisite_revision_documents: prerequisites.payload,
        va_schema_backup: [{
          _id: 'legacy',
          as_degree: requirements.slice(0, 19),
          degree: requirements.slice(19),
        }],
        curated_requirements: requirements,
      }),
      dbName: 'test',
    });

    expect(report).toMatchObject({
      read_only: true,
      full_release_target_snapshot_available: true,
      current_visual_authority_possible: false,
      projection: { valid_generation_count: 1, restore_available: true },
      prerequisites: { valid_generation_count: 1, restore_available: true },
      transition_authority: { valid: false, issue: 'publication_transition_ledger_missing' },
      legacy_degree_backup: {
        valid_degree_only_generation_count: 1,
        complete_release_rollback: false,
      },
    });
    expect(report.legacy_degree_backup.uncovered_projection_targets)
      .toEqual(['assist_institutions', 'assist_courses', 'assist_agreements']);
  });

  it('reports an empty live inventory without promoting the legacy backup', async () => {
    const report = await auditLiveRollbackInventory({ db: fakeDb(), dbName: 'empty' });
    expect(report.full_release_target_snapshot_available).toBe(false);
    expect(report.projection.restore_available).toBe(false);
    expect(report.prerequisites.restore_available).toBe(false);
    expect(report.legacy_degree_backup.complete_release_rollback).toBe(false);
  });

  it('requires explicit CLI flags', () => {
    expect(optionsFrom(['--json', '--require-full']))
      .toEqual({ json: true, requireFull: true });
    expect(() => optionsFrom(['--apply'])).toThrow(/unknown option/);
  });
});
