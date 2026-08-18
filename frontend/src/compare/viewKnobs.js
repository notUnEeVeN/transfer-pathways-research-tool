/**
 * A View is the unit of comparison: one figure, rendered for one major, with
 * one pinned set of controls.
 *
 *   { figure, major, knobs, label }
 *
 * Everything the Compare tab does is two Views differing in ONE field — knobs
 * (the same figure's published vs recomputed reading), or major (Computer
 * Science vs Biology, and, because a state rides on its majors, California vs
 * Massachusetts). State is deliberately not a field: it is a property of a
 * major, exactly as it is everywhere else in the console.
 *
 * A figure opts in by declaring `viewKnobs` on its registry entry. Each knob
 * names the `default*` prop the figure already reads, so pinning a control is
 * seeding a prop — the figures stay uncontrolled and no component is
 * refactored. A figure that declares nothing still renders, still saves, and
 * still takes notes; it just shows the reader that nothing was pinned.
 *
 * The fingerprint here is an INDEX, never an identity. A comparison's identity
 * is its slug, minted once and immutable, so a knob rename can never orphan a
 * note. `fingerprintOf` must stay byte-identical to the mirror in
 * server/services/comparisons.js.
 */

// The vocabulary the server already validates for published-figure controls
// (server/services/figures.js validateControls) — reused rather than invented.
export const CONTROL_KEY_RE = /^[a-z][a-z0-9_-]{0,31}$/

const isScalar = (value) => (
  typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number'
)

/** The knobs a figure declares, filtered to those that apply to this major. */
export function knobsFor(analysis, major) {
  const declared = analysis?.viewKnobs
  if (!Array.isArray(declared)) return []
  return declared.filter((knob) => (
    typeof knob?.appliesWhen === 'function' ? Boolean(knob.appliesWhen(major)) : true
  ))
}

/**
 * Split a stored pane's knobs against what the figure currently declares.
 *
 * `stale` is the important half: a pane naming a control the figure no longer
 * has must say so on screen. Silently dropping it would let a meeting exhibit
 * render something other than what the document claims.
 */
export function resolveKnobs(pane, analysis, major) {
  const applicable = knobsFor(analysis, major)
  const byKey = new Map(applicable.map((knob) => [knob.key, knob]))
  const stored = pane?.knobs && typeof pane.knobs === 'object' ? pane.knobs : {}

  const resolved = {}
  const stale = []
  for (const [key, value] of Object.entries(stored)) {
    if (!byKey.has(key)) { stale.push(key); continue }
    if (!isScalar(value)) { stale.push(key); continue }
    resolved[key] = value
  }
  return { resolved, stale, applicable, declaresKnobs: applicable.length > 0 }
}

/**
 * The props to spread into the figure component. A knob's `prop` is the
 * `default*` prop the figure reads as its useState seed; unpinned knobs are
 * omitted so the figure keeps its own default.
 */
export function viewPropsFor(pane, analysis, major) {
  const { resolved, applicable } = resolveKnobs(pane, analysis, major)
  const props = {}
  for (const knob of applicable) {
    if (Object.prototype.hasOwnProperty.call(resolved, knob.key)) {
      props[knob.prop] = resolved[knob.key]
    }
  }
  return props
}

/**
 * Canonical address of a pane, for discovery only.
 *
 * Knobs equal to their declared default are ELIDED. That is what makes the
 * scheme survive a year: adding a new control to a figure does not re-address
 * a single existing pane, so notes written today are still found tomorrow.
 *
 * Mirrored byte-for-byte in server/services/comparisons.js — change both.
 */
export function fingerprintOf(pane, analysis = null, major = null) {
  const figure = String(pane?.figure || '')
  const majorSlug = String(pane?.major || '')
  const applicable = knobsFor(analysis, major)
  const declared = new Map(applicable.map((knob) => [knob.key, knob]))
  const stored = pane?.knobs && typeof pane.knobs === 'object' ? pane.knobs : {}

  const entries = []
  for (const [key, value] of Object.entries(stored)) {
    if (!isScalar(value)) continue
    // With no declaration to compare against we cannot know a value is the
    // default, so it is kept: a fingerprint may be over-specific, never wrong.
    const knob = declared.get(key)
    if (applicable.length && !knob) continue
    if (knob && value === knob.default) continue
    entries.push(`${key}=${typeof value === 'boolean' ? (value ? '1' : '0') : String(value)}`)
  }
  entries.sort()
  return `${figure}@${majorSlug}${entries.length ? `?${entries.join('&')}` : ''}`
}

/** Auto-derived pane caption when the reader has not written one. */
export function paneLabel(pane, analysis, major) {
  if (pane?.label) return pane.label
  const { resolved, applicable } = resolveKnobs(pane, analysis, major)
  const parts = applicable
    .filter((knob) => Object.prototype.hasOwnProperty.call(resolved, knob.key))
    .map((knob) => {
      const value = resolved[knob.key]
      const option = (knob.options || []).find((o) => o.value === value)
      if (option) return option.label
      return `${knob.label}: ${value === true ? 'on' : value === false ? 'off' : value}`
    })
  return parts.length ? parts.join(' · ') : (major?.label || pane?.major || 'Figure defaults')
}

/**
 * One-shot key migration for a figure whose knob names changed. Written before
 * the second figure declares knobs rather than after the first notes strand.
 * Because identity is the slug, this only refreshes the discovery index — it
 * cannot lose a note.
 */
export function rekey(comparison, { figure, renames = {} } = {}) {
  if (!comparison?.panes) return comparison
  return {
    ...comparison,
    panes: comparison.panes.map((pane) => {
      if (pane.figure !== figure) return pane
      const knobs = {}
      for (const [key, value] of Object.entries(pane.knobs || {})) {
        knobs[renames[key] || key] = value
      }
      return { ...pane, knobs, fingerprint: fingerprintOf({ ...pane, knobs }) }
    }),
  }
}
