import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PlanningFoodRowState, PlanningWorkbookStateV1 } from '@/lib/nutrition/planningWorkbookTypes'
import {
  parseLocaleNumberOrZero,
  scaledFromRefs,
  sumTotals,
  ZERO_TOTALS,
  type MacroTotals,
} from '@/lib/nutrition/planningCalculations'

/** Referencia didáctica: ~15 g por cucharada sopera (varía mucho según alimento). */
const GRAMOS_POR_CUCHARADA_SOPERA = 15

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** Aproximación orientativa de cucharadas soperas a partir de gramos. */
function approxCucharadasSoperas(grams: number): string {
  if (!Number.isFinite(grams) || grams <= 0) return '—'
  const n = grams / GRAMOS_POR_CUCHARADA_SOPERA
  if (n < 0.35) return '< ½ cda.'
  if (n < 1) return '~1 cda.'
  return `~${Math.round(n)} cdas.`
}

/** Etiqueta corta si el texto sugiere crudo/cocido (plantilla o nota). */
function etiquetaPreparacion(name: string, hint?: string): string | null {
  const t = `${name} ${hint ?? ''}`.toLowerCase()
  const hasCrudo = /\bcrudo\b/.test(t)
  const hasCocido = /\bcocido\b/.test(t)
  if (hasCrudo && hasCocido) return 'Crudo / cocido'
  if (hasCrudo) return 'Referencia crudo'
  if (hasCocido) return 'Referencia cocido'
  return null
}

function rowsInformados(rows: PlanningFoodRowState[]): PlanningFoodRowState[] {
  return rows.filter((r) => parseLocaleNumberOrZero(r.qtyG) > 0)
}

function grandTotals(wb: PlanningWorkbookStateV1): MacroTotals {
  let acc = ZERO_TOTALS
  for (const sec of wb.sections) {
    for (const r of rowsInformados(sec.rows)) {
      const q = parseLocaleNumberOrZero(r.qtyG)
      acc = sumTotals(
        acc,
        scaledFromRefs(q, {
          carbs: parseLocaleNumberOrZero(r.refCarbs),
          protein: parseLocaleNumberOrZero(r.refProt),
          fat: parseLocaleNumberOrZero(r.refFat),
          kcal: parseLocaleNumberOrZero(r.refKcal),
        }),
      )
    }
  }
  return acc
}

function sectionTotalsRows(rows: PlanningFoodRowState[]): MacroTotals {
  let acc = ZERO_TOTALS
  for (const r of rows) {
    const q = parseLocaleNumberOrZero(r.qtyG)
    if (q <= 0) continue
    acc = sumTotals(
      acc,
      scaledFromRefs(q, {
        carbs: parseLocaleNumberOrZero(r.refCarbs),
        protein: parseLocaleNumberOrZero(r.refProt),
        fat: parseLocaleNumberOrZero(r.refFat),
        kcal: parseLocaleNumberOrZero(r.refKcal),
      }),
    )
  }
  return acc
}

function truncate(str: string, max: number): string {
  const t = str.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

const styles = StyleSheet.create({
  pagePortraitEmpty: {
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  pageLandscape: {
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 32,
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  splitRow: {
    flexDirection: 'row',
    flex: 1,
  },
  sidebar: {
    width: '23%',
    minWidth: 115,
    marginRight: 10,
  },
  sidebarInner: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    height: '100%',
  },
  sidebarBrand: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  sidebarTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  sidebarSub: {
    fontSize: 6.5,
    color: '#94a3b8',
    marginTop: 4,
    lineHeight: 1.35,
  },
  sidebarBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sidebarBadgeTxt: {
    fontSize: 6,
    color: '#fdba74',
    fontFamily: 'Helvetica-Bold',
  },
  kvTiny: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  kvTinyLabel: {
    width: '52%',
    fontSize: 6.5,
    color: '#64748b',
  },
  kvTinyVal: {
    flex: 1,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
  },
  objTiny: {
    fontSize: 6.8,
    color: '#475569',
    lineHeight: 1.35,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  totalSidebar: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totalSidebarLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    marginBottom: 4,
  },
  totalSidebarNums: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#065f46',
    backgroundColor: '#ecfdf5',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    lineHeight: 1.35,
  },
  mainPanel: {
    flex: 1,
    minWidth: 0,
  },
  secCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingBottom: 8,
    flex: 1,
  },
  secHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  secTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secCount: {
    fontSize: 7,
    color: '#64748b',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  secHint: {
    fontSize: 6.8,
    color: '#64748b',
    paddingHorizontal: 10,
    paddingBottom: 6,
    lineHeight: 1.3,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginHorizontal: 6,
    borderRadius: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    marginHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableRowAlt: {
    backgroundColor: '#fafafa',
  },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#475569' },
  td: { fontSize: 6.8, color: '#0f172a' },
  tdNum: { fontSize: 6.8, color: '#334155', fontFamily: 'Helvetica' },
  tdMuted: { fontSize: 6.2, color: '#64748b', fontFamily: 'Helvetica' },
  subtotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 6,
    marginHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  subtotalText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
  },
  footerNote: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    fontSize: 6,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 1.35,
  },
  hintBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  hintText: {
    fontSize: 8,
    color: '#9a3412',
    lineHeight: 1.45,
  },
  emptySection: {
    fontSize: 9,
    color: '#9a3412',
    lineHeight: 1.45,
  },
})

