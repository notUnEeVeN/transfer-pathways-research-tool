import React from 'react'

const Input = React.forwardRef(function Input(
  { label, hint, error, id, leadingIcon: Leading, className = '', ...rest },
  ref
) {
  const generatedId = React.useId()
  const inputId = id || generatedId
  return (
    <div className='flex flex-col'>
      {label && (
        <label htmlFor={inputId} className='field-label'>
          {label}
        </label>
      )}
      <div className='relative'>
        {Leading && (
          <Leading className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle pointer-events-none' />
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input-field ${Leading ? 'pl-9' : ''} placeholder:text-ink-subtle focus:input-field-focus ${error ? 'border-danger' : ''} ${className}`}
          aria-invalid={Boolean(error)}
          {...rest}
        />
      </div>
      {hint && !error && <p className='text-caption mt-2'>{hint}</p>}
      {error && <p className='text-caption mt-2 text-danger'>{error}</p>}
    </div>
  )
})

export default Input
