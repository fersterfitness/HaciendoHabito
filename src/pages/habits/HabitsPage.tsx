import { useEffect, useState, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Settings2, Plus, Trash2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { Student, Habit, HabitLog } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Default habits to seed on first use ─────────────────────────────────────
const DEFAULT_HABITS = [
  { emoji: '💧', name: 'Tomar agua',              sort_order: 0 },
  { emoji: '🏋️', name: 'Entrenar',                sort_order: 1 },
  { emoji: '💊', name: 'Tomar suplementos',       sort_order: 2 },
  { emoji: '👟', name: 'Pasos diarios',           sort_order: 3 },
  { emoji: '📋', name: 'Organizarse',             sort_order: 4 },
  { emoji: '📚', name: 'Leer / informarse',       sort_order: 5 },
  { emoji: '⚖️', name: 'Registrar pesos',         sort_order: 6 },
  { emoji: '🥗', name: 'Alimentación saludable',  sort_order: 7 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export function HabitsPage() {
  const { user } = useAuthStore()

  const today      = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const [students,         setStudents]         = useState<Student[]>([])
  const [selectedStudent,  setSelectedStudent]  = useState<string>('')
  const [habits,           setHabits]           = useState<Habit[]>([])
  const [selectedHabitIds, setSelectedHabitIds] = useState<Set<string>>(new Set())
  const [logs,             setLogs]             = useState<HabitLog[]>([])
  const [loadingData,      setLoadingData]      = useState(false)
  const [showLibrary,      setShowLibrary]      = useState(false)
  const [seeding,          setSeeding]          = useState(false)

  const days = daysInMonth(year, month)

  // ── Load students + habits on mount ──────────────────────────────────────
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('students').select('id, full_name').eq('owner_id', user.id).eq('status', 'activo').order('full_name'),
      supabase.from('habits').select('*').eq('owner_id', user.id).eq('is_active', true).order('sort_order'),
    ]).then(([{ data: s }, { data: h }]) => {
      setStudents((s as Student[]) ?? [])
      const hs = (h as Habit[]) ?? []
      setHabits(hs)
    })
  }, [user])

  // ── Seed default habits if library is empty ───────────────────────────────
  async function seedDefaults() {
    if (!user) return
    setSeeding(true)
    const rows = DEFAULT_HABITS.map((h) => ({ ...h, owner_id: user.id }))
    const { data, error } = await supabase.from('habits').insert(rows).select('*')
    setSeeding(false)
    if (error) { toast.error(error.message); return }
    setHabits((data as Habit[]) ?? [])
    toast.success('Hábitos predeterminados creados')
  }

  // ── Load selections + logs when student or month changes ─────────────────
  const loadStudentData = useCallback(async () => {
    if (!selectedStudent || !user) return
    setLoadingData(true)
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endDate   = `${year}-${String(month + 1).padStart(2, '0')}-${String(days).padStart(2, '0')}`
    const [{ data: sels }, { data: lg }] = await Promise.all([
      supabase.from('student_habit_selections').select('habit_id').eq('student_id', selectedStudent),
      supabase.from('habit_logs').select('*').eq('student_id', selectedStudent).gte('log_date', startDate).lte('log_date', endDate),
    ])
    setSelectedHabitIds(new Set((sels ?? []).map((s: { habit_id: string }) => s.habit_id)))
    setLogs((lg as HabitLog[]) ?? [])
    setLoadingData(false)
  }, [selectedStudent, year, month, days, user])

  useEffect(() => { loadStudentData() }, [loadStudentData])

  // ── Log set for fast lookup ───────────────────────────────────────────────
  const logSet = useMemo(() => {
    const s = new Set<string>()
    logs.forEach((l) => s.add(`${l.habit_id}:${l.log_date}`))
    return s
  }, [logs])

  // ── Active habits for this student (ordered) ──────────────────────────────
  const activeHabits = useMemo(
    () => habits.filter((h) => selectedHabitIds.has(h.id)),
    [habits, selectedHabitIds],
  )

  // ── Toggle a cell ─────────────────────────────────────────────────────────
  async function toggleDay(habitId: string, day: number) {
    if (!user || !selectedStudent) return
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const key     = `${habitId}:${dateStr}`
    const isDone  = logSet.has(key)

    // Optimistic
    if (isDone) {
      const snapshot = logs
      setLogs((prev) => prev.filter((l) => !(l.habit_id === habitId && l.log_date === dateStr)))
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('student_id', selectedStudent)
        .eq('habit_id', habitId)
        .eq('log_date', dateStr)
        .eq('owner_id', user.id)   // ← solo elimina los propios
      if (error) {
        setLogs(snapshot)           // ← rollback
        toast.error(error.message)
      }
    } else {
      const tempLog: HabitLog = { id: crypto.randomUUID(), owner_id: user.id, student_id: selectedStudent, habit_id: habitId, log_date: dateStr, created_at: new Date().toISOString() }
      setLogs((prev) => [...prev, tempLog])
      const { error } = await supabase.from('habit_logs').insert({ owner_id: user.id, student_id: selectedStudent, habit_id: habitId, log_date: dateStr })
      if (error) {
        setLogs((prev) => prev.filter((l) => l.id !== tempLog.id))
        toast.error(error.message)
      }
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayDay = year === today.getFullYear() && month === today.getMonth() ? today.getDate() : days
    return activeHabits.map((h) => {
      const done = logs.filter((l) => l.habit_id === h.id).length
      return { habit: h, done, total: todayDay, pct: pct(done, todayDay) }
    })
  }, [activeHabits, logs, year, month, days, today])

  const overallPct = stats.length
    ? Math.round(stats.reduce((s, x) => s + x.pct, 0) / stats.length)
    : 0

  // ── Month nav ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
  }

  const dayNums = Array.from({ length: days }, (_, i) => i + 1)

  return (
    <div>
      <Header
        title="Hábitos"
        actions={
          selectedStudent && (
            <button
              onClick={() => setShowLibrary(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-elevated text-ink-secondary hover:text-ink-primary text-xs font-medium transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" /> Gestionar hábitos
            </button>
          )
        }
      />

      <div className="px-4 lg:px-6 py-4 space-y-4">

        {/* Selector de alumno */}
        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">Alumno</label>
          <select
            className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">Seleccioná un alumno...</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>

        {!selectedStudent ? (
          <EmptyState
            icon={<span className="text-3xl">📋</span>}
            title="Seleccioná un alumno"
            description="Elegí un alumno para ver y cargar su registro de hábitos mensual."
          />
        ) : loadingData ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* Navegador de mes */}
            <div className="flex items-center justify-between bg-surface-card border border-surface-border rounded-xl px-3 py-2">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-surface-elevated text-ink-muted hover:text-ink-primary transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-ink-primary capitalize">{monthLabel(year, month)}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-surface-elevated text-ink-muted hover:text-ink-primary transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Sin hábitos asignados */}
            {activeHabits.length === 0 ? (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-6 text-center space-y-3">
                <p className="text-2xl">📋</p>
                <p className="text-sm font-semibold text-ink-primary">Sin hábitos asignados</p>
                <p className="text-xs text-ink-muted">
                  {habits.length === 0
                    ? 'Primero creá los hábitos en la biblioteca.'
                    : 'Usá "Gestionar hábitos" para asignar hábitos a este alumno.'}
                </p>
                {habits.length === 0 && (
                  <button
                    onClick={seedDefaults}
                    disabled={seeding}
                    className="inline-flex items-center gap-1.5 text-xs text-brand-primary hover:underline disabled:opacity-50"
                  >
                    {seeding ? 'Creando...' : '✨ Crear hábitos predeterminados'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Resumen stats */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="col-span-2 sm:col-span-1 bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-3 text-center">
                    <p className="text-[10px] text-brand-primary uppercase tracking-wide font-semibold">Promedio general</p>
                    <p className="text-3xl font-bold text-brand-primary">{overallPct}%</p>
                  </div>
                  {stats.slice(0, 3).map(({ habit, done, total, pct: p }) => (
                    <div key={habit.id} className="bg-surface-card border border-surface-border rounded-xl p-3 text-center">
                      <p className="text-base">{habit.emoji}</p>
                      <p className="text-[10px] text-ink-muted truncate">{habit.name}</p>
                      <p className="text-lg font-bold text-ink-primary">{p}%</p>
                      <p className="text-[10px] text-ink-muted">{done}/{total}</p>
                    </div>
                  ))}
                </div>

                {/* Grilla mensual */}
                <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-surface-elevated px-3 py-2 text-left text-[10px] font-semibold text-ink-muted uppercase tracking-wider min-w-[130px] border-b border-r border-surface-border">
                            Hábito
                          </th>
                          {dayNums.map((d) => {
                            const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
                            return (
                              <th
                                key={d}
                                className={cn(
                                  'border-b border-surface-border px-0 py-2 text-center text-[10px] font-medium min-w-[28px] w-[28px]',
                                  isToday ? 'text-brand-primary bg-brand-primary/5' : 'text-ink-muted bg-surface-elevated',
                                )}
                              >
                                {d}
                              </th>
                            )
                          })}
                          <th className="border-b border-l border-surface-border px-2 py-2 text-center text-[10px] font-semibold text-ink-muted uppercase tracking-wider bg-surface-elevated min-w-[52px]">
                            %
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.map(({ habit, pct: p }, rowIdx) => (
                          <tr key={habit.id} className={rowIdx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-elevated/40'}>
                            {/* Habit name — sticky */}
                            <td className={cn(
                              'sticky left-0 z-10 px-3 py-1.5 border-r border-surface-border text-xs font-medium text-ink-primary truncate max-w-[130px]',
                              rowIdx % 2 === 0 ? 'bg-surface-card' : 'bg-surface-elevated/40',
                            )}>
                              <span className="mr-1.5">{habit.emoji}</span>{habit.name}
                            </td>
                            {/* Day cells */}
                            {dayNums.map((d) => {
                              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                              const done    = logSet.has(`${habit.id}:${dateStr}`)
                              const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
                              return (
                                <td key={d} className={cn('px-0 py-1 text-center', isToday && 'bg-brand-primary/5')}>
                                  <button
                                    onClick={() => toggleDay(habit.id, d)}
                                    className={cn(
                                      'w-5 h-5 rounded-md mx-auto flex items-center justify-center transition-all',
                                      done
                                        ? 'bg-brand-primary text-white'
                                        : 'border border-surface-border hover:border-brand-primary/50 hover:bg-brand-primary/5',
                                    )}
                                  >
                                    {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                  </button>
                                </td>
                              )
                            })}
                            {/* % */}
                            <td className="border-l border-surface-border px-2 py-1.5 text-center">
                              <span className={cn(
                                'text-xs font-bold',
                                p >= 80 ? 'text-brand-primary' :
                                p >= 50 ? 'text-status-expiring' : 'text-status-expired',
                              )}>
                                {p}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Barra de progreso por hábito */}
                <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Detalle del mes</p>
                  {stats.map(({ habit, done, total, pct: p }) => (
                    <div key={habit.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-ink-primary">{habit.emoji} {habit.name}</span>
                        <span className="text-xs font-semibold text-ink-secondary">{done}/{total} días · {p}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            p >= 80 ? 'bg-brand-primary' :
                            p >= 50 ? 'bg-status-expiring' : 'bg-status-expired',
                          )}
                          style={{ width: `${p}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showLibrary && (
        <HabitLibraryModal
          habits={habits}
          selectedIds={selectedHabitIds}
          studentId={selectedStudent}
          userId={user!.id}
          onClose={() => setShowLibrary(false)}
          onHabitsChange={setHabits}
          onSelectionsChange={setSelectedHabitIds}
        />
      )}
    </div>
  )
}

// ─── HabitLibraryModal ────────────────────────────────────────────────────────

function HabitLibraryModal({
  habits, selectedIds, studentId, userId,
  onClose, onHabitsChange, onSelectionsChange,
}: {
  habits: Habit[]
  selectedIds: Set<string>
  studentId: string
  userId: string
  onClose: () => void
  onHabitsChange: (h: Habit[]) => void
  onSelectionsChange: (s: Set<string>) => void
}) {
  const [newName,  setNewName]  = useState('')
  const [newEmoji, setNewEmoji] = useState('✅')
  const [adding,   setAdding]   = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function addHabit() {
    if (!newName.trim()) return
    setAdding(true)
    const { data, error } = await supabase.from('habits').insert({
      owner_id: userId, name: newName.trim(), emoji: newEmoji, sort_order: habits.length,
    }).select('*').single()
    setAdding(false)
    if (error) { toast.error(error.message); return }
    onHabitsChange([...habits, data as Habit])
    setNewName(''); setNewEmoji('✅')
    toast.success('Hábito creado')
  }

  async function deleteHabit(id: string) {
    const { error } = await supabase
      .from('habits')
      .update({ is_active: false })
      .eq('id', id)
      .eq('owner_id', userId)  // ← solo el dueño puede desactivar
    if (error) { toast.error(error.message); return }
    onHabitsChange(habits.filter((h) => h.id !== id))
    const next = new Set(selectedIds); next.delete(id); onSelectionsChange(next)
  }

  async function toggleSelection(habitId: string) {
    setToggling(habitId)
    const isSelected = selectedIds.has(habitId)
    if (isSelected) {
      const prevIds = new Set(selectedIds)
      const next = new Set(selectedIds); next.delete(habitId); onSelectionsChange(next)
      const { error } = await supabase
        .from('student_habit_selections')
        .delete()
        .eq('student_id', studentId)
        .eq('habit_id', habitId)
        .eq('owner_id', userId)  // ← solo el dueño
      if (error) { onSelectionsChange(prevIds); toast.error(error.message) }
    } else {
      const { error } = await supabase
        .from('student_habit_selections')
        .insert({ student_id: studentId, habit_id: habitId, owner_id: userId })
      if (error) { toast.error(error.message); setToggling(null); return }
      const next = new Set(selectedIds); next.add(habitId); onSelectionsChange(next)
    }
    setToggling(null)
  }

  const EMOJI_OPTIONS = ['✅','💧','🏋️','💊','👟','📋','📚','⚖️','🥗','😴','🧘','🚴','🫀','🧠','💪','🎯']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Gestionar hábitos</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold mb-2">
            Tildá los hábitos que sigue este alumno
          </p>
          {habits.map((h) => {
            const isSelected = selectedIds.has(h.id)
            const isToggling = toggling === h.id
            return (
              <div key={h.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-elevated">
                <button
                  onClick={() => toggleSelection(h.id)}
                  disabled={isToggling}
                  className={cn(
                    'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                    isSelected ? 'bg-brand-primary border-brand-primary' : 'border-surface-border',
                  )}
                >
                  {isSelected && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                </button>
                <span className="text-base shrink-0">{h.emoji}</span>
                <span className="flex-1 text-sm text-ink-primary">{h.name}</span>
                <button onClick={() => deleteHabit(h.id)} className="text-ink-muted hover:text-status-expired transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Agregar nuevo hábito */}
        <div className="border-t border-surface-border px-4 py-3 space-y-2">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide font-semibold">Nuevo hábito</p>
          <div className="flex gap-2">
            <select
              className="bg-surface-elevated text-ink-primary text-sm rounded-xl px-2 py-2 border border-surface-border outline-none"
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
            >
              {EMOJI_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <input
              placeholder="Nombre del hábito..."
              className="flex-1 bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addHabit() }}
            />
            <button
              onClick={addHabit}
              disabled={adding || !newName.trim()}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-primary text-white disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
