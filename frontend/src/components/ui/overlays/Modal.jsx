import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '../../../hooks/useEscape'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'
import { XMarkIcon } from '@heroicons/react/24/outline'

const widthClass = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  leading,
  actions,
  children,
  size = 'md',
  hideClose = false,
  dismissable = true
}) {
  const overlayRef = useRef(null)
  useEscape(() => dismissable && onClose?.(), open)
  useBodyScrollLock(open)
  if (!open) return null

  const onBackdrop = (e) => {
    if (!dismissable) return
    if (e.target === overlayRef.current) onClose?.()
  }

  const showHeader = title || leading || actions || (!hideClose && dismissable)

  // Portal to body so the modal escapes any ancestor stacking context (e.g.
  // a sticky-positioned aside or a parent with transform/filter). Without the
  // portal, z-100 is local to the ancestor's stacking context and siblings
  // later in the DOM can paint above the modal.
  return createPortal(
    <div
      ref={overlayRef}
      onMouseDown={onBackdrop}
      style={{ background: 'var(--color-scrim)' }}
      className='fixed inset-0 z-100 grid place-items-center p-4 motion-safe:animate-[overlayIn_120ms_var(--ease-out)]'
      role='dialog'
      aria-modal='true'
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className={`surface-elevated w-full ${widthClass[size] || widthClass.md} flex flex-col max-h-[85vh] overflow-hidden motion-safe:animate-[modalIn_180ms_var(--ease-out)]`}
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {showHeader && (
          <div className='flex items-start justify-between gap-4 px-6 py-4 hairline-b'>
            <div className='flex items-center gap-3 min-w-0 flex-1'>
              {leading}
              {(title || subtitle) && (
                <div className='min-w-0'>
                  {title && (
                    <h2 id='modal-title' className='text-heading truncate'>
                      {title}
                    </h2>
                  )}
                  {subtitle && <div className='text-caption mt-0.5'>{subtitle}</div>}
                </div>
              )}
            </div>
            <div className='flex items-center gap-2 shrink-0'>
              {actions}
              {!hideClose && dismissable && (
                <button
                  type='button'
                  onClick={onClose}
                  className='grid place-items-center w-8 h-8 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-hover transition-colors -mr-1.5'
                  aria-label='Close'
                >
                  <XMarkIcon className='w-4 h-4' />
                </button>
              )}
            </div>
          </div>
        )}
        <div className='px-6 py-5 overflow-y-auto'>{children}</div>
      </div>
    </div>,
    document.body
  )
}
