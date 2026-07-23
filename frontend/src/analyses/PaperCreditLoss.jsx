import React, { useId, useState } from 'react'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { Alert, Stack, SwitchField } from '../components/ui'
import { majorLabelFor } from '../shared/majors/majorLabel'
import {
  CA_CHOICE_COLORS,
  CA_DIFFERENCE_COLORS,
  CA_FIGURE,
  CA_QUARTER_NOTE,
} from './californiaFigureStyle'
import { CHOICE_LABELS, PAPER_COLORS, PAPER_UC_BARS } from './paperCreditLossBaseline'
import oursData from './data/paper-credit-loss.ours.json'

// Generated ASSIST artifacts are major-scoped. New majors become available by
// adding a verified `paper-credit-loss.<slug>.assist.json`; the legacy CS name
// is indexed from its embedded scope metadata. Missing/unknown scopes never
// fall back to CS.
const ASSIST_ARTIFACT_MODULES = import.meta.glob(
  './data/paper-credit-loss*.assist.json',
  { eager: true, import: 'default' }
)
const ASSIST_DATA_BY_MAJOR = new Map(
  Object.values(ASSIST_ARTIFACT_MODULES).flatMap((artifact) => {
    const slug = String(artifact?.major_scope?.slug || '').trim()
    return slug ? [[slug, artifact]] : []
  })
)

export function getAssistCreditLossArtifact(majorSlug) {
  return ASSIST_DATA_BY_MAJOR.get(String(majorSlug || '').trim().toLowerCase()) || null
}

const assistData = getAssistCreditLossArtifact('cs')

/**
 * Paper Figure 1 — "Visualizing the credit loss in transfer pathways":
 * per UC campus, the CS/Math incoming-transfer requirement (gold, semester
 * equivalents, hatched cap = quarter-system excess) next to the average
 * number of CCC courses an optimal pathway needs when the campus is the
 * student's 1st–4th choice (blues, dark → light).
 *
 * Three views: `paper` renders the transcribed baseline, `live` the same
 * figure recomputed on our dataset (analysis/paper_credit_loss.py → the
 * committed data/paper-credit-loss.ours.json), `diff` overlays the paper
 * baseline as dashed outlines on our bars and labels each bar with its
 * signed delta. An optional, collapsed-by-default difference matrix gives the
 * same deltas as a diverging heatmap. Provenance: docs/figures/paper-credit-loss.md.
 *
 * The SVG reproduces the paper's matplotlib render geometrically: the axes
 * box, bar positions, and text sizes below were measured off the published
 * PNG (question_1/graphs/graphs_for_paper/2026, 5971×3571 px @ 300 dpi) and
 * are expressed in that PNG's coordinates ÷ 3. Font is Arial in place of
 * matplotlib's DejaVu Sans — the one deliberate rendering substitution.
 */

// Axes box measured off the paper PNG (px ÷ 3).
const VB = { w: 1990.3, h: 1190.3 }
const PLOT = { left: 96.8, right: 1980.7, top: 10, bottom: 1077.7 }
// matplotlib bar defaults: groups at x = 0..8, ±5% data margin.
const XLIM = [-0.84, 8.84]
const BAR_W = 0.16 // 0.8 / 5 bars per group
const OFFSETS = [-0.32, -0.16, 0, 0.16, 0.32]
// 1 pt at 300 dpi, scaled into the ÷3 viewBox.
const pt = (v) => (v * (300 / 72)) / 3

const GAIN = CA_DIFFERENCE_COLORS.gained // fewer CCC courses than the comparison — improvement
const LOSS = CA_DIFFERENCE_COLORS.lost

const CAMPUS_NAME = Object.fromEntries(PAPER_UC_BARS.map((b) => [b.code, b.campus]))

// Our recomputation, reshaped to the baseline's bar shape. Same campus order
// (the script emits the paper's x-axis order; keyed defensively by code).
const OURS_BARS = PAPER_UC_BARS.map((paper) => {
  const c = oursData.campuses.find((x) => x.code === paper.code)
  return {
    code: c.code,
    id: c.id,
    campus: CAMPUS_NAME[c.code],
    requirementSemester: c.requirement.semester_equiv,
    requirementQuarter: c.requirement.quarter_count,
    choices: c.choices.map((ch) => ch.transferable_average),
    choiceDistricts: c.choices.map((ch) => ch.districts_included),
  }
})

function barsFromAssistArtifact(artifact) {
  return PAPER_UC_BARS.map((paper) => {
    const c = artifact.campuses.find((x) => x.code === paper.code)
    if (!c) throw new Error(`ASSIST credit-loss artifact is missing ${paper.code}`)
    return {
      code: c.code,
      id: c.id,
      campus: CAMPUS_NAME[c.code],
      requirementSemester: c.requirement.semester_equiv,
      requirementQuarter: c.requirement.quarter_count,
      choices: c.choices.map((ch) => ch.transferable_average),
      choiceDistricts: c.choices.map((ch) => ch.districts_included),
    }
  })
}

const ASSIST_BARS = barsFromAssistArtifact(assistData)

// The three meaningful figures: the transcribed paper original, and our data
// against each minimums source. "Difference" is an overlay (a toggle), not a
// version — see the Show-differences switch below.
const VERSIONS = [
  { value: 'paper', label: 'Paper baseline' },
  { value: 'website', label: 'Hand-curated minimums' },
  { value: 'assist', label: 'ASSIST minimums' },
]

