import type { BodyZoneId } from '@/lib/nutrition/bodyZoneComparison'

export type BodySex = 'M' | 'F'
export type BodyView = 'frente' | 'espalda'

/** Mismo orden que ZONES en scripts/body2d/build_body_zones.py. Índice 0 = sin zona. */
export const BODY_ZONE_BY_INDEX: (BodyZoneId | null)[] = [null, 'pecho', 'brazo', 'antebrazo', 'abdomen', 'costado', 'cadera', 'muslo', 'pantorrilla']

/** En el mapa de zonas cada índice se guarda multiplicado por este paso. */
export const ZONE_MAP_STEP = 20

export function bodyImageUrls(sex: BodySex, view: BodyView) {
  const base = `/body2d/${sex === 'F' ? 'mujer' : 'hombre'}-${view}`
  return { image: `${base}.webp`, zones: `${base}-zonas.png` }
}

/** Para «Otro», el cuerpo a mostrar se recuerda en este navegador sin tocar la ficha. */
export const bodyModelStorageKey = (studentId: string) => `hh-body-model:${studentId}`

export function readStoredModel(studentId: string): BodySex | null {
  try {
    const v = localStorage.getItem(bodyModelStorageKey(studentId))
    return v === 'M' || v === 'F' ? v : null
  } catch {
    return null
  }
}

/** Cuerpo que corresponde al paciente: el de su sexo, o el elegido para «Otro». */
export function bodySexOf(student: { id: string; gender: 'M' | 'F' | 'otro' | null }): BodySex | null {
  if (student.gender === 'M' || student.gender === 'F') return student.gender
  return student.gender === 'otro' ? readStoredModel(student.id) : null
}
