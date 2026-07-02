// Pure formatting helpers + constants for the internal audit console.

// Field-name-preserving accessor. Verdict / template rows carry the
// system-specific school fields (currently just uc_school + uc_school_id).
// When CSU is re-introduced, add `?? e?.csu_school` back here.
export const schoolNameOf = (e) => e?.school ?? e?.uc_school ?? ''

export const DEFAULT_FILTER = { scope: 'all', schoolIds: [], majorContains: '', groupingId: null }

export const TAB_OPTIONS = [
  { value: 'verify', label: 'Verify' },
  { value: 'errors', label: 'Errors' },
  { value: 'conservative', label: 'Conservative' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'stale', label: 'Stale' },
  { value: 'templates', label: 'Templates' }
]

// Badge tone for a verdict tier (used by the Stale queue's "was X" chip).
export const priorBadgeVariant = (r) =>
  r === 'error' ? 'danger' : r === 'conservative' ? 'warning' : r === 'flagged' ? 'neutral' : 'success'

// Human description of the active filter for the page header / stats hint.
export function describeFilter(filter, activeGrouping) {
  if (filter?.groupingId) {
    if (activeGrouping?.name) {
      return `grouping: ${activeGrouping.name} (${activeGrouping.member_count} pairs)`
    }
    return 'custom grouping'
  }
  if (!filter || (!filter.schoolIds.length && !filter.majorContains)) {
    return 'all UC majors'
  }
  const bits = []
  if (filter.schoolIds.length) bits.push(`${filter.schoolIds.length} school${filter.schoolIds.length === 1 ? '' : 's'}`)
  if (filter.majorContains) bits.push(`major ~ "${filter.majorContains}"`)
  return bits.join(' · ')
}

// Open (or reuse) a single side window pointed at an ASSIST.org agreement.
// `onlyIfOpen` follows the active doc in an ALREADY-open popup without opening
// one (or stealing focus) — the web replacement for the desktop tool's docked
// webview staying in sync as the auditor advances.
let _assistWin = null
export function openAssist(url, { onlyIfOpen = false } = {}) {
  if (!url) return
  if (_assistWin && !_assistWin.closed) {
    try {
      _assistWin.location.href = url
      if (!onlyIfOpen) _assistWin.focus()
      return
    } catch {
      _assistWin = null
    }
  }
  if (onlyIfOpen) return
  const w = Math.min(900, Math.floor(screen.availWidth * 0.5))
  const h = Math.min(900, Math.floor(screen.availHeight * 0.92))
  const left = Math.max(0, screen.availWidth - w - 20)
  _assistWin = window.open(url, 'pmt-assist', `width=${w},height=${h},left=${left},top=20`)
}
