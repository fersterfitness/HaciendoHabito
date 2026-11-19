import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PublicShell, ProfessionalPhoto } from '@/components/marketplace/PublicShell'
import { fetchRequestForm, submitRequestForm } from '@/data/marketplaceForms'
import { roleLabel } from '@/lib/marketplace'
import {
  MAX_ANSWER_LEN,
  PAY_DAY_OPTIONS,
  PAY_DAY_QUESTION,
  answerErrors,
  buildAnswers,
  payDayLabel,
  type FormQuestion,
} from '@/lib/marketplaceForm'

/** Una pregunta del formulario, según su tipo. */
function QuestionField({ q, n, value, error, onChange }: { q: FormQuestion; n: number; value: string; error?: string; onChange: (v: string) => void }) {
  const label = `${n}. ${q.texto}`
  if (q.tipo === 'larga')
    return <Textarea label={label} required={q.obligatoria} rows={3} maxLength={MAX_ANSWER_LEN} value={value} error={error} onChange={(e) => onChange(e.target.value)} />
  if (q.tipo === 'opciones' || q.tipo === 'si_no') {
    const options = q.tipo === 'si_no' ? ['Sí', 'No'] : q.opciones
    return (
      <fieldset className="flex flex-col gap-2" aria-invalid={error ? true : undefined}>
        <legend className="mb-1 text-sm font-medium text-ink-primary">
          {label}
          {q.obligatoria ? <span className="text-status-expired"> *</span> : null}
        </legend>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <label
              key={o}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-surface-inputBorder px-3.5 text-sm has-[:checked]:border-ink-primary has-[:checked]:bg-surface-elevated"
            >
              <input type="radio" name={q.id} value={o} checked={value === o} onChange={() => onChange(o)} className="h-4 w-4" />
              {o}
            </label>
          ))}
        </div>
        {error ? (
          <p role="alert" className="text-xs text-status-expired">
            {error}
          </p>
        ) : null}
      </fieldset>
    )
  }
  return <Input label={label} required={q.obligatoria} maxLength={300} value={value} error={error} onChange={(e) => onChange(e.target.value)} className="h-11" />
}

/**
 * `/f/:token` — formulario del profesional que el cliente completa desde el link que le llega por WhatsApp
 * (feedback nov19, tanda 6). Las respuestas quedan en su solicitud.
 */
export function MarketplaceRequestFormPage() {
  const { token = '' } = useParams()
  const form = useQuery({ queryKey: ['marketplace', 'request-form', token], queryFn: () => fetchRequestForm(token), retry: 1, staleTime: Infinity })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [payDay, setPayDay] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sent, setSent] = useState(false)
  const data = form.data

  useEffect(() => {
    document.title = data ? `Formulario de ${data.profesional_nombre} · Haciéndolo Hábito` : 'Formulario · Haciéndolo Hábito'
  }, [data])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!data) return
    const found = answerErrors(data.questions, answers, payDay)
    setErrors(found)
    if (Object.keys(found).length) {
      document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSending(true)
    setSendError('')
    try {
      await submitRequestForm(token, buildAnswers(data.questions, answers), payDay)
      setSent(true)
      window.scrollTo({ top: 0 })
    } catch {
      setSendError('No pudimos enviar el formulario. Revisá tu conexión y probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  const first = data?.profesional_nombre.split(' ')[0] ?? ''

  return (
    <PublicShell>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 lg:py-12">
        {form.isPending ? (
          <div className="h-80 animate-pulse rounded-2xl bg-surface-elevated/60" aria-label="Cargando" />
        ) : form.isError ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl bg-surface-panel p-6">
            <p className="text-sm text-ink-secondary">No pudimos cargar el formulario. Revisá tu conexión y probá de nuevo.</p>
            <Button variant="secondary" size="lg" onClick={() => void form.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-surface-inputBorder px-6 py-14 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Este formulario no está disponible</h1>
            <p className="text-sm text-ink-muted">Revisá que el link esté completo o pedí uno nuevo por WhatsApp.</p>
            <Button asChild size="lg" className="mt-3">
              <Link to="/profesionales">Ver profesionales</Link>
            </Button>
          </div>
        ) : sent ? (
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-surface-panel p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-status-ok text-black">
              <Check className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="text-3xl font-semibold tracking-tight">¡Listo, {data.cliente_nombre.split(' ')[0]}!</h1>
            <p className="text-base text-ink-secondary">
              {first} ya tiene tus respuestas. Te pedimos el pago {payDayLabel(payDay)}. Cualquier cambio, avisanos por WhatsApp.
            </p>
          </div>
        ) : (
          <>
            <section className="flex items-center gap-4 rounded-2xl bg-surface-panel p-4 sm:p-5">
              <ProfessionalPhoto nombre={data.profesional_nombre} fotoUrl={data.profesional_foto} rol={data.profesional_rol} className="h-16 w-16 shrink-0 rounded-2xl text-2xl" />
              <div className="min-w-0">
                <p className="text-body-sm text-ink-muted">
                  {roleLabel(data.profesional_rol)} · {data.plan_titulo}
                </p>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight">Formulario de {data.profesional_nombre}</h1>
              </div>
            </section>
            {data.enviado_at ? (
              <p className="rounded-xl bg-surface-elevated px-4 py-3 text-sm text-ink-secondary">
                Ya lo completaste. Si lo mandás de nuevo, se reemplazan tus respuestas anteriores.
              </p>
            ) : (
              <p className="text-sm text-ink-secondary">
                Hola {data.cliente_nombre.split(' ')[0]}: completá estos datos para que {first} arme tu plan a medida. Lo que tiene * es obligatorio.
              </p>
            )}
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-2xl border border-surface-border bg-surface-card p-5 lg:p-6">
              {data.questions.map((q, i) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  n={i + 1}
                  value={answers[q.id] ?? ''}
                  error={errors[q.id]}
                  onChange={(v) => {
                    setAnswers((a) => ({ ...a, [q.id]: v }))
                    if (errors[q.id]) setErrors(({ [q.id]: _drop, ...rest }) => rest)
                  }}
                />
              ))}
              <Select
                label={`${data.questions.length + 1}. ${PAY_DAY_QUESTION}`}
                required
                options={[{ value: '', label: 'Elegí un día' }, ...PAY_DAY_OPTIONS]}
                value={payDay}
                error={errors.pago}
                onChange={(e) => {
                  setPayDay(e.target.value)
                  if (errors.pago) setErrors(({ pago: _drop, ...rest }) => rest)
                }}
                className="h-11"
              />
              <Button type="submit" size="lg" loading={sending} icon={<ArrowRight className="h-4 w-4" />} iconPosition="right">
                Enviar formulario
              </Button>
              {sendError ? (
                <p role="alert" className="text-sm text-status-expired">
                  {sendError}
                </p>
              ) : null}
            </form>
          </>
        )}
      </main>
    </PublicShell>
  )
}
