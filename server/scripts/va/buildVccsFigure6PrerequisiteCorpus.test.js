import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OUTPUT,
  DEFAULT_SCOPE,
  DEFAULT_SOURCE,
  DEFAULT_UNIVERSITY_SCOPE,
  buildVccsFigure6PrerequisiteCorpus,
} from './buildVccsFigure6PrerequisiteCorpus';
import {
  officialHostsForPrerequisiteScope,
  officialSourceEvidenceIssues,
  sha256,
} from '../../services/virginia/pathwayComplexityPrerequisites';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function build() {
  const sourceBytes = fs.readFileSync(DEFAULT_SOURCE);
  const scopeBytes = fs.readFileSync(DEFAULT_SCOPE);
  return buildVccsFigure6PrerequisiteCorpus({
    sourceArtifact: JSON.parse(sourceBytes),
    scope: JSON.parse(scopeBytes),
    universityScope: read(DEFAULT_UNIVERSITY_SCOPE),
    sourceArtifactSha256: sha256(sourceBytes),
    scopeSha256: sha256(scopeBytes),
  });
}

describe('VCCS Figure 6 prerequisite publication corpus', () => {
  it('builds the complete owner-scoped corpus with exact official evidence', () => {
    const artifact = build();
    expect(artifact).toMatchObject({
      schema_version: 1,
      artifact: 'virginia_figure6_prerequisite_corpus',
      contract_version: 'va-figure6-prerequisites-v2',
      corpus_role: 'community_college',
      counts: {
        rows: 189,
        required: 184,
        required_present: 184,
        parsed: 87,
        none: 97,
        missing: 0,
        unparsed: 0,
      },
    });
    expect(artifact.rows).toHaveLength(189);
    expect(new Set(artifact.rows.map((row) => row.owner_namespace)))
      .toEqual(new Set(['va:vccs']));
    expect(new Set(artifact.rows.map((row) => row.source_bundle_hash)))
      .toEqual(new Set([artifact.source_bundle_hash]));
    expect(officialSourceEvidenceIssues(artifact.rows, {
      role: 'community_college',
      officialHostsByOwner: officialHostsForPrerequisiteScope(read(DEFAULT_UNIVERSITY_SCOPE)),
      allowedOwners: ['va:vccs'],
    })).toEqual([]);
  });

  it('matches the checked-in deterministic publication candidate byte-for-byte', () => {
    const artifact = build();
    expect(fs.readFileSync(DEFAULT_OUTPUT, 'utf8'))
      .toBe(`${JSON.stringify(artifact, null, 2)}\n`);
  });

  it('refuses to emit a corpus after a required source row disappears', () => {
    const source = read(DEFAULT_SOURCE);
    source.rows = source.rows.filter((row) => row.code !== 'CSC222');
    expect(() => buildVccsFigure6PrerequisiteCorpus({
      sourceArtifact: source,
      scope: read(DEFAULT_SCOPE),
      universityScope: read(DEFAULT_UNIVERSITY_SCOPE),
    })).toThrow(/refusing incomplete VCCS Figure 6 corpus/);
  });

  it('fails closed when retained official evidence is mutated', () => {
    const source = read(DEFAULT_SOURCE);
    const row = source.rows.find((candidate) => candidate.code === 'CSC222');
    row.source_evidence.raw_text += ' mutation';
    expect(() => buildVccsFigure6PrerequisiteCorpus({
      sourceArtifact: source,
      scope: read(DEFAULT_SCOPE),
      universityScope: read(DEFAULT_UNIVERSITY_SCOPE),
    })).toThrow(/refusing invalid VCCS Figure 6 corpus/);
  });
});
