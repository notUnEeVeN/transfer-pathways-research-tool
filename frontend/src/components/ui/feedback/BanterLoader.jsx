import React from 'react'

// One entry per square: its moveBox keyframe plus the one-off margins that seed
// the animation's overlapping home positions (mirrors the original :nth-child
// rules). Margins are listed per box — never a shared `mr-*` — so the 3rd-column
// boxes (mr-0) don't collide with a base margin and lose the conflict at random.
// Under reduced motion the seed offsets are zeroed so the (un-animated) squares
// settle into a clean, non-overlapping 3×3 instead of the home-state cluster.
const BOXES = [
  'mr-1.5 before:ml-[26px] motion-reduce:before:ml-0 motion-safe:animate-[moveBox-1_4s_infinite]',
  'mr-1.5 motion-safe:animate-[moveBox-2_4s_infinite]',
  'mr-0 mb-1.5 before:mt-[52px] motion-reduce:before:mt-0 motion-safe:animate-[moveBox-3_4s_infinite]',
  'mr-1.5 before:ml-[26px] motion-reduce:before:ml-0 motion-safe:animate-[moveBox-4_4s_infinite]',
  'mr-1.5 motion-safe:animate-[moveBox-5_4s_infinite]',
  'mr-0 mb-1.5 motion-safe:animate-[moveBox-6_4s_infinite]',
  'mr-1.5 motion-safe:animate-[moveBox-7_4s_infinite]',
  'mr-1.5 motion-safe:animate-[moveBox-8_4s_infinite]',
  'mr-0 motion-safe:animate-[moveBox-9_4s_infinite]'
]

// The square itself is an invisible 20px positioning box; its ::before is the
// visible fill, rendered in the on-primary treatment so it reads on a primary
// (or otherwise dark) surface.
const BOX_BASE =
  "relative float-left h-5 w-5 before:absolute before:left-0 before:top-0 before:h-full before:w-full before:bg-on-primary before:content-['']"

/**
 * BanterLoader — a 3×3 of squares that shuffle around each other in a continuous
 * loop. Built for a primary or otherwise dark surface (squares are on-primary).
 * The shuffle is `motion-safe` only; reduced-motion users see the static grid.
 * `role=status` carries the accessible name since there's no visible label.
 */
export default function BanterLoader({ className = '' }) {
  return (
    <div role='status' aria-label='Loading' className={`relative h-18 w-18 ${className}`}>
      {BOXES.map((cls, i) => (
        <span key={i} aria-hidden='true' className={`${BOX_BASE} ${cls}`} />
      ))}
    </div>
  )
}
