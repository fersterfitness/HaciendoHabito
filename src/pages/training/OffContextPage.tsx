import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  isWednesday,
  offContextWhatsAppMessage,
  readOffContextDraft,
  saveOffContextDraft,
} from '@/lib/offContext'
import { buildWhatsAppGroupPickUrl, copyWhatsAppMessage, WHATSAPP_CLIPBOARD_PASTE_HINT } from '@/lib/whatsapp'

export function OffContextPage() {
  const initial = useMemo(() => readOffContextDraft(), [])
  const [question, setQuestion] = useState(initial.question)
  const [answer, setAnswer] = useState(initial.answer)
  const wednesday = isWednesday()
  const message = offContextWhatsAppMessage(question, answer)

  function persist() {
    saveOffContextDraft(question, answer)
  }

  return (
    <div>
      <Header title="Saliendo de contexto" />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 lg:px-6">
        {wednesday ? (
          <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            Hoy es miércoles: es el día de mandar el hilo al grupo.
          </p>
        ) : (
          <p className="text-sm text-ink-secondary">
            Recordatorio de los miércoles. Armá la pregunta, poné tu respuesta para abrir el hilo y mandalo al grupo.
          </p>
        )}

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Cuestionamiento
          </span>
          <Textarea
            rows={3}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onBlur={persist}
            placeholder="Ej: ¿Qué canción te pone a mil para entrenar?"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Tu respuesta (abro hilo)
          </span>
          <Textarea
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onBlur={persist}
            placeholder="Escribí la tuya para que se sumen…"
          />
        </label>

        <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Vista previa
          </p>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-ink-primary">{message}</pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            icon={<WhatsAppIcon className="h-4 w-4" />}
            onClick={() => {
              persist()
              window.open(buildWhatsAppGroupPickUrl(message), '_blank', 'noopener,noreferrer')
            }}
          >
            Enviar al grupo
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              persist()
              void copyWhatsAppMessage(message).then((ok) => {
                toast.success(ok ? WHATSAPP_CLIPBOARD_PASTE_HINT : 'No se pudo copiar')
              })
            }}
          >
            Copiar mensaje
          </Button>
        </div>
      </div>
    </div>
  )
}
