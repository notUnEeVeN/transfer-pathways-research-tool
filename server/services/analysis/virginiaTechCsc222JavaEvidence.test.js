import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import evidence from '../../.va-catalogs/research/virginia-tech-csc222-java-evidence.json';
import {
  CSC222_ID,
  NEW_RIVER_POSTING_URL,
  NEW_RIVER_ROBOTS_URL,
  NEW_RIVER_SCHEDULE_URL,
  NOVA_URL,
  RULE,
  VCCS_ROBOTS_URL,
  buildVirginiaTechCsc222JavaEvidence,
  resolveVirginiaTechCsc222JavaEvidence,
  virginiaTechCsc222JavaEvidenceIssue,
} from './virginiaTechCsc222JavaEvidence';
import { cachedAcceptedSourcePlan } from '../../scripts/importVirginiaCatalogDegrees';
import { buildProjection } from '../../scripts/va/buildVaDocuments';
import { VA_INSTITUTION_REGISTRY } from '../virginia/institutionIds';
import {
  auditVirginiaSourceEquivalencyConditions,
} from './virginiaTransferEquivalencyConditions';
import {
  _evaluateTemplate,
  auditVirginiaProjectionEquivalencyConditions,
} from './transferCreditRate';

const SERVER = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(
  SERVER,
  '.va-catalogs/research/virginia-tech-csc222-java-sources',
);
const FILES = {
  nova_schedule: 'nova-csc222-fall-2026.html',
  new_river_schedule: 'new-river-csc222-fall-2026.html',
  new_river_staffing_posting: 'new-river-csc222-java-staffing-posting.html',
  vccs_robots: 'courses-vccs-robots.txt',
  new_river_robots: 'new-river-robots.txt',
};
const URLS = {
  nova_schedule: NOVA_URL,
  new_river_schedule: NEW_RIVER_SCHEDULE_URL,
  new_river_staffing_posting: NEW_RIVER_POSTING_URL,
  vccs_robots: VCCS_ROBOTS_URL,
  new_river_robots: NEW_RIVER_ROBOTS_URL,
};
const CONTENT_TYPES = {
  nova_schedule: 'text/html; charset=UTF-8',
  new_river_schedule: 'text/html; charset=UTF-8',
  new_river_staffing_posting: 'text/html; charset=UTF-8',
  vccs_robots: 'text/plain',
  new_river_robots: 'text/plain; charset=utf-8',
};

function retainedSources() {
  return Object.fromEntries(Object.entries(FILES).map(([name, file]) => [name, {
    body: fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'),
    requestedUrl: URLS[name],
    finalUrl: URLS[name],
    contentType: CONTENT_TYPES[name],
    status: 200,
  }]));
}

const OFFERED_BY = [
  'Blue Ridge Community College',
  'Brightpoint Community College',
  'Danville Community College',
  'Eastern Shore Community College',
  'Germanna Community College',
  'J Sargeant Reynolds Community College',
  'Laurel Ridge Community College',
  'New River Community College',
  'Northern Virginia Community College',
  'Patrick & Henry Community College',
  'Paul D. Camp Community College',
  'Piedmont Virginia Community College',
  'Rappahannock Community College',
  'Richard Bland College',
  'Southwest Virginia Community College',
  'Tidewater Community College',
  'Virginia Highlands Community College',
  'Virginia Peninsula Community College',
  'Virginia Western Community College',
  'Wytheville Community College',
];

function csc222Projection() {
  const plan = cachedAcceptedSourcePlan();
  const asDegrees = plan.documents.filter((document) => document.kind === 'as_degree');
  const degree = plan.documents.find((document) => (
    document._id
      === 'va:degree:virginia-polytechnic-institute-and-state-university:cs'
  ));
  const ids = new Set([
    ...asDegrees.map((document) => {
      const slug = String(document.community_college_id).replace(/^va:cc:/, '');
      return VA_INSTITUTION_REGISTRY.find((row) => row.slug === slug)?.id;
    }),
    9230,
  ]);
  const institutions = VA_INSTITUTION_REGISTRY.filter((row) => ids.has(row.id)).map((row) => ({
    _id: `va:${row.level === 'four_year' ? 'uni' : 'cc'}:${row.slug}`,
    level: row.level,
    name: row.name,
  }));
  return buildProjection({
    courses: [{
      course_id: CSC222_ID,
      course_key: 'va:CSC222',
      code: 'CSC222',
      title: 'Object-Oriented Programming',
      credits: 4,
      source_url:
        'https://www.transfervirginia.org/course/D37A6A9C1F9411F082AC0242AC15010A',
      offered_by: OFFERED_BY,
      articulates_to: [{
        institution: 'Virginia Polytechnic Institute and State University',
        identifier: 'CS1114',
        name: 'Intro to Software Design',
        notes:
          'If taught in a language other than Java, please see your VT advisor. Elective Elective equivalent credit hours varies based on transfer course.',
      }],
    }],
    degrees: [degree],
    asDegrees,
    institutions,
  });
}

