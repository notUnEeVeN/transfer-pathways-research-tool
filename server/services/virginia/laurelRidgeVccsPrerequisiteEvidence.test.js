const fs = require('node:fs');
const { createHash } = require('node:crypto');
const {
  DEFAULT_EVIDENCE,
  DEFAULT_SCOPE,
  OWNER,
  loadLaurelRidgeVccsPrerequisiteEvidence,
} = require('./laurelRidgeVccsPrerequisiteEvidence');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const evidence = JSON.parse(fs.readFileSync(DEFAULT_EVIDENCE, 'utf8'));
const scope = JSON.parse(fs.readFileSync(DEFAULT_SCOPE, 'utf8'));

describe('Laurel Ridge VCCS canonical prerequisite-closure evidence', () => {
  it('proves both CSC 210 roots and the fixed-point owner mapping', () => {
    const loaded = loadLaurelRidgeVccsPrerequisiteEvidence();
    expect(loaded.report).toEqual({
      ready: true,
      exact_owner_entries: 4,
      accepted_exact_formulas: 3,
      explicit_none_findings: 0,
      unresolved_no_explicit_none: 1,
      accepted_codes: ['CSC200', 'CSC201', 'CSC202'],
      unresolved_codes: ['EGR126'],
      direct_dependency_roots: ['CSC201', 'CSC202'],
      recursive_dependency_courses: ['CSC200', 'EGR126'],
    });
    expect(loaded.dependencyProof).toMatchObject({
      code: 'CSC210',
      owner_coverage: [OWNER],
      prerequisite_codes: ['CSC201', 'CSC202', 'EGR125'],
      source_content_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(loaded.accepted.get('CSC201').groups[0].paths.map((formulaPath) => (
      formulaPath.all_of.map((condition) => condition.code)
    ))).toEqual([['CSC200'], ['EGR126']]);
    expect(loaded.accepted.get('CSC202').groups[0].paths[0].all_of[0])
      .toMatchObject({ type: 'course', code: 'CSC201' });
    expect(loaded.accepted.get('CSC200').groups[0]).toMatchObject({
      kind: 'prerequisite',
      paths: [{
        all_of: [expect.objectContaining({
          type: 'non_course', condition: 'course_eligibility', code: 'ENG111',
        })],
      }],
    });
    for (const row of loaded.accepted.values()) {
      expect(row).toMatchObject({
        source: 'official_owner_catalog_course_entry',
        authority_scope: 'owner_complete_for_canonical_dependency_scope',
        owner_coverage: [OWNER],
        required_by_owner_coverage: [OWNER],
      });
      expect(row.source_evidence.content_sha256)
        .toBe(sha256(row.source_evidence.raw_text));
    }
    expect(loaded.unresolved[0]).toMatchObject({
      code: 'EGR126',
      raw_requisites: null,
      accepted_explicit_none: false,
      disposition: 'unresolved_no_explicit_none_statement',
      required_by: ['CSC201'],
    });
  });

  it('fails closed if the canonical CSC 210 owner changes', () => {
    const changed = structuredClone(scope);
    changed.find((row) => row.code === 'CSC210').colleges.push('Tidewater Community College');
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: evidence,
      scopeRows: changed,
    })).toThrow(/owner scope must be exactly Laurel Ridge/);
  });

  it('fails closed if an entry or the pinned catalog receipt changes', () => {
    const changedEntry = structuredClone(evidence);
    changedEntry.rows[0].raw_entry_text += ' changed';
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: changedEntry,
      scopeRows: scope,
    })).toThrow(/entry hash mismatch/);

    const changedDocument = structuredClone(evidence);
    changedDocument.source_document.content_bytes += 1;
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: changedDocument,
      scopeRows: scope,
    })).toThrow(/catalog receipt mismatch/);
  });

  it('fails closed if connector order or dependency ownership changes', () => {
    const changedFormula = structuredClone(evidence);
    const csc201 = changedFormula.rows.find((row) => row.code === 'CSC201');
    csc201.raw_entry_text = csc201.raw_entry_text.replace(
      'CSC 200 or EGR 126',
      'CSC 200 and EGR 126',
    );
    csc201.raw_requisites = 'Prerequisite(s): CSC 200 and EGR 126.';
    csc201.raw_entry_sha256 = sha256(csc201.raw_entry_text);
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: changedFormula,
      scopeRows: scope,
    })).toThrow(/formula drifted/);

    const changedDependency = structuredClone(evidence);
    changedDependency.rows.find((row) => row.code === 'CSC202').required_by = ['CSC201'];
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: changedDependency,
      scopeRows: scope,
    })).toThrow(/dependency\/page receipt mismatch/);
  });

  it('never converts EGR 126 catalog silence into explicit none', () => {
    const changed = structuredClone(evidence);
    changed.rows.find((row) => row.code === 'EGR126').accepted_explicit_none = true;
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: changed,
      scopeRows: scope,
    })).toThrow(/may not infer no prerequisites/);
  });

  it('pins the retained CSC 210 source bytes, not just its parsed shape', () => {
    expect(() => loadLaurelRidgeVccsPrerequisiteEvidence({
      evidenceArtifact: evidence,
      scopeRows: scope,
      dependencySourceBody: '<html>same formula, different bytes</html>',
    })).toThrow(/master page hash mismatch/);
  });
});
