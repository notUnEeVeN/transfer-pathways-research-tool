import React from 'react'

/**
 * On/off toggle. 22px tall, 40px wide. Thumb is absolutely positioned and
 * vertically centered via top-1/2 + translate, so it can't drift when the
 * Switch lives inside flex/grid parents.
 */
export default function Switch({ checked, onChange, disabled = false, label, className = '' }) {
  return (
    <button
      type='button'
      role='switch'
      aria-checked={checked}
      onClick={() => !disabled && onChange?.()}
      disabled={disabled}
      aria-label={label}
      className={`relative inline-block h-[22px] w-10 rounded-full border transition-colors align-middle ${
        checked ? 'bg-primary border-primary' : 'bg-surface-sunken border-border-strong'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      <span
        aria-hidden
        // Knob is explicitly white (not `bg-surface`) — in dark theme
        // `--color-surface` is near-black, which would vanish on the lime
        // (`--color-primary` in dark) track.
        className='absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-white transition-[left] duration-150'
        style={{ left: checked ? 'calc(100% - 20px)' : '2px', boxShadow: 'var(--shadow-sm)' }}
      />
    </button>
  )
}
