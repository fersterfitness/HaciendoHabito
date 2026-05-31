import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PlanGeneralNotesDisplay } from '@/components/nutrition/PlanGeneralNotesDisplay'
import {
  parsePlanGeneralNotes,
  serializePlanGeneralNotes,
  type ParsedPlanGeneralNotes,
} from '@/lib/nutrition/planGeneralNotes'
import { nutritionInputClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'

const planNotesFieldClass = cn(
  nutritionInputClass,
  'px-3 py-2 text-sm leading-snug',
)

/** Ítem editable con apariencia de viñeta en lista. */
const planNotesItemShellClass =
  'flex gap-2 rounded-xl border border-surface-border/70 bg-surface-elevated/35 px-2.5 py-2'

const planNotesItemInputClass = cn(
  'min-h-0 flex-1 resize-y border-0 bg-transparent p-0 text-sm leading-snug text-ink-primary shadow-none',
  'placeholder:text-ink-muted focus:border-0 focus:ring-0 focus:outline-none',
)

type Props = {
  value: string
  onChange: (next: string) => void
  className?: string
}

function emit(parsed: ParsedPlanGeneralNotes, onChange: (next: string) => void) {
  onChange(serializePlanGeneralNotes(parsed))
}

export function PlanGeneralNotesFields({ value, onChange, className }: Props) {
  const [parsed, setParsed] = useState(() => parsePlanGeneralNotes(value))
  const serialized = serializePlanGeneralNotes(parsed)
  const hasPreviewContent = Boolean(parsed.preamble.trim() || parsed.aclaraciones.some((s) => s.trim()))

  useEffect(() => {
    setParsed(parsePlanGeneralNotes(value))
  }, [value])

  function updateParsed(next: ParsedPlanGeneralNotes) {
    setParsed(next)
    emit(next, onChange)
  }

  function setPreamble(text: string) {
    updateParsed({ ...parsed, preamble: text })
  }

  function setItem(index: number, text: string) {
    const aclaraciones = [...parsed.aclaraciones]
    aclaraciones[index] = text
    updateParsed({ ...parsed, aclaraciones })
  }

  function addItem() {
    updateParsed({ ...parsed, aclaraciones: [...parsed.aclaraciones, ''] })
  }

  function removeItem(index: number) {
    updateParsed({
      ...parsed,
      aclaraciones: parsed.aclaraciones.filter((_, i) => i !== index),
    })
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-xs font-medium text-ink-secondary">
        Texto introductorio
        <span className="ml-1 font-normal text-ink-muted">(opcional)</span>
        <textarea
          value={parsed.preamble}
          onChange={(e) => setPreamble(e.target.value)}
          rows={2}
          placeholder="Contexto general del plan…"
          className={cn('mt-1.5 w-full', planNotesFieldClass)}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-secondary">Aclaraciones</p>
          <Button type="button" variant="ghost" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addItem}>
            Agregar ítem
          </Button>
        </div>

        {parsed.aclaraciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-surface-border/80 px-3 py-3 text-xs text-ink-muted">
            Sin ítems. Cada aclaración se muestra como viñeta en el plan y en la vista previa.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {parsed.aclaraciones.map((item, index) => (
              <li key={index} className={planNotesItemShellClass}>
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary"
                  aria-hidden
                />
                <textarea
                  value={item}
                  onChange={(e) => setItem(index, e.target.value)}
                  rows={2}
                  placeholder={`Ítem ${index + 1}…`}
                  className={planNotesItemInputClass}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="mt-0.5 shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-status-expired/10 hover:text-status-expired"
                  title="Quitar ítem"
                  aria-label="Quitar ítem"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasPreviewContent ? (
        <div className="rounded-xl border border-brand-secondary/20 bg-brand-secondary/[0.04] px-3 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-brand-secondary/90">
            Vista en el plan
          </p>
          <PlanGeneralNotesDisplay value={serialized} />
        </div>
      ) : null}
    </div>
  )
}
