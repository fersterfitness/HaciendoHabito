import { useState } from 'react'
import { Copy, ExternalLink, RefreshCw, Send } from 'lucide-react'
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
          <p className="mt-1 max-w-[52ch] text-xs text-ink-secondary">
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
