import { call, type DayLog } from '@/lib/routine/studentTrainingLog'
import { VOLUME_MUSCLES, type MuscleId } from '@/lib/volume/trainingVolume'

/**
 * Chequeo diario obligatorio del link del alumno (feedback del entrenador, nov3;
 * 20261120120000_daily_checkin_v2.sql). Se responde antes de ver la rutina del día.
 * Todos los días: escalas del 1 al 5, horas de sueño, tipo de dolor (con mapa muscular si no es
 * habitual) y qué complicó la alimentación si estuvo mal. Al cerrar la semana: pasos y ciclo menstrual.
 */

export type ScaleKey = 'energy' | 'sleep' | 'stress' | 'soreness' | 'hydration' | 'motivation' | 'recovery' | 'nutrition'
type Option<T extends string> = { id: T; label: string }

export const SLEEP_HOURS = [
  { id: 'none', label: 'No dormí' },
  { id: 'lt5', label: 'Menos de 5 h' },
  { id: '6to7', label: '6 a 7 h' },
  { id: 'gt8', label: 'Más de 8 h' },
] as const satisfies readonly Option<string>[]
export type SleepHours = (typeof SLEEP_HOURS)[number]['id']

export const PAIN_KINDS = [
  { id: 'normal', label: 'Dolores normales del entrenamiento' },
  { id: 'unusual', label: 'Dolor no habitual' },
  { id: 'none', label: 'No' },
] as const satisfies readonly Option<string>[]
export type PainKind = (typeof PAIN_KINDS)[number]['id']

export const NUTRITION_ISSUES = [
  { id: 'time', label: 'Falta de tiempo / desorganización' },
  { id: 'anxiety', label: 'Ansiedad / picoteo' },
  { id: 'ate_out', label: 'Comí afuera' },
  { id: 'not_ready', label: 'No tenía la comida lista' },
  { id: 'other', label: 'Otro' },
] as const satisfies readonly Option<string>[]
export type NutritionIssue = (typeof NUTRITION_ISSUES)[number]['id']

export const STEPS = [
  { id: 'lt5000', label: 'Menos de 5.000' },
  { id: '5000to7500', label: '5.000 a 7.500' },
  { id: '7500to10000', label: '7.500 a 10.000' },
  { id: '10000to12000', label: '10.000 a 12.000' },
  { id: 'gt12000', label: 'Más de 12.000' },
] as const satisfies readonly Option<string>[]
export type StepsAvg = (typeof STEPS)[number]['id']

export const CYCLE_ANSWERS = [
  { id: 'logged', label: 'Sí, ya lo registré' },
  { id: 'not_logged', label: 'No, lo registro ahora' },
  { id: 'pill', label: 'Tomo pastillas anticonceptivas' },
  { id: 'menopause', label: 'Menopausia' },
] as const satisfies readonly Option<string>[]
export type CycleAnswer = (typeof CYCLE_ANSWERS)[number]['id']

/** Textos de la alimentación, del 1 al 5 (los del entrenador). */
export const NUTRITION_LABELS: Record<number, string> = {
  1: 'Muy desordenada (salteé comidas / comí lo que había)',
  2: 'Desordenada',
  3: 'Normal, ni bien ni mal',
  4: 'Bastante bien, respeté casi todo',
  5: 'Excelente, 100% el plan',
}

/**
 * Escalas en el orden del entrenador. `good`: si 5 es lo mejor ('high') o 1 es lo mejor ('low'),
 * para pintar los números de rojo a verde.
 */
export const DAILY_SCALES: { key: ScaleKey; label: string; low: string; high: string; short: string; good: 'high' | 'low' }[] = [
  { key: 'energy', label: '¿Cómo estás de energía?', low: 'Sin energía', high: 'Con todo', short: 'Energía', good: 'high' },
  { key: 'sleep', label: '¿Cómo dormiste hoy?', low: 'Muy mal', high: 'Muy bien', short: 'Sueño', good: 'high' },
  { key: 'stress', label: '¿Cuánto estrés tenés hoy?', low: 'Nada', high: 'Muchísimo', short: 'Estrés', good: 'low' },
  { key: 'soreness', label: '¿Tenés dolores o molestias?', low: 'Ninguna', high: 'Muchas', short: 'Dolores', good: 'low' },
  { key: 'hydration', label: '¿Te estás hidratando bien?', low: 'Nada', high: 'Muy hidratado', short: 'Hidratación', good: 'high' },
  { key: 'motivation', label: '¿Qué ganas tenés de entrenar hoy?', low: 'Ninguna', high: 'Muchísimas', short: 'Ganas', good: 'high' },
  { key: 'recovery', label: '¿Qué tan recuperado estás de la sesión anterior?', low: 'Nada', high: 'Totalmente', short: 'Recuperación', good: 'high' },
  { key: 'nutrition', label: '¿Cómo estuvo tu alimentación?', low: 'Muy desordenada', high: 'Excelente', short: 'Alimentación', good: 'high' },
]

export interface DailyCheckinDraft {
  scales: Partial<Record<ScaleKey, number | null>>
  sleepHours: SleepHours | null
  painKind: PainKind | null
  painAreas: MuscleId[]
  painNote: string
  nutritionIssue: NutritionIssue | null
  nutritionIssueNote: string
  steps: StepsAvg | null
  cycle: CycleAnswer | null
  /** Con «No, lo registro ahora»: primer día de la última menstruación (yyyy-MM-dd). */
  cycleDate: string
  note: string
}

export const EMPTY_DRAFT: DailyCheckinDraft = {
  scales: {},
  sleepHours: null,
  painKind: null,
  painAreas: [],
  painNote: '',
  nutritionIssue: null,
  nutritionIssueNote: '',
  steps: null,
  cycle: null,
  cycleDate: '',
  note: '',
}

