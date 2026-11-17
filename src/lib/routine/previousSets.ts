import { exerciseNoteKey } from './studentTrainingLog'

export type SetMark = { kg: number | null; reps: number | null; completed: boolean }

type Block = { days: { exercises: { id: string; name: string | null }[] }[] }

/**
 * «Anterior» de la tabla de series: para cada ejercicio, lo que anotó la última vez que hizo ese mismo ejercicio
 * (mismo nombre) en un día anterior de la rutina. Solo cuenta si anotó kilos o reps.
 */
export function previousSetsByExercise(blocks: Block[], logged: Record<string, Record<number, SetMark>>): Record<string, Record<number, SetMark>> {
  const last = new Map<string, Record<number, SetMark>>()
  const out: Record<string, Record<number, SetMark>> = {}
  for (const b of blocks)
    for (const d of b.days)
      for (const ex of d.exercises) {
        const key = exerciseNoteKey(ex.name)
        if (!key) continue
        const prev = last.get(key)
        if (prev) out[ex.id] = prev
        const own = logged[ex.id] ?? {}
        if (Object.values(own).some((s) => s.kg != null || s.reps != null)) last.set(key, own)
      }
  return out
}

/** «60 kg × 8», «60 kg», «× 8» o vacío. */
export function previousLabel(s: SetMark | undefined): string {
  if (!s || (s.kg == null && s.reps == null)) return ''
  const kg = s.kg != null ? `${String(s.kg).replace('.', ',')} kg` : ''
  const reps = s.reps != null ? `× ${s.reps}` : ''
  return [kg, reps].filter(Boolean).join(' ')
}

/** Cuenta regresiva: «1:30». */
export function clockLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
