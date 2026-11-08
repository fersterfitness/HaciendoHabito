import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import './index.css'
import App from './App.tsx'
import { queryClient, queryPersistOptions } from '@/data/queryClient'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { installGlobalErrorReporting } from '@/lib/errorReporting'
import { reloadOnceForNewVersion } from '@/lib/chunkReload'
// Decide la versión de la interfaz (y limpia links viejos con /v2) antes de que arranque el router.
import '@/lib/uiVersion'

installGlobalErrorReporting()
// Vite avisa cuando no puede bajar el código de una pantalla (deploy nuevo): recargar lo resuelve.
window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForNewVersion()) event.preventDefault()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fullScreen>
      <PersistQueryClientProvider client={queryClient} persistOptions={queryPersistOptions}>
        <App />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
