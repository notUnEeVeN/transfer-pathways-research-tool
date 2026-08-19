/**
 * Compact, export-safe bachelor-template receipt for comparison contracts.
 * Per-row API fields remain authoritative; this major-registry summary is
 * available before a comparison pane's data query completes.
 */
export function degreeTemplateEvidenceLabel(major) {
  const evidence = major?.degreeTemplateEvidence
  if (!evidence || !Number.isFinite(evidence.total)) return null
  const verified = Number(evidence.explicitlyVerified) || 0
  const stale = Number(evidence.staleResearchStatus) || 0
  return [
    `${verified}/${evidence.total} bachelor templates explicitly verified`,
    evidence.catalogYears ? `catalog years: ${evidence.catalogYears}` : null,
    stale
      ? `${stale} stale pre-verification research-status labels remain (verification records are authoritative)`
      : null,
  ].filter(Boolean).join('; ')
}
