import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { fersterGoalLabel } from '@/lib/fersterIntakeLabels'
import {
  buildStudentQuantitySummaryLines,
  fmtGramOrDash,
  GRAMOS_POR_CUCHARADA_SOPERA,
  approxCucharadasSoperasLabel,
  preparacionAlumnoLine,
} from '@/lib/nutrition/mealPickPresentation'
import { parseLocaleNumberOrZero } from '@/lib/nutrition/planningCalculations'
import type {
  MealDistributionState,
  MealSlotKey,
  MealSlotPick,
  PlanningFoodRowState,
  PlanningWorkbookStateV1,
} from '@/lib/nutrition/planningWorkbookTypes'
import {
  DEFAULT_MEAL_DISTRIBUTION,
  MEAL_SLOT_LABELS,
  mealDistributionHasMealPicks,
} from '@/lib/nutrition/planningWorkbookTypes'

function truncate(str: string, max: number): string {
  const t = str.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

const C = {
  /** Acento marca en PDF de alimentación (verde esmeralda). */
  brand: '#059669',
  brandSoftBg: '#f0fdf4',
  brandMutedBg: '#ecfdf5',
  brandBorder: '#a7f3d0',
  brandDarkText: '#065f46',
  dark: '#0f172a',
  body: '#334155',
  muted: '#64748b',
  border: '#e2e8f0',
  bgSoft: '#f8fafc',
}

/** Franjas tipo «semana» en tablas de apéndice (sección par/impar). */
const SECTION_STRIPE = ['#f1f5f9', '#fff7ed'] as const

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingHorizontal: 28,
    paddingBottom: 38,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    color: C.dark,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  headerBrandBar: {
    width: 3,
    height: 36,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginRight: 10,
  },
  logoImg: { width: 34, height: 34, marginRight: 10, borderRadius: 6 },
  brandTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    lineHeight: 1.2,
  },
  brandSub: {
    fontSize: 7.5,
    color: C.muted,
    marginTop: 3,
    lineHeight: 1.35,
  },
  headerRight: {
    alignItems: 'flex-end',
    maxWidth: 120,
  },
  headerDate: {
    fontSize: 7,
    color: C.muted,
    textAlign: 'right',
  },
  personStrip: {
    backgroundColor: C.bgSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  personStripText: {
    fontSize: 7.8,
    color: C.body,
    lineHeight: 1.35,
  },
  objectivesBox: {
    backgroundColor: C.brandSoftBg,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  objectivesLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  objectivesText: {
    fontSize: 8.5,
    color: C.body,
    lineHeight: 1.35,
  },
  hintBox: {
    backgroundColor: C.brandMutedBg,
    borderWidth: 1,
    borderColor: C.brandBorder,
    borderRadius: 6,
    padding: 8,
  },
  hintText: {
    fontSize: 8,
    color: C.brandDarkText,
    lineHeight: 1.35,
  },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    fontSize: 6.5,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.3,
  },
  sectionHeading: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    marginBottom: 4,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sectionIntro: {
    fontSize: 6.8,
    color: C.muted,
    marginBottom: 7,
    lineHeight: 1.35,
  },
  appendixTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    marginTop: 4,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  appendixHint: {
    fontSize: 7,
    color: C.muted,
    marginBottom: 5,
    lineHeight: 1.35,
  },
  secAppendixTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    marginTop: 6,
    marginBottom: 3,
  },
  mealMomentOuter: {
    marginBottom: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  mealHeaderStrip: {
    backgroundColor: '#eef2f7',
    borderBottomWidth: 1,
    borderBottomColor: '#dce3ec',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  mealTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mealBody: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  pickCard: {
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickCardLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  pickTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  pickColFood: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    paddingRight: 8,
  },
  pickColQty: {
    width: '34%',
    maxWidth: 148,
    flexShrink: 0,
  },
  pickFoodName: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    lineHeight: 1.25,
  },
  pickQtyLine: {
    fontSize: 7,
    color: '#475569',
    lineHeight: 1.3,
    textAlign: 'right',
  },
  pickDetailBlock: {
    width: '100%',
    marginTop: 4,
  },
  pickPrepLine: {
    fontSize: 6.8,
    color: '#047857',
    lineHeight: 1.3,
  },
  pickHintLine: {
    fontSize: 6.5,
    color: C.muted,
    marginTop: 3,
    lineHeight: 1.28,
    fontStyle: 'italic',
  },
  notesWrap: {
    marginTop: 8,
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#dce3ec',
    borderStyle: 'solid',
    backgroundColor: '#f8fafc',
  },
  notesSectionLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notesSectionBody: {
    fontSize: 8,
    color: '#475569',
    lineHeight: 1.35,
  },
  appendixFoodBlock: {
    marginBottom: 6,
  },
  appendixRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  appendixFoodName: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.dark,
    lineHeight: 1.25,
  },
  appendixQtyCell: {
    fontSize: 7,
    color: '#475569',
    lineHeight: 1.3,
    textAlign: 'right',
  },
  objectivesTable: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.brandBorder,
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  objectivesTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  objectivesTableRowLast: {
    borderBottomWidth: 0,
  },
  objectivesTableCellLabel: {
    width: '32%',
    backgroundColor: C.brandMutedBg,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    textTransform: 'uppercase',
  },
  objectivesTableCellValue: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    fontSize: 8.5,
    color: C.body,
    lineHeight: 1.35,
  },
  orientativeBox: {
    marginTop: 10,
    padding: 8,
    backgroundColor: C.bgSoft,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  orientativeTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orientativeBody: {
    fontSize: 7.5,
    color: C.body,
    lineHeight: 1.42,
  },
  secAppendixStrip: {
    marginTop: 2,
    marginBottom: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
  },
})

