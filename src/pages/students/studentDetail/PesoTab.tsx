import { controlInputClassName } from '@/lib/formControlClasses'
import { CHART_ACCENT } from '@/lib/chartColors'
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
import { cn, formatDate } from '@/lib/utils'
import { IS_V2 } from '@/lib/uiVersion'
import { StatTile } from './StatTile'
import type { StudentWeightLog } from '@/types/database'

type WeightPoint = { date: string; weight: number; fat: number | undefined }

/** En la v2 la grasa tiene su propio eje: en el mismo que el peso lo aplastaba contra el borde. */
function WeightChart({ data, goal, hasFat }: { data: WeightPoint[]; goal: number | null; hasFat: boolean }) {
  const split = IS_V2
  return (
                  <ResponsiveContainer width="100%" height={split ? 240 : 190}>
                    <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <ChartAreaGradient id="peso-fill" color={CHART_ACCENT} opacity={0.3} />
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="date" {...chartAxis} interval="preserveStartEnd" />
                      <YAxis
                        yAxisId="kg"
                        domain={
                          split
                            ? [
                                (min: number) => Math.floor(Math.min(min, goal ?? min) - 1),
                                (max: number) => Math.ceil(Math.max(max, goal ?? max) + 1),
                              ]
                            : ['auto', 'auto']
                        }
                        allowDecimals={!split}
                        {...chartAxis}
                        width={36}
                      />
                      {split && hasFat ? <YAxis yAxisId="fat" orientation="right" hide domain={['dataMin - 4', 'dataMax + 4']} /> : null}
                      {goal ? (
                        <ReferenceLine
                          yAxisId="kg"
                          y={goal}
                          stroke="rgb(var(--chart-ok))"
                          strokeDasharray="5 4"
                          strokeOpacity={0.8}
                          label={{ value: `Meta ${goal} kg`, position: 'insideTopRight', fontSize: 10, fill: 'rgb(var(--chart-ok-ink))' }}
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
                        yAxisId="kg"
                        type="monotone"
                        dataKey="weight"
                        name="Peso"
                        stroke={CHART_ACCENT}
                        strokeWidth={2.5}
                        fill="url(#peso-fill)"
                        dot={{ r: 3, fill: CHART_ACCENT, stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
                        activeDot={chartActiveDot(CHART_ACCENT)}
                      />
                      {hasFat && (
                        <Line
                          yAxisId={split ? 'fat' : 'kg'}
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
  )
}

const fmtKg = (n: number) => Number(n.toFixed(2)).toLocaleString('es-AR')
const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtKg(Math.abs(n))}`

/** v2: cifras arriba, gráfico y registros con el cambio respecto del anterior. */
function WeightBodyV2({
  logs,
  chartData,
  goal,
  editingGoal,
  goalInput,
  savingGoal,
  onGoalInput,
  onStartGoal,
  onCancelGoal,
  onSaveGoal,
  onDelete,
}: {
  /** Del más nuevo al más viejo. */
  logs: StudentWeightLog[]
  /** Del más viejo al más nuevo. */
  chartData: StudentWeightLog[]
  goal: number | null
  editingGoal: boolean
  goalInput: string
  savingGoal: boolean
  onGoalInput: (v: string) => void
  onStartGoal: () => void
  onCancelGoal: () => void
  onSaveGoal: () => void
  onDelete: (id: string) => void
}) {
  const first = chartData[0]!
  const last = chartData[chartData.length - 1]!
  const delta = last.weight_kg - first.weight_kg
  const lastFat = [...chartData].reverse().find((l) => l.body_fat_pct != null)
  const toGoal = goal ? last.weight_kg - goal : null
  const pct =
    goal == null
      ? null
      : first.weight_kg === goal
        ? 100
        : Math.min(100, Math.max(0, Math.round((Math.abs(first.weight_kg - last.weight_kg) / Math.abs(first.weight_kg - goal)) * 100)))
  const points: WeightPoint[] = chartData.map((l) => ({
    date: `${l.logged_at.slice(8, 10)}/${l.logged_at.slice(5, 7)}`,
    weight: l.weight_kg,
    fat: l.body_fat_pct ?? undefined,
  }))

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className={cn('grid grid-cols-2 gap-2', lastFat ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        <StatTile label="Peso actual" value={fmtKg(last.weight_kg)} unit="kg" hint={formatDate(last.logged_at)} />
        <StatTile
          label="Desde el inicio"
          value={chartData.length > 1 ? fmtSigned(delta) : '—'}
          unit={chartData.length > 1 ? 'kg' : undefined}
          hint={chartData.length > 1 ? `Empezó en ${fmtKg(first.weight_kg)} kg` : 'Es el primer registro'}
        />
        {lastFat ? <StatTile label="Grasa corporal" value={fmtKg(lastFat.body_fat_pct!)} unit="%" hint={formatDate(lastFat.logged_at)} /> : null}
        <StatTile
          label="Objetivo"
          className={lastFat ? undefined : 'col-span-2 lg:col-span-1'}
          value={editingGoal ? undefined : goal ? fmtKg(goal) : '—'}
          unit={!editingGoal && goal ? 'kg' : undefined}
          hint={
            editingGoal || toGoal == null
              ? undefined
              : Math.abs(toGoal) < 0.05
                ? 'Alcanzado'
                : `Faltan ${fmtKg(Math.abs(toGoal))} kg`
          }
          action={
            editingGoal ? null : (
              <Button type="button" variant="ghost" size="sm" className="-mr-2" onClick={onStartGoal}>
                {goal ? 'Cambiar' : 'Definir'}
              </Button>
            )
          }
        >
          {editingGoal ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                min={30}
                max={300}
                step={0.5}
                autoFocus
                aria-label="Peso objetivo en kg"
                placeholder="kg"
                className={cn(controlInputClassName, 'w-20 text-center')}
                value={goalInput}
                onChange={(e) => onGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSaveGoal()}
              />
              <Button size="sm" loading={savingGoal} onClick={onSaveGoal}>
                Guardar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onCancelGoal}>
                Cancelar
              </Button>
            </div>
          ) : pct != null ? (
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-border" role="img" aria-label={`${pct}% del camino al objetivo`}>
              <div className="h-full rounded-full bg-status-ok" style={{ width: `${pct}%` }} />
            </div>
          ) : null}
        </StatTile>
      </div>

      {chartData.length >= 2 ? (
        <WeightChart data={points} goal={goal} hasFat={Boolean(lastFat)} />
      ) : (
        <p className="rounded-xl border border-dashed border-surface-inputBorder px-4 py-6 text-center text-sm text-ink-muted">
          Con dos registros o más aparece el gráfico de evolución.
        </p>
      )}

      <div>
        <h4 className="pb-1 text-sm font-semibold text-ink-primary">Registros</h4>
        <ul className="divide-y divide-surface-border/60">
          {logs.map((l, i) => {
            const older = logs[i + 1]
            const change = older ? l.weight_kg - older.weight_kg : null
            return (
              <li key={l.id} className="group flex items-center gap-3 py-2.5">
                <span className="w-20 shrink-0 text-body-sm tabular-nums text-ink-muted">{formatDate(l.logged_at)}</span>
                <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-ink-primary">{fmtKg(l.weight_kg)} kg</span>
                <span className="w-14 shrink-0 text-xs tabular-nums text-ink-muted">
                  {change != null && Math.abs(change) >= 0.05 ? fmtSigned(change) : ''}
                </span>
                {l.body_fat_pct != null ? (
                  <span className="shrink-0 rounded-md bg-surface-elevated px-2 py-0.5 text-xs font-medium text-ink-secondary">
                    {fmtKg(l.body_fat_pct)}% grasa
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">{l.notes}</span>
                <Button
                  variant="ghost"
                  size="iconSm"
                  type="button"
                  aria-label="Borrar registro"
                  onClick={() => onDelete(l.id)}
                  className="-m-1.5 text-ink-muted opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

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
                <label className="block text-3xs text-ink-muted mb-1">Peso (kg) *</label>
                <input
                  type="number" min={0} step={0.1} placeholder="ej: 75.5"
                  className={cn(controlInputClassName, 'text-center font-bold')}
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-3xs text-ink-muted mb-1">Grasa corporal %</label>
                <input
                  type="number" min={0} max={100} step={0.1} placeholder="opcional"
                  className={cn(controlInputClassName, 'text-center')}
                  value={fat} onChange={(e) => setFat(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-3xs text-ink-muted mb-1">Fecha</label>
                <input
                  type="date"
                  className={controlInputClassName}
                  value={dateVal} onChange={(e) => setDateVal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-3xs text-ink-muted mb-1">Notas</label>
                <input
                  placeholder="opcional"
                  className={controlInputClassName}
                  value={noteVal} onChange={(e) => setNoteVal(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
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
        ) : IS_V2 ? (
          <WeightBodyV2
            logs={logs}
            chartData={chartData}
            goal={goal}
            editingGoal={editingGoal}
            goalInput={goalInput}
            savingGoal={savingGoal}
            onGoalInput={setGoalInput}
            onStartGoal={() => {
              setGoalInput(String(goal ?? ''))
              setEditingGoal(true)
            }}
            onCancelGoal={() => setEditingGoal(false)}
            onSaveGoal={() => void saveGoal()}
            onDelete={(logId) => void handleDelete(logId)}
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
                      <p className="text-3xs text-ink-muted ">Actual</p>
                      <p className="text-2xl font-bold text-ink-primary">{last.weight_kg} <span className="text-sm font-normal text-ink-muted">kg</span></p>
                    </div>
                    <div>
                      <p className="text-3xs text-ink-muted ">Δ inicio</p>
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
                        <p className="text-3xs text-ink-muted ">% Grasa</p>
                        <p className="text-base font-bold text-ink-secondary">{last.body_fat_pct}%</p>
                      </div>
                    )}
                    {goal && (
                      <div>
                        <p className="text-3xs text-ink-muted ">Objetivo</p>
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

                  <WeightChart data={rechartsData} goal={goal} hasFat={hasFat} />
                </div>
              )
            })()}

            {/* Objetivo de peso */}
            {editingGoal ? (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="number" min={30} max={300} step={0.5} autoFocus
                  placeholder="Peso objetivo (kg)"
                  className={cn(controlInputClassName, 'flex-1 text-center')}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                />
                <Button size="sm" variant="gradientSecondary" loading={savingGoal} onClick={() => void saveGoal()}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingGoal(false)}>Cancelar</Button>
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
                  <Button
                    variant="ghost"
                    size="iconSm"
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    className="-m-1.5 opacity-0 group-hover:opacity-100 text-ink-muted">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
