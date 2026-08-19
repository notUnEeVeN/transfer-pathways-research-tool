import { describe, expect, it } from 'vitest'
import { ANALYSES } from '../analyses/registry'
import { assessComparability } from './comparability'
import { fingerprintOf, knobsFor, resolveKnobs } from './viewKnobs'
import EXHIBITS from './savedExhibits.fixture.json'

/**
 * The eight meeting exhibits actually saved on the research console, checked
 * as data: six CA–MA state comparisons and the two material MA audits.
 *
 * The audit's finding was that nothing tested the real saved comparisons — so
 * a figure could be renamed, a knob retired, or a major's capabilities changed
 * and the shipped exhibits would rot silently until someone opened one. This
 * fixture is a snapshot of what is stored; regenerate it if the exhibits
 * change deliberately, and let it fail if they change by accident.
 *
 * It deliberately does NOT assert cell values. Those come from live queries
 * that legitimately move; `verdict_at_pin` is what records them, and the drift
 * banner is what reports the movement.
 */

const byId = (id) => ANALYSES.find((analysis) => analysis.id === id)

// The two corpora the exhibits actually reference, with the capability flags
// that gate their controls.
const MAJORS = new Map([
  ['cs', {
    slug: 'cs',
    label: 'Computer Science',
    capabilities: { unitCoverage: true, degreeTemplates: true, asDegrees: true, prerequisites: true },
    degreeAnalysisSlots: ['local_as', 'ast'],
    courseTypes: { module: 'cs', excludeGeGroups: true, axes: { faithful: [] } },
  }],
  ['ma-cs', {
    slug: 'ma-cs',
    label: 'Computer Science (MA)',
    state: 'ma',
    capabilities: { unitCoverage: false, paperBaselines: true, degreeTemplates: true, asDegrees: true, prerequisites: false },
    degreeAnalysisSlots: ['local_as'],
    courseTypes: { module: 'cs', axes: { faithful: [] } },
  }],
])