const fmt = (v) => v.toFixed(2)
const signed = (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`

function barTop(uc) {
  return uc.requirementQuarter ?? uc.requirementSemester
}

function maxTop(bars) {
  return Math.max(...bars.map((uc) => Math.max(barTop(uc), ...uc.choices)))
}

function choiceAvailable(campus, choiceIndex) {
  return campus?.choiceDistricts?.[choiceIndex] !== 0
}

const xPx = (v) => PLOT.left + ((v - XLIM[0]) / (XLIM[1] - XLIM[0])) * (PLOT.right - PLOT.left)
const barWpx = xPx(BAR_W) - xPx(0)

function xTickLabel(uc, labelMode) {
  if (labelMode !== 'names') return uc.id
  return uc.campus.replace(/^UC\s+/i, '') + (uc.id.endsWith('*') ? '*' : '')
}

// matplotlib's rotation=90 annotations read bottom-to-top. anchor='start'
// grows upward from (x, y) (va='bottom'); 'middle' centers on it (va='center').
function VText({ x, y, size, anchor = 'start', fill = '#000', children }) {
  return (
    <text
      x={x}
      y={y}
      transform={`rotate(-90 ${x} ${y})`}
      textAnchor={anchor}
      dominantBaseline='central'
      fontSize={size}
      fill={fill}
    >
      {children}
    </text>
  )
}

// Frame, title baseline, swatch box, and row pitch all measured off the
// paper PNG's legend (frame x 4940–5944, y 61–687; entry centers every
// ~99 px; ÷ 3 here).
function LegendBox() {
  const frame = { x: 1646.7, y: 20.3, w: 334.6, h: 208.7 }
  const entries = [
    { color: PAPER_COLORS.requirement, label: 'CS/Math Requirement' },
    ...CHOICE_LABELS.map((label, i) => ({ color: PAPER_COLORS.choices[i], label })),
  ]
  return (
    <g fontFamily='Arial, sans-serif'>
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={8} fill='#ffffff' fillOpacity={0.8} stroke='#cccccc' strokeWidth={1.4} />
      <text x={frame.x + frame.w / 2} y={48.8} textAnchor='middle' fontSize={pt(18)} fill='#000'>
        Choices/Requirements
      </text>
      {entries.map((entry, i) => {
        const cy = 74.8 + i * 33.06
        return (
          <g key={entry.label}>
            <rect x={1656} y={cy - 7.7} width={44.3} height={15.4} fill={entry.color} />
            <text x={1718.4} y={cy} dominantBaseline='central' fontSize={pt(16)} fill='#000'>
              {entry.label}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function DifferenceLegend({ comparisonLabel }) {
  return (
    <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-subtle'>
      <span className='text-label'>Difference marks vs {comparisonLabel}</span>
      <span className='inline-flex items-center gap-1.5'>
        <i className='inline-block w-4 h-3 border border-white' style={{ background: LOSS }} />
        more courses
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <i className='inline-block w-4 h-3 border border-dashed' style={{ background: 'rgba(13, 121, 100, 0.25)', borderColor: GAIN }} />
        fewer courses
      </span>
      <span className='inline-flex items-center gap-1.5'>
        <i className='inline-block w-4 h-px bg-black' />
        comparison value
      </span>
    </div>
  )
}

/**
 * The figure. `bars` drives the filled bars; `ghost` (diff view) marks each
 * bar's difference against a second dataset: the delta REGION is shaded
 * (solid red segment = courses added vs the ghost; translucent green block
 * above the bar = courses no longer needed), a black tick marks the ghost's
 * level, and annotations become signed deltas. Unchanged bars stay plain so
 * the movers stand out. Without `ghost`, annotations are the paper's rotated
 * value labels.
 */
// Exported for the render-parity check (scripts render this to a standalone
// SVG and compare it against the paper's published PNG).
export function FigureSVG({ bars, ghost = null, labelMode }) {
  // The script sizes the y-axis to the tallest bar + 18% headroom
  // (grouped_bar_graph.py L169–179); the diff view fits both datasets.
  const yMax = 1.18 * Math.max(maxTop(bars), ghost ? maxTop(ghost) : 0)
  const yPx = (v) => PLOT.top + (1 - v / yMax) * (PLOT.bottom - PLOT.top)
  const yTicks = []
  for (let v = 0; v <= Math.floor(yMax); v += 2) yTicks.push(v)

  const bar = (cx, value, fill, key) => (
    <rect
      key={key}
      x={xPx(cx) - barWpx / 2}
      y={yPx(value)}
      width={barWpx}
      height={yPx(0) - yPx(value)}
      fill={fill}
    />
  )
  // Difference marks for one bar slot: shade the delta region, tick the
  // ghost level, label the signed delta. Unchanged bars get only a quiet
  // gray 0.00.
  const diffMarks = (cx, ourTop, ghostTop, key) => {
    const d = +(ourTop - ghostTop).toFixed(2)
    const x = xPx(cx) - barWpx / 2
    return (
      <g key={key}>
        {d > 0 && (
          // The white outline stays a constant screen width and keeps adjacent
          // positive-difference segments legible when their bar edges touch.
          <rect
            data-difference='increase'
            x={x}
            y={yPx(ourTop)}
            width={barWpx}
            height={yPx(ghostTop) - yPx(ourTop)}
            fill={LOSS}
            stroke='#ffffff'
            strokeWidth={1.5}
            vectorEffect='non-scaling-stroke'
          />
        )}
        {d < 0 && (
          // courses NO LONGER needed: the now-empty region up to the ghost level
          <rect
            x={x}
            y={yPx(ghostTop)}
            width={barWpx}
            height={yPx(ourTop) - yPx(ghostTop)}
            fill={GAIN}
            fillOpacity={0.25}
            stroke={GAIN}
            strokeWidth={1.6}
            strokeDasharray='5 4'
          />
        )}
        {d !== 0 && (
          <line x1={x - 5} x2={x + barWpx + 5} y1={yPx(ghostTop)} y2={yPx(ghostTop)} stroke='#000' strokeWidth={2.4} />
        )}
        <VText
          x={xPx(cx)}
          y={yPx(Math.max(ourTop, ghostTop) + 0.1)}
          size={pt(20)}
          fill={d === 0 ? '#9e9e9e' : d < 0 ? GAIN : LOSS}
        >
          {signed(d)}
        </VText>
      </g>
    )
  }

  return (
    <svg
      data-export-width={VB.w}
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      role='img'
      aria-label='Grouped bar chart: per UC campus, the CS/Math transfer requirement (gold) and the average CCC courses needed at 1st through 4th choice (blues)'
      style={{ width: '100%', height: 'auto', display: 'block', background: '#ffffff' }}
      fontFamily='Arial, sans-serif'
    >
      <defs>
        {/* `//` hatch measured off the PNG: ~16.3 px horizontal period, ~1.5 px
            black lines at 45°, on cornsilk. */}
        <pattern id='quarterHatch' patternUnits='userSpaceOnUse' width={16.3} height={16.3}>
          <rect width={16.3} height={16.3} fill={PAPER_COLORS.quarterCap} />
          <path d='M -4 4 L 4 -4 M 0 16.3 L 16.3 0 M 12.3 20.3 L 20.3 12.3' stroke='#000' strokeWidth={1.5} />
        </pattern>
      </defs>

      {/* y ticks + labels */}
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PLOT.left} x2={PLOT.left - 4.9} y1={yPx(v)} y2={yPx(v)} stroke='#000' strokeWidth={1.1} />
          <text x={PLOT.left - 12} y={yPx(v)} textAnchor='end' dominantBaseline='central' fontSize={pt(28)} fill='#000'>
            {v}
          </text>
        </g>
      ))}

      {/* x ticks + campus labels */}
      {bars.map((uc, i) => (
        <g key={uc.code}>
          <line x1={xPx(i)} x2={xPx(i)} y1={PLOT.bottom} y2={PLOT.bottom + 4.9} stroke='#000' strokeWidth={1.1} />
          {/* Campus names are longer than the paper's UC ids; the paper's
              30 pt tick size only fits the ids. */}
          <text x={xPx(i)} y={PLOT.bottom + 11} textAnchor='middle' dominantBaseline='hanging' fontSize={labelMode === 'names' ? pt(18) : pt(30)} fill='#000'>
            {xTickLabel(uc, labelMode)}
          </text>
        </g>
      ))}

      {/* bars + annotations, one group per campus */}
      {bars.map((uc, i) => {
        const sem = uc.requirementSemester
        const cap = uc.requirementQuarter ? uc.requirementQuarter - sem : 0
        const g = ghost ? ghost[i] : null
        const gx = i + OFFSETS[0]
        return (
          <g key={uc.code}>
            {bar(gx, sem, PAPER_COLORS.requirement, 'req')}
            {cap > 0 && (
              <rect
                x={xPx(gx) - barWpx / 2}
                y={yPx(sem + cap)}
                width={barWpx}
                height={yPx(sem) - yPx(sem + cap)}
                fill='url(#quarterHatch)'
              />
            )}
            {ghost ? (
              diffMarks(gx, sem + cap, barTop(g), 'req-diff')
            ) : (
              <>
                {/* total above the gold bar; semester value centered inside it */}
                <VText x={xPx(gx)} y={yPx(sem + cap + 0.1)} size={pt(20)}>{fmt(sem + cap)}</VText>
                <VText x={xPx(gx)} y={yPx(sem / 2)} size={pt(20)} anchor='middle'>{fmt(sem)}</VText>
              </>
            )}
            {uc.choices.map((value, j) => {
              const cx = i + OFFSETS[j + 1]
              const gv = g ? g.choices[j] : null
              return (
                <g key={j}>
                  {bar(cx, value, PAPER_COLORS.choices[j])}
                  {ghost
                    ? diffMarks(cx, value, gv)
                    : <VText x={xPx(cx)} y={yPx(value + 0.1)} size={pt(20)}>{fmt(value)}</VText>}
                </g>
              )
            })}
          </g>
        )
      })}

      {/* axes box drawn over the bars, as matplotlib spines are */}
      <rect
        x={PLOT.left}
        y={PLOT.top}
        width={PLOT.right - PLOT.left}
        height={PLOT.bottom - PLOT.top}
        fill='none'
        stroke='#000'
        strokeWidth={1.1}
      />

      {/* axis labels (positions measured off the paper PNG) */}
      <VText x={29} y={(PLOT.top + PLOT.bottom) / 2} size={pt(35)} anchor='middle'>Number of Courses</VText>
      <text
        x={(PLOT.left + PLOT.right) / 2}
        y={1168}
        textAnchor='middle'
        fontSize={pt(35)}
        fill='#000'
      >
        University of California
      </text>

      <LegendBox />
    </svg>
  )
}

