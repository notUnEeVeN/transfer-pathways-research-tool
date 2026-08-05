import React from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ToastProvider } from './components/ui'
import { AuthProvider } from '@frontend/hooks/AuthProvider'
import { MajorProvider } from './shared/majors/MajorContext'
import { queryClient, queryPersister, shouldPersistQuery } from '@frontend/query/client'
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
      // Bumped to va-v2 when the Virginia degrees were re-scraped: every
      // Virginia document changed shape from one flat "Requirements" group to
      // real requirement groups, and a persisted response outlives the import
      // by up to 24 h. Without the bump the console keeps painting the old
      // flat degrees from IndexedDB and the new data looks like it never
      // landed. Bump this whenever a dataset is rewritten underneath it.
      maxAge: 24 * 60 * 60 * 1000,
      // va-v3: the coverage response gained per-institution documents and
      // verification state for the overview worklist. A persisted v2 payload
      // has neither, so the worklist would rehydrate empty.
      // degrees-v2: the UC degree templates were rebuilt (Berkeley MCB and
      // Economics unit budgets, course_level vocabulary). A persisted response
      // predates all of it and would paint the old units.
      // degrees-v3: alternative (Or) requirement groups now cost one path
      // instead of one per alternative, and Berkeley's L&S general education
      // declares the IGETC areas behind it. Every cached coverage percentage
      // predates both and would keep painting the old, far-too-low numbers.
      // uc-prereqs-v1: /curated/prerequisites gained campus filtering and now
      // answers with { rows, total } rather than every row in the collection. A
      // persisted response predates both and would rehydrate the whole corpus.
      buster: `research-console-${packagejson.version}-audit-stats-v2-access-gate-v1-majors-v2-analysis-v3-va-v3-degrees-v3-uc-prereqs-v1`,
      dehydrateOptions: {
        // Security/config state and computed analyses must always come from
        // the current server. Catalog/source records still hydrate instantly.
        shouldDehydrateQuery: shouldPersistQuery,
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
