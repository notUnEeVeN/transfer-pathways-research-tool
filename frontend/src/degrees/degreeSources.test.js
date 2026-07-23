import { describe, expect, it } from 'vitest'
import { degreeSourcesFor } from './degreeSources'

describe('degree verification sources', () => {
  it('keeps the historical CS campus source map', () => {
    const sources = degreeSourcesFor({ school_id: 79, major_slug: 'cs' })
    expect(sources[0].label).toMatch(/EECS/)
  })

  it('does not give another major the CS sources from the same campus', () => {
    const sources = degreeSourcesFor({
      school_id: 79,
      major_slug: 'bio',
      sources: [{
        kind: 'major',
        label: 'MCB major requirements',
        url: 'https://undergraduate.catalog.berkeley.edu/mcb',
        note: 'Major-specific course list.',
      }],
    })
    expect(sources).toEqual([{
      label: 'MCB major requirements',
      url: 'https://undergraduate.catalog.berkeley.edu/mcb',
      note: 'Major-specific course list.',
    }])
    expect(sources[0].label).not.toMatch(/EECS/)
  })

  it('falls back to the primary URL for an older dimensional document', () => {
    expect(degreeSourcesFor({
      school_id: 89,
      major_slug: 'econ',
      source_url: 'https://catalog.ucdavis.edu/economics-ab/',
    })).toEqual([{
      label: 'Source',
      url: 'https://catalog.ucdavis.edu/economics-ab/',
      note: null,
    }])
  })
})
