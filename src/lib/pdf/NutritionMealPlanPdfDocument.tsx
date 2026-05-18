import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { WeeklyPlanGridJson } from '@/lib/nutrition/weeklyPlanGrid'
import { columnLabels } from '@/lib/nutrition/weeklyPlanGrid'
import { PdfBrandRibbon } from '@/lib/pdf/PdfBrandRibbon'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'

type ProfessionalContact = {
  phone?: string
  email?: string
  instagram?: string
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
    fontSize: 8.2,
    fontFamily: 'Helvetica',
    color: '#111827',
    backgroundColor: '#F8FAFC',
  },
  ribbonRight: {
    alignItems: 'flex-end',
    maxWidth: 360,
  },
  professionalName: {
    fontSize: 10,
    color: PDF_BRAND.white,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 4,
  },
  contactBadge: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactBadgeText: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  contactText: {
    fontSize: 8.4,
    color: '#CBD5E1',
  },
  headerGrid: {
    marginBottom: 9,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  headerItem: {
    width: '48%',
    marginBottom: 4,
  },
  headerLabel: {
    fontSize: 6.8,
    color: '#6B7280',
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  headerValue: {
    fontSize: 8.8,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  mealBlock: {
    marginBottom: 6,
    borderWidth: 1,
    borderColor: PDF_BRAND.primaryMid,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  mealTitle: {
    backgroundColor: PDF_BRAND.primaryLight,
    paddingVertical: 5,
    paddingHorizontal: 6,
    fontSize: 8.7,
    fontFamily: 'Helvetica-Bold',
    color: '#C2410C',
  },
  colHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  colHeadCell: {
    flexGrow: 1,
    flexBasis: 0,
    padding: 4,
    fontSize: 6.3,
    fontFamily: 'Helvetica-Bold',
    color: '#4B5563',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
    textAlign: 'center',
  },
  rowCells: {
    flexDirection: 'row',
    minHeight: 44,
  },
  cell: {
    flexGrow: 1,
    flexBasis: 0,
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 6.8,
    lineHeight: 1.32,
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  footer: {
    marginTop: 4,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 6.4,
    color: '#6B7280',
  },
})

export interface NutritionMealPlanPdfDocumentProps {
  patientName: string
  genderLabel: string
  ageText: string | null
  weightKgText: string | null
  totalKcalLabel: string | null
  nextConsultLabel: string | null
  mergeWeekends: boolean
  grid: WeeklyPlanGridJson
  variant?: 'compact' | 'detailed'
  professionalName?: string | null
  professionalContact?: ProfessionalContact
  appLogoUrl?: string | null
}

export function NutritionMealPlanPdfDocument({
  patientName,
  genderLabel,
  ageText,
  weightKgText,
  totalKcalLabel,
  nextConsultLabel,
  mergeWeekends,
  grid,
  variant = 'detailed',
  professionalName,
  professionalContact,
  appLogoUrl,
}: NutritionMealPlanPdfDocumentProps) {
  const days = columnLabels(mergeWeekends)
  const isCompact = variant === 'compact'

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <PdfBrandRibbon
          variant="dark"
          brandLogoSrc={appLogoUrl}
          kicker="Haciéndolo Hábito · Nutrición"
          title="Plan de alimentación"
          subtitle="Distribución semanal personalizada"
          rightSlot={
            <View style={styles.ribbonRight}>
              <Text style={styles.professionalName}>Prof: {professionalName?.trim() || 'Nutricionista'}</Text>
              {professionalContact?.phone ? (
                <View style={styles.contactRow}>
                  <View style={[styles.contactBadge, { backgroundColor: PDF_BRAND.primary }]}>
                    <Text style={styles.contactBadgeText}>W</Text>
                  </View>
                  <Text style={styles.contactText}>{professionalContact.phone}</Text>
                </View>
              ) : null}
              {professionalContact?.email ? (
                <View style={styles.contactRow}>
                  <View style={[styles.contactBadge, { backgroundColor: '#EF4444' }]}>
                    <Text style={styles.contactBadgeText}>M</Text>
                  </View>
                  <Text style={styles.contactText}>{professionalContact.email}</Text>
                </View>
              ) : null}
              {professionalContact?.instagram ? (
                <View style={styles.contactRow}>
                  <View style={[styles.contactBadge, { backgroundColor: '#A855F7' }]}>
                    <Text style={styles.contactBadgeText}>I</Text>
                  </View>
                  <Text style={styles.contactText}>{professionalContact.instagram}</Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 7.8, color: '#CBD5E1', marginTop: 2 }}>Versión para paciente</Text>
            </View>
          }
        />

        <View style={styles.headerGrid}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <View style={[styles.headerItem, { width: '32%' }]}>
                <Text style={styles.headerLabel}>Nombre</Text>
                <Text style={styles.headerValue}>{patientName}</Text>
              </View>
              <View style={[styles.headerItem, { width: '32%' }]}>
                <Text style={styles.headerLabel}>Sexo</Text>
                <Text style={styles.headerValue}>{genderLabel}</Text>
              </View>
              <View style={[styles.headerItem, { width: '32%' }]}>
                <Text style={styles.headerLabel}>Edad</Text>
                <Text style={styles.headerValue}>{ageText ?? '—'}</Text>
              </View>
              <View style={[styles.headerItem, { width: '32%' }]}>
                <Text style={styles.headerLabel}>Peso actual</Text>
                <Text style={styles.headerValue}>{weightKgText ?? '—'}</Text>
              </View>
              <View style={[styles.headerItem, { width: '48%' }]}>
                <Text style={styles.headerLabel}>Valor calórico</Text>
                <Text style={styles.headerValue}>{totalKcalLabel ?? 'Consensuado en consulta'}</Text>
              </View>
              <View style={[styles.headerItem, { width: '48%' }]}>
                <Text style={styles.headerLabel}>Próxima consulta</Text>
                <Text style={styles.headerValue}>{nextConsultLabel ?? '—'}</Text>
              </View>
            </View>
        </View>

        {grid.mealRows.map((meal) => (
          <View key={meal.id} style={styles.mealBlock} wrap>
            <Text style={styles.mealTitle}>
              {meal.label}
              {meal.approxTime?.trim() ? ` (aprox. ${meal.approxTime.trim()})` : ''}
            </Text>
            <View style={styles.colHeaderRow}>
              {days.map((d, i) => (
                <Text key={i} style={i === days.length - 1 ? [styles.colHeadCell, { borderRightWidth: 0 }] : styles.colHeadCell}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={isCompact ? [styles.rowCells, { minHeight: 30 }] : styles.rowCells}>
              {meal.columns.map((txt, ci) => (
                <Text
                  key={ci}
                  style={
                    ci === meal.columns.length - 1
                      ? isCompact
                        ? [styles.cell, { fontSize: 6.2, lineHeight: 1.2 }, { borderRightWidth: 0 }]
                        : [styles.cell, { borderRightWidth: 0 }]
                      : isCompact
                        ? [styles.cell, { fontSize: 6.2, lineHeight: 1.2 }]
                        : styles.cell
                  }
                >
                  {txt?.trim() || '—'}
                </Text>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Documento generado desde la ficha nutricional del paciente.</Text>
          <Text style={styles.footerText}>Haciéndolo hábito</Text>
        </View>
      </Page>
    </Document>
  )
}
