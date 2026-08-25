import {
  CHECK_IN_SKIP_OPTION,
  optionById,
  parseStoredChoice,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'

export type CheckInHabitChartPeriod = 'weekly' | 'monthly' | 'yearly'

export type CheckInResponsePoint = {
  submittedAt: string
  responses: Record<string, unknown>
  questions: CheckInQuestion[]
}

export type HabitChartSegment = {
  optionId: string
  label: string
  color: string
  count: number
}

export type HabitChartBucket = {
  label: string
  sortKey: string
  segments: HabitChartSegment[]
}

export type HabitChartSeries = {
  key: string
  title: string
  buckets: HabitChartBucket[]
}

const HABIT_KEYS = ['pain', 'mood', 'cycle', 'training', 'meals', 'weights', 'activity', 'hydration'] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function argentinaParts(iso: string): { y: number; m: number; d: number } {
  const d = new Date(iso)
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [y, m, day] = fmt.format(d).split('-').map(Number)
  return { y: y ?? 0, m: m ?? 1, d: day ?? 1 }
}

/** Lunes de esa fecha (Argentina, calendario). */
function mondayKey(iso: string): string {
  const { y, m, d } = argentinaParts(iso)
  const utc = Date.UTC(y, m - 1, d)
  const dow = new Date(utc).getUTCDay()
  const delta = dow === 0 ? -6 : 1 - dow
  const mon = new Date(utc + delta * 86400000)
  return `${mon.getUTCFullYear()}-${pad(mon.getUTCMonth() + 1)}-${pad(mon.getUTCDate())}`
}

function bucketKey(iso: string, period: CheckInHabitChartPeriod): { key: string; label: string } {
  const { y, m } = argentinaParts(iso)
  if (period === 'yearly') {
    return { key: String(y), label: String(y) }
  }
  if (period === 'monthly') {
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
    return { key: `${y}-${pad(m)}`, label }
  }
  const key = mondayKey(iso)
  const [yy, mm, dd] = key.split('-')
  return { key, label: `${dd}/${mm}` }
}

export function buildCheckInHabitCharts(
  points: CheckInResponsePoint[],
  period: CheckInHabitChartPeriod,
): HabitChartSeries[] {
  const byKey = new Map<string, { title: string; question: CheckInQuestion; buckets: Map<string, Map<string, number>> }>()

  for (const p of points) {
    const { key: bKey, label: bLabel } = bucketKey(p.submittedAt, period)
    for (const q of p.questions) {
      if (!q.key || !HABIT_KEYS.includes(q.key as (typeof HABIT_KEYS)[number])) continue
      if (q.type !== 'choice') continue
      const choice = parseStoredChoice(p.responses[q.id])
      if (!choice || choice.option === CHECK_IN_SKIP_OPTION) continue
      const opt = optionById(q, choice.option)
      if (!opt) continue

      let series = byKey.get(q.key)
      if (!series) {
        series = { title: q.label, question: q, buckets: new Map() }
        byKey.set(q.key, series)
      }
      let bucket = series.buckets.get(bKey)
      if (!bucket) {
        bucket = new Map()
        series.buckets.set(bKey, bucket)
      }
      bucket.set(opt.id, (bucket.get(opt.id) ?? 0) + 1)
    }
  }

  const labelsByKey = new Map<string, string>()
  for (const p of points) {
    const { key, label } = bucketKey(p.submittedAt, period)
    labelsByKey.set(key, label)
  }

  const out: HabitChartSeries[] = []
  for (const key of HABIT_KEYS) {
    const series = byKey.get(key)
    if (!series) continue
    const bucketKeys = [...series.buckets.keys()].filter((k) => !k.endsWith('::__label')).sort()
    const buckets: HabitChartBucket[] = bucketKeys.map((bk) => {
      const counts = series.buckets.get(bk) ?? new Map()
      const segments: HabitChartSegment[] = (series.question.options ?? []).map((opt) => ({
        optionId: opt.id,
        label: opt.label,
        color: opt.color,
        count: counts.get(opt.id) ?? 0,
      }))
      return { label: labelsByKey.get(bk) ?? bk, sortKey: bk, segments }
    })
    if (buckets.every((b) => b.segments.every((s) => s.count === 0))) continue
    out.push({ key, title: series.title, buckets })
  }
  return out
}

export function habitChartBarRows(series: HabitChartSeries): Array<Record<string, string | number>> {
  return series.buckets.map((b) => {
    const row: Record<string, string | number> = { label: b.label }
    for (const s of b.segments) row[s.optionId] = s.count
    return row
  })
}

export type HabitCompareFilter =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'year'; year: number }
  | { kind: 'range'; from: string; to: string }

export function filterPointsByCompare(
  points: CheckInResponsePoint[],
  filter: HabitCompareFilter,
): CheckInResponsePoint[] {
  return points.filter((p) => {
    const { y, m, d } = argentinaParts(p.submittedAt)
    if (filter.kind === 'year') return y === filter.year
    if (filter.kind === 'month') return y === filter.year && m === filter.month
    const iso = `${y}-${pad(m)}-${pad(d)}`
    return iso >= filter.from && iso <= filter.to
  })
}

export function availableMonthOptions(points: CheckInResponsePoint[]): { value: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const p of points) {
    const { y, m } = argentinaParts(p.submittedAt)
    const value = `${y}-${pad(m)}`
    if (!seen.has(value)) {
      seen.set(
        value,
        new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      )
    }
  }
  return [...seen.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([value, label]) => ({ value, label }))
}

export function availableYearOptions(points: CheckInResponsePoint[]): number[] {
  const years = new Set(points.map((p) => argentinaParts(p.submittedAt).y))
  return [...years].sort((a, b) => b - a)
}
