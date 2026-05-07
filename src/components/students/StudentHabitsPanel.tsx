/**
 * Seguimiento de hábitos por alumno (calendario mensual, biblioteca y evolución).
 * Usado dentro de la ficha del alumno y en la página /habits.
 */
import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Settings2,
  Plus,
  Trash2,
  X,
  Check,
  TrendingUp,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/lib/utils'
import { buildMonthlyEvolutionPayload } from '@/lib/habits/habitSelectionHistory'
import type { Habit, HabitLog, StudentHabitSelectionEvent } from '@/types/database'
import toast from 'react-hot-toast'

const DEFAULT_HABITS = [
  { emoji: '💧', name: 'Tomar agua', sort_order: 0 },
  { emoji: '🏋️', name: 'Entrenar', sort_order: 1 },
  { emoji: '💊', name: 'Tomar suplementos', sort_order: 2 },
  { emoji: '👟', name: 'Pasos diarios', sort_order: 3 },
  { emoji: '📋', name: 'Organizarse', sort_order: 4 },
  { emoji: '📚', name: 'Leer / informarse', sort_order: 5 },
  { emoji: '⚖️', name: 'Registrar pesos', sort_order: 6 },
  { emoji: '🥗', name: 'Alimentación saludable', sort_order: 7 },
]

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function monthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}
function pct(done: number, total: number) {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

export function StudentHabitsPanel({
  studentId,
  toolbarLeading,
}: {
  studentId: string
  /** Controles antes de «Gestionar hábitos» (ej. vista amplia / pantalla completa). */
  toolbarLeading?: ReactNode
}) {
  const { user } = useAuthStore()

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [habits, setHabits] = useState<Habit[]>([])
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set())
  const [historicalLogs, setHistoricalLogs] = useState<HabitLog[]>([])
  const [selectionEvents, setSelectionEvents] = useState<StudentHabitSelectionEvent[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [evolutionOpen, setEvolutionOpen] = useState(true)

  const days = daysInMonth(year, month)

  useEffect(() => {
    if (!user) return
    supabase.from('habits').select('*').eq('owner_id', user.id).eq('is_active', true).order('sort_order').then(({ data: h }) => {
      setHabits(((h as Habit[]) ?? []) as Habit[])
    })
  }, [user])

  async function seedDefaults() {
    if (!user) return
    setSeeding(true)
    const rows = DEFAULT_HABITS.map((h) => ({ ...h, owner_id: user.id }))
    const { data, error } = await supabase.from('habits').insert(rows).select('*')
    setSeeding(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setHabits((data as Habit[]) ?? [])
    toast.success('Hábitos predeterminados creados')
  }

  const loadStudentData = useCallback(async () => {
    if (!studentId || !user) return
    setLoadingData(true)
    const monthEndStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`
    const winStart = new Date(year, month - 11, 1)
    const histStartStr = `${winStart.getFullYear()}-${String(winStart.getMonth() + 1).padStart(2, '0')}-01`

    const [selsRes, lgRes, evRes] = await Promise.all([
      supabase.from('student_habit_selections').select('habit_id').eq('student_id', studentId),
      supabase.from('habit_logs').select('*').eq('student_id', studentId).gte('log_date', histStartStr).lte('log_date', monthEndStr),
      supabase
        .from('student_habit_selection_events')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: true }),
    ])
    setSelectedHabitIds(new Set((selsRes.data ?? []).map((s: { habit_id: string }) => s.habit_id)))

    if (lgRes.error) {
      toast.error(lgRes.error.message ?? 'No se pudieron cargar registros.')
      setHistoricalLogs([])
    } else {
      setHistoricalLogs((lgRes.data as HabitLog[]) ?? [])
    }

    if (evRes.error) setSelectionEvents([])
    else setSelectionEvents((evRes.data as StudentHabitSelectionEvent[]) ?? [])

    setLoadingData(false)
  }, [studentId, year, month, days, user])

  useEffect(() => {
    void loadStudentData()
  }, [loadStudentData])

  const reloadSelectionEvents = useCallback(async () => {
    if (!studentId || !user) return
    const { data, error } = await supabase
      .from('student_habit_selection_events')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true })
    if (!error && data) setSelectionEvents(data as StudentHabitSelectionEvent[])
  }, [studentId, user])

  const logs = useMemo(() => {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`
    return historicalLogs.filter((l) => l.log_date >= startDate && l.log_date <= endDate)
  }, [historicalLogs, year, month, days])

  const logSet = useMemo(() => {
    const s = new Set<string>()
    logs.forEach((l) => s.add(`${l.habit_id}:${l.log_date}`))
    return s
  }, [logs])

  const evolutionMonthly = useMemo(() => {
    return buildMonthlyEvolutionPayload(year, month, 12, selectionEvents, historicalLogs, daysInMonth)
  }, [selectionEvents, historicalLogs, year, month])

  const evolutionEventsSortedDesc = useMemo(
    () => [...selectionEvents].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [selectionEvents],
  )

  const activeHabits = useMemo(() => habits.filter((h) => selectedHabitIds.has(h.id)), [habits, selectedHabitIds])

  async function toggleDay(habitId: string, day: number) {
    if (!user || !studentId) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const key = `${habitId}:${dateStr}`
    const isDone = logSet.has(key)

    if (isDone) {
      const snapshot = historicalLogs
      setHistoricalLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.log_date === dateStr)))
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('student_id', studentId)
        .eq('habit_id', habitId)
        .eq('log_date', dateStr)
        .eq('owner_id', user.id)
      if (error) {
        setHistoricalLogs(snapshot)
        toast.error(error.message)
      }
    } else {
      const tempLog: HabitLog = {
        id: crypto.randomUUID(),
        owner_id: user.id,
        student_id: studentId,
        habit_id: habitId,
        log_date: dateStr,
        created_at: new Date().toISOString(),
      }
      setHistoricalLogs((prev) => [...prev, tempLog])
      const { error } = await supabase
        .from('habit_logs')
        .insert({ owner_id: user.id, student_id: studentId, habit_id: habitId, log_date: dateStr })
      if (error) {
        setHistoricalLogs((prev) => prev.filter((l) => l.id !== tempLog.id))
        toast.error(error.message)
      }
    }
  }

  const stats = useMemo(() => {
    return activeHabits.map((h) => {
      const done = logs.filter((l) => l.habit_id === h.id).length
      return { habit: h, done, total: days, pct: pct(done, days) }
    })
  }, [activeHabits, logs, days])

  const overallPct = stats.length ? Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length) : 0

  function prevMonth() {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else setMonth((m) => m + 1)
  }

  const dayNums = Array.from({ length: days }, (_, i) => i + 1)

  if (!user) return null

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3">
        {toolbarLeading ? <div className="flex min-w-0 flex-wrap items-center gap-2">{toolbarLeading}</div> : null}
        <button
          type="button"
          onClick={() => setShowLibrary(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-800',
            !toolbarLeading && 'ml-auto',
          )}
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden /> Gestionar hábitos
        </button>
      </div>

      {loadingData ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-zinc-200/75 bg-zinc-50/50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950/40">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">{monthLabel(year, month)}</span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <details
            open={evolutionOpen}
            onToggle={(e) => setEvolutionOpen(e.currentTarget.open)}
            className="group overflow-hidden rounded-lg border border-zinc-200/75 bg-surface-card dark:border-zinc-700/65"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 [&::-webkit-details-marker]:hidden">
              <div className="flex min-w-0 items-center gap-2">
                <TrendingUp className="h-4 w-4 shrink-0 text-brand-tertiary" aria-hidden />
                <div className="min-w-0">
                  <span className="block text-sm font-semibold text-ink-primary">Evolución mensual y cambios</span>
                  <span className="block text-[10px] text-ink-muted">12 meses hasta {monthLabel(year, month)}</span>
                </div>
              </div>
              <ChevronDown
                className="h-4 w-4 shrink-0 text-ink-muted transition-transform [.group:not([open])_&]:-rotate-90"
                aria-hidden
              />
            </summary>
            <div className="space-y-4 border-t border-zinc-200/60 px-4 pb-4 pt-3 dark:border-zinc-800/80">
              <p className="text-[11px] leading-relaxed text-ink-muted">
                El <strong className="text-ink-primary">promedio</strong> es el % del mes de cada hábito activo. En{' '}
                <strong className="text-ink-primary">Gestionar hábitos</strong> quedan registradas las altas y bajas.
              </p>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={evolutionMonthly.map((row) => ({
                      ...row,
                      barValue: row.avgPct ?? 0,
                    }))}
                    margin={{ top: 4, right: 8, bottom: 24, left: -16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200/70 opacity-60 dark:stroke-zinc-700/70" />
                    <XAxis
                      dataKey="labelShort"
                      tick={{ fontSize: 9, fill: '#71717a' }}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={54}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a' }} tickFormatter={(v) => `${v}%`} width={36} />
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as (typeof evolutionMonthly)[number]
                        return (
                          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-xs shadow-lg dark:border-zinc-600 dark:bg-zinc-950">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.labelShort}</p>
                            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                              Hábitos activos: <span className="font-medium text-zinc-800 dark:text-zinc-200">{p.activeCount}</span>
                            </p>
                            <p className="text-zinc-600 dark:text-zinc-400">
                              Promedio:{' '}
                              <span className="tabular-nums font-medium text-brand-tertiary">
                                {p.avgPct != null ? `${p.avgPct}%` : '—'}
                              </span>
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="barValue" radius={[4, 4, 0, 0]} name="Promedio %" fill="rgb(255, 79, 234)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">Últimos cambios (alta / baja)</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                  {evolutionEventsSortedDesc.length === 0 ? (
                    <p className="p-3 text-xs leading-relaxed text-ink-muted">
                      Todavía no hay altas ni bajas registradas desde esta versión.
                    </p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead className="bg-zinc-50/90 text-zinc-600 dark:bg-zinc-900/70 dark:text-zinc-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                          <th className="px-3 py-2 text-left font-semibold">Cambio</th>
                          <th className="px-3 py-2 text-left font-semibold">Hábito</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evolutionEventsSortedDesc.slice(0, 40).map((ev) => {
                          const habit = habits.find((h) => h.id === ev.habit_id)
                          return (
                            <tr key={ev.id} className="border-t border-zinc-200/55 dark:border-zinc-800/80">
                              <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-muted">
                                {formatDate(ev.created_at, 'dd/MM/yyyy HH:mm')}
                              </td>
                              <td
                                className={cn(
                                  'whitespace-nowrap px-3 py-2 font-medium',
                                  ev.action === 'assigned'
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-amber-700 dark:text-amber-400',
                                )}
                              >
                                {ev.action === 'assigned' ? 'Agregado' : 'Quitado'}
                              </td>
                              <td className="px-3 py-2 text-ink-primary">
                                {habit ? (
                                  <>
                                    <span className="mr-1">{habit.emoji}</span>
                                    {habit.name}
                                  </>
                                ) : (
                                  <span className="italic text-ink-muted">Hábito (desactivado)</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </details>

          {activeHabits.length === 0 ? (
            <div className="space-y-3 rounded-lg border border-zinc-200/75 bg-zinc-50/40 p-6 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
              <p className="text-2xl" aria-hidden>
                📋
              </p>
              <p className="text-sm font-semibold text-ink-primary">Sin hábitos asignados</p>
              <p className="text-xs text-ink-muted">
                {habits.length === 0
                  ? 'Primero creá los hábitos en la biblioteca (o cargá los predeterminados).'
                  : 'Usá «Gestionar hábitos» para asignar hábitos a este alumno.'}
              </p>
              {habits.length === 0 && (
                <button
                  type="button"
                  onClick={seedDefaults}
                  disabled={seeding}
                  className="text-xs font-medium text-[#ff4800] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {seeding ? 'Creando…' : 'Crear hábitos predeterminados'}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="col-span-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-center dark:bg-emerald-500/[0.12] sm:col-span-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-400">Promedio general</p>
                  <p className="text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{overallPct}%</p>
                </div>
                {stats.slice(0, 3).map(({ habit, done, total, pct: p }) => (
                  <div key={habit.id} className="rounded-lg border border-zinc-200/75 bg-surface-card p-3 text-center dark:border-zinc-700">
                    <p className="text-base">{habit.emoji}</p>
                    <p className="truncate text-[10px] text-ink-muted">{habit.name}</p>
                    <p className="text-lg font-bold tabular-nums text-ink-primary">{p}%</p>
                    <p className="text-[10px] text-ink-muted">
                      {done}/{total}
                    </p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-lg border border-zinc-200/75 dark:border-zinc-700">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="sticky left-0 z-10 min-w-[130px] border-b border-r border-zinc-200/70 bg-zinc-100 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                          Hábito
                        </th>
                        {dayNums.map((d) => {
                          const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
                          return (
                            <th
                              key={d}
                              className={cn(
                                'min-w-[28px] border-b border-zinc-200/70 px-0 py-2 text-center text-[10px] font-medium dark:border-zinc-700',
                                isToday ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-950 dark:text-zinc-500',
                              )}
                            >
                              {d}
                            </th>
                          )
                        })}
                        <th className="min-w-[52px] border-b border-l border-zinc-200/70 bg-zinc-50 px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                          %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.map(({ habit, pct: p }, rowIdx) => (
                        <tr key={habit.id} className={rowIdx % 2 === 0 ? 'bg-white dark:bg-zinc-950/30' : 'bg-zinc-50/70 dark:bg-zinc-900/25'}>
                          <td
                            className={cn(
                              'sticky left-0 z-10 max-w-[130px] truncate border-r border-zinc-200/70 px-3 py-1.5 text-xs font-medium dark:border-zinc-700',
                              rowIdx % 2 === 0 ? 'bg-white dark:bg-zinc-950/30' : 'bg-zinc-50/90 dark:bg-zinc-900/25',
                            )}
                          >
                            <span className="mr-1.5">{habit.emoji}</span>
                            {habit.name}
                          </td>
                          {dayNums.map((d) => {
                            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            const doneCell = logSet.has(`${habit.id}:${dateStr}`)
                            const isToday =
                              year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
                            return (
                              <td key={d} className={cn('px-0 py-1 text-center', isToday && 'bg-emerald-500/[0.08] dark:bg-emerald-500/[0.1]')}>
                                <button
                                  type="button"
                                  onClick={() => toggleDay(habit.id, d)}
                                  className={cn(
                                    'mx-auto flex h-5 w-5 items-center justify-center rounded-md transition-all',
                                    doneCell
                                      ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500'
                                      : 'border border-zinc-300 hover:border-emerald-500/50 hover:bg-emerald-500/10 dark:border-zinc-600',
                                  )}
                                  aria-label={doneCell ? 'Quitar día' : 'Marcar día'}
                                >
                                  {doneCell && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                </button>
                              </td>
                            )
                          })}
                          <td className="border-l border-zinc-200/70 px-2 py-1.5 text-center dark:border-zinc-700">
                            <span
                              className={cn(
                                'text-xs font-bold tabular-nums',
                                p >= 80 ? 'text-emerald-600 dark:text-emerald-400' : p >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400',
                              )}
                            >
                              {p}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-zinc-200/75 p-4 dark:border-zinc-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Detalle del mes</p>
                {stats.map(({ habit, done, total, pct: p }) => (
                  <div key={habit.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-ink-primary">
                        {habit.emoji} {habit.name}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-ink-secondary">
                        {done}/{total} días · {p}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-500" style={{ width: `${p}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showLibrary && user && (
        <HabitLibraryModal
          habits={habits}
          selectedIds={selectedHabitIds}
          studentId={studentId}
          userId={user.id}
          onClose={() => setShowLibrary(false)}
          onHabitsChange={setHabits}
          onSelectionsChange={setSelectedHabitIds}
          onSelectionEventLogged={reloadSelectionEvents}
        />
      )}
    </>
  )
}

function HabitLibraryModal({
  habits,
  selectedIds,
  studentId,
  userId,
  onClose,
  onHabitsChange,
  onSelectionsChange,
  onSelectionEventLogged,
}: {
  habits: Habit[]
  selectedIds: Set<string>
  studentId: string
  userId: string
  onClose: () => void
  onHabitsChange: (h: Habit[]) => void
  onSelectionsChange: (s: Set<string>) => void
  onSelectionEventLogged?: () => void
}) {
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [adding, setAdding] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function addHabit() {
    if (!newName.trim()) return
    setAdding(true)
    const { data, error } = await supabase
      .from('habits')
      .insert({
        owner_id: userId,
        name: newName.trim(),
        emoji: newEmoji,
        sort_order: habits.length,
      })
      .select('*')
      .single()
    setAdding(false)
    if (error) {
      toast.error(error.message)
      return
    }
    onHabitsChange([...habits, data as Habit])
    setNewName('')
    setNewEmoji('✅')
    toast.success('Hábito creado')
  }

  async function deleteHabit(id: string) {
    const { error } = await supabase.from('habits').update({ is_active: false }).eq('id', id).eq('owner_id', userId)
    if (error) {
      toast.error(error.message)
      return
    }
    onHabitsChange(habits.filter((h) => h.id !== id))
    const next = new Set(selectedIds)
    next.delete(id)
    onSelectionsChange(next)
  }

  async function toggleSelection(habitId: string) {
    setToggling(habitId)
    const isSelected = selectedIds.has(habitId)
    if (isSelected) {
      const prevIds = new Set(selectedIds)
      const next = new Set(selectedIds)
      next.delete(habitId)
      onSelectionsChange(next)
      const { error } = await supabase
        .from('student_habit_selections')
        .delete()
        .eq('student_id', studentId)
        .eq('habit_id', habitId)
        .eq('owner_id', userId)
      if (error) {
        onSelectionsChange(prevIds)
        toast.error(error.message)
      } else {
        const { error: logErr } = await supabase.from('student_habit_selection_events').insert({
          owner_id: userId,
          student_id: studentId,
          habit_id: habitId,
          action: 'removed',
        })
        if (logErr) console.warn('[habits]', logErr.message)
        else onSelectionEventLogged?.()
      }
    } else {
      const { error } = await supabase.from('student_habit_selections').insert({ student_id: studentId, habit_id: habitId, owner_id: userId })
      if (error) {
        toast.error(error.message)
        setToggling(null)
        return
      }
      const next = new Set(selectedIds)
      next.add(habitId)
      onSelectionsChange(next)
      const { error: logErr } = await supabase.from('student_habit_selection_events').insert({
        owner_id: userId,
        student_id: studentId,
        habit_id: habitId,
        action: 'assigned',
      })
      if (logErr) console.warn('[habits]', logErr.message)
      else onSelectionEventLogged?.()
    }
    setToggling(null)
  }

  const EMOJI_OPTIONS = ['✅', '💧', '🏋️', '💊', '👟', '📋', '📚', '⚖️', '🥗', '😴', '🧘', '🚴', '🫀', '🧠', '💪', '🎯']

  return (
    <div className="fixed inset-0 z-[10050] flex items-end justify-center sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Cerrar" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full flex-col rounded-t-2xl border border-zinc-200 bg-surface-card shadow-2xl sm:max-w-md sm:rounded-2xl dark:border-zinc-700">
        <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 pb-3 pt-4 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-ink-primary">Gestionar hábitos</h3>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink-primary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Marcá los hábitos que seguís para este alumno
          </p>
          {habits.map((h) => {
            const isSel = selectedIds.has(h.id)
            const tol = toggling === h.id
            return (
              <div key={h.id} className="flex min-w-0 items-stretch rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                <button
                  type="button"
                  onClick={() => toggleSelection(h.id)}
                  disabled={tol}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-left transition-colors hover:bg-zinc-100/80 disabled:opacity-60 dark:hover:bg-zinc-800/50',
                  )}
                  aria-pressed={isSel}
                  aria-label={isSel ? `Quitar a ${h.name} del alumno` : `Agregar ${h.name} al alumno`}
                >
                  <span
                    className={cn(
                      'pointer-events-none flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors',
                      isSel ? 'border-emerald-600 bg-emerald-600 dark:border-emerald-500 dark:bg-emerald-500' : 'border-zinc-300 dark:border-zinc-600',
                    )}
                    aria-hidden
                  >
                    {isSel && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="shrink-0 text-base">{h.emoji}</span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-ink-primary">{h.name}</span>
                  {tol && <Spinner className="h-4 w-4 shrink-0 text-[#ff4800]" />}
                </button>
                <button
                  type="button"
                  onClick={() => deleteHabit(h.id)}
                  className="shrink-0 rounded-r-lg border-l border-zinc-200/80 px-3 text-ink-muted transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:border-zinc-700/80"
                  aria-label={`Eliminar hábito ${h.name} de la biblioteca`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        <div className="space-y-2 border-t border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Nuevo hábito</p>
          <div className="flex gap-2">
            <select
              className="rounded-xl border border-zinc-300 bg-zinc-50 px-2 py-2 text-sm text-ink-primary dark:border-zinc-600 dark:bg-zinc-900"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
            >
              {EMOJI_OPTIONS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <input
              placeholder="Nombre del hábito…"
              className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-emerald-500 dark:border-zinc-600 dark:bg-zinc-900"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addHabit()
              }}
            />
            <button
              type="button"
              onClick={addHabit}
              disabled={adding || !newName.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
