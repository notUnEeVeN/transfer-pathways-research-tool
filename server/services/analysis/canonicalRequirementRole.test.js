import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalSourceContract } from './canonicalSourceContract';
import {
  CANONICAL_REQUIREMENT_ROLES,
  canonicalRequirementRole,
  canonicalRequirementRoleIssues,
} from './canonicalRequirementRole';
import { compileDegreeComposition } from '../virginia/degreeComposition';

const COMPOSED = path.resolve(__dirname, '../../.va-catalogs/composed');

const exactDocument = (requirementGroups) => ({
  state: 'va',
  analysis_contract: canonicalSourceContract(),
  requirement_groups: requirementGroups,
});

const geReceiver = (code, extras = {}) => ({
  ...extras,
  receiving: { kind: 'ge_area', code },
});

function compiledFourYearDocuments() {
  const documents = [];
  for (const filename of fs.readdirSync(COMPOSED).filter((name) => name.endsWith('.json'))) {
    const raw = JSON.parse(fs.readFileSync(path.join(COMPOSED, filename), 'utf8'));
    try {
      const document = compileDegreeComposition(raw, { institutionLevel: 'four_year' });
      document.analysis_contract = canonicalSourceContract();
      documents.push({ filename, document });
    } catch {
      // The same directory intentionally holds the 19 community-college
      // compositions. They reject the four-year receiver contract.
    }
  }
  return documents;
}

describe('canonical exact-source requirement roles', () => {
  it('does not reinterpret a legacy CA/MA tree without the canonical contract', () => {
    const group = {
      requirement_layer: 'major',
      sections: [{ receivers: [geReceiver('OPEN-MAJOR')] }],
    };
    expect(canonicalRequirementRole({}, group, group.sections[0])).toEqual({
      applies: false,
      exact: false,
      role: null,
      issues: [],
      evidence: null,
    });
  });

  it('uses structured ownership and capacity fields, never labels or prose', () => {
    const cases = [
      [{ requirement_layer: 'major', course_level: 'upper_division', cc_articulable: false },
        {}, CANONICAL_REQUIREMENT_ROLES.NAMED],
      [{ requirement_layer: 'general_education', course_level: 'lower_division_or_category' },
        {}, CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION],
      [{ requirement_layer: 'university_graduation', course_level: 'elective_capacity' },
        {}, CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY],
      [{ requirement_layer: 'major' },
        { unit_advisement: 0, credit_role: 'zero_unit_requirement' },
        CANONICAL_REQUIREMENT_ROLES.ZERO_UNIT],
    ];

    for (const [groupFields, sectionFields, expected] of cases) {
      const group = {
        ...groupFields,
        title: 'General Education elective capacity or anything else',
        sections: [{
          ...sectionFields,
          label_seen: 'Contradictory human prose must not decide this role',
          receivers: [geReceiver('OPEN')],
        }],
      };
      const document = exactDocument([group]);
      expect(canonicalRequirementRole(document, group, group.sections[0]))
        .toMatchObject({ exact: true, role: expected });
    }
  });

  it('fails closed for missing, unknown, or contradictory authored semantics', () => {
    const groups = [
      { sections: [{ receivers: [geReceiver('NO-LAYER')] }] },
      {
        requirement_layer: 'university_graduation',
        course_level: 'any',
        sections: [{ receivers: [geReceiver('UNREFINED')] }],
      },
      {
        requirement_layer: 'major',
        course_level: 'elective_capacity',
        sections: [{
          credit_role: 'ge_certification',
          receivers: [geReceiver('CONFLICT')],
        }],
      },
      {
        requirement_layer: 'major',
        sections: [{
          unit_advisement: 3,
          credit_role: 'zero_unit_requirement',
          receivers: [geReceiver('FALSE-ZERO')],
        }],
      },
    ];
    const document = exactDocument(groups);
    const classifications = groups.map((group) => (
      canonicalRequirementRole(document, group, group.sections[0])
    ));
    expect(classifications.every((entry) => (
      entry.exact === false && entry.role === CANONICAL_REQUIREMENT_ROLES.AMBIGUOUS
    ))).toBe(true);
    expect(canonicalRequirementRoleIssues(document)).toHaveLength(4);
  });

  it('exhaustively classifies all 19 checked-in four-year ge_area contexts', () => {
    const documents = compiledFourYearDocuments();
    expect(documents).toHaveLength(19);
    const rows = [];
    for (const { filename, document } of documents) {
      for (const [groupIndex, group] of document.requirement_groups.entries()) {
        for (const [sectionIndex, section] of group.sections.entries()) {
          const open = section.receivers.filter((receiver) => (
            receiver.receiving?.kind === 'ge_area'
          ));
          if (!open.length) continue;
          const classification = canonicalRequirementRole(document, group, section);
          for (const receiver of open) {
            rows.push({
              filename,
              groupIndex,
              sectionIndex,
              code: receiver.receiving.code,
              role: classification.role,
              exact: classification.exact,
              issues: classification.issues,
            });
          }
        }
      }
    }

    expect(rows).toHaveLength(176);
    expect(new Set(rows.map((row) => (
      `${row.filename}:${row.groupIndex}:${row.sectionIndex}`
    ))).size).toBe(166);
    expect(Object.fromEntries(Object.values(CANONICAL_REQUIREMENT_ROLES).map((role) => [
      role, rows.filter((row) => row.role === role).length,
    ]))).toEqual({
      named_requirement: 16,
      general_education: 149,
      elective_capacity: 10,
      zero_unit_requirement: 0,
      ambiguous: 1,
    });

    const roleFor = (code) => rows.find((row) => row.code === code)?.role;
    expect(roleFor('JMU-CS-ELECTIVE-300')).toBe(CANONICAL_REQUIREMENT_ROLES.NAMED);
    expect(roleFor('CNU-CPSC-500')).toBe(CANONICAL_REQUIREMENT_ROLES.NAMED);
    expect(roleFor('NSU-MATH-300')).toBe(CANONICAL_REQUIREMENT_ROLES.NAMED);
    expect(roleFor('WM-CSCI-GENERAL-UPPER-12')).toBe(CANONICAL_REQUIREMENT_ROLES.NAMED);
    expect(roleFor('JMU-C1CT')).toBe(CANONICAL_REQUIREMENT_ROLES.GENERAL_EDUCATION);
    expect(roleFor('JMU-UNIVERSITY-ELECTIVES'))
      .toBe(CANONICAL_REQUIREMENT_ROLES.ELECTIVE_CAPACITY);

    expect(rows.filter((row) => !row.exact)).toEqual([
      expect.objectContaining({
        code: 'UVAWISE-OPEN-CREDIT',
        role: CANONICAL_REQUIREMENT_ROLES.AMBIGUOUS,
        issues: ['unrefined_university_graduation_role'],
      }),
    ]);
  });
});
