import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from '@react-pdf/renderer'
import type { Routine, Student, RoutineBlock, RoutineDay, RoutineExercise, Exercise } from '@/types/database'
import { parseExerciseMeta, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'
import { formatWarmupDisplayLines } from '@/lib/routine/warmupNotesFormat'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExerciseFull = RoutineExercise & { exercise?: Exercise }
export type DayFull = RoutineDay & { exercises: ExerciseFull[] }
export type BlockFull = RoutineBlock & { days: DayFull[] }
export type RoutineFull = Routine & { student?: Student }

export interface RoutinePdfData {
  routine: RoutineFull
  blocks: BlockFull[]
  generatedAt: Date
  /** Último 1RM por ejercicio (kg) para convertir %1RM → kg en el PDF */
  rmByExerciseId?: Record<string, number>
  /** Logo Ferster (data URI o URL absoluta). */
  brandLogoSrc?: string | null
}

function weekAnchorId(weekIndex: number): string {
  return `week-${weekIndex}`
}

function dayAnchorId(weekIndex: number, dayIndex: number): string {
  return `w-${weekIndex}-d-${dayIndex}`
}

function normalizeDayToken(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** "Día 1", "Dia 1", etc. — redundante con la pastilla DÍA N del encabezado. */
function isGenericDayLabel(name: string, dayIndex: number): boolean {
  const n = normalizeDayToken(name)
  if (!n) return true
  const num = dayIndex + 1
  return n === `dia ${num}` || n === `day ${num}`
}

function tocDayLabel(day: RoutineDay, dayIndex: number): string {
  const num = dayIndex + 1
  const name = day.day_name?.trim() ?? ''
  const focus = day.muscle_focus?.trim() ?? ''
  if (!isGenericDayLabel(name, dayIndex)) {
    return focus ? `Día ${num} · ${name} · ${focus}` : `Día ${num} · ${name}`
  }
  if (focus) return `Día ${num} · ${focus}`
  return `Día ${num}`
}

// ─── Paleta (monocromática + acento naranja puntual) ───────────────────────────

const R = 3

const C = {
  brand: '#FF8C00',
  ink: '#0F172A',
  heading: '#1E293B',
  body: '#475569',
  muted: '#94A3B8',
  mutedLight: '#CBD5E1',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  surface: '#F8FAFC',
  white: '#FFFFFF',
  rowAlt: '#FAFAFA',
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
    paddingTop: 32,
    paddingBottom: 52,
    paddingHorizontal: 36,
    fontSize: 9,
    color: C.body,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingBottom: 18,
    borderBottomWidth: 1.5,
    borderBottomColor: C.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  /** Monograma embebido: evita fetch HTTP a /logo… (en muchos entornos el archivo no existe y react-pdf falla). */
  logoImg: {
    width: 38,
    height: 38,
    borderRadius: R,
    marginRight: 8,
    objectFit: 'contain',
  },
  logoFallback: {
    width: 38,
    height: 38,
    borderRadius: R,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoMonogram: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white },
  gymName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.ink },
  gymSub: { fontSize: 7, color: C.muted, marginTop: 2, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerRight: { alignItems: 'flex-end' },
  headerDateSpacing: { marginBottom: 3 },
  headerDate: { fontSize: 7.5, color: C.muted },
  headerRoutineName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    textAlign: 'right',
  },
  headerBrandBar: {
    width: 3,
    height: 32,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginRight: 12,
  },

  // ── Info alumno ──
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: R,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: C.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  infoCol: { flex: 1, minWidth: 90, paddingRight: 12, paddingBottom: 4 },
  infoLabel: {
    fontSize: 6.5,
    color: C.muted,
    marginBottom: 3,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  infoPeriod: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink },

  // ── Objetivo ──
  objectiveBox: {
    marginBottom: 18,
    padding: 14,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
    backgroundColor: C.surface,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
  },
  objectiveLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    marginBottom: 5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  objectiveText: { fontSize: 8.5, color: C.body, lineHeight: 1.6 },

  // ── Notas ──
  notesBox: {
    backgroundColor: C.surface,
    borderLeftWidth: 2,
    borderLeftColor: C.borderStrong,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 18,
  },
  notesLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notesText: { fontSize: 8, color: C.body, lineHeight: 1.6 },

  // ── Portada (hero) ──
  coverPage: {
    paddingTop: 0,
    paddingBottom: 28,
    paddingHorizontal: 0,
    backgroundColor: C.white,
  },
  coverTopBand: {
    height: 3,
    backgroundColor: C.brand,
    marginBottom: 0,
  },
  coverInner: {
    paddingHorizontal: 40,
    paddingTop: 28,
    flexGrow: 1,
  },
  coverHero: {
    alignItems: 'center',
    marginBottom: 22,
    paddingTop: 8,
  },
  logoHeroRing: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logoHero: {
    width: 72,
    height: 72,
    objectFit: 'contain',
  },
  logoHeroFallback: {
    width: 52,
    height: 52,
    borderRadius: R,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverKicker: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  coverPlanTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  coverStudent: {
    fontSize: 11,
    color: C.body,
    textAlign: 'center',
    marginBottom: 14,
  },
  coverPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  coverPill: {
    borderRadius: R,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
  },
  coverPillAccent: {
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
  },
  coverPillText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  coverWeekStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 20,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: R,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  coverWeekStripLabel: {
    width: '100%',
    textAlign: 'center',
    fontSize: 6.5,
    color: C.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  coverWeekChip: {
    minWidth: 30,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: R,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
  },
  coverWeekChipText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  coverObjectiveCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: R,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
  },
  coverGuideRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  coverGuideStep: {
    flex: 1,
    padding: 10,
    borderRadius: R,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
  },
  coverGuideNum: {
    width: 18,
    height: 18,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  coverGuideNumText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  coverGuideTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    textAlign: 'center',
    marginBottom: 2,
  },
  coverGuideSub: {
    fontSize: 6.5,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 1.35,
  },
  coverFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  coverFooterBrand: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  coverFooterMeta: {
    fontSize: 7,
    color: C.muted,
    textAlign: 'right',
  },

  // ── Índice (diseño tipo “card”; sin Link para evitar cuelgues del motor) ──
  tocCard: {
    marginTop: 4,
    marginBottom: 6,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  tocCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  tocCardAccent: {
    width: 2,
    borderRadius: 0,
    backgroundColor: C.brand,
    marginRight: 10,
    minHeight: 36,
  },
  tocCardKicker: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tocHeadline: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
  },
  tocHintBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tocHint: {
    fontSize: 7.5,
    color: C.heading,
    lineHeight: 1.5,
  },
  tocBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
  },
  tocWeekGroup: {
    marginBottom: 10,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  tocWeekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tocWeekBadge: {
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.white,
    borderRadius: R,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  tocWeekBadgeText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  tocWeekTitle: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.ink,
    marginRight: 8,
  },
  tocDots: {
    flexGrow: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    marginHorizontal: 4,
    marginBottom: 3,
    minWidth: 16,
  },
  tocDotsOnDark: {
    flexGrow: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: '#64748B',
    marginHorizontal: 8,
    marginBottom: 4,
    minWidth: 12,
  },
  tocDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    paddingLeft: 14,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    backgroundColor: C.white,
  },
  tocDayRowAlt: {
    backgroundColor: C.rowAlt,
  },
  tocDayChevron: {
    fontSize: 9,
    color: C.muted,
    marginRight: 6,
    width: 10,
  },
  tocDayText: {
    flex: 1,
    fontSize: 8,
    color: C.body,
  },
  tocRefPill: {
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tocRefPillText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  tocRefPillBrand: {
    borderColor: C.brandMid,
    backgroundColor: C.brandLight,
  },
  tocRefPillBrandText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#C2410C',
  },
  tocQuickNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  tocQuickChip: {
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.white,
    borderRadius: R,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tocQuickChipText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  tocPageNum: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
  },
  tocLink: {
    textDecoration: 'none',
    color: C.heading,
  },

  // ── Bloque (semana): franja alternada con la app ──
  blockStripeA: {
    marginTop: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  blockStripeB: {
    marginTop: 0,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  blockWrapper: { marginTop: 4 },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  blockAccent: {
    width: 2,
    height: 16,
    backgroundColor: C.brand,
    marginRight: 10,
  },
  blockName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.ink, flex: 1 },
  blockNotes: { fontSize: 7.5, color: C.muted, textAlign: 'right' },
  blockContextCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  blockContextText: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 0.3,
  },

  // ── Día ──
  daySection: { marginBottom: 0 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dayBadge: {
    borderWidth: 1,
    borderColor: C.brand,
    backgroundColor: C.white,
    borderRadius: R,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 8,
  },
  dayBadgeText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand, letterSpacing: 0.5 },
  dayName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink },
  dayFocus: { fontSize: 8, color: C.muted },
  warmupBox: {
    backgroundColor: C.surface,
    borderRadius: R,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 2,
    borderLeftColor: C.borderStrong,
    padding: 8,
    marginBottom: 6,
  },
  warmupTitle: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.heading, marginBottom: 3 },
  warmupLine: { fontSize: 7.5, color: C.body, lineHeight: 1.45, marginBottom: 2 },

  // ── Tabla ejercicios ──
  table: { width: '100%' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.ink,
    borderRadius: R,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
    alignItems: 'center',
  },
  tableRowAlt: { backgroundColor: C.rowAlt },
  thName: { flex: 2.35, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mutedLight, letterSpacing: 0.6 },
  thSmall: { flex: 0.72, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mutedLight, letterSpacing: 0.6, textAlign: 'center' },
  thNotes: { flex: 2.15, fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.mutedLight, letterSpacing: 0.6 },
  tdName: { flex: 2.35, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.ink },
  tdSmall: { flex: 0.72, fontSize: 7.5, color: C.body, textAlign: 'center' },
  tdNotes: { flex: 2.15, fontSize: 7.5, color: C.muted, lineHeight: 1.4 },

})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEVEL_LABEL: Record<string, string> = {
  inicial: 'Inicial',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function formatReps(ex: ExerciseFull) {
  if (ex.reps_scheme) return ex.reps_scheme
  if (!ex.reps_min && !ex.reps_max) return '—'
  if (ex.reps_min === ex.reps_max) return `${ex.reps_min}`
  return `${ex.reps_min ?? '?'}–${ex.reps_max ?? '?'}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Grouping helper ──────────────────────────────────────────────────────────

type RenderGroup =
  | { type: 'single';   exercise: ExerciseFull }
  | { type: 'circuit';  groupId: number; exercises: ExerciseFull[] }

function circuitClarificationFromGroup(exercises: ExerciseFull[]): string {
  for (const ex of exercises) {
    const note = parseExerciseMeta(ex.technical_notes).meta.circuitNote?.trim()
    if (note) return note
  }
  return ''
}

function groupExercises(exercises: ExerciseFull[]): RenderGroup[] {
  const result: RenderGroup[] = []
  const seen = new Set<string>()
  for (const ex of exercises) {
    if (seen.has(ex.id)) continue
    if (ex.is_superset && ex.superset_group !== null) {
      const members = exercises.filter((e) => e.superset_group === ex.superset_group)
      members.forEach((m) => seen.add(m.id))
      result.push({ type: 'circuit', groupId: ex.superset_group, exercises: members })
    } else {
      seen.add(ex.id)
      result.push({ type: 'single', exercise: ex })
    }
  }
  return result
}

// ─── Componentes internos ─────────────────────────────────────────────────────

const sc = StyleSheet.create({
  circuitWrapper: {
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderLeftWidth: 2,
    borderLeftColor: C.brand,
    borderRadius: R,
    marginBottom: 4,
  },
  circuitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  circuitLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.heading,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  circuitLabelAccent: {
    color: C.brand,
  },
  circuitNoteTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    letterSpacing: 0.6,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  circuitNote: {
    fontSize: 7.5,
    color: C.body,
    lineHeight: 1.45,
  },
  circuitRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    alignItems: 'center',
  },
  circuitRowAlt: { backgroundColor: C.rowAlt },
})

/** Evita líneas enormes en celdas (peor caso para el motor de texto del PDF). */
function clampPdfLine(raw: string, maxChars: number): string {
  const t = raw.replace(/\s+/g, ' ').trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`
}

/** Solo http(s): mostramos URL como texto (sin Link: menos trabajo para el layout). */
function exerciseDemoVideoUrl(ex: ExerciseFull): string | null {
  const raw = (ex.video_url || ex.exercise?.video_url || '').trim()
  if (!raw) return null
  let u = raw
  if (u.startsWith('//')) u = `https:${u}`
  try {
    const parsed = new URL(u)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString()
  } catch {
    /* texto libre, no es URL */
  }
  return null
}

function ExerciseTable({
  exercises,
  rmByExerciseId,
}: {
  exercises: ExerciseFull[]
  rmByExerciseId?: Record<string, number>
}) {
  const groups = groupExercises(exercises)
  let rowIndex = 0

  return (
    <View style={s.table}>
      <View style={s.tableHead}>
        <Text style={s.thName}>EJERCICIO</Text>
        <Text style={s.thSmall}>SERIES</Text>
        <Text style={s.thSmall}>REPS</Text>
        <Text style={s.thSmall}>PESO</Text>
        <Text style={s.thSmall}>DESC.</Text>
        <Text style={s.thSmall}>RPE</Text>
        <Text style={s.thSmall}>RIR</Text>
        <Text style={s.thNotes}>NOTAS</Text>
      </View>

      {groups.map((group) => {
        if (group.type === 'single') {
          const idx = rowIndex++
          const rmKg = rmByExerciseId?.[group.exercise.exercise_id]
          const pdfRow = pdfExerciseDisplay(group.exercise, rmKg)
          const videoUrl = exerciseDemoVideoUrl(group.exercise)
          return (
            <View key={group.exercise.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={s.tdName}>{clampPdfLine(group.exercise.exercise?.name ?? '—', 85)}</Text>
              <Text style={s.tdSmall}>{group.exercise.sets ?? '—'}</Text>
              <Text style={s.tdSmall}>{formatReps(group.exercise)}</Text>
              <Text style={s.tdSmall}>{pdfRow.weightCell}</Text>
              <Text style={s.tdSmall}>{pdfRow.restDisplay}</Text>
              <Text style={s.tdSmall}>{pdfRow.rpeDisplay}</Text>
              <Text style={s.tdSmall}>{pdfRow.rirDisplay}</Text>
              <View style={s.tdNotes}>
                {pdfRow.seriesPlanLine ? (
                  <Text style={{ marginBottom: 2, fontFamily: 'Helvetica-Bold' }}>
                    {clampPdfLine(pdfRow.seriesPlanLine, 220)}
                  </Text>
                ) : null}
                <Text>{clampPdfLine(pdfRow.notesClean, 500)}</Text>
                {videoUrl ? (
                  <Text style={{ marginTop: 3, fontSize: 6.5, color: C.muted }}>
                    {clampPdfLine(videoUrl, 90)}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        }

        rowIndex += group.exercises.length
        const circuitNote = circuitClarificationFromGroup(group.exercises)
        return (
          <View key={group.groupId} style={sc.circuitWrapper}>
            <View style={sc.circuitHeader}>
              <View style={{ flex: 1 }}>
                <Text style={sc.circuitLabel}>
                  <Text style={sc.circuitLabelAccent}>Circuito</Text>
                  {` · ${group.exercises.length} ejercicios`}
                </Text>
                {circuitNote ? (
                  <View style={{ marginTop: 5 }}>
                    <Text style={sc.circuitNoteTitle}>Aclaración del circuito</Text>
                    <Text style={sc.circuitNote}>{circuitNote}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {group.exercises.map((ex, i) => {
              const rmKg = rmByExerciseId?.[ex.exercise_id]
              const pdfRow = pdfExerciseDisplay(ex, rmKg)
              const videoUrl = exerciseDemoVideoUrl(ex)
              return (
                <View key={ex.id} style={[sc.circuitRow, i % 2 === 1 ? sc.circuitRowAlt : {}]}>
                  <Text style={s.tdName}>{clampPdfLine(ex.exercise?.name ?? '—', 85)}</Text>
                  <Text style={s.tdSmall}>{ex.sets ?? '—'}</Text>
                  <Text style={s.tdSmall}>{formatReps(ex)}</Text>
                  <Text style={s.tdSmall}>{pdfRow.weightCell}</Text>
                  <Text style={s.tdSmall}>{pdfRow.restDisplay}</Text>
                  <Text style={s.tdSmall}>{pdfRow.rpeDisplay}</Text>
                  <Text style={s.tdSmall}>{pdfRow.rirDisplay}</Text>
                  <View style={s.tdNotes}>
                    <Text>{clampPdfLine(pdfRow.notesClean, 500)}</Text>
                    {videoUrl ? (
                      <Text style={{ marginTop: 3, fontSize: 6.5, color: C.muted }}>
                        {clampPdfLine(videoUrl, 90)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        )
      })}
    </View>
  )
}

function DaySection({
  day,
  index,
  rmByExerciseId,
  anchorId,
}: {
  day: DayFull
  index: number
  rmByExerciseId?: Record<string, number>
  anchorId?: string
}) {
  const name = day.day_name?.trim() ?? ''
  const focus = day.muscle_focus?.trim()
  const showName = !isGenericDayLabel(name, index)

  return (
    <View style={s.daySection}>
      <View id={anchorId} style={s.dayHeader}>
        <View style={s.dayBadge}>
          <Text style={s.dayBadgeText}>DÍA {index + 1}</Text>
        </View>
        {showName ? <Text style={s.dayName}>{clampPdfLine(name, 120)}</Text> : null}
        {focus ? (
          <Text style={s.dayFocus}>
            {showName ? ' · ' : ''}
            {clampPdfLine(focus, 80)}
          </Text>
        ) : null}
      </View>
      {day.warmup_notes ? (
        <View style={s.warmupBox}>
          <Text style={s.warmupTitle}>Entrada en calor</Text>
          {formatWarmupDisplayLines(day.warmup_notes).map((line, li) => (
            <Text key={li} style={s.warmupLine}>
              {clampPdfLine(line, 200)}
            </Text>
          ))}
        </View>
      ) : null}
      <ExerciseTable exercises={day.exercises} rmByExerciseId={rmByExerciseId} />
    </View>
  )
}

function CoverLogo({ brandLogoSrc }: { brandLogoSrc?: string | null }) {
  return (
    <View style={s.logoHeroRing}>
      {brandLogoSrc ? (
        <Image src={brandLogoSrc} style={s.logoHero} />
      ) : (
        <View style={s.logoHeroFallback}>
          <Text style={s.logoMonogram}>HH</Text>
        </View>
      )}
    </View>
  )
}

function RoutineCoverPage({
  routine,
  blocks,
  generatedAt,
  brandLogoSrc,
  tocHasContent,
}: {
  routine: RoutineFull
  blocks: BlockFull[]
  generatedAt: Date
  brandLogoSrc?: string | null
  tocHasContent: boolean
}) {
  const student = routine.student
  const weekCount = blocks.length
  const dayCount = blocks.reduce((n, b) => n + (b.days?.length ?? 0), 0)

  return (
    <>
      <View style={s.coverTopBand} />
      <View style={s.coverInner}>
        <View style={s.coverHero}>
          <CoverLogo brandLogoSrc={brandLogoSrc} />
          <Text style={s.coverKicker}>Haciéndolo Hábito · Ferster Fitness</Text>
          <Text style={s.coverPlanTitle}>{clampPdfLine(routine.name, 80)}</Text>
          <Text style={s.coverStudent}>{student?.full_name ?? '—'}</Text>
          <View style={s.coverPillRow}>
            <View style={[s.coverPill, s.coverPillAccent]}>
              <Text style={s.coverPillText}>{LEVEL_LABEL[routine.level] ?? routine.level}</Text>
            </View>
            <View style={s.coverPill}>
              <Text style={s.coverPillText}>
                {formatDate(routine.start_date)} – {formatDate(routine.end_date)}
              </Text>
            </View>
            <View style={s.coverPill}>
              <Text style={s.coverPillText}>{routine.duration_days} días</Text>
            </View>
          </View>
        </View>

        {weekCount > 0 ? (
          <View style={s.coverWeekStrip}>
            <Text style={s.coverWeekStripLabel}>
              {weekCount} {weekCount === 1 ? 'semana' : 'semanas'}
              {dayCount > 0 ? ` · ${dayCount} días de entrenamiento` : ''}
            </Text>
            {blocks.map((_, wi) => (
              <View key={`cw-${wi}`} style={s.coverWeekChip}>
                <Text style={s.coverWeekChipText}>S{wi + 1}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.coverObjectiveCard}>
          <Text style={s.objectiveLabel}>Objetivo del coach</Text>
          <Text style={s.objectiveText}>{clampPdfLine(routine.objective, 4000)}</Text>
        </View>

        {routine.notes ? (
          <View style={[s.notesBox, { marginBottom: 14 }]}>
            <Text style={s.notesLabel}>Aclaraciones importantes</Text>
            <Text style={s.notesText}>{clampPdfLine(routine.notes, 4000)}</Text>
          </View>
        ) : null}

        {tocHasContent ? (
          <View style={s.coverGuideRow}>
            <View style={s.coverGuideStep}>
              <View style={s.coverGuideNum}>
                <Text style={s.coverGuideNumText}>1</Text>
              </View>
              <Text style={s.coverGuideTitle}>Índice</Text>
              <Text style={s.coverGuideSub}>Mapa de semanas y días</Text>
            </View>
            <View style={s.coverGuideStep}>
              <View style={s.coverGuideNum}>
                <Text style={s.coverGuideNumText}>2</Text>
              </View>
              <Text style={s.coverGuideTitle}>Entrená</Text>
              <Text style={s.coverGuideSub}>Una semana por bloque</Text>
            </View>
            <View style={s.coverGuideStep}>
              <View style={s.coverGuideNum}>
                <Text style={s.coverGuideNumText}>3</Text>
              </View>
              <Text style={s.coverGuideTitle}>Seguimiento</Text>
              <Text style={s.coverGuideSub}>Marcá series, pesos y sensaciones en cada día</Text>
            </View>
          </View>
        ) : null}

        <View style={s.coverFooter}>
          <Text style={s.coverFooterBrand}>Ferster Fitness</Text>
          <Text style={s.coverFooterMeta}>
            Generado el {generatedAt.toLocaleDateString('es-AR')}
            {'\n'}
            Plan personal · uso exclusivo del alumno
          </Text>
        </View>
      </View>
    </>
  )
}

function PdfBrandHeader({
  generatedAt,
  routineName,
  brandLogoSrc,
  compact,
}: {
  generatedAt: Date
  routineName: string
  brandLogoSrc?: string | null
  compact?: boolean
}) {
  if (compact) {
    return (
      <View style={[s.header, { marginBottom: 14, paddingBottom: 12 }]}>
        <View style={s.headerLeft}>
          {brandLogoSrc ? (
            <Image src={brandLogoSrc} style={[s.logoImg, { borderRadius: R, width: 32, height: 32 }]} />
          ) : (
            <View style={[s.logoFallback, { borderRadius: R, width: 32, height: 32 }]}>
              <Text style={s.logoMonogram}>HH</Text>
            </View>
          )}
          <View style={{ marginLeft: 8 }}>
            <Text style={[s.gymName, { fontSize: 10 }]}>Haciéndolo Hábito</Text>
            <Text style={s.headerRoutineName}>{clampPdfLine(routineName, 80)}</Text>
          </View>
        </View>
        <Text style={s.headerDate}>{generatedAt.toLocaleDateString('es-AR')}</Text>
      </View>
    )
  }

  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <View style={s.headerBrandBar} />
        {brandLogoSrc ? (
          <Image src={brandLogoSrc} style={[s.logoImg, { borderRadius: R }]} />
        ) : (
          <View style={[s.logoFallback, { borderRadius: R }]}>
            <Text style={s.logoMonogram}>HH</Text>
          </View>
        )}
        <View style={{ marginLeft: 2 }}>
          <Text style={s.gymName}>Haciéndolo Hábito</Text>
          <Text style={s.gymSub}>Ferster Fitness</Text>
        </View>
      </View>
      <View style={s.headerRight}>
        <Text style={[s.headerDate, s.headerDateSpacing]}>
          Generado el {generatedAt.toLocaleDateString('es-AR')}
        </Text>
        <Text style={s.headerRoutineName}>{clampPdfLine(routineName, 120)}</Text>
      </View>
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────────

export function RoutinePdfDocument({
  routine,
  blocks,
  generatedAt,
  rmByExerciseId,
  brandLogoSrc,
}: RoutinePdfData) {
  const tocHasContent = blocks.some((b) => (b.days?.length ?? 0) > 0)

  return (
    <Document
      title={`Rutina — ${routine.student?.full_name ?? 'Alumno'}`}
      author="Haciéndolo Hábito"
    >
      {/* Pág. 1 — portada hero (sin datos duplicados). */}
      <Page size="A4" style={s.coverPage}>
        <RoutineCoverPage
          routine={routine}
          blocks={blocks}
          generatedAt={generatedAt}
          brandLogoSrc={brandLogoSrc}
          tocHasContent={tocHasContent}
        />
      </Page>

      {/* Índice con enlaces internos (sin números de página: el visor pagina distinto). */}
      {tocHasContent ? (
        <Page size="A4" style={s.page}>
          <PdfBrandHeader
            generatedAt={generatedAt}
            routineName={routine.name}
            brandLogoSrc={brandLogoSrc}
            compact
          />
          <View style={s.tocCard}>
            <View style={s.tocCardTitleRow}>
              <View style={s.tocCardAccent} />
              <View style={{ flex: 1 }}>
                <Text style={s.tocCardKicker}>Contenido</Text>
                <Text style={s.tocHeadline}>Índice de semanas y días</Text>
              </View>
            </View>
            <View style={s.tocHintBox}>
              <Text style={s.tocHint}>
                Tocá una fila o un acceso rápido (S1, S2…) para ir a esa semana o día en la rutina.
              </Text>
            </View>
            <View style={s.tocQuickNav}>
              {blocks.map((block, wi) => (
                <Link key={`q-${block.id}`} src={`#${weekAnchorId(wi)}`} style={s.tocLink}>
                  <View style={s.tocQuickChip}>
                    <Text style={s.tocQuickChipText}>S{wi + 1}</Text>
                  </View>
                </Link>
              ))}
            </View>
            <View style={s.tocBody}>
              {blocks.map((block, wi) => (
                <View key={`toc-${block.id}`} style={s.tocWeekGroup}>
                  <View style={s.tocWeekRow}>
                    <View style={s.tocWeekBadge}>
                      <Text style={s.tocWeekBadgeText}>S{wi + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Link src={`#${weekAnchorId(wi)}`} style={s.tocLink}>
                        <Text style={s.tocWeekTitle}>{clampPdfLine(block.name, 100)}</Text>
                      </Link>
                    </View>
                  </View>
                  {block.days.map((day, di) => (
                    <View
                      key={`tocd-${day.id}`}
                      style={[s.tocDayRow, di % 2 === 1 ? s.tocDayRowAlt : {}]}
                    >
                      <Text style={s.tocDayChevron}>›</Text>
                      <Link src={`#${dayAnchorId(wi, di)}`} style={[s.tocDayText, s.tocLink]}>
                        <Text>{tocDayLabel(day, di)}</Text>
                      </Link>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Page>
      ) : null}

      {blocks.flatMap((block, wi) =>
        block.days.map((day, di) => (
          <Page key={`${block.id}-${day.id}`} size="A4" style={s.page} wrap>
            <View style={wi % 2 === 0 ? s.blockStripeA : s.blockStripeB}>
              {di === 0 ? (
                <View id={weekAnchorId(wi)} style={s.blockHeader}>
                  <View style={s.blockAccent} />
                  <Text style={s.blockName}>{clampPdfLine(block.name, 100)}</Text>
                  {block.notes ? (
                    <Text style={s.blockNotes}>{clampPdfLine(block.notes, 500)}</Text>
                  ) : null}
                </View>
              ) : (
                <View style={s.blockContextCompact}>
                  <Text style={s.blockContextText}>
                    Semana {wi + 1} · {clampPdfLine(block.name, 100)}
                  </Text>
                </View>
              )}
              <View style={s.blockWrapper}>
                <DaySection
                  day={day}
                  index={di}
                  rmByExerciseId={rmByExerciseId}
                  anchorId={dayAnchorId(wi, di)}
                />
              </View>
            </View>
          </Page>
        ))
      )}
    </Document>
  )
}
