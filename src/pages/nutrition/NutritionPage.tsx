import { useEffect, useMemo, useState } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  FolderOpen,
  LineChart,
  Plus,
  Search,
  Users,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { Button } from '@/components/ui/Button'
import { NewStudentModal } from '@/components/students/NewStudentModal'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { cn } from '@/lib/utils'
import type { Student, NutritionPatientFollowup, NutritionAttendanceStatus } from '@/types/database'
import toast from 'react-hot-toast'

type FollowupRow = Student & {
  followup?: NutritionPatientFollowup
}

const STATUS_OPTIONS: NutritionAttendanceStatus[] = ['P', 'A', 'ST']

const ATTENDANCE_LABELS: Record<NutritionAttendanceStatus, string> = {
  P: 'Asistió',
  A: 'No asistió',
  ST: 'Sin turno',
}

const ATTENDANCE_PILLS: Record<NutritionAttendanceStatus, string> = {
  P: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  A: 'bg-red-500/12 text-red-700 dark:text-red-300 border-red-500/25',
  ST: 'bg-surface-elevated text-ink-secondary border-surface-border/60',
}

function nextConsultLabel(value: string | null): { label: string; sub: string; tone: 'soon' | 'past' | 'far' | 'none' } {
  if (!value) return { label: '—', sub: 'Sin turno', tone: 'none' }
  const date = parseISO(value)
  const today = startOfDay(new Date())
  const days = differenceInCalendarDays(date, today)
  const label = format(date, "dd/MM/yyyy")
  let sub = format(date, "EEEE", { locale: es })
  sub = sub.charAt(0).toUpperCase() + sub.slice(1)
  if (days < 0) return { label, sub: `${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'} atrás`, tone: 'past' }
  if (days === 0) return { label, sub: 'Hoy', tone: 'soon' }
  if (days <= 7) return { label, sub: `En ${days} día${days === 1 ? '' : 's'}`, tone: 'soon' }
  return { label, sub, tone: 'far' }
}

