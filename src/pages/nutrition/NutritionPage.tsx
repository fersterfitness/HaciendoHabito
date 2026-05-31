import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  AlarmClock,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FolderOpen,
  LineChart,
  Plus,
  Search,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { labelForSelectedWebPlanSlug } from '@/lib/selectedWebPlanLabel'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { Button } from '@/components/ui/Button'
import { directoryToolbarBtnClassName } from '@/lib/primaryGradientCtaClasses'
import { NewStudentModal } from '@/components/students/NewStudentModal'
import { StudentDeletionHistoryPanel } from '@/components/students/StudentDeletionHistoryPanel'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { NutritionPatientAreaHeader } from '@/components/nutrition/NutritionPatientAreaHeader'
import { nutritionShellClass } from '@/lib/nutrition/nutritionAreaUi'
import {
  formatNextConsult,
  NutritionPatientCards,
  type NutritionFollowupRow,
} from '@/components/nutrition/NutritionPatientDirectory'
import { NutritionPatientDetailView } from '@/pages/nutrition/NutritionPatientDetailPage'
import { cn } from '@/lib/utils'
import type { NutritionPatientFollowup } from '@/types/database'
import toast from 'react-hot-toast'

type PatientFilter = 'all' | 'soon' | 'overdue' | 'none' | 'attended' | 'absent'

const PATIENT_FILTERS: { id: PatientFilter; label: string; icon: LucideIcon }[] = [
  { id: 'all', label: 'Todos', icon: Users },
  { id: 'soon', label: 'Próx. 7 días', icon: CalendarClock },
  { id: 'overdue', label: 'Atrasados', icon: AlarmClock },
  { id: 'none', label: 'Sin turno', icon: CalendarX },
  { id: 'attended', label: 'Asistió', icon: CalendarCheck },
  { id: 'absent', label: 'No asistió', icon: X },
]

function FilterChip({
  active,
  count,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  count: number
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors',
        active
          ? 'border-brand-tertiary bg-brand-tertiary/10 text-brand-tertiary'
          : 'border-surface-border/70 text-ink-muted hover:border-surface-border hover:text-ink-secondary',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
      <span
        className={cn(
          'ml-0.5 rounded-full px-1.5 text-[10px] tabular-nums',
          active ? 'bg-brand-tertiary/15 text-brand-tertiary' : 'bg-surface-elevated text-ink-muted',
        )}
      >
        {count}
      </span>
    </button>
  )
}

