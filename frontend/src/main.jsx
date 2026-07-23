import React from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ToastProvider } from './components/ui'
import { AuthProvider } from '@frontend/hooks/AuthProvider'
import { MajorProvider } from './shared/majors/MajorContext'
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
      buster: `research-console-${packagejson.version}-audit-stats-v2-access-gate-v1-majors-v2`,
      dehydrateOptions: {
        // NEVER persist the access check (the security gate) or the majors
        // config. Both describe what the SERVER currently allows; a rehydrated
        // copy silently misreports it — a stale majors payload hides newly
        // onboarded majors and misstates their capabilities.
        shouldDehydrateQuery: (query) =>
          query.state.status === 'success'
          && !['access-me', 'majors'].includes(query.queryKey?.[0]),
      },
    }}
  >
    <ToastProvider>
      <AuthProvider>
        {/* Below AuthProvider: the majors read is user-scoped, so it only
            fires once someone is signed in. */}
        <MajorProvider>
          <App />
        </MajorProvider>
      </AuthProvider>
    </ToastProvider>
  </PersistQueryClientProvider>
)
