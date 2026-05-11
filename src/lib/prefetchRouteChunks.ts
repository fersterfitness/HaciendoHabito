/**
 * Precarga chunks de rutas pesadas al pasar el mouse o enfocar el nav.
 * Idempotente por bloque lógico.
 */
const done = new Set<string>()

function runOnce(key: string, load: () => void) {
  if (done.has(key)) return
  done.add(key)
  load()
}

const NUTRITION_SEGMENT_ROUTES = new Set([
  'evolution',
  'plans',
  'foods',
  'planning',
  'appointments',
  'templates',
])

export function prefetchRouteChunkByHref(href: string): void {
  const raw = href.split('?')[0]
  const path = raw.replace(/\/+$/, '') || '/'

  if (path.startsWith('/finances')) {
    runOnce('finances', () => {
      void import('@/pages/finances/FinancesPage')
      void import('@/pages/finances/IncomeFormPage')
      void import('@/pages/finances/ExpenseFormPage')
    })
    return
  }

  if (path === '/nutrition/planning') {
    runOnce('nutrition-planning', () => void import('@/pages/nutrition/NutritionPlanningPage'))
    return
  }
  if (path === '/nutrition/foods') {
    runOnce('nutrition-foods', () => void import('@/pages/nutrition/NutritionFoodsPage'))
    return
  }
  if (path === '/nutrition/plans') {
    runOnce('nutrition-templates', () => void import('@/pages/nutrition/NutritionTemplatesPage'))
    return
  }
  if (path === '/nutrition/evolution') {
    runOnce('nutrition-evolution', () => void import('@/pages/nutrition/NutritionEvolutionPage'))
    return
  }

  if (path === '/nutrition-pdfs') {
    runOnce('nutrition-pdfs', () => void import('@/pages/nutrition/NutritionComparativePage'))
    return
  }

  if (path.startsWith('/appointments')) {
    runOnce('appointments', () => void import('@/pages/nutrition/NutritionAppointmentsPage'))
    return
  }

  const patientMatch = path.match(/^\/nutrition\/([^/]+)$/)
  if (patientMatch && !NUTRITION_SEGMENT_ROUTES.has(patientMatch[1])) {
    runOnce('nutrition-patient-detail', () => void import('@/pages/nutrition/NutritionPatientDetailPage'))
    return
  }

  if (path === '/nutrition') {
    runOnce('nutrition-home', () => void import('@/pages/nutrition/NutritionPage'))
    return
  }

  if (path.startsWith('/routines')) {
    runOnce('routines', () => {
      void import('@/pages/routines/RoutinesPage')
      void import('@/pages/routines/RoutineDetailPage')
      void import('@/pages/routines/RoutineFormPage')
      void import('@/pages/routines/RoutineEditorPage')
      void import('@/pages/routines/RoutineBlueprintsPage')
    })
    return
  }

  if (path.startsWith('/meal-plans')) {
    runOnce('meal-plans', () => void import('@/pages/meal-plans/MealPlansPage'))
    return
  }

  if (path.startsWith('/habits')) {
    runOnce('habits', () => void import('@/pages/habits/HabitsPage'))
    return
  }

  if (path.startsWith('/exercises')) {
    runOnce('exercises', () => {
      void import('@/pages/exercises/ExercisesPage')
      void import('@/pages/exercises/ExerciseFormPage')
    })
    return
  }

  if (path.startsWith('/feedback')) {
    runOnce('feedback', () => {
      void import('@/pages/feedback/FeedbackPage')
      void import('@/pages/feedback/FeedbackFormPage')
      void import('@/pages/feedback/FeedbackDetailPage')
    })
    return
  }

  if (path.startsWith('/settings')) {
    runOnce('settings', () => {
      void import('@/pages/settings/SettingsPage')
      void import('@/pages/settings/WebPlansSettingsPage')
    })
    return
  }

  if (path.startsWith('/notifications')) {
    runOnce('notifications', () => void import('@/pages/notifications/NotificationsPage'))
    return
  }

  if (path.startsWith('/my/meal-plans')) {
    runOnce('student-meal-plans', () => {
      void import('@/pages/student/StudentMealPlansPage')
      void import('@/pages/student/StudentMealPlanDetailPage')
    })
    return
  }

  if (path.startsWith('/students/')) {
    runOnce('students-deep', () => {
      void import('@/pages/students/StudentDetailPage')
      void import('@/pages/students/StudentFormPage')
      void import('@/pages/students/TrainerStudentMealPlanPage')
    })
    return
  }
}
