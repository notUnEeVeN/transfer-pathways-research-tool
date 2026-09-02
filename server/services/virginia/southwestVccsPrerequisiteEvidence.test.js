const fs = require('node:fs');
const { createHash } = require('node:crypto');
const {
  DEFAULT_EVIDENCE,
  DEFAULT_SCOPE,
  loadSouthwestVccsPrerequisiteEvidence,
} = require('./southwestVccsPrerequisiteEvidence');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const evidence = JSON.parse(fs.readFileSync(DEFAULT_EVIDENCE, 'utf8'));
const scope = JSON.parse(fs.readFileSync(DEFAULT_SCOPE, 'utf8'));

describe('Southwest VCCS owner-complete prerequisite evidence', () => {
  it('accepts two exact formulas and one complete-record no-stated-requisite finding', () => {
    const loaded = loadSouthwestVccsPrerequisiteEvidence();
    expect(loaded.report).toEqual({
      ready: true,
      exact_owner_entries: 3,
      accepted_exact_formulas: 2,
      structured_none_findings: 1,
      explicit_none_findings: 0,
      unresolved_no_explicit_none: 0,
      accepted_codes: ['ENG249', 'ENG268', 'PHI102'],
      structured_none_codes: ['PHI102'],
      unresolved_codes: [],
    });
    for (const code of ['ENG249', 'ENG268']) {
      const row = loaded.accepted.get(code);
      expect(row).toMatchObject({
        status: 'parsed',
        source: 'official_owner_catalog_course_entry',
        authority_scope: 'owner_complete_for_requirement_scope',
        owner_coverage: ['Southwest Virginia Community College'],
        raw_requisites: expect.stringMatching(/^Prerequisite\(s\): ENG 112/),
        groups: [{
          kind: 'prerequisite',
          formula: 'paths_or__conditions_and',
          paths: [
            expect.objectContaining({ all_of: [expect.objectContaining({ code: 'ENG112' })] }),
            expect.objectContaining({ all_of: [expect.objectContaining({ condition: 'consent' })] }),
          ],
        }],
      });
      expect(row.source_evidence.content_sha256).toBe(sha256(row.source_evidence.raw_text));
      expect(row.source_evidence.source_capture).toMatchObject({
        kind: 'official_http_response_and_single_course_fragment',
        source_response_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        course_fragment_html_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        extracted_entry_sha256: row.source_evidence.content_sha256,
        parser_contract: 'southwest-courseleaf-preview-course-fragment-v1',
      });
    }
    expect(loaded.accepted.get('PHI102')).toMatchObject({
      code: 'PHI102',
      status: 'none',
      raw_requisites: null,
      source: 'official_owner_catalog_course_entry',
      explicit_none_evidence: {
        kind: 'structured_owner_catalog_record_boundary',
        literal_none_statement: false,
        requisite_clause_count: 0,
        source_response_sha256: 'e84ae9af17aa950e1430e746212f14c6f7e2338042bb3ebf04df492c15ef3a0f',
        course_fragment_html_sha256: '9106c24d941673e0f0c3e90314010a57c7b61bd541cd9e7a0bddd3a53242afe2',
        response_parser_contract: 'southwest-courseleaf-preview-course-fragment-v1',
        same_catalog_marker_control: {
          code: 'ENG268',
          source_url: expect.stringContaining('catoid=2'),
          catalog_year: '2020-2021',
          raw_requisites: expect.stringMatching(/^Prerequisite\(s\): ENG 112/),
          source_capture: {
            source_response_sha256: '070f7a8bc42fd4e991284dcf708dd9df15c637b1b745764ebbab73e9bed643a1',
            course_fragment_html_sha256: 'bb3e4ed9b4f432127cff149b4069a126cd31a95767c6b025f2ba4026aff1fc99',
            extracted_entry_sha256: 'a6ca92ff47cfdf94e039a69f7edb0dd1ee1a5edbccc5a143302d02efb218d00d',
          },
        },
      },
    });
  });

  it('fails closed if exact entry content changes without a matching receipt', () => {
    const changed = structuredClone(evidence);
    changed.rows[0].raw_entry_text += ' changed';
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/entry hash mismatch/);
  });

  it('fails closed if retained text is rewritten even with a recomputed text hash', () => {
    const changed = structuredClone(evidence);
    const row = changed.rows.find((candidate) => candidate.code === 'ENG249');
    row.raw_entry_text = row.raw_entry_text.replace(
      'ENG 112 or divisional approval',
      'ENG 112 and divisional approval',
    );
    row.raw_requisites = 'Prerequisite(s): ENG 112 and divisional approval';
    row.raw_entry_sha256 = sha256(row.raw_entry_text);
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/not byte-derived|official response receipt mismatch/);
  });

  it('fails closed if canonical scope gains another owner', () => {
    const changedScope = structuredClone(scope);
    changedScope.find((row) => row.code === 'ENG268').colleges.push(
      'Tidewater Community College',
    );
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: evidence, scopeRows: changedScope,
    })).toThrow(/not complete.*owners/);
  });

  it('never relabels the structured PHI 102 finding as a literal none statement', () => {
    const changed = structuredClone(evidence);
    changed.rows.find((row) => row.code === 'PHI102').accepted_explicit_none = true;
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/may not infer no prerequisites/);
  });

  it('fails closed if the same-catalog requisite-marker control disappears', () => {
    const changed = structuredClone(evidence);
    const control = changed.rows.find((row) => row.code === 'ENG268');
    control.raw_requisites = null;
    control.disposition = 'unresolved_no_explicit_none_statement';
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/same-catalog.*control/);
  });

  it('fails closed if PHI 102 gains a hidden requisite marker', () => {
    const changed = structuredClone(evidence);
    const row = changed.rows.find((candidate) => candidate.code === 'PHI102');
    row.raw_entry_text += '\nPrerequisite(s): PHI 101';
    row.raw_entry_sha256 = sha256(row.raw_entry_text);
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/not byte-derived|official response receipt mismatch/);
  });

  it('fails closed if an official response receipt hash is edited', () => {
    const changed = structuredClone(evidence);
    changed.rows.find((row) => row.code === 'PHI102')
      .source_capture.source_response_sha256 = '0'.repeat(64);
    expect(() => loadSouthwestVccsPrerequisiteEvidence({
      evidenceArtifact: changed, scopeRows: scope,
    })).toThrow(/official response receipt mismatch/);
  });
});
