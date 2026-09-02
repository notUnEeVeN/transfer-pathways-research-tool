import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-tech-csc222-java-blocked-cohort-evidence.json';
import {
  BLOCKED_COHORT,
  BLOCKED_IDS,
  CSC222_ID,
  LAUREL_RIDGE_ARTICLE_URL,
  RECEIVING_PARENT_ID,
  SOURCE_RESPONSE_SHA256,
  VIRGINIA_TECH_ID,
  VT_CSC222_SELECTED_NOTE,
  VT_CSC222_SOURCE_URL,
  auditExactBlockedCohort,
  buildVirginiaTechCsc222JavaBlockedCohortEvidence,
  explicitJavaStatement,
  parseGermannaResources,
  parseLaurelRidgeArticle,
  parseReynoldsOutline,
  parseVccsSchedulePage,
  robotsPolicy,
  virginiaTechCsc222JavaBlockedCohortEvidenceIssue,
} from './virginiaTechCsc222JavaBlockedCohortEvidence';
import {
  retainedSources,
} from '../../scripts/va/captureVirginiaTechCsc222JavaBlockedCohortEvidence';

function exactCondition(entry) {
  return {
    agreement_id: entry.agreement_id,
    sending_course_id: CSC222_ID,
    sending_code: 'CSC222',
    receiving_identifier: 'CS1114',
    receiving_parent_id: RECEIVING_PARENT_ID,
    condition_kind: 'advisor_or_approval_condition',
    receiving_notes: VT_CSC222_SELECTED_NOTE,
    sending_source_url: VT_CSC222_SOURCE_URL,
  };
}

function exactConditionAudit() {
  return {
    blocked_cells: BLOCKED_COHORT.map((entry) => ({
      community_college_id: entry.community_college_id,
      college_name: entry.source_plan_college_name,
      school_id: VIRGINIA_TECH_ID,
      agreement_ids: [entry.agreement_id],
      ready: false,
      blocking_conditions: [exactCondition(entry)],
    })),
  };
}

function minimalSchedule(entry, notes) {
  const rows = notes.map((note, index) => `
    <tr class="vevent">
      <td>${80000 + index}</td><td>CSC 222-X${index + 1}</td><td>4</td>
      <td>M</td><td>9:00 a.m.-10:00 a.m.</td><td>2026-08-24</td>
      <td>Online</td><td>WW</td>
    </tr>
    <tr><td class="classnote" colspan="8">${note}</td></tr>`).join('');
  return `<!doctype html><html><head><title>${entry.college_name}: Object-Oriented Programming - CSC 222</title></head>
    <body><h2>Object-Oriented Programming - CSC 222 at ${entry.college_name}</h2>
    <div class="card-header"><h4>Fall 2026</h4></div>
    <div class="collapse" id="collapse2264"><table>${rows}</table></div></body></html>`;
}

