import type * as THREE from 'three'
import type { BodyZoneId } from '@/lib/nutrition/bodyZoneComparison'

export type BodySex = 'M' | 'F'

/** Índice 0 = sin medida (cabeza, manos, pies, articulaciones). */
export const BODY_ZONE_BY_INDEX: (BodyZoneId | null)[] = [null, 'pecho', 'brazo', 'antebrazo', 'abdomen', 'costado', 'cadera', 'muslo', 'pantorrilla']
export const BODY_ZONE_INDEX = Object.fromEntries(BODY_ZONE_BY_INDEX.map((z, i) => [z, i]).filter(([z]) => z)) as Record<BodyZoneId, number>

/** Malla en arreglos planos (se puede pasar desde un Web Worker sin copiar). */
export interface BodyMeshData {
  positions: Float32Array
  normals: Float32Array
  index: Uint32Array
  /** Una zona por vértice, como índice de BODY_ZONE_BY_INDEX. */
  zones: Uint8Array
}

/** Malla lista para pintar. Altura ≈ 1,8, pies en y = 0. */
export interface ZonedGeometry {
  geometry: THREE.BufferGeometry
  zones: Uint8Array
  source: 'procedural' | 'model'
}
