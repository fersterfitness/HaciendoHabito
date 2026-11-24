import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { controlSmClassName } from '@/lib/formControlClasses'
import { cn, formatDate } from '@/lib/utils'
import {
  COACH_NOTE_MAX,
  addCoachNoteItem,
  deleteCoachNoteItem,
  noteItemsFor,
  updateCoachNoteItem,
  useCoachNotes,
  type CoachNoteTarget,
} from '@/lib/routine/coachNotes'

/**
 * Feedback nov24 (tanda 2): notas para el alumno de un ejercicio de esta semana o de un circuito. Puede haber
 * varias; cada una muestra si el alumno ya marcó «Lo vi». Solo con la migración 20261127130000.
 */
export function CoachNoteItemsField({ target, label = 'Nota para el alumno' }: { target: CoachNoteTarget; label?: string }) {
  const ctx = useCoachNotes()
  // `null` = cerrado; '' = nota nueva; id = editando esa.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  if (!ctx || !ctx.items) return null
  const items = noteItemsFor(ctx.items, target)

  async function save() {
    if (!ctx || editing === null) return
    setBusy(true)
    try {
      const item = editing
        ? await updateCoachNoteItem(editing, draft)
        : await addCoachNoteItem(ctx.ownerId, ctx.studentId, target, draft)
      ctx.onItemSaved(item)
      toast.success('Nota guardada: el alumno la ve en su link')
      setEditing(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar la nota')
    }
    setBusy(false)
  }

  async function remove(id: string) {
    if (!ctx) return
    setBusy(true)
    try {
      await deleteCoachNoteItem(id)
      ctx.onItemDeleted(id)
      toast.success('Nota borrada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo borrar la nota')
    }
    setBusy(false)
  }

  const editor = (
    <div className="space-y-1 rounded-lg border border-surface-border p-2">
      <label className="block text-3xs text-ink-muted">{label} · solo en esta semana; el alumno marca «Lo vi»</label>
      <textarea
        rows={2}
        maxLength={COACH_NOTE_MAX}
        autoFocus
        className={cn(controlSmClassName, 'w-full px-2 py-1.5')}
        placeholder="Ej.: la próxima subí 2,5 kg y cuidá bajar lento"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)} disabled={busy}>Cancelar</Button>
        <Button size="sm" onClick={() => void save()} loading={busy} disabled={!draft.trim()}>Guardar nota</Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-1">
      {items.map((n) =>
        editing === n.id ? (
          <div key={n.id}>{editor}</div>
        ) : (
          <div key={n.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg bg-surface-elevated px-2.5 py-1.5 text-2xs text-ink-secondary">
            <span className="font-semibold text-ink-primary">{label}</span>
            <span className="whitespace-pre-line">«{n.note}»</span>
            <span className={n.seen_at ? 'text-status-active' : 'text-ink-muted'}>
              {n.seen_at ? `· la vio el ${formatDate(n.seen_at, 'd MMM')}` : '· todavía no la vio'}
            </span>
            <span className="ml-auto flex gap-1">
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setDraft(n.note); setEditing(n.id) }}>Editar</Button>
              <Button variant="ghost" size="sm" disabled={busy} className="text-ink-muted hover:text-status-expired" onClick={() => void remove(n.id)}>Borrar</Button>
            </span>
          </div>
        ),
      )}
      {editing === '' ? (
        editor
      ) : (
        <Button variant="ghost" size="sm" className="self-start text-ink-muted" onClick={() => { setDraft(''); setEditing('') }}>
          + {label}
        </Button>
      )}
    </div>
  )
}
