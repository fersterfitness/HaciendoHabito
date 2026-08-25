import { Flag, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

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
    <div className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/12 via-surface-card to-orange-500/8 p-3.5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <Flag className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-xs font-semibold text-ink-primary">Mes de rutina cerrado</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-secondary">{description}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full border-emerald-600/35 bg-emerald-500/8 text-[11px] text-emerald-800 dark:text-emerald-300"
              icon={<WhatsAppIcon className="h-3.5 w-3.5" />}
              onClick={onAskProgress}
            >
              Pedir progreso
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-[11px]"
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
