import { useEffect, useState } from 'react'
import { Droplets } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import {
  cycleDayOnDate,
  ROUTINE_CYCLE_PHASE_META,
  routinePhaseForCycleDay,
  type RoutineMenstrualPhase,
} from '@/lib/routine/menstrualCyclePlanning'
import type { LatestWeekStatus } from '@/lib/checkIn/latestWeekStatus'
import type { Student } from '@/types/database'
import { cn } from '@/lib/utils'

type CycleRow = {
  studentId: string
  name: string
  phase: RoutineMenstrualPhase | null
  dayInCycle: number | null
  weekLabel: string
}

const PHASE_CLASS: Record<RoutineMenstrualPhase, string> = {
  menstruacion: 'border-rose-500/35 bg-rose-500/10 text-rose-800 dark:text-rose-200',
  folicular: 'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200',
  ovulacion: 'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  lutea: 'border-sky-500/35 bg-sky-500/10 text-sky-800 dark:text-sky-200',
}

function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export function WomenCycleOverview({
  students,
  weekByStudent,
}: {
  students: Student[]
  weekByStudent: Map<string, LatestWeekStatus>
}) {
  const { user } = useAuthStore()
  const [rows, setRows] = useState<CycleRow[]>([])

  useEffect(() => {
    const women = students.filter((s) => s.gender === 'F' && s.status === 'activo')
    if (!user || women.length === 0) {
      setRows([])
      return
    }
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('menstrual_cycles')
        .select('student_id, cycle_start_date, cycle_length, created_at')
        .eq('owner_id', user.id)
        .in('student_id', women.map((s) => s.id))
        .order('cycle_start_date', { ascending: false })
      if (cancelled) return
      const latest = new Map<string, { cycle_start_date: string; cycle_length: number }>()
      for (const c of data ?? []) {
        if (!latest.has(c.student_id)) {
          latest.set(c.student_id, {
            cycle_start_date: c.cycle_start_date,
            cycle_length: c.cycle_length,
          })
        }
      }
      const today = todayIso()
      setRows(
        women.map((s) => {
          const cycle = latest.get(s.id)
          let phase: RoutineMenstrualPhase | null = null
          let dayInCycle: number | null = null
          if (cycle) {
            const day = cycleDayOnDate(cycle.cycle_start_date, today)
            const wrapped = ((day - 1) % Math.max(1, cycle.cycle_length)) + 1
            dayInCycle = wrapped
            phase = routinePhaseForCycleDay(wrapped, cycle.cycle_length)
          }
          const st = weekByStudent.get(s.id)
          const weekLabel = st?.finished
            ? 'Terminó el mes'
            : st?.lastWeek
              ? 'Última semana'
              : st?.weekNumber
                ? `Semana ${st.weekNumber}`
                : 'Sin check-in'
          return { studentId: s.id, name: s.full_name, phase, dayInCycle, weekLabel }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [students, user, weekByStudent])

  if (rows.length === 0) return null

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Droplets className="h-4 w-4 text-rose-500" aria-hidden />
        <h2 className="text-sm font-semibold text-ink-primary">Ciclo menstrual · semana de entrenamiento</h2>
      </div>
      <p className="text-[11px] text-ink-muted">
        Vista general para avisar si esta semana pueden notar más cansancio (menstruación / fase lútea).
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li
            key={r.studentId}
            className="flex items-center justify-between gap-2 rounded-lg border border-surface-border/70 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink-primary">{r.name}</p>
              <p className="text-[11px] text-ink-muted">{r.weekLabel}</p>
            </div>
            {r.phase ? (
              <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold', PHASE_CLASS[r.phase])}>
                {ROUTINE_CYCLE_PHASE_META[r.phase].label}
                {r.dayInCycle != null ? ` · d${r.dayInCycle}` : ''}
              </span>
            ) : (
              <span className="shrink-0 text-[10px] text-ink-muted">Sin fecha</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
