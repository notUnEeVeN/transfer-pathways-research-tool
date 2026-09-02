import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/randolph-macon-collegiate-attribute-evidence.json';
import {
  INCOMPLETENESS_SENTENCE,
  ROSTER_SPECS,
  buildRandolphMaconCollegiateAttributeEvidence,
  listedMembership,
  parseRoster,
} from './randolphMaconCollegiateAttributeEvidence';
import {
  FILES,
  ROBOTS_BYTES,
  ROBOTS_SHA256,
  SOURCES,
  robotsAllows,
  sourceFiles,
  verifyCachedCapture,
} from '../../scripts/va/captureRandolphMaconCollegiateAttributeSources';
import {
  OUTPUT,
  buildFromCache,
} from '../../scripts/va/buildRandolphMaconCollegiateAttributeEvidence';

const readText = (filename) => fs.readFileSync(filename, 'utf8');
const readJson = (filename) => JSON.parse(readText(filename));

function sourceInputs() {
  return {
    htmlBySource: Object.fromEntries(SOURCES.map((source) => [
      source.id, readText(sourceFiles(source).raw),
    ])),
    normalizedBySource: Object.fromEntries(SOURCES.map((source) => [
      source.id, readText(sourceFiles(source).normalized),
    ])),
    captureMetadata: readJson(FILES.metadata),
    robotsText: readText(FILES.robots),
  };
}

