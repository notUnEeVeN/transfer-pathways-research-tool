export function canViewBuiltInAnalysis(analysisId, {
  isAdmin = false,
  releasedIds = [],
  disabledIds = [],
} = {}) {
  const id = String(analysisId || '')
  return !disabledIds.includes(id) && (isAdmin || releasedIds.includes(id))
}

export function filterBuiltInAnalyses(analyses, settings) {
  return analyses.filter((analysis) => canViewBuiltInAnalysis(analysis.id, settings))
}
