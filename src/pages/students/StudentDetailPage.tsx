import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Pencil, Trash2, Dumbbell, FileText, Plus,
  Mail, Phone, Calendar, Zap, X, ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStudents } from '@/hooks/useStudents'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { cn, formatDate, daysUntil } from '@/lib/utils'
import { CicloTab } from './CicloTab'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { StudentNotesCard } from '@/components/students/StudentNotesCard'
import type { Student, Routine, Exercise, StudentRmRecord, FersterIntakeStored } from '@/types/database'
import toast from 'react-hot-toast'

type Tab = 'resumen' | 'fuerza' | 'ciclo'

// ─── Epley formula ────────────────────────────────────────────────────────────
function epley1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// ─── RM percentages table ─────────────────────────────────────────────────────
const RM_PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

function fersterTrainingSinceLabel(v: string): string {
  const m: Record<string, string> = {
    never: 'No entrenaba',
    less_than_1y: 'Hace menos de 1 año',
    '1_to_3y': 'Entre 1 y 3 años',
    more_than_3y: 'Más de 3 años',
  }
  return m[v] ?? v
}

function fersterLifestyleLabel(v: string): string {
  const m: Record<string, string> = {
    sedentary: 'Sedentario',
    light: 'Poco activo',
    active: 'Activo',
    very_active: 'Muy activo',
  }
  return m[v] ?? v
}

function fersterIntensityLabel(v: string): string {
  const m: Record<string, string> = {
    light: 'Liviano',
    moderate: 'Moderado',
    intense: 'Intenso',
    very_intense: 'Muy intenso',
  }
  return m[v] ?? v
}

function fersterSessionLabel(v: string): string {
  const m: Record<string, string> = {
    '30': '30 minutos',
    '60': '1 hora',
    '90': '1,5 horas',
    '120_plus': '2 horas o más',
  }
  return m[v] ?? v
}

function fersterEquipmentLabel(v: string): string {
  const m: Record<string, string> = {
    none: 'Sin equipo',
    home: 'Equipo en casa',
    gym_basic: 'Gimnasio básico',
    gym_advanced: 'Gimnasio avanzado',
  }
  return m[v] ?? v
}

function fersterGoalLabel(v: string): string {
  const m: Record<string, string> = {
    healthy_life: 'Vida saludable',
    sport: 'Mejorar en mi deporte',
    cut_lean: 'Descenso de peso y ganancia magra',
    bulk: 'Aumento de masa muscular',
  }
  return m[v] ?? v
}

function fersterMealsLabel(v: string): string {
  const m: Record<string, string> = { yes: 'Sí', no: 'No', rarely: 'Con poca frecuencia' }
  return m[v] ?? v
}

function fersterSleepLabel(v: string): string {
  const m: Record<string, string> = {
    lt5: 'Menos de 5 h',
    '5_6': '5 a 6 h',
    '6_7': '6 a 7 h',
    '8_plus': '8 h o más',
  }
  return m[v] ?? v
}

