import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import candidatesArtifact from '../../.va-catalogs/research/va-university-prerequisite-candidates.json';
import {
  buildExactVirginiaParentMap,
  compileValidatedVirginiaFormulaCorpora,
} from '../analysis/pathwayComplexity';
import {
  extractCourseLeafEntries,
  requisiteMarkerCounts,
} from './universityPrerequisiteAcquisition';
import {
  COREQUISITE_ROUTES,
  EXACT_CANDIDATE_SHA256,
  EXACT_SOURCE_SHA256,
  EXACT_STATEMENTS,
  OWNER,
  RECIPROCAL_COREQUISITE_CODES,
  SAFE_COREQUISITE_CODES,
  TARGET_CODES,
  buildVirginiaTechRecursivePrerequisiteControl,
  canonicalJson,
  canonicalSha256,
  resolveVirginiaTechRecursivePrerequisiteCandidate,
  sha256,
  summarizeVirginiaTechRecursivePrerequisites,
} from './virginiaTechRecursivePrerequisiteClosureEvidence';

const SERVER_ROOT = path.resolve(__dirname, '../..');
const candidates = candidatesArtifact.candidates.filter((row) => (
  row.owner_namespace === OWNER && TARGET_CODES.includes(row.course_code)
));
const byCode = new Map(candidates.map((row) => [row.course_code, row]));
const control = buildVirginiaTechRecursivePrerequisiteControl(candidates);
const clone = (value) => structuredClone(value);

function resolution(code, candidate = byCode.get(code), candidateControl = control) {
  return resolveVirginiaTechRecursivePrerequisiteCandidate(candidate, candidateControl);
}

const vccsNone = {
  course_key: 'va:CSC100',
  owner_namespace: 'va:vccs',
  status: 'none',
  source: 'vccs_master_course_file',
  source_url: 'https://courses.vccs.edu/courses/CSC100',
  raw_requisites: null,
  groups: [],
};

function universityNone(courseKey) {
  return {
    course_key: courseKey,
    owner_namespace: OWNER,
    status: 'none',
    source: 'institution_catalog',
    source_url: 'https://catalog.vt.edu/',
    source_bundle_hash: 'standalone-exact-source-fixture',
    raw_requisites: null,
    groups: [],
  };
}

function publicationShape(code, result = resolution(code)) {
  const formula = result.ready ? result : result.proof.exact_source_formula;
  return {
    course_key: `${OWNER}:${code}`,
    owner_namespace: OWNER,
    status: 'parsed',
    source: 'institution_catalog',
    source_url: byCode.get(code).source.official_url,
    source_bundle_hash: byCode.get(code).source.source_response_sha256,
    raw_requisites: formula.raw_requisites,
    groups: formula.groups,
  };
}

function compileUniversityRows(universityRows, requiredUniversityKeys) {
  return compileValidatedVirginiaFormulaCorpora({
    communityCollegeRows: [vccsNone],
    universityRows,
    requiredCommunityCollegeKeys: [vccsNone.course_key],
    requiredUniversityKeys,
  });
}

function expectFailsClosed(code, mutate, candidateControl = control) {
  const changed = clone(byCode.get(code));
  mutate(changed);
  expect(resolution(code, changed, candidateControl)).toMatchObject({
    applicable: true,
    ready: false,
    code,
    classification: 'exact_receipt_changed',
    review_reason: 'virginia_tech_recursive_exact_candidate_or_source_receipt_changed',
  });
}

