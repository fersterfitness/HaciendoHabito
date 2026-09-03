/** Preguntas del check-in semanal: tipos, plantillas y serialización compatible con el RPC actual. */

import { CHECK_IN_SUBMISSION_TIMEZONE, checkInFridayOfWeekUtc } from '@/lib/checkInWeek'

export const CHECK_IN_SKIP_OPTION = '__skip'
export const CHECK_IN_NOTE_MAX = 800
export const CHECK_IN_TEXT_MAX = 4000

export type CheckInQuestionType = 'text' | 'scale' | 'choice'
export type CheckInOptionExtra = 'none' | 'number' | 'date'
export type CheckInGenderFilter = 'F'

export type CheckInOption = {
  id: string
  label: string
  color: string
  extra?: CheckInOptionExtra
}

export type CheckInQuestion = {
  id: string
  label: string
  type: CheckInQuestionType
  options?: CheckInOption[]
  allowNote?: boolean
  visibleIfGender?: CheckInGenderFilter
  /** Texto de ayuda debajo del título (p. ej. ciclo menstrual). */
  helperText?: string
  /** Clave estable para gráficos / lógica (week_status, mood, …). */
  key?: string
}

export type CheckInAnswerDraft = {
  optionId: string
  extra: string
  note: string
  text: string
}

export type StoredChoiceAnswer = {
  option: string
  extra?: string
  note?: string
}

export const CHOICE_COLOR_PRESETS = [
  { id: 'green', hex: '#22c55e', label: 'Verde' },
  { id: 'amber', hex: '#f59e0b', label: 'Ámbar' },
  { id: 'rose', hex: '#f43f5e', label: 'Rosa' },
  { id: 'violet', hex: '#a855f7', label: 'Violeta' },
  { id: 'sky', hex: '#0ea5e9', label: 'Celeste' },
] as const

const COLOR_A = '#22c55e'
const COLOR_B = '#f59e0b'
const COLOR_C = '#f43f5e'
const COLOR_D = '#a855f7'

export function emptyAnswerDraft(): CheckInAnswerDraft {
  return { optionId: '', extra: '', note: '', text: '' }
}

export function parseQuestions(raw: unknown): CheckInQuestion[] {
  if (!Array.isArray(raw)) return []
  const out: CheckInQuestion[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    const type: CheckInQuestionType =
      o.type === 'scale' ? 'scale' : o.type === 'choice' ? 'choice' : 'text'
    const q: CheckInQuestion = { id: o.id, label: o.label, type }
    if (typeof o.key === 'string' && o.key.trim()) q.key = o.key.trim()
    if (typeof o.helperText === 'string' && o.helperText.trim()) q.helperText = o.helperText.trim()
    if (o.visibleIfGender === 'F') q.visibleIfGender = 'F'
    if (o.allowNote === true || (type === 'choice' && o.allowNote !== false)) q.allowNote = true
    if (type === 'choice') {
      q.options = parseOptions(o.options)
      if (q.allowNote !== false) q.allowNote = true
    }
    out.push(q)
  }
  return out
}

function parseOptions(raw: unknown): CheckInOption[] {
  if (!Array.isArray(raw)) return []
  const out: CheckInOption[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    const extra: CheckInOptionExtra =
      o.extra === 'number' || o.extra === 'date' ? o.extra : 'none'
    out.push({
      id: o.id,
      label: o.label,
      color: typeof o.color === 'string' && o.color.trim() ? o.color.trim() : COLOR_B,
      extra,
    })
  }
  return out
}

export function isQuestionVisible(
  q: CheckInQuestion,
  gender: string | null | undefined,
): boolean {
  if (q.visibleIfGender !== 'F') return true
  if (gender == null || gender === '') return true
  return gender === 'F'
}

export function encodeChoiceAnswer(answer: StoredChoiceAnswer): string {
  const payload: StoredChoiceAnswer = { option: answer.option }
  if (answer.extra?.trim()) payload.extra = answer.extra.trim()
  if (answer.note?.trim()) payload.note = answer.note.trim()
  return JSON.stringify(payload)
}

