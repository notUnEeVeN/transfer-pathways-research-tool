import React, { useEffect, useRef, useState } from 'react'

const COPIED_FEEDBACK_MS = 1200
const PY_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

// Turns a route path into the pmt.get(...) call shown in starter.py: the
// researcher client's base URL already includes /api, so that prefix is
// stripped; query params are promoted to kwargs when every key is a legal
// Python identifier, otherwise the whole path (with its query string) is
// passed as one string.
function buildPmtSnippet(path) {
  const withoutApiPrefix = path.replace(/^\/?api\//, '')
  const queryIndex = withoutApiPrefix.indexOf('?')
  const bare = queryIndex === -1 ? withoutApiPrefix : withoutApiPrefix.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : withoutApiPrefix.slice(queryIndex + 1)
  if (!query) return `pmt.get(${JSON.stringify(bare)})`

  const params = [...new URLSearchParams(query).entries()]
  if (!params.every(([key]) => PY_IDENTIFIER.test(key))) return `pmt.get(${JSON.stringify(bare + '?' + query)})`

  const kwargs = params.map(([key, value]) => `, ${key}=${JSON.stringify(value)}`).join('')
  return `pmt.get(${JSON.stringify(bare)}${kwargs})`
}

// API route label — makes each data browser double as a route guide. Shows
// the method + path for whatever the user is currently viewing. Clicking
// copies a ready-to-run snippet for the researcher starter.py client (GET
// only; other methods copy as plain "METHOD path" text).
export default function RouteHint({ method = 'GET', path, className = '' }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  if (!path) return null

  const handleClick = () => {
    if (!navigator.clipboard?.writeText) return
    const snippet = method === 'GET' ? buildPmtSnippet(path) : `${method} ${path}`
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
  }

  const tooltipText = method === 'GET' ? 'Copy pmt.get(…) snippet' : 'Copy route'
  const fullLabel = `${method} ${path}`

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-2 ${className}`}>
      <span className='text-caption text-ink-subtle shrink-0'>API route</span>
      <button type='button' onClick={handleClick} title={`${tooltipText}\n${fullLabel}`}
        aria-label={fullLabel}
        className='min-w-0 max-w-full truncate text-[12px] font-semibold text-ink bg-surface border border-border rounded-[8px] px-2.5 py-[4.5px] whitespace-nowrap cursor-pointer hover:border-border-strong transition-colors'>
        {copied ? 'Copied!' : fullLabel}
      </button>
    </span>
  )
}
