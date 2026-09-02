import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/uva-wise-ge-roster-evidence.json';
import {
  CONTEXTUAL_WITNESS,
  EXPECTED_AREA_COUNTS,
  EXPECTED_SEMANTIC_SHA256,
  SOURCE_SHA256,
  buildUvaWiseGeRosterEvidence,
  uvaWiseContextualFigure34CapacityProof,
  uvaWiseGeRosterEvidenceIssue,
} from './uvaWiseGeRosterEvidence';

const SERVER = path.resolve(__dirname, '../..');
const GE = path.join(
  SERVER, '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__ge.txt',
);
const MAJOR = path.join(
  SERVER, '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__program.txt',
);
const IE = path.join(
  SERVER, '.va-catalogs/research/uva-wise-ge-roster-sources/inclusive-excellence.html',
);
const IE_METADATA = path.join(
  SERVER, '.va-catalogs/research/uva-wise-ge-roster-sources/inclusive-excellence.json',
);
const ROBOTS = path.join(
  SERVER, '.va-catalogs/research/uva-wise-transfer-policy-sources/robots.txt',
);

function input() {
  return {
    geText: fs.readFileSync(GE, 'utf8'),
    majorText: fs.readFileSync(MAJOR, 'utf8'),
    ieHtml: fs.readFileSync(IE, 'utf8'),
    robotsText: fs.readFileSync(ROBOTS, 'utf8'),
    ieResponse: JSON.parse(fs.readFileSync(IE_METADATA, 'utf8')),
  };
}