export function parseStoredChoice(raw: unknown): StoredChoiceAnswer | null {
  if (raw == null) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    if (typeof o.option === 'string') {
      return {
        option: o.option,
        extra: typeof o.extra === 'string' ? o.extra : undefined,
        note: typeof o.note === 'string' ? o.note : undefined,
      }
    }
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s.startsWith('{')) return null
  try {
    const parsed = JSON.parse(s) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const o = parsed as Record<string, unknown>
    if (typeof o.option !== 'string') return null
    return {
      option: o.option,
      extra: typeof o.extra === 'string' ? o.extra : undefined,
      note: typeof o.note === 'string' ? o.note : undefined,
    }
  } catch {
    return null
  }
}

export function optionById(q: CheckInQuestion, optionId: string | undefined): CheckInOption | undefined {
  if (!optionId) return undefined
  return q.options?.find((o) => o.id === optionId)
}

export function formatStoredAnswer(q: CheckInQuestion | undefined, raw: unknown): string {
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'number') return String(raw)
  const choice = parseStoredChoice(raw)
  if (choice) {
    if (choice.option === CHECK_IN_SKIP_OPTION) return 'No aplica'
    const opt = q ? optionById(q, choice.option) : undefined
    const bits = [opt?.label ?? choice.option]
    if (choice.extra) bits.push(choice.extra)
    if (choice.note) bits.push(`Aclaración: ${choice.note}`)
    return bits.join(' · ')
  }
  return String(raw)
}

export function serializeDrafts(
  questions: CheckInQuestion[],
  drafts: Record<string, CheckInAnswerDraft>,
  gender: string | null | undefined,
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  for (const q of questions) {
    if (!isQuestionVisible(q, gender)) {
      out[q.id] = encodeChoiceAnswer({ option: CHECK_IN_SKIP_OPTION })
      continue
    }
    const d = drafts[q.id] ?? emptyAnswerDraft()
    if (q.type === 'scale') {
      out[q.id] = Number(d.text)
    } else if (q.type === 'choice') {
      out[q.id] = encodeChoiceAnswer({
        option: d.optionId,
        extra: d.extra,
        note: d.note,
      })
    } else {
      out[q.id] = d.text.trim()
    }
  }
  return out
}

export function questionByKey(questions: CheckInQuestion[], key: string): CheckInQuestion | undefined {
  return questions.find((q) => q.key === key)
}

export type WeekStatusFromAnswers = {
  finished: boolean
  weekNumber: number | null
  lastWeek: boolean
}

const WEEK_STATUS_OPTION_IDS = new Set(['finished', 'in_week', 'last_week'])

function weekStatusChoiceFromResponses(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
): StoredChoiceAnswer | null {
  const q = questionByKey(questions, 'week_status')
  const ordered: unknown[] = []
  if (q) ordered.push(responses[q.id])
  for (const [key, value] of Object.entries(responses)) {
    if (q && key === q.id) continue
    ordered.push(value)
  }
  for (const raw of ordered) {
    const choice = parseStoredChoice(raw)
    if (!choice || choice.option === CHECK_IN_SKIP_OPTION) continue
    if (WEEK_STATUS_OPTION_IDS.has(choice.option)) return choice
  }
  return null
}

export function weekStatusFromAnswers(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
): WeekStatusFromAnswers {
  const empty: WeekStatusFromAnswers = { finished: false, weekNumber: null, lastWeek: false }
  const choice = weekStatusChoiceFromResponses(questions, responses)
  if (!choice) return empty
  if (choice.option === 'finished') return { finished: true, weekNumber: null, lastWeek: false }
  if (choice.option === 'last_week') {
    const n = Number(choice.extra)
    return {
      finished: false,
      weekNumber: Number.isFinite(n) && n > 0 ? Math.floor(n) : null,
      lastWeek: true,
    }
  }
  const n = Number(choice.extra)
  return {
    finished: false,
    weekNumber: Number.isFinite(n) && n > 0 ? Math.floor(n) : null,
    lastWeek: false,
  }
}

export function weekStatusHasSignal(st: WeekStatusFromAnswers): boolean {
  return st.finished || st.lastWeek || st.weekNumber != null
}

