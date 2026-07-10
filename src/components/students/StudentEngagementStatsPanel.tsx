import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { TrendingUp, MessageCircle, Plus, X, Copy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { normalizePhoneForWhatsApp, buildWhatsAppUrl } from '@/lib/whatsapp'
import type { Routine, StudentTestimonial } from '@/types/database'
import toast from 'react-hot-toast'

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MONTHS_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function monthsBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso + 'T12:00:00')
  return Math.max(0, (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()))
}

/**
 * Estadísticas de constancia del alumno (para seguimiento y redes) + feedback mensual.
 * Datos: rutinas del alumno (antigüedad, completadas, renovaciones por mes).
 */
export function StudentEngagementStatsPanel({
  studentId,
  studentName,
  studentPhone,
  routines,
}: {
  studentId: string
  studentName: string
  studentPhone: string | null
  routines: Routine[]
}) {
  const { user } = useAuthStore()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [testimonials, setTestimonials] = useState<StudentTestimonial[]>([])
  const [draft, setDraft] = useState('')
  const [draftPeriod, setDraftPeriod] = useState(() => {
    const now = new Date()
    return `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('student_testimonials')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setTestimonials((data as StudentTestimonial[]) ?? [])
      })
    return () => {
      cancelled = true
    }
  }, [studentId])

  const stats = useMemo(() => {
    const now = new Date()
    const sorted = [...routines].sort((a, b) => a.start_date.localeCompare(b.start_date))
    const first = sorted[0] ?? null
    const monthsActive = first ? monthsBetween(first.start_date, now) + 1 : 0
    const completed = routines.filter((r) => r.status === 'completada').length
    const finished = routines.filter((r) => ['completada', 'vencida', 'cancelada'].includes(r.status)).length
    const compliancePct = finished > 0 ? Math.round((completed / finished) * 100) : null

    // Rutinas iniciadas por mes (últimos 12 meses) — muestra la renovación continua.
    const byMonth: { label: string; rutinas: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const count = routines.filter((r) => {
        const s = new Date(r.start_date + 'T12:00:00')
        return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth()
      }).length
      byMonth.push({ label: `${MONTHS_ES[d.getMonth()]}`, rutinas: count })
    }

    return { monthsActive, totalRoutines: routines.length, completed, compliancePct, byMonth, firstDate: first?.start_date ?? null }
  }, [routines])

  async function saveTestimonial() {
    const content = draft.trim()
    if (!content || !user) return
    setSaving(true)
    const { data, error } = await supabase
      .from('student_testimonials')
      .insert({ owner_id: user.id, student_id: studentId, period_label: draftPeriod.trim() || '—', content })
      .select('*')
      .single()
    setSaving(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setTestimonials((prev) => [data as StudentTestimonial, ...prev])
    setDraft('')
    toast.success('Feedback guardado')
  }

  async function removeTestimonial(id: string) {
    const prev = testimonials
    setTestimonials((p) => p.filter((t) => t.id !== id))
    const { error } = await supabase.from('student_testimonials').delete().eq('id', id)
    if (error) {
      setTestimonials(prev)
      toast.error(error.message)
    }
  }

  function requestFeedbackWhatsApp() {
    const msg =
      `¡Hola ${studentName.split(' ')[0]}! Para que me sirva de ayuda, ¿me hacés un feedback de este mes de rutina? ` +
      `Contame libremente cómo te sentiste, qué mejoraste y qué opinás del servicio. ` +
      `Esto lo voy a subir a mis redes para que la gente vea tu experiencia. ¡Gracias!`
    const phone = normalizePhoneForWhatsApp(studentPhone)
    if (phone) {
      window.open(buildWhatsAppUrl(phone, msg), '_blank', 'noopener')
    } else {
      void navigator.clipboard.writeText(msg)
      toast.success('Sin teléfono cargado: mensaje copiado al portapapeles')
    }
  }

  const tick = isDark ? '#a1a1aa' : '#52525b'

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <section className="rounded-2xl border border-surface-border bg-surface-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-primary" />
          <h3 className="text-sm font-semibold text-ink-primary">Constancia de {studentName.split(' ')[0]}</h3>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Meses entrenando', value: stats.monthsActive > 0 ? `${stats.monthsActive}` : '—', hint: stats.firstDate ? `desde ${formatDate(stats.firstDate)}` : 'sin rutinas' },
            { label: 'Rutinas totales', value: String(stats.totalRoutines), hint: 'asignadas' },
            { label: 'Completadas', value: String(stats.completed), hint: 'marcadas realizadas' },
            { label: 'Cumplimiento', value: stats.compliancePct != null ? `${stats.compliancePct}%` : '—', hint: 'completadas / terminadas' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-surface-border bg-surface-elevated/40 px-3 py-2.5 text-center">
              <dd className="text-xl font-bold tabular-nums text-ink-primary">{k.value}</dd>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">{k.label}</dt>
              <p className="text-[9px] text-ink-muted">{k.hint}</p>
            </div>
          ))}
        </dl>

        <p className="mb-1 mt-4 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          Rutinas iniciadas por mes (últimos 12)
        </p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={stats.byMonth} margin={{ top: 4, right: 4, bottom: 0, left: -32 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: tick }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: tick }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
            />
            <Bar dataKey="rutinas" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Feedback mensual / testimonios */}
      <section className="rounded-2xl border border-surface-border bg-surface-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-ink-primary">Feedback mensual · testimonios</h3>
          </div>
          <Button size="sm" variant="secondary" onClick={requestFeedbackWhatsApp}>
            Pedir feedback por WhatsApp
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[10rem_1fr_auto]">
          <input
            value={draftPeriod}
            onChange={(e) => setDraftPeriod(e.target.value)}
            placeholder="Mes (ej. Julio 2026)"
            className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary outline-none focus:border-brand-secondary"
          />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); void saveTestimonial() }
            }}
            placeholder="Pegá acá lo que respondió el alumno…"
            className="rounded-xl border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-ink-primary outline-none focus:border-brand-secondary"
          />
          <Button size="sm" loading={saving} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => void saveTestimonial()}>
            Guardar
          </Button>
        </div>
        {testimonials.length === 0 ? (
          <p className="py-3 text-center text-xs text-ink-muted">
            Sin feedbacks guardados. Pedile el del mes y pegá su respuesta acá para tenerla lista para redes.
          </p>
        ) : (
          <ul className="space-y-2">
            {testimonials.map((t) => (
              <li key={t.id} className="rounded-xl border border-surface-border bg-surface-elevated/40 px-3 py-2.5">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-secondary">{t.period_label}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Copiar para redes"
                      onClick={() => {
                        void navigator.clipboard.writeText(`"${t.content}" — ${studentName} (${t.period_label})`)
                        toast.success('Copiado para redes')
                      }}
                      className="rounded p-1 text-ink-muted hover:text-brand-secondary"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => void removeTestimonial(t.id)}
                      className="rounded p-1 text-ink-muted hover:text-status-expired"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-snug text-ink-secondary">{t.content}</p>
                <p className="mt-1 text-[9px] text-ink-muted">{formatDate(t.created_at.slice(0, 10))}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
