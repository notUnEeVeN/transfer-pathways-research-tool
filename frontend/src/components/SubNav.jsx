import React from 'react'
import { Tabs } from './ui'
import RouteHint from './RouteHint'

/**
 * Full-bleed in-page sub-navigation bar: `Tabs` on the left, an optional
 * `RouteHint` (or arbitrary right-slot content) pinned to the right edge.
 * Sits directly under the top bar on Data / Audit / API surfaces.
 *
 * `tabs` is spread straight into `<Tabs>` — pass `{ value, onChange, options }`.
 * `route` (when given) renders the `API route` chip via `RouteHint`; otherwise
 * `children`, if given, take the same right-hand slot.
 */
export default function SubNav({ tabs, route, children }) {
  const rightSlot = route ? <RouteHint path={route.path} method={route.method} /> : children
  return (
    <div className='flex items-center gap-4 h-[54px] px-[22px] border-b border-border'>
      <Tabs {...tabs} />
      {rightSlot && <div className='ml-auto min-w-0 flex-1 flex justify-end'>{rightSlot}</div>}
    </div>
  )
}
