import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import type { NutritionClinicalNote } from '@/types/database'
import toast from 'react-hot-toast'

export function NutritionClinicalNotesSection({
  ownerId,
  studentId,
}: {
  ownerId: string
  studentId: string
}) {
  const [rows, setRows] = useState<NutritionClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('nutrition_clinical_notes')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('student_id', studentId)
      .order('occurred_at', { ascending: false })
      .limit(40)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((data as NutritionClinicalNote[]) ?? [])
  }

  useEffect(() => {
    void load()
  }, [ownerId, studentId])

  async function addNote() {
    if (!title.trim() && !body.trim()) {
      toast.error('Completá al menos título o texto')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('nutrition_clinical_notes')
      .insert({
        owner_id: ownerId,
        student_id: studentId,
        occurred_at: occurredAt,
        title: title.trim() || 'Nota',
        body: body.trim() || '',
      })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => [data as NutritionClinicalNote, ...prev])
    setTitle('')
    setBody('')
    toast.success('Nota guardada')
  }

  async function remove(id: string) {
    if (!window.confirm('¿Eliminar esta nota del historial?')) return
    const { error } = await supabase.from('nutrition_clinical_notes').delete().eq('id', id).eq('owner_id', ownerId)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Input label="Fecha" type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        <Input label="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Consulta inicial" />
      </div>
      <Textarea label="Historial / observaciones" rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Objetivos, acuerdos, recordatorios clínicos…" />
      <Button size="sm" type="button" onClick={() => void addNote()} loading={saving}>
        Agregar al historial
      </Button>

      <div className="border-t border-surface-border pt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Últimas entradas</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Todavía no hay notas en el historial.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-surface-border px-3 py-2 flex gap-2 justify-between items-start">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink-primary">
                  {format(parseISO(r.occurred_at), 'dd/MM/yyyy')} · {r.title}
                </p>
                {r.body ? <p className="text-xs text-ink-secondary mt-1 whitespace-pre-wrap">{r.body}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void remove(r.id)}
                className="text-[11px] text-ink-muted hover:text-status-expired shrink-0"
              >
                Borrar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
