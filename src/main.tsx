import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { queryClient, queryPersistOptions } from '@/data/queryClient'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { installGlobalErrorReporting } from '@/lib/errorReporting'

installGlobalErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
        <App />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
