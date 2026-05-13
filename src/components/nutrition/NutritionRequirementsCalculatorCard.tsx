import { useMemo, useState } from 'react'
import type { Student } from '@/types/database'
import {
  ACTIVITY_FACTOR_LABELS,
  ageFromBirthDateIso,
  mifflinStJeorKcal,
  tdeeKcal,
  type ActivityFactorKey,
} from '@/lib/nutrition/energyRequirements'

export function NutritionRequirementsCalculatorCard({ student }: { student: Student }) {
  const [activity, setActivity] = useState<ActivityFactorKey>('moderate')
  const [weightOverride, setWeightOverride] = useState('')

  const age = useMemo(() => ageFromBirthDateIso(student.birth_date), [student.birth_date])
  const w =
    weightOverride.trim() !== ''
      ? Number(weightOverride.replace(',', '.'))
      : student.weight_kg ?? null
  const h = student.height_cm ?? null

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
      <p className="text-[11px] text-ink-muted leading-relaxed">
        Usa fecha de nacimiento, sexo y talla del paciente en la ficha. El peso toma el de la ficha salvo que lo sobrescribas abajo.
      </p>
      <label className="text-[11px] text-ink-secondary block">
        Peso para cálculo (kg), opcional
        <input
          value={weightOverride}
          onChange={(e) => setWeightOverride(e.target.value)}
          placeholder={student.weight_kg != null ? `Ficha: ${student.weight_kg}` : 'Ej. 72.5'}
          className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
        />
      </label>
      <label className="text-[11px] text-ink-secondary block">
        Nivel de actividad
        <select
          value={activity}
          onChange={(e) => setActivity(e.target.value as ActivityFactorKey)}
          className="mt-1 w-full rounded-xl border border-surface-inputBorder bg-surface-input px-2 py-2 text-sm"
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
      <p className="text-[10px] text-ink-muted leading-snug">
        Referencia orientativa; el profesional ajusta según composición corporal, objetivo y contexto clínico.
      </p>
    </div>
  )
}
