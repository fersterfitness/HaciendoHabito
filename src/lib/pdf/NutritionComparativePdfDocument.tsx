import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { PdfBrandRibbon } from '@/lib/pdf/PdfBrandRibbon'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'

// Lectura neutra de la dirección del cambio (sin juicio clínico):
const UP = '#C2410C' // naranja-700: subió
const UP_BG = '#FFF1E8'
const DOWN = '#0F766E' // teal-700: descendió
const DOWN_BG = '#E6F4F1'
const FLAT = PDF_BRAND.muted
const FLAT_BG = PDF_BRAND.surface

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 38,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: PDF_BRAND.body,
  },

  // Hero del paciente
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: PDF_BRAND.dark,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  heroLeft: { flex: 1, paddingRight: 12 },
  heroKicker: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.primary,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  heroName: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.white,
  },
  datesCol: { alignItems: 'flex-end' },
  dateLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#94A3B8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  datePill: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 3,
  },
  datePillText: { fontSize: 8, color: '#E2E8F0', fontFamily: 'Helvetica-Bold' },
  dateConnector: {
    width: 16,
    height: 2,
    backgroundColor: PDF_BRAND.primary,
    borderRadius: 1,
    marginVertical: 3,
    alignSelf: 'flex-end',
  },

  // Encabezado de sección
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: { fontSize: 8, color: PDF_BRAND.muted, marginLeft: 5 },

  // KPI tiles (métricas generales)
  tilesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  tile: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 10,
    backgroundColor: PDF_BRAND.white,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  tileLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  tileValue: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
  },
  tileFootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tilePrev: { fontSize: 8, color: PDF_BRAND.muted },
  deltaPill: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  deltaPillText: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },

  // Tabla (perímetros / pliegues)
  table: {
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 14,
  },
  theadRow: {
    flexDirection: 'row',
    backgroundColor: PDF_BRAND.surface,
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  th: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.heading,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  trow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_BRAND.border,
  },
  trowZebra: { backgroundColor: '#FCFCFD' },
  trowLast: { borderBottomWidth: 0 },
  td: {
    fontSize: 9.5,
    color: PDF_BRAND.body,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  tdMetric: { fontFamily: 'Helvetica-Bold', color: PDF_BRAND.heading },
  tdDelta: { fontFamily: 'Helvetica-Bold' },
  colMetric: { flex: 2.4 },
  colVal: { flex: 1.4, textAlign: 'right' },
  colDelta: { flex: 1.6, textAlign: 'right' },

  emptyCard: {
    borderWidth: 1,
    borderColor: PDF_BRAND.border,
    borderRadius: 8,
    backgroundColor: PDF_BRAND.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  emptyNote: { fontSize: 9, color: PDF_BRAND.muted, fontStyle: 'italic' },

  // Interpretación
  interpCard: {
    marginTop: 2,
    borderWidth: 1,
    borderColor: PDF_BRAND.primaryMid,
    borderLeftWidth: 3,
    borderLeftColor: PDF_BRAND.primary,
    borderRadius: 8,
    backgroundColor: PDF_BRAND.primaryWash,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  interpLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_BRAND.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  interpText: { fontSize: 10, lineHeight: 1.5, color: PDF_BRAND.body },

  footer: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: PDF_BRAND.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: PDF_BRAND.muted },
})

interface DiffRow {
  label: string
  from: string
  to: string
  delta: string
}

interface NutritionComparativePdfDocumentProps {
  patientName: string
  fromLabel: string
  toLabel: string
  differences: DiffRow[]
  interpretation: string
  brandLogoSrc?: string | null
}

function deltaTone(delta: string): { color: string; bg: string } {
  const t = delta.trim()
  if (t === '—' || t === '') return { color: FLAT, bg: FLAT_BG }
  if (t.startsWith('+')) return { color: UP, bg: UP_BG }
  if (t.startsWith('-') || t.startsWith('−')) return { color: DOWN, bg: DOWN_BG }
  return { color: FLAT, bg: FLAT_BG }
}

function stripPrefix(label: string): string {
  return label.replace(/^(Perímetro|Pliegue):\s*/i, '')
}

