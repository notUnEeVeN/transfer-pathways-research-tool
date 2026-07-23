import React, { useRef, useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Alert } from '../components/ui'
import { exportAnalysisCard } from './exportCard'

/**
 * Enclosing card for one analysis on the Data → Analysis tab — gives each
 * analysis a clear boundary (replacing the old divider line between them).
 *
 * The `.analysis-card` scope (see styles/console.css) flattens the analysis's
 * own inner `surface-card` panels — control bar, matrix, table — to a
 * transparent border so the whole thing reads as ONE card with sections set
 * off by spacing, not a stack of cards-inside-a-card.
 *
 * `source` is the small provenance line under the title. `badge` (admin only)
 * shows release status; partners never see unreleased analyses, so they get no
 * badge. `actions` are extra header controls (e.g. a figure's edit/delete).
 *
 * Two export modes:
 *   - Live analyses (default): PDF + high-res PNG captured from the DOM (skips
 *     data-export-exclude nodes; figure-sized single-page PDF).
 *   - Published figures: pass downloadFormats + onDownload to serve the STORED
 *     svg/png/pdf instead of re-capturing.
 *   - Unavailable analysis states: pass exportable={false} to omit downloads.
 */

// Header-only ghost pill: smaller and lighter than the shared Button primitive
// (12.5px/550 vs. Button's 13px/600 text-button preset), matching the download
// affordances in the console mockup (v2:677-678). Native <button> already
// resets to border:0/cursor:pointer/background:transparent (tokens.css base
// layer), so only the pill shape + hover/disabled treatment need stating here.
function DownloadButton({ onClick, disabled, children }) {
  return (
    <button type='button' onClick={onClick} disabled={disabled}
      className='flex items-center gap-1.5 rounded-pill px-3 py-[7px] text-tag text-ink
        hover:bg-primary-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
      <ArrowDownTrayIcon className='w-3 h-3' aria-hidden='true' />
      {children}
    </button>
  )
}

export default function AnalysisCard({
  title, source, badge, exportName, children, downloadFormats, onDownload, actions,
  exportable = true,
}) {
  const cardRef = useRef(null)
  const [exporting, setExporting] = useState(null) // 'pdf' | 'png' | null
  const [exportError, setExportError] = useState(null)
  const storedDownloads = Array.isArray(downloadFormats) && downloadFormats.length > 0

  const doExport = async (format) => {
    if (!cardRef.current || exporting) return
    setExporting(format)
    setExportError(null)
    try {
      await exportAnalysisCard(cardRef.current, { name: exportName || 'analysis', format })
    } catch (e) {
      console.error('analysis export failed:', e)
      const local = ['localhost', '127.0.0.1'].includes(window.location.hostname)
      setExportError(local
        ? 'Export failed locally — restart the frontend with “npm run dev -- --force” and try again.'
        : 'Export failed — reload the page and try again.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <section ref={cardRef} className='surface-card analysis-card px-6 py-[22px] flex flex-col gap-[18px]'>
      {/* Whole header stays out of exports — the file is the figure alone
          (LaTeX supplies the caption via \caption{}), not a screenshot. */}
      <div className='flex flex-wrap items-start gap-3' data-export-exclude>
        <div className='min-w-0'>
          <h2 className='heading-card tracking-[-.01em] break-words'>{title}</h2>
          {source && <p className='mt-0.5 text-[12.5px] text-ink-subtle break-words'>{source}</p>}
        </div>
        <div className='ml-auto shrink-0 flex items-center gap-2'>
          {storedDownloads ? (
            downloadFormats.map((fmt) => (
              <DownloadButton key={fmt} onClick={() => onDownload?.(fmt)}>{fmt.toUpperCase()}</DownloadButton>
            ))
          ) : exportable ? (
            <>
              <DownloadButton disabled={!!exporting} onClick={() => doExport('pdf')}>
                {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
              </DownloadButton>
              <DownloadButton disabled={!!exporting} onClick={() => doExport('png')}>
                {exporting === 'png' ? 'Exporting…' : 'PNG'}
              </DownloadButton>
            </>
          ) : null}
          {actions}
          {badge}
        </div>
      </div>
      {exportError && !storedDownloads && exportable && <Alert type='error'>{exportError}</Alert>}
      {children}
    </section>
  )
}
