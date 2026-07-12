import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FigureCard } from './VisualsPage'
import apiClient from '../shared/api/apiClient'

const svg = (id) => Buffer.from(`<svg id="${id}"/>`).toString('base64')

const figure = {
  slug: 'paper-figure',
  title: 'Paper figure',
  author_uid: 'u1',
  author_label: 'Researcher',
  default_variant: 'current',
  controls: [
    {
      key: 'version', label: 'Version', type: 'select', default: 'current',
      options: [
        { value: 'paper', label: 'Paper baseline' },
        { value: 'current', label: 'Current data' },
      ],
    },
    { key: 'differences', label: 'Show differences', type: 'toggle', default: false },
  ],
  variants: [
    { key: 'paper', label: 'Paper baseline', state: { version: 'paper', differences: false }, svg: svg('paper') },
    { key: 'current', label: 'Current data', state: { version: 'current', differences: false }, svg: svg('current') },
    { key: 'current-diff', label: 'Current differences', state: { version: 'current', differences: true }, svg: svg('diff') },
  ],
}

function renderCard() {
  render(<FigureCard fig={figure} canModify={false} onDelete={vi.fn()}
    deleting={false} onSave={vi.fn()} saving={false} />)
}

describe('published visual variants', () => {
  it('switches among locally rendered states without running analysis code', () => {
    renderCard()
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('current'))

    fireEvent.click(screen.getByRole('switch', { name: 'Show differences' }))
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('diff'))

    fireEvent.click(screen.getByRole('button', { name: 'Paper baseline' }))
    expect(screen.getByRole('img').getAttribute('src')).toContain(svg('paper'))
    expect(screen.getByRole('switch', { name: 'Show differences' })).toBeDisabled()
  })

  it('loads only the selected authenticated SVG when list metadata has no files', async () => {
    const request = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['<svg id="current"/>'], { type: 'image/svg+xml' }),
    })
    const metadataOnly = {
      ...figure,
      variants: figure.variants.map(({ svg: _svg, ...variant }) => variant),
    }
    render(<FigureCard fig={metadataOnly} canModify={false} onDelete={vi.fn()}
      deleting={false} onSave={vi.fn()} saving={false} />)

    await waitFor(() => expect(screen.getByRole('img')).toBeTruthy())
    expect(request).toHaveBeenCalledWith(
      '/gallery/paper-figure/variants/current/svg',
      { responseType: 'blob' }
    )
    request.mockRestore()
  })
})
