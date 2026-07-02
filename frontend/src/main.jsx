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
      // entries from other PMT apps sharing the same IndexedDB.
      maxAge: 24 * 60 * 60 * 1000,
      buster: `research-console-${packagejson.version}`,
    }}
  >
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </PersistQueryClientProvider>
)
