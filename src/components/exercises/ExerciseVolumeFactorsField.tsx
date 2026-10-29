import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { controlSmClassName } from '@/lib/formControlClasses'
import { VOLUME_MUSCLES, type MuscleFactors } from '@/lib/volume/trainingVolume'
import { factorsToDraft, type FactorsDraft } from '@/lib/volume/factorsDraft'

/**
 * Cuánto trabaja cada músculo en este ejercicio, para el contador de volumen de las rutinas.
 * 1 = músculo objetivo, 0,5 = sinérgico, vacío = no participa.
 */
export function ExerciseVolumeFactorsField({
  value,
  onChange,
  suggested,
  isSuggestion,
}: {
  value: FactorsDraft
  onChange: (next: FactorsDraft) => void
  suggested: MuscleFactors
  /** true = los valores mostrados son la sugerencia automática (todavía no guardados). */
  isSuggestion: boolean
}) {
  const hasSuggestion = Object.keys(suggested).length > 0
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-ink-muted">
        Cuánto participa cada músculo en una serie de este ejercicio. <b className="text-ink-secondary">1</b> = músculo objetivo,{' '}
        <b className="text-ink-secondary">0,5</b> = sinérgico, vacío = no participa. Lo usa el contador de volumen de todas tus rutinas.
      </p>
      {isSuggestion && hasSuggestion ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-brand-primary/10 px-2.5 py-1.5 text-2xs font-medium text-brand-primary">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Valores sugeridos por el nombre del ejercicio. Ajustalos y guardá para que queden como tuyos.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {VOLUME_MUSCLES.map((m) => {
          const v = value[m.id] ?? ''
          const active = Number(String(v).replace(',', '.')) > 0
          return (
            <label
              key={m.id}
              className={cn(
                'flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 transition-colors',
                active ? 'border-brand-primary/40 bg-brand-primary/5' : 'border-surface-border/80',
              )}
            >
              <span className={cn('text-xs', active ? 'font-semibold text-ink-primary' : 'text-ink-secondary')}>{m.label}</span>
              <input
                inputMode="decimal"
                value={v}
                onChange={(e) => onChange({ ...value, [m.id]: e.target.value })}
                placeholder="–"
                aria-label={`Implicación de ${m.label}`}
                className={cn(controlSmClassName, 'h-7 w-14 text-center')}
              />
            </label>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 0.5].map((n) => (
          <span key={n} className="text-3xs text-ink-muted">
            {n === 1 ? 'Objetivo = 1' : 'Sinérgico ≈ 0,5'}
          </span>
        ))}
        {hasSuggestion ? (
          <button
            type="button"
            onClick={() => onChange(factorsToDraft(suggested))}
            className="ml-auto text-2xs font-medium text-brand-primary hover:text-brand-primary/80"
          >
            Usar sugerido
          </button>
        ) : null}
        <button type="button" onClick={() => onChange({})} className="text-2xs font-medium text-ink-muted hover:text-ink-primary">
          Vaciar
        </button>
      </div>
    </div>
  )
}
