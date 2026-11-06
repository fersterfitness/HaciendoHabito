import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { BodyZoneId, BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import { loadModelBody } from './modelBody'
import { BODY_ZONE_BY_INDEX, type BodyMeshData, type BodySex, type ZonedGeometry } from './types'

/** Colores de estado (mismos tonos que los chips de la tarjeta), un poco apagados hacia arcilla al pintar. */
const STATUS_HEX: Record<BodyZoneStatus, number> = {
  good: 0x22b26b,
  bad: 0xe5484d,
  alert: 0xeaa53a,
  neutral: 0x9a9ca8,
  same: 0x9a9ca8,
  nodata: 0x6f717c,
}
const SKIN_HEX = 0x6f717c
const CLAY = new THREE.Color(0x8a8c96)

/** El cuerpo generado por código se arma en un Web Worker: así no se traba la pantalla. */
function buildInWorker(sex: BodySex): Promise<BodyMeshData> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./proceduralBody.worker.ts', import.meta.url), { type: 'module' })
    } catch (e) {
      reject(e)
      return
    }
    worker.onmessage = (e: MessageEvent<BodyMeshData>) => { resolve(e.data); worker.terminate() }
    worker.onerror = (e) => { reject(e); worker.terminate() }
    worker.postMessage(sex)
  })
}

async function proceduralBody(sex: BodySex): Promise<ZonedGeometry> {
  const data = await buildInWorker(sex).catch(async () => (await import('./proceduralBody')).buildProceduralBodyData(sex))
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(data.zones.length * 3), 3))
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1))
  geometry.computeBoundingSphere()
  return { geometry, zones: data.zones, source: 'procedural' }
}

const cache = new Map<BodySex, Promise<ZonedGeometry>>()
function bodyFor(sex: BodySex) {
  let p = cache.get(sex)
  if (!p) {
    p = loadModelBody(sex)
      .catch(() => null)
      .then((m) => m ?? proceduralBody(sex))
    cache.set(sex, p)
  }
  return p
}

export interface BodyViewerProps {
  sex: BodySex
  status: Record<BodyZoneId, BodyZoneStatus>
  selected: BodyZoneId | null
  onSelect: (zone: BodyZoneId | null) => void
  autoRotate: boolean
}

export default function BodyViewer({ sex, status, selected, onSelect, autoRotate }: BodyViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    controls: OrbitControls
    setBody: (b: ZonedGeometry) => void
    paint: () => void
    invalidate: () => void
  } | null>(null)
  const stateRef = useRef({ status, selected, hovered: null as BodyZoneId | null, onSelect, body: null as ZonedGeometry | null })
  const [loading, setLoading] = useState(true)
  stateRef.current.status = status
  stateRef.current.selected = selected
  stateRef.current.onSelect = onSelect

  useEffect(() => {
    const host = hostRef.current
    const st = stateRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.domElement.style.display = 'block'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.touchAction = 'none'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0.9, 1.15, 4.1)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 0.9, 0)
    controls.enablePan = false
    controls.minDistance = 1.6
    controls.maxDistance = 5.5
    controls.minPolarAngle = 0.9
    controls.maxPolarAngle = 1.95
    controls.enableDamping = true
    controls.autoRotateSpeed = 1.6

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a33, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(2, 3, 2.5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-2.5, 1, 1.5)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x9db4ff, 3.2)
    rim.position.set(-1.5, 2.5, -3)
    scene.add(rim)

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.29, 0.04, 48),
      new THREE.MeshStandardMaterial({ color: 0x3e3f47, roughness: 0.85 }),
    )
    pedestal.position.y = -0.02
    scene.add(pedestal)

    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0 })
    let mesh: THREE.Mesh | null = null
    const white = new THREE.Color(0xffffff)

    // Se dibuja solo cuando algo cambió (giro, arrastre, colores) y la tarjeta está a la vista.
    let dirty = true
    let visible = true
    const invalidate = () => { dirty = true }

    const paint = () => {
      const cur = stateRef.current
      const body = cur.body
      if (!body) return
      const col = body.geometry.getAttribute('color') as THREE.BufferAttribute
      const arr = col.array as Float32Array
      const palette: THREE.Color[] = BODY_ZONE_BY_INDEX.map((z) => {
        if (!z) return new THREE.Color(SKIN_HEX)
        const c = new THREE.Color(STATUS_HEX[cur.status[z] ?? 'nodata']).lerp(CLAY, 0.22)
        if (z === cur.selected) c.lerp(white, 0.28)
        else if (z === cur.hovered) c.lerp(white, 0.14)
        else if (cur.selected) c.multiplyScalar(0.7)
        return c
      })
      const zones = body.zones
      for (let v = 0, o = 0; v < zones.length; v++, o += 3) {
        const c = palette[zones[v]!]!
        arr[o] = c.r; arr[o + 1] = c.g; arr[o + 2] = c.b
      }
      col.needsUpdate = true
      invalidate()
    }

    const setBody = (b: ZonedGeometry) => {
      stateRef.current.body = b
      if (mesh) scene.remove(mesh)
      mesh = new THREE.Mesh(b.geometry, material)
      scene.add(mesh)
      paint()
    }

    const ray = new THREE.Raycaster()
    const ptr = new THREE.Vector2()
    const pickAt = (clientX: number, clientY: number): BodyZoneId | null => {
      if (!mesh) return null
      const r = renderer.domElement.getBoundingClientRect()
      ptr.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObject(mesh, false)[0]
      const zones = stateRef.current.body?.zones
      return hit?.face && zones ? BODY_ZONE_BY_INDEX[zones[hit.face.a]!] ?? null : null
    }
    let down: [number, number] | null = null
    let hoverAt: [number, number] | null = null
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY] }
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) stateRef.current.onSelect(pickAt(e.clientX, e.clientY))
      down = null
    }
    // El hover se resuelve una vez por cuadro y nunca mientras se arrastra.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && !down) hoverAt = [e.clientX, e.clientY]
    }
    const onLeave = () => {
      hoverAt = null
      if (stateRef.current.hovered) { stateRef.current.hovered = null; paint() }
    }
    const el = renderer.domElement
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    controls.addEventListener('change', invalidate)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      invalidate()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const io = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (visible) invalidate() })
    io.observe(host)

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) return
      if (hoverAt) {
        const z = pickAt(hoverAt[0], hoverAt[1])
        hoverAt = null
        if (z !== stateRef.current.hovered) {
          stateRef.current.hovered = z
          el.style.cursor = z ? 'pointer' : 'grab'
          paint()
        }
      }
      controls.update()
      if (dirty) {
        dirty = false
        renderer.render(scene, camera)
      }
    }
    loop()

    sceneRef.current = { controls, setBody, paint, invalidate }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      controls.removeEventListener('change', invalidate)
      controls.dispose()
      material.dispose()
      pedestal.geometry.dispose()
      ;(pedestal.material as THREE.Material).dispose()
      renderer.dispose()
      el.remove()
      sceneRef.current = null
      st.body = null
    }
  }, [])

  useEffect(() => {
    let alive = true
    setLoading(true)
    void bodyFor(sex).then((b) => {
      if (!alive) return
      sceneRef.current?.setBody(b)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [sex])

  useEffect(() => {
    sceneRef.current?.paint()
  }, [status, selected])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (sceneRef.current) {
      sceneRef.current.controls.autoRotate = autoRotate && !reduce
      sceneRef.current.invalidate()
    }
  }, [autoRotate])

  return (
    <div ref={hostRef} className="absolute inset-0 cursor-grab">
      {loading ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-ink-muted">Armando el cuerpo…</span>
      ) : null}
    </div>
  )
}
