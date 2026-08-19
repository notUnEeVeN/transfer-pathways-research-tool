/**
 * Structural complexity of one Massachusetts pathway workbook sheet.
 *
 * The recovered workbooks list a curriculum as rows, each carrying an `id`, its
 * `prereqs` and its `coreqs` as id references. That is the same shape
 * curricularanalytics.org ingests, so scoring these rows reproduces the
 * archived repository's score tab — see scripts/ma/complexityCheck.js for the
 * three-source reconciliation with the later final PDF.
 *
 * Two details decide whether the numbers land:
 *
 * 1. **A vertex is a row, not an id.** Seven sheets reuse an id for two
 *    different courses — Bridgewater's resident sheet has id 13 on both
 *    "Organization of Programming Languages (COMP 340)" and "Phys Labs".
 *    Keying vertices by id merges them into one course that inherits the
 *    union of both edge sets, which inflates Bridgewater from its archived
 *    160 to 164. Every listed row is its own vertex; an edge naming an id
 *    that two rows share points at both, which is the only reading available
 *    when the reference is genuinely ambiguous.
 *
 * 2. **Corequisites are edges.** Curricular Analytics treats a corequisite as
 *    a constraint on the term a course may be taken in. Scoring with them
 *    matches 59 of 60 archived score-tab values; scoring without them matches
 *    17. The final-PDF delta matrix is a separate immutable artifact.
 *
 * Edges pointing outside the sheet are dropped, which is what the tool does
 * when a curriculum is uploaded on its own.
 */
const { curricularComplexity } = require('./curricularComplexity');

/**
 * @param {Array<{id: any, prereqs?: any[], coreqs?: any[]}>} rows one sheet
 * @param {{ coreqs?: boolean }} [options]
 * @returns {{ complexity: number, perCourse: Array, delayTotal: number, blockingTotal: number, maxDelay: number }}
 */
function maPathwayGraph(rows, { coreqs = true } = {}) {
  const keys = rows.map((_, index) => String(index));
  const rowsById = new Map();
  rows.forEach((row, index) => {
    const id = String(row.id);
    if (!rowsById.has(id)) rowsById.set(id, []);
    rowsById.get(id).push(String(index));
  });
  const parentsOf = (key) => {
    const row = rows[Number(key)];
    if (!row) return [];
    const edges = [...(row.prereqs || [])];
    if (coreqs) edges.push(...(row.coreqs || []));
    const out = [];
    for (const id of edges) {
      for (const target of rowsById.get(String(id)) || []) if (target !== key) out.push(target);
    }
    return out;
  };
  return { keys, parentsOf };
}

function maPathwayComplexity(rows, options) {
  const { keys, parentsOf } = maPathwayGraph(rows, options);
  return curricularComplexity(keys, parentsOf);
}

module.exports = { maPathwayComplexity, maPathwayGraph };
