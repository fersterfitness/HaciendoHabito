import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import {
  buildGuideWeekLabels,
  buildRoutineProgressionGuide,
  exerciseLogSeriesCount,
  type GuideBlock,
  type GuideDaySection,
  type ProgressGuideBlock,
} from '@/lib/routine/routineProgressionGuide'
import { PDF_BRAND } from '@/lib/pdf/pdfBrandTheme'

const KIND_LABEL = {
  circuit: 'CIRCUITO',
  individual: 'INDIVIDUAL',
} as const

const DATA_LABEL = 'SERIES/REPS / PESO KG'

const C = {
  brand: PDF_BRAND.primary,
  ink: '#0F172A',
  white: '#FFFFFF',
  black: '#000000',
  greyDark: '#52525B',
  greyMid: '#D4D4D8',
  greyLight: '#F4F4F5',
  orangeWash: '#FFE0B2',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingHorizontal: 12,
    paddingBottom: 22,
    fontSize: 7,
    fontFamily: 'Helvetica',
    color: C.ink,
    backgroundColor: C.white,
  },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.greyMid,
  },
  heroTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },
  heroSubtitle: {
    fontSize: 8,
    color: C.greyDark,
    marginTop: 2,
  },
  heroCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 0.8,
    borderBottomColor: C.greyMid,
  },
  heroCompactTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },
  heroCompactMeta: {
    fontSize: 6.5,
    color: C.greyDark,
    textAlign: 'right',
  },
  heroMeta: {
    fontSize: 7,
    color: C.greyDark,
    textAlign: 'right',
  },
  daySection: {
    flex: 1,
  },
  dayBanner: {
    backgroundColor: C.brand,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 0,
  },
  dayBannerText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  table: {
    borderWidth: 0.8,
    borderColor: C.black,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: C.black,
  },
  exHeaderCell: {
    width: '18%',
    backgroundColor: C.black,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
  },
  exHeaderText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
  },
  weekHeaderCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
    alignItems: 'center',
  },
  weekHeaderText: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  weekHeaderDates: {
    fontSize: 5.5,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
    textAlign: 'center',
  },
  blockKindRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: C.black,
  },
  blockKindLabel: {
    width: '18%',
    backgroundColor: C.black,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockKindText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
  },
  blockNoteCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blockNoteText: {
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: C.black,
  },
  exerciseNameCell: {
    width: '18%',
    backgroundColor: C.black,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
    justifyContent: 'center',
  },
  exerciseNameText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
  },
  weekDataCell: {
    flex: 1,
    borderRightWidth: 0.8,
    borderRightColor: C.black,
    padding: 2,
  },
  prescriptionRow: {
    flexDirection: 'row',
    minHeight: 14,
  },
  dataLabelCol: {
    width: 28,
    borderRightWidth: 0.5,
    borderRightColor: C.greyMid,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 1,
  },
  dataLabelText: {
    fontSize: 4.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    textAlign: 'center',
    color: C.greyDark,
  },
  prescriptionText: {
    flex: 1,
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  logTable: {
    marginTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: C.greyMid,
  },
  logHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.greyMid,
    backgroundColor: C.greyLight,
  },
  logHeaderLabel: {
    width: 34,
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: C.greyMid,
  },
  logHeaderKg: {
    flex: 1,
    paddingVertical: 1,
    textAlign: 'center',
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
    borderRightWidth: 0.5,
    borderRightColor: C.greyMid,
  },
  logHeaderRep: {
    flex: 1,
    paddingVertical: 1,
    textAlign: 'center',
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
  },
  logRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: C.greyMid,
    minHeight: 11,
  },
  logRowLabel: {
    width: 34,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: C.greyMid,
    fontSize: 5.5,
    fontFamily: 'Helvetica-Bold',
  },
  logField: {
    flex: 1,
    borderRightWidth: 0.5,
    borderRightColor: C.greyMid,
    minHeight: 11,
  },
  logFieldLast: {
    flex: 1,
    minHeight: 11,
  },
  sensationsRow: {
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: C.greyMid,
  },
  sensationsLabel: {
    fontSize: 5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: C.greyDark,
    marginBottom: 1,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scaleDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 0.5,
    borderColor: C.greyDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleDotText: {
    fontSize: 4.5,
    fontFamily: 'Helvetica-Bold',
    color: C.greyDark,
  },
  finalSensation: {
    marginTop: 8,
    borderWidth: 0.8,
    borderColor: C.black,
    padding: 6,
  },
  finalSensationLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: C.ink,
    marginBottom: 5,
    textAlign: 'center',
  },
  finalScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  finalScaleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 0.8,
    borderColor: C.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalScaleDotText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },
  finalAnchor: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: C.greyDark,
    width: 48,
  },
  blockSpacer: {
    height: 3,
    backgroundColor: '#DC2626',
  },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    fontSize: 6,
    color: C.greyDark,
    textAlign: 'center',
  },
  logo: {
    width: 36,
    height: 36,
    objectFit: 'contain',
    marginBottom: 4,
  },
})

