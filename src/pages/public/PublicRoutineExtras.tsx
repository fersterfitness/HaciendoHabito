import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarHeart, Check, ChevronDown, Star, TrendingUp, Wallet } from 'lucide-react'
import type { SharedRoutineBlock } from '@/lib/routine/sharedRoutine'
import { CHECKIN_SCALES, type TrainingExtras } from '@/lib/routine/studentTrainingLog'
import {
  cycleDay,
  cyclePhase,
  liftProgress,
  paymentNotice,
  saveSharedCyclePill,
  saveSharedCycleStart,
  saveSharedMonthReview,
  weeklyProgress,
  type StudentExtras,
} from '@/lib/routine/studentAppExtras'

/** Piezas de la página del alumno: progreso, ciclo, devolución de fin de mes y recordatorio de pago. */

const errText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo guardar. Intentá de nuevo.')
const kgText = (n: number) => (Math.round(n * 10) / 10).toString().replace('.', ',')
const dayLabel = (ymd: string) => format(new Date(`${ymd}T12:00:00`), "d 'de' MMMM", { locale: es })

/** Recordatorio del día de pago: suave en la fecha, más visible si pasaron más de 5 días hábiles. */
export function PaymentBanner({ extras }: { extras: StudentExtras }) {
  const notice = paymentNotice(extras.payment, extras.today)
  if (!notice) return null
  return (
    <section className={notice.level === 'late' ? 'hhr-pay is-late' : 'hhr-pay'} role="status">
      <span className="hhr-log-icon" aria-hidden>
        <Wallet size={18} strokeWidth={1.9} />
      </span>
      <div>
        <b>{notice.title}</b>
        <span>{notice.body}</span>
      </div>
    </section>
  )
}