/** Anchos tabla principal (suman ~100% del panel derecho). */
const W = {
  alimento: '17%',
  g: '6%',
  cda: '9%',
  nota: '13%',
  r1: '6%',
  r2: '6%',
  r3: '6%',
  r4: '7%',
  o1: '7%',
  o2: '7%',
  o3: '7%',
  o4: '8%',
}

function TableHeaderRow() {
  return (
    <View style={styles.tableHeader}>
      <Text style={[styles.th, { width: W.alimento }]}>Alimento</Text>
      <Text style={[styles.th, { width: W.g }]}>g</Text>
      <Text style={[styles.th, { width: W.cda }]}>~cdas.</Text>
      <Text style={[styles.th, { width: W.nota }]}>Nota / prep.</Text>
      <Text style={[styles.th, { width: W.r1 }]}>HC/100</Text>
      <Text style={[styles.th, { width: W.r2 }]}>P/100</Text>
      <Text style={[styles.th, { width: W.r3 }]}>G/100</Text>
      <Text style={[styles.th, { width: W.r4 }]}>kcal/100</Text>
      <Text style={[styles.th, { width: W.o1 }]}>HC</Text>
      <Text style={[styles.th, { width: W.o2 }]}>P</Text>
      <Text style={[styles.th, { width: W.o3 }]}>G</Text>
      <Text style={[styles.th, { width: W.o4 }]}>kcal</Text>
    </View>
  )
}

