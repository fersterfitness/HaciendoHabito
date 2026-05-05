import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { Routine, Student, RoutineBlock, RoutineDay, RoutineExercise, Exercise } from '@/types/database'
import { parseExerciseMeta, pdfExerciseDisplay } from '@/lib/routine/exerciseMeta'

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
}

// ─── Paleta ───────────────────────────────────────────────────────────────────

const C = {
  brand: '#FF8C00',
  brandLight: '#FFF8F0',
  brandMid: '#FFE0B2',
  dark: '#0F172A',
  heading: '#1E293B',
  body: '#334155',
  muted: '#94A3B8',
  mutedLight: '#CBD5E1',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  bgCard: '#FFFFFF',
  white: '#FFFFFF',
  rowAlt: '#F8FAFC',
  accent: '#0EA5E9',
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoImg: { width: 38, height: 38, borderRadius: 8 },
  gymName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: C.dark },
  gymSub: { fontSize: 7, color: C.muted, marginTop: 2, letterSpacing: 1.2, textTransform: 'uppercase' },
  headerRight: { alignItems: 'flex-end', gap: 3 },
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
    backgroundColor: C.bg,
    borderRadius: 10,
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
  infoValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.dark },
  infoPeriod: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.dark },

  // ── Objetivo ──
  objectiveBox: {
    marginBottom: 18,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: C.brand,
    backgroundColor: C.brandLight,
    borderRadius: 6,
  },
  objectiveLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    marginBottom: 5,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  objectiveText: { fontSize: 8.5, color: C.body, lineHeight: 1.6 },

  // ── Notas ──
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    borderRadius: 6,
    padding: 12,
    marginBottom: 18,
  },
  notesLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#B45309',
    marginBottom: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  notesText: { fontSize: 8, color: '#78350F', lineHeight: 1.6 },

  // ── Bloque ──
  blockWrapper: { marginTop: 18 },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.dark,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  blockAccent: {
    width: 4,
    height: 18,
    backgroundColor: C.brand,
    borderRadius: 2,
    marginRight: 10,
  },
  blockName: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: C.white, flex: 1 },
  blockNotes: { fontSize: 7.5, color: C.muted, textAlign: 'right' },

  // ── Día ──
  daySection: { marginBottom: 12 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  dayBadge: {
    backgroundColor: C.brand,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  dayBadgeText: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.white, letterSpacing: 0.5 },
  dayName: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.dark },
  dayFocus: { fontSize: 8, color: C.muted },
  warmupBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 5,
    borderLeftWidth: 2,
    borderLeftColor: '#22C55E',
    padding: 8,
    marginBottom: 6,
  },
  warmupText: { fontSize: 7.5, color: '#15803D', lineHeight: 1.5 },

  // ── Tabla ejercicios ──
  table: { width: '100%' },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: C.heading,
    borderRadius: 5,
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
  tdName: { flex: 2.35, fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.dark },
  tdSmall: { flex: 0.72, fontSize: 7.5, color: C.body, textAlign: 'center' },
  tdNotes: { flex: 2.15, fontSize: 7.5, color: C.muted, lineHeight: 1.4 },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 8,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerBrand: { fontSize: 6.5, color: C.muted },
  footerDot: { fontSize: 6.5, color: C.mutedLight },
  footerApp: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.brand },
  pageNumber: { fontSize: 7, color: C.muted },
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
    borderColor: C.brand,
    borderRadius: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  circuitHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 5,
  },
  circuitDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.brand,
  },
  circuitLabel: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  circuitNoteTitle: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: C.brand,
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
    borderTopColor: '#FFE0B2',
    alignItems: 'center',
  },
  circuitRowAlt: { backgroundColor: '#FFFBF5' },
})

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
          return (
            <View key={group.exercise.id} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
              <Text style={s.tdName}>{group.exercise.exercise?.name ?? '—'}</Text>
              <Text style={s.tdSmall}>{group.exercise.sets ?? '—'}</Text>
              <Text style={s.tdSmall}>{formatReps(group.exercise)}</Text>
              <Text style={s.tdSmall}>{pdfRow.weightCell}</Text>
              <Text style={s.tdSmall}>{pdfRow.restDisplay}</Text>
              <Text style={s.tdSmall}>{pdfRow.rpeDisplay}</Text>
              <Text style={s.tdSmall}>{pdfRow.rirDisplay}</Text>
              <Text style={s.tdNotes}>{pdfRow.notesClean}</Text>
            </View>
          )
        }

        rowIndex += group.exercises.length
        const circuitNote = circuitClarificationFromGroup(group.exercises)
        return (
          <View key={group.groupId} style={sc.circuitWrapper}>
            <View style={sc.circuitHeader}>
              <View style={sc.circuitDot} />
              <View style={{ flex: 1 }}>
                <Text style={sc.circuitLabel}>Circuito · {group.exercises.length} ejercicios</Text>
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
              return (
                <View key={ex.id} style={[sc.circuitRow, i % 2 === 1 ? sc.circuitRowAlt : {}]}>
                  <Text style={s.tdName}>{ex.exercise?.name ?? '—'}</Text>
                  <Text style={s.tdSmall}>{ex.sets ?? '—'}</Text>
                  <Text style={s.tdSmall}>{formatReps(ex)}</Text>
                  <Text style={s.tdSmall}>{pdfRow.weightCell}</Text>
                  <Text style={s.tdSmall}>{pdfRow.restDisplay}</Text>
                  <Text style={s.tdSmall}>{pdfRow.rpeDisplay}</Text>
                  <Text style={s.tdSmall}>{pdfRow.rirDisplay}</Text>
                  <Text style={s.tdNotes}>{pdfRow.notesClean}</Text>
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
}: {
  day: DayFull
  index: number
  rmByExerciseId?: Record<string, number>
}) {
  return (
    <View style={s.daySection} wrap={false}>
      <View style={s.dayHeader}>
        <View style={s.dayBadge}>
          <Text style={s.dayBadgeText}>DÍA {index + 1}</Text>
        </View>
        <Text style={s.dayName}>{day.day_name}</Text>
        {day.muscle_focus && <Text style={s.dayFocus}> · {day.muscle_focus}</Text>}
      </View>
      {day.warmup_notes && (
        <View style={s.warmupBox}>
          <Text style={s.warmupText}>Entrada en calor: {day.warmup_notes}</Text>
        </View>
      )}
      <ExerciseTable exercises={day.exercises} rmByExerciseId={rmByExerciseId} />
    </View>
  )
}

