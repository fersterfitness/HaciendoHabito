import { useQuery } from '@tanstack/react-query'
import { differenceInCalendarDays, format } from 'date-fns'
import { es } from 'date-fns/locale'
import { motion, useReducedMotion } from 'motion/react'
import { CalendarClock, CalendarPlus, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'

type Row = {
  id: string
  student_id: string | null
  title: string | null
  starts_at: string
  ends_at: string | null
  student?: { full_name?: string | null } | null
}

const hhmm = (iso: string) => format(new Date(iso), 'HH:mm')

/** «mañana», «el lunes 16 de noviembre». */
function dayText(startsAt: string, now: Date): string {
  const d = new Date(startsAt)
  const days = differenceInCalendarDays(d, now)
  if (days === 1) return 'mañana'
  return `el ${format(d, "EEEE d 'de' MMMM", { locale: es })}`
}

/**
 * v2 · Inicio del nutricionista en un día sin consultas por delante: el próximo turno de la agenda
 * (de mañana en adelante), o la invitación a agendar si no hay ninguno.
 */
export function UpcomingConsultCardV2({ ownerId, onGo }: { ownerId: string; onGo: (href: string) => void }) {
  const reduce = useReducedMotion()
  const now = new Date()
  const today = format(now, 'yyyy-MM-dd')
  const q = useQuery({
    queryKey: ['v2', 'upcoming-consult', ownerId, today],
    queryFn: async () => {
      const tomorrow = new Date(new Date(`${today}T00:00:00`).getTime() + 86_400_000)
      const { data } = await supabase
        .from('appointments')
        .select('id, student_id, title, starts_at, ends_at, student:students(full_name)')
        .eq('owner_id', ownerId)
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', tomorrow.toISOString())
        .order('starts_at')
        .limit(1)
      return ((data ?? []) as unknown as Row[])[0] ?? null
    },
    staleTime: 30_000,
  })

  if (q.isPending) return null
  const a = q.data ?? null
  const days = a ? differenceInCalendarDays(new Date(a.starts_at), now) : 0
  const name = a ? (a.student?.full_name ?? a.title ?? 'Turno') : ''

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      aria-label="Próximo turno"
      className="rounded-2xl border border-surface-border bg-surface-card px-5 py-4"
    >
      <p className="flex items-center gap-2 text-xs font-medium text-ink-secondary">
        <CalendarClock className="h-4 w-4" />
        {a ? `Hoy no quedan consultas · la próxima es ${dayText(a.starts_at, now)}` : 'Hoy no quedan consultas'}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {a ? (
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="hh-pastel flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-pastel-sky text-pastel-sky-ink" aria-hidden>
              <span className="text-2xs capitalize leading-none opacity-80">{format(new Date(a.starts_at), 'EEE', { locale: es }).replace('.', '')}</span>
              <span className="mt-0.5 text-xl font-semibold leading-none tabular-nums">{format(new Date(a.starts_at), 'd')}</span>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-ink-primary">{name}</h2>
              <p className="mt-0.5 text-sm tabular-nums text-ink-secondary">
                {hhmm(a.starts_at)}
                {a.ends_at ? ` – ${hhmm(a.ends_at)}` : ''}
                {a.student?.full_name && a.title ? ` · ${a.title}` : ''}
                {days > 1 ? ` · en ${days} días` : ''}
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-ink-primary">No tenés turnos agendados</h2>
            <p className="mt-0.5 text-sm text-ink-secondary">Cuando agendes uno, lo vas a ver acá con los datos del paciente.</p>
          </div>
        )}
        <div className="flex shrink-0 gap-2">
          {a?.student_id ? (
            <Button variant="secondary" size="sm" icon={<FolderOpen className="h-4 w-4" />} onClick={() => onGo(`/nutrition/${a.student_id}`)}>
              Carpeta
            </Button>
          ) : null}
          <Button
            variant={a ? 'secondary' : 'primary'}
            size="sm"
            icon={a ? <CalendarClock className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
            onClick={() => onGo('/appointments')}
          >
            {a ? 'Ver agenda' : 'Agendar turno'}
          </Button>
        </div>
      </div>
    </motion.section>
  )
}
