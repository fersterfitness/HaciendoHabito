import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { EvolutionPdfRow } from '@/lib/nutrition/nutritionEvolutionInterpretation'
import { PdfBrandRibbon } from '@/lib/pdf/PdfBrandRibbon'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'

const colors = {
  ink: '#0F172A',
  inkSecondary: '#475569',
  inkMuted: '#94A3B8',
  border: '#E2E8F0',
  surface: '#F8FAFC',
  surfaceCard: '#FFFFFF',
  brand: PDF_BRAND.primary,
  brandSoft: PDF_BRAND.primaryLight,
  good: '#16A34A',
  goodSoft: '#DCFCE7',
  bad: '#DC2626',
  badSoft: '#FEE2E2',
  neutral: '#64748B',
  neutralSoft: '#F1F5F9',
}

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  metaCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    border: `1pt solid ${colors.border}`,
    padding: 12,
    marginBottom: 14,
  },
  metaCol: { flex: 1 },
  metaLabel: {
    fontSize: 8,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 11,
    color: colors.ink,
    fontFamily: 'Helvetica-Bold',
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 6,
    border: `1pt solid ${colors.border}`,
    padding: 12,
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottom: `1pt solid ${colors.border}`,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottom: `0.5pt solid ${colors.border}`,
    alignItems: 'center',
  },
  tableLabel: { flex: 2, fontSize: 10, color: colors.ink },
  tableValue: { flex: 1, fontSize: 10, color: colors.inkSecondary, textAlign: 'right' },
  badgeWrap: { flex: 1, alignItems: 'flex-end' },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 3,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  badgeGood: { backgroundColor: colors.goodSoft, color: colors.good },
  badgeBad: { backgroundColor: colors.badSoft, color: colors.bad },
  badgeNeutral: { backgroundColor: colors.neutralSoft, color: colors.neutral },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.55,
    color: colors.inkSecondary,
    marginBottom: 4,
  },
  footer: {
    marginTop: 18,
    paddingTop: 10,
    borderTop: `1pt solid ${colors.border}`,
    fontSize: 8,
    color: colors.inkMuted,
    textAlign: 'center',
  },
})

// Heuristic: which variables are good when going down vs up
function badgeTone(label: string, sign: 1 | -1 | 0 | null): 'good' | 'bad' | 'neutral' {
  if (sign == null || sign === 0) return 'neutral'
  const lower = label.toLowerCase()
  const goodWhenDown = lower.includes('grasa') || lower.includes('cintura') || lower.includes('imc') || lower.includes('pliegues')
  const goodWhenUp = lower.includes('muscular')
  if (goodWhenDown) return sign < 0 ? 'good' : 'bad'
  if (goodWhenUp) return sign > 0 ? 'good' : 'bad'
  return 'neutral'
}

export function NutritionEvolutionReportPdfDocument({
  patientName,
  fromLabel,
  toLabel,
  rows,
  interpretation,
  brandLogoSrc,
}: {
  patientName: string
  fromLabel: string
  toLabel: string
  rows: EvolutionPdfRow[]
  interpretation: string
  brandLogoSrc?: string | null
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfBrandRibbon
          brandLogoSrc={brandLogoSrc}
          kicker="Haciéndolo Hábito · Nutrición"
          title="Informe de evolución antropométrica"
          subtitle="Apoyo para la devolución del paciente · No constituye diagnóstico médico"
        />

        <View style={styles.metaCard}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Paciente</Text>
            <Text style={styles.metaValue}>{patientName}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Control anterior</Text>
            <Text style={styles.metaValue}>{fromLabel}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Control actual</Text>
            <Text style={styles.metaValue}>{toLabel}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Resumen de variables</Text>
        <View style={styles.card}>
          {rows.length === 0 ? (
            <Text style={styles.paragraph}>
              No hay mediciones numéricas comparables entre ambas fechas.
            </Text>
          ) : (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Variable</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Antes</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Ahora</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Δ</Text>
              </View>
              {rows.map((r) => {
                const tone = badgeTone(r.label, r.deltaSign)
                const badgeStyle =
                  tone === 'good' ? styles.badgeGood : tone === 'bad' ? styles.badgeBad : styles.badgeNeutral
                return (
                  <View key={r.label} style={styles.tableRow}>
                    <Text style={styles.tableLabel}>{r.label}</Text>
                    <Text style={styles.tableValue}>{r.from}</Text>
                    <Text style={styles.tableValue}>{r.to}</Text>
                    <View style={styles.badgeWrap}>
                      <Text style={[styles.badge, badgeStyle]}>{r.delta}</Text>
                    </View>
                  </View>
                )
              })}
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Devolución</Text>
        <View style={styles.card}>
          {interpretation.split('\n').map((line, i) => (
            <Text key={i} style={styles.paragraph}>
              {line || ' '}
            </Text>
          ))}
        </View>

        <Text style={styles.footer}>
          Generado en Haciéndolo Hábito · Documento de apoyo, no reemplaza la evaluación clínica profesional.
        </Text>
      </Page>
    </Document>
  )
}
