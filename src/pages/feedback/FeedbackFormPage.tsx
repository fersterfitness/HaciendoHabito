import { Navigate, useSearchParams } from 'react-router-dom'

/** Compatibilidad: `/feedback/new` abre el panel sobre la lista. */
export function FeedbackFormPage() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')
  const qs = new URLSearchParams({ create: '1' })
  if (tab === 'checkins') qs.set('tab', 'checkins')
  return <Navigate to={`/feedback?${qs.toString()}`} replace />
}
