import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { controlMdClassName, controlTextareaClassName } from '@/lib/formControlClasses'
import { menuFromDraft, type MenuDraft } from '@/lib/nutrition/customMenus'
import {
  PATHOLOGY_LABELS,
  SEASON_LABELS,
  type DigestiveTolerance,
  type MenuSeason,
  type PathologyTag,
  type SeasonalMenuTemplate,
} from '@/lib/nutrition/seasonalMenuLibrary'
import { cn } from '@/lib/utils'

const TOLERANCE_SHORT: Record<DigestiveTolerance, string> = { baja: 'Baja', media: 'Media', alta: 'Alta' }

/** Alta y edición de un menú propio. `initial` distinto de null abre el editor. */
export function CustomMenuEditor({
  initial,
  saving,
  onClose,
  onSave,
}: {
  initial: MenuDraft | null
  saving: boolean
  onClose: () => void
  onSave: (menu: Omit<SeasonalMenuTemplate, 'id'> & { id?: string }) => void
}) {
  const [draft, setDraft] = useState<MenuDraft | null>(initial)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(initial)
    setError(null)
  }, [initial])

  if (!draft) return <Modal open={false} onClose={onClose} />

  // Al corregir, el aviso de error se va: vuelve a aparecer si al guardar sigue faltando algo.
  const patch = (p: Partial<MenuDraft>) => {
    setError(null)
    setDraft((d) => (d ? { ...d, ...p } : d))
  }
  const patchMeal = (i: number, p: Partial<MenuDraft['meals'][number]>) => {
    setError(null)
    setDraft((d) => (d ? { ...d, meals: d.meals.map((m, j) => (j === i ? { ...m, ...p } : m)) } : d))
  }
  const total = draft.meals.reduce((sum, m) => sum + (Number(m.kcal.replace(',', '.')) || 0), 0)

  function submit() {
    const { menu, error: why } = menuFromDraft(draft!)
    if (!menu) {
      setError(why)
      return
    }
    setError(null)
    onSave(menu)
  }

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      size="xl"
      title={draft.id ? 'Editar menú' : 'Nuevo menú'}
      description="Queda en tu biblioteca, junto a los que trae la app, para usarlo con cualquier paciente."
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <span className="mr-auto text-sm tabular-nums text-ink-muted">{total > 0 ? `≈ ${Math.round(total).toLocaleString('es-AR')} kcal por día` : ''}</span>
          <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" loading={saving} onClick={submit}>
            Guardar menú
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {error ? (
          <p role="alert" className="hh-pastel rounded-xl bg-pastel-rose px-3.5 py-2.5 text-sm text-pastel-rose-ink">
            {error}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nombre" required autoFocus value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Ej: Verano liviano sin lácteos" />
          </div>
          <label className="block text-xs text-ink-secondary">
            Temporada
            <select value={draft.season} onChange={(e) => patch({ season: e.target.value as MenuSeason })} className={cn(controlMdClassName, 'mt-1 w-full cursor-pointer')}>
              {(Object.keys(SEASON_LABELS) as MenuSeason[]).map((s) => (
                <option key={s} value={s}>
                  {SEASON_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-ink-secondary">
            Tolerancia digestiva
            <select
              value={draft.tolerance}
              onChange={(e) => patch({ tolerance: e.target.value as DigestiveTolerance })}
              className={cn(controlMdClassName, 'mt-1 w-full cursor-pointer')}
            >
              {(Object.keys(TOLERANCE_SHORT) as DigestiveTolerance[]).map((t) => (
                <option key={t} value={t}>
                  {TOLERANCE_SHORT[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Input label="Resumen" value={draft.summary} onChange={(e) => patch({ summary: e.target.value })} placeholder="Una línea: para quién es y qué lo distingue" />
          </div>
        </div>

        <fieldset>
          <legend className="pb-1.5 text-xs text-ink-secondary">Indicado para</legend>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(PATHOLOGY_LABELS) as PathologyTag[]).map((p) => {
              const on = draft.pathologies.includes(p)
              return (
                <Button
                  key={p}
                  type="button"
                  size="sm"
                  variant={on ? 'primary' : 'secondary'}
                  aria-pressed={on}
                  onClick={() => patch({ pathologies: on ? draft.pathologies.filter((x) => x !== p) : [...draft.pathologies, p] })}
                >
                  {PATHOLOGY_LABELS[p]}
                </Button>
              )
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-semibold text-ink-primary">Comidas</p>
          {draft.meals.map((meal, i) => (
            <div key={i} className="rounded-xl bg-surface-elevated/60 p-3">
              <div className="flex items-end gap-2">
                <label className="block min-w-0 flex-1 text-xs text-ink-secondary">
                  Comida
                  <input value={meal.label} onChange={(e) => patchMeal(i, { label: e.target.value })} className={cn(controlMdClassName, 'mt-1 w-full px-2.5')} />
                </label>
                <label className="block w-24 shrink-0 text-xs text-ink-secondary">
                  Calorías
                  <input
                    inputMode="numeric"
                    value={meal.kcal}
                    onChange={(e) => patchMeal(i, { kcal: e.target.value })}
                    placeholder="kcal"
                    className={cn(controlMdClassName, 'mt-1 w-full px-2.5 tabular-nums')}
                  />
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar ${meal.label || 'comida'}`}
                  disabled={draft.meals.length <= 1}
                  onClick={() => patch({ meals: draft.meals.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <textarea
                aria-label={`Alimentos de ${meal.label || 'la comida'}`}
                value={meal.content}
                onChange={(e) => patchMeal(i, { content: e.target.value })}
                rows={3}
                placeholder="Un alimento por línea, con su cantidad. Ej: Avena 40 g"
                className={cn(controlTextareaClassName, 'mt-2 w-full px-2.5 py-2 text-sm')}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="self-start"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => patch({ meals: [...draft.meals, { label: '', kcal: '', content: '' }] })}
          >
            Agregar comida
          </Button>
        </div>

        <label className="block text-xs text-ink-secondary">
          Notas clínicas (opcional)
          <textarea
            value={draft.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            rows={3}
            placeholder="Reemplazos, aclaraciones, a quién no se le indica…"
            className={cn(controlTextareaClassName, 'mt-1 w-full px-2.5 py-2 text-sm')}
          />
        </label>
      </div>
    </Modal>
  )
}
