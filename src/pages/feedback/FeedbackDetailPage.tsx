import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Send, Video, Paperclip } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Card, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { RoutineQuestion, RoutineFeedback, Student, Routine, Exercise } from '@/types/database'
import toast from 'react-hot-toast'

type QuestionFull = RoutineQuestion & {
  student?: Pick<Student, 'full_name'>
  routine?: Pick<Routine, 'name'>
  exercise?: Pick<Exercise, 'name'>
}

const schema = z.object({
  text_response: z.string().min(3, 'Ingresá tu respuesta'),
  video_url_external: z.string().url('URL inválida').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function FeedbackDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [question, setQuestion] = useState<QuestionFull | null>(null)
  const [feedbacks, setFeedbacks] = useState<RoutineFeedback[]>([])
  const [loading, setLoading] = useState(true)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('routine_questions').select('*, student:students(full_name), routine:routines(name), exercise:exercise_library(name)').eq('id', id).single(),
      supabase.from('routine_feedback').select('*').eq('question_id', id).order('responded_at'),
    ]).then(([qRes, fRes]) => {
      if (qRes.data) setQuestion(qRes.data as unknown as QuestionFull)
      if (fRes.data) setFeedbacks(fRes.data)
    }).finally(() => setLoading(false))
  }, [id])

  async function onSubmit(values: FormValues) {
    if (!user || !question) return
    let video_path: string | null = null

    if (videoFile) {
      setUploading(true)
      const ext = videoFile.name.split('.').pop()
      const path = `${user.id}/${id}/feedback-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('feedback-videos').upload(path, videoFile)
      setUploading(false)
      if (uploadError) { toast.error(uploadError.message); return }
      video_path = path
    }

    const { data, error } = await supabase.from('routine_feedback').insert({
      owner_id: user.id,
      question_id: id!,
      text_response: values.text_response,
      video_url_external: values.video_url_external || null,
      video_path,
      responded_at: new Date().toISOString(),
    }).select().single()

    if (error) { toast.error(error.message); return }

    await supabase.from('routine_questions').update({ status: 'devuelta' }).eq('id', id)

    setFeedbacks((prev) => [...prev, data])
    setQuestion((prev) => prev ? { ...prev, status: 'devuelta' } : prev)
    setVideoFile(null)
    reset()
    toast.success('Devolución enviada')
  }

  async function changeStatus(newStatus: RoutineQuestion['status']) {
    const patch: Partial<RoutineQuestion> = { status: newStatus }
    if (newStatus === 'cerrada') patch.closed_at = new Date().toISOString()
    await supabase.from('routine_questions').update(patch).eq('id', id)
    setQuestion((prev) => prev ? { ...prev, ...patch } : prev)
    const labels: Record<string, string> = {
      en_revision: 'Marcada en revisión',
      devuelta:    'Marcada como devuelta',
      cerrada:     'Consulta cerrada',
      recibida:    'Estado actualizado',
    }
    toast.success(labels[newStatus] ?? 'Estado actualizado')
  }

  if (loading) return <div><Header title="Devolución" showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
  if (!question) return <div><Header title="Devolución" showBack /><p className="p-6 text-ink-muted">Consulta no encontrada.</p></div>

  const statusActions: { label: string; status: RoutineQuestion['status'] }[] =
    question.status === 'recibida'    ? [{ label: 'Marcar en revisión', status: 'en_revision' }, { label: 'Cerrar', status: 'cerrada' }] :
    question.status === 'en_revision' ? [{ label: 'Marcar como devuelta', status: 'devuelta' }, { label: 'Cerrar', status: 'cerrada' }] :
    question.status === 'devuelta'    ? [{ label: 'Cerrar consulta', status: 'cerrada' }] :
    []

  return (
    <div>
      <Header
        title="Consulta"
        showBack
        actions={
          statusActions.length > 0 && (
            <div className="flex items-center gap-1.5">
              {statusActions.map(({ label, status }) => (
                <Button
                  key={status}
                  size="sm"
                  variant={status === 'cerrada' ? 'secondary' : 'gradientSecondary'}
                  onClick={() => changeStatus(status)}
                >
                  {label}
                </Button>
              ))}
            </div>
          )
        }
      />

      <div className="px-4 lg:px-6 py-6 space-y-5">
        {/* Datos de la consulta */}
        <Card>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-base font-bold text-ink-primary">{question.student?.full_name ?? '—'}</p>
              <p className="text-xs text-ink-muted">{formatDate(question.received_at)}</p>
            </div>
            <Badge status={question.status} />
          </div>
          {question.routine && <p className="text-xs text-ink-muted mb-1">Rutina: {question.routine.name}</p>}
          {question.exercise && <p className="text-xs text-ink-muted mb-3">Ejercicio: {question.exercise.name}</p>}
          <h3 className="text-sm font-semibold text-ink-primary mb-2">{question.title}</h3>
          <p className="text-sm text-ink-secondary whitespace-pre-wrap">{question.description}</p>
          {question.media_url && (
            <a href={question.media_url} target="_blank" rel="noreferrer" className="mt-3 flex items-center gap-2 text-xs text-brand-primary hover:underline">
              <Paperclip className="h-3.5 w-3.5" /> Ver adjunto del alumno
            </a>
          )}
        </Card>

        {/* Historial de devoluciones */}
        {feedbacks.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-widest mb-3">Respuestas enviadas</h2>
            <div className="space-y-3">
              {feedbacks.map((fb) => (
                <Card key={fb.id} className="border-brand-primary/20 bg-brand-primary/5">
                  <p className="text-xs text-ink-muted mb-2">{formatDate(fb.responded_at)}</p>
                  {fb.text_response && <p className="text-sm text-ink-secondary whitespace-pre-wrap">{fb.text_response}</p>}
                  {fb.video_url_external && (
                    <a href={fb.video_url_external} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-xs text-brand-primary hover:underline">
                      <Video className="h-3.5 w-3.5" /> Ver video de corrección
                    </a>
                  )}
                  {fb.video_path && (
                    <button
                      className="mt-2 flex items-center gap-2 text-xs text-brand-primary hover:underline"
                      onClick={async () => {
                        const { data } = await supabase.storage.from('feedback-videos').createSignedUrl(fb.video_path!, 120)
                        if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                      }}
                    >
                      <Video className="h-3.5 w-3.5" /> Ver video subido
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Formulario de respuesta */}
        {question.status !== 'cerrada' && (
          <Card>
            <CardTitle className="text-sm mb-4">Enviar devolución</CardTitle>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Textarea
                label="Tu respuesta"
                required
                placeholder="Describí la corrección o comentario..."
                rows={4}
                error={errors.text_response?.message}
                {...register('text_response')}
              />
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  URL de video externo (opcional)
                </label>
                <input
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-surface-input text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-inputBorder focus:border-brand-primary outline-none placeholder:text-ink-muted"
                  {...register('video_url_external')}
                />
                {errors.video_url_external && <p className="text-xs text-status-expired mt-1">{errors.video_url_external.message}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Subir video de corrección (opcional)
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl border border-dashed border-surface-border hover:border-brand-primary/50 transition-colors">
                  <Video className="h-4 w-4 text-ink-muted" />
                  <span className="text-sm text-ink-muted">{videoFile ? videoFile.name : 'Elegir video (MP4, MOV, max 200MB)'}</span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <Button
                type="submit"
                variant="gradientSecondary"
                className="w-full"
                icon={<Send className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />}
                loading={isSubmitting || uploading}
              >
                {uploading ? 'Subiendo video...' : 'Enviar devolución'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}
