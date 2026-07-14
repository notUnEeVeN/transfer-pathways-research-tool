import React from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useEscape } from '../../../hooks/useEscape'
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock'

/**
 * Full-viewport takeover for master/detail views. Fades over everything as an
 * opaque canvas — no side slide, no dimmed backdrop behind it. A sticky header
 * bar spans the full width (hairline below), but its inner content and the
 * scrollable body share one centered `max-w-7xl` column with the canonical page
 * gutter (`px-6 md:px-8`) and band (`py-8`), so the panel reads like an in-app
 * page that happens to float above the route. Contents are application-owned;
 * the panel provides chrome (close button, scroll area, optional title bar).
 */
export default function FullScreenPanel({
  open,
  onClose,
  title,
  ariaLabel,
  subtitle,
  leading,
  actions,
  children
}) {
  useEscape(onClose, open)
  useBodyScrollLock(open)

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key='panel'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className='fixed inset-0 z-50 bg-canvas flex flex-col'
          role='dialog'
          aria-modal='true'
          aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
        >
          {/* Full-bleed bar; inner content aligns to the centered column so the
              title sits over the body below it. Header wraps on small screens —
              the title block flows under tighter widths while the actions stay
              pinned top-right. */}
          <header className='shrink-0 hairline-b'>
            <div className='mx-auto w-full max-w-7xl px-6 md:px-8 flex items-start sm:items-center justify-between gap-3 py-3 sm:py-0 sm:h-16'>
              <div className='flex items-start sm:items-center gap-3 min-w-0'>
                {leading && <div className='shrink-0'>{leading}</div>}
                <div className='min-w-0'>
                  {title && <h2 className='text-heading sm:truncate'>{title}</h2>}
                  {subtitle && <div className='text-caption mt-0.5'>{subtitle}</div>}
                </div>
              </div>
              <div className='flex items-center gap-2 shrink-0'>
                {actions}
                <button
                  type='button'
                  onClick={onClose}
                  aria-label='Close'
                  className='grid place-items-center w-9 h-9 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-hover transition-colors'
                >
                  <XMarkIcon className='w-5 h-5' />
                </button>
              </div>
            </div>
          </header>
          {/* Scroll area owns the band; inner column matches the header gutter so
              content lines up with the title above it. */}
          <div className='flex-1 overflow-auto'>
            <div className='mx-auto w-full max-w-7xl px-6 md:px-8 py-8'>{children}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
