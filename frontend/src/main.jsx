import React from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ToastProvider } from './components/ui'
import { AuthProvider } from '@frontend/hooks/AuthProvider'
import { queryClient, queryPersister } from '@frontend/query/client'
import App from './App.jsx'
import packagejson from '../package.json'
import './styles/console.css'

createRoot(document.getElementById('root')).render(
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      // 24 h max — older entries get dropped on rehydrate. The buster is
      // namespaced to this console so it never rehydrates foreign-shaped
      // entries from other PMT apps sharing the same IndexedDB. Bumped to
      // access-gate-v1 to drop any pre-existing persisted /access/me result —
      // a stale "granted" from before a revoke would otherwise let a removed
      // account render the console from cache instead of hitting the gate.
      maxAge: 24 * 60 * 60 * 1000,
      buster: `research-console-${packagejson.version}-audit-stats-v2-access-gate-v1`,
      // NEVER persist the access check. It is the security gate: it must be
      // re-verified against the server on every load, never rehydrated from
      // IndexedDB. Everything else still persists for instant first paint.
      dehydrateOptions: {
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success' && query.queryKey?.[0] !== 'access-me',
      },
    }}
  >
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </PersistQueryClientProvider>
)