describe('UVA Wise exact GE roster and unresolved IE evidence', () => {
  it('rebuilds the retained artifact from exact official bytes and response metadata', () => {
    const rebuilt = buildUvaWiseGeRosterEvidence(input());
    expect(rebuilt).toEqual(evidence);
    expect(rebuilt).toMatchObject({ verified: true, issues: [] });
    expect(uvaWiseGeRosterEvidenceIssue(rebuilt)).toBeNull();
    expect(Object.fromEntries(Object.entries(rebuilt.source_receipts).map(([key, row]) => [
      key, row.response_sha256,
    ]))).toEqual({
      general_education: SOURCE_SHA256.general_education_text,
      cs_major: SOURCE_SHA256.cs_major_text,
      inclusive_excellence: SOURCE_SHA256.inclusive_excellence_html,
      robots: SOURCE_SHA256.uvawise_robots_text,
    });
    expect(rebuilt.source_receipts.robots.ie_path_allowed).toBe(true);
  });

  it('retains every contextual occurrence, duplicate-area membership, and attribute rule', () => {
    expect(evidence.contextual).toMatchObject({
      occurrence_count: 145,
      unique_course_count: 143,
      counts_by_area: EXPECTED_AREA_COUNTS,
      roster_sha256: EXPECTED_SEMANTIC_SHA256.contextual_occurrences,
      repeated_across_areas: [
        { code: 'ENG3030', areas: ['Community', 'Nation'] },
        { code: 'ENG3170', areas: ['Nation', 'World'] },
      ],
      humanities_fine_arts_prefixes: ['ART', 'ENG', 'HIS', 'HUM', 'MUS', 'PHI', 'THT'],
      social_behavioral_science_prefixes: ['ECO', 'POL', 'PSY', 'SOC'],
      one_course_may_satisfy_more_than_one_area: false,
    });
    expect(Object.fromEntries(Object.entries(evidence.contextual.areas).map(([area, rows]) => [
      area, rows.length,
    ]))).toEqual(EXPECTED_AREA_COUNTS);
  });

  it('proves one exact 18-credit Figure 3/4 contextual route without inventing IE', () => {
    expect(evidence.contextual.fixed_figure_3_4_witness).toMatchObject({
      liberal_arts_core_units: 21,
      major_overlap_self_units: 3,
      remaining_contextual_capacity_units: 18,
      distinct_course_count: 7,
      subareas_satisfied: ['Self', 'Community', 'Nation', 'World'],
      disciplinary_attributes_satisfied: [
        'humanities_fine_arts', 'social_behavioral_science',
      ],
      one_course_per_area_observed: true,
      all_courses_below_3000: true,
      witness_sha256: EXPECTED_SEMANTIC_SHA256.contextual_witness,
    });
    expect(evidence.contextual.fixed_figure_3_4_witness.courses.map((row) => ({
      area: row.area, code: row.code, units: row.units, carrier: row.carrier,
    }))).toEqual(CONTEXTUAL_WITNESS);
    expect(uvaWiseContextualFigure34CapacityProof(evidence)).toMatchObject({
      ready: true,
      figure_3_4_capacity_exact: true,
      remaining_contextual_capacity_units: 18,
      selected_course_codes: [
        'SWE1790', 'SOC1100', 'POL1010', 'ANT1020',
        'HED2230', 'HIS1070', 'GEO2020',
      ],
      figure_6_identity_and_prerequisites_exact: false,
      all_courses_below_3000: true,
    });
  });

  it('does not promote the GE science list into the broader major-lab roster', () => {
    expect(evidence.scientific_reasoning).toMatchObject({
      course_occurrence_count: 21,
      route_count: 12,
      roster_sha256: EXPECTED_SEMANTIC_SHA256.scientific_reasoning_routes,
      positive_witness_units: 8,
    });
    expect(evidence.scientific_reasoning.positive_eight_credit_witness).toEqual([
      { codes: ['BIO1010', 'BIO1011'], prefix: 'BIO', units: 4 },
      { codes: ['CHM1010', 'CHM1011'], prefix: 'CHM', units: 4 },
    ]);
    expect(evidence.major_lab_rule).toMatchObject({
      prefixes: ['BIO', 'CHM', 'ENV', 'GLG', 'PHY'],
      scientific_reasoning_route_prefixes: ['BIO', 'CHM', 'GLG', 'PHY'],
      environmental_science_route_enumerated_on_ge_page: false,
      complete_major_course_roster_proved: false,
    });
    expect(evidence.capability.two_distinct_lab_sciences_from_approved_disciplines)
      .toEqual({
        positive_eight_credit_route_proved: true,
        complete_major_roster_proved: false,
        pair_level_sending_qualification_proved: false,
        figure_3_4_capacity_exact: false,
      });
  });

  it('retains the current official IE definition as an explicit completeness gap', () => {
    expect(evidence.inclusive_excellence).toMatchObject({
      minimum_courses: 1,
      minimum_units: 3,
      scope: 'Liberal Arts Core Curriculum',
      designation_definition_published: true,
      course_level_designation_rows: [],
      course_level_roster_completeness_proved: false,
      negative_membership_inference_allowed: false,
      reason: expect.stringContaining('does not publish a complete current course-level'),
    });
    expect(evidence.capability.inclusive_excellence_designation)
      .toEqual({
        figure_3_4_capacity_exact: false,
        figure_6_identity_and_prerequisites_exact: false,
      });
  });

  it.each([
    ['dropped contextual row', (value) => {
      value.geText = value.geText.replace(
        'SOC 1100\u00a0-\u00a0Introduction To Sociology Credit(s): 3\n', '',
      );
    }, 'context_witness:Community:SOC1100'],
    ['duplicated contextual row', (value) => {
      const row = 'POL 1010\u00a0-\u00a0American National Politics and Political Institutions Credit(s): 3';
      value.geText = value.geText.replace(row, `${row}\n${row}`);
    }, 'context_Nation:duplicate_code'],
    ['changed witness units', (value) => {
      value.geText = value.geText.replace(
        'HED 2230\u00a0-\u00a0Personal and Community Health Credit(s): 3',
        'HED 2230\u00a0-\u00a0Personal and Community Health Credit(s): 2',
      );
    }, 'context_witness:Community:HED2230'],
    ['changed HFA source rule', (value) => {
      value.geText = value.geText.replace('Art, English, History, Humanities, Music, Philosophy, or Theater', 'Art or English');
    }, 'context:policy_statement_2'],
    ['changed single-count source rule', (value) => {
      value.geText = value.geText.replace('One course may not be used', 'One course may be used');
    }, 'context:policy_statement_4'],
    ['changed broad major prefix rule', (value) => {
      value.majorText = value.majorText.replace('ENV XXXX/LAB, ', '');
    }, 'major_lab_prefix_rule'],
    ['fabricated IE row', (value) => {
      value.ieHtml = value.ieHtml.replace(
        "<h2>IE course interest?</h2>",
        '<p>ENG 3030 is IE.</p><h2>IE course interest?</h2>',
      );
      value.ieResponse.response_bytes = Buffer.byteLength(value.ieHtml);
    }, 'source_sha256:ieHtml'],
    ['robots denial', (value) => {
      value.robotsText += '\nDisallow: /about/leadership/advocacy-opportunity/inclusive-excellence\n';
    }, 'robots:ie_path_disallowed'],
    ['response redirect drift', (value) => {
      value.ieResponse.final_url = 'https://www.uvawise.edu/registrar';
    }, 'ie:response_receipt'],
  ])('fails closed on %s', (_label, mutate, expectedIssue) => {
    const changed = input();
    mutate(changed);
    const rebuilt = buildUvaWiseGeRosterEvidence(changed);
    expect(rebuilt.verified).toBe(false);
    expect(rebuilt.issues).toContain(expectedIssue);
  });

  it.each([
    ['dropped roster occurrence', (value) => { value.contextual.areas.Community.pop(); }],
    ['changed witness identity', (value) => {
      value.contextual.fixed_figure_3_4_witness.courses[1].code = 'ENG3030';
    }],
    ['fabricated IE completeness', (value) => {
      value.inclusive_excellence.course_level_roster_completeness_proved = true;
    }],
    ['fabricated major-lab completeness', (value) => {
      value.major_lab_rule.complete_major_course_roster_proved = true;
    }],
    ['fabricated lab Figure 3/4 capability', (value) => {
      value.capability.two_distinct_lab_sciences_from_approved_disciplines
        .figure_3_4_capacity_exact = true;
    }],
  ])('rejects artifact mutation: %s', (_label, mutate) => {
    const changed = structuredClone(evidence);
    mutate(changed);
    expect(uvaWiseGeRosterEvidenceIssue(changed)).not.toBeNull();
    expect(uvaWiseContextualFigure34CapacityProof(changed).ready).toBe(false);
  });
});
