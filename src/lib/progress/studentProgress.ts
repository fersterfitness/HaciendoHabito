/** Progreso del alumno: adherencia, rendimiento (1RM), bienestar 1–5 y NEAT (pasos), por semana. */

import { DEFAULT_ADHERENCE_SCORES } from '@/lib/checkIn/adherence'
import { mondayKey, type CheckInResponsePoint } from '@/lib/checkIn/habitCharts'
import { CHECK_IN_SKIP_OPTION, optionById, parseStoredChoice, WELLBEING_KEYS } from '@/lib/checkIn/questions'
import type { StudentRmRecord, StudentWeightLog } from '@/types/database'

export type WellbeingKey = (typeof WELLBEING_KEYS)[number]

export const WELLBEING_META: Record<WellbeingKey, { label: string; color: string; higherIsBetter: boolean }> = {
  sleep: { label: 'Sueño', color: '#6366f1', higherIsBetter: true },
  energy: { label: 'Energía', color: '#f59e0b', higherIsBetter: true },
  stress: { label: 'Estrés', color: '#f43f5e', higherIsBetter: false },
  hunger: { label: 'Hambre', color: '#10b981', higherIsBetter: false },
}

/** Pasos estimados por día según el rango elegido en el check-in. */
export const STEPS_ESTIMATE: Record<string, number> = {
  lt5k: 4000,
  '5k_7k': 6250,
  '7k_10k': 8750,
  gt10k: 11000,
}

export type ProgressWeek = {
  weekKey: string
  label: string
  /** % entrenamiento cumplido (check-in). */
  training: number | null
  /** % comidas cumplidas (check-in). */
  meals: number | null
  /** % de días de la semana con al menos un hábito registrado. */
  habitsPct: number | null
  sleep: number | null
  energy: number | null
  stress: number | null
  hunger: number | null
  /** Pasos/día estimados. */
  steps: number | null
}

function weekLabel(weekKey: string): string {
  const [, m, d] = weekKey.split('-')
  return `${d}/${m}`
}

function emptyWeek(weekKey: string): ProgressWeek {
  return {
    weekKey,
    label: weekLabel(weekKey),
    training: null,
    meals: null,
    habitsPct: null,
    sleep: null,
    energy: null,
    stress: null,
    hunger: null,
    steps: null,
  }
}

function choiceOptionId(point: CheckInResponsePoint, key: string): string | null {
  const q = point.questions.find((x) => x.key === key && x.type === 'choice')
  if (!q) return null
  const choice = parseStoredChoice(point.responses[q.id])
  if (!choice || choice.option === CHECK_IN_SKIP_OPTION) return null
  return optionById(q, choice.option)?.id ?? null
}

function scaleValue(point: CheckInResponsePoint, key: string): number | null {
  const q = point.questions.find((x) => x.key === key && x.type === 'scale')
  if (!q) return null
  const raw = point.responses[q.id]
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/** Lunes (YYYY-MM-DD) de una fecha local YYYY-MM-DD. */
export function mondayOfYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const utc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  const dow = new Date(utc).getUTCDay()
  const mon = new Date(utc + (dow === 0 ? -6 : 1 - dow) * 86400000)
  return mon.toISOString().slice(0, 10)
}

function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Una fila por semana (lunes a domingo). De cada semana se usa el último check-in enviado.
 * `habitLogDates` son las fechas (YYYY-MM-DD) con algún hábito marcado; en la semana en curso
 * el % se calcula sobre los días que ya pasaron.
 */
export function buildProgressWeeks(
  points: CheckInResponsePoint[],
  habitLogDates: string[] = [],
  today = new Date(),
): ProgressWeek[] {
  const todayYmd = ymdLocal(today)
  const currentWeek = mondayOfYmd(todayYmd)
  const elapsedThisWeek =
    Math.round((Date.parse(`${todayYmd}T00:00:00Z`) - Date.parse(`${currentWeek}T00:00:00Z`)) / 86400000) + 1
  const latest = new Map<string, CheckInResponsePoint>()
  for (const p of points) {
    const key = mondayKey(p.submittedAt)
    const prev = latest.get(key)
    if (!prev || p.submittedAt > prev.submittedAt) latest.set(key, p)
  }

  const weeks = new Map<string, ProgressWeek>()
  for (const [key, p] of latest) {
    const w = emptyWeek(key)
    for (const field of ['training', 'meals'] as const) {
      const opt = choiceOptionId(p, field)
      const table = DEFAULT_ADHERENCE_SCORES[field] ?? {}
      w[field] = opt != null && table[opt] != null ? table[opt] : null
    }
    for (const k of WELLBEING_KEYS) w[k] = scaleValue(p, k)
    const stepsOpt = choiceOptionId(p, 'steps')
    w.steps = stepsOpt ? (STEPS_ESTIMATE[stepsOpt] ?? null) : null
    weeks.set(key, w)
  }

  const daysByWeek = new Map<string, Set<string>>()
  for (const ymd of habitLogDates) {
    if (ymd > todayYmd) continue
    const key = mondayOfYmd(ymd)
    if (!daysByWeek.has(key)) daysByWeek.set(key, new Set())
    daysByWeek.get(key)!.add(ymd)
  }
  for (const [key, days] of daysByWeek) {
    const w = weeks.get(key) ?? emptyWeek(key)
    const daysInWeek = key === currentWeek ? elapsedThisWeek : 7
    w.habitsPct = Math.round((days.size / daysInWeek) * 100)
    weeks.set(key, w)
  }

  return [...weeks.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey))
}

