import { useEffect, useMemo, useState } from 'react'
import { onTabListKeyDown } from '@/lib/tabKeyboard'
import { ChevronRight, Search } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { Header } from '@/components/layout/Header'
import { DirectoryPageShell } from '@/components/directory/DirectoryPageShell'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { Spinner } from '@/components/ui/Spinner'
import { AnthropometryReportDropZone } from '@/components/nutrition/AnthropometryReportDropZone'
import { Delta, nf } from '@/components/nutrition/NutritionResumenDashboardV2'
import { fetchAccessibleStudents } from '@/lib/students/studentAccess'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useAppNavigate } from '@/hooks/useAppNavigate'
import { matchPatientByName } from '@/lib/nutrition/anthropometryReportImport'
import { weightOf } from '@/lib/nutrition/measurementDerivatives'
import { NUTRITION_CONTROL_OVERDUE_DAYS } from '@/lib/dashboard/nutritionistOps'
import { nutritionInputClass } from '@/lib/nutrition/nutritionAreaUi'
import { cn } from '@/lib/utils'
import type { NutritionMeasurement, Student } from '@/types/database'

/**
 * Antropometría v2: sólo el listado de pacientes con el estado de sus controles y la zona para
 * arrastrar el informe. Todo lo demás (cargar, ver, comparar, IA) vive en la ficha del paciente.
 */

type Filter = 'all' | 'overdue' | 'none'

interface Row {
  student: Student
  count: number
  last: string | null
  days: number | null
  weight: number | null
  weightDelta: number | null
  status: 'ok' | 'overdue' | 'none'
}

const STATUS = {
  ok: { label: 'Al día', cls: 'bg-surface-elevated text-ink-secondary' },
  overdue: { label: 'Atrasado', cls: 'bg-status-expired/10 text-status-expired' },
  none: { label: 'Sin controles', cls: 'bg-surface-elevated text-ink-muted' },
} as const

function ago(days: number) {
  if (days < 1) return 'hoy'
  if (days < 14) return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  if (days < 90) return `hace ${Math.round(days / 7)} semanas`
  return `hace ${Math.round(days / 30.4)} meses`
}

