import { supabase } from '@/lib/supabase'
import { dayInsertPayload, exerciseInsertPayload } from '@/lib/routine/copyRoutineDay'
import { dayOffset, phaseBlockTitle, shiftRoutineDates, shiftYmd, type BlockTypeId, type DatePatch } from '@/lib/macrocycle/macrocycle'
import { fetchRoutineDeletionLog } from '@/lib/routines/routineAccess'
import type { Exercise, Routine, RoutineBlock, RoutineDay, RoutineExercise } from '@/types/database'

export type MacroExercise = RoutineExercise & {
  exercise?: (Pick<Exercise, 'name'> & { muscle_group?: { slug?: string | null } | null }) | null
}
export type MacroDay = RoutineDay & { exercises: MacroExercise[] }
export type MacroWeek = RoutineBlock & { days: MacroDay[] }
export type MacroRoutine = Routine & {
  block_type?: string | null
  calendar_color?: string | null
  weeks: MacroWeek[]
}

export const MACROCYCLE_SQL_HINT =
  'Falta ejecutar la migración 20261027140000_macrocycle_calendar.sql en Supabase para guardar tipo y color de bloque.'

/** Rutinas del alumno (bloques del macrociclo) con sus semanas, días y ejercicios. */
export async function loadMacrocycle(studentId: string): Promise<MacroRoutine[]> {
  const { data: routines, error } = await supabase
    .from('routines')
    .select('*')
    .eq('student_id', studentId)
    .order('start_date')
  if (error) throw new Error(error.message)
  const list = (routines ?? []) as (Routine & { block_type?: string | null; calendar_color?: string | null })[]
  if (!list.length) return []
  const { data: weeks, error: weeksErr } = await supabase
    .from('routine_blocks')
    .select(
      '*, days:routine_days(*, exercises:routine_exercises(*, exercise:exercise_library(name, muscle_group:muscle_groups(slug))))',
    )
    .in(
      'routine_id',
      list.map((r) => r.id),
    )
  if (weeksErr) throw new Error(weeksErr.message)
  const byRoutine = new Map<string, MacroWeek[]>()
  for (const w of (weeks ?? []) as MacroWeek[]) {
    const sorted: MacroWeek = {
      ...w,
      days: [...(w.days ?? [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d) => ({ ...d, exercises: [...(d.exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order) })),
    }
    if (!byRoutine.has(w.routine_id)) byRoutine.set(w.routine_id, [])
    byRoutine.get(w.routine_id)!.push(sorted)
  }
  return list.map((r) => ({
    ...r,
    weeks: (byRoutine.get(r.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

async function applyPatches(routine: DatePatch, weeks: DatePatch[]): Promise<string | null> {
  const { error } = await supabase
    .from('routines')
    .update({ start_date: routine.start_date, end_date: routine.end_date })
    .eq('id', routine.id)
  if (error) return error.message
  for (const w of weeks) {
    if (!w.start_date && !w.end_date) continue
    const { error: wErr } = await supabase
      .from('routine_blocks')
      .update({ start_date: w.start_date, end_date: w.end_date })
      .eq('id', w.id)
    if (wErr) return wErr.message
  }
  return null
}

/** Mueve el bloque real (rutina + semanas) `days` días. */
export async function moveRoutine(routine: MacroRoutine, days: number): Promise<string | null> {
  if (!days) return null
  const p = shiftRoutineDates(routine, routine.weeks, days)
  return applyPatches(p.routine, p.weeks)
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

/** «Develop Block II» → «Develop Block III», «Mesociclo 3» → «Mesociclo 4», si no «… (copia)». */
export function nextBlockName(name: string): string {
  const roman = /^(.*\s)(I|II|III|IV|V|VI|VII|VIII|IX|X|XI)$/.exec(name.trim())
  if (roman) {
    const idx = ROMAN.indexOf(roman[2]!)
    if (idx >= 0 && idx + 1 < ROMAN.length) return `${roman[1]}${ROMAN[idx + 1]}`
  }
  const numeric = /^(.*?)(\d+)$/.exec(name.trim())
  if (numeric) return `${numeric[1]}${Number(numeric[2]) + 1}`
  return `${name.trim()} (copia)`
}

/**
 * Copia un bloque como base del siguiente: misma estructura (semanas, días y ejercicios),
 * corrida a `newStart`. Después se ajusta la progresión a mano.
 */
export async function duplicateRoutineAt(
  source: MacroRoutine,
  newStart: string,
  ownerId: string,
): Promise<{ id: string | null; error: string | null }> {
  const delta = dayOffset(source.start_date, newStart)
  const today = new Date().toISOString().slice(0, 10)
  const insert: Record<string, unknown> = {
    owner_id: ownerId,
    student_id: source.student_id,
    student_plan_id: source.student_plan_id ?? null,
    name: nextBlockName(source.name),
    objective: source.objective,
    level: source.level,
    start_date: newStart,
    end_date: shiftYmd(source.end_date, delta),
    duration_days: source.duration_days,
    price: source.price,
    // Un bloque planificado a futuro no pisa a la rutina activa del alumno.
    status: newStart > today ? 'pausada' : 'activa',
    notes: source.notes,
  }
  if (source.block_type !== undefined) insert.block_type = source.block_type
  if (source.calendar_color !== undefined) insert.calendar_color = source.calendar_color
  const { data: created, error } = await supabase.from('routines').insert(insert).select('id').single()
  if (error || !created) return { id: null, error: error?.message ?? 'No se pudo copiar el bloque' }
  const routineId = (created as { id: string }).id

  for (const week of source.weeks) {
    const { data: newWeek, error: wErr } = await supabase
      .from('routine_blocks')
      .insert({
        routine_id: routineId,
        name: week.name,
        sort_order: week.sort_order,
        notes: week.notes,
        start_date: shiftYmd(week.start_date, delta),
        end_date: shiftYmd(week.end_date, delta),
      })
      .select('id')
      .single()
    if (wErr || !newWeek) return { id: routineId, error: wErr?.message ?? 'No se pudo copiar una semana' }
    for (const day of week.days) {
      const { data: newDay, error: dErr } = await supabase
        .from('routine_days')
        .insert(dayInsertPayload(day, (newWeek as { id: string }).id, day.sort_order))
        .select('id')
        .single()
      if (dErr || !newDay) return { id: routineId, error: dErr?.message ?? 'No se pudo copiar un día' }
      if (day.exercises.length) {
        const { error: eErr } = await supabase
          .from('routine_exercises')
          .insert(day.exercises.map((ex) => exerciseInsertPayload(ex, (newDay as { id: string }).id)))
        if (eErr) return { id: routineId, error: eErr.message }
      }
    }
  }
  return { id: routineId, error: null }
}

export async function updateRoutineCalendarMeta(
  routineId: string,
  patch: { block_type?: string | null; calendar_color?: string | null; name?: string },
): Promise<string | null> {
  const { error } = await supabase.from('routines').update(patch).eq('id', routineId)
  if (!error) return null
  return /block_type|calendar_color|schema cache/i.test(error.message) ? MACROCYCLE_SQL_HINT : error.message
}

// ─── Bloques marcados por el entrenador (planificación libre) ────────────────

export type PlanBlock = {
  id: string
  student_id: string
  title: string
  block_type: string | null
  color: string | null
  start_date: string
  end_date: string
  notes: string | null
  /** Semana de rutina que generó el bloque (fase elegida en la rutina). */
  routine_block_id?: string | null
}

export const PLAN_SQL_HINT =
  'Falta ejecutar la migración 20261029120000_macrocycle_plan_blocks.sql en Supabase para guardar bloques del calendario.'

function planError(message: string): string {
  return /macrocycle_plan_blocks|does not exist|schema cache/i.test(message) ? PLAN_SQL_HINT : message
}

export async function loadPlanBlocks(studentId: string): Promise<{ blocks: PlanBlock[]; ready: boolean }> {
  const cols = 'id, student_id, title, block_type, color, start_date, end_date, notes'
  const query = (select: string) => supabase.from('macrocycle_plan_blocks').select(select).eq('student_id', studentId).order('start_date')
  let { data, error } = await query(`${cols}, routine_block_id`)
  // Sin la migración oct5 todavía no existe routine_block_id: se cargan igual.
  if (error) ({ data, error } = await query(cols))
  if (error) return { blocks: [], ready: false }
  return { blocks: (data ?? []) as unknown as PlanBlock[], ready: true }
}

/** Crea (sin id) o actualiza un bloque. Devuelve el id guardado. */
export async function savePlanBlock(
  block: Omit<PlanBlock, 'id'> & { id?: string },
): Promise<{ id: string | null; error: string | null }> {
  const payload = {
    student_id: block.student_id,
    title: block.title.trim() || 'Bloque',
    block_type: block.block_type,
    color: block.color,
    start_date: block.start_date <= block.end_date ? block.start_date : block.end_date,
    end_date: block.start_date <= block.end_date ? block.end_date : block.start_date,
    notes: block.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  const res = block.id
    ? await supabase.from('macrocycle_plan_blocks').update(payload).eq('id', block.id).select('id').single()
    : await supabase.from('macrocycle_plan_blocks').insert(payload).select('id').single()
  if (res.error) return { id: null, error: planError(res.error.message) }
  return { id: (res.data as { id: string }).id, error: null }
}

export async function deletePlanBlock(id: string): Promise<string | null> {
  const { error } = await supabase.from('macrocycle_plan_blocks').delete().eq('id', id)
  return error ? planError(error.message) : null
}

export async function deletePlanBlocks(ids: string[]): Promise<string | null> {
  if (!ids.length) return null
  const { error } = await supabase.from('macrocycle_plan_blocks').delete().in('id', ids)
  return error ? planError(error.message) : null
}

export const PHASE_SQL_HINT =
  'Falta ejecutar la migración 20261030160000_oct5_calendario_volumen_finanzas.sql en Supabase para guardar la fase de la semana.'

/**
 * Fase del macrociclo elegida en una semana de la rutina: se guarda en la semana y se refleja como
 * bloque en el calendario («Intensificación 1», «Intensificación 2»…). Sin fase, el bloque generado se quita;
 * los que el entrenador editó a mano en el calendario siguen siendo suyos (título, notas).
 */
export async function setWeekPhase(opts: {
  studentId: string | null
  week: { id: string; start_date: string | null; end_date: string | null }
  phase: BlockTypeId | null
}): Promise<{ error: string | null; warning: string | null }> {
  const { studentId, week, phase } = opts
  const { error: wErr } = await supabase.from('routine_blocks').update({ phase_type: phase }).eq('id', week.id)
  if (wErr) return { error: /phase_type|schema cache/i.test(wErr.message) ? PHASE_SQL_HINT : wErr.message, warning: null }
  if (!studentId) return { error: null, warning: 'La rutina no tiene alumno: la fase no se marca en el calendario.' }

  const { data: linked, error: lErr } = await supabase
    .from('macrocycle_plan_blocks')
    .select('id, block_type')
    .eq('routine_block_id', week.id)
    .maybeSingle()
  if (lErr) return { error: /routine_block_id|schema cache/i.test(lErr.message) ? PHASE_SQL_HINT : planError(lErr.message), warning: null }

  if (!phase) {
    if (linked) return { error: await deletePlanBlock(linked.id), warning: null }
    return { error: null, warning: null }
  }
  if (!week.start_date || !week.end_date) {
    return { error: null, warning: 'Cargá las fechas de la semana para ubicar la fase en el calendario.' }
  }
  if (linked?.block_type === phase) return { error: null, warning: null }

  const { blocks } = await loadPlanBlocks(studentId)
  const title = phaseBlockTitle(phase, week.start_date, blocks.filter((b) => b.id !== linked?.id))
  const payload = {
    student_id: studentId,
    title,
    block_type: phase,
    color: null,
    start_date: week.start_date,
    end_date: week.end_date < week.start_date ? week.start_date : week.end_date,
    routine_block_id: week.id,
    updated_at: new Date().toISOString(),
  }
  const res = linked
    ? await supabase.from('macrocycle_plan_blocks').update(payload).eq('id', linked.id)
    : await supabase.from('macrocycle_plan_blocks').insert(payload)
  return { error: res.error ? planError(res.error.message) : null, warning: null }
}

/** Rutinas eliminadas del alumno: quedan en el calendario como historial (solo lectura). */
export type DeletedRoutine = { id: string; name: string; start_date: string; end_date: string; deleted_at: string }

export async function loadDeletedRoutines(userId: string, studentId: string): Promise<DeletedRoutine[]> {
  const { data } = await fetchRoutineDeletionLog({ userId })
  return data
    .filter((r) => r.student_id === studentId && r.start_date && r.end_date)
    .map((r) => ({
      id: `deleted-${r.id}`,
      name: r.routine_name,
      start_date: r.start_date!,
      end_date: r.end_date! < r.start_date! ? r.start_date! : r.end_date!,
      deleted_at: r.deleted_at,
    }))
}