describe('Randolph-Macon 2026-2027 Collegiate attribute evidence', () => {
  it('replays exact robots-authorized raw and normalized source receipts', () => {
    const capture = verifyCachedCapture();
    expect(capture).toMatchObject({ verified: true, issues: [] });
    expect(capture.receipts).toHaveLength(5);
    expect(capture.receipts.reduce((sum, row) => sum + row.raw_bytes, 0)).toBe(428839);
    expect(Buffer.byteLength(capture.robots_text)).toBe(ROBOTS_BYTES);
    expect(capture.metadata.robots.sha256).toBe(ROBOTS_SHA256);
    expect(SOURCES.every((source) => (
      robotsAllows(capture.robots_text, new URL(source.url).pathname)
    ))).toBe(true);
  });

  it('rebuilds the checked artifact byte-for-byte and preserves lower-bound scope', () => {
    const rebuilt = buildFromCache();
    expect(rebuilt).toEqual(evidence);
    expect(`${JSON.stringify(rebuilt, null, 2)}\n`).toBe(readText(OUTPUT));
    expect(evidence.roster_scope).toEqual({
      classification: 'exact_published_lower_bound_positive_attributes_only',
      exhaustive_for_current_eligibility: false,
      exact_catalog_limitation: INCOMPLETENESS_SENTENCE,
      omitted_by_official_page: [
        'temporary_designations', 'special_topics_courses', 'recent_approvals',
      ],
      current_authority_named_by_catalog: 'MyMaconWeb',
      negative_membership_inference_allowed: false,
      transfer_optimizing_feasibility_closed: false,
    });
    expect(evidence.publication_disposition).toMatchObject({
      safely_resolved_constraint_kinds: [],
      paper_impact_scoped_constraint_kinds: {
        writing_attentive_overlap: ['6'],
      },
      still_blocked_constraint_kinds: [
        'foreign_language_sequence_or_proficiency',
        'distinct_pillar_courses',
        'major_to_pillar_overlap_limit',
        'pillar_distribution_attributes',
        'writing_attentive_overlap',
        'cross_area_overlap_limit',
        'cross_area_course_or_project_forms',
      ],
      official_catalog_wording_conflict_resolved: false,
      transfer_application_discretion_resolved: false,
    });
  });

  it('parses every published table row without treating absence as ineligibility', () => {
    expect(Object.fromEntries(Object.entries(evidence.rosters).map(([name, roster]) => [
      name, [roster.occurrence_count, roster.unique_course_count],
    ]))).toEqual({
      foreign_language: [30, 30],
      AE: [93, 93], CL: [64, 64], GE: [54, 54], HC: [82, 82],
      QS: [21, 21], SP: [31, 31], WA: [77, 77],
      EL: [247, 246], NW: [78, 78], DI: [55, 55], CS: [97, 97],
    });
    expect(Object.values(evidence.rosters)
      .reduce((sum, roster) => sum + roster.occurrence_count, 0)).toBe(929);
    expect(evidence.rosters.EL.entries.filter((row) => row.code === 'CRIM460'))
      .toHaveLength(2);
    // An absent identity is unknown, not a negative membership assertion.
    expect(listedMembership(evidence.rosters, 'NEW499')).toEqual({});
    expect(evidence.roster_scope.negative_membership_inference_allowed).toBe(false);
  });

  it('retains exact positive CS, Pillar, cross-area, and language witnesses', () => {
    expect(listedMembership(evidence.rosters, 'CSCI111')).toMatchObject({
      QS: [{ code: 'CSCI111', units: 4, distribution_attribute: 'NS' }],
    });
    expect(listedMembership(evidence.rosters, 'CSCI403')).toMatchObject({
      EL: expect.any(Array), CS: expect.any(Array),
    });
    expect(listedMembership(evidence.rosters, 'CSCI485')).toMatchObject({
      EL: expect.any(Array), CS: expect.any(Array),
    });
    expect(evidence.published_positive_witnesses).toMatchObject({
      pillars: {
        selection_by_pillar: {
          AE: 'ARTH201', CL: 'BUSN230', GE: 'ARTH227',
          HC: 'ASTR235', QS: 'CSCI111', SP: 'ASTR101',
        },
        distinct_course_count: 6,
        distribution_attributes_present: ['HU', 'SS', 'NS'],
        writing_attentive_course: 'ARTH201',
        published_wa_rows_also_listed_as_pillars: 77,
      },
      cross_area: {
        selection_by_attribute: {
          EL: 'CSCI485', NW: 'ARTH210', DI: 'ARTH225', CS: 'CSCI485',
        },
        maximum_attributes_on_one_course: 2,
      },
      foreign_language: {
        explicit_intermediate_sequence_witnesses: [
          ['CHIN211', 'CHIN212'], ['FREN211', 'FREN212'], ['SPAN211', 'SPAN212'],
        ],
        registrar_proficiency_route_resolved_for_degree_application: false,
      },
    });
  });

  it('fails closed on source, roster, limitation, metadata, and robots mutations', () => {
    const cases = [
      ['raw course row', (input) => {
        input.htmlBySource.pillars = input.htmlBySource.pillars.replace('CSCI 111', 'CSCI 119');
      }],
      ['published limitation', (input) => {
        input.normalizedBySource.overview = input.normalizedBySource.overview
          .replace(INCOMPLETENESS_SENTENCE, 'All lists are complete.');
      }],
      ['catalog year', (input) => {
        input.htmlBySource.cross_area = input.htmlBySource.cross_area
          .replace('2026-2027 Academic Catalog', '2027-2028 Academic Catalog');
      }],
      ['capture hash', (input) => {
        input.captureMetadata.sources[0].raw_sha256 = '0'.repeat(64);
      }],
      ['robots receipt', (input) => {
        input.robotsText = 'User-agent: *\nDisallow: /collegiate-requirement-courses/\n';
      }],
    ];
    for (const [label, mutate] of cases) {
      const input = sourceInputs();
      mutate(input);
      expect(
        () => buildRandolphMaconCollegiateAttributeEvidence(input),
        label,
      ).toThrow(/evidence invalid/);
    }
  });

  it('rejects dropped, duplicated, malformed, and redistributed roster rows', () => {
    const html = sourceInputs().htmlBySource.pillars;
    const spec = ROSTER_SPECS.QS;
    const exact = parseRoster(html, 'QS', spec);
    expect(exact).toMatchObject({ verified: true, occurrence_count: 21 });

    const row = html.match(/<tr[^>]*>[\s\S]*?CSCI 111[\s\S]*?<\/tr>/i)?.[0];
    expect(row).toBeTruthy();
    for (const [label, mutated] of [
      ['drop', html.replace(row, '')],
      ['duplicate', html.replace(row, `${row}${row}`)],
      ['code disagreement', html.replace('title="CSCI 111"', 'title="CSCI 119"')],
      ['distribution removal', html.replace(
        'Introduction to Computer Science (NS)',
        'Introduction to Computer Science',
      )],
    ]) {
      expect(parseRoster(mutated, 'QS', spec).verified, label).toBe(false);
    }
  });
});
