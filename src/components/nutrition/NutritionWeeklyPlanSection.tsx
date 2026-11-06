import { cn } from '@/lib/utils'
import { controlMdClassName, controlSmClassName } from '@/lib/formControlClasses'
import { pdf } from '@react-pdf/renderer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WeeklyPlanGridFields } from '@/components/nutrition/WeeklyPlanGridFields'
import { WeeklyMealPlanBoard } from '@/components/nutrition/WeeklyMealPlanBoard'
import { differenceInYears, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { useNextAppointment } from '@/components/nutrition/NutritionResumenDashboard'
import { FileDown, Sparkles } from 'lucide-react'
import { colorBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import { NutritionMealPlanPdfDocument } from '@/lib/pdf/NutritionMealPlanPdfDocument'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import { patientGenderLabel, patientWeightKgLabel } from '@/lib/nutrition/patientGenderLabel'
import { createEmptyWeeklyGrid, normalizeWeeklyGrid, reshapeGrid } from '@/lib/nutrition/weeklyPlanGrid'
import { fetchAccessibleStudentById } from '@/lib/students/studentAccess'
import type {
  NutritionMeasurement,
  NutritionPatientPlanVersion,
  NutritionPlanLibrary,
  NutritionWeekSchedule,
  NutritionWeekPlanTemplate,
  Student,
} from '@/types/database'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { planMenuItemClass, ShareMealPlanActionsV2 } from '@/components/nutrition/ShareMealPlanCardV2'
import { IS_V2 } from '@/lib/uiVersion'
import toast from 'react-hot-toast'

interface Props {
  student: Student
  measurements: NutritionMeasurement[]
  /** v2: fecha sugerida en el seguimiento, para cuando todavía no hay turno en la agenda. */
  suggestedNextDate?: string | null
}

function ageFromStudent(student: Student): string | null {
  if (!student.birth_date) return null
  try {
    return `${differenceInYears(new Date(), new Date(student.birth_date))} años`
  } catch {
    return null
  }
}

export function NutritionWeeklyPlanSection({ student, measurements, suggestedNextDate = null }: Props) {
  const { user } = useAuthStore()
  const sid = student.id
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [pdfVariant, setPdfVariant] = useState<'compact' | 'detailed'>('detailed')
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [versions, setVersions] = useState<NutritionPatientPlanVersion[]>([])
  const [mergeWeekends, setMergeWeekends] = useState(true)
  const [totalKcal, setTotalKcal] = useState('')
  const [nextConsultDate, setNextConsultDate] = useState('')
  const [grid, setGrid] = useState<WeeklyPlanGridJson>(() => createEmptyWeeklyGrid(true))
  const [libraryPlans, setLibraryPlans] = useState<NutritionPlanLibrary[]>([])
  const [importDialog, setImportDialog] = useState<{ planId: string; planName: string } | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [legacyTemplates, setLegacyTemplates] = useState<NutritionWeekPlanTemplate[]>([])
  const [usingLegacyStore, setUsingLegacyStore] = useState(false)
  const persistTimer = useRef<number | null>(null)
  // v2: la próxima consulta del plan sale de la agenda (o de la fecha sugerida); no se carga a mano.
  const appointment = useNextAppointment(IS_V2 ? sid : '')
  const agendaDate = IS_V2
    ? appointment
      ? format(parseISO(appointment.starts_at), 'yyyy-MM-dd')
      : suggestedNextDate && suggestedNextDate >= format(new Date(), 'yyyy-MM-dd')
        ? suggestedNextDate
        : null
    : null

  const persist = useCallback(
    (opts: {
      mergeWeekends: boolean
      totalKcal: string
      nextConsultDate: string
      grid: WeeklyPlanGridJson
    }) => {
      if (!user) return
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
      persistTimer.current = window.setTimeout(async () => {
        setSaving(true)
        const kcal = opts.totalKcal.trim() === '' ? null : parseInt(opts.totalKcal, 10)
        let error: { message: string } | null = null
        if (activeVersionId && !usingLegacyStore) {
          const res = await supabase
            .from('nutrition_patient_plan_versions')
            .update({
              merge_weekends: opts.mergeWeekends,
              grid: opts.grid as unknown as Record<string, unknown>,
              total_kcal: Number.isFinite(kcal) ? kcal : null,
              next_consultation_date: opts.nextConsultDate.trim() === '' ? null : opts.nextConsultDate,
            })
            .eq('id', activeVersionId)
            .eq('owner_id', user.id)
          error = (res.error as { message: string } | null) ?? null
        } else {
          const res = await supabase.from('nutrition_week_schedules').upsert(
            {
              owner_id: user.id,
              student_id: sid,
              merge_weekends: opts.mergeWeekends,
              grid: opts.grid as unknown as Record<string, unknown>,
              total_kcal: Number.isFinite(kcal) ? kcal : null,
              next_consultation_date: opts.nextConsultDate.trim() === '' ? null : opts.nextConsultDate,
            },
            { onConflict: 'owner_id,student_id' }
          )
          error = (res.error as { message: string } | null) ?? null
        }
        setSaving(false)
        if (error) toast.error(error.message)
      }, 780)
    },
    [user, sid, activeVersionId, usingLegacyStore]
  )

  function schedulePersist(partial?: Partial<{ mergeWeekends: boolean; grid: WeeklyPlanGridJson; totalKcal: string; nextConsultDate: string }>) {
    const mw = partial?.mergeWeekends ?? mergeWeekends
    const g = partial?.grid ?? grid
    const tk = partial?.totalKcal ?? totalKcal
    const nd = partial?.nextConsultDate ?? nextConsultDate
    persist({ mergeWeekends: mw, grid: normalizeWeeklyGrid(g, mw), totalKcal: tk, nextConsultDate: nd })
  }

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: plans } = await supabase
        .from('nutrition_plan_library')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
      setLibraryPlans((plans as NutritionPlanLibrary[]) ?? [])

      const { data: legacy } = await supabase
        .from('nutrition_week_plan_templates')
        .select('*')
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
      setLegacyTemplates((legacy as NutritionWeekPlanTemplate[]) ?? [])
    })()
  }, [user])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const { data: versionRows, error: versionsError } = await supabase
        .from('nutrition_patient_plan_versions')
        .select('*')
        .eq('owner_id', user.id)
        .eq('student_id', sid)
        .order('version_number', { ascending: false })

      if (!versionsError && versionRows && versionRows.length > 0) {
        const parsed = versionRows as NutritionPatientPlanVersion[]
        setVersions(parsed)
        const active = parsed.find((v) => v.is_active) ?? parsed[0]
        setActiveVersionId(active.id)
        setUsingLegacyStore(false)
        setMergeWeekends(active.merge_weekends)
        setTotalKcal(active.total_kcal != null ? String(active.total_kcal) : '')
        setNextConsultDate(active.next_consultation_date ?? '')
        setGrid(normalizeWeeklyGrid(active.grid, active.merge_weekends))
        setLoading(false)
        return
      }

      const fetchResult = await supabase
        .from('nutrition_week_schedules')
        .select('*')
        .eq('owner_id', user.id)
        .eq('student_id', sid)
        .maybeSingle()

      let rowData = fetchResult.data
      const { error } = fetchResult

      if (!rowData && !error) {
        const baseline = createEmptyWeeklyGrid(true)
        const insertRow = await supabase
          .from('nutrition_week_schedules')
          .insert({
            owner_id: user.id,
            student_id: sid,
            merge_weekends: true,
            grid: baseline as unknown as Record<string, unknown>,
            total_kcal: null,
            next_consultation_date: null,
          })
          .select('*')
          .single()

        if (insertRow.error?.code === '23505') {
          // Otra carga en paralelo ya creó la fila (p. ej. doble efecto en dev): se usa esa.
          const again = await supabase
            .from('nutrition_week_schedules')
            .select('*')
            .eq('owner_id', user.id)
            .eq('student_id', sid)
            .maybeSingle()
          rowData = again.data
        } else {
          if (insertRow.error) toast.error(insertRow.error.message)
          rowData = insertRow.data
        }
      }
      if (error) toast.error(error.message)

      if (rowData) {
        const row = rowData as NutritionWeekSchedule
        setUsingLegacyStore(true)
        setActiveVersionId(null)
        const mw = !!row.merge_weekends
        setMergeWeekends(mw)
        setTotalKcal(row.total_kcal != null ? String(row.total_kcal) : '')
        setNextConsultDate(row.next_consultation_date ?? '')
        setGrid(normalizeWeeklyGrid(row.grid, mw))
      }
      setLoading(false)
    })()
  }, [user, sid])

  // Se guarda en el plan para que salga igual en el PDF y en el link que abre el paciente.
  useEffect(() => {
    if (loading || !agendaDate || agendaDate === nextConsultDate) return
    setNextConsultDate(agendaDate)
    persist({ mergeWeekends, grid: normalizeWeeklyGrid(grid, mergeWeekends), totalKcal, nextConsultDate: agendaDate })
  }, [loading, agendaDate, nextConsultDate, persist, mergeWeekends, grid, totalKcal])

  const kcalPhrase = useMemo(() => {
    const t = totalKcal.trim()
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return `Plan basado en aproximadamente ${n} kcal/día`
  }, [totalKcal])

  async function downloadPdf() {
    setExportingPdf(true)
    try {
      const { data: freshStudent } = await fetchAccessibleStudentById(sid)
      const studentForPdf = freshStudent ?? student
      const doc = (
        <NutritionMealPlanPdfDocument
          patientName={studentForPdf.full_name}
          genderLabel={patientGenderLabel(studentForPdf, measurements)}
          ageText={ageFromStudent(studentForPdf)}
          weightKgText={patientWeightKgLabel(studentForPdf, measurements)}
          totalKcalLabel={kcalPhrase}
          nextConsultLabel={nextConsultDate.trim() !== '' ? new Date(nextConsultDate + 'T12:00:00').toLocaleDateString('es-AR') : null}
          mergeWeekends={mergeWeekends}
          grid={normalizeWeeklyGrid(grid, mergeWeekends)}
          variant={pdfVariant}
          appLogoUrl={colorBrandLogoSrc()}
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      toast.success('PDF generado')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    }
    setExportingPdf(false)
  }

  const toggleMergeWeekends = (checked: boolean) => {
    if (checked === mergeWeekends) return
    const nextGrid = reshapeGrid(normalizeWeeklyGrid(grid, mergeWeekends), mergeWeekends, checked)
    setMergeWeekends(checked)
    setGrid(nextGrid)
    schedulePersist({ mergeWeekends: checked, grid: nextGrid })
  }

  async function reloadVersions() {
    if (!user) return
    const { data } = await supabase
      .from('nutrition_patient_plan_versions')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', sid)
      .order('version_number', { ascending: false })
    const parsed = (data as NutritionPatientPlanVersion[]) ?? []
    setVersions(parsed)
  }

  async function importFromLibrary(planId: string) {
    if (!user || !planId) return
    const source = libraryPlans.find((x) => x.id === planId)
    if (!source) return
    setImportDialog({ planId, planName: source.name })
  }

  async function confirmImportFromLibrary(mode: 'R' | 'C') {
    if (!user || !importDialog) return
    const source = libraryPlans.find((x) => x.id === importDialog.planId)
    if (!source) {
      setImportDialog(null)
      return
    }
    setImportBusy(true)
    try {
    const maxVersion = versions.reduce((acc, v) => Math.max(acc, v.version_number), 0)
    const currentActive = versions.find((v) => v.is_active)
    if (mode === 'R' && currentActive) {
      await supabase
        .from('nutrition_patient_plan_versions')
        .update({ is_active: false })
        .eq('id', currentActive.id)
        .eq('owner_id', user.id)
    }

    const { data, error } = await supabase
      .from('nutrition_patient_plan_versions')
      .insert({
        owner_id: user.id,
        student_id: sid,
        source_library_id: source.id,
        version_number: maxVersion + 1,
        is_active: true,
        replaced_version_id: mode === 'R' ? currentActive?.id ?? null : null,
        title: source.name,
        merge_weekends: source.merge_weekends,
        total_kcal: Number.isFinite(parseInt(totalKcal, 10)) ? parseInt(totalKcal, 10) : null,
        next_consultation_date: nextConsultDate.trim() || null,
        grid: source.grid,
        notes: source.notes,
      })
      .select('*')
      .single()

    if (error || !data) {
      toast.error(error?.message ?? 'No se pudo importar el plan')
      return
    }

    const created = data as NutritionPatientPlanVersion
    const mw = created.merge_weekends
    setUsingLegacyStore(false)
    setActiveVersionId(created.id)
    setMergeWeekends(mw)
    setGrid(normalizeWeeklyGrid(created.grid, mw))
    setTotalKcal(created.total_kcal != null ? String(created.total_kcal) : '')
    setNextConsultDate(created.next_consultation_date ?? '')
    await reloadVersions()
    toast.success(mode === 'R' ? 'Plan reemplazado' : 'Nueva versión creada')
    } finally {
      setImportBusy(false)
      setImportDialog(null)
    }
  }

  async function activateVersion(versionId: string) {
    if (!user || activeVersionId === versionId) return
    const target = versions.find((v) => v.id === versionId)
    if (!target) return
    if (activeVersionId) {
      await supabase
        .from('nutrition_patient_plan_versions')
        .update({ is_active: false })
        .eq('id', activeVersionId)
        .eq('owner_id', user.id)
    }
    await supabase
      .from('nutrition_patient_plan_versions')
      .update({ is_active: true })
      .eq('id', versionId)
      .eq('owner_id', user.id)
    setActiveVersionId(versionId)
    setUsingLegacyStore(false)
    setMergeWeekends(target.merge_weekends)
    setGrid(normalizeWeeklyGrid(target.grid, target.merge_weekends))
    setTotalKcal(target.total_kcal != null ? String(target.total_kcal) : '')
    setNextConsultDate(target.next_consultation_date ?? '')
    await reloadVersions()
    toast.success(`Versión ${target.version_number} activada`)
  }

  if (loading) {
    return <p className="text-sm text-ink-muted py-4 text-center">Cargando plan semanal…</p>
  }

  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? null

  return (
    <div className="space-y-4">
      {IS_V2 ? (
        // v2: qué plan es y si está guardado; a la vista solo mandarlo y verlo. El resto, en «⋯».
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink-primary">Plan semanal</h3>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              {activeVersion ? `Versión ${activeVersion.version_number}` : 'Plan del paciente'} · {saving ? 'Guardando…' : 'Guardado'}
            </p>
          </div>
          <ShareMealPlanActionsV2
            studentId={sid}
            studentName={student.full_name}
            studentPhone={student.phone}
            menu={(close) => (
              <>
                <button
                  type="button"
                  className={planMenuItemClass}
                  disabled={exportingPdf}
                  onClick={() => {
                    close()
                    void downloadPdf()
                  }}
                >
                  <FileDown className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                  Descargar PDF
                </button>
                {libraryPlans.length > 0 ? (
                  <label className="block px-2 py-1.5 text-[12px] text-ink-muted">
                    Traer un plan de la biblioteca
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value
                        e.target.selectedIndex = 0
                        if (!v) return
                        close()
                        void importFromLibrary(v)
                      }}
                      className={cn(controlSmClassName, 'mt-1 w-full cursor-pointer px-2 text-[13px]')}
                    >
                      <option value="">Elegí un plan…</option>
                      {libraryPlans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {versions.length > 1 ? (
                  <div className="px-2 py-1.5">
                    <p className="text-[12px] text-ink-muted">Volver a una versión anterior</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {versions.slice(0, 8).map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            close()
                            if (v.id !== activeVersionId) void activateVersion(v.id)
                          }}
                          aria-pressed={v.id === activeVersionId}
                          className={cn(
                            'h-7 rounded-md px-2 text-[12px] font-medium tabular-nums transition-colors',
                            v.id === activeVersionId ? 'bg-ink-primary text-surface-card' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
                          )}
                        >
                          V{v.version_number}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-secondary/25 bg-brand-secondary/[0.06] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink-primary flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-secondary" />
                Exportación premium del plan
              </p>
              <p className="text-xs text-ink-secondary mt-1">
                Generá el PDF con el mismo tablero por días que ve el paciente.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={pdfVariant}
                onChange={(e) => setPdfVariant(e.target.value as 'compact' | 'detailed')}
                className={cn(controlSmClassName, 'px-2 cursor-pointer')}
              >
                <option value="detailed">PDF detallado</option>
                <option value="compact">PDF compacto</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="gradientSecondary"
                icon={<FileDown className="h-4 w-4" />}
                onClick={() => downloadPdf()}
                loading={exportingPdf}
              >
                Generar PDF ahora
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-ink-secondary">
          Meta calórica (kcal/día)
          <input
            type="number"
            min={600}
            max={10000}
            value={totalKcal}
            onChange={(e) => {
              const next = e.target.value
              setTotalKcal(next)
              schedulePersist({ totalKcal: next })
            }}
            placeholder="Ej: 2250"
            className={cn(controlMdClassName, 'mt-1 w-36 block')}
          />
        </label>
        {IS_V2 && agendaDate ? (
          <div className="text-xs text-ink-secondary">
            Próxima consulta
            <p className="mt-1 flex h-10 items-center rounded-xl bg-surface-elevated/60 px-3 text-sm text-ink-primary">
              <span className="first-letter:uppercase">{format(parseISO(agendaDate), "EEEE d 'de' MMMM", { locale: es })}</span>
              <span className="ml-1.5 text-ink-muted">· {appointment ? 'de la agenda' : 'sugerida'}</span>
            </p>
          </div>
        ) : (
        <label className="text-xs text-ink-secondary">
          Próxima consulta
          <input
            type="date"
            value={nextConsultDate}
            onChange={(e) => {
              const v = e.target.value
              setNextConsultDate(v)
              schedulePersist({ nextConsultDate: v })
            }}
            className={cn(controlMdClassName, 'mt-1 block min-w-[10rem]')}
          />
        </label>
        )}
      </div>

      {!IS_V2 && libraryPlans.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          <span>Importar plan desde biblioteca</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.selectedIndex = 0
              if (v) void importFromLibrary(v)
            }}
            className={cn(controlSmClassName, 'mt-1 max-w-[16rem] px-2 text-sm cursor-pointer')}
          >
            <option value="">Elegí un plan…</option>
            {libraryPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {libraryPlans.length === 0 && legacyTemplates.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          <span>Cargar plantilla legacy</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.selectedIndex = 0
              if (!v) return
              const tpl = legacyTemplates.find((x) => x.id === v)
              if (!tpl) return
              const mw = tpl.merge_weekends
              const nextGrid = normalizeWeeklyGrid(tpl.grid, mw)
              setMergeWeekends(mw)
              setGrid(nextGrid)
              schedulePersist({ mergeWeekends: mw, grid: nextGrid })
            }}
            className={cn(controlSmClassName, 'mt-1 max-w-[16rem] px-2 text-sm cursor-pointer')}
          >
            <option value="">Elegí una plantilla legacy…</option>
            {legacyTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!IS_V2 && versions.length > 0 && (
        <div className="rounded-xl border border-surface-border p-3 bg-surface-elevated/40">
          <p className="text-xs font-semibold text-ink-secondary mb-2">Historial de versiones</p>
          <div className="flex flex-wrap gap-2">
            {versions.slice(0, 8).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => void activateVersion(v.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  v.id === activeVersionId
                    ? 'border-brand-secondary/40 bg-brand-secondary/10 text-brand-secondary font-semibold'
                    : 'border-surface-border hover:border-brand-secondary/35 text-ink-secondary'
                }`}
              >
                V{v.version_number}{v.is_active ? ' · Activa' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <WeeklyPlanGridFields
        mergeWeekends={mergeWeekends}
        grid={grid}
        onMergeWeekendsChange={toggleMergeWeekends}
        onGridChange={(next) => {
          setGrid(next)
          schedulePersist({ grid: next })
        }}
      />

      {/* v2: la grilla de arriba ya es el plan; cómo lo ve el paciente está en «Ver como paciente». */}
      {IS_V2 ? null : (
        <div className="rounded-2xl border border-surface-border bg-surface-card p-3 sm:p-4">
          <WeeklyMealPlanBoard mergeWeekends={mergeWeekends} grid={normalizeWeeklyGrid(grid, mergeWeekends)} />
        </div>
      )}

      {IS_V2 ? null : (
      <div className="flex flex-wrap gap-3 items-center pt-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<FileDown className="h-4 w-4" />}
          onClick={() => downloadPdf()}
          loading={exportingPdf}
        >
          Descargar PDF plan
        </Button>
        <span className="text-xs text-ink-muted">{saving ? 'Guardando…' : 'Sin cambios pendientes'}</span>
      </div>
      )}

      {importDialog ? (
        <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px] dark:bg-black/60"
            onClick={() => !importBusy && setImportDialog(null)}
          />
          <div
            role="dialog"
            aria-modal
            aria-labelledby="import-plan-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-surface-border bg-surface-card p-5 shadow-card-lg"
          >
            <p id="import-plan-title" className="text-sm font-semibold text-ink-primary">
              Importar plan «{importDialog.planName}»
            </p>
            <p className="mt-2 text-xs text-ink-secondary">
              ¿Cómo querés aplicar este plan al paciente?
            </p>
            <ul className="mt-3 space-y-2 text-xs text-ink-secondary">
              <li>
                <strong className="text-ink-primary">Reemplazar plan activo</strong>: el plan actual se archiva y este queda activo en su lugar.
              </li>
              <li>
                <strong className="text-ink-primary">Crear copia nueva</strong>: se crea una nueva versión activa sin tocar la actual (queda en historial).
              </li>
            </ul>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportDialog(null)}
                disabled={importBusy}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void confirmImportFromLibrary('C')}
                loading={importBusy}
              >
                Crear copia nueva
              </Button>
              <Button
                type="button"
                variant="gradientSecondary"
                size="sm"
                onClick={() => void confirmImportFromLibrary('R')}
                loading={importBusy}
              >
                Reemplazar plan activo
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
