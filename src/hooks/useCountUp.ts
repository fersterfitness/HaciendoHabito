import { useEffect, useState } from 'react'

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3

export type UseCountUpOptions = {
  /** Duración total en ms (por defecto 2000). */
  duration?: number
  /** Si es false, devuelve `end` sin animar. */
  enabled?: boolean
}

/**
 * Anima un entero desde 0 hasta `end` al montar o cuando cambian `end` / `enabled`.
 * Útil para métricas en dashboard (evitar usar con valores que cambian en tiempo real cada pocos segundos).
 */
export function useCountUp(end: number, options?: UseCountUpOptions): number {
  const duration = options?.duration ?? 2000
  const enabled = options?.enabled ?? true
  const [value, setValue] = useState(() => (enabled ? 0 : Math.round(end)))

  useEffect(() => {
    if (!enabled) {
      setValue(Math.round(end))
      return
    }

    let start: number | null = null
    let raf = 0
    const target = Math.round(end)

    setValue(0)

    const tick = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / duration)
      const eased = easeOutCubic(t)
      setValue(Math.round(target * eased))
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [end, duration, enabled])

  return value
}
