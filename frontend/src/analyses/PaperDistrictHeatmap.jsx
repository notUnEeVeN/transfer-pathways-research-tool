import React, { useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, StatStrip, SwitchField } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { DISTRICTS, PAPER_CELL_COUNT, PAPER_COMPLETE_COUNT, UC_ROWS } from './paperDistrictBaseline'
import {
  CA_DIFFERENCE_COLORS, CA_FIGURE, CA_QUARTER_NOTE,
} from './californiaFigureStyle'

const NAVY = '#1a237e'
const WHITE = '#ffffff'
const GAIN = '#0d7964'
const LOSS = '#cb1d51'
const GRID = '#111111'

// The three meaningful matrices: the transcribed paper original, and our data
// against each minimums source. "Difference" is an overlay (a toggle), not a version.
const VERSIONS = [
  { value: 'paper', label: 'Paper baseline' },
  { value: 'website', label: 'Hand-curated minimums' },
  { value: 'assist', label: 'ASSIST minimums' },
]

// Which requirements model "complete" is measured against:
//   paper  — the hand-curated university-website hard minimums
//            (curated transfer-minimum requirements), the paper's methodology.
//   assist — ASSIST's own stated requirement surface: a cell is complete when
//            at least one CS program at the campus has EVERY receiver in its
//            required agreement groups articulated (curation overrides
//            honored). Far stricter in practice — ASSIST pages list required
//            receivers that articulate almost nowhere.

// Row label under each mode. Campus names keep the paper's `*` annotation
// (selective-admission majors) so the two modes stay comparable.
function rowLabel(uc, labelMode) {
  if (labelMode !== 'names') return uc.id
  return uc.campus.replace(/^UC\s+/i, '') + (uc.id.endsWith('*') ? '*' : '')
}

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

function titleFor({ uc, district, liveCell, live, paper, view, reqMode }) {
  const parts = [
    `${uc.id} · ${uc.campus}`,
    `District ${district.index}: ${district.name}`,
    `Cell: ${labelFor({ view, live, paper })}`,
    `Our data (${reqMode === 'assist' ? 'ASSIST-stated minimums' : 'hand-curated minimums'}): ${live ? 'complete' : 'missing'}`,
    `Paper baseline: ${paper ? 'complete' : 'missing'}`,
  ]
  if (liveCell) {
    if (Number.isFinite(liveCell.bestPct)) parts.push(`Best live coverage: ${pctFmt.format(liveCell.bestPct)}%`)
    parts.push(`${intFmt.format(liveCell.programs.size)} live CS program${liveCell.programs.size === 1 ? '' : 's'}`)
  }
  return parts.join('\n')
}

