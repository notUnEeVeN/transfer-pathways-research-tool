/**
 * Export one live analysis as a publication-ready PNG or PDF.
 *
 * Analyses can mark their complete figure with `data-export-root`. We clone
 * that figure into a white, fixed-width print frame, expand on-screen scroll
 * containers, wait for fonts and layout, and capture at up to 3x resolution.
 * Wide tables can grow beyond the default frame; individual vector figures
 * can request a native CSS width with `data-export-width`.
 */

const DEFAULT_EXPORT_WIDTH = 1200
const TARGET_PIXEL_RATIO = 3
const MAX_CANVAS_DIMENSION = 16384
const MAX_CANVAS_PIXELS = 64_000_000

function nextFrame() {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()))
  }
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function waitForFonts() {
  if (!document.fonts?.ready) return
  // A broken local font request must not leave the export button spinning
  // forever. The capture can safely fall back to the already-painted face.
  await Promise.race([
    document.fonts.ready.catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ])
}

function measuredSize(node) {
  const rect = node.getBoundingClientRect()
  return {
    width: Math.max(1, Math.ceil(node.offsetWidth || 0), Math.ceil(node.scrollWidth || 0), Math.ceil(rect.width || 0)),
    height: Math.max(1, Math.ceil(node.offsetHeight || 0), Math.ceil(node.scrollHeight || 0), Math.ceil(rect.height || 0)),
  }
}

export function exportPixelRatio(width, height) {
  const byDimension = Math.min(MAX_CANVAS_DIMENSION / width, MAX_CANVAS_DIMENSION / height)
  const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (width * height))
  return Math.max(0.5, Math.min(TARGET_PIXEL_RATIO, byDimension, byArea))
}

function safeName(value) {
  const cleaned = String(value || 'analysis')
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'analysis'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking synchronously can cancel downloads in Safari and some local-dev
  // browser configurations. Give the navigation task time to claim the Blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function blobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Could not read exported image'))
    reader.readAsDataURL(blob)
  })
}

function buildExportFrame(node) {
  const source = node.querySelector('[data-export-root]') || node
  const frame = document.createElement('section')
  frame.className = 'analysis-card exporting'
  frame.setAttribute('aria-hidden', 'true')
  frame.style.width = `${DEFAULT_EXPORT_WIDTH}px`
  frame.style.minWidth = `${DEFAULT_EXPORT_WIDTH}px`

  const content = source.cloneNode(true)
  content.querySelectorAll?.('[data-export-exclude]').forEach((element) => element.remove())
  if (content.matches?.('[data-export-exclude]')) content.removeAttribute('data-export-exclude')
  frame.appendChild(content)

  // Paper-native SVGs and future figures can opt into their intended logical
  // width without forcing every HTML table or chart to that size.
  frame.querySelectorAll('[data-export-width]').forEach((element) => {
    const width = Number(element.getAttribute('data-export-width'))
    if (!Number.isFinite(width) || width <= 0) return
    element.style.width = `${width}px`
    element.style.minWidth = `${width}px`
    element.style.maxWidth = 'none'
  })

  return frame
}

/** Export a live analysis card as a complete high-resolution figure file. */
export async function exportAnalysisCard(node, { name, format }) {
  if (!node) throw new TypeError('An analysis element is required for export')
  if (!['png', 'pdf'].includes(format)) throw new TypeError(`Unsupported export format: ${format}`)

  const { toBlob } = await import('html-to-image')
  const stage = document.createElement('div')
  stage.style.cssText =
    'position:fixed;top:0;left:-100000px;width:3200px;z-index:-1;pointer-events:none;'
  const frame = buildExportFrame(node)
  stage.appendChild(frame)
  document.body.appendChild(stage)

  try {
    await waitForFonts()
    await nextFrame()
    await nextFrame()

    // First let intrinsically wide content (notably heatmap tables and the
    // paper-native SVG) establish its width, then lock that width and measure
    // height again after wrapping has settled.
    let size = measuredSize(frame)
    frame.style.width = `${Math.max(DEFAULT_EXPORT_WIDTH, size.width)}px`
    frame.style.minWidth = frame.style.width
    await nextFrame()
    size = measuredSize(frame)

    const pixelRatio = exportPixelRatio(size.width, size.height)
    const blob = await toBlob(frame, {
      width: size.width,
      height: size.height,
      pixelRatio,
      backgroundColor: '#ffffff',
      cacheBust: true,
      preferredFontFormat: 'woff2',
      skipAutoScale: true,
      style: {
        width: `${size.width}px`,
        minWidth: `${size.width}px`,
        maxWidth: 'none',
      },
    })
    if (!blob) throw new Error('The browser could not create the exported image')

    const filename = safeName(name)
    if (format === 'png') {
      downloadBlob(blob, `${filename}.png`)
      return
    }

    const [{ jsPDF }, dataUrl] = await Promise.all([
      import('jspdf'),
      blobAsDataUrl(blob),
    ])
    const widthPt = size.width * 0.75
    const heightPt = size.height * 0.75
    const pdf = new jsPDF({
      orientation: widthPt >= heightPt ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [widthPt, heightPt],
      compress: true,
      precision: 12,
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    pdf.addImage(dataUrl, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST')
    pdf.save(`${filename}.pdf`)
  } finally {
    stage.remove()
  }
}
