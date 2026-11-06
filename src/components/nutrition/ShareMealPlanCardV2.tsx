import { type ReactNode, useState } from 'react'
import { Copy, ExternalLink, MoreHorizontal, RefreshCw, Send } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import {
  ensureMealPlanShareToken,
  regenerateMealPlanShareToken,
  sharedMealPlanMessage,
  sharedMealPlanUrl,
} from '@/lib/nutrition/sharedMealPlan'
import { copyWhatsAppMessage, normalizePhoneForWhatsApp, shareToWhatsApp } from '@/lib/whatsapp'

/**
 * v2: compartir el plan con el paciente por un link (lo abre sin cuenta, en el celu).
 * El link muestra siempre la versión vigente; «Link nuevo» corta el anterior.
 */
export function ShareMealPlanCardV2({
  studentId,
  studentName,
  studentPhone,
}: {
  studentId: string
  studentName: string
  studentPhone: string | null
}) {
  const user = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState<null | 'copy' | 'wa' | 'open' | 'new'>(null)
  const [confirmNew, setConfirmNew] = useState(false)
  const firstName = studentName.trim().split(/\s+/)[0] ?? ''
  const phoneDigits = normalizePhoneForWhatsApp(studentPhone)

  async function withLink(kind: 'copy' | 'wa' | 'open', run: (url: string) => Promise<void> | void) {
    if (!user) return
    setBusy(kind)
    try {
      const token = await ensureMealPlanShareToken(user.id, studentId)
      await run(sharedMealPlanUrl(token))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo armar el link')
    }
    setBusy(null)
  }

  async function newLink() {
    if (!user) return
    setBusy('new')
    try {
      const token = await regenerateMealPlanShareToken(user.id, studentId)
      const ok = await copyWhatsAppMessage(sharedMealPlanUrl(token))
      toast.success(ok ? 'Link nuevo copiado. El anterior ya no funciona.' : 'Link nuevo listo. El anterior ya no funciona.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el link')
    }
    setConfirmNew(false)
    setBusy(null)
  }

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-primary">Compartir con {firstName || 'el paciente'}</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Le llega un link para abrir el plan en el celu, sin cuenta. Si cambiás el plan, el link muestra la versión nueva.
            Desde ahí también lo puede guardar en PDF.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          icon={<Send className="h-3.5 w-3.5" />}
          loading={busy === 'wa'}
          onClick={() =>
            void withLink('wa', async (url) => {
              const r = await shareToWhatsApp({ message: sharedMealPlanMessage(firstName, url), phoneDigits })
              if (r.mode === 'clipboard') toast.success(r.copied ? 'Mensaje copiado: pegalo en el chat.' : 'Abrí el chat y pegá el link.')
            })
          }
        >
          {phoneDigits ? 'Enviar por WhatsApp' : 'Compartir por WhatsApp'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<Copy className="h-3.5 w-3.5" />}
          loading={busy === 'copy'}
          onClick={() =>
            void withLink('copy', async (url) => {
              const ok = await copyWhatsAppMessage(url)
              if (ok) toast.success('Link copiado')
              else toast(url, { duration: 8000 })
            })
          }
        >
          Copiar link
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<ExternalLink className="h-3.5 w-3.5" />}
          loading={busy === 'open'}
          onClick={() => void withLink('open', (url) => void window.open(url, '_blank', 'noopener,noreferrer'))}
        >
          Ver como paciente
        </Button>
        {confirmNew ? (
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
            El link anterior deja de funcionar.
            <Button type="button" size="sm" variant="secondary" loading={busy === 'new'} onClick={() => void newLink()}>
              Generar
            </Button>
            <button type="button" className="text-ink-muted hover:text-ink-primary" onClick={() => setConfirmNew(false)}>
              Cancelar
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmNew(true)}
            className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink-primary"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Link nuevo
          </button>
        )}
      </div>
    </div>
  )
}

