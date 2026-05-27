import { Plus, Trash2 } from 'lucide-react'
import { Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  type WebPlanIncludeProfessional,
  type WebPlanIncludeSection,
  WEB_PLAN_PROFESSIONAL_META,
  WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER,
  availableProfessionalsToAdd,
  parseItemsMultiline,
} from '@/lib/webPlanIncludeSections'

function itemsToMultiline(items: string[]) {
  return items.join('\n')
}

type Props = {
  sections: WebPlanIncludeSection[]
  onChange: (sections: WebPlanIncludeSection[]) => void
  itemMaxLength?: number
}

export function WebPlanIncludesSectionsEditor({ sections, onChange, itemMaxLength = 180 }: Props) {
  const canAdd = availableProfessionalsToAdd(sections)

  function updateSection(professional: WebPlanIncludeProfessional, items: string[]) {
    onChange(
      sections.map((s) => (s.professional === professional ? { ...s, items } : s)),
    )
  }

  function removeSection(professional: WebPlanIncludeProfessional) {
    onChange(sections.filter((s) => s.professional !== professional))
  }

  function addSection(professional: WebPlanIncludeProfessional) {
    onChange([
      ...sections,
      { professional, items: ['Nuevo beneficio (editá esta línea).'] },
    ])
  }

  const ordered = WEB_PLAN_INCLUDE_PROFESSIONAL_ORDER.flatMap((pro) => {
    const sec = sections.find((s) => s.professional === pro)
    return sec ? [sec] : []
  })

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-ink-muted leading-snug">
        Agrupá lo que incluye cada profesional. En el formulario público el tilde usa:{' '}
        <span className="text-brand-secondary font-medium">Entrenador (secondary)</span>,{' '}
        <span className="text-cyan-600 dark:text-cyan-400 font-medium">Psicólogo (cyan)</span>,{' '}
        <span className="text-brand-tertiary font-medium">Nutricionista (tertiary)</span>.
      </p>

      {ordered.length === 0 ? (
        <p className="text-sm text-ink-muted italic rounded-lg border border-dashed border-surface-border px-3 py-4">
          Todavía no hay secciones. Agregá al menos una (Entrenador, Psicólogo o Nutricionista).
        </p>
      ) : (
        ordered.map((sec) => {
          const meta = WEB_PLAN_PROFESSIONAL_META[sec.professional]
          return (
            <div
              key={sec.professional}
              className={cn('rounded-xl border p-3 space-y-2', meta.chipClass)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide">{meta.label}</span>
                <button
                  type="button"
                  className="p-1 rounded-md text-ink-muted hover:text-status-expired hover:bg-status-expired/10"
                  title={`Quitar sección ${meta.label}`}
                  aria-label={`Quitar sección ${meta.label}`}
                  onClick={() => removeSection(sec.professional)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Textarea
                label="Ítems — una línea por beneficio"
                value={itemsToMultiline(sec.items)}
                hint={`Máx. ${itemMaxLength} caracteres por línea.`}
                rows={Math.min(8, Math.max(3, sec.items.length))}
                onChange={(e) => updateSection(sec.professional, parseItemsMultiline(e.target.value))}
              />
            </div>
          )
        })
      )}

      {canAdd.length > 0 ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {canAdd.map((pro) => (
            <Button
              key={pro}
              type="button"
              size="sm"
              variant="outline"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => addSection(pro)}
            >
              Agregar {WEB_PLAN_PROFESSIONAL_META[pro].label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
