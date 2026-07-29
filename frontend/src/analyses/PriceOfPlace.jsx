import React, { useState } from 'react'
import { Stack } from '../components/ui'
import snapshot from './priceOfPlaceSnapshot.json'
import repairs from '../../../analysis/data/course_repairs.v2.json'

/**
 * "The Income Gate" — a figure sequence: Computer Science transfer
 * preparation is gated by where you start — the income of your district and
 * its distance to a campus — in a way the rest of the UC curriculum is not.
 *
 * Figures 1–3 are faithful to the design handoff
 * (docs/design_handoff_price_of_place_figures — "The Price of Place.dc.html"
 * is the detailed spec; the v2 file is the read-at-a-glance register).
 * Figures 4–5 replace the handoff's course-catalogue and audit beats with the
 * distance investigation: the tether map (the confound, shown) and the gate
 * grid (the confound, dismantled by stratification). Every value comes from
 * the committed snapshot, computed from the FULL agreement corpus by
 * server/scripts/generatePriceOfPlaceSnapshot.js. The application database
 * never carries the ~120k-agreement corpus.
 *
 * Every figure measures formal opportunity — whether a complete transfer
 * path formally exists — never student behaviour.
 */

const INK = '#193018'
const SOFT = '#4A5849'
const MUTED_TEXT = '#6B776A'
const MUTED_LINE = '#9CA69B'
const GRID = 'rgba(25,48,24,0.10)'
const GRID_STRONG = 'rgba(25,48,24,0.16)'
const AXIS = 'rgba(25,48,24,0.28)'
const CS_BLUE = '#0072B2'
const FIELD = '#6F7B6E'
const GAINED = '#0D7964'
const Q1_FILL = '#A9C3DE'
const Q4_FILL = '#1E3A5F'
const CONN = '#6E93BF'
const RAMP = ['#A9C3DE', '#6E93BF', '#38618C', '#1E3A5F']
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif"

// Registers: detailed = the paper-facing file; glance = the v2 file (nothing
// under 15px, conclusions as headlines).
const REG = { tick: 15, row: 19, course: 17, note: 15, panel: 18, big: 34, delta: 16, dotR: 9, conn: 8 }

const tetherRatio = (
  snapshot.distance.medianKmByQuartile[0] / snapshot.distance.medianKmByQuartile[3]
).toFixed(1)

const marketMeanSwing = (list) => Math.round(
  (list.reduce((sum, r) => sum + r.swing, 0) / list.length) * 100)

// The field is measured on stated preparation — the only basis it has. The
// Computer Science series follows the page basis: on the eligibility floor
// all nine programs are measurable (UCLA and San Diego are closed only under
// stated preparation), so the floor view joins floor access to the same
// demand counts, two of which come from the artifact's exclusion list.
const campusLabel = (campus) => (campus === 'UCLA' ? 'UC Los Angeles' : `UC ${campus}`)
const CS_APPLICANTS = new Map([
  ...repairs.market.programs.filter((r) => r.cs).map((r) => [r.campus, r.applicants]),
  ...repairs.market.excludedTop.filter((r) => /Computer Science/.test(r.major)).map((r) => [r.campus, r.applicants]),
])
const floorCsRows = snapshot.minimums.fig1.map((p) => ({
  major: 'Computer Science',
  campus: campusLabel(p.campus),
  applicants: CS_APPLICANTS.get(campusLabel(p.campus)) ?? 0,
  q1: p.q1,
  q4: p.q4,
  swing: p.q4 - p.q1,
  cs: true,
}))
const HEADLINES = {
  1: 'For each of the nine programs, the share of districts holding a complete transfer path, in the lowest- and highest-income quartiles.',
  2: 'The same districts drawn twice — shaded by the mean income of the area each serves, then by how many of the nine programs hold a complete path from it. The two shadings align.',
  5: `Distance is a second variable that could produce the income gradient: lower-income districts sit farther from the campuses, the lowest-income quartile ${tetherRatio}× as far as the highest. Because distance and income travel together, the next figure compares each within broad strata of the other.`,
  6: `Districts split at the median distance to a campus (${Math.round(snapshot.distance.medianKm * 0.621371)} miles) and the median income: the income gradient is present within both distance strata, the distance gradient within both income strata, and the Computer Science difference exceeds the field's in all four comparisons.`,
}
const fieldN = snapshot.counts.fieldPrograms
const stairLine = (cs) => `Access rises from ${Math.round(cs[0] * 100)} to ${Math.round(cs[3] * 100)} percent for Computer Science between the lowest- and highest-income quartiles, against ${Math.round(snapshot.fig3.field[0] * 100)} to ${Math.round(snapshot.fig3.field[3] * 100)} for the ${fieldN} other campus-major programs — a markedly steeper gradient for Computer Science.`
const HEADLINES_BY_BASIS = {
  strict: {
    3: stairLine(snapshot.fig3.cs),
    4: `Across the ${repairs.market.programs.filter((r) => !r.cs).length} measurable programs, district income moves access by ${marketMeanSwing(repairs.market.programs.filter((r) => !r.cs))} points on average; the ${repairs.market.programs.filter((r) => r.cs).length} measurable Computer Science programs average ${marketMeanSwing(repairs.market.programs.filter((r) => r.cs))} (the remaining ${9 - repairs.market.programs.filter((r) => r.cs).length} are closed from every district under stated preparation and have no measurable swing). Computer Science sits nearly alone in the high-demand, high-swing corner — at once among the most applied-to programs and among the most income-sensitive.`,
  },
  minimums: {
    3: stairLine(snapshot.minimums.fig3cs),
    4: `Across the ${repairs.market.programs.filter((r) => !r.cs).length} measurable programs, district income moves access by ${marketMeanSwing(repairs.market.programs.filter((r) => !r.cs))} points on average, measured on stated preparation — the only basis the field has. The nine Computer Science programs, measured on the hand-curated eligibility floor, average ${marketMeanSwing(floorCsRows)}. Computer Science sits nearly alone in the high-demand, high-swing corner — at once among the most applied-to programs and among the most income-sensitive.`,
  },
}
const headlineFor = (no, basis) => HEADLINES_BY_BASIS[basis]?.[no] ?? HEADLINES[no]