function mealNotesHaveText(md: MealDistributionState): boolean {
  const parts = [
    md.desayuno,
    md.mediaManana,
    md.almuerzo,
    md.mediaTarde,
    md.merienda,
    md.cena,
  ]
  return parts.some((p) => (p ?? '').trim().length > 0)
}

function distributionMomentsHaveContent(md: MealDistributionState): boolean {
  return mealNotesHaveText(md) || mealDistributionHasMealPicks(md)
}

function rowsWithGrams(rows: PlanningFoodRowState[]): PlanningFoodRowState[] {
  return rows.filter((r) => parseLocaleNumberOrZero(r.qtyG) > 0)
}

/** Objetivo en texto libre o código Ferster copiado desde la ficha → etiqueta legible en PDF. */
function objectiveTextForPdf(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return fersterGoalLabel(t)
}

function hintForPick(p: MealSlotPick, wb: PlanningWorkbookStateV1): string | undefined {
  const snap = p.hintSnapshot?.trim()
  if (snap) return snap
  if (p.kind === 'plan_row') {
    const sec = wb.sections.find((s) => s.key === p.secKey)
    const row = sec?.rows.find((r) => r.id === p.rowId)
    return row?.hint?.trim()
  }
  return undefined
}

function pickQtyPresentationForStudent(
  p: MealSlotPick,
  wb: PlanningWorkbookStateV1,
): { qtyPresentation?: 'grams' | 'units'; unitsLabel?: string } {
  const ulSnap = p.unitsLabel?.trim()
  const modeSnap = p.qtyPresentation
  if (modeSnap === 'units' && ulSnap) return { qtyPresentation: 'units', unitsLabel: ulSnap }
  if (p.kind === 'plan_row') {
    const sec = wb.sections.find((s) => s.key === p.secKey)
    const row = sec?.rows.find((r) => r.id === p.rowId)
    const ul = row?.unitsLabel?.trim()
    if (row?.qtyPresentation === 'units' && ul) return { qtyPresentation: 'units', unitsLabel: ul }
  }
  return {}
}

/** Primera línea (cantidades) alineada a la derecha; resto debajo a ancho completo. */
function splitMultilineBody(text: string): { first: string; rest: string[] } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  return { first: lines[0] ?? '', rest: lines.slice(1) }
}

