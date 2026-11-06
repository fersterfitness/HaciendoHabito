import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { AnthropometryReportView } from '@/components/nutrition/report/AnthropometryReportView'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudentById } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import type { NutritionMeasurement, Student } from '@/types/database'

/**
 * Informe ilustrado en su propia pestaña (/nutrition/:id/informe?control=<id>): se abre desde
 * Antropometría y no queda debajo de paneles flotantes. Al cerrarlo vuelve a la ficha.
 */
export function NutritionAnthropometryReportPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [student, setStudent] = useState<Student | null>(null)
  const [measurements, setMeasurements] = useState<NutritionMeasurement[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const loadMeasurements = useCallback(async () => {
    if (!user || !id) return
    const { data, error } = await supabase
      .from('nutrition_measurements')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', id)
      .order('measured_at', { ascending: false })
      .limit(40)
    if (error) {
      toast.error(error.message)
      return
    }
    setMeasurements((data as NutritionMeasurement[]) ?? [])
  }, [id, user])

  useEffect(() => {
    if (!user || !id) return
    let alive = true
    void (async () => {
      const { data, error } = await fetchAccessibleStudentById(id)
      if (!alive) return
      if (error || !data) {
        setFailed(error ?? 'No se encontró el paciente.')
        return
      }
      setStudent(data)
      await loadMeasurements()
    })()
    return () => {
      alive = false
    }
  }, [id, user, loadMeasurements])

  const close = useCallback(() => {
    // Abierto desde la ficha en otra pestaña: se cierra; si no, vuelve a la ficha.
    if (window.opener) window.close()
    navigate(`/nutrition/${id}?tab=antropometria`)
  }, [id, navigate])

  if (failed || (measurements && measurements.length === 0)) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center text-sm text-ink-muted">
        {failed ?? 'Este paciente todavía no tiene controles para armar el informe.'}
      </div>
    )
  }
  if (!student || !measurements) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-sm text-ink-muted">
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando informe…
        </span>
      </div>
    )
  }
  return (
    <AnthropometryReportView
      ownerId={user!.id}
      student={student}
      measurements={measurements}
      initialId={params.get('control')}
      onClose={close}
      onSaved={loadMeasurements}
    />
  )
}