// ─── Documento principal ──────────────────────────────────────────────────────

export function RoutinePdfDocument({ routine, blocks, generatedAt, rmByExerciseId }: RoutinePdfData) {
  const student = routine.student
  const logoUrl = `${window.location.origin}/logo_mark_original_black_square.png`

  return (
    <Document
      title={`Rutina — ${student?.full_name ?? 'Alumno'}`}
      author="Haciéndolo Hábito"
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <View style={s.headerBrandBar} />
            <Image src={logoUrl} style={s.logoImg} />
            <View style={{ marginLeft: 2 }}>
              <Text style={s.gymName}>Haciéndolo Hábito</Text>
              <Text style={s.gymSub}>Ferster Fitness</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDate}>Generado el {generatedAt.toLocaleDateString('es-AR')}</Text>
            <Text style={s.headerRoutineName}>{routine.name}</Text>
          </View>
        </View>

        {/* Info del alumno */}
        <View style={s.infoCard}>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Alumno</Text>
            <Text style={s.infoValue}>{student?.full_name ?? '—'}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Nivel</Text>
            <Text style={s.infoValue}>{LEVEL_LABEL[routine.level] ?? routine.level}</Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Período</Text>
            <Text style={s.infoPeriod}>
              {formatDate(routine.start_date)} – {formatDate(routine.end_date)}
            </Text>
          </View>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Duración</Text>
            <Text style={s.infoValue}>{routine.duration_days} días</Text>
          </View>
        </View>

        {/* Objetivo */}
        <View style={s.objectiveBox}>
          <Text style={s.objectiveLabel}>Objetivo del Coach</Text>
          <Text style={s.objectiveText}>{routine.objective}</Text>
        </View>

        {/* Notas generales */}
        {routine.notes && (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Aclaraciones importantes</Text>
            <Text style={s.notesText}>{routine.notes}</Text>
          </View>
        )}

        {/* Bloques */}
        {blocks.map((block) => (
          <View key={block.id} style={s.blockWrapper}>
            <View style={s.blockHeader} wrap={false}>
              <View style={s.blockAccent} />
              <Text style={s.blockName}>{block.name}</Text>
              {block.notes && (
                <Text style={s.blockNotes}>{block.notes}</Text>
              )}
            </View>
            {block.days.map((day, di) => (
              <DaySection key={day.id} day={day} index={di} rmByExerciseId={rmByExerciseId} />
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerApp}>Haciéndolo Hábito</Text>
            <Text style={s.footerDot}>·</Text>
            <Text style={s.footerBrand}>Ferster Fitness</Text>
          </View>
          <Text
            style={s.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}