const kFmt = (v) => `$${(v / 1000).toFixed(1)}k`
const moneyFmt = new Intl.NumberFormat('en-US')
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const pct = (v) => `${pctFmt.format(v * 100)}%`
const pts = (v) => Math.round(v * 100)
const kmToMi = (km) => Math.round(km * 0.621371)
const svgProps = (height, label) => ({
  viewBox: `0 0 1240 ${height}`,
  role: 'img',
  'aria-label': label,
  className: 'block h-auto w-full',
  'data-export-width': 1240,
  style: { fontFamily: FONT, fontVariantNumeric: 'tabular-nums' },
})

// Notes for the paper: the alternative explanations and robustness checks
// run against this sequence, kept so nothing has to be re-derived at writing
// time. Retired analyses live in the data file.
const NOTES = [
  {
    head: 'Alternative explanations, checked',
    items: [
      'Program size — Computer Science requires about 11 courses against a typical 8, ordinary for the corpus.',
      'Multi-college districts — scoring every college on its own leaves the income gap essentially unchanged.',
      'Distance alone — the income gradient persists within both distance strata, and the distance gradient within both income strata (figure 6).',
      'Demographics — person-weighted reach differs too little across groups to report (5.3 of nine for the typical Hispanic resident against 6.0 for the typical Asian resident).',
    ],
  },
  {
    head: 'Robustness checks',
    items: [
      'Requirement basis — recomputed on the hand-verified eligibility floor; the staircase steepens (a 49-point gap against 37), so the strict basis diluted the pattern rather than inflating it.',
      'Basis asymmetry — the field is measured on stated ASSIST preparation, its only basis; Computer Science on the hand-curated floor. Stated listings can only overstate requirements, which lowers measured access and, once a program closes everywhere, flattens its measured gradient toward zero (UCLA Computer Science: 0 to 0 on stated, 22 to 94 on the floor). This plausibly biases the field gradient downward — a direction, not a guarantee — and the like-for-like stated comparison (Computer Science +37 against the field +11) requires no basis assumption.',
      'Enrollment weighting — the staircase survives weighting districts by their enrollment.',
      'Income measure — survives re-ranking districts by census median household income in place of tax-return means (26 of 72 districts change quartile, the pattern does not).',
      'Person weighting — survives counting people instead of districts (mean reach 3.5 of nine in the lowest-income quartile against 6.5 in the highest).',
    ],
  },
  {
    head: 'Set aside',
    items: [
      'Instruments dropped: raw missing-course counts (most have substitutes and block nobody), transferable-unit totals (too noisy), fitted trend lines (misleading on bounded shares), a matched-size comparison group (unneeded once size was ruled out).',
      'Figures retired to the data file: the blocking-course catalogue, the detour to full choice, the graduate count from narrow-access colleges, articulation concentration.',
    ],
  },
  {
    head: 'Not yet checked',
    items: [
      'Earlier years of the agreement database; the city–suburb–rural classification. (Untaught versus unarticulated is covered by The Computing Bottleneck.)',
      'A graded stated-preparation measure — the share of required groups satisfied rather than the binary complete-path check — would relieve the closure censoring without hand curation; not yet built.',
    ],
  },
]

// ───────── beat chrome (the handoff's section anatomy) ─────────

function Beat({ no, role, title, basis = 'strict', children }) {
  return (
    <section aria-label={title}
      className='bg-white rounded-[14px] border flex flex-col gap-5'
      style={{ borderColor: 'rgba(25,48,24,0.11)', padding: '30px 34px 28px' }}>
      <div className='flex flex-col gap-2 max-w-[80ch]'>
        <span className='text-[11.5px] tracking-[0.11em] uppercase font-[700]' style={{ color: CS_BLUE }}>
          {no} · {role}
        </span>
        <h3 className='m-0 text-[26px] leading-[1.14] tracking-[-0.018em] font-[600]' style={{ color: INK }}>{title}</h3>
        <p className='m-0 text-[18px] leading-snug font-[650]' style={{ color: INK }}>{headlineFor(no, basis)}</p>
      </div>
      <div className='rounded-[10px] border bg-white' style={{ borderColor: GRID, padding: '18px 14px 10px' }}>
        {children}
      </div>
    </section>
  )
}

// ───────── Figure 1 — slope rows, grouped by regime ─────────

export function fig1Rows(basis = 'strict') {
  const src = basis === 'minimums' ? snapshot.minimums.fig1 : snapshot.fig1
  const byRegime = (regime) => src.filter((p) => p.regime === regime)
    .sort((a, b) => b.q1 - a.q1 || a.campus.localeCompare(b.campus))
  return [
    { regime: 'closed', members: byRegime('closed') },
    { regime: 'open', members: byRegime('open') },
    { regime: 'contested', members: byRegime('contested') },
  ]
}

