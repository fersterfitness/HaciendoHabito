import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

// El editor fue fusionado con el detalle de rutina.
// Esta ruta redirige automáticamente para no romper links existentes.
export function RoutineEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`/routines/${id}`, { replace: true })
  }, [id, navigate])

  return null
}
