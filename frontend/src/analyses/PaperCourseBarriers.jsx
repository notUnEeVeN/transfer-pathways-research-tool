import React, { useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, SwitchField } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import {
  CA_COURSE_COLORS, CA_DIFFERENCE_COLORS, CA_FIGURE, CA_QUARTER_NOTE,
} from './californiaFigureStyle'
import {
  CAMPUSES, COURSE_CATEGORIES, buildPaperCourseBarriersModel, categoryOfGroupId,
} from './paperCourseBarriersBaseline'

const COVERAGE_PARAMS = {
  majorSlug: 'cs',
  groupBy: 'district',
  requirements: 'paper',
  pin: 'paper',
}

const WIDTH = 1080
const HEIGHT = 700
const GRID = { left: 78, right: 24, columnGap: 30, rowGap: 118 }
const PANEL = {
  width: (WIDTH - GRID.left - GRID.right - GRID.columnGap * 2) / 3,
  height: 200,
  firstTop: 104,
}
const Y_MAX = 60
const Y_TICKS = [0, 10, 20, 30, 40, 50, 60]
const NOT_REQUIRED_FILL = '#DDDDDD'
const IMPROVED = '#0d7964'
const WORSENED = '#cb1d51'
const intFmt = new Intl.NumberFormat()
const pctFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1, maximumFractionDigits: 1,
})

const VERSIONS = [
  { value: 'paper', label: 'Paper baseline' },
  { value: 'current', label: 'Current data' },
]

const campusBySchoolId = new Map(CAMPUSES.map((campus) => [campus.schoolId, campus]))

function formatPct(value) {
  return `${pctFmt.format(value)}%`
}

/**
 * Recompute Figure 5 from current paper-matched district coverage.
 *
 * Same operation as the paper's `create_all_course_graphs`: a district counts
 * against a course category at a campus when ANY curated requirement group in
 * that category is unsatisfied there, over the same 72-district denominator.
 */
export function buildCourseBarriersModel(rows = []) {
  const districts = new Set()
  const required = new Map()
  const missing = new Map()

  for (const row of rows) {
    const campus = campusBySchoolId.get(Number(row.school_id))
    const district = row.row_group_label || row.community_college_district
    if (!campus || !district) continue
    districts.add(district)
    for (const group of row.requirement_groups || []) {
      const category = categoryOfGroupId(group.group_id)
      if (!category) continue
      const key = `${category.key}|${campus.id}`
      if (!required.has(key)) required.set(key, true)
      if (group.satisfied) continue
      if (!missing.has(key)) missing.set(key, new Set())
      missing.get(key).add(district)
    }
  }

  const districtCount = districts.size
  return {
    districtCount,
    categories: COURSE_CATEGORIES.map((category) => ({
      ...category,
      campuses: CAMPUSES.map((campus) => {
        const key = `${category.key}|${campus.id}`
        const isRequired = required.get(key) === true
        const missed = missing.get(key)?.size ?? 0
        return {
          ...campus,
          required: isRequired,
          missing: isRequired ? missed : null,
          pct: isRequired && districtCount ? +((missed / districtCount) * 100).toFixed(1) : null,
        }
      }),
    })),
  }
}

function panelFrame(index) {
  const column = index % 3
  const row = Math.floor(index / 3)
  return {
    x: GRID.left + column * (PANEL.width + GRID.columnGap),
    top: PANEL.firstTop + row * (PANEL.height + GRID.rowGap),
    labelled: column === 0,
  }
}

