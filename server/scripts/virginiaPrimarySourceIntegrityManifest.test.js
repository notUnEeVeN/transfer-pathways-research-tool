import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const MANIFEST_PATH = path.join(ROOT, 'research', 'primary-source-integrity-manifest.json');
const registryDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const communitySlugs = registryDoc.institutions
  .filter((row) => row.level === 'community_college')
  .map((row) => row.slug);
const publicSlugs = registryDoc.cohorts.schev_public_four_year.institution_slugs;
const primarySlugs = [...communitySlugs, ...publicSlugs];
const HASH = /^[a-f0-9]{64}$/;
const keyOf = (row) => `${row.institution}/${row.source_id}`;
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const requirementFor = (slug) => JSON.parse(fs.readFileSync(
  path.join(ROOT, 'requirements', `${slug}.json`), 'utf8',
));

function collectSourceRefs(value, out = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((child) => collectSourceRefs(child, out));
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    if (key === 'sources') continue;
    if (key === 'source_ref' && typeof child === 'string') out.add(child);
    else if (key === 'source_refs' && Array.isArray(child)) {
      child.filter((item) => typeof item === 'string').forEach((item) => out.add(item));
    } else collectSourceRefs(child, out);
  }
  return out;
}

function evidenceContainsSource(value, row) {
  if (Array.isArray(value)) return value.some((child) => evidenceContainsSource(child, row));
  if (!value || typeof value !== 'object') return false;
  if (value.sha256 === row.declared_sha256
      && (value.url === row.official_url || value.official_url === row.official_url)) return true;
  return Object.values(value).some((child) => evidenceContainsSource(child, row));
}

