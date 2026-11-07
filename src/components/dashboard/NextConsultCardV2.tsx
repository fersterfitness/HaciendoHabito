import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { motion, useReducedMotion } from 'motion/react'
import { FolderOpen, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { startsInText, type SymptomFlag, type TodayAppointment } from '@/lib/dashboard/nutritionistToday'

const nf = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 })
const hhmm = (iso: string) => format(new Date(iso), 'HH:mm')

/**
 * v2 · Inicio del nutricionista: la consulta que viene (o la que está en curso), con lo que conviene
 * saber antes de entrar y el botón para arrancar la consulta.
 */
export function NextConsultCardV2({
  appointment: a,
  inProgress,
  later,
  symptom,
  now,
  onStart,
  onOpen,
}: {
  appointment: TodayAppointment
  inProgress: boolean
  later: TodayAppointment[]
  symptom: SymptomFlag | null
  now: Date
  onStart: () => void
  onOpen: () => void
}) {
  const reduce = useReducedMotion()
  const sid = a.student_id
  // Los dos últimos controles: fecha y cómo viene el peso.
  const lastQ = useQuery({
    queryKey: ['v2', 'next-consult-last-control', sid],
    enabled: Boolean(sid),
    queryFn: async () => {
      const { data } = await supabase
        .from('nutrition_measurements')
        .select('measured_at, weight_kg')
        .eq('student_id', sid!)
        .order('measured_at', { ascending: false })
        .limit(2)
      return (data ?? []) as { measured_at: string; weight_kg: number | null }[]
    },
  })
  const [last, prev] = lastQ.data ?? []
  const delta = last?.weight_kg != null && prev?.weight_kg != null ? Math.round((last.weight_kg - prev.weight_kg) * 10) / 10 : null
  const context = !sid
    ? null
    : lastQ.isPending
      ? '…'
      : last
        ? `Último control ${format(parseISO(last.measured_at), 'dd/MM')}${last.weight_kg != null ? ` · ${nf(last.weight_kg)} kg` : ''}${
            delta != null && delta !== 0 ? ` (${delta > 0 ? '+' : '−'}${nf(Math.abs(delta))} kg)` : ''
          }`
        : 'Primera consulta: todavía no tiene controles'

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className="relative overflow-hidden rounded-2xl border border-surface-border bg-surface-card"
      aria-label="Próxima consulta"
    >
      {/* Brillo suave que se mueve de un lado a otro (decorativo). */}
      {reduce ? null : (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-pastel-sky/40 to-transparent dark:via-white/[0.04]"
          initial={{ x: '-120%' }}
          animate={{ x: '360%' }}
          transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 4 }}
        />
      )}
      <div className="relative px-5 pb-4 pt-4">
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-ink-secondary">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping', inProgress ? 'bg-status-active' : 'bg-pastel-peach-accent')} />
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', inProgress ? 'bg-status-active' : 'bg-pastel-peach-accent')} />
          </span>
          {inProgress ? 'En curso' : 'Próxima consulta'} · {startsInText(a.starts_at, now)}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">{a.full_name}</h2>
            <p className="mt-0.5 text-[13px] tabular-nums text-ink-secondary">
              {hhmm(a.starts_at)}
              {a.ends_at ? ` – ${hhmm(a.ends_at)}` : ''}
              {a.title ? ` · ${a.title}` : ''}
            </p>
            {context ? <p className="mt-1.5 text-[13px] text-ink-muted">{context}</p> : null}
            {symptom ? (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-pastel-rose px-2.5 py-0.5 text-[12px] font-medium text-pastel-rose-ink">
                {symptom.detail} en su último registro
              </p>
            ) : null}
          </div>
          {sid ? (
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" icon={<FolderOpen className="h-4 w-4" />} onClick={onOpen}>
                Carpeta
              </Button>
              <Button size="sm" icon={<Stethoscope className="h-4 w-4" />} onClick={onStart}>
                Iniciar consulta
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {later.length ? (
        <p className="relative truncate border-t border-dashed border-surface-border px-5 py-2.5 text-[12.5px] text-ink-muted">
          Después:{' '}
          {later
            .slice(0, 4)
            .map((l) => `${hhmm(l.starts_at)} ${l.full_name.split(/\s+/)[0]}`)
            .join(' · ')}
          {later.length > 4 ? ` y ${later.length - 4} más` : ''}
        </p>
      ) : null}
    </motion.section>
  )
}
