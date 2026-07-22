import React, { useId, useMemo } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import mapGeometry from '../../../analysis/data/paper_articulation_map.json'
import { DISTRICTS, UC_ROWS } from './paperDistrictBaseline'

const COVERAGE_PARAMS = {
  majorContains: 'computer science',
  groupBy: 'district',
  requirements: 'paper',
  pin: 'paper',
}

const MAP = { width: 960, height: 820, left: 28, top: 44, plotWidth: 884, plotHeight: 748 }
const BOUNDS = { minLon: -124.65, maxLon: -114.05, minLat: 32.35, maxLat: 42.15 }

export const COVERAGE_BUCKETS = [
  { key: 'low', min: 0, max: 3, label: '0–3 campuses', color: '#b3261e', shape: 'square' },
  { key: 'middle', min: 4, max: 6, label: '4–6 campuses', color: '#f2bd00', shape: 'circle' },
  { key: 'high', min: 7, max: 9, label: '7–9 campuses', color: '#08783e', shape: 'diamond' },
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

export function bucketFor(count) {
  return COVERAGE_BUCKETS.find((bucket) => count >= bucket.min && count <= bucket.max)
    || COVERAGE_BUCKETS[0]
}

function paperCount(districtIndex) {
  return UC_ROWS.reduce((count, campus) => count + (campus.bits[districtIndex] === '1' ? 1 : 0), 0)
}

/** Build the current district counts and compare them to Figure 4's buckets. */
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
    if (!completeCampuses.has(district.index)) completeCampuses.set(district.index, new Set())
    completeCampuses.get(district.index).add(campusKey)
  }

  const districts = DISTRICTS.map((district) => {
    const coordinates = centroidByDistrict.get(normalizeName(district.name)) || null
    const currentCount = completeCampuses.get(district.index)?.size || 0
    const baselineCount = paperCount(district.index)
    const bucket = bucketFor(currentCount)
    const paperBucket = bucketFor(baselineCount)
    return {
      ...district,
      ...coordinates,
      currentCount,
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

function project(longitude, latitude) {
  return {
    x: MAP.left + ((longitude - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * MAP.plotWidth,
    y: MAP.top + ((BOUNDS.maxLat - latitude) / (BOUNDS.maxLat - BOUNDS.minLat)) * MAP.plotHeight,
  }
}

function outlinePath() {
  return mapGeometry.california_outline.map(([longitude, latitude], index) => {
    const { x, y } = project(longitude, latitude)
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ') + ' Z'
}

function markerLabel(district) {
  const comparison = district.exactMatch
    ? 'same exact count as the paper'
    : `paper count ${district.paperCount}; marker class unchanged`
  return [
    district.name,
    `${district.currentCount} of 9 University of California campuses fully articulated`,
    `${district.bucket.label}; ${comparison}`,
  ].join('. ')
}

function MarkerShape({ bucket, x, y, scale = 1 }) {
  const size = 11 * scale
  if (bucket.shape === 'square') {
    return (
      <>
        <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5 * scale}
          fill={bucket.color} stroke='#ffffff' strokeWidth={2 * scale} />
        <rect x={x - size * 0.42} y={y - size * 0.42} width={size * 0.84} height={size * 0.84}
          fill='#ffffff' />
      </>
    )
  }
  if (bucket.shape === 'diamond') {
    const outer = `${x},${y - size * 1.18} ${x + size * 1.18},${y} ${x},${y + size * 1.18} ${x - size * 1.18},${y}`
    const inner = `${x},${y - size * 0.46} ${x + size * 0.46},${y} ${x},${y + size * 0.46} ${x - size * 0.46},${y}`
    return (
      <>
        <polygon points={outer} fill={bucket.color} stroke='#ffffff' strokeWidth={2 * scale} />
        <polygon points={inner} fill='#ffffff' />
      </>
    )
  }
  return (
    <>
      <circle cx={x} cy={y} r={size} fill={bucket.color} stroke='#ffffff' strokeWidth={2 * scale} />
      <circle cx={x} cy={y} r={size * 0.47} fill='#ffffff' />
    </>
  )
}

const REFERENCE_PLACES = [
  ['Sacramento', -121.4944, 38.5816, 9, -7],
  ['San Francisco', -122.4194, 37.7749, -74, 4],
  ['Fresno', -119.7871, 36.7378, 8, -7],
  ['Los Angeles', -118.2437, 34.0522, 9, -7],
  ['San Diego', -117.1611, 32.7157, 9, 14],
]

function ArticulationMapFigure({ model }) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-articulation-map-title`
  const descriptionId = `${id}-articulation-map-description`
  const clipId = `${id}-california-map-clip`
  const shadowId = `${id}-marker-shadow`
  const path = outlinePath()
  const subtitle = model.sameBucket === DISTRICTS.length
    ? 'Current data · same coverage bands as paper Figure 4'
    : `Current data · ${model.sameBucket} of 72 coverage bands match paper Figure 4`

  return (
    <div className='surface-card overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' data-export-width={MAP.width}>
        <title id={titleId}>Articulation coverage across California</title>
        <desc id={descriptionId}>
          Community college district centroids grouped by the number of University of California
          campuses with a complete computer science transfer path.
        </desc>
        <rect width={MAP.width} height={MAP.height} fill='#eaf4f3' />
        <text x='28' y='27' fontFamily='Arial, sans-serif' fontSize='16' fontWeight='700'
          letterSpacing='-0.15' fill='#17251d'>
          Articulation coverage across California
        </text>
        <text x='28' y='48' fontFamily='Arial, sans-serif' fontSize='12' fill='#516158'>{subtitle}</text>

        <defs>
          <clipPath id={clipId}><path d={path} /></clipPath>
          <filter id={shadowId} x='-30%' y='-30%' width='160%' height='160%'>
            <feDropShadow dx='0' dy='1.2' stdDeviation='1.2' floodColor='#294337' floodOpacity='0.18' />
          </filter>
        </defs>
        <path d={path} fill='none' stroke='#c2ddda' strokeWidth='8' opacity='0.7' />
        <path d={path} fill='#fbfaf4' stroke='#68766e' strokeWidth='2.1' />
        <g clipPath={`url(#${clipId})`} opacity='0.45'>
          {[34, 36, 38, 40].map((latitude) => {
            const start = project(BOUNDS.minLon, latitude)
            const end = project(BOUNDS.maxLon, latitude)
            return <line key={latitude} x1={start.x} y1={start.y} x2={end.x} y2={end.y}
              stroke='#b7c0b9' strokeWidth='1' strokeDasharray='5 7' />
          })}
        </g>

        <g aria-hidden='true'>
          {REFERENCE_PLACES.map(([name, longitude, latitude, dx, dy]) => {
            const { x, y } = project(longitude, latitude)
            return (
              <g key={name}>
                <circle cx={x} cy={y} r='2.2' fill='#6f7b74' />
                <text x={x + dx} y={y + dy} fontFamily='Arial, sans-serif' fontSize='10.5' fill='#7a857e'>
                  {name}
                </text>
              </g>
            )
          })}
        </g>

        <g aria-label='Community college district markers'>
          {[...model.districts]
            .filter((district) => Number.isFinite(district.longitude) && Number.isFinite(district.latitude))
            .sort((a, b) => a.currentCount - b.currentCount)
            .map((district) => {
              const { x, y } = project(district.longitude, district.latitude)
              const label = markerLabel(district)
              return (
                <g key={district.index} role='img' aria-label={label} tabIndex='0'
                  data-district-marker={district.index} data-bucket={district.bucket.key}
                  filter={`url(#${shadowId})`}>
                  <title>{label}</title>
                  <MarkerShape bucket={district.bucket} x={x} y={y} />
                </g>
              )
            })}
        </g>

        <g transform='translate(570 86)' aria-label='Map legend'>
          <rect width='342' height='172' rx='10' fill='#ffffff' fillOpacity='0.96'
            stroke='#c4cec7' strokeWidth='1.4' />
          <text x='20' y='30' fontFamily='Arial, sans-serif' fontSize='13' fontWeight='700' fill='#17251d'>
            UC campuses with complete articulation
          </text>
          {COVERAGE_BUCKETS.map((bucket, index) => {
            const y = 63 + index * 42
            return (
              <g key={bucket.key}>
                <MarkerShape bucket={bucket} x={34} y={y} scale={0.82} />
                <text x='58' y={y + 4} fontFamily='Arial, sans-serif' fontSize='13' fill='#26352c'>
                  {bucket.label}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
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

      <div data-export-root>
        <ArticulationMapFigure model={model} />
      </div>
    </Stack>
  )
}
