import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, StatStrip } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { DISTRICTS, PAPER_CELL_COUNT, PAPER_COMPLETE_COUNT, UC_ROWS } from './paperDistrictBaseline'

const MAJOR_FILTER = 'computer science'
const NAVY = '#1a237e'
const WHITE = '#ffffff'
const GAIN = '#0d7964'
const LOSS = '#cb1d51'
const GRID = '#111111'

const VIEWS = [
  { value: 'live', label: 'Our data' },
  { value: 'paper', label: 'Paper baseline' },
  { value: 'diff', label: 'Difference' },
]

const UC_BY_SCHOOL_ID = new Map([
  [89, 'UC1*'],
  [144, 'UC2'],
  [7, 'UC3*'],
  [128, 'UC4*'],
  [117, 'UC5*'],
  [79, 'UC6'],
  [132, 'UC7*'],
  [120, 'UC8*'],
  [46, 'UC9*'],
])

const UC_BY_SCHOOL_NAME = [
  [/davis/i, 'UC1*'],
  [/merced/i, 'UC2'],
  [/san diego/i, 'UC3*'],
  [/santa barbara/i, 'UC4*'],
  [/los angeles|ucla/i, 'UC5*'],
  [/berkeley/i, 'UC6'],
  [/santa cruz/i, 'UC7*'],
  [/irvine/i, 'UC8*'],
  [/riverside/i, 'UC9*'],
]

const districtByName = new Map(DISTRICTS.map((d) => [normalizeName(d.name), d]))

const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const signedFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0, signDisplay: 'always' })

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function ucForRow(row) {
  const byId = UC_BY_SCHOOL_ID.get(Number(row.school_id))
  if (byId) return byId
  const school = String(row.school || '')
  return UC_BY_SCHOOL_NAME.find(([pattern]) => pattern.test(school))?.[1] || null
}

function cellKey(ucId, districtIndex) {
  return `${ucId}|${districtIndex}`
}

function paperValue(uc, districtIndex) {
  return uc.bits[districtIndex] === '1'
}

function buildLiveModel(rows) {
  const cells = new Map()
  const districtsSeen = new Set()
  const campusSeen = new Set()
  let ignoredRows = 0

  for (const row of rows) {
    const district = districtByName.get(normalizeName(row.row_group_label || row.community_college_district))
    const ucId = ucForRow(row)
    if (!district || !ucId) {
      ignoredRows += 1
      continue
    }

    const key = cellKey(ucId, district.index)
    const cell = cells.get(key) || {
      complete: false,
      bestPct: null,
      rowCount: 0,
      programs: new Set(),
      district,
    }
    const pct = Number(row.pct_articulated)
    cell.complete = cell.complete || row.fully_articulated === true
    cell.bestPct = Number.isFinite(pct) ? Math.max(cell.bestPct ?? -Infinity, pct) : cell.bestPct
    cell.rowCount += 1
    if (row.major) cell.programs.add(row.major)
    cells.set(key, cell)
    districtsSeen.add(district.index)
    campusSeen.add(ucId)
  }

  let complete = 0
  for (const uc of UC_ROWS) {
    for (const district of DISTRICTS) {
      if (cells.get(cellKey(uc.id, district.index))?.complete) complete += 1
    }
  }

  return {
    cells,
    complete,
    missing: PAPER_CELL_COUNT - complete,
    districtsSeen: districtsSeen.size,
    campusSeen: campusSeen.size,
    ignoredRows,
  }
}

function compare(live) {
  let sameComplete = 0
  let sameMissing = 0
  let gained = 0
  let lost = 0

  for (const uc of UC_ROWS) {
    for (const district of DISTRICTS) {
      const paper = paperValue(uc, district.index)
      const current = live.cells.get(cellKey(uc.id, district.index))?.complete === true
      if (paper && current) sameComplete += 1
      else if (!paper && !current) sameMissing += 1
      else if (!paper && current) gained += 1
      else lost += 1
    }
  }

  return {
    sameComplete,
    sameMissing,
    gained,
    lost,
    changed: gained + lost,
    agreementPct: ((sameComplete + sameMissing) / PAPER_CELL_COUNT) * 100,
  }
}

