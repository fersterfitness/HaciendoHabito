import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { PdfBrandRibbon } from '@/lib/pdf/PdfBrandRibbon'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'
import type { ReactNode } from 'react'
import type { PresentationRow } from '@/lib/nutrition/anthropometryPresentation'
import { format, parseISO } from 'date-fns'

const styles = StyleSheet.create({
  page: { padding: 26, fontSize: 9, fontFamily: 'Helvetica', color: '#111827' },
  brand: { fontSize: 10, color: '#374151', marginBottom: 10, lineHeight: 1.35 },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 8.5, color: '#4B5563', marginBottom: 12, lineHeight: 1.4 },
  meta: { fontSize: 9, marginBottom: 10 },
  section: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 4, color: PDF_BRAND.dark },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB', paddingVertical: 3 },
  h: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: '#6B7280', textTransform: 'uppercase' },
  c1: { width: '34%' },
  c2: { width: '16%' },
  c3: { width: '16%' },
  c4: { width: '18%' },
  c5: { width: '16%' },
  foot: { marginTop: 14, fontSize: 7.5, color: '#6B7280', lineHeight: 1.45 },
})

export function NutritionAnthropometryPresentationPdfDocument({
  patientName,
  measuredAt,
  measurementNumber,
  rows,
  technicalErrorPct,
  brandLogoSrc,
}: {
  patientName: string
  measuredAt: string
  measurementNumber: number | null
  rows: PresentationRow[]
  technicalErrorPct: number
  brandLogoSrc?: string | null
}) {
  const dateLabel = (() => {
    try {
      return format(parseISO(measuredAt), 'dd/MM/yyyy')
    } catch {
      return measuredAt
    }
  })()

  let lastSection = ''
  const body: ReactNode[] = []
  for (const r of rows) {
    if (r.sectionTitle !== lastSection) {
      lastSection = r.sectionTitle
      body.push(
        <Text key={`s-${r.sectionTitle}`} style={styles.section}>
          {r.sectionTitle}
        </Text>,
      )
    }
    body.push(
      <View key={r.rowId} style={styles.row}>
        <Text style={[styles.c1, { paddingRight: 4 }]}>{r.label}</Text>
        <Text style={styles.c2}>{r.resultado}</Text>
        <Text style={styles.c3}>{r.valorAjustado}</Text>
        <Text style={styles.c4}>{r.diffVsAnterior}</Text>
        <Text style={styles.c5}>{r.scoreZ}</Text>
      </View>,
    )
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfBrandRibbon
          brandLogoSrc={brandLogoSrc}
          kicker="Haciéndolo Hábito · Nutrición"
          title="Informe de composición corporal"
          subtitle="Programa de antropometría · Valores desde medianas de series"
        />
        <Text style={styles.brand}>
          Cristian Nicolás Vázquez Crossetto · Nutrición deportiva · cel: 1155082465 · cris.crossetto@gmail.com
        </Text>
        <Text style={styles.meta}>
          Paciente: {patientName}
          {' · '}
          Fecha medición: {dateLabel}
          {measurementNumber != null ? ` · N° medición: ${measurementNumber}` : ''}
        </Text>

        <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: '#9CA3AF', paddingBottom: 4 }]}>
          <Text style={[styles.h, styles.c1]}>Variable</Text>
          <Text style={[styles.h, styles.c2]}>Resultado</Text>
          <Text style={[styles.h, styles.c3]}>Valor ajust.</Text>
          <Text style={[styles.h, styles.c4]}>Dif. anterior</Text>
          <Text style={[styles.h, styles.c5]}>Score-Z</Text>
        </View>

        {body}

        <Text style={styles.foot}>
          Valor ajustado: en diámetros y pliegues se aplica corrección por error técnico de medición TE = {technicalErrorPct}% (ISAK
          orientativo: valor / (1 − TE/100)). Peso, talla y perímetros se muestran sin esa corrección. La sección «Indicadores
          derivados» incluye IMC, suma de pliegues y ratio cintura/cadera (sin Score-Z). Score-Z no se calcula sin tablas
          normativas cargadas en el sistema (columna N/D). Este informe no sustituye la evaluación clínica ni constituye un
          diagnóstico médico.
        </Text>
      </Page>
    </Document>
  )
}