function DifferenceLegend({ x, y }) {
  const items = [
    { label: 'Fewer districts missing', color: IMPROVED },
    { label: 'More districts missing', color: WORSENED },
  ]
  let cursor = x
  return (
    <g aria-label='Difference legend'>
      {items.map((item) => {
        const itemX = cursor
        cursor += 176
        return (
          <g key={item.label} transform={`translate(${itemX} ${y})`}>
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

/** Bar geometry and the phrasing both the shape and its label rely on. */
function barGeometry({ category, campus, paperCampus, frame, slot, index, differences }) {
  const bottom = frame.top + PANEL.height
  const scale = (value) => bottom - (Math.min(value, Y_MAX) / Y_MAX) * PANEL.height
  const barWidth = slot * 0.8
  const x = frame.x + index * slot + (slot - barWidth) / 2
  const delta = differences && campus.required && paperCampus?.required
    ? +(campus.pct - paperCampus.pct).toFixed(1)
    : 0
  const signed = (value) => `${value > 0 ? '+' : '−'}${pctFmt.format(Math.abs(value))}`

  if (!campus.required) {
    return {
      x, barWidth, bottom, delta: 0, required: false,
      label: `${category.label} at ${campus.id}, ${campus.campus}: not required for transfer admission`,
    }
  }

  return {
    x,
    barWidth,
    bottom,
    delta,
    required: true,
    noGaps: campus.missing === 0,
    y: scale(campus.pct),
    paperY: paperCampus?.required ? scale(paperCampus.pct) : null,
    text: formatPct(campus.pct),
    deltaText: delta ? signed(delta) : null,
    label: [
      `${category.label} at ${campus.id}, ${campus.campus}`,
      `${formatPct(campus.pct)} of districts missing an articulated equivalent`,
      campus.missing == null ? null : `${campus.missing} districts`,
      differences && paperCampus?.required
        ? `paper baseline ${formatPct(paperCampus.pct)}${delta ? `; change ${signed(delta)} points` : '; unchanged'}`
        : null,
    ].filter(Boolean).join('. '),
  }
}

function Bar({ category, campus, geometry, differences }) {
  const { x, barWidth, bottom, y, paperY, noGaps, delta, label } = geometry

  if (!geometry.required) {
    return (
      <g role='img' aria-label={label} data-bar={`${category.key}|${campus.id}`}
        data-bar-state='not-required'>
        <title>{label}</title>
        <rect x={x} y={bottom - PANEL.height} width={barWidth} height={PANEL.height}
          fill={NOT_REQUIRED_FILL} stroke='#111111' strokeWidth='1' />
      </g>
    )
  }

  return (
    <g role='img' aria-label={label} data-bar={`${category.key}|${campus.id}`}
      data-bar-state={noGaps ? 'no-gaps' : 'gaps'} tabIndex='0'>
      <title>{label}</title>
      {noGaps ? (
        <rect x={x} y={bottom - PANEL.height} width={barWidth} height={PANEL.height}
          fill='#ffffff' stroke={category.color} strokeWidth='1.4' />
      ) : (
        <rect x={x} y={y} width={barWidth} height={bottom - y}
          fill={category.color} stroke='#111111' strokeWidth='1'
          className='transition-opacity hover:opacity-80' />
      )}
      {noGaps && (
        <rect x={x} y={bottom - PANEL.height} width={barWidth} height={PANEL.height}
          fill={`url(#course-barriers-hatch-${category.key})`} stroke='none' />
      )}
      {differences && delta > 0 && paperY != null && (
        <rect x={x} y={y} width={barWidth} height={paperY - y}
          fill={WORSENED} data-difference='increase' />
      )}
      {differences && delta < 0 && paperY != null && (
        <rect x={x} y={paperY} width={barWidth} height={y - paperY}
          fill={IMPROVED} data-difference='decrease' />
      )}
    </g>
  )
}

/**
 * Value labels paint after every bar in the panel: a neighbouring gray
 * "not required" bar is full height and would otherwise cover them.
 */
function BarLabel({ geometry, frame }) {
  if (!geometry.required) return null
  const { x, barWidth, bottom, y, paperY, noGaps, delta, text, deltaText } = geometry
  const halfWidth = text.length * 3.4
  const centre = Math.min(
    Math.max(x + barWidth / 2, frame.x + halfWidth + 3),
    frame.x + PANEL.width - halfWidth - 3
  )
  const baseY = noGaps ? bottom - PANEL.height / 2 : Math.min(y, paperY ?? y) - 7
  return (
    <g>
      {deltaText && (
        <text x={centre} y={baseY - 13} textAnchor='middle'
          fontFamily='Arial, sans-serif' fontSize='11'
          fill={delta > 0 ? WORSENED : IMPROVED}>
          {deltaText}
        </text>
      )}
      <text x={centre} y={baseY}
        textAnchor='middle' dominantBaseline={noGaps ? 'middle' : 'auto'}
        fontFamily='Arial, sans-serif' fontSize='12' fill='#17251d'>
        {text}
      </text>
    </g>
  )
}

function Panel({ category, paperCategory, index, differences }) {
  const frame = panelFrame(index)
  const bottom = frame.top + PANEL.height
  const slot = PANEL.width / CAMPUSES.length
  const geometries = category.campuses.map((campus, campusIndex) => ({
    campus,
    geometry: barGeometry({
      category,
      campus,
      paperCampus: paperCategory?.campuses[campusIndex],
      frame,
      slot,
      index: campusIndex,
      differences,
    }),
  }))

  return (
    <g data-panel={category.key}>
      <text x={frame.x + PANEL.width / 2} y={frame.top - 16} textAnchor='middle'
        fontFamily='Arial, sans-serif' fontSize='15' fontWeight='700' fill='#17251d'>
        {category.label}
      </text>
      <rect x={frame.x} y={frame.top} width={PANEL.width} height={PANEL.height}
        fill='#ffffff' stroke='#111111' strokeWidth='1' />

      <g aria-hidden='true'>
        {Y_TICKS.map((tick) => {
          const y = bottom - (tick / Y_MAX) * PANEL.height
          return (
            <g key={tick}>
              <line x1={frame.x} y1={y} x2={frame.x + 6} y2={y} stroke='#111111' strokeWidth='1' />
              {frame.labelled && (
                <text x={frame.x - 9} y={y + 4} textAnchor='end'
                  fontFamily='Arial, sans-serif' fontSize='12' fill='#26352c'>{tick}</text>
              )}
            </g>
          )
        })}
      </g>

      {geometries.map(({ campus, geometry }) => (
        <Bar key={campus.id} category={category} campus={campus}
          geometry={geometry} differences={differences} />
      ))}
      {geometries.map(({ campus, geometry }) => (
        <BarLabel key={campus.id} geometry={geometry} frame={frame} />
      ))}

      <g aria-hidden='true'>
        {CAMPUSES.map((campus, campusIndex) => {
          const x = frame.x + campusIndex * slot + slot / 2
          return (
            <text key={campus.id} x={x} y={bottom + 20} textAnchor='end'
              transform={`rotate(-20 ${x} ${bottom + 20})`}
              fontFamily='Arial, sans-serif' fontSize='12' fill='#26352c'>
              {campus.id}
            </text>
          )
        })}
      </g>

      {frame.labelled && (
        <text x='26' y={frame.top + PANEL.height / 2} textAnchor='middle'
          transform={`rotate(-90 26 ${frame.top + PANEL.height / 2})`}
          fontFamily='Arial, sans-serif' fontSize='13' fill='#26352c'>
          % of CC Districts
        </text>
      )}
    </g>
  )
}

function CourseBarriersFigure({ model, paperModel, version, differences }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-course-barriers-title`
  const descriptionId = `${id}-course-barriers-description`
  const districts = model.districtCount
  const subtitle = version === 'paper'
    ? 'Paper baseline · 72 community college districts · Figure 5 method'
    : differences
      ? `Current data · point changes from the paper Figure 5 percentages · ${intFmt.format(districts)} districts`
      : `Current data · ${intFmt.format(districts)} community college districts · paper Figure 5 method`
  const legendY = HEIGHT - 26

  return (
    <div className='surface-card overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' data-export-width={WIDTH}>
        <title id={titleId}>Districts missing course articulation, by campus and course</title>
        <desc id={descriptionId}>
          Six panels, one per required math or computer science course, each showing the
          percentage of California community college districts with no articulated
          equivalent at each University of California campus. Gray bars mark campuses
          that do not require the course for transfer admission.
        </desc>
        <defs>
          {COURSE_CATEGORIES.map((category) => (
            <pattern key={category.key} id={`course-barriers-hatch-${category.key}`}
              width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
              <line x1='0' y1='0' x2='0' y2='8' stroke={category.color} strokeWidth='2' />
            </pattern>
          ))}
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill='#ffffff' />

        <text x='28' y='30' fontFamily='Arial, sans-serif' fontSize='17' fontWeight='700'
          letterSpacing='-0.15' fill='#17251d'>
          Districts missing course articulation
        </text>
        <text x='28' y='51' fontFamily='Arial, sans-serif' fontSize='12' fill='#516158'>
          {subtitle}
        </text>

        {model.categories.map((category, index) => (
          <Panel key={category.key} category={category}
            paperCategory={paperModel.categories[index]} index={index}
            differences={differences} />
        ))}

        <g aria-label='Legend'>
          <rect x={GRID.left} y={legendY - 9} width='11' height='11' rx='2' fill='#17251d' />
          <text x={GRID.left + 17} y={legendY} fontFamily='Arial, sans-serif' fontSize='11' fill='#516158'>
            Colored = % missing
          </text>
          <rect x={GRID.left + 168} y={legendY - 9} width='11' height='11' rx='2'
            fill={NOT_REQUIRED_FILL} stroke='#111111' />
          <text x={GRID.left + 185} y={legendY} fontFamily='Arial, sans-serif' fontSize='11' fill='#516158'>
            Gray = not required
          </text>
          {differences && <DifferenceLegend x={GRID.left + 340} y={legendY - 9} />}
        </g>
      </svg>
    </div>
  )
}

const MODERN_BARRIERS = {
  width: CA_FIGURE.width,
  // Match the original 1080 x 700 renderer's displayed aspect ratio while
  // retaining the handoff's common 1240-unit publication width.
  height: 804,
  left: 24,
  right: 24,
  top: 22,
  columnGap: 16,
  rowGap: 18,
  panelBlockHeight: 322,
  plotTopOffset: 52,
  plotHeight: 230,
  yGutter: 48,
  rightInset: 12,
  fillFraction: 0.88,
}

function modernCourseColor(categoryKey) {
  return CA_COURSE_COLORS[String(categoryKey).replace(/-/g, '_')] || CA_FIGURE.blue
}

function modernRoundedTopPath(x, y, width, height, radius = 3) {
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

function modernPanelFrame(index) {
  const { width, left, right, top, columnGap, rowGap, panelBlockHeight } = MODERN_BARRIERS
  const panelWidth = (width - left - right - columnGap * 2) / 3
  const column = index % 3
  const row = Math.floor(index / 3)
  const panelTop = top + row * (panelBlockHeight + rowGap)
  return {
    x: left + column * (panelWidth + columnGap),
    top: panelTop,
    width: panelWidth,
    labelled: column === 0,
  }
}

function modernSigned(value) {
  return `${value > 0 ? '+' : '−'}${pctFmt.format(Math.abs(value))}`
}

function ModernCoursePanel({ category, paperCategory, index, differences, hatchId }) {
  const frame = modernPanelFrame(index)
  const plotX = frame.x + MODERN_BARRIERS.yGutter
  const plotTop = frame.top + MODERN_BARRIERS.plotTopOffset
  const plotBottom = plotTop + MODERN_BARRIERS.plotHeight
  const plotWidth = frame.width - MODERN_BARRIERS.yGutter - MODERN_BARRIERS.rightInset
  const slotWidth = plotWidth / CAMPUSES.length
  const barWidth = slotWidth * 0.7
  const color = modernCourseColor(category.key)
  const valueY = (value) => plotBottom
    - (Math.min(value, Y_MAX) / Y_MAX)
      * MODERN_BARRIERS.fillFraction * MODERN_BARRIERS.plotHeight

  return (
    <g data-panel={category.key}>
      <rect x={frame.x} y={frame.top} width={frame.width}
        height={MODERN_BARRIERS.panelBlockHeight} rx='8'
        fill={CA_FIGURE.background} stroke={CA_FIGURE.mutedLine}
        strokeOpacity='0.45' strokeWidth='1'
        data-modern-panel-border={category.key} />
      <text x={frame.x + frame.width / 2} y={frame.top + 27} textAnchor='middle'
        fontSize='16' fontWeight='600' fill={CA_FIGURE.ink}>
        {category.label}
      </text>

      <g aria-hidden='true'>
        {[0, 20, 40, 60].map((tick) => {
          const y = valueY(tick)
          return (
            <g key={tick}>
              <line x1={plotX} y1={y} x2={plotX + plotWidth} y2={y}
                stroke={tick === 0 ? CA_FIGURE.mutedLine : CA_FIGURE.grid}
                strokeWidth={tick === 0 ? 1.5 : 1} />
              {frame.labelled && (
                <text x={plotX - 8} y={y + 4} textAnchor='end' fontSize='13'
                  fill={CA_FIGURE.ink}
                  style={{ fontVariantNumeric: 'tabular-nums' }}>{tick}</text>
              )}
            </g>
          )
        })}
      </g>

      {category.campuses.map((campus, campusIndex) => {
        const paperCampus = paperCategory?.campuses[campusIndex]
        const x = plotX + campusIndex * slotWidth + (slotWidth - barWidth) / 2
        const required = campus.required
        const value = required ? campus.pct : null
        const y = required ? valueY(value) : plotTop
        const barHeight = required ? plotBottom - y : MODERN_BARRIERS.plotHeight
        const delta = differences && required && paperCampus?.required
          ? +(value - paperCampus.pct).toFixed(1)
          : 0
        const paperY = paperCampus?.required ? valueY(paperCampus.pct) : null
        const comparison = differences && paperCampus?.required
          ? `paper baseline ${formatPct(paperCampus.pct)}${delta ? `; change ${modernSigned(delta)} points` : '; unchanged'}`
          : null
        const label = !required
          ? `${category.label} at ${campus.id}, ${campus.campus}: not required for transfer admission`
          : [
              `${category.label} at ${campus.id}, ${campus.campus}`,
              `${formatPct(value)} of districts missing an articulated equivalent`,
              campus.missing == null ? null : `${campus.missing} districts`,
              comparison,
            ].filter(Boolean).join('. ')
        const comparisonTop = differences ? Math.min(y, paperY ?? y) : y
        const valueLabelY = comparisonTop - 7
        const deltaLabelY = valueLabelY - 15

        return (
          <g key={campus.id} role='img' aria-label={label} tabIndex={required ? '0' : undefined}
            data-bar={`${category.key}|${campus.id}`}
            data-bar-state={!required ? 'not-required' : value === 0 ? 'no-gaps' : 'gaps'}
            data-modern-bar-top={required ? y : undefined}
            data-modern-value-label-y={required ? valueLabelY : undefined}>
            <title>{label}</title>
            {!required ? (
              <rect x={x} y={plotTop} width={barWidth} height={barHeight} rx='3'
                fill={`url(#${hatchId})`} opacity='0.55' />
            ) : barHeight > 0 ? (
              <path d={modernRoundedTopPath(x, y, barWidth, barHeight)}
                fill={color} stroke={CA_FIGURE.grid} strokeWidth='1'
                className='transition-opacity hover:opacity-80' />
            ) : null}
            {differences && delta > 0 && paperY != null && (
              <rect x={x} y={y} width={barWidth} height={paperY - y} rx='3'
                fill={CA_DIFFERENCE_COLORS.lost} data-difference='increase' />
            )}
            {differences && delta < 0 && paperY != null && (
              <rect x={x} y={paperY} width={barWidth} height={y - paperY} rx='3'
                fill={CA_DIFFERENCE_COLORS.gained} fillOpacity='0.32'
                stroke={CA_DIFFERENCE_COLORS.gained} strokeWidth='1'
                strokeDasharray='3 2' data-difference='decrease' />
            )}
            {required && delta !== 0 && (
              <text x={x + barWidth / 2} y={deltaLabelY}
                textAnchor='middle' fontSize='11.5' fontWeight='500'
                fill={delta > 0 ? CA_DIFFERENCE_COLORS.lost : CA_DIFFERENCE_COLORS.gained}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {modernSigned(delta)}
              </text>
            )}
            {required && (
              <text x={x + barWidth / 2} y={valueLabelY}
                textAnchor='middle' fontSize='13' fontWeight='500' fill={CA_FIGURE.ink}
                style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pctFmt.format(value)}
              </text>
            )}
          </g>
        )
      })}

      <g aria-hidden='true'>
        {category.campuses.map((campus, campusIndex) => (
          <text key={campus.id}
            x={plotX + campusIndex * slotWidth + slotWidth / 2}
            y={plotBottom + 21} textAnchor='middle' fontSize='13' fill={CA_FIGURE.ink}>
            {campus.id}
          </text>
        ))}
      </g>

      {frame.labelled && (
        <text x={frame.x + 18} y={plotTop + MODERN_BARRIERS.plotHeight / 2}
          textAnchor='middle'
          transform={`rotate(-90 ${frame.x + 18} ${plotTop + MODERN_BARRIERS.plotHeight / 2})`}
          fontSize='13' fontWeight='500' fill={CA_FIGURE.ink}>
          % of CC districts
        </text>
      )}
    </g>
  )
}