export function NutritionPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<PatientFilter>('all')
  const [rows, setRows] = useState<NutritionFollowupRow[]>([])
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const patientPanelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [
        { data: students, error: studentsError },
        { data: followups, error: followupsError },
        { data: webPlans, error: webPlansError },
      ] = await Promise.all([
        fetchAccessibleStudents(),
        supabase.from('nutrition_patient_followups').select('*').eq('owner_id', user.id),
        supabase.from('web_plans').select('slug, title'),
      ])

      if (studentsError || followupsError || webPlansError) {
        toast.error(
          studentsError ?? followupsError?.message ?? webPlansError?.message ?? 'No se pudieron cargar pacientes',
        )
        setLoading(false)
        return
      }

      const followupsByStudent = new Map((followups ?? []).map((f) => [f.student_id, f]))
      const webPlanTitlesBySlug = new Map(
        (webPlans ?? []).map((p) => [p.slug as string, (p.title as string)?.trim() || '']),
      )
      const merged = (students ?? []).map((s) => ({
        ...s,
        followup: followupsByStudent.get(s.id),
        selectedWebPlanLabel: labelForSelectedWebPlanSlug(s.selected_web_plan_slug, webPlanTitlesBySlug),
      }))
      setRows(merged)
      setLoading(false)
    })()
  }, [user, reloadToken])

  const searchedRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.full_name.toLowerCase().includes(q))
  }, [rows, search])

  const filterCounts = useMemo(() => {
    const counts: Record<PatientFilter, number> = {
      all: searchedRows.length,
      soon: 0,
      overdue: 0,
      none: 0,
      attended: 0,
      absent: 0,
    }
    for (const r of searchedRows) {
      const tone = formatNextConsult(r.followup?.next_consultation_date ?? null).tone
      if (tone === 'soon') counts.soon++
      else if (tone === 'past') counts.overdue++
      else if (tone === 'none') counts.none++
      const status = r.followup?.attendance_status ?? 'ST'
      if (status === 'P') counts.attended++
      else if (status === 'A') counts.absent++
    }
    return counts
  }, [searchedRows])

  const filteredRows = useMemo(() => {
    if (activeFilter === 'all') return searchedRows
    return searchedRows.filter((r) => {
      const tone = formatNextConsult(r.followup?.next_consultation_date ?? null).tone
      const status = r.followup?.attendance_status ?? 'ST'
      switch (activeFilter) {
        case 'soon':
          return tone === 'soon'
        case 'overdue':
          return tone === 'past'
        case 'none':
          return tone === 'none'
        case 'attended':
          return status === 'P'
        case 'absent':
          return status === 'A'
        default:
          return true
      }
    })
  }, [searchedRows, activeFilter])

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
      prev.map((r) => (r.id === studentId ? { ...r, followup: data as NutritionPatientFollowup } : r)),
    )
  }

  function handleAvatarChange(studentId: string, avatarPath: string | null) {
    setRows((prev) => prev.map((r) => (r.id === studentId ? { ...r, avatar_path: avatarPath } : r)))
  }

  useEffect(() => {
    if (!selectedPatientId) return
    const frame = window.requestAnimationFrame(() => {
      patientPanelRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedPatientId])

  useEffect(() => {
    if (!selectedPatientId) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectedPatientId(null)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selectedPatientId])

  return (
    <div>
      <Header title="Nutrición · Pacientes" />
      <DirectoryPageShell className={nutritionShellClass}>
        <NutritionPatientAreaHeader />
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
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                className={directoryToolbarBtnClassName}
                onClick={() => navigate('/nutrition/menus')}
              >
                <BookOpen className="h-4 w-4 opacity-70" aria-hidden />
                Menús estacionales
              </button>
              <button
                type="button"
                className={directoryToolbarBtnClassName}
                onClick={() => navigate('/nutrition/evolution')}
              >
                <LineChart className="h-4 w-4 opacity-70" aria-hidden />
                Evolución
              </button>
              <Button
                type="button"
                size="sm"
                variant="gradientSecondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setNewPatientOpen(true)}
              >
                Nuevo paciente
              </Button>
            </div>
          </div>
        </PageToolbar>

        <div className="flex flex-wrap gap-1.5">
          {PATIENT_FILTERS.map((f) => (
            <FilterChip
              key={f.id}
              active={activeFilter === f.id}
              count={filterCounts[f.id]}
              icon={f.icon}
              label={f.label}
              onClick={() => setActiveFilter(f.id)}
            />
          ))}
        </div>

        <StudentDeletionHistoryPanel
          entityLabel="Pacientes"
          entityLabelSingular="paciente"
          onRestored={() => setReloadToken((t) => t + 1)}
        />

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[2rem] border border-surface-border bg-surface-card p-5">
                <TableSkeleton rows={4} cols={1} />
              </div>
            ))}
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
              title={search ? `Sin resultados para "${search}"` : 'Sin pacientes en este filtro'}
              description="Probá con otro nombre, cambiá el filtro o limpiá el buscador."
            />
          )
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-sm font-semibold text-ink-primary">
                Pacientes <span className="font-normal text-ink-muted">· {filteredRows.length}</span>
              </h2>
            </div>
            <NutritionPatientCards
              rows={filteredRows}
              selectedPatientId={selectedPatientId}
              nextConsultLabel={formatNextConsult}
              onOpen={setSelectedPatientId}
              onUpdateFollowup={updateFollowup}
              onAvatarChange={handleAvatarChange}
            />
          </div>
        )}
      </DirectoryPageShell>

      {selectedPatientId ? (
        <>
          <button
            type="button"
            aria-label="Cerrar carpeta del paciente"
            className={cn(
              'fixed inset-0 z-[9990] bg-black/30 backdrop-blur-[3px] dark:bg-black/55',
              'motion-reduce:animate-none motion-safe:animate-backdrop-soft',
            )}
            onClick={() => setSelectedPatientId(null)}
          />
          <div
            ref={patientPanelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal
            aria-labelledby="nutrition-patient-sheet-title"
            className={cn(
              'fixed z-[9991] flex flex-col overflow-hidden border border-surface-border/85 bg-surface-panel shadow-lg dark:bg-surface-panel dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)]',
              'rounded-2xl motion-reduce:animate-none motion-safe:max-sm:animate-none motion-safe:sm:animate-panel-slide-in',
              'inset-2 h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-auto',
              'sm:inset-3 sm:h-[calc(100dvh-1.5rem)]',
              'md:inset-4 md:h-[calc(100dvh-2rem)]',
              'lg:inset-5 lg:h-[calc(100dvh-2.5rem)]',
              'xl:inset-6 xl:h-[calc(100dvh-3rem)]',
            )}
          >
            <NutritionPatientDetailView
              key={selectedPatientId}
              patientId={selectedPatientId}
              variant="panel"
              onClosePanel={() => setSelectedPatientId(null)}
            />
          </div>
        </>
      ) : null}

      <NewStudentModal
        open={newPatientOpen}
        title="Nuevo paciente"
        onClose={() => setNewPatientOpen(false)}
        onCreated={(id) => {
          setNewPatientOpen(false)
          setSelectedPatientId(id)
        }}
      />
    </div>
  )
}
