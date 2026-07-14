import React from 'react'

// Status tones map a state to the two surfaces that still carry it after the T23
// re-skin: the slim left notch rail and the header band. The card border is now
// uniform (border-border) like the mockup's agreement/judge cards. Shared by the
// requirements ledger and the Cal-GETC / UC-7 pattern modal.
const tones = {
  // Done — green notch + soft-green band, success ink (mirrors CompletionCheck).
  success: { rail: 'bg-success', header: 'bg-success-soft text-success' },
  // Active / still-needed — mint band, no notch (matches the mockup header).
  primary: { rail: 'bg-transparent', header: 'bg-primary-soft text-ink' },
  // Nothing actionable here — muted band + notch, muted ink.
  muted: { rail: 'bg-surface-muted', header: 'bg-surface-muted text-ink-muted' }
}

/**
 * The ASSIST-style section card: a rounded card with a status-tinted left accent
 * rail, an optional tinted header strip, and a `divide-y` body of rows. Shared by
 * the major modal's RequirementsLedger and the Cal-GETC / UC-7 pattern modal so a
 * "section of requirements" looks identical wherever it appears.
 *
 * - `tone`        success | primary | muted — drives rail, header, and border.
 * - `header`      left-aligned header content (an instruction / title). Omit for
 *                 a card with no header strip.
 * - `headerMark`  trailing header content, pushed right (a CompletionCheck, a
 *                 "Planned" Badge). The strip renders whenever `header` OR
 *                 `headerMark` is present.
 * - `footer`      rendered below the rows, outside the divided body (e.g. a
 *                 greyed "nothing articulated" footnote).
 * - `divide`      gap the body rows with hairlines (default true).
 */
export default function SectionCard({
  tone = 'primary',
  header = null,
  headerMark = null,
  footer = null,
  divide = true,
  className = '',
  children
}) {
  const t = tones[tone] || tones.primary
  const showHeader = Boolean(header || headerMark)
  return (
    <div className={`flex bg-surface border border-border rounded-[14px] overflow-hidden ${className}`}>
      <div className={`w-[3px] shrink-0 ${t.rail}`} aria-hidden />
      <div className='flex-1 min-w-0'>
        {showHeader && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[13px] font-[650] ${t.header}`}>
            {header}
            {headerMark && <span className='ml-auto'>{headerMark}</span>}
          </div>
        )}
        <div className={`bg-surface${divide ? ' divide-y divide-border/40' : ''}`}>{children}</div>
        {footer}
      </div>
    </div>
  )
}
