import React, { useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'

// Whole curated degree template per campus, visibility-independent: this is an
// aggregate research figure, so an admin's major selection must not move it.
const COVERAGE_PARAMS = {
  majorSlug: 'cs',
  groupBy: 'college',
  requirements: 'degree',
  pin: 'settings',
}

export const COURSE_TYPES = [
  { key: 'computing', label: 'Computing', color: '#E8443A' },
  { key: 'math', label: 'Math', color: '#4C7FA0' },
  { key: 'science', label: 'Science', color: '#8FA23F' },
  { key: 'non_stem', label: 'Non-STEM', color: '#F0B537' },
]

// Which slots the percentage is taken over. Upper-division coursework can
// never be taught at a community college, so counting it makes a computing
// major's computing column low for a structural reason common to every major.
// The lower-division view compares types on ground they can all be taught on,
// which is the articulation question; the whole-degree view is the MA paper's
// "how much of the bachelor's can you finish first" question.
export const SCOPES = [
  { value: 'whole-degree', label: 'Whole degree' },
  { value: 'lower-division', label: 'Lower-division only' },
]

const WIDTH = 900
const HEIGHT = 620
const PLOT = { left: 96, right: 40, top: 48, bottom: 500 }
const DOT_RADIUS = 6.5
// The axis runs past both gridlines so the 0% and 100% rules — and the dots
// sitting on them — stay clear of the frame.
const AXIS = { min: -7, max: 108 }
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

function shortenCampus(name) {
  return String(name || '')
    .replace(/^University of California,?\s*/i, '')
    .replace(/^UC\s+/i, '')
    .trim()
}

/**
 * One point per university campus per course type: the share of that campus's
 * degree requirements of that type which have a community college equivalent,
 * averaged over every community college.
 *
 * A campus that requires nothing of a type contributes no point, exactly as in
 * the source figure, where the Non-STEM column carries fewer points than the
 * others.
 */
export function buildCourseTypeModel(rows = [], scope = 'whole-degree') {
  const wholeDegree = scope === 'whole-degree'
  const campuses = new Map()
  for (const row of rows) {
    const types = row.degree_requirements_by_course_type
    if (!types) continue
    const key = String(row.school_id ?? row.school)
    if (!campuses.has(key)) {
      campuses.set(key, { key, campus: shortenCampus(row.school), samples: new Map() })
    }
    const campus = campuses.get(key)
    for (const type of COURSE_TYPES) {
      const slots = types[type.key]
      if (!slots) continue
      const total = wholeDegree ? slots.total : (slots.lower_division_total ?? slots.total)
      const covered = wholeDegree ? slots.covered : (slots.lower_division_covered ?? slots.covered)
      if (!total) continue
      if (!campus.samples.has(type.key)) campus.samples.set(type.key, [])
      campus.samples.get(type.key).push((covered / total) * 100)
    }
  }

  const campusList = [...campuses.values()].sort((a, b) => a.campus.localeCompare(b.campus))
  const columns = COURSE_TYPES.map((type) => {
    const points = campusList
      .map((campus) => {
        const values = campus.samples.get(type.key) || []
        if (!values.length) return null
        return {
          campus: campus.campus,
          colleges: values.length,
          value: values.reduce((sum, value) => sum + value, 0) / values.length,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.value - b.value)
    const mean = points.length
      ? points.reduce((sum, point) => sum + point.value, 0) / points.length
      : null
    return { ...type, points, mean }
  })

  return {
    columns,
    scope,
    campusCount: campusList.length,
    collegeCount: Math.max(0, ...campusList.map((campus) =>
      Math.max(0, ...[...campus.samples.values()].map((values) => values.length)))),
  }
}

function yScale(value) {
  const span = (value - AXIS.min) / (AXIS.max - AXIS.min)
  return PLOT.bottom - span * (PLOT.bottom - PLOT.top)
}

/**
 * Deterministic beeswarm offsets: points that would overlap step outwards in
 * alternating directions, nearest-to-centre first, so the column reads as a
 * distribution without random jitter moving between renders.
 */
function swarm(points) {
  const placed = []
  return points.map((point) => {
    const y = yScale(point.value)
    let step = 0
    let offset = 0
    while (placed.some((other) =>
      Math.abs(other.y - y) < DOT_RADIUS * 2 && Math.abs(other.offset - offset) < DOT_RADIUS * 2
    )) {
      step += 1
      const magnitude = Math.ceil(step / 2) * (DOT_RADIUS * 2 + 1)
      offset = step % 2 === 1 ? magnitude : -magnitude
    }
    placed.push({ y, offset })
    return { ...point, y, offset }
  })
}

function CourseTypeFigure({ model }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-course-type-title`
  const descriptionId = `${id}-course-type-description`
  const columnWidth = (WIDTH - PLOT.left - PLOT.right) / model.columns.length
  const ticks = [0, 20, 40, 60, 80, 100]

  return (
    <div className='surface-card overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' data-export-width={WIDTH}>
        <title id={titleId}>Transferable requirements by course type</title>
        <desc id={descriptionId}>
          One point per University of California campus in each of four course types,
          showing the share of that campus&apos;s computer science degree requirements of
          that type with a community college equivalent. A black diamond marks the
          average of the points in each column.
        </desc>
        <rect width={WIDTH} height={HEIGHT} fill='#ffffff' />

        <g aria-hidden='true'>
          {ticks.map((tick) => {
            const y = yScale(tick)
            return (
              <g key={tick}>
                <line x1={PLOT.left} y1={y} x2={WIDTH - PLOT.right} y2={y}
                  stroke='#d6d9dd' strokeWidth='1' strokeDasharray='5 4' />
                <text x={PLOT.left - 14} y={y + 5} textAnchor='end'
                  fontFamily='Arial, sans-serif' fontSize='15' fill='#3c4550'>{tick}%</text>
              </g>
            )
          })}
        </g>
        <rect x={PLOT.left} y={PLOT.top} width={WIDTH - PLOT.left - PLOT.right}
          height={PLOT.bottom - PLOT.top} fill='none' stroke='#2b3138' strokeWidth='1.2' />

        {model.columns.map((column, index) => {
          const centre = PLOT.left + columnWidth * (index + 0.5)
          const points = swarm(column.points)
          return (
            <g key={column.key} data-column={column.key}>
              {points.map((point) => {
                const label = `${column.label} at ${point.campus}: ${pctFmt.format(point.value)} percent of required courses have a community college equivalent, averaged over ${point.colleges} colleges`
                return (
                  <g key={point.campus} role='img' aria-label={label} tabIndex='0'
                    data-point={`${column.key}|${point.campus}`}>
                    <title>{label}</title>
                    <circle cx={centre + point.offset} cy={point.y} r={DOT_RADIUS}
                      fill={column.color} className='transition-opacity hover:opacity-70' />
                  </g>
                )
              })}
              {column.mean != null && (
                <g role='img' data-mean={column.key}
                  aria-label={`${column.label} average across campuses: ${pctFmt.format(column.mean)} percent`}>
                  <title>{`${column.label} mean: ${pctFmt.format(column.mean)}%`}</title>
                  <path d={diamond(centre, yScale(column.mean), 11)} fill='#12161b' />
                </g>
              )}
              <text x={centre} y={PLOT.bottom + 28} textAnchor='middle'
                fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
                {column.label}
              </text>
            </g>
          )
        })}

        <g aria-label='Legend'>
          <rect x={PLOT.left + 16} y={PLOT.top + 14} width='132' height='38' rx='3'
            fill='#ffffff' stroke='#2b3138' strokeWidth='1.2' />
          <path d={diamond(PLOT.left + 44, PLOT.top + 33, 11)} fill='#12161b' />
          <text x={PLOT.left + 64} y={PLOT.top + 39} fontFamily='Arial, sans-serif'
            fontSize='16' fill='#20262d'>Mean</text>
        </g>

        <text x={(PLOT.left + WIDTH - PLOT.right) / 2} y={PLOT.bottom + 68} textAnchor='middle'
          fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
          Course Type
        </text>
        <text x='30' y={(PLOT.top + PLOT.bottom) / 2} textAnchor='middle'
          transform={`rotate(-90 30 ${(PLOT.top + PLOT.bottom) / 2})`}
          fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
          Percent of Transferable Requirements
        </text>
      </svg>
    </div>
  )
}

function diamond(x, y, size) {
  return `M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z`
}

export default function CourseTypeCoverage() {
  const [scope, setScope] = useState('whole-degree')
  const coverage = useCoverage(COVERAGE_PARAMS, {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const model = useMemo(() => buildCourseTypeModel(rows, scope), [rows, scope])

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (coverage.isError) {
    return <Alert type='error'>Could not load degree requirement coverage for the course types.</Alert>
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-4' data-export-exclude>
        <div className='flex flex-col' data-control-group='scope'>
          <span className='field-label'>Requirements counted</span>
          <div className='inline-flex h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {SCOPES.map((item) => (
              <button key={item.value} type='button' onClick={() => setScope(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  scope === item.value
                    ? 'bg-primary-soft text-primary'
                    : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <Button className='ml-auto' variant='secondary' leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading}
          onClick={() => coverage.refetch()}>
          Refresh data
        </Button>
      </div>
      <div data-export-root>
        <CourseTypeFigure model={model} />
      </div>
    </Stack>
  )
}
