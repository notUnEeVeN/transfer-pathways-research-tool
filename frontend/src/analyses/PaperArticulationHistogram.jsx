import React, { useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, SwitchField } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { majorLabelFor } from '../shared/majors/majorLabel'
import { buildCoverageMapModel } from './ArticulationCoverageMap'
import {
  CA_DIFFERENCE_COLORS, CA_FIGURE,
} from './californiaFigureStyle'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'

const CS_COVERAGE_PARAMS = {
  majorSlug: 'cs',
  groupBy: 'district',
  requirements: 'paper',
  pin: 'paper',
}

const WIDTH = 960
const HEIGHT = 540
const PLOT = { left: 82, right: 28, top: 82, bottom: 442 }
const PAPER_BLUE = '#287fb8'
const GAIN = '#0d7964'
const LOSS = '#cb1d51'
const intFmt = new Intl.NumberFormat()

const VERSIONS = [
  { value: 'paper', label: 'Paper baseline' },
  { value: 'current', label: 'Current data' },
]

function finishModel(bins) {
  for (const bin of bins) bin.frequency = bin.districts.length
  return {
    bins,
    districtCount: bins.reduce((sum, bin) => sum + bin.frequency, 0),
    maxFrequency: Math.max(0, ...bins.map((bin) => bin.frequency)),
  }
}

/** Reconstruct the frozen Figure 3 baseline from the transcribed paper matrix. */
export function buildPaperArticulationHistogramModel() {
  const bins = Array.from({ length: 10 }, (_, count) => ({ count, districts: [] }))
  for (const district of DISTRICTS) {
    const count = UC_ROWS.reduce(
      (sum, campus) => sum + (campus.bits[district.index] === '1' ? 1 : 0),
      0
    )
    bins[count].districts.push(district)
  }
  return finishModel(bins)
}

export function buildArticulationHistogramModel(rows = []) {
  const coverage = buildCoverageMapModel(rows)
  const bins = Array.from({ length: 10 }, (_, count) => ({ count, districts: [] }))
  for (const district of coverage.districts) bins[district.currentCount].districts.push(district)
  return finishModel(bins)
}

function yScale(value, maxValue) {
  const plotHeight = PLOT.bottom - PLOT.top
  return PLOT.bottom - (value / maxValue) * plotHeight
}

