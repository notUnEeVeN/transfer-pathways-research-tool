/**
 * The join: two panes' cells, matched by key, differenced.
 *
 * A cell is `{ rowKey, rowLabel, colKey, colLabel, value }`, produced by the
 * figure's own `comparable.cells` adapter — which may only call functions the
 * figure module exports. That constraint is what makes the difference shown
 * here the same number the figure shows, by construction rather than by
 * convention: there is no second reading of the data anywhere.
 *
 * `dropped` is reported, never hidden. A cell present in one pane and absent
 * in the other is a real finding (a pair one corpus studied and the other did
 * not), and a join that silently discarded it would understate disagreement.
 */

const keyOf = (cell) => `${cell.rowKey}|${cell.colKey}`

/**
 * @param baseline  cells of the pane being compared AGAINST
 * @param subject   cells of the pane being compared
 * @returns { cells, matched, agreeing, dropped, meanDelta, maxAbsDelta, maxCell, rows, columns }
 */
export function joinCells(baseline, subject, { tolerance = 0 } = {}) {
  const base = new Map((baseline || []).map((cell) => [keyOf(cell), cell]))
  const subj = new Map((subject || []).map((cell) => [keyOf(cell), cell]))

  const cells = []
  const deltas = []
  const dropped = []
  const rowLabels = new Map()
  const colLabels = new Map()

  for (const [key, subjectCell] of subj) {
    const baselineCell = base.get(key)
    rowLabels.set(subjectCell.rowKey, subjectCell.rowLabel)
    colLabels.set(subjectCell.colKey, subjectCell.colLabel)
    if (!baselineCell) {
      dropped.push({ key, side: 'baseline', ...subjectCell })
      continue
    }
    // Number(null) is 0 and Number('') is 0, so the raw value must be checked
    // before coercion — an absent cell differenced as zero is a wrong number
    // that looks like agreement.
    const a = typeof baselineCell.value === 'number' ? baselineCell.value : NaN
    const b = typeof subjectCell.value === 'number' ? subjectCell.value : NaN
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      dropped.push({ key, side: 'value', ...subjectCell })
      continue
    }
    const delta = b - a
    deltas.push(delta)
    cells.push({
      key,
      rowKey: subjectCell.rowKey,
      rowLabel: subjectCell.rowLabel,
      colKey: subjectCell.colKey,
      colLabel: subjectCell.colLabel,
      baseline: a,
      subject: b,
      delta,
      agrees: Math.abs(delta) <= tolerance,
    })
  }

  // Cells the baseline has and the subject does not are equally a finding.
  for (const [key, baselineCell] of base) {
    if (subj.has(key)) continue
    dropped.push({ key, side: 'subject', ...baselineCell })
    rowLabels.set(baselineCell.rowKey, baselineCell.rowLabel)
    colLabels.set(baselineCell.colKey, baselineCell.colLabel)
  }

  const abs = deltas.map(Math.abs)
  const maxAbsDelta = abs.length ? Math.max(...abs) : 0
  const maxCell = cells.find((cell) => Math.abs(cell.delta) === maxAbsDelta) || null

  return {
    cells,
    matched: cells.length,
    agreeing: cells.filter((cell) => cell.agrees).length,
    dropped,
    meanDelta: deltas.length ? deltas.reduce((s, d) => s + d, 0) / deltas.length : NaN,
    maxAbsDelta,
    maxCell,
    rows: [...rowLabels.entries()]
      .map(([key, label]) => ({ key, label: label ?? String(key) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    columns: [...colLabels.entries()]
      .map(([key, label]) => ({ key, label: label ?? String(key) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  }
}

/**
 * The snapshot stored as `verdict_at_pin`, and recomputed to detect drift.
 *
 * A join that matched nothing has no verdict to pin — every summary field
 * would be an absence, and storing one would claim a reading that was never
 * taken.
 */
export function verdictOf(join) {
  if (!join || !join.matched) return null
  return {
    matched: join.matched,
    agreeing: join.agreeing,
    dropped: join.dropped.length,
    mean_delta: Number.isFinite(join.meanDelta) ? Number(join.meanDelta.toFixed(3)) : null,
    max_abs_delta: Number(join.maxAbsDelta.toFixed(3)),
    max_cell: join.maxCell ? `${join.maxCell.rowLabel} × ${join.maxCell.colLabel}` : null,
  }
}

/**
 * Has the comparison moved since it was pinned? Coverage with
 * requirements=degree deliberately bypasses the server cache so a template
 * edit lands immediately — which means a note written in August can be
 * contradicted in November by an edit nobody connected to it.
 */
export function verdictDrift(pinned, current) {
  if (!pinned || !current) return null
  const fields = ['matched', 'agreeing', 'dropped', 'mean_delta', 'max_abs_delta', 'max_cell']
  const changes = fields
    .filter((field) => pinned[field] !== current[field])
    .map((field) => ({ field, from: pinned[field], to: current[field] }))
  return changes.length ? changes : null
}
