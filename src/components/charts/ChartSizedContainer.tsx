import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Evita que Recharts monte con ancho/alto -1 cuando el contenedor aún no tiene layout. */
export function ChartSizedContainer({
  className,
  minHeight = 32,
  children,
}: {
  className?: string
  minHeight?: number
  children: (size: { width: number; height: number }) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width > 0 && height > 0) setSize({ width, height })
    }
    update()
    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} className={cn(className)} style={{ minHeight, minWidth: 0 }}>
      {size.width > 0 && size.height > 0 ? children(size) : null}
    </div>
  )
}
