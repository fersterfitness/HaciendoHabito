import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Share2 } from 'lucide-react'
import { TrainerCheckInsPage } from '@/pages/training/TrainerCheckInsPage'
import { TrainerResourcesPage } from '@/pages/training/TrainerResourcesPage'
import { Header } from '@/components/layout/Header'
import { SegmentedControl } from '@/components/ui/SegmentedControl'

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
        <SegmentedControl
          ariaLabel="Sección"
          fullWidth
          className="max-w-md"
          value={mainSection}
          onChange={(id) => setMainSection(id as typeof mainSection)}
          items={[
            { id: 'checkins', label: 'Check-ins', icon: ClipboardCheck },
            { id: 'recursos', label: 'Recursos', icon: Share2 },
          ]}
        />
      </div>

      {mainSection === 'checkins' ? <TrainerCheckInsPage embedded /> : null}
      {mainSection === 'recursos' ? <TrainerResourcesPage embedded /> : null}
    </div>
  )
}
