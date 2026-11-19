import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { controlBaseClassName } from '@/lib/formControlClasses'
import type { UseFormRegister } from 'react-hook-form'
import { intakeFormFieldLabelClass } from '@/lib/intake/intakeFormUi'
import { preferredPayDayOf, withPreferredPayDay } from '@/lib/intake/payDay'

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
  const notes = register('payment_notes')
  const notesEl = useRef<HTMLTextAreaElement | null>(null)
  const [payDay, setPayDay] = useState('')
  // Al volver a este paso, el día elegido sigue en «Dato de pago».
  useEffect(() => {
    setPayDay(preferredPayDayOf(notesEl.current?.value))
  }, [])

  // El día elegido se escribe en el campo «Dato de pago» (que ya viaja con el formulario).
  function choosePayDay(day: string) {
    setPayDay(day)
    const el = notesEl.current
    if (!el) return
    const next = withPreferredPayDay(el.value, day).slice(0, 500)
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(el, next)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <div>
      <label className={intakeFormFieldLabelClass()}>
        Forma de pago preferida<span className="text-zinc-500 dark:text-zinc-400">*</span>
      </label>
      <p className="mb-2 text-2xs text-ink-muted">Para coordinar el alta con el equipo.</p>
      <div className="space-y-2">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink-secondary">
          <input
            type="radio"
            value="mercadopago"
            className=" shrink-0 dark:"
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
          <input type="radio" value="cash" className=" shrink-0 dark:" {...register('payment_preference')} />
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
      <label className="mt-3 block">
        <span className={intakeFormFieldLabelClass()}>
          ¿Qué día del mes vas a pagar?<span className="text-zinc-500 dark:text-zinc-400">*</span>
        </span>
        <p className="mb-1.5 text-2xs text-ink-muted">Queda como tu fecha de pago: ese día te llega el recordatorio.</p>
        <select
          value={payDay}
          onChange={(e) => choosePayDay(e.target.value)}
          className={cn(controlBaseClassName, 'mt-1 w-full cursor-pointer px-3 py-2 text-sm sm:w-56')}
        >
          <option value="" disabled>
            Elegí un día
          </option>
          {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
            <option key={d} value={d}>
              Día {d}
            </option>
          ))}
          <option value="ultimo">Último día del mes</option>
        </select>
      </label>
      <label className="mt-3 block">
        <span className={intakeFormFieldLabelClass()}>
          Dato de pago <span className="text-zinc-500 dark:text-zinc-400">(opcional)</span>
        </span>
        <p className="mb-1.5 text-2xs text-ink-muted">
          Mercado Pago: alias o comprobante. Efectivo: acuerdo o sucursal si querés dejar constancia.
        </p>
        <textarea
          rows={2}
          maxLength={500}
          className={cn(controlBaseClassName, 'mt-1 w-full px-3 py-2 text-sm')}
          placeholder="Ej. alias MP · nº de operación · observaciones"
          {...notes}
          ref={(el) => {
            notes.ref(el)
            notesEl.current = el
          }}
        />
      </label>
      {error ? <p className="mt-1 text-xs text-status-expired">{error}</p> : null}
    </div>
  )
}
