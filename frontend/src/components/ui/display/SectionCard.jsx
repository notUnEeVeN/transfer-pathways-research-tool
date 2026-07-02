import React from 'react'

// Status tones map a state to the three surfaces that carry it: the left accent
// rail, the header strip, and the card border. These are the exact tints the
// requirements ledger has always used, lifted out so the Cal-GETC / UC-7 pattern
// modal can wear the same chrome.
const tones = {
  // Done — soft green rail + header, success ink, green hairline border.
  success: { rail: 'bg-success-soft/60', header: 'bg-success-soft/60 text-success', border: 'border-success/30' },
  // Active / still-needed — the brand soft tint.
  primary: { rail: 'bg-primary-soft', header: 'bg-primary-soft', border: 'border-border' },
  // Nothing actionable here — greyed out.
  muted: { rail: 'bg-surface-muted', header: 'bg-surface-muted', border: 'border-border' }
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
    <div className={`flex rounded-xl border overflow-hidden ${t.border} ${className}`}>
      <div className={`w-1.5 shrink-0 ${t.rail}`} aria-hidden />
      <div className='flex-1 min-w-0'>
        {showHeader && (
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 ${t.header}`}>
            {header}
            {headerMark && <span className='ml-auto'>{headerMark}</span>}
          </div>
        )}
        <div className={`bg-surface${divide ? ' divide-y divide-border' : ''}`}>{children}</div>
        {footer}
      </div>
    </div>
  )
}
