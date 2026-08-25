import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BrandLogo } from '@/components/branding/BrandLogo'
import { Button } from '@/components/ui/Button'
import { CheckInQuestionFields } from '@/components/checkIn/CheckInQuestionFields'
import { cn } from '@/lib/utils'
import type { Json } from '@/types/database'
import {
  emptyAnswerDraft,
  isQuestionVisible,
  parseQuestions,
  serializeDrafts,
  validateDrafts,
  type CheckInAnswerDraft,
} from '@/lib/checkIn/questions'
import toast from 'react-hot-toast'

type FormPayload = {
  ok: boolean
  mode?: 'invite' | 'shared'
  title?: string
  intro?: string
  questions?: Json
  student_name?: string
  student_gender?: string | null
  must_confirm_email?: boolean
  error?: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeToken(raw: string | undefined): string | null {
  const t = raw?.trim()
  if (!t || !UUID_RE.test(t)) return null
  return t.toLowerCase()
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

export function PublicCheckInPage({ shared = false }: { shared?: boolean }) {
  const { token: tokenParam } = useParams<{ token: string }>()
  const token = normalizeToken(tokenParam)
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<FormPayload | null>(null)
  const [drafts, setDrafts] = useState<Record<string, CheckInAnswerDraft>>({})
  const [consent, setConsent] = useState(false)
  const [responderEmail, setResponderEmail] = useState('')
  const [gender, setGender] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const allQuestions = useMemo(
    () => (payload?.ok && payload.questions ? parseQuestions(payload.questions) : []),
    [payload],
  )
  const questions = useMemo(
    () => allQuestions.filter((q) => isQuestionVisible(q, gender)),
    [allQuestions, gender],
  )

  const answeredCount = useMemo(() => {
    let n = 0
    for (const q of questions) {
      const d = drafts[q.id]
      if (!d) continue
      if (q.type === 'scale' && d.text) n += 1
      else if (q.type === 'choice' && d.optionId) n += 1
      else if (q.type === 'text' && d.text.trim()) n += 1
    }
    return n
  }, [questions, drafts])

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
      const { data, error } = shared
        ? await supabase.rpc('get_check_in_form_by_public_token', { p_public_token: token })
        : await supabase.rpc('get_check_in_form_by_token', { p_token: token })
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
      if (typeof row.student_gender === 'string') setGender(row.student_gender)
      if (row.ok && row.questions) {
        const init: Record<string, CheckInAnswerDraft> = {}
        for (const q of parseQuestions(row.questions)) init[q.id] = emptyAnswerDraft()
        setDrafts(init)
      }
      if (!shared && token) {
        const preview = await supabase.rpc('lookup_check_in_invite_preview', { p_token: token })
        if (!cancelled && preview.data && (preview.data as { ok?: boolean }).ok) {
          const g = (preview.data as { gender?: string | null }).gender
          if (g) setGender(g)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, shared])

  async function lookupSharedGender(email: string) {
    if (!shared || !token || !isValidEmail(email)) return
    const { data } = await supabase.rpc('lookup_check_in_student_preview', {
      p_public_token: token,
      p_email: email.trim(),
    })
    const row = data as { ok?: boolean; gender?: string | null }
    if (row?.ok && row.gender) setGender(row.gender)
  }

  async function submit() {
    if (!token || !payload?.ok) return
    const err = validateDrafts(allQuestions, drafts, gender)
    if (err) {
      toast.error(err)
      return
    }
    const jsonAnswers = serializeDrafts(allQuestions, drafts, gender)
    setSubmitError(null)
    setSubmitting(true)
    const { data, error } = shared
      ? await supabase.rpc('submit_check_in_shared_response', {
          p_public_token: token,
          p_answers: jsonAnswers as unknown as Json,
          p_testimonial_consent: consent,
          p_responder_email: responderEmail.trim(),
        })
      : await supabase.rpc('submit_check_in_response', {
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
      if (res?.error === 'already_submitted') {
        toast.error('Ya enviaste el check-in de esta semana. Podés volver a completarlo la semana que viene.')
      } else if (res?.error === 'rate_limited') toast.error('Demasiados intentos. Probá de nuevo en un rato.')
      else if (res?.error === 'answer_too_long') toast.error('Alguna respuesta es demasiado larga.')
      else if (res?.error === 'email_required') toast.error('Ingresá tu correo.')
      else if (res?.error === 'email_invalid') toast.error('Correo no válido.')
      else if (res?.error === 'email_mismatch') {
        toast.error('El correo no coincide con el que tenemos en tu ficha. Usá el mismo que en la app.')
      } else if (
        res?.error === 'student_not_found' ||
        res?.error === 'email_not_recognized' ||
        res?.error === 'email_ambiguous'
      ) {
        setSubmitError(
          'No pudimos validar ese correo. Usá el mismo email con el que te inscribiste o contactá a tu entrenador.',
        )
      } else {
        setSubmitError('No se pudo enviar. Probá de nuevo en unos minutos.')
      }
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
    const missingToken = payload?.error === 'missing_token'
    return (
      <PageFrame>
        <div className="w-full max-w-md rounded-3xl border border-surface-border/70 bg-surface-card/80 px-6 py-10 text-center shadow-card space-y-3">
          <p className="text-lg font-semibold tracking-tight text-ink-primary">
            {rateLimited ? 'Demasiados intentos' : 'Enlace no disponible'}
          </p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            {rateLimited
              ? 'Esperá un minuto y volvé a abrir el link que te compartieron.'
              : missingToken
                ? 'El link está incompleto o mal copiado. Pedile a tu entrenador que te lo reenvíe.'
                : 'Este enlace no es válido, el formulario está pausado o falta activar el check-in en el servidor.'}
          </p>
        </div>
      </PageFrame>
    )
  }

  if (done) {
    return (
      <PageFrame>
        <div className="w-full max-w-md text-center space-y-5 rounded-3xl border border-emerald-500/20 bg-surface-card/80 px-6 py-10 shadow-card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/15 ring-1 ring-emerald-500/25">
            <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <p className="text-2xl font-semibold tracking-tight text-ink-primary">Listo 🙌</p>
            <p className="text-sm leading-relaxed text-ink-secondary">Gracias, tu respuesta ya quedó registrada.</p>
          </div>
        </div>
      </PageFrame>
    )
  }

  const firstName = payload.student_name?.trim().split(/\s+/)[0]

  return (
    <PageFrame innerClassName="justify-start sm:justify-center">
      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-4 pt-2">
          <div className="flex flex-col items-center space-y-2.5 text-center">
            <BrandLogo size="sm" decorative />
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-primary">
              Ferster Fitness · Haciéndolo hábito
            </p>
            <h1 className="text-balance text-[1.7rem] font-semibold tracking-tight text-ink-primary sm:text-3xl">
              {payload.title}
            </h1>
            {firstName ? <p className="text-sm text-ink-secondary">Hola, {firstName} 👋</p> : null}
          </div>
          {payload.intro ? (
            <p className="whitespace-pre-wrap rounded-3xl border border-surface-border/60 bg-surface-card/75 px-4 py-3.5 text-left text-[13px] leading-relaxed text-ink-secondary shadow-card">
              {payload.intro}
            </p>
          ) : null}
        </header>

        {questions.length > 0 ? (
          <div className="sticky top-3 z-10 rounded-2xl border border-surface-border/70 bg-surface-card/90 px-3.5 py-2.5 shadow-card backdrop-blur-md">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-medium text-ink-muted">Progreso</span>
              <span className="tabular-nums font-semibold text-ink-primary">
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
              <div
                className="h-full rounded-full bg-brand-primary transition-all duration-300 ease-out"
                style={{ width: `${(answeredCount / questions.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={onFormSubmit}>
          <div className="rounded-3xl border border-surface-border/70 bg-surface-card/80 p-4 shadow-card sm:p-5">
            <label htmlFor="checkin-email" className="block text-sm font-semibold text-ink-primary leading-snug">
              Mail con el que te registraste
            </label>
            <input
              id="checkin-email"
              type="email"
              autoComplete="email"
              maxLength={EMAIL_MAX}
              value={responderEmail}
              onChange={(e) => setResponderEmail(e.target.value)}
              onBlur={(e) => void lookupSharedGender(e.target.value)}
              placeholder="tu@correo.com"
              className={cn(
                'mt-3 w-full rounded-2xl border border-surface-border bg-surface-input/80',
                'px-3.5 py-3 text-sm text-ink-primary placeholder:text-ink-muted',
                'transition-colors focus:outline-none focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/15',
              )}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
              {shared || payload.must_confirm_email
                ? 'Usá el mismo correo con el que te inscribiste o el que figura en tu ficha del entrenador.'
                : 'Tu entrenador lo usa para identificarte. Si tenés mail en la ficha, debe coincidir.'}
            </p>
          </div>

          {questions.map((q, idx) => (
            <CheckInQuestionFields
              key={q.id}
              question={q}
              index={idx}
              draft={drafts[q.id] ?? emptyAnswerDraft()}
              onChange={(next) => setDrafts((prev) => ({ ...prev, [q.id]: next }))}
            />
          ))}

          <label className="flex items-start gap-3 rounded-2xl border border-surface-border/60 bg-surface-card/60 px-3.5 py-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-surface-border text-brand-primary focus:ring-brand-primary/30"
            />
            <span className="text-xs leading-relaxed text-ink-muted transition-colors group-hover:text-ink-secondary">
              Autorizo usar mis comentarios como testimonio, solo si el equipo lo aprueba.
            </span>
          </label>

          <div className="space-y-2 pt-1">
            {submitError ? (
              <p className="text-center text-sm text-status-expired" role="alert">
                {submitError}
              </p>
            ) : null}
            <Button
              type="submit"
              className="h-12 w-full rounded-2xl text-sm font-semibold"
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