/** Fila de una opción del menú «⋯» del plan. */
export const planMenuItemClass =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated disabled:opacity-50'

/**
 * v2, versión corta: a la vista solo lo que se usa siempre (mandar el plan y verlo como el
 * paciente). Copiar el link, link nuevo y lo que pase `menu` quedan en «⋯».
 */
export function ShareMealPlanActionsV2({
  studentId,
  studentName,
  studentPhone,
  menu,
}: {
  studentId: string
  studentName: string
  studentPhone: string | null
  menu?: (close: () => void) => ReactNode
}) {
  const user = useAuthStore((s) => s.user)
  const [busy, setBusy] = useState<null | 'copy' | 'wa' | 'open' | 'new'>(null)
  const [open, setOpen] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const firstName = studentName.trim().split(/\s+/)[0] ?? ''
  const phoneDigits = normalizePhoneForWhatsApp(studentPhone)

  async function withLink(kind: 'copy' | 'wa' | 'open', run: (url: string) => Promise<void> | void) {
    if (!user) return
    setBusy(kind)
    try {
      const token = await ensureMealPlanShareToken(user.id, studentId)
      await run(sharedMealPlanUrl(token))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo armar el link')
    }
    setBusy(null)
  }

  async function newLink() {
    if (!user) return
    setBusy('new')
    try {
      const token = await regenerateMealPlanShareToken(user.id, studentId)
      const ok = await copyWhatsAppMessage(sharedMealPlanUrl(token))
      toast.success(ok ? 'Link nuevo copiado. El anterior ya no funciona.' : 'Link nuevo listo. El anterior ya no funciona.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el link')
    }
    setConfirmNew(false)
    setOpen(false)
    setBusy(null)
  }

  const close = () => setOpen(false)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        icon={<Send className="h-3.5 w-3.5" />}
        loading={busy === 'wa'}
        title="Le llega un link para abrir el plan en el celu, sin cuenta. Siempre muestra la versión vigente."
        onClick={() =>
          void withLink('wa', async (url) => {
            const r = await shareToWhatsApp({ message: sharedMealPlanMessage(firstName, url), phoneDigits })
            if (r.mode === 'clipboard') toast.success(r.copied ? 'Mensaje copiado: pegalo en el chat.' : 'Abrí el chat y pegá el link.')
          })
        }
      >
        Enviar por WhatsApp
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<ExternalLink className="h-3.5 w-3.5" />}
        loading={busy === 'open'}
        onClick={() => void withLink('open', (url) => void window.open(url, '_blank', 'noopener,noreferrer'))}
      >
        Ver como paciente
      </Button>
      <Popover
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) setConfirmNew(false)
        }}
        align="end"
        className="w-64 p-1"
        trigger={(t) => (
          <Button {...t} type="button" size="sm" variant="secondary" aria-label="Más opciones del plan" title="Más opciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        )}
      >
        <button
          type="button"
          className={planMenuItemClass}
          onClick={() =>
            void withLink('copy', async (url) => {
              const ok = await copyWhatsAppMessage(url)
              if (ok) toast.success('Link copiado')
              else toast(url, { duration: 8000 })
              close()
            })
          }
        >
          <Copy className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
          Copiar link
        </button>
        {menu?.(close)}
        <div className="my-1 h-px bg-surface-border/70" />
        {confirmNew ? (
          <div className="px-2 py-1.5 text-[12px] text-ink-secondary">
            El link anterior deja de funcionar.
            <div className="mt-2 flex gap-2">
              <Button type="button" size="sm" variant="secondary" loading={busy === 'new'} onClick={() => void newLink()}>
                Generar
              </Button>
              <button type="button" className="text-ink-muted hover:text-ink-primary" onClick={() => setConfirmNew(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={planMenuItemClass} onClick={() => setConfirmNew(true)}>
            <RefreshCw className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
            Link nuevo
          </button>
        )}
      </Popover>
    </div>
  )
}
