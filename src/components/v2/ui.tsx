import { type ReactNode, useEffect, useRef, useState } from 'react'
import { onTabListKeyDown } from '@/lib/tabKeyboard'
import { Button } from '@/components/ui/Button'
import type { LucideIcon } from 'lucide-react'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { v2TabClass, v2TabCountClass } from './tabStyle'

/**
 * Piezas de la v2. Pocas y con una sola forma de usarse: así las pantallas nuevas salen parejas
 * sin estilos a mano. Casi todo es neutro: el color queda para la acción principal, lo seleccionado y
 * los estados (`Tone` en etiquetas de estado). Los avances van en el color de marca.
 */

export type Tone = 'lavender' | 'peach' | 'butter' | 'mint' | 'sky' | 'rose'

const TONE_BG: Record<Tone, string> = {
  lavender: 'bg-pastel-lavender',
  peach: 'bg-pastel-peach',
  butter: 'bg-pastel-butter',
  mint: 'bg-pastel-mint',
  sky: 'bg-pastel-sky',
  rose: 'bg-pastel-rose',
}

const TONE_INK: Record<Tone, string> = {
  lavender: 'text-pastel-lavender-ink',
  peach: 'text-pastel-peach-ink',
  butter: 'text-pastel-butter-ink',
  mint: 'text-pastel-mint-ink',
  sky: 'text-pastel-sky-ink',
  rose: 'text-pastel-rose-ink',
}

const TONE_ACCENT: Record<Tone, string> = {
  lavender: 'text-pastel-lavender-accent',
  peach: 'text-pastel-peach-accent',
  butter: 'text-pastel-butter-accent',
  mint: 'text-pastel-mint-accent',
  sky: 'text-pastel-sky-accent',
  rose: 'text-pastel-rose-accent',
}


/** Contenedor de página: ancho máximo y márgenes iguales en todas las pantallas nuevas. */
export function PageV2({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('v2-own mx-auto w-full max-w-[74rem] px-4 pb-14 pt-6 lg:px-10 lg:pt-9', className)}>{children}</div>
}

/** Saludo o título de la página, sin nada colgando al costado. */
export function GreetingV2({ title, eyebrow, children }: { title: ReactNode; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 lg:mb-7">
      {eyebrow ? <p className="mb-1 text-[12px] font-medium text-ink-muted">{eyebrow}</p> : null}
      <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink-primary lg:text-[26px]">{title}</h1>
      {children ? <p className="mt-1 text-[13px] text-ink-muted">{children}</p> : null}
    </div>
  )
}

