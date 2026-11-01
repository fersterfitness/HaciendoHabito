import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { PhaseTypesEditor } from '@/components/routines/PhaseTypesEditor'
import { blockColor, blockTypeLabel } from '@/lib/macrocycle/macrocycle'
import { usePhaseTypes } from '@/lib/macrocycle/phaseTypes'
import { blueprintLibraryRoutineId, blueprintRoutineGroup } from '@/lib/routine/blueprintFolders'
import { weekDatesFromStart } from '@/lib/routine/routineBlueprint'
import { controlSmClassName } from '@/lib/formControlClasses'
import { cn } from '@/lib/utils'
import type { Json, RoutineBlueprint } from '@/types/database'

const CELL_W = 52
const NAME_W = 200

type Week = { name: string; sort_order: number; phase_type?: string | null }
type Slot = { key: string; meso: string; label: string; variants: RoutineBlueprint[] }

function payloadWeeks(bp: RoutineBlueprint): Week[] {
  const p = bp.payload
  if (!p || typeof p !== 'object' || Array.isArray(p)) return []
  const blocks = (p as { blocks?: unknown }).blocks
  if (!Array.isArray(blocks)) return []
  return (blocks as Week[]).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

const sortNames = (a: string, b: string) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es'))

function nextMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const short = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`

/**
 * Calendario de un macrociclo preestablecido: los mesociclos y sus rutinas una detrás de otra,
 * semana a semana, como si fuera un alumno. La fase de cada semana se marca acá y, al asignar la
 * rutina, pasa al calendario del alumno con sus fechas.
 */
export function PresetMacroCalendar({
  macroName,
  blueprints,
  onClose,
  onPayloadSaved,
}: {
  macroName: string
  blueprints: RoutineBlueprint[]
  onClose: () => void
  onPayloadSaved: (id: string, payload: Json) => void
}) {
  const phaseTypes = usePhaseTypes()
  const [phasesOpen, setPhasesOpen] = useState(false)
  const [startDate, setStartDate] = useState(nextMonday)
  const [variantBySlot, setVariantBySlot] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<{ bpId: string; index: number } | null>(null)
  const [saving, setSaving] = useState(false)

  /** Mesociclo → rutina (cada rutina es una posición; sus variantes son alternativas). */
  const slots = useMemo(() => {
    const byMeso = new Map<string, Map<string, RoutineBlueprint[]>>()
    for (const bp of blueprints) {
      const meso = bp.subcategory?.trim() || ''
      const rut = blueprintRoutineGroup(bp)
      if (!byMeso.has(meso)) byMeso.set(meso, new Map())
      const ruts = byMeso.get(meso)!
      if (!ruts.has(rut)) ruts.set(rut, [])
      ruts.get(rut)!.push(bp)
    }
    const out: Slot[] = []
    for (const meso of [...byMeso.keys()].sort(sortNames)) {
      const ruts = byMeso.get(meso)!
      for (const rut of [...ruts.keys()].sort(sortNames)) {
        const list = ruts.get(rut)!.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'es'))
        if (rut) out.push({ key: `${meso}/${rut}`, meso, label: rut, variants: list })
        else for (const bp of list) out.push({ key: `${meso}/#${bp.id}`, meso, label: bp.name, variants: [bp] })
      }
    }
    return out
  }, [blueprints])

  const rows = useMemo(() => {
    let offset = 0
    return slots.map((slot) => {
      const bp = slot.variants.find((v) => v.id === variantBySlot[slot.key]) ?? slot.variants[0]!
      const weeks = payloadWeeks(bp)
      const row = { slot, bp, weeks, offset }
      offset += Math.max(weeks.length, 1)
      return row
    })
  }, [slots, variantBySlot])

  const totalWeeks = rows.reduce((n, r) => Math.max(n, r.offset + Math.max(r.weeks.length, 1)), 0)
  const editingRow = editing ? rows.find((r) => r.bp.id === editing.bpId) : null
  const editingWeek = editingRow && editing ? editingRow.weeks[editing.index] : null

  async function setPhase(bp: RoutineBlueprint, index: number, phase: string | null) {
    const p = (bp.payload && typeof bp.payload === 'object' && !Array.isArray(bp.payload) ? bp.payload : {}) as Record<string, unknown>
    const target = payloadWeeks(bp)[index]
    if (!target) return
    const blocks = (Array.isArray(p.blocks) ? (p.blocks as Week[]) : []).map((b) => (b === target ? { ...b, phase_type: phase } : b))
    const next = { ...p, blocks } as Json
    setSaving(true)
    const { error } = await supabase.from('routine_blueprints').update({ payload: next }).eq('id', bp.id)
    // La rutina de biblioteca (la que se edita) tiene las mismas semanas: se marca igual.
    const libId = !error ? blueprintLibraryRoutineId(bp) : null
    if (libId) {
      const { data: weeks } = await supabase.from('routine_blocks').select('id').eq('routine_id', libId).order('sort_order')
      const week = (weeks ?? [])[index] as { id: string } | undefined
      if (week) await supabase.from('routine_blocks').update({ phase_type: phase }).eq('id', week.id)
    }
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    onPayloadSaved(bp.id, next)
    setEditing(null)
  }

  return (
    <section className="mb-4 space-y-3 rounded-xl border border-surface-border bg-surface-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink-primary">Calendario · {macroName}</h3>
          <p className="text-2xs text-ink-muted">
            Las rutinas de cada mesociclo, una detrás de otra. Tocá una semana para marcar su fase: al asignar la rutina a un alumno, la fase
            pasa a su calendario con las fechas reales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-2xs text-ink-muted">
            Inicio de ejemplo
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || nextMonday())} className={cn(controlSmClassName, 'w-36')} />
          </label>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} title="Cerrar calendario">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {phaseTypes.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5 text-2xs text-ink-secondary">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
            {t.label}
          </span>
        ))}
        <button type="button" onClick={() => setPhasesOpen((v) => !v)} className="text-2xs font-medium text-ink-primary underline-offset-2 hover:underline">
          Editar fases
        </button>
      </div>
      {phasesOpen ? <PhaseTypesEditor phases={phaseTypes} onClose={() => setPhasesOpen(false)} /> : null}

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Este macrociclo todavía no tiene rutinas.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-surface-border">
          <div style={{ width: NAME_W + totalWeeks * CELL_W }}>
            <div className="flex border-b border-surface-border bg-surface-panel text-3xs text-ink-muted">
              <div className="sticky left-0 z-10 shrink-0 bg-surface-panel px-2 py-1.5" style={{ width: NAME_W }}>
                Rutina
              </div>
              {Array.from({ length: totalWeeks }, (_, i) => (
                <div key={i} className="shrink-0 border-l border-surface-border/60 px-1 py-1.5 text-center" style={{ width: CELL_W }}>
                  <span className="block font-semibold text-ink-secondary">S{i + 1}</span>
                  {short(weekDatesFromStart(startDate, i).start_date)}
                </div>
              ))}
            </div>
            {rows.map(({ slot, bp, weeks, offset }, rowIdx) => {
              const newMeso = rowIdx === 0 || rows[rowIdx - 1]!.slot.meso !== slot.meso
              return (
                <div key={slot.key}>
                  {newMeso ? (
                    <div className="sticky left-0 border-b border-surface-border/60 bg-surface-base px-2 py-1 text-3xs font-semibold text-ink-muted" style={{ width: NAME_W }}>
                      {slot.meso || 'Sin mesociclo'}
                    </div>
                  ) : null}
                  <div className="flex items-center border-b border-surface-border/60">
                    <div className="sticky left-0 z-10 shrink-0 bg-surface-card px-2 py-1.5" style={{ width: NAME_W }}>
                      <p className="truncate text-2xs font-medium text-ink-primary" title={slot.label}>
                        {slot.label}
                      </p>
                      {slot.variants.length > 1 ? (
                        <select
                          value={bp.id}
                          onChange={(e) => setVariantBySlot((m) => ({ ...m, [slot.key]: e.target.value }))}
                          className="mt-0.5 w-full truncate rounded border border-surface-border bg-surface-card px-1 text-3xs text-ink-secondary"
                          aria-label={`Variante de ${slot.label}`}
                        >
                          {slot.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                    <div className="shrink-0" style={{ width: offset * CELL_W }} />
                    {weeks.length === 0 ? (
                      <div className="shrink-0 px-1 py-1.5 text-3xs text-ink-muted" style={{ width: CELL_W }}>
                        sin semanas
                      </div>
                    ) : (
                      weeks.map((w, i) => {
                        const label = blockTypeLabel(w.phase_type)
                        const color = label ? blockColor(w.phase_type, null) : null
                        const active = editing?.bpId === bp.id && editing.index === i
                        return (
                          <div key={i} className="shrink-0 px-0.5 py-1" style={{ width: CELL_W }}>
                            <button
                              type="button"
                              onClick={() => setEditing(active ? null : { bpId: bp.id, index: i })}
                              className={cn(
                                'flex h-9 w-full flex-col items-center justify-center rounded-md border text-3xs leading-tight transition-colors',
                                color ? 'border-black/10 font-semibold text-zinc-900' : 'border-dashed border-surface-border text-ink-muted hover:bg-surface-elevated',
                                active && 'ring-2 ring-ink-primary',
                              )}
                              style={color ? { background: color } : undefined}
                              title={`${w.name}${label ? ` · ${label}` : ''}`}
                            >
                              <span>S{i + 1}</span>
                              {label ? <span className="max-w-full truncate px-0.5">{label}</span> : null}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editing && editingRow && editingWeek ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-surface-panel px-3 py-2">
          <span className="mr-1 text-2xs text-ink-secondary">
            <strong className="text-ink-primary">{editingRow.slot.label}</strong> · {editingWeek.name}:
          </span>
          {phaseTypes.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={saving}
              onClick={() => void setPhase(editingRow.bp, editing.index, t.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-2xs transition-colors',
                editingWeek.phase_type === t.id ? 'font-semibold text-ink-primary' : 'border-surface-border text-ink-secondary hover:text-ink-primary',
              )}
              style={editingWeek.phase_type === t.id ? { borderColor: t.color, background: `${t.color}26` } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} aria-hidden />
              {t.label}
            </button>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => void setPhase(editingRow.bp, editing.index, null)}
            className="rounded-md px-2 py-1 text-2xs text-ink-muted hover:text-ink-primary"
          >
            Sin fase
          </button>
        </div>
      ) : null}
    </section>
  )
}
