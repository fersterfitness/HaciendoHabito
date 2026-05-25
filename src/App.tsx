import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthInit } from '@/hooks/useAuth'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { PageRouteFallback } from '@/components/layout/PageRouteFallback'
import { LoginPage } from '@/pages/auth/LoginPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { StudentsPage } from '@/pages/students/StudentsPage'
import type { AppRole } from '@/types/database'

const StudentFormPage = lazy(() => import('@/pages/students/StudentFormPage').then((m) => ({ default: m.StudentFormPage })))
const StudentDetailPage = lazy(() => import('@/pages/students/StudentDetailPage').then((m) => ({ default: m.StudentDetailPage })))
const TrainerStudentMealPlanPage = lazy(() =>
  import('@/pages/students/TrainerStudentMealPlanPage').then((m) => ({ default: m.TrainerStudentMealPlanPage })),
)
const MealPlansPage = lazy(() => import('@/pages/meal-plans/MealPlansPage').then((m) => ({ default: m.MealPlansPage })))
const RoutinesPage = lazy(() => import('@/pages/routines/RoutinesPage').then((m) => ({ default: m.RoutinesPage })))
const RoutineFormPage = lazy(() => import('@/pages/routines/RoutineFormPage').then((m) => ({ default: m.RoutineFormPage })))
const RoutineDetailPage = lazy(() => import('@/pages/routines/RoutineDetailPage').then((m) => ({ default: m.RoutineDetailPage })))
const RoutineEditorPage = lazy(() => import('@/pages/routines/RoutineEditorPage').then((m) => ({ default: m.RoutineEditorPage })))
const RoutineBlueprintsPage = lazy(() => import('@/pages/routines/RoutineBlueprintsPage').then((m) => ({ default: m.RoutineBlueprintsPage })))
const HabitsPage = lazy(() => import('@/pages/habits/HabitsPage').then((m) => ({ default: m.HabitsPage })))
const ExercisesPage = lazy(() => import('@/pages/exercises/ExercisesPage').then((m) => ({ default: m.ExercisesPage })))
const ExerciseFormPage = lazy(() => import('@/pages/exercises/ExerciseFormPage').then((m) => ({ default: m.ExerciseFormPage })))
const TrainingMethodsPage = lazy(() =>
  import('@/pages/exercises/TrainingMethodsPage').then((m) => ({ default: m.TrainingMethodsPage })),
)
const FinancesPage = lazy(() => import('@/pages/finances/FinancesPage').then((m) => ({ default: m.FinancesPage })))
const IncomeFormPage = lazy(() => import('@/pages/finances/IncomeFormPage').then((m) => ({ default: m.IncomeFormPage })))
const ExpenseFormPage = lazy(() => import('@/pages/finances/ExpenseFormPage').then((m) => ({ default: m.ExpenseFormPage })))
const NotificationsPage = lazy(() => import('@/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const WebPlansSettingsPage = lazy(() => import('@/pages/settings/WebPlansSettingsPage').then((m) => ({ default: m.WebPlansSettingsPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const FeedbackPage = lazy(() => import('@/pages/feedback/FeedbackPage').then((m) => ({ default: m.FeedbackPage })))
const FeedbackFormPage = lazy(() => import('@/pages/feedback/FeedbackFormPage').then((m) => ({ default: m.FeedbackFormPage })))
const FeedbackDetailPage = lazy(() => import('@/pages/feedback/FeedbackDetailPage').then((m) => ({ default: m.FeedbackDetailPage })))
const NutritionPage = lazy(() => import('@/pages/nutrition/NutritionPage').then((m) => ({ default: m.NutritionPage })))
const NutritionPatientDetailPage = lazy(() =>
  import('@/pages/nutrition/NutritionPatientDetailPage').then((m) => ({ default: m.NutritionPatientDetailPage })),
)
const NutritionComparativePage = lazy(() =>
  import('@/pages/nutrition/NutritionComparativePage').then((m) => ({ default: m.NutritionComparativePage })),
)
const NutritionEvolutionPage = lazy(() => import('@/pages/nutrition/NutritionEvolutionPage').then((m) => ({ default: m.NutritionEvolutionPage })))
const NutritionAppointmentsPage = lazy(() =>
  import('@/pages/nutrition/NutritionAppointmentsPage').then((m) => ({ default: m.NutritionAppointmentsPage })),
)
const NutritionTemplatesPage = lazy(() => import('@/pages/nutrition/NutritionTemplatesPage').then((m) => ({ default: m.NutritionTemplatesPage })))
const NutritionFoodsPage = lazy(() => import('@/pages/nutrition/NutritionFoodsPage').then((m) => ({ default: m.NutritionFoodsPage })))
const NutritionPlanningPage = lazy(() => import('@/pages/nutrition/NutritionPlanningPage').then((m) => ({ default: m.NutritionPlanningPage })))
const NutritionSeasonalMenusPage = lazy(() =>
  import('@/pages/nutrition/NutritionSeasonalMenusPage').then((m) => ({ default: m.NutritionSeasonalMenusPage })),
)
const StudentMealPlansPage = lazy(() => import('@/pages/student/StudentMealPlansPage').then((m) => ({ default: m.StudentMealPlansPage })))
const StudentMealPlanDetailPage = lazy(() =>
  import('@/pages/student/StudentMealPlanDetailPage').then((m) => ({ default: m.StudentMealPlanDetailPage })),
)
const PublicIntakeFormPage = lazy(() => import('@/pages/public/PublicIntakeFormPage').then((m) => ({ default: m.PublicIntakeFormPage })))
const PublicCheckInPage = lazy(() => import('@/pages/public/PublicCheckInPage').then((m) => ({ default: m.PublicCheckInPage })))
const TrainingSectionRedirect = lazy(() =>
  import('@/pages/training/TrainingSectionRedirect').then((m) => ({ default: m.TrainingSectionRedirect })),
)

function withPageSuspense(node: ReactNode) {
  return <Suspense fallback={<PageRouteFallback />}>{node}</Suspense>
}

/** `/routines/new` → `/routines?create=1` conservando `student` y `blueprint`. */
function RoutinesNewToQueryRedirect() {
  const [sp] = useSearchParams()
  const next = new URLSearchParams()
  next.set('create', '1')
  const student = sp.get('student')
  const blueprint = sp.get('blueprint')
  if (student) next.set('student', student)
  if (blueprint) next.set('blueprint', blueprint)
  return <Navigate to={`/routines?${next.toString()}`} replace />
}

type LoggedInRouteProps = {
  role: AppRole | undefined
  canSeeTraining: boolean
  canSeeNutrition: boolean
  canSeeNutritionFoodsGuide: boolean
  canSeeAppointments: boolean
  canSeeTrainerAssignedMealPlansPage: boolean
  canSeeFinances: boolean
}

/**
 * Rutas bajo `AppLayout`: paths relativos. Debe ser función que devuelve JSX, no `<Componente />`,
 * porque React Router sólo acepta `<Route>` o `Fragment` como hijos directos de cada `<Route>`.
 */
function renderLoggedInRoutes({
  role,
  canSeeTraining,
  canSeeNutrition,
  canSeeNutritionFoodsGuide,
  canSeeAppointments,
  canSeeTrainerAssignedMealPlansPage,
  canSeeFinances,
}: LoggedInRouteProps) {
  return (
    <>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="dashboard" element={<DashboardPage />} />

      {/* Alumnos */}
      <Route path="students" element={<StudentsPage />} />
      <Route path="students/new" element={<Navigate to="/students?create=1" replace />} />
      <Route
        path="students/:id/meal-plan/:planId"
        element={
          role === 'trainer' || role === 'admin' ? (
            withPageSuspense(<TrainerStudentMealPlanPage />)
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="students/:id" element={withPageSuspense(<StudentDetailPage />)} />
      <Route path="students/:id/edit" element={withPageSuspense(<StudentFormPage />)} />

      {/* Alumno */}
      <Route
        path="my/meal-plans/:planId"
        element={role === 'student' ? withPageSuspense(<StudentMealPlanDetailPage />) : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="my/meal-plans"
        element={role === 'student' ? withPageSuspense(<StudentMealPlansPage />) : <Navigate to="/dashboard" replace />}
      />

      {/* Rutinas */}
      <Route
        path="meal-plans"
        element={
          canSeeTrainerAssignedMealPlansPage ? (
            withPageSuspense(<MealPlansPage />)
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="routines" element={canSeeTraining ? withPageSuspense(<RoutinesPage />) : <Navigate to="/dashboard" replace />} />
      <Route
        path="routines/new"
        element={canSeeTraining ? <RoutinesNewToQueryRedirect /> : <Navigate to="/dashboard" replace />}
      />
      <Route path="routines/blueprints" element={canSeeTraining ? withPageSuspense(<RoutineBlueprintsPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id" element={canSeeTraining ? withPageSuspense(<RoutineDetailPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id/edit" element={canSeeTraining ? withPageSuspense(<RoutineFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id/editor" element={canSeeTraining ? withPageSuspense(<RoutineEditorPage />) : <Navigate to="/dashboard" replace />} />

      <Route
        path="routine-pdfs"
        element={canSeeTraining ? <Navigate to="/routines?tab=pdfs" replace /> : <Navigate to="/dashboard" replace />}
      />

      <Route path="habits" element={canSeeTraining ? withPageSuspense(<HabitsPage />) : <Navigate to="/dashboard" replace />} />

      <Route path="feedback" element={canSeeTraining ? withPageSuspense(<FeedbackPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="feedback/new" element={canSeeTraining ? withPageSuspense(<FeedbackFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="feedback/:id" element={canSeeTraining ? withPageSuspense(<FeedbackDetailPage />) : <Navigate to="/dashboard" replace />} />

      <Route
        path="resources"
        element={canSeeTraining ? withPageSuspense(<TrainingSectionRedirect tab="recursos" />) : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="check-ins"
        element={canSeeTraining ? withPageSuspense(<TrainingSectionRedirect tab="checkins" />) : <Navigate to="/dashboard" replace />}
      />

      <Route path="exercises" element={canSeeTraining ? withPageSuspense(<ExercisesPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="exercises/methods" element={canSeeTraining ? withPageSuspense(<TrainingMethodsPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="exercises/new" element={canSeeTraining ? withPageSuspense(<ExerciseFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="exercises/:id/edit" element={canSeeTraining ? withPageSuspense(<ExerciseFormPage />) : <Navigate to="/dashboard" replace />} />

      <Route path="nutrition" element={canSeeNutrition ? withPageSuspense(<NutritionPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition/evolution" element={canSeeNutrition ? withPageSuspense(<NutritionEvolutionPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition/appointments" element={<Navigate to="/appointments" replace />} />
      <Route path="nutrition/plans" element={canSeeNutrition ? withPageSuspense(<NutritionTemplatesPage />) : <Navigate to="/dashboard" replace />} />
      <Route
        path="nutrition/menus"
        element={canSeeNutrition ? withPageSuspense(<NutritionSeasonalMenusPage />) : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="nutrition/foods"
        element={canSeeNutritionFoodsGuide ? withPageSuspense(<NutritionFoodsPage />) : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="nutrition/planning"
        element={canSeeNutritionFoodsGuide ? withPageSuspense(<NutritionPlanningPage />) : <Navigate to="/dashboard" replace />}
      />
      <Route path="nutrition/templates" element={<Navigate to="/nutrition/plans" replace />} />
      <Route path="nutrition/:id" element={canSeeNutrition ? withPageSuspense(<NutritionPatientDetailPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition-pdfs" element={canSeeNutrition ? withPageSuspense(<NutritionComparativePage />) : <Navigate to="/dashboard" replace />} />

      <Route path="appointments" element={canSeeAppointments ? withPageSuspense(<NutritionAppointmentsPage />) : <Navigate to="/dashboard" replace />} />

      <Route path="finances" element={canSeeFinances ? withPageSuspense(<FinancesPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income" element={canSeeFinances ? <Navigate to="/finances?tab=income" replace /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses" element={canSeeFinances ? <Navigate to="/finances?tab=expenses" replace /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income/new" element={canSeeFinances ? withPageSuspense(<IncomeFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income/:id/edit" element={canSeeFinances ? withPageSuspense(<IncomeFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses/new" element={canSeeFinances ? withPageSuspense(<ExpenseFormPage />) : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses/:id/edit" element={canSeeFinances ? withPageSuspense(<ExpenseFormPage />) : <Navigate to="/dashboard" replace />} />

      <Route path="notifications" element={withPageSuspense(<NotificationsPage />)} />
      <Route path="settings" element={withPageSuspense(<SettingsPage />)} />
      <Route
        path="settings/web-plans"
        element={
          role === 'admin' || role === 'trainer' || role === 'nutritionist' ? (
            withPageSuspense(<WebPlansSettingsPage />)
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="profile" element={<Navigate to="/settings" replace />} />

      <Route path="*" element={withPageSuspense(<NotFoundPage />)} />
    </>
  )
}

function AppRoutes() {
  useAuthInit()
  const { user, profile, loading } = useAuthStore()
  const role = profile?.role
  const profilePending = Boolean(user && !profile && !loading)
  const canSeeTraining = profilePending ? false : role === 'admin' || role === 'trainer'
  const canSeeNutrition = profilePending ? false : role === 'admin' || role === 'nutritionist'
  const canSeeFinances =
    profilePending ? false : role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const canSeeNutritionFoodsGuide =
    profilePending ? false : role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const canSeeAppointments =
    profilePending ? false : role === 'admin' || role === 'trainer' || role === 'nutritionist'

  const canSeeTrainerAssignedMealPlansPage =
    !profilePending &&
    role !== 'student' &&
    (role === 'admin' || role === 'trainer' || role === 'nutritionist')

  const loggedInProps = {
    role,
    canSeeTraining,
    canSeeNutrition,
    canSeeNutritionFoodsGuide,
    canSeeAppointments,
    canSeeTrainerAssignedMealPlansPage,
    canSeeFinances,
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/form/check-in/compartido/:token" element={withPageSuspense(<PublicCheckInPage shared />)} />
      <Route path="/form/check-in/:token" element={withPageSuspense(<PublicCheckInPage />)} />
      <Route path="/form" element={withPageSuspense(<PublicIntakeFormPage />)} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>{renderLoggedInRoutes(loggedInProps)}</Route>
      </Route>

      <Route path="*" element={withPageSuspense(<NotFoundPage />)} />
    </Routes>
  )
}

/** Verde éxito (toasts success). */
const TOAST_SUCCESS_ICON = '#16a34a'
/** Marca (toasts loading / spinner); alineado a --brand-primary. */
const TOAST_LOADING_ICON = '#ff4800'

function ThemedToaster() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3200,
        style: {
          background: isDark ? '#1E1E1E' : '#FFFFFF',
          color: isDark ? '#F5F5F5' : '#0F0F23',
          border: isDark ? '1px solid #2A2A2A' : '1px solid #E2E2EC',
          borderRadius: '12px',
          fontSize: '14px',
          boxShadow: isDark
            ? '0 4px 12px rgb(0 0 0 / 0.4)'
            : '0 4px 12px rgb(0 0 0 / 0.08)',
        },
        success: {
          duration: 2800,
          iconTheme: { primary: TOAST_SUCCESS_ICON, secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
          style: {
            borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.25)',
          },
        },
        error: {
          duration: 4800,
          iconTheme: { primary: '#EF4444', secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
        },
        loading: {
          iconTheme: { primary: TOAST_LOADING_ICON, secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
          style: {
            borderColor: isDark ? 'rgb(var(--brand-primary) / 0.38)' : 'rgb(var(--brand-primary) / 0.28)',
          },
        },
      }}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AppRoutes />
        <ThemedToaster />
      </BrowserRouter>
    </ThemeProvider>
  )
}
