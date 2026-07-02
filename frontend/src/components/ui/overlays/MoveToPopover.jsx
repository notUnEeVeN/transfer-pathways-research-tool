import React, { useEffect, useRef } from 'react'

export default function MoveToPopover({ open, onClose, destinations, onSelect }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      role='menu'
      className='absolute bottom-full mb-2 left-0 surface-elevated p-1 min-w-45 flex flex-col'
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      {destinations.length === 0 ? (
        <p className='px-2.5 py-1.5 text-caption text-ink-subtle'>No other destinations</p>
      ) : (
        destinations.map((d) => (
          <button
            key={d.key}
            type='button'
            role='menuitem'
            onClick={() => {
              onSelect(d.key)
              onClose()
            }}
            className='text-left px-2.5 py-1.5 rounded-md text-body text-ink-muted hover:bg-primary-soft hover:text-ink transition-colors'
          >
            {d.label}
          </button>
        ))
      )}
    </div>
  )
}