/** Versión corta para el cuerpo compacto del PDF. */
function appendixDetailLinesCompact(row: PlanningFoodRowState): string {
  const q = parseLocaleNumberOrZero(row.qtyG)
  const cdas = approxCucharadasSoperasLabel(q)
  const prep = preparacionAlumnoLine(row.name, row.hint)
  const hint = row.hint?.trim()
  const ul = row.unitsLabel?.trim()
  const base =
    row.qtyPresentation === 'units' && ul
      ? `${ul} u. (~${fmtGramOrDash(q)} g)`
      : `${fmtGramOrDash(q)} g · ~${cdas}`
  const lines = [base]
  if (prep) lines.push(prep)
  else if (hint) lines.push(truncate(`Nota: ${hint}`, 140))
  return lines.join('\n')
}

function formatGeneratedDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return ''
  }
}

/** Una línea con datos de referencia del alumno (workbook + nombre opcional). */
function formatPersonStrip(wb: PlanningWorkbookStateV1, studentName?: string | null): string | null {
  const p = wb.person
  const bits: string[] = []
  const sn = studentName?.trim()
  if (sn) bits.push(`Alumno/a: ${sn}`)
  const w = p.weightKg?.trim()
  if (w) bits.push(`${w} kg`)
  if (p.sex === 'M') bits.push('M')
  else if (p.sex === 'F') bits.push('F')
  const pk = wb.proposedKcal?.trim()
  if (pk) bits.push(`Meta ~${pk} kcal`)
  const tm = p.tdeeMale?.trim()
  const tf = p.tdeeFemale?.trim()
  if (p.sex === 'M' && tm) bits.push(`Mant. ref. ~${tm} kcal`)
  else if (p.sex === 'F' && tf) bits.push(`Mant. ref. ~${tf} kcal`)
  else if (tm || tf) bits.push(`Mant. ref. ~${tm ?? '—'} / ~${tf ?? '—'} kcal (h/m)`)
  if (bits.length === 0) return null
  return bits.join(' · ')
}

