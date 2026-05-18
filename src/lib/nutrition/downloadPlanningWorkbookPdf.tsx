import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { defaultBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import { PlanningWorkbookPdfDocument } from '@/lib/pdf/PlanningWorkbookPdfDocument'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'

function sanitizeFilename(base: string): string {
  return base.replace(/[^\w\s\-_.áéíóúÁÉÍÓÚñÑ]/g, '').trim().slice(0, 80) || 'plan-alimentacion'
}

export async function downloadPlanningWorkbookPdf(
  wb: PlanningWorkbookStateV1,
  options?: {
    professionalName?: string | null
    /** Nombre del alumno (referencia en ficha o plan asignado). */
    studentName?: string | null
    fileBaseName?: string
    /** Logo marca en cabecera PDF (URL absoluta). Por defecto mark oscuro en `/public`. */
    brandLogoSrc?: string | null
    generatedAt?: Date
  },
): Promise<void> {
  const pdfDoc = createElement(PlanningWorkbookPdfDocument, {
    wb,
    professionalName: options?.professionalName,
    studentName: options?.studentName,
    brandLogoSrc: options?.brandLogoSrc ?? defaultBrandLogoSrc(),
    generatedAt: options?.generatedAt ?? new Date(),
  }) as NonNullable<Parameters<typeof pdf>[0]>
  const blob = await pdf(pdfDoc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(options?.fileBaseName ?? 'plan-alimentacion')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