describe('Virginia Tech recursive prerequisite exact evidence', () => {
  it('accounts for all eight rows, with four source-ready formulas and four blockers', () => {
    expect(candidates).toHaveLength(8);
    expect(new Set(candidates.map((row) => row.course_code)).size).toBe(8);
    expect(control).toMatchObject({ verified: true, issues: [] });
    expect(summarizeVirginiaTechRecursivePrerequisites(candidates)).toEqual({
      contract: 'virginia_tech_recursive_prerequisite_exact_receipts_v1',
      target_count: 8,
      source_formula_ready_count: 4,
      source_formula_ready_codes: ['ESM2114', 'MATH1014', 'MATH1454', 'ME4584'],
      reciprocal_cycle_blocked_codes: ['ISC1105', 'ISC1115'],
      underspecified_knowledge_codes: ['CHEM1014'],
      conflicting_source_codes: ['CS3704'],
      exact_receipt_failures: [],
    });
  });

  it('replays every complete CourseLeaf boundary and marker count from retained bytes', () => {
    const candidatesByCachePath = new Map();
    for (const candidate of candidates) {
      const cachePath = candidate.source.cache_path;
      const rows = candidatesByCachePath.get(cachePath) || [];
      rows.push(candidate);
      candidatesByCachePath.set(cachePath, rows);
    }
    expect(candidatesByCachePath.size).toBe(6);

    for (const [cachePath, pageRows] of candidatesByCachePath) {
      const bytes = fs.readFileSync(path.join(SERVER_ROOT, '.va-catalogs', cachePath));
      const expectedPage = pageRows[0].source;
      expect(bytes).toHaveLength(expectedPage.source_response_bytes);
      expect(sha256(bytes)).toBe(expectedPage.source_response_sha256);
      const extracted = extractCourseLeafEntries(
        bytes.toString('utf8'), pageRows.map((row) => row.course_code),
      );
      expect(extracted).toMatchObject({
        missing: [],
        ambiguous: [],
        courseblock_count: expectedPage.complete_entry_receipt.source_courseblock_count,
        complete_entry_count: expectedPage.complete_entry_receipt.source_complete_entry_count,
        complete_entries_with_required_requisite_marker_count:
          expectedPage.complete_entry_receipt
            .source_complete_entries_with_required_requisite_marker_count,
      });
      for (const candidate of pageRows) {
        const entry = extracted.entries.find((row) => (
          row.course_code === candidate.course_code
        ));
        expect(entry).toMatchObject({
          courseblock_index: candidate.source.courseblock_index,
          published_units: candidate.source.published_units,
          requisite_marker_counts: requisiteMarkerCounts(candidate.source.raw_entry_text),
          raw_entry_text: candidate.source.raw_entry_text,
          raw_entry_sha256: candidate.source.raw_entry_sha256,
          raw_entry_html_sha256: candidate.source.raw_entry_html_sha256,
          structured_requisite_fields: candidate.source.structured_requisite_fields,
          complete_entry_receipt: candidate.source.complete_entry_receipt,
        });
      }
    }
  });

  it('binds every complete candidate/source object and browser acquisition receipt', () => {
    for (const code of TARGET_CODES) {
      const candidate = byCode.get(code);
      expect(canonicalSha256(candidate)).toBe(EXACT_CANDIDATE_SHA256[code]);
      expect(canonicalSha256(candidate.source)).toBe(EXACT_SOURCE_SHA256[code]);
      expect(sha256(candidate.source.raw_entry_text)).toBe(candidate.source.raw_entry_sha256);
      const browser = candidate.source.browser_challenge_receipt;
      if (!browser) continue;
      expect(browser).toMatchObject({
        requested_url: candidate.source.official_url,
        exact_same_url: true,
        document_response_count: 2,
        document_responses: [
          { ordinal: 1, http_status: 202 },
          {
            ordinal: 2,
            http_status: 200,
            url: candidate.source.official_url,
            byte_length: candidate.source.source_response_bytes,
            content_sha256: candidate.source.source_response_sha256,
          },
        ],
      });
      expect(candidate.source.robots_receipt).toMatchObject({
        nonempty_final_body: true,
        parsed_policy: { crawl_delay_seconds: 0 },
        path_allowed: true,
      });
      expect(candidate.source.sitemap_discovery_receipt).toMatchObject({
        discovered_course_url: candidate.source.official_url,
        path_discovered: true,
      });
    }
  });

  it('emits the three exact, lossless corequisite formula shapes', () => {
    const expectedPaths = {
      ESM2114: [['MATH2204'], ['MATH2204H'], ['MATH2406H']],
      MATH1454: [['MATH1225']],
      ME4584: [['ME4524'], ['ECE4704']],
    };
    for (const code of SAFE_COREQUISITE_CODES) {
      const result = resolution(code);
      expect(result).toMatchObject({
        applicable: true,
        ready: true,
        code,
        classification: 'safe_exact_corequisite_formula',
        status: 'parsed',
        issues: [],
        groups: [{ kind: 'corequisite', formula: 'paths_or__conditions_and' }],
        proof: {
          complete_entry_receipt: {
            entry_required_requisite_marker_count: 0,
            entry_corequisite_marker_count: 1,
            entry_requisite_marker_like_count: 1,
            entry_constraint_like_signal_count: 0,
            same_source_positive_control: true,
          },
          content_accounting: {
            every_required_or_corequisite_marker_accounted_for: true,
            source_content_discarded: false,
          },
        },
      });
      expect(result.groups[0].raw).toBe(COREQUISITE_ROUTES[code].raw);
      expect(result.groups[0].paths.map((formulaPath) => (
        formulaPath.all_of.map((condition) => condition.code)
      ))).toEqual(expectedPaths[code]);
      for (const condition of result.groups[0].paths.flatMap((row) => row.all_of)) {
        expect(condition).toMatchObject({
          type: 'course',
          concurrent_allowed: true,
          source_field_kind: 'corequisite',
        });
      }
    }
  });

  it('passes the production formula compiler for one represented corequisite route', () => {
    const selectedByCode = {
      ESM2114: 'MATH2204',
      MATH1454: 'MATH1225',
      ME4584: 'ME4524',
    };
    for (const [code, selected] of Object.entries(selectedByCode)) {
      const target = publicationShape(code);
      const referenced = [...new Set(target.groups.flatMap((group) => (
        group.paths.flatMap((formulaPath) => (
          formulaPath.all_of.map((condition) => condition.course_key)
        ))
      )))];
      const compiled = compileUniversityRows(
        [target, ...referenced.map(universityNone)], [target.course_key],
      );
      expect(compiled).toMatchObject({ ready: true, issues: [] });
      const graph = buildExactVirginiaParentMap({
        compiledCorpora: compiled.corpora,
        pathwayCourseKeys: [target.course_key, `${OWNER}:${selected}`],
      });
      expect(graph).toMatchObject({ ready: true, issues: [] });
      expect(graph.parents_by_course_key.get(target.course_key))
        .toEqual([`${OWNER}:${selected}`]);
      expect(graph.selected_paths).toMatchObject([{
        course_key: target.course_key,
        kind: 'corequisite',
      }]);
    }
  });

  it('keeps the reciprocal ISC pair blocked because production detects its exact cycle', () => {
    expect(control.reciprocal_pair).toMatchObject({
      source_publishes_canonical_one_way_edge: false,
      production_cycle_exemption_contract_present: false,
      directed_edges: [
        { from: `${OWNER}:ISC1115`, to: `${OWNER}:ISC1105`, kind: 'corequisite' },
        { from: `${OWNER}:ISC1105`, to: `${OWNER}:ISC1115`, kind: 'corequisite' },
      ],
    });
    for (const code of RECIPROCAL_COREQUISITE_CODES) {
      expect(resolution(code)).toMatchObject({
        applicable: true,
        ready: false,
        code,
        classification: 'reciprocal_corequisite_cycle_not_supported',
        issues: ['requisite_graph_cycle'],
        proof: {
          formula_emitted: false,
          one_way_edge_inferred: false,
          exact_source_formula: {
            groups: [{ kind: 'corequisite', formula: 'paths_or__conditions_and' }],
          },
        },
      });
    }

    // The source formulas themselves satisfy corpus syntax and closure. The
    // failure occurs at the actual production graph boundary, not in a local
    // duplicate cycle checker.
    const hypotheticalRows = RECIPROCAL_COREQUISITE_CODES.map((code) => (
      publicationShape(code)
    ));
    const compiled = compileUniversityRows(
      hypotheticalRows, hypotheticalRows.map((row) => row.course_key),
    );
    expect(compiled).toMatchObject({ ready: true, issues: [] });
    const graph = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: hypotheticalRows.map((row) => row.course_key),
    });
    expect(graph).toMatchObject({
      ready: false,
      parents_by_course_key: null,
      issues: [{
        path: 'parent_map',
        code: 'requisite_graph_cycle',
        cycle: [
          `${OWNER}:ISC1105`, `${OWNER}:ISC1115`, `${OWNER}:ISC1105`,
        ],
      }],
    });
  });

  it('preserves MATH1014 as two ANDed, typed high-school conditions', () => {
    const result = resolution('MATH1014');
    expect(result).toMatchObject({
      applicable: true,
      ready: true,
      classification: 'safe_exact_typed_non_course_formula',
      status: 'parsed',
      raw_requisites: EXACT_STATEMENTS.MATH1014.raw,
      groups: [{
        kind: 'prerequisite',
        formula: 'paths_or__conditions_and',
        paths: [{
          all_of: [
            {
              type: 'non_course',
              condition: 'minimum_high_school_algebra_units',
              education_level: 'high_school',
              subject: 'algebra',
              minimum_published_units: 2,
              required: true,
            },
            {
              type: 'non_course',
              condition: 'minimum_high_school_plane_geometry_units',
              education_level: 'high_school',
              subject: 'plane_geometry',
              minimum_published_units: 1,
              required: true,
            },
          ],
        }],
      }],
      proof: {
        runtime_graph_semantics: {
          formula_source_ready: true,
          zero_edge_inference_authorized: false,
          explicit_condition_bindings_required_if_course_is_in_pathway: true,
        },
      },
    });
    expect(result.groups[0].paths[0].all_of.map((row) => row.raw))
      .toEqual([EXACT_STATEMENTS.MATH1014.algebra, EXACT_STATEMENTS.MATH1014.geometry]);
    for (const condition of result.groups[0].paths[0].all_of) {
      expect(byCode.get('MATH1014').source.raw_entry_text.slice(
        condition.source_evidence.relative_start,
        condition.source_evidence.relative_end,
      )).toBe(condition.raw);
    }
  });

  it('shows that MATH1014 compiles but cannot become a silent zero-edge row', () => {
    const target = publicationShape('MATH1014');
    const compiled = compileUniversityRows([target], [target.course_key]);
    expect(compiled).toMatchObject({ ready: true, issues: [] });

    const unbound = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [target.course_key],
    });
    expect(unbound.ready).toBe(false);
    expect(unbound.issues.map((issue) => issue.code))
      .toContain('non_course_formula_path_unresolved');

    const conditions = target.groups[0].paths[0].all_of;
    const slots = ['slot:high-school-algebra', 'slot:high-school-plane-geometry'];
    const bindings = {
      [target.course_key]: Object.fromEntries(conditions.map((condition, index) => [
        sha256(canonicalJson(condition)), [slots[index]],
      ])),
    };
    const bound = buildExactVirginiaParentMap({
      compiledCorpora: compiled.corpora,
      pathwayCourseKeys: [target.course_key],
      pathwayVertexKeys: [target.course_key, ...slots],
      nonCourseConditionBindings: bindings,
    });
    expect(bound).toMatchObject({ ready: true, issues: [] });
    expect(bound.parents_by_course_key.get(target.course_key)).toEqual(slots);
  });

  it('keeps CHEM1014 blocked without inventing a knowledge threshold', () => {
    expect(resolution('CHEM1014')).toMatchObject({
      applicable: true,
      ready: false,
      classification: 'underspecified_required_knowledge',
      issues: ['required_knowledge_satisfaction_not_published'],
      proof: {
        modeled_statements: [{ raw: EXACT_STATEMENTS.CHEM1014.raw }],
        required_knowledge: {
          domain: 'mathematical_problem_solving_skills',
          satisfaction_course_published: false,
          satisfaction_assessment_published: false,
          satisfaction_threshold_published: false,
          formula_emitted: false,
          status_none_authorized: false,
        },
      },
    });
    expect(resolution('CHEM1014').groups).toBeUndefined();
  });

  it('keeps CS3704 blocked on the exact CS3114 versus CS2114 source conflict', () => {
    expect(resolution('CS3704')).toMatchObject({
      applicable: true,
      ready: false,
      classification: 'conflicting_source_requirements',
      issues: ['conflicting_prerequisite_course_codes'],
      proof: {
        source_conflict: {
          narrative_assertion: { course_code: 'CS3114', minimum_grade: 'C' },
          formal_courseleaf_field: {
            course_code: 'CS2114', minimum_grade_published: null,
          },
          conflicting_course_codes: ['CS3114', 'CS2114'],
          typo_resolution_inferred: false,
          formula_emitted: false,
          status_none_authorized: false,
        },
      },
    });
    expect(resolution('CS3704').groups).toBeUndefined();
  });

  it('fails closed on identity, source, entry, field, marker, or pair-control drift', () => {
    for (const code of TARGET_CODES) {
      expectFailsClosed(code, (row) => { row.school_id += 1; });
      expectFailsClosed(code, (row) => { row.source.source_response_sha256 = '0'.repeat(64); });
      expectFailsClosed(code, (row) => { row.source.raw_entry_text += ' '; });
      expectFailsClosed(code, (row) => { row.source.raw_entry_html_sha256 = '1'.repeat(64); });
      expectFailsClosed(code, (row) => {
        row.source.complete_entry_receipt.same_source_positive_control = false;
      });
      if (rowHasStructuredField(rowByCode(code))) {
        expectFailsClosed(code, (row) => { row.source.structured_requisite_fields[0].raw += ' '; });
      }
    }

    for (const code of RECIPROCAL_COREQUISITE_CODES) {
      const changedControl = clone(control);
      changedControl.reciprocal_pair.source_publishes_canonical_one_way_edge = true;
      expect(resolution(code, byCode.get(code), changedControl)).toMatchObject({
        applicable: true,
        ready: false,
        classification: 'exact_receipt_changed',
      });
    }
  });

  it('does not broaden the finite evidence to a neighboring Virginia Tech row', () => {
    const neighbor = candidatesArtifact.candidates.find((row) => (
      row.owner_namespace === OWNER && !TARGET_CODES.includes(row.course_code)
    ));
    expect(resolveVirginiaTechRecursivePrerequisiteCandidate(neighbor, control))
      .toEqual({ applicable: false, ready: false, issues: [] });
  });
});

function rowByCode(code) {
  return byCode.get(code);
}

function rowHasStructuredField(row) {
  return Array.isArray(row?.source?.structured_requisite_fields)
    && row.source.structured_requisite_fields.length > 0;
}
