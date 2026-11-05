import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { groupIntoLines, parseAnthropometryReport, type ImportedAnthropometry } from './anthropometryReportImport'

GlobalWorkerOptions.workerSrc = workerSrc

/** Lee el informe PDF de composición corporal y devuelve las medidas mapeadas al programa. */
export async function readAnthropometryReportPdf(file: File): Promise<ImportedAnthropometry> {
  const doc = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[][] = []
  for (let i = 1; i <= doc.numPages; i += 1) {
    const content = await (await doc.getPage(i)).getTextContent()
    const items = content.items.flatMap((it) =>
      'str' in it ? [{ str: it.str, x: it.transform[4] as number, y: it.transform[5] as number }] : [],
    )
    pages.push(groupIntoLines(items))
  }
  return parseAnthropometryReport(pages)
}
