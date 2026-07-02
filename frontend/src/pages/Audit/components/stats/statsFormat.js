// Number formatting for the audit stats panel. Kept out of the JSX so the
// components below stay declarative.

/**
 * Compact integer format — shrinks long totals into `~120K` / `~3.98M`
 * shape so values don't truncate. The `~` signals approximation; call sites
 * that need exact values still use `toLocaleString()`.
 *   < 10,000   → comma-formatted as-is
 *   10K–999K   → `~120K`
 *   ≥ 1M       → `~3.98M`
 */
export function compactNum(n) {
  if (n == null) return '—'
  if (n >= 1e6) return `~${(n / 1e6).toFixed(2)}M`
  if (n >= 1e4) return `~${Math.round(n / 1e3)}K`
  return n.toLocaleString()
}

/**
 * Smart percent format — keeps 2 significant figures, so e.g. 3 / 120000
 * renders as "0.0025%" instead of being rounded to "0%". Used for any
 * coverage / progress ratio.
 */
export function smartPct(n, total) {
  if (!total || !n) return '0%'
  const pct = (n / total) * 100
  if (pct >= 10) return Math.round(pct) + '%'
  if (pct >= 1) return pct.toFixed(1) + '%'
  if (pct >= 0.1) return pct.toFixed(2) + '%'
  if (pct >= 0.01) return pct.toFixed(3) + '%'
  return pct.toFixed(4) + '%'
}

// Wilson upper-bound display: `≤ 0.82%` or an em dash when there's no sample.
export const bound = (pct) => (pct != null ? `≤ ${pct.toFixed(2)}%` : '—')

// Plain integer, comma-grouped, em dash for null.
export const int = (n) => (n == null ? '—' : n.toLocaleString())