// Publication renderer for the recomputed states. The frozen paper baseline
// intentionally continues to use FigureSVG above so its geometry remains a
// faithful port; current and ASSIST data share this cleaner visual language
// with the other modern California figures.
const MODERN = Object.freeze({
  width: CA_FIGURE.width,
  // 1240 / 742 closely matches the legacy figure's 1990.3 / 1190.3 aspect.
  height: 742,
  plotLeft: 82,
  plotRight: 1216,
  plotTop: 68,
  plotBottom: 610,
})
const REQUIREMENT_GOLD = '#FAE745'
const REQUIREMENT_CREAM = '#FAF8E1'

function modernTickStep(maximum) {
  const rough = maximum / 4
  if (rough <= 1) return 1
  if (rough <= 2) return 2
  if (rough <= 5) return 5
  if (rough <= 10) return 10
  return Math.ceil(rough / 10) * 10
}

function roundedTopPath(x, y, width, height, radius = 4) {
  if (height <= 0) return ''
  const bottom = y + height
  const r = Math.min(radius, width / 2, height / 2)
  return [
    `M ${x} ${bottom}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${bottom}`,
    'Z',
  ].join(' ')
}

function ModernVerticalLabel({ x, y, fill = CA_FIGURE.ink, anchor = 'start', children }) {
  return (
    <text x={x} y={y} transform={`rotate(-90 ${x} ${y})`}
      textAnchor={anchor} dominantBaseline='central' fontSize='17' fontWeight='500'
      fill={fill} style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
      {children}
    </text>
  )
}

