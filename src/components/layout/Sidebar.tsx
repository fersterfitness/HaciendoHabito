import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  Users,
  Dumbbell,
  FileText,
  MessageSquare,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Settings,
  LogOut,
  Salad,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FEATURE_NUTRITION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { getInitials } from '@/lib/utils'
import toast from 'react-hot-toast'

const navItems = [
  { label: 'Inicio', href: '/dashboard', icon: Home },
  { label: 'Alumnos', href: '/students', icon: Users },
  { label: 'Rutinas', href: '/routines', icon: Dumbbell },
  { label: 'PDFs Rutina', href: '/routine-pdfs', icon: FileText },
  { label: 'Devoluciones', href: '/feedback', icon: MessageSquare },
  { label: 'Ejercicios', href: '/exercises', icon: BookOpen },
]

const financeItems = [
  { label: 'Ingresos', href: '/finances/income', icon: TrendingUp },
  { label: 'Gastos', href: '/finances/expenses', icon: TrendingDown },
]

const nutritionItems = [
  { label: 'Nutrición', href: '/nutrition', icon: Salad },
  { label: 'PDFs Nutrición', href: '/nutrition-pdfs', icon: FileText },
]

export function Sidebar() {
  const { profile, reset } = useAuthStore()
  const navigate = useNavigate()

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-surface-card border-r border-surface-border min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-surface-border">
        <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-sm">FF</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-brand-primary leading-none uppercase tracking-widest">
            Ferster
          </p>
          <p className="text-xs text-ink-muted leading-none mt-0.5">Haciéndolo Hábito</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}

        <SidebarSection label="Finanzas" />
        {financeItems.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}

        {FEATURE_NUTRITION && (
          <>
            <SidebarSection label="Nutrición" />
            {nutritionItems.map((item) => (
              <SidebarItem key={item.href} {...item} />
            ))}
          </>
        )}
      </nav>

      {/* Profile & Logout */}
      <div className="px-3 py-4 border-t border-surface-border space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150',
              isActive
                ? 'bg-brand-primary/10 text-brand-primary'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated'
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Configuración</span>
        </NavLink>

        <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
          <div className="w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">
              {profile ? getInitials(profile.full_name) : '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink-primary truncate">
              {profile?.full_name ?? 'Cargando...'}
            </p>
            <p className="text-xs text-ink-muted capitalize">{profile?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-ink-muted hover:text-status-expired transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function SidebarItem({
  label,
  href,
  icon: Icon,
}: {
  label: string
  href: string
  icon: React.ElementType
}) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-150 group',
          isActive
            ? 'bg-brand-primary/10 text-brand-primary font-medium'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={cn('h-4 w-4 shrink-0', isActive && 'text-brand-primary')} />
          <span className="flex-1">{label}</span>
          {isActive && <ChevronRight className="h-3 w-3 text-brand-primary" />}
        </>
      )}
    </NavLink>
  )
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-4 pb-1">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-widest">{label}</p>
    </div>
  )
}
