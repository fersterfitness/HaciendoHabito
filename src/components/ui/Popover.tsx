import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

export function Popover({
  open,
  onOpenChange,
  trigger,
  children,
  side = 'bottom',
  align = 'start',
  offset = 6,
  className,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
  trigger: (props: {
    ref: (el: HTMLElement | null) => void
    onClick: (e: React.MouseEvent) => void
    'aria-haspopup': 'dialog'
    'aria-expanded': boolean
    'aria-controls': string | undefined
  }) => ReactNode
  children: ReactNode
  side?: Side
  align?: Align
  offset?: number
  className?: string
}) {
  const id = useId()
  const popoverId = useMemo(() => `popover-${id.replace(/:/g, '')}`, [id])
  const triggerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })
  const [transform, setTransform] = useState<string>('translate(0,0)')

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  function computePosition() {
    const el = triggerRef.current
    const content = contentRef.current
    if (!el || !content) return
    const r = el.getBoundingClientRect()
    const c = content.getBoundingClientRect()

    let top = 0
    let left = 0

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
    const vw = window.innerWidth
    const vh = window.innerHeight
    const margin = 8

    if (side === 'bottom') top = r.bottom + offset
    if (side === 'top') top = r.top - offset - c.height
    if (side === 'right') left = r.right + offset
    if (side === 'left') left = r.left - offset - c.width

    if (side === 'bottom' || side === 'top') {
      if (align === 'start') left = r.left
      if (align === 'center') left = r.left + r.width / 2 - c.width / 2
      if (align === 'end') left = r.right - c.width
    } else {
      if (align === 'start') top = r.top
      if (align === 'center') top = r.top + r.height / 2 - c.height / 2
      if (align === 'end') top = r.bottom - c.height
    }

    top = clamp(top, margin, vh - c.height - margin)
    left = clamp(left, margin, vw - c.width - margin)

    setPos({ top, left })
    setTransform('translate(0,0)')
  }

  useEffect(() => {
    if (!open) return
    const raf = window.requestAnimationFrame(() => {
      computePosition()
    })
    return () => window.cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, align, offset])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node
      if (triggerRef.current && triggerRef.current.contains(t)) return
      if (contentRef.current && contentRef.current.contains(t)) return
      onOpenChange(false)
    }
    function onScrollOrResize() {
      computePosition()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    transform,
  }

  return (
    <>
      {trigger({
        ref: (el) => {
          triggerRef.current = el
        },
        onClick: (e) => {
          e.stopPropagation()
          onOpenChange(!open)
        },
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? popoverId : undefined,
      })}

      {mounted && open
        ? createPortal(
            <div
              id={popoverId}
              ref={contentRef}
              style={panelStyle}
              className={cn(
                'z-[10040] overflow-hidden rounded-xl border border-surface-border bg-surface-card shadow-lg',
                className,
              )}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="false"
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

