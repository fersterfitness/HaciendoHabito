import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
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
import { PAYMENT_METHODS, FINANCE_SCOPES, INCOME_STATUSES, INCOME_TYPES, INCOME_CATEGORIES } from '@/lib/constants'

/** Planes con split automático 50 % → Vida Personal */
const SPLIT_PLANS: string[] = ['HÁBITOS PREMIUM', 'HÁBITOS PLATINO', 'HÁBITOS ÉLITE']
import { FormErrorSummary } from '@/components/ui/FormErrorSummary'
import { emptyToNull } from '@/lib/formUtils'
import type { Student } from '@/types/database'
import toast from 'react-hot-toast'

const schema = z.object({
  income_date: z.string().min(1, 'Seleccioná la fecha'),
  student_id: z.string().optional(),
  income_type: z.string().min(1, 'Seleccioná el tipo'),
  category: z.string().min(1, 'Seleccioná la categoría'),
  description: z.string().min(2, 'Ingresá una descripción'),
  amount: z.coerce.number().min(0.01, 'Ingresá el monto'),
  payment_method: z.enum(['efectivo_debito', 'efectivo_ars', 'cuenta_dni', 'mercadopago', 'debito', 'tarjeta_credito', 'transferencia', 'otro']),
  scope: z.enum(['business', 'personal']),
  status: z.enum(['pendiente', 'cobrado', 'cancelado']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function IncomeFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [students, setStudents] = useState<Student[]>([])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      income_date: format(new Date(), 'yyyy-MM-dd'),
      status: 'cobrado',
      payment_method: 'transferencia',
      scope: 'business',
    },
  })

  useEffect(() => {
    if (!user) return
    supabase.from('students').select('id, full_name').eq('owner_id', user.id).eq('status', 'activo').order('full_name').then(({ data }) => setStudents((data as Student[]) ?? []))
  }, [user])

  useEffect(() => {
    if (!isEditing) return
    supabase.from('income').select('*').eq('id', id).single().then(({ data }) => {
      if (data) reset({
        income_date: data.income_date,
        student_id: data.student_id ?? '',
        income_type: data.income_type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        payment_method: data.payment_method,
        scope: data.scope ?? 'business',
        status: data.status,
        notes: data.notes ?? '',
      })
    })
  }, [id, isEditing, reset])

  async function onSubmit(values: FormValues) {
    if (!user) return
    const payload = {
      ...values,
      owner_id: user.id,
      student_id: emptyToNull(values.student_id),
      notes: emptyToNull(values.notes),
    }
    if (isEditing) {
      const { error } = await supabase.from('income').update(payload).eq('id', id).eq('owner_id', user.id)
      if (error) { toast.error(error.message); return }
      toast.success('Ingreso actualizado')
    } else {
      const { error } = await supabase.from('income').insert(payload)
      if (error) { toast.error(error.message); return }

      // Auto-split: si es un plan PREMIUM/PLATINO/ÉLITE en ámbito "business",
      // crear automáticamente el 50 % como ingreso en Vida Personal.
      if (values.scope === 'business' && SPLIT_PLANS.includes(values.income_type)) {
        const splitAmount = Math.round(values.amount / 2)
        const splitPayload = {
          ...payload,
          scope: 'personal' as const,
          amount: splitAmount,
          description: `[HH→Personal] ${values.description}`,
          notes: `Split automático: 50 % del ingreso de Haciéndolo hábito por plan ${values.income_type}. Monto original: $${values.amount.toLocaleString('es-AR')}.`,
        }
        const { error: splitErr } = await supabase.from('income').insert(splitPayload)
        if (splitErr) {
          toast.error(`Ingreso registrado, pero no se pudo crear el split personal: ${splitErr.message}`)
        } else {
          toast.success(`Ingreso registrado + $${splitAmount.toLocaleString('es-AR')} acreditados en Vida personal`)
          navigate('/finances?tab=income')
          return
        }
      } else {
        toast.success('Ingreso registrado')
      }
    }
    navigate('/finances?tab=income')
  }

  const studentOptions = [
    { value: '', label: 'Sin alumno (gasto general)' },
    ...students.map((s) => ({ value: s.id, label: s.full_name })),
  ]

  return (
    <div>
      <Header title={isEditing ? 'Editar ingreso' : 'Nuevo ingreso'} showBack />

      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
        <div className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormErrorSummary errors={errors} />

          <FormSection title="Fecha y alumno">
            <Input
              label="Fecha"
              required
              type="date"
              error={errors.income_date?.message}
              {...register('income_date')}
            />
            <Select
              label="Alumno (opcional)"
              options={studentOptions}
              {...register('student_id')}
            />
          </FormSection>

          <FormSection title="Concepto">
            <Select
              label="Tipo de ingreso"
              required
              options={INCOME_TYPES.map((t) => ({ value: t, label: t }))}
              placeholder="Seleccionar tipo"
              error={errors.income_type?.message}
              {...register('income_type')}
            />
            <Select
              label="Categoría"
              required
              options={INCOME_CATEGORIES.map((c) => ({ value: c, label: c }))}
              placeholder="Seleccionar categoría"
              error={errors.category?.message}
              {...register('category')}
            />
            <Input
              label="Descripción"
              required
              placeholder="Ej: Cuota mensual julio"
              error={errors.description?.message}
              {...register('description')}
            />
          </FormSection>

          <FormSection title="Pago">
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
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Método de pago"
                required
                options={PAYMENT_METHODS}
                {...register('payment_method')}
              />
              <Select
                label="Estado"
                required
                options={INCOME_STATUSES}
                {...register('status')}
              />
            </div>
            <Select
              label="Ámbito"
              required
              options={FINANCE_SCOPES}
              {...register('scope')}
            />
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
            <Button
              type="submit"
              className="flex-1 bg-[#ff4800] shadow-none hover:bg-[#e04100] hover:shadow-none focus-visible:ring-[#ff4800]/45"
              loading={isSubmitting}
            >
              {isEditing ? 'Guardar cambios' : 'Registrar ingreso'}
            </Button>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}
