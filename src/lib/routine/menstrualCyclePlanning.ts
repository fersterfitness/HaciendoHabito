/** Fases para cruzar semanas de rutina con el ciclo menstrual (mensajes para el entrenador). */
export type RoutineMenstrualPhase =
  | 'menstruacion'
  | 'folicular'
  | 'ovulacion'
  | 'lutea'

/** Clave de color semántico por fase (se mapea a clases/strokes en la UI). */
export type CyclePhaseColor = 'red' | 'amber' | 'violet' | 'sky'

export type CyclePhaseInfo = {
  phase: RoutineMenstrualPhase
  label: string
  description: string
  color: CyclePhaseColor
}

export const ROUTINE_CYCLE_PHASE_META: Record<RoutineMenstrualPhase, CyclePhaseInfo> = {
  menstruacion: {
    phase: 'menstruacion',
    label: 'Menstruando',
    description: 'Síntomas como cansancio, menos ganas de entrenar y dolores (puede variar).',
    color: 'red',
  },
  folicular: {
    phase: 'folicular',
    label: 'Fase folicular',
    description: 'Más fuerza, más tolerancia y ganas de entrenar. Predominancia de estrógenos.',
    color: 'amber',
  },
  ovulacion: {
    phase: 'ovulacion',
    label: 'Ovulación',
    description: 'Síntomas de mayor fuerza, ganas de entrenar y mejor tolerancia.',
    color: 'violet',
  },
  lutea: {
    phase: 'lutea',
    label: 'Fase lútea',
    description: 'La fuerza decae, menores ganas de entrenar y presencia de cansancio. Progesterona predominante.',
    color: 'sky',
  },
}

/** Mensaje corto por fase (retrocompat para avisos en texto). */
export const ROUTINE_CYCLE_COACH_MESSAGES: Record<RoutineMenstrualPhase, string> = {
  menstruacion: ROUTINE_CYCLE_PHASE_META.menstruacion.label,
  folicular: ROUTINE_CYCLE_PHASE_META.folicular.label,
  ovulacion: ROUTINE_CYCLE_PHASE_META.ovulacion.label,
  lutea: ROUTINE_CYCLE_PHASE_META.lutea.label,
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
 * Ventanas por día de ciclo:
 *   1–5   menstruación
 *   6–14  folicular
 *   15–19 ovulación
 *   20–28 lútea
 */
export function routinePhaseForCycleDay(day: number, cycleLength: number): RoutineMenstrualPhase | null {
  if (day < 1 || day > cycleLength) return null
  if (day <= 5) return 'menstruacion'
  if (day <= 14) return 'folicular'
  if (day <= 19) return 'ovulacion'
  return 'lutea'
}

/** Fases distintas (con metadata) que abarca un rango de fechas, en orden de aparición. */
export function cyclePhasesForDateRange(
  cycleStartIso: string,
  cycleLength: number,
  rangeStartIso: string,
  rangeEndIso: string,
): CyclePhaseInfo[] {
  const start = parseLocalDate(rangeStartIso)
  const end = parseLocalDate(rangeEndIso)
  if (end < start) return []

  const seen = new Set<RoutineMenstrualPhase>()
  const ordered: CyclePhaseInfo[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = toIsoDate(cursor)
    const day = cycleDayOnDate(cycleStartIso, iso)
    const phase = routinePhaseForCycleDay(day, cycleLength)
    if (phase && !seen.has(phase)) {
      seen.add(phase)
      ordered.push(ROUTINE_CYCLE_PHASE_META[phase])
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return ordered
}

/** Fases (con metadata) que abarca la semana/bloque de la rutina. */
export function cyclePhasesForWeekBlock(
  cycleStartIso: string,
  cycleLength: number,
  blockStartIso: string | null,
  blockEndIso: string | null,
): CyclePhaseInfo[] {
  if (!blockStartIso) return []
  const end = blockEndIso ?? blockStartIso
  return cyclePhasesForDateRange(cycleStartIso, cycleLength, blockStartIso, end)
}

export function coachMessagesForDateRange(
  cycleStartIso: string,
  cycleLength: number,
  rangeStartIso: string,
  rangeEndIso: string,
): string[] {
  return cyclePhasesForDateRange(cycleStartIso, cycleLength, rangeStartIso, rangeEndIso).map(
    (p) => p.label,
  )
}

export function coachMessageForWeekBlock(
  cycleStartIso: string,
  cycleLength: number,
  blockStartIso: string | null,
  blockEndIso: string | null,
): string | null {
  const phases = cyclePhasesForWeekBlock(cycleStartIso, cycleLength, blockStartIso, blockEndIso)
  if (phases.length === 0) return null
  return phases.map((p) => p.label).join(' · ')
}