export function average(values: (number | null | undefined)[]): number | null {
  const ok = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (!ok.length) return null
  return ok.reduce((a, b) => a + b, 0) / ok.length
}

/** Promedio de las últimas `n` semanas con dato contra las `n` anteriores. */
export function recentVsPrevious(
  weeks: ProgressWeek[],
  pick: (w: ProgressWeek) => number | null,
  n = 4,
): { current: number | null; previous: number | null; delta: number | null } {
  const vals = weeks.map(pick).filter((v): v is number => v != null)
  const current = average(vals.slice(-n))
  const previous = vals.length > n ? average(vals.slice(-2 * n, -n)) : null
  return { current, previous, delta: current != null && previous != null ? current - previous : null }
}

/** Adherencia combinada de una semana: promedio de entrenamiento, comidas y registro de hábitos. */
export function weekAdherence(w: ProgressWeek): number | null {
  const v = average([w.training, w.meals, w.habitsPct])
  return v == null ? null : Math.round(v)
}

export type LiftProgress = {
  key: string
  name: string
  history: { date: string; kg: number }[]
  first: { date: string; kg: number }
  last: { date: string; kg: number }
  deltaKg: number
  deltaPct: number
}

function liftKey(r: StudentRmRecord): string {
  const name = r.exercise?.name?.trim()
  if (!name) return `id:${r.exercise_id}`
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ')
}

/** Levantamientos principales: evolución del 1RM por ejercicio (más testeados primero). */
export function buildLiftProgress(records: StudentRmRecord[]): LiftProgress[] {
  const groups = new Map<string, { name: string; rows: StudentRmRecord[] }>()
  for (const r of records) {
    const kg = Number(r.rm_kg)
    if (!Number.isFinite(kg) || kg <= 0) continue
    const key = liftKey(r)
    if (!groups.has(key)) groups.set(key, { name: r.exercise?.name ?? 'Ejercicio', rows: [] })
    groups.get(key)!.rows.push(r)
  }
  const out: LiftProgress[] = []
  for (const [key, g] of groups) {
    const sorted = [...g.rows].sort(
      (a, b) => a.tested_at.localeCompare(b.tested_at) || a.created_at.localeCompare(b.created_at),
    )
    const history = sorted.map((r) => ({ date: r.tested_at.slice(0, 10), kg: Number(r.rm_kg) }))
    const first = history[0]!
    const last = history[history.length - 1]!
    out.push({
      key,
      name: g.name,
      history,
      first,
      last,
      deltaKg: Math.round((last.kg - first.kg) * 10) / 10,
      deltaPct: first.kg > 0 ? Math.round(((last.kg - first.kg) / first.kg) * 1000) / 10 : 0,
    })
  }
  return out.sort((a, b) => b.history.length - a.history.length || b.deltaPct - a.deltaPct)
}

export type WeightProgress = { first: StudentWeightLog; last: StudentWeightLog; deltaKg: number } | null

export function buildWeightProgress(logs: StudentWeightLog[]): WeightProgress {
  if (!logs.length) return null
  const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  return { first, last, deltaKg: Math.round((Number(last.weight_kg) - Number(first.weight_kg)) * 10) / 10 }
}

export type ProgressRange = '3m' | '6m' | '12m' | 'all'

/** Fecha mínima (YYYY-MM-DD) del período elegido; null = todo. */
export function rangeStartYmd(range: ProgressRange, today = new Date()): string | null {
  if (range === 'all') return null
  const months = range === '3m' ? 3 : range === '6m' ? 6 : 12
  const d = new Date(today.getFullYear(), today.getMonth() - months, today.getDate())
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
