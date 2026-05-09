import type { UseFormRegister } from 'react-hook-form'
import { intakeFormFieldLabelClass } from '@/lib/intake/intakeFormUi'

type Props = {
  /** Cualquier formulario que incluya `payment_preference`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>
  error?: string
}

/**
 * Paso «Pago»: íconos `/public/mercadopago-mark.png`, `/public/pago-efectivo-mark.png` (RGBA).
 */
export function IntakePaymentPreferenceFields({ register, error }: Props) {
  return (
    <div>
      <label className={intakeFormFieldLabelClass()}>
        Forma de pago preferida<span className="text-zinc-500 dark:text-zinc-400">*</span>
      </label>
      <p className="mb-2 text-[11px] text-ink-muted">Para coordinar el alta con el equipo.</p>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
          <input
            type="radio"
            value="mercadopago"
            className="accent-zinc-600 shrink-0 dark:accent-zinc-500"
            {...register('payment_preference')}
          />
          <img
            src="/mercadopago-mark.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span>Mercado Pago</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
          <input type="radio" value="cash" className="accent-zinc-600 shrink-0 dark:accent-zinc-500" {...register('payment_preference')} />
          <img
            src="/pago-efectivo-mark.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 object-contain"
          />
          <span>Efectivo</span>
        </label>
      </div>
      {error ? <p className="mt-1 text-xs text-status-expired">{error}</p> : null}
    </div>
  )
}
