import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { pdf } from '@react-pdf/renderer'
import { Download, FileText, Upload, Sparkles, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { NutritionAnamnesisSection } from '@/components/nutrition/NutritionAnamnesisSection'
import { NutritionWeeklyPlanSection } from '@/components/nutrition/NutritionWeeklyPlanSection'
import { NutritionAnthropometryProgramForm } from '@/components/nutrition/NutritionAnthropometryProgramForm'
import { NutritionAnthropometryPresentationPanel } from '@/components/nutrition/NutritionAnthropometryPresentationPanel'
import { NutritionMeasurementCharts } from '@/components/nutrition/NutritionMeasurementCharts'
import { NutritionClinicalNotesSection } from '@/components/nutrition/NutritionClinicalNotesSection'
import { NutritionSymptomCheckinsSection } from '@/components/nutrition/NutritionSymptomCheckinsSection'
import { NutritionRequirementsCalculatorCard } from '@/components/nutrition/NutritionRequirementsCalculatorCard'
import { NutritionExchangeReferenceCard } from '@/components/nutrition/NutritionExchangeReferenceCard'
import { NutritionFolderSectionNav } from '@/components/nutrition/NutritionFolderSectionNav'
import { NutritionEvolutionReportPdfDocument } from '@/lib/pdf/NutritionEvolutionReportPdfDocument'
import {
  buildEvolutionPdfRows,
  buildPatientFacingInterpretation,
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
  buildName: (patientName: string, date: Date, originalFileName: string) => string
}

const CATEGORIES: DocCategoryConfig[] = [
  {
    key: 'antropometria',
    title: 'Antropometrías',
    buildName: (_name, date, originalFileName) =>
      `Antropometría ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
  {
    key: 'anamnesis',
    title: 'Anamnesis alimentaria',
    buildName: (name, date, originalFileName) =>
      `Anamnesis de ${name} ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
  {
    key: 'laboratorio',
    title: 'Laboratorios y estudios',
    buildName: (name, date, originalFileName) =>
      `Estudio · ${name} · ${originalFileName} ${format(date, 'MM-yyyy')}`,
  },
]

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
  const planDebounceRef = useRef<number | null>(null)

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
      const interpretation = buildPatientFacingInterpretation(student.full_name, prev, curr, fromLabel, toLabel)
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

  const antropometrias = useMemo(
    () => documents.filter((d) => d.category === 'antropometria'),
    [documents]
  )
  const anamnesis = useMemo(
    () => documents.filter((d) => d.category === 'anamnesis'),
    [documents]
  )
  const laboratorios = useMemo(
    () => documents.filter((d) => d.category === 'laboratorio'),
    [documents]
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

      {followup?.next_consultation_date ? (
        <div className="mx-4 lg:mx-6 mt-4 rounded-xl border border-surface-border bg-surface-elevated/50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-ink-secondary">
            Próxima consulta:{' '}
            <span className="font-semibold text-ink-primary capitalize">
              {format(parseISO(followup.next_consultation_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </span>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => navigate('/appointments')}>
            Gestionar turnos
          </Button>
        </div>
      ) : null}

      <div className="px-4 lg:px-6 pt-4 pb-2 space-y-3">
        <p className="text-sm text-ink-secondary leading-relaxed max-w-3xl">
          La carpeta sigue el orden de una consulta: medición → tabla de presentación → cálculos → archivos PDF → historia
          clínica → anamnesis → registro rápido → plan. Usá los{' '}
          <strong className="font-medium text-ink-primary">accesos rápidos</strong> (se mantienen visibles al bajar) para
          saltar de sección.
        </p>
        <div className="sticky top-14 sm:top-16 z-20 -mx-4 px-4 lg:-mx-6 lg:px-6 py-2.5 bg-surface-base/95 backdrop-blur-md border-y border-surface-border/60">
          <NutritionFolderSectionNav />
        </div>
      </div>

      <div className="px-4 lg:px-6 pb-8 space-y-6">
        <section id="nutrition-seccion-control" className="scroll-mt-32 space-y-6">
        <div className="grid xl:grid-cols-2 gap-6">
          <Card>
            <CardTitle className="mb-1">Programa de antropometría (plantilla Excel)</CardTitle>
            <p className="text-sm text-ink-muted mb-4">
              Cargá las 5 mediciones por variable; la app calcula la <strong className="font-medium text-ink-secondary">mediana</strong> y el{' '}
              <strong className="font-medium text-ink-secondary">% error técnico (TE)</strong> para el valor ajustado. Al guardar, queda un
              control en el historial del paciente (sirve para gráficos y presentación).
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
              Peso, cintura (desde medianas del programa) y % grasa desde la <strong className="font-medium text-ink-secondary">medición rápida</strong> o
              resúmenes del control. El botón <strong className="font-medium text-ink-secondary">PDF evolución</strong> del encabezado usa los dos últimos
              registros del historial.
            </p>
            <NutritionMeasurementCharts measurements={measurements} />
          </Card>
        </div>
        </section>

        <section id="nutrition-seccion-presentacion" className="scroll-mt-32">
        <Card>
          <NutritionAnthropometryPresentationPanel patientName={student.full_name} measurements={measurements} />
        </Card>
        </section>

        <section id="nutrition-seccion-requerimientos" className="scroll-mt-32 space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <NutritionRequirementsCalculatorCard student={student} />
          <Card>
            <NutritionExchangeReferenceCard />
          </Card>
        </div>
        </section>

        <section id="nutrition-seccion-pdfs" className="scroll-mt-32 space-y-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>{CATEGORIES[0].title}</CardTitle>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg border border-dashed border-surface-border hover:border-brand-primary/50 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Subir PDF(s)
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => uploadPdf('antropometria', e.target.files)}
              />
            </label>
          </div>
          <div className="space-y-2">
            {antropometrias.map((doc) => (
              <div
                key={doc.id}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors"
              >
                <button onClick={() => openDocument(doc.file_path)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{doc.title}</p>
                      <p className="text-xs text-ink-muted capitalize">{monthLabel(doc.document_date)}</p>
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
            ))}
            {antropometrias.length === 0 && (
              <p className="text-sm text-ink-muted py-2">Todavía no hay archivos en esta sección.</p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Laboratorios y estudios (PDF)</CardTitle>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg border border-dashed border-surface-border hover:border-brand-primary/50 transition-colors">
              <Upload className="h-3.5 w-3.5" />
              Subir PDF(s)
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => uploadPdf('laboratorio', e.target.files)}
              />
            </label>
          </div>
          <div className="space-y-2">
            {laboratorios.map((doc) => (
              <div
                key={doc.id}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors"
              >
                <button type="button" onClick={() => openDocument(doc.file_path)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-primary truncate">{doc.title}</p>
                      <p className="text-xs text-ink-muted capitalize">{monthLabel(doc.document_date)}</p>
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
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
            ))}
            {laboratorios.length === 0 && (
              <p className="text-sm text-ink-muted py-2">Subí estudios de laboratorio u otros informes en PDF.</p>
            )}
          </div>
        </Card>
        </section>

        <section id="nutrition-seccion-historia" className="scroll-mt-32 space-y-6">
        <Card>
          <CardTitle className="mb-1">Historial clínico nutricional</CardTitle>
          <p className="text-sm text-ink-muted mb-4">Notas fechadas por consulta (independiente del plan semanal).</p>
          {user ? <NutritionClinicalNotesSection ownerId={user.id} studentId={student.id} /> : null}
        </Card>

        <Card>
          <CardTitle className="mb-1">Síntomas digestivos y adherencia</CardTitle>
          <p className="text-sm text-ink-muted mb-4">Registro breve entre consultas.</p>
          {user ? <NutritionSymptomCheckinsSection ownerId={user.id} studentId={student.id} /> : null}
        </Card>
        </section>

        <section id="nutrition-seccion-anamnesis" className="scroll-mt-32">
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <CardTitle>Anamnesis alimentaria</CardTitle>
              <p className="text-sm text-ink-muted mt-1">Formulario digital y PDFs de respaldo.</p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs px-3 py-2 rounded-lg border border-dashed border-surface-border hover:border-brand-primary/50 transition-colors shrink-0">
              <Upload className="h-3.5 w-3.5" />
              Subir PDF(s)
              <input
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={(e) => uploadPdf('anamnesis', e.target.files)}
              />
            </label>
          </div>
          <NutritionAnamnesisSection studentId={student.id} />
          <div className="border-t border-surface-border mt-8 pt-6">
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">PDFs adjuntos</p>
            <div className="space-y-2">
              {anamnesis.map((doc) => (
                <div
                  key={doc.id}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors"
                >
                  <button onClick={() => openDocument(doc.file_path)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">{doc.title}</p>
                        <p className="text-xs text-ink-muted capitalize">{monthLabel(doc.document_date)}</p>
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
              ))}
              {anamnesis.length === 0 && (
                <p className="text-sm text-ink-muted py-2">Todavía no hay PDFs en esta carpeta.</p>
              )}
            </div>
          </div>
        </Card>
        </section>

        <section id="nutrition-seccion-mediciones" className="scroll-mt-32">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle>Mediciones manuales</CardTitle>
            <span className="text-xs text-ink-muted">Historial por fecha</span>
          </div>
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

          <div className="mt-4 space-y-2">
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
              <p className="text-sm text-ink-muted">Todavía no hay mediciones manuales cargadas.</p>
            )}
          </div>
        </Card>
        </section>

        <section id="nutrition-seccion-plan" className="scroll-mt-32">
        <Card>
          <div className="mb-4">
            <CardTitle className="mb-1">Plan de alimentación</CardTitle>
            <p className="text-sm text-ink-muted">
              Plan semanal por columnas con exportación a PDF moderno (formato habitual lun–vie + finde unificado opcional).
            </p>
          </div>
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
        </section>
      </div>
    </div>
  )
}
