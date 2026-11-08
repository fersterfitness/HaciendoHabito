import { Header } from '@/components/layout/Header'
import { IS_V2 } from '@/lib/uiVersion'
import { ExercisesSectionNav } from '@/components/exercises/ExercisesSectionNav'
import { RoutineBlueprintsPanel } from '@/pages/routines/RoutineBlueprintsPanel'

export function ExerciseBlueprintsPage() {
  return (
    <div>
      <Header title={IS_V2 ? 'Ejercicios y circuitos' : 'Base de datos'} />
      <div className="page-shell-x page-shell-y space-y-4">
        <ExercisesSectionNav />
        <RoutineBlueprintsPanel />
      </div>
    </div>
  )
}
