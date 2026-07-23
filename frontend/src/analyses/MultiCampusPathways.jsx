import React, { useId } from 'react'
import portfolioSnapshot from './data/district-portfolio-subsets.v1.json'

const FIGURE = { width: 1120, height: 1064 }
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', system-ui, sans-serif"
const INK = '#193018'
const BODY = '#3F4840'
const MUTED = '#5F6A60'
const LIME = '#96F060'
const MINT = '#EFF8E5'
const SAGE = '#F6F8F1'
const TRACK = '#E8EDE3'
const HAIRLINE = 'rgba(25,48,24,0.10)'
const GRID = 'rgba(25,48,24,0.08)'
const CORAL = '#D22F14'

const ROW_TOP = 342
const ROW_HEIGHT = 62
const COURSE_PLOT = { x: 352, width: 400, min: 6, max: 24 }
const EVIDENCE_TRACK = { x: 145, width: 94 }

const intFmt = new Intl.NumberFormat()
const oneFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

function numberOrNull(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function courseX(value) {
  const number = Math.max(COURSE_PLOT.min, Math.min(COURSE_PLOT.max, Number(value)))
  return COURSE_PLOT.x
    + ((number - COURSE_PLOT.min) / (COURSE_PLOT.max - COURSE_PLOT.min)) * COURSE_PLOT.width
}

function diamondPoints(x, y, radius = 5.5) {
  return `${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}`
}

function normalizeStats(stats) {
  if (!stats || typeof stats !== 'object') return null
  const normalized = {}
  for (const field of ['n', 'mean', 'median', 'q1', 'q3', 'min', 'max']) {
    normalized[field] = numberOrNull(stats[field])
  }
  return normalized.mean == null ? null : normalized
}

/** Convert the compact, generated artifact into the exact values drawn. */
export function buildPortfolioFigureModel(data = {}) {
  const rows = (Array.isArray(data.rows) ? data.rows : [])
    .map((row) => {
      const portfolioSize = numberOrNull(row.portfolio_size)
      const courses = normalizeStats(row.district_equal?.distinct_courses)
      const years = normalizeStats(row.district_equal?.academic_years)
      return {
        portfolioSize,
        scenarioCount: numberOrNull(row.scenario_count) || 0,
        eligibleDistrictCount: numberOrNull(row.eligible_district_count) || 0,
        representedDistrictCount: numberOrNull(row.represented_district_count) || 0,
        usableScenarioCount: numberOrNull(row.usable_scenario_count) || 0,
        exactScenarioCount: numberOrNull(row.exact_scenario_count) || 0,
        boundedScenarioCount: numberOrNull(row.bounded_scenario_count) || 0,
        unavailableScenarioCount: numberOrNull(row.unavailable_scenario_count) || 0,
        exactSharePct: numberOrNull(row.exact_share_pct) || 0,
        courses,
        years,
        semesterEquivalentTerms: years?.mean == null ? null : years.mean * 2,
        fixedCohortCourseMean: numberOrNull(
          row.fixed_high_access_cohort?.distinct_courses?.mean
        ),
        pathWeightedCourseMean: numberOrNull(row.path_weighted?.distinct_courses?.mean),
        overlapSavingsMean: numberOrNull(row.overlap_savings_courses?.mean),
      }
    })
    .filter((row) => row.portfolioSize != null && row.courses && row.years)
    .sort((left, right) => left.portfolioSize - right.portfolioSize)

  const first = rows[0] || null
  const last = rows[rows.length - 1] || null
  const pathWeightingMaxDifference = rows.reduce((maximum, row) => Math.max(
    maximum,
    Math.abs((row.pathWeightedCourseMean ?? row.courses.mean) - row.courses.mean),
  ), 0)
  const fixedCohortMaxDifference = rows.reduce((maximum, row) => Math.max(
    maximum,
    Math.abs((row.fixedCohortCourseMean ?? row.courses.mean) - row.courses.mean),
  ), 0)

  return {
    rows,
    first,
    last,
    summary: data.summary || {},
    generatedAt: data.generated_at || null,
    commonProgramCodes: data.fixed_high_access_cohort?.common_program_codes || [],
    fixedCohortDistrictCount:
      numberOrNull(data.fixed_high_access_cohort?.district_count) || 0,
    pathWeightingMaxDifference,
    fixedCohortMaxDifference,
  }
}

function FigureHeader({ model }) {
  const firstCourses = oneFmt.format(model.first.courses.mean)
  const lastCourses = oneFmt.format(model.last.courses.mean)
  return (
    <g>
      <text x='44' y='48' fontSize='11' fontWeight='700' letterSpacing='1.15' fill={MUTED}>
        MULTI-CAMPUS PREPARATION · CALIFORNIA COMMUNITY COLLEGES
      </text>
      <text x='44' y='87' fontSize='33' fontWeight='700' letterSpacing='-1.05' fill={INK}>
        How much preparation keeps more UC CS options open?
      </text>
      <text x='44' y='120' fontSize='15' fill={BODY}>
        For every district, we modeled every real combination of one to seven reachable UC programs.
      </text>
      <text x='44' y='142' fontSize='15' fill={BODY}>
        Combinations are averaged within each district first, then every represented district receives equal weight.
      </text>

      <rect x='44' y='166' width='1032' height='62' rx='14' fill={SAGE} stroke={HAIRLINE} />
      <text x='66' y='191' fontSize='17' fill={INK}>
        <tspan fontWeight='700'>{firstCourses} → {lastCourses} courses.</tspan>
        <tspan> Keeping seven UC options open roughly doubles—not septuples—the modeled coursework.</tspan>
      </text>
      <text x='66' y='213' fontSize='13' fill={BODY}>
        The fixed 13-district cohort follows nearly the same curve; shared requirements drive most of the reuse.
      </text>
    </g>
  )
}

function ChartHeader() {
  return (
    <g>
      <text x='54' y='256' fontSize='12' fontWeight='700' letterSpacing='.65' fill={INK}>
        UC OPTIONS
      </text>
      <text x='54' y='274' fontSize='11' fill={MUTED}>retained</text>

      <text x='145' y='256' fontSize='12' fontWeight='700' letterSpacing='.65' fill={INK}>
        MODELED EVIDENCE
      </text>
      <text x='145' y='274' fontSize='11' fill={MUTED}>eligible districts · real portfolios</text>

      <text x='352' y='256' fontSize='12' fontWeight='700' letterSpacing='.65' fill={INK}>
        DISTINCT COURSES IN THE JOINT PLAN
      </text>
      <text x='352' y='274' fontSize='11' fill={MUTED}>district-equal mean; distribution across district averages</text>

      <text x='905' y='256' fontSize='12' fontWeight='700' letterSpacing='.65' fill={INK}>
        REGULAR TERMS
      </text>
      <text x='905' y='274' fontSize='11' fill={MUTED}>semester-equivalent</text>

      {[6, 12, 18, 24].map((tick) => (
        <text key={tick} x={courseX(tick)} y='303' textAnchor='middle' fontSize='11' fill={MUTED}>
          {tick}
        </text>
      ))}

      <g transform='translate(352 323)'>
        <line x1='0' y1='0' x2='20' y2='0' stroke={INK} strokeOpacity='.35' strokeWidth='3' />
        <rect x='5' y='-5' width='10' height='10' rx='2' fill={INK} fillOpacity='.14'
          stroke={INK} strokeOpacity='.42' />
        <circle cx='10' cy='0' r='4.5' fill={INK} stroke='#fff' strokeWidth='1.5' />
        <text x='27' y='4' fontSize='11' fill={BODY}>all represented districts · IQR + range</text>
      </g>
      <g transform='translate(614 323)'>
        <polygon points={diamondPoints(6, 0, 5)} fill='#fff' stroke={INK} strokeWidth='1.5' />
        <text x='18' y='4' fontSize='11' fill={BODY}>same 13 high-access districts</text>
      </g>
    </g>
  )
}

function PortfolioRow({ row, index, isMaximum }) {
  const top = ROW_TOP + index * ROW_HEIGHT
  const baseline = top + 25
  const courses = row.courses
  const cohortX = courseX(row.fixedCohortCourseMean)
  const exactWidth = EVIDENCE_TRACK.width * (row.exactSharePct / 100)
  const districtLabel = row.representedDistrictCount === row.eligibleDistrictCount
    ? `${intFmt.format(row.eligibleDistrictCount)} districts`
    : `${intFmt.format(row.eligibleDistrictCount)} eligible districts`

  return (
    <g data-portfolio-row={row.portfolioSize}>
      {isMaximum && (
        <>
          <rect x='44' y={top} width='1032' height={ROW_HEIGHT} fill={MINT} />
          <rect x='44' y={top} width='4' height={ROW_HEIGHT} rx='2' fill={LIME} />
        </>
      )}
      <line x1='44' y1={top} x2='1076' y2={top} stroke={HAIRLINE} />

      {[6, 12, 18, 24].map((tick) => (
        <line key={tick} x1={courseX(tick)} y1={top + 5} x2={courseX(tick)} y2={top + 55}
          stroke={GRID} />
      ))}

      <text x='54' y={baseline + 7} fontSize='25' fontWeight='700' letterSpacing='-.8' fill={INK}>
        {row.portfolioSize}
      </text>
      {isMaximum && (
        <g transform={`translate(82 ${baseline - 10})`}>
          <rect width='34' height='18' rx='9' fill={LIME} />
          <text x='17' y='12.5' textAnchor='middle' fontSize='9' fontWeight='700'
            letterSpacing='.5' fill={INK}>MAX</text>
        </g>
      )}

      <text x='145' y={baseline - 7} fontSize='12.5' fontWeight='650' fill={INK}>
        {districtLabel} · {intFmt.format(row.scenarioCount)} plans
      </text>
      <rect x={EVIDENCE_TRACK.x} y={baseline + 5} width={EVIDENCE_TRACK.width} height='7'
        rx='3.5' fill={TRACK} />
      <rect x={EVIDENCE_TRACK.x} y={baseline + 5} width={exactWidth} height='7'
        rx='3.5' fill={INK} />
      <text x='247' y={baseline + 13} fontSize='10.5' fill={MUTED}>
        {row.representedDistrictCount !== row.eligibleDistrictCount
          ? `${row.representedDistrictCount} represented · `
          : ''}{Math.round(row.exactSharePct)}% proven
      </text>

      <line x1={courseX(courses.min)} y1={baseline} x2={courseX(courses.max)} y2={baseline}
        stroke={INK} strokeOpacity='.30' strokeWidth='4' strokeLinecap='round' />
      <rect x={courseX(courses.q1)} y={baseline - 8}
        width={Math.max(2, courseX(courses.q3) - courseX(courses.q1))} height='16' rx='3'
        fill={INK} fillOpacity='.14' stroke={INK} strokeOpacity='.42' />
      <circle cx={courseX(courses.mean)} cy={baseline} r='5.5' fill={INK}
        stroke='#fff' strokeWidth='2' />
      <polygon points={diamondPoints(cohortX, baseline + 18)} fill='#fff' stroke={INK}
        strokeWidth='1.5' />
      <text x='778' y={baseline + 6} fontSize='18' fontWeight='700'
        letterSpacing='-.4' fill={INK}>{oneFmt.format(courses.mean)}</text>

      <text x='905' y={baseline + 4} fontSize='17' fontWeight='700'
        letterSpacing='-.35' fill={INK}>{oneFmt.format(row.semesterEquivalentTerms)}</text>
      <text x='944' y={baseline + 4} fontSize='12' fill={MUTED}>terms</text>
      <text x='905' y={baseline + 21} fontSize='11' fill={MUTED}>
        ≈ {oneFmt.format(row.years.mean)} academic years
      </text>
    </g>
  )
}

function CeilingNote({ model }) {
  const codes = model.commonProgramCodes.join(', ')
  return (
    <g>
      <rect x='44' y='798' width='1032' height='76' rx='16' fill={SAGE} stroke={HAIRLINE} />
      <text x='68' y='825' fontSize='11' fontWeight='700' letterSpacing='.8' fill={MUTED}>
        WHY THE CHART ENDS AT SEVEN
      </text>
      <text x='68' y='847' fontSize='14.5' fontWeight='700' fill={INK}>
        No district completes the pinned UCLA or UCSD
      </text>
      <text x='68' y='865' fontSize='14.5' fontWeight='700' fill={INK}>
        pathway under the strict pinned-template method.
      </text>
      <text x='650' y='825' fontSize='11' fontWeight='700' letterSpacing='.8' fill={MUTED}>
        THE COMMON SEVEN
      </text>
      <text x='650' y='849' fontSize='14' fill={BODY}>{codes}</text>
    </g>
  )
}

function MethodNote({ model }) {
  const exact = intFmt.format(model.summary.exact_scenarios || 0)
  const bounded = intFmt.format(model.summary.bounded_scenarios || 0)
  const total = intFmt.format(model.summary.scenarios_total || 0)
  const unavailable = intFmt.format(model.summary.unavailable_scenarios || 0)
  return (
    <g>
      <rect x='44' y='894' width='1032' height='118' rx='16' fill='#fff' stroke={HAIRLINE} />
      <circle cx='69' cy='919' r='10' fill={MINT} stroke={HAIRLINE} />
      <text x='69' y='923' textAnchor='middle' fontSize='12' fontWeight='700' fill={INK}>i</text>
      <text x='88' y='923' fontSize='13' fontWeight='700' fill={INK}>How to read this</text>
      <text x='68' y='947' fontSize='12.5' fill={BODY}>
        Each row averages all usable portfolios of that size within a district, then gives districts equal weight. Boxes show the middle 50%
      </text>
      <text x='68' y='966' fontSize='12.5' fill={BODY}>
        of district averages; whiskers show their range. Courses include pinned ASSIST major preparation plus modeled prerequisites, count a
      </text>
      <text x='68' y='985' fontSize='12.5' fill={BODY}>
        shared physical course once, and allow cross-enrollment within a district. Time assumes 15 native units and regular-term availability.
      </text>
      <text x='68' y='1002' fontSize='11.5' fontWeight='650' fill={CORAL}>
        Preliminary solver sensitivity: {exact} of {total} plans are proven minima; {bounded} are feasible upper bounds and {unavailable} are omitted.
      </text>
    </g>
  )
}

function SourceNote({ model }) {
  const usable = intFmt.format(model.summary.usable_scenarios || 0)
  const total = intFmt.format(model.summary.scenarios_total || 0)
  return (
    <g>
      <line x1='44' y1='1032' x2='1076' y2='1032' stroke={HAIRLINE} />
      <text x='44' y='1052' fontSize='10.8' fill={MUTED}>
        <tspan fontWeight='700' fill={BODY}>Source. </tspan>
        Pinned ASSIST CS/EECS templates for nine UC campuses across 72 districts (115 colleges), July 2026; {usable} of {total} modeled portfolios usable.
      </text>
    </g>
  )
}

function PortfolioFigure({ model, compact = false }) {
  const rawId = useId().replace(/:/g, '')
  const titleId = `${rawId}-portfolio-title`
  const descriptionId = `${rawId}-portfolio-description`

  if (compact) {
    const maxCourses = Math.max(...model.rows.map((row) => row.courses.mean))
    return (
      <svg viewBox='0 0 820 460' role='img' aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' style={{ fontFamily: FONT }}>
        <title id={titleId}>Modeled preparation for one through seven UC options</title>
        <desc id={descriptionId}>Average courses rise from 8.8 for one option to 17.7 for seven.</desc>
        <rect width='820' height='460' fill='#fff' />
        <text x='34' y='45' fontSize='13' fontWeight='700' letterSpacing='.7' fill={MUTED}>
          DISTRICT-WIDE UC PREPARATION
        </text>
        <text x='34' y='84' fontSize='27' fontWeight='700' letterSpacing='-.6' fill={INK}>
          Keeping more UC options open
        </text>
        <text x='34' y='111' fontSize='14' fill={BODY}>
          Average best-found joint plan · courses including prerequisites
        </text>
        {model.rows.map((row, index) => {
          const y = 148 + index * 42
          const width = (row.courses.mean / maxCourses) * 570
          return (
            <g key={row.portfolioSize}>
              <text x='34' y={y + 18} fontSize='14' fontWeight='700' fill={INK}>
                {row.portfolioSize} UC{row.portfolioSize === 1 ? '' : 's'}
              </text>
              <rect x='102' y={y} width='570' height='24' rx='4' fill={TRACK} />
              <rect x='102' y={y} width={width} height='24' rx='4'
                fill={index === model.rows.length - 1 ? LIME : INK} />
              <text x='690' y={y + 18} fontSize='16' fontWeight='700' fill={INK}>
                {oneFmt.format(row.courses.mean)}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} role='img'
      aria-labelledby={`${titleId} ${descriptionId}`} className='block h-auto w-full'
      data-export-width={FIGURE.width} data-portfolio-figure style={{ fontFamily: FONT }}>
      <title id={titleId}>How much preparation keeps more UC computer science options open?</title>
      <desc id={descriptionId}>
        Seven rows compare one through seven reachable UC programs. The district-equal
        average best-found joint plan rises from 8.8 courses and 4.0 semester-equivalent
        regular terms for one program to 17.7 courses and 5.4 terms for seven programs.
        Exact-solver coverage is shown for every row.
      </desc>
      <rect width={FIGURE.width} height={FIGURE.height} fill='#fff' />
      <FigureHeader model={model} />
      <ChartHeader />
      {model.rows.map((row, index) => (
        <PortfolioRow key={row.portfolioSize} row={row} index={index}
          isMaximum={index === model.rows.length - 1} />
      ))}
      <line x1='44' y1={ROW_TOP + model.rows.length * ROW_HEIGHT}
        x2='1076' y2={ROW_TOP + model.rows.length * ROW_HEIGHT} stroke={HAIRLINE} />
      <CeilingNote model={model} />
      <MethodNote model={model} />
      <SourceNote model={model} />
    </svg>
  )
}

function AccessibleDataTable({ model }) {
  return (
    <table className='sr-only' aria-label='Modeled UC portfolio preparation data'>
      <caption>
        District-equal best-feasible course and time summaries by number of UC programs retained.
      </caption>
      <thead>
        <tr>
          <th>UC programs retained</th>
          <th>Eligible districts</th>
          <th>Districts represented in mean</th>
          <th>Modeled portfolios</th>
          <th>Proven minima</th>
          <th>Average courses</th>
          <th>Course IQR</th>
          <th>Average semester-equivalent terms</th>
          <th>High-access cohort average courses</th>
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row) => (
          <tr key={row.portfolioSize}>
            <th scope='row'>{row.portfolioSize}</th>
            <td>{row.eligibleDistrictCount}</td>
            <td>{row.representedDistrictCount}</td>
            <td>{row.scenarioCount}</td>
            <td>{row.exactScenarioCount}</td>
            <td>{oneFmt.format(row.courses.mean)}</td>
            <td>{oneFmt.format(row.courses.q1)}–{oneFmt.format(row.courses.q3)}</td>
            <td>{oneFmt.format(row.semesterEquivalentTerms)}</td>
            <td>{oneFmt.format(row.fixedCohortCourseMean)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MultiCampusPathwaysPreview({ data = portfolioSnapshot }) {
  const model = buildPortfolioFigureModel(data)
  if (model.rows.length !== 7) return null
  return (
    <div className='surface-card overflow-hidden bg-white'>
      <PortfolioFigure model={model} compact />
    </div>
  )
}

export default function MultiCampusPathways({ data = portfolioSnapshot }) {
  const model = buildPortfolioFigureModel(data)
  if (model.rows.length !== 7) {
    return (
      <div className='surface-card p-8 text-center'>
        <h3 className='text-heading text-ink'>Portfolio analysis unavailable</h3>
        <p className='mt-2 text-caption text-ink-subtle'>The saved figure artifact is incomplete.</p>
      </div>
    )
  }

  return (
    <div data-export-root>
      <div className='surface-card overflow-hidden bg-white'>
        <PortfolioFigure model={model} />
      </div>
      <AccessibleDataTable model={model} />
    </div>
  )
}