function ModernCourseBarrierFooter({ hatchId, differences }) {
  return (
    <g transform='translate(24 752)' aria-label='Figure legend and notes'>
      <rect x='0' y='-11' width='22' height='13' rx='2'
        fill={`url(#${hatchId})`} opacity='0.55'
        stroke={CA_FIGURE.grid} strokeWidth='1' />
      <text x='30' y='0' fontSize='13' fill={CA_FIGURE.ink}>
        Course not required by this campus
      </text>
      <text x='337' y='0' fontSize='15' fontWeight='600' fill={CA_FIGURE.ink}>*</text>
      <text x='352' y='0' fontSize='13' fill={CA_FIGURE.ink}>{CA_QUARTER_NOTE.slice(2)}</text>
      {differences && (
        <>
          <rect x='730' y='-11' width='15' height='11' rx='2'
            fill={CA_DIFFERENCE_COLORS.gained} />
          <text x='752' y='0' fontSize='12.5' fill={CA_FIGURE.ink}>Fewer districts missing</text>
          <rect x='944' y='-11' width='15' height='11' rx='2'
            fill={CA_DIFFERENCE_COLORS.lost} />
          <text x='966' y='0' fontSize='12.5' fill={CA_FIGURE.ink}>More districts missing</text>
        </>
      )}
    </g>
  )
}

