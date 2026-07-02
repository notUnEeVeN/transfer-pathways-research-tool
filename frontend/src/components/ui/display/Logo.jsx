import React from 'react'

/**
 * Logo — the Plan My Transfer brand mark, inlined as SVG so it inherits the
 * live theme through `currentColor`. Defaults to the brand primary, which swaps
 * automatically between light (`#3366ef`) and dark (`#6f8cff`) via the
 * `--color-primary` token. Pass a `text-*` color in `className` only if you
 * deliberately want to override the brand color. Decorative by default
 * (aria-hidden); pass a `title` for an accessible name when it stands alone.
 */
export default function Logo({ className = '', title }) {
  // Default to the brand color, but step aside if the caller passes their own
  // `text-*` color (e.g. `text-on-primary` on a brand surface). Both classes
  // would otherwise apply and `.text-primary`, defined later in the stylesheet,
  // would win the tie — so only emit it when no override is present.
  const hasColor = /(?:^|\s)!?text-/.test(className)
  return (
    <svg
      viewBox='0 0 196.02 228.69'
      fill='currentColor'
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
      className={`${hasColor ? '' : 'text-primary'} ${className}`}
    >
      <path d='M130.68,65.34v57.21c0,4.49-3.64,8.14-8.14,8.14h-57.21L2.33,193.69c-1.49,1.49-2.33,3.52-2.33,5.63v29.37h65.34v-32.67h62.04c2.11,0,4.14-.84,5.63-2.33l60.67-60.67c1.49-1.49,2.33-3.52,2.33-5.63v-62.04h-65.34Z' />
      <path d='M130.68,65.34V0h-62.04c-2.11,0-4.14.84-5.63,2.33L2.33,63.01c-1.49,1.49-2.33,3.52-2.33,5.63v62.04h65.34v-57.21c0-4.49,3.64-8.14,8.14-8.14h57.21Z' />
    </svg>
  )
}