function Fig1({ reg, basis }) {
  const bands = fig1Rows(basis).filter((b) => b.members.length > 0)
  const x = (v) => 300 + v * 760
  const { medianIncome } = snapshot.fig3
  const rowStep = reg.row > 16 ? 38 : 32
  const HEADERS = {
    closed: ['CLOSED IN EVERY DISTRICT', MUTED_TEXT],
    open: ['OPEN NEARLY EVERYWHERE', MUTED_TEXT],
    contested: ['VARIES WITH DISTRICT INCOME', CS_BLUE],
  }
  // Bands stack dynamically: under the eligibility floor no campus is closed,
  // so the closed band simply does not render.
  let cursor = 108
  const layout = bands.map((b) => {
    const headerY = cursor
    const rowYs = b.members.map((_, i) => headerY + 28 + i * rowStep)
    cursor = headerY + 28 + b.members.length * rowStep + 26
    return { ...b, headerY, rowYs }
  })
  const height = cursor + 60
  const hasClosed = bands.some((b) => b.regime === 'closed')
  const label = (p) => (p.campus === 'Berkeley' ? 'UC Berkeley' : `UC ${p.campus === 'UCLA' ? 'Los Angeles' : p.campus}`)
  const contestedBand = layout.find((b) => b.regime === 'contested')
  return (
    <svg {...svgProps(height, basis === 'minimums'
      ? 'Nine UC Computer Science programs measured on the hand-verified eligibility floor: one open nearly everywhere, eight varying with district income, none closed.'
      : 'Nine UC Computer Science programs grouped into three regimes: two closed in every district, one open nearly everywhere, six varying with district income.')}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Districts with a complete transfer path, by income quartile</text>
      <text x='1212' y='46' fontSize='12' fill={MUTED_TEXT} textAnchor='end'>Swing, Q1 → Q4</text>

      {contestedBand && (
        <rect x='28' y={contestedBand.headerY - 20} width='1184'
          height={28 + contestedBand.members.length * rowStep + 22} rx='8' fill='rgba(46,92,138,0.045)' />
      )}

      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
        <g key={v}>
          <line x1={x(v)} y1='78' x2={x(v)} y2={height - 66} stroke={i === 0 ? GRID_STRONG : GRID} strokeWidth='1' />
          <text x={x(v)} y='70' fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='middle'>{pct(v)}</text>
        </g>
      ))}

      {layout.map((band) => (
        <g key={band.regime}>
          <text x='28' y={band.headerY} fontSize='12' fontWeight='700'
            fill={HEADERS[band.regime][1]} letterSpacing='0.08em'>{HEADERS[band.regime][0]}</text>
          {band.members.map((p, i) => {
            const cy = band.rowYs[i]
            if (band.regime === 'closed') {
              return (
                <g key={p.campus}>
                  <text x='272' y={cy + 5} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{label(p)}</text>
                  <circle cx={x(0)} cy={cy} r={reg.dotR} fill='#FFFFFF' stroke={MUTED_LINE} strokeWidth='1.6'>
                    <title>{`${label(p)} Computer Science: 0% of districts in every income quartile`}</title>
                  </circle>
                  <text x='318' y={cy + 5} fontSize={reg.tick} fill={MUTED_TEXT}>
                    {i === 0 ? '0% in every quartile — no California community college fully articulates its stated demands' : '0% in every quartile'}
                  </text>
                  <text x='1212' y={cy + 5} fontSize={reg.delta} fontWeight='600' fill={MUTED_LINE} textAnchor='end'>none</text>
                </g>
              )
            }
            const deltaFill = band.regime === 'contested' ? GAINED : MUTED_TEXT
            return (
              <g key={p.campus}>
                <text x='272' y={cy + 5} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{label(p)}</text>
                <line x1={x(p.q1)} y1={cy} x2={x(p.q4)} y2={cy} stroke={CONN} strokeWidth={reg.conn} strokeLinecap='round' />
                <circle cx={x(p.q1)} cy={cy} r={reg.dotR} fill={Q1_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
                  <title>{`${label(p)}, lowest-income quartile: ${pct(p.q1)} of districts`}</title>
                </circle>
                <circle cx={x(p.q4)} cy={cy} r={reg.dotR} fill={Q4_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
                  <title>{`${label(p)}, highest-income quartile: ${pct(p.q4)} of districts`}</title>
                </circle>
                <text x={x(Math.min(p.q1, p.q4)) - 18} y={cy + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(p.q1)}</text>
                <text x={x(Math.max(p.q1, p.q4)) + 18} y={cy + 5} fontSize={reg.tick} fontWeight='600' fill={INK}>{pct(p.q4)}</text>
                <text x='1212' y={cy + 5} fontSize={reg.delta} fontWeight='600' fill={deltaFill} textAnchor='end'>+{pts(p.q4 - p.q1)}</text>
              </g>
            )
          })}
        </g>
      ))}

      <g>
        <rect x='28' y={height - 48} width='760' height='34' rx='5' fill='rgba(255,255,255,0.9)' />
        <circle cx='42' cy={height - 31} r={reg.dotR} fill={Q1_FILL} stroke='#FFFFFF' strokeWidth='1.5' />
        <text x='58' y={height - 26} fontSize='13' fill={INK}>Lowest-income quartile (Q1, {kFmt(medianIncome[0])} median)</text>
        <circle cx='330' cy={height - 31} r={reg.dotR} fill={Q4_FILL} stroke='#FFFFFF' strokeWidth='1.5' />
        <text x='346' y={height - 26} fontSize='13' fill={INK}>Highest-income quartile (Q4, {kFmt(medianIncome[3])} median)</text>
        {hasClosed && (
          <g>
            <circle cx='620' cy={height - 31} r={reg.dotR} fill='#FFFFFF' stroke={MUTED_LINE} strokeWidth='1.6' />
            <text x='636' y={height - 26} fontSize='13' fill={INK}>No path from any district</text>
          </g>
        )}
      </g>
    </svg>
  )
}

// Spearman rank correlation with average ranks for ties — the twin maps'
// visual claim, stated as a number.
const rankOf = (values) => {
  const sorted = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0])
  const ranks = new Array(values.length)
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j += 1
    const mean = (i + j) / 2 + 1
    for (let k = i; k <= j; k += 1) ranks[sorted[k][1]] = mean
    i = j + 1
  }
  return ranks
}
export function spearman(xs, ys) {
  const rx = rankOf(xs)
  const ry = rankOf(ys)
  const mx = rx.reduce((sum, v) => sum + v, 0) / rx.length
  const my = ry.reduce((sum, v) => sum + v, 0) / ry.length
  let num = 0; let dx = 0; let dy = 0
  rx.forEach((v, i) => {
    num += (v - mx) * (ry[i] - my)
    dx += (v - mx) ** 2
    dy += (ry[i] - my) ** 2
  })
  return num / Math.sqrt(dx * dy)
}

// ───────── Figure 2 — twin point maps ─────────

export function projectCA(lon, lat) {
  return { px: (lon + 130) * Math.cos((37 * Math.PI) / 180), py: 44 - lat }
}

function useMapLayout() {
  const { districts, outline } = snapshot.fig2
  const pts = outline.map(([lon, lat]) => projectCA(lon, lat))
  const dpts = districts.map((d) => projectCA(d.lon, d.lat))
  const xs = [...pts, ...dpts].map((p) => p.px)
  const ys = [...pts, ...dpts].map((p) => p.py)
  const x0 = Math.min(...xs); const x1 = Math.max(...xs)
  const y0 = Math.min(...ys); const y1 = Math.max(...ys)
  const W = 420; const H = 424
  const scale = Math.min(W / (x1 - x0), H / (y1 - y0))
  return {
    outlinePath: pts.map((p, i) => `${i ? 'L' : 'M'}${((p.px - x0) * scale).toFixed(1)},${((p.py - y0) * scale).toFixed(1)}`).join(' '),
    place: (d) => {
      const p = projectCA(d.lon, d.lat)
      return { cx: (p.px - x0) * scale, cy: (p.py - y0) * scale }
    },
  }
}

