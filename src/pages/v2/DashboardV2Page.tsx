import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  LayoutGrid,
  MessageSquare,
  Plus,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import {
  AvatarV2,
  CardV2,
  GreetingV2,
  MetaChipV2,
  PageV2,
  PillButtonV2,
  PulseCardV2,
  SectionTitleV2,
  SegmentedV2,
  StatStripV2,
  TagV2,
  TaskCardV2,
} from '@/components/v2/ui'
import { TopBarV2 } from '@/components/v2/TopBarV2'
import { birthdayMessage } from '@/components/dashboard/BirthdayGreetings'
import { PriceIncreaseNotice } from '@/components/dashboard/PriceIncreaseNotice'
import { NutritionistOpsPanel } from '@/components/dashboard/NutritionistOpsPanel'
import { RoutinePaymentsPanel } from '@/components/finances/RoutinePaymentsPanel'
import { WebIntakeAccessRequestsPanel } from '@/components/settings/WebIntakeAccessRequestsPanel'
import { canSeeTraining } from '@/config/navigation'
import { markReminderSent, useActiveStudents, useIncomes, useSentReminders } from '@/data/finance'
import { fetchRoutineList, routineKeys } from '@/data/routines'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { loadStudentsMissingCheckIn } from '@/lib/dashboard/dashboardTrainerOps'
import { loadWeeklyPeriodStartYmd, weeklyPeriodMondayUtc } from '@/lib/checkIn/weeklyPeriod'
import { buildPaymentBoard, monthKey, reminderMessage, type StudentPaymentRow } from '@/lib/finance/studentPayments'
import { supabase } from '@/lib/supabase'
import { TRAINER_WEEKLY_REMINDERS, isTrainerReminderHighlightedToday } from '@/lib/trainerWeeklyReminders'
import { copyWhatsAppMessage, normalizePhoneForWhatsApp, shareToWhatsApp, WHATSAPP_DIRECT_PASTE_HINT } from '@/lib/whatsapp'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

type AppointmentLite = {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  status: string
  student?: { full_name?: string | null } | null
}

type Filter = 'all' | 'cobros' | 'feedback' | 'rutinas' | 'semana'

const DAY_MS = 86_400_000

/** Copy de los avisos semanales del entrenador (los mismos que el Inicio anterior). */
const WEEKLY_COPY: Record<string, { title: string; meta: string; cta: string; href: string }> = {
  'checkins-send-friday': {
    title: 'Hoy es viernes: mandá el feedback semanal',
    meta: 'Link general al grupo o uno por alumno desde Consulta semanal',
    cta: 'Ir a enviar',
    href: '/feedback',
  },
  'off-context-wednesday': {
    title: 'Hoy es miércoles: Saliendo de contexto',
    meta: 'Armá el hilo de la semana',
    cta: 'Armar el hilo',
    href: '/contexto',
  },
}

const doneKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function isDone(id: string): boolean {
  try {
    return localStorage.getItem(`hh-reminder-done:${id}`) === doneKey()
  } catch {
    return false
  }
}

function daysToBirthday(birthDate: string, today: Date): number {
  const [, m, d] = birthDate.slice(0, 10).split('-').map(Number)
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let next = new Date(today.getFullYear(), (m ?? 1) - 1, d ?? 1)
  if (next < t0) next = new Date(today.getFullYear() + 1, (m ?? 1) - 1, d ?? 1)
  return Math.round((next.getTime() - t0.getTime()) / DAY_MS)
}

function daysFromToday(ymd: string, today: Date): number {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number)
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((new Date(y!, m! - 1, d!).getTime() - t0.getTime()) / DAY_MS)
}

const fmtDay = (ymd: string | null) => (ymd ? format(new Date(`${ymd}T12:00:00`), 'd/MM') : '')
const firstName = (full: string | null | undefined) => (full ?? '').trim().split(/\s+/)[0] ?? ''
/** Nombre para el saludo: nunca el mail (cuentas sin nombre cargado). */
const greetName = (full: string | null | undefined) => {
  const n = firstName(full)
  return n.includes('@') ? '' : n
}
/** Plata corta para la franja del celu: $296k, $1,2M. */
const shortMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M` : n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`

/**
 * Inicio v2: lo que hay que hacer hoy en una sola lista (con la acción en la misma fila), la agenda
 * y los cumpleaños al costado (si hay). Las estadísticas del mes siguen en «Estadísticas».
 */
