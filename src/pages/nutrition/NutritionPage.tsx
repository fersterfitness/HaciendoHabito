import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import {
  AlarmClock,
  BookOpen,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  FolderOpen,
  MoreHorizontal,
  Archive,
  Plus,
  Search,
  Users,
  X,
  type LucideIcon,
  LayoutGrid,
  List,
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
import { NutritionPatientGridV2 } from '@/components/nutrition/NutritionPatientGridV2'
import { nutritionShellClass } from '@/lib/nutrition/nutritionAreaUi'
import {
  formatNextConsult,
  NutritionPatientCards,
  type NutritionFollowupRow,
} from '@/components/nutrition/NutritionPatientDirectory'
import { NutritionPatientTable, NutritionPatientTableSkeleton } from '@/components/nutrition/NutritionPatientTable'
import { NutritionAttentionPanel } from '@/components/nutrition/NutritionAttentionPanel'
import { NutritionPatientDetailView } from '@/pages/nutrition/NutritionPatientDetailPage'
import { cn } from '@/lib/utils'
import { IS_V2 } from '@/lib/uiVersion'
import { v2TabClass, v2TabCountClass } from '@/components/v2/tabStyle'
import { Popover } from '@/components/ui/Popover'
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
      className={IS_V2 ? v2TabClass(active, 'sm') : cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand-tertiary bg-brand-tertiary/10 text-brand-tertiary'
          : 'border-surface-border/70 text-ink-muted hover:border-surface-border hover:text-ink-secondary',
      )}
    >
      {IS_V2 ? null : <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
      {label}
      <span
        className={IS_V2 ? v2TabCountClass(active) : cn(
          'ml-0.5 rounded-full px-1.5 text-3xs tabular-nums',
          active ? 'bg-brand-tertiary/15 text-brand-tertiary' : 'bg-surface-elevated text-ink-muted',
        )}
      >
        {count}
      </span>
    </button>
  )
}

function PatientsMoreMenu({ onMenus, showDeleted, onToggleDeleted }: { onMenus: () => void; showDeleted: boolean; onToggleDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const item = 'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-primary transition-colors hover:bg-surface-elevated'
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="end"
      className="w-52 p-1"
      trigger={({ ref, onClick, ...a11y }) => (
        <button ref={ref} type="button" onClick={onClick} className={directoryToolbarBtnClassName} title="Más acciones" aria-label="Más acciones" {...a11y}>
          <MoreHorizontal className="h-4 w-4 opacity-70" aria-hidden />
        </button>
      )}
    >
      <button type="button" className={item} onClick={() => { setOpen(false); onMenus() }}>
        <BookOpen className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        Menús estacionales
      </button>
      <button type="button" className={item} onClick={() => { setOpen(false); onToggleDeleted() }}>
        <Archive className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
        {showDeleted ? 'Ocultar eliminados' : 'Ver eliminados'}
      </button>
    </Popover>
  )
}