export function NutritionAnthropometryHubV2() {
  const { user } = useAuthStore()
  const navigate = useAppNavigate()
  const [students, setStudents] = useState<Student[]>([])
  const [measurements, setMeasurements] = useState<NutritionMeasurement[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      setLoading(true)
      const [st, ms] = await Promise.all([
        fetchAccessibleStudents(),
        supabase
          .from('nutrition_measurements')
          .select('id, student_id, measured_at, weight_kg, detail')
          .eq('owner_id', user.id)
          .order('measured_at', { ascending: false })
          .limit(2000),
      ])
      if (!alive) return
      if (st.error) toast.error(st.error)
      if (ms.error) toast.error(ms.error.message)
      setStudents(st.data)
      setMeasurements((ms.data as NutritionMeasurement[] | null) ?? [])
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [user])

  const rows = useMemo<Row[]>(() => {
    const by = new Map<string, NutritionMeasurement[]>()
    for (const m of measurements) {
      const list = by.get(m.student_id) ?? []
      list.push(m)
      by.set(m.student_id, list)
    }
    return students.map((student) => {
      const list = [...(by.get(student.id) ?? [])].sort((a, b) => b.measured_at.localeCompare(a.measured_at))
      const last = list[0] ?? null
      const weighed = list.filter((m) => weightOf(m) != null)
      const w0 = weighed[0] ? weightOf(weighed[0]) : null
      const w1 = weighed[1] ? weightOf(weighed[1]) : null
      const days = last ? Math.max(0, Math.round((Date.now() - parseISO(last.measured_at).getTime()) / 86_400_000)) : null
      return {
        student,
        count: list.length,
        last: last?.measured_at ?? null,
        days,
        weight: w0,
        weightDelta: w0 != null && w1 != null ? w0 - w1 : null,
        status: !last ? 'none' : days! > NUTRITION_CONTROL_OVERDUE_DAYS ? 'overdue' : 'ok',
      }
    })
  }, [students, measurements])

  const counts = useMemo(
    () => ({ all: rows.length, overdue: rows.filter((r) => r.status === 'overdue').length, none: rows.filter((r) => r.status === 'none').length }),
    [rows],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const order = { overdue: 0, none: 1, ok: 2 }
    return rows
      .filter((r) => (filter === 'all' ? true : r.status === filter))
      .filter((r) => !q || r.student.full_name.toLowerCase().includes(q))
      .sort((a, b) => order[a.status] - order[b.status] || (b.days ?? -1) - (a.days ?? -1) || a.student.full_name.localeCompare(b.student.full_name))
  }, [rows, filter, query])

  const open = (id: string, file?: File) =>
    navigate(`/nutrition/${id}?tab=antropometria`, file ? { state: { importFile: file } } : undefined)

  async function handleReport(file: File) {
    setError(null)
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      setError(`"${file.name}" no es un PDF. Arrastrá el informe de composición corporal en PDF.`)
      return
    }
    setBusy(true)
    try {
      const { readAnthropometryReportPdf } = await import('@/lib/nutrition/anthropometryReportPdf')
      const r = await readAnthropometryReportPdf(file)
      if (Object.keys(r.values).length < 3) {
        setError(`"${file.name}" no tiene el formato del informe de composición corporal: no encontré las medidas (peso, perímetros, pliegues).`)
        return
      }
      const target = r.patientName ? matchPatientByName(r.patientName, students) : null
      if (!target) {
        setError(
          r.patientName
            ? `El informe es de ${r.patientName} y no lo encontré (o hay más de un paciente con ese nombre). Abrí su ficha desde la lista y arrastralo ahí.`
            : 'El informe no trae el nombre del paciente. Abrí su ficha desde la lista y arrastralo ahí.',
        )
        return
      }
      open(target.id, file)
    } catch {
      setError(`No pude leer "${file.name}". Puede estar dañado o protegido con contraseña.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <Header title="Antropometría" />
      <DirectoryPageShell className="space-y-4">
        <AnthropometryReportDropZone
          busy={busy}
          onFile={(f) => void handleReport(f)}
          error={error}
          title="Cargar un control desde el informe PDF"
          hint="Arrastralo acá: busco al paciente por el nombre del informe y abro su ficha con las medidas cargadas para revisar y guardar."
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente…"
              className={cn(nutritionInputClass, 'h-9 w-full pl-9 pr-3 text-sm')}
            />
          </div>
          <div className="flex gap-1.5" role="tablist" onKeyDown={onTabListKeyDown} aria-label="Filtrar pacientes">
            {(
              [
                ['all', 'Todos'],
                ['overdue', 'Atrasados'],
                ['none', 'Sin controles'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={filter === k}
                tabIndex={filter === k ? 0 : -1}
                onClick={() => setFilter(k)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                  filter === k ? 'bg-ink-primary text-surface-base' : 'bg-surface-elevated text-ink-secondary hover:text-ink-primary',
                )}
              >
                {label}
                <span className={cn('tabular-nums', filter === k ? 'opacity-70' : 'text-ink-muted')}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card">
          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-ink-muted">
              {query ? 'Sin resultados.' : filter === 'overdue' ? 'Nadie atrasado: todos tienen un control reciente.' : 'No hay pacientes en esta lista.'}
            </p>
          ) : (
            <ul className="divide-y divide-surface-border/60">
              <li className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem_1.25rem] gap-3 px-4 py-2 text-3xs font-semibold text-ink-muted md:grid">
                <span>Paciente</span>
                <span>Último control</span>
                <span className="text-right">Peso</span>
                <span>Estado</span>
                <span />
              </li>
              {visible.map((r) => (
                <li key={r.student.id}>
                  <button
                    type="button"
                    onClick={() => open(r.student.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-surface-elevated/40 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1fr)_7rem_1.25rem]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <StudentAvatar
                        studentId={r.student.id}
                        fullName={r.student.full_name}
                        avatarPath={r.student.avatar_path}
                        size="sm"
                        stopRowNavigation
                        onPathChange={() => {}}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink-primary">{r.student.full_name}</span>
                        <span className="block text-2xs text-ink-muted md:hidden">
                          {r.last ? `${format(parseISO(r.last), 'd MMM yy', { locale: es })} · ${ago(r.days!)}` : 'Sin controles'}
                        </span>
                      </span>
                    </span>
                    <span className="hidden min-w-0 text-xs text-ink-secondary md:block">
                      {r.last ? (
                        <>
                          {format(parseISO(r.last), "d 'de' MMM yyyy", { locale: es })}
                          <span className="block text-2xs text-ink-muted">
                            {ago(r.days!)} · {r.count} {r.count === 1 ? 'control' : 'controles'}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </span>
                    <span className="hidden text-right text-xs tabular-nums md:block">
                      {r.weight != null ? (
                        <>
                          <span className="font-semibold text-ink-primary">{nf(r.weight)} kg</span>
                          {r.weightDelta != null ? (
                            <span className="block text-2xs">
                              <Delta value={r.weightDelta} unit="kg" dir="neutral" />
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-3xs font-semibold', STATUS[r.status].cls)}>
                        {STATUS[r.status].label}
                      </span>
                    </span>
                    <ChevronRight className="hidden h-4 w-4 text-ink-muted md:block" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="px-1 text-2xs text-ink-muted">
          "Atrasado": más de {Math.round(NUTRITION_CONTROL_OVERDUE_DAYS / 7)} semanas desde el último control. Tocá un paciente para ver y cargar sus controles.
        </p>
      </DirectoryPageShell>
    </div>
  )
}
