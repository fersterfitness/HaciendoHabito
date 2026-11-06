import { differenceInYears, format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { cn } from '@/lib/utils'
import type { NutritionPatientFollowup, Student } from '@/types/database'
import { useNextAppointment } from './NutritionResumenDashboard'

const SEX_LABEL: Record<string, string> = { M: 'Masculino', F: 'Femenino', otro: 'Otro' }

/**
 * v2: quién es el paciente y cuándo vuelve, una sola vez arriba de las pestañas.
 * La foto se cambia acá; el resto de los datos se edita en «Datos personales».
 */
export function NutritionPatientHeaderV2({
  student,
  followup,
  onStudentUpdated,
  onManageAppointments,
  onStartConsultation,
  appointmentVersion = 0,
}: {
  student: Student
  followup: NutritionPatientFollowup | null
  onStudentUpdated: (next: Student) => void
  onManageAppointments: () => void
  /** Abre el modo consulta (medidas, cambios, plan, nota y próximo turno en una pantalla). */
  onStartConsultation?: () => void
  /** Sube cuando se agenda un turno desde otro lado, para volver a leerlo. */
  appointmentVersion?: number
}) {
  const appointment = useNextAppointment(student.id, appointmentVersion)
  const suggested = followup?.next_consultation_date ?? null
  const age = student.birth_date ? differenceInYears(new Date(), parseISO(student.birth_date)) : null
  const meta = [age != null && age > 0 ? `${age} años` : null, student.gender ? SEX_LABEL[student.gender] : null].filter(Boolean)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 items-center gap-4">
        <StudentAvatar
          studentId={student.id}
          fullName={student.full_name}
          avatarPath={student.avatar_path}
          size="md"
          allowRemove
          onPathChange={(path) => onStudentUpdated({ ...student, avatar_path: path })}
        />
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold tracking-tight text-ink-primary">{student.full_name}</h1>
          {meta.length ? <p className="mt-0.5 text-[13px] text-ink-muted">{meta.join(' · ')}</p> : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
      {onStartConsultation ? (
        <Button type="button" icon={<Stethoscope className="h-4 w-4" />} onClick={onStartConsultation}>
          Iniciar consulta
        </Button>
      ) : null}
      <div className="flex items-center gap-3 rounded-2xl border border-surface-border bg-surface-card py-2 pl-3 pr-2">
        <span
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            appointment ? 'bg-ink-primary text-surface-card' : 'bg-surface-elevated text-ink-muted',
          )}
        >
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 pr-1">
          <p className="text-[11px] font-medium text-ink-muted">Próxima consulta</p>
          {appointment ? (
            <p className="text-[13px] font-semibold text-ink-primary first-letter:uppercase">
              {format(parseISO(appointment.starts_at), "EEEE d 'de' MMMM · HH:mm", { locale: es })}
            </p>
          ) : suggested ? (
            <p className="text-[13px] text-ink-secondary">
              <span className="inline-block first-letter:uppercase">{format(parseISO(suggested), "EEEE d 'de' MMMM", { locale: es })}</span>
              <span className="text-ink-muted"> · sin turno</span>
            </p>
          ) : (
            <p className="text-[13px] text-ink-secondary">Sin turno agendado</p>
          )}
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={onManageAppointments}>
          {appointment ? 'Turnos' : 'Agendar'}
        </Button>
      </div>
      </div>
    </div>
  )
}
