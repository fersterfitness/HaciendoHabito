import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { BodyZoneId, BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import { cn } from '@/lib/utils'
import { BODY_ZONE_BY_INDEX, ZONE_MAP_STEP, bodyImageUrls, type BodySex, type BodyView } from './zones'

/** Tonos de estado (los mismos que los chips de la tarjeta). «Sin cambio» y «sin datos» quedan en el gris original. */
const STATUS_RGB: Partial<Record<BodyZoneStatus, [number, number, number]>> = {
  good: [34, 178, 107],
  bad: [229, 72, 77],
  alert: [234, 165, 58],
  neutral: [150, 160, 196],
}

/**
 * Tono propio de cada zona (más claro o más oscuro), alternado entre vecinas: dos grupos
 * con el mismo resultado se distinguen sin dibujar líneas.
 */
const ZONE_SHADE: Record<BodyZoneId, number> = {
  pecho: 1.1,
  brazo: 0.6,
  antebrazo: 1.12,
  abdomen: 0.66,
  costado: 1.25,
  cadera: 0.72,
  muslo: 1.1,
  pantorrilla: 0.64,
}

interface ViewData {
  w: number
  h: number
  base: Uint8ClampedArray
  lum: Uint8Array
  zone: Uint8Array
}

const cache = new Map<string, Promise<ViewData>>()

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${url}`))
    img.src = url
  })
}

function pixels(img: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, c.width, c.height).data
}

function loadView(sex: BodySex, view: BodyView): Promise<ViewData> {
  const urls = bodyImageUrls(sex, view)
  let p = cache.get(urls.image)
  if (!p) {
    p = Promise.all([loadImage(urls.image), loadImage(urls.zones)]).then(([img, map]) => {
      const base = pixels(img)
      const z = pixels(map)
      const n = img.naturalWidth * img.naturalHeight
      const lum = new Uint8Array(n)
      const zone = new Uint8Array(n)
      for (let i = 0, o = 0; i < n; i++, o += 4) {
        lum[i] = (base[o]! + base[o + 1]! + base[o + 2]!) / 3
        zone[i] = base[o + 3]! > 127 ? Math.round(z[o]! / ZONE_MAP_STEP) : 0
      }
      return { w: img.naturalWidth, h: img.naturalHeight, base, lum, zone }
    })
    p.catch(() => cache.delete(urls.image))
    cache.set(urls.image, p)
  }
  return p
}

function paint(canvas: HTMLCanvasElement, d: ViewData, status: Record<BodyZoneId, BodyZoneStatus>, selected: BodyZoneId | null, hovered: BodyZoneId | null) {
  if (canvas.width !== d.w) { canvas.width = d.w; canvas.height = d.h }
  const ctx = canvas.getContext('2d')!
  const out = new ImageData(new Uint8ClampedArray(d.base), d.w, d.h)
  const px = out.data
  // Color por índice de zona; null = dejar la imagen como está.
  const tone = BODY_ZONE_BY_INDEX.map((z) => {
    if (!z) return null
    const rgb = STATUS_RGB[status[z]]
    if (!rgb) return null
    let k = ZONE_SHADE[z], lift = 0, keep = 0
    if (z === selected) lift = 0.25
    else if (z === hovered) lift = 0.12
    else if (selected) { keep = 0.55; k *= 0.9 }
    return { rgb, k, lift, keep }
  })
  const n = d.w * d.h
  for (let i = 0, o = 0; i < n; i++, o += 4) {
    const t = tone[d.zone[i]!]
    if (!t) continue
    const shade = (0.3 + (0.95 * d.lum[i]!) / 255) * t.k
    for (let ch = 0; ch < 3; ch++) {
      let v = t.rgb[ch]! * shade
      if (t.lift) v += (255 - v) * t.lift
      if (t.keep) v = v * (1 - t.keep) + d.base[o + ch]! * t.keep
      px[o + ch] = v
    }
  }
  ctx.putImageData(out, 0, 0)
}

export interface BodyMap2DProps {
  sex: BodySex
  status: Record<BodyZoneId, BodyZoneStatus>
  selected: BodyZoneId | null
  onSelect: (zone: BodyZoneId | null) => void
}

/** Cuerpo 2D (frente y espalda) con las zonas pintadas según el resultado de la comparación. */
export default function BodyMap2D({ sex, status, selected, onSelect }: BodyMap2DProps) {
  const frontRef = useRef<HTMLCanvasElement>(null)
  const backRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<BodyView>('frente')
  const [data, setData] = useState<{ frente: ViewData | null; espalda: ViewData | null }>({ frente: null, espalda: null })
  const [failed, setFailed] = useState(false)
  const [hovered, setHovered] = useState<BodyZoneId | null>(null)
  const raf = useRef(0)

  useEffect(() => {
    let alive = true
    setData({ frente: null, espalda: null })
    setFailed(false)
    // El frente primero; la espalda se baja después, sin trabar la primera vista.
    loadView(sex, 'frente')
      .then((frente) => {
        if (!alive) return
        setData((d) => ({ ...d, frente }))
        return loadView(sex, 'espalda').then((espalda) => { if (alive) setData((d) => ({ ...d, espalda })) })
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sex])

  useEffect(() => {
    if (data.frente && frontRef.current) paint(frontRef.current, data.frente, status, selected, view === 'frente' ? hovered : null)
  }, [data.frente, status, selected, hovered, view])
  useEffect(() => {
    if (data.espalda && backRef.current) paint(backRef.current, data.espalda, status, selected, view === 'espalda' ? hovered : null)
  }, [data.espalda, status, selected, hovered, view])

  const zoneAt = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, d: ViewData | null): BodyZoneId | null => {
      if (!d) return null
      const r = e.currentTarget.getBoundingClientRect()
      // La cara de atrás se gira dos veces (cara + contenedor): en pantalla se ve derecha.
      const x = Math.floor(((e.clientX - r.left) / r.width) * d.w), y = Math.floor(((e.clientY - r.top) / r.height) * d.h)
      if (x < 0 || y < 0 || x >= d.w || y >= d.h) return null
      return BODY_ZONE_BY_INDEX[d.zone[y * d.w + x]!] ?? null
    },
    [],
  )

  const current = view === 'frente' ? data.frente : data.espalda
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'mouse') return
    const target = e.currentTarget
    const z = zoneAt(e, current)
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      setHovered(z)
      target.style.cursor = z ? 'pointer' : 'default'
    })
  }
  const onClick = (e: React.PointerEvent<HTMLCanvasElement>) => onSelect(zoneAt(e, current))
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const canvasClass = 'absolute inset-0 m-auto h-full w-auto max-w-full [backface-visibility:hidden]'
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 [perspective:1600px]">
        <div
          className={cn('relative h-full w-full transition-transform duration-700 ease-out [transform-style:preserve-3d] motion-reduce:transition-none', view === 'espalda' && '[transform:rotateY(180deg)]')}
        >
          <canvas
            ref={frontRef}
            aria-label="Cuerpo de frente"
            className={cn(canvasClass, view !== 'frente' && 'pointer-events-none')}
            onPointerMove={onMove}
            onPointerLeave={() => setHovered(null)}
            onPointerUp={onClick}
          />
          <canvas
            ref={backRef}
            aria-label="Cuerpo de espalda"
            className={cn(canvasClass, '[transform:rotateY(180deg)]', view !== 'espalda' && 'pointer-events-none')}
            onPointerMove={onMove}
            onPointerLeave={() => setHovered(null)}
            onPointerUp={onClick}
          />
        </div>
      </div>
      {!data.frente && !failed ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-white/60">Cargando cuerpo…</span>
      ) : null}
      {failed ? (
        <span className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-white/70">No se pudo cargar la imagen del cuerpo. Recargá la página.</span>
      ) : null}
      <button
        type="button"
        onClick={() => setView((v) => (v === 'frente' ? 'espalda' : 'frente'))}
        disabled={view === 'frente' && !data.espalda}
        className="absolute right-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-lg bg-black/45 px-2.5 text-2xs font-semibold text-white/85 backdrop-blur hover:text-white disabled:opacity-50"
      >
        <RotateCw className="h-3.5 w-3.5" />
        {view === 'frente' ? 'Ver espalda' : 'Ver frente'}
      </button>
    </div>
  )
}