/** Cómo viene: días cerrados por semana, cómo llegó a entrenar y los pesos que subieron. */
export function ProgressCard({ blocks, extras, kgOf }: { blocks: SharedRoutineBlock[]; extras: TrainingExtras; kgOf: (exerciseId: string) => number[] }) {
  const weeks = useMemo(() => weeklyProgress(blocks, extras), [blocks, extras])
  const lifts = useMemo(() => liftProgress(blocks, kgOf), [blocks, kgOf])
  const withData = weeks.filter((w) => w.done + w.missed > 0 || CHECKIN_SCALES.some((s) => w.averages[s.key] != null))
  if (withData.length === 0 && lifts.length === 0) return null
  const totalDone = weeks.reduce((n, w) => n + w.done, 0)
  const totalClosed = weeks.reduce((n, w) => n + w.done + w.missed, 0)

  return (
    <details className="hhr-card hhr-progress-card">
      <summary>
        <span className="hhr-log-icon" aria-hidden>
          <TrendingUp size={18} strokeWidth={1.9} />
        </span>
        <span className="hhr-progress-head">
          <b>Tu progreso</b>
          <small>
            {totalDone} {totalDone === 1 ? 'entrenamiento terminado' : 'entrenamientos terminados'}
            {totalClosed > totalDone ? ` · ${totalClosed - totalDone} sin entrenar` : ''}
          </small>
        </span>
        <ChevronDown className="hhr-chev" size={18} strokeWidth={1.8} aria-hidden />
      </summary>
      <div className="hhr-progress-body">
        {withData.length ? (
          <ul className="hhr-weekrows">
            {weeks.map((w, i) =>
              w.done + w.missed > 0 || CHECKIN_SCALES.some((s) => w.averages[s.key] != null) ? (
                <li key={i}>
                  <div className="hhr-weekrow-top">
                    <b>{w.label}</b>
                    <span>
                      {w.done}/{w.total} días{w.missed ? ` · ${w.missed} sin entrenar` : ''}
                    </span>
                  </div>
                  <span className="hhr-weekbar" aria-hidden>
                    {Array.from({ length: w.total }, (_, k) => (
                      <i key={k} className={k < w.done ? 'is-done' : k < w.done + w.missed ? 'is-missed' : ''} />
                    ))}
                  </span>
                  <span className="hhr-weekavg">
                    {CHECKIN_SCALES.filter((s) => w.averages[s.key] != null)
                      .map((s) => `${s.short} ${kgText(w.averages[s.key]!)}`)
                      .concat(w.effort != null ? [`Esfuerzo ${kgText(w.effort)}/10`] : [])
                      .join(' · ')}
                  </span>
                </li>
              ) : null,
            )}
          </ul>
        ) : null}
        {lifts.length ? (
          <div className="hhr-lifts">
            <span className="hhr-exfb-title">Tus pesos</span>
            <ul>
              {lifts.map((l) => {
                const diff = l.lastKg - l.firstKg
                return (
                  <li key={l.name}>
                    <span>{l.name}</span>
                    <b>
                      {kgText(l.firstKg)} → {kgText(l.lastKg)} kg
                      {diff !== 0 ? <em className={diff > 0 ? 'is-up' : ''}> {diff > 0 ? '+' : '−'}{kgText(Math.abs(diff))}</em> : null}
                    </b>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <p className="hhr-save">Los promedios van de 1 a 5 y salen de lo que respondés antes de entrenar.</p>
      </div>
    </details>
  )
}

/** Registro del ciclo desde la app de la alumna. */
export function CycleCard({ token, extras, onChange }: { token: string; extras: StudentExtras; onChange: (patch: Partial<StudentExtras>) => void }) {
  const [date, setDate] = useState(extras.today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const day = cycleDay(extras.cycles, extras.today)

  async function run(fn: () => Promise<void>, patch: Partial<StudentExtras>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      onChange(patch)
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="hhr-card hhr-progress-card">
      <summary>
        <span className="hhr-log-icon" aria-hidden>
          <CalendarHeart size={18} strokeWidth={1.9} />
        </span>
        <span className="hhr-progress-head">
          <b>Tu ciclo</b>
          <small>
            {extras.on_pill
              ? 'Tomás pastillas anticonceptivas'
              : day
                ? `Día ${day} · ${cyclePhase(day)}`
                : 'Registrá el primer día de tu menstruación'}
          </small>
        </span>
        <ChevronDown className="hhr-chev" size={18} strokeWidth={1.8} aria-hidden />
      </summary>
      <div className="hhr-progress-body">
        <label className="hhr-check">
          <input
            type="checkbox"
            checked={extras.on_pill}
            disabled={busy}
            onChange={(e) => void run(() => saveSharedCyclePill(token, e.target.checked), { on_pill: e.target.checked })}
          />
          <span>Tomo pastillas anticonceptivas</span>
        </label>
        <div className="hhr-field">
          <span>¿Cuándo empezó tu última menstruación?</span>
          <div className="hhr-inline">
            <input type="date" value={date} max={extras.today} onChange={(e) => setDate(e.target.value)} />
            <button
              type="button"
              className="hhr-cta"
              disabled={busy || !date || extras.cycles.includes(date)}
              onClick={() => void run(() => saveSharedCycleStart(token, date), { cycles: [date, ...extras.cycles].sort().reverse() })}
            >
              {extras.cycles.includes(date) ? 'Registrado' : 'Registrar'}
            </button>
          </div>
        </div>
        {extras.cycles.length ? <p className="hhr-save">Últimos inicios: {extras.cycles.slice(0, 3).map(dayLabel).join(' · ')}</p> : null}
        {error ? <p className="hhr-save is-error">{error}</p> : null}
        <p className="hhr-save">Lo ve solo tu entrenador, para tenerlo en cuenta al planificar. Las etapas son orientativas (ciclo de 28 días).</p>
      </div>
    </details>
  )
}

/** Al cerrar el mes: cómo vivió la rutina, con su permiso (o no) para compartirlo. */
export function MonthReviewCard({ token, dayId, proLabel, done, onDone }: { token: string; dayId: string; proLabel: string; done: boolean; onDone: () => void }) {
  const [text, setText] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [shareOk, setShareOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (done) {
    return (
      <section className="hhr-card hhr-close is-done" role="status">
        <span className="hhr-log-icon" aria-hidden>
          <Check size={18} strokeWidth={2.6} />
        </span>
        <div className="hhr-close-text">
          <b>Devolución del mes enviada</b>
          <span>Gracias por contarlo. A {proLabel} le sirve mucho.</span>
        </div>
      </section>
    )
  }

  async function send() {
    setBusy(true)
    setError('')
    try {
      await saveSharedMonthReview(token, dayId, { review: text.trim(), rating, shareOk })
      onDone()
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="hhr-card hhr-review" aria-label="Devolución del mes">
      <b>¿Cómo viviste este mes de rutina?</b>
      <span className="hhr-review-sub">Contalo con tus palabras: qué te gustó, qué te costó, cómo te sentiste.</span>
      <div className="hhr-stars" role="group" aria-label="Puntaje del 1 al 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-pressed={rating != null && n <= rating} aria-label={`${n} de 5`} onClick={() => setRating(rating === n ? null : n)}>
            <Star size={26} strokeWidth={1.7} fill={rating != null && n <= rating ? 'currentColor' : 'none'} />
          </button>
        ))}
      </div>
      <label className="hhr-field">
        <textarea rows={4} maxLength={2000} value={text} placeholder="Escribí libremente" onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="hhr-check">
        <input type="checkbox" checked={shareOk} onChange={(e) => setShareOk(e.target.checked)} />
        <span>Acepto que {proLabel} comparta esta devolución (por ejemplo, en sus redes).</span>
      </label>
      {error ? <p className="hhr-save is-error">{error}</p> : null}
      <button type="button" className="hhr-cta" disabled={busy || text.trim().length < 3} onClick={() => void send()}>
        {busy ? 'Enviando…' : 'Enviar devolución'}
      </button>
    </section>
  )
}