function ModernDifferenceMark({ x, width, current, comparison, yScale }) {
  const delta = +(current - comparison).toFixed(2)
  const currentY = yScale(current)
  const comparisonY = yScale(comparison)
  const direction = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : 'unchanged'

  return (
    <g data-comparison-overlay data-difference={direction}>
      {delta > 0 && (
        <rect x={x} y={currentY} width={width} height={comparisonY - currentY}
          fill={LOSS} fillOpacity='0.78' />
      )}
      {delta < 0 && (
        <rect x={x} y={comparisonY} width={width} height={currentY - comparisonY}
          fill={GAIN} fillOpacity='0.18' stroke={GAIN} strokeWidth='1.75'
          strokeDasharray='6 4' vectorEffect='non-scaling-stroke' />
      )}
      {delta !== 0 && (
        <line x1={x - 3} x2={x + width + 3} y1={comparisonY} y2={comparisonY}
          stroke={CA_FIGURE.ink} strokeWidth='2' vectorEffect='non-scaling-stroke' />
      )}
      <ModernVerticalLabel x={x + width / 2}
        y={Math.min(currentY, comparisonY) - 8}
        fill={delta === 0 ? CA_FIGURE.mutedLine : delta < 0 ? GAIN : LOSS}>
        {signed(delta)}
      </ModernVerticalLabel>
    </g>
  )
}

/**
 * The modern 1240 px publication figure used by current and ASSIST states.
 * It deliberately accepts the same `bars` / `ghost` inputs as FigureSVG so
 * changing presentation cannot change any calculation or comparison meaning.
 */
