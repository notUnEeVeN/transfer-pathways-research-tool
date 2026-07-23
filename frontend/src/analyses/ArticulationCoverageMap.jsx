import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack, SwitchField } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { majorLabelFor } from '../shared/majors/majorLabel'
import mapGeometry from '../../../analysis/data/paper_articulation_map.json'
import { districtIncome, formatIncome } from '../shared/countyIncome'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'
import originalPaperFigure from '../assets/california-paper-figure-4.png'

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

function assistParamsFor(majorSlug) {
  if (majorSlug === 'cs') return ASSIST_PARAMS
  return {
    majorSlug,
    groupBy: 'district',
    requirements: 'assist',
  }
}

const VERSIONS = [
  { value: 'original', label: 'Original figure' },
  { value: 'hand-curated', label: 'Hand-curated' },
  { value: 'assist', label: 'ASSIST' },
]

const FIGURE = { width: 520, height: 680 }
const MAP_FRAME = { x: 16, y: 66, width: 488, height: 578 }
const MAP_CENTER = {
  x: MAP_FRAME.x + MAP_FRAME.width / 2,
  y: MAP_FRAME.y + MAP_FRAME.height / 2,
}
const LEGEND = { x: 312, y: 82, width: 192, height: 150 }
const DEG = Math.PI / 180
const INK = '#22331f'
const LAND = '#fbf8ec'
const OUTLINE = '#aec0b4'
const GAIN = '#0d7964'
const LOSS = '#cb1d51'
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', system-ui, sans-serif"

const CAMPUS_CODE_BY_ID = new Map([
  [79, 'UCB'],
  [89, 'UCD'],
  [120, 'UCI'],
  [144, 'UCM'],
  [46, 'UCR'],
  [7, 'UCSD'],
  [132, 'UCSC'],
  [128, 'UCSB'],
  [117, 'UCLA'],
])

const CAMPUS_CODE_PATTERNS = [
  [/berkeley/i, 'UCB'],
  [/davis/i, 'UCD'],
  [/irvine/i, 'UCI'],
  [/merced/i, 'UCM'],
  [/riverside/i, 'UCR'],
  [/san diego/i, 'UCSD'],
  [/santa cruz/i, 'UCSC'],
  [/santa barbara/i, 'UCSB'],
  [/los angeles|ucla/i, 'UCLA'],
]
const CAMPUS_CODE_ORDER = new Map(
  ['UCB', 'UCD', 'UCI', 'UCLA', 'UCM', 'UCR', 'UCSB', 'UCSC', 'UCSD']
    .map((code, index) => [code, index])
)

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

function campusCode(row) {
  const byId = CAMPUS_CODE_BY_ID.get(Number(row.school_id))
  if (byId) return byId
  const school = String(row.school || '')
  return CAMPUS_CODE_PATTERNS.find(([pattern]) => pattern.test(school))?.[1]
    || `UC${row.school_id ?? '?'}`
}

function compareCampusCodes(left, right) {
  const leftOrder = CAMPUS_CODE_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER
  const rightOrder = CAMPUS_CODE_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER
  return leftOrder - rightOrder || left.localeCompare(right)
}

export function bucketFor(count) {
  return COVERAGE_BUCKETS.find((bucket) => count >= bucket.min && count <= bucket.max)
    || COVERAGE_BUCKETS[0]
}

function paperCount(districtIndex) {
  return UC_ROWS.reduce((count, campus) => count + (campus.bits[districtIndex] === '1' ? 1 : 0), 0)
}

/** Build current counts and real covered-campus codes. The paper comparison is
 * optional because that hand-curated baseline exists only for Computer Science. */
