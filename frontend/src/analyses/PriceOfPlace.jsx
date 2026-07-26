import React, { useState } from 'react'
import { Stack } from '../components/ui'
import snapshot from './priceOfPlaceSnapshot.json'
import repairs from '../../../analysis/data/course_repairs.v1.json'

/**
 * "Income, distance, and transfer access" — a figure sequence: Computer Science transfer
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
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif"

// Registers: detailed = the paper-facing file; glance = the v2 file (nothing
// under 15px, conclusions as headlines).
const REG = { tick: 15, row: 19, course: 17, note: 15, panel: 18, big: 34, delta: 16, dotR: 9, conn: 8 }

const tetherRatio = (
  snapshot.distance.medianKmByQuartile[0] / snapshot.distance.medianKmByQuartile[3]
).toFixed(1)

const marketMeanSwing = (list) => Math.round(
  (list.reduce((sum, r) => sum + r.swing, 0) / list.length) * 100)
const HEADLINES = {
  1: 'For each of the nine programs, the share of districts holding a complete transfer path, in the lowest- and highest-income quartiles.',
  2: 'The same districts drawn twice — shaded by the mean income of the area each serves, then by how many of the nine programs hold a complete path from it. The two shadings align.',
  4: `Across the ${repairs.market.programs.filter((r) => !r.cs).length} measurable majors, district income moves access by ${marketMeanSwing(repairs.market.programs.filter((r) => !r.cs))} points on average; the nine Computer Science programs average ${marketMeanSwing(repairs.market.programs.filter((r) => r.cs))}. Computer Science occupies a corner of the figure the rest of the field avoids — it is at once among the most applied-to majors and among the most income-sensitive.`,
  5: `Distance is a second variable that could produce the income gradient: lower-income districts sit farther from the campuses, the lowest-income quartile ${tetherRatio}× as far as the highest. Because distance and income travel together, the next figure measures each with the other held fixed.`,
  6: `Districts split at the median distance to a campus (${Math.round(snapshot.distance.medianKm * 0.621371)} miles) and the median income: each variable raises access with the other held fixed, and the Computer Science response exceeds the field's in all four comparisons.`,
}
const fieldN = snapshot.counts.fieldPrograms
const stairLine = (cs) => `Access rises from ${Math.round(cs[0] * 100)} to ${Math.round(cs[3] * 100)} percent for Computer Science between the lowest- and highest-income quartiles, against ${Math.round(snapshot.fig3.field[0] * 100)} to ${Math.round(snapshot.fig3.field[3] * 100)} for the ${fieldN} other majors — a disproportionate response to district income.`
const HEADLINES_BY_BASIS = {
  strict: {
    3: stairLine(snapshot.fig3.cs),
  },
  minimums: {
    3: stairLine(snapshot.minimums.fig3cs),
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
    head: 'Explanations ruled out',
    items: [
      'Program size — Computer Science requires about 11 courses against a typical 8, ordinary for the corpus.',
      'Multi-college districts — scoring every college on its own leaves the income gap essentially unchanged.',
      'Distance alone — stratifying at the median tether and median income shows each variable acting with the other held fixed (figure 6).',
      'Demographics — person-weighted reach differs too little across groups to report (5.3 of nine for the typical Hispanic resident against 6.0 for the typical Asian resident).',
    ],
  },
  {
    head: 'Robustness checks',
    items: [
      'Requirement basis — recomputed on the hand-verified eligibility floor; the staircase steepens (a 49-point gap against 37), so the strict basis diluted the pattern rather than inflating it.',
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
      'Earlier years of the agreement database; the city–suburb–rural classification. (Untaught versus unarticulated is covered by The Paper Gate.)',
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
    contested: ['DECIDED BY DISTRICT INCOME', CS_BLUE],
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
      ? 'Nine UC Computer Science programs measured on the hand-verified eligibility floor: one open nearly everywhere, eight decided by district income, none closed.'
      : 'Nine UC Computer Science programs grouped into three regimes: two closed in every district, one open nearly everywhere, six decided by district income.')}>
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

const RAMP = [Q1_FILL, CONN, '#38618C', Q4_FILL]
const QUARTILE_NAME = ['lowest-income', 'second', 'third', 'highest-income']

function Fig2({ reg, basis }) {
  const { districts } = snapshot.fig2
  const { outlinePath, place } = useMapLayout()
  const dotR = 6.6
  const reachOf = (d) => (basis === 'minimums' ? d.reachMin : d.reach)
  const bandOf = (d) => (basis === 'minimums' ? d.reachMinBand : d.reachBand)
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
      </svg>

    </>
  )
}

// ───────── Figure 3 — two quartile paths, divergence shaded ─────────

function Fig3({ reg, basis }) {
  const cs = basis === 'minimums' ? snapshot.minimums.fig3cs : snapshot.fig3.cs
  const { field, medianIncome } = snapshot.fig3
  const x = (q) => 220 + q * 240
  const y = (v) => 452 - v * 450 // 80% → y=92, per the design's scale
  const csPts = cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const fieldPts = field.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const wedge = `${cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')} ${[3, 2, 1, 0].map((q) => `${x(q)},${y(field[q])}`).join(' ')}`
  const n = snapshot.counts.fieldPrograms
  return (
    <svg {...svgProps(572, `Share of districts with a complete transfer path rises from ${pct(field[0])} to ${pct(field[3])} for ${n} non-computing majors, and from ${pct(cs[0])} to ${pct(cs[3])} for the nine Computer Science programs.`)}>

      {[0, 0.2, 0.4, 0.6, 0.8].map((v, i) => (
        <g key={v}>
          <line x1='220' y1={y(v)} x2='940' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='204' y={y(v) + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      <polygon points={wedge} fill='rgba(0,114,178,0.09)' />
      <polyline points={fieldPts} fill='none' stroke={FIELD} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
      {field.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='6' fill={FIELD}>
          <title>{`${n} other UC majors, Q${q + 1}: ${pct(v)}`}</title>
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
      <text x='962' y='252' fontSize='14' fontWeight='600' fill={SOFT}>{n} other majors</text>
      <text x='962' y='282' fontSize={reg.big} fontWeight='700' fill={SOFT}>{pct(field[3])}</text>
      <text x='236' y={y(cs[0]) - 8} fontSize='13' fontWeight='600' fill={CS_BLUE}>{pct(cs[0])}</text>
      <text x='236' y={y(field[0]) + 22} fontSize='13' fontWeight='600' fill={SOFT}>{pct(field[0])}</text>
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

function Fig4Market({ reg }) {
  const { programs, excludedCount, excludedTop } = repairs.market
  const field = programs.filter((r) => !r.cs)
  const csRows = programs.filter((r) => r.cs)
  const meanSwing = field.reduce((sum, r) => sum + r.swing, 0) / field.length
  const x = (v) => 220 + (Math.min(v, 3500) / 3500) * 880
  const y = (v) => 400 - ((v + 0.1) / 0.9) * 360
  const companion = [...field].sort((a, b) => (b.swing * 2 + b.applicants / 3500) - (a.swing * 2 + a.applicants / 3500))
    .find((r) => r.applicants > 900 && r.swing > 0.6)
  return (
    <svg {...svgProps(500, `Every measurable major: transfer applicants against the access swing between the lowest- and highest-income quartiles, on stated preparation. The field averages a ${Math.round(meanSwing * 100)}-point swing; the Computer Science programs average ${marketMeanSwing(csRows)} points and occupy the high-demand, high-swing corner. ${excludedCount} majors closed everywhere on stated preparation are not drawn.`)}>

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
            <title>{`${r.major} (${r.campus}): ${r.applicants.toLocaleString()} applicants · access ${pct(r.q1)} → ${pct(r.q4)} across income quartiles — a ${Math.round(r.swing * 100)}-point swing`}</title>
          </circle>
          <text x={x(r.applicants) + 12} y={y(r.swing) - 6} fontSize='11.5' fontWeight='600' fill={CS_BLUE}>{r.campus}</text>
        </g>
      ))}

      <text x='1096' y={y(0.76)} fontSize='12.5' fontWeight='600' fill={INK} textAnchor='end'>high demand, large income swing</text>

      <text x='28' y='488' fontSize={reg.note} fill={MUTED_TEXT}>
        {excludedCount} majors closed from every district on stated preparation are not drawn — a closed program has no measurable swing.
      </text>
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
  const colL = [240, 706]
  const colW = 330
  const rowT = [96, 330]
  const rowH = 168
  const barMax = colW - 116
  const splitMi = kmToMi(medianKm)
  const poorN = cells.nearPoor.n + cells.farPoor.n
  const richN = cells.nearRich.n + cells.farRich.n
  const gapX = (colL[0] + colW + colL[1]) / 2
  const gapY = (rowT[0] + rowH + rowT[1]) / 2
  const cell = (data, cx, cy, describe) => (
    <g role='img' aria-label={describe}>
      <title>{describe}</title>
      <rect x={cx} y={cy} width={colW} height={rowH} rx='8' fill='#FDFDFC' stroke={GRID_STRONG} />
      <text x={cx + colW - 14} y={cy + 24} fontSize='11.5' fill={MUTED_TEXT} textAnchor='end'>{data.n} districts</text>
      <text x={cx + 16} y={cy + 46} fontSize='12' fontWeight='600' fill={CS_BLUE}>Computer Science</text>
      <rect x={cx + 16} y={cy + 54} width={data.cs * barMax} height='24' rx='2' fill={CS_BLUE} />
      <text x={cx + 16 + data.cs * barMax + 10} y={cy + 71} fontSize={reg.panel} fontWeight='700' fill={CS_BLUE}>{pct(data.cs)}</text>
      <text x={cx + 16} y={cy + 104} fontSize='12' fontWeight='600' fill={SOFT}>Other majors</text>
      <rect x={cx + 16} y={cy + 112} width={data.field * barMax} height='18' rx='2' fill={FIELD} />
      <text x={cx + 16 + data.field * barMax + 10} y={cy + 126} fontSize={reg.tick} fontWeight='600' fill={SOFT}>{pct(data.field)}</text>
    </g>
  )
  // The held-fixed comparisons drawn in place of side tables: a rightward
  // arrow in each row (income varies, distance held) and an upward arrow in
  // each column (distance varies, income held), each carrying its gain.
  const incomeArrow = (row, resp) => {
    const yMid = rowT[row] + rowH / 2
    const describe = `Income with distance held (${row === 0 ? 'nearer' : 'farther'} half): Computer Science +${pts(resp.cs)} points, other majors +${pts(resp.field)}`
    return (
      <g role='img' aria-label={describe}>
        <title>{describe}</title>
        <text x={gapX} y={yMid - 14} fontSize='14' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>+{pts(resp.cs)} pts</text>
        <text x={gapX} y={yMid + 6} fontSize='12' fill={SOFT} textAnchor='middle'>field +{pts(resp.field)}</text>
        <line x1={colL[0] + colW + 14} y1={yMid + 24} x2={colL[1] - 14} y2={yMid + 24} stroke={MUTED_LINE} strokeWidth='1.8' markerEnd='url(#gateArrow)' />
      </g>
    )
  }
  const distanceArrow = (col, resp) => {
    const xArrow = colL[col] + colW / 2 - 96
    const describe = `Distance with income held (${col === 0 ? 'lower' : 'higher'}-income half): Computer Science +${pts(resp.cs)} points, other majors +${pts(resp.field)}`
    return (
      <g role='img' aria-label={describe}>
        <title>{describe}</title>
        <line x1={xArrow} y1={rowT[1] - 12} x2={xArrow} y2={rowT[0] + rowH + 12} stroke={MUTED_LINE} strokeWidth='1.8' markerEnd='url(#gateArrow)' />
        <text x={xArrow + 16} y={gapY - 2} fontSize='14' fontWeight='700' fill={CS_BLUE}>+{pts(resp.cs)} pts</text>
        <text x={xArrow + 110} y={gapY - 2} fontSize='12' fill={SOFT}>field +{pts(resp.field)}</text>
      </g>
    )
  }
  return (
    <svg {...svgProps(568, `Districts split at the median distance to a campus (${splitMi} miles) and the median income. Income still raises Computer Science access with distance held fixed, distance still raises it with income held fixed, and both responses are a multiple of the field's.`)}>
      <defs>
        <marker id='gateArrow' viewBox='0 0 10 10' refX='8' refY='5' markerWidth='7' markerHeight='7' orient='auto'>
          <path d='M0,0 L10,5 L0,10 z' fill={MUTED_LINE} />
        </marker>
      </defs>

      <text x={colL[0] + colW / 2} y='48' fontSize='14.5' fontWeight='600' fill={INK} textAnchor='middle'>Lower-income half · {poorN} districts</text>
      <text x={colL[0] + colW / 2} y='68' fontSize='11.5' fill={MUTED_TEXT} textAnchor='middle'>below the median district income</text>
      <text x={colL[1] + colW / 2} y='48' fontSize='14.5' fontWeight='600' fill={INK} textAnchor='middle'>Higher-income half · {richN} districts</text>
      <text x={colL[1] + colW / 2} y='68' fontSize='11.5' fill={MUTED_TEXT} textAnchor='middle'>above the median district income</text>

      <text x='28' y={rowT[0] + 78} fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>NEARER HALF</text>
      <text x='28' y={rowT[0] + 98} fontSize='11.5' fill={MUTED_TEXT}>within {splitMi} miles of a campus</text>
      <text x='28' y={rowT[1] + 78} fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>FARTHER HALF</text>
      <text x='28' y={rowT[1] + 98} fontSize='11.5' fill={MUTED_TEXT}>beyond {splitMi} miles</text>

      {cell(cells.nearPoor, colL[0], rowT[0],
        `${cells.nearPoor.n} nearer, lower-income districts: Computer Science access ${pct(cells.nearPoor.cs)}, other majors ${pct(cells.nearPoor.field)}`)}
      {cell(cells.nearRich, colL[1], rowT[0],
        `${cells.nearRich.n} nearer, higher-income districts: Computer Science access ${pct(cells.nearRich.cs)}, other majors ${pct(cells.nearRich.field)}`)}
      {cell(cells.farPoor, colL[0], rowT[1],
        `${cells.farPoor.n} farther, lower-income districts: Computer Science access ${pct(cells.farPoor.cs)}, other majors ${pct(cells.farPoor.field)}`)}
      {cell(cells.farRich, colL[1], rowT[1],
        `${cells.farRich.n} farther, higher-income districts: Computer Science access ${pct(cells.farRich.cs)}, other majors ${pct(cells.farRich.field)}`)}

      {incomeArrow(0, responses.income.near)}
      {incomeArrow(1, responses.income.far)}
      {distanceArrow(0, responses.proximity.poor)}
      {distanceArrow(1, responses.proximity.rich)}

      <text x='28' y='536' fontSize={reg.note} fill={MUTED_TEXT}>
        Rightward arrows: the access gained moving from the lower- to the higher-income half, distance held fixed.
      </text>
      <text x='28' y='556' fontSize={reg.note} fill={MUTED_TEXT}>
        Upward arrows: the access gained moving from the farther to the nearer half, income held fixed. Bars: share of program-district pairs with a complete path.
      </text>
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
    role: 'The verdict',
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
        <Beat no='3' title='How district income shapes transfer access: Computer Science against all other majors' basis={basis} {...BEATS[3]}>
          <Fig3 reg={reg} basis={basis} />
        </Beat>
        <Beat no='4' title='Transfer demand and income sensitivity, across every major' basis={basis} {...BEATS[4]}>
          <Fig4Market reg={reg} />
        </Beat>
        <Beat no='5' title='Distance to the nearest campus, by district income' basis={basis} {...BEATS[5]}>
          <Fig4Tethers reg={reg} />
        </Beat>
        <Beat no='6' title='Income and distance, tested with the other held fixed' basis={basis} {...BEATS[6]}>
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
