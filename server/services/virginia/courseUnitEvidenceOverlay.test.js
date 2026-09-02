import { describe, expect, it } from 'vitest';
import {
  buildCourseUnitEvidenceOverlay,
  referencedCourseCodes,
} from './courseUnitEvidenceOverlay';
import {
  institutionCourseIdentity,
  sharedCourseIdentity,
} from './courseIdentity';
import { majorCoreHash } from './majorCoreIntegrity';

const evidence = (code, units, sourceRefs = ['major'], namespace = null) => ({
  ...(namespace
    ? institutionCourseIdentity(namespace.institution_id, code)
    : sharedCourseIdentity(code)),
  units,
  min_units: units,
  max_units: units,
  source_refs: sourceRefs,
  source_paths: [`catalog#${code}`],
  evidence: 'captured_official_course_detail',
  unit_sources: [],
});

function sourceDoc({
  id = 'va:as:fixture:cs',
  code = 'CSC221',
  units = 3,
  unitEvidence,
  namespace = null,
  sources = [{ id: 'major', url: 'https://example.edu/major' }],
} = {}) {
  const identity = namespace
    ? institutionCourseIdentity(namespace.institution_id, code)
    : sharedCourseIdentity(code);
  return {
    _id: id,
    kind: 'as_degree',
    community_college_id: id.replace(/^va:as:/, 'va:cc:').replace(/:cs$/, ''),
    college_id: id.replace(/^va:as:/, 'va:cc:').replace(/:cs$/, ''),
    degree_title_seen: 'Computer Science, A.S.',
    total_units: 60,
    total_units_max: 61,
    unit_system: 'semester',
    ...(namespace ? { course_namespace: namespace } : {}),
    sources,
    requirement_groups: [{
      title: 'Programming',
      group_conjunction: 'And',
      source_refs: ['major'],
      sections: [{
        section_advisement: 1,
        unit_advisement: units,
        source_refs: ['major'],
        receivers: [{
          code_seen: code,
          options_conjunction: 'or',
          options: [{
            course_keys: [identity.course_key],
            course_ids: [identity.course_id],
            course_conjunction: 'and',
          }],
        }],
      }],
    }],
    ...(unitEvidence === undefined ? {} : { course_unit_evidence: unitEvidence }),
    verification: { verified: true, verified_by: 'researcher' },
  };
}

