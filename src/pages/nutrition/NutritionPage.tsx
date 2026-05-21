import { useEffect, useMemo, useState } from 'react'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import { BookOpen, LineChart, Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
import { DirectoryStatGrid } from '@/components/directory/DirectoryStatGrid'
import { DirectoryTableShell } from '@/components/directory/DirectoryTableShell'
import {
  formatNextConsult,
  NutritionPatientDesktopTable,
  NutritionPatientMobileList,
  type NutritionFollowupRow,
} from '@/components/nutrition/NutritionPatientDirectory'
import type { NutritionPatientFollowup } from '@/types/database'
import toast from 'react-hot-toast'

export function NutritionPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<NutritionFollowupRow[]>([])
  const [newPatientOpen, setNewPatientOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: students, error: studentsError }, { data: followups, error: followupsError }] =
        await Promise.all([
          fetchAccessibleStudents(),
          supabase.from('nutrition_patient_followups').select('*').eq('owner_id', user.id),
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
  }, [user, reloadToken])

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
      prev.map((r) => (r.id === studentId ? { ...r, followup: data as NutritionPatientFollowup } : r)),
    )
  }

  function handleAvatarChange(studentId: string, avatarPath: string | null) {
    setRows((prev) => prev.map((r) => (r.id === studentId ? { ...r, avatar_path: avatarPath } : r)))
  }

  return (
    <div>
      <Header title="Nutrición · Pacientes" />
      <DirectoryPageShell>
        <DirectoryStatGrid
          items={[
            { label: 'Pacientes', value: stats.total, kpiFigmaIcon: 'patients', iconVariant: '3d', tone: 'neutral' },
            {
              label: 'Próx. 7 días',
              value: stats.upcomingWeek,
              kpiFigmaIcon: 'calendar',
              iconVariant: '3d',
              tone: 'neutral',
            },
            {
              label: 'Atrasados',
              value: stats.overdue,
              kpiFigmaIcon: 'overdue',
              iconVariant: '3d',
              tone: 'neutral',
            },
            {
              label: 'Asistieron (último)',
              value: stats.attended,
              kpiFigmaIcon: 'attended',
              iconVariant: '3d',
              tone: 'neutral',
            },
          ]}
        />

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

        <StudentDeletionHistoryPanel
          entityLabel="Pacientes"
          entityLabelSingular="paciente"
          onRestored={() => setReloadToken((t) => t + 1)}
        />

        {loading ? (
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-card p-4">
            <TableSkeleton rows={6} cols={5} />
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
          <DirectoryTableShell title="Pacientes" count={filteredRows.length}>
            <NutritionPatientMobileList
              rows={filteredRows}
              nextConsultLabel={formatNextConsult}
              onOpen={(id) => navigate(`/nutrition/${id}`)}
              onUpdateFollowup={updateFollowup}
              onAvatarChange={handleAvatarChange}
            />
            <NutritionPatientDesktopTable
              rows={filteredRows}
              nextConsultLabel={formatNextConsult}
              onOpen={(id) => navigate(`/nutrition/${id}`)}
              onUpdateFollowup={updateFollowup}
              onAvatarChange={handleAvatarChange}
            />
          </DirectoryTableShell>
        )}
      </DirectoryPageShell>

      <NewStudentModal
        open={newPatientOpen}
        title="Nuevo paciente"
        onClose={() => setNewPatientOpen(false)}
        onCreated={(id) => navigate(`/nutrition/${id}`)}
      />
    </div>
  )
}
