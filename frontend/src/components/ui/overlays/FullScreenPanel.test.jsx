import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import FullScreenPanel from './FullScreenPanel'

it('lets visual content own the only visible identity header', () => {
  window.scrollTo = vi.fn()

  render(
    <FullScreenPanel open onClose={vi.fn()} title='One visual title'
      subtitle='Author · date' contentOwnsHeader>
      <section>
        <h2>One visual title</h2>
        <p>Author · date · Computer Science (CA)</p>
      </section>
    </FullScreenPanel>
  )

  expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'One visual title')
  expect(screen.getAllByText('One visual title')).toHaveLength(1)
  expect(screen.queryByText('Author · date')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
})
