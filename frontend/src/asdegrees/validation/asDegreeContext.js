/**
 * The briefing a researcher hands to whichever AI they like, alongside the
 * document itself.
 *
 * The rules below are the ones the server actually validates on save. If a
 * rule changes there, change it here — a briefing that promises something the
 * validator rejects is worse than no briefing, because the failure surfaces
 * only after the model has rewritten the document.
 */

const RULES = `## What this document is

One associate-degree record, extracted from a California community college's
catalog by an AI and now being checked by a person against the real catalog.

Requirements nest four levels deep, mirroring how transfer agreements are
stored (the pathway engines read these documents directly):

    requirement_groups[]        a catalog heading — "Required Core", "List A"
      └─ sections[]             a rule within it — "complete 2 of the following"
           └─ receivers[]       one requirement slot
                └─ options[]    the ways to satisfy that slot (OR between them)
                     └─ course_ids[]   courses ANDed together within one option

So "MATH 1A or MATH 1AH" is one receiver with two options of one course each.
"PHYS 4A and 4B together" is one receiver with a single option naming both.

A group with no university side (receiving: null) is the ordinary case here —
these are the college's own graduation requirements, not an articulation.

## Hard rules the server enforces on save

- Only these fields may change: status, degree_title_seen, catalog_url,
  catalog_year, unit_system, total_units, requirement_groups.
- Never change or omit: _id, legacy_id, college, degree type, major identity,
  template_ref, verification, covered_concepts, extraction, source, timestamps,
  or any provenance field. Preserve everything you are not changing
  byte-for-byte.
- Every requirement group you add or touch must have source 'curated' and
  confidence null. Reordering counts as touching: every group whose relative
  position changes needs the same treatment.
- group_id matches ^[a-z0-9_]+$ and is unique within the document.
- A document whose status is not 'found' must not carry requirement_groups.
- Course references may only use numeric course ids from the catalog below.
  Never invent an id; if the catalog lacks a course the printed catalog names,
  leave it out and say so rather than guessing.
- course_keys must mirror course_ids as 'cc:<numeric id>'.
- Never invent, rewrite, or remove a verification note or any other
  user-authored prose.

## What to return

The complete corrected document as JSON, and nothing else — no commentary
before or after, no markdown fence. It gets pasted straight back in.`;

const CREATE_INTRO = `This college has no record for this degree slot yet — no record exists yet
to correct. Build one from the printed catalog: the scaffold below already
carries the correct identity fields, and you fill in the rest.`;

/** `id | CODE | title | units` — the only course ids that may be referenced. */
export function courseCatalogLines(courses = []) {
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
 * The full briefing: the rules, the college's course catalog, and the document
 * as it stands. Self-contained on purpose — a researcher pastes this into a
 * fresh chat that has no other context.
 */
export function buildAsDegreeContext({ doc, courses = [], mode = 'edit', collegeName = null }) {
  const creating = mode === 'create';
  const catalog = courseCatalogLines(courses);
  const heading = creating
    ? '# Creating an AS-degree requirement document'
    : '# Correcting an AS-degree requirement document';
  const closing = creating
    ? 'Paste the college\'s catalog text for this degree, then return the complete document.'
    : 'Tell me what you want changed, then return the complete corrected document.';
  return [
    heading,
    '',
    ...(collegeName ? [`College: ${collegeName}`, ''] : []),
    ...(creating ? [CREATE_INTRO, ''] : []),
    RULES,
    '',
    '## The college\'s course catalog (id | code | title | units)',
    '',
    catalog || '(no courses on file for this college)',
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
