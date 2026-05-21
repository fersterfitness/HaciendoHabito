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
import { fatOf, waistOf, weightOf } from '@/lib/nutrition/measurementDerivatives'

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

  const count = data.length
  const pesoPoints = data.filter((d) => d.peso != null).length
  const cinturaPoints = data.filter((d) => d.cintura != null).length
  const grasaPoints = data.filter((d) => d.grasa != null).length
  const hasPeso = pesoPoints > 0
  const hasCintura = cinturaPoints > 0
  const hasGrasa = grasaPoints > 0
  const hasAnySeries = hasPeso || hasCintura || hasGrasa

  if (count === 0) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Guardá una medición en el programa de la izquierda para ver peso, cintura y % grasa acá.
      </p>
    )
  }

  if (!hasAnySeries) {
    return (
      <p className="text-sm text-ink-muted py-2">
        Hay {count === 1 ? 'una medición guardada' : `${count} mediciones guardadas`}, pero sin valores
        para graficar. Completá al menos <strong className="font-medium text-ink-secondary">Peso bruto</strong>{' '}
        (y opcionalmente perímetros o % grasa en modo express) y volvé a guardar.
      </p>
    )
  }

  const needsSecondForTrend =
    (hasPeso && pesoPoints < 2) ||
    (hasCintura && cinturaPoints < 2) ||
    (hasGrasa && grasaPoints < 2)

  return (
    <div className="space-y-6">
      {needsSecondForTrend ? (
        <p className="text-xs text-ink-muted rounded-lg border border-surface-border/80 bg-surface-elevated/30 px-3 py-2">
          {count === 1
            ? 'Primera medición registrada. Con una segunda fecha vas a ver la línea de evolución entre controles.'
            : 'Algunas variables tienen un solo dato: cargá otra medición para ver la tendencia completa.'}
        </p>
      ) : null}

      {hasPeso ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">
            Peso (kg)
            {pesoPoints === 1 ? (
              <span className="ml-2 font-normal text-ink-muted">· 1 control</span>
            ) : null}
          </p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="peso"
                  name="Peso kg"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasCintura ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">
            Cintura mediana (cm)
            {cinturaPoints === 1 ? (
              <span className="ml-2 font-normal text-ink-muted">· 1 control</span>
            ) : null}
          </p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="cintura"
                  name="Cintura cm"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {hasGrasa ? (
        <div>
          <p className="text-xs font-semibold text-ink-secondary mb-2">
            % Grasa (medición manual)
            {grasaPoints === 1 ? (
              <span className="ml-2 font-normal text-ink-muted">· 1 control</span>
            ) : null}
          </p>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-ink-muted" />
                <YAxis tick={{ fontSize: 10 }} className="fill-ink-muted" domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="grasa"
                  name="% grasa"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
