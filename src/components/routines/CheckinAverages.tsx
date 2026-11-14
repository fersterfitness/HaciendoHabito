import { useContext } from 'react'
import { CHECKIN_SCALES, TrainingExtrasContext } from '@/lib/routine/studentTrainingLog'
import { checkinAverages } from '@/lib/routine/studentAppExtras'
import { cn } from '@/lib/utils'

const num = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')

/**
 * Promedios de lo que el alumno respondió antes de entrenar (sueño, energía, estrés, molestias, de 1 a 5)
 * y del esfuerzo de las sesiones, para un grupo de días: una semana o la rutina entera.
 * Sin registros del alumno no se muestra.
 */
export function CheckinAverages({ dayIds, label, className }: { dayIds: string[]; label: string; className?: string }) {
  const extras = useContext(TrainingExtrasContext)
  if (!extras) return null
  const a = checkinAverages(dayIds, extras)
  if (!a.withData) return null
  const scales = CHECKIN_SCALES.filter((s) => a.averages[s.key] != null)
  return (
    <div className={cn('rounded-lg bg-surface-card px-2.5 py-2 text-2xs text-ink-secondary', className)}>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold text-ink-primary">{label}</span>
        <span className="tabular-nums">
          {a.done}/{a.total} {a.total === 1 ? 'día terminado' : 'días terminados'}
          {a.missed ? ` · ${a.missed} sin entrenar` : ''}
        </span>
        {scales.map((s) => (
          <span key={s.key} className="tabular-nums" title={`${s.label} Promedio de ${a.checkins} ${a.checkins === 1 ? 'día' : 'días'} (1 = ${s.low.toLowerCase()}, 5 = ${s.high.toLowerCase()})`}>
            {s.short} <span className="font-semibold text-ink-primary">{num(a.averages[s.key]!)}</span>
          </span>
        ))}
        {a.effort != null ? (
          <span className="tabular-nums" title="Esfuerzo promedio de las sesiones (escala de Borg, 1 a 10)">
            Esfuerzo <span className="font-semibold text-ink-primary">{num(a.effort)}</span>/10
          </span>
        ) : null}
      </p>
    </div>
  )
}
