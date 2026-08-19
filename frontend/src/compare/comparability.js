/**
 * Decide what two or more panes may honestly claim to compare.
 *
 * Institution overlap is only the last step. First every figure declares a
 * comparison contract: statistic, unit, grain, key space and the semantic
 * choices that make the number what it is. This prevents two panes that look
 * alike from being described as comparable when their denominators differ.
 *
 * Contract shape:
 *   { measure, unit, grain, keys, semantics, context, distribution? }
 *
 * `semantics` must match for a cross-corpus distribution. `context` is shown
 * but may differ: source or cohort is often the contrast the reader intended.
 */

const LEVELS = ['incomparable', 'same-figure', 'same-measure', 'same-cells']

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${key}:${stable(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const differentFields = (left = {}, right = {}) => {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})])
  return [...keys].filter((key) => stable(left?.[key]) !== stable(right?.[key]))
}

const lookupOf = (source) => {
  if (typeof source === 'function') return source
  return (key) => (source instanceof Map ? source.get(key) : source?.[key]) || null
}

export function resolveComparisonContract(pane, major, analysesById) {
  const analysis = lookupOf(analysesById)(pane?.figure)
  if (!analysis || typeof analysis.comparisonContract !== 'function') return null
  const contract = analysis.comparisonContract(pane, major)
  if (!contract || typeof contract !== 'object') return null
  if (['measure', 'unit', 'grain'].some((field) => !contract[field])) return null
  return {
    measure: String(contract.measure),
    unit: String(contract.unit),
    grain: String(contract.grain),
    keys: contract.keys && typeof contract.keys === 'object' ? contract.keys : {},
    semantics: contract.semantics && typeof contract.semantics === 'object'
      ? contract.semantics : {},
    context: contract.context && typeof contract.context === 'object'
      ? contract.context : {},
    distribution: contract.distribution && typeof contract.distribution === 'object'
      ? contract.distribution : {},
  }
}

const refused = (line, warning) => ({
  level: warning?.code === 'different_figures' ? 'incomparable' : 'same-figure',
  join: 'refused',
  line,
  warnings: warning ? [warning] : [],
  contracts: [],
})

/**
 * @param panes [{ id, figure, major, knobs }]
 * @param majorsBySlug Map|object of slug -> major
 * @param analysesById Map|object|function of figure id -> registry entry
 */
