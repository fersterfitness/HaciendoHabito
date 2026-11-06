import type * as THREE from 'three'
import type { BodyZoneId } from '@/lib/nutrition/bodyZoneComparison'

export type BodySex = 'M' | 'F'

/** Malla lista para pintar: una zona (o null = sin medida) por vértice. Altura ≈ 1,8, pies en y = 0. */
export interface ZonedGeometry {
  geometry: THREE.BufferGeometry
  zones: (BodyZoneId | null)[]
  source: 'procedural' | 'model'
}