function fillFor({ view, live, paper }) {
  if (view === 'paper') return paper ? NAVY : WHITE
  if (view === 'live') return live ? NAVY : WHITE
  if (live && paper) return NAVY
  if (!live && !paper) return WHITE
  return live ? GAIN : LOSS
}

function labelFor({ view, live, paper }) {
  if (view === 'paper') return paper ? 'complete in paper baseline' : 'missing in paper baseline'
  if (view === 'live') return live ? 'complete in our data' : 'missing in our data'
  if (live && paper) return 'unchanged complete'
  if (!live && !paper) return 'unchanged missing'
  return live ? 'newly complete in our data' : 'complete in paper baseline only'
}

function titleFor({ uc, district, liveCell, live, paper, view }) {
  const parts = [
    `${uc.id} · ${uc.campus}`,
    `District ${district.index}: ${district.name}`,
    `Cell: ${labelFor({ view, live, paper })}`,
    `Our data: ${live ? 'complete' : 'missing'}`,
    `Paper baseline: ${paper ? 'complete' : 'missing'}`,
  ]
  if (liveCell) {
    if (Number.isFinite(liveCell.bestPct)) parts.push(`Best live coverage: ${pctFmt.format(liveCell.bestPct)}%`)
    parts.push(`${intFmt.format(liveCell.programs.size)} live CS program${liveCell.programs.size === 1 ? '' : 's'}`)
  }
  return parts.join('\n')
}

