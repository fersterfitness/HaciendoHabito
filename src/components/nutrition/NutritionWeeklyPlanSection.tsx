import { pdf } from '@react-pdf/renderer'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WeeklyPlanGridFields } from '@/components/nutrition/WeeklyPlanGridFields'
import { differenceInYears } from 'date-fns'
import { FileDown, Sparkles } from 'lucide-react'
import { defaultBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import { NutritionMealPlanPdfDocument } from '@/lib/pdf/NutritionMealPlanPdfDocument'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import { createEmptyWeeklyGrid, normalizeWeeklyGrid, reshapeGrid } from '@/lib/nutrition/weeklyPlanGrid'
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
import toast from 'react-hot-toast'

interface Props {
  student: Student
  measurements: NutritionMeasurement[]
}

function genderEs(g: Student['gender']): string {
  switch (g) {
    case 'M':
      return 'Masculino'
    case 'F':
      return 'Femenino'
    default:
      return 'Sin indicar'
  }
}

function ageFromStudent(student: Student): string | null {
  if (!student.birth_date) return null
  try {
    return `${differenceInYears(new Date(), new Date(student.birth_date))} años`
  } catch {
    return null
  }
}

function latestWeightKg(measurements: NutritionMeasurement[]): string | null {
  const sorted = [...measurements].sort((a, b) =>
    new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime()
  )
  const w = sorted[0]?.weight_kg
  if (w == null || Number.isNaN(Number(w))) return null
  const n = typeof w === 'number' ? w : Number(w)
  return `${String(n.toFixed(3)).replace(/\.?0+$/, '')} kg`
}

export function NutritionWeeklyPlanSection({ student, measurements }: Props) {
  const { user, profile } = useAuthStore()
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
  const [legacyTemplates, setLegacyTemplates] = useState<NutritionWeekPlanTemplate[]>([])
  const [usingLegacyStore, setUsingLegacyStore] = useState(false)
  const persistTimer = useRef<number | null>(null)

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

        if (insertRow.error) {
          toast.error(insertRow.error.message)
        }
        rowData = insertRow.data
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

  const kcalPhrase = useMemo(() => {
    const t = totalKcal.trim()
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n <= 0) return null
    return `Plan basado en aproximadamente ${n} kcal/día`
  }, [totalKcal])

  async function downloadPdf() {
    setExportingPdf(true)
    try {
      const doc = (
        <NutritionMealPlanPdfDocument
          patientName={student.full_name}
          genderLabel={genderEs(student.gender)}
          ageText={ageFromStudent(student)}
          weightKgText={latestWeightKg(measurements)}
          totalKcalLabel={kcalPhrase}
          nextConsultLabel={nextConsultDate.trim() !== '' ? new Date(nextConsultDate + 'T12:00:00').toLocaleDateString('es-AR') : null}
          mergeWeekends={mergeWeekends}
          grid={normalizeWeeklyGrid(grid, mergeWeekends)}
          variant={pdfVariant}
          professionalName={profile?.full_name ?? 'Cris Crossetto'}
          professionalContact={{
            phone: '1155082465',
            email: 'cris.crossetto@gmail.com',
            instagram: '@c.vazqueznutricion',
          }}
          appLogoUrl={defaultBrandLogoSrc()}
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
    const response = window.prompt(
      `Importar "${source.name}"\nEscribí:\nR = reemplazar plan activo\nC = crear copia nueva`,
      'C'
    )
    if (!response) return
    const mode = response.trim().toUpperCase()
    if (mode !== 'R' && mode !== 'C') {
      toast.error('Opción inválida. Usá R o C.')
      return
    }

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-primary/20 bg-gradient-to-r from-brand-primary/10 to-brand-primary/10 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-primary flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-primary" />
              Exportación premium del plan
            </p>
            <p className="text-xs text-ink-secondary mt-1">
              Generá el PDF directamente desde esta sección, con diseño moderno para paciente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pdfVariant}
              onChange={(e) => setPdfVariant(e.target.value as 'compact' | 'detailed')}
              className="rounded-lg bg-surface-input border border-surface-inputBorder px-2 py-1.5 text-xs"
            >
              <option value="detailed">PDF detallado</option>
              <option value="compact">PDF compacto</option>
            </select>
            <Button
              type="button"
              size="sm"
              icon={<FileDown className="h-4 w-4" />}
              onClick={() => downloadPdf()}
              loading={exportingPdf}
            >
              Generar PDF ahora
            </Button>
          </div>
        </div>
      </div>

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
            className="mt-1 w-36 rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2 text-sm focus:outline-none focus:border-brand-primary block"
          />
        </label>
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
            className="mt-1 rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2 text-sm focus:outline-none focus:border-brand-primary block min-w-[10rem]"
          />
        </label>
      </div>

      {libraryPlans.length > 0 && (
        <label className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          <span>Importar plan desde biblioteca</span>
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              e.target.selectedIndex = 0
              if (v) void importFromLibrary(v)
            }}
            className="mt-1 max-w-[16rem] rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-2 py-1.5 text-sm"
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
            className="mt-1 max-w-[16rem] rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-2 py-1.5 text-sm"
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

      {versions.length > 0 && (
        <div className="rounded-xl border border-surface-border p-3 bg-surface-elevated/40">
          <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">Historial de versiones</p>
          <div className="flex flex-wrap gap-2">
            {versions.slice(0, 8).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => void activateVersion(v.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                  v.id === activeVersionId
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-semibold'
                    : 'border-surface-border hover:border-brand-primary/50 text-ink-secondary'
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
    </div>
  )
}
