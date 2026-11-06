import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import type { BodyZoneId, BodyZoneStatus } from '@/lib/nutrition/bodyZoneComparison'
import { cn } from '@/lib/utils'
import { loadView, paint, type ViewData } from './bodyCanvas'
import { BODY_ZONE_BY_INDEX, type BodySex, type BodyView } from './zones'

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
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-ink-muted dark:text-white/60">Cargando cuerpo…</span>
      ) : null}
      {failed ? (
        <span className="absolute inset-0 grid place-items-center px-6 text-center text-xs text-ink-muted dark:text-white/70">No se pudo cargar la imagen del cuerpo. Recargá la página.</span>
      ) : null}
      <button
        type="button"
        onClick={() => setView((v) => (v === 'frente' ? 'espalda' : 'frente'))}
        disabled={view === 'frente' && !data.espalda}
        className="absolute right-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-lg bg-white/80 px-2.5 text-2xs font-semibold text-ink-secondary shadow-sm backdrop-blur hover:text-ink-primary disabled:opacity-50 dark:bg-black/45 dark:text-white/85 dark:shadow-none dark:hover:text-white"
      >
        <RotateCw className="h-3.5 w-3.5" />
        {view === 'frente' ? 'Ver espalda' : 'Ver frente'}
      </button>
    </div>
  )
}
