import { Link } from 'react-router-dom'
import { Copy, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { savePriceIncreaseSettings, usePriceIncreaseSettings } from '@/data/priceIncrease'
import { longDayMonth, priceIncreaseNoticeMessage, priceIncreaseStage } from '@/lib/finance/priceIncrease'

/**
 * Inicio: 15 días antes del aumento, el mensaje para copiar al grupo general;
 * llegada la fecha, el recordatorio de aplicarlo en Finanzas.
 */
export function PriceIncreaseNotice() {
  const { data } = usePriceIncreaseSettings()
  const settings = data?.saved ? data.settings : null
  if (!settings?.next_date) return null
  const { stage, daysLeft } = priceIncreaseStage(settings.next_date, new Date())
  if (!stage) return null
  if (stage === 'notice' && settings.notice_copied_for === settings.next_date) return null

  const pct = `${String(settings.percent).replace('.', ',')}%`

  async function copy() {
    if (!settings?.next_date) return
    try {
      await navigator.clipboard.writeText(priceIncreaseNoticeMessage(settings.next_date))
      toast.success('Mensaje copiado: pegalo en el grupo')
      await savePriceIncreaseSettings({ ...settings, notice_copied_for: settings.next_date })
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <div className={stage === 'due' ? 'hh-alert hh-alert-danger rounded-xl' : 'hh-alert hh-alert-warning rounded-xl'}>
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
        <span className="hh-alert-icon h-7 w-7 shrink-0" aria-hidden>
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-[11rem] flex-1">
          <span className="block text-xs font-semibold text-ink-primary">
            {stage === 'due' ? `Hoy arranca el aumento del ${pct}` : `Aumento del ${pct} el ${longDayMonth(settings.next_date)}`}
          </span>
          <span className="block text-2xs text-ink-muted">
            {stage === 'due'
              ? 'Aplicalo en Finanzas para actualizar cuotas y precios de la web.'
              : `Faltan ${daysLeft} días: avisale al grupo general con el mensaje armado.`}
          </span>
        </span>
        {stage === 'notice' ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1 rounded-md border border-surface-border bg-surface-card px-2 py-1 text-3xs font-medium text-ink-secondary shadow-xs hover:text-ink-primary"
          >
            <Copy className="h-3 w-3" /> Copiar aviso para el grupo
          </button>
        ) : (
          <Link
            to="/finances#aumentos"
            className="inline-flex items-center rounded-md border border-surface-border bg-surface-card px-2 py-1 text-3xs font-semibold text-brand-primary shadow-xs"
          >
            Ir a aplicar
          </Link>
        )}
      </div>
    </div>
  )
}
