/**
 * Can these panes be compared, and how?
 *
 * The tool refuses rather than fuses. Where two panes do not share a key
 * space — Bristol Community College is not Ohlone — no correspondence is
 * invented; the reader is told, permanently and on screen, that only
 * distributions and methodology contrasts exist across that boundary. Stating
 * the limit is the honest output, and it is what keeps a comparison from
 * quietly becoming a claim nobody checked.
 *
 * One rule decides everything: do the panes' row/column key spaces intersect?
 *
 *   different figures            -> incomparable / refused
 *   same figure, same major      -> same-cells / aligned   (a version diff)
 *   same figure, same state      -> same-cells / aligned   (CA majors share
 *                                   the district x campus key space)
 *   same figure, other state     -> same-measure / disjoint
 *   incompatible measure lenses  -> same-figure / refused, with the fix named
 *
 * Pure and fail-closed: anything it cannot establish resolves to refused.
 */

const LEVELS = ['incomparable', 'same-figure', 'same-measure', 'same-cells']

/**
 * @param panes  [{ id, figure, major, knobs }]
 * @param majorsBySlug  Map|object of slug -> major (needs .state, .label, .capabilities)
 */
export function assessComparability(panes, majorsBySlug) {
  const list = Array.isArray(panes) ? panes : []
  const lookup = (slug) => (
    majorsBySlug instanceof Map ? majorsBySlug.get(slug) : majorsBySlug?.[slug]
  ) || null

  if (list.length < 2) {
    return {
      level: 'incomparable',
      join: 'refused',
      line: 'Add a second view to compare.',
      warnings: [],
    }
  }

  const figures = new Set(list.map((pane) => pane.figure))
  if (figures.size > 1) {
    return {
      level: 'incomparable',
      join: 'refused',
      line: 'These panes render different figures, which compute different things — no difference is shown.',
      warnings: [{
        code: 'different_figures',
        text: `Panes name ${[...figures].join(' and ')}.`,
        fix: 'Put both panes on the same figure, or keep them side by side as context only.',
      }],
    }
  }

  const majors = list.map((pane) => lookup(pane.major))
  if (majors.some((major) => !major)) {
    return {
      level: 'incomparable',
      join: 'refused',
      line: 'One of these panes names a major this console does not have configured.',
      warnings: [{
        code: 'unknown_major',
        text: 'A pane references an unconfigured major slug.',
        fix: 'Rebuild the pane from the picker.',
      }],
    }
  }

  const warnings = []

  // Measure-lens compatibility. `unitCoverage: false` makes the server emit
  // NULL for every unit-lens field, so a pane reading that lens against one
  // reading the course lens is comparing a number to an absence.
  const unitLens = majors.map((major) => major.capabilities?.unitCoverage !== false)
  const lensMismatch = new Set(unitLens).size > 1
  if (lensMismatch) {
    const courseOnly = majors.filter((m) => m.capabilities?.unitCoverage === false)
    warnings.push({
      code: 'measure_mismatch',
      text: `These panes read different measures — the graduation-unit lens against the course lens used by ${courseOnly.map((m) => m.label).join(' and ')}.`,
      fix: 'Switch the unit-lens pane to its paper-equivalent (course) reading so both panes count the same thing.',
    })
  }

  const states = new Set(majors.map((major) => major.state || 'ca'))
  const slugs = new Set(list.map((pane) => pane.major))

  // Disjoint key spaces are the more fundamental fact and are classified first:
  // two corpora share no institutions, so no cell difference exists whatever
  // the panes measure. A lens mismatch rides along as a warning, because the
  // distribution comparison that answers this case still needs both panes on
  // the same measure.
  if (states.size > 1) {
    return {
      level: 'same-measure',
      join: 'disjoint',
      line: `Same figure, different corpora (${[...states].map((s) => s.toUpperCase()).join(' vs ')}) — these have no colleges or campuses in common, so no cell-by-cell difference exists.`,
      warnings: [...warnings, {
        code: 'disjoint_keys',
        text: 'Rows and columns name different institutions in each pane; a matched difference would be invented, not measured.',
        fix: 'Compare the distributions and the methodology instead of the cells.',
      }],
    }
  }

  if (lensMismatch) {
    return {
      level: 'same-figure',
      join: 'refused',
      line: 'Same figure, different measures — no difference is shown until both panes read the same one.',
      warnings,
    }
  }

  if (slugs.size > 1) {
    return {
      level: 'same-cells',
      join: 'aligned',
      line: `Same figure and corpus across ${slugs.size} majors — the colleges and campuses match, so every cell is comparable.`,
      warnings,
    }
  }

  return {
    level: 'same-cells',
    join: 'aligned',
    line: 'Same figure, same major, different pinned controls — every cell is directly comparable.',
    warnings,
  }
}

export { LEVELS }
