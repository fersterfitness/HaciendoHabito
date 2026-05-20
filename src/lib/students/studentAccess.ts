import { supabase } from '@/lib/supabase'
import { linkStudentAvatarIfFileExists } from '@/lib/studentAvatar'
import type { AppRole, Student, StudentDeletionLogEntry, StudentStatus } from '@/types/database'

/**
 * Alumnos/pacientes visibles para el usuario actual (dueño directo o plan Full en student_owners).
 * Preferimos RPC: funciona aunque falte alguna política RLS de lectura compartida.
 */
export async function fetchAccessibleStudents(): Promise<{ data: Student[]; error: string | null }> {
  const { data, error } = await supabase.rpc('list_my_students')
  if (!error) {
    return { data: (data ?? []) as Student[], error: null }
  }

  if (import.meta.env.DEV) {
    console.warn('[studentAccess] list_my_students RPC:', error.message)
  }

  // Fallback: RLS (students_owner_read + students_shared_select + students_full_plan_nutritionist_select)
  const { data: fallback, error: fallbackError } = await accessibleStudentsSelect('*').order('full_name', {
    ascending: true,
  })
  if (fallbackError) return { data: [], error: fallbackError.message }
  return { data: (fallback ?? []) as Student[], error: null }
}

function isAccessibleStudentRow(row: Student | null | undefined): row is Student {
  return Boolean(row?.id)
}

export async function fetchAccessibleStudentById(
  id: string,
): Promise<{ data: Student | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_my_student', { p_student_id: id })
  const row = (Array.isArray(data) ? data[0] : data) as Student | null | undefined
  if (!error && isAccessibleStudentRow(row)) {
    if (!row.avatar_path) {
      const linked = await linkStudentAvatarIfFileExists(row.id, null)
      if (linked) return { data: { ...row, avatar_path: linked }, error: null }
    }
    return { data: row, error: null }
  }

  if (import.meta.env.DEV && error) {
    console.warn('[studentAccess] get_my_student RPC:', error.message)
  }

  // Misma visibilidad que el listado (evita fila “fantasma” con id null del RPC).
  const listed = await fetchAccessibleStudents()
  if (!listed.error) {
    const fromList = listed.data.find((s) => s.id === id)
    if (fromList) return { data: fromList, error: null }
  }

  const { data: fallback, error: fallbackError } = await accessibleStudentById(id)
  if (fallbackError) return { data: null, error: fallbackError.message }
  if (isAccessibleStudentRow(fallback as Student | null)) {
    const s = fallback as Student
    if (!s.avatar_path) {
      const linked = await linkStudentAvatarIfFileExists(s.id, null)
      if (linked) return { data: { ...s, avatar_path: linked }, error: null }
    }
    return { data: s, error: null }
  }
  return { data: null, error: listed.error ?? error?.message ?? null }
}

export function filterAccessibleStudents(
  students: Student[],
  opts?: { search?: string; status?: StudentStatus },
): Student[] {
  let rows = students
  if (opts?.status) rows = rows.filter((s) => s.status === opts.status)
  const q = opts?.search?.trim().toLowerCase()
  if (q) rows = rows.filter((s) => s.full_name.toLowerCase().includes(q))
  return rows
}

/** Consulta directa (RLS). Usar `fetchAccessibleStudents` en listados. */
export function accessibleStudentsSelect(
  columns = '*',
  options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean },
) {
  return supabase.from('students').select(columns, options)
}

export function accessibleStudentById(id: string, columns = '*') {
  return supabase.from('students').select(columns).eq('id', id).maybeSingle()
}

export function updateAccessibleStudent(id: string, payload: Partial<Student>) {
  return supabase.from('students').update(payload).eq('id', id)
}

/** Solo el dueño primario (`owner_id`) puede eliminar el registro. */
export function deleteOwnedStudent(id: string, ownerId: string) {
  return supabase.from('students').delete().eq('id', id).eq('owner_id', ownerId)
}

