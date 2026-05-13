import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { EvolutionPdfRow } from '@/lib/nutrition/nutritionEvolutionInterpretation'

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: 'Helvetica', color: '#1F2937' },
  title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  subtitle: { fontSize: 9, color: '#4B5563', marginBottom: 12 },
  section: { marginBottom: 10, padding: 10, border: '1px solid #E5E7EB', borderRadius: 6 },
  label: { fontSize: 8, color: '#6B7280', marginBottom: 2, textTransform: 'uppercase' },
  paragraph: { fontSize: 10, lineHeight: 1.5 },
  row: { fontSize: 9, marginBottom: 3 },
})

export function NutritionEvolutionReportPdfDocument({
  patientName,
  fromLabel,
  toLabel,
  rows,
  interpretation,
}: {
  patientName: string
  fromLabel: string
  toLabel: string
  rows: EvolutionPdfRow[]
  interpretation: string
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Informe de evolución (antropometría)</Text>
        <Text style={styles.subtitle}>
          Apoyo para la devolución al paciente · Generado en Haciéndolo Hábito · No constituye diagnóstico médico
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.paragraph}>{patientName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Controles comparados</Text>
          <Text style={styles.paragraph}>
            {fromLabel} → {toLabel}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Resumen de variables</Text>
          {rows.length === 0 ? (
            <Text style={styles.paragraph}>No hay mediciones numéricas comparables entre ambas fechas.</Text>
          ) : (
            rows.map((r) => (
              <Text key={r.label} style={styles.row}>
                {r.label}: {r.from} → {r.to} ({r.delta})
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Devolución sugerida (editable)</Text>
          {interpretation.split('\n').map((line, i) => (
            <Text key={i} style={styles.paragraph}>
              {line || ' '}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  )
}
