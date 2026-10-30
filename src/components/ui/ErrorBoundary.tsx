import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { reportError } from '@/lib/errorReporting'

type Props = { children: ReactNode; /** Pantalla completa (fallo de toda la app) o dentro del layout. */ fullScreen?: boolean }
type State = { error: Error | null }

/**
 * Si una pantalla falla al dibujarse, muestra un aviso con «Reintentar» en vez de dejar la app
 * en blanco, y registra el error. Se reinicia solo al navegar (se usa con `key` = ruta).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const withStack = new Error(error.message)
    withStack.stack = `${error.stack ?? ''}\n\nComponentes:${info.componentStack ?? ''}`
    void reportError(withStack, 'render')
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={this.props.fullScreen ? 'flex min-h-screen items-center justify-center bg-surface-base p-6' : 'flex flex-1 items-center justify-center p-6'}>
        <div className="hh-alert hh-alert-danger flex max-w-md flex-col items-start gap-3 rounded-2xl p-5">
          <span className="hh-alert-icon h-9 w-9" aria-hidden>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-ink-primary">Algo falló en esta pantalla</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Ya quedó registrado. Probá de nuevo; si sigue pasando, avisanos qué estabas haciendo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-3 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90"
            >
              <RotateCcw className="h-4 w-4" /> Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/dashboard')}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm font-medium text-ink-secondary hover:text-ink-primary"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    )
  }
}
