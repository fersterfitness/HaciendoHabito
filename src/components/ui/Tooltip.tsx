import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type Side = 'top' | 'bottom' | 'left' | 'right'
type Align = 'start' | 'center' | 'end'

export function Tooltip({
  content,
  children,
  className,
  contentClassName,
  side = 'top',
  align = 'center',
  delayMs = 180,
  disabled = false,
}: {
  content: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  side?: Side
  align?: Align
  delayMs?: number
  disabled?: boolean
}) {
  const id = useId()
  const tooltipId = useMemo(() => `tt-${id.replace(/:/g, '')}`, [id])
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 })
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function computePosition() {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 8

    // Base position near trigger
    let top = 0
    let left = 0

    if (side === 'top') top = r.top - gap
    if (side === 'bottom') top = r.bottom + gap
    if (side === 'left') left = r.left - gap
    if (side === 'right') left = r.right + gap

    // Align along the cross-axis using trigger rect as anchor.
    // Actual tooltip size is unknown at this moment; we anchor at trigger edge/center.
    if (side === 'top' || side === 'bottom') {
      if (align === 'start') left = r.left
      if (align === 'center') left = r.left + r.width / 2
      if (align === 'end') left = r.right
    } else {
      if (align === 'start') top = r.top
      if (align === 'center') top = r.top + r.height / 2
      if (align === 'end') top = r.bottom
    }

    setCoords({ top, left })
  }

  function openSoon() {
    if (disabled) return
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      computePosition()
      setOpen(true)
    }, delayMs)
  }

  function closeNow() {
    clearTimer()
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onScrollOrResize() {
      computePosition()
    }
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, side, align])

  return (
    <>
      <span
        ref={wrapRef}
        className={cn('inline-flex', className)}
        onMouseEnter={openSoon}
        onMouseLeave={closeNow}
        onFocus={openSoon}
        onBlur={closeNow}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>

      {mounted && open && !disabled
        ? createPortal(
            <div
              id={tooltipId}
              role="tooltip"
              className={cn(
                'fixed z-[10060] pointer-events-none',
                'rounded-md border border-surface-border/80 bg-surface-card px-2 py-1',
                'text-[11px] font-medium text-ink-primary shadow-lg',
                'max-w-[min(22rem,calc(100vw-2rem))] whitespace-nowrap',
                contentClassName,
              )}
              style={{
                top: coords.top,
                left: coords.left,
                transform:
                  side === 'top'
                    ? align === 'start'
                      ? 'translate(0,-100%)'
                      : align === 'center'
                        ? 'translate(-50%,-100%)'
                        : 'translate(-100%,-100%)'
                    : side === 'bottom'
                      ? align === 'start'
                        ? 'translate(0,0)'
                        : align === 'center'
                          ? 'translate(-50%,0)'
                          : 'translate(-100%,0)'
                      : side === 'left'
                        ? align === 'start'
                          ? 'translate(-100%,0)'
                          : align === 'center'
                            ? 'translate(-100%,-50%)'
                            : 'translate(-100%,-100%)'
                        : align === 'start'
                          ? 'translate(0,0)'
                          : align === 'center'
                            ? 'translate(0,-50%)'
                            : 'translate(0,-100%)',
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

