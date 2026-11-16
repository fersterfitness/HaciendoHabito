import { lazy, Suspense, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Check, MessageSquareText, Moon, X } from 'lucide-react'
import type { BodySex } from '@/components/nutrition/body2d/zones'
import {
  CYCLE_ANSWERS,
  DAILY_SCALES,
  EMPTY_DRAFT,
  NUTRITION_ISSUES,
  NUTRITION_LABELS,
  PAIN_KINDS,
  SLEEP_HOURS,
  STEPS,
  dailySummary,
  draftToLog,
  missingAnswers,
  needsNutritionIssue,
  saveSharedDailyCheckin,
  type DailyCheckinDraft,
  type ScaleKey,
} from '@/lib/routine/dailyCheckin'
import { saveSharedCyclePill, saveSharedCycleStart } from '@/lib/routine/studentAppExtras'
import {
  BORG_LABELS,
  hasCheckin,
  saveSharedDayStatus,
  saveSharedExerciseFeedback,
  sendSharedUrgentMessage,
  type DayLog,
  type ExerciseFeedback,
} from '@/lib/routine/studentTrainingLog'

/**
 * Piezas de la página del alumno (/rutina/:token) para lo que deja además de kilos y repeticiones:
 * nota y esfuerzo por ejercicio, chequeo de antes de entrenar, cierre del día y consulta urgente.
 */

// El cuerpo para marcar el dolor se baja solo si el alumno elige «dolor no habitual».
const PainBodyPicker = lazy(() => import('@/components/routines/volumeBody/VolumeBodyMap').then((m) => ({ default: m.PainBodyPicker })))

const errText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo guardar. Intentá de nuevo.')

function ymdLabel(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : format(d, "d 'de' MMMM", { locale: es })
}

/** Botones 1…max, uno elegido. Tocar el elegido lo saca. */
/**
 * Botones del 1 al `max`. Con `good` (de 1 a 5) cada número lleva su color, de rojo (mal) a verde (bien):
 * «high» si 5 es lo mejor (sueño, energía) y «low» si 1 es lo mejor (estrés, molestias).
 */
