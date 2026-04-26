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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FEATURE_NUTRITION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
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
  const { theme } = useTheme()

  async function handleLogout() {
    await supabase.auth.signOut()
    reset()
    navigate('/login')
    toast.success('Sesión cerrada')
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-surface-card border-r border-surface-border min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-surface-border shrink-0">
        <img
          src={
            theme === 'dark'
              ? '/logo_mark_original_white_transparent.png'
              : '/logo_mark_original_black_square.png'
          }
          alt="HH"
          className="w-8 h-8 object-contain rounded-lg shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-primary leading-none">Haciéndolo Hábito</p>
          <p className="text-[10px] text-ink-muted leading-none mt-0.5 font-medium tracking-wide uppercase">
            Ferster Fitness
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-0.5">
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

      {/* Bottom */}
      <div className="px-3 pb-4 pt-3 border-t border-surface-border space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
              isActive
                ? 'bg-brand-primary/10 text-brand-primary font-medium'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated'
            )
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span>Configuración</span>
        </NavLink>

        {/* User row */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-surface-elevated transition-colors group">
          <div className="w-7 h-7 rounded-full bg-brand-primary flex items-center justify-center shrink-0 ring-2 ring-brand-primary/20">
            <span className="text-white text-[10px] font-bold">
              {profile ? getInitials(profile.full_name) : '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink-primary truncate">
              {profile?.full_name ?? 'Cargando...'}
            </p>
            <p className="text-[10px] text-ink-muted capitalize leading-none mt-0.5">
              {profile?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="text-ink-muted hover:text-status-expired transition-colors opacity-0 group-hover:opacity-100"
            title="Cerrar sesión"
          >
            <LogOut className="h-3.5 w-3.5" />
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
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150',
          isActive
            ? 'bg-brand-primary/10 text-brand-primary font-semibold'
            : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated'
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors',
              isActive ? 'text-brand-primary' : 'text-ink-muted'
            )}
          />
          <span className="flex-1 truncate">{label}</span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary shrink-0" />
          )}
        </>
      )}
    </NavLink>
  )
}

function SidebarSection({ label }: { label: string }) {
  return (
    <div className="px-3 pt-5 pb-1.5">
      <p className="text-[10px] font-bold text-ink-muted uppercase tracking-widest">{label}</p>
    </div>
  )
}
