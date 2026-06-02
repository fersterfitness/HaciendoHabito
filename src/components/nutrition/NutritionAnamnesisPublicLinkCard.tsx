import { useCallback, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CheckCircle2, Copy, Link2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/ui/Spinner'
import {
  createAnamnesisPublicLink,
  fetchAnamnesisPublicLinkStatus,
  resetAnamnesisForRedo,
  type AnamnesisPublicLinkStatus,
} from '@/lib/nutrition/anamnesisPublicLink'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

interface Props {
  studentId: string
  studentName: string
  onRedoComplete?: () => void
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  try {
    return format(parseISO(iso), "d MMM yyyy, HH:mm", { locale: es })
  } catch {
    return null
  }
}

export function NutritionAnamnesisPublicLinkCard({ studentId, studentName, onRedoComplete }: Props) {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [redoing, setRedoing] = useState(false)
  const [confirmRedo, setConfirmRedo] = useState(false)
  const [status, setStatus] = useState<AnamnesisPublicLinkStatus | null>(null)

  const reload = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setStatus(await fetchAnamnesisPublicLinkStatus(studentId, user.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el estado del link.')
    } finally {
      setLoading(false)
    }
  }, [studentId, user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleCopy = async () => {
    setCopying(true)
    try {
      const url = await createAnamnesisPublicLink(studentId)
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado. Enviáselo al paciente por WhatsApp o mail.')
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo copiar el link.')
    } finally {
      setCopying(false)
    }
  }

  const handleRedo = async () => {
    if (!user?.id) return
    setRedoing(true)
    try {
      await resetAnamnesisForRedo(studentId, user.id)
      toast.success('Anamnesis reiniciada. Podés copiar un link nuevo para el paciente.')
      setConfirmRedo(false)
      onRedoComplete?.()
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo reiniciar la anamnesis.')
    } finally {
      setRedoing(false)
    }
  }

  const canRedo = Boolean(status?.submitted || status?.linkIssuedAt || status?.hasContent)

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-ink-muted">
        <Spinner size="sm" />
        Cargando enlace…
      </div>
    )
  }

  if (status?.submitted) {
    const when = formatWhen(status.submittedAt)
    return (
      <>
        <div className="rounded-xl border border-surface-border bg-surface-muted/40 px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-2 text-sm text-ink-primary min-w-0">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <p className="font-medium">Anamnesis recibida</p>
                <p className="text-ink-muted text-xs mt-1">
                  {when
                    ? `${studentName} envió el formulario el ${when}. El link público ya no está disponible.`
                    : `${studentName} ya envió el formulario. El link público ya no está disponible.`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={() => setConfirmRedo(true)}
              className="shrink-0"
            >
              Rehacer anamnesis
            </Button>
          </div>
        </div>
        <ConfirmDialog
          open={confirmRedo}
          onClose={() => setConfirmRedo(false)}
          onConfirm={() => void handleRedo()}
          title="¿Rehacer anamnesis?"
          description={`Se borrarán las respuestas de ${studentName} (formulario público y borrador de Historia). Después podés generar y enviar un link nuevo.`}
          confirmLabel="Sí, reiniciar"
          cancelLabel="Cancelar"
          variant="warning"
          loading={redoing}
        />
      </>
    )
  }

  const issuedWhen = formatWhen(status?.linkIssuedAt ?? null)

  return (
    <>
      <div className="rounded-xl border border-dashed border-surface-border bg-surface-muted/30 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-primary flex items-center gap-1.5">
              <Link2 className="h-4 w-4 shrink-0" />
              Formulario para el paciente
            </p>
            <p className="text-xs text-ink-muted mt-1">
              Generá un link personalizado para que {studentName} complete la anamnesis en el navegador.
              {issuedWhen ? ` Último link generado: ${issuedWhen}.` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {canRedo ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={() => setConfirmRedo(true)}
              >
                Rehacer anamnesis
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Copy className="h-4 w-4" />}
              loading={copying}
              onClick={() => void handleCopy()}
            >
              Copiar link de anamnesis
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmRedo}
        onClose={() => setConfirmRedo(false)}
        onConfirm={() => void handleRedo()}
        title="¿Rehacer anamnesis?"
        description={`Se borrarán las respuestas de ${studentName} (formulario público y borrador de Historia). Después podés generar y enviar un link nuevo.`}
        confirmLabel="Sí, reiniciar"
        cancelLabel="Cancelar"
        variant="warning"
        loading={redoing}
      />
    </>
  )
}
