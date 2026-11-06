import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO } from 'date-fns'
import { Check, Code, Download, PencilLine, RotateCcw, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn, slugify } from '@/lib/utils'
import type { AnthropometryDetail } from '@/lib/nutrition/anthropometryProgramModel'
import {
  DEFAULT_REPORT_GOALS,
  DEFAULT_REPORT_OBJECTIVE,
  MAX_REPORT_GOALS,
  REPORT_GOALS,
  buildAnthropometryReport,
  defaultReportReading,
  savedReportTexts,
  type SavedReportTexts,
} from '@/lib/nutrition/anthropometryReport'
import { compareBodyZones, type BodyZoneId, type BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import type { Json, NutritionMeasurement, Student } from '@/types/database'
import { loadView, paint } from '../body2d/bodyCanvas'
import { bodySexOf } from '../body2d/zones'
import { AnthropometryReportSheet, REPORT_SHEET_WIDTH, type ZoneSummary } from './AnthropometryReportSheet'
import { buildStandaloneHtml, downloadFile, sheetToPng } from './reportExport'

/**
 * Informe ilustrado de un control a pantalla completa: vista previa de la lámina, textos
 * editables (se guardan en el control) y salida como archivo HTML o como imagen.
 */

const ROOT_ID = 'hh-report-root'

const mediansOf = (m: NutritionMeasurement | null) => (m?.detail as AnthropometryDetail | null)?.medians ?? null

interface Props {
  ownerId: string
  student: Student
  /** Del más nuevo al más viejo. */
  measurements: NutritionMeasurement[]
  initialId: string | null
  onClose: () => void
  onSaved: () => Promise<void> | void
}

export function AnthropometryReportView({ ownerId, student, measurements, initialId, onClose, onSaved }: Props) {
  const [currentId, setCurrentId] = useState(() => (initialId && measurements.some((m) => m.id === initialId) ? initialId : measurements[0]?.id ?? null))
  const idx = Math.max(0, measurements.findIndex((m) => m.id === currentId))
  const current = measurements[idx] ?? null
  const previous = measurements[idx + 1] ?? null

  const data = useMemo(() => (current ? buildAnthropometryReport(student, current, previous) : null), [student, current, previous])
  const autoReading = useMemo(() => (data ? defaultReportReading(data) : ''), [data])

  // Textos: lo guardado en el control o el automático.
  const saved = useMemo<SavedReportTexts>(() => (current ? savedReportTexts(current) : {}), [current])
  const [reading, setReading] = useState('')
  const [objective, setObjective] = useState('')
  const [goals, setGoals] = useState<string[]>(DEFAULT_REPORT_GOALS)
  useEffect(() => {
    setReading(saved.reading ?? autoReading)
    setObjective(saved.objective ?? DEFAULT_REPORT_OBJECTIVE)
    setGoals(saved.goals ?? DEFAULT_REPORT_GOALS)
  }, [saved, autoReading])
  const dirty =
    reading !== (saved.reading ?? autoReading) ||
    objective !== (saved.objective ?? DEFAULT_REPORT_OBJECTIVE) ||
    goals.join() !== (saved.goals ?? DEFAULT_REPORT_GOALS).join()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<'html' | 'png' | null>(null)

  // Cuerpo de frente pintado con los cambios respecto del control anterior.
  const sex = bodySexOf(student)
  const zones = useMemo(() => (previous ? compareBodyZones(mediansOf(previous), mediansOf(current)) : null), [previous, current])
  const zoneSummary = useMemo<ZoneSummary | null>(
    () =>
      zones
        ? {
            good: zones.filter((z) => z.status === 'good').length,
            bad: zones.filter((z) => z.status === 'bad').length,
            alert: zones.filter((z) => z.status === 'alert').length,
          }
        : null,
    [zones],
  )
  const [bodySrc, setBodySrc] = useState<string | null>(null)
  useEffect(() => {
    if (!sex) {
      setBodySrc(null)
      return
    }
    let alive = true
    const status = Object.fromEntries((zones ?? []).map((z) => [z.zone.id, z.status])) as Record<BodyZoneId, BodyZoneStatus>
    loadView(sex, 'frente')
      .then((view) => {
        if (!alive) return
        const c = document.createElement('canvas')
        paint(c, view, status, null, null)
        setBodySrc(c.toDataURL('image/png'))
      })
      .catch(() => alive && setBodySrc(null))
    return () => {
      alive = false
    }
  }, [sex, zones])

  // La lámina tiene ancho fijo: se escala para entrar en la pantalla.
  const stageRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [sheetH, setSheetH] = useState(1080)
  useLayoutEffect(() => {
    const stage = stageRef.current
    const sheet = sheetRef.current
    if (!stage || !sheet) return
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(stage)
      const inner = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      setScale(Math.min(1, inner / REPORT_SHEET_WIDTH))
      setSheetH(sheet.offsetHeight)
    })
    ro.observe(stage)
    ro.observe(sheet)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const fileBase = current ? slugify(`evaluacion-${student.full_name}-${current.measured_at}`).slice(0, 80) || 'evaluacion-antropometrica' : 'evaluacion'

  async function exportSheet(kind: 'html' | 'png') {
    if (!sheetRef.current || !current) return
    setExporting(kind)
    try {
      if (kind === 'png') {
        downloadFile(await sheetToPng(sheetRef.current), `${fileBase}.png`)
        toast.success('Imagen descargada')
      } else {
        const title = `Evaluación antropométrica · ${student.full_name} · ${format(parseISO(current.measured_at), 'dd/MM/yyyy')}`
        const html = await buildStandaloneHtml(sheetRef.current, title, REPORT_SHEET_WIDTH)
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
        downloadFile(url, `${fileBase}.html`)
        window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
        toast.success('Informe HTML descargado')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el archivo')
    } finally {
      setExporting(null)
    }
  }

  async function saveTexts() {
    if (!current) return
    setSaving(true)
    const base = current.detail && typeof current.detail === 'object' && !Array.isArray(current.detail) ? current.detail : {}
    const report: SavedReportTexts = { reading, objective, goals }
    const { error } = await supabase
      .from('nutrition_measurements')
      .update({ detail: { ...base, report } as unknown as Json })
      .eq('id', current.id)
      .eq('owner_id', ownerId)
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Textos guardados en el control')
    await onSaved()
  }

  function toggleGoal(id: string) {
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length >= MAX_REPORT_GOALS ? g : [...g, id]))
  }

  if (!current || !data) return null

  return createPortal(
    <div id={ROOT_ID} className="fixed inset-0 z-[10070] flex flex-col bg-surface-base">

      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-surface-card px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
          aria-label="Cerrar informe"
          title="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mr-auto min-w-0">
          <p className="truncate text-sm font-semibold text-ink-primary">Evaluación antropométrica</p>
          <p className="truncate text-2xs text-ink-muted">{student.full_name}</p>
        </div>
        <select
          value={current.id}
          onChange={(e) => setCurrentId(e.target.value)}
          aria-label="Control del informe"
          className="h-9 rounded-lg border border-surface-inputBorder bg-surface-card px-2.5 text-sm text-ink-primary"
        >
          {measurements.map((m, i) => (
            <option key={m.id} value={m.id}>
              {m.measurement_number != null ? `N° ${m.measurement_number} · ` : ''}
              {format(parseISO(m.measured_at), 'dd/MM/yyyy')}
              {i === measurements.length - 1 ? ' (inicial)' : ''}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant={editing ? 'soft' : 'secondary'}
          icon={editing ? <Check className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
        >
          {editing ? 'Listo' : 'Editar textos'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<Download className="h-4 w-4" />}
          loading={exporting === 'png'}
          disabled={exporting != null}
          onClick={() => void exportSheet('png')}
        >
          Imagen
        </Button>
        <Button
          type="button"
          size="sm"
          icon={<Code className="h-4 w-4" />}
          loading={exporting === 'html'}
          disabled={exporting != null}
          onClick={() => void exportSheet('html')}
        >
          <span className="hidden sm:inline">Descargar HTML</span>
          <span className="sm:hidden">HTML</span>
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {editing ? (
          <aside
            className="order-1 max-h-[45vh] shrink-0 space-y-4 overflow-y-auto border-b border-surface-border bg-surface-card p-4 lg:order-2 lg:max-h-none lg:w-[380px] lg:border-b-0 lg:border-l"
          >
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="report-reading" className="text-xs font-semibold text-ink-primary">
                  Lectura de la evaluación
                </label>
                {reading !== autoReading ? (
                  <button
                    type="button"
                    onClick={() => setReading(autoReading)}
                    className="inline-flex items-center gap-1 text-2xs font-medium text-ink-muted hover:text-ink-primary"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Texto automático
                  </button>
                ) : null}
              </div>
              <textarea
                id="report-reading"
                value={reading}
                onChange={(e) => setReading(e.target.value)}
                rows={9}
                className="w-full rounded-lg border border-surface-inputBorder bg-surface-card px-3 py-2 text-sm leading-relaxed text-ink-primary"
              />
              <p className="mt-1 text-3xs text-ink-muted">Un párrafo por línea. **Así** queda en negrita.</p>
            </div>
            <div>
              <label htmlFor="report-objective" className="mb-1.5 block text-xs font-semibold text-ink-primary">
                Objetivo
              </label>
              <textarea
                id="report-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-surface-inputBorder bg-surface-card px-3 py-2 text-sm leading-relaxed text-ink-primary"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-ink-primary">
                Íconos del objetivo <span className="font-normal text-ink-muted">· hasta {MAX_REPORT_GOALS}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {REPORT_GOALS.map((g) => {
                  const on = goals.includes(g.id)
                  const full = !on && goals.length >= MAX_REPORT_GOALS
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGoal(g.id)}
                      disabled={full}
                      aria-pressed={on}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-2xs font-medium transition-colors disabled:opacity-40',
                        on
                          ? 'border-ink-primary bg-ink-primary text-surface-card'
                          : 'border-surface-border text-ink-secondary hover:border-surface-inputBorder hover:text-ink-primary',
                      )}
                    >
                      {g.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-surface-border pt-3">
              <p className="text-3xs text-ink-muted">{dirty ? 'Hay cambios sin guardar.' : saved.reading ? 'Guardado en este control.' : 'Texto automático.'}</p>
              <Button type="button" size="sm" icon={<Save className="h-4 w-4" />} disabled={!dirty} loading={saving} onClick={() => void saveTexts()}>
                Guardar
              </Button>
            </div>
          </aside>
        ) : null}

        <div ref={stageRef} className="order-2 min-h-0 flex-1 overflow-auto bg-[#e9e9ec] p-3 sm:p-6 lg:order-1">
          <div
            className="mx-auto origin-top-left overflow-hidden rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.12)]"
            style={{ width: REPORT_SHEET_WIDTH * scale, height: sheetH * scale }}
          >
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: REPORT_SHEET_WIDTH }}>
              <AnthropometryReportSheet
                ref={sheetRef}
                data={data}
                reading={reading}
                objective={objective}
                goals={goals}
                bodySrc={bodySrc}
                zoneSummary={zoneSummary}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
