import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { controlSmClassName } from '@/lib/formControlClasses'
import { BLOCK_COLOR_PRESETS } from '@/lib/macrocycle/macrocycle'
import { phaseKeyFromLabel, savePhaseTypes, type PhaseType } from '@/lib/macrocycle/phaseTypes'
import { cn } from '@/lib/utils'

/**
 * Lista de fases del macrociclo (Adaptación, Acumulación, Intensificación, Peak…): renombrar,
 * cambiar color, quitar o agregar. Quitar una fase no borra los bloques que ya la tienen.
 */
export function PhaseTypesEditor({ phases, onClose }: { phases: PhaseType[]; onClose: () => void }) {
  const [list, setList] = useState<PhaseType[]>(phases)
  const [newLabel, setNewLabel] = useState('')
  const [saving, setSaving] = useState(false)

  function nextColor(color: string): string {
    const i = BLOCK_COLOR_PRESETS.indexOf(color)
    return BLOCK_COLOR_PRESETS[(i + 1) % BLOCK_COLOR_PRESETS.length]!
  }

  function add() {
    const label = newLabel.trim()
    if (!label) return
    const used = new Set(list.map((t) => t.color))
    const color = BLOCK_COLOR_PRESETS.find((c) => !used.has(c)) ?? BLOCK_COLOR_PRESETS[0]!
    setList((l) => [...l, { id: phaseKeyFromLabel(label, l.map((t) => t.id)), label, color }])
    setNewLabel('')
  }

  async function save() {
    const clean = list.map((t) => ({ ...t, label: t.label.trim() })).filter((t) => t.label)
    if (clean.length === 0) {
      toast.error('Dejá al menos una fase')
      return
    }
    setSaving(true)
    const err = await savePhaseTypes(clean)
    setSaving(false)
    if (err) {
      toast.error(err)
      return
    }
    toast.success('Fases guardadas')
    onClose()
  }

  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Fases del macrociclo</h3>
          <p className="text-2xs text-ink-muted">Tocá el color para cambiarlo. Si quitás una fase, los bloques que ya la tienen la conservan.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Cerrar">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ul className="space-y-1.5">
        {list.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setList((l) => l.map((x, j) => (j === i ? { ...x, color: nextColor(x.color) } : x)))}
              className="h-7 w-7 shrink-0 rounded-md border border-black/10"
              style={{ background: t.color }}
              aria-label={`Cambiar color de ${t.label}`}
            />
            <input
              value={t.label}
              maxLength={40}
              onChange={(e) => setList((l) => l.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className={cn(controlSmClassName, 'min-w-0 flex-1')}
              aria-label="Nombre de la fase"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setList((l) => l.filter((_, j) => j !== i))}
              title="Quitar fase"
              aria-label={`Quitar ${t.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          value={newLabel}
          maxLength={40}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nueva fase (ej. Descarga)"
          className={cn(controlSmClassName, 'min-w-0 flex-1')}
        />
        <Button type="submit" variant="secondary" size="sm" disabled={!newLabel.trim()}>
          <Plus className="h-3.5 w-3.5" /> Agregar
        </Button>
      </form>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          Guardar fases
        </Button>
      </div>
    </section>
  )
}
