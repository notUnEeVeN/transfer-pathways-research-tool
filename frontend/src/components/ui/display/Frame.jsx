/**
 * Frame — seats a product screenshot inside a calm app-window chrome: rounded
 * surface, warm hairline, soft elevation, and (optionally) three monochrome
 * traffic-light dots. Ties every marketing screenshot together as a consistent
 * "product window" without the literal red/yellow/green that would shout against
 * the warm, quiet palette.
 *
 * The image (or any node) is passed as children; the frame clips it to the
 * rounded corners. Pair with <Reveal> for the unblur-on-scroll entrance.
 *
 * Props:
 *   dots      — show the window dots bar. Default true.
 *   label     — optional faint caption shown centered in the chrome bar.
 *   shadow    — lift the window with a soft drop shadow. Default true.
 *   className — merged onto the outer window.
 *   bodyClassName — merged onto the clipped body that holds children.
 */
export default function Frame({ dots = true, label, shadow = true, className = '', bodyClassName = '', children, ...rest }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-border bg-surface ${shadow ? 'shadow-lg' : ''} ${className}`}
      {...rest}
    >
      {dots && (
        <div className='flex h-9 items-center gap-1.5 border-b border-border px-4'>
          <span className='h-2.5 w-2.5 rounded-full bg-border-strong' />
          <span className='h-2.5 w-2.5 rounded-full bg-border-strong' />
          <span className='h-2.5 w-2.5 rounded-full bg-border-strong' />
          {label && <span className='ml-3 text-tag text-ink-subtle'>{label}</span>}
        </div>
      )}
      <div className={`overflow-hidden ${bodyClassName}`}>{children}</div>
    </div>
  )
}
