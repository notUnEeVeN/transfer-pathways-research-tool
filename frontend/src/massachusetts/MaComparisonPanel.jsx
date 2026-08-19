import React, { useMemo } from 'react'
import { Alert, Spinner } from '../components/ui'
import { useCoverage, useTransferCreditRate } from '../shared/query/hooks/useData'

const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pct = (value) => (Number.isFinite(value) ? `${pctFmt.format(value)}%` : '—')
const signed = (value) => (Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${pctFmt.format(value)}` : '—')

/**
 * Final-paper Figure 3 beside our direct recalculation from the authors'
 * source files.
 *
 * The PDF is authoritative for what the paper reports. The source files
 * predate that PDF, so their differences are potential errors or unexplained
 * final-input revisions—not automatic typos.
 */
export default function MaComparisonPanel() {
  const coverage = useCoverage(
    { majorSlug: 'ma-cs', groupBy: 'college', requirements: 'degree' },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false },
  )
  const rate = useTransferCreditRate('local_as', { majorSlug: 'ma-cs' })

  const model = useMemo(() => {
    const rateRows = rate.data?.rows || []
    const rows = []
    for (const row of rateRows) {
      if (!Number.isFinite(row.published_pdf_as_transfer_pct)) continue
      rows.push({
        key: `${row.school_id}|${row.community_college_id}`,
        college: String(row.college_name || '').replace(/ Community College$/, ''),
        school: row.school,
        finalPdf: row.published_pdf_as_transfer_pct,
        recalculated: row.archive_gray_detail_as_transfer_pct,
        delta: Number.isFinite(row.archive_gray_detail_as_transfer_pct)
          ? row.archive_gray_detail_as_transfer_pct - row.published_pdf_as_transfer_pct
          : null,
      })
    }
    rows.sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0))
    const mean = (values) => (values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null)
    const finite = (key) => rows.map((row) => row[key]).filter(Number.isFinite)
    const covered = (coverage.data?.rows || [])
      .map((row) => row.pct_named_requirement_courses)
      .filter(Number.isFinite)
    return {
      rows,
      finalPdfMean: mean(finite('finalPdf')),
      recalculatedMean: mean(finite('recalculated')),
      ourFig1Mean: mean(covered),
    }
  }, [coverage.data, rate.data])

  if (rate.isLoading || coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (rate.isError || coverage.isError) {
    return <Alert type='error'>Could not load the Massachusetts figure evidence.</Alert>
  }

  return (
    <div className='surface-card p-4 flex flex-col gap-3'>
      <p className='text-label'>Final paper and our recalculation</p>
      <div className='flex flex-wrap gap-6 text-caption'>
        <span>Figure 1: <span className='font-mono tabular-nums'>38.2%</span> final paper · <span className='font-mono tabular-nums'>{pct(model.ourFig1Mean)}</span> our recalculation</span>
        <span>Figure 3 equal-cell mean: <span className='font-mono tabular-nums'>{pct(model.finalPdfMean)}</span> final paper · <span className='font-mono tabular-nums'>{pct(model.recalculatedMean)}</span> our recalculation</span>
      </div>
      <div className='overflow-x-auto max-h-[40vh] overflow-y-auto'>
        <table className='min-w-full text-caption'>
          <thead>
            <tr className='text-left text-label'>
              <th className='pr-3 py-1'>Pair</th>
              <th className='pr-3 py-1 text-right'>Final paper</th>
              <th className='pr-3 py-1 text-right'>Our recalculation</th>
              <th className='py-1 text-right'>Difference</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.key} className='border-t border-border'>
                <td className='pr-3 py-1'>{row.college} → {row.school}</td>
                <td className='pr-3 py-1 text-right font-mono tabular-nums'>{pct(row.finalPdf)}</td>
                <td className='pr-3 py-1 text-right font-mono tabular-nums'>{pct(row.recalculated)}</td>
                <td className='py-1 text-right font-mono tabular-nums'>{signed(row.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='text-caption text-ink-subtle max-w-4xl'>
        The direct rerun sums gray replacement-row credits over the cleaned AS total; blue
        unrestricted-elective-only rows are excluded and the numerator is not capped. Every
        mismatch is a potential error or an unexplained final-input revision. Each mean
        weights every finite pathway cell equally.
      </p>
    </div>
  )
}
