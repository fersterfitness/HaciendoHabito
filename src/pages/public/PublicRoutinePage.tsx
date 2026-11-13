import { Fragment, type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Check, ChevronDown, ClipboardCheck, Dumbbell, Flame, Link2, MessageCircle, Play } from 'lucide-react'
import {
  currentBlockIndex,
  exerciseDetails,
  fetchSharedRoutine,
  formatKg,
  groupExercises,
  saveSharedSet,
  isSetComplete,
  parseKg,
  parseReps,
  repsText,
  setsRepsText,
  type SharedRoutine,
  type SharedRoutineDay,
  type SharedRoutineExercise,
} from '@/lib/routine/sharedRoutine'
import { parseExerciseMeta } from '@/lib/routine/exerciseMeta'
import { formatWarmupDisplayLines } from '@/lib/routine/warmupNotesFormat'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { supabasePublic } from '@/lib/supabasePublic'
import { CheckInQuestionFields } from '@/components/checkIn/CheckInQuestionFields'
import {
  emptyAnswerDraft,
  isQuestionVisible,
  parseQuestions,
  serializeDrafts,
  validateDrafts,
  type CheckInAnswerDraft,
  type CheckInQuestion,
} from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'
import './public-routine.css'
import { EMPTY_DAY_LOG, fetchSharedExtras, hasCheckin, type DayLog, type ExerciseFeedback, type TrainingExtras } from '@/lib/routine/studentTrainingLog'
import { DayCheckinCard, DayCheckinSummary, DayCloseCard, ExerciseFeedbackBox, UrgentCard } from './PublicRoutineLog'
import { feedbackWindowOpen, weekClose, weekCloseMessage } from '@/lib/routine/trainingWeek'
import { movementArtwork, routineAthlete, type Athlete } from '@/lib/routine/exerciseArtwork'

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
type LoggedSet = { kg: number | null; reps: number | null; completed: boolean }
type LoggedMap = Record<string, Record<number, LoggedSet>>

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

