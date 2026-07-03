import { Alert, Spinner, Stack } from '../../../../components/ui'
import { useAuditMatrix } from '@frontend/query/hooks/useAudit'
import { int } from './statsFormat'

/**
 * Template verification by campus — one row per campus: audited / total
 * template clusters as a progress bar, plus an error count when any of its
 * audited templates hold a live error. The "where to audit next" view.
 *
 * Replaces the campus × major-area coverage matrix: on the research dataset
 * (CS-only majors) the area columns collapsed to a single meaningful column,
 * so the grid and its "largest unverified templates" list carried no signal.
 * Reads the same /audit/matrix payload; the per-area cells are summed here.
 */
export default function CampusCoverage({ filter }) {
  const q = useAuditMatrix(filter)
  const rows = q.data?.rows || []
  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <div className='flex items-baseline justify-between gap-3 flex-wrap'>
          <p className='text-label'>Template verification by campus</p>
          <span className='text-caption text-ink-subtle'>audited / total template clusters</span>
        </div>
        {q.isLoading ? (
          <div className='flex items-center gap-2 text-caption'>
            <Spinner /> Loading coverage…
          </div>
        ) : q.isError ? (
          <Alert type='error'>Failed to load campus verification progress.</Alert>
        ) : !rows.length ? (
          <p className='text-caption text-ink-subtle italic'>No templates for this filter.</p>
        ) : (
          <Stack gap='tight'>
            {rows.map((r) => {
              const errors = (r.cells || []).reduce((s, c) => s + (c.errors || 0), 0)
              const pct = r.templatesTotal ? (r.templatesAudited / r.templatesTotal) * 100 : 0
              return (
                <div key={`${r.system}|${r.school_id}`} className='flex items-center gap-3'>
                  <span className='text-caption text-ink w-36 truncate shrink-0' title={r.campus}>{r.campus}</span>
                  {/* Solid inline fill — utility opacity classes resolve to the UUI white surface token here. */}
                  <span className='flex-1 h-2 rounded-pill bg-surface-muted border border-border overflow-hidden'>
                    <span
                      className='block h-full rounded-pill'
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: 'var(--color-primary, #3366ef)' }}
                    />
                  </span>
                  <span className='text-caption font-mono tabular-nums text-ink-muted w-20 text-right shrink-0'>
                    {int(r.templatesAudited)} / {int(r.templatesTotal)}
                  </span>
                  <span className='text-caption font-mono tabular-nums text-danger w-12 text-right shrink-0'>
                    {errors > 0 ? `${int(errors)} err` : ''}
                  </span>
                </div>
              )
            })}
          </Stack>
        )}
      </Stack>
    </div>
  )
}
