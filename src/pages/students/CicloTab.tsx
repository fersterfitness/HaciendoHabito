import { useEffect, useState, useMemo } from 'react'
import { Plus, X, Droplets } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  ReferenceLine, ReferenceArea, Tooltip, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { MenstrualCycle } from '@/types/database'
import toast from 'react-hot-toast'

// ─── Hormone control points [day, 0-1 value] ─────────────────────────────────

const ESTROGEN_PTS:     [number, number][] = [[1,.06],[5,.12],[9,.4],[12,.92],[13,1],[14,.62],[15,.5],[18,.56],[20,.68],[22,.6],[25,.3],[28,.06]]
const PROGESTERONE_PTS: [number, number][] = [[1,.03],[12,.03],[14,.08],[16,.22],[18,.55],[21,1],[23,.88],[25,.65],[27,.28],[28,.04]]
const FSH_PTS:          [number, number][] = [[1,.22],[3,.32],[5,.2],[9,.28],[12,.72],[13,.8],[14,.35],[16,.14],[20,.1],[28,.1]]
const LH_PTS:           [number, number][] = [[1,.09],[11,.12],[13,.32],[14,1],[15,.28],[16,.1],[20,.09],[28,.09]]

// Catmull-Rom interpolation
function interpolate(pts: [number, number][], day: number): number {
  if (day <= pts[0][0]) return pts[0][1]
  if (day >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]
  let i = 0
  while (i < pts.length - 1 && pts[i + 1][0] < day) i++
  const p0 = pts[Math.max(i - 1, 0)]
  const p1 = pts[i]
  const p2 = pts[i + 1]
  const p3 = pts[Math.min(i + 2, pts.length - 1)]
  const t  = (day - p1[0]) / (p2[0] - p1[0])
  const t2 = t * t; const t3 = t2 * t
  return Math.max(0, Math.min(1,
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t +
    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
  ))
}

