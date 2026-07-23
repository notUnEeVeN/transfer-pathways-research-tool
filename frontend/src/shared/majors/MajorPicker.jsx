import React from 'react'
import { Select } from '../../components/ui'
import { useMajorSelection } from './MajorContext'

// Sentinel for "don't filter by major" on browsing surfaces.
export const ALL_MAJORS = '__all__'

/**
 * Choose the major a surface is showing.
 *
 * Renders nothing when there is only one major to choose from, so with CS
 * alone onboarded every page looks exactly as it did before.
 *
 * `capability` limits the picker to majors whose data supports this view (e.g.
 * 'asDegrees', 'paperBaselines'). When that leaves a single major, the picker
 * shows it as a static label with `caption` explaining why it can't change.
 */
export default function MajorPicker({
  value,
  onChange,
  capability = null,
  caption = null,
  className = '',
  // Browsing surfaces can show every major at once; analyses compute one at a
  // time and leave this off.
  allowAll = false,
}) {
  const { majors } = useMajorSelection()
  const eligible = capability
    ? majors.filter((m) => m.capabilities?.[capability])
    : majors

  if (eligible.length < 2) {
    // Nothing to choose. Stay silent unless a capability narrowed the list
    // while other majors exist — then say why this view is pinned.
    if (!capability || majors.length < 2) return null
    return (
      <div className={className}>
        <span className='field-label'>Major</span>
        <p className='text-body-strong'>{eligible[0]?.label ?? '—'}</p>
        {caption && <p className='text-caption text-ink-subtle'>{caption}</p>}
      </div>
    )
  }

  const options = eligible.map((m) => ({ value: m.slug, label: m.label }))
  return (
    <Select
      value={value}
      onChange={onChange}
      options={allowAll ? [{ value: ALL_MAJORS, label: 'All majors' }, ...options] : options}
      aria-label='Major'
      className={className}
    />
  )
}
