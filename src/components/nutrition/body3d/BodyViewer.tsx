import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { BodyZoneId, BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import { buildProceduralBody } from './proceduralBody'
import { loadModelBody } from './modelBody'
import type { BodySex, ZonedGeometry } from './types'

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

const cache = new Map<BodySex, Promise<ZonedGeometry>>()
function bodyFor(sex: BodySex) {
  let p = cache.get(sex)
  if (!p) {
    p = loadModelBody(sex)
      .catch(() => null)
      .then((m) => m ?? new Promise<ZonedGeometry>((res) => setTimeout(() => res(buildProceduralBody(sex)), 20)))
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
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
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
      new THREE.CylinderGeometry(0.27, 0.29, 0.04, 64),
      new THREE.MeshStandardMaterial({ color: 0x3e3f47, roughness: 0.85 }),
    )
    pedestal.position.y = -0.02
    scene.add(pedestal)

    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5 })
    let mesh: THREE.Mesh | null = null
    const white = new THREE.Color(0xffffff)

    const paint = () => {
      const st = stateRef.current
      const body = st.body
      if (!body) return
      const col = body.geometry.getAttribute('color') as THREE.BufferAttribute
      const byZone = new Map<BodyZoneId, THREE.Color>()
      for (const z of Object.keys(st.status) as BodyZoneId[]) {
        const c = new THREE.Color(STATUS_HEX[st.status[z]]).lerp(CLAY, 0.22)
        if (z === st.selected) c.lerp(white, 0.28)
        else if (z === st.hovered) c.lerp(white, 0.14)
        else if (st.selected) c.multiplyScalar(0.7)
        byZone.set(z, c)
      }
      const skin = new THREE.Color(SKIN_HEX)
      for (let v = 0; v < body.zones.length; v++) {
        const z = body.zones[v]
        const c = (z && byZone.get(z)) || skin
        col.setXYZ(v, c.r, c.g, c.b)
      }
      col.needsUpdate = true
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
    const pick = (e: PointerEvent): BodyZoneId | null => {
      if (!mesh) return null
      const r = renderer.domElement.getBoundingClientRect()
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ptr, camera)
      const hit = ray.intersectObject(mesh, false)[0]
      return hit?.face ? stateRef.current.body?.zones[hit.face.a] ?? null : null
    }
    let down: [number, number] | null = null
    const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY] }
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) stateRef.current.onSelect(pick(e))
      down = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const z = pick(e)
      if (z !== stateRef.current.hovered) {
        stateRef.current.hovered = z
        renderer.domElement.style.cursor = z ? 'pointer' : 'grab'
        paint()
      }
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.domElement.addEventListener('pointermove', onMove)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    let raf = 0
    const loop = () => {
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()

    sceneRef.current = { controls, setBody, paint }
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      renderer.domElement.removeEventListener('pointermove', onMove)
      controls.dispose()
      material.dispose()
      pedestal.geometry.dispose()
      ;(pedestal.material as THREE.Material).dispose()
      renderer.dispose()
      renderer.domElement.remove()
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
    if (sceneRef.current) sceneRef.current.controls.autoRotate = autoRotate && !reduce
  }, [autoRotate])

  return (
    <div ref={hostRef} className="absolute inset-0 cursor-grab">
      {loading ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-ink-muted">Armando el cuerpo…</span>
      ) : null}
    </div>
  )
}
