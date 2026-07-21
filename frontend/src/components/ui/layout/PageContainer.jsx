import React from 'react'

// Content width by page kind. The gutter (px-6 md:px-12) and band (py-10) are
// fixed — only the max-width changes with the page's job.
const widths = {
  wide: 'max-w-7xl', // data-dense pages — the institution directory, visuals
  form: 'max-w-3xl', // settings + multi-field forms
  narrow: 'max-w-2xl' // focused single-column — sign-in, upgrade prompts
}

/**
 * The in-app page frame: a white panel inset on the tinted canvas.
 *
 * The panel is what makes the console read as airy. Content sits on white,
 * the canvas shows as a thin mint margin around it, and a very wide, very
 * faint shadow separates the two without reading as a lift. Pair that with a
 * 48px gutter and a 40px band and a page has room to breathe without any
 * section needing extra gap — which is why `Stack` stops at `section: gap-6`.
 *
 * Every pane body wraps its content in this instead of hand-rolling
 * `max-w-* mx-auto px-* py-*`, so gutters, band, and width stay identical
 * across the app. TopBar carries the same gutter so chrome and content align
 * on one vertical.
 *
 * This deliberately does NOT own its scroll. The previous version was written
 * against the student product's chrome — a 56px header above a sidebar, panel
 * tucked under a rounded top-left corner — and pinned its own height to the
 * viewport. That is why it had no call sites here: this app has a full-width
 * 62px TopBar and scrolls at the view level.
 */
export default function PageContainer({ width = 'wide', className = '', children }) {
  return (
    <div className='bg-canvas min-h-full p-3 md:p-4'>
      <div className='rounded-3xl bg-surface shadow-card min-h-full'>
        <div className={`w-full ${widths[width] || widths.wide} mx-auto px-6 md:px-12 py-10 ${className}`}>
          {children}
        </div>
      </div>
    </div>
  )
}
