import React from 'react'
import { CheckIcon } from '@heroicons/react/24/solid'

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
          className='absolute inset-0 appearance-none w-4 h-4 rounded-sm border border-border-strong bg-surface group-hover:border-primary checked:bg-primary checked:border-primary transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
        />
        {checked && (
          <CheckIcon
            className='absolute inset-0 m-auto w-3 h-3 text-on-primary pointer-events-none'
            strokeWidth={2.5}
          />
        )}
      </span>
      {label && <span className='text-body text-ink-muted group-hover:text-ink transition-colors'>{label}</span>}
    </label>
  )
}
