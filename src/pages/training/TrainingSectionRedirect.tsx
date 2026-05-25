import { Navigate, useSearchParams } from 'react-router-dom'

/** Redirige rutas legacy de entrenamiento al hub Devoluciones. */
export function TrainingSectionRedirect({ tab }: { tab: 'checkins' | 'recursos' }) {
  const [searchParams] = useSearchParams()
  const next = new URLSearchParams(searchParams)
  next.set('tab', tab)
  next.delete('create')
  return <Navigate to={`/feedback?${next.toString()}`} replace />
}
