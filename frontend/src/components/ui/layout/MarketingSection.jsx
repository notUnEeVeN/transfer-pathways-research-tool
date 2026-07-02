import { forwardRef } from 'react'

/**
 * MarketingSection — the marketing-page frame primitive. A full-bleed <section>
 * (so backgrounds, gradients, and marquees can run edge to edge) with a centered
 * inner container that owns the horizontal gutter and max-width.
 *
 * Marketing runs on its own generous vertical rhythm — much airier than the
 * dashboard's tight 4px scale — applied here as a standard band. Sections that
 * need a bespoke vertical (the hero's min-height, the dome's deep bottom) pass
 * `band={false}` and set their own py via `containerClassName` (no competing
 * padding class to fight Tailwind's source order).
 *
 * This is the marketing counterpart to the app's <PageContainer>; it does NOT
 * replace PageContainer inside the authenticated dashboard.
 *
 * Props:
 *   as              — section tag. Default 'section'.
 *   width           — 'wide' (max-w-7xl, default) | 'narrow' (max-w-6xl) | 'full' (none).
 *   band            — apply the standard marketing vertical band. Default true.
 *   bg              — full-bleed background layer (aurora, dome, waves) rendered
 *                     edge-to-edge BEHIND the centered container. Pair with
 *                     `overflow-hidden`/`overflow-x-clip` in className to contain it.
 *   className       — on the outer <section> (bg, overflow, hairline).
 *   containerClassName — on the inner container (custom padding, relative, etc.).
 *
 * Forwards its ref to the outer element so scroll-driven sections (the dome, the
 * waves) can use it as a framer useScroll target.
 */
const MarketingSection = forwardRef(function MarketingSection(
  { as: Tag = 'section', width = 'wide', band = true, bg = null, className = '', containerClassName = '', children, ...rest },
  ref
) {
  const max = width === 'narrow' ? 'max-w-6xl' : width === 'full' ? '' : 'max-w-7xl'
  const bandY = band ? 'py-20 sm:py-28 lg:py-32' : ''
  return (
    <Tag ref={ref} className={`relative ${className}`} {...rest}>
      {bg}
      <div className={`relative mx-auto w-full px-5 sm:px-6 lg:px-8 ${max} ${bandY} ${containerClassName}`}>
        {children}
      </div>
    </Tag>
  )
})

export default MarketingSection
