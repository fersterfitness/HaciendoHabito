/**
 * Formulario propio de cada profesional (feedback nov19, tanda 6). El profesional arma sus preguntas; desde
 * cada solicitud le manda al cliente un link (`/f/:token`) para completarlo. La fecha de pago va siempre y
 * es obligatoria. Necesita 20261126120000_marketplace_formularios.sql.
 */

export const FORMS_MIGRATION = '20261126120000_marketplace_formularios.sql'

export type FormQuestionType = 'corta' | 'larga' | 'opciones' | 'si_no'

export interface FormQuestion {
  id: string
  texto: string
  tipo: FormQuestionType
  /** Solo para `opciones`. */
  opciones: string[]
  obligatoria: boolean
}

export interface FormAnswer {
  pregunta: string
  respuesta: string
}

export const FORM_QUESTION_TYPES: { value: FormQuestionType; label: string }[] = [
  { value: 'corta', label: 'Respuesta corta' },
  { value: 'larga', label: 'Párrafo' },
  { value: 'opciones', label: 'Elegir una opción' },
  { value: 'si_no', label: 'Sí / No' },
]

export const MAX_QUESTIONS = 30
export const MAX_QUESTION_LEN = 200
export const MAX_ANSWER_LEN = 1500

/** Preguntas con las que arranca un profesional que todavía no armó las suyas. */
export const DEFAULT_QUESTIONS: FormQuestion[] = [
  { id: 'edad', texto: 'Edad', tipo: 'corta', opciones: [], obligatoria: true },
  { id: 'objetivo', texto: '¿Cuál es tu objetivo principal?', tipo: 'larga', opciones: [], obligatoria: true },
  { id: 'lesiones', texto: '¿Tenés alguna lesión, dolor o problema de salud que debamos saber?', tipo: 'larga', opciones: [], obligatoria: true },
  { id: 'disponibilidad', texto: '¿Cuántos días por semana podés entrenar?', tipo: 'opciones', opciones: ['1 o 2', '3', '4', '5 o más'], obligatoria: false },
]

export const PAY_DAY_QUESTION = '¿Qué día del mes querés pagar?'

/** `'1'`…`'28'` o `'ultimo'`, igual que el formulario de inscripción. */
export const PAY_DAY_OPTIONS: { value: string; label: string }[] = [
  ...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `El ${i + 1}` })),
  { value: 'ultimo', label: 'El último día del mes' },
]

export function payDayLabel(v: string | null | undefined): string {
  if (!v) return ''
  return v === 'ultimo' ? 'el último día del mes' : `el día ${v} de cada mes`
}

let seq = 0
export function newQuestionId(): string {
  seq += 1
  return `q${Date.now().toString(36)}${seq}`
}

/** Lo que viene de la base, limpio. `null` (sin fila) → las preguntas de base. */
export function normalizeQuestions(raw: unknown): FormQuestion[] {
  if (!Array.isArray(raw)) return DEFAULT_QUESTIONS
  const out: FormQuestion[] = []
  for (const r of raw as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue
    const texto = typeof r.texto === 'string' ? r.texto.trim().slice(0, MAX_QUESTION_LEN) : ''
    if (!texto) continue
    const tipo = FORM_QUESTION_TYPES.some((t) => t.value === r.tipo) ? (r.tipo as FormQuestionType) : 'corta'
    const opciones = Array.isArray(r.opciones)
      ? (r.opciones as unknown[]).filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim().slice(0, 80)).slice(0, 12)
      : []
    // «Elegir una opción» con menos de dos opciones no sirve: queda como respuesta corta.
    const finalTipo = tipo === 'opciones' && opciones.length < 2 ? 'corta' : tipo
    out.push({
      id: typeof r.id === 'string' && r.id ? r.id : newQuestionId(),
      texto,
      tipo: finalTipo,
      opciones: finalTipo === 'opciones' ? opciones : [],
      obligatoria: r.obligatoria === true,
    })
    if (out.length >= MAX_QUESTIONS) break
  }
  return out
}

/** Problemas al guardar las preguntas (vacío = se puede guardar). */
export function questionProblems(qs: FormQuestion[]): string[] {
  const out: string[] = []
  qs.forEach((q, i) => {
    if (!q.texto.trim()) out.push(`La pregunta ${i + 1} está vacía.`)
    if (q.tipo === 'opciones' && q.opciones.filter((o) => o.trim()).length < 2) out.push(`La pregunta ${i + 1} necesita al menos 2 opciones.`)
  })
  if (qs.length > MAX_QUESTIONS) out.push(`Se pueden cargar hasta ${MAX_QUESTIONS} preguntas.`)
  return out
}

/** Para guardar: sin espacios de más ni opciones vacías. */
export function cleanQuestions(qs: FormQuestion[]): FormQuestion[] {
  return qs.map((q) => ({
    ...q,
    texto: q.texto.trim().slice(0, MAX_QUESTION_LEN),
    opciones: q.tipo === 'opciones' ? q.opciones.map((o) => o.trim()).filter(Boolean).slice(0, 12) : [],
  }))
}

/** Errores del cliente al enviar, por id de pregunta (`pago` para el día de pago). */
export function answerErrors(qs: FormQuestion[], answers: Record<string, string>, payDay: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const q of qs) if (q.obligatoria && !(answers[q.id] ?? '').trim()) out[q.id] = 'Completá esta pregunta.'
  if (!PAY_DAY_OPTIONS.some((o) => o.value === payDay)) out.pago = 'Elegí qué día del mes vas a pagar.'
  return out
}

/** Lo que se guarda: la pregunta como texto, así no cambia si después el profesional la edita. */
export function buildAnswers(qs: FormQuestion[], answers: Record<string, string>): FormAnswer[] {
  return qs.map((q) => ({ pregunta: q.texto, respuesta: (answers[q.id] ?? '').trim().slice(0, MAX_ANSWER_LEN) }))
}

export function requestFormUrl(token: string): string {
  return `${window.location.origin}/f/${token}`
}

export function requestFormMessage(clientName: string, professionalName: string, token: string): string {
  const first = clientName.trim().split(/\s+/)[0] ?? ''
  return `Hola ${first}! Para arrancar con ${professionalName}, completá este formulario con tus datos (son unos minutos): ${requestFormUrl(token)}`
}