function FoodRows({
  activeRows,
}: {
  activeRows: PlanningFoodRowState[]
}) {
  return (
    <>
      {activeRows.map((r, idx) => {
        const q = parseLocaleNumberOrZero(r.qtyG)
        const refVals = {
          carbs: parseLocaleNumberOrZero(r.refCarbs),
          protein: parseLocaleNumberOrZero(r.refProt),
          fat: parseLocaleNumberOrZero(r.refFat),
          kcal: parseLocaleNumberOrZero(r.refKcal),
        }
        const out = scaledFromRefs(q, refVals)
        const prepAuto = etiquetaPreparacion(r.name, r.hint)
        const hintT = r.hint?.trim()
        const notaParts = [prepAuto, hintT].filter(Boolean)
        const uniqueNota = [...new Set(notaParts)].join(' · ')
        return (
          <View key={r.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
            <Text style={[styles.td, { width: W.alimento }]}>{r.name}</Text>
            <Text style={[styles.tdNum, { width: W.g }]}>{r.qtyG}</Text>
            <View style={{ width: W.cda }}>
              <Text style={styles.tdMuted}>{approxCucharadasSoperas(q)}</Text>
              <Text style={{ fontSize: 5.5, color: '#94a3b8', marginTop: 1 }}>
                ≈{GRAMOS_POR_CUCHARADA_SOPERA} g/cda.
              </Text>
            </View>
            <Text style={[styles.tdMuted, { width: W.nota }]}>{uniqueNota || '—'}</Text>
            <Text style={[styles.tdNum, { width: W.r1 }]}>{r.refCarbs}</Text>
            <Text style={[styles.tdNum, { width: W.r2 }]}>{r.refProt}</Text>
            <Text style={[styles.tdNum, { width: W.r3 }]}>{r.refFat}</Text>
            <Text style={[styles.tdNum, { width: W.r4 }]}>{r.refKcal}</Text>
            <Text style={[styles.tdNum, { width: W.o1 }]}>{fmt(out.carbsG)}</Text>
            <Text style={[styles.tdNum, { width: W.o2 }]}>{fmt(out.proteinG)}</Text>
            <Text style={[styles.tdNum, { width: W.o3 }]}>{fmt(out.fatG)}</Text>
            <Text style={[styles.tdNum, { width: W.o4 }]}>{fmt(out.kcal)}</Text>
          </View>
        )
      })}
    </>
  )
}

export function PlanningWorkbookPdfDocument({
  wb,
  professionalName,
}: {
  wb: PlanningWorkbookStateV1
  professionalName?: string | null
}) {
  const g = grandTotals(wb)
  const sectionsWithData = wb.sections
    .map((sec) => ({
      sec,
      activeRows: rowsInformados(sec.rows),
    }))
    .filter((x) => x.activeRows.length > 0)

  const firstBlock = sectionsWithData[0]
  const restSections = sectionsWithData.slice(1)
  const firstSub = firstBlock ? sectionTotalsRows(firstBlock.activeRows) : ZERO_TOTALS

  return (
    <Document>
      {sectionsWithData.length === 0 ? (
        <Page size="A4" style={styles.pagePortraitEmpty}>
          <View style={styles.hintBox}>
            <Text style={styles.emptySection}>
              No hay cantidades en gramos cargadas: no se puede armar la tabla. Completá el plan y volvé a generar el PDF.
            </Text>
          </View>
          <Text style={styles.footerNote} fixed>
            Haciendo Hábito
          </Text>
        </Page>
      ) : (
        <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
          <View style={styles.splitRow}>
            <View style={styles.sidebar}>
              <View style={styles.sidebarInner}>
                <View style={styles.sidebarBrand}>
                  <Text style={styles.sidebarTitle}>Plan HH</Text>
                  <Text style={styles.sidebarSub}>
                    {professionalName ? `${truncate(professionalName, 42)}\n` : ''}
                    Tabla principal →
                  </Text>
                  <View style={styles.sidebarBadge}>
                    <Text style={styles.sidebarBadgeTxt}>Solo ítems con gramos</Text>
                  </View>
                </View>

                <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#64748b', marginBottom: 4 }}>
                  Persona · ref.
                </Text>
                <View style={styles.kvTiny}>
                  <Text style={styles.kvTinyLabel}>TDEE M / F</Text>
                  <Text style={styles.kvTinyVal}>
                    {wb.person.tdeeMale || '—'} / {wb.person.tdeeFemale || '—'}
                  </Text>
                </View>
                <View style={styles.kvTiny}>
                  <Text style={styles.kvTinyLabel}>Peso · sexo</Text>
                  <Text style={styles.kvTinyVal}>
                    {wb.person.weightKg || '—'} kg ·{' '}
                    {wb.person.sex === 'M' ? 'M' : wb.person.sex === 'F' ? 'F' : '—'}
                  </Text>
                </View>
                <View style={styles.kvTiny}>
                  <Text style={styles.kvTinyLabel}>Kcal ej.</Text>
                  <Text style={styles.kvTinyVal}>{wb.proposedKcal || '—'}</Text>
                </View>
                <View style={styles.kvTiny}>
                  <Text style={styles.kvTinyLabel}>P / C / G g/kg</Text>
                  <Text style={styles.kvTinyVal}>
                    {wb.macroInputs.proteinGPerKg} · {wb.macroInputs.carbGPerKg} · {wb.macroInputs.fatGPerKg}
                  </Text>
                </View>

                <Text style={styles.objTiny}>{truncate(wb.objectives?.trim() || '—', 420)}</Text>

                <View style={styles.totalSidebar}>
                  <Text style={styles.totalSidebarLabel}>Total día</Text>
                  <Text style={styles.totalSidebarNums}>
                    HC {fmt(g.carbsG)} g{'\n'}Prot {fmt(g.proteinG)} g{'\n'}Grasas {fmt(g.fatG)} g{'\n'}
                    {fmt(g.kcal)} kcal
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.mainPanel}>
              <View style={styles.secCard}>
                <View style={styles.secHeadRow}>
                  <Text style={styles.secTitle}>{firstBlock.sec.title}</Text>
                  <Text style={styles.secCount}>
                    {firstBlock.activeRows.length} ítem{firstBlock.activeRows.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={styles.secHint}>{firstBlock.sec.quantityColumnHint}</Text>
                <TableHeaderRow />
                <FoodRows activeRows={firstBlock.activeRows} />
                <View style={styles.subtotal}>
                  <Text style={styles.subtotalText}>
                    Subtotal · HC {fmt(firstSub.carbsG)} · P {fmt(firstSub.proteinG)} · G {fmt(firstSub.fatG)} ·{' '}
                    {fmt(firstSub.kcal)} kcal
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.footerNote} fixed>
            ~Cdas. ≈ {GRAMOS_POR_CUCHARADA_SOPERA} g/cucharada sopera (orientativo; depende del alimento). Nota/prep.: texto de
            la planilla o detección crudo/cocido en nombre · HH
          </Text>
        </Page>
      )}

      {restSections.map(({ sec, activeRows }) => {
        const st = sectionTotalsRows(activeRows)
        return (
          <Page key={sec.key} size="A4" orientation="landscape" style={styles.pageLandscape}>
            <View style={styles.secCard}>
              <View style={styles.secHeadRow}>
                <Text style={styles.secTitle}>{sec.title}</Text>
                <Text style={styles.secCount}>
                  {activeRows.length} ítem{activeRows.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <Text style={styles.secHint}>{sec.quantityColumnHint}</Text>
              <TableHeaderRow />
              <FoodRows activeRows={activeRows} />
              <View style={styles.subtotal}>
                <Text style={styles.subtotalText}>
                  Subtotal · HC {fmt(st.carbsG)} · P {fmt(st.proteinG)} · G {fmt(st.fatG)} · {fmt(st.kcal)} kcal
                </Text>
              </View>
            </View>
            <Text style={styles.footerNote} fixed>
              ~Cdas. ≈ {GRAMOS_POR_CUCHARADA_SOPERA} g/cda. sopera · HH
            </Text>
          </Page>
        )
      })}
    </Document>
  )
}
