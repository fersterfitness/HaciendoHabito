import { CHECKIN_SCALES } from '@/lib/routine/studentTrainingLog'
import { HIGH_EFFORT, checkinFlags, type MonitorRow } from '@/lib/routine/trainingMonitor'

/**
 * Avisos del monitor de entrenamiento: qué pasó de nuevo entre dos lecturas del monitor. Se compara
 * siempre contra la lectura anterior, así que la primera carga no avisa nada (no se repite lo que ya
 * estaba al abrir la app).
 */

export type MonitorAlertKind = 'started' | 'finished' | 'missed' | 'below' | 'effort' | 'checkin'

export interface MonitorAlert {
  /** Clave estable: el mismo hecho no se avisa dos veces. */
  key: string
  kind: MonitorAlertKind
  routineId: string
  studentName: string
  avatarPath: string | null
  title: string
  detail: string
  /** Los que piden mirar algo (cargas bajas, Borg alto, molestias, faltas) van con más peso. */
  important: boolean
}

const fmtKg = (n: number) => `${Number(n.toFixed(1)).toLocaleString('es-AR')} kg`
const first = (full: string) => full.trim().split(/\s+/)[0] ?? full

/** Claves de los hechos que ya están a la vista en una lectura: sirven de punto de partida. */
export function alertKeys(rows: MonitorRow[], now = new Date()): Set<string> {
  return new Set(rawAlerts(rows, now).map((a) => a.key))
}

/**
 * Lo nuevo de `next` que no estaba en `seen` (las claves de lo ya avisado o visto). Devuelve los avisos
 * en orden de importancia: primero lo que pide mirar algo.
 */
export function newMonitorAlerts(next: MonitorRow[], seen: Set<string>, now = new Date()): MonitorAlert[] {
  return rawAlerts(next, now)
    .filter((a) => !seen.has(a.key))
    .sort((a, b) => Number(b.important) - Number(a.important))
}

function rawAlerts(rows: MonitorRow[], now: Date): MonitorAlert[] {
  const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  const out: MonitorAlert[] = []
  for (const r of rows) {
    const base = { routineId: r.routineId, studentName: r.studentName, avatarPath: r.avatarPath }
    const name = first(r.studentName)
    if (r.startedAt) {
      out.push({ ...base, key: `${day}:started:${r.routineId}:${r.dayLabel}`, kind: 'started', title: `${name} empezó a entrenar`, detail: r.dayLabel, important: false })
    }
    if (r.closed) {
      out.push({
        ...base,
        key: `${day}:finished:${r.routineId}:${r.dayLabel}`,
        kind: 'finished',
        title: `${name} terminó el día`,
        detail: [r.dayLabel, r.pct != null ? `${r.pct} %` : '', r.dayEffort != null ? `esfuerzo ${r.dayEffort}/10` : ''].filter(Boolean).join(' · '),
        important: r.state === 'deviated',
      })
    }
    if (r.state === 'missed') {
      out.push({ ...base, key: `${day}:missed:${r.routineId}:${r.dayLabel}`, kind: 'missed', title: `${name} avisó que hoy no entrena`, detail: r.detail, important: true })
    }
    for (const e of r.exercises ?? []) {
      if (e.setsDone > 0 && e.plannedKg != null && e.weightKg != null && e.weightKg < e.plannedKg) {
        out.push({
          ...base,
          key: `${day}:below:${e.exerciseId}:${e.setsDone}`,
          kind: 'below',
          title: `${name} levantó menos de lo planificado`,
          detail: `${e.name}: ${fmtKg(e.weightKg)}${e.reps != null ? ` × ${e.reps}` : ''} (planificado ${fmtKg(e.plannedKg)})`,
          important: true,
        })
      }
      if (e.effort != null && e.effort >= HIGH_EFFORT) {
        out.push({
          ...base,
          key: `${day}:effort:${e.exerciseId}:${e.effort}`,
          kind: 'effort',
          title: `${name} marcó Borg ${e.effort} en ${e.name}`,
          detail: e.note || 'Esfuerzo muy alto',
          important: true,
        })
      }
    }
    if (r.checkin) {
      const flags = checkinFlags(r.checkin)
      if (flags.length) {
        const text = CHECKIN_SCALES.filter((s) => flags.includes(s.key))
          .map((s) => `${s.short.toLowerCase()} ${r.checkin![s.key]}/5`)
          .join(', ')
        out.push({
          ...base,
          key: `${day}:checkin:${r.routineId}:${r.dayLabel}`,
          kind: 'checkin',
          title: `${name} llegó con ${text}`,
          detail: r.checkin.note || r.dayLabel,
          important: true,
        })
      }
    }
  }
  return out
}
