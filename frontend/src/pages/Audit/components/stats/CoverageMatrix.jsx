import { Fragment } from 'react'
import { Alert, Spinner, Stack } from '../../../../components/ui'
import { useAuditMatrix } from '@frontend/query/hooks/useAudit'
import { int } from './statsFormat'

// Short column labels (full name rides in the cell/header tooltip).
const SHORT = {
  'Bio Sci': 'Bio',
  'Engineering & CS': 'Eng/CS',
  'Physical Sci': 'Phys',
  'Social Sci': 'Soc',
  Humanities: 'Hum',
  'Business / Econ': 'Bus',
  Arts: 'Arts',
  Other: 'Other',
}

const scaleSwatch = (f) => `color-mix(in srgb, var(--color-success) ${(10 + f * 78).toFixed(0)}%, transparent)`
const HATCH = 'repeating-linear-gradient(45deg, var(--color-surface-muted) 0 4px, transparent 4px 9px)'

/**
 * Coverage matrix — UC campus (rows) × major area (columns), each cell shaded by
 * the share of that area's templates audited. Untouched cells are hatched
 * ("unknown", never green/blank); cells holding an error get a rose border + dot.
 * The "where to audit next" view, paired with the largest unverified templates.
 */
export default function CoverageMatrix({ filter }) {
  const q = useAuditMatrix(filter)
  return (
    <div className='surface-card p-5'>
      <Stack gap='comfortable'>
        <p className='text-label'>Coverage matrix</p>
        {q.isLoading ? (
          <div className='flex items-center gap-2 text-caption'>
            <Spinner /> Loading coverage…
          </div>
        ) : q.isError ? (
          <Alert type='error'>Failed to load the coverage matrix.</Alert>
        ) : !q.data || !q.data.rows?.length ? (
          <p className='text-caption text-ink-subtle italic'>No templates in scope.</p>
        ) : (
          <Grid data={q.data} />
        )}
      </Stack>
    </div>
  )
}

function Grid({ data }) {
  const { categories, rows, largestUnverified } = data
  let maxPct = 0
  for (const r of rows)
    for (const c of r.cells) {
      const p = c.total ? c.audited / c.total : 0
      if (p > maxPct) maxPct = p
    }
  const shade = (p) => scaleSwatch(maxPct ? Math.min(p / maxPct, 1) : 0)
  const cols = `148px repeat(${categories.length}, minmax(58px, 1fr))`

  return (
    <div>
      <div className='overflow-x-auto'>
        <div className='grid gap-1' style={{ gridTemplateColumns: cols, minWidth: 560 }}>
          <div />
          {categories.map((c) => (
            <div key={c} className='text-caption text-ink-subtle text-center self-end pb-1.5 leading-tight' title={c}>
              {SHORT[c] || c}
            </div>
          ))}

          {rows.map((r) => (
            <Fragment key={`${r.system}|${r.school_id}`}>
              <div className='flex flex-col justify-center pr-2 text-caption min-w-0'>
                <span className='text-ink truncate'>{r.campus}</span>
                <span className='text-label text-ink-subtle'>
                  {int(r.templatesAudited)} / {int(r.templatesTotal)} templates
                </span>
              </div>
              {r.cells.map((cell) => {
                if (cell.total === 0) {
                  return (
                    <div
                      key={cell.area}
                      className='h-[42px] rounded-md border border-border'
                      title={`${r.campus} · ${cell.area} — no templates`}
                    />
                  )
                }
                if (cell.audited === 0) {
                  return (
                    <div
                      key={cell.area}
                      className='h-[42px] rounded-md border border-dashed border-border-strong'
                      style={{ backgroundImage: HATCH }}
                      title={`${r.campus} · ${cell.area} — untouched (0 of ${cell.total})`}
                    />
                  )
                }
                const p = cell.audited / cell.total
                const pctNum = Math.round(p * 100)
                const lit = maxPct && p / maxPct > 0.45
                return (
                  <div
                    key={cell.area}
                    className={`relative h-[42px] rounded-md flex items-center justify-center ${
                      cell.errors ? 'border-2 border-danger' : 'border border-border'
                    }`}
                    style={{ background: shade(p) }}
                    title={`${r.campus} · ${cell.area} — ${cell.audited} of ${cell.total} templates (${pctNum}%)${
                      cell.errors ? ' · contains an error' : ''
                    }`}
                  >
                    {cell.errors > 0 && (
                      <span className='absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-danger' />
                    )}
                    <span className={`text-label ${lit ? 'text-ink' : 'text-ink-muted'}`}>{pctNum}%</span>
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-4 mt-4 text-caption text-ink-subtle'>
        <span className='flex items-center gap-1.5'>
          coverage
          <span className='inline-flex gap-0.5'>
            {[0.12, 0.35, 0.6, 0.85, 1].map((f, i) => (
              <i key={i} className='w-4 h-3 rounded-sm border border-border block' style={{ background: scaleSwatch(f) }} />
            ))}
          </span>
          more
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='w-4 h-3 rounded-sm border border-dashed border-border-strong' style={{ backgroundImage: HATCH }} />
          untouched
        </span>
        <span className='flex items-center gap-1.5'>
          <span className='w-1.5 h-1.5 rounded-full bg-danger' /> error
        </span>
      </div>

      {largestUnverified?.length > 0 && (
        <div className='hairline-t pt-3 mt-4'>
          <p className='text-label text-conservative'>Largest unverified templates</p>
          <Stack gap='tight' className='mt-2.5'>
            {largestUnverified.map((t, i) => (
              <div key={i} className='flex items-center justify-between gap-3 text-caption'>
                <span className='text-ink-muted min-w-0 truncate'>
                  <span className='text-ink'>{t.campus}</span> · {t.major}
                </span>
                <span className='text-body-strong font-mono text-conservative shrink-0'>{int(t.docs)} docs</span>
              </div>
            ))}
          </Stack>
        </div>
      )}
    </div>
  )
}
