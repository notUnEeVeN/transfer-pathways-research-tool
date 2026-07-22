import React, { useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, SwitchField } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { buildCoverageMapModel } from './ArticulationCoverageMap'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'

const COVERAGE_PARAMS = {
  majorContains: 'computer science',
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
            const comparisonTop = Math.min(y, paperY)
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

export default function PaperArticulationHistogram() {
  const [version, setVersion] = useState('current')
  const [showDiff, setShowDiff] = useState(false)
  const coverage = useCoverage(COVERAGE_PARAMS, {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const paperModel = useMemo(() => buildPaperArticulationHistogramModel(), [])
  const currentModel = useMemo(() => buildArticulationHistogramModel(rows), [rows])
  const model = version === 'paper' ? paperModel : currentModel
  const diffOn = version === 'current' && showDiff

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
          <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6'>
            <div className='flex flex-col' data-control-group='version'>
              <span className='field-label'>Version</span>
              <div className='inline-flex h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
                {VERSIONS.map((item) => (
                  <button key={item.value} type='button' onClick={() => setVersion(item.value)}
                    className={`px-3 text-button border-r border-border last:border-r-0 ${
                      version === item.value
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
                  onChange={() => setShowDiff((shown) => !shown)} disabled={version === 'paper'} />
              </div>
            </div>
          </div>
          <div className='flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between lg:ml-auto lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0'
            data-control-group='data'>
            <span className='text-caption text-ink-subtle'>
              {intFmt.format(rows.length)} district–campus rows · paper-matched requirements
            </span>
            <Button className='self-start sm:self-auto' variant='secondary'
              leadingIcon={ArrowPathIcon} loading={coverage.isFetching && !coverage.isLoading}
              onClick={() => coverage.refetch()}>
              Refresh data
            </Button>
          </div>
        </div>
      </div>
      <div data-export-root>
        <HistogramFigure model={model} paperModel={paperModel}
          version={version} differences={diffOn} />
      </div>
    </Stack>
  )
}
