import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { HeartPulse, NotebookPen, Ruler } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { NutritionMeasurement } from '@/types/database'

const day = (ymd: string) => format(parseISO(ymd.slice(0, 10)), "d 'de' MMM", { locale: es })

function ago(ymd: string, today: Date) {
  const d = differenceInCalendarDays(today, parseISO(ymd.slice(0, 10)))
  if (d <= 0) return 'hoy'
  if (d === 1) return 'ayer'
  if (d < 14) return `hace ${d} días`
  if (d < 60) return `hace ${Math.round(d / 7)} semanas`
  return `hace ${Math.round(d / 30)} meses`
}

/**
 * Antes de empezar la consulta: lo que conviene tener fresco en 10 segundos (la última nota, cómo
 * viene su semana y cuándo fue el último control), sin abrir otras pestañas.
 */
export function ConsultBriefing({ ownerId, studentId, measurements }: { ownerId: string; studentId: string; measurements: NutritionMeasurement[] }) {
  const today = new Date()
  const q = useQuery({
    queryKey: ['consult-briefing', ownerId, studentId],
    queryFn: async () => {
      const since = format(new Date(Date.now() - 14 * 86_400_000), 'yyyy-MM-dd')
      const [note, checkin] = await Promise.all([
        supabase
          .from('nutrition_clinical_notes')
          .select('occurred_at, body')
          .eq('owner_id', ownerId)
          .eq('student_id', studentId)
          .order('occurred_at', { ascending: false })
          .limit(1),
        supabase
          .from('nutrition_symptom_checkins')
          .select('logged_at, digestive_discomfort_0_10, adherence_1_5, notes')
          .eq('owner_id', ownerId)
          .eq('student_id', studentId)
          .gte('logged_at', since)
          .order('logged_at', { ascending: false })
          .limit(1),
      ])
      return {
        note: ((note.data ?? [])[0] ?? null) as { occurred_at: string; body: string } | null,
        checkin: ((checkin.data ?? [])[0] ?? null) as {
          logged_at: string
          digestive_discomfort_0_10: number | null
          adherence_1_5: number | null
          notes: string | null
        } | null,
      }
    },
    staleTime: 60_000,
  })

  if (q.isPending) return <div className="mb-5 h-20 animate-pulse rounded-2xl bg-surface-elevated/60" aria-hidden />

  const items: { icon: LucideIcon; label: string; when: string; text: string; alert?: boolean }[] = []
  const n = q.data?.note
  if (n) items.push({ icon: NotebookPen, label: 'Última nota', when: day(n.occurred_at), text: n.body.replace(/\s+/g, ' ').trim() })
  const c = q.data?.checkin
  if (c) {
    const parts: string[] = []
    if (c.digestive_discomfort_0_10 != null) parts.push(`malestar ${c.digestive_discomfort_0_10}/10`)
    if (c.adherence_1_5 != null) parts.push(`adherencia ${c.adherence_1_5}/5`)
    const text = [parts.join(' · '), c.notes?.trim()].filter(Boolean).join('. ')
    const alert = (c.digestive_discomfort_0_10 ?? 0) >= 7 || (c.adherence_1_5 ?? 5) <= 2
    items.push({ icon: HeartPulse, label: 'Su registro', when: ago(c.logged_at, today), text: text.charAt(0).toUpperCase() + text.slice(1), alert })
  }
  const m = measurements[0]
  if (m) items.push({ icon: Ruler, label: 'Último control', when: ago(m.measured_at, today), text: `El ${day(m.measured_at)}. ${measurements.length} ${measurements.length === 1 ? 'control' : 'controles'} en total.` })

  if (!items.length) return null

  return (
    <section aria-label="Antes de empezar" className="mb-6">
      <p className="mb-2 text-[12px] font-medium text-ink-muted">Antes de empezar</p>
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((it) => {
          const Icon = it.icon
          return (
            <div
              key={it.label}
              className={cn('rounded-2xl border bg-surface-card px-4 py-3', it.alert ? 'border-pastel-rose-accent/50' : 'border-surface-border')}
            >
              <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <Icon className={cn('h-3.5 w-3.5', it.alert && 'text-pastel-rose-accent')} />
                <span className="font-medium text-ink-secondary">{it.label}</span>· {it.when}
              </p>
              <p className="mt-1 line-clamp-3 text-[13.5px] leading-snug text-ink-primary" title={it.text}>
                {it.text}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
