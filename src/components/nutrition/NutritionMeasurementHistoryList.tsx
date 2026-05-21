import { format, parseISO } from 'date-fns'
import { Activity, ChevronRight } from 'lucide-react'
import type { NutritionMeasurement } from '@/types/database'
import { mergedMediansForPresentation } from '@/lib/nutrition/anthropometryPresentation'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import { cn } from '@/lib/utils'

function hasProgramData(m: NutritionMeasurement): boolean {
  const med = mergedMediansForPresentation(m)
  return Object.values(med).some((v) => v != null && Number.isFinite(v as number))
}

export function NutritionMeasurementHistoryList({
  measurements,
  selectedId,
  onSelect,
}: {
  measurements: NutritionMeasurement[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (measurements.length === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Todavía no hay controles guardados. Usá el programa de arriba o la medición rápida.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-ink-muted">
        {measurements.length === 1
          ? '1 control guardado. El informe de abajo corresponde a esta medición.'
          : `${measurements.length} controles guardados. Elegí cuál ver en el informe «Presentación».`}
      </p>
      <ul className="space-y-1.5" role="list">
        {measurements.map((m, index) => {
          const active = m.id === selectedId
          const weight = weightOf(m)
          const program = hasProgramData(m)
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-brand-primary/50 bg-brand-primary/10'
                    : 'border-surface-border bg-surface-elevated/40 hover:bg-surface-elevated/70',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums',
                    active ? 'bg-brand-primary/20 text-brand-primary' : 'bg-surface-card text-ink-muted',
                  )}
                >
                  {m.measurement_number ?? measurements.length - index}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-primary">
                    {format(parseISO(m.measured_at), 'dd/MM/yyyy')}
                    {m.measurement_number != null ? ` · N° ${m.measurement_number}` : ''}
                  </span>
                  <span className="block text-xs text-ink-muted mt-0.5">
                    {program ? 'Programa Holway' : 'Medición rápida'}
                    {weight != null ? ` · ${weight} kg` : ''}
                    {m.height_cm != null ? ` · ${m.height_cm} cm` : ''}
                  </span>
                </span>
                <ChevronRight
                  className={cn('h-4 w-4 shrink-0', active ? 'text-brand-primary' : 'text-ink-muted')}
                  aria-hidden
                />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function NutritionMeasurementHistoryListTitle() {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
        <Activity className="h-4 w-4" aria-hidden />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Historial de controles</h3>
        <p className="text-xs text-ink-muted">Todas las antropometrías guardadas de este paciente</p>
      </div>
    </div>
  )
}
