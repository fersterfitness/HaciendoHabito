import { describe, expect, it } from 'vitest'
import { canSeeNutrition, canSeeTraining, getMobileNavItems, getNavSections } from '@/config/navigation'
import type { AppRole } from '@/types/database'

const hrefs = (role: AppRole) => getNavSections(role).flatMap((s) => s.items.map((i) => i.href))

describe('permisos del menú por rol', () => {
  it('el alumno no ve nada de gestión profesional', () => {
    const items = hrefs('student')
    for (const forbidden of ['/students', '/routines', '/finances', '/nutrition', '/exercises']) {
      expect(items.some((h) => h.startsWith(forbidden))).toBe(false)
    }
    expect(getMobileNavItems('student').some((i) => i.href.startsWith('/finances'))).toBe(false)
  })

  it('el psicólogo no ve finanzas, rutinas ni nutrición', () => {
    const items = hrefs('psychologist')
    expect(items.some((h) => h.startsWith('/finances'))).toBe(false)
    expect(items.some((h) => h.startsWith('/routines'))).toBe(false)
    expect(items.some((h) => h.startsWith('/nutrition'))).toBe(false)
  })

  it('entrenamiento y nutrición según el rol', () => {
    expect(canSeeTraining('trainer')).toBe(true)
    expect(canSeeTraining('nutritionist')).toBe(false)
    expect(canSeeTraining('student')).toBe(false)
    expect(canSeeNutrition('nutritionist')).toBe(true)
    expect(canSeeNutrition('trainer')).toBe(false)
    expect(canSeeTraining('admin') && canSeeNutrition('admin')).toBe(true)
  })

  it('el entrenador ve finanzas y entrenamiento; el nutricionista no ve la base de ejercicios', () => {
    expect(hrefs('trainer').some((h) => h.startsWith('/finances'))).toBe(true)
    expect(hrefs('trainer').some((h) => h.startsWith('/exercises'))).toBe(true)
    expect(hrefs('nutritionist').some((h) => h.startsWith('/exercises'))).toBe(false)
  })
})
