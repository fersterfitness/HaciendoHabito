import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

// Hard cap: never show spinner for more than this long.
// If auth hasn't resolved by then, send user to login.
const MAX_LOADING_MS = 6000

export function AuthGuard() {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => setTimedOut(true), MAX_LOADING_MS)
    return () => clearTimeout(t)
  }, [loading])

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!user || timedOut) return <Navigate to="/login" replace />

  return <Outlet />
}
