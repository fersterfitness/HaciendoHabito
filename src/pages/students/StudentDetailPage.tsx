import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Pencil, Trash2, Dumbbell, FileText, FileDown, Plus,
  Mail, Phone, Calendar, Zap, X, ChevronDown,
  StickyNote, Check, DollarSign, ClipboardList, Copy, MessageCircle, Tag, Share2,
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
import { cn, formatDate, daysUntil, formatCurrency } from '@/lib/utils'
import { CicloTab } from './CicloTab'
import { StudentAvatar } from '@/components/students/StudentAvatar'
import { StudentNotesCard } from '@/components/students/StudentNotesCard'
import { FersterStudentIntakePanel } from '@/components/students/FersterStudentIntakePanel'
import type { Student, Routine, Exercise, StudentRmRecord, StudentWeightLog, TrainerStudentMealPlan, Income } from '@/types/database'
import { downloadTrainerStudentMealPlanPdf } from '@/lib/nutrition/downloadTrainerStudentMealPlanPdf'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

type Tab = 'resumen' | 'fuerza' | 'ciclo' | 'peso' | 'pagos'

// ─── Epley formula ────────────────────────────────────────────────────────────
function epley1RM(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 10) / 10
}

// ─── RM percentages table ─────────────────────────────────────────────────────
const RM_PERCENTS = [100, 95, 90, 85, 80, 75, 70, 65, 60]

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

  // Tags (localStorage)
  const tagsKey = id ? `tags_${id}` : ''
  const [tags, setTags] = useState<string[]>(() => {
    if (!id) return []
    const raw = localStorage.getItem(`tags_${id}`)
    try { return raw ? (JSON.parse(raw) as string[]) : [] } catch { return [] }
  })
  const [tagInput, setTagInput] = useState('')
  const [editingTags, setEditingTags] = useState(false)
  function addTag(t: string) {
    const clean = t.trim().toLowerCase()
    if (!clean || tags.includes(clean)) return
    const next = [...tags, clean]
    setTags(next)
    localStorage.setItem(tagsKey, JSON.stringify(next))
    setTagInput('')
  }
  function removeTag(t: string) {
    const next = tags.filter((x) => x !== t)
    setTags(next)
    localStorage.setItem(tagsKey, JSON.stringify(next))
  }

  // Notas rápidas
  const [editingNotes,  setEditingNotes]  = useState(false)
  const [notesValue,    setNotesValue]    = useState('')
  const [savingNotes,   setSavingNotes]   = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  // Pago rápido
  const [showPayModal,  setShowPayModal]  = useState(false)

  const [mealPlans, setMealPlans] = useState<TrainerStudentMealPlan[]>([])
  const [mealPlanPdfBusy, setMealPlanPdfBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !user) return
    Promise.all([
      supabase.from('students').select('*').eq('id', id).eq('owner_id', user.id).single(),
      supabase.from('routines').select('*').eq('student_id', id).eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('student_rm_records')
        .select('*, exercise:exercise_library(id, name)')
        .eq('student_id', id)
        .eq('owner_id', user.id)
        .order('tested_at', { ascending: false }),
    ]).then(([{ data: s }, { data: r }, { data: rm }]) => {
      setStudent(s)
      setRoutines(r ?? [])
      setRmRecords((rm as unknown as StudentRmRecord[]) ?? [])
    }).finally(() => setLoading(false))
  }, [id, user])

  useEffect(() => {
    if (!id || !user?.id) return
    if (profile?.role !== 'trainer' && profile?.role !== 'admin') return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('trainer_student_meal_plans')
        .select('*')
        .eq('student_id', id)
        .eq('owner_id', user.id)
        .order('updated_at', { ascending: false })
      if (!cancelled) setMealPlans((data ?? []) as TrainerStudentMealPlan[])
    })()
    return () => {
      cancelled = true
    }
  }, [id, user?.id, profile?.role])

  async function downloadMealPlanPdf(plan: TrainerStudentMealPlan) {
    setMealPlanPdfBusy(plan.id)
    try {
      await downloadTrainerStudentMealPlanPdf(plan, {
        professionalName: profile?.full_name,
        studentName: student?.full_name ?? null,
      })
      toast.success('PDF descargado.')
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el PDF.')
    } finally {
      setMealPlanPdfBusy(null)
    }
  }

  async function cloneMealPlan(plan: TrainerStudentMealPlan) {
    if (!user?.id || !id) return
    const { data, error } = await supabase
      .from('trainer_student_meal_plans')
      .insert({
        owner_id: user.id,
        student_id: id,
        title: `Copia · ${plan.title}`.slice(0, 200),
        data: plan.data,
        cloned_from_id: plan.id,
      })
      .select('*')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Plan clonado en este alumno.')
    setMealPlans((prev) => [data as TrainerStudentMealPlan, ...prev])
  }

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
    // Solo actualizamos el estado DESPUÉS de confirmar el servidor
    setRmRecords((prev) => [data as unknown as StudentRmRecord, ...prev])
    toast.success('RM registrado')
  }

  async function deleteRmRecord(recordId: string) {
    if (!user) return
    // Optimistic: guardamos estado anterior para rollback
    const prev = rmRecords
    setRmRecords((p) => p.filter((r) => r.id !== recordId))
    const { error } = await supabase
      .from('student_rm_records')
      .delete()
      .eq('id', recordId)
      .eq('owner_id', user.id)   // ← solo el dueño puede eliminar
    if (error) {
      setRmRecords(prev)          // ← rollback si falla
      toast.error(error.message)
    }
  }

  async function saveNotes() {
    if (!user || !id) return
    setSavingNotes(true)
    const { error } = await supabase
      .from('students')
      .update({ notes: notesValue || null })
      .eq('id', id)
      .eq('owner_id', user.id)
    setSavingNotes(false)
    if (error) { toast.error(error.message); return }
    setStudent((prev) => prev ? { ...prev, notes: notesValue || null } : null)
    setEditingNotes(false)
    toast.success('Notas guardadas')
  }

  function startEditNotes() {
    setNotesValue(student?.notes ?? '')
    setEditingNotes(true)
    setTimeout(() => notesRef.current?.focus(), 50)
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
                  <>
                    <a href={`tel:${student.phone}`} className="flex items-center gap-1 text-xs text-ink-secondary hover:text-brand-primary transition-colors">
                      <Phone className="h-3 w-3" />{student.phone}
                    </a>
                    <a
                      href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </a>
                  </>
                )}
                {student.birth_date && (
                  <span className="flex items-center gap-1 text-xs text-ink-secondary">
                    <Calendar className="h-3 w-3" />{formatDate(student.birth_date)}
                  </span>
                )}
              </div>
              {/* Tags */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] font-medium">
                    <Tag className="h-2.5 w-2.5" />{t}
                    {editingTags && (
                      <button onClick={() => removeTag(t)} className="ml-0.5 hover:text-red-400 transition-colors"><X className="h-2.5 w-2.5" /></button>
                    )}
                  </span>
                ))}
                {editingTags ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') addTag(tagInput); if (e.key === 'Escape') setEditingTags(false) }}
                      placeholder="Nueva etiqueta..."
                      className="text-[11px] rounded-lg bg-surface-input border border-brand-primary/40 text-ink-primary px-2 py-0.5 w-32 focus:outline-none"
                    />
                    <button onClick={() => addTag(tagInput)} className="text-[11px] text-brand-primary hover:underline">+ Agregar</button>
                    <button onClick={() => setEditingTags(false)} className="text-[11px] text-ink-muted hover:text-ink-secondary">Listo</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingTags(true)} className="text-[11px] text-ink-muted hover:text-brand-primary transition-colors flex items-center gap-1">
                    <Tag className="h-3 w-3" />{tags.length === 0 ? 'Agregar etiqueta' : '+'}
                  </button>
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
            <Button size="sm" icon={<DollarSign className="h-3.5 w-3.5" />} onClick={() => setShowPayModal(true)}>
              Registrar pago
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

        <FersterStudentIntakePanel student={student} />

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-elevated rounded-xl p-1">
          {([
            { value: 'resumen', label: 'Resumen' },
            { value: 'peso',    label: '⚖️ Peso' },
            { value: 'fuerza',  label: '💪 Fuerza' },
            { value: 'pagos',   label: '💰 Pagos' },
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

            {/* Notas rápidas */}
            {editingNotes ? (
              <div className="bg-surface-card border border-surface-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-brand-primary" />
                  <span className="text-sm font-semibold text-ink-primary">Observaciones</span>
                </div>
                <textarea
                  ref={notesRef}
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={5}
                  className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none resize-none placeholder:text-ink-muted"
                  placeholder="Observaciones, lesiones, objetivos..."
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="text-xs text-ink-muted hover:text-ink-primary px-3 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={savingNotes}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-brand-primary hover:bg-brand-primary/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {savingNotes ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : student.notes ? (
              <div className="relative group">
                <StudentNotesCard notes={student.notes} />
                <button
                  onClick={startEditNotes}
                  className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-elevated transition-colors opacity-0 group-hover:opacity-100"
                  title="Editar notas"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditNotes}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-surface-border text-ink-muted hover:text-ink-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors text-sm"
              >
                <StickyNote className="h-4 w-4" />
                Agregar observaciones...
              </button>
            )}

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

            {/* ── Reporte de progreso ── */}
            {(() => {
              function generarReporte() {
                if (!student) return
                const pesoKey  = `peso_goal_${student.id}`
                const cuotaKey = `cuota_mensual_${student.id}`
                const goalPeso = localStorage.getItem(pesoKey)
                const cuota    = localStorage.getItem(cuotaKey)
                const lines: string[] = [
                  `Reporte de progreso — ${student.full_name}`,
                  `Fecha: ${new Date().toLocaleDateString('es-AR')}`,
                  '',
                  `Nivel: ${student.level ?? '—'}`,
                  `Estado: ${student.status}`,
                ]
                if (student.birth_date) lines.push(`Edad: ${new Date().getFullYear() - new Date(student.birth_date).getFullYear()} años`)
                if (activeRoutine) {
                  lines.push('', `Rutina activa: ${activeRoutine.name}`)
                  lines.push(`  Período: ${formatDate(activeRoutine.start_date)} → ${formatDate(activeRoutine.end_date)}`)
                  lines.push(`  Objetivo: ${activeRoutine.objective}`)
                }
                if (goalPeso) lines.push('', `Peso objetivo: ${goalPeso} kg`)
                if (cuota) lines.push(`Cuota mensual: ${formatCurrency(Number(cuota))}`)
                if (student.notes) lines.push('', `Observaciones: ${student.notes}`)
                const text = lines.join('\n')
                if (student.phone) {
                  const digits = student.phone.replace(/\D/g, '')
                  window.open(`https://wa.me/${digits}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
                } else {
                  void navigator.clipboard.writeText(text).then(() => {
                    toast.success('Reporte copiado al portapapeles')
                  })
                }
              }
              return (
                <button
                  onClick={generarReporte}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-surface-border text-ink-secondary hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-ink-primary transition-colors text-sm"
                >
                  <Share2 className="h-4 w-4 text-brand-primary shrink-0" />
                  <span>
                    <span className="font-medium text-ink-primary">Generar reporte de progreso</span>
                    <span className="block text-[11px] text-ink-muted mt-0.5">
                      {student.phone ? 'Abre WhatsApp con el resumen del alumno' : 'Copia el resumen al portapapeles'}
                    </span>
                  </span>
                </button>
              )
            })()}

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

            {(profile?.role === 'trainer' || profile?.role === 'admin') && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-brand-primary shrink-0" aria-hidden />
                        <CardTitle>Planes de alimentación</CardTitle>
                      </div>
                      <p className="text-xs text-ink-muted mt-1 font-normal">
                        Planillas tipo Excel que asignaste desde Plan de alimentación. El alumno las ve si su usuario está vinculado en la ficha.&nbsp;
                        <button
                          type="button"
                          className="text-brand-primary hover:underline font-medium"
                          onClick={() => navigate('/meal-plans')}
                        >
                          Ver todos los planes
                        </button>
                      </p>
                    </div>
                  </div>
                </CardHeader>
                {mealPlans.length === 0 ? (
                  <p className="text-sm text-ink-muted px-4 pb-4">
                    Todavía no hay planes asignados a este alumno.
                  </p>
                ) : (
                  <div className="space-y-2 px-4 pb-4">
                    {mealPlans.map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center gap-2 justify-between rounded-xl border border-surface-border bg-surface-elevated p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-primary truncate">{p.title}</p>
                          <p className="text-[11px] text-ink-muted">Actualizado {formatDate(p.updated_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            loading={mealPlanPdfBusy === p.id}
                            icon={<FileDown className="h-3.5 w-3.5" />}
                            onClick={() => void downloadMealPlanPdf(p)}
                          >
                            PDF
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Copy className="h-3.5 w-3.5" />}
                            onClick={() => void cloneMealPlan(p)}
                          >
                            Clonar
                          </Button>
                          <Button size="sm" onClick={() => navigate(`/students/${id}/meal-plan/${p.id}`)}>
                            Ver
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* ── Pagos tab ── */}
        {tab === 'pagos' && (
          <PagosTab
            studentId={id!}
            studentName={student.full_name}
            onRegisterPago={() => setShowPayModal(true)}
          />
        )}

        {/* ── Ciclo Menstrual tab ── */}
        {tab === 'ciclo' && <CicloTab studentId={id!} />}

        {/* ── Peso tab ── */}
        {tab === 'peso' && <PesoTab studentId={id!} />}

        {/* ── Fuerza / 1RM tab ── */}
        {tab === 'fuerza' && (
          <FuerzaTab
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

      {showPayModal && student && (
        <QuickPayModal
          studentId={student.id}
          studentName={student.full_name}
          onClose={() => setShowPayModal(false)}
        />
      )}
    </div>
  )
}

// ─── PagosTab ─────────────────────────────────────────────────────────────────

function PagosTab({
  studentId,
  studentName,
  onRegisterPago,
}: { studentId: string; studentName: string; onRegisterPago: () => void }) {
  const { user } = useAuthStore()
  const [payments, setPayments] = useState<Income[]>([])
  const [loading, setLoading]   = useState(true)

  // ── Cuota mensual (stored in localStorage, no migration needed) ──
  const cuotaKey = `cuota_mensual_${studentId}`
  const [cuota, setCuota]             = useState<number | null>(() => {
    const v = localStorage.getItem(cuotaKey); return v ? Number(v) : null
  })
  const [editingCuota, setEditingCuota] = useState(false)
  const [cuotaInput, setCuotaInput]     = useState('')
  function saveCuota() {
    const n = parseFloat(cuotaInput)
    if (!isNaN(n) && n > 0) {
      localStorage.setItem(cuotaKey, String(n))
      setCuota(n)
    } else {
      localStorage.removeItem(cuotaKey)
      setCuota(null)
    }
    setEditingCuota(false)
  }

  useEffect(() => {
    if (!user) return
    supabase
      .from('income')
      .select('*')
      .eq('owner_id', user.id)
      .eq('student_id', studentId)
      .order('income_date', { ascending: false })
      .then(({ data }) => { setPayments((data as Income[]) ?? []); setLoading(false) })
  }, [user, studentId])

  const totalCobrado  = payments.filter((p) => p.status === 'cobrado').reduce((s, p) => s + p.amount, 0)
  const now           = new Date()
  const thisMonthKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const pagadoEsteMes = payments.some((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
  const ultimoPago    = payments.find((p) => p.status === 'cobrado')

  const METHOD_LABEL: Record<string, string> = {
    efectivo_debito: 'Efectivo/Débito',
    tarjeta_credito: 'Tarjeta',
    transferencia:   'Transferencia',
    otro:            'Otro',
  }

  return (
    <div className="space-y-4">
      {/* ── Cuota mensual ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-card px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">Plan de cuota mensual</p>
          {!editingCuota && (
            <button
              onClick={() => { setCuotaInput(String(cuota ?? '')); setEditingCuota(true) }}
              className="text-[11px] text-brand-primary hover:underline"
            >
              {cuota ? 'Modificar' : 'Configurar'}
            </button>
          )}
        </div>
        {editingCuota ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-ink-muted">$</span>
            <input
              type="number"
              min={0}
              step={100}
              autoFocus
              value={cuotaInput}
              onChange={(e) => setCuotaInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveCuota()}
              placeholder="Ej: 15000"
              className="w-36 rounded-xl bg-surface-input border border-brand-primary/40 text-ink-primary text-sm px-3 py-1.5 focus:outline-none focus:border-brand-primary"
            />
            <Button size="sm" onClick={saveCuota}>Guardar</Button>
            <button onClick={() => setEditingCuota(false)} className="text-xs text-ink-muted hover:text-ink-secondary">Cancelar</button>
          </div>
        ) : cuota ? (
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-status-generated">{formatCurrency(cuota)}<span className="text-sm font-normal text-ink-muted ml-1">/ mes</span></p>
            {(() => {
              const now = new Date()
              const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
              const pagadoEsteMes = payments.some((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey))
              const totalEsteMes  = payments.filter((p) => p.status === 'cobrado' && p.income_date.startsWith(thisMonthKey)).reduce((s, p) => s + p.amount, 0)
              return (
                <div className="text-right">
                  {pagadoEsteMes ? (
                    <p className="text-sm font-semibold text-emerald-400">✓ Pagó este mes</p>
                  ) : (
                    <p className="text-sm font-semibold text-amber-400">⚠ Pendiente de cobro</p>
                  )}
                  {totalEsteMes > 0 && totalEsteMes < cuota && (
                    <p className="text-[11px] text-ink-muted mt-0.5">Cobrado: {formatCurrency(totalEsteMes)} / {formatCurrency(cuota)}</p>
                  )}
                </div>
              )
            })()}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Sin cuota configurada — establecé el monto mensual para seguimiento automático.</p>
        )}
      </div>

      {/* Estado de cuenta */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-card border border-surface-border rounded-2xl p-3 text-center">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">Total cobrado</p>
          <p className="text-lg font-bold text-status-generated">{formatCurrency(totalCobrado)}</p>
        </div>
        <div className={`border rounded-2xl p-3 text-center ${pagadoEsteMes ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
          <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">Este mes</p>
          <p className={`text-sm font-bold ${pagadoEsteMes ? 'text-emerald-400' : 'text-amber-400'}`}>
            {pagadoEsteMes ? '✓ Pagó' : '⚠ Pendiente'}
          </p>
        </div>
        <div className="bg-surface-card border border-surface-border rounded-2xl p-3 text-center">
          <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-1">Último pago</p>
          <p className="text-sm font-semibold text-ink-primary">{ultimoPago ? formatDate(ultimoPago.income_date) : '—'}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
          <Button size="sm" icon={<DollarSign className="h-3.5 w-3.5" />} onClick={onRegisterPago}>
            Registrar
          </Button>
        </CardHeader>
        {loading ? (
          <div className="flex justify-center py-6"><Spinner size="md" /></div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="h-6 w-6" />}
            title="Sin pagos registrados"
            description={`${studentName} todavía no tiene pagos cargados.`}
          />
        ) : (
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-elevated">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-primary">{formatCurrency(p.amount)}</p>
                  <p className="text-xs text-ink-muted">{p.income_type} · {METHOD_LABEL[p.payment_method] ?? p.payment_method}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-ink-secondary">{formatDate(p.income_date)}</p>
                  <Badge status={p.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── FuerzaTab ────────────────────────────────────────────────────────────────

function FuerzaTab({
  records,
  onAdd,
  onDelete,
}: {
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

                  {isOpen && history.length > 1 && (() => {
                    const rmChartData = [...history].reverse().map((h) => ({
                      date: formatDate(h.tested_at),
                      rm: h.rm_kg,
                      source: h.source === 'epley' ? 'Epley' : 'Test',
                    }))
                    const minRm = Math.min(...rmChartData.map(d => d.rm))
                    const maxRm = Math.max(...rmChartData.map(d => d.rm))
                    return (
                      <div className="border-t border-surface-border px-3 pt-3 pb-2">
                        <p className="text-[10px] text-ink-muted uppercase tracking-wide mb-2">Progresión 1RM</p>
                        <ResponsiveContainer width="100%" height={90}>
                          <LineChart data={rmChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
                            <YAxis domain={[Math.max(0, minRm - 5), maxRm + 5]} tick={{ fontSize: 9, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-surface-border)', borderRadius: 8, fontSize: 11 }}
                              labelStyle={{ color: 'var(--color-ink-muted)', marginBottom: 2 }}
                              formatter={(value: number, _name: string, props: { payload?: { source?: string } }) => [`${value} kg (${props.payload?.source ?? ''})`, '1RM']}
                            />
                            <Line type="monotone" dataKey="rm" stroke="var(--color-brand-primary)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-brand-primary)' }} activeDot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="mt-1 divide-y divide-surface-border/40">
                          {history.slice(1).map((h) => (
                            <div key={h.id} className="flex items-center justify-between py-1.5">
                              <span className="text-xs text-ink-muted">{formatDate(h.tested_at)} · {h.source === 'epley' ? 'Epley' : 'Test'}</span>
                              <span className="text-xs font-medium text-ink-secondary">{h.rm_kg} kg</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
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

// ─── PesoTab ──────────────────────────────────────────────────────────────────

function PesoTab({ studentId }: { studentId: string }) {
  const { user } = useAuthStore()
  const [logs,    setLogs]    = useState<StudentWeightLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [weight,   setWeight]  = useState('')
  const [fat,      setFat]     = useState('')
  const [noteVal,  setNoteVal] = useState('')
  const [dateVal,  setDateVal] = useState(new Date().toISOString().split('T')[0])
  const [saving,   setSaving]  = useState(false)

  const fetchLogs = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('student_weight_logs')
      .select('*')
      .eq('student_id', studentId)
      .eq('owner_id', user.id)
      .order('logged_at', { ascending: false })
    if (!error) setLogs((data as StudentWeightLog[]) ?? [])
    setLoading(false)
  }, [user, studentId])

  useEffect(() => { void fetchLogs() }, [fetchLogs])

  async function handleSave() {
    if (!user) return
    const w = Number(weight)
    if (!w || w <= 0) { toast.error('Ingresá un peso válido'); return }
    setSaving(true)
    const { error } = await supabase.from('student_weight_logs').insert({
      owner_id:     user.id,
      student_id:   studentId,
      logged_at:    dateVal,
      weight_kg:    w,
      body_fat_pct: fat ? Number(fat) : null,
      notes:        noteVal || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Peso registrado')
    setWeight(''); setFat(''); setNoteVal('')
    setDateVal(new Date().toISOString().split('T')[0])
    setShowForm(false)
    void fetchLogs()
  }

  async function handleDelete(logId: string) {
    if (!user) return
    const prev = logs
    setLogs((p) => p.filter((l) => l.id !== logId))
    const { error } = await supabase
      .from('student_weight_logs')
      .delete()
      .eq('id', logId)
      .eq('owner_id', user.id)
    if (error) { setLogs(prev); toast.error(error.message) }
  }

  const chartData = useMemo(
    () => [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
    [logs],
  )

  // Peso objetivo (localStorage)
  const goalKey  = `peso_goal_${studentId}`
  const [goal, setGoal]           = useState<number | null>(() => {
    const v = localStorage.getItem(goalKey); return v ? Number(v) : null
  })
  const [editingGoal, setEditingGoal] = useState(false)
  const [goalInput,   setGoalInput]   = useState('')

  function saveGoal() {
    const v = Number(goalInput)
    if (!v || v <= 0) { toast.error('Ingresá un peso válido'); return }
    localStorage.setItem(goalKey, String(v))
    setGoal(v); setEditingGoal(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Historial de peso</CardTitle>
          <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowForm((v) => !v)}>
            Registrar
          </Button>
        </CardHeader>

        {/* Quick-add form */}
        {showForm && (
          <div className="mb-4 p-3 rounded-xl bg-surface-elevated space-y-3 border border-surface-border">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Peso (kg) *</label>
                <input
                  type="number" min={0} step={0.1} placeholder="ej: 75.5"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none text-center font-bold"
                  value={weight} onChange={(e) => setWeight(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Grasa corporal %</label>
                <input
                  type="number" min={0} max={100} step={0.1} placeholder="opcional"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none text-center"
                  value={fat} onChange={(e) => setFat(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                  value={dateVal} onChange={(e) => setDateVal(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] text-ink-muted uppercase tracking-wide mb-1">Notas</label>
                <input
                  placeholder="opcional"
                  className="w-full bg-surface-card text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
                  value={noteVal} onChange={(e) => setNoteVal(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="text-xs text-ink-muted hover:text-ink-primary px-3 py-1.5 rounded-lg hover:bg-surface-card transition-colors">
                Cancelar
              </button>
              <Button size="sm" loading={saving} onClick={handleSave}>Guardar</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8"><Spinner size="md" /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={<span className="text-2xl">⚖️</span>}
            title="Sin registros de peso"
            description="Registrá el peso periódicamente para ver la evolución."
          />
        ) : (
          <>
            {/* Weight line chart */}
            {chartData.length >= 2 && (() => {
              const first = chartData[0]
              const last  = chartData[chartData.length - 1]
              const delta = Math.round((last.weight_kg - first.weight_kg) * 10) / 10
              const hasFat = chartData.some((l) => l.body_fat_pct != null)
              const rechartsData = chartData.map((l) => ({
                date:   l.logged_at.slice(5),
                weight: l.weight_kg,
                fat:    l.body_fat_pct ?? undefined,
              }))
              return (
                <div className="mb-5">
                  {/* KPIs row */}
                  <div className="flex items-end gap-5 mb-3 px-1 flex-wrap">
                    <div>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wide">Actual</p>
                      <p className="text-2xl font-bold text-ink-primary">{last.weight_kg} <span className="text-sm font-normal text-ink-muted">kg</span></p>
                    </div>
                    <div>
                      <p className="text-[10px] text-ink-muted uppercase tracking-wide">Δ inicio</p>
                      <p className={cn('text-base font-bold', delta < 0 ? 'text-emerald-400' : delta > 0 ? 'text-amber-400' : 'text-ink-muted')}>
                        {delta > 0 ? '+' : ''}{delta} kg
                      </p>
                    </div>
                    {hasFat && last.body_fat_pct != null && (
                      <div>
                        <p className="text-[10px] text-ink-muted uppercase tracking-wide">% Grasa</p>
                        <p className="text-base font-bold text-emerald-400">{last.body_fat_pct}%</p>
                      </div>
                    )}
                    {goal && (
                      <div>
                        <p className="text-[10px] text-ink-muted uppercase tracking-wide">Objetivo</p>
                        <p className="text-base font-bold text-brand-primary">{goal} kg</p>
                        {(() => {
                          const toGoal = Math.round((last.weight_kg - goal) * 10) / 10
                          return toGoal !== 0 && (
                            <p className="text-[10px] text-ink-muted">{toGoal > 0 ? `-${toGoal}` : `+${Math.abs(toGoal)}`} kg restantes</p>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  {/* Barra progreso hacia objetivo */}
                  {goal && (() => {
                    const start  = first.weight_kg
                    const curr   = last.weight_kg
                    const pct    = start === goal ? 100 : Math.min(100, Math.max(0, Math.round(Math.abs(start - curr) / Math.abs(start - goal) * 100)))
                    return (
                      <div className="mb-3 px-1">
                        <div className="flex justify-between text-[10px] text-ink-muted mb-1">
                          <span>Inicio: {start} kg</span>
                          <span className="text-brand-primary font-semibold">{pct}% completado</span>
                          <span>Objetivo: {goal} kg</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-border overflow-hidden">
                          <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })()}

                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={rechartsData} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.35)' }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={['auto', 'auto']}
                        tick={{ fontSize: 9, fill: 'rgba(255,255,255,0.25)' }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          return (
                            <div className="bg-surface-card border border-surface-border rounded-xl px-3 py-2 text-xs shadow-lg">
                              <p className="text-ink-muted mb-1">{label}</p>
                              <p className="font-bold text-ink-primary">{payload[0].value} kg</p>
                              {payload[1]?.value != null && (
                                <p className="text-emerald-400">{payload[1].value}% grasa</p>
                              )}
                            </div>
                          )
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        stroke="#7C5DFA"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: '#7C5DFA', stroke: '#7C5DFA', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#7C5DFA' }}
                      />
                      {hasFat && (
                        <Line
                          type="monotone"
                          dataKey="fat"
                          stroke="#10b981"
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                          dot={false}
                          activeDot={{ r: 4, fill: '#10b981' }}
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )
            })()}

            {/* Objetivo de peso */}
            {editingGoal ? (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="number" min={30} max={300} step={0.5} autoFocus
                  placeholder="Peso objetivo (kg)"
                  className="flex-1 bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none text-center"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                />
                <Button size="sm" onClick={saveGoal}>Guardar</Button>
                <button onClick={() => setEditingGoal(false)} className="text-xs text-ink-muted hover:text-ink-primary px-2 py-1.5">Cancelar</button>
              </div>
            ) : (
              <button
                onClick={() => { setGoalInput(String(goal ?? '')); setEditingGoal(true) }}
                className="w-full mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-surface-border text-ink-muted hover:text-ink-primary hover:border-brand-primary/40 hover:bg-brand-primary/5 transition-colors text-xs"
              >
                <span>🎯</span>
                {goal ? `Objetivo: ${goal} kg — modificar` : 'Establecer peso objetivo'}
              </button>
            )}

            {/* Log list */}
            <div className="space-y-1.5">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-elevated group">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-bold text-ink-primary">{l.weight_kg} kg</span>
                    {l.body_fat_pct != null && (
                      <span className="ml-2 text-xs text-ink-muted">{l.body_fat_pct}% grasa</span>
                    )}
                    {l.notes && <p className="text-xs text-ink-muted truncate mt-0.5">{l.notes}</p>}
                  </div>
                  <span className="text-xs text-ink-muted shrink-0">{l.logged_at}</span>
                  <button
                    onClick={() => handleDelete(l.id)}
                    className="text-ink-muted hover:text-status-expired transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}

// ─── QuickPayModal ────────────────────────────────────────────────────────────

function QuickPayModal({
  studentId,
  studentName,
  onClose,
}: {
  studentId: string
  studentName: string
  onClose: () => void
}) {
  const { user } = useAuthStore()
  const [amount,  setAmount]  = useState('')
  const [method,  setMethod]  = useState('efectivo_debito')
  const [type,    setType]    = useState('mensualidad')
  const [date,    setDate]    = useState(new Date().toISOString().split('T')[0])
  const [notes,   setNotes]   = useState('')
  const [saving,  setSaving]  = useState(false)

  async function handleSave() {
    if (!user) return
    const amt = Number(amount)
    if (!amt || amt <= 0) { toast.error('Ingresá un monto válido'); return }
    setSaving(true)
    const { error } = await supabase.from('income').insert({
      owner_id:       user.id,
      student_id:     studentId,
      amount:         amt,
      payment_method: method,
      income_type:    type,
      income_date:    date,
      description:    `Pago de ${studentName}`,
      category:       'entrenamiento',
      status:         'cobrado',
      notes:          notes || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Pago registrado ✓')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface-card border border-surface-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-surface-border">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary">Registrar pago</h3>
            <p className="text-xs text-ink-muted">{studentName}</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink-primary"><X className="h-4 w-4" /></button>
        </div>

        <div className="px-4 py-4 space-y-3">
          {/* Monto */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Monto *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted text-sm font-semibold">$</span>
              <input
                type="number" min={0} step={100} placeholder="0"
                className="w-full bg-surface-elevated text-ink-primary text-lg font-bold rounded-xl pl-7 pr-3 py-2.5 border border-surface-border focus:border-brand-primary outline-none text-center"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Tipo</label>
              <select
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                value={type} onChange={(e) => setType(e.target.value)}
              >
                <option value="mensualidad">Mensualidad</option>
                <option value="clase_suelta">Clase suelta</option>
                <option value="plan_nutricional">Plan nutricional</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            {/* Método */}
            <div>
              <label className="block text-xs font-medium text-ink-secondary mb-1">Método</label>
              <select
                className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
                value={method} onChange={(e) => setMethod(e.target.value)}
              >
                <option value="efectivo_debito">Efectivo / Débito</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta_credito">Tarjeta crédito</option>
                <option value="otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Fecha</label>
            <input
              type="date"
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none"
              value={date} onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Notas (opcional)</label>
            <input
              placeholder="ej: mes de mayo..."
              className="w-full bg-surface-elevated text-ink-primary text-sm rounded-xl px-3 py-2 border border-surface-border focus:border-brand-primary outline-none placeholder:text-ink-muted"
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button className="w-full" loading={saving} onClick={handleSave}>
            Confirmar pago
          </Button>
        </div>
      </div>
    </div>
  )
}
