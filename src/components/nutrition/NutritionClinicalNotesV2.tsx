import { useEffect, useState } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { controlSmClassName } from '@/lib/formControlClasses'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import { confirmDialog } from '@/components/ui/dialogs'
import type { NutritionClinicalNote } from '@/types/database'

function ago(iso: string) {
  const d = differenceInCalendarDays(new Date(), parseISO(iso))
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 14) return `hace ${d} días`
  if (d < 60) return `hace ${Math.round(d / 7)} semanas`
  if (d < 365) return `hace ${Math.round(d / 30)} meses`
  const y = Math.round(d / 365)
  return y === 1 ? 'hace 1 año' : `hace ${y} años`
}

/**
 * v2: notas de consulta como línea de tiempo. Arriba una sola caja para escribir (fecha y título
 * opcionales al lado del botón); abajo las notas, de la más nueva a la más vieja.
 */
export function NutritionClinicalNotesV2({ ownerId, studentId }: { ownerId: string; studentId: string }) {
  const [rows, setRows] = useState<NutritionClinicalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void supabase
      .from('nutrition_clinical_notes')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('student_id', studentId)
      .order('occurred_at', { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (!alive) return
        setLoading(false)
        if (error) toast.error(error.message)
        else setRows((data as NutritionClinicalNote[]) ?? [])
      })
    return () => {
      alive = false
    }
  }, [ownerId, studentId])

  async function addNote() {
    if (!title.trim() && !body.trim()) {
      toast.error('Escribí la nota')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('nutrition_clinical_notes')
      .insert({ owner_id: ownerId, student_id: studentId, occurred_at: occurredAt, title: title.trim() || 'Nota', body: body.trim() })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const next = data as NutritionClinicalNote
    setRows((prev) => [next, ...prev].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)))
    setTitle('')
    setBody('')
    toast.success('Nota guardada')
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: '¿Eliminar esta nota?', confirmLabel: 'Eliminar' }))) return
    const { error } = await supabase.from('nutrition_clinical_notes').delete().eq('id', id).eq('owner_id', ownerId)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-border bg-surface-panel transition-colors focus-within:border-ink-muted/50">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void addNote()
          }}
          rows={3}
          placeholder="¿Qué pasó en esta consulta? Objetivos, acuerdos, cambios…"
          aria-label="Nota de consulta"
          className="block w-full resize-y bg-transparent px-4 pt-3.5 text-[14px] leading-relaxed text-ink-primary placeholder:text-ink-muted focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
          <input
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            aria-label="Fecha de la consulta"
            className={cn(controlSmClassName, 'w-[8.5rem] bg-surface-card')}
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título (opcional)"
            aria-label="Título"
            className={cn(controlSmClassName, 'min-w-0 flex-1 bg-surface-card sm:max-w-[16rem]')}
          />
          <span className="ml-auto hidden text-[11px] text-ink-muted md:inline">Ctrl + Enter</span>
          <Button size="sm" type="button" onClick={() => void addNote()} loading={saving} disabled={!body.trim() && !title.trim()}>
            Agregar nota
          </Button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-muted">Todavía no hay notas. La primera queda como inicio del historial.</p>
      ) : (
        <ol className="relative">
          {rows.map((r, i) => {
            const d = parseISO(r.occurred_at)
            const showYear = i === 0 || rows[i - 1]!.occurred_at.slice(0, 4) !== r.occurred_at.slice(0, 4)
            return (
              <li key={r.id}>
                {showYear && i > 0 ? (
                  <p className="mb-3 ml-[7.75rem] text-[11px] font-semibold tabular-nums text-ink-muted">{format(d, 'yyyy')}</p>
                ) : null}
                <div className="group relative flex gap-4 pb-6 last:pb-0">
                  <div className="w-[5.75rem] shrink-0 whitespace-nowrap pt-0.5 text-right">
                    <p className="text-[13px] font-semibold tabular-nums text-ink-primary">{format(d, 'd MMM', { locale: es })}</p>
                    <p className="text-[11px] text-ink-muted">{ago(r.occurred_at)}</p>
                  </div>
                  <div className="relative flex flex-col items-center">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2', i === 0 ? 'border-ink-primary bg-ink-primary' : 'border-ink-muted/60 bg-surface-card')} />
                    {i < rows.length - 1 ? <span className="mt-1 w-px flex-1 bg-surface-border" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="relative pr-8">
                      <p className="text-[14px] font-medium text-ink-primary">{r.title}</p>
                      <button
                        type="button"
                        onClick={() => void remove(r.id)}
                        aria-label="Eliminar nota"
                        title="Eliminar"
                        className="absolute -top-1 right-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted opacity-0 transition hover:bg-surface-elevated hover:text-status-expired focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {r.body ? <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-secondary">{r.body}</p> : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