describe('Virginia Tech blocked CSC 222 Java cohort evidence', () => {
  it('replays every retained official byte and preserves the zero-cell safe delta', () => {
    expect(buildVirginiaTechCsc222JavaBlockedCohortEvidence(retainedSources())).toEqual(evidence);
    expect(virginiaTechCsc222JavaBlockedCohortEvidenceIssue(evidence)).toBeNull();
    expect(Object.fromEntries(Object.entries(evidence.sources).map(([name, source]) => (
      [name, source.response_sha256]
    )))).toEqual(SOURCE_RESPONSE_SHA256);
    expect(evidence.paper_interpretation).toMatchObject({
      newly_resolved_community_college_ids: [],
      still_blocked_community_college_ids: BLOCKED_IDS,
      newly_resolved_cells: 0,
      still_blocked_cells: 15,
      statewide_language_inferred: false,
    });
  });

  it('reproduces the exact 15 source-plan cells and full condition identity', () => {
    expect(auditExactBlockedCohort(exactConditionAudit())).toEqual({
      ready: true,
      issues: [],
      exact_blocked_cell_count: 15,
      exact_blocked_community_college_ids: BLOCKED_IDS,
      cohort_sha256: 'b6eab4dbb82c631d571c49578735636ebf9fe1b56f88c69d446285525a6a7df7',
    });
  });

  it.each([
    ['sending course id', 'sending_course_id', CSC222_ID + 1],
    ['sending code', 'sending_code', 'CSC 222'],
    ['receiver', 'receiving_identifier', 'CS2114'],
    ['receiver parent', 'receiving_parent_id', RECEIVING_PARENT_ID + 1],
    ['condition kind', 'condition_kind', 'language_condition'],
    ['advisor note', 'receiving_notes', 'Java is preferred.'],
    ['source URL', 'sending_source_url', `${VT_CSC222_SOURCE_URL}?changed=1`],
    ['agreement', 'agreement_id', 'va:agreement:9230:9312'],
  ])('rejects a near-match with changed %s', (label, field, replacement) => {
    const audit = exactConditionAudit();
    audit.blocked_cells[0].blocking_conditions[0][field] = replacement;
    expect(auditExactBlockedCohort(audit)).toMatchObject({
      ready: false,
      issues: expect.arrayContaining(['near_match_condition_identity', 'blocked_cohort']),
      exact_blocked_cell_count: 14,
    });
  });

  it('rejects a display-name near-match even when numeric identities are unchanged', () => {
    const audit = exactConditionAudit();
    audit.blocked_cells[3].college_name = 'Reynolds Community College';
    expect(auditExactBlockedCohort(audit)).toMatchObject({
      ready: false,
      issues: expect.arrayContaining(['near_match_condition_identity', 'blocked_cohort']),
      exact_blocked_cell_count: 14,
    });
  });

  it('rejects missing, duplicate, and extra sender cells', () => {
    const missing = exactConditionAudit();
    missing.blocked_cells.pop();
    expect(auditExactBlockedCohort(missing).issues).toContain('blocked_cohort');

    const duplicate = exactConditionAudit();
    duplicate.blocked_cells[0].blocking_conditions.push(
      structuredClone(duplicate.blocked_cells[0].blocking_conditions[0]),
    );
    expect(auditExactBlockedCohort(duplicate).issues).toContain('duplicate_condition');

    const extra = exactConditionAudit();
    extra.blocked_cells.push({
      community_college_id: 9312,
      school_id: VIRGINIA_TECH_ID,
      agreement_ids: ['va:agreement:9230:9312'],
      blocking_conditions: [{
        ...exactCondition(BLOCKED_COHORT[0]),
        agreement_id: 'va:agreement:9230:9312',
      }],
    });
    expect(auditExactBlockedCohort(extra).issues).toContain('near_match_condition_identity');
  });

  it('finds 40 current rows across the 15 endpoints and zero explicit Java bindings', () => {
    const colleges = Object.values(evidence.facts.schedule_audit.colleges);
    expect(colleges).toHaveLength(15);
    expect(colleges.reduce((sum, row) => sum + row.scheduled_section_count, 0)).toBe(40);
    expect(colleges.reduce(
      (sum, row) => sum + row.explicitly_java_bound_section_count,
      0,
    )).toBe(0);
    expect(colleges.every((row) => row.resolution_status === 'fail_closed')).toBe(true);
    expect(colleges.filter((row) => row.course_endpoint_available === false).map((row) => (
      row.community_college_id
    ))).toEqual([9306]);
  });

  it('distinguishes one exact Java section from a universal college delivery policy', () => {
    const entry = BLOCKED_COHORT[0];
    const partial = parseVccsSchedulePage(entry, minimalSchedule(entry, [
      'This class will be taught with Java.',
      'Java tutoring resources are available; language details are in Canvas.',
    ]), {
      requestedUrl: entry.schedule_url,
      finalUrl: entry.schedule_url,
      contentType: 'text/html',
      status: 200,
    });
    expect(partial.issues).toEqual([]);
    expect(partial.facts).toMatchObject({
      scheduled_section_count: 2,
      explicitly_java_bound_section_count: 1,
      unbound_section_count: 1,
      has_exact_current_java_section_binding: true,
      all_scheduled_sections_explicitly_java: false,
      resolution_status: 'fail_closed',
    });

    const universal = parseVccsSchedulePage(entry, minimalSchedule(entry, [
      'This class will be taught with Java.',
      'Programming language: Java',
    ]), {
      requestedUrl: entry.schedule_url,
      finalUrl: entry.schedule_url,
      contentType: 'text/html',
      status: 200,
    });
    expect(universal.facts.has_exact_current_java_section_binding).toBe(true);
    expect(universal.facts.all_scheduled_sections_explicitly_java).toBe(true);
  });

  it.each([
    ['This class will be taught with Java.', true],
    ['The course uses Java as its programming language.', true],
    ['Programming language: Java', true],
    ['Java tutoring resources are available.', false],
    ['Java is one possible high-level language.', false],
    ['This class uses JavaScript.', false],
    ['Object-Oriented Programming', false],
  ])('classifies an explicit section statement without title inference: %s', (text, expected) => {
    expect(explicitJavaStatement(text)).toBe(expected);
  });

  it('refuses to auto-promote a newly universal schedule without review', () => {
    const sources = retainedSources();
    sources.schedule_9301.body = sources.schedule_9301.body.replace(
      '<td colspan="8" class="classnote">',
      '<td colspan="8" class="classnote">This class will be taught with Java. ',
    );
    expect(() => buildVirginiaTechCsc222JavaBlockedCohortEvidence(sources))
      .toThrow(/explicit_java_section_binding_requires_review/);
  });

  it('keeps Germanna Java support resources contextual rather than universal', () => {
    const sources = retainedSources();
    const parsed = parseGermannaResources(
      sources.germanna_resources.body,
      sources.germanna_resources,
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.facts.java_specific_handouts.map((row) => row.label)).toEqual([
      'Java: Input and Output',
      'Java: File Handling',
      'Java: Variables and Data Types',
      'Object-Oriented Programming with Java',
    ]);
    expect(parsed.facts.universal_current_csc222_java_binding).toBe(false);

    const assertedUniversal = structuredClone(sources);
    assertedUniversal.germanna_resources.body = assertedUniversal.germanna_resources.body
      .replace(
        '<h2>CSC 222: Object-Oriented Programming</h2>',
        '<h2>CSC 222: Object-Oriented Programming</h2><p>Every CSC 222 delivery is taught with Java.</p>',
      );
    expect(() => buildVirginiaTechCsc222JavaBlockedCohortEvidence(assertedUniversal))
      .toThrow(/germanna_universal_java_binding_requires_review/);
  });

  it('keeps Laurel Ridge scoped to its dated grant cohort', () => {
    const sources = retainedSources();
    const parsed = parseLaurelRidgeArticle(
      sources.laurel_ridge_article.body,
      sources.laurel_ridge_article,
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.facts).toMatchObject({
      community_college_id: 9308,
      evidence_scope: 'historical_grant_cohort_certificate_description',
      published_at: '2022-12-23T01:53:45+00:00',
      universal_current_csc222_java_binding: false,
      resolution_status: 'fail_closed',
    });
    const changedDate = sources.laurel_ridge_article.body.replace(
      '2022-12-23T01:53:45+00:00',
      '2026-08-25T01:53:45+00:00',
    );
    expect(parseLaurelRidgeArticle(changedDate, sources.laurel_ridge_article).issues)
      .toContain('published_date');
  });

  it('treats Reynolds preferred Java plus an express alternative as non-resolving', () => {
    const sources = retainedSources();
    const parsed = parseReynoldsOutline(
      sources.reynolds_outline.body,
      sources.reynolds_outline_text.body,
      {
        ...sources.reynolds_outline,
        extractedFromSha256: sources.reynolds_outline_text.extractedFromSha256,
      },
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.facts.language_policy).toMatch(/preferred/);
    expect(parsed.facts.language_policy).toMatch(/may offer using a different language/);
    expect(parsed.facts.universal_current_csc222_java_binding).toBe(false);

    const changed = sources.reynolds_outline_text.body.replace(
      'may offer using a different language',
      'must offer using Java',
    );
    expect(parseReynoldsOutline(
      sources.reynolds_outline.body,
      changed,
      {
        ...sources.reynolds_outline,
        extractedFromSha256: sources.reynolds_outline_text.extractedFromSha256,
      },
    ).issues).toContain('preferred_not_required_policy');
  });

  it('respects disallow rules and the published Laurel Ridge crawl delay', () => {
    const denied = robotsPolicy('User-agent: *\nDisallow: /colleges/', {
      requestedUrl: 'https://courses.vccs.edu/robots.txt',
      finalUrl: 'https://courses.vccs.edu/robots.txt',
      contentType: 'text/plain',
      status: 200,
      protectedUrl: BLOCKED_COHORT[0].schedule_url,
    });
    expect(denied.issues).toEqual(['robots_policy']);
    expect(denied.receipt.protected_path_allowed).toBe(false);

    const sources = retainedSources();
    const laurel = robotsPolicy(sources.laurel_ridge_robots.body, {
      ...sources.laurel_ridge_robots,
      protectedUrl: LAUREL_RIDGE_ARTICLE_URL,
    });
    expect(laurel.issues).toEqual([]);
    expect(laurel.crawl_delay_seconds).toBe(10);
  });

  it('does not infer Wytheville language from its NOVA Online provider label', () => {
    const wytheville = evidence.facts.schedule_audit.colleges[9324];
    expect(wytheville.current_schedule_terms.flatMap((term) => term.sections))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ section: 'CSC 222-E06L', java_mentioned: false }),
        expect.objectContaining({ section: 'CSC 222-E60A', java_mentioned: false }),
      ]));
    expect(evidence.paper_interpretation
      .wytheville_nova_provider_inferred_from_other_nova_sections).toBe(false);
  });

  it('fails closed on edited source hashes, facts, and paper interpretation', () => {
    const sourceHash = structuredClone(evidence);
    sourceHash.sources.schedule_9301.response_sha256 = '0'.repeat(64);
    expect(virginiaTechCsc222JavaBlockedCohortEvidenceIssue(sourceHash))
      .toMatch(/source receipt/i);

    const facts = structuredClone(evidence);
    facts.facts.schedule_audit.colleges[9301].resolution_status = 'resolved';
    expect(virginiaTechCsc222JavaBlockedCohortEvidenceIssue(facts))
      .toMatch(/facts changed/i);

    const interpretation = structuredClone(evidence);
    interpretation.paper_interpretation.newly_resolved_cells = 1;
    expect(virginiaTechCsc222JavaBlockedCohortEvidenceIssue(interpretation))
      .toMatch(/interpretation changed/i);
  });
});