export function ModernCreditLossFigure({
  bars,
  ghost = null,
  labelMode = 'names',
  dataVersion = 'current',
  majorLabel = 'Computer Science',
  requirementLabel = 'CS/Math requirement',
  requirementAriaLabel = 'CS and math requirements',
}) {
  const reactId = useId()
  const titleId = `creditLossTitle${reactId.replace(/:/g, '')}`
  const descriptionId = `creditLossDescription${reactId.replace(/:/g, '')}`
  const hatchId = `creditLossQuarterHatch${reactId.replace(/:/g, '')}`
  const unavailableHatchId = `creditLossUnavailableHatch${reactId.replace(/:/g, '')}`
  const tallest = Math.max(maxTop(bars), ghost ? maxTop(ghost) : 0, 1)
  const tickStep = modernTickStep(tallest)
  const topTick = Math.max(tickStep, Math.ceil(tallest / tickStep) * tickStep)
  // Keep about twelve percent of the plotting height clear above the highest
  // labeled tick, matching the handoff while still accommodating ASSIST's
  // substantially taller (up to 17-course) requirements.
  const domainMax = topTick / 0.88
  const yScale = (value) => MODERN.plotBottom
    - (value / domainMax) * (MODERN.plotBottom - MODERN.plotTop)
  const ticks = []
  for (let value = 0; value <= topTick; value += tickStep) ticks.push(value)

  const groupWidth = (MODERN.plotRight - MODERN.plotLeft) / bars.length
  const barWidth = 20
  const barGap = 4
  const groupBarsWidth = barWidth * 5 + barGap * 4
  const barX = (groupIndex, seriesIndex) => MODERN.plotLeft
    + groupIndex * groupWidth
    + (groupWidth - groupBarsWidth) / 2
    + seriesIndex * (barWidth + barGap)
  const barHeight = (value) => MODERN.plotBottom - yScale(value)
  const legend = [
    { label: requirementLabel, fill: REQUIREMENT_GOLD },
    ...['1st choice', '2nd choice', '3rd choice', '4th choice'].map((label, index) => ({
      label,
      fill: CA_CHOICE_COLORS[index],
    })),
  ]
  const legendX = [82, 310, 465, 620, 775]

  return (
    <svg data-modern-california-figure='credit-loss' data-figure-version={dataVersion}
      data-export-width={MODERN.width} viewBox={`0 0 ${MODERN.width} ${MODERN.height}`}
      role='img'
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      fontFamily={CA_FIGURE.fontFamily}
      style={{ width: '100%', height: 'auto', display: 'block', background: CA_FIGURE.background }}>
      <title id={titleId}>{majorLabel} transfer pathway credit loss by University of California campus</title>
      <desc id={descriptionId}>
        Grouped bar chart of current {requirementAriaLabel} and average community college courses
        needed for each University of California campus choice.
      </desc>
      <defs>
        <pattern id={hatchId} patternUnits='userSpaceOnUse' width='11' height='11'>
          <rect width='11' height='11' fill={REQUIREMENT_CREAM} />
          <path d='M -3 3 L 3 -3 M 0 11 L 11 0 M 8 14 L 14 8'
            stroke={REQUIREMENT_GOLD} strokeWidth='2.5' />
        </pattern>
        <pattern id={unavailableHatchId} patternUnits='userSpaceOnUse' width='9' height='9'
          patternTransform='rotate(45)'>
          <line x1='0' y1='0' x2='0' y2='9' stroke={CA_FIGURE.mutedLine}
            strokeWidth='1.25' strokeOpacity='0.55' />
        </pattern>
      </defs>

      <rect x='12' y='14' width='1216' height='682' rx='8'
        fill={CA_FIGURE.background} stroke={CA_FIGURE.mutedLine}
        strokeOpacity='0.45' strokeWidth='1' data-modern-panel-border='credit-loss' />

      <g aria-label='Legend'>
        {legend.map((item, index) => (
          <g key={item.label} transform={`translate(${legendX[index]} 26)`}>
            <rect width='26' height='16' rx='4' fill={item.fill}
              stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
            <text x='34' y='8' dominantBaseline='central' fontSize='14' fill={CA_FIGURE.ink}>
              {item.label}
            </text>
          </g>
        ))}
      </g>
      <text x='1208' y='34' textAnchor='end' dominantBaseline='central'
        fontSize='14' fontWeight='600' fill={CA_FIGURE.ink} data-major-label>
        Major · {majorLabel}
      </text>

      {ticks.map((value) => (
        <g key={value} data-y-tick={value}>
          <line x1={MODERN.plotLeft} x2={MODERN.plotRight}
            y1={yScale(value)} y2={yScale(value)} stroke={CA_FIGURE.grid} strokeWidth='1' />
          <text x={MODERN.plotLeft - 10} y={yScale(value)} textAnchor='end'
            dominantBaseline='central' fontSize='16' fill={CA_FIGURE.ink}
            style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}>
            {value}
          </text>
        </g>
      ))}
      <line x1={MODERN.plotLeft} x2={MODERN.plotRight}
        y1={MODERN.plotBottom} y2={MODERN.plotBottom}
        stroke={CA_FIGURE.mutedLine} strokeWidth='1.5' />

      {bars.map((campus, groupIndex) => {
        const semester = campus.requirementSemester
        const total = barTop(campus)
        const cap = Math.max(0, total - semester)
        const comparison = ghost?.[groupIndex] || null
        const requirementX = barX(groupIndex, 0)
        const semesterY = yScale(semester)
        const totalY = yScale(total)
        return (
          <g key={campus.code} data-campus={campus.code}>
            <g data-modern-bar data-series='requirement' data-value={total}
              aria-label={`${campus.campus}, ${requirementAriaLabel}: ${fmt(total)} courses`}>
              {cap > 0 ? (
                <>
                  <rect x={requirementX} y={semesterY} width={barWidth}
                    height={barHeight(semester)} fill={REQUIREMENT_GOLD}
                    stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
                  <path d={roundedTopPath(requirementX, totalY, barWidth, semesterY - totalY)}
                    fill={`url(#${hatchId})`} stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
                </>
              ) : (
                <path d={roundedTopPath(requirementX, totalY, barWidth, barHeight(total))}
                  fill={REQUIREMENT_GOLD} stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
              )}
              {comparison ? (
                <ModernDifferenceMark x={requirementX} width={barWidth} current={total}
                  comparison={barTop(comparison)} yScale={yScale} />
              ) : (
                <>
                  <ModernVerticalLabel x={requirementX + barWidth / 2} y={totalY - 6}>
                    {fmt(total)}
                  </ModernVerticalLabel>
                  {cap > 0 && (
                    <ModernVerticalLabel x={requirementX + barWidth / 2} y={semesterY + 5}
                      anchor='end'>
                      {fmt(semester)}
                    </ModernVerticalLabel>
                  )}
                </>
              )}
            </g>

            {campus.choices.map((value, choiceIndex) => {
              const x = barX(groupIndex, choiceIndex + 1)
              const y = yScale(value)
              const comparisonValue = comparison?.choices[choiceIndex]
              const available = choiceAvailable(campus, choiceIndex)
              const ordinal = `${choiceIndex + 1}${choiceIndex === 0 ? 'st' : choiceIndex === 1 ? 'nd' : choiceIndex === 2 ? 'rd' : 'th'}`
              return (
                <g key={choiceIndex} data-modern-bar data-series={`choice-${choiceIndex + 1}`}
                  data-value={available ? value : undefined}
                  data-unavailable={available ? undefined : 'true'}
                  aria-label={available
                    ? `${campus.campus}, ${ordinal} choice: ${fmt(value)} courses`
                    : `${campus.campus}, ${ordinal} choice: unavailable because no districts were eligible`}>
                  {available ? (
                    <path d={roundedTopPath(x, y, barWidth, barHeight(value))}
                      fill={CA_CHOICE_COLORS[choiceIndex]}
                      stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
                  ) : (
                    <rect x={x} y={MODERN.plotTop} width={barWidth}
                      height={MODERN.plotBottom - MODERN.plotTop}
                      fill={`url(#${unavailableHatchId})`} />
                  )}
                  {available && comparison ? (
                    <ModernDifferenceMark x={x} width={barWidth} current={value}
                      comparison={comparisonValue} yScale={yScale} />
                  ) : available ? (
                    <ModernVerticalLabel x={x + barWidth / 2} y={y - 6}>
                      {fmt(value)}
                    </ModernVerticalLabel>
                  ) : (
                    <text x={x + barWidth / 2} y={MODERN.plotBottom - 7}
                      textAnchor='middle' fontSize='18' fontWeight='600' fill={CA_FIGURE.ink}>
                      —
                    </text>
                  )}
                </g>
              )
            })}

            <text x={MODERN.plotLeft + groupIndex * groupWidth + groupWidth / 2}
              y='636' textAnchor='middle' fontSize='16' fill={CA_FIGURE.ink}>
              {xTickLabel(campus, labelMode)}
            </text>
          </g>
        )
      })}

      <text x='34' y={(MODERN.plotTop + MODERN.plotBottom) / 2}
        textAnchor='middle' transform={`rotate(-90 34 ${(MODERN.plotTop + MODERN.plotBottom) / 2})`}
        fontSize='18' fontWeight='500' fill={CA_FIGURE.ink}>
        Number of courses
      </text>
      <text x={(MODERN.plotLeft + MODERN.plotRight) / 2} y='674'
        textAnchor='middle' fontSize='18' fontWeight='500' fill={CA_FIGURE.ink}>
        University of California campus
      </text>

      <g transform='translate(82 708)' aria-label='Figure notes'>
        <rect width='24' height='15' rx='4' fill={`url(#${hatchId})`}
          stroke={CA_FIGURE.ink} strokeOpacity='0.1' />
        <text x='32' y='7.5' dominantBaseline='central' fontSize='14' fill={CA_FIGURE.ink}>
          Hatched = quarter-system requirement (semester-equivalent shown solid)
        </text>
        <text x='590' y='7.5' dominantBaseline='central' fontSize='14' fontWeight='600'
          fill={CA_FIGURE.ink}>*</text>
        <text x='606' y='7.5' dominantBaseline='central' fontSize='14' fill={CA_FIGURE.ink}>
          {CA_QUARTER_NOTE.slice(2)}
        </text>
        <rect x='948' width='24' height='15' rx='3' fill={`url(#${unavailableHatchId})`}
          stroke={CA_FIGURE.grid} />
        <text x='980' y='7.5' dominantBaseline='central' fontSize='14' fill={CA_FIGURE.ink}>
          No eligible districts
        </text>
      </g>
    </svg>
  )
}

