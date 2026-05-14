import { useEffect, useMemo, useRef, useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { ArrowRight, Download, FileText, Sparkles, Upload, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { cn, slugify } from '@/lib/utils'
import type { Student, NutritionPatientDocument, NutritionMeasurement } from '@/types/database'
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

function buildSafePdfName(fileName: string): string {
  const clean = fileName.replace(/\.pdf$/i, '')
  return `${slugify(clean)}.pdf`
}

function buildOriginalLabel(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim()
}

export function NutritionComparativePage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'pdf' | 'manual'>('pdf')
  const [students, setStudents] = useState<Student[]>([])
  const [docs, setDocs] = useState<NutritionPatientDocument[]>([])
  const [measurements, setMeasurements] = useState<NutritionMeasurement[]>([])
  const [studentId, setStudentId] = useState('')
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
        supabase.from('students').select('*').eq('owner_id', user.id).order('full_name'),
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
        toast.error(stErr?.message ?? dErr?.message ?? mErr?.message ?? 'No se pudieron cargar datos')
      } else {
        setStudents((stData as Student[]) ?? [])
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
        <div className="flex justify-center py-16"><Spinner size="lg" accent="trainerCta" /></div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Diagnóstico comparativo" showBack />
      <div className="px-4 lg:px-6 py-6 space-y-5 max-w-3xl">
        {/* Paso 1: paciente + modo */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                1
              </span>
              <CardTitle>Elegí el paciente y el modo</CardTitle>
            </div>
          </div>

          <label className="block text-xs text-ink-secondary mb-4">
            <span className="inline-flex items-center gap-1.5 mb-1.5">
              <Users className="h-3 w-3" /> Paciente
            </span>
            <select
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value)
                setFromDocId('')
                setToDocId('')
              }}
              className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
            >
              <option value="">Seleccionar paciente...</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
            Tipo de comparación
          </p>
          <div className="flex gap-1.5">
            <ModePill active={mode === 'pdf'} onClick={() => setMode('pdf')} icon={<FileText className="h-3.5 w-3.5" />}>
              Comparar PDFs
            </ModePill>
            <ModePill active={mode === 'manual'} onClick={() => setMode('manual')} icon={<Sparkles className="h-3.5 w-3.5" />}>
              Comparar mediciones
            </ModePill>
          </div>
        </Card>

        {/* Paso 2: seleccionar controles */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                2
              </span>
              <CardTitle>Seleccioná los dos controles a comparar</CardTitle>
            </div>
            {mode === 'pdf' ? (
              <button
                type="button"
                onClick={handleOpenUploadPicker}
                disabled={!studentId || uploading}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-surface-border hover:border-brand-primary/55 transition-colors text-ink-secondary hover:text-ink-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="h-3.5 w-3.5" />
                {uploading ? 'Subiendo...' : 'Subir nuevo PDF'}
              </button>
            ) : null}
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
          </div>

          <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <label className="text-xs text-ink-secondary">
              <span className="block mb-1.5">{mode === 'pdf' ? 'PDF base (anterior)' : 'Medición base (anterior)'}</span>
              {mode === 'pdf' ? (
                <select
                  value={fromDocId}
                  onChange={(e) => setFromDocId(e.target.value)}
                  className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
                >
                  <option value="">Seleccionar...</option>
                  {patientDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={fromMeasurementId}
                  onChange={(e) => setFromMeasurementId(e.target.value)}
                  className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
                >
                  <option value="">Seleccionar...</option>
                  {patientMeasurements.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.measured_at} · Peso {m.weight_kg ?? '—'} · IMC {m.bmi ?? '—'}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <div className="hidden sm:flex items-center justify-center pb-2.5">
              <span className="text-ink-muted">
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>

            <label className="text-xs text-ink-secondary">
              <span className="block mb-1.5">{mode === 'pdf' ? 'PDF comparativo (actual)' : 'Medición actual'}</span>
              {mode === 'pdf' ? (
                <select
                  value={toDocId}
                  onChange={(e) => setToDocId(e.target.value)}
                  className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
                >
                  <option value="">Seleccionar...</option>
                  {patientDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={toMeasurementId}
                  onChange={(e) => setToMeasurementId(e.target.value)}
                  className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
                >
                  <option value="">Seleccionar...</option>
                  {patientMeasurements.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.measured_at} · Peso {m.weight_kg ?? '—'} · IMC {m.bmi ?? '—'}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>
        </Card>

        {/* Paso 3: análisis + devolución */}
        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                3
              </span>
              <CardTitle>Generar análisis y devolución</CardTitle>
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon={<Sparkles className="h-4 w-4" />}
              loading={analyzing}
              onClick={runAutomaticAnalysis}
            >
              Analizar
            </Button>
          </div>

          {diffRows.length > 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
                Cambios detectados
              </p>
              <div className="space-y-1">
                {diffRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-xs gap-2">
                    <span className="font-medium text-ink-primary truncate">{row.label}</span>
                    <span className="text-ink-secondary tabular-nums shrink-0">
                      {row.from} → {row.to}{' '}
                      <span className="font-semibold text-ink-primary">({row.delta})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <label className="text-xs text-ink-secondary">
            <span className="block mb-1.5">Devolución (editable antes de exportar)</span>
            <textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              rows={8}
              className="w-full rounded-xl border border-surface-inputBorder bg-surface-input px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-brand-primary"
            />
          </label>
          <p className="text-[11px] text-ink-muted mt-2">
            Si un PDF viene escaneado sin texto embebido, hace falta OCR para extraer datos.
          </p>
        </Card>

        <Button
          className="w-full"
          variant="gradientPrimary"
          icon={<Download className="h-4 w-4" />}
          loading={generating}
          onClick={generatePdf}
        >
          Descargar diagnóstico comparativo (PDF)
        </Button>
      </div>
    </div>
  )
}

function ModePill({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
          : 'border border-surface-border/70 text-ink-secondary hover:bg-surface-elevated/60 hover:text-ink-primary',
      )}
    >
      {icon}
      {children}
    </button>
  )
}
