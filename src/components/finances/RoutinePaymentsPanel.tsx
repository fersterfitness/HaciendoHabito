import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { formatCurrency } from '@/lib/utils'
import type { Routine } from '@/types/database'

type Row = Pick<Routine, 'id' | 'name' | 'is_paid' | 'paid_other_professional' | 'price' | 'student_id'> & {
  student_name: string
}

export function RoutinePaymentsPanel() {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<Row[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('routines')
      .select('id, name, is_paid, paid_other_professional, price, student_id, student:students(full_name)')
      .eq('owner_id', user.id)
      .in('status', ['activa', 'por_vencer'])
      .order('updated_at', { ascending: false })
    if (error) {
      toast.error(error.message)
      return
    }
    setRows(
      (data ?? []).map((r) => {
        const student = r.student as { full_name?: string } | { full_name?: string }[] | null
        const name = Array.isArray(student) ? student[0]?.full_name : student?.full_name
        return {
          id: r.id as string,
          name: r.name as string,
          is_paid: Boolean(r.is_paid),
          paid_other_professional: Boolean(r.paid_other_professional),
          price: (r.price as number | null) ?? null,
          student_id: r.student_id as string,
          student_name: name ?? 'Alumno',
        }
      }),
    )
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(row: Row, field: 'is_paid' | 'paid_other_professional', value: boolean) {
    setBusyId(row.id)
    const { error } = await supabase.from('routines').update({ [field]: value }).eq('id', row.id)
    setBusyId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r)))
  }

  if (rows.length === 0) return null

  const pending = rows.filter((r) => !r.is_paid).length

  return (
    <section className="overflow-hidden rounded-md border border-zinc-200/70 bg-surface-card p-4 dark:border-zinc-700/65">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-primary">Abonos de rutinas</p>
        <span className="text-[11px] text-ink-muted">
          {pending} pendiente{pending !== 1 ? 's' : ''} · dual/integral: check del otro profesional
        </span>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200/60 bg-zinc-50/40 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
          >
            <div className="min-w-0 flex-1">
              <Link to={`/students/${row.student_id}`} className="truncate text-sm font-semibold text-ink-primary hover:underline">
                {row.student_name}
              </Link>
              <p className="truncate text-[11px] text-ink-muted">
                {row.name}
                {row.price ? ` · ${formatCurrency(row.price)}` : ''}
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-brand-secondary"
                checked={row.is_paid}
                disabled={busyId === row.id}
                onChange={(e) => void toggle(row, 'is_paid', e.target.checked)}
              />
              Abonó
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary">
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
    </section>
  )
}
