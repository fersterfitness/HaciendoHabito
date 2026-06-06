import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  buildTrainerContactWhatsAppUrl,
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
      'Pedido enviado. Tomás Ferster recibirá el aviso en la app. Cuando confirme tu pago te habilitará el paso Datos.',
      { duration: 9000 },
    )
  }

  async function handleCheckAccess() {
    const session = readIntakeAccessSession()
    if (!session?.token || session.planSlug !== planSlug) {
      toast.error('Primero tocá «Pedir permiso» después de hablar con Tomás por WhatsApp.')
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
      toast.success('¡Permiso otorgado! Podés completar tus datos.')
      onApproved()
      return
    }
    if (result.status === 'denied') {
      toast.error('El acceso no fue aprobado. Escribile a Tomás por WhatsApp.')
      return
    }
    toast('Todavía pendiente. Coordiná el pago con Tomás y volvé a intentar.', { icon: '⏳' })
  }

  return (
    <div className="v2f-slide space-y-6">
      <header className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-5 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-primary">Paso 2 de 4</p>
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

      <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/[0.06] p-5 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
        <p className="text-base font-semibold text-zinc-900 dark:text-white">
          ¿Te interesó este plan?
        </p>
        <p className="mt-2">
          Hablá con <strong>Tomás Ferster</strong> por WhatsApp para que pueda darte los permisos y seguir con el
          próximo paso (completar tus datos). Sin ese permiso no vas a poder rellenar el formulario.
        </p>
      </div>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-600/40 bg-emerald-500/[0.1] px-4 py-8 text-center transition-colors hover:bg-emerald-500/20',
        )}
      >
        <WhatsAppIcon className="h-10 w-10" />
        <span className="text-base font-bold text-emerald-900 dark:text-emerald-100">
          Hablar con Tomás Ferster por WhatsApp
        </span>
        <span className="text-sm text-emerald-800/90 dark:text-emerald-200/90">{TRAINER_CONTACT_WHATSAPP_DISPLAY}</span>
        <span className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
          El mensaje ya incluye el plan que elegiste
        </span>
      </a>

      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-brand-primary" aria-hidden />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Después de coordinar el pago por WhatsApp, tocá <strong className="text-zinc-800 dark:text-zinc-200">Pedir permiso</strong> para
            que Tomás reciba el aviso en la app. Cuando te habilite, usá <strong className="text-zinc-800 dark:text-zinc-200">Ya tengo permiso</strong> para
            pasar al paso Datos.
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
          Pedir permiso
        </Button>
        {hasToken ? (
          <p className="text-center text-[11px] text-zinc-500">Solicitud registrada para este plan.</p>
        ) : null}
        <Button type="button" className="w-full" loading={checking} onClick={() => void handleCheckAccess()}>
          Ya tengo permiso — continuar a Datos
        </Button>
      </div>
    </div>
  )
}
