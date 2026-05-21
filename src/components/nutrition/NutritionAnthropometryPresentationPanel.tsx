import { useMemo, useState, type ReactNode } from 'react'
import { pdf } from '@react-pdf/renderer'
import { format, parseISO } from 'date-fns'
import { Download } from 'lucide-react'
import type { NutritionMeasurement } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { CardTitle } from '@/components/ui/Card'
import {
  buildPresentationRows,
  mergedMediansForPresentation,
  pickMeasurementPair,
} from '@/lib/nutrition/anthropometryPresentation'
import { defaultBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import { NutritionAnthropometryPresentationPdfDocument } from '@/lib/pdf/NutritionAnthropometryPresentationPdfDocument'
import { slugify } from '@/lib/utils'
import toast from 'react-hot-toast'

function hasAnyMedian(m: NutritionMeasurement): boolean {
  const med = mergedMediansForPresentation(m)
  return Object.values(med).some((v) => v != null && Number.isFinite(v as number))
}

export function NutritionAnthropometryPresentationPanel({
  patientName,
  measurements,
  selectedMeasurementId,
}: {
  patientName: string
  measurements: NutritionMeasurement[]
  selectedMeasurementId: string | null
}) {
  const [exporting, setExporting] = useState(false)
  const { current, previous } = useMemo(
    () => pickMeasurementPair(measurements, selectedMeasurementId),
    [measurements, selectedMeasurementId],
  )
  const rows = useMemo(
    () => (current && hasAnyMedian(current) ? buildPresentationRows(current, previous) : []),
    [current, previous],
  )
  const te = current ? (current.detail as { meta?: { measurement_error_pct_default?: number } })?.meta?.measurement_error_pct_default ?? 2 : 2

  const tableBody = useMemo(() => {
    let sec = ''
    const lines: ReactNode[] = []
    for (const r of rows) {
      if (r.sectionTitle !== sec) {
        sec = r.sectionTitle
        lines.push(
          <tr key={`h-${sec}`} className="bg-surface-card/90">
            <td colSpan={5} className="px-2 py-1.5 font-semibold text-ink-primary text-[11px]">
              {sec}
            </td>
          </tr>,
        )
      }
      lines.push(
        <tr key={r.rowId} className="border-b border-surface-border/70 hover:bg-surface-elevated/40">
          <td className="px-2 py-1.5 text-ink-secondary">{r.label}</td>
          <td className="px-2 py-1.5 tabular-nums text-ink-primary">{r.resultado}</td>
          <td className="px-2 py-1.5 tabular-nums text-ink-primary">{r.valorAjustado}</td>
          <td className="px-2 py-1.5 tabular-nums text-brand-primary">{r.diffVsAnterior}</td>
          <td className="px-2 py-1.5 text-ink-muted">{r.scoreZ}</td>
        </tr>,
      )
    }
    return lines
  }, [rows])

  async function exportPdf() {
    if (!current || rows.length === 0) {
      toast.error('No hay una medición con datos del programa para armar el informe.')
      return
    }
    setExporting(true)
    try {
      const blob = await pdf(
        <NutritionAnthropometryPresentationPdfDocument
          patientName={patientName}
          measuredAt={current.measured_at}
          measurementNumber={current.measurement_number}
          rows={rows}
          technicalErrorPct={te}
          brandLogoSrc={defaultBrandLogoSrc()}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const base = slugify(`presentacion-${patientName}-${current.measured_at}`).slice(0, 80) || 'presentacion-antropometria'
      a.download = `${base}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('PDF «Presentación» generado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al generar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (!current || !hasAnyMedian(current)) {
    return (
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-elevated/30 px-4 py-5 text-sm text-ink-muted">
        Guardá un control con el <strong className="text-ink-secondary">programa de antropometría</strong> para ver acá la tabla estilo
        «Presentación» (resultado, valor ajustado en diámetros/pliegues, diferencia vs. control anterior y columna Score-Z).
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="mb-1">Informe «Presentación»</CardTitle>
          <p className="text-xs text-ink-muted">
            Control del {format(parseISO(current.measured_at), 'dd/MM/yyyy')}
            {current.measurement_number != null ? ` · N° ${current.measurement_number}` : ''}
            {previous
              ? ` · Dif. vs ${format(parseISO(previous.measured_at), 'dd/MM/yyyy')}${
                  previous.measurement_number != null ? ` (N° ${previous.measurement_number})` : ''
                }`
              : ' · Sin control anterior para diferencias'}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} loading={exporting} onClick={() => void exportPdf()}>
          Descargar PDF
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full min-w-[640px] text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-surface-border bg-surface-elevated/80">
              <th className="px-2 py-2 font-semibold text-ink-muted uppercase tracking-wide">Sección / variable</th>
              <th className="px-2 py-2 font-semibold text-ink-muted">Resultado</th>
              <th className="px-2 py-2 font-semibold text-ink-muted">Valor aj.</th>
              <th className="px-2 py-2 font-semibold text-ink-muted">Dif. ant.</th>
              <th className="px-2 py-2 font-semibold text-ink-muted">Z</th>
            </tr>
          </thead>
          <tbody>{tableBody}</tbody>
        </table>
      </div>
      <p className="text-[10px] text-ink-muted leading-relaxed">
        Ajuste TE {te}% en diámetros y pliegues (ISAK orientativo). La sección inferior suma IMC, pliegues y ratio cintura/cadera. Score-Z
        requiere tablas normativas: mostramos N/D hasta incorporar referencias.
      </p>
    </div>
  )
}
