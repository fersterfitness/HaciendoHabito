import { createElement } from 'react'
import { pdf } from '@react-pdf/renderer'
import { defaultBrandLogoSrc } from '@/lib/pdf/defaultBrandLogoSrc'
import {
  RoutineProgressLogPdfDocument,
  type RoutineProgressLogPdfProps,
} from '@/lib/pdf/RoutineProgressLogPdfDocument'

function sanitizeFilename(base: string): string {
  return base.replace(/[^\w\s\-_.áéíóúÁÉÍÓÚñÑ]/g, '').trim().slice(0, 80) || 'registro-progreso'
}

export async function downloadRoutineProgressLogPdf(
  props: Pick<RoutineProgressLogPdfProps, 'routineName' | 'studentName' | 'blocks'>,
): Promise<void> {
  const pdfDoc = createElement(RoutineProgressLogPdfDocument, {
    ...props,
    brandLogoSrc: defaultBrandLogoSrc(),
    generatedAt: new Date(),
  }) as NonNullable<Parameters<typeof pdf>[0]>

  const blob = await pdf(pdfDoc).toBlob()
  const url = URL.createObjectURL(blob)
  const studentPart = props.studentName?.trim() ? `-${sanitizeFilename(props.studentName)}` : ''
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(props.routineName)}${studentPart}-registro-progreso.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