function PaperMatrix({ liveModel, view }) {
  return (
    <div style={{ containerType: 'inline-size' }}>
      <div
        className='surface-card p-3 overflow-x-auto paper-export-cells'
        style={{
          background: WHITE,
          // Size cells to THIS card's width (container query units), not the
          // whole viewport — the analysis now lives inside a padded, max-width
          // card, so 100vw overflowed and got clipped. cqw resolves against the
          // wrapper above (an element can't query its own size). The subtracted
          // budget covers card padding + vertical axis label + row-id column +
          // gap; overflow-x-auto is a safety net for the smallest phones (4px
          // floor).
          '--paper-cell': 'clamp(4px, calc((100cqw - 100px) / 72), 18px)',
          '--paper-label': 'clamp(8px, calc(var(--paper-cell) * 0.78), 14px)',
          '--paper-axis': 'clamp(11px, calc(var(--paper-cell) * 1.45), 28px)',
        }}
      >
        <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 w-full'>
        {/* Axis titles stay out of exports — the exported file is the bare
            matrix; the paper supplies its own titles/caption. */}
        <div
          className='font-normal text-black'
          data-export-exclude
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontFamily: 'Arial, sans-serif',
            fontSize: 'var(--paper-axis)',
          }}
        >
          UC Campus
        </div>
        <div className='min-w-0'>
          <table
            className='border-collapse'
            style={{ fontFamily: 'Arial, sans-serif' }}
            aria-label='Paper-style district transfer availability heatmap'
          >
            <tbody>
              {UC_ROWS.map((uc) => (
                <tr key={uc.id}>
                  <th
                    scope='row'
                    className='pr-1 text-right font-normal whitespace-nowrap text-black'
                    style={{ fontSize: 'var(--paper-label)' }}
                  >
                    {uc.id}
                  </th>
                  {DISTRICTS.map((district) => {
                    const liveCell = liveModel.cells.get(cellKey(uc.id, district.index))
                    const live = liveCell?.complete === true
                    const paper = paperValue(uc, district.index)
                    const fill = fillFor({ view, live, paper })
                    return (
                      <td
                        key={district.index}
                        title={titleFor({ uc, district, liveCell, live, paper, view })}
                        aria-label={titleFor({ uc, district, liveCell, live, paper, view })}
                        className='p-0'
                        style={{
                          background: fill,
                          border: `1px solid ${GRID}`,
                          width: 'var(--paper-cell)',
                          minWidth: 'var(--paper-cell)',
                          height: 'var(--paper-cell)',
                        }}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th />
                {DISTRICTS.map((district) => (
                  <td
                    key={district.index}
                    className='p-0 text-center align-top'
                    style={{
                      width: 'var(--paper-cell)',
                      minWidth: 'var(--paper-cell)',
                      height: 'calc(var(--paper-cell) * 1.9)',
                    }}
                  >
                    <span
                      className='inline-block font-normal text-black'
                      style={{
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: 'var(--paper-label)',
                      }}
                    >
                      {district.index}
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          <div
            className='text-center font-normal text-black mt-1'
            data-export-exclude
            style={{ fontFamily: 'Arial, sans-serif', fontSize: 'var(--paper-axis)' }}
          >
            Community College District
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

function DifferenceLegend() {
  return (
    <div className='flex flex-wrap items-center gap-4 text-caption text-ink-subtle'>
      <span className='inline-flex items-center gap-1.5'><Chip color={NAVY} /> same complete</span>
      <span className='inline-flex items-center gap-1.5'><Chip color={WHITE} /> same missing</span>
      <span className='inline-flex items-center gap-1.5'><Chip color={GAIN} /> gained</span>
      <span className='inline-flex items-center gap-1.5'><Chip color={LOSS} /> lost</span>
    </div>
  )
}

function Chip({ color }) {
  return <span className='inline-block w-3 h-3 border border-black' style={{ background: color }} />
}

export default function PaperDistrictHeatmap() {
  const [view, setView] = useState('live')
  const coverage = useCoverage(
    { majorContains: MAJOR_FILTER, groupBy: 'district', requirements: 'paper' },
    { staleTime: 30 * 1000, refetchInterval: 60 * 1000 }
  )
  const rows = coverage.data?.rows || []
  const liveModel = useMemo(() => buildLiveModel(rows), [rows])
  const diff = useMemo(() => compare(liveModel), [liveModel])
  const datasetVersion = coverage.data?.dataset_version || 'unversioned'
  const net = liveModel.complete - PAPER_COMPLETE_COUNT

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }

  if (coverage.isError) {
    return <Alert type='error'>Could not load /analysis/coverage for the paper-style heatmap.</Alert>
  }

  return (
    <Stack gap='section'>
      {/* Controls stay out of PDF/PNG exports — the file should read as a figure. */}
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>View</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {VIEWS.map((mode) => (
              <button
                key={mode.value}
                type='button'
                onClick={() => setView(mode.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  view === mode.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          variant='secondary'
          leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading}
          onClick={() => coverage.refetch()}
        >
          Refresh
        </Button>
        <div className='ml-auto flex flex-wrap items-center gap-2 text-caption text-ink-subtle'>
          <span className='font-mono tabular-nums'>{datasetVersion}</span>
          <span>{coverage.isFetching ? 'Updating' : 'Live endpoint'}</span>
        </div>
      </div>

      {/* Comparison stats are on-screen context, not part of the exported figure. */}
      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Our complete cells', value: intFmt.format(liveModel.complete), sub: `${intFmt.format(PAPER_CELL_COUNT)} district-campus cells`, accent: true },
            { label: 'Paper complete cells', value: intFmt.format(PAPER_COMPLETE_COUNT), sub: 'baseline matrix' },
            { label: 'Net change', value: signedFmt.format(net), sub: `${intFmt.format(diff.changed)} changed cells` },
            { label: 'Matrix agreement', value: `${pctFmt.format(diff.agreementPct)}%`, sub: `${intFmt.format(diff.gained)} gained · ${intFmt.format(diff.lost)} lost` },
          ]}
        />
      </div>

      <PaperMatrix liveModel={liveModel} view={view} />
      {view === 'diff' && <DifferenceLegend />}
    </Stack>
  )
}
