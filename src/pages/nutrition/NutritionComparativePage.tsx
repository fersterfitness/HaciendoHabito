import { useEffect, useMemo, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { Check, Download, FileText, Sparkles, Upload, Users } from 'lucide-react'
import { Kpi3dIcon } from '@/components/icons/kpi3dIcons'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { Button } from '@/components/ui/Button'
import { directoryToolbarBtnClassName } from '@/lib/primaryGradientCtaClasses'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate, slugify } from '@/lib/utils'
import type { Student, NutritionPatientDocument, NutritionMeasurement } from '@/types/database'
import { defaultBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import { NutritionComparativePdfDocument } from '@/lib/pdf/NutritionComparativePdfDocument'
import {
  buildComparativeNarrative,
  compareAnthropometry,
  compareManualMeasurements,
  extractPdfTextFromUrl,
  parseAnthropometry,
  type AnthropometryComparison,
} from '@/lib/nutrition/anthropometryParser'
import toast from 'react-hot-toast'
import { useSearchParams } from 'react-router-dom'
import { IS_V2 } from '@/lib/uiVersion'
import { v2TabClass } from '@/components/v2/tabStyle'

function buildSafePdfName(fileName: string): string {
  const clean = fileName.replace(/\.pdf$/i, '')
  return `${slugify(clean)}.pdf`
}

function buildOriginalLabel(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim()
}

const panelClassName = IS_V2
  ? 'rounded-2xl border border-surface-border/60 bg-surface-card overflow-hidden'
  : 'rounded-2xl border border-surface-border/80 bg-surface-card shadow-card overflow-hidden'

/** Encabezado de cada panel: en la v2 sin franja gris. */
const panelHeadClassName = IS_V2
  ? 'border-b border-surface-border/60 px-5 py-4'
  : 'border-b border-surface-border/70 bg-surface-elevated/30 px-4 py-3 sm:px-5'

const fieldSelectClassName = cn(
  'w-full h-10 rounded-xl border border-surface-border bg-surface-input px-3 text-sm text-ink-primary',
  'outline-none transition-colors focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20',
)

const fieldTextareaClassName = cn(
  'w-full min-h-[10rem] rounded-xl border border-surface-border bg-surface-input px-3 py-2.5 text-sm leading-relaxed text-ink-primary',
  'outline-none transition-colors focus:border-brand-secondary/50 focus:ring-2 focus:ring-brand-secondary/20',
)

function deltaToneClass(delta: string): string {
  const t = delta.trim()
  if (t.startsWith('+')) return 'text-status-generated'
  if (t.startsWith('-')) return 'text-status-expired'
  return 'text-ink-muted'
}

export function NutritionComparativePage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pdf' | 'manual'>('pdf')
  const [students, setStudents] = useState<Student[]>([])
  const [docs, setDocs] = useState<NutritionPatientDocument[]>([])
  const [measurements, setMeasurements] = useState<NutritionMeasurement[]>([])
  // `?student=<id>`: abierto desde la ficha del paciente → ya elegido.
  const [searchParams] = useSearchParams()
  const [studentId, setStudentId] = useState(() => searchParams.get('student') ?? '')
  const [fromDocId, setFromDocId] = useState('')
  const [toDocId, setToDocId] = useState('')
  const [fromMeasurementId, setFromMeasurementId] = useState('')
  const [toMeasurementId, setToMeasurementId] = useState('')
  const [comparison, setComparison] = useState<AnthropometryComparison | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const uploadInputRef = useRef<HTMLInputElement | null>(null)
  const [interpretation, setInterpretation] = useState(
    'Comparando ambos controles se observan cambios clínicamente relevantes. La evolución debe interpretarse junto con adherencia, síntomas y contexto del paciente, priorizando un acompañamiento empático y objetivos sostenibles.'
  )
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: stData, error: stErr }, { data: dData, error: dErr }, { data: mData, error: mErr }] = await Promise.all([
        fetchAccessibleStudents(),
        supabase
          .from('nutrition_patient_documents')
          .select('*')
          .eq('owner_id', user.id)
          .eq('category', 'antropometria')
          .order('document_date', { ascending: false }),
        supabase
          .from('nutrition_measurements')
          .select('*')
          .eq('owner_id', user.id)
          .order('measured_at', { ascending: false }),
      ])
      if (stErr || dErr || mErr) {
        toast.error(stErr ?? dErr?.message ?? mErr?.message ?? 'No se pudieron cargar datos')
      } else {
        setStudents(stData ?? [])
        setDocs((dData as NutritionPatientDocument[]) ?? [])
        setMeasurements((mData as NutritionMeasurement[]) ?? [])
      }
      setLoading(false)
    })()
  }, [user])

  const patientDocs = useMemo(
    () => docs.filter((d) => d.student_id === studentId),
    [docs, studentId]
  )
  const patientMeasurements = useMemo(
    () => measurements.filter((m) => m.student_id === studentId),
    [measurements, studentId]
  )

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId),
    [students, studentId],
  )

  async function uploadAnthropometryPdfs(files: FileList | null) {
    if (!user || !studentId || !files?.length) {
      toast.error('Primero seleccioná paciente')
      return
    }

    const patient = students.find((s) => s.id === studentId)
    if (!patient) return

    setUploading(true)
    try {
      const insertedRows: NutritionPatientDocument[] = []
      for (const file of Array.from(files)) {
        if (file.type !== 'application/pdf') continue
        const now = new Date()
        const safeName = buildSafePdfName(file.name)
        const originalLabel = buildOriginalLabel(file.name)
        const duplicateToken = `-${file.size}-${safeName}`
        const alreadyExists = docs.some(
          (d) => d.student_id === studentId && d.category === 'antropometria' && d.file_path.endsWith(duplicateToken)
        )
        if (alreadyExists) {
          toast.error(`"${file.name}" ya está cargado`)
          continue
        }

        const title = `Antropometría ${originalLabel} ${now.toLocaleDateString('es-AR', { month: '2-digit', year: 'numeric' }).replace('/', '-')}`
        const path = `${user.id}/${studentId}/antropometria/${Date.now()}-${file.size}-${safeName}`

        const { error: uploadError } = await supabase.storage.from('nutrition-files').upload(path, file, { upsert: false })
        if (uploadError) throw uploadError

        const { data: inserted, error: insertError } = await supabase
          .from('nutrition_patient_documents')
          .insert({
            owner_id: user.id,
            student_id: studentId,
            category: 'antropometria',
            title,
            file_path: path,
            document_date: now.toISOString().slice(0, 10),
          })
          .select('*')
          .single()
        if (insertError) throw insertError
        insertedRows.push(inserted as NutritionPatientDocument)
      }

      if (insertedRows.length > 0) {
        setDocs((prev) => [...insertedRows, ...prev])
        toast.success('PDF(s) cargado(s) correctamente')
      } else {
        toast.error('Solo se permiten archivos PDF')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron subir los PDFs')
    } finally {
      setUploading(false)
    }
  }

  function handleOpenUploadPicker() {
    if (!studentId) {
      toast.error('Primero seleccioná paciente')
      return
    }
    uploadInputRef.current?.click()
  }

  const diffRows = useMemo(() => {
    if (!comparison) return []
    const rows: Array<{ label: string; from: string; to: string; delta: string }> = []
    const formatValue = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${n.toFixed(2)} ${unit}`)
    const formatDelta = (n: number | undefined, unit: string) => (n === undefined ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)} ${unit}`)

    rows.push({
      label: 'Peso',
      from: formatValue(comparison.general.weightKg.from, 'kg'),
      to: formatValue(comparison.general.weightKg.to, 'kg'),
      delta: formatDelta(comparison.general.weightKg.delta, 'kg'),
    })
    rows.push({
      label: 'IMC',
      from: formatValue(comparison.general.bmi.from, ''),
      to: formatValue(comparison.general.bmi.to, ''),
      delta: formatDelta(comparison.general.bmi.delta, ''),
    })
    rows.push({
      label: '% Grasa',
      from: formatValue(comparison.general.bodyFatPct.from, '%'),
      to: formatValue(comparison.general.bodyFatPct.to, '%'),
      delta: formatDelta(comparison.general.bodyFatPct.delta, '%'),
    })
    rows.push({
      label: 'Masa muscular',
      from: formatValue(comparison.general.muscleMassKg.from, 'kg'),
      to: formatValue(comparison.general.muscleMassKg.to, 'kg'),
      delta: formatDelta(comparison.general.muscleMassKg.delta, 'kg'),
    })

    comparison.perimeters.slice(0, 6).forEach((p) => {
      rows.push({
        label: `Perímetro: ${p.label}`,
        from: `${p.from.toFixed(2)} cm`,
        to: `${p.to.toFixed(2)} cm`,
        delta: `${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)} cm`,
      })
    })
    comparison.skinfolds.slice(0, 6).forEach((p) => {
      rows.push({
        label: `Pliegue: ${p.label}`,
        from: `${p.from.toFixed(2)} mm`,
        to: `${p.to.toFixed(2)} mm`,
        delta: `${p.delta > 0 ? '+' : ''}${p.delta.toFixed(2)} mm`,
      })
    })

    return rows
  }, [comparison])

  const step1Done = Boolean(studentId)
  const step2Done =
    mode === 'pdf'
      ? Boolean(fromDocId && toDocId)
      : Boolean(fromMeasurementId && toMeasurementId)
  const step3Done = diffRows.length > 0
  const canAnalyze = step1Done && step2Done

  async function runAutomaticAnalysis() {
    if (!studentId) {
      toast.error('Seleccioná paciente')
      return
    }
    const patient = students.find((s) => s.id === studentId)
    if (!patient) return

    setAnalyzing(true)
    try {
      let compared: AnthropometryComparison
      if (mode === 'pdf') {
        if (!fromDocId || !toDocId) {
          toast.error('Seleccioná dos PDFs de antropometría')
          setAnalyzing(false)
          return
        }
        const fromDoc = docs.find((d) => d.id === fromDocId)
        const toDoc = docs.find((d) => d.id === toDocId)
        if (!fromDoc || !toDoc) {
          setAnalyzing(false)
          return
        }

        const [{ data: fromSigned }, { data: toSigned }] = await Promise.all([
          supabase.storage.from('nutrition-files').createSignedUrl(fromDoc.file_path, 120),
          supabase.storage.from('nutrition-files').createSignedUrl(toDoc.file_path, 120),
        ])
        if (!fromSigned?.signedUrl || !toSigned?.signedUrl) {
          throw new Error('No se pudieron abrir los PDFs para análisis')
        }

        const [fromText, toText] = await Promise.all([
          extractPdfTextFromUrl(fromSigned.signedUrl),
          extractPdfTextFromUrl(toSigned.signedUrl),
        ])

        const fromParsed = parseAnthropometry(fromText)
        const toParsed = parseAnthropometry(toText)
        compared = compareAnthropometry(fromParsed, toParsed)
      } else {
        if (!fromMeasurementId || !toMeasurementId) {
          toast.error('Seleccioná dos mediciones manuales')
          setAnalyzing(false)
          return
        }
        const fromMeasurement = measurements.find((m) => m.id === fromMeasurementId)
        const toMeasurement = measurements.find((m) => m.id === toMeasurementId)
        if (!fromMeasurement || !toMeasurement) {
          setAnalyzing(false)
          return
        }

        compared = compareManualMeasurements(
          {
            weightKg: fromMeasurement.weight_kg,
            bmi: fromMeasurement.bmi,
            bodyFatPct: fromMeasurement.body_fat_pct,
            muscleMassKg: fromMeasurement.muscle_mass_kg,
            perimetersNotes: fromMeasurement.perimeters_notes,
            skinfoldsNotes: fromMeasurement.skinfolds_notes,
          },
          {
            weightKg: toMeasurement.weight_kg,
            bmi: toMeasurement.bmi,
            bodyFatPct: toMeasurement.body_fat_pct,
            muscleMassKg: toMeasurement.muscle_mass_kg,
            perimetersNotes: toMeasurement.perimeters_notes,
            skinfoldsNotes: toMeasurement.skinfolds_notes,
          }
        )
      }

      setComparison(compared)
      setInterpretation(buildComparativeNarrative(patient.full_name, compared))
      toast.success('Análisis automático generado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo analizar el PDF')
    } finally {
      setAnalyzing(false)
    }
  }

  async function generatePdf() {
    if (!studentId) {
      toast.error('Seleccioná paciente')
      return
    }
    const patient = students.find((s) => s.id === studentId)
    if (!patient) return

    let fromLabel = ''
    let toLabel = ''
    if (mode === 'pdf') {
      if (!fromDocId || !toDocId) {
        toast.error('Seleccioná dos PDFs de antropometría')
        return
      }
      const fromDoc = docs.find((d) => d.id === fromDocId)
      const toDoc = docs.find((d) => d.id === toDocId)
      if (!fromDoc || !toDoc) return
      fromLabel = fromDoc.title
      toLabel = toDoc.title
    } else {
      if (!fromMeasurementId || !toMeasurementId) {
        toast.error('Seleccioná dos mediciones manuales')
        return
      }
      const fromMeasurement = measurements.find((m) => m.id === fromMeasurementId)
      const toMeasurement = measurements.find((m) => m.id === toMeasurementId)
      if (!fromMeasurement || !toMeasurement) return
      fromLabel = `Medición ${fromMeasurement.measured_at}`
      toLabel = `Medición ${toMeasurement.measured_at}`
    }

    setGenerating(true)
    try {
      const blob = await pdf(
        <NutritionComparativePdfDocument
          patientName={patient.full_name}
          fromLabel={fromLabel}
          toLabel={toLabel}
          differences={diffRows}
          interpretation={interpretation}
          brandLogoSrc={defaultBrandLogoSrc()}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostico-comparativo-${patient.full_name.replace(/\s+/g, '-').toLowerCase()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF generado y descargado')
    } catch {
      toast.error('No se pudo generar el PDF')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Diagnóstico comparativo" showBack />
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </div>
    )
  }

  return (
    <div className="min-h-0 pb-8">
      <Header title="Diagnóstico comparativo" showBack />

      <DirectoryPageShell className="max-w-6xl space-y-6">
        {IS_V2 ? (
          <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-ink-primary">Diagnóstico comparativo</h1>
              <p className="mt-1 max-w-xl text-sm text-ink-muted">
                Elegí el paciente y dos controles; armamos la comparación y la devolución para descargar en PDF.
              </p>
            </div>
            <WorkflowProgress
              steps={[
                { label: 'Paciente', done: step1Done },
                { label: 'Controles', done: step2Done },
                { label: 'Análisis', done: step3Done },
              ]}
            />
          </header>
        ) : (
        <header
          className={cn(
            'relative overflow-hidden rounded-2xl border border-brand-secondary/25',
            'bg-brand-secondary/[0.06]',
            'px-5 py-6 sm:px-8 sm:py-7',
          )}
        >
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <Kpi3dIcon
              id="anthropometry-pdf"
              size={28}
              strokeWidth={1.5}
              className="shrink-0 text-ink-secondary/70"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-3xs font-semibold text-brand-secondary">
                PDFs nutrición
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-ink-primary sm:text-2xl">
                Diagnóstico comparativo
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-ink-secondary">
                Elegí paciente y controles, generá la devolución automática y exportá un informe profesional.
              </p>
            </div>
          </div>
        </header>
        )}

        {IS_V2 ? null : (
          <WorkflowProgress
            steps={[
              { label: 'Paciente', done: step1Done },
              { label: 'Controles', done: step2Done },
              { label: 'Análisis', done: step3Done },
            ]}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
          <div className="space-y-4">
            <section className={panelClassName}>
              <div className={panelHeadClassName}>
                <h2 className="text-sm font-semibold text-ink-primary">Configuración</h2>
                <p className="text-xs text-ink-muted mt-0.5">Paciente y tipo de comparación</p>
              </div>
              <div className="p-4 sm:p-5 space-y-5">
                <label className="block">
                  <span className="mb-2 flex items-center gap-1.5 text-xs font-medium text-ink-secondary">
                    <Users className="h-3.5 w-3.5 opacity-70" aria-hidden />
                    Paciente
                  </span>
                  <select
                    value={studentId}
                    onChange={(e) => {
                      setStudentId(e.target.value)
                      setFromDocId('')
                      setToDocId('')
                      setFromMeasurementId('')
                      setToMeasurementId('')
                      setComparison(null)
                    }}
                    className={fieldSelectClassName}
                  >
                    <option value="">Seleccionar paciente…</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedStudent ? (
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5',
                      IS_V2 ? 'bg-surface-elevated/60' : 'border border-brand-secondary/20 bg-brand-secondary/[0.05]',
                    )}
                  >
                    <StudentAvatar
                      studentId={selectedStudent.id}
                      fullName={selectedStudent.full_name}
                      avatarPath={selectedStudent.avatar_path}
                      size="sm"
                      allowRemove={false}
                      onPathChange={() => {}}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-primary">{selectedStudent.full_name}</p>
                      <p className="text-2xs text-ink-muted">Listo para comparar controles</p>
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-3xs font-semibold text-ink-muted mb-2">
                    Fuente de datos
                  </p>
                  <SegmentedMode
                    mode={mode}
                    onPdf={() => {
                      setMode('pdf')
                      setFromMeasurementId('')
                      setToMeasurementId('')
                    }}
                    onManual={() => {
                      setMode('manual')
                      setFromDocId('')
                      setToDocId('')
                    }}
                  />
                </div>
              </div>
            </section>

            <section className={cn(panelClassName, !step1Done && 'opacity-60 pointer-events-none')}>
              <div className={cn('flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between', panelHeadClassName)}>
                <div>
                  <h2 className="text-sm font-semibold text-ink-primary">Controles a comparar</h2>
                  <p className="text-xs text-ink-muted mt-0.5">Anterior → actual</p>
                </div>
                {mode === 'pdf' ? (
                  <button
                    type="button"
                    onClick={handleOpenUploadPicker}
                    disabled={!studentId || uploading}
                    className={cn(directoryToolbarBtnClassName, 'disabled:opacity-40 disabled:pointer-events-none')}
                  >
                    <Upload className="h-4 w-4 opacity-70" aria-hidden />
                    {uploading ? 'Subiendo…' : 'Subir PDF'}
                  </button>
                ) : null}
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  uploadAnthropometryPdfs(e.target.files)
                  e.currentTarget.value = ''
                }}
              />

              <div className="p-4 sm:p-5">
                {!step1Done ? (
                  <p className="text-sm text-ink-muted text-center py-6">Seleccioná un paciente para continuar.</p>
                ) : mode === 'pdf' ? (
                  patientDocs.length === 0 ? (
                    <UploadEmptyState onUpload={handleOpenUploadPicker} uploading={uploading} />
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <ControlPickerColumn
                        title="Control anterior"
                        subtitle="PDF base"
                        options={patientDocs}
                        selectedId={fromDocId}
                        onSelect={setFromDocId}
                        kind="pdf"
                      />
                      <ControlPickerColumn
                        title="Control actual"
                        subtitle="PDF comparativo"
                        options={patientDocs}
                        selectedId={toDocId}
                        onSelect={setToDocId}
                        kind="pdf"
                      />
                    </div>
                  )
                ) : patientMeasurements.length === 0 ? (
                  <p className="text-sm text-ink-muted text-center py-6">
                    No hay mediciones manuales. Cargalas desde la carpeta del paciente → Antropometría.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ControlPickerColumn
                      title="Control anterior"
                      subtitle="Medición base"
                      options={patientMeasurements}
                      selectedId={fromMeasurementId}
                      onSelect={setFromMeasurementId}
                      kind="measurement"
                    />
                    <ControlPickerColumn
                      title="Control actual"
                      subtitle="Medición reciente"
                      options={patientMeasurements}
                      selectedId={toMeasurementId}
                      onSelect={setToMeasurementId}
                      kind="measurement"
                    />
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-[4.5rem]">
            <section className={panelClassName}>
              <div className={panelHeadClassName}>
                <h2 className="text-sm font-semibold text-ink-primary">Resultado</h2>
                <p className="text-xs text-ink-muted mt-0.5">Análisis y devolución clínica</p>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                <Button
                  type="button"
                  variant={IS_V2 ? undefined : 'gradientSecondary'}
                  className="w-full"
                  icon={<Sparkles className="h-4 w-4" />}
                  loading={analyzing}
                  disabled={!canAnalyze}
                  onClick={runAutomaticAnalysis}
                >
                  Generar análisis automático
                </Button>

                {!canAnalyze && (
                  <p className="text-center text-xs text-ink-muted">
                    Completá paciente y ambos controles para analizar.
                  </p>
                )}

                {step3Done ? (
                  <div className="grid grid-cols-2 gap-2">
                    {diffRows.slice(0, 6).map((row) => (
                      <MetricDeltaCard key={row.label} label={row.label} from={row.from} to={row.to} delta={row.delta} />
                    ))}
                  </div>
                ) : (
                  <div className={cn('rounded-xl px-4 py-8 text-center', IS_V2 ? 'bg-surface-elevated/60' : 'border border-dashed border-surface-border/90 bg-surface-elevated/20')}>
                    <Sparkles className={cn('mx-auto mb-2', IS_V2 ? 'h-6 w-6 text-ink-muted' : 'h-8 w-8 text-brand-secondary/50')} aria-hidden />
                    <p className="text-sm font-medium text-ink-primary">Sin análisis aún</p>
                    <p className="mt-1 text-xs text-ink-muted">Los cambios aparecerán acá como tarjetas.</p>
                  </div>
                )}

                {diffRows.length > 6 ? (
                  <details className={cn('rounded-xl px-3 py-2', IS_V2 ? 'bg-surface-elevated/60' : 'border border-surface-border/80 bg-surface-elevated/30')}>
                    <summary className="cursor-pointer text-xs font-semibold text-ink-secondary py-1">
                      Ver {diffRows.length - 6} métricas más
                    </summary>
                    <ul className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                      {diffRows.slice(6).map((row) => (
                        <li key={row.label} className="text-2xs text-ink-secondary flex justify-between gap-2">
                          <span className="font-medium text-ink-primary truncate">{row.label}</span>
                          <span className={cn('shrink-0 tabular-nums font-semibold', deltaToneClass(row.delta))}>
                            {row.delta}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-ink-secondary">
                    Devolución para el paciente
                  </span>
                  <textarea
                    value={interpretation}
                    onChange={(e) => setInterpretation(e.target.value)}
                    className={fieldTextareaClassName}
                  />
                </label>

                <p className="text-2xs leading-relaxed text-ink-muted">
                  PDF escaneado sin texto embebido: puede requerir OCR para extraer datos.
                </p>
              </div>
            </section>

            <Button
              className="w-full"
              variant={IS_V2 ? 'secondary' : 'gradientSecondary'}
              icon={<Download className="h-4 w-4" />}
              loading={generating}
              disabled={!step3Done}
              onClick={generatePdf}
            >
              Descargar diagnóstico (PDF)
            </Button>
          </aside>
        </div>
      </DirectoryPageShell>
    </div>
  )
}

function WorkflowProgress({ steps }: { steps: { label: string; done: boolean }[] }) {
  if (IS_V2) {
    return (
      <ol className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1" aria-label="Progreso del flujo">
        {steps.map((step, index) => (
          <li key={step.label} className={cn('flex items-center gap-1.5 text-xs font-medium', step.done ? 'text-ink-primary' : 'text-ink-muted')}>
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-3xs font-semibold',
                step.done ? 'bg-status-ok text-status-ok-ink' : 'bg-surface-elevated text-ink-muted',
              )}
              aria-hidden
            >
              {step.done ? <Check className="h-3 w-3" strokeWidth={3} /> : index + 1}
            </span>
            {step.label}
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ol className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Progreso del flujo">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
            step.done
              ? 'border-surface-border bg-surface-elevated'
              : 'border-surface-border/80 bg-surface-card/50',
          )}
        >
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              step.done
                ? 'bg-status-generated text-white'
                : 'border border-surface-border text-ink-muted',
            )}
            aria-hidden
          >
            {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : index + 1}
          </span>
          <span
            className={cn(
              'text-xs font-semibold truncate',
              step.done ? 'text-ink-primary' : 'text-ink-muted',
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  )
}

function SegmentedMode({
  mode,
  onPdf,
  onManual,
}: {
  mode: 'pdf' | 'manual'
  onPdf: () => void
  onManual: () => void
}) {
  if (IS_V2) {
    return (
      <div className="inline-flex gap-1.5">
        <button type="button" onClick={onPdf} aria-pressed={mode === 'pdf'} className={v2TabClass(mode === 'pdf')}>
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Informes PDF
        </button>
        <button type="button" onClick={onManual} aria-pressed={mode === 'manual'} className={v2TabClass(mode === 'manual')}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Controles cargados
        </button>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-surface-border/80 bg-surface-elevated/40 p-1">
      <button
        type="button"
        onClick={onPdf}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all',
          mode === 'pdf'
            ? 'bg-surface-card text-brand-secondary shadow-sm'
            : 'text-ink-muted hover:text-ink-secondary',
        )}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden />
        PDFs
      </button>
      <button
        type="button"
        onClick={onManual}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all',
          mode === 'manual'
            ? 'bg-surface-card text-brand-secondary shadow-sm'
            : 'text-ink-muted hover:text-ink-secondary',
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Mediciones
      </button>
    </div>
  )
}

function ControlPickerColumn({
  title,
  subtitle,
  options,
  selectedId,
  onSelect,
  kind,
}: {
  title: string
  subtitle: string
  options: NutritionPatientDocument[] | NutritionMeasurement[]
  selectedId: string
  onSelect: (id: string) => void
  kind: 'pdf' | 'measurement'
}) {
  return (
    <div className={cn('min-w-0 overflow-hidden flex flex-col rounded-xl', IS_V2 ? 'bg-surface-elevated/60' : 'border border-surface-border/80 bg-surface-elevated/25')}>
      <div className={IS_V2 ? 'px-3.5 pt-3 pb-1' : 'px-3 py-2 border-b border-surface-border/60 bg-surface-card/50'}>
        <p className="text-xs font-semibold text-ink-primary">{title}</p>
        <p className="text-3xs text-ink-muted">{subtitle}</p>
      </div>
      <ul className="flex-1 max-h-[220px] overflow-y-auto p-2 space-y-1.5">
        {options.map((item) => {
          const id = item.id
          const active = selectedId === id
          const label =
            kind === 'pdf'
              ? (item as NutritionPatientDocument).title
              : formatDate((item as NutritionMeasurement).measured_at)
          const meta =
            kind === 'pdf'
              ? (item as NutritionPatientDocument).document_date
                ? formatDate((item as NutritionPatientDocument).document_date!)
                : '—'
              : `Peso ${(item as NutritionMeasurement).weight_kg ?? '—'} kg`

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(active ? '' : id)}
                className={cn(
                  'w-full text-left rounded-lg px-2.5 py-2 transition-colors',
                  IS_V2
                    ? active
                      ? 'bg-ink-primary text-surface-base'
                      : 'hover:bg-surface-card'
                    : cn('border', active ? 'border-brand-secondary/45 bg-brand-secondary/10 ring-1 ring-brand-secondary/20' : 'border-transparent hover:border-surface-border hover:bg-surface-card/80'),
                )}
              >
                <p className={cn('text-xs font-medium truncate', IS_V2 ? (active ? undefined : 'text-ink-primary') : active ? 'text-brand-secondary' : 'text-ink-primary')}>
                  {label}
                </p>
                <p className={cn('text-3xs truncate mt-0.5', IS_V2 && active ? 'opacity-70' : 'text-ink-muted')}>{meta}</p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MetricDeltaCard({
  label,
  from,
  to,
  delta,
}: {
  label: string
  from: string
  to: string
  delta: string
}) {
  return (
    <div className={cn('rounded-xl', IS_V2 ? 'bg-surface-elevated/60 p-3' : 'border border-surface-border/80 bg-surface-elevated/30 p-2.5')}>
      <p className="text-3xs font-semibold text-ink-muted truncate">{label}</p>
      <p className="mt-1 text-2xs text-ink-secondary tabular-nums truncate">
        {from} → {to}
      </p>
      <p className={cn('mt-0.5 text-sm font-bold tabular-nums', deltaToneClass(delta))}>{delta}</p>
    </div>
  )
}

function UploadEmptyState({ onUpload, uploading }: { onUpload: () => void; uploading: boolean }) {
  return (
    <button
      type="button"
      onClick={onUpload}
      disabled={uploading}
      className={cn(
        'w-full rounded-xl border border-dashed px-4 py-10 text-center transition-colors disabled:opacity-50',
        IS_V2
          ? 'border-surface-inputBorder hover:bg-surface-elevated/60'
          : 'border-2 border-brand-secondary/30 bg-brand-secondary/[0.04] hover:border-brand-secondary/50 hover:bg-brand-secondary/[0.08]',
      )}
    >
      <Upload className={cn('mx-auto mb-2', IS_V2 ? 'h-6 w-6 text-ink-muted' : 'h-8 w-8 text-brand-secondary/70')} aria-hidden />
      <p className="text-sm font-semibold text-ink-primary">{uploading ? 'Subiendo…' : 'Subir PDF de antropometría'}</p>
      <p className="mt-1 text-xs text-ink-muted">Arrastrá o tocá para cargar el primer control</p>
    </button>
  )
}