function cellContext(projection, collegeId) {
  return {
    agreement: projection.agreements.find((row) => (
      row.uc_school_id === 9230 && row.community_college_id === collegeId
    )),
    associate: projection.asDegrees.find((row) => row.community_college_id === collegeId),
    bachelor: projection.degrees.find((row) => row.school_id === 9230),
  };
}

function sourceAudit(projection, collegeId, associateOverride = null) {
  const { agreement, associate, bachelor } = cellContext(projection, collegeId);
  return auditVirginiaSourceEquivalencyConditions([agreement], {
    degreeCourseSet: new Set([CSC222_ID]),
    bachelorDocument: bachelor,
    associateDocument: associateOverride || associate,
    unitsById: new Map([[CSC222_ID, 4]]),
    figureModel: 'complete_degree_path',
    requireVirginiaChannels: true,
  });
}

describe('Virginia Tech exact current CSC 222 Java evidence', () => {
  it('rebuilds the exact artifact byte-for-byte from retained official responses', () => {
    expect(buildVirginiaTechCsc222JavaEvidence(retainedSources())).toEqual(evidence);
    expect(virginiaTechCsc222JavaEvidenceIssue(evidence)).toBeNull();
    expect(evidence).toMatchObject({
      facts: {
        catalog_window: 'Fall 2026',
        colleges: {
          9311: {
            evidence_scope: 'non_resolving_current_context',
            resolution_status: 'fail_closed',
            scheduled_sections: [{ section: 'CSC 222-35' }],
            separate_staffing_posting: {
              course_language_statement: 'CSC 222 - Object Oriented Programming (Java)',
            },
          },
          9312: {
            evidence_scope: 'exact_current_sections',
            java_sections: [
              { class_number: '83026', section: 'CSC 222-001L', language: 'Java' },
              { class_number: '83030', section: 'CSC 222-002L', language: 'Java' },
              { class_number: '84421', section: 'CSC 222-040L', language: 'Java' },
            ],
          },
        },
      },
      paper_interpretation: {
        figures: ['3', '4'],
        method: 'optimistic_best_case_exact_current_section_language',
        resolved_community_college_ids: [9312],
        non_resolving_context_community_college_ids: [9311],
        statewide_language_inferred: false,
        unlisted_colleges_resolved: false,
        figure_6_resolved: false,
      },
    });
    expect(evidence.facts.colleges[9311]).not.toHaveProperty('java_sections');
    expect(evidence.facts.colleges[9311].scheduled_sections[0])
      .not.toHaveProperty('language');
  });

  it.each([
    ['NOVA language', 'nova_schedule', 'This class will be taught with Java.', 'This class will be taught with C++.'],
    ['NOVA term', 'nova_schedule', 'Fall 2026', 'Fall 2027'],
    ['New River section', 'new_river_schedule', 'CSC 222-35', 'CSC 222-36'],
    ['New River staffing statement', 'new_river_staffing_posting', 'Object Oriented Programming (Java)', 'Object Oriented Programming (C++)'],
    ['New River posting status', 'new_river_staffing_posting', '<p>Open</p>', '<p>Closed</p>'],
  ])('fails closed when the retained official %s source mutates', (
    _label,
    sourceName,
    before,
    after,
  ) => {
    const sources = retainedSources();
    sources[sourceName].body = sources[sourceName].body.split(before).join(after);
    expect(() => buildVirginiaTechCsc222JavaEvidence(sources)).toThrow(/did not verify/);
  });

  it('fails closed on robots or self-consistent-looking artifact mutations', () => {
    const robots = retainedSources();
    robots.vccs_robots.body += '\nUser-agent: *\nDisallow: /colleges/nova/\n';
    expect(() => buildVirginiaTechCsc222JavaEvidence(robots)).toThrow(/robots/i);

    const sourceHash = structuredClone(evidence);
    sourceHash.sources.nova_schedule.response_sha256 = '0'.repeat(64);
    expect(virginiaTechCsc222JavaEvidenceIssue(sourceHash)).toMatch(/source receipt/i);

    const interpretation = structuredClone(evidence);
    interpretation.paper_interpretation.unlisted_colleges_resolved = true;
    expect(virginiaTechCsc222JavaEvidenceIssue(interpretation)).toMatch(/interpretation/i);
  });

  it('clears only NOVA in the 19-cell Virginia Tech projection', () => {
    const projection = csc222Projection();
    const report = auditVirginiaProjectionEquivalencyConditions(projection, {
      expectedAssociateDegrees: 19,
      expectedBachelorDegrees: 1,
      expectedCells: 19,
    });
    const csc222Blocked = report.blocked_cells.filter((cell) => (
      cell.blocking_conditions.some((row) => row.sending_code === 'CSC222')
    ));
    expect(csc222Blocked.map((cell) => cell.community_college_id).sort((a, b) => a - b))
      .toEqual([
        9301, 9302, 9303, 9306, 9307, 9308, 9311, 9314, 9315, 9319, 9320, 9321, 9322,
        9323, 9324,
      ]);
    const resolved = report.resolved_condition_cells.filter((cell) => (
      cell.advisory_conditions.some((row) => (
        row.condition_kind === 'exact_vt_csc222_java_split_credit_resolved'
      ))
    ));
    expect(resolved.map((cell) => cell.community_college_id).sort((a, b) => a - b))
      .toEqual([9312]);
  });

  it('keeps New River applicable but fail-closed without synthesizing a section language', () => {
    const projection = csc222Projection();
    const { agreement, associate } = cellContext(projection, 9311);
    const row = agreement.selected_equivalencies.find((entry) => (
      entry.sending_code === 'CSC222'
    ));
    expect(() => resolveVirginiaTechCsc222JavaEvidence({
      agreement,
      row,
      associateDocument: associate,
      figureModel: 'complete_degree_path',
    })).not.toThrow();
    expect(resolveVirginiaTechCsc222JavaEvidence({
      agreement,
      row,
      associateDocument: associate,
      figureModel: 'complete_degree_path',
    })).toEqual({
      applicable: true,
      ready: false,
      reason: 'no exact current official section-language binding is retained for this college',
    });
  });

  it('uses the same fail-closed gate at runtime and preserves exact 3+1 accounting', () => {
    const projection = csc222Projection();
    for (const collegeId of [9312]) {
      const context = cellContext(projection, collegeId);
      const audit = sourceAudit(projection, collegeId);
      expect(audit).toMatchObject({
        ready: true,
        blocking_conditions: [],
        advisory_conditions: [{
          sending_code: 'CSC222',
          condition_kind: 'exact_vt_csc222_java_split_credit_resolved',
          resolution: {
            rule: RULE,
            sending_units: 4,
            named_receiving_units: 3,
            elective_receiving_units: 1,
            total_receiving_units: 4,
            residual_elective_credit_supported: true,
          },
        }],
      });
      const evaluated = _evaluateTemplate(
        context.bachelor,
        [context.agreement],
        new Set([CSC222_ID]),
        new Map([[CSC222_ID, 4]]),
        'semester',
        'semester',
        true,
        { associateDocument: context.associate },
      );
      expect(evaluated).toMatchObject({
        directAppliedUnits: 3,
        lowerDirectAppliedUnits: 3,
        sourceBoundApplicationIssues: [],
      });
      expect(evaluated.directIds).toEqual(new Set([CSC222_ID]));
    }

    for (const collegeId of [9301, 9306, 9307, 9308, 9311, 9315, 9319, 9320, 9322, 9324]) {
      expect(sourceAudit(projection, collegeId)).toMatchObject({
        ready: false,
        blocking_conditions: [{
          sending_code: 'CSC222',
          condition_kind: 'advisor_or_approval_condition',
        }],
      });
    }
  });

  it('fails closed on artifact, selected-source, or associate-tree mutation', () => {
    const projection = csc222Projection();
    const { agreement, associate } = cellContext(projection, 9312);
    const row = agreement.selected_equivalencies.find((entry) => entry.sending_code === 'CSC222');

    const artifactMutation = structuredClone(evidence);
    artifactMutation.sources.nova_schedule.response_sha256 = '0'.repeat(64);
    expect(resolveVirginiaTechCsc222JavaEvidence({
      agreement,
      row,
      associateDocument: associate,
      figureModel: 'complete_degree_path',
      evidenceOverride: artifactMutation,
    })).toMatchObject({ applicable: true, ready: false });

    const selectedMutation = structuredClone(row);
    selectedMutation.source_receiving_name = 'Changed receiver';
    expect(resolveVirginiaTechCsc222JavaEvidence({
      agreement,
      row: selectedMutation,
      associateDocument: associate,
      figureModel: 'complete_degree_path',
    })).toMatchObject({ applicable: false, ready: false });

    const treeMutation = structuredClone(associate);
    treeMutation.requirement_groups[0].label_seen += ' changed';
    expect(sourceAudit(projection, 9312, treeMutation)).toMatchObject({
      ready: false,
      blocking_conditions: [{
        sending_code: 'CSC222',
        condition_kind: 'advisor_or_approval_condition',
      }],
    });
  });
});
