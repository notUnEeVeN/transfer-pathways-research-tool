import React, { useDeferredValue, useMemo, useState } from 'react'
import { ArrowPathIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Input, Stack, StatStrip } from '../components/ui'
import { useCategoryGaps } from '../shared/query/hooks/useData'
import { AnalysisLoading, shortenSchool } from './chartBits'

const DEFAULT_MAJOR_FILTER = 'computer science'
const UNTAGGED = 'Untagged'

const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const pct = (v) => (Number.isFinite(v) ? `${pctFmt.format(v)}%` : '-')

// Sequential single-hue ramp (light → dark red): magnitude of "colleges whose
// students hit this gap". Text flips by fill luminance, as in CoverageHeatmap.
function missColor(value) {
  if (!Number.isFinite(value)) {
    return { backgroundColor: 'var(--color-surface-muted)', color: 'var(--color-ink-subtle)' }
  }
  const t = Math.max(0, Math.min(100, value)) / 100
  const lo = [254, 242, 242]
  const hi = [153, 27, 27]
  const rgb = lo.map((v, i) => Math.round(v + (hi[i] - v) * t))
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  return { backgroundColor: `rgb(${rgb.join(' ')})`, color: luminance > 0.55 ? 'var(--color-ink)' : 'white' }
}

function average(values) {
  const nums = values.filter(Number.isFinite)
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null
}

function buildGrid(rows) {
  const schools = new Map()
  const categories = new Map()
  const cells = new Map()
  for (const r of rows) {
    const colKey = String(r.school_id)
    const rowKey = r.category == null ? UNTAGGED : String(r.category)
    if (!schools.has(colKey)) schools.set(colKey, { key: colKey, school: r.school })
    if (!categories.has(rowKey)) categories.set(rowKey, { key: rowKey, untagged: r.category == null })
    cells.set(`${rowKey}|${colKey}`, r)
  }
  const columns = [...schools.values()].sort((a, b) => a.school.localeCompare(b.school, undefined, { sensitivity: 'base' }))
  const catRows = [...categories.values()]
    .map((c) => ({
      ...c,
      mean: average(columns.map((col) => cells.get(`${c.key}|${col.key}`)?.pct_missing ?? null)),
    }))
    // Worst categories first; the untagged bucket pinned last.
    .sort((a, b) => (a.untagged - b.untagged) || (b.mean ?? -1) - (a.mean ?? -1) || a.key.localeCompare(b.key))
  const columnMeans = columns.map((col) =>
    average(catRows.map((c) => cells.get(`${c.key}|${col.key}`)?.pct_missing ?? null))
  )
  return { columns, catRows, cells, columnMeans }
}

/**
 * Category gaps — the CA paper's course-barrier analysis as a campus ×
 * canonical-category heatmap: of the colleges with a required receiver in a
 * category, the share missing any articulated equivalent. Receivers without a
 * curated category aggregate into a pinned "Untagged" row so the untagged
 * share stays visible rather than silently dropped.
 */
