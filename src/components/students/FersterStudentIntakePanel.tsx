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
import { IS_V2 } from '@/lib/uiVersion'

function uploadKeyLabel(key: string): string {
  if (key === 'medical') return 'Estudios médicos'
  if (key.startsWith('progress_')) return `Foto progreso ${key.replace('progress_', '')}`
  return key
}

/** v2: mosaicos compactos en cuatro columnas en lugar de la lista larga con divisores. */
const FIELD_GRID_V2 = 'grid grid-cols-2 gap-2 lg:grid-cols-4'

function Field({
  label,
  value,
  className,
  warn = false,
}: {
  label: string
  value: React.ReactNode
  className?: string
  /** Dato a tener presente al planificar (patología, ejercicios que no puede hacer). */
  warn?: boolean
}) {
  if (value == null || value === '') return null
  if (IS_V2) {
    return (
      <div
        className={cn(
          'flex min-w-0 flex-col gap-0.5 rounded-xl px-3.5 py-2.5',
          warn ? 'hh-pastel bg-pastel-butter text-pastel-butter-ink' : 'bg-surface-elevated/60',
          className?.replace('sm:col-span-2', 'col-span-2'),
        )}
      >
        <p className={cn('text-xs', warn ? 'opacity-80' : 'text-ink-muted')}>{label}</p>
        <div className={cn('break-words text-sm font-medium', warn ? undefined : 'text-ink-primary')}>{value}</div>
      </div>
    )
  }
  return (
    <div className={cn('border-b border-surface-border/45 py-3 last:border-b-0 ', className)}>
      <p className="text-3xs font-medium text-ink-muted ">{label}</p>
      <div className="mt-1 break-words text-sm text-ink-primary ">{value}</div>
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
  if (IS_V2) {
    return (
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-ink-secondary">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
          <h4 className="text-sm font-semibold text-ink-primary">{title}</h4>
        </div>
        <div>{children}</div>
      </section>
    )
  }
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 pb-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand-secondary" aria-hidden />
        <h4 className="text-2xs font-semibold text-ink-secondary ">{title}</h4>
      </div>
      <div>{children}</div>
    </section>
  )
}

const INTAKE_KEYS = [
  'training_since', 'days_per_week', 'lifestyle', 'training_intensity', 'session_duration', 'equipment', 'main_goal',
  'pathology', 'discomfort_exercises', 'four_meals', 'sleep_hours', 'supplements', 'payment_preference', 'payment_notes',
] as const

/**
 * `onlyIntake` (ficha nutricional v2): solo lo que respondió en el formulario. Los datos de la ficha
 * (contacto, documento, peso, talla) ya están en «Datos personales» y no se repiten.
 */
export function FersterStudentIntakePanel({ student, onlyIntake = false }: { student: Student; onlyIntake?: boolean }) {
  const intake = student.intake_ferster as FersterIntakeStored | null | undefined
  const profile = useAuthStore((s) => s.profile)
  const canUseFinances =
    profile?.role === 'admin' || profile?.role === 'trainer' || profile?.role === 'nutritionist'
  const hasExtra = onlyIntake
    ? INTAKE_KEYS.some((k) => {
        const v = (intake as Record<string, unknown> | null | undefined)?.[k]
        return v != null && v !== ''
      }) || Object.keys(intake?.uploads ?? {}).some((k) => k !== 'profile')
    : Boolean(student.document_id?.trim()) ||
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
    <div className={onlyIntake ? 'rounded-2xl border border-surface-border bg-surface-card p-5 sm:p-6' : 'border-t border-surface-border/55 pt-6 '}>
      <div className="mb-6 flex flex-col gap-2 border-b border-surface-border/45 pb-4 sm:flex-row sm:items-baseline sm:justify-between ">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted " aria-hidden />
          <div>
            <h3 className="text-body-sm font-semibold text-ink-primary ">
              Cuestionario de registro
            </h3>
            <p className="text-2xs text-ink-muted ">Datos desde el formulario web (Ferster / form)</p>
          </div>
        </div>
        {i?.submitted_at ? (
          <p className="text-2xs text-ink-muted sm:text-right">
            Enviado el{' '}
            <span className="tabular-nums text-ink-secondary ">
              {formatDate(i.submitted_at.slice(0, 10))}
            </span>
          </p>
        ) : null}
      </div>

      <div className={IS_V2 ? 'space-y-6' : 'space-y-8'}>
        {onlyIntake && !(i?.payment_preference || i?.payment_notes?.trim()) ? null : (
        <Section icon={User} title={onlyIntake ? 'Pago' : 'Datos personales'}>
          <div className={IS_V2 ? FIELD_GRID_V2 : 'grid gap-x-10 gap-y-0 sm:grid-cols-2'}>
            {onlyIntake ? null : (
            <>
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
                    className="inline-flex items-center gap-1 text-ink-secondary underline-offset-4 transition-colors hover:text-ink-primary hover:underline "
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
                    className="inline-flex items-center gap-1 text-ink-secondary underline-offset-4 transition-colors hover:text-ink-primary hover:underline "
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
            </>
            )}
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
              <div className={IS_V2 ? 'col-span-2 flex items-center px-1 lg:col-span-4' : 'sm:col-span-2 pt-1'}>
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
        )}

        {i &&
        (i.training_since ||
          i.days_per_week != null ||
          i.lifestyle ||
          i.training_intensity ||
          i.session_duration ||
          i.equipment ||
          i.main_goal) ? (
          <Section icon={Dumbbell} title="Entrenamiento y objetivo">
            <div className={IS_V2 ? FIELD_GRID_V2 : 'grid gap-3 sm:grid-cols-2'}>
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
            <div className={IS_V2 ? FIELD_GRID_V2 : 'grid gap-3 sm:grid-cols-2'}>
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
                warn={i.pathology === 'yes'}
              />
              <Field
                label="Ejercicios incómodos o que no puede realizar"
                value={i.discomfort_exercises}
                className="sm:col-span-2"
                warn={Boolean(i.discomfort_exercises?.trim()) && !/^(no|ninguno|ninguna|-)\.?$/i.test(i.discomfort_exercises.trim())}
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
                      className="group flex items-center gap-3 border-b border-surface-border/50 py-3 transition-colors last:border-b-0 hover:border-surface-inputBorder/70"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-surface-border/65 bg-transparent text-ink-muted">
                        {isImg ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-primary">
                          {uploadKeyLabel(key)}
                        </span>
                        <span className="text-3xs text-ink-muted">student-intake</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0 text-ink-muted transition-colors group-hover:text-zinc-200" />
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