function DifferenceLegend() {
  const items = [
    { label: 'Current', color: PAPER_BLUE },
    { label: 'Added since paper', color: GAIN },
    { label: 'Paper-only', color: LOSS },
  ]
  let x = 578
  return (
    <g aria-label='Difference legend'>
      {items.map((item) => {
        const itemX = x
        x += item.label === 'Added since paper' ? 144 : 94
        return (
          <g key={item.label} transform={`translate(${itemX} 39)`}>
            <rect width='11' height='11' rx='2' fill={item.color} />
            <text x='17' y='10' fontFamily='Arial, sans-serif' fontSize='11' fill='#516158'>
              {item.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function HistogramFigure({ model, paperModel, version, differences }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-histogram-title`
  const descriptionId = `${id}-histogram-description`
  const plotWidth = WIDTH - PLOT.left - PLOT.right
  const slotWidth = plotWidth / model.bins.length
  const barWidth = slotWidth * 0.68
  const yMax = Math.max(5, Math.ceil(Math.max(
    model.maxFrequency,
    paperModel.maxFrequency
  ) / 5) * 5)
  const yTicks = Array.from({ length: yMax / 5 + 1 }, (_, index) => index * 5)
  const subtitle = version === 'paper'
    ? 'Paper baseline · 72 community college districts · Figure 3 method'
    : differences
      ? 'Current data · changes from the paper Figure 3 distribution'
      : 'Current data · 72 community college districts · paper Figure 3 method'

  return (
    <div className='surface-card overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' data-export-width={WIDTH}>
        <title id={titleId}>Distribution of complete campus articulation by district</title>
        <desc id={descriptionId}>
          Histogram of the number of community college districts with complete articulation
          to zero through nine University of California campuses.
        </desc>
        <rect width={WIDTH} height={HEIGHT} fill='#ffffff' />
        <text x='28' y='30' fontFamily='Arial, sans-serif' fontSize='17' fontWeight='700'
          letterSpacing='-0.15' fill='#17251d'>
          Distribution of complete campus articulation
        </text>
        <text x='28' y='51' fontFamily='Arial, sans-serif' fontSize='12' fill='#516158'>
          {subtitle}
        </text>
        {differences && <DifferenceLegend />}

        <g aria-hidden='true'>
          {yTicks.map((tick) => {
            const y = yScale(tick, yMax)
            return (
              <g key={tick}>
                <line x1={PLOT.left} y1={y} x2={WIDTH - PLOT.right} y2={y}
                  stroke={tick === 0 ? '#77847c' : '#dbe1dc'} strokeWidth={tick === 0 ? 1.4 : 1} />
                <text x={PLOT.left - 14} y={y + 4} textAnchor='end'
                  fontFamily='Arial, sans-serif' fontSize='12' fill='#66736b'>{tick}</text>
              </g>
            )
          })}
        </g>

        <g aria-label='Histogram bars'>
          {model.bins.map((bin, index) => {
            const frequency = bin.frequency
            const paperFrequency = paperModel.bins[index].frequency
            const delta = frequency - paperFrequency
            const x = PLOT.left + index * slotWidth + (slotWidth - barWidth) / 2
            const y = yScale(frequency, yMax)
            const height = PLOT.bottom - y
            const paperY = yScale(paperFrequency, yMax)
            // A frozen CS paper value must not affect a selected-major ASSIST
            // figure unless the comparison overlay is actually enabled.
            const comparisonTop = differences ? Math.min(y, paperY) : y
            const names = bin.districts.map((district) => district.name).join(', ')
            const comparison = differences && delta !== 0
              ? `. Paper baseline: ${paperFrequency}; change: ${delta > 0 ? '+' : ''}${delta}`
              : ''
            const label = `${bin.count} complete campuses. ${frequency} ${frequency === 1 ? 'district' : 'districts'}${comparison}${names ? `: ${names}` : ''}`
            return (
              <g key={bin.count} role='img' aria-label={label} tabIndex='0'
                data-histogram-bin={bin.count}>
                <title>{label}</title>
                <rect x={x} y={y} width={barWidth} height={height} rx='3'
                  fill={PAPER_BLUE} className='transition-opacity hover:opacity-80' />
                {differences && delta > 0 && (
                  <rect x={x} y={y} width={barWidth} height={paperY - y} rx='3'
                    fill={GAIN} data-difference='increase' />
                )}
                {differences && delta < 0 && (
                  <rect x={x} y={paperY} width={barWidth} height={y - paperY} rx='3'
                    fill={LOSS} data-difference='decrease' />
                )}
                <text x={x + barWidth / 2}
                  y={Math.max(PLOT.top - 8, comparisonTop - 9)} textAnchor='middle'
                  fontFamily='Arial, sans-serif' fontSize='13' fontWeight='700'
                  fill={differences && delta !== 0 ? (delta > 0 ? GAIN : LOSS) : '#26352c'}>
                  {differences && delta !== 0
                    ? `${frequency} (${delta > 0 ? '+' : ''}${delta})`
                    : frequency}
                </text>
                <text x={x + barWidth / 2} y={PLOT.bottom + 24} textAnchor='middle'
                  fontFamily='Arial, sans-serif' fontSize='13' fill='#26352c'>{bin.count}</text>
              </g>
            )
          })}
        </g>

        <text x={(PLOT.left + WIDTH - PLOT.right) / 2} y='505' textAnchor='middle'
          fontFamily='Arial, sans-serif' fontSize='14' fill='#26352c'>
          Number of UC campuses with complete articulation
        </text>
        <text x='22' y={(PLOT.top + PLOT.bottom) / 2} textAnchor='middle'
          transform={`rotate(-90 22 ${(PLOT.top + PLOT.bottom) / 2})`}
          fontFamily='Arial, sans-serif' fontSize='14' fill='#26352c'>
          Number of districts
        </text>
      </svg>
    </div>
  )
}

const MODERN_HISTOGRAM = {
  width: CA_FIGURE.width,
  // Preserve the legacy renderer's 960 x 540 displayed aspect ratio at the
  // shared 1240-unit publication width. The 12% plot headroom below makes the
  // effective bar area almost exactly the legacy plot height at this scale.
  height: 698,
  plot: { left: 106, right: 36, top: 54, bottom: 586 },
  fillFraction: 0.88,
}

function modernHistogramAxisMax(model, paperModel, differences) {
  const peak = Math.max(
    0,
    model.maxFrequency,
    differences ? paperModel.maxFrequency : 0
  )
  return Math.max(5, Math.ceil(peak / 5) * 5)
}

function roundedTopBarPath(x, y, width, height, radius = 3) {
  if (!(height > 0)) return ''
  const r = Math.min(radius, width / 2, height)
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ')
}

function ModernHistogramLegend() {
  const items = [
    { label: 'Current', color: CA_FIGURE.blue },
    { label: 'Added since paper', color: CA_DIFFERENCE_COLORS.gained },
    { label: 'Paper-only', color: CA_DIFFERENCE_COLORS.lost },
  ]
  let cursor = 775
  return (
    <g aria-label='Difference legend'>
      {items.map((item) => {
        const x = cursor
        cursor += item.label === 'Added since paper' ? 190 : 135
        return (
          <g key={item.label} transform={`translate(${x} 28)`}>
            <rect width='18' height='13' rx='2.5' fill={item.color}
              stroke={CA_FIGURE.grid} strokeWidth='1' />
            <text x='26' y='12' fontSize='14' fill={CA_FIGURE.ink}>{item.label}</text>
          </g>
        )
      })}
    </g>
  )
}

/**
 * Publication renderer for the current-data Figure 3 variants. The paper
 * baseline deliberately continues through HistogramFigure above so the port
 * remains a byte-for-byte visual reference rather than inheriting this skin.
 */
function ModernHistogramFigure({ model, paperModel, differences = false, majorLabel = null }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-modern-histogram-title`
  const descriptionId = `${id}-modern-histogram-description`
  const { width, height, plot, fillFraction } = MODERN_HISTOGRAM
  const plotWidth = width - plot.left - plot.right
  const plotHeight = plot.bottom - plot.top
  const slotWidth = plotWidth / model.bins.length
  const barWidth = slotWidth * 0.56
  const axisMax = modernHistogramAxisMax(model, paperModel, differences)
  const valueY = (value) => plot.bottom
    - (value / axisMax) * fillFraction * plotHeight
  const ticks = Array.from({ length: axisMax / 5 + 1 }, (_, index) => index * 5)

  return (
    <div className='overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${width} ${height}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        data-modern-california-figure='coverage-distribution'
        className='block h-auto w-full' data-export-width={width}
        style={{ fontFamily: CA_FIGURE.fontFamily }}>
        <title id={titleId}>
          {majorLabel ? `${majorLabel}: ` : ''}distribution of complete campus articulation by district
        </title>
        <desc id={descriptionId}>
          Current distribution of California community college districts by the number
          of University of California campuses with complete articulation for {majorLabel || 'the selected major'}.
        </desc>
        <rect width={width} height={height} fill={CA_FIGURE.background} />
        {majorLabel && (
          <text x='36' y='30' fontSize='14' fontWeight='600' fill={CA_FIGURE.ink}
            data-major-label>
            Major: {majorLabel}
          </text>
        )}
        {differences && <ModernHistogramLegend />}

        <g aria-hidden='true'>
          {ticks.map((tick) => {
            const y = valueY(tick)
            return (
              <g key={tick}>
                <line x1={plot.left} y1={y} x2={width - plot.right} y2={y}
                  stroke={tick === 0 ? CA_FIGURE.mutedLine : CA_FIGURE.grid}
                  strokeWidth={tick === 0 ? 1.5 : 1} />
                <text x={plot.left - 12} y={y + 4} textAnchor='end'
                  fontSize='15' fill={CA_FIGURE.ink}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{tick}</text>
              </g>
            )
          })}
        </g>

        <g aria-label='Histogram bars'>
          {model.bins.map((bin, index) => {
            const frequency = bin.frequency
            const paperFrequency = paperModel.bins[index].frequency
            const delta = frequency - paperFrequency
            const x = plot.left + index * slotWidth + (slotWidth - barWidth) / 2
            const y = valueY(frequency)
            const barHeight = plot.bottom - y
            const paperY = valueY(paperFrequency)
            // Keep the CS paper distribution entirely out of single-state
            // ASSIST geometry; it matters only when differences are visible.
            const comparisonTop = differences ? Math.min(y, paperY) : y
            const names = bin.districts.map((district) => district.name).join(', ')
            const comparison = differences && delta !== 0
              ? `. Paper baseline: ${paperFrequency}; change: ${delta > 0 ? '+' : ''}${delta}`
              : ''
            const label = `${bin.count} complete campuses. ${frequency} ${frequency === 1 ? 'district' : 'districts'}${comparison}${names ? `: ${names}` : ''}`
            return (
              <g key={bin.count} role='img' aria-label={label} tabIndex='0'
                data-histogram-bin={bin.count}>
                <title>{label}</title>
                {barHeight > 0 && (
                  <path d={roundedTopBarPath(x, y, barWidth, barHeight)}
                    fill={CA_FIGURE.blue} stroke={CA_FIGURE.grid} strokeWidth='1'
                    className='transition-opacity hover:opacity-80' />
                )}
                {differences && delta > 0 && (
                  <rect x={x} y={y} width={barWidth} height={paperY - y}
                    rx='3' fill={CA_DIFFERENCE_COLORS.gained}
                    data-difference='increase' />
                )}
                {differences && delta < 0 && (
                  <rect x={x} y={paperY} width={barWidth} height={y - paperY}
                    rx='3' fill={CA_DIFFERENCE_COLORS.lost}
                    data-difference='decrease' />
                )}
                <text x={x + barWidth / 2} y={comparisonTop - 10}
                  textAnchor='middle' fontSize='16' fontWeight='500'
                  fill={differences && delta !== 0
                    ? (delta > 0 ? CA_DIFFERENCE_COLORS.gained : CA_DIFFERENCE_COLORS.lost)
                    : CA_FIGURE.ink}
                  data-histogram-value-label={bin.count}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {differences && delta !== 0
                    ? `${frequency} (${delta > 0 ? '+' : ''}${delta})`
                    : frequency}
                </text>
                <text x={x + barWidth / 2} y={plot.bottom + 31} textAnchor='middle'
                  fontSize='16' fill={CA_FIGURE.ink}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{bin.count}</text>
              </g>
            )
          })}
        </g>

        <text x={(plot.left + width - plot.right) / 2} y='665' textAnchor='middle'
          fontSize='18' fontWeight='500' fill={CA_FIGURE.ink}>
          Number of UC campuses with complete articulation
        </text>
        <text x='27' y={(plot.top + plot.bottom) / 2} textAnchor='middle'
          transform={`rotate(-90 27 ${(plot.top + plot.bottom) / 2})`}
          fontSize='18' fontWeight='500' fill={CA_FIGURE.ink}>
          Number of districts
        </text>
      </svg>
    </div>
  )
}

function useHistogramModels(majorSlug = 'cs', configuredMajorLabel = '') {
  const selectedMajorSlug = String(majorSlug || '').trim().toLowerCase() || 'cs'
  const isComputerScience = selectedMajorSlug === 'cs'
  // Figure 3's frozen comparison is defined against the CS paper baseline.
  // Every other major uses its own live ASSIST agreement surface, without a
  // compatibility pin or hand-curated/paper requirements request.
  const coverageParams = isComputerScience
    ? CS_COVERAGE_PARAMS
    : {
      majorSlug: selectedMajorSlug,
      groupBy: 'district',
      requirements: 'assist',
    }
  const coverage = useCoverage(coverageParams, {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const paperModel = useMemo(() => buildPaperArticulationHistogramModel(), [])
  const currentModel = useMemo(() => buildArticulationHistogramModel(rows), [rows])
  return {
    coverage, rows, paperModel, currentModel, isComputerScience,
    majorLabel: majorLabelFor(selectedMajorSlug, configuredMajorLabel),
  }
}

/** Figure-only gallery thumbnail, intentionally pinned to current data. */
export function PaperArticulationHistogramPreview({ majorSlug = 'cs', majorLabel: configuredMajorLabel = '' }) {
  const { coverage, paperModel, currentModel, majorLabel } = useHistogramModels(
    majorSlug, configuredMajorLabel
  )
  if (coverage.isLoading) return <div className='h-full grid place-items-center'><Spinner /></div>
  if (coverage.isError) return <Alert type='error'>Could not load district articulation coverage.</Alert>
  return <ModernHistogramFigure model={currentModel} paperModel={paperModel}
    majorLabel={majorLabel} />
}

export default function PaperArticulationHistogram({
  majorSlug = 'cs',
  majorLabel: configuredMajorLabel = '',
}) {
  const [version, setVersion] = useState('current')
  const [showDiff, setShowDiff] = useState(false)
  const {
    coverage, rows, paperModel, currentModel, isComputerScience, majorLabel,
  } = useHistogramModels(majorSlug, configuredMajorLabel)
  // A component can survive a page-level major change. Paper state never
  // carries into Biology/Economics, even if it was selected moments earlier.
  const activeVersion = isComputerScience ? version : 'current'
  const model = activeVersion === 'paper' ? paperModel : currentModel
  const diffOn = isComputerScience && activeVersion === 'current' && showDiff

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (coverage.isError) {
    return <Alert type='error'>Could not load district articulation coverage for the histogram.</Alert>
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4' data-export-exclude>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end'>
          {isComputerScience && (
            <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6'>
              <div className='flex flex-col' data-control-group='version'>
                <span className='field-label'>Version</span>
                <div className='inline-flex h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
                  {VERSIONS.map((item) => (
                    <button key={item.value} type='button' onClick={() => setVersion(item.value)}
                      className={`px-3 text-button border-r border-border last:border-r-0 ${
                        activeVersion === item.value
                          ? 'bg-primary-soft text-primary'
                          : 'text-ink-muted hover:bg-surface-hover'
                      }`}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className='flex flex-col' data-control-group='comparison'>
                <span className='field-label'>Comparison</span>
                <div className='flex h-9 items-center'>
                  <SwitchField label='Show differences' checked={diffOn}
                    onChange={() => setShowDiff((shown) => !shown)} disabled={activeVersion === 'paper'} />
                </div>
              </div>
            </div>
          )}
          <div className='flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end lg:ml-auto lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0'
            data-control-group='data'>
            <Button className='self-start sm:self-auto' variant='secondary'
              leadingIcon={ArrowPathIcon} loading={coverage.isFetching && !coverage.isLoading}
              onClick={() => coverage.refetch()}>
              Refresh data
            </Button>
          </div>
        </div>
      </div>
      <div data-export-root>
        {activeVersion === 'paper'
          ? <HistogramFigure model={model} paperModel={paperModel}
              version={activeVersion} differences={false} />
          : <ModernHistogramFigure model={model} paperModel={paperModel}
              differences={diffOn} majorLabel={majorLabel} />}
      </div>
    </Stack>
  )
}
