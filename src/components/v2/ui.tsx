import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Piezas de la v2. Pocas y con una sola forma de usarse: así las pantallas nuevas salen parejas
 * sin estilos a mano. El color lo ponen los pasteles (`Tone`); el resto es blanco, gris y negro.
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

const TONE_FILL: Record<Tone, string> = {
  lavender: 'bg-pastel-lavender-ink/70',
  peach: 'bg-pastel-peach-ink/70',
  butter: 'bg-pastel-butter-ink/60',
  mint: 'bg-pastel-mint-ink/65',
  sky: 'bg-pastel-sky-ink/65',
  rose: 'bg-pastel-rose-ink/65',
}

/** Contenedor de página: ancho máximo y márgenes iguales en todas las pantallas nuevas. */
export function PageV2({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('v2-own mx-auto w-full max-w-[74rem] px-4 pb-14 pt-6 lg:px-10 lg:pt-9', className)}>{children}</div>
}

/** Saludo o título de la página, sin nada colgando al costado. */
export function GreetingV2({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[22px] font-medium leading-tight tracking-[-0.025em] text-ink-primary lg:text-[24px]">{title}</h1>
      {children ? <p className="mt-1.5 text-[13px] text-ink-muted">{children}</p> : null}
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

/** Ícono sobre un cuadrado pastel (identifica el tipo de cosa, no decora). */
export function ToneIcon({ icon: Icon, tone, size = 'md' }: { icon: LucideIcon; tone: Tone; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'hh-pastel flex shrink-0 items-center justify-center rounded-lg',
        TONE_BG[tone],
        TONE_INK[tone],
        size === 'sm' ? 'h-6 w-6' : 'h-8 w-8',
      )}
      aria-hidden
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2} />
    </span>
  )
}

/** Barra en dos tramos: lo hecho en pastel y lo que falta en gris. */
export function ProgressV2({ value, tone }: { value: number; tone: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div className="flex h-1.5 gap-1" aria-hidden>
      {pct > 0 ? <span className={cn('rounded-full', TONE_FILL[tone])} style={{ width: `${pct}%` }} /> : null}
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
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-base', TONE_INK[tone])} aria-hidden>
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

/** Etiqueta pastel (tipo de tarea, estado). */
export function TagV2({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cn('hh-pastel inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium', TONE_BG[tone], TONE_INK[tone])}>{children}</span>
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
 * Tarjeta de una cosa por hacer: título, detalle, etiquetas y, separado por una línea punteada,
 * los datos y las acciones.
 */
export function TaskCardV2({
  title,
  description,
  tags,
  meta,
  actions,
  onOpen,
  mark,
}: {
  title: ReactNode
  description?: ReactNode
  tags?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  onOpen?: () => void
  /** Algo a la derecha del título (avatar, aviso). */
  mark?: ReactNode
}) {
  return (
    <article className="rounded-2xl border border-surface-border bg-surface-card transition-shadow hover:shadow-[0_2px_10px_rgb(0_0_0/0.04)]">
      <div className={cn('px-4 pb-3.5 pt-4', onOpen && 'cursor-pointer')} onClick={onOpen}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-elevated" aria-hidden>
            <span className="h-3 w-3 rounded-full border-[1.5px] border-ink-muted/70" />
          </span>
          <h3 className="min-w-0 flex-1 text-[14px] font-medium leading-snug tracking-[-0.01em] text-ink-primary">{title}</h3>
          {mark}
        </div>
        {description ? <p className="mt-2 pl-9 text-[13px] leading-relaxed text-ink-secondary">{description}</p> : null}
        {tags ? <div className="mt-3 flex flex-wrap gap-1.5 pl-9">{tags}</div> : null}
      </div>
      {meta || actions ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-surface-border px-4 py-3">
          {meta}
          {actions ? <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  )
}

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
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      aria-label={children ? undefined : title}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
        primary
          ? 'bg-ink-primary text-surface-base hover:bg-ink-primary/85'
          : 'bg-surface-elevated text-ink-primary hover:bg-surface-border',
        !children && 'w-8 justify-center px-0',
      )}
    >
      {Icon ? <Icon className={cn('h-3.5 w-3.5', iconClassName)} /> : null}
      {children}
    </button>
  )
}

/** Filtros en pastilla: el elegido en negro con tilde. */
export function SegmentedV2<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; count?: number }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
              on ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
            )}
          >
            {o.label}
            {o.count !== undefined ? <span className={cn('tabular-nums', on ? 'opacity-70' : 'text-ink-muted')}>{o.count}</span> : null}
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


const AVATAR_TONES: Tone[] = ['lavender', 'peach', 'mint', 'sky', 'butter', 'rose']

/** Iniciales sobre un pastel fijo por nombre (la misma persona siempre del mismo color). */
export function AvatarV2({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const tone = AVATAR_TONES[h % AVATAR_TONES.length]!
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span
      className={cn(
        'hh-pastel flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface-card',
        TONE_BG[tone],
        TONE_INK[tone],
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]',
      )}
      aria-hidden
    >
      {initials || '?'}
    </span>
  )
}
