import React from 'react'

// One dot per major, in registry order, encoding an associate-degree or
// graduation-template verification state. The shared vocabulary across the
// Data tabs, so the Overview and Community Colleges surfaces read identically
// and a new major appears wherever its callers already iterate the registry.
//
// No orange — the app's palette has none (see Badge). Lavender/`conservative`
// is the app's data-caution tone, so it carries "present but not yet verified".
export const VERIFICATION_STATE_META = {
  verified: { label: 'verified', dot: 'bg-success' },
  present: { label: 'present, unverified', dot: 'bg-conservative' },
  absent: { label: 'not offered', dot: 'border border-border-strong' },
}

function stateMeta(state) {
  return VERIFICATION_STATE_META[state] || VERIFICATION_STATE_META.absent
}

/**
 * `states` — `[{ slug, label, state }]` in the order the dots should render.
 * Each dot names its major and state on hover and to assistive tech; the
 * legend below the table decodes the colors and the slug order.
 */
export default function MajorVerificationDots({ states = [], className = '' }) {
  if (!states.length) return <span className='text-caption text-ink-subtle'>—</span>
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {states.map(({ slug, label, state }) => {
        const meta = stateMeta(state)
        const name = `${label}: ${meta.label}`
        return (
          <span key={slug} role='img' aria-label={name} title={name}
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
        )
      })}
    </span>
  )
}

/**
 * Decodes the dots for a table: the color key plus the major order. `majors`
 * is `[{ slug, label }]` in the same order the dots render.
 */
export function MajorVerificationLegend({ majors = [], className = '' }) {
  const swatch = (state, text) => (
    <span className='inline-flex items-center gap-1.5 whitespace-nowrap'>
      <span className={`w-2 h-2 rounded-full shrink-0 ${stateMeta(state).dot}`} />
      {text}
    </span>
  )
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption text-ink-subtle ${className}`}>
      {swatch('verified', 'verified')}
      {swatch('present', 'present, unverified')}
      {swatch('absent', 'not offered')}
      {majors.length > 0 && (
        <span className='whitespace-nowrap'>
          order: {majors.map((m) => m.label).join(' · ')}
        </span>
      )}
    </div>
  )
}
