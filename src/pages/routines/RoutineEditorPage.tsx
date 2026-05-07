import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'

// El editor fue fusionado con el detalle de rutina.
// Esta ruta redirige automáticamente para no romper links existentes.
export function RoutineEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useAppNavigate()

  useEffect(() => {
    navigate(`/routines/${id}`, { replace: true })
  }, [id, navigate])

  return null
}
