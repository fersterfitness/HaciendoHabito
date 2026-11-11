import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, Check, ChevronDown, ClipboardCheck, Dumbbell, Flame, MessageCircle, Play, Repeat } from 'lucide-react'
import {
  currentBlockIndex,
  exerciseDetails,
  fetchSharedRoutine,
  formatKg,
  groupExercises,
  logSharedSet,
  parseKg,
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

/**
 * Rutina que abre el alumno desde el link (sin cuenta). Dos cosas separadas:
 * - El entrenamiento: días de la semana y ejercicios, donde anota los kilos de cada serie (el entrenador los ve).
 * - El feedback de la semana: tarjeta propia que se responde acá mismo, pregunta por pregunta, y queda
 *   a la vista (y en la barra de abajo en el celu) hasta que se envía.
 * En el celu es una columna; en la compu, a la izquierda el resumen y el feedback, a la derecha el entrenamiento.
 */

function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function dateLabel(ymd: string | null | undefined, pattern = "d 'de' MMMM"): string | null {
  if (!ymd) return null
  const d = new Date(ymd.length === 10 ? ymd + 'T12:00:00' : ymd)
  return Number.isNaN(d.getTime()) ? null : format(d, pattern, { locale: es })
}

/** Series en las que se puede anotar (1 a 10). */
function setCount(ex: SharedRoutineExercise): number {
  return Math.min(Math.max(ex.sets ?? 1, 1), 10)
}

/** Kilos anotados: id de ejercicio → número de serie → kg. */
type LoggedMap = Record<string, Record<number, number>>

function loggedFrom(data: SharedRoutine | null): LoggedMap {
  const out: LoggedMap = {}
  for (const b of data?.routine?.blocks ?? [])
    for (const d of b.days)
      for (const ex of d.exercises) {
        const m: Record<number, number> = {}
        for (const l of ex.logs ?? []) if (l.weight_kg != null) m[l.set] = Number(l.weight_kg)
        out[ex.id] = m
      }
  return out
}

function exerciseProgress(ex: SharedRoutineExercise, logged: LoggedMap): { done: number; total: number } {
  const total = setCount(ex)
  const m = logged[ex.id] ?? {}
  let done = 0
  for (let s = 1; s <= total; s++) if (m[s] != null) done += 1
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
  return { label: t ? t.slice(0, 3) : 'Día', big: String(i + 1) }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '').toUpperCase() || 'H'
}