/** Celu: los números del mes en una sola franja (tres columnas parejas, sin carrusel cortado). */
export function StatStripV2({
  items,
}: {
  items: { label: string; value: string; suffix?: string; tone: Tone; progress?: number; onClick: () => void }[]
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-card">
      {items.map((it) => (
        <button key={it.label} type="button" onClick={it.onClick} className="min-w-0 px-3 pb-3 pt-2.5 text-left active:bg-surface-panel">
          <p className="truncate text-[11.5px] text-ink-muted">{it.label}</p>
          <p className="mt-1 truncate text-[19px] font-semibold leading-tight tabular-nums tracking-[-0.03em] text-ink-primary">
            {it.value}
            {it.suffix ? <span className="ml-0.5 text-[12px] font-medium tracking-normal text-ink-muted">{it.suffix}</span> : null}
          </p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-elevated">
            {it.progress !== undefined ? (
              <div
                className="h-full rounded-full bg-brand-primary transition-[width] duration-700"
                style={{ width: `${Math.max(0, Math.min(1, it.progress)) * 100}%` }}
              />
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}

export function SectionTitleV2({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[14px] font-medium tracking-[-0.01em] text-ink-primary">{children}</h2>
      {action}
    </div>
  )
}

/** Ícono sobre un cuadrado gris. `tone` queda por compatibilidad: el tipo de cosa no lleva color. */
export function ToneIcon({ icon: Icon, tone: _tone, size = 'md' }: { icon: LucideIcon; tone: Tone; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary',
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
      )}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} />
    </span>
  )
}

/** Barra en dos tramos: lo hecho en el color de marca y lo que falta en gris. */
export function ProgressV2({ value, tone: _tone }: { value: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="flex h-1.5 gap-1" aria-hidden>
      {pct > 0 ? <span className="rounded-full bg-brand-primary" style={{ width: `${pct}%` }} /> : null}
      {pct < 100 ? <span className="flex-1 rounded-full bg-surface-elevated" /> : null}
    </div>
  )
}

/** Tarjeta de un número del mes: título con ícono pastel, link a la pantalla y barra de avance. */
export function MetricCardV2({
  icon,
  tone,
  title,
  link,
  label,
  value,
  progress,
}: {
  icon: LucideIcon
  tone: Tone
  title: string
  link?: { label: string; onClick: () => void }
  label: ReactNode
  value: ReactNode
  progress?: number
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="mb-5 flex items-center gap-2.5">
        <ToneIcon icon={icon} tone={tone} size="sm" />
        <p className="text-[13px] font-medium text-ink-primary">{title}</p>
        {link ? (
          <button type="button" onClick={link.onClick} className="ml-auto text-[12px] text-ink-muted transition-colors hover:text-ink-primary">
            {link.label}
          </button>
        ) : null}
      </div>
      <div className="mt-auto flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-[13px] text-ink-secondary">{label}</p>
        <p className="shrink-0 text-[14px] font-semibold tabular-nums tracking-[-0.01em] text-ink-primary">{value}</p>
      </div>
      {progress !== undefined ? (
        <div className="mt-3">
          <ProgressV2 value={progress} tone={tone} />
        </div>
      ) : null}
    </div>
  )
}

/** Número que sube desde 0 la primera vez que llega (rápido; nada si se pidió menos movimiento). */
function useCountUp(target: number | null, ms = 700): number | null {
  const [v, setV] = useState<number | null>(target)
  const done = useRef(false)
  useEffect(() => {
    if (target === null) return
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (done.current || reduce || target === 0) {
      done.current = true
      setV(target)
      return
    }
    done.current = true
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(target * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return target === null ? null : v
}

/** Anillo de avance (se llena al aparecer). */
function RingV2({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  const r = 21
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center text-brand-primary" aria-hidden>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" className="stroke-surface-elevated" />
        <circle
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          className="v2-ring"
        />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums text-ink-primary">{Math.round(pct * 100)}%</span>
    </span>
  )
}

/** Número del mes a primera vista: grande, con su contexto abajo y el anillo de avance. Toda la tarjeta lleva a la pantalla. */
export function PulseCardV2({
  icon,
  tone,
  title,
  value,
  format = (n) => String(Math.round(n)),
  suffix,
  caption,
  progress,
  onClick,
}: {
  icon: LucideIcon
  tone: Tone
  title: string
  /** null mientras carga. */
  value: number | null
  format?: (n: number) => string
  suffix?: string
  caption: ReactNode
  progress?: number
  onClick: () => void
}) {
  const n = useCountUp(value)
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border border-surface-border bg-surface-card p-4 text-left transition-shadow hover:shadow-[0_6px_20px_-12px_rgb(0_0_0/0.25)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ToneIcon icon={icon} tone={tone} size="sm" />
          <p className="truncate text-[12.5px] font-medium text-ink-secondary">{title}</p>
          <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        </div>
        <p className="mt-3 truncate text-[26px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink-primary">
          {n === null ? '—' : format(n)}
          {suffix && n !== null ? <span className="ml-1 text-[15px] font-medium tracking-normal text-ink-muted">{suffix}</span> : null}
        </p>
        <p className="mt-1.5 truncate text-[12px] text-ink-muted">{caption}</p>
      </div>
      {progress !== undefined && value !== null ? <RingV2 value={progress} /> : null}
    </button>
  )
}

/** Bloque pastel sólido con un número: sirve de filtro de la lista de abajo. */
export function ToneTileV2({
  icon: Icon,
  tone,
  count,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  tone: Tone
  count: number
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'hh-pastel group flex items-center gap-3 rounded-2xl p-3.5 text-left transition-[box-shadow,transform] active:scale-[0.99]',
        TONE_BG[tone],
        active ? 'shadow-[0_0_0_1.5px_rgb(var(--ink-primary))]' : 'hover:shadow-[0_0_0_1px_rgb(var(--ink-primary)/0.12)]',
      )}
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-base', TONE_ACCENT[tone])} aria-hidden>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-none tabular-nums text-ink-primary">{count}</span>
        <span className="mt-1 block truncate text-[12px] text-ink-secondary">{label}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  )
}

/** Etiqueta: gris para el tipo de cosa (`neutral`), color sólo para un estado (vencido, por terminar). */
export function TagV2({ tone, children }: { tone: Tone | 'neutral'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium',
        tone === 'neutral' ? 'bg-surface-elevated text-ink-secondary' : cn('hh-pastel', TONE_BG[tone], TONE_INK[tone]),
      )}
    >
      {children}
    </span>
  )
}

/** Dato chico con borde (fecha, monto, cantidad). */
export function MetaChipV2({ icon: Icon, children }: { icon?: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-surface-border px-2 text-[12px] tabular-nums text-ink-secondary">
      {Icon ? <Icon className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </span>
  )
}

/**
 * Una cosa por hacer, en una fila: casilla, título, etiquetas y detalle en una línea, y las acciones
 * a la derecha (en el celular, debajo). Va dentro de una lista con divisores (`TASK_LIST_V2`).
 */
export function TaskCardV2({
  title,
  description,
  tags,
  meta,
  actions,
  onOpen,
  mark,
  onCheck,
  urgent,
}: {
  title: ReactNode
  description?: ReactNode
  tags?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  onOpen?: () => void
  /** Algo a la derecha del título (avatar, aviso). */
  mark?: ReactNode
  /** Misiones: la casilla de la izquierda tilda la tarea. */
  onCheck?: () => void
  /** Alerta (franja roja a la izquierda). */
  urgent?: boolean
}) {
  return (
    <article
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 bg-surface-card px-3 py-2.5 transition-colors sm:flex-nowrap sm:px-4',
        onOpen && 'hover:bg-surface-panel',
        urgent && 'shadow-[inset_3px_0_0_rgb(var(--status-expired))]',
      )}
    >
      {onCheck ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCheck()
          }}
          title="Marcar como hecha"
          aria-label="Marcar como hecha"
          className="group/check -m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] border-ink-muted/50 transition-colors group-hover/check:border-status-progress group-hover/check:bg-status-progress/10">
            <Check className="h-3.5 w-3.5 text-status-progress opacity-0 transition-opacity group-hover/check:opacity-100" strokeWidth={2.5} />
          </span>
        </button>
      ) : (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-surface-elevated" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-ink-muted/70" />
        </span>
      )}
      <div
        className={cn('min-w-0 flex-1 basis-[calc(100%-3rem)] sm:basis-auto', onOpen && 'hh-focus cursor-pointer rounded-md')}
        onClick={onOpen}
        title={typeof description === 'string' ? description : undefined}
        {...(onOpen
          ? {
              role: 'button',
              tabIndex: 0,
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
                e.preventDefault()
                onOpen()
              },
            }
          : {})}
      >
        <h3 className="truncate text-sm font-medium leading-snug tracking-[-0.01em] text-ink-primary">{title}</h3>
        {tags || description ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs leading-snug text-ink-secondary">
            {tags ? <span className="flex shrink-0 items-center gap-1 [&>span]:h-5 [&>span]:px-1.5 [&>span]:text-3xs">{tags}</span> : null}
            {description ? <span className="min-w-0 truncate">{description}</span> : null}
          </div>
        ) : null}
      </div>
      {mark ? <span className="hidden shrink-0 sm:block">{mark}</span> : null}
      {meta ? <div className="hidden shrink-0 items-center gap-1.5 lg:flex">{meta}</div> : null}
      {actions ? <div className="ml-8 flex shrink-0 items-center justify-end gap-1.5 max-sm:ml-auto max-sm:w-[calc(100%-2rem)] sm:ml-0">{actions}</div> : null}
    </article>
  )
}

