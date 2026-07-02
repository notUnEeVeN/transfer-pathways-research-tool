import { Alert, Spinner, Stack } from '../../../../components/ui'
import { usePersistedState } from '@frontend/hooks/usePersistedState'
import { useAuditPerSchool } from '@frontend/query/hooks/useAudit'

export default function PerSchoolBlock({ filter }) {
  const [expanded, setExpanded] = usePersistedState('audit.perSchool.expanded', false)
  const perSchool = useAuditPerSchool(filter, { enabled: expanded })

  return (
    <div className='surface-card p-5'>
      <button
        type='button'
        onClick={() => setExpanded((v) => !v)}
        className='text-body-strong text-ink-muted hover:text-ink'
      >
        {expanded ? '▾' : '▸'} Per-school breakdown
      </button>
      {expanded && (
        <Stack gap='cozy' className='mt-3'>
          {perSchool.isLoading ? (
            <div className='flex items-center gap-2 text-caption'>
              <Spinner /> Loading…
            </div>
          ) : perSchool.isError ? (
            <Alert type='error'>Failed to load per-school data.</Alert>
          ) : (
            <div className='overflow-x-auto'>
              <table className='w-full text-caption'>
                <thead>
                  <tr className='text-ink-subtle text-left'>
                    <th className='py-1 pr-3'>School</th>
                    <th className='py-1 pr-3 text-right'>Total</th>
                    <th className='py-1 pr-3 text-right'>Audited</th>
                    <th className='py-1 pr-3 text-right'>Correct</th>
                    <th className='py-1 pr-3 text-right'>Cons.</th>
                    <th className='py-1 pr-3 text-right'>Errors</th>
                    <th className='py-1 text-right'>Err %</th>
                  </tr>
                </thead>
                <tbody>
                  {(perSchool.data || []).map((r) => (
                    <tr key={`${r.system}|${r.school_id}`} className='hairline-t'>
                      <td className='py-1 pr-3'>{r.school}</td>
                      <td className='py-1 pr-3 text-right'>{r.total}</td>
                      <td className='py-1 pr-3 text-right'>{r.audited}</td>
                      <td className='py-1 pr-3 text-right'>{r.correct}</td>
                      <td className='py-1 pr-3 text-right'>{r.conservative ?? 0}</td>
                      <td className='py-1 pr-3 text-right'>{r.errors}</td>
                      <td className='py-1 text-right'>{r.error_rate_pct != null ? `${r.error_rate_pct}%` : '—'}</td>
                    </tr>
                  ))}
                  {(!perSchool.data || perSchool.data.length === 0) && (
                    <tr>
                      <td colSpan={7} className='py-2 text-ink-subtle italic'>
                        No data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Stack>
      )}
    </div>
  )
}