const QUARTILE_NAME = ['lowest-income', 'second', 'third', 'highest-income']

function Fig2({ reg, basis }) {
  const { districts } = snapshot.fig2
  const { outlinePath, place } = useMapLayout()
  const dotR = 6.6
  const reachOf = (d) => (basis === 'minimums' ? d.reachMin : d.reach)
  const bandOf = (d) => (basis === 'minimums' ? d.reachMinBand : d.reachBand)
  const rho = spearman(districts.map((d) => d.income), districts.map(reachOf))
  const mapGroup = (tx, colorOf, describe) => (
    <g transform={`translate(${tx}, 76)`}>
      <path d={outlinePath} fill='#FBFCFA' stroke={MUTED_LINE} strokeWidth='1.1' strokeLinejoin='round' />
      {districts.map((d) => {
        const { cx, cy } = place(d)
        return (
          <circle key={d.district} cx={cx} cy={cy} r={dotR} fill={colorOf(d)} stroke='#FFFFFF' strokeWidth='1'
            role='img' aria-label={describe(d)}>
            <title>{describe(d)}</title>
          </circle>
        )
      })}
    </g>
  )
  return (
    <>
      <svg {...svgProps(624, "Two maps of California's community college districts, one shaded by district income quartile and one by number of programs reachable. The patterns are close to identical.")}>
        <text x='200' y='30' fontSize='17' fontWeight='500' fill={INK}>A · District income</text>
        <text x='200' y='52' fontSize={reg.tick} fill={MUTED_TEXT}>Mean income per return across the service area</text>
        <text x='660' y='30' fontSize='17' fontWeight='500' fill={CS_BLUE}>B · Computer Science transfer access</text>
        <text x='660' y='52' fontSize={reg.tick} fill={MUTED_TEXT}>Complete transfer paths, of the nine programs</text>

        {mapGroup(208,
          (d) => RAMP[d.incomeQuartile],
          (d) => `${d.district}: mean income $${moneyFmt.format(d.income)} per return (${QUARTILE_NAME[d.incomeQuartile]} quartile)`)}
        {mapGroup(668,
          (d) => RAMP[bandOf(d)],
          (d) => `${d.district}: a complete transfer path formally exists to ${reachOf(d)} of the nine programs`)}

        <g>
          <text x='200' y='528' fontSize='12.5' fontWeight='500' fill={INK}>Income quartile</text>
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
            <g key={q}>
              <rect x={200 + i * 50} y='540' width='16' height='16' rx='2' fill={RAMP[i]} />
              <text x={222 + i * 50} y='553' fontSize='12.5' fill={SOFT}>{q}</text>
            </g>
          ))}
          <text x='200' y='578' fontSize='11.5' fill={MUTED_TEXT}>$50k ————————————→ $434k</text>
        </g>
        <g>
          <text x='660' y='528' fontSize='12.5' fontWeight='500' fill={INK}>Programs reachable, of nine</text>
          {['0–2', '3–4', '5–6', '7–9'].map((q, i) => (
            <g key={q}>
              <rect x={660 + i * 62} y='540' width='16' height='16' rx='2' fill={RAMP[i]} />
              <text x={682 + i * 62} y='553' fontSize='12.5' fill={SOFT}>{q}</text>
            </g>
          ))}
          <text x='660' y='578' fontSize='11.5' fill={MUTED_TEXT}>Shut out ————————→ Nearly open</text>
        </g>

        <text x='200' y='606' fontSize='12.5' fill={MUTED_TEXT}>
          Spearman rank correlation between district income and programs reachable: ρ = {rho.toFixed(2)} across the {districts.length} districts
        </text>
      </svg>

    </>
  )
}

// ───────── Figure 3 — two quartile paths, divergence shaded ─────────

function Fig3({ reg, basis }) {
  const cs = basis === 'minimums' ? snapshot.minimums.fig3cs : snapshot.fig3.cs
  const { field, medianIncome } = snapshot.fig3
  const x = (q) => 220 + q * 240
  const y = (v) => 452 - v * 400 // 100% → y=52: the floor endpoint stays inside the chart
  const csPts = cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const fieldPts = field.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const wedge = `${cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')} ${[3, 2, 1, 0].map((q) => `${x(q)},${y(field[q])}`).join(' ')}`
  const n = snapshot.counts.fieldPrograms
  return (
    <svg {...svgProps(572, `Share of districts with a complete transfer path rises from ${pct(field[0])} to ${pct(field[3])} for ${n} non-computing majors, and from ${pct(cs[0])} to ${pct(cs[3])} for the nine Computer Science programs.`)}>

      {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v, i) => (
        <g key={v}>
          <line x1='220' y1={y(v)} x2='940' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='204' y={y(v) + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      <polygon points={wedge} fill='rgba(0,114,178,0.09)' />
      <polyline points={fieldPts} fill='none' stroke={FIELD} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
      {field.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='6' fill={FIELD}>
          <title>{`${n} other UC programs, Q${q + 1}: ${pct(v)}`}</title>
        </circle>
      ))}
      <polyline points={csPts} fill='none' stroke={CS_BLUE} strokeWidth='3.4' strokeLinecap='round' strokeLinejoin='round' />
      {cs.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='7' fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5'>
          <title>{`Nine UC Computer Science programs, Q${q + 1}: ${pct(v)}`}</title>
        </circle>
      ))}

      <text x='962' y='136' fontSize='14' fontWeight='600' fill={CS_BLUE}>Computer Science</text>
      <text x='962' y='166' fontSize={reg.big} fontWeight='700' fill={CS_BLUE}>{pct(cs[3])}</text>
      <text x='962' y='252' fontSize='14' fontWeight='600' fill={SOFT}>{n} other programs</text>
      <text x='962' y='282' fontSize={reg.big} fontWeight='700' fill={SOFT}>{pct(field[3])}</text>
      <text x='206' y={y(cs[0]) + 5} fontSize='13' fontWeight='600' fill={CS_BLUE} textAnchor='end'>{pct(cs[0])}</text>
      <text x='206' y={y(field[0]) + 5} fontSize='13' fontWeight='600' fill={SOFT} textAnchor='end'>{pct(field[0])}</text>
      <text x='770' y={y(cs[2]) - 35} fontSize='13' fontWeight='700' fill={CS_BLUE}>+{pts(cs[3] - cs[0])} points</text>
      <text x='770' y={y(field[2]) + 28} fontSize='13' fontWeight='700' fill={SOFT}>+{pts(field[3] - field[0])} points</text>

      {['Q1 · lowest income', 'Q2', 'Q3', 'Q4 · highest income'].map((labelText, q) => (
        <g key={labelText} textAnchor='middle'>
          <text x={x(q)} y='484' fontSize='14' fontWeight='500' fill={INK}>{labelText}</text>
          <text x={x(q)} y='504' fontSize='12' fill={MUTED_TEXT}>${moneyFmt.format(medianIncome[q])} median</text>
        </g>
      ))}
      <text x='580' y='536' fontSize='15' fontWeight='500' fill={INK} textAnchor='middle'>District income quartile</text>
    </svg>
  )
}