function Scale({ max, value, onChange, label, good }: { max: number; value: number | null; onChange: (v: number | null) => void; label: string; good?: 'high' | 'low' }) {
  return (
    <div className={max > 5 ? 'hhr-scale is-wide' : good ? 'hhr-scale is-toned' : 'hhr-scale'} role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" className={good ? `q${good === 'high' ? n : max + 1 - n}` : undefined} aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

/** Escala de Borg (1 a 10) con el significado del número elegido. */
function BorgScale({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="hhr-borg">
      <Scale max={10} value={value} onChange={onChange} label="Esfuerzo del 1 al 10" />
      <span className="hhr-borg-hint">{value ? `${value} · ${BORG_LABELS[value]}` : '1 es muy suave, 10 es el máximo'}</span>
    </div>
  )
}

/** Dentro de cada ejercicio: nota para el entrenador y qué tan exigente fue. */
export function ExerciseFeedbackBox({
  token,
  exerciseId,
  value,
  proLabel,
  onSaved,
}: {
  token: string
  exerciseId: string
  value: ExerciseFeedback | undefined
  proLabel: string
  onSaved: (exerciseId: string, fb: ExerciseFeedback) => void
}) {
  const [note, setNote] = useState(value?.note ?? '')
  const [effort, setEffort] = useState<number | null>(value?.effort ?? null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState('')
  const dirty = note.trim() !== (value?.note ?? '') || effort !== (value?.effort ?? null)

  async function save(nextEffort = effort) {
    const fb = { note: note.trim(), effort: nextEffort }
    setState('saving')
    try {
      await saveSharedExerciseFeedback(token, exerciseId, fb)
      onSaved(exerciseId, fb)
      setState('saved')
    } catch (e) {
      setError(errText(e))
      setState('error')
    }
  }

  return (
    <div className="hhr-exfb">
      <span className="hhr-exfb-title">
        <MessageSquareText size={14} strokeWidth={2} aria-hidden /> Para {proLabel}
      </span>
      <label className="hhr-field">
        <span>¿Alguna duda, molestia o aclaración de este ejercicio?</span>
        <textarea
          rows={2}
          maxLength={600}
          value={note}
          placeholder="Por ejemplo: me molestó el hombro en la última serie"
          onChange={(e) => {
            setNote(e.target.value)
            setState('idle')
          }}
          onBlur={() => {
            if (dirty) void save()
          }}
        />
      </label>
      <div className="hhr-field">
        <span>¿Qué tan exigente te resultó?</span>
        <BorgScale
          value={effort}
          onChange={(v) => {
            setEffort(v)
            void save(v)
          }}
        />
      </div>
      <p className={state === 'error' ? 'hhr-save is-error' : 'hhr-save'} role="status">
        {state === 'saving' ? 'Guardando…' : state === 'saved' ? `Guardado. ${proLabel.charAt(0).toUpperCase() + proLabel.slice(1)} lo va a ver.` : state === 'error' ? error : ''}
      </p>
    </div>
  )
}

/** Antes de empezar el día: cómo llega el alumno. */
/** Opciones en pastillas, una elegida. */
function Chips<T extends string>({ options, value, onChange, label }: { options: readonly { id: T; label: string }[]; value: T | null; onChange: (v: T) => void; label: string }) {
  return (
    <div className="hhr-opts" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ScaleField({ s, value, onChange, hint }: { s: (typeof DAILY_SCALES)[number]; value: number | null | undefined; onChange: (v: number | null) => void; hint?: string }) {
  return (
    <div className="hhr-field">
      <span>{s.label}</span>
      <Scale max={5} value={value ?? null} label={s.label} good={s.good} onChange={onChange} />
      {hint ? (
        <span className="hhr-scale-hint">{hint}</span>
      ) : (
        <span className="hhr-scale-ends">
          <i>1 · {s.low}</i>
          <i>5 · {s.high}</i>
        </span>
      )}
    </div>
  )
}

/**
 * Chequeo diario obligatorio: primero el aviso «Atención · lectura obligatoria» y, al tocar «Entendí»,
 * las preguntas. Hasta enviarlo, la rutina del día queda bloqueada. El último día de la semana suma
 * pasos y (solo mujeres) ciclo menstrual.
 */
export function DayCheckinCard({
  token,
  dayId,
  proLabel,
  weekClose,
  woman,
  sex,
  onSaved,
  onCycle,
}: {
  token: string
  dayId: string
  proLabel: string
  weekClose: boolean
  woman: boolean
  sex: BodySex
  onSaved: (dayId: string, patch: Partial<DayLog>) => void
  /** Ciclo registrado desde el chequeo: para actualizar la tarjeta «Tu ciclo». */
  onCycle?: (patch: { date?: string; onPill?: boolean }) => void
}) {
  const [stage, setStage] = useState<'notice' | 'questions'>('notice')
  const [d, setD] = useState<DailyCheckinDraft>(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const opts = { weekClose, woman }
  const missing = missingAnswers(d, opts)
  const set = (patch: Partial<DailyCheckinDraft>) => setD((cur) => ({ ...cur, ...patch }))
  const setScale = (key: ScaleKey, v: number | null) => setD((cur) => ({ ...cur, scales: { ...cur.scales, [key]: v } }))
  const scale = (key: ScaleKey) => DAILY_SCALES.find((s) => s.key === key)!
  const today = format(new Date(), 'yyyy-MM-dd')

  async function submit() {
    setTried(true)
    if (missing.length) return
    setBusy(true)
    setError('')
    const patch = draftToLog(d, opts)
    try {
      if (weekClose && woman && d.cycle === 'not_logged' && d.cycleDate) {
        await saveSharedCycleStart(token, d.cycleDate)
        onCycle?.({ date: d.cycleDate })
      }
      if (weekClose && woman && d.cycle === 'pill') {
        await saveSharedCyclePill(token, true)
        onCycle?.({ onPill: true })
      }
      await saveSharedDailyCheckin(token, dayId, patch)
      onSaved(dayId, { ...patch, checkin_at: new Date().toISOString() })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'notice') {
    return (
      <section className="hhr-card hhr-must" role="alert" aria-label="Atención, lectura obligatoria">
        <p className="hhr-must-title">
          <AlertTriangle size={20} strokeWidth={2.2} aria-hidden /> ATENCIÓN · LECTURA OBLIGATORIA
        </p>
        <p>
          Para poder <b>DESBLOQUEAR</b> tu rutina de hoy, es <b>OBLIGATORIO</b> completar este chequeo diario.
        </p>
        <p>Te toma 30 segundos y le sirve a {proLabel} para cuidarte, adaptar tu entrenamiento y ver tu progreso semana a semana.</p>
        <p>
          Sin este registro, <b>NO</b> tendrás acceso a tu rutina.
        </p>
        <p className="hhr-must-sub">Respondé con sinceridad, por favor.</p>
        <button type="button" className="hhr-cta hhr-cta-must" onClick={() => setStage('questions')}>
          Entendí, completar mi chequeo
        </button>
      </section>
    )
  }

  return (
    <section className="hhr-card hhr-checkin" aria-label="Chequeo diario">
      <div className="hhr-log-head">
        <span className="hhr-log-icon" aria-hidden>
          <Moon size={18} strokeWidth={1.9} />
        </span>
        <div>
          <b>Chequeo diario</b>
          <span>{weekClose ? 'Último día de la semana: hay preguntas extra.' : 'Respondé todo para desbloquear tu rutina de hoy.'}</span>
        </div>
      </div>

      <ScaleField s={scale('energy')} value={d.scales.energy} onChange={(v) => setScale('energy', v)} />

      <ScaleField s={scale('sleep')} value={d.scales.sleep} onChange={(v) => setScale('sleep', v)} />
      <div className="hhr-field hhr-subfield">
        <span>¿Cuántas horas?</span>
        <Chips options={SLEEP_HOURS} value={d.sleepHours} label="Horas de sueño" onChange={(v) => set({ sleepHours: v })} />
      </div>

      <ScaleField s={scale('stress')} value={d.scales.stress} onChange={(v) => setScale('stress', v)} />

      <ScaleField s={scale('soreness')} value={d.scales.soreness} onChange={(v) => setScale('soreness', v)} />
      <div className="hhr-field hhr-subfield">
        <span>¿De qué tipo?</span>
        <Chips options={PAIN_KINDS} value={d.painKind} label="Tipo de dolor" onChange={(v) => set({ painKind: v })} />
      </div>
      {d.painKind === 'unusual' ? (
        <div className="hhr-field hhr-subfield">
          <span>Marcá dónde te duele (tocá el músculo)</span>
          <Suspense fallback={<span className="hhr-save">Cargando el cuerpo…</span>}>
            <PainBodyPicker
              sex={sex}
              selected={d.painAreas}
              onToggle={(m) => set({ painAreas: d.painAreas.includes(m) ? d.painAreas.filter((x) => x !== m) : [...d.painAreas, m] })}
            />
          </Suspense>
          <textarea
            rows={2}
            maxLength={600}
            value={d.painNote}
            placeholder="Contá cómo es el dolor (por ejemplo: me tira al subir escaleras)"
            aria-label="Aclaración del dolor"
            onChange={(e) => set({ painNote: e.target.value })}
          />
          <span className="hhr-scale-hint">A {proLabel} le llega un aviso para revisarlo.</span>
        </div>
      ) : null}

      {weekClose ? (
        <div className="hhr-field hhr-weekq">
          <span>¿Cuántos pasos diarios promediaste esta semana, aproximadamente?</span>
          <Chips options={STEPS} value={d.steps} label="Pasos diarios" onChange={(v) => set({ steps: v })} />
        </div>
      ) : null}

      <ScaleField s={scale('hydration')} value={d.scales.hydration} onChange={(v) => setScale('hydration', v)} />
      <ScaleField s={scale('motivation')} value={d.scales.motivation} onChange={(v) => setScale('motivation', v)} />
      <ScaleField s={scale('recovery')} value={d.scales.recovery} onChange={(v) => setScale('recovery', v)} />
      <ScaleField
        s={scale('nutrition')}
        value={d.scales.nutrition}
        onChange={(v) => setScale('nutrition', v)}
        hint={d.scales.nutrition ? `${d.scales.nutrition} · ${NUTRITION_LABELS[d.scales.nutrition]}` : '1 · Muy desordenada … 5 · Excelente, 100% el plan'}
      />
      {needsNutritionIssue(d) ? (
        <div className="hhr-field hhr-subfield">
          <span>¿Qué fue lo que más te complicó? (elegí una)</span>
          <Chips options={NUTRITION_ISSUES} value={d.nutritionIssue} label="Qué complicó la alimentación" onChange={(v) => set({ nutritionIssue: v })} />
          {d.nutritionIssue === 'other' ? (
            <input
              type="text"
              maxLength={300}
              value={d.nutritionIssueNote}
              placeholder="Contanos qué pasó"
              aria-label="Qué complicó la alimentación"
              onChange={(e) => set({ nutritionIssueNote: e.target.value })}
            />
          ) : null}
        </div>
      ) : null}

      {weekClose && woman ? (
        <div className="hhr-field hhr-weekq">
          <span>¿Registraste tu ciclo menstrual?</span>
          <Chips options={CYCLE_ANSWERS} value={d.cycle} label="Ciclo menstrual" onChange={(v) => set({ cycle: v })} />
          {d.cycle === 'not_logged' ? (
            <label className="hhr-inline-date">
              Primer día de tu última menstruación
              <input type="date" max={today} value={d.cycleDate} onChange={(e) => set({ cycleDate: e.target.value })} />
            </label>
          ) : null}
        </div>
      ) : null}

      <label className="hhr-field">
        <span>¿Algo más que quieras contar? (opcional)</span>
        <textarea rows={2} maxLength={600} value={d.note} placeholder="Por ejemplo: dormí poco por el trabajo" onChange={(e) => set({ note: e.target.value })} />
      </label>
      {error ? <p className="hhr-save is-error">{error}</p> : null}
      {tried && missing.length ? <p className="hhr-save is-error">Te falta responder: {missing.join(', ')}.</p> : null}
      <div className="hhr-log-actions">
        <button type="button" className="hhr-cta" disabled={busy} onClick={() => void submit()}>
          {busy ? 'Guardando…' : 'Desbloquear mi rutina'}
        </button>
      </div>
    </section>
  )
}

/** Renglón con lo que respondió en el chequeo, una vez hecho. */
export function DayCheckinSummary({ log }: { log: DayLog }) {
  if (!hasCheckin(log)) return null
  return (
    <p className="hhr-checkin-line">
      <Check size={13} strokeWidth={2.6} aria-hidden /> Cómo llegaste hoy: {dailySummary(log)}
    </p>
  )
}

/** Al final del día: «Terminé» (con esfuerzo de la sesión) o «No pude entrenar» (con el motivo). */
export function DayCloseCard({
  token,
  dayId,
  log,
  today,
  allSetsDone,
  onSaved,
}: {
  token: string
  dayId: string
  log: DayLog
  /** Fecha del celular del alumno (yyyy-MM-dd). */
  today: string
  allSetsDone: boolean
  onSaved: (dayId: string, patch: Partial<DayLog>) => void
}) {
  const [mode, setMode] = useState<'idle' | 'done' | 'missed'>('idle')
  const [effort, setEffort] = useState<number | null>(log.effort)
  const [reason, setReason] = useState(log.missed_reason)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(status: 'done' | 'missed' | null) {
    setBusy(true)
    setError('')
    try {
      await saveSharedDayStatus(token, dayId, { status, reason: reason.trim(), effort, date: today })
      onSaved(dayId, {
        status,
        status_date: status ? today : null,
        missed_reason: status === 'missed' ? reason.trim() : '',
        effort: status === 'done' ? effort : null,
      })
      setMode('idle')
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  if (log.status && mode === 'idle') {
    const done = log.status === 'done'
    return (
      <section className={done ? 'hhr-card hhr-close is-done' : 'hhr-card hhr-close is-missed'} role="status">
        <span className="hhr-log-icon" aria-hidden>
          {done ? <Check size={18} strokeWidth={2.6} /> : <X size={18} strokeWidth={2.4} />}
        </span>
        <div className="hhr-close-text">
          <b>
            {done ? 'Entrenamiento terminado' : 'Día no entrenado'}
            {log.status_date ? ` · ${ymdLabel(log.status_date)}` : ''}
          </b>
          <span>
            {done
              ? log.effort
                ? `Esfuerzo ${log.effort}/10 · ${BORG_LABELS[log.effort]}`
                : 'Sin esfuerzo anotado'
              : log.missed_reason || 'Sin motivo anotado'}
          </span>
        </div>
        <button type="button" className="hhr-link" disabled={busy} onClick={() => void save(null)}>
          Deshacer
        </button>
      </section>
    )
  }

  if (mode === 'done') {
    return (
      <section className="hhr-card hhr-close-form" aria-label="Terminar el entrenamiento">
        <b>¿Qué tan exigente fue el entrenamiento de hoy?</b>
        <BorgScale value={effort} onChange={setEffort} />
        {!allSetsDone ? <p className="hhr-save">Te quedaron series sin marcar. Podés terminar igual.</p> : null}
        {error ? <p className="hhr-save is-error">{error}</p> : null}
        <div className="hhr-log-actions">
          <button type="button" className="hhr-cta" disabled={busy || effort == null} onClick={() => void save('done')}>
            {busy ? 'Guardando…' : 'Guardar y terminar'}
          </button>
          <button type="button" className="hhr-link" onClick={() => setMode('idle')}>
            Cancelar
          </button>
        </div>
      </section>
    )
  }

  if (mode === 'missed') {
    return (
      <section className="hhr-card hhr-close-form" aria-label="No pude entrenar">
        <label className="hhr-field">
          <b>¿Qué pasó? (opcional)</b>
          <textarea rows={2} maxLength={400} value={reason} placeholder="Por ejemplo: viaje de trabajo, estuve enfermo" onChange={(e) => setReason(e.target.value)} />
        </label>
        {error ? <p className="hhr-save is-error">{error}</p> : null}
        <div className="hhr-log-actions">
          <button type="button" className="hhr-cta" disabled={busy} onClick={() => void save('missed')}>
            {busy ? 'Guardando…' : 'Marcar como no entrenado'}
          </button>
          <button type="button" className="hhr-link" onClick={() => setMode('idle')}>
            Cancelar
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="hhr-close-actions" aria-label="Cerrar el día">
      <button type="button" className="hhr-cta hhr-cta-ok" onClick={() => setMode('done')}>
        <Check size={16} strokeWidth={2.6} aria-hidden /> Terminé este entrenamiento
      </button>
      <button type="button" className="hhr-cta hhr-cta-miss" onClick={() => setMode('missed')}>
        <X size={16} strokeWidth={2.6} aria-hidden /> No pude entrenar este día
      </button>
    </section>
  )
}

/** Siempre disponible: una consulta que no puede esperar. */
export function UrgentCard({ token, proLabel }: { token: string; proLabel: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    setBusy(true)
    setError('')
    try {
      await sendSharedUrgentMessage(token, text.trim())
      setSent(true)
      setText('')
      setOpen(false)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="hhr-urgent" aria-label="Consulta urgente">
      {sent ? (
        <p className="hhr-urgent-sent" role="status">
          <Check size={14} strokeWidth={2.6} aria-hidden /> Consulta enviada. A {proLabel} le aparece como aviso en su app.
        </p>
      ) : null}
      {open ? (
        <div className="hhr-card hhr-urgent-form">
          <label className="hhr-field">
            <b>Consulta urgente</b>
            <span>Para algo que no puede esperar: un dolor fuerte, una lesión, una duda antes de entrenar.</span>
            <textarea rows={3} maxLength={1000} value={text} autoFocus placeholder="Contá qué pasó" onChange={(e) => setText(e.target.value)} />
          </label>
          {error ? <p className="hhr-save is-error">{error}</p> : null}
          <div className="hhr-log-actions">
            <button type="button" className="hhr-cta" disabled={busy || text.trim().length < 3} onClick={() => void send()}>
              {busy ? 'Enviando…' : 'Enviar consulta'}
            </button>
            <button type="button" className="hhr-link" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="hhr-urgent-btn" onClick={() => setOpen(true)}>
          <AlertTriangle size={15} strokeWidth={2} aria-hidden /> Consulta urgente
        </button>
      )}
      {open || sent ? null : (
        <p className="hhr-urgent-hint">Usalo si hay algo muy urgente o importante: {proLabel} recibe una notificación para leerlo lo antes posible.</p>
      )}
    </section>
  )
}
