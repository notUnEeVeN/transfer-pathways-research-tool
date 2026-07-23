/**
 * The briefing a researcher hands to whichever AI they like alongside a UC
 * campus's four-year graduation-requirement template.
 *
 * The rules below are the ones the server actually enforces on save
 * (validateDegreeIdentity in server/controllers/CanonicalData.js) plus the
 * structure the graduation-coverage engine reads. If a rule changes there,
 * change it here — a briefing that promises something the validator rejects is
 * worse than no briefing, because the failure surfaces only after the model has
 * rewritten the document.
 */

const RULES = `## What this document is

One UC campus's hand-gathered four-year graduation-requirement template for a
single major — the full bachelor's degree requirement set (major preparation,
breadth, and university-only work) that the graduation-coverage numbers measure a
transfer student's courses against.

Requirements nest, mirroring how transfer agreements are stored so the coverage
engine can read this document directly:

    requirement_groups[]   a heading — "Lower-division major preparation", "Breadth"
      └─ sections[]        a rule within it — "complete all of", "complete 1 of"
           └─ receivers[]  one requirement slot, each with a "receiving" target:
                receiving.kind = "course"      a specific university course (by parent_id)
                receiving.kind = "ge_area"     a breadth/GE area to satisfy
                receiving.kind = "requirement" work completed at the university

A section's section_advisement is how many of its receivers must be satisfied
("complete 1 of the following" = 1). A group's tier / a section's tier is
"transferable" for lower-division work a community-college student can complete
before transfer, "nontransferable" for upper-division / at-the-university work.

## Hard rules the server enforces on save

- Identity is fixed. Never change _id, legacy_id, kind, institution_id,
  school_id, major_slug, or program. _id must stay "degree:<school_id>:<major_slug>",
  institution_id "uc:<school_id>", and program must stay the exact configured
  program string for this major at this campus.
- Never change source ("hand_curated_degree") or any other provenance field.
  Preserve everything you are not changing byte-for-byte.
- The editable content is total_units, source_url, and requirement_groups.
- Course receivers may only reference numeric university course ids
  (receiving.parent_id) from the catalog below. Never invent an id; if the
  catalog lacks a course the printed requirements name, leave it out and say so
  rather than guessing.
- Never invent, rewrite, or remove a verification note (verification_notes) or
  any other user-authored prose.

## What to return

The complete document as JSON, and nothing else — no commentary before or
after, no markdown fence. It gets pasted straight back in.`;

const CREATE_INTRO = `This campus has no template for this major yet. Build one from the campus's
official four-year requirements: the scaffold below already carries the correct
identity fields (campus, major, program), and you fill in total_units,
source_url, and requirement_groups.`;

/** `id | CODE | title | units` — the only university course ids that may be referenced. */
export function universityCatalogLines(courses = []) {
  return courses
    .filter((c) => c && c.course_id != null)
    .map((c) => [
      c.course_id,
      [c.prefix, c.number].filter(Boolean).join(' ').trim(),
      c.title || '',
      c.units != null ? `${c.units}u` : '',
    ].join(' | '))
    .join('\n');
}

/**
 * The full briefing: the rules, the campus's university-course catalog, and the
 * document as it stands. Self-contained on purpose — a researcher pastes this
 * into a fresh chat that has no other context.
 */
export function buildDegreeContext({ doc, courses = [], mode = 'edit', campusName = null }) {
  const creating = mode === 'create';
  const catalog = universityCatalogLines(courses);
  const heading = creating
    ? '# Creating a four-year graduation-requirement template'
    : '# Correcting a four-year graduation-requirement template';
  const closing = creating
    ? 'Paste the campus\'s official requirement text for this major, then return the complete document.'
    : 'Tell me what you want changed, then return the complete corrected document.';
  return [
    heading,
    '',
    ...(campusName ? [`Campus: ${campusName}`, ''] : []),
    ...(creating ? [CREATE_INTRO, ''] : []),
    RULES,
    '',
    '## The campus\'s university course catalog (id | code | title | units)',
    '',
    catalog || '(no university courses on file for this campus)',
    '',
    creating ? '## The scaffold to fill in' : '## The document as it stands',
    '',
    '```json',
    JSON.stringify(doc, null, 2),
    '```',
    '',
    closing,
  ].join('\n');
}
