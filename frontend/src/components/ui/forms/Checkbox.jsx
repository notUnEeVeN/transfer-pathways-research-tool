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
      <span className='relative inline-block w-5 h-5 shrink-0'>
        <input
          id={cbId}
          type='checkbox'
          checked={checked}
          onChange={onChange}
          className='absolute inset-0 appearance-none w-5 h-5 rounded-[6px] border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
          style={{
            backgroundColor: checked ? 'var(--color-primary, #193018)' : 'var(--color-surface, #fff)',
            borderColor: checked ? 'var(--color-primary, #193018)' : 'var(--color-border-strong, #B9C0AC)',
          }}
        />
        {checked && (
          <CheckIcon
            className='absolute inset-0 m-auto w-3 h-3 pointer-events-none'
            style={{ color: 'var(--color-accent)' }}
            strokeWidth={2.5}
          />
        )}
      </span>
      {label && <span className='text-body text-ink-muted group-hover:text-ink transition-colors'>{label}</span>}
    </label>
  )
}