export function buildCoverageMapModel(rows = [], { includePaperBaseline = true } = {}) {
  const completeCampuses = new Map()
  const countiesByDistrict = new Map()
  let ignoredRows = 0

  for (const row of rows) {
    const district = districtByName.get(normalizeName(
      row.row_group_label || row.community_college_district
    ))
    if (!district) {
      ignoredRows += 1
      continue
    }
    if (!countiesByDistrict.has(district.index)) countiesByDistrict.set(district.index, new Set())
    for (const county of row.community_college_counties || []) {
      countiesByDistrict.get(district.index).add(county)
    }
    if (row.fully_articulated !== true) continue
    const campusKey = row.school_id == null
      ? normalizeName(row.school)
      : String(row.school_id)
    if (!completeCampuses.has(district.index)) completeCampuses.set(district.index, new Map())
    completeCampuses.get(district.index).set(campusKey, campusCode(row))
  }

  const districts = DISTRICTS.map((district) => {
    const coordinates = centroidByDistrict.get(normalizeName(district.name)) || null
    const coveredCampusCodes = [...(completeCampuses.get(district.index)?.values() || [])]
      .sort(compareCampusCodes)
    const currentCount = coveredCampusCodes.length
    const baselineCount = includePaperBaseline ? paperCount(district.index) : null
    const bucket = bucketFor(currentCount)
    const paperBucket = includePaperBaseline ? bucketFor(baselineCount) : null
    const counties = [...(countiesByDistrict.get(district.index) || [])].sort()
    return {
      ...district,
      ...coordinates,
      counties,
      income: districtIncome(counties),
      currentCount,
      coveredCampusCodes,
      paperCount: baselineCount,
      delta: includePaperBaseline ? currentCount - baselineCount : null,
      bucket,
      paperBucket,
      exactMatch: includePaperBaseline ? currentCount === baselineCount : null,
      bucketMatch: includePaperBaseline ? bucket.key === paperBucket.key : null,
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
    sameBucket: includePaperBaseline
      ? districts.filter((district) => district.bucketMatch).length
      : null,
    sameExact: includePaperBaseline
      ? districts.filter((district) => district.exactMatch).length
      : null,
    changed: includePaperBaseline
      ? districts.filter((district) => !district.exactMatch)
      : [],
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
  const comparison = district.paperCount == null
    ? null
    : district.exactMatch
      ? 'same exact count as the paper baseline'
      : `paper baseline ${district.paperCount}; change ${district.delta > 0 ? '+' : ''}${district.delta}`
  return [
    district.name,
    `${district.currentCount} of 9 University of California campuses fully articulated`,
    district.bucket.bandLabel,
    district.income
      ? `mean income per tax return ${formatIncome(district.income.meanAgiPerReturn)}`
      : null,
    comparison,
  ].filter(Boolean).join('. ')
}

/** The map's coverage-class glyph. Exported so other figures reuse the shape
 * language rather than reinventing it: square = 0-3, circle = 4-6, diamond = 7-9. */
export function MarkerShape({ bucket, x, y, size, strokeWidth = 1 }) {
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

function DifferenceHalo({ district, x, y, size, scale = 1 }) {
  if (!district.delta) return null
  return (
    <circle cx={x} cy={y} r={size * 0.72 + 3.8 / scale} fill='none'
      stroke={district.delta > 0 ? GAIN : LOSS} strokeWidth={2.2 / scale}
      data-count-change={district.delta > 0 ? 'gain' : 'loss'} data-delta={district.delta} />
  )
}

function cameraPoint(x, y, camera) {
  return {
    x: MAP_CENTER.x + (x - MAP_CENTER.x) * camera.scale + camera.x,
    y: MAP_CENTER.y + (y - MAP_CENTER.y) * camera.scale + camera.y,
  }
}

function MapTooltip({ tip, svgRef, camera }) {
  if (!tip || !svgRef.current) return null
  const bounds = svgRef.current.getBoundingClientRect()
  const viewBox = svgRef.current.viewBox?.baseVal
  const viewWidth = viewBox?.width || FIGURE.width
  const viewHeight = viewBox?.height || FIGURE.height
  const point = cameraPoint(tip.x, tip.y, camera)
  const left = bounds.left + (point.x / viewWidth) * bounds.width
  const top = bounds.top + (point.y / viewHeight) * bounds.height
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
      {district.paperCount != null && !district.exactMatch && (
        <div className='mt-1 text-tag text-ink-subtle'>
          Paper {district.paperCount} · change {district.delta > 0 ? '+' : ''}{district.delta}
        </div>
      )}
      {district.income && (
        <div className='mt-2 border-t border-border pt-2' data-district-income>
          <div className='text-body-strong leading-tight text-ink'>
            {formatIncome(district.income.meanAgiPerReturn)}
          </div>
          <div className='text-tag leading-snug text-ink-subtle'>
            Mean income per tax return · {district.income.counties.join(', ')}
            {district.income.counties.length > 1 ? ' counties' : ' County'}
          </div>
        </div>
      )}
      {district.currentCount > 0 && district.currentCount < 9 && (
        <div className='mt-2 border-t border-border pt-2'>
          <div className='text-tag font-semibold uppercase tracking-wide text-ink-subtle'>
            Articulated campuses
          </div>
          <div className='mt-1 font-mono text-caption leading-snug text-ink-muted'>
            {district.coveredCampusCodes.join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}

const MIN_SCALE = 1
const MAX_SCALE = 8

function clampCamera(camera) {
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale))
  if (scale === 1) return { scale: 1, x: 0, y: 0 }
  const maxX = ((scale - 1) * MAP_FRAME.width) / 2
  const maxY = ((scale - 1) * MAP_FRAME.height) / 2
  return {
    scale,
    x: Math.max(-maxX, Math.min(maxX, camera.x)),
    y: Math.max(-maxY, Math.min(maxY, camera.y)),
  }
}

export function ArticulationMapFigure({ model, differences = false, majorLabel = null }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-articulation-map-title`
  const descriptionId = `${id}-articulation-map-description`
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [activeDistrict, setActiveDistrict] = useState(null)
  const [pinnedDistrict, setPinnedDistrict] = useState(null)
  const [tip, setTip] = useState(null)
  const [camera, setCamera] = useState({ scale: 1, x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
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
    if (pinnedDistrict != null) return
    setActiveDistrict(null)
    setTip(null)
  }, [pinnedDistrict])
  const togglePinned = useCallback((district, x, y) => {
    if (pinnedDistrict === district.index) {
      setPinnedDistrict(null)
      setActiveDistrict(null)
      setTip(null)
      return
    }
    setPinnedDistrict(district.index)
    activate(district, x, y)
  }, [activate, pinnedDistrict])

  // Continuous wheel zoom about the cursor: the geography under the pointer
  // stays under the pointer, so scrolling in feels like moving a lens rather
  // than stepping through fixed levels. Registered manually because React's
  // synthetic wheel listener is passive and cannot preventDefault the page
  // scroll.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const bounds = svg.getBoundingClientRect()
      const cursor = {
        x: ((event.clientX - bounds.left) / bounds.width) * FIGURE.width,
        y: ((event.clientY - bounds.top) / bounds.height) * FIGURE.height,
      }
      setCamera((current) => {
        const next = clampCamera({
          ...current,
          scale: current.scale * Math.exp(-event.deltaY * 0.0016),
        })
        if (next.scale === current.scale) return current
        // Solve for the pan that keeps `cursor` over the same map point.
        const ratio = next.scale / current.scale
        return clampCamera({
          scale: next.scale,
          x: cursor.x - MAP_CENTER.x - (cursor.x - MAP_CENTER.x - current.x) * ratio,
          y: cursor.y - MAP_CENTER.y - (cursor.y - MAP_CENTER.y - current.y) * ratio,
        })
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const startPan = useCallback((event) => {
    if (camera.scale === 1 || event.button !== 0
      || event.target.closest?.('[data-district-marker]')) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    dragRef.current = { clientX: event.clientX, clientY: event.clientY, camera }
    setDragging(true)
  }, [camera])
  const movePan = useCallback((event) => {
    if (!dragRef.current || !svgRef.current) return
    const bounds = svgRef.current.getBoundingClientRect()
    const dx = ((event.clientX - dragRef.current.clientX) / bounds.width) * FIGURE.width
    const dy = ((event.clientY - dragRef.current.clientY) / bounds.height) * FIGURE.height
    setCamera(clampCamera({
      ...dragRef.current.camera,
      x: dragRef.current.camera.x + dx,
      y: dragRef.current.camera.y + dy,
    }))
  }, [])
  const stopPan = useCallback(() => {
    dragRef.current = null
    setDragging(false)
  }, [])

  const mapTransform = `translate(${camera.x} ${camera.y}) translate(${MAP_CENTER.x} ${MAP_CENTER.y}) scale(${camera.scale}) translate(${-MAP_CENTER.x} ${-MAP_CENTER.y})`

  return (
    <div className='relative mx-auto w-full' style={{ maxWidth: FIGURE.width, fontFamily: FONT }}>
      <div data-export-root className='overflow-hidden bg-white'>
        <svg ref={svgRef} viewBox={`0 0 ${FIGURE.width} ${FIGURE.height}`} role='img'
          aria-labelledby={`${titleId} ${descriptionId}`} data-export-width={FIGURE.width}
          className={`block h-auto w-full ${camera.scale > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
          style={{ fontFamily: FONT, touchAction: 'none' }}
          onPointerDown={startPan} onPointerMove={movePan}
          onPointerUp={stopPan} onPointerCancel={stopPan}>
          <title id={titleId}>
            {majorLabel ? `${majorLabel}: ` : ''}California articulation coverage
          </title>
          <desc id={descriptionId}>
            Each community college district for {majorLabel || 'the selected major'} is marked by a coral square for zero to three,
            a yellow circle for four to six, or a green diamond for seven to nine fully
            articulated University of California campuses.
          </desc>
          <rect width={FIGURE.width} height={FIGURE.height} fill='#ffffff' />
          <text x='28' y='46' fontSize='24' fontWeight='600' letterSpacing='-0.72' fill='#193018'>
            California articulation coverage
          </text>
          {majorLabel && (
            <text x={FIGURE.width - 28} y='46' textAnchor='end' fontSize='13'
              fontWeight='600' fill={INK} data-major-label>
              Major: {majorLabel}
            </text>
          )}

          <defs>
            <clipPath id={`${id}-map-clip`}>
              <rect x={MAP_FRAME.x} y={MAP_FRAME.y} width={MAP_FRAME.width} height={MAP_FRAME.height} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-map-clip)`}>
            <g data-map-layer transform={mapTransform}>
              <path d={path} fill={LAND} stroke={OUTLINE} strokeWidth='1.15' strokeLinejoin='round' />

              <g aria-label='Community college district markers'>
                {placed.map(({ district, x, y }) => {
                  const active = activeDistrict === district.index
                  // Counter-scale by the camera: zooming spreads the markers
                  // apart without inflating them, so a hover ring stays the
                  // same size on screen at 1x and at 8x.
                  const size = (7.6 * (active ? 1.28 : 1)) / camera.scale
                  const label = markerLabel(district)
                  return (
                    <g key={district.index} role='img' aria-label={label} tabIndex='0'
                      data-district-marker={district.index} data-bucket={district.bucket.key}
                      className='cursor-pointer outline-none'
                      onMouseEnter={() => activate(district, x, y)} onMouseLeave={deactivate}
                      onFocus={() => activate(district, x, y)} onBlur={deactivate}
                      onClick={() => togglePinned(district, x, y)}>
                      <title>{label}</title>
                      {differences && (
                        <DifferenceHalo district={district} x={x} y={y} size={size}
                          scale={camera.scale} />
                      )}
                      {active && !differences && (
                        <circle cx={x} cy={y} r={size * 0.72 + 3.5 / camera.scale}
                          fill='none' stroke={INK} strokeWidth={1.4 / camera.scale} />
                      )}
                      <MarkerShape bucket={district.bucket} x={x} y={y} size={size}
                        strokeWidth={0.9 / camera.scale} />
                    </g>
                  )
                })}
              </g>
            </g>
          </g>

          <g aria-label='Map legend'>
            <rect x={LEGEND.x} y={LEGEND.y} width={LEGEND.width}
              height={differences ? LEGEND.height + 62 : LEGEND.height}
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
            {differences && (
              <g aria-label='Count difference legend'>
                <line x1={LEGEND.x + 14} y1={LEGEND.y + 150}
                  x2={LEGEND.x + LEGEND.width - 14} y2={LEGEND.y + 150}
                  stroke='#193018' strokeOpacity='0.1' />
                <circle cx={LEGEND.x + 22} cy={LEGEND.y + 170} r='7' fill='none'
                  stroke={GAIN} strokeWidth='2.2' />
                <text x={LEGEND.x + 42} y={LEGEND.y + 174} fontSize='11.5' fill={INK}>
                  More campuses than paper
                </text>
                <circle cx={LEGEND.x + 22} cy={LEGEND.y + 194} r='7' fill='none'
                  stroke={LOSS} strokeWidth='2.2' />
                <text x={LEGEND.x + 42} y={LEGEND.y + 198} fontSize='11.5' fill={INK}>
                  Fewer campuses than paper
                </text>
              </g>
            )}
          </g>

        </svg>
      </div>
      <MapTooltip tip={tip} svgRef={svgRef} camera={camera} />
    </div>
  )
}

export default function ArticulationCoverageMap({
  majorSlug = 'cs',
  majorLabel: configuredMajorLabel = '',
}) {
  const selectedMajorSlug = String(majorSlug || '').trim().toLowerCase() || 'cs'
  const hasPaperBaseline = selectedMajorSlug === 'cs'
  const majorLabel = majorLabelFor(selectedMajorSlug, configuredMajorLabel)
  // ASSIST first: it is what the console measures against everywhere else,
  // and the hand-curated minimums exist only for computer science.
  const [version, setVersion] = useState('assist')
  const [showDiff, setShowDiff] = useState(false)
  const handCuratedCoverage = useCoverage(
    hasPaperBaseline ? HAND_CURATED_PARAMS : assistParamsFor(selectedMajorSlug), {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    ...(hasPaperBaseline ? {} : { enabled: false }),
  })
  const activeVersion = hasPaperBaseline ? version : 'assist'
  const assistCoverage = useCoverage(assistParamsFor(selectedMajorSlug), {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    enabled: activeVersion === 'assist',
  })
  const coverage = activeVersion === 'assist' ? assistCoverage : handCuratedCoverage
  const rows = coverage.data?.rows || []
  const model = useMemo(
    () => buildCoverageMapModel(rows, { includePaperBaseline: hasPaperBaseline }),
    [hasPaperBaseline, rows]
  )
  const interactive = activeVersion !== 'original'
  const diffOn = hasPaperBaseline && interactive && showDiff
  const sourceLabel = activeVersion === 'assist' ? 'ASSIST minimums' : 'Hand-curated minimums'

  let figure
  if (activeVersion === 'original') {
    figure = (
      <div data-export-root className='mx-auto w-full overflow-hidden bg-white'
        style={{ maxWidth: FIGURE.width }}>
        <img src={originalPaperFigure}
          alt='Original California paper Figure 4, Map of Articulation Coverage'
          data-original-paper-figure className='block h-auto w-full' />
      </div>
    )
  } else if (coverage.isLoading) {
    figure = <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  } else if (coverage.isError) {
    figure = <Alert type='error'>Could not load district articulation coverage for the map.</Alert>
  } else {
    figure = <ArticulationMapFigure key={activeVersion} model={model}
      differences={diffOn} majorLabel={majorLabel} />
  }

  return (
    <Stack gap='section'>
      <div className='surface-card p-4' data-export-exclude>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end'>
          {hasPaperBaseline && (
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
                    onChange={() => setShowDiff((shown) => !shown)} disabled={!interactive} />
                </div>
              </div>
            </div>
          )}
          <div className={`flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center
            sm:justify-between lg:ml-auto lg:border-t-0 lg:pt-0 ${
              hasPaperBaseline ? 'lg:border-l lg:pl-5' : ''
            }`}
            data-control-group='data'>
            <span className='text-caption text-ink-subtle'>
              {activeVersion === 'original'
                ? 'Paper Figure 4 · static reference'
                : `${intFmt.format(rows.length)} district–campus rows · ${sourceLabel}`}
            </span>
            {interactive && (
              <Button className='self-start sm:self-auto' variant='secondary'
                leadingIcon={ArrowPathIcon} loading={coverage.isFetching && !coverage.isLoading}
                onClick={() => coverage.refetch()}>
                Refresh data
              </Button>
            )}
          </div>
        </div>
      </div>

      {figure}
    </Stack>
  )
}
