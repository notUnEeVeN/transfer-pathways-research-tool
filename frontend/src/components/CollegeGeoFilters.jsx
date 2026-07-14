import React, { useMemo } from 'react'
import { Select } from './ui'
import { geoOptions, hasActiveGeo } from '../shared/lib/collegeGeo'

// Region / District / County filter for the community-college lists.
// Controlled: `value` is { region, district, county } (empty string = unset).
// Options cascade — the district list is limited to the chosen region and the
// county list to the chosen region + district — and picking a coarser level
// drops any finer selection it invalidates. Renders as a horizontal, wrapping
// row of equal-width selects, so it spreads across the width it's given.
export const EMPTY_GEO = { region: '', district: '', county: '' }

const ALL = (noun) => ({ value: '', label: `All ${noun}` })
const asOpts = (noun, list) => [ALL(noun), ...list.map((o) => ({ value: o, label: o }))]

export default function CollegeGeoFilters({ colleges = [], value, onChange, className = '' }) {
  const options = useMemo(() => geoOptions(colleges, value), [colleges, value])

  // Set one level, then drop any finer selection the new value no longer allows
  // (region → district → county), so every dropdown only offers valid choices.
  const set = (key) => (v) => {
    const next = { ...value, [key]: v }
    if (!geoOptions(colleges, { region: next.region }).districts.includes(next.district)) next.district = ''
    if (!geoOptions(colleges, { region: next.region, district: next.district }).counties.includes(next.county)) next.county = ''
    onChange(next)
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {[
        ['region', 'regions', options.regions],
        ['district', 'districts', options.districts],
        ['county', 'counties', options.counties],
      ].map(([key, noun, list]) => (
        <Select key={key} pill className='min-w-[8.5rem] flex-1' value={value[key]} onChange={set(key)}
          options={asOpts(noun, list)} placeholder={`All ${noun}`} />
      ))}
      {hasActiveGeo(value) && (
        <button type='button' onClick={() => onChange(EMPTY_GEO)}
          className='text-caption text-ink-subtle hover:text-ink underline underline-offset-2 whitespace-nowrap px-1'>
          Clear
        </button>
      )}
    </div>
  )
}
