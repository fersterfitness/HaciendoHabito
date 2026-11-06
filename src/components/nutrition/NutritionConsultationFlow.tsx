import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft, ArrowRight, CalendarDays, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { confirmDialog } from '@/components/ui/dialogs'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { controlMdClassName } from '@/lib/formControlClasses'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import { bookAppointment } from '@/lib/appointments/bookAppointment'
import {
  ANTHRO_PERIMETER_KEYS,
  ANTHRO_SKINFOLD_KEYS,
  isAnthropometryDetail,
  labelForAnthroKey,
  type AnthropometryVariableKey,
} from '@/lib/nutrition/anthropometryProgramModel'
import { useAuthStore } from '@/stores/authStore'
import type { NutritionMeasurement, NutritionPatientFollowup, Student } from '@/types/database'
import { NutritionAnthropometryProgramForm } from './NutritionAnthropometryProgramForm'
import { NutritionBodyComparisonCard } from './NutritionBodyComparisonCard'
import { NutritionWeeklyPlanSection } from './NutritionWeeklyPlanSection'
import { Delta, METRICS, nf, type Metric } from './NutritionResumenDashboardV2'
import { useNextAppointment } from './NutritionResumenDashboard'

/**
 * Modo consulta: todo lo que se hace con el paciente adelante, en orden y en una sola pantalla.
 * Medidas → qué cambió → plan → nota → próximo turno. Cada paso se puede saltear; lo que se hace
 * queda guardado en su pestaña de siempre.
 */

const STEPS = [
  { id: 'medidas', label: 'Medidas' },
  { id: 'cambios', label: 'Qué cambió' },
  { id: 'plan', label: 'Plan' },
  { id: 'nota', label: 'Nota' },
  { id: 'turno', label: 'Próximo turno' },
] as const
type StepId = (typeof STEPS)[number]['id'] | 'fin'

const SUMMARY_METRICS: Metric[] = [
  { key: 'weight', label: 'Peso', short: 'Peso', unit: 'kg', dir: 'neutral', get: (m) => weightOf(m) },
  ...METRICS,
]

function mediansOf(m: NutritionMeasurement | undefined) {
  return m && isAnthropometryDetail(m.detail) ? m.detail.medians ?? {} : {}
}

/** Métricas principales y las medidas de zona que más se movieron entre dos controles. */
function compare(latest: NutritionMeasurement | undefined, prev: NutritionMeasurement | undefined, heightCm: number | null) {
  const metrics = latest
    ? SUMMARY_METRICS.flatMap((mt) => {
        const v = mt.get(latest, heightCm)
        if (v == null) return []
        const p = prev ? mt.get(prev, heightCm) : null
        return [{ mt, v, delta: p != null ? v - p : null }]
      })
    : []
  const a = mediansOf(latest)
  const b = mediansOf(prev)
  const zones = ([...ANTHRO_PERIMETER_KEYS, ...ANTHRO_SKINFOLD_KEYS] as AnthropometryVariableKey[])
    .flatMap((k) => {
      const v = a[k]
      const p = b[k]
      if (v == null || p == null || p === 0) return []
      return [{ key: k, v, delta: v - p, rel: Math.abs(v - p) / p, unit: k.endsWith('_mm') ? 'mm' : 'cm' }]
    })
    .filter((z) => z.rel >= 0.03)
    .sort((x, y) => y.rel - x.rel)
    .slice(0, 6)
  return { metrics, zones }
}

