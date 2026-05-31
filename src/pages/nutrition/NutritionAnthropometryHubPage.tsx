import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  History,
  Loader2,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import {
  NutritionMeasurementCharts,
  summarizeMeasurementVariables,
} from '@/components/nutrition/NutritionMeasurementCharts'
import { Spinner } from '@/components/ui/Spinner'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { nutritionInputClass, nutritionSectionTitleClass } from '@/lib/nutrition/nutritionAreaUi'
import { formatFunctionsInvokeError } from '@/lib/invokeFunctionError'
import { parseInlineMarkdown } from '@/lib/nutrition/inlineMarkdown'
import {
  deleteMeasurement,
  fetchMeasurementDeletionLog,
  restoreDeletedMeasurement,
} from '@/lib/nutrition/measurementDeletionAccess'
import { cn, formatDate } from '@/lib/utils'
import type {
  NutritionMeasurement,
  NutritionMeasurementDeletionLogEntry,
  Student,
} from '@/types/database'
import toast from 'react-hot-toast'

type MetricKey = 'weight_kg' | 'body_fat_pct' | 'bmi' | 'muscle_mass_kg'

const METRICS: { key: MetricKey; label: string; unit: string; betterWhenLower: boolean }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', betterWhenLower: false },
  { key: 'body_fat_pct', label: '% Graso', unit: '%', betterWhenLower: true },
  { key: 'muscle_mass_kg', label: 'Masa muscular', unit: 'kg', betterWhenLower: false },
  { key: 'bmi', label: 'IMC', unit: '', betterWhenLower: true },
]

function fmtNum(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(digits).replace(/\.0$/, '')
}

function InlineMd({ text }: { text: string }) {
  return (
    <>
      {parseInlineMarkdown(text).map((seg, i) => (
        <span
          key={i}
          className={cn(seg.bold && 'font-semibold text-ink-primary', seg.italic && 'italic')}
        >
          {seg.text}
        </span>
      ))}
    </>
  )
}

/** Render mínimo del Markdown del análisis IA (## títulos, viñetas, párrafos). */
function AiMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const blocks: JSX.Element[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length === 0) return
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="ml-1 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-secondary">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-tertiary" aria-hidden />
            <span className="leading-relaxed">
              <InlineMd text={b} />
            </span>
          </li>
        ))}
      </ul>,
    )
    bullets = []
  }

  lines.forEach((raw) => {
    const line = raw.trimEnd()
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (heading) {
      flushBullets()
      blocks.push(
        <p
          key={`h-${blocks.length}`}
          className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-tertiary"
        >
          <InlineMd text={heading[1] ?? ''} />
        </p>,
      )
    } else if (bullet) {
      bullets.push(bullet[1] ?? '')
    } else if (line.trim() === '') {
      flushBullets()
    } else {
      flushBullets()
      blocks.push(
        <p key={`p-${blocks.length}`} className="text-sm leading-relaxed text-ink-secondary">
          <InlineMd text={line} />
        </p>,
      )
    }
  })
  flushBullets()

  return <div className="space-y-3">{blocks}</div>
}

function MetricCard({
  label,
  unit,
  latest,
  prev,
  betterWhenLower,
}: {
  label: string
  unit: string
  latest: number | null
  prev: number | null
  betterWhenLower: boolean
}) {
  const delta = latest != null && prev != null ? latest - prev : null
  const improving =
    delta == null || delta === 0 ? null : betterWhenLower ? delta < 0 : delta > 0
  const tone =
    improving == null
      ? 'text-ink-muted'
      : improving
        ? 'text-status-generated'
        : 'text-status-expired'

  return (
    <div className="rounded-2xl border border-surface-border/70 bg-surface-card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink-primary">
        {fmtNum(latest)}
        {unit ? <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span> : null}
      </p>
      <div className={cn('mt-1 flex items-center gap-1 text-xs font-medium tabular-nums', tone)}>
        {delta == null ? (
          <span className="text-ink-muted">Sin control previo</span>
        ) : (
          <>
            {delta > 0 ? (
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
            ) : delta < 0 ? (
              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
            ) : null}
            {delta > 0 ? '+' : ''}
            {fmtNum(delta)} {unit} vs. anterior
          </>
        )}
      </div>
    </div>
  )
}

