import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { useProfessionalForm, useSaveProfessionalForm } from '@/data/marketplaceForms'
import { controlSelectClassName } from '@/lib/formControlClasses'
import {
  FORMS_MIGRATION,
  FORM_QUESTION_TYPES,
  MAX_QUESTIONS,
  MAX_QUESTION_LEN,
  PAY_DAY_QUESTION,
  cleanQuestions,
  newQuestionId,
  questionProblems,
  type FormQuestion,
  type FormQuestionType,
} from '@/lib/marketplaceForm'
import { cn } from '@/lib/utils'

/**
 * Pestaña «Formulario» (feedback nov19, tanda 6): las preguntas que el cliente completa cuando se le manda
 * el link desde la solicitud. Cada profesional arma las suyas; el día de pago va siempre.
 */
export function FormTab({ professionalId }: { professionalId: string }) {
  const q = useProfessionalForm(professionalId)
  const save = useSaveProfessionalForm()
  const [questions, setQuestions] = useState<FormQuestion[] | null>(null)
  const [dirty, setDirty] = useState(false)
  const [problems, setProblems] = useState<string[]>([])

  useEffect(() => {
    if (q.data && !dirty) setQuestions(q.data.questions)
  }, [q.data, dirty])

  if (q.isPending || !questions) return <div className="h-40 animate-pulse rounded-2xl bg-surface-elevated/60" aria-label="Cargando" />
  if (q.data && !q.data.available) {
    return (
      <p className="rounded-2xl border border-dashed border-surface-inputBorder p-6 text-sm text-ink-secondary">
        Para armar el formulario falta correr en Supabase {FORMS_MIGRATION}.
      </p>
    )
  }

  const edit = (next: FormQuestion[]) => {
    setQuestions(next)
    setDirty(true)
    setProblems([])
  }
  const patch = (id: string, p: Partial<FormQuestion>) => edit(questions.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const move = (i: number, d: -1 | 1) => {
    const next = [...questions]
    const [it] = next.splice(i, 1)
    next.splice(i + d, 0, it!)
    edit(next)
  }

  function onSave() {
    const list = questions ?? []
    const found = questionProblems(list)
    setProblems(found)
    if (found.length) return
    save.mutate(
      { professionalId, questions: cleanQuestions(list) },
      {
        onSuccess: () => {
          setDirty(false)
          toast.success('Formulario guardado')
        },
        onError: () => toast.error('No se pudo guardar el formulario. Probá de nuevo.'),
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-elevated/70 p-4 text-sm text-ink-secondary">
        <p>
          Es lo que completa el cliente para empezar. Desde <span className="font-medium text-ink-primary">Solicitudes</span>, el botón{' '}
          <span className="font-medium text-ink-primary">Formulario</span> le manda el link por WhatsApp y las respuestas aparecen en esa solicitud.
        </p>
        {!q.data?.custom ? <p className="mt-1.5 text-ink-muted">Estas son unas preguntas de base: cambialas por las tuyas y guardá.</p> : null}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-surface-border bg-surface-card p-4">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium text-ink-primary">{PAY_DAY_QUESTION} · obligatoria</p>
          <p className="text-ink-muted">Va siempre al final. El nombre y el WhatsApp ya los dejó en la solicitud.</p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {questions.map((x, i) => (
          <li key={x.id} className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-card p-4">
            <div className="flex items-start gap-2">
              <span className="mt-2.5 w-6 shrink-0 text-sm font-semibold tabular-nums text-ink-muted">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <Input
                  aria-label={`Pregunta ${i + 1}`}
                  placeholder="Escribí la pregunta"
                  value={x.texto}
                  maxLength={MAX_QUESTION_LEN}
                  onChange={(e) => patch(x.id, { texto: e.target.value })}
                />
              </div>
              <div className="flex shrink-0 items-center">
                <Button variant="ghost" size="icon" aria-label="Subir" title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Bajar" title="Bajar" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Borrar pregunta" title="Borrar pregunta" onClick={() => edit(questions.filter((y) => y.id !== x.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-8">
              <select
                aria-label={`Tipo de respuesta de la pregunta ${i + 1}`}
                value={x.tipo}
                onChange={(e) => patch(x.id, { tipo: e.target.value as FormQuestionType, opciones: e.target.value === 'opciones' && x.opciones.length === 0 ? ['', ''] : x.opciones })}
                className={cn(controlSelectClassName, 'h-10 w-auto')}
              >
                {FORM_QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" className="h-4 w-4" checked={x.obligatoria} onChange={(e) => patch(x.id, { obligatoria: e.target.checked })} />
                Obligatoria
              </label>
            </div>
            {x.tipo === 'opciones' ? (
              <div className="pl-8">
                <Textarea
                  label="Opciones (una por renglón)"
                  rows={Math.min(8, Math.max(3, x.opciones.length + 1))}
                  value={x.opciones.join('\n')}
                  onChange={(e) => patch(x.id, { opciones: e.target.value.split('\n').slice(0, 12) })}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ol>

      {problems.length ? (
        <ul role="alert" className="flex flex-col gap-1 text-sm text-status-expired">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          icon={<Plus className="h-4 w-4" />}
          disabled={questions.length >= MAX_QUESTIONS}
          onClick={() => edit([...questions, { id: newQuestionId(), texto: '', tipo: 'corta', opciones: [], obligatoria: false }])}
        >
          Agregar pregunta
        </Button>
        <Button loading={save.isPending} disabled={!dirty && q.data?.custom} onClick={onSave}>
          Guardar formulario
        </Button>
        {dirty ? <span className="text-xs text-ink-muted">Hay cambios sin guardar.</span> : null}
      </div>
    </div>
  )
}