function FersterIntakeSection({ student }: { student: Student }) {
  const intake = student.intake_ferster as FersterIntakeStored | null | undefined
  const hasExtra =
    student.document_id ||
    student.address ||
    student.weight_kg != null ||
    student.height_cm != null ||
    (intake && Object.keys(intake).length > 0)
  if (!hasExtra) return null

  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const uploads = intake?.uploads
    if (!uploads || Object.keys(uploads).length === 0) {
      setFileUrls({})
      return
    }
    let cancelled = false
    ;(async () => {
      const next: Record<string, string> = {}
      for (const [key, path] of Object.entries(uploads)) {
        const { data, error } = await supabase.storage.from('student-intake').createSignedUrl(path, 3600)
        if (!error && data?.signedUrl) next[key] = data.signedUrl
      }
      if (!cancelled) setFileUrls(next)
    })()
    return () => {
      cancelled = true
    }
  }, [student.id, intake?.uploads])

  return (
    <Card>
      <CardTitle className="text-sm mb-3">Registro web (Ferster /form)</CardTitle>
      <dl className="grid gap-2 text-sm">
        {student.document_id ? (
          <>
            <dt className="text-ink-muted text-xs">Documento</dt>
            <dd className="text-ink-primary">{student.document_id}</dd>
          </>
        ) : null}
        {student.address ? (
          <>
            <dt className="text-ink-muted text-xs">Dirección</dt>
            <dd className="text-ink-primary whitespace-pre-wrap">{student.address}</dd>
          </>
        ) : null}
        {student.weight_kg != null ? (
          <>
            <dt className="text-ink-muted text-xs">Peso</dt>
            <dd className="text-ink-primary">{student.weight_kg} kg</dd>
          </>
        ) : null}
        {student.height_cm != null ? (
          <>
            <dt className="text-ink-muted text-xs">Altura</dt>
            <dd className="text-ink-primary">{student.height_cm} cm</dd>
          </>
        ) : null}
        {intake?.training_since ? (
          <>
            <dt className="text-ink-muted text-xs">Antigüedad entrenando</dt>
            <dd className="text-ink-primary">{fersterTrainingSinceLabel(intake.training_since)}</dd>
          </>
        ) : null}
        {intake?.days_per_week != null ? (
          <>
            <dt className="text-ink-muted text-xs">Días por semana</dt>
            <dd className="text-ink-primary">{intake.days_per_week} x semana</dd>
          </>
        ) : null}
        {intake?.lifestyle ? (
          <>
            <dt className="text-ink-muted text-xs">Estilo de vida</dt>
            <dd className="text-ink-primary">{fersterLifestyleLabel(intake.lifestyle)}</dd>
          </>
        ) : null}
        {intake?.training_intensity ? (
          <>
            <dt className="text-ink-muted text-xs">Intensidad</dt>
            <dd className="text-ink-primary">{fersterIntensityLabel(intake.training_intensity)}</dd>
          </>
        ) : null}
        {intake?.session_duration ? (
          <>
            <dt className="text-ink-muted text-xs">Tiempo por sesión</dt>
            <dd className="text-ink-primary">{fersterSessionLabel(intake.session_duration)}</dd>
          </>
        ) : null}
        {intake?.equipment ? (
          <>
            <dt className="text-ink-muted text-xs">Equipo</dt>
            <dd className="text-ink-primary">{fersterEquipmentLabel(intake.equipment)}</dd>
          </>
        ) : null}
        {intake?.main_goal ? (
          <>
            <dt className="text-ink-muted text-xs">Objetivo principal</dt>
            <dd className="text-ink-primary">{fersterGoalLabel(intake.main_goal)}</dd>
          </>
        ) : null}
        {intake?.pathology ? (
          <>
            <dt className="text-ink-muted text-xs">Patología / medicación</dt>
            <dd className="text-ink-primary">
              {intake.pathology === 'yes' ? 'Sí' : 'No'}
              {intake.pathology_detail ? ` — ${intake.pathology_detail}` : ''}
            </dd>
          </>
        ) : null}
        {intake?.discomfort_exercises ? (
          <>
            <dt className="text-ink-muted text-xs">Ejercicios incómodos / no puede</dt>
            <dd className="text-ink-primary whitespace-pre-wrap">{intake.discomfort_exercises}</dd>
          </>
        ) : null}
        {intake?.four_meals ? (
          <>
            <dt className="text-ink-muted text-xs">4 comidas al día</dt>
            <dd className="text-ink-primary">{fersterMealsLabel(intake.four_meals)}</dd>
          </>
        ) : null}
        {intake?.sleep_hours ? (
          <>
            <dt className="text-ink-muted text-xs">Sueño habitual</dt>
            <dd className="text-ink-primary">{fersterSleepLabel(intake.sleep_hours)}</dd>
          </>
        ) : null}
        {intake?.supplements ? (
          <>
            <dt className="text-ink-muted text-xs">Suplementos</dt>
            <dd className="text-ink-primary">{intake.supplements === 'yes' ? 'Sí' : 'No'}</dd>
          </>
        ) : null}
        {intake?.gender_other ? (
          <>
            <dt className="text-ink-muted text-xs">Género (detalle)</dt>
            <dd className="text-ink-primary">{intake.gender_other}</dd>
          </>
        ) : null}
        {intake?.submitted_at ? (
          <>
            <dt className="text-ink-muted text-xs">Enviado</dt>
            <dd className="text-ink-primary">{formatDate(intake.submitted_at.slice(0, 10))}</dd>
          </>
        ) : null}
      </dl>
      {Object.keys(fileUrls).length > 0 ? (
        <div className="mt-4 pt-4 border-t border-surface-border">
          <p className="text-xs text-ink-muted mb-2">Archivos adjuntos (enlaces temporales)</p>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(fileUrls).map(([key, href]) => (
              <li key={key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-brand-primary hover:underline"
                >
                  {key.startsWith('progress_') ? `Foto ${key.replace('progress_', '')}` : key === 'profile' ? 'Foto perfil' : key === 'medical' ? 'Estudios médicos' : key}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function StudentDetailPage() {
  const { id }     = useParams<{ id: string }>()
  const navigate   = useNavigate()
  const { deleteStudent } = useStudents()
  const { user, profile }   = useAuthStore()
  const entitySingularCapitalized = profile?.role === 'nutritionist' ? 'Paciente' : 'Alumno'
  const entitySingular = profile?.role === 'nutritionist' ? 'paciente' : 'alumno'

  const [student,    setStudent]    = useState<Student | null>(null)
  const [routines,   setRoutines]   = useState<Routine[]>([])
  const [rmRecords,  setRmRecords]  = useState<StudentRmRecord[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [tab,        setTab]        = useState<Tab>('resumen')

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('students').select('*').eq('id', id).single(),
      supabase.from('routines').select('*').eq('student_id', id).order('created_at', { ascending: false }),
      supabase.from('student_rm_records')
        .select('*, exercise:exercise_library(id, name)')
        .eq('student_id', id)
        .order('tested_at', { ascending: false }),
    ]).then(([{ data: s }, { data: r }, { data: rm }]) => {
      setStudent(s)
      setRoutines(r ?? [])
      setRmRecords((rm as unknown as StudentRmRecord[]) ?? [])
    }).finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!id) return
    setDeleting(true)
    const ok = await deleteStudent(id)
    setDeleting(false)
    if (ok) navigate('/students')
  }

  async function addRmRecord(record: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) {
    if (!user || !id) return
    const { data, error } = await supabase
      .from('student_rm_records')
      .insert({ ...record, owner_id: user.id, student_id: id })
      .select('*, exercise:exercise_library(id, name)')
      .single()
    if (error) { toast.error(error.message); return }
    setRmRecords((prev) => [data as unknown as StudentRmRecord, ...prev])
    toast.success('RM registrado')
  }

  async function deleteRmRecord(recordId: string) {
    const { error } = await supabase.from('student_rm_records').delete().eq('id', recordId)
    if (error) { toast.error(error.message); return }
    setRmRecords((prev) => prev.filter((r) => r.id !== recordId))
  }

  if (loading) return <div><Header title={entitySingularCapitalized} showBack /><div className="flex justify-center py-16"><Spinner size="lg" /></div></div>
  if (!student) return <div><Header title={entitySingularCapitalized} showBack /><p className="p-6 text-ink-muted">{entitySingularCapitalized} no encontrado.</p></div>

  const activeRoutine = routines.find((r) => r.status === 'activa' || r.status === 'por_vencer')

  return (
    <div>
      <Header title={student.full_name} showBack />

      <div className="px-4 lg:px-6 py-4 space-y-4">

        {/* Perfil compacto: datos a la izquierda, foto grande a la derecha (o iniciales) */}
        <Card>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="flex-1 min-w-0 order-2 sm:order-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-ink-primary">{student.full_name}</h2>
                <Badge status={student.status} />
                <Badge status={student.level} />
              </div>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {student.email && (
                  <a href={`mailto:${student.email}`} className="flex items-center gap-1 text-xs text-ink-secondary hover:text-brand-primary transition-colors">
                    <Mail className="h-3 w-3" />{student.email}
                  </a>
                )}
                {student.phone && (
                  <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-xs text-ink-secondary hover:text-brand-primary transition-colors">
                    <Phone className="h-3 w-3" />{student.phone}
                  </a>
                )}
                {student.birth_date && (
                  <span className="flex items-center gap-1 text-xs text-ink-secondary">
                    <Calendar className="h-3 w-3" />{formatDate(student.birth_date)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-center sm:justify-end shrink-0 order-1 sm:order-2">
              <StudentAvatar
                studentId={student.id}
                fullName={student.full_name}
                avatarPath={student.avatar_path ?? null}
                size="lg"
                allowRemove
                onPathChange={(path) =>
                  setStudent((prev) => (prev ? { ...prev, avatar_path: path } : null))
                }
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border">
            <Button variant="secondary" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => navigate(`/students/${id}/edit`)}>
              Editar
            </Button>
            <div className="flex-1" />
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-status-expired transition-colors px-2 py-1.5 rounded-lg"
            >
              <Trash2 className="h-3.5 w-3.5" /> Eliminar
            </button>
          </div>
        </Card>

        <FersterIntakeSection student={student} />

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {([
            { value: 'resumen', label: 'Resumen' },
            { value: 'fuerza',  label: '💪 Fuerza / 1RM' },
            ...(student.gender === 'F' ? [{ value: 'ciclo' as Tab, label: '🌸 Ciclo' }] : []),
          ] as { value: Tab; label: string }[]).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-colors',
                tab === value
                  ? 'bg-surface-card text-ink-primary shadow-sm'
                  : 'text-ink-muted hover:text-ink-secondary',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Resumen tab ── */}
        {tab === 'resumen' && (
          <div className="space-y-4">
            {student.notes ? <StudentNotesCard notes={student.notes} /> : null}

            {activeRoutine && (
              <Card className="border-brand-primary/20">
                <CardHeader>
                  <div>
                    <p className="text-xs text-brand-primary font-medium uppercase tracking-wider mb-0.5">Rutina activa</p>
                    <CardTitle>{activeRoutine.name}</CardTitle>
                  </div>
                  <Badge status={activeRoutine.status} size="md" />
                </CardHeader>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-surface-elevated rounded-xl p-3">
                    <p className="text-xs text-ink-muted">Inicio</p>
                    <p className="text-sm font-semibold text-ink-primary">{formatDate(activeRoutine.start_date)}</p>
                  </div>
                  <div className="bg-surface-elevated rounded-xl p-3">
                    <p className="text-xs text-ink-muted">Vencimiento</p>
                    <p className="text-sm font-semibold text-ink-primary">{formatDate(activeRoutine.end_date)}</p>
                  </div>
                  <div className="bg-surface-elevated rounded-xl p-3">
                    <p className="text-xs text-ink-muted">Días restantes</p>
                    <p className={cn('text-sm font-semibold', daysUntil(activeRoutine.end_date) <= 7 ? 'text-status-expiring' : 'text-ink-primary')}>
                      {Math.max(0, daysUntil(activeRoutine.end_date))}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" size="sm" icon={<Dumbbell className="h-3.5 w-3.5" />} onClick={() => navigate(`/routines/${activeRoutine.id}`)} className="flex-1">
                    Ver rutina
                  </Button>
                  <Button variant="secondary" size="sm" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => navigate('/routine-pdfs')} className="flex-1">
                    Ver PDF
                  </Button>
                </div>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Historial de rutinas</CardTitle>
                <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => navigate(`/routines/new?student=${id}`)}>
                  Nueva
                </Button>
              </CardHeader>
              {routines.length === 0 ? (
                <EmptyState icon={<Dumbbell className="h-6 w-6" />} title="Sin rutinas" description={`Este ${entitySingular} todavía no tiene rutinas registradas.`} />
              ) : (
                <div className="space-y-2">
                  {routines.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/routines/${r.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">{r.name}</p>
                        <p className="text-xs text-ink-muted">{formatDate(r.start_date)} → {formatDate(r.end_date)}</p>
                      </div>
                      <Badge status={r.status} />
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── Ciclo Menstrual tab ── */}
        {tab === 'ciclo' && <CicloTab studentId={id!} />}

        {/* ── Fuerza / 1RM tab ── */}
        {tab === 'fuerza' && (
          <FuerzaTab
            studentId={id!}
            records={rmRecords}
            onAdd={addRmRecord}
            onDelete={deleteRmRecord}
          />
        )}
      </div>

      <ConfirmDialog
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title={`¿Eliminar ${entitySingular}?`}
        description="Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        loading={deleting}
      />
    </div>
  )
}

// ─── FuerzaTab ────────────────────────────────────────────────────────────────

function FuerzaTab({
  studentId,
  records,
  onAdd,
  onDelete,
}: {
  studentId: string
  records: StudentRmRecord[]
  onAdd: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  // Latest RM per exercise
  const latestByExercise = useMemo(() => {
    const map = new Map<string, StudentRmRecord>()
    for (const r of records) {
      if (!map.has(r.exercise_id)) map.set(r.exercise_id, r)
    }
    return Array.from(map.values())
  }, [records])

  const [showAddForm,    setShowAddForm]    = useState(false)
  const [calcExerciseId, setCalcExerciseId] = useState('')
  const [calcPercent,    setCalcPercent]    = useState(80)
  const [showHistory,    setShowHistory]    = useState<string | null>(null)

  const calcRecord  = latestByExercise.find((r) => r.exercise_id === calcExerciseId)
  const calcWeight  = calcRecord ? Math.round(calcRecord.rm_kg * (calcPercent / 100) * 10) / 10 : null

  return (
    <div className="space-y-4">

      {/* ── Calculadora de % ── */}
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-brand-primary" />
          <CardTitle className="text-sm">Calculadora de porcentaje</CardTitle>
        </div>

        {latestByExercise.length === 0 ? (
          <p className="text-xs text-ink-muted">Registrá el 1RM de al menos un ejercicio para usar la calculadora.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Ejercicio</label>
              <select
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                value={calcExerciseId}
                onChange={(e) => setCalcExerciseId(e.target.value)}
              >
                <option value="">Seleccioná un ejercicio...</option>
                {latestByExercise.map((r) => (
                  <option key={r.exercise_id} value={r.exercise_id}>
                    {r.exercise?.name ?? r.exercise_id} — 1RM: {r.rm_kg} kg
                  </option>
                ))}
              </select>
            </div>

            {calcRecord && (
              <>
                <div>
                  <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">
                    Porcentaje: {calcPercent}%
                  </label>
                  <input
                    type="range" min={50} max={100} step={5}
                    value={calcPercent}
                    onChange={(e) => setCalcPercent(Number(e.target.value))}
                    className="w-full accent-brand-primary"
                  />
                </div>

                {/* Resultado destacado */}
                <div className="flex items-center justify-between bg-brand-primary/10 border border-brand-primary/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] text-brand-primary uppercase tracking-wide font-semibold">Peso estimado</p>
                    <p className="text-2xl font-bold text-brand-primary">{calcWeight} kg</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-ink-muted">1RM base</p>
                    <p className="text-sm font-semibold text-ink-primary">{calcRecord.rm_kg} kg</p>
                    <p className="text-[10px] text-ink-muted mt-1">al {calcPercent}%</p>
                  </div>
                </div>

                {/* Tabla completa de porcentajes */}
                <div className="grid grid-cols-3 gap-1.5">
                  {RM_PERCENTS.map((pct) => {
                    const w = Math.round(calcRecord.rm_kg * (pct / 100) * 10) / 10
                    const isSelected = pct === calcPercent
                    return (
                      <button
                        key={pct}
                        onClick={() => setCalcPercent(pct)}
                        className={cn(
                          'flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors',
                          isSelected
                            ? 'bg-brand-primary/20 border border-brand-primary/40 text-brand-primary font-semibold'
                            : 'bg-surface-elevated text-ink-secondary hover:bg-surface-border/50',
                        )}
                      >
                        <span>{pct}%</span>
                        <span className="font-medium">{w} kg</span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* ── Registros de 1RM ── */}
      <Card>
        <CardHeader>
          <CardTitle>Registros de 1RM</CardTitle>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowAddForm(true)}>
            Agregar
          </Button>
        </CardHeader>

        {latestByExercise.length === 0 ? (
          <EmptyState
            icon={<Dumbbell className="h-6 w-6" />}
            title="Sin registros"
            description="Agregá el 1RM de cada ejercicio para calcular porcentajes."
          />
        ) : (
          <div className="space-y-2">
            {latestByExercise.map((r) => {
              const history = records.filter((x) => x.exercise_id === r.exercise_id)
              const isOpen  = showHistory === r.exercise_id
              return (
                <div key={r.exercise_id} className="bg-surface-elevated rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-primary truncate">{r.exercise?.name ?? '—'}</p>
                      <p className="text-[10px] text-ink-muted">
                        {formatDate(r.tested_at)} · {r.source === 'epley' ? 'Estimado (Epley)' : 'Testeado'}
                      </p>
                    </div>
                    <span className="text-base font-bold text-brand-primary shrink-0">{r.rm_kg} kg</span>
                    {history.length > 1 && (
                      <button
                        onClick={() => setShowHistory(isOpen ? null : r.exercise_id)}
                        className="text-ink-muted hover:text-ink-primary transition-colors"
                      >
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    )}
                    <button onClick={() => onDelete(r.id)} className="text-ink-muted hover:text-status-expired transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {isOpen && history.length > 1 && (
                    <div className="border-t border-surface-border divide-y divide-surface-border/50">
                      {history.slice(1).map((h) => (
                        <div key={h.id} className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-ink-muted">{formatDate(h.tested_at)} · {h.source === 'epley' ? 'Epley' : 'Test'}</span>
                          <span className="text-xs font-medium text-ink-secondary">{h.rm_kg} kg</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Add form modal ── */}
      {showAddForm && (
        <AddRmModal
          onClose={() => setShowAddForm(false)}
          onSave={async (record) => { await onAdd(record); setShowAddForm(false) }}
        />
      )}
    </div>
  )
}

// ─── AddRmModal ───────────────────────────────────────────────────────────────

type AddMode = 'test' | 'epley'

function AddRmModal({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (r: Omit<StudentRmRecord, 'id' | 'owner_id' | 'student_id' | 'created_at' | 'exercise'>) => Promise<void>
}) {
  const [exercises,   setExercises]   = useState<Pick<Exercise, 'id' | 'name'>[]>([])
  const [exerciseId,  setExerciseId]  = useState('')
  const [mode,        setMode]        = useState<AddMode>('test')
  const [rmKg,        setRmKg]        = useState('')          // mode=test
  const [epleyWeight, setEpleyWeight] = useState('')         // mode=epley
  const [epleyReps,   setEpleyReps]   = useState('')         // mode=epley
  const [testedAt,    setTestedAt]    = useState(new Date().toISOString().split('T')[0])
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    supabase.from('exercise_library').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setExercises((data as Pick<Exercise, 'id' | 'name'>[]) ?? []))
  }, [])

  const estimatedRm = mode === 'epley' && epleyWeight && epleyReps
    ? epley1RM(Number(epleyWeight), Number(epleyReps))
    : null

  async function handleSave() {
    if (!exerciseId) { toast.error('Seleccioná un ejercicio'); return }
    const finalRm = mode === 'test' ? Number(rmKg) : estimatedRm
    if (!finalRm || finalRm <= 0) { toast.error('Ingresá los datos del RM'); return }
    setSaving(true)
    await onSave({
      exercise_id: exerciseId,
      rm_kg: finalRm,
      tested_at: testedAt,
      source: mode,
      notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-ink-primary">Registrar 1RM</h3>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Ejercicio */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Ejercicio *</label>
            <select
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none"
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
            >
              <option value="">Seleccioná un ejercicio...</option>
              {exercises.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Modo */}
          <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
            {([
              { value: 'test',   label: 'RM real (testeado)' },
              { value: 'epley',  label: 'Estimar con Epley' },
            ] as { value: AddMode; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors',
                  mode === value ? 'bg-surface-card text-ink-primary shadow-sm' : 'text-ink-muted',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'test' ? (
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">1RM (kg) *</label>
              <input
                type="number" min={0} step={0.5} placeholder="ej: 120"
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none text-center font-bold"
                value={rmKg}
                onChange={(e) => setRmKg(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Peso usado (kg) *</label>
                  <input
                    type="number" min={0} step={0.5} placeholder="ej: 100"
                    className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none text-center"
                    value={epleyWeight}
                    onChange={(e) => setEpleyWeight(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Reps realizadas *</label>
                  <input
                    type="number" min={1} max={10} placeholder="ej: 5"
                    className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none text-center"
                    value={epleyReps}
                    onChange={(e) => setEpleyReps(e.target.value)}
                  />
                </div>
              </div>
              {estimatedRm && (
                <div className="flex items-center justify-between bg-brand-primary/10 border border-brand-primary/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-[10px] text-brand-primary uppercase tracking-wide font-semibold">1RM estimado (Epley)</p>
                    <p className="text-2xl font-bold text-brand-primary">{estimatedRm} kg</p>
                  </div>
                  <p className="text-xs text-ink-muted text-right">
                    Fórmula:<br />
                    <span className="font-mono">peso × (1 + reps/30)</span>
                  </p>
                </div>
              )}
              <p className="text-[10px] text-ink-muted">La fórmula de Epley es más precisa con 1-6 repeticiones.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
            <input
              type="date"
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none"
              value={testedAt}
              onChange={(e) => setTestedAt(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Notas (opcional)</label>
            <input
              placeholder="ej: con cinturón, post competencia..."
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button className="w-full" loading={saving} onClick={handleSave}>
            Guardar registro
          </Button>
        </div>
      </div>
    </div>
  )
}
