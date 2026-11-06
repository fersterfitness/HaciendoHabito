import { cn } from '@/lib/utils'
import { controlMdClassName } from '@/lib/formControlClasses'
import { useMemo, useState } from 'react'
import type { NutritionMeasurement, Student } from '@/types/database'
import { heightOf, weightOf } from '@/lib/nutrition/measurementDerivatives'
import {
  ACTIVITY_FACTOR_LABELS,
  ageFromBirthDateIso,
  mifflinStJeorKcal,
  tdeeKcal,
  type ActivityFactorKey,
} from '@/lib/nutrition/energyRequirements'

/** `latest`: último control antropométrico; si viene, peso y talla salen de ahí y no de la ficha. */
export function NutritionRequirementsCalculatorCard({ student, latest = null }: { student: Student; latest?: NutritionMeasurement | null }) {
  const [activity, setActivity] = useState<ActivityFactorKey>('moderate')
  const [weightOverride, setWeightOverride] = useState('')

  const age = useMemo(() => ageFromBirthDateIso(student.birth_date), [student.birth_date])
  const baseWeight = (latest ? weightOf(latest) : null) ?? student.weight_kg ?? null
  const latestHeight = latest ? heightOf(latest) : null
  const w = weightOverride.trim() !== '' ? Number(weightOverride.replace(',', '.')) : baseWeight
  const h = latestHeight ?? student.height_cm ?? null
  const source = latest ? 'del último control' : 'de la ficha'

  const bmr = mifflinStJeorKcal({
    sex: student.gender,
    ageYears: age,
    weightKg: Number.isFinite(w as number) ? (w as number) : null,
    heightCm: h,
  })
  const tdee = tdeeKcal(bmr, activity)

  return (
    <div className="rounded-xl border border-surface-border bg-surface-elevated/40 p-4 space-y-3">
      <p className="text-sm font-semibold text-ink-primary">Calculadora energética (Mifflin–St Jeor)</p>
      <p className="text-2xs text-ink-muted leading-relaxed">
        Usa edad y sexo de la ficha, y peso y talla {source}. El peso se puede cambiar abajo.
      </p>
      <label className="text-2xs text-ink-secondary block">
        Peso para cálculo (kg), opcional
        <input
          value={weightOverride}
          onChange={(e) => setWeightOverride(e.target.value)}
          placeholder={baseWeight != null ? `${latest ? 'Último control' : 'Ficha'}: ${baseWeight}` : 'Ej. 72.5'}
          className={cn(controlMdClassName, 'mt-1 w-full px-2')}
        />
      </label>
      <label className="text-2xs text-ink-secondary block">
        Nivel de actividad
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityFactorKey)}
          className={cn(controlMdClassName, 'mt-1 w-full px-2 cursor-pointer')}
        >
          {(Object.keys(ACTIVITY_FACTOR_LABELS) as ActivityFactorKey[]).map((k) => (
            <option key={k} value={k}>
              {ACTIVITY_FACTOR_LABELS[k].label} (×{ACTIVITY_FACTOR_LABELS[k].factor})
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-lg bg-surface-card/80 border border-surface-border px-3 py-2 text-sm space-y-1">
        <p className="text-ink-secondary">
          Edad estimada: <span className="font-medium text-ink-primary">{age ?? '—'} años</span>
        </p>
        <p className="text-ink-secondary">
          GET (basal):{' '}
          <span className="font-medium text-ink-primary">{bmr != null ? `${bmr} kcal/día` : 'Completá peso y talla en ficha'}</span>
        </p>
        <p className="text-ink-secondary">
          TDEE aprox.: <span className="font-medium text-brand-primary">{tdee != null ? `${tdee} kcal/día` : '—'}</span>
        </p>
      </div>
      <p className="text-3xs text-ink-muted leading-snug">
        Referencia orientativa; el profesional ajusta según composición corporal, objetivo y contexto clínico.
      </p>
    </div>
  )
}