/** Historial de eliminaciones visibles para el profesional (dueño, co-profesional Full o quien eliminó). */
export async function fetchStudentDeletionLog(opts: {
  userId: string
  role: AppRole | undefined
}): Promise<{
  data: StudentDeletionLogEntry[]
  error: string | null
}> {
  const { userId, role } = opts

  let rows: Record<string, unknown>[] | null = null
  let tableError = null as { code?: string; message: string } | null

  const richSelect = await supabase
    .from('student_deletion_log')
    .select(
      'id, student_id, full_name, email, phone, status, deleted_at, deleted_by, primary_owner_id, snapshot, restored_at',
    )
    .is('restored_at', null)
    .not('deleted_by', 'is', null)
    .order('deleted_at', { ascending: false })
    .limit(200)

  if (!richSelect.error) {
    rows = richSelect.data
  } else if (richSelect.error.code === '42703') {
    const basicSelect = await supabase
      .from('student_deletion_log')
      .select(
        'id, student_id, full_name, email, phone, status, deleted_at, deleted_by, primary_owner_id, snapshot',
      )
      .not('deleted_by', 'is', null)
      .order('deleted_at', { ascending: false })
      .limit(200)
    rows = basicSelect.data
    tableError = basicSelect.error
  } else {
    tableError = richSelect.error
  }

  if (!tableError && rows) {
    const profileIds = [
      ...new Set(
        rows.flatMap((r) => [r.deleted_by, r.primary_owner_id].filter(Boolean) as string[]),
      ),
    ]
    const namesById = new Map<string, string>()
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', profileIds)
      for (const p of profiles ?? []) namesById.set(p.id, p.full_name)
    }

    return {
      data: rows.map((row) => enrichDeletionLogRow(row, userId, role, namesById)),
      error: null,
    }
  }

  const tableMissing =
    tableError?.code === '42P01' ||
    tableError?.code === '42703' ||
    tableError?.message.includes('student_deletion_log') ||
    tableError?.message.includes('restored_at') ||
    tableError?.message.includes('schema cache')

  if (tableMissing) {
    const { data, error } = await supabase.rpc('list_my_student_deletions')
    if (!error) {
      return {
        data: (data ?? []).map((row) =>
          enrichDeletionLogRow(
            { ...row, snapshot: null, restored_at: null },
            userId,
            role,
            new Map(
              (data ?? []).flatMap((r) => {
                const entries: [string, string][] = []
                if (r.deleted_by && r.deleted_by_name) entries.push([r.deleted_by, r.deleted_by_name])
                if (r.primary_owner_id && r.primary_owner_name) {
                  entries.push([r.primary_owner_id, r.primary_owner_name])
                }
                return entries
              }),
            ),
          ),
        ),
        error: null,
      }
    }

    return {
      data: [],
      error:
        'Falta crear el historial en Supabase. Ejecutá el SQL de supabase/migrations/20260530220000_student_deletion_log.sql en el SQL Editor.',
    }
  }

  return { data: [], error: tableError?.message ?? 'No se pudo cargar el historial' }
}

function enrichDeletionLogRow(
  row: {
    id: string
    student_id: string
    full_name: string
    email: string | null
    phone: string | null
    status: string | null
    deleted_at: string
    deleted_by: string | null
    primary_owner_id: string | null
    snapshot?: unknown
    restored_at?: string | null
    can_restore?: boolean
    deleted_by_name?: string | null
    primary_owner_name?: string | null
  },
  userId: string,
  role: AppRole | undefined,
  namesById: Map<string, string>,
): StudentDeletionLogEntry {
  const snap = (row.snapshot ?? {}) as Record<string, unknown>
  const canRestore =
    !row.restored_at &&
    (row.can_restore ??
      (role === 'admin' || (role === 'trainer' && row.primary_owner_id === userId)))

  return {
    id: row.id,
    student_id: row.student_id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    deleted_at: row.deleted_at,
    deleted_by: row.deleted_by,
    deleted_by_name:
      row.deleted_by_name ?? (row.deleted_by ? namesById.get(row.deleted_by) ?? null : null),
    primary_owner_id: row.primary_owner_id,
    primary_owner_name:
      row.primary_owner_name ??
      (row.primary_owner_id ? namesById.get(row.primary_owner_id) ?? null : null),
    can_restore: canRestore,
    avatar_path: typeof snap.avatar_path === 'string' ? snap.avatar_path : null,
    birth_date: typeof snap.birth_date === 'string' ? snap.birth_date : null,
    level: typeof snap.level === 'string' ? snap.level : null,
    plan_end_date: typeof snap.plan_end_date === 'string' ? snap.plan_end_date : null,
  }
}

type DeletionLogRow = {
  id: string
  student_id: string
  primary_owner_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  status: string | null
  selected_web_plan_slug: string | null
  shared_owner_ids: string[] | null
  snapshot: Record<string, unknown> | null
  restored_at: string | null
  deleted_at: string
}

function rpcMissing(message: string): boolean {
  return (
    message.includes('restore_deleted_student') ||
    message.includes('schema cache') ||
    message.includes('PGRST202')
  )
}

