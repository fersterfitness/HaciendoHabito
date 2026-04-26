import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { FormSection } from '@/components/ui/FormSection'
import { PAYMENT_METHODS, EXPENSE_TYPES, EXPENSE_CATEGORIES } from '@/lib/constants'
import toast from 'react-hot-toast'

const schema = z.object({
  expense_date: z.string().min(1, 'Seleccioná la fecha'),
  category: z.string().min(1, 'Seleccioná la categoría'),
  subcategory: z.string().optional(),
  description: z.string().min(2, 'Ingresá una descripción'),
  amount: z.coerce.number().min(0.01, 'Ingresá el monto'),
  expense_type: z.enum(['fijo', 'variable']),
  payment_method: z.enum(['efectivo_debito', 'tarjeta_credito', 'transferencia', 'otro']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      expense_type: 'variable',
      payment_method: 'transferencia',
    },
  })

  useEffect(() => {
    if (!isEditing) return
    supabase.from('expenses').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset({
        expense_date: data.expense_date,
        category: data.category,
        subcategory: data.subcategory ?? '',
        description: data.description,
        amount: data.amount,
        expense_type: data.expense_type,
        payment_method: data.payment_method,
        notes: data.notes ?? '',
      })
    })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    if (!user) return
    const payload = {
      ...values,
      owner_id: user.id,
      subcategory: values.subcategory || null,
      notes: values.notes || null,
    }
    if (isEditing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', id)
      if (error) { toast.error(error.message); return }
      toast.success('Gasto actualizado')
    } else {
      const { error } = await supabase.from('expenses').insert(payload)
      if (error) { toast.error(error.message); return }
      toast.success('Gasto registrado')
    }
    navigate('/finances/expenses')
  }

  return (
    <div>
      <Header title={isEditing ? 'Editar gasto' : 'Nuevo gasto'} showBack />

      <div className="px-4 lg:px-6 py-6 max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection title="Fecha y categoría">
            <Input
              label="Fecha"
              required
              type="date"
              error={errors.expense_date?.message}
              {...register('expense_date')}
            />
            <Select
              label="Categoría"
              required
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Seleccionar categoría"
              error={errors.category?.message}
              {...register('category')}
            />
            <Input
              label="Subcategoría"
              placeholder="Ej: Instagram Ads"
              {...register('subcategory')}
            />
          </FormSection>

          <FormSection title="Descripción y monto">
            <Input
              label="Descripción"
              required
              placeholder="Ej: Renovación plataforma Notion"
              error={errors.description?.message}
              {...register('description')}
            />
            <Input
              label="Monto"
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              leftIcon={<span className="text-ink-muted text-xs">$</span>}
              error={errors.amount?.message}
              {...register('amount')}
            />
          </FormSection>

          <FormSection title="Tipo y pago">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tipo de gasto"
                required
                options={EXPENSE_TYPES}
                {...register('expense_type')}
              />
              <Select
                label="Método de pago"
                required
                options={PAYMENT_METHODS}
                {...register('payment_method')}
              />
            </div>
            <Textarea
              label="Notas adicionales"
              placeholder="Observaciones..."
              rows={2}
              {...register('notes')}
            />
          </FormSection>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>
              {isEditing ? 'Guardar cambios' : 'Registrar gasto'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
