/**
 * «Necesitan atención» de la lista de pacientes: a quién hay que mirar hoy y por qué.
 * Cada paciente aparece una sola vez, en el grupo más urgente; el resto de los motivos van como detalle.
 */

export type AttentionKind = 'hoy' | 'sintomas' | 'pago' | 'control'

export type AttentionItem = { id: string; full_name: string; kind: AttentionKind; detail: string; extra: string[] }

export const ATTENTION_GROUPS: { kind: AttentionKind; title: string }[] = [
  { kind: 'hoy', title: 'Consulta hoy' },
  { kind: 'sintomas', title: 'Malestar o baja adherencia' },
  { kind: 'pago', title: 'Cobro vencido' },
  { kind: 'control', title: 'Control atrasado, sin turno' },
]

const DAY = 86_400_000

export function buildAttention(opts: {
  patients: { id: string; full_name: string; lastControlDate: string | null }[]
  /** Turnos agendados desde hoy (no cancelados). */
  appointments: { student_id: string; starts_at: string }[]
  /** Registros de síntomas recientes, de cualquier orden. */
  checkins: { student_id: string; logged_at: string; digestive_discomfort_0_10: number | null; adherence_1_5: number | null }[]
  overduePayments: Set<string>
  overdueControlDays: number
  now?: Date
}): AttentionItem[] {
  const now = opts.now ?? new Date()
  const todayKey = ymd(now)
  const reasons = new Map<string, { kind: AttentionKind; text: string }[]>()
  const add = (id: string, kind: AttentionKind, text: string) => {
    const list = reasons.get(id) ?? []
    list.push({ kind, text })
    reasons.set(id, list)
  }
  const known = new Set(opts.patients.map((p) => p.id))

  const hasAppointment = new Set<string>()
  for (const a of [...opts.appointments].sort((x, y) => x.starts_at.localeCompare(y.starts_at))) {
    if (!known.has(a.student_id)) continue
    const d = new Date(a.starts_at)
    if (d.getTime() < now.getTime() - 3 * 3_600_000) continue
    hasAppointment.add(a.student_id)
    if (ymd(d) === todayKey && !reasons.get(a.student_id)?.some((r) => r.kind === 'hoy')) {
      add(a.student_id, 'hoy', `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} h`)
    }
  }

  const lastCheckin = new Map<string, (typeof opts.checkins)[number]>()
  for (const c of opts.checkins) {
    const prev = lastCheckin.get(c.student_id)
    if (!prev || c.logged_at > prev.logged_at) lastCheckin.set(c.student_id, c)
  }
  for (const [id, c] of lastCheckin) {
    if (!known.has(id)) continue
    const parts: string[] = []
    if (c.digestive_discomfort_0_10 != null && c.digestive_discomfort_0_10 >= 7) parts.push(`malestar ${c.digestive_discomfort_0_10}/10`)
    if (c.adherence_1_5 != null && c.adherence_1_5 <= 2) parts.push(`adherencia ${c.adherence_1_5}/5`)
    if (parts.length) add(id, 'sintomas', capitalize(parts.join(' · ')))
  }

  for (const id of opts.overduePayments) if (known.has(id)) add(id, 'pago', 'Cuota del mes sin pagar')

  for (const p of opts.patients) {
    if (!p.lastControlDate || hasAppointment.has(p.id)) continue
    const days = Math.floor((now.getTime() - new Date(p.lastControlDate).getTime()) / DAY)
    if (days > opts.overdueControlDays) add(p.id, 'control', `Último control hace ${Math.round(days / 7)} semanas`)
  }

  const order = ATTENTION_GROUPS.map((g) => g.kind)
  const names = new Map(opts.patients.map((p) => [p.id, p.full_name]))
  return [...reasons.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
      const main = sorted[0]!
      return { id, full_name: names.get(id) ?? 'Paciente', kind: main.kind, detail: main.text, extra: sorted.slice(1).map((r) => r.text) }
    })
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.kind === 'hoy' ? a.detail.localeCompare(b.detail) : a.full_name.localeCompare(b.full_name)))
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
