import React, { useId } from 'react'

/**
 * Multiline text field — the Input counterpart that was previously hand-rolled.
 * Shares the field-label / focus-ring language; grows with `rows`.
 */
const Textarea = React.forwardRef(function Textarea(
  { label, hint, error, id, rows = 4, className = '', ...rest },
  ref
) {
  const autoId = useId()
  const fieldId = id || autoId
  return (
    <div className='flex flex-col'>
      {label && (
        <label htmlFor={fieldId} className='field-label'>
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full px-3 py-2.5 rounded-md border bg-surface text-ink text-body leading-relaxed resize-y placeholder:text-ink-subtle transition-[border-color,box-shadow] duration-150 focus:outline-none focus:border-primary focus:shadow-[0_0_0_3px_var(--color-primary-ring)] ${
          error ? 'border-danger' : 'border-border-strong'
        } ${className}`}
        {...rest}
      />
      {error ? (
        <p className='mt-2 text-caption text-danger'>{error}</p>
      ) : (
        hint && <p className='mt-2 text-caption'>{hint}</p>
      )}
    </div>
  )
})

export default Textarea
