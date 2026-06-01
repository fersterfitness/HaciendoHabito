import type { ReactNode } from 'react'
import { Apple, Brain, Dumbbell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WebPlanCatalogSegment } from '@/types/database'

type ModalityId = WebPlanCatalogSegment | 'psychologist'

const ICON = {
  training: { Icon: Dumbbell, className: 'text-orange-500 dark:text-orange-400' },
  nutrition: { Icon: Apple, className: 'text-emerald-500 dark:text-emerald-400' },
  psychology: { Icon: Brain, className: 'text-violet-500 dark:text-violet-400' },
} as const

type ProKind = keyof typeof ICON

const ICON_SIZE = 'h-3.5 w-3.5'

function ProIcon({ kind }: { kind: ProKind }) {
  const { Icon, className } = ICON[kind]
  return <Icon className={cn('shrink-0', ICON_SIZE, className)} strokeWidth={2.25} aria-hidden />
}

function Plus() {
  return (
    <span className="select-none px-px text-[9px] font-bold leading-none text-zinc-400 dark:text-zinc-500" aria-hidden>
      +
    </span>
  )
}

/** Fila única de altura fija para alinear todas las cards de modalidad. */
function IconRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'pointer-events-none inline-flex h-6 min-w-0 max-w-full flex-nowrap items-center gap-0.5',
        className,
      )}
      aria-hidden
    >
      {children}
    </div>
  )
}

function IconPair({ left, right }: { left: ProKind; right: ProKind }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <ProIcon kind={left} />
      <Plus />
      <ProIcon kind={right} />
    </span>
  )
}

function PairSeparator() {
  return (
    <span
      className="mx-0.5 h-3 w-px shrink-0 bg-zinc-300 dark:bg-zinc-600"
      aria-hidden
    />
  )
}

/** Iconos de profesionales por modalidad (parte superior de la card en /form). */
export function IntakeModalityProfessionIcons({
  modalityId,
  className,
}: {
  modalityId: ModalityId
  className?: string
}) {
  switch (modalityId) {
    case 'full_trio':
      return (
        <IconRow className={className}>
          <ProIcon kind="training" />
          <Plus />
          <ProIcon kind="nutrition" />
          <Plus />
          <ProIcon kind="psychology" />
        </IconRow>
      )
    case 'full':
      return (
        <IconRow className={className}>
          <IconPair left="training" right="nutrition" />
          <PairSeparator />
          <IconPair left="training" right="psychology" />
        </IconRow>
      )
    case 'solo':
      return (
        <IconRow className={className}>
          <ProIcon kind="training" />
        </IconRow>
      )
    case 'with_nutritionist':
      return (
        <IconRow className={className}>
          <ProIcon kind="nutrition" />
        </IconRow>
      )
    case 'psychologist':
      return (
        <IconRow className={className}>
          <ProIcon kind="psychology" />
        </IconRow>
      )
    default:
      return null
  }
}
