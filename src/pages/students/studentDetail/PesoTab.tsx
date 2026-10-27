import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Scale, X } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartAreaGradient, ChartTooltip, chartActiveDot, chartAxis, chartCursor, chartGrid } from '@/components/charts/chartKit'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { updateStudentTrainerPrefs } from '@/lib/students/studentTrainerPrefs'
import { cn } from '@/lib/utils'
import type { StudentWeightLog } from '@/types/database'

export function PesoTab({
  studentId,
  targetWeightKg,
  onTargetWeightKgChange,
}: {
  studentId: string
  targetWeightKg: number | null
  onTargetWeightKgChange: (kg: number | null) => void
}) {
  const { user } = useAuthStore()
  const [logs,    setLogs]    = useState<StudentWeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [weight,   setWeight]  = useState('')
  const [fat,      setFat]     = useState('')
  const [noteVal,  setNoteVal] = useState('')
  const [dateVal,  setDateVal] = useState(new Date().toISOString().split('T')[0])
  const [saving,   setSaving]  = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('student_weight_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('owner_id', user.id)
      .order('logged_at', { ascending: false })
    if (!error) setLogs((data as StudentWeightLog[]) ?? [])
    setLoading(false)
  }, [user, studentId])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  async function handleSave() {
    if (!user) return
    const w = Number(weight)
    if (!w || w <= 0) { toast.error('Ingresá un peso válido'); return }
    setSaving(true)
    const { error } = await supabase.from('student_weight_logs').insert({
      owner_id:     user.id,
      student_id:   studentId,
      logged_at:    dateVal,
      weight_kg:    w,
      body_fat_pct: fat ? Number(fat) : null,
      notes:        noteVal || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Peso registrado')
    setWeight(''); setFat(''); setNoteVal('')
    setDateVal(new Date().toISOString().split('T')[0])
    setShowForm(false)
    void fetchLogs()
  }

  async function handleDelete(logId: string) {
    if (!user) return
    const prev = logs
    setLogs((p) => p.filter((l) => l.id !== logId))
    const { error } = await supabase
      .from('student_weight_logs')
      .delete()
      .eq('id', logId)
      .eq('owner_id', user.id)
    if (error) { setLogs(prev); toast.error(error.message) }
  }

  const chartData = useMemo(
    () => [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
    [logs],
  )

  const [goal, setGoal] = useState<number | null>(targetWeightKg)
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  useEffect(() => {
    setGoal(targetWeightKg)
  }, [targetWeightKg])

  async function saveGoal() {
    const v = Number(goalInput)
    if (!v || v <= 0) {
      toast.error('Ingresá un peso válido')
      return
    }
    setSavingGoal(true)
    const err = await updateStudentTrainerPrefs(studentId, { target_weight_kg: v })
    setSavingGoal(false)
    if (err) {
      toast.error(err)
      return
    }
    setGoal(v)
    onTargetWeightKgChange(v)
    setEditingGoal(false)
    toast.success('Peso objetivo guardado')
  }

  return (
    <div className="space-y-4">
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-surface-border/50 pb-3">
          <h3 className="text-sm font-semibold text-ink-primary">Historial de peso</h3>
          <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowForm((v) => !v)}>
            Registrar
          </Button>
        </div>

        {/* Quick-add form */}
        {showForm && (
          <div className="mt-4 space-y-3 border border-surface-border/55 bg-surface-elevated/50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-3xs text-ink-muted uppercase tracking-wide mb-1">Peso (kg) *</label>
                <input
                  type="number" min={0} step={0.1} placeholder="ej: 75.5"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none text-center font-bold"
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-3xs text-ink-muted uppercase tracking-wide mb-1">Grasa corporal %</label>
                <input
                  type="number" min={0} max={100} step={0.1} placeholder="opcional"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                  value={fat} onChange={(e) => setFat(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-3xs text-ink-muted uppercase tracking-wide mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none"
                  value={dateVal} onChange={(e) => setDateVal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-3xs text-ink-muted uppercase tracking-wide mb-1">Notas</label>
                <input
                  placeholder="opcional"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none placeholder:text-ink-muted"
                  value={noteVal} onChange={(e) => setNoteVal(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="text-xs text-ink-muted hover:text-ink-primary px-3 py-1.5 rounded-lg hover:bg-surface-card transition-colors">
                Cancelar
              </button>
              <Button size="sm" variant="secondary" loading={saving} onClick={handleSave}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-8 w-8" aria-hidden />}
            title="Sin registros de peso"
            description="Registrá el peso periódicamente para ver la evolución."
          />
        ) : (
          <>
            {/* Weight line chart */}
            {chartData.length >= 2 && (() => {
              const first = chartData[0]
              const last  = chartData[chartData.length - 1]
              const delta = Math.round((last.weight_kg - first.weight_kg) * 10) / 10
              const hasFat = chartData.some((l) => l.body_fat_pct != null)
              const rechartsData = chartData.map((l) => ({
                date:   l.logged_at.slice(5),
                weight: l.weight_kg,
                fat:    l.body_fat_pct ?? undefined,
              }))
              return (
                <div className="mb-5">
                  {/* KPIs row */}
                  <div className="flex items-end gap-5 mb-3 px-1 flex-wrap">
                    <div>
                      <p className="text-3xs text-ink-muted uppercase tracking-wide">Actual</p>
                      <p className="text-2xl font-bold text-ink-primary">{last.weight_kg} <span className="text-sm font-normal text-ink-muted">kg</span></p>
                    </div>
                    <div>
                      <p className="text-3xs text-ink-muted uppercase tracking-wide">Δ inicio</p>
                      <p
                        className={cn(
                          'text-base font-bold tabular-nums',
                          delta === 0 ? 'text-ink-muted' : 'text-ink-primary',
                        )}
                      >
                        {delta > 0 ? '+' : ''}{delta} kg
                      </p>
                    </div>
                    {hasFat && last.body_fat_pct != null && (
                      <div>
                        <p className="text-3xs text-ink-muted uppercase tracking-wide">% Grasa</p>
                        <p className="text-base font-bold text-ink-secondary">{last.body_fat_pct}%</p>
                      </div>
                    )}
                    {goal && (
                      <div>
                        <p className="text-3xs text-ink-muted uppercase tracking-wide">Objetivo</p>
                        <p className="text-base font-bold tabular-nums text-ink-primary">{goal} kg</p>
                        {(() => {
                          const toGoal = Math.round((last.weight_kg - goal) * 10) / 10
                          return toGoal !== 0 && (
                            <p className="text-3xs text-ink-muted">{toGoal > 0 ? `-${toGoal}` : `+${Math.abs(toGoal)}`} kg restantes</p>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  {/* Barra progreso hacia objetivo */}
                  {goal && (() => {
                    const start = first.weight_kg
                    const curr = last.weight_kg
                    const pct = start === goal ? 100 : Math.min(100, Math.max(0, Math.round(Math.abs(start - curr) / Math.abs(start - goal) * 100)))
                    return (
                      <div className="mb-3 px-1">
                        <div className="flex justify-between text-3xs text-ink-muted mb-1">
                          <span>Inicio: {start} kg</span>
                          <span className="font-semibold text-ink-secondary ">{pct}% completado</span>
                          <span>Objetivo: {goal} kg</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-border ">
                          <div className="h-full rounded-full bg-zinc-500 transition-all " style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })()}

                  <ResponsiveContainer width="100%" height={190}>
                    <ComposedChart data={rechartsData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <ChartAreaGradient id="peso-fill" color="#ff5a0a" opacity={0.3} />
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="date" {...chartAxis} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} {...chartAxis} width={36} />
                      {goal ? (
                        <ReferenceLine
                          y={goal}
                          stroke="#10b981"
                          strokeDasharray="5 4"
                          strokeOpacity={0.8}
                          label={{ value: `Meta ${goal} kg`, position: 'insideTopRight', fontSize: 10, fill: '#10b981' }}
                        />
                      ) : null}
                      <Tooltip
                        cursor={chartCursor}
                        content={
                          <ChartTooltip
                            formatValue={(v, e) => (e.dataKey === 'fat' ? `${v}%` : `${v} kg`)}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="weight"
                        name="Peso"
                        stroke="#ff5a0a"
                        strokeWidth={2.5}
                        fill="url(#peso-fill)"
                        dot={{ r: 3, fill: '#ff5a0a', stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
                        activeDot={chartActiveDot('#ff5a0a')}
                      />
                      {hasFat && (
                        <Line
                          type="monotone"
                          dataKey="fat"
                          name="% grasa"
                          stroke="rgb(var(--ink-muted))"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          dot={false}
                          activeDot={chartActiveDot('rgb(var(--ink-muted))')}
                          connectNulls
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}

            {/* Objetivo de peso */}
            {editingGoal ? (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="number" min={30} max={300} step={0.5} autoFocus
                  placeholder="Peso objetivo (kg)"
                  className="flex-1 bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary/60 outline-none text-center"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                />
                <Button size="sm" variant="gradientSecondary" loading={savingGoal} onClick={() => void saveGoal()}>
                  Guardar
                </Button>
                <button onClick={() => setEditingGoal(false)} className="text-xs text-ink-muted hover:text-ink-primary px-2 py-1.5">Cancelar</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setGoalInput(String(goal ?? '')); setEditingGoal(true) }}
                className="mb-4 flex w-full items-center gap-2 border-b border-dashed border-zinc-400/70 py-3 text-left text-xs text-ink-muted transition-colors hover:border-zinc-500 hover:text-ink-primary "
              >
                {goal ? `Objetivo: ${goal} kg — modificar` : 'Establecer peso objetivo'}
              </button>
            )}

            {/* Log list */}
            <ul className="divide-y divide-surface-border/50">
              {logs.map((l) => (
                <li key={l.id} className="group flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-ink-primary">{l.weight_kg} kg</span>
                    {l.body_fat_pct != null && (
                      <span className="ml-2 text-xs text-ink-muted">{l.body_fat_pct}% grasa</span>
                    )}
                    {l.notes && <p className="mt-0.5 truncate text-xs text-ink-muted">{l.notes}</p>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">{l.logged_at}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    className="text-ink-muted opacity-0 transition-opacity hover:text-ink-secondary group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
