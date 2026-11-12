import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  buildTrainerContactWhatsAppUrl,
  TRAINER_CONTACT_WHATSAPP_DISPLAY,
  whatsAppInterestMessage,
} from '@/lib/trainerContact'
import {
  checkWebIntakeAccessStatus,
  isDevIntakeAccessBypass,
  issueDevApprovedIntakeAccess,
  readIntakeAccessEmail,
  readIntakeAccessSession,
  requestWebIntakeAccess,
  resumeWebIntakeAccessByEmail,
} from '@/lib/intake/webIntakeAccess'
import { cn } from '@/lib/utils'

const EASE = [0.16, 1, 0.3, 1] as const

type Props = {
  planSlug: string
  planName: string
  onApproved: () => void
  onBack: () => void
}

export function IntakePermissionsStep({ planSlug, planName, onApproved, onBack }: Props) {
  const [checking, setChecking] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [hasToken, setHasToken] = useState(false)
  const [email, setEmail] = useState(() => readIntakeAccessEmail())

  const waUrl = buildTrainerContactWhatsAppUrl(whatsAppInterestMessage(planName))

  const refreshTokenState = useCallback(() => {
    const session = readIntakeAccessSession()
    setHasToken(Boolean(session?.token && session.planSlug === planSlug))
  }, [planSlug])

  useEffect(() => {
    refreshTokenState()
  }, [refreshTokenState])

  async function handleRequestAccess() {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Poné tu mail para que, si salís de la página, puedas retomar el permiso.')
      return
    }
    setRequesting(true)
    const result = await requestWebIntakeAccess({
      planSlug,
      planTitle: planName,
      applicantEmail: email.trim(),
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
    let session = readIntakeAccessSession()
    if (!session?.token || session.planSlug !== planSlug) {
      if (email.trim()) {
        setChecking(true)
        const resumed = await resumeWebIntakeAccessByEmail({ email, planSlug })
        setChecking(false)
        if (!resumed.ok) {
          toast.error(resumed.error)
          return
        }
        refreshTokenState()
        session = readIntakeAccessSession()
        if (resumed.status === 'approved') {
          toast.success('¡Permiso otorgado! Podés completar tus datos.')
          onApproved()
          return
        }
        if (resumed.status === 'denied') {
          toast.error('El acceso no fue aprobado. Escribile a Tomás por WhatsApp.')
          return
        }
        toast('Todavía pendiente. Coordiná el pago con Tomás y volvé a intentar.', { icon: '⏳' })
        return
      }
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
    <div>
      <ol>
        <PermissionStep index={0} done={hasToken} title="Escribile por WhatsApp" text="El mensaje ya incluye el plan que elegiste. Ahí coordinan el pago.">
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hh-focus inline-flex h-11 items-center gap-2.5 rounded-xl bg-status-ok px-4 text-sm font-semibold text-black transition-transform active:scale-[0.98]"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Hablar con Tomás
            <span className="hidden font-normal tabular-nums opacity-70 sm:inline">{TRAINER_CONTACT_WHATSAPP_DISPLAY}</span>
          </a>
        </PermissionStep>

        <PermissionStep
          index={1}
          done={hasToken}
          title="Pedí el permiso"
          text="Tomás recibe el aviso en la app. Dejá tu mail para poder retomar si cerrás la página."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Input
                type="email"
                label="Tu mail"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@mail.com"
              />
            </div>
            <Button type="button" variant="soft" size="lg" loading={requesting} onClick={() => void handleRequestAccess()}>
              {hasToken ? 'Volver a pedir' : 'Pedir permiso'}
            </Button>
          </div>
          {hasToken ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-status-ok/15 px-2 py-1 text-2xs font-semibold text-status-ok-ink"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.75} aria-hidden />
              Solicitud enviada para este plan
            </motion.p>
          ) : null}
        </PermissionStep>

        <PermissionStep index={2} last title="Entrá a completar tus datos" text="Cuando Tomás te avise que ya te habilitó, seguí desde acá.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" size="lg" loading={checking} onClick={() => void handleCheckAccess()}>
              Ya tengo permiso
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
            {isDevIntakeAccessBypass() ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="border-dashed"
                loading={skipping}
                onClick={() => {
                  void (async () => {
                    setSkipping(true)
                    const result = await issueDevApprovedIntakeAccess({
                      planSlug,
                      planTitle: planName,
                    })
                    setSkipping(false)
                    if (!result.ok) {
                      toast.error(result.error, { duration: 9000 })
                      return
                    }
                    refreshTokenState()
                    toast.success('Permiso de desarrollo listo. Ya podés completar y enviar.')
                    onApproved()
                  })()
                }}
              >
                Saltar permiso (solo desarrollo)
              </Button>
            ) : null}
          </div>
        </PermissionStep>
      </ol>

      <div className="mt-2 border-t border-surface-border pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Elegir otro plan
        </Button>
      </div>
    </div>
  )
}

/** Un paso de la lista: número (o tilde si ya está hecho), la línea que lo une al siguiente y su acción. */
function PermissionStep({
  index,
  title,
  text,
  done = false,
  last = false,
  children,
}: {
  index: number
  title: string
  text: string
  done?: boolean
  last?: boolean
  children: ReactNode
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE, delay: 0.06 + index * 0.07 }}
      className="flex gap-3.5"
    >
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums transition-colors duration-300',
            done ? 'bg-status-ok text-black' : 'bg-ink-primary text-surface-base',
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : index + 1}
        </span>
        {!last ? <span className="mt-1.5 w-px flex-1 bg-surface-border" aria-hidden /> : null}
      </div>
      <div className={cn('min-w-0 flex-1', last ? 'pb-4' : 'pb-7')}>
        <h2 className="pt-0.5 text-base font-semibold leading-tight tracking-tight text-ink-primary">{title}</h2>
        <p className="mt-1 text-body-sm leading-snug text-ink-muted">{text}</p>
        <div className="mt-3">{children}</div>
      </div>
    </motion.li>
  )
}
