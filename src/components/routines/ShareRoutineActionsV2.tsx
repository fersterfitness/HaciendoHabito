import { useState } from 'react'
import { Copy, ExternalLink, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ActionMenuV2 } from '@/components/v2/ActionMenuV2'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { useAuthStore } from '@/stores/authStore'
import { copyWhatsAppMessage, normalizePhoneForWhatsApp, shareToWhatsApp } from '@/lib/whatsapp'
import {
  ensureRoutineShareToken,
  regenerateRoutineShareToken,
  sharedRoutineMessage,
  sharedRoutineUrl,
} from '@/lib/routine/sharedRoutine'

/**
 * v2 · Link de la rutina para el alumno: lo abre en el celu sin cuenta, siempre ve la rutina vigente y
 * desde ahí completa el feedback de la semana. «Link nuevo» corta el anterior.
 */
export function ShareRoutineActionsV2({
  studentId,
  studentName,
  studentPhone,
  className,
}: {
  studentId: string
  studentName: string
  studentPhone: string | null
  className?: string
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
      const token = await ensureRoutineShareToken(user.id, studentId)
      await run(sharedRoutineUrl(token))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo armar el link')
    }
    setBusy(null)
  }

  async function newLink() {
    if (!user) return
    setBusy('new')
    try {
      const token = await regenerateRoutineShareToken(user.id, studentId)
      const ok = await copyWhatsAppMessage(sharedRoutineUrl(token))
      toast.success(ok ? 'Link nuevo copiado. El anterior ya no funciona.' : 'Link nuevo listo. El anterior ya no funciona.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el link')
    }
    setConfirmNew(false)
    setBusy(null)
  }

  return (
    <div className={className ?? 'flex flex-wrap items-center gap-2'}>
      <Button
        type="button"
        size="sm"
        variant="soft"
        icon={<WhatsAppIcon className="h-3.5 w-3.5" />}
        loading={busy === 'wa'}
        title="Le llega un link para ver la rutina en el celu, sin cuenta, con el feedback de la semana."
        onClick={() =>
          void withLink('wa', async (url) => {
            const r = await shareToWhatsApp({ message: sharedRoutineMessage(firstName, url), phoneDigits })
            if (r.mode === 'clipboard') toast.success(r.copied ? 'Mensaje copiado: pegalo en el chat.' : 'Abrí el chat y pegá el link.')
          })
        }
      >
        Enviar al alumno
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        icon={<ExternalLink className="h-3.5 w-3.5" />}
        loading={busy === 'open'}
        onClick={() => void withLink('open', (url) => void window.open(url, '_blank', 'noopener,noreferrer'))}
      >
        Ver como alumno
      </Button>
      <ActionMenuV2
        label="Más opciones del link de la rutina"
        items={[
          {
            label: 'Copiar link',
            icon: <Copy />,
            onClick: () =>
              void withLink('copy', async (url) => {
                const ok = await copyWhatsAppMessage(url)
                if (ok) toast.success('Link copiado')
                else toast(url, { duration: 8000 })
              }),
          },
          'divider',
          { label: 'Link nuevo…', hint: 'El anterior deja de funcionar', icon: <RefreshCw />, onClick: () => setConfirmNew(true) },
        ]}
      />
      <ConfirmDialog
        open={confirmNew}
        onClose={() => setConfirmNew(false)}
        onConfirm={() => void newLink()}
        title="¿Generar un link nuevo?"
        description="El link que ya le mandaste deja de funcionar. Vas a tener que mandarle el nuevo."
        confirmLabel="Generar link nuevo"
        variant="warning"
        loading={busy === 'new'}
      />
    </div>
  )
}