// Pre-generate 28-point dataset for Recharts
function buildChartData(cycleLen: number) {
  return Array.from({ length: cycleLen }, (_, i) => {
    const day = i + 1
    return {
      day,
      fsh:          parseFloat(interpolate(FSH_PTS, day).toFixed(3)),
      lh:           parseFloat(interpolate(LH_PTS, day).toFixed(3)),
      estrogenos:   parseFloat(interpolate(ESTROGEN_PTS, day).toFixed(3)),
      progesterona: parseFloat(interpolate(PROGESTERONE_PTS, day).toFixed(3)),
    }
  })
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

type Phase = 'menstruacion' | 'folicular' | 'ovulacion' | 'lutea' | 'nuevo_ciclo'

function getPhase(day: number, cycleLen: number): Phase {
  if (day > cycleLen) return 'nuevo_ciclo'
  if (day <= 5)   return 'menstruacion'
  if (day <= 13)  return 'folicular'
  if (day <= 16)  return 'ovulacion'
  return 'lutea'
}

const PHASE_META: Record<Phase, { label: string; desc: string }> = {
  menstruacion:   { label: 'Menstruación', desc: 'Puede haber más fatiga. Entrenar suave, priorizá movilidad y recuperación.' },
  folicular:      { label: 'Fase folicular', desc: 'Energía en alza, estrógenos subiendo. Buena etapa para cargas altas y PR.' },
  ovulacion:      { label: 'Ovulación', desc: 'Pico de energía y fuerza. Ideal para entrenamientos de máxima intensidad.' },
  lutea:          { label: 'Fase lútea', desc: 'Progesterona alta, puede haber retención y menor tolerancia al esfuerzo. Moderá la intensidad.' },
  nuevo_ciclo:    { label: 'Ciclo completado', desc: 'El ciclo estimado terminó. Registrá el nuevo período cuando inicie.' },
}

// ─── CicloTab ─────────────────────────────────────────────────────────────────

export function CicloTab({ studentId }: { studentId: string }) {
  const { user } = useAuthStore()
  const [cycles,     setCycles]     = useState<MenstrualCycle[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [deleting,   setDeleting]   = useState<string | null>(null)

  useEffect(() => {
    supabase.from('menstrual_cycles')
      .select('*').eq('student_id', studentId)
      .order('cycle_start_date', { ascending: false })
      .then(({ data }) => { setCycles((data as MenstrualCycle[]) ?? []); setLoading(false) })
  }, [studentId])

  async function addCycle(startDate: string, cycleLen: number, notes: string) {
    if (!user) return
    const { data, error } = await supabase.from('menstrual_cycles').insert({
      owner_id: user.id, student_id: studentId,
      cycle_start_date: startDate, cycle_length: cycleLen, notes: notes || null,
    }).select('*').single()
    if (error) { toast.error(error.message); return }
    setCycles((prev) => [data as MenstrualCycle, ...prev])
    setShowForm(false)
    toast.success('Ciclo registrado')
  }

  async function deleteCycle(cycleId: string) {
    if (!user) return
    setDeleting(cycleId)
    const prev = cycles
    setCycles((p) => p.filter((c) => c.id !== cycleId)) // optimistic
    const { error } = await supabase
      .from('menstrual_cycles')
      .delete()
      .eq('id', cycleId)
      .eq('owner_id', user.id)
    setDeleting(null)
    if (error) {
      setCycles(prev)              // rollback
      toast.error(error.message)
    }
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const avgCycleLen = useMemo(() => {
    if (cycles.length === 0) return 28
    return Math.round(cycles.reduce((s, c) => s + c.cycle_length, 0) / cycles.length)
  }, [cycles])

  const lastCycle = cycles[0] ?? null

  const cycleInfo = useMemo(() => {
    if (!lastCycle) return null
    const start   = new Date(lastCycle.cycle_start_date + 'T00:00:00')
    const today   = new Date(); today.setHours(0,0,0,0)
    const dayInCycle = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
    const phase   = getPhase(dayInCycle, lastCycle.cycle_length)
    const ovDay   = 14
    const daysToOv = ovDay - dayInCycle
    const nextPeriod = new Date(start); nextPeriod.setDate(start.getDate() + lastCycle.cycle_length)
    const daysToNext = Math.ceil((nextPeriod.getTime() - today.getTime()) / 86400000)
    return { dayInCycle, phase, daysToOv, daysToNext, nextPeriod, cycleLen: lastCycle.cycle_length }
  }, [lastCycle])

  if (loading) return <div className="flex justify-center py-12"><Spinner /></div>

  return (
    <div className="space-y-4">

      {/* Estado actual */}
      {cycleInfo ? (
        <>
          {/* Fase actual */}
          <div className="border-b border-zinc-200/60 pb-5 dark:border-zinc-800/65">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Fase actual</p>
                <p className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{PHASE_META[cycleInfo.phase].label}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{PHASE_META[cycleInfo.phase].desc}</p>
              </div>
              <div className="min-w-[60px] shrink-0 border border-zinc-200/70 px-3 py-2 text-center dark:border-zinc-700/80">
                <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{Math.max(cycleInfo.dayInCycle, 1)}</p>
                <p className="text-[10px] text-zinc-500">
                  día {cycleInfo.dayInCycle > cycleInfo.cycleLen ? '(pasado)' : `/ ${cycleInfo.cycleLen}`}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-4 border-t border-zinc-200/50 pt-4 dark:border-zinc-800/55">
              {[
                { label: 'Próxima ovulación', value: cycleInfo.daysToOv > 0 ? `en ${cycleInfo.daysToOv}d` : cycleInfo.daysToOv === 0 ? 'Hoy' : 'Pasó' },
                { label: 'Próximo período', value: cycleInfo.daysToNext > 0 ? `en ${cycleInfo.daysToNext}d` : 'Hoy o pasado' },
                { label: 'Largo prom.', value: `${avgCycleLen} días` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Gráfico hormonal */}
          <CycleGraph dayInCycle={cycleInfo.dayInCycle} cycleLen={cycleInfo.cycleLen} />
        </>
      ) : (
        <EmptyState
          icon={<Droplets className="h-7 w-7" />}
          title="Sin ciclos registrados"
          description="Registrá el primer día del último período para ver el gráfico y el estado actual."
        />
      )}

      {/* Registrar nuevo ciclo */}
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200/50 pb-3 dark:border-zinc-800/55">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Historial de ciclos</h3>
          <Button
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            className="!border-0 !bg-[#ff4800] !text-white hover:!bg-[#e04100]"
            onClick={() => setShowForm(true)}
          >
            Registrar período
          </Button>
        </div>

        {cycles.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500">Sin registros aún.</p>
        ) : (
          <ul className="divide-y divide-zinc-200/55 dark:divide-zinc-800/55">
            {cycles.map((c) => {
              const end = new Date(c.cycle_start_date + 'T00:00:00')
              end.setDate(end.getDate() + c.cycle_length - 1)
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="h-2 w-2 shrink-0 bg-zinc-400 dark:bg-zinc-500" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{formatDate(c.cycle_start_date)}</p>
                    <p className="text-[10px] text-zinc-500">
                      {c.cycle_length} días · hasta {formatDate(end.toISOString().split('T')[0])}
                      {c.notes && ` · ${c.notes}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCycle(c.id)}
                    disabled={deleting === c.id}
                    className="text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {showForm && (
        <AddCycleModal
          defaultLen={avgCycleLen}
          onClose={() => setShowForm(false)}
          onSave={addCycle}
        />
      )}
    </div>
  )
}

// ─── CycleGraph ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink-primary mb-1.5">Día {label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-ink-secondary capitalize">{p.name}</span>
          <span className="ml-auto font-medium text-ink-primary">{Math.round(p.value * 100)}%</span>
        </div>
      ))}
    </div>
  )
}

function CycleGraph({ dayInCycle, cycleLen }: { dayInCycle: number; cycleLen: number }) {
  const data = useMemo(() => buildChartData(cycleLen), [cycleLen])
  const todayDay = Math.min(Math.max(dayInCycle, 1), cycleLen)

  // Phase boundary days
  const menEnd = Math.round(5 / 28 * cycleLen)
  const folEnd = Math.round(13 / 28 * cycleLen)
  const ovEnd  = Math.round(16 / 28 * cycleLen)

  return (
    <div className="border-b border-zinc-200/55 pb-4 dark:border-zinc-800/55">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Gráfico hormonal del ciclo</p>

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -28 }}>

          {/* Phase background zones */}
          <ReferenceArea x1={1}      x2={menEnd}   fill="rgba(113,113,122,0.08)" label={{ value: 'Menst.', position: 'insideTop', fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} />
          <ReferenceArea x1={menEnd} x2={folEnd}  fill="rgba(113,113,122,0.05)" label={{ value: 'Folicular', position: 'insideTop', fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} />
          <ReferenceArea x1={folEnd} x2={ovEnd} fill="rgba(113,113,122,0.07)" label={{ value: 'Ovul.', position: 'insideTop', fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} />
          <ReferenceArea x1={ovEnd}  x2={cycleLen} fill="rgba(113,113,122,0.06)" label={{ value: 'Lútea', position: 'insideTop', fontSize: 9, fill: '#a1a1aa', fontWeight: 600 }} />

          <XAxis
            dataKey="day"
            ticks={[1, 7, 14, 21, cycleLen]}
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${Math.round(v * 100)}%`}
            tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
            formatter={(value) => <span style={{ color: 'rgba(255,255,255,0.55)', textTransform: 'capitalize' }}>{value}</span>}
          />

          {/* Today line */}
          {dayInCycle >= 1 && dayInCycle <= cycleLen && (
            <ReferenceLine
              x={todayDay}
              stroke="#52525b"
              strokeWidth={1.25}
              strokeDasharray="4 3"
              label={{ value: 'Hoy', position: 'top', fontSize: 9, fill: '#52525b', fontWeight: 600 }}
            />
          )}

          <Line dataKey="fsh"          name="FSH"          stroke="#a1a1aa" strokeWidth={1.25} strokeDasharray="4 3" dot={false} type="monotone" />
          <Line dataKey="lh"           name="LH"           stroke="#71717a" strokeWidth={1.25} dot={false} type="monotone" />
          <Line dataKey="estrogenos"   name="Estrógenos"   stroke="#d4d4d8" strokeWidth={2} dot={false} type="monotone" />
          <Line dataKey="progesterona" name="Progesterona" stroke="#d4d4d8" strokeWidth={1.5} strokeDasharray="6 4" dot={false} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── AddCycleModal ────────────────────────────────────────────────────────────

function AddCycleModal({
  defaultLen, onClose, onSave,
}: {
  defaultLen: number
  onClose: () => void
  onSave: (startDate: string, cycleLen: number, notes: string) => Promise<void>
}) {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [cycleLen,  setCycleLen]  = useState(defaultLen)
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)

  async function handleSave() {
    if (!startDate) { toast.error('Ingresá la fecha de inicio'); return }
    setSaving(true)
    await onSave(startDate, cycleLen, notes)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Registrar período</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Primer día del período *</label>
            <input
              type="date"
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-ink-primary outline-none focus:border-zinc-500 dark:focus:border-zinc-400"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Duración del ciclo: <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">{cycleLen} días</span>
            </label>
            <input
              type="range" min={21} max={35} step={1}
              value={cycleLen}
              onChange={(e) => setCycleLen(Number(e.target.value))}
              className="w-full accent-zinc-500 dark:accent-zinc-400"
            />
            <div className="flex justify-between text-[10px] text-ink-muted mt-0.5">
              <span>21</span><span>28</span><span>35</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Notas (opcional)</label>
            <input
              placeholder="ej: ciclo irregular, con dolor..."
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-ink-primary outline-none placeholder:text-ink-muted focus:border-zinc-500 dark:focus:border-zinc-400"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="w-full" variant="secondary" loading={saving} onClick={handleSave}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
  )
}
