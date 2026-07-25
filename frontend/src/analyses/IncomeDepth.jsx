import React, { useId } from 'react'
import { Alert, EmptyState, Stack, StatStrip } from '../components/ui'
import { useArticulationDepth } from '../shared/query/hooks/useData'
import { majorLabelFor } from '../shared/majors/majorLabel'
import districtIncomeData from '../../../analysis/data/district_income.v1.json'
import { correlation, INCOME_SOURCE } from './IncomeAccess'
import { CA_FIGURE } from './californiaFigureStyle'
import { AnalysisLoading } from './chartBits'

/**
 * Articulation depth and local income — one dot per community college
 * district: how much of each campus program's stated preparation universe
 * (required AND recommended receiver slots, each campus's own template) is
 * articulated there, against the mean income of the area the district serves.
 *
 * Deliberately close to unadorned: one best-fit line (ordinary least squares
 * of coverage on log2 income, so it draws straight on the log axis and its
 * slope reads as coverage points per income doubling), stated correlations,
 * and nothing else. Enrollment and funding overlays are candidate expansions
 * once the basic shape of the relationship is understood.
 */

const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const moneyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
})
const intFmt = new Intl.NumberFormat()

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const DEFAULT_INCOME_BY_DISTRICT = new Map(
  Object.entries(districtIncomeData.districts).map(([name, entry]) => [
    normalizeName(name), entry?.catchment?.mean_agi_per_return,
  ])
)

function ranks(values) {
  const order = values.map((value, index) => [value, index]).sort((a, b) => a[0] - b[0])
  const out = new Array(values.length)
  order.forEach(([, index], rank) => { out[index] = rank })
  return out
}

// OLS of coverage on log2(income). On the figure's log axis this is a straight
// line, and the slope is directly readable: coverage points per income doubling.
function fitLogIncome(points) {
  if (points.length < 3) return null
  const xs = points.map((point) => Math.log2(point.income))
  const ys = points.map((point) => point.coverage)
  const mx = xs.reduce((sum, value) => sum + value, 0) / xs.length
  const my = ys.reduce((sum, value) => sum + value, 0) / ys.length
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < xs.length; i += 1) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (!sxx) return null
  const slopePerDoubling = sxy / sxx
  const intercept = my - slopePerDoubling * mx
  const r = correlation(xs, ys)
  return {
    slopePerDoubling,
    intercept,
    r2: r * r,
    predict: (income) => intercept + slopePerDoubling * Math.log2(income),
  }
}

/**
 * Join depth rows to district income and compute the figure's numbers.
 * `incomeLookup` is injectable for tests; keys are normalized district names.
 */
export function buildIncomeDepthModel(rows = [], incomeLookup = DEFAULT_INCOME_BY_DISTRICT) {
  const points = []
  let unmatched = 0
  for (const row of rows) {
    const income = incomeLookup.get(normalizeName(row.district))
    if (!Number.isFinite(income) || !Number.isFinite(row.coverage_all)) {
      unmatched += 1
      continue
    }
    points.push({
      district: row.district,
      income,
      coverage: row.coverage_all,
      nColleges: row.n_colleges,
      colleges: row.colleges || [],
    })
  }
  if (points.length < 3) {
    return { points, unmatched, pearson: null, spearman: null, fit: null, labeled: new Set() }
  }
  const incomes = points.map((point) => point.income)
  const coverages = points.map((point) => point.coverage)
  const pearson = correlation(incomes, coverages)
  const spearman = correlation(ranks(incomes), ranks(coverages))
  const fit = fitLogIncome(points)

  // Label only the points a reader will ask about: the best two, the worst
  // three, and the richest district.
  const byCoverage = [...points].sort((a, b) => b.coverage - a.coverage)
  const labeled = new Set([
    ...byCoverage.slice(0, 2),
    ...byCoverage.slice(-3),
    [...points].sort((a, b) => b.income - a.income)[0],
  ].map((point) => point.district))

  return { points, unmatched, pearson, spearman, fit, labeled }
}

const FIGURE = {
  width: CA_FIGURE.width,
  height: 680,
  plot: { left: 96, right: 40, top: 64, bottom: 600 },
}

