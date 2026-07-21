import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// Global chrome test (Task 5): the forest top bar + nav track that wraps
// every view. Mocks follow the idiom in InstitutionRail.test.jsx /
// DataApiDocs.test.jsx — hook modules are replaced wholesale so the console
// renders past the auth/access gate without a real Firebase or API call, and
// the per-view pages are stubbed so this test only exercises the chrome
// (Console + the gate — not DataPage/VisualsPage/etc, which own their own
// tests).

vi.mock('@frontend/lib/firebase', () => ({ auth: {} }))

vi.mock('@frontend/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'researcher@example.edu', uid: 'test-uid' }, loading: false }),
}))

vi.mock('@frontend/query/hooks/useAccess', () => ({
  useAccessMe: () => ({ data: { role: 'admin' }, isPending: false, isError: false }),
  useRequestAccess: () => ({ mutate: vi.fn(), data: undefined }),
}))

vi.mock('@frontend/query/hooks/useAudit', () => ({
  useAuditBootstrap: () => ({ data: undefined, isLoading: false }),
  useAuditNext: () => ({ data: undefined, isLoading: false, isError: false }),
  useVerifyDoc: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAuditTemplateVariants: () => ({ data: undefined, isLoading: false, isError: false }),
  useAuditDoc: () => ({ data: undefined, isLoading: false, isError: false }),
  filterToParams: (filter) => filter,
}))

vi.mock('./DataPage', () => ({ default: () => <div>Data page stub</div> }))
vi.mock('./showcase/ShowcasePage', () => ({ default: () => <div>Showcase page stub</div> }))
vi.mock('./visuals/VisualsPage', () => ({ default: () => <div>Visuals page stub</div> }))
vi.mock('./DataApiDocs', () => ({ default: () => <div>API page stub</div> }))
vi.mock('./tasks/TasksPage', () => ({ default: () => <div>Tasks page stub</div> }))
vi.mock('./AdminPage', () => ({ default: () => <div>Admin page stub</div> }))

import App from './App'

describe('App chrome', () => {
  it('renders the forest top bar: nav track, identity, and eyebrow', () => {
    render(<App />)

    // Eyebrow only exists in the new forest bar — absent from the old
    // 48px header entirely.
    expect(screen.getByText('Research console')).toBeInTheDocument()

    // The top nav now carries proper tab semantics: each nav pill has
    // role="tab" and aria-selected (the accessibility fix).
    for (const label of ['Data', 'Showcase', 'Visuals', 'Audit', 'Tasks', 'API', 'Admin']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }

    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.getByText('researcher@example.edu')).toBeInTheDocument()
  })
})