function PaperMatrix({ liveModel, view, labelMode, reqMode }) {
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
          // floor). Campus-name labels are wider than the paper's UC ids, so
          // that mode reserves a bigger label column.
          '--paper-cell': labelMode === 'names'
            ? 'clamp(4px, calc((100cqw - 195px) / 72), 18px)'
            : 'clamp(4px, calc((100cqw - 100px) / 72), 18px)',
          '--paper-label': 'clamp(8px, calc(var(--paper-cell) * 0.78), 14px)',
          '--paper-axis': 'clamp(11px, calc(var(--paper-cell) * 1.45), 28px)',
        }}
      >
        <div className='grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 w-full'>
          {/* Axis titles are part of the figure and remain in PNG/PDF exports. */}
          <div
            className='font-normal text-black'
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
                    {rowLabel(uc, labelMode)}
                  </th>
                  {DISTRICTS.map((district) => {
                    const liveCell = liveModel.cells.get(cellKey(uc.id, district.index))
                    const live = liveCell?.complete === true
                    const paper = paperValue(uc, district.index)
                    const fill = fillFor({ view, live, paper })
                    return (
                      <td
                        key={district.index}
                        title={titleFor({ uc, district, liveCell, live, paper, view, reqMode })}
                        aria-label={titleFor({ uc, district, liveCell, live, paper, view, reqMode })}
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
                        // Vertical text's width is its line box; at 1.5 it
                        // exceeds --paper-cell and (border-collapse) forces
                        // every column wider than the cell var. 1 keeps the
                        // label narrower than the cell at every size.
                        lineHeight: 1,
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

const MODERN_MATRIX = {
  width: CA_FIGURE.width,
  height: 320,
  left: 138,
  // 1079 px yields exactly 72 × 14 px cells + 71 × 1 px gaps. Integer
  // geometry prevents browser antialiasing from making some white cells look
  // more heavily bordered than their neighbours.
  right: 23,
  top: 22,
  rowHeight: 20,
  rowGap: 1,
}

function modernFillFor({ view, live, paper }) {
  if (view === 'live') return live ? CA_FIGURE.blue : CA_FIGURE.background
  if (live && paper) return CA_FIGURE.blue
  if (!live && !paper) return CA_FIGURE.background
  return live ? CA_DIFFERENCE_COLORS.gained : CA_DIFFERENCE_COLORS.lost
}

function modernCampusLabel(uc, labelMode) {
  return labelMode === 'paper'
    ? uc.id
    : uc.campus.replace(/^UC\s+/i, '') + (uc.id.endsWith('*') ? '*' : '')
}

function ModernLegend({ differences, y }) {
  const items = differences
    ? [
      ['same complete', CA_FIGURE.blue],
      ['same incomplete', CA_FIGURE.background],
      ['gained', CA_DIFFERENCE_COLORS.gained],
      ['lost', CA_DIFFERENCE_COLORS.lost],
    ]
    : [
      ['Complete articulation', CA_FIGURE.blue],
      ['Incomplete', CA_FIGURE.background],
    ]
  let cursor = 24

  return (
    <g aria-label={differences ? 'Difference legend' : 'Coverage legend'}>
      {items.map(([label, color]) => {
        const x = cursor
        cursor += 31 + label.length * 7.1
        return (
          <g key={label} transform={`translate(${x} ${y})`}>
            <rect width='14' height='14' rx='2' fill={color}
              stroke={color === CA_FIGURE.background ? CA_FIGURE.mutedLine : CA_FIGURE.grid} />
            <text x='21' y='11.5' fontSize='12' fill={CA_FIGURE.ink}>{label}</text>
          </g>
        )
      })}
    </g>
  )
}

/** Publication renderer from the modern handoff, fed by the exact live model. */
export function ModernCoverageMatrix({ liveModel, view = 'live', labelMode = 'names', reqMode = 'paper' }) {
  const { width, height, left, right, top, rowHeight, rowGap } = MODERN_MATRIX
  const plotWidth = width - left - right
  const columnGap = 1
  const cellWidth = (plotWidth - columnGap * (DISTRICTS.length - 1)) / DISTRICTS.length
  const plotHeight = UC_ROWS.length * rowHeight + (UC_ROWS.length - 1) * rowGap
  const differences = view === 'diff'
  const xFor = (index) => left + index * (cellWidth + columnGap)
  const yFor = (index) => top + index * (rowHeight + rowGap)

  return (
    <div className='overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${width} ${height}`} role='img'
        aria-label='Community college district transfer coverage by University of California campus'
        className='block h-auto w-full' data-export-width={width}
        data-modern-california-figure='coverage-matrix'
        style={{ fontFamily: CA_FIGURE.fontFamily, fontVariantNumeric: 'tabular-nums' }}>
        <rect width={width} height={height} fill={CA_FIGURE.background} />
        <text x='34' y={top + plotHeight / 2} textAnchor='middle'
          transform={`rotate(-90 34 ${top + plotHeight / 2})`}
          fontSize='14' fontWeight='500' fill={CA_FIGURE.ink}>UC Campus</text>

        <rect x={left} y={top} width={plotWidth} height={plotHeight}
          fill={CA_FIGURE.grid} data-matrix-grid shapeRendering='crispEdges' />

        {UC_ROWS.map((uc, rowIndex) => {
          const y = yFor(rowIndex)
          return (
            <g key={uc.id} data-matrix-row={uc.id}>
              <text x={left - 12} y={y + rowHeight / 2 + 4} textAnchor='end'
                fontSize='12' fill={CA_FIGURE.ink}>
                {modernCampusLabel(uc, labelMode)}
              </text>
              {DISTRICTS.map((district) => {
                const liveCell = liveModel.cells.get(cellKey(uc.id, district.index))
                const live = liveCell?.complete === true
                const paper = paperValue(uc, district.index)
                const label = titleFor({ uc, district, liveCell, live, paper, view, reqMode })
                return (
                  <rect key={district.index} x={xFor(district.index)} y={y}
                    width={cellWidth} height={rowHeight}
                    fill={modernFillFor({ view, live, paper })}
                    shapeRendering='crispEdges'
                    aria-label={label} data-matrix-cell={`${uc.id}|${district.index}`}>
                    <title>{label}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}

        <rect x={left - 0.5} y={top - 0.5} width={plotWidth + 1} height={plotHeight + 1}
          fill='none' stroke={CA_FIGURE.grid} shapeRendering='crispEdges' />

        {DISTRICTS.filter((district) => district.index % 5 === 0).map((district) => (
          <text key={district.index} x={xFor(district.index) + cellWidth / 2}
            y={top + plotHeight + 22} textAnchor='middle' fontSize='12' fill={CA_FIGURE.ink}>
            {district.index}
          </text>
        ))}
        <text x={left + plotWidth / 2} y={top + plotHeight + 45} textAnchor='middle'
          fontSize='14' fontWeight='500' fill={CA_FIGURE.ink}>
          Community College District
        </text>
        <ModernLegend differences={differences} y={height - 32} />
        <text x={differences ? 650 : 430} y={height - 20} fontSize='12' fill={CA_FIGURE.ink}>
          {CA_QUARTER_NOTE}
        </text>
      </svg>
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

/**
 * `presentation` pins the figure to the ASSIST-minimums version and hides the
 * version and difference controls. The showcase uses it so a walkthrough shows
 * current California data rather than the reproduced paper baseline.
 */
export function PaperDistrictHeatmapPreview() {
  return <PaperDistrictHeatmap preview />
}

export default function PaperDistrictHeatmap({ presentation = false, preview = false }) {
  // ASSIST first in both the console and the presentation skin.
  const [version, setVersion] = useState('assist')  // 'paper' | 'website' | 'assist'
  const [showDiff, setShowDiff] = useState(false)
  const [labelMode, setLabelMode] = useState('names')

  // Derive the underlying view/minimums from version + differences toggle. Note the
  // coverage endpoint uses requirements:'paper' for the website minimums.
  const reqMode = version === 'assist' ? 'assist' : 'paper'
  const diffOn = showDiff && version !== 'paper'
  const view = version === 'paper' ? 'paper' : (diffOn ? 'diff' : 'live')
  // Fetch on mount, no polling (data is stagnant); Refresh re-fetches on
  // demand. The ASSIST-minimums variant fetches lazily on first selection and
  // then stays cached, so flipping the toggle is instant afterwards.
  // Both compatibility pins resolve to the exact nine campus/program pairs in
  // the canonical CS config and ignore partner-visibility settings. The two
  // requests differ only in their requirement source: hand-curated paper
  // minimums versus the canonical CS ASSIST trees.
  const paperCoverage = useCoverage(
    { majorSlug: 'cs', groupBy: 'district', requirements: 'paper', pin: 'paper' },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  )
  const assistCoverage = useCoverage(
    { majorSlug: 'cs', groupBy: 'district', requirements: 'assist', pin: 'settings' },
    { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false, enabled: reqMode === 'assist' }
  )
  const coverage = reqMode === 'assist' ? assistCoverage : paperCoverage
  const rows = coverage.data?.rows || []
  const liveModel = useMemo(() => buildLiveModel(rows), [rows])
  const diff = useMemo(() => compare(liveModel), [liveModel])
  const datasetVersion = coverage.data?.dataset_version || 'unversioned'
  const net = liveModel.complete - PAPER_COMPLETE_COUNT

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }

  if (coverage.isError) {
    return <Alert type='error'>Could not load the coverage data for the paper-style heatmap.</Alert>
  }

  if (preview) {
    return (
      <div data-export-root>
        <ModernCoverageMatrix liveModel={liveModel} view='live' labelMode='names' reqMode='paper' />
      </div>
    )
  }

  return (
    <Stack gap='section'>
      {/* Controls stay out of PDF/PNG exports — the file should read as a figure. */}
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        {!presentation && (
          <>
            <div className='flex flex-col'>
              <span className='field-label'>Version</span>
              <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
                {VERSIONS.map((v) => (
                  <button
                    key={v.value}
                    type='button'
                    onClick={() => setVersion(v.value)}
                    className={`px-3 text-button border-r border-border last:border-r-0 ${
                      version === v.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className='flex h-9 items-center'>
              <SwitchField
                label='Show differences'
                checked={diffOn}
                onChange={() => setShowDiff((s) => !s)}
                disabled={version === 'paper'}
              />
            </div>
          </>
        )}
        <Button
          variant='secondary'
          leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading}
          onClick={() => coverage.refetch()}
        >
          Refresh
        </Button>
        <div className='ml-auto flex h-9 flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
          <span className='font-mono tabular-nums'>{datasetVersion}</span>
          <span>{coverage.isFetching ? 'Updating…' : 'Refresh to update'}</span>
        </div>
      </div>

      {/* Comparison stats are on-screen context, not part of the exported figure. */}
      <div data-export-exclude>
        <StatStrip
          tiles={[
            { label: 'Our complete cells', value: intFmt.format(liveModel.complete), sub: reqMode === 'assist' ? 'per ASSIST-stated minimums' : 'per hand-curated minimums', accent: true },
            { label: 'Paper complete cells', value: intFmt.format(PAPER_COMPLETE_COUNT), sub: 'baseline · hand-curated minimums' },
            { label: 'Net vs paper', value: signedFmt.format(net), sub: `${intFmt.format(diff.changed)} changed cells` },
            { label: 'Matrix agreement', value: `${pctFmt.format(diff.agreementPct)}%`, sub: `${intFmt.format(diff.gained)} gained · ${intFmt.format(diff.lost)} lost` },
          ]}
        />
      </div>

      <div data-export-root className='flex flex-col gap-4'>
        {version === 'paper'
          ? <PaperMatrix liveModel={liveModel} view={view} labelMode={labelMode} reqMode={reqMode} />
          : <ModernCoverageMatrix liveModel={liveModel} view={view} labelMode={labelMode} reqMode={reqMode} />}
        <div
          className='flex flex-wrap items-center gap-4'
          data-export-exclude={view === 'diff' ? undefined : 'controls-only'}
        >
          {view === 'diff' && version === 'paper' && <DifferenceLegend />}
          {/* Deliberately quiet: label naming is a reading preference, not an
              analysis control, so it lives under the matrix as plain text. */}
          <button
            type='button'
            data-export-exclude
            onClick={() => setLabelMode(labelMode === 'paper' ? 'names' : 'paper')}
            className='ml-auto text-tag font-mono text-ink-subtle hover:text-ink underline underline-offset-2'
          >
            {labelMode === 'paper' ? 'show campus names' : 'show UC1–9 ids'}
          </button>
        </div>
      </div>
    </Stack>
  )
}