const INCOME_TICKS = [50_000, 75_000, 100_000, 150_000, 200_000, 300_000, 450_000]

export function IncomeDepthFigure({ model, majorLabel }) {
  const id = useId()
  const titleId = `${id}-income-depth-title`
  const descId = `${id}-income-depth-desc`
  const { width, height, plot } = FIGURE
  const { points, labeled, fit } = model
  const clipId = `${id}-plot-clip`

  const incomes = points.map((point) => point.income)
  const minIncome = Math.min(...incomes) * 0.94
  const maxIncome = Math.max(...incomes) * 1.06
  const xFor = (income) => plot.left
    + ((Math.log10(income) - Math.log10(minIncome))
      / (Math.log10(maxIncome) - Math.log10(minIncome)))
    * (width - plot.left - plot.right)
  const yFor = (coverage) => plot.bottom - coverage * (plot.bottom - plot.top)
  const xTicks = INCOME_TICKS.filter((tick) => tick >= minIncome && tick <= maxIncome)
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className='overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${width} ${height}`} role='img'
        aria-labelledby={`${titleId} ${descId}`}
        className='block h-auto w-full' data-export-width={width}
        data-income-depth-figure
        style={{ fontFamily: CA_FIGURE.fontFamily, fontVariantNumeric: 'tabular-nums' }}>
        <title id={titleId}>
          {majorLabel ? `${majorLabel}: ` : ''}articulation depth by community college district against local income
        </title>
        <desc id={descId}>
          Scatter of California community college districts: share of campus-stated
          required and recommended preparation articulated in the district, against
          the mean income of the area the district serves.
        </desc>
        <rect width={width} height={height} fill={CA_FIGURE.background} />
        {majorLabel && (
          <text x={width - 28} y='26' textAnchor='end' fontSize='13' fontWeight='600'
            fill={CA_FIGURE.ink} data-major-label>
            Major: {majorLabel}
          </text>
        )}

        <g aria-hidden='true'>
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={plot.left} y1={yFor(tick)} x2={width - plot.right} y2={yFor(tick)}
                stroke={tick === 0 ? CA_FIGURE.mutedLine : CA_FIGURE.grid}
                strokeWidth={tick === 0 ? 1.5 : 1} />
              <text x={plot.left - 12} y={yFor(tick) + 4} textAnchor='end' fontSize='14'
                fill={CA_FIGURE.ink}>{Math.round(tick * 100)}</text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <g key={tick}>
              <line x1={xFor(tick)} y1={plot.top} x2={xFor(tick)} y2={plot.bottom}
                stroke={CA_FIGURE.grid} strokeWidth='1' />
              <text x={xFor(tick)} y={plot.bottom + 24} textAnchor='middle' fontSize='14'
                fill={CA_FIGURE.ink}>${Math.round(tick / 1000)}k</text>
            </g>
          ))}
        </g>

        {fit && (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect x={plot.left} y={plot.top} width={width - plot.left - plot.right}
                  height={plot.bottom - plot.top} />
              </clipPath>
            </defs>
            <line
              x1={xFor(minIncome)} y1={yFor(fit.predict(minIncome))}
              x2={xFor(maxIncome)} y2={yFor(fit.predict(maxIncome))}
              stroke={CA_FIGURE.ink} strokeWidth='2' strokeDasharray='7 5' strokeOpacity='0.65'
              clipPath={`url(#${clipId})`} data-fit-line
              role='img'
              aria-label={`Best fit: ${fit.slopePerDoubling >= 0 ? 'plus' : 'minus'} ${pctFmt.format(Math.abs(fit.slopePerDoubling) * 100)} coverage points per income doubling`}>
              <title>
                {`Best fit (least squares on log income): ${fit.slopePerDoubling >= 0 ? '+' : '−'}${pctFmt.format(Math.abs(fit.slopePerDoubling) * 100)} coverage points per income doubling · R² ${fit.r2.toFixed(2)}`}
              </title>
            </line>
          </>
        )}

        {points.map((point) => {
          const title = [
            point.district,
            `Articulation depth: ${pctFmt.format(point.coverage * 100)} of stated preparation`,
            `Mean income: ${moneyFmt.format(point.income)} per return`,
            `${intFmt.format(point.nColleges)} college${point.nColleges === 1 ? '' : 's'}: ${point.colleges.join(', ')}`,
          ].join('\n')
          return (
            <g key={point.district}>
              <circle cx={xFor(point.income)} cy={yFor(point.coverage)} r='6'
                fill={CA_FIGURE.blue} fillOpacity='0.55' stroke={CA_FIGURE.blue}
                strokeWidth='1.25' role='img' aria-label={title}
                data-depth-district={point.district}>
                <title>{title}</title>
              </circle>
              {labeled.has(point.district) && (
                <text x={xFor(point.income) + 9} y={yFor(point.coverage) - 8}
                  fontSize='11.5' fill={CA_FIGURE.ink}>
                  {point.district.replace(/ Community College District$/i, '')}
                </text>
              )}
            </g>
          )
        })}

        <text x={(plot.left + width - plot.right) / 2} y={height - 26} textAnchor='middle'
          fontSize='17' fontWeight='500' fill={CA_FIGURE.ink}>
          Mean adjusted gross income per tax return in the district service area (log scale)
        </text>
        <text x='28' y={(plot.top + plot.bottom) / 2} textAnchor='middle'
          transform={`rotate(-90 28 ${(plot.top + plot.bottom) / 2})`}
          fontSize='17' fontWeight='500' fill={CA_FIGURE.ink}>
          Share of stated preparation articulated
        </text>
      </svg>
    </div>
  )
}