export function DashboardV2Page() {
  const { user, profile } = useAuthStore()
  const navigate = useAppNavigate()
  const role = profile?.role
  const trains = canSeeTraining(role)
  const handlesMoney = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const peopleWord = role === 'nutritionist' ? 'pacientes' : 'alumnos'
  const [, setTick] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')

  const today = useMemo(() => new Date(), [])
  const period = monthKey(today)

  const studentsQ = useActiveStudents()
  const incomesQ = useIncomes()
  const sentQ = useSentReminders(period)
  const students = useMemo(() => studentsQ.data ?? [], [studentsQ.data])

  const routinesQ = useQuery({
    queryKey: routineKeys.list(user?.id),
    queryFn: () => fetchRoutineList(user!.id),
    enabled: Boolean(user) && trains,
  })

  // Semana de lunes a domingo, para la tira de días de la agenda.
  const weekStart = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    return d
  }, [today])
  const [selectedDay, setSelectedDay] = useState(() => (today.getDay() + 6) % 7)

  const appointmentsQ = useQuery({
    queryKey: ['v2', 'appointments-week', user?.id, format(weekStart, 'yyyy-MM-dd')],
    enabled: Boolean(user),
    queryFn: async () => {
      const end = new Date(weekStart.getTime() + 7 * DAY_MS)
      const { data } = await supabase
        .from('appointments')
        .select('id, title, starts_at, ends_at, status, student:students(full_name)')
        .eq('owner_id', user!.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', weekStart.toISOString())
        .lt('starts_at', end.toISOString())
        .order('starts_at')
      return (data ?? []) as unknown as AppointmentLite[]
    },
  })

  const missingQ = useQuery({
    queryKey: ['v2', 'missing-checkins', user?.id],
    enabled: Boolean(user) && trains,
    queryFn: () => loadStudentsMissingCheckIn(user!.id, weeklyPeriodMondayUtc(loadWeeklyPeriodStartYmd(user!.id))),
  })

  const unrepliedQ = useQuery({
    queryKey: ['v2', 'unreplied-checkins', user?.id],
    enabled: Boolean(user) && trains,
    queryFn: async () => {
      const since = new Date(today.getTime() - 30 * DAY_MS)
      const { count } = await supabase
        .from('check_in_responses')
        .select('id', { count: 'exact', head: true })
        .gte('submitted_at', since.toISOString())
        .is('trainer_replied_at', null)
      return count ?? 0
    },
  })

  const board = useMemo(() => {
    const incomes = (incomesQ.data ?? []).filter((i) => (i.scope ?? 'business') === 'business' && i.student_id)
    return buildPaymentBoard({
      students,
      incomes,
      month: new Date(today.getFullYear(), today.getMonth(), 1),
      today,
    })
  }, [students, incomesQ.data, today])

  const payItems = useMemo(() => {
    const sent = new Set((sentQ.data ?? []).map((r) => `${r.student_id}:${r.kind}`))
    return board.filter((r) => r.reminder && !sent.has(`${r.studentId}:${r.reminder}`))
  }, [board, sentQ.data])

  const money = useMemo(() => {
    const cobrado = board.reduce((a, r) => a + r.paid, 0)
    const esperado = board.reduce((a, r) => a + Math.max(r.expected, r.paid), 0)
    const owing = board.filter(
      (r) => r.state === 'vencido' || r.state === 'parcial' || (r.state === 'pendiente' && r.timing !== 'antes'),
    ).length
    return {
      cobrado,
      esperado,
      porCobrar: Math.max(0, esperado - cobrado),
      owing,
    }
  }, [board])

  const routines = useMemo(() => {
    const active = (trains ? (routinesQ.data ?? []) : []).filter(
      (r) => r.student_id && (r.status === 'activa' || r.status === 'por_vencer'),
    )
    const withRoutine = new Set(active.map((r) => r.student_id))
    const ending = active
      .map((r) => ({ r, days: daysFromToday(r.end_date, today) }))
      .filter((x) => x.days >= 0 && x.days <= 7)
      .sort((a, b) => a.days - b.days)
    return { ending, without: students.filter((s) => !withRoutine.has(s.id)) }
  }, [routinesQ.data, students, today, trains])

  const birthdays = useMemo(
    () =>
      students
        .filter((s) => s.birth_date)
        .map((s) => ({ s, days: daysToBirthday(s.birth_date!, today) }))
        .filter((x) => x.days <= 7)
        .sort((a, b) => a.days - b.days),
    [students, today],
  )

  const weekly = trains
    ? TRAINER_WEEKLY_REMINDERS.filter((r) => WEEKLY_COPY[r.id] && isTrainerReminderHighlightedToday(r, today) && !isDone(r.id))
    : []
  const missing = trains ? (missingQ.data ?? []) : []
  const unreplied = trains ? (unrepliedQ.data ?? 0) : 0
  const weekAppointments = useMemo(() => appointmentsQ.data ?? [], [appointmentsQ.data])
  const dayIndex = (iso: string) => Math.floor((new Date(iso).getTime() - weekStart.getTime()) / DAY_MS)
  const todayIndex = (today.getDay() + 6) % 7
  const appointmentsToday = weekAppointments.filter((a) => dayIndex(a.starts_at) === todayIndex)
  const dayAppointments = weekAppointments.filter((a) => dayIndex(a.starts_at) === selectedDay)

  const pendingCount =
    weekly.length +
    (handlesMoney ? payItems.length : 0) +
    (missing.length ? 1 : 0) +
    (unreplied ? 1 : 0) +
    routines.ending.length +
    (trains && routines.without.length ? 1 : 0)
  const loading = studentsQ.isPending || (handlesMoney && incomesQ.isPending)

  async function sendOrCopy(message: string, phone: string | null | undefined) {
    const digits = normalizePhoneForWhatsApp(phone)
    if (digits) {
      const res = await shareToWhatsApp({ message, phoneDigits: digits })
      if (res.mode === 'clipboard') toast.success(WHATSAPP_DIRECT_PASTE_HINT, { duration: 6000 })
      return
    }
    if (await copyWhatsAppMessage(message)) toast.success('Sin teléfono cargado: mensaje copiado')
    else toast.error('No se pudo copiar')
  }

  async function remind(r: StudentPaymentRow) {
    if (!r.reminder) return
    await sendOrCopy(reminderMessage(r.reminder, r.fullName), r.phone)
    const err = await markReminderSent({
      student_id: r.studentId,
      period,
      kind: r.reminder,
    })
    if (err) toast.error(err)
  }

  async function dismiss(r: StudentPaymentRow) {
    if (!r.reminder) return
    const err = await markReminderSent({
      student_id: r.studentId,
      period,
      kind: r.reminder,
    })
    if (err) toast.error(err)
    else toast.success(`${firstName(r.fullName)} salió de la lista`)
  }

  function markWeeklyDone(id: string) {
    try {
      localStorage.setItem(`hh-reminder-done:${id}`, doneKey())
    } catch {
      /* modo privado: vuelve a salir al recargar */
    }
    setTick((t) => t + 1)
  }

  const dateLabel = format(today, "EEEE d 'de' MMMM", { locale: es })
  const hour = today.getHours()
  const greeting = hour < 13 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches'
  const routineTotal = students.length
  const withRoutine = Math.max(0, routineTotal - routines.without.length)
  const answered = Math.max(0, students.length - missing.length)

  const counts = {
    cobros: handlesMoney ? payItems.length : 0,
    feedback: (missing.length ? 1 : 0) + (unreplied ? 1 : 0),
    rutinas: routines.ending.length + (trains && routines.without.length ? 1 : 0),
    semana: weekly.length,
  }
  const show = (f: Exclude<Filter, 'all'>) => filter === 'all' || filter === f
  const toggle = (f: Filter) => setFilter((cur) => (cur === f || f === 'all' ? 'all' : f))

  const tiles: {
    key: Exclude<Filter, 'all'>
    label: string
    visible: boolean
  }[] = [
    {
      key: 'feedback',
      label: 'Feedback',
      visible: trains,
    },
    {
      key: 'rutinas',
      label: 'Rutinas',
      visible: trains,
    },
    {
      key: 'semana',
      label: 'Avisos',
      visible: trains,
    },
    {
      key: 'cobros',
      label: 'Cobros',
      visible: handlesMoney,
    },
  ]

  const filterTiles = tiles.filter((t) => t.visible && (counts[t.key] > 0 || filter === t.key))

  const names = (list: { full_name: string | null }[]) =>
    list
      .slice(0, 4)
      .map((m) => firstName(m.full_name))
      .join(', ') + (list.length > 4 ? ` y ${list.length - 4} más` : '')

  const fmtTime = (iso: string) => format(new Date(iso), 'HH:mm')

  /** Los números del mes en una franja: abajo en el celu, en la columna derecha en la compu. */
  const monthStripV2 = (
    <StatStripV2
      items={[
        trains
          ? {
              label: 'Feedback',
              value: missingQ.isPending || loading ? '—' : String(answered),
              suffix: `/${students.length}`,
              tone: 'lavender' as const,
              progress: students.length ? answered / students.length : undefined,
              onClick: () => navigate('/feedback'),
            }
          : {
              label: 'Turnos hoy',
              value: appointmentsQ.isPending ? '—' : String(appointmentsToday.length),
              tone: 'sky' as const,
              onClick: () => navigate('/appointments'),
            },
        {
          label: trains ? 'Con rutina' : 'Activos',
          value: loading || (trains && routinesQ.isPending) ? '—' : String(trains ? withRoutine : students.length),
          suffix: trains ? `/${routineTotal}` : undefined,
          tone: 'mint' as const,
          progress: trains && routineTotal ? withRoutine / routineTotal : undefined,
          onClick: () => navigate(role === 'nutritionist' ? '/nutrition' : '/students'),
        },
        ...(handlesMoney
          ? [{
              label: 'Cobrado',
              value: loading ? '—' : shortMoney(money.cobrado),
              tone: 'peach' as const,
              progress: money.esperado > 0 ? money.cobrado / money.esperado : undefined,
              onClick: () => navigate('/finances'),
            }]
          : []),
      ]}
    />
  )

  return (
    <>
      <TopBarV2
        title="Inicio"
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
              onClick={() => navigate('/dashboard/completo')}
            >
              Estadísticas
            </Button>
            {trains ? (
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate('/students?create=1')}>
                Nuevo alumno
              </Button>
            ) : (
              <Button size="sm" icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => navigate('/appointments')}>
                Agendar turno
              </Button>
            )}
          </>
        }
      />
      <PageV2>
        <GreetingV2 eyebrow={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} title={`${greeting}${greetName(profile?.full_name) ? `, ${greetName(profile?.full_name)}` : ''}`}>
          {loading
            ? 'Cargando lo de hoy…'
            : pendingCount
              ? `Tenés ${pendingCount} ${pendingCount === 1 ? 'cosa' : 'cosas'} para resolver.`
              : 'No hay nada urgente.'}
        </GreetingV2>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            <SectionTitleV2>Para hoy</SectionTitleV2>

            {!loading && filterTiles.length > 1 ? (
              <div className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-hide md:mx-0 md:px-0 max-md:[&>div]:flex-nowrap">
                <SegmentedV2
                  value={filter}
                  onChange={(f) => toggle(f)}
                  options={[{ value: 'all' as Filter, label: 'Todo', count: pendingCount }, ...filterTiles.map((t) => ({ value: t.key as Filter, label: t.label, count: counts[t.key] }))]}
                />
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {[0, 1].map((i) => (
                  <div key={i} className="space-y-3 rounded-2xl border border-surface-border p-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-6 w-1/3" />
                  </div>
                ))}
              </div>
            ) : pendingCount === 0 ? (
              <div className="hh-pastel rounded-2xl bg-pastel-mint px-5 py-8 text-center">
                <p className="text-[15px] font-medium text-pastel-mint-ink">Todo al día</p>
                <p className="mt-1 text-[13px] text-ink-secondary">No hay cobros, feedback ni rutinas pendientes para hoy.</p>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
                {show('semana')
                  ? weekly.map((r) => {
                      const c = WEEKLY_COPY[r.id]!
                      return (
                        <TaskCardV2
                          key={r.id}
                          title={c.title}
                          description={c.meta}
                          tags={<TagV2 tone="sky">Aviso de la semana</TagV2>}
                          meta={<MetaChipV2 icon={CalendarDays}>Hoy</MetaChipV2>}
                          actions={
                            <>
                              <PillButtonV2 icon={Check} onClick={() => markWeeklyDone(r.id)} title="Sacarlo por hoy">
                                Listo
                              </PillButtonV2>
                              <PillButtonV2 primary onClick={() => navigate(c.href)}>
                                {c.cta}
                              </PillButtonV2>
                            </>
                          }
                        />
                      )
                    })
                  : null}

                {show('feedback') && missing.length ? (
                  <TaskCardV2
                    title={`${missing.length} ${missing.length === 1 ? 'alumno no respondió' : 'alumnos no respondieron'} el feedback`}
                    description={names(missing)}
                    onOpen={() => navigate('/feedback')}
                    tags={<TagV2 tone="lavender">Feedback semanal</TagV2>}
                    meta={<MetaChipV2 icon={MessageSquare}>{`${answered}/${students.length}`}</MetaChipV2>}
                    actions={
                      <PillButtonV2 primary onClick={() => navigate('/feedback')}>
                        Enviar
                      </PillButtonV2>
                    }
                  />
                ) : null}

                {show('feedback') && unreplied ? (
                  <TaskCardV2
                    title={`${unreplied} ${unreplied === 1 ? 'respuesta espera' : 'respuestas esperan'} tu devolución`}
                    description="Respuestas del último mes que todavía no contestaste."
                    onOpen={() => navigate('/feedback')}
                    tags={<TagV2 tone="lavender">Feedback semanal</TagV2>}
                    actions={
                      <PillButtonV2 primary onClick={() => navigate('/feedback')}>
                        Responder
                      </PillButtonV2>
                    }
                  />
                ) : null}

                {show('rutinas')
                  ? routines.ending.map(({ r, days }) => {
                      const who = r.student?.full_name ?? 'Alumno'
                      return (
                        <TaskCardV2
                          key={r.id}
                          title={r.name}
                          mark={<AvatarV2 name={who} />}
                          description={`${who}. ${days === 0 ? 'Termina hoy' : days === 1 ? 'Termina mañana' : `Termina en ${days} días`}: armá la que sigue.`}
                          onOpen={() => navigate(`/routines/${r.id}`)}
                          tags={
                            <>
                              <TagV2 tone="butter">Rutina</TagV2>
                              {days <= 2 ? <TagV2 tone="rose">Por terminar</TagV2> : null}
                            </>
                          }
                          meta={<MetaChipV2 icon={CalendarDays}>{fmtDay(r.end_date.slice(0, 10))}</MetaChipV2>}
                          actions={<PillButtonV2 onClick={() => navigate(`/routines/${r.id}`)}>Abrir</PillButtonV2>}
                        />
                      )
                    })
                  : null}

                {show('rutinas') && trains && routines.without.length ? (
                  <TaskCardV2
                    title={`${routines.without.length} ${routines.without.length === 1 ? 'alumno' : 'alumnos'} sin rutina activa`}
                    description={names(routines.without)}
                    onOpen={() => navigate('/students')}
                    tags={<TagV2 tone="butter">Rutina</TagV2>}
                    meta={<MetaChipV2 icon={Users}>{`${withRoutine}/${routineTotal} con rutina`}</MetaChipV2>}
                    actions={<PillButtonV2 onClick={() => navigate('/students')}>Ver alumnos</PillButtonV2>}
                  />
                ) : null}

                {show('cobros')
                  ? payItems.map((r) => {
                      const debt = Math.max(0, r.expected - r.paid)
                      const isToday = r.timing === 'hoy'
                      const overdue = r.reminder === 'overdue'
                      return (
                        <TaskCardV2
                          key={r.studentId}
                          title={r.fullName}
                          mark={<AvatarV2 name={r.fullName} />}
                          onOpen={() => navigate(`/students/${r.studentId}`)}
                          description={
                            isToday
                              ? 'Hoy es su día de pago. Mandale el recordatorio armado.'
                              : overdue
                                ? 'Pasaron 7 días hábiles desde el vencimiento.'
                                : 'Ya venció y todavía no figura el pago.'
                          }
                          tags={
                            <>
                              <TagV2 tone="peach">Cobro</TagV2>
                              <TagV2 tone={isToday ? 'butter' : 'rose'}>{isToday ? 'Vence hoy' : overdue ? 'Atrasado' : 'Vencido'}</TagV2>
                            </>
                          }
                          meta={
                            <>
                              {r.dueDate ? <MetaChipV2 icon={CalendarDays}>{fmtDay(r.dueDate)}</MetaChipV2> : null}
                              {debt > 0 ? <MetaChipV2 icon={Wallet}>{formatCurrency(debt)}</MetaChipV2> : null}
                            </>
                          }
                          actions={
                            <>
                              <PillButtonV2 onClick={() => void dismiss(r)} title="Sacarlo de la lista sin mandar nada">
                                Ya le avisé
                              </PillButtonV2>
                              <PillButtonV2 primary icon={WhatsAppIcon} onClick={() => void remind(r)}>
                                Recordar
                              </PillButtonV2>
                            </>
                          }
                        />
                      )
                    })
                  : null}

                {filter !== 'all' && counts[filter] === 0 ? (
                  <p className="col-span-full rounded-2xl bg-surface-panel px-5 py-6 text-center text-[13px] text-ink-muted">
                    Nada pendiente acá.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <aside className="space-y-4 max-lg:contents">
            <CardV2
              className="max-lg:order-first"
              title={selectedDay === todayIndex ? 'Turnos de hoy' : `Turnos del ${format(new Date(weekStart.getTime() + selectedDay * DAY_MS), 'EEEE d', { locale: es })}`}
              action={
                <button
                  type="button"
                  onClick={() => navigate('/appointments')}
                  className="text-[12px] text-ink-muted hover:text-ink-primary"
                >
                  Ver todo
                </button>
              }
            >
              <div className="grid grid-cols-7 gap-1 px-3 pb-3 pt-3">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(weekStart.getTime() + i * DAY_MS)
                  const on = i === selectedDay
                  const has = weekAppointments.some((a) => dayIndex(a.starts_at) === i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedDay(i)}
                      aria-pressed={on}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-xl py-2 transition-colors',
                        on ? 'bg-ink-primary text-surface-base' : 'text-ink-secondary hover:bg-surface-elevated',
                      )}
                    >
                      <span className={cn('text-[11px] capitalize', on ? 'opacity-70' : 'text-ink-muted')}>
                        {format(d, 'EEEEEE', { locale: es })}
                      </span>
                      <span className={cn('text-[14px] font-medium tabular-nums', i === todayIndex && !on && 'text-ink-primary')}>
                        {d.getDate()}
                      </span>
                      <span
                        className={cn('h-1 w-1 rounded-full', has ? (on ? 'bg-surface-base' : 'bg-pastel-peach-accent') : 'bg-transparent')}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="space-y-2 px-3 pb-3">
                {appointmentsQ.isPending ? (
                  <Skeleton className="h-14 w-full rounded-xl" />
                ) : dayAppointments.length === 0 ? (
                  <p className="rounded-xl bg-surface-panel px-4 py-5 text-center text-[13px] text-ink-muted">Sin turnos este día</p>
                ) : (
                  dayAppointments.map((a, i) => (
                    <div key={a.id} className={cn('hh-pastel rounded-xl px-3.5 py-3', SLOT_BG[i % SLOT_BG.length])}>
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-primary">
                          {a.student?.full_name ?? a.title}
                        </p>
                        {a.status === 'confirmed' ? (
                          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-white px-2 text-[11px] font-medium text-zinc-700">
                            <Check className="h-3 w-3 text-pastel-mint-accent" />
                            Confirmado
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] tabular-nums text-ink-secondary">
                        {fmtTime(a.starts_at)}
                        {a.ends_at ? ` – ${fmtTime(a.ends_at)}` : ''}
                        {a.student?.full_name && a.title ? ` · ${a.title}` : ''}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </CardV2>

            {/* Compu: los números del mes debajo de los turnos. */}
            <div className="hidden lg:block">
              <SectionTitleV2>Este mes</SectionTitleV2>
              {monthStripV2}
            </div>
            {birthdays.length ? (
            <CardV2 title="Cumpleaños" className="max-lg:order-last">
              {(
                <ul className="px-2 pb-2 pt-1">
                  {birthdays.map(({ s, days }) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                      <AvatarV2 name={s.full_name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink-primary">{s.full_name}</p>
                        <p className="text-[12px] text-ink-muted">
                          {days === 0
                            ? 'Hoy'
                            : days === 1
                              ? 'Mañana'
                              : `En ${days} días · ${fmtDay(s.birth_date!.slice(0, 10).replace(/^\d{4}/, String(today.getFullYear())))}`}
                        </p>
                      </div>
                      <PillButtonV2
                        icon={WhatsAppIcon}
                        title="Saludo por WhatsApp"
                        onClick={() => void sendOrCopy(birthdayMessage(s.full_name), s.phone)}
                      />
                      <PillButtonV2
                        icon={Copy}
                        title="Copiar saludo"
                        onClick={() =>
                          void copyWhatsAppMessage(birthdayMessage(s.full_name)).then((ok) =>
                            ok ? toast.success('Saludo copiado') : toast.error('No se pudo copiar'),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardV2>
            ) : null}
          </aside>
        </div>

        {/* Los números del mes: después de lo de hoy. */}
        <section className="mt-10 lg:hidden">
          <SectionTitleV2>Este mes</SectionTitleV2>
        {/* Celu: los tres números en una franja. */}
        <div className="md:hidden">
          {monthStripV2}
        </div>

        {/* Números del mes, cada uno con su avance. */}
        <div className="hidden gap-3 md:grid md:grid-cols-3">
          {trains ? (
            <PulseCardV2
              icon={MessageSquare}
              tone="lavender"
              title="Feedback de la semana"
              value={missingQ.isPending || loading ? null : answered}
              suffix={`/ ${students.length}`}
              caption={missing.length ? `Faltan ${missing.length}` : 'Respondieron todos'}
              progress={students.length ? answered / students.length : undefined}
              onClick={() => navigate('/feedback')}
            />
          ) : (
            <PulseCardV2
              icon={CalendarClock}
              tone="sky"
              title="Turnos de hoy"
              value={appointmentsQ.isPending ? null : appointmentsToday.length}
              caption={appointmentsToday[0] ? `El próximo a las ${fmtTime(appointmentsToday[0].starts_at)}` : 'Agenda libre'}
              onClick={() => navigate('/appointments')}
            />
          )}
          <PulseCardV2
            icon={Users}
            tone="mint"
            title={trains ? 'Con rutina activa' : role === 'nutritionist' ? 'Pacientes activos' : 'Alumnos activos'}
            value={loading || (trains && routinesQ.isPending) ? null : trains ? withRoutine : students.length}
            suffix={trains ? `/ ${routineTotal}` : undefined}
            caption={trains ? (routines.without.length ? `${routines.without.length} sin rutina` : 'Todos con rutina') : 'En seguimiento'}
            progress={trains && routineTotal ? withRoutine / routineTotal : undefined}
            onClick={() => navigate(role === 'nutritionist' ? '/nutrition' : '/students')}
          />
          {handlesMoney ? (
            <PulseCardV2
              icon={Wallet}
              tone="peach"
              title={`Cobrado en ${format(today, 'MMMM', { locale: es })}`}
              value={loading ? null : money.cobrado}
              format={(n) => formatCurrency(Math.round(n))}
              caption={
                money.esperado > 0
                  ? `de ${formatCurrency(money.esperado)}${money.owing ? ` · ${money.owing} por cobrar` : ''}`
                  : 'Sin cuotas cargadas'
              }
              progress={money.esperado > 0 ? money.cobrado / money.esperado : undefined}
              onClick={() => navigate('/finances')}
            />
          ) : null}
        </div>

        </section>

        {/* Lo que el Inicio anterior también mostraba y se resuelve desde acá. */}
        <div className="mt-10 space-y-4">
          {handlesMoney ? <PriceIncreaseNotice /> : null}
          {handlesMoney ? <RoutinePaymentsPanel compact /> : null}
          {role === 'nutritionist' && user ? (
            <section>
              <SectionTitleV2>Seguimiento de {peopleWord}</SectionTitleV2>
              <NutritionistOpsPanel ownerId={user.id} />
            </section>
          ) : null}
          {role === 'admin' || role === 'trainer' ? <WebIntakeAccessRequestsPanel variant="dashboard" /> : null}
          <button
            type="button"
            onClick={() => navigate('/dashboard/completo')}
            className="text-[13px] text-ink-muted underline-offset-4 hover:text-ink-primary hover:underline sm:hidden"
          >
            Ver estadísticas del mes
          </button>
        </div>
      </PageV2>
    </>
  )
}

/** Turnos del día: un pastel por turno, en orden (clases completas para que Tailwind las vea). */
const SLOT_BG = ['bg-pastel-lavender', 'bg-pastel-sky', 'bg-pastel-butter', 'bg-pastel-mint', 'bg-pastel-peach']
