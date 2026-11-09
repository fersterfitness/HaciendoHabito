import { useState, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

export type ActionMenuItem =
  | {
      label: string
      icon?: ReactNode
      onClick: () => void
      hint?: string
      danger?: boolean
      disabled?: boolean
    }
  | 'divider'
  | { heading: string }

/**
 * v2 · Menú «…» de una fila (semana, día, ejercicio): junta las acciones secundarias en un solo
 * botón de 32 px (40 en pantallas táctiles) en lugar de una tira de íconos chicos.
 */
export function ActionMenuV2({
  label,
  items,
  className,
}: {
  /** Nombre del botón para lectores de pantalla, p. ej. «Acciones de la semana 2». */
  label: string
  items: ActionMenuItem[]
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <span onClick={(e) => e.stopPropagation()} className="contents">
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="end"
        className="w-56"
        trigger={({ ref, onClick, ...a11y }) => (
          <Button
            ref={ref}
            type="button"
            variant="ghost"
            size="iconSm"
            onClick={onClick}
            title={label}
            aria-label={label}
            className={cn('hh-hit text-ink-muted', className)}
            {...a11y}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      >
        <div className="py-1" role="menu">
          {items.map((item, i) => {
            if (item === 'divider') return <div key={`d${i}`} className="my-1 h-px bg-surface-border/70" aria-hidden />
            if ('heading' in item)
              return (
                <p key={`h${i}`} className="px-3 pb-1 pt-2 text-3xs font-semibold text-ink-muted">
                  {item.heading}
                </p>
              )
            return (
              <Button
                key={`${item.label}${i}`}
                type="button"
                variant="ghost"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={cn(
                  'h-auto min-h-9 w-full justify-start whitespace-normal gap-2.5 rounded-none px-3 py-2 text-left text-xs font-normal active:scale-100 items-start [&_svg]:mt-px [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0',
                  item.danger ? 'text-status-expired hover:bg-status-expired/10' : 'text-ink-primary hover:bg-surface-elevated',
                )}
              >
                {item.icon ? <span className={item.danger ? undefined : 'text-ink-muted'}>{item.icon}</span> : null}
                <span className="min-w-0">
                  <span className="block font-medium">{item.label}</span>
                  {item.hint ? <span className="block text-3xs text-ink-muted">{item.hint}</span> : null}
                </span>
              </Button>
            )
          })}
        </div>
      </Popover>
    </span>
  )
}
