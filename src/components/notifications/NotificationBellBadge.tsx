import { cn } from '@/lib/utils'
import { trainerCtaSolidBgClassName } from '@/lib/primaryGradientCtaClasses'

type Props = {
  count: number
  className?: string
}

/** Indicador sobre la campana: punto si hay sin leer; número si hay más de una. */
export function NotificationBellBadge({ count, className }: Props) {
  if (count <= 0) return null

  const label = count > 9 ? '9+' : String(count)
  const showNumber = count > 1

  return (
    <span
      className={cn('pointer-events-none absolute z-20 flex items-center justify-center', className)}
      aria-hidden
    >
      {showNumber ? (
        <span
          className={cn(
            'flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-surface-base',
            trainerCtaSolidBgClassName,
          )}
        >
          {label}
        </span>
      ) : (
        <span className="relative flex size-3 items-center justify-center">
          <span
            className={cn(
              'absolute inset-0 rounded-full opacity-40 animate-ping',
              trainerCtaSolidBgClassName,
            )}
          />
          <span
            className={cn(
              'relative size-2.5 rounded-full ring-2 ring-surface-base',
              trainerCtaSolidBgClassName,
            )}
          />
        </span>
      )}
    </span>
  )
}
