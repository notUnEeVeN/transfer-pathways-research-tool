import { describe, expect, it } from 'vitest';
import {
  buildUniversityScopeEntry,
  exactCodeTokenSeen,
  normalizeCourseCode,
  requiredResidentPathCourseCodes,
  requirementReceiverInventory,
} from './universityPrerequisiteScope';

const composition = {
  catalog_year: '2026-2027',
  requirement_groups: [{
    sections: [{
      receivers: [
        { kind: 'course', code: 'CS 111' },
        { kind: 'series', codes: ['MATH-101', 'MATH 102'] },
        { kind: 'ge_area', name: 'Arts' },
        { kind: 'requirement', name: 'Approved elective' },
      ],
    }],
  }],
};

describe('Virginia receiving-university prerequisite collection scope', () => {
  it('extracts only exact named receiver courses and inventories open receivers', () => {
    expect(requirementReceiverInventory(composition)).toEqual({
      direct_named_course_codes: ['CS111', 'MATH101', 'MATH102'],
      unnamed_receiver_counts: { ge_area: 1, requirement: 1 },
    });
  });

  it('normalizes supported owner-local catalog codes without accepting prose', () => {
    expect(normalizeCourseCode(' CPSC-150L ')).toBe('CPSC150L');
    expect(normalizeCourseCode('choose a CS course')).toBeNull();
  });

  it('keeps deterministic resident-path targets separate from authored direct names', () => {
    expect(requiredResidentPathCourseCodes({
      direct_named_course_codes: ['CMSC160', 'CMSC210'],
      deterministic_resident_path_course_codes: [
        'CMSC360', 'CMSC415', 'CMSC455', 'MATH301', 'PSYC335', 'RELI301', 'SPAN320',
      ],
    })).toEqual([
      'CMSC160', 'CMSC210', 'CMSC360', 'CMSC415', 'CMSC455', 'MATH301',
      'PSYC335', 'RELI301', 'SPAN320',
    ]);
  });

  it('uses code boundaries so discovery evidence does not confuse CS 11 with CS 111', () => {
    expect(exactCodeTokenSeen('Required: CS 111 and MATH-101.', 'CS111')).toBe(true);
    expect(exactCodeTokenSeen('Required: CS 111.', 'CS11')).toBe(false);
  });

  it('labels token hits as discovery evidence and still emits zero contract rows', () => {
    const sourceText = 'CS 111. Introduction. MATH 101. Calculus.';
    const crypto = require('node:crypto');
    const sourceHash = crypto.createHash('sha256').update(sourceText).digest('hex');
    const entry = buildUniversityScopeEntry({
      schoolId: 9201,
      slug: 'fixture-university',
      composition,
      requirements: {
        sources: [{ role: 'course_catalog', url: 'https://catalog.example.edu/courses', sha256: sourceHash }],
      },
      catalogText: sourceText,
    });
    expect(entry).toMatchObject({
      owner_namespace: 'va:uni:9201',
      direct_named_course_count: 3,
      deterministic_resident_path_course_count: 0,
      deterministic_resident_path_course_codes: [],
      deterministic_resident_path_receipt: null,
      checked_in_contract_rows: 0,
      collection_status: 'blocked_pending_owner_scoped_formula_collection',
      cached_course_catalog: {
        byte_match: true,
        exact_code_tokens_seen: ['CS111', 'MATH101'],
        direct_codes_not_seen: ['MATH102'],
      },
    });
    expect(entry.cached_course_catalog.evidence_boundary).toContain('not a parsed course entry');
  });
});