describe('Virginia operational course-unit evidence overlay', () => {
  it('copies exact evidence while ignoring all substantive candidate-core differences', () => {
    const current = sourceDoc();
    const candidate = structuredClone(current);
    candidate.total_units = 999;
    candidate.total_units_max = 1001;
    candidate.requirement_groups = [{
      title: 'Candidate curriculum must not cross the boundary',
      sections: [],
    }];
    candidate.course_unit_evidence = [evidence('CSC221', 3)];
    const currentBefore = structuredClone(current);
    const candidateBefore = structuredClone(candidate);

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current],
      candidateDocuments: [candidate],
    });

    expect(result.ready).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]).toMatchObject({
      total_units: 60,
      total_units_max: 61,
      requirement_groups: current.requirement_groups,
      course_unit_evidence: [evidence('CSC221', 3)],
    });
    expect(majorCoreHash(result.documents[0])).toBe(majorCoreHash(current));
    expect(result.receipts[0]).toMatchObject({
      status: 'applied',
      overlay_applied: true,
      candidate_core_matches_current: false,
      proposed_major_core_unchanged: true,
      output_major_core_unchanged: true,
      candidate_evidence_rows: 1,
      validated_evidence_rows: 1,
      applied_evidence_rows: 1,
      validated_codes: ['CSC221'],
      applied_codes: ['CSC221'],
    });
    expect(result.receipts[0].receipt_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.report_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(current).toEqual(currentBefore);
    expect(candidate).toEqual(candidateBefore);
    expect(result.documents[0]).not.toBe(current);
    expect(result.documents[0].course_unit_evidence[0]).not.toBe(candidate.course_unit_evidence[0]);
  });

  it('accepts evidence for a course in a preserved requirement-variant tree', () => {
    const current = sourceDoc();
    const alternate = sharedCourseIdentity('CSC222');
    current.requirement_variants = [{
      key: 'alternate',
      selected: false,
      requirement_groups: [{ sections: [{ receivers: [{ options: [{
        course_keys: [alternate.course_key],
        course_ids: [alternate.course_id],
      }] }] }] }],
    }];
    const candidate = structuredClone(current);
    candidate.course_unit_evidence = [evidence('CSC222', 4)];

    expect(referencedCourseCodes(current)).toEqual(['CSC221', 'CSC222']);
    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });
    expect(result.ready).toBe(true);
    expect(result.documents[0].course_unit_evidence).toEqual([evidence('CSC222', 4)]);
  });

  it('rejects evidence for a code introduced only by the candidate tree', () => {
    const current = sourceDoc();
    const candidate = sourceDoc({ code: 'CSC222', units: 4 });
    candidate._id = current._id;
    candidate.community_college_id = current.community_college_id;
    candidate.college_id = current.college_id;
    candidate.course_unit_evidence = [evidence('CSC222', 4)];

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });

    expect(result.ready).toBe(false);
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      document_id: current._id,
      path: 'candidate.course_unit_evidence[0].code',
      code: 'course_not_referenced_by_current_requirement_tree',
    }));
    expect(result.documents).toEqual([current]);
    expect(result.receipts[0]).toMatchObject({
      status: 'conflict', overlay_applied: false, applied_evidence_rows: 0,
    });
  });

  it('resolves candidate source refs only against the current source registry', () => {
    const current = sourceDoc();
    const candidate = structuredClone(current);
    candidate.sources.push({ id: 'candidate_only', url: 'https://example.edu/course' });
    candidate.course_unit_evidence = [evidence('CSC221', 3, ['candidate_only'])];

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });

    expect(result.ready).toBe(false);
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      code: 'candidate_source_refs_not_in_current_sources',
      detail: { source_refs: ['candidate_only'] },
    }));
    expect(result.documents).toEqual([current]);
  });

  it('fails closed when current and candidate evidence disagree on units', () => {
    const current = sourceDoc({ unitEvidence: [evidence('CSC221', 4)] });
    const candidate = structuredClone(current);
    candidate.course_unit_evidence = [evidence('CSC221', 3)];

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });

    expect(result.ready).toBe(false);
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      code: 'current_candidate_course_units_conflict',
      detail: expect.objectContaining({
        code: 'CSC221', current_units: [4], candidate_units: 3,
      }),
    }));
    expect(result.documents).toEqual([current]);
    expect(majorCoreHash(result.documents[0])).toBe(majorCoreHash(current));
  });

  it.each([
    ['zero', { units: 0, min_units: 0, max_units: 0 }],
    ['range', { units: 3, min_units: 3, max_units: 4 }],
    ['missing maximum', { units: 3, min_units: 3, max_units: undefined }],
  ])('rejects %s candidate unit evidence', (_label, unitPatch) => {
    const current = sourceDoc();
    const candidate = structuredClone(current);
    candidate.course_unit_evidence = [{ ...evidence('CSC221', 3), ...unitPatch }];

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });
    expect(result.ready).toBe(false);
    expect(result.conflicts.map((entry) => entry.code))
      .toContain('candidate_units_must_be_exact_and_positive');
    expect(result.documents).toEqual([current]);
  });

  it('requires an exact namespace match before considering evidence', () => {
    const namespace = {
      kind: 'institution_local',
      institution_id: 'va:cc:fixture',
      vccs_master_applicable: false,
      identity_contract: 'owner_plus_course_id',
      scoped_key_format: 'va:cc:fixture:<code>',
      source_refs: ['major'],
    };
    const current = sourceDoc({ namespace });
    const candidate = structuredClone(current);
    candidate.course_namespace = null;
    candidate.course_unit_evidence = [evidence('CSC221', 3)];

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [current], candidateDocuments: [candidate],
    });
    expect(result.ready).toBe(false);
    expect(result.conflicts).toContainEqual(expect.objectContaining({
      path: 'candidate.course_namespace', code: 'course_namespace_mismatch',
    }));
    expect(result.documents).toEqual([current]);
  });

  it('is globally atomic and deterministic across input ordering', () => {
    const currentA = sourceDoc({ id: 'va:as:a:cs', code: 'CSC221' });
    const currentB = sourceDoc({ id: 'va:as:b:cs', code: 'CSC222', units: 4 });
    const candidateA = structuredClone(currentA);
    const candidateB = structuredClone(currentB);
    candidateA.course_unit_evidence = [evidence('CSC221', 3)];
    candidateB.course_unit_evidence = [evidence('CSC999', 3)];

    const first = buildCourseUnitEvidenceOverlay({
      currentDocuments: [currentB, currentA],
      candidateDocuments: [candidateA, candidateB],
    });
    const second = buildCourseUnitEvidenceOverlay({
      currentDocuments: [currentA, currentB],
      candidateDocuments: [candidateB, candidateA],
    });

    expect(first).toEqual(second);
    expect(first.ready).toBe(false);
    expect(first.documents).toEqual([currentA, currentB]);
    expect(first.receipts.find((row) => row.document_id === currentA._id)).toMatchObject({
      status: 'withheld_due_to_report_conflicts',
      validated_evidence_rows: 1,
      applied_evidence_rows: 0,
      output_major_core_unchanged: true,
    });
    expect(first.counts.applied_evidence_rows).toBe(0);
  });

  it('does not drop malformed or duplicate current rows when preflight fails', () => {
    const current = sourceDoc();
    const duplicate = structuredClone(current);
    duplicate.total_units = 62;
    const missingId = sourceDoc();
    delete missingId._id;

    const result = buildCourseUnitEvidenceOverlay({
      currentDocuments: [duplicate, missingId, current],
      candidateDocuments: [structuredClone(current)],
    });

    expect(result.ready).toBe(false);
    expect(result.documents).toHaveLength(3);
    expect(result.documents).toEqual(expect.arrayContaining([current, duplicate, missingId]));
    expect(result.documents[0]).not.toBe(missingId);
    expect(result.conflicts.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'document_id_required', 'duplicate_current_document',
    ]));
  });
});