export function assessComparability(panes, majorsBySlug, analysesById) {
  const list = Array.isArray(panes) ? panes : []
  const majorLookup = lookupOf(majorsBySlug)

  if (list.length < 2) {
    return {
      level: 'incomparable', join: 'refused',
      line: 'Add a second view to compare.', warnings: [], contracts: [],
    }
  }

  const figures = new Set(list.map((pane) => pane.figure))
  if (figures.size > 1) {
    return refused(
      'These panes render different figures, which compute different things — no difference is shown.',
      {
        code: 'different_figures',
        text: `Panes name ${[...figures].join(' and ')}.`,
        fix: 'Put both panes on the same figure, or keep them side by side as context only.',
      },
    )
  }

  const majors = list.map((pane) => majorLookup(pane.major))
  if (majors.some((major) => !major)) {
    return refused(
      'One of these panes names a major this console does not have configured.',
      {
        code: 'unknown_major',
        text: 'A pane references an unconfigured major slug.',
        fix: 'Rebuild the pane from the picker.',
      },
    )
  }

  const contracts = list.map((pane, index) => (
    resolveComparisonContract(pane, majors[index], analysesById)
  ))
  if (contracts.some((contract) => !contract)) {
    return {
      ...refused(
        'This figure has not declared enough methodology to compute a defensible comparison.',
        {
          code: 'missing_contract',
          text: 'At least one pane has no complete measure contract.',
          fix: 'Use the figures side by side until its unit, grain, denominator, cohort and source are declared.',
        },
      ),
      contracts,
    }
  }

  const first = contracts[0]
  const identityFields = ['measure', 'unit', 'grain']
    .filter((field) => contracts.some((contract) => contract[field] !== first[field]))
  if (identityFields.length) {
    return {
      ...refused(
        'The panes do not compute the same statistic at the same unit and grain, so no difference is shown.',
        {
          code: 'measure_contract_mismatch',
          text: `The declared contracts differ in ${identityFields.join(', ')}.`,
          fix: 'Choose matching measure settings before interpreting a delta or a distribution.',
        },
      ),
      contracts,
    }
  }

  const keyFields = [...new Set(contracts.slice(1)
    .flatMap((contract) => differentFields(first.keys, contract.keys)))]
  const semanticFields = [...new Set(contracts.slice(1)
    .flatMap((contract) => differentFields(first.semantics, contract.semantics)))]
  const contextFields = [...new Set(contracts.slice(1)
    .flatMap((contract) => differentFields(first.context, contract.context)))]
  const distributionFields = [...new Set(contracts.slice(1)
    .flatMap((contract) => differentFields(first.distribution, contract.distribution)))]
  const states = new Set(majors.map((major) => major.state || 'ca'))
  const slugs = new Set(list.map((pane) => pane.major))
  const warnings = []

  if (contextFields.length) {
    warnings.push({
      code: 'context_difference',
      text: `The panes intentionally differ in ${contextFields.join(', ')}.`,
      fix: 'Those source/cohort choices are printed with each pane and are part of the interpretation.',
    })
  }

  if (states.size > 1) {
    if (distributionFields.length) {
      return {
        level: 'same-figure', join: 'refused', contracts,
        line: 'The corpora request different distribution summaries, so no numeric contrast is shown.',
        warnings: [...warnings, {
          code: 'distribution_contract_mismatch',
          text: `The distribution contracts differ in ${distributionFields.join(', ')}.`,
          fix: 'Use the same grouping and pooling rule before comparing disjoint corpora.',
        }],
      }
    }
    if (semanticFields.length) {
      return {
        level: 'same-figure', join: 'refused', contracts,
        line: 'The corpora are disjoint and the panes also use different definitions, so even a distribution contrast would be misleading.',
        warnings: [...warnings, {
          code: 'distribution_semantics_mismatch',
          text: `The cross-state definitions differ in ${semanticFields.join(', ')}.`,
          fix: 'Match the denominator, scope, GE treatment and weighting before comparing distributions.',
        }],
      }
    }
    return {
      level: 'same-measure', join: 'disjoint', contracts,
      line: `Same statistic, different corpora (${[...states].map((s) => s.toUpperCase()).join(' vs ')}) — compare distributions, not institution-by-institution cells.`,
      warnings: [...warnings, {
        code: 'disjoint_keys',
        text: 'Rows and columns name different institutions; a matched cell difference would be invented.',
        fix: 'Use the live distribution receipt below, which preserves each corpus’s own institutions.',
      }],
    }
  }

  if (keyFields.length) {
    return {
      level: 'same-figure', join: 'refused', contracts,
      line: 'These panes use different row or column identities, so their cells cannot be joined safely.',
      warnings: [...warnings, {
        code: 'key_space_mismatch',
        text: `The key-space contracts differ in ${keyFields.join(', ')}.`,
        fix: 'Match the row grouping and column grain before requesting a cell delta.',
      }],
    }
  }

  if (semanticFields.length) {
    warnings.push({
      code: 'semantic_lens_difference',
      text: `The matched institutions are being read through different lenses: ${semanticFields.join(', ')}.`,
      fix: 'Treat the delta as a named lens contrast, not disagreement within one definition.',
    })
  }

  return {
    level: 'same-cells', join: 'aligned', contracts,
    line: slugs.size > 1
      ? `The institution keys align across ${slugs.size} majors; the receipt reports every matched and unmatched cell.`
      : 'The institution keys align; the receipt reports every matched and unmatched cell.',
    warnings,
  }
}

export { LEVELS }
