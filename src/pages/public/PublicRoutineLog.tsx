import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, Check, MessageSquareText, Moon, X } from 'lucide-react'
import {
  BORG_LABELS,
  CHECKIN_SCALES,
  checkinSummary,
  hasCheckin,
  saveSharedDayCheckin,
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

const errText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo guardar. Intentá de nuevo.')

function ymdLabel(ymd: string | null): string {
  if (!ymd) return ''
  const d = new Date(`${ymd}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '' : format(d, "d 'de' MMMM", { locale: es })
}

/** Botones 1…max, uno elegido. Tocar el elegido lo saca. */
function Scale({ max, value, onChange, label }: { max: number; value: number | null; onChange: (v: number | null) => void; label: string }) {
  return (
    <div className={max > 5 ? 'hhr-scale is-wide' : 'hhr-scale'} role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? null : n)}>
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
export function DayCheckinCard({
  token,
  dayId,
  log,
  proLabel,
  onSaved,
  onSkip,
}: {
  token: string
  dayId: string
  log: DayLog
  proLabel: string
  onSaved: (dayId: string, patch: Partial<DayLog>) => void
  onSkip: () => void
}) {
  const [v, setV] = useState({ sleep: log.sleep, energy: log.energy, stress: log.stress, soreness: log.soreness })
  const [note, setNote] = useState(log.checkin_note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const answered = CHECKIN_SCALES.every((s) => v[s.key] != null)

  async function submit() {
    setBusy(true)
    setError('')
    const patch = { ...v, checkin_note: note.trim() }
    try {
      await saveSharedDayCheckin(token, dayId, patch)
      onSaved(dayId, { ...patch, checkin_at: new Date().toISOString() })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="hhr-card hhr-checkin" aria-label="Antes de entrenar">
      <div className="hhr-log-head">
        <span className="hhr-log-icon" aria-hidden>
          <Moon size={18} strokeWidth={1.9} />
        </span>
        <div>
          <b>Antes de empezar, ¿cómo estás hoy?</b>
          <span>Son 4 toques. {proLabel.charAt(0).toUpperCase() + proLabel.slice(1)} lo usa para ajustar tu entrenamiento.</span>
        </div>
      </div>
      {CHECKIN_SCALES.map((s) => (
        <div key={s.key} className="hhr-field">
          <span>{s.label}</span>
          <Scale max={5} value={v[s.key]} label={s.label} onChange={(n) => setV((cur) => ({ ...cur, [s.key]: n }))} />
          <span className="hhr-scale-ends">
            <i>1 · {s.low}</i>
            <i>5 · {s.high}</i>
          </span>
        </div>
      ))}
      <label className="hhr-field">
        <span>¿Algo más que quieras contar? (opcional)</span>
        <textarea rows={2} maxLength={600} value={note} placeholder="Por ejemplo: dormí poco por el trabajo" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? <p className="hhr-save is-error">{error}</p> : null}
      <div className="hhr-log-actions">
        <button type="button" className="hhr-cta" disabled={!answered || busy} onClick={() => void submit()}>
          {busy ? 'Guardando…' : 'Comenzar entreno'}
        </button>
        <button type="button" className="hhr-link" onClick={onSkip}>
          Responder después
        </button>
      </div>
      {!answered ? <p className="hhr-save">Elegí un número en cada pregunta para empezar.</p> : null}
    </section>
  )
}

/** Renglón con lo que respondió en el chequeo, una vez hecho. */
export function DayCheckinSummary({ log }: { log: DayLog }) {
  if (!hasCheckin(log)) return null
  return (
    <p className="hhr-checkin-line">
      <Check size={13} strokeWidth={2.6} aria-hidden /> Cómo llegaste hoy: {checkinSummary(log)}
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
      <button type="button" className="hhr-cta" onClick={() => setMode('done')}>
        <Check size={16} strokeWidth={2.6} aria-hidden /> Terminé este entrenamiento
      </button>
      <button type="button" className="hhr-link" onClick={() => setMode('missed')}>
        No pude entrenar este día
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
    </section>
  )
}
