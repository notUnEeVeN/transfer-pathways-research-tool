import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assessRolePage,
  hasEverySeedCapture,
  looksLikeRequirements,
  looksLikeRolePage,
  pdfWindowContractHash,
  pdfGet,
  requirementBearingRoles,
  validatePdfPayload,
} from './captureVirginiaCatalogs';

const registry = JSON.parse(fs.readFileSync(
  new URL('../.va-catalogs/institutions.json', import.meta.url),
  'utf8',
));
const reynolds = registry.institutions.find(
  (institution) => institution.slug === 'j-sargeant-reynolds-community-college',
);

const CONFIGURED_PDF_PARSE = {
  program_identity_start_anchor: 'Associate of Science COMPUTER SCIENCE',
  program_identity_anchors: ['Plan Code: 246', 'CIP Code: 11.0701'],
  requirements_start_anchor: 'AS Computer Science (246)',
  requirements_end_anchor: 'COMPUTER SUPPORT SPECIALIST',
  program_pdf_pages: [1, 2],
  program_printed_pages: [265, 266],
};

const CONFIGURED_PDF_TEXT = [
  [
    'Associate of Science COMPUTER SCIENCE',
    'Plan Code:      246',
    'CIP Code:       11.0701',
    'AS Computer Science (246)',
    'Required Courses and Credits',
    `${'Transfer curriculum requirement details. '.repeat(12)}`,
    'ENG 111 College Composition I',
    'MTH 161 Pre-Calculus I',
    'CSC 221 Introduction to Problem Solving and Programming',
    'CSC 222 Object-Oriented Programming',
    '265',
  ].join('\n'),
  [
    'CSC 223 Data Structures and Analysis of Algorithms',
    'CSC 208 Introduction to Discrete Structures',
    'Total Program Credits 61',
    'COMPUTER SUPPORT SPECIALIST',
    'ITE 152 Introduction to Digital and Information Literacy',
    '266',
  ].join('\n'),
].join('\f');

