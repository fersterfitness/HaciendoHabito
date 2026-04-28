import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1F2937',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: '#4B5563',
    marginBottom: 14,
  },
  section: {
    marginBottom: 10,
    padding: 10,
    border: '1px solid #E5E7EB',
    borderRadius: 6,
  },
  label: {
    fontSize: 9,
    color: '#6B7280',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.45,
  },
})

interface NutritionComparativePdfDocumentProps {
  patientName: string
  fromLabel: string
  toLabel: string
  differences: Array<{ label: string; from: string; to: string; delta: string }>
  interpretation: string
}

export function NutritionComparativePdfDocument({
  patientName,
  fromLabel,
  toLabel,
  differences,
  interpretation,
}: NutritionComparativePdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Diagnóstico comparativo antropométrico</Text>
        <Text style={styles.subtitle}>Generado automáticamente en Haciéndolo Hábito</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Paciente</Text>
          <Text style={styles.value}>{patientName}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Fechas comparadas</Text>
          <Text style={styles.value}>{fromLabel} vs {toLabel}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Diferencias detectadas</Text>
          {differences.length === 0 ? (
            <Text style={styles.paragraph}>No se detectaron métricas comparables en ambos archivos.</Text>
          ) : (
            differences.map((d) => (
              <Text key={d.label} style={styles.paragraph}>
                {d.label}: {d.from} {'->'} {d.to} (cambio {d.delta})
              </Text>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Interpretación profesional</Text>
          <Text style={styles.paragraph}>{interpretation}</Text>
        </View>
      </Page>
    </Document>
  )
}