/** Publication renderer for current and current-difference Figure 5. */
function ModernCourseBarriersFigure({ model, paperModel, differences = false }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-modern-course-barriers-title`
  const descriptionId = `${id}-modern-course-barriers-description`
  const hatchId = `${id}-modern-not-required-hatch`

  return (
    <div className='overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${MODERN_BARRIERS.width} ${MODERN_BARRIERS.height}`}
        role='img' aria-labelledby={`${titleId} ${descriptionId}`}
        data-modern-california-figure='articulation-gaps'
        className='block h-auto w-full' data-export-width={MODERN_BARRIERS.width}
        style={{ fontFamily: CA_FIGURE.fontFamily }}>
        <title id={titleId}>Districts missing course articulation, by campus and course</title>
        <desc id={descriptionId}>
          Six current-data panels showing the percentage of California community college
          districts missing each required course articulation at each UC campus.
        </desc>
        <defs>
          <pattern id={hatchId} width='6' height='6' patternUnits='userSpaceOnUse'
            patternTransform='rotate(45)'>
            <line x1='0' y1='0' x2='0' y2='6' stroke={CA_FIGURE.mutedLine} strokeWidth='1' />
          </pattern>
        </defs>
        <rect width={MODERN_BARRIERS.width} height={MODERN_BARRIERS.height}
          fill={CA_FIGURE.background} />
        {model.categories.map((category, index) => (
          <ModernCoursePanel key={category.key} category={category}
            paperCategory={paperModel.categories[index]} index={index}
            differences={differences} hatchId={hatchId} />
        ))}
        <ModernCourseBarrierFooter hatchId={hatchId} differences={differences} />
      </svg>
    </div>
  )
}

