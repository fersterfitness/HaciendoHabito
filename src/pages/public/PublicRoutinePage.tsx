import { type ReactNode, useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  currentBlockIndex,
  exerciseDetails,
  fetchSharedRoutine,
  groupExercises,
  setsRepsText,
  sharedRoutineFeedbackUrl,
  type SharedRoutine,
  type SharedRoutineExercise,
} from '@/lib/routine/sharedRoutine'
import { formatWarmupDisplayLines } from '@/lib/routine/warmupNotesFormat'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

/**
 * Rutina que abre el alumno desde el link (sin cuenta), con el feedback de la semana arriba.
 * Arranca en la semana de hoy; al volver a la pestaña se vuelve a pedir, así siempre está al día.
 */

function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function dateLabel(ymd: string | null | undefined, pattern = "d 'de' MMMM"): string | null {
  if (!ymd) return null
  const d = new Date(ymd.length === 10 ? ymd + 'T12:00:00' : ymd)
  return Number.isNaN(d.getTime()) ? null : format(d, pattern, { locale: es })
}

export function PublicRoutinePage() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ok'; data: SharedRoutine | null }>({
    status: 'loading',
  })
  const [week, setWeek] = useState<number | null>(null)
  const [day, setDay] = useState(0)

  const load = useCallback(
    (quiet: boolean) => {
      if (!quiet) setState({ status: 'loading' })
      return fetchSharedRoutine(token)
        .then((data) => setState({ status: 'ok', data }))
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

  useEffect(() => {
    document.title = firstName ? `Rutina de ${firstName}` : 'Tu rutina'
  }, [firstName])

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
  const until = dateLabel(routine?.end_date)
  const meta = [
    blocks.length > 1 ? `Semana ${currentWeek + 1} de ${blocks.length}` : null,
    until ? `Hasta el ${until}` : null,
    data.professional_name ? `Entrenador: ${data.professional_name}` : null,
  ].filter(Boolean) as string[]
  const updated = dateLabel(routine?.updated_at)
  const warmup = selectedDay?.warmup_notes ? formatWarmupDisplayLines(selectedDay.warmup_notes) : []
  let number = 0

  return (
    <Shell>
      <div className="hhr-brand">
        <span className="hhr-logo">
          <i>H</i>
          <span>Haciéndolo Hábito</span>
        </span>
        {waDigits ? (
          <a className="hhr-btn" href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">
            {proFirst ? `Escribir a ${proFirst}` : 'WhatsApp'}
          </a>
        ) : null}
      </div>

      <section className="hhr-hero">
        {routine?.name ? <div className="hhr-eyebrow">{routine.name}</div> : null}
        <h1>{firstName ? `Rutina de ${firstName}` : 'Tu rutina'}</h1>
        {routine?.objective ? <p className="hhr-goal">{routine.objective}</p> : null}
        {meta.length ? (
          <ul className="hhr-meta">
            {meta.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {data.feedback ? (
        data.feedback.done ? (
          <div className="hhr-fb hhr-fb-done" role="status">
            <span className="hhr-check" aria-hidden>
              ✓
            </span>
            <div>
              <b>Ya completaste el feedback de esta semana.</b>
              <p>¡Gracias! El próximo se habilita la semana que viene.</p>
            </div>
          </div>
        ) : (
          <div className="hhr-fb">
            <div>
              <b>¿Cómo te fue esta semana?</b>
              <p>Son un par de minutos y {proFirst ? `le sirve a ${proFirst}` : 'le sirve a tu entrenador'} para ajustar tu rutina.</p>
            </div>
            <a className="hhr-btn hhr-btn-primary" href={sharedRoutineFeedbackUrl(data.feedback)}>
              Completar feedback
            </a>
          </div>
        )
      ) : null}

      {!routine || blocks.length === 0 ? (
        <div className="hhr-state hhr-state-inline">
          <h2>Tu rutina todavía no está cargada</h2>
          <p>Cuando tu entrenador la arme, la vas a ver en este mismo link.</p>
        </div>
      ) : (
        <section className="hhr-section">
          {blocks.length > 1 ? (
            <nav className="hhr-tabs" aria-label="Semanas">
              {blocks.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className="hhr-tab"
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
              {days.map((d, i) => (
                <button key={d.id} type="button" className="hhr-day" aria-pressed={i === di} onClick={() => setDay(i)}>
                  {d.day_name || `Día ${i + 1}`}
                </button>
              ))}
            </nav>
          ) : null}

          {selectedDay ? (
            <>
              <div className="hhr-daytitle">
                <h2>{selectedDay.day_name || 'Entrenamiento'}</h2>
                {selectedDay.muscle_focus ? <span>{selectedDay.muscle_focus}</span> : null}
              </div>

              {warmup.length ? (
                <details className="hhr-warmup">
                  <summary>Entrada en calor</summary>
                  <ul>
                    {warmup.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="hhr-list">
                {selectedDay.exercises.length === 0 ? <p className="hhr-empty">No hay ejercicios cargados para este día.</p> : null}
                {groupExercises(selectedDay.exercises).map((g) =>
                  g.circuit ? (
                    <div key={g.items[0]!.id} className="hhr-circuit">
                      <p className="hhr-circuit-label">Circuito · hacé estos ejercicios seguidos</p>
                      {g.items.map((ex) => (
                        <ExerciseCard key={ex.id} ex={ex} n={++number} />
                      ))}
                    </div>
                  ) : (
                    <ExerciseCard key={g.items[0]!.id} ex={g.items[0]!} n={++number} />
                  ),
                )}
              </div>
            </>
          ) : (
            <p className="hhr-empty">Esta semana no tiene días cargados.</p>
          )}
        </section>
      )}

      <p className="hhr-foot">
        {updated ? `Rutina actualizada el ${updated}. ` : ''}Si tu entrenador la cambia, este link muestra la versión nueva.
      </p>
    </Shell>
  )
}

function ExerciseCard({ ex, n }: { ex: SharedRoutineExercise; n: number }) {
  const main = setsRepsText(ex)
  const { chips, seriesPlan, notes } = exerciseDetails(ex)
  return (
    <article className="hhr-ex">
      <span className="hhr-n" aria-hidden>
        {n}
      </span>
      <div className="hhr-ex-body">
        <header>
          <h3>{ex.name || 'Ejercicio'}</h3>
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
      </div>
    </article>
  )
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
  --canvas: #FFFFFF; --panel: #F7F7F5; --elevated: #F1F1EF; --border: #E9E9E7;
  --ink: #37352F; --ink-2: #4F4D48; --muted: #8A8883; --brand: #46334F; --brand-wash: #F4F0F6; --accent: #E0861A;
  --green-ink: #2F7A4D; --green-wash: #EAF6EE;
  min-height: 100vh; background: var(--canvas); color: var(--ink); color-scheme: light;
  font-family: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased;
}
.hhr * { box-sizing: border-box; }
.hhr button, .hhr a { font: inherit; }
.hhr button:focus-visible, .hhr a:focus-visible, .hhr summary:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.hhr-inner { max-width: 760px; margin: 0 auto; padding: 20px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left)); display: grid; gap: 20px; container-type: inline-size; }
.hhr-state { padding: 18vh 0; text-align: center; color: var(--ink-2); }
.hhr-state h1, .hhr-state h2 { margin: 0 0 6px; font-size: 20px; color: var(--ink); letter-spacing: -0.02em; }
.hhr-state p { margin: 0 auto; max-width: 40ch; }
.hhr-state-inline { padding: 40px 0; border-top: 1px solid var(--border); }

.hhr-brand { display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 12.5px; }
.hhr-logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; min-width: 0; }
.hhr-logo i { width: 22px; height: 22px; border-radius: 6px; background: var(--brand); color: #fff; display: grid; place-items: center; font-style: normal; font-size: 11px; font-weight: 700; }
.hhr-btn { border: 1px solid var(--border); background: #fff; color: var(--ink); border-radius: 999px; padding: 6px 14px; font-size: 13px; font-weight: 500; text-decoration: none; white-space: nowrap; cursor: pointer; }
.hhr-btn:hover { background: var(--panel); }
.hhr-btn-primary { background: var(--brand); border-color: var(--brand); color: #fff; padding: 9px 18px; font-size: 14px; }
.hhr-btn-primary:hover { background: var(--brand); opacity: .92; }

.hhr-hero h1 { margin: 0; font-size: clamp(24px, 7vw, 32px); line-height: 1.12; letter-spacing: -0.03em; font-weight: 700; text-wrap: balance; }
.hhr-eyebrow { font-size: 12.5px; color: var(--muted); margin-bottom: 4px; }
.hhr-goal { margin: 6px 0 0; color: var(--ink-2); }
.hhr-meta { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12.5px; color: var(--ink-2); }
.hhr-meta li { background: var(--elevated); border-radius: 6px; padding: 2px 8px; }

.hhr-fb { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 16px; padding: 16px; border-radius: 14px; background: var(--brand-wash); border: 1px solid #E6DDEB; }
.hhr-fb b { display: block; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
.hhr-fb p { margin: 2px 0 0; color: var(--ink-2); font-size: 14px; }
.hhr-fb-done { justify-content: flex-start; background: var(--green-wash); border-color: #D3ECDB; }
.hhr-check { flex: 0 0 auto; width: 28px; height: 28px; border-radius: 50%; background: var(--green-ink); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }

.hhr-section { display: grid; gap: 14px; border-top: 1px solid var(--border); padding-top: 16px; min-width: 0; }
.hhr-tabs { position: sticky; top: 0; z-index: 5; background: var(--canvas); display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: -8px -16px 0; padding: 8px 16px; }
.hhr-tabs::-webkit-scrollbar { display: none; }
.hhr-tab { position: relative; flex: 0 0 auto; border: 1px solid var(--border); background: #fff; color: var(--ink-2); border-radius: 999px; padding: 6px 14px; font-size: 13.5px; font-weight: 500; cursor: pointer; }
.hhr-tab:hover { background: var(--panel); }
.hhr-tab[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: #fff; }
.hhr-now { position: absolute; top: 3px; right: 5px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); }
.hhr-days { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 4px; padding: 4px; border-radius: 12px; background: var(--elevated); }
.hhr-day { border: 0; background: transparent; color: var(--ink-2); border-radius: 9px; padding: 8px 6px; font-size: 14px; font-weight: 500; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hhr-day[aria-pressed="true"] { background: #fff; color: var(--ink); box-shadow: 0 1px 2px rgba(15,15,15,.08); }
.hhr-daytitle { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 10px; }
.hhr-daytitle h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
.hhr-daytitle span { color: var(--muted); font-size: 14px; }

.hhr-warmup { border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; background: var(--panel); }
.hhr-warmup summary { cursor: pointer; font-weight: 600; font-size: 14px; }
.hhr-warmup ul { margin: 8px 0 2px; padding-left: 18px; display: grid; gap: 3px; color: var(--ink-2); font-size: 14px; }

.hhr-list { display: grid; gap: 10px; }
.hhr-ex { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; padding: 14px; border: 1px solid var(--border); border-radius: 14px; background: #fff; box-shadow: 0 1px 2px rgba(15,15,15,.04); }
.hhr-n { width: 28px; height: 28px; border-radius: 50%; background: var(--elevated); color: var(--ink-2); display: grid; place-items: center; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.hhr-ex-body { min-width: 0; display: grid; gap: 8px; }
.hhr-ex header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 2px 12px; }
.hhr-ex h3 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; overflow-wrap: anywhere; }
.hhr-ex strong { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; color: var(--brand); }
.hhr-chips { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.hhr-chips li { background: var(--elevated); border-radius: 6px; padding: 2px 8px; font-size: 13px; font-weight: 500; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.hhr-chips li:first-child { background: var(--brand-wash); color: var(--brand); }
.hhr-plan { margin: 0; font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.hhr-notes { margin: 0; font-size: 14px; color: var(--ink-2); white-space: pre-line; }
.hhr-video { justify-self: start; font-size: 13.5px; font-weight: 500; color: var(--brand); text-decoration: none; }
.hhr-video:hover { text-decoration: underline; }
.hhr-circuit { display: grid; gap: 8px; padding: 10px; border-radius: 16px; background: var(--panel); border: 1px dashed #D9D6D0; }
.hhr-circuit-label { margin: 0 4px; font-size: 12.5px; font-weight: 600; color: var(--muted); }
.hhr-empty { margin: 0; color: var(--muted); }
.hhr-foot { margin: 0; font-size: 12px; color: var(--muted); border-top: 1px solid var(--border); padding-top: 16px; }

@container (max-width: 400px) { .hhr-logo > span { display: none; } }
@container (min-width: 600px) {
  .hhr-inner { gap: 24px; }
  .hhr-tabs { margin-inline: 0; padding-inline: 0; }
  .hhr-ex { padding: 16px 18px; gap: 14px; }
}
`
