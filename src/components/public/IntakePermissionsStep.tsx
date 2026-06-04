import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, ShieldCheck, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  buildTrainerContactWhatsAppUrl,
  TRAINER_CONTACT_EMAIL,
  TRAINER_CONTACT_WHATSAPP_DISPLAY,
  whatsAppInterestMessage,
} from '@/lib/trainerContact'
import {
  checkWebIntakeAccessStatus,
  readIntakeAccessSession,
  requestWebIntakeAccess,
} from '@/lib/intake/webIntakeAccess'
import { cn } from '@/lib/utils'

type Props = {
  planSlug: string
  planName: string
  onApproved: () => void
  onBack: () => void
}

export function IntakePermissionsStep({ planSlug, planName, onApproved, onBack }: Props) {
  const [checking, setChecking] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [hasToken, setHasToken] = useState(false)

  const waUrl = buildTrainerContactWhatsAppUrl(whatsAppInterestMessage(planName))

  const refreshTokenState = useCallback(() => {
    const session = readIntakeAccessSession()
    setHasToken(Boolean(session?.token && session.planSlug === planSlug))
  }, [planSlug])

  useEffect(() => {
    refreshTokenState()
  }, [refreshTokenState])

  async function handleRequestAccess() {
    setRequesting(true)
    const result = await requestWebIntakeAccess({
      planSlug,
      planTitle: planName,
    })
    setRequesting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    refreshTokenState()
    toast.success(
      'Solicitud enviada. Tomás recibirá el aviso en la app; cuando confirme el pago te habilitará el paso Datos.',
      { duration: 8000 },
    )
  }

  async function handleCheckAccess() {
    const session = readIntakeAccessSession()
    if (!session?.token || session.planSlug !== planSlug) {
      toast.error('Primero tocá «Pedir acceso al paso 3» después de hablar por WhatsApp.')
      return
    }
    setChecking(true)
    const result = await checkWebIntakeAccessStatus(session.token)
    setChecking(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.status === 'approved') {
      toast.success('¡Acceso habilitado! Podés completar el formulario.')
      onApproved()
      return
    }
    if (result.status === 'denied') {
      toast.error('El acceso no fue aprobado. Escribinos por WhatsApp.')
      return
    }
    toast('Todavía pendiente de aprobación. Coordiná el pago con Tomás por WhatsApp.', { icon: '⏳' })
  }

  return (
    <div className="v2f-slide space-y-6">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-primary">Paso 2</p>
          <h2 className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-2xl">
            Permisos
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Plan elegido: <strong className="text-zinc-900 dark:text-white">{planName}</strong>
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
        >
          Cambiar plan
        </button>
      </header>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-medium text-zinc-900 dark:text-white">Antes de completar el formulario</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed">
          <li>Contactate por WhatsApp para coordinar el pago del plan.</li>
          <li>Cuando el pago esté confirmado, Tomás te habilita el paso «Datos».</li>
          <li>Tocá «Pedir acceso al paso 3» para que llegue la notificación; luego «Ya tengo acceso».</li>
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-600/35 bg-emerald-500/[0.08] px-4 py-6 text-center transition-colors hover:bg-emerald-500/15',
          )}
        >
          <WhatsAppIcon className="h-8 w-8" />
          <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Escribir por WhatsApp</span>
          <span className="text-xs text-emerald-800/80 dark:text-emerald-300/80">{TRAINER_CONTACT_WHATSAPP_DISPLAY}</span>
        </a>
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <Mail className="h-7 w-7 text-zinc-500" aria-hidden />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Correo</span>
          <a
            href={`mailto:${TRAINER_CONTACT_EMAIL}`}
            className="text-xs text-brand-primary hover:underline"
          >
            {TRAINER_CONTACT_EMAIL}
          </a>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            El mensaje de WhatsApp ya incluye el nombre del plan. Después del pago, pedí acceso para que Tomás reciba
            el aviso en la app y te habilite el formulario.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          loading={requesting}
          onClick={() => void handleRequestAccess()}
        >
          <MessageCircle className="h-4 w-4" />
          Pedir acceso al paso 3
        </Button>
        {hasToken ? (
          <p className="text-center text-[11px] text-zinc-500">Solicitud registrada para este plan.</p>
        ) : null}
        <Button
          type="button"
          className="w-full"
          loading={checking}
          onClick={() => void handleCheckAccess()}
        >
          Ya tengo acceso — continuar a Datos
        </Button>
      </div>
    </div>
  )
}
