import { Header } from '@/components/layout/Header'
import { ExercisesSectionNav } from '@/components/exercises/ExercisesSectionNav'
import { RoutineBlueprintsPanel } from '@/pages/routines/RoutineBlueprintsPanel'

export function ExerciseBlueprintsPage() {
  return (
    <div>
      <Header title="Base de datos" />
      <div className="page-shell-x page-shell-y space-y-4">
        <ExercisesSectionNav />
        <RoutineBlueprintsPanel />
      </div>
    </div>
  )
}