function questionCatalogSig(q: CheckInQuestion): string {
  const opts = (q.options ?? [])
    .map((o) => `${o.id}\t${o.label}\t${o.color}\t${o.extra && o.extra !== 'none' ? o.extra : ''}`)
    .join('\n')
  return [q.id, q.key ?? '', q.label, q.helperText ?? '', q.type, q.allowNote ? '1' : '0', q.visibleIfGender ?? '', opts].join('|')
}

/** Aplica la plantilla conservando los id de pregunta (y de opción) para no invalidar respuestas ya guardadas. */
export function mergeCheckInTemplate(
  current: CheckInQuestion[],
  template: CheckInQuestion[],
): CheckInQuestion[] {
  const byKey = new Map(current.filter((q) => q.key).map((q) => [q.key as string, q]))
  return template.map((tpl) => {
    const prev = tpl.key ? byKey.get(tpl.key) : undefined
    if (!prev) {
      return {
        ...tpl,
        id: crypto.randomUUID(),
        options: tpl.options?.map((o) => ({ ...o })),
      }
    }
    return {
      ...tpl,
      id: prev.id,
      options: tpl.options?.map((o) => ({ ...o })),
    }
  })
}

/** Actualiza etiquetas y opciones nuevas del catálogo semanal sin cambiar ids. */
export function syncWeeklyQuestionCatalog(questions: CheckInQuestion[]): {
  questions: CheckInQuestion[]
  changed: boolean
} {
  if (!isWeeklyTemplate(questions)) return { questions, changed: false }
  const templateByKey = new Map(
    createWeeklyCheckInQuestions()
      .filter((q) => q.key)
      .map((q) => [q.key as string, q]),
  )
  let changed = false
  const next = questions.map((q) => {
    if (!q.key) return q
    const tpl = templateByKey.get(q.key)
    if (!tpl) return q
    const patched: CheckInQuestion = {
      ...q,
      label: tpl.label,
      helperText: tpl.helperText,
      type: tpl.type,
      allowNote: tpl.allowNote,
      visibleIfGender: tpl.visibleIfGender,
      options: tpl.options?.map((o) => ({ ...o })),
    }
    if (questionCatalogSig(patched) !== questionCatalogSig(q)) {
      changed = true
      return patched
    }
    return q
  })
  return { questions: next, changed }
}

/** Copia respuestas de ids viejos a ids nuevos cuando la pregunta tiene la misma `key`. */
export function remapResponsesToQuestionIds(
  responses: Record<string, unknown>,
  oldQuestions: CheckInQuestion[],
  newQuestions: CheckInQuestion[],
): Record<string, unknown> {
  const oldByKey = new Map(oldQuestions.filter((q) => q.key).map((q) => [q.key as string, q.id]))
  const newByKey = new Map(newQuestions.filter((q) => q.key).map((q) => [q.key as string, q.id]))
  const out: Record<string, unknown> = { ...responses }
  let copied = false
  for (const [key, oldId] of oldByKey) {
    const newId = newByKey.get(key)
    if (!newId || newId === oldId) continue
    if (!(oldId in out)) continue
    const existing = out[newId]
    const empty = existing == null || existing === ''
    if (empty) {
      out[newId] = out[oldId]
      copied = true
    }
  }
  return copied ? out : responses
}

export function questionIdsChangedByKey(
  oldQuestions: CheckInQuestion[],
  newQuestions: CheckInQuestion[],
): boolean {
  const oldByKey = new Map(oldQuestions.filter((q) => q.key).map((q) => [q.key as string, q.id]))
  const newByKey = new Map(newQuestions.filter((q) => q.key).map((q) => [q.key as string, q.id]))
  for (const [key, oldId] of oldByKey) {
    const newId = newByKey.get(key)
    if (newId && newId !== oldId) return true
  }
  return false
}

