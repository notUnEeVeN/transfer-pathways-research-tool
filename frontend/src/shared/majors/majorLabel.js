const KNOWN_MAJOR_LABELS = Object.freeze({
  cs: 'Computer Science',
  bio: 'Biology',
  econ: 'Economics',
})

/**
 * Human-readable label for a configured major.
 *
 * Callers should pass the registry label when they have it. The slug fallback
 * keeps frozen publications and newly generated artifacts truthful even when
 * they predate that optional field; it never silently substitutes CS.
 */
export function majorLabelFor(majorSlug, configuredLabel = '') {
  const explicit = String(configuredLabel || '').trim()
  if (explicit) return explicit

  const slug = String(majorSlug || '').trim().toLowerCase()
  if (KNOWN_MAJOR_LABELS[slug]) return KNOWN_MAJOR_LABELS[slug]

  const words = slug.replace(/[^a-z0-9]+/gi, ' ').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'Selected Major'
  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

export function majorShortLabelFor(majorSlug, configuredLabel = '') {
  return String(majorSlug || '').trim().toLowerCase() === 'cs'
    ? 'CS'
    : majorLabelFor(majorSlug, configuredLabel)
}