describe('Virginia primary-outcome source integrity manifest', () => {
  it('freezes the exact 24-community-college and 15-public-university scope', () => {
    expect(new Set(primarySlugs).size).toBe(39);
    expect(communitySlugs).toHaveLength(24);
    expect(publicSlugs).toHaveLength(15);
    expect(manifest.scope).toEqual({
      definition: expect.stringMatching(/24 primary Virginia community-college outcomes.*15 SCHEV public/i),
      community_college_outcomes: 24,
      schev_public_four_year_outcomes: 15,
      total_outcomes: 39,
      positive_degree_outcomes: 34,
      no_current_cs_specific_program_findings: 5,
      total_source_refs: 196,
    });
    expect(manifest.outcomes.map((row) => row.slug).sort()).toEqual([...primarySlugs].sort());
    expect(manifest.outcomes.filter((row) => row.outcome === 'captured')).toHaveLength(34);
    expect(manifest.outcomes.filter((row) => row.outcome === 'no_cs_program')).toHaveLength(5);
  });

  it('classifies every used source ref exactly once and mirrors its official declaration', () => {
    const rows = [...manifest.exact_local_byte_matches, ...manifest.exceptions];
    const rowsByKey = new Map(rows.map((row) => [keyOf(row), row]));
    expect(rows).toHaveLength(196);
    expect(rowsByKey.size).toBe(196);

    for (const slug of primarySlugs) {
      const institution = registryDoc.institutions.find((row) => row.slug === slug);
      const requirement = requirementFor(slug);
      const refs = collectSourceRefs(requirement);
      const compositionPath = path.join(ROOT, 'composed', `${slug}.json`);
      if (fs.existsSync(compositionPath)) {
        collectSourceRefs(JSON.parse(fs.readFileSync(compositionPath, 'utf8')), refs);
      }
      if (institution.program_finding) collectSourceRefs(institution.program_finding, refs);

      const sourceIds = requirement.sources.map((source) => source.id);
      expect([...refs].sort()).toEqual([...sourceIds].sort());
      expect(manifest.outcomes.find((row) => row.slug === slug)).toMatchObject({
        source_ref_count: sourceIds.length,
        source_refs: sourceIds,
      });

      for (const source of requirement.sources) {
        expect(source).toMatchObject({ official: true, sha256: expect.stringMatching(HASH) });
        const row = rowsByKey.get(`${slug}/${source.id}`);
        expect(row).toMatchObject({
          institution: slug,
          source_id: source.id,
          official_url: source.url,
          declared_sha256: source.sha256,
        });
      }
    }

    expect(manifest.summary).toEqual({
      initial_exception_count: 16,
      resolved_safe_hash_corrections: 2,
      exact_local_byte_matches: 182,
      documented_transparent_render_transport_exceptions: 4,
      url_and_declared_hash_without_retained_bytes: 10,
      final_non_byte_reproducible_refs: 14,
    });
  });

  it('records 182 exact normalized-text byte matches and rehashes the local cache when present', () => {
    const rows = manifest.exact_local_byte_matches;
    expect(rows).toHaveLength(182);
    expect(rows.every((row) => (
      row.classification === 'exact_local_byte_match'
      && row.byte_reproducible === true
      && row.provenance_status === 'exact_retained_normalized_text_bytes'
      && HASH.test(row.declared_sha256)
      && row.retained_text_path.startsWith('server/.va-catalogs/pages/')
      && row.retained_text_bytes > 0
      && row.capture_metadata
    ))).toBe(true);

    const available = rows.filter((row) => fs.existsSync(path.resolve(__dirname, '..', '..', row.retained_text_path)));
    expect([0, rows.length]).toContain(available.length);
    for (const row of available) {
      const localPath = path.resolve(__dirname, '..', '..', row.retained_text_path);
      const bytes = fs.readFileSync(localPath);
      expect(bytes.length).toBe(row.retained_text_bytes);
      expect(sha256(bytes)).toBe(row.declared_sha256);
    }

    const withoutIndexRecord = rows
      .filter((row) => row.capture_metadata.index_record === false)
      .map(keyOf)
      .sort();
    expect(withoutIndexRecord).toEqual([
      'the-university-of-virginia-s-college-at-wise/cybersecurity_concentration',
      'the-university-of-virginia-s-college-at-wise/data_science_concentration',
    ]);
  });

  it('names every final exception and ties it to retained research provenance', () => {
    const transparent = manifest.exceptions
      .filter((row) => row.classification === 'documented_transparent_render_transport_exception');
    const urlOnly = manifest.exceptions
      .filter((row) => row.classification === 'url_and_declared_hash_without_retained_bytes');

    expect(transparent.map(keyOf).sort()).toEqual([
      'tidewater-community-college/approved_transfer_electives',
      'tidewater-community-college/general_education',
      'tidewater-community-college/graduation',
      'tidewater-community-college/major',
    ]);
    expect(urlOnly.map(keyOf).sort()).toEqual([
      'eastern-shore-community-college/broad_science_program',
      'eastern-shore-community-college/catalog_index',
      'james-madison-university/general_education_detail',
      'mountain-empire-community-college/broad_science_program',
      'mountain-empire-community-college/catalog_index',
      'patrick-henry-community-college/broad_science_program',
      'patrick-henry-community-college/catalog_index',
      'southside-virginia-community-college/broad_science_program',
      'southside-virginia-community-college/catalog_index',
      'tidewater-community-college/vccs_master_csc221',
    ]);

    for (const row of manifest.exceptions) {
      expect(row).toMatchObject({
        official_url: expect.stringMatching(/^https:\/\//),
        retrieval_url: expect.stringMatching(/^https:\/\//),
        declared_sha256: expect.stringMatching(HASH),
        capture_transport: expect.any(String),
        byte_reproducible: false,
        provenance_status: 'provenance_only_not_catalog_completeness',
        compact_evidence_retained: true,
        evidence_artifact: expect.stringMatching(/^server\/\.va-catalogs\/research\/.+\.json$/),
      });
      const evidencePath = path.resolve(__dirname, '..', '..', row.evidence_artifact);
      const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      expect(evidenceContainsSource(evidence, row)).toBe(true);
    }

    for (const row of transparent) {
      expect(row).toMatchObject({
        retrieval_url: expect.stringMatching(/^https:\/\/r\.jina\.ai\/https:\/\/catalog\.tcc\.edu\//),
        capture_transport: 'transparent_render_of_exact_official_origin',
        retained_exact_render_bytes: false,
        direct_origin_attempt: {
          status: 403,
          transport: 'browser',
          retained_text_sha256: expect.stringMatching(HASH),
          result: expect.stringMatching(/Cloudflare.*not degree evidence/i),
        },
      });
    }
    expect(urlOnly.every((row) => row.retained_exact_bytes === false)).toBe(true);
    expect(manifest.provenance_boundary).toMatchObject({
      raw_capture_policy: expect.stringMatching(/ignored transport working cache/i),
      compact_evidence_policy: expect.stringMatching(/nonignored research artifacts/i),
      limitation_scope: expect.stringMatching(/provenance limitation only.*not.*catalog-completeness failure/i),
    });
  });

  it('preserves the 16-item initial exception ledger and the two safe UVA Wise resolutions', () => {
    expect(manifest.initial_exceptions).toHaveLength(16);
    expect(new Set(manifest.initial_exceptions.map(keyOf)).size).toBe(16);
    const resolved = manifest.initial_exceptions.filter((row) => row.resolution);
    expect(resolved.map(keyOf).sort()).toEqual([
      'the-university-of-virginia-s-college-at-wise/cybersecurity_concentration',
      'the-university-of-virginia-s-college-at-wise/data_science_concentration',
    ]);
    expect(resolved.map((row) => row.initial_declared_sha256).sort()).toEqual([
      '4853e614ab2313d06ec9755a180741e9b35c7ce516905cf935bd9dbfcf187b1f',
      'e2e9b201b5760b0ac438e199e216929b4045cfe05a270ede1c60bbf707d6dec0',
    ]);
    expect(resolved.every((row) => (
      row.final_classification === 'exact_local_byte_match'
      && row.resolution === 'requirement_and_research_hash_aligned_to_retained_current_official_text'
      && HASH.test(row.corrected_sha256)
    ))).toBe(true);

    const finalExceptionKeys = new Set(manifest.exceptions.map(keyOf));
    expect(manifest.initial_exceptions.filter((row) => !row.resolution).every((row) => (
      finalExceptionKeys.has(keyOf(row))
    ))).toBe(true);
  });
});
