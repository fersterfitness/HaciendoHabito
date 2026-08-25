import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import {
  availableMonthOptions,
  availableYearOptions,
  buildCheckInHabitCharts,
  filterPointsByCompare,
  habitChartBarRows,
  type CheckInHabitChartPeriod,
  type CheckInResponsePoint,
  type HabitChartSeries,
  type HabitCompareFilter,
} from '@/lib/checkIn/habitCharts'
import { parseQuestions } from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

const PERIODS: { id: CheckInHabitChartPeriod | 'compare'; label: string }[] = [
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensual' },
  { id: 'yearly', label: 'Anual' },
  { id: 'compare', label: 'Comparar' },
]

function ChartCard({ series, tick, isDark }: { series: HabitChartSeries; tick: string; isDark: boolean }) {
  const data = habitChartBarRows(series)
  return (
    <div className="rounded-2xl border border-surface-border/70 bg-surface-elevated/30 p-3.5">
      <p className="mb-3 text-xs font-semibold leading-snug text-ink-primary">{series.title}</p>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#3f3f46' : '#e4e4e7'} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: tick }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: tick }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              contentStyle={{
                fontSize: 11,
                borderRadius: 12,
                border: '1px solid rgb(var(--surface-border))',
                background: 'rgb(var(--surface-card))',
              }}
            />
            {series.buckets[0]?.segments.map((seg) => (
              <Bar key={seg.optionId} dataKey={seg.optionId} stackId="a" fill={seg.color} name={seg.label} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {series.buckets[0]?.segments.map((seg) => (
          <li key={seg.optionId} className="inline-flex items-center gap-1.5 text-[10px] text-ink-muted">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CheckInHabitsCharts({ studentId }: { studentId: string }) {
  const { user } = useAuthStore()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const tick = isDark ? '#a1a1aa' : '#52525b'
  const [period, setPeriod] = useState<CheckInHabitChartPeriod | 'compare'>('weekly')
  const [points, setPoints] = useState<CheckInResponsePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [compareKind, setCompareKind] = useState<'month' | 'year' | 'range'>('month')
  const [monthA, setMonthA] = useState('')
  const [monthB, setMonthB] = useState('')
  const [yearA, setYearA] = useState('')
  const [yearB, setYearB] = useState('')
  const [rangeAFrom, setRangeAFrom] = useState('')
  const [rangeATo, setRangeATo] = useState('')
  const [rangeBFrom, setRangeBFrom] = useState('')
  const [rangeBTo, setRangeBTo] = useState('')

  useEffect(() => {
    if (!user || !studentId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: inv } = await supabase
        .from('check_in_invites')
        .select('id, form_id, form:check_in_forms(questions)')
        .eq('student_id', studentId)
      if (cancelled) return
      const invites = (inv ?? []) as { id: string; form_id: string; form: { questions: Json } | { questions: Json }[] | null }[]
      const questionsByInvite = new Map<string, ReturnType<typeof parseQuestions>>()
      for (const i of invites) {
        const form = Array.isArray(i.form) ? i.form[0] : i.form
        questionsByInvite.set(i.id, parseQuestions(form?.questions))
      }
      const ids = invites.map((i) => i.id)
      if (!ids.length) {
        setPoints([])
        setLoading(false)
        return
      }
      const { data: resp } = await supabase
        .from('check_in_responses')
        .select('invite_id, submitted_at, responses')
        .in('invite_id', ids)
        .order('submitted_at', { ascending: true })
      if (cancelled) return
      const next: CheckInResponsePoint[] = []
      for (const r of resp ?? []) {
        const row = r as { invite_id: string; submitted_at: string; responses: Json }
        const qs = questionsByInvite.get(row.invite_id) ?? []
        const obj =
          row.responses && typeof row.responses === 'object' && !Array.isArray(row.responses)
            ? (row.responses as Record<string, unknown>)
            : {}
        next.push({ submittedAt: row.submitted_at, questions: qs, responses: obj })
      }
      setPoints(next)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, studentId])

  const monthOpts = useMemo(() => availableMonthOptions(points), [points])
  const yearOpts = useMemo(() => availableYearOptions(points), [points])

  useEffect(() => {
    if (monthOpts.length >= 2 && !monthA && !monthB) {
      setMonthA(monthOpts[1]?.value ?? '')
      setMonthB(monthOpts[0]?.value ?? '')
    }
    if (yearOpts.length >= 1 && !yearA) setYearA(String(yearOpts[0]))
    if (yearOpts.length >= 2 && !yearB) setYearB(String(yearOpts[1]))
  }, [monthOpts, yearOpts, monthA, monthB, yearA, yearB])

  const series = useMemo(
    () => (period === 'compare' ? [] : buildCheckInHabitCharts(points, period)),
    [points, period],
  )

  function parseMonth(value: string): HabitCompareFilter | null {
    const [y, m] = value.split('-').map(Number)
    if (!y || !m) return null
    return { kind: 'month', year: y, month: m }
  }

  const compareA = useMemo(() => {
    if (compareKind === 'month') return monthA ? parseMonth(monthA) : null
    if (compareKind === 'year') return yearA ? { kind: 'year' as const, year: Number(yearA) } : null
    if (!rangeAFrom || !rangeATo) return null
    return { kind: 'range' as const, from: rangeAFrom, to: rangeATo }
  }, [compareKind, monthA, yearA, rangeAFrom, rangeATo])

  const compareB = useMemo(() => {
    if (compareKind === 'month') return monthB ? parseMonth(monthB) : null
    if (compareKind === 'year') return yearB ? { kind: 'year' as const, year: Number(yearB) } : null
    if (!rangeBFrom || !rangeBTo) return null
    return { kind: 'range' as const, from: rangeBFrom, to: rangeBTo }
  }, [compareKind, monthB, yearB, rangeBFrom, rangeBTo])

  const seriesA = useMemo(
    () => (compareA ? buildCheckInHabitCharts(filterPointsByCompare(points, compareA), compareKind === 'year' ? 'yearly' : 'monthly') : []),
    [points, compareA, compareKind],
  )
  const seriesB = useMemo(
    () => (compareB ? buildCheckInHabitCharts(filterPointsByCompare(points, compareB), compareKind === 'year' ? 'yearly' : 'monthly') : []),
    [points, compareB, compareKind],
  )

  if (!user) return null
  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-52 animate-pulse rounded-2xl bg-surface-elevated/70" />
        ))}
      </div>
    )
  }
  if (!points.length) {
    return (
      <div className="rounded-2xl border border-dashed border-surface-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-ink-primary">Todavía no hay hábitos para graficar</p>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
          Cuando el alumno complete el check-in semanal, acá vas a ver barras por color. Las aclaraciones quedan en Consulta semanal.
        </p>
      </div>
    )
  }

  const selectClass =
    'mt-1 block w-full rounded-xl border border-surface-border/80 bg-surface-input px-2.5 py-1.5 text-[11px] text-ink-primary outline-none focus:border-brand-secondary/50'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-secondary">Check-in</p>
          <p className="text-sm font-semibold tracking-tight text-ink-primary">Hábitos del formulario</p>
          <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-ink-muted">
            Solo opciones por color. Compará meses, años o rangos cuando quieras ver evolución.
          </p>
        </div>
        <div className="flex rounded-full border border-surface-border/80 bg-surface-card p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={cn(
                'rounded-full px-2.5 py-1 text-[10px] font-semibold transition-colors',
                period === p.id ? 'bg-ink-primary text-surface-card' : 'text-ink-muted hover:text-ink-primary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {period === 'compare' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-surface-border/60 bg-surface-elevated/25 p-3">
            <label className="text-[10px] font-medium text-ink-muted">
              Comparar
              <select
                className={selectClass}
                value={compareKind}
                onChange={(e) => setCompareKind(e.target.value as 'month' | 'year' | 'range')}
              >
                <option value="month">Meses</option>
                <option value="year">Años</option>
                <option value="range">Fechas</option>
              </select>
            </label>
            {compareKind === 'month' ? (
              <>
                <label className="text-[10px] font-medium text-ink-muted">
                  Período A
                  <select className={selectClass} value={monthA} onChange={(e) => setMonthA(e.target.value)}>
                    {monthOpts.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-medium text-ink-muted">
                  Período B
                  <select className={selectClass} value={monthB} onChange={(e) => setMonthB(e.target.value)}>
                    {monthOpts.map((o) => (
                      <option key={`b-${o.value}`} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {compareKind === 'year' ? (
              <>
                <label className="text-[10px] font-medium text-ink-muted">
                  Año A
                  <select className={selectClass} value={yearA} onChange={(e) => setYearA(e.target.value)}>
                    {yearOpts.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] font-medium text-ink-muted">
                  Año B
                  <select className={selectClass} value={yearB} onChange={(e) => setYearB(e.target.value)}>
                    {yearOpts.map((y) => (
                      <option key={`b-${y}`} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : null}
            {compareKind === 'range' ? (
              <>
                <label className="text-[10px] font-medium text-ink-muted">A desde<input className={selectClass} type="date" value={rangeAFrom} onChange={(e) => setRangeAFrom(e.target.value)} /></label>
                <label className="text-[10px] font-medium text-ink-muted">A hasta<input className={selectClass} type="date" value={rangeATo} onChange={(e) => setRangeATo(e.target.value)} /></label>
                <label className="text-[10px] font-medium text-ink-muted">B desde<input className={selectClass} type="date" value={rangeBFrom} onChange={(e) => setRangeBFrom(e.target.value)} /></label>
                <label className="text-[10px] font-medium text-ink-muted">B hasta<input className={selectClass} type="date" value={rangeBTo} onChange={(e) => setRangeBTo(e.target.value)} /></label>
              </>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-ink-primary">Período A</p>
              {seriesA.length ? seriesA.map((s) => <ChartCard key={`a-${s.key}`} series={s} tick={tick} isDark={isDark} />) : <p className="text-[11px] text-ink-muted">Sin datos en A.</p>}
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-ink-primary">Período B</p>
              {seriesB.length ? seriesB.map((s) => <ChartCard key={`b-${s.key}`} series={s} tick={tick} isDark={isDark} />) : <p className="text-[11px] text-ink-muted">Sin datos en B.</p>}
            </div>
          </div>
        </div>
      ) : series.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {series.map((s) => (
            <ChartCard key={s.key} series={s} tick={tick} isDark={isDark} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-ink-muted">Todavía no hay opciones de hábitos en esas respuestas.</p>
      )}
    </div>
  )
}
