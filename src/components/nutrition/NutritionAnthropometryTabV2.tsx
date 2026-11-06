import { type RefObject, useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, Check, FileImage, History, Loader2, Plus, RotateCcw, Save, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { formatFunctionsInvokeError } from '@/lib/invokeFunctionError'
import { fetchMeasurementDeletionLog, restoreDeletedMeasurement } from '@/lib/nutrition/measurementDeletionAccess'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import { NUTRITION_CONTROL_OVERDUE_DAYS } from '@/lib/dashboard/nutritionistOps'
import { formatDate } from '@/lib/utils'
import type { NutritionMeasurement, NutritionMeasurementDeletionLogEntry, Student } from '@/types/database'
import { NutritionAnthropometryProgramForm, type AnthropometryProgramDraft } from './NutritionAnthropometryProgramForm'
import { NutritionMeasurementCharts, summarizeMeasurementVariables } from './NutritionMeasurementCharts'
import { NutritionMeasurementHistoryList } from './NutritionMeasurementHistoryList'
import { NutritionAnthropometryPresentationPanel } from './NutritionAnthropometryPresentationPanel'
import { AiMarkdown } from './AnthropometryAiMarkdown'
import { NutritionBodyComparisonCard } from './NutritionBodyComparisonCard'
import { Delta, METRICS, nf, type Metric } from './NutritionResumenDashboardV2'

/**
 * Antropometría v2: un solo lugar. Arriba "Nuevo control" (PDF o a mano), después el último control,
 * la evolución y la lista de controles con su detalle.
 */

const TILES: Metric[] = [
  { key: 'weight', label: 'Peso', short: 'Peso', unit: 'kg', dir: 'neutral', get: (m) => weightOf(m) },
  ...METRICS,
]

interface Props {
  ownerId: string
  student: Student
  /** Del más nuevo al más viejo. */
  measurements: NutritionMeasurement[]
  onRefresh: () => Promise<void> | void
  /** Cuando se completa un dato de la ficha desde la pestaña (p. ej. el sexo). */
  onStudentUpdated?: (next: Student) => void
  draft: AnthropometryProgramDraft
  onDraftClear: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onClone: (id: string) => void
  onDelete: (id: string) => void
  deletingId: string | null
  importFile: File | null
  onImportConsumed: () => void
  formRef: RefObject<HTMLDivElement>
  /** Sube cada vez que otra pantalla pide "Nuevo control" (abre el formulario). */
  openRequest?: number
}

export function NutritionAnthropometryTabV2(props: Props) {
  const { ownerId, student, measurements, onRefresh, draft, onDraftClear, importFile, formRef } = props
  const [formOpen, setFormOpen] = useState(measurements.length === 0)
  const ai = useAiAnalysis(ownerId, student.id, measurements)
  // El informe va en su propia pestaña: así no queda debajo del panel flotante del paciente.
  const openReport = () => {
    const q = props.selectedId ? `?control=${encodeURIComponent(props.selectedId)}` : ''
    window.open(`/nutrition/${student.id}/informe${q}`, '_blank')
  }

  useEffect(() => {
    if (!draft && !importFile) return
    setFormOpen(true)
    // El formulario recién se monta: esperar un cuadro antes de llevarlo a la vista.
    const t = window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => window.clearTimeout(t)
  }, [draft, importFile, formRef])

  useEffect(() => {
    if (!props.openRequest) return
    setFormOpen(true)
    const t = window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    return () => window.clearTimeout(t)
  }, [props.openRequest, formRef])

  const latest = measurements[0] ?? null
  const ordered = useMemo(() => [...measurements].reverse(), [measurements])
  const heightCm = student.height_cm ?? null
  const daysSince = latest ? Math.round((Date.now() - parseISO(latest.measured_at).getTime()) / 86_400_000) : null
  const overdue = daysSince != null && daysSince > NUTRITION_CONTROL_OVERDUE_DAYS

  const tiles = TILES.flatMap((mt) => {
    const withVal = ordered.filter((m) => mt.get(m, heightCm) != null)
    if (!withVal.length) return []
    const last = withVal[withVal.length - 1]!
    const v = mt.get(last, heightCm) as number
    const prevM = withVal[withVal.length - 2]
    const p = prevM ? mt.get(prevM, heightCm) : null
    return [{ mt, v, delta: p != null ? v - p : null, stale: last.id !== latest?.id }]
  })

  function closeForm() {
    onDraftClear()
    setFormOpen(false)
  }

  const formTitle =
    draft?.mode === 'edit' ? 'Editar control' : draft?.mode === 'clone' ? 'Nuevo control a partir de otro' : 'Nuevo control'

  return (
    <div className="space-y-5">
      {/* Encabezado: estado y la única acción de carga */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink-primary">Antropometría</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {latest ? (
              <>
                {measurements.length} {measurements.length === 1 ? 'control' : 'controles'} · último{' '}
                {format(parseISO(latest.measured_at), "d 'de' MMMM yyyy", { locale: es })}
                {overdue ? <span className="font-medium text-status-expired"> · atrasado ({Math.round(daysSince / 7)} semanas)</span> : null}
              </>
            ) : (
              'Todavía no hay controles'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {measurements.length ? (
            <Button type="button" size="sm" variant="secondary" icon={<FileImage className="h-4 w-4" />} onClick={openReport}>
              Informe
            </Button>
          ) : null}
          <AiAnalysisButton ai={ai} />
          {!formOpen ? (
            <Button type="button" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setFormOpen(true)}>
              Nuevo control
            </Button>
          ) : null}
        </div>
      </div>

      {formOpen ? (
        <Card ref={formRef} padding="md">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <CardTitle>{formTitle}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-muted">
                Arrastrá el informe PDF y se completa solo, o cargá las medidas a mano (con una sola serie alcanza).
              </p>
            </div>
            {measurements.length ? (
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <NutritionAnthropometryProgramForm
            ownerId={ownerId}
            student={student}
            measurements={measurements}
            draft={draft}
            onDraftClear={closeForm}
            onSaved={async () => {
              onDraftClear()
              setFormOpen(false)
              await onRefresh()
            }}
            importFile={importFile}
            onImportConsumed={props.onImportConsumed}
          />
        </Card>
      ) : null}

      <AiAnalysisPanel ai={ai} />


      {latest ? (
        <>
          {tiles.length ? (
            <div>
              <p className="mb-2 px-0.5 text-2xs font-semibold text-ink-muted">Último control</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                {tiles.map(({ mt, v, delta, stale }) => (
                  <div key={mt.key} className="rounded-2xl border border-surface-border/80 bg-surface-card px-3.5 py-3">
                    <p className="truncate text-3xs font-semibold text-ink-muted">{mt.label}</p>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-semibold tabular-nums text-ink-primary">{nf(v)}</span>
                      {mt.unit ? <span className="text-2xs text-ink-muted">{mt.unit}</span> : null}
                    </p>
                    <p className="mt-1 text-2xs">
                      {delta != null ? <Delta value={delta} unit={mt.unit} dir={mt.dir} /> : <span className="text-ink-muted">un solo control</span>}
                    </p>
                    {stale ? <p className="mt-0.5 text-3xs text-ink-muted">de un control anterior</p> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <NutritionBodyComparisonCard student={student} measurements={measurements} onStudentUpdated={props.onStudentUpdated} />

          <Card padding="md">
            <CardTitle className="mb-3">Evolución</CardTitle>
            <NutritionMeasurementCharts measurements={measurements} />
          </Card>

          <Card padding="md">
            <CardTitle className="mb-3">Controles</CardTitle>
            <NutritionMeasurementHistoryList
              measurements={measurements}
              selectedId={props.selectedId}
              onSelect={props.onSelect}
              onEdit={props.onEdit}
              onClone={props.onClone}
              onDelete={props.onDelete}
              deletingId={props.deletingId}
            />
            <DeletedControls studentId={student.id} onRestored={onRefresh} />
          </Card>

          <Card padding="md">
            <NutritionAnthropometryPresentationPanel
              patientName={student.full_name}
              measurements={measurements}
              selectedMeasurementId={props.selectedId}
            />
          </Card>
        </>
      ) : null}
    </div>
  )
}

/* ─────────────── Análisis IA ─────────────── */

type Ai = ReturnType<typeof useAiAnalysis>

function useAiAnalysis(ownerId: string, studentId: string, measurements: NutritionMeasurement[]) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Al cambiar de paciente se descarta el análisis anterior.
    setLoading(false)
    setResult(null)
    setError(null)
    setSaved(false)
  }, [studentId])

  async function run() {
    if (!measurements.length || loading) return
    setLoading(true)
    setError(null)
    setResult(null)
    setSaved(false)
    const latest = measurements[0]!
    const first = measurements[measurements.length - 1]!
    const metrics = TILES.filter((t) => ['weight', 'fat', 'muscle', 'bmi'].includes(t.key)).map((t) => {
      const lv = t.get(latest, null)
      const fv = t.get(first, null)
      return {
        label: t.label,
        unit: t.unit,
        latest: lv,
        first: fv,
        delta: lv != null && fv != null ? Math.round((lv - fv) * 100) / 100 : null,
        betterWhenLower: t.dir === 'down',
      }
    })
    try {
      const { data, error: fnError } = await supabase.functions.invoke('anthropometry-ai-analysis', {
        body: {
          // Sin datos identificatorios: el análisis sólo necesita las mediciones.
          patientName: 'Paciente',
          controls: measurements.length,
          firstDate: formatDate(first.measured_at),
          lastDate: formatDate(latest.measured_at),
          metrics,
          variables: summarizeMeasurementVariables(measurements),
        },
      })
      if (fnError) {
        setError(await formatFunctionsInvokeError(fnError))
        return
      }
      const analysis =
        data && typeof (data as { analysis?: unknown }).analysis === 'string' ? (data as { analysis: string }).analysis : null
      if (analysis) setResult(analysis)
      else setError('La función respondió sin texto de análisis. Reintentá en unos segundos.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado al generar el análisis.')
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!result || saved) return
    setSaving(true)
    const { error: dbError } = await supabase.from('nutrition_clinical_notes').insert({
      owner_id: ownerId,
      student_id: studentId,
      occurred_at: new Date().toISOString().slice(0, 10),
      title: 'Análisis antropométrico (IA)',
      body: result,
    })
    setSaving(false)
    if (dbError) {
      toast.error(dbError.message)
      return
    }
    setSaved(true)
    toast.success('Guardado en la historia clínica del paciente')
  }

  function clear() {
    setResult(null)
    setError(null)
    setSaved(false)
  }

  return { loading, result, error, saved, saving, run, save, clear, enabled: measurements.length > 0 }
}

function AiAnalysisButton({ ai }: { ai: Ai }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!ai.enabled || ai.loading}
      icon={ai.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      onClick={() => void ai.run()}
      title={ai.enabled ? 'Interpretar la evolución con IA' : 'Cargá al menos un control'}
    >
      {ai.loading ? 'Analizando…' : ai.result ? 'Re-analizar' : 'Análisis IA'}
    </Button>
  )
}

function AiAnalysisPanel({ ai }: { ai: Ai }) {
  if (!ai.loading && !ai.result && !ai.error) return null
  return (
    <Card padding="md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-ink-muted" aria-hidden />
          Análisis con IA
        </CardTitle>
        {!ai.loading ? (
          <button
            type="button"
            onClick={ai.clear}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
            aria-label="Cerrar análisis"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {ai.loading ? (
        <p className="flex items-center gap-2 py-3 text-sm text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Interpretando la evolución del paciente…
        </p>
      ) : ai.error ? (
        <p className="flex items-start gap-2 rounded-xl border border-status-expired/30 bg-status-expired/10 px-3 py-2.5 text-sm text-ink-secondary">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-expired" aria-hidden />
          {ai.error}
        </p>
      ) : ai.result ? (
        <>
          <AiMarkdown text={ai.result} />
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-border/60 pt-3">
            <p className="min-w-0 flex-1 text-3xs leading-snug text-ink-muted">
              Generado por IA a partir de los controles. Es orientativo, no reemplaza el criterio profesional.
            </p>
            <Button
              size="sm"
              variant={ai.saved ? 'ghost' : 'outline'}
              loading={ai.saving}
              disabled={ai.saved}
              icon={ai.saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
              onClick={() => void ai.save()}
            >
              {ai.saved ? 'Guardado en historia' : 'Guardar en historia clínica'}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  )
}

/* ─────────────── Controles eliminados ─────────────── */

function DeletedControls({ studentId, onRestored }: { studentId: string; onRestored: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<NutritionMeasurementDeletionLogEntry[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await fetchMeasurementDeletionLog(studentId)
    setLoading(false)
    if (error) toast.error(error)
    else setLog(data)
  }

  async function restore(id: string) {
    setRestoringId(id)
    const { error } = await restoreDeletedMeasurement(id)
    setRestoringId(null)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Control restaurado')
    await Promise.all([load(), onRestored()])
  }

  return (
    <div className="mt-3 border-t border-surface-border/60 pt-3">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) void load()
        }}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink-primary"
        aria-expanded={open}
      >
        <History className="h-3.5 w-3.5" aria-hidden />
        {open ? 'Ocultar eliminados' : 'Ver controles eliminados'}
      </button>
      {open ? (
        loading ? (
          <p className="mt-2 text-xs text-ink-muted">Cargando…</p>
        ) : log.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">No hay controles eliminados.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {log.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-xl bg-surface-elevated/50 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-primary">
                    {d.measurement_number ? `Control N° ${d.measurement_number}` : 'Control'}
                    {d.measured_at ? <span className="ml-2 text-xs text-ink-muted">{formatDate(d.measured_at)}</span> : null}
                  </p>
                  <p className="truncate text-2xs text-ink-muted">
                    Eliminado {formatDate(d.deleted_at)}
                    {d.deleted_by_name ? ` · ${d.deleted_by_name}` : ''}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={restoringId === d.id || d.can_restore === false}
                  icon={restoringId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                  onClick={() => void restore(d.id)}
                  title={d.can_restore === false ? 'No se puede restaurar (ya existe o falta el paciente)' : 'Restaurar'}
                >
                  Restaurar
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