export function checkInHistoryMeta(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
  submittedAt: string,
  studentName?: string,
): { monthLabel: string; dateLabel: string; weekLabel: string; filingLabel: string } {
  const friday = checkInFridayOfWeekUtc(new Date(submittedAt))
  const monthLabel = friday.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: CHECK_IN_SUBMISSION_TIMEZONE,
  })
  const dateLabel = friday.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: CHECK_IN_SUBMISSION_TIMEZONE,
  })
  const st = weekStatusFromAnswers(questions, responses)
  const weekLabel = st.finished
    ? 'Terminé mi mes de rutina'
    : st.lastWeek
      ? 'Última semana'
      : st.weekNumber
        ? `Semana ${st.weekNumber}`
        : '—'
  const name = studentName?.trim() ? studentName.trim() : ''
  const filingLabel = [monthLabel, dateLabel, name, weekLabel].filter((x) => x && x !== '—').join(' · ')
  return { monthLabel, dateLabel, weekLabel, filingLabel }
}

export function menstrualDateFromAnswers(
  questions: CheckInQuestion[],
  responses: Record<string, unknown>,
): string | null {
  const q = questionByKey(questions, 'cycle')
  if (!q) return null
  const choice = parseStoredChoice(responses[q.id])
  if (!choice || choice.option === CHECK_IN_SKIP_OPTION) return null
  const opt = optionById(q, choice.option)
  if (opt?.extra !== 'date' && choice.option !== 'last_date') return null
  const d = choice.extra?.trim() ?? ''
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

export function isWeeklyTemplate(questions: CheckInQuestion[]): boolean {
  return questions.some((q) => q.key === 'week_status')
}

export function isMonthlyTemplate(questions: CheckInQuestion[]): boolean {
  return questions.some((q) => q.key?.startsWith('monthly_'))
}

function opt(id: string, label: string, color: string, extra: CheckInOptionExtra = 'none'): CheckInOption {
  return { id, label, color, extra }
}

export const WEEKLY_CHECK_IN_INTRO = `Hola 👋 este formulario semanal es para tener un FEEDBACK de cómo venís llevando tus hábitos, no solo en lo que respecta al entrenamiento. El componente emocional también es algo sumamente importante 💛

Por favor completalo TODAS LAS SEMANAS ✨📋`

export const MONTHLY_FEEDBACK_INTRO = `Terminaste tu mes de rutina 🙌 Este feedback mensual me ayuda a planificar tu próximo mesociclo.

Completalo con honestidad: no hay respuestas buenas o malas, solo información para seguir Haciéndolo Hábito 💪`

export function createWeeklyCheckInQuestions(): CheckInQuestion[] {
  return [
    {
      id: crypto.randomUUID(),
      key: 'full_name',
      label: 'Nombre y apellido',
      type: 'text',
    },
    {
      id: crypto.randomUUID(),
      key: 'week_status',
      label: '¿En qué semana de entrenamiento estás?',
      type: 'choice',
      allowNote: true,
      options: [
        opt('finished', 'Terminé mi mes de rutina', COLOR_A),
        opt('in_week', 'Estoy en mi semana', COLOR_B, 'number'),
        opt('last_week', 'Estoy en mi última semana', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'pain',
      label: '¿Tuviste molestias o algún dolor puntual?',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Sí', COLOR_C),
        opt('b', 'No', COLOR_A),
        opt('c', 'Dolores normales del propio entrenamiento', COLOR_B),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'mood',
      label: '¿Cuál de estas opciones representa mejor tu semana?',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Me siento contento/a', COLOR_A),
        opt('b', 'Estoy con temas personales', COLOR_C),
        opt('c', 'Estoy cansado/a', COLOR_B),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'cycle',
      label: 'Sobre tu ciclo menstrual',
      helperText: 'Registrate siempre en cada menstruación. Los ciclos varían: anotar la fecha me permite hacer el seguimiento.',
      type: 'choice',
      allowNote: true,
      visibleIfGender: 'F',
      options: [
        opt('last_date', '¿Cuándo fue tu última menstruación? (anotala siempre)', COLOR_D, 'date'),
        opt('a', 'Estoy menstruando', COLOR_C),
        opt('b', 'No me está afectando', COLOR_A),
        opt('c', 'Noto cansancio', COLOR_B),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'training',
      label: 'Entrenamiento',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Cumplí todos mis días', COLOR_A),
        opt('b', 'No pude cumplir al 100%', COLOR_B),
        opt('c', 'No fui ningún día', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'meals',
      label: 'Comidas',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Respeté mis 4 comidas', COLOR_A),
        opt('b', 'No cumplí al 100%', COLOR_B),
        opt('c', 'Me di un gustito', COLOR_D),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'weights',
      label: 'Registro de pesos',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Lo estoy completando', COLOR_A),
        opt('b', 'Lo tengo impreso pero no lo estoy completando', COLOR_B),
        opt('c', 'No lo imprimí', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'activity',
      label: '¿Cómo estuvo tu actividad semanal?',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Me mantuve bastante todos los días', COLOR_A),
        opt('b', 'Me mantuve poco activo/a', COLOR_B),
        opt('c', 'No me mantuve activo/a', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'hydration',
      label: 'Hidratación',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Me hidraté correctamente', COLOR_A),
        opt('b', 'Me hidraté poco', COLOR_B),
        opt('c', 'Me hidraté pero no con agua 🍺🍷', COLOR_C),
      ],
    },
  ]
}

export function createMonthlyFeedbackQuestions(): CheckInQuestion[] {
  return [
    {
      id: crypto.randomUUID(),
      key: 'full_name',
      label: 'Nombre y apellido',
      type: 'text',
    },
    {
      id: crypto.randomUUID(),
      key: 'monthly_mood',
      label: '¿Cómo sentís que cerró este mes?',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Muy bien, avanzando', COLOR_A),
        opt('b', 'Más o menos, con altibajos', COLOR_B),
        opt('c', 'Se me hizo cuesta arriba', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'monthly_training',
      label: 'Entrenamiento del mes',
      type: 'choice',
      allowNote: true,
      options: [
        opt('a', 'Cumplí casi todos los días', COLOR_A),
        opt('b', 'Cumplí a medias', COLOR_B),
        opt('c', 'Me costó sostenerlo', COLOR_C),
      ],
    },
    {
      id: crypto.randomUUID(),
      key: 'monthly_highlight',
      label: '¿Qué fue lo mejor de este mes?',
      type: 'text',
    },
    {
      id: crypto.randomUUID(),
      key: 'monthly_improve',
      label: '¿Qué te gustaría mejorar el mes que viene?',
      type: 'text',
    },
  ]
}

export function weeklyFormDefaults(): { title: string; intro: string; questions: CheckInQuestion[] } {
  return {
    title: 'Check-in semanal',
    intro: WEEKLY_CHECK_IN_INTRO,
    questions: createWeeklyCheckInQuestions(),
  }
}

export function monthlyFormDefaults(): { title: string; intro: string; questions: CheckInQuestion[] } {
  return {
    title: 'Feedback mensual',
    intro: MONTHLY_FEEDBACK_INTRO,
    questions: createMonthlyFeedbackQuestions(),
  }
}

export function validateDrafts(
  questions: CheckInQuestion[],
  drafts: Record<string, CheckInAnswerDraft>,
  gender: string | null | undefined,
): string | null {
  for (const q of questions) {
    if (!isQuestionVisible(q, gender)) continue
    const d = drafts[q.id] ?? emptyAnswerDraft()
    if (q.type === 'scale') {
      const n = Number(d.text)
      if (!Number.isInteger(n) || n < 1 || n > 5) return `Elegí un valor en: ${q.label}`
    } else if (q.type === 'choice') {
      if (!d.optionId) return `Elegí una opción en: ${q.label}`
      const optSel = optionById(q, d.optionId)
      if (!optSel) return `Elegí una opción en: ${q.label}`
      if (optSel.extra === 'number') {
        const n = Number(d.extra)
        if (!Number.isInteger(n) || n < 1 || n > 52) return `Indicá el número de semana en: ${q.label}`
      }
      if (optSel.extra === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(d.extra.trim())) {
        return `Indicá la fecha en: ${q.label}`
      }
      if (d.note.length > CHECK_IN_NOTE_MAX) return `Aclaración demasiado larga en: ${q.label}`
    } else {
      const t = d.text.trim()
      if (!t) return `Completá: ${q.label}`
      if (t.length > CHECK_IN_TEXT_MAX) return `«${q.label}»: máximo ${CHECK_IN_TEXT_MAX} caracteres.`
    }
  }
  return null
}
