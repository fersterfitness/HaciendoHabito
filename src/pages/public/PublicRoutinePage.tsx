import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  currentBlockIndex,
  exerciseDetails,
  fetchSharedRoutine,
  formatKg,
  groupExercises,
  logSharedSet,
  parseKg,
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
} from '@/lib/checkIn/questions'
import type { Json } from '@/types/database'

/**
 * Rutina que abre el alumno desde el link (sin cuenta). Dos cosas separadas:
 * - «Tu entrenamiento»: la rutina, donde anota los kilos de cada serie (el entrenador los ve en su rutina).
 * - «Tu semana»: el feedback semanal, que se responde acá mismo y queda a la vista hasta que se envía.
 * En el celu va todo en una columna; en la compu el feedback queda fijo a la derecha.
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

function dayProgress(day: SharedRoutineDay, logged: LoggedMap): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const ex of day.exercises) {
    const n = setCount(ex)
    total += n
    const m = logged[ex.id] ?? {}
    for (let s = 1; s <= n; s++) if (m[s] != null) done += 1
  }
  return { done, total }
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
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackVisible, setFeedbackVisible] = useState(true)
  const feedbackRef = useRef<HTMLElement | null>(null)

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

  // Recordatorio abajo en el celu mientras la tarjeta del feedback no está a la vista.
  useEffect(() => {
    const el = feedbackRef.current
    if (!el || !feedbackPending) return
    const io = new IntersectionObserver(([e]) => setFeedbackVisible(!!e?.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [feedbackPending, state.status])

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
        <p className="hhr-state">Cargando tu rutina…</p>
      </Shell>
    )
  }
  if (state.status === 'error' || !data) {
    return (
      <Shell>
        <div className="hhr-state">
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
  let number = 0

  function openFeedback() {
    setFeedbackOpen(true)
    requestAnimationFrame(() => feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <Shell>
      <header className="hhr-top">
        <span className="hhr-logo">
          <i>H</i>
          <span>Haciéndolo Hábito</span>
        </span>
        {waDigits ? (
          <a className="hhr-chip-btn" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
            {proFirst ? `Escribir a ${proFirst}` : 'Escribir por WhatsApp'}
          </a>
        ) : null}
      </header>

      <div className="hhr-layout">
        <section className="hhr-hero-area">
          <p className="hhr-today">{todayLabel}</p>
          <h1 className="hhr-title">{firstName ? `Hola, ${firstName}` : 'Tu rutina'}</h1>

          <div className="hhr-hero">
            <div className="hhr-hero-text">
              <span className="hhr-hero-kicker">{routine?.name || 'Tu rutina'}</span>
              <b>{blocks.length > 1 ? `Semana ${currentWeek + 1} de ${blocks.length}` : 'Tu semana'}</b>
              <span>
                {weekProgress.total
                  ? `${weekProgress.done} de ${weekProgress.total} series anotadas`
                  : 'Anotá los kilos de cada serie a medida que entrenás'}
                {until ? ` · hasta el ${until}` : ''}
              </span>
            </div>
            <Ring pct={pct} />
          </div>
          {routine?.objective ? <p className="hhr-goal">{routine.objective}</p> : null}
        </section>

        {data.feedback ? (
          <aside className="hhr-fb-area" ref={feedbackRef} aria-label="Feedback de la semana">
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
                <span className="hhr-fb-tag">Tu semana</span>
                <div className="hhr-fb-done-row">
                  <span className="hhr-check" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <b>Feedback enviado</b>
                    <p>¡Gracias! {proFirst ? `${proFirst} ya lo puede ver.` : 'Tu entrenador ya lo puede ver.'} El próximo se habilita la semana que viene.</p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        ) : null}

        <section className="hhr-train" aria-label="Tu entrenamiento">
          <div className="hhr-section-head">
            <h2>Tu entrenamiento</h2>
            <span>Anotá los kilos que usaste: {proLabel} los ve.</span>
          </div>

          {!routine || blocks.length === 0 ? (
            <div className="hhr-card hhr-empty-card">
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
                      {i === currentWeek ? <span className="hhr-now" aria-label="semana actual" /> : null}
                    </button>
                  ))}
                </nav>
              ) : null}

              {days.length > 1 ? (
                <nav className="hhr-days" aria-label="Días">
                  {days.map((d, i) => {
                    const p = dayProgress(d, logged)
                    const complete = p.total > 0 && p.done >= p.total
                    return (
                      <button key={d.id} type="button" className="hhr-day" aria-pressed={i === di} onClick={() => setDay(i)}>
                        <span className="hhr-day-name">{d.day_name || `Día ${i + 1}`}</span>
                        <span className={complete ? 'hhr-day-meta is-done' : 'hhr-day-meta'}>
                          {complete ? '✓ Hecho' : p.done ? `${p.done}/${p.total}` : `${d.exercises.length} ejercicios`}
                        </span>
                      </button>
                    )
                  })}
                </nav>
              ) : null}

              {selectedDay ? (
                <>
                  {selectedDay.muscle_focus || days.length <= 1 ? (
                    <div className="hhr-daytitle">
                      <h3>{selectedDay.day_name || 'Entrenamiento'}</h3>
                      {selectedDay.muscle_focus ? <span>{selectedDay.muscle_focus}</span> : null}
                    </div>
                  ) : null}

                  {warmup.length ? (
                    <details className="hhr-card hhr-warmup">
                      <summary>Entrada en calor</summary>
                      <ul>
                        {warmup.map((l, i) => (
                          <li key={i}>{l}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}

                  <div className="hhr-list">
                    {selectedDay.exercises.length === 0 ? <p className="hhr-muted">No hay ejercicios cargados para este día.</p> : null}
                    {groupExercises(selectedDay.exercises).map((g) =>
                      g.circuit ? (
                        <div key={g.items[0]!.id} className="hhr-circuit">
                          <p className="hhr-circuit-label">Circuito · hacé estos ejercicios seguidos</p>
                          {g.items.map((ex) => {
                            const n = ++number
                            return <ExerciseCard key={ex.id} ex={ex} n={n} token={token} logged={logged[ex.id] ?? {}} onSaved={onSaved} />
                          })}
                        </div>
                      ) : (
                        <ExerciseCard
                          key={g.items[0]!.id}
                          ex={g.items[0]!}
                          n={++number}
                          token={token}
                          logged={logged[g.items[0]!.id] ?? {}}
                          onSaved={onSaved}
                        />
                      ),
                    )}
                  </div>
                </>
              ) : (
                <p className="hhr-muted">Esta semana no tiene días cargados.</p>
              )}
            </>
          )}

          <p className="hhr-foot">
            {updated ? `Rutina actualizada el ${updated}. ` : ''}Si {proLabel} la cambia, este link muestra la versión nueva.
          </p>
        </section>
      </div>

      {feedbackPending && !feedbackVisible ? (
        <div className="hhr-nudge" role="region" aria-label="Recordatorio de feedback">
          <span>
            <b>Te falta el feedback</b> de esta semana
          </span>
          <button type="button" onClick={openFeedback}>
            Responder
          </button>
        </div>
      ) : null}
    </Shell>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 30
  const c = 2 * Math.PI * r
  return (
    <span className="hhr-ring" aria-label={`${pct}% de la semana anotada`}>
      <svg viewBox="0 0 72 72" width="72" height="72" aria-hidden>
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <b>{pct}%</b>
    </span>
  )
}

function ExerciseCard({
  ex,
  n,
  token,
  logged,
  onSaved,
}: {
  ex: SharedRoutineExercise
  n: number
  token: string
  logged: Record<number, number>
  onSaved: (exId: string, set: number, kg: number | null) => void
}) {
  const main = setsRepsText(ex)
  const { chips, seriesPlan, notes } = exerciseDetails(ex)
  const sets = setCount(ex)
  const done = Array.from({ length: sets }, (_, i) => logged[i + 1] != null).every(Boolean)
  const tone = TILE_TONES[(n - 1) % TILE_TONES.length]
  return (
    <article className={done ? 'hhr-card hhr-ex is-done' : 'hhr-card hhr-ex'}>
      <span className={`hhr-tile hhr-tone-${tone}`} aria-hidden>
        {done ? '✓' : n}
      </span>
      <div className="hhr-ex-body">
        <header>
          <h4>{ex.name || 'Ejercicio'}</h4>
          {main ? <strong>{main}</strong> : null}
        </header>
        {chips.length ? (
          <ul className="hhr-chips">
            {chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {seriesPlan ? <p className="hhr-plan">{seriesPlan}</p> : null}
        {notes ? <p className="hhr-notes">{notes}</p> : null}
        {ex.video_url ? (
          <a className="hhr-video" href={ex.video_url} target="_blank" rel="noopener noreferrer">
            ▶ Ver video
          </a>
        ) : null}
        <KgInputs ex={ex} sets={sets} token={token} logged={logged} onSaved={onSaved} />
      </div>
    </article>
  )
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Kilos por serie. Se guarda solo (al dejar de escribir o al salir del campo). */
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
    return ex.weight_kg != null && ex.weight_kg > 0 ? formatKg(ex.weight_kg) : 'kg'
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
      <span className="hhr-kg-label">Tus kilos</span>
      <div className="hhr-kg-row">
        {values.map((v, i) => (
          <label key={i} className={`hhr-set is-${status[i]}${v.trim() && status[i] === 'idle' ? ' is-filled' : ''}`}>
            <span>{sets > 1 ? `Serie ${i + 1}` : 'Kilos'}</span>
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
          </label>
        ))}
      </div>
      {anyError ? <p className="hhr-kg-error">No se pudo guardar. Revisá el número (por ejemplo 62,5) y probá de nuevo.</p> : null}
    </div>
  )
}

