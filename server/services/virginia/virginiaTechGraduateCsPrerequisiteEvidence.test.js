import fs from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
  VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
  VIRGINIA_TECH_GRADUATE_CS_URL,
  buildVirginiaTechGraduateCsPrerequisiteEvidence,
  parseVirginiaTechGraduateCsPrerequisiteEvidence,
  sha256,
  virginiaTechGraduateCsPrerequisiteEvidenceIssue,
} = require('./virginiaTechGraduateCsPrerequisiteEvidence');

const page = fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-tech-graduate-cs-prerequisite-sources/graduate-course-descriptions.html',
  import.meta.url,
));
const robots = fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-tech-graduate-cs-prerequisite-sources/students-cs-vt-robots.txt',
  import.meta.url,
));
const artifact = JSON.parse(fs.readFileSync(new URL(
  '../../.va-catalogs/research/virginia-tech-graduate-cs-prerequisite-evidence.json',
  import.meta.url,
), 'utf8'));

const options = {
  requestedUrl: VIRGINIA_TECH_GRADUATE_CS_URL,
  finalUrl: VIRGINIA_TECH_GRADUATE_CS_URL,
  contentType: 'text/html;charset=utf-8',
  status: 200,
  robotsBytes: robots,
  robotsRequestedUrl: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_URL,
  robotsFinalUrl: VIRGINIA_TECH_GRADUATE_CS_ROBOTS_FINAL_URL,
  robotsContentType: 'text/plain;charset=iso-8859-1',
  robotsStatus: 200,
};
const entry = (code) => artifact.facts.entries.find((row) => row.course_code === code);

describe('Virginia Tech current graduate CS prerequisite evidence', () => {
  it('replays exact retained bytes and exactly two heading-bounded targets', () => {
    const evidence = buildVirginiaTechGraduateCsPrerequisiteEvidence(page, options);
    expect(evidence).toEqual(artifact);
    expect(virginiaTechGraduateCsPrerequisiteEvidenceIssue(evidence)).toBeNull();
    expect(evidence.source).toMatchObject({
      response_bytes: 105535,
      response_sha256: 'e745b75628f4e0c9fc3ce53a6fd28725e50f52a5451d777c53c892ff504eab17',
      canonical_url: VIRGINIA_TECH_GRADUATE_CS_URL,
      pubdate: '2026-07-01T12:54:08Z',
    });
    expect(evidence.facts).toMatchObject({
      target_course_codes: ['CS5104', 'CS5114'],
      same_page_positive_controls: {
        bounded_heading_count: 56,
        entries_with_pre_marker_count: 43,
        pre_marker_count: 46,
        exact_positive_control_course_code: 'CS5114',
        exact_positive_control_statement: 'Pre: CS3114',
      },
    });
    expect(evidence.disposition).toMatchObject({
      resolved_course_codes: ['CS5104', 'CS5114'],
      unresolved_course_codes: ['BIT4614'],
      missing_search_result_used: false,
      catalog_edition_claimed: false,
    });
  });

  it('admits CS5104 silence only at the exact complete-entry boundary with positive controls', () => {
    expect(entry('CS5104')).toMatchObject({
      next_heading_code: 'CS5114',
      formal_prerequisite_marker_count: 0,
      formal_corequisite_marker_count: 0,
      prerequisite_marker_like_count: 0,
      constraint_like_signal_count: 0,
      required_requisite_clause: null,
      semantic_prerequisite: null,
      structural_none_evidence: {
        receipt_contract: VIRGINIA_TECH_GRADUATE_CS_STRUCTURAL_NONE_CONTRACT,
        literal_none_statement: false,
        missing_search_result_used: false,
        exact_complete_entry_present: true,
        same_page_positive_control: true,
        source_bounded_entry_count: 56,
        source_entries_with_pre_marker_count: 43,
        source_pre_marker_count: 46,
        positive_control_course_code: 'CS5114',
        positive_control_statement: 'Pre: CS3114',
      },
    });
  });

  it('preserves CS5114 as exactly one CS3114 prerequisite edge', () => {
    const row = entry('CS5114');
    expect(row).toMatchObject({
      next_heading_code: 'CS5124',
      formal_prerequisite_marker_count: 1,
      formal_corequisite_marker_count: 0,
      prerequisite_marker_like_count: 1,
      required_requisite_clause: {
        receipt_contract: VIRGINIA_TECH_GRADUATE_CS_CLAUSE_CONTRACT,
        kind: 'prerequisite',
        label: 'Pre',
        raw: 'CS3114',
        statement_raw: 'Pre: CS3114',
      },
      semantic_prerequisite: {
        status: 'parsed',
        formula: 'paths_or__conditions_and',
        paths: [{ all_of: [{
          type: 'course',
          code: 'CS3114',
          course_key: 'va:uni:9230:CS3114',
          raw: 'CS3114',
        }] }],
      },
    });
    const receipt = row.required_requisite_clause;
    expect(row.raw_entry_text.slice(receipt.relative_start, receipt.relative_end))
      .toBe(receipt.raw);
    expect(row.raw_entry_text.slice(
      receipt.statement_relative_start,
      receipt.statement_relative_end,
    )).toBe(receipt.statement_raw);
  });

  it('fails closed on source identity, temporal metadata, boundaries, or semantics', () => {
    expect(parseVirginiaTechGraduateCsPrerequisiteEvidence(page, {
      ...options,
      finalUrl: 'https://catalog.vt.edu/graduate/courses/cs/',
    }).issues).toContain('page_url_identity');

    const mutate = (from, to) => {
      const changed = Buffer.from(page.toString('utf8').replace(from, to));
      expect(changed.equals(page)).toBe(false);
      return parseVirginiaTechGraduateCsPrerequisiteEvidence(changed, {
        ...options,
        expectedPageSha256: sha256(changed),
      });
    };
    expect(mutate(
      'content="2026-07-01T12:54:08Z"',
      'content="2026-07-02T12:54:08Z"',
    ).issues).toContain('current_first_party_page_metadata');
    expect(mutate(
      '<a id="CS5104"></a>',
      '<a id="CS5104"></a><a id="CS5104"></a>',
    ).issues).toEqual(expect.arrayContaining([
      'bounded_heading_population',
      'CS5104:unique_heading_boundary',
    ]));
    expect(mutate(
      "formal languages. (3H,3C)</p>",
      'formal languages. (3H,3C) Pre: CS3114</p>',
    ).issues).toEqual(expect.arrayContaining([
      'CS5104:target exact heading, description, or next-heading boundary changed',
    ]));
    expect(mutate('Pre: CS3114</p>', 'Pre: CS4104</p>').issues).toEqual(
      expect.arrayContaining([
        'CS5114:target exact heading, description, or next-heading boundary changed',
      ]),
    );
    expect(mutate('id="CS5124"', 'id="CS5125"').issues).toEqual(
      expect.arrayContaining([
        'CS5114:target exact heading, description, or next-heading boundary changed',
      ]),
    );
  });

  it('rejects self-consistent artifact edits through the pinned facts digest', () => {
    const changed = structuredClone(artifact);
    changed.facts.entries[1].semantic_prerequisite.paths[0].all_of[0].code = 'CS4104';
    expect(virginiaTechGraduateCsPrerequisiteEvidenceIssue(changed))
      .toMatch(/receipt changed/);
  });
});
