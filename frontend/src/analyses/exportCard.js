/**
 * Export a live analysis card as a figure file for LaTeX/Overleaf.
 *
 * The live analyses are DOM renders (HTML tables), not SVG, so the export is a
 * high-resolution raster capture: PNG at 3× (≈300 DPI at print column width),
 * or that capture wrapped in a single-page PDF sized exactly to the figure —
 * both drop straight into \includegraphics{}.
 *
 * The capture NEVER touches the on-screen card. It deep-clones the card into
 * an off-screen staging element, restyles the CLONE as a print figure (the
 * `.exporting` rules in console.css: chrome removed, scroll clips lifted,
 * shrink-wrapped, thin even margin, fixed print cell size for the paper
 * matrix), rasterizes it, and removes the stage — the visible page never
 * shifts or reflows.
 *
 * html-to-image and jspdf are imported lazily so they stay out of the main
 * bundle — they load on the first export click.
 */
export async function exportAnalysisCard(node, { name, format }) {
  const { toPng } = await import('html-to-image')

  // Off-screen stage: rendered (so layout/measure work) but invisible and out
  // of the viewport. Generous width so the clone's fit-content resolves to its
  // natural print size instead of being capped by the user's window.
  const stage = document.createElement('div')
  stage.style.cssText =
    'position:fixed;top:0;left:-100000px;width:3000px;z-index:-1;pointer-events:none;'
  const clone = node.cloneNode(true)
  clone.classList.add('exporting')
  // Non-figure chrome (header, controls, stat strips) is removed outright from
  // the copy — the file reads as a paper figure, and the measured size IS the
  // output size (no blank bands).
  clone.querySelectorAll('[data-export-exclude]').forEach((el) => el.remove())
  stage.appendChild(clone)
  document.body.appendChild(stage)

  try {
    const width = Math.max(clone.offsetWidth, clone.scrollWidth)
    const height = Math.max(clone.offsetHeight, clone.scrollHeight)
    const backgroundColor = getComputedStyle(clone).backgroundColor || '#ffffff'
    const dataUrl = await toPng(clone, {
      pixelRatio: 3,
      backgroundColor,
      width,
      height,
      style: { width: `${width}px`, maxWidth: 'none' },
    })

    if (format === 'png') {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${name}.png`
      a.click()
      return
    }

    // PDF: one page exactly the figure's size (CSS px → pt at 0.75).
    const { jsPDF } = await import('jspdf')
    const wPt = width * 0.75
    const hPt = height * 0.75
    const pdf = new jsPDF({
      orientation: wPt >= hPt ? 'landscape' : 'portrait',
      unit: 'pt',
      format: [wPt, hPt],
    })
    pdf.addImage(dataUrl, 'PNG', 0, 0, wPt, hPt)
    pdf.save(`${name}.pdf`)
  } finally {
    stage.remove()
  }
}
