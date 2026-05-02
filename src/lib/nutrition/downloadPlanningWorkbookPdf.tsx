import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { PlanningWorkbookPdfDocument } from '@/lib/pdf/PlanningWorkbookPdfDocument'
import type { PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'

function sanitizeFilename(base: string): string {
  return base.replace(/[^\w\s\-_.áéíóúÁÉÍÓÚñÑ]/g, '').trim().slice(0, 80) || 'plan-alimentacion'
}

export async function downloadPlanningWorkbookPdf(
  wb: PlanningWorkbookStateV1,
  options?: { professionalName?: string | null; fileBaseName?: string },
): Promise<void> {
  const blob = await pdf(
    createElement(PlanningWorkbookPdfDocument, {
      wb,
      professionalName: options?.professionalName,
    }),
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(options?.fileBaseName ?? 'plan-alimentacion')}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
