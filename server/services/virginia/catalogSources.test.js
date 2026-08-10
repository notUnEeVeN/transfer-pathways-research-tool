import { describe, expect, it } from 'vitest';
import {
  buildLayerCoverage,
  buildSourceRegistry,
  extractCatalogYear,
  isApprovedOfficialUrl,
} from './catalogSources';

const institution = {
  name: 'Example University',
  platform: 'courseleaf',
  catalog_root: 'https://catalog.example.edu/',
  seeds: [
    { role: 'program', url: 'https://catalog.example.edu/programs/cs-bs/' },
    { role: 'ge', url: 'https://catalog.example.edu/core/' },
    { role: 'graduation', url: 'https://catalog.example.edu/policies/' },
  ],
  degree_context: {
    layers: {
      major: { source_roles: ['program'] },
      general_education: { source_roles: ['program', 'ge'] },
      college: { status: 'not_applicable', note: 'No separate college layer.' },
      graduation: { source_roles: ['graduation'] },
    },
  },
};

const page = (role, path) => ({
  role,
  requested_url: `https://catalog.example.edu/${path}/`,
  final_url: `https://catalog.example.edu/${path}/`,
  status: 200,
  bytes_text: 2000,
  sha256: `${role}-hash`,
  has_content: true,
  has_requirements: role === 'program' ? true : null,
  file: `example__${role}`,
});

describe('Virginia catalog provenance', () => {
  it('normalizes catalog years without inventing one', () => {
    expect(extractCatalogYear('University Catalog 2026–2027 Edition')).toBe('2026-2027');
    expect(extractCatalogYear('Current academic catalog')).toBeNull();
  });

  it('accepts only registry-approved official hosts', () => {
    expect(isApprovedOfficialUrl(institution, 'https://catalog.example.edu/core/')).toBe(true);
    expect(isApprovedOfficialUrl(institution, 'https://example.com/copied-catalog')).toBe(false);
  });

  it('builds stable source IDs and leaves an uncaptured layer missing', () => {
    const sources = buildSourceRegistry(institution, {
      captured_at: '2026-08-09T00:00:00.000Z',
      pages: [page('program', 'programs/cs-bs'), page('ge', 'core')],
    });
    expect(sources.map((source) => source.id)).toEqual(['major', 'general_education']);
    expect(sources.every((source) => source.official && source.secure)).toBe(true);

    expect(buildLayerCoverage(institution, sources)).toEqual({
      major: { status: 'captured', source_refs: ['major'], note: null },
      general_education: { status: 'captured', source_refs: ['major', 'general_education'], note: null },
      college: { status: 'not_applicable', source_refs: [], note: 'No separate college layer.' },
      graduation: { status: 'missing', source_refs: [], note: null },
    });
  });
});
