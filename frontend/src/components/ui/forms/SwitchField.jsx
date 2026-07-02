import React from 'react'
import Switch from './Switch'

/**
 * A labeled on/off toggle: a muted text-button label beside a Switch, in a flex
 * row. The visible label doubles as the Switch's accessible name unless
 * `srLabel` supplies a more descriptive one. `className` tunes the row's
 * alignment (e.g. `ml-auto`, `justify-end`).
 */
export default function SwitchField({ label, checked, onChange, srLabel, disabled = false, className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className='select-none text-button text-ink-muted'>{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={srLabel || label} />
    </div>
  )
}
