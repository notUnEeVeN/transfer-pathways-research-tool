import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseGuide, receivingSkeleton } from './parseGuide';

// A real guide page (Montgomery College -> Capitol Technology University,
// Computer Science B.S.), trimmed only by capping each alternatives dialog at
// three courses and stripping SVG/attribute noise. Every distinct rendering
// shape survives, so this tests ARTSYS's actual markup rather than a synthetic
// approximation of it.
const FIXTURE = path.resolve(__dirname, '../../test/fixtures/artsys/guide-3354-montgomery.html');

let parsed;
beforeAll(() => {
  parsed = parseGuide(fs.readFileSync(FIXTURE, 'utf8'), { guideId: 3354 });
});

describe('parseGuide', () => {
  it('reads the guide identity', () => {
    expect(parsed.program).toBe('Computer Science, B.S.');
    expect(parsed.receiving_institution).toBe('Capitol Technology University');
    expect(parsed.effective).toBe('Fall, 2025 - Spring, 2029');
  });

  it('reads which college the page was rendered for, and all 16 senders', () => {
    expect(parsed.sender).toEqual({ artsys_id: 1768, name: 'Montgomery College' });
    expect(parsed.senders).toHaveLength(16);
    expect(parsed.senders.map((s) => s.artsys_id)).toContain(1725); // Allegany
  });

  it('parses the requirement tree', () => {
    expect(parsed.stats.groups).toBe(6);
    expect(parsed.stats.receivers).toBe(29);
  });

  // Absence is the measurement. If this ever silently becomes 0 the corpus
  // still imports, but every gap disappears and every college looks complete.
  it('records not-articulated receivers', () => {
    expect(parsed.stats.not_articulated).toBe(6);
  });

  // Every leaf must land in a known sender rendering. `unknown` means ARTSYS
  // introduced a sixth shape and the parser is guessing.
  it('leaves no sender-side rendering unclassified', () => {
    expect(parsed.stats.unknown_sender_state).toBe(0);
  });

  it('leaves no group header unmatched', () => {
    expect(parsed.stats.unmatched_header).toBe(0);
  });

  const receivers = () => parsed.groups.flatMap((g) => g.sections.flatMap((s) => s.receivers));

  it('handles the single-equivalent rendering (empty AJAX dialog)', () => {
    // CS120's only equivalent is CSMC140. The dialog body is empty until
    // clicked, so reading the dialog rather than the visible button yields
    // zero options and turns a satisfied requirement into a false gap.
    const r = receivers().find((x) => x.receiving.code === 'CS120');
    expect(r.status).toBe('articulated');
    expect(r.options).toHaveLength(1);
    expect(r.options[0].courses[0].code).toBe('CSMC140');
  });

  it('handles the N-equivalents rendering', () => {
    const r = receivers().find((x) => x.receiving.code === 'MA124');
    expect(r.status).toBe('articulated');
    expect(r.options.map((o) => o.courses[0].code).sort()).toEqual(['CMSC207', 'CS256']);
  });

  it('handles the no-equivalency rendering', () => {
    const r = receivers().find((x) => x.receiving.code === 'DS235');
    expect(r.status).toBe('not_articulated');
    expect(r.options).toEqual([]);
  });

  it('handles the category-slot rendering', () => {
    const r = receivers().find((x) => x.receiving.kind === 'category');
    expect(r).toBeTruthy();
    expect(r.slot).toBe('category');
    expect(r.receiving.code).toBeNull();
    expect(r.options.length).toBeGreaterThan(0);
  });

  it('reads both branch conjunctions', () => {
    const conjunctions = new Set(parsed.groups.flatMap((g) => g.sections.map((s) => s.conjunction)));
    expect(conjunctions).toEqual(new Set(['and', 'or']));
  });

  it('carries receiving-course units', () => {
    const r = receivers().find((x) => x.receiving.code === 'MA261');
    expect(r.receiving.units).toBe(4);
  });

  it('captures ARTSYS course and equivalency ids where present', () => {
    const r = receivers().find((x) => x.receiving.code === 'CS120');
    expect(r.receiving.artsys_course_id).toBeGreaterThan(0);
    expect(r.options[0].artsys_equivalency_id).toBeGreaterThan(0);
  });
});