/** Figure-only gallery thumbnail, always reflecting the selected major's live ASSIST state. */
export function PaperCreditLossPreview({ majorSlug = 'cs', majorLabel = '' }) {
  const normalizedSlug = String(majorSlug || 'cs').trim().toLowerCase()
  const resolvedMajorLabel = majorLabelFor(normalizedSlug, majorLabel)
  const artifact = getAssistCreditLossArtifact(normalizedSlug)
  if (!artifact || artifact.requirements !== 'assist' || Number(artifact.schema_version) < 2) {
    return null
  }
  try {
    return <ModernCreditLossFigure bars={barsFromAssistArtifact(artifact)} labelMode='names'
      dataVersion='assist' majorLabel={resolvedMajorLabel}
      requirementLabel='ASSIST requirement slots'
      requirementAriaLabel={`${resolvedMajorLabel} ASSIST required receiver slots`} />
  } catch {
    return null
  }
}

// The matrix's diverging poles. Crimson (LOSS) = more courses; a validated teal
// = fewer. This teal is a touch more saturated than the bars' GAIN so the
// "better" tints don't read gray against the neutral midpoint (dataviz palette
// check). CVD-safe (ΔE ~21 vs crimson) and always paired with the signed number.
const DIVERGE_TEAL = '#0f9d7c'

