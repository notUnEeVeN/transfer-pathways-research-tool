import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  buildCapturedDocument,
  requirementBearingPages,
  requirementBearingRoles,
} from './extractVirginiaRequirements';

const registry = JSON.parse(fs.readFileSync(
  new URL('../.va-catalogs/institutions.json', import.meta.url),
  'utf8',
));
const reynolds = registry.institutions.find(
  (institution) => institution.slug === 'j-sargeant-reynolds-community-college',
);
const camp = registry.institutions.find(
  (institution) => institution.slug === 'paul-d-camp-community-college',
);

const mapText = ({ label, math, total }) => `
Computer Science AS - ${label}
Core Requirements (18cr)
CSC 221: Introduction to Problem Solving and Programming
CSC 222: Object-Oriented Programming
CSC 223: Data Structures and Analysis of Algorithms
CSC 208: Introduction to Discrete Structures
ENG 111: College Composition I
ENG 112: College Composition II
Supporting Requirements
MTH 263: Calculus I
${math}: Destination Mathematics
Program Total: ${total} Credits
`;

const texts = {
  program: mapText({ label: 'B.S. Destination Map', math: 'MTH 264', total: 63 }),
  program_ba: mapText({ label: 'B.A. Destination Map', math: 'MTH 245', total: 62 }),
};

const pageFor = (role) => {
  const seed = reynolds.seeds.find((candidate) => candidate.role === role);
  return {
    role,
    requested_url: seed.url,
    final_url: `${seed.url}${seed.url.includes('?') ? '&' : '?'}print=1`,
    status: 200,
    bytes_text: texts[role].length,
    sha256: `${role}-sha`,
    has_content: true,
    has_requirements: true,
    file: `reynolds__${role}`,
  };
};

const capture = (roles = ['program_ba', 'program']) => ({
  outcome: 'captured',
  captured_at: '2026-08-09T00:00:00.000Z',
  pages: roles.map(pageFor),
  discovery: { title: 'Computer Science AS' },
});

const readFiles = (page) => ({ html: null, text: texts[page.role] });
const codesIn = (tree) => tree.groups.flatMap((group) => group.sections.flatMap(
  (section) => section.rows.flatMap((row) => row.codes.map((course) => course.code)),
));

const campCatalogText = ({ endAnchor = camp.pdf_parse.requirements_end_anchor } = {}) => {
  const pages = Array.from({ length: camp.pdf_parse.program_pdf_pages[1] }, () => '');
  const [firstPdfPage] = camp.pdf_parse.program_pdf_pages;
  pages[firstPdfPage - 1] = [
    camp.pdf_parse.program_identity_start_anchor,
    ...camp.pdf_parse.program_identity_anchors,
    String(camp.pdf_parse.program_printed_pages[0]),
  ].join('\n');
  pages[firstPdfPage] = [
    camp.pdf_parse.requirements_start_anchor,
    'Required Courses and Credits',
    'ENG 111 College Composition I 3',
    'MTH 161 Pre-Calculus I 3',
    'CSC 221 Introduction to Problem Solving and Programming 3',
    'CSC 222 Object-Oriented Programming 4',
    String(camp.pdf_parse.program_printed_pages[0] + 1),
  ].join('\n');
  pages[firstPdfPage + 1] = [
    'CSC 223 Data Structures and Analysis of Algorithms 4',
    'CSC 208 Introduction to Discrete Structures 3',
    'Total Program Credits 61',
    endAnchor,
    'ITE 152 Introduction to Digital and Information Literacy 3',
    String(camp.pdf_parse.program_printed_pages[1]),
  ].join('\n');
  return pages.join('\f');
};

