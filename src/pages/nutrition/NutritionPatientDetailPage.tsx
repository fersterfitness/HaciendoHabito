import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { pdf } from '@react-pdf/renderer'
import {
  Activity,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  Utensils,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Tabs, TabPanel, type TabItem } from '@/components/ui/Tabs'
import { NutritionAnamnesisSection } from '@/components/nutrition/NutritionAnamnesisSection'
import { NutritionWeeklyPlanSection } from '@/components/nutrition/NutritionWeeklyPlanSection'
import { NutritionAnthropometryProgramForm } from '@/components/nutrition/NutritionAnthropometryProgramForm'
import { NutritionAnthropometryPresentationPanel } from '@/components/nutrition/NutritionAnthropometryPresentationPanel'
import { NutritionMeasurementCharts } from '@/components/nutrition/NutritionMeasurementCharts'
import { NutritionClinicalNotesSection } from '@/components/nutrition/NutritionClinicalNotesSection'
import { NutritionSymptomCheckinsSection } from '@/components/nutrition/NutritionSymptomCheckinsSection'
import { NutritionRequirementsCalculatorCard } from '@/components/nutrition/NutritionRequirementsCalculatorCard'
import { NutritionExchangeReferenceCard } from '@/components/nutrition/NutritionExchangeReferenceCard'
import { NutritionResumenDashboard } from '@/components/nutrition/NutritionResumenDashboard'
import { NutritionPatientPersonalDataSection } from '@/components/nutrition/NutritionPatientPersonalDataSection'
import { NutritionEvolutionReportPdfDocument } from '@/lib/pdf/NutritionEvolutionReportPdfDocument'
import {
  buildEvolutionPdfRows,
  buildPatientFacingInterpretation,
  TONE_LABELS,
  type InterpretationTone,
} from '@/lib/nutrition/nutritionEvolutionInterpretation'
import { slugify } from '@/lib/utils'
import type {
  Student,
  NutritionPatientDocument,
  NutritionDocumentCategory,
  NutritionMeasurement,
  NutritionPatientFollowup,
  Json,
} from '@/types/database'
import toast from 'react-hot-toast'

type DocCategoryConfig = {
  key: NutritionDocumentCategory
  title: string
  uploadLabel: string
  emptyLabel: string
  buildName: (patientName: string, date: Date, originalFileName: string) => string
}