// ───────── Figure 4 — the market: demand against income swing ─────────
// Every demand-matched program on the stated basis, nothing hidden: transfer
// applicants against the poorest-to-wealthiest access swing. Broadens figure 3:
// not just against the field aggregate — against every program, weighted by
// what students actually want. Data from the course-repair simulation
// artifact; programs closed everywhere on stated preparation are excluded as
// unmeasurable (their floors are uncurated), never drawn as flat.

function Fig4Market({ reg, basis }) {
  const { programs, excludedCount } = repairs.market
  const field = programs.filter((r) => !r.cs)
  const csRows = basis === 'minimums' ? floorCsRows : programs.filter((r) => r.cs)
  const meanSwing = field.reduce((sum, r) => sum + r.swing, 0) / field.length
  const x = (v) => 220 + (Math.min(v, 3500) / 3500) * 880
  const y = (v) => 400 - ((v + 0.1) / 0.9) * 360
  const companion = [...field].sort((a, b) => (b.swing * 2 + b.applicants / 3500) - (a.swing * 2 + a.applicants / 3500))
    .find((r) => r.applicants > 900 && r.swing > 0.6)
  return (
    <svg {...svgProps(500, `Every measurable program: transfer applicants against the access swing between the lowest- and highest-income quartiles. The field, measured on stated preparation, averages a ${Math.round(meanSwing * 100)}-point swing; the Computer Science programs${basis === 'minimums' ? ', measured on the eligibility floor,' : ''} average ${marketMeanSwing(csRows)} points and occupy the high-demand, high-swing corner.`)}>

      {[0, 0.2, 0.4, 0.6, 0.8].map((v, i) => (
        <g key={v}>
          <line x1='220' y1={y(v)} x2='1100' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='204' y={y(v) + 4} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>+{Math.round(v * 100)}</text>
        </g>
      ))}
      {[0, 1000, 2000, 3000].map((v) => (
        <text key={v} x={x(v)} y='430' fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='middle'>{v.toLocaleString()}</text>
      ))}
      <text x='660' y='456' fontSize='14' fontWeight='500' fill={INK} textAnchor='middle'>Transfer applicants, 2025</text>
      <text transform={`rotate(-90 168 ${y(0.4)})`} x='168' y={y(0.4)} fontSize='13.5' fontWeight='500' fill={INK} textAnchor='middle'>Income swing, points</text>

      <line x1='220' y1={y(meanSwing)} x2='1100' y2={y(meanSwing)} stroke={MUTED_LINE} strokeWidth='1.4' strokeDasharray='6 5' />
      <text x='1108' y={y(meanSwing) + 4} fontSize='12' fill={MUTED_TEXT}>field mean +{Math.round(meanSwing * 100)}</text>

      {field.map((r, i) => (
        <circle key={`${r.campus}|${r.major}|${i}`} cx={x(r.applicants)} cy={y(r.swing)} r='4.5'
          fill={FIELD} fillOpacity='0.5'>
          <title>{`${r.major} (${r.campus}): ${r.applicants.toLocaleString()} applicants · access ${pct(r.q1)} in the lowest-income quartile, ${pct(r.q4)} in the highest — a ${Math.round(r.swing * 100)}-point swing`}</title>
        </circle>
      ))}
      {companion && (
        <text x={x(companion.applicants) + 12} y={y(companion.swing) + 4} fontSize='11.5' fill={SOFT}>{companion.major.replace(/,?\s*B\.?[AS]\.?.*$/i, '')} ({companion.campus})</text>
      )}
      {csRows.map((r, i) => (
        <g key={`cs|${r.campus}|${i}`}>
          <circle cx={x(r.applicants)} cy={y(r.swing)} r={9} fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5'>
            <title>{`${r.major} (${r.campus}): ${r.applicants.toLocaleString()} applicants · access ${pct(r.q1)} → ${pct(r.q4)} across income quartiles — a ${Math.round(r.swing * 100)}-point swing${basis === 'minimums' ? ' on the eligibility floor' : ''}`}</title>
          </circle>
          <text x={x(r.applicants) + 12} y={y(r.swing) - 6} fontSize='11.5' fontWeight='600' fill={CS_BLUE}>{r.campus}</text>
        </g>
      ))}

      <text x='1096' y={y(0.76)} fontSize='12.5' fontWeight='600' fill={INK} textAnchor='end'>high demand, large income swing</text>

      {basis !== 'minimums' && (
        <text x='28' y='488' fontSize={reg.note} fill={MUTED_TEXT}>
          {excludedCount} programs closed from every district on stated preparation are not drawn — a closed program has no measurable swing.
        </text>
      )}
    </svg>
  )
}


// ───────── Figure 5 — the tether map: distance, by district income ─────────

