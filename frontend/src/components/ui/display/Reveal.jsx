import { motion, useReducedMotion } from 'framer-motion'

/**
 * Reveal — the signature "unblur". Content resolves from a soft blur + faint
 * rise into sharp focus the first time it scrolls into view. Used page-wide
 * across the marketing pages (and available to the dashboard) so the whole
 * product feels like it's coming into focus as you read.
 *
 * The reveal fires once and stays settled. Honors prefers-reduced-motion by
 * rendering a plain element with no animation (and no blur — never leave reduced
 * users staring at a blurred element).
 *
 * Props:
 *   as        — element/tag to render ('div' | 'section' | 'li' | …). Default 'div'.
 *   delay     — seconds to stagger this reveal after its neighbours. Default 0.
 *   y         — px to rise from. Default 10.
 *   blur      — px of blur to resolve from. Default 12.
 *   duration  — seconds. Default 0.7.
 *   once      — reveal a single time. Default true.
 *   className — merged onto the element.
 */
export default function Reveal({
  as = 'div',
  delay = 0,
  y = 10,
  blur = 12,
  duration = 0.7,
  once = true,
  className = '',
  children,
  ...rest
}) {
  const reduce = useReducedMotion()

  if (reduce) {
    const As = as
    return (
      <As className={className} {...rest}>
        {children}
      </As>
    )
  }

  const Tag = motion[as] || motion.div
  return (
    <Tag
      initial={{ opacity: 0, filter: `blur(${blur}px)`, y }}
      whileInView={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      // Fire when the element is ~20% up from the bottom (not as it first peeks in) so the
      // unblur plays in the reading zone — at -10% a slow scroll finished it before you looked.
      viewport={{ once, margin: '0px 0px -20% 0px' }}
      transition={{ duration, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  )
}
