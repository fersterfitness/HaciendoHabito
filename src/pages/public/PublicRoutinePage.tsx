import { Fragment, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarHeart, Check, ChevronDown, ChevronLeft, Lock, Dumbbell, Flame, LifeBuoy, Link2, MessageCircle, Pin, Play, TrendingUp } from 'lucide-react'
import {
  currentBlockIndex,
  exerciseDetails,
  fetchSharedPastRoutine,
  fetchSharedRoutine,
  formatKg,
  groupExercises,
  saveSharedSet,
  isSetComplete,
  parseKg,
  parseReps,
  repsText,
  isTimeReps,
  effortLabel,
  setsRepsText,
  type SharedRoutine,
  type SharedRoutineDay,
  type SharedRoutineExercise,
  canPreviewRoutine,
} from '@/lib/routine/sharedRoutine'
import { barKgOf, parseExerciseMeta, perSideKg, plannedWeightText, weightModeOf } from '@/lib/routine/exerciseMeta'
import { formatWarmupDisplayLines } from '@/lib/routine/warmupNotesFormat'
import { splitWarmupLine, type WarmupMedia } from '@/lib/routine/warmupMedia'
import { COACH_NOTE_MAX, coachNoteKey, dismissSharedCoachNote, fetchCoachNotes, fetchShareOwner, markSharedCoachNoteSeen, saveCoachNote, type CoachNote } from '@/lib/routine/coachNotes'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import './public-routine.css'
import { setPublicPreview } from '@/lib/supabasePublic'
import { EMPTY_DAY_LOG, exerciseNoteKey, fetchSharedExtras, hasCheckin, saveSharedDayStatus, type DayLog, type ExerciseFeedback, type RoutineNoticeKind, type SetWeightMode, type SharedCoachNote, type TrainingExtras } from '@/lib/routine/studentTrainingLog'
import { DayCheckinCard, DayCheckinSummary, DayCloseCard, ExerciseFeedbackBox, RoutineNoticeCard, SelfNoteBox, UrgentCard } from './PublicRoutineLog'
import { weekClose, weekCloseMessage } from '@/lib/routine/trainingWeek'
import { fetchSharedStudentExtras, type StudentExtras } from '@/lib/routine/studentAppExtras'
import { CycleCard, MonthReviewCard, PaymentBanner, ProgressCard } from './PublicRoutineExtras'
import { RoutineHistoryCard } from './PublicRoutineHistory'
import { movementArtwork, routineAthlete, type Athlete } from '@/lib/routine/exerciseArtwork'
import { clockLabel, previousLabel, previousSetsByExercise } from '@/lib/routine/previousSets'
import { progressWeekIndex, startDayIndex } from '@/lib/routine/routineProgress'

/**
 * Rutina que abre el alumno desde el link (sin cuenta). Dos cosas separadas:
 * - El entrenamiento: días de la semana y ejercicios, donde anota los kilos de cada serie (el entrenador los ve).
 * - El feedback de la semana: tarjeta propia que se responde acá mismo, pregunta por pregunta, y queda
 *   a la vista (y en la barra de abajo en el celu) hasta que se envía.
 * En el celu es una columna; en la compu, a la izquierda el resumen y el feedback, a la derecha el entrenamiento.
 *
 * Recursos locales compartidos con la app; los ejercicios conservan su foto cuando está disponible.
 */

function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function dateLabel(ymd: string | null | undefined, pattern = "d 'de' MMMM"): string | null {
  if (!ymd) return null
  const d = new Date(ymd.length === 10 ? ymd + 'T12:00:00' : ymd)
  return Number.isNaN(d.getTime()) ? null : format(d, pattern, { locale: es })
}

const KEEP_UPPER = new Set(['RM', 'TRX', 'RDL', 'KB', 'DB', 'BOSU', 'HIIT', 'EMOM', 'AMRAP', 'RIR', 'RPE', 'TRX', 'SL'])

/**
 * Mayúsculas prolijas: si el texto viene casi todo en mayúsculas («PLANCHA LATERAL (ACTV. GLÚTEO MEDIO)»)
 * pasa a tipo oración («Plancha lateral (actv. glúteo medio)»). El resto queda como lo escribió el entrenador.
 */
function niceCase(raw: string | null | undefined): string {
  const t = (raw ?? '').trim().replace(/\s+/g, ' ')
  const letters = t.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
  if (letters.length < 4) return t
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '').length
  if (upper / letters.length < 0.7) return t
  const lower = t
    .toLocaleLowerCase('es')
    .split(' ')
    .map((w) => {
      const bare = w.replace(/[^a-zñ]/gi, '').toUpperCase()
      return KEEP_UPPER.has(bare) ? w.toUpperCase() : w
    })
    .join(' ')
  return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
}

/** Series en las que se puede anotar (1 a 10). */
function setCount(ex: SharedRoutineExercise): number {
  return Math.min(Math.max(ex.sets ?? 1, 1), 10)
}

/** Kilos anotados: id de ejercicio → número de serie → kg. */
type LoggedSet = { kg: number | null; reps: number | null; completed: boolean; mode?: SetWeightMode }
type LoggedMap = Record<string, Record<number, LoggedSet>>

/** Suma a lo anotado si cada serie fue por lado (viene aparte, en los extras). Lo guardado en esta visita manda. */
function withSetModes(logged: LoggedMap, modes: TrainingExtras['setModes']): LoggedMap {
  if (!modes) return logged
  const out: LoggedMap = {}
  for (const [exId, sets] of Object.entries(logged)) {
    const m: Record<number, LoggedSet> = {}
    for (const [n, l] of Object.entries(sets)) m[Number(n)] = l.mode || l.kg == null ? l : { ...l, mode: modes[exId]?.[Number(n)] ?? 'total' }
    out[exId] = m
  }
  return out
}

function loggedFrom(data: SharedRoutine | null): LoggedMap {
  const out: LoggedMap = {}
  for (const b of data?.routine?.blocks ?? [])
    for (const d of b.days)
      for (const ex of d.exercises) {
        const m: Record<number, LoggedSet> = {}
        for (const l of ex.logs ?? []) m[l.set] = { kg: l.weight_kg == null ? null : Number(l.weight_kg), reps: l.reps == null ? null : Number(l.reps), completed: isSetComplete(l) }
        out[ex.id] = m
      }
  return out
}

function exerciseProgress(ex: SharedRoutineExercise, logged: LoggedMap): { done: number; total: number } {
  const total = setCount(ex)
  const m = logged[ex.id] ?? {}
  let done = 0
  for (let s = 1; s <= total; s++) if (m[s]?.completed) done += 1
  return { done, total }
}

