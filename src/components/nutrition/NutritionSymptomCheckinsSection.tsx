import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import type { NutritionSymptomCheckin } from '@/types/database'
import toast from 'react-hot-toast'

export function NutritionSymptomCheckinsSection({
  ownerId,
  studentId,
}: {
  ownerId: string
  studentId: string
}) {
  const [rows, setRows] = useState<NutritionSymptomCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedAt, setLoggedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [digest, setDigest] = useState('')
  const [adherence, setAdherence] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('nutrition_symptom_checkins')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('student_id', studentId)
      .order('logged_at', { ascending: false })
      .limit(30)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((data as NutritionSymptomCheckin[]) ?? [])
  }

  useEffect(() => {
    void load()
  }, [ownerId, studentId])

  async function add() {
    const d = digest.trim() ? Number.parseInt(digest, 10) : null
    const a = adherence.trim() ? Number.parseInt(adherence, 10) : null
    if (d != null && (d < 0 || d > 10)) {
      toast.error('Malestar digestivo: 0 a 10 o vacío')
      return
    }
    if (a != null && (a < 1 || a > 5)) {
      toast.error('Adherencia: 1 a 5 o vacío')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('nutrition_symptom_checkins')
      .insert({
        owner_id: ownerId,
        student_id: studentId,
        logged_at: loggedAt,
        digestive_discomfort_0_10: d,
        adherence_1_5: a,
        notes: notes.trim() || null,
      })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => [data as NutritionSymptomCheckin, ...prev])
    setDigest('')
    setAdherence('')
    setNotes('')
    toast.success('Registro guardado')
  }

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <Input label="Fecha" type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} />
        <Input
          label="Malestar digestivo (0–10)"
          value={digest}
          onChange={(e) => setDigest(e.target.value.replace(/\D/g, '').slice(0, 2))}
          placeholder="Vacío = no aplica"
        />
        <Input
          label="Adherencia al plan (1–5)"
          value={adherence}
          onChange={(e) => setAdherence(e.target.value.replace(/\D/g, '').slice(0, 1))}
          placeholder="Vacío = no aplica"
        />
      </div>
      <Textarea label="Notas" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Síntomas, contexto…" />
      <Button size="sm" type="button" onClick={() => void add()} loading={saving}>
        Guardar check-in
      </Button>

      <div className="border-t border-surface-border pt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Registros recientes</p>
        {loading ? (
          <p className="text-sm text-ink-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Sin check-ins todavía.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-surface-border px-3 py-2 text-xs text-ink-secondary">
              <span className="font-semibold text-ink-primary">{format(parseISO(r.logged_at), 'dd/MM/yyyy')}</span>
              {r.digestive_discomfort_0_10 != null ? ` · Digestivo ${r.digestive_discomfort_0_10}/10` : ''}
              {r.adherence_1_5 != null ? ` · Adherencia ${r.adherence_1_5}/5` : ''}
              {r.notes ? <p className="mt-1 text-ink-muted whitespace-pre-wrap">{r.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
