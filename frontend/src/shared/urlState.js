export function readUrlParam(name) {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get(name)
}

/**
 * Update one query parameter without disturbing the path, other parameters,
 * or hash. User choices push history so Back/Forward can restore them;
 * canonicalization uses replace to avoid manufacturing a navigation step.
 */
export function writeUrlParam(name, value, { replace = false } = {}) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (value == null || value === '') url.searchParams.delete(name)
  else url.searchParams.set(name, String(value))
  const next = `${url.pathname}${url.search}${url.hash}`
  const method = replace ? 'replaceState' : 'pushState'
  window.history[method](window.history.state, '', next)
}
