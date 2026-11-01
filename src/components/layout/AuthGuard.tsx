import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isPasswordRecoveryPending } from '@/lib/authRecovery'
import { BrandAppLoader } from '@/components/branding/BrandAppLoader'

// Hard cap: si la verificación de auth tarda más que esto, redirige a login
const MAX_LOADING_MS = 8000

export function AuthGuard() {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!loading) return
    const t = setTimeout(() => {
      console.warn('[AuthGuard] auth check timed out after', MAX_LOADING_MS, 'ms — redirecting to login')
      setTimedOut(true)
    }, MAX_LOADING_MS)
    return () => clearTimeout(t)
  }, [loading])

  // Reset timeout si loading termina antes
  useEffect(() => {
    if (!loading) setTimedOut(false)
  }, [loading])

  if (loading && !timedOut) {
    return (
      <BrandAppLoader fullScreen />
    )
  }

  if (!user || timedOut) return <Navigate to="/login" replace />

  if (isPasswordRecoveryPending()) {
    return <Navigate to="/reset-password" replace />
  }

  return <Outlet />
}
