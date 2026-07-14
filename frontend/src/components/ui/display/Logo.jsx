import { useId } from 'react';

/**
 * Transfer Pathways Research — logomark.
 * Drop-in replacement for frontend/src/components/ui/display/Logo.jsx.
 *
 * Five identical "petal" shapes rotated about a shared center (per the brand
 * deck's construction). Fills with currentColor so it themes automatically:
 *   - forest top bar: color = var(--color-accent)  (lime)
 *   - light surfaces: color = var(--color-primary) (forest)
 *
 * Mark aspect ratio is 352 : 215 (w : h).
 */
export function Logo({ size = 22, title = 'Transfer Pathways Research', className, ...props }) {
  const petalId = useId(); // collision-safe when several logos render on one page
  const width = Math.round((size * 352) / 215);
  return (
    <svg
      width={width}
      height={size}
      viewBox="-176 -176 352 215"
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
      {...props}
    >
      <path
        id={petalId}
        d="M -36 -106 L -36 -171 Q -36 -173 -32 -173 A 43.6 43.6 0 0 0 32 -173 Q 36 -173 36 -171 L 36 -106 A 36 36 0 0 1 -36 -106 Z"
      />
      <use href={`#${petalId}`} transform="rotate(45)" />
      <use href={`#${petalId}`} transform="rotate(-45)" />
      <use href={`#${petalId}`} transform="rotate(90)" />
      <use href={`#${petalId}`} transform="rotate(-90)" />
    </svg>
  );
}

/**
 * Full lockup for the top bar: mark + two-line lowercase wordmark.
 * Wordmark: "transfer" (400) over "pathways" (700), 12px / 1.06.
 * On the forest bar wrap with: color: var(--color-accent) for the mark and
 * var(--color-on-primary) for the wordmark text.
 */
export function LogoLockup({ markSize = 21 }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <Logo size={markSize} />
      <span style={{ display: 'flex', flexDirection: 'column', fontSize: 12, lineHeight: 1.06, letterSpacing: '.01em' }}>
        <span style={{ fontWeight: 400 }}>transfer</span>
        <span style={{ fontWeight: 700 }}>pathways</span>
      </span>
    </span>
  );
}

export default Logo;