function signed(v: number, unit: string) {
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${nf(Math.abs(v))}${unit ? ` ${unit}` : ''}`
}

function noteDraft(c: ReturnType<typeof compare>, hasPrev: boolean) {
  const lines = c.metrics.map(({ mt, v, delta }) => `${mt.label}: ${nf(v)}${mt.unit ? ` ${mt.unit}` : ''}${hasPrev && delta != null ? ` (${signed(delta, mt.unit)})` : ''}`)
  if (c.zones.length) lines.push(`Zonas: ${c.zones.map((z) => `${labelForAnthroKey(z.key).toLowerCase()} ${signed(z.delta, z.unit)}`).join(', ')}`)
  return lines.length ? `${lines.join('\n')}\n\n` : ''
}

export function NutritionConsultationFlow({
  open,
  onClose,
  student,
  measurements,
  followup,
  onMeasurementsChanged,
  onFollowupChanged,
  onAppointmentBooked,
  onStudentUpdated,
}: {
  open: boolean
  onClose: () => void
  student: Student
  /** Del más nuevo al más viejo. */
  measurements: NutritionMeasurement[]
  followup: NutritionPatientFollowup | null
  onMeasurementsChanged: () => Promise<void> | void
  onFollowupChanged: (next: NutritionPatientFollowup) => void
  onAppointmentBooked: () => void
  onStudentUpdated?: (next: Student) => void
}) {
  const { user, profile } = useAuthStore()
  const [step, setStep] = useState<StepId>('medidas')
  const [done, setDone] = useState<Partial<Record<StepId, string>>>({})
  const [bookedVersion, setBookedVersion] = useState(0)
  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!open) return
    setStep('medidas')
    setDone({})
  }, [open, student.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && step === 'fin') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, step, onClose])

  const latest = measurements[0]
  const prev = measurements[1]
  const heightCm = student.height_cm ?? null
  const comparison = useMemo(() => compare(latest, prev, heightCm), [latest, prev, heightCm])
  const latestIsToday = latest?.measured_at.slice(0, 10) === today

  if (!open) return null

  const idx = STEPS.findIndex((s) => s.id === step)
  const go = (next: StepId) => {
    // Revisar los cambios o el plan no guarda nada aparte: con verlos alcanza.
    if (next === 'cambios' || next === 'plan') setDone((d) => (d[next] ? d : { ...d, [next]: 'Revisado' }))
    setStep(next)
    document.getElementById('consulta-scroll')?.scrollTo({ top: 0 })
  }
  const nextStep = () => go(idx < STEPS.length - 1 ? STEPS[idx + 1]!.id : 'fin')
  const mark = (id: StepId, what: string) => setDone((d) => ({ ...d, [id]: what }))

  async function requestClose() {
    const saved = Object.values(done).some((v) => v && v !== 'Revisado')
    if (step === 'fin' || !saved) {
      onClose()
      return
    }
    if (await confirmDialog({ title: '¿Salir del modo consulta?', description: 'Lo que ya guardaste queda guardado.', confirmLabel: 'Salir' })) onClose()
  }

  async function finish() {
    if (user) {
      const { data, error } = await supabase
        .from('nutrition_patient_followups')
        .upsert(
          { owner_id: user.id, student_id: student.id, attendance_status: 'P', last_consultation_date: today },
          { onConflict: 'owner_id,student_id' },
        )
        .select('*')
        .single()
      if (error) toast.error(error.message)
      else onFollowupChanged(data as NutritionPatientFollowup)
    }
    go('fin')
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-surface-base" role="dialog" aria-modal="true" aria-label={`Consulta de ${student.full_name}`}>
      {/* Barra: paciente, pasos y salir */}
      <div className="shrink-0 border-b border-surface-border bg-surface-card">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-ink-muted">Consulta · {format(new Date(), "d 'de' MMMM", { locale: es })}</p>
            <p className="truncate text-[15px] font-semibold text-ink-primary">{student.full_name}</p>
          </div>
          <ol className={cn('ml-auto hidden items-center gap-1', step !== 'fin' && 'md:flex')} aria-label="Pasos de la consulta">
            {STEPS.map((s, i) => {
              const active = s.id === step
              const ok = Boolean(done[s.id])
              return (
                <li key={s.id} className="flex items-center gap-1">
                  {i > 0 ? <span className="h-px w-4 bg-surface-border" aria-hidden /> : null}
                  <button
                    type="button"
                    onClick={() => go(s.id)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
                      active ? 'bg-ink-primary text-surface-card' : ok ? 'text-ink-primary hover:bg-surface-elevated' : 'text-ink-muted hover:bg-surface-elevated hover:text-ink-primary',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] tabular-nums',
                        active ? 'bg-surface-card/20' : ok ? 'bg-status-generated/20 text-status-generated' : 'bg-surface-elevated',
                      )}
                    >
                      {ok ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ol>
          <span className="ml-auto text-[12px] text-ink-muted md:hidden">
            {step === 'fin' ? 'Listo' : `Paso ${idx + 1} de ${STEPS.length} · ${STEPS[idx]!.label}`}
          </span>
          <button
            type="button"
            onClick={() => void requestClose()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-elevated hover:text-ink-primary"
            aria-label="Salir del modo consulta"
            title="Salir"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div id="consulta-scroll" className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          {step === 'medidas' ? (
            <StepShell
              title="Medidas de hoy"
              hint={
                latestIsToday
                  ? 'Ya hay un control de hoy. Podés seguir o cargar otro.'
                  : 'Arrastrá el informe o cargá a mano. Al lado de cada medida ves el valor del control anterior.'
              }
            >
              <Card padding="md">
                <NutritionAnthropometryProgramForm
                  ownerId={user?.id ?? ''}
                  student={student}
                  measurements={measurements}
                  onSaved={async () => {
                    await onMeasurementsChanged()
                    mark('medidas', 'Control guardado')
                    go('cambios')
                  }}
                />
              </Card>
            </StepShell>
          ) : null}

          {step === 'cambios' ? (
            <StepShell
              title="Qué cambió"
              hint={
                latest && prev
                  ? `Control del ${format(parseISO(latest.measured_at), "d 'de' MMMM", { locale: es })} contra el del ${format(parseISO(prev.measured_at), "d 'de' MMMM", { locale: es })}.`
                  : latest
                    ? 'Es el primer control: todavía no hay con qué comparar.'
                    : 'Todavía no hay controles cargados.'
              }
            >
              {comparison.metrics.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {comparison.metrics.map(({ mt, v, delta }) => (
                    <div key={mt.key} className="rounded-2xl border border-surface-border/80 bg-surface-card px-4 py-3.5">
                      <p className="text-[12px] font-medium text-ink-muted">{mt.label}</p>
                      <p className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-semibold tabular-nums text-ink-primary">{nf(v)}</span>
                        {mt.unit ? <span className="text-[12px] text-ink-muted">{mt.unit}</span> : null}
                      </p>
                      <p className="mt-1 text-[12px]">{delta != null ? <Delta value={delta} unit={mt.unit} dir={mt.dir} /> : <span className="text-ink-muted">sin control anterior</span>}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {comparison.zones.length ? (
                <Card padding="md" className="mt-4">
                  <CardTitle className="mb-3">Lo que más se movió</CardTitle>
                  <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                    {comparison.zones.map((z) => (
                      <li key={z.key} className="flex items-center justify-between gap-3 border-b border-surface-border/60 pb-2 text-[13.5px]">
                        <span className="text-ink-secondary">{labelForAnthroKey(z.key)}</span>
                        <span className="tabular-nums text-ink-primary">
                          {nf(z.v)} {z.unit} <Delta value={z.delta} unit={z.unit} dir={z.unit === 'mm' ? 'down' : 'neutral'} className="ml-2 text-[12px]" />
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {latest && prev ? (
                <div className="mt-4">
                  <NutritionBodyComparisonCard student={student} measurements={measurements} onStudentUpdated={onStudentUpdated} />
                </div>
              ) : null}
            </StepShell>
          ) : null}

          {step === 'plan' ? (
            <StepShell title="Plan alimentario" hint="Ajustá lo que haga falta. Si el plan sigue igual, pasá al paso siguiente.">
              <Card padding="md">
                <NutritionWeeklyPlanSection student={student} measurements={measurements} suggestedNextDate={followup?.next_consultation_date ?? null} />
              </Card>
            </StepShell>
          ) : null}

          {step === 'nota' ? (
            <NoteStep
              ownerId={user?.id ?? null}
              studentId={student.id}
              draft={latestIsToday ? noteDraft(comparison, Boolean(prev)) : ''}
              onSaved={() => {
                mark('nota', 'Nota guardada')
                nextStep()
              }}
            />
          ) : null}

          {step === 'turno' ? (
            <NextAppointmentStep
              ownerId={user?.id ?? null}
              profileType={profile?.role === 'nutritionist' ? 'nutritionist' : 'trainer'}
              student={student}
              version={bookedVersion}
              onBooked={(label) => {
                mark('turno', label)
                setBookedVersion((v) => v + 1)
                onAppointmentBooked()
              }}
            />
          ) : null}

          {step === 'fin' ? (
            <div className="mx-auto max-w-md py-10 text-center">
              <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-status-generated/15 text-status-generated">
                <Check className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-lg font-semibold text-ink-primary">Consulta cerrada</h2>
              <ul className="mt-4 space-y-1.5 text-left text-[14px]">
                {STEPS.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-2.5">
                    <span className="text-ink-secondary">{s.label}</span>
                    <span className={done[s.id] ? 'font-medium text-ink-primary' : 'text-ink-muted'}>{done[s.id] ?? 'Sin cambios'}</span>
                  </li>
                ))}
              </ul>
              <Button className="mt-6" onClick={onClose}>
                Volver a la ficha
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {step !== 'fin' ? (
        <div className="shrink-0 border-t border-surface-border bg-surface-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} disabled={idx === 0} onClick={() => go(STEPS[idx - 1]!.id)}>
              Atrás
            </Button>
            {idx < STEPS.length - 1 ? (
              <Button size="sm" variant="secondary" onClick={nextStep}>
                {(step === 'medidas' || step === 'nota') && !done[step] ? 'Saltear' : 'Siguiente'}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => void finish()}>
                Cerrar consulta
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  )
}

function StepShell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-ink-primary">{title}</h2>
      <p className="mb-5 mt-0.5 text-sm text-ink-muted">{hint}</p>
      {children}
    </section>
  )
}

function NoteStep({ ownerId, studentId, draft, onSaved }: { ownerId: string | null; studentId: string; draft: string; onSaved: () => void }) {
  const [body, setBody] = useState(draft)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!ownerId || !body.trim()) return
    setSaving(true)
    const { error } = await supabase.from('nutrition_clinical_notes').insert({
      owner_id: ownerId,
      student_id: studentId,
      occurred_at: format(new Date(), 'yyyy-MM-dd'),
      title: 'Consulta',
      body: body.trim(),
    })
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Nota guardada en Historia')
    onSaved()
  }

  return (
    <StepShell title="Nota de la consulta" hint={draft ? 'Ya tiene los cambios de hoy. Sumá objetivos, acuerdos y lo que charlaron.' : 'Objetivos, acuerdos y lo que charlaron. Queda en Historia.'}>
      <Card padding="md">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
          }}
          rows={10}
          autoFocus
          placeholder="¿Qué pasó en esta consulta?"
          aria-label="Nota de la consulta"
          className="block w-full resize-y rounded-xl border border-surface-border bg-surface-panel px-4 py-3 text-[14px] leading-relaxed text-ink-primary placeholder:text-ink-muted focus:border-ink-muted/50 focus:outline-none"
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          <span className="hidden text-[11px] text-ink-muted sm:inline">Ctrl + Enter</span>
          <Button size="sm" loading={saving} disabled={!body.trim()} onClick={() => void save()}>
            Guardar nota
          </Button>
        </div>
      </Card>
    </StepShell>
  )
}

const WEEKS = [2, 3, 4, 6, 8]
const DURATIONS = [30, 45, 60]

function NextAppointmentStep({
  ownerId,
  profileType,
  student,
  version,
  onBooked,
}: {
  ownerId: string | null
  profileType: 'nutritionist' | 'trainer'
  student: Student
  version: number
  onBooked: (label: string) => void
}) {
  const existing = useNextAppointment(student.id, version)
  const [date, setDate] = useState(() => format(addDays(new Date(), 28), 'yyyy-MM-dd'))
  const [time, setTime] = useState(() => format(new Date(), 'HH:00'))
  const [duration, setDuration] = useState(45)
  const [saving, setSaving] = useState(false)

  async function book() {
    if (!ownerId) return
    const startsAt = new Date(`${date}T${time}`)
    if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() < Date.now()) {
      toast.error('Elegí una fecha y hora futuras')
      return
    }
    setSaving(true)
    const r = await bookAppointment({ ownerId, studentId: student.id, profileType, startsAt, durationMin: duration, title: 'Consulta nutricional' })
    setSaving(false)
    if (r.error) {
      toast.error(r.error)
      return
    }
    const label = format(startsAt, "EEE d MMM · HH:mm", { locale: es })
    toast.success(r.googleSynced ? 'Turno agendado y pasado a Google Calendar' : 'Turno agendado')
    onBooked(label)
  }

  return (
    <StepShell title="Próximo turno" hint="Queda en la Agenda con los recordatorios de siempre, y el plan toma la fecha solo.">
      {existing ? (
        <Card padding="md" className="mb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-ink-primary text-surface-card">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[12px] text-ink-muted">Ya tiene turno</p>
              <p className="text-[15px] font-semibold text-ink-primary first-letter:uppercase">
                {format(parseISO(existing.starts_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
              </p>
            </div>
          </div>
        </Card>
      ) : null}
      <Card padding="md">
        <CardTitle className="mb-4">{existing ? 'Agendar otro' : 'Agendar'}</CardTitle>
        <p className="mb-2 text-[12px] font-medium text-ink-muted">Volver en</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {WEEKS.map((w) => {
            const d = format(addDays(new Date(), w * 7), 'yyyy-MM-dd')
            return (
              <button
                key={w}
                type="button"
                onClick={() => setDate(d)}
                aria-pressed={date === d}
                className={cn(
                  'h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                  date === d ? 'border-ink-primary bg-ink-primary text-surface-card' : 'border-surface-border text-ink-secondary hover:border-ink-muted hover:text-ink-primary',
                )}
              >
                {w} semanas
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-medium text-ink-muted">
            Día
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(controlMdClassName, 'mt-1 block w-[10rem] px-2')} />
          </label>
          <label className="text-[12px] font-medium text-ink-muted">
            Hora
            <input type="time" value={time} step={900} onChange={(e) => setTime(e.target.value)} className={cn(controlMdClassName, 'mt-1 block w-[7rem] px-2')} />
          </label>
          <label className="text-[12px] font-medium text-ink-muted">
            Duración
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={cn(controlMdClassName, 'mt-1 block w-[7rem] cursor-pointer px-2')}>
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </label>
          <Button loading={saving} onClick={() => void book()}>
            Agendar
          </Button>
        </div>
        {date ? (
          <p className="mt-3 text-[12px] text-ink-muted first-letter:uppercase">
            {format(parseISO(date), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        ) : null}
      </Card>
    </StepShell>
  )
}
