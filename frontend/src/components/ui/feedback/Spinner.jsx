import React from 'react'

export default function Spinner({ size = 20, className = '' }) {
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' className={`animate-spin ${className}`} aria-hidden='true'>
      <circle cx='12' cy='12' r='9' stroke='currentColor' strokeWidth='2.5' fill='none' opacity='0.2' />
      <path d='M21 12a9 9 0 0 0-9-9' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' fill='none' />
    </svg>
  )
}
