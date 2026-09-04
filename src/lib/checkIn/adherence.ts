import { optionById, parseStoredChoice, type CheckInQuestion } from '@/lib/checkIn/questions'
import { checkInFridayYmd } from '@/lib/checkInWeek'

/** Valores por defecto (Tomás puede cambiarlos en código / UI más adelante). */
export const DEFAULT_ADHERENCE_SCORES: Record<string, Record<string, number>> = {
  training: { a: 100, b: 50, c: 0 },
  meals: { a: 100, b: 50, c: 70 },
}

export type AdherenceWeekPoint = {
  weekKey: string
  label: string
  score: number | null
  delta: number | null
  missing: boolean
}

function scoreQuestion(
  q: CheckInQuestion,
  raw: unknown,
  table: Record<string, number>,
): number | null {
  const choice = parseStoredChoice(raw)
  if (!choice) return null
  const opt = optionById(q, choice.option)
  if (!opt) return null
  if (table[opt.id] != null) return table[opt.id]
  return null
}

export function weeklyAdherenceScore(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
  scores = DEFAULT_ADHERENCE_SCORES,
): number | null {
  const parts: number[] = []
  for (const key of Object.keys(scores)) {
    const q = questions.find((item) => item.key === key)
    if (!q) continue
    const n = scoreQuestion(q, responses[q.id], scores[key] ?? {})
    if (n != null) parts.push(n)
  }
  if (!parts.length) return null
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
}

export function buildAdherenceTimeline(
  rows: { submittedAt: string; questions: CheckInQuestion[]; responses: Record<string, unknown> }[],
): AdherenceWeekPoint[] {
  const byWeek = new Map<string, { at: string; score: number | null }>()
  for (const row of rows) {
    const key = checkInFridayYmd(new Date(row.submittedAt))
    const score = weeklyAdherenceScore(row.questions, row.responses)
    const prev = byWeek.get(key)
    if (!prev || row.submittedAt > prev.at) byWeek.set(key, { at: row.submittedAt, score })
  }
  const keys = [...byWeek.keys()].sort()
  const points: AdherenceWeekPoint[] = []
  let lastScore: number | null = null
  for (const key of keys) {
    const score = byWeek.get(key)?.score ?? null
    const [y, m, d] = key.split('-')
    points.push({
      weekKey: key,
      label: `${d}/${m}`,
      score,
      delta: score != null && lastScore != null ? score - lastScore : null,
      missing: score == null,
    })
    if (score != null) lastScore = score
  }
  return points
}

export function latestAdherenceSummary(points: AdherenceWeekPoint[]): {
  score: number | null
  delta: number | null
} {
  for (let i = points.length - 1; i >= 0; i -= 1) {
    const p = points[i]
    if (p && p.score != null) return { score: p.score, delta: p.delta }
  }
  return { score: null, delta: null }
}