function weekHeaderBg(i: number) {
  return i % 2 === 0 ? C.greyDark : C.brand
}

function weekCellBg(i: number) {
  return i % 2 === 0 ? C.greyLight : C.orangeWash
}

function blockNoteBg(i: number) {
  return i % 2 === 0 ? C.greyMid : '#FFB74D'
}

const SCALE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1)

function SensationScale() {
  return (
    <View style={styles.sensationsRow}>
      <Text style={styles.sensationsLabel}>Sensación (marcá del 1 al 10)</Text>
      <View style={styles.scaleRow}>
        {SCALE_VALUES.map((n) => (
          <View key={n} style={styles.scaleDot}>
            <Text style={styles.scaleDotText}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function FinalSensationBlock() {
  return (
    <View style={styles.finalSensation} wrap={false}>
      <Text style={styles.finalSensationLabel}>Sensación final de la rutina · marcá del 1 al 10</Text>
      <View style={styles.finalScaleRow}>
        <Text style={styles.finalAnchor}>Muy suave</Text>
        {SCALE_VALUES.map((n) => (
          <View key={n} style={styles.finalScaleDot}>
            <Text style={styles.finalScaleDotText}>{n}</Text>
          </View>
        ))}
        <Text style={[styles.finalAnchor, { textAlign: 'right' }]}>Máximo esfuerzo</Text>
      </View>
    </View>
  )
}

function LogGrid({ seriesCount }: { seriesCount: number }) {
  const rows = ['Warm Up', ...Array.from({ length: seriesCount }, (_, i) => `${i + 1}° Serie`)]

  return (
    <View style={styles.logTable}>
      <View style={styles.logHeaderRow}>
        <View style={styles.logHeaderLabel} />
        <Text style={styles.logHeaderKg}>Kg</Text>
        <Text style={styles.logHeaderRep}>Rep.</Text>
      </View>
      {rows.map((label) => (
        <View key={label} style={styles.logRow}>
          <Text style={styles.logRowLabel}>{label}</Text>
          <View style={styles.logField} />
          <View style={styles.logFieldLast} />
        </View>
      ))}
      <SensationScale />
    </View>
  )
}

function ExerciseWeekCell({
  prescription,
  seriesCount,
  weekIdx,
  showDataLabel,
}: {
  prescription: string | null
  seriesCount: number
  weekIdx: number
  showDataLabel: boolean
}) {
  return (
    <View style={[styles.weekDataCell, { backgroundColor: weekCellBg(weekIdx) }]}>
      <View style={styles.prescriptionRow}>
        {showDataLabel ? (
          <View style={styles.dataLabelCol}>
            <Text style={styles.dataLabelText}>{DATA_LABEL}</Text>
          </View>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text style={styles.prescriptionText}>{prescription?.trim() || ''}</Text>
      </View>
      <LogGrid seriesCount={seriesCount} />
    </View>
  )
}

function BlockRows({
  block,
  section,
  blocks,
}: {
  block: GuideBlock
  section: GuideDaySection
  blocks: ProgressGuideBlock[]
}) {
  return (
    <>
      {block.exercises.map((row, exIdx) => (
        <View key={row.key} style={styles.exerciseRow} wrap={false}>
          <View style={styles.exerciseNameCell}>
            <Text style={styles.exerciseNameText}>{row.exerciseName}</Text>
          </View>
          {row.weeks.map((cell, weekIdx) => {
            const seriesCount = exerciseLogSeriesCount({
              blocks,
              dayKey: section.dayKey,
              exerciseId: row.exerciseId,
              weekIdx,
              guideBlock: block,
              prescription: cell,
            })
            return (
              <ExerciseWeekCell
                key={weekIdx}
                prescription={cell}
                seriesCount={seriesCount}
                weekIdx={weekIdx}
                showDataLabel={exIdx === 0}
              />
            )
          })}
        </View>
      ))}
    </>
  )
}

function DayTable({
  section,
  weekLabels,
  blocks,
}: {
  section: GuideDaySection
  weekLabels: { label: string; dates: string | null }[]
  blocks: ProgressGuideBlock[]
}) {
  return (
    <View style={styles.daySection}>
      <View style={styles.dayBanner}>
        <Text style={styles.dayBannerText}>{section.dayTitle}</Text>
      </View>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <View style={styles.exHeaderCell}>
            <Text style={styles.exHeaderText}>Ejercicio / bloque</Text>
          </View>
          {weekLabels.map((w, i) => (
            <View
              key={i}
              style={[styles.weekHeaderCell, { backgroundColor: weekHeaderBg(i), borderRightWidth: i === weekLabels.length - 1 ? 0 : 0.8 }]}
            >
              <Text style={styles.weekHeaderText}>{w.label}</Text>
              {w.dates ? <Text style={styles.weekHeaderDates}>{w.dates}</Text> : null}
            </View>
          ))}
        </View>

        {section.blocks.map((block, blockIdx) => (
          <View key={block.key}>
            {blockIdx > 0 ? <View style={styles.blockSpacer} /> : null}
            <View style={styles.blockKindRow} wrap={false}>
              <View style={styles.blockKindLabel}>
                <Text style={styles.blockKindText}>{KIND_LABEL[block.kind]}</Text>
              </View>
              {block.headerNotesByWeek.map((note, i) => (
                <View
                  key={i}
                  style={[
                    styles.blockNoteCell,
                    {
                      backgroundColor: blockNoteBg(i),
                      borderRightWidth: i === block.headerNotesByWeek.length - 1 ? 0 : 0.8,
                    },
                  ]}
                >
                  <Text style={styles.blockNoteText}>{note?.trim() || ''}</Text>
                </View>
              ))}
            </View>
            <BlockRows block={block} section={section} blocks={blocks} />
          </View>
        ))}
      </View>
      <FinalSensationBlock />
    </View>
  )
}

function PageHeader({
  routineName,
  studentName,
  dateStr,
  brandLogoSrc,
  compact,
}: {
  routineName: string
  studentName?: string | null
  dateStr: string
  brandLogoSrc?: string | null
  compact?: boolean
}) {
  if (compact) {
    return (
      <View style={styles.heroCompact} fixed>
        <Text style={styles.heroCompactTitle}>
          Registro de progreso · {routineName}
          {studentName?.trim() ? ` · ${studentName.trim()}` : ''}
        </Text>
        <Text style={styles.heroCompactMeta}>{dateStr}</Text>
      </View>
    )
  }

  return (
    <View style={styles.hero}>
      <View style={{ flex: 1 }}>
        {brandLogoSrc ? <Image src={brandLogoSrc} style={styles.logo} /> : null}
        <Text style={styles.heroTitle}>Registro de progreso</Text>
        <Text style={styles.heroSubtitle}>{routineName}</Text>
        {studentName?.trim() ? (
          <Text style={[styles.heroSubtitle, { marginTop: 3, fontFamily: 'Helvetica-Bold', color: C.ink }]}>
            {studentName.trim()}
          </Text>
        ) : null}
      </View>
      <View>
        <Text style={styles.heroMeta}>Para imprimir y completar a mano</Text>
        <Text style={styles.heroMeta}>Objetivo · series/reps/peso · registro Kg/Rep · sensaciones</Text>
        <Text style={[styles.heroMeta, { marginTop: 4 }]}>{dateStr}</Text>
      </View>
    </View>
  )
}

function DayPage({
  section,
  weekLabels,
  blocks,
  routineName,
  studentName,
  dateStr,
  brandLogoSrc,
  dayIndex,
  totalDays,
}: {
  section: GuideDaySection
  weekLabels: { label: string; dates: string | null }[]
  blocks: ProgressGuideBlock[]
  routineName: string
  studentName?: string | null
  dateStr: string
  brandLogoSrc?: string | null
  dayIndex: number
  totalDays: number
}) {
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      <PageHeader
        routineName={routineName}
        studentName={studentName}
        dateStr={dateStr}
        brandLogoSrc={brandLogoSrc}
        compact={dayIndex > 0}
      />
      <DayTable section={section} weekLabels={weekLabels} blocks={blocks} />
      <Text style={styles.footer} fixed>
        {section.dayTitle} · {dayIndex + 1}/{totalDays} · Registro de progreso · {routineName}
      </Text>
    </Page>
  )
}

export type RoutineProgressLogPdfProps = {
  routineName: string
  studentName?: string | null
  blocks: ProgressGuideBlock[]
  generatedAt?: Date
  brandLogoSrc?: string | null
}

export function RoutineProgressLogPdfDocument({
  routineName,
  studentName,
  blocks,
  generatedAt,
  brandLogoSrc,
}: RoutineProgressLogPdfProps) {
  const sections = buildRoutineProgressionGuide(blocks)
  const weekLabels = buildGuideWeekLabels(blocks)
  const issued = generatedAt ?? new Date()
  const dateStr = issued.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Document>
      {sections.length === 0 ? (
        <Page size="A4" orientation="landscape" style={styles.page}>
          <PageHeader
            routineName={routineName}
            studentName={studentName}
            dateStr={dateStr}
            brandLogoSrc={brandLogoSrc}
          />
          <Text style={{ fontSize: 9, color: C.greyDark }}>Sin semanas cargadas en la rutina.</Text>
        </Page>
      ) : (
        sections.map((section, dayIndex) => (
          <DayPage
            key={section.dayKey}
            section={section}
            weekLabels={weekLabels}
            blocks={blocks}
            routineName={routineName}
            studentName={studentName}
            dateStr={dateStr}
            brandLogoSrc={brandLogoSrc}
            dayIndex={dayIndex}
            totalDays={sections.length}
          />
        ))
      )}
    </Document>
  )
}
