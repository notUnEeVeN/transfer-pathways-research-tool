function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Capability values are deliberately explicit. Boolean feature flags must be
 * true, while collection-backed capabilities (for example committed snapshot
 * names) must contain at least one item. Everything else fails closed.
 */
export function capabilityReady(value) {
  return value === true || (Array.isArray(value) && value.length > 0)
}

function unavailableConfiguration(reason, scope = null) {
  return {
    available: false,
    status: 'configuration_error',
    effectiveMajorSlug: null,
    fixed: scope?.mode === 'fixed',
    label: 'Unavailable',
    reason,
    datasets: Array.isArray(scope?.datasets) ? [...scope.datasets] : [],
    missingCapabilities: [],
  }
}

/**
 * Resolve one registry entry against the major selected on the Visuals page.
 *
 * This is intentionally pure and fail-closed: a visual without a valid
 * `majorScope`, or a selected major without a slug/capability payload, never
 * silently falls back to Computer Science.
 */
export function resolveAnalysisAvailability(analysis, selectedMajor) {
  const scope = analysis?.majorScope
  if (!scope || typeof scope !== 'object') {
    return unavailableConfiguration('This visual is missing major-scope metadata.')
  }

  const selectedSlug = text(selectedMajor?.slug)
  if (!selectedSlug) {
    return unavailableConfiguration('Choose a configured major to use this visual.', scope)
  }

  const selectedLabel = text(selectedMajor?.label) || selectedSlug
  const datasets = Array.isArray(scope.datasets) ? [...scope.datasets] : []

  // Renderer release is global, but publication readiness is major-scoped.
  // A configured corpus may therefore require an exact server-issued receipt
  // in addition to ordinary schema capabilities. Missing/stale receipt state
  // never falls through to those permissive static flags.
  const publicationGate = selectedMajor?.publicationGate
  if (publicationGate != null) {
    const requiredContract = text(publicationGate?.contract)
    const publication = selectedMajor?.analysisPublication
    if (!requiredContract || publication?.ready !== true
        || text(publication?.contract) !== requiredContract
        || text(publication?.major_slug) !== selectedSlug) {
      return {
        available: false,
        status: 'publication_pending',
        effectiveMajorSlug: null,
        fixed: scope.mode === 'fixed',
        label: `Publication pending for ${selectedLabel}`,
        reason: `The current ${selectedLabel} projection has not passed its exact publication receipt gate.`,
        datasets,
        missingCapabilities: ['analysisPublicationReceipt'],
      }
    }
  }

  if (scope.mode === 'fixed') {
    const fixedSlug = text(scope.slug)
    if (!fixedSlug) {
      return unavailableConfiguration('This fixed-major visual is missing its major slug.', scope)
    }

    const fixedLabel = text(scope.label) || fixedSlug
    const available = selectedSlug === fixedSlug
    return {
      available,
      status: 'fixed',
      effectiveMajorSlug: available ? fixedSlug : null,
      fixed: true,
      label: available ? `${fixedLabel} reference` : `${fixedLabel} only`,
      reason: text(scope.reason) || `This visual is fixed to ${fixedLabel}.`,
      datasets,
      missingCapabilities: [],
    }
  }

  if (scope.mode !== 'selected') {
    return unavailableConfiguration(`Unknown major-scope mode: ${text(scope.mode) || 'missing'}.`, scope)
  }

  // Editorial exclusion: the major has the data, but the figure does not
  // make sense for it (e.g. course-level figures over Economics' tiny stated
  // ask). Distinct from data_pending — nothing is being waited on.
  const excluded = scope.excludedMajors
  if (excluded && Object.prototype.hasOwnProperty.call(excluded, selectedSlug)) {
    return {
      available: false,
      status: 'not_applicable',
      effectiveMajorSlug: null,
      fixed: false,
      label: `Not shown for ${selectedLabel}`,
      reason: text(excluded[selectedSlug])
        || `This visual is deliberately not offered for ${selectedLabel}.`,
      datasets,
      missingCapabilities: [],
    }
  }

  const required = scope.requiredCapabilities ?? []
  if (!Array.isArray(required) || required.some((name) => !text(name))) {
    return unavailableConfiguration('This visual has invalid capability requirements.', scope)
  }

  const capabilities = selectedMajor?.capabilities
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return unavailableConfiguration(`Capability metadata is unavailable for ${selectedLabel}.`, scope)
  }

  // A requirement may list alternatives separated by '|' (for example
  // 'prerequisites|paperBaselines'): the entry is satisfied when ANY
  // alternative is ready. Used where the same figure runs live for corpora
  // with one capability and from a committed paper snapshot for corpora with
  // the other.
  const missingCapabilities = required
    .map(text)
    .filter((name) => !name.split('|').some((alt) => capabilityReady(capabilities[alt.trim()])))

  if (missingCapabilities.length) {
    return {
      available: false,
      status: 'data_pending',
      effectiveMajorSlug: null,
      fixed: false,
      label: `Data pending for ${selectedLabel}`,
      reason: text(scope.pendingReason)
        || `This visual needs ${missingCapabilities.join(', ')} data before it can run for ${selectedLabel}.`,
      datasets,
      missingCapabilities,
    }
  }

  // A corpus can be published from structurally sound documents while its
  // paper figures carry no release certification. That renders, but it must
  // never render silently: carry the state out so the visual can say so.
  const publication = selectedMajor?.analysisPublication
  const uncertified = publication?.ready === true && publication?.certified === false

  return {
    available: true,
    status: 'available',
    effectiveMajorSlug: selectedSlug,
    fixed: false,
    label: `${selectedLabel} available`,
    reason: '',
    datasets,
    missingCapabilities: [],
    certified: !uncertified,
    uncertifiedNotice: uncertified
      ? `${selectedLabel} figures are computed from verified source documents but have not passed institutional release certification. Pairs without complete evidence are excluded rather than estimated.`
      : '',
  }
}
