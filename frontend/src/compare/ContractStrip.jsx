import React from 'react'

const readable = (key) => String(key).replaceAll('_', ' ').replaceAll('-', ' ')
const show = (value) => {
  if (value === true) return 'yes'
  if (value === false) return 'no'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

/** The compact methodology receipt that stays beside every comparison pane. */
export default function ContractStrip({ contract }) {
  if (!contract) {
    return <p className='text-caption text-warning'>Comparison methodology not declared.</p>
  }
  const details = [
    ['measure', contract.measure],
    ['unit', contract.unit],
    ['grain', contract.grain],
    ...Object.entries(contract.semantics || {}),
    ...Object.entries(contract.context || {}),
  ].filter(([, item]) => item != null && item !== '')
  return (
    <dl className='flex flex-wrap gap-x-2 gap-y-1 text-caption text-ink-muted'
      aria-label='Comparison methodology'>
      {details.map(([key, item], index) => (
        <React.Fragment key={`${key}:${index}`}>
          {index > 0 && <span aria-hidden='true'>·</span>}
          <div className='inline-flex gap-1'>
            <dt className='ink-subtle'>{readable(key)}</dt>
            <dd className='text-ink'>{show(item)}</dd>
          </div>
        </React.Fragment>
      ))}
    </dl>
  )
}
