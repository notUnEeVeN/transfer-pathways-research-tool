import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CellSource from './CellSource'

const contract = 'va-analysis-publication-receipt-v1'
const pane = { id: 'p1', figure: 'transfer-credit-rate', major: 'va-cs', knobs: {} }

function major(ready) {
  return {
    slug: 'va-cs',
    label: 'Computer Science (VA)',
    state: 'va',
    capabilities: { degreeTemplates: true },
    publicationGate: { contract },
    analysisPublication: {
      ready,
      contract,
      major_slug: 'va-cs',
      generation_id: ready ? 'generation-1' : null,
    },
  }
}

function analysis(useData, cells) {
  return {
    id: 'transfer-credit-rate',
    majorScope: {
      mode: 'selected',
      requiredCapabilities: ['degreeTemplates'],
    },
    comparable: { useData, cells },
  }
}

describe('CellSource publication revocation', () => {
  it('does not report cached Virginia cells when the receipt is unavailable', async () => {
    const cached = { rows: [{ value: 91 }] }
    const useData = vi.fn(() => ({ data: cached, isLoading: false, isError: false }))
    const cells = vi.fn(() => [{ key: 'old-cell', value: 91 }])
    const onCells = vi.fn()

    render(<CellSource pane={pane} analysis={analysis(useData, cells)}
      major={major(false)} onCells={onCells} />)

    await waitFor(() => expect(onCells).toHaveBeenLastCalledWith('p1', {
      status: 'unavailable',
      cells: [],
    }))
    expect(useData).toHaveBeenCalledWith(pane, expect.objectContaining({ slug: 'va-cs' }), {
      enabled: false,
    })
    expect(cells).not.toHaveBeenCalled()
  })

  it('clears a previously reported cell set as soon as the receipt is revoked', async () => {
    const useData = vi.fn(() => ({
      data: { rows: [{ value: 91 }] }, isLoading: false, isError: false,
    }))
    const cells = vi.fn(() => [{ key: 'cell', value: 91 }])
    const onCells = vi.fn()
    const entry = analysis(useData, cells)
    const rendered = render(<CellSource pane={pane} analysis={entry}
      major={major(true)} onCells={onCells} />)

    await waitFor(() => expect(onCells).toHaveBeenLastCalledWith('p1', {
      status: 'ready',
      cells: [{ key: 'cell', value: 91 }],
    }))

    rendered.rerender(<CellSource pane={pane} analysis={entry}
      major={major(false)} onCells={onCells} />)

    await waitFor(() => expect(onCells).toHaveBeenLastCalledWith('p1', {
      status: 'unavailable',
      cells: [],
    }))
    expect(useData).toHaveBeenLastCalledWith(pane, expect.objectContaining({ slug: 'va-cs' }), {
      enabled: false,
    })
    expect(cells).toHaveBeenCalledTimes(1)
  })
})
