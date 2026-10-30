/**
 * Planes de comida asignados a alumnos (`trainer_student_meal_plans`).
 * Cada función devuelve la consulta de Supabase tal cual ({ data, error }).
 */

import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

export const mealPlanRepo = {
  /** Todos los planes del profesional, con datos del alumno (listado de Planes). */
  listByOwner: (ownerId: string) =>
    supabase
      .from('trainer_student_meal_plans')
      .select('*, student:students(full_name, avatar_path, intake_ferster, intake_nutrition)')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false }),

  /** Planes de un alumno cargados por este profesional (ficha del alumno). */
  listForStudentByOwner: (studentId: string, ownerId: string) =>
    supabase
      .from('trainer_student_meal_plans')
      .select('*')
      .eq('student_id', studentId)
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false }),

  /** Planes de un alumno de cualquier profesional (resumen, vista del alumno). */
  listForStudent: (studentId: string) =>
    supabase.from('trainer_student_meal_plans').select('*').eq('student_id', studentId).order('updated_at', { ascending: false }),

  /** Resumen de planes de un alumno (fechas y estado). */
  summaryForStudent: (studentId: string) =>
    supabase
      .from('trainer_student_meal_plans')
      .select('id, title, start_date, end_date, completed_at, updated_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false }),

  getForStudent: (planId: string, studentId: string) =>
    supabase.from('trainer_student_meal_plans').select('*').eq('id', planId).eq('student_id', studentId).maybeSingle(),

  getForOwner: (planId: string, studentId: string, ownerId: string) =>
    supabase
      .from('trainer_student_meal_plans')
      .select('*, student:students(full_name)')
      .eq('id', planId)
      .eq('student_id', studentId)
      .eq('owner_id', ownerId)
      .maybeSingle(),

  create: (row: { owner_id: string; student_id: string; title: string; data: Json; cloned_from_id?: string | null }) =>
    supabase.from('trainer_student_meal_plans').insert(row).select('*').single(),

  rename: (id: string, ownerId: string, title: string) =>
    supabase.from('trainer_student_meal_plans').update({ title }).eq('id', id).eq('owner_id', ownerId),

  setCompleted: (id: string, completedAt: string | null) =>
    supabase.from('trainer_student_meal_plans').update({ completed_at: completedAt }).eq('id', id),

  remove: (id: string, ownerId?: string) => {
    const q = supabase.from('trainer_student_meal_plans').delete().eq('id', id)
    return ownerId ? q.eq('owner_id', ownerId) : q
  },
}
