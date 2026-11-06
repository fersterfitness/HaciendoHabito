/**
 * Carga del modelo 3D real (public/models/body-male.glb y body-female.glb).
 * Si el archivo no está, el visor usa el cuerpo generado por código.
 *
 * Las zonas se asignan por posición del vértice sobre el cuerpo normalizado
 * (altura 1,8, pies en y = 0, centrado en x/z). Los cortes son provisorios:
 * se ajustan cuando esté el modelo definitivo.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { BodyZoneId } from '@/lib/nutrition/bodyZoneComparison'
import { BODY_ZONE_INDEX, type BodySex, type ZonedGeometry } from './types'

export const BODY_MODEL_URL: Record<BodySex, string> = {
  M: '/models/body-male.glb',
  F: '/models/body-female.glb',
}

const HEIGHT = 1.8

async function exists(url: string) {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    const type = r.headers.get('content-type') ?? ''
    // El fallback de la SPA devuelve index.html con 200: no cuenta como modelo.
    return r.ok && !type.includes('text/html')
  } catch {
    return false
  }
}

function zoneAt(x: number, y: number, tPose: boolean): BodyZoneId | null {
  const ax = Math.abs(x)
  if (y >= 1.55) return null
  if (tPose && y >= 1.28 && ax > 0.22) return ax < 0.5 ? 'brazo' : ax < 0.75 ? 'antebrazo' : null
  if (y >= 1.0) {
    const torsoHalf = y > 1.3 ? 0.17 : y > 1.15 ? 0.155 : 0.15
    if (ax > torsoHalf) return y > 1.17 ? 'brazo' : 'antebrazo'
    if (y > 1.22) return 'pecho'
    return ax > 0.09 && y < 1.15 ? 'costado' : 'abdomen'
  }
  if (y >= 0.82) {
    if (ax > 0.2) return y > 0.92 ? 'antebrazo' : null
    return 'cadera'
  }
  if (y >= 0.55) return ax > 0.22 ? null : 'muslo'
  if (y >= 0.5) return null
  if (y >= 0.1) return 'pantorrilla'
  return null
}

export async function loadModelBody(sex: BodySex): Promise<ZonedGeometry | null> {
  const url = BODY_MODEL_URL[sex]
  if (!(await exists(url))) return null
  const gltf = await new GLTFLoader().loadAsync(url)
  gltf.scene.updateMatrixWorld(true)
  const parts: THREE.BufferGeometry[] = []
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const g = new THREE.BufferGeometry()
    const src = mesh.geometry
    g.setAttribute('position', src.getAttribute('position').clone())
    if (src.getAttribute('normal')) g.setAttribute('normal', src.getAttribute('normal').clone())
    if (src.index) g.setIndex(src.index.clone())
    g.applyMatrix4(mesh.matrixWorld)
    parts.push(g.index ? g.toNonIndexed() : g)
  })
  if (!parts.length) return null
  const geometry = mergeGeometries(parts, false)
  if (!geometry) return null

  geometry.computeBoundingBox()
  const bb = geometry.boundingBox!
  const size = bb.getSize(new THREE.Vector3())
  const s = HEIGHT / size.y
  geometry.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2)
  geometry.scale(s, s, s)
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()

  const tPose = size.x * s > HEIGHT * 0.75
  const pos = geometry.getAttribute('position')
  const zones = new Uint8Array(pos.count)
  for (let i = 0; i < pos.count; i++) {
    const z = zoneAt(pos.getX(i), pos.getY(i), tPose)
    zones[i] = z ? BODY_ZONE_INDEX[z] : 0
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3))
  return { geometry, zones, source: 'model' }
}
