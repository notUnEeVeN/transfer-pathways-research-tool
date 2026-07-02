/**
 * Decide where an anchored popup should open relative to its trigger, given the
 * trigger's rect and the viewport height. Prefers opening downward; flips up
 * only when there isn't room below for the preferred height *and* there's more
 * room above. `maxHeight` is clamped to the chosen side's free space (capped at
 * `preferred`) so a long list scrolls internally instead of bleeding off-screen.
 *
 * Shared by Select and Combobox, which both anchor a fixed portal popup beneath
 * their trigger via useAnchoredRect. `gap` is the offset between trigger and
 * popup; `margin` keeps the popup off the viewport edge.
 */
export function computePopupPlacement({ rect, viewportHeight, preferred = 256, gap = 4, margin = 8 }) {
  const spaceBelow = viewportHeight - rect.bottom - gap - margin
  const spaceAbove = rect.top - gap - margin
  const placeAbove = spaceBelow < preferred && spaceAbove > spaceBelow
  const maxHeight = Math.max(0, Math.min(preferred, placeAbove ? spaceAbove : spaceBelow))
  return { placeAbove, maxHeight }
}