function dayProgress(day: SharedRoutineDay, logged: LoggedMap): { done: number; total: number } {
  return day.exercises.reduce(
    (acc, ex) => {
      const p = exerciseProgress(ex, logged)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )
}

/** Como los días de un calendario: «Día A» → «Día» / «A»; «Lunes» → «Lun» / número del día. */
function dayChip(name: string | null | undefined, i: number): { label: string; big: string } {
  const t = name?.trim() ?? ''
  const m = /^d[ií]a\s+(\S{1,3})$/i.exec(t)
  if (m) return { label: 'Día', big: m[1]!.toUpperCase() }
  return { label: t ? niceCase(t).slice(0, 3) : 'Día', big: String(i + 1) }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase() || 'H'
}

/** Categorías visuales de los ejercicios y recursos de la página. */
type ArtName = 'piernas' | 'empuje' | 'traccion' | 'core' | 'cardio' | 'movilidad' | 'general' | 'calor' | 'feedback' | 'semana'

/** Tipo de ejercicio por el nombre, para elegir la ilustración. El orden importa: «plancha … glúteo» es core. */
function exerciseArt(name: string | null | undefined): ArtName {
  const n = (name ?? '').toLocaleLowerCase('es')
  if (/plancha|abdominal|crunch|\bcore\b|pallof|hollow|dead ?bug|rueda|oblicu|bird ?dog|antirrota|antirota/.test(n)) return 'core'
  if (/salto|jump|sprint|bici|cinta|soga|burpee|carrera|trote|skipping|assault|el[ií]ptic|cardio/.test(n)) return 'cardio'
  if (/movilidad|estiramiento|elongaci|foam|rodillo|respiraci|yoga/.test(n)) return 'movilidad'
  if (/\bremo\b|dominada|jal[oó]n|pull|curl|b[ií]ceps|pullover|tracci/.test(n)) return 'traccion'
  if (/press|flexi[oó]n|push|fondo|tr[ií]ceps|militar|vuelos|laterales|apertura|pecho/.test(n)) return 'empuje'
  if (/sentadilla|squat|estocada|zancada|split|peso muerto|rdl|hip ?thrust|puente|gl[uú]te|prensa|camilla|cu[aá]dri|isquio|gemelo|pantorrilla|aductor|abductor|step/.test(n))
    return 'piernas'
  return 'general'
}

/** Imagen 3D con respaldo: si el archivo no está, muestra `fallback`. */
function Art({ name, fallback, className }: { name: ArtName; fallback: ReactNode; className?: string }) {
  const [failed, setFailed] = useState(false)
  const asset = name === 'feedback' ? 'notebook' : name === 'semana' ? 'clock' : name === 'calor' ? null : 'routines'
  if (!asset) return <>{fallback}</>
  if (failed) return <>{fallback}</>
  return <img className={className ?? 'hhr-art'} src={`/icons/3dicons/kpi/${asset}.png`} alt="" loading="lazy" onError={() => setFailed(true)} />
}

/** Personaje según el sexo del alumno: en pausa (descansando), terminada (festejando) o sin rutina (con la planilla). */
function Mascot({ athlete, mood, className }: { athlete: Athlete; mood: 'pause' | 'done' | 'coach'; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <img className={className ?? 'hhr-mascot'} src={`/routine/mascots/${athlete}-${mood}.webp`} alt="" onError={() => setFailed(true)} />
}

/** Aclaración del circuito que escribe el entrenador (vueltas, pausas, macropausa): está en el primer ejercicio que la tenga. */
function circuitNoteOf(items: SharedRoutineExercise[]): string {
  for (const ex of items) {
    const note = parseExerciseMeta(ex.technical_notes).meta.circuitNote?.trim()
    if (note) return note
  }
  return ''
}

export function PublicRoutinePage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; data: SharedRoutine | null }>({
    status: 'loading',
  })
  const [week, setWeek] = useState<number | null>(null)
  const [day, setDay] = useState(0)
  // Feedback nov27 (A): semana bloqueada que tocó el alumno, para explicarle qué le falta.
  const [lockTapped, setLockTapped] = useState<number | null>(null)
  const [logged, setLogged] = useState<LoggedMap>({})
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const trainRef = useRef<HTMLElement | null>(null)
  // Notas, esfuerzo, chequeo y cierre de cada día. `null`: todavía no está activado en la base.
  const [extras, setExtras] = useState<TrainingExtras | null>(null)

  // Ciclo, devolución de fin de mes y recordatorio de pago. `null`: todavía no está activado.
  const [studentExtras, setStudentExtras] = useState<StudentExtras | null>(null)
  const [reviewSent, setReviewSent] = useState(false)

  useLightPage()

  // Vista previa del entrenador (?vista=entrenador, solo si es el dueño del link): no guarda nada y,
  // salvo que la pida, no muestra el chequeo ni los avisos obligatorios.
  const [search] = useSearchParams()
  // Feedback nov19 (tanda 4): «Ver como profe» (?vista=profe) muestra todo lo que cargó el alumno sin dejar
  // tocar nada; solo se puede escribir la nota para el alumno de cada ejercicio.
  const wantsCoach = search.get('vista') === 'profe'
  const wantsPreview = search.get('vista') === 'entrenador' || wantsCoach
  // Feedback nov24 (10): ?rutina=<id> muestra una rutina anterior del historial, solo para ver.
  const pastId = search.get('rutina')
  const pastView = !!pastId
  const [preview, setPreview] = useState<'checking' | 'on' | 'off'>(wantsPreview ? 'checking' : 'off')
  const [previewGates, setPreviewGates] = useState(false)
  useEffect(() => {
    if (!wantsPreview) return
    let alive = true
    void canPreviewRoutine(token)
      .catch(() => false)
      .then((ok) => {
        if (!alive) return
        setPublicPreview(ok)
        setPreview(ok ? 'on' : 'off')
      })
    return () => {
      alive = false
      setPublicPreview(false)
    }
  }, [wantsPreview, token])
  const coachView = wantsCoach && preview === 'on'
  const gatesOff = pastView || (preview === 'on' && (coachView || !previewGates))
  // Sin tocar nada: «Ver como profe» o una rutina anterior.
  const viewOnly = coachView || pastView
  // Notas para el alumno: en «Ver como profe» se leen y escriben con la sesión del entrenador.
  const [coachEdit, setCoachEdit] = useState<{ ownerId: string; studentId: string; notes: Record<string, CoachNote> } | null>(null)
  useEffect(() => {
    if (!coachView) return
    let alive = true
    void (async () => {
      const owner = await fetchShareOwner(token).catch(() => null)
      if (!owner) return
      const notes = await fetchCoachNotes(owner.student_id).catch(() => null)
      if (alive && notes) setCoachEdit({ ownerId: owner.owner_id, studentId: owner.student_id, notes })
    })()
    return () => {
      alive = false
    }
  }, [coachView, token])

  // Celular (estilo app): una pestaña por sección, con la barra abajo. En la compu se ve todo junto.
  const [tab, setTab] = useState<AppTab>('entrenar')
  const goTab = (t: AppTab) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }
  useInstallableRoutine()

  useEffect(() => {
    let alive = true
    void fetchSharedExtras(token).then((x) => {
      if (alive) setExtras(x)
    })
    void fetchSharedStudentExtras(token).then((x) => {
      if (alive) setStudentExtras(x)
    })
    return () => {
      alive = false
    }
  }, [token])

  const onExerciseFeedback = useCallback((exId: string, fb: ExerciseFeedback) => {
    setExtras((prev) => (prev ? { ...prev, exercises: { ...prev.exercises, [exId]: fb } } : prev))
  }, [])
  const onSelfNote = useCallback((key: string, note: string) => {
    setExtras((prev) => {
      if (!prev) return prev
      const next = { ...(prev.selfNotes ?? {}) }
      if (note) next[key] = note
      else delete next[key]
      return { ...prev, selfNotes: next }
    })
  }, [])
  const onDayLog = useCallback((dayId: string, patch: Partial<DayLog>) => {
    setExtras((prev) => (prev ? { ...prev, days: { ...prev.days, [dayId]: { ...(prev.days[dayId] ?? EMPTY_DAY_LOG), ...patch } } } : prev))
  }, [])

  const load = useCallback(
    (quiet: boolean) => {
      if (!quiet) setState({ status: 'loading' })
      return (pastId ? fetchSharedPastRoutine(token, pastId) : fetchSharedRoutine(token))
        .then((data) => {
          setState({ status: 'ok', data })
          setLogged((prev) => ({ ...loggedFrom(data), ...(quiet ? prev : {}) }))
        })
        .catch(() => {
          if (!quiet) setState({ status: 'error' })
        })
    },
    [token, pastId],
  )

  useEffect(() => {
    void load(false)
    // Si el entrenador cambia algo mientras el alumno tiene la página abierta, al volver se ve.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  const data = state.status === 'ok' ? state.data : null
  const routine = data?.routine ?? null
  const firstName = niceCase(data?.student_first_name)

  useEffect(() => {
    document.title = firstName ? `Rutina de ${firstName}` : 'Tu rutina'
  }, [firstName])

  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current || !routine || !extras) return
    startedRef.current = true
    const x = progressInput(extras, logged)
    const w = progressWeekIndex(routine.blocks, x)
    setWeek(w)
    setDay(startDayIndex(routine.blocks, w, x))
  }, [routine, extras, logged])

  const kgOf = useCallback(
    (exId: string) =>
      Object.values(logged[exId] ?? {})
        .map((l) => l.kg)
        .filter((k): k is number => k != null),
    [logged],
  )

  // Para saber, al guardar una serie, si ese día estaba marcado «no entrenado».
  const extrasRef = useRef(extras)
  extrasRef.current = extras
  const routineRef = useRef(routine)
  routineRef.current = routine

  const onSaved = useCallback(
    (exId: string, set: number, value: LoggedSet) => {
      setLogged((prev) => {
        const m = { ...(prev[exId] ?? {}) }
        m[set] = value
        return { ...prev, [exId]: m }
      })
      // Si marcó una serie en un día que había dado por «no entrenado», entrenó al final: se saca esa marca
      // (si no, el día seguiría figurando como no entrenado para el alumno y para el entrenador).
      if (!value.completed) return
      const dayId = routineRef.current?.blocks.flatMap((b) => b.days).find((d) => d.exercises.some((e) => e.id === exId))?.id
      if (!dayId || extrasRef.current?.days[dayId]?.status !== 'missed') return
      onDayLog(dayId, { status: null, status_date: null, missed_reason: '' })
      void saveSharedDayStatus(token, dayId, { status: null, date: todayYmd() }).catch(() => {
        // Si falla, la marca vuelve a mostrarse y el alumno puede deshacerla a mano.
        void fetchSharedExtras(token).then((x) => setExtras(x))
      })
    },
    [token, onDayLog],
  )

  if (state.status === 'loading' || preview === 'checking') {
    return (
      <Shell>
        <div className="hhr-skeleton" aria-busy="true" aria-label="Cargando tu rutina">
          <span className="hhr-sk hhr-sk-title" />
          <span className="hhr-sk hhr-sk-hero" />
          <span className="hhr-sk hhr-sk-card" />
          <span className="hhr-sk hhr-sk-card" />
        </div>
      </Shell>
    )
  }
  if (state.status === 'error' || !data) {
    return (
      <Shell>
        <div className="hhr-state">
          <span className="hhr-state-icon" aria-hidden>
            <Art name="general" className="hhr-art-lg" fallback={<Dumbbell size={26} strokeWidth={1.8} />} />
          </span>
          <h1>Este link no funciona</h1>
          <p>Puede que tu entrenador haya generado uno nuevo. Pedile el link actualizado.</p>
        </div>
      </Shell>
    )
  }

  // Rutina que el entrenador ve como «Sin rutina activa» (pausada, cancelada, terminada): no se deja anotar,
  // así lo que ve el alumno coincide con lo que ve el entrenador. Sin `status` (base sin la migración) se muestra como siempre.
  const inactiveStatus = !pastView && routine?.status && !['activa', 'por_vencer'].includes(routine.status) ? routine.status : null
  if (inactiveStatus) {
    const wa = normalizePhoneForWhatsApp(data.professional_phone)
    const pro = data.professional_name && !data.professional_name.includes('@') ? niceCase(data.professional_name.trim().split(/\s+/)[0]) : ''
    const title = inactiveStatus === 'completada' ? 'Terminaste esta rutina' : inactiveStatus === 'pausada' ? 'Tu rutina está en pausa' : 'No tenés una rutina activa'
    const who = routineAthlete(data.student_gender ?? data.feedback?.gender)
    const mood = inactiveStatus === 'completada' ? 'done' : inactiveStatus === 'pausada' ? 'pause' : 'coach'
    return (
      <Shell>
        <div className="hhr-state">
          {who ? (
            <Mascot athlete={who} mood={mood} />
          ) : (
            <span className="hhr-state-icon" aria-hidden>
              <Art name="general" className="hhr-art-lg" fallback={<Dumbbell size={26} strokeWidth={1.8} />} />
            </span>
          )}
          <h1>{title}</h1>
          <p>
            {inactiveStatus === 'completada'
              ? `Cuando ${pro || 'tu entrenador'} te arme la próxima, la vas a ver en este mismo link.`
              : `Por ahora no hay nada para anotar. Cuando ${pro || 'tu entrenador'} la active, la vas a ver en este mismo link.`}
          </p>
          {wa ? (
            <a className="hhr-cta hhr-state-cta" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle size={18} strokeWidth={1.8} aria-hidden /> Escribirle{pro ? ` a ${pro}` : ''}
            </a>
          ) : null}
          <RoutineHistoryCard token={token} items={[...(routine?.id ? [{ ...routine, id: routine.id, objective: routine.objective, status: routine.status ?? '', days_done: -1 }] : []), ...(data.history ?? [])]} />
        </div>
      </Shell>
    )
  }

  const blocks = routine?.blocks ?? []
  const today = todayYmd()
  // Feedback nov19: la semana en curso sale del avance del alumno, no de las fechas del bloque.
  const currentWeek = extras ? progressWeekIndex(blocks, progressInput(extras, logged)) : currentBlockIndex(blocks, today)
  // Semanas como niveles: las de adelante se desbloquean al cerrar la anterior (en la vista previa, todas abiertas).
  const lockedWeek = (i: number) => !!extras && preview !== 'on' && !pastView && i > currentWeek
  // Días de la semana en curso que todavía no cerró («Terminé este entrenamiento» o «No pude entrenar»).
  const unclosedDays =
    extras && blocks.length > currentWeek + 1
      ? (blocks[currentWeek]?.days ?? [])
          .map((d, idx) => ({ d, idx }))
          .filter(({ d }) => d.exercises.length > 0 && !extras.days[d.id]?.status)
      : []
  // Aviso: si tocó una semana bloqueada, o si ya entrenó todos los días que le faltan cerrar (tildó series)
  // pero no tocó «Terminé»: así no se queda trabado sin saber por qué.
  const lockHint =
    unclosedDays.length > 0 &&
    (lockTapped != null || unclosedDays.every(({ d }) => progressInput(extras!, logged).hasSets(d)))
      ? {
          next: niceCase(blocks[lockTapped ?? currentWeek + 1]?.name) || `Semana ${(lockTapped ?? currentWeek + 1) + 1}`,
          current: niceCase(blocks[currentWeek]?.name) || `Semana ${currentWeek + 1}`,
          days: unclosedDays.map(({ d, idx }) => d.day_name?.trim() || `Día ${idx + 1}`),
        }
      : null
  const wi = Math.min(week ?? currentWeek, Math.max(0, blocks.length - 1))
  const block = blocks[wi]
  const days = block?.days ?? []
  const di = Math.min(day, Math.max(0, days.length - 1))
  const selectedDay = days[di]
  const waDigits = normalizePhoneForWhatsApp(data.professional_phone)
  const proFirst = data.professional_name && !data.professional_name.includes('@') ? niceCase(data.professional_name.trim().split(/\s+/)[0]) : ''
  const proLabel = proFirst || 'tu entrenador'
  const athlete = routineAthlete(data.student_gender ?? data.feedback?.gender)
  const until = dateLabel(routine?.end_date)
  const updated = dateLabel(routine?.updated_at)
  const warmup = selectedDay?.warmup_notes ? formatWarmupDisplayLines(selectedDay.warmup_notes) : []
  const weekBlock = blocks[currentWeek]
  const weekProgress = (weekBlock?.days ?? []).reduce(
    (acc, d) => {
      const p = dayProgress(d, logged)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )
  const pct = weekProgress.total ? Math.round((weekProgress.done / weekProgress.total) * 100) : 0
  const todayLabel = format(new Date(), "EEEE d 'de' MMMM", { locale: es })
  const selectedProgress = selectedDay ? dayProgress(selectedDay, logged) : { done: 0, total: 0 }
  const dayLog = selectedDay && extras ? (extras.days[selectedDay.id] ?? EMPTY_DAY_LOG) : null
  // Antes de empezar un día se pide el chequeo (se puede dejar para después).
  // Semana en curso: cuántos días cerró. De eso depende cuándo se habilita el formulario semanal
  // (viernes a domingo, o en su último día de entrenamiento) y el mensaje de cierre de semana.
  const weekState = extras ? weekClose((weekBlock?.days ?? []).map((d) => d.id), (id) => extras.days[id]?.status) : null
  const closeMessage = weekState ? weekCloseMessage(weekState, { isLastWeek: blocks.length > 1 && currentWeek === blocks.length - 1 }) : null
  // Mes terminado: última semana con todos los días cerrados. Ahí se pide la devolución.
  const monthDone = !!weekState && weekState.total > 0 && weekState.open === 0 && currentWeek === blocks.length - 1
  const reviewDayId = blocks[0]?.days[0]?.id ?? null
  const reviewDone = reviewSent || (!!reviewDayId && !!studentExtras?.reviewed_days.includes(reviewDayId))
  const isWoman = /^(f|mujer|femenin)/i.test((data.student_gender ?? data.feedback?.gender ?? '').trim())
  // Último día de la semana en curso (le queda solo este por cerrar): el chequeo suma pasos y ciclo.
  const closesWeek = !!weekState && wi === currentWeek && weekState.total > 0 && weekState.open <= 1 && !dayLog?.status
  const askCheckin =
    !gatesOff && !!selectedDay && !!dayLog && selectedDay.exercises.length > 0 && !hasCheckin(dayLog) && !dayLog.status && selectedProgress.done === 0
  // Avisos obligatorios antes del chequeo (puntos 7 y 13): primer día de la última semana, último día de
  // cada semana y último día de la rutina. Solo en la semana en curso y con la migración corrida.
  const notices = extras?.notices
  const selBlock = blocks[wi]
  const lastIdx = blocks.length - 1
  const sentNotice = (kind: RoutineNoticeKind) => !!selBlock && !!notices?.some((n) => n.block_id === selBlock.id && n.kind === kind)
  const noticeGate: RoutineNoticeKind | null =
    gatesOff || !notices || !selBlock || !selectedDay || !dayLog || dayLog.status || selectedDay.exercises.length === 0 || wi !== currentWeek
      ? null
      : blocks.length > 1 && wi === lastIdx && !sentNotice('last_week')
        ? 'last_week'
        : closesWeek && wi === lastIdx && !sentNotice('routine_done')
          ? 'routine_done'
          : closesWeek && wi !== lastIdx && !sentNotice('week_done')
            ? 'week_done'
            : null
  // Rutina terminada: la devolución final (testimonio) es obligatoria y queda sola en pantalla.
  const reviewDue = !gatesOff && !!studentExtras && monthDone && !!reviewDayId && !reviewDone
  const blocked = askCheckin || !!noticeGate
  // La lista prioriza explorar la rutina; cada alumno abre el ejercicio que va a realizar.
  const isOpen = (id: string) => !!openMap[id]
  const toggle = (id: string) => setOpenMap((prev) => (prev[id] ? {} : { [id]: true }))
  const openNext = (id: string) => {
    setOpenMap({ [id]: true })
    requestAnimationFrame(() => document.getElementById(`hhr-card-${id}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }))
  }
  let number = 0

  // Con el modo de cada serie (total o por lado), si ya está la migración del peso por lado.
  const loggedView = withSetModes(logged, extras?.setModes)
  // «Anterior» en la tabla de series: lo que anotó la última vez que hizo ese ejercicio.
  const previous = previousSetsByExercise(blocks, loggedView)
  const groups = selectedDay ? groupExercises(selectedDay.exercises) : []
  const groupOpen = (gi: number) => !!groups[gi]?.items.some((e) => isOpen(e.id))
  const nextOf = (gi: number) => {
    const g = groups[gi + 1]
    if (!g) return null
    const label = g.circuit ? `Circuito: ${g.items.map((e) => niceCase(e.name) || 'Ejercicio').join(' + ')}` : niceCase(g.items[0]!.name) || 'Siguiente'
    return { label, go: () => openNext(g.items[0]!.id) }
  }

  /** El alumno oculta la nota del entrenador; si falla, vuelve a aparecer al recargar los extras. */
  function hideCoachNote(key: string) {
    setExtras((prev) => {
      if (!prev?.coachNotes) return prev
      const rest = { ...prev.coachNotes }
      delete rest[key]
      return { ...prev, coachNotes: rest }
    })
    void dismissSharedCoachNote(token, key).catch(() => void fetchSharedExtras(token).then((x) => setExtras(x)))
  }

  /** El alumno marca «Lo vi» en una nota (en la vista previa no se guarda). */
  function markCoachNoteSeen(id: string, seen: boolean) {
    setExtras((prev) =>
      prev?.coachNoteItems
        ? { ...prev, coachNoteItems: prev.coachNoteItems.map((n) => (n.id === id ? { ...n, seen_at: seen ? new Date().toISOString() : null } : n)) }
        : prev,
    )
    if (preview === 'on') return
    void markSharedCoachNoteSeen(token, id, seen).catch(() => void fetchSharedExtras(token).then((x) => setExtras(x)))
  }
  const coachNoteItems = extras?.coachNoteItems ?? []

  async function saveCoachEditorNote(key: string, note: string) {
    if (!coachEdit) return
    const saved = await saveCoachNote(coachEdit.ownerId, coachEdit.studentId, key, note)
    setCoachEdit((prev) => {
      if (!prev) return prev
      const notes = { ...prev.notes }
      if (saved) notes[key] = saved
      else delete notes[key]
      return { ...prev, notes }
    })
  }

  function card(ex: SharedRoutineExercise, gi: number, inCircuit = false) {
    const n = ++number
    const g = groups[gi]
    const lastInGroup = !g || g.items[g.items.length - 1]?.id === ex.id
    return (
      <ExerciseCard
        key={ex.id}
        ex={ex}
        athlete={athlete}
        n={n}
        flat={inCircuit}
        token={token}
        logged={loggedView[ex.id] ?? {}}
        weightModeOn={!!extras?.setModes}
        readOnly={viewOnly}
        coachNote={coachView ? null : (extras?.coachNotes?.[coachNoteKey(ex.name)]?.note ?? null)}
        onHideCoachNote={() => hideCoachNote(coachNoteKey(ex.name))}
        coachNoteItems={pastView ? [] : coachNoteItems.filter((x) => x.exercise_id === ex.id)}
        onCoachNoteSeen={markCoachNoteSeen}
        coachEditor={coachView && coachEdit && coachNoteKey(ex.name) ? {
          value: coachEdit.notes[coachNoteKey(ex.name)]?.note ?? '',
          hidden: !!coachEdit.notes[coachNoteKey(ex.name)]?.dismissed_at,
          studentLabel: firstName || 'el alumno',
          onSave: (note) => saveCoachEditorNote(coachNoteKey(ex.name), note),
        } : null}
        open={inCircuit ? groupOpen(gi) : isOpen(ex.id)}
        onToggle={() => (inCircuit && groupOpen(gi) ? setOpenMap({}) : toggle(ex.id))}
        onSaved={onSaved}
        proLabel={proLabel}
        feedback={extras ? (extras.exercises[ex.id] ?? { note: '', effort: null }) : null}
        onFeedbackSaved={onExerciseFeedback}
        selfNote={extras?.selfNotes && exerciseNoteKey(ex.name) ? (extras.selfNotes[exerciseNoteKey(ex.name)] ?? '') : null}
        onSelfNoteSaved={onSelfNote}
        previous={previous[ex.id]}
        next={nextOf(gi)}
        foot={lastInGroup}
      />
    )
  }

  const showCycle = !!studentExtras && isWoman
  const appTabs: { id: AppTab; label: string; icon: typeof Dumbbell }[] = [
    { id: 'entrenar', label: 'Entrenar', icon: Dumbbell },
    { id: 'progreso', label: 'Progreso', icon: TrendingUp },
    ...(showCycle ? [{ id: 'ciclo' as const, label: 'Ciclo', icon: CalendarHeart }] : []),
    ...(extras && !viewOnly ? [{ id: 'consulta' as const, label: 'Consulta', icon: LifeBuoy }] : []),
  ]
  const heroLine =
    weekProgress.total === 0
      ? 'Todavía no hay series cargadas'
      : pct === 100
        ? 'Semana completa'
        : weekProgress.done === 0
          ? 'Marcá tus series a medida que entrenás'
          : `Te faltan ${weekProgress.total - weekProgress.done} series esta semana`

  return (
    <Shell>
      {coachView ? (
        <div className="hhr-preview" role="status">
          <span>
            <b>Vista del entrenador.</b> Ves lo que cargó {firstName || 'el alumno'}: series, kilos, chequeos y notas. No se puede modificar nada
            {coachEdit ? '; solo podés dejarle una nota en cada ejercicio.' : '.'}
          </span>
        </div>
      ) : pastView ? (
        <div className="hhr-preview" role="status">
          <span>
            <b>Rutina anterior.</b> Es solo para ver lo que hiciste; no se puede anotar nada.
          </span>
          <a className="hhr-preview-back" href={`/rutina/${token}`}>
            Volver a mi rutina
          </a>
        </div>
      ) : preview === 'on' ? (
        <div className="hhr-preview" role="status">
          <span>
            <b>Vista previa del entrenador.</b> Nada de lo que toques se guarda ni lo ve {firstName || 'el alumno'}.
          </span>
          <label className="hhr-preview-toggle">
            <input type="checkbox" checked={previewGates} onChange={(e) => setPreviewGates(e.target.checked)} />
            Mostrar chequeo y avisos
          </label>
        </div>
      ) : null}
      <div className="hhr-masthead">
        <span className="hhr-wordmark"><BrandMark /> haciéndolo<span>hábito</span><span className="hhr-brand-period">.</span></span>
        <span className="hhr-space-label">TODO EMPIEZA CUANDO ESTÁS <b>HACIÉNDOLO HÁBITO</b></span>
      </div>
      <div className="hhr-app has-bar" data-tab={tab}>
        <aside className="hhr-side">
          <header className="hhr-top">
            <span className="hhr-avatar" aria-hidden>
              {initials(firstName || 'Hola')}
            </span>
            <div className="hhr-hello">
              <span className="hhr-today">{todayLabel}</span>
              <h1>{firstName ? `Hola, ${firstName}` : 'Tu rutina'}</h1>
            </div>
            {waDigits ? (
              <a
                className="hhr-round-btn"
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={proFirst ? `Escribir a ${proFirst} por WhatsApp` : 'Escribir por WhatsApp'}
              >
                <MessageCircle size={20} strokeWidth={1.8} aria-hidden />
              </a>
            ) : null}
          </header>

          <div className="hhr-hero hhr-hero-brand hhr-pane hhr-pane-entrenar">
            <div className="hhr-hero-top">
              <span className="hhr-hero-kicker">{blocks.length > 1 ? `Semana ${currentWeek + 1} de ${blocks.length}` : 'Esta semana'}</span>
              {until ? <span className="hhr-hero-until">Hasta el {until}</span> : null}
            </div>
            <span className="hhr-hero-logo" aria-hidden><BrandMark /></span>
            <h2 className="hhr-hero-heading">Todo empieza cuando estás <span>haciéndolo hábito</span></h2>
            <button type="button" className="hhr-start" onClick={() => trainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Play size={13} fill="currentColor" aria-hidden /> A entrenar
            </button>
          </div>
          <section className="hhr-overview hhr-pane hhr-pane-progreso" aria-label="Tu progreso semanal">
            <div className="hhr-hero-mid">
              <div className="hhr-hero-text">
                <span className="hhr-hero-big">
                  {weekProgress.done}
                  <span>/{weekProgress.total || 0}</span>
                </span>
                <span className="hhr-hero-unit">series completadas</span>
              </div>
              <Ring pct={pct} />
            </div>
            <p className="hhr-hero-line">{heroLine}</p>
            <div className="hhr-hero-foot">
              <b>{niceCase(routine?.name) || 'Tu rutina'}</b>
              {routine?.objective ? <span>{routine.objective.trim()}</span> : null}
            </div>
          </section>

          {extras ? (
            <div className="hhr-pane hhr-pane-progreso hhr-pane-wrap">
              <ProgressCard blocks={blocks} extras={extras} kgOf={kgOf} open />
            </div>
          ) : null}
          {!pastView && !coachView && data.history?.length ? (
            <div className="hhr-pane hhr-pane-progreso hhr-pane-wrap">
              <RoutineHistoryCard token={token} items={data.history} />
            </div>
          ) : null}
          {showCycle && studentExtras ? (
            <div className="hhr-pane hhr-pane-ciclo hhr-pane-wrap">
              <fieldset className="hhr-ro" disabled={viewOnly}>
                <CycleCard
                  token={token}
                  extras={studentExtras}
                  open
                  onChange={(patch) => setStudentExtras((prev) => (prev ? { ...prev, ...patch } : prev))}
                />
              </fieldset>
            </div>
          ) : null}
          {extras && !viewOnly ? (
            <div className="hhr-pane hhr-pane-consulta hhr-pane-wrap">
              <UrgentCard token={token} proLabel={proLabel} />
            </div>
          ) : null}
        </aside>

        <main className="hhr-main hhr-pane hhr-pane-entrenar" ref={trainRef} aria-label="Tu entrenamiento">
          <div className="hhr-main-head">
            <h2>Tu entrenamiento</h2>
            <span>Elegí tu día. Encontrá tu ritmo.</span>
          </div>
          {studentExtras ? <PaymentBanner extras={studentExtras} /> : null}
          {closeMessage ? (
            <section className="hhr-weekdone" role="status">
              <b>{closeMessage.title}</b>
              <span>{closeMessage.body}</span>
            </section>
          ) : null}
          {studentExtras && monthDone && reviewDayId && !viewOnly ? (
            <MonthReviewCard token={token} dayId={reviewDayId} proLabel={proLabel} done={reviewDone} onDone={() => setReviewSent(true)} />
          ) : null}

          {reviewDue ? null : !routine || blocks.length === 0 ? (
            <div className="hhr-card hhr-empty-card">
              {athlete ? (
                <Mascot athlete={athlete} mood="coach" className="hhr-mascot hhr-mascot-sm" />
              ) : (
                <span className="hhr-tile" aria-hidden>
                  <Art name="general" fallback={<Dumbbell size={24} strokeWidth={1.8} />} />
                </span>
              )}
              <b>Tu rutina todavía no está cargada</b>
              <p>Cuando {proLabel} la arme, la vas a ver en este mismo link.</p>
            </div>
          ) : (
            <>
              {blocks.length > 1 ? (
                <nav className="hhr-weeks" aria-label="Semanas">
                  {blocks.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      className="hhr-week"
                      aria-pressed={i === wi}
                      aria-disabled={lockedWeek(i) || undefined}
                      data-locked={lockedWeek(i) || undefined}
                      title={lockedWeek(i) ? 'Se desbloquea cuando cerrás todos los entrenamientos de la semana anterior' : undefined}
                      onClick={() => {
                        // Semana bloqueada: lo lleva al primer día que le falta cerrar y le explica qué hacer.
                        if (lockedWeek(i)) {
                          setLockTapped(i)
                          setWeek(currentWeek)
                          setDay(unclosedDays[0]?.idx ?? 0)
                          return
                        }
                        setLockTapped(null)
                        setWeek(i)
                        setDay(extras ? startDayIndex(blocks, i, progressInput(extras, logged)) : 0)
                      }}
                    >
                      {lockedWeek(i) ? <Lock size={11} strokeWidth={2.4} aria-label="(bloqueada)" /> : null}
                      {niceCase(b.name) || `Semana ${i + 1}`}
                      {i === currentWeek ? <span className="hhr-now" aria-label="(semana actual)" /> : null}
                    </button>
                  ))}
                </nav>
              ) : null}

              {lockHint ? (
                <section className="hhr-card hhr-lockhint" role="status">
                  <Lock size={18} strokeWidth={2.2} aria-hidden />
                  <div>
                    <b>
                      {lockTapped != null ? `${lockHint.next} está bloqueada` : `Para desbloquear ${lockHint.next}`}
                    </b>
                    <p>
                      Revisá que marcaste como terminado cada entrenamiento de {lockHint.current}. Te falta cerrar{' '}
                      <strong>{joinNames(lockHint.days)}</strong>.
                    </p>
                    <p>
                      Al final de cada día tocá <strong>«Terminé este entrenamiento»</strong> y elegí qué tan exigente fue (del 1 al 10).
                    </p>
                  </div>
                </section>
              ) : null}

              {days.length > 1 ? (
                <nav className="hhr-card hhr-days" aria-label="Días">
                  {days.map((d, i) => {
                    const p = dayProgress(d, logged)
                    const dpct = p.total ? p.done / p.total : 0
                    const chip = dayChip(d.day_name, i)
                    const st = extras?.days[d.id]?.status ?? null
                    // Entrenó todo pero no tocó «Terminé»: se marca para que lo cierre.
                    const toClose = !!extras && !st && p.total > 0 && p.done >= p.total
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={st === 'missed' ? 'hhr-day is-missed' : toClose ? 'hhr-day is-toclose' : 'hhr-day'}
                        aria-pressed={i === di}
                        aria-label={`${d.day_name || `Día ${i + 1}`}: ${st === 'missed' ? 'no entrenado' : st === 'done' ? 'terminado' : `${p.done} de ${p.total} series`}`}
                        onClick={() => setDay(i)}
                      >
                        <span className="hhr-day-label">{chip.label}</span>
                        <span className="hhr-day-num">{chip.big}</span>
                        <MiniArc value={st === 'done' ? 1 : dpct} />
                      </button>
                    )
                  })}
                </nav>
              ) : null}

              {selectedDay ? (
                <section className="hhr-dayhead">
                  <div className="hhr-dayhead-text">
                    <h3>{niceCase(selectedDay.day_name) || 'Entrenamiento'}</h3>
                    <span>
                      {selectedDay.muscle_focus ? `${niceCase(selectedDay.muscle_focus)} · ` : ''}
                      {selectedDay.exercises.length} {selectedDay.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                    </span>
                  </div>
                  {selectedProgress.total ? (
                    <span className={selectedProgress.done >= selectedProgress.total ? 'hhr-count is-done' : 'hhr-count'}>
                      {selectedProgress.done >= selectedProgress.total ? (
                        <>
                          <Check size={14} strokeWidth={2.6} aria-hidden /> Día completo
                        </>
                      ) : (
                        <>
                          <b>{selectedProgress.done}</b>/{selectedProgress.total}
                        </>
                      )}
                    </span>
                  ) : null}
                </section>
              ) : null}

              {selectedDay && selBlock && noticeGate ? (
                <RoutineNoticeCard
                  key={`${selBlock.id}:${noticeGate}`}
                  token={token}
                  blockId={selBlock.id}
                  kind={noticeGate}
                  week={wi + 1}
                  proLabel={proLabel}
                  onSent={(blockId, kind) =>
                    setExtras((prev) => (prev ? { ...prev, notices: [...(prev.notices ?? []), { block_id: blockId, kind }] } : prev))
                  }
                />
              ) : null}
              {selectedDay && dayLog && askCheckin && !noticeGate ? (
                <DayCheckinCard
                  key={selectedDay.id}
                  token={token}
                  dayId={selectedDay.id}
                  proLabel={proLabel}
                  weekClose={closesWeek}
                  woman={isWoman}
                  sex={isWoman ? 'F' : 'M'}
                  onSaved={onDayLog}
                  onCycle={({ date, onPill }) =>
                    setStudentExtras((prev) =>
                      prev ? { ...prev, cycles: date ? [date, ...prev.cycles.filter((c) => c !== date)] : prev.cycles, on_pill: onPill ?? prev.on_pill } : prev,
                    )
                  }
                />
              ) : null}
              {selectedDay && dayLog && !blocked ? <DayCheckinSummary log={dayLog} /> : null}

              {selectedDay && warmup.length && !blocked ? (
                <details className="hhr-card hhr-warmup">
                  <summary>
                    <span className="hhr-tile hhr-tile-sm" aria-hidden>
                      <Art name="calor" fallback={<Flame size={18} strokeWidth={1.8} />} />
                    </span>
                    <span className="hhr-warmup-title">
                      <b>Entrada en calor</b>
                      <small>
                        {warmup.length} {warmup.length === 1 ? 'paso' : 'pasos'} antes de empezar
                      </small>
                    </span>
                    <ChevronDown className="hhr-chev" size={18} strokeWidth={1.8} aria-hidden />
                  </summary>
                  <ol>
                    {warmup.map((l, i) => {
                      const { text, media } = splitWarmupLine(l)
                      return (
                        <li key={i}>
                          {text || null}
                          {media.length ? (
                            <span className="hhr-warmup-media">
                              {media.map((m) => (
                                <WarmupMediaItem key={m.url} media={m} />
                              ))}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ol>
                </details>
              ) : null}

              {blocked ? null : selectedDay ? (
                <div className="hhr-list">
                  {selectedDay.exercises.length === 0 ? <p className="hhr-muted">No hay ejercicios cargados para este día.</p> : null}
                  {groups.map((g, gi) =>
                    g.circuit ? (
                      <div key={g.items[0]!.id} className={`hhr-card hhr-circuit${groupOpen(gi) ? ' is-open' : ''}`}>
                        <p className="hhr-circuit-label">
                          <b className="hhr-circuit-tag">
                            <Link2 size={14} strokeWidth={2.2} aria-hidden />
                            Circuito
                          </b>
                          <span>
                            {g.items.length} ejercicios seguidos
                          </span>
                        </p>
                        {circuitNoteOf(g.items) ? (
                          <p className="hhr-circuit-note">
                            <b>Cómo se hace</b>
                            {circuitNoteOf(g.items)}
                          </p>
                        ) : (
                          <p className="hhr-circuit-note is-default">Sin pausa entre ellos.</p>
                        )}
                        <CoachNoteItems
                          items={pastView ? [] : coachNoteItems.filter((x) => x.day_id === selectedDay.id && x.circuit_group === g.items[0]!.superset_group)}
                          proLabel={proLabel}
                          coachView={coachView}
                          onSeen={markCoachNoteSeen}
                        />
                        <div className="hhr-circuit-list">
                          {g.items.map((ex, i) => (
                            <Fragment key={ex.id}>
                              {i > 0 ? (
                                <span className="hhr-circuit-plus" aria-hidden>
                                  +
                                </span>
                              ) : null}
                              {card(ex, gi, true)}
                            </Fragment>
                          ))}
                        </div>
                        {circuitNoteOf(g.items) ? null : <p className="hhr-circuit-foot">Descansá recién cuando termines los {g.items.length}.</p>}
                      </div>
                    ) : (
                      card(g.items[0]!, gi)
                    ),
                  )}
                  {dayLog && selectedDay.exercises.length > 0 ? (
                    <fieldset className="hhr-ro" disabled={viewOnly}>
                    <DayCloseCard
                      key={`close-${selectedDay.id}`}
                      token={token}
                      dayId={selectedDay.id}
                      log={dayLog}
                      today={today}
                      allSetsDone={selectedProgress.total > 0 && selectedProgress.done >= selectedProgress.total}
                      onSaved={onDayLog}
                    />
                    </fieldset>
                  ) : null}
                </div>
              ) : (
                <p className="hhr-muted">Esta semana no tiene días cargados.</p>
              )}
            </>
          )}

          <p className="hhr-foot">
            {updated ? `Rutina actualizada el ${updated}. ` : ''}Si {proLabel} la cambia, este link muestra la versión nueva.
            <span className="hhr-brand">Haciéndolo Hábito</span>
          </p>
        </main>
      </div>

      <nav className="hhr-tabs" aria-label="Secciones">
        {appTabs.map((t) => (
          <label key={t.id} className="hhr-tab">
            <input type="radio" name="hhr-tab" checked={tab === t.id} onChange={() => goTab(t.id)} />
            <t.icon size={22} strokeWidth={1.9} aria-hidden />
            <span>{t.label}</span>
          </label>
        ))}
      </nav>
    </Shell>
  )
}

/** Ícono de la app (el del proyecto: naranja con la marca en negro), igual al de `public/logo-brand.png`. */
function BrandMark() {
  // Id propio por instancia: si el primero queda oculto (cabecera en el celu), el degradé de los demás no se pierde.
  const gid = `hhr-brand-orange-${useId().replace(/:/g, '')}`
  return (
    <svg className="hhr-brand-mark" viewBox="113 188 374 380" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A1A" />
          <stop offset="1" stopColor="#FF4D00" />
        </linearGradient>
      </defs>
      <rect x="113" y="188" width="374" height="380" rx="84" fill={`url(#${gid})`} />
      <path d="M188 325 262 248V368H300L188 498Z M412 248V425L340 498V368H300Z" fill="#111111" />
    </svg>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 38
  const c = 2 * Math.PI * r
  return (
    <span className="hhr-ring" role="img" aria-label={`${pct}% de la semana completada`}>
      <svg viewBox="0 0 92 92" width="92" height="92" aria-hidden>
        <circle cx="46" cy="46" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
        <circle
          cx="46"
          cy="46"
          r={r}
          fill="none"
          stroke="var(--ring)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 46 46)"
          opacity={pct === 0 ? 0 : 1}
        />
      </svg>
      <b>
        {pct}
        <small>%</small>
      </b>
    </span>
  )
}

/** Arco chico debajo de cada día, como un calendario de hábitos. */
function MiniArc({ value }: { value: number }) {
  const r = 9
  const c = 2 * Math.PI * r
  const done = value >= 1
  return (
    <svg className={done ? 'hhr-arc is-done' : 'hhr-arc'} viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--arc-track)" strokeWidth="3" />
      {value > 0 ? (
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(value, 1))}
          transform="rotate(-90 12 12)"
        />
      ) : null}
      {done ? <path d="M8 12.2l2.6 2.6L16 9.4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
    </svg>
  )
}

function ExerciseCard({
  ex,
  athlete,
  n,
  flat,
  token,
  logged,
  open,
  onToggle,
  onSaved,
  proLabel,
  feedback,
  onFeedbackSaved,
  selfNote,
  onSelfNoteSaved,
  previous,
  next,
  foot,
  weightModeOn,
  readOnly,
  coachNote,
  onHideCoachNote,
  coachNoteItems,
  onCoachNoteSeen,
  coachEditor,
}: {
  /** «Ver como profe»: se ve todo lo anotado pero no se puede tocar. */
  readOnly: boolean
  /** Nota del entrenador para el alumno (si no la ocultó). */
  coachNote: string | null
  onHideCoachNote: () => void
  /** Notas de esta semana para este ejercicio, con «Lo vi». */
  coachNoteItems: SharedCoachNote[]
  onCoachNoteSeen: (id: string, seen: boolean) => void
  /** Solo en «Ver como profe»: escribir la nota para el alumno. */
  coachEditor: CoachEditorProps | null
  /** El alumno puede decir si anota el total o por lado (migración 20261124120000). */
  weightModeOn: boolean
  /** En un circuito, «Siguiente» va solo al pie del último ejercicio. */
  foot: boolean
  /** Lo que anotó la vez anterior en este ejercicio, por serie. */
  previous?: Record<number, LoggedSet>
  /** Ejercicio que sigue en el día; `null` en el último. */
  next: { label: string; go: () => void } | null
  /** Nota propia del alumno; `null` sin la migración de notas propias. */
  selfNote: string | null
  onSelfNoteSaved: (key: string, note: string) => void
  /** `null`: las notas todavía no están activadas en la base. */
  feedback: ExerciseFeedback | null
  onFeedbackSaved: (exId: string, fb: ExerciseFeedback) => void
  proLabel: string
  ex: SharedRoutineExercise
  athlete: Athlete | null
  n: number
  flat: boolean
  token: string
  logged: Record<number, LoggedSet>
  open: boolean
  onToggle: () => void
  onSaved: (exId: string, set: number, value: LoggedSet) => void
}) {
  const main = setsRepsText(ex)
  const { chips, notes } = exerciseDetails(ex)
  const sets = setCount(ex)
  const done = Array.from({ length: sets }, (_, i) => logged[i + 1]?.completed).filter(Boolean).length
  const complete = done >= sets
  const panelId = `hhr-ex-${ex.id}`
  const name = niceCase(ex.name) || 'Ejercicio'
  const artwork = movementArtwork(ex.name, athlete)
  const tags = [main, chips[0]].filter(Boolean) as string[]
  // Descanso: arranca al tildar una serie, con el tiempo que puso el entrenador.
  const [restUntil, setRestUntil] = useState<number | null>(null)
  const rest = ex.rest_seconds && ex.rest_seconds > 0 ? ex.rest_seconds : 0
  const endRest = useCallback(() => setRestUntil(null), [])
  return (
    <article id={`hhr-card-${ex.id}`} className={`hhr-ex${flat ? ' is-flat' : ' hhr-card'}${complete ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="hhr-ex-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        <span className={`hhr-tile hhr-tile-${exerciseArt(ex.name)}`} aria-hidden>
          {ex.image_url ? (
            <img className="hhr-photo" src={ex.image_url} alt="" loading="lazy" />
          ) : (
            artwork ? <span className="hhr-movement" style={{ backgroundImage: `url("${artwork.url}")`, backgroundPosition: artwork.position }} /> : <Dumbbell size={30} strokeWidth={1.4} />
          )}
          {complete ? (
            <span className="hhr-tile-check">
              <Check size={13} strokeWidth={3} />
            </span>
          ) : null}
        </span>
        <span className="hhr-ex-info">
          <span className="hhr-ex-name">{name}</span>
          {tags.length ? (
            <span className="hhr-ex-tags">
              {tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </span>
          ) : null}
          {selfNote ? (
            <span className="hhr-ex-mynote">
              <Pin size={11} strokeWidth={2.4} aria-hidden /> {selfNote}
            </span>
          ) : null}
          {coachNote || coachEditor?.value || coachNoteItems.some((x) => !x.seen_at) ? (
            <span className="hhr-ex-coachnote">
              <MessageCircle size={11} strokeWidth={2.4} aria-hidden /> {coachEditor ? `Tu nota: ${coachEditor.value}` : `Nota de ${proLabel}`}
            </span>
          ) : null}
          <span className="hhr-progress">
            <span className="hhr-progress-track" aria-hidden>
              <span className="hhr-progress-fill" style={{ width: `${(done / sets) * 100}%` }} />
            </span>
            <span className="hhr-progress-label">{complete ? 'Listo' : `${done}/${sets} series`}</span>
          </span>
          <span className="hhr-setdots" aria-hidden>
            {Array.from({ length: sets }, (_, i) => (
              <i key={i} className={logged[i + 1]?.completed ? 'is-on' : undefined} />
            ))}
          </span>
        </span>
        <ChevronDown className="hhr-chev" size={20} strokeWidth={1.8} aria-hidden />
        {open ? (
          <span className="hhr-ex-back" aria-hidden>
            <ChevronLeft size={16} strokeWidth={2.4} /> Volver
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="hhr-ex-panel" id={panelId}>
          <span className="hhr-register-title">Ejercicio {String(n).padStart(2, '0')} · Registro de series</span>
          {chips.length > 1 || notes || ex.video_url ? (
            <div className="hhr-ex-extra">
              {chips.length > 1 ? (
                <ul className="hhr-chips">
                  {chips.slice(1).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {notes ? <p className="hhr-notes">{niceCase(notes)}</p> : null}
              {ex.video_url ? (
                <a className="hhr-video" href={ex.video_url} target="_blank" rel="noopener noreferrer">
                  <Play size={13} strokeWidth={2.4} fill="currentColor" aria-hidden /> Ver video
                </a>
              ) : null}
            </div>
          ) : null}
          {coachNote ? <CoachNoteCard note={coachNote} proLabel={proLabel} onHide={onHideCoachNote} /> : null}
          <CoachNoteItems items={coachNoteItems} proLabel={proLabel} coachView={readOnly} onSeen={onCoachNoteSeen} />
          {coachEditor ? <CoachNoteEditor key={ex.id} {...coachEditor} /> : null}
          <fieldset className="hhr-ro" disabled={readOnly}>
          {selfNote != null ? <SelfNoteBox token={token} noteKey={exerciseNoteKey(ex.name)} value={selfNote} onSaved={onSelfNoteSaved} /> : null}
          <KgInputs
            ex={ex}
            sets={sets}
            token={token}
            logged={logged}
            onSaved={onSaved}
            previous={previous}
            weightModeOn={weightModeOn}
            onCompleted={() => {
              buzz(30)
              if (rest) setRestUntil(Date.now() + rest * 1000)
            }}
          />
          {feedback ? <ExerciseFeedbackBox token={token} exerciseId={ex.id} value={feedback} proLabel={proLabel} onSaved={onFeedbackSaved} /> : null}
          </fieldset>
          {foot ? (
          <div className="hhr-ex-foot">
            {restUntil ? <RestTimer until={restUntil} total={rest} onDone={endRest} /> : null}
            <button type="button" className="hhr-next" onClick={next ? next.go : onToggle}>
              {next ? (
                <>
                  <span>Siguiente</span>
                  <b>{next.label}</b>
                </>
              ) : (
                <b>Volver a la lista</b>
              )}
              <ChevronDown size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>
          ) : restUntil ? (
            <RestTimer until={restUntil} total={rest} onDone={endRest} />
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Nota del entrenador en el ejercicio; el alumno la oculta cuando ya la leyó (vuelve si el entrenador la cambia). */
function CoachNoteCard({ note, proLabel, onHide }: { note: string; proLabel: string; onHide: () => void }) {
  return (
    <div className="hhr-coachnote" role="note">
      <span className="hhr-coachnote-title">
        <MessageCircle size={13} strokeWidth={2.2} aria-hidden /> Nota de {proLabel}
      </span>
      <p>{note}</p>
      <label className="hhr-coachnote-hide">
        <input type="checkbox" onChange={onHide} /> Ya la leí, ocultarla
      </label>
    </div>
  )
}

/** Feedback nov24: notas del entrenador de esta semana (ejercicio o circuito); el alumno marca «Lo vi» en cada una. */
function CoachNoteItems({ items, proLabel, coachView, onSeen }: { items: SharedCoachNote[]; proLabel: string; coachView: boolean; onSeen: (id: string, seen: boolean) => void }) {
  if (items.length === 0) return null
  return (
    <>
      {items.map((n) => (
        <div key={n.id} className={`hhr-coachnote${n.seen_at ? ' is-seen' : ''}`} role="note">
          <span className="hhr-coachnote-title">
            <MessageCircle size={13} strokeWidth={2.2} aria-hidden /> {coachView ? 'Tu nota' : `Nota de ${proLabel}`}
          </span>
          <p>{n.note}</p>
          {coachView ? (
            <small className="hhr-coachnote-state">
              {n.seen_at ? `La vio el ${format(new Date(n.seen_at), "d 'de' MMMM", { locale: es })}` : 'Todavía no la vio'}
            </small>
          ) : (
            <label className="hhr-coachnote-hide">
              <input type="checkbox" checked={!!n.seen_at} onChange={(e) => onSeen(n.id, e.target.checked)} /> Lo vi
            </label>
          )}
        </div>
      ))}
    </>
  )
}

type CoachEditorProps = { value: string; hidden: boolean; studentLabel: string; onSave: (note: string) => Promise<void> }

/** «Ver como profe»: la nota para el alumno se guarda al salir del cuadro. */
function CoachNoteEditor({ value, hidden, studentLabel, onSave }: CoachEditorProps) {
  const [draft, setDraft] = useState(value)
  const [state, setState] = useState<SaveState>('idle')
  const [error, setError] = useState('')
  async function save() {
    if (draft.trim() === value.trim()) return
    setState('saving')
    try {
      await onSave(draft)
      setState('saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setState('error')
    }
  }
  return (
    <label className="hhr-coachnote is-edit">
      <span className="hhr-coachnote-title">
        <MessageCircle size={13} strokeWidth={2.2} aria-hidden /> Nota para {studentLabel}
      </span>
      <textarea
        rows={2}
        maxLength={COACH_NOTE_MAX}
        value={draft}
        placeholder="Ej.: la próxima subí 2,5 kg y cuidá bajar lento"
        onChange={(e) => {
          setDraft(e.target.value)
          setState('idle')
        }}
        onBlur={() => void save()}
      />
      <small>
        {state === 'saving'
          ? 'Guardando…'
          : state === 'saved'
            ? draft.trim() ? 'Guardada. Le aparece en este ejercicio hasta que la oculte.' : 'Nota borrada.'
            : state === 'error'
              ? error
              : hidden
                ? 'La ocultó: si la cambiás, le vuelve a aparecer.'
                : 'Le aparece en este ejercicio (también en las semanas que siguen) hasta que la oculte. Se guarda al salir del cuadro.'}
      </small>
    </label>
  )
}

/** Foto, video o link pegado en la entrada en calor. */
function WarmupMediaItem({ media }: { media: WarmupMedia }) {
  if (media.kind === 'embed')
    return (
      <iframe
        className="hhr-warmup-frame"
        src={media.src}
        title="Video de la entrada en calor"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    )
  if (media.kind === 'image') return <img className="hhr-warmup-img" src={media.url} alt="Foto de la entrada en calor" loading="lazy" />
  if (media.kind === 'video') return <video className="hhr-warmup-img" src={media.url} controls playsInline preload="metadata" />
  return (
    <a className="hhr-video" href={media.url} target="_blank" rel="noopener noreferrer">
      <Play size={13} strokeWidth={2.4} fill="currentColor" aria-hidden /> {media.label}
    </a>
  )
}

/** «10» o «8-10» llevan «reps»; «12´´», «1´», «30 s» o «6+6» quedan tal cual los escribió el entrenador. */
function withReps(reps: string): string {
  const t = reps.trim()
  if (!t) return ''
  return /^\d+(\s*[-–]\s*\d+)?$/.test(t) ? `${t} reps` : t
}

type PlanRow = { kg?: string; reps?: string; rpeRir?: string }

/** Reps (o tiempo) indicadas para la serie i: manda el plan por serie; si no, «8 / 6 / 5» o el esquema general. */
function rowReps(ex: SharedRoutineExercise, plan: PlanRow[], i: number): string {
  const scheme = repsText(ex)
  const parts = /[/,;]/.test(scheme) ? scheme.split(/\s*[/,;]\s*/) : []
  return plan[i]?.reps?.trim() || parts[i] || (parts.length ? '' : scheme)
}

/** Kilos indicados (siempre el total) para la serie i: el plan por serie manda; si no, el peso general. */
function plannedKg(ex: SharedRoutineExercise, plan: PlanRow[], i: number): number | null {
  const fromPlan = Number(plan[i]?.kg?.trim().replace(',', '.'))
  if (plan[i]?.kg?.trim() && Number.isFinite(fromPlan) && fromPlan > 0) return fromPlan
  return ex.weight_kg != null && ex.weight_kg > 0 ? ex.weight_kg : null
}

/** Lo indicado para la serie i: «10 reps · 60 kg» o «10 reps · 20 kg por lado», según lo que marcó el entrenador. */
function setTarget(ex: SharedRoutineExercise, plan: PlanRow[], i: number): string {
  const reps = rowReps(ex, plan, i)
  const kg = plannedKg(ex, plan, i)
  return [withReps(reps), kg != null ? plannedWeightText(kg, parseExerciseMeta(ex.technical_notes).meta) : ''].filter(Boolean).join(' · ')
}

/** Reps y peso opcionales y check independiente. Solo se confirma el progreso al guardar en el servidor. */
function KgInputs({ ex, sets, token, logged, onSaved, previous, onCompleted, weightModeOn }: {
  ex: SharedRoutineExercise
  weightModeOn: boolean
  sets: number
  token: string
  logged: Record<number, LoggedSet>
  onSaved: (exId: string, set: number, value: LoggedSet) => void
  previous?: Record<number, LoggedSet>
  /** Se llama cuando una serie pasa a hecha (para vibrar y arrancar el descanso). */
  onCompleted?: () => void
}) {
  const meta = useMemo(() => parseExerciseMeta(ex.technical_notes).meta, [ex.technical_notes])
  const plan = useMemo(() => meta.seriesPlan ?? [], [meta])
  const planMode = weightModeOf(meta)
  const bar = barKgOf(meta)
  // Cómo anota los kilos: lo último que eligió en este ejercicio; si todavía no anotó, lo que indicó el entrenador.
  const [mode, setMode] = useState<SetWeightMode>(() => {
    const withKg = Object.values(logged).filter((l) => l.kg != null)
    if (withKg.length) return withKg.some((l) => l.mode === 'lado') ? 'lado' : 'total'
    return planMode === 'lado' ? 'lado' : 'total'
  })
  const [values, setValues] = useState<string[]>(() => Array.from({ length: sets }, (_, i) => formatKg(logged[i + 1]?.kg)))
  const [repsValues, setRepsValues] = useState<string[]>(() =>
    Array.from({ length: sets }, (_, i) => (logged[i + 1]?.reps != null ? String(logged[i + 1]!.reps) : '')),
  )
  // Por tiempo se decide serie por serie: en esas no hay casillero de reps.
  const timeRows = useMemo(() => Array.from({ length: sets }, (_, i) => isTimeReps(rowReps(ex, plan, i))), [ex, plan, sets])
  const allTime = timeRows.every(Boolean)
  const anyTime = timeRows.some(Boolean)
  const [status, setStatus] = useState<SaveState[]>(() => Array.from({ length: sets }, () => 'idle'))
  const [errors, setErrors] = useState<Record<number, string>>({})
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const inFlight = useRef(new Set<number>())
  const attempts = useRef<Record<number, { raw: string; rawReps: string; completed?: boolean }>>({})
  const lastSaved = useRef<Record<number, LoggedSet>>({ ...logged })

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  function placeholder(i: number): string {
    const k = plannedKg(ex, plan, i)
    if (k == null) return '—'
    return formatKg(weightModeOn && mode === 'lado' ? perSideKg(k, bar) : k)
  }

  function setStatusAt(i: number, s: SaveState) {
    setStatus((prev) => prev.map((v, j) => (j === i ? s : v)))
  }

  async function save(i: number, raw: string, rawReps: string, explicitCompleted?: boolean, modeOverride?: SetWeightMode) {
    clearTimeout(timers.current[i])
    if (inFlight.current.has(i)) return
    const useMode = modeOverride ?? mode
    attempts.current[i] = { raw, rawReps, completed: explicitCompleted }
    const kg = parseKg(raw)
    if (kg === undefined) {
      setErrors((prev) => ({ ...prev, [i]: 'Revisá los kilos: usá un número entre 0 y 1000, o dejalos vacíos.' }))
      setStatusAt(i, 'error')
      return
    }
    const reps = parseReps(rawReps)
    if (reps === undefined) {
      setErrors((prev) => ({ ...prev, [i]: 'Revisá las repeticiones: un número entero de 0 a 500, o dejalas vacías.' }))
      setStatusAt(i, 'error')
      return
    }
    const before = lastSaved.current[i + 1] ?? { kg: null, reps: null, completed: false }
    // Anotar kilos o reps sigue completando la serie; borrarlos no desmarca una serie ya hecha.
    const completed = explicitCompleted ?? (kg != null || reps != null || before.completed)
    const sameMode = !weightModeOn || kg == null || useMode === (before.mode ?? 'total')
    if (kg === before.kg && reps === (before.reps ?? null) && completed === before.completed && sameMode) {
      setStatusAt(i, 'idle')
      return
    }
    inFlight.current.add(i)
    setStatusAt(i, 'saving')
    try {
      if (weightModeOn) await saveSharedSet(token, ex.id, i + 1, kg, completed, reps, useMode)
      else await saveSharedSet(token, ex.id, i + 1, kg, completed, reps)
      const next: LoggedSet = { kg, reps, completed, ...(weightModeOn && kg != null ? { mode: useMode } : {}) }
      lastSaved.current[i + 1] = next
      onSaved(ex.id, i + 1, next)
      setStatusAt(i, 'saved')
      if (completed && !before.completed) onCompleted?.()
    } catch (error) {
      setErrors((prev) => ({ ...prev, [i]: error instanceof Error ? error.message : 'No se pudo guardar. Intentá de nuevo.' }))
      setStatusAt(i, 'error')
    } finally {
      inFlight.current.delete(i)
    }
  }

  function onChange(i: number, raw: string) {
    setValues((prev) => prev.map((v, j) => (j === i ? raw : v)))
    clearTimeout(timers.current[i])
    timers.current[i] = setTimeout(() => void save(i, raw, repsValues[i] ?? ''), 900)
  }

  function onRepsChange(i: number, raw: string) {
    setRepsValues((prev) => prev.map((v, j) => (j === i ? raw : v)))
    clearTimeout(timers.current[i])
    timers.current[i] = setTimeout(() => void save(i, values[i] ?? '', raw), 900)
  }

  /** Cambia cómo anota los kilos; las series que ya tienen kilos se vuelven a guardar con el modo nuevo. */
  function changeMode(next: SetWeightMode) {
    if (next === mode) return
    setMode(next)
    for (let i = 0; i < sets; i++) if (lastSaved.current[i + 1]?.kg != null) void save(i, values[i] ?? '', repsValues[i] ?? '', undefined, next)
  }

  /** Lo indicado como sugerencia en el casillero: «8-10» → «8», «12» → «12». */
  function repsPlaceholder(i: number): string {
    const m = /\d+/.exec(rowReps(ex, plan, i))
    return m ? m[0] : '—'
  }

  return (
    <div className="hhr-kg">
      <p className="hhr-kg-hint">Tildá cada serie al terminar. {allTime ? 'Los kilos son opcionales.' : 'Las reps y los kilos son opcionales.'}{anyTime ? ' ´´ son segundos y ´ minutos.' : ''}</p>
      {weightModeOn ? (
        <div className="hhr-kgmode">
          <span>Los kilos que anoto son</span>
          <div role="radiogroup" aria-label="Cómo anotás los kilos">
            {(['total', 'lado'] as const).map((m) => (
              <label key={m} className={mode === m ? 'is-on' : undefined}>
                <input type="radio" name={`hhr-kgmode-${ex.id}`} value={m} checked={mode === m} onChange={() => changeMode(m)} />
                {m === 'total' ? 'Total' : 'Por lado'}
              </label>
            ))}
          </div>
          {mode === 'lado' || planMode !== 'total' ? (
            <small>{bar > 0 ? `Con barra de ${formatKg(bar)} kg: 100 kg total = ${formatKg(perSideKg(100, bar))} por lado.` : 'Sin barra: por lado es la mitad del total.'}</small>
          ) : null}
        </div>
      ) : null}
      <div className="hhr-sets-head" aria-hidden>
        <span>Serie</span><span>Indicado</span><span>{allTime ? '' : 'Reps'}</span><span>{weightModeOn && mode === 'lado' ? 'Kg por lado' : 'Kg'}</span>
      </div>
      <ol className="hhr-sets">
        {values.map((v, i) => {
          const completed = logged[i + 1]?.completed ?? false
          const saving = status[i] === 'saving'
          // Con la columna «Reps» a la vista, lo indicado va sin la palabra: «8-10 · 60 kg».
          const timeBased = timeRows[i]
          const target = timeBased ? setTarget(ex, plan, i) : setTarget(ex, plan, i).replace(/ reps\b/, '')
          const rpe = effortLabel(plan[i]?.rpeRir)
          const before = previousLabel(previous?.[i + 1])
          const errorId = `hhr-save-error-${ex.id}-${i}`
          return (
            <li key={i} className={`hhr-setrow is-${status[i]}${completed ? ' is-logged' : ''}`} aria-busy={saving}>
              <span className="hhr-setno" aria-hidden>{i + 1}</span>
              <span className="hhr-settarget">
                {target || '—'}
                {rpe ? <small className="hhr-setrpe">{rpe}</small> : null}
                {before ? <small className="hhr-setprev">Anterior {before}</small> : null}
              </span>
              {timeBased ? (
                <span className="hhr-repsfield is-empty" aria-hidden />
              ) : (
                <label className="hhr-kgfield hhr-repsfield">
                  <input
                    inputMode="numeric" autoComplete="off" enterKeyHint="done" maxLength={3}
                    value={repsValues[i] ?? ''} disabled={saving} placeholder={repsPlaceholder(i)}
                    aria-label={`${niceCase(ex.name) || 'Ejercicio'}, repeticiones de la serie ${i + 1}`}
                    aria-invalid={status[i] === 'error'} aria-describedby={status[i] === 'error' ? errorId : undefined}
                    onChange={(e) => onRepsChange(i, e.target.value)}
                    onBlur={(e) => void save(i, v, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  />
                </label>
              )}
              <label className="hhr-kgfield">
                <input
                  inputMode="decimal" autoComplete="off" enterKeyHint="done" maxLength={6}
                  value={v} disabled={saving} placeholder={placeholder(i)}
                  aria-label={`${niceCase(ex.name) || 'Ejercicio'}, kilos${weightModeOn && mode === 'lado' ? ' por lado' : ''} opcionales de la serie ${i + 1}`}
                  aria-invalid={status[i] === 'error'} aria-describedby={status[i] === 'error' ? errorId : undefined}
                  onChange={(e) => onChange(i, e.target.value)}
                  onBlur={(e) => void save(i, e.target.value, repsValues[i] ?? '')}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
                <span aria-hidden>kg</span>
              </label>
              <button type="button" className="hhr-setcheck" aria-pressed={completed} disabled={saving}
                aria-label={`${completed ? 'Desmarcar' : 'Completar'} serie ${i + 1} de ${niceCase(ex.name) || 'ejercicio'}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => void save(i, v, repsValues[i] ?? '', !completed)}>
                {completed && !saving ? <Check size={18} strokeWidth={3} aria-hidden /> : null}
              </button>
              {status[i] === 'error' ? <p className="hhr-error hhr-row-error" id={errorId} role="alert">{errors[i]} <button type="button" onClick={() => void save(i, attempts.current[i]?.raw ?? v, attempts.current[i]?.rawReps ?? repsValues[i] ?? '', attempts.current[i]?.completed)}>Reintentar</button></p> : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'

/** La página del alumno siempre en claro (aunque el dispositivo tenga guardado el tema oscuro) y con su tipografía. */
function useLightPage() {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains('dark')
    html.classList.remove('dark')
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = FONT_HREF
      document.head.appendChild(link)
    }
    return () => {
      if (hadDark) html.classList.add('dark')
    }
  }, [])
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hhr">
      <div className="hhr-inner">{children}</div>
    </div>
  )
}

type AppTab = 'entrenar' | 'progreso' | 'ciclo' | 'consulta'

/**
 * «Agregar a inicio» abre el link como app: pantalla completa, fondo oscuro y el logo de ícono.
 * El manifiesto se arma con la dirección de este link, así cada alumno instala su propia rutina.
 */
function useInstallableRoutine() {
  useEffect(() => {
    const head = document.head
    const added: HTMLElement[] = []
    const restore: (() => void)[] = []
    const meta = (name: string, content: string) => {
      const prev = head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
      if (prev) {
        const old = prev.content
        prev.content = content
        restore.push(() => (prev.content = old))
        return
      }
      const m = document.createElement('meta')
      m.name = name
      m.content = content
      head.appendChild(m)
      added.push(m)
    }
    meta('theme-color', '#0B0B0C')
    meta('apple-mobile-web-app-capable', 'yes')
    meta('mobile-web-app-capable', 'yes')
    meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
    meta('apple-mobile-web-app-title', 'Mi rutina')
    meta('viewport', 'width=device-width, initial-scale=1.0, viewport-fit=cover')

    const origin = window.location.origin
    const manifest = {
      name: 'Haciéndolo Hábito · Mi rutina',
      short_name: 'Mi rutina',
      start_url: window.location.href.split('#')[0],
      scope: `${origin}/rutina/`,
      display: 'standalone',
      background_color: '#0B0B0C',
      theme_color: '#0B0B0C',
      icons: [
        { src: `${origin}/app-icon-180.png`, sizes: '180x180', type: 'image/png' },
        { src: `${origin}/app-icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    }
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`
    head.appendChild(link)
    added.push(link)

    const html = document.documentElement
    const oldBg = html.style.background
    html.style.background = '#0B0B0C'
    return () => {
      added.forEach((el) => el.remove())
      restore.forEach((fn) => fn())
      html.style.background = oldBg
    }
  }, [])
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Sin vibración (iPhone, compu): no pasa nada.
  }
}

/** Cuenta regresiva del descanso; al llegar a cero vibra y se va. */
function RestTimer({ until, total, onDone }: { until: number; total: number; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [until])
  const left = Math.max(0, (until - now) / 1000)
  useEffect(() => {
    if (left > 0) return
    buzz([90, 60, 90])
    onDone()
  }, [left, onDone])
  return (
    <div className="hhr-rest" role="timer" aria-label={`Descanso: quedan ${clockLabel(left)}`}>
      <span>Descanso</span>
      <b>{clockLabel(Math.ceil(left))}</b>
      <i style={{ width: `${total ? (left / total) * 100 : 0}%` }} aria-hidden />
    </div>
  )
}

/** Cierres del día y series tildadas, para saber en qué semana y día va el alumno. */
/** «Día 1», «Día 1 y Día 3», «Día 1, Día 2 y Día 3». */
function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

function progressInput(extras: TrainingExtras, logged: LoggedMap) {
  return {
    statusOf: (dayId: string) => extras.days[dayId]?.status ?? null,
    hasSets: (d: { exercises: { id: string }[] }) => d.exercises.some((e) => Object.values(logged[e.id] ?? {}).some((l) => l.completed)),
  }
}
