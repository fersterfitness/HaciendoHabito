import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthInit } from '@/hooks/useAuth'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
import { useAuthStore } from '@/stores/authStore'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { StudentsPage } from '@/pages/students/StudentsPage'
import { StudentFormPage } from '@/pages/students/StudentFormPage'
import { StudentDetailPage } from '@/pages/students/StudentDetailPage'
import { RoutinesPage } from '@/pages/routines/RoutinesPage'
import { RoutineFormPage } from '@/pages/routines/RoutineFormPage'
import { RoutineDetailPage } from '@/pages/routines/RoutineDetailPage'
import { RoutineEditorPage } from '@/pages/routines/RoutineEditorPage'
import { RoutineBlueprintsPage } from '@/pages/routines/RoutineBlueprintsPage'
import { HabitsPage } from '@/pages/habits/HabitsPage'
import { ExercisesPage } from '@/pages/exercises/ExercisesPage'
import { ExerciseFormPage } from '@/pages/exercises/ExerciseFormPage'
import { FinancesPage } from '@/pages/finances/FinancesPage'
import { IncomeFormPage } from '@/pages/finances/IncomeFormPage'
import { ExpenseFormPage } from '@/pages/finances/ExpenseFormPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { WebPlansSettingsPage } from '@/pages/settings/WebPlansSettingsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'
import { FeedbackPage } from '@/pages/feedback/FeedbackPage'
import { FeedbackFormPage } from '@/pages/feedback/FeedbackFormPage'
import { FeedbackDetailPage } from '@/pages/feedback/FeedbackDetailPage'
import { NutritionPage } from '@/pages/nutrition/NutritionPage'
import { NutritionPatientDetailPage } from '@/pages/nutrition/NutritionPatientDetailPage'
import { NutritionComparativePage } from '@/pages/nutrition/NutritionComparativePage'
import { NutritionEvolutionPage } from '@/pages/nutrition/NutritionEvolutionPage'
import { NutritionAppointmentsPage } from '@/pages/nutrition/NutritionAppointmentsPage'
import { NutritionTemplatesPage } from '@/pages/nutrition/NutritionTemplatesPage'
import { NutritionFoodsPage } from '@/pages/nutrition/NutritionFoodsPage'
import { NutritionPlanningPage } from '@/pages/nutrition/NutritionPlanningPage'
import { StudentMealPlansPage } from '@/pages/student/StudentMealPlansPage'
import { StudentMealPlanDetailPage } from '@/pages/student/StudentMealPlanDetailPage'
import { TrainerStudentMealPlanPage } from '@/pages/students/TrainerStudentMealPlanPage'
import { MealPlansPage } from '@/pages/meal-plans/MealPlansPage'
import { PublicIntakeFormPage } from '@/pages/public/PublicIntakeFormPage'
import type { AppRole } from '@/types/database'

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
      <Route path="students/new" element={<StudentFormPage />} />
      <Route
        path="students/:id/meal-plan/:planId"
        element={
          role === 'trainer' || role === 'admin' ? (
            <TrainerStudentMealPlanPage />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="students/:id" element={<StudentDetailPage />} />
      <Route path="students/:id/edit" element={<StudentFormPage />} />

      {/* Alumno */}
      <Route
        path="my/meal-plans/:planId"
        element={role === 'student' ? <StudentMealPlanDetailPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="my/meal-plans"
        element={role === 'student' ? <StudentMealPlansPage /> : <Navigate to="/dashboard" replace />}
      />

      {/* Rutinas */}
      <Route
        path="meal-plans"
        element={
          canSeeTrainerAssignedMealPlansPage ? (
            <MealPlansPage />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="routines" element={canSeeTraining ? <RoutinesPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="routines/new" element={canSeeTraining ? <RoutineFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="routines/blueprints" element={canSeeTraining ? <RoutineBlueprintsPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id" element={canSeeTraining ? <RoutineDetailPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id/edit" element={canSeeTraining ? <RoutineFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="routines/:id/editor" element={canSeeTraining ? <RoutineEditorPage /> : <Navigate to="/dashboard" replace />} />

      <Route
        path="routine-pdfs"
        element={canSeeTraining ? <Navigate to="/routines?tab=pdfs" replace /> : <Navigate to="/dashboard" replace />}
      />

      <Route path="habits" element={canSeeTraining ? <HabitsPage /> : <Navigate to="/dashboard" replace />} />

      <Route path="feedback" element={canSeeTraining ? <FeedbackPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="feedback/new" element={canSeeTraining ? <FeedbackFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="feedback/:id" element={canSeeTraining ? <FeedbackDetailPage /> : <Navigate to="/dashboard" replace />} />

      <Route path="exercises" element={canSeeTraining ? <ExercisesPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="exercises/new" element={canSeeTraining ? <ExerciseFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="exercises/:id/edit" element={canSeeTraining ? <ExerciseFormPage /> : <Navigate to="/dashboard" replace />} />

      <Route path="nutrition" element={canSeeNutrition ? <NutritionPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition/evolution" element={canSeeNutrition ? <NutritionEvolutionPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition/appointments" element={<Navigate to="/appointments" replace />} />
      <Route path="nutrition/plans" element={canSeeNutrition ? <NutritionTemplatesPage /> : <Navigate to="/dashboard" replace />} />
      <Route
        path="nutrition/foods"
        element={canSeeNutritionFoodsGuide ? <NutritionFoodsPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route
        path="nutrition/planning"
        element={canSeeNutritionFoodsGuide ? <NutritionPlanningPage /> : <Navigate to="/dashboard" replace />}
      />
      <Route path="nutrition/templates" element={<Navigate to="/nutrition/plans" replace />} />
      <Route path="nutrition/:id" element={canSeeNutrition ? <NutritionPatientDetailPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="nutrition-pdfs" element={canSeeNutrition ? <NutritionComparativePage /> : <Navigate to="/dashboard" replace />} />

      <Route path="appointments" element={canSeeAppointments ? <NutritionAppointmentsPage /> : <Navigate to="/dashboard" replace />} />

      <Route path="finances" element={canSeeFinances ? <FinancesPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income" element={canSeeFinances ? <Navigate to="/finances?tab=income" replace /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses" element={canSeeFinances ? <Navigate to="/finances?tab=expenses" replace /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income/new" element={canSeeFinances ? <IncomeFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/income/:id/edit" element={canSeeFinances ? <IncomeFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses/new" element={canSeeFinances ? <ExpenseFormPage /> : <Navigate to="/dashboard" replace />} />
      <Route path="finances/expenses/:id/edit" element={canSeeFinances ? <ExpenseFormPage /> : <Navigate to="/dashboard" replace />} />

      <Route path="notifications" element={<NotificationsPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route
        path="settings/web-plans"
        element={
          role === 'admin' || role === 'trainer' || role === 'nutritionist' ? (
            <WebPlansSettingsPage />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route path="profile" element={<PlaceholderPage title="Perfil" />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </>
  )
}

function AppRoutes() {
  useAuthInit()
  const role = useAuthStore((state) => state.profile?.role)
  const canSeeTraining = role === 'admin' || role === 'trainer' || !role
  const canSeeNutrition = role === 'admin' || role === 'nutritionist'
  const canSeeFinances = role === 'admin' || role === 'trainer' || role === 'nutritionist' || !role
  const canSeeNutritionFoodsGuide =
    role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const canSeeAppointments = role === 'admin' || role === 'trainer' || role === 'nutritionist' || !role

  const canSeeTrainerAssignedMealPlansPage =
    role !== 'student' &&
    (role == null || role === 'admin' || role === 'trainer' || role === 'nutritionist')

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

      <Route path="/form" element={<PublicIntakeFormPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>{renderLoggedInRoutes(loggedInProps)}</Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

/** Verde éxito (toasts success). */
const TOAST_SUCCESS_ICON = '#16a34a'
/** Naranja marca (toasts loading / spinner). */
const TOAST_LOADING_ICON = '#ff4800'

function ThemedToaster() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Toaster
      position="top-right"
      toastOptions={{
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
          iconTheme: { primary: TOAST_SUCCESS_ICON, secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
          style: {
            borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : 'rgba(22, 163, 74, 0.25)',
          },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
        },
        loading: {
          iconTheme: { primary: TOAST_LOADING_ICON, secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
          style: {
            borderColor: isDark ? 'rgba(255, 72, 0, 0.38)' : 'rgba(255, 72, 0, 0.28)',
          },
        },
      }}
    />
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
        <ThemedToaster />
      </BrowserRouter>
    </ThemeProvider>
  )
}
