import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, RefreshCw, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { RoutinePdf, Routine, Student } from '@/types/database'
import toast from 'react-hot-toast'

type PdfFull = RoutinePdf & { routine?: Pick<Routine, 'name'>; student?: Pick<Student, 'full_name'> }

export function RoutinePdfsPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [pdfs, setPdfs] = useState<PdfFull[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)

  const fetchPdfs = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('routine_pdfs')
      .select('*, routine:routines(name), student:students(full_name)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setPdfs((data as unknown as PdfFull[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchPdfs() }, [fetchPdfs])

  async function generatePdf(routineId: string, pdfId: string) {
    setGenerating(pdfId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-routine-pdf`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ routine_id: routineId, pdf_id: pdfId }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Error generando PDF')
      toast.success('PDF generado correctamente')
      fetchPdfs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setGenerating(null)
    }
  }

  async function createPdfRequest(routineId: string) {
    if (!user) return
    const routine = await supabase.from('routines').select('student_id').eq('id', routineId).single()
    if (routine.error) { toast.error(routine.error.message); return }
    const { data, error } = await supabase.from('routine_pdfs').insert({
      owner_id: user.id,
      routine_id: routineId,
      student_id: routine.data.student_id,
      status: 'pendiente',
    }).select().single()
    if (error) { toast.error(error.message); return }
    toast.success('Solicitud de PDF creada')
    fetchPdfs()
    return data
  }

  async function viewPdf(filePath: string) {
    const { data } = await supabase.storage.from('routine-pdfs').createSignedUrl(filePath, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('No se pudo obtener el PDF')
  }

  return (
    <div>
      <Header title="PDFs de Rutina" />

      <div className="px-4 lg:px-6 py-6 max-w-3xl space-y-4">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : pdfs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="Sin PDFs generados"
            description="Los PDFs de rutinas aparecerán aquí una vez generados."
          />
        ) : (
          pdfs.map((pdf) => (
            <Card key={pdf.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-ink-primary truncate">
                    {pdf.student?.full_name ?? '—'}
                  </p>
                  <p className="text-xs text-ink-muted truncate">{pdf.routine?.name ?? '—'}</p>
                </div>
                <Badge status={pdf.status} />
              </div>

              <div className="flex items-center gap-4 text-xs text-ink-muted">
                <span>Creado: {formatDate(pdf.created_at)}</span>
                {pdf.generated_at && <span>Generado: {formatDate(pdf.generated_at)}</span>}
                {pdf.file_size_kb && <span>{pdf.file_size_kb} KB</span>}
              </div>

              {pdf.error_message && (
                <p className="text-xs text-status-expired bg-status-expired/5 rounded-lg px-3 py-2">
                  {pdf.error_message}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                {(pdf.status === 'pendiente' || pdf.status === 'error') && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw className="h-3.5 w-3.5" />}
                    loading={generating === pdf.id}
                    onClick={() => generatePdf(pdf.routine_id, pdf.id)}
                  >
                    {pdf.status === 'error' ? 'Reintentar' : 'Generar PDF'}
                  </Button>
                )}
                {pdf.status === 'generado' && pdf.file_path && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<FileText className="h-3.5 w-3.5" />}
                      onClick={() => viewPdf(pdf.file_path!)}
                    >
                      Ver PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Send className="h-3.5 w-3.5" />}
                      onClick={() => toast('Envío por WhatsApp próximamente', { icon: '📲' })}
                    >
                      Enviar
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/routines/${pdf.routine_id}`)}
                >
                  Ver rutina
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
