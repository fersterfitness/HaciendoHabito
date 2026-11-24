import type { SharedRoutineHistoryItem } from '@/lib/routine/sharedRoutine'

/** «Del 3 de octubre 2026 al 30 de octubre 2026 · 12 días entrenados». `days_done` < 0 = no se sabe. */
export function historyLine(r: SharedRoutineHistoryItem, day: (ymd: string | null) => string | null): string {
  const from = day(r.start_date)
  const to = day(r.end_date)
  const when = from && to ? `Del ${from} al ${to}` : from ? `Desde el ${from}` : ''
  const done = r.days_done < 0 ? '' : r.days_done === 0 ? 'Sin días entrenados' : `${r.days_done} ${r.days_done === 1 ? 'día entrenado' : 'días entrenados'}`
  return [when, done].filter(Boolean).join(' · ')
}
