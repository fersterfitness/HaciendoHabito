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
