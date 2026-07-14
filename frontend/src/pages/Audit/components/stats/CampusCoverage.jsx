import { Alert, Spinner } from '../../../../components/ui'
import { useAuditMatrix } from '@frontend/query/hooks/useAudit'
import { int } from './statsFormat'

/**
 * Template verification by campus — one row per campus: audited / total
 * template clusters as a coverage bar + the audited/total fraction (the
 * fraction, not a percent, so how many templates are LEFT is readable at a
 * glance). The "where to audit next" view. Rows with errors also surface a
 * visible `{n} err` marker beside the campus name; full detail (exact
 * counts, live error count) still rides in the row's `title` tooltip.
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
    <div className='surface-card overflow-hidden'>
      <div className='px-[22px] pt-[18px] pb-1.5 flex items-baseline justify-between gap-3 flex-wrap'>
        <p className='text-label'>Template verification by campus</p>
        <span className='text-[12.5px] text-ink-subtle'>audited / total template clusters</span>
      </div>
      {q.isLoading ? (
        <div className='flex items-center gap-2 text-caption px-[22px] pb-[18px]'>
          <Spinner /> Loading coverage…
        </div>
      ) : q.isError ? (
        <div className='px-[22px] pb-[18px]'>
          <Alert type='error'>Failed to load campus verification progress.</Alert>
        </div>
      ) : !rows.length ? (
        <p className='text-caption text-ink-subtle italic px-[22px] pb-[18px]'>No templates for this filter.</p>
      ) : (
        rows.map((r) => {
          const errors = (r.cells || []).reduce((s, c) => s + (c.errors || 0), 0)
          const pct = r.templatesTotal ? (r.templatesAudited / r.templatesTotal) * 100 : 0
          const v = Math.max(0, Math.min(100, pct))
          const detail = `${r.campus} — ${int(r.templatesAudited)} / ${int(r.templatesTotal)} templates audited` +
            (errors > 0 ? ` · ${int(errors)} error${errors === 1 ? '' : 's'}` : '')
          return (
            <div key={`${r.system}|${r.school_id}`} title={detail}
              className='grid grid-cols-[180px_1fr_72px] items-center gap-4 px-[22px] py-[11px] border-b border-border/40 last:border-0 hover:bg-surface-hover'>
              <div className='flex items-center'>
                <span className='text-[13.5px] font-[550] truncate'>{r.campus}</span>
                {errors > 0 && <span className='ml-2 text-[11.5px] font-semibold text-danger whitespace-nowrap'>{errors} err</span>}
              </div>
              <span className='h-1.5 rounded-pill bg-surface-sunken overflow-hidden'>
                {/* Solid inline fill — utility opacity classes resolve to the UUI white surface token here. */}
                <span
                  className='block h-full rounded-pill'
                  style={{ width: `${v}%`, backgroundColor: v >= 90 ? 'var(--color-success, #17855A)' : 'var(--color-primary, #193018)' }}
                />
              </span>
              {/* The fraction (not a percent) so what's LEFT per campus is readable at a glance. */}
              <span className='text-[13px] font-[550] text-right tabular whitespace-nowrap'>
                {int(r.templatesAudited)}/{int(r.templatesTotal)}
              </span>
            </div>
          )
        })
      )}
    </div>
  )
}
