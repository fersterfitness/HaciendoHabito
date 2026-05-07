import { useEffect, useMemo, useState } from 'react'
import {} from 'react-router-dom'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Search, FolderOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageToolbar } from '@/components/ui/PageToolbar'
import type { Student, NutritionPatientFollowup, NutritionAttendanceStatus } from '@/types/database'
import toast from 'react-hot-toast'

type FollowupRow = Student & {
  followup?: NutritionPatientFollowup
}

const STATUS_OPTIONS: NutritionAttendanceStatus[] = ['P', 'A', 'ST']

function formatNextConsultation(value: string | null) {
  if (!value) return '—'
  const label = format(parseISO(value), "EEEE dd/MM/yyyy", { locale: es })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function NutritionPage() {
  const navigate = useAppNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<FollowupRow[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      const [{ data: students, error: studentsError }, { data: followups, error: followupsError }] = await Promise.all([
        supabase
          .from('students')
          .select('*')
          .eq('owner_id', user.id)
          .order('full_name'),
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
      const merged = ((students as Student[]) ?? []).map((s) => ({
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
        <PageToolbar>
          <div className="w-full max-w-lg">
            <Input
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </PageToolbar>

        {loading ? (
          <div className="flex justify-center py-14">
            <Spinner size="lg" />
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-8 w-8" />}
            title="No hay pacientes cargados"
            description="Creá un alumno para comenzar a organizar su carpeta nutricional."
          />
        ) : (
          <div className="w-full overflow-x-auto rounded-2xl border border-surface-border bg-surface-card">
            <table className="w-full text-sm border-collapse min-w-[860px]">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">Paciente</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">Última consulta</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">Próxima consulta</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">Día automático</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={index < filteredRows.length - 1 ? 'border-b border-surface-border' : ''}
                  >
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => navigate(`/nutrition/${row.id}`)}
                        className="font-semibold text-ink-primary hover:text-brand-primary transition-colors"
                      >
                        {row.full_name}
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="date"
                        value={row.followup?.last_consultation_date ?? ''}
                        onChange={(e) => updateFollowup(row.id, { last_consultation_date: e.target.value || null })}
                        className="w-full bg-surface-elevated text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none"
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <input
                        type="date"
                        value={row.followup?.next_consultation_date ?? ''}
                        onChange={(e) => updateFollowup(row.id, { next_consultation_date: e.target.value || null })}
                        className="w-full bg-surface-elevated text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none"
                      />
                    </td>
                    <td className="px-4 py-3.5 text-ink-secondary font-medium">
                      {formatNextConsultation(row.followup?.next_consultation_date ?? null)}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={row.followup?.attendance_status ?? 'ST'}
                        onChange={(e) => updateFollowup(row.id, { attendance_status: e.target.value as NutritionAttendanceStatus })}
                        className="bg-surface-elevated text-ink-primary rounded-lg px-2.5 py-1.5 border border-surface-border focus:border-brand-primary outline-none"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