describe('Virginia catalog source-layer capture', () => {
  it('requires course evidence on a program page but accepts prose policy layers', () => {
    const prose = `Graduation requirements ${'students must complete the degree and residency requirements. '.repeat(12)}`;
    expect(looksLikeRequirements(prose)).toBe(false);
    expect(looksLikeRolePage('graduation', prose)).toBe(true);
    expect(looksLikeRolePage('general_education', prose)).toBe(true);
  });

  it('recognizes CleanCatalog course codes printed with hyphens', () => {
    const requirements = `${'Computer Science major requirements. '.repeat(12)}
      CSCI-101 Programming I
      CSCI-102 Programming II
      CSCI-220 Data Structures and Algorithms
      DSA-230 Database Systems`;

    expect(looksLikeRequirements(requirements)).toBe(true);
    expect(assessRolePage('program', requirements).ok).toBe(true);
  });

  it('can apply the requirement-bearing test to a nonstandard major source role', () => {
    const requirements = `${'Program requirements and transfer guidance. '.repeat(12)}
      CSC 221 Programming
      CSC 222 Object-Oriented Programming
      MTH 263 Calculus I
      PHY 241 University Physics I`;

    expect(assessRolePage('program_ba', requirements, { requirementBearing: true }).ok).toBe(true);
    expect(assessRolePage('program_ba', 'Short identity-only source', { requirementBearing: true }).ok).toBe(false);
  });

  it('requires both registry-declared Reynolds program maps before reusing a capture', () => {
    expect([...requirementBearingRoles(reynolds)]).toEqual(['program', 'program_ba']);
    const pages = reynolds.seeds.map((seed) => ({
      role: seed.role,
      requested_url: seed.url,
      final_url: seed.url,
      status: 200,
      bytes_text: 5000,
      has_content: true,
      has_requirements: seed.role === 'program' ? true : null,
    }));
    const cached = { outcome: 'captured', pages };

    expect(hasEverySeedCapture(reynolds, cached)).toBe(false);
    pages.find((page) => page.role === 'program_ba').has_requirements = true;
    expect(hasEverySeedCapture(reynolds, cached)).toBe(true);
  });

  it('does not call a major-only cache complete after layer seeds are added', () => {
    const inst = {
      seeds: [
        { role: 'program', url: 'https://catalog.example.edu/cs-bs/' },
        { role: 'general_education', url: 'https://catalog.example.edu/core/' },
        { role: 'graduation', url: 'https://catalog.example.edu/policies/' },
      ],
    };
    const cached = {
      outcome: 'captured',
      pages: [{
        role: 'program',
        requested_url: inst.seeds[0].url,
        final_url: inst.seeds[0].url,
        status: 200,
        bytes_text: 5000,
        has_requirements: true,
      }],
    };
    expect(hasEverySeedCapture(inst, cached)).toBe(false);
    cached.pages.push({
      role: 'general_education', requested_url: inst.seeds[1].url,
      final_url: inst.seeds[1].url, status: 200, bytes_text: 3000,
    });
    cached.pages.push({
      role: 'graduation', requested_url: inst.seeds[2].url,
      final_url: inst.seeds[2].url, status: 200, bytes_text: 3000,
    });
    expect(hasEverySeedCapture(inst, cached)).toBe(true);
  });

  it('accepts a discovered current program in place of a stale Acalog seed', () => {
    const inst = { seeds: [{ role: 'program', url: 'https://catalog.example.edu/preview_program.php?poid=10' }] };
    const cached = {
      outcome: 'captured',
      pages: [{
        role: 'program',
        requested_url: 'https://catalog.example.edu/preview_program.php?poid=99',
        final_url: 'https://catalog.example.edu/preview_program.php?poid=99&print=1',
        has_requirements: true,
      }],
    };
    expect(hasEverySeedCapture(inst, cached)).toBe(true);
  });

  it('does not save an HTML error response whose URL ends in .pdf', async () => {
    const pagesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'va-pdf-capture-'));
    const html = Buffer.from('<!doctype html><html><body>Catalog temporarily unavailable</body></html>');
    let extracted = false;
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      url: 'https://catalog.invalid/catalog.pdf',
      headers: { get: () => 'text/html; charset=utf-8' },
      arrayBuffer: async () => Uint8Array.from(html).buffer,
    });

    try {
      const result = await pdfGet(
        'https://catalog.invalid/catalog.pdf',
        'invalid-catalog',
        'program',
        {
          fetchImpl,
          pagesDir,
          extractText: () => { extracted = true; return 'should not run'; },
        },
      );

      expect(result).toMatchObject({
        status: 200,
        pdf: null,
        pdf_valid: false,
        content_type: 'text/html; charset=utf-8',
      });
      expect(result.error).toMatch(/does not begin with %PDF/);
      expect(extracted).toBe(false);
      expect(fs.readdirSync(pagesDir)).toEqual([]);
    } finally {
      fs.rmSync(pagesDir, { recursive: true, force: true });
    }
  });

  it('uses the PDF magic bytes instead of trusting the response MIME type', () => {
    expect(validatePdfPayload(Buffer.from('%PDF-1.7\n'), 'application/octet-stream')).toMatchObject({
      ok: true,
      begins_with_pdf_magic: true,
    });
    expect(validatePdfPayload(Buffer.from('<html>not a PDF</html>'), 'application/pdf')).toMatchObject({
      ok: false,
      begins_with_pdf_magic: false,
    });
  });

  it('does not claim a course-rich whole PDF when no CS program window exists', () => {
    const unrelatedCatalog = `${'General catalog policies and descriptions. '.repeat(15)}
      Business Administration Program
      BUS 101 Introduction to Business
      ACC 211 Principles of Accounting
      MTH 263 Calculus I
      PHY 241 University Physics I`;

    const assessment = assessRolePage('program', unrelatedCatalog, {
      transport: 'pdf',
      pdfValid: true,
    });

    expect(assessment.ok).toBe(false);
    expect(assessment.window).toMatchObject({ found: false, text: '' });
    expect(assessment.reason).toMatch(/no Computer Science section/i);
  });

  it('validates a PDF program against its registry-pinned anchors and page evidence', () => {
    const assessment = assessRolePage('program', CONFIGURED_PDF_TEXT, {
      transport: 'pdf',
      pdfValid: true,
      pdfParse: CONFIGURED_PDF_PARSE,
    });

    expect(assessment).toMatchObject({
      ok: true,
      reason: null,
      window: {
        found: true,
        mode: 'configured_anchors',
        start_page: 1,
        end_page: 2,
      },
    });

    const staleContract = assessRolePage('program', CONFIGURED_PDF_TEXT, {
      transport: 'pdf',
      pdfValid: true,
      pdfParse: {
        ...CONFIGURED_PDF_PARSE,
        requirements_end_anchor: 'A NEW END ANCHOR',
      },
    });
    expect(staleContract).toMatchObject({ ok: false, window: { found: false, text: '' } });
    expect(staleContract.reason).toMatch(/requirements_end_anchor not found/i);
  });

  it('recaptures old PDF cache entries that never proved the program window', () => {
    const seed = { role: 'program', url: 'https://catalog.example.edu/catalog.pdf' };
    const inst = { platform: 'pdf', seeds: [seed] };
    const page = {
      role: 'program',
      requested_url: seed.url,
      final_url: seed.url,
      status: 200,
      bytes_text: 50_000,
      has_requirements: true,
    };
    const cached = { outcome: 'captured', pages: [page] };

    expect(hasEverySeedCapture(inst, cached)).toBe(false);
    page.pdf_valid = true;
    expect(hasEverySeedCapture(inst, cached)).toBe(false);
    page.program_window_found = true;
    expect(hasEverySeedCapture(inst, cached)).toBe(true);
  });

  it('recaptures a PDF when its configured window contract changes', () => {
    const seed = { role: 'program', url: 'https://catalog.example.edu/catalog.pdf' };
    const inst = { platform: 'pdf', pdf_parse: CONFIGURED_PDF_PARSE, seeds: [seed] };
    const page = {
      role: 'program',
      requested_url: seed.url,
      final_url: seed.url,
      status: 200,
      bytes_text: 50_000,
      has_requirements: true,
      pdf_valid: true,
      program_window_found: true,
      program_window_contract: pdfWindowContractHash(CONFIGURED_PDF_PARSE),
    };
    const cached = { outcome: 'captured', pages: [page] };

    expect(hasEverySeedCapture(inst, cached)).toBe(true);
    inst.pdf_parse = { ...CONFIGURED_PDF_PARSE, requirements_start_anchor: 'A revised plan title' };
    expect(hasEverySeedCapture(inst, cached)).toBe(false);
  });
});
