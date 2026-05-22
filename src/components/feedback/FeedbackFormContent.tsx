import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Paperclip } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import type { Student, Routine, Exercise } from '@/types/database'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const schema = z.object({
  student_id: z.string().min(1, 'Seleccioná un alumno'),
  title: z.string().min(3, 'El título es requerido'),
  description: z.string().min(5, 'Describí la consulta'),
  routine_id: z.string().optional(),
  exercise_id: z.string().optional(),
  media_url: z.string().url('URL inválida').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

type Props = {
  onSuccess: (questionId: string) => void
  onCancel?: () => void
  formClassName?: string
}

export function FeedbackFormContent({ onSuccess, onCancel, formClassName }: Props) {
  const { user } = useAuthStore()

  const [students, setStudents] = useState<Student[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const selectedStudent = watch('student_id')

  useEffect(() => {
    if (!user) return
    supabase
      .from('students')
      .select('id, full_name')
      .eq('owner_id', user.id)
      .eq('status', 'activo')
      .order('full_name')
      .then(({ data }) => setStudents((data as Student[]) ?? []))
  }, [user])

  useEffect(() => {
    if (!selectedStudent) {
      setRoutines([])
      return
    }
    supabase
      .from('routines')
      .select('id, name')
      .eq('student_id', selectedStudent)
      .in('status', ['activa', 'por_vencer'])
      .order('name')
      .then(({ data }) => setRoutines((data as Routine[]) ?? []))
  }, [selectedStudent])

  useEffect(() => {
    supabase
      .from('exercise_library')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setExercises((data as Exercise[]) ?? []))
  }, [])

  async function onSubmit(values: FormValues) {
    if (!user) return
    let media_url = values.media_url || null

    if (mediaFile) {
      setUploading(true)
      const ext = mediaFile.name.split('.').pop()
      const path = `${user.id}/questions/${Date.now()}.${ext}`
      const { error: uploadErr, data: uploadData } = await supabase.storage
        .from('feedback-videos')
        .upload(path, mediaFile, { upsert: false })
      setUploading(false)
      if (uploadErr) {
        toast.error(uploadErr.message)
        return
      }
      const { data: signed } = await supabase.storage
        .from('feedback-videos')
        .createSignedUrl(uploadData.path, 60 * 60 * 24 * 7)
      media_url = signed?.signedUrl ?? null
    }

    const { data, error } = await supabase
      .from('routine_questions')
      .insert({
        owner_id: user.id,
        student_id: values.student_id,
        title: values.title,
        description: values.description,
        routine_id: values.routine_id || null,
        exercise_id: values.exercise_id || null,
        media_url,
        status: 'recibida',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Consulta registrada')
    reset()
    setMediaFile(null)
    onSuccess(data.id)
  }

  const studentOptions = [
    { value: '', label: 'Seleccioná un alumno...' },
    ...students.map((s) => ({ value: s.id, label: s.full_name })),
  ]
  const routineOptions = [
    { value: '', label: 'Sin rutina asociada' },
    ...routines.map((r) => ({ value: r.id, label: r.name })),
  ]
  const exerciseOptions = [
    { value: '', label: 'Sin ejercicio asociado' },
    ...exercises.map((e) => ({ value: e.id, label: e.name })),
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={cn('space-y-4', formClassName)}>
      <Select
        label="Alumno *"
        options={studentOptions}
        error={errors.student_id?.message}
        {...register('student_id')}
      />

      <Input
        label="Título / asunto *"
        placeholder="ej: Duda sobre la técnica en sentadilla"
        error={errors.title?.message}
        {...register('title')}
      />

      <Textarea
        label="Descripción *"
        placeholder="Describí la consulta o duda del alumno..."
        rows={4}
        error={errors.description?.message}
        {...register('description')}
      />

      <Select
        label="Rutina asociada (opcional)"
        options={routineOptions}
        disabled={!selectedStudent}
        {...register('routine_id')}
      />

      <Select
        label="Ejercicio asociado (opcional)"
        options={exerciseOptions}
        {...register('exercise_id')}
      />

      <Input
        label="URL de adjunto (opcional)"
        placeholder="https://..."
        error={errors.media_url?.message}
        {...register('media_url')}
      />

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary">
          Subir archivo (video/imagen, opcional)
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-surface-border px-3 py-2.5 transition-colors hover:border-brand-secondary/40 hover:bg-surface-elevated/30">
          <Paperclip className="h-4 w-4 text-ink-muted" />
          <span className="text-sm text-ink-muted">{mediaFile ? mediaFile.name : 'Elegir archivo'}</span>
          <input
            type="file"
            accept="video/*,image/*"
            className="hidden"
            onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
        {onCancel ? (
          <Button type="button" variant="ghost" className="sm:flex-1" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="gradientSecondary"
          className={cn(onCancel ? 'sm:flex-[2]' : 'w-full')}
          loading={isSubmitting || uploading}
        >
          {uploading ? 'Subiendo archivo...' : 'Registrar consulta'}
        </Button>
      </div>
    </form>
  )
}