const CATEGORIES: DocCategoryConfig[] = [
  {
    key: 'antropometria',
    title: 'Antropometrías',
    uploadLabel: 'Subir antropometría',
    emptyLabel: 'Todavía no hay antropometrías cargadas.',
    buildName: (_name, date, originalFileName) =>
      `Antropometría ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
  {
    key: 'anamnesis',
    title: 'Anamnesis alimentaria',
    uploadLabel: 'Subir anamnesis',
    emptyLabel: 'Todavía no hay anamnesis adjunta.',
    buildName: (name, date, originalFileName) =>
      `Anamnesis de ${name} ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
  {
    key: 'laboratorio',
    title: 'Laboratorios y estudios',
    uploadLabel: 'Subir laboratorio',
    emptyLabel: 'Sin estudios de laboratorio cargados.',
    buildName: (name, date, originalFileName) =>
      `Estudio · ${name} · ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
]

const FILE_FILTERS: { id: 'all' | NutritionDocumentCategory; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'antropometria', label: 'Antropometrías' },
  { id: 'anamnesis', label: 'Anamnesis' },
  { id: 'laboratorio', label: 'Laboratorios' },
]

const VALID_TABS = ['resumen', 'datos', 'antropometria', 'plan', 'historia', 'archivos'] as const
type TabId = (typeof VALID_TABS)[number]

function isValidTab(value: string | null): value is TabId {
  return value !== null && (VALID_TABS as readonly string[]).includes(value)
}

function monthLabel(dateIso: string) {
  return format(new Date(dateIso), 'MMMM yyyy', { locale: es })
}

function buildSafePdfName(fileName: string): string {
  const clean = fileName.replace(/\.pdf$/i, '')
  return `${slugify(clean)}.pdf`
}

function buildOriginalLabel(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim()
}

function toNullableNumber(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function NutritionPatientDetailPage() {
  const navigate = useAppNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: TabId = isValidTab(searchParams.get('tab')) ? (searchParams.get('tab') as TabId) : 'resumen'
  const [fileFilter, setFileFilter] = useState<'all' | NutritionDocumentCategory>('all')
  const [loading, setLoading] = useState(true)
  const [savingPlan, setSavingPlan] = useState(false)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)
  const [savingMeasurement, setSavingMeasurement] = useState(false)
  const [student, setStudent] = useState<Student | null>(null)
  const [documents, setDocuments] = useState<NutritionPatientDocument[]>([])
  const [measurements, setMeasurements] = useState<NutritionMeasurement[]>([])
  const [planText, setPlanText] = useState('')
  const [followup, setFollowup] = useState<NutritionPatientFollowup | null>(null)
  const [measurementForm, setMeasurementForm] = useState({
    measured_at: new Date().toISOString().slice(0, 10),
    weight_kg: '',
    bmi: '',
    body_fat_pct: '',
    muscle_mass_kg: '',
    perimeters_notes: '',
    skinfolds_notes: '',
    notes: '',
  })
  const [pdfExporting, setPdfExporting] = useState(false)
  const [pdfTone, setPdfTone] = useState<InterpretationTone>('empatico')
  const planDebounceRef = useRef<number | null>(null)

  const handleTabChange = useCallback(
    (next: string) => {
      setSearchParams((prev) => {
        const params = new URLSearchParams(prev)
        params.set('tab', next)
        return params
      }, { replace: true })
    },
    [setSearchParams],
  )

  const refreshMeasurements = useCallback(async () => {
    if (!user || !id) return
    const { data, error } = await supabase
      .from('nutrition_measurements')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', id)
      .order('measured_at', { ascending: false })
      .limit(40)
    if (error) {
      toast.error(error.message)
      return
    }
    setMeasurements((data as NutritionMeasurement[]) ?? [])
  }, [id, user])

  useEffect(() => {
    if (!user || !id) return
    ;(async () => {
      setLoading(true)
      const [
        { data: studentData, error: studentError },
        { data: docsData, error: docsError },
        { data: noteData, error: noteError },
        { data: measurementsData, error: measurementsError },
        { data: followData, error: followError },
      ] = await Promise.all([
        supabase.from('students').select('*').eq('id', id).eq('owner_id', user.id).single(),
        supabase
          .from('nutrition_patient_documents')
          .select('*')
          .eq('owner_id', user.id)
          .eq('student_id', id)
          .order('document_date', { ascending: false }),
        supabase
          .from('nutrition_plan_notes')
          .select('*')
          .eq('owner_id', user.id)
          .eq('student_id', id)
          .maybeSingle(),
        supabase
          .from('nutrition_measurements')
          .select('*')
          .eq('owner_id', user.id)
          .eq('student_id', id)
          .order('measured_at', { ascending: false })
          .limit(40),
        supabase
          .from('nutrition_patient_followups')
          .select('*')
          .eq('owner_id', user.id)
          .eq('student_id', id)
          .maybeSingle(),
      ])

      if (studentError || docsError || noteError || measurementsError || followError) {
        toast.error(
          studentError?.message ??
            docsError?.message ??
            noteError?.message ??
            measurementsError?.message ??
            followError?.message ??
            'No se pudo cargar la carpeta',
        )
        setLoading(false)
        return
      }

      setStudent(studentData as Student)
      setDocuments((docsData as NutritionPatientDocument[]) ?? [])
      setMeasurements((measurementsData as NutritionMeasurement[]) ?? [])
      setPlanText(noteData?.content ?? '')
      setFollowup((followData as NutritionPatientFollowup) ?? null)
      setLoading(false)
    })()
  }, [id, user])

  async function uploadPdf(category: NutritionDocumentCategory, files: FileList | null) {
    if (!user || !id || !student || !files?.length) return
    const now = new Date()

    for (const file of Array.from(files)) {
      if (file.type !== 'application/pdf') {
        toast.error(`"${file.name}" no es PDF`)
        continue
      }

      const config = CATEGORIES.find((c) => c.key === category)
      if (!config) continue
      const safeName = buildSafePdfName(file.name)
      const originalLabel = buildOriginalLabel(file.name)
      const duplicateToken = `-${file.size}-${safeName}`
      const alreadyExists = documents.some(
        (d) => d.student_id === id && d.category === category && d.file_path.endsWith(duplicateToken)
      )
      if (alreadyExists) {
        toast.error(`"${file.name}" ya está cargado`)
        continue
      }

      const autoName = config.buildName(student.full_name, now, originalLabel)
      const path = `${user.id}/${id}/${category}/${Date.now()}-${file.size}-${safeName}`

      const { error: uploadError } = await supabase.storage.from('nutrition-files').upload(path, file, { upsert: false })
      if (uploadError) {
        toast.error(uploadError.message)
        continue
      }

      const { data: inserted, error: docError } = await supabase
        .from('nutrition_patient_documents')
        .insert({
          owner_id: user.id,
          student_id: id,
          category,
          title: autoName,
          file_path: path,
          document_date: now.toISOString().slice(0, 10),
        })
        .select('*')
        .single()

      if (docError) {
        toast.error(docError.message)
        continue
      }

      setDocuments((prev) => [inserted as NutritionPatientDocument, ...prev])
    }
  }

  function schedulePlanAutosave(next: string) {
    if (!user || !id) return
    if (planDebounceRef.current) {
      window.clearTimeout(planDebounceRef.current)
    }
    planDebounceRef.current = window.setTimeout(async () => {
      setSavingPlan(true)
      const { error } = await supabase
        .from('nutrition_plan_notes')
        .upsert({
          owner_id: user.id,
          student_id: id,
          content: next,
        }, { onConflict: 'owner_id,student_id' })
      setSavingPlan(false)
      if (error) toast.error(error.message)
    }, 700)
  }

  async function openDocument(path: string) {
    const { data, error } = await supabase.storage.from('nutrition-files').createSignedUrl(path, 120)
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? 'No se pudo abrir el archivo')
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  async function deleteDocument(doc: NutritionPatientDocument) {
    if (!user) return
    const ok = window.confirm(`¿Eliminar "${doc.title}"?`)
    if (!ok) return

    setDeletingDocId(doc.id)
    const { error: dbError } = await supabase
      .from('nutrition_patient_documents')
      .delete()
      .eq('id', doc.id)
      .eq('owner_id', user.id)

    if (dbError) {
      setDeletingDocId(null)
      toast.error(dbError.message)
      return
    }

    const { error: storageError } = await supabase.storage
      .from('nutrition-files')
      .remove([doc.file_path])

    if (storageError) {
      toast.error(`Archivo eliminado de la lista, pero no del storage: ${storageError.message}`)
    } else {
      toast.success('PDF eliminado')
    }

    setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
    setDeletingDocId(null)
  }

  async function saveMeasurement() {
    if (!user || !id) return
    setSavingMeasurement(true)
    const payload = {
      owner_id: user.id,
      student_id: id,
      measured_at: measurementForm.measured_at,
      weight_kg: toNullableNumber(measurementForm.weight_kg),
      bmi: toNullableNumber(measurementForm.bmi),
      body_fat_pct: toNullableNumber(measurementForm.body_fat_pct),
      muscle_mass_kg: toNullableNumber(measurementForm.muscle_mass_kg),
      perimeters_notes: measurementForm.perimeters_notes.trim() || null,
      skinfolds_notes: measurementForm.skinfolds_notes.trim() || null,
      notes: measurementForm.notes.trim() || null,
      measurement_number: null,
      height_cm: null,
      sitting_height_cm: null,
      detail: {} as Json,
    }

    const { error } = await supabase.from('nutrition_measurements').insert(payload)

    setSavingMeasurement(false)
    if (error) {
      toast.error(error.message)
      return
    }

    await refreshMeasurements()
    setMeasurementForm((prev) => ({
      ...prev,
      weight_kg: '',
      bmi: '',
      body_fat_pct: '',
      muscle_mass_kg: '',
      perimeters_notes: '',
      skinfolds_notes: '',
      notes: '',
    }))
    toast.success('Medición guardada')
  }

  async function handleExportEvolutionPdf() {
    if (!student) return
    const sorted = [...measurements].sort(
      (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime(),
    )
    if (sorted.length < 2) {
      toast.error('Necesitás al menos dos mediciones guardadas para comparar y armar el PDF.')
      return
    }
    const prev = sorted[sorted.length - 2]!
    const curr = sorted[sorted.length - 1]!
    const fromLabel = format(parseISO(prev.measured_at), 'dd/MM/yyyy')
    const toLabel = format(parseISO(curr.measured_at), 'dd/MM/yyyy')
    setPdfExporting(true)
    try {
      const rows = buildEvolutionPdfRows(prev, curr)
      const interpretation = buildPatientFacingInterpretation(
        student.full_name,
        prev,
        curr,
        fromLabel,
        toLabel,
        pdfTone,
      )
      const blob = await pdf(
        <NutritionEvolutionReportPdfDocument
          patientName={student.full_name}
          fromLabel={fromLabel}
          toLabel={toLabel}
          rows={rows}
          interpretation={interpretation}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `evolucion-${slugify(student.full_name).slice(0, 40) || 'paciente'}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF generado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF')
    } finally {
      setPdfExporting(false)
    }
  }

  const docsByCategory = useMemo(() => {
    const map = {
      antropometria: [] as NutritionPatientDocument[],
      anamnesis: [] as NutritionPatientDocument[],
      laboratorio: [] as NutritionPatientDocument[],
    }
    for (const doc of documents) {
      if (doc.category in map) {
        map[doc.category as NutritionDocumentCategory].push(doc)
      }
    }
    return map
  }, [documents])

  const filteredDocs = useMemo(() => {
    if (fileFilter === 'all') return documents
    return documents.filter((d) => d.category === fileFilter)
  }, [documents, fileFilter])

  const tabs: TabItem[] = useMemo(
    () => [
      { id: 'resumen', label: 'Resumen', icon: <LayoutDashboard /> },
      { id: 'datos', label: 'Datos personales', icon: <UserRound /> },
      { id: 'antropometria', label: 'Antropometría', icon: <Activity />, count: measurements.length || undefined },
      { id: 'plan', label: 'Plan', icon: <Utensils /> },
      { id: 'historia', label: 'Historia', icon: <ClipboardList /> },
      { id: 'archivos', label: 'Archivos', icon: <FolderOpen />, count: documents.length || undefined },
    ],
    [documents.length, measurements.length],
  )

  if (loading) {
    return (
      <div>
        <Header title="Carpeta nutricional" showBack />
        <div className="flex justify-center py-16">
          <Spinner size="lg" accent="trainerCta" />
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div>
        <Header title="Carpeta nutricional" showBack />
        <p className="px-6 py-8 text-ink-muted">Paciente no encontrado.</p>
      </div>
    )
  }

  return (
    <div>
      <Header
        title={`Carpeta · ${student.full_name}`}
        showBack
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
              <span className="hidden md:inline">Tono:</span>
              <select
                value={pdfTone}
                onChange={(e) => setPdfTone(e.target.value as InterpretationTone)}
                className="rounded-lg bg-surface-card border border-surface-border/80 text-ink-primary px-2 py-1.5 text-xs focus:outline-none focus:border-brand-primary"
                title="Tono del texto de devolución en el PDF"
              >
                {(Object.keys(TONE_LABELS) as InterpretationTone[]).map((t) => (
                  <option key={t} value={t}>
                    {TONE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              loading={pdfExporting}
              disabled={measurements.length < 2}
              title={
                measurements.length < 2
                  ? 'Necesitás al menos dos mediciones guardadas para comparar evolución en el PDF'
                  : 'Descargar PDF de evolución entre los dos últimos controles'
              }
              onClick={() => void handleExportEvolutionPdf()}
            >
              PDF evolución
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => navigate('/nutrition-pdfs')}
            >
              Comparar 2 PDFs
            </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-6 pt-4 pb-2">
        <div className="sticky top-14 sm:top-16 z-20 -mx-4 px-4 lg:-mx-6 lg:px-6 py-2.5 bg-surface-base/95 backdrop-blur-md border-y border-surface-border/60">
          <Tabs
            tabs={tabs}
            active={activeTab}
            onChange={handleTabChange}
            ariaLabel="Secciones de la carpeta nutricional"
          />
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-8 space-y-6">
        {/* ───────────── RESUMEN ───────────── */}
        <TabPanel id="resumen" active={activeTab}>
          <NutritionResumenDashboard
            measurements={measurements}
            followup={followup}
            onGoToTab={handleTabChange}
            onManageAppointments={() => navigate('/appointments')}
          />
        </TabPanel>

        {/* ───────────── DATOS PERSONALES ───────────── */}
        <TabPanel id="datos" active={activeTab}>
          {user ? (
            <NutritionPatientPersonalDataSection
              student={student}
              ownerId={user.id}
              onUpdated={(next) => setStudent(next)}
            />
          ) : null}
        </TabPanel>

        {/* ───────────── ANTROPOMETRÍA ───────────── */}
        <TabPanel id="antropometria" active={activeTab}>
          <div className="space-y-6">
            <div className="grid xl:grid-cols-2 gap-6">
              <Card>
                <CardTitle className="mb-1">Programa de antropometría</CardTitle>
                <p className="text-sm text-ink-muted mb-4">
                  Cargá las 5 mediciones por variable; la app calcula la mediana y el % error técnico (TE).
                </p>
                {user ? (
                  <NutritionAnthropometryProgramForm
                    ownerId={user.id}
                    studentId={student.id}
                    onSaved={() => refreshMeasurements()}
                  />
                ) : null}
              </Card>

              <Card>
                <CardTitle className="mb-1">Evolución y gráficos</CardTitle>
                <p className="text-sm text-ink-muted mb-4">
                  Peso, cintura y % grasa a lo largo del tiempo.
                </p>
                <NutritionMeasurementCharts measurements={measurements} />
              </Card>
            </div>

            <Card>
              <NutritionAnthropometryPresentationPanel
                patientName={student.full_name}
                measurements={measurements}
              />
            </Card>

            <details className="group rounded-2xl border border-surface-border/80 bg-surface-card overflow-hidden">
              <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 select-none hover:bg-surface-elevated/30 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-ink-primary">Medición rápida (modo express)</span>
                  <span className="text-xs text-ink-muted">
                    Solo si ya tenés los valores finales y querés saltearte el programa completo de Holway
                  </span>
                </div>
                <span className="shrink-0 text-xs px-2 py-1 rounded-md bg-surface-elevated text-ink-muted group-open:hidden">
                  Mostrar
                </span>
                <span className="shrink-0 text-xs px-2 py-1 rounded-md bg-surface-elevated text-ink-muted hidden group-open:inline">
                  Ocultar
                </span>
              </summary>
              <div className="px-4 pb-4 border-t border-surface-border/60 pt-4">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-xs text-ink-secondary">
                  Fecha
                  <input
                    type="date"
                    value={measurementForm.measured_at}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, measured_at: e.target.value }))}
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary">
                  Peso (kg)
                  <input
                    type="text"
                    value={measurementForm.weight_kg}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, weight_kg: e.target.value }))}
                    placeholder="Ej: 78.4"
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary">
                  IMC
                  <input
                    type="text"
                    value={measurementForm.bmi}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, bmi: e.target.value }))}
                    placeholder="Ej: 24.9"
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary">
                  % Grasa
                  <input
                    type="text"
                    value={measurementForm.body_fat_pct}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, body_fat_pct: e.target.value }))}
                    placeholder="Ej: 21.3"
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary md:col-span-2">
                  Masa muscular (kg)
                  <input
                    type="text"
                    value={measurementForm.muscle_mass_kg}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, muscle_mass_kg: e.target.value }))}
                    placeholder="Ej: 32.1"
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary md:col-span-2">
                  Perímetros (texto libre)
                  <textarea
                    value={measurementForm.perimeters_notes}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, perimeters_notes: e.target.value }))}
                    rows={3}
                    placeholder="Ej: Cintura 82 cm, Cadera 98 cm, Brazo 31 cm..."
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary md:col-span-2">
                  Pliegues (texto libre)
                  <textarea
                    value={measurementForm.skinfolds_notes}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, skinfolds_notes: e.target.value }))}
                    rows={3}
                    placeholder="Ej: Tricipital 12 mm, Subescapular 14 mm..."
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
                <label className="text-xs text-ink-secondary md:col-span-2">
                  Observaciones
                  <textarea
                    value={measurementForm.notes}
                    onChange={(e) => setMeasurementForm((prev) => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Comentario clínico breve..."
                    className="mt-1 w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary px-3 py-2.5 focus:outline-none focus:border-brand-primary"
                  />
                </label>
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={saveMeasurement} loading={savingMeasurement}>
                  Guardar medición
                </Button>
              </div>

              <div className="mt-6 border-t border-surface-border pt-5">
                <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">
                  Historial de mediciones
                </p>
                <div className="space-y-2">
                  {measurements.slice(0, 12).map((m) => (
                    <div key={m.id} className="rounded-xl border border-surface-border px-3 py-2 bg-surface-elevated">
                      <p className="text-xs font-semibold text-ink-primary">
                        {format(new Date(m.measured_at), 'dd/MM/yyyy')}
                        {m.measurement_number != null ? ` · Medición n° ${m.measurement_number}` : ''}
                      </p>
                      <p className="text-xs text-ink-secondary mt-1">
                        Peso: {m.weight_kg ?? '—'} kg
                        {m.height_cm != null ? ` · Talla: ${m.height_cm} cm` : ''}
                        {m.sitting_height_cm != null ? ` · Talla sentado: ${m.sitting_height_cm} cm` : ''} · IMC: {m.bmi ?? '—'} · % Grasa:{' '}
                        {m.body_fat_pct ?? '—'} · Masa muscular: {m.muscle_mass_kg ?? '—'} kg
                      </p>
                      {m.perimeters_notes && <p className="text-xs text-ink-muted mt-1">Perímetros: {m.perimeters_notes}</p>}
                      {m.skinfolds_notes && <p className="text-xs text-ink-muted mt-1">Pliegues: {m.skinfolds_notes}</p>}
                      {m.notes && <p className="text-xs text-ink-muted mt-1">Nota: {m.notes}</p>}
                    </div>
                  ))}
                  {measurements.length === 0 && (
                    <p className="text-sm text-ink-muted">Todavía no hay mediciones cargadas.</p>
                  )}
                </div>
              </div>
              </div>
            </details>
          </div>
        </TabPanel>

        {/* ───────────── PLAN ───────────── */}
        <TabPanel id="plan" active={activeTab}>
          <div className="space-y-6">
            <Card>
              <CardTitle className="mb-1">Plan de alimentación</CardTitle>
              <p className="text-sm text-ink-muted mb-4">
                Plan semanal por columnas con exportación a PDF moderno.
              </p>
              <NutritionWeeklyPlanSection student={student} measurements={measurements} />
              <div className="border-t border-surface-border pt-6 mt-8 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink-primary">Notas libres complementarias</span>
                  <span className="text-xs text-ink-muted">{savingPlan ? 'Guardando...' : 'Guardado automático'}</span>
                </div>
                <textarea
                  value={planText}
                  onChange={(e) => {
                    const next = e.target.value
                    setPlanText(next)
                    schedulePlanAutosave(next)
                  }}
                  rows={10}
                  placeholder="Recordatorios, generalidades que no están en la grilla, comunicación informal al paciente…"
                  className="w-full rounded-xl bg-surface-input border border-surface-inputBorder text-ink-primary placeholder:text-ink-muted px-3 py-2.5 focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <NutritionRequirementsCalculatorCard student={student} />
              <Card>
                <NutritionExchangeReferenceCard />
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ───────────── HISTORIA ───────────── */}
        <TabPanel id="historia" active={activeTab}>
          <div className="space-y-6">
            <Card>
              <CardTitle className="mb-1">Anamnesis alimentaria</CardTitle>
              <p className="text-sm text-ink-muted mb-4">Formulario digital de la primera consulta.</p>
              <NutritionAnamnesisSection studentId={student.id} />
            </Card>

            <Card>
              <CardTitle className="mb-1">Historial clínico</CardTitle>
              <p className="text-sm text-ink-muted mb-4">Notas fechadas por consulta.</p>
              {user ? <NutritionClinicalNotesSection ownerId={user.id} studentId={student.id} /> : null}
            </Card>

            <Card>
              <CardTitle className="mb-1">Síntomas digestivos y adherencia</CardTitle>
              <p className="text-sm text-ink-muted mb-4">Registro breve entre consultas.</p>
              {user ? <NutritionSymptomCheckinsSection ownerId={user.id} studentId={student.id} /> : null}
            </Card>
          </div>
        </TabPanel>

        {/* ───────────── ARCHIVOS ───────────── */}
        <TabPanel id="archivos" active={activeTab}>
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <CardTitle>Archivos del paciente</CardTitle>
                <p className="text-sm text-ink-muted mt-1">
                  Antropometrías, anamnesis y laboratorios en un solo lugar.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {CATEGORIES.map((cat) => (
                  <label
                    key={cat.key}
                    className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg border border-dashed border-surface-border hover:border-brand-primary/50 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {cat.uploadLabel}
                    <input
                      type="file"
                      accept="application/pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => uploadPdf(cat.key, e.target.files)}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {FILE_FILTERS.map((f) => {
                const isActive = fileFilter === f.id
                const count =
                  f.id === 'all'
                    ? documents.length
                    : docsByCategory[f.id].length
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFileFilter(f.id)}
                    className={
                      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ' +
                      (isActive
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'border border-surface-border/70 text-ink-secondary hover:bg-surface-elevated/60 hover:text-ink-primary')
                    }
                  >
                    {f.label}
                    <span
                      className={
                        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums ' +
                        (isActive
                          ? 'bg-emerald-500/25 text-emerald-700 dark:text-emerald-200'
                          : 'bg-surface-elevated text-ink-muted')
                      }
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="space-y-2">
              {filteredDocs.map((doc) => {
                const cat = CATEGORIES.find((c) => c.key === doc.category)
                return (
                  <div
                    key={doc.id}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors"
                  >
                    <button onClick={() => openDocument(doc.file_path)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-primary truncate">{doc.title}</p>
                          <p className="text-xs text-ink-muted capitalize">
                            {cat ? cat.title : doc.category} · {monthLabel(doc.document_date)}
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-ink-muted hidden sm:inline">Abrir PDF</span>
                      <button
                        type="button"
                        onClick={() => deleteDocument(doc)}
                        disabled={deletingDocId === doc.id}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-status-expired hover:bg-status-expired/10 transition-colors disabled:opacity-40"
                        title="Eliminar PDF"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {filteredDocs.length === 0 && (
                <p className="text-sm text-ink-muted py-3">
                  {fileFilter === 'all'
                    ? 'Todavía no hay archivos cargados. Subí un PDF con los botones de arriba.'
                    : (CATEGORIES.find((c) => c.key === fileFilter)?.emptyLabel ?? 'Sin archivos en esta categoría.')}
                </p>
              )}
            </div>
          </Card>
        </TabPanel>
      </div>
    </div>
  )
}
