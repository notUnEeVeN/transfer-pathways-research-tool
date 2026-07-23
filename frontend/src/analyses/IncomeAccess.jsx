import React, { useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import districtIncomeData from '../../../analysis/data/district_income.v1.json'
import mapGeometry from '../../../analysis/data/paper_articulation_map.json'
import { bucketFor } from './ArticulationCoverageMap'

// Two readings of "can this district transfer", as on the coverage map: the
// paper's hand-curated campus minimums, and what ASSIST itself marks required.
const HAND_CURATED_PARAMS = {
  majorSlug: 'cs',
  groupBy: 'district',
  requirements: 'paper',
  pin: 'paper',
}

const ASSIST_PARAMS = {
  majorSlug: 'cs',
  groupBy: 'district',
  requirements: 'assist',
  pin: 'settings',
}

export const REQUIREMENT_VERSIONS = [
  { value: 'hand-curated', label: 'Hand-curated', source: 'hand-curated campus minimums' },
  { value: 'assist', label: 'ASSIST', source: 'ASSIST-stated minimums' },
]

// Campus locations, used only to measure how far a district sits from the
// nearest UC — the geography explanation the footnote has to rule out.
const UC_CAMPUSES = [
  ['Berkeley', -122.2585, 37.8719],
  ['Davis', -121.7617, 38.5382],
  ['Irvine', -117.8443, 33.6405],
  ['Los Angeles', -118.4452, 34.0689],
  ['Merced', -120.4237, 37.3661],
  ['Riverside', -117.3281, 33.9737],
  ['San Diego', -117.2340, 32.8801],
  ['Santa Barbara', -119.8489, 34.4140],
  ['Santa Cruz', -122.0609, 36.9914],
]

// The two figures are a pair — same canvas, type ramp, gridlines and palette —
// so they stack as one exhibit in a manuscript column.
const CANVAS = { width: 960, padX: 28 }
const INK = '#193018'
const MUTED = '#66736b'
const GRID = 'rgba(25,48,24,0.10)'
const BASELINE = '#9CA69B'
const TRACK = '#F6F7F6'
const NAVY = '#1E3A5F'
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', system-ui, sans-serif"
// Light → dark is poorer → richer.
const INCOME_RAMP = ['#A9C3DE', '#6E93BF', '#38618C', '#1E3A5F']
// Okabe-Ito stand-ins for the map's red / amber / green coverage classes.
const TIER_COLORS = { low: '#D55E00', middle: '#E69F00', high: '#009E73' }
const TIERS = [
  { key: 'low', label: '0–3 campuses' },
  { key: 'middle', label: '4–6 campuses' },
  { key: 'high', label: '7–9 campuses' },
]
const POINT_RADIUS = 5.5

/** Fill and inset stroke for a tier: the handoff's 0.72 alpha over a 65% shade. */
function tierPaint(key) {
  const hex = TIER_COLORS[key]
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
  return {
    fill: `rgba(${channels.join(',')},0.72)`,
    stroke: `rgba(${channels.map((value) => Math.round(value * 0.65)).join(',')},0.9)`,
  }
}

const SCATTER = {
  height: 546,
  plot: { x: 74, y: 82, width: 820, height: 360, padTop: 14, padBottom: 10 },
  domain: [44000, 440000],
  ticks: [[50000, '$50k'], [75000, '$75k'], [100000, '$100k'],
    [150000, '$150k'], [250000, '$250k'], [400000, '$400k']],
  legendY: 510,
}

const GRADIENT = {
  height: 392,
  rowHeight: 56,
  top: 86,
  labelRight: 180,
  track: { x: 196, width: 690, height: 28 },
  valueX: 898,
}

const moneyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
const intFmt = new Intl.NumberFormat()

const incomeByDistrict = new Map(
  Object.entries(districtIncomeData.districts).map(([name, entry]) => [normalizeName(name), entry])
)
const centroidByDistrict = new Map(
  mapGeometry.district_centroids.map(([name, longitude, latitude]) => [
    normalizeName(name), [longitude, latitude],
  ])
)

export const INCOME_SOURCE = {
  taxableYear: districtIncomeData.taxable_year,
  source: districtIncomeData.source,
  method: districtIncomeData.method,
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase()
}

function kilometres(a, b) {
  const meanLat = ((a[1] + b[1]) / 2) * (Math.PI / 180)
  return Math.hypot((a[0] - b[0]) * Math.cos(meanLat) * 111.32, (a[1] - b[1]) * 110.57)
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2
}

function standardize(values) {
  const centre = mean(values)
  const spread = Math.sqrt(
    values.reduce((sum, value) => sum + (value - centre) ** 2, 0) / (values.length - 1)
  )
  return spread ? values.map((value) => (value - centre) / spread) : values.map(() => 0)
}

export function correlation(left, right) {
  const leftMean = mean(left)
  const rightMean = mean(right)
  const covariance = left.reduce(
    (sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0
  )
  const spread = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)
    * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)
  )
  return spread ? covariance / spread : NaN
}

