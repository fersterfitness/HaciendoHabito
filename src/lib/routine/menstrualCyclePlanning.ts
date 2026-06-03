/** Fases para cruzar semanas de rutina con el ciclo menstrual (mensajes para el entrenador). */
export type RoutineMenstrualPhase =
  | 'menstruacion'
  | 'folicular'
  | 'ovulacion'
  | 'lutea_temprana'
  | 'lutea_tardia'

export const ROUTINE_CYCLE_COACH_MESSAGES: Record<RoutineMenstrualPhase, string> = {
  menstruacion: 'Semana Menstruando',
  folicular: 'En etapa folicular, + fuerza',
  ovulacion: 'Etapa de ovulación, + Fuerza',
  lutea_temprana: 'Etapa lútea, cansancio + presente',
  lutea_tardia: 'Etapa lútea, mayor cansancio',
}

function parseLocalDate(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T12:00:00')
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Día 1 = primer día de menstruación registrado. */
export function cycleDayOnDate(cycleStartIso: string, dateIso: string): number {
  const start = parseLocalDate(cycleStartIso)
  const d = parseLocalDate(dateIso)
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000) + 1
}

/**
 * Ventanas aproximadas respecto al inicio del ciclo (como pediste: 1–7, 7–14, día 14, 14–21, 21–28).
 * El día 7 puede figurar en menstruación; el 14 en ovulación.
 */
export function routinePhaseForCycleDay(day: number, cycleLength: number): RoutineMenstrualPhase | null {
  if (day < 1 || day > cycleLength) return null
  if (day <= 7) return 'menstruacion'
  if (day < 14) return 'folicular'
  if (day === 14) return 'ovulacion'
  if (day <= 21) return 'lutea_temprana'
  return 'lutea_tardia'
}

export function coachMessagesForDateRange(
  cycleStartIso: string,
  cycleLength: number,
  rangeStartIso: string,
  rangeEndIso: string,
): string[] {
  const start = parseLocalDate(rangeStartIso)
  const end = parseLocalDate(rangeEndIso)
  if (end < start) return []

  const seen = new Set<RoutineMenstrualPhase>()
  const ordered: RoutineMenstrualPhase[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = toIsoDate(cursor)
    const day = cycleDayOnDate(cycleStartIso, iso)
    const phase = routinePhaseForCycleDay(day, cycleLength)
    if (phase && !seen.has(phase)) {
      seen.add(phase)
      ordered.push(phase)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return ordered.map((p) => ROUTINE_CYCLE_COACH_MESSAGES[p])
}

export function coachMessageForWeekBlock(
  cycleStartIso: string,
  cycleLength: number,
  blockStartIso: string | null,
  blockEndIso: string | null,
): string | null {
  if (!blockStartIso) return null
  const end = blockEndIso ?? blockStartIso
  const lines = coachMessagesForDateRange(cycleStartIso, cycleLength, blockStartIso, end)
  if (lines.length === 0) return null
  return lines.join(' · ')
}
