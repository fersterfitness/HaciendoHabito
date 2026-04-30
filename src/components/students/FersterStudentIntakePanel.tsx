import { useEffect, useState } from 'react'
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

function uploadKeyLabel(key: string): string {
  if (key === 'profile') return 'Foto de perfil'
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
    <div
      className={`rounded-xl border border-surface-border bg-surface-elevated/40 px-3 py-2.5 ${className ?? ''}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <div className="text-sm text-ink-primary mt-0.5 break-words">{value}</div>
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
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
      </div>
      {children}
    </section>
  )
}

export function FersterStudentIntakePanel({ student }: { student: Student }) {
  const intake = student.intake_ferster as FersterIntakeStored | null | undefined
  const hasExtra =
    student.document_id ||
    student.address ||
    student.weight_kg != null ||
    student.height_cm != null ||
    (intake && Object.keys(intake).length > 0)

  if (!hasExtra) return null

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
        const { data, error } = await supabase.storage.from('student-intake').createSignedUrl(path, 3600)
        if (!error && data?.signedUrl) next[key] = data.signedUrl
      }
      if (!cancelled) setFileUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [student.id, intake?.uploads])

  const i = intake

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card shadow-sm">
      <div className="flex flex-col gap-1 border-b border-surface-border bg-gradient-to-br from-brand-primary/[0.06] to-transparent px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/15 text-brand-primary">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-base font-bold text-ink-primary">Cuestionario de registro</h3>
            <p className="text-xs text-ink-muted">Datos enviados desde el formulario web (Ferster /form)</p>
          </div>
        </div>
        {i?.submitted_at ? (
          <p className="text-xs text-ink-muted sm:text-right pl-14 sm:pl-0">
            Enviado el{' '}
            <span className="font-medium text-ink-secondary">
              {formatDate(i.submitted_at.slice(0, 10))}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-8 p-4 sm:p-6">
        <Section icon={User} title="Datos personales">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Documento" value={student.document_id} />
            <Field
              label="Género"
              value={studentGenderLabel(student.gender, i?.gender_other)}
            />
            <Field
              label="Correo"
              value={
                student.email ? (
                  <a href={`mailto:${student.email}`} className="text-brand-primary hover:underline inline-flex items-center gap-1">
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
                  <a href={`tel:${student.phone}`} className="text-brand-primary hover:underline inline-flex items-center gap-1">
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
                const isImg = key.startsWith('progress_') || key === 'profile'
                return (
                  <li key={key}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-center gap-3 rounded-xl border border-surface-border bg-surface-elevated/50 px-3 py-3 transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/[0.04]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-brand-primary">
                        {isImg ? <ImageIcon className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink-primary truncate">
                          {uploadKeyLabel(key)}
                        </span>
                        <span className="text-[10px] text-ink-muted">student-intake</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted group-hover:text-brand-primary" />
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
