import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { CalendarPlus, Check, Copy, Dumbbell, LayoutGrid, MessageSquare, MessagesSquare, Plus, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'
import { EmptyRowV2, GroupLabel, IconBubble, InitialsV2, PageHeaderV2, PageV2, PanelV2, RowAction, RowV2, StatStrip } from '@/components/v2/ui'
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
import { formatCurrency } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount'
import { NotificationBellBadge } from '@/components/notifications/NotificationBellBadge'
import { HeaderActionButton, HeaderBellIcon, HeaderSearchIcon } from '@/components/icons/headerAnimateIcons'
import { openGlobalSearch } from '@/lib/globalSearch'

type AppointmentLite = { id: string; title: string; starts_at: string; student?: { full_name?: string | null } | null }

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

function greeting(now: Date): string {
  const h = now.getHours()
  return h < 12 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
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

/**
 * Inicio v2: lo que hay que hacer hoy en una sola lista (con la acción en la misma fila), la agenda
 * y los cumpleaños al costado. Las estadísticas del mes siguen en «Tablero completo».
 */
export function DashboardV2Page() {
  const { user, profile } = useAuthStore()
  const navigate = useAppNavigate()
  const role = profile?.role
  const unreadCount = useUnreadNotificationCount()
  const trains = canSeeTraining(role)
  const handlesMoney = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const peopleWord = role === 'nutritionist' ? 'pacientes' : 'alumnos'
  const [, setTick] = useState(0)

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

  const appointmentsQ = useQuery({
    queryKey: ['v2', 'appointments-today', user?.id, format(today, 'yyyy-MM-dd')],
    enabled: Boolean(user),
    queryFn: async () => {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const end = new Date(start.getTime() + DAY_MS)
      const { data } = await supabase
        .from('appointments')
        .select('id, title, starts_at, student:students(full_name)')
        .eq('owner_id', user!.id)
        .in('status', ['scheduled', 'confirmed'])
        .gte('starts_at', start.toISOString())
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
    return buildPaymentBoard({ students, incomes, month: new Date(today.getFullYear(), today.getMonth(), 1), today })
  }, [students, incomesQ.data, today])

  const payItems = useMemo(() => {
    const sent = new Set((sentQ.data ?? []).map((r) => `${r.student_id}:${r.kind}`))
    return board.filter((r) => r.reminder && !sent.has(`${r.studentId}:${r.reminder}`))
  }, [board, sentQ.data])

  const money = useMemo(() => {
    const cobrado = board.reduce((a, r) => a + r.paid, 0)
    const esperado = board.reduce((a, r) => a + Math.max(r.expected, r.paid), 0)
    const owing = board.filter((r) => r.state === 'vencido' || r.state === 'parcial' || (r.state === 'pendiente' && r.timing !== 'antes')).length
    return { cobrado, esperado, porCobrar: Math.max(0, esperado - cobrado), owing }
  }, [board])

  const routines = useMemo(() => {
    const active = (trains ? routinesQ.data ?? [] : []).filter((r) => r.student_id && (r.status === 'activa' || r.status === 'por_vencer'))
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
  const missing = trains ? missingQ.data ?? [] : []
  const unreplied = trains ? unrepliedQ.data ?? 0 : 0
  const appointments = appointmentsQ.data ?? []

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
    const err = await markReminderSent({ student_id: r.studentId, period, kind: r.reminder })
    if (err) toast.error(err)
  }

  async function dismiss(r: StudentPaymentRow) {
    if (!r.reminder) return
    const err = await markReminderSent({ student_id: r.studentId, period, kind: r.reminder })
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
  const statItems = [
    { label: role === 'nutritionist' ? 'Pacientes activos' : 'Alumnos activos', value: loading ? '—' : students.length },
    ...(handlesMoney
      ? [
          {
            label: `Cobrado en ${format(today, 'MMMM', { locale: es })}`,
            value: loading ? '—' : formatCurrency(money.cobrado),
            hint: money.esperado > 0 ? `de ${formatCurrency(money.esperado)} esperado` : 'Sin cuotas cargadas',
          },
          {
            label: 'Por cobrar',
            value: loading ? '—' : formatCurrency(money.porCobrar),
            hint: money.owing ? `${money.owing} ${money.owing === 1 ? `${peopleWord.slice(0, -1)} debe` : `${peopleWord} deben`} hoy` : 'Nadie debe hoy',
          },
        ]
      : []),
    trains
      ? {
          label: 'Feedback semanal',
          value: missingQ.isPending ? '—' : `${Math.max(0, students.length - missing.length)}/${students.length}`,
          hint: 'respondieron esta semana',
        }
      : { label: 'Turnos hoy', value: appointmentsQ.isPending ? '—' : appointments.length, hint: 'en la agenda' },
  ]

  return (
    <PageV2>
      <PageHeaderV2
        title={`${greeting(new Date())}${profile?.full_name ? `, ${firstName(profile.full_name)}` : ''}`}
        description={
          <>
            {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
            {' · '}
            {loading ? 'Cargando…' : pendingCount ? `${pendingCount} ${pendingCount === 1 ? 'cosa' : 'cosas'} para hoy` : 'Nada urgente para hoy'}
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<LayoutGrid className="h-3.5 w-3.5" />} onClick={() => navigate('/dashboard/completo')}>
              Tablero completo
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
            <HeaderActionButton
              onClick={() => openGlobalSearch()}
              className="lg:hidden"
              aria-label="Buscar (Ctrl+K)"
              renderIcon={(hovered) => <HeaderSearchIcon animate={hovered} />}
            />
            <HeaderActionButton
              onClick={() => navigate('/notifications')}
              aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
              className="relative overflow-visible"
              renderIcon={(hovered) => <HeaderBellIcon animate={hovered} />}
              badge={<NotificationBellBadge count={unreadCount} className="-top-1 -right-1" />}
            />
          </>
        }
      />

      <StatStrip items={statItems} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanelV2 title="Para hoy" count={loading ? undefined : pendingCount}>
          {loading ? (
            <div className="space-y-3 p-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : pendingCount === 0 ? (
            <EmptyRowV2>Todo al día. No hay nada pendiente para hoy.</EmptyRowV2>
          ) : (
            <div className="divide-y divide-surface-border">
              {weekly.map((r) => {
                const c = WEEKLY_COPY[r.id]!
                return (
                  <RowV2
                    key={r.id}
                    leading={<IconBubble icon={Sparkles} tone="brand" />}
                    title={c.title}
                    meta={c.meta}
                    trailing={
                      <>
                        <RowAction icon={Send} onClick={() => navigate(c.href)}>
                          {c.cta}
                        </RowAction>
                        <RowAction icon={Check} onClick={() => markWeeklyDone(r.id)} title="Sacarlo por hoy">
                          Listo
                        </RowAction>
                      </>
                    }
                  />
                )
              })}

              {handlesMoney && payItems.length ? (
                <>
                  <GroupLabel>Cobros</GroupLabel>
                  {payItems.map((r) => {
                    const debt = Math.max(0, r.expected - r.paid)
                    const when =
                      r.timing === 'hoy'
                        ? 'Hoy es su día de pago'
                        : r.reminder === 'overdue'
                          ? `Vencido desde el ${fmtDay(r.dueDate)} · pasaron 7 días hábiles`
                          : `Venció el ${fmtDay(r.dueDate)}`
                    return (
                      <RowV2
                        key={r.studentId}
                        leading={<InitialsV2 name={r.fullName} />}
                        title={r.fullName}
                        meta={debt > 0 ? `${when} · ${formatCurrency(debt)}` : when}
                        onClick={() => navigate(`/students/${r.studentId}`)}
                        trailing={
                          <>
                            <RowAction icon={WhatsAppIcon} iconClassName="text-emerald-600 dark:text-emerald-400" onClick={() => void remind(r)}>
                              Recordar
                            </RowAction>
                            <RowAction onClick={() => void dismiss(r)} title="Sacarlo de la lista sin mandar nada">
                              Ya le avisé
                            </RowAction>
                          </>
                        }
                      />
                    )
                  })}
                </>
              ) : null}

              {missing.length || unreplied ? (
                <>
                  <GroupLabel>Feedback semanal</GroupLabel>
                  {missing.length ? (
                    <RowV2
                      leading={<IconBubble icon={MessageSquare} tone="info" />}
                      title={`${missing.length} ${missing.length === 1 ? 'alumno no respondió' : 'alumnos no respondieron'} esta semana`}
                      meta={missing.slice(0, 4).map((m) => firstName(m.full_name)).join(', ') + (missing.length > 4 ? '…' : '')}
                      onClick={() => navigate('/feedback')}
                      trailing={
                        <RowAction icon={Send} onClick={() => navigate('/feedback')}>
                          Enviar
                        </RowAction>
                      }
                    />
                  ) : null}
                  {unreplied ? (
                    <RowV2
                      leading={<IconBubble icon={MessagesSquare} tone="info" />}
                      title={`${unreplied} ${unreplied === 1 ? 'respuesta espera' : 'respuestas esperan'} tu devolución`}
                      meta="Del último mes"
                      onClick={() => navigate('/feedback')}
                      trailing={<RowAction onClick={() => navigate('/feedback')}>Ver</RowAction>}
                    />
                  ) : null}
                </>
              ) : null}

              {routines.ending.length || (trains && routines.without.length) ? (
                <>
                  <GroupLabel>Rutinas</GroupLabel>
                  {routines.ending.map(({ r, days }) => {
                    const who = r.student?.full_name ?? 'Alumno'
                    return (
                      <RowV2
                        key={r.id}
                        leading={<InitialsV2 name={who} />}
                        title={r.name}
                        meta={`${days === 0 ? 'Termina hoy' : days === 1 ? 'Termina mañana' : `Termina en ${days} días`} · ${who}`}
                        onClick={() => navigate(`/routines/${r.id}`)}
                        trailing={<RowAction onClick={() => navigate(`/routines/${r.id}`)}>Abrir</RowAction>}
                      />
                    )
                  })}
                  {trains && routines.without.length ? (
                    <RowV2
                      leading={<IconBubble icon={Dumbbell} tone="warning" />}
                      title={`${routines.without.length} ${routines.without.length === 1 ? 'alumno' : 'alumnos'} sin rutina activa`}
                      meta={routines.without.slice(0, 4).map((s) => firstName(s.full_name)).join(', ') + (routines.without.length > 4 ? '…' : '')}
                      onClick={() => navigate('/students')}
                      trailing={<RowAction onClick={() => navigate('/students')}>Ver</RowAction>}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </PanelV2>

        <div className="space-y-5">
          <PanelV2
            title="Agenda de hoy"
            count={appointments.length || undefined}
            action={
              <Link to="/appointments" className="text-[12px] font-medium text-ink-muted hover:text-ink-primary">
                Ver agenda
              </Link>
            }
          >
            {appointmentsQ.isPending ? (
              <div className="p-4">
                <Skeleton className="h-3 w-2/3" />
              </div>
            ) : appointments.length === 0 ? (
              <EmptyRowV2>Sin turnos hoy</EmptyRowV2>
            ) : (
              <ul className="divide-y divide-surface-border">
                {appointments.map((a) => (
                  <li key={a.id} className="flex items-baseline gap-3 px-4 py-2.5">
                    <span className="w-11 shrink-0 text-[12px] font-medium tabular-nums text-ink-muted">
                      {format(new Date(a.starts_at), 'HH:mm')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-ink-primary">{a.student?.full_name ?? a.title}</span>
                      {a.student?.full_name && a.title ? <span className="block truncate text-[12px] text-ink-muted">{a.title}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelV2>

          <PanelV2 title="Cumpleaños" count={birthdays.length || undefined}>
            {birthdays.length === 0 ? (
              <EmptyRowV2>Ninguno en los próximos 7 días</EmptyRowV2>
            ) : (
              <div className="divide-y divide-surface-border">
                {birthdays.map(({ s, days }) => (
                  <RowV2
                    key={s.id}
                    leading={<InitialsV2 name={s.full_name} />}
                    title={s.full_name}
                    meta={days === 0 ? 'Hoy 🎂' : days === 1 ? 'Mañana' : `En ${days} días · ${fmtDay(s.birth_date!.slice(0, 10).replace(/^\d{4}/, String(today.getFullYear())))}`}
                    trailing={
                      <>
                        <RowAction
                          icon={WhatsAppIcon}
                          iconClassName="text-emerald-600 dark:text-emerald-400"
                          onClick={() => void sendOrCopy(birthdayMessage(s.full_name), s.phone)}
                          title="Saludo por WhatsApp"
                        />
                        <RowAction
                          icon={Copy}
                          title="Copiar saludo"
                          onClick={() =>
                            void copyWhatsAppMessage(birthdayMessage(s.full_name)).then((ok) =>
                              ok ? toast.success('Saludo copiado') : toast.error('No se pudo copiar'),
                            )
                          }
                        />
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </PanelV2>
        </div>
      </div>

      {/* Lo que el Inicio anterior también mostraba y se resuelve desde acá. */}
      <div className="mt-5 space-y-4">
        {handlesMoney ? <PriceIncreaseNotice /> : null}
        {handlesMoney ? <RoutinePaymentsPanel compact /> : null}
        {role === 'nutritionist' && user ? (
          <section className="space-y-2">
            <h2 className="text-[13px] font-semibold text-ink-primary">Seguimiento de {peopleWord}</h2>
            <NutritionistOpsPanel ownerId={user.id} />
          </section>
        ) : null}
        {role === 'admin' || role === 'trainer' ? <WebIntakeAccessRequestsPanel variant="dashboard" /> : null}
      </div>
    </PageV2>
  )
}
