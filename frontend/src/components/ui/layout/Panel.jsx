import React from 'react'

const surfaces = {
  default: 'surface-raised',
  flat: 'surface-card',
  sunken: 'surface-sunken'
}

const iconTones = {
  brand: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  neutral: 'bg-surface-hover text-ink-muted'
}

/**
 * A content card with an optional header (a leading icon centered with the
 * title, and a trailing action slot). The default section container for settings
 * and rail cards — replaces the bare text-heading-over-a-flat-card pattern.
 *
 * `padded` (default) gives the body p-5; pass `padded={false}` for bodies that
 * own their own row padding (lists, tables).
 */
export default function Panel({
  title,
  icon: Icon,
  iconTone = 'brand',
  action,
  surface = 'default',
  padded = true,
  overflowVisible = false,
  headerClassName = '',
  bodyClassName = '',
  className = '',
  children
}) {
  const hasHeader = title || action || Icon
  // Header bottom padding: tight to the body when the body pads itself (pt-4),
  // looser when the body is flush (lists) or there is no body.
  const headerPad = !children ? 'pb-5' : padded ? '' : 'pb-4'
  const bodyPad = hasHeader ? (padded ? 'px-5 pb-5 pt-4' : '') : padded ? 'p-5' : ''
  return (
    <section className={`${surfaces[surface] || surfaces.default} ${overflowVisible ? '' : 'overflow-hidden'} ${className}`}>
      {hasHeader && (
        <header className={`flex items-center justify-between gap-3 px-5 pt-5 ${headerPad} ${headerClassName}`}>
          <div className='flex items-center gap-3 min-w-0'>
            {Icon && (
              <span className={`grid place-items-center w-9 h-9 rounded-xl shrink-0 ${iconTones[iconTone] || iconTones.brand}`}>
                <Icon className='w-5 h-5' aria-hidden='true' />
              </span>
            )}
            {title && <h2 className='text-heading truncate'>{title}</h2>}
          </div>
          {action && <div className='shrink-0'>{action}</div>}
        </header>
      )}
      {children && <div className={`${bodyPad} ${bodyClassName}`}>{children}</div>}
    </section>
  )
}