export function NutritionPage() {
  const [showDeletedV2, setShowDeletedV2] = useState(false)
  // v2: tarjetas o tabla; se recuerda en este navegador.
  const [patientsView, setPatientsView] = useState<'cards' | 'table'>(() => {
    try {
      return localStorage.getItem('hh-patients-view') === 'table' ? 'table' : 'cards'
    } catch {
      return 'cards'
    }
  })
  function changePatientsView(next: 'cards' | 'table') {
    setPatientsView(next)
    try {
      localStorage.setItem('hh-patients-view', next)
    } catch {
      /* sin almacenamiento: vale solo para esta visita */
    }
  }
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<PatientFilter>('all')
  const [rows, setRows] = useState<NutritionFollowupRow[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [newPatientOpen, setNewPatientOpen] = useState(() => IS_V2 && searchParams.get('nuevo') === '1')
  useEffect(() => {
    if (searchParams.get('nuevo') == null) return
    const next = new URLSearchParams(searchParams)
    next.delete('nuevo')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])
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
        { data: controls },
      ] = await Promise.all([
        fetchAccessibleStudents(),
        supabase.from('nutrition_patient_followups').select('*').eq('owner_id', user.id),
        supabase.from('web_plans').select('slug, title'),
        // Para la tabla de la v2: fecha y peso de los controles (hasta 8 por paciente, para la tendencia).
        IS_V2
          ? supabase
              .from('nutrition_measurements')
              .select('student_id, measured_at, weight_kg')
              .eq('owner_id', user.id)
              .order('measured_at', { ascending: false })
              .limit(3000)
          : Promise.resolve({ data: null }),
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
      const controlsByStudent = new Map<string, { measured_at: string; weight_kg: number | null }[]>()
      const controlRows = [...((controls ?? []) as { student_id: string; measured_at: string; weight_kg: number | null }[])].sort((x, y) =>
        y.measured_at.localeCompare(x.measured_at),
      )
      for (const c of controlRows) {
        const list = controlsByStudent.get(c.student_id) ?? []
        if (list.length < 8) list.push(c)
        controlsByStudent.set(c.student_id, list)
      }
      const merged = (students ?? []).map((s) => {
        const list = controlsByStudent.get(s.id) ?? []
        const [last, prev] = list
        return {
          ...s,
          followup: followupsByStudent.get(s.id),
          selectedWebPlanLabel: labelForSelectedWebPlanSlug(s.selected_web_plan_slug, webPlanTitlesBySlug),
          lastControl: last
            ? {
                date: last.measured_at,
                weight: last.weight_kg,
                weightDelta: last.weight_kg != null && prev?.weight_kg != null ? Math.round((last.weight_kg - prev.weight_kg) * 10) / 10 : null,
                weights: list.map((c) => c.weight_kg).filter((w): w is number => w != null).reverse(),
              }
            : undefined,
        }
      })
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
      <Header
        title={IS_V2 ? 'Pacientes' : 'Nutrición · Pacientes'}
        actions={
          IS_V2 ? (
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setNewPatientOpen(true)}>
              Nuevo paciente
            </Button>
          ) : undefined
        }
      />
      <DirectoryPageShell className={nutritionShellClass}>
        {IS_V2 ? null : <NutritionPatientAreaHeader />}
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
              {IS_V2 ? null : (
              <button
                type="button"
                className={directoryToolbarBtnClassName}
                onClick={() => navigate('/nutrition/menus')}
              >
                <BookOpen className="h-4 w-4 opacity-70" aria-hidden />
                Menús estacionales
              </button>
              )}
              {IS_V2 ? (
                <PatientsMoreMenu onMenus={() => navigate('/nutrition/menus')} showDeleted={showDeletedV2} onToggleDeleted={() => setShowDeletedV2((v) => !v)} />
              ) : (
              <Button
                type="button"
                size="sm"
                variant="gradientSecondary"
                icon={<Plus className="h-4 w-4" />}
                onClick={() => setNewPatientOpen(true)}
              >
                Nuevo paciente
              </Button>
              )}
            </div>
          </div>
        </PageToolbar>

        {IS_V2 && user && !loading ? <NutritionAttentionPanel ownerId={user.id} rows={rows} onOpen={setSelectedPatientId} /> : null}

        <div className={IS_V2 ? 'flex items-center justify-between gap-3' : undefined}>
        <div className={IS_V2 ? '-mx-4 flex min-w-0 gap-1.5 overflow-x-auto px-4 scrollbar-hide sm:mx-0 sm:flex-wrap sm:px-0' : 'flex flex-wrap gap-1.5'}>
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
        {IS_V2 ? (
          <div className="hidden shrink-0 gap-1 sm:inline-flex" role="group" aria-label="Vista">
            <Button type="button" size="iconSm" variant={patientsView === 'cards' ? 'secondary' : 'ghost'} aria-label="Ver en tarjetas" aria-pressed={patientsView === 'cards'} onClick={() => changePatientsView('cards')}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button type="button" size="iconSm" variant={patientsView === 'table' ? 'secondary' : 'ghost'} aria-label="Ver en tabla" aria-pressed={patientsView === 'table'} onClick={() => changePatientsView('table')}>
              <List className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        </div>

        <StudentDeletionHistoryPanel
          entityLabel="Pacientes"
          entityLabelSingular="paciente"
          onRestored={() => setReloadToken((t) => t + 1)}
          controlledOpen={IS_V2 ? showDeletedV2 : undefined}
        />

        {loading && IS_V2 ? (
          <NutritionPatientTableSkeleton />
        ) : loading ? (
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
            <div className={cn('flex items-center justify-between px-0.5', IS_V2 && 'hidden')}>
              <h2 className="text-sm font-semibold text-ink-primary">
                Pacientes <span className="font-normal text-ink-muted">· {filteredRows.length}</span>
              </h2>
            </div>
            {IS_V2 && patientsView === 'cards' ? (
              <div className="max-sm:hidden">
                <NutritionPatientGridV2 rows={filteredRows} selectedPatientId={selectedPatientId} onOpen={setSelectedPatientId} onAvatarChange={handleAvatarChange} />
              </div>
            ) : IS_V2 ? (
              <NutritionPatientTable
                className="max-sm:hidden"
                rows={filteredRows}
                selectedPatientId={selectedPatientId}
                onOpen={setSelectedPatientId}
                onUpdateFollowup={updateFollowup}
                onAvatarChange={handleAvatarChange}
              />
            ) : null}
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
