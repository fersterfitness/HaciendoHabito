/**
 * Avance del alumno en su rutina (feedback nov19): la semana en curso sale de lo que fue haciendo, no de las
 * fechas del bloque. Las semanas funcionan como niveles: se desbloquean al cerrar la anterior.
 */
type Day = { id: string; exercises: { id: string }[] }
type Block = { days: Day[] }
type DayStatus = 'done' | 'missed' | null | undefined

export type ProgressInput = {
  /** «Terminé» o «No pude entrenar» de cada día. */
  statusOf: (dayId: string) => DayStatus
  /** Si el día tiene alguna serie tildada. */
  hasSets: (day: Day) => boolean
}

const trainable = (b: Block) => b.days.filter((d) => d.exercises.length > 0)
const closed = (d: Day, x: ProgressInput) => !!x.statusOf(d.id)

/**
 * Semana en curso: la última con actividad (días cerrados o series tildadas). Si esa semana ya está toda
 * cerrada, pasa a la siguiente. Sin actividad, la primera.
 */
export function progressWeekIndex(blocks: Block[], x: ProgressInput): number {
  if (blocks.length === 0) return 0
  const last = lastActiveWeekIndex(blocks, x)
  if (last < 0) return 0
  const days = trainable(blocks[last]!)
  const allClosed = days.length > 0 && days.every((d) => closed(d, x))
  return allClosed ? Math.min(last + 1, blocks.length - 1) : last
}

/** Última semana con actividad (días cerrados o series tildadas); -1 si todavía no hizo nada. */
export function lastActiveWeekIndex(blocks: Block[], x: ProgressInput): number {
  let last = -1
  blocks.forEach((b, i) => {
    if (trainable(b).some((d) => closed(d, x) || x.hasSets(d))) last = i
  })
  return last
}

/**
 * Día al que entra: primero, el que dejó con series hechas sin tocar «Terminé» (para cerrarlo); si no,
 * el primer día sin cerrar de la semana en curso.
 */
export function startDayIndex(blocks: Block[], week: number, x: ProgressInput): number {
  const days = blocks[week]?.days ?? []
  const pending = days.findIndex((d) => d.exercises.length > 0 && !closed(d, x) && x.hasSets(d))
  if (pending >= 0) return pending
  const open = days.findIndex((d) => d.exercises.length > 0 && !closed(d, x))
  return open >= 0 ? open : 0
}
