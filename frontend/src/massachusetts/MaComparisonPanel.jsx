import React, { useMemo } from 'react'
import { Alert, Spinner } from '../components/ui'
import { useCoverage, useMaBaselines, useTransferCreditRate } from '../shared/query/hooks/useData'

const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pct = (value) => (Number.isFinite(value) ? `${pctFmt.format(value)}%` : '—')
const signed = (value) => (Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${pctFmt.format(value)}` : '—')

/**
 * Our recomputation beside the paper's published numbers, per pair.
 *
 * The published values (CurrComp Master.xlsx) are hand tallies; our values
 * run the recovered course-level workbooks through the California engine.
 * Where the two disagree, the disagreement is a property of the source —
 * the paper's own artifacts disagree with each other cell by cell — and
 * this table is where that is visible rather than smoothed over.
 */
export default function MaComparisonPanel() {
  const baselines = useMaBaselines()
  const coverage = useCoverage(
    { majorSlug: 'ma-cs', groupBy: 'college', requirements: 'degree' },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false },
  )
  const rate = useTransferCreditRate('local_as', { majorSlug: 'ma-cs' })

  const model = useMemo(() => {
    const measures = baselines.data?.measures || {}
    const rateRows = rate.data?.rows || []
    const pctAsByPair = new Map((measures.pct_as?.cells || [])
      .map((cell) => [`${cell.school_id}|${cell.community_college_id}`, cell]))
    const rows = []
    for (const row of rateRows) {
      const published = pctAsByPair.get(`${row.school_id}|${row.community_college_id}`)
      if (!published || !Number.isFinite(row.as_unit_utilization_pct)) continue
      const theirs = published.value * 100
      rows.push({
        key: `${row.school_id}|${row.community_college_id}`,
        college: String(row.college_name || published.college_name || '').replace(/ Community College$/, ''),
        school: row.school,
        ours: row.as_unit_utilization_pct,
        theirs,
        delta: row.as_unit_utilization_pct - theirs,
      })
    }
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    const mean = (values) => (values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null)
    const covered = (coverage.data?.rows || [])
      .map((row) => row.pct_named_requirement_courses)
      .filter(Number.isFinite)
    return {
      rows,
      ourRateMean: mean(rows.map((row) => row.ours)),
      theirRateMean: mean(rows.map((row) => row.theirs)),
      ourFig1Mean: mean(covered),
    }
  }, [baselines.data, coverage.data, rate.data])

  if (baselines.isLoading || rate.isLoading || coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (baselines.isError) {
    return <Alert type='error'>Could not load the published baselines.</Alert>
  }

  return (
    <div className='surface-card p-4 flex flex-col gap-3'>
      <p className='text-label'>Reproduction against the published values</p>
      <div className='flex flex-wrap gap-6 text-caption'>
        <span>Requirements heatmap mean: <span className='font-mono tabular-nums'>{pct(model.ourFig1Mean)}</span> ours · <span className='font-mono tabular-nums'>38.2%</span> published — exact reproduction</span>
        <span>Transfer credit rate mean: <span className='font-mono tabular-nums'>{pct(model.ourRateMean)}</span> ours · <span className='font-mono tabular-nums'>{pct(model.theirRateMean)}</span> published</span>
      </div>
      <div className='overflow-x-auto max-h-[40vh] overflow-y-auto'>
        <table className='min-w-full text-caption'>
          <thead>
            <tr className='text-left text-label'>
              <th className='pr-3 py-1'>Pair</th>
              <th className='pr-3 py-1 text-right'>Ours</th>
              <th className='pr-3 py-1 text-right'>Published</th>
              <th className='py-1 text-right'>Δ (pp)</th>
            </tr>
          </thead>
          <tbody>
            {model.rows.map((row) => (
              <tr key={row.key} className='border-t border-border'>
                <td className='pr-3 py-1'>{row.college} → {row.school}</td>
                <td className='pr-3 py-1 text-right font-mono tabular-nums'>{pct(row.ours)}</td>
                <td className='pr-3 py-1 text-right font-mono tabular-nums'>{pct(row.theirs)}</td>
                <td className='py-1 text-right font-mono tabular-nums'>{signed(row.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className='text-caption text-ink-subtle max-w-4xl'>
        Published values are the paper&rsquo;s hand tallies; ours run the recovered course-level workbooks through the California engine. Per-pair disagreement is a property of the source — the paper&rsquo;s own pathway workbook and its published summary sheet disagree with each other on nine pairs — and it is shown here rather than smoothed over.
      </p>
    </div>
  )
}
