import { NutritionAreaTabsStrip } from '@/components/nutrition/NutritionAreaTabsStrip'
import { nutritionSectionDescClass, nutritionSectionTitleClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'

/**
 * Misma altura visual que las pestañas de Planes/Biblioteca, sin forzar tabs falsos:
 * contexto del área.
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
      </div>
    </NutritionAreaTabsStrip>
  )
}