type FormPayload = { ok: boolean; title?: string; questions?: Json; error?: string }

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
  const answered = questions.filter((q) => {
    const d = drafts[q.id]
    if (!d) return false
    if (q.type === 'choice') return !!d.optionId
    return !!d.text.trim()
  }).length
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responderEmail.trim())
  const duration = questions.length <= 4 ? 'un minuto' : `unos ${Math.round(questions.length / 3)} minutos`

  async function submit(e: FormEvent) {
    e.preventDefault()
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
    if (!rpcError && res?.ok) {
      onSent()
      return
    }
    if (res?.error === 'already_submitted') {
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

  return (
    <div className="hhr-fb">
      <div className="hhr-fb-head">
        <span className="hhr-fb-tag">Tu semana</span>
        <span className="hhr-fb-badge">Pendiente</span>
      </div>
      <b className="hhr-fb-title">¿Cómo te fue esta semana?</b>
      <p className="hhr-fb-text">
        {questions.length ? `${questions.length} preguntas, ${duration}. ` : ''}Lo lee {proLabel} para ajustar tu rutina.
      </p>

      {!open ? (
        <button type="button" className="hhr-fb-cta" onClick={onOpen}>
          Responder ahora
        </button>
      ) : !payload ? (
        <p className="hhr-fb-text">Cargando preguntas…</p>
      ) : !payload.ok || questions.length === 0 ? (
        <p className="hhr-fb-text">El formulario no está disponible ahora. Avisale a {proLabel}.</p>
      ) : (
        <form className="hhr-fb-form" onSubmit={(e) => void submit(e)}>
          <div className="hhr-fb-progress" aria-hidden>
            <span style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
          <p className="hhr-fb-count">
            {answered} de {questions.length} respondidas
          </p>
          {!email ? (
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
          <div className="hhr-fb-questions">
            {questions.map((q, idx) => (
              <CheckInQuestionFields
                key={q.id}
                question={q}
                index={idx}
                draft={drafts[q.id] ?? emptyAnswerDraft()}
                onChange={(next) => setDrafts((prev) => ({ ...prev, [q.id]: next }))}
              />
            ))}
          </div>
          {error ? (
            <p className="hhr-kg-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="hhr-fb-cta" disabled={sending || answered < questions.length}>
            {sending ? 'Enviando…' : answered < questions.length ? `Faltan ${questions.length - answered}` : 'Enviar feedback'}
          </button>
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
  --canvas: #F3F2EF; --card: #FFFFFF; --soft: #F6F5F3; --line: #ECEAE6;
  --ink: #1E1B22; --ink-2: #4E4A53; --muted: #8C8890; --brand: #46334F; --brand-2: #2A2131;
  --brand-wash: #F2ECF5; --accent: #E0861A; --ok: #2F7A4D; --ok-wash: #E6F4EC; --err: #B4233A;
  --lav: #ECE7F6; --peach: #FCEBDD; --sky: #E3EEF9; --mint: #E3F3EA; --rose: #F9E5EA;
  min-height: 100vh; background: var(--canvas); color: var(--ink); color-scheme: light;
  font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased;
}
.hhr * { box-sizing: border-box; }
.hhr button, .hhr a, .hhr input { font: inherit; }
.hhr button:focus-visible, .hhr a:focus-visible, .hhr summary:focus-visible, .hhr input:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.hhr-inner { max-width: 1120px; margin: 0 auto; padding: 16px max(16px, env(safe-area-inset-right)) 96px max(16px, env(safe-area-inset-left)); display: grid; gap: 18px; }
.hhr-state { padding: 18vh 0; text-align: center; color: var(--ink-2); }
.hhr-state h1 { margin: 0 0 6px; font-size: 20px; color: var(--ink); letter-spacing: -0.02em; }
.hhr-state p { margin: 0 auto; max-width: 40ch; }
.hhr-muted { margin: 0; color: var(--muted); }

.hhr-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.hhr-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; min-width: 0; }
.hhr-logo i { width: 28px; height: 28px; border-radius: 9px; background: var(--brand); color: #fff; display: grid; place-items: center; font-style: normal; font-size: 12px; font-weight: 700; }
.hhr-chip-btn { background: var(--card); color: var(--ink); border-radius: 999px; padding: 8px 14px; font-size: 13px; font-weight: 500; text-decoration: none; white-space: nowrap; box-shadow: 0 1px 2px rgba(20,16,24,.06); }
.hhr-chip-btn:hover { background: var(--soft); }

.hhr-layout { display: grid; gap: 18px; grid-template-areas: "hero" "fb" "train"; grid-template-columns: minmax(0, 1fr); min-width: 0; }
.hhr-hero-area { grid-area: hero; min-width: 0; }
.hhr-fb-area { grid-area: fb; min-width: 0; scroll-margin-top: 16px; }
.hhr-train { grid-area: train; min-width: 0; display: grid; gap: 14px; align-content: start; }

.hhr-today { margin: 0; color: var(--muted); font-size: 13px; }
.hhr-today::first-letter { text-transform: uppercase; }
.hhr-title { margin: 2px 0 14px; font-size: clamp(26px, 7vw, 34px); line-height: 1.1; letter-spacing: -0.03em; font-weight: 700; }
.hhr-hero { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 20px 20px 22px; border-radius: 24px; color: #fff;
  background: radial-gradient(120% 140% at 100% 0%, #5B4466 0%, var(--brand) 45%, var(--brand-2) 100%); box-shadow: 0 10px 30px -12px rgba(42,33,49,.55); }
.hhr-hero-text { display: grid; gap: 2px; min-width: 0; }
.hhr-hero-kicker { font-size: 12.5px; opacity: .72; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-hero-text b { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; }
.hhr-hero-text > span:last-child { font-size: 13px; opacity: .82; }
.hhr-ring { position: relative; flex: 0 0 auto; width: 72px; height: 72px; display: grid; place-items: center; }
.hhr-ring svg { position: absolute; inset: 0; }
.hhr-ring circle { transition: stroke-dashoffset .5s ease; }
.hhr-ring b { font-size: 15px; font-variant-numeric: tabular-nums; }
.hhr-goal { margin: 12px 2px 0; color: var(--ink-2); font-size: 14px; }

/* Feedback: tarjeta propia, en lila, separada de la rutina. */
.hhr-fb { display: grid; gap: 8px; padding: 18px; border-radius: 24px; background: var(--brand-wash); border: 1px solid #E4DAEA; }
.hhr-fb-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.hhr-fb-tag { font-size: 12px; font-weight: 600; color: var(--brand); text-transform: uppercase; letter-spacing: .06em; }
.hhr-fb-badge { font-size: 12px; font-weight: 600; color: #8A4B0B; background: #FCE9CF; border-radius: 999px; padding: 2px 10px; display: inline-flex; align-items: center; gap: 6px; }
.hhr-fb-badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: hhr-pulse 1.6s ease-in-out infinite; }
@keyframes hhr-pulse { 50% { opacity: .3; } }
@media (prefers-reduced-motion: reduce) { .hhr-fb-badge::before { animation: none; } }
.hhr-fb-title { font-size: 19px; font-weight: 650; letter-spacing: -0.02em; }
.hhr-fb-text { margin: 0; color: var(--ink-2); font-size: 14px; }
.hhr-fb-cta { margin-top: 6px; border: 0; border-radius: 999px; background: var(--brand); color: #fff; padding: 13px 18px; font-size: 15px; font-weight: 600; cursor: pointer; width: 100%; }
.hhr-fb-cta:hover { background: var(--brand-2); }
.hhr-fb-cta:disabled { opacity: .55; cursor: default; background: var(--brand); }
.hhr-fb-form { display: grid; gap: 10px; margin-top: 6px; }
.hhr-fb-progress { height: 6px; border-radius: 99px; background: rgba(70,51,79,.12); overflow: hidden; }
.hhr-fb-progress span { display: block; height: 100%; background: var(--brand); border-radius: inherit; transition: width .3s ease; }
.hhr-fb-count { margin: -4px 0 0; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hhr-fb-questions { display: grid; gap: 10px; }
.hhr-fb-questions > section { background: var(--card); border-color: transparent; box-shadow: none; }
.hhr-fb-email { display: grid; gap: 6px; font-size: 13px; color: var(--ink-2); }
.hhr-fb-email input { border: 1px solid var(--line); border-radius: 14px; padding: 11px 14px; background: var(--card); font-size: 15px; }
.hhr-fb-done { background: var(--ok-wash); border-color: #D2EBDC; }
.hhr-fb-done .hhr-fb-tag { color: var(--ok); }
.hhr-fb-done-row { display: flex; gap: 12px; align-items: flex-start; }
.hhr-fb-done b { font-size: 16px; }
.hhr-fb-done p { margin: 2px 0 0; color: var(--ink-2); font-size: 14px; }
.hhr-check { flex: 0 0 auto; width: 30px; height: 30px; border-radius: 50%; background: var(--ok); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }

.hhr-section-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; margin-top: 4px; }
.hhr-section-head h2 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: -0.02em; }
.hhr-section-head span { color: var(--muted); font-size: 13px; }

.hhr-weeks { position: sticky; top: 0; z-index: 5; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: 0 -16px; padding: 8px 16px; background: var(--canvas); }
.hhr-weeks::-webkit-scrollbar { display: none; }
.hhr-week { position: relative; flex: 0 0 auto; border: 0; background: var(--card); color: var(--ink-2); border-radius: 999px; padding: 9px 16px; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 1px 2px rgba(20,16,24,.05); }
.hhr-week:hover { color: var(--ink); }
.hhr-week[aria-pressed="true"] { background: var(--ink); color: #fff; }
.hhr-now { position: absolute; top: 4px; right: 7px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.hhr-days { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
.hhr-day { border: 0; background: var(--card); color: var(--ink-2); border-radius: 18px; padding: 10px 8px; cursor: pointer; display: grid; gap: 1px; text-align: center; box-shadow: 0 1px 2px rgba(20,16,24,.05); min-width: 0; }
.hhr-day-name { font-size: 15px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-day-meta { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.hhr-day-meta.is-done { color: var(--ok); font-weight: 600; }
.hhr-day[aria-pressed="true"] { background: var(--ink); }
.hhr-day[aria-pressed="true"] .hhr-day-name { color: #fff; }
.hhr-day[aria-pressed="true"] .hhr-day-meta { color: rgba(255,255,255,.7); }
.hhr-daytitle { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.hhr-daytitle h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
.hhr-daytitle span { color: var(--muted); font-size: 14px; }

.hhr-card { background: var(--card); border-radius: 22px; box-shadow: 0 1px 2px rgba(20,16,24,.05); }
.hhr-empty-card { padding: 28px 20px; text-align: center; }
.hhr-empty-card p { margin: 4px 0 0; color: var(--ink-2); }
.hhr-warmup { padding: 14px 18px; }
.hhr-warmup summary { cursor: pointer; font-weight: 600; font-size: 14.5px; }
.hhr-warmup ul { margin: 8px 0 2px; padding-left: 18px; display: grid; gap: 3px; color: var(--ink-2); font-size: 14px; }

.hhr-list { display: grid; gap: 10px; }
.hhr-ex { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 14px; padding: 16px; }
.hhr-tile { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; font-size: 15px; font-weight: 650; color: var(--ink); font-variant-numeric: tabular-nums; }
.hhr-tone-lav { background: var(--lav); } .hhr-tone-peach { background: var(--peach); } .hhr-tone-sky { background: var(--sky); }
.hhr-tone-mint { background: var(--mint); } .hhr-tone-rose { background: var(--rose); }
.hhr-ex.is-done .hhr-tile { background: var(--ok); color: #fff; }
.hhr-ex-body { min-width: 0; display: grid; gap: 8px; }
.hhr-ex header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; }
.hhr-ex h4 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.hhr-ex strong { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; color: var(--ink); }
.hhr-chips { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.hhr-chips li { background: var(--soft); border-radius: 999px; padding: 3px 10px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.hhr-plan { margin: 0; font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hhr-notes { margin: 0; font-size: 14px; color: var(--ink-2); white-space: pre-line; }
.hhr-video { justify-self: start; font-size: 13.5px; font-weight: 500; color: var(--brand); text-decoration: none; }
.hhr-video:hover { text-decoration: underline; }

.hhr-kg { display: grid; gap: 6px; margin-top: 2px; padding-top: 10px; border-top: 1px dashed var(--line); }
.hhr-kg-label { font-size: 12px; font-weight: 600; color: var(--muted); }
.hhr-kg-row { display: flex; flex-wrap: wrap; gap: 8px; }
.hhr-set { position: relative; display: grid; gap: 2px; width: 76px; }
.hhr-set span { font-size: 11px; color: var(--muted); }
.hhr-set input { width: 100%; border: 1px solid transparent; background: var(--soft); border-radius: 12px; padding: 9px 10px; font-size: 16px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; text-align: center; }
.hhr-set input::placeholder { color: #B7B3BA; font-weight: 500; }
.hhr-set input:focus { outline: none; border-color: var(--brand); background: var(--card); }
.hhr-set.is-saved input, .hhr-set.is-filled input { background: var(--ok-wash); }
.hhr-set.is-saved::after { content: '✓'; position: absolute; right: 7px; bottom: 9px; font-size: 11px; color: var(--ok); font-weight: 700; }
.hhr-set.is-saving input { opacity: .7; }
.hhr-set.is-error input { border-color: var(--err); }
.hhr-kg-error { margin: 0; font-size: 12.5px; color: var(--err); }

.hhr-circuit { display: grid; gap: 8px; padding: 10px; border-radius: 26px; background: #EAE8E4; }
.hhr-circuit-label { margin: 2px 8px; font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
.hhr-foot { margin: 6px 0 0; font-size: 12px; color: var(--muted); }

.hhr-nudge { position: fixed; left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 10px 10px 18px; border-radius: 999px; background: var(--ink); color: #fff; font-size: 14px; box-shadow: 0 12px 30px -10px rgba(20,16,24,.55); max-width: 560px; margin: 0 auto; }
.hhr-nudge b { font-weight: 600; }
.hhr-nudge button { flex: 0 0 auto; border: 0; border-radius: 999px; background: #fff; color: var(--ink); padding: 9px 16px; font-weight: 600; font-size: 14px; cursor: pointer; }

@media (max-width: 420px) { .hhr-logo > span { display: none; } .hhr-ex { grid-template-columns: 36px minmax(0, 1fr); gap: 12px; padding: 14px; } .hhr-tile { width: 36px; height: 36px; border-radius: 12px; font-size: 14px; } }
@media (min-width: 640px) {
  .hhr-inner { padding-top: 24px; gap: 22px; }
  .hhr-weeks { margin-inline: 0; padding-inline: 0; }
  .hhr-ex { padding: 18px 20px; }
}
@media (min-width: 1024px) {
  .hhr-layout { grid-template-columns: minmax(0, 1fr) 380px; grid-template-areas: "hero fb" "train fb"; column-gap: 28px; align-items: start; }
  .hhr-fb-area { position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; border-radius: 24px; }
  .hhr-nudge { display: none; }
}
`
