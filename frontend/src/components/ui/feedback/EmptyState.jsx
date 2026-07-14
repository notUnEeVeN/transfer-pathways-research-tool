import React from 'react'

/**
 * Centered empty-state pattern — icon chip, title, body, optional action. Pass
 * `card` to render inside a `surface-card` (the common case on a bare page);
 * otherwise it's a plain centered block for use inside a Section or Card.
 */
export default function EmptyState({ icon: Icon, title, description, action, card = false, className = '' }) {
  const inner = (
    <div className={`flex flex-col items-center text-center py-12 px-6 ${card ? '' : className}`}>
      {Icon && (
        <span className='grid place-items-center w-11 h-11 rounded-[14px] bg-primary-soft text-primary mb-4'>
          <Icon className='w-6 h-6' />
        </span>
      )}
      {title && <p className='text-[15.5px] font-[650]'>{title}</p>}
      {description && <p className='text-caption mt-2 max-w-[46ch]'>{description}</p>}
      {action && <div className='mt-6'>{action}</div>}
    </div>
  )
  return card ? <div className={`surface-card ${className}`}>{inner}</div> : inner
}
