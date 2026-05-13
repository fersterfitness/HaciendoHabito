import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { NutritionMeasurement } from '@/types/database'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'

function medians(m: NutritionMeasurement) {
  const d = m.detail as AnthropometryDetail | null
  return d?.medians ?? null
}

function weightOf(m: NutritionMeasurement): number | null {
  return m.weight_kg ?? medians(m)?.peso_bruto_kg ?? null
}

function waistOf(m: NutritionMeasurement): number | null {
  return medians(m)?.cintura_min_cm ?? null
}

function fatOf(m: NutritionMeasurement): number | null {
  return m.body_fat_pct ?? null
}

export function NutritionMeasurementCharts({ measurements }: { measurements: NutritionMeasurement[] }) {
  const data = useMemo(() => {
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    )
    return sorted.map((m) => ({
      label: format(parseISO(m.measured_at), 'dd/MM/yy'),
      peso: weightOf(m),
      cintura: waistOf(m),
      grasa: fatOf(m),
    }))
  }, [measurements])

  const hasPeso = data.some((d) => d.peso != null)
  const hasCintura = data.some((d) => d.cintura != null)
  const hasGrasa = data.some((d) => d.grasa != null)

  if (data.length < 2 || (!hasPeso && !hasCintura && !hasGrasa)) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Cargá al menos dos mediciones con peso (o talla/peso en el programa) para ver tendencias.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      {hasPeso ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">Peso (kg)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="peso" name="Peso kg" stroke="#16a34a" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasCintura ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">Cintura mediana (cm)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="cintura" name="Cintura cm" stroke="#0ea5e9" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasGrasa ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">% Grasa (medición manual)</p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="grasa" name="% grasa" stroke="#a855f7" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
