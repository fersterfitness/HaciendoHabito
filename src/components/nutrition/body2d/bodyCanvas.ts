import type { BodyZoneId, BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import { BODY_ZONE_BY_INDEX, ZONE_MAP_STEP, bodyImageUrls, type BodySex, type BodyView } from './zones'

/** Carga y pintado del cuerpo 2D (lo usan el visor interactivo y el informe ilustrado). */

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

export interface ViewData {
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

export function loadView(sex: BodySex, view: BodyView): Promise<ViewData> {
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

export function paint(canvas: HTMLCanvasElement, d: ViewData, status: Record<BodyZoneId, BodyZoneStatus>, selected: BodyZoneId | null, hovered: BodyZoneId | null) {
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

