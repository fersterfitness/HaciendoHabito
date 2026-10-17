import { LineChart, Users } from 'lucide-react'
import { NutritionAreaTabsStrip } from '@/components/nutrition/NutritionAreaTabsStrip'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { nutritionSectionDescClass, nutritionSectionTitleClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'

/**
 * Misma altura visual que las pestañas de Planes/Biblioteca, sin forzar tabs falsos:
 * contexto del área + acceso rápido a evolución.
 */
export function NutritionPatientAreaHeader({ className }: { className?: string }) {
  return (
    <NutritionAreaTabsStrip className={className}>
      <div className="flex flex-col gap-3 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={nutritionSectionTitleClass}>Pacientes</p>
          <p className={cn(nutritionSectionDescClass, 'mt-0.5')}>
            Listado, turnos y carpeta nutricional de cada persona.
          </p>
        </div>
        <SegmentedControl
          size="sm"
          ariaLabel="Pacientes"
          className="shrink-0"
          items={[
            { id: 'list', to: '/nutrition', end: true, label: 'Listado', icon: Users },
            { id: 'evolution', to: '/nutrition/evolution', label: 'Evolución', icon: LineChart },
          ]}
        />
      </div>
    </NutritionAreaTabsStrip>
  )
}