describe('Virginia requirement-bearing program variants', () => {
  it('uses Camp registry anchors during extraction and fails closed when the end anchor disappears', () => {
    const seed = camp.seeds.find((candidate) => candidate.role === 'program');
    const campCapture = {
      outcome: 'captured',
      captured_at: '2026-08-09T00:00:00.000Z',
      pages: [{
        role: 'program',
        requested_url: seed.url,
        final_url: seed.url,
        status: 200,
        bytes_text: 5000,
        sha256: 'camp-program-sha',
        has_content: true,
        has_requirements: true,
        file: 'synthetic-camp-program',
      }],
    };

    const good = buildCapturedDocument(camp, campCapture, {
      readFiles: () => ({ html: null, text: campCatalogText() }),
      extractedAt: '2026-08-09T01:00:00.000Z',
    });
    expect(good).toMatchObject({
      parser: 'pdf',
      source_role: 'program',
      pdf_window: {
        found: true,
        mode: 'configured_anchors',
        start_page: 276,
        end_page: 277,
      },
    });
    expect(good.groups.length).toBeGreaterThan(0);

    const stale = buildCapturedDocument(camp, campCapture, {
      readFiles: () => ({ html: null, text: campCatalogText({ endAnchor: 'A DIFFERENT NEXT PROGRAM' }) }),
      extractedAt: '2026-08-09T01:00:00.000Z',
    });
    expect(stale.pdf_window).toMatchObject({ found: false, lines: 0 });
    expect(stale.pdf_window.reason).toMatch(/requirements_end_anchor not found/i);
    expect(stale.groups).toEqual([]);
    expect(stale.validation.verdict).toBe('fail');
  });

  it('takes required program roles from the registry and restores registry order', () => {
    expect(requirementBearingRoles(reynolds)).toEqual(['program', 'program_ba']);
    expect(requirementBearingPages(reynolds, capture()).map((page) => page.role))
      .toEqual(['program', 'program_ba']);
  });

  it('retains Reynolds B.S. and B.A. maps as separate neutral trees with source-role provenance', () => {
    const doc = buildCapturedDocument(reynolds, capture(), {
      readFiles,
      extractedAt: '2026-08-09T01:00:00.000Z',
    });

    expect(doc.parser).toBe('variant_set');
    expect(doc.groups).toEqual([]);
    expect(doc.total_credits).toBeNull();
    expect(doc.requirement_variants).toMatchObject({
      relationship: null,
      flattened: false,
      selection_rule: null,
      source_roles: ['program', 'program_ba'],
      captured_source_roles: ['program', 'program_ba'],
      missing_source_roles: [],
    });

    const [bs, ba] = doc.requirement_variants.items;
    expect(bs).toMatchObject({ key: 'program', source_role: 'program', source_ref: 'major' });
    expect(ba).toMatchObject({ key: 'program_ba', source_role: 'program_ba', source_ref: 'program_ba' });
    expect(codesIn(bs.tree)).toContain('MTH264');
    expect(codesIn(bs.tree)).not.toContain('MTH245');
    expect(codesIn(ba.tree)).toContain('MTH245');
    expect(codesIn(ba.tree)).not.toContain('MTH264');
    expect(doc.validation.checks[0].source_roles).toEqual(['program', 'program_ba']);
  });

  it('fails closed when one configured Reynolds map is absent', () => {
    const doc = buildCapturedDocument(reynolds, capture(['program']), {
      readFiles,
      extractedAt: '2026-08-09T01:00:00.000Z',
    });

    expect(doc.parser).toBe('variant_set');
    expect(doc.groups).toEqual([]);
    expect(doc.requirement_variants.items).toHaveLength(1);
    expect(doc.requirement_variants.missing_source_roles).toEqual(['program_ba']);
    expect(doc.validation).toMatchObject({ verdict: 'fail', needs_hand_read: true });
  });

  it('keeps the existing root-tree shape for a single configured program role', () => {
    const single = {
      ...reynolds,
      degree_context: {
        ...reynolds.degree_context,
        layers: {
          ...reynolds.degree_context.layers,
          major: { source_roles: ['program'] },
        },
      },
    };
    const doc = buildCapturedDocument(single, capture(['program']), {
      readFiles,
      extractedAt: '2026-08-09T01:00:00.000Z',
    });

    expect(doc.parser).toBe('lines');
    expect(doc.requirement_variants).toBeUndefined();
    expect(doc.groups.length).toBeGreaterThan(0);
    expect(doc).toMatchObject({ source_role: 'program', source_ref: 'major' });
  });
});