/**
 * Ordinary least squares on standardized columns, by Gauss-Jordan on the
 * normal equations. Three predictors over 72 districts, so the direct solve is
 * both exact enough and small enough to keep in the figure.
 */
export function standardizedRegression(outcome, predictors) {
  const y = standardize(outcome)
  const columns = predictors.map(standardize)
  const width = columns.length
  const matrix = columns.map((column) => [
    ...columns.map((other) => column.reduce((sum, value, index) => sum + value * other[index], 0)),
    column.reduce((sum, value, index) => sum + value * y[index], 0),
  ])

  for (let pivot = 0; pivot < width; pivot += 1) {
    let best = pivot
    for (let row = pivot + 1; row < width; row += 1) {
      if (Math.abs(matrix[row][pivot]) > Math.abs(matrix[best][pivot])) best = row
    }
    const swap = matrix[pivot]
    matrix[pivot] = matrix[best]
    matrix[best] = swap
    for (let row = 0; row < width; row += 1) {
      if (row === pivot || !matrix[pivot][pivot]) continue
      const factor = matrix[row][pivot] / matrix[pivot][pivot]
      for (let column = pivot; column <= width; column += 1) {
        matrix[row][column] -= factor * matrix[pivot][column]
      }
    }
  }

  const betas = matrix.map((row, index) => (row[index] ? row[width] / row[index] : 0))
  const fitted = y.map((_, index) =>
    betas.reduce((sum, beta, column) => sum + beta * columns[column][index], 0))
  const residualSum = y.reduce((sum, value, index) => sum + (value - fitted[index]) ** 2, 0)
  const totalSum = y.reduce((sum, value) => sum + value ** 2, 0)
  return { betas, rSquared: totalSum ? 1 - residualSum / totalSum : 0 }
}

/**
 * District access against the income of the area it serves.
 *
 * Access is the district's count of fully articulated UC computer science
 * programs — the coverage-map measure. Income is the Franchise Tax Board
 * catchment mean. Population and distance to the nearest UC come along because
 * they are the two obvious alternative explanations, and the finding is only
 * interesting if income survives them.
 */
export function buildIncomeAccessModel(rows = []) {
  const campuses = new Map()

  for (const row of rows) {
    const name = row.row_group_label || row.community_college_district
    if (!name) continue
    const key = normalizeName(name)
    if (!campuses.has(key)) campuses.set(key, { name, complete: new Set() })
    if (row.fully_articulated === true) {
      campuses.get(key).complete.add(String(row.school_id ?? row.school))
    }
  }

  const districts = []
  for (const [key, entry] of campuses) {
    const income = incomeByDistrict.get(key)
    const catchment = income?.catchment
    if (!catchment?.mean_agi_per_return || !catchment.returns) continue
    const centroid = centroidByDistrict.get(key) || null
    const distances = centroid
      ? UC_CAMPUSES.map(([name, longitude, latitude]) => [
        name, kilometres(centroid, [longitude, latitude]),
      ]).sort((left, right) => left[1] - right[1])
      : null
    districts.push({
      key,
      name: entry.name,
      shortName: entry.name.replace(/\s+Community College District$/i, ''),
      campuses: entry.complete.size,
      income: catchment.mean_agi_per_return,
      returns: catchment.returns,
      bucket: bucketFor(entry.complete.size),
      distanceKm: distances ? Math.max(1, distances[0][1]) : null,
      nearestCampus: distances ? distances[0][0] : null,
    })
  }

  districts.sort((left, right) => left.income - right.income)
  if (districts.length < 4) {
    return { districts, quartiles: [], regression: null, correlation: null }
  }

  const logIncome = districts.map((district) => Math.log(district.income))
  const logReturns = districts.map((district) => Math.log(district.returns))
  const access = districts.map((district) => district.campuses)

  const quartileSize = Math.floor(districts.length / 4)
  const quartiles = [0, 1, 2, 3].map((index) => {
    const start = index * quartileSize
    const members = index === 3
      ? districts.slice(start)
      : districts.slice(start, start + quartileSize)
    return {
      index: index + 1,
      label: `Q${index + 1}`,
      color: INCOME_RAMP[index],
      medianIncome: median(members.map((district) => district.income)),
      campuses: mean(members.map((district) => district.campuses)),
      zeroAccess: members.filter((district) => district.campuses === 0).length,
      size: members.length,
    }
  })

  // The two alternative explanations enter here, not as separate figures: the
  // claim is only interesting if income survives being measured alongside them.
  const located = districts.filter((district) => district.distanceKm)
  const regression = located.length >= 8
    ? standardizedRegression(
      located.map((district) => district.campuses),
      [
        located.map((district) => Math.log(district.income)),
        located.map((district) => Math.log(district.returns)),
        located.map((district) => Math.log(district.distanceKm)),
      ]
    )
    : null

  return {
    districts,
    quartiles,
    regression,
    correlation: correlation(access, logIncome),
    correlationWithPopulation: correlation(access, logReturns),
  }
}

