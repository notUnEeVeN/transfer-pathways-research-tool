const fs = require('node:fs');
const path = require('node:path');
const {
  loadAndValidate,
  validateConceptArtifact,
  validateRequisiteArtifact,
  validateScopeCoverage,
  validateArtifactAlignment,
  generationFor,
  rowsForImport,
} = require('./importVirginiaPrerequisites');

const REPO = path.resolve(__dirname, '..', '..');

describe('Virginia prerequisite import validation', () => {
  it('validates the checked-in source artifacts', () => {
    const result = loadAndValidate({
      conceptsFile: path.join(REPO, 'scripts/data/prereq_concepts.json'),
      courseArtifact: path.join(REPO, 'scripts/data/va_course_concepts.json'),
      requisiteArtifact: path.join(REPO, 'scripts/data/va_course_requisites.json'),
    });
    expect(result.concepts.meta.totals.direct_rows).toBe(335);
    expect(result.scopeCodes.has('CSC201')).toBe(true);
    expect(result.scopeCodes.has('CSC202')).toBe(true);
    expect(result.concepts.meta.legacy_scope_review).toMatchObject({
      population: 61,
      mapped: 22,
      examined_null: 39,
    });
    expect(result.requisites.meta.local_override_audit).toMatchObject({
      requisite_bearing_courses: expect.any(Number),
      checked_pages: expect.any(Number),
      differing_pages: expect.any(Number),
      failed_pages: expect.any(Number),
    });
    expect(result.requisites.meta.local_override_audit.requisite_bearing_courses).toBeGreaterThan(45);
    expect(result.requisites.meta.local_override_audit.checked_pages).toBeGreaterThan(892);
    expect(result.importGeneration).toMatch(/^[a-f0-9]{64}$/);

    const art = result.requisites.rows.find((row) => row.code === 'ART231');
    expect(art).toMatchObject({ title: 'Art Appreciation', status: 'missing', groups: [] });
    expect(art.flags).toEqual(expect.arrayContaining(['non_vccs', 'vccs_master_not_applicable']));
    const rel = result.concepts.rows.find((row) => row.code === 'REL210');
    expect(rel.flags).toContain('mixed_scope_identity_collision');
    expect(rel.institution_overrides).toEqual([expect.objectContaining({
      institution: 'Richard Bland College', title: 'Social History of Christianity', concept: null,
    })]);
    const sociology = result.concepts.rows.find((row) => row.code === 'SOC201');
    expect(sociology.institution_overrides).toEqual([expect.objectContaining({
      institution: 'Richard Bland College', title: 'General Sociology', concept: 'intro_sociology',
    })]);
    expect(result.concepts.rows.find((row) => row.code === 'COMM201')).toMatchObject({
      title_seen: 'Interpersonal Communication', concept: null,
    });
  });

  it('requires exact direct-scope sets and aligned companion rows', () => {
    const scope = JSON.parse(fs.readFileSync(path.join(REPO, 'server/.va-degrees/cs_course_scope.json')));
    const concepts = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_concepts.json')));
    const requisites = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_requisites.json')));

    const missingDirect = structuredClone(concepts);
    missingDirect.rows.find((row) => row.code === 'CSC201').scope_role = 'prerequisite_only';
    expect(() => validateScopeCoverage(scope, missingDirect, requisites))
      .toThrow(/concept artifact direct scope mismatch.*CSC201/);

    const drifted = structuredClone(requisites);
    drifted.rows.find((row) => row.code === 'CSC202').scope_source = 'wrong_source';
    expect(() => validateArtifactAlignment(concepts, drifted))
      .toThrow(/CSC202: concept\/requisite scope_source mismatch/);
  });

  it('derives and stamps one generation across both collections', () => {
    const concepts = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_concepts.json')));
    const requisites = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_requisites.json')));
    const generation = generationFor(concepts, requisites);
    expect(generationFor(concepts, requisites)).toBe(generation);
    const importedAt = new Date('2026-08-02T00:00:00.000Z');
    const conceptRow = rowsForImport([concepts.rows[0]], generation, importedAt)[0];
    const requisiteRow = rowsForImport([requisites.rows[0]], generation, importedAt)[0];
    expect(conceptRow.import_generation).toBe(generation);
    expect(requisiteRow.import_generation).toBe(generation);
    expect(conceptRow.imported_at).toBe(importedAt);
  });

  it('rejects duplicate concept identities', () => {
    const vocabulary = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/prereq_concepts.json')));
    const artifact = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_concepts.json')));
    artifact.rows.push({ ...artifact.rows[0] });
    expect(() => validateConceptArtifact(artifact, new Set(vocabulary.concepts.map((row) => row.slug))))
      .toThrow(/duplicate _id/);
  });

  it('rejects incompatible Virginia join keys and incomplete closure', () => {
    const badKey = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_requisites.json')));
    const condition = badKey.rows.flatMap((row) => row.groups)
      .flatMap((group) => group.paths)
      .flatMap((formulaPath) => formulaPath.all_of)
      .find((row) => row.type === 'course');
    condition.course_key = condition.course_ref;
    expect(() => validateRequisiteArtifact(badKey)).toThrow(/incompatible condition course_key/);

    const missingClosure = JSON.parse(fs.readFileSync(path.join(REPO, 'scripts/data/va_course_requisites.json')));
    const referenced = missingClosure.rows.flatMap((row) => row.groups)
      .flatMap((group) => group.paths)
      .flatMap((formulaPath) => formulaPath.all_of)
      .find((row) => row.type === 'course').code;
    missingClosure.rows = missingClosure.rows.filter((row) => row.code !== referenced);
    expect(() => validateRequisiteArtifact(missingClosure)).toThrow(/closure missing|totals.rows mismatch/);
  });
});
