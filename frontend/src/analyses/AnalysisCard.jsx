import React, { useRef, useState } from 'react'
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { Alert, Button } from '../components/ui'
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
 * Two export modes share one card shell:
 *   - Live analyses (default): PDF + high-res PNG captured from the DOM
 *     (LaTeX-native PDF drops into \includegraphics{}). The capture skips
 *     everything marked data-export-exclude so the file reads as a figure.
 *   - Published figures: pass `downloadFormats` (+ `onDownload`) and the header
 *     serves the STORED svg/png/pdf the notebook rendered — a true vector PDF,
 *     not a re-capture — instead of the DOM-capture buttons.
 */
export default function AnalysisCard({
  title, source, badge, exportName, children, downloadFormats, onDownload, actions,
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
      setExportError('Export failed — try again, or use a wider window.')
    } finally {
      setExporting(null)
    }
  }

  return (
    <section ref={cardRef} className='surface-card analysis-card p-5 sm:p-6'>
      {/* Whole header stays out of exports — the file is the figure alone
          (LaTeX supplies the caption via \caption{}), not a screenshot. */}
      <div className='flex flex-wrap items-start gap-3 mb-4' data-export-exclude>
        <div className='min-w-0'>
          <h2 className='text-heading break-words'>{title}</h2>
          {source && <p className='text-caption text-ink-subtle mt-0.5 break-words'>{source}</p>}
        </div>
        <div className='ml-auto shrink-0 flex items-center gap-2'>
          {storedDownloads ? (
            downloadFormats.map((fmt) => (
              <Button key={fmt} variant='ghost' leadingIcon={ArrowDownTrayIcon}
                onClick={() => onDownload?.(fmt)}>{fmt.toUpperCase()}</Button>
            ))
          ) : (
            <>
              <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
                disabled={!!exporting} onClick={() => doExport('pdf')}>
                {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
              </Button>
              <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
                disabled={!!exporting} onClick={() => doExport('png')}>
                {exporting === 'png' ? 'Exporting…' : 'PNG'}
              </Button>
            </>
          )}
          {actions}
          {badge}
        </div>
      </div>
      {exportError && !storedDownloads && <Alert type='error' className='mb-4'>{exportError}</Alert>}
      {children}
    </section>
  )
}
