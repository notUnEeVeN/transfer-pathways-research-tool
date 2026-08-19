import React, { useEffect, useId, useMemo, useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Spinner, Stack } from '../components/ui'
import { useCoverage } from '../shared/query/hooks/useData'
import { useMajors } from '../shared/majors/useMajors'
import maFigure2ArchiveDirect from './data/ma-figure2-archive-direct.json'
import maFigure2FinalPdf from './data/ma-figure2-final-pdf.json'
import { degreeTemplateEvidenceLabel } from './templateEvidence'

// Whole curated degree template per campus, visibility-independent: this is an
// aggregate research figure, so an admin's major selection must not move it.
export const courseTypeCoverageParams = (majorSlug) => ({
  majorSlug,
  groupBy: 'college',
  requirements: 'degree',
  pin: 'settings',
})

/**
 * Column colors by axis key.
 *
 * The four `faithful` keys of each major are the SOURCE FIGURE's colors, in the
 * source figure's slot order — own discipline, quantitative, supporting
 * science, everything else. Keeping a slot's color constant across majors is
 * what lets the Computer Science and Biology figures be read as an overlay.
 * They are deliberately not re-derived: this view is a reproduction, and a
 * palette validator would flag contrast defects that belong to the published
 * figure rather than to us.
 *
 * The `extended` keys are ours, so they are held to the usual standard —
 * validated for colorblind separation, chroma, lightness and contrast against
 * the figure's white surface (worst adjacent pair ΔE 11.9 deutan, 19.3 normal).
 */
const AXIS_COLORS = {
  // Source-figure slots.
  computing: '#E8443A',
  math: '#4C7FA0',
  science: '#8FA23F',
  non_stem: '#F0B537',
  // Biology's faithful columns reuse the same four slots in the same order.
  biology: '#E8443A',
  chem_physics: '#8FA23F',
}

const EXTENDED_COLORS = {
  biology: '#5E8C2A',
  chemistry: '#A0446E',
  physics: '#B8860B',
  math: '#2C6FB5',
  computing: '#B03A2E',
  non_stem: '#6A4C93',
}

const FALLBACK_COLOR = '#6B7280'

export const VARIANTS = [
  { value: 'faithful', label: 'Paper course types' },
  { value: 'extended', label: 'By discipline' },
]

/**
 * The columns to plot: the major's declared axis set for this variant, each
 * carrying the fine categories it rolls up and the color for its slot.
 *
 * Returns an empty list when the major declares no such axis set, which is how
 * a major without course typing renders nothing rather than silently borrowing
 * another major's vocabulary.
 */
export function columnsFor(major, variant = 'faithful') {
  const axes = major?.courseTypes?.axes?.[variant]
  if (!Array.isArray(axes)) return []
  const palette = variant === 'extended' ? EXTENDED_COLORS : AXIS_COLORS
  return axes.map((axis) => ({
    key: axis.key,
    label: axis.label,
    categories: Array.isArray(axis.categories) ? axis.categories : [axis.key],
    color: palette[axis.key] || AXIS_COLORS[axis.key] || FALLBACK_COLOR,
  }))
}

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

export const MA_COURSE_TYPE_SOURCES = [
  { value: 'pdf', label: 'Final paper' },
  { value: 'archive-direct', label: 'Our recalculation' },
]

function normalizeMaCourseTypeSource(source) {
  return source === 'archive-direct' || source === 'archive'
    ? 'archive-direct'
    : 'pdf'
}

export const MA_FIGURE2_FINAL_PDF = maFigure2FinalPdf
export const MA_FIGURE2_ARCHIVE_DIRECT = maFigure2ArchiveDirect

