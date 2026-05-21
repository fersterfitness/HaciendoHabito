import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { trainerCtaFormAccentClassName } from '@/lib/primaryGradientCtaClasses'
import { cn, slugify } from '@/lib/utils'
import { slugifyMuscleCatalogName, nextMuscleGroupSortOrder } from '@/lib/exercise/muscleGroupCatalog'
import type { MuscleGroup } from '@/types/database'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Ingresá el nombre del ejercicio'),
  muscle_group_id: z.string().uuid('Seleccioná un grupo muscular'),
  difficulty: z.enum(['basico', 'intermedio', 'avanzado']),
  equipment: z.string().optional(),
  description: z.string().optional(),
  common_errors: z.string().optional(),
  video_url: z.string().url('URL inválida').optional().or(z.literal('')),
  is_active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export function ExerciseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [muscleGroups, setMuscleGroups] = useState<MuscleGroup[]>([])
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { difficulty: 'basico', is_active: true },
  })

  useEffect(() => {
    supabase.from('muscle_groups').select('*').order('sort_order').then(({ data }) => setMuscleGroups(data ?? []))
  }, [])

  useEffect(() => {
    if (!isEditing) return
    supabase.from('exercise_library').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset({
        name: data.name,
        muscle_group_id: data.muscle_group_id,
        difficulty: data.difficulty,
        equipment: data.equipment?.join(', ') ?? '',
        description: data.description ?? '',
        common_errors: data.common_errors ?? '',
        video_url: data.video_url ?? '',
        is_active: data.is_active,
      })
    })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    if (!user) return
    const equipmentArr = values.equipment
      ? values.equipment.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const payload = {
      name: values.name,
      slug: slugify(values.name),
      muscle_group_id: values.muscle_group_id,
      difficulty: values.difficulty,
      equipment: equipmentArr.length > 0 ? equipmentArr : null,
      description: values.description || null,
      common_errors: values.common_errors || null,
      video_url: values.video_url || null,
      is_active: values.is_active,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('exercise_library')
        .update(payload)
        .eq('id', id)
        .eq('owner_id', user.id)   // ← solo el dueño puede editar
      if (error) { toast.error(error.message); return }
      toast.success('Ejercicio actualizado')
    } else {
      const { error } = await supabase.from('exercise_library').insert({ ...payload, owner_id: user.id, is_system: false, is_active: values.is_active })
      if (error) { toast.error(error.message); return }
      toast.success('Ejercicio creado')
    }
    navigate('/exercises')
  }

  async function createMuscleCategory() {
    if (!newCategoryName.trim()) return
    const upperName = newCategoryName.trim().toUpperCase()
    if (muscleGroups.some((g) => g.name.toUpperCase() === upperName)) {
      toast.error(`La categoría "${upperName}" ya existe`)
      return
    }
    setCreatingCategory(true)
    const slug = `${slugifyMuscleCatalogName(newCategoryName)}-${Date.now()}`
    const { data: row, error } = await supabase
      .from('muscle_groups')
      .insert({ name: upperName, slug, sort_order: nextMuscleGroupSortOrder(muscleGroups) })
      .select()
      .single()
    setCreatingCategory(false)
    if (error) {
      toast.error(error.message || 'Error al crear categoría')
      return
    }
    const created = row as MuscleGroup
    setMuscleGroups((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    setValue('muscle_group_id', created.id, { shouldValidate: true, shouldDirty: true })
    toast.success('Categoría creada y seleccionada')
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  async function handleDelete() {
    if (!id || !user) return
    setDeleting(true)
    const { error } = await supabase
      .from('exercise_library')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id)   // ← solo el dueño puede eliminar
    setDeleting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Ejercicio eliminado')
    navigate('/exercises')
  }

  const groupOptions = muscleGroups.map((g) => ({ value: g.id, label: g.name }))

  return (
    <div>
      <Header
        title={isEditing ? 'Editar ejercicio' : 'Nuevo ejercicio'}
        showBack
        actions={
          isEditing && (
            <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>Eliminar</Button>
          )
        }
      />

      <div className="px-4 lg:px-6 py-6 max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Identificación">
            <Input
              label="Nombre del ejercicio"
              required
              placeholder="Ej: Press de banca con barra"
              error={errors.name?.message}
              {...register('name')}
            />
            <Select
              label="Grupo muscular"
              required
              options={groupOptions}
              placeholder="Seleccionar grupo"
              error={errors.muscle_group_id?.message}
              {...register('muscle_group_id')}
            />
            <div className="space-y-2 -mt-1">
              <button
                type="button"
                onClick={() => setShowNewCategory((v) => !v)}
                className="text-xs font-medium text-brand-primary hover:text-brand-primary/80 transition-colors"
              >
                {showNewCategory ? 'Ocultar' : '+'} nueva categoría
              </button>
              {showNewCategory && (
                <div className="rounded-xl border border-surface-border bg-surface-elevated p-3 space-y-2">
                  <Input
                    label="Nombre de la categoría"
                    placeholder="Ej: Antebrazo"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      loading={creatingCategory}
                      disabled={!newCategoryName.trim()}
                      onClick={createMuscleCategory}
                    >
                      Crear categoría
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => { setShowNewCategory(false); setNewCategoryName('') }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Select
              label="Dificultad"
              required
              options={[
                { value: 'basico', label: 'Básico' },
                { value: 'intermedio', label: 'Intermedio' },
                { value: 'avanzado', label: 'Avanzado' },
              ]}
              {...register('difficulty')}
            />
          </FormSection>

          <FormSection title="Detalle">
            <Input
              label="Equipamiento"
              placeholder="Barra, mancuernas, polea... (separados por coma)"
              hint="Ingresá los elementos separados por coma"
              {...register('equipment')}
            />
            <Textarea
              label="Descripción técnica"
              placeholder="Describí la ejecución del ejercicio..."
              rows={3}
              {...register('description')}
            />
            <Textarea
              label="Errores comunes"
              placeholder="Errores frecuentes a corregir..."
              rows={3}
              {...register('common_errors')}
            />
          </FormSection>

          <FormSection title="Multimedia">
            <Input
              label="URL de video de referencia"
              type="url"
              placeholder="https://youtube.com/..."
              error={errors.video_url?.message}
              {...register('video_url')}
            />
          </FormSection>

          <div className="flex items-center gap-3 px-4 py-3 bg-surface-card border border-surface-border rounded-xl">
            <input
              type="checkbox"
              id="is_active"
              className={cn('h-4 w-4', trainerCtaFormAccentClassName)}
              {...register('is_active')}
            />
            <label htmlFor="is_active" className="text-sm text-ink-secondary cursor-pointer">
              Ejercicio activo (visible en el picker de rutinas)
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" variant="gradientSecondary" className="flex-1" loading={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Crear ejercicio'}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="¿Eliminar ejercicio?"
        description="Esta acción no se puede deshacer. Los ejercicios en rutinas existentes no serán afectados."
        confirmLabel="Eliminar"
        loading={deleting}
      />
    </div>
  )
}
