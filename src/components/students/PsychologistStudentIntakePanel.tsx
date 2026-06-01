import { differenceInYears } from 'date-fns'
import { Brain, Mail, Phone, MapPin, Activity, UserRound } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { PsychologistIntakeStored, Student } from '@/types/database'
import { cn } from '@/lib/utils'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="border-b border-zinc-200/45 py-3 last:border-b-0 dark:border-zinc-800/65">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <div className="mt-1 break-words text-sm text-zinc-800 dark:text-zinc-100">{value}</div>
    </div>
  )
}

export function PsychologistStudentIntakePanel({ student }: { student: Student }) {
  const intake = student.intake_psychologist as PsychologistIntakeStored | null | undefined
  if (!intake || Object.keys(intake).length < 2) return null

  const age =
    student.birth_date != null ? differenceInYears(new Date(), new Date(student.birth_date)) : null

  return (
    <section
      className={cn(
        'rounded-2xl border border-violet-200/60 bg-violet-50/30 p-4 dark:border-violet-900/40 dark:bg-violet-950/20',
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Brain className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Ingreso · Psicología deportiva</h3>
      </div>

      <div className="grid gap-0 sm:grid-cols-2 sm:gap-x-6">
        <Field label="Nombre completo" value={student.full_name} />
        <Field label="Edad" value={age != null ? `${age} años` : null} />
        <Field
          label="Fecha de nacimiento"
          value={student.birth_date ? formatDate(student.birth_date) : null}
        />
        <Field label="Lugar de residencia" value={intake.residence ?? student.address} />
        <Field label="Deporte que practica" value={intake.sport_practiced} />
        <Field
          label="Teléfono"
          value={
            student.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                {student.phone}
              </span>
            ) : null
          }
        />
        <Field
          label="Email"
          value={
            student.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                {student.email}
              </span>
            ) : null
          }
        />
        <Field
          label="Contacto de emergencia"
          value={
            intake.emergency_contact ? (
              <span className="inline-flex items-start gap-1.5">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                {intake.emergency_contact}
              </span>
            ) : null
          }
        />
        {intake.selected_plan_slug ? (
          <Field label="Plan web" value={intake.selected_plan_slug} />
        ) : null}
        {intake.submitted_at ? (
          <Field label="Enviado" value={formatDate(intake.submitted_at)} />
        ) : null}
      </div>

      {(intake.residence ?? student.address) && intake.sport_practiced ? (
        <p className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            Residencia
          </span>
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3 w-3" aria-hidden />
            Deporte
          </span>
        </p>
      ) : null}
    </section>
  )
}
