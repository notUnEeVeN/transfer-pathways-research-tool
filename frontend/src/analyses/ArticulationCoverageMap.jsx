import React, { useCallback, useId, useMemo, useRef, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import mapGeometry from '../../../analysis/data/paper_articulation_map.json'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import { shortenSchool } from './chartBits'

const COVERAGE_PARAMS = {
  majorContains: 'computer science',
  groupBy: 'district',
  requirements: 'paper',
  pin: 'paper',
}

const FIGURE = { width: 520, height: 680 }
const MAP_FRAME = { x: 16, y: 84, width: 488, height: 560 }
const LEGEND = { x: 312, y: 100, width: 192, height: 150 }
const DEG = Math.PI / 180
const INK = '#22331f'
const LAND = '#fbf8ec'
const OUTLINE = '#aec0b4'
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', system-ui, sans-serif"

export const COVERAGE_BUCKETS = [
  {
    key: 'low', min: 0, max: 3, label: '0–3 campuses', bandLabel: 'Lower coverage',
    color: '#fe4f32', shape: 'square',
  },
  {
    key: 'middle', min: 4, max: 6, label: '4–6 campuses', bandLabel: 'Moderate coverage',
    color: '#fae745', shape: 'circle',
  },
  {
    key: 'high', min: 7, max: 9, label: '7–9 campuses', bandLabel: 'Higher coverage',
    color: '#60f088', shape: 'diamond',
  },
]

const centroidByDistrict = new Map(
  mapGeometry.district_centroids.map(([district, longitude, latitude]) => [
    normalizeName(district), { longitude, latitude },
  ])
)
const districtByName = new Map(DISTRICTS.map((district) => [normalizeName(district.name), district]))
const campusOrder = new Map(UC_ROWS.map((campus, index) => [normalizeName(campus.campus), index]))
const intFmt = new Intl.NumberFormat()

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

function campusName(row) {
  const short = shortenSchool(row.school)
  return short ? `UC ${short}` : `Campus ${row.school_id}`
}

function compareCampusNames(left, right) {
  const leftOrder = campusOrder.get(normalizeName(left)) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = campusOrder.get(normalizeName(right)) ?? Number.MAX_SAFE_INTEGER
  return leftOrder - rightOrder || left.localeCompare(right)
}

export function bucketFor(count) {
  return COVERAGE_BUCKETS.find((bucket) => count >= bucket.min && count <= bucket.max)
    || COVERAGE_BUCKETS[0]
}

function paperCount(districtIndex) {
  return UC_ROWS.reduce((count, campus) => count + (campus.bits[districtIndex] === '1' ? 1 : 0), 0)
}

/** Build current counts while retaining the paper baseline and real covered-campus names. */
export function buildCoverageMapModel(rows = []) {
  const completeCampuses = new Map()
  let ignoredRows = 0

  for (const row of rows) {
    const district = districtByName.get(normalizeName(
      row.row_group_label || row.community_college_district
    ))
    if (!district) {
      ignoredRows += 1
      continue
    }
    if (row.fully_articulated !== true) continue
    const campusKey = row.school_id == null
      ? normalizeName(row.school)
      : String(row.school_id)
    if (!completeCampuses.has(district.index)) completeCampuses.set(district.index, new Map())
    completeCampuses.get(district.index).set(campusKey, campusName(row))
  }

  const districts = DISTRICTS.map((district) => {
    const coordinates = centroidByDistrict.get(normalizeName(district.name)) || null
    const coveredCampuses = [...(completeCampuses.get(district.index)?.values() || [])]
      .sort(compareCampusNames)
    const currentCount = coveredCampuses.length
    const baselineCount = paperCount(district.index)
    const bucket = bucketFor(currentCount)
    const paperBucket = bucketFor(baselineCount)
    return {
      ...district,
      ...coordinates,
      currentCount,
      coveredCampuses,
      paperCount: baselineCount,
      bucket,
      paperBucket,
      exactMatch: currentCount === baselineCount,
      bucketMatch: bucket.key === paperBucket.key,
    }
  })

  const bucketCounts = Object.fromEntries(COVERAGE_BUCKETS.map((bucket) => [
    bucket.key,
    districts.filter((district) => district.bucket.key === bucket.key).length,
  ]))

  return {
    districts,
    mapped: districts.filter((district) => Number.isFinite(district.latitude)
      && Number.isFinite(district.longitude)).length,
    sameBucket: districts.filter((district) => district.bucketMatch).length,
    sameExact: districts.filter((district) => district.exactMatch).length,
    changed: districts.filter((district) => !district.exactMatch),
    bucketCounts,
    ignoredRows,
  }
}

function mercator(longitude, latitude) {
  const y = Math.log(Math.tan(Math.PI / 4 + (latitude * DEG) / 2))
  return {
    x: longitude * DEG,
    y: Math.max(-Math.PI, Math.min(Math.PI, y)),
  }
}

function makeProjection(ring, frame, padding) {
  const points = ring.map(([longitude, latitude]) => mercator(longitude, latitude))
  const xValues = points.map((point) => point.x)
  const yValues = points.map((point) => point.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const innerWidth = frame.width - padding * 2
  const innerHeight = frame.height - padding * 2
  const scale = Math.min(innerWidth / (maxX - minX), innerHeight / (maxY - minY))
  const offsetX = frame.x + padding + (innerWidth - (maxX - minX) * scale) / 2
  const offsetY = frame.y + padding + (innerHeight - (maxY - minY) * scale) / 2

  return (longitude, latitude) => {
    const point = mercator(longitude, latitude)
    return {
      x: offsetX + (point.x - minX) * scale,
      y: offsetY + (maxY - point.y) * scale,
    }
  }
}

function outlinePath(projection) {
  return mapGeometry.california_outline.map(([longitude, latitude], index) => {
    const point = projection(longitude, latitude)
    return `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ') + ' Z'
}

function markerLabel(district) {
  const comparison = district.exactMatch
    ? 'same exact count as the paper baseline'
    : `paper baseline ${district.paperCount}; coverage band unchanged`
  return [
    district.name,
    `${district.currentCount} of 9 University of California campuses fully articulated`,
    district.bucket.bandLabel,
    comparison,
  ].join('. ')
}

function MarkerShape({ bucket, x, y, size, strokeWidth = 1 }) {
  const common = {
    fill: bucket.color,
    stroke: INK,
    strokeWidth,
    strokeLinejoin: 'round',
  }
  if (bucket.shape === 'square') {
    return <rect {...common} x={x - size / 2} y={y - size / 2}
      width={size} height={size} rx={1.1} />
  }
  if (bucket.shape === 'diamond') {
    const radius = size * 0.72
    return <polygon {...common}
      points={`${x},${y - radius} ${x + radius},${y} ${x},${y + radius} ${x - radius},${y}`} />
  }
  return <circle {...common} cx={x} cy={y} r={size * 0.56} />
}

function MapTooltip({ tip, svgRef }) {
  if (!tip || !svgRef.current) return null
  const bounds = svgRef.current.getBoundingClientRect()
  const viewBox = svgRef.current.viewBox?.baseVal
  const viewWidth = viewBox?.width || FIGURE.width
  const viewHeight = viewBox?.height || FIGURE.height
  const left = bounds.left + (tip.x / viewWidth) * bounds.width
  const top = bounds.top + (tip.y / viewHeight) * bounds.height
  const district = tip.district

  return (
    <div role='status' data-export-exclude
      className='fixed z-30 min-w-44 max-w-64 rounded-xl border border-border bg-white px-3.5 py-3 pointer-events-none'
      style={{
        left,
        top,
        transform: 'translate(-50%, calc(-100% - 16px))',
        boxShadow: '0 8px 30px rgba(25,48,24,0.14)',
        fontFamily: FONT,
      }}>
      <div className='text-body-strong leading-tight text-ink'>{district.name}</div>
      <div className='mt-2 flex items-center gap-2 text-caption text-ink-muted'>
        <svg width='13' height='13' viewBox='0 0 14 14' aria-hidden='true' className='shrink-0'>
          <MarkerShape bucket={district.bucket} x={7} y={7} size={11} />
        </svg>
        <span>{district.currentCount} of 9 · {district.bucket.bandLabel}</span>
      </div>
      {!district.exactMatch && (
        <div className='mt-1 text-tag text-ink-subtle'>Paper baseline: {district.paperCount} campuses</div>
      )}
      {district.coveredCampuses.length > 0 && (
        <div className='mt-2 border-t border-border pt-2'>
          <div className='text-tag font-semibold uppercase tracking-wide text-ink-subtle'>
            Articulated campuses
          </div>
          <div className='mt-1 text-caption leading-snug text-ink-muted'>
            {district.coveredCampuses.join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}

export function ArticulationMapFigure({ model }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-articulation-map-title`
  const descriptionId = `${id}-articulation-map-description`
  const svgRef = useRef(null)
  const [activeDistrict, setActiveDistrict] = useState(null)
  const [tip, setTip] = useState(null)
  const projection = useMemo(
    () => makeProjection(mapGeometry.california_outline, MAP_FRAME, 6),
    []
  )
  const path = useMemo(() => outlinePath(projection), [projection])
  const placed = useMemo(() => model.districts
    .filter((district) => Number.isFinite(district.longitude) && Number.isFinite(district.latitude))
    .map((district) => {
      const point = projection(district.longitude, district.latitude)
      return { district, ...point }
    })
    .sort((left, right) => left.district.currentCount - right.district.currentCount),
  [model.districts, projection])

  const activate = useCallback((district, x, y) => {
    setActiveDistrict(district.index)
    setTip({ district, x, y })
  }, [])
  const deactivate = useCallback(() => {
    setActiveDistrict(null)
    setTip(null)
  }, [])

  return (
    <div className='relative mx-auto w-full' style={{ maxWidth: FIGURE.width, fontFamily: FONT }}>
      <div data-export-root className='overflow-hidden bg-white'>
        <svg ref={svgRef} viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} role='img'
          aria-labelledby={`${titleId} ${descriptionId}`} data-export-width={FIGURE.width}
          className='block h-auto w-full' style={{ fontFamily: FONT }}>
          <title id={titleId}>California articulation coverage</title>
          <desc id={descriptionId}>
            Each community college district is marked by a coral square for zero to three,
            a yellow circle for four to six, or a green diamond for seven to nine fully
            articulated University of California campuses.
          </desc>
          <rect width={FIGURE.width} height={FIGURE.height} fill='#ffffff' />
          <text x='28' y='46' fontSize='24' fontWeight='600' letterSpacing='-0.72' fill='#193018'>
            California articulation coverage
          </text>
          <text x='28' y='68' fontSize='13' fill='#6e7d6f'>
            Fully articulated UC campuses (of 9), by community college district
          </text>

          <path d={path} fill={LAND} stroke={OUTLINE} strokeWidth='1.15' strokeLinejoin='round' />

          <g aria-label='Community college district markers'>
            {placed.map(({ district, x, y }) => {
              const active = activeDistrict === district.index
              const size = 7.6 * (active ? 1.28 : 1)
              const label = markerLabel(district)
              return (
                <g key={district.index} role='img' aria-label={label} tabIndex='0'
                  data-district-marker={district.index} data-bucket={district.bucket.key}
                  className='cursor-pointer outline-none'
                  onMouseEnter={() => activate(district, x, y)} onMouseLeave={deactivate}
                  onFocus={() => activate(district, x, y)} onBlur={deactivate}>
                  <title>{label}</title>
                  {active && <circle cx={x} cy={y} r={size * 0.72 + 3.5}
                    fill='none' stroke={INK} strokeWidth='1.4' />}
                  <MarkerShape bucket={district.bucket} x={x} y={y} size={size} strokeWidth={0.9} />
                </g>
              )
            })}
          </g>

          <g aria-label='Map legend'>
            <rect x={LEGEND.x} y={LEGEND.y} width={LEGEND.width} height={LEGEND.height}
              rx='12' fill='#ffffff' fillOpacity='0.9' stroke='#193018' strokeOpacity='0.12' />
            {COVERAGE_BUCKETS.map((bucket, index) => {
              const y = LEGEND.y + 30 + index * 38
              return (
                <g key={bucket.key}>
                  <MarkerShape bucket={bucket} x={LEGEND.x + 22} y={y} size={13} />
                  <text x={LEGEND.x + 42} y={y - 2} fontSize='14' fontWeight='600' fill={INK}>
                    {bucket.label.replace(' campuses', '')}
                  </text>
                  <text x={LEGEND.x + 42} y={y + 14} fontSize='11.5' fill='#8a9a8c'>
                    {bucket.bandLabel}
                  </text>
                </g>
              )
            })}
          </g>

          <text x='28' y={FIGURE.height - 14} fontSize='10.5' fill='#98a79a'>
            Marker shape and fill encode the coverage band.
          </text>
        </svg>
      </div>
      <MapTooltip tip={tip} svgRef={svgRef} />
    </div>
  )
}

export default function ArticulationCoverageMap() {
  const coverage = useCoverage(COVERAGE_PARAMS, {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const model = useMemo(() => buildCoverageMapModel(rows), [rows])

  if (coverage.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  if (coverage.isError) {
    return <Alert type='error'>Could not load district articulation coverage for the map.</Alert>
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-center gap-3' data-export-exclude>
        <Button variant='secondary' leadingIcon={ArrowPathIcon}
          loading={coverage.isFetching && !coverage.isLoading} onClick={() => coverage.refetch()}>
          Refresh
        </Button>
        <span className='ml-auto text-caption text-ink-subtle'>
          {intFmt.format(rows.length)} district–campus rows · paper-matched requirements
        </span>
      </div>

      <ArticulationMapFigure model={model} />
    </Stack>
  )
}
