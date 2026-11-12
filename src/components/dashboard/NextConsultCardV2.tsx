import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { motion, useReducedMotion } from 'motion/react'
import { FolderOpen, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase'
import { useStudentStorageUrl } from '@/lib/studentAvatar'
import { cn, formatNumber } from '@/lib/utils'
import { startsInText, type SymptomFlag, type TodayAppointment } from '@/lib/dashboard/nutritionistToday'

const nf = (n: number) => formatNumber(n)
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
  avatarPath = null,
  now,
  onStart,
  onOpen,
}: {
  appointment: TodayAppointment
  inProgress: boolean
  later: TodayAppointment[]
  symptom: SymptomFlag | null
  avatarPath?: string | null
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
        .select('measured_at, weight_kg, body_fat_pct, muscle_mass_kg')
        .eq('student_id', sid!)
        .order('measured_at', { ascending: false })
        .limit(2)
      return (data ?? []) as { measured_at: string; weight_kg: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null }[]
    },
  })
  const [last, prev] = lastQ.data ?? []
  const delta = last?.weight_kg != null && prev?.weight_kg != null ? Math.round((last.weight_kg - prev.weight_kg) * 10) / 10 : null
  const diff = (cur: number | null | undefined, old: number | null | undefined) =>
    cur != null && old != null && Math.abs(cur - old) >= 0.05 ? Math.round((cur - old) * 10) / 10 : null
  const signed = (n: number | null, unit: string) => (n == null ? 'Igual que antes' : `${n > 0 ? '+' : '−'}${nf(Math.abs(n))} ${unit} vs. anterior`)
  const daysSince = last ? Math.max(0, Math.round((now.getTime() - parseISO(last.measured_at).getTime()) / 86_400_000)) : null
  const tiles: { label: string; value: string; unit?: string; hint: string; tone: string }[] = last
    ? [
        ...(last.weight_kg != null
          ? [{ label: 'Peso', value: nf(last.weight_kg), unit: 'kg', hint: signed(delta, 'kg'), tone: 'bg-pastel-mint text-pastel-mint-ink' }]
          : []),
        ...(last.body_fat_pct != null
          ? [{ label: 'Grasa', value: nf(last.body_fat_pct), unit: '%', hint: signed(diff(last.body_fat_pct, prev?.body_fat_pct), '%'), tone: 'bg-pastel-butter text-pastel-butter-ink' }]
          : []),
        ...(last.muscle_mass_kg != null
          ? [{ label: 'Masa muscular', value: nf(last.muscle_mass_kg), unit: 'kg', hint: signed(diff(last.muscle_mass_kg, prev?.muscle_mass_kg), 'kg'), tone: 'bg-pastel-peach text-pastel-peach-ink' }]
          : []),
        {
          label: 'Último control',
          value: daysSince === 0 ? 'Hoy' : String(daysSince),
          unit: daysSince === 0 ? undefined : daysSince === 1 ? 'día' : 'días',
          hint: format(parseISO(last.measured_at), 'dd/MM/yyyy'),
          tone: 'bg-pastel-lavender text-pastel-lavender-ink',
        },
      ]
    : []
  const context = !sid ? null : lastQ.isPending ? '…' : last ? null : 'Primera consulta: todavía no tiene controles'

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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <AvatarPhoto name={a.full_name} path={avatarPath} />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-ink-primary">{a.full_name}</h2>
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
        {tiles.length ? (
          <dl className={cn('mt-4 grid grid-cols-2 gap-2', tiles.length >= 4 ? 'sm:grid-cols-4' : tiles.length === 3 ? 'sm:grid-cols-3' : '')}>
            {tiles.map((t) => (
              <div key={t.label} className={cn('hh-pastel rounded-xl px-3.5 py-3', t.tone)}>
                <dt className="truncate text-xs opacity-80">{t.label}</dt>
                <dd className="mt-0.5 text-2xl font-semibold leading-tight tabular-nums tracking-tight">
                  {t.value}
                  {t.unit ? <span className="ml-1 text-sm font-normal opacity-80">{t.unit}</span> : null}
                </dd>
                <dd className="mt-0.5 truncate text-xs opacity-80">{t.hint}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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

/** Foto del paciente o sus iniciales, en grande. */
function AvatarPhoto({ name, path }: { name: string; path: string | null }) {
  const url = useStudentStorageUrl(path)
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-elevated text-xl font-semibold text-ink-secondary" aria-hidden>
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  )
}
