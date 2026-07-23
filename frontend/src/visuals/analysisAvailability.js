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

  const required = scope.requiredCapabilities ?? []
  if (!Array.isArray(required) || required.some((name) => !text(name))) {
    return unavailableConfiguration('This visual has invalid capability requirements.', scope)
  }

  const capabilities = selectedMajor?.capabilities
  if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities)) {
    return unavailableConfiguration(`Capability metadata is unavailable for ${selectedLabel}.`, scope)
  }

  const missingCapabilities = required
    .map(text)
    .filter((name) => !capabilityReady(capabilities[name]))

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

  return {
    available: true,
    status: 'available',
    effectiveMajorSlug: selectedSlug,
    fixed: false,
    label: `${selectedLabel} available`,
    reason: '',
    datasets,
    missingCapabilities: [],
  }
}
