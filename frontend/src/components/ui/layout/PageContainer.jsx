import React from 'react'

// Content width by page kind. The gutter (px-6 md:px-8) and band (py-8) are
// fixed — only the max-width changes with the page's job.
const widths = {
  wide: 'max-w-7xl', // data-dense pages — the Roadmap, All majors
  form: 'max-w-3xl', // settings + multi-field forms
  narrow: 'max-w-2xl' // focused single-column — Report a Bug, upgrade prompts
}

/**
 * The in-app page frame. Owns the canonical page gutter (px-6 md:px-8 — kept in
 * sync with CommandBar so header and body line up), vertical band (py-8),
 * centering, and max-width. Every page behind a CommandBar wraps its body in
 * this instead of hand-rolling `max-w-* mx-auto px-* py-*`, so top spacing, side
 * gutters, and content width stay identical across the app.
 */
export default function PageContainer({ width = 'wide', className = '', children }) {
  // The page content sits on the canvas as a full-bleed panel slapped over the
  // white chrome (sidebar + header), with a rounded top-left corner where it
  // tucks under them. The panel is a FIXED frame filling the viewport below the
  // 56px header — it owns the scroll internally so the rounded corner stays
  // pinned under the header instead of scrolling away with the content.
  return (
    <div className='bg-canvas md:rounded-tl-2xl h-[calc(100vh-3.5rem)] overflow-y-auto'>
      <div className={`w-full ${widths[width] || widths.wide} mx-auto px-6 md:px-8 py-8 ${className}`}>{children}</div>
    </div>
  )
}
