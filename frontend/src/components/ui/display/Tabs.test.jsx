// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tabs from './Tabs'
import NavList from './NavList'

describe('Tabs', () => {
  it('keeps the selected tab on a primary hover background', () => {
    render(
      <Tabs
        value='audit'
        onChange={() => {}}
        options={[
          { value: 'audit', label: 'Audit' },
          { value: 'data', label: 'Data' },
        ]}
      />
    )

    const selected = screen.getByRole('tab', { name: 'Audit' })
    const inactive = screen.getByRole('tab', { name: 'Data' })

    expect(selected.className).toContain('bg-primary')
    expect(selected.className).toContain('hover:bg-primary-hover')
    expect(inactive.className).toContain('hover:bg-surface-hover')
  })
})

describe('NavList', () => {
  it('keeps the selected item on its selected hover background', () => {
    render(
      <NavList
        ariaLabel='Sections'
        selectedId='data'
        onSelect={() => {}}
        items={[
          { id: 'audit', label: 'Audit' },
          { id: 'data', label: 'Data' },
        ]}
      />
    )

    const selected = screen.getByRole('button', { name: 'Data' })
    const inactive = screen.getByRole('button', { name: 'Audit' })

    expect(selected.className).toContain('bg-primary-soft')
    expect(selected.className).toContain('hover:bg-primary-soft')
    expect(inactive.className).toContain('hover:bg-surface-hover')
  })
})