export default function IncomeDepth({ majorSlug = 'cs', majorLabel: configuredMajorLabel = '' }) {
  const majorLabel = majorLabelFor(majorSlug, configuredMajorLabel)
  const query = useArticulationDepth({ majorSlug }, {
    staleTime: 0, refetchOnWindowFocus: false, refetchInterval: false,
  })
  const rows = query.data?.rows || []
  const model = buildIncomeDepthModel(rows)

  if (query.isLoading) return <AnalysisLoading />
  if (query.isError) return <Alert type='error'>Could not load articulation depth by district.</Alert>
  if (!model.points.length) {
    return <EmptyState card title='No districts to plot'
      description='No district in scope carries both an articulation agreement for this major and an income estimate.'
      className='p-8' />
  }

  return (
    <Stack gap='section'>
      <div data-export-exclude>
        <StatStrip tiles={[
          {
            label: 'Districts',
            value: intFmt.format(model.points.length),
            sub: model.unmatched
              ? `${intFmt.format(model.unmatched)} without an income match`
              : 'every district matched to income',
          },
          {
            label: 'Slope of the fit',
            value: model.fit
              ? `${model.fit.slopePerDoubling >= 0 ? '+' : '−'}${pctFmt.format(Math.abs(model.fit.slopePerDoubling) * 100)} pts`
              : '—',
            sub: model.fit
              ? `per income doubling · R² ${model.fit.r2.toFixed(2)}`
              : 'needs at least three districts',
            accent: true,
          },
          {
            label: 'Rank correlation',
            value: model.spearman != null ? model.spearman.toFixed(2) : '—',
            sub: 'Spearman, income against depth',
          },
          {
            label: 'Linear correlation',
            value: model.pearson != null ? model.pearson.toFixed(2) : '—',
            sub: 'Pearson, income against depth',
          },
        ]} />
      </div>
      <div data-export-root>
        <IncomeDepthFigure model={model} majorLabel={majorLabel} />
      </div>
      <div role='note' className='surface-card px-4 py-3 text-caption text-ink-muted'>
        <span className='font-semibold text-ink'>How this is measured: </span>
        Each campus program defines its own preparation universe — every required and
        recommended receiver slot in its agreement. A college's depth is the articulated
        share of that universe, averaged across campuses; a district is the mean of its
        colleges. Campuses that encode no recommended layer contribute their required
        universe alone. Income is {INCOME_SOURCE.source.publisher} mean adjusted gross
        income per return for taxable year {INCOME_SOURCE.taxableYear}, rolled up to
        district service areas — a community measure, not a measure of the students
        enrolled.
      </div>
    </Stack>
  )
}
