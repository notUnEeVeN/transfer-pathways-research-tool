import React from 'react'

// Non-copyable API route label — makes each data browser double as a route
// guide. Shows the GET path for whatever the user is currently viewing.
export default function RouteHint({ method = 'GET', path }) {
  if (!path) return null
  return (
    <span className='inline-flex items-center gap-2 text-caption'>
      <span className='text-ink-subtle'>API route</span>
      <span className='font-mono text-ink px-2 py-0.5 rounded-md surface-sunken whitespace-nowrap'>
        {method} {path}
      </span>
    </span>
  )
}