describe('receivingSkeleton', () => {
  // The importer's whole-corpus validator: a guide's receiving structure does
  // not depend on which college is selected, so 16 renderings must agree.
  it('ignores the sending side', () => {
    const html = fs.readFileSync(FIXTURE, 'utf8');
    const a = parseGuide(html, { guideId: 3354 });
    const stripped = html.replace(/CSMC140/g, 'ZZZZ999');
    const b = parseGuide(stripped, { guideId: 3354 });
    expect(receivingSkeleton(b)).toBe(receivingSkeleton(a));
  });

  it('changes when a receiving requirement changes', () => {
    const html = fs.readFileSync(FIXTURE, 'utf8');
    const a = parseGuide(html, { guideId: 3354 });
    // replaceAll, not replace: the first occurrence of a receiving course name
    // is inside an alternatives dialog ("…are equivalent to MA124 … at the
    // Sending institution"), so a single replacement leaves the actual
    // receiving-course button untouched and the skeleton unchanged.
    const b = parseGuide(html.replaceAll('MA124 - Discrete Mathematics', 'MA125 - Something Else'), { guideId: 3354 });
    expect(receivingSkeleton(b)).not.toBe(receivingSkeleton(a));
  });
});

// Regression: ARTSYS nests an orbranch inside an andbranch to say "complete
// A..J and one of X/Y/Z". A branch that swept up its descendants' leaves both
// double-counted those receivers and folded three alternatives into the
// required set, reading the group as 14 against a stated 11.
describe('nested branches', () => {
  it('gives each branch only the leaves it owns', () => {
    const group = parsed.groups[0];
    expect(group.sections.map((s) => [s.conjunction, s.receivers.length]))
      .toEqual([['and', 10], ['or', 3]]);
  });

  it('counts every receiver exactly once', () => {
    const labels = parsed.groups.flatMap((g) => g.sections.flatMap((s) => s.receivers.map((r) => r.receiving.label)));
    expect(labels).toHaveLength(29);
    expect(new Set(labels).size).toBe(29);
  });

  // The header states 11; the tree supplies 10 required + 1 chosen = 11.
  it('supplies exactly the course count its header states', () => {
    expect(parsed.stats.count_mismatch).toBe(0);
    expect(parsed.count_mismatches).toEqual([]);
  });
});

// Shapes found only by running the parser over the whole cached corpus and
// insisting the stated-count cross-check reach zero. Each of these was silently
// wrong before: orphan leaves were dropped entirely, and Subject slots fell
// through to `unknown` and lost their gap signal.
describe('leaf shapes found by whole-corpus validation', () => {
  const guideWith = (marker) => {
    // Build a minimal group carrying the shape under test.
    const wrap = (inner) => `<html><body><main><h1>X</h1>
      <select id="sender_university_id"><option value="/program_transfer_guides/1?sender_university_id=9" selected>C</option></select>
      <ul><li class="ptg-requirement-container">
        <div class="req-header">Group Take 1 course 3 credits</div>
        <div class="reqs-container">${inner}</div>
      </li></ul></main></body></html>`;
    return wrap(marker);
  };

  const leaf = (senderInner) => `<div class="leaf-item"><div>
      <div class="sender-course">${senderInner}</div>
      <div class="receiving-course"><div data-content-loader-modal-url="/equivalencies/courses/7"><button>RC101 - Thing</button></div><div class="course-credits">3 credits</div></div>
    </div></div>`;

  it('reads leaves that sit outside any branch', () => {
    const html = guideWith(leaf('<div><button>No equivalency found.</button></div>'));
    const p = parseGuide(html, { guideId: 1 });
    expect(p.stats.receivers).toBe(1);
    expect(p.groups[0].sections[0].implicit).toBe(true);
    expect(p.groups[0].sections[0].receivers[0].status).toBe('not_articulated');
  });

  it('treats a Subject slot like a Requirement slot', () => {
    const html = guideWith(leaf(
      '<div data-controller="modal"><button>ANCS Ancient Studies</button>'
      + '<dialog><div class="dialog-modal-body">No courses found for this Subject at the Sending institution</div></dialog></div>'
    ));
    const p = parseGuide(html, { guideId: 1 });
    const r = p.groups[0].sections[0].receivers[0];
    expect(r.status).toBe('not_articulated');
    expect(r.slot).toBe('category');
    expect(p.stats.unknown_sender_state).toBe(0);
  });

  it('reads a populated Subject slot', () => {
    const html = guideWith(leaf(
      '<div data-controller="modal"><button>HIST History</button>'
      + '<dialog><div class="dialog-modal-body">2 Courses for this Subject at the Sending institution'
      + '<div data-content-loader-modal-url="/equivalencies/1"><button>H1 - One</button></div>'
      + '<div data-content-loader-modal-url="/equivalencies/2"><button>H2 - Two</button></div>'
      + '</div></dialog></div>'
    ));
    const p = parseGuide(html, { guideId: 1 });
    const r = p.groups[0].sections[0].receivers[0];
    expect(r.status).toBe('articulated');
    expect(r.options).toHaveLength(2);
  });
});
