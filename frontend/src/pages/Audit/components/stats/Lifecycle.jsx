import { Stack } from '../../../../components/ui'
import { int } from './statsFormat'

/**
 * Errors & lifecycle — a current-state (non-temporal) read on data-quality
 * health: open vs resolved errors as a proportion bar (are we fixing what we
 * find?), plus the stale (re-audit debt from parser churn) and flagged (deferred
 * review) backlogs. No time axis — for a sporadic audit the snapshot is the
 * signal; "errors opened/resolved per week" is noise.
 */
export default function Lifecycle({ stats, compact = false }) {
  const open = stats.n_errors ?? 0
  const resolved = stats.n_resolved ?? 0
  const stale = stats.n_stale ?? 0
  const flagged = stats.n_flagged ?? 0
  const anyErrors = open + resolved > 0
  // Opt-in smaller stat numbers (desktop tool, to trim dead space). Default
  // keeps the website's larger treatment unchanged.
  const statCls = compact ? 'text-body-strong' : 'text-stat'

  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <p className='text-label'>Errors &amp; lifecycle</p>

        <Stack gap='tight'>
          <div className='flex items-baseline justify-between gap-3'>
            <span className='text-caption text-ink-muted'>Errors found</span>
            <span className='text-caption'>
              <span className='text-danger tabular'>{int(open)}</span> open ·{' '}
              <span className='text-success tabular'>{int(resolved)}</span> resolved
            </span>
          </div>
          <div className='flex gap-[3px] h-3'>
            {anyErrors ? (
              <>
                <div
                  className='h-full rounded-sm bg-danger'
                  style={{ flexGrow: open, flexBasis: 0, minWidth: open ? 6 : 0 }}
                  title={`${int(open)} open`}
                />
                <div
                  className='h-full rounded-sm bg-success'
                  style={{ flexGrow: resolved, flexBasis: 0, minWidth: resolved ? 6 : 0 }}
                  title={`${int(resolved)} resolved`}
                />
              </>
            ) : (
              <div className='h-full flex-1 rounded-sm bg-surface-muted border border-border' title='No errors found yet' />
            )}
          </div>
        </Stack>

        {/* Stale / flagged are surfaced in the top counts strip in compact mode,
            so the card is just the open/resolved error bar. */}
        {!compact && (
          <div className='grid grid-cols-2 divide-x divide-border border-t border-border pt-3'>
            <div className='pr-4'>
              <Stack gap='tight'>
                <span className={`${statCls} text-conservative tabular`}>{int(stale)}</span>
                <span className='text-label'>Stale</span>
              </Stack>
            </div>
            <div className='px-4'>
              <Stack gap='tight'>
                <span className={`${statCls} text-ink-subtle tabular`}>{int(flagged)}</span>
                <span className='text-label'>Flagged</span>
              </Stack>
            </div>
          </div>
        )}
      </Stack>
    </div>
  )
}
