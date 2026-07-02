import React from 'react'

/**
 * A loading placeholder block. Pass width/height/rounded via className. The one
 * shared skeleton — replaces the per-page hand-rolled animate-pulse bars.
 */
export default function Skeleton({ className = '' }) {
  return <div aria-hidden='true' className={`animate-pulse rounded-md bg-surface-hover ${className}`} />
}
