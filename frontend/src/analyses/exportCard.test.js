import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, exportAnalysisCard, exportPixelRatio } from './exportCard'

const toBlob = vi.hoisted(() => vi.fn())

vi.mock('html-to-image', () => ({ toBlob }))

describe('analysis export pipeline', () => {
  let click
  let originalRaf
  let originalCreateObjectURL
  let originalRevokeObjectURL
  let dimensionDescriptors

  beforeEach(() => {
    vi.useFakeTimers()
    toBlob.mockReset()
    toBlob.mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = (callback) => { callback(0); return 1 }
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:export')
    URL.revokeObjectURL = vi.fn()

    dimensionDescriptors = Object.fromEntries(
      ['offsetWidth', 'scrollWidth', 'offsetHeight', 'scrollHeight'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(HTMLElement.prototype, key),
      ])
    )
    Object.defineProperties(HTMLElement.prototype, {
      offsetWidth: {
        configurable: true,
        get() { return Number.parseFloat(this.style.width) || 1200 },
      },
      scrollWidth: {
        configurable: true,
        get() {
          const requested = Number(this.querySelector?.('[data-export-width]')?.getAttribute('data-export-width')) || 0
          return Math.max(Number.parseFloat(this.style.width) || 1200, requested)
        },
      },
      offsetHeight: { configurable: true, get() { return 500 } },
      scrollHeight: { configurable: true, get() { return 500 } },
    })
  })

  afterEach(() => {
    click.mockRestore()
    globalThis.requestAnimationFrame = originalRaf
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    for (const [key, descriptor] of Object.entries(dimensionDescriptors)) {
      if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor)
      else delete HTMLElement.prototype[key]
    }
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('captures only the declared complete figure at a stable print width', async () => {
    const card = document.createElement('section')
    card.innerHTML = `
      <header>Visual toolbar</header>
      <div data-export-root>
        <p>Complete figure</p>
        <p data-export-exclude>Interactive-only control</p>
        <svg data-export-width="1990.3"></svg>
      </div>
    `
    document.body.appendChild(card)

    await exportAnalysisCard(card, { name: 'Paper figure', format: 'png' })

    expect(toBlob).toHaveBeenCalledOnce()
    const [frame, options] = toBlob.mock.calls[0]
    expect(frame.classList.contains('exporting')).toBe(true)
    expect(frame.textContent).toContain('Complete figure')
    expect(frame.textContent).not.toContain('Visual toolbar')
    expect(frame.textContent).not.toContain('Interactive-only control')
    expect(frame.querySelector('svg').style.width).toBe('1990.3px')
    expect(options.width).toBeGreaterThanOrEqual(1990)
    expect(options.pixelRatio).toBe(3)
    expect(options.backgroundColor).toBe('#ffffff')
    expect(document.querySelector('.analysis-card.exporting')).toBeNull()
    expect(click).toHaveBeenCalledOnce()
  })

  it('caps raster dimensions for unusually tall complete figures', () => {
    expect(exportPixelRatio(1200, 800)).toBe(3)
    const ratio = exportPixelRatio(1200, 10000)
    expect(ratio).toBeLessThan(3)
    expect(ratio * 10000).toBeLessThanOrEqual(16384)
  })

  it('keeps Blob URLs alive until the browser has claimed the download', () => {
    downloadBlob(new Blob(['file']), 'figure.png')

    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export')
  })
})
