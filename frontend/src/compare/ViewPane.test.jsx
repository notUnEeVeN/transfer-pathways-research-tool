import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// A stand-in for an adopted figure: a default* prop seeds its control, and a
// useEffect reports the current value back — exactly the contract the six MA
// figures implement.
vi.mock('../visuals/VisualsPage', async () => {
  const React_ = (await import('react')).default
  return {
    BuiltInAnalysisCard: ({ componentProps }) => {
      const [rows, setRows] = React_.useState(componentProps.defaultRowMode)
      const report = componentProps.onViewChange
      React_.useEffect(() => { report?.({ defaultRowMode: rows }) }, [rows, report])
      return React_.createElement('div', null,
        React_.createElement('span', { 'data-testid': 'showing' }, rows),
        React_.createElement('button', { onClick: () => setRows('county') }, 'pick county'))
    },
    itemDetails: (item) => ({ title: item.analysis.title }),
  }
})

vi.mock('../visuals/analysisAvailability', () => ({
  resolveAnalysisAvailability: () => ({ available: true, effectiveMajorSlug: 'cs' }),
}))

const ANALYSIS = {
  id: 'coverage-heatmap',
  title: 'Coverage',
  viewKnobs: [{
    key: 'rows', label: 'Rows', type: 'select', prop: 'defaultRowMode', default: 'college',
    options: [{ value: 'college', label: 'Colleges' }, { value: 'district', label: 'Districts' }],
  }],
}
const MAJOR = { slug: 'cs', label: 'Computer Science', capabilities: {} }

const { default: ViewPane } = await import('./ViewPane')

const paneWith = (rows) => ({
  id: 'p1', figure: 'coverage-heatmap', major: 'cs', knobs: { rows }, label: null,
})

describe('ViewPane control seeding', () => {
  it('re-seeds the figure when a pinned control is changed from outside', () => {
    const { rerender } = render(
      <ViewPane pane={paneWith('college')} major={MAJOR} analysis={ANALYSIS} onChange={() => {}} />
    )
    expect(screen.getByTestId('showing')).toHaveTextContent('college')

    // An edit made in the pane builder, not by the figure.
    rerender(
      <ViewPane pane={paneWith('district')} major={MAJOR} analysis={ANALYSIS} onChange={() => {}} />
    )
    expect(screen.getByTestId('showing')).toHaveTextContent('district')
  })

  // The figure owns its controls while mounted. Re-seeding on its own report
  // would throw away the state it just reported and refetch under the reader.
  it('does not remount when the change came from the figure itself', () => {
    const onViewChange = vi.fn()
    const { rerender } = render(
      <ViewPane pane={paneWith('college')} major={MAJOR} analysis={ANALYSIS}
        onChange={() => {}} onViewChange={onViewChange} />
    )

    fireEvent.click(screen.getByText('pick county'))
    expect(onViewChange).toHaveBeenLastCalledWith({ defaultRowMode: 'county' })
    expect(screen.getByTestId('showing')).toHaveTextContent('county')

    // The workspace mirrors that report back onto the pane. The figure must
    // keep its own state rather than being reset to the echo.
    rerender(
      <ViewPane pane={paneWith('county')} major={MAJOR} analysis={ANALYSIS}
        onChange={() => {}} onViewChange={onViewChange} />
    )
    expect(screen.getByTestId('showing')).toHaveTextContent('county')
  })
})
