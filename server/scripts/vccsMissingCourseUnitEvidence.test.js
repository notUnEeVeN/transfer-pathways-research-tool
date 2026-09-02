import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const registry = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'),
).institutions;
const artifactPath = path.join(ROOT, 'research', 'vccs-missing-course-units.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
const artifactHash = createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex');

const expected = {
  'rappahannock-community-college': {
    BIO141: 4, BIO142: 4, BIO150: 4, GOL111: 4, GOL112: 4,
    MAR101: 4, MAR102: 4, MAR201: 4, MAR202: 4,
  },
  'southwest-virginia-community-college': {
    ENG210: 3, ENG249: 3, ENG268: 3, ENG276: 3,
    MUS111: 4, MUS112: 4, PHI102: 3, PSY120: 3,
  },
  'virginia-peninsula-community-college': { REL238: 3 },
};

function documentFor(slug) {
  const institution = registry.find((row) => row.slug === slug);
  const extract = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'requirements', `${slug}.json`), 'utf8',
  ));
  const composition = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'composed', `${slug}.json`), 'utf8',
  ));
  const compiled = compileDegreeComposition(composition, {
    institutionLevel: institution.level,
  });
  const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
  return { composition, doc: toDocument(extract, institution, credits, composition) };
}

describe('supplemental official VCCS course-unit evidence', () => {
  it('pins every page and normalized excerpt to an auditable hash', () => {
    expect(artifact.entries).toHaveLength(18);
    expect(new Set(artifact.entries.map((row) => row.code)).size).toBe(18);
    for (const row of artifact.entries) {
      expect(row).toMatchObject({
        units: expect.any(Number),
        official_url: expect.stringMatching(/^https:\/\//),
        source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        source_excerpt_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      expect(createHash('sha256').update(row.source_excerpt).digest('hex')).toBe(
        row.source_excerpt_sha256,
      );
    }
  });

  it.each(Object.entries(expected))('%s imports only its cited exact course facts', (slug, facts) => {
    const { composition, doc } = documentFor(slug);
    expect(composition.course_unit_evidence_artifact).toMatchObject({
      path: 'research/vccs-missing-course-units.json',
      sha256: artifactHash,
      source_refs: ['course_catalog'],
    });
    const rows = new Map((doc.course_unit_evidence || []).map((row) => [row.code, row]));
    for (const [code, units] of Object.entries(facts)) {
      expect(rows.get(code)).toMatchObject({
        code,
        units,
        min_units: units,
        max_units: units,
        evidence: 'captured_official_course_detail',
        source_refs: ['course_catalog'],
        source_paths: [`research/vccs-missing-course-units.json#${code}`],
      });
      expect(rows.get(code).unit_sources[0]).toMatchObject({
        official_url: expect.stringMatching(/^https:\/\//),
        source_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
    }
  });

  it('does not inject evidence for courses absent from the currently verified core', () => {
    const newRiver = documentFor('new-river-community-college').doc;
    const rappahannock = documentFor('rappahannock-community-college').doc;
    expect((newRiver.course_unit_evidence || []).map((row) => row.code)).not.toContain('REL238');
    expect((rappahannock.course_unit_evidence || []).map((row) => row.code)).not.toContain('MUS111');
    // The official facts remain in the shared research artifact for a future
    // human-approved curriculum revision; they simply cannot cross the
    // operational overlay boundary ahead of that revision.
    expect(artifact.entries.map((row) => row.code)).toEqual(expect.arrayContaining([
      'REL238', 'MUS111',
    ]));
  });
});
