import { useEffect, useState } from 'react'
import { ClipboardList, FileText, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  formatFoodFreq,
  NUTRITION_INTAKE_SECTIONS,
  nutritionIntakeFormTypeLabel,
  yesNoLabel,
} from '@/lib/intake/nutritionIntakeDisplay'
import type { NutritionIntakeStored, Student } from '@/types/database'
import { cn } from '@/lib/utils'

function Field({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  if (value == null || value === '') return null
  return (
    <div
      className={cn(
        'border-b border-zinc-200/45 py-3 last:border-b-0 dark:border-zinc-800/65',
        className,
      )}
    >
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100">
        {value}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const hasContent = Boolean(children)
  if (!hasContent) return null
  return (
    <section className="space-y-1">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {title}
      </h4>
      <div>{children}</div>
    </section>
  )
}

function intakeFieldValue(
  intake: NutritionIntakeStored,
  key: keyof NutritionIntakeStored,
): string | null {
  const raw = intake[key]
  if (raw == null) return null
  if (key === 'smoking' || key === 'has_physical_activity') return yesNoLabel(String(raw)) ?? null
  if (typeof raw === 'string') {
    const t = raw.trim()
    return t || null
  }
  return null
}

function hasNutritionIntakeContent(intake: NutritionIntakeStored | null | undefined): boolean {
  if (!intake || typeof intake !== 'object') return false
  const skip = new Set(['version', 'uploads', 'submitted_at', 'selected_plan_slug'])
  return Object.entries(intake).some(([k, v]) => {
    if (skip.has(k)) return false
    if (k === 'food_freq') {
      return formatFoodFreq(v as NutritionIntakeStored['food_freq']).length > 0
    }
    if (typeof v === 'string') return v.trim().length > 0
    return v != null && typeof v === 'object' && Object.keys(v as object).length > 0
  })
}

export function NutritionWebIntakePanel({ student }: { student: Student }) {
  const intake = student.intake_nutrition as NutritionIntakeStored | null | undefined
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const uploads = intake?.uploads
    if (!uploads || Object.keys(uploads).length === 0) {
      setFileUrls({})
      return
    }
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const [key, path] of Object.entries(uploads)) {
        if (key === 'profile') continue
        const { data, error } = await supabase.storage.from('student-intake').createSignedUrl(path, 3600)
        if (!error && data?.signedUrl) next[key] = data.signedUrl
      }
      if (!cancelled) setFileUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [student.id, intake?.uploads])

  if (!hasNutritionIntakeContent(intake)) return null

  const i = intake!
  const foodRows = formatFoodFreq(i.food_freq)
  let formType = (i as NutritionIntakeStored & { form_type?: string }).form_type
  if (!formType && student.notes?.includes('[Full /form]')) formType = 'full'
  if (!formType && student.notes?.includes('[Nutrición /form]')) formType = 'nutrition'

  return (
    <div className="rounded-2xl border border-surface-border/80 bg-surface-elevated/20 p-5 sm:p-6">
      <div className="mb-6 flex flex-col gap-2 border-b border-zinc-200/45 pb-4 sm:flex-row sm:items-baseline sm:justify-between dark:border-zinc-800/60">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <h3 className="text-[13px] font-semibold text-ink-primary">Cuestionario nutricional del registro</h3>
            <p className="text-[11px] text-ink-muted">
              {nutritionIntakeFormTypeLabel(formType)} · completado en /form
            </p>
          </div>
        </div>
        {i.submitted_at ? (
          <p className="text-[11px] text-ink-muted sm:text-right">
            Enviado el{' '}
            <span className="tabular-nums text-ink-secondary">
              {formatDate(i.submitted_at.slice(0, 10))}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-8">
        {NUTRITION_INTAKE_SECTIONS.map((section) => {
          const fields = section.fields
            .map((f) => {
              const value = intakeFieldValue(i, f.key)
              return value ? <Field key={f.key} label={f.label} value={value} /> : null
            })
            .filter(Boolean)
          if (fields.length === 0) return null
          return (
            <Section key={section.title} title={section.title}>
              <div className="grid gap-x-10 sm:grid-cols-2">{fields}</div>
            </Section>
          )
        })}

        {foodRows.length > 0 ? (
          <Section title="Frecuencia de alimentos">
            <div className="overflow-x-auto rounded-xl border border-zinc-200/60 dark:border-zinc-700/60">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200/60 bg-zinc-50/80 dark:border-zinc-700/60 dark:bg-zinc-900/50">
                    <th className="px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-400">Alimento</th>
                    <th className="px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-400">Tipo</th>
                    <th className="px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-400">Frecuencia</th>
                    <th className="px-3 py-2 font-semibold text-zinc-600 dark:text-zinc-400">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {foodRows.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                    >
                      <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">{row.label}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.tipo || '—'}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.frecuencia || '—'}</td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.cantidad || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        ) : null}

        {(i.payment_preference || i.payment_notes?.trim()) && (
          <Section title="Pago (registro web)">
            <Field
              label="Preferencia"
              value={
                i.payment_preference === 'cash'
                  ? 'Efectivo'
                  : i.payment_preference === 'mercadopago'
                    ? 'Mercado Pago'
                    : null
              }
            />
            {i.payment_notes?.trim() ? (
              <Field label="Observación de pago" value={i.payment_notes.trim()} />
            ) : null}
          </Section>
        )}

        {Object.keys(fileUrls).length > 0 ? (
          <Section title="Archivos adjuntos">
            <ul className="space-y-2">
              {Object.entries(fileUrls).map(([key, url]) => (
                <li key={key}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-brand-secondary underline-offset-2 hover:underline"
                  >
                    {key === 'lab' ? (
                      <FileText className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    {key === 'lab' ? 'Estudios / laboratorio' : `Adjunto (${key})`}
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  )
}
