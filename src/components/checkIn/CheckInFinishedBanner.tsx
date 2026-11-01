import { AlertTriangle, Flag, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

export function CheckInLastWeekBanner({ onAskMonthly }: { onAskMonthly?: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-elevated text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-xs font-semibold text-ink-primary">
              Última semana
            </p>
            <p className="mt-0.5 text-2xs font-medium text-rose-600 dark:text-rose-400">Renovar rutina</p>
            <p className="mt-1 text-2xs leading-relaxed text-ink-secondary">
              El alumno marcó que está en su última semana. Armá el siguiente mesociclo y pedile el feedback mensual.
            </p>
          </div>
          {onAskMonthly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-2xs"
              icon={<WhatsAppIcon className="h-3.5 w-3.5" />}
              onClick={onAskMonthly}
            >
              Enviar feedback mensual
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CheckInFinishedBanner({
  description,
  onAskProgress,
  onAskMonthly,
}: {
  description: string
  onAskProgress: () => void
  onAskMonthly: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-elevated text-amber-600 dark:text-amber-400">
          <Flag className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-xs font-semibold text-ink-primary">Mes de rutina cerrado</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-secondary">{description}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-2xs [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400"
              icon={<WhatsAppIcon className="h-3.5 w-3.5" />}
              onClick={onAskProgress}
            >
              Pedir progreso
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-2xs"
              icon={<MessageCircle className="h-3.5 w-3.5" />}
              onClick={onAskMonthly}
            >
              Feedback mensual
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
