import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { controlSmClassName } from '@/lib/formControlClasses'
import { Button } from '@/components/ui/Button'
import { ListSkeleton } from '@/components/ui/Skeleton'
import type { NutritionSymptomCheckin } from '@/types/database'

const ADHERENCE_LABEL = ['', 'Muy baja', 'Baja', 'Media', 'Buena', 'Muy buena']

/** Escala de botones: se elige tocando; tocar el elegido lo deja vacío ("no aplica"). */
function Scale({
  label,
  hint,
  from,
  to,
  value,
  onChange,
  alertAt,
}: {
  label: string
  hint: string
  from: number
  to: number
  value: number | null
  onChange: (v: number | null) => void
  alertAt: (v: number) => boolean
}) {
  const steps = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-secondary">{label}</p>
        <p className="text-[11px] text-ink-muted">{hint}</p>
      </div>
      <div role="radiogroup" aria-label={label} className="flex gap-1">
        {steps.map((n) => {
          const on = value === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : n)}
              className={cn(
                'h-8 min-w-0 flex-1 rounded-lg text-[12px] font-medium tabular-nums transition-colors',
                on
                  ? alertAt(n)
                    ? 'bg-status-expired text-white'
                    : 'bg-ink-primary text-surface-card'
                  : 'bg-surface-elevated/70 text-ink-secondary hover:bg-surface-elevated hover:text-ink-primary',
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Barras de los últimos registros (de más viejo a más nuevo); en rojo los que piden atención. */
function Trend({ label, values, max, alertAt, last }: { label: string; values: (number | null)[]; max: number; alertAt: (v: number) => boolean; last: string }) {
  if (!values.some((v) => v != null)) return null
  return (
    <div className="rounded-xl bg-surface-elevated/50 px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] text-ink-muted">{label}</p>
        <p className="text-[13px] font-semibold tabular-nums text-ink-primary">{last}</p>
      </div>
      <div className="mt-2 flex h-8 items-end gap-[3px]" aria-hidden>
        {values.map((v, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-sm', v == null ? 'h-[2px] bg-surface-border' : alertAt(v) ? 'bg-status-expired' : 'bg-ink-primary/70')}
            style={v == null ? undefined : { height: `${Math.max(8, (v / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * v2: registro entre consultas en un toque (dos escalas y una nota), con la tendencia de los últimos
 * registros arriba para ver de un vistazo si algo empeoró.
 */
export function NutritionSymptomCheckinsV2({ ownerId, studentId }: { ownerId: string; studentId: string }) {
  const [rows, setRows] = useState<NutritionSymptomCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedAt, setLoggedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [digest, setDigest] = useState<number | null>(null)
  const [adherence, setAdherence] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    void supabase
      .from('nutrition_symptom_checkins')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('student_id', studentId)
      .order('logged_at', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!alive) return
        setLoading(false)
        if (error) toast.error(error.message)
        else setRows((data as NutritionSymptomCheckin[]) ?? [])
      })
    return () => {
      alive = false
    }
  }, [ownerId, studentId])

  const recent = useMemo(() => rows.slice(0, 12).reverse(), [rows])
  const lastDigest = rows.find((r) => r.digestive_discomfort_0_10 != null)?.digestive_discomfort_0_10
  const lastAdh = rows.find((r) => r.adherence_1_5 != null)?.adherence_1_5

  async function add() {
    if (digest == null && adherence == null && !notes.trim()) {
      toast.error('Elegí un valor o escribí una nota')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('nutrition_symptom_checkins')
      .insert({
        owner_id: ownerId,
        student_id: studentId,
        logged_at: loggedAt,
        digestive_discomfort_0_10: digest,
        adherence_1_5: adherence,
        notes: notes.trim() || null,
      })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setRows((prev) => [data as NutritionSymptomCheckin, ...prev].sort((a, b) => b.logged_at.localeCompare(a.logged_at)))
    setDigest(null)
    setAdherence(null)
    setNotes('')
    toast.success('Registro guardado')
  }

  return (
    <div className="space-y-5">
      {recent.length ? (
        <div className="grid grid-cols-2 gap-2">
          <Trend
            label="Malestar digestivo"
            values={recent.map((r) => r.digestive_discomfort_0_10)}
            max={10}
            alertAt={(v) => v >= 7}
            last={lastDigest != null ? `${lastDigest}/10` : '—'}
          />
          <Trend
            label="Adherencia"
            values={recent.map((r) => r.adherence_1_5)}
            max={5}
            alertAt={(v) => v <= 2}
            last={lastAdh != null ? ADHERENCE_LABEL[lastAdh]! : '—'}
          />
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-surface-border bg-surface-panel p-4">
        <Scale label="Malestar digestivo" hint="0 nada · 10 mucho" from={0} to={10} value={digest} onChange={setDigest} alertAt={(v) => v >= 7} />
        <Scale label="Adherencia al plan" hint="1 muy baja · 5 muy buena" from={1} to={5} value={adherence} onChange={setAdherence} alertAt={(v) => v <= 2} />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota (opcional): síntomas, contexto…"
          aria-label="Nota"
          className={cn(controlSmClassName, 'h-9 w-full bg-surface-card text-[13px]')}
        />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={loggedAt}
            onChange={(e) => setLoggedAt(e.target.value)}
            aria-label="Fecha del registro"
            className={cn(controlSmClassName, 'w-[8.5rem] bg-surface-card')}
          />
          <Button size="sm" type="button" className="ml-auto" onClick={() => void add()} loading={saving}>
            Guardar registro
          </Button>
        </div>
      </div>

      {loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-ink-muted">Sin registros todavía.</p>
      ) : (
        <ul className="divide-y divide-surface-border/70">
          {rows.map((r) => (
            <li key={r.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-14 text-[12px] font-medium tabular-nums text-ink-primary">{format(parseISO(r.logged_at), 'd MMM', { locale: es })}</span>
                {r.digestive_discomfort_0_10 != null ? (
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums', r.digestive_discomfort_0_10 >= 7 ? 'bg-status-expired/10 text-status-expired' : 'bg-surface-elevated text-ink-secondary')}>
                    Digestivo {r.digestive_discomfort_0_10}/10
                  </span>
                ) : null}
                {r.adherence_1_5 != null ? (
                  <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', r.adherence_1_5 <= 2 ? 'bg-status-expired/10 text-status-expired' : 'bg-surface-elevated text-ink-secondary')}>
                    Adherencia {ADHERENCE_LABEL[r.adherence_1_5]?.toLowerCase()}
                  </span>
                ) : null}
              </div>
              {r.notes ? <p className="mt-1 pl-16 text-[12.5px] text-ink-muted">{r.notes}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