export function NutritionAnthropometryHubPage() {
  const { user } = useAuthStore()
  const navigate = useAppNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [measurements, setMeasurements] = useState<NutritionMeasurement[]>([])
  const [loadingMeasurements, setLoadingMeasurements] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletionLog, setDeletionLog] = useState<NutritionMeasurementDeletionLogEntry[]>([])
  const [loadingDeleted, setLoadingDeleted] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoadingStudents(true)
      const { data, error } = await fetchAccessibleStudents()
      if (!alive) return
      if (error) toast.error(error)
      setStudents(data)
      setLoadingStudents(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  const loadMeasurements = useCallback(async () => {
    if (!user || !selectedId) {
      setMeasurements([])
      return
    }
    setLoadingMeasurements(true)
    const { data, error } = await supabase
      .from('nutrition_measurements')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', selectedId)
      .order('measured_at', { ascending: false })
      .limit(40)
    if (error) toast.error(error.message)
    setMeasurements((data as NutritionMeasurement[]) ?? [])
    setLoadingMeasurements(false)
  }, [user, selectedId])

  const loadDeletionLog = useCallback(async () => {
    if (!selectedId) {
      setDeletionLog([])
      return
    }
    setLoadingDeleted(true)
    const { data, error } = await fetchMeasurementDeletionLog(selectedId)
    setLoadingDeleted(false)
    if (error) {
      toast.error(error)
      return
    }
    setDeletionLog(data)
  }, [selectedId])

  useEffect(() => {
    // Reset de análisis IA e historial al cambiar de paciente.
    setAiResult(null)
    setAiError(null)
    setAiLoading(false)
    setConfirmDeleteId(null)
    setShowDeleted(false)
    setDeletionLog([])
    void loadMeasurements()
  }, [loadMeasurements])

  function toggleDeleted() {
    const next = !showDeleted
    setShowDeleted(next)
    if (next) void loadDeletionLog()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await deleteMeasurement(id)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Antropometría eliminada')
    setAiResult(null)
    await loadMeasurements()
    if (showDeleted) await loadDeletionLog()
  }

  async function handleRestore(logId: string) {
    setRestoringId(logId)
    const { error } = await restoreDeletedMeasurement(logId)
    setRestoringId(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Antropometría restaurada')
    setAiResult(null)
    await Promise.all([loadMeasurements(), loadDeletionLog()])
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.full_name.toLowerCase().includes(q))
  }, [students, query])

  const selected = useMemo(
    () => students.find((s) => s.id === selectedId) ?? null,
    [students, selectedId],
  )

  const latest = measurements[0] ?? null
  const prev = measurements[1] ?? null

  // measurements viene descendente: el último del array es el primer control.
  const first = measurements.length > 0 ? measurements[measurements.length - 1]! : null

  async function runAiAnalysis() {
    if (!selected || measurements.length === 0 || aiLoading) return
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const metrics = METRICS.map((m) => {
        const lv = latest ? latest[m.key] : null
        const fv = first ? first[m.key] : null
        const delta =
          typeof lv === 'number' && typeof fv === 'number' ? Math.round((lv - fv) * 100) / 100 : null
        return {
          label: m.label,
          unit: m.unit,
          latest: typeof lv === 'number' ? lv : null,
          first: typeof fv === 'number' ? fv : null,
          delta,
          betterWhenLower: m.betterWhenLower,
        }
      })

      const { data, error } = await supabase.functions.invoke('anthropometry-ai-analysis', {
        body: {
          patientName: selected.full_name,
          controls: measurements.length,
          firstDate: first ? formatDate(first.measured_at) : undefined,
          lastDate: latest ? formatDate(latest.measured_at) : undefined,
          metrics,
          variables: summarizeMeasurementVariables(measurements),
        },
      })

      if (error) {
        const msg = await formatFunctionsInvokeError(error)
        setAiError(msg)
        return
      }

      const analysis =
        data && typeof data === 'object' && typeof (data as { analysis?: unknown }).analysis === 'string'
          ? (data as { analysis: string }).analysis
          : null
      if (!analysis) {
        setAiError('La función respondió sin texto de análisis. Reintentá en unos segundos.')
        return
      }
      setAiResult(analysis)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Error inesperado al generar el análisis.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div>
      <Header title="Antropometría" />

      <DirectoryPageShell className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Selector de paciente */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <div className="rounded-2xl border border-surface-border/80 bg-surface-card p-3">
              <div className="relative mb-3">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar paciente…"
                  className={cn(nutritionInputClass, 'h-10 w-full pl-9 pr-3 text-sm')}
                />
              </div>

              <div className="max-h-[60vh] space-y-1 overflow-y-auto px-1 py-1">
                {loadingStudents ? (
                  <div className="flex justify-center py-8">
                    <Spinner />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-ink-muted">Sin resultados.</p>
                ) : (
                  filtered.map((s) => {
                    const active = s.id === selectedId
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                          active
                            ? 'bg-surface-elevated shadow-sm ring-1 ring-inset ring-surface-border'
                            : 'hover:bg-surface-elevated/50',
                        )}
                      >
                        <StudentAvatar
                          studentId={s.id}
                          fullName={s.full_name}
                          avatarPath={s.avatar_path}
                          size="sm"
                          stopRowNavigation
                          onPathChange={() => {}}
                        />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-sm',
                            active ? 'font-semibold text-ink-primary' : 'font-medium text-ink-primary',
                          )}
                        >
                          {s.full_name}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </aside>

          {/* Detalle */}
          <section className="lg:col-span-8 xl:col-span-9 space-y-5">
            {!selected ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-surface-border/80 bg-surface-card/50 px-6 py-12 text-center">
                <Activity className="h-9 w-9 text-brand-secondary/70" aria-hidden />
                <p className="text-base font-semibold text-ink-primary">Elegí un paciente</p>
                <p className="max-w-sm text-sm text-ink-muted">
                  Seleccioná a alguien de la lista para ver su evolución antropométrica, comparar controles y
                  generar un análisis con IA.
                </p>
              </div>
            ) : (
              <>
                {/* Encabezado del paciente + acciones */}
                <div className="flex flex-col gap-3 rounded-2xl border border-surface-border/80 bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <StudentAvatar
                      studentId={selected.id}
                      fullName={selected.full_name}
                      avatarPath={selected.avatar_path}
                      size="md2"
                      stopRowNavigation
                      onPathChange={() => {}}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold tracking-tight text-ink-primary">
                        {selected.full_name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {measurements.length === 0
                          ? 'Sin controles cargados'
                          : `${measurements.length} ${measurements.length === 1 ? 'control' : 'controles'}${
                              latest ? ` · último ${formatDate(latest.measured_at)}` : ''
                            }`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/nutrition/${selected.id}?tab=antropometria`)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-secondary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-secondary/90"
                    >
                      <Activity className="h-4 w-4" aria-hidden />
                      Cargar / ver ficha
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/nutrition-pdfs')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-surface-border px-3.5 py-2 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-elevated"
                    >
                      <Scale className="h-4 w-4" aria-hidden />
                      Comparar
                    </button>
                    <button
                      type="button"
                      onClick={runAiAnalysis}
                      disabled={aiLoading || measurements.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-tertiary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-tertiary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      title={
                        measurements.length === 0
                          ? 'Cargá al menos un control para analizar'
                          : 'Generar análisis con IA'
                      }
                    >
                      {aiLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden />
                      )}
                      {aiLoading ? 'Analizando…' : aiResult ? 'Re-analizar' : 'Análisis IA'}
                    </button>
                    <button
                      type="button"
                      onClick={toggleDeleted}
                      aria-pressed={showDeleted}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors',
                        showDeleted
                          ? 'border-surface-border bg-surface-elevated text-ink-primary'
                          : 'border-surface-border text-ink-secondary hover:bg-surface-elevated',
                      )}
                    >
                      <History className="h-4 w-4" aria-hidden />
                      {showDeleted ? 'Ocultar eliminadas' : 'Eliminadas'}
                    </button>
                  </div>
                </div>

                {/* Historial de antropometrías eliminadas */}
                {showDeleted && (
                  <div className="rounded-2xl border border-surface-border/80 bg-surface-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <History className="h-4 w-4 text-ink-muted" aria-hidden />
                      <h2 className="text-sm font-semibold text-ink-primary">
                        Antropometrías eliminadas
                      </h2>
                    </div>
                    {loadingDeleted ? (
                      <div className="flex justify-center py-6">
                        <Spinner />
                      </div>
                    ) : deletionLog.length === 0 ? (
                      <p className="py-2 text-sm text-ink-muted">
                        No hay antropometrías eliminadas de este paciente.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {deletionLog.map((d) => (
                          <li
                            key={d.id}
                            className="flex items-center gap-3 rounded-xl border border-surface-border/60 bg-surface-elevated/30 px-3 py-2"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink-primary">
                                {d.measurement_number
                                  ? `Control N° ${d.measurement_number}`
                                  : 'Control'}
                                {d.measured_at ? (
                                  <span className="ml-2 text-xs font-normal text-ink-muted">
                                    {formatDate(d.measured_at)}
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-xs text-ink-muted">
                                Eliminada {formatDate(d.deleted_at)}
                                {d.deleted_by_name ? ` · ${d.deleted_by_name}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRestore(d.id)}
                              disabled={restoringId === d.id || d.can_restore === false}
                              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50"
                              title={
                                d.can_restore === false
                                  ? 'No se puede restaurar (ya existe o falta el paciente)'
                                  : 'Restaurar antropometría'
                              }
                            >
                              {restoringId === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                              )}
                              Restaurar
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {loadingMeasurements ? (
                  <div className="flex justify-center py-12">
                    <Spinner />
                  </div>
                ) : measurements.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-surface-border/80 bg-surface-card/50 px-6 py-10 text-center">
                    <CalendarDays className="h-8 w-8 text-ink-muted" aria-hidden />
                    <p className="text-sm font-medium text-ink-primary">Todavía no hay controles</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/nutrition/${selected.id}?tab=antropometria`)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-secondary hover:text-brand-secondary/80"
                    >
                      Cargar primer control
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Métricas clave */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                      {METRICS.map((m) => (
                        <MetricCard
                          key={m.key}
                          label={m.label}
                          unit={m.unit}
                          latest={latest ? latest[m.key] : null}
                          prev={prev ? prev[m.key] : null}
                          betterWhenLower={m.betterWhenLower}
                        />
                      ))}
                    </div>

                    {/* Controles cargados (con eliminación) */}
                    <div className="rounded-2xl border border-surface-border/80 bg-surface-card p-4">
                      <h2 className={cn(nutritionSectionTitleClass, 'mb-3')}>
                        Controles cargados
                      </h2>
                      <ul className="space-y-1.5">
                        {measurements.map((m) => {
                          const summary = [
                            m.weight_kg != null ? `${m.weight_kg} kg` : null,
                            m.body_fat_pct != null ? `${m.body_fat_pct}% graso` : null,
                            m.muscle_mass_kg != null ? `${m.muscle_mass_kg} kg músculo` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')
                          return (
                            <li
                              key={m.id}
                              className="flex items-center gap-3 rounded-xl border border-surface-border/60 bg-surface-elevated/20 px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-ink-primary">
                                  {m.measurement_number
                                    ? `Control N° ${m.measurement_number}`
                                    : 'Control'}
                                  <span className="ml-2 text-xs font-normal text-ink-muted">
                                    {formatDate(m.measured_at)}
                                  </span>
                                </p>
                                <p className="truncate text-xs text-ink-muted">
                                  {summary || 'Sin métricas generales'}
                                </p>
                              </div>
                              {confirmDeleteId === m.id ? (
                                <div className="flex shrink-0 items-center gap-1.5">
                                  <span className="text-xs text-ink-muted">¿Eliminar?</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(m.id)}
                                    disabled={deletingId === m.id}
                                    className="inline-flex items-center gap-1 rounded-lg bg-status-expired px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-status-expired/90 disabled:opacity-50"
                                  >
                                    {deletingId === m.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                    ) : null}
                                    Sí, eliminar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    disabled={deletingId === m.id}
                                    className="rounded-lg border border-surface-border px-2.5 py-1.5 text-xs font-semibold text-ink-secondary transition-colors hover:bg-surface-elevated disabled:opacity-50"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(m.id)}
                                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-surface-border p-1.5 text-ink-muted transition-colors hover:border-status-expired/40 hover:bg-status-expired/10 hover:text-status-expired"
                                  title="Eliminar control"
                                  aria-label="Eliminar control"
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>

                    {/* Análisis IA */}
                    {(aiLoading || aiResult || aiError) && (
                      <div className="rounded-2xl border border-brand-tertiary/30 bg-surface-card p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-brand-tertiary" aria-hidden />
                          <h2 className="text-sm font-semibold text-ink-primary">Análisis con IA</h2>
                        </div>
                        {aiLoading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-ink-muted">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Interpretando la evolución del paciente…
                          </div>
                        ) : aiError ? (
                          <div className="flex items-start gap-2 rounded-xl border border-status-expired/30 bg-status-expired/5 px-3 py-2.5 text-sm text-ink-secondary">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-expired" aria-hidden />
                            <span>{aiError}</span>
                          </div>
                        ) : aiResult ? (
                          <>
                            <AiMarkdown text={aiResult} />
                            <p className="mt-4 border-t border-surface-border/60 pt-3 text-[10px] leading-snug text-ink-muted">
                              Generado por IA a partir de los controles cargados. Es una ayuda orientativa, no
                              reemplaza el criterio profesional.
                            </p>
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* Gráficos de evolución */}
                    <div className="rounded-2xl border border-surface-border/80 bg-surface-card p-4">
                      <h2 className={cn(nutritionSectionTitleClass, 'mb-4')}>Evolución</h2>
                      <NutritionMeasurementCharts measurements={measurements} />
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </DirectoryPageShell>
    </div>
  )
}