function useCourseBarrierModels() {
  const coverage = useCoverage(COVERAGE_PARAMS, {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const paperModel = useMemo(() => buildPaperCourseBarriersModel(), [])
  const currentModel = useMemo(() => buildCourseBarriersModel(rows), [rows])
  return { coverage, rows, paperModel, currentModel }
}

/** Figure-only gallery thumbnail, intentionally pinned to current data. */
export function PaperCourseBarriersPreview() {
  const { coverage, paperModel, currentModel } = useCourseBarrierModels()
  if (coverage.isLoading) return <div className='h-full grid place-items-center'><Spinner /></div>
  if (coverage.isError) return <Alert type='error'>Could not load district articulation coverage.</Alert>
  return <ModernCourseBarriersFigure model={currentModel} paperModel={paperModel} />
}

export default function PaperCourseBarriers() {
  const [version, setVersion] = useState('current')
  const [showDiff, setShowDiff] = useState(false)
  const { coverage, rows, paperModel, currentModel } = useCourseBarrierModels()
  const model = version === 'paper' ? paperModel : currentModel
  const diffOn = version === 'current' && showDiff

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (coverage.isError) {
    return <Alert type='error'>Could not load district articulation coverage for the course panels.</Alert>
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
        {version === 'paper'
          ? <CourseBarriersFigure model={model} paperModel={paperModel}
              version={version} differences={false} />
          : <ModernCourseBarriersFigure model={model} paperModel={paperModel}
              differences={diffOn} />}
      </div>
    </Stack>
  )
}
