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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FEATURE_NUTRITION } from '@/lib/constants'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useTheme } from '@/contexts/ThemeContext'
import { useSidebar } from '@/contexts/SidebarContext'
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
  const { collapsed, toggle } = useSidebar()
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
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0 bg-surface-card border-r border-surface-border h-screen sticky top-0 transition-all duration-200',
        collapsed ? 'w-16' : 'w-52'
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          'flex items-center h-14 border-b border-surface-border shrink-0',
          collapsed ? 'justify-center px-0' : 'gap-2.5 px-4'
        )}
      >
        <img
          src={
            theme === 'dark'
              ? '/logo_mark_original_white_transparent.png'
              : '/logo_mark_original_black_square.png'
          }
          alt="HH"
          className={cn(
            'object-contain shrink-0 transition-all duration-200',
            collapsed ? 'w-10 h-10 rounded-xl ring-2 ring-brand-primary/25 shadow-md shadow-brand-primary/10' : 'w-10 h-10 rounded-xl'
          )}
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-primary leading-none">Haciéndolo Hábito</p>
            <p className="text-[10px] text-ink-muted leading-none mt-0.5 font-medium tracking-wide uppercase">
              Ferster Fitness
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          'flex-1 py-4 overflow-y-auto scrollbar-hide space-y-0.5',
          collapsed ? 'px-2' : 'px-3'
        )}
      >
        {navItems.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}

        {!collapsed && <SidebarSection label="Finanzas" />}
        {collapsed && <div className="my-2 border-t border-surface-border" />}
        {financeItems.map((item) => (
          <SidebarItem key={item.href} {...item} collapsed={collapsed} />
        ))}

        {FEATURE_NUTRITION && (
          <>
            {!collapsed && <SidebarSection label="Nutrición" />}
            {collapsed && <div className="my-2 border-t border-surface-border" />}
            {nutritionItems.map((item) => (
              <SidebarItem key={item.href} {...item} collapsed={collapsed} />
            ))}
          </>
        )}

      </nav>

      {/* Collapse toggle */}
      <div className={cn('flex py-2', collapsed ? 'justify-center' : 'justify-end px-3')}>
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          className="p-1.5 text-ink-muted hover:text-ink-primary transition-colors"
        >
          {collapsed
            ? <ChevronRight className="h-4 w-4" />
            : <ChevronLeft className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Bottom */}
      <div
        className={cn(
          'pb-4 pt-3 border-t border-surface-border space-y-0.5',
          collapsed ? 'px-2' : 'px-3'
        )}
      >
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center rounded-xl py-2.5 text-sm transition-all duration-150',
              collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              isActive
                ? 'bg-brand-primary/10 text-brand-primary font-medium'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-elevated'
            )
          }
          title={collapsed ? 'Configuración' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Configuración</span>}
        </NavLink>

        {/* User row */}
        <div
          className={cn(
            'flex items-center rounded-xl py-2.5 hover:bg-surface-elevated transition-colors group',
            collapsed ? 'justify-center px-0' : 'gap-2.5 px-3'
          )}
          title={collapsed ? (profile?.full_name ?? '') : undefined}
        >
          <div className="w-7 h-7 rounded-lg bg-brand-primary flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">
              {profile ? getInitials(profile.full_name) : '?'}
            </span>
          </div>
          {!collapsed && (
            <>
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
            </>
          )}
        </div>

        {collapsed && (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full rounded-xl py-2.5 text-ink-muted hover:text-status-expired hover:bg-surface-elevated transition-all duration-150"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4 shrink-0" />
          </button>
        )}
      </div>
    </aside>
  )
}

function SidebarItem({
  label,
  href,
  icon: Icon,
  collapsed,
}: {
  label: string
  href: string
  icon: React.ElementType
  collapsed: boolean
}) {
  return (
    <NavLink
      to={href}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-xl py-2.5 text-sm transition-all duration-150',
          collapsed ? 'justify-center px-0' : 'gap-3 px-3',
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
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && isActive && (
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