// Diverging cell fill for a signed delta: teal toward "fewer courses" (better),
// crimson toward "more" (worse), transparent near zero. Alpha scales with
// magnitude and is capped so the value text stays legible over the tint.
function deltaFill(d, maxAbs) {
  if (Math.abs(d) < 0.005 || !maxAbs) return 'transparent'
  const a = 0.1 + 0.62 * Math.min(1, Math.abs(d) / maxAbs)
  const n = parseInt((d > 0 ? LOSS : DIVERGE_TEAL).slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`
}

const COL_SHORT = ['Req', '1st', '2nd', '3rd', '4th']
const COL_LONG = ['CS/Math requirement', '1st choice', '2nd choice', '3rd choice', '4th choice']

// The whole signed-difference matrix (campus × requirement/choice) as a compact
// diverging heatmap — the "read every number at once" companion to the bars.
// Color shows direction + magnitude; the number gives the exact value; hover
// adds the before → after. On-screen only (not part of the exported figure).
function DifferenceHeatmap({ live, baseline, comparisonLabel, labelMode }) {
  const rows = live.map((uc, i) => {
    const b = baseline[i]
    const our = [barTop(uc), ...uc.choices]
    const base = [barTop(b), ...b.choices]
    const available = [
      true,
      ...uc.choices.map((_, choiceIndex) => (
        choiceAvailable(uc, choiceIndex) && choiceAvailable(b, choiceIndex)
      )),
    ]
    return {
      code: uc.code,
      id: uc.id,
      name: uc.campus,
      our,
      base,
      available,
      deltas: our.map((v, k) => (available[k] ? +(v - base[k]).toFixed(2) : null)),
    }
  })
  const maxAbs = Math.max(
    0.001,
    ...rows.flatMap((r) => r.deltas.filter(Number.isFinite).map((d) => Math.abs(d)))
  )
  const rowLabel = (r) => (labelMode === 'names' ? r.name.replace(/^UC\s+/i, '') : r.id)

  return (
    <div className='surface-card p-4' data-export-exclude>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-3'>
        <p className='text-label'>Every difference · courses vs {comparisonLabel}</p>
        <div className='flex items-center gap-2 text-tag text-ink-subtle'>
          <span>fewer / better</span>
          <span className='h-3 w-24 rounded' style={{ background: `linear-gradient(to right, ${DIVERGE_TEAL}, rgba(148,163,184,0.45), ${LOSS})` }} />
          <span>more / worse</span>
        </div>
      </div>
      <div className='overflow-x-auto'>
        <table className='w-full text-body tabular-nums' style={{ borderCollapse: 'separate', borderSpacing: 5 }}>
          <thead>
            <tr>
              <th className='text-left px-3 py-2 font-normal text-ink-subtle'>Campus</th>
              {COL_SHORT.map((c) => (
                <th key={c} className='px-3 py-2 font-normal text-ink-subtle text-center w-[15%]'>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <th scope='row' className='text-left px-3 py-2.5 font-medium text-ink whitespace-nowrap'>{rowLabel(r)}</th>
                {r.deltas.map((d, k) => (
                  <td key={k} className='px-3 py-2.5 text-center rounded-md text-ink font-medium'
                    style={{ backgroundColor: Number.isFinite(d) ? deltaFill(d, maxAbs) : 'transparent' }}
                    title={Number.isFinite(d)
                      ? `${r.name} · ${COL_LONG[k]}: ${fmt(r.base[k])} → ${fmt(r.our[k])} (${signed(d)})`
                      : `${r.name} · ${COL_LONG[k]}: unavailable (no eligible districts)`}>
                    {!Number.isFinite(d)
                      ? <span className='text-ink-subtle font-normal'>—</span>
                      : Math.abs(d) < 0.005
                        ? <span className='text-ink-subtle font-normal'>0</span>
                        : signed(d)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CsPaperCreditLoss({ majorLabel }) {
  // ASSIST first; the paper baseline stays one click away as the comparison.
  const [version, setVersion] = useState('assist')  // 'paper' | 'website' | 'assist'
  const [showDiff, setShowDiff] = useState(false)
  const [labelMode, setLabelMode] = useState('names')
  const [showMatrix, setShowMatrix] = useState(false)

  // Derive the underlying view/minimums from the version + differences toggle so
  // the existing bar/ghost rendering is unchanged.
  const reqMode = version === 'assist' ? 'assist' : 'website'
  const diffOn = showDiff && version !== 'paper'
  const view = version === 'paper' ? 'paper' : (diffOn ? 'diff' : 'live')

  const activeData = reqMode === 'assist' ? assistData : oursData
  const liveBars = reqMode === 'assist' ? ASSIST_BARS : OURS_BARS
  const baselineBars = reqMode === 'assist' ? OURS_BARS : PAPER_UC_BARS
  const bars = view === 'paper' ? PAPER_UC_BARS : liveBars
  const ghost = view === 'diff' ? baselineBars : null
  const comparisonLabel = reqMode === 'assist' ? 'hand-curated minimums' : 'paper'

  return (
    <Stack gap='section'>
      {/* Controls stay out of PDF/PNG exports — the file should read as a figure. */}
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>Version</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {VERSIONS.map((v) => (
              <button
                key={v.value}
                type='button'
                onClick={() => setVersion(v.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  version === v.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className='flex h-9 items-center'>
          <SwitchField
            label='Show differences'
            checked={diffOn}
            onChange={() => setShowDiff((s) => !s)}
            disabled={version === 'paper'}
          />
        </div>
        <div className='ml-auto flex h-9 flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
          {view === 'paper'
            ? <span>Paper baseline — transcribed from the 2026 optimal set-cover CSVs</span>
            : (
              <>
                <span className='font-mono tabular-nums'>{activeData.dataset_version}</span>
                <span>recomputed {activeData.generated_at?.slice(0, 10)} by {activeData.generated_by}</span>
              </>
            )}
        </div>
      </div>

      <div data-export-root className='flex flex-col gap-4'>
        {view === 'paper' ? (
          <div className='surface-card p-3' style={{ background: '#ffffff' }}>
            <FigureSVG bars={bars} ghost={ghost} labelMode={labelMode} />
          </div>
        ) : (
          <ModernCreditLossFigure bars={bars} ghost={ghost} labelMode={labelMode}
            dataVersion={version}
            majorLabel={majorLabel}
            requirementLabel={reqMode === 'assist' ? 'ASSIST requirement slots' : undefined}
            requirementAriaLabel={reqMode === 'assist'
              ? 'ASSIST required receiver slots'
              : undefined} />
        )}
        {view === 'diff' && <DifferenceLegend comparisonLabel={comparisonLabel} />}
      </div>

      {view === 'diff' && (
        <div data-export-exclude>
          <button
            type='button'
            onClick={() => setShowMatrix((s) => !s)}
            aria-expanded={showMatrix}
            className='flex items-center gap-1.5 text-caption text-ink-muted hover:text-ink'
          >
            <ChevronRightIcon className={`w-4 h-4 transition-transform ${showMatrix ? 'rotate-90' : ''}`} />
            {showMatrix ? 'Hide difference matrix' : 'More details — every difference as a matrix'}
          </button>
          {showMatrix && (
            <div className='mt-3'>
              <DifferenceHeatmap live={liveBars} baseline={baselineBars} comparisonLabel={comparisonLabel} labelMode={labelMode} />
            </div>
          )}
        </div>
      )}

      <div className='flex flex-wrap items-center gap-4' data-export-exclude>
        <button
          type='button'
          onClick={() => setLabelMode(labelMode === 'paper' ? 'names' : 'paper')}
          className='ml-auto text-tag font-mono text-ink-subtle hover:text-ink underline underline-offset-2'
        >
          {labelMode === 'paper' ? 'show campus names' : 'show UC1–9 ids'}
        </button>
      </div>
    </Stack>
  )
}

function AssistOnlyPaperCreditLoss({ majorSlug, majorLabel }) {
  const [labelMode, setLabelMode] = useState('names')
  const artifact = getAssistCreditLossArtifact(majorSlug)

  if (!artifact) {
    return (
      <Alert type='warning'>
        No audited ASSIST credit-loss artifact is available for this major.
      </Alert>
    )
  }
  if (artifact.requirements !== 'assist' || Number(artifact.schema_version) < 2) {
    return (
      <Alert type='warning'>
        This major&apos;s ASSIST credit-loss artifact predates the canonical-template denominator and must be regenerated.
      </Alert>
    )
  }

  let bars
  try {
    bars = barsFromAssistArtifact(artifact)
  } catch (error) {
    return <Alert type='error'>{error.message}</Alert>
  }
  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>Requirement source</span>
          <span className='text-body text-ink'>Current ASSIST requirements · receiver-slot model</span>
        </div>
        <div className='ml-auto flex h-9 flex-wrap items-center gap-2 text-caption text-ink-subtle text-right'>
          <span className='font-mono tabular-nums'>{artifact.dataset_version}</span>
          <span>recomputed {artifact.generated_at?.slice(0, 10)} by {artifact.generated_by}</span>
        </div>
      </div>

      <div data-export-root className='flex flex-col gap-4'>
        <ModernCreditLossFigure
          bars={bars}
          labelMode={labelMode}
          dataVersion='assist'
          majorLabel={majorLabel}
          requirementLabel='ASSIST requirement slots'
          requirementAriaLabel={`${majorLabel} ASSIST required receiver slots`}
        />
      </div>

      <div className='flex flex-wrap items-center gap-4' data-export-exclude>
        <button
          type='button'
          onClick={() => setLabelMode(labelMode === 'paper' ? 'names' : 'paper')}
          className='ml-auto text-tag font-mono text-ink-subtle hover:text-ink underline underline-offset-2'
        >
          {labelMode === 'paper' ? 'show campus names' : 'show UC1–9 ids'}
        </button>
      </div>
    </Stack>
  )
}

export default function PaperCreditLoss({ majorSlug = 'cs', majorLabel = '' }) {
  const normalizedSlug = String(majorSlug || 'cs').trim().toLowerCase()
  const resolvedMajorLabel = majorLabelFor(normalizedSlug, majorLabel)
  return normalizedSlug === 'cs'
    ? <CsPaperCreditLoss majorLabel={resolvedMajorLabel} />
    : <AssistOnlyPaperCreditLoss majorSlug={normalizedSlug} majorLabel={resolvedMajorLabel} />
}