describe('the saved comparison exhibits', () => {
  it('ships the eight exhibits the console presents', () => {
    expect(EXHIBITS).toHaveLength(8)
    expect(EXHIBITS.filter((e) => e.title.startsWith('STATES ·'))).toHaveLength(6)
    expect(EXHIBITS.filter((e) => e.title.startsWith('MA AUDIT ·'))).toHaveLength(2)
    expect(EXHIBITS.slice(0, 6).map((e) => byId(e.panes[0].figure)?.figureNo))
      .toEqual([1, 2, 3, 4, 5, 6])
    const audits = EXHIBITS.filter((e) => e.title.startsWith('MA AUDIT ·'))
      .sort((a, b) => byId(a.panes[0].figure).figureNo - byId(b.panes[0].figure).figureNo)
    expect(audits.map((e) => byId(e.panes[0].figure)?.figureNo))
      .toEqual([3, 4])
    expect(audits.map((e) => e.breakdown_id))
      .toEqual(['ma-transfer-credit-figure-3', 'ma-extra-units-figure-4'])
    for (const audit of audits) {
      expect(audit.panes.map((pane) => pane.label))
        .toEqual(['Final paper', 'Our recalculation'])
    }
  })

  it('uses printed-percentage precision for the Figure 1 source audit', () => {
    // PDF Figure 1 has whole-number cells; the archive pane has their raw
    // ratios. A narrower threshold would label ordinary display rounding as
    // disagreement and obscure the one material 45-vs-35 cell.
    expect(byId('coverage-heatmap').comparable.tolerance).toBe(0.5)
  })

  // The audit asked for this specifically: "corrected" and "paper error" are
  // claims the evidence does not support where only version divergence is
  // proven, and both exhibits that compare artifacts are version diagnostics.
  it('never labels an artifact difference as an error or a correction', () => {
    for (const exhibit of EXHIBITS) {
      expect(exhibit.title).not.toMatch(/error|corrected|correction|wrong|typo/i)
    }
  })

  it.each(EXHIBITS.map((e) => [e.title, e]))('%s resolves to mountable panes', (_title, exhibit) => {
    expect(exhibit.panes.length).toBeGreaterThanOrEqual(2)
    for (const pane of exhibit.panes) {
      const analysis = byId(pane.figure)
      expect(analysis, `${pane.figure} is not a registered analysis`).toBeTruthy()
      const major = MAJORS.get(pane.major)
      expect(major, `${pane.major} is not a known major`).toBeTruthy()

      // Every pinned knob must still be offered for this figure on this
      // corpus, with a value the control actually accepts. A knob that has
      // been retired would otherwise sit in the document forever, silently
      // ignored while the label kept promising it.
      const offered = new Map(knobsFor(analysis, major).map((knob) => [knob.key, knob]))
      for (const [key, value] of Object.entries(pane.knobs || {})) {
        const knob = offered.get(key)
        expect(knob, `${pane.figure} on ${pane.major} no longer offers "${key}"`).toBeTruthy()
        if (knob.type === 'toggle') expect(typeof value).toBe('boolean')
        else expect(knob.options.map((option) => option.value)).toContain(value)
      }
      // The seed the pane hands the figure must name props the figure reads.
      const resolved = resolveKnobs(pane, analysis, major)
      expect(resolved).toBeTruthy()
      expect(pane.fingerprint).toBe(fingerprintOf(pane, analysis, major))
    }
    expect(exhibit.panes.some((pane) => pane.id === exhibit.baseline_pane)).toBe(true)
  })

  it.each(EXHIBITS.map((e) => [e.title, e]))('%s states an honest join basis', (_title, exhibit) => {
    const assessment = assessComparability(exhibit.panes, MAJORS, byId)
    const states = new Set(exhibit.panes.map((pane) => MAJORS.get(pane.major)?.state || 'ca'))

    if (states.size > 1) {
      // Disjoint institutions cannot be joined cell by cell, and claiming
      // otherwise is the defect the audit named first. Two honest outcomes
      // remain: a population contrast when the two panes define the statistic
      // the same way, or a refusal that NAMES the definition that differs.
      // Silence is the only unacceptable answer.
      expect(assessment.join).not.toBe('aligned')
      if (assessment.join === 'refused') {
        const named = assessment.warnings.find((warning) => (
          warning.code === 'distribution_semantics_mismatch'
          || warning.code === 'distribution_contract_mismatch'
        ))
        expect(named, `${_title} refuses without naming why`).toBeTruthy()
        expect(named.text).toMatch(/differ in \S+/)
      } else {
        expect(assessment.join).toBe('disjoint')
        expect(assessment.level).toBe('same-measure')
      }
    } else {
      // Same corpus, same figure, different source: every named Figure 3 or
      // Figure 4 cell is directly comparable.
      expect(assessment.join).toBe('aligned')
      expect(assessment.level).toBe('same-cells')
    }
  })
})

// Two of the six cross-state exhibits refuse a numeric contrast because the
// two corpora define the statistic differently: Figure 5's price basis and
// Figure 6's graph provenance. Figure 2 excludes GE on both sides and compares
// four semantic-role distributions, so it is a valid disjoint-population
// contrast. The two remaining refusals are pinned here deliberately.
describe('cross-state exhibits that refuse a numeric contrast', () => {
  it('refuses exactly the two known definition mismatches', () => {
    const refusals = EXHIBITS
      .filter((exhibit) => exhibit.title.startsWith('STATES ·'))
      .map((exhibit) => [exhibit.title, assessComparability(exhibit.panes, MAJORS, byId)])
      .filter(([, assessment]) => assessment.join === 'refused')
      .map(([title, assessment]) => [
        title.replace(/^STATES · (Fig \d).*/, '$1'),
        assessment.warnings.find((w) => w.code === 'distribution_semantics_mismatch')?.text,
      ])

    expect(refusals).toEqual([
      ['Fig 5', 'The cross-state definitions differ in price_basis.'],
      ['Fig 6', 'The cross-state definitions differ in graph, prerequisite_alternative_tiebreak, associate_plan.'],
    ])
  })
})
