import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { motion } from 'motion/react'
import { CalendarCheck2, ChevronRight } from 'lucide-react'
import { summarizeDay, type DayAppointment } from '@/lib/nutrition/consultDay'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

/**
 * v2 · Inicio del nutricionista cuando ya no quedan turnos hoy: cómo cerró el día (atendidos,
 * cobrado, lo que quedó por marcar o cobrar) y qué hay para mañana.
 */
export function DaySummaryCardV2({
  ownerId,
  tomorrowToRemind,
  onGo,
}: {
  ownerId: string
  /** Turnos de mañana a los que falta mandarles el recordatorio. */
  tomorrowToRemind: number
  onGo: (href: string) => void
}) {
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const q = useQuery({
    queryKey: ['v2', 'day-summary', ownerId, today],
    queryFn: async () => {
      const start = new Date(`${today}T00:00:00`)
      const end = new Date(start.getTime() + 86_400_000)
      const [appts, incomes] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, student_id, starts_at, status')
          .eq('owner_id', ownerId)
          .gte('starts_at', start.toISOString())
          .lt('starts_at', end.toISOString()),
        supabase.from('income').select('amount, status, income_date').eq('owner_id', ownerId).eq('income_date', today),
      ])
      return {
        queue: ((appts.data ?? []) as Omit<DayAppointment, 'full_name'>[]).map((a) => ({ ...a, full_name: '' })),
        incomes: ((incomes.data ?? []) as { amount: number; status: string; income_date: string }[]).filter((i) => i.income_date === today),
      }
    },
    staleTime: 30_000,
  })

  if (!q.data) return null
  const s = summarizeDay(q.data.queue, q.data.incomes, now)
  // Solo cuando hubo agenda y ya no queda nada por delante.
  if (!s.total || s.remaining > 0) return null

  const facts: { label: string; value: string }[] = [
    { label: 'Atendidos', value: `${s.attended} de ${s.total}` },
    { label: 'Cobrado hoy', value: formatCurrency(s.collected) },
  ]
  const todo: { text: string; href: string }[] = []
  if (s.unmarked) todo.push({ text: `${s.unmarked} ${s.unmarked === 1 ? 'turno quedó' : 'turnos quedaron'} sin marcar (¿vino o faltó?)`, href: '/appointments' })
  if (s.pendingCharges) todo.push({ text: `${s.pendingCharges} ${s.pendingCharges === 1 ? 'cobro quedó pendiente' : 'cobros quedaron pendientes'}`, href: '/finances' })
  if (tomorrowToRemind) todo.push({ text: `Mandá ${tomorrowToRemind === 1 ? 'el recordatorio' : `los ${tomorrowToRemind} recordatorios`} de mañana (abajo, en «Para hoy»)`, href: '' })

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="Resumen del día"
      className="rounded-2xl border border-surface-border bg-surface-card px-5 py-4"
    >
      <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-secondary">
        <CalendarCheck2 className="h-4 w-4" /> Terminaste los turnos de hoy
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm">
        {facts.map((f) => (
          <div key={f.label}>
            <dt className="text-[12px] text-ink-muted">{f.label}</dt>
            <dd className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      {todo.length ? (
        <ul className="mt-3 divide-y divide-surface-border border-t border-surface-border">
          {todo.map((t) => (
            <li key={t.text}>
              {t.href ? (
                <button type="button" onClick={() => onGo(t.href)} className="group flex w-full items-center justify-between gap-3 py-2.5 text-left text-[13.5px] text-ink-primary">
                  {t.text}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <p className="py-2.5 text-[13.5px] text-ink-primary">{t.text}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-surface-border pt-3 text-[13.5px] text-ink-secondary">Todo cerrado: no quedó nada por marcar ni por cobrar.</p>
      )}
    </motion.section>
  )
}
