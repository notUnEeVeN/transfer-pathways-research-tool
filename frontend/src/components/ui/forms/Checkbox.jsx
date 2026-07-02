import React from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'

// Checked state is styled inline (not via `checked:` utility classes) so the
// filled box + white check render regardless of which token layer wins —
// this console layers the shared UUI theme over the tool tokens, and the
// two disagree about what `primary` / `on-primary` mean.
export default function Checkbox({ checked, onChange, label, id, className = '' }) {
  const generatedId = React.useId()
  const cbId = id || generatedId
  return (
    <label htmlFor={cbId} className={`group inline-flex items-center gap-2 cursor-pointer select-none ${className}`}>
      <span className='relative inline-block w-4 h-4 shrink-0'>
        <input
          id={cbId}
          type='checkbox'
          checked={checked}
          onChange={onChange}
          className='absolute inset-0 appearance-none w-4 h-4 rounded-sm border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          style={{
            backgroundColor: checked ? 'var(--color-primary, #3366ef)' : 'var(--color-surface, #fff)',
            borderColor: checked ? 'var(--color-primary, #3366ef)' : 'var(--color-border-strong, #9ca3af)',
          }}
        />
        {checked && (
          <CheckIcon
            className='absolute inset-0 m-auto w-3 h-3 pointer-events-none'
            style={{ color: '#fff' }}
            strokeWidth={2.5}
          />
        )}
      </span>
      {label && <span className='text-body text-ink-muted group-hover:text-ink transition-colors'>{label}</span>}
    </label>
  )
}
