import { forwardRef, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  CalendarClock,
  CheckCheck,
  Dumbbell,
  Megaphone,
  MessageSquareReply,
  CalendarDays,
  CalendarPlus,
  Check,
  ClipboardList,
  RotateCcw,
  UtensilsCrossed,
  Copy,
  HeartPulse,
  LayoutGrid,
  MessageSquare,
  Plus,
  Ruler,
  Users,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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
  TASK_LIST_V2,
} from '@/components/v2/ui'
import { TopBarV2 } from '@/components/v2/TopBarV2'
import { birthdayMessage } from '@/components/dashboard/BirthdayGreetings'
import { PriceIncreaseNotice } from '@/components/dashboard/PriceIncreaseNotice'
import { NextConsultCardV2 } from '@/components/dashboard/NextConsultCardV2'
import { GettingStartedV2 } from '@/components/dashboard/GettingStartedV2'
import { DaySummaryCardV2 } from '@/components/dashboard/DaySummaryCardV2'
import { RoutinePaymentsPanel } from '@/components/finances/RoutinePaymentsPanel'
import { WebIntakeAccessRequestsPanel } from '@/components/settings/WebIntakeAccessRequestsPanel'
import { canSeeTraining } from '@/config/navigation'
import { markReminderSent, unmarkReminderSent, useActiveStudents, useIncomes, useSentReminders } from '@/data/finance'
import { useDailyMissions, ymdLocal, type DailyTaskRow, type MissionDef, type TaskCategory } from '@/data/dailyTasks'
import { loadWeekStatusByOwner } from '@/lib/checkIn/routineWeekProgress'
import { fetchRoutineList, routineKeys } from '@/data/routines'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { loadStudentsMissingCheckIn } from '@/lib/dashboard/dashboardTrainerOps'
import { loadNutritionistOps } from '@/lib/dashboard/nutritionistOps'
import { buildNutritionistToday, tomorrowReminderMessage, type TodayAppointment } from '@/lib/dashboard/nutritionistToday'
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

type Filter = 'all' | 'cobros' | 'feedback' | 'rutinas' | 'semana' | 'turnos' | 'seguimiento'

const DAY_MS = 86_400_000

/** Misiones: el naranja del «Para hoy» del entrenador (pedido oct-7: naranja y negro). */
const MISSION_ORANGE = 'rgb(var(--status-progress))'
const CATEGORY_FILTER: Record<TaskCategory, Filter> = { feedback: 'feedback', rutinas: 'rutinas', avisos: 'semana', cobros: 'cobros' }
const CATEGORY_LABEL: Record<TaskCategory, string> = { feedback: 'Feedback', rutinas: 'Rutina', avisos: 'Aviso', cobros: 'Cobro' }
const CATEGORY_ICON: Record<TaskCategory, LucideIcon> = { feedback: MessageSquare, rutinas: Dumbbell, avisos: Megaphone, cobros: Wallet }

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

/**
 * Turnos de mañana a los que ya se les mandó (o se descartó) el recordatorio. Se guarda en
 * `appointment_reminders` (canal whatsapp) para que valga en todos los dispositivos; esta copia local
 * hace que la tarjeta se vaya al instante y cubre si la escritura falla.
 */
const REMINDED_KEY = 'hh-appt-reminded'
function readReminded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(REMINDED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveReminded(ids: Set<string>) {
  try {
    localStorage.setItem(REMINDED_KEY, JSON.stringify([...ids].slice(-200)))
  } catch {
    /* sin almacenamiento: vuelve a salir al recargar */
  }
}

/** Cada tarjeta de «Para hoy»: entran en cascada y, al resolverse, se van hacia el costado. */
// Con forwardRef: AnimatePresence en modo «popLayout» necesita medir cada tarjeta al sacarla.
const AnimatedTask = forwardRef<HTMLDivElement, { index: number; children: ReactNode }>(function AnimatedTask({ index, children }, ref) {
  return (
    <motion.div
      ref={ref}
      layout
      className="sm:grid sm:grid-cols-subgrid"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.045, type: 'spring', stiffness: 320, damping: 30 } }}
      exit={{ opacity: 0, scale: 0.96, x: 24, transition: { duration: 0.22 } }}
    >
      {children}
    </motion.div>
  )
})

