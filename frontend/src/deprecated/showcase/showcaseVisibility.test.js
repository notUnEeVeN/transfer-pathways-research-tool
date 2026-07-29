import { describe, expect, it } from 'vitest'
import { shouldShowShowcase } from './showcaseVisibility'

describe('showcase deployment visibility', () => {
  it('is available during local development', () => {
    expect(shouldShowShowcase({ PROD: false })).toBe(true)
  })

  it('is hidden in production unless explicitly enabled', () => {
    expect(shouldShowShowcase({ PROD: true })).toBe(false)
    expect(shouldShowShowcase({ PROD: true, VITE_SHOWCASE_ENABLED: 'true' })).toBe(true)
  })
})