const TILE_TONES = ['lav', 'peach', 'sky', 'mint', 'rose'] as const

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

  useLightPage()

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
  const firstName = data?.student_first_name?.trim() ?? ''
  const feedbackPending = !!data?.feedback && !data.feedback.done && !feedbackSent

  useEffect(() => {
    document.title = firstName ? `Rutina de ${firstName}` : 'Tu rutina'
  }, [firstName])

  const onSaved = useCallback((exId: string, set: number, kg: number | null) => {
    setLogged((prev) => {
      const m = { ...(prev[exId] ?? {}) }
      if (kg == null) delete m[set]
      else m[set] = kg
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
            <Dumbbell size={26} strokeWidth={1.8} />
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
  const proFirst = data.professional_name && !data.professional_name.includes('@') ? data.professional_name.trim().split(/\s+/)[0] : ''
  const proLabel = proFirst || 'tu entrenador'
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
  // Abierto por defecto: el primer ejercicio del día que todavía no está completo.
  const firstPendingId = selectedDay?.exercises.find((ex) => {
    const p = exerciseProgress(ex, logged)
    return p.done < p.total
  })?.id
  const isOpen = (id: string) => (id in openMap ? !!openMap[id] : id === firstPendingId)
  const toggle = (id: string) => setOpenMap((prev) => ({ ...prev, [id]: !isOpen(id) }))
  let number = 0

  function openFeedback() {
    setFeedbackOpen(true)
    requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function card(ex: SharedRoutineExercise) {
    const n = ++number
    return (
      <ExerciseCard
        key={ex.id}
        ex={ex}
        n={n}
        token={token}
        logged={logged[ex.id] ?? {}}
        open={isOpen(ex.id)}
        onToggle={() => toggle(ex.id)}
        onSaved={onSaved}
      />
    )
  }

  const showBar = feedbackPending || !!waDigits

  return (
    <Shell>
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
                <span className="hhr-round-btn-text">{proFirst ? `Escribir a ${proFirst}` : 'Escribir'}</span>
              </a>
            ) : null}
          </header>

          <div className="hhr-hero">
            <div className="hhr-hero-text">
              <span className="hhr-hero-kicker">
                {blocks.length > 1 ? `Semana ${currentWeek + 1} de ${blocks.length}` : 'Esta semana'}
              </span>
              <span className="hhr-hero-big">
                {weekProgress.done}/{weekProgress.total || 0}
                <small> series</small>
              </span>
              <span className="hhr-hero-sub">
                {weekProgress.total === 0
                  ? 'Todavía no hay series cargadas'
                  : pct === 100
                    ? 'Semana completa'
                    : weekProgress.done === 0
                      ? 'Anotá los kilos a medida que entrenás'
                      : 'Vas bien, seguí anotando'}
              </span>
            </div>
            <Ring pct={pct} />
            <div className="hhr-hero-foot">
              <span>{routine?.name || 'Tu rutina'}</span>
              {until ? <span>Hasta el {until}</span> : null}
              {routine?.objective ? <p className="hhr-hero-goal">{routine.objective}</p> : null}
            </div>
          </div>

          {data.feedback ? (
            <section className="hhr-fb-area" ref={feedbackRef} aria-label="Feedback de la semana">
              {feedbackPending ? (
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
                  <span className="hhr-icon-tile hhr-tone-ok" aria-hidden>
                    <Check size={22} strokeWidth={2.2} />
                  </span>
                  <div className="hhr-fb-done-text">
                    <b>Feedback enviado</b>
                    <p>{proFirst ? `${proFirst} ya lo puede ver.` : 'Tu entrenador ya lo puede ver.'} El próximo se habilita la semana que viene.</p>
                  </div>
                </div>
              )}
            </section>
          ) : null}
        </aside>

        <main className="hhr-main" ref={trainRef} aria-label="Tu entrenamiento">
          <div className="hhr-main-head">
            <h2>Tu entrenamiento</h2>
            <span>{proFirst ? `${proFirst} ve los kilos que anotás` : 'Tu entrenador ve los kilos que anotás'}</span>
          </div>

          {!routine || blocks.length === 0 ? (
            <div className="hhr-card hhr-empty-card">
              <span className="hhr-icon-tile hhr-tone-lav" aria-hidden>
                <Dumbbell size={22} strokeWidth={1.8} />
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
                      {b.name || `Semana ${i + 1}`}
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
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className="hhr-day"
                        aria-pressed={i === di}
                        aria-label={`${d.day_name || `Día ${i + 1}`}: ${p.done} de ${p.total} series`}
                        onClick={() => setDay(i)}
                      >
                        <span className="hhr-day-label">{chip.label}</span>
                        <span className="hhr-day-num">{chip.big}</span>
                        <MiniArc value={dpct} />
                      </button>
                    )
                  })}
                </nav>
              ) : null}

              {selectedDay ? (
                <section className="hhr-card hhr-daycard">
                  <header className="hhr-daycard-head">
                    <div>
                      <h3>{selectedDay.day_name || 'Entrenamiento'}</h3>
                      <span>
                        {selectedDay.muscle_focus ? `${selectedDay.muscle_focus} · ` : ''}
                        {selectedDay.exercises.length} {selectedDay.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                      </span>
                    </div>
                    {selectedProgress.total ? (
                      <span className={selectedProgress.done >= selectedProgress.total ? 'hhr-pill is-ok' : 'hhr-pill'}>
                        {selectedProgress.done >= selectedProgress.total ? (
                          <>
                            <Check size={14} strokeWidth={2.4} aria-hidden /> Hecho
                          </>
                        ) : (
                          `${selectedProgress.done}/${selectedProgress.total} series`
                        )}
                      </span>
                    ) : null}
                  </header>

                  {warmup.length ? (
                    <details className="hhr-warmup">
                      <summary>
                        <span className="hhr-icon-tile hhr-tone-peach hhr-icon-sm" aria-hidden>
                          <Flame size={18} strokeWidth={1.8} />
                        </span>
                        <span className="hhr-warmup-title">
                          <b>Entrada en calor</b>
                          <small>
                            {warmup.length} {warmup.length === 1 ? 'paso' : 'pasos'} antes de empezar
                          </small>
                        </span>
                        <ChevronDown className="hhr-chev" size={18} strokeWidth={1.8} aria-hidden />
                      </summary>
                      <ul>
                        {warmup.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </section>
              ) : null}

              {selectedDay ? (
                <div className="hhr-list">
                  {selectedDay.exercises.length === 0 ? <p className="hhr-muted">No hay ejercicios cargados para este día.</p> : null}
                  {groupExercises(selectedDay.exercises).map((g) =>
                    g.circuit ? (
                      <div key={g.items[0]!.id} className="hhr-circuit">
                        <p className="hhr-circuit-label">
                          <Repeat size={15} strokeWidth={2} aria-hidden /> Circuito · hacé estos ejercicios seguidos
                        </p>
                        <div className="hhr-circuit-list">{g.items.map((ex) => card(ex))}</div>
                      </div>
                    ) : (
                      card(g.items[0]!)
                    ),
                  )}
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
          {feedbackPending ? (
            <button type="button" className="hhr-bar-fb" onClick={openFeedback}>
              <span className="hhr-dot" aria-hidden />
              <ClipboardCheck size={18} strokeWidth={1.9} aria-hidden />
              Responder feedback
            </button>
          ) : data.feedback ? (
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

function Ring({ pct }: { pct: number }) {
  const r = 34
  const c = 2 * Math.PI * r
  return (
    <span className="hhr-ring" role="img" aria-label={`${pct}% de la semana anotada`}>
      <svg viewBox="0 0 84 84" width="84" height="84" aria-hidden>
        <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke="var(--ring)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 42 42)"
          opacity={pct === 0 ? 0 : 1}
        />
      </svg>
      <b>{pct}%</b>
    </span>
  )
}

/** Arco chico debajo de cada día, como el calendario de la referencia. */
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
    </svg>
  )
}

function ExerciseCard({
  ex,
  n,
  token,
  logged,
  open,
  onToggle,
  onSaved,
}: {
  ex: SharedRoutineExercise
  n: number
  token: string
  logged: Record<number, number>
  open: boolean
  onToggle: () => void
  onSaved: (exId: string, set: number, kg: number | null) => void
}) {
  const main = setsRepsText(ex)
  const { chips, notes } = exerciseDetails(ex)
  const sets = setCount(ex)
  const done = Array.from({ length: sets }, (_, i) => logged[i + 1] != null).filter(Boolean).length
  const complete = done >= sets
  const tone = TILE_TONES[(n - 1) % TILE_TONES.length]
  const panelId = `hhr-ex-${ex.id}`
  const sub = [main, chips[0]].filter(Boolean).join(' · ')
  return (
    <article className={`hhr-card hhr-ex${complete ? ' is-done' : ''}${open ? ' is-open' : ''}`}>
      <button type="button" className="hhr-ex-head" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        {ex.image_url ? (
          <span className="hhr-thumb has-img" aria-hidden>
            <img src={ex.image_url} alt="" loading="lazy" />
            {complete ? (
              <span className="hhr-thumb-check">
                <Check size={14} strokeWidth={2.6} />
              </span>
            ) : null}
          </span>
        ) : (
          <span className={complete ? 'hhr-thumb hhr-tone-ok' : `hhr-thumb hhr-tone-${tone}`} aria-hidden>
            {complete ? <Check size={24} strokeWidth={2.2} /> : n}
          </span>
        )}
        <span className="hhr-ex-info">
          <span className="hhr-ex-name">{ex.name || 'Ejercicio'}</span>
          {sub ? <span className="hhr-ex-sub">{sub}</span> : null}
          <span className="hhr-bar-track" aria-hidden>
            <span className="hhr-bar-fill" style={{ width: `${(done / sets) * 100}%` }} />
          </span>
          <span className="hhr-ex-count">
            {complete ? 'Completo' : `${done} de ${sets} ${sets === 1 ? 'serie anotada' : 'series anotadas'}`}
          </span>
        </span>
        <ChevronDown className="hhr-chev" size={20} strokeWidth={1.8} aria-hidden />
      </button>

      {open ? (
        <div className="hhr-ex-panel" id={panelId}>
          {chips.length > 1 || notes || ex.video_url ? (
            <div className="hhr-ex-extra">
              {chips.length > 1 ? (
                <ul className="hhr-chips">
                  {chips.slice(1).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
              {notes ? <p className="hhr-notes">{notes}</p> : null}
              {ex.video_url ? (
                <a className="hhr-video" href={ex.video_url} target="_blank" rel="noopener noreferrer">
                  <Play size={14} strokeWidth={2.2} aria-hidden /> Ver video
                </a>
              ) : null}
            </div>
          ) : null}
          <KgInputs ex={ex} sets={sets} token={token} logged={logged} onSaved={onSaved} />
        </div>
      ) : null}
    </article>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Lo indicado para la serie i: «10 reps · 60 kg». */
function setTarget(ex: SharedRoutineExercise, plan: { kg?: string; reps?: string }[], i: number): string {
  const scheme = repsText(ex)
  const parts = scheme.includes('/') ? scheme.split('/').map((s) => s.trim()) : []
  const reps = plan[i]?.reps?.trim() || parts[i] || (parts.length ? '' : scheme)
  const kgRaw = plan[i]?.kg?.trim()
  const kg = kgRaw ? kgRaw.replace('.', ',') : ex.weight_kg != null && ex.weight_kg > 0 ? formatKg(ex.weight_kg) : ''
  return [reps ? `${reps} reps` : '', kg ? `${kg} kg` : ''].filter(Boolean).join(' · ')
}

/** Kilos por serie, una fila por serie. Se guarda solo (al dejar de escribir o al salir del campo). */
function KgInputs({
  ex,
  sets,
  token,
  logged,
  onSaved,
}: {
  ex: SharedRoutineExercise
  sets: number
  token: string
  logged: Record<number, number>
  onSaved: (exId: string, set: number, kg: number | null) => void
}) {
  const plan = useMemo(() => parseExerciseMeta(ex.technical_notes).meta.seriesPlan ?? [], [ex.technical_notes])
  const [values, setValues] = useState<string[]>(() => Array.from({ length: sets }, (_, i) => formatKg(logged[i + 1])))
  const [status, setStatus] = useState<SaveState[]>(() => Array.from({ length: sets }, () => 'idle'))
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const lastSaved = useRef<Record<number, number | null>>({})

  useEffect(() => {
    const t = timers.current
    return () => Object.values(t).forEach(clearTimeout)
  }, [])

  function placeholder(i: number): string {
    const k = plan[i]?.kg?.trim()
    if (k) return k.replace('.', ',')
    return ex.weight_kg != null && ex.weight_kg > 0 ? formatKg(ex.weight_kg) : '–'
  }

  function setStatusAt(i: number, s: SaveState) {
    setStatus((prev) => prev.map((v, j) => (j === i ? s : v)))
  }

  async function save(i: number, raw: string) {
    clearTimeout(timers.current[i])
    const kg = parseKg(raw)
    if (kg === undefined) {
      setStatusAt(i, 'error')
      return
    }
    const before = i + 1 in lastSaved.current ? lastSaved.current[i + 1] : (logged[i + 1] ?? null)
    if (kg === before) return
    setStatusAt(i, 'saving')
    try {
      await logSharedSet(token, ex.id, i + 1, kg)
      lastSaved.current[i + 1] = kg
      onSaved(ex.id, i + 1, kg)
      setStatusAt(i, kg == null ? 'idle' : 'saved')
    } catch {
      setStatusAt(i, 'error')
    }
  }

  function onChange(i: number, raw: string) {
    setValues((prev) => prev.map((v, j) => (j === i ? raw : v)))
    clearTimeout(timers.current[i])
    timers.current[i] = setTimeout(() => void save(i, raw), 900)
  }

  const anyError = status.includes('error')
  return (
    <div className="hhr-kg">
      <ol className="hhr-sets">
        {values.map((v, i) => {
          const isLogged = status[i] === 'saved' || (status[i] === 'idle' && v.trim() !== '' && logged[i + 1] != null)
          const target = setTarget(ex, plan, i)
          return (
            <li key={i} className={`hhr-setrow is-${status[i]}${isLogged ? ' is-logged' : ''}`}>
              <span className="hhr-setno" aria-hidden>
                {i + 1}
              </span>
              <span className="hhr-settarget">
                <b>{sets > 1 ? `Serie ${i + 1}` : 'Serie'}</b>
                {target ? <small>{target}</small> : null}
              </span>
              <label className="hhr-kgfield">
                <input
                  inputMode="decimal"
                  autoComplete="off"
                  enterKeyHint="done"
                  maxLength={6}
                  value={v}
                  placeholder={placeholder(i)}
                  aria-label={`${ex.name || 'Ejercicio'}, kilos de la serie ${i + 1}`}
                  onChange={(e) => onChange(i, e.target.value)}
                  onBlur={(e) => void save(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                />
                <span aria-hidden>kg</span>
              </label>
              <span className="hhr-setcheck" aria-hidden>
                {isLogged ? <Check size={15} strokeWidth={2.8} /> : null}
              </span>
            </li>
          )
        })}
      </ol>
      {anyError ? <p className="hhr-error">No se pudo guardar. Revisá el número (por ejemplo 62,5) y probá de nuevo.</p> : null}
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
  const duration = total <= 4 ? 'un minuto' : `unos ${Math.round(total / 3)} minutos`

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

  if (!open) {
    return (
      <div className="hhr-fb">
        <div className="hhr-fb-row">
          <span className="hhr-icon-tile hhr-tone-violet" aria-hidden>
            <ClipboardCheck size={22} strokeWidth={1.8} />
          </span>
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

  return (
    <div className="hhr-fb is-open">
      <div className="hhr-fb-row">
        <span className="hhr-icon-tile hhr-tone-violet hhr-icon-sm" aria-hidden>
          <ClipboardCheck size={18} strokeWidth={1.8} />
        </span>
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
          <div className="hhr-steps" aria-hidden>
            {questions.map((qq, i) => (
              <span key={qq.id} className={i < si || (i === si && isAnswered(qq, drafts[qq.id])) ? 'is-on' : i === si ? 'is-cur' : ''} />
            ))}
          </div>
          <p className="hhr-fb-count" aria-live="polite">
            Pregunta {si + 1} de {total}
          </p>
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

/** La página del alumno siempre en claro, aunque el dispositivo tenga guardado el tema oscuro de la app. */
function useLightPage() {
  useEffect(() => {
    const html = document.documentElement
    const hadDark = html.classList.contains('dark')
    html.classList.remove('dark')
    return () => {
      if (hadDark) html.classList.add('dark')
    }
  }, [])
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="hhr">
      <style>{CSS}</style>
      <div className="hhr-inner">{children}</div>
    </div>
  )
}

/** Estilos propios (no dependen del tema ni de la versión que tenga guardada quien la abre). */
const CSS = `
.hhr {
  --canvas: #F4F4F2; --card: #FFFFFF; --soft: #F5F4F2; --soft-2: #EEEDEA;
  --ink: #17151C; --ink-2: #57535E; --muted: #8E8A95; --faint: #BEBAC2;
  --violet: #7B61D9; --violet-ink: #4D3B94; --violet-wash: #F0ECFC; --hero: #221C31; --hero-2: #2E2545; --ring: #B8A7F2;
  --accent: #F08A24; --ok: #2E8A55; --ok-wash: #E3F4EA; --err: #B4233A; --arc-track: #ECEBE8;
  --lav: #ECE6FB; --peach: #FDEBDC; --sky: #E1EEFB; --mint: #E0F3E8; --rose: #FBE4EA;
  --shadow: 0 1px 2px rgba(23,21,28,.04), 0 10px 28px -16px rgba(23,21,28,.16);
  min-height: 100vh; background: var(--canvas); color: var(--ink); color-scheme: light;
  font-family: 'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased;
}
.hhr * { box-sizing: border-box; }
.hhr button, .hhr a, .hhr input { font: inherit; -webkit-tap-highlight-color: transparent; }
.hhr button { cursor: pointer; }
.hhr button:focus-visible, .hhr a:focus-visible, .hhr summary:focus-visible, .hhr input:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; }
.hhr-inner { max-width: 1200px; margin: 0 auto; padding: 18px max(18px, env(safe-area-inset-right)) 32px max(18px, env(safe-area-inset-left)); }
.hhr-muted { margin: 4px 4px; color: var(--muted); }

/* Estados */
.hhr-state { padding: 20vh 0; text-align: center; color: var(--ink-2); display: grid; justify-items: center; gap: 6px; }
.hhr-state-icon { width: 60px; height: 60px; border-radius: 20px; background: var(--lav); color: var(--violet-ink); display: grid; place-items: center; margin-bottom: 8px; }
.hhr-state h1 { margin: 0; font-size: 22px; color: var(--ink); letter-spacing: -0.02em; }
.hhr-state p { margin: 0; max-width: 36ch; }
.hhr-skeleton { display: grid; gap: 16px; max-width: 520px; margin: 0 auto; padding-top: 12px; }
.hhr-sk { display: block; border-radius: 24px; background: linear-gradient(90deg, #ECEBE8 0%, #F6F5F3 50%, #ECEBE8 100%); background-size: 200% 100%; animation: hhr-sh 1.3s ease-in-out infinite; }
.hhr-sk-title { height: 44px; width: 60%; border-radius: 14px; }
.hhr-sk-hero { height: 150px; }
.hhr-sk-card { height: 92px; }
@keyframes hhr-sh { to { background-position: -200% 0; } }

/* Composición */
.hhr-app { display: grid; gap: 18px; grid-template-columns: minmax(0, 1fr); }
.hhr-app.has-bar { padding-bottom: 88px; }
.hhr-side, .hhr-main { display: grid; gap: 16px; align-content: start; min-width: 0; }

/* Cabecera */
.hhr-top { display: flex; align-items: center; gap: 12px; }
.hhr-avatar { flex: 0 0 auto; width: 46px; height: 46px; border-radius: 50%; background: var(--lav); color: var(--violet-ink); display: grid; place-items: center; font-weight: 700; font-size: 16px; letter-spacing: .02em; }
.hhr-hello { flex: 1 1 auto; min-width: 0; display: grid; }
.hhr-today { color: var(--muted); font-size: 13px; }
.hhr-today::first-letter { text-transform: uppercase; }
.hhr-hello h1 { margin: 0; font-size: 24px; line-height: 1.15; letter-spacing: -0.03em; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-round-btn { flex: 0 0 auto; height: 46px; min-width: 46px; border-radius: 999px; background: var(--card); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; box-shadow: var(--shadow); font-size: 14px; font-weight: 600; }
.hhr-round-btn:hover { background: var(--soft); }
.hhr-round-btn-text { display: none; }

/* Tarjeta oscura de la semana */
.hhr-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 6px 16px; padding: 22px 22px 18px; border-radius: 28px; color: #fff;
  background: linear-gradient(140deg, var(--hero-2) 0%, var(--hero) 60%); box-shadow: 0 18px 40px -22px rgba(34,28,49,.7); }
.hhr-hero::after { content: ''; position: absolute; right: -60px; top: -80px; width: 220px; height: 220px; border-radius: 50%; background: radial-gradient(circle, rgba(184,167,242,.22), transparent 70%); pointer-events: none; }
.hhr-hero-text { display: grid; gap: 4px; min-width: 0; }
.hhr-hero-kicker { font-size: 13px; color: rgba(255,255,255,.66); font-weight: 500; }
.hhr-hero-big { font-size: 38px; font-weight: 700; letter-spacing: -0.04em; line-height: 1; font-variant-numeric: tabular-nums; }
.hhr-hero-big small { font-size: 16px; font-weight: 500; letter-spacing: -0.01em; color: rgba(255,255,255,.7); }
.hhr-hero-sub { font-size: 14px; color: rgba(255,255,255,.8); }
.hhr-ring { position: relative; width: 84px; height: 84px; display: grid; place-items: center; }
.hhr-ring svg { position: absolute; inset: 0; }
.hhr-ring circle { transition: stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1); }
.hhr-ring b { font-size: 17px; font-weight: 650; font-variant-numeric: tabular-nums; }
.hhr-hero-foot { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,.1); font-size: 12.5px; color: rgba(255,255,255,.62); }
.hhr-hero-foot span:first-child { color: rgba(255,255,255,.88); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
.hhr-hero-goal { flex: 1 0 100%; margin: 4px 0 0; color: rgba(255,255,255,.62); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Tarjetas y tiles */
.hhr-card { background: var(--card); border-radius: 24px; box-shadow: var(--shadow); }
.hhr-icon-tile { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 18px; display: grid; place-items: center; color: var(--ink); }
.hhr-icon-sm { width: 40px; height: 40px; border-radius: 14px; }
.hhr-tone-lav { background: var(--lav); } .hhr-tone-peach { background: var(--peach); } .hhr-tone-sky { background: var(--sky); }
.hhr-tone-mint { background: var(--mint); } .hhr-tone-rose { background: var(--rose); }
.hhr-tone-violet { background: var(--violet-wash); color: var(--violet-ink); }
.hhr-tone-ok { background: var(--ok); color: #fff; }
.hhr-empty-card { padding: 30px 22px; text-align: center; display: grid; justify-items: center; gap: 6px; }
.hhr-empty-card b { margin-top: 6px; font-size: 16px; }
.hhr-empty-card p { margin: 0; color: var(--ink-2); max-width: 34ch; }
.hhr-pill { display: inline-flex; align-items: center; gap: 4px; background: var(--soft); color: var(--ink-2); border-radius: 999px; padding: 6px 12px; font-size: 13px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.hhr-pill.is-ok { background: var(--ok-wash); color: var(--ok); }

/* Feedback de la semana */
.hhr-fb-area { scroll-margin-top: 16px; }
.hhr-fb { display: grid; gap: 16px; padding: 18px; border-radius: 26px; background: var(--card); box-shadow: var(--shadow); position: relative; }
.hhr-fb::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(160deg, var(--violet-wash), rgba(240,236,252,0) 70%); pointer-events: none; }
.hhr-fb > * { position: relative; }
.hhr-fb-row { display: flex; align-items: center; gap: 14px; }
.hhr-fb-text { display: grid; gap: 2px; min-width: 0; }
.hhr-fb-text b { font-size: 17px; font-weight: 650; letter-spacing: -0.02em; }
.hhr-fb-text > span:last-child { color: var(--ink-2); font-size: 13.5px; }
.hhr-fb-badge { justify-self: start; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #93500F; background: #FDEEDC; border-radius: 999px; padding: 2px 10px 2px 8px; margin-bottom: 2px; }
.hhr-fb-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: hhr-pulse 1.6s ease-in-out infinite; }
@keyframes hhr-pulse { 50% { opacity: .3; } }
.hhr-fb-note { margin: 0; color: var(--ink-2); font-size: 14px; }
.hhr-fb-form { display: grid; gap: 12px; }
.hhr-steps { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 6px; }
.hhr-steps span { height: 6px; border-radius: 99px; background: var(--soft-2); transition: background .25s ease; }
.hhr-steps span.is-cur { background: #D9D0F7; }
.hhr-steps span.is-on { background: var(--violet); }
.hhr-fb-count { margin: -4px 0 0; font-size: 12.5px; color: var(--muted); font-weight: 500; font-variant-numeric: tabular-nums; }
.hhr-q { animation: hhr-in .25s ease; }
@keyframes hhr-in { from { opacity: 0; transform: translateY(6px); } }
.hhr-q > section { border: 0 !important; box-shadow: none !important; background: transparent !important; padding: 0 !important; }
.hhr-q > section > p:first-child { font-size: 17px; letter-spacing: -0.01em; }
.hhr-q [role="group"] button { border: 0 !important; background: var(--soft) !important; color: var(--ink-2) !important; border-radius: 16px; }
.hhr-q [role="group"] button[aria-pressed="true"] { background: var(--ink) !important; color: #fff !important; }
.hhr-q [role="radio"] { border: 0 !important; background-color: var(--soft); box-shadow: none !important; border-radius: 16px; }
.hhr-q textarea, .hhr-q input { border: 0 !important; background: var(--soft) !important; border-radius: 16px !important; box-shadow: none !important; }
.hhr-fb-email { display: grid; gap: 6px; font-size: 13px; color: var(--ink-2); }
.hhr-fb-email input { border: 0; border-radius: 16px; padding: 13px 16px; background: var(--soft); font-size: 16px; }
.hhr-fb-actions { display: flex; gap: 10px; }
.hhr-fb-actions .hhr-cta { flex: 1 1 auto; }
.hhr-cta { border: 0; border-radius: 999px; background: var(--ink); color: #fff; height: 52px; padding: 0 22px; font-size: 15.5px; font-weight: 600; width: 100%; transition: transform .12s ease, background .15s ease, opacity .15s ease; }
.hhr-cta:hover { background: #2C2833; }
.hhr-cta:active { transform: scale(.98); }
.hhr-cta:disabled { opacity: .35; cursor: default; transform: none; background: var(--ink); }
.hhr-ghost { flex: 0 0 auto; width: 52px; height: 52px; border: 0; border-radius: 50%; background: var(--soft); color: var(--ink); display: grid; place-items: center; }
.hhr-ghost:hover { background: var(--soft-2); }
.hhr-fb-done { grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 14px; }
.hhr-fb-done::before { background: linear-gradient(160deg, var(--ok-wash), rgba(227,244,234,0) 75%); }
.hhr-fb-done-text b { font-size: 16px; }
.hhr-fb-done-text p { margin: 2px 0 0; color: var(--ink-2); font-size: 13.5px; }

/* Entrenamiento */
.hhr-main-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; margin: 6px 2px 0; }
.hhr-main-head h2 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
.hhr-main-head span { color: var(--muted); font-size: 13px; }

.hhr-weeks { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; margin: 0 -18px; padding: 2px 18px 4px; }
.hhr-weeks::-webkit-scrollbar { display: none; }
.hhr-week { position: relative; flex: 0 0 auto; border: 0; background: var(--card); color: var(--ink-2); border-radius: 999px; height: 44px; padding: 0 20px; font-size: 14px; font-weight: 500; box-shadow: var(--shadow); transition: background .15s ease, color .15s ease; }
.hhr-week:hover { color: var(--ink); }
.hhr-week[aria-pressed="true"] { background: var(--ink); color: #fff; }
.hhr-now { position: absolute; top: 8px; right: 10px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }

.hhr-days { display: flex; justify-content: space-around; gap: 4px; padding: 10px; }
.hhr-day { flex: 0 1 84px; border: 0; background: transparent; border-radius: 18px; padding: 10px 2px 8px; display: grid; justify-items: center; gap: 2px; color: var(--violet); min-width: 0; transition: background .15s ease; }
.hhr-day:hover { background: var(--soft); }
.hhr-day[aria-pressed="true"] { background: var(--soft-2); }
.hhr-day-label { font-size: 12.5px; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-day-num { font-size: 21px; font-weight: 650; color: var(--ink); letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.2; }
.hhr-arc { margin-top: 4px; }
.hhr-arc.is-done { color: var(--ok); }

.hhr-daycard { padding: 18px 18px; display: grid; gap: 14px; }
.hhr-daycard-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.hhr-daycard-head h3 { margin: 0; font-size: 19px; font-weight: 650; letter-spacing: -0.02em; }
.hhr-daycard-head div > span { color: var(--muted); font-size: 13.5px; }
.hhr-warmup { border-radius: 18px; background: var(--soft); }
.hhr-warmup summary { list-style: none; display: flex; align-items: center; gap: 12px; padding: 10px 14px 10px 10px; cursor: pointer; }
.hhr-warmup summary::-webkit-details-marker { display: none; }
.hhr-warmup-title { flex: 1 1 auto; display: grid; min-width: 0; }
.hhr-warmup-title b { font-size: 14.5px; font-weight: 600; }
.hhr-warmup-title small { color: var(--muted); font-size: 12.5px; }
.hhr-warmup[open] .hhr-chev { transform: rotate(180deg); }
.hhr-warmup ul { margin: 0; padding: 0 18px 14px 34px; display: grid; gap: 4px; color: var(--ink-2); font-size: 14px; }
.hhr-chev { flex: 0 0 auto; color: var(--muted); transition: transform .2s ease; }

/* Ejercicios */
.hhr-list { display: grid; gap: 12px; align-items: start; }
.hhr-ex { overflow: hidden; }
.hhr-ex-head { width: 100%; border: 0; background: transparent; color: inherit; text-align: left; display: flex; align-items: center; gap: 14px; padding: 12px 16px 12px 12px; }
.hhr-thumb { position: relative; flex: 0 0 auto; width: 76px; height: 76px; border-radius: 20px; display: grid; place-items: center; font-size: 22px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; overflow: hidden; }
.hhr-thumb.has-img { background: var(--soft); }
.hhr-thumb img { width: 100%; height: 100%; object-fit: cover; }
.hhr-thumb-check { position: absolute; right: 6px; bottom: 6px; width: 22px; height: 22px; border-radius: 50%; background: var(--ok); color: #fff; display: grid; place-items: center; }
.hhr-ex-info { flex: 1 1 auto; min-width: 0; display: grid; gap: 3px; }
.hhr-ex-name { font-size: 16px; font-weight: 650; letter-spacing: -0.01em; overflow-wrap: anywhere; line-height: 1.25; }
.hhr-ex-sub { font-size: 13.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hhr-bar-track { display: block; height: 8px; border-radius: 99px; background: var(--soft-2); overflow: hidden; margin-top: 6px; max-width: 220px; }
.hhr-bar-fill { display: block; height: 100%; border-radius: inherit; background: var(--ink); transition: width .35s cubic-bezier(.2,.8,.2,1); }
.hhr-ex.is-done .hhr-bar-fill { background: var(--ok); }
.hhr-ex-count { font-size: 12px; color: var(--muted); font-weight: 500; font-variant-numeric: tabular-nums; }
.hhr-ex.is-done .hhr-ex-count { color: var(--ok); }
.hhr-ex.is-open .hhr-ex-head .hhr-chev { transform: rotate(180deg); }
.hhr-ex-panel { padding: 0 14px 14px; display: grid; gap: 12px; animation: hhr-in .2s ease; }
.hhr-ex-extra { display: grid; gap: 8px; padding: 0 4px; }
.hhr-chips { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.hhr-chips li { background: var(--soft); border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.hhr-notes { margin: 0; font-size: 14px; color: var(--ink-2); white-space: pre-line; }
.hhr-video { justify-self: start; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 999px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; }
.hhr-video:hover { background: #2C2833; }

/* Series */
.hhr-kg { display: grid; gap: 8px; }
.hhr-sets { margin: 0; padding: 6px; list-style: none; display: grid; gap: 4px; border-radius: 20px; background: var(--soft); }
.hhr-setrow { display: flex; align-items: center; gap: 12px; padding: 6px 8px 6px 6px; border-radius: 16px; transition: background .2s ease; }
.hhr-setrow.is-logged { background: var(--card); }
.hhr-setno { flex: 0 0 auto; width: 32px; height: 32px; border-radius: 11px; background: var(--card); display: grid; place-items: center; font-size: 13px; font-weight: 650; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.hhr-setrow.is-logged .hhr-setno { background: var(--soft); }
.hhr-settarget { flex: 1 1 auto; min-width: 0; display: grid; }
.hhr-settarget b { font-size: 14px; font-weight: 600; }
.hhr-settarget small { font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-kgfield { flex: 0 0 auto; position: relative; width: 96px; }
.hhr-kgfield input { width: 100%; height: 44px; border: 1.5px solid transparent; background: var(--card); border-radius: 14px; padding: 0 30px 0 12px; font-size: 17px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; text-align: right; transition: border-color .15s ease; }
.hhr-setrow.is-logged .hhr-kgfield input { background: var(--soft); }
.hhr-kgfield input::placeholder { color: var(--faint); font-weight: 500; }
.hhr-kgfield input:focus { outline: none; border-color: var(--violet); background: var(--card); }
.hhr-kgfield span { position: absolute; right: 11px; top: 50%; transform: translateY(-50%); font-size: 12.5px; color: var(--muted); pointer-events: none; }
.hhr-setcheck { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; border: 2px solid #DCDAD6; display: grid; place-items: center; color: #fff; transition: background .2s ease, border-color .2s ease, transform .2s ease; }
.hhr-setrow.is-logged .hhr-setcheck { background: var(--ok); border-color: var(--ok); animation: hhr-pop .3s ease; }
.hhr-setrow.is-saving .hhr-setcheck { border-color: var(--violet); border-right-color: transparent; animation: hhr-spin .7s linear infinite; }
.hhr-setrow.is-error .hhr-setcheck { border-color: var(--err); }
.hhr-setrow.is-error .hhr-kgfield input { border-color: var(--err); }
@keyframes hhr-pop { 50% { transform: scale(1.15); } }
@keyframes hhr-spin { to { transform: rotate(360deg); } }
.hhr-error { margin: 0; font-size: 13px; color: var(--err); }

.hhr-circuit { display: grid; gap: 8px; padding: 8px; border-radius: 30px; background: #E9E6F3; }
.hhr-circuit-label { margin: 6px 10px 2px; font-size: 13px; font-weight: 600; color: var(--violet-ink); display: flex; align-items: center; gap: 6px; }
.hhr-circuit-list { display: grid; gap: 8px; align-items: start; }

.hhr-foot { margin: 8px 4px 0; font-size: 12.5px; color: var(--muted); display: grid; gap: 6px; }
.hhr-brand { font-weight: 600; color: var(--faint); }

/* Barra flotante del celu */
.hhr-bar { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(14px, env(safe-area-inset-bottom)); z-index: 30; display: flex; align-items: center; gap: 4px; padding: 6px; border-radius: 999px; background: var(--ink); box-shadow: 0 16px 36px -14px rgba(23,21,28,.6); max-width: calc(100% - 28px); }
.hhr-bar-btn { width: 50px; height: 50px; border: 0; border-radius: 50%; background: transparent; color: rgba(255,255,255,.75); display: grid; place-items: center; text-decoration: none; }
.hhr-bar-btn:hover { color: #fff; background: rgba(255,255,255,.08); }
.hhr-bar-btn.is-static { color: #7BD3A0; }
.hhr-bar-fb { position: relative; height: 50px; border: 0; border-radius: 999px; background: #fff; color: var(--ink); display: inline-flex; align-items: center; gap: 8px; padding: 0 20px 0 18px; font-size: 14.5px; font-weight: 600; white-space: nowrap; }
.hhr-dot { position: absolute; top: 9px; left: 30px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 2px #fff; animation: hhr-pulse 1.6s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .hhr *, .hhr *::before { animation: none !important; transition: none !important; }
}
@media (max-width: 380px) {
  .hhr-thumb { width: 60px; height: 60px; border-radius: 17px; font-size: 19px; }
  .hhr-ex-head { gap: 12px; }
  .hhr-kgfield { width: 84px; }
  .hhr-settarget small { display: none; }
}
@media (min-width: 640px) {
  .hhr-inner { padding-top: 28px; }
  .hhr-weeks { margin-inline: 0; padding-inline: 0; }
  .hhr-round-btn { padding: 0 18px 0 14px; }
  .hhr-round-btn-text { display: inline; }
}
@media (min-width: 1024px) {
  .hhr-inner { padding: 36px 32px 48px; }
  .hhr-app { grid-template-columns: 360px minmax(0, 1fr); column-gap: 36px; align-items: start; }
  .hhr-app.has-bar { padding-bottom: 0; }
  .hhr-side { position: sticky; top: 24px; }
  .hhr-round-btn { padding: 0; width: 46px; }
  .hhr-round-btn-text { display: none; }
  .hhr-main-head { margin-top: 0; }
  .hhr-main-head h2 { font-size: 28px; }
  .hhr-main { max-width: 760px; }
  .hhr-bar { display: none; }
}
`
