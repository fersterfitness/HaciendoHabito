import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { queryClient, queryPersistOptions } from '@/data/queryClient'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { installGlobalErrorReporting } from '@/lib/errorReporting'
import { applyPreferredUiVersion } from '@/lib/uiVersion'

installGlobalErrorReporting()

// Limpia la preferencia vieja de versión; la dirección (/v2 o no) decide cuál se ve.
if (!applyPreferredUiVersion()) createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
        <App />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