// Figure 2's four faithful columns are semantic slots, not a shared literal
// taxonomy. Biology's `biology` occupies the same first slot as Computer
// Science's `computing`, for example. Comparison receipts key by these roles so
// unlike strings cannot prevent the intended category-level contrast (or,
// worse, pair only the coincidentally shared Math and Non-STEM columns).
export const FAITHFUL_COMPARISON_ROLES = [
  { key: 'own_discipline', label: 'Own discipline' },
  { key: 'quantitative', label: 'Quantitative' },
  { key: 'supporting_discipline', label: 'Supporting discipline' },
  { key: 'non_stem', label: 'Non-STEM' },
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
export function buildCourseTypeModel(rows = [], scope = 'lower-division', columnSpecs = []) {
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
    for (const type of columnSpecs) {
      // A column sums the fine categories it rolls up. The server sends one
      // PRIMARY category per requirement in this field, so a requirement can
      // never land in the same column twice.
      let total = 0
      let covered = 0
      for (const category of type.categories) {
        const slots = types[category]
        if (!slots) continue
        total += wholeDegree ? slots.total : (slots.lower_division_total ?? slots.total)
        covered += wholeDegree ? slots.covered : (slots.lower_division_covered ?? slots.covered)
      }
      if (!total) continue
      if (!campus.samples.has(type.key)) campus.samples.set(type.key, [])
      campus.samples.get(type.key).push((covered / total) * 100)
    }
  }

  const campusList = [...campuses.values()].sort((a, b) => a.campus.localeCompare(b.campus))
  const columns = columnSpecs.map((type) => {
    const points = campusList
      .map((campus) => {
        const values = campus.samples.get(type.key) || []
        if (!values.length) return null
        return {
          campus: campus.campus,
          colleges: values.length,
          campusKey: campus.key,
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

/**
 * Literal final-PDF view of MA Figure 2.
 *
 * The raster publishes no university labels, so stable observation keys are
 * deliberately anonymous. Joining these points to named archive campuses
 * would invent identities the paper does not provide. Values are held at the
 * nearest whole percentage point — the precision supported by the printed
 * grid — and the artifact records that limitation beside the source hash.
 */
export function buildMaFigure2PdfModel(columnSpecs = []) {
  const specsByKey = new Map(columnSpecs.map((column) => [column.key, column]))
  const columns = MA_FIGURE2_FINAL_PDF.columns.map((sourceColumn) => {
    const spec = specsByKey.get(sourceColumn.key) || {}
    const points = sourceColumn.points_pct.map((value, index) => ({
      campus: `Printed observation ${index + 1}`,
      campusKey: `ma-final-pdf:${sourceColumn.key}:${index + 1}`,
      colleges: MA_FIGURE2_FINAL_PDF.measure.community_college_count,
      anonymous: true,
      value,
    }))
    return {
      ...spec,
      key: sourceColumn.key,
      label: sourceColumn.label,
      color: spec.color || AXIS_COLORS[sourceColumn.key] || FALLBACK_COLOR,
      points,
      mean: points.reduce((sum, point) => sum + point.value, 0) / points.length,
      paperProseMean: sourceColumn.paper_prose_mean_pct,
    }
  })
  return {
    columns,
    scope: 'whole-degree',
    campusCount: MA_FIGURE2_FINAL_PDF.measure.university_count,
    collegeCount: MA_FIGURE2_FINAL_PDF.measure.community_college_count,
    source: 'final-pdf',
    anonymousObservations: true,
    observationSource: 'final PDF Figure 2',
    observationPrecision: 'value transcribed to the nearest percentage point',
    sourceArtifact: MA_FIGURE2_FINAL_PDF,
  }
}

/**
 * Reviewed Figure 2 rerun from the deposited requirement/equivalency rows.
 *
 * Like the final raster, this artifact deliberately exposes only sorted
 * category distributions. Its observation numbers are local display handles,
 * not campus identities and not ranks that may be paired to the PDF.
 */
export function buildMaFigure2ArchiveDirectModel(columnSpecs = []) {
  const specsByKey = new Map(columnSpecs.map((column) => [column.key, column]))
  const columns = MA_FIGURE2_ARCHIVE_DIRECT.columns.map((sourceColumn) => {
    const spec = specsByKey.get(sourceColumn.key) || {}
    const points = sourceColumn.points_pct.map((value, index) => ({
      campus: `Recalculated observation ${index + 1}`,
      campusKey: `ma-archive-direct:${sourceColumn.key}:${index + 1}`,
      colleges: MA_FIGURE2_ARCHIVE_DIRECT.measure.community_college_count,
      anonymous: true,
      value,
    }))
    return {
      ...spec,
      key: sourceColumn.key,
      label: sourceColumn.label,
      color: spec.color || AXIS_COLORS[sourceColumn.key] || FALLBACK_COLOR,
      points,
      mean: points.reduce((sum, point) => sum + point.value, 0) / points.length,
    }
  })
  return {
    columns,
    scope: 'whole-degree',
    campusCount: MA_FIGURE2_ARCHIVE_DIRECT.measure.university_count,
    collegeCount: MA_FIGURE2_ARCHIVE_DIRECT.measure.community_college_count,
    source: 'archive-direct',
    anonymousObservations: true,
    observationSource: 'our Figure 2 recalculation',
    observationPrecision: 'value calculated to the nearest percentage point',
    sourceArtifact: MA_FIGURE2_ARCHIVE_DIRECT,
  }
}

function isMaFigure2(pane = {}, major = null) {
  return pane.major === 'ma-cs' || major?.slug === 'ma-cs'
}

const excludesGeneralEducation = (major, paperCorpus = false) => (
  paperCorpus || Boolean(major?.courseTypes?.excludeGeGroups)
)

export function courseTypeViewForPane(pane = {}, major = null) {
  const paperCorpus = isMaFigure2(pane, major)
  const requestedMaSource = pane.knobs?.['ma-source']
  const maSource = paperCorpus
    ? normalizeMaCourseTypeSource(requestedMaSource)
    : 'archive'
  const requestedVariant = pane.knobs?.variant || 'faithful'
  const variant = !paperCorpus && major?.courseTypes?.axes?.extended
    ? requestedVariant
    : 'faithful'
  return {
    scope: paperCorpus ? 'whole-degree' : (pane.knobs?.scope || 'whole-degree'),
    variant,
    columnSpecs: columnsFor(major, variant),
    maSource,
    paperCorpus,
  }
}

export function courseTypeComparisonCells(data, pane, major) {
  const view = courseTypeViewForPane(pane, major)
  const model = view.paperCorpus
    ? view.maSource === 'pdf'
      ? buildMaFigure2PdfModel(view.columnSpecs)
      : buildMaFigure2ArchiveDirectModel(view.columnSpecs)
    : buildCourseTypeModel(data?.rows || [], view.scope, view.columnSpecs)
  return model.columns.flatMap((column, index) => {
    const comparisonColumn = view.variant === 'faithful'
      ? (FAITHFUL_COMPARISON_ROLES[index] || { key: column.key, label: column.label })
      : { key: column.key, label: column.label }
    return column.points.map((point) => ({
      rowKey: point.campusKey,
      rowLabel: point.campus,
      colKey: comparisonColumn.key,
      colLabel: comparisonColumn.label,
      value: point.value,
    }))
  })
}

export function courseTypeComparisonContract(pane, major) {
  const view = courseTypeViewForPane(pane, major)
  return {
    measure: 'required-course-articulation-by-type',
    unit: 'percentage points',
    grain: 'university campus × course type',
    keys: {
      // The PDF and direct rerun both lack a defensible cross-source campus
      // identity. Distinct key-space declarations make the generic comparison
      // layer refuse an index/rank join; the Figure 2 audit instead reconciles
      // multisets separately within the four semantic roles.
      rows: view.paperCorpus && view.maSource === 'pdf'
        ? 'anonymous final-PDF category-local observation; distribution only'
        : view.paperCorpus && view.maSource === 'archive-direct'
          ? 'anonymous recalculation category-local observation; distribution only'
          : 'named university campus',
      columns: view.variant === 'faithful'
        ? 'semantic course-type role'
        : 'declared extended course-type axis',
    },
    semantics: {
      denominator: 'required-course observations in category (series expanded; choose-N priced at the stated ask)',
      scope: view.scope,
      category_grouping: view.variant,
      category_roles: view.variant === 'faithful'
        ? FAITHFUL_COMPARISON_ROLES.map((role) => role.key).join(' | ')
        : view.columnSpecs.map((column) => column.key).join(' | '),
      general_education: excludesGeneralEducation(major, view.paperCorpus)
        ? 'excluded'
        : 'included',
      weighting: 'college rates averaged within campus; campus points weighted equally',
    },
    context: {
      source: view.paperCorpus
        ? (view.maSource === 'pdf'
          ? 'final PDF Figure 2 (unlabeled raster transcription)'
          : 'our recalculation from the authors’ requirement and equivalency data')
        : 'curated degree requirements + published equivalencies',
      cohort: major?.label || pane.major,
      bachelor_template_evidence: degreeTemplateEvidenceLabel(major),
      pointIdentity: view.paperCorpus && view.maSource === 'pdf'
        ? 'anonymous printed university observations'
        : view.paperCorpus && view.maSource === 'archive-direct'
          ? 'anonymous recalculated university observations'
          : 'named university campuses',
    },
    distribution: {
      groupBy: 'column',
      label: 'course type',
      pooled: false,
      roles: view.variant === 'faithful'
        ? FAITHFUL_COMPARISON_ROLES.map((role) => role.key)
        : view.columnSpecs.map((column) => column.key),
    },
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

function CourseTypeFigure({
  model, majorLabel = 'degree', variant = 'faithful', scope = 'whole-degree', sourceLabel = null,
}) {
  const id = useId().replace(/:/g, '')
  const titleId = `${id}-course-type-title`
  const descriptionId = `${id}-course-type-description`
  const columnCount = model.columns.length
  const columnWidth = (WIDTH - PLOT.left - PLOT.right) / model.columns.length
  const ticks = [0, 20, 40, 60, 80, 100]

  return (
    <div className='surface-card overflow-hidden bg-white'>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role='img'
        aria-labelledby={`${titleId} ${descriptionId}`}
        className='block h-auto w-full' data-export-width={WIDTH}>
        <title id={titleId}>
          {variant === 'extended'
            ? `Transferable ${majorLabel} requirements by discipline`
            : 'Transferable requirements by course type'}
        </title>
        <desc id={descriptionId}>
          One point per university campus in each of {columnCount}
          {variant === 'extended' ? ' disciplines' : ' course types'}, showing the share
          of that campus&apos;s {majorLabel} degree requirements of that
          {variant === 'extended' ? ' discipline' : ' type'} with a community college
          equivalent. A black diamond marks the average of the points in each column.
          {variant === 'extended'
            ? ' This breakdown is not the source paper’s; it separates the disciplines'
              + ' that the paper’s four course types combine.'
            : ''}
          {model.source === 'final-pdf'
            ? ' Final-paper dots are anonymous because the printed figure does not label them by university; values are transcribed to the nearest whole percentage point. The Computing point at 22 and Science point at 93 are obscured by their mean diamonds and explicitly inferred from our recalculated distribution plus the published mean; the Math point near 63 is partly occluded.'
            : model.source === 'archive-direct'
              ? ' Our recalculated dots are anonymous because the final paper does not label its dots by university. The two category distributions may be compared, but their observations cannot be paired by index or campus.'
              : ''}
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
          const meanPopulation = model.anonymousObservations
            ? `across ${column.points.length} plotted observations`
            : 'across campuses'
          return (
            <g key={column.key} data-column={column.key}>
              {points.map((point) => {
                const label = point.anonymous
                  ? model.source === 'final-pdf'
                    ? `${column.label}, ${point.campus}: ${pctFmt.format(point.value)} percent of required ${column.label.toLowerCase()} courses have an equivalent in final PDF Figure 2; university identity is not printed; value transcribed to the nearest percentage point`
                    : `${column.label}, ${point.campus}: ${pctFmt.format(point.value)} percent of required ${column.label.toLowerCase()} courses have an equivalent in ${model.observationSource}; university identity is not assigned across sources; ${model.observationPrecision}`
                  : `${column.label} at ${point.campus}: ${pctFmt.format(point.value)} percent of required courses have a community college equivalent, averaged over ${point.colleges} colleges`
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
                  aria-label={`${column.label} average ${meanPopulation}: ${pctFmt.format(column.mean)} percent${Number.isFinite(column.paperProseMean) ? `; paper prose reports ${column.paperProseMean} percent` : ''}`}>
                  <title>{`${column.label} visible-point mean: ${pctFmt.format(column.mean)}%${Number.isFinite(column.paperProseMean) ? `; paper prose ${column.paperProseMean}%` : ''}`}</title>
                  <path d={diamond(centre, yScale(column.mean), 11)} fill='#12161b' />
                </g>
              )}
              <text x={centre} y={PLOT.bottom + 28} textAnchor='middle'
                fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
                {column.label}
              </text>
              <text x={centre} y={PLOT.bottom + 48} textAnchor='middle'
                fontFamily='Arial, sans-serif' fontSize='13' fill='#59636e'>
                n = {column.points.length}
                {Number.isFinite(column.paperProseMean)
                  ? ` · paper ${column.paperProseMean}%`
                  : ''}
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

        <text x={(PLOT.left + WIDTH - PLOT.right) / 2} y={PLOT.bottom + 82} textAnchor='middle'
          fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
          Course Type
        </text>
        <text x='30' y={(PLOT.top + PLOT.bottom) / 2} textAnchor='middle'
          transform={`rotate(-90 30 ${(PLOT.top + PLOT.bottom) / 2})`}
          fontFamily='Arial, sans-serif' fontSize='17' fill='#20262d'>
          Percent of Required Courses
        </text>
        <text x={WIDTH - PLOT.right} y='28' textAnchor='end'
          fontFamily='Arial, sans-serif' fontSize='14' fill='#59636e'>
          {sourceLabel || (scope === 'whole-degree'
            ? 'Whole degree · campus-equal'
            : 'Lower division · campus-equal')}
        </text>
      </svg>
    </div>
  )
}

function diamond(x, y, size) {
  return `M${x} ${y - size} L${x + size} ${y} L${x} ${y + size} L${x - size} ${y} Z`
}

export default function CourseTypeCoverage({
  majorSlug = 'cs', majorLabel = '', major: majorProp = null,
  defaultScope = 'whole-degree', defaultVariant = 'faithful', defaultMaSource = 'pdf',
  onViewChange,
}) {
  const [scope, setScope] = useState(defaultScope)
  const [variant, setVariant] = useState(defaultVariant)
  const [maSource, setMaSource] = useState(() => normalizeMaCourseTypeSource(defaultMaSource))
  // The California registry only lists unstamped majors, so a state corpus
  // (ma-cs) resolves to nothing here — its host page passes the full major
  // object instead, and the prop wins whenever it is provided.
  const { bySlug } = useMajors()
  const major = majorProp || bySlug.get(majorSlug) || null
  const paperCorpus = majorSlug === 'ma-cs'
  const effectiveMaSource = paperCorpus ? maSource : 'archive'
  const frozenPaperSource = paperCorpus
  // Both Massachusetts sources use the paper's frozen whole-degree,
  // four-category view. California retains its live scope and grouping modes.
  const effectiveScope = frozenPaperSource
    ? 'whole-degree'
    : scope
  // A major with no extended axis set renders the port and nothing else, so
  // Computer Science keeps exactly the controls it had.
  const hasExtended = Boolean(major?.courseTypes?.axes?.extended)
  const activeVariant = frozenPaperSource
    ? 'faithful'
    : (hasExtended ? variant : 'faithful')
  const columnSpecs = useMemo(
    () => columnsFor(major, activeVariant), [major, activeVariant]
  )
  const coverage = useCoverage(courseTypeCoverageParams(majorSlug), {
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
  const rows = coverage.data?.rows || []
  const model = useMemo(() => (
    paperCorpus
      ? effectiveMaSource === 'pdf'
        ? buildMaFigure2PdfModel(columnSpecs)
        : buildMaFigure2ArchiveDirectModel(columnSpecs)
      : buildCourseTypeModel(rows, effectiveScope, columnSpecs)
  ), [paperCorpus, effectiveMaSource, rows, effectiveScope, columnSpecs])
  const label = majorLabel || major?.label || 'degree'
  const geExcluded = excludesGeneralEducation(major, paperCorpus)
  const templateEvidence = degreeTemplateEvidenceLabel(major)
  // The reader's own selection, not `activeVariant`: a major with no extended
  // axis set is forced back to 'faithful', and pinning that would save a
  // grouping nobody chose.
  useEffect(() => {
    onViewChange?.({
      defaultScope: effectiveScope,
      defaultVariant: frozenPaperSource ? 'faithful' : variant,
      defaultMaSource: maSource,
    })
  }, [effectiveScope, variant, frozenPaperSource, maSource, onViewChange])

  const sourceLabel = paperCorpus
    ? (effectiveMaSource === 'pdf'
      ? 'Final PDF Fig. 2 · whole degree · GE excluded'
      : 'Our recalculation · whole degree · GE excluded')
    : `${effectiveScope === 'whole-degree' ? 'Whole degree' : 'Lower division'} · GE ${geExcluded ? 'excluded' : 'included'}`

  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-4' data-export-exclude>
        {paperCorpus && (
          <div className='flex flex-col' data-control-group='maSource'>
            <span className='field-label'>Source</span>
            <div className='inline-flex min-h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
              {MA_COURSE_TYPE_SOURCES.map((item) => (
                <button key={item.value} type='button' aria-pressed={maSource === item.value}
                  onClick={() => setMaSource(item.value)}
                  className={`px-3 text-button border-r border-border last:border-r-0 ${
                    maSource === item.value
                      ? 'bg-primary-soft text-primary'
                      : 'text-ink-muted hover:bg-surface-hover'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {effectiveMaSource === 'archive' && (
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
        )}
        {effectiveMaSource === 'archive' && hasExtended && (
          <div className='flex flex-col' data-control-group='variant'>
            <span className='field-label'>Course grouping</span>
            <div className='inline-flex h-9 self-start rounded-lg border border-border-strong bg-surface overflow-hidden'>
              {VARIANTS.map((item) => (
                <button key={item.value} type='button' onClick={() => setVariant(item.value)}
                  className={`px-3 text-button border-r border-border last:border-r-0 ${
                    activeVariant === item.value
                      ? 'bg-primary-soft text-primary'
                      : 'text-ink-muted hover:bg-surface-hover'
                  }`}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {effectiveMaSource === 'archive' ? (
          <Button className='ml-auto' variant='secondary' leadingIcon={ArrowPathIcon}
            loading={coverage.isFetching && !coverage.isLoading}
            onClick={() => coverage.refetch()}>
            Refresh data
          </Button>
        ) : (
          <span className='ml-auto h-9 flex items-center text-caption text-ink-subtle'>
            Frozen source artifact
          </span>
        )}
      </div>
      {coverage.isLoading && effectiveMaSource === 'archive'
        ? <div className='surface-card p-10 flex justify-center'><Spinner /></div>
        : coverage.isError && effectiveMaSource === 'archive'
          ? <Alert type='error'>Could not load degree requirement coverage for the course types.</Alert>
          : (
            <div data-export-root className='flex flex-col gap-3'>
              <div className='surface-card px-4 py-3'>
                <p className='text-label'>
                  {paperCorpus && effectiveMaSource === 'pdf'
                    ? 'Final PDF Figure 2 · 11 universities × 15 community colleges · whole-degree course requirements · general education excluded'
                    : paperCorpus
                      ? 'Our Figure 2 recalculation · 11 universities × 15 community colleges · whole-degree course requirements · general education excluded'
                      : `Current computed corpus · ${model.campusCount} university campuses × ${model.collegeCount} community colleges · ${effectiveScope === 'whole-degree' ? 'whole degree' : 'lower division'} · general education ${geExcluded ? 'excluded' : 'included'}`}
                </p>
                <p className='mt-1 text-caption text-ink-muted'>
                  {paperCorpus && effectiveMaSource === 'pdf'
                    ? 'Printed point counts: Computing n=11, Math n=11, Science n=11, Non-STEM n=5; the paper prose reports means of 22%, 60%, 93%, and 76%. Dots are unlabeled and transcribed to the nearest percentage point; no campus identity is inferred. Computing 22 and Science 93 are hidden by their mean diamonds and inferred from our recalculated distribution plus the published mean; Math 63 is partly occluded.'
                    : paperCorpus
                      ? 'Our recalculation: Computing n=11, Math n=11, Science n=11, Non-STEM n=5. We applied the paper rule directly to the authors’ released requirement and equivalency data. Because the printed dots are unlabeled, the two distributions cannot be paired by campus or observation index.'
                      : 'One named-campus point per course type; each point averages that campus across the community colleges in this corpus.'}
                </p>
                {templateEvidence && (
                  <p className='mt-1 text-caption text-ink-muted'>
                    Bachelor-template evidence: {templateEvidence}.
                  </p>
                )}
              </div>
              <CourseTypeFigure model={model} majorLabel={label} variant={activeVariant}
                scope={effectiveScope} sourceLabel={sourceLabel} />
            </div>
          )}
    </Stack>
  )
}

// The props a pinned view may seed. Every `viewKnobs` entry on the registry
// must name one of these; the contract test fails the build otherwise.
CourseTypeCoverage.viewProps = ['defaultScope', 'defaultVariant', 'defaultMaSource']