function KpiTile({ row }: { row: DiffRow }) {
  const tone = deltaTone(row.delta)
  const hasCurrent = row.to.trim() !== '—'
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{row.label}</Text>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{hasCurrent ? row.to : '—'}</Text>
      </View>
      <View style={styles.tileFootRow}>
        <Text style={styles.tilePrev}>Anterior: {row.from}</Text>
        <View style={[styles.deltaPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.deltaPillText, { color: tone.color }]}>{row.delta}</Text>
        </View>
      </View>
    </View>
  )
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  return (
    <View style={styles.table}>
      <View style={styles.theadRow}>
        <Text style={[styles.th, styles.colMetric]}>Métrica</Text>
        <Text style={[styles.th, styles.colVal]}>Anterior</Text>
        <Text style={[styles.th, styles.colVal]}>Actual</Text>
        <Text style={[styles.th, styles.colDelta]}>Cambio</Text>
      </View>
      {rows.map((r, i) => {
        const isLast = i === rows.length - 1
        return (
          <View
            key={r.label}
            style={[styles.trow, i % 2 === 1 ? styles.trowZebra : {}, isLast ? styles.trowLast : {}]}
          >
            <Text style={[styles.td, styles.tdMetric, styles.colMetric]}>{stripPrefix(r.label)}</Text>
            <Text style={[styles.td, styles.colVal]}>{r.from}</Text>
            <Text style={[styles.td, styles.colVal]}>{r.to}</Text>
            <Text style={[styles.td, styles.tdDelta, styles.colDelta, { color: deltaTone(r.delta).color }]}>
              {r.delta}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function SectionHead({ title, color, count }: { title: string; color: string; count?: number }) {
  return (
    <View style={styles.sectionHead}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Text style={styles.sectionTitle}>{title}</Text>
      {count != null ? <Text style={styles.sectionCount}>· {count}</Text> : null}
    </View>
  )
}

export function NutritionComparativePdfDocument({
  patientName,
  fromLabel,
  toLabel,
  differences,
  interpretation,
  brandLogoSrc,
}: NutritionComparativePdfDocumentProps) {
  const hasData = (d: DiffRow) => d.from.trim() !== '—' || d.to.trim() !== '—'
  const generalRows = differences.filter(
    (d) => !/^(Perímetro|Pliegue):/i.test(d.label) && hasData(d),
  )
  const perimeterRows = differences.filter((d) => /^Perímetro:/i.test(d.label))
  const skinfoldRows = differences.filter((d) => /^Pliegue:/i.test(d.label))
  const anyRows = generalRows.length + perimeterRows.length + skinfoldRows.length > 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PdfBrandRibbon
          brandLogoSrc={brandLogoSrc}
          kicker="Haciéndolo Hábito · Nutrición"
          title="Diagnóstico comparativo antropométrico"
          subtitle="Evolución entre dos controles"
        />

        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroKicker}>Paciente</Text>
            <Text style={styles.heroName}>{patientName}</Text>
          </View>
          <View style={styles.datesCol}>
            <Text style={styles.dateLabel}>Fechas comparadas</Text>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{fromLabel}</Text>
            </View>
            <View style={styles.dateConnector} />
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{toLabel}</Text>
            </View>
          </View>
        </View>

        {!anyRows ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyNote}>
              No se detectaron métricas comparables en ambos archivos.
            </Text>
          </View>
        ) : (
          <>
            {generalRows.length > 0 ? (
              <>
                <SectionHead title="Métricas generales" color={PDF_BRAND.primary} />
                <View style={styles.tilesWrap}>
                  {generalRows.map((r) => (
                    <KpiTile key={r.label} row={r} />
                  ))}
                </View>
              </>
            ) : null}

            {perimeterRows.length > 0 ? (
              <>
                <SectionHead title="Perímetros" color={PDF_BRAND.secondary} count={perimeterRows.length} />
                <DiffTable rows={perimeterRows} />
              </>
            ) : null}

            {skinfoldRows.length > 0 ? (
              <>
                <SectionHead
                  title="Pliegues cutáneos"
                  color={PDF_BRAND.tertiary}
                  count={skinfoldRows.length}
                />
                <DiffTable rows={skinfoldRows} />
              </>
            ) : null}
          </>
        )}

        <SectionHead title="Interpretación profesional" color={PDF_BRAND.primary} />
        <View style={styles.interpCard}>
          <Text style={styles.interpLabel}>Devolución para el paciente</Text>
          <Text style={styles.interpText}>{interpretation}</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Haciéndolo Hábito · Diagnóstico comparativo antropométrico</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
