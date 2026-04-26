import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Dumbbell, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRoutines } from '@/hooks/useRoutines'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import { Select } from '@/components/ui/Input'
import { formatDate, daysUntil } from '@/lib/utils'
import { generateRoutinePdf } from '@/lib/pdf/generateRoutinePdf'
import type { Routine } from '@/types/database'
import { ROUTINE_STATUSES } from '@/lib/constants'
import toast from 'react-hot-toast'

type RoutineFull = Routine & { student?: { full_name: string; level: string } }

export function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { deleteRoutine, updateRoutine } = useRoutines()
  const { user } = useAuthStore()
  const [routine, setRoutine] = useState<RoutineFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase
      .from('routines')
      .select('*, student:students(full_name, level)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setRoutine(data as unknown as RoutineFull)
        setLoading(false)
      })
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteRoutine(id)
    setDeleting(false)
    if (ok) navigate('/routines')
  }

  async function handleGeneratePdf() {
    if (!id || !user || !routine) return
    setGeneratingPdf(true)
    const toastId = toast.loading('Generando PDF...')
    try {
      // Crear o reusar solicitud de PDF
      const { data: existing } = await supabase
        .from('routine_pdfs')
        .select('id')
        .eq('routine_id', id)
        .in('status', ['pendiente', 'error', 'generado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let pdfId = existing?.id

      if (!pdfId) {
        const { data: created, error } = await supabase
          .from('routine_pdfs')
          .insert({ owner_id: user.id, routine_id: id, student_id: routine.student_id, status: 'pendiente' })
          .select('id')
          .single()
        if (error || !created) {
          console.error('[PDF] Insert error full:', JSON.stringify(error))
          console.error('[PDF] user.id:', user.id, 'routine.student_id:', routine.student_id)
          throw new Error(error?.message ?? 'No se pudo crear la solicitud')
        }
        pdfId = created.id
      }

      await generateRoutinePdf(id, pdfId)

      // Descargar directamente
      const { data: pdfRecord } = await supabase
        .from('routine_pdfs')
        .select('file_path')
        .eq('id', pdfId)
        .single()

      if (pdfRecord?.file_path) {
        const { data: signedUrl } = await supabase.storage
          .from('routine-pdfs')
          .createSignedUrl(pdfRecord.file_path, 120)
        if (signedUrl?.signedUrl) {
          window.open(signedUrl.signedUrl, '_blank')
        }
      }

      toast.success('PDF generado y descargado', { id: toastId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error generando PDF', { id: toastId })
    } finally {
      setGeneratingPdf(false)
    }
  }

  async function handleStatusChange(newStatus: string) {
    if (!id) return
    const result = await updateRoutine(id, {
      status: newStatus as Routine['status'],
      last_status_change: new Date().toISOString(),
    })
    if (result) setRoutine((prev) => prev ? { ...prev, status: newStatus as Routine['status'] } : prev)
  }

  if (loading) return <div><Header title="Rutina" showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
  if (!routine) return <div><Header title="Rutina" showBack /><p className="p-6 text-ink-muted">Rutina no encontrada.</p></div>

  const days = daysUntil(routine.end_date)

  return (
    <div>
      <Header title={routine.student?.full_name ?? 'Rutina'} showBack />

      <div className="px-4 lg:px-6 py-6 space-y-5">
        {/* Cabecera */}
        <Card>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted uppercase tracking-wider mb-1">{routine.name}</p>
              <h2 className="text-xl font-bold text-ink-primary">
                {routine.student?.full_name ?? '—'}
              </h2>
            </div>
            <Badge status={routine.status} size="md" />
          </div>

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <MetricBox label="Inicio" value={formatDate(routine.start_date)} />
            <MetricBox label="Vencimiento" value={formatDate(routine.end_date)} />
            <MetricBox
              label="Días restantes"
              value={days <= 0 ? 'Vencida' : `${days}`}
              highlight={days <= 10 && days > 0}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <MetricBox label="Duración" value={`${routine.duration_days} días`} />
            <MetricBox label="Nivel" value={routine.level.charAt(0).toUpperCase() + routine.level.slice(1)} />
          </div>

          {/* Cambiar estado */}
          <Select
            label="Estado de la rutina"
            options={ROUTINE_STATUSES}
            value={routine.status}
            onChange={(e) => handleStatusChange(e.target.value)}
          />

          {/* Acciones */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-border">
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil className="h-3.5 w-3.5" />}
              onClick={() => navigate(`/routines/${id}/edit`)}
            >
              Editar rutina
            </Button>
            <div className="flex-1" />
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-status-expired transition-colors px-2 py-1.5 rounded-lg hover:bg-status-expired/8"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </button>
          </div>
        </Card>

        {/* Objetivo */}
        <Card>
          <CardTitle className="text-sm mb-2">Objetivo del Coach</CardTitle>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{routine.objective}</p>
          {routine.notes && (
            <>
              <CardTitle className="text-sm mb-2 mt-4">Aclaraciones importantes</CardTitle>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap">{routine.notes}</p>
            </>
          )}
        </Card>

        {/* Acciones */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            icon={<Dumbbell className="h-4 w-4" />}
            onClick={() => navigate(`/routines/${id}/editor`)}
            className="w-full"
          >
            Armar rutina
          </Button>
          <Button
            variant="secondary"
            icon={<FileText className="h-4 w-4" />}
            loading={generatingPdf}
            onClick={handleGeneratePdf}
            className="w-full"
          >
            Generar PDF
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar rutina?"
        description="Se eliminarán todos los bloques, días y ejercicios asociados. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

function MetricBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-surface-elevated rounded-xl p-3 text-center">
      <p className="text-xs text-ink-muted mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-status-expiring' : 'text-ink-primary'}`}>{value}</p>
    </div>
  )
}
