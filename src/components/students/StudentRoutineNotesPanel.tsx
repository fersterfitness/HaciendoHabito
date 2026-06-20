import { useEffect, useState } from 'react'
import { Plus, X, Check, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import type { StudentRoutineNote } from '@/types/database'
import toast from 'react-hot-toast'

/**
 * Notas importantes del alumno para tener en cuenta al armar la próxima rutina.
 * Ej.: "Trabajar movilidad lumbo-pélvica (reportó dolor lumbar en semana 4)".
 */
export function StudentRoutineNotesPanel({ studentId }: { studentId: string }) {
  const { user } = useAuthStore()
  const [notes, setNotes] = useState<StudentRoutineNote[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('student_routine_notes')
      .select('*')
      .eq('student_id', studentId)
      .order('is_done', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return
        setNotes((data as StudentRoutineNote[]) ?? [])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  async function addNote() {
    const content = draft.trim()
    if (!content || !user) return
    setSaving(true)
    const { data, error } = await supabase
      .from('student_routine_notes')
      .insert({ owner_id: user.id, student_id: studentId, content })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setNotes((prev) => [data as StudentRoutineNote, ...prev])
    setDraft('')
  }

  async function toggleDone(note: StudentRoutineNote) {
    const is_done = !note.is_done
    const done_at = is_done ? new Date().toISOString() : null
    setNotes((prev) =>
      [...prev.map((n) => (n.id === note.id ? { ...n, is_done, done_at } : n))].sort(
        (a, b) => Number(a.is_done) - Number(b.is_done) || b.created_at.localeCompare(a.created_at),
      ),
    )
    const { error } = await supabase
      .from('student_routine_notes')
      .update({ is_done, done_at })
      .eq('id', note.id)
    if (error) toast.error(error.message)
  }

  async function remove(noteId: string) {
    const prev = notes
    setNotes((p) => p.filter((n) => n.id !== noteId))
    const { error } = await supabase.from('student_routine_notes').delete().eq('id', noteId)
    if (error) {
      setNotes(prev)
      toast.error(error.message)
    }
  }

  const pending = notes.filter((n) => !n.is_done)

  return (
    <section className="rounded-2xl border border-amber-300/50 bg-amber-50/50 p-4 dark:border-amber-700/40 dark:bg-amber-950/15">
      <div className="mb-3 flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Notas para la próxima rutina
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
              {pending.length} pendiente{pending.length > 1 ? 's' : ''}
            </span>
          )}
        </h3>
      </div>

      <div className="mb-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void addNote()
            }
          }}
          placeholder="ej: trabajar movilidad lumbo-pélvica…"
          className="flex-1 rounded-xl border border-amber-300/60 bg-white px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-amber-500 dark:border-amber-700/50 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <Button size="sm" variant="secondary" loading={saving} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => void addNote()}>
          Anotar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : notes.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-500">Sin notas. Anotá lo que quieras trabajar en la próxima rutina.</p>
      ) : (
        <ul className="space-y-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start gap-2 rounded-lg border border-amber-200/50 bg-white/70 px-2.5 py-2 dark:border-amber-800/30 dark:bg-zinc-900/40"
            >
              <button
                type="button"
                onClick={() => void toggleDone(n)}
                title={n.is_done ? 'Marcar como pendiente' : 'Marcar como resuelta'}
                className={
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ' +
                  (n.is_done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-zinc-400 hover:border-emerald-500 dark:border-zinc-600')
                }
              >
                {n.is_done && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={'text-[13px] leading-snug ' + (n.is_done ? 'text-zinc-400 line-through dark:text-zinc-600' : 'text-zinc-800 dark:text-zinc-100')}>
                  {n.content}
                </p>
                <p className="text-[10px] text-zinc-400">{formatDate(n.created_at.slice(0, 10))}</p>
              </div>
              <button
                type="button"
                onClick={() => void remove(n.id)}
                className="mt-0.5 shrink-0 text-zinc-400 transition-colors hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
