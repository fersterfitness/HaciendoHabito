import type { NutritionOpsPatient } from './nutritionistOps'

/**
 * Inicio del nutricionista: qué consulta viene, a quién recordarle el turno de mañana y a quién
 * mirar (malestar, adherencia, control atrasado, anamnesis sin responder).
 */

export type TodayAppointment = {
  id: string
  student_id: string | null
  starts_at: string
  ends_at: string | null
  status: string
  title: string | null
  full_name: string
  phone: string | null
}

export type SymptomFlag = { id: string; full_name: string; phone: string | null; detail: string; loggedAt: string }

export type NutritionistToday = {
  /** La consulta en curso (empezó hace menos de 45 min) o la próxima de hoy. */
  next: TodayAppointment | null
  nextInProgress: boolean
  /** Las demás de hoy, después de `next`. */
  laterToday: TodayAppointment[]
  /** Turnos de mañana sin confirmar a los que todavía no se les mandó recordatorio. */
  tomorrow: TodayAppointment[]
  symptoms: SymptomFlag[]
  /** Controles atrasados de pacientes que no tienen turno agendado. */
  overdue: NutritionOpsPatient[]
  anamnesis: NutritionOpsPatient[]
}

const IN_PROGRESS_MIN = 45
const SYMPTOM_DAYS = 14

export function buildNutritionistToday(opts: {
  /** Turnos (agendados o confirmados) de hoy y mañana, en cualquier orden. */
  appointments: TodayAppointment[]
  /** Pacientes con algún turno desde ahora en adelante. */
  withFutureAppointment: Set<string>
  checkins: { student_id: string; logged_at: string; digestive_discomfort_0_10: number | null; adherence_1_5: number | null }[]
  patients: { id: string; full_name: string; phone: string | null }[]
  overdueControls: NutritionOpsPatient[]
  pendingAnamnesis: NutritionOpsPatient[]
  /** Turnos a los que ya se les mandó el recordatorio. */
  reminded: Set<string>
  now?: Date
}): NutritionistToday {
  const now = opts.now ?? new Date()
  const todayKey = ymd(now)
  const tomorrowKey = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const sorted = [...opts.appointments].sort((a, b) => a.starts_at.localeCompare(b.starts_at))

  const today = sorted.filter((a) => ymd(new Date(a.starts_at)) === todayKey)
  const pending = today.filter((a) => new Date(a.starts_at).getTime() >= now.getTime() - IN_PROGRESS_MIN * 60_000)
  const next = pending[0] ?? null
  const nextInProgress = next ? new Date(next.starts_at).getTime() <= now.getTime() : false

  // Los que ya confirmaron no necesitan recordatorio.
  const tomorrow = sorted.filter((a) => ymd(new Date(a.starts_at)) === tomorrowKey && a.status !== 'confirmed' && !opts.reminded.has(a.id))

  const known = new Map(opts.patients.map((p) => [p.id, p]))
  const latest = new Map<string, (typeof opts.checkins)[number]>()
  for (const c of opts.checkins) {
    const prev = latest.get(c.student_id)
    if (!prev || c.logged_at > prev.logged_at) latest.set(c.student_id, c)
  }
  const since = now.getTime() - SYMPTOM_DAYS * 86_400_000
  const symptoms: SymptomFlag[] = []
  for (const [id, c] of latest) {
    const p = known.get(id)
    if (!p || new Date(c.logged_at).getTime() < since) continue
    const parts: string[] = []
    if (c.digestive_discomfort_0_10 != null && c.digestive_discomfort_0_10 >= 7) parts.push(`malestar ${c.digestive_discomfort_0_10}/10`)
    if (c.adherence_1_5 != null && c.adherence_1_5 <= 2) parts.push(`adherencia ${c.adherence_1_5}/5`)
    if (!parts.length) continue
    const detail = parts.join(' · ')
    symptoms.push({ id, full_name: p.full_name, phone: p.phone, detail: detail.charAt(0).toUpperCase() + detail.slice(1), loggedAt: c.logged_at })
  }
  symptoms.sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))

  return {
    next,
    nextInProgress,
    laterToday: next ? pending.slice(1) : [],
    tomorrow,
    symptoms,
    overdue: opts.overdueControls.filter((p) => !opts.withFutureAppointment.has(p.id)),
    anamnesis: opts.pendingAnamnesis,
  }
}

/** «en 25 min», «en 1 h 10 min», «empezó hace 5 min». */
export function startsInText(startsAt: string, now: Date): string {
  const min = Math.round((new Date(startsAt).getTime() - now.getTime()) / 60_000)
  if (min <= 0) return min === 0 ? 'empieza ahora' : `empezó hace ${-min} min`
  if (min < 60) return `en ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `en ${h} h ${m} min` : `en ${h} h`
}

/** Recordatorio del turno de mañana, sin emojis (WhatsApp escritorio los rompe en el link). */
export function tomorrowReminderMessage(fullName: string, startsAt: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? ''
  const d = new Date(startsAt)
  const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `Hola ${first}, te recuerdo tu consulta de mañana a las ${hhmm}. ¿Me confirmás si venís? Gracias.`
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
