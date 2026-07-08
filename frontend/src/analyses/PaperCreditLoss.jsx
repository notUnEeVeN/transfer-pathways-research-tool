import React, { useMemo, useState } from 'react'
import { Stack, StatStrip, SwitchField } from '../components/ui'
import { CHOICE_LABELS, PAPER_COLORS, PAPER_UC_BARS } from './paperCreditLossBaseline'
import assistData from './data/paper-credit-loss.assist.json'
import oursData from './data/paper-credit-loss.ours.json'

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
 * signed delta. Provenance + verification: docs/figures/paper-credit-loss.md.
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

const GAIN = '#0d7964' // fewer CCC courses than the paper — improvement
const LOSS = '#cb1d51'

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
  }
})

const ASSIST_BARS = PAPER_UC_BARS.map((paper) => {
  const c = assistData.campuses.find((x) => x.code === paper.code)
  return {
    code: c.code,
    id: c.id,
    campus: CAMPUS_NAME[c.code],
    requirementSemester: c.requirement.semester_equiv,
    requirementQuarter: c.requirement.quarter_count,
    choices: c.choices.map((ch) => ch.transferable_average),
  }
})

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
          // courses ADDED vs the ghost: the top segment of our bar, in red
          <rect x={x} y={yPx(ourTop)} width={barWpx} height={yPx(ghostTop) - yPx(ourTop)} fill={LOSS} />
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

function diffStats(bars, baseline) {
  const deltas = []
  bars.forEach((barSet, i) => {
    barSet.choices.forEach((v, j) => {
      deltas.push({ code: barSet.code, order: j + 1, delta: +(v - baseline[i].choices[j]).toFixed(2) })
    })
  })
  const first = deltas.filter((d) => d.order === 1)
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length
  const largest = deltas.reduce((m, d) => (Math.abs(d.delta) > Math.abs(m.delta) ? d : m))
  const reqDrift = bars.filter(
    (o, i) => o.requirementSemester !== baseline[i].requirementSemester
      || o.requirementQuarter !== baseline[i].requirementQuarter
  ).length
  return {
    meanFirst: mean(first.map((d) => d.delta)),
    meanAll: mean(deltas.map((d) => d.delta)),
    largest,
    reqDrift,
    improved: deltas.filter((d) => d.delta < 0).length,
    worsened: deltas.filter((d) => d.delta > 0).length,
  }
}

export default function PaperCreditLoss() {
  const [version, setVersion] = useState('paper')  // 'paper' | 'website' | 'assist'
  const [showDiff, setShowDiff] = useState(false)
  const [labelMode, setLabelMode] = useState('paper')

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
  const stats = useMemo(
    () => diffStats(liveBars, baselineBars),
    [liveBars, baselineBars]
  )
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
        <div className='ml-auto flex flex-wrap items-center gap-2 text-caption text-ink-subtle'>
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

      {/* Comparison stats are on-screen context, not part of the exported figure. */}
      {view !== 'paper' && (
        <div data-export-exclude>
          <StatStrip
            tiles={[
              { label: 'Mean 1st-choice Δ', value: signed(stats.meanFirst), sub: `CCC courses vs ${comparisonLabel}`, accent: true },
              { label: 'Mean Δ, all 36 bars', value: signed(stats.meanAll), sub: `${stats.improved} lower · ${stats.worsened} higher` },
              { label: 'Largest mover', value: `${stats.largest.code} ${signed(stats.largest.delta)}`, sub: `as ${['1st', '2nd', '3rd', '4th'][stats.largest.order - 1]} choice` },
              { label: 'Requirement drift', value: String(stats.reqDrift), sub: `gold bars differing from ${comparisonLabel}` },
            ]}
          />
        </div>
      )}

      <div className='surface-card p-3' style={{ background: '#ffffff' }}>
        <FigureSVG bars={bars} ghost={ghost} labelMode={labelMode} />
      </div>

      <div className='flex flex-wrap items-center gap-4' data-export-exclude>
        <span className='text-caption text-ink-subtle'>
          {view === 'diff'
            ? `Bars = ${reqMode === 'assist' ? 'our ASSIST-minimums data' : 'our data'}. Solid red segment = courses added vs ${comparisonLabel}; translucent green block = courses no longer needed (tops out at the comparison level); black tick = comparison level; gray 0.00 = unchanged.`
            : 'Gold = CS/Math requirement in semester-course equivalents; hatched cap = quarter-system excess; blues = average CCC courses at 1st–4th choice.'}
          {' '}Provenance and verification: docs/figures/paper-credit-loss.md.
        </span>
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
