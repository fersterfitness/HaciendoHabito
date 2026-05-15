import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import type { Json } from '@/types/database'
import toast from 'react-hot-toast'

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
  error?: string
}

export function PublicCheckInPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [payload, setPayload] = useState<FormPayload | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const questions = useMemo(() => (payload?.ok && payload.questions ? parseQuestions(payload.questions) : []), [payload])

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
      if (q.type === 'text' && !answers[q.id]?.trim()) {
        toast.error(`Respondé: ${q.label}`)
        return
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
    })
    setSubmitting(false)
    if (error) {
      toast.error(error.message)
      return
    }
    const res = data as { ok?: boolean; error?: string }
    if (!res?.ok) {
      if (res?.error === 'already_submitted') toast.error('Ya enviaste este formulario.')
      else toast.error('No se pudo enviar.')
      return
    }
    setDone(true)
    toast.success('Gracias, ya quedó registrado.')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base px-4">
        <p className="text-sm text-ink-secondary">Cargando…</p>
      </div>
    )
  }

  if (!payload?.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base px-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-ink-secondary">Este enlace no es válido o el formulario ya no está activo.</p>
        </Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-base px-4">
        <Card className="max-w-md p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
          <p className="text-lg font-semibold text-ink-primary">Listo</p>
          <p className="text-sm text-ink-secondary">Gracias por tu respuesta.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base py-10 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink-primary">{payload.title}</h1>
          {payload.student_name ? (
            <p className="text-sm text-ink-muted">Hola {payload.student_name}</p>
          ) : null}
        </div>
        {payload.intro ? <p className="text-sm text-ink-secondary text-center whitespace-pre-wrap">{payload.intro}</p> : null}

        <Card className="p-5 sm:p-6 space-y-5">
          {questions.map((q) => (
            <div key={q.id}>
              {q.type === 'scale' ? (
                <>
                  <label className="block text-sm font-medium text-ink-primary mb-2">{q.label}</label>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    className="w-full accent-brand-primary"
                    value={answers[q.id] ?? '3'}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                  <p className="text-xs text-ink-muted mt-1">Valor: {answers[q.id] ?? '3'}</p>
                </>
              ) : (
                <Textarea
                  label={q.label}
                  rows={3}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <label className="flex items-start gap-2 text-sm text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 rounded border-surface-border"
            />
            <span>Autorizo usar mis comentarios como testimonio (solo si el equipo lo aprueba).</span>
          </label>

          <Button type="button" className="w-full" variant="gradientPrimary" loading={submitting} onClick={() => void submit()}>
            Enviar
          </Button>
        </Card>
      </div>
    </div>
  )
}
