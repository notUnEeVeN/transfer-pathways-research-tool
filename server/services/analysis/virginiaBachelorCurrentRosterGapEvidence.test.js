const fs = require('node:fs');
const path = require('node:path');
const {
  auditRandolphMaconCurrentRosterGap,
  auditUvaWiseCurrentRosterGaps,
  buildVirginiaBachelorCurrentRosterGapEvidence,
} = require('./virginiaBachelorCurrentRosterGapEvidence');

const ROOT = path.resolve(__dirname, '../..');

describe('current UVA Wise and Randolph-Macon roster gap evidence', () => {
  it('reproduces both source gaps without promoting either bachelor document', () => {
    const evidence = buildVirginiaBachelorCurrentRosterGapEvidence();
    expect(evidence.uva_wise.inclusive_excellence.current_exact_designation_roster_proved).toBe(false);
    expect(evidence.uva_wise.cs_major_lab_science).toMatchObject({
      retained_course_listing_page: 1,
      advertised_course_listing_pages: 13,
      closed_eligible_lab_roster_proved: false,
      sender_pair_qualification_proved: false,
      qualifying_sender_contexts_with_policy_receipts: 18,
      figure_3_4_cells_closed_by_this_probe: 0,
    });
    expect(evidence.randolph_macon.all_catalog_courses_query).toMatchObject({
      response_complete: true,
      row_occurrences: 745,
      unique_course_codes: 743,
      exact_duplicate: { code: 'COMM201', occurrences: 3, byte_identical_rows: true },
    });
    expect(evidence.randolph_macon.current_offering_queries).toEqual({
      fall_2026_rows: 216,
      jterm_2027_rows: 74,
      spring_2027_rows: 0,
      spring_2027_exact_response: 'Spring courses are not yet available',
    });
    expect(evidence.randolph_macon.exhaustive_current_collegiate_membership_proved).toBe(false);
    expect(evidence.randolph_macon.negative_membership_inference_allowed).toBe(false);
    expect(evidence.uva_wise.whole_bachelor_document_safe_to_integrate).toBe(false);
    expect(evidence.randolph_macon.whole_bachelor_document_safe_to_integrate).toBe(false);
    expect(evidence).toMatchObject({ database_writes: 0, core_major_edits: 0 });
  });

  it('fails closed if UVA Wise pagination evidence is hidden', () => {
    const relative = '.va-catalogs/pages/the-university-of-virginia-s-college-at-wise__course_catalog.txt';
    const original = fs.readFileSync(path.join(ROOT, relative));
    const changed = Buffer.from(original.toString('utf8').replace('Forward 10 -> 13', ''));
    expect(() => auditUvaWiseCurrentRosterGaps({ [relative]: changed })).toThrow(/source hash changed/);
  });

  it('fails closed if RMC Spring unavailability is rewritten as a roster', () => {
    const relative = '.va-catalogs/research/randolph-macon-mymaconweb-current-roster-sources/curriculum21_spring_2027_data.json';
    const original = fs.readFileSync(path.join(ROOT, relative));
    const changed = Buffer.from(original.toString('utf8').replace(
      'Spring courses are not yet available',
      'ARTH 201',
    ));
    expect(() => auditRandolphMaconCurrentRosterGap({ [relative]: changed })).toThrow(/receipt changed/);
  });

  it('preserves exact structured RMC counts instead of parsing prose suffixes', () => {
    const evidence = auditRandolphMaconCurrentRosterGap();
    expect(evidence.all_catalog_courses_query.membership_counts).toEqual({
      effective_communication: {
        'Foreign Language': 30, 'In Context': 43, 'Oral Communication': 59, Written: 1,
      },
      pillars: {
        'Aesthetic Expression': 99, 'Civic Life': 67, 'Global Experiences': 57,
        'Human Condition': 82, 'Quantitative and Symbolic Reasoning': 21,
        'Scientific Process': 31,
      },
      writing_attentive: { Yes: 77 },
      distribution: { Humanities: 239, 'Natural Science': 58, 'Social Sciences': 62 },
      cross_area: {
        'Capstone Experience': 96, 'Diversity and Inclusion': 55,
        'Experiential Learning': 268, 'Non-Western Culture': 79,
      },
    });
  });

  it('keeps the retained audit artifact at a fixed point', () => {
    const artifact = JSON.parse(fs.readFileSync(path.join(
      ROOT,
      '.va-catalogs/research/virginia-bachelor-current-roster-source-gap-evidence.json',
    )));
    expect(artifact).toEqual(buildVirginiaBachelorCurrentRosterGapEvidence());
  });
});