function useTetherLayout() {
  const { outline } = snapshot.fig2
  const { tethers, campuses } = snapshot.distance
  const pts = outline.map(([lon, lat]) => projectCA(lon, lat))
  const others = [...tethers, ...campuses].map((o) => projectCA(o.lon, o.lat))
  const xs = [...pts, ...others].map((p) => p.px)
  const ys = [...pts, ...others].map((p) => p.py)
  const x0 = Math.min(...xs); const x1 = Math.max(...xs)
  const y0 = Math.min(...ys); const y1 = Math.max(...ys)
  const W = 560; const H = 540
  const scale = Math.min(W / (x1 - x0), H / (y1 - y0))
  return {
    outlinePath: pts.map((p, i) => `${i ? 'L' : 'M'}${((p.px - x0) * scale).toFixed(1)},${((p.py - y0) * scale).toFixed(1)}`).join(' '),
    place: (o) => {
      const p = projectCA(o.lon, o.lat)
      return { cx: (p.px - x0) * scale, cy: (p.py - y0) * scale }
    },
  }
}

// Label offsets so the metro-cluster campuses don't overprint each other.
const CAMPUS_LABEL = {
  Berkeley: [10, -3, 'start'],
  Davis: [10, -6, 'start'],
  'Los Angeles': [-10, 0, 'end'],
  Irvine: [11, 13, 'start'],
  'San Diego': [10, 6, 'start'],
  'Santa Barbara': [-10, -7, 'end'],
  'Santa Cruz': [-10, 10, 'end'],
  Riverside: [11, -7, 'start'],
  Merced: [10, -6, 'start'],
}

