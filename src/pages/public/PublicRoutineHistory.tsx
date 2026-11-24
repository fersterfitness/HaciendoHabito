import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SharedRoutineHistoryItem } from '@/lib/routine/sharedRoutine'
import { historyLine } from '@/lib/routine/routineHistory'

function day(ymd: string | null): string | null {
  if (!ymd) return null
  const d = new Date(ymd.length === 10 ? ymd + 'T12:00:00' : ymd)
  return Number.isNaN(d.getTime()) ? null : format(d, "d 'de' MMMM yyyy", { locale: es })
}

/**
 * Feedback nov24 (10): las rutinas anteriores del alumno. Cada una se abre en el mismo link con `?rutina=`,
 * solo para ver lo que hizo.
 */
export function RoutineHistoryCard({ token, items }: { token: string; items: SharedRoutineHistoryItem[] }) {
  if (items.length === 0) return null
  return (
    <section className="hhr-card hhr-history" aria-label="Tus rutinas">
      <h2>Tus rutinas anteriores</h2>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <a href={`/rutina/${token}?rutina=${encodeURIComponent(r.id)}`}>
              <b>{r.name.trim() || 'Rutina'}</b>
              <small>{historyLine(r, day)}</small>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
