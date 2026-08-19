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

const quantile = (sorted, q) => {
  if (!sorted.length) return null
  const position = (sorted.length - 1) * q
  const lower = Math.floor(position)
  const upper = sorted[lower + 1]
  const fraction = position - lower
  return upper == null ? sorted[lower] : sorted[lower] + fraction * (upper - sorted[lower])
}

/**
 * A cross-corpus comparison has no honest cell join. Its valid output is the
 * distribution of each pane's own cells, with the sample size and weighting
 * kept visible. Nulls are omitted rather than coerced to zero.
 */
export function summarizeCells(cells) {
  const numeric = (cells || []).filter((cell) => Number.isFinite(cell?.value))
  const values = numeric.map((cell) => cell.value).sort((a, b) => a - b)
  const rows = new Set(numeric.map((cell) => cell.rowKey))
  const columns = new Set(numeric.map((cell) => cell.colKey))
  if (!values.length) {
    return {
      n: 0, omitted: (cells || []).length, rows: 0, columns: 0,
      mean: null, median: null, q1: null, q3: null, min: null, max: null,
    }
  }
  return {
    n: values.length,
    omitted: (cells || []).length - values.length,
    rows: rows.size,
    columns: columns.size,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: quantile(values, 0.5),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    min: values[0],
    max: values[values.length - 1],
  }
}

const distributionPair = (baseline, subject) => {
  const a = summarizeCells(baseline)
  const b = summarizeCells(subject)
  return {
    baseline: a,
    subject: b,
    meanDelta: a.mean == null || b.mean == null ? null : b.mean - a.mean,
    medianDelta: a.median == null || b.median == null ? null : b.median - a.median,
  }
}

/**
 * Compare two disjoint corpora without inventing institution pairs.
 *
 * The default is the legacy equal-cell population summary. A figure may instead
 * declare that its columns are shared semantic groups (Figure 2's course
 * types, for example). In that case every column gets its own population
 * contrast. A pooled summary is opt-in because unequal category populations
 * otherwise change the apparent state mean merely by changing category mix.
 */
export function compareDistributions(baseline, subject, distribution = {}) {
  if (distribution?.groupBy !== 'column') return distributionPair(baseline, subject)

  const groups = new Map()
  const collect = (cells, side) => {
    for (const cell of cells || []) {
      const key = String(cell?.colKey ?? '')
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          label: cell?.colLabel ?? key,
          baseline: [],
          subject: [],
        })
      }
      groups.get(key)[side].push(cell)
    }
  }
  collect(baseline, 'baseline')
  collect(subject, 'subject')

  const grouped = [...groups.values()].map((group) => ({
    key: group.key,
    label: group.label,
    ...distributionPair(group.baseline, group.subject),
  }))
  return {
    mode: 'grouped',
    groupBy: 'column',
    groupLabel: distribution.label || 'column',
    groups: grouped,
    // An overall equal-cell number is intentionally absent unless the figure
    // contract explicitly asks for one. The receipt labels it as pooled when
    // present, so it can never masquerade as an equal-category statistic.
    overall: distribution.pooled === true ? distributionPair(baseline, subject) : null,
  }
}

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

const round3 = (value) => (Number.isFinite(value) ? Number(value.toFixed(3)) : null)

const pinnableSide = (side) => (side ? {
  n: side.n ?? 0,
  mean: round3(side.mean),
  median: round3(side.median),
} : null)

/**
 * The pinnable reading for a pair with no honest cell join.
 *
 * Cross-state pairs cannot produce `verdictOf` — there are no shared
 * institutions to match — so before this they pinned nothing at all and any
 * later movement in either corpus went unrecorded. What IS stable enough to
 * pin is each side's own population summary and the gap between them, which
 * is exactly the claim the distribution receipt puts on screen.
 *
 * Grouped distributions (Figure 2's course types) pin their overall pair only
 * when the figure contract opted into a pooled number; otherwise the groups
 * are pinned individually so a category-mix change cannot hide inside a single
 * average.
 */
