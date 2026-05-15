import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'
import toast from 'react-hot-toast'

const MAX_TEXT_ANSWER_CHARS = 4000
const SCALE_VALUES = [1, 2, 3, 4, 5] as const

type QuestionDef = { id: string; label: string; type: 'text' | 'scale' }

function parseQuestions(raw: unknown): QuestionDef[] {
  if (!Array.isArray(raw)) return []
  const out: QuestionDef[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    out.push({ id: o.id, label: o.label, type: o.type === 'scale' ? 'scale' : 'text' })
  }
  return out
}

type FormPayload = {
  ok: boolean
  title?: string
  intro?: string
  questions?: Json
  student_name?: string
  must_confirm_email?: boolean
  error?: string
}

const EMAIL_MAX = 320
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s || s.length > EMAIL_MAX) return false
  return SIMPLE_EMAIL_RE.test(s)
}

function PageFrame({ children, innerClassName }: { children: ReactNode; innerClassName?: string }) {
  return (
    <div className="min-h-[100dvh] bg-surface-base flex flex-col">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-72 w-[min(100%,28rem)] -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-brand-secondary/8 blur-3xl" />
      </div>
      <div
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14',
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ScalePicker({
  value,
  onChange,
  label,
}: {
  value: number
  onChange: (n: number) => void
  label: string
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-ink-primary leading-snug">{label}</legend>
      <div className="flex gap-2" role="group" aria-label={label}>
        {SCALE_VALUES.map((num) => {
          const selected = value === num
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              aria-pressed={selected}
              className={cn(
                'flex-1 h-11 rounded-xl text-sm font-semibold transition-all duration-150',
                'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40',
                selected
                  ? 'border-brand-primary bg-brand-primary text-white shadow-sm'
                  : 'border-surface-border bg-surface-card/80 text-ink-secondary hover:border-brand-primary/30 hover:text-ink-primary',
              )}
            >
              {num}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function PublicCheckInPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<FormPayload | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [responderEmail, setResponderEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const questions = useMemo(() => (payload?.ok && payload.questions ? parseQuestions(payload.questions) : []), [payload])

  const answeredCount = useMemo(() => {
    let n = 0
    for (const q of questions) {
      if (q.type === 'scale') {
        if (answers[q.id]) n += 1
      } else if ((answers[q.id] ?? '').trim()) n += 1
    }
    return n
  }, [questions, answers])

  const emailOk = isValidEmail(responderEmail)
  const canSubmit = questions.length > 0 && answeredCount >= questions.length && emailOk

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!token) {
        setPayload({ ok: false, error: 'missing_token' })
        setLoading(false)
        return
      }
      const { data, error } = await supabase.rpc('get_check_in_form_by_token', { p_token: token })
      if (cancelled) return
      setLoading(false)
      if (error) {
        setPayload({ ok: false, error: error.message })
        return
      }
      const row = data as FormPayload
      if (!row.ok && row.error === 'rate_limited') {
        setPayload({ ok: false, error: 'rate_limited' })
        return
      }
      setPayload(row)
      if (row.ok && row.questions) {
        const init: Record<string, string> = {}
        for (const q of parseQuestions(row.questions)) {
          init[q.id] = q.type === 'scale' ? '3' : ''
        }
        setAnswers(init)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token])

  async function submit() {
    if (!token || !payload?.ok) return
    for (const q of questions) {
      if (q.type === 'text') {
        const v = (answers[q.id] ?? '').trim()
        if (!v) {
          toast.error(`Respondé: ${q.label}`)
          return
        }
        if (v.length > MAX_TEXT_ANSWER_CHARS) {
          toast.error(`«${q.label}»: máximo ${MAX_TEXT_ANSWER_CHARS} caracteres.`)
          return
        }
      }
    }
    setSubmitting(true)
    const jsonAnswers: Record<string, string | number> = {}
    for (const q of questions) {
      if (q.type === 'scale') jsonAnswers[q.id] = Number(answers[q.id] ?? 3)
      else jsonAnswers[q.id] = (answers[q.id] ?? '').trim()
    }
    const { data, error } = await supabase.rpc('submit_check_in_response', {
      p_token: token,
      p_answers: jsonAnswers as unknown as Json,
      p_testimonial_consent: consent,
      p_responder_email: responderEmail.trim(),
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const res = data as { ok?: boolean; error?: string }
    if (!res?.ok) {
      if (res?.error === 'already_submitted') toast.error('Ya enviaste este formulario.')
      else if (res?.error === 'rate_limited') toast.error('Demasiados intentos. Probá de nuevo en un rato.')
      else if (res?.error === 'answer_too_long') toast.error('Alguna respuesta es demasiado larga.')
      else if (res?.error === 'email_required') toast.error('Ingresá tu correo.')
      else if (res?.error === 'email_invalid') toast.error('Correo no válido.')
      else if (res?.error === 'email_mismatch') {
        toast.error('El correo no coincide con el que tenemos en tu ficha. Usá el mismo que en la app.')
      } else toast.error('No se pudo enviar.')
      return
    }
    setDone(true)
  }

  function onFormSubmit(e: FormEvent) {
    e.preventDefault()
    void submit()
  }

  if (loading) {
    return (
      <PageFrame>
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-label="Cargando" />
      </PageFrame>
    )
  }

  if (!payload?.ok) {
    const rateLimited = payload?.error === 'rate_limited'
    return (
      <PageFrame>
        <div className="w-full max-w-md text-center space-y-3">
          <p className="text-lg font-semibold text-ink-primary">
            {rateLimited ? 'Demasiados intentos' : 'Enlace no disponible'}
          </p>
          <p className="text-sm text-ink-secondary leading-relaxed">
            {rateLimited
              ? 'Esperá un minuto y volvé a abrir el link que te compartieron.'
              : 'Este enlace no es válido o el formulario ya no está activo.'}
          </p>
        </div>
      </PageFrame>
    )
  }

  if (done) {
    return (
      <PageFrame>
        <div className="w-full max-w-md text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25">
            <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <p className="text-xl font-semibold tracking-tight text-ink-primary">Listo</p>
            <p className="text-sm text-ink-secondary">Gracias, tu respuesta ya quedó registrada.</p>
          </div>
        </div>
      </PageFrame>
    )
  }

  const firstName = payload.student_name?.trim().split(/\s+/)[0]

  return (
    <PageFrame innerClassName="justify-start sm:justify-center">
      <div className="w-full max-w-lg space-y-8">
        <header className="text-center space-y-2 pt-2">
          {firstName ? (
            <p className="text-xs font-medium uppercase tracking-widest text-brand-primary">Hola, {firstName}</p>
          ) : null}
          <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight text-ink-primary text-balance">
            {payload.title}
          </h1>
          {payload.intro ? (
            <p className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap max-w-prose mx-auto">
              {payload.intro}
            </p>
          ) : null}
        </header>

        <form
          className="rounded-2xl border border-surface-border/80 bg-surface-card/90 backdrop-blur-sm shadow-sm dark:shadow-none p-5 sm:p-7 space-y-7"
          onSubmit={onFormSubmit}
        >
          {questions.map((q, idx) => (
            <div key={q.id} className={cn('space-y-2', idx > 0 && 'pt-7 border-t border-surface-border/60')}>
              {q.type === 'scale' ? (
                <ScalePicker
                  label={q.label}
                  value={Number(answers[q.id] ?? 3)}
                  onChange={(n) => setAnswers((a) => ({ ...a, [q.id]: String(n) }))}
                />
              ) : (
                <div className="space-y-2">
                  <label htmlFor={`q-${q.id}`} className="block text-sm font-medium text-ink-primary leading-snug">
                    {q.label}
                  </label>
                  <textarea
                    id={`q-${q.id}`}
                    rows={3}
                    maxLength={MAX_TEXT_ANSWER_CHARS}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                    placeholder="Escribí tu respuesta…"
                    className={cn(
                      'w-full resize-y rounded-xl border border-surface-border bg-surface-input/80',
                      'px-3.5 py-3 text-sm text-ink-primary placeholder:text-ink-muted',
                      'transition-colors focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/15',
                    )}
                  />
                  <p className="text-[10px] text-ink-muted text-right tabular-nums">
                    {(answers[q.id] ?? '').length}/{MAX_TEXT_ANSWER_CHARS}
                  </p>
                </div>
              )}
            </div>
          ))}

          <div className="space-y-2 pt-1 border-t border-surface-border/60">
            <label htmlFor="checkin-email" className="block text-sm font-medium text-ink-primary leading-snug">
              Correo electrónico
            </label>
            <input
              id="checkin-email"
              type="email"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              value={responderEmail}
              onChange={(e) => setResponderEmail(e.target.value)}
              placeholder="tu@correo.com"
              className={cn(
                'w-full rounded-xl border border-surface-border bg-surface-input/80',
                'px-3.5 py-3 text-sm text-ink-primary placeholder:text-ink-muted',
                'transition-colors focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/15',
              )}
            />
            <p className="text-[11px] text-ink-muted leading-relaxed">
              {payload.must_confirm_email
                ? 'Tiene que ser el mismo correo que usás en la app Haciendo Hábito (así tu entrenador valida la respuesta).'
                : 'Tu entrenador lo usa para identificarte si compartís el link. Si después cargan tu mail en la ficha, podrán marcar coincidencias.'}
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-primary focus:ring-brand-primary/30"
            />
            <span className="text-xs text-ink-muted leading-relaxed group-hover:text-ink-secondary transition-colors">
              Autorizo usar mis comentarios como testimonio, solo si el equipo lo aprueba.
            </span>
          </label>

          <div className="space-y-2 pt-1">
            <Button
              type="submit"
              className="w-full h-11 rounded-xl text-sm font-semibold"
              variant="gradientPrimary"
              loading={submitting}
              disabled={submitting || !canSubmit}
            >
              Enviar respuestas
            </Button>
            {questions.length > 0 && answeredCount < questions.length ? (
              <p className="text-center text-[11px] text-ink-muted">
                Completá las {questions.length} preguntas para enviar
              </p>
            ) : !emailOk ? (
              <p className="text-center text-[11px] text-ink-muted">Ingresá un correo válido para enviar</p>
            ) : null}
          </div>
        </form>

        <p className="text-center text-[10px] text-ink-muted/80 pb-4">
          Tus respuestas son privadas y solo las ve tu entrenador.
        </p>
      </div>
    </PageFrame>
  )
}
