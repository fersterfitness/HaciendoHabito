import { LineChart, Users } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { NutritionAreaTabsStrip } from '@/components/nutrition/NutritionAreaTabsStrip'
import { nutritionSectionDescClass, nutritionSectionTitleClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'

const PATIENTS_PATH = '/nutrition'
const EVOLUTION_PATH = '/nutrition/evolution'

/**
 * Misma altura visual que las pestañas de Planes/Biblioteca, sin forzar tabs falsos:
 * contexto del área + acceso rápido a evolución.
 */
export function NutritionPatientAreaHeader({ className }: { className?: string }) {
  const navigate = useAppNavigate()
  const { pathname } = useLocation()
  const onEvolution = pathname.startsWith(EVOLUTION_PATH)
  const onPatients =
    pathname === PATIENTS_PATH ||
    (pathname.startsWith(`${PATIENTS_PATH}/`) &&
      !pathname.startsWith('/nutrition/foods') &&
      !pathname.startsWith('/nutrition/menus') &&
      !pathname.startsWith('/nutrition/plans') &&
      !pathname.startsWith('/nutrition/planning') &&
      !onEvolution &&
      !pathname.startsWith('/nutrition-pdfs'))

  return (
    <NutritionAreaTabsStrip className={className}>
      <div className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={nutritionSectionTitleClass}>Pacientes</p>
          <p className={cn(nutritionSectionDescClass, 'mt-0.5')}>
            Listado, turnos y carpeta nutricional de cada persona.
          </p>
        </div>
        <div
          className="flex shrink-0 gap-1 rounded-lg border border-surface-border/70 bg-surface-elevated/40 p-0.5"
          role="tablist"
          aria-label="Pacientes"
        >
          <button
            type="button"
            role="tab"
            aria-selected={onPatients && !onEvolution}
            onClick={() => navigate(PATIENTS_PATH)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              onPatients && !onEvolution
                ? 'bg-brand-secondary/12 text-brand-secondary shadow-sm'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Listado
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onEvolution}
            onClick={() => navigate(EVOLUTION_PATH)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              onEvolution
                ? 'bg-brand-secondary/12 text-brand-secondary shadow-sm'
                : 'text-ink-muted hover:text-ink-secondary',
            )}
          >
            <LineChart className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Evolución
          </button>
        </div>
      </div>
    </NutritionAreaTabsStrip>
  )
}