function names(list: { full_name: string | null }[]) {
  return (
    list
      .slice(0, 4)
      .map((m) => firstName(m.full_name))
      .join(', ') + (list.length > 4 ? ` y ${list.length - 4} más` : '')
  )
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
  /** «Para hoy» como misiones (tildar, deshacer, vencidas): el Inicio del entrenador. */
  const missionsOn = trains
  const handlesMoney = role === 'admin' || role === 'trainer' || role === 'nutritionist'
  const [, setTick] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')

  const today = useMemo(() => new Date(), [])
  const isNutri = role === 'nutritionist'
  // Reloj para la cuenta regresiva de la próxima consulta.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const [reminded, setReminded] = useState(readReminded)
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

  // Entrenador: alumnos que en su último feedback marcaron que cerraron el mes o están en la última semana.
  const closingQ = useQuery({
    queryKey: ['v2', 'closing-month', user?.id],
    enabled: Boolean(user) && trains,
    queryFn: async () => [...(await loadWeekStatusByOwner(user!.id)).entries()],
  })

  // Entrenador: planes de alimentación que vencen en una semana (o vencieron hace poco) y siguen vigentes.
  const mealPlansQ = useQuery({
    queryKey: ['v2', 'meal-plans-ending', user?.id, format(today, 'yyyy-MM-dd')],
    enabled: Boolean(user) && trains,
    queryFn: async () => {
      const { data } = await supabase
        .from('trainer_student_meal_plans')
        .select('id, title, end_date, student_id, student:students(full_name, status)')
        .eq('owner_id', user!.id)
        .is('completed_at', null)
        .not('end_date', 'is', null)
        .gte('end_date', ymdLocal(new Date(today.getTime() - 14 * DAY_MS)))
        .lte('end_date', ymdLocal(new Date(today.getTime() + 7 * DAY_MS)))
      return ((data ?? []) as unknown as {
        id: string
        title: string
        end_date: string
        student_id: string
        student?: { full_name?: string | null; status?: string | null } | null
      }[]).filter((m) => (m.student?.status ?? 'activo') === 'activo')
    },
  })

  // Nutricionista: turnos de hoy y mañana (con teléfono), quién tiene turno a futuro, registros de síntomas y seguimiento.
  const nutriQ = useQuery({
    queryKey: ['v2', 'nutri-today', user?.id, format(today, 'yyyy-MM-dd')],
    enabled: Boolean(user) && isNutri,
    queryFn: async () => {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const end = new Date(start.getTime() + 2 * DAY_MS)
      const since = new Date(start.getTime() - 14 * DAY_MS).toISOString().slice(0, 10)
      const [appts, future, checkins, ops] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, student_id, title, starts_at, ends_at, status, student:students(full_name, phone)')
          .eq('owner_id', user!.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('starts_at', start.toISOString())
          .lt('starts_at', end.toISOString())
          .order('starts_at'),
        supabase
          .from('appointments')
          .select('student_id')
          .eq('owner_id', user!.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('starts_at', new Date().toISOString())
          .limit(1000),
        supabase
          .from('nutrition_symptom_checkins')
          .select('student_id, logged_at, digestive_discomfort_0_10, adherence_1_5')
          .eq('owner_id', user!.id)
          .gte('logged_at', since)
          .limit(2000),
        loadNutritionistOps(user!.id),
      ])
      const apptIds = ((appts.data ?? []) as { id: string }[]).map((a) => a.id)
      const sent = apptIds.length
        ? await supabase
            .from('appointment_reminders')
            .select('appointment_id')
            .in('appointment_id', apptIds)
            .eq('channel', 'whatsapp')
            .eq('status', 'sent')
        : { data: [] }
      type Row = {
        id: string
        student_id: string | null
        title: string | null
        starts_at: string
        ends_at: string | null
        status: string
        student?: { full_name?: string | null; phone?: string | null } | null
      }
      return {
        appointments: ((appts.data ?? []) as unknown as Row[]).map<TodayAppointment>((a) => ({
          id: a.id,
          student_id: a.student_id,
          starts_at: a.starts_at,
          ends_at: a.ends_at,
          status: a.status,
          title: a.title,
          full_name: a.student?.full_name ?? a.title ?? 'Turno',
          phone: a.student?.phone ?? null,
        })),
        withFuture: new Set(
          ((future.data ?? []) as { student_id: string | null }[]).map((r) => r.student_id).filter((x): x is string => !!x),
        ),
        checkins: (checkins.data ?? []) as {
          student_id: string
          logged_at: string
          digestive_discomfort_0_10: number | null
          adherence_1_5: number | null
        }[],
        ops,
        remindedIds: ((sent.data ?? []) as { appointment_id: string }[]).map((r) => r.appointment_id),
      }
    },
  })
  const remindedAll = useMemo(() => new Set([...reminded, ...(nutriQ.data?.remindedIds ?? [])]), [reminded, nutriQ.data])
  const nutri = useMemo(
    () =>
      buildNutritionistToday({
        appointments: nutriQ.data?.appointments ?? [],
        withFutureAppointment: nutriQ.data?.withFuture ?? new Set(),
        checkins: nutriQ.data?.checkins ?? [],
        patients: students.map((s) => ({ id: s.id, full_name: s.full_name, phone: s.phone ?? null })),
        overdueControls: nutriQ.data?.ops.overdueControls ?? [],
        pendingAnamnesis: nutriQ.data?.ops.pendingAnamnesis ?? [],
        reminded: remindedAll,
        now,
      }),
    [nutriQ.data, students, remindedAll, now],
  )

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
    ? TRAINER_WEEKLY_REMINDERS.filter((r) => WEEKLY_COPY[r.id] && isTrainerReminderHighlightedToday(r, today) && (missionsOn || !isDone(r.id)))
    : []
  const missing = trains ? (missingQ.data ?? []) : []
  const unreplied = trains ? (unrepliedQ.data ?? 0) : 0
  const weekAppointments = useMemo(() => appointmentsQ.data ?? [], [appointmentsQ.data])
  const dayIndex = (iso: string) => Math.floor((new Date(iso).getTime() - weekStart.getTime()) / DAY_MS)
  const todayIndex = (today.getDay() + 6) % 7
  const appointmentsToday = weekAppointments.filter((a) => dayIndex(a.starts_at) === todayIndex)
  const dayAppointments = weekAppointments.filter((a) => dayIndex(a.starts_at) === selectedDay)

  const weekKey = ymdLocal(weekStart)
  const todayKey = ymdLocal(today)
  const closing = useMemo(() => {
    if (!trains) return []
    const byId = new Map(students.map((s) => [s.id, s]))
    return (closingQ.data ?? [])
      .filter(([, st]) => st.finished || st.lastWeek)
      .map(([id, st]) => ({ student: byId.get(id), st }))
      .filter((x): x is { student: NonNullable<typeof x.student>; st: (typeof x)['st'] } => Boolean(x.student))
  }, [closingQ.data, students, trains])
  const mealPlansEnding = useMemo(
    () => (trains ? (mealPlansQ.data ?? []) : []).map((m) => ({ m, days: daysFromToday(m.end_date, today) })).sort((a, b) => a.days - b.days),
    [mealPlansQ.data, today, trains],
  )

  const missionKeys = {
    closing: (studentId: string, at: string | null) => `cierre:${studentId}:${(at ?? '').slice(0, 10)}`,
    weekly: (id: string) => `aviso:${id}:${todayKey}`,
    mealPlan: (id: string) => `plan-fin:${id}`,
    missing: `feedback-faltan:${weekKey}`,
    unreplied: `feedback-devolucion:${weekKey}`,
    routineEnd: (id: string) => `rutina-fin:${id}`,
    without: `rutina-sin:${weekKey}`,
    cobro: (r: StudentPaymentRow) => `cobro:${r.studentId}:${period}:${r.reminder}`,
  }

  const missionDefs = useMemo<MissionDef[]>(() => {
    if (!missionsOn) return []
    const out: MissionDef[] = []
    for (const r of weekly) {
      const c = WEEKLY_COPY[r.id]!
      out.push({ key: missionKeys.weekly(r.id), category: 'avisos', title: c.title, detail: c.meta, href: c.href })
    }
    for (const { m, days } of mealPlansEnding) {
      const who = m.student?.full_name ?? 'Alumno'
      out.push({
        key: missionKeys.mealPlan(m.id),
        category: 'avisos',
        title: `Plan de alimentación de ${who}`,
        detail: days < 0 ? 'Venció: armá el que sigue.' : 'Está por vencer: armá el que sigue.',
        href: '/meal-plans',
      })
    }
    if (missing.length)
      out.push({ key: missionKeys.missing, category: 'feedback', title: `${missing.length} sin responder el feedback`, detail: names(missing), href: '/feedback' })
    if (unreplied)
      out.push({ key: missionKeys.unreplied, category: 'feedback', title: `${unreplied} respuestas esperan tu devolución`, href: '/feedback' })
    for (const { student, st } of closing)
      out.push({
        key: missionKeys.closing(student.id, st.submittedAt),
        category: 'rutinas',
        title: `${student.full_name} ${st.finished ? 'cerró su mes' : 'está en su última semana'}: armá la que sigue`,
        href: `/students/${student.id}`,
      })
    for (const { r } of routines.ending)
      out.push({ key: missionKeys.routineEnd(r.id), category: 'rutinas', title: `${r.name} · ${r.student?.full_name ?? 'Alumno'}`, detail: 'Termina pronto: armá la que sigue.', href: `/routines/${r.id}` })
    if (routines.without.length)
      out.push({ key: missionKeys.without, category: 'rutinas', title: `${routines.without.length} sin rutina activa`, detail: names(routines.without), href: '/students' })
    if (handlesMoney)
      for (const r of payItems)
        out.push({ key: missionKeys.cobro(r), category: 'cobros', title: `Cobrar a ${r.fullName}`, href: `/students/${r.studentId}` })
    return out
    // missionKeys/names son funciones puras de lo que ya está en las dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionsOn, weekly.map((w) => w.id).join(), mealPlansEnding, missing, unreplied, closing, routines, payItems, handlesMoney, weekKey, todayKey, period])

  const missions = useDailyMissions(missionsOn ? user?.id : undefined, missionDefs, today)
  const defByKey = useMemo(() => new Map(missionDefs.map((d) => [d.key, d])), [missionDefs])
  /** ¿Se muestra la tarjeta? Con misiones, las ya tildadas pasan a «Hechas hoy». */
  const isOpen = (key: string) => !missionsOn || !missions.stateOf(key).done
  const complete = (key: string) => {
    const d = defByKey.get(key)
    if (missionsOn && d) missions.complete(d)
  }
  const missionCard = (key: string) => (missionsOn ? { onCheck: () => complete(key) } : {})
  const overdueTag = (key: string) => (missionsOn && missions.stateOf(key).overdue ? <TagV2 tone="rose">Atrasada</TagV2> : null)
  async function undoMission(row: DailyTaskRow) {
    missions.undo(row)
    // Cobro: también vuelve a la lista de avisos de pago (si se había marcado como avisado).
    const m = /^cobro:([^:]+):([^:]+):(due|overdue)$/.exec(row.task_key)
    if (m) await unmarkReminderSent({ student_id: m[1]!, period: m[2]!, kind: m[3] as 'due' | 'overdue' })
  }
  const openDefs = missionDefs.filter((d) => isOpen(d.key))
  const orphans = missionsOn ? missions.orphans : []

  const nutriCounts = isNutri
    ? {
        turnos: nutri.tomorrow.length,
        seguimiento: nutri.symptoms.length + (nutri.overdue.length ? 1 : 0) + (nutri.anamnesis.length ? 1 : 0),
      }
    : { turnos: 0, seguimiento: 0 }
  const pendingCount = missionsOn
    ? openDefs.length + orphans.length + nutriCounts.turnos + nutriCounts.seguimiento
    : nutriCounts.turnos +
    nutriCounts.seguimiento +
    weekly.length +
    (handlesMoney ? payItems.length : 0) +
    (missing.length ? 1 : 0) +
    (unreplied ? 1 : 0) +
    routines.ending.length +
    (trains && routines.without.length ? 1 : 0)
  const loading =
    studentsQ.isPending || (handlesMoney && incomesQ.isPending) || (isNutri && nutriQ.isPending) || (missionsOn && !missions.ready)

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

  function markReminded(id: string) {
    setReminded((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveReminded(next)
      return next
    })
    if (!user) return
    const at = new Date().toISOString()
    void supabase
      .from('appointment_reminders')
      .insert({ owner_id: user.id, appointment_id: id, channel: 'whatsapp', scheduled_for: at, sent_at: at, status: 'sent', error_message: null })
      .then(({ error }) => {
        if (error) console.warn('No se pudo guardar el recordatorio', error.message)
      })
  }

  async function remindAppointment(a: TodayAppointment) {
    await sendOrCopy(tomorrowReminderMessage(a.full_name, a.starts_at), a.phone)
    markReminded(a.id)
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

  const missionCount = (c: TaskCategory) =>
    openDefs.filter((d) => d.category === c).length + orphans.filter((r) => r.category === c).length
  const counts = missionsOn
    ? {
        cobros: missionCount('cobros'),
        feedback: missionCount('feedback'),
        rutinas: missionCount('rutinas'),
        semana: missionCount('avisos'),
        turnos: nutriCounts.turnos,
        seguimiento: nutriCounts.seguimiento,
      }
    : {
        cobros: handlesMoney ? payItems.length : 0,
        feedback: (missing.length ? 1 : 0) + (unreplied ? 1 : 0),
        rutinas: routines.ending.length + (trains && routines.without.length ? 1 : 0),
        semana: weekly.length,
        turnos: nutriCounts.turnos,
        seguimiento: nutriCounts.seguimiento,
      }
  const doneToday = missionsOn ? missions.completedToday.filter((r) => filter === 'all' || CATEGORY_FILTER[r.category] === filter) : []
  const doneTotal = missionsOn ? missions.completedToday.length : 0
  const show = (f: Exclude<Filter, 'all'>) => filter === 'all' || filter === f
  const toggle = (f: Filter) => setFilter((cur) => (cur === f || f === 'all' ? 'all' : f))

  const tiles: {
    key: Exclude<Filter, 'all'>
    label: string
    visible: boolean
  }[] = [
    {
      key: 'turnos',
      label: 'Turnos',
      visible: isNutri,
    },
    {
      key: 'seguimiento',
      label: 'Seguimiento',
      visible: isNutri,
    },
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

  const filterTiles = tiles.filter((t) => t.visible && (missionsOn || counts[t.key] > 0 || filter === t.key))


  const fmtTime = (iso: string) => format(new Date(iso), 'HH:mm')
  let taskIndex = 0
  const T = (key: string, node: ReactNode) => (
    <AnimatedTask key={key} index={taskIndex++}>
      {node}
    </AnimatedTask>
  )

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

  const nextConsult =
    isNutri && nutri.next ? (
      <NextConsultCardV2
        appointment={nutri.next}
        inProgress={nutri.nextInProgress}
        later={nutri.laterToday}
        symptom={nutri.symptoms.find((x) => x.id === nutri.next!.student_id) ?? null}
        now={now}
        onOpen={() => navigate(`/nutrition/${nutri.next!.student_id}`)}
        onStart={() => navigate(`/nutrition/${nutri.next!.student_id}?consulta=1`)}
      />
    ) : isNutri && user && !nutriQ.isPending ? (
      // Sin más consultas hoy: cómo cerró el día (si hubo agenda).
      <DaySummaryCardV2 ownerId={user.id} tomorrowToRemind={nutri.tomorrow.length} onGo={(href) => navigate(href)} />
    ) : null

  return (
    <MotionConfig reducedMotion="user">
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

        {(isNutri || role === 'trainer') && user && !studentsQ.isPending ? (
          <div className="mb-8 empty:hidden">
            <GettingStartedV2
              ownerId={user.id}
              hasPatients={students.length > 0}
              onGo={(href) => navigate(href)}
              variant={isNutri ? 'nutritionist' : 'trainer'}
            />
          </div>
        ) : null}
        {/* Celu y tablet: la próxima consulta va antes que la agenda (en la compu, arriba de «Para hoy»). */}
        {nextConsult ? <div className="mb-8 empty:hidden lg:hidden">{nextConsult}</div> : null}
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="min-w-0">
            {nextConsult ? <div className="mb-8 hidden lg:block lg:empty:hidden">{nextConsult}</div> : null}
            <SectionTitleV2>Para hoy</SectionTitleV2>

            {missionsOn && !loading && doneTotal + pendingCount > 0 ? (
              <div className="mb-4 rounded-2xl bg-surface-inverse px-4 py-3 text-white ring-1 ring-inset ring-white/10">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[14px] font-medium">
                    Hoy completaste{' '}
                    <span className="tabular-nums" style={{ color: MISSION_ORANGE }}>
                      {doneTotal}/{doneTotal + pendingCount}
                    </span>
                  </p>
                  <p className="text-[12px] opacity-70">
                    {pendingCount === 0 ? '¡Misiones cumplidas!' : `${pendingCount} ${pendingCount === 1 ? 'pendiente' : 'pendientes'}`}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: MISSION_ORANGE }}
                    initial={false}
                    animate={{ width: `${(doneTotal / (doneTotal + pendingCount)) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 160, damping: 24 }}
                  />
                </div>
                {!missions.persistent ? (
                  <p className="mt-2 text-[11.5px] opacity-70">Falta correr el SQL 20261109120000_trainer_daily_tasks.sql: lo que tildes se pierde al recargar.</p>
                ) : null}
              </div>
            ) : null}

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
              <div className={TASK_LIST_V2}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-5 w-5 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : pendingCount === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="hh-pastel rounded-2xl bg-pastel-mint px-5 py-8 text-center"
              >
                <motion.span
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.1 }}
                  className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface-card text-pastel-mint-ink"
                >
                  <Check className="h-5 w-5" />
                </motion.span>
                <p className="text-[15px] font-medium text-pastel-mint-ink">Todo al día</p>
                <p className="mt-1 text-[13px] text-ink-secondary">
                  {isNutri
                    ? 'No hay turnos para recordar, cobros ni pacientes para revisar.'
                    : missionsOn && doneTotal
                      ? `Cumpliste las ${doneTotal} misiones de hoy.`
                      : 'No hay cobros, feedback ni rutinas pendientes para hoy.'}
                </p>
              </motion.div>
            ) : (
              <div className={TASK_LIST_V2}>
                <AnimatePresence mode="popLayout" initial>
                {orphans
                  .filter((row) => show(CATEGORY_FILTER[row.category] as Exclude<Filter, 'all'>))
                  .map((row) =>
                    T(
                      `orphan-${row.task_key}`,
                      <TaskCardV2
                        icon={CATEGORY_ICON[row.category]}
                        onCheck={() => missions.complete(row)}
                        title={row.title}
                        description={row.detail ?? undefined}
                        onOpen={row.href ? () => navigate(row.href!) : undefined}
                        tags={
                          <>
                            <TagV2 tone="neutral">{CATEGORY_LABEL[row.category]}</TagV2>
                            <TagV2 tone="rose">Vencida</TagV2>
                          </>
                        }
                        meta={<MetaChipV2 icon={CalendarDays}>{`Del ${fmtDay(row.first_seen_on)}`}</MetaChipV2>}
                        actions={
                          row.href ? (
                            <PillButtonV2
                              onClick={() => {
                                missions.complete(row)
                                navigate(row.href!)
                              }}
                            >
                              Abrir
                            </PillButtonV2>
                          ) : undefined
                        }
                      />,
                    ),
                  )}
                {show('turnos')
                  ? nutri.tomorrow.map((a) =>
                      T(
                        `turno-${a.id}`,
                        <TaskCardV2
                          title={a.full_name}
                          mark={<AvatarV2 name={a.full_name} />}
                          description={`Mañana a las ${fmtTime(a.starts_at)}. Mandale el recordatorio para que confirme.`}
                          onOpen={a.student_id ? () => navigate(`/nutrition/${a.student_id}`) : undefined}
                          tags={<TagV2 tone="neutral">Turno de mañana</TagV2>}
                          meta={<MetaChipV2 icon={CalendarClock}>{fmtTime(a.starts_at)}</MetaChipV2>}
                          actions={
                            <>
                              <PillButtonV2 onClick={() => markReminded(a.id)} title="Sacarlo de la lista sin mandar nada">
                                Ya le avisé
                              </PillButtonV2>
                              <PillButtonV2 primary icon={WhatsAppIcon} onClick={() => void remindAppointment(a)}>
                                Recordar
                              </PillButtonV2>
                            </>
                          }
                        />,
                      ),
                    )
                  : null}

                {show('seguimiento')
                  ? nutri.symptoms.map((p) =>
                      T(
                        `sintoma-${p.id}`,
                        <TaskCardV2
                          title={p.full_name}
                          mark={<AvatarV2 name={p.full_name} />}
                          description={`${p.detail} en su registro del ${fmtDay(p.loggedAt.slice(0, 10))}. Conviene escribirle antes de la próxima consulta.`}
                          onOpen={() => navigate(`/nutrition/${p.id}?tab=historia`)}
                          tags={
                            <>
                              <TagV2 tone="neutral">Seguimiento</TagV2>
                              <TagV2 tone="rose">Malestar o adherencia</TagV2>
                            </>
                          }
                          meta={<MetaChipV2 icon={HeartPulse}>{fmtDay(p.loggedAt.slice(0, 10))}</MetaChipV2>}
                          actions={
                            <>
                              <PillButtonV2 icon={WhatsAppIcon} title="Escribirle por WhatsApp" onClick={() => void sendOrCopy(`Hola ${firstName(p.full_name)}, vi tu registro. ¿Cómo seguís?`, p.phone)} />
                              <PillButtonV2 primary onClick={() => navigate(`/nutrition/${p.id}?tab=historia`)}>
                                Ver registro
                              </PillButtonV2>
                            </>
                          }
                        />,
                      ),
                    )
                  : null}

                {show('seguimiento') && nutri.overdue.length
                  ? T(
                      'controles',
                      <TaskCardV2
                        icon={Ruler}
                        title={`${nutri.overdue.length} ${nutri.overdue.length === 1 ? 'paciente necesita' : 'pacientes necesitan'} control y no tienen turno`}
                        description={names(nutri.overdue)}
                        onOpen={() => navigate('/nutrition')}
                        tags={<TagV2 tone="neutral">Seguimiento</TagV2>}
                        meta={<MetaChipV2 icon={Ruler}>Más de 6 semanas</MetaChipV2>}
                        actions={
                          <PillButtonV2 primary onClick={() => navigate('/nutrition')}>
                            Ver pacientes
                          </PillButtonV2>
                        }
                      />,
                    )
                  : null}

                {show('seguimiento') && nutri.anamnesis.length
                  ? T(
                      'anamnesis',
                      <TaskCardV2
                        icon={ClipboardList}
                        title={`${nutri.anamnesis.length} ${nutri.anamnesis.length === 1 ? 'anamnesis sin responder' : 'anamnesis sin responder'}`}
                        description={`${names(nutri.anamnesis)}. Les mandaste el link y todavía no la completaron.`}
                        onOpen={() => navigate(`/nutrition/${nutri.anamnesis[0]!.id}`)}
                        tags={<TagV2 tone="neutral">Seguimiento</TagV2>}
                        meta={<MetaChipV2 icon={ClipboardList}>Link enviado</MetaChipV2>}
                        actions={
                          <PillButtonV2 onClick={() => navigate(`/nutrition/${nutri.anamnesis[0]!.id}`)}>
                            Abrir
                          </PillButtonV2>
                        }
                      />,
                    )
                  : null}

                {show('semana')
                  ? weekly.map((r) => {
                      const c = WEEKLY_COPY[r.id]!
                      const key = missionKeys.weekly(r.id)
                      if (!isOpen(key)) return null
                      return (
                        T(`semana-${r.id}`, <TaskCardV2
                          icon={Megaphone}
                          {...missionCard(key)}
                          title={c.title}
                          description={c.meta}
                          tags={<TagV2 tone="neutral">Aviso de la semana</TagV2>}
                          meta={<MetaChipV2 icon={CalendarDays}>Hoy</MetaChipV2>}
                          actions={
                            <>
                              {missionsOn ? null : (
                                <PillButtonV2 icon={Check} onClick={() => markWeeklyDone(r.id)} title="Sacarlo por hoy">
                                  Listo
                                </PillButtonV2>
                              )}
                              <PillButtonV2
                                primary
                                onClick={() => {
                                  complete(key)
                                  navigate(c.href)
                                }}
                              >
                                {c.cta}
                              </PillButtonV2>
                            </>
                          }
                        />)
                      )
                    })
                  : null}

                {show('semana')
                  ? mealPlansEnding.map(({ m, days }) => {
                      const key = missionKeys.mealPlan(m.id)
                      if (!isOpen(key)) return null
                      const who = m.student?.full_name ?? 'Alumno'
                      return T(
                        key,
                        <TaskCardV2
                          {...missionCard(key)}
                          urgent={days <= 0}
                          title={`Plan de alimentación de ${who}`}
                          mark={<AvatarV2 name={who} />}
                          description={`«${m.title}». ${days < 0 ? `Venció hace ${-days} ${days === -1 ? 'día' : 'días'}` : days === 0 ? 'Vence hoy' : days === 1 ? 'Vence mañana' : `Vence en ${days} días`}: armá el que sigue.`}
                          onOpen={() => navigate(`/students/${m.student_id}`)}
                          tags={
                            <>
                              <TagV2 tone="neutral">Alimentación</TagV2>
                              {days <= 0 ? <TagV2 tone="rose">{days < 0 ? 'Vencido' : 'Vence hoy'}</TagV2> : null}
                              {overdueTag(key)}
                            </>
                          }
                          meta={<MetaChipV2 icon={UtensilsCrossed}>{fmtDay(m.end_date.slice(0, 10))}</MetaChipV2>}
                          actions={
                            <PillButtonV2
                              primary
                              onClick={() => {
                                complete(key)
                                navigate('/nutrition/planning')
                              }}
                            >
                              Armar el que sigue
                            </PillButtonV2>
                          }
                        />,
                      )
                    })
                  : null}

                {show('feedback') && missing.length && isOpen(missionKeys.missing) ? (
                  T('feedback-missing', <TaskCardV2
                    icon={MessageSquare}
                    {...missionCard(missionKeys.missing)}
                    title={`${missing.length} ${missing.length === 1 ? 'alumno no respondió' : 'alumnos no respondieron'} el feedback`}
                    description={names(missing)}
                    onOpen={() => navigate('/feedback')}
                    tags={
                      <>
                        <TagV2 tone="neutral">Feedback semanal</TagV2>
                        {overdueTag(missionKeys.missing)}
                      </>
                    }
                    meta={<MetaChipV2 icon={MessageSquare}>{`${answered}/${students.length}`}</MetaChipV2>}
                    actions={
                      <PillButtonV2
                        primary
                        onClick={() => {
                          complete(missionKeys.missing)
                          navigate('/feedback')
                        }}
                      >
                        Enviar
                      </PillButtonV2>
                    }
                  />)
                ) : null}

                {show('feedback') && unreplied && isOpen(missionKeys.unreplied) ? (
                  T('feedback-unreplied', <TaskCardV2
                    icon={MessageSquareReply}
                    {...missionCard(missionKeys.unreplied)}
                    title={`${unreplied} ${unreplied === 1 ? 'respuesta espera' : 'respuestas esperan'} tu devolución`}
                    description="Respuestas del último mes que todavía no contestaste."
                    onOpen={() => navigate('/feedback')}
                    tags={
                      <>
                        <TagV2 tone="neutral">Feedback semanal</TagV2>
                        {overdueTag(missionKeys.unreplied)}
                      </>
                    }
                    actions={
                      <PillButtonV2
                        primary
                        onClick={() => {
                          complete(missionKeys.unreplied)
                          navigate('/feedback')
                        }}
                      >
                        Responder
                      </PillButtonV2>
                    }
                  />)
                ) : null}

                {show('rutinas')
                  ? closing.map(({ student, st }) => {
                      const key = missionKeys.closing(student.id, st.submittedAt)
                      if (!isOpen(key)) return null
                      return T(
                        key,
                        <TaskCardV2
                          {...missionCard(key)}
                          urgent
                          title={
                            <>
                              {student.full_name}{' '}
                              <span className="font-normal text-ink-secondary">{st.finished ? 'cerró su mes' : 'está en su última semana'} · armá la que sigue</span>
                            </>
                          }
                          mark={<AvatarV2 name={student.full_name} />}
                          description={`Lo contó en su feedback${st.submittedAt ? ` del ${fmtDay(st.submittedAt.slice(0, 10))}` : ''}.`}
                          onOpen={() => navigate(`/students/${student.id}`)}
                          tags={
                            <>
                              <TagV2 tone="neutral">Rutina</TagV2>
                              <TagV2 tone="rose">{st.finished ? 'Cerró el mes' : 'Última semana'}</TagV2>
                              {overdueTag(key)}
                            </>
                          }
                          actions={
                            <PillButtonV2
                              primary
                              onClick={() => {
                                complete(key)
                                navigate(`/students/${student.id}`)
                              }}
                            >
                              Abrir ficha
                            </PillButtonV2>
                          }
                        />,
                      )
                    })
                  : null}

                {show('rutinas')
                  ? routines.ending.map(({ r, days }) => {
                      const who = r.student?.full_name ?? 'Alumno'
                      const key = missionKeys.routineEnd(r.id)
                      if (!isOpen(key)) return null
                      return (
                        T(`rutina-${r.id}`, <TaskCardV2
                          {...missionCard(key)}
                          title={r.name}
                          mark={<AvatarV2 name={who} />}
                          description={`${who}. ${days === 0 ? 'Termina hoy' : days === 1 ? 'Termina mañana' : `Termina en ${days} días`}: armá la que sigue.`}
                          onOpen={() => navigate(`/routines/${r.id}`)}
                          tags={
                            <>
                              <TagV2 tone="neutral">Rutina</TagV2>
                              {days <= 2 ? <TagV2 tone="rose">Por terminar</TagV2> : null}
                              {overdueTag(key)}
                            </>
                          }
                          meta={<MetaChipV2 icon={CalendarDays}>{fmtDay(r.end_date.slice(0, 10))}</MetaChipV2>}
                          actions={
                            <PillButtonV2
                              onClick={() => {
                                complete(key)
                                navigate(`/routines/${r.id}`)
                              }}
                            >
                              Abrir
                            </PillButtonV2>
                          }
                        />)
                      )
                    })
                  : null}

                {show('rutinas') && trains && routines.without.length && isOpen(missionKeys.without) ? (
                  T('rutinas-without', <TaskCardV2
                    icon={Users}
                    {...missionCard(missionKeys.without)}
                    title={`${routines.without.length} ${routines.without.length === 1 ? 'alumno' : 'alumnos'} sin rutina activa`}
                    description={names(routines.without)}
                    onOpen={() => navigate('/students')}
                    tags={
                      <>
                        <TagV2 tone="neutral">Rutina</TagV2>
                        {overdueTag(missionKeys.without)}
                      </>
                    }
                    meta={<MetaChipV2 icon={Users}>{`${withRoutine}/${routineTotal} con rutina`}</MetaChipV2>}
                    actions={
                      <PillButtonV2
                        onClick={() => {
                          complete(missionKeys.without)
                          navigate('/students')
                        }}
                      >
                        Ver alumnos
                      </PillButtonV2>
                    }
                  />)
                ) : null}

                {show('cobros')
                  ? payItems.map((r) => {
                      const debt = Math.max(0, r.expected - r.paid)
                      const isToday = r.timing === 'hoy'
                      const overdue = r.reminder === 'overdue'
                      const key = missionKeys.cobro(r)
                      if (!isOpen(key)) return null
                      return (
                        T(`cobro-${r.studentId}`, <TaskCardV2
                          {...missionCard(key)}
                          title={r.fullName}
                          mark={<AvatarV2 name={r.fullName} />}
                          onOpen={() => navigate(isNutri ? `/nutrition/${r.studentId}` : `/students/${r.studentId}`)}
                          description={
                            isToday
                              ? 'Hoy es su día de pago. Mandale el recordatorio armado.'
                              : overdue
                                ? 'Pasaron 7 días hábiles desde el vencimiento.'
                                : 'Ya venció y todavía no figura el pago.'
                          }
                          tags={
                            <>
                              <TagV2 tone="neutral">Cobro</TagV2>
                              <TagV2 tone={isToday ? 'butter' : 'rose'}>{isToday ? 'Vence hoy' : overdue ? 'Atrasado' : 'Vencido'}</TagV2>
                              {overdueTag(key)}
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
                              <PillButtonV2
                                onClick={() => {
                                  complete(key)
                                  void dismiss(r)
                                }}
                                icon={CheckCheck}
                                title="Ya le avisé: sacarlo de la lista sin mandar nada"
                              />
                              <PillButtonV2
                                primary
                                icon={WhatsAppIcon}
                                onClick={() => {
                                  complete(key)
                                  void remind(r)
                                }}
                              >
                                Recordar
                              </PillButtonV2>
                            </>
                          }
                        />)
                      )
                    })
                  : null}

                </AnimatePresence>
                {filter !== 'all' && counts[filter] === 0 ? (
                  <p className="col-span-full rounded-2xl bg-surface-panel px-5 py-6 text-center text-[13px] text-ink-muted">
                    Nada pendiente acá.
                  </p>
                ) : null}
              </div>
            )}
            {doneToday.length ? (
              <div className="mt-5">
                <p className="mb-2 text-[12px] font-medium text-ink-muted">Hechas hoy · {doneToday.length}</p>
                <ul className="space-y-1.5">
                  <AnimatePresence initial={false}>
                    {doneToday.map((row) => (
                      <motion.li
                        key={row.task_key}
                        layout
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-3 rounded-xl bg-status-ok/[0.08] px-3 py-2"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-status-ok text-white">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-secondary line-through decoration-ink-muted/60">
                          {row.title}
                        </span>
                        <span className="hidden shrink-0 text-[11.5px] text-ink-muted sm:inline">{CATEGORY_LABEL[row.category]}</span>
                        <button
                          type="button"
                          onClick={() => void undoMission(row)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[12px] text-ink-muted transition-colors hover:bg-surface-elevated hover:text-ink-primary"
                          title="Volver a pendiente"
                        >
                          <RotateCcw className="h-3 w-3" /> Deshacer
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </div>
            ) : null}
          </section>

          <aside className="space-y-4 max-lg:contents">
            <CardV2
              // En el celu: para la nutricionista la agenda va primero; para el entrenador, «Para hoy».
              className={isNutri ? 'max-lg:order-first' : undefined}
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
                  dayAppointments.map((a) => (
                    <div key={a.id} className="rounded-xl bg-surface-panel px-3.5 py-3">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-primary">
                          {a.student?.full_name ?? a.title}
                        </p>
                        {a.status === 'confirmed' ? (
                          <span className="inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-surface-card px-2 text-[11px] font-medium text-ink-secondary ring-1 ring-inset ring-surface-border">
                            <Check className="h-3 w-3 text-status-active" />
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
    </MotionConfig>
  )
}