export function distributionVerdictOf(distribution) {
  if (!distribution) return null
  if (distribution.mode === 'grouped') {
    const groups = (distribution.groups || []).map((group) => ({
      key: group.key,
      label: group.label,
      baseline: pinnableSide(group.baseline),
      subject: pinnableSide(group.subject),
      mean_delta: round3(group.meanDelta),
      median_delta: round3(group.medianDelta),
    }))
    if (!groups.length && !distribution.overall) return null
    return {
      mode: 'grouped',
      group_by: distribution.groupBy || null,
      groups,
      ...(distribution.overall ? {
        baseline: pinnableSide(distribution.overall.baseline),
        subject: pinnableSide(distribution.overall.subject),
        mean_delta: round3(distribution.overall.meanDelta),
        median_delta: round3(distribution.overall.medianDelta),
      } : {}),
    }
  }
  if (!distribution.baseline?.n && !distribution.subject?.n) return null
  return {
    mode: 'pair',
    baseline: pinnableSide(distribution.baseline),
    subject: pinnableSide(distribution.subject),
    mean_delta: round3(distribution.meanDelta),
    median_delta: round3(distribution.medianDelta),
  }
}

/**
 * What this comparison should pin: the cell join where one exists, and the
 * population contrast where one honestly cannot.
 */
export function pinnableVerdict(join, distribution) {
  const verdict = verdictOf(join)
  if (verdict) return verdict
  const summary = distributionVerdictOf(distribution)
  return summary ? { distribution: summary } : null
}

/**
 * Has the comparison moved since it was pinned? Coverage with
 * requirements=degree deliberately bypasses the server cache so a template
 * edit lands immediately — which means a note written in August can be
 * contradicted in November by an edit nobody connected to it.
 */
export function verdictDrift(pinned, current) {
  if (!pinned || !current) return null
  if (pinned.distribution || current.distribution) {
    return distributionDrift(pinned.distribution, current.distribution)
  }
  const fields = ['matched', 'agreeing', 'dropped', 'mean_delta', 'max_abs_delta', 'max_cell']
  const changes = fields
    .filter((field) => pinned[field] !== current[field])
    .map((field) => ({ field, from: pinned[field], to: current[field] }))
  return changes.length ? changes : null
}

// A pinned distribution and a pinned join are different claims, so a pair that
// gained or lost its join has moved in the way that matters most.
function distributionDrift(pinned, current) {
  if (!pinned || !current) {
    return [{ field: 'comparison basis', from: pinned ? 'distribution' : 'cell join', to: current ? 'distribution' : 'cell join' }]
  }
  const sideChanges = (label, from, to) => ['n', 'mean', 'median']
    .filter((field) => (from?.[field] ?? null) !== (to?.[field] ?? null))
    .map((field) => ({ field: `${label} ${field}`, from: from?.[field] ?? null, to: to?.[field] ?? null }))

  if (pinned.mode === 'grouped' || current.mode === 'grouped') {
    const byKey = new Map((current.groups || []).map((group) => [group.key, group]))
    const changes = []
    for (const group of pinned.groups || []) {
      const now = byKey.get(group.key)
      if (!now) {
        changes.push({ field: `${group.label} group`, from: 'present', to: 'absent' })
        continue
      }
      changes.push(
        ...sideChanges(`${group.label} baseline`, group.baseline, now.baseline),
        ...sideChanges(`${group.label} subject`, group.subject, now.subject),
      )
      byKey.delete(group.key)
    }
    for (const group of byKey.values()) {
      changes.push({ field: `${group.label} group`, from: 'absent', to: 'present' })
    }
    return changes.length ? changes : null
  }

  const changes = [
    ...sideChanges('baseline', pinned.baseline, current.baseline),
    ...sideChanges('subject', pinned.subject, current.subject),
    ...['mean_delta', 'median_delta']
      .filter((field) => (pinned[field] ?? null) !== (current[field] ?? null))
      .map((field) => ({ field, from: pinned[field] ?? null, to: current[field] ?? null })),
  ]
  return changes.length ? changes : null
}
