import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  Plus,
  AlertTriangle,
  Calendar,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, daysUntil } from '@/lib/utils'
import type { Routine, Notification } from '@/types/database'

interface Stats {
  activeStudents: number
  activeRoutines: number
  pendingPdfs: number
  openQuestions: number
}

interface ExpiringRoutine extends Routine {
  student: { full_name: string }
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ activeStudents: 0, activeRoutines: 0, pendingPdfs: 0, openQuestions: 0 })
  const [expiring, setExpiring] = useState<ExpiringRoutine[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadDashboard()
  }, [user])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [
        { count: activeStudents },
        { count: activeRoutines },
        { count: pendingPdfs },
        { count: openQuestions },
        { data: expiringData },
        { data: notifData },
      ] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('status', 'activo'),
        supabase.from('routines').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).eq('status', 'activa'),
        supabase.from('routine_pdfs').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['pendiente', 'en_proceso']),
        supabase.from('routine_questions').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id).in('status', ['recibida', 'en_revision']),
        supabase.from('routines').select('*, student:students(full_name)').eq('owner_id', user!.id).in('status', ['activa', 'por_vencer']).lte('end_date', new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]).order('end_date', { ascending: true }).limit(5),
        supabase.from('notifications').select('*').eq('user_id', user!.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5),
      ])

      setStats({
        activeStudents: activeStudents ?? 0,
        activeRoutines: activeRoutines ?? 0,
        pendingPdfs: pendingPdfs ?? 0,
        openQuestions: openQuestions ?? 0,
      })
      setExpiring((expiringData as unknown as ExpiringRoutine[]) ?? [])
      setNotifications(notifData ?? [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Inicio" />
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Inicio" />

      <div className="px-4 lg:px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            title="Alumnos activos"
            value={stats.activeStudents}
            icon={<Users className="h-5 w-5" />}
            onClick={() => navigate('/students')}
          />
          <StatCard
            title="Rutinas activas"
            value={stats.activeRoutines}
            icon={<Dumbbell className="h-5 w-5" />}
            onClick={() => navigate('/routines')}
          />
          <StatCard
            title="PDFs pendientes"
            value={stats.pendingPdfs}
            icon={<FileText className="h-5 w-5" />}
            iconColor={stats.pendingPdfs > 0 ? 'text-status-pending' : 'text-brand-primary'}
            onClick={() => navigate('/routine-pdfs')}
          />
          <StatCard
            title="Consultas abiertas"
            value={stats.openQuestions}
            icon={<MessageSquare className="h-5 w-5" />}
            iconColor={stats.openQuestions > 0 ? 'text-status-expiring' : 'text-brand-primary'}
            onClick={() => navigate('/feedback')}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Rutinas por vencer */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-status-expiring" />
                <CardTitle>Rutinas por vencer</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/routines')}
              >
                Ver todas
              </Button>
            </CardHeader>
            {expiring.length === 0 ? (
              <p className="text-sm text-ink-muted py-4 text-center">
                No hay rutinas próximas a vencer 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {expiring.map((r) => {
                  const days = daysUntil(r.end_date)
                  return (
                    <button
                      key={r.id}
                      onClick={() => navigate(`/routines/${r.id}`)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-surface-border/50 transition-colors text-left group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-primary truncate">
                          {r.student?.full_name ?? '—'}
                        </p>
                        <p className="text-xs text-ink-secondary truncate">{r.name}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                            days <= 3
                              ? 'bg-status-expired/10 text-status-expired'
                              : days <= 7
                              ? 'bg-status-expiring/10 text-status-expiring'
                              : 'bg-brand-primary/10 text-brand-primary'
                          }`}
                        >
                          {days <= 0 ? 'Hoy' : `${days}d`}
                        </span>
                        <Calendar className="h-3.5 w-3.5 text-ink-muted" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Acciones rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones rápidas</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nuevo alumno', icon: Users, href: '/students/new' },
                { label: 'Nueva rutina', icon: Dumbbell, href: '/routines/new' },
                { label: 'Ver PDFs', icon: FileText, href: '/routine-pdfs' },
                { label: 'Ver dudas', icon: MessageSquare, href: '/feedback' },
              ].map(({ label, icon: Icon, href }) => (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-surface-elevated hover:bg-surface-border/50 hover:border-brand-primary/20 border border-transparent transition-all text-center group"
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center group-hover:bg-brand-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-brand-primary" />
                  </div>
                  <span className="text-xs font-medium text-ink-secondary group-hover:text-ink-primary transition-colors">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Notificaciones recientes */}
        {notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Notificaciones recientes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/notifications')}>
                Ver todas
              </Button>
            </CardHeader>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3 p-3 rounded-xl bg-surface-elevated">
                  <div className="w-2 h-2 rounded-full bg-brand-primary mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary">{n.title}</p>
                    <p className="text-xs text-ink-secondary truncate">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
