import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

export function AuthGuard() {
  const { user, loading } = useAuth()

  if (loading) return <Spinner fullScreen />
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
