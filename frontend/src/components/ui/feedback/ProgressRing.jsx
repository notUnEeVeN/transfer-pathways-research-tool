import React from 'react'

const toneStroke = {
  brand: 'var(--color-primary)',
  success: 'var(--color-success)'
}

/**
 * Progress donut. Theme-aware strokes via tokens; `tone` picks the color family.
 * `label` overrides the centered value; `labelClassName` its type.
 */
export default function ProgressRing({
  value = 0,
  size = 40,
  stroke = 4,
  tone = 'brand',
  label,
  labelClassName = 'font-mono text-tag',
  ariaLabel,
  className = ''
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, value))
  const offset = circumference - (clamped / 100) * circumference
  const a11yLabel = ariaLabel ?? `${Math.round(clamped)} percent`
  const strokeColor = toneStroke[tone] || toneStroke.brand
  return (
    <div
      className={`relative inline-grid place-items-center ${className}`}
      style={{ width: size, height: size }}
      role='img'
      aria-label={a11yLabel}
    >
      <svg width={size} height={size} className='-rotate-90' aria-hidden='true' focusable='false'>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke='var(--color-border)' strokeWidth={stroke} fill='none' />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={stroke}
          fill='none'
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap='round'
          style={{ transition: 'stroke-dashoffset 320ms var(--ease-out)' }}
        />
      </svg>
      <span className={`absolute ${labelClassName}`} aria-hidden='true'>
        {label ?? `${Math.round(clamped)}`}
      </span>
    </div>
  )
}
