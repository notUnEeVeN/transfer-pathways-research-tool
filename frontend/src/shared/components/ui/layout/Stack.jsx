import React from 'react'

// Named vertical rhythm from the spacing scale. These four cover every stacked
// layout in the app — reach for a margin only for a deliberate one-off offset,
// never for the rhythm between siblings.
const gaps = {
  tight: 'gap-2', // 8px  — closely related lines (label + value)
  cozy: 'gap-3', // 12px — list items, contents of a card
  comfortable: 'gap-4', // 16px — form fields, labeled groups
  section: 'gap-6' // 24px — between cards / major page blocks
}

/**
 * Vertical stack with a named gap. The single source of stacked rhythm: set the
 * gap once on the parent instead of hand-placing top/bottom margins on each
 * child. Pass `as` to render a semantic element (e.g. 'section', 'ul', 'form').
 */
export default function Stack({ gap = 'cozy', as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`flex flex-col ${gaps[gap] || gaps.cozy} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
