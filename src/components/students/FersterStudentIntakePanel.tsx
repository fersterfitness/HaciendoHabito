import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  User,
  Dumbbell,
  HeartPulse,
  Paperclip,
  Mail,
  Phone,
  Calendar,
  ExternalLink,
  ImageIcon,
  FileText,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import {
  fersterEquipmentLabel,
  fersterGoalLabel,
  fersterIntensityLabel,
  fersterLifestyleLabel,
  fersterMealsLabel,
  fersterSessionLabel,
  fersterSleepLabel,
  fersterTrainingSinceLabel,
  studentGenderLabel,
} from '@/lib/fersterIntakeLabels'
import type { Student, FersterIntakeStored } from '@/types/database'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'

function uploadKeyLabel(key: string): string {
  if (key === 'medical') return 'Estudios médicos'
  if (key.startsWith('progress_')) return `Foto progreso ${key.replace('progress_', '')}`
  return key
}

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
    <div className={cn('border-b border-zinc-200/45 py-3 last:border-b-0 dark:border-zinc-800/65', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="mt-1 break-words text-sm text-zinc-800 dark:text-zinc-100">{value}</div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 pb-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand-secondary" aria-hidden />
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{title}</h4>
      </div>
      <div>{children}</div>
    </section>
  )
}

export function FersterStudentIntakePanel({ student }: { student: Student }) {
  const intake = student.intake_ferster as FersterIntakeStored | null | undefined
  const profile = useAuthStore((s) => s.profile)
  const canUseFinances =
    profile?.role === 'admin' || profile?.role === 'trainer' || profile?.role === 'nutritionist'
  const hasExtra =
    Boolean(student.document_id?.trim()) ||
    Boolean(student.address?.trim()) ||
    student.weight_kg != null ||
    student.height_cm != null ||
    student.gender != null ||
    (intake && Object.keys(intake).length > 0)

  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!hasExtra) {
      setFileUrls({})
      return
    }
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
  }, [hasExtra, student.id, intake?.uploads])

  if (!hasExtra) return null

  const i = intake

  return (
    <div className="border-t border-zinc-200/55 pt-6 dark:border-zinc-800/70">
      <div className="mb-6 flex flex-col gap-2 border-b border-zinc-200/45 pb-4 sm:flex-row sm:items-baseline sm:justify-between dark:border-zinc-800/60">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden />
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
              Cuestionario de registro
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Datos desde el formulario web (Ferster / form)</p>
          </div>
        </div>
        {i?.submitted_at ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-right">
            Enviado el{' '}
            <span className="tabular-nums text-zinc-700 dark:text-zinc-300">
              {formatDate(i.submitted_at.slice(0, 10))}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-8">
        <Section icon={User} title="Datos personales">
          <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
            <Field label="Documento" value={student.document_id} />
            <Field
              label="Género"
              value={studentGenderLabel(student.gender, i?.gender_other)}
            />
            <Field
              label="Correo"
              value={
                student.email ? (
                  <a
                    href={`mailto:${student.email}`}
                    className="inline-flex items-center gap-1 text-zinc-700 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {student.email}
                  </a>
                ) : null
              }
            />
            <Field
              label="Teléfono"
              value={
                student.phone ? (
                  <a
                    href={`tel:${student.phone}`}
                    className="inline-flex items-center gap-1 text-zinc-700 underline-offset-4 transition-colors hover:text-zinc-950 hover:underline dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {student.phone}
                  </a>
                ) : null
              }
            />
            <Field
              label="Fecha de nacimiento"
              value={
                student.birth_date ? (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                    {formatDate(student.birth_date)}
                  </span>
                ) : null
              }
            />
            <Field
              label="Peso"
              value={student.weight_kg != null ? `${student.weight_kg} kg` : null}
            />
            <Field
              label="Altura"
              value={student.height_cm != null ? `${student.height_cm} cm` : null}
            />
            {student.address ? (
              <Field label="Dirección" value={student.address} className="sm:col-span-2" />
            ) : null}
            <Field
              label="Preferencia de pago (/form)"
              value={
                i?.payment_preference === 'cash'
                  ? 'Efectivo'
                  : i?.payment_preference === 'mercadopago'
                    ? 'Mercado Pago'
                    : null
              }
            />
            {i?.payment_notes?.trim() ? (
              <Field label="Dato de pago (/form)" value={i.payment_notes.trim()} className="sm:col-span-2" />
            ) : null}
            {canUseFinances && (i?.payment_preference || i?.payment_notes?.trim()) ? (
              <div className="sm:col-span-2 pt-1">
                <Link
                  to={`/finances/income/new?scope=business&student_id=${encodeURIComponent(student.id)}&method=${
                    i?.payment_preference === 'mercadopago' ? 'mercadopago' : 'transferencia'
                  }&desc=${encodeURIComponent(
                    `Cobro · ${student.full_name} (web)${i?.payment_notes?.trim() ? ` · ${i.payment_notes.trim()}` : ''}`,
                  )}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-secondary underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Registrar ingreso en Finanzas
                </Link>
              </div>
            ) : null}
          </div>
        </Section>

        {i &&
        (i.training_since ||
          i.days_per_week != null ||
          i.lifestyle ||
          i.training_intensity ||
          i.session_duration ||
          i.equipment ||
          i.main_goal) ? (
          <Section icon={Dumbbell} title="Entrenamiento y objetivo">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Antigüedad entrenando"
                value={i.training_since ? fersterTrainingSinceLabel(i.training_since) : null}
              />
              <Field
                label="Días por semana"
                value={i.days_per_week != null ? `${i.days_per_week} × semana` : null}
              />
              <Field
                label="Estilo de vida"
                value={i.lifestyle ? fersterLifestyleLabel(i.lifestyle) : null}
              />
              <Field
                label="Intensidad habitual"
                value={i.training_intensity ? fersterIntensityLabel(i.training_intensity) : null}
              />
              <Field
                label="Tiempo por sesión"
                value={i.session_duration ? fersterSessionLabel(i.session_duration) : null}
              />
              <Field
                label="Equipo disponible"
                value={i.equipment ? fersterEquipmentLabel(i.equipment) : null}
              />
              <Field
                label="Objetivo principal"
                value={i.main_goal ? fersterGoalLabel(i.main_goal) : null}
                className="sm:col-span-2"
              />
            </div>
          </Section>
        ) : null}

        {i &&
        (i.pathology ||
          i.discomfort_exercises ||
          i.four_meals ||
          i.sleep_hours ||
          i.supplements) ? (
          <Section icon={HeartPulse} title="Salud y hábitos">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Patología o medicación"
                value={
                  i.pathology
                    ? i.pathology === 'yes'
                      ? `Sí${i.pathology_detail ? ` — ${i.pathology_detail}` : ''}`
                      : 'No'
                    : null
                }
                className="sm:col-span-2"
              />
              <Field
                label="Ejercicios incómodos o que no puede realizar"
                value={i.discomfort_exercises}
                className="sm:col-span-2"
              />
              <Field
                label="Cuatro comidas al día"
                value={i.four_meals ? fersterMealsLabel(i.four_meals) : null}
              />
              <Field
                label="Horas de sueño habituales"
                value={i.sleep_hours ? fersterSleepLabel(i.sleep_hours) : null}
              />
              <Field
                label="Suplementos"
                value={
                  i.supplements
                    ? i.supplements === 'yes'
                      ? 'Sí'
                      : 'No'
                    : null
                }
              />
            </div>
          </Section>
        ) : null}

        {Object.keys(fileUrls).length > 0 ? (
          <Section icon={Paperclip} title="Archivos adjuntos">
            <p className="text-xs text-ink-muted -mt-1 mb-1">
              Enlaces temporales (válidos ~1 h); abrí para ver o descargar.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {Object.entries(fileUrls).map(([key, href]) => {
                const isImg = key.startsWith('progress_')
                return (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 border-b border-zinc-200/50 py-3 transition-colors last:border-b-0 hover:border-zinc-300/70 dark:border-zinc-800/60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-200/65 bg-transparent text-zinc-500 dark:border-zinc-700/65 dark:text-zinc-400">
                        {isImg ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                          {uploadKeyLabel(key)}
                        </span>
                        <span className="text-[10px] text-zinc-500">student-intake</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-zinc-400 transition-colors group-hover:text-zinc-200" />
                    </a>
                  </li>
                )
              })}
            </ul>
          </Section>
        ) : null}
      </div>
    </div>
  )
}
