import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { loadLabeledView, type ViewData } from '@/components/nutrition/body2d/bodyCanvas'
import { bodyImageUrls, type BodySex, type BodyView } from '@/components/nutrition/body2d/zones'
import { round1, VOLUME_MUSCLES, type MuscleId, type VolumeStatus } from '@/lib/volume/trainingVolume'

/** Mismo orden que MUSCLES en scripts/body2d/build_muscle_zones.py. Índice 0 = sin músculo. */
const MUSCLE_BY_INDEX: (MuscleId | null)[] = [null, ...VOLUME_MUSCLES.map((m) => m.id)]
const MUSCLE_MAP_STEP = 18
const LABEL = Object.fromEntries(VOLUME_MUSCLES.map((m) => [m.id, m.label])) as Record<MuscleId, string>

/** Tonos pastel (como el cuerpo del nutricionista): verde en rango, ámbar por debajo, rojo por encima. */
const STATUS_RGB: Partial<Record<VolumeStatus, [number, number, number]>> = {
  ok: [104, 196, 140],
  low: [240, 192, 112],
  high: [236, 120, 104],
}
const BODY_STATUS_DOT: Record<VolumeStatus, string> = {
  none: 'rgb(var(--ink-muted) / 0.35)',
  ok: 'rgb(104 196 140)',
  low: 'rgb(240 192 112)',
  high: 'rgb(236 120 104)',
}

/** Vecinos con distinto tono para que dos músculos con el mismo estado se separen sin líneas. */
const SHADE: Record<MuscleId, number> = {
  cuadriceps: 1.08,
  femoral: 1.08,
  gluteo: 0.82,
  aductores: 0.8,
  pecho: 1.1,
  deltoides: 0.8,
  deltoide_post: 0.8,
  espalda: 1.06,
  trapecio: 0.78,
  biceps: 1.1,
  triceps: 1.1,
  gemelos: 0.9,
  abdominales: 0.82,
}

function loadMuscleView(sex: BodySex, view: BodyView) {
  const { image } = bodyImageUrls(sex, view)
  return loadLabeledView(image, image.replace(/\.webp$/, '-musculos.png'), MUSCLE_MAP_STEP)
}