export default function CategoryGaps() {
  const [majorFilter, setMajorFilter] = useState(DEFAULT_MAJOR_FILTER)
  const deferredMajorFilter = useDeferredValue(majorFilter)
  const query = useCategoryGaps(
    { majorContains: deferredMajorFilter },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const rows = query.data?.rows || []
  const model = useMemo(() => buildGrid(rows), [rows])
  const datasetVersion = query.data?.dataset_version || 'unversioned'
  const taggedRows = model.catRows.filter((c) => !c.untagged)
  const onlyUntagged = model.catRows.length > 0 && taggedRows.length === 0
  const worst = taggedRows[0] || null

  if (query.isLoading) return <AnalysisLoading />
  if (query.isError) return <Alert type='error'>Could not load the category-gaps data.</Alert>

  const controls = (
    <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
      <Input
        label='Major filter'
        value={majorFilter}
        onChange={(e) => setMajorFilter(e.target.value)}
        placeholder='computer science'
        leadingIcon={MagnifyingGlassIcon}
        className='w-80 max-w-full'
      />
      <Button
        variant='secondary'
        leadingIcon={ArrowPathIcon}
        loading={query.isFetching && !query.isLoading}
        onClick={() => query.refetch()}
      >
        Refresh
      </Button>
      <div className='ml-auto flex flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
        <span className='font-mono tabular-nums'>{datasetVersion}</span>
        <span>{query.isFetching ? 'Updating' : 'Live endpoint'}</span>
      </div>
    </div>
  )

  if (!rows.length) {
    return (
      <Stack gap='section'>
        {controls}
        <EmptyState card title='No requirement categories in scope' description='Try a broader major filter.' className='p-8' />
      </Stack>
    )
  }

  return (
    <Stack gap='section'>
      {controls}

      {onlyUntagged && (
        <div data-export-exclude>
          <Alert type='info'>
            No course categories have been curated yet, so every receiver lands in
            the Untagged bucket. Tag university courses with canonical categories in
            the Audit → Curation tools to break this analysis out by category.
          </Alert>
        </div>
      )}

      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Categories', value: intFmt.format(taggedRows.length), sub: `${intFmt.format(model.catRows.length - taggedRows.length)} untagged bucket` },
            { label: 'Campuses', value: intFmt.format(model.columns.length), sub: 'from /analysis/category-gaps' },
            { label: 'Mean missing share', value: pct(average(rows.map((r) => r.pct_missing))), accent: true },
            ...(worst ? [{ label: 'Widest gap', value: worst.key, sub: `${pct(worst.mean)} of colleges missing it` }] : []),
          ]}
        />
      </div>

      <div className='surface-card overflow-auto max-h-[72vh]'>
        <table className='border-separate border-spacing-0 min-w-full'>
          <thead>
            <tr>
              <th className='sticky top-0 left-0 z-30 bg-surface border-b border-r border-border px-3 py-2 text-left text-label min-w-48'>
                Course category
              </th>
              {model.columns.map((col) => (
                <th key={col.key} className='sticky top-0 z-20 bg-surface border-b border-r border-border px-2 py-2 text-left align-bottom min-w-24'>
                  <span className='block text-tag text-ink leading-tight whitespace-normal'>{shortenSchool(col.school)}</span>
                </th>
              ))}
              <th className='sticky top-0 right-0 z-30 bg-surface border-b border-l border-border px-3 py-2 text-right text-label min-w-20'>
                Avg
              </th>
            </tr>
          </thead>
          <tbody>
            {model.catRows.map((cat) => (
              <tr key={cat.key} className='group'>
                <th className={`sticky left-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-r border-border px-3 py-1.5 text-left text-caption min-w-48 ${cat.untagged ? 'text-ink-subtle italic' : 'text-ink'}`}>
                  {cat.key}
                </th>
                {model.columns.map((col) => {
                  const cell = model.cells.get(`${cat.key}|${col.key}`)
                  const value = cell?.pct_missing ?? null
                  const title = cell
                    ? `${col.school}\n${cat.key}\n${intFmt.format(cell.ccs_missing_articulation)} of ${intFmt.format(cell.ccs_with_requirement)} colleges with this requirement lack an articulated equivalent (${pct(value)})`
                    : `${col.school}\n${cat.key}\nNo colleges have a required receiver in this category`
                  return (
                    <td
                      key={col.key}
                      title={title}
                      aria-label={title}
                      className='border-b border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14'
                      style={missColor(value)}
                    >
                      {pct(value)}
                    </td>
                  )
                })}
                <td className='sticky right-0 z-10 bg-surface group-hover:bg-surface-hover border-b border-l border-border px-3 py-1.5 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                  {pct(cat.mean)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th className='sticky left-0 bottom-0 z-30 bg-surface border-t border-r border-border px-3 py-2 text-left text-label min-w-48'>
                Average
              </th>
              {model.columns.map((col, i) => (
                <td key={col.key} className='sticky bottom-0 z-20 border-t border-r border-white/50 px-1 text-center text-tag font-mono tabular-nums h-8 min-w-14' style={missColor(model.columnMeans[i])}>
                  {pct(model.columnMeans[i])}
                </td>
              ))}
              <td className='sticky right-0 bottom-0 z-30 bg-surface border-t border-l border-border px-3 py-2 text-right text-caption font-mono tabular-nums text-ink min-w-20'>
                {pct(average(rows.map((r) => r.pct_missing)))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className='flex flex-wrap items-center gap-3 text-caption text-ink-subtle'>
        <span className='text-label'>Colleges missing articulation</span>
        <div className='w-48 h-2 rounded-pill border border-border' style={{ background: 'linear-gradient(90deg, rgb(254 242 242), rgb(153 27 27))' }} />
        <span className='font-mono tabular-nums'>0%</span>
        <span className='font-mono tabular-nums'>100%</span>
      </div>
    </Stack>
  )
}
