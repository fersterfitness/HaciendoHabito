import { useState, useMemo } from 'react'
import { Dumbbell, Plus, Zap, X, ChevronDown, Check, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn, formatDate } from '@/lib/utils'
import { RM_TEST_EVERY_WEEKS } from '@/lib/checkIn/rmTestReminder'
import { useTheme } from '@/contexts/ThemeContext'
import type { StudentRmRecord } from '@/types/database'
import toast from 'react-hot-toast'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { RM_PERCENTS } from './studentDetailShared'
import { AddRmModal } from './AddRmModal'

// ─── FuerzaTab ────────────────────────────────────────────────────────────────

/** Paleta categórica validada (claro / oscuro); el color sigue al ejercicio, no al orden. */
const RM_SERIES_COLORS = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500'],
}
const RM_MAX_COMPARE = RM_SERIES_COLORS.light.length

/** Mismo ejercicio aunque esté cargado dos veces en la biblioteca («Sentadilla con barra»). */
function rmExerciseKey(r: StudentRmRecord): string {
  const name = r.exercise?.name?.trim()
  if (!name) return `id:${r.exercise_id}`
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ')
}

type RmGroup = {
  key: string
  name: string
  /** Del más nuevo al más viejo. */
  history: StudentRmRecord[]
}

export function FuerzaTab({
  records,
  onAdd,
  onDelete,
  rmTestWeeks,
  onRmTestRead,
}: {
  records: StudentRmRecord[]
  onAdd: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  /** Semanas desde el último test (null = cargando). */
  rmTestWeeks: number | null
  onRmTestRead: () => Promise<void>
}) {
  const { theme } = useTheme()
  const palette = theme === 'dark' ? RM_SERIES_COLORS.dark : RM_SERIES_COLORS.light

  const groups = useMemo((): RmGroup[] => {
    const map = new Map<string, RmGroup>()
    const sorted = [...records].sort(
      (a, b) => b.tested_at.localeCompare(a.tested_at) || b.created_at.localeCompare(a.created_at),
    )
    for (const r of sorted) {
      const key = rmExerciseKey(r)
      if (!map.has(key)) map.set(key, { key, name: r.exercise?.name ?? '—', history: [] })
      map.get(key)!.history.push(r)
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [records])

  const [showAddForm,  setShowAddForm]  = useState(false)
  const [calcKey,      setCalcKey]      = useState('')
  const [calcPercent,  setCalcPercent]  = useState(80)
  const [openKey,      setOpenKey]      = useState<string | null>(null)
  const [markingRead,  setMarkingRead]  = useState(false)
  /** Ejercicios en el gráfico comparativo, cada uno con su color fijo. */
  const [compare, setCompare] = useState<{ key: string; slot: number }[] | null>(null)

  // Por defecto: los ejercicios con más tests (hasta 4).
  const compareSel = useMemo(() => {
    if (compare) return compare.filter((c) => groups.some((g) => g.key === c.key))
    return [...groups]
      .sort((a, b) => b.history.length - a.history.length || a.name.localeCompare(b.name, 'es'))
      .slice(0, RM_MAX_COMPARE)
      .map((g, i) => ({ key: g.key, slot: i }))
  }, [compare, groups])

  function toggleCompare(key: string) {
    const cur = compareSel
    if (cur.some((c) => c.key === key)) {
      setCompare(cur.filter((c) => c.key !== key))
      return
    }
    if (cur.length >= RM_MAX_COMPARE) {
      toast(`Hasta ${RM_MAX_COMPARE} ejercicios a la vez en el gráfico`)
      return
    }
    const used = new Set(cur.map((c) => c.slot))
    const slot = [...Array(RM_MAX_COMPARE).keys()].find((i) => !used.has(i)) ?? 0
    setCompare([...cur, { key, slot }])
  }

  const compareData = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>()
    for (const sel of compareSel) {
      const g = groups.find((x) => x.key === sel.key)
      if (!g) continue
      for (const h of g.history) {
        const d = h.tested_at.slice(0, 10)
        if (!byDate.has(d)) byDate.set(d, { date: d })
        const row = byDate.get(d)!
        // Dos tests el mismo día: queda el mayor.
        row[sel.key] = Math.max(Number(row[sel.key] ?? 0), h.rm_kg)
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
  }, [compareSel, groups])

  const calcGroup = groups.find((g) => g.key === calcKey)
  const calcRm = calcGroup?.history[0]?.rm_kg ?? null
  const calcWeight = calcRm != null ? Math.round(calcRm * (calcPercent / 100) * 10) / 10 : null

  const rmDue = rmTestWeeks != null && rmTestWeeks >= RM_TEST_EVERY_WEEKS

  return (
    <div className="space-y-5">

      {/* ── Aviso TESTEAR RM ── */}
      {rmTestWeeks != null ? (
        rmDue ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl hh-alert hh-alert-warning px-4 py-3">
            <Dumbbell className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-primary">Testear RM en la próxima rutina</p>
              <p className="text-2xs text-ink-secondary">
                {rmTestWeeks} semanas de rutina desde el último test. Al marcarlo como leído la cuenta vuelve a cero.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              loading={markingRead}
              icon={<Check className="h-3.5 w-3.5" />}
              onClick={async () => {
                setMarkingRead(true)
                await onRmTestRead()
                setMarkingRead(false)
              }}
            >
              Leído
            </Button>
          </div>
        ) : (
          <p className="text-2xs text-ink-muted">
            Próximo test de RM: {rmTestWeeks} de {RM_TEST_EVERY_WEEKS} semanas de rutina.
          </p>
        )
      ) : null}

      {/* ── Registros por ejercicio ── */}
      <section>
        <div className="flex items-center justify-between gap-3 border-b border-surface-border/50 pb-3 ">
          <h3 className="text-sm font-semibold text-ink-primary ">RM por ejercicio</h3>
          <Button variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddForm(true)}>
            Cargar RM
          </Button>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title="Sin registros"
            description="Cargá el RM de cada ejercicio. Cada test nuevo se suma al historial para ver el progreso."
          />
        ) : (
          <div className="divide-y divide-surface-border/40 ">
            {groups.map((g) => {
              const latest = g.history[0]
              const prev = g.history[1]
              const delta = prev ? Math.round((latest.rm_kg - prev.rm_kg) * 10) / 10 : null
              const isOpen = openKey === g.key
              const sel = compareSel.find((c) => c.key === g.key)
              return (
                <div key={g.key}>
                  <div className="flex items-center gap-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleCompare(g.key)}
                      className={cn(
                        'h-3 w-3 shrink-0 rounded-full border transition-colors',
                        sel ? 'border-transparent' : 'border-zinc-400 ',
                      )}
                      style={sel ? { background: palette[sel.slot] } : undefined}
                      title={sel ? 'Quitar del gráfico' : 'Ver en el gráfico'}
                      aria-pressed={!!sel}
                    />
                    <button type="button" onClick={() => setOpenKey(isOpen ? null : g.key)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-semibold text-ink-primary">{g.name}</p>
                      <p className="text-3xs text-ink-muted">
                        {formatDate(latest.tested_at)} · {g.history.length} {g.history.length === 1 ? 'test' : 'tests'}
                      </p>
                    </button>
                    {delta != null && prev ? (
                      <span
                        className={cn(
                          'shrink-0 text-2xs font-semibold tabular-nums',
                          delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-status-expired' : 'text-ink-muted',
                        )}
                        title={`Antes: ${prev.rm_kg} kg (${formatDate(prev.tested_at)})`}
                      >
                        {delta > 0 ? `▲ +${delta} kg` : delta < 0 ? `▼ ${delta} kg` : '='}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-base font-bold tabular-nums text-ink-primary ">{latest.rm_kg} kg</span>
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : g.key)}
                      className="text-ink-muted transition-colors hover:text-ink-primary"
                      aria-label="Ver historial"
                    >
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    </button>
                  </div>

                  {isOpen ? (
                    <ul className="mb-2 divide-y divide-surface-border/40 rounded-lg border border-surface-border bg-surface-elevated/30">
                      {g.history.map((h, i) => {
                        const older = g.history[i + 1]
                        const d = older ? Math.round((h.rm_kg - older.rm_kg) * 10) / 10 : null
                        return (
                          <li key={h.id} className="flex items-center gap-2 px-3 py-1.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-ink-secondary">
                                {formatDate(h.tested_at)} · {h.source === 'epley' ? 'Estimado (Epley)' : 'Testeado'}
                              </p>
                              {h.notes ? <p className="truncate text-3xs text-ink-muted">{h.notes}</p> : null}
                            </div>
                            {d != null && d !== 0 ? (
                              <span className={cn('text-3xs tabular-nums', d > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-status-expired')}>
                                {d > 0 ? `+${d}` : d}
                              </span>
                            ) : null}
                            <span className="text-xs font-semibold tabular-nums text-ink-primary">{h.rm_kg} kg</span>
                            <button
                              type="button"
                              onClick={() => void onDelete(h.id)}
                              className="text-ink-muted transition-colors hover:text-status-expired"
                              aria-label="Borrar registro"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Progreso comparado ── */}
      {groups.length > 0 ? (
        <section className="border-t border-surface-border/55 pt-4 ">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-ink-muted" aria-hidden />
            <h3 className="text-sm font-semibold text-ink-primary ">Progreso de RM</h3>
          </div>
          <p className="mb-3 text-2xs text-ink-muted">
            Tocá el punto de color de cada ejercicio para sumarlo o quitarlo del gráfico (hasta {RM_MAX_COMPARE}).
          </p>
          {compareSel.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">Elegí al menos un ejercicio.</p>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
                {compareSel.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
                    <span className="h-2 w-2 rounded-full" style={{ background: palette[c.slot] }} />
                    {groups.find((g) => g.key === c.key)?.name}
                  </span>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={compareData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgb(var(--surface-border))" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d: string) => formatDate(d)}
                    tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    domain={[(min: number) => Math.max(0, Math.floor((min - 10) / 10) * 10), (max: number) => Math.ceil((max + 10) / 10) * 10]}
                    allowDecimals={false}
                    tickCount={5}
                    tickFormatter={(v: number) => `${Math.round(v)} kg`}
                    tick={{ fontSize: 10, fill: 'rgb(var(--ink-muted))' }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgb(var(--ink-muted))', strokeOpacity: 0.4 }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-surface-border bg-surface-elevated px-2.5 py-1.5 text-2xs shadow-md">
                          <p className="mb-1 text-ink-muted">{formatDate(String(label))}</p>
                          {payload.map((p) => (
                            <p key={String(p.dataKey)} className="flex items-center gap-1.5 text-ink-primary">
                              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                              {groups.find((g) => g.key === p.dataKey)?.name}: <strong>{String(p.value)} kg</strong>
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {compareSel.map((c) => (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      stroke={palette[c.slot]}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 4, fill: palette[c.slot], stroke: 'rgb(var(--surface-card))', strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </section>
      ) : null}

      {/* ── Calculadora de % ── */}
      {groups.length > 0 ? (
        <section className="border-t border-surface-border/55 pt-4 ">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-ink-muted" aria-hidden />
            <h3 className="text-sm font-semibold text-ink-primary ">Calculadora de porcentaje</h3>
          </div>
          <div className="space-y-3">
            <select
              className="w-full rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary outline-none focus:border-brand-primary/60"
              value={calcKey}
              onChange={(e) => setCalcKey(e.target.value)}
            >
              <option value="">Seleccioná un ejercicio...</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name} — 1RM: {g.history[0].rm_kg} kg
                </option>
              ))}
            </select>

            {calcRm != null && (
              <>
                <div>
                  <label className="mb-1 block text-3xs uppercase tracking-wide text-ink-muted">
                    Porcentaje: {calcPercent}%
                  </label>
                  <input
                    type="range" min={50} max={100} step={5}
                    value={calcPercent}
                    onChange={(e) => setCalcPercent(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between border border-surface-border/80 bg-surface-elevated/60 px-4 py-3 ">
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-wide text-ink-muted ">Peso estimado</p>
                    <p className="text-2xl font-bold tabular-nums text-ink-primary ">{calcWeight} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xs text-ink-muted">1RM base</p>
                    <p className="text-sm font-semibold text-ink-primary">{calcRm} kg</p>
                    <p className="mt-1 text-3xs text-ink-muted">al {calcPercent}%</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RM_PERCENTS.map((pct) => {
                    const w = Math.round(calcRm * (pct / 100) * 10) / 10
                    const isSelected = pct === calcPercent
                    return (
                      <button
                        key={pct}
                        onClick={() => setCalcPercent(pct)}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-2.5 py-2 text-xs transition-colors',
                          isSelected
                            ? 'border border-zinc-400 bg-white font-semibold text-ink-primary ring-2 ring-surface-inputBorder/80 dark:text-white '
                            : 'bg-surface-elevated text-ink-secondary hover:bg-surface-border/90 ',
                        )}
                      >
                        <span>{pct}%</span>
                        <span className="font-medium">{w} kg</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Add form modal ── */}
      {showAddForm && (
        <AddRmModal
          onClose={() => setShowAddForm(false)}
          onSave={async (record) => { await onAdd(record); setShowAddForm(false) }}
        />
      )}
    </div>
  )
}
