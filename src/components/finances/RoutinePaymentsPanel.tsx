import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { Routine } from '@/types/database'
import { MarkPaidModal } from '@/components/finances/MarkPaidModal'
import { markRoutinePaid, unmarkRoutinePaid } from '@/lib/finance/routineIncome'

type Row = Pick<Routine, 'id' | 'name' | 'is_paid' | 'paid_other_professional' | 'price' | 'student_id'> & {
  student_name: string
  /** Cuota mensual del alumno: monto sugerido si la rutina no tiene precio. */
  monthly_fee: number | null
}

export function RoutinePaymentsPanel({ compact = false }: { compact?: boolean }) {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  /** Rutina a la que se le está registrando el cobro (modal de medio y monto). */
  const [paying, setPaying] = useState<Row | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('routines')
      .select('id, name, is_paid, paid_other_professional, price, student_id, student:students(full_name, monthly_fee_amount)')
      .eq('owner_id', user.id)
      .in('status', ['activa', 'por_vencer'])
      .not('student_id', 'is', null)
      .order('updated_at', { ascending: false })
    if (error) {
      toast.error(error.message)
      return
    }
    setRows(
      (data ?? []).map((r) => {
        type S = { full_name?: string; monthly_fee_amount?: number | null }
        const raw = r.student as S | S[] | null
        const student = Array.isArray(raw) ? raw[0] : raw
        const name = student?.full_name
        return {
          id: r.id as string,
          name: r.name as string,
          is_paid: Boolean(r.is_paid),
          paid_other_professional: Boolean(r.paid_other_professional),
          price: (r.price as number | null) ?? null,
          student_id: r.student_id as string,
          student_name: name ?? 'Alumno',
          monthly_fee: student?.monthly_fee_amount ?? null,
        }
      }),
    )
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(row: Row, field: 'is_paid' | 'paid_other_professional', value: boolean) {
    // «Abonó» registra el cobro con medio y monto (y lo sincroniza con Finanzas).
    if (field === 'is_paid') {
      if (value) {
        setPaying(row)
        return
      }
      setBusyId(row.id)
      const err = await unmarkRoutinePaid(row.id)
      setBusyId(null)
      if (err) {
        toast.error(err)
        return
      }
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_paid: false } : r)))
      return
    }
    setBusyId(row.id)
    const { error } = await supabase.from('routines').update({ [field]: value }).eq('id', row.id)
    setBusyId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)))
  }

  async function confirmPaid(values: { amount: number; method: import('@/types/database').PaymentMethod; date: string }) {
    if (!user || !paying) return
    const err = await markRoutinePaid({
      ownerId: user.id,
      routineId: paying.id,
      routineName: paying.name,
      studentId: paying.student_id ?? '',
      amount: values.amount,
      method: values.method,
      date: values.date,
    })
    if (err) {
      toast.error(err)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === paying.id ? { ...r, is_paid: true, price: values.amount || r.price } : r)))
    toast.success('Cobro registrado')
    setPaying(null)
  }

  if (rows.length === 0) return null

  const pending = rows.filter((r) => !r.is_paid).length
  const visible = compact ? rows.filter((r) => !r.is_paid).slice(0, 8) : rows
  const list = visible.length ? visible : rows.slice(0, compact ? 6 : rows.length)

  return (
    <section className="overflow-hidden rounded-md border border-surface-border/70 bg-surface-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-primary">Abonos de rutinas</p>
        <span className="text-2xs text-ink-muted">
          {pending} pendiente{pending !== 1 ? 's' : ''} · dual/integral: check del otro profesional
        </span>
        {compact ? (
          <Link to="/finances" className="ml-auto text-2xs font-medium text-brand-primary hover:underline">
            Finanzas
          </Link>
        ) : null}
      </div>
      <ul className="space-y-2">
        {list.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-surface-border/60 bg-surface-elevated/40 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <Link to={`/students/${row.student_id}`} className="truncate text-sm font-semibold text-ink-primary hover:underline">
                {row.student_name}
              </Link>
              <p className="truncate text-2xs text-ink-muted">
                {row.name}
                {row.price ? ` · ${formatCurrency(row.price)}` : ''}
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 text-2xs font-medium text-ink-secondary">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-secondary"
                checked={row.is_paid}
                disabled={busyId === row.id}
                onChange={(e) => void toggle(row, 'is_paid', e.target.checked)}
              />
              Abonó
            </label>
            <label className="inline-flex items-center gap-1.5 text-2xs font-medium text-ink-secondary">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-secondary"
                checked={row.paid_other_professional}
                disabled={busyId === row.id}
                onChange={(e) => void toggle(row, 'paid_other_professional', e.target.checked)}
              />
              Pagué al otro profesional
            </label>
          </li>
        ))}
      </ul>
      <MarkPaidModal
        open={!!paying}
        title={paying?.student_name ?? ''}
        subtitle={paying?.name}
        defaultAmount={paying?.price ?? paying?.monthly_fee ?? null}
        onClose={() => setPaying(null)}
        onConfirm={confirmPaid}
      />
    </section>
  )
}
