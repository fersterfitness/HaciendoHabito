import { type ReactNode, useMemo } from 'react'
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Flame,
  Ruler,
  Scale,
  Upload,
  Utensils,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChartSizedContainer } from '@/components/charts/ChartSizedContainer'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NutritionResumenKpi } from './NutritionResumenKpi'
import {
  fatOf,
  muscleOf,
  waistOf,
  weightOf,
} from '@/lib/nutrition/measurementDerivatives'
import type { NutritionMeasurement, NutritionPatientFollowup, Student } from '@/types/database'
import { differenceInYears } from 'date-fns'

interface Props {
  student?: Student | null
  measurements: NutritionMeasurement[]
  followup: NutritionPatientFollowup | null
  onGoToTab: (tabId: string) => void
  onManageAppointments: () => void
}

function ageFromBirth(birth: string | null | undefined): number | null {
  if (!birth) return null
  try {
    const years = differenceInYears(new Date(), new Date(birth))
    return Number.isFinite(years) && years >= 0 && years < 130 ? years : null
  } catch { return null }
}

function bmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (!weightKg || !heightCm) return null
  const h = heightCm / 100
  if (h <= 0) return null
  return Math.round((weightKg / (h * h)) * 10) / 10
}

const SPARK_SIZE = 6

export function NutritionResumenDashboard({
  student,
  measurements,
  followup,
  onGoToTab,
  onManageAppointments,
}: Props) {
  const regWeight = student?.weight_kg ?? null
  const regHeight = student?.height_cm ?? null
  const regAge = ageFromBirth(student?.birth_date ?? null)
  const regBmi = bmi(regWeight, regHeight)
  const hasRegistrationData = regWeight != null || regHeight != null || regAge != null

  /** Oldest-first, for time-series. */
  const ordered = useMemo(
    () =>
      [...measurements].sort(
        (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
      ),
    [measurements],
  )

  const latest = ordered[ordered.length - 1]
  const previous = ordered[ordered.length - 2]

  const weightSeries = useMemo(
    () => ordered.slice(-SPARK_SIZE).map((m) => weightOf(m)),
    [ordered],
  )
  const fatSeries = useMemo(
    () => ordered.slice(-SPARK_SIZE).map((m) => fatOf(m)),
    [ordered],
  )
  const muscleSeries = useMemo(
    () => ordered.slice(-SPARK_SIZE).map((m) => muscleOf(m)),
    [ordered],
  )
  const waistSeries = useMemo(
    () => ordered.slice(-SPARK_SIZE).map((m) => waistOf(m)),
    [ordered],
  )

  const heroData = useMemo(() => {
    return ordered.map((m) => {
      const w = weightOf(m)
      return {
        label: format(parseISO(m.measured_at), 'dd/MM/yy'),
        peso: w,
      }
    })
  }, [ordered])

  const heroPesoPoints = heroData.filter((d) => d.peso != null).length
  const heroHasData = heroPesoPoints >= 1
  const heroHasTrend = heroPesoPoints >= 2

  return (
    <div className="space-y-6">
      <NextConsultationBanner
        followup={followup}
        onManageAppointments={onManageAppointments}
      />

      {hasRegistrationData ? (
        <Card padding="md">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-ink-secondary" />
              Datos del registro
            </CardTitle>
            {measurements.length === 0 ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => onGoToTab('antropometria')}>
                Cargar primera medición
              </Button>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {regWeight != null ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Peso inicial</dt>
                <dd className="text-base font-semibold text-ink-primary">{regWeight} <span className="text-xs font-normal text-ink-muted">kg</span></dd>
              </div>
            ) : null}
            {regHeight != null ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Altura</dt>
                <dd className="text-base font-semibold text-ink-primary">{regHeight} <span className="text-xs font-normal text-ink-muted">cm</span></dd>
              </div>
            ) : null}
            {regBmi != null ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">IMC</dt>
                <dd className="text-base font-semibold text-ink-primary">{regBmi}</dd>
              </div>
            ) : null}
            {regAge != null ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Edad</dt>
                <dd className="text-base font-semibold text-ink-primary">{regAge} <span className="text-xs font-normal text-ink-muted">años</span></dd>
              </div>
            ) : null}
            {student?.gender ? (
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Género</dt>
                <dd className="text-base font-semibold text-ink-primary">{student.gender === 'M' ? 'Masculino' : student.gender === 'F' ? 'Femenino' : 'Otro'}</dd>
              </div>
            ) : null}
          </dl>
          {measurements.length === 0 ? (
            <p className="mt-3 text-[11px] text-ink-muted">
              Datos auto-cargados desde el formulario web. Cargá una medición para empezar a ver evolución.
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <NutritionResumenKpi
          label="Peso"
          icon={<Scale />}
          unit="kg"
          value={latest ? weightOf(latest) : null}
          previous={previous ? weightOf(previous) : null}
          series={weightSeries}
          desiredDirection="neutral"
          precision={1}
        />
        <NutritionResumenKpi
          label="% Grasa"
          icon={<Flame />}
          unit="%"
          value={latest ? fatOf(latest) : null}
          previous={previous ? fatOf(previous) : null}
          series={fatSeries}
          desiredDirection="down"
          precision={1}
        />
        <NutritionResumenKpi
          label="Masa muscular"
          icon={<Activity />}
          unit="kg"
          value={latest ? muscleOf(latest) : null}
          previous={previous ? muscleOf(previous) : null}
          series={muscleSeries}
          desiredDirection="up"
          precision={1}
        />
        <NutritionResumenKpi
          label="Cintura"
          icon={<Ruler />}
          unit="cm"
          value={latest ? waistOf(latest) : null}
          previous={previous ? waistOf(previous) : null}
          series={waistSeries}
          desiredDirection="down"
          precision={1}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardTitle>Evolución del peso</CardTitle>
            <p className="text-xs text-ink-muted mt-0.5">
              {latest
                ? `Último control: ${format(parseISO(latest.measured_at), "d 'de' MMMM yyyy", { locale: es })}`
                : 'Sin controles todavía'}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => onGoToTab('antropometria')}>
            Ver detalle
          </Button>
        </div>

        {heroHasData ? (
          <div className="space-y-2">
            {!heroHasTrend ? (
              <p className="text-xs text-ink-muted">
                Primer control con peso. La curva de evolución aparece cuando cargues una segunda medición.
              </p>
            ) : null}
            <ChartSizedContainer className="h-[220px] w-full" minHeight={220}>
            {({ width, height }) => (
            <ResponsiveContainer width={width} height={height}>
              <AreaChart data={heroData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="resumen-peso-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--ink-muted))" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="rgb(var(--ink-muted))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-surface-border" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  className="fill-ink-muted"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                  width={36}
                  className="fill-ink-muted"
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [`${v} kg`, 'Peso']}
                />
                <Area
                  type="monotone"
                  dataKey="peso"
                  stroke="rgb(var(--ink-secondary))"
                  strokeWidth={2}
                  fill="url(#resumen-peso-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
            </ChartSizedContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-surface-border/80 px-4 py-8 text-center">
            <p className="text-sm text-ink-muted">
              Guardá una medición con <strong className="font-medium text-ink-secondary">peso bruto</strong> en
              antropometría para ver el gráfico acá.
            </p>
            <div className="mt-3">
              <Button type="button" size="sm" variant="outline" onClick={() => onGoToTab('antropometria')}>
                Cargar antropometría
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle className="mb-3">Accesos rápidos</CardTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <QuickAction
            icon={<Activity className="h-5 w-5" />}
            label="Nueva antropometría"
            description="Cargar control con el programa Holway"
            onClick={() => onGoToTab('antropometria')}
          />
          <QuickAction
            icon={<Utensils className="h-5 w-5" />}
            label="Editar plan"
            description="Grilla semanal lun–dom"
            onClick={() => onGoToTab('plan')}
          />
          <QuickAction
            icon={<ClipboardList className="h-5 w-5" />}
            label="Nota clínica"
            description="Registrar consulta o síntomas"
            onClick={() => onGoToTab('historia')}
          />
          <QuickAction
            icon={<Upload className="h-5 w-5" />}
            label="Subir PDF"
            description="Estudios, laboratorios, anamnesis"
            onClick={() => onGoToTab('archivos')}
          />
        </div>
      </Card>
    </div>
  )
}

function NextConsultationBanner({
  followup,
  onManageAppointments,
}: {
  followup: NutritionPatientFollowup | null
  onManageAppointments: () => void
}) {
  const hasNext = !!followup?.next_consultation_date

  return (
    <div className="rounded-2xl border border-surface-border/80 bg-surface-card px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-surface-elevated text-ink-muted">
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
            Próxima consulta
          </p>
          {hasNext ? (
            <p className="text-sm font-semibold text-ink-primary capitalize truncate">
              {format(parseISO(followup!.next_consultation_date!), "EEEE d 'de' MMMM yyyy", {
                locale: es,
              })}
            </p>
          ) : (
            <p className="text-sm text-ink-secondary">Sin turno agendado</p>
          )}
        </div>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onManageAppointments}>
        {hasNext ? 'Gestionar turnos' : 'Agendar consulta'}
      </Button>
    </div>
  )
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-xl border border-surface-border/70 bg-surface-elevated/40 px-4 py-3.5 hover:border-surface-border hover:bg-surface-elevated/70 transition-colors"
    >
      <div className="flex items-center gap-2 text-ink-secondary">
        <span className="text-ink-muted">{icon}</span>
        <span className="text-sm font-medium text-ink-primary">{label}</span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{description}</p>
    </button>
  )
}