/** Contenedor de las filas de tareas: una sola tarjeta con divisores. */
export const TASK_LIST_V2 =
  'overflow-hidden rounded-2xl border border-surface-border bg-surface-card [&>*+*]:border-t [&>*+*]:border-surface-border'

/** Botón de tarjeta: pastilla gris (o negra si es la acción del momento). */
export function PillButtonV2({
  icon: Icon,
  children,
  onClick,
  title,
  primary,
  iconClassName,
}: {
  icon?: LucideIcon | ((p: { className?: string }) => ReactNode)
  children?: ReactNode
  onClick: () => void
  title?: string
  primary?: boolean
  iconClassName?: string
}) {
  return (
    <Button
      type="button"
      variant="soft"
      size="sm"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={children ? undefined : title}
      className={cn(
        'rounded-full text-xs font-medium active:scale-100',
        primary ? 'bg-ink-primary text-surface-base hover:bg-ink-primary/85' : 'hover:bg-surface-border',
        !children && 'w-8 px-0',
      )}
    >
      {Icon ? <Icon className={cn('h-3.5 w-3.5', iconClassName)} /> : null}
      {children}
    </Button>
  )
}

/** Filtros en pastilla: el elegido en negro con tilde. */
export function SegmentedV2<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" onKeyDown={onTabListKeyDown}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={v2TabClass(on, size)}
          >
            {o.label}
            {o.count !== undefined ? <span className={v2TabCountClass(on)}>{o.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/** Caja blanca con título, para columnas laterales. */
export function CardV2({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-surface-border bg-surface-card', className)}>
      {title ? (
        <header className="flex items-center gap-2 px-5 pb-1 pt-4">
          <h2 className="text-[13px] font-medium text-ink-primary">{title}</h2>
          <div className="ml-auto">{action}</div>
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function EmptyV2({ children }: { children: ReactNode }) {
  return <p className="px-5 py-8 text-center text-[13px] text-ink-muted">{children}</p>
}


/** Iniciales sobre gris: el mismo tono para todos, como los avatares sin foto del resto de la v2. */
export function AvatarV2({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-surface-elevated font-semibold text-ink-secondary ring-2 ring-surface-card dark:ring-0',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]',
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}