export function PlanningWorkbookPdfDocument({
  wb,
  professionalName,
  studentName,
  brandLogoSrc,
  generatedAt,
}: {
  wb: PlanningWorkbookStateV1
  professionalName?: string | null
  /** Nombre para la franja del alumno (además de peso / sexo / kcal del workbook). */
  studentName?: string | null
  brandLogoSrc?: string | null
  generatedAt?: Date
}) {
  const issued = generatedAt ?? new Date()
  const personLine = formatPersonStrip(wb, studentName)
  const md = wb.mealDistribution ?? DEFAULT_MEAL_DISTRIBUTION
  const objectivesRaw = wb.objectives?.trim() ?? ''
  const objectivesDisplay = objectiveTextForPdf(objectivesRaw)
  const hasDistMoments = distributionMomentsHaveContent(md)
  const hasObjective = objectivesDisplay.length > 0

  const person = wb.person
  const macro = wb.macroInputs
  const sexTxt = person.sex === 'M' ? 'Hombre' : person.sex === 'F' ? 'Mujer' : ''
  const objectiveGridRows: [string, string][] = [
    ['Objetivo', hasObjective ? objectivesDisplay : '—'],
    ['Peso (kg)', person.weightKg?.trim() || '—'],
    ['Altura (cm)', person.heightCm?.trim() || '—'],
    ['Edad (años)', person.ageYears?.trim() || '—'],
    ['Sexo · ref.', sexTxt || '—'],
    ['TDEE ref. hombre', person.tdeeMale?.trim() || '—'],
    ['TDEE ref. mujer', person.tdeeFemale?.trim() || '—'],
    ['Meta kcal día', wb.proposedKcal?.trim() || '—'],
    ['Prot. (g/kg)', macro.proteinGPerKg?.trim() || '—'],
    ['HC (g/kg)', macro.carbGPerKg?.trim() || '—'],
    ['Grasas (g/kg)', macro.fatGPerKg?.trim() || '—'],
  ]
  const hasObjectivesTable = objectiveGridRows.some(([, v]) => v !== '—')

  const sectionsWithGrams = wb.sections
    .map((sec) => ({
      sec,
      rows: rowsWithGrams(sec.rows),
    }))
    .filter((x) => x.rows.length > 0)

  const hasGramPlan = sectionsWithGrams.length > 0

  const orientGuideRaw = wb.studentOrientativeGuide?.trim() ?? ''

  const hasPdfBody =
    hasDistMoments || hasObjective || hasGramPlan || hasObjectivesTable || orientGuideRaw.length > 0

  const mealLayout: { slot: MealSlotKey; title: string; notes: string }[] = [
    { slot: 'desayuno', title: MEAL_SLOT_LABELS.desayuno, notes: md.desayuno },
    ...(md.includeMidMorning
      ? [{ slot: 'mediaManana' as const, title: MEAL_SLOT_LABELS.mediaManana, notes: md.mediaManana }]
      : []),
    { slot: 'almuerzo', title: MEAL_SLOT_LABELS.almuerzo, notes: md.almuerzo },
    ...(md.includeMidAfternoon
      ? [{ slot: 'mediaTarde' as const, title: MEAL_SLOT_LABELS.mediaTarde, notes: md.mediaTarde }]
      : []),
    { slot: 'merienda', title: MEAL_SLOT_LABELS.merienda, notes: md.merienda },
    { slot: 'cena', title: MEAL_SLOT_LABELS.cena, notes: md.cena },
  ]

  const profBit = professionalName?.trim()
    ? ` · Prof.: ${truncate(professionalName.trim(), 36)}`
    : ''

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerBrandBar} />
            {brandLogoSrc ? <Image src={brandLogoSrc} style={styles.logoImg} /> : null}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.brandTitle}>Haciéndolo Hábito</Text>
              <Text style={styles.brandSub}>Plan de alimentación{profBit}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerDate}>{formatGeneratedDate(issued)}</Text>
          </View>
        </View>

        {personLine ? (
          <View style={styles.personStrip}>
            <Text style={styles.personStripText}>{personLine}</Text>
          </View>
        ) : null}

        {!hasPdfBody ? (
          <View style={styles.hintBox}>
            <Text style={styles.hintText}>
              Completá al menos una de estas opciones en la app y volvé a generar el PDF: texto en «Distribución del día»
              (desayuno, almuerzo, etc.), un objetivo, o cantidades en gramos en las tablas del plan.
            </Text>
          </View>
        ) : (
          <>
            {hasObjectivesTable ? (
              <View style={styles.objectivesTable}>
                <View style={{ paddingBottom: 4, paddingHorizontal: 8, paddingTop: 6, backgroundColor: C.brandSoftBg }}>
                  <Text style={styles.objectivesLabel}>Resumen · datos del plan (orientativo)</Text>
                </View>
                {objectiveGridRows.map(([label, val], ri) => (
                  <View
                    key={label}
                    style={[styles.objectivesTableRow, ri === objectiveGridRows.length - 1 ? styles.objectivesTableRowLast : {}]}
                  >
                    <View style={styles.objectivesTableCellLabel}>
                      <Text>{label}</Text>
                    </View>
                    <View style={styles.objectivesTableCellValue}>
                      <Text>{val}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {hasDistMoments ? (
              <>
                <Text style={styles.sectionHeading}>Distribución por momentos</Text>
                <Text style={styles.sectionIntro}>
                  Gramos orientativos; en untables/semillas cdas. (~{GRAMOS_POR_CUCHARADA_SOPERA} g/cda.). En carnes/pescado/huevo suele mostrarse solo gramos y referencia en plato (ver tip por fila).
                </Text>
                {mealLayout
                  .filter((b) => {
                    const picks = md.picksByMeal?.[b.slot] ?? []
                    return picks.length > 0 || b.notes.trim().length > 0
                  })
                  .map((b) => {
                    const picks = md.picksByMeal?.[b.slot] ?? []
                    return (
                      <View key={b.slot} style={styles.mealMomentOuter}>
                        <View style={styles.mealHeaderStrip}>
                          <Text style={styles.mealTitle}>{b.title}</Text>
                        </View>
                        <View style={styles.mealBody}>
                          {picks.map((p, pi) => {
                            const hint = hintForPick(p, wb)
                            const qPres = pickQtyPresentationForStudent(p, wb)
                            const { gramsLine, prepLine } = buildStudentQuantitySummaryLines({
                              gramsStr: p.qtyG,
                              nameSnapshot: p.nameSnapshot,
                              hint,
                              preparation: p.preparation,
                              compact: true,
                              qtyPresentation: qPres.qtyPresentation,
                              unitsLabel: qPres.unitsLabel,
                            })
                            const last = pi === picks.length - 1 && !b.notes.trim()
                            return (
                              <View key={p.id} style={[styles.pickCard, last ? styles.pickCardLast : {}]}>
                                <View style={styles.pickTopRow}>
                                  <View style={styles.pickColFood}>
                                    <Text style={styles.pickFoodName}>{p.nameSnapshot}</Text>
                                  </View>
                                  <View style={styles.pickColQty}>
                                    <Text style={styles.pickQtyLine}>{gramsLine}</Text>
                                  </View>
                                </View>
                                <View style={styles.pickDetailBlock}>
                                  {prepLine ? <Text style={styles.pickPrepLine}>{prepLine}</Text> : null}
                                  {hint ? (
                                    <Text style={styles.pickHintLine}>Tip / unidad: {truncate(hint, 160)}</Text>
                                  ) : null}
                                </View>
                              </View>
                            )
                          })}
                          {b.notes.trim() ? (
                            <View style={styles.notesWrap}>
                              <Text style={styles.notesSectionLabel}>Observaciones</Text>
                              <Text style={styles.notesSectionBody}>{b.notes.trim()}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    )
                  })}
              </>
            ) : null}

            {hasGramPlan ? (
              <View>
                {sectionsWithGrams.length > 0 ? (
                  <>
                    <Text style={styles.appendixTitle}>Alimentos del plan (gramos)</Text>
                    <Text style={styles.appendixHint}>
                      Tablas del armado en la app; podés cruzarlo con la distribución por momentos arriba.
                    </Text>
                    {sectionsWithGrams.map(({ sec, rows }) => {
                      const si = Math.max(0, wb.sections.findIndex((s) => s.key === sec.key))
                      const stripeBg = SECTION_STRIPE[si % 2]
                      return (
                      <View key={sec.key} style={[styles.secAppendixStrip, { backgroundColor: stripeBg }]}>
                        <Text style={styles.secAppendixTitle}>{sec.title}</Text>
                        {rows.map((r) => {
                          const appBody = splitMultilineBody(appendixDetailLinesCompact(r))
                          return (
                            <View key={r.id} style={styles.appendixFoodBlock}>
                              <View style={styles.appendixRow}>
                                <View style={styles.pickColFood}>
                                  <Text style={styles.appendixFoodName}>{r.name}</Text>
                                </View>
                                <View style={styles.pickColQty}>
                                  <Text style={styles.appendixQtyCell}>{appBody.first}</Text>
                                </View>
                              </View>
                              {appBody.rest.map((line, li) => (
                                <Text
                                  key={li}
                                  style={[styles.pickPrepLine, li === 0 ? { marginTop: 3 } : { marginTop: 2 }]}
                                >
                                  {line}
                                </Text>
                              ))}
                            </View>
                          )
                        })}
                      </View>
                      )
                    })}
                  </>
                ) : null}
              </View>
            ) : null}

            {orientGuideRaw.length > 0 ? (
              <View style={styles.orientativeBox}>
                <Text style={styles.orientativeTitle}>Guía orientativa · hortalizas, equivalencias y proteínas</Text>
                <Text style={styles.orientativeBody}>{truncate(orientGuideRaw, 3500)}</Text>
              </View>
            ) : null}
          </>
        )}

        <Text style={styles.footer} fixed>
          No es prescripción médica · orientación general: ajustá con tu profesional. Imágenes de plato pueden sumarse como
          ayuda visual en próximas versiones.
        </Text>
      </Page>
    </Document>
  )
}