export function PublicRoutinePage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; data: SharedRoutine | null }>({
    status: 'loading',
  })
  const [week, setWeek] = useState<number | null>(null)
  const [day, setDay] = useState(0)
  const [logged, setLogged] = useState<LoggedMap>({})
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const feedbackRef = useRef<HTMLElement | null>(null)
  const trainRef = useRef<HTMLElement | null>(null)
  // Notas, esfuerzo, chequeo y cierre de cada día. `null`: todavía no está activado en la base.
  const [extras, setExtras] = useState<TrainingExtras | null>(null)
  /** Días en los que eligió «Responder después» el chequeo. */
  const [skippedCheckin, setSkippedCheckin] = useState<Record<string, boolean>>({})

  useLightPage()

  useEffect(() => {
    let alive = true
    void fetchSharedExtras(token).then((x) => {
      if (alive) setExtras(x)
    })
    return () => {
      alive = false
    }
  }, [token])

  const onExerciseFeedback = useCallback((exId: string, fb: ExerciseFeedback) => {
    setExtras((prev) => (prev ? { ...prev, exercises: { ...prev.exercises, [exId]: fb } } : prev))
  }, [])
  const onDayLog = useCallback((dayId: string, patch: Partial<DayLog>) => {
    setExtras((prev) => (prev ? { ...prev, days: { ...prev.days, [dayId]: { ...(prev.days[dayId] ?? EMPTY_DAY_LOG), ...patch } } } : prev))
  }, [])

  const load = useCallback(
    (quiet: boolean) => {
      if (!quiet) setState({ status: 'loading' })
      return fetchSharedRoutine(token)
        .then((data) => {
          setState({ status: 'ok', data })
          setLogged((prev) => ({ ...loggedFrom(data), ...(quiet ? prev : {}) }))
        })
        .catch(() => {
          if (!quiet) setState({ status: 'error' })
        })
    },
    [token],
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
  const feedbackPending = !!data?.feedback && !data.feedback.done && !feedbackSent

  useEffect(() => {
    document.title = firstName ? `Rutina de ${firstName}` : 'Tu rutina'
  }, [firstName])

  const onSaved = useCallback((exId: string, set: number, value: LoggedSet) => {
    setLogged((prev) => {
      const m = { ...(prev[exId] ?? {}) }
      m[set] = value
      return { ...prev, [exId]: m }
    })
  }, [])

  if (state.status === 'loading') {
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

  const blocks = routine?.blocks ?? []
  const today = todayYmd()
  const currentWeek = currentBlockIndex(blocks, today)
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
  const fbWindowOpen = !weekState || feedbackWindowOpen(new Date(), weekState)
  const closeMessage = weekState
    ? weekCloseMessage(weekState, { feedbackDone: !data.feedback || !feedbackPending, isLastWeek: blocks.length > 1 && currentWeek === blocks.length - 1 })
    : null
  // Para dar por terminado un día de esta semana con el formulario ya habilitado, primero hay que responderlo.
  const mustAnswerFirst = feedbackPending && fbWindowOpen && wi === currentWeek
  const askCheckin =
    !!selectedDay && !!dayLog && selectedDay.exercises.length > 0 && !hasCheckin(dayLog) && !dayLog.status && selectedProgress.done === 0 && !skippedCheckin[selectedDay.id]
  // La lista prioriza explorar la rutina; cada alumno abre el ejercicio que va a realizar.
  const isOpen = (id: string) => !!openMap[id]
  const toggle = (id: string) => setOpenMap((prev) => ({ ...prev, [id]: !isOpen(id) }))
  let number = 0

  function openFeedback() {
    setFeedbackOpen(true)
    requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function card(ex: SharedRoutineExercise, inCircuit = false) {
    const n = ++number
    return (
      <ExerciseCard
        key={ex.id}
        ex={ex}
        athlete={athlete}
        n={n}
        flat={inCircuit}
        token={token}
        logged={logged[ex.id] ?? {}}
        open={isOpen(ex.id)}
        onToggle={() => toggle(ex.id)}
        onSaved={onSaved}
        proLabel={proLabel}
        feedback={extras ? (extras.exercises[ex.id] ?? { note: '', effort: null }) : null}
        onFeedbackSaved={onExerciseFeedback}
      />
    )
  }

  const showBar = true
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
      <div className="hhr-masthead">
        <span className="hhr-wordmark"><BrandMark /> haciéndolo<span>hábito</span><span className="hhr-brand-period">.</span></span>
        <span className="hhr-space-label">TU ESPACIO DE ENTRENAMIENTO</span>
      </div>
      <div className={showBar ? 'hhr-app has-bar' : 'hhr-app'}>
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

          <div className={`hhr-hero hhr-hero-${athlete ?? 'neutral'}`}>
            <div className="hhr-hero-top">
              <span className="hhr-hero-kicker">{blocks.length > 1 ? `Semana ${currentWeek + 1} de ${blocks.length}` : 'Esta semana'}</span>
              {until ? <span className="hhr-hero-until">Hasta el {until}</span> : null}
            </div>
            <h2 className="hhr-hero-heading">Un poco más fuerte.<br />Un día a la vez.</h2>
            <button type="button" className="hhr-start" onClick={() => trainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Play size={13} fill="currentColor" aria-hidden /> A entrenar
            </button>
          </div>
          <section className="hhr-overview" aria-label="Tu progreso semanal">
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

          {data.feedback ? (
            <section className="hhr-fb-area" ref={feedbackRef} aria-label="Feedback de la semana">
              {feedbackPending && !fbWindowOpen ? (
                <div className="hhr-fb hhr-fb-locked" role="status">
                  <div className="hhr-fb-text">
                    <b>Feedback de la semana</b>
                    <span>Se habilita el viernes, o antes si llegás a tu último día de entrenamiento de la semana.</span>
                  </div>
                </div>
              ) : feedbackPending ? (
                <FeedbackCard
                  publicToken={data.feedback.public_token}
                  email={data.feedback.email}
                  gender={data.feedback.gender ?? null}
                  proLabel={proLabel}
                  open={feedbackOpen}
                  onOpen={() => setFeedbackOpen(true)}
                  onSent={() => setFeedbackSent(true)}
                />
              ) : (
                <div className="hhr-fb hhr-fb-done" role="status">
                  <span className="hhr-fb-art is-done" aria-hidden>
                    <Check size={22} strokeWidth={2.4} />
                  </span>
                  <div className="hhr-fb-text">
                    <b>Feedback enviado</b>
                    <span>{proFirst ? `${proFirst} ya lo puede ver.` : 'Tu entrenador ya lo puede ver.'} El próximo se habilita la semana que viene.</span>
                  </div>
                </div>
              )}
            </section>
          ) : null}
          {extras ? <UrgentCard token={token} proLabel={proLabel} /> : null}
        </aside>

        <main className="hhr-main" ref={trainRef} aria-label="Tu entrenamiento">
          <div className="hhr-main-head">
            <h2>Tu entrenamiento</h2>
            <span>Elegí tu día. Encontrá tu ritmo.</span>
          </div>
          {closeMessage ? (
            <section className="hhr-weekdone" role="status">
              <b>{closeMessage.title}</b>
              <span>{closeMessage.body}</span>
            </section>
          ) : null}

          {!routine || blocks.length === 0 ? (
            <div className="hhr-card hhr-empty-card">
              <span className="hhr-tile" aria-hidden>
                <Art name="general" fallback={<Dumbbell size={24} strokeWidth={1.8} />} />
              </span>
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
                      onClick={() => {
                        setWeek(i)
                        setDay(0)
                      }}
                    >
                      {niceCase(b.name) || `Semana ${i + 1}`}
                      {i === currentWeek ? <span className="hhr-now" aria-label="(semana actual)" /> : null}
                    </button>
                  ))}
                </nav>
              ) : null}

              {days.length > 1 ? (
                <nav className="hhr-card hhr-days" aria-label="Días">
                  {days.map((d, i) => {
                    const p = dayProgress(d, logged)
                    const dpct = p.total ? p.done / p.total : 0
                    const chip = dayChip(d.day_name, i)
                    const st = extras?.days[d.id]?.status ?? null
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={st === 'missed' ? 'hhr-day is-missed' : 'hhr-day'}
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

              {selectedDay && dayLog && askCheckin ? (
                <DayCheckinCard
                  key={selectedDay.id}
                  token={token}
                  dayId={selectedDay.id}
                  log={dayLog}
                  proLabel={proLabel}
                  onSaved={onDayLog}
                  onSkip={() => setSkippedCheckin((prev) => ({ ...prev, [selectedDay.id]: true }))}
                />
              ) : null}
              {selectedDay && dayLog && !askCheckin ? <DayCheckinSummary log={dayLog} /> : null}

              {selectedDay && warmup.length && !askCheckin ? (
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
                    {warmup.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ol>
                </details>
              ) : null}

              {askCheckin ? null : selectedDay ? (
                <div className="hhr-list">
                  {selectedDay.exercises.length === 0 ? <p className="hhr-muted">No hay ejercicios cargados para este día.</p> : null}
                  {groupExercises(selectedDay.exercises).map((g) =>
                    g.circuit ? (
                      <div key={g.items[0]!.id} className="hhr-card hhr-circuit">
                        <p className="hhr-circuit-label">
                          <b className="hhr-circuit-tag">
                            <Link2 size={14} strokeWidth={2.2} aria-hidden />
                            Circuito
                          </b>
                          <span>
                            {g.items.length} ejercicios seguidos, sin pausa entre ellos
                          </span>
                        </p>
                        <div className="hhr-circuit-list">
                          {g.items.map((ex, i) => (
                            <Fragment key={ex.id}>
                              {i > 0 ? (
                                <span className="hhr-circuit-plus" aria-hidden>
                                  +
                                </span>
                              ) : null}
                              {card(ex, true)}
                            </Fragment>
                          ))}
                        </div>
                        <p className="hhr-circuit-foot">Descansá recién cuando termines los {g.items.length}.</p>
                      </div>
                    ) : (
                      card(g.items[0]!)
                    ),
                  )}
                  {dayLog && selectedDay.exercises.length > 0 ? (
                    <DayCloseCard
                      key={`close-${selectedDay.id}`}
                      token={token}
                      dayId={selectedDay.id}
                      log={dayLog}
                      today={today}
                      allSetsDone={selectedProgress.total > 0 && selectedProgress.done >= selectedProgress.total}
                      onSaved={onDayLog}
                      proLabel={proLabel}
                      onAnswerFeedback={mustAnswerFirst ? openFeedback : null}
                    />
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

      {showBar ? (
        <nav className="hhr-bar" aria-label="Accesos">
          <button type="button" className="hhr-bar-btn" aria-label="Ir al entrenamiento" onClick={() => trainRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            <Dumbbell size={21} strokeWidth={1.8} aria-hidden />
          </button>
          {feedbackPending && fbWindowOpen ? (
            <button type="button" className="hhr-bar-fb" onClick={openFeedback}>
              <span className="hhr-dot" aria-hidden />
              Mi feedback
            </button>
          ) : data.feedback && !feedbackPending ? (
            <span className="hhr-bar-btn is-static" aria-label="Feedback enviado">
              <ClipboardCheck size={21} strokeWidth={1.8} aria-hidden />
            </span>
          ) : null}
          {waDigits ? (
            <a className="hhr-bar-btn" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp">
              <MessageCircle size={21} strokeWidth={1.8} aria-hidden />
            </a>
          ) : null}
        </nav>
      ) : null}
    </Shell>
  )
}

/** Ícono de la app (el del proyecto: naranja con la marca en negro), igual al de `public/logo-brand.png`. */
function BrandMark() {
  return (
    <svg className="hhr-brand-mark" viewBox="113 188 374 380" aria-hidden>
      <defs>
        <linearGradient id="hhr-brand-orange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF7A1A" />
          <stop offset="1" stopColor="#FF4D00" />
        </linearGradient>
      </defs>
      <rect x="113" y="188" width="374" height="380" rx="84" fill="url(#hhr-brand-orange)" />
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
}: {
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
  const tags = [main.replace(/''/g, '″'), chips[0]].filter(Boolean) as string[]
  return (
    <article className={`hhr-ex${flat ? ' is-flat' : ' hhr-card'}${complete ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
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
          <span className="hhr-progress">
            <span className="hhr-progress-track" aria-hidden>
              <span className="hhr-progress-fill" style={{ width: `${(done / sets) * 100}%` }} />
            </span>
            <span className="hhr-progress-label">{complete ? 'Listo' : `${done}/${sets} series`}</span>
          </span>
        </span>
        <ChevronDown className="hhr-chev" size={20} strokeWidth={1.8} aria-hidden />
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
          <KgInputs ex={ex} sets={sets} token={token} logged={logged} onSaved={onSaved} />
          {feedback ? <ExerciseFeedbackBox token={token} exerciseId={ex.id} value={feedback} proLabel={proLabel} onSaved={onFeedbackSaved} /> : null}
        </div>
      ) : null}
    </article>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** «10» o «8-10» llevan «reps»; «20''», «30 s» o «6+6» quedan como están. */
function withReps(reps: string): string {
  const t = reps.trim()
  if (!t) return ''
  return /^\d+(\s*[-–]\s*\d+)?$/.test(t) ? `${t} reps` : t.replace(/''/g, '″')
}

/** Lo indicado para la serie i: «10 reps · 60 kg». */
function setTarget(ex: SharedRoutineExercise, plan: { kg?: string; reps?: string }[], i: number): string {
  const scheme = repsText(ex)
  const parts = scheme.includes('/') ? scheme.split('/').map((s) => s.trim()) : []
  const reps = plan[i]?.reps?.trim() || parts[i] || (parts.length ? '' : scheme)
  const kgRaw = plan[i]?.kg?.trim()
  const kg = kgRaw ? kgRaw.replace('.', ',') : ex.weight_kg != null && ex.weight_kg > 0 ? formatKg(ex.weight_kg) : ''
  return [withReps(reps), kg ? `${kg} kg` : ''].filter(Boolean).join(' · ')
}

/** Indicado por tiempo («20 s», «30''», «1 min»): ahí no se piden repeticiones. */
function isTimeBased(ex: SharedRoutineExercise): boolean {
  return /″|''|"|\d\s*(s|seg|min)\b/i.test(repsText(ex))
}

/** Reps y peso opcionales y check independiente. Solo se confirma el progreso al guardar en el servidor. */
function KgInputs({ ex, sets, token, logged, onSaved }: {
  ex: SharedRoutineExercise
  sets: number
  token: string
  logged: Record<number, LoggedSet>
  onSaved: (exId: string, set: number, value: LoggedSet) => void
}) {
  const plan = useMemo(() => parseExerciseMeta(ex.technical_notes).meta.seriesPlan ?? [], [ex.technical_notes])
  const [values, setValues] = useState<string[]>(() => Array.from({ length: sets }, (_, i) => formatKg(logged[i + 1]?.kg)))
  const [repsValues, setRepsValues] = useState<string[]>(() =>
    Array.from({ length: sets }, (_, i) => (logged[i + 1]?.reps != null ? String(logged[i + 1]!.reps) : '')),
  )
  const timeBased = isTimeBased(ex)
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
    const k = plan[i]?.kg?.trim()
    if (k) return k.replace('.', ',')
    return ex.weight_kg != null && ex.weight_kg > 0 ? formatKg(ex.weight_kg) : '—'
  }

  function setStatusAt(i: number, s: SaveState) {
    setStatus((prev) => prev.map((v, j) => (j === i ? s : v)))
  }

  async function save(i: number, raw: string, rawReps: string, explicitCompleted?: boolean) {
    clearTimeout(timers.current[i])
    if (inFlight.current.has(i)) return
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
    if (kg === before.kg && reps === (before.reps ?? null) && completed === before.completed) {
      setStatusAt(i, 'idle')
      return
    }
    inFlight.current.add(i)
    setStatusAt(i, 'saving')
    try {
      await saveSharedSet(token, ex.id, i + 1, kg, completed, reps)
      const next = { kg, reps, completed }
      lastSaved.current[i + 1] = next
      onSaved(ex.id, i + 1, next)
      setStatusAt(i, 'saved')
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

  /** Lo indicado como sugerencia en el casillero: «8-10» → «8», «12» → «12». */
  function repsPlaceholder(i: number): string {
    const scheme = repsText(ex)
    const parts = scheme.includes('/') ? scheme.split('/').map((s) => s.trim()) : []
    const r = plan[i]?.reps?.trim() || parts[i] || (parts.length ? '' : scheme)
    const m = /\d+/.exec(r)
    return m ? m[0] : '—'
  }

  return (
    <div className="hhr-kg">
      <p className="hhr-kg-hint">Tildá cada serie al terminar. {timeBased ? 'Los kilos son opcionales.' : 'Las reps y los kilos son opcionales.'}</p>
      <div className="hhr-sets-head" aria-hidden>
        <span>Serie</span><span>Indicado</span><span>{timeBased ? '' : 'Reps'}</span><span>Kg</span>
      </div>
      <ol className="hhr-sets">
        {values.map((v, i) => {
          const completed = logged[i + 1]?.completed ?? false
          const saving = status[i] === 'saving'
          // Con la columna «Reps» a la vista, lo indicado va sin la palabra: «8-10 · 60 kg».
          const target = timeBased ? setTarget(ex, plan, i) : setTarget(ex, plan, i).replace(/ reps\b/, '')
          const errorId = `hhr-save-error-${ex.id}-${i}`
          return (
            <li key={i} className={`hhr-setrow is-${status[i]}${completed ? ' is-logged' : ''}`} aria-busy={saving}>
              <span className="hhr-setno" aria-hidden>{i + 1}</span>
              <span className="hhr-settarget">{target || '—'}</span>
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
                  aria-label={`${niceCase(ex.name) || 'Ejercicio'}, kilos opcionales de la serie ${i + 1}`}
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

type FormPayload = { ok: boolean; title?: string; questions?: Json; error?: string }

function isAnswered(q: CheckInQuestion, d: CheckInAnswerDraft | undefined): boolean {
  if (!d) return false
  if (q.type === 'choice') return !!d.optionId
  return !!d.text.trim()
}

/** Feedback de la semana: tarjeta cerrada con el botón, y al abrirla una pregunta por vez. */
function FeedbackCard({
  publicToken,
  email,
  gender,
  proLabel,
  open,
  onOpen,
  onSent,
}: {
  publicToken: string
  email: string | null
  gender: string | null
  proLabel: string
  open: boolean
  onOpen: () => void
  onSent: () => void
}) {
  const [payload, setPayload] = useState<FormPayload | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CheckInAnswerDraft>>({})
  const [step, setStep] = useState(0)
  const [responderEmail, setResponderEmail] = useState(email ?? '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void supabasePublic.rpc('get_check_in_form_by_public_token', { p_public_token: publicToken }).then(({ data }) => {
      if (alive) setPayload((data as FormPayload | null) ?? { ok: false })
    })
    return () => {
      alive = false
    }
  }, [publicToken])

  const allQuestions = useMemo(() => (payload?.ok && payload.questions ? parseQuestions(payload.questions) : []), [payload])
  const questions = useMemo(() => allQuestions.filter((q) => isQuestionVisible(q, gender)), [allQuestions, gender])
  const total = questions.length
  const si = Math.min(step, Math.max(0, total - 1))
  const q = questions[si]
  const last = si === total - 1
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responderEmail.trim())
  const duration = total <= 4 ? 'un minuto' : `unos ${Math.max(2, Math.round(total / 3))} minutos`

  function next() {
    if (!q) return
    const err = validateDrafts([q], drafts, gender)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep(si + 1)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!last) {
      next()
      return
    }
    const err = validateDrafts(allQuestions, drafts, gender)
    if (err) {
      setError(err)
      return
    }
    if (!emailOk) {
      setError('Escribí el correo con el que te inscribiste.')
      return
    }
    setError(null)
    setSending(true)
    const { data, error: rpcError } = await supabasePublic.rpc('submit_check_in_shared_response', {
      p_public_token: publicToken,
      p_answers: serializeDrafts(allQuestions, drafts, gender) as unknown as Json,
      p_testimonial_consent: false,
      p_responder_email: responderEmail.trim(),
    })
    setSending(false)
    const res = data as { ok?: boolean; error?: string } | null
    if ((!rpcError && res?.ok) || res?.error === 'already_submitted') {
      onSent()
      return
    }
    setError(
      res?.error === 'rate_limited'
        ? 'Demasiados intentos. Probá de nuevo en un rato.'
        : res?.error && /email|student/.test(res.error)
          ? 'No pudimos validar tu correo. Usá el mismo con el que te inscribiste.'
          : 'No se pudo enviar. Probá de nuevo en unos minutos.',
    )
  }

  const art = (
    <span className="hhr-fb-art" aria-hidden>
      <Art name="feedback" fallback={<ClipboardCheck size={22} strokeWidth={1.8} />} />
    </span>
  )

  if (!open) {
    return (
      <div className="hhr-fb">
        <div className="hhr-fb-row">
          {art}
          <div className="hhr-fb-text">
            <span className="hhr-fb-badge">Pendiente</span>
            <b>Feedback de la semana</b>
            <span>{total ? `${total} preguntas · ${duration}` : `Lo lee ${proLabel} para ajustar tu rutina`}</span>
          </div>
        </div>
        <button type="button" className="hhr-cta" onClick={onOpen}>
          Responder ahora
        </button>
      </div>
    )
  }

  const answeredBefore = questions.slice(0, si).length + (q && isAnswered(q, drafts[q.id]) ? 1 : 0)
  return (
    <div className="hhr-fb is-open">
      <div className="hhr-fb-row">
        {art}
        <div className="hhr-fb-text">
          <b>¿Cómo te fue esta semana?</b>
          <span>Lo lee {proLabel} para ajustar tu rutina.</span>
        </div>
      </div>

      {!payload ? (
        <p className="hhr-fb-note">Cargando preguntas…</p>
      ) : !payload.ok || total === 0 || !q ? (
        <p className="hhr-fb-note">El formulario no está disponible ahora. Avisale a {proLabel}.</p>
      ) : (
        <form className="hhr-fb-form" onSubmit={(e) => void submit(e)}>
          <div className="hhr-fb-progress">
            <span className="hhr-fb-count" aria-live="polite">
              Pregunta {si + 1} de {total}
            </span>
            {total <= 8 ? (
              <span className="hhr-steps" aria-hidden>
                {questions.map((qq, i) => (
                  <span key={qq.id} className={i < si || (i === si && isAnswered(qq, drafts[qq.id])) ? 'is-on' : i === si ? 'is-cur' : ''} />
                ))}
              </span>
            ) : (
              <span className="hhr-fb-bar" aria-hidden>
                <span style={{ width: `${(answeredBefore / total) * 100}%` }} />
              </span>
            )}
          </div>
          <div className="hhr-q" key={q.id}>
            <CheckInQuestionFields
              question={q}
              index={si}
              draft={drafts[q.id] ?? emptyAnswerDraft()}
              onChange={(nextDraft) => {
                setError(null)
                setDrafts((prev) => ({ ...prev, [q.id]: nextDraft }))
              }}
            />
          </div>
          {last && !email ? (
            <label className="hhr-fb-email">
              <span>Tu correo (el mismo con el que te inscribiste)</span>
              <input
                type="email"
                autoComplete="email"
                value={responderEmail}
                onChange={(e) => setResponderEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </label>
          ) : null}
          {error ? (
            <p className="hhr-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="hhr-fb-actions">
            {si > 0 ? (
              <button
                type="button"
                className="hhr-ghost"
                aria-label="Pregunta anterior"
                onClick={() => {
                  setError(null)
                  setStep(si - 1)
                }}
              >
                <ArrowLeft size={18} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            <button type="submit" className="hhr-cta" disabled={sending || !isAnswered(q, drafts[q.id])}>
              {sending ? 'Enviando…' : last ? 'Enviar feedback' : 'Siguiente'}
            </button>
          </div>
        </form>
      )}
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
