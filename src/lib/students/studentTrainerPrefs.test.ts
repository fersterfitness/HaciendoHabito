import { describe, expect, it } from 'vitest'
import type { Student } from '@/types/database'
import {
  buildTrainerPrefsMigratePatch,
  clearLocalTrainerPrefs,
  readLocalTrainerPrefs,
  studentMonthlyFeeAmount,
  studentTrainerTags,
} from '@/lib/students/studentTrainerPrefs'

const baseStudent = {
  id: 'student-1',
  owner_id: 'owner-1',
  profile_id: null,
  full_name: 'Test',
  email: null,
  phone: null,
  birth_date: null,
  level: 'inicial',
  gender: null,
  status: 'activo',
  notes: null,
  document_id: null,
  address: null,
  weight_kg: null,
  height_cm: null,
  selected_web_plan_slug: null,
  intake_ferster: null,
  intake_nutrition: null,
  avatar_path: null,
  plan_end_date: null,
  trainer_tags: [],
  monthly_fee_amount: null,
  target_weight_kg: null,
  created_at: '',
  updated_at: '',
} satisfies Student

describe('studentTrainerPrefs', () => {
  it('studentTrainerTags devuelve array vacío si falta columna', () => {
    expect(studentTrainerTags({ trainer_tags: undefined as unknown as string[] })).toEqual([])
  })

  it('buildTrainerPrefsMigratePatch sube tags locales si DB vacía', () => {
    localStorage.setItem('tags_student-1', JSON.stringify(['gym']))
    const local = readLocalTrainerPrefs('student-1')
    const patch = buildTrainerPrefsMigratePatch(baseStudent, local)
    expect(patch.trainer_tags).toEqual(['gym'])
  })

  it('no pisa tags en DB con datos locales', () => {
    const student = { ...baseStudent, trainer_tags: ['vip'] }
    localStorage.setItem('tags_student-1', JSON.stringify(['gym']))
    const patch = buildTrainerPrefsMigratePatch(student, readLocalTrainerPrefs('student-1'))
    expect(patch.trainer_tags).toBeUndefined()
  })

  it('studentMonthlyFeeAmount prioriza DB', () => {
    expect(studentMonthlyFeeAmount({ id: 'x', monthly_fee_amount: 12000 })).toBe(12000)
    localStorage.setItem('cuota_mensual_x', '8000')
    expect(studentMonthlyFeeAmount({ id: 'x', monthly_fee_amount: null })).toBe(8000)
  })

  it('clearLocalTrainerPrefs limpia las tres claves', () => {
    localStorage.setItem('tags_student-1', '[]')
    localStorage.setItem('cuota_mensual_student-1', '100')
    localStorage.setItem('peso_goal_student-1', '70')
    clearLocalTrainerPrefs('student-1')
    expect(localStorage.getItem('tags_student-1')).toBeNull()
    expect(localStorage.getItem('cuota_mensual_student-1')).toBeNull()
    expect(localStorage.getItem('peso_goal_student-1')).toBeNull()
  })
})
