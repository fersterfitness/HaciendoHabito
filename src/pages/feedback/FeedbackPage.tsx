import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Share2 } from 'lucide-react'
import { TrainerCheckInsPage } from '@/pages/training/TrainerCheckInsPage'
import { TrainerResourcesPage } from '@/pages/training/TrainerResourcesPage'
import { Header } from '@/components/layout/Header'
import { cn } from '@/lib/utils'

/**
 * "Formulario de consulta semanal" (antes "Devoluciones").
 *
 * Punto de aterrizaje para las respuestas que los alumnos mandan en el check-in
 * semanal. Mantiene dos sub-secciones:
 *  - Check-ins: el listado de respuestas, pestaña por defecto.
 *  - Recursos: donde viven las Plantillas de texto + los Recordatorios de envío
 *    (cards usadas para programar avisos por WhatsApp).
 *
 * La sub-sección histórica "Consultas" (`routine_questions`, con su propio flujo
 * de devolución escrita) quedó deprecada porque el trainer ahora responde por
 * WhatsApp directamente — se removió la pestaña pero las rutas legacy
 * `/feedback/new` y `/feedback/:id` siguen mapeadas en `App.tsx` para no romper
 * deep-links existentes.
 */
type MainSection = 'checkins' | 'recursos'

function mainSectionFromParams(tab: string | null): MainSection {
  if (tab === 'recursos') return 'recursos'
  return 'checkins'
}

export function FeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const mainSection = mainSectionFromParams(searchParams.get('tab'))

  const setMainSection = (next: MainSection) => {
    setSearchParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev)
        if (next === 'checkins') nextParams.delete('tab')
        else nextParams.set('tab', next)
        nextParams.delete('create')
        return nextParams
      },
      { replace: true },
    )
  }

  return (
    <div>
      <Header title="Formulario de consulta semanal" />

      <div className="px-4 lg:px-6 pt-4">
        <div
          className="flex w-full max-w-md gap-1 rounded-xl border border-surface-border bg-surface-elevated/40 p-1"
          role="tablist"
          aria-label="Sección"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'checkins'}
            onClick={() => setMainSection('checkins')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'checkins'
                ? 'border-surface-border bg-surface-card text-ink-primary shadow-sm ring-1 ring-inset ring-brand-secondary/25'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <ClipboardCheck className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Check-ins
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainSection === 'recursos'}
            onClick={() => setMainSection('recursos')}
            className={cn(
              'flex flex-1 min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
              mainSection === 'recursos'
                ? 'border-surface-border bg-surface-card text-ink-primary shadow-sm ring-1 ring-inset ring-brand-tertiary/20'
                : 'border-transparent text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
            )}
          >
            <Share2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Recursos
          </button>
        </div>
      </div>

      {mainSection === 'checkins' ? <TrainerCheckInsPage embedded /> : null}
      {mainSection === 'recursos' ? <TrainerResourcesPage embedded /> : null}
    </div>
  )
}