export const needsNutritionIssue = (d: DailyCheckinDraft) => (d.scales.nutrition ?? 5) <= 2

/** Lo que falta para poder enviar (vacío = listo). `weekClose`: último día de la semana; `woman`: pregunta el ciclo. */
export function missingAnswers(d: DailyCheckinDraft, opts: { weekClose: boolean; woman: boolean }): string[] {
  const out: string[] = []
  for (const s of DAILY_SCALES) if (d.scales[s.key] == null) out.push(s.short)
  if (!d.sleepHours) out.push('Horas de sueño')
  if (!d.painKind) out.push('Tipo de dolor')
  if (d.painKind === 'unusual' && d.painAreas.length === 0) out.push('Dónde te duele')
  if (needsNutritionIssue(d) && !d.nutritionIssue) out.push('Qué te complicó la alimentación')
  if (needsNutritionIssue(d) && d.nutritionIssue === 'other' && !d.nutritionIssueNote.trim()) out.push('Contanos qué te complicó')
  if (opts.weekClose && !d.steps) out.push('Pasos')
  if (opts.weekClose && opts.woman && !d.cycle) out.push('Ciclo menstrual')
  if (opts.weekClose && opts.woman && d.cycle === 'not_logged' && !d.cycleDate) out.push('Fecha del ciclo')
  return out
}

const MUSCLE_LABEL = Object.fromEntries(VOLUME_MUSCLES.map((m) => [m.id, m.label])) as Record<MuscleId, string>
export const muscleLabel = (id: string) => MUSCLE_LABEL[id as MuscleId] ?? id

/** Texto del aviso al entrenador: «Glúteo, Femoral · me tira al subir escaleras». */
export function painMessage(areas: string[], note: string): string {
  const where = areas.map(muscleLabel).join(', ')
  const t = note.trim()
  return `Dolor no habitual en ${where || 'una zona sin marcar'}${t ? ` · ${t}` : ''}`
}

/** Lo que se guarda en routine_day_logs, para actualizar la página sin volver a leer. */
export function draftToLog(d: DailyCheckinDraft, opts: { weekClose: boolean; woman: boolean }): Partial<DayLog> {
  const issue = needsNutritionIssue(d) ? d.nutritionIssue : null
  return {
    sleep: d.scales.sleep ?? null,
    energy: d.scales.energy ?? null,
    stress: d.scales.stress ?? null,
    soreness: d.scales.soreness ?? null,
    hydration: d.scales.hydration ?? null,
    motivation: d.scales.motivation ?? null,
    recovery: d.scales.recovery ?? null,
    nutrition: d.scales.nutrition ?? null,
    sleep_hours: d.sleepHours,
    pain_kind: d.painKind,
    pain_areas: d.painKind === 'unusual' ? d.painAreas : [],
    pain_note: d.painKind === 'unusual' ? d.painNote.trim() : '',
    nutrition_issue: issue,
    nutrition_issue_note: issue === 'other' ? d.nutritionIssueNote.trim() : '',
    steps_avg: opts.weekClose ? d.steps : null,
    cycle_answer: opts.weekClose && opts.woman ? d.cycle : null,
    checkin_note: d.note.trim(),
  }
}

export async function saveSharedDailyCheckin(token: string, dayId: string, log: Partial<DayLog>): Promise<void> {
  const { checkin_note, ...rest } = log
  await call('save_shared_daily_checkin', {
    p_token: token,
    p_day_id: dayId,
    p_data: {
      ...rest,
      note: checkin_note ?? '',
      pain_message: log.pain_kind === 'unusual' ? painMessage(log.pain_areas ?? [], log.pain_note ?? '') : '',
    },
  })
}

/**
 * Renglón corto: «Energía 4/5 · Sueño 3/5 (6 a 7 h) · …». Con `full` (para el entrenador) suma la aclaración
 * del dolor, qué complicó la alimentación, los pasos y el ciclo.
 */
export function dailySummary(log: DayLog, opts: { full?: boolean } = {}): string {
  const parts: string[] = []
  for (const s of DAILY_SCALES) {
    const v = log[s.key]
    if (v == null) continue
    let t = `${s.short} ${v}/5`
    if (s.key === 'sleep' && log.sleep_hours) t += ` (${SLEEP_HOURS.find((o) => o.id === log.sleep_hours)?.label ?? log.sleep_hours})`
    parts.push(t)
  }
  if (log.pain_kind === 'unusual') {
    const note = opts.full && log.pain_note?.trim() ? ` («${log.pain_note.trim()}»)` : ''
    parts.push(`Dolor no habitual: ${(log.pain_areas ?? []).map(muscleLabel).join(', ')}${note}`)
  } else if (opts.full && log.pain_kind === 'normal') parts.push('Dolores normales del entrenamiento')
  if (opts.full) {
    if (log.nutrition_issue) {
      const label = NUTRITION_ISSUES.find((o) => o.id === log.nutrition_issue)?.label ?? log.nutrition_issue
      parts.push(`Le complicó: ${log.nutrition_issue === 'other' && log.nutrition_issue_note ? log.nutrition_issue_note : label}`)
    }
    if (log.steps_avg) parts.push(`Pasos: ${STEPS.find((o) => o.id === log.steps_avg)?.label ?? log.steps_avg}`)
    if (log.cycle_answer) parts.push(`Ciclo: ${CYCLE_ANSWERS.find((o) => o.id === log.cycle_answer)?.label ?? log.cycle_answer}`)
  }
  return parts.join(' · ')
}