function scatterX(income) {
  const [low, high] = SCATTER.domain
  const span = (Math.log10(income) - Math.log10(low)) / (Math.log10(high) - Math.log10(low))
  return SCATTER.plot.x + span * SCATTER.plot.width
}

function scatterY(campuses) {
  const { y, height, padTop, padBottom } = SCATTER.plot
  return y + padTop + (1 - campuses / 9) * (height - padTop - padBottom)
}

/**
 * Deterministic vertical jitter so the discrete 0–9 counts read as a cloud
 * rather than ten hard lines. The zero row only ever moves up and the nine row
 * only down, so neither clamps against an axis.
 */
export function jitteredCampuses(campuses, index) {
  const noise = Math.sin((index + 1) * 12.9898) * 43758.5453
  const offset = ((noise - Math.floor(noise)) - 0.5) * 0.56
  if (campuses >= 9) return 9 - Math.abs(offset)
  if (campuses <= 0) return Math.abs(offset)
  return Math.max(0, Math.min(9, campuses + offset))
}

function ScatterFigure({ model }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-scatter-title`
  const descriptionId = `${id}-scatter-description`
  const plotBottom = SCATTER.plot.y + SCATTER.plot.height
  const trend = model.quartiles.map((quartile) => ({
    ...quartile,
    x: scatterX(quartile.medianIncome),
    y: scatterY(quartile.campuses),
  }))

  return (
    <svg viewBox={`0 0 ${CANVAS.width} ${SCATTER.height}`} role='img'
      aria-labelledby={`${titleId} ${descriptionId}`}
      className='block h-auto w-full' data-export-width={CANVAS.width}
      data-income-figure='scatter' style={{ fontFamily: FONT }}>
      <title id={titleId}>Richer districts reach more computer science programs</title>
      <desc id={descriptionId}>
        One point per California community college district, plotted by the mean income of
        the area it serves against the number of University of California computer science
        programs it can fully reach, with the mean of each income quartile joined by a line.
      </desc>
      <rect width={CANVAS.width} height={SCATTER.height} fill='#ffffff' />

      <text x={CANVAS.padX} y='46' fontSize='20' fontWeight='600' letterSpacing='-0.3' fill={INK}>
        Richer districts reach more CS programs, district by district
      </text>

      <g aria-hidden='true'>
        {[0, 3, 6, 9].map((tick) => (
          <g key={tick}>
            <line x1={SCATTER.plot.x} y1={scatterY(tick)}
              x2={SCATTER.plot.x + SCATTER.plot.width} y2={scatterY(tick)}
              stroke={tick === 0 ? BASELINE : GRID} strokeWidth={tick === 0 ? 1.5 : 1} />
            <text x={SCATTER.plot.x - 10} y={scatterY(tick) + 4} textAnchor='end'
              fontSize='12' fill={INK}>{tick}</text>
          </g>
        ))}
        {SCATTER.ticks.map(([value, label]) => (
          <text key={value} x={scatterX(value)} y={plotBottom + 22} textAnchor='middle'
            fontSize='12' fill={INK}>{label}</text>
        ))}
      </g>

      <g aria-label='Districts'>
        {model.districts.map((district, index) => {
          const x = scatterX(district.income)
          const y = scatterY(jitteredCampuses(district.campuses, index))
          const label = [
            district.name,
            `${district.campuses} of 9 campuses fully articulated`,
            `${moneyFmt.format(district.income)} mean income per tax return`,
            `${intFmt.format(district.returns)} returns filed`,
            district.distanceKm
              ? `${Math.round(district.distanceKm)} km from ${district.nearestCampus}`
              : null,
          ].filter(Boolean).join('. ')
          const paint = tierPaint(district.bucket.key)
          return (
            <g key={district.key} role='img' aria-label={label} tabIndex='0'
              data-district-point={district.key} data-bucket={district.bucket.key}>
              <title>{label}</title>
              <circle cx={x} cy={y} r={POINT_RADIUS} fill={paint.fill}
                stroke={paint.stroke} strokeWidth='1'
                className='transition-opacity hover:opacity-70' />
            </g>
          )
        })}
      </g>

      <g aria-label='Income-quartile means' data-trend>
        <polyline points={trend.map((point) => `${point.x},${point.y}`).join(' ')}
          fill='none' stroke={NAVY} strokeWidth='2.5' strokeLinejoin='round' />
        {trend.map((point) => (
          <g key={point.index} data-trend-point={point.index}>
            <title>
              {`${point.label}: ${point.campuses.toFixed(1)} of 9 campuses on average`}
            </title>
            <circle cx={point.x} cy={point.y} r='6' fill={NAVY} stroke='#ffffff' strokeWidth='2' />
          </g>
        ))}
      </g>

      <text x={SCATTER.plot.x + SCATTER.plot.width / 2} y={plotBottom + 52} textAnchor='middle'
        fontSize='14' fill={INK}>
        Mean income per tax return in the district&apos;s catchment (log scale)
      </text>
      <text x='34' y={SCATTER.plot.y + SCATTER.plot.height / 2} textAnchor='middle'
        transform={`rotate(-90 34 ${SCATTER.plot.y + SCATTER.plot.height / 2})`}
        fontSize='14' fill={INK}>
        Campuses reachable, of nine
      </text>

      <g aria-label='Legend'>
        {TIERS.map((tier, index) => (
          <g key={tier.key} transform={`translate(${SCATTER.plot.x + index * 150} ${SCATTER.legendY})`}>
            <circle cx='6' cy='-4' r='6' fill={TIER_COLORS[tier.key]} />
            <text x='20' y='0' fontSize='12' fill={INK}>{tier.label}</text>
          </g>
        ))}
        <g transform={`translate(${SCATTER.plot.x + 3 * 150} ${SCATTER.legendY})`}>
          <line x1='0' y1='-4' x2='22' y2='-4' stroke={NAVY} strokeWidth='2.5' />
          <text x='30' y='0' fontSize='12' fill={INK}>Income-quartile mean</text>
        </g>
      </g>

    </svg>
  )
}

function GradientFigure({ model }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-gradient-title`
  const descriptionId = `${id}-gradient-description`
  const scale = (campuses) => (campuses / 9) * GRADIENT.track.width
  const rowsBottom = GRADIENT.top + model.quartiles.length * GRADIENT.rowHeight

  return (
    <svg viewBox={`0 0 ${CANVAS.width} ${GRADIENT.height}`} role='img'
      aria-labelledby={`${titleId} ${descriptionId}`}
      className='block h-auto w-full' data-export-width={CANVAS.width}
      data-income-figure='gradient' style={{ fontFamily: FONT }}>
      <title id={titleId}>Campuses reachable by income quartile</title>
      <desc id={descriptionId}>
        Mean number of University of California campuses a district can fully reach, for
        each quarter of districts ordered by the income of the area they serve.
      </desc>
      <rect width={CANVAS.width} height={GRADIENT.height} fill='#ffffff' />

      <text x={CANVAS.padX} y='46' fontSize='20' fontWeight='600' letterSpacing='-0.3' fill={INK}>
        Students in higher-income districts can reach far more CS programs
      </text>

      {model.quartiles.map((quartile, index) => {
        const centre = GRADIENT.top + index * GRADIENT.rowHeight + GRADIENT.rowHeight / 2
        const trackTop = centre - GRADIENT.track.height / 2
        const label = `${quartile.label}, median ${moneyFmt.format(quartile.medianIncome)}: `
          + `${quartile.campuses.toFixed(1)} of 9 campuses on average across `
          + `${quartile.size} districts`
        return (
          <g key={quartile.index} role='img' aria-label={label} data-quartile={quartile.index}>
            <title>{label}</title>
            <text x={GRADIENT.labelRight} y={centre - 2} textAnchor='end'
              fontSize='14' fontWeight='600' fill={INK}>{quartile.label}</text>
            <text x={GRADIENT.labelRight} y={centre + 15} textAnchor='end'
              fontSize='12' fill={MUTED}>
              {moneyFmt.format(quartile.medianIncome)} median
            </text>

            <rect x={GRADIENT.track.x} y={trackTop} width={GRADIENT.track.width}
              height={GRADIENT.track.height} rx='4' fill={TRACK} />
            {[0, 3, 6, 9].map((tick) => (
              <line key={tick} x1={GRADIENT.track.x + scale(tick)} y1={trackTop - 7}
                x2={GRADIENT.track.x + scale(tick)} y2={trackTop + GRADIENT.track.height + 7}
                stroke={GRID} strokeWidth='1' />
            ))}
            <rect x={GRADIENT.track.x} y={trackTop} width={scale(quartile.campuses)}
              height={GRADIENT.track.height} rx='4' fill={quartile.color}
              stroke={GRID} strokeWidth='1' />
            <text x={GRADIENT.valueX} y={centre + 5} fontSize='14' fontWeight='600' fill={INK}>
              {quartile.campuses.toFixed(1)}
            </text>
          </g>
        )
      })}

      <g aria-hidden='true'>
        {[0, 3, 6, 9].map((tick) => (
          <text key={tick} x={GRADIENT.track.x + scale(tick)} y={rowsBottom + 16}
            textAnchor='middle' fontSize='12' fill={INK}>{tick}</text>
        ))}
        <text x={GRADIENT.track.x + GRADIENT.track.width / 2} y={rowsBottom + 44}
          textAnchor='middle' fontSize='14' fill={INK}>
          Campuses reachable, of nine
        </text>
      </g>

    </svg>
  )
}

