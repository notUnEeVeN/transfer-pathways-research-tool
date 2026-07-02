import { useLayoutEffect, useState } from 'react'

/**
 * Tracks the bounding rect of `anchorRef`'s element while `open` is true,
 * re-measuring on resize and scroll (capture phase, so nested scroll
 * containers count). Returns the latest DOMRect, or null when closed /
 * not yet measured. Used to position a fixed portal popup beneath the
 * anchor (shared by Select and Combobox).
 */
export function useAnchoredRect(anchorRef, open) {
  const [rect, setRect] = useState(null)
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const update = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])
  return rect
}
