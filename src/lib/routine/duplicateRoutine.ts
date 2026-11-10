import { supabase } from '@/lib/supabase'

/** Lo mínimo de la rutina de origen que se copia a la nueva. */
export type DuplicableRoutine = {
  id: string
  name: string
  objective?: string | null
  level?: string | null
  start_date?: string | null
  end_date?: string | null
  duration_days?: number | null
  price?: number | null
  notes?: string | null
}

/**
 * Copia una rutina completa (bloques, días y ejercicios) a un alumno.
 * Devuelve el id de la rutina nueva o lanza un Error con el mensaje para mostrar.
 */
export async function duplicateRoutine(source: DuplicableRoutine, ownerId: string, studentId: string): Promise<string> {
  const { data: blocks } = await supabase.from('routine_blocks').select('*').eq('routine_id', source.id).order('sort_order')
  const blockIds = (blocks ?? []).map((b) => b.id as string)
  const { data: days } = blockIds.length
    ? await supabase.from('routine_days').select('*').in('block_id', blockIds).order('sort_order')
    : { data: [] as Record<string, unknown>[] }
  const dayIds = (days ?? []).map((d) => d.id as string)
  const { data: exercises } = dayIds.length
    ? await supabase.from('routine_exercises').select('*').in('day_id', dayIds).order('sort_order')
    : { data: [] as Record<string, unknown>[] }

  const { data: newRoutine, error: routineErr } = await supabase
    .from('routines')
    .insert({
      owner_id: ownerId,
      student_id: studentId,
      name: `${source.name} (copia)`,
      objective: source.objective,
      level: source.level,
      start_date: source.start_date,
      end_date: source.end_date,
      duration_days: source.duration_days,
      price: source.price,
      status: 'activa',
      notes: source.notes,
    })
    .select('id')
    .single()
  if (routineErr || !newRoutine) throw new Error(routineErr?.message ?? 'Error al duplicar')

  const blockIdMap = new Map<string, string>()
  for (const b of blocks ?? []) {
    const { data: nb } = await supabase
      .from('routine_blocks')
      .insert({
        routine_id: newRoutine.id,
        name: b.name,
        sort_order: b.sort_order,
        notes: b.notes,
        start_date: b.start_date,
        end_date: b.end_date,
      })
      .select('id')
      .single()
    if (nb) blockIdMap.set(b.id as string, nb.id as string)
  }

  const dayIdMap = new Map<string, string>()
  for (const d of days ?? []) {
    const newBlockId = blockIdMap.get(d.block_id as string)
    if (!newBlockId) continue
    const { data: nd } = await supabase
      .from('routine_days')
      .insert({
        block_id: newBlockId,
        day_name: d.day_name,
        day_of_week: d.day_of_week,
        muscle_focus: d.muscle_focus,
        warmup_notes: d.warmup_notes,
        sort_order: d.sort_order,
      })
      .select('id')
      .single()
    if (nd) dayIdMap.set(d.id as string, nd.id as string)
  }

  const exRows = (exercises ?? [])
    .map((ex) => {
      const newDayId = dayIdMap.get(ex.day_id as string)
      if (!newDayId) return null
      const { id: _id, day_id: _day, exercise: _ex, ...rest } = ex as Record<string, unknown>
      void _id
      void _day
      void _ex
      return { ...rest, day_id: newDayId }
    })
    .filter(Boolean)
  if (exRows.length) await supabase.from('routine_exercises').insert(exRows)

  return newRoutine.id as string
}
