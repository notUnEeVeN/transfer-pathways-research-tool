/**
 * LoadingLogo — the app's default loader: a skeleton of the brand mark.
 *
 * The logo silhouette (masked from /logo.svg) is filled with skeleton gray and
 * pulses, matching the list skeletons used elsewhere (e.g. MajorList) rather
 * than a spinner. Theme-aware via the border-strong token. `role=status` gives
 * it an accessible name since there's no visible "loading" text.
 */
export default function LoadingLogo({ size = 64, className = '' }) {
  return (
    <div
      role='status'
      aria-label='Loading'
      className={`animate-pulse bg-border-strong ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: 'url(/logo.svg)',
        maskImage: 'url(/logo.svg)',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain'
      }}
    />
  )
}