function paint(canvas: HTMLCanvasElement, d: ViewData, status: Record<MuscleId, VolumeStatus>, active: MuscleId | null) {
  if (canvas.width !== d.w) {
    canvas.width = d.w
    canvas.height = d.h
  }
  const out = new ImageData(new Uint8ClampedArray(d.base), d.w, d.h)
  const px = out.data
  const tone = MUSCLE_BY_INDEX.map((m) => {
    if (!m) return null
    const rgb = STATUS_RGB[status[m]]
    const lift = m === active ? 0.3 : 0
    if (!rgb) return lift ? { rgb: [150, 150, 150] as [number, number, number], k: 1, lift, keep: 0.5 } : null
    return { rgb, k: SHADE[m], lift, keep: active && m !== active ? 0.35 : 0 }
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
  canvas.getContext('2d')!.putImageData(out, 0, 0)
}

/** Centro de cada músculo del lado izquierdo de la imagen (en %), para ubicar la alerta de molestia. */
function centers(d: ViewData): Partial<Record<MuscleId, { x: number; y: number }>> {
  const sx = new Float64Array(MUSCLE_BY_INDEX.length)
  const sy = new Float64Array(MUSCLE_BY_INDEX.length)
  const c = new Float64Array(MUSCLE_BY_INDEX.length)
  const half = d.w / 2
  for (let y = 0; y < d.h; y++)
    for (let x = 0; x < half; x++) {
      const z = d.zone[y * d.w + x]!
      if (!z) continue
      sx[z] += x
      sy[z] += y
      c[z] += 1
    }
  const out: Partial<Record<MuscleId, { x: number; y: number }>> = {}
  MUSCLE_BY_INDEX.forEach((m, i) => {
    if (m && c[i]! > 400) out[m] = { x: (sx[i]! / c[i]! / d.w) * 100, y: (sy[i]! / c[i]! / d.h) * 100 }
  })
  return out
}

/** Parte de cada costado de la imagen (768 px de ancho) que es aire: se recorta. */
const SIDE_CROP = 0.16

export type BodyPain = { muscle: MuscleId; text: string }

function Figure({
  sex,
  view,
  status,
  active,
  onHover,
  pains,
}: {
  sex: BodySex
  view: BodyView
  status: Record<MuscleId, VolumeStatus>
  active: MuscleId | null
  onHover: (m: MuscleId | null) => void
  pains: BodyPain[]
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [data, setData] = useState<ViewData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setData(null)
    setFailed(false)
    loadMuscleView(sex, view)
      .then((d) => alive && setData(d))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [sex, view])

  useEffect(() => {
    if (data && ref.current) paint(ref.current, data, status, active)
  }, [data, status, active])

  const pos = useMemo(() => (data ? centers(data) : {}), [data])
  const markers = useMemo(() => {
    const by = new Map<MuscleId, string[]>()
    for (const p of pains) if (pos[p.muscle]) by.set(p.muscle, [...(by.get(p.muscle) ?? []), p.text])
    return [...by.entries()]
  }, [pains, pos])

  const muscleAt = (e: React.PointerEvent<HTMLCanvasElement>): MuscleId | null => {
    if (!data) return null
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - r.left) / r.width) * data.w)
    const y = Math.floor(((e.clientY - r.top) / r.height) * data.h)
    if (x < 0 || y < 0 || x >= data.w || y >= data.h) return null
    return MUSCLE_BY_INDEX[data.zone[y * data.w + x]!] ?? null
  }

  return (
    <figure className="flex flex-col items-center">
      {/* La imagen es 2:3 y el cuerpo ocupa el centro: se recorta el aire de los costados. */}
      <div className="relative w-[150px] overflow-hidden sm:w-[190px]" style={{ aspectRatio: String((2 / 3) * (1 - 2 * SIDE_CROP)) }}>
        <div className="absolute inset-y-0" style={{ left: `${(-SIDE_CROP / (1 - 2 * SIDE_CROP)) * 100}%`, width: `${100 / (1 - 2 * SIDE_CROP)}%` }}>
          <canvas
            ref={ref}
            aria-label={view === 'frente' ? 'Músculos de frente' : 'Músculos de espalda'}
            className="absolute inset-0 h-full w-full"
            onPointerMove={(e) => onHover(muscleAt(e))}
            onPointerLeave={() => onHover(null)}
            onPointerDown={(e) => onHover(muscleAt(e))}
          />
          {markers.map(([m, texts]) => (
            <span
              key={m}
              title={`Molestia · ${LABEL[m]}\n${texts.join('\n')}`}
              className="absolute z-[1] flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-status-expired text-white shadow-sm ring-2 ring-white dark:ring-surface-card"
              style={{ left: `${pos[m]!.x}%`, top: `${pos[m]!.y}%` }}
            >
              <AlertTriangle className="h-3 w-3" strokeWidth={2.5} aria-label={`Molestia en ${LABEL[m]}`} />
            </span>
          ))}
        </div>
        {!data && !failed ? <span className="absolute inset-0 grid place-items-center text-xs text-ink-muted">Cargando…</span> : null}
        {failed ? <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-ink-muted">No se pudo cargar la imagen.</span> : null}
      </div>
      <figcaption className="mt-1 text-[12px] text-ink-muted">{view === 'frente' ? 'Frente' : 'Espalda'}</figcaption>
    </figure>
  )
}

const fmt = (n: number) => (n ? String(round1(n)).replace('.', ',') : '–')

/**
 * v2 · Volumen semanal en el cuerpo: cada músculo pintado según si sus series de la semana quedan en
 * rango, por debajo o por encima. Las molestias del check-in de esa semana aparecen como alerta roja
 * sobre el músculo que nombró el alumno. Al lado, las series de cada músculo.
 */
export function VolumeBodyMap({
  sex,
  weighted,
  status,
  targetOf,
  pains,
}: {
  sex: BodySex
  weighted: Record<MuscleId, number>
  status: Record<MuscleId, VolumeStatus>
  targetOf: (m: MuscleId) => { min: number; max: number }
  pains: BodyPain[]
}) {
  const [active, setActive] = useState<MuscleId | null>(null)
  const painSet = new Set(pains.map((p) => p.muscle))

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-center md:gap-8">
      <div className="flex justify-center gap-2">
        <Figure sex={sex} view="frente" status={status} active={active} onHover={setActive} pains={pains} />
        <Figure sex={sex} view="espalda" status={status} active={active} onHover={setActive} pains={pains} />
      </div>
      <ul className="min-w-0 md:w-80 md:flex-none" onPointerLeave={() => setActive(null)}>
        {VOLUME_MUSCLES.map((m) => {
          const t = targetOf(m.id)
          return (
            <li
              key={m.id}
              onPointerEnter={() => setActive(m.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-[5px] text-[13px] transition-colors',
                active === m.id ? 'bg-surface-elevated' : '',
              )}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: BODY_STATUS_DOT[status[m.id]] }} />
              <span className="min-w-0 flex-1 truncate text-ink-primary">{m.label}</span>
              {painSet.has(m.id) ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-expired" aria-label="Molestia esta semana" /> : null}
              <span className="shrink-0 tabular-nums text-ink-primary">{fmt(weighted[m.id])}</span>
              <span className="w-12 shrink-0 text-right text-[11.5px] tabular-nums text-ink-muted">
                {t.min}–{t.max}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