async function restoreDeletedStudentFallback(
  deletionLogId: string,
  userId: string,
  role: AppRole | undefined,
): Promise<{ studentId: string | null; error: string | null }> {
  if (role !== 'trainer' && role !== 'admin') {
    return { studentId: null, error: 'Solo el entrenador dueño puede restaurar' }
  }

  const { data: log, error: logError } = await supabase
    .from('student_deletion_log')
    .select(
      'id, student_id, primary_owner_id, full_name, email, phone, status, selected_web_plan_slug, shared_owner_ids, snapshot, restored_at, deleted_at',
    )
    .eq('id', deletionLogId)
    .maybeSingle()

  if (logError || !log) {
    return { studentId: null, error: logError?.message ?? 'Registro no encontrado' }
  }

  const row = log as DeletionLogRow
  if (row.restored_at) {
    return { studentId: null, error: 'Este registro ya fue restaurado' }
  }
  if (role !== 'admin' && row.primary_owner_id !== userId) {
    return { studentId: null, error: 'No tenés permiso para restaurar este alumno' }
  }

  const { data: existing } = await supabase.from('students').select('id').eq('id', row.student_id).maybeSingle()
  if (existing) {
    return { studentId: null, error: 'Ya existe un alumno con ese identificador' }
  }

  const snap = row.snapshot ?? {}
  const str = (k: string) => {
    const v = snap[k]
    return typeof v === 'string' && v.length > 0 ? v : null
  }

  const { error: insertError } = await supabase.from('students').insert({
    id: row.student_id,
    owner_id: row.primary_owner_id,
    profile_id: str('profile_id'),
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    birth_date: str('birth_date'),
    level: (str('level') as Student['level']) ?? 'inicial',
    gender: str('gender') as Student['gender'],
    status: (row.status as Student['status']) ?? 'activo',
    notes: str('notes'),
    document_id: str('document_id'),
    address: str('address'),
    weight_kg: snap.weight_kg != null ? Number(snap.weight_kg) : null,
    height_cm: snap.height_cm != null ? Number(snap.height_cm) : null,
    selected_web_plan_slug: row.selected_web_plan_slug,
    intake_ferster: snap.intake_ferster ?? null,
    intake_nutrition: snap.intake_nutrition ?? null,
    avatar_path: str('avatar_path'),
    plan_end_date: str('plan_end_date'),
    created_at: str('created_at') ?? row.deleted_at,
  })

  if (insertError) {
    return { studentId: null, error: insertError.message }
  }

  const sharedIds = row.shared_owner_ids ?? []
  if (sharedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, role')
      .in('id', sharedIds)
    const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role]))

    for (const ownerId of sharedIds) {
      const profType =
        ownerId === row.primary_owner_id
          ? 'trainer'
          : roleById.get(ownerId) === 'nutritionist'
            ? 'nutritionist'
            : 'trainer'
      await supabase.from('student_owners').upsert(
        { student_id: row.student_id, owner_id: ownerId, professional_type: profType },
        { onConflict: 'student_id,owner_id' },
      )
    }
  }

  const { error: markError } = await supabase
    .from('student_deletion_log')
    .update({ restored_at: new Date().toISOString(), restored_by: userId })
    .eq('id', deletionLogId)
    .is('restored_at', null)

  if (markError) {
    await linkStudentAvatarIfFileExists(row.student_id, str('avatar_path'))
    return {
      studentId: row.student_id,
      error:
        'Alumno recreado, pero no se pudo cerrar el historial. Ejecutá supabase/scripts/install_restore_deleted_student.sql en Supabase.',
    }
  }

  await linkStudentAvatarIfFileExists(row.student_id, str('avatar_path'))
  return { studentId: row.student_id, error: null }
}

/** Restaura la ficha básica de un alumno/paciente eliminado (solo dueño primario o admin). */
export async function restoreDeletedStudent(
  deletionLogId: string,
  opts: { userId: string; role: AppRole | undefined },
): Promise<{
  studentId: string | null
  error: string | null
}> {
  const { data, error } = await supabase.rpc('restore_deleted_student', {
    p_deletion_log_id: deletionLogId,
  })
  if (!error) {
    const studentId = (data as string) ?? null
    if (studentId) await linkStudentAvatarIfFileExists(studentId, null)
    return { studentId, error: null }
  }

  if (rpcMissing(error.message)) {
    if (import.meta.env.DEV) {
      console.warn('[studentAccess] restore_deleted_student RPC:', error.message)
    }
    return restoreDeletedStudentFallback(deletionLogId, opts.userId, opts.role)
  }

  return { studentId: null, error: error.message }
}
