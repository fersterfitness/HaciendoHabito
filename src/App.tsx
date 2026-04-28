import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthInit } from '@/hooks/useAuth'
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext'
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
import { RoutinePdfsPage } from '@/pages/routines/RoutinePdfsPage'
import { HabitsPage } from '@/pages/habits/HabitsPage'
import { FeedbackPage } from '@/pages/feedback/FeedbackPage'
import { FeedbackDetailPage } from '@/pages/feedback/FeedbackDetailPage'
import { FeedbackFormPage } from '@/pages/feedback/FeedbackFormPage'
import { ExercisesPage } from '@/pages/exercises/ExercisesPage'
import { ExerciseFormPage } from '@/pages/exercises/ExerciseFormPage'
import { FinancesPage } from '@/pages/finances/FinancesPage'
import { IncomeFormPage } from '@/pages/finances/IncomeFormPage'
import { ExpenseFormPage } from '@/pages/finances/ExpenseFormPage'
import { NotificationsPage } from '@/pages/notifications/NotificationsPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

function AppRoutes() {
  useAuthInit()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Alumnos */}
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/new" element={<StudentFormPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/students/:id/edit" element={<StudentFormPage />} />

          {/* Rutinas */}
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/routines/new" element={<RoutineFormPage />} />
          <Route path="/routines/:id" element={<RoutineDetailPage />} />
          <Route path="/routines/:id/edit" element={<RoutineFormPage />} />
          <Route path="/routines/:id/editor" element={<RoutineEditorPage />} />

          {/* PDFs */}
          <Route path="/routine-pdfs" element={<RoutinePdfsPage />} />

          {/* Hábitos */}
          <Route path="/habits" element={<HabitsPage />} />

          {/* Devoluciones */}
          <Route path="/feedback" element={<PlaceholderPage title="Devoluciones" />} />
          <Route path="/feedback/new" element={<PlaceholderPage title="Devoluciones" />} />
          <Route path="/feedback/:id" element={<PlaceholderPage title="Devoluciones" />} />

          {/* Ejercicios */}
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/exercises/new" element={<ExerciseFormPage />} />
          <Route path="/exercises/:id/edit" element={<ExerciseFormPage />} />

          {/* Nutrición (placeholders hasta activar feature flag) */}
          <Route path="/nutrition" element={<PlaceholderPage title="Nutrición" />} />
          <Route path="/nutrition/new" element={<PlaceholderPage title="Nuevo Plan Alimentario" />} />
          <Route path="/nutrition/:id/editor" element={<PlaceholderPage title="Editor de Plan" />} />
          <Route path="/nutrition-pdfs" element={<PlaceholderPage title="PDFs de Nutrición" />} />

          {/* Finanzas */}
          <Route path="/finances" element={<FinancesPage />} />
          <Route path="/finances/income" element={<Navigate to="/finances?tab=income" replace />} />
          <Route path="/finances/expenses" element={<Navigate to="/finances?tab=expenses" replace />} />
          <Route path="/finances/income/new" element={<IncomeFormPage />} />
          <Route path="/finances/income/:id/edit" element={<IncomeFormPage />} />
          <Route path="/finances/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/finances/expenses/:id/edit" element={<ExpenseFormPage />} />

          {/* Sistema */}
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<PlaceholderPage title="Perfil" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

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
          iconTheme: { primary: '#FF8C00', secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
        },
        error: {
          iconTheme: { primary: '#EF4444', secondary: isDark ? '#1E1E1E' : '#FFFFFF' },
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