function Fig4Tethers({ reg }) {
  const { tethers, campuses, medianKmByQuartile } = snapshot.distance
  const { outlinePath, place } = useTetherLayout()
  const campusByName = new Map(campuses.map((c) => [c.name, c]))
  const maxKm = Math.max(...medianKmByQuartile)
  const barX = 806
  const barMax = 300
  const barY = (i) => 148 + i * 54
  const quartileLabel = ['Q1 · lowest income', 'Q2', 'Q3', 'Q4 · highest income']
  return (
    <svg {...svgProps(668, `Every district drawn with a straight line to its nearest UC campus. Median tether length falls from ${kmToMi(medianKmByQuartile[0])} miles in the lowest-income quartile to ${kmToMi(medianKmByQuartile[3])} in the highest.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Every district, tethered to its nearest campus</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Straight line from each district centroid to the nearest of the nine campuses, coloured by income quartile</text>

      <g transform='translate(48, 76)'>
        <path d={outlinePath} fill='#FBFCFA' stroke={MUTED_LINE} strokeWidth='1.1' strokeLinejoin='round' />
        {tethers.map((t) => {
          const from = place(t)
          const campus = campusByName.get(t.campus)
          const to = campus ? place(campus) : from
          const describe = `${t.district}: ${kmToMi(t.km)} miles to the ${t.campus} campus (${QUARTILE_NAME[t.quartile]} quartile)`
          return (
            <g key={t.district} role='img' aria-label={describe}>
              <title>{describe}</title>
              <line x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                stroke={RAMP[t.quartile]} strokeWidth={2} opacity='0.6' />
              <circle cx={from.cx} cy={from.cy} r={5.4}
                fill={RAMP[t.quartile]} stroke='#FFFFFF' strokeWidth='1' />
            </g>
          )
        })}
        {campuses.map((c) => {
          const { cx, cy } = place(c)
          const [dx, dy, anchor] = CAMPUS_LABEL[c.name] || [10, 0, 'start']
          return (
            <g key={c.name}>
              <rect x={cx - 5} y={cy - 5} width='10' height='10' fill={INK} stroke='#FFFFFF' strokeWidth='1.4'
                transform={`rotate(45 ${cx} ${cy})`}>
                <title>{`UC ${c.name} campus`}</title>
              </rect>
              <text x={cx + dx} y={cy + dy + 4} fontSize='11.5' fontWeight='600' fill={INK} textAnchor={anchor}>{c.name}</text>
            </g>
          )
        })}
      </g>

      <text x='700' y='118' fontSize='15' fontWeight='500' fill={INK}>Median tether, by income quartile</text>
      {medianKmByQuartile.map((km, i) => (
        <g key={quartileLabel[i]} role='img'
          aria-label={`${quartileLabel[i]} quartile: median ${kmToMi(km)} miles to the nearest campus`}>
          <title>{`${quartileLabel[i]}: median ${kmToMi(km)} miles to the nearest campus`}</title>
          <text x='792' y={barY(i) + 5} fontSize={reg.tick} fontWeight='500' fill={INK} textAnchor='end'>{quartileLabel[i]}</text>
          <rect x={barX} y={barY(i) - 14} width={(km / maxKm) * barMax} height='28' rx='3' fill={RAMP[i]} />
          <text x={barX + (km / maxKm) * barMax + 10} y={barY(i) + 5} fontSize={reg.tick} fontWeight='600' fill={SOFT}>{kmToMi(km)} mi</text>
        </g>
      ))}

      <text x='700' y='412' fontSize='42' fontWeight='700' fill={INK}>{tetherRatio}×</text>
      <text x='700' y='438' fontSize={reg.note} fill={SOFT}>as far from the nearest campus —</text>
      <text x='700' y='456' fontSize={reg.note} fill={SOFT}>the lowest-income quartile against the highest</text>

      <g>
        <rect x='700' y='492' width='10' height='10' fill={INK} transform='rotate(45 705 497)' />
        <text x='716' y='501' fontSize='12.5' fill={INK}>UC campus</text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={810 + i * 48} y='492' width='14' height='14' rx='2' fill={RAMP[i]} />
            <text x={830 + i * 48} y='503' fontSize='12.5' fill={SOFT}>Q{i + 1}</text>
          </g>
        ))}
      </g>

    </svg>
  )
}

// ───────── Figure 6 — the gate grid: each factor with the other held ─────────

function Fig5Gates({ reg, basis }) {
  const { cells: strictCells, responses: strictResponses, medianKm } = snapshot.distance
  const minimums = snapshot.minimums
  const cells = Object.fromEntries(Object.entries(strictCells).map(([key, cell]) => [key, {
    ...cell,
    cs: basis === 'minimums' ? minimums.cells[key] : cell.cs,
  }]))
  const responses = {
    income: {
      near: { cs: basis === 'minimums' ? minimums.responses.income.near : strictResponses.income.near.cs, field: strictResponses.income.near.field },
      far: { cs: basis === 'minimums' ? minimums.responses.income.far : strictResponses.income.far.cs, field: strictResponses.income.far.field },
    },
    proximity: {
      poor: { cs: basis === 'minimums' ? minimums.responses.proximity.poor : strictResponses.proximity.poor.cs, field: strictResponses.proximity.poor.field },
      rich: { cs: basis === 'minimums' ? minimums.responses.proximity.rich : strictResponses.proximity.rich.cs, field: strictResponses.proximity.rich.field },
    },
  }
  const splitMi = kmToMi(medianKm)
  const poorN = cells.nearPoor.n + cells.farPoor.n
  const richN = cells.nearRich.n + cells.farRich.n
  // Card-grid anatomy from the docs/stratified-check-1a.html design, skinned
  // in this page's tokens: cells as cards with in-cell bars on one shared
  // 0-100% track (tick at 50%), and the four held-fixed comparisons as chips
  // riding their connector lines between the cards.
  const colX = [206, 780]
  const colW = 380
  const rowY = [78, 366]
  const rowH = 176
  const midX = (colX[0] + colW + colX[1]) / 2
  const betweenY = (rowY[0] + rowH + rowY[1]) / 2
  const barW = colW - 40
  const TRACK = 'rgba(25,48,24,0.08)'
  const TICK = 'rgba(25,48,24,0.16)'
  const cellCard = (data, cx, cy, describe) => (
    <g role='img' aria-label={describe}>
      <title>{describe}</title>
      <rect x={cx} y={cy} width={colW} height={rowH} rx='11' fill='#FDFDFC' stroke={GRID_STRONG} />
      <text x={cx + colW - 104} y={cy + 27} fontSize='11' fontWeight='700' letterSpacing='0.07em' fill={MUTED_TEXT} textAnchor='end'>{data.n} OF 36 DISTRICTS</text>
      <rect x={cx + colW - 94} y={cy + 19} width='76' height='5' rx='2.5' fill='rgba(25,48,24,0.10)' />
      <rect x={cx + colW - 94} y={cy + 19} width={(data.n / 36) * 76} height='5' rx='2.5' fill={MUTED_LINE} />
      <text x={cx + 20} y={cy + 62} fontSize='13.5' fontWeight='700' fill={CS_BLUE}>Computer Science</text>
      <text x={cx + colW - 20} y={cy + 64} fontSize='25' fontWeight='700' fill={CS_BLUE} textAnchor='end'>{pct(data.cs)}</text>
      <rect x={cx + 20} y={cy + 74} width={barW} height='20' rx='5' fill={TRACK} />
      <line x1={cx + 20 + barW / 2} y1={cy + 74} x2={cx + 20 + barW / 2} y2={cy + 94} stroke={TICK} strokeWidth='1' />
      <rect x={cx + 20} y={cy + 74} width={Math.max(4, data.cs * barW)} height='20' rx='5' fill={CS_BLUE} />
      <text x={cx + 20} y={cy + 124} fontSize='13.5' fontWeight='600' fill={SOFT}>Other majors</text>
      <text x={cx + colW - 20} y={cy + 126} fontSize='19' fontWeight='700' fill={SOFT} textAnchor='end'>{pct(data.field)}</text>
      <rect x={cx + 20} y={cy + 134} width={barW} height='13' rx='4' fill={TRACK} />
      <line x1={cx + 20 + barW / 2} y1={cy + 134} x2={cx + 20 + barW / 2} y2={cy + 147} stroke={TICK} strokeWidth='1' />
      <rect x={cx + 20} y={cy + 134} width={Math.max(3, data.field * barW)} height='13' rx='4' fill={FIELD} />
    </g>
  )
  const chip = (x, y, resp, describe) => (
    <g role='img' aria-label={describe}>
      <title>{describe}</title>
      <rect x={x - 47} y={y - 25} width='94' height='50' rx='10' fill='#FFFFFF' stroke={GRID_STRONG} />
      <text x={x} y={y - 3} fontSize='21' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>+{pts(resp.cs)}<tspan fontSize='12' fontWeight='700'> pts</tspan></text>
      <text x={x} y={y + 16} fontSize='12' fontWeight='600' fill={SOFT} textAnchor='middle'>field +{pts(resp.field)}</text>
    </g>
  )
  return (
    <svg {...svgProps(566, `Districts split at the median distance to a campus (${splitMi} miles) and the median income. The income gradient is present within both distance strata, the distance gradient within both income strata, and the Computer Science difference exceeds the field's in every comparison.`)}>
      <defs>
        <marker id='gateArrow' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='7' markerHeight='7' orient='auto'>
          <path d='M0,0 L10,5 L0,10 z' fill={MUTED_LINE} />
        </marker>
      </defs>

      <text x={colX[0] + colW / 2} y='30' fontSize='17' fontWeight='600' fill={INK} textAnchor='middle'>Lower-income half</text>
      <text x={colX[0] + colW / 2} y='50' fontSize='12.5' fill={MUTED_TEXT} textAnchor='middle'>{poorN} districts · below the median income</text>
      <text x={midX} y='38' fontSize='10' fontWeight='700' letterSpacing='0.14em' fill={MUTED_LINE} textAnchor='middle'>INCOME →</text>
      <text x={colX[1] + colW / 2} y='30' fontSize='17' fontWeight='600' fill={INK} textAnchor='middle'>Higher-income half</text>
      <text x={colX[1] + colW / 2} y='50' fontSize='12.5' fill={MUTED_TEXT} textAnchor='middle'>{richN} districts · above the median income</text>

      <text x='190' y={rowY[0] + rowH / 2 - 4} fontSize='13' fontWeight='700' letterSpacing='0.1em' fill={SOFT} textAnchor='end'>NEARER HALF</text>
      <text x='190' y={rowY[0] + rowH / 2 + 16} fontSize='12.5' fill={MUTED_TEXT} textAnchor='end'>within {splitMi} miles of a campus</text>
      <text x='190' y={betweenY + 4} fontSize='10' fontWeight='700' letterSpacing='0.14em' fill={MUTED_LINE} textAnchor='end'>↑ DISTANCE</text>
      <text x='190' y={rowY[1] + rowH / 2 - 4} fontSize='13' fontWeight='700' letterSpacing='0.1em' fill={SOFT} textAnchor='end'>FARTHER HALF</text>
      <text x='190' y={rowY[1] + rowH / 2 + 16} fontSize='12.5' fill={MUTED_TEXT} textAnchor='end'>beyond {splitMi} miles</text>

      {cellCard(cells.nearPoor, colX[0], rowY[0],
        `${cells.nearPoor.n} nearer, lower-income districts: Computer Science access ${pct(cells.nearPoor.cs)}, other majors ${pct(cells.nearPoor.field)}`)}
      {cellCard(cells.nearRich, colX[1], rowY[0],
        `${cells.nearRich.n} nearer, higher-income districts: Computer Science access ${pct(cells.nearRich.cs)}, other majors ${pct(cells.nearRich.field)}`)}
      {cellCard(cells.farPoor, colX[0], rowY[1],
        `${cells.farPoor.n} farther, lower-income districts: Computer Science access ${pct(cells.farPoor.cs)}, other majors ${pct(cells.farPoor.field)}`)}
      {cellCard(cells.farRich, colX[1], rowY[1],
        `${cells.farRich.n} farther, higher-income districts: Computer Science access ${pct(cells.farRich.cs)}, other majors ${pct(cells.farRich.field)}`)}

      {/* income comparisons ride a rightward connector through each row */}
      <line x1={colX[0] + colW + 10} y1={rowY[0] + rowH / 2} x2={colX[1] - 12} y2={rowY[0] + rowH / 2} stroke={MUTED_LINE} strokeWidth='1.4' markerEnd='url(#gateArrow)' />
      {chip(midX, rowY[0] + rowH / 2, responses.income.near,
        `Income difference within the nearer stratum: Computer Science +${pts(responses.income.near.cs)} points, other majors +${pts(responses.income.near.field)}`)}
      <line x1={colX[0] + colW + 10} y1={rowY[1] + rowH / 2} x2={colX[1] - 12} y2={rowY[1] + rowH / 2} stroke={MUTED_LINE} strokeWidth='1.4' markerEnd='url(#gateArrow)' />
      {chip(midX, rowY[1] + rowH / 2, responses.income.far,
        `Income difference within the farther stratum: Computer Science +${pts(responses.income.far.cs)} points, other majors +${pts(responses.income.far.field)}`)}

      {/* distance comparisons ride an upward connector through each column */}
      <line x1={colX[0] + colW / 2} y1={rowY[1] - 8} x2={colX[0] + colW / 2} y2={rowY[0] + rowH + 10} stroke={MUTED_LINE} strokeWidth='1.4' markerEnd='url(#gateArrow)' />
      {chip(colX[0] + colW / 2, betweenY, responses.proximity.poor,
        `Distance difference within the lower-income stratum: Computer Science +${pts(responses.proximity.poor.cs)} points, other majors +${pts(responses.proximity.poor.field)}`)}
      <line x1={colX[1] + colW / 2} y1={rowY[1] - 8} x2={colX[1] + colW / 2} y2={rowY[0] + rowH + 10} stroke={MUTED_LINE} strokeWidth='1.4' markerEnd='url(#gateArrow)' />
      {chip(colX[1] + colW / 2, betweenY, responses.proximity.rich,
        `Distance difference within the higher-income stratum: Computer Science +${pts(responses.proximity.rich.cs)} points, other majors +${pts(responses.proximity.rich.field)}`)}

    </svg>
  )
}

// ───────── the sequence ─────────

/** Figure-only gallery thumbnail: the tether map, the sequence's showpiece. */
export function PriceOfPlacePreview() {
  return <Fig4Tethers reg={REG} />
}

const BEATS = {
  1: {
    role: 'The hook',
  },
  2: {
    role: 'The headliner',
  },
  3: {
    role: 'The evidence',
  },
  4: {
    role: 'The field test',
  },
  5: {
    role: 'The objection',
  },
  6: {
    role: 'The stratified check',
  },
}


const BASIS_OPTIONS = [
  { value: 'minimums', label: 'Eligibility floor' },
  { value: 'strict', label: 'Stated preparation' },
]


export default function PriceOfPlace() {
  const [basis, setBasis] = useState('minimums')
  const reg = REG
  const { counts } = snapshot
  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>Requirements</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {BASIS_OPTIONS.map((item) => (
              <button key={item.value} type='button' onClick={() => setBasis(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  basis === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div data-export-root className='flex flex-col gap-7'>
        <Beat no='1' title='Complete transfer paths by district income' basis={basis} {...BEATS[1]}>
          <Fig1 reg={reg} basis={basis} />
        </Beat>
        <Beat no='2' title='District income and transfer access, mapped' basis={basis} {...BEATS[2]}>
          <Fig2 reg={reg} basis={basis} />
        </Beat>
        <Beat no='3' title='Transfer-access gradients by district income: Computer Science and all other programs' basis={basis} {...BEATS[3]}>
          <Fig3 reg={reg} basis={basis} />
        </Beat>
        <Beat no='4' title='Transfer demand and income sensitivity across measurable programs' basis={basis} {...BEATS[4]}>
          <Fig4Market reg={reg} basis={basis} />
        </Beat>
        <Beat no='5' title='Distance to the nearest campus, by district income' basis={basis} {...BEATS[5]}>
          <Fig4Tethers reg={reg} />
        </Beat>
        <Beat no='6' title='Income and distance, compared within broad strata' basis={basis} {...BEATS[6]}>
          <Fig5Gates reg={reg} basis={basis} />
        </Beat>
        <div className='rounded-[10px] border px-5 py-4 flex flex-col gap-3' data-export-exclude
          style={{ borderColor: GRID, background: 'rgba(25,48,24,0.03)' }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: MUTED_TEXT }}>
            Notes
          </span>
          {NOTES.map((group) => (
            <div key={group.head} className='flex flex-col gap-1'>
              <span className='text-[12px] font-[650]' style={{ color: INK }}>{group.head}</span>
              <ul className='m-0 pl-5 flex flex-col gap-1'>
                {group.items.map((item) => (
                  <li key={item} className='text-[13px] leading-relaxed list-disc' style={{ color: SOFT }}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Stack>
  )
}
