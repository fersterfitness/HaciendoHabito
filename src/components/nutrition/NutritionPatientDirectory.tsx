import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { IS_V2 } from '@/lib/uiVersion'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import {
  HH_PATIENT_CARD_CLIP_ID,
  HH_PATIENT_CARD_PATH,
  HH_PATIENT_CARD_PATH_NORMALIZED,
} from '@/lib/patientCardShape'
import { nutritionInputClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'
import type { NutritionAttendanceStatus, NutritionPatientFollowup, Student } from '@/types/database'

export type NutritionFollowupRow = Student & {
  followup?: NutritionPatientFollowup
  /** Plan de entrenamiento elegido en /form (`students.selected_web_plan_slug`). */
  selectedWebPlanLabel?: string | null
  /** Último control de antropometría (solo la v2 lo carga, para la tabla). */
  lastControl?: { date: string; weight: number | null; weightDelta: number | null; weights?: number[] }
}

export const ATTENDANCE_LABELS: Record<NutritionAttendanceStatus, string> = {
  P: 'Asistió',
  A: 'No asistió',
  ST: 'Sin turno',
}

export const ATTENDANCE_PILLS: Record<NutritionAttendanceStatus, string> = {
  P: 'bg-status-generated/12 text-status-generated border-status-generated/25',
  A: 'bg-status-expired/12 text-status-expired border-status-expired/25',
  ST: 'bg-surface-elevated text-ink-secondary border-surface-border/60',
}

interface NutritionPatientCardsProps {
  rows: NutritionFollowupRow[]
  selectedPatientId?: string | null
  nextConsultLabel: (value: string | null) => { label: string; sub: string; tone: 'soon' | 'past' | 'far' | 'none' }
  onOpen: (id: string) => void
  onUpdateFollowup: (studentId: string, patch: Partial<NutritionPatientFollowup>) => void
  onAvatarChange: (studentId: string, avatarPath: string | null) => void
}

const cardDateInputClass = cn(nutritionInputClass, 'h-9 px-2.5 text-xs')

/** Pacientes: grilla de tarjetas en la v1; en la v2, la lista del celular. */
export function NutritionPatientCards({
  rows,
  selectedPatientId = null,
  nextConsultLabel,
  onOpen,
  onUpdateFollowup,
  onAvatarChange,
}: NutritionPatientCardsProps) {
  const nextText = (row: NutritionFollowupRow) => {
    const next = nextConsultLabel(row.followup?.next_consultation_date ?? null)
    return {
      ok: next.tone !== 'past',
      text: next.tone === 'none' ? 'Sin próximo turno' : next.tone === 'past' ? `Atrasado · ${next.sub}` : `Próx. ${next.label} · ${next.sub}`,
    }
  }
  return (
    <>
    {IS_V2 ? (
      <ul className="divide-y divide-surface-border overflow-hidden rounded-2xl border border-surface-border bg-surface-card sm:hidden">
        {rows.map((row) => {
          const n = nextText(row)
          return (
            <li key={row.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpen(row.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onOpen(row.id)
                }}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 active:bg-surface-panel"
              >
                <StudentAvatar
                  studentId={row.id}
                  fullName={row.full_name}
                  avatarPath={row.avatar_path}
                  size="sm"
                  stopRowNavigation
                  onPathChange={(path) => onAvatarChange(row.id, path)}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink-primary">{row.full_name}</p>
                  <p className={cn('truncate text-[12px]', n.ok ? 'text-ink-muted' : 'text-status-expired')}>{n.text}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
              </div>
            </li>
          )
        })}
      </ul>
    ) : null}
    {/* En la v2, desde tablet va la tabla (NutritionPatientTable); las tarjetas quedan para la v1. */}
    {IS_V2 ? null : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      <svg width="0" height="0" className="absolute overflow-hidden" aria-hidden>
        <defs>
          <clipPath id={HH_PATIENT_CARD_CLIP_ID} clipPathUnits="objectBoundingBox">
            <path d={HH_PATIENT_CARD_PATH_NORMALIZED} />
          </clipPath>
        </defs>
      </svg>

      {rows.map((row) => {
        const next = nextConsultLabel(row.followup?.next_consultation_date ?? null)
        const hasAppointment = next.tone === 'soon' || next.tone === 'far'
        const isSelected = selectedPatientId === row.id
        return (
          <div
            key={row.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            onClick={() => onOpen(row.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(row.id)
            }}
            className={cn(
              'hh-row-drop-in hh-patient-card group cursor-pointer transition-all duration-200 hover:-translate-y-0.5',
              isSelected && 'ring-2 ring-brand-tertiary/55 ring-offset-2 ring-offset-surface-base',
            )}
          >
            <svg
              className="hh-patient-card__outline"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path d={HH_PATIENT_CARD_PATH} vectorEffect="non-scaling-stroke" />
            </svg>

            <div className="hh-patient-card__body flex flex-col gap-3.5 bg-surface-card px-5 pb-4 pt-5">
              <StudentAvatar
                studentId={row.id}
                fullName={row.full_name}
                avatarPath={row.avatar_path}
                size="md2"
                stopRowNavigation
                onPathChange={(path) => onAvatarChange(row.id, path)}
              />

              <div className="min-w-0 pr-8">
                <p className="truncate text-xl font-semibold leading-tight tracking-tight text-ink-primary transition-colors group-hover:text-brand-tertiary">
                  {row.full_name}
                </p>
                <p className="mt-1 truncate text-2xs font-light leading-snug text-ink-muted">
                  {row.selectedWebPlanLabel ?? '—'}
                </p>
              </div>

              <div className="h-px bg-surface-border/50" />

              <div className="grid grid-cols-2 gap-2.5" onClick={(e) => e.stopPropagation()}>
                <label className="flex flex-col gap-1 text-3xs font-medium text-ink-muted">
                  Última
                  <input
                    type="date"
                    value={row.followup?.last_consultation_date ?? ''}
                    onChange={(e) =>
                      onUpdateFollowup(row.id, { last_consultation_date: e.target.value || null })
                    }
                    className={cardDateInputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-3xs font-medium text-ink-muted">
                  Próxima
                  <input
                    type="date"
                    value={row.followup?.next_consultation_date ?? ''}
                    onChange={(e) =>
                      onUpdateFollowup(row.id, { next_consultation_date: e.target.value || null })
                    }
                    className={cardDateInputClass}
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    hasAppointment ? 'bg-status-active' : 'bg-status-expired',
                  )}
                />
                <span
                  className={cn(
                    'truncate text-xs font-light',
                    hasAppointment ? 'text-status-active' : 'text-status-expired',
                  )}
                >
                  {next.tone === 'none'
                    ? 'Sin próximo turno'
                    : next.tone === 'past'
                      ? `Atrasado · ${next.sub}`
                      : `Próx. ${next.label} · ${next.sub}`}
                </span>
              </div>
            </div>

            <span
              className={cn(
                'hh-patient-card__action flex items-center justify-center bg-surface-elevated text-ink-muted',
                'transition-colors group-hover:text-brand-tertiary',
              )}
              aria-hidden
            >
              <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </span>
          </div>
        )
      })}
    </div>
    )}
    </>
  )
}

export function formatNextConsult(value: string | null): {
  label: string
  sub: string
  tone: 'soon' | 'past' | 'far' | 'none'
} {
  if (!value) return { label: '—', sub: 'Sin turno', tone: 'none' }
  const date = parseISO(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000)
  const label = format(date, 'dd/MM/yyyy')
  let sub = format(date, 'EEEE', { locale: es })
  sub = sub.charAt(0).toUpperCase() + sub.slice(1)
  if (days < 0) return { label, sub: `${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'} atrás`, tone: 'past' }
  if (days === 0) return { label, sub: 'Hoy', tone: 'soon' }
  if (days <= 7) return { label, sub: `En ${days} día${days === 1 ? '' : 's'}`, tone: 'soon' }
  return { label, sub, tone: 'far' }
}