export default function IncomeAccess() {
  // ASSIST first — see ArticulationCoverageMap; both figures share the control.
  const [version, setVersion] = useState('assist')
  const options = { staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false }
  const handCurated = useCoverage(HAND_CURATED_PARAMS, options)
  const assist = useCoverage(ASSIST_PARAMS, options)
  const coverage = version === 'assist' ? assist : handCurated
  const rows = coverage.data?.rows || []
  const model = useMemo(() => buildIncomeAccessModel(rows), [rows])

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (coverage.isError) {
    return <Alert type='error'>Could not load district coverage for the income comparison.</Alert>
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-4' data-export-exclude>
        <div className='flex flex-col' data-control-group='version'>
          <span className='field-label'>Transfer requirements</span>
          <div className='inline-flex h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {REQUIREMENT_VERSIONS.map((item) => (
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
        <span className='text-caption text-ink-subtle'>
          Income: {INCOME_SOURCE.source.publisher}, taxable year {INCOME_SOURCE.taxableYear}
        </span>
        <Button className='ml-auto' variant='secondary' leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading}
          onClick={() => coverage.refetch()}>
          Refresh data
        </Button>
      </div>

      {/* One exhibit, two panels: the distribution, then the summary that reads
          off it. Both export together and share every design token. */}
      <div data-export-root className='flex flex-col gap-4'>
        <div className='surface-card overflow-hidden bg-white'>
          <ScatterFigure model={model} />
        </div>
        <div className='surface-card overflow-hidden bg-white'>
          <GradientFigure model={model} />
        </div>
      </div>

      <p className='text-caption text-ink-subtle'>
        Income is the returns-weighted mean over the ZIP codes nearest each district&apos;s
        centre, from{' '}
        <a className='underline underline-offset-2' href={INCOME_SOURCE.source.page}
          target='_blank' rel='noreferrer'>{INCOME_SOURCE.source.name}</a>. It describes an
        area, never a student: this is a district-level association, not a claim about
        individuals, and nothing here identifies a cause.
      </p>
    </Stack>
  )
}