export function NutritionPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<FollowupRow[]>([])
  const [newPatientOpen, setNewPatientOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: students, error: studentsError }, { data: followups, error: followupsError }] = await Promise.all([
        fetchAccessibleStudents(),
        supabase
          .from('nutrition_patient_followups')
          .select('*')
          .eq('owner_id', user.id),
      ])

      if (studentsError || followupsError) {
        toast.error(studentsError?.message ?? followupsError?.message ?? 'No se pudieron cargar pacientes')
        setLoading(false)
        return
      }

      const followupsByStudent = new Map((followups ?? []).map((f) => [f.student_id, f]))
      const merged = (students ?? []).map((s) => ({
        ...s,
        followup: followupsByStudent.get(s.id),
      }))
      setRows(merged)
      setLoading(false)
    })()
  }, [user])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.full_name.toLowerCase().includes(q))
  }, [rows, search])

  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    let upcomingWeek = 0
    let overdue = 0
    let attended = 0
    for (const r of rows) {
      const next = r.followup?.next_consultation_date
      if (next) {
        const d = differenceInCalendarDays(parseISO(next), today)
        if (d < 0) overdue++
        else if (d <= 7) upcomingWeek++
      }
      if (r.followup?.attendance_status === 'P') attended++
    }
    return { total: rows.length, upcomingWeek, overdue, attended }
  }, [rows])

  async function updateFollowup(studentId: string, patch: Partial<NutritionPatientFollowup>) {
    if (!user) return
    const existing = rows.find((r) => r.id === studentId)?.followup
    const payload = {
      owner_id: user.id,
      student_id: studentId,
      attendance_status: existing?.attendance_status ?? 'ST',
      ...patch,
    }
    const { data, error } = await supabase
      .from('nutrition_patient_followups')
      .upsert(payload, { onConflict: 'owner_id,student_id' })
      .select('*')
      .single()

    if (error) {
      toast.error(error.message)
      return
    }

    setRows((prev) =>
      prev.map((r) => (r.id === studentId ? { ...r, followup: data as NutritionPatientFollowup } : r))
    )
  }

  return (
    <div>
      <Header title="Nutrición · Pacientes" />
      <div className="px-4 lg:px-6 py-6 space-y-5">
        {/* Stats arriba */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill
            label="Pacientes"
            value={stats.total}
            icon={<Users className="h-4 w-4" />}
            tone="neutral"
          />
          <StatPill
            label="Próx. 7 días"
            value={stats.upcomingWeek}
            icon={<CalendarClock className="h-4 w-4" />}
            tone="info"
          />
          <StatPill
            label="Atrasados"
            value={stats.overdue}
            icon={<CalendarClock className="h-4 w-4" />}
            tone={stats.overdue > 0 ? 'warn' : 'neutral'}
          />
          <StatPill
            label="Asistieron (último)"
            value={stats.attended}
            icon={<FolderOpen className="h-4 w-4" />}
            tone="good"
          />
        </div>

        <PageToolbar>
          <div className="flex flex-col lg:flex-row gap-4 w-full lg:items-center lg:justify-between">
            <div className="w-full max-w-lg">
              <Input
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<BookOpen className="h-4 w-4" />}
                onClick={() => navigate('/nutrition/menus')}
              >
                Menús estacionales
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<LineChart className="h-4 w-4" />}
                onClick={() => navigate('/nutrition/evolution')}
              >
                Evolución
              </Button>
              <Button
                type="button"
                size="sm"
                variant="gradientPrimary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setNewPatientOpen(true)}
              >
                Nuevo paciente
              </Button>
            </div>
          </div>
        </PageToolbar>

        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner size="lg" accent="trainerCta" />
          </div>
        ) : filteredRows.length === 0 ? (
          rows.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="h-8 w-8" />}
              title="No hay pacientes cargados"
              description="Creá tu primer paciente para empezar a gestionar su carpeta nutricional."
              action={{
                label: 'Nuevo paciente',
                onClick: () => setNewPatientOpen(true),
                icon: <Plus className="h-4 w-4" />,
              }}
            />
          ) : (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title={`Sin resultados para "${search}"`}
              description="Probá con otro nombre o limpiá el buscador."
            />
          )
        ) : (
          <div className="w-full overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
            <table className="w-full text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-surface-border bg-surface-elevated/30">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">
                    Paciente
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">
                    Última consulta
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">
                    Próxima consulta
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest min-w-[10rem]">
                    Estado
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest w-[1%] whitespace-nowrap">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const next = nextConsultLabel(row.followup?.next_consultation_date ?? null)
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'hover:bg-surface-elevated/30 transition-colors cursor-pointer',
                        index < filteredRows.length - 1 && 'border-b border-surface-border',
                      )}
                      onClick={() => navigate(`/nutrition/${row.id}`)}
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <StudentAvatar
                            studentId={row.id}
                            fullName={row.full_name}
                            avatarPath={row.avatar_path}
                            size="md2"
                            stopRowNavigation
                            onPathChange={(nextPath) =>
                              setRows((prev) =>
                                prev.map((r) => (r.id === row.id ? { ...r, avatar_path: nextPath } : r)),
                              )
                            }
                          />
                          <span className="font-semibold text-ink-primary hover:text-brand-primary truncate">
                            {row.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="date"
                          value={row.followup?.last_consultation_date ?? ''}
                          onChange={(e) => updateFollowup(row.id, { last_consultation_date: e.target.value || null })}
                          className="w-full bg-surface-elevated text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-xs"
                        />
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            value={row.followup?.next_consultation_date ?? ''}
                            onChange={(e) => updateFollowup(row.id, { next_consultation_date: e.target.value || null })}
                            className="w-full bg-surface-elevated text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none text-xs"
                          />
                          {next.tone !== 'none' ? (
                            <span
                              className={cn(
                                'text-[10px] font-medium',
                                next.tone === 'soon' && 'text-emerald-600 dark:text-emerald-400',
                                next.tone === 'past' && 'text-red-600 dark:text-red-400',
                                next.tone === 'far' && 'text-ink-muted',
                              )}
                            >
                              {next.sub}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {STATUS_OPTIONS.map((s) => {
                            const active = (row.followup?.attendance_status ?? 'ST') === s
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => updateFollowup(row.id, { attendance_status: s })}
                                className={cn(
                                  'text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors',
                                  active
                                    ? ATTENDANCE_PILLS[s]
                                    : 'border-surface-border/60 text-ink-muted hover:text-ink-primary',
                                )}
                              >
                                {ATTENDANCE_LABELS[s]}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="whitespace-nowrap"
                          icon={<ChevronRight className="h-4 w-4" />}
                          iconPosition="right"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/nutrition/${row.id}`)
                          }}
                        >
                          Abrir
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <NewStudentModal
        open={newPatientOpen}
        title="Nuevo paciente"
        onClose={() => setNewPatientOpen(false)}
        onCreated={(id) => navigate(`/nutrition/${id}`)}
      />
    </div>
  )
}

function StatPill({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'neutral' | 'good' | 'warn' | 'info'
}) {
  const toneStyles: Record<typeof tone, string> = {
    neutral: 'border-surface-border/80 bg-surface-card',
    good: 'border-emerald-500/25 bg-emerald-500/5',
    warn: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-sky-500/25 bg-sky-500/5',
  }
  const iconTone: Record<typeof tone, string> = {
    neutral: 'text-ink-muted',
    good: 'text-emerald-600 dark:text-emerald-400',
    warn: 'text-amber-600 dark:text-amber-400',
    info: 'text-sky-600 dark:text-sky-400',
  }
  return (
    <div className={cn('rounded-xl border p-4 flex flex-col gap-1', toneStyles[tone])}>
      <div className="flex items-center gap-1.5">
        <span className={iconTone[tone]}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-ink-primary tabular-nums leading-none">{value}</p>
    </div>
  )
}
